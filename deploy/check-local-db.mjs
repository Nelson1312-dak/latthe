/**
 * deploy/check-local-db.mjs — kiểm tra PostgREST cục bộ (127.0.0.1:3002) đúng và an toàn.
 *   node --env-file=.env.local deploy/check-local-db.mjs [http://127.0.0.1:3002]
 * Chỉ dùng DB_JWT_SECRET trong .env.local để ký token thử; không in bí mật, không ghi gì vào DB.
 */
import { signJwt } from '../api/_db.js';

const base = (process.argv[2] || 'http://127.0.0.1:3002').replace(/\/+$/, '');
const sub = '00000000-0000-4000-8000-000000000001';
const good = signJwt({ role: 'app_rw', sub }, 60);
const forged = good.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
const get = async (p, t) => {
  try { return (await fetch(base + p, { headers: t ? { Authorization: 'Bearer ' + t } : {} })).status; }
  catch (e) { return 'unreachable: ' + (e.cause?.code || e.message); }
};

const checks = [
  ['không có token -> 401', await get('/threads?limit=1'), 401],
  ['token giả -> 401', await get('/threads?limit=1', forged), 401],
  ['token hợp lệ -> 200', await get('/threads?limit=1', good), 200],
  ['bảng cũ (documents) không lộ ra API -> 404', await get('/documents?limit=1', good), 404],
];
let bad = 0;
for (const [name, got, want] of checks) {
  const ok = got === want;
  if (!ok) bad++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : `   <- nhận ${got}`));
}
console.log(`\n${checks.length - bad} đạt, ${bad} lỗi`);
process.exit(bad ? 1 : 0);
