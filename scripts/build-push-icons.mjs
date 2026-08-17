/**
 * scripts/build-push-icons.mjs — Sinh PNG cho Web Push notification (+ icon PWA).
 * Usage: npm run build:pushicons
 *
 * VÌ SAO cần script riêng thay vì rasterize images/icon*.svg:
 *   icon.svg / icon-maskable.svg đặt vị trí 3 lá bài BẰNG CSS @keyframes và không set
 *   fill="none" cho các vòng astrolabe. librsvg (backend của sharp) không chạy CSS
 *   animation ⇒ lá bài dồn về gốc toạ độ, vòng tròn bị fill đen ⇒ PNG ra khối ĐEN.
 *   Nên dùng source SVG TĨNH riêng (push-source-*.svg), cùng quy ước với
 *   scripts/og-source-*.svg + scripts/build-og.js.
 *
 * VÌ SAO phải là PNG: Chrome/Android KHÔNG render SVG cho `badge`, và `icon` SVG cũng
 *   không ổn định ⇒ thông báo rơi về icon Chrome mặc định (mất thương hiệu ở đúng
 *   kênh làm retention).
 *
 * sharp là devDependency ⇒ CHỈ chạy được ở build-time local, KHÔNG có trong serverless
 *   runtime ⇒ PHẢI commit các file PNG output vào git.
 *
 * Tên script KHÔNG được là "build-icons" — scripts/build-icons.mjs đã tồn tại và làm
 *   việc khác hẳn (subset webfont Tabler, cần Python fonttools).
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES = join(__dirname, '..', 'images');

const JOBS = [
  // icon thông báo (Chrome/Android khuyến nghị 192) + icon PWA cho manifest
  { src: 'push-source-icon.svg', out: 'icon-192.png', size: 192 },
  { src: 'push-source-icon.svg', out: 'icon-512.png', size: 512 },
  // badge status bar: nền trong suốt, hình trắng đặc (Android dùng như mặt nạ alpha)
  { src: 'push-source-badge.svg', out: 'badge-96.png', size: 96 },
];

for (const { src, out, size } of JOBS) {
  const svg = await readFile(join(__dirname, src));
  const png = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // Fail loudly: nếu librsvg lại âm thầm bỏ qua thứ gì đó (CSS animation, filter-function)
  // thì ảnh sẽ gần như một màu — chặn ngay tại đây chứ đừng commit một khối đen.
  // Lưu ý: assert này KHÔNG bắt được bố cục lệch, nên vẫn phải mở PNG xem bằng mắt.
  const st = await sharp(png).stats();
  const flat = st.channels.slice(0, 3).every((c) => c.stdev < 6);
  if (flat) {
    throw new Error(
      `${out}: ảnh gần như một màu (stdev < 6) — source SVG có thể đang dùng CSS ` +
      `animation/filter mà librsvg bỏ qua. Kiểm tra scripts/${src}.`
    );
  }

  await writeFile(join(IMAGES, out), png);
  console.log(`✓ images/${out}  (${(png.length / 1024).toFixed(1)} KB)`);
}
