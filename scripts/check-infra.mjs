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
import { fileURLToPath } from 'url';
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

if (errors) {
  console.error(`\nFAIL — ${errors} lỗi hạ tầng`);
  process.exit(1);
}
console.log('\nPASS — hạ tầng tĩnh sạch ✓');
