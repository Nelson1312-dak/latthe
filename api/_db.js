/**
 * api/_db.js — gọi PostgREST (Postgres local qua tunnel) bằng JWT ngắn hạn do server ký.
 * Underscore prefix => Vercel không expose thành route.
 *
 * Biến môi trường: SUPABASE_URL (vd https://<ngrok>/postgrest), DB_JWT_SECRET (trùng PGRST_JWT_SECRET).
 * Role: 'app_auth' (đăng ký/đăng nhập) hoặc 'app_rw' (nghiệp vụ, kèm sub = user id để RLS ép quyền).
 */
import crypto from 'node:crypto';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function signJwt(claims, ttlSec = 60) {
  const secret = process.env.DB_JWT_SECRET;
  if (!secret) throw new DbError('DB_JWT_SECRET chưa được cấu hình', 500, 'config');
  const body = { ...claims, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSec };
  const data = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(body)}`;
  return `${data}.${crypto.createHmac('sha256', secret).update(data).digest('base64url')}`;
}

export class DbError extends Error {
  constructor(message, status = 500, code = 'db') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * @param {string} path  ví dụ '/orders?status=eq.wait' hoặc '/rpc/place_order'
 * @param {{ role?: 'app_auth'|'app_rw', sub?: string, method?: string, body?: object, prefer?: string }} [opts]
 * @returns {Promise<any>} JSON đã parse (null nếu không có body)
 */
export async function rest(path, { role = 'app_rw', sub, method = 'GET', body, prefer } = {}) {
  const base = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  if (!base) throw new DbError('SUPABASE_URL chưa được cấu hình', 500, 'config');
  const token = signJwt(sub ? { role, sub } : { role });
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'ngrok-skip-browser-warning': '1',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  let res;
  try {
    res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
  } catch (e) {
    throw new DbError('Không kết nối được cơ sở dữ liệu', 503, 'unreachable');
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = null; } }
  if (!res.ok) {
    // PostgREST trả { code, message }. Lỗi nghiệp vụ do hàm SQL ném (RAISE EXCEPTION 'insufficient_cash') nằm ở message.
    const e = new DbError(data?.message || `DB HTTP ${res.status}`, res.status, data?.code || 'db');
    e.pgCode = data?.code;
    throw e;
  }
  return data;
}
