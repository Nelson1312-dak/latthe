// Sinh trang bài tập công khai: latbai.vn/bai-tap-co-vua/ và một trang cho mỗi chủ đề
// (chiếu hết 1 nước, đòn đôi, ghim quân…). Mỗi trang 9 thế cờ chia ba mức dễ, vừa,
// khó, có lời giải và nút mở thẳng bài đó trong app để giải trên bàn cờ.
// Chạy: npm run puzzle-pages   (kèm sitemap)
//
// Người mới hay tìm "bài tập cờ vua", "bài tập chiếu hết 2 nước"… Thế cờ lấy từ kho
// bài tập trên máy này (data/chess.db, kho mở của Lichess, CC0): bài được nhiều người
// giải nhất trong đúng chủ đề và mức độ. Kho không nằm trên Vercel, nên chạy ở đây
// rồi đưa file sinh ra vào git. Bài đã chọn ghi vào scripts/seo/puzzle-examples.json
// để lần sau không phải hỏi kho (mỗi truy vấn trên đĩa nguội mất cả phút).

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { boardSvg } from '../src/board/Board.ts';
import type { Square } from '../shared/fen.ts';
import { LESSONS } from '../src/training/lessons.ts';
import { breadcrumbLd, esc, page, slugify } from './seo/page.ts';

interface Topic {
  slug: string;
  theme: string;
  name: string;
  group: 'mate' | 'tactic' | 'endgame';
  intro: string;
  tip: string;
  /** Bài học cùng chủ đề trong app (id trong src/training/lessons.ts). */
  lesson?: string;
}

export const TOPICS: Topic[] = [
  {
    slug: 'chieu-het-1-nuoc',
    theme: 'mateIn1',
    name: 'Chiếu hết 1 nước',
    group: 'mate',
    intro: 'Mỗi thế cờ dưới đây có một nước chiếu hết ngay. Dạng bài hợp nhất cho người mới: tập nhìn ô thoát của Vua và quân nào đang giữ ô đó.',
    tip: 'Trước khi đi, đếm các ô Vua đối phương còn chạy được. Nước chiếu hết phải vừa chiếu vừa khoá hết những ô đó.',
    lesson: 'mate1',
  },
  {
    slug: 'chieu-het-2-nuoc',
    theme: 'mateIn2',
    name: 'Chiếu hết 2 nước',
    group: 'mate',
    intro: 'Chiếu hết sau hai nước của bạn, đối phương đỡ cách nào cũng không thoát.',
    tip: 'Xét các nước theo thứ tự: chiếu, ăn quân, đe doạ. Nước đầu thường là chiếu hoặc thí quân để ép Vua vào chỗ hẹp.',
    lesson: 'mate2',
  },
  {
    slug: 'chieu-het-3-nuoc',
    theme: 'mateIn3',
    name: 'Chiếu hết 3 nước',
    group: 'mate',
    intro: 'Ba nước liên tiếp dẫn tới chiếu hết. Phải tính xa hơn: ở mỗi nước, đối phương có mấy cách đỡ.',
    tip: 'Mẫu hay gặp: thí một quân để phá lớp Tốt che Vua, rồi Hậu và Xe vào kết thúc.',
  },
  {
    slug: 'chieu-het-hang-cuoi',
    theme: 'backRankMate',
    name: 'Chiếu hết hàng cuối',
    group: 'mate',
    intro: 'Vua nằm sau ba Tốt chưa đi, không có ô thở. Xe hoặc Hậu vào được hàng cuối là hết cờ.',
    tip: 'Thấy Vua đối phương chưa có ô thở, kiểm tra ngay xem hàng cuối còn ai giữ. Quân giữ hàng cuối thường là mục tiêu để đánh lạc hướng.',
    lesson: 'backrank',
  },
  {
    slug: 'chieu-het-nghet-tho',
    theme: 'smotheredMate',
    name: 'Chiếu hết nghẹt thở',
    group: 'mate',
    intro: 'Vua bị chính quân mình vây kín, chỉ cần một con Mã chiếu là xong.',
    tip: 'Mẫu kinh điển: Hậu chiếu ở g8 (hoặc g1), thí cho Xe ăn, rồi Mã nhảy vào f7 (f2) chiếu hết.',
    lesson: 'smothered',
  },
  {
    slug: 'don-doi',
    theme: 'fork',
    name: 'Đòn đôi',
    group: 'tactic',
    intro: 'Một quân tấn công hai quân đối phương cùng lúc; đối phương chỉ cứu được một.',
    tip: 'Mã bắt đôi giỏi nhất. Tìm ô mà từ đó quân của bạn chạm cùng lúc tới Vua, Hậu, Xe hoặc quân không được bảo vệ.',
    lesson: 'fork',
  },
  {
    slug: 'ghim-quan',
    theme: 'pin',
    name: 'Ghim quân',
    group: 'tactic',
    intro: 'Quân bị ghim không dám đi, vì đi là để lộ quân giá trị hơn đứng phía sau.',
    tip: 'Quân bị ghim gần như đứng chết: dồn thêm quân đánh vào nó, hoặc lợi dụng việc nó không bảo vệ được ô khác.',
    lesson: 'pin',
  },
  {
    slug: 'don-xien',
    theme: 'skewer',
    name: 'Đòn xiên',
    group: 'tactic',
    intro: 'Ngược với ghim: tấn công quân giá trị cao đứng trước, nó tránh đi thì ăn quân phía sau.',
    tip: 'Hay gặp khi Vua và Hậu, hoặc Vua và Xe, đứng trên cùng một hàng, cột hay đường chéo.',
    lesson: 'skewer',
  },
  {
    slug: 'don-mo',
    theme: 'discoveredAttack',
    name: 'Đòn mở',
    group: 'tactic',
    intro: 'Đi một quân để mở đường cho quân đứng sau tấn công.',
    tip: 'Quân vừa đi được tự do làm việc khác: ăn quân, chiếu, đe doạ. Đối phương phải đỡ hai thứ một lúc.',
    lesson: 'discovered',
  },
  {
    slug: 'chieu-doi',
    theme: 'doubleCheck',
    name: 'Chiếu đôi',
    group: 'tactic',
    intro: 'Hai quân cùng chiếu một lúc. Không chặn được, không ăn được cả hai: Vua bắt buộc phải chạy.',
    tip: 'Chiếu đôi là dạng mạnh nhất của đòn mở. Quân đi mở đường có thể đứng ngay cả ô bị ăn, vì đối phương không có thời gian ăn nó.',
  },
  {
    slug: 'quan-bi-bo-ho',
    theme: 'hangingPiece',
    name: 'Ăn quân bị bỏ hở',
    group: 'tactic',
    intro: 'Đối phương để một quân không ai bảo vệ. Tìm ra rồi ăn.',
    tip: 'Mỗi lượt hãy hỏi: quân nào của đối phương không được bảo vệ? Nghe đơn giản nhưng đây là cách thắng quân hay gặp nhất khi mới chơi.',
    lesson: 'hanging',
  },
  {
    slug: 'danh-lac-huong',
    theme: 'deflection',
    name: 'Đánh lạc hướng',
    group: 'tactic',
    intro: 'Kéo quân phòng thủ ra khỏi việc nó đang làm, rồi đánh vào chỗ nó vừa bỏ trống.',
    tip: 'Tìm quân đối phương đang gánh hai việc (giữ một ô và giữ một quân). Bắt nó chọn một.',
    lesson: 'deflection',
  },
  {
    slug: 'du-quan',
    theme: 'attraction',
    name: 'Dụ quân',
    group: 'tactic',
    intro: 'Thí quân để kéo Vua hoặc quân đối phương vào một ô xấu, rồi đánh đòn tiếp theo.',
    tip: 'Hay đi kèm đòn đôi: dụ Vua và Hậu vào hai ô cách nhau đúng một bước Mã.',
  },
  {
    slug: 'quan-bi-ket',
    theme: 'trappedPiece',
    name: 'Bắt quân bị kẹt',
    group: 'tactic',
    intro: 'Quân đối phương không còn ô nào an toàn để chạy. Vây cho chặt rồi ăn.',
    tip: 'Tượng và Mã đi sâu vào trận đối phương, hay Hậu ăn Tốt b2 (b7), là những quân dễ bị kẹt nhất.',
    lesson: 'trapped',
  },
  {
    slug: 'phong-cap',
    theme: 'promotion',
    name: 'Phong cấp',
    group: 'endgame',
    intro: 'Đưa Tốt tới hàng cuối thành Hậu. Thường cần một nước dọn đường hoặc đánh lạc hướng quân đang chặn.',
    tip: 'Đếm số nước Tốt cần để tới hàng cuối, so với số nước đối phương cần để chặn. Đôi khi phong Mã hoặc Xe mới đúng.',
    lesson: 'advanced-pawn',
  },
  {
    slug: 'tan-cuoc-tot',
    theme: 'pawnEndgame',
    name: 'Tàn cuộc Tốt',
    group: 'endgame',
    intro: 'Chỉ còn Vua và Tốt. Một nhịp đi sai là mất thắng hoặc mất hoà.',
    tip: 'Vua phải đi trước Tốt. Nhớ hai thứ: đối Vua và quy tắc hình vuông.',
    lesson: 'pawn-endgame',
  },
  {
    slug: 'tan-cuoc-xe',
    theme: 'rookEndgame',
    name: 'Tàn cuộc Xe',
    group: 'endgame',
    intro: 'Dạng tàn cuộc hay gặp nhất trong ván thật. Xe hoạt động thắng Xe thụ động.',
    tip: 'Đặt Xe sau Tốt thông, của mình hay của đối phương đều vậy. Xe ngồi giữ trước Tốt là Xe bị trói.',
    lesson: 'rook-endgame',
  },
];

const MỨC: [tên: string, min: number, max: number][] = [
  ['Dễ', 600, 1100],
  ['Vừa', 1100, 1600],
  ['Khó', 1600, 2100],
];
const MỖI_MỨC = 3;

interface Example {
  id: string;
  fen: string;
  side: 'w' | 'b';
  lastMove: [Square, Square];
  rating: number;
  solution: string[];
}

function replay(id: string, fen0: string, moves: string, rating: number): Example | null {
  const ms = moves.split(' ');
  const c = new Chess(fen0);
  const uci = (u: string) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  try {
    const m0 = c.move(uci(ms[0]));
    const fen = c.fen();
    const side = c.turn();
    const sans = ms.slice(1).map((u) => c.move(uci(u)).san);
    return { id, fen, side, lastMove: [m0.from as Square, m0.to as Square], rating, solution: sans };
  } catch {
    return null;
  }
}

const CACHE = 'scripts/seo/puzzle-examples.json';
type Cached = { key: string; count: number; ex: Example[][] };
const cache: Record<string, Cached> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const đãDùng = new Set(Object.values(cache).flatMap((c) => c.ex.flat().map((e) => e.id)));
const keyOf = (t: Topic) => `${t.theme}:${MỨC.map((m) => m.join('-')).join(',')}:${MỖI_MỨC}`;

/**
 * Chọn bài cho các chủ đề chưa có trong cache. Hỏi theo từng chủ đề (JOIN rồi sắp
 * theo độ phổ biến) mất cả phút mỗi câu trên đĩa nguội, nên quét tuần tự bảng
 * puzzles đúng một lần rồi chia nhóm trong bộ nhớ: vài chục giây cho mọi chủ đề.
 */
function fillCache(): void {
  const thiếu = TOPICS.filter((t) => cache[t.slug]?.key !== keyOf(t));
  if (!thiếu.length) return;
  const db = new DatabaseSync('data/chess.db', { readOnly: true });
  type Row = { id: string; fen: string; moves: string; rating: number; themes: string; popularity: number };
  const GIỮ = 40;
  // Mỗi chủ đề × mức: giữ GIỮ bài phổ biến nhất (lời giải ngắn), sắp lại ở cuối
  const nhóm = new Map(thiếu.map((t) => [t.slug, MỨC.map(() => [] as Row[])]));
  const đếm = new Map(thiếu.map((t) => [t.theme, 0]));
  const theoChủĐề = new Map<string, Topic[]>();
  for (const t of thiếu) theoChủĐề.set(t.theme, [...(theoChủĐề.get(t.theme) ?? []), t]);
  let n = 0;
  // Đọc từng khúc theo rowid (iterate() của node:sqlite bản này báo lỗi giữa chừng)
  const khúc = db.prepare(
    'SELECT rowid AS rid, id, fen, moves, rating, themes, popularity FROM puzzles WHERE rowid > ? ORDER BY rowid LIMIT 50000',
  );
  function* rows(): Generator<Row> {
    let sau = 0;
    for (;;) {
      const ds = khúc.all(sau) as (Row & { rid: number })[];
      if (!ds.length) return;
      sau = ds.at(-1)!.rid;
      yield* ds;
    }
  }
  for (const r of rows()) {
    if (++n % 200_000 === 0) console.log(`  quét kho: ${n.toLocaleString('vi-VN')} bài`);
    for (const th of r.themes.split(' ')) {
      const ts = theoChủĐề.get(th);
      if (!ts) continue;
      đếm.set(th, đếm.get(th)! + 1);
      // Lời giải dài quá thì khó đọc trên trang tĩnh
      if (r.moves.split(' ').length > 6) continue;
      const i = MỨC.findIndex(([, min, max]) => r.rating >= min && r.rating < max);
      if (i < 0) continue;
      for (const t of ts) {
        const ds = nhóm.get(t.slug)![i];
        if (ds.length < GIỮ) ds.push({ ...r });
        else {
          let k = 0;
          for (let j = 1; j < ds.length; j++) if (ds[j].popularity < ds[k].popularity) k = j;
          if (r.popularity > ds[k].popularity) ds[k] = { ...r };
        }
      }
    }
  }
  db.close();
  for (const t of thiếu) {
    const ex = nhóm.get(t.slug)!.map((ds) => {
      const out: Example[] = [];
      for (const r of ds.sort((a, b) => b.popularity - a.popularity || a.id.localeCompare(b.id))) {
        if (out.length >= MỖI_MỨC) break;
        if (đãDùng.has(r.id)) continue; // một bài thuộc nhiều chủ đề: mỗi bài chỉ hiện ở một trang
        const e = replay(r.id, r.fen, r.moves, r.rating);
        if (!e) continue;
        out.push(e);
        đãDùng.add(r.id);
      }
      return out;
    });
    cache[t.slug] = { key: keyOf(t), count: đếm.get(t.theme)!, ex };
  }
  writeFileSync(CACHE, JSON.stringify(cache, null, 1) + '\n');
}

// ---------------------------------------------------------------- trình bày

const bên = (s: 'w' | 'b') => (s === 'w' ? 'Trắng' : 'Đen');
const số = (n: number) => n.toLocaleString('vi-VN');

/** ["Qxa8+","Rc8","Qxc8#"] khi Trắng đi trước → "1.Qxa8+ Rc8 2.Qxc8#" */
function lờiGiải(e: Example): string {
  const n0 = Number(e.fen.split(' ')[5]);
  return e.solution
    .map((s, i) => {
      const ply = i + (e.side === 'b' ? 1 : 0);
      const n = n0 + Math.floor(ply / 2);
      const nước = i % 2 === 0 ? `<b>${esc(s)}</b>` : esc(s);
      if (ply % 2 === 0) return `${n}.${nước}`;
      return i === 0 ? `${n}…${nước}` : nước;
    })
    .join(' ');
}

const lessonSlug = (id?: string) => {
  const l = LESSONS.find((x) => x.id === id);
  return l ? { l, slug: slugify(l.title) } : null;
};

function puzzleFigure(e: Example, k: number, t: Topic): string {
  return `<figure class="pz" id="bai-${k}">
<div class="board-wrap">${boardSvg({ fen: e.fen, orientation: e.side, lastMove: e.lastMove, label: `Bài ${k}: ${bên(e.side)} đi, ${t.name.toLowerCase()}` })}</div>
<figcaption><b>Bài ${k}</b> · ${bên(e.side)} đi · độ khó ${e.rating}</figcaption>
<p class="pz-go"><a href="/#/on-tap?bai-tap=${e.id}">Giải trên bàn cờ</a></p>
<details><summary>Lời giải</summary><p class="moves">${lờiGiải(e)}</p></details>
</figure>`;
}

const NHÓM: [Topic['group'], string][] = [
  ['mate', 'Chiếu hết'],
  ['tactic', 'Đòn chiến thuật'],
  ['endgame', 'Tàn cuộc'],
];

const NGUỒN = '<p class="meta">Thế cờ lấy từ kho bài tập mở của Lichess (CC0), chọn những bài được giải nhiều nhất.</p>';

function topicPage(t: Topic, c: Cached): string {
  const path = `/bai-tap-co-vua/${t.slug}/`;
  const tổng = c.ex.flat().length;
  const ls = lessonSlug(t.lesson);
  const desc = `${tổng} bài tập ${t.name.toLowerCase()} có lời giải, chia ba mức dễ, vừa, khó. ${t.intro}`;
  let k = 0;
  const mức = MỨC.map(([tên], i) =>
    c.ex[i].length
      ? `<h2>${tên}</h2><div class="pzs">${c.ex[i].map((e) => puzzleFigure(e, ++k, t)).join('')}</div>`
      : '',
  ).join('\n');
  const khác = TOPICS.filter((x) => x.group === t.group && x !== t);
  const body = `
<p class="crumb"><a href="/">Lật Cờ</a> · <a href="/bai-tap-co-vua/">Bài tập cờ vua</a></p>
<h1>Bài tập ${esc(t.name.toLowerCase())}</h1>
<p class="lead">${esc(t.intro)}</p>
<p class="key"><b>Mẹo:</b> ${esc(t.tip)}</p>
${mức}
${NGUỒN}
<h2>Luyện thêm</h2>
<p>Kho của Lật Cờ có ${số(c.count)} bài ${esc(t.name.toLowerCase())}. Giải trong app thì đi được trên bàn cờ, sai được chỉ lại, và bài khó dần theo sức bạn.</p>
<p>${
    ls
      ? `<a class="cta" href="/#/hoc?bai=${ls.l.id}">Luyện ${esc(t.name.toLowerCase())}</a><a class="cta alt" href="/hoc/${ls.slug}/">Đọc bài học</a>`
      : `<a class="cta" href="/#/on-tap">Giải bài tập trong app</a>`
  }</p>
<h2>Chủ đề khác</h2>
<ul class="list">${khác.map((x) => `<li><a href="/bai-tap-co-vua/${x.slug}/" title="Bài tập ${esc(x.name.toLowerCase())}"><b>${esc(x.name)}</b><span>${số(cache[x.slug]?.count ?? 0)} bài</span></a></li>`).join('')}</ul>`;
  return page({
    title: `Bài tập ${t.name.toLowerCase()} có lời giải — cờ vua · Lật Cờ`,
    desc,
    path,
    body,
    withSprite: true,
    event: 'puzzle_page',
    ld: [
      {
        '@type': 'LearningResource',
        name: `Bài tập ${t.name.toLowerCase()}`,
        description: desc,
        inLanguage: 'vi',
        learningResourceType: 'Bài tập',
        isAccessibleForFree: true,
        url: `https://latbai.vn${path}`,
      },
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Bài tập cờ vua', '/bai-tap-co-vua/'],
        [`Bài tập ${t.name.toLowerCase()}`, path],
      ]),
    ],
  });
}

function hubPage(): string {
  const đầu = cache[TOPICS[0].slug].ex[0][0];
  const desc =
    'Bài tập cờ vua miễn phí có lời giải: chiếu hết 1 nước, 2 nước, 3 nước, đòn đôi, ghim quân, đòn xiên, tàn cuộc… chia theo độ khó, giải được ngay trên bàn cờ.';
  const body = `
<p class="crumb"><a href="/">Lật Cờ</a></p>
<h1>Bài tập cờ vua</h1>
<p class="lead">Giải bài tập là cách lên tay nhanh nhất: mỗi bài là một thế cờ thật, có đúng một đường thắng. Chọn chủ đề, bắt đầu từ mức dễ.</p>
<h2>Thử một bài</h2>
${puzzleFigure(đầu, 1, TOPICS[0]).replace('class="pz"', 'class="pz one"')}
${NHÓM.map(
  ([g, tên]) =>
    `<h2>${tên}</h2><ul class="list">${TOPICS.filter((t) => t.group === g)
      .map((t) => `<li><a href="/bai-tap-co-vua/${t.slug}/" title="Bài tập ${esc(t.name.toLowerCase())}"><b>${esc(t.name)}</b><span>${số(cache[t.slug].count)} bài</span></a></li>`)
      .join('')}</ul>`,
).join('\n')}
<h2>Giải trong app</h2>
<p>Kho của Lật Cờ có hơn một triệu bài. Trong app, độ khó tự lên xuống theo kết quả của bạn, và những nước bạn đi hỏng trong ván thật cũng thành bài để ôn lại.</p>
<p><a class="cta" href="/#/on-tap">Giải bài tập</a><a class="cta alt" href="/hoc/">Học từng chủ đề</a></p>
${NGUỒN}`;
  return page({
    title: 'Bài tập cờ vua có lời giải — chiếu hết 1, 2, 3 nước, đòn chiến thuật · Lật Cờ',
    desc,
    path: '/bai-tap-co-vua/',
    body,
    withSprite: true,
    event: 'puzzle_page',
    ld: [
      {
        '@type': 'ItemList',
        name: 'Bài tập cờ vua theo chủ đề',
        itemListElement: TOPICS.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `Bài tập ${t.name.toLowerCase()}`,
          url: `https://latbai.vn/bai-tap-co-vua/${t.slug}/`,
        })),
      },
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Bài tập cờ vua', '/bai-tap-co-vua/'],
      ]),
    ],
  });
}

// ---------------------------------------------------------------- ghi file

fillCache();
const all = TOPICS.map((t) => [t, cache[t.slug]] as const);
for (const [t, c] of all) {
  mkdirSync(`public/bai-tap-co-vua/${t.slug}`, { recursive: true });
  writeFileSync(`public/bai-tap-co-vua/${t.slug}/index.html`, topicPage(t, c));
  console.log(`${t.slug}: ${c.ex.map((x) => x.length).join('/')} bài`);
}
writeFileSync('public/bai-tap-co-vua/index.html', hubPage());
console.log('bai-tap-co-vua: mục lục');
