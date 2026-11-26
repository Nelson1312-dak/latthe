// Sinh thêm trang đọc cho người mới (chạy cùng build-guides trong `npm run seo`):
//   latbai.vn/choi-co-vua-voi-may/   — trang đích "chơi cờ vua với máy"
//   latbai.vn/choi-co-vua-online/    — trang đích "chơi cờ vua online"
//   latbai.vn/meo-choi-co-vua/       — mẹo cho người mới
//   latbai.vn/bay-khai-cuoc/…        — các bẫy khai cuộc hay gặp (chiếu hết 4 nước…)
//   latbai.vn/tan-cuoc/…             — tàn cuộc cơ bản (Hậu, Xe chiếu hết, đối Vua…)
//
// Mọi nước đi và thế cờ trên trang đều được chess.js đi lại khi sinh trang: chép sai
// một nước là script dừng, không ra trang sai.

import { mkdirSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { boardSvg, type Arrow } from '../src/board/Board.ts';
import type { Square } from '../shared/fen.ts';
import { LEVELS } from '../src/engine/levels.ts';
import { CONTROLS } from '../shared/protocol.ts';
import { articleLd, breadcrumbLd, esc, faqLd, page } from './seo/page.ts';

// ---------------------------------------------------------------- công cụ

type Opts = Parameters<typeof boardSvg>[0];
const fig = (o: Opts, caption?: string) =>
  `<figure><div class="board-wrap">${boardSvg(o)}</div>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
/**
 * Khoanh một vùng chữ nhật (ví dụ hình vuông của Tốt) bằng một nét viền, thay vì tô
 * từng ô: tô màu trên bàn xanh lá trông như các mảng ngẫu nhiên. Bàn nhìn từ phía Trắng.
 */
function outline(svg: string, from: Square, to: Square): string {
  const SQ = 50;
  const f = (s: Square) => 'abcdefgh'.indexOf(s[0]);
  const r = (s: Square) => Number(s[1]);
  const x0 = Math.min(f(from), f(to)) * SQ;
  const x1 = (Math.max(f(from), f(to)) + 1) * SQ;
  const y0 = (8 - Math.max(r(from), r(to))) * SQ;
  const y1 = (9 - Math.min(r(from), r(to))) * SQ;
  const w = 4;
  const rect = `<rect x="${x0 + w / 2}" y="${y0 + w / 2}" width="${x1 - x0 - w}" height="${y1 - y0 - w}" fill="none" stroke="var(--brush-b)" stroke-width="${w}" rx="2"/>`;
  assert(/viewBox="0 0 400 400"/.test(svg), 'outline: bàn cờ không phải khung 400');
  return svg.replace(/<\/svg>$/, `${rect}</svg>`);
}

const boards = (...xs: string[]) => `<div class="boards wide">${xs.join('')}</div>`;

/** Đi một dãy nước SAN từ thế `fen` (mặc định thế đầu ván); sai nước là ném lỗi. */
function play(sans: string[], fen?: string) {
  const c = fen ? new Chess(fen) : new Chess();
  const hist = sans.map((s) => {
    const m = c.move(s);
    if (!m) throw new Error(`nước sai: ${s}`);
    return m;
  });
  return { c, hist };
}

/** Thế cờ sau `n` nước đầu của dãy, kèm nước cuối để tô ô. */
function after(sans: string[], n: number, fen?: string) {
  const { c, hist } = play(sans.slice(0, n), fen);
  const last = hist.at(-1);
  return {
    fen: c.fen(),
    lastMove: last ? ([last.from, last.to] as [Square, Square]) : undefined,
    check: c.inCheck() ? kingSquare(c) : undefined,
    mate: c.isCheckmate(),
  };
}

function kingSquare(c: Chess): Square {
  const turn = c.turn();
  for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === turn) return p.square as Square;
  throw new Error('không thấy Vua');
}

/** "1.e4 e5 2.Bc4" — `firstNo` là số nước của nước đầu, `black` nếu Đen đi trước. */
function movesText(sans: string[], firstNo = 1, black = false): string {
  return sans
    .map((s, i) => {
      const ply = i + (black ? 1 : 0);
      const n = firstNo + Math.floor(ply / 2);
      if (ply % 2 === 0) return `${n}.${s}`;
      return i === 0 ? `${n}…${s}` : s;
    })
    .join(' ');
}

const assert = (ok: boolean, msg: string) => {
  if (!ok) throw new Error(msg);
};

const write = (dir: string, html: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, html);
  console.log(dir);
};

const crumb = (...xs: [string, string][]) =>
  `<p class="crumb"><a href="/">Lật Cờ</a>${xs.map(([t, p]) => ` · <a href="${p}">${esc(t)}</a>`).join('')}</p>`;

// ---------------------------------------------------------------- trang đích: chơi với máy

function botPage(): string {
  const path = '/choi-co-vua-voi-may/';
  // Một lúc thật trong ván: bạn cầm Đen, xin gợi ý tới nấc 3 thì app vẽ mũi tên nước cụ thể
  const ý = after(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5'], 7);
  const qa: [string, string][] = [
    ['Chơi cờ vua với máy trên Lật Cờ có mất phí không?', 'Không. Chơi với máy, gợi ý, đi lại và chấm ván đều miễn phí.'],
    [
      'Có cần đăng ký tài khoản không?',
      'Không cần. Mở trang là chơi được ngay. Đăng nhập bằng Google chỉ để lưu ván, Elo và các thế cờ bạn hay đi hỏng.',
    ],
    ['Chơi trên điện thoại được không?', 'Được. Trang chạy trên trình duyệt điện thoại, và có thể thêm vào màn hình chính để mở như một ứng dụng.'],
  ];
  const desc =
    'Chơi cờ vua với máy miễn phí, không cần đăng ký: 8 cấp độ từ người mới tập tới Stockfish mạnh hết sức, có gợi ý, đi lại và chấm từng nước sau ván. Chơi ngay trên điện thoại hoặc máy tính.';
  const body = `
${crumb()}
<h1>Chơi cờ vua với máy</h1>
<p class="lead">Mở là chơi, không cần tài khoản. Chọn một trong 8 cấp độ, từ máy đôi khi để hở quân cho người mới tới Stockfish mạnh hết sức.</p>
<p><a class="cta" href="/#/choi">Chơi với máy ngay</a></p>

<h2>Tám cấp độ máy</h2>
<p>Ba cấp đầu không chơi ngẫu nhiên: máy nghĩ nông rồi cố ý chọn một nước chưa tốt nhất, nên sai lầm giống người thật (để hở quân, bỏ lỡ nước ăn). Từ cấp 4, máy dùng Stockfish giới hạn theo Elo.</p>
<table>
  <tr><th>Cấp</th><th>Hợp với</th></tr>
  ${LEVELS.map((l) => `<tr><td>${esc(l.name)}</td><td>${esc(l.hint)}</td></tr>`).join('\n  ')}
</table>
<p>Chưa biết chọn cấp nào: bắt đầu ở cấp 2, thắng hai ván liền thì lên một cấp.</p>

<h2>Trong ván có gì</h2>
<ul>
  <li><b>Gợi ý ba nấc</b>: lần đầu chỉ nói nên để ý gì, lần hai nói quân nào, lần ba mới chỉ nước cụ thể.</li>
  <li><b>Đi lại</b> nước vừa đi, không giới hạn.</li>
  <li><b>Trợ lý</b> báo khi bạn sắp đi một nước hỏng nặng, để bạn nghĩ lại trước khi máy trừng phạt.</li>
  <li><b>Chấm ván</b> sau trận: từng nước được xếp loại (hay, sai, sai nặng), kèm biểu đồ đánh giá và nước tốt hơn.</li>
</ul>
${fig(
    { fen: ý.fen, orientation: 'b', lastMove: ý.lastMove, arrows: [{ from: 'd8', to: 'g5' }] as Arrow[], label: 'Gợi ý nấc 3: Hậu d8 ra g5' },
    'Bạn cầm Đen, máy vừa ăn Tốt e5. Gợi ý nấc 3 chỉ nước cụ thể: Hậu ra g5, đánh cùng lúc Mã e5 và Tốt g2.',
  )}
<p>Muốn biết máy chấm thế nào: <a href="/cham-van-co-vua/">chấm ván cờ vua hoạt động ra sao</a>.</p>

<h2>Câu hỏi hay gặp</h2>
${qa.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n')}

<h2>Chưa biết luật?</h2>
<p>Đọc <a href="/luat-co-vua/">luật cờ vua cho người mới</a> trong năm phút, hoặc vào chơi luôn: app chỉ cho đi nước hợp lệ, nên không sợ đi sai luật.</p>
<p><a class="cta" href="/#/choi">Chơi với máy</a><a class="cta alt" href="/choi-co-vua-online/">Chơi với người</a></p>`;
  return page({
    title: 'Chơi cờ vua với máy miễn phí — 8 cấp độ, không cần đăng ký · Lật Cờ',
    desc,
    path,
    body,
    withSprite: true,
    event: 'guide_page',
    type: 'website',
    ld: [
      {
        '@type': 'WebPage',
        name: 'Chơi cờ vua với máy',
        description: desc,
        inLanguage: 'vi',
        url: `https://latbai.vn${path}`,
      },
      faqLd(qa),
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Chơi cờ vua với máy', path],
      ]),
    ],
  });
}

// ---------------------------------------------------------------- trang đích: chơi online

function onlinePage(): string {
  const path = '/choi-co-vua-online/';
  const tên: Record<string, string> = { '3+2': 'Chớp', '5+0': 'Nhanh', '10+0': 'Vừa', '15+10': 'Thong thả' };
  const qa: [string, string][] = [
    ['Chơi cờ vua online trên Lật Cờ có mất phí không?', 'Không. Ghép trận, mời bạn bè và chấm ván sau trận đều miễn phí.'],
    [
      'Có cần tài khoản không?',
      'Chơi với người cần đăng nhập bằng Google để giữ Elo và chống bỏ trận. Chơi với máy thì không cần.',
    ],
  ];
  const desc =
    'Chơi cờ vua online với người miễn phí: ghép trận theo Elo trong vài giây, 4 thể thức 3+2, 5+0, 10+0, 15+10, mời bạn bè bằng mã, chấm từng nước sau ván. Không cần cài đặt.';
  const body = `
${crumb()}
<h1>Chơi cờ vua online với người</h1>
<p class="lead">Bấm Tìm trận, Lật Cờ ghép bạn với người có Elo gần nhất. Chơi ngay trên trình duyệt, điện thoại hay máy tính đều được, không cần cài gì.</p>
<p><a class="cta" href="/#/ban">Tìm trận</a></p>

<h2>Bốn thể thức</h2>
<table>
  <tr><th>Thể thức</th><th>Mỗi bên</th><th>Cộng mỗi nước</th></tr>
  ${Object.entries(CONTROLS)
    .map(([k, c]) => `<tr><td>${esc(tên[k] ?? k)} (${esc(c.label)})</td><td>${c.initialMs / 60_000} phút</td><td>${c.incrementMs ? `${c.incrementMs / 1000} giây` : 'không'}</td></tr>`)
    .join('\n  ')}
</table>
<p>Mới chơi nên chọn 10+0 hoặc 15+10: đủ thời gian nghĩ, ít thua vì hết giờ.</p>

<h2>Ghép trận thế nào</h2>
<ul>
  <li><b>Theo Elo</b>: lúc đầu chỉ ghép người gần sức bạn, chờ lâu thì nới dần khoảng cách.</li>
  <li><b>Không phải chờ</b>: sau 5 giây chưa có ai, bạn đấu với một AI có Elo gần bạn. AI luôn ghi rõ là AI.</li>
  <li><b>Mời bạn bè</b>: lấy mã 6 ký tự, gửi qua Zalo hay Messenger, bạn nhập mã là vào ván.</li>
  <li><b>Sau ván</b>: mở chấm ván để xem nước nào hay, nước nào hỏng, và đáng lẽ nên đi gì.</li>
</ul>

<h2>Câu hỏi hay gặp</h2>
${qa.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n')}

<p><a class="cta" href="/#/ban">Tìm trận</a><a class="cta alt" href="/choi-co-vua-voi-may/">Chơi với máy</a></p>`;
  return page({
    title: 'Chơi cờ vua online với người — ghép trận theo Elo, miễn phí · Lật Cờ',
    desc,
    path,
    body,
    withSprite: false,
    event: 'guide_page',
    type: 'website',
    ld: [
      { '@type': 'WebPage', name: 'Chơi cờ vua online với người', description: desc, inLanguage: 'vi', url: `https://latbai.vn${path}` },
      faqLd(qa),
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Chơi cờ vua online', path],
      ]),
    ],
  });
}

// ---------------------------------------------------------------- mẹo cho người mới

function tipsPage(): string {
  const path = '/meo-choi-co-vua/';
  // Ví dụ cho mẹo "quân không ai bảo vệ": Mã c6 không ai giữ, Tượng b5 ăn được ngay
  const hở = after(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nd4', 'Nxd4', 'exd4'], 8);
  const tips: [string, string][] = [
    ['Đối phương vừa đi để làm gì?', 'Trước mỗi nước của mình, nhìn nước vừa rồi của đối phương: nó doạ ăn quân nào, mở đường cho quân nào, chuẩn bị chiếu ở đâu. Phần lớn ván thua của người mới là do bỏ qua câu hỏi này.'],
    ['Xét chiếu, ăn quân, đe doạ', 'Trước khi chốt nước, liệt kê mọi nước chiếu, mọi nước ăn quân và mọi nước đe doạ của cả hai bên. Đòn chiến thuật hầu như luôn nằm trong ba loại này.'],
    ['Quân nào đang không ai bảo vệ?', 'Quân không được bảo vệ là mục tiêu của đòn đôi, đòn xiên và đòn mở. Giữ quân mình có quân khác che chở, và để ý quân đối phương đứng trơ trọi.'],
    ['Chiếm trung tâm', 'Đi Tốt e hoặc d ở nước đầu. Quân đứng ở bốn ô giữa (d4, e4, d5, e5) khống chế nhiều ô nhất.'],
    ['Ra Mã, Tượng trước; Hậu sau', 'Hậu ra sớm dễ bị quân nhỏ đuổi, mất nhịp. Đưa Mã và Tượng ra trước, mỗi quân một lần.'],
    ['Nhập thành sớm', 'Thường trong khoảng mười nước đầu. Vua vào góc an toàn, Xe được nối với nhau và ra giữa bàn.'],
    ['Đổi quân khi đang hơn', 'Hơn một quân thì đổi quân đều để đơn giản thế cờ: càng ít quân, phần hơn càng rõ. Đang kém thì làm ngược lại.'],
    ['Tàn cuộc: Vua là quân đánh', 'Khi Hậu đã đổi hết, đưa Vua ra giữa bàn. Vua giúp Tốt đi lên và chặn Tốt đối phương.'],
    ['Đừng vội', 'Chơi ván 10 phút trở lên. Ván chớp 1–3 phút luyện phản xạ, nhưng không dạy cách nghĩ.'],
    ['Xem lại ván thua', 'Sau mỗi ván thua, tìm nước làm thay đổi kết quả. Một nước hỏng được hiểu rõ đáng giá hơn mười ván chơi tiếp.'],
  ];
  const ví_dụ = fig(
    { fen: hở.fen, lastMove: hở.lastMove, label: 'Sau 4...exd4: Tượng b5 đang đứng trơ trọi' },
    'Sau 1.e4 e5 2.Nf3 Nc6 3.Bb5 Nd4 4.Nxd4 exd4: Tượng b5 không còn ai bảo vệ. Nếu Đen có nước đe doạ nó kèm một đòn khác, Trắng sẽ mất quân.',
  );
  const desc =
    '10 mẹo chơi cờ vua cho người mới, xếp theo mức hay mắc: nhìn nước của đối phương, xét chiếu – ăn quân – đe doạ, giữ quân được bảo vệ, khai cuộc, nhập thành, tàn cuộc và cách xem lại ván.';
  const body = `
${crumb()}
<h1>Mẹo chơi cờ vua cho người mới</h1>
<p class="lead">Mười thói quen giúp bớt thua những ván không đáng thua, không cần thuộc khai cuộc. Ba mẹo đầu quan trọng nhất: hầu hết ván của người mới được quyết định bởi một quân bị bỏ hở.</p>
<ol class="tips">${tips.map(([t, d], i) => `<li><h2>${esc(t)}</h2><p>${esc(d)}</p>${i === 2 ? ví_dụ : ''}</li>`).join('')}</ol>
<h2>Luyện ngay</h2>
<p>Mẹo chỉ thành thói quen khi dùng nhiều lần. Bài tập theo chủ đề là cách luyện nhanh nhất, còn chấm ván cho bạn thấy chính lỗi của mình.</p>
<p><a class="cta" href="/bai-tap-co-vua/">Giải bài tập</a><a class="cta alt" href="/#/choi">Chơi một ván</a></p>`;
  return page({
    title: '10 mẹo chơi cờ vua cho người mới — tránh những lỗi hay mắc nhất · Lật Cờ',
    desc,
    path,
    body,
    withSprite: true,
    event: 'guide_page',
    ld: [
      articleLd({ title: '10 mẹo chơi cờ vua cho người mới', desc, path }),
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Mẹo chơi cờ vua', path],
      ]),
    ],
  });
}

// ---------------------------------------------------------------- bẫy khai cuộc

interface Trap {
  slug: string;
  name: string;
  en: string;
  /** Bên gài bẫy. */
  by: 'Trắng' | 'Đen';
  moves: string[];
  /** Chỉ số (từ 0) của nước sai lầm của bên bị bẫy. */
  blunder: number;
  lead: string;
  how: string[];
  avoid: string[];
  /** Kết thúc bằng chiếu hết? (kiểm tra bằng chess.js) */
  mate: boolean;
  opening?: [string, string];
  qa?: [string, string][];
}

const TRAPS: Trap[] = [
  {
    slug: 'chieu-het-4-nuoc',
    name: 'Chiếu hết 4 nước',
    en: "Scholar's Mate",
    by: 'Trắng',
    moves: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'],
    blunder: 5,
    lead: 'Cách chiếu hết nhanh mà người mới hay dính nhất. Hậu và Tượng Trắng cùng nhắm vào ô f7, nơi chỉ có Vua Đen bảo vệ.',
    how: [
      'Tượng c4 và Hậu h5 cùng nhắm vào f7.',
      'Đen ra Mã f6 đuổi Hậu, nhưng quên mất f7.',
      'Hậu ăn f7, được Tượng c4 bảo vệ: Vua Đen không ăn lại được, không chạy được. Chiếu hết.',
    ],
    avoid: [
      'Sau 3.Qh5, đi 3...g6: Tốt chặn đường Hậu và đuổi nó luôn. Nếu Trắng đi 4.Qf3 doạ f7 lần nữa thì 4...Nf6 là đủ.',
      'Hoặc 3...Qe7, 3...Qf6: Hậu Đen giữ f7.',
      'Với bên Trắng: đưa Hậu ra sớm thế này chỉ ăn được người chưa biết. Gặp người biết đỡ, Hậu bị đuổi mất nhiều nhịp.',
    ],
    mate: true,
    qa: [
      ['Chiếu hết 4 nước là gì?', 'Là cách Trắng chiếu hết Đen ở nước thứ tư: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#. Hậu ăn Tốt f7 với Tượng c4 bảo vệ.'],
      ['Làm sao để không bị chiếu hết 4 nước?', 'Khi Hậu Trắng ra h5 hoặc f3 nhắm f7, giữ ô f7 bằng Hậu (Qe7, Qf6) hoặc chặn đường bằng Tốt g6, Mã f6.'],
    ],
  },
  {
    slug: 'chieu-het-2-nuoc',
    name: 'Chiếu hết 2 nước',
    en: "Fool's Mate",
    by: 'Đen',
    moves: ['f3', 'e5', 'g4', 'Qh4#'],
    blunder: 2,
    lead: 'Ván cờ ngắn nhất có thể. Trắng đẩy hai Tốt f và g, mở toang đường chéo từ h4 tới Vua e1.',
    how: [
      '1.f3 làm hở đường chéo e1–h4.',
      '2.g4 bỏ luôn quân chặn cuối cùng.',
      'Hậu Đen ra h4 chiếu: không quân nào chặn được, Vua không có ô chạy. Chiếu hết.',
    ],
    avoid: [
      'Đầu ván đừng đẩy Tốt f và g; ra Tốt trung tâm, Mã và Tượng trước.',
      'Đen cũng có thể dính kiểu tương tự: 1.e4 g5 2.d4 f6?? 3.Qh5#.',
    ],
    mate: true,
    qa: [['Ván cờ vua ngắn nhất là mấy nước?', 'Hai nước: 1.f3 e5 2.g4 Qh4#. Gọi là chiếu hết 2 nước (Fool\'s Mate).']],
  },
  {
    slug: 'bay-legal',
    name: 'Bẫy Legal',
    en: "Légal's Mate",
    by: 'Trắng',
    moves: ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'],
    blunder: 9,
    lead: 'Trắng thí Hậu rồi chiếu hết bằng ba quân nhẹ. Bẫy có từ thế kỷ 18 nhưng vẫn hay gặp ở các ván nhanh.',
    how: [
      'Tượng g4 ghim Mã f3 vào Hậu d1. Nhưng ghim này không tuyệt đối: sau Mã là Hậu, không phải Vua, nên Mã vẫn đi được.',
      '5.Nxe5! bỏ Hậu cho Đen ăn.',
      'Đen ham Hậu, ăn 5...Bxd1?? Trắng chiếu 6.Bxf7+, Vua chỉ còn e7, rồi 7.Nd5#.',
    ],
    avoid: [
      'Sau 5.Nxe5, đừng ăn Hậu: 5...dxe5 6.Qxg4. Đen mất một Tốt nhưng vẫn chơi được.',
      'Tổng quát: thấy đối phương bỏ Hậu dễ quá thì dừng lại, tìm xem họ được gì.',
    ],
    mate: true,
    opening: ['Khai cuộc Ý', '/khai-cuoc/khai-cuoc-y/'],
  },
  {
    slug: 'bay-blackburne-shilling',
    name: 'Bẫy Blackburne Shilling',
    en: 'Blackburne Shilling Gambit',
    by: 'Đen',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#'],
    blunder: 8,
    lead: 'Đen cố ý để Tốt e5 cho Trắng ăn. Trắng ham quân, ăn tiếp f7 doạ bắt đôi Hậu Xe, và bị chiếu hết.',
    how: [
      '3...Nd4 trông như nước hỏng vì bỏ Tốt e5.',
      '4.Nxe5? Qg5! Hậu Đen đánh cùng lúc Mã e5 và Tốt g2.',
      '5.Nxf7?? Qxg2 6.Rf1 Qxe4+ 7.Be2 Nf3#: Tượng e2 bị Hậu ghim nên không ăn được Mã.',
    ],
    avoid: [
      'Đừng ăn Tốt e5. Đi 4.Nxd4 exd4 5.O-O hoặc 4.c3 đuổi Mã: Mã d4 trông đẹp nhưng không doạ gì.',
      'Thấy đối phương bỏ Tốt trung tâm ở khai cuộc, kiểm tra xem họ được gì trước khi ăn.',
    ],
    mate: true,
    opening: ['Khai cuộc Ý', '/khai-cuoc/khai-cuoc-y/'],
  },
  {
    slug: 'bay-con-voi',
    name: 'Bẫy con voi',
    en: 'Elephant Trap',
    by: 'Đen',
    moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Nbd7', 'cxd5', 'exd5', 'Nxd5', 'Nxd5', 'Bxd8', 'Bb4+', 'Qd2', 'Bxd2+', 'Kxd2', 'Kxd8'],
    blunder: 10,
    lead: 'Trắng tưởng Mã f6 bị ghim nên ăn Tốt d5. Nhưng Đen bỏ Hậu, chiếu một nước rồi lấy lại Hậu, cuối cùng hơn một Mã.',
    how: [
      'Tượng g5 ghim Mã f6 vào Hậu d8, Trắng nghĩ Mã f6 không dám đi.',
      '6.Nxd5?? Nxd5! Đen bỏ Hậu.',
      '7.Bxd8 Bb4+ 8.Qd2 Bxd2+ 9.Kxd2 Kxd8: hai bên đổi Hậu, Đen hơn một Mã, Trắng chỉ được một Tốt.',
    ],
    avoid: [
      'Với Trắng: đừng ăn d5 khi Đen còn nước Bb4+. Cứ ra quân tiếp bằng 6.e3.',
      'Với Đen: bẫy này chỉ dùng được khi Tượng f8 còn đường ra b4.',
    ],
    mate: false,
    opening: ['Gambit Hậu', '/khai-cuoc/gambit-hau/'],
  },
  {
    slug: 'bay-englund',
    name: 'Bẫy Englund',
    en: 'Englund Gambit Trap',
    by: 'Đen',
    moves: ['d4', 'e5', 'dxe5', 'Nc6', 'Nf3', 'Qe7', 'Bf4', 'Qb4+', 'Bd2', 'Qxb2', 'Bc3', 'Bb4', 'Qd2', 'Bxc3', 'Qxc3', 'Qc1#'],
    blunder: 10,
    lead: 'Gambit Englund 1.d4 e5 là khai cuộc mạo hiểm của Đen, nhưng có một bẫy hay bắt được người mới: Hậu Đen chiếu hết ở c1.',
    how: [
      '4...Qb4+ chiếu, đánh luôn Tốt b2.',
      '5.Bd2 Qxb2 6.Bc3? trông như đuổi Hậu, thật ra là nước hỏng.',
      '6...Bb4! 7.Qd2 Bxc3 8.Qxc3 Qc1#: Tốt c2 chặn đường của Hậu Trắng, không ai chặn được ô d1.',
    ],
    avoid: [
      'Sau 5...Qxb2, đi 6.Nc3!: Trắng mất Tốt b nhưng ra quân rất nhanh, Đen phải cẩn thận.',
      'Đơn giản hơn: đi 4.Qd5 hoặc 4.Nc3 thay cho 4.Bf4, không cho Hậu Đen chiếu ở b4.',
    ],
    mate: true,
  },
];

function trapPage(t: Trap): string {
  const path = `/bay-khai-cuoc/${t.slug}/`;
  const { c } = play(t.moves);
  assert(c.isCheckmate() === t.mate, `${t.slug}: kết thúc ${t.mate ? 'phải' : 'không được'} là chiếu hết`);
  const trước = after(t.moves, t.blunder);
  const cuối = after(t.moves, t.moves.length);
  const nSai = Math.floor(t.blunder / 2) + 1;
  const bênSai = t.blunder % 2 === 0 ? 'Trắng' : 'Đen';
  const desc = `${t.name} (${t.en}): ${movesText(t.moves)}. ${t.lead}`;
  const khác = TRAPS.filter((x) => x !== t);
  const body = `
${crumb(['Bẫy khai cuộc', '/bay-khai-cuoc/'])}
<h1>${esc(t.name)}</h1>
<p class="meta">${esc(t.en)} · bẫy của ${t.by}</p>
<p class="moves">${esc(movesText(t.moves))}</p>
<p class="lead">${esc(t.lead)}</p>
${boards(
    fig(
      { fen: trước.fen, lastMove: trước.lastMove, check: trước.check, orientation: t.by === 'Trắng' ? 'w' : 'b', label: `Thế cờ trước nước sai của ${bênSai}` },
      `Trước nước ${nSai}${bênSai === 'Đen' ? '…' : '.'}${esc(t.moves[t.blunder])}: ${bênSai} sắp đi hỏng.`,
    ),
    // data-og: ảnh chia sẻ lấy bàn cờ này (thế kết thúc) thay vì bàn đầu tiên
    fig(
      { fen: cuối.fen, lastMove: cuối.lastMove, check: cuối.check, orientation: t.by === 'Trắng' ? 'w' : 'b', label: t.mate ? 'Thế chiếu hết' : 'Thế cờ cuối' },
      t.mate ? `Chiếu hết sau ${esc(t.moves.at(-1)!)}.` : 'Thế cờ cuối: Đen hơn một Mã.',
    ).replace('<figure>', '<figure data-og>'),
  )}
<h2>Diễn biến</h2>
<ol>${t.how.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
<h2>Cách tránh</h2>
<ul>${t.avoid.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
${t.opening ? `<p>Bẫy này nằm trong <a href="${t.opening[1]}">${esc(t.opening[0])}</a>.</p>` : ''}
<h2>Thử trên bàn cờ</h2>
<p>Đánh vài ván với máy cấp thấp và thử gài bẫy, hoặc giải bài tập chủ đề chiếu hết để quen mắt với các mẫu này.</p>
<p><a class="cta" href="/#/choi">Chơi với máy</a><a class="cta alt" href="/bai-tap-co-vua/chieu-het-2-nuoc/">Bài tập chiếu hết</a></p>
<h2>Bẫy khác</h2>
<ul class="list">${khác.map((x) => `<li><a href="/bay-khai-cuoc/${x.slug}/"><b>${esc(x.name)}</b><span>bẫy của ${x.by}</span></a></li>`).join('')}</ul>`;
  return page({
    title: `${t.name} (${t.en}) — bẫy khai cuộc cờ vua · Lật Cờ`,
    desc,
    path,
    body,
    withSprite: true,
    event: 'guide_page',
    ld: [
      articleLd({ title: `${t.name} (${t.en})`, desc, path }),
      ...(t.qa ? [faqLd(t.qa)] : []),
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Bẫy khai cuộc', '/bay-khai-cuoc/'],
        [t.name, path],
      ]),
    ],
  });
}

function trapsIndex(): string {
  const path = '/bay-khai-cuoc/';
  const desc =
    'Các bẫy khai cuộc cờ vua hay gặp: chiếu hết 4 nước, chiếu hết 2 nước, bẫy Legal, Blackburne Shilling, bẫy con voi, bẫy Englund — có sơ đồ, diễn biến và cách tránh.';
  const body = `
${crumb()}
<h1>Bẫy khai cuộc</h1>
<p class="lead">Những cái bẫy người mới hay dính nhất trong mười nước đầu. Biết bẫy để không bị lừa, và để nhận ra khi đối thủ đi hỏng.</p>
<ul class="list">${TRAPS.map((t) => `<li><a href="/bay-khai-cuoc/${t.slug}/" title="${esc(t.en)}"><b>${esc(t.name)}</b><span>${esc(movesText(t.moves.slice(0, 4)))}…</span></a></li>`).join('')}</ul>
<h2>Một nguyên tắc chung</h2>
<p>Hầu hết bẫy khai cuộc nhắm vào ô f7 (hoặc f2) và vào người ham ăn quân. Trước khi ăn một quân đối phương bỏ không, hỏi: họ được gì nếu mình ăn?</p>
<p><a class="cta" href="/#/choi">Chơi một ván</a><a class="cta alt" href="/khai-cuoc/">Khai cuộc phổ biến</a></p>`;
  return page({
    title: 'Bẫy khai cuộc cờ vua — chiếu hết 4 nước, bẫy Legal và các bẫy hay gặp · Lật Cờ',
    desc,
    path,
    body,
    event: 'guide_page',
    ld: [
      {
        '@type': 'ItemList',
        name: 'Bẫy khai cuộc cờ vua',
        itemListElement: TRAPS.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `https://latbai.vn/bay-khai-cuoc/${t.slug}/` })),
      },
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Bẫy khai cuộc', path],
      ]),
    ],
  });
}

// ---------------------------------------------------------------- tàn cuộc cơ bản

interface Endgame {
  slug: string;
  name: string;
  short: string;
  lead: string;
  /** Trang bài tập cùng dạng (public/bai-tap-co-vua/<…>/). */
  practice: 'chieu-het-2-nuoc' | 'tan-cuoc-tot' | 'tan-cuoc-xe';
  body: () => string;
}

const TÊN_BÀI = { 'chieu-het-2-nuoc': 'chiếu hết 2 nước', 'tan-cuoc-tot': 'tàn cuộc Tốt', 'tan-cuoc-xe': 'tàn cuộc Xe' } as const;

const ENDGAMES: Endgame[] = [
  {
    slug: 'hau-chieu-het',
    practice: 'chieu-het-2-nuoc',
    name: 'Chiếu hết bằng Hậu',
    short: 'Vua + Hậu đấu Vua',
    lead: 'Tàn cuộc đầu tiên cần thuộc. Hậu dồn Vua đối phương ra mép bàn, Vua mình tới giúp, xong trong tối đa 10 nước.',
    body: () => {
      const hộp = '8/8/2Q5/4k3/8/8/8/K7 b - - 0 1';
      const thoát = new Chess(hộp).moves({ square: 'e5', verbose: true }).map((m) => m.to as Square);
      const hết = '7k/6Q1/5K2/8/8/8/8/8 b - - 0 1';
      assert(new Chess(hết).isCheckmate(), 'hau: thế hết sai');
      const pat = '7k/5Q2/5K2/8/8/8/8/8 b - - 0 1';
      assert(new Chess(pat).isStalemate(), 'hau: thế hết nước sai');
      return `
<h2>Bước 1: nhốt Vua trong hộp</h2>
<p>Đặt Hậu cách Vua đối phương đúng một bước Mã. Từ đó Hậu chặn một hàng và một cột: Vua bị nhốt trong một hình chữ nhật. Mỗi lần Vua đối phương đi, Hậu đi theo, giữ đúng khoảng cách đó, hình chữ nhật nhỏ dần.</p>
${fig({ fen: hộp, legal: thoát, label: 'Hậu c6 cách Vua e5 một bước Mã' }, 'Hậu c6 cách Vua e5 một bước Mã. Chấm tròn là các ô Vua Đen còn đi được: nó đã bị nhốt dưới hàng 6 và bên phải cột c.')}
<h2>Bước 2: dừng lại đúng lúc</h2>
<p>Khi Vua đối phương chỉ còn đi qua lại hai ô ở mép bàn, ngừng thu hẹp. Đi thêm một nước Hậu nữa là Vua hết chỗ đi mà không bị chiếu: <b>hết nước đi, ván hòa</b>.</p>
${fig({ fen: pat, label: 'Hết nước đi: Vua h8 không bị chiếu nhưng không còn ô nào' }, 'Sai lầm kinh điển: Hậu f7, Đen tới lượt. Vua h8 không bị chiếu mà không đi được ô nào. Hòa.')}
<h2>Bước 3: đưa Vua tới, chiếu hết</h2>
<p>Trong lúc Vua đối phương đi qua lại, đưa Vua mình tới gần. Hậu một mình không chiếu hết được; cần Vua giữ Hậu hoặc khoá ô thoát.</p>
${fig({ fen: hết, check: 'h8', lastMove: ['g5', 'g7'], label: 'Chiếu hết: Hậu g7 được Vua f6 bảo vệ' }, 'Chiếu hết: Hậu g7 chiếu, Vua f6 bảo vệ Hậu. Vua h8 không ăn được, không chạy được.')}`;
    },
  },
  {
    slug: 'xe-chieu-het',
    practice: 'chieu-het-2-nuoc',
    name: 'Chiếu hết bằng Xe',
    short: 'Vua + Xe đấu Vua',
    lead: 'Xe chặn một hàng, hai Vua đối mặt, Xe chiếu đẩy Vua lùi từng hàng một. Lâu hơn chiếu hết bằng Hậu, nhưng cùng một ý.',
    body: () => {
      const đối = '8/8/4k3/7R/4K3/8/8/8 w - - 0 1';
      const c = new Chess(đối);
      assert(Boolean(c.move('Rh6+')), 'xe: Rh6+');
      const hết = 'R3k3/8/4K3/8/8/8/8/8 b - - 0 1';
      assert(new Chess(hết).isCheckmate(), 'xe: thế hết sai');
      return `
<h2>Xe cắt hàng, Vua đối mặt</h2>
<p>Xe đứng ở một hàng để Vua đối phương không đi qua được. Đưa Vua mình lên đứng đối diện Vua đối phương, cách đúng một ô (cùng cột, hàng trên dưới).</p>
${fig({ fen: đối, arrows: [{ from: 'h5', to: 'h6' }] as Arrow[], label: 'Hai Vua đối mặt, Xe sắp chiếu ở h6' }, 'Hai Vua đối mặt ở e4 và e6, Xe h5 chặn hàng 5. Trắng đi Rh6+: Vua Đen phải lùi về hàng 7.')}
<h2>Lặp lại tới mép bàn</h2>
<p>Mỗi lần hai Vua đối mặt và tới lượt bạn, Xe chiếu dọc hàng: Vua đối phương lùi một hàng. Nếu Vua đối phương không chịu đối mặt mà né sang bên, đi một nước Xe chờ ở xa (dọc cột), giữ nguyên hàng chặn, để nó buộc phải quay lại.</p>
<p>Để Xe xa Vua đối phương: Xe đứng sát Vua thì bị ăn.</p>
${fig({ fen: hết, check: 'e8', lastMove: ['a1', 'a8'], label: 'Chiếu hết: Xe a8, Vua e6 khoá hàng 7' }, 'Chiếu hết: Xe a8 chiếu cả hàng 8, Vua e6 khoá d7, e7, f7.')}`;
    },
  },
  {
    slug: 'hai-xe-chieu-het',
    practice: 'chieu-het-2-nuoc',
    name: 'Chiếu hết bằng hai Xe',
    short: 'Kiểu bậc thang',
    lead: 'Hai Xe (hoặc Hậu và Xe) thay nhau chiếu như đi cầu thang: một Xe chặn hàng, Xe kia chiếu đẩy Vua lùi. Không cần Vua mình giúp.',
    body: () => {
      const đầu = '8/8/5k2/R7/8/8/8/KR6 w - - 0 1';
      const line = ['Rb6+', 'Ke7', 'Ra7+', 'Kd8', 'Rb8#'];
      const { c, hist } = play(line, đầu);
      assert(c.isCheckmate(), 'hai xe: không chiếu hết');
      const last = hist.at(-1)!;
      return `
<h2>Bậc thang</h2>
<p>Xe a5 chặn hàng 5, Vua Đen ở hàng 6. Xe kia chiếu ở hàng 6: Vua phải lên hàng 7. Xe thứ nhất chiếu ở hàng 7, cứ thế tới hàng 8.</p>
${fig({ fen: đầu, arrows: [{ from: 'b1', to: 'b6' }] as Arrow[], label: 'Xe a5 chặn, Xe b1 chiếu ở b6' }, 'Trắng đi 1.Rb6+: Xe a5 vẫn chặn hàng 5, Vua Đen phải lên hàng 7.')}
<h2>Vua đối phương tới gần Xe</h2>
<p>Nếu Vua đối phương đứng sát một Xe, đưa Xe đó ra xa ở đầu bên kia cùng hàng, rồi tiếp tục chiếu.</p>
<p class="moves">${esc(movesText(line))}</p>
<p>Ở đây Vua Đen chạy về phía hai Xe nhưng chưa đứng sát Xe nào, nên Trắng chiếu hết luôn ở nước thứ ba.</p>
${fig({ fen: c.fen(), check: kingSquare(c), lastMove: [last.from as Square, last.to as Square], label: 'Chiếu hết bằng hai Xe' }, 'Chiếu hết: Xe b8 chiếu hàng 8, Xe h7 khoá hàng 7.')}`;
    },
  },
  {
    slug: 'quy-tac-hinh-vuong',
    practice: 'tan-cuoc-tot',
    name: 'Quy tắc hình vuông',
    short: 'Vua có đuổi kịp Tốt?',
    lead: 'Cách tính nhẩm trong một giây xem Vua có đuổi kịp Tốt thông hay không, không cần đếm từng nước.',
    body: () => {
      const fen = '8/8/8/6k1/1P6/8/8/7K w - - 0 1';
      const trắngĐi = play(['b5', 'Kf6', 'b6', 'Ke7', 'b7', 'Kd7', 'b8=Q'], fen);
      assert(trắngĐi.c.get('b8')?.type === 'q', 'vuong: tốt không phong');
      const đenĐi = play(['Kf5', 'b5', 'Ke6', 'b6', 'Kd7', 'b7', 'Kc7', 'b8=Q+', 'Kxb8'], fen.replace(' w ', ' b '));
      assert(đenĐi.c.get('b8')?.type === 'k', 'vuong: vua không ăn được tốt');
      return `
<h2>Cách vẽ hình vuông</h2>
<p>Lấy đoạn từ ô Tốt đang đứng tới ô phong cấp làm một cạnh, vẽ hình vuông về phía Vua đối phương. Tốt chưa đi lần nào thì tính như đã ở hàng 3 (vì nước đầu đi được 2 ô).</p>
<ul>
  <li>Vua đối phương <b>đứng trong</b> hình vuông, hoặc bước vào được ngay ở lượt của mình: đuổi kịp, ăn được Tốt.</li>
  <li>Vua <b>ở ngoài</b> và không bước vào kịp: Tốt phong cấp.</li>
</ul>
<figure><div class="board-wrap">${outline(boardSvg({ fen, label: 'Hình vuông của Tốt b4: từ b4 tới f8' }), 'b4', 'f8')}</div><figcaption>Khung xanh là hình vuông của Tốt b4: b4–f4–f8–b8. Vua Đen g5 đứng ngay ngoài.</figcaption></figure>
<h2>Ai tới lượt quyết định tất cả</h2>
<p><b>Trắng đi:</b> Tốt lên b5, hình vuông thu lại thành b5–e8. Vua g5 không vào kịp: <span class="moves">${esc(movesText(['b5', 'Kf6', 'b6', 'Ke7', 'b7', 'Kd7', 'b8=Q']))}</span>, Tốt phong Hậu.</p>
<p><b>Đen đi:</b> Vua bước vào f5, đã ở trong hình vuông: <span class="moves">${esc(movesText(['Kf5', 'b5', 'Ke6', 'b6', 'Kd7', 'b7', 'Kc7', 'b8=Q+', 'Kxb8'], 1, true))}</span>, Vua ăn được Tốt.</p>
<p>Quy tắc chỉ tính Vua và Tốt. Nếu quân khác chặn đường Vua, hoặc Vua bên kia che đường, phải đếm từng nước.</p>`;
    },
  },
  {
    slug: 'doi-vua',
    practice: 'tan-cuoc-tot',
    name: 'Đối Vua',
    short: 'Vua + Tốt đấu Vua',
    lead: 'Hai Vua đứng đối diện cách nhau một ô: bên không phải đi là bên "giữ đối Vua". Trong tàn cuộc Tốt, giữ được đối Vua thường là thắng hay hòa.',
    body: () => {
      const fen = '8/8/4k3/8/4K3/4P3/8/8 b - - 0 1';
      // Đen đi: phải nhường đường, Vua Trắng vào ô then chốt
      for (const [đen, trắng] of [
        ['Kd6', 'Kf5'],
        ['Kf6', 'Kd5'],
        ['Ke7', 'Ke5'],
      ]) assert(play([đen, trắng], fen).hist.length === 2, `doi vua: ${đen}`);
      const hàng6 = '3k4/8/3K4/3P4/8/8/8/8 b - - 0 1';
      play(['Ke8', 'Kc7'], hàng6);
      const trắng = play(['Ke6', 'Ke8', 'd6', 'Kd8', 'd7', 'Kc7', 'Ke7', 'Kc6', 'd8=Q'], hàng6.replace(' b ', ' w '));
      assert(trắng.c.get('d8')?.type === 'q', 'doi vua: không phong cấp');
      return `
<h2>Đối Vua là gì</h2>
<p>Hai Vua đứng cùng cột (hoặc cùng hàng), cách nhau đúng một ô. Vua không được đứng sát Vua, nên bên phải đi buộc phải lùi hoặc né sang bên, nhường đường cho Vua kia.</p>
${fig({ fen, arrows: [{ from: 'e4', to: 'f5' }] as Arrow[], label: 'Vua e4 và Vua e6 đối mặt, Đen tới lượt' }, 'Đen tới lượt nên Trắng giữ đối Vua. Vua Đen đi đâu, Vua Trắng cũng tiến vào được hàng 5 trước Tốt (ví dụ 1…Kd6 2.Kf5).')}
<h2>Vì sao quan trọng</h2>
<p>Vua + Tốt đấu Vua: bên có Tốt thắng nếu đưa được Vua lên <b>trước Tốt</b>, cách hai hàng. Bên kia hòa nếu chặn được trước Tốt và giữ đối Vua.</p>
<ul>
  <li>Ở thế trên, nếu <b>Đen</b> tới lượt: Trắng thắng.</li>
  <li>Nếu <b>Trắng</b> tới lượt: Đen giữ đối Vua, ván hòa nếu Đen chơi đúng (Vua Đen luôn lùi thẳng về trước Tốt).</li>
</ul>
<h2>Quy tắc dễ nhớ</h2>
<p>Vua của bên có Tốt (không phải Tốt cột a, h) đứng ở hàng thứ sáu, ngay trước Tốt: thắng, dù ai tới lượt.</p>
${fig({ fen: hàng6, label: 'Vua d6 trước Tốt d5, Vua Đen d8' }, 'Vua Trắng d6 đứng trước Tốt ở hàng sáu. Đen đi: 1…Ke8 2.Kc7 rồi Tốt lên. Trắng đi: 1.Ke6 Ke8 2.d6 Kd8 3.d7 Kc7 4.Ke7. Đằng nào Trắng cũng phong cấp.')}`;
    },
  },
  {
    slug: 'the-lucena',
    practice: 'tan-cuoc-xe',
    name: 'Thế Lucena',
    short: 'Tàn cuộc Xe: cách thắng',
    lead: 'Thế thắng quan trọng nhất của tàn cuộc Xe. Tốt đã ở hàng bảy, Vua mình bị kẹt trước Tốt: cần "xây cầu" bằng Xe để Vua ra ngoài mà không bị chiếu mãi.',
    body: () => {
      const fen = '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1';
      const line = ['Rd1+', 'Ke7', 'Rd4', 'Ra1', 'Kc7', 'Rc1+', 'Kb6', 'Rb1+', 'Kc6', 'Rc1+', 'Kb5', 'Rb1+', 'Rb4'];
      const { c, hist } = play(line, fen);
      const last = hist.at(-1)!;
      return `
<h2>Thế cờ</h2>
<p>Vua Trắng ở b8 bị chính Tốt b7 kẹt lại. Xe Đen a2 không cho Vua ra cột a, Vua Đen ở gần. Xe Trắng c1 cắt Vua Đen khỏi cột c.</p>
${fig({ fen, label: 'Thế Lucena, Trắng đi' }, 'Thế Lucena, Trắng đi.')}
<h2>Xây cầu</h2>
<p class="moves">${esc(movesText(line))}</p>
<ol>
  <li><b>1.Rd1+</b> đẩy Vua Đen xa thêm một cột.</li>
  <li><b>2.Rd4!</b> đưa Xe lên hàng bốn: đây là "cây cầu".</li>
  <li>Vua Trắng ra khỏi b8, Đen chiếu dọc liên tục. Vua Trắng tiến dần xuống hàng năm.</li>
  <li><b>7.Rb4</b>: Xe chặn chiếu, Đen hết cách ngăn Tốt phong cấp.</li>
</ol>
${fig({ fen: c.fen(), lastMove: [last.from as Square, last.to as Square], label: 'Xe b4 chặn chiếu' }, 'Sau 7.Rb4: Xe chặn chiếu, Vua và Xe che cho Tốt b7 lên b8.')}
<p>Nhớ: Xe lên hàng bốn (tính từ bên mình) để làm cầu. Xe ở hàng khác thì Vua Trắng không có chỗ trú.</p>`;
    },
  },
  {
    slug: 'the-philidor',
    practice: 'tan-cuoc-xe',
    name: 'Thế Philidor',
    short: 'Tàn cuộc Xe: cách hòa',
    lead: 'Cách hòa chuẩn khi kém một Tốt trong tàn cuộc Xe: Xe chặn ở hàng thứ ba, đợi Tốt lên rồi chiếu từ phía sau.',
    body: () => {
      const fen = '4k3/R7/1r6/4PK2/8/8/8/8 b - - 0 1';
      const { c, hist } = play(['Rc6', 'e6', 'Rc1', 'Kf6', 'Rf1+'], fen);
      const last = hist.at(-1)!;
      assert(c.inCheck(), 'philidor: chưa chiếu');
      return `
<h2>Bước 1: Xe ở hàng thứ ba</h2>
<p>Vua Đen đứng trước Tốt. Xe Đen đứng ở hàng 6 (hàng thứ ba tính từ phía Đen), không cho Vua Trắng lên hàng 6. Đen chỉ cần đi qua lại trên hàng này.</p>
${fig({ fen, label: 'Thế Philidor, Xe Đen ở hàng 6' }, 'Xe b6 chặn hàng 6. Vua Trắng không lên được nếu Tốt chưa lên.')}
<h2>Bước 2: Tốt lên thì chiếu từ phía sau</h2>
<p>Khi Tốt lên hàng 6, Vua Trắng mất chỗ trú phía trước. Xe Đen về ngay hàng 1 và chiếu liên tục từ phía sau: Vua Trắng không trốn được, ván hòa.</p>
<p class="moves">${esc(movesText(['Rc6', 'e6', 'Rc1', 'Kf6', 'Rf1+'], 1, true))}</p>
${fig({ fen: c.fen(), lastMove: [last.from as Square, last.to as Square], check: kingSquare(c), label: 'Xe Đen chiếu từ phía sau' }, 'Xe f1 chiếu từ xa. Vua Trắng tới gần Xe thì Xe đổi hướng chiếu tiếp.')}
<p>Sai lầm hay gặp: để Xe thụ động ở hàng cuối ngay từ đầu. Khi đó Vua Trắng lên hàng 6 và thắng.</p>`;
    },
  },
];

function endgamePage(e: Endgame): string {
  const path = `/tan-cuoc/${e.slug}/`;
  const desc = `${e.name} trong cờ vua (${e.short.toLowerCase()}): ${e.lead}`;
  const khác = ENDGAMES.filter((x) => x !== e);
  const body = `
${crumb(['Tàn cuộc cơ bản', '/tan-cuoc/'])}
<h1>${esc(e.name)}</h1>
<p class="meta">${esc(e.short)}</p>
<p class="lead">${esc(e.lead)}</p>
${e.body()}
<h2>Luyện</h2>
<p>Giải bài tập cùng dạng theo độ khó: mỗi bài là một thế cờ thật, sai được chỉ lại.</p>
<p><a class="cta" href="/bai-tap-co-vua/${e.practice}/">Bài tập ${esc(TÊN_BÀI[e.practice])}</a><a class="cta alt" href="/#/choi">Chơi với máy</a></p>
<h2>Tàn cuộc khác</h2>
<ul class="list">${khác.map((x) => `<li><a href="/tan-cuoc/${x.slug}/"><b>${esc(x.name)}</b><span>${esc(x.short)}</span></a></li>`).join('')}</ul>`;
  return page({
    title: `${e.name} — tàn cuộc cờ vua cơ bản · Lật Cờ`,
    desc,
    path,
    body,
    withSprite: true,
    event: 'guide_page',
    ld: [
      articleLd({ title: e.name, desc, path }),
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Tàn cuộc cơ bản', '/tan-cuoc/'],
        [e.name, path],
      ]),
    ],
  });
}

function endgamesIndex(): string {
  const path = '/tan-cuoc/';
  const desc =
    'Tàn cuộc cờ vua cơ bản cho người mới: chiếu hết bằng Hậu, bằng Xe, bằng hai Xe, quy tắc hình vuông, đối Vua, thế Lucena và thế Philidor — có sơ đồ và nước đi.';
  const body = `
${crumb()}
<h1>Tàn cuộc cơ bản</h1>
<p class="lead">Bảy thế tàn cuộc ai chơi cờ cũng cần biết. Thuộc chúng thì ít khi để hòa một ván đã thắng.</p>
<ul class="list">${ENDGAMES.map((e) => `<li><a href="/tan-cuoc/${e.slug}/"><b>${esc(e.name)}</b><span>${esc(e.short)}</span></a></li>`).join('')}</ul>
<h2>Nên học theo thứ tự nào</h2>
<p>Hậu chiếu hết trước, rồi Xe chiếu hết, rồi hai thế Tốt (hình vuông, đối Vua). Lucena và Philidor để sau, khi bạn đã hay gặp tàn cuộc Xe trong ván thật.</p>
<p><a class="cta" href="/bai-tap-co-vua/tan-cuoc-xe/">Bài tập tàn cuộc</a><a class="cta alt" href="/hoc/">Bài học chiến thuật</a></p>`;
  return page({
    title: 'Tàn cuộc cờ vua cơ bản — chiếu hết bằng Hậu, Xe, đối Vua, Lucena · Lật Cờ',
    desc,
    path,
    body,
    event: 'guide_page',
    ld: [
      {
        '@type': 'ItemList',
        name: 'Tàn cuộc cờ vua cơ bản',
        itemListElement: ENDGAMES.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.name, url: `https://latbai.vn/tan-cuoc/${e.slug}/` })),
      },
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Tàn cuộc cơ bản', path],
      ]),
    ],
  });
}

// ---------------------------------------------------------------- ghi file

write('public/choi-co-vua-voi-may', botPage());
write('public/choi-co-vua-online', onlinePage());
write('public/meo-choi-co-vua', tipsPage());
write('public/bay-khai-cuoc', trapsIndex());
for (const t of TRAPS) write(`public/bay-khai-cuoc/${t.slug}`, trapPage(t));
write('public/tan-cuoc', endgamesIndex());
for (const e of ENDGAMES) write(`public/tan-cuoc/${e.slug}`, endgamePage(e));
