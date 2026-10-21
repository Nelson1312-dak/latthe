/**
 * api/_dnselogin.js — xác minh một tài khoản DNSE (số lưu ký, email hoặc số điện thoại + mật khẩu) bằng API đăng nhập chính thức:
 * https://hdsd.dnse.com.vn/san-pham-dich-vu/api-lightspeed/ii.-trading-api/2.-dang-nhap-va-xac-thuc/2.1.-dang-nhap
 * Underscore prefix => không phải route.
 *
 * Chỉ dùng để NHẬN DIỆN người dùng. Mật khẩu chỉ đi qua hàm login() tới DNSE; token trả về dùng
 * một lần để đọc hồ sơ VÀ tên các tiểu khoản, rồi bỏ.
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

async function call(path, { method = 'GET', token, body, step = 'dnse', budget = 7000 } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const ctl = new AbortController();
  // Vercel gói Hobby cắt function ở 10 giây. Hai lần gọi DNSE phải chia nhau khoản đó, nếu không function
  // bị cắt giữa chừng và người dùng chỉ thấy lỗi trống của Vercel thay vì câu giải thích.
  const timer = setTimeout(() => ctl.abort(), Math.max(1000, budget));
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(base() + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
  } catch (e) {
    // Ghi lại BƯỚC và LOẠI lỗi (không có nội dung request/response, không có mật khẩu)
    const why = e?.name === 'AbortError' ? `quá ${Math.round((Date.now() - t0) / 1000)}s` : e?.cause?.code || e?.name || 'lỗi mạng';
    const err = new DnseLoginError('Không kết nối được DNSE, thử lại sau.', 503, 'unreachable');
    err.detail = `${step}:${why}`;
    throw err;
  } finally { clearTimeout(timer); }
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: res.status, ok: res.ok, data, step, ms: Date.now() - t0 };
}

/** Dạng số lưu ký, ví dụ 064C123456. Người nhập đúng dạng này thì chính nó đã là danh tính. */
export const CUSTODY_LIKE = /^\d{3}[A-Za-z]\d{6}$/;

const TONG_HAN = 8500;   // tổng thời gian cho cả hai lần gọi, chừa chỗ để Vercel kịp trả lời trong 10 giây

/** @returns {Promise<{ custodyCode: string, investorId: string|null, name: string|null, email: string|null, thieuHoSo?: string }>} */
export async function verifyDnseAccount(username, password) {
  const batDau = Date.now();
  const r = await call('/dnse-auth-service/login', { method: 'POST', body: { username, password }, step: 'login', budget: 6000 });
  if (r.status === 400 || r.status === 401 || r.status === 403) throw new DnseLoginError('Sai thông tin đăng nhập DNSE.', 401, 'bad_credentials');
  if (r.status === 429) throw new DnseLoginError('DNSE đang giới hạn số lần thử, đợi một chút rồi thử lại.', 429, 'rate');
  if (!r.ok || !r.data?.token) {
    const e = new DnseLoginError('DNSE không xác nhận được tài khoản, thử lại sau.', 502, 'dnse');
    e.detail = `login:HTTP ${r.status}${r.data?.token ? '' : ', không có token'}`;
    throw e;
  }
  // DNSE đã xác nhận mật khẩu. Bước sau chỉ để biết tên và số lưu ký.
  let me, vuong = null;
  try {
    me = await call('/dnse-user-service/api/me', { token: r.data.token, step: 'me', budget: TONG_HAN - (Date.now() - batDau) });
    if (!me.ok || !me.data?.custodyCode) vuong = `me:HTTP ${me.status}${me.data ? ', thiếu custodyCode' : ', không phải JSON'}`;
  } catch (e) { vuong = e.detail || 'me:lỗi mạng'; }

  // Tên tiểu khoản. CHỈ gọi được bằng token đăng nhập mật khẩu này; API key HMAC mà đường đặt
  // lệnh dùng thì /accounts không trả tên, và /accounts/{id} là 404 - đã đo cả hai.
  // Cố ý KHÔNG lưu token: lấy tên NGAY ở đây rồi trả ra cùng hồ sơ, token vẫn bị bỏ như cũ.
  // Tên tiểu khoản gần như không bao giờ đổi, nên lấy một lần mỗi khi đăng nhập là đủ.
  // Hỏng thì bỏ qua, tuyệt đối không chặn đăng nhập vì một cái nhãn.
  // `chanDoan` ghi lại HÌNH DẠNG của lần gọi này để còn đọc được từ DB. console.log không dùng
  // được: `vercel logs` trên dự án này chỉ hiện dòng request, cột message luôn là "(no message)",
  // và còn bỏ sót cả request - đã thử gọi /api/auth/dnse rồi tìm trong log, không thấy.
  // Chỉ ghi hình dạng: mã HTTP, số tiểu khoản, tên trường. Không bao giờ ghi giá trị.
  let subNames = null, chanDoan = null;
  try {
    const conLai = TONG_HAN - (Date.now() - batDau);
    if (conLai <= 1200) {
      chanDoan = `bo qua, chi con ${conLai}ms`;
    } else {
      const a = await call('/dnse-order-service/accounts', { token: r.data.token, step: 'accounts', budget: Math.min(conLai, 2500) });
      // Chấp nhận nhiều dạng vỏ: {accounts:[...]}, {data:[...]}, hoặc mảng thẳng.
      const ds = a.ok ? (a.data?.accounts || a.data?.data || a.data || []) : [];
      const ma = Array.isArray(ds) ? ds : [];
      const m = {};
      for (const x of ma) {
        const ten = x?.accountTypeName || x?.accountName || x?.name || x?.productName || null;
        if (x?.id && ten) m[String(x.id)] = String(ten).slice(0, 60);
      }
      if (Object.keys(m).length) subNames = m;
      chanDoan = `HTTP ${a.status} | ${ma.length} tieu khoan | truong: ${ma[0] ? Object.keys(ma[0]).join(',') : '(rong)'} | lay duoc ${Object.keys(m).length}`;
    }
  } catch (e) { chanDoan = 'loi: ' + (e?.detail || e?.message || 'khong ro'); }

  if (vuong) {
    // Người dùng gõ thẳng số lưu ký thì chính nó là danh tính, và DNSE vừa xác nhận mật khẩu thuộc về nó:
    // không cần hồ sơ vẫn nhận ra được ai, nên cho vào thay vì chặn chỉ vì một endpoint phụ đang trục trặc.
    if (CUSTODY_LIKE.test(username)) {
      return { custodyCode: username.toUpperCase(), investorId: null, name: null, email: null, subNames, chanDoan, thieuHoSo: vuong };
    }
    const e = new DnseLoginError('Không đọc được hồ sơ tài khoản DNSE. Thử đăng nhập bằng số lưu ký.', 502, 'no_profile');
    e.detail = vuong;
    throw e;
  }
  return {
    custodyCode: String(me.data.custodyCode).toUpperCase(),
    investorId: me.data.investorId != null ? String(me.data.investorId) : null,
    name: me.data.name || null,
    email: me.data.email ? String(me.data.email).toLowerCase() : null,
    subNames,
    chanDoan,
  };
}

/** Tên đăng nhập trên Lật Bài suy ra từ số lưu ký, hợp lệ theo ràng buộc của bảng users. */
export const usernameFromCustody = (custody) => ('d' + String(custody).toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 24);
