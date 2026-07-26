/**
 * scripts/verify-amlich.mjs — kiểm tra engine js/amlich.js.
 *
 * Đây là lưới an toàn cho hai thứ:
 *   1. Engine mới (đổi ngày 2 chiều, 24 tiết khí, can chi, nạp âm)
 *   2. Bản vá convertLunar2Solar trong tuvi/js/tuvi.js (bug tháng âm 11-12)
 *
 * Chạy: npm run test:amlich    (exit ≠ 0 nếu có assertion sai)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Nạp engine đúng cách mà các build script vẫn nạp
const W = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'js', 'amlich.js'), 'utf8'))(W);
const A = W.AmLich;

let pass = 0;
const fails = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; return; }
  fails.push(`${name}${detail ? ' — ' + detail : ''}`);
}
const eq = (name, actual, expected) =>
  ok(name, JSON.stringify(actual) === JSON.stringify(expected),
     `được ${JSON.stringify(actual)}, cần ${JSON.stringify(expected)}`);

const dmy = (o) => o && `${o.day}/${o.month}/${o.year}`;

// ─────────────────────────────────────────────────────────────
console.log('── Đổi ngày âm ↔ dương ──');

// Tết
eq('Tết Bính Ngọ 17/2/2026 → 1/1 âm',
   (({ day, month, year }) => ({ day, month, year }))(A.solar2lunar(17, 2, 2026)),
   { day: 1, month: 1, year: 2026 });
eq('Giao thừa 16/2/2026 → 29/12 âm Ất Tỵ',
   (({ day, month, year }) => ({ day, month, year }))(A.solar2lunar(16, 2, 2026)),
   { day: 29, month: 12, year: 2025 });
eq('Tết Đinh Mùi 6/2/2027 → 1/1 âm',
   (({ day, month, year }) => ({ day, month, year }))(A.solar2lunar(6, 2, 2027)),
   { day: 1, month: 1, year: 2027 });
ok('lunar2solar 1/1/2026 → 17/2/2026', dmy(A.lunar2solar(1, 1, 2026)) === '17/2/2026', dmy(A.lunar2solar(1, 1, 2026)));
ok('lunar2solar 1/1/2027 → 6/2/2027', dmy(A.lunar2solar(1, 1, 2027)) === '6/2/2027', dmy(A.lunar2solar(1, 1, 2027)));

// Hồi quy đúng bug đã vá: tháng âm 11-12
ok('HỒI QUY tháng 11: lunar2solar(1,11,2026) → 9/12/2026',
   dmy(A.lunar2solar(1, 11, 2026)) === '9/12/2026', dmy(A.lunar2solar(1, 11, 2026)));
ok('HỒI QUY tháng 12: lunar2solar(1,12,2026) → 8/1/2027',
   dmy(A.lunar2solar(1, 12, 2026)) === '8/1/2027', dmy(A.lunar2solar(1, 12, 2026)));

// Tháng nhuận
ok('Nhuận: 1/6/2025 thường → 25/6/2025', dmy(A.lunar2solar(1, 6, 2025, 0)) === '25/6/2025', dmy(A.lunar2solar(1, 6, 2025, 0)));
ok('Nhuận: 1/6/2025 nhuận → 25/7/2025', dmy(A.lunar2solar(1, 6, 2025, 1)) === '25/7/2025', dmy(A.lunar2solar(1, 6, 2025, 1)));
ok('Nhuận không tồn tại: 1/7/2025 nhuận → null', A.lunar2solar(1, 7, 2025, 1) === null);

// Năm nhuận 2020-2033
const LEAP_EXPECT = { 2020: 4, 2023: 2, 2025: 6, 2028: 5, 2031: 3 };
let leapOk = true, leapDetail = [];
for (let y = 2020; y <= 2033; y++) {
  const r = A.isLeapYear(y);
  const want = LEAP_EXPECT[y] || 0;
  const got = r.hasLeap ? r.leapMonth : 0;
  if (got !== want) { leapOk = false; leapDetail.push(`${y}: được ${got}, cần ${want}`); }
}
ok('Năm nhuận 2020-2033 đúng bảng', leapOk, leapDetail.join('; '));

// Số ngày tháng âm + chặn tràn
ok('lunarMonthDays(12,2025) = 29', A.lunarMonthDays(12, 2025) === 29, String(A.lunarMonthDays(12, 2025)));

// ─────────────────────────────────────────────────────────────
console.log('── Round-trip 1900-2100 (test neo) ──');
let rtTotal = 0, rtBad = 0, rtSample = [];
for (let jdn = A.jdFromDate(1, 1, 1900); jdn <= A.jdFromDate(31, 12, 2100); jdn++) {
  const g = A.jdToDate(jdn);
  const L = A.solar2lunar(g.day, g.month, g.year);
  const back = A.lunar2solar(L.day, L.month, L.year, L.leap);
  rtTotal++;
  if (!back || back.jdn !== jdn) {
    rtBad++;
    if (rtSample.length < 3) rtSample.push(`${g.day}/${g.month}/${g.year} → ${L.day}/${L.month}/${L.year}${L.leap ? ' nhuận' : ''} → ${dmy(back)}`);
  }
}
ok(`Round-trip ${rtTotal} ngày, 0 sai`, rtBad === 0, `${rtBad} sai: ${rtSample.join(' | ')}`);

// ─────────────────────────────────────────────────────────────
console.log('── Can chi / nạp âm ──');
eq('1/1/2000 là ngày Mậu Ngọ', A.dayCanChi(A.jdFromDate(1, 1, 2000)).text, 'Mậu Ngọ');
eq('Năm 1984 nạp âm Hải Trung Kim', A.napAmOfYear(1984).name, 'Hải Trung Kim');
eq('Năm 2026 (Bính Ngọ) nạp âm Thiên Hà Thủy', A.napAmOfYear(2026).name, 'Thiên Hà Thủy');
eq('Năm 2026 can chi Bính Ngọ', A.yearCanChi(2026).text, 'Bính Ngọ');
eq('Ngũ hành tách từ nạp âm', A.napAmOfYear(2026).element, 'Thủy');
ok('sexagenary 1/1/2000 = 54', A.sexagenaryOfDay(A.jdFromDate(1, 1, 2000)) === 54, String(A.sexagenaryOfDay(A.jdFromDate(1, 1, 2000))));

console.log('── Ngày kiêng / hướng ──');
ok('Dương công 13/1 âm', A.duongCongKyNhat(13, 1) === true);
ok('Dương công 1/7 và 29/7 âm', A.duongCongKyNhat(1, 7) && A.duongCongKyNhat(29, 7));
ok('14/1 âm KHÔNG phải Dương công', A.duongCongKyNhat(14, 1) === false);
eq('Hỷ thần ngày Giáp', A.huongXuatHanh(0, A.jdFromDate(1, 1, 2000)).hyThan, 'Đông Bắc');
eq('Hỷ thần ngày Đinh', A.huongXuatHanh(3, A.jdFromDate(1, 1, 2000)).hyThan, 'Chính Nam');

// ─────────────────────────────────────────────────────────────
console.log('── 24 tiết khí (assert NGÀY, không assert giờ: mô hình sai số ~±10 phút) ──');
const tk = (y) => Object.fromEntries(A.tietKhiOfYear(y).map((t) => [t.name, `${t.day}/${t.month}`]));
const T26 = tk(2026), T27 = tk(2027);

ok('2026 đủ 24 tiết', Object.keys(T26).length === 24, String(Object.keys(T26).length));
eq('Lập Xuân 2026', T26['Lập Xuân'], '4/2');
eq('Xuân Phân 2026', T26['Xuân Phân'], '20/3');
eq('Hạ Chí 2026', T26['Hạ Chí'], '21/6');
eq('Thu Phân 2026', T26['Thu Phân'], '23/9');
// UTC là 21/12 nhưng giờ VN sang 22/12 — ca kiểm tra biên múi giờ
eq('Đông Chí 2026 (biên múi giờ)', T26['Đông Chí'], '22/12');
eq('Lập Xuân 2027', T27['Lập Xuân'], '4/2');
// UTC 20/3 nhưng giờ VN sang 21/3 — biên múi giờ thứ hai
eq('Xuân Phân 2027 (biên múi giờ)', T27['Xuân Phân'], '21/3');
eq('Đông Chí 2027', T27['Đông Chí'], '22/12');

// Tính nhất quán: tiết khí phải tăng dần theo jdn và cách nhau 14-16 ngày
const seq = A.tietKhiOfYear(2026);
let gapOk = true, gapDetail = [];
for (let i = 1; i < seq.length; i++) {
  const gap = seq[i].jdn - seq[i - 1].jdn;
  if (gap < 14 || gap > 17) { gapOk = false; gapDetail.push(`${seq[i - 1].name}→${seq[i].name}: ${gap} ngày`); }
}
ok('Khoảng cách giữa các tiết 14-17 ngày', gapOk, gapDetail.join('; '));
ok('tietKhiOfYear sắp theo thời gian', seq.every((t, i) => i === 0 || t.jdn > seq[i - 1].jdn));

// tietKhiOfDay khớp với tietKhiOfYear
const lx = A.tietKhiStart(21, 2026);                       // Lập Xuân 2026
const atStart = A.tietKhiOfDay(lx.jdn);
eq('tietKhiOfDay đúng ngày bắt đầu Lập Xuân', atStart.name, 'Lập Xuân');
ok('isStartDay = true tại ngày bắt đầu', atStart.isStartDay === true);
eq('Hôm trước Lập Xuân là Đại Hàn', A.tietKhiOfDay(lx.jdn - 1).name, 'Đại Hàn');

// ─────────────────────────────────────────────────────────────
console.log('── Không hồi quy: engine mới == engine cũ (ngay-tot/js/amlich.js) ──');
const OLD_PATH = process.env.AMLICH_OLD || path.join(ROOT, 'scripts', '.amlich-old-snapshot.js');
if (fs.existsSync(OLD_PATH)) {
  const W2 = {};
  new Function('window', fs.readFileSync(OLD_PATH, 'utf8'))(W2);
  const O = W2.AmLich;
  let regBad = 0, regSample = [];
  for (let jdn = A.jdFromDate(1, 1, 2026); jdn <= A.jdFromDate(31, 12, 2026); jdn++) {
    const g = A.jdToDate(jdn);
    const a = A.solar2lunar(g.day, g.month, g.year);
    const b = O.solar2lunar(g.day, g.month, g.year);
    const same = JSON.stringify(a) === JSON.stringify(b)
      && A.dayCanChi(jdn).text === O.dayCanChi(jdn).text
      && A.trucOfDay(A.dayCanChi(jdn).chi, a.month) === O.trucOfDay(O.dayCanChi(jdn).chi, b.month)
      && JSON.stringify(A.dayGod(A.dayCanChi(jdn).chi, a.month)) === JSON.stringify(O.dayGod(O.dayCanChi(jdn).chi, b.month))
      && JSON.stringify(A.goodHoursOfDay(A.dayCanChi(jdn).chi)) === JSON.stringify(O.goodHoursOfDay(O.dayCanChi(jdn).chi));
    if (!same) { regBad++; if (regSample.length < 3) regSample.push(`${g.day}/${g.month}/${g.year}`); }
  }
  ok('365 ngày 2026 khớp hoàn toàn engine cũ', regBad === 0, `${regBad} ngày lệch: ${regSample.join(', ')}`);
} else {
  console.log(`   (bỏ qua — không thấy snapshot engine cũ tại ${path.relative(ROOT, OLD_PATH)})`);
}

// ─────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(58)}`);
if (fails.length) {
  console.log(`${pass} PASS · ${fails.length} FAIL\n`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log(`${pass}/${pass} PASS ✓`);
