/**
 * scripts/migrate-thuvien-shell.mjs — one-off: 27 bài Thư Viện dùng dock chung.
 *
 * Trước: mỗi bài hardcode <nav class="floating-dock"> 6 mục (thiếu Thần Số Học)
 * và tự nhúng thẻ Vercel insights, nhưng KHÔNG load js/shell.js — nên cũng thiếu
 * luôn service worker, streak và speed-insights.
 *
 * Sau: xoá nav hardcode + xoá thẻ insights thủ công (shell.js tự nhúng, để lại
 * sẽ đếm 2 lần/pageview) + thêm shell.js trước </head> như thuvien/index.html.
 *
 * Idempotent — chạy lại không đổi gì. Giữ nguyên BOM UTF-8 của các file này.
 * Run: node scripts/migrate-thuvien-shell.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'thuvien');

// \r?\n ở mọi chỗ: worktree có thể là CRLF (core.autocrlf=true) hoặc LF
// (sau khi .gitattributes pin eol=lf). Dùng \n cứng sẽ không khớp gì trên CRLF.
// nav dock luôn là <nav> cuối file (breadcrumb + TOC đã đóng trước đó) nên
// non-greedy tới </nav> đầu tiên sau nó là an toàn.
const RE_DOCK = /[ \t]*(?:<!-- FLOATING NAVIGATION DOCK -->\r?\n)?[ \t]*<nav class="floating-dock">[\s\S]*?<\/nav>\r?\n/;
const RE_INSIGHTS = /[ \t]*(?:<!-- Vercel Web Analytics -->\r?\n)?[ \t]*<script defer src="\/_vercel\/insights\/script\.js"><\/script>\r?\n/;

let changed = 0, skipped = 0;

for (const name of fs.readdirSync(DIR).filter((f) => f.endsWith('.html'))) {
  const file = path.join(DIR, name);
  const before = fs.readFileSync(file, 'utf8');
  let html = before;

  const hadDock = RE_DOCK.test(html);
  html = html.replace(RE_DOCK, '');
  html = html.replace(RE_INSIGHTS, '');

  if (!html.includes('/js/shell.js')) {
    if (!html.includes('</head>')) throw new Error(`${name}: không tìm thấy </head>`);
    const eol = html.includes('\r\n') ? '\r\n' : '\n';   // chèn theo EOL của file, tránh trộn lẫn
    const shellTag = `  <!-- Shared shell: floating dock, service worker, Vercel analytics -->${eol}`
                   + `  <script src="/js/shell.js" defer></script>${eol}`;
    html = html.replace('</head>', `${shellTag}</head>`);
  }

  // Bảo hiểm: nếu vẫn còn dock thì regex không khớp — dừng thay vì ghi ra
  // trạng thái nửa vời (dock cũ + shell.js ⇒ shell.js bỏ qua inject, insights x2).
  if (html.includes('floating-dock')) {
    throw new Error(`${name}: không xoá được nav dock (regex không khớp — kiểm tra EOL/markup). hadDock=${hadDock}`);
  }

  if (html === before) { skipped++; continue; }
  fs.writeFileSync(file, html, 'utf8');   // BOM nằm trong chuỗi nên được giữ lại
  changed++;
  console.log(`  ✓ ${name}`);
}

console.log(`\nthuvien shell migration: ${changed} file sửa, ${skipped} file đã đúng.`);
