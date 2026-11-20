// Báo cho Bing (và các máy tìm kiếm dùng IndexNow) những trang mới hoặc vừa sửa trên
// latbai.vn, để được lập chỉ mục trong vài giờ thay vì chờ máy tìm kiếm tự ghé.
// Bing cũng là nguồn kết quả của DuckDuckGo, Yahoo, Ecosia. Google không dùng IndexNow:
// với Google vẫn là sitemap + "Yêu cầu lập chỉ mục" trong Search Console.
//
// Chạy: node scripts/indexnow.mjs [--all]   (npm run deploy tự gọi sau khi deploy xong)
// Chỉ gửi trang có lastmod mới hơn lần gửi trước (scripts/seo/indexnow-state.json);
// --all gửi lại toàn bộ sitemap. Chỉ gửi địa chỉ trang công khai, không gửi gì khác.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const HOST = 'latbai.vn';
const STATE = 'scripts/seo/indexnow-state.json';

// Khoá IndexNow: file public/<khoá>.txt chứa đúng khoá đó (máy tìm kiếm đọc để xác nhận chủ trang)
const keyFile = readdirSync('public').find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) {
  console.log('IndexNow: chưa có file khoá trong public/, bỏ qua.');
  process.exit(0);
}
const key = keyFile.slice(0, -4);

const sitemap = readFileSync('public/sitemap.xml', 'utf8');
const trang = [...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map(([, loc, lastmod]) => ({ loc, lastmod }));
const lầnTrước = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')).sentAt ?? '' : '';
const tấtCả = process.argv.includes('--all') || !lầnTrước;
const gửi = trang.filter((t) => tấtCả || t.lastmod >= lầnTrước).map((t) => t.loc);

if (!gửi.length) {
  console.log('IndexNow: không có trang nào mới.');
  process.exit(0);
}

const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList: gửi }),
}).catch((e) => ({ ok: false, status: 0, statusText: e.message }));

// 200: đã nhận; 202: đã nhận, đang xác minh khoá (lần đầu)
if (r.ok) {
  writeFileSync(STATE, JSON.stringify({ sentAt: new Date().toISOString().slice(0, 10) }, null, 1) + '\n');
  console.log(`IndexNow: đã báo ${gửi.length} trang (HTTP ${r.status}).`);
} else {
  // Không làm hỏng deploy: lần sau gửi lại
  console.log(`IndexNow: chưa gửi được (HTTP ${r.status} ${r.statusText ?? ''}), lần deploy sau sẽ thử lại.`);
}
