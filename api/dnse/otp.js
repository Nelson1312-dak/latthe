/**
 * POST /api/dnse/otp
 *   { action: 'send' }                                   gửi OTP về email đăng ký DNSE
 *   { action: 'verify', otp, type?: 'email'|'smart' }    đổi OTP lấy trading token (8 giờ), giữ trong cookie mã hóa
 *   { action: 'end' }                                    kết thúc phiên giao dịch (xóa trading token)
 */
import { route } from '../_http.js';
import * as dnse from '../_dnse.js';
import { checkRateLimit, getClientIp } from '../_rateLimit.js';

export default route('POST, OPTIONS', async ({ req, res, uid, body }) => {
  await dnse.assertOwner(uid);
  const rl = await checkRateLimit(getClientIp(req), 'dnse-otp');
  if (!rl.allowed) return res.status(429).json({ error: 'Thao tác OTP quá nhanh, đợi một chút rồi thử lại.' });

  if (body.action === 'send') {
    await dnse.sendEmailOtp();
    return { sent: true, note: 'OTP đã gửi về email đăng ký với DNSE, có hiệu lực trong thời gian ngắn và chỉ dùng một lần.' };
  }
  if (body.action === 'verify') {
    const otp = String(body.otp || '').trim();
    if (!/^\d{4,8}$/.test(otp)) return res.status(400).json({ error: 'Mã OTP gồm 4 đến 8 chữ số.' });
    const token = await dnse.verifyOtp(otp, body.type === 'smart' ? 'smart_otp' : 'email_otp');
    const expiresAt = dnse.setTradingCookie(res, uid, token);
    return { active: true, expiresAt };
  }
  if (body.action === 'end') {
    dnse.clearTradingCookie(res);
    return { active: false };
  }
  return res.status(400).json({ error: 'Thao tác không hợp lệ.' });
}, { auth: true });
