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

// ---- 6. Bảng chấm điểm bị NHÂN BẢN giữa generator và app phải khớp ----
// Trang SEO tĩnh và công cụ tương tác chấm điểm bằng HAI bản code riêng. Lệch
// nhau thì trang /ngay-tot/thang-X nói ngày A tốt còn công cụ nói ngày A xấu —
// sai NỘI DUNG chứ không phải lỗi kỹ thuật, nên không có cách nào tự lộ ra.
// Kiểm tháng 10/2026: cả hai cặp đang khớp, nhưng TRƯỚC ĐÓ KHÔNG CÓ GÌ CANH.
{
  // Cắt một khối {...} cân bằng ngoặc kể từ vị trí `from`.
  const block = (src, from) => {
    const s = src.indexOf('{', from);
    if (s < 0) return null;
    let d = 0;
    for (let i = s; i < src.length; i++) {
      if (src[i] === '{') d++;
      else if (src[i] === '}' && --d === 0) return src.slice(s, i + 1);
    }
    return null;
  };
  // Bỏ chú thích + gộp khoảng trắng: chỉ so LOGIC, không bắt bẻ thụt lề/xuống dòng.
  const norm = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // (a) TRUC_INFO: chỉ so good/bad — đó mới là nghĩa vụ đồng bộ. app.js còn có
  // thêm trường `desc` (văn xuôi hiện trên UI) mà trang tĩnh không dùng; so cả
  // khối sẽ BÁO NHẦM (đã cắn đúng lỗi này lúc dựng guard — sai 878 vs 1972 ký
  // tự trong khi good/bad giống hệt). Guard báo nhầm còn tệ hơn không có guard.
  {
    const srcA = readFileSync(join(ROOT, 'scripts/build-ngaytot-pages.mjs'), 'utf8');
    const srcB = readFileSync(join(ROOT, 'ngay-tot/js/app.js'), 'utf8');
    const objOf = (src, label) => {
      const m = src.match(/const TRUC_INFO\s*=/);
      if (!m) { bad(`TRUC_INFO: không định vị được trong ${label} — guard đã mục, sửa regex`); return null; }
      const blk = block(src, m.index);
      try { return new Function(`return ${blk};`)(); }
      catch (e) { bad(`TRUC_INFO: không parse được ở ${label} (${e.message})`); return null; }
    };
    const A = objOf(srcA, 'generator');
    const B = objOf(srcB, 'app.js');
    if (A && B) {
      const slim = (o) => Object.fromEntries(Object.entries(o)
        .map(([k, v]) => [k, { good: [...(v.good || [])].sort(), bad: [...(v.bad || [])].sort() }]));
      const sA = JSON.stringify(slim(A));
      const sB = JSON.stringify(slim(B));
      if (sA !== sB) {
        const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])];
        const diff = keys.filter(k => JSON.stringify(slim(A)[k]) !== JSON.stringify(slim(B)[k]));
        bad(`TRUC_INFO good/bad LỆCH ở trực: ${diff.join(', ')} — đồng bộ scripts/build-ngaytot-pages.mjs với ngay-tot/js/app.js`);
      }
    }
  }

  // (b) Công thức độ hợp hoàng đạo: hai bản là bản sao thuần, so nguyên thân hàm.
  {
    const srcA = readFileSync(join(ROOT, 'scripts/build-hoangdao-pages.mjs'), 'utf8');
    const srcB = readFileSync(join(ROOT, 'hoang-dao/js/app.js'), 'utf8');
    const mA = srcA.match(/function matchOf\s*\([^)]*\)/);
    const mB = srcB.match(/function compat\s*\([^)]*\)/);
    if (!mA || !mB) bad(`công thức độ hợp: không định vị được hàm trong ${!mA ? 'generator' : 'app.js'} — guard đã mục`);
    else {
      const bA = block(srcA, mA.index), bB = block(srcB, mB.index);
      if (!bA || !bB) bad('công thức độ hợp: không cắt được thân hàm');
      else if (norm(bA) !== norm(bB))
        bad('công thức độ hợp hoàng đạo LỆCH — đồng bộ matchOf() (generator) với compat() (hoang-dao/js/app.js)');
    }
  }

  // Hằng số 1 dòng: so trực tiếp.
  const ngSrc = readFileSync(join(ROOT, 'scripts/build-ngaytot-pages.mjs'), 'utf8');
  const appSrc = readFileSync(join(ROOT, 'ngay-tot/js/app.js'), 'utf8');
  for (const name of ['TAM_NUONG', 'NGUYET_KY']) {
    const re = new RegExp(`const ${name}\\s*=\\s*new Set\\(\\[([^\\]]*)\\]`);
    const x = ngSrc.match(re)?.[1];
    const y = appSrc.match(re)?.[1];
    if (x == null || y == null) bad(`${name}: không đọc được ở ${x == null ? 'generator' : 'app.js'}`);
    else if (norm(x) !== norm(y)) bad(`${name} LỆCH: generator [${norm(x)}] vs app.js [${norm(y)}]`);
  }

  if (!errors) console.log('Bảng chấm điểm nhân bản: ngay-tot + hoang-dao khớp ✓');
}

if (errors) {
  console.error(`\nFAIL — ${errors} lỗi hạ tầng`);
  process.exit(1);
}
console.log('\nPASS — hạ tầng tĩnh sạch ✓');
