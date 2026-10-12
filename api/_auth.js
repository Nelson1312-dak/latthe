/**
 * api/_auth.js — băm mật khẩu (scrypt) và phiên đăng nhập (cookie HttpOnly ký HMAC).
 * Underscore prefix => Vercel không expose thành route.
 * Biến môi trường: SESSION_SECRET.
 */
import crypto from 'node:crypto';

const COOKIE = 'lb_session';
const SESSION_DAYS = 30;
const IS_PROD = process.env.NODE_ENV === 'production';
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

const scrypt = (pw, salt, o) => new Promise((resolve, reject) =>
  crypto.scrypt(pw, salt, o.keylen, { N: o.N, r: o.r, p: o.p }, (e, k) => (e ? reject(e) : resolve(k))));

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

// Hash giả để so sánh khi không có user, tránh lộ "tên này có tồn tại không" qua thời gian phản hồi.
const DUMMY = `scrypt$${SCRYPT.N}$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(32).toString('base64url')}`;

export async function verifyPassword(pw, stored) {
  const parts = String(stored || DUMMY).split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const N = parseInt(parts[1], 10);
  const salt = Buffer.from(parts[2], 'base64url');
  const want = Buffer.from(parts[3], 'base64url');
  const got = await scrypt(pw, salt, { N, r: SCRYPT.r, p: SCRYPT.p, keylen: want.length });
  return want.length === got.length && crypto.timingSafeEqual(want, got) && !!stored;
}

function sign(data) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET chưa được cấu hình');
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

/** Thêm cookie mà không ghi đè cookie khác đã đặt trước đó trong cùng response. */
export function addCookie(res, value) {
  const prev = res.getHeader('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? [...prev] : [prev]) : [];
  list.push(value);
  res.setHeader('Set-Cookie', list);
}

export function startSession(res, uid) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const data = `${uid}.${exp}`;
  const token = `${data}.${sign(data)}`;
  addCookie(res, `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${IS_PROD ? '; Secure' : ''}`);
}

export function endSession(res) {
  addCookie(res, `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${IS_PROD ? '; Secure' : ''}`);
}

/** @returns {string|null} user id nếu cookie hợp lệ và chưa hết hạn */
export function readSession(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [uid, exp, sig] = m[1].split('.');
  if (!uid || !exp || !sig) return null;
  const want = sign(`${uid}.${exp}`);
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return /^[0-9a-f-]{36}$/.test(uid) ? uid : null;
}

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
export function validCredentials({ username, password }) {
  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim().toLowerCase())) {
    return 'Tên đăng nhập gồm 3 đến 24 ký tự: chữ thường, số, gạch dưới.';
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return 'Mật khẩu cần từ 8 đến 72 ký tự.';
  }
  return null;
}

/** Băm một mã dùng một lần (lời mời...) trước khi lưu: DB không giữ mã gốc. */
export const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
