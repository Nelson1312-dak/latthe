// Màn chơi: đấu với máy, hoặc hai người trên cùng một máy.
// Engine chạy trong Web Worker ở máy người chơi, nên giao diện không bị đứng
// trong lúc máy nghĩ.

import { BoardView, PIECE_SLIDE_MS } from '../../board/BoardView.ts';
import { endBadgesFor } from '../../board/Board.ts';
import { ownsSquare, premoveDests } from '../../../shared/premove.ts';
import { Game, outcomeText, type Outcome, type Side, type Square } from '../../../shared/chess.ts';
import { material } from '../../../shared/fen.ts';
import { formatScore, type Score } from '../../../shared/winrate.ts';
import { playSound } from '../../app/sound.ts';
import { engine } from '../../engine/engine.ts';
import { LEVELS, levelById, thinkDelayMs } from '../../engine/levels.ts';
import { splitUci } from '../../engine/uci.ts';
import { loadOpenings, openingAt } from '../../analysis/openings.ts';
import { saveFinishedGame } from '../../app/games.ts';
import { auth } from '../../app/session.ts';
import { prefs } from '../../app/prefs.ts';
import { openGate, shouldAskLogin } from '../../app/gate.ts';
import { icon, type IconName } from '../icons.ts';
import { offerReview, openReviewResult } from './review.ts';
import type { ReviewResult } from '../../analysis/review.ts';
import { saveReview } from '../../app/reviews.ts';
import type { MoveClass } from '../../../shared/winrate.ts';
import { BAD_MOVES, createReporter, reportCard as reportHtml } from '../report.ts';
import { buildFacts } from '../../../shared/advisor/facts.ts';
import { detectMotifs } from '../../../shared/advisor/motifs.ts';
import { hintSteps } from '../../../shared/advisor/templates.ts';
import {
  button,
  dialog,
  evalBar,
  iconButton,
  moveList,
  notice,
  pieceGlyph,
  playerStrip,
  sheet,
  toolbar,
} from '../components/index.ts';

type Mode = 'bot' | 'human';

/** Bên muốn cầm: Trắng, Đen, hay để máy bốc thăm. */
type Pick = Side | 'r';

interface Setup {
  mode: Mode;
  level: number;
  /** Bên người chơi đã chọn trong bảng (có thể là bốc thăm). */
  pick: Pick;
  /** Bên người chơi THẬT SỰ cầm trong ván này (đã bốc thăm xong). */
  side: Side;
}

/** Ván đang chơi; giữ ngoài hàm render để chuyển màn rồi quay lại vẫn còn. */
let game = new Game();
let setup: Setup = { mode: 'bot', level: 3, pick: 'w', side: 'w' };
/** Chưa bắt đầu thì hiện màn chọn cấp độ. */
let started = false;
let orientation: Side = 'w';
let view: BoardView | null = null;
let pendingPromotion: { from: Square; to: Square } | null = null;
let ended = false;
/** Máy đang nghĩ — khoá bàn cờ và hiện trạng thái. */
let thinking = false;
let engineError: string | null = null;
let showEval = false;
let currentEval: Score | null = null;
let saved = false;
/** Nước đã chạy animation rồi, để không trượt lại quân khi vẽ lại màn hình. */
let animatedPly = 0;
let animatedOrientation: Side = 'w';
/** Gợi ý ba nấc: 0 là chưa xin, 3 là đã xem nước cụ thể. */
let hintLevel: 0 | 1 | 2 | 3 = 0;
let hints: [string, string, string] | null = null;
let hintLoading = false;
/** Nước đã chọn đi trước trong lúc máy nghĩ; tới lượt mình thì đi luôn. */
let premove: [Square, Square] | null = null;
/** Đã xin kho khai cuộc chưa (chỉ xin một lần cho cả phiên). */
let openingsAsked = false;
/** Bên đã đầu hàng (null là chưa ai). Thế cờ không tự biết chuyện này. */
let resigned: Side | null = null;
/** Bấm "Đầu hàng" lần đầu chỉ hỏi lại; bấm lần nữa trong 3 giây mới tính. */
let resignArmed = false;
let resignTimer: ReturnType<typeof setTimeout> | null = null;
/** Vừa chép PGN xong: đổi chữ trên nút một lúc cho biết là đã chép. */
let copied = false;

/** Bảng chấm ván, hiện ngay khi hết ván (xem src/ui/report.ts). */
const reporter = createReporter();

/** Id của ván trên server (khi đã đăng nhập), để lưu luôn kết quả chấm. */
let savedGameId: number | null = null;
let reviewSaved = false;

/** Kết quả chấm còn khớp với ván đang hiện không. */
function reviewed(): ReviewResult | null {
  return reporter.resultFor(game.pgn());
}

/** Kết quả chấm đã lưu lên server chưa; lưu thì sinh thẻ ôn tập từ nước sai. */
function trySaveReview(): void {
  const r = reviewed();
  if (!r || !savedGameId || reviewSaved) return;
  reviewSaved = true;
  void saveReview(savedGameId, r);
}

function dropReport(): void {
  reporter.drop();
}

/** Chấm cả ván vừa xong, ngay tại chỗ. */
function startReport(rerender: () => void): void {
  reporter.start(game.pgn(), rerender, () => trySaveReview());
}

/** Kết quả ván: tính cả đầu hàng, thứ mà thế cờ không biết. */
function outcome(): Outcome | null {
  if (resigned) return { winner: resigned === 'w' ? 'b' : 'w', reason: 'resign' };
  return game.outcome();
}

const PROMOTION_PIECES = [
  ['q', 'Hậu'],
  ['r', 'Xe'],
  ['b', 'Tượng'],
  ['n', 'Mã'],
] as const;

const sideName = (s: Side) => (s === 'w' ? 'Trắng' : 'Đen');
const botSide = (): Side => (setup.side === 'w' ? 'b' : 'w');
const isBotTurn = () => setup.mode === 'bot' && game.turn === botSide() && !ended && game.atLive;

function newGame(): void {
  void engine().cancel();
  game = new Game();
  pendingPromotion = null;
  premove = null;
  ended = false;
  thinking = false;
  currentEval = null;
  saved = false;
  animatedPly = 0;
  hintLevel = 0;
  hints = null;
  resigned = null;
  resignArmed = false;
  copied = false;
  dropReport();
  savedGameId = null;
  reviewSaved = false;
  // Bốc thăm bên cầm quân ngay lúc vào ván, mỗi ván một lần
  setup.side = setup.pick === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : setup.pick;
  orientation = setup.mode === 'bot' ? setup.side : 'w';
  animatedOrientation = orientation;
}

/* ---------------- Phần chọn đối thủ, nằm ở cột phải ---------------- */

/**
 * Bảng chọn đối thủ, nằm ở cột phải cạnh bàn cờ — như chess.com.
 *
 * Bản trước bày tám thẻ cấp độ hai dòng chữ, một thanh chọn chế độ và một
 * thanh chọn bên, nhìn như một tờ khai. Giờ chỉ còn: ai là đối thủ (một thẻ
 * to), một hàng số 1–8, ba ô chọn bên, và một nút Chơi.
 */
function setupPanel(): string {
  if (setup.mode === 'human') {
    return `<div class="setup">
      <div class="bot-card">
        <span class="bot-face">${pieceGlyph('wn', 'bot-piece')}</span>
        <span class="bot-text"><b>Hai người một máy</b><span>Thay nhau đi trên cùng bàn cờ này</span></span>
      </div>
      ${button({ label: 'Chơi', kind: 'primary', icon: 'play', full: true })}
      <button class="link-btn" data-mode="bot">Đấu với máy</button>
    </div>`;
  }

  const l = levelById(setup.level);
  const levels = LEVELS.map(
    (x) =>
      `<button class="lv${x.id === setup.level ? ' is-active' : ''}" data-level="${x.id}" ` +
      `aria-pressed="${x.id === setup.level}" aria-label="${x.name}">${x.id}</button>`,
  ).join('');
  const sides = (
    [
      ['w', 'Trắng', pieceGlyph('wk', 'side-piece')],
      ['r', 'Ngẫu nhiên', icon('random', 26)],
      ['b', 'Đen', pieceGlyph('bk', 'side-piece')],
    ] as const
  )
    .map(
      ([id, name, glyph]) =>
        `<button class="side-opt${setup.pick === id ? ' is-active' : ''}" data-pick="${id}" aria-pressed="${setup.pick === id}">` +
        `${glyph}<span>${name}</span></button>`,
    )
    .join('');

  return `<div class="setup">
      <div class="bot-card">
        <span class="bot-face">${pieceGlyph('bn', 'bot-piece')}</span>
        <span class="bot-text"><b>Máy ${l.name.toLowerCase()}</b><span>${l.hint}</span></span>
      </div>
      <div class="setup-block">
        <p class="setup-label">Độ khó</p>
        <div class="lv-row" role="group" aria-label="Độ khó">${levels}</div>
      </div>
      <div class="setup-block">
        <p class="setup-label">Bạn cầm quân</p>
        <div class="side-row" role="group" aria-label="Bên cầm quân">${sides}</div>
      </div>
      ${button({ label: 'Chơi', kind: 'primary', icon: 'play', full: true })}
      <button class="link-btn" data-mode="human">Hai người một máy</button>
      ${engineError ? notice(engineError, 'danger', 'engine') : ''}
  </div>`;
}

/** Ba nút việc chính trong ván, mỗi nút có chữ — không bắt người chơi đoán icon. */
function actionRow(): string {
  const act = (
    id: string,
    name: IconName,
    label: string,
    opts: { disabled?: boolean; danger?: boolean; extra?: string } = {},
  ) =>
    `<button class="act${opts.danger ? ' is-danger' : ''}" data-act="${id}"${opts.disabled ? ' disabled' : ''}>` +
    `${icon(name, 22)}<span>${label}</span>${opts.extra ?? ''}</button>`;
  const dots =
    `<span class="hint-dots" aria-label="Đã dùng ${hintLevel} trên 3 nấc gợi ý">` +
    [0, 1, 2].map((i) => `<span class="hint-dot${i < hintLevel ? ' is-on' : ''}"></span>`).join('') +
    `</span>`;
  const hintLabel = hintLoading
    ? 'Đang xem…'
    : hintLevel === 0
      ? 'Gợi ý'
      : hintLevel === 3
        ? 'Hết gợi ý'
        : 'Gợi ý thêm';
  return `<div class="game-actions">
    ${
      setup.mode === 'bot'
        ? act('hint', 'hint', hintLabel, {
            disabled: hintLevel === 3 || hintLoading || !game.atLive,
            extra: dots,
          })
        : act('flip', 'flip', 'Lật bàn')
    }
    ${act('undo', 'undo', 'Đi lại', { disabled: game.length === 0 || thinking })}
    ${act('resign', 'resign', resignArmed ? 'Chắc chưa?' : 'Đầu hàng', { danger: resignArmed, disabled: game.length === 0 })}
  </div>`;
}

/** Các câu gợi ý đã mở, từ mơ hồ tới cụ thể. */
function hintList(): string {
  const shown = hints ? hints.slice(0, hintLevel) : [];
  return shown.length ? `<ol class="hint-list">${shown.map((h) => `<li>${h}</li>`).join('')}</ol>` : '';
}

/** Thẻ kết quả: thắng/thua to, lý do nhỏ, rồi các việc làm tiếp. */
function resultCard(result: Outcome): string {
  const mine = setup.mode === 'bot' && result.winner !== 'draw';
  const won = mine && result.winner === setup.side;
  const [who, why] = outcomeText(result).split(' · ');
  return `<div class="result-card${won ? ' is-win' : mine ? ' is-loss' : ''}">
    <b class="result-head">${!mine ? who : won ? 'Bạn thắng' : 'Bạn thua'}</b>
    <span class="result-why">${mine ? `${who} · ${why}` : why}</span>
    <div class="result-actions">
      ${
        // Có bảng chấm ván ngay bên dưới thì nút xem lại nằm ở đó, khỏi lặp
        reporter.current ? '' : button({ label: 'Xem lại ván', kind: 'primary', icon: 'review', full: true })
      }
      ${button({ label: 'Chơi lại', icon: 'play' })}
      ${button({ label: 'Ván mới', icon: 'settings' })}
    </div>
    <button class="link-btn" data-act="pgn">${icon('copy', 16)}<span>${copied ? 'Đã chép PGN' : 'Sao chép PGN'}</span></button>
  </div>`;
}

/* ---------------- Màn đang chơi ---------------- */

function gameScreen(extraSide = ''): string {
  const mat = material(game.fen);
  const result = outcome();
  const topSide: Side = orientation === 'w' ? 'b' : 'w';

  const strip = (side: Side, tools?: string) => {
    const isBot = setup.mode === 'bot' && side === botSide();
    return playerStrip({
      // Đấu với máy thì bên mình mang tên mình, không phải chữ "Trắng"
      name: isBot
        ? levelById(setup.level).name
        : setup.mode === 'bot' && side === setup.side && auth.user
          ? auth.user.name
          : sideName(side),
      side,
      avatar: !isBot && setup.mode === 'bot' && side === setup.side ? auth.user?.avatar : null,
      bot: isBot,
      you: setup.mode === 'bot' && side === setup.side,
      status: !started
        ? undefined
        : thinking && isBot
          ? 'đang nghĩ…'
          : !result && game.turn === side
            ? 'đang đi'
            : undefined,
      clockState: started && !result && game.turn === side ? 'running' : 'idle',
      took: side === 'w' ? mat.whiteTook : mat.blackTook,
      diff: side === 'w' ? mat.diff : -mat.diff,
      tools,
    });
  };

  return `<div class="screen">
    <div class="screen-head play-head">
      <h1>Chơi</h1>
      <span class="head-meta">${
        setup.mode === 'human'
          ? 'Hai người một máy'
          : started
            ? `Máy ${levelById(setup.level).name.toLowerCase()}`
            : 'Chơi với máy'
      }</span>
      ${toolbar([
        iconButton('flip', 'Lật bàn cờ'),
        ...(started ? [iconButton('engine', 'Thanh đánh giá', { pressed: showEval })] : []),
        iconButton('settings', 'Cài đặt'),
      ])}
    </div>

    <div class="game">
      <div class="game-board">
        ${strip(topSide)}
        <div class="board-row">
          ${showEval ? `<div class="evalbar-wrap only-desktop">${evalBar(currentEval ?? { cp: 0 })}</div>` : ''}
          <div id="board" class="board-host"></div>
        </div>
        ${strip(
          orientation,
          // Điện thoại và máy tính bảng không có dòng tiêu đề màn (xem .play-head):
          // nút Lật bàn chuyển xuống ngay cạnh tên mình, Cài đặt đã có trên thanh trên cùng.
          `<span class="only-narrow">${iconButton('flip', 'Lật bàn cờ')}</span>`,
        )}
      </div>

      <div class="game-side">
        ${
          !started
            ? sheet(setupPanel())
            : sheet(
                ...(result ? [resultCard(result), reportCard()] : []),
                khaiCuoc() || '<p class="opening-line">Thế cờ ban đầu</p>',
                game.length
                  ? moveList(
                      game.history.map((m, i) => ({ san: m.san, cls: reviewed()?.moves[i]?.cls })),
                      game.ply,
                    )
                  : '<p class="muted moves-empty">Chưa có nước nào. Kéo quân, hoặc bấm quân rồi bấm ô.</p>',
                hintList(),
                `<div class="move-bar">
                  ${iconButton('first', 'Về đầu ván', { disabled: game.ply === 0 })}
                  ${iconButton('prev', 'Lùi một nước', { disabled: game.ply === 0 })}
                  ${iconButton('next', 'Tiến một nước', { disabled: game.atLive })}
                  ${iconButton('last', 'Tới nước mới nhất', { disabled: game.atLive })}
                </div>`,
                result ? '' : actionRow(),
              )
        }
        ${showEval && currentEval ? `<p class="head-meta">Đánh giá: <span class="mono">${formatScore(currentEval)}</span> (góc nhìn Trắng)</p>` : ''}
        ${started && engineError ? notice(engineError, 'danger', 'engine') : ''}
        ${
          // Phần của Sảnh (việc hôm nay, sổ ván) chỉ hiện lúc chưa vào ván:
          // đang đánh mà cột phải còn đủ thứ linh tinh thì rối mắt.
          started ? '' : extraSide
        }
      </div>
    </div>

    ${
      pendingPromotion
        ? dialog(
            'Phong cấp thành quân gì?',
            `<div class="promo-row">${PROMOTION_PIECES.map(
              ([code, name]) =>
                `<button class="promo" data-promote="${code}" title="${name}">` +
                `${pieceGlyph(((game.turn === 'w' ? 'w' : 'b') + code) as never, 'promo-piece')}<span>${name}</span></button>`,
            ).join('')}</div>`,
            button({ label: 'Hủy', kind: 'text' }),
          )
        : ''
    }
  </div>`;
}

export function play(extraSide = ''): string {
  // Luôn vẽ bố cục có bàn cờ. Chưa bắt đầu thì bàn cờ là thế cờ đầu, không
  // bấm được, và cột phải là phần chọn đối thủ.
  //
  // `extraSide` để màn Sảnh gắn thêm phần của nó (việc hôm nay, sổ ván) xuống
  // dưới cột phải — Sảnh dùng chung đúng bàn cờ này, vào là đánh được ngay.
  return gameScreen(extraSide);
}

/* ---------------- Gắn bàn cờ sau khi HTML vào DOM ---------------- */

export function mountPlay(rerender: () => void): void {
  const host = document.querySelector<HTMLElement>('#board');
  if (!host) return;

  view = new BoardView(host, {
    id: 'play',
    legalFrom: (from) => (canPlay() ? game.legalFrom(from) : { quiet: [], captures: [] }),
    canPick: (sq) => {
      if (!canPlay()) return false;
      const l = game.legalFrom(sq);
      return l.quiet.length + l.captures.length > 0;
    },
    onMove: (from, to) => {
      if (!canPlay()) return false;
      // Bật "tự phong Hậu" thì khỏi hỏi — chín phần mười là phong Hậu
      const autoQ = game.needsPromotion(from, to) && prefs().autoQueen;
      if (game.needsPromotion(from, to) && !autoQ) {
        pendingPromotion = { from, to };
        rerender();
        return true;
      }
      if (!game.move(from, to, autoQ ? 'q' : undefined)) return false;
      hints = null;
      hintLevel = 0;
      afterMove(rerender);
      rerender();
      return true;
    },
    // Đi trước chỉ có khi đấu với máy: hai người một máy thì ai cũng đang cầm chuột
    premove:
      setup.mode === 'bot'
        ? {
            active: () => !ended && game.atLive && game.turn === botSide(),
            canPick: (sq) => ownsSquare(game.fen, sq, setup.side),
            dests: (from) => premoveDests(game.fen, from),
            set: (from, to) => {
              premove = [from, to];
            },
            clear: () => {
              premove = null;
            },
          }
        : undefined,
  });

  drawBoard();
  // Kho khai cuộc: nạp đúng MỘT lần rồi vẽ lại đúng một lần.
  // mountPlay chạy sau mỗi lần vẽ, nên gọi .then(rerender) vô điều kiện ở đây
  // là tự gọi lại mình mãi mãi — trang treo cứng.
  // Kho khai cuộc: xin đúng MỘT lần rồi vẽ lại đúng một lần.
  // mountPlay chạy sau mỗi lần vẽ, nên gọi .then(rerender) vô điều kiện ở đây
  // là tự gọi lại mình mãi mãi — trang treo cứng.
  if (!openingsAsked) {
    openingsAsked = true;
    void loadOpenings().then(rerender);
  }
  // Máy đi trước thì bắt đầu nghĩ ngay
  if (started && isBotTurn() && !thinking) void botMove(rerender);
}

/**
 * Tên khai cuộc của thế cờ đang xem.
 *
 * Người học nhìn thấy mình vừa đi vào khai cuộc nào ngay trong lúc đánh, chứ
 * không phải đợi tới lúc xem lại. Chưa nạp xong kho thì không hiện gì.
 */
function khaiCuoc(): string {
  if (!started || !game.ply) return '';
  // Dò ngược từ thế cờ hiện tại: khai cuộc sâu nhất còn khớp
  for (let ply = game.ply; ply > 0; ply--) {
    const o = openingAt(game.history[ply - 1].fen);
    if (o) return `<p class="opening-line"><span class="mono">${o.eco}</span> ${o.name}</p>`;
  }
  return '';
}

/** Người chơi có được phép đi lúc này không. */
function canPlay(): boolean {
  if (!started || !game.atLive || ended || thinking) return false;
  if (setup.mode === 'human') return true;
  return game.turn === setup.side;
}

function drawBoard(): void {
  // Chưa bắt đầu: bàn cờ lật theo bên vừa chọn, để thấy ngay mình ngồi phía nào
  if (!started) orientation = setup.mode === 'bot' ? setup.side : 'w';
  const checked = game.checkedKing;
  const res = outcome();
  const last = game.lastMove;
  // Chỉ trượt quân khi vừa tiến thêm đúng một nước và bàn không bị lật giữa
  // chừng — lật bàn thì mọi quân đều đổi chỗ, trượt sẽ thành loạn.
  const stepped = last && game.ply === animatedPly + 1 && orientation === animatedOrientation;
  animatedPly = game.ply;
  animatedOrientation = orientation;
  view?.render(
    {
      fen: game.fen,
      orientation,
      lastMove: last ? [last.from, last.to] : undefined,
      check: res && game.atLive ? undefined : (checked ?? undefined),
      premove: premove ?? undefined,
      // Hết ván và đang xem thế cờ cuối: huy hiệu trên hai ô Vua
      endBadges: res && game.atLive ? endBadgesFor(game.fen, res) : undefined,
      // Ván đã chấm: nước đang xem mang nhãn xếp loại (?!, ?, ??...), nước hỏng
      // thì có mũi tên chỉ nước tốt hơn
      ...markForPly(),
      label: `Bàn cờ, lượt ${sideName(game.turn)}`,
    },
    stepped ? [last.from, last.to] : undefined,
  );
}

function afterMove(rerender: () => void): void {
  const result = outcome();
  const last = game.lastMove!;
  if (result) {
    ended = true;
    playSound('end');
    void storeGame(rerender);
  } else if (game.inCheck) playSound('check');
  else playSound(last.captured ? 'capture' : 'move');

  if (!result && isBotTurn()) void botMove(rerender);
  else if (showEval) setTimeout(() => void refreshEval(rerender), PIECE_SLIDE_MS);
}

/**
 * Vẽ lại màn hình sau khi quân đã trượt xong.
 *
 * Mỗi lần vẽ lại là dựng lại cả bàn cờ, nên vẽ ngay sẽ cắt ngang animation của
 * nước vừa đi. Chờ hết thời gian trượt rồi mới vẽ.
 */
/**
 * Gợi ý ba nấc. Engine cho biết nước tốt nhất, bộ nhận diện mô-típ cho biết vì
 * sao; từ đó dựng ba câu đi từ mơ hồ tới cụ thể, để người học tự nghĩ trước.
 */
async function askHint(rerender: () => void): Promise<void> {
  if (hintLoading || ended || !game.atLive) return;
  if (hints) {
    hintLevel = Math.min(3, hintLevel + 1) as 0 | 1 | 2 | 3;
    rerender();
    return;
  }
  hintLoading = true;
  rerender();
  try {
    const fen = game.fen;
    const a = await engine().analyse(fen, { movetimeMs: 500, multipv: 2 });
    const bestUci = a.lines[0]?.uci;
    if (!bestUci) return;
    const probe = new Game(fen);
    const played = probe.move(bestUci.slice(0, 2) as Square, bestUci.slice(2, 4) as Square, bestUci[4]);
    const motifs = detectMotifs({
      fenBefore: fen,
      fenAfter: probe.fen,
      san: played?.san ?? '',
      side: game.turn,
      replyUci: a.lines[1]?.uci,
    });
    hints = hintSteps(
      buildFacts({
        side: game.turn,
        ply: game.ply + 1,
        // Để trống nước "đã đi": ở đây chưa đi gì cả, và buildFacts sẽ loại nước
        // trùng ra khỏi danh sách nước tốt hơn — mà đó đúng là nước cần gợi ý.
        san: '',
        cls: 'best',
        best: [{ san: played?.san ?? '', score: a.lines[0].score }],
        pv: [],
        motifs,
      }),
    );
    hintLevel = 1;
  } catch {
    hints = null;
  } finally {
    hintLoading = false;
    rerender();
  }
}

function rerenderAfterSlide(rerender: () => void): void {
  setTimeout(rerender, PIECE_SLIDE_MS);
}

/**
 * Tới lượt mình mà có nước đi trước thì đi luôn, không chờ.
 *
 * Gọi SAU khi nước của máy đã trượt xong, để hai quân không trượt cùng một lúc.
 * Lúc chọn đi trước chưa biết máy sẽ đi gì, nên giờ mới kiểm tra luật thật:
 * không hợp lệ (bị chắn, bị ghim, quân đã bị ăn) thì bỏ, như Lichess.
 */
function playPremove(rerender: () => void): void {
  if (!premove) return;
  const [from, to] = premove;
  premove = null;
  if (ended || !game.atLive || game.turn !== setup.side) return rerender();
  if (game.move(from, to)) {
    hints = null;
    hintLevel = 0;
    afterMove(rerender);
  }
  rerender();
}

/** Máy nghĩ rồi đi. Giao diện vẫn dùng được trong lúc này. */
async function botMove(rerender: () => void): Promise<void> {
  thinking = true;
  engineError = null;
  // Engine bắt đầu nghĩ ngay, nhưng để quân của người chơi trượt xong đã rồi
  // mới hiện "đang nghĩ".
  rerenderAfterSlide(rerender);
  const fenAtStart = game.fen;
  try {
    // Nghĩ và "ngẫm" cùng lúc: máy không bao giờ đáp trước khoảng dừng tối thiểu,
    // nhưng cấp cao nghĩ lâu hơn khoảng đó thì cũng không bị chậm thêm.
    const pause = new Promise((r) => setTimeout(r, thinkDelayMs(levelById(setup.level))));
    const [uci] = await Promise.all([engine().pickMove(fenAtStart, setup.level), pause]);
    // Người chơi có thể đã bấm ván mới / lùi nước trong lúc máy nghĩ
    if (game.fen !== fenAtStart || ended) return;
    if (!uci) return;
    const { from, to, promotion } = splitUci(uci);
    if (game.move(from as Square, to as Square, promotion)) {
      const result = game.outcome();
      const last = game.lastMove!;
      if (result) {
        ended = true;
        playSound('end');
        void storeGame(rerender);
      } else if (game.inCheck) playSound('check');
      else playSound(last.captured ? 'capture' : 'move');
    }
  } catch (err) {
    engineError = `Không chạy được engine: ${(err as Error).message}`;
  } finally {
    thinking = false;
    rerender();
    if (premove) setTimeout(() => playPremove(rerender), PIECE_SLIDE_MS);
    // Thanh đánh giá cập nhật sau, để không vẽ lại giữa lúc quân đang trượt
    else if (showEval) setTimeout(() => void refreshEval(rerender), PIECE_SLIDE_MS);
  }
}

async function refreshEval(rerender: () => void): Promise<void> {
  if (!showEval || thinking) return;
  try {
    const a = await engine().analyse(game.fen, { movetimeMs: 200 });
    currentEval = a.lines[0]?.score ?? null;
    rerender();
  } catch {
    /* thanh đánh giá hỏng thì cứ chơi tiếp */
  }
}

/** Lưu ván lên server khi kết thúc; không đăng nhập thì bỏ qua. */
async function storeGame(rerender: () => void): Promise<void> {
  if (saved) return;
  saved = true;
  const result = outcome();
  if (!result) return;
  const who = setup.mode === 'bot' ? levelById(setup.level).name : 'Hai người một máy';
  offerReview(game.pgn(), setup.mode === 'bot' ? setup.side : null, `${who} · ${outcomeText(result)}`);
  // Chấm ván ngay, song song với việc lưu
  startReport(rerender);
  savedGameId = await saveFinishedGame({
    mode: setup.mode,
    level: setup.mode === 'bot' ? setup.level : undefined,
    playerSide: setup.mode === 'bot' ? setup.side : 'w',
    pgn: game.pgn(),
    winner: result.winner,
    reason: result.reason,
  });
  trySaveReview();
}

/* ---------------- Nút bấm ---------------- */

export function handlePlayClick(target: HTMLElement, rerender: () => void): boolean {
  const level = target.closest<HTMLElement>('[data-level]');
  if (level) {
    setup.level = Number(level.dataset.level);
    rerender();
    return true;
  }
  const mode = target.closest<HTMLElement>('[data-mode]');
  if (mode) {
    setup.mode = mode.dataset.mode as Mode;
    rerender();
    return true;
  }
  const pick = target.closest<HTMLElement>('[data-pick]');
  if (pick) {
    setup.pick = pick.dataset.pick as Pick;
    if (setup.pick !== 'r') setup.side = setup.pick;
    rerender();
    return true;
  }

  // Bấm vào một nước trong sổ: xem lại thế cờ lúc đó
  const mv = target.closest<HTMLElement>('.move[data-ply]');
  if (mv && started) {
    game.goTo(Number(mv.dataset.ply));
    rerender();
    return true;
  }

  // Bảng chấm ván: ô nhịp ván, khoảnh khắc đáng xem -> bàn cờ nhảy tới nước đó
  const rp = target.closest<HTMLElement>('[data-report-ply]');
  if (rp) {
    game.goTo(Number(rp.dataset.reportPly));
    rerender();
    return true;
  }

  const act = target.closest<HTMLButtonElement>('[data-act]');
  if (act && !act.disabled) {
    runAct(act.dataset.act ?? '', rerender);
    return true;
  }

  const promo = target.closest<HTMLElement>('[data-promote]');
  if (promo && pendingPromotion) {
    const { from, to } = pendingPromotion;
    pendingPromotion = null;
    if (game.move(from, to, promo.dataset.promote)) afterMove(rerender);
    rerender();
    return true;
  }

  const btn = target.closest<HTMLButtonElement>('button');
  if (!btn) return false;
  const label = btn.getAttribute('title') ?? btn.textContent?.trim() ?? '';

  const actions: Record<string, () => void> = {
    Chơi: () => {
      const start = () => {
        newGame();
        started = true;
      };
      // Chưa đăng nhập: mời đăng nhập để ván này được lưu. Luôn có lối chơi luôn.
      if (shouldAskLogin()) {
        openGate({
          title: 'Đăng nhập để lưu ván',
          text: 'Mất vài giây với tài khoản Google. Hồ sơ của bạn được tạo tự động.',
          guest: 'Chơi luôn, không lưu',
          then: start,
        });
        return;
      }
      start();
    },
    // Ván xong, đánh lại ngay với đúng đối thủ đó
    'Chơi lại': () => {
      newGame();
      started = true;
    },
    'Lật bàn cờ': () => {
      // Chưa vào ván thì lật bàn nghĩa là đổi bên mình cầm, chứ không phải
      // xoay cho vui — vì lúc vẽ lại bàn cờ vẫn lật theo bên đã chọn.
      if (!started && setup.mode === 'bot') {
        setup.pick = setup.side === 'w' ? 'b' : 'w';
        setup.side = setup.pick;
      }
      else orientation = orientation === 'w' ? 'b' : 'w';
    },
    'Thanh đánh giá': () => {
      showEval = !showEval;
      if (showEval) void refreshEval(rerender);
      else currentEval = null;
    },
    'Ván mới': () => {
      newGame();
      started = false;
    },
    // Đã chấm xong thì mở luôn kết quả; chưa thì sang màn Xem lại để chấm
    'Xem lại ván': () => {
      if (!openFullReview()) location.hash = '#/xem-lai';
    },
    'Xem lại chi tiết': () => {
      if (!openFullReview()) location.hash = '#/xem-lai';
    },
    'Về đầu ván': () => game.first(),
    'Lùi một nước': () => game.prev(),
    'Tiến một nước': () => game.next(),
    'Tới nước mới nhất': () => game.last(),
    Hủy: () => {
      pendingPromotion = null;
    },
  };

  const run = actions[label];
  if (!run) return false;
  run();
  rerender();
  // Trên điện thoại nút Chơi nằm dưới bàn cờ: bấm xong thì cuộn lên cho thấy
  // cả bàn, không thì vào ván mà bàn cờ còn nằm khuất phía trên.
  if ((label === 'Chơi' || label === 'Chơi lại' || label === 'Ván mới') && window.scrollY > 0) {
    document.querySelector('.game-board')?.scrollIntoView({ block: 'start' });
  }
  return true;
}

/** Các nút việc trong ván (Gợi ý, Đi lại, Đầu hàng, Sao chép PGN). */
function runAct(id: string, rerender: () => void): void {
  if (id === 'hint') return void askHint(rerender);
  if (id === 'flip') {
    orientation = orientation === 'w' ? 'b' : 'w';
  } else if (id === 'undo') {
    // Đấu với máy thì lùi hai nước, để lượt vẫn thuộc về người chơi
    void engine().cancel();
    thinking = false;
    premove = null;
    resigned = null;
    dropReport();
    savedGameId = null;
    reviewSaved = false;
    game.last();
    game.undo();
    if (setup.mode === 'bot' && game.length && game.turn !== setup.side) game.undo();
    ended = false;
    saved = false;
    hints = null;
    hintLevel = 0;
  } else if (id === 'resign') {
    if (!resignArmed) {
      // Lần đầu chỉ hỏi lại: bấm nhầm một cái mà thua luôn thì rất ức
      resignArmed = true;
      if (resignTimer) clearTimeout(resignTimer);
      resignTimer = setTimeout(() => {
        resignArmed = false;
        rerender();
      }, 3000);
    } else {
      resignArmed = false;
      if (resignTimer) clearTimeout(resignTimer);
      void engine().cancel();
      thinking = false;
      premove = null;
      resigned = setup.mode === 'bot' ? setup.side : game.turn;
      ended = true;
      game.last();
      playSound('end');
      void storeGame(rerender);
    }
  } else if (id === 'pgn') {
    void navigator.clipboard?.writeText(game.pgn()).then(() => {
      copied = true;
      rerender();
      setTimeout(() => {
        copied = false;
        rerender();
      }, 2000);
    });
    return;
  }
  rerender();
}

/** Cấp máy gợi ý sau màn chào mừng (theo trình độ người chơi tự chọn). */
export function setBotLevel(level: number): void {
  if (level >= 1 && level <= 8) setup = { ...setup, mode: 'bot', level };
}

/** Nhãn xếp loại và mũi tên nước tốt hơn cho nước đang xem, khi ván đã chấm. */
function markForPly(): { badge?: { square: Square; cls: MoveClass }; arrows?: { from: Square; to: Square; kind: 'coach' }[] } {
  const r = reviewed();
  if (!r || game.ply === 0) return {};
  const m = r.moves[game.ply - 1];
  if (!m) return {};
  const bad = BAD_MOVES.includes(m.cls);
  const best = m.best[0];
  return {
    badge: { square: m.uci.slice(2, 4) as Square, cls: m.cls },
    arrows:
      bad && best && best.uci !== m.uci
        ? [{ from: best.uci.slice(0, 2) as Square, to: best.uci.slice(2, 4) as Square, kind: 'coach' }]
        : undefined,
  };
}

/** Bảng chấm ván của tab Chơi. */
function reportCard(): string {
  const cur = reporter.current;
  if (!cur || cur.pgn !== game.pgn()) return '';
  return reportHtml(cur, {
    me: setup.mode === 'bot' ? setup.side : null,
    opponent: `Máy ${levelById(setup.level).name.toLowerCase()}`,
    currentPly: game.ply,
  });
}

/** Mở màn Xem lại với kết quả vừa chấm, không chấm lại. */
function openFullReview(): boolean {
  const r = reviewed();
  const res = outcome();
  if (!r || !res) return false;
  const who = setup.mode === 'bot' ? `Máy ${levelById(setup.level).name.toLowerCase()}` : 'Hai người một máy';
  openReviewResult({
    pgn: game.pgn(),
    playerSide: setup.mode === 'bot' ? setup.side : null,
    label: `${who} · ${outcomeText(res)}`,
    opponent: setup.mode === 'bot' ? `Máy ${levelById(setup.level).name.toLowerCase()}` : null,
    gameId: savedGameId,
    result: r,
    ply: game.ply && game.ply < r.moves.length ? game.ply : undefined,
  });
  location.hash = '#/xem-lai';
  return true;
}
