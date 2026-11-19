// Sinh trang công khai cho từng bài học: latbai.vn/hoc/<ten-bai>/ và mục lục latbai.vn/hoc/.
// Khung trang dùng chung ở scripts/seo/page.ts; sitemap do scripts/build-sitemap.mjs làm.
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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { LESSONS, type Lesson } from '../src/training/lessons.ts';
import { boardSvg } from '../src/board/Board.ts';
import { Game } from '../shared/chess.ts';
import type { Square } from '../shared/fen.ts';
import { articleLd, breadcrumbLd, esc, page, slugify } from './seo/page.ts';

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

// Kho hơn một triệu bài: mỗi truy vấn mất vài phút trên đĩa máy này. Thế cờ ví dụ đã
// chọn được ghi lại (có commit) để lần sau chỉ hỏi kho cho bài học mới hoặc bị đổi chủ đề.
const CACHE = 'scripts/seo/lesson-examples.json';
const cache: Record<string, { key: string; ex: Example | null }> = existsSync(CACHE)
  ? JSON.parse(readFileSync(CACHE, 'utf8'))
  : {};
let db: DatabaseSync | null = null;
function exampleFor(l: Lesson): Example | null {
  const key = `${l.theme}:${l.maxRating}`;
  if (cache[l.id]?.key === key) return cache[l.id].ex;
  db ??= new DatabaseSync('data/chess.db', { readOnly: true });
  const ex = example(db, l);
  cache[l.id] = { key, ex };
  writeFileSync(CACHE, JSON.stringify(cache, null, 1) + '\n');
  return ex;
}
const slugs = LESSONS.map((l) => slugify(l.title));

LESSONS.forEach((l, i) => {
  const slug = slugs[i];
  const ex = exampleFor(l);
  const bên = ex ? (ex.side === 'w' ? 'Trắng' : 'Đen') : '';
  const board = ex
    ? boardSvg({ fen: ex.fen, orientation: ex.side, lastMove: ex.lastMove, label: `Thế cờ ví dụ, ${bên} đi` })
    : '';
  const prev = LESSONS[i - 1];
  const next = LESSONS[i + 1];
  const desc = `${l.title} trong cờ vua: ${l.keyPoint} Bài học miễn phí kèm bài tập luyện ngay trên Lật Cờ.`;
  const body = `
<p class="crumb"><a href="/">Lật Cờ</a> · <a href="/hoc/">Bài học cờ vua</a></p>
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
    page({
      title: `${l.title} — bài học cờ vua · Lật Cờ`,
      desc,
      path: `/hoc/${slug}/`,
      body,
      withSprite: Boolean(ex),
      event: 'lesson_page',
      ld: [
        articleLd({ title: `${l.title} trong cờ vua`, desc, path: `/hoc/${slug}/` }),
        breadcrumbLd([
          ['Lật Cờ', '/'],
          ['Bài học cờ vua', '/hoc/'],
          [l.title, `/hoc/${slug}/`],
        ]),
      ],
    }),
  );
  console.log(`${slug}${ex ? '' : '  (không có thế cờ ví dụ)'}`);
});

// Mục lục
const chương = [...new Set(LESSONS.map((l) => l.chapter))];
const mụcLục = chương
  .map(
    (c) =>
      `<h2>${esc(c)}</h2><ul class="list">${LESSONS.map((l, i) => [l, i] as const)
        .filter(([l]) => l.chapter === c)
        .map(([l, i]) => `<li><a href="/hoc/${slugs[i]}/" title="${esc(l.keyPoint)}"><b>${esc(l.title)}</b><span>bài ${i + 1}</span></a></li>`)
        .join('')}</ul>`,
  )
  .join('');
writeFileSync(
  'public/hoc/index.html',
  page({
    title: 'Bài học cờ vua miễn phí — chiến thuật cho người mới · Lật Cờ',
    desc: 'Lộ trình học cờ vua miễn phí bằng tiếng Việt: ăn quân, đòn đôi, ghim quân, xiên, đòn mở, chiếu hết, tàn cuộc — mỗi bài kèm bài tập luyện ngay.',
    path: '/hoc/',
    event: 'lesson_page',
    ld: [
      {
        '@type': 'ItemList',
        name: 'Bài học cờ vua',
        itemListElement: LESSONS.map((l, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: l.title,
          url: `https://latbai.vn/hoc/${slugs[i]}/`,
        })),
      },
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Bài học cờ vua', '/hoc/'],
      ]),
    ],
    body: `<p class="crumb"><a href="/">Lật Cờ</a></p>
<h1>Bài học cờ vua</h1>
<p class="lead">${LESSONS.length} bài ngắn, từ những thứ người mới hay mắc nhất tới đòn chiến thuật và tàn cuộc. Mỗi bài đọc chưa tới một phút, rồi luyện ngay trên bàn cờ.</p>
<p><a class="cta" href="/#/hoc">Bắt đầu học trong app</a></p>
${mụcLục}`,
  }),
);

console.log(`
${LESSONS.length} bài + mục lục. Nhớ chạy lại sitemap: npm run seo`);
