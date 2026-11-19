// So ảnh chụp các màn với ảnh chuẩn đã duyệt (design/baseline/), để thấy ngay màn
// nào đổi sau một lần sửa — kể cả những chỗ không ai định đổi.
//
// Chạy (cần `npm run build` trước):
//   node scripts/visual-diff.mjs            so với ảnh chuẩn, in danh sách màn đã đổi
//   node scripts/visual-diff.mjs --update   chụp lại làm ảnh chuẩn mới (sau khi đã duyệt)
//   node scripts/visual-diff.mjs --strict   như lần đầu nhưng thoát mã 1 nếu có màn đổi
//
// Luôn chụp bản ĐÃ BUILD qua `vite preview`, không có API (khách chưa đăng nhập),
// tắt hiệu ứng chuyển động — để hai lần chụp giống hệt nhau nếu giao diện không đổi.
// Đặt BASE=... để dùng một bản preview đang chạy sẵn (deploy.mjs làm vậy).
// Ảnh khác biệt (vùng đổi tô đỏ) ghi vào shots/diff/ để xem.

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const UPDATE = process.argv.includes('--update');
const STRICT = process.argv.includes('--strict');
const BASELINE = 'design/baseline';
const DIFF = 'shots/diff';
/** Tỉ lệ điểm ảnh khác (lệch kênh màu > 24) từ mức này trở lên thì coi là màn đã đổi. */
const NGƯỠNG = 0.002;

const MÀN = [
  ['sanh', ''],
  ['choi', 'choi'],
  ['hoc', 'hoc'],
  // Không chụp trang Tài khoản của khách: nút Google tải từ ngoài, mỗi lần hiện một khác
  ['thiet-ke', 'thiet-ke'],
  ['cai-dat', 'choi', 'settings'],
];
const CỠ = [
  ['dt', 390, 844],
  ['mt', 1440, 900],
];

async function chạyPreview() {
  if (process.env.BASE) return { base: process.env.BASE, dừng: () => {} };
  if (!existsSync('dist/index.html')) {
    console.error('Chưa có bản build: chạy `npm run build` trước.');
    process.exit(1);
  }
  const port = 4179;
  const p = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { shell: true, stdio: 'ignore' });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* chưa lên */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const dừng = () => {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
    else p.kill();
  };
  return { base, dừng };
}

/** So hai ảnh PNG ngay trong trình duyệt (canvas), trả về tỉ lệ khác và ảnh khác biệt. */
async function so(page, a, b) {
  return page.evaluate(
    async ([a, b]) => {
      const nạp = (src) =>
        new Promise((ok, lỗi) => {
          const im = new Image();
          im.onload = () => ok(im);
          im.onerror = lỗi;
          im.src = src;
        });
      const [x, y] = await Promise.all([nạp(a), nạp(b)]);
      if (x.width !== y.width || x.height !== y.height) return { tỉLệ: 1, ảnh: null, lệchCỡ: true };
      const c = document.createElement('canvas');
      c.width = x.width;
      c.height = x.height;
      const g = c.getContext('2d');
      g.drawImage(x, 0, 0);
      const d1 = g.getImageData(0, 0, c.width, c.height).data;
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(y, 0, 0);
      const out = g.getImageData(0, 0, c.width, c.height);
      const d2 = out.data;
      let khác = 0;
      for (let i = 0; i < d1.length; i += 4) {
        const lệch = Math.max(Math.abs(d1[i] - d2[i]), Math.abs(d1[i + 1] - d2[i + 1]), Math.abs(d1[i + 2] - d2[i + 2]));
        if (lệch > 24) {
          khác++;
          d2[i] = 255;
          d2[i + 1] = 0;
          d2[i + 2] = 0;
        } else {
          // Phần giống nhau làm mờ đi để vùng đổi nổi lên
          d2[i] = d2[i] * 0.35 + 160;
          d2[i + 1] = d2[i + 1] * 0.35 + 160;
          d2[i + 2] = d2[i + 2] * 0.35 + 160;
        }
      }
      g.putImageData(out, 0, 0);
      return { tỉLệ: khác / (d1.length / 4), ảnh: c.toDataURL('image/png') };
    },
    [a, b],
  );
}

const { base, dừng } = await chạyPreview();
mkdirSync(BASELINE, { recursive: true });
mkdirSync(DIFF, { recursive: true });
const browser = await chromium.launch();
const đổi = [];
const mới = [];
try {
  for (const [cỡ, w, h] of CỠ) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('theme', 'dark');
        localStorage.removeItem('prefs');
        localStorage.setItem('welcome-seen', '1');
      } catch {
        /* bỏ qua */
      }
    });
    const page = await ctx.newPage();
    for (const [tên, route, thêm] of MÀN) {
      await page.goto(`${base}/#/${route}`, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
      await page.waitForFunction(() => !!document.querySelector('#piece-sprite svg'));
      if (thêm === 'settings') {
        await page.locator('button[title="Cài đặt"]:visible').first().click();
        await page.waitForSelector('.settings');
      }
      await page.waitForTimeout(400);
      const file = `${tên}-${cỡ}.png`;
      const ảnh = await page.screenshot();
      const chuẩn = `${BASELINE}/${file}`;
      if (UPDATE || !existsSync(chuẩn)) {
        writeFileSync(chuẩn, ảnh);
        mới.push(file);
        continue;
      }
      const r = await so(page, `data:image/png;base64,${readFileSync(chuẩn).toString('base64')}`, `data:image/png;base64,${ảnh.toString('base64')}`);
      if (r.tỉLệ >= NGƯỠNG) {
        đổi.push(`${file} — khác ${(r.tỉLệ * 100).toFixed(1)}%${r.lệchCỡ ? ' (đổi cả chiều cao)' : ''}`);
        writeFileSync(`${DIFF}/${file}`, ảnh);
        if (r.ảnh) writeFileSync(`${DIFF}/${file.replace('.png', '.khac.png')}`, Buffer.from(r.ảnh.split(',')[1], 'base64'));
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  dừng();
}

if (mới.length) console.log(`Ảnh chuẩn ${UPDATE ? 'chụp lại' : 'mới'}: ${mới.length} màn (${BASELINE}/)`);
if (!UPDATE) {
  if (đổi.length) {
    console.log(`△ ${đổi.length} màn khác ảnh chuẩn (xem ${DIFF}/, vùng đổi tô đỏ trong *.khac.png):`);
    for (const d of đổi) console.log('  -', d);
    console.log('  Đã duyệt và đúng ý: node scripts/visual-diff.mjs --update');
    if (STRICT) process.exit(1);
  } else if (!mới.length) {
    console.log(`✓ ${readdirSync(BASELINE).length} màn giống ảnh chuẩn`);
  }
}
