/**
 * POST /api/shs/connect — kết nối tài khoản SHS (chỉ chủ hệ thống).
 *   { username, password }                     đăng nhập, lưu phiên (token mã hóa)
 *   { step: 'otp' }                            xin chỉ số ô trên thẻ ma trận OTP
 *   { step: 'verify', otp, otpIndex, transactionId }  xác thực OTP, nâng cấp phiên
 *
 * Mật khẩu SHS chỉ chuyển thẳng tới SHS, không ghi log, không lưu.
 */
import crypto from 'node:crypto';
import { route } from '../../../api/_http.js';
import { assertOwner, saveLink, readLink, BrokerError } from '../../../api/_broker.js';
import * as shs from '../../../api/_shs.js';
import { checkRateLimit, getClientIp } from '../../../api/_rateLimit.js';

/** deviceId cố định theo người dùng, để SHS không coi mỗi lần đăng nhập là một thiết bị mới. */
const deviceIdFor = (uid) =>
  crypto.createHash('sha256').update('shs-device:' + uid + ':' + (process.env.SESSION_SECRET || '')).digest('hex').slice(0, 32);

export default route('POST, OPTIONS', async ({ req, res, uid, body }) => {
  await assertOwner(uid);
  const rl = await checkRateLimit(getClientIp(req), 'shs-connect');
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter || 60));
    return res.status(429).json({ error: 'Thao tác quá nhanh, thử lại sau ít phút.' });
  }

  if (body.step === 'otp') {
    const link = await readLink(uid, 'shs');
    if (!link?.token) throw new BrokerError('Hãy đăng nhập SHS trước.', 401, 'no_link');
    const r = await shs.genMatrixOtp(link.token);
    return { otpIndex: r?.otpIndex, transactionId: r?.transactionId, note: 'Nhập mã ở ô tương ứng trên thẻ ma trận OTP của bạn.' };
  }

  if (body.step === 'verify') {
    const link = await readLink(uid, 'shs');
    if (!link?.token) throw new BrokerError('Hãy đăng nhập SHS trước.', 401, 'no_link');
    const otp = String(body.otp || '').trim();
    if (!/^\d{4,8}$/.test(otp)) return res.status(400).json({ error: 'Mã OTP gồm 4 đến 8 chữ số.' });
    const t = await shs.verifyOtp(link.token, { otp, otpIndex: String(body.otpIndex || ''), transactionId: String(body.transactionId || '') });
    await saveLink(uid, 'shs', {
      accountNo: link.accountNo, display: link.display,
      token: t.accessToken, tokenExp: shs.tokenExpiry(t.accessToken), refresh: t.refreshToken || link.refresh,
    });
    return { verified: true, expiresAt: shs.tokenExpiry(t.accessToken).toISOString() };
  }

  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Nhập tài khoản và mật khẩu SHS.' });

  const t = await shs.login(username, password, deviceIdFor(uid));
  const { main } = shs.accountsFromToken(t.accessToken);
  let display = null, accountNo = main;
  try {
    const info = await shs.customerInfo(t.accessToken, main || undefined);
    display = info?.customerName || null;
    accountNo = info?.accountNumber || main;
  } catch { /* thiếu tên hiển thị không ảnh hưởng kết nối */ }

  await saveLink(uid, 'shs', {
    accountNo, display, token: t.accessToken, tokenExp: shs.tokenExpiry(t.accessToken), refresh: t.refreshToken,
  });
  return { connected: true, broker: 'shs', accountNo, display, expiresAt: shs.tokenExpiry(t.accessToken).toISOString() };
}, { auth: true });
