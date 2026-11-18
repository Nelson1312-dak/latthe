// Ván đã chơi: danh sách ván đã lưu, và xem lại một ván — cùng một bố cục với
// lúc vừa đánh xong ở tab Chơi (bàn cờ bên trái, bảng xem lại bên phải), để
// người chơi không phải học hai giao diện.
//
// Ván đã chấm (lúc vừa đánh xong) thì mở ra là có ngay. Ván chưa chấm thì chấm
// ngay trên máy người chơi bằng Stockfish, rồi lưu lên server.

import { boardSvg } from '../../board/Board.ts';
import { END_TEXT, Game, outcomeText, type EndReason, type Outcome, type Side } from '../../../shared/chess.ts';
import { material, type Square } from '../../../shared/fen.ts';
import { reviewGame, ReviewCancelled, type ReviewResult } from '../../analysis/review.ts';
import { cachedAnalyser, REVIEW_PV } from '../../analysis/precompute.ts';
import { loadOpenings } from '../../analysis/openings.ts';
import { auth } from '../../app/session.ts';
import { routeQuery } from '../../app/route.ts';
import { recentGames, type GameRow } from '../../app/games.ts';
import { fetchGame, saveReview } from '../../app/reviews.ts';
import { boardMarks, momentsOf, reviewPanel } from '../report.ts';
import { button, iconButton, moveList, notice, playerStrip, sheet, sideGlyph, toolbar } from '../components/index.ts';

type Phase = 'pick' | 'loading' | 'analysing' | 'done' | 'error';

interface State {
  phase: Phase;
  /** Ván đang xem; null khi đang ở danh sách ván. */
  gameId: number | null;
  pgn: string;
  /** Bên của người chơi. null là hai người cùng máy — soi lỗi cả hai bên. */
  playerSide: Side | null;
  /** "Với Máy cấp 5", "Với Nam", "Hai người một máy". */
  title: string;
  /** "Bạn thắng · chiếu hết". */
  result: string;
  /** Tên đối thủ trên thanh người chơi. null là cứ ghi Trắng/Đen. */
  opponent: string | null;
  review: ReviewResult | null;
  /** Nước đang xem, 0 là thế cờ đầu. */
  ply: number;
  orientation: Side;
  progress: { done: number; total: number };
  error: string | null;
  games: GameRow[];
  /** Tên hai bên ghi sẵn (ván được chia sẻ): dùng thay cho tên người đang xem. */
  names: { w: string; b: string } | null;
  /** Đang xem ván người khác chia sẻ qua link. */
  shared: boolean;
}

const state: State = {
  phase: 'pick',
  gameId: null,
  pgn: '',
  playerSide: 'w',
  title: '',
  result: '',
  opponent: null,
  review: null,
  ply: 0,
  orientation: 'w',
  progress: { done: 0, total: 0 },
  error: null,
  games: [],
  names: null,
  shared: false,
};

let cancelRequested = false;

const sideName = (s: Side) => (s === 'w' ? 'Trắng' : 'Đen');

/** Kết quả ván nhìn từ phía người chơi: "Bạn thắng · chiếu hết". */
function resultFor(o: Outcome, me: Side | null): string {
  const [ai, vìSao] = outcomeText(o).split(' · ');
  if (!me) return outcomeText(o);
  const kq = o.winner === 'draw' ? 'Hòa' : o.winner === me ? 'Bạn thắng' : 'Bạn thua';
  return o.winner === 'draw' ? `${kq}${vìSao ? ` · ${vìSao}` : ''}` : `${kq} · ${vìSao ?? ai}`;
}

/* ---------------- Vào màn ---------------- */

export function review(): string {
  switch (state.phase) {
    case 'loading':
      return shell(notice('Đang mở ván…', 'info', 'clock'));
    case 'analysing':
      return shell(progressBlock());
    case 'error':
      return shell(
        notice(state.error ?? 'Có lỗi', 'danger', 'engine') +
          `<div class="setup-go">${button({ label: 'Thử lại', icon: 'review' })}</div>`,
      );
    case 'done':
      return state.review ? resultScreen(state.review) : shell(notice('Chưa có kết quả', 'info', 'review'));
    default:
      return pickScreen();
  }
}

function shell(body: string): string {
  return `<div class="screen screen-narrow">
    <div class="screen-head"><h1>${state.title || 'Ván đã chơi'}</h1><span class="head-meta">${state.result}</span></div>
    ${body}
  </div>`;
}

function progressBlock(): string {
  const { done, total } = state.progress;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<div class="analysing">
    <p class="prose">Ván này chưa được chấm. Engine đang chấm từng nước ngay trên máy bạn.</p>
    <div class="progress"><span style="width:${pct}%"></span></div>
    <p class="head-meta"><span class="mono">${done}/${total}</span> thế cờ · ${pct}%</p>
    <div class="setup-go">${button({ label: 'Dừng', kind: 'danger', icon: 'close' })}</div>
  </div>`;
}

/* ---------------- Danh sách ván ---------------- */

function pickScreen(): string {
  const row = (g: GameRow) => {
    const win = g.winner === 'draw' ? 'd' : g.winner === g.playerSide ? 'w' : 'l';
    const text = g.winner === 'draw' ? 'Hòa' : win === 'w' ? 'Thắng' : 'Thua';
    const who = g.mode === 'bot' ? `Máy cấp ${g.level ?? '?'}` : 'Hai người';
    return `<button class="log-row" data-game="${g.id}">
      ${sideGlyph(g.playerSide)}
      <span class="log-name">${who}</span>
      <span class="log-result result-${win}">${text} · ${END_TEXT[g.reason as EndReason] ?? g.reason}</span>
      <span class="log-acc mono">${g.moveCount} nước</span>
      <span class="log-when">${when(g.createdAt)}</span>
    </button>`;
  };

  return `<div class="screen screen-narrow">
    <div class="screen-head">
      <h1>Ván đã chơi</h1>
      <span class="head-meta">Bấm một ván để xem lại các khoảnh khắc đáng chú ý</span>
    </div>
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

/* ---------------- Xem lại một ván ---------------- */

function resultScreen(r: ReviewResult): string {
  const ply = state.ply;
  const move = ply > 0 ? r.moves[ply - 1] : null;
  const fen = move ? move.fenAfter : (r.moves[0]?.fenBefore ?? new Game().fen);
  const mat = material(fen);
  const or = state.orientation;
  const me = state.playerSide;
  const topSide: Side = or === 'w' ? 'b' : 'w';
  const opp: Side = me === 'b' ? 'w' : 'b';

  const tên = (side: Side) =>
    state.names
      ? state.names[side]
      : me && side === me && auth.user
        ? auth.user.name
        : me && side !== me && state.opponent
          ? state.opponent
          : sideName(side);

  const strip = (side: Side) =>
    playerStrip({
      name: tên(side),
      bot: !state.names && Boolean(me && side !== me && state.opponent?.startsWith('Máy')),
      side,
      you: !state.shared && side === me,
      took: side === 'w' ? mat.whiteTook : mat.blackTook,
      diff: side === 'w' ? mat.diff : -mat.diff,
    });

  return `<div class="screen">
    <div class="screen-head play-head">
      <h1>${state.title}</h1>
      <span class="head-meta">${state.result}</span>
      ${toolbar([
        ...(state.shared ? [] : [iconButton('review', 'Ván đã chơi')]),
        iconButton('flip', 'Lật bàn cờ'),
      ])}
    </div>

    <div class="game">
      <div class="game-board">
        ${strip(topSide)}
        <div class="board-row">
          ${boardSvg({
            fen,
            orientation: or,
            lastMove: move ? [move.uci.slice(0, 2) as Square, move.uci.slice(2, 4) as Square] : undefined,
            ...boardMarks(r, ply),
            label: move ? `Thế cờ sau nước ${Math.ceil(ply / 2)}.${move.san}` : 'Thế cờ đầu ván',
          })}
        </div>
        ${strip(or)}
      </div>

      <div class="game-side">
        ${
          // Ván người khác chia sẻ: mời tự chơi, ở ngay đầu cột phải
          state.shared
            ? `<div class="share-banner"><p><b>Ván được chia sẻ trên Lật Cờ</b> — engine chấm từng nước, miễn phí.</p>
               <a class="btn btn-primary" href="/#/choi">Tự chơi một ván</a></div>`
            : ''
        }
        ${sheet(
          reviewPanel(r, {
            me,
            opponent: tên(opp),
            ply,
            meName: state.shared && me ? tên(me) : undefined,
          }),
          r.opening ? `<p class="opening-line">${r.opening.name}</p>` : '',
          moveList(
            r.moves.map((m) => ({ san: m.san, cls: m.cls })),
            ply,
          ),
          `<div class="move-bar">
            ${iconButton('first', 'Về đầu ván', { disabled: ply === 0 })}
            ${iconButton('prev', 'Lùi một nước', { disabled: ply === 0 })}
            ${iconButton('next', 'Tiến một nước', { disabled: ply >= r.moves.length })}
            ${iconButton('last', 'Tới nước mới nhất', { disabled: ply >= r.moves.length })}
          </div>`,
        )}
      </div>
    </div>
  </div>`;
}

/** Mở ra ở khoảnh khắc đầu tiên đáng xem (không có thì ở thế cờ cuối). */
function firstPly(r: ReviewResult, me: Side | null): number {
  return momentsOf(r, me)[0]?.ply ?? r.moves.length;
}

/* ---------------- Chấm ván chưa chấm ---------------- */

async function runReview(rerender: () => void): Promise<void> {
  state.phase = 'analysing';
  state.progress = { done: 0, total: 0 };
  state.error = null;
  cancelRequested = false;
  rerender();

  try {
    await loadOpenings();
    const result = await reviewGame(state.pgn, cachedAnalyser, {
      multipv: REVIEW_PV,
      onProgress: (done, total) => {
        state.progress = { done, total };
        if (done % 4 === 0 || done === total) rerender();
      },
      cancelled: () => cancelRequested,
    });
    state.review = result;
    state.ply = firstPly(result, state.playerSide);
    state.phase = 'done';
    if (state.gameId) await saveReview(state.gameId, result);
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

/** Vào màn: tới thẳng một ván qua địa chỉ (#/xem-lai?game=N), hoặc nạp danh sách. */
export function mountReview(rerender: () => void): void {
  const muốn = Number(routeQuery().get('game'));
  if (muốn && state.gameId !== muốn && state.phase !== 'loading' && state.phase !== 'analysing') {
    // #/xem-lai?game=N&ply=M: mở thẳng tới nước M (Huấn luyện viên "xem ví dụ")
    openGame(muốn, rerender, Number(routeQuery().get('ply')) || undefined);
    return;
  }
  if (state.phase === 'pick' && auth.user && !state.games.length) {
    void recentGames().then((games) => {
      if (!games.length) return;
      state.games = games;
      rerender();
    });
  }
}

/** Mở một ván đã lưu theo id. */
export function openGame(id: number, rerender: () => void, ply?: number): void {
  state.phase = 'loading';
  state.names = null;
  state.shared = false;
  state.gameId = id;
  state.title = '';
  state.result = '';
  rerender();
  void fetchGame(id).then((data) => {
    if (!data) {
      state.phase = 'error';
      state.error = 'Không mở được ván này';
      rerender();
      return;
    }
    const g = data.game;
    state.pgn = g.pgn;
    // Ván hai người thì không có "bên của mình": soi lỗi cả hai bên
    state.playerSide = g.mode === 'human' ? null : g.playerSide;
    state.orientation = g.playerSide;
    state.opponent =
      g.mode === 'bot' ? `Máy cấp ${g.level ?? '?'}` : g.mode === 'online' ? (g.opponentName ?? null) : null;
    state.title =
      g.mode === 'human' ? 'Hai người một máy' : `Với ${state.opponent ?? 'người chơi khác'}`;
    state.result = resultFor({ winner: g.winner, reason: g.reason as EndReason }, state.playerSide);
    if (data.review) {
      // Đã chấm rồi thì mở ra ngay, không chấm lại
      state.review = data.review;
      state.ply = ply && ply <= data.review.moves.length ? ply : firstPly(data.review, state.playerSide);
      state.phase = 'done';
      void loadOpenings().then(rerender);
      rerender();
    } else {
      void runReview(rerender);
    }
  });
}

export function handleReviewClick(target: HTMLElement, rerender: () => void): boolean {
  const pick = target.closest<HTMLElement>('[data-game]');
  if (pick) {
    location.hash = `#/xem-lai?game=${pick.dataset.game}`;
    return true;
  }

  const rp = target.closest<HTMLElement>('[data-report-ply], .move[data-ply]');
  if (rp && state.review) {
    state.ply = Number(rp.dataset.reportPly ?? rp.dataset.ply);
    rerender();
    return true;
  }

  const btn = target.closest<HTMLButtonElement>('button');
  if (!btn) return false;
  const label = btn.getAttribute('title') ?? btn.textContent?.trim() ?? '';
  const n = state.review?.moves.length ?? 0;

  const actions: Record<string, () => void> = {
    Dừng: () => {
      cancelRequested = true;
    },
    'Thử lại': () => void runReview(rerender),
    'Ván đã chơi': () => {
      state.phase = 'pick';
      state.review = null;
      state.gameId = null;
      state.title = '';
      state.result = '';
      if (location.hash !== '#/xem-lai') location.hash = '#/xem-lai';
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
      state.ply = Math.min(n, state.ply + 1);
    },
    'Tới nước mới nhất': () => {
      state.ply = n;
    },
  };

  const run = actions[label];
  if (!run) return false;
  run();
  rerender();
  return true;
}

/** Mở một ván ĐÃ chấm xong (ván được chia sẻ qua link). */
export function openReviewResult(o: {
  pgn: string;
  playerSide: Side | null;
  label: string;
  opponent: string | null;
  gameId: number | null;
  result: ReviewResult;
  ply?: number;
  names?: { w: string; b: string } | null;
  shared?: boolean;
}): void {
  state.names = o.names ?? null;
  state.shared = o.shared ?? false;
  state.phase = 'done';
  state.gameId = o.gameId;
  state.pgn = o.pgn;
  state.playerSide = o.playerSide;
  state.orientation = o.playerSide ?? 'w';
  const [title, ...rest] = o.label.split(' · ');
  state.title = title;
  state.result = rest.join(' · ');
  state.opponent = o.opponent;
  state.review = o.result;
  state.ply = o.ply ?? firstPly(o.result, o.playerSide);
}
