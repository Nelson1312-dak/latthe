// Xem lại ván: chấm từng nước bằng engine rồi chỉ ra chỗ hỏng.
//
// Việc chấm chạy ngay trong trình duyệt người chơi (Web Worker), có thanh tiến
// độ và dừng được giữa chừng. Kết quả lưu lên server để lần sau mở ra là có ngay.

import { boardSvg, CLASS_LABEL } from '../../board/Board.ts';
import { Game, outcomeText, type Side } from '../../../shared/chess.ts';
import { material, type Square } from '../../../shared/fen.ts';
import { formatScore, type MoveClass } from '../../../shared/winrate.ts';
import { engine } from '../../engine/engine.ts';
import { loadOpenings } from '../../analysis/openings.ts';
import { reviewGame, ReviewCancelled, mistakesOf, type ReviewResult } from '../../analysis/review.ts';
import { auth } from '../../app/session.ts';
import { recentGames, type GameRow } from '../../app/games.ts';
import { fetchGame, saveReview } from '../../app/reviews.ts';
import {
  button,
  classBadge,
  evalBar,
  figurine,
  iconButton,
  moveList,
  notice,
  playerStrip,
  rule,
  sheet,
  sideGlyph,
  stats,
  toolbar,
} from '../components/index.ts';

type Phase = 'pick' | 'loading' | 'analysing' | 'done' | 'error';

interface State {
  phase: Phase;
  /** Ván đang xem; null khi đang ở màn chọn ván. */
  gameId: number | null;
  pgn: string;
  /** Bên của người học. null nghĩa là hai người cùng máy — soi lỗi cả hai bên. */
  playerSide: Side | null;
  label: string;
  review: ReviewResult | null;
  /** Nước đang xem, 0 là thế cờ đầu. */
  ply: number;
  orientation: Side;
  progress: { done: number; total: number };
  error: string | null;
  newCards: number;
  games: GameRow[];
}

const state: State = {
  phase: 'pick',
  gameId: null,
  pgn: '',
  playerSide: 'w',
  label: '',
  review: null,
  ply: 0,
  orientation: 'w',
  progress: { done: 0, total: 0 },
  error: null,
  newCards: 0,
  games: [],
};

let cancelRequested = false;
/** Ván vừa chơi xong ở màn Chơi, để xem lại ngay không cần đăng nhập. */
let lastFinished: { pgn: string; playerSide: Side | null; label: string } | null = null;

export function offerReview(pgn: string, playerSide: Side | null, label: string): void {
  lastFinished = { pgn, playerSide, label };
}

const sideName = (s: Side) => (s === 'w' ? 'Trắng' : 'Đen');

/* ---------------- Vào màn ---------------- */

export function review(): string {
  switch (state.phase) {
    case 'loading':
      return shell(notice('Đang mở ván…', 'info', 'clock'));
    case 'analysing':
      return shell(progressBlock());
    case 'error':
      return shell(
        notice(state.error ?? 'Có lỗi', 'danger', 'engine') + `<div class="setup-go">${button({ label: 'Thử lại', icon: 'review' })}</div>`,
      );
    case 'done':
      return state.review ? resultScreen(state.review) : shell(notice('Chưa có kết quả', 'info', 'review'));
    default:
      return pickScreen();
  }
}

function shell(body: string): string {
  return `<div class="screen screen-narrow">
    <div class="screen-head"><h1>Xem lại ván</h1><span class="head-meta">${state.label}</span></div>
    ${body}
  </div>`;
}

function progressBlock(): string {
  const { done, total } = state.progress;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<div class="analysing">
    <p class="prose">Đang chấm từng nước bằng engine. Việc này chạy ngay trên máy bạn.</p>
    <div class="progress"><span style="width:${pct}%"></span></div>
    <p class="head-meta"><span class="mono">${done}/${total}</span> thế cờ · ${pct}%</p>
    <div class="setup-go">${button({ label: 'Dừng', kind: 'danger', icon: 'close' })}</div>
  </div>`;
}

/* ---------------- Chọn ván ---------------- */

function pickScreen(): string {
  const row = (g: GameRow) => {
    const win = g.winner === 'draw' ? 'd' : g.winner === g.playerSide ? 'w' : 'l';
    const text = g.winner === 'draw' ? 'Hòa' : win === 'w' ? 'Thắng' : 'Thua';
    const who = g.mode === 'bot' ? `Máy cấp ${g.level ?? '?'}` : 'Hai người';
    return `<button class="log-row" data-game="${g.id}">
      ${sideGlyph(g.playerSide)}
      <span class="log-name">${who}</span>
      <span class="log-result result-${win}">${text} · ${g.reason}</span>
      <span class="log-acc mono">${g.moveCount} nước</span>
      <span class="log-when">${when(g.createdAt)}</span>
    </button>`;
  };

  return `<div class="screen screen-narrow">
    <div class="screen-head">
      <h1>Xem lại ván</h1>
      <span class="head-meta">Engine chấm từng nước và chỉ ra chỗ hỏng</span>
    </div>

    ${
      lastFinished
        ? `${rule('Ván vừa chơi')}
           <div class="task-list" style="margin-bottom:var(--s-6)">
             <div class="task">
               <span class="task-text"><b>${lastFinished.label}</b><span>Chấm ngay, không cần đăng nhập</span></span>
               <span class="task-go" data-review-last>${button({ label: 'Chấm ván này', kind: 'primary', icon: 'review' })}</span>
             </div>
           </div>`
        : ''
    }

    ${rule('Ván đã lưu')}
    ${
      !auth.user
        ? notice('Đăng nhập để lưu ván và xem lại bất cứ lúc nào.', 'locked', 'user')
        : state.games.length
          ? sheet(`<div class="log">${state.games.map(row).join('')}</div>`)
          : notice('Chưa có ván nào được lưu. Chơi xong một ván là nó tự lưu lại.', 'info', 'play')
    }
  </div>`;
}

function when(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600_000);
  if (h < 1) return 'vừa xong';
  if (h < 24) return `${h} giờ`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hôm qua' : `${d} ngày`;
}

/* ---------------- Kết quả ---------------- */

function evalGraph(r: ReviewResult, currentPly: number): string {
  const w = 360;
  const h = 72;
  const y = (i: number) => {
    const s = r.moves[i].scoreAfter;
    const pct = s.mate !== undefined ? (s.mate > 0 ? 1 : 0) : 1 / (1 + Math.exp(-0.004 * s.cp));
    return h - pct * h;
  };
  const step = w / Math.max(1, r.moves.length);
  const pts = r.moves.map((_, i) => `${(i * step).toFixed(1)},${y(i).toFixed(1)}`);
  const dots = r.moves
    .map((m, i) =>
      ['blunder', 'mistake', 'miss'].includes(m.cls)
        ? `<circle class="graph-dot" data-ply="${i + 1}" cx="${(i * step).toFixed(1)}" cy="${y(i).toFixed(1)}" r="3.5" fill="var(--cls-${m.cls})" stroke="#26241f" stroke-width="1.5"/>`
        : '',
    )
    .join('');
  const cx = (Math.max(0, currentPly - 1) * step).toFixed(1);
  return `<svg class="evalgraph" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Biểu đồ đánh giá theo nước đi">
    <rect width="${w}" height="${h}" fill="#26241f"/>
    <path d="M0,${h} L${pts.join(' L')} L${w},${h} Z" fill="#e8e4db"/>
    <line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="#4a473f" stroke-dasharray="3 3"/>
    <line x1="${cx}" y1="0" x2="${cx}" y2="${h}" stroke="var(--accent)" stroke-width="1.5"/>
    ${dots}
  </svg>`;
}

function resultScreen(r: ReviewResult): string {
  const ply = state.ply;
  const move = ply > 0 ? r.moves[ply - 1] : null;
  const fen = move ? move.fenAfter : (r.moves[0]?.fenBefore ?? new Game().fen);
  const mat = material(fen);
  const or = state.orientation;
  const mySide = state.playerSide;
  const topSide: Side = or === 'w' ? 'b' : 'w';
  const best = move?.best[0];
  const showBetter = move && best && move.uci !== best.uci && ['blunder', 'mistake', 'inaccuracy', 'miss'].includes(move.cls);

  const counts: Partial<Record<MoveClass, number>> = {};
  for (const m of r.moves) counts[m.cls] = (counts[m.cls] ?? 0) + 1;
  const tally = (['blunder', 'mistake', 'miss', 'inaccuracy', 'best', 'good', 'book'] as MoveClass[])
    .filter((c) => counts[c])
    .map((c) => `<li>${classBadge(c)} ${CLASS_LABEL[c]} <b class="mono">${counts[c]}</b></li>`)
    .join('');

  const mistakes = mistakesOf(r, mySide ?? undefined);
  const nextBad = mistakes.find((m) => m.ply > ply);
  const prevBad = [...mistakes].reverse().find((m) => m.ply < ply);

  const strip = (side: Side) =>
    playerStrip({
      name: sideName(side),
      side,
      you: side === mySide,
      took: side === 'w' ? mat.whiteTook : mat.blackTook,
      diff: side === 'w' ? mat.diff : -mat.diff,
      accuracy: side === 'w' ? r.accuracy.w : r.accuracy.b,
    });

  return `<div class="screen">
    <div class="screen-head">
      <h1>Xem lại ván</h1>
      <span class="head-meta">${state.label}${r.opening ? ` · ${r.opening.eco} ${r.opening.name}` : ''}</span>
      ${toolbar([iconButton('flip', 'Lật bàn cờ')], [button({ label: 'Chọn ván khác', icon: 'review' })])}
    </div>

    <div class="game">
      <div class="game-board">
        ${strip(topSide)}
        <div class="board-row">
          <div class="evalbar-wrap only-desktop">${evalBar(move?.scoreAfter ?? { cp: 0 })}</div>
          ${boardSvg({
            fen,
            orientation: or,
            lastMove: move ? [move.uci.slice(0, 2) as Square, move.uci.slice(2, 4) as Square] : undefined,
            badge: move ? { square: move.uci.slice(2, 4) as Square, cls: move.cls } : undefined,
            arrows:
              showBetter && best
                ? [{ from: best.uci.slice(0, 2) as Square, to: best.uci.slice(2, 4) as Square, kind: 'coach' }]
                : undefined,
            label: move ? `Thế cờ sau nước ${Math.ceil(ply / 2)}.${move.san}` : 'Thế cờ đầu ván',
          })}
        </div>
        ${strip(or)}
      </div>

      <div class="game-side">
        ${sheet(
          move
            ? `<div class="verdict">
                <p class="note-move">
                  <span class="mono">${Math.ceil(ply / 2)}.${move.side === 'b' ? '..' : ''}</span>
                  ${figurine(move.san, move.side)}
                  ${classBadge(move.cls, 'md')}
                  <span class="note-verdict">${CLASS_LABEL[move.cls]}</span>
                  <span class="spacer"></span>
                  <span class="mono head-meta">${formatScore(move.scoreAfter)}</span>
                </p>
                ${
                  showBetter && best
                    ? `<p class="note-better">Tốt hơn ${figurine(best.san, move.side)} — ${formatScore(best.score)}</p>`
                    : ''
                }
               </div>`
            : '<p class="muted">Chọn một nước để xem nhận xét.</p>',
          `<div class="graph-block">
            ${rule('Diễn biến', `<span class="rule-note">${r.moves.length} nước</span>`)}
            ${evalGraph(r, ply)}
            <div class="graph-nav">
              ${button({ label: 'Nước hỏng trước', icon: 'prev', disabled: !prevBad })}
              ${button({ label: 'Nước hỏng tiếp theo', icon: 'next', disabled: !nextBad })}
            </div>
            <ul class="tally">${tally}</ul>
          </div>`,
          moveList(
            r.moves.map((m) => ({ san: m.san, cls: m.cls, score: m.scoreAfter })),
            ply,
            { scores: true },
          ),
          `<div class="move-bar">
            ${iconButton('first', 'Về đầu ván', { disabled: ply === 0 })}
            ${iconButton('prev', 'Lùi một nước', { disabled: ply === 0 })}
            ${iconButton('next', 'Tiến một nước', { disabled: ply >= r.moves.length })}
            ${iconButton('last', 'Tới nước cuối', { disabled: ply >= r.moves.length })}
            <span class="spacer"></span>
            <span class="head-meta">${ply}/${r.moves.length}</span>
          </div>`,
        )}

        ${rule('Tổng kết')}
        ${stats([
          ...(mySide
            ? ([['Độ chính xác của bạn', `${mySide === 'w' ? r.accuracy.w : r.accuracy.b}%`]] as [string, string][])
            : ([
                ['Độ chính xác Trắng', `${r.accuracy.w}%`],
                ['Độ chính xác Đen', `${r.accuracy.b}%`],
              ] as [string, string][])),
          ['Nước đáng ôn lại', String(mistakes.length)],
          ...(state.newCards ? ([['Thẻ ôn tập mới', String(state.newCards)]] as [string, string][]) : []),
        ])}
      </div>
    </div>
  </div>`;
}

/* ---------------- Chạy việc chấm ván ---------------- */

async function runReview(rerender: () => void): Promise<void> {
  state.phase = 'analysing';
  state.progress = { done: 0, total: 0 };
  state.error = null;
  cancelRequested = false;
  rerender();

  try {
    await loadOpenings();
    const result = await reviewGame(state.pgn, engine(), {
      movetimeMs: 450,
      multipv: 3,
      onProgress: (done, total) => {
        state.progress = { done, total };
        // Vẽ lại mỗi vài thế cờ cho đỡ tốn
        if (done % 4 === 0 || done === total) rerender();
      },
      cancelled: () => cancelRequested,
    });
    state.review = result;
    state.ply = result.moves.length ? (mistakesOf(result, state.playerSide ?? undefined)[0]?.ply ?? result.moves.length) : 0;
    state.phase = 'done';
    if (state.gameId) state.newCards = await saveReview(state.gameId, result);
    rerender();
  } catch (err) {
    if (err instanceof ReviewCancelled) {
      state.phase = 'pick';
    } else {
      state.phase = 'error';
      state.error = `Không chấm được ván: ${(err as Error).message}`;
    }
    rerender();
  }
}

/** Mở màn Xem lại: nạp danh sách ván đã lưu. */
export function mountReview(rerender: () => void): void {
  if (state.phase === 'pick' && auth.user && !state.games.length) {
    void recentGames().then((games) => {
      if (!games.length) return;
      state.games = games;
      rerender();
    });
  }
}

export function handleReviewClick(target: HTMLElement, rerender: () => void): boolean {
  const pick = target.closest<HTMLElement>('[data-game]');
  if (pick) {
    const id = Number(pick.dataset.game);
    state.phase = 'loading';
    state.gameId = id;
    state.newCards = 0;
    rerender();
    void fetchGame(id).then((data) => {
      if (!data) {
        state.phase = 'error';
        state.error = 'Không mở được ván này';
        rerender();
        return;
      }
      state.pgn = data.game.pgn;
      state.playerSide = data.game.playerSide;
      state.orientation = data.game.playerSide;
      // Ván hai người thì không có "bên của mình": soi lỗi cả hai bên
      if (data.game.mode === 'human') state.playerSide = null;
      const who = data.game.mode === 'bot' ? `Máy cấp ${data.game.level ?? '?'}` : 'Hai người một máy';
      state.label = `${who} · ${outcomeText({ winner: data.game.winner, reason: data.game.reason as never })}`;
      if (data.review) {
        // Đã chấm rồi thì mở ra ngay, không chấm lại
        state.review = data.review;
        state.ply = mistakesOf(data.review, state.playerSide ?? undefined)[0]?.ply ?? data.review.moves.length;
        state.phase = 'done';
        void loadOpenings().then(rerender);
        rerender();
      } else {
        void runReview(rerender);
      }
    });
    return true;
  }

  if (target.closest('[data-review-last]') && lastFinished) {
    state.gameId = null;
    state.pgn = lastFinished.pgn;
    state.playerSide = lastFinished.playerSide;
    // Ván hai người thì cứ để Trắng ở dưới
    state.orientation = lastFinished.playerSide ?? 'w';
    state.label = lastFinished.label;
    state.newCards = 0;
    void runReview(rerender);
    return true;
  }

  const dot = target.closest<SVGElement>('.graph-dot');
  if (dot) {
    state.ply = Number(dot.getAttribute('data-ply'));
    rerender();
    return true;
  }

  const moveBtn = target.closest<HTMLElement>('.move[data-ply]');
  if (moveBtn) {
    state.ply = Number(moveBtn.dataset.ply);
    rerender();
    return true;
  }

  const btn = target.closest<HTMLButtonElement>('button');
  if (!btn) return false;
  const label = btn.getAttribute('title') ?? btn.textContent?.trim() ?? '';
  const r = state.review;

  const actions: Record<string, () => void> = {
    Dừng: () => {
      cancelRequested = true;
    },
    'Thử lại': () => void runReview(rerender),
    'Chọn ván khác': () => {
      state.phase = 'pick';
      state.review = null;
    },
    'Lật bàn cờ': () => {
      state.orientation = state.orientation === 'w' ? 'b' : 'w';
    },
    'Về đầu ván': () => {
      state.ply = 0;
    },
    'Lùi một nước': () => {
      state.ply = Math.max(0, state.ply - 1);
    },
    'Tiến một nước': () => {
      state.ply = Math.min(r?.moves.length ?? 0, state.ply + 1);
    },
    'Tới nước cuối': () => {
      state.ply = r?.moves.length ?? 0;
    },
    'Nước hỏng tiếp theo': () => {
      const next = r && mistakesOf(r, state.playerSide ?? undefined).find((m) => m.ply > state.ply);
      if (next) state.ply = next.ply;
    },
    'Nước hỏng trước': () => {
      const prev = r && [...mistakesOf(r, state.playerSide ?? undefined)].reverse().find((m) => m.ply < state.ply);
      if (prev) state.ply = prev.ply;
    },
  };

  const run = actions[label];
  if (!run) return false;
  run();
  rerender();
  return true;
}
