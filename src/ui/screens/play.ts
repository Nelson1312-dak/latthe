// Màn chơi: đấu với máy, hoặc hai người trên cùng một máy.
// Engine chạy trong Web Worker ở máy người chơi, nên giao diện không bị đứng
// trong lúc máy nghĩ.

import { BoardView } from '../../board/BoardView.ts';
import { Game, outcomeText, type Side, type Square } from '../../../shared/chess.ts';
import { material } from '../../../shared/fen.ts';
import { formatScore, type Score } from '../../../shared/winrate.ts';
import { playSound, soundEnabled } from '../../app/sound.ts';
import { engine } from '../../engine/engine.ts';
import { LEVELS, levelById, thinkDelayMs } from '../../engine/levels.ts';
import { splitUci } from '../../engine/uci.ts';
import { saveFinishedGame } from '../../app/games.ts';
import { offerReview } from './review.ts';
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
  ended = false;
  thinking = false;
  currentEval = null;
  saved = false;
  animatedPly = 0;
  orientation = setup.mode === 'bot' ? setup.side : 'w';
  animatedOrientation = orientation;
}

/* ---------------- Màn chọn trước khi vào ván ---------------- */

function setupScreen(): string {
  const levels = LEVELS.map(
    (l) =>
      `<button class="level-card${l.id === setup.level ? ' is-active' : ''}" data-level="${l.id}">` +
      `<b>${l.name}</b><span>${l.hint}</span></button>`,
  ).join('');

  return `<div class="screen screen-narrow">
    <div class="screen-head">
      <h1>Chơi</h1>
      <span class="head-meta">Chọn đối thủ rồi bắt đầu</span>
    </div>

    <div class="setup">
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
                <button class="seg-item${setup.side === 'w' ? ' is-active' : ''}" data-side="w">${pieceGlyph('wk', 'side-piece')} Trắng — đi trước</button>
                <button class="seg-item${setup.side === 'b' ? ' is-active' : ''}" data-side="b">${pieceGlyph('bk', 'side-piece')} Đen</button>
              </div>
            </div>`
          : '<p class="prose">Hai người thay nhau đi trên cùng một máy. Bàn cờ lật được bất cứ lúc nào.</p>'
      }

      <div class="setup-go">${button({ label: 'Bắt đầu ván', kind: 'primary', icon: 'play' })}</div>
      ${engineError ? notice(engineError, 'danger', 'engine') : ''}
    </div>
  </div>`;
}

/* ---------------- Màn đang chơi ---------------- */

function gameScreen(): string {
  const mat = material(game.fen);
  const result = game.outcome();
  const last = game.lastMove;
  const topSide: Side = orientation === 'w' ? 'b' : 'w';

  const strip = (side: Side) => {
    const isBot = setup.mode === 'bot' && side === botSide();
    return playerStrip({
      name: isBot ? levelById(setup.level).name : sideName(side),
      side,
      bot: isBot,
      you: setup.mode === 'bot' && side === setup.side,
      status: thinking && isBot ? 'đang nghĩ…' : !result && game.turn === side ? 'đang đi' : undefined,
      clockState: !result && game.turn === side ? 'running' : 'idle',
      took: side === 'w' ? mat.whiteTook : mat.blackTook,
      diff: side === 'w' ? mat.diff : -mat.diff,
    });
  };

  const statusLine = result
    ? `<p class="game-result"><b>${outcomeText(result)}</b></p>
       <div class="setup-go" style="margin-top:var(--s-3)">${button({ label: 'Xem lại ván', kind: 'primary', icon: 'review' })}</div>`
    : thinking
      ? notice(`${levelById(setup.level).name} đang nghĩ…`, 'info', 'engine')
      : game.inCheck
        ? notice(`${sideName(game.turn)} đang bị chiếu`, 'danger', 'resign')
        : notice('Chọn quân rồi chọn ô muốn đi', 'info', 'hint');

  return `<div class="screen">
    <div class="screen-head">
      <h1>Chơi</h1>
      <span class="head-meta">
        ${setup.mode === 'bot' ? `${levelById(setup.level).name} · bạn cầm ${sideName(setup.side)}` : 'Hai người một máy'}
        ${result ? '' : ` · lượt ${sideName(game.turn)}`}
      </span>
      ${toolbar(
        [
          iconButton('flip', 'Lật bàn cờ'),
          iconButton('sound', 'Âm thanh', { pressed: soundEnabled() }),
          iconButton('engine', 'Thanh đánh giá', { pressed: showEval }),
        ],
        [
          button({ label: 'Đi lại', icon: 'prev', disabled: game.length === 0 || thinking }),
          button({ label: 'Ván mới', icon: 'play' }),
        ],
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
        ${sheet(
          statusLine,
          game.length
            ? moveList(
                game.history.map((m) => ({ san: m.san })),
                game.ply,
              )
            : '<p class="muted">Chưa có nước nào.</p>',
          `<div class="move-bar">
            ${iconButton('first', 'Về đầu ván', { disabled: game.ply === 0 })}
            ${iconButton('prev', 'Lùi một nước', { disabled: game.ply === 0 })}
            ${iconButton('next', 'Tiến một nước', { disabled: game.atLive })}
            ${iconButton('last', 'Tới nước mới nhất', { disabled: game.atLive })}
            <span class="spacer"></span>
            <span class="head-meta">${game.ply}/${game.length}</span>
          </div>`,
        )}
        ${showEval && currentEval ? `<p class="head-meta">Đánh giá: <span class="mono">${formatScore(currentEval)}</span> (góc nhìn Trắng)</p>` : ''}
        ${last ? `<p class="head-meta">Nước vừa đi: <span class="mono">${last.san}</span></p>` : ''}
        ${engineError ? notice(engineError, 'danger', 'engine') : ''}
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

export function play(): string {
  return started ? gameScreen() : setupScreen();
}

/* ---------------- Gắn bàn cờ sau khi HTML vào DOM ---------------- */

export function mountPlay(rerender: () => void): void {
  const host = document.querySelector<HTMLElement>('#board');
  if (!host) return;

  view = new BoardView(host, {
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
      afterMove(rerender);
      rerender();
      return true;
    },
  });

  drawBoard();
  // Máy đi trước thì bắt đầu nghĩ ngay
  if (isBotTurn() && !thinking) void botMove(rerender);
}

/** Người chơi có được phép đi lúc này không. */
function canPlay(): boolean {
  if (!game.atLive || ended || thinking) return false;
  if (setup.mode === 'human') return true;
  return game.turn === setup.side;
}

function drawBoard(): void {
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
const PIECE_SLIDE_MS = 200;
function rerenderAfterSlide(rerender: () => void): void {
  setTimeout(rerender, PIECE_SLIDE_MS);
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
    // Thanh đánh giá cập nhật sau, để không vẽ lại giữa lúc quân đang trượt
    if (showEval) setTimeout(() => void refreshEval(rerender), PIECE_SLIDE_MS);
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
      orientation = orientation === 'w' ? 'b' : 'w';
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
    // Đấu với máy thì lùi hai nước, để lượt vẫn thuộc về người chơi
    'Đi lại': () => {
      void engine().cancel();
      thinking = false;
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
