// Sinh các trang đọc cho người mới: luật cờ vua (latbai.vn/luat-co-vua/) và khai cuộc
// phổ biến (latbai.vn/khai-cuoc/ và latbai.vn/khai-cuoc/<ten>/).
// Chạy: npm run seo   (kèm sitemap). Không cần kho dữ liệu: chạy ở đâu cũng được.
//
// Đây là những thứ người mới hay tìm ("luật cờ vua", "nhập thành", "khai cuộc Ý",
// "phòng thủ Sicilia"...). Mỗi trang có sơ đồ bàn cờ vẽ sẵn bằng SVG, chữ thật cho
// Google đọc, và nút mở app để chơi luôn.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { boardSvg, type Arrow } from '../src/board/Board.ts';
import type { Square } from '../shared/fen.ts';
import { articleLd, breadcrumbLd, esc, faqLd, page } from './seo/page.ts';

// ---------------------------------------------------------------- sơ đồ

const FILES = 'abcdefgh';

/** Thế cờ chỉ có vài quân để minh hoạ: { e4: 'K', d5: 'p' } → FEN. */
function fenOf(pieces: Record<string, string>, turn: 'w' | 'b' = 'w'): string {
  const rows: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = '';
    let gap = 0;
    for (const f of FILES) {
      const p = pieces[`${f}${r}`];
      if (p) {
        if (gap) row += gap;
        gap = 0;
        row += p;
      } else gap++;
    }
    if (gap) row += gap;
    rows.push(row);
  }
  return `${rows.join('/')} ${turn} - - 0 1`;
}

/** Các ô một quân đi tới được trên bàn trống (để chấm chấm minh hoạ). */
function reach(piece: 'K' | 'Q' | 'R' | 'B' | 'N', from: string): Square[] {
  const f0 = FILES.indexOf(from[0]);
  const r0 = Number(from[1]);
  const on = (f: number, r: number) => f >= 0 && f < 8 && r >= 1 && r <= 8;
  const sq = (f: number, r: number) => `${FILES[f]}${r}` as Square;
  const out: Square[] = [];
  const rays = (dirs: number[][], far: boolean) => {
    for (const [df, dr] of dirs) {
      let f = f0 + df;
      let r = r0 + dr;
      while (on(f, r)) {
        out.push(sq(f, r));
        if (!far) break;
        f += df;
        r += dr;
      }
    }
  };
  const straight = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const diag = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  if (piece === 'R') rays(straight, true);
  if (piece === 'B') rays(diag, true);
  if (piece === 'Q') rays([...straight, ...diag], true);
  if (piece === 'K') rays([...straight, ...diag], false);
  if (piece === 'N') rays([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]], false);
  return out;
}

const board = (o: Parameters<typeof boardSvg>[0], caption?: string, cls = '') =>
  `<figure${cls ? ` class="${cls}"` : ''}><div class="board-wrap">${boardSvg(o)}</div>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;

// ---------------------------------------------------------------- luật cờ vua

function rulesPage(): string {
  const start = new Chess().fen();

  const quân: [string, 'K' | 'Q' | 'R' | 'B' | 'N', string, string][] = [
    ['Vua', 'K', 'e4', 'Đi 1 ô theo mọi hướng. Không được đi vào ô đang bị quân đối phương tấn công.'],
    ['Hậu', 'Q', 'd4', 'Đi bao nhiêu ô cũng được theo hàng ngang, cột dọc và đường chéo. Quân mạnh nhất.'],
    ['Xe', 'R', 'd4', 'Đi thẳng theo hàng ngang hoặc cột dọc, bao nhiêu ô cũng được.'],
    ['Tượng', 'B', 'd4', 'Đi chéo, bao nhiêu ô cũng được. Mỗi Tượng chỉ ở một màu ô suốt ván.'],
    ['Mã', 'N', 'd4', 'Đi hình chữ L: 2 ô theo một hướng rồi rẽ vuông góc 1 ô. Quân duy nhất nhảy qua được quân khác.'],
  ];
  const sơĐồQuân =
    quân
      .map(([tên, p, ô, cách]) =>
        board(
          { fen: fenOf({ [ô]: p }), legal: reach(p, ô), label: `${tên} ở ${ô} và các ô nó đi tới được` },
          `${tên}: ${cách.charAt(0).toLowerCase() + cách.slice(1)}`,
        ),
      )
      .join('') +
    board(
      {
        fen: fenOf({ e2: 'P', c4: 'P', d5: 'n' }),
        legal: ['e3', 'e4', 'c5'],
        legalCaptures: ['d5'],
        label: 'Tốt e2 đi được e3 hoặc e4; Tốt c4 đi c5 hoặc ăn Mã d5',
      },
      'Tốt: đi thẳng 1 ô (nước đầu tiên được đi 2 ô) nhưng ăn chéo 1 ô phía trước. Tốt không đi lùi.',
    );

  // Thế cờ minh hoạ, kiểm tra bằng chess.js để chắc không vẽ sai luật
  const hết = '4R1k1/5ppp/8/8/8/8/8/6K1 b - - 0 1';
  if (!new Chess(hết).isCheckmate()) throw new Error('sơ đồ chiếu hết sai');
  const pat = '7k/8/6Q1/8/8/8/8/K7 b - - 0 1';
  if (!new Chess(pat).isStalemate()) throw new Error('sơ đồ hết nước đi sai');

  const qa: [string, string][] = [
    ['Trong cờ vua bên nào đi trước?', 'Bên cầm quân Trắng luôn đi trước, sau đó hai bên đi luân phiên, mỗi lượt một nước.'],
    [
      'Khi nào được nhập thành?',
      'Khi Vua và Xe đó chưa đi lần nào, giữa hai quân không còn quân nào, Vua không đang bị chiếu và không đi qua hoặc dừng ở ô bị quân đối phương tấn công.',
    ],
    [
      'Hết nước đi mà không bị chiếu thì thắng hay hòa?',
      'Hòa. Đến lượt mà không còn nước hợp lệ nào trong khi Vua không bị chiếu gọi là hết nước đi (stalemate), ván cờ kết thúc hòa.',
    ],
    ['Tốt đi tới hàng cuối thì sao?', 'Tốt phải phong cấp thành Hậu, Xe, Tượng hoặc Mã cùng màu, thường là Hậu. Có thể có hai Hậu trên bàn.'],
    [
      'Bắt tốt qua đường là gì?',
      'Khi Tốt đối phương đi 2 ô từ chỗ xuất phát và dừng ngay cạnh Tốt của bạn, bạn được ăn nó như thể nó chỉ đi 1 ô, nhưng chỉ ngay ở nước kế tiếp.',
    ],
  ];

  const desc =
    'Luật cờ vua đầy đủ cho người mới: cách xếp quân, cách đi của Vua, Hậu, Xe, Tượng, Mã, Tốt, nhập thành, bắt tốt qua đường, phong cấp, chiếu hết và các trường hợp hòa — có sơ đồ minh hoạ.';

  const body = `
<p class="crumb"><a href="/">Lật Cờ</a></p>
<h1>Luật cờ vua cho người mới</h1>
<p class="lead">Cờ vua có hai bên Trắng và Đen, mỗi bên 16 quân trên bàn 8×8 ô. Mục tiêu là <b>chiếu hết</b> Vua đối phương: Vua bị tấn công mà không còn cách nào thoát. Đọc hết trang này là đủ luật để chơi ván đầu tiên.</p>
<ol class="toc">
  <li><a href="#xep-quan">Bàn cờ và cách xếp quân</a></li>
  <li><a href="#cach-di">Cách đi của từng quân</a></li>
  <li><a href="#dac-biet">Ba nước đi đặc biệt</a></li>
  <li><a href="#chieu-het">Chiếu, chiếu hết và hết nước đi</a></li>
  <li><a href="#hoa">Khi nào ván hòa</a></li>
  <li><a href="#ky-hieu">Đọc ký hiệu nước đi</a></li>
</ol>

<h2 id="xep-quan">Bàn cờ và cách xếp quân</h2>
<p>Đặt bàn sao cho ô ở góc dưới bên phải mỗi người là ô trắng. Hàng gần mình: Xe ở hai góc, cạnh đó là Mã, rồi Tượng. Hậu đứng ô cùng màu với mình (Hậu Trắng ở d1 ô trắng, Hậu Đen ở d8 ô đen), Vua đứng ô còn lại. Hàng thứ hai là 8 Tốt.</p>
<p>Trắng luôn đi trước, sau đó hai bên đi luân phiên, mỗi lượt một nước. Không được bỏ lượt.</p>
<div class="board-wrap">${boardSvg({ fen: start, label: 'Thế cờ lúc bắt đầu ván' })}</div>
<p class="caption">Thế cờ lúc bắt đầu ván.</p>

<h2 id="cach-di">Cách đi của từng quân</h2>
<p>Chấm tròn là các ô quân đó đi tới được. Mọi quân trừ Mã đều không đi xuyên qua quân khác. Ăn quân là đi vào ô quân đối phương đang đứng; quân bị ăn bỏ ra khỏi bàn.</p>
<div class="boards">${sơĐồQuân}</div>

<h3>Giá trị các quân</h3>
<p>Không phải luật, nhưng ai cũng dùng để tính có nên đổi quân không:</p>
<table>
  <tr><th>Quân</th><th>Tốt</th><th>Mã</th><th>Tượng</th><th>Xe</th><th>Hậu</th></tr>
  <tr><td>Giá trị</td><td>1</td><td>3</td><td>3</td><td>5</td><td>9</td></tr>
</table>
<p>Vua không có giá: mất Vua là thua ván.</p>

<h2 id="dac-biet">Ba nước đi đặc biệt</h2>
<h3>Nhập thành</h3>
<p>Vua đi 2 ô về phía một Xe, Xe nhảy qua đứng ngay cạnh Vua ở phía bên kia. Đây là nước duy nhất đi hai quân cùng lúc. Chỉ được nhập thành khi:</p>
<ul>
  <li>Vua và Xe đó chưa đi lần nào trong ván;</li>
  <li>giữa Vua và Xe không còn quân nào;</li>
  <li>Vua không đang bị chiếu, không đi qua và không dừng ở ô bị quân đối phương tấn công.</li>
</ul>
<div class="boards">${
    board(
      {
        fen: fenOf({ e1: 'K', h1: 'R', a1: 'R', f2: 'P', g2: 'P', h2: 'P', a2: 'P', b2: 'P', c2: 'P' }),
        arrows: [
          { from: 'e1', to: 'g1' },
          { from: 'h1', to: 'f1' },
        ] as Arrow[],
        label: 'Nhập thành gần: Vua e1 sang g1, Xe h1 sang f1',
      },
      'Nhập thành gần (ghi là O-O): Vua e1→g1, Xe h1→f1.',
    ) +
    board(
      {
        fen: fenOf({ g1: 'K', f1: 'R', a1: 'R', f2: 'P', g2: 'P', h2: 'P', a2: 'P', b2: 'P', c2: 'P' }),
        lastMove: ['e1', 'g1'],
        label: 'Sau khi nhập thành gần',
      },
      'Sau khi nhập thành: Vua ở góc an toàn, Xe ra giữa.',
    )
  }</div>

<h3>Bắt tốt qua đường</h3>
<p>Khi Tốt đối phương đi 2 ô từ chỗ xuất phát và dừng ngay cạnh Tốt của bạn, bạn được ăn nó như thể nó chỉ đi 1 ô. Quyền này chỉ có ở ngay nước kế tiếp; để lỡ là mất.</p>
<div class="boards">${board(
    {
      fen: fenOf({ e5: 'P', d5: 'p' }),
      lastMove: ['d7', 'd5'],
      arrows: [{ from: 'e5', to: 'd6' }] as Arrow[],
      label: 'Đen vừa đi d7 lên d5, Trắng ăn qua đường e5 sang d6',
    },
    'Đen vừa đi d7–d5. Trắng ăn exd6: Tốt e5 sang d6, Tốt d5 bị bỏ khỏi bàn.',
  )}</div>

<h3>Phong cấp</h3>
<p>Tốt đi tới hàng cuối cùng thì phải đổi ngay thành Hậu, Xe, Tượng hoặc Mã cùng màu. Gần như ai cũng chọn Hậu; trên bàn có thể có hai Hậu một bên.</p>
<div class="boards">${board(
    { fen: fenOf({ e7: 'P' }), arrows: [{ from: 'e7', to: 'e8' }] as Arrow[], label: 'Tốt e7 đi lên e8 và phong cấp' },
    'Tốt e7 lên e8 thành Hậu (ghi là e8=Q).',
  )}</div>

<h2 id="chieu-het">Chiếu, chiếu hết và hết nước đi</h2>
<p><b>Chiếu</b> là khi Vua đang bị một quân đối phương tấn công. Bên bị chiếu phải thoát ngay ở nước sau, bằng một trong ba cách: đi Vua sang ô an toàn, đặt quân chặn giữa, hoặc ăn quân đang chiếu. Không được đi nước nào để Vua mình bị chiếu.</p>
<p><b>Chiếu hết</b> là bị chiếu mà không còn cách nào thoát. Bên bị chiếu hết thua ván.</p>
<p><b>Hết nước đi</b> là đến lượt mà không có nước hợp lệ nào, trong khi Vua không bị chiếu. Ván cờ kết thúc hòa. Người mới hay dư cả Hậu mà vẫn để hòa vì quên chừa đường cho Vua đối phương.</p>
<div class="boards">${
    board(
      { fen: hết, check: 'g8', lastMove: ['e1', 'e8'], label: 'Chiếu hết: Xe e8 chiếu Vua g8, ba Tốt chặn đường thoát' },
      'Chiếu hết. Xe e8 chiếu, Vua g8 bị chính ba Tốt của mình chặn đường thoát.',
    ) +
    board(
      { fen: pat, label: 'Hết nước đi: Vua Đen h8 không bị chiếu nhưng không đi được ô nào' },
      'Hết nước đi, hòa. Đen tới lượt, Vua h8 không bị chiếu nhưng ô nào cũng bị Hậu g6 khống chế.',
    )
  }</div>

<h2 id="hoa">Khi nào ván hòa</h2>
<ul>
  <li><b>Hết nước đi</b>, như ở trên.</li>
  <li><b>Lặp lại ba lần</b>: cùng một thế cờ xuất hiện lần thứ ba, cùng bên tới lượt.</li>
  <li><b>Luật 50 nước</b>: mỗi bên đi 50 nước liên tiếp mà không có ăn quân và không đi Tốt.</li>
  <li><b>Không đủ quân chiếu hết</b>: ví dụ Vua đấu Vua, hay Vua với một Tượng hoặc một Mã đấu Vua.</li>
  <li><b>Hai bên đồng ý hòa.</b></li>
</ul>
<p>Chơi có đồng hồ thì hết giờ là thua, trừ khi đối thủ không còn đủ quân để chiếu hết: khi đó ván hòa.</p>

<h2 id="ky-hieu">Đọc ký hiệu nước đi</h2>
<p>Sách cờ và các trang cờ đều ghi nước đi bằng chữ cái tiếng Anh của quân cộng với ô đến:</p>
<table>
  <tr><th>Chữ</th><th>Quân</th></tr>
  <tr><td>K</td><td>Vua</td></tr>
  <tr><td>Q</td><td>Hậu</td></tr>
  <tr><td>R</td><td>Xe</td></tr>
  <tr><td>B</td><td>Tượng</td></tr>
  <tr><td>N</td><td>Mã</td></tr>
  <tr><td>(không có chữ)</td><td>Tốt</td></tr>
</table>
<p>Ví dụ <b>Nf3</b> là Mã đi tới f3, <b>e4</b> là Tốt đi tới e4, <b>Bxc6</b> là Tượng ăn quân ở c6. Thêm <b>+</b> là chiếu, <b>#</b> là chiếu hết, <b>O-O</b> và <b>O-O-O</b> là nhập thành gần và xa.</p>

<h2>Chơi thử ngay</h2>
<p>Cách nhanh nhất để nhớ luật là chơi. Máy cấp 1 trên Lật Cờ đi rất hiền và hay để hở quân; app chỉ cho bạn đi nước hợp lệ nên không sợ đi sai luật.</p>
<p><a class="cta" href="/#/choi">Chơi với máy</a><a class="cta alt" href="/hoc/">Học chiến thuật</a></p>`;

  return page({
    title: 'Luật cờ vua cho người mới — cách đi các quân, nhập thành, chiếu hết · Lật Cờ',
    desc,
    path: '/luat-co-vua/',
    body,
    withSprite: true,
    event: 'guide_page',
    ld: [
      articleLd({ title: 'Luật cờ vua cho người mới', desc, path: '/luat-co-vua/' }),
      faqLd(qa),
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Luật cờ vua', '/luat-co-vua/'],
      ]),
    ],
  });
}

// ---------------------------------------------------------------- khai cuộc

interface Opening {
  slug: string;
  /** Tên tiếng Việt. */
  vi: string;
  /** Tên quốc tế hay dùng. */
  en: string;
  moves: string[];
  group: 'e4e5' | 'e4' | 'd4' | 'other';
  lead: string;
  ideas: string[];
  forWho: string;
}

const OPENINGS: Opening[] = [
  {
    slug: 'khai-cuoc-y',
    vi: 'Khai cuộc Ý',
    en: 'Italian Game',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    group: 'e4e5',
    lead: 'Trắng ra Mã rồi đưa Tượng tới c4, nhắm thẳng vào ô f7 — điểm yếu nhất của Đen đầu ván vì chỉ có Vua bảo vệ.',
    ideas: [
      'Ra Mã, Tượng thật nhanh rồi nhập thành.',
      'Thường đi tiếp c3 rồi d4 để dựng trung tâm Tốt.',
      'Hai nhánh chính: Đen đáp 3...Bc5 (Giuoco Piano) hoặc 3...Nf6 (Phòng thủ Hai Mã).',
    ],
    forWho: 'Người mới: quân ra tự nhiên, ý tưởng dễ hiểu, ít bẫy khó lường.',
  },
  {
    slug: 'khai-cuoc-tay-ban-nha',
    vi: 'Khai cuộc Tây Ban Nha',
    en: 'Ruy Lopez',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    group: 'e4e5',
    lead: 'Tượng Trắng tấn công Mã c6, quân đang giữ Tốt e5. Một trong những khai cuộc lâu đời và được nghiên cứu nhiều nhất.',
    ideas: [
      'Gây sức ép lâu dài lên Tốt e5 chứ không thắng quân ngay.',
      'Đen hay đáp 3...a6 đuổi Tượng; Trắng lui 4.Ba4 vẫn giữ sức ép lên Mã c6.',
      'Ăn Mã c6 rồi ăn Tốt e5 ngay thường không lời, vì Đen có Hậu d4 đánh lại.',
    ],
    forWho: 'Người thích thế trận dài hơi, sẵn sàng học nhiều biến.',
  },
  {
    slug: 'khai-cuoc-scotland',
    vi: 'Khai cuộc Scotland',
    en: 'Scotch Game',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'],
    group: 'e4e5',
    lead: 'Trắng phá trung tâm ngay ở nước thứ ba bằng d4. Sau 3...exd4 4.Nxd4, Mã Trắng đứng đẹp giữa bàn.',
    ideas: [
      'Mở thế cờ sớm, quân hai bên ra nhanh.',
      'Ít lý thuyết hơn Khai cuộc Tây Ban Nha.',
      'Đen thường đáp 4...Nf6 (đánh Tốt e4) hoặc 4...Bc5 (đánh Mã d4).',
    ],
    forWho: 'Người thích thế cờ mở, muốn tránh các biến dài của Tây Ban Nha.',
  },
  {
    slug: 'phong-thu-hai-ma',
    vi: 'Phòng thủ Hai Mã',
    en: 'Two Knights Defense',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
    group: 'e4e5',
    lead: 'Đáp Khai cuộc Ý bằng Mã thứ hai: Đen phản công Tốt e4 thay vì ra Tượng.',
    ideas: [
      'Trắng hay đáp 4.Ng5 tấn công f7 lần thứ hai.',
      'Nước đáp chuẩn là 4...d5 5.exd5 Na5, chấp nhận mất Tốt để đổi lấy tốc độ ra quân.',
      'Ăn lại 5...Nxd5 dễ dính đòn Nxf7 (đòn Fried Liver nổi tiếng).',
    ],
    forWho: 'Người chơi Đen thích phản công, không ngại thế cờ sắc.',
  },
  {
    slug: 'phong-thu-petrov',
    vi: 'Phòng thủ Petrov',
    en: "Petrov's Defense",
    moves: ['e4', 'e5', 'Nf3', 'Nf6'],
    group: 'e4e5',
    lead: 'Đen không giữ Tốt e5 mà phản công ngay Tốt e4. Thế cờ đối xứng, rất vững.',
    ideas: [
      'Sau 3.Nxe5, Đen nên đi 3...d6 đuổi Mã trước rồi mới ăn lại e4.',
      'Ăn ngay 3...Nxe4 dễ dính bẫy 4.Qe2: nếu Mã lui 4...Nf6?? thì 5.Nc6+ chiếu mở và bắt mất Hậu Đen.',
      'Hay dẫn tới thế cân bằng, ít điểm yếu.',
    ],
    forWho: 'Người chơi Đen muốn chắc chắn, chấp nhận ván cờ ít biến động.',
  },
  {
    slug: 'gambit-vua',
    vi: 'Gambit Vua',
    en: "King's Gambit",
    moves: ['e4', 'e5', 'f4'],
    group: 'e4e5',
    lead: 'Trắng thí Tốt f để kéo Tốt e5 ra khỏi trung tâm và mở cột f cho Xe. Khai cuộc tấn công kinh điển của thế kỷ 19.',
    ideas: [
      'Nếu Đen ăn 2...exf4, Trắng được trung tâm và đường tấn công vào f7.',
      'Đổi lại Vua Trắng hở, một sai sót nhỏ có thể bị chiếu sớm.',
      'Đen có thể từ chối bằng 2...Bc5 hoặc phản thí 2...d5 (Phản gambit Falkbeer).',
    ],
    forWho: 'Người thích tấn công, chấp nhận rủi ro.',
  },
  {
    slug: 'khai-cuoc-vienna',
    vi: 'Khai cuộc Vienna',
    en: 'Vienna Game',
    moves: ['e4', 'e5', 'Nc3'],
    group: 'e4e5',
    lead: 'Trắng ra Mã c3 thay vì f3, để Tốt f còn đẩy lên f4 được — giống Gambit Vua nhưng chuẩn bị kỹ hơn.',
    ideas: [
      'Mã c3 giữ ô d5 và yểm hộ Tốt e4.',
      'Hay đi tiếp Bc4 hoặc f4 tuỳ cách Đen đáp.',
      'Linh hoạt, ít bị đối thủ dắt vào lý thuyết sâu.',
    ],
    forWho: 'Người muốn tấn công cánh Vua mà vẫn giữ thế cờ chắc.',
  },
  {
    slug: 'phong-thu-sicilia',
    vi: 'Phòng thủ Sicilia',
    en: 'Sicilian Defense',
    moves: ['e4', 'c5'],
    group: 'e4',
    lead: 'Đen đáp 1.e4 bằng Tốt c, đánh vào ô d4 từ cánh. Khai cuộc phổ biến nhất để đáp 1.e4 ở trình độ cao.',
    ideas: [
      'Thế cờ không cân xứng: Đen thường được thêm Tốt trung tâm, Trắng được tốc độ tấn công.',
      'Trắng hay đi 2.Nf3 rồi 3.d4 mở thế cờ (Sicilia mở).',
      'Có nhiều hệ thống với lý thuyết rất dày: Najdorf, Dragon, Sveshnikov…',
    ],
    forWho: 'Người cầm Đen muốn đánh để thắng, chịu được thế cờ phức tạp.',
  },
  {
    slug: 'phong-thu-phap',
    vi: 'Phòng thủ Pháp',
    en: 'French Defense',
    moves: ['e4', 'e6', 'd4', 'd5'],
    group: 'e4',
    lead: 'Đen dựng chuỗi Tốt e6–d5 thật chắc rồi phản công trung tâm Trắng bằng ...c5 và ...f6.',
    ideas: [
      'Trắng thường chọn 3.Nc3, 3.Nd2 hoặc đẩy luôn 3.e5.',
      'Điểm yếu quen thuộc: Tượng c8 của Đen bị chính Tốt e6 chặn đường.',
      'Thế cờ đóng, hai bên hay tấn công ở hai cánh khác nhau.',
    ],
    forWho: 'Người thích phòng thủ chắc rồi phản công.',
  },
  {
    slug: 'phong-thu-caro-kann',
    vi: 'Phòng thủ Caro-Kann',
    en: 'Caro-Kann Defense',
    moves: ['e4', 'c6', 'd4', 'd5'],
    group: 'e4',
    lead: 'Giống Phòng thủ Pháp ở chỗ Đen đánh d5, nhưng dùng Tốt c6 làm chỗ dựa nên Tượng c8 vẫn ra được.',
    ideas: [
      'Đen thường đưa Tượng ra f5 hoặc g4 trước khi đi e6.',
      'Cấu trúc Tốt vững, ít điểm yếu.',
      'Trắng có thể chọn biến đẩy 3.e5 hoặc 3.Nc3 dxe4 4.Nxe4.',
    ],
    forWho: 'Người cầm Đen muốn an toàn mà không bị bí quân.',
  },
  {
    slug: 'phong-thu-scandinavia',
    vi: 'Phòng thủ Scandinavia',
    en: 'Scandinavian Defense',
    moves: ['e4', 'd5'],
    group: 'e4',
    lead: 'Đen đánh vào Tốt e4 ngay ở nước đầu. Sau 2.exd5 Qxd5, Hậu Đen ra sớm.',
    ideas: [
      'Trắng đuổi Hậu bằng 3.Nc3 để được thêm một nhịp ra quân.',
      'Đen lui Hậu về a5, d6 hoặc d8 tuỳ cách chơi.',
      'Dễ học, Trắng khó tránh: ai đi 1.e4 cũng có thể gặp.',
    ],
    forWho: 'Người mới cầm Đen muốn một khai cuộc đơn giản, chơi được mãi.',
  },
  {
    slug: 'phong-thu-pirc',
    vi: 'Phòng thủ Pirc',
    en: 'Pirc Defense',
    moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'],
    group: 'e4',
    lead: 'Đen để Trắng dựng trung tâm Tốt e4–d4 rồi mới đánh phá, với Tượng g7 nhắm vào giữa bàn.',
    ideas: [
      'Đen nhập thành nhanh rồi đánh ...e5 hoặc ...c5.',
      'Trắng hay đẩy f4 (Tấn công Áo) để tấn công trước.',
      'Đòi hiểu thế cờ hơn là thuộc nước.',
    ],
    forWho: 'Người cầm Đen thích phản công, không ngại bị ép lúc đầu.',
  },
  {
    slug: 'phong-thu-alekhine',
    vi: 'Phòng thủ Alekhine',
    en: "Alekhine's Defense",
    moves: ['e4', 'Nf6'],
    group: 'e4',
    lead: 'Đen ra Mã tấn công Tốt e4, dụ Tốt Trắng tiến lên rồi phá chuỗi Tốt bị căng quá.',
    ideas: [
      'Sau 2.e5 Nd5, Trắng có thể đuổi Mã tiếp bằng c4 và d4.',
      'Đen đánh vào trung tâm bằng ...d6.',
      'Khai cuộc khiêu khích, đối thủ ít gặp nên dễ lúng túng.',
    ],
    forWho: 'Người thích lối chơi khác thường.',
  },
  {
    slug: 'gambit-hau',
    vi: 'Gambit Hậu',
    en: "Queen's Gambit",
    moves: ['d4', 'd5', 'c4'],
    group: 'd4',
    lead: 'Trắng mời Đen đổi Tốt c lấy Tốt d trung tâm. Gọi là gambit nhưng không thật sự thí: nếu Đen ăn, Trắng thường lấy lại dễ dàng.',
    ideas: [
      '2...dxc4 là Gambit Hậu chấp nhận; Trắng đi e3 rồi Bxc4 lấy lại Tốt.',
      '2...e6 là Gambit Hậu từ chối, cực kỳ vững.',
      '2...c6 là Phòng thủ Slav.',
    ],
    forWho: 'Người thích thế cờ chiến lược, ép dần.',
  },
  {
    slug: 'phong-thu-slav',
    vi: 'Phòng thủ Slav',
    en: 'Slav Defense',
    moves: ['d4', 'd5', 'c4', 'c6'],
    group: 'd4',
    lead: 'Đen giữ Tốt d5 bằng Tốt c6, nhờ vậy Tượng c8 vẫn ra được (khác Gambit Hậu từ chối).',
    ideas: [
      'Đen hay ra Tượng tới f5 hoặc g4.',
      'Đôi khi Đen ăn dxc4 rồi cố giữ Tốt bằng ...b5.',
      'Vững chắc, được dùng ở mọi trình độ.',
    ],
    forWho: 'Người cầm Đen gặp 1.d4 mà muốn an toàn.',
  },
  {
    slug: 'he-thong-london',
    vi: 'Hệ thống London',
    en: 'London System',
    moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'],
    group: 'd4',
    lead: 'Trắng dựng gần như cùng một thế bất kể Đen đi gì: d4, Bf4, e3, Nf3, c3, Bd3, Nbd2.',
    ideas: [
      'Tượng f4 ra trước khi đi e3 để không bị nhốt.',
      'Rất ít lý thuyết, dễ học.',
      'Đen hay đánh ...c5 và ...Qb6 sớm để gây khó cho Trắng.',
    ],
    forWho: 'Người chơi phong trào muốn có ngay một khai cuộc ổn định cho Trắng.',
  },
  {
    slug: 'phong-thu-an-do-cua-vua',
    vi: 'Phòng thủ Ấn Độ của Vua',
    en: "King's Indian Defense",
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6'],
    group: 'd4',
    lead: 'Đen nhường Trắng trung tâm Tốt lớn, nhập thành, rồi phá bằng ...e5 hoặc ...c5.',
    ideas: [
      'Tượng g7 là quân chủ lực, nhắm theo đường chéo dài.',
      'Thường dẫn tới thế hai bên tấn công ở hai cánh ngược nhau: Trắng cánh Hậu, Đen cánh Vua.',
      'Sắc và nhiều thế cờ phức tạp.',
    ],
    forWho: 'Người cầm Đen thích tấn công Vua đối phương.',
  },
  {
    slug: 'phong-thu-nimzo-an-do',
    vi: 'Phòng thủ Nimzo-Ấn Độ',
    en: 'Nimzo-Indian Defense',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
    group: 'd4',
    lead: 'Tượng Đen ghim Mã c3 để Trắng khó chiếm ô e4. Một trong những cách đáp 1.d4 được đánh giá cao nhất.',
    ideas: [
      'Đen sẵn sàng đổi Tượng lấy Mã để Trắng bị Tốt chồng ở cột c.',
      'Trắng hay đáp 4.Qc2, 4.e3 hoặc 4.a3.',
      'Thế cờ linh hoạt, giàu ý tưởng chiến lược.',
    ],
    forWho: 'Người thích chiến lược, cấu trúc Tốt.',
  },
  {
    slug: 'phong-thu-ha-lan',
    vi: 'Phòng thủ Hà Lan',
    en: 'Dutch Defense',
    moves: ['d4', 'f5'],
    group: 'd4',
    lead: 'Đen giữ ô e4 bằng Tốt f, chuẩn bị tấn công cánh Vua.',
    ideas: [
      'Ba hệ thống chính: Leningrad (...g6), Stonewall (...d5, ...e6, ...c6) và cổ điển.',
      'Đường chéo e8–h5 bị mở, phải cẩn thận với chiếu sớm.',
      'Đối thủ ít gặp nên hay ra thế cờ lạ.',
    ],
    forWho: 'Người cầm Đen muốn tránh các thế quen của 1.d4 d5.',
  },
  {
    slug: 'khai-cuoc-anh',
    vi: 'Khai cuộc Anh',
    en: 'English Opening',
    moves: ['c4'],
    group: 'other',
    lead: 'Trắng mở bằng Tốt c, kiểm soát ô d5 từ cánh thay vì chiếm trung tâm ngay.',
    ideas: [
      'Hay đi g3 và Bg2 để Tượng nhắm theo đường chéo dài.',
      'Dễ chuyển sang các thế của 1.d4 tuỳ cách Đen đáp.',
      'Nếu Đen đáp 1...e5, thế cờ giống Sicilia đổi màu với Trắng hơn một nhịp.',
    ],
    forWho: 'Người thích thế cờ linh hoạt, chơi theo hiểu biết hơn là thuộc nước.',
  },
];

const NHÓM: [Opening['group'], string, string][] = [
  ['e4e5', 'Trắng đi 1.e4, Đen đáp 1...e5', 'Thế cờ mở, quân ra nhanh — nơi hầu hết người mới bắt đầu.'],
  ['e4', 'Đen đáp 1.e4 bằng nước khác', 'Các phòng thủ để Đen tránh thế đối xứng.'],
  ['d4', 'Trắng đi 1.d4', 'Thế cờ chiến lược hơn, Tốt d được Hậu giữ sẵn.'],
  ['other', 'Khai cuộc cánh', 'Trắng không chiếm trung tâm bằng Tốt ngay.'],
];

/** Tên và mã ECO theo bảng khai cuộc của Lichess (public/data/openings.json, CC0). */
const ECO: Record<string, [string, string]> = JSON.parse(readFileSync('public/data/openings.json', 'utf8'));

/** "1.e4 e5 2.Nf3 Nc6 3.Bc4" */
const movesText = (ms: string[]) =>
  ms.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m}` : m)).join(' ');

function openingPage(o: Opening): string {
  const c = new Chess();
  for (const m of o.moves) c.move(m);
  const last = c.history({ verbose: true }).at(-1)!;
  const key = c.fen().split(' ').slice(0, 4).join(' ');
  const eco = ECO[key];
  const mt = movesText(o.moves);
  const liênQuan = OPENINGS.filter((x) => x.group === o.group && x !== o);
  const desc = `${o.vi} (${o.en}) ${mt}: ${o.lead} Ý tưởng chính, sơ đồ thế cờ và ai nên chơi.`;
  const body = `
<p class="crumb"><a href="/">Lật Cờ</a> · <a href="/khai-cuoc/">Khai cuộc</a></p>
<h1>${esc(o.vi)}</h1>
<p class="meta">${esc(o.en)}${eco ? ` · ECO ${eco[0]}` : ''}</p>
<p class="moves">${esc(mt)}</p>
<div class="board-wrap">${boardSvg({
    fen: c.fen(),
    lastMove: [last.from as Square, last.to as Square],
    label: `Thế cờ ${o.vi} sau ${mt}`,
  })}</div>
<p class="lead">${esc(o.lead)}</p>
<h2>Ý tưởng chính</h2>
<ul>${o.ideas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<p class="key"><b>Hợp với:</b> ${esc(o.forWho)}</p>
<h2>Chơi thử</h2>
<p>Đánh một ván với máy rồi xem lại: Lật Cờ đánh dấu những nước còn đúng sách khai cuộc và chỉ ra nước đầu tiên bạn rời khỏi đường quen thuộc.</p>
<p><a class="cta" href="/#/choi">Chơi một ván với máy</a><a class="cta alt" href="/cham-van-co-vua/">Chấm ván hoạt động thế nào</a></p>
${
  liênQuan.length
    ? `<h2>Khai cuộc cùng nhóm</h2><ul class="list">${liênQuan
        .map((x) => `<li><a href="/khai-cuoc/${x.slug}/"><b>${esc(x.vi)}</b><span>${esc(movesText(x.moves))}</span></a></li>`)
        .join('')}</ul>`
    : ''
}
<p>Chưa quen ký hiệu nước đi? Xem <a href="/luat-co-vua/#ky-hieu">cách đọc ký hiệu</a>.</p>`;
  return page({
    title: `${o.vi} (${o.en}) — khai cuộc cờ vua · Lật Cờ`,
    desc,
    path: `/khai-cuoc/${o.slug}/`,
    body,
    withSprite: true,
    event: 'guide_page',
    ld: [
      articleLd({ title: `${o.vi} (${o.en})`, desc, path: `/khai-cuoc/${o.slug}/` }),
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Khai cuộc', '/khai-cuoc/'],
        [o.vi, `/khai-cuoc/${o.slug}/`],
      ]),
    ],
  });
}

function openingsIndex(): string {
  const desc =
    'Các khai cuộc cờ vua phổ biến bằng tiếng Việt: Khai cuộc Ý, Tây Ban Nha, Phòng thủ Sicilia, Pháp, Caro-Kann, Gambit Hậu, Hệ thống London… kèm nước đi, sơ đồ và ý tưởng chính.';
  const body = `
<p class="crumb"><a href="/">Lật Cờ</a></p>
<h1>Khai cuộc cờ vua</h1>
<p class="lead">${OPENINGS.length} khai cuộc người chơi hay gặp nhất, mỗi cái kèm nước đi, sơ đồ và ý tưởng chính.</p>
<h2>Ba nguyên tắc khai cuộc cho người mới</h2>
<ol>
  <li><b>Chiếm trung tâm</b> bằng Tốt e và d; bốn ô giữa là nơi quân hoạt động mạnh nhất.</li>
  <li><b>Ra quân nhanh</b>: Mã và Tượng trước, chưa đưa Hậu ra sớm, không đi một quân hai lần khi chưa cần.</li>
  <li><b>Nhập thành sớm</b> để Vua an toàn và Xe ra được giữa bàn.</li>
</ol>
${NHÓM.map(
  ([g, tên, ghi]) => `<h2>${esc(tên)}</h2><p>${esc(ghi)}</p><ul class="list">${OPENINGS.filter((o) => o.group === g)
    .map((o) => `<li><a href="/khai-cuoc/${o.slug}/" title="${esc(o.en)}"><b>${esc(o.vi)}</b><span>${esc(movesText(o.moves))}</span></a></li>`)
    .join('')}</ul>`,
).join('\n')}
<p><a class="cta" href="/#/choi">Chơi một ván</a></p>`;
  return page({
    title: 'Khai cuộc cờ vua phổ biến — nước đi và ý tưởng · Lật Cờ',
    desc,
    path: '/khai-cuoc/',
    body,
    event: 'guide_page',
    ld: [
      {
        '@type': 'ItemList',
        name: 'Khai cuộc cờ vua',
        itemListElement: OPENINGS.map((o, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: o.vi,
          url: `https://latbai.vn/khai-cuoc/${o.slug}/`,
        })),
      },
      breadcrumbLd([
        ['Lật Cờ', '/'],
        ['Khai cuộc', '/khai-cuoc/'],
      ]),
    ],
  });
}

// ---------------------------------------------------------------- ghi file

const write = (dir: string, html: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, html);
  console.log(dir);
};

write('public/luat-co-vua', rulesPage());
write('public/khai-cuoc', openingsIndex());
for (const o of OPENINGS) {
  const c = new Chess();
  for (const m of o.moves) c.move(m); // ném lỗi ngay nếu chép sai nước
  write(`public/khai-cuoc/${o.slug}`, openingPage(o));
}
