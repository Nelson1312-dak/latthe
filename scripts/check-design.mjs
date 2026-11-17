// Rà tự động theo danh sách cấm ở docs/DESIGN.md mục 2, cộng vài kiểm tra kỹ thuật.
// Chạy: npm run check:design (cần `npm run dev` đang chạy).
import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const ROUTES = ['', 'choi', 'choi-may', 'xem-lai', 'on-tap', 'ban', 'tai-khoan', 'thiet-ke'];
const problems = [];
const fail = (where, what) => problems.push(`${where}: ${what}`);

/* ---------- 1. Rà mã nguồn ---------- */
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? sourceFiles(p) : /\.(ts|css|html)$/.test(e.name) ? [p] : [];
  });
}

const SOURCE_BANS = [
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'dùng emoji trong giao diện'],
  [/backdrop-filter/i, 'dùng hiệu ứng kính mờ'],
  [/font-family:\s*['"]?Inter/i, 'dùng font Inter'],
  [/lorem ipsum/i, 'còn chữ giả Lorem ipsum'],
  [/Người chơi 1|Player 1/i, 'còn tên giả'],
  [/lucide|heroicons|font-?awesome/i, 'dùng bộ icon tải sẵn'],
];

for (const f of [...sourceFiles('src'), ...sourceFiles('shared')]) {
  const text = readFileSync(f, 'utf8');
  for (const [re, msg] of SOURCE_BANS) {
    const m = re.exec(text);
    // Ký hiệu cờ ★ ✓ ✕ ?! là chú giải cờ chuẩn, không phải emoji trang trí.
    if (m && !(msg.includes('emoji') && /[★✓✕]/.test(m[0]))) fail(f, `${msg} (“${m[0]}”)`);
  }
  // Gradient chỉ được dùng cho ô Vua bị chiếu (có chức năng)
  for (const g of text.match(/\w*-?gradient\([^)]*\)/g) ?? []) {
    if (!/check-glow/.test(text.slice(Math.max(0, text.indexOf(g) - 200), text.indexOf(g) + 200))) {
      fail(f, `dùng gradient ngoài ô Vua bị chiếu (“${g.slice(0, 40)}”)`);
    }
  }
  // Bo góc lớn và bóng đổ mềm
  for (const r of text.match(/border-radius:\s*(\d+)px/g) ?? []) {
    const px = Number(/(\d+)/.exec(r)[1]);
    if (px >= 10) fail(f, `bo góc ${px}px, tối đa 6px`);
  }
  for (const b of text.match(/box-shadow:[^;]+/g) ?? []) {
    if (!/--shadow-float|0 8px 24px/.test(b)) fail(f, `bóng đổ ngoài quy định (“${b.slice(0, 40)}”)`);
  }
}

/* ---------- 2. Rà trang đã dựng ---------- */
const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  page.on('console', (m) => m.type() === 'error' && fail(`console/${theme}`, m.text()));
  page.on('pageerror', (e) => fail(`console/${theme}`, e.message));

  for (const route of ROUTES) {
    const where = `${theme} /#/${route || 'sanh'}`;
    await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!document.querySelector('#piece-sprite svg'));

    // Tương phản chữ so với nền (ngưỡng 4.5:1)
    const low = await page.evaluate(() => {
      const lum = (c) => {
        // getComputedStyle trả về rgb(0-255) hoặc color(srgb 0-1) khi dùng color-mix
        const srgb = c.startsWith('color(');
        const [r, g, b] = c.match(/[\d.]+/g).slice(srgb ? 0 : 0, srgb ? 3 : 3).map(Number).map((v) => {
          const s = srgb ? v : v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const bgOf = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
        }
        return getComputedStyle(document.body).backgroundColor;
      };
      const out = [];
      for (const el of document.querySelectorAll('p, span, h1, h2, h3, button, a, code, text')) {
        const t = el.textContent?.trim();
        // Chữ trên thanh đánh giá nằm đè lên một lớp hai màu, không phải nền của cha,
        // nên máy không đo được; hai màu đó đã chọn sẵn cho đủ tương phản.
        if (!t || el.children.length || el.closest('[hidden], .evalbar')) continue;
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') continue;
        const size = parseFloat(st.fontSize);
        const l1 = lum(st.color);
        const l2 = lum(bgOf(el));
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const need = size >= 24 || (size >= 18.66 && Number(st.fontWeight) >= 700) ? 3 : 4.5;
        if (ratio < need) out.push(`${ratio.toFixed(2)}:1 cần ${need} — “${t.slice(0, 32)}”`);
      }
      return [...new Set(out)];
    });
    for (const l of low) fail(where, `tương phản thấp ${l}`);

    // Vùng bấm nhỏ hơn 44px trên điện thoại
    await page.setViewportSize({ width: 390, height: 844 });
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button, a')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.height < 44 && !el.closest('.move-list, .move-bar, .spec-section');
        })
        .map((el) => `${el.className || el.tagName} ${Math.round(el.getBoundingClientRect().height)}px`),
    );
    for (const s of [...new Set(small)]) fail(where, `vùng bấm trên điện thoại chỉ ${s}`);

    // Trang không được tràn ngang
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) fail(where, `tràn ngang ${overflow}px ở cỡ điện thoại`);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.close();
}
await browser.close();

if (problems.length) {
  console.log(`✗ ${problems.length} vấn đề:`);
  for (const p of problems) console.log('  -', p);
  process.exit(1);
}
console.log('✓ Không có vấn đề nào theo danh sách cấm ở docs/DESIGN.md');
