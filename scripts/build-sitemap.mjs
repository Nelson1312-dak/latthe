// Sinh public/sitemap.xml từ các trang tĩnh có trong public/ (mỗi thư mục có index.html
// là một trang) cộng trang chủ. Ngày sửa (lastmod) lấy theo lần commit cuối của file;
// file chưa commit thì lấy hôm nay.
// Chạy: npm run seo   (sau build-guides; build-lessons chạy riêng vì cần kho bài tập)

import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://latbai.vn';
const hômNay = new Date().toISOString().slice(0, 10);

function lastmod(file) {
  try {
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { encoding: 'utf8' }).trim();
    // File đã sửa mà chưa commit thì ngày commit cũ không đúng nữa
    const dirty = execFileSync('git', ['status', '--porcelain', '--', file], { encoding: 'utf8' }).trim();
    return d && !dirty ? d : hômNay;
  } catch {
    return hômNay;
  }
}

/** Mọi thư mục trong public/ có index.html (bỏ qua dữ liệu, ảnh, engine). */
function pages(dir = 'public', path = '/') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const d = join(dir, e.name);
    const p = `${path}${e.name}/`;
    const f = join(d, 'index.html');
    if (existsSync(f)) {
      // Trang tự đánh dấu không cho Google vào thì không đưa vào sitemap
      if (!/<meta name="robots" content="[^"]*noindex/.test(readFileSync(f, 'utf8'))) out.push([p, f]);
    }
    out.push(...pages(d, p));
  }
  return out;
}

// Trang có thứ tự: trang chủ, các trang mục lục, rồi tới trang con
const all = [['/', 'index.html'], ...pages().sort((a, b) => a[0].split('/').length - b[0].split('/').length || a[0].localeCompare(b[0]))];

writeFileSync(
  'public/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(([p, f]) => `  <url><loc>${SITE}${p}</loc><lastmod>${lastmod(f)}</lastmod></url>`).join('\n')}
</urlset>
`,
);
console.log(`sitemap: ${all.length} trang`);
