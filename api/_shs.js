/**
 * api/_shs.js — client SHS Smart (shsmart.shs.com.vn).
 * Underscore prefix => Vercel không expose thành route.
 *
 * Phạm vi: CHỈ ĐỌC. Bộ API hiện có không có endpoint đặt hay hủy lệnh, nên không có hàm nào gửi lệnh.
 * Mật khẩu SHS chỉ đi qua hàm login() tới SHS, không ghi log và không lưu ở đâu.
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
