/**
 * local-proxy.js — một cổng duy nhất (11435) cho tunnel ngrok.
 *   /postgrest/*  -> 127.0.0.1:3002  (PostgREST của schema `trade`; bắt buộc có JWT)
 *   /feed/*       -> services.entrade.com.vn (nến giá; bắt buộc header x-feed-key)
 *   còn lại       -> 127.0.0.1:11434 (Ollama; bắt buộc header x-proxy-key, chỉ cho vài đường dẫn)
 *
 * Tunnel này nằm trên internet công khai, nên proxy KHÔNG được tin ai cả:
 *   - PostgREST tự kiểm JWT (role ẩn danh không có quyền gì), proxy chỉ chặn sớm request không có Authorization.
 *   - Ollama không có xác thực riêng, nên proxy giữ khóa PROXY_KEY (đọc từ .env.local hoặc biến môi trường).
 *   - /feed dùng khóa RIÊNG (FEED_KEY): lộ khóa này cũng không chạm được vào Ollama hay DB.
 *
 * Vì sao có /feed: Entrade chỉ phục vụ nến giá cho IP trong nước. Ngày 19/10/2026 Vercel (sin1) gọi
 * services.entrade.com.vn bị treo tới hết giờ chờ, làm /api/market và /api/history trả 502 — trong khi
 * cùng lúc máy ở nhà gọi 32 mã xong trong 237ms. Máy này có IP Việt Nam nên đi đường này là ra.
 * Proxy KHÔNG chuyển tiếp nguyên văn URL: chỉ dựng lại đúng một dạng request từ các tham số đã lọc,
 * để không biến tunnel thành proxy mở cho người khác xài.
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

const FEED_ORIGIN = 'https://services.entrade.com.vn/chart-api/v2/ohlcs';
const FEED_KINDS = new Set(['stock', 'index', 'derivative']);
const FEED_RES = new Set(['1', '3', '5', '15', '30', '60', '1D', '1W']);
const FEED_TIMEOUT_MS = 10_000;

const DNSE_ORIGIN = 'https://openapi.dnse.com.vn';
const DNSE_PATHS = [/^\/accounts(\/|$)/, /^\/brokers\//, /^\/price\//, /^\/registration\//];
const DNSE_METHODS = new Set(['GET', 'POST', 'DELETE']);
// Chữ ký HMAC nằm ở các header này, phải chuyển nguyên văn; mọi header khác bị bỏ.
const DNSE_HEADERS = ['x-api-key', 'date', 'x-signature', 'trading-token', 'content-type', 'accept'];
const DNSE_TIMEOUT_MS = 15_000;

function loadKey(name) {
  if (process.env[name]) return process.env[name].trim();
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const m = fs.readFileSync(path.join(dir, '.env.local'), 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'));
    return m ? m[1].trim().replace(/^"|"$/g, '') : '';
  } catch { return ''; }
}
const PROXY_KEY = loadKey('PROXY_KEY');
const FEED_KEY = loadKey('FEED_KEY');
const RELAY_KEY = loadKey('RELAY_KEY');
if (!PROXY_KEY) console.warn('[proxy] CẢNH BÁO: chưa có PROXY_KEY, mọi request tới Ollama sẽ bị từ chối.');
if (!FEED_KEY) console.warn('[proxy] CẢNH BÁO: chưa có FEED_KEY, mọi request tới /feed sẽ bị từ chối.');
if (!RELAY_KEY) console.warn('[proxy] CẢNH BÁO: chưa có RELAY_KEY, mọi request tới /dnse sẽ bị từ chối.');

function same(given, want) {
  if (!want || !given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const keyOk = (given) => same(given, PROXY_KEY);

function deny(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: msg }));
}

/**
 * Nến giá Entrade. Không chuyển tiếp URL do bên gọi đưa: đọc từng tham số, kiểm khuôn, rồi tự dựng
 * lại request. Bên gọi vì vậy không chỉ được proxy đi đâu khác, và cũng không chèn được tham số lạ.
 */
async function feed(req, res, url) {
  if (req.method !== 'GET') return deny(res, 405, 'Method not allowed');
  if (!same(req.headers['x-feed-key'], FEED_KEY)) return deny(res, 403, 'Forbidden');

  const u = new URL(url, 'http://x');
  const kind = u.pathname.slice('/feed/'.length);
  if (!FEED_KINDS.has(kind)) return deny(res, 404, 'Not found');
  const symbol = String(u.searchParams.get('symbol') || '').toUpperCase();
  const from = String(u.searchParams.get('from') || '');
  const to = String(u.searchParams.get('to') || '');
  const resolution = String(u.searchParams.get('resolution') || '1D');
  if (!/^[A-Z0-9]{3,12}$/.test(symbol)) return deny(res, 400, 'Bad symbol');
  if (!/^\d{1,11}$/.test(from) || !/^\d{1,11}$/.test(to)) return deny(res, 400, 'Bad range');
  if (!FEED_RES.has(resolution)) return deny(res, 400, 'Bad resolution');

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FEED_TIMEOUT_MS);
  try {
    const r = await fetch(`${FEED_ORIGIN}/${kind}?from=${from}&to=${to}&symbol=${symbol}&resolution=${resolution}`,
      { signal: ctl.signal, headers: { Accept: 'application/json' } });
    const body = await r.text();
    res.writeHead(r.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    deny(res, 502, 'Feed unavailable');
  } finally { clearTimeout(timer); }
}

/**
 * DNSE Open API — đường sống của bàn môi giới.
 *
 * Đo thật 19/10/2026 từ Vercel vùng sin1, năm lần liên tiếp: `openapi.dnse.com.vn` TREO đủ 8 giây
 * rồi bỏ, trong khi `services.entrade.com.vn` trả lời trong 170ms. Máy này gọi được bình thường.
 * Nghĩa là nếu không đi vòng qua đây thì care-by, số dư, danh mục, sổ lệnh và đặt lệnh đều chết
 * trên production — tức cả bàn môi giới.
 *
 * Khác `/feed`, đây không phải một dạng request cố định mà là cả một REST API, nên không dựng lại
 * được từ tham số đã lọc. Thay vào đó siết ba lớp:
 *   - đích đến ĐÓNG CỨNG là openapi.dnse.com.vn, không bao giờ đi đâu khác;
 *   - chỉ các nhánh đường dẫn và phương thức mà Lật Bài thật sự dùng;
 *   - chỉ chuyển tiếp đúng các header của chữ ký, bỏ mọi header khác.
 * Thêm nữa, DNSE vẫn tự kiểm HMAC: không có API secret thì có khoá relay cũng không ký nổi
 * một request mới. Khoá relay dùng riêng, không chung với FEED_KEY hay PROXY_KEY.
 */
async function dnseRelay(req, res, url) {
  if (!same(req.headers['x-relay-key'], RELAY_KEY)) return deny(res, 403, 'Forbidden');
  if (!DNSE_METHODS.has(req.method)) return deny(res, 405, 'Method not allowed');

  const cat = url.indexOf('?');
  const duongDan = (cat === -1 ? url : url.slice(0, cat)).slice('/dnse'.length) || '/';
  const truyVan = cat === -1 ? '' : url.slice(cat);
  if (!DNSE_PATHS.some((re) => re.test(duongDan))) return deny(res, 404, 'Not found');

  const headers = {};
  for (const h of DNSE_HEADERS) if (req.headers[h] != null) headers[h] = req.headers[h];

  const than = [];
  for await (const c of req) than.push(c);
  const body = than.length ? Buffer.concat(than) : undefined;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), DNSE_TIMEOUT_MS);
  try {
    const r = await fetch(DNSE_ORIGIN + duongDan + truyVan, { method: req.method, headers, body, signal: ctl.signal });
    const text = await r.text();
    res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
    res.end(text);
  } catch (e) {
    deny(res, 502, e?.name === 'AbortError' ? 'DNSE khong tra loi trong 15s' : 'DNSE unavailable');
  } finally { clearTimeout(timer); }
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
  if (pathname.startsWith('/feed/')) return feed(req, res, url);
  if (pathname === '/dnse' || pathname.startsWith('/dnse/')) return dnseRelay(req, res, url);

  if (!OLLAMA_ALLOW.some((re) => re.test(pathname))) return deny(res, 404, 'Not found');
  if (!keyOk(req.headers['x-proxy-key'])) return deny(res, 403, 'Forbidden');
  return forward(req, res, OLLAMA_PORT, url);
}).listen(PORT, HOST, () => {
  console.log(`[proxy] Listening on ${HOST}:${PORT}`);
  console.log(`  /postgrest/* -> ${HOST}:${POSTGREST_PORT} (PostgREST, cần JWT)`);
  console.log(`  /feed/*      -> ${FEED_ORIGIN} (nến giá, cần x-feed-key)`);
  console.log(`  Ollama (allowlist) -> ${HOST}:${OLLAMA_PORT} (cần x-proxy-key)`);
});
