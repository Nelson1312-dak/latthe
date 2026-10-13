/**
 * worker/do-gop-tin.mjs — đo xem DNSE gộp bao nhiêu lệnh khớp vào một bản tin.
 *
 *   node --env-file=.env.local worker/do-gop-tin.mjs [YYYY-MM-DD] [--ma FPT,HPG]
 *
 * Vì sao cần đo: nếu DNSE gửi đủ từng lệnh khớp thì làm được việc tách dòng tiền theo quy mô lệnh
 * (tiền lớn hay tiền nhỏ đang mua) và dò lệnh kê ảo. Nếu dữ liệu đã bị gộp thì hai việc đó không
 * làm được, và mọi thống kê phải dựa vào vol_delta chứ không phải match_qty.
 *
 * Cách đo: mỗi bản tin tick mang match_qty (khối lượng lệnh khớp DNSE báo) và vol_delta (chênh lệch
 * khối lượng luỹ kế = khối lượng THẬT đã khớp từ bản tin trước). Nếu nhận đủ từng lệnh thì hai số
 * này bằng nhau. vol_delta / match_qty chính là số lệnh trung bình bị gộp vào một bản tin.
 */
import { rest } from '../api/_db.js';

const args = process.argv.slice(2);
const ngay = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date().toISOString().slice(0, 10);
const i = args.indexOf('--ma');
const loc = i >= 0 && args[i + 1] ? args[i + 1].toUpperCase().split(',') : null;

const f = (n, d = 0) => (n == null ? '—' : n.toLocaleString('vi-VN', { maximumFractionDigits: d }));

async function tai() {
  const rows = [];
  const buoc = 10000;
  for (let tu = 0; ; tu += buoc) {
    const q = `/tape?at=gte.${ngay}T00:00:00Z&at=lt.${ngay}T23:59:59Z&select=symbol,at,match_qty,vol_delta,side`
      + (loc ? `&symbol=in.(${loc.join(',')})` : '') + `&order=symbol,at&limit=${buoc}&offset=${tu}`;
    const r = await rest(q, { role: 'app_worker' });
    rows.push(...r);
    if (r.length < buoc) break;
  }
  return rows;
}

const rows = await tai();
if (!rows.length) {
  console.log(`Chưa có dữ liệu băng lệnh cho ngày ${ngay}.`);
  console.log('Worker giá phải đang chạy và phiên phải đã mở thì mới có.');
  process.exit(0);
}

const theoMa = new Map();
for (const r of rows) {
  const m = theoMa.get(r.symbol) || { tin: 0, match: 0, delta: 0, coDelta: 0, M: 0, B: 0, '?': 0, dau: r.at, cuoi: r.at };
  m.tin++;
  if (r.match_qty != null) m.match += r.match_qty;
  if (r.vol_delta != null) { m.delta += r.vol_delta; m.coDelta++; }
  m[r.side] = (m[r.side] || 0) + 1;
  m.cuoi = r.at;
  theoMa.set(r.symbol, m);
}

const tong = { tin: 0, match: 0, delta: 0, M: 0, B: 0, '?': 0 };
for (const m of theoMa.values()) { tong.tin += m.tin; tong.match += m.match; tong.delta += m.delta; tong.M += m.M; tong.B += m.B; tong['?'] += m['?']; }

console.log(`\nNgày ${ngay} — ${f(theoMa.size)} mã, ${f(tong.tin)} bản tin tick\n`);
console.log('MỨC GỘP TIN');
const gop = tong.match ? tong.delta / tong.match : null;
console.log(`  Khối lượng thật (tổng vol_delta):      ${f(tong.delta)}`);
console.log(`  Khối lượng DNSE báo (tổng match_qty):  ${f(tong.match)}`);
console.log(`  => trung bình ${gop == null ? '—' : gop.toFixed(2)} lệnh gộp vào một bản tin`);
if (gop != null) {
  if (gop < 1.15) console.log('  => NHẬN GẦN ĐỦ TỪNG LỆNH. Tách dòng tiền theo quy mô lệnh và dò lệnh kê ảo đều khả thi.');
  else if (gop < 3) console.log('  => GỘP NHẸ. Thống kê theo ngày tin được; tách theo quy mô lệnh thì không chính xác.');
  else console.log('  => GỘP NHIỀU. Không tách được theo quy mô lệnh; mọi thống kê phải dùng vol_delta, không dùng match_qty.');
}

const giay = (m) => (Date.parse(m.cuoi) - Date.parse(m.dau)) / 1000;
const nhip = [...theoMa.values()].filter((m) => m.tin > 1).map((m) => giay(m) / (m.tin - 1)).sort((a, b) => a - b);
if (nhip.length) {
  console.log(`\nNHỊP GỬI TIN (giây giữa hai bản tin của cùng một mã)`);
  console.log(`  nhanh nhất ${nhip[0].toFixed(1)}s | giữa ${nhip[Math.floor(nhip.length / 2)].toFixed(1)}s | chậm nhất ${nhip[nhip.length - 1].toFixed(1)}s`);
}

console.log(`\nBÊN CHỦ ĐỘNG: mua ${f(tong.M)} | bán ${f(tong.B)} | không xác định ${f(tong['?'])}`
  + ` (${((tong['?'] / tong.tin) * 100).toFixed(1)}% không rõ)`);
if (tong['?'] / tong.tin > 0.2) console.log('  Tỷ lệ không rõ cao: thường do bản tin tick tới trước bản tin sổ lệnh đầu tiên của mã.');

const top = [...theoMa.entries()].sort((a, b) => b[1].tin - a[1].tin).slice(0, 15);
console.log(`\n15 MÃ NHIỀU TIN NHẤT`);
console.log('  mã      bản tin   mức gộp   KL thật      mua/bán');
for (const [s, m] of top) {
  const g = m.match ? (m.delta / m.match).toFixed(1) : '—';
  console.log(`  ${s.padEnd(7)} ${String(m.tin).padStart(7)}   ${String(g).padStart(7)}   ${f(m.delta).padStart(11)}   ${m.M}/${m.B}`);
}
console.log();
