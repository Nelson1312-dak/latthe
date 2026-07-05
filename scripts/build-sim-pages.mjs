/**
 * scripts/build-sim-pages.mjs — sinh 81 trang tra cứu linh số + hub.
 * Đọc LINH_SO + RATING_LABEL từ sim/js/app.js (nguồn duy nhất, tránh trôi dữ liệu).
 * Mỗi trang /sim/so-N.html nhắm "số N có ý nghĩa gì / linh số N",
 * dùng CÙNG template thuvien như các trang programmatic khác.
 * Hub: /sim/bang-linh-so.html. Duy trì block sim:start/end trong sitemap.
 * Run: node scripts/build-sim-pages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITEMAP = path.join(ROOT, 'sitemap-latbai.xml');
const TODAY = new Date().toISOString().slice(0, 10);

// ---- Trích LINH_SO + RATING_LABEL từ sim/js/app.js ----
const appSrc = fs.readFileSync(path.join(ROOT, 'sim', 'js', 'app.js'), 'utf8');
const linhMatch = appSrc.match(/const LINH_SO = (\{[\s\S]*?\n {2}\});/);
const ratingMatch = appSrc.match(/const RATING_LABEL = (\{[^}]*\});/);
if (!linhMatch || !ratingMatch) throw new Error('Không trích được LINH_SO/RATING_LABEL từ sim/js/app.js');
const LINH_SO = new Function(`return ${linhMatch[1]}`)();
const RATING_LABEL = new Function(`return ${ratingMatch[1]}`)();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ratingClass = (r) => (r >= 1 ? 'good' : r === 0 ? 'mid' : 'bad');

const linkFor = (n) => `/sim/so-${n}`;
const HUB = '/sim/bang-linh-so';

function buildPage(n) {
  const [name, rating, desc] = LINH_SO[n];
  const label = RATING_LABEL[String(rating)];
  const url = `https://latbai.vn${linkFor(n)}`;
  const title = `Số ${n} Trong Phong Thủy: ${name} (${label}) | latbai.vn`;
  const metaDesc = `Ý nghĩa linh số ${n} — "${name}" (${label}) theo bảng 81 linh số Kinh Dịch: luận giải cát hung và cách chấm điểm sim điện thoại hợp mệnh. Miễn phí.`;

  const prev = n === 1 ? 81 : n - 1;
  const next = n === 81 ? 1 : n + 1;

  const faq = [
    { q: `Linh số ${n} là tốt hay xấu?`, a: `Trong bảng 81 linh số Kinh Dịch, số ${n} — "${name}" — được xếp loại ${label}. ${desc}` },
    { q: `Số ${n} liên quan gì đến sim phong thủy?`, a: `Khi chấm điểm sim, người ta lấy 4 số cuối của số điện thoại chia cho 80, số dư chính là linh số của sim (nếu dư 0 thì tính là 80). Nếu ra ${n}, sim mang khí chất "${name}". Đây chỉ là một trong nhiều yếu tố — cần xét thêm cân bằng âm dương, tổng nút và ngũ hành hợp mệnh.` },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Article', headline: `Số ${n} — ${name} (${label})`, description: metaDesc,
        image: 'https://latbai.vn/images/og-main.png',
        author: { '@type': 'Organization', name: 'Ban biên tập latbai.vn' },
        publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } },
        mainEntityOfPage: url },
      { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://latbai.vn/' },
        { '@type': 'ListItem', position: 2, name: 'Phong Thủy Sim', item: 'https://latbai.vn/sim/' },
        { '@type': 'ListItem', position: 3, name: `Số ${n}` },
      ] },
    ],
  };

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(metaDesc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(metaDesc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://latbai.vn/images/og-main.png">
  <meta property="og:site_name" content="latbai.vn">
  <link rel="icon" type="image/svg+xml" href="/images/icon.svg">
  <link rel="apple-touch-icon" href="/images/icon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/thuvien/css/thuvien.css">
  <script src="/js/mystic-fx.js" defer data-color="13,148,136" data-glyphs="0123456789" data-count="30"></script>

  <script type="application/ld+json">
  ${JSON.stringify(jsonLd, null, 2).split('\n').join('\n  ')}
  </script>
</head>
<body class="light-theme thuvien-theme">

  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/sim/">Phong Thủy Sim</a>
      <i class="ti ti-chevron-right"></i>
      <span>Số ${n}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Số ${n} — ${esc(name)}</h1>
      <p style="color: var(--muted); font-size: 14px;">Bảng 81 Linh Số Kinh Dịch · Xếp loại: <strong>${esc(label)}</strong></p>
    </article>

    <div class="article-body">
      <p style="text-align:center; font-size:64px; line-height:1; margin: 8px 0 4px; color:#0d9488; font-weight:900;">${n}</p>
      <p style="text-align:center; color: var(--muted); margin-top:0;">${esc(name)} — <strong>${esc(label)}</strong></p>

      <h2 class="thansohoc">Ý nghĩa linh số ${n}</h2>
      <p>${esc(desc)}</p>

      <h2 class="thansohoc">Số ${n} trong phong thủy sim điện thoại</h2>
      <p>Theo phương pháp phổ biến, để tra linh số của một sim, ta lấy <strong>4 chữ số cuối</strong> của số điện thoại chia cho 80 — số dư chính là linh số (dư 0 được tính là 80). Ví dụ đuôi sim là <em>...${String(1000 + (n % 80 === 0 ? 80 : n % 80)).slice(1)}</em> có thể cho ra linh số ${n}, mang khí chất "${esc(name)}" (${esc(label)}). Tuy vậy, linh số chỉ là <strong>một trong năm yếu tố</strong> khi chấm điểm sim — bên cạnh cân bằng âm dương, tổng nút, ngũ hành số cuối hợp mệnh và các cặp số dân gian.</p>

      <a href="/sim/" class="article-cta thansohoc">
        <i class="ti ti-device-mobile"></i> Chấm điểm số điện thoại của bạn miễn phí — đủ 5 yếu tố phong thủy
      </a>

      <div class="faq-section">
        <h3 class="faq-title">Câu hỏi thường gặp (FAQ)</h3>
        <div class="faq-list">
${faq.map((f) => `          <details class="faq-item">
            <summary class="faq-question">${esc(f.q)}</summary>
            <p class="faq-answer">${esc(f.a)}</p>
          </details>`).join('\n')}
        </div>
      </div>

      <div class="author-box">
        <p><strong>Lưu ý:</strong> Bảng 81 linh số mang tính tham khảo theo quan niệm phong thủy dân gian, không nhằm mục đích mua bán sim.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Linh số liền kề &amp; tra cứu</h3>
      <div class="related-list">
        <a href="${linkFor(prev)}" class="related-item"><i class="ti ti-arrow-left"></i> Số ${prev} — ${esc(LINH_SO[prev][0])}</a>
        <a href="${linkFor(next)}" class="related-item"><i class="ti ti-arrow-right"></i> Số ${next} — ${esc(LINH_SO[next][0])}</a>
        <a href="${HUB}" class="related-item"><i class="ti ti-list-numbers"></i> Bảng đầy đủ 81 Linh Số</a>
      </div>
    </div>

  </main>

  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/sim/">Phong Thủy Sim</a> ·
        <a href="/bao-cao/">Báo Cáo Vận Mệnh</a> ·
        <a href="/thuvien/">Thư Viện</a>
      </nav>
      <p>&copy; 2026 latbai.vn. Tất cả quyền được bảo lưu.</p>
    </div>
  </footer>

  <script src="/js/shell.js" defer></script>
</body>
</html>
`;
}

function buildHub() {
  const url = `https://latbai.vn${HUB}`;
  const title = 'Bảng 81 Linh Số Kinh Dịch: Ý Nghĩa Từng Số Cát Hung | latbai.vn';
  const desc = 'Tra cứu đầy đủ bảng 81 linh số Kinh Dịch dùng chấm điểm sim phong thủy — ý nghĩa và xếp loại cát hung của từng số từ 1 đến 81. Miễn phí, kèm công cụ chấm điểm sim.';
  const rows = Object.keys(LINH_SO).map((k) => {
    const [name, rating, ] = LINH_SO[k];
    return `        <a href="${linkFor(k)}" class="related-item"><i class="ti ti-number-${k <= 9 ? k : ''}"></i> <b>${k}</b> — ${esc(name)} <span class="sim-tag-${ratingClass(rating)}">${esc(RATING_LABEL[String(rating)])}</span></a>`;
  }).join('\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: 'Bảng 81 Linh Số Kinh Dịch', description: desc, url,
        publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } } },
      { '@type': 'ItemList', itemListElement: Object.keys(LINH_SO).map((k, i) => ({ '@type': 'ListItem', position: i + 1, name: `Số ${k} — ${LINH_SO[k][0]}`, url: `https://latbai.vn${linkFor(k)}` })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://latbai.vn/' },
        { '@type': 'ListItem', position: 2, name: 'Phong Thủy Sim', item: 'https://latbai.vn/sim/' },
        { '@type': 'ListItem', position: 3, name: 'Bảng 81 Linh Số' },
      ] },
    ],
  };

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://latbai.vn/images/og-main.png">
  <meta property="og:site_name" content="latbai.vn">
  <link rel="icon" type="image/svg+xml" href="/images/icon.svg">
  <link rel="apple-touch-icon" href="/images/icon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/thuvien/css/thuvien.css">
  <style>
    .sim-tag-good{color:#0d9668;font-weight:800;font-size:11px;}
    .sim-tag-mid{color:#b0700a;font-weight:800;font-size:11px;}
    .sim-tag-bad{color:#dc2626;font-weight:800;font-size:11px;}
  </style>
  <script type="application/ld+json">
  ${JSON.stringify(jsonLd, null, 2).split('\n').join('\n  ')}
  </script>
</head>
<body class="light-theme thuvien-theme">

  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/sim/">Phong Thủy Sim</a>
      <i class="ti ti-chevron-right"></i>
      <span>Bảng 81 Linh Số</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Bảng 81 Linh Số Kinh Dịch — Ý Nghĩa Từng Số</h1>
      <p style="color: var(--muted); font-size: 14px;">Chuyên mục: <strong>Phong Thủy Sim</strong> · Biên soạn: <strong>Ban biên tập latbai.vn</strong></p>
    </article>

    <div class="article-body">
      <p>Bảng <strong>81 linh số</strong> là hệ thống luận cát hung cổ truyền phái sinh từ Kinh Dịch, đánh số từ 1 đến 81 — mỗi số mang một quẻ khí riêng. Khi chấm điểm sim phong thủy, lấy 4 số cuối chia 80, số dư là linh số của sim. Chọn số bên dưới để xem ý nghĩa, hoặc <a href="/sim/">chấm điểm sim của bạn</a> để hệ thống tự tính.</p>

      <a href="/sim/" class="article-cta thansohoc">
        <i class="ti ti-device-mobile"></i> Chấm điểm số điện thoại miễn phí — đủ 5 yếu tố phong thủy
      </a>

      <h2 class="thansohoc">Danh sách 81 linh số</h2>
      <div class="related-list" style="margin-bottom:18px;">
${rows}
      </div>

      <div class="author-box">
        <p><strong>Lưu ý:</strong> Nội dung mang tính tham khảo theo quan niệm phong thủy dân gian.</p>
      </div>
    </div>

  </main>

  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/sim/">Phong Thủy Sim</a> ·
        <a href="/bao-cao/">Báo Cáo Vận Mệnh</a> ·
        <a href="/thuvien/">Thư Viện</a>
      </nav>
      <p>&copy; 2026 latbai.vn. Tất cả quyền được bảo lưu.</p>
    </div>
  </footer>

  <script src="/js/shell.js" defer></script>
</body>
</html>
`;
}

// ---- Generate ----
const urls = [`https://latbai.vn${HUB}`];
for (let n = 1; n <= 81; n++) {
  fs.writeFileSync(path.join(ROOT, 'sim', `so-${n}.html`), buildPage(n), 'utf8');
  urls.push(`https://latbai.vn${linkFor(n)}`);
}
fs.writeFileSync(path.join(ROOT, 'sim', 'bang-linh-so.html'), buildHub(), 'utf8');
console.log(`Generated ${urls.length} pages in /sim/`);

// ---- Sitemap block (idempotent) ----
const block = [
  '  <!-- sim:start (generated by scripts/build-sim-pages.mjs) -->',
  ...urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.endsWith('/bang-linh-so') ? '0.7' : '0.5'}</priority>
  </url>`),
  '  <!-- sim:end -->',
].join('\n');

let sitemap = fs.readFileSync(SITEMAP, 'utf8');
if (sitemap.includes('<!-- sim:start')) {
  sitemap = sitemap.replace(/ {2}<!-- sim:start[\s\S]*?<!-- sim:end -->/, block);
} else {
  sitemap = sitemap.replace('</urlset>', `${block}\n</urlset>`);
}
fs.writeFileSync(SITEMAP, sitemap, 'utf8');
console.log(`Sitemap updated: +${urls.length} URLs`);
