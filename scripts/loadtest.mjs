// Thử tải: 10 ván online cùng lúc + 5 người xin lời bình cùng lúc.
// Chạy: node scripts/loadtest.mjs [địa-chỉ]   (mặc định http://127.0.0.1:8787)
//
// Phải chạy với server bật AUTH_DEV=1 và gọi TỪ CHÍNH MÁY NÀY, vì script tạo
// tài khoản bằng đăng nhập giả — qua tunnel thì server từ chối (đúng như thiết kế).
//
// Không dùng trình duyệt: 20 trình duyệt cùng lúc là đo máy chạy test chứ
// không đo server. Ở đây gọi thẳng HTTP, đúng phần mình muốn biết có chịu nổi không.

const GỐC = process.argv[2] ?? 'http://127.0.0.1:8787';
const SỐ_VÁN = Number(process.env.LOAD_GAMES ?? 10);
const SỐ_LỜI_BÌNH = Number(process.env.LOAD_ADVISOR ?? 5);
const SỐ_NƯỚC = Number(process.env.LOAD_MOVES ?? 10);

const đo = [];
async function gọi(đường, tùy = {}, nhãn = đường) {
  const t0 = performance.now();
  const res = await fetch(GỐC + đường, tùy);
  const ms = performance.now() - t0;
  đo.push({ nhãn, ms, ok: res.ok });
  const body = await res.json().catch(() => ({}));
  return { res, body, ms };
}

async function tạoNgười(tên) {
  const res = await fetch(`${GỐC}/api/auth/dev`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: tên }),
  });
  if (!res.ok) throw new Error(`Không tạo được tài khoản (${res.status}). Server có bật AUTH_DEV=1 không?`);
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
  return { tên, cookie };
}

const kèm = (ng, thêm = {}) => ({ headers: { cookie: ng.cookie, 'content-type': 'application/json', ...thêm } });

/** Mười nước khai cuộc hợp lệ cho cả hai bên, đủ để chạy máy trạng thái. */
const NƯỚC = [
  ['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'c4'],
  ['g8', 'f6'], ['d2', 'd3'], ['f8', 'c5'], ['b1', 'c3'], ['d7', 'd6'],
];

/**
 * Mỗi người chơi là một vòng lặp riêng: nhìn thế cờ, tới lượt mình thì đi.
 *
 * Bản đầu mình cho `a` và `b` vào hàng chờ rồi ĐOÁN là hai đứa ghép với nhau.
 * Sai: cả 20 người cùng Elo, cùng thể thức, nên server ghép ai với ai tuỳ nó —
 * a1 có thể gặp b7. Thế là bên nào cũng tưởng mình cầm Trắng và 30% số nước bị
 * từ chối. Giờ không đoán nữa, cứ đọc `state` để biết mình là bên nào.
 */
async function mộtNgườiChơi(ng) {
  let đãĐi = 0;
  for (let vòng = 0; vòng < 80; vòng++) {
    const r = await gọi('/api/live/status', kèm(ng), 'xem trạng thái');
    const st = r.body.state;
    if (!st) {
      await new Promise((x) => setTimeout(x, 200));
      continue;
    }
    if (st.over) break;
    const ply = st.history.length;
    if (ply >= SỐ_NƯỚC) break;
    if (st.turn !== st.youAre) {
      await new Promise((x) => setTimeout(x, 120));
      continue;
    }
    const [từ, tới] = NƯỚC[ply];
    const kq = await gọi(
      '/api/live/act',
      { method: 'POST', ...kèm(ng), body: JSON.stringify({ what: 'move', from: từ, to: tới }) },
      'đi một nước',
    );
    if (kq.res.ok) đãĐi++;
    else await new Promise((x) => setTimeout(x, 120));
  }
  return đãĐi;
}

/** Dựng 2×SỐ_VÁN người, cho vào hàng chờ, rồi để họ tự đánh. */
async function tấtCảVán() {
  const người = await Promise.all(
    Array.from({ length: SỐ_VÁN * 2 }, (_, i) => tạoNgười(`Tai-${i}`)),
  );
  await Promise.all(
    người.map((ng) =>
      gọi('/api/live/queue', { method: 'POST', ...kèm(ng), body: JSON.stringify({ control: '10+0' }) }, 'vào hàng chờ'),
    ),
  );
  const đi = await Promise.all(người.map((ng) => mộtNgườiChơi(ng)));
  // Đếm xem thực sự ghép được bao nhiêu ván
  const phòng = new Set();
  for (const ng of người) {
    const r = await gọi('/api/live/status', kèm(ng), 'xem trạng thái');
    if (r.body.state) phòng.add(r.body.state.id);
  }
  await Promise.all(
    người.map((ng) => gọi('/api/live/act', { method: 'POST', ...kèm(ng), body: JSON.stringify({ what: 'resign' }) }, 'đầu hàng')),
  );
  return { sốVán: phòng.size, sốNước: đi.reduce((x, y) => x + y, 0) };
}

async function mộtLờiBình(i) {
  const ng = await tạoNgười(`Binh-${i}`);
  // Đúng hình dạng Facts thật (xem shared/advisor/facts.ts)
  const facts = {
    ben: 'Trắng',
    nuocDaDi: '11.Qg4',
    xepLoai: 'Sai nghiêm trọng',
    nuocTotHon: ['Qd1'],
    dongChinh: ['Qd1', 'Nf6'],
    the: [{ kind: 'hanging', square: 'g4', piece: 'Hậu' }],
    suThat: 'Hậu ở g4 đang không ai bảo vệ.',
  };
  const r = await gọi('/api/advisor/explain', { method: 'POST', ...kèm(ng), body: JSON.stringify({ facts }) }, 'xin lời bình');
  return r.body.source ?? (r.res.ok ? 'ok' : `lỗi ${r.res.status}`);
}

const t0 = performance.now();
console.log(`Thử tải ${GỐC}: ${SỐ_VÁN} ván cùng lúc, ${SỐ_LỜI_BÌNH} lời bình cùng lúc.\n`);

const [ván, bình] = await Promise.all([
  tấtCảVán(),
  Promise.allSettled(Array.from({ length: SỐ_LỜI_BÌNH }, (_, i) => mộtLờiBình(i))),
]);

console.log(`Ván: ghép được ${ván.sốVán}/${SỐ_VÁN}, tổng ${ván.sốNước} nước đi.`);
const nguồn = bình.map((r) => (r.status === 'fulfilled' ? r.value : `hỏng: ${r.reason.message}`));
console.log(`Lời bình: ${bình.filter((r) => r.status === 'fulfilled').length}/${SỐ_LỜI_BÌNH} — nguồn: ${nguồn.join(', ')}`);

// Thống kê độ trễ theo từng loại việc
const theoNhãn = new Map();
for (const d of đo) {
  const l = theoNhãn.get(d.nhãn) ?? [];
  l.push(d.ms);
  theoNhãn.set(d.nhãn, l);
}
console.log('\nĐộ trễ (ms):');
for (const [nhãn, ms] of [...theoNhãn].sort()) {
  ms.sort((x, y) => x - y);
  const p = (q) => Math.round(ms[Math.min(ms.length - 1, Math.floor(ms.length * q))]);
  console.log(`  ${nhãn.padEnd(16)} n=${String(ms.length).padStart(4)}  trung vị ${String(p(0.5)).padStart(5)}  p95 ${String(p(0.95)).padStart(5)}  chậm nhất ${String(p(1)).padStart(5)}`);
}
const lỗi = đo.filter((d) => !d.ok).length;
console.log(`\nTổng ${đo.length} lượt gọi, ${lỗi} lượt không ok, hết ${((performance.now() - t0) / 1000).toFixed(1)} giây.`);
