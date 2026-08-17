/**
 * scripts/build-daily-data.mjs
 * Sinh /js/daily-data.js — bản compact 64 quẻ + 78 lá tarot cho widget "Vận Hôm Nay"
 * (trang chủ không thể load hexagrams.js 53KB + cards*.js 47KB đầy đủ).
 * Chạy lại khi dữ liệu gốc đổi: node scripts/build-daily-data.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function evalGlobals(code, names) {
  const fn = new Function(code + `; return { ${names.join(', ')} };`);
  return fn();
}

function slugify(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function firstSentence(str) {
  const m = str.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : str).trim();
}

// ---- 64 quẻ ----
const { HEXAGRAMS } = evalGlobals(
  readFileSync(join(ROOT, 'gieoque/js/hexagrams.js'), 'utf8'), ['HEXAGRAMS']);
const hex = Object.entries(HEXAGRAMS).map(([n, h]) => ({
  n: parseInt(n),
  vn: h.vn,
  sym: h.symbol,
  m: firstSentence(h.meaning),
  slug: `que-${n}-${slugify(h.vn)}`
}));

// ---- 78 lá tarot (22 major + 56 minor) ----
const { TAROT_CARDS, TAROT_SPREADS } = evalGlobals(
  readFileSync(join(ROOT, 'tarot/js/cards.js'), 'utf8'), ['TAROT_CARDS', 'TAROT_SPREADS']);
const { MINOR_ARCANA } = evalGlobals(
  readFileSync(join(ROOT, 'tarot/js/cards-minor.js'), 'utf8'), ['MINOR_ARCANA']);

const tarot = [
  ...TAROT_CARDS.map(c => ({
    img: String(c.id), vn: c.vn, en: c.name,
    m: firstSentence(c.upright),
    slug: slugify(c.name)
  })),
  ...MINOR_ARCANA.map(c => ({
    img: c.img, vn: c.vn, en: c.name,
    m: firstSentence(c.upright),
    slug: slugify(c.name)
  }))
];

// ---- Chuỗi context cho pre-warm cache "Lá Bài Hôm Nay" (CHỈ đi vào api/_daily.js) ----
// PHẢI khớp TỪNG BYTE với buildTarotContext() ở tarot/js/app.js (spread 'one', lá
// daily LUÔN xuôi), vì (type, question, context) chính là khóa exact-match của
// checkExactMatchCache() trong api/_rag.js. Lệch 1 ký tự = cache không bao giờ hit
// (fail-soft: user vẫn có câu trả lời, chỉ là phải chờ AI). scripts/check-infra.mjs
// so từng byte để chặn drift. KHÔNG nhồi field này vào js/daily-data.js: client
// không cần, +~19KB tải phí.
const DAILY_POS = TAROT_SPREADS.one.positions[0];   // 'Thông điệp'
const dailyCtx = (c) =>
  `• Vị trí "${DAILY_POS}": ${c.vn} (${c.name}) — Xuôi\n  Ý nghĩa: ${c.upright}`;

// Cùng thứ tự với mảng `tarot` ở trên (major rồi minor) → ghép theo index an toàn.
const srcCards = [...TAROT_CARDS, ...MINOR_ARCANA];
if (srcCards.length !== tarot.length) throw new Error('build-daily-data: lệch số lá');
const tarotSrv = tarot.map((t, i) => ({ ...t, ctx: dailyCtx(srcCards[i]) }));

const out = `/**
 * js/daily-data.js — dữ liệu compact cho widget "Vận Hôm Nay" (trang chủ).
 * FILE SINH TỰ ĐỘNG bởi scripts/build-daily-data.mjs — ĐỪNG SỬA TAY.
 */
const DAILY_HEX = ${JSON.stringify(hex)};
const DAILY_TAROT = ${JSON.stringify(tarot)};
`;
writeFileSync(join(ROOT, 'js/daily-data.js'), out);
console.log(`daily-data.js: ${hex.length} quẻ + ${tarot.length} lá, ${out.length} bytes`);

// Bản ES module cho serverless (api/_push.js) import — CÙNG thứ tự mảng để
// seed "quẻ hôm nay" trùng khớp giữa client và server. Dùng .js (không phải
// JSON import) để tương thích mọi phiên bản Node trên Vercel + được bundler trace.
const mod = `// FILE SINH TỰ ĐỘNG bởi scripts/build-daily-data.mjs — ĐỪNG SỬA TAY.\n` +
  `export default ${JSON.stringify({ hex, tarot: tarotSrv })};\n`;
writeFileSync(join(ROOT, 'api/_daily.js'), mod);
console.log(`api/_daily.js: ${mod.length} bytes`);
