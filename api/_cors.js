/**
 * api/_cors.js — Shared CORS handling for serverless functions.
 * Underscore prefix => Vercel does NOT expose this as a route; import only.
 */

export const ALLOWED_ORIGINS = new Set([
  'https://latbai.vn',
  'https://www.latbai.vn',
  'https://gieoque.vn',
  'https://www.gieoque.vn',
  'http://localhost:5005',
  'http://localhost:3000',
]);

/**
 * Applies the CORS whitelist + preflight/method guards.
 * Sets the appropriate headers and, when the request must be short-circuited
 * (disallowed origin, OPTIONS preflight, or wrong method), sends the response
 * and returns false. Returns true when the caller should continue handling.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {{ methods?: string }} [opts] - allowed methods (default 'POST, OPTIONS')
 * @returns {boolean} true to continue, false if a response was already sent
 */
export function applyCors(req, res, { methods = 'POST, OPTIONS' } = {}) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (origin) {
    res.status(403).json({ error: 'Truy cập bị từ chối: nguồn gọi không hợp lệ.' });
    return false;
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return false; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return false; }
  return true;
}
