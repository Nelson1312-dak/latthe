// Sinh biểu tượng app (PWA, màn hình chính iPhone, favicon) từ quân Mã trong
// sprite cburnett. Chạy lại khi đổi màu nhấn: node scripts/make-icons.mjs
//
// - icon-<n>.png: Mã chiếm ~90% khung (hình quân chỉ lấp ~2/3 khung của nó), nền màu nhấn phủ kín (hệ điều hành tự bo góc).
// - icon-maskable-512.png: Mã thu nhỏ để nằm gọn trong vùng an toàn (vòng tròn 80%)
//   vì Android có thể cắt icon thành tròn, giọt nước...
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const NỀN = '#1a7a6c'; // --accent bản sáng: đủ tương phản với Mã trắng
const sprite = readFileSync('public/pieces/cburnett.svg', 'utf8')
  .replace(/<\?xml[^>]*>/, '')
  .replace(/<title>[\s\S]*?<\/title>/g, '');

/** Mã chiếm `tỉ lệ` cạnh khung, đặt giữa. */
function svg(px, tỉLệ) {
  const k = (px * tỉLệ) / 40;
  const lề = (px - px * tỉLệ) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">
    <rect width="${px}" height="${px}" fill="${NỀN}"/>
    <use href="#wn" transform="translate(${lề} ${lề - px * 0.01}) scale(${k})"/>
  </svg>`;
}

const ra = [
  ['public/icons/icon-192.png', 192, 0.9],
  ['public/icons/icon-512.png', 512, 0.9],
  ['public/icons/icon-maskable-512.png', 512, 0.7],
  ['public/icons/apple-touch-icon.png', 180, 0.86],
  ['public/icons/favicon-32.png', 32, 1.05],
];

const { mkdirSync } = await import('node:fs');
mkdirSync('public/icons', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, px, tỉLệ] of ra) {
  await page.setViewportSize({ width: px, height: px });
  await page.setContent(
    `<html><body style="margin:0"><div style="display:none">${sprite}</div>${svg(px, tỉLệ)}</body></html>`,
  );
  await page.locator('body > svg').screenshot({ path: file, omitBackground: false });
  console.log(file);
}
await browser.close();
