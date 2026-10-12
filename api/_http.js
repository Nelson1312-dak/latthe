/**
 * api/_http.js — khung xử lý chung: CORS/CSRF, parse JSON, bắt lỗi thành JSON tiếng Việt.
 * Underscore prefix => Vercel không expose thành route.
 */
import { applyCors } from './_cors.js';
import { readSession } from './_auth.js';
import { DbError } from './_db.js';

export function bodyOf(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') { try { return JSON.parse(b); } catch { return {}; } }
  return {};
}

/**
 * @param {string} methods  vd 'GET, POST, OPTIONS'
 * @param {(ctx: { req, res, uid: string|null, body: object }) => Promise<any>} fn  trả object => 200 JSON
 * @param {{ auth?: boolean }} [opts] auth=true: bắt buộc đã đăng nhập
 */
export function route(methods, fn, { auth = false } = {}) {
  return async function handler(req, res) {
    if (!applyCors(req, res, { methods })) return;
    res.setHeader('Cache-Control', 'no-store');
    try {
      const uid = readSession(req);
      if (auth && !uid) return res.status(401).json({ error: 'Bạn cần đăng nhập.' });
      const out = await fn({ req, res, uid, body: bodyOf(req) });
      if (!res.writableEnded) res.status(200).json(out ?? { ok: true });
    } catch (e) {
      if (e?.status && (e.status < 500 || e.expose)) return res.status(e.status).json({ error: e.message, code: e.code });
      console.error('[api]', req.url, e?.code || '', e?.message);
      const down = e instanceof DbError && (e.code === 'unreachable' || e.code === 'config');
      return res.status(down ? 503 : 500).json({ error: down ? 'Hệ thống dữ liệu đang tạm gián đoạn, thử lại sau ít phút.' : 'Lỗi hệ thống, thử lại sau.' });
    }
  };
}
