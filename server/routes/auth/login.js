/** POST /api/auth/login { username, password } */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import { startSession, verifyPassword, USERNAME_RE } from '../../../api/_auth.js';
import { checkRateLimit, getClientIp } from '../../../api/_rateLimit.js';

export default route('POST, OPTIONS', async ({ req, res, body }) => {
  const rl = await checkRateLimit(getClientIp(req), 'auth');
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter || 60));
    return res.status(429).json({ error: 'Thử đăng nhập quá nhiều lần, đợi một chút rồi thử lại.' });
  }
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const fail = () => res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu.' });
  if (!USERNAME_RE.test(username) || !password || password.length > 72) return fail();

  const rows = await rest(`/users?username=eq.${encodeURIComponent(username)}&select=id,username,password_hash,display_name,role&limit=1`, { role: 'app_auth' });
  const u = rows[0];
  const ok = await verifyPassword(password, u?.password_hash);
  if (!u || !ok) return fail();
  startSession(res, u.id);
  const { password_hash, ...user } = u;
  return { user };
});
