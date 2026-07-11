/**
 * scripts/build-sinhngay-pages.mjs — sinh 366 trang "Sinh ngày D/M" + hub.
 * Mỗi trang /sinh-ngay/D-M.html gộp 2 trục dữ liệu thật để tránh thin-content:
 *   - Cung hoàng đạo (RP_ZODIAC từ bao-cao/js/report-data.js)
 *   - Số Ngày Sinh + luận giải (NUM_MEANINGS.birthday từ numerology-data.js)
 * + đoạn tổng hợp riêng theo cặp (cung × số). Hub: /sinh-ngay/.
 * Run: node scripts/build-sinhngay-pages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'sinh-ngay');
const SITEMAP = path.join(ROOT, 'sitemap-latbai.xml');
const TODAY = new Date().toISOString().slice(0, 10);
fs.mkdirSync(OUT, { recursive: true });

// ---- Nạp dữ liệu nguồn ----
const rdSrc = fs.readFileSync(path.join(ROOT, 'bao-cao', 'js', 'report-data.js'), 'utf8');
const { RP_ZODIAC, zodiacOf } = new Function(`${rdSrc}; return { RP_ZODIAC, zodiacOf };`)();
const nmSrc = fs.readFileSync(path.join(ROOT, 'thansohoc', 'js', 'numerology-data.js'), 'utf8');
const { NUM_MEANINGS } = new Function(`${nmSrc}; return { NUM_MEANINGS };`)();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const personaOf = (html) => { const m = String(html || '').match(/<h4>([^<]+)<\/h4>/); return m ? m[1].trim() : ''; };

function reduceMaster(n) {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) n = String(n).split('').reduce((s, d) => s + +d, 0);
  return n;
}
function reduceSingle(n) { while (n > 9) n = String(n).split('').reduce((s, d) => s + +d, 0); return n; }
const birthdayMeaning = (num) => NUM_MEANINGS.birthday?.[String(num)] || NUM_MEANINGS.birthday?.[String(reduceSingle(num))] || '';

// slug trang cung tĩnh (/hoang-dao/cung-{slug} — build-hoangdao-pages.mjs)
const Z_SLUG = {
  'Bạch Dương': 'bach-duong', 'Kim Ngưu': 'kim-nguu', 'Song Tử': 'song-tu',
  'Cự Giải': 'cu-giai', 'Sư Tử': 'su-tu', 'Xử Nữ': 'xu-nu',
  'Thiên Bình': 'thien-binh', 'Bọ Cạp': 'bo-cap', 'Nhân Mã': 'nhan-ma',
  'Ma Kết': 'ma-ket', 'Bảo Bình': 'bao-binh', 'Song Ngư': 'song-ngu',
};
const cungUrl = (zName) => `/hoang-dao/cung-${Z_SLUG[zName] || ''}`;

const MONTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_VN = ['', 'Một', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Mười Một', 'Mười Hai'];

// Danh sách mọi ngày (để liên kết trước/sau)
const DATES = [];
for (let m = 1; m <= 12; m++) for (let d = 1; d <= MONTHS[m - 1]; d++) DATES.push({ d, m });
const linkFor = ({ d, m }) => `/sinh-ngay/${d}-${m}`;
const HUB = '/sinh-ngay/';

function buildPage({ d, m }, idx) {
  const zName = zodiacOf(d, m);
  const z = RP_ZODIAC[zName];
  const bnum = reduceMaster(d);
  const bMean = birthdayMeaning(bnum);
  const persona = personaOf(bMean);
  const url = `https://latbai.vn${linkFor({ d, m })}`;

  const title = `Sinh Ngày ${d}/${m} Là Người Như Thế Nào? Cung ${zName} | latbai.vn`;
  const desc = `Người sinh ngày ${d} tháng ${m} thuộc cung hoàng đạo ${zName} (${z.el}), số ngày sinh ${bnum}. Giải mã tính cách, điểm mạnh và con đường phù hợp — miễn phí.`;

  const prev = DATES[(idx + DATES.length - 1) % DATES.length];
  const next = DATES[(idx + 1) % DATES.length];

  const zTrait = stripTags(z.d).split('.')[0];
  const bTrait = stripTags(bMean).split('.')[0];
  const combo = `Người sinh ngày ${d}/${m} vừa mang nét <strong>${zName}</strong> — ${zTrait.toLowerCase()} — vừa cộng hưởng năng lượng của <strong>số ngày sinh ${bnum}</strong>${persona ? ` (${persona.toLowerCase()})` : ''}. ${bTrait ? bTrait + '.' : ''}`;

  const faq = [
    { q: `Sinh ngày ${d}/${m} là cung gì?`, a: `Người sinh ngày ${d} tháng ${m} (dương lịch) thuộc cung hoàng đạo ${zName}, nguyên tố ${z.el}. ${stripTags(z.d).slice(0, 200)}` },
    { q: `Số ngày sinh ${bnum} nói lên điều gì?`, a: `${stripTags(bMean).slice(0, 260) || `Số ngày sinh ${bnum} phản ánh năng lực tự nhiên bẩm sinh của bạn.`}` },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Article', headline: `Sinh ngày ${d}/${m} — cung ${zName}`, description: desc,
        image: 'https://latbai.vn/images/og-main.png',
        author: { '@type': 'Organization', name: 'Ban biên tập latbai.vn' },
        publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } },
        mainEntityOfPage: url },
      { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://latbai.vn/' },
        { '@type': 'ListItem', position: 2, name: 'Sinh ngày', item: 'https://latbai.vn/sinh-ngay/' },
        { '@type': 'ListItem', position: 3, name: `Ngày ${d}/${m}` },
      ] },
    ],
  };

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://latbai.vn/images/og-main.png">
  <meta property="og:site_name" content="latbai.vn">
  <link rel="icon" type="image/svg+xml" href="/images/icon.svg">
  <link rel="apple-touch-icon" href="/images/icon.svg">
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/thuvien/css/thuvien.css">
  <script src="/js/mystic-fx.js" defer data-color="217,138,10" data-glyphs="✦✧☾" data-count="28"></script>
  <script type="application/ld+json">
  ${JSON.stringify(jsonLd, null, 2).split('\n').join('\n  ')}
  </script>
</head>
<body class="light-theme thuvien-theme">

  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/sinh-ngay/">Sinh ngày</a>
      <i class="ti ti-chevron-right"></i>
      <span>${d}/${m}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Sinh Ngày ${d}/${m} Là Người Như Thế Nào?</h1>
      <p style="color: var(--muted); font-size: 14px;">Cung <strong>${esc(zName)}</strong> (${esc(z.el)}) · Số ngày sinh <strong>${bnum}</strong></p>
    </article>

    <div class="article-body">
      <p style="text-align:center; font-size:56px; line-height:1; margin: 8px 0 4px;">${z.sym}</p>
      <p style="text-align:center; color: var(--muted); margin-top:0;">Ngày ${d} tháng ${m} · Cung ${esc(zName)}</p>

      <p>${combo}</p>

      <h2 class="thansohoc">1. Cung hoàng đạo ${esc(zName)}</h2>
      <p>${esc(z.d)}</p>
      <p>Xem tính cách chi tiết, tử vi hôm nay và độ hợp của cung ${esc(zName)} tại <a href="${cungUrl(zName)}">trang cung ${esc(zName)}</a>.</p>

      <h2 class="thansohoc">2. Số ngày sinh ${bnum}${persona ? ` — ${esc(persona)}` : ''}</h2>
      ${bMean || `<p>Số ngày sinh ${bnum} phản ánh năng lực tự nhiên bạn mang theo từ khi sinh ra.</p>`}
      <p>Đọc thêm <a href="/thansohoc/so-${bnum}">ý nghĩa đầy đủ của số ${bnum}</a> khi nó xuất hiện ở vị trí Số Chủ Đạo.</p>

      <h2 class="thansohoc">3. Muốn hiểu sâu hơn về chính mình?</h2>
      <p>Cung hoàng đạo và số ngày sinh mới là hai lát cắt. Bản đồ đầy đủ của bạn còn gồm <a href="/thansohoc/so-chu-dao">Số Chủ Đạo</a>, con giáp, mệnh ngũ hành và <a href="/thuvien/than-so-hoc-2026">năm cá nhân</a> — tất cả tính từ họ tên và ngày sinh.</p>

      <a href="/bao-cao/" class="article-cta thansohoc">
        <i class="ti ti-file-star"></i> Xem Báo Cáo Vận Mệnh tổng hợp của bạn — miễn phí
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
        <p><strong>Lưu ý:</strong> Nội dung tổng hợp theo chiêm tinh phương Tây &amp; Thần Số Học, mang tính tham khảo và định hướng.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Ngày liền kề &amp; tra cứu</h3>
      <div class="related-list">
        <a href="${linkFor(prev)}" class="related-item"><i class="ti ti-arrow-left"></i> Sinh ngày ${prev.d}/${prev.m}</a>
        <a href="${linkFor(next)}" class="related-item"><i class="ti ti-arrow-right"></i> Sinh ngày ${next.d}/${next.m}</a>
        <a href="/thansohoc/so-${bnum}" class="related-item"><i class="ti ti-hash"></i> Ý nghĩa số chủ đạo ${bnum}</a>
        <a href="${cungUrl(zName)}" class="related-item"><i class="ti ti-stars"></i> Cung ${esc(zName)} — hồ sơ đầy đủ</a>
        <a href="/sinh-ngay/" class="related-item"><i class="ti ti-calendar"></i> Tra cứu theo ngày sinh khác</a>
      </div>
    </div>

  </main>

  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/bao-cao/">Báo Cáo Vận Mệnh</a> ·
        <a href="/thansohoc/">Thần Số Học</a> ·
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
  const title = 'Sinh Ngày Này Là Người Như Thế Nào? Tra Cứu 366 Ngày Sinh | latbai.vn';
  const desc = 'Tra cứu tính cách theo ngày sinh: chọn ngày tháng của bạn để biết cung hoàng đạo, số ngày sinh và giải mã con người bạn. Đầy đủ 366 ngày, miễn phí.';

  const monthBlocks = [];
  for (let m = 1; m <= 12; m++) {
    let days = '';
    for (let d = 1; d <= MONTHS[m - 1]; d++) {
      days += `<a href="${linkFor({ d, m })}" class="sn-day">${d}</a>`;
    }
    monthBlocks.push(`      <details class="faq-item"><summary class="faq-question">Tháng ${MONTH_VN[m]} (${m})</summary><div class="sn-days">${days}</div></details>`);
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: 'Tra cứu ngày sinh', description: desc, url,
        publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://latbai.vn/' },
        { '@type': 'ListItem', position: 2, name: 'Sinh ngày' },
      ] },
    ],
  };

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
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
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/thuvien/css/thuvien.css">
  <style>
    .sn-days{display:flex;flex-wrap:wrap;gap:6px;padding:10px 0;}
    .sn-day{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid var(--border);border-radius:10px;font-weight:700;color:var(--text);text-decoration:none;font-size:13px;}
    .sn-day:hover{border-color:var(--gold,#d98a0a);color:var(--gold,#d98a0a);}
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
      <span>Sinh ngày</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Sinh Ngày Này Là Người Như Thế Nào?</h1>
      <p style="color: var(--muted); font-size: 14px;">Tra cứu 366 ngày sinh · Cung hoàng đạo &amp; số ngày sinh</p>
    </article>

    <div class="article-body">
      <p>Mỗi ngày sinh mang một tổ hợp năng lượng riêng — <strong>cung hoàng đạo</strong> quyết định khí chất, <strong>số ngày sinh</strong> tiết lộ năng lực bẩm sinh. Chọn ngày sinh của bạn bên dưới, hoặc <a href="/bao-cao/">xem Báo Cáo Vận Mệnh</a> đầy đủ từ họ tên &amp; ngày sinh.</p>

      <a href="/bao-cao/" class="article-cta thansohoc">
        <i class="ti ti-file-star"></i> Xem Báo Cáo Vận Mệnh tổng hợp — miễn phí
      </a>

      <h2 class="thansohoc">Chọn ngày sinh của bạn</h2>
${monthBlocks.join('\n')}

      <div class="author-box">
        <p><strong>Lưu ý:</strong> Nội dung tổng hợp theo chiêm tinh phương Tây &amp; Thần Số Học, mang tính tham khảo.</p>
      </div>
    </div>

  </main>

  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/bao-cao/">Báo Cáo Vận Mệnh</a> ·
        <a href="/thansohoc/">Thần Số Học</a> ·
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
DATES.forEach((dt, idx) => {
  fs.writeFileSync(path.join(OUT, `${dt.d}-${dt.m}.html`), buildPage(dt, idx), 'utf8');
  urls.push(`https://latbai.vn${linkFor(dt)}`);
});
fs.writeFileSync(path.join(OUT, 'index.html'), buildHub(), 'utf8');
console.log(`Generated ${urls.length} pages in /sinh-ngay/`);

// ---- Sitemap block (idempotent) ----
const block = [
  '  <!-- sinhngay:start (generated by scripts/build-sinhngay-pages.mjs) -->',
  ...urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>${u.endsWith('/sinh-ngay/') ? '0.6' : '0.4'}</priority>
  </url>`),
  '  <!-- sinhngay:end -->',
].join('\n');

let sitemap = fs.readFileSync(SITEMAP, 'utf8');
if (sitemap.includes('<!-- sinhngay:start')) {
  sitemap = sitemap.replace(/ {2}<!-- sinhngay:start[\s\S]*?<!-- sinhngay:end -->/, block);
} else {
  sitemap = sitemap.replace('</urlset>', `${block}\n</urlset>`);
}
fs.writeFileSync(SITEMAP, sitemap, 'utf8');
console.log(`Sitemap updated: +${urls.length} URLs`);
