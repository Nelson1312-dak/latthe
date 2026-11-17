// Thử đầu-cuối bằng trình duyệt thật.
// Chạy: node scripts/e2e.mjs [địa-chỉ]    (mặc định http://localhost:5173)
//
// Đi hết đường chính của người dùng: vào sảnh → chơi với máy → xem lại ván →
// ôn tập → đấu online hai người. Chạy được với cả bản dev lẫn bản mở ra
// internet (`npm run public`); chỗ nào cần đăng nhập giả thì tự bỏ qua nếu
// server không cho (bản công khai không có đăng nhập giả).

import { chromium } from 'playwright';

const GỐC = process.argv[2] ?? 'http://localhost:5173';
const kq = [];
const ghi = (tên, ok, thêm = '') => {
  kq.push({ tên, ok });
  console.log(`${ok ? 'OK  ' : 'HỎNG'}  ${tên}${thêm ? ` — ${thêm}` : ''}`);
};

const b = await chromium.launch();
const lỗiJS = [];

async function mở(tên) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 860 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => lỗiJS.push(`${tên}: ${e.message.slice(0, 140)}`));
  await p.goto(`${GỐC}/#/`, { waitUntil: 'networkidle', timeout: 60000 });
  const có = await p.evaluate(async (g) => {
    const r = await fetch(`${g}/api/me`, { credentials: 'same-origin' }).catch(() => null);
    return r?.ok ? (await r.json()).devAuth : false;
  }, GỐC);
  if (có) {
    await p.evaluate(
      (n) =>
        fetch('/api/auth/dev', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: n }),
        }),
      tên,
    );
    await p.reload({ waitUntil: 'networkidle' });
  }
  return { ctx, p, đăngNhập: có };
}

const ô = async (p, sq) => {
  const r = await p.locator('#board svg').boundingBox();
  const f = sq.charCodeAt(0) - 97;
  const h = Number(sq[1]) - 1;
  const lật = await p.evaluate(() => document.querySelector('.game-board .player')?.textContent?.includes('') ?? false);
  void lật;
  return { x: r.x + (f + 0.5) * (r.width / 8), y: r.y + (7 - h + 0.5) * (r.height / 8) };
};
const kéo = async (p, từ, tới) => {
  const a = await ô(p, từ);
  const c = await ô(p, tới);
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move(c.x, c.y, { steps: 6 });
  await p.mouse.up();
};

/* 1. Sảnh là bàn cờ, chơi được ngay */
const A = await mở('E2E-A');
await A.p.waitForSelector('#board svg', { timeout: 30000 });
ghi('sảnh hiện bàn cờ ngay', (await A.p.locator('#board svg').count()) === 1);

await A.p.locator('[data-level="1"]').click();
await A.p.getByRole('button', { name: 'Chơi', exact: true }).click();
await A.p.waitForTimeout(400);
await kéo(A.p, 'e2', 'e4');
await A.p.waitForTimeout(3000);
const sốNước = await A.p.evaluate(() => document.querySelectorAll('.move-list .move:not(.move-empty)').length);
ghi('chơi với máy: mình đi, máy đáp', sốNước >= 2, `${sốNước} nước`);
ghi('tên khai cuộc hiện lúc đang đánh', (await A.p.locator('.opening-line').count()) > 0);

/* 2. Xem lại ván (cần đăng nhập để có ván đã lưu) */
if (A.đăngNhập) {
  const id = await A.p.evaluate(async () => {
    await fetch('/api/games', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'bot',
        level: 1,
        playerSide: 'w',
        winner: 'b',
        reason: 'checkmate',
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3#',
      }),
    });
    const g = await (await fetch('/api/games', { credentials: 'same-origin' })).json();
    return g.games[0].id;
  });
  await A.p.goto(`${GỐC}/#/xem-lai?game=${id}`, { waitUntil: 'networkidle' });
  const chấmXong = await A.p
    .waitForFunction(() => /chính xác/i.test(document.body.innerText), null, { timeout: 120000 })
    .then(() => true)
    .catch(() => false);
  ghi('xem lại: engine chấm xong cả ván', chấmXong);
}

/* 3. Ôn tập */
await A.p.goto(`${GỐC}/#/on-tap`, { waitUntil: 'networkidle' });
const cóBài = await A.p
  .waitForSelector('#board svg', { timeout: 30000 })
  .then(() => true)
  .catch(() => false);
ghi('ôn tập: lấy được bài tập', cóBài);

/* 4. Đấu online hai người (cần đăng nhập giả) */
if (A.đăngNhập) {
  const B = await mở('E2E-B');
  for (const x of [A, B]) {
    await x.p.goto(`${GỐC}/#/ban`, { waitUntil: 'networkidle' });
    await x.p.reload({ waitUntil: 'networkidle' });
  }
  await A.p.getByRole('button', { name: 'Tìm trận', exact: true }).click();
  await B.p.getByRole('button', { name: 'Tìm trận', exact: true }).click();
  const ghép = await A.p
    .waitForSelector('#board svg', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  ghi('đấu online: ghép được hai người', ghép);

  if (ghép) {
    const st = await A.p.evaluate(async () => (await (await fetch('/api/live/status', { credentials: 'same-origin' })).json()).state);
    const trắng = st.youAre === 'w' ? A : B;
    await kéo(trắng.p, 'e2', 'e4');
    await A.p.waitForTimeout(1200);
    const sau = await A.p.evaluate(async () => (await (await fetch('/api/live/status', { credentials: 'same-origin' })).json()).state);
    ghi('đấu online: đi được một nước', sau.history.length === 1, sau.history.join(' '));

    const chặn = await A.p.evaluate(async () => {
      const r = await fetch('/api/advisor/explain', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ facts: { ben: 'Trắng', nuocDaDi: '1.e4', xepLoai: 'Tốt', nuocTotHon: [], dongChinh: [], the: [] } }),
      });
      return r.status;
    });
    ghi('đang trong ván online thì server chặn lời bình', chặn === 403, `HTTP ${chặn}`);
  }
  await B.ctx.close();
}

ghi('không có lỗi JS nào', lỗiJS.length === 0, lỗiJS.join(' | '));
await b.close();

const hỏng = kq.filter((k) => !k.ok);
console.log(`\n${kq.length - hỏng.length}/${kq.length} mục đạt.`);
process.exit(hỏng.length ? 1 : 0);
