// Thử bộ header bảo mật (scripts/security-headers.mjs) trên bản build trước khi deploy:
// mở các màn chính với đúng CSP sẽ đưa lên Vercel và báo mọi thứ trình duyệt chặn.
// CSP sai thì trang trắng hoặc mất engine trên latbai.vn, nên phải thử trước.
//
// Chạy: npm run build, mở `API_PORT=8790 npx vite preview --port 4180` (và server thử ở
// 8790 có AUTH_DEV=1), rồi: node scripts/check-csp.mjs [http://localhost:4180]

import { chromium } from 'playwright';
import { securityHeaders } from './security-headers.mjs';

const BASE = process.argv[2] ?? 'http://localhost:4180';
const headers = Object.fromEntries(securityHeaders('').map((h) => [h.key.toLowerCase(), h.value]));
const vi_phạm = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
// Gắn header như Vercel sẽ gắn, cho mọi phản hồi từ bản build
await ctx.route(`${BASE}/**`, async (route) => {
  const r = await route.fetch();
  await route.fulfill({ response: r, headers: { ...r.headers(), ...headers } });
});
await ctx.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', (e) => {
    console.error(`CSP-VIOLATION ${e.violatedDirective} ${e.blockedURI} ${e.sourceFile ?? ''}:${e.lineNumber ?? ''}`);
  });
});
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' && /CSP|Content Security Policy|Refused/.test(m.text())) vi_phạm.push(`${page.url()} — ${m.text()}`);
});
page.on('pageerror', (e) => vi_phạm.push(`${page.url()} — lỗi JS: ${e.message}`));

const đi = async (path, chờ = 1500) => {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(chờ);
};

// Đăng nhập thử để vào được các màn cần tài khoản
await đi('/');
await page.evaluate(() => fetch('/api/auth/dev', { method: 'POST', body: JSON.stringify({ name: 'Thử CSP' }) }));

for (const p of ['/', '/#/choi', '/#/on-tap', '/#/hoc', '/#/huan-luyen', '/#/tai-khoan', '/#/xem-lai']) await đi(p);

// Ván với máy: engine Stockfish (WebAssembly trong worker) phải chạy được
await đi('/#/choi');
const nút = page.getByRole('button', { name: 'Chơi', exact: true });
if (await nút.count()) {
  await nút.first().click();
  await page.waitForTimeout(1500);
  // Đi e2–e4 bằng hai cú bấm, chờ máy đáp
  const ô = async (sq) => {
    const b = await page.locator('#board').boundingBox();
    const f = 'abcdefgh'.indexOf(sq[0]);
    const r = Number(sq[1]);
    await page.mouse.click(b.x + (f + 0.5) * (b.width / 8), b.y + (8 - r + 0.5) * (b.height / 8));
  };
  await ô('e2');
  await ô('e4');
  await page.waitForTimeout(5000);
  const đãĐi = await page.evaluate(() => document.querySelectorAll('.move-list .san, .moves .san, [data-ply]').length);
  console.log(`ván với máy: ${đãĐi} nước trên bảng nước đi`);
}

// Bàn cờ nổi: cửa sổ nhỏ nhúng chính trang vào một khung (src/app/mini.ts). Chrome không
// chạy được Picture-in-Picture khi không có màn hình, nên dựng đúng khung đó ngay trong trang.
await đi('/#/choi', 300);
const khungChạy = await page.evaluate(async () => {
  const f = document.createElement('iframe');
  f.src = '/?mini=1#/choi';
  f.style.cssText = 'width:320px;height:392px';
  document.body.append(f);
  await new Promise((r) => setTimeout(r, 4000));
  try {
    return Boolean(f.contentDocument?.querySelector('.app-mini #board, .app-mini .board-host'));
  } catch {
    return false;
  }
});
if (!khungChạy) vi_phạm.push('bàn cờ nổi: khung nhúng chính trang không hiện bàn cờ');
else console.log('bàn cờ nổi: khung nhúng hiện bàn cờ ✓');

// Trang đọc tĩnh (đếm lượt bằng /ping.js)
for (const p of ['/bai-tap-co-vua/index.html', '/tan-cuoc/quy-tac-hinh-vuong/index.html', '/chinh-sach-rieng-tu/index.html', '/cham-van-co-vua/index.html']) {
  await đi(p, 500);
}

// Thử ngược: chèn một thẻ có onerror như kẻ xấu chèn qua tên người chơi. CSP phải chặn,
// và bộ dò ở trên phải thấy — không thì "không có gì bị chặn" chẳng chứng minh được gì.
await đi('/#/choi', 300);
const trước = vi_phạm.length;
const chạy = await page.evaluate(async () => {
  window.__xss = false;
  document.body.insertAdjacentHTML('beforeend', '<img src="x:y" onerror="window.__xss = true">');
  await new Promise((r) => setTimeout(r, 500));
  return window.__xss;
});
await page.waitForTimeout(300);
const bắtĐược = vi_phạm.length > trước;
vi_phạm.splice(trước);
if (chạy || !bắtĐược) {
  console.log(`✗ Thử ngược hỏng: script chèn vào ${chạy ? 'VẪN CHẠY' : 'bị chặn'}, bộ dò ${bắtĐược ? 'có' : 'không'} thấy`);
  process.exit(1);
}
console.log('thử ngược: onerror chèn vào trang bị CSP chặn ✓');

await browser.close();
if (vi_phạm.length) {
  console.log(`✗ ${vi_phạm.length} chỗ bị chặn:`);
  for (const v of [...new Set(vi_phạm)]) console.log('  -', v);
  process.exit(1);
}
console.log('✓ Không có gì bị CSP chặn');
