// Sinh trang công khai cho từng bài học: latbai.vn/hoc/<ten-bai>/ và mục lục latbai.vn/hoc/.
// Chạy: node --experimental-strip-types --no-warnings scripts/build-lessons.ts
//
// Mục đích: người mới hay tìm "đòn đôi cờ vua", "ghim quân là gì"… — mỗi bài học
// thành một trang Google đọc được (chữ thật, không cần chạy app), có thế cờ ví dụ
// và nút mở thẳng bài đó trong app.
//
// Thế cờ ví dụ lấy từ kho bài tập trên máy này (data/chess.db): bài được nhiều
// người giải nhất trong đúng chủ đề, vừa độ khó. Kho không nằm trên Vercel, nên
// chạy script ở đây rồi đưa các file sinh ra (public/hoc/) vào git.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { LESSONS, type Lesson } from '../src/training/lessons.ts';
import { boardSvg } from '../src/board/Board.ts';
import { Game } from '../shared/chess.ts';
import type { Square } from '../shared/fen.ts';

const SITE = 'https://latbai.vn';

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

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Example {
  fen: string;
  side: 'w' | 'b';
  lastMove: [Square, Square];
  solution: string[];
}

function example(db: DatabaseSync, l: Lesson): Example | null {
  const row = db
    .prepare(
      `SELECT p.fen, p.moves FROM puzzle_themes t JOIN puzzles p ON p.id = t.puzzle_id
        WHERE t.theme = ? AND t.rating BETWEEN ? AND ? ORDER BY p.popularity DESC, p.id LIMIT 1`,
    )
    .get(l.theme, l.maxRating - 350, l.maxRating) as { fen: string; moves: string } | undefined;
  if (!row) return null;
  const moves = row.moves.split(' ');
  const g = new Game(row.fen);
  // Nước đầu trong dữ liệu là của đối phương; thế cờ ví dụ là SAU nước đó
  const m0 = g.move(moves[0].slice(0, 2) as Square, moves[0].slice(2, 4) as Square, moves[0][4]);
  if (!m0) return null;
  const fen = g.fen;
  const side = g.turn;
  const sans: string[] = [];
  for (const u of moves.slice(1)) {
    const m = g.move(u.slice(0, 2) as Square, u.slice(2, 4) as Square, u[4]);
    if (!m) break;
    sans.push(m.san);
  }
  return { fen, side, lastMove: [m0.from, m0.to], solution: sans };
}

// Bỏ <title>/<?xml> của file sprite: trang chỉ được có một <title>
const sprite = readFileSync('public/pieces/cburnett.svg', 'utf8')
  .replace(/<\?xml[^>]*>/, '')
  .replace(/<title>[\s\S]*?<\/title>/g, '');

const STYLE = `
  :root { color-scheme: dark; --bg: #302e2b; --card: #262421; --card2: #3c3a37; --text: #fff; --text2: #c9c8c6; --text3: #a7a5a3; --line: #3f3d39; --accent: #1f8f80; --accent-text: #56cdbb;
    --sq-light: #ebecd0; --sq-dark: #739552; --mark-move: rgb(255 255 51 / 0.42); }
  @media (prefers-color-scheme: light) { :root { color-scheme: light; --bg: #f3f1ec; --card: #fff; --card2: #ece9e2; --text: #1d1b18; --text2: #57524a; --text3: #7d776d; --line: #d9d4c9; --accent: #1a7a6c; --accent-text: #17695c; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text2); font: 17px/1.65 'IBM Plex Sans', system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px 72px; }
  a { color: var(--accent-text); }
  h1, h2 { color: var(--text); line-height: 1.25; }
  h1 { font-size: 32px; margin: 4px 0 12px; }
  h2 { font-size: 21px; margin: 36px 0 12px; }
  .crumb { font-size: 15px; } .crumb a { text-decoration: none; font-weight: 600; }
  .chapter { color: var(--text3); font-size: 15px; margin: 16px 0 0; }
  .lead { font-size: 19px; color: var(--text); }
  .key { background: var(--card); border-left: 4px solid var(--accent); border-radius: 6px; padding: 12px 16px; color: var(--text); }
  .board-wrap { max-width: 420px; }
  .board { display: block; width: 100%; height: auto; }
  .board .coord { font-family: system-ui, sans-serif; }
  .tomove { font-weight: 600; color: var(--text); }
  details { background: var(--card); border-radius: 6px; padding: 10px 16px; margin-top: 12px; }
  summary { cursor: pointer; font-weight: 600; color: var(--text); }
  .cta { display: inline-flex; align-items: center; min-height: 52px; padding: 0 24px; border-radius: 6px; border-bottom: 3px solid rgb(0 0 0 / .3); background: var(--accent); color: #fff; font-weight: 700; font-size: 19px; text-decoration: none; margin: 8px 12px 8px 0; }
  .cta.alt { background: var(--card2); color: var(--text); }
  .list { display: grid; gap: 8px; padding: 0; list-style: none; }
  .list a { display: block; background: var(--card); border-radius: 6px; padding: 12px 16px; text-decoration: none; color: var(--text); }
  .list a span { display: block; color: var(--text2); font-size: 15px; }
  .nav { display: flex; justify-content: space-between; gap: 12px; margin-top: 32px; flex-wrap: wrap; }
`;

function page(o: { title: string; desc: string; path: string; body: string; withSprite?: boolean }): string {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${SITE}${o.path}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:url" content="${SITE}${o.path}">
<meta name="theme-color" content="#262421">
<style>${STYLE}</style>
</head>
<body>
${o.withSprite ? `<div style="display:none" aria-hidden="true">${sprite}</div>` : ''}
<main>
${o.body}
</main>
</body>
</html>
`;
}

const db = new DatabaseSync('data/chess.db', { readOnly: true });
const urls: string[] = ['/hoc/'];
const slugs = LESSONS.map((l) => slugify(l.title));

LESSONS.forEach((l, i) => {
  const slug = slugs[i];
  const ex = example(db, l);
  const bên = ex ? (ex.side === 'w' ? 'Trắng' : 'Đen') : '';
  const board = ex
    ? boardSvg({ fen: ex.fen, orientation: ex.side, lastMove: ex.lastMove, label: `Thế cờ ví dụ, ${bên} đi` })
    : '';
  const prev = LESSONS[i - 1];
  const next = LESSONS[i + 1];
  const desc = `${l.title} trong cờ vua: ${l.keyPoint} Bài học miễn phí kèm bài tập luyện ngay trên Lật Cờ.`;
  const body = `
<p class="crumb"><a href="/">♞ Lật Cờ</a> · <a href="/hoc/">Bài học cờ vua</a></p>
<p class="chapter">${esc(l.chapter)} · bài ${i + 1}/${LESSONS.length}</p>
<h1>${esc(l.title)}</h1>
<p class="lead">${esc(l.intro)}</p>
<p class="key"><b>Cần nhớ:</b> ${esc(l.keyPoint)}</p>
${
  ex
    ? `<h2>Thử một thế cờ</h2>
<p class="tomove">${bên} đi. Tìm nước ${esc(l.title.toLowerCase())}.</p>
<div class="board-wrap">${board}</div>
<details><summary>Xem lời giải</summary><p>${ex.solution.map((s, k) => (k % 2 === 0 ? `<b>${esc(s)}</b>` : esc(s))).join(' → ')}</p></details>`
    : ''
}
<h2>Luyện ngay</h2>
<p>Bài học này có ${l.count} bài tập chọn từ hàng nghìn thế cờ thật cùng chủ đề. Giải trên bàn cờ, sai thì được chỉ lại — miễn phí.</p>
<p><a class="cta" href="/#/hoc?bai=${l.id}">Luyện bài này ngay</a><a class="cta alt" href="/#/choi">Chơi một ván</a></p>
<p class="nav">${prev ? `<a href="/hoc/${slugs[i - 1]}/">← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="/hoc/${slugs[i + 1]}/">${esc(next.title)} →</a>` : ''}</p>`;
  mkdirSync(`public/hoc/${slug}`, { recursive: true });
  writeFileSync(
    `public/hoc/${slug}/index.html`,
    page({ title: `${l.title} — bài học cờ vua · Lật Cờ`, desc, path: `/hoc/${slug}/`, body, withSprite: Boolean(ex) }),
  );
  urls.push(`/hoc/${slug}/`);
  console.log(`${slug}${ex ? '' : '  (không có thế cờ ví dụ)'}`);
});

// Mục lục
const chương = [...new Set(LESSONS.map((l) => l.chapter))];
const mụcLục = chương
  .map(
    (c) =>
      `<h2>${esc(c)}</h2><ul class="list">${LESSONS.map((l, i) => [l, i] as const)
        .filter(([l]) => l.chapter === c)
        .map(([l, i]) => `<li><a href="/hoc/${slugs[i]}/"><b>${esc(l.title)}</b><span>${esc(l.keyPoint)}</span></a></li>`)
        .join('')}</ul>`,
  )
  .join('');
writeFileSync(
  'public/hoc/index.html',
  page({
    title: 'Bài học cờ vua miễn phí — chiến thuật cho người mới · Lật Cờ',
    desc: 'Lộ trình học cờ vua miễn phí bằng tiếng Việt: ăn quân, đòn đôi, ghim quân, xiên, đòn mở, chiếu hết, tàn cuộc — mỗi bài kèm bài tập luyện ngay.',
    path: '/hoc/',
    body: `<p class="crumb"><a href="/">♞ Lật Cờ</a></p>
<h1>Bài học cờ vua</h1>
<p class="lead">${LESSONS.length} bài ngắn, từ những thứ người mới hay mắc nhất tới đòn chiến thuật và tàn cuộc. Mỗi bài đọc chưa tới một phút, rồi luyện ngay trên bàn cờ.</p>
<p><a class="cta" href="/#/hoc">Bắt đầu học trong app</a></p>
${mụcLục}`,
  }),
);

// Sitemap: trang chính + trang giới thiệu + bài học
const all = ['/', '/cham-van-co-vua/', ...urls, '/chinh-sach-rieng-tu/'];
writeFileSync(
  'public/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}
</urlset>
`,
);
console.log(`\n${LESSONS.length} bài + mục lục, sitemap ${all.length} địa chỉ.`);
