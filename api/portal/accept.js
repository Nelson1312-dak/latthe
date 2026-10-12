/** POST /api/portal/accept { token } — khách dùng mã mời để liên kết tài khoản của mình với môi giới. */
import { route } from '../_http.js';
import { rest } from '../_db.js';
import { hashToken } from '../_auth.js';
import { checkRateLimit, getClientIp } from '../_rateLimit.js';

export default route('POST, OPTIONS', async ({ req, res, uid, body }) => {
  const rl = await checkRateLimit(getClientIp(req), 'invite');
  if (!rl.allowed) return res.status(429).json({ error: 'Thử quá nhiều lần, đợi một chút rồi thử lại.' });
  const token = String(body.token || '').trim();
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return res.status(400).json({ error: 'Mã mời không hợp lệ.' });
  try {
    const link = await rest('/rpc/accept_invite', { sub: uid, method: 'POST', body: { p_hash: hashToken(token) } });
    return { linked: true, account: link.account_no, name: link.client_name };
  } catch (e) {
    if (/invite_invalid/.test(e.message)) return res.status(410).json({ error: 'Mã mời không đúng, đã dùng hoặc đã hết hạn. Hãy xin môi giới gửi lại.' });
    if (/invite_own/.test(e.message)) return res.status(400).json({ error: 'Bạn không thể nhận lời mời do chính mình tạo.' });
    throw e;
  }
}, { auth: true });
