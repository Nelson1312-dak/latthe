/**
 * api/_dnselogin.js — xác minh một tài khoản DNSE (số lưu ký, email hoặc số điện thoại + mật khẩu) bằng API đăng nhập chính thức:
 * https://hdsd.dnse.com.vn/san-pham-dich-vu/api-lightspeed/ii.-trading-api/2.-dang-nhap-va-xac-thuc/2.1.-dang-nhap
 * Underscore prefix => không phải route.
 *
 * Chỉ dùng để NHẬN DIỆN người dùng. Mật khẩu chỉ đi qua hàm login() tới DNSE; token trả về dùng một lần để đọc hồ sơ rồi bỏ.
 * Không ghi log nội dung request/response. Không lưu mật khẩu hay token ở bất kỳ đâu.
 *
 * Biến môi trường: DNSE_LOGIN_CUSTODY (danh sách số lưu ký được phép, cách nhau bằng dấu phẩy).
 *                  DNSE_AUTH_BASE_URL chỉ dùng để test với server giả (mặc định https://services.entrade.com.vn).
 */
const base = () => (process.env.DNSE_AUTH_BASE_URL || 'https://services.entrade.com.vn').replace(/\/+$/, '');

export class DnseLoginError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; this.expose = true; }
}

/** Danh sách số lưu ký được phép đăng nhập, chuẩn hóa chữ hoa. Rỗng = tính năng tắt. */
export const allowedCustody = () =>
  (process.env.DNSE_LOGIN_CUSTODY || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
export const dnseLoginEnabled = () => allowedCustody().length > 0;

async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  let res;
  try {
    res = await fetch(base() + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
  } catch {
    throw new DnseLoginError('Không kết nối được DNSE, thử lại sau.', 503, 'unreachable');
  } finally { clearTimeout(timer); }
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: res.status, ok: res.ok, data };
}

/** @returns {Promise<{ custodyCode: string, investorId: string|null, name: string|null, email: string|null }>} */
export async function verifyDnseAccount(username, password) {
  const r = await call('/dnse-auth-service/login', { method: 'POST', body: { username, password } });
  if (r.status === 400 || r.status === 401 || r.status === 403) throw new DnseLoginError('Sai thông tin đăng nhập DNSE.', 401, 'bad_credentials');
  if (r.status === 429) throw new DnseLoginError('DNSE đang giới hạn số lần thử, đợi một chút rồi thử lại.', 429, 'rate');
  if (!r.ok || !r.data?.token) throw new DnseLoginError('DNSE không xác nhận được tài khoản, thử lại sau.', 502, 'dnse');
  const me = await call('/dnse-user-service/api/me', { token: r.data.token });
  if (!me.ok || !me.data?.custodyCode) throw new DnseLoginError('Không đọc được hồ sơ tài khoản DNSE.', 502, 'no_profile');
  return {
    custodyCode: String(me.data.custodyCode).toUpperCase(),
    investorId: me.data.investorId != null ? String(me.data.investorId) : null,
    name: me.data.name || null,
    email: me.data.email ? String(me.data.email).toLowerCase() : null,
  };
}

/** Tên đăng nhập trên Lật Bài suy ra từ số lưu ký, hợp lệ theo ràng buộc của bảng users. */
export const usernameFromCustody = (custody) => ('d' + String(custody).toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 24);
