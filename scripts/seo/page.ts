// Khung chung cho các trang đọc được không cần chạy app (bài học, luật cờ, khai cuộc).
// Mỗi trang là HTML tĩnh: Google đọc được chữ thật, người mới mở nhanh trên điện thoại,
// và có nút mở thẳng phần tương ứng trong app.

import { readFileSync } from 'node:fs';

export const SITE = 'https://latbai.vn';
export const APP_NAME = 'Lật Cờ';

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "Đòn đôi" → "don-doi" */
export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Bộ quân mặc định (scripts/build-pieces.mjs). Sprite đã ẩn sẵn bằng cỡ 0 — không
// được bọc display:none, vì gradient bên trong sẽ không vẽ được.
const sprite = readFileSync('public/pieces/sets/merida.svg', 'utf8');
/** Logo con Mã của app (nằm sẵn trong sprite bộ quân); trang không có bàn cờ thì nhúng riêng. */
const brandSymbol = /<symbol id="brand-n"[\s\S]*?<\/symbol>/.exec(sprite)![0];

const STYLE = `
  :root { color-scheme: dark; --bg: #302e2b; --card: #262421; --card2: #3c3a37; --text: #fff; --text2: #c9c8c6; --text3: #a7a5a3; --line: #3f3d39; --accent: #1f8f80; --accent-text: #56cdbb;
    --sq-light: #ebecd0; --sq-dark: #739552; --coord-light: #ebecd0; --coord-dark: #739552; --mark-move: rgb(255 255 51 / 0.42);
    --mark-legal: rgb(0 0 0 / 0.2); --mark-check: #cf4034; --arrow-coach: #5fa36a;
    --brush-g: #9fcf3f; --brush-r: #eb6150; --brush-b: #52b0dc; --brush-y: #ffaa00; }
  @media (prefers-color-scheme: light) { :root { color-scheme: light; --bg: #f3f1ec; --card: #fff; --card2: #ece9e2; --text: #1d1b18; --text2: #57524a; --text3: #7d776d; --line: #d9d4c9; --accent: #1a7a6c; --accent-text: #17695c; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text2); font: 17px/1.65 'IBM Plex Sans', system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px 72px; }
  /* Màu nhấn chỉ cho nút chính, như trong app: link là chữ thường có gạch chân */
  a { color: var(--text); text-decoration-color: var(--text3); text-underline-offset: 3px; }
  a:hover { text-decoration-color: var(--text); }
  .top { max-width: 760px; margin: 0 auto; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); }
  .top .brand { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-weight: 700; font-size: 19px; text-decoration: none; }
  .top .brand svg { width: 28px; height: 28px; }
  .top .play { display: inline-flex; align-items: center; min-height: 44px; padding: 0 20px; border-radius: 6px; border-bottom: 3px solid rgb(0 0 0 / .3); background: var(--accent); color: #fff; font-weight: 700; text-decoration: none; }
  h1, h2, h3 { color: var(--text); line-height: 1.25; }
  h1 { font-size: 32px; margin: 4px 0 12px; }
  h2 { font-size: 21px; margin: 36px 0 12px; }
  h3 { font-size: 18px; margin: 24px 0 6px; }
  b, strong { color: var(--text); }
  .crumb { font-size: 15px; color: var(--text3); } .crumb a { color: var(--text2); text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; min-height: 44px; }
  .chapter { color: var(--text3); font-size: 15px; margin: 16px 0 0; }
  .lead { font-size: 19px; color: var(--text); }
  .key { color: var(--text); }
  .board-wrap { max-width: 420px; }
  .board-wrap.small { max-width: 280px; }
  .boards { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px 20px; }
  .boards figure { margin: 0; }
  .boards.wide { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  main > figure { margin: 16px 0; }
  main > figure figcaption { font-size: 15px; color: var(--text3); margin-top: 6px; max-width: 420px; }
  .tips figure { margin: 16px 0 0; } .tips figcaption { font-size: 15px; color: var(--text3); margin-top: 6px; max-width: 420px; }
  .tips { padding-left: 24px; } .tips h2 { font-size: 19px; margin: 28px 0 4px; } .tips p { margin: 0; }
  .boards figcaption, .board-wrap + .caption { font-size: 15px; color: var(--text3); margin-top: 6px; }
  .board { display: block; width: 100%; height: auto; }
  .board .coord { font-family: system-ui, sans-serif; font-size: 13px; }
  .tomove { font-weight: 600; color: var(--text); }
  .moves { font-size: 19px; color: var(--text); font-variant-numeric: tabular-nums; }
  .meta { color: var(--text3); font-size: 15px; margin: 0 0 12px; }
  details { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-top: 12px; }
  summary { cursor: pointer; font-weight: 600; color: var(--text); min-height: 44px; display: flex; align-items: center; gap: 8px; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: '▸'; color: var(--text3); }
  details[open] > summary::before { content: '▾'; }
  .cta { display: inline-flex; align-items: center; min-height: 52px; padding: 0 24px; border-radius: 6px; border-bottom: 3px solid rgb(0 0 0 / .3); background: var(--accent); color: #fff; font-weight: 700; font-size: 19px; text-decoration: none; margin: 8px 12px 8px 0; }
  .cta.alt { background: var(--card2); color: var(--text); }
  /* Danh sách: dòng phẳng ngăn bằng nét kẻ, tên bên trái, nước đi bên phải */
  .list { padding: 0; list-style: none; border-top: 1px solid var(--line); }
  .list a { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; min-height: 48px; padding: 12px 0; border-bottom: 1px solid var(--line); text-decoration: none; color: var(--text); }
  .list a b { font-weight: 500; }
  .list a:hover b { text-decoration: underline; text-decoration-color: var(--text3); }
  .list a span { color: var(--text3); font-size: 15px; font-variant-numeric: tabular-nums; text-align: right; }
  .toc { padding-left: 20px; } .toc a { display: inline-flex; align-items: center; min-height: 44px; }
  table { border-collapse: collapse; width: 100%; font-size: 16px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); }
  th { color: var(--text); font-weight: 600; }
  .nav { display: flex; justify-content: space-between; gap: 12px; margin-top: 32px; flex-wrap: wrap; }
  /* Bài tập: lưới bàn cờ, mỗi bài một chú thích, link mở trong app và lời giải gập lại */
  .pzs { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 28px 16px; }
  .pz { margin: 0; } .pz.one { max-width: 420px; }
  .pz figcaption { font-size: 15px; color: var(--text3); margin-top: 6px; }
  .pz-go { margin: 0; } .pz-go a { display: inline-flex; align-items: center; min-height: 44px; font-weight: 600; }
  .pz details { margin-top: 0; } .pz .moves { font-size: 17px; margin: 4px 0 12px; }
  .more { display: flex; flex-wrap: wrap; gap: 0 20px; padding: 0; list-style: none; }
  .more a { display: inline-flex; align-items: center; min-height: 44px; }
  .credit { max-width: 760px; margin: 0 auto; padding: 24px 16px 32px; font-size: 13px; color: var(--text3); border-top: 1px solid var(--line); }
  .credit a { color: var(--text2); }
`;

/** Đường dẫn "Lật Cờ › Bài học › Ghim quân" cho Google (BreadcrumbList). */
export function breadcrumbLd(items: [name: string, path: string][]): object {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: SITE + path,
    })),
  };
}

/** Bài viết (bài học, luật cờ, một khai cuộc). */
export function articleLd(o: { title: string; desc: string; path: string }): object {
  return {
    '@type': 'Article',
    headline: o.title,
    description: o.desc,
    inLanguage: 'vi',
    mainEntityOfPage: SITE + o.path,
    image: `${SITE}/og.png`,
    author: { '@type': 'Organization', name: APP_NAME, url: SITE + '/' },
    publisher: { '@type': 'Organization', name: APP_NAME, url: SITE + '/' },
  };
}

/** Hỏi đáp ngắn — Google có thể hiện thẳng dưới kết quả tìm kiếm. */
export function faqLd(qa: [q: string, a: string][]): object {
  return {
    '@type': 'FAQPage',
    mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
}

/** Các trang đọc khác, để người đọc (và Google) đi tiếp được. */
const KHÁC: [string, string][] = [
  ['/hoc/', 'Bài học cờ vua'],
  ['/bai-tap-co-vua/', 'Bài tập cờ vua'],
  ['/luat-co-vua/', 'Luật cờ vua'],
  ['/khai-cuoc/', 'Khai cuộc'],
  ['/bay-khai-cuoc/', 'Bẫy khai cuộc'],
  ['/tan-cuoc/', 'Tàn cuộc cơ bản'],
  ['/cham-van-co-vua/', 'Chấm ván cờ vua'],
];

/**
 * Ảnh chia sẻ riêng của trang có bàn cờ: /og/<đường-dẫn>.jpg, vẽ từ tiêu đề và bàn cờ
 * đầu tiên của trang (scripts/build-og.ts). Trang không có bàn cờ dùng ảnh chung.
 */
export const ogImageOf = (path: string) => `/og/${path.split('/').filter(Boolean).join('-') || 'trang-chu'}.jpg`;

export function page(o: {
  title: string;
  desc: string;
  path: string;
  body: string;
  /** Có vẽ bàn cờ: nhúng bộ quân một lần ở đầu trang. */
  withSprite?: boolean;
  ld?: object[];
  /** Tên sự kiện đếm lượt xem (ẩn danh), như lesson_page. */
  event?: string;
  type?: 'article' | 'website';
}): string {
  const og = o.withSprite ? SITE + ogImageOf(o.path) : `${SITE}/og.png`;
  const ld = o.ld?.length
    ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': o.ld })
        .replaceAll(`"${SITE}/og.png"`, `"${og}"`)
        .replace(/</g, '\\u003c')}</script>\n`
    : '';
  const khác = KHÁC.filter(([p]) => p !== o.path)
    .map(([p, t]) => `<li><a href="${p}">${t}</a></li>`)
    .join('');
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${SITE}${o.path}">
<meta property="og:type" content="${o.type ?? 'article'}">
<meta property="og:site_name" content="${APP_NAME}">
<meta property="og:locale" content="vi_VN">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:image" content="${og}">
${o.withSprite ? '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n' : ''}<meta property="og:image:alt" content="${esc(o.title)}">
<meta property="og:url" content="${SITE}${o.path}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#262421">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="stylesheet" href="/fonts/fonts.css">
${ld}<style>${STYLE}</style>
${
  o.event
    ? `<script>try{fetch('/api/ping',{method:'POST',headers:{'content-type':'application/json','ngrok-skip-browser-warning':'1'},body:'{"e":"${o.event}"}',keepalive:true}).catch(function(){})}catch(e){}</script>\n`
    : ''
}</head>
<body>
${o.withSprite ? `<div aria-hidden="true">${sprite}</div>` : `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${brandSymbol}</svg>`}
<header class="top"><a class="brand" href="/"><svg viewBox="0 0 40 40" aria-hidden="true"><use href="#brand-n"/></svg>${APP_NAME}</a><a class="play" href="/#/choi">Chơi</a></header>
<main>
${o.body}
<h2>Đọc thêm</h2>
<ul class="more">${khác}</ul>
</main>
<footer class="credit">${
    o.withSprite
      ? 'Quân cờ Merida của Armando Hernandez Marroquin (GPLv2+), '
      : ''
  }logo từ bộ cburnett (CC BY-SA 3.0) · <a href="/pieces/sets/LICENSES.txt">giấy phép</a> · ${APP_NAME} là phần mềm tự do theo <a href="https://www.gnu.org/licenses/gpl-3.0.html">GPL-3</a>, <a href="https://github.com/Nelson1312-dak/latthe">mã nguồn</a> · <a href="/chinh-sach-rieng-tu/">quyền riêng tư</a></footer>
</body>
</html>
`;
}
