/**
 * api/_shs.js — client SHS Smart (shsmart.shs.com.vn).
 * Underscore prefix => Vercel không expose thành route.
 *
 * Phạm vi: tài khoản của CHÍNH chủ hệ thống. SHS không có mô hình ủy quyền môi giới như careBy của
 * DNSE, nên không đặt lệnh hộ khách được và cũng không nên thử: làm vậy là đăng nhập dưới danh nghĩa
 * khách, không phải môi giới. Xem docs/ARCHITECTURE.md mục 9.
 * Mật khẩu SHS chỉ đi qua hàm login() tới SHS, không ghi log và không lưu ở đâu.
 *
 * Biến môi trường:
 *   SHS_REAL_TRADING        '1' mới cho đặt/hủy lệnh thật (mặc định TẮT, chỉ xem)
 *   SHS_MAX_ORDER_VND       hạn mức giá trị mỗi lệnh (mặc định 2.000.000)
 *   SHS_MAX_DAILY_VND       hạn mức giá trị đặt trong ngày, từng tiểu khoản (mặc định 5.000.000)
 *   SHS_MAX_ORDERS_PER_DAY  hạn mức số lệnh trong ngày, từng tiểu khoản (mặc định 5)
 *   SHS_BASE_URL            mặc định https://shsmart.shs.com.vn
 *
 * ĐƯỜNG ĐẶT LỆNH LẤY TỪ ĐÂU: SHS không công bố Open API, nên hình dạng request đọc ra từ chính
 * bundle JavaScript của app SHSmart (chunk 6757, hàm dựng payload `x()`), đối chiếu với các enum
 * trong chunk 2979. Hệ quả phải nhớ: đây là API nội bộ, KHÔNG có hợp đồng, SHS đổi lúc nào cũng
 * được và sẽ không báo trước. Vì vậy mọi hàm ghi ở dưới đều đi qua hạn mức và nhật ký kiểm toán.
 */
import { BrokerError } from './_broker.js';

const base = () => (process.env.SHS_BASE_URL || 'https://shsmart.shs.com.vn').replace(/\/+$/, '');

const baseHeaders = () => ({
  Accept: 'application/json',
  platform: 'WEB',
  mediatype: '11',
  lang: 'vi',
});

async function call(method, path, { token, body, query } = {}) {
  const headers = baseHeaders();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json; charset=UTF-8';
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null)) : '';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  let res;
  try {
    res = await fetch(base() + path + qs, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
  } catch {
    throw new BrokerError('Không kết nối được SHS, thử lại sau.', 503, 'unreachable');
  } finally { clearTimeout(timer); }

  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (res.ok) return data;
  const msg = data?.message || data?.error_description || data?.code || `SHS HTTP ${res.status}`;
  if (res.status === 401) throw new BrokerError('Phiên SHS đã hết hạn, hãy kết nối lại.', 401, 'shs_expired');
  if (res.status === 429) throw new BrokerError('SHS đang giới hạn tần suất, thử lại sau ít phút.', 429, 'rate');
  throw new BrokerError(`SHS: ${msg}`, res.status >= 400 && res.status < 500 ? 400 : 502, data?.code || 'shs');
}

/** Hạn dùng lấy từ claim exp của access token. */
export function tokenExpiry(token) {
  try {
    const exp = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString()).exp;
    if (Number.isFinite(exp)) return new Date(exp * 1000);
  } catch { /* dùng mặc định */ }
  return new Date(Date.now() + 8 * 3600e3);
}

/** Lớp 1: tài khoản + mật khẩu SHS. deviceId cố định theo người dùng để SHS không coi là thiết bị lạ mỗi lần. */
export async function login(username, password, deviceId) {
  const r = await call('POST', '/api/v1/login', {
    body: {
      username, password,
      grant_type: 'wts2.0', client_id: 'shs', client_secret: 'shs',
      deviceInfo: { deviceId, deviceOs: 'Linux', deviceName: 'LatBai', deviceOsVersion: '1.0', deviceModel: 'web' },
      platform: 'WEB',
    },
  });
  if (!r?.accessToken) throw new BrokerError('SHS không trả về phiên đăng nhập.', 502);
  return { accessToken: r.accessToken, refreshToken: r.refreshToken || null };
}

/** Lớp 2: xin chỉ số ô trên thẻ ma trận OTP. */
export const genMatrixOtp = (token) => call('POST', '/api/v1/genMatrixOtp', { token, body: { sendSms: false } });

export async function verifyOtp(token, { otp, otpIndex, transactionId, otpType = '2' }) {
  const r = await call('POST', '/api/v1/verifyOTP', {
    token, body: { authenticate: true, otp, otpType, otpIndex, transactionId },
  });
  if (!r?.accessToken) throw new BrokerError('Mã OTP không đúng hoặc đã hết hạn.', 400, 'bad_otp');
  return { accessToken: r.accessToken, refreshToken: r.refreshToken || null };
}

// ---------- Đọc dữ liệu tài khoản ----------
export const customerInfo = (token, accountNumber) => call('GET', '/api/v1/customerInfo', { token, query: { accountNumber } });
export const accounts = (token, accountNumber) => call('GET', '/api/v1/account', { token, query: { accountNumber } });
export const cashBalance = (token, accountNumber, subNumber) =>
  call('GET', '/api/v1/equity/cash/balance', { token, query: { accountNumber, subNumber } });
export const portfolio = (token, accountNumber, subNumber) =>
  call('GET', '/api/v2/stock/portfolio-investment', { token, query: { accountNumber, subNumber } });
export const todayOrders = (token, accountNumber, subNumber) =>
  call('GET', '/api/v2/order/today-orders', { token, query: { accountNumber, subNumber, page: 1, size: 50, sellBuyType: '%', type: '0' } });

/** Tài khoản chính nằm trong claim của access token (ud.ex.acc), dùng khi chưa biết số tài khoản. */
export function accountsFromToken(token) {
  try {
    const c = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString());
    const ud = c?.ud || {};
    return { main: ud.ex?.acc?.[0]?.accountNumber || ud.mainAcc || null, username: ud.u || null };
  } catch { return { main: null, username: null }; }
}

// ---------- Công tắc và hạn mức ----------
const soNguyen = (v, md) => parseInt(v || '', 10) || md;
export const realTradingEnabled = () => process.env.SHS_REAL_TRADING === '1';
export const maxOrderVnd = () => soNguyen(process.env.SHS_MAX_ORDER_VND, 2_000_000);
export const maxDailyVnd = () => soNguyen(process.env.SHS_MAX_DAILY_VND, 5_000_000);
export const maxOrdersPerDay = () => soNguyen(process.env.SHS_MAX_ORDERS_PER_DAY, 5);
export const limits = () => ({ maxOrders: maxOrdersPerDay(), maxVnd: maxDailyVnd() });

// ---------- Từ vựng lệnh của SHS ----------
// Lấy từ enum trong bundle: bi{BUY:"BUY",SELL:"SELL"}, W4{LO,MP,ATO,ATC,MOK,MAK,MTL,PLO}, Ap{WEB:"11"}.
// `B`/`S` là cách gọi trong site này; đổi sang chữ SHS hiểu ngay tại chỗ gửi đi.
export const SIDE = { B: 'BUY', S: 'SELL' };
export const ORDER_TYPES = ['LO', 'MP', 'ATO', 'ATC', 'MOK', 'MAK', 'MTL', 'PLO'];
const MEDIA_WEB = '11';

/** Giá SHS tính bằng ĐỒNG, không phải nghìn đồng (bundle chặn trần giá HOSE ở 500.000). */
export const DON_VI_GIA = 'vnd';

/**
 * Đặt lệnh cơ sở. Tên trường đúng theo hàm dựng payload của app SHSmart:
 * cổ phiếu dùng `stockCode` (phái sinh mới dùng `code`) — nhầm chỗ này thì SHS trả lỗi khó hiểu.
 */
export async function placeOrder(token, o) {
  return call('POST', '/api/v1/equity/order', {
    token,
    body: {
      accountNumber: o.accountNumber,
      subNumber: o.subNumber,
      stockCode: o.symbol,
      sellBuyType: o.side,
      orderType: o.type,
      orderPrice: o.price,
      orderQuantity: o.qty,
      mediaType: MEDIA_WEB,
    },
  });
}

/** Hủy lệnh. Theo bundle là PUT chứ không phải DELETE. */
export async function cancelOrder(token, o) {
  return call('PUT', '/api/v1/equity/order/cancel', {
    token,
    body: {
      accountNumber: o.accountNumber,
      subNumber: o.subNumber,
      stockCode: o.symbol,
      sellBuyType: o.side,
      orderType: o.type,
      orderPrice: o.price,
      orderQuantity: o.qty,
      orderNumber: o.orderNumber,
      ...(o.branchCode ? { branchCode: o.branchCode } : {}),
      mediaType: MEDIA_WEB,
    },
  });
}

// ---------- Số liệu phục vụ phiếu lệnh ----------
export const subAccounts = (token, accountNumber) =>
  call('GET', '/api/v1/equity/account/subs', { token, query: { accountNumber } });
export const buyable = (token, accountNumber, subNumber, symbol, price) =>
  call('GET', '/api/v1/equity/account/buyable', { token, query: { accountNumber, subNumber, symbol, price } });
export const sellable = (token, accountNumber, subNumber, symbol) =>
  call('GET', '/api/v1/equity/account/sellable', { token, query: { accountNumber, subNumber, symbol } });
