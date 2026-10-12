/** GET /api/auth/google — chuyển hướng sang màn hình chọn tài khoản của Google. */
import { authUrl, makeState, googleEnabled } from '../../../api/_google.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  if (!googleEnabled()) return res.status(503).json({ error: 'Đăng nhập Google chưa được cấu hình trên máy chủ.' });
  const next = new URL(req.url, 'http://x').searchParams.get('next') || '/';
  const state = makeState(res, next);
  res.statusCode = 302;
  res.setHeader('Location', authUrl(req, state));
  return res.end();
}
