/**
 * worker/_socket.mjs — một kết nối WebSocket DNSE: xác thực, subscribe, ping/pong, tự nối lại, nối mới trước mốc 8 giờ.
 * Dùng chung cho worker broker (lệnh của khách) và worker thị trường (giá).
 * Giao thức: https://developers.dnse.com.vn/docs/sdk/build_websocket
 */
import crypto from 'node:crypto';

export const WS_BASE = () => (process.env.DNSE_WS_URL || 'wss://ws-openapi.dnse.com.vn').replace(/\/+$/, '');
const PING_MS = 25_000;                 // client chủ động ping, theo khuyến nghị của DNSE
const MAX_AGE_MS = 7.5 * 3600e3;        // nối mới trước khi DNSE ngắt ở mốc 8 giờ
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
    this.connectedAt = null; this.fatal = null;
  }
  _timer(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }
  _clear() { this.timers.forEach(clearTimeout); this.timers.clear(); }
  start() { this.stopped = false; this._connect(); }
  stop() { this.stopped = true; this._clear(); try { this.ws?.close(); } catch { /* đã đóng */ } this.state = 'stopped'; }

  _connect() {
    if (this.stopped) return;
    this.state = 'connecting';
    let ws;
    try { ws = new this.WS(`${WS_BASE()}/v1/stream?encoding=json`); } catch (e) { return this._retry(e.message); }
    this.ws = ws;
    ws.onmessage = (ev) => this._onMessage(ev.data);
    ws.onerror = () => { /* onclose sẽ xử lý */ };
    ws.onclose = () => { this._clear(); if (!this.stopped) this._retry('closed'); };
  }
  _send(o) { try { this.ws.send(JSON.stringify(o)); } catch { /* kết nối đang đóng */ } }

  _onMessage(data) {
    let m; try { m = JSON.parse(typeof data === 'string' ? data : Buffer.from(data).toString('utf8')); } catch { return; }
    switch (m?.action) {
      case 'welcome': return this._send(buildAuth(this.apiKey, this.apiSecret));
      case 'auth_success': this.state = 'subscribing'; return this._send({ action: 'subscribe', channels: this.channels });
      case 'subscribed':
        this.state = 'live'; this.attempt = 0; this.connectedAt = Date.now();
        this._clear();
        this._timer(() => this._rotate('hết hạn 8 giờ'), MAX_AGE_MS);
        this._ping();
        return;
      case 'ping': return this._send(m.timestamp ? { action: 'pong', timestamp: m.timestamp } : { action: 'pong' });
      case 'pong': case 'unsubscribed': return;
      case 'connection_expired': return this._rotate('server báo hết hạn');
      case 'error':
        log(`[${this.name}] lỗi từ DNSE:`, m.code, m.message);
        if (m.code === 'AUTH_FAILED' || m.code === 'MAX_CONNECTIONS_EXCEEDED') this.fatal = m.code;
        return;
      default: break;
    }
    this.onData(m);
  }
  _ping() { this._timer(() => { this._send({ action: 'ping' }); this._ping(); }, PING_MS); }
  _rotate(why) { log(`[${this.name}] nối lại: ${why}`); try { this.ws?.close(); } catch { /* */ } }
  _retry(why) {
    this.state = 'retry';
    const delay = Math.min(1000 * 2 ** this.attempt++, 60_000) + Math.floor(Math.random() * 500);
    if (this.attempt > 1) log(`[${this.name}] thử nối lại sau ${Math.round(delay / 1000)}s (${why}${this.fatal ? ', ' + this.fatal : ''})`);
    this._timer(() => this._connect(), delay);
  }
}
