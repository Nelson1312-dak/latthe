/** POST /api/auth/register { username, password, display_name? } */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import { hashPassword, startSession, validCredentials } from '../../../api/_auth.js';
import { checkRateLimit, getClientIp } from '../../../api/_rateLimit.js';

export default route('POST, OPTIONS', async ({ req, res, body }) => {
  const rl = await checkRateLimit(getClientIp(req), 'auth');
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter || 60));
    return res.status(429).json({ error: 'Thao tác quá nhanh, thử lại sau ít phút.' });
  }
  const bad = validCredentials(body);
  if (bad) return res.status(400).json({ error: bad });
  const username = body.username.trim().toLowerCase();
  const display = String(body.display_name || username).trim().slice(0, 40) || username;

  let rows;
  try {
    rows = await rest('/users?select=id,username,display_name,role', {
      role: 'app_auth', method: 'POST', prefer: 'return=representation',
      body: { username, password_hash: await hashPassword(body.password), display_name: display },
    });
  } catch (e) {
    if (e.pgCode === '23505') return res.status(409).json({ error: 'Tên đăng nhập này đã có người dùng.' });
    throw e;
  }
  const user = rows[0];
  startSession(res, user.id);
  return res.status(201).json({ user });
});
