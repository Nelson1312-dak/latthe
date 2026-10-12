/**
 * deploy/check-tunnel.mjs — kiểm tra một địa chỉ tunnel (ngrok hoặc Cloudflare) trỏ tới PostgREST có đúng và an toàn không.
 *   node --env-file=.env.local deploy/check-tunnel.mjs https://db.example.com/postgrest
 *   node --env-file=.env.local deploy/check-tunnel.mjs https://stiffness-glade-coliseum.ngrok-free.dev/postgrest
 * Chỉ dùng DB_JWT_SECRET trong .env.local để ký token thử, không in bí mật. Không ghi gì vào DB.
 */
import { signJwt } from '../api/_db.js';

const url = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https:\/\//.test(url)) { console.error('Dùng: node --env-file=.env.local deploy/check-tunnel.mjs https://<host>/postgrest'); process.exit(2); }
const origin = new URL(url).origin;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <- ' + extra}`); };
const get = async (u, headers = {}, init = {}) => {
  const t0 = performance.now();
  try {
    const r = await fetch(u, { headers: { 'ngrok-skip-browser-warning': '1', ...headers }, redirect: 'manual', ...init });
    const text = await r.text();
    return { s: r.status, text: text.slice(0, 100), ms: performance.now() - t0, server: r.headers.get('server') || '' };
  } catch (e) { return { s: 0, text: String(e.cause?.code || e.message), ms: performance.now() - t0 }; }
};

const good = signJwt({ role: 'app_rw', sub: '00000000-0000-4000-8000-000000000001' }, 120);
const forged = signJwt({ role: 'app_rw', sub: '00000000-0000-4000-8000-000000000001' }, 120).replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));

let r = await get(`${url}/threads?select=id&limit=1`);
ok('đến được tunnel (HTTPS, có phản hồi)', r.s !== 0, r.text);
ok('không có token => bị chặn (401)', r.s === 401, `${r.s} ${r.text}`);
r = await get(`${url}/threads?select=id&limit=1`, { Authorization: `Bearer ${forged}` });
ok('token giả => bị từ chối (401)', r.s === 401, `${r.s} ${r.text}`);
r = await get(`${url}/threads?select=id&limit=1`, { Authorization: `Bearer ${good}` });
ok('token hợp lệ => đọc được dữ liệu (200)', r.s === 200, `${r.s} ${r.text}`);
r = await get(`${url}/documents?select=id&limit=1`, { Authorization: `Bearer ${good}` });
ok('bảng cũ (documents) không lộ ra API (404)', r.s === 404, `${r.s} ${r.text}`);
r = await get(`${origin}/api/chat`, {}, { method: 'POST', body: '{}' });
ok('Ollama không có khóa => bị chặn (403/404)', r.s === 403 || r.s === 404, `${r.s} ${r.text}`);
r = await get(`${origin}/api/delete`, {}, { method: 'DELETE', body: '{}' });
ok('đường dẫn Ollama nguy hiểm (xóa model) không lộ ra (404)', r.s === 404, `${r.s} ${r.text}`);

// Độ trễ: 8 lần gọi liên tiếp với token hợp lệ
const times = [];
for (let i = 0; i < 8; i++) times.push((await get(`${url}/threads?select=id&limit=1`, { Authorization: `Bearer ${good}` })).ms);
times.sort((a, b) => a - b);
const med = times[Math.floor(times.length / 2)];
console.log(`\nĐộ trễ tới DB (8 lần): trung vị ${med.toFixed(0)} ms, nhanh nhất ${times[0].toFixed(0)} ms, chậm nhất ${times[times.length - 1].toFixed(0)} ms`);
ok('độ trễ trung vị dưới 1,5 giây', med < 1500, `${med.toFixed(0)} ms`);
console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
