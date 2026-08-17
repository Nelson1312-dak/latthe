/**
 * scripts/check-infra.mjs — Guard hạ tầng tĩnh, chạy trước mỗi lần push:
 * 1. Mọi URL trong SW SHELL precache phải trỏ tới file có thật
 *    (1 URL hỏng → SW install fail → PWA/offline chết toàn site).
 * 2. Mọi <loc> trong sitemap phải có trang thật (tránh 404 với Google).
 * 3. Mọi <script src>/<link css> nội bộ trong các index.html phải có file thật.
 * 4. node --check toàn bộ JS thường (bỏ qua ES module có import/export).
 * Exit 1 nếu có lỗi.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;
const bad = (msg) => { console.error('  ✗', msg); errors++; };

// URL nội bộ → đường dẫn file (mô phỏng cleanUrls của Vercel)
function urlToFile(url) {
  const p = url.split('?')[0].split('#')[0];
  const cands = p.endsWith('/')
    ? [p + 'index.html']
    : [p, p + '.html', p + '/index.html'];
  return cands.find(c => existsSync(join(ROOT, c)));
}

// ---- 1. SW precache ----
{
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/)[1];
  const urls = [...shell.matchAll(/'([^']+)'/g)].map(m => m[1]);
  console.log(`SW precache: ${urls.length} URL`);
  for (const u of urls) {
    if (!urlToFile(u)) bad(`SW precache thiếu file: ${u}`);
  }
}

// ---- 2. Sitemap ----
{
  const xml = readFileSync(join(ROOT, 'sitemap-latbai.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>https:\/\/latbai\.vn([^<]*)<\/loc>/g)].map(m => m[1] || '/');
  console.log(`Sitemap: ${locs.length} URL`);
  for (const u of locs) {
    if (!urlToFile(u)) bad(`Sitemap trỏ trang không tồn tại: ${u}`);
  }
}

// ---- 3. Asset nội bộ trong các trang chính ----
{
  const pages = ['index.html'];
  for (const d of readdirSync(ROOT)) {
    const idx = join(ROOT, d, 'index.html');
    if (!d.startsWith('.') && existsSync(idx) && statSync(join(ROOT, d)).isDirectory()) {
      pages.push(`${d}/index.html`);
    }
  }
  console.log(`Asset check: ${pages.length} trang index`);
  for (const page of pages) {
    const html = readFileSync(join(ROOT, page), 'utf8');
    const refs = [
      ...[...html.matchAll(/<script[^>]+src="(\/[^"]+)"/g)].map(m => m[1]),
      ...[...html.matchAll(/<link[^>]+href="(\/[^"]+\.css)"/g)].map(m => m[1]),
    ];
    for (const r of refs) {
      if (r.startsWith('/_vercel/')) continue; // chỉ có trên production
      if (!urlToFile(r)) bad(`${page} tham chiếu thiếu: ${r}`);
    }
  }
}

// ---- 4. Syntax check JS (script thường, bỏ ES module) ----
{
  const jsFiles = [];
  const walk = (dir) => {
    for (const f of readdirSync(join(ROOT, dir))) {
      if (f.startsWith('.') || f === 'node_modules') continue;
      const rel = dir ? `${dir}/${f}` : f;
      const full = join(ROOT, rel);
      if (statSync(full).isDirectory()) {
        if (!['drinking', 'supabase', 'scripts', '.vercel'].includes(f)) walk(rel);
      } else if (f.endsWith('.js') && !f.endsWith('.min.js')) {
        jsFiles.push(rel);
      }
    }
  };
  walk('');
  let checked = 0;
  for (const f of jsFiles) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    if (/^\s*(import|export)\s/m.test(src)) continue; // ES module — node --check không hợp
    try {
      execSync(`node --check "${join(ROOT, f)}"`, { stdio: 'pipe' });
      checked++;
    } catch (e) {
      bad(`Lỗi syntax: ${f}\n${e.stderr?.toString().split('\n').slice(0, 3).join('\n')}`);
    }
  }
  console.log(`Syntax check: ${checked} file JS OK`);
}

// ---- 5. Pre-warm "Lá Bài Hôm Nay": context server dựng phải khớp client ----
// Drift ở đây FAIL-SOFT (cache không hit ⇒ user chờ AI như cũ, không sai nội dung)
// nên nó âm thầm làm mất tính năng nếu không có gác cổng. Chặn 3 loại drift:
//   (a) đổi câu hỏi ở app.js mà quên api/prewarm-daily.js
//   (b) đổi format buildTarotContext() ở app.js
//   (c) sửa cards.js/cards-minor.js mà quên `npm run build:daily`
{
  const appSrc = readFileSync(join(ROOT, 'tarot/js/app.js'), 'utf8');
  const prewarmSrc = readFileSync(join(ROOT, 'api/prewarm-daily.js'), 'utf8');

  // (a) câu hỏi lá daily phải trùng giữa client và pre-warm (là một phần khóa cache)
  const q = prewarmSrc.match(/const DAILY_QUESTION = '([^']+)'/)?.[1];
  if (!q) bad('api/prewarm-daily.js: không đọc được DAILY_QUESTION');
  else if (!appSrc.includes(`'${q}'`))
    bad(`Câu hỏi lá daily lệch: prewarm-daily.js dùng "${q}" nhưng tarot/js/app.js không chứa chuỗi này`);

  // (b) format buildTarotContext() không được đổi mà không sửa dailyCtx() bên generator
  const TPL = '`• Vị trí "${spread.positions[i]}": ${card.vn} (${card.name}) — ${dir}\\n  Ý nghĩa: ${reversed ? card.reversed : card.upright}`';
  if (!appSrc.includes(TPL))
    bad('buildTarotContext() ở tarot/js/app.js đã đổi format — sửa dailyCtx() trong scripts/build-daily-data.mjs rồi chạy `npm run build:daily`');

  // (c) dựng lại chuỗi mong đợi từ NGUỒN GỐC rồi so từng byte với api/_daily.js
  const ev = (code, names) => new Function(code + `; return { ${names.join(', ')} };`)();
  const { TAROT_CARDS, TAROT_SPREADS } = ev(readFileSync(join(ROOT, 'tarot/js/cards.js'), 'utf8'), ['TAROT_CARDS', 'TAROT_SPREADS']);
  const { MINOR_ARCANA } = ev(readFileSync(join(ROOT, 'tarot/js/cards-minor.js'), 'utf8'), ['MINOR_ARCANA']);
  const pos = TAROT_SPREADS.one.positions[0];
  const expected = [...TAROT_CARDS, ...MINOR_ARCANA]
    .map(c => `• Vị trí "${pos}": ${c.vn} (${c.name}) — Xuôi\n  Ý nghĩa: ${c.upright}`);

  const daily = (await import(pathToFileURL(join(ROOT, 'api/_daily.js')).href)).default;
  if (daily.tarot.length !== expected.length) {
    bad(`api/_daily.js có ${daily.tarot.length} lá, nguồn có ${expected.length} — chạy \`npm run build:daily\``);
  } else {
    const i = daily.tarot.findIndex((t, k) => t.ctx !== expected[k]);
    if (i >= 0) bad(`api/_daily.js lỗi thời (lá "${daily.tarot[i].vn}") — chạy \`npm run build:daily\``);
    else console.log('Prewarm daily: context 78 lá khớp client ✓');
  }
}

if (errors) {
  console.error(`\nFAIL — ${errors} lỗi hạ tầng`);
  process.exit(1);
}
console.log('\nPASS — hạ tầng tĩnh sạch ✓');
