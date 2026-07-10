/**
 * scripts/update-sitemap-lastmod.mjs — lastmod trung thực cho sitemap.
 *
 * Vấn đề: các script build-*-pages.mjs đóng dấu TODAY cho mọi URL mỗi lần
 * regen — 366 trang sinh-ngay "đổi" dù nội dung y nguyên, Google học được
 * rằng lastmod của site không đáng tin và bỏ qua nó.
 *
 * Cách làm: hash nội dung file của từng <loc>; chỉ bump lastmod khi hash đổi.
 * Cache hash + ngày trong scripts/.lastmod-cache.json (commit cùng repo).
 * Lần chạy đầu: giữ nguyên lastmod đang có trong sitemap làm mốc.
 *
 * Chạy SAU mọi lần generate, TRƯỚC khi deploy:
 *   node scripts/update-sitemap-lastmod.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_FILE = path.join(ROOT, 'scripts', '.lastmod-cache.json');
const SITEMAPS = [
  { file: 'sitemap-latbai.xml', origin: 'https://latbai.vn' },
  { file: 'sitemap-gieoque.xml', origin: 'https://gieoque.vn', hostDir: 'gieoque' },
];
const TODAY = new Date().toISOString().slice(0, 10);

// url path → file trên đĩa (vercel cleanUrls: /a/b → a/b.html, /a/ → a/index.html)
function resolveFile(urlPath, hostDir) {
  let p = decodeURIComponent(urlPath);
  if (hostDir && (p === '/' || !fs.existsSync(path.join(ROOT, p.replace(/^\//, ''))))) {
    // gieoque.vn rewrite về thư mục /gieoque/
    p = '/' + hostDir + (p === '/' ? '/' : p);
  }
  const rel = p.replace(/^\//, '');
  const candidates = p.endsWith('/')
    ? [rel + 'index.html']
    : [rel + '.html', rel, rel + '/index.html'];
  for (const c of candidates) {
    const abs = path.join(ROOT, c);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  return null;
}

function sha1(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { /* lần đầu */ }

let bumped = 0, kept = 0, missing = 0;

for (const { file, origin, hostDir } of SITEMAPS) {
  const smPath = path.join(ROOT, file);
  if (!fs.existsSync(smPath)) continue;
  let xml = fs.readFileSync(smPath, 'utf8');

  xml = xml.replace(
    /<url>([\s\S]*?)<\/url>/g,
    (block, inner) => {
      const locM = inner.match(/<loc>([^<]+)<\/loc>/);
      const lmM = inner.match(/<lastmod>([^<]+)<\/lastmod>/);
      if (!locM || !lmM) return block;
      const loc = locM[1].trim();
      const urlPath = loc.replace(origin, '') || '/';
      const fp = resolveFile(urlPath, hostDir);
      if (!fp) { missing++; console.warn('  ! không tìm thấy file cho', loc); return block; }

      const hash = sha1(fs.readFileSync(fp));
      const prev = cache[loc];
      let date;
      if (!prev) {
        // lần đầu thấy URL này: giữ lastmod hiện có làm mốc, ghi hash
        date = lmM[1].trim();
      } else if (prev.hash !== hash) {
        date = TODAY;
        bumped++;
      } else {
        date = prev.date;
        kept++;
      }
      cache[loc] = { hash, date };
      return block.replace(/<lastmod>[^<]+<\/lastmod>/, `<lastmod>${date}</lastmod>`);
    }
  );

  fs.writeFileSync(smPath, xml);
}

fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 0));
console.log(`lastmod: ${bumped} bumped, ${kept} giữ nguyên, ${missing} thiếu file, cache ${Object.keys(cache).length} URL.`);
