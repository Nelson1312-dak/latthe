/**
 * api/_google.js — Đăng nhập bằng Google theo luồng Authorization Code (chạy ở server).
 * Underscore prefix => Vercel không expose thành route.
 *
 * Dùng luồng redirect ở server chứ không dùng thư viện JS của Google, vì CSP của site
 * chỉ cho phép script 'self'. Không cần nới CSP, và token Google không bao giờ lộ ra trình duyệt.
 *
 * Biến môi trường: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, (tùy chọn) PUBLIC_ORIGIN
 */
import crypto from 'node:crypto';

// URL có thể đổi qua biến môi trường để chạy test với máy chủ giả.
const AUTH_URL = process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const STATE_COOKIE = 'lb_oauth_state';
const IS_PROD = process.env.NODE_ENV === 'production';

export class GoogleError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; this.expose = true; }
}

export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/** Gốc site, suy từ request để chạy đúng cả ở local lẫn trên latbai.vn. */
export function originOf(req) {
  const env = (process.env.PUBLIC_ORIGIN || '').trim().replace(/\/+$/, '');
  if (env) return env;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5173';
  const proto = req.headers['x-forwarded-proto'] || (/^localhost|^127\./.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}
export const redirectUri = (req) => `${originOf(req)}/api/auth/google-callback`;

/**
 * state chống CSRF: gửi kèm Google và lưu trong cookie ngắn hạn, hai bên phải khớp.
 *
 * Path phải là `/api/auth/`, KHÔNG phải `/api/auth/google`. Cookie được đặt ở /api/auth/google
 * rồi đọc lại ở /api/auth/google-callback. Theo RFC 6265 mục 5.1.4, cookie có Path=/api/auth/google
 * chỉ được gửi khi đường dẫn request bằng đúng chuỗi đó, hoặc dài hơn nhưng phần dư bắt đầu bằng
 * "/". Ở đây phần dư là "-callback", nên trình duyệt KHÔNG gửi cookie và callback luôn báo "phiên
 * không hợp lệ" — đăng nhập Google hỏng 100%, không phải thỉnh thoảng. Google đang tắt nên chưa
 * ai vấp, nhưng bật lên là gặp ngay.
 */
export function makeState(res, next) {
  const state = crypto.randomBytes(16).toString('base64url');
  const payload = `${state}.${Buffer.from(next || '/').toString('base64url')}`;
  res.setHeader('Set-Cookie', `${STATE_COOKIE}=${payload}; HttpOnly; SameSite=Lax; Path=/api/auth/; Max-Age=600${IS_PROD ? '; Secure' : ''}`);
  return state;
}
export function checkState(req, res, got) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${STATE_COOKIE}=([^;]+)`));
  res.setHeader('Set-Cookie', `${STATE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/auth/; Max-Age=0${IS_PROD ? '; Secure' : ''}`);
  if (!m) return null;
  const [want, nextB64] = m[1].split('.');
  const a = Buffer.from(want || ''), b = Buffer.from(String(got || ''));
  if (!a.length || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const next = Buffer.from(nextB64 || '', 'base64url').toString('utf8');
  return { next: next.startsWith('/') && !next.startsWith('//') ? next : '/' };
}

export function authUrl(req, state) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `${AUTH_URL}?${q}`;
}

/** Đổi code lấy id_token rồi đọc hồ sơ. id_token đến thẳng từ Google qua HTTPS nên tin được nội dung. */
export async function exchangeCode(req, code) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(req),
        grant_type: 'authorization_code',
      }),
      signal: ctl.signal,
    });
  } catch {
    throw new GoogleError('Không kết nối được Google, thử lại sau.', 503);
  } finally { clearTimeout(timer); }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.id_token) throw new GoogleError(data?.error_description || 'Google từ chối yêu cầu đăng nhập.', 400);

  const parts = String(data.id_token).split('.');
  if (parts.length !== 3) throw new GoogleError('Google trả về dữ liệu không hợp lệ.', 502);
  const c = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (c.aud !== process.env.GOOGLE_CLIENT_ID) throw new GoogleError('Thông tin Google không khớp cấu hình.', 400);
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(c.iss)) throw new GoogleError('Nguồn phát hành không hợp lệ.', 400);
  if (Number(c.exp) * 1000 < Date.now()) throw new GoogleError('Phiên Google đã hết hạn, thử lại.', 400);
  if (!c.sub) throw new GoogleError('Google không trả về định danh người dùng.', 502);
  if (c.email && c.email_verified === false) throw new GoogleError('Email Google chưa được xác minh.', 400);

  return { sub: String(c.sub), email: c.email ? String(c.email).toLowerCase() : null, name: c.name || null, picture: c.picture || null };
}

/** Tên đăng nhập gợi ý từ email, hợp lệ theo ràng buộc của bảng users. */
export function suggestUsername(email, sub) {
  const base = String(email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  return base.length >= 3 ? base : `gg_${sub.slice(-8)}`;
}
