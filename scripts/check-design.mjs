// Rà tự động theo danh sách cấm ở docs/DESIGN.md mục 2, cộng vài kiểm tra kỹ thuật.
// Chạy: npm run check:design (cần `npm run dev` đang chạy).
// `npm run deploy` cũng chạy file này (với bản đã build, không có API: CHECK_NO_API=1)
// và KHÔNG deploy nếu còn lỗi. Quy trình rà đầy đủ: docs/DESIGN-REVIEW.md.
import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const ROUTES = ['', 'choi', 'choi-may', 'xem-lai', 'on-tap', 'hoc', 'ban', 'tai-khoan', 'thiet-ke'];
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
  // Vạch màu bên trái (kiểu "callout"), dày từ 2px — cấm ở mọi chỗ (DESIGN.md mục 2)
  for (const m of text.matchAll(/border-left:\s*([2-9]|\d{2,})px\s+solid\s+(?!transparent)[^;]+/g)) {
    fail(f, `vạch màu bên trái (“${m[0].slice(0, 50)}”)`);
  }
}

// Thanh điều hướng phải dùng icon đặc hình cờ (nav-*), không dùng icon nét mảnh
{
  const main = readFileSync('src/main.ts', 'utf8');
  const nav = /const NAV[^=]*=\s*\[([\s\S]*?)\];/.exec(main)?.[1] ?? '';
  for (const m of nav.matchAll(/icon:\s*'([\w-]+)'/g)) {
    if (!m[1].startsWith('nav-')) fail('src/main.ts', `NAV dùng icon nét mảnh '${m[1]}' — dùng icon đặc nav-*`);
  }
}

/* ---------- 2. Rà trang đã dựng ---------- */
const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  // Bản đã build chạy không có API (lúc deploy): lỗi gọi /api là đương nhiên, bỏ qua
  const NO_API = process.env.CHECK_NO_API === '1';
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (NO_API && /Failed to load resource|\/api\/|status of 404|status of 502|HTTP 404/i.test(m.text())) return;
    fail(`console/${theme}`, m.text());
  });
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

    // Những thứ từng làm giao diện "trông như AI làm" (đợt rà 19/11/2026), máy đo được:
    const ai = await page.evaluate((route) => {
      const out = [];
      const vis = (el) => {
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };
      const tag = (el) =>
        el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '');
      // Màu nhấn chỉ cho nút chính và công tắc bật
      const probe = document.createElement('i');
      probe.style.color = 'var(--accent)';
      document.body.append(probe);
      const accent = getComputedStyle(probe).color;
      probe.remove();
      const ALLOW = '.btn-primary, .switch, .qs-play, [data-spec], .spec-section, .swatch-board, .board, .board-host, .evalbar';
      for (const el of document.querySelectorAll('body *')) {
        if (!vis(el) || el.closest(ALLOW)) continue;
        const st = getComputedStyle(el);
        const hit =
          st.backgroundColor === accent ||
          (parseFloat(st.borderTopWidth) > 0 && st.borderTopColor === accent) ||
          (parseFloat(st.borderBottomWidth) > 0 && st.borderBottomColor === accent) ||
          (parseFloat(st.borderLeftWidth) > 0 && st.borderLeftColor === accent) ||
          (el.childElementCount === 0 && el.textContent.trim() && st.color === accent);
        if (hit) out.push(`màu nhấn ngoài nút chính: ${tag(el)}`);
      }
      // Vạch màu bên trái
      for (const el of document.querySelectorAll('body *')) {
        if (!vis(el) || el.closest('.board, .board-host')) continue;
        const st = getComputedStyle(el);
        if (parseFloat(st.borderLeftWidth) >= 2 && !/rgba\(0, 0, 0, 0\)|transparent/.test(st.borderLeftColor) &&
            parseFloat(st.borderRightWidth) < 1) {
          out.push(`vạch màu bên trái: ${tag(el)}`);
        }
      }
      // Chữ chức năng nhỏ hơn 11px (trừ bàn cờ, huy hiệu, thanh đánh giá)
      for (const el of document.querySelectorAll('p, span, b, small, a, button, label, li')) {
        if (!vis(el) || el.childElementCount || !el.textContent.trim()) continue;
        if (el.closest('svg, .board, .badge, .evalbar, .spec-section')) continue;
        if (parseFloat(getComputedStyle(el).fontSize) < 11) out.push(`chữ nhỏ hơn 11px: ${tag(el)} “${el.textContent.trim().slice(0, 20)}”`);
      }
      // Mẫu "số to + nhãn nhỏ" xếp ô chỉ được ở trang Thống kê
      if (route !== 'thong-ke' && route !== 'thiet-ke' && document.querySelector('.stat-tile')) out.push('ô số to (stat-tile) ngoài trang Thống kê');
      // Icon thanh điều hướng phải đặc
      for (const svg of document.querySelectorAll('.nav-item svg, .site-head .top-link svg, .game-bar svg, .qs-acts svg')) {
        if (!vis(svg)) continue;
        const đặc = [...svg.querySelectorAll('*')].some((n) => getComputedStyle(n).fill !== 'none');
        if (!đặc) out.push('icon thanh điều hướng là nét mảnh');
      }
      return [...new Set(out)];
    }, route);
    for (const a of ai) fail(where, a);

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
// Màn đã đăng nhập (hồ sơ, huấn luyện viên, ván đã chơi...) chỉ có khi có API với đăng
// nhập giả (AUTH_DEV=1). Lượt khách ở trên không thấy chúng — Hồ sơ từng tràn ngang 27px
// trên điện thoại mà cổng không bắt được. Bản build lúc deploy không có API thì bỏ qua.
if (process.env.CHECK_NO_API !== '1') {
  // Giả lập điện thoại thật (isMobile): trên điện thoại, nội dung rộng quá thì cả trang
  // bị thu nhỏ lại cho vừa (innerWidth > 390) chứ không chỉ hiện thanh cuộn ngang
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
  const vào = await page.evaluate(async () => {
    const r = await fetch('/api/auth/dev', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"Rà giao diện"}' }).catch(() => null);
    if (!r?.ok) return false;
    // Một ván đã lưu để các màn có dữ liệu thật (dòng Huấn luyện viên, Hồ sơ, Ván đã chơi)
    await fetch('/api/games', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'bot', level: 3, playerSide: 'w', winner: 'b', reason: 'checkmate',
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3#',
      }),
    });
    return true;
  });
  if (vào) {
    // App đọc người dùng lúc mở trang: tải lại để vào đúng trạng thái đã đăng nhập
    await page.reload({ waitUntil: 'networkidle' });
    // Xem lại ván vừa lưu trước (trình duyệt chấm ván, sinh dữ liệu cho Huấn luyện viên)
    const id = await page.evaluate(async () => (await (await fetch('/api/games', { credentials: 'same-origin' })).json()).games?.[0]?.id);
    if (id) {
      await page.goto(`${BASE}/#/xem-lai?game=${id}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => /chính xác/i.test(document.body.innerText), null, { timeout: 120000 }).catch(() => {});
    }
    for (const route of ['', 'choi', 'on-tap', 'hoc', 'huan-luyen', 'tai-khoan', 'xem-lai', `xem-lai?game=${id}`]) {
      await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const tràn = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, window.innerWidth) - 390);
      if (tràn > 1) fail(`đã đăng nhập /#/${route || 'sanh'}`, `tràn ngang ${tràn}px ở cỡ điện thoại`);
    }
  } else {
    console.log('(Không đăng nhập giả được — bỏ qua lượt màn đã đăng nhập; cần server chạy với AUTH_DEV=1)');
  }
  await ctx.close();
}
await browser.close();

if (problems.length) {
  console.log(`✗ ${problems.length} vấn đề:`);
  for (const p of problems) console.log('  -', p);
  process.exit(1);
}
console.log('✓ Không có vấn đề nào theo danh sách cấm ở docs/DESIGN.md');
