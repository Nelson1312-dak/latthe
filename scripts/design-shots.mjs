// Chụp MỌI màn của app (khách và đã đăng nhập, điện thoại và máy tính) để rà thiết
// kế bằng mắt — agent rà design (.claude/agents/design-reviewer.md) và người đều
// dùng. Quy trình: docs/DESIGN-REVIEW.md.
//
// Cần server chạy với đăng nhập giả (AUTH_DEV=1) và Vite trỏ vào nó, ví dụ:
//   CHESS_DB=<file tạm>.db API_PORT=8790 AUTH_DEV=1 node --experimental-strip-types server/main.ts
//   API_PORT=8790 npx vite --port 5180 --strictPort
//   BASE=http://localhost:5180 node scripts/design-shots.mjs
// Ra: shots/review/<cỡ>-<màn>.png (shots/ không commit). In danh sách file đã chụp.
//
// Đăng nhập giả tạo một tài khoản mới mỗi lần chạy, rồi lưu sẵn một ván để có dữ
// liệu cho Xem lại, Huấn luyện viên, Hồ sơ — không đụng tới tài khoản thật nào.

import { chromium } from 'playwright';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5180';
const OUT = 'shots/review';
const VÁN_MẪU = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3#';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const lỗi = [];

async function chụp(p, tên) {
  await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' }).catch(() => {});
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/${tên}.png`, fullPage: false });
}

async function tới(p, route) {
  await p.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!document.querySelector('#piece-sprite svg'), null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(600);
}

for (const [cỡ, w, h] of [
  ['dt', 390, 844],
  ['safari', 390, 705],
  ['mt', 1440, 900],
]) {
  const mobile = w < 768;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('welcome-seen', '1');
    } catch {
      /* bỏ qua */
    }
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => lỗi.push(`${cỡ}: ${e.message}`));

  // Khách
  await tới(p, '');
  await chụp(p, `${cỡ}-khach-sanh`);
  if (cỡ === 'safari') {
    await ctx.close();
    continue;
  }
  await tới(p, 'tai-khoan');
  await chụp(p, `${cỡ}-khach-tai-khoan`);

  // Đăng nhập giả + một ván đã lưu
  const id = await p.evaluate(async (pgn) => {
    const r = await fetch('/api/auth/dev', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Người rà' }) });
    if (!r.ok) return null;
    await fetch('/api/games', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'bot', level: 3, playerSide: 'w', winner: 'b', reason: 'checkmate', pgn }),
    });
    const g = await (await fetch('/api/games', { credentials: 'same-origin' })).json();
    return g.games?.[0]?.id ?? null;
  }, VÁN_MẪU);
  if (!id) {
    console.error('Không đăng nhập giả được: server phải chạy với AUTH_DEV=1 trên máy này.');
    process.exit(1);
  }
  await p.reload({ waitUntil: 'networkidle' });

  for (const [tên, route] of [
    ['sanh', ''],
    ['choi', 'choi'],
    ['on-tap', 'on-tap'],
    ['hoc', 'hoc'],
    ['huan-luyen', 'huan-luyen'],
    ['tai-khoan', 'tai-khoan'],
    ['van-da-choi', 'xem-lai'],
  ]) {
    await tới(p, route);
    await chụp(p, `${cỡ}-${tên}`);
  }

  // Xem lại một ván (đợi engine chấm xong)
  await tới(p, `xem-lai?game=${id}`);
  await p.waitForFunction(() => /chính xác/i.test(document.body.innerText), null, { timeout: 120000 }).catch(() => {});
  await chụp(p, `${cỡ}-xem-lai`);

  // Cài đặt
  await tới(p, 'choi');
  await p.locator('button[title="Cài đặt"]:visible').first().click().catch(() => {});
  await p.waitForSelector('.settings', { timeout: 5000 }).catch(() => {});
  await chụp(p, `${cỡ}-cai-dat`);
  await p.keyboard.press('Escape');

  // Đang đánh với máy: đi vài nước
  await tới(p, 'choi');
  await p.locator('[data-level="1"]').click();
  await p.locator('[data-pick="w"]').click();
  await p.locator(mobile ? '.qs-play' : '.game-side .btn-primary').first().click();
  await p.waitForTimeout(600);
  for (const [a, b] of [['e2', 'e4'], ['g1', 'f3'], ['f1', 'c4']]) {
    const r = await p.locator('#board svg').boundingBox();
    const ô = (sq) => ({ x: r.x + (sq.charCodeAt(0) - 97 + 0.5) * (r.width / 8), y: r.y + (8 - Number(sq[1]) + 0.5) * (r.height / 8) });
    const A = ô(a);
    const B = ô(b);
    await p.mouse.move(A.x, A.y);
    await p.mouse.down();
    await p.mouse.move(B.x, B.y, { steps: 5 });
    await p.mouse.up();
    await p.waitForTimeout(2200);
  }
  await chụp(p, `${cỡ}-dang-danh`);

  // Hết ván: hộp thoại kết quả
  const đầuHàng = p.locator(mobile ? '.game-bar [data-act="resign"]' : '.game-side [data-act="resign"]');
  await đầuHàng.click().catch(() => {});
  await đầuHàng.click().catch(() => {});
  await p.waitForTimeout(3000);
  await chụp(p, `${cỡ}-het-van`);
  await ctx.close();
}
await browser.close();

console.log(`Đã chụp ${readdirSync(OUT).length} màn vào ${OUT}/:`);
for (const f of readdirSync(OUT).sort()) console.log('  -', f);
if (lỗi.length) {
  console.log('Lỗi JS trong lúc chụp:');
  for (const l of lỗi) console.log('  -', l);
}
