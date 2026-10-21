/**
 * POST /api/dnse/sub-names { password } — lấy TÊN các tiểu khoản DNSE mà không phải đăng xuất.
 *
 * Vì sao cần route riêng: tên tiểu khoản (`accountTypeName`) chỉ đọc được bằng token đăng nhập
 * mật khẩu DNSE, mà token đó chỉ xuất hiện trong đúng khoảnh khắc đăng nhập. Trước route này,
 * cách duy nhất để lấy tên là ĐĂNG XUẤT rồi đăng nhập lại bằng DNSE — vừa phiền vừa dễ nhầm với
 * nút "Ngắt kết nối" trong hộp Tài khoản chứng khoán, mà bấm nhầm nút đó là mất luôn phiên SHS
 * đã quẹt thẻ ma trận.
 *
 * Mật khẩu chỉ đi thẳng tới DNSE qua verifyDnseAccount, không ghi log và không lưu. Token DNSE
 * vẫn bị bỏ ngay như mọi khi — chỉ TÊN được lưu lại.
 *
 * Chặn quan trọng: số lưu ký mà DNSE xác nhận phải TRÙNG với số lưu ký của chính người đang đăng
 * nhập. Không có chặn này thì route thành chỗ dò mật khẩu tài khoản DNSE của người khác.
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import { verifyDnseAccount, dnseLoginEnabled } from '../../../api/_dnselogin.js';
import { checkRateLimit, getClientIp } from '../../../api/_rateLimit.js';

export default route('POST, OPTIONS', async ({ req, res, uid, body }) => {
  if (!dnseLoginEnabled()) {
    return res.status(503).json({ error: 'Đăng nhập bằng DNSE chưa được bật trên máy chủ.', code: 'disabled' });
  }
  const rl = await checkRateLimit(getClientIp(req), 'dnse-login');
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter || 60));
    return res.status(429).json({ error: 'Thử quá nhiều lần, đợi một chút rồi thử lại.' });
  }
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password || password.length > 200) return res.status(400).json({ error: 'Nhập mật khẩu DNSE.' });

  const rows = await rest(`/users?id=eq.${uid}&select=dnse_custody&limit=1`, { sub: uid });
  const custody = rows?.[0]?.dnse_custody;
  if (!custody) {
    return res.status(400).json({ error: 'Tài khoản này chưa đăng nhập bằng DNSE lần nào nên chưa có số lưu ký.', code: 'no_custody' });
  }

  const p = await verifyDnseAccount(custody, password);
  if (String(p.custodyCode).toUpperCase() !== String(custody).toUpperCase()) {
    return res.status(403).json({ error: 'Số lưu ký không khớp tài khoản đang đăng nhập.', code: 'mismatch' });
  }

  const giaTri = p.subNames || (p.chanDoan ? { _chanDoan: p.chanDoan, _luc: new Date().toISOString() } : null);
  if (giaTri) {
    await rest(`/users?id=eq.${uid}`, { sub: uid, method: 'PATCH', body: { dnse_sub_names: giaTri } }).catch(() => {});
  }
  return {
    ok: !!p.subNames,
    soTen: p.subNames ? Object.keys(p.subNames).length : 0,
    ten: p.subNames || null,
    chanDoan: p.subNames ? null : (p.chanDoan || 'khong goi duoc'),
  };
}, { auth: true });
