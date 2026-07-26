/**
 * scripts/build-licham-pages.mjs — sinh trang tĩnh cho module Lịch Âm:
 *   - Trang ngày:     /lich-am/ngay-{d}-{m}-{yyyy}   (cửa sổ 6 tháng + mọi file đã có trên đĩa)
 *   - 24 tiết khí:    /lich-am/tiet-khi-{slug}
 *   - 2 hub:          /lich-am/lich-van-nien · /lich-am/24-tiet-khi
 *
 * Dữ liệu: js/amlich.js (số) + lich-am/js/licham-data.js (chữ) — không copy lại dữ liệu.
 * Khuôn: bám scripts/build-xinxam-pages.mjs.
 *
 * ⚠ QUAN TRỌNG — trang ngày TUYỆT ĐỐI KHÔNG được chứa ngày hôm nay (TODAY) ở bất kỳ
 * đâu, kể cả dateModified trong JSON-LD. Nếu có, mỗi lần cron chạy sẽ đổi nội dung
 * hàng trăm file ⇒ update-sitemap-lastmod.mjs bump lastmod hàng loạt và giết sạch tín
 * hiệu (đã xảy ra 2026-07-25, bump oan 759 URL). Cách kiểm: chạy script HAI LẦN liên
 * tiếp, lần hai `git status` phải sạch.
 *
 * Run: node scripts/build-licham-pages.mjs && npm run seo:lastmod
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'lich-am');
const SITEMAP = path.join(ROOT, 'sitemap-latbai.xml');

// Runner CI chạy UTC — phải tính "hôm nay" theo giờ VN, nếu không output ở máy local
// và ở CI sẽ khác nhau, và cơ chế hash lastmod phụ thuộc vào việc chúng giống hệt.
const _vn = new Date(Date.now() + 7 * 3600e3);
const TODAY_VN = { d: _vn.getUTCDate(), m: _vn.getUTCMonth() + 1, y: _vn.getUTCFullYear() };

const MONTHS_AHEAD = 6;      // cửa sổ sinh mới
const MAX_DAY_PAGES = 2500;  // tripwire: thà đỏ CI còn hơn phình sitemap âm thầm

// ---- Nạp engine + nội dung ----
const W = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'js', 'amlich.js'), 'utf8'))(W);
const A = W.AmLich;
const D = new Function(`${fs.readFileSync(path.join(ROOT, 'lich-am', 'js', 'licham-data.js'), 'utf8')}; return LICHAM_DATA;`)();
if (!A || !D) throw new Error('Không nạp được AmLich hoặc LICHAM_DATA');
if (D.TIET_KHI.length !== 24) throw new Error(`LICHAM_DATA.TIET_KHI phải có 24 mục, đang có ${D.TIET_KHI.length}`);
for (let i = 0; i < 24; i++) {
  if (D.TIET_KHI[i].ten !== A.TIET_KHI[i].name) {
    throw new Error(`Tiết khí lệch tại index ${i}: data "${D.TIET_KHI[i].ten}" vs engine "${A.TIET_KHI[i].name}"`);
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CYAN = '#0e7490';
const OG = 'https://latbai.vn/images/og-licham.png';
const DOW = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const HUB_VN = '/lich-am/lich-van-nien';
const HUB_TK = '/lich-am/24-tiet-khi';

const dayFile = (d, m, y) => `ngay-${d}-${m}-${y}.html`;
const dayPath = (d, m, y) => `/lich-am/ngay-${d}-${m}-${y}`;
const tkPath = (slug) => `/lich-am/tiet-khi-${slug}`;
const tkBySlug = Object.fromEntries(D.TIET_KHI.map((t) => [t.i, t]));

// ---- Luận ngày tốt xấu: chép từ scripts/build-ngaytot-pages.mjs ----
// (sửa bảng bên đó thì sửa cả đây — hai script cùng mô tả một hệ luận giải)
const EVENT_LABEL = {
  cuoi: 'cưới hỏi', khaitruong: 'khai trương', dongtho: 'động thổ', nhaptrach: 'về nhà mới',
  xuathanh: 'xuất hành', kyhopdong: 'ký kết', muasam: 'mua sắm lớn', cautai: 'cầu tài lộc',
};
const EVENT_HUB = { cuoi: '/ngay-tot/cuoi-hoi', khaitruong: '/ngay-tot/khai-truong', dongtho: '/ngay-tot/dong-tho', xuathanh: '/ngay-tot/xuat-hanh' };
const TRUC_INFO = {
  'Kiến': { good: ['xuathanh', 'kyhopdong', 'cautai'], bad: ['dongtho'], desc: 'Trực Kiến chủ sự khởi đầu, hợp xuất hành và mở lời cho việc mới, nhưng kiêng động thổ.' },
  'Trừ':  { good: ['xuathanh'], bad: ['cuoi', 'khaitruong'], desc: 'Trực Trừ chủ việc dọn bỏ cái cũ, hợp thanh lý sửa sang hơn là khai mở việc vui.' },
  'Mãn':  { good: ['cautai', 'muasam', 'khaitruong'], bad: ['cuoi'], desc: 'Trực Mãn chủ sự đầy đủ, hợp thu nạp tài lộc và mua sắm, nhưng không hợp cưới hỏi.' },
  'Bình': { good: ['cuoi', 'xuathanh', 'kyhopdong'], bad: [], desc: 'Trực Bình chủ sự bằng phẳng ổn thoả, là ngày trung hoà dễ dùng cho nhiều việc.' },
  'Định': { good: ['cuoi', 'kyhopdong', 'nhaptrach', 'muasam'], bad: ['xuathanh'], desc: 'Trực Định chủ sự yên định, rất hợp cưới hỏi và ký kết, nhưng kiêng đi xa.' },
  'Chấp': { good: ['dongtho'], bad: ['xuathanh', 'khaitruong', 'cautai'], desc: 'Trực Chấp chủ sự nắm giữ, hợp khởi công xây dựng hơn là mở mang giao thương.' },
  'Phá':  { good: [], bad: ['cuoi', 'khaitruong', 'dongtho', 'nhaptrach', 'kyhopdong', 'muasam', 'cautai'], desc: 'Trực Phá chủ sự tan vỡ — ngày kiêng gần như mọi việc trọng đại.' },
  'Nguy': { good: [], bad: ['xuathanh', 'dongtho', 'muasam'], desc: 'Trực Nguy chủ sự hiểm nguy, nên tránh đi xa và các việc cần leo trèo, đào bới.' },
  'Thành': { good: ['cuoi', 'khaitruong', 'nhaptrach', 'kyhopdong', 'cautai'], bad: [], desc: 'Trực Thành chủ sự thành tựu — một trong những trực đẹp nhất cho việc lớn.' },
  'Thu':  { good: ['cautai', 'muasam'], bad: ['xuathanh'], desc: 'Trực Thu chủ sự thu vén, hợp thu tiền thu hàng, không hợp khởi hành.' },
  'Khai': { good: ['khaitruong', 'cuoi', 'xuathanh', 'dongtho'], bad: [], desc: 'Trực Khai chủ sự mở ra, hợp khai trương và mọi việc bắt đầu.' },
  'Bế':   { good: [], bad: ['khaitruong', 'xuathanh', 'nhaptrach'], desc: 'Trực Bế chủ sự đóng lại, nên tránh mở hàng, dọn nhà hay khởi hành.' },
};
const RATING_TEXT = ['Ngày xấu', 'Bình thường', 'Khá tốt', 'Ngày tốt'];

function analyzeDay(info) {
  const trucName = info.truc.name;
  const truc = TRUC_INFO[trucName];
  let score = info.god.good ? 3 : -3;
  const notes = [];
  if (info.kieng.tamNuong) { score -= 2; notes.push('Tam Nương'); }
  if (info.kieng.nguyetKy) { score -= 2; notes.push('Nguyệt Kỵ'); }
  if (info.kieng.duongCong) notes.push('Dương công kỵ nhật');
  let rating;
  if (score >= 4) rating = 3; else if (score >= 2) rating = 2; else if (score > -2) rating = 1; else rating = 0;
  return { trucName, truc, score, rating, notes };
}

// ---- Khuôn trang (bám build-xinxam-pages.mjs) ----
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
    /* thuvien.css không có --c-licham nên CTA/h2 sẽ ra xanh Thư Viện — chỉnh về tông cyan module */
    .article-cta.licham{background-color:${CYAN};}
    .article-body h2.licham{border-left-color:${CYAN};}
    .la-big{text-align:center;font-size:56px;font-weight:900;line-height:1;color:${CYAN};margin:10px 0 2px;}
    .la-badge{display:inline-block;font-weight:800;font-size:12px;letter-spacing:.5px;border:1px solid currentColor;border-radius:99px;padding:3px 12px;}
    .la-hd{color:#0d9668}.la-hac{color:#dc2626}
    .la-chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;}
    .la-chips a,.la-chips span{font-size:12.5px;font-weight:700;text-decoration:none;color:${CYAN};background:rgba(14,116,144,.07);border:1px solid rgba(14,116,144,.18);border-radius:99px;padding:4px 11px;}
    .la-chips b{color:#111;}
  </style>
  <script src="/js/mystic-fx.js" defer data-color="14,116,144" data-glyphs="☾☽❉" data-count="28"></script>
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
        <a href="/lich-am/">Lịch Âm</a> ·
        <a href="${HUB_TK}">24 Tiết Khí</a> ·
        <a href="/ngay-tot/">Xem Ngày Tốt</a> ·
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
// KHÔNG có dateModified — xem cảnh báo ở đầu file.
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

// ============================================================
// Trang ngày
// ============================================================
function buildDayPage(d, m, y, slugSet) {
  const info = A.dayInfo(d, m, y);
  const L = info.lunar;
  const an = analyzeDay(info);
  const tkData = tkBySlug[info.tietKhi.index];
  const tkStart = A.jdToDate(info.tietKhi.startJdn);
  const url = `https://latbai.vn${dayPath(d, m, y)}`;
  const dow = DOW[info.weekday];
  const amStr = `${L.day}/${L.month}${L.leap ? ' nhuận' : ''}`;

  const title = `Ngày ${d}/${m}/${y} Là Ngày Bao Nhiêu Âm Lịch? Lịch Âm ${dow} ${d}/${m}/${y} | latbai.vn`;
  const desc = `Ngày ${d}/${m}/${y} dương lịch là ${amStr} âm lịch, năm ${info.yearCanChi.text}, ngày ${info.dayCanChi.text}, trực ${an.trucName}, sao ${info.god.name}. Xem giờ hoàng đạo, tiết khí và ngày tốt xấu.`;

  const lead = `Ngày <strong>${dow} ${d}/${m}/${y}</strong> dương lịch là ngày <strong>${amStr}</strong> âm lịch, năm <strong>${info.yearCanChi.text}</strong>, tháng <strong>${info.monthCanChi.text}</strong>, ngày <strong>${info.dayCanChi.text}</strong>, trực <strong>${an.trucName}</strong>, sao <strong>${info.god.name}</strong> (${info.god.good ? 'hoàng đạo' : 'hắc đạo'}).`;

  const hopList = an.truc.good.map((k) => EVENT_LABEL[k]).filter(Boolean);
  const kyList = an.truc.bad.map((k) => EVENT_LABEL[k]).filter(Boolean);
  const hubLinks = an.truc.good.filter((k) => EVENT_HUB[k]).slice(0, 2)
    .map((k) => `<a href="${EVENT_HUB[k]}">chọn ngày ${EVENT_LABEL[k]}</a>`).join(' · ');

  // Bảng lịch âm 7 ngày quanh ngày này
  const week = [];
  for (let off = -3; off <= 3; off++) {
    const g = A.jdToDate(info.jdn + off);
    const wi = A.dayInfo(g.day, g.month, g.year);
    const has = slugSet.has(dayFile(g.day, g.month, g.year));
    week.push(`            <tr${off === 0 ? ' style="background:rgba(14,116,144,.06);font-weight:700"' : ''}>
              <td>${has && off !== 0 ? `<a href="${dayPath(g.day, g.month, g.year)}">${g.day}/${g.month}</a>` : `${g.day}/${g.month}`}</td>
              <td>${DOW[wi.weekday]}</td>
              <td>${wi.lunar.day}/${wi.lunar.month}${wi.lunar.leap ? ' nh' : ''}</td>
              <td>${wi.dayCanChi.text}</td>
              <td>${A.TRUC[A.trucOfDay(wi.dayCanChi.chi, wi.lunar.month)]}</td>
              <td>${wi.god.good ? 'Hoàng đạo' : 'Hắc đạo'}</td>
            </tr>`);
  }

  // Lễ tết rơi vào ngày này
  const le = D.LE_TET.filter((l) => l.lich === 'duong'
    ? (l.d === d && l.m === m)
    : (l.d === L.day && l.m === L.month && !L.leap));

  let amSpecial;
  if (le.length) amSpecial = le.map((l) => `<p><strong>${esc(l.ten)}.</strong> ${esc(l.mo)}</p>`).join('\n      ');
  else if (L.day === 1) amSpecial = `<p>Đây là <strong>mùng một tháng ${L.month} âm lịch</strong> — ngày đầu tháng, theo tục lệ nhiều gia đình Việt thắp hương gia tiên, đi lễ chùa và ăn chay để cầu một tháng bình an.</p>`;
  else if (L.day === 15) amSpecial = `<p>Đây là <strong>ngày rằm tháng ${L.month} âm lịch</strong> — trăng tròn nhất tháng. Cùng với mùng một, rằm là dịp lễ bái quen thuộc trong nếp sống người Việt.</p>`;
  else amSpecial = `<p>Ngày ${amStr} âm lịch là một ngày thường trong tháng ${L.month}, không trùng lễ tết lớn. ${L.day < 15 ? 'Đang ở nửa đầu tháng âm, trăng đang lên dần về phía rằm.' : 'Đang ở nửa sau tháng âm, trăng khuyết dần về phía cuối tháng.'}</p>`;

  const faq = [
    { q: `Ngày ${d}/${m}/${y} là ngày bao nhiêu âm lịch?`, a: `Ngày ${d}/${m}/${y} dương lịch tương ứng với ngày ${amStr} âm lịch, năm ${info.yearCanChi.text}. Đây là ${dow}, ngày ${info.dayCanChi.text}, tháng ${info.monthCanChi.text}.` },
    { q: `Ngày ${d}/${m}/${y} là ngày tốt hay xấu?`, a: `Theo lịch pháp cổ truyền, ngày ${d}/${m}/${y} có sao ${info.god.name} (${info.god.good ? 'hoàng đạo' : 'hắc đạo'}) và trực ${an.trucName}, xếp loại ${RATING_TEXT[an.rating].toLowerCase()}. ${hopList.length ? `Trực ${an.trucName} hợp việc ${hopList.join(', ')}.` : ''} ${an.notes.length ? `Lưu ý: ${an.notes.join(', ')}.` : ''}`.trim() },
    { q: `Giờ hoàng đạo ngày ${d}/${m}/${y} là mấy giờ?`, a: `Các khung giờ hoàng đạo trong ngày ${d}/${m}/${y} là: ${info.goodHours.join(', ')}. Đây là những giờ được xem là thuận lợi để khởi sự việc quan trọng.` },
    { q: `Ngày ${d}/${m}/${y} thuộc tiết khí nào?`, a: `Ngày ${d}/${m}/${y} nằm trong tiết ${tkData.ten} (bắt đầu ngày ${tkStart.day}/${tkStart.month}), là ngày thứ ${info.tietKhi.dayInTerm} của tiết. ${tkData.tomTat}` },
  ];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    articleLd(`Lịch âm ngày ${d}/${m}/${y}`, desc, url),
    faqLd(faq),
    breadcrumbLd([
      { name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { name: 'Lịch Âm', item: 'https://latbai.vn/lich-am/' },
      { name: 'Lịch Vạn Niên', item: `https://latbai.vn${HUB_VN}` },
      { name: `Ngày ${d}/${m}/${y}` },
    ]),
  ] };

  const prevG = A.jdToDate(info.jdn - 1);
  const nextG = A.jdToDate(info.jdn + 1);
  const relPrev = slugSet.has(dayFile(prevG.day, prevG.month, prevG.year))
    ? `        <a href="${dayPath(prevG.day, prevG.month, prevG.year)}" class="related-item"><i class="ti ti-arrow-left"></i> Lịch âm ngày ${prevG.day}/${prevG.month}/${prevG.year}</a>\n` : '';
  const relNext = slugSet.has(dayFile(nextG.day, nextG.month, nextG.year))
    ? `        <a href="${dayPath(nextG.day, nextG.month, nextG.year)}" class="related-item"><i class="ti ti-arrow-right"></i> Lịch âm ngày ${nextG.day}/${nextG.month}/${nextG.year}</a>\n` : '';

  return HEAD(title, desc, url, jsonLd) + `
  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/lich-am/">Lịch Âm</a>
      <i class="ti ti-chevron-right"></i>
      <span>${d}/${m}/${y}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Ngày ${d}/${m}/${y} Là Ngày Bao Nhiêu Âm Lịch?</h1>
      <p style="color: var(--muted); font-size: 14px;">${dow} · Âm lịch ${amStr} · Năm ${esc(info.yearCanChi.text)}</p>
    </article>

    <div class="article-body">
      <p class="la-big">${L.day}</p>
      <p style="text-align:center;margin-top:0;"><span class="la-badge ${info.god.good ? 'la-hd' : 'la-hac'}">${info.god.good ? 'Hoàng đạo' : 'Hắc đạo'}</span></p>

      <p>${lead}</p>

      <h2 class="licham">1. Bảng lịch ngày ${d}/${m}/${y}</h2>
      <div class="table-responsive">
        <table class="seo-table">
          <tbody>
            <tr><td><strong>Dương lịch</strong></td><td>${dow}, ${d}/${m}/${y}</td></tr>
            <tr><td><strong>Âm lịch</strong></td><td>${amStr} năm ${esc(info.yearCanChi.text)}</td></tr>
            <tr><td><strong>Ngày (can chi)</strong></td><td>${esc(info.dayCanChi.text)}</td></tr>
            <tr><td><strong>Tháng (can chi)</strong></td><td>${esc(info.monthCanChi.text)}</td></tr>
            <tr><td><strong>Năm (can chi)</strong></td><td>${esc(info.yearCanChi.text)}</td></tr>
            <tr><td><strong>Nạp âm ngày</strong></td><td>${esc(info.napAm.name)} (${esc(info.napAm.element)})</td></tr>
            <tr><td><strong>Trực</strong></td><td>${esc(an.trucName)}</td></tr>
            <tr><td><strong>Sao</strong></td><td>${esc(info.god.name)} — ${info.god.good ? 'hoàng đạo' : 'hắc đạo'}</td></tr>
            <tr><td><strong>Tiết khí</strong></td><td>${esc(tkData.ten)} (từ ${tkStart.day}/${tkStart.month})</td></tr>
            <tr><td><strong>Xung tuổi</strong></td><td>Tuổi ${esc(info.xungChi)}</td></tr>
            <tr><td><strong>Hỷ thần</strong></td><td>${esc(info.huong.hyThan)}</td></tr>
            <tr><td><strong>Tài thần</strong></td><td>${esc(info.huong.taiThan)}</td></tr>
          </tbody>
        </table>
      </div>

      <h2 class="licham">2. Ngày ${esc(info.dayCanChi.text)} — trực ${esc(an.trucName)}, sao ${esc(info.god.name)}</h2>
      <p>${esc(an.truc.desc)}</p>
      <p>Sao <strong>${esc(info.god.name)}</strong> chiếu ngày này nên đây là ngày <strong>${info.god.good ? 'hoàng đạo' : 'hắc đạo'}</strong>. ${info.god.good ? 'Theo quan niệm cổ truyền, ngày hoàng đạo có sao tốt trực nhật, thuận cho việc khởi sự.' : 'Ngày hắc đạo có sao xấu trực nhật, người xưa thường tránh khởi sự việc lớn, hoặc chọn giờ hoàng đạo trong ngày để hoá giải phần nào.'}</p>
      <p>Ngày ${esc(info.dayCanChi.text)} mang nạp âm <strong>${esc(info.napAm.name)}</strong>, hành ${esc(info.napAm.element)}. Ngày này xung với tuổi <strong>${esc(info.xungChi)}</strong> — người tuổi ${esc(info.xungChi)} nên cân nhắc nếu định làm việc trọng đại.</p>

      <h2 class="licham">3. Giờ hoàng đạo ngày ${d}/${m}/${y}</h2>
      <p>Mỗi ngày có 12 canh giờ, trong đó 6 giờ được xem là hoàng đạo. Bảng dưới đây liệt kê đủ 12 canh giờ, các giờ hoàng đạo được in đậm:</p>
      <div class="table-responsive">
        <table class="seo-table">
          <thead><tr><th>Canh giờ</th><th>Khung giờ</th><th>Can chi giờ</th><th>Tốt / xấu</th></tr></thead>
          <tbody>
${info.hours.map((h) => `            <tr><td>${h.good ? `<strong>${h.chi}</strong>` : h.chi}</td><td>${h.range}</td><td>${esc(h.canChi)}</td><td>${h.good ? '<strong>Hoàng đạo</strong>' : 'Hắc đạo'}</td></tr>`).join('\n')}
          </tbody>
        </table>
      </div>
      <p>Nếu cần chọn giờ khởi hành, ký kết hay làm lễ trong ngày ${d}/${m}/${y}, nên ưu tiên các khung: <strong>${info.goodHours.join(', ')}</strong>.</p>

      <h2 class="licham">4. Tiết khí ${esc(tkData.ten)}</h2>
      <p>Ngày ${d}/${m}/${y} nằm trong tiết <strong>${esc(tkData.ten)}</strong> (${esc(tkData.han)}), bắt đầu từ ngày ${tkStart.day}/${tkStart.month} — tính đến hôm nay là ngày thứ ${info.tietKhi.dayInTerm} của tiết. Đây là tiết thứ ${tkData.i + 1} trong 24 tiết khí, thuộc mùa ${esc(tkData.mua)}.</p>
      <p>${esc(tkData.khiHau)}</p>
      <p>${esc(tkData.nongVu)}</p>
      <p>Đọc thêm về <a href="${tkPath(tkData.slug)}">tiết ${esc(tkData.ten)}</a> và <a href="${HUB_TK}">toàn bộ 24 tiết khí</a>.</p>

      <h2 class="licham">5. Ngày ${d}/${m}/${y} tốt hay xấu?</h2>
      <p>Tổng hợp các yếu tố trên, ngày ${d}/${m}/${y} được xếp loại <strong>${RATING_TEXT[an.rating]}</strong>.</p>
      ${hopList.length ? `<p><strong>Hợp việc:</strong> ${hopList.join(', ')}.</p>` : '<p><strong>Hợp việc:</strong> trực này không đặc biệt hợp việc trọng đại nào.</p>'}
      ${kyList.length ? `<p><strong>Kỵ việc:</strong> ${kyList.join(', ')}.</p>` : ''}
      ${an.notes.length ? `<p><strong>Ngày kiêng dân gian:</strong> ${an.notes.join(', ')}. Đây là tục kiêng để cẩn trọng, không phải điềm dữ.</p>` : ''}
      ${hubLinks ? `<p>Xem thêm: ${hubLinks}.</p>` : ''}

      <h2 class="licham">6. Ngày ${amStr} âm lịch có gì đặc biệt?</h2>
      ${amSpecial}

      <h2 class="licham">7. Lịch âm tuần này</h2>
      <div class="table-responsive">
        <table class="seo-table">
          <thead><tr><th>Dương</th><th>Thứ</th><th>Âm</th><th>Can chi</th><th>Trực</th><th>Sao</th></tr></thead>
          <tbody>
${week.join('\n')}
          </tbody>
        </table>
      </div>

      <a href="/lich-am/" class="article-cta licham">
        <i class="ti ti-calendar-month"></i> Xem lịch âm cả tháng, đổi ngày âm ↔ dương, tra 24 tiết khí
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
        <p><strong>Lưu ý:</strong> Số liệu âm lịch, can chi và tiết khí tính bằng thuật toán thiên văn theo múi giờ Việt Nam (UTC+7). Phần luận đoán tốt xấu theo lịch pháp cổ truyền, mang tính tham khảo &amp; chiêm nghiệm văn hoá.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Xem thêm</h3>
      <div class="related-list">
${relPrev}${relNext}        <a href="/ngay-tot/thang-${m}-${y}" class="related-item"><i class="ti ti-calendar-check"></i> Ngày tốt tháng ${m}/${y}</a>
        <a href="${tkPath(tkData.slug)}" class="related-item"><i class="ti ti-sun"></i> Tiết khí ${esc(tkData.ten)}</a>
        <a href="${HUB_VN}" class="related-item"><i class="ti ti-calendar-month"></i> Lịch vạn niên</a>
        <a href="/lich-am/" class="related-item"><i class="ti ti-moon"></i> Lịch âm hôm nay</a>
      </div>
    </div>

  </main>

` + FOOTER;
}

// ============================================================
// Trang tiết khí
// ============================================================
function buildTietKhiPage(t, slugSet) {
  const url = `https://latbai.vn${tkPath(t.slug)}`;
  const title = `Tiết Khí ${t.ten} Là Gì? Ngày Bắt Đầu, Ý Nghĩa & Nông Vụ | latbai.vn`;
  const desc = `Tiết ${t.ten} (${t.han}) là tiết thứ ${t.i + 1} trong 24 tiết khí, mùa ${t.mua}, ứng kinh độ mặt trời ${t.kinhDo}°. Ngày bắt đầu các năm, khí hậu, nông vụ, sức khỏe và phong tục.`;

  const years = [];
  for (let y = TODAY_VN.y - 2; y <= TODAY_VN.y + 3; y++) {
    const s = A.tietKhiStart(t.i, y);
    if (s) years.push({ y, s, has: slugSet.has(dayFile(s.day, s.month, s.year)) });
  }
  const prev = D.TIET_KHI[(t.i + 23) % 24];
  const next = D.TIET_KHI[(t.i + 1) % 24];

  const faq = [
    { q: `Tiết ${t.ten} là gì?`, a: `${t.ten} nghĩa là ${t.han}, là tiết khí thứ ${t.i + 1} trong 24 tiết khí, thuộc mùa ${t.mua}, ứng với thời điểm mặt trời đi qua kinh độ ${t.kinhDo}°. ${t.tomTat}` },
    { q: `Tiết ${t.ten} năm ${TODAY_VN.y} bắt đầu ngày nào?`, a: years.find((r) => r.y === TODAY_VN.y) ? `Năm ${TODAY_VN.y}, tiết ${t.ten} bắt đầu ngày ${years.find((r) => r.y === TODAY_VN.y).s.day}/${years.find((r) => r.y === TODAY_VN.y).s.month}. Vì tiết khí tính theo mặt trời nên ngày bắt đầu gần như cố định theo dương lịch, chỉ xê dịch một ngày giữa các năm.` : `Xem bảng ngày bắt đầu tiết ${t.ten} các năm ở trên.` },
    { q: `Tiết ${t.ten} nên chú ý gì về sức khỏe?`, a: t.sucKhoe },
  ];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    articleLd(`Tiết khí ${t.ten}`, desc, url),
    faqLd(faq),
    breadcrumbLd([
      { name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { name: 'Lịch Âm', item: 'https://latbai.vn/lich-am/' },
      { name: '24 Tiết Khí', item: `https://latbai.vn${HUB_TK}` },
      { name: `Tiết ${t.ten}` },
    ]),
  ] };

  return HEAD(title, desc, url, jsonLd) + `
  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/lich-am/">Lịch Âm</a>
      <i class="ti ti-chevron-right"></i>
      <a href="${HUB_TK}">24 Tiết Khí</a>
      <i class="ti ti-chevron-right"></i>
      <span>${esc(t.ten)}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Tiết Khí ${esc(t.ten)}: Ngày Bắt Đầu, Ý Nghĩa &amp; Nông Vụ</h1>
      <p style="color: var(--muted); font-size: 14px;">Tiết thứ ${t.i + 1}/24 · Mùa ${esc(t.mua)} · Kinh độ mặt trời ${t.kinhDo}°</p>
    </article>

    <div class="article-body">
      <p><strong>${esc(t.ten)}</strong> nghĩa là <em>${esc(t.han)}</em>. ${esc(t.tomTat)} Đây là tiết khí thứ ${t.i + 1} trong vòng 24 tiết, thuộc mùa ${esc(t.mua)}, ứng với thời điểm mặt trời đi qua kinh độ <strong>${t.kinhDo}°</strong> trên hoàng đạo.</p>

      <h2 class="licham">1. Ngày bắt đầu tiết ${esc(t.ten)} các năm</h2>
      <p>Vì tiết khí neo vào vị trí mặt trời chứ không vào tuần trăng, ngày bắt đầu rơi vào dương lịch khá ổn định, chỉ xê dịch trong một, hai ngày:</p>
      <div class="table-responsive">
        <table class="seo-table">
          <thead><tr><th>Năm</th><th>Ngày bắt đầu</th><th>Nhằm ngày âm lịch</th></tr></thead>
          <tbody>
${years.map((r) => {
  const li = A.solar2lunar(r.s.day, r.s.month, r.s.year);
  const cell = r.has ? `<a href="${dayPath(r.s.day, r.s.month, r.s.year)}">${r.s.day}/${r.s.month}/${r.y}</a>` : `${r.s.day}/${r.s.month}/${r.y}`;
  return `            <tr><td>${r.y}</td><td>${cell}</td><td>${li.day}/${li.month}${li.leap ? ' nhuận' : ''}</td></tr>`;
}).join('\n')}
          </tbody>
        </table>
      </div>

      <h2 class="licham">2. Khí hậu tiết ${esc(t.ten)}</h2>
      <p>${esc(t.khiHau)}</p>

      <h2 class="licham">3. Nông vụ</h2>
      <p>${esc(t.nongVu)}</p>

      <h2 class="licham">4. Sức khỏe &amp; ăn uống</h2>
      <p>${esc(t.sucKhoe)}</p>

      <h2 class="licham">5. Phong tục liên quan</h2>
      <p>${esc(t.phongTuc)}</p>

      <h2 class="licham">6. Vị trí của ${esc(t.ten)} trong 24 tiết khí</h2>
      <div class="la-chips">
${D.TIET_KHI.map((o) => o.i === t.i
  ? `        <span><b>${esc(o.ten)}</b></span>`
  : `        <a href="${tkPath(o.slug)}">${esc(o.ten)}</a>`).join('\n')}
      </div>
      <p>Hệ 24 tiết khí hình thành ở lưu vực Hoàng Hà nên mô tả khí hậu bám sát <strong>miền Bắc Việt Nam</strong> nhất. Miền Nam về cơ bản chỉ có mùa mưa và mùa khô, nên phần khí hậu ở trên mang tính tham chiếu.</p>

      <a href="/lich-am/" class="article-cta licham">
        <i class="ti ti-moon"></i> Xem lịch âm hôm nay, đổi ngày âm ↔ dương, tra can chi
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
        <p><strong>Lưu ý:</strong> Ngày bắt đầu tiết khí tính bằng thuật toán thiên văn theo múi giờ Việt Nam (UTC+7), có thể lệch một ngày so với vài cuốn lịch in khi thời điểm giao tiết rơi sát nửa đêm.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Xem thêm</h3>
      <div class="related-list">
        <a href="${tkPath(prev.slug)}" class="related-item"><i class="ti ti-arrow-left"></i> Tiết trước: ${esc(prev.ten)}</a>
        <a href="${tkPath(next.slug)}" class="related-item"><i class="ti ti-arrow-right"></i> Tiết sau: ${esc(next.ten)}</a>
        <a href="${HUB_TK}" class="related-item"><i class="ti ti-list"></i> Bảng đầy đủ 24 tiết khí</a>
        <a href="${HUB_VN}" class="related-item"><i class="ti ti-calendar-month"></i> Lịch vạn niên</a>
        <a href="/ngay-tot/" class="related-item"><i class="ti ti-calendar-check"></i> Xem ngày tốt</a>
      </div>
    </div>

  </main>

` + FOOTER;
}

// ============================================================
// Hub: lịch vạn niên
// ============================================================
function buildHubVanNien(allDays) {
  const url = `https://latbai.vn${HUB_VN}`;
  const title = 'Lịch Vạn Niên — Tra Cứu Lịch Âm Từng Ngày | latbai.vn';
  const desc = 'Lịch vạn niên tra cứu từng ngày: đổi ngày âm dương, can chi ngày tháng năm, 12 Trực, sao hoàng đạo, giờ hoàng đạo và tiết khí. Danh sách đầy đủ các ngày đã lập trang chi tiết.';

  // nhóm theo tháng
  const byMonth = new Map();
  for (const x of allDays) {
    const k = `${x.y}-${x.m}`;
    if (!byMonth.has(k)) byMonth.set(k, { y: x.y, m: x.m, days: [] });
    byMonth.get(k).days.push(x);
  }
  const months = [...byMonth.values()].sort((a, b) => a.y - b.y || a.m - b.m);
  const cutoff = TODAY_VN.y * 12 + TODAY_VN.m - 3;    // tháng cũ hơn 3 tháng thì rút gọn
  const full = months.filter((mo) => mo.y * 12 + mo.m >= cutoff);
  const brief = months.filter((mo) => mo.y * 12 + mo.m < cutoff);

  const faq = [
    { q: 'Lịch vạn niên là gì?', a: 'Lịch vạn niên là loại lịch tra cứu dài hạn, cho biết ứng với một ngày dương lịch bất kỳ thì đó là ngày nào âm lịch, can chi ngày tháng năm là gì, trực nào, sao hoàng đạo hay hắc đạo, giờ nào là giờ hoàng đạo và đang trong tiết khí nào.' },
    { q: 'Công cụ này tra được từ năm nào đến năm nào?', a: 'Công cụ đổi ngày trên trang /lich-am/ tính được cho khoảng 1900–2100. Các trang chi tiết theo từng ngày được lập sẵn cho khoảng thời gian gần hiện tại và mở rộng dần theo từng tháng.' },
    { q: 'Vì sao có ngày chưa có trang riêng?', a: 'Trang chi tiết từng ngày được sinh theo cửa sổ thời gian và bổ sung hàng tháng. Nếu ngày bạn cần chưa có trang riêng, hãy dùng công cụ đổi ngày ở trang Lịch Âm — kết quả tính trực tiếp và luôn có sẵn.' },
  ];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description: desc, url },
    { '@type': 'ItemList', numberOfItems: full.reduce((s, mo) => s + mo.days.length, 0),
      itemListElement: full.flatMap((mo) => mo.days).slice(0, 400).map((x, i) => ({
        '@type': 'ListItem', position: i + 1,
        name: `Lịch âm ngày ${x.d}/${x.m}/${x.y}`,
        url: `https://latbai.vn${dayPath(x.d, x.m, x.y)}`,
      })) },
    faqLd(faq),
    breadcrumbLd([
      { name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { name: 'Lịch Âm', item: 'https://latbai.vn/lich-am/' },
      { name: 'Lịch Vạn Niên' },
    ]),
  ] };

  return HEAD(title, desc, url, jsonLd) + `
  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/lich-am/">Lịch Âm</a>
      <i class="ti ti-chevron-right"></i>
      <span>Lịch Vạn Niên</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Lịch Vạn Niên — Tra Cứu Lịch Âm Từng Ngày</h1>
      <p style="color: var(--muted); font-size: 14px;">Âm lịch · Can chi · 12 Trực · Sao hoàng đạo · Giờ hoàng đạo · Tiết khí</p>
    </article>

    <div class="article-body">
      <p>Lịch vạn niên cho biết ứng với một ngày dương lịch bất kỳ thì đó là ngày nào âm lịch, can chi ra sao, trực gì, sao hoàng đạo hay hắc đạo, giờ nào đẹp và đang ở tiết khí nào. Bấm vào một ngày bên dưới để xem trang chi tiết, hoặc dùng <a href="/lich-am/">công cụ đổi ngày</a> nếu ngày bạn cần chưa có trang riêng.</p>

${full.map((mo) => `      <h2 class="licham">Tháng ${mo.m}/${mo.y}</h2>
      <div class="la-chips">
${mo.days.map((x) => `        <a href="${dayPath(x.d, x.m, x.y)}">${x.d}</a>`).join('\n')}
      </div>`).join('\n\n')}

${brief.length ? `      <h2 class="licham">Các tháng trước đó</h2>
      <div class="la-chips">
${brief.map((mo) => `        <a href="${dayPath(mo.days[0].d, mo.m, mo.y)}">Tháng ${mo.m}/${mo.y}</a>`).join('\n')}
      </div>` : ''}

      <h2 class="licham">Đọc thêm</h2>
      <p>Xem <a href="${HUB_TK}">bảng 24 tiết khí</a> để biết ngày bắt đầu từng tiết trong năm, hoặc sang <a href="/ngay-tot/">Xem Ngày Tốt</a> nếu bạn cần chấm điểm ngày theo loại việc cụ thể như cưới hỏi, khai trương, động thổ.</p>

      <a href="/lich-am/" class="article-cta licham">
        <i class="ti ti-moon"></i> Mở lịch âm — xem tháng bất kỳ từ 1900 đến 2100
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
        <p><strong>Lưu ý:</strong> Số liệu tính bằng thuật toán thiên văn theo múi giờ Việt Nam (UTC+7). Phần luận đoán tốt xấu mang tính tham khảo &amp; chiêm nghiệm văn hoá.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Khám phá tiếp</h3>
      <div class="related-list">
        <a href="/lich-am/" class="related-item"><i class="ti ti-moon"></i> Lịch âm hôm nay</a>
        <a href="${HUB_TK}" class="related-item"><i class="ti ti-sun"></i> 24 tiết khí</a>
        <a href="/ngay-tot/" class="related-item"><i class="ti ti-calendar-check"></i> Xem ngày tốt</a>
        <a href="/tuvi/" class="related-item"><i class="ti ti-stars"></i> Lá số Tử Vi</a>
      </div>
    </div>

  </main>

` + FOOTER;
}

// ============================================================
// Hub: 24 tiết khí
// ============================================================
function buildHubTietKhi() {
  const url = `https://latbai.vn${HUB_TK}`;
  const title = '24 Tiết Khí: Bảng Đầy Đủ, Ngày Bắt Đầu & Ý Nghĩa | latbai.vn';
  const desc = 'Bảng đầy đủ 24 tiết khí trong năm: tên gọi, ý nghĩa, kinh độ mặt trời, mùa và ngày bắt đầu từng tiết. Từ Lập Xuân, Xuân Phân đến Hạ Chí, Đông Chí.';

  const thisY = A.tietKhiOfYear(TODAY_VN.y);
  const nextY = A.tietKhiOfYear(TODAY_VN.y + 1);
  const byIdxThis = Object.fromEntries(thisY.map((t) => [t.index, t]));
  const byIdxNext = Object.fromEntries(nextY.map((t) => [t.index, t]));
  const MUA = ['Xuân', 'Hạ', 'Thu', 'Đông'];

  const faq = [
    { q: '24 tiết khí là gì?', a: '24 tiết khí chia một vòng chuyển động biểu kiến của mặt trời thành 24 chặng bằng nhau, mỗi chặng 15 độ kinh độ, dùng để định mùa vụ nông nghiệp. Vì tính theo mặt trời nên tiết khí gắn với dương lịch khá ổn định.' },
    { q: 'Vì sao tiết khí lại thuộc dương lịch dù dùng trong âm lịch?', a: 'Âm lịch Việt Nam thực chất là âm dương lịch: tháng theo mặt trăng, năm hiệu chỉnh theo mặt trời. Tiết khí là phần "dương" của hệ lịch này — nó neo vào vị trí mặt trời, nên rơi vào ngày dương lịch gần như cố định.' },
    { q: 'Tiết khí nào quan trọng nhất trong lịch pháp?', a: 'Đông Chí. Tháng âm chứa Đông Chí được định là tháng Mười Một, từ đó suy ra cách đánh số các tháng còn lại và xác định tháng nhuận của năm. Lập Xuân cũng quan trọng vì là mốc đổi năm can chi trong tử vi và trạch nhật.' },
  ];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description: desc, url },
    { '@type': 'ItemList', numberOfItems: 24,
      itemListElement: D.TIET_KHI.map((t) => ({
        '@type': 'ListItem', position: t.i + 1, name: `Tiết khí ${t.ten}`,
        url: `https://latbai.vn${tkPath(t.slug)}`,
      })) },
    faqLd(faq),
    breadcrumbLd([
      { name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { name: 'Lịch Âm', item: 'https://latbai.vn/lich-am/' },
      { name: '24 Tiết Khí' },
    ]),
  ] };

  return HEAD(title, desc, url, jsonLd) + `
  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/lich-am/">Lịch Âm</a>
      <i class="ti ti-chevron-right"></i>
      <span>24 Tiết Khí</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">24 Tiết Khí: Bảng Đầy Đủ, Ngày Bắt Đầu &amp; Ý Nghĩa</h1>
      <p style="color: var(--muted); font-size: 14px;">Từ Lập Xuân đến Đại Hàn · Ngày bắt đầu năm ${TODAY_VN.y} và ${TODAY_VN.y + 1}</p>
    </article>

    <div class="article-body">
      <p>24 tiết khí chia đường đi biểu kiến của mặt trời thành 24 chặng bằng nhau, mỗi chặng <strong>15 độ</strong> kinh độ. Đây là phần "dương" của hệ âm dương lịch: vì neo vào mặt trời nên tiết khí rơi vào ngày dương lịch gần như cố định, chỉ xê dịch một hai ngày giữa các năm.</p>
      <p>Hệ tiết khí hình thành ở lưu vực Hoàng Hà nên mô tả khí hậu hợp với <strong>miền Bắc Việt Nam</strong> hơn cả; miền Nam về cơ bản chỉ có mùa mưa và mùa khô.</p>

      <h2 class="licham">Bảng đầy đủ 24 tiết khí</h2>
      <div class="table-responsive">
        <table class="seo-table">
          <thead><tr><th>#</th><th>Tiết khí</th><th>Ý nghĩa</th><th>Mùa</th><th>${TODAY_VN.y}</th><th>${TODAY_VN.y + 1}</th></tr></thead>
          <tbody>
${D.TIET_KHI.map((t) => {
  const a = byIdxThis[t.i], b = byIdxNext[t.i];
  return `            <tr><td>${t.i + 1}</td><td><a href="${tkPath(t.slug)}"><strong>${esc(t.ten)}</strong></a></td><td>${esc(t.han)}</td><td>${esc(t.mua)}</td><td>${a ? `${a.day}/${a.month}` : '—'}</td><td>${b ? `${b.day}/${b.month}` : '—'}</td></tr>`;
}).join('\n')}
          </tbody>
        </table>
      </div>

${MUA.map((mua) => {
  const list = D.TIET_KHI.filter((t) => t.mua === mua);
  return `      <h2 class="licham">Tiết khí mùa ${mua}</h2>
      <p>${list.map((t) => `<a href="${tkPath(t.slug)}">${esc(t.ten)}</a>`).join(' · ')}</p>
      <p>${esc(list[0].tomTat)} ${esc(list[list.length - 1].tomTat)}</p>`;
}).join('\n\n')}

      <h2 class="licham">Hai tiết khí quan trọng nhất</h2>
      <p><strong>Đông Chí</strong> giữ vai trò then chốt trong lịch pháp: tháng âm chứa Đông Chí được định là tháng Mười Một, từ đó suy ra toàn bộ cách đánh số tháng và xác định tháng nhuận của năm.</p>
      <p><strong>Lập Xuân</strong> là mốc đổi năm can chi trong tử vi và trạch nhật — người sinh sau Tết Nguyên Đán nhưng trước Lập Xuân vẫn tính con giáp của năm cũ. Đây là điểm rất hay bị nhầm khi xem tuổi.</p>

      <a href="/lich-am/" class="article-cta licham">
        <i class="ti ti-moon"></i> Xem tiết khí hôm nay trên lịch âm
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
        <p><strong>Lưu ý:</strong> Ngày bắt đầu tiết khí tính bằng thuật toán thiên văn theo múi giờ Việt Nam (UTC+7), có thể lệch một ngày so với vài cuốn lịch in khi thời điểm giao tiết rơi sát nửa đêm.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Khám phá tiếp</h3>
      <div class="related-list">
        <a href="/lich-am/" class="related-item"><i class="ti ti-moon"></i> Lịch âm hôm nay</a>
        <a href="${HUB_VN}" class="related-item"><i class="ti ti-calendar-month"></i> Lịch vạn niên</a>
        <a href="/ngay-tot/" class="related-item"><i class="ti ti-calendar-check"></i> Xem ngày tốt</a>
        <a href="/thuvien/am-duong-ngu-hanh" class="related-item"><i class="ti ti-yin-yang"></i> Âm dương ngũ hành</a>
      </div>
    </div>

  </main>

` + FOOTER;
}

// ============================================================
// Generate
// ============================================================
if (!fs.existsSync(OUT)) throw new Error(`Không thấy thư mục ${OUT}`);

// 1. Cửa sổ 6 tháng tính từ mùng 1 tháng hiện tại (giờ VN)
const windowDays = [];
for (let k = 0; k < MONTHS_AHEAD; k++) {
  const mm = ((TODAY_VN.m - 1 + k) % 12) + 1;
  const yy = TODAY_VN.y + Math.floor((TODAY_VN.m - 1 + k) / 12);
  const n = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  for (let d = 1; d <= n; d++) windowDays.push({ d, m: mm, y: yy });
}

// 2. Quét đĩa để trang cũ ở lại sitemap (giống build-ngaytot-pages.mjs)
const existing = fs.readdirSync(OUT)
  .map((f) => f.match(/^ngay-(\d+)-(\d+)-(\d+)\.html$/))
  .filter(Boolean)
  .map((mt) => ({ d: +mt[1], m: +mt[2], y: +mt[3] }));

// 3. Hợp nhất + sắp thời gian
const seen = new Set();
const allDays = [];
for (const x of [...existing, ...windowDays]) {
  const key = dayFile(x.d, x.m, x.y);
  if (seen.has(key)) continue;
  seen.add(key);
  allDays.push(x);
}
allDays.sort((a, b) => a.y - b.y || a.m - b.m || a.d - b.d);

if (allDays.length > MAX_DAY_PAGES) {
  throw new Error(`Số trang ngày (${allDays.length}) vượt ngưỡng ${MAX_DAY_PAGES}. Kiểm tra lại cửa sổ sinh trang trước khi nới ngưỡng.`);
}
const slugSet = seen;

// 4. Ghi TẤT CẢ (không chỉ cửa sổ) để sửa template là trang cũ tự lành.
//    An toàn vì trang ngày không chứa TODAY ⇒ ghi lại cho ra byte y hệt.
const urls = [];
const curKey = TODAY_VN.y * 12 + TODAY_VN.m;
for (const x of allDays) {
  fs.writeFileSync(path.join(OUT, dayFile(x.d, x.m, x.y)), buildDayPage(x.d, x.m, x.y, slugSet), 'utf8');
  const isPast = x.y * 12 + x.m < curKey;
  urls.push({ loc: `https://latbai.vn${dayPath(x.d, x.m, x.y)}`, priority: isPast ? '0.3' : '0.5', freq: isPast ? 'yearly' : 'monthly' });
}
for (const t of D.TIET_KHI) {
  fs.writeFileSync(path.join(OUT, `tiet-khi-${t.slug}.html`), buildTietKhiPage(t, slugSet), 'utf8');
  urls.push({ loc: `https://latbai.vn${tkPath(t.slug)}`, priority: '0.6', freq: 'yearly' });
}
fs.writeFileSync(path.join(OUT, 'lich-van-nien.html'), buildHubVanNien(allDays), 'utf8');
urls.push({ loc: `https://latbai.vn${HUB_VN}`, priority: '0.7', freq: 'monthly' });
fs.writeFileSync(path.join(OUT, '24-tiet-khi.html'), buildHubTietKhi(), 'utf8');
urls.push({ loc: `https://latbai.vn${HUB_TK}`, priority: '0.7', freq: 'yearly' });

console.log(`Generated ${allDays.length} trang ngày + 24 tiết khí + 2 hub = ${urls.length} trang trong /lich-am/`);

// ---- Sitemap block (idempotent) ----
// /lich-am/ (trang tool) nằm ở đầu sitemap ngoài mọi marker — không emit lại.
let sitemap = fs.readFileSync(SITEMAP, 'utf8');

// URL đã có trong block thì GIỮ NGUYÊN lastmod cũ; chỉ URL mới mới lấy ngày hôm nay.
// Nhờ vậy chạy lại nhiều lần không đổi gì (URL nào cũng đã có ngày), mà trang mới
// vẫn có ngày thật thay vì một mốc bịa.
const prevDate = {};
const oldBlock = sitemap.match(/ {2}<!-- licham:start[\s\S]*?<!-- licham:end -->/);
if (oldBlock) {
  for (const mt of oldBlock[0].matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) prevDate[mt[1]] = mt[2];
}
const isoToday = `${TODAY_VN.y}-${String(TODAY_VN.m).padStart(2, '0')}-${String(TODAY_VN.d).padStart(2, '0')}`;
let fresh = 0;
const block = [
  '  <!-- licham:start (generated by scripts/build-licham-pages.mjs) -->',
  ...urls.map(({ loc, priority, freq }) => {
    const lastmod = prevDate[loc] || (fresh++, isoToday);
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }),
  '  <!-- licham:end -->',
].join('\n');

sitemap = oldBlock
  ? sitemap.replace(/ {2}<!-- licham:start[\s\S]*?<!-- licham:end -->/, block)
  : sitemap.replace('</urlset>', `${block}\n</urlset>`);
fs.writeFileSync(SITEMAP, sitemap, 'utf8');
console.log(`Sitemap: ${urls.length} URL trong block licham (${fresh} URL mới lấy ngày ${isoToday})`);
