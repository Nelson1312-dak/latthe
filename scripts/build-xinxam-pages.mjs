/**
 * scripts/build-xinxam-pages.mjs — sinh 106 trang tĩnh cho module Xin Xăm:
 *   - 100 trang quẻ:  /xin-xam/xam-{so}-{slug}      (slug từ tên điển cố)
 *   -   1 trang hub:  /xin-xam/100-que-xam
 *   -   5 trang hạng: /xin-xam/xam-{hang}           (thuong-thuong … ha-ha)
 *
 * Dữ liệu: xin-xam/js/xam-data.js (XAM_DATA — nguồn duy nhất, không copy lại).
 * Khuôn: bám scripts/build-hoangdao-pages.mjs (HEAD/FOOTER/*Ld + khối sitemap).
 *
 * Run: node scripts/build-xinxam-pages.mjs && npm run seo:lastmod
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'xin-xam');
const SITEMAP = path.join(ROOT, 'sitemap-latbai.xml');
const TODAY = new Date().toISOString().slice(0, 10);

// ---- Nạp dữ liệu nguồn ----
const xdSrc = fs.readFileSync(path.join(ROOT, 'xin-xam', 'js', 'xam-data.js'), 'utf8');
const XAM_DATA = new Function(`${xdSrc}; return XAM_DATA;`)();
if (!Array.isArray(XAM_DATA) || XAM_DATA.length !== 100) {
  throw new Error(`XAM_DATA phải có đúng 100 quẻ, đang có ${XAM_DATA && XAM_DATA.length}`);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Lớp dấu tổ hợp viết tường minh (̀-ͯ) — an toàn khi file được lưu lại
// ở encoding khác, không như literal codepoint trong build-que-pages.mjs.
function slugify(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// cleanUrls:true — file trên đĩa có .html nhưng mọi URL/link/sitemap phải bỏ đuôi.
const fileFor = (x) => `xam-${x.so}-${slugify(x.ten)}.html`;
const linkFor = (x) => `/xin-xam/${fileFor(x).replace(/\.html$/, '')}`;
const HUB = '/xin-xam/100-que-xam';
const hangLink = (h) => `/xin-xam/xam-${h}`;
const OG = 'https://latbai.vn/images/og-xinxam.png';
const RED = '#b91c1c';

// Thứ tự hạng từ tốt → xấu, kèm nhãn và màu (màu lấy từ HANG_COLOR ở xin-xam/js/app.js)
const HANGS = [
  { key: 'thuong-thuong', label: 'Thượng Thượng', cls: 'tt', color: '#d98a0a' },
  { key: 'thuong-cat',    label: 'Thượng Cát',    cls: 'tc', color: '#b91c1c' },
  { key: 'trung-binh',    label: 'Trung Bình',    cls: 'tb', color: '#6b7280' },
  { key: 'ha',            label: 'Hạ',            cls: 'h',  color: '#1e3a8a' },
  { key: 'ha-ha',         label: 'Hạ Hạ',         cls: 'hh', color: '#1f2937' },
];
const hangOf = (key) => HANGS.find((h) => h.key === key);
for (const x of XAM_DATA) {
  if (!hangOf(x.hang)) throw new Error(`Quẻ ${x.so}: hạng lạ "${x.hang}"`);
}

// Lời khuyên theo hạng — dùng ở mục 4 của trang quẻ và mở đầu trang hạng.
const HANG_ADVICE = {
  'thuong-thuong': 'Đây là hạng xăm cao nhất trong ống xăm. Rút được quẻ này nghĩa là thời cơ đang đứng về phía bạn: việc đang cầu phần lớn sẽ thành, người đang chờ sẽ tới, chuyện đang bế tắc sẽ mở. Điều duy nhất cần giữ là sự khiêm nhường — xăm tốt chỉ ra cửa đã mở, còn bước qua cửa vẫn là việc của bạn. Đừng vì tin điềm lành mà buông lơi phần chuẩn bị.',
  'thuong-cat': 'Hạng xăm tốt. Việc đang cầu có cơ sở để thành, nhưng thường phải qua thêm một quãng gắng sức hoặc một lần chờ đợi nữa. Hãy hiểu quẻ này là lời xác nhận rằng bạn đang đi đúng đường, không phải lời hứa mọi thứ sẽ tự đến. Kiên trì thêm là đủ.',
  'trung-binh': 'Hạng xăm trung dung — được và mất song hành. Quẻ này thường ứng vào những việc phải chấp nhận đánh đổi: muốn có cái này thì tạm gác cái kia. Đừng ép quẻ phải nói tốt hay xấu; hãy đọc xem nó chỉ ra bạn cần đổi điều gì. Chọn đúng thứ để nhường, việc sẽ thuận.',
  'ha': 'Hạng xăm kém. Quẻ này khuyên hoãn lại việc đang cầu chứ không phải bỏ hẳn: thời điểm chưa tới, hoặc cách làm hiện tại còn thiếu sót. Người xưa gặp xăm Hạ thì lui một bước để soát lại mình, thường tránh được tổn thất lớn hơn. Đây là lời cảnh báo sớm, không phải bản án.',
  'ha-ha': 'Hạng xăm thấp nhất, và cũng là hạng ít gặp nhất trong ống xăm. Quẻ này khuyên dừng lại: việc đang cầu nếu cố làm lúc này rất dễ tổn hại. Nhưng xin xăm là để biết mà tránh — biết trước một điều bất lợi thì điều bất lợi ấy đã mất phần nửa sức mạnh. Hãy giữ tâm tĩnh, lo phần gốc (sức khỏe, gia đạo, chữ tín) rồi cầu lại sau.',
};

// ---- Khuôn trang (bám build-hoangdao-pages.mjs) ----
const HEAD = (title, desc, url, jsonLd) => `<!DOCTYPE html>
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
  <meta property="og:image" content="${OG}">
  <meta property="og:site_name" content="latbai.vn">
  <link rel="icon" type="image/svg+xml" href="/images/icon.svg">
  <link rel="apple-touch-icon" href="/images/icon.svg">
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/thuvien/css/thuvien.css">
  <style>
    /* thuvien.css không có --c-xinxam nên CTA/h2 sẽ ra xanh Thư Viện — chỉnh về tông đỏ module */
    .article-cta.xinxam{background-color:${RED};}
    .article-body h2.xinxam{border-left-color:${RED};}
    .xx-so{text-align:center;font-size:64px;font-weight:900;line-height:1;color:${RED};margin:10px 0 2px;}
    .xx-hang{display:inline-block;font-weight:800;font-size:12px;letter-spacing:.6px;text-transform:uppercase;border:1px solid currentColor;border-radius:99px;padding:3px 12px;}
    .xx-hang-tt{color:#d98a0a}.xx-hang-tc{color:#b91c1c}.xx-hang-tb{color:#6b7280}
    .xx-hang-h{color:#1e3a8a}.xx-hang-hh{color:#1f2937}
    .xx-tho{text-align:center;font-style:italic;font-size:17px;line-height:2;color:var(--text);border-top:1px dashed var(--border);border-bottom:1px dashed var(--border);padding:16px 0;margin:18px 0;}
    .xx-list{display:flex;flex-direction:column;gap:2px;}
    .xx-list a{display:flex;align-items:baseline;gap:8px;padding:8px 10px;border-radius:8px;text-decoration:none;color:var(--text);font-size:14px;}
    .xx-list a:hover{background:rgba(185,28,28,.06);}
    .xx-list b{color:${RED};min-width:34px;}
  </style>
  <script src="/js/mystic-fx.js" defer data-color="185,28,28" data-glyphs="☸✦❁" data-count="28"></script>
  <script type="application/ld+json">
  ${JSON.stringify(jsonLd, null, 2).split('\n').join('\n  ')}
  </script>
</head>
<body class="light-theme thuvien-theme">
`;

const FOOTER = `  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/xin-xam/">Xin Xăm</a> ·
        <a href="${HUB}">100 Quẻ Xăm</a> ·
        <a href="/gieoque/">Gieo Quẻ</a> ·
        <a href="/thuvien/">Thư Viện</a>
      </nav>
      <p>&copy; 2026 latbai.vn · <a href="/gioi-thieu">Giới thiệu</a> · <a href="/chinh-sach-bao-mat">Bảo mật</a> · <a href="/lien-he">Liên hệ</a></p>
    </div>
  </footer>

  <script src="/js/shell.js" defer></script>
</body>
</html>
`;

const breadcrumbLd = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem', position: i + 1, name: it.name, ...(it.item ? { item: it.item } : {}),
  })),
});
const articleLd = (headline, desc, url) => ({
  '@type': 'Article', headline, description: desc,
  image: OG,
  author: { '@type': 'Organization', name: 'Ban biên tập latbai.vn' },
  publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } },
  mainEntityOfPage: url,
});
const faqLd = (faq) => ({
  '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

const hangBadge = (h) => `<span class="xx-hang xx-hang-${h.cls}">${esc(h.label)}</span>`;
const listRow = (x) => {
  const h = hangOf(x.hang);
  return `          <a href="${linkFor(x)}"><b>${x.so}</b> <span>${esc(x.ten)}</span> ${hangBadge(h)}</a>`;
};

// ============================================================
// Trang quẻ: /xin-xam/xam-{so}-{slug}.html
// ============================================================
function buildXamPage(x) {
  const h = hangOf(x.hang);
  const url = `https://latbai.vn${linkFor(x)}`;
  const title = `Xăm Số ${x.so}: ${x.ten} (${h.label}) — Giải Quẻ Chi Tiết | latbai.vn`;
  const desc = `Giải quẻ xăm số ${x.so} "${x.ten}" hạng ${h.label} trong 100 quẻ xăm Quan Âm: thơ xăm, điển cố, luận giải gia đạo, tài lộc, tình duyên, sức khỏe và điều nên làm.`;

  const prev = XAM_DATA[(x.so - 2 + 100) % 100];   // wrap 1 → 100
  const next = XAM_DATA[x.so % 100];               // wrap 100 → 1
  const sameHang = XAM_DATA.filter((o) => o.hang === x.hang && o.so !== x.so).slice(0, 2);

  const faq = [
    { q: `Xăm số ${x.so} là tốt hay xấu?`, a: `Quẻ xăm số ${x.so} — "${x.ten}" — thuộc hạng ${h.label} trong bộ 100 quẻ xăm Quan Âm. ${x.y}` },
    { q: `Điển cố của quẻ xăm số ${x.so} là gì?`, a: x.dienco },
    { q: `Rút được xăm số ${x.so} thì tài lộc, tình duyên thế nào?`, a: `Tài lộc: ${x.linhvuc.tailoc} Tình duyên: ${x.linhvuc.tinhduyen} Gia đạo: ${x.linhvuc.giadao} Sức khỏe: ${x.linhvuc.suckhoe}` },
  ];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    articleLd(`Xăm số ${x.so} — ${x.ten} (${h.label})`, desc, url),
    faqLd(faq),
    breadcrumbLd([
      { name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { name: 'Xin Xăm', item: 'https://latbai.vn/xin-xam/' },
      { name: '100 Quẻ Xăm', item: `https://latbai.vn${HUB}` },
      { name: `Xăm số ${x.so}` },
    ]),
  ] };

  return HEAD(title, desc, url, jsonLd) + `
  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/xin-xam/">Xin Xăm</a>
      <i class="ti ti-chevron-right"></i>
      <a href="${HUB}">100 Quẻ Xăm</a>
      <i class="ti ti-chevron-right"></i>
      <span>Xăm số ${x.so}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Xăm Số ${x.so}: ${esc(x.ten)}</h1>
      <p style="color: var(--muted); font-size: 14px;">100 Quẻ Xăm Quan Âm · Hạng ${hangBadge(h)}</p>
    </article>

    <div class="article-body">
      <p class="xx-so">${x.so}</p>
      <p style="text-align:center; margin-top:0;">${hangBadge(h)}</p>

      <p class="xx-tho">${x.tho.map((l) => esc(l)).join('<br>')}</p>

      <h2 class="xinxam">1. Ý nghĩa quẻ xăm số ${x.so}</h2>
      <p>${esc(x.y)}</p>

      <h2 class="xinxam">2. Điển cố: ${esc(x.ten)}</h2>
      <p>${esc(x.dienco)}</p>

      <h2 class="xinxam">3. Luận giải theo từng lĩnh vực</h2>
      <div class="table-responsive">
        <table class="seo-table">
          <thead><tr><th>Lĩnh vực</th><th>Quẻ xăm nói gì</th></tr></thead>
          <tbody>
            <tr><td><strong>Gia đạo</strong></td><td>${esc(x.linhvuc.giadao)}</td></tr>
            <tr><td><strong>Tài lộc</strong></td><td>${esc(x.linhvuc.tailoc)}</td></tr>
            <tr><td><strong>Tình duyên</strong></td><td>${esc(x.linhvuc.tinhduyen)}</td></tr>
            <tr><td><strong>Sức khỏe</strong></td><td>${esc(x.linhvuc.suckhoe)}</td></tr>
          </tbody>
        </table>
      </div>

      <h2 class="xinxam">4. Rút được xăm hạng ${esc(h.label)} nên làm gì?</h2>
      <p>${esc(HANG_ADVICE[x.hang])}</p>
      <p>Xem thêm <a href="${hangLink(h.key)}">toàn bộ quẻ xăm hạng ${esc(h.label)}</a> để hiểu rõ hơn về nhóm xăm này.</p>

      <a href="/xin-xam/" class="article-cta xinxam">
        <i class="ti ti-flame"></i> Xin một quẻ xăm cho việc của bạn — Thầy Xăm AI luận giải riêng
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
        <p><strong>Lưu ý:</strong> Nội dung phỏng theo tinh thần Quan Âm linh xăm truyền thống (điển cố thật, thơ biên soạn theo ý xăm gốc) — mang tính chiêm nghiệm &amp; tham khảo, không phải lời tiên đoán chắc chắn.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Xem thêm</h3>
      <div class="related-list">
        <a href="${linkFor(prev)}" class="related-item"><i class="ti ti-arrow-left"></i> Xăm số ${prev.so}: ${esc(prev.ten)}</a>
        <a href="${linkFor(next)}" class="related-item"><i class="ti ti-arrow-right"></i> Xăm số ${next.so}: ${esc(next.ten)}</a>
${sameHang.map((o) => `        <a href="${linkFor(o)}" class="related-item"><i class="ti ti-cards"></i> Cùng hạng ${esc(h.label)}: xăm số ${o.so}</a>`).join('\n')}
        <a href="${HUB}" class="related-item"><i class="ti ti-list-numbers"></i> Tra cứu đủ 100 quẻ xăm</a>
        <a href="/gieoque/" class="related-item"><i class="ti ti-yin-yang"></i> Gieo quẻ Kinh Dịch online</a>
      </div>
    </div>

  </main>

` + FOOTER;
}

// ============================================================
// Trang hạng: /xin-xam/xam-{hang}.html
// ============================================================
function buildHangPage(h) {
  const list = XAM_DATA.filter((x) => x.hang === h.key);
  const url = `https://latbai.vn${hangLink(h.key)}`;
  const title = `Xăm ${h.label} Là Gì? ${list.length} Quẻ Xăm Hạng ${h.label} | latbai.vn`;
  const desc = `Xăm ${h.label} nghĩa là gì trong 100 quẻ xăm Quan Âm? Danh sách đầy đủ ${list.length} quẻ xăm hạng ${h.label} kèm ý nghĩa và điều nên làm khi rút được.`;

  const faq = [
    { q: `Xăm ${h.label} là gì?`, a: `${h.label} là một trong 5 hạng của bộ 100 quẻ xăm Quan Âm (Thượng Thượng, Thượng Cát, Trung Bình, Hạ, Hạ Hạ). Bộ xăm có ${list.length} quẻ thuộc hạng này. ${HANG_ADVICE[h.key]}` },
    { q: `Có bao nhiêu quẻ xăm hạng ${h.label}?`, a: `Trong ống xăm 100 quẻ có ${list.length} quẻ hạng ${h.label}, gồm các quẻ số ${list.map((x) => x.so).join(', ')}.` },
  ];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    articleLd(`Xăm ${h.label} — ${list.length} quẻ`, desc, url),
    faqLd(faq),
    breadcrumbLd([
      { name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { name: 'Xin Xăm', item: 'https://latbai.vn/xin-xam/' },
      { name: '100 Quẻ Xăm', item: `https://latbai.vn${HUB}` },
      { name: `Xăm ${h.label}` },
    ]),
  ] };

  return HEAD(title, desc, url, jsonLd) + `
  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/xin-xam/">Xin Xăm</a>
      <i class="ti ti-chevron-right"></i>
      <a href="${HUB}">100 Quẻ Xăm</a>
      <i class="ti ti-chevron-right"></i>
      <span>Xăm ${esc(h.label)}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Xăm ${esc(h.label)} Là Gì? ${list.length} Quẻ Hạng ${esc(h.label)}</h1>
      <p style="color: var(--muted); font-size: 14px;">Một trong 5 hạng của 100 quẻ xăm Quan Âm</p>
    </article>

    <div class="article-body">
      <p style="text-align:center; margin:6px 0 16px;">${hangBadge(h)}</p>

      <p>${esc(HANG_ADVICE[h.key])}</p>

      <h2 class="xinxam">Danh sách ${list.length} quẻ xăm hạng ${esc(h.label)}</h2>
      <div class="xx-list">
${list.map(listRow).join('\n')}
      </div>

      <h2 class="xinxam">5 hạng xăm trong ống xăm 100 quẻ</h2>
      <div class="table-responsive">
        <table class="seo-table">
          <thead><tr><th>Hạng</th><th>Số quẻ</th><th>Ý nghĩa ngắn</th></tr></thead>
          <tbody>
${HANGS.map((o) => {
  const n = XAM_DATA.filter((x) => x.hang === o.key).length;
  const short = HANG_ADVICE[o.key].split('.')[0] + '.';
  const cell = o.key === h.key ? `<strong>${esc(o.label)}</strong>` : `<a href="${hangLink(o.key)}">${esc(o.label)}</a>`;
  return `            <tr><td>${cell}</td><td>${n}</td><td>${esc(short)}</td></tr>`;
}).join('\n')}
          </tbody>
        </table>
      </div>

      <a href="/xin-xam/" class="article-cta xinxam">
        <i class="ti ti-flame"></i> Lắc ống xăm — xin quẻ của riêng bạn
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
        <p><strong>Lưu ý:</strong> Hạng xăm chỉ là chỉ dấu chung về chiều thuận/nghịch của việc đang cầu — nội dung mang tính chiêm nghiệm &amp; tham khảo.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Xem thêm</h3>
      <div class="related-list">
        <a href="${HUB}" class="related-item"><i class="ti ti-list-numbers"></i> Tra cứu đủ 100 quẻ xăm</a>
${HANGS.filter((o) => o.key !== h.key).slice(0, 3).map((o) => `        <a href="${hangLink(o.key)}" class="related-item"><i class="ti ti-cards"></i> Xăm ${esc(o.label)}</a>`).join('\n')}
        <a href="/xin-xam/" class="related-item"><i class="ti ti-flame"></i> Xin xăm online</a>
      </div>
    </div>

  </main>

` + FOOTER;
}

// ============================================================
// Hub: /xin-xam/100-que-xam.html
// ============================================================
function buildHub() {
  const url = `https://latbai.vn${HUB}`;
  const title = 'Tra Cứu 100 Quẻ Xăm Quan Âm: Ý Nghĩa Đầy Đủ | latbai.vn';
  const desc = 'Bảng tra cứu đầy đủ 100 quẻ xăm Quan Âm: số quẻ, tên điển cố, hạng xăm (Thượng Thượng đến Hạ Hạ), thơ xăm và luận giải gia đạo, tài lộc, tình duyên, sức khỏe.';

  const faq = [
    { q: 'Bộ 100 quẻ xăm Quan Âm gồm những hạng nào?', a: `Bộ xăm chia 5 hạng: ${HANGS.map((h) => `${h.label} (${XAM_DATA.filter((x) => x.hang === h.key).length} quẻ)`).join(', ')}. Hạng càng cao thì điềm càng thuận, nhưng quẻ nào cũng có lời khuyên riêng để hành xử.` },
    { q: 'Xin xăm bao lâu nên xin lại một lần?', a: 'Theo lệ xưa, mỗi việc chỉ xin một quẻ; xin lại nhiều lần cho cùng một việc là thiếu thành tâm. Khi việc đã chuyển sang giai đoạn khác, hoặc sang một việc mới, thì mới nên xin quẻ mới.' },
    { q: 'Rút phải xăm Hạ hoặc Hạ Hạ thì phải làm sao?', a: 'Xăm kém là lời cảnh báo sớm chứ không phải bản án. Ý nghĩa của nó là hoãn việc đang cầu, soát lại cách làm và lo phần gốc (sức khỏe, gia đạo, chữ tín), rồi cầu lại sau. Biết trước một điều bất lợi thì điều bất lợi ấy đã mất phần nửa sức mạnh.' },
  ];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description: desc, url },
    { '@type': 'ItemList', numberOfItems: XAM_DATA.length,
      itemListElement: XAM_DATA.map((x) => ({
        '@type': 'ListItem', position: x.so, name: `Xăm số ${x.so}: ${x.ten}`, url: `https://latbai.vn${linkFor(x)}`,
      })) },
    faqLd(faq),
    breadcrumbLd([
      { name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { name: 'Xin Xăm', item: 'https://latbai.vn/xin-xam/' },
      { name: '100 Quẻ Xăm' },
    ]),
  ] };

  return HEAD(title, desc, url, jsonLd) + `
  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/xin-xam/">Xin Xăm</a>
      <i class="ti ti-chevron-right"></i>
      <span>100 Quẻ Xăm</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Tra Cứu 100 Quẻ Xăm Quan Âm</h1>
      <p style="color: var(--muted); font-size: 14px;">Đầy đủ số quẻ · tên điển cố · hạng xăm · luận giải 4 lĩnh vực</p>
    </article>

    <div class="article-body">
      <p>Ống xăm Quan Âm truyền thống có 100 quẻ, mỗi quẻ gắn với một điển cố lịch sử hoặc truyền thuyết và được xếp vào một trong 5 hạng từ Thượng Thượng đến Hạ Hạ. Bảng dưới đây liệt kê đủ 100 quẻ theo hạng — bấm vào từng quẻ để đọc thơ xăm, điển cố và luận giải chi tiết cho gia đạo, tài lộc, tình duyên, sức khỏe.</p>

      <div class="table-responsive">
        <table class="seo-table">
          <thead><tr><th>Hạng xăm</th><th>Số quẻ</th><th>Ý nghĩa ngắn</th></tr></thead>
          <tbody>
${HANGS.map((h) => {
  const n = XAM_DATA.filter((x) => x.hang === h.key).length;
  const short = HANG_ADVICE[h.key].split('.')[0] + '.';
  return `            <tr><td><a href="${hangLink(h.key)}">${esc(h.label)}</a></td><td>${n}</td><td>${esc(short)}</td></tr>`;
}).join('\n')}
          </tbody>
        </table>
      </div>

${HANGS.map((h) => {
  const list = XAM_DATA.filter((x) => x.hang === h.key);
  return `      <h2 class="xinxam">Xăm ${esc(h.label)} — ${list.length} quẻ</h2>
      <p>${esc(HANG_ADVICE[h.key].split('.')[0])}. <a href="${hangLink(h.key)}">Tìm hiểu hạng ${esc(h.label)}</a>.</p>
      <div class="xx-list">
${list.map(listRow).join('\n')}
      </div>`;
}).join('\n\n')}

      <a href="/xin-xam/" class="article-cta xinxam">
        <i class="ti ti-flame"></i> Lắc ống xăm — xin quẻ của riêng bạn, Thầy Xăm AI luận giải
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
        <p><strong>Lưu ý:</strong> Nội dung phỏng theo tinh thần Quan Âm linh xăm truyền thống (điển cố thật, thơ biên soạn theo ý xăm gốc) — mang tính chiêm nghiệm &amp; tham khảo.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Khám phá tiếp</h3>
      <div class="related-list">
        <a href="/xin-xam/" class="related-item"><i class="ti ti-flame"></i> Xin xăm online — lắc điện thoại rút quẻ</a>
        <a href="/gieoque/" class="related-item"><i class="ti ti-yin-yang"></i> Gieo quẻ Kinh Dịch</a>
        <a href="/kinh-dich/" class="related-item"><i class="ti ti-book"></i> Tra cứu 64 quẻ Kinh Dịch</a>
        <a href="/thuvien/" class="related-item"><i class="ti ti-books"></i> Thư viện cổ học</a>
      </div>
    </div>

  </main>

` + FOOTER;
}

// ---- Generate ----
const urls = [];

// Slug phải duy nhất, không thì file ghi đè nhau âm thầm
const seen = new Set();
for (const x of XAM_DATA) {
  const f = fileFor(x);
  if (seen.has(f)) throw new Error(`Slug trùng: ${f}`);
  seen.add(f);
}

fs.writeFileSync(path.join(OUT, '100-que-xam.html'), buildHub(), 'utf8');
urls.push({ loc: `https://latbai.vn${HUB}`, priority: '0.7' });

for (const h of HANGS) {
  fs.writeFileSync(path.join(OUT, `xam-${h.key}.html`), buildHangPage(h), 'utf8');
  urls.push({ loc: `https://latbai.vn${hangLink(h.key)}`, priority: '0.6' });
}

for (const x of XAM_DATA) {
  fs.writeFileSync(path.join(OUT, fileFor(x)), buildXamPage(x), 'utf8');
  urls.push({ loc: `https://latbai.vn${linkFor(x)}`, priority: '0.5' });
}

console.log(`Generated ${urls.length} pages in /xin-xam/`);

// ---- Sitemap block (idempotent) ----
// /xin-xam/ (trang tool) đã nằm ở phần đầu sitemap ngoài mọi marker — không emit lại.
const block = [
  '  <!-- xinxam:start (generated by scripts/build-xinxam-pages.mjs) -->',
  ...urls.map(({ loc, priority }) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>${priority}</priority>
  </url>`),
  '  <!-- xinxam:end -->',
].join('\n');

let sitemap = fs.readFileSync(SITEMAP, 'utf8');
if (sitemap.includes('<!-- xinxam:start')) {
  sitemap = sitemap.replace(/ {2}<!-- xinxam:start[\s\S]*?<!-- xinxam:end -->/, block);
} else {
  sitemap = sitemap.replace('</urlset>', `${block}\n</urlset>`);
}
fs.writeFileSync(SITEMAP, sitemap, 'utf8');
console.log(`Sitemap updated: +${urls.length} URLs`);
