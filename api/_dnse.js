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
 *   DNSE_MAX_DAILY_VND             hạn mức giá trị đặt trong ngày, TỪNG tiểu khoản (mặc định 100.000.000)
 *   DNSE_MAX_ORDERS_PER_DAY        hạn mức số lệnh trong ngày, TỪNG tiểu khoản (mặc định 20)
 *   DNSE_BASE_URL                  mặc định https://openapi.dnse.com.vn (sandbox: https://sb-openapi.dnse.com.vn)
 *   DNSE_RELAY_KEY                 có khi DNSE_BASE_URL trỏ về local-proxy ở nhà
 *
 * VÌ SAO PHẢI ĐI VÒNG: đo thật 19/10/2026 từ Vercel sin1, năm lần liên tiếp, openapi.dnse.com.vn
 * TREO đủ 8 giây rồi bỏ; cùng lúc máy ở nhà gọi bình thường. Không đi vòng thì care-by, số dư,
 * danh mục, sổ lệnh, đặt lệnh đều chết trên production — tức cả bàn môi giới. Trên Vercel đặt
 * DNSE_BASE_URL về `https://<tunnel>/dnse` và DNSE_RELAY_KEY; ở máy nhà để trống cả hai.
 */
import crypto from 'node:crypto';
import { rest } from './_db.js';
import { assertOwner as assertBrokerOwner } from './_broker.js';

export class DnseError extends Error {
  /** `chuaRo` = gọi đi rồi nhưng không có câu trả lời dứt khoát, nên KHÔNG kết luận được là lệnh đã vào hay chưa. */
  constructor(message, status = 502, code = 'dnse', { chuaRo = false } = {}) {
    super(message); this.status = status; this.code = code; this.expose = true; this.chuaRo = chuaRo;
  }
}

const base = () => (process.env.DNSE_BASE_URL || 'https://openapi.dnse.com.vn').replace(/\/+$/, '');
export const realTradingEnabled = () => process.env.DNSE_REAL_TRADING === '1';
export const maxOrderVnd = () => parseInt(process.env.DNSE_MAX_ORDER_VND || '', 10) || 20_000_000;
export const maxDailyVnd = () => parseInt(process.env.DNSE_MAX_DAILY_VND || '', 10) || 100_000_000;
export const maxOrdersPerDay = () => parseInt(process.env.DNSE_MAX_ORDERS_PER_DAY || '', 10) || 20;

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
  // Đi vòng qua local-proxy ở nhà (xem DNSE_BASE_URL bên dưới): thêm khóa relay. Chữ ký HMAC chỉ
  // ký (request-target), date và nonce, nên header thừa này không làm hỏng chữ ký.
  if (process.env.DNSE_RELAY_KEY) {
    headers['x-relay-key'] = process.env.DNSE_RELAY_KEY;
    headers['ngrok-skip-browser-warning'] = '1';
  }
  if (tradingToken && path.includes('/orders')) headers['trading-token'] = tradingToken;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null)).toString() : '';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  let res;
  try {
    res = await fetch(base() + path + qs, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
  } catch (e) {
    // Câu chữ phải khác bên đăng nhập (_dnselogin.js) để nhìn màn hình là biết hỏng ở đâu.
    // chuaRo: request đã rời máy chủ, hết giờ chờ hay đứt mạng đều KHÔNG chứng minh được là DNSE
    // chưa nhận. Bên gọi phải đối soát chứ không được coi như thất bại rồi gửi lại.
    const err = new DnseError('Không gọi được API giao dịch DNSE, thử lại sau.', 503, 'unreachable', { chuaRo: true });
    err.detail = `openapi:${e?.name === 'AbortError' ? 'quá 12s' : e?.cause?.code || e?.name || 'lỗi mạng'}`;
    throw err;
  } finally { clearTimeout(timer); }
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (res.ok) return data;
  const msg = data?.message || data?.error || `DNSE HTTP ${res.status}`;
  if (res.status === 401) throw new DnseError(tradingToken ? 'Phiên giao dịch DNSE đã hết hạn, cần xác thực OTP lại.' : 'DNSE từ chối API key (sai key/secret hoặc key đã bị thu hồi).', 401, 'dnse_auth');
  if (res.status === 429) throw new DnseError('DNSE đang giới hạn tần suất gọi, thử lại sau ít giây.', 429, 'rate');
  // 4xx = DNSE đã xét và từ chối, chắc chắn không có lệnh nào. 5xx = hỏng ở phía DNSE sau khi đã
  // nhận request, lệnh có thể đã vào sổ — không được kết luận là thất bại.
  const loiPhiaDnse = res.status >= 500;
  throw new DnseError(`DNSE: ${msg}`, loiPhiaDnse ? 502 : 400, data?.code || 'dnse', { chuaRo: loiPhiaDnse });
}

// ---------- Đọc tài khoản ----------
export const accounts = () => call('GET', '/accounts');
/** Môi giới/SACO: các tiểu khoản khách đã ủy quyền, kèm permissions[] (ADVISOR | BROKER) theo sản phẩm. */
export const careBy = () => call('GET', '/brokers/accounts/care-by');
export const balances = (acc) => call('GET', `/accounts/${encodeURIComponent(acc)}/balances`);
export const positions = (acc) => call('GET', `/accounts/${encodeURIComponent(acc)}/positions`, { query: { marketType: 'STOCK' } });
export const orderBook = (acc) => call('GET', `/accounts/${encodeURIComponent(acc)}/orders`, { query: { marketType: 'STOCK', orderCategory: 'NORMAL' } });
/**
 * Gói vay ký quỹ áp dụng cho một mã. Trả { loanPackages: [{ id, name, type, initialRate, interestRate,
 * maintenanceRate, liquidRate, brokerFirmBuyingFeeRate, brokerFirmSellingFeeRate }] }.
 * `initialRate` là tỷ lệ tiền của khách: 1 = trả đủ tiền, 0.5 = vay một nửa.
 */
export async function loanPackages(acc, symbol) {
  const r = await call('GET', `/accounts/${encodeURIComponent(acc)}/loan-packages`, { query: { marketType: 'STOCK', symbol } });
  return Array.isArray(r) ? r : r?.loanPackages || r?.data || [];
}

/**
 * Sức mua / sức bán cho một lệnh cụ thể.
 * ĐƠN VỊ: `price` phải tính bằng ĐỒNG (không phải nghìn đồng như securityDef trả về) — kiểm chứng
 * ngày 13/10/2026 trên tài khoản thật: sức mua 857.834 đ, giá 11.700 đ cho đúng qmaxBuy 73.
 * `qmaxSell` phụ thuộc GÓI VAY: cổ phiếu đang nằm ở gói nào thì phải hỏi bằng đúng gói đó,
 * hỏi bằng gói khác sẽ trả 0 và trông như khách không có gì để bán.
 * @returns {Promise<{qmaxBuy:number|null, qmaxSell:number|null, pp0Buy:number|null, price:number|null}>}
 */
export async function buyingPower(acc, { symbol, priceVnd, loanPackageId } = {}) {
  const r = await call('GET', `/accounts/${encodeURIComponent(acc)}/ppse`, {
    query: { marketType: 'STOCK', symbol, price: priceVnd, loanPackageId },
  });
  const n = (v) => (Number.isFinite(+v) ? +v : null);
  return { qmaxBuy: n(r?.qmaxBuy), qmaxSell: n(r?.qmaxSell), pp0Buy: n(r?.pp0Buy), price: n(r?.price) };
}
export async function securityDef(symbol) {
  const r = await call('GET', `/price/${encodeURIComponent(symbol)}/secdef`);
  const list = Array.isArray(r) ? r : r ? [r] : [];
  return list.find((x) => x.boardId === 'G1' || x.boardId === 'ROUND_LOT') || list[0] || null;
}

// ---------- OTP lớp 2 -> trading token (8 giờ) ----------
export const sendEmailOtp = () => call('POST', '/registration/send-email-otp');

const KHONG_DANG_KY = /otpType is not registered/i;

/**
 * Đổi OTP lấy trading token.
 *
 * Mỗi tài khoản DNSE chỉ bật MỘT loại OTP, và không có API nào cho biết là loại nào. Đo trên tài
 * khoản thật 20/10/2026: `email_otp` trả "otpType is not registered for this account", còn
 * `smart_otp` trả "The Smart OTP is not valid" — tức loại sau mới là loại đang bật.
 *
 * Vì vậy đoán sai loại thì thử nốt loại kia thay vì bắt người dùng tự mò. An toàn: DNSE từ chối
 * ngay ở bước kiểm loại nên mã OTP KHÔNG bị tiêu, và cũng không gửi gì cho ai.
 */
export async function verifyOtp(passcode, otpType = 'email_otp') {
  const thu = async (loai) => {
    let r;
    try {
      r = await call('POST', '/registration/trading-token', { body: { otpType: loai, passcode } });
    } catch (e) {
      // Câu của DNSE là tiếng Anh và không nói phải làm gì tiếp
      if (/INVALID_OTP|not valid/i.test(e?.message || '')) {
        throw new DnseError('Mã OTP không đúng hoặc đã hết hạn. Lấy mã mới trong app EntradeX rồi nhập lại.', 400, 'bad_otp');
      }
      throw e;
    }
    if (!r?.tradingToken) throw new DnseError('OTP không đúng hoặc đã hết hạn.', 400, 'bad_otp');
    return r.tradingToken;
  };
  try {
    return await thu(otpType);
  } catch (e) {
    const conLai = otpType === 'email_otp' ? 'smart_otp' : 'email_otp';
    if (!KHONG_DANG_KY.test(e?.message || '')) throw e;
    try {
      return await thu(conLai);
    } catch (e2) {
      if (!KHONG_DANG_KY.test(e2?.message || '')) throw e2;
      throw new DnseError('Tài khoản DNSE chưa bật loại OTP nào dùng được. Bật Smart OTP trong app EntradeX rồi thử lại.', 400, 'otp_chua_bat');
    }
  }
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
export function makeConfirm(uid, order, estValueVnd = null) {
  const payload = Buffer.from(JSON.stringify({ uid, order, estValueVnd, exp: Date.now() + 90e3, nonce: crypto.randomBytes(12).toString('base64url') })).toString('base64url');
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

// ---------- Hạn mức theo ngày cho từng tiểu khoản ----------
// `DNSE_MAX_ORDER_VND` chỉ chặn MỘT lệnh. Không có trần theo ngày thì một vòng lặp hỏng, một cú
// bấm liên tục hay một phiếu bị gửi đi gửi lại vẫn rải được vô số lệnh đúng hạn mức. Trần ngày là
// thứ giới hạn thiệt hại trong ngày đầu bật `DNSE_REAL_TRADING`, nên nó phải có mặc định an toàn
// và chạy ngay cả khi chưa đặt biến môi trường nào.

const fmtVnd = (n) => Math.round(n).toLocaleString('vi-VN');

/** Mốc 00:00 giờ Việt Nam của hôm nay (UTC+7, không có giờ mùa hè), dạng ISO UTC. */
export function startOfVnDay(now = Date.now()) {
  const VN = 7 * 3600e3;
  return new Date(Math.floor((now + VN) / 86400e3) * 86400e3 - VN).toISOString();
}

/**
 * Đã đặt bao nhiêu lệnh và bao nhiêu tiền trên một tiểu khoản kể từ 00:00 hôm nay, theo nhật ký
 * kiểm toán. Lệnh chưa biết kết quả (`result` rỗng, hoặc kết thúc ở trạng thái chưa rõ) VẪN TÍNH:
 * hạn mức phải tính theo hướng an toàn, thà chặn nhầm còn hơn cho qua một lệnh đã vào sàn.
 */
export async function dailyUsage(uid, accountNo = null) {
  // `broker=eq.dnse` bắt buộc từ khi có công ty chứng khoán thứ hai: không lọc thì một lệnh SHS
  // ăn vào trần ngày của DNSE, và bên nào đặt nhiều sẽ khóa bên kia lại mà không ai hiểu vì sao.
  const rows = await rest(`/dnse_audit?broker=eq.dnse&action=eq.place&at=gte.${startOfVnDay()}&select=request,result&limit=500`, { sub: uid });
  let orders = 0, vnd = 0;
  for (const r of rows || []) {
    if (r.result && r.result.ok === false && !r.result.chuaRo) continue;   // DNSE từ chối dứt khoát
    if (accountNo && String(r.request?.accountNo || '') !== String(accountNo)) continue;
    orders++;
    vnd += Number(r.request?.estValueVnd) || 0;
  }
  return { orders, vnd, maxOrders: maxOrdersPerDay(), maxVnd: maxDailyVnd() };
}

/** Chặn TRƯỚC khi gọi DNSE. Ném DnseError 429 khi lệnh này sẽ vượt trần ngày của tiểu khoản. */
export async function assertDailyLimit(uid, accountNo, estValueVnd) {
  const used = await dailyUsage(uid, accountNo);
  if (used.orders >= used.maxOrders) {
    throw new DnseError(
      `Tiểu khoản ${accountNo} đã đặt ${used.orders} lệnh hôm nay, chạm hạn mức ${used.maxOrders} lệnh mỗi ngày (DNSE_MAX_ORDERS_PER_DAY).`,
      429, 'daily_orders');
  }
  const sau = used.vnd + (Number(estValueVnd) || 0);
  if (sau > used.maxVnd) {
    throw new DnseError(
      `Lệnh này nâng giá trị đặt trong ngày của tiểu khoản ${accountNo} lên khoảng ${fmtVnd(sau)} đ, `
      + `vượt hạn mức ${fmtVnd(used.maxVnd)} đ mỗi ngày (DNSE_MAX_DAILY_VND).`,
      429, 'daily_vnd');
  }
  return used;
}
