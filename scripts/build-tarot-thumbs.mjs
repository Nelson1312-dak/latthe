/**
 * scripts/build-tarot-thumbs.mjs — Sinh thumbnail nhỏ cho 78 lá tarot.
 * Ảnh gốc webp ~200-400KB/lá → trang tra cứu load 78 lá = ~23MB.
 * Thumb 160px (đủ nét cho hiển thị 34-72px retina) ~5-15KB/lá → ~0.7MB.
 * Dùng canvas của Chromium (Playwright trong ../latbai-brand) — không cần sharp.
 * Output: tarot/images/thumbs/{img}.webp
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = join(ROOT, '..', 'latbai-brand');
const require2 = createRequire(join(BRAND, 'package.json'));
const { chromium } = require2('playwright');

const SRC = join(ROOT, 'tarot', 'images');
const OUT = join(SRC, 'thumbs');
mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC).filter(f => f.endsWith('.webp'));
console.log(`Nguồn: ${files.length} ảnh webp`);

const browser = await chromium.launch();
const page = await browser.newPage();

let totalOut = 0;
for (const f of files) {
  // nạp bằng data URL — Chromium chặn decode ảnh file:// từ page trống
  const srcData = `data:image/webp;base64,${readFileSync(join(SRC, f)).toString('base64')}`;
  const dataUrl = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const w = 160;
    const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    return cv.toDataURL('image/webp', 0.78);
  }, srcData);

  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(join(OUT, f), buf);
  totalOut += buf.length;
}
await browser.close();

console.log(`Đã sinh ${files.length} thumbs → tarot/images/thumbs/ (tổng ${(totalOut / 1024).toFixed(0)} KB)`);
