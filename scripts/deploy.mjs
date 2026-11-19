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

import { spawn, spawnSync } from 'node:child_process';
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
const TRANG_TĨNH = [
  '/chinh-sach-rieng-tu',
  '/cham-van-co-vua',
  '/luat-co-vua',
  '/khai-cuoc',
  '/bai-tap-co-vua',
  '/bay-khai-cuoc',
  '/tan-cuoc',
  '/choi-co-vua-voi-may',
  '/choi-co-vua-online',
  '/meo-choi-co-vua',
];
// Mục có trang con /<mục>/<tên>/ (scripts/build-guides.ts, build-topics.ts, build-puzzles.ts)
const CÓ_TRANG_CON = ['/khai-cuoc', '/bai-tap-co-vua', '/bay-khai-cuoc', '/tan-cuoc'];
cấu.rewrites = [
  ...TRANG_TĨNH.flatMap((t) => [
    { source: t, destination: `${t}/index.html` },
    { source: `${t}/`, destination: `${t}/index.html` },
  ]),
  // Ván được chia sẻ: latbai.vn/van/<id> là chính app, app tự đọc id trong đường dẫn
  { source: '/van/:id', destination: '/index.html' },
  // Trang bài học công khai (scripts/build-lessons.ts sinh ra trong public/hoc/)
  { source: '/hoc', destination: '/hoc/index.html' },
  { source: '/hoc/', destination: '/hoc/index.html' },
  { source: '/hoc/:slug', destination: '/hoc/:slug/index.html' },
  { source: '/hoc/:slug/', destination: '/hoc/:slug/index.html' },
  ...CÓ_TRANG_CON.flatMap((t) => [
    { source: `${t}/:slug`, destination: `${t}/:slug/index.html` },
    { source: `${t}/:slug/`, destination: `${t}/:slug/index.html` },
  ]),
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

/**
 * Cổng thiết kế: không deploy khi giao diện còn lỗi theo danh sách cấm (docs/DESIGN.md
 * mục 2) mà máy đo được. Chạy trên đúng bản vừa build, qua `vite preview` (không có
 * API). So ảnh chụp với ảnh chuẩn thì chỉ báo, không chặn — màn đổi có thể là cố ý;
 * người hoặc agent rà design duyệt rồi chạy `node scripts/visual-diff.mjs --update`.
 * Quy trình đầy đủ: docs/DESIGN-REVIEW.md. Khẩn cấp cần bỏ qua: SKIP_DESIGN_CHECK=1.
 */
async function cổngThiếtKế() {
  if (process.env.SKIP_DESIGN_CHECK === '1') {
    console.log('Bỏ qua cổng thiết kế (SKIP_DESIGN_CHECK=1).');
    return;
  }
  const port = 4179;
  const base = `http://localhost:${port}`;
  const p = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { shell: true, stdio: 'ignore' });
  const dừng = () => {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
    else p.kill();
  };
  let ok = false;
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {
        /* chưa lên */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log('Cổng thiết kế: rà bản vừa build…');
    const env = { ...process.env, BASE: base, CHECK_NO_API: '1' };
    const rà = spawnSync('node', ['scripts/check-design.mjs'], { env, stdio: 'inherit', shell: true });
    spawnSync('node', ['scripts/visual-diff.mjs'], { env, stdio: 'inherit', shell: true });
    ok = rà.status === 0;
  } finally {
    dừng();
  }
  if (!ok) {
    console.error('✗ Dừng deploy: giao diện còn lỗi ở trên. Sửa rồi deploy lại.');
    process.exit(1);
  }
}

await cổngThiếtKế();

writeFileSync('vercel.json', JSON.stringify(cấu, null, 2) + '\n');

const r = spawnSync('npx', ['vercel', 'deploy', '--prod', '--yes'], { stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
