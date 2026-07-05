/**
 * scripts/batch-sync-fx.mjs — Đợt đồng bộ D (2026-07):
 * 1. ten/ + dua/: thêm shell.js (dock + SW + analytics), gỡ insights thủ công trùng lặp.
 * 2. Thêm mystic-fx nền cho toàn bộ trang tra cứu programmatic
 *    (kinh-dich/*, la-bai-tarot/*, thansohoc/so-*).
 * 3. la-bai-tarot/index.html: thay icon 🃏 bằng ảnh thumbnail lá bài thật
 *    (map slug→ảnh lấy từ js/daily-data.js).
 * Chạy lại an toàn (idempotent).
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const write = (p, s) => writeFileSync(join(ROOT, p), s);

let changed = 0;

// ==================== 1. shell.js cho ten + dua ====================
for (const file of ['ten/index.html', 'dua/index.html']) {
  let html = read(file);
  let dirty = false;
  if (!html.includes('/js/shell.js')) {
    html = html.replace('</head>',
      '  <!-- Shared shell: floating dock, service worker, Vercel analytics -->\n' +
      '  <script src="/js/shell.js" defer></scr' + 'ipt>\n</head>');
    dirty = true;
  }
  // shell.js đã tự chèn insights — gỡ bản thủ công tránh load đôi
  const manual = /\s*<script defer src="\/_vercel\/insights\/script\.js"><\/script>/;
  if (manual.test(html)) {
    html = html.replace(manual, '');
    dirty = true;
  }
  if (dirty) { write(file, html); changed++; console.log('shell:', file); }
}

// ==================== 2. mystic-fx cho trang tra cứu ====================
const FX_FAMILIES = [
  { dir: 'kinh-dich',    color: '13,150,104', glyphs: '☰☱☲☳☴☵☶☷', count: 34 },
  { dir: 'la-bai-tarot', color: '124,58,237', glyphs: '✦✧☾★',      count: 34 },
];

for (const fam of FX_FAMILIES) {
  const files = readdirSync(join(ROOT, fam.dir)).filter(f => f.endsWith('.html'));
  let n = 0;
  for (const f of files) {
    const path = `${fam.dir}/${f}`;
    let html = read(path);
    if (html.includes('mystic-fx.js')) continue;
    if (!html.includes('</head>')) continue;
    const tag = `  <script src="/js/mystic-fx.js" defer data-color="${fam.color}" data-glyphs="${fam.glyphs}" data-count="${fam.count}"></scr` + 'ipt>\n</head>';
    html = html.replace('</head>', tag);
    write(path, html);
    n++;
  }
  changed += n;
  console.log(`mystic-fx: ${fam.dir} → ${n} trang`);
}

// thansohoc/so-*.html (trang tra cứu số chủ đạo)
{
  const files = readdirSync(join(ROOT, 'thansohoc')).filter(f => f.startsWith('so-') && f.endsWith('.html'));
  let n = 0;
  for (const f of files) {
    const path = `thansohoc/${f}`;
    let html = read(path);
    if (html.includes('mystic-fx.js')) continue;
    if (!html.includes('</head>')) continue;
    html = html.replace('</head>',
      '  <script src="/js/mystic-fx.js" defer data-color="99,102,241" data-glyphs="123456789" data-count="34"></scr' + 'ipt>\n</head>');
    write(path, html);
    n++;
  }
  changed += n;
  console.log(`mystic-fx: thansohoc/so-* → ${n} trang`);
}

// ==================== 3. Ảnh lá bài thật cho la-bai-tarot/index.html ====================
{
  const dd = read('js/daily-data.js');
  const tarot = JSON.parse(dd.match(/DAILY_TAROT = (\[.*?\]);/s)[1]);
  const bySlug = Object.fromEntries(tarot.map(t => [t.slug, t.img]));

  let html = read('la-bai-tarot/index.html');
  if (!html.includes('tarot-thumb')) {
    let replaced = 0;
    html = html.replace(
      /<a href="\/la-bai-tarot\/([a-z0-9-]+)" class="related-item"><i class="ti ti-cards"><\/i>/g,
      (m, slug) => {
        const img = bySlug[slug];
        if (!img) return m;
        replaced++;
        return `<a href="/la-bai-tarot/${slug}" class="related-item tarot-item"><img class="tarot-thumb" src="/tarot/images/${img}.webp" alt="" loading="lazy" width="34" height="57">`;
      }
    );
    // style nhỏ cho thumbnail (style-src có 'unsafe-inline')
    html = html.replace('</head>',
      `  <style>
    .tarot-item { display: flex; align-items: center; gap: 12px; }
    .tarot-thumb { width: 34px; height: 57px; object-fit: cover; border-radius: 5px;
                   box-shadow: 0 3px 8px rgba(60, 30, 90, 0.25); flex-shrink: 0; }
  </style>\n</head>`);
    write('la-bai-tarot/index.html', html);
    changed++;
    console.log(`tarot thumbs: ${replaced} lá được gắn ảnh`);
  } else {
    console.log('tarot thumbs: đã có sẵn');
  }
}

console.log('DONE —', changed, 'thay đổi');
