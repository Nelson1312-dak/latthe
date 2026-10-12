/**
 * api/_dnse.js — DNSE Open API cho RIÊNG tài khoản chủ sở hữu site (API key + secret của chủ, ký HMAC-SHA256).
 * Underscore prefix => Vercel không expose thành route.
 * Đặc tả ký request theo SDK chính thức: https://github.com/dnse-tech/dnse-py (src/dnse/_hmac_signer.py)
 *
 * Biến môi trường:
 *   DNSE_API_KEY, DNSE_API_SECRET  lấy ở EntradeX > LightSpeed API (secret chỉ hiện một lần)
 *   DNSE_OWNER_USERNAME            username trên latbai.vn được phép dùng (mọi user khác bị 403)
 *   DNSE_REAL_TRADING              '1' mới cho đặt/hủy lệnh thật (mặc định TẮT, chỉ xem)
 *   DNSE_MAX_ORDER_VND             hạn mức giá trị mỗi lệnh (mặc định 20.000.000)
 *   DNSE_BASE_URL                  mặc định https://openapi.dnse.com.vn (sandbox: https://sb-openapi.dnse.com.vn)
 */
import crypto from 'node:crypto';
import { rest } from './_db.js';
import { assertOwner as assertBrokerOwner } from './_broker.js';

export class DnseError extends Error {
  constructor(message, status = 502, code = 'dnse') { super(message); this.status = status; this.code = code; this.expose = true; }
}

const base = () => (process.env.DNSE_BASE_URL || 'https://openapi.dnse.com.vn').replace(/\/+$/, '');
export const realTradingEnabled = () => process.env.DNSE_REAL_TRADING === '1';
export const maxOrderVnd = () => parseInt(process.env.DNSE_MAX_ORDER_VND || '', 10) || 20_000_000;

/** Chỉ user chủ sở hữu (đã đăng nhập site) mới được chạm vào tài khoản DNSE thật. */
export async function assertOwner(uid) {
  if (!process.env.DNSE_API_KEY || !process.env.DNSE_API_SECRET) {
    throw new DnseError('Kết nối DNSE chưa được cấu hình (thiếu API key).', 503, 'config');
  }
  await assertBrokerOwner(uid);
}

// ---------- Ký request (HTTP Signature, HMAC-SHA256) ----------
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');
/** RFC 2822 theo UTC, giống strftime("%a, %d %b %Y %H:%M:%S %z") của SDK. */
export function rfc2822(d = new Date()) {
  return `${DAYS[d.getUTCDay()]}, ${p2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ` +
    `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} +0000`;
}

/** path: đường dẫn KHÔNG kèm query (SDK ký path, query truyền riêng). */
export function signatureHeaders(method, path, { apiKey, apiSecret, date = rfc2822(), nonce = crypto.randomUUID().replace(/-/g, '') } = {}) {
  const sigString = [`(request-target): ${method.toLowerCase()} ${path}`, `date: ${date}`, `nonce: ${nonce}`].join('\n');
  const sig = encodeURIComponent(crypto.createHmac('sha256', apiSecret).update(sigString).digest('base64'));
  return {
    'x-api-key': apiKey,
    date,
    'X-Signature': `Signature keyId="${apiKey}",algorithm="hmac-sha256",headers="(request-target) date",signature="${sig}",nonce="${nonce}"`,
  };
}

async function call(method, path, { query, body, tradingToken } = {}) {
  const headers = {
    Accept: 'application/json',
    ...signatureHeaders(method, path, { apiKey: process.env.DNSE_API_KEY, apiSecret: process.env.DNSE_API_SECRET }),
  };
  if (tradingToken && path.includes('/orders')) headers['trading-token'] = tradingToken;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null)).toString() : '';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  let res;
  try {
    res = await fetch(base() + path + qs, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
  } catch {
    throw new DnseError('Không kết nối được DNSE, thử lại sau.', 503, 'unreachable');
  } finally { clearTimeout(timer); }
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (res.ok) return data;
  const msg = data?.message || data?.error || `DNSE HTTP ${res.status}`;
  if (res.status === 401) throw new DnseError(tradingToken ? 'Phiên giao dịch DNSE đã hết hạn, cần xác thực OTP lại.' : 'DNSE từ chối API key (sai key/secret hoặc key đã bị thu hồi).', 401, 'dnse_auth');
  if (res.status === 429) throw new DnseError('DNSE đang giới hạn tần suất gọi, thử lại sau ít giây.', 429, 'rate');
  throw new DnseError(`DNSE: ${msg}`, res.status >= 400 && res.status < 500 ? 400 : 502, data?.code || 'dnse');
}

// ---------- Đọc tài khoản ----------
export const accounts = () => call('GET', '/accounts');
/** Môi giới/SACO: các tiểu khoản khách đã ủy quyền, kèm permissions[] (ADVISOR | BROKER) theo sản phẩm. */
export const careBy = () => call('GET', '/brokers/accounts/care-by');
export const balances = (acc) => call('GET', `/accounts/${encodeURIComponent(acc)}/balances`);
export const positions = (acc) => call('GET', `/accounts/${encodeURIComponent(acc)}/positions`, { query: { marketType: 'STOCK' } });
export const orderBook = (acc) => call('GET', `/accounts/${encodeURIComponent(acc)}/orders`, { query: { marketType: 'STOCK', orderCategory: 'NORMAL' } });
export const loanPackages = (acc, symbol) => call('GET', `/accounts/${encodeURIComponent(acc)}/loan-packages`, { query: { marketType: 'STOCK', symbol } });
export async function securityDef(symbol) {
  const r = await call('GET', `/price/${encodeURIComponent(symbol)}/secdef`);
  const list = Array.isArray(r) ? r : r ? [r] : [];
  return list.find((x) => x.boardId === 'G1' || x.boardId === 'ROUND_LOT') || list[0] || null;
}

// ---------- OTP lớp 2 -> trading token (8 giờ) ----------
export const sendEmailOtp = () => call('POST', '/registration/send-email-otp');
export async function verifyOtp(passcode, otpType = 'email_otp') {
  const r = await call('POST', '/registration/trading-token', { body: { otpType, passcode } });
  if (!r?.tradingToken) throw new DnseError('OTP không đúng hoặc đã hết hạn.', 400, 'bad_otp');
  return r.tradingToken;
}

// ---------- Lệnh thật ----------
export const placeOrder = (tradingToken, order) =>
  call('POST', '/accounts/orders', { query: { marketType: 'STOCK', orderCategory: 'NORMAL' }, body: order, tradingToken });
export const cancelOrder = (tradingToken, acc, id) =>
  call('DELETE', `/accounts/${encodeURIComponent(acc)}/orders/${encodeURIComponent(id)}`, { query: { marketType: 'STOCK', orderCategory: 'NORMAL' }, tradingToken });

// ---------- Trading token giữ trong cookie mã hóa của chính trình duyệt chủ sở hữu (không lưu server) ----------
const TT_COOKIE = 'lb_dnse_tt';
const IS_PROD = process.env.NODE_ENV === 'production';
function ttKey() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new DnseError('SESSION_SECRET chưa được cấu hình.', 503, 'config');
  return crypto.createHash('sha256').update('dnse-trading-token:' + s).digest();
}
export function setTradingCookie(res, uid, token) {
  const exp = Date.now() + 8 * 3600e3 - 120e3;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', ttKey(), iv);
  c.setAAD(Buffer.from(uid)); // gắn với đúng user: cookie chép sang phiên khác không giải mã được
  const enc = Buffer.concat([c.update(JSON.stringify({ t: token, exp }), 'utf8'), c.final()]);
  const val = [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
  res.setHeader('Set-Cookie', `${TT_COOKIE}=${val}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${Math.floor((exp - Date.now()) / 1000)}${IS_PROD ? '; Secure' : ''}`);
  return new Date(exp).toISOString();
}
export function clearTradingCookie(res) {
  res.setHeader('Set-Cookie', `${TT_COOKIE}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${IS_PROD ? '; Secure' : ''}`);
}
/** @returns {{ token: string, exp: number } | null} */
export function readTradingCookie(req, uid) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${TT_COOKIE}=([^;]+)`));
  if (!m) return null;
  try {
    const [iv, tag, enc] = m[1].split('.').map((x) => Buffer.from(x, 'base64url'));
    const d = crypto.createDecipheriv('aes-256-gcm', ttKey(), iv);
    d.setAAD(Buffer.from(uid));
    d.setAuthTag(tag);
    const v = JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString('utf8'));
    return typeof v.t === 'string' && v.exp > Date.now() ? { token: v.t, exp: v.exp } : null;
  } catch { return null; }
}

// ---------- Xem trước -> xác nhận: token ký HMAC, hạn 90 giây, dùng đúng một lần ----------
function confirmSign(data) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update('dnse-confirm:' + data).digest('base64url');
}
export function makeConfirm(uid, order) {
  const payload = Buffer.from(JSON.stringify({ uid, order, exp: Date.now() + 90e3, nonce: crypto.randomBytes(12).toString('base64url') })).toString('base64url');
  return `${payload}.${confirmSign(payload)}`;
}
export function readConfirm(uid, token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const want = Buffer.from(confirmSign(payload)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  const v = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (v.uid !== uid || v.exp < Date.now()) return null;
  return v;
}

/** Ghi nhật ký trước khi gửi; nonce trùng (gửi lại cùng xác nhận) => lỗi 409. */
export async function auditStart(uid, action, nonce, request) {
  try {
    const rows = await rest('/dnse_audit?select=id', { sub: uid, method: 'POST', prefer: 'return=representation', body: { user_id: uid, action, nonce, request } });
    return rows[0].id;
  } catch (e) {
    if (e.pgCode === '23505') throw new DnseError('Lệnh này đã được gửi rồi.', 409, 'duplicate');
    throw e;
  }
}
export async function auditFinish(uid, id, result) {
  try { await rest(`/dnse_audit?id=eq.${id}`, { sub: uid, method: 'PATCH', body: { result } }); } catch (e) { console.error('[dnse-audit]', e?.message); }
}
