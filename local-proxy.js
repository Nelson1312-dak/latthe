/**
 * local-proxy.js — một cổng duy nhất (11435) cho tunnel ngrok.
 *   /postgrest/*  -> 127.0.0.1:3002  (PostgREST của schema `trade`; bắt buộc có JWT)
 *   còn lại       -> 127.0.0.1:11434 (Ollama; bắt buộc header x-proxy-key, chỉ cho vài đường dẫn)
 *
 * Tunnel này nằm trên internet công khai, nên proxy KHÔNG được tin ai cả:
 *   - PostgREST tự kiểm JWT (role ẩn danh không có quyền gì), proxy chỉ chặn sớm request không có Authorization.
 *   - Ollama không có xác thực riêng, nên proxy giữ khóa PROXY_KEY (đọc từ .env.local hoặc biến môi trường).
 *
 * Chạy: node local-proxy.js   (watchdog-proxy.ps1 tự khởi động lại nếu chết)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const PORT = 11435;
const HOST = '127.0.0.1';
const POSTGREST_PORT = 3002;
const OLLAMA_PORT = 11434;
const OLLAMA_ALLOW = [/^\/api\/(chat|generate|embeddings|embed)$/, /^\/v1\/(chat\/completions|embeddings)$/];

function loadProxyKey() {
  if (process.env.PROXY_KEY) return process.env.PROXY_KEY.trim();
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const m = fs.readFileSync(path.join(dir, '.env.local'), 'utf8').match(/^PROXY_KEY=(.+)$/m);
    return m ? m[1].trim().replace(/^"|"$/g, '') : '';
  } catch { return ''; }
}
const PROXY_KEY = loadProxyKey();
if (!PROXY_KEY) console.warn('[proxy] CẢNH BÁO: chưa có PROXY_KEY, mọi request tới Ollama sẽ bị từ chối.');

function keyOk(given) {
  if (!PROXY_KEY || !given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(PROXY_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function deny(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: msg }));
}

function forward(req, res, port, urlPath) {
  const headers = { ...req.headers, host: `${HOST}:${port}` };
  delete headers['x-proxy-key'];
  const proxy = http.request({ hostname: HOST, port, path: urlPath, method: req.method, headers }, (upstream) => {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });
  proxy.on('error', () => deny(res, 502, 'Upstream unavailable'));
  req.pipe(proxy);
}

http.createServer((req, res) => {
  const url = req.url || '/';

  if (url === '/postgrest' || url.startsWith('/postgrest/') || url.startsWith('/postgrest?')) {
    if (!req.headers.authorization) return deny(res, 401, 'Missing token');
    // Bỏ tiền tố /postgrest và /rest/v1 (tương thích kiểu Supabase) để ra đường dẫn PostgREST thuần
    let p = url.slice('/postgrest'.length) || '/';
    p = p.replace(/^\/rest\/v1/, '') || '/';
    return forward(req, res, POSTGREST_PORT, p);
  }

  const pathname = url.split('?')[0];
  if (!OLLAMA_ALLOW.some((re) => re.test(pathname))) return deny(res, 404, 'Not found');
  if (!keyOk(req.headers['x-proxy-key'])) return deny(res, 403, 'Forbidden');
  return forward(req, res, OLLAMA_PORT, url);
}).listen(PORT, HOST, () => {
  console.log(`[proxy] Listening on ${HOST}:${PORT}`);
  console.log(`  /postgrest/* -> ${HOST}:${POSTGREST_PORT} (PostgREST, cần JWT)`);
  console.log(`  Ollama (allowlist) -> ${HOST}:${OLLAMA_PORT} (cần x-proxy-key)`);
});
