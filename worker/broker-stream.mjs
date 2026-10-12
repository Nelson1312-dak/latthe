/**
 * worker/broker-stream.mjs — nhận sự kiện lệnh/vị thế của khách hàng từ DNSE Broker WebSocket,
 * ghi vào DB và cập nhật trạng thái phiếu lệnh. Chạy liên tục trên máy local cùng với DB.
 *
 *   node --env-file=.env.local worker/broker-stream.mjs
 *
 * Giới hạn của DNSE (https://developers.dnse.com.vn/docs/guide/market-data/broker_connect):
 *   - mỗi kết nối WebSocket chỉ theo dõi MỘT investor_id, sống tối đa 8 giờ;
 *   - server ping mỗi 3 phút, client phải pong trong 1 phút; nonce xác thực không được dùng lại.
 * Vì vậy worker giữ một kết nối cho mỗi khách, tự nối lại khi rớt và chủ động nối mới trước mốc 8 giờ.
 *
 * Biến môi trường: DNSE_API_KEY, DNSE_API_SECRET, SUPABASE_URL, DB_JWT_SECRET
 *   tùy chọn: DNSE_WS_URL (mặc định wss://ws-openapi.dnse.com.vn), WORKER_MAX_CONNECTIONS (mặc định 50)
 */
import crypto from 'node:crypto';
import { rest } from '../api/_db.js';
import { listClients } from '../api/_desk.js';

const WS_BASE = (process.env.DNSE_WS_URL || 'wss://ws-openapi.dnse.com.vn').replace(/\/+$/, '');
const MAX_CONNECTIONS = parseInt(process.env.WORKER_MAX_CONNECTIONS || '', 10) || 50;
const REFRESH_MS = 60_000;              // dò lại danh sách khách
const PING_MS = 25_000;                 // client chủ động ping, theo khuyến nghị của DNSE
const MAX_AGE_MS = 7.5 * 3600e3;        // nối mới trước khi DNSE ngắt ở mốc 8 giờ
const CONTROL = new Set(['welcome', 'auth_success', 'subscribed', 'unsubscribed', 'ping', 'pong', 'connection_expired', 'error']);

const log = (...a) => console.log(new Date().toISOString(), ...a);

/** Chữ ký xác thực WebSocket: HMAC-SHA256(secret, "{api_key}:{timestamp}:{nonce}") dạng hex. */
let lastNonce = 0;
export function buildAuth(apiKey, apiSecret, now = Date.now()) {
  const timestamp = Math.floor(now / 1000);
  // Micro giây và luôn tăng dần: DNSE từ chối nonce đã dùng trong 10 phút, kể cả khi hai kết nối xác thực cùng lúc.
  lastNonce = Math.max(lastNonce + 1, now * 1000);
  const nonce = String(lastNonce);
  const signature = crypto.createHmac('sha256', apiSecret).update(`${apiKey}:${timestamp}:${nonce}`).digest('hex');
  return { action: 'auth', api_key: apiKey, signature, timestamp, nonce };
}

export const channelsFor = (investorId) => [
  { name: `order.broker.STOCK.${investorId}.json`, symbols: [] },
  { name: `position.broker.STOCK.${investorId}.json`, symbols: [] },
];

/** Phân loại một message dữ liệu. Payload của kênh broker không có trường T nên nhận dạng theo trường đặc trưng. */
export function classify(msg) {
  if (msg && typeof msg === 'object' && !CONTROL.has(msg.action)) {
    if ('orderStatus' in msg && 'accountNo' in msg) return 'order';
    if ('openQuantity' in msg && 'accountNo' in msg) return 'position';
  }
  return null;
}

/** Ghi sự kiện lệnh và đồng bộ trạng thái sang phiếu lệnh. Sự kiện trùng bị DB bỏ qua nhờ ràng buộc UNIQUE. */
export async function saveOrderEvent(investorId, o, db = rest) {
  const row = {
    investor_id: String(investorId), account_no: String(o.accountNo), dnse_order_id: String(o.id),
    symbol: o.symbol ?? null, side: o.side ?? null, order_type: o.orderType ?? null,
    price: o.price ?? null, quantity: o.quantity ?? null,
    fill_quantity: o.fillQuantity ?? 0, canceled_quantity: o.canceledQuantity ?? 0,
    status: String(o.orderStatus), market_type: o.marketType ?? null,
    event_at: o.modifiedDate || o.createdDate || new Date().toISOString(), raw: o,
  };
  await db('/order_events?on_conflict=dnse_order_id,status,fill_quantity,canceled_quantity', {
    role: 'app_worker', method: 'POST', prefer: 'resolution=ignore-duplicates', body: row,
  });
  await db(`/order_tickets?dnse_order_id=eq.${encodeURIComponent(row.dnse_order_id)}&account_no=eq.${encodeURIComponent(row.account_no)}`, {
    role: 'app_worker', method: 'PATCH', body: { dnse_status: row.status },
  });
}

/** Một kết nối cho một khách. */
export class Feed {
  constructor(client, { apiKey, apiSecret, WS = globalThis.WebSocket, db = rest, onEvent = () => {} }) {
    this.client = client; this.apiKey = apiKey; this.apiSecret = apiSecret; this.WS = WS; this.db = db; this.onEvent = onEvent;
    this.state = 'idle'; this.stopped = false; this.attempt = 0; this.ws = null; this.timers = new Set();
    this.lastEventAt = null; this.connectedAt = null; this.events = 0;
    this.queue = Promise.resolve(); // sự kiện dữ liệu xử lý tuần tự: "Filled" không được bị "PartiallyFilled" đến chậm ghi đè
  }
  get investorId() { return this.client.investorId; }
  _timer(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }
  _clear() { this.timers.forEach(clearTimeout); this.timers.clear(); }

  start() { this.stopped = false; this._connect(); }
  stop() { this.stopped = true; this._clear(); try { this.ws?.close(); } catch { /* đã đóng */ } this.state = 'stopped'; }

  _connect() {
    if (this.stopped) return;
    this.state = 'connecting';
    let ws;
    try { ws = new this.WS(`${WS_BASE}/v1/stream?encoding=json`); } catch (e) { return this._retry(e.message); }
    this.ws = ws;
    ws.onmessage = (ev) => this._onMessage(ev.data);
    ws.onerror = () => { /* onclose sẽ xử lý */ };
    ws.onclose = () => { this._clear(); if (!this.stopped) this._retry('closed'); };
  }

  _send(o) { try { this.ws.send(JSON.stringify(o)); } catch { /* kết nối đang đóng */ } }

  async _onMessage(data) {
    let m; try { m = JSON.parse(typeof data === 'string' ? data : Buffer.from(data).toString('utf8')); } catch { return; }
    switch (m.action) {
      case 'welcome': return this._send(buildAuth(this.apiKey, this.apiSecret));
      case 'auth_success':
        this.state = 'subscribing';
        return this._send({ action: 'subscribe', channels: channelsFor(this.investorId) });
      case 'subscribed':
        this.state = 'live'; this.attempt = 0; this.connectedAt = Date.now();
        this._clear();
        this._timer(() => this._rotate('hết hạn 8 giờ'), MAX_AGE_MS);
        this._ping();
        return;
      case 'ping': return this._send(m.timestamp ? { action: 'pong', timestamp: m.timestamp } : { action: 'pong' });
      case 'connection_expired': return this._rotate('server báo hết hạn');
      case 'error':
        log(`[${this.investorId}] lỗi từ DNSE:`, m.code, m.message);
        if (m.code === 'AUTH_FAILED' || m.code === 'MAX_CONNECTIONS_EXCEEDED') this.fatal = m.code;
        return;
      default: break;
    }
    const kind = classify(m);
    if (kind) this.queue = this.queue.then(() => this._handleData(kind, m)).catch(() => {});
  }

  async _handleData(kind, m) {
    if (kind === 'order') {
      this.events++; this.lastEventAt = new Date().toISOString();
      try { await saveOrderEvent(this.investorId, m, this.db); this.onEvent(kind, m); }
      catch (e) { log(`[${this.investorId}] không ghi được sự kiện lệnh ${m.id}:`, e.message); }
    } else if (kind === 'position') {
      this.lastEventAt = new Date().toISOString(); this.onEvent(kind, m);
    }
  }

  _ping() { this._timer(() => { this._send({ action: 'ping' }); this._ping(); }, PING_MS); }
  _rotate(why) { log(`[${this.investorId}] nối lại: ${why}`); try { this.ws?.close(); } catch { /* */ } }
  _retry(why) {
    this.state = 'retry';
    const delay = Math.min(1000 * 2 ** this.attempt++, 60_000) + Math.floor(Math.random() * 500);
    if (this.attempt > 1) log(`[${this.investorId}] thử nối lại sau ${Math.round(delay / 1000)}s (${why}${this.fatal ? ', ' + this.fatal : ''})`);
    this._timer(() => this._connect(), delay);
  }
}

/** Quản lý toàn bộ kết nối: mở cho khách mới, đóng khi khách bỏ ủy quyền, báo trạng thái vào DB. */
export class Manager {
  constructor(opts = {}) {
    this.opts = { apiKey: process.env.DNSE_API_KEY, apiSecret: process.env.DNSE_API_SECRET, ...opts };
    this.list = opts.listClients || (() => listClients({ fresh: true }));
    this.db = opts.db || rest;
    this.feeds = new Map(); this.timer = null; this.max = opts.max || MAX_CONNECTIONS;
  }
  async sync() {
    let clients;
    try { clients = (await this.list()).filter((c) => c.canView && c.investorId); }
    catch (e) { log('không lấy được danh sách khách:', e.message); return this.report(e.message); }
    const want = new Map();
    for (const c of clients) if (!want.has(c.investorId)) want.set(c.investorId, c);   // một investor có thể có nhiều tiểu khoản
    let opened = 0;
    for (const [id, c] of want) {
      if (this.feeds.has(id)) continue;
      if (this.feeds.size >= this.max) { log(`đạt giới hạn ${this.max} kết nối, bỏ qua khách ${id}`); break; }
      const f = new Feed(c, { ...this.opts, db: this.db }); f.start(); this.feeds.set(id, f); opened++;
    }
    let closed = 0;
    for (const [id, f] of this.feeds) if (!want.has(id)) { f.stop(); this.feeds.delete(id); closed++; }
    if (opened || closed) log(`đồng bộ khách: +${opened} -${closed}, đang giữ ${this.feeds.size} kết nối`);
    return this.report();
  }
  report(error) {
    const feeds = [...this.feeds.values()];
    const info = {
      connections: feeds.length, live: feeds.filter((f) => f.state === 'live').length,
      investors: feeds.map((f) => ({ id: f.investorId, state: f.state, events: f.events, lastEventAt: f.lastEventAt })),
      events: feeds.reduce((a, f) => a + f.events, 0), ...(error ? { error } : {}),
    };
    return this.db('/worker_status?on_conflict=name', {
      role: 'app_worker', method: 'POST', prefer: 'resolution=merge-duplicates',
      body: { name: 'broker-stream', at: new Date().toISOString(), info },
    }).catch((e) => log('không ghi được trạng thái worker:', e.message));
  }
  start() { this.sync(); this.timer = setInterval(() => this.sync(), REFRESH_MS); }
  stop() { clearInterval(this.timer); this.feeds.forEach((f) => f.stop()); this.feeds.clear(); }
}

// Chạy trực tiếp: node worker/broker-stream.mjs
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('broker-stream.mjs')) {
  for (const k of ['DNSE_API_KEY', 'DNSE_API_SECRET', 'SUPABASE_URL', 'DB_JWT_SECRET']) {
    if (!process.env[k]) { console.error(`Thiếu biến môi trường ${k}`); process.exit(1); }
  }
  if (typeof globalThis.WebSocket !== 'function') { console.error('Cần Node 22 trở lên (có WebSocket sẵn).'); process.exit(1); }
  const m = new Manager(); m.start();
  log('worker realtime khởi động');
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { log('dừng worker'); m.stop(); process.exit(0); });
}
