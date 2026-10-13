/**
 * worker/_socket.mjs — một kết nối WebSocket DNSE: xác thực, subscribe, ping/pong, tự nối lại, nối mới trước mốc 8 giờ.
 * Dùng chung cho worker broker (lệnh của khách) và worker thị trường (giá).
 * Giao thức: https://developers.dnse.com.vn/docs/sdk/build_websocket
 */
import crypto from 'node:crypto';

export const WS_BASE = () => (process.env.DNSE_WS_URL || 'wss://ws-openapi.dnse.com.vn').replace(/\/+$/, '');
const PING_MS = 25_000;                 // client chủ động ping, theo khuyến nghị của DNSE
const MAX_AGE_MS = 7.5 * 3600e3;        // nối mới trước khi DNSE ngắt ở mốc 8 giờ
const CONNECT_TIMEOUT_MS = 20_000;      // từ lúc mở kết nối tới khi subscribe xong; quá hạn => hủy, thử lại
const IDLE_TIMEOUT_MS = 90_000;         // đang live mà không nhận được gì (kể cả pong) quá lâu => coi như mất kết nối
const CONTROL = new Set(['welcome', 'auth_success', 'subscribed', 'unsubscribed', 'ping', 'pong', 'connection_expired', 'error']);
export const isControl = (m) => !!m && typeof m === 'object' && CONTROL.has(m.action);

let lastNonce = 0;
/** Chữ ký xác thực WebSocket: HMAC-SHA256(secret, "{api_key}:{timestamp}:{nonce}") dạng hex. */
export function buildAuth(apiKey, apiSecret, now = Date.now()) {
  const timestamp = Math.floor(now / 1000);
  // Micro giây và luôn tăng dần: DNSE từ chối nonce đã dùng trong 10 phút, kể cả khi hai kết nối xác thực cùng lúc.
  lastNonce = Math.max(lastNonce + 1, now * 1000);
  const nonce = String(lastNonce);
  const signature = crypto.createHmac('sha256', apiSecret).update(`${apiKey}:${timestamp}:${nonce}`).digest('hex');
  return { action: 'auth', api_key: apiKey, signature, timestamp, nonce };
}

const log = (...a) => console.log(new Date().toISOString(), ...a);

export class DnseSocket {
  /**
   * @param {{ name: string, apiKey: string, apiSecret: string, channels: Array<{name:string,symbols:string[]}>,
   *           onData?: (m:any)=>void, WS?: typeof WebSocket }} o
   */
  constructor(o) {
    Object.assign(this, { name: o.name, apiKey: o.apiKey, apiSecret: o.apiSecret, channels: o.channels, onData: o.onData || (() => {}), WS: o.WS || globalThis.WebSocket });
    this.state = 'idle'; this.stopped = false; this.attempt = 0; this.ws = null; this.timers = new Set();
    this.connectedAt = null; this.fatal = null; this.lastMsgAt = 0; this.reconnects = 0;
    // Thời hạn có thể thu nhỏ khi test
    this.t = { ping: PING_MS, maxAge: MAX_AGE_MS, connect: CONNECT_TIMEOUT_MS, idle: IDLE_TIMEOUT_MS, ...(o.timeouts || {}) };
  }
  _timer(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }
  _clear() { this.timers.forEach(clearTimeout); this.timers.clear(); }
  start() { this.stopped = false; this._connect(); }
  stop() { this.stopped = true; this._clear(); this._drop(this.ws); this.ws = null; this.state = 'stopped'; }

  _connect() {
    if (this.stopped) return;
    this.state = 'connecting';
    let ws;
    try { ws = new this.WS(`${WS_BASE()}/v1/stream?encoding=json`); } catch (e) { return this._retry(e.message); }
    this.ws = ws;
    // Mọi sự kiện chỉ có tác dụng nếu đến từ kết nối HIỆN TẠI: kết nối cũ đóng muộn không được phá kết nối mới
    ws.onmessage = (ev) => { if (this.ws === ws) this._onMessage(ev.data); };
    ws.onerror = () => { /* onclose sẽ xử lý */ };
    ws.onclose = () => { if (this.ws !== ws) return; this.ws = null; this._clear(); if (!this.stopped) this._retry('closed'); };
    // Kết nối mở được nhưng DNSE không trả lời bước bắt tay: không chờ mãi
    this._timer(() => { if (this.ws === ws && this.state !== 'live') this._restart(`quá ${Math.round(this.t.connect / 1000)}s chưa kết nối xong (${this.state})`); }, this.t.connect);
  }
  /** Gỡ hẳn một kết nối: tắt mọi handler rồi đóng, không phụ thuộc vào việc onclose có được gọi hay không. */
  _drop(ws) {
    if (!ws) return;
    ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch { /* đã đóng */ }
  }
  /** Bỏ kết nối hiện tại và thử lại ngay theo nhịp lùi dần. */
  _restart(why) {
    log(`[${this.name}] nối lại: ${why}`);
    this.reconnects++;
    this._clear();
    const ws = this.ws; this.ws = null; this._drop(ws);
    if (!this.stopped) this._retry(why);
  }
  _send(o) { try { this.ws.send(JSON.stringify(o)); } catch { /* kết nối đang đóng */ } }

  _onMessage(data) {
    this.lastMsgAt = Date.now();
    let m; try { m = JSON.parse(typeof data === 'string' ? data : Buffer.from(data).toString('utf8')); } catch { return; }
    switch (m?.action) {
      case 'welcome': return this._send(buildAuth(this.apiKey, this.apiSecret));
      case 'auth_success': this.state = 'subscribing'; return this._send({ action: 'subscribe', channels: this.channels });
      case 'subscribed':
        this.state = 'live'; this.attempt = 0; this.connectedAt = Date.now();
        this._clear();
        this._timer(() => this._restart('hết hạn 8 giờ'), this.t.maxAge);
        this._ping();
        this._watch();
        return;
      case 'ping': return this._send(m.timestamp ? { action: 'pong', timestamp: m.timestamp } : { action: 'pong' });
      case 'pong': case 'unsubscribed': return;
      case 'connection_expired': return this._restart('server báo hết hạn');
      case 'error':
        log(`[${this.name}] lỗi từ DNSE:`, m.code, m.message);
        if (m.code === 'AUTH_FAILED' || m.code === 'MAX_CONNECTIONS_EXCEEDED') this.fatal = m.code;
        return;
      default: break;
    }
    this.onData(m);
  }
  _ping() { this._timer(() => { this._send({ action: 'ping' }); this._ping(); }, this.t.ping); }
  /** Canh tín hiệu: ping mỗi 25 giây nên luôn có pong; im lặng quá lâu nghĩa là kết nối đã chết mà không báo đóng. */
  _watch() {
    this._timer(() => {
      if (this.state !== 'live') return;
      if (Date.now() - this.lastMsgAt > this.t.idle) return this._restart(`${Math.round((Date.now() - this.lastMsgAt) / 1000)}s không nhận được tín hiệu`);
      this._watch();
    }, Math.min(this.t.idle / 3, 30_000));
  }
  _retry(why) {
    this.state = 'retry';
    const delay = Math.min(1000 * 2 ** this.attempt++, 60_000) + Math.floor(Math.random() * 500);
    if (this.attempt > 1) log(`[${this.name}] thử nối lại sau ${Math.round(delay / 1000)}s (${why}${this.fatal ? ', ' + this.fatal : ''})`);
    this._timer(() => this._connect(), delay);
  }
}
