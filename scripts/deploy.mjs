// Đưa bản web lên latbai.vn.
// Chạy: npm run deploy
//
// Nếu có PUBLIC_UPSTREAM thì sinh thêm phần `rewrites` trong vercel.json để
// Vercel CHUYỂN TIẾP /api sang máy đang chạy server (qua tunnel). Nhờ vậy
// trình duyệt chỉ nói chuyện với https://latbai.vn — cùng một origin — nên
// cookie phiên chạy bình thường và Google OAuth chỉ cần khai đúng latbai.vn.
// Không phải đổi DNS, không cần Cloudflare, không cần VPS.
//
// Không đặt PUBLIC_UPSTREAM thì vercel.json không có rewrites: latbai.vn là
// bản tĩnh như cũ (chơi với máy, giải bài tập), /api trả 404.
//
// PUBLIC_UPSTREAM phải là địa chỉ CỐ ĐỊNH. Tunnel tạm của cloudflared đổi tên
// mỗi lần chạy nên không dùng được ở đây.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const NỀN = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
};

/** Đọc PUBLIC_UPSTREAM từ môi trường, không có thì thử .env.chess. */
function upstream() {
  if (process.env.PUBLIC_UPSTREAM) return process.env.PUBLIC_UPSTREAM.trim();
  if (!existsSync('.env.chess')) return '';
  const d = readFileSync('.env.chess', 'utf8');
  return (/^PUBLIC_UPSTREAM\s*=\s*(.+)$/m.exec(d)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
}

const lên = upstream().replace(/\/+$/, '');
const cấu = { ...NỀN };

// Trang tĩnh viết tay (không phải app): Vercel không tự trả index.html cho
// đường dẫn thư mục, nên chỉ đường cho nó. Google đòi đúng địa chỉ này cho
// trang chính sách quyền riêng tư.
const TRANG_TĨNH = ['/chinh-sach-rieng-tu', '/cham-van-co-vua'];
cấu.rewrites = [
  ...TRANG_TĨNH.flatMap((t) => [
    { source: t, destination: `${t}/index.html` },
    { source: `${t}/`, destination: `${t}/index.html` },
  ]),
  // Ván được chia sẻ: latbai.vn/van/<id> là chính app, app tự đọc id trong đường dẫn
  { source: '/van/:id', destination: '/index.html' },
];

if (lên) {
  if (!/^https:\/\//.test(lên)) {
    console.error(`PUBLIC_UPSTREAM phải bắt đầu bằng https:// — đang là "${lên}"`);
    process.exit(1);
  }
  // Chỉ chuyển tiếp /api. Phần còn lại vẫn là file tĩnh trên Vercel, nên máy
  // ở nhà tắt thì trang vẫn mở được và vẫn chơi với máy được.
  cấu.rewrites.push({ source: '/api/:path*', destination: `${lên}/api/:path*` });
  console.log(`Chuyển tiếp /api → ${lên}`);
} else {
  console.log('Không có PUBLIC_UPSTREAM: chỉ đưa bản tĩnh lên (không có /api).');
}

writeFileSync('vercel.json', JSON.stringify(cấu, null, 2) + '\n');

const r = spawnSync('npx', ['vercel', 'deploy', '--prod', '--yes'], { stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
