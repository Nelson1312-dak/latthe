// Màn chơi thật: hai người trên cùng một máy.
// Đây là màn đầu tiên có logic cờ chạy thật, không phải bản dựng tĩnh.
// Đấu với máy là giai đoạn 3, chơi qua mạng là giai đoạn 7.

import { BoardView } from '../../board/BoardView.ts';
import { Game, outcomeText, type Side, type Square } from '../../../shared/chess.ts';
import { material } from '../../../shared/fen.ts';
import { playSound, soundEnabled } from '../../app/sound.ts';
import {
  button,
  dialog,
  iconButton,
  moveList,
  notice,
  pieceGlyph,
  playerStrip,
  sheet,
  toolbar,
} from '../components/index.ts';

/** Ván đang chơi; giữ ngoài hàm render để chuyển màn rồi quay lại vẫn còn. */
let game = new Game();
let orientation: Side = 'w';
let view: BoardView | null = null;
/** Nước đang chờ người chơi chọn quân phong cấp. */
let pendingPromotion: { from: Square; to: Square } | null = null;
let ended = false;

const PROMOTION_PIECES = [
  ['q', 'Hậu'],
  ['r', 'Xe'],
  ['b', 'Tượng'],
  ['n', 'Mã'],
] as const;

export function resetGame(): void {
  game = new Game();
  pendingPromotion = null;
  ended = false;
}

export function play(): string {
  const mat = material(game.fen);
  const result = game.outcome();
  const last = game.lastMove;

  const topSide: Side = orientation === 'w' ? 'b' : 'w';
  const strip = (side: Side) =>
    playerStrip({
      name: side === 'w' ? 'Trắng' : 'Đen',
      side,
      status: !result && game.turn === side ? 'đang đi' : undefined,
      clockState: !result && game.turn === side ? 'running' : 'idle',
      took: side === 'w' ? mat.whiteTook : mat.blackTook,
      diff: side === 'w' ? mat.diff : -mat.diff,
    });

  return `<div class="screen">
    <div class="screen-head">
      <h1>Chơi</h1>
      <span class="head-meta">Hai người một máy${result ? '' : ` · lượt ${game.turn === 'w' ? 'Trắng' : 'Đen'}`}</span>
      ${toolbar(
        [iconButton('flip', 'Lật bàn cờ'), iconButton('sound', 'Âm thanh', { pressed: soundEnabled() })],
        [button({ label: 'Lùi một nước', icon: 'prev', disabled: game.length === 0 }), button({ label: 'Ván mới', icon: 'play' })],
      )}
    </div>

    <div class="game">
      <div class="game-board">
        ${strip(topSide)}
        <div class="board-row"><div id="board" class="board-host" aria-label="Bàn cờ"></div></div>
        ${strip(orientation)}
      </div>

      <div class="game-side">
        ${sheet(
          result
            ? `<p class="game-result"><b>${outcomeText(result)}</b></p>`
            : notice(
                game.inCheck ? `${game.turn === 'w' ? 'Trắng' : 'Đen'} đang bị chiếu` : 'Chọn quân rồi chọn ô muốn đi',
                game.inCheck ? 'danger' : 'info',
                game.inCheck ? 'resign' : 'hint',
              ),
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
        ${last ? `<p class="head-meta">Nước vừa đi: <span class="mono">${last.san}</span></p>` : ''}
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

/** Gắn bàn cờ tương tác sau khi HTML đã vào DOM. */
export function mountPlay(rerender: () => void): void {
  const host = document.querySelector<HTMLElement>('#board');
  if (!host) return;

  const draw = () => {
    const checked = game.checkedKing;
    const last = game.lastMove;
    view?.render({
      fen: game.fen,
      orientation,
      lastMove: last ? [last.from, last.to] : undefined,
      check: checked ?? undefined,
      label: `Bàn cờ, lượt ${game.turn === 'w' ? 'Trắng' : 'Đen'}`,
    });
  };

  view = new BoardView(host, {
    legalFrom: (from) => (game.atLive && !ended ? game.legalFrom(from) : { quiet: [], captures: [] }),
    canPick: (sq) => {
      if (!game.atLive || ended) return false;
      // Chỉ cầm được quân của bên đang đến lượt
      return game.legalFrom(sq).quiet.length + game.legalFrom(sq).captures.length > 0;
    },
    onMove: (from, to) => {
      if (!game.atLive || ended) return false;
      if (game.needsPromotion(from, to)) {
        pendingPromotion = { from, to };
        rerender();
        return true;
      }
      const m = game.move(from, to);
      if (!m) return false;
      afterMove();
      rerender();
      return true;
    },
  });

  draw();
}

function afterMove(): void {
  const result = game.outcome();
  const last = game.lastMove!;
  if (result) {
    ended = true;
    playSound('end');
  } else if (game.inCheck) playSound('check');
  else playSound(last.captured ? 'capture' : 'move');
}

/** Xử lý các nút của màn chơi. Trả về true nếu đã xử lý. */
export function handlePlayClick(target: HTMLElement, rerender: () => void): boolean {
  const promo = target.closest<HTMLElement>('[data-promote]');
  if (promo && pendingPromotion) {
    const { from, to } = pendingPromotion;
    pendingPromotion = null;
    if (game.move(from, to, promo.dataset.promote)) afterMove();
    rerender();
    return true;
  }

  const btn = target.closest<HTMLButtonElement>('button');
  if (!btn) return false;
  const label = btn.getAttribute('title') ?? btn.textContent?.trim() ?? '';

  const actions: Record<string, () => void> = {
    'Lật bàn cờ': () => {
      orientation = orientation === 'w' ? 'b' : 'w';
    },
    'Ván mới': resetGame,
    'Lùi một nước': () => {
      // Nút trong thanh đầu màn xoá hẳn nước; nút trong thanh dưới sổ chỉ tua xem
      if (btn.classList.contains('btn-icon')) game.prev();
      else {
        game.undo();
        ended = false;
      }
    },
    'Về đầu ván': () => game.first(),
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
