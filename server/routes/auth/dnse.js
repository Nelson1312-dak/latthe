/**
 * POST /api/auth/dnse { username, password } — đăng nhập vào Lật Bài bằng tài khoản DNSE (dành cho môi giới được cấp quyền).
 *
 * Mật khẩu chỉ được chuyển thẳng tới DNSE để xác minh, không lưu, không ghi log. Chỉ SỐ LƯU KÝ được lưu để nhận ra người dùng.
 * Chỉ các số lưu ký trong DNSE_LOGIN_CUSTODY mới vào được; người khác nhận 403 sau khi DNSE xác minh, hoặc bị chặn ngay
 * (không gửi mật khẩu đi đâu) nếu họ nhập thẳng một số lưu ký không nằm trong danh sách.
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import { startSession } from '../../../api/_auth.js';
import { checkRateLimit, getClientIp } from '../../../api/_rateLimit.js';
import { verifyDnseAccount, allowedCustody, dnseLoginEnabled, usernameFromCustody, CUSTODY_LIKE } from '../../../api/_dnselogin.js';

const COLS = 'id,username,display_name,role,avatar_url,email';

/** Tên tiểu khoản vừa đọc được lúc đăng nhập. Chỉ là nhãn hiển thị nên hỏng thì bỏ qua. */
async function luuTenTieuKhoan(uid, subNames) {
  if (!uid || !subNames) return;
  try {
    await rest(`/users?id=eq.${uid}`, { role: 'app_auth', method: 'PATCH', body: { dnse_sub_names: subNames } });
  } catch (e) { console.error('[dnse-sub-names]', e?.message); }
}

async function findOrCreate(p) {
  const found = await rest(`/users?dnse_custody=eq.${encodeURIComponent(p.custodyCode)}&select=${COLS}&limit=1`, { role: 'app_auth' });
  if (found[0]) { await luuTenTieuKhoan(found[0].id, p.subNames); return found[0]; }
  const base = usernameFromCustody(p.custodyCode);
  const display = (p.name || base).slice(0, 40);
  // Email hoặc tên đăng nhập có thể đã dùng bởi tài khoản khác: thử lại bỏ email, rồi thêm hậu tố
  const attempts = [
    { username: base, email: p.email }, { username: base },
    { username: base.slice(0, 19) + '_' + Math.floor(Math.random() * 9000 + 1000) },
  ];
  for (const a of attempts) {
    try {
      const rows = await rest(`/users?select=${COLS}`, {
        role: 'app_auth', method: 'POST', prefer: 'return=representation',
        body: { ...a, display_name: display, dnse_custody: p.custodyCode },
      });
      await luuTenTieuKhoan(rows[0]?.id, p.subNames);
      return rows[0];
    } catch (e) { if (e.pgCode !== '23505') throw e; }
  }
  throw Object.assign(new Error('Không tạo được tài khoản, thử lại.'), { status: 409, expose: true });
}

export default route('POST, OPTIONS', async ({ req, res, body }) => {
  if (!dnseLoginEnabled()) {
    return res.status(503).json({ error: 'Đăng nhập bằng DNSE chưa được bật trên máy chủ.', code: 'disabled' });
  }
  const rl = await checkRateLimit(getClientIp(req), 'dnse-login');
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter || 60));
    return res.status(429).json({ error: 'Thử đăng nhập quá nhiều lần, đợi một chút rồi thử lại.' });
  }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (username.length < 3 || username.length > 100 || !password || password.length > 200) {
    return res.status(400).json({ error: 'Nhập số lưu ký (hoặc email, số điện thoại) và mật khẩu DNSE.' });
  }
  const allowed = allowedCustody();
  const notGranted = { error: 'Tài khoản DNSE này chưa được cấp quyền đăng nhập vào Lật Bài.', code: 'not_granted' };
  // Nhập thẳng số lưu ký mà không nằm trong danh sách: dừng ngay, mật khẩu không được gửi đi đâu cả
  if (CUSTODY_LIKE.test(username) && !allowed.includes(username.toUpperCase())) return res.status(403).json(notGranted);

  let profile;
  try {
    profile = await verifyDnseAccount(username, password);
  } catch (e) {
    // detail chỉ nói BƯỚC nào hỏng và vì sao (không chứa thông tin đăng nhập), giúp dò lỗi trên máy chủ thật
    if (e?.detail) {
      console.error('[auth/dnse]', e.detail);
      return res.status(e.status || 502).json({ error: e.message, code: e.code, detail: e.detail });
    }
    throw e;
  }
  // Vào được nhưng thiếu hồ sơ: vẫn ghi lại để biết endpoint nào của DNSE đang trục trặc
  if (profile.thieuHoSo) console.error('[auth/dnse] vao duoc bang so luu ky, khong doc duoc ho so:', profile.thieuHoSo);
  if (!allowed.includes(profile.custodyCode)) return res.status(403).json(notGranted);

  const user = await findOrCreate(profile);
  startSession(res, user.id);
  return { user };
});
