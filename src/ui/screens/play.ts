// Màn chơi: đấu với máy, hoặc hai người trên cùng một máy.
// Engine chạy trong Web Worker ở máy người chơi, nên giao diện không bị đứng
// trong lúc máy nghĩ.

import { BoardView, PIECE_SLIDE_MS } from '../../board/BoardView.ts';
import { ownsSquare, premoveDests } from '../../../shared/premove.ts';
import { Game, outcomeText, type Side, type Square } from '../../../shared/chess.ts';
import { material } from '../../../shared/fen.ts';
import { formatScore, type Score } from '../../../shared/winrate.ts';
import { playSound, soundEnabled } from '../../app/sound.ts';
import { engine } from '../../engine/engine.ts';
import { LEVELS, levelById, thinkDelayMs } from '../../engine/levels.ts';
import { splitUci } from '../../engine/uci.ts';
import { loadOpenings, openingAt } from '../../analysis/openings.ts';
import { saveFinishedGame } from '../../app/games.ts';
import { auth } from '../../app/session.ts';
import { offerReview } from './review.ts';
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

interface Setup {
  mode: Mode;
  level: number;
  /** Bên người chơi cầm (chỉ dùng khi đấu với máy). */
  side: Side;
}

/** Ván đang chơi; giữ ngoài hàm render để chuyển màn rồi quay lại vẫn còn. */
let game = new Game();
let setup: Setup = { mode: 'bot', level: 3, side: 'w' };
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
  orientation = setup.mode === 'bot' ? setup.side : 'w';
  animatedOrientation = orientation;
}

/* ---------------- Phần chọn đối thủ, nằm ở cột phải ---------------- */

/**
 * Trước đây đây là một màn riêng: vào mục Chơi thì thấy một trang toàn nút,
 * không có bàn cờ nào. Giờ bàn cờ hiện ngay từ đầu, phần chọn nằm ở cột phải
 * và biến mất khi bấm Bắt đầu — giống chess.com.
 */
function setupPanel(): string {
  const levels = LEVELS.map(
    (l) =>
      `<button class="level-card${l.id === setup.level ? ' is-active' : ''}" data-level="${l.id}">` +
      `<b>${l.name}</b><span>${l.hint}</span></button>`,
  ).join('');

  return `<div class="setup">
      <div class="seg" role="group" aria-label="Đối thủ">
        <button class="seg-item${setup.mode === 'bot' ? ' is-active' : ''}" data-mode="bot">Đấu với máy</button>
        <button class="seg-item${setup.mode === 'human' ? ' is-active' : ''}" data-mode="human">Hai người một máy</button>
      </div>

      ${
        setup.mode === 'bot'
          ? `<div class="setup-block">
              <p class="rule"><span class="rule-label">Cấp độ máy</span><i></i></p>
              <div class="level-grid">${levels}</div>
            </div>
            <div class="setup-block">
              <p class="rule"><span class="rule-label">Bạn cầm quân</span><i></i></p>
              <div class="seg" role="group" aria-label="Bên cầm quân">
                <button class="seg-item${setup.side === 'w' ? ' is-active' : ''}" data-side="w">${pieceGlyph('wk', 'side-piece')} Trắng</button>
                <button class="seg-item${setup.side === 'b' ? ' is-active' : ''}" data-side="b">${pieceGlyph('bk', 'side-piece')} Đen</button>
              </div>
              <p class="seg-note">${setup.side === 'w' ? 'Bạn đi trước.' : 'Máy đi trước.'}</p>
            </div>`
          : '<p class="prose">Hai người thay nhau đi trên cùng một máy. Bàn cờ lật được bất cứ lúc nào.</p>'
      }

    <div class="setup-go">${button({ label: 'Bắt đầu ván', kind: 'primary', icon: 'play' })}</div>
    ${engineError ? notice(engineError, 'danger', 'engine') : ''}
  </div>`;
}

/** Khối gợi ý ba nấc. Dùng gợi ý thì ván đó coi như có trợ giúp. */
function hintBlock(): string {
  const dots = [0, 1, 2]
    .map((i) => `<span class="hint-dot${i < hintLevel ? ' is-on' : ''}"></span>`)
    .join('');
  const labels = ['Gợi ý', 'Gợi ý: quân nào', 'Gợi ý: nước cụ thể', 'Hết gợi ý'];
  const shown = hints ? hints.slice(0, hintLevel) : [];
  return `<div class="hint-block">
    <div class="hint">
      ${button({ label: hintLoading ? 'Đang xem…' : labels[hintLevel], icon: 'hint', disabled: hintLevel === 3 || hintLoading })}
      <span class="hint-dots" aria-label="Đã dùng ${hintLevel} trên 3 nấc gợi ý">${dots}</span>
    </div>
    ${shown.length ? `<ol class="hint-list">${shown.map((h) => `<li>${h}</li>`).join('')}</ol>` : ''}
  </div>`;
}

/* ---------------- Màn đang chơi ---------------- */

function gameScreen(extraSide = ''): string {
  const mat = material(game.fen);
  const result = game.outcome();
  const topSide: Side = orientation === 'w' ? 'b' : 'w';

  const strip = (side: Side) => {
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
    });
  };

  const thắngThua = !result
    ? ''
    : setup.mode !== 'bot' || result.winner === 'draw'
      ? ''
      : result.winner === setup.side
        ? 'Bạn thắng'
        : 'Bạn thua';

  const statusLine = !started
    ? ''
    : result
    ? `<div class="online-result">
         <b class="result-head">${thắngThua || outcomeText(result)}</b>
         ${thắngThua ? `<span class="muted">${outcomeText(result)}</span>` : ''}
         <div class="row-actions">
           ${button({ label: 'Xem lại ván', kind: 'primary', icon: 'review' })}
           ${button({ label: 'Ván mới', icon: 'play' })}
         </div>
       </div>`
    : thinking
      ? notice(
          premove
            ? `${levelById(setup.level).name} đang nghĩ… Nước đi trước sẽ đi ngay khi tới lượt bạn.`
            : `${levelById(setup.level).name} đang nghĩ… Bạn có thể đi trước.`,
          'info',
          'engine',
        )
      : game.inCheck
        ? notice(`${sideName(game.turn)} đang bị chiếu`, 'danger', 'resign')
        : // Hướng dẫn chỉ hiện trước nước đầu. Nhắc suốt ván thì thành rác:
          // đi được một nước rồi là người chơi biết cách rồi.
          game.length === 0
          ? notice(
              // Màn cảm ứng không có chuột phải, nói tới nó chỉ làm rối
              matchMedia('(pointer: coarse)').matches
                ? 'Kéo quân, hoặc chạm quân rồi chạm ô muốn đi.'
                : 'Kéo quân, hoặc bấm quân rồi bấm ô. Chuột phải để vẽ mũi tên.',
              'info',
              'hint',
            )
          : '';

  return `<div class="screen">
    <div class="screen-head">
      <h1>Chơi</h1>
      <span class="head-meta">
        ${
          // Không nhắc "lượt Trắng" nữa: thanh người chơi đã sáng/mờ theo lượt,
          // và bên đang đi có chữ "đang đi" ngay cạnh tên.
          !started
            ? 'Chọn đối thủ rồi bắt đầu'
            : setup.mode === 'bot'
              ? `${levelById(setup.level).name} · bạn cầm ${sideName(setup.side)}`
              : 'Hai người một máy'
        }
      </span>
      ${toolbar(
        [
          iconButton('flip', 'Lật bàn cờ'),
          iconButton('sound', 'Âm thanh', { pressed: soundEnabled() }),
          ...(started ? [iconButton('engine', 'Thanh đánh giá', { pressed: showEval })] : []),
        ],
        started
          ? [
              button({ label: 'Đi lại', icon: 'prev', disabled: game.length === 0 || thinking }),
              button({ label: 'Ván mới', icon: 'play' }),
            ]
          : [],
      )}
    </div>

    <div class="game">
      <div class="game-board">
        ${strip(topSide)}
        <div class="board-row">
          ${showEval ? `<div class="evalbar-wrap only-desktop">${evalBar(currentEval ?? { cp: 0 })}</div>` : ''}
          <div id="board" class="board-host"></div>
        </div>
        ${strip(orientation)}
      </div>

      <div class="game-side">
        ${!started ? sheet(setupPanel()) : ''}
        ${!started ? '' : sheet(
          statusLine,
          game.length
            ? moveList(
                game.history.map((m) => ({ san: m.san })),
                game.ply,
              )
            : '<p class="muted">Chưa có nước nào.</p>',
          ...(setup.mode === 'bot' && !result ? [hintBlock()] : []),
          `<div class="move-bar">
            ${iconButton('first', 'Về đầu ván', { disabled: game.ply === 0 })}
            ${iconButton('prev', 'Lùi một nước', { disabled: game.ply === 0 })}
            ${iconButton('next', 'Tiến một nước', { disabled: game.atLive })}
            ${iconButton('last', 'Tới nước mới nhất', { disabled: game.atLive })}
            <span class="spacer"></span>
            <span class="head-meta">${game.ply}/${game.length}</span>
          </div>`,
        )}
        ${khaiCuoc()}
        ${showEval && currentEval ? `<p class="head-meta">Đánh giá: <span class="mono">${formatScore(currentEval)}</span> (góc nhìn Trắng)</p>` : ''}
        ${engineError ? notice(engineError, 'danger', 'engine') : ''}
        ${extraSide}
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
      if (game.needsPromotion(from, to)) {
        pendingPromotion = { from, to };
        rerender();
        return true;
      }
      if (!game.move(from, to)) return false;
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
  if (!started || !game.length) return '';
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
      check: checked ?? undefined,
      premove: premove ?? undefined,
      label: `Bàn cờ, lượt ${sideName(game.turn)}`,
    },
    stepped ? [last.from, last.to] : undefined,
  );
}

function afterMove(rerender: () => void): void {
  const result = game.outcome();
  const last = game.lastMove!;
  if (result) {
    ended = true;
    playSound('end');
    void storeGame();
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
        void storeGame();
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
async function storeGame(): Promise<void> {
  if (saved) return;
  saved = true;
  const result = game.outcome();
  if (!result) return;
  const who = setup.mode === 'bot' ? levelById(setup.level).name : 'Hai người một máy';
  offerReview(game.pgn(), setup.mode === 'bot' ? setup.side : null, `${who} · ${outcomeText(result)}`);
  await saveFinishedGame({
    mode: setup.mode,
    level: setup.mode === 'bot' ? setup.level : undefined,
    playerSide: setup.mode === 'bot' ? setup.side : 'w',
    pgn: game.pgn(),
    winner: result.winner,
    reason: result.reason,
  });
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
  const side = target.closest<HTMLElement>('[data-side]');
  if (side) {
    setup.side = side.dataset.side as Side;
    rerender();
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
    'Bắt đầu ván': () => {
      newGame();
      started = true;
    },
    'Lật bàn cờ': () => {
      // Chưa vào ván thì lật bàn nghĩa là đổi bên mình cầm, chứ không phải
      // xoay cho vui — vì lúc vẽ lại bàn cờ vẫn lật theo bên đã chọn.
      if (!started && setup.mode === 'bot') setup.side = setup.side === 'w' ? 'b' : 'w';
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
    'Xem lại ván': () => {
      location.hash = '#/xem-lai';
    },
    'Gợi ý': () => void askHint(rerender),
    'Gợi ý: quân nào': () => void askHint(rerender),
    'Gợi ý: nước cụ thể': () => void askHint(rerender),
    // Đấu với máy thì lùi hai nước, để lượt vẫn thuộc về người chơi
    'Đi lại': () => {
      void engine().cancel();
      thinking = false;
      premove = null;
      game.undo();
      if (setup.mode === 'bot' && game.length && game.turn !== setup.side) game.undo();
      ended = false;
      saved = false;
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
  return true;
}
