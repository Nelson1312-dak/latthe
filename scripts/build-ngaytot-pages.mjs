/**
 * scripts/build-ngaytot-pages.mjs — sinh trang ngày tốt tĩnh:
 *   - Trang tháng: /ngay-tot/thang-{M}-{YYYY}.html (từ tháng hiện tại → hết Q1 năm sau)
 *   - 4 hub việc:  /ngay-tot/cuoi-hoi | khai-truong | dong-tho | xuat-hanh
 * Chạy đúng thuật toán âm lịch + chấm điểm của module (ngay-tot/js/amlich.js,
 * bảng TRUC_INFO/Tam Nương/Nguyệt Kỵ chép từ ngay-tot/js/app.js — sửa app thì sửa cả đây).
 * Chạy lại ngày 25 hằng tháng để nối thêm tháng mới (trang tháng cũ giữ nguyên).
 * Run: node scripts/build-ngaytot-pages.mjs && npm run seo:lastmod
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'ngay-tot');
const SITEMAP = path.join(ROOT, 'sitemap-latbai.xml');
const TODAY = new Date().toISOString().slice(0, 10);

// ---- Nạp AmLich (IIFE gắn vào window) ----
const alSrc = fs.readFileSync(path.join(ROOT, 'ngay-tot', 'js', 'amlich.js'), 'utf8');
const W = {};
new Function('window', alSrc)(W);
const A = W.AmLich;

// ---- Bảng luận giải (đồng bộ với ngay-tot/js/app.js) ----
const EVENTS = {
  cuoi:       { label: 'Cưới hỏi',    slug: 'cuoi-hoi',    icon: 'ti-heart' },
  khaitruong: { label: 'Khai trương', slug: 'khai-truong', icon: 'ti-building-store' },
  dongtho:    { label: 'Động thổ',    slug: 'dong-tho',    icon: 'ti-shovel' },
  xuathanh:   { label: 'Xuất hành',   slug: 'xuat-hanh',   icon: 'ti-plane-departure' },
};
const TRUC_INFO = {
  'Kiến': { good: ['xuathanh', 'kyhopdong', 'cautai'], bad: ['dongtho'] },
  'Trừ':  { good: ['xuathanh'], bad: ['cuoi', 'khaitruong'] },
  'Mãn':  { good: ['cautai', 'muasam', 'khaitruong'], bad: ['cuoi'] },
  'Bình': { good: ['cuoi', 'xuathanh', 'kyhopdong'], bad: [] },
  'Định': { good: ['cuoi', 'kyhopdong', 'nhaptrach', 'muasam'], bad: ['xuathanh'] },
  'Chấp': { good: ['dongtho'], bad: ['xuathanh', 'khaitruong', 'cautai'] },
  'Phá':  { good: [], bad: ['cuoi', 'khaitruong', 'dongtho', 'nhaptrach', 'kyhopdong', 'muasam', 'cautai'] },
  'Nguy': { good: [], bad: ['xuathanh', 'dongtho', 'muasam'] },
  'Thành': { good: ['cuoi', 'khaitruong', 'nhaptrach', 'kyhopdong', 'cautai'], bad: [] },
  'Thu':  { good: ['cautai', 'muasam'], bad: ['xuathanh'] },
  'Khai': { good: ['khaitruong', 'cuoi', 'xuathanh', 'dongtho'], bad: [] },
  'Bế':   { good: [], bad: ['khaitruong', 'xuathanh', 'nhaptrach'] },
};
const TAM_NUONG = new Set([3, 7, 13, 18, 22, 27]);
const NGUYET_KY = new Set([5, 14, 23]);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// giống analyzeDay trong app (không xét tuổi — trang tĩnh dùng chung)
function analyzeDay(dd, mm, yy, eventKey) {
  const lunar = A.solar2lunar(dd, mm, yy);
  const dc = A.dayCanChi(lunar.jdn);
  const trucName = A.TRUC[A.trucOfDay(dc.chi, lunar.month)];
  const truc = TRUC_INFO[trucName];
  const god = A.dayGod(dc.chi, lunar.month);

  let score = god.good ? 3 : -3;
  const notes = [];
  if (eventKey) {
    if (truc.good.includes(eventKey)) { score += 2; notes.push(`Trực ${trucName} hợp việc`); }
    if (truc.bad.includes(eventKey)) { score -= 2; notes.push(`Trực ${trucName} kỵ việc`); }
  }
  if (TAM_NUONG.has(lunar.day)) { score -= 2; notes.push('Tam Nương'); }
  if (NGUYET_KY.has(lunar.day)) { score -= 2; notes.push('Nguyệt Kỵ'); }

  let rating;
  if (score >= 4) rating = 3; else if (score >= 2) rating = 2; else if (score > -2) rating = 1; else rating = 0;
  return { lunar, dc, trucName, god, score, rating, notes };
}

const daysInMonth = (m, y) => new Date(y, m, 0).getDate();
const DOW = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const dowOf = (d, m, y) => DOW[new Date(y, m - 1, d).getDay()];
const monthPath = (m, y) => `/ngay-tot/thang-${m}-${y}`;

// ---- Danh sách tháng cần sinh: tháng hiện tại → hết tháng 3 năm sau ----
const now = new Date();
const MONTH_LIST = [];
{
  let m = now.getMonth() + 1, y = now.getFullYear();
  const endY = y + 1, endM = 3;
  while (y < endY || (y === endY && m <= endM)) {
    MONTH_LIST.push({ m, y });
    m++; if (m > 12) { m = 1; y++; }
  }
}

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
  <meta property="og:image" content="https://latbai.vn/images/og-main.png">
  <meta property="og:site_name" content="latbai.vn">
  <link rel="icon" type="image/svg+xml" href="/images/icon.svg">
  <link rel="apple-touch-icon" href="/images/icon.svg">
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/thuvien/css/thuvien.css">
  <script src="/js/mystic-fx.js" defer data-color="194,116,10" data-glyphs="✦✧☾" data-count="28"></script>
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
        <a href="/ngay-tot/">Xem Ngày Tốt</a> ·
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
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(it.item ? { item: it.item } : {}) })),
});
const articleLd = (headline, desc, url) => ({
  '@type': 'Article', headline, description: desc,
  image: 'https://latbai.vn/images/og-main.png',
  author: { '@type': 'Organization', name: 'Ban biên tập latbai.vn' },
  publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } },
  mainEntityOfPage: url, dateModified: TODAY,
});
const faqLd = (faq) => ({
  '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

const fmtDay = (d, m, y, r) =>
  `${dowOf(d, m, y)} ${d}/${m} (${r.lunar.day}/${r.lunar.month} âm, ngày ${r.dc.text}, trực ${r.trucName}, sao ${r.god.name})`;

function topDays(m, y, eventKey, wantRating) {
  const list = [];
  for (let d = 1; d <= daysInMonth(m, y); d++) {
    const r = analyzeDay(d, m, y, eventKey);
    if (r.rating >= wantRating) list.push({ d, r });
  }
  return list.sort((a, b) => b.r.score - a.r.score);
}

// ============================================================
// Trang tháng
// ============================================================
function buildMonthPage(m, y) {
  const url = `https://latbai.vn${monthPath(m, y)}`;
  const title = `Ngày Tốt Tháng ${m}/${y}: Cưới Hỏi, Khai Trương, Động Thổ, Xuất Hành | latbai.vn`;

  const perEvent = {};
  for (const [key, ev] of Object.entries(EVENTS)) {
    const good = topDays(m, y, key, 3);
    perEvent[key] = { ev, days: (good.length ? good : topDays(m, y, key, 2)).slice(0, 5), strong: good.length > 0 };
  }
  const bestCuoi = perEvent.cuoi.days[0];
  const desc = `Ngày tốt tháng ${m}/${y} theo lịch vạn niên: ngày đẹp cưới hỏi${bestCuoi ? ` (đẹp nhất: ${bestCuoi.d}/${m})` : ''}, khai trương, động thổ, xuất hành — kèm âm lịch, can chi, trực và sao hoàng đạo từng ngày.`;

  // bảng toàn tháng
  const allRows = [];
  for (let d = 1; d <= daysInMonth(m, y); d++) {
    const r = analyzeDay(d, m, y, null);
    allRows.push({ d, r });
  }
  const goodCount = allRows.filter((x) => x.r.god.good).length;

  const faq = [
    { q: `Tháng ${m}/${y} có những ngày hoàng đạo nào?`, a: `Tháng ${m}/${y} có ${goodCount} ngày hoàng đạo (sao tốt chiếu): ${allRows.filter((x) => x.r.god.good).map((x) => x.d).join(', ')}/${m}. Ngày hoàng đạo là nền tốt, còn hợp việc gì cụ thể phải xét thêm trực của ngày.` },
    ...(bestCuoi ? [{ q: `Ngày nào đẹp nhất để cưới trong tháng ${m}/${y}?`, a: `Đẹp nhất cho cưới hỏi là ${fmtDay(bestCuoi.d, m, y, bestCuoi.r)}. Nên xem thêm ngày có xung tuổi cô dâu chú rể hay không tại công cụ Xem Ngày Tốt của latbai.vn.` }] : []),
    { q: `Ngày tốt trong tháng có hợp với mọi người không?`, a: `Không hẳn — ngày đẹp chung vẫn có thể xung với tuổi của bạn (lục xung địa chi). Dùng công cụ tại latbai.vn/ngay-tot/ và tạo Hồ Sơ Huyền Học để hệ thống tự lọc ngày xung tuổi.` },
  ];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    articleLd(`Ngày tốt tháng ${m}/${y}`, desc, url),
    faqLd(faq),
    breadcrumbLd([
      { name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { name: 'Xem Ngày Tốt', item: 'https://latbai.vn/ngay-tot/' },
      { name: `Tháng ${m}/${y}` },
    ]),
  ] };

  const idx = MONTH_LIST.findIndex((x) => x.m === m && x.y === y);
  const prev = MONTH_LIST[idx - 1], next = MONTH_LIST[idx + 1];

  return HEAD(title, desc, url, jsonLd) + `
  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/ngay-tot/">Xem Ngày Tốt</a>
      <i class="ti ti-chevron-right"></i>
      <span>Tháng ${m}/${y}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Ngày Tốt Tháng ${m}/${y} — Cưới Hỏi, Khai Trương, Động Thổ, Xuất Hành</h1>
      <p style="color: var(--muted); font-size: 14px;">Theo lịch vạn niên: trực, sao hoàng đạo/hắc đạo, Tam Nương, Nguyệt Kỵ · Cập nhật ${TODAY}</p>
    </article>

    <div class="article-body">
      <p>Tháng ${m}/${y} có <strong>${goodCount} ngày hoàng đạo</strong>. Dưới đây là những ngày đẹp nhất cho 4 việc trọng đại, chấm điểm theo <strong>trực của ngày</strong> (12 trực), <strong>sao hoàng đạo/hắc đạo</strong> và loại trừ các ngày kiêng Tam Nương, Nguyệt Kỵ. Muốn lọc thêm ngày xung tuổi của riêng bạn, dùng <a href="/ngay-tot/">công cụ Xem Ngày Tốt</a>.</p>

${Object.entries(perEvent).map(([key, { ev, days, strong }]) => `      <h2 class="tuvi">Ngày tốt ${ev.label.toLowerCase()} tháng ${m}/${y}</h2>
${days.length ? `      ${strong ? '' : `<p><em>Tháng này không có ngày thật sự vượng cho ${ev.label.toLowerCase()} — dưới đây là những ngày khá nhất:</em></p>\n`}      <div class="table-responsive">
        <table class="seo-table">
          <thead><tr><th>Ngày</th><th>Âm lịch</th><th>Can chi</th><th>Trực</th><th>Sao</th></tr></thead>
          <tbody>
${days.map(({ d, r }) => `            <tr><td><strong>${dowOf(d, m, y)} ${d}/${m}</strong></td><td>${r.lunar.day}/${r.lunar.month}</td><td>${esc(r.dc.text)}</td><td>${esc(r.trucName)}</td><td>${esc(r.god.name)}</td></tr>`).join('\n')}
          </tbody>
        </table>
      </div>
      <p>Xem tiêu chí chọn ngày ${ev.label.toLowerCase()} chi tiết tại <a href="/ngay-tot/${ev.slug}">trang ngày tốt ${ev.label.toLowerCase()}</a>.</p>` : `      <p>Tháng này không có ngày đủ đẹp cho ${ev.label.toLowerCase()} — xem ${next ? `<a href="${monthPath(next.m, next.y)}">tháng ${next.m}/${next.y}</a>` : 'tháng kế tiếp'}.</p>`}`).join('\n\n')}

      <h2 class="tuvi">Lịch trực &amp; sao cả tháng ${m}/${y}</h2>
      <div class="table-responsive">
        <table class="seo-table">
          <thead><tr><th>Ngày</th><th>Âm lịch</th><th>Can chi</th><th>Trực</th><th>Sao</th><th>Ghi chú</th></tr></thead>
          <tbody>
${allRows.map(({ d, r }) => `            <tr><td>${d}/${m}</td><td>${r.lunar.day}/${r.lunar.month}</td><td>${esc(r.dc.text)}</td><td>${esc(r.trucName)}</td><td>${r.god.good ? '<strong>' + esc(r.god.name) + '</strong> (hoàng đạo)' : esc(r.god.name) + ' (hắc đạo)'}</td><td>${esc(r.notes.join(', ') || '—')}</td></tr>`).join('\n')}
          </tbody>
        </table>
      </div>

      <a href="/ngay-tot/" class="article-cta tuvi">
        <i class="ti ti-calendar-star"></i> Lọc ngày tốt theo tuổi của bạn — miễn phí
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
        <p><strong>Lưu ý:</strong> Kết quả dựa trên lịch pháp cổ truyền (trực, sao, ngày kiêng dân gian), mang tính tham khảo — chưa xét tuổi từng người.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Xem thêm</h3>
      <div class="related-list">
${prev ? `        <a href="${monthPath(prev.m, prev.y)}" class="related-item"><i class="ti ti-arrow-left"></i> Ngày tốt tháng ${prev.m}/${prev.y}</a>\n` : ''}${next ? `        <a href="${monthPath(next.m, next.y)}" class="related-item"><i class="ti ti-arrow-right"></i> Ngày tốt tháng ${next.m}/${next.y}</a>\n` : ''}        <a href="/thuvien/han-tam-tai" class="related-item"><i class="ti ti-alert-triangle"></i> Hạn tam tai — tuổi nào đang phạm?</a>
        <a href="/gieoque/" class="related-item"><i class="ti ti-yin-yang"></i> Gieo quẻ hỏi việc nên hay không</a>
      </div>
    </div>

  </main>

` + FOOTER;
}

// ============================================================
// Hub theo việc
// ============================================================
const HUB_INTRO = {
  cuoi: 'Ngày cưới đẹp theo lịch vạn niên là ngày hoàng đạo mang trực hợp hôn sự — <strong>Bình</strong> (êm hòa), <strong>Định</strong> (ổn định), <strong>Thành</strong> (viên mãn), <strong>Khai</strong> (khai mở) — và tránh trực Trừ, Mãn, Phá cùng các ngày Tam Nương, Nguyệt Kỵ. Quan trọng không kém: ngày không được lục xung với tuổi cô dâu, chú rể.',
  khaitruong: 'Ngày khai trương đẹp cần sao hoàng đạo và trực mang khí "mở, đầy, thành" — <strong>Khai</strong>, <strong>Thành</strong>, <strong>Mãn</strong> — để việc buôn bán hanh thông, tài khí tụ về. Tránh trực Trừ, Chấp, Phá, Bế (khí đóng, tan) và ngày xung tuổi người đứng tên.',
  dongtho: 'Động thổ đụng đến thổ khí nên kén ngày nhất: hợp trực <strong>Chấp</strong> (nắm giữ chắc) và <strong>Khai</strong> (khai mở); đại kỵ trực Kiến, Phá, Nguy. Ngoài ngày đẹp chung còn phải xét tuổi gia chủ — năm phạm tam tai hoặc Kim Lâu thường mượn tuổi làm nhà.',
  xuathanh: 'Xuất hành xa hợp trực mang khí chuyển động — <strong>Kiến</strong> (khởi), <strong>Trừ</strong> (bỏ cũ), <strong>Bình</strong> (êm), <strong>Khai</strong> (thông) — tránh trực Định, Chấp, Thu, Bế (khí giữ, đóng) và Nguy (hiểm). Chọn thêm giờ hoàng đạo để khởi hành càng tốt.',
};

function buildHubPage(key) {
  const ev = EVENTS[key];
  const url = `https://latbai.vn/ngay-tot/${ev.slug}`;
  const months = MONTH_LIST.slice(0, 3);
  const title = `Ngày Tốt ${ev.label} ${months.map((x) => `Tháng ${x.m}`).join(', ')}/${months[months.length - 1].y} | latbai.vn`;
  const desc = `Xem ngày tốt ${ev.label.toLowerCase()} 3 tháng tới theo lịch vạn niên: ngày hoàng đạo, trực hợp việc, tránh Tam Nương/Nguyệt Kỵ — kèm âm lịch và can chi từng ngày.`;

  const sections = months.map(({ m, y }) => {
    const good = topDays(m, y, key, 3);
    const days = (good.length ? good : topDays(m, y, key, 2)).slice(0, 5);
    return { m, y, days, strong: good.length > 0 };
  });

  const firstBest = sections.find((s) => s.days.length)?.days[0];
  const faq = [
    { q: `Ngày nào tốt nhất để ${ev.label.toLowerCase()} sắp tới?`, a: firstBest ? `Gần nhất là ${fmtDay(firstBest.d, sections.find((s) => s.days.length).m, sections.find((s) => s.days.length).y, firstBest.r)}. Danh sách đầy đủ 3 tháng có trong bài; nên kiểm tra thêm xung tuổi tại công cụ Xem Ngày Tốt.` : `Xem danh sách theo tháng trong bài — và dùng công cụ Xem Ngày Tốt của latbai.vn để lọc theo tuổi của bạn.` },
    { q: `Chọn ngày ${ev.label.toLowerCase()} dựa trên tiêu chí nào?`, a: HUB_INTRO[key].replace(/<[^>]+>/g, '') },
    { q: `Ngày đẹp chung có cần xét tuổi không?`, a: 'Có. Ngày đẹp theo lịch vẫn có thể lục xung với tuổi của bạn (ví dụ ngày Tý xung tuổi Ngọ). Tạo Hồ Sơ Huyền Học tại latbai.vn để công cụ tự trừ điểm ngày xung tuổi.' },
  ];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    articleLd(`Ngày tốt ${ev.label.toLowerCase()} 3 tháng tới`, desc, url),
    faqLd(faq),
    breadcrumbLd([
      { name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { name: 'Xem Ngày Tốt', item: 'https://latbai.vn/ngay-tot/' },
      { name: `Ngày tốt ${ev.label.toLowerCase()}` },
    ]),
  ] };

  return HEAD(title, desc, url, jsonLd) + `
  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/ngay-tot/">Xem Ngày Tốt</a>
      <i class="ti ti-chevron-right"></i>
      <span>${esc(ev.label)}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Ngày Tốt ${esc(ev.label)} — 3 Tháng Tới</h1>
      <p style="color: var(--muted); font-size: 14px;">Theo lịch vạn niên · Cập nhật ${TODAY}</p>
    </article>

    <div class="article-body">
      <p>${HUB_INTRO[key]}</p>

${sections.map(({ m, y, days, strong }) => `      <h2 class="tuvi">Ngày tốt ${esc(ev.label.toLowerCase())} tháng ${m}/${y}</h2>
${days.length ? `      ${strong ? '' : `<p><em>Tháng này không có ngày thật sự vượng — dưới đây là những ngày khá nhất:</em></p>\n`}      <div class="table-responsive">
        <table class="seo-table">
          <thead><tr><th>Ngày</th><th>Âm lịch</th><th>Can chi</th><th>Trực</th><th>Sao</th></tr></thead>
          <tbody>
${days.map(({ d, r }) => `            <tr><td><strong>${dowOf(d, m, y)} ${d}/${m}</strong></td><td>${r.lunar.day}/${r.lunar.month}</td><td>${esc(r.dc.text)}</td><td>${esc(r.trucName)}</td><td>${esc(r.god.name)}</td></tr>`).join('\n')}
          </tbody>
        </table>
      </div>
      <p>Toàn bộ lịch tháng: <a href="${monthPath(m, y)}">ngày tốt tháng ${m}/${y}</a>.</p>` : `      <p>Tháng ${m}/${y} không có ngày đủ đẹp — xem <a href="${monthPath(m, y)}">lịch chi tiết tháng ${m}/${y}</a>.</p>`}`).join('\n\n')}

      <a href="/ngay-tot/" class="article-cta tuvi">
        <i class="ti ti-calendar-star"></i> Lọc ngày ${esc(ev.label.toLowerCase())} hợp tuổi bạn — miễn phí
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
        <p><strong>Lưu ý:</strong> Kết quả theo lịch pháp cổ truyền, mang tính tham khảo — ngày đẹp nhất vẫn cần hợp tuổi người chủ sự.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Xem thêm</h3>
      <div class="related-list">
${Object.entries(EVENTS).filter(([k]) => k !== key).map(([, o]) => `        <a href="/ngay-tot/${o.slug}" class="related-item"><i class="ti ${o.icon}"></i> Ngày tốt ${esc(o.label.toLowerCase())}</a>`).join('\n')}
        <a href="/thuvien/han-tam-tai" class="related-item"><i class="ti ti-alert-triangle"></i> Hạn tam tai — tuổi nào đang phạm?</a>
      </div>
    </div>

  </main>

` + FOOTER;
}

// ---- Generate ----
for (const { m, y } of MONTH_LIST) {
  fs.writeFileSync(path.join(OUT, `thang-${m}-${y}.html`), buildMonthPage(m, y), 'utf8');
}
for (const key of Object.keys(EVENTS)) {
  fs.writeFileSync(path.join(OUT, `${EVENTS[key].slug}.html`), buildHubPage(key), 'utf8');
}

// Sitemap: mọi trang thang-*.html đang có trên đĩa (giữ cả tháng cũ) + 4 hub
const monthFiles = fs.readdirSync(OUT).filter((f) => /^thang-\d+-\d+\.html$/.test(f))
  .sort((a, b) => {
    const [, ma, ya] = a.match(/thang-(\d+)-(\d+)/).map(Number);
    const [, mb, yb] = b.match(/thang-(\d+)-(\d+)/).map(Number);
    return ya - yb || ma - mb;
  });
const urls = [
  ...monthFiles.map((f) => `https://latbai.vn/ngay-tot/${f.replace('.html', '')}`),
  ...Object.values(EVENTS).map((ev) => `https://latbai.vn/ngay-tot/${ev.slug}`),
];
console.log(`Generated ${MONTH_LIST.length} month pages + 4 hubs (sitemap: ${urls.length} URLs)`);

const block = [
  '  <!-- ngaytot:start (generated by scripts/build-ngaytot-pages.mjs) -->',
  ...urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`),
  '  <!-- ngaytot:end -->',
].join('\n');

let sitemap = fs.readFileSync(SITEMAP, 'utf8');
if (sitemap.includes('<!-- ngaytot:start')) {
  sitemap = sitemap.replace(/ {2}<!-- ngaytot:start[\s\S]*?<!-- ngaytot:end -->/, block);
} else {
  sitemap = sitemap.replace('</urlset>', `${block}\n</urlset>`);
}
fs.writeFileSync(SITEMAP, sitemap, 'utf8');
console.log('Sitemap updated.');
