// Chơi với người qua mạng.
//
// Ba cảnh trên cùng một màn: chưa chơi (chọn thể thức, tìm trận hoặc mời bạn),
// đang chờ ghép, và đang đánh. Server là trọng tài — màn này chỉ gửi ý định
// lên rồi vẽ lại cái server trả về.
//
// Engine và Huấn luyện viên không có mặt ở đây, và server cũng từ chối nếu ai
// đó gọi thẳng API trong lúc đang có ván.

import { BoardView, PIECE_SLIDE_MS } from '../../board/BoardView.ts';
import { endBadgesFor } from '../../board/Board.ts';
import { createReporter, pgnFromSans, reportCard } from '../report.ts';
import { openReviewResult } from './review.ts';
import { saveReview } from '../../app/reviews.ts';
import { ownsSquare, premoveDests } from '../../../shared/premove.ts';
import { Game, outcomeText, type Side } from '../../../shared/chess.ts';
import { material, type Square } from '../../../shared/fen.ts';
import { CONTROLS, DEFAULT_CONTROL } from '../../../shared/protocol.ts';
import {
  button,
  clock,
  dialog,
  iconButton,
  moveList,
  notice,
  pieceGlyph,
  playerStrip,
  rule,
  sheet,
  sideGlyph,
  stats,
  toolbar,
} from '../components/index.ts';
import { auth } from '../../app/session.ts';
import { icon } from '../icons.ts';
import { setPlayMode } from '../../app/playmode.ts';
import { ping } from '../../app/ping.ts';
import { copyShareLink, createShareLink, downloadShareImage, shareStateFor, type ShareMeta } from '../../app/share.ts';
import { recentGames, type GameRow } from '../../app/games.ts';
import { playSound } from '../../app/sound.ts';
import {
  acceptDraw,
  clockNow,
  connect,
  createInvite,
  declineDraw,
  joinByCode,
  joinQueue,
  leaveQueue,
  live,
  loadStatus,
  offerDraw,
  resign,
  sendMove,
} from '../../app/live.ts';

const PROMOTION_PIECES = [
  ['q', 'Hậu'],
  ['r', 'Xe'],
  ['b', 'Tượng'],
  ['n', 'Mã'],
] as const;

let control = DEFAULT_CONTROL;
let inviteCode: string | null = null;
let pendingPromotion: { from: Square; to: Square } | null = null;
let confirmResign = false;
let view: BoardView | null = null;
/** Ván cục bộ chỉ để biết nước nào đi được; sự thật vẫn ở server. */
let board: Game | null = null;
let shownPly = -1;
let shownFen = '';
let recent: GameRow[] = [];
/** Lúc hỏi server danh sách ván gần nhất lần cuối. */
let recentAt = 0;
let started = false;
/** Nước đi trước, chờ đối thủ đi xong là gửi luôn. */
let premove: [Square, Square] | null = null;
let premoveTimer: number | null = null;

/**
 * Rời khỏi màn Đấu.
 *
 * Ván đã xong thì bỏ đi, để lần sau quay lại là thấy sảnh chứ không phải cái
 * bàn cờ cũ. Ván đang chơi thì giữ nguyên — đi xem chỗ khác rồi quay lại vẫn
 * phải thấy ván của mình.
 */
/** Bỏ nước đi trước đang chờ. */
function dropPremove(): void {
  premove = null;
  if (premoveTimer !== null) clearTimeout(premoveTimer);
  premoveTimer = null;
}

/**
 * Đi một nước ngay trên màn hình, không chờ server.
 *
 * Không có bước này thì thả quân xong, quân bật về ô cũ một nhịp rồi mới nhảy
 * sang ô mới khi server trả lời — trông như bị từ chối. Server vẫn là trọng
 * tài: gói tin tiếp theo của server đè lên, và nếu server từ chối thì nạp lại.
 */
function applyLocal(from: Square, to: Square, promotion?: string): boolean {
  const s = live.state;
  if (!s || s.over || s.turn !== s.youAre) return false;
  const g = new Game(s.fen);
  const m = g.move(from, to, promotion);
  if (!m) return false;
  const tôi = s.youAre;
  // Đồng hồ của mình dừng đúng chỗ đang chạy, của đối thủ bắt đầu chạy từ giờ
  const tôiCòn = clockNow(s, tôi);
  live.state = {
    ...s,
    fen: g.fen,
    history: [...s.history, m.san],
    turn: tôi === 'w' ? 'b' : 'w',
    lastMove: [from, to],
    drawOfferFrom: null,
    white: tôi === 'w' ? { ...s.white, clockMs: tôiCòn } : s.white,
    black: tôi === 'b' ? { ...s.black, clockMs: tôiCòn } : s.black,
    at: Date.now(),
  };
  return true;
}

function playMove(from: Square, to: Square, promotion: string | undefined, rerender: () => void): boolean {
  if (!applyLocal(from, to, promotion)) return false;
  void sendMove(from, to, promotion).then((r) => {
    // Server từ chối (hết giờ đúng lúc đó chẳng hạn): nạp lại sự thật từ server
    if (!r) void loadStatus().then(rerender);
  });
  return true;
}

/** Cập nhật đồng hồ tại chỗ, không dựng lại cả trang mỗi giây. */
function tickClocks(): void {
  const s = live.state;
  if (!s) return;
  for (const side of ['w', 'b'] as const) {
    const el = document.querySelector<HTMLElement>(`[data-clock="${side}"]`);
    if (!el) continue;
    const ms = clockNow(s, side);
    const st = s.over ? 'idle' : s.turn === side ? (ms < 30_000 ? 'low' : 'running') : 'idle';
    el.outerHTML = clock(ms, st, side);
  }
  const hạn = document.querySelector<HTMLElement>('[data-reconnect]');
  if (hạn && s.reconnectBy) {
    hạn.innerHTML = notice(`Đối thủ mất kết nối · còn ${giây(s.reconnectBy - Date.now())} giây để vào lại`, 'danger', 'clock');
  }
}

export function leaveOnline(): void {
  if (live.state?.over) {
    live.state = null;
    recentAt = 0;
  }
  pendingPromotion = null;
  confirmResign = false;
  shownPly = -1;
  shownFen = '';
  if (!live.state || live.state.over) dropPremove();
}

export function resetOnline(): void {
  recentAt = 0;
  inviteCode = null;
  pendingPromotion = null;
  confirmResign = false;
  shownPly = -1;
  shownFen = '';
}

/* ---------------- Vẽ ---------------- */

const sideName = (s: Side) => (s === 'w' ? 'Trắng' : 'Đen');
const giây = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

export function online(): string {
  if (!auth.user) return chưaĐăngNhập();
  if (live.state) return vánCờ();
  if (live.queue) return đangChờ();
  return sảnh();
}

function khung(body: string, meta: string, tools = ''): string {
  return `<div class="screen screen-narrow">
    <div class="screen-head">
      <h1>Chơi với người</h1>
      <span class="head-meta">${meta}</span>
      ${tools}
    </div>
    ${live.error ? notice(live.error, 'danger') : ''}
    ${body}
  </div>`;
}

function chưaĐăngNhập(): string {
  return khung(
    sheet(
      notice('Cần đăng nhập để chơi với người khác — server phải biết ai đang đánh với ai.', 'locked', 'user'),
      `<div class="row-actions">${button({ label: 'Tới trang đăng nhập', kind: 'primary', icon: 'user' })}</div>`,
    ),
    'ghép trận theo trình độ',
  );
}

/* ---------------- Cảnh 1: sảnh ---------------- */

function sảnh(): string {
  const r = auth.user?.gameRating ?? 1000;
  const chọn = Object.keys(CONTROLS)
    .map(
      (k) =>
        `<button class="chip${k === control ? ' is-on' : ''}" data-control="${k}" aria-pressed="${k === control}">${k}</button>`,
    )
    .join('');

  const vánCũ = recent.filter((g) => g.mode === 'online');

  return khung(
    `${sheet(
      `<div class="pick-row">
        <span class="pick-label">Thể thức</span>
        <div class="chips">${chọn}</div>
      </div>`,
      `<div class="row-actions">
        ${button({ label: 'Tìm trận', kind: 'primary', icon: 'play' })}
        ${button({ label: 'Mời người quen', icon: 'friends' })}
      </div>`,
      !live.connected ? notice('Chưa nối được tới server. Ván online cần server đang chạy.', 'danger') : '',
    )}

    ${
      inviteCode
        ? sheet(
            `<p class="muted">Gửi mã này cho người bạn muốn đánh cùng. Họ mở mục Chơi với người rồi nhập vào ô dưới.</p>
             <div class="invite"><code class="mono">${inviteCode}</code>${button({ label: 'Sao chép', icon: 'copy' })}</div>`,
          )
        : ''
    }

    ${rule('Có mã mời?')}
    ${sheet(
      `<div class="invite">
        <input class="code-input mono" id="join-code" maxlength="8" placeholder="VD: K7M2QP" aria-label="Mã mời" />
        ${button({ label: 'Vào ván', icon: 'play' })}
      </div>`,
    )}

    ${rule('Trình độ của bạn')}
    ${sheet(
      stats([
        ['Elo ván đấu', String(r)],
        ['Đã chơi', `${auth.user?.gameCount ?? 0} ván`],
      ]),
      `<p class="muted">Elo này tách khỏi điểm bài tập: giải bài tập và đánh cả ván là hai việc khác nhau.</p>`,
    )}

    ${rule('5 ván online gần nhất')}
    ${
      vánCũ.length
        ? sheet(`<div class="log">${vánCũ.slice(0, 5).map(dòngVán).join('')}</div>`)
        : sheet(`<p class="muted">Chưa có ván nào. Bấm “Tìm trận” để bắt đầu.</p>`)
    }`,
    `Elo ${r} · ${CONTROLS[control]?.label ?? control}`,
  );
}

function dòngVán(g: GameRow): string {
  const thắng = g.winner === 'draw' ? 'd' : g.winner === g.playerSide ? 'w' : 'l';
  const chữ = thắng === 'd' ? 'Hòa' : thắng === 'w' ? 'Thắng' : 'Thua';
  const đổi = g.ratingAfter !== null && g.ratingBefore !== null ? g.ratingAfter - g.ratingBefore : null;
  return `<a class="log-row" href="#/xem-lai?game=${g.id}">
    ${sideGlyph(g.playerSide)}
    <span class="log-name">${g.opponentName ?? 'Đối thủ'}</span>
    <span class="log-result result-${thắng}">${chữ}</span>
    ${đổi === null ? '' : `<span class="log-delta mono">${đổi > 0 ? `+${đổi}` : đổi}</span>`}
    <span class="log-when">${khiNào(g.createdAt)}</span>
  </a>`;
}

function khiNào(iso: string): string {
  const phút = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (phút < 60) return `${Math.max(1, phút)} phút trước`;
  const giờ = Math.round(phút / 60);
  if (giờ < 24) return `${giờ} giờ trước`;
  return `${Math.round(giờ / 24)} ngày trước`;
}

/* ---------------- Cảnh 2: đang chờ ghép ---------------- */

function đangChờ(): string {
  const q = live.queue!;
  const chờ = giây(q.waitedMs);
  const mộtMình = q.waiting <= 1;

  return khung(
    sheet(
      `<div class="searching">
        <span class="searching-dot" aria-hidden="true"></span>
        <b>Đang tìm trận ${CONTROLS[q.control]?.label ?? q.control}</b>
        <span class="mono">${chờ}s</span>
      </div>`,
      stats([
        ['Đang chờ cùng thể thức', `${q.waiting} người`],
        ['Chấp nhận lệch Elo', `±${q.band}`],
      ]),
      mộtMình
        ? notice(
            'Hiện chỉ có mình bạn trong hàng chờ. App này chạy trên một máy nên nhiều lúc sẽ không có ai — ' +
              'cứ để đó rồi làm việc khác, hoặc chơi với máy trong lúc chờ.',
            'info',
            'clock',
          )
        : `<p class="muted">Càng chờ thì khoảng Elo càng nới, nên sớm muộn cũng ghép được với người đang chờ.</p>`,
      `<div class="row-actions">
        ${button({ label: 'Hủy tìm', kind: 'danger' })}
        ${button({ label: 'Chơi với máy', icon: 'play' })}
      </div>`,
    ),
    `đã chờ ${chờ} giây`,
  );
}

/* ---------------- Cảnh 3: đang đánh ---------------- */

function vánCờ(): string {
  const s = live.state!;
  const tôi = s.youAre;
  const họ: Side = tôi === 'w' ? 'b' : 'w';
  const mat = material(s.fen);
  const xong = s.over !== null;
  const đếnLượtTôi = !xong && s.turn === tôi;

  const strip = (side: Side) => {
    const p = side === 'w' ? s.white : s.black;
    const ms = clockNow(s, side);
    return playerStrip({
      name: p.name,
      side,
      you: side === tôi,
      rating: p.rating,
      clockMs: ms,
      clockId: side,
      clockState: xong ? 'idle' : s.turn === side ? (ms < 30_000 ? 'low' : 'running') : 'idle',
      status: p.connected ? (xong ? undefined : s.turn === side ? 'đang nghĩ' : undefined) : 'mất kết nối',
      ai: Boolean(p.bot),
      took: side === 'w' ? mat.whiteTook : mat.blackTook,
      diff: side === 'w' ? mat.diff : -mat.diff,
    });
  };

  const đợiVàoLại =
    s.reconnectBy && !xong
      ? `<div data-reconnect>${notice(`Đối thủ mất kết nối · còn ${giây(s.reconnectBy - Date.now())} giây để vào lại`, 'danger', 'clock')}</div>`
      : '';

  const hòaĐangChờ =
    !xong && s.drawOfferFrom
      ? s.drawOfferFrom === tôi
        ? notice('Đã gửi đề nghị hòa, đang chờ đối thủ trả lời.', 'info', 'draw')
        : `<div class="draw-offer">${notice('Đối thủ đề nghị hòa.', 'info', 'draw')}
           <div class="row-actions">${button({ label: 'Đồng ý hòa', kind: 'primary' })}${button({ label: 'Từ chối' })}</div></div>`
      : '';

  // Đối thủ là AI: báo thật rõ ngay đầu cột phải, suốt ván — không giả làm người
  const đối = tôi === 'w' ? s.black : s.white;
  const aiBáo = đối.bot
    ? `<div class="ai-alert" role="status">
        <p class="ai-alert-head">${icon('engine', 18)}<b>Bạn đang đấu với AI</b></p>
        <p>${đối.name} · Elo ${đối.rating} — ${đối.bot.blurb}</p>
        <p class="ai-alert-note">Chưa có người chơi khác đang chờ nên AI vào thay. Ván vẫn tính Elo cho bạn.</p>
      </div>`
    : '';
  const lờiThoại = live.chat.length
    ? `<div class="bot-chat" aria-live="polite">${live.chat
        .slice(-3)
        .map((c) => `<p class="bot-line"><b>${c.name}</b><span>${c.text.replace(/[<>&]/g, '')}</span></p>`)
        .join('')}</div>`
    : '';

  return `<div class="screen">
    <div class="screen-head">
      <h1>Chơi với người</h1>
      <span class="head-meta">${s.control.label} · ${s.white.name}${s.white.bot ? ' (AI)' : ''} – ${s.black.name}${s.black.bot ? ' (AI)' : ''}</span>
      ${
        xong
          ? '' // Hai nút đã nằm trong ô kết quả, không bày lại ở đây
          : toolbar(
              [iconButton('flip', 'Lật bàn cờ', { disabled: true })],
              [
                button({ label: 'Đề nghị hòa', icon: 'draw', disabled: Boolean(s.drawOfferFrom) }),
                button({ label: 'Đầu hàng', kind: 'danger', icon: 'resign' }),
              ],
            )
      }
    </div>

    <div class="game">
      <div class="game-board">
        ${strip(họ)}
        <div class="board-row"><div id="board" class="board-host"></div></div>
        ${strip(tôi)}
      </div>

      <div class="game-side">
        ${sheet(
          live.error ? notice(live.error, 'danger') : '',
          live.connected ? '' : notice('Mất kết nối tới server, đang thử nối lại…', 'danger'),
          aiBáo,
          lờiThoại,
          đợiVàoLại,
          hòaĐangChờ,
          xong ? kếtQuả() : '',
          moveList(
            s.history.map((san) => ({ san })),
            s.history.length,
          ),
          xong
            ? ''
            : `<div class="locked-block">
                ${notice('Engine và Huấn luyện viên mở lại sau khi ván kết thúc.', 'locked', 'engine')}
              </div>`,
        )}
      </div>
    </div>

    ${
      pendingPromotion && đếnLượtTôi
        ? dialog(
            'Phong cấp thành quân gì?',
            `<div class="promo-row">${PROMOTION_PIECES.map(
              ([code, name]) =>
                `<button class="promo" data-promote="${code}" title="${name}">` +
                `${pieceGlyph(((tôi === 'w' ? 'w' : 'b') + code) as never, 'promo-piece')}<span>${name}</span></button>`,
            ).join('')}</div>`,
            button({ label: 'Hủy', kind: 'text' }),
          )
        : ''
    }
    ${
      confirmResign
        ? dialog(
            'Đầu hàng ván này?',
            '<p class="muted">Đối thủ được tính thắng và Elo của bạn sẽ giảm.</p>',
            `${button({ label: 'Đầu hàng', kind: 'danger' })}${button({ label: 'Đánh tiếp', kind: 'text' })}`,
          )
        : ''
    }
  </div>`;
}

/** Bảng chấm ván online, hiện ngay khi hết ván (xem src/ui/report.ts). */
const reporter = createReporter();

/** Tên đối thủ của mình trong ván đang xem. */
function đốiThủ(): string {
  const s = live.state!;
  return (s.youAre === 'w' ? s.black : s.white).name;
}

/**
 * Mở màn Xem lại với kết quả vừa chấm (không chấm lại). Ván online không có
 * nút tua trên bàn cờ đang đánh, nên bấm vào khoảnh khắc là sang thẳng màn
 * Xem lại, đúng nước đó.
 */
function mởXemLại(ply?: number): boolean {
  const s = live.state;
  if (!s?.over) return false;
  const pgn = pgnFromSans(s.history);
  const r = reporter.resultFor(pgn);
  if (!r) return false;
  openReviewResult({
    pgn,
    playerSide: s.youAre,
    label: `Đấu với ${đốiThủ()} · ${outcomeText({ winner: s.over.winner, reason: s.over.reason })}`,
    opponent: đốiThủ(),
    gameId: s.over.gameId,
    result: r,
    ply,
  });
  ping('report_detail');
  location.hash = '#/xem-lai';
  return true;
}

/** Thông tin ván online để chia sẻ. Đối thủ là AI thì ghi rõ "(AI)". */
function shareMetaOnline(): ShareMeta | null {
  const s = live.state;
  if (!s?.over) return null;
  const tên = (p: { name: string; bot?: unknown }) => (p.bot ? `${p.name} (AI)` : p.name);
  return {
    white: tên(s.white),
    black: tên(s.black),
    result: s.over.winner === 'draw' ? '½-½' : s.over.winner === 'w' ? '1-0' : '0-1',
    label: outcomeText({ winner: s.over.winner, reason: s.over.reason }),
    side: s.youAre,
  };
}

function kếtQuả(): string {
  const s = live.state!;
  const o = s.over!;
  const tôi = s.youAre;
  const đổi = tôi === 'w' ? o.whiteChange : o.blackChange;
  const mới = tôi === 'w' ? o.whiteRating : o.blackRating;
  const ai = o.winner === 'draw' ? 'Hòa' : o.winner === tôi ? 'Bạn thắng' : 'Bạn thua';

  return `<div class="online-result">
    <b class="result-head">${ai}</b>
    <span class="muted">${outcomeText({ winner: o.winner, reason: o.reason })}</span>
    ${stats([['Elo mới', `${mới} (${đổi > 0 ? `+${đổi}` : đổi})`]])}
    <div class="row-actions">
      ${
        // Có bảng chấm ngay bên dưới thì nút xem lại nằm trong bảng, khỏi lặp
        o.gameId && !reporter.current ? button({ label: 'Xem lại ván', kind: 'primary', icon: 'review' }) : ''
      }
      ${button({ label: 'Tìm trận mới', icon: 'play' })}
      ${button({ label: 'Về sảnh', kind: 'text' })}
    </div>
  </div>
  ${(() => {
    const cur = reporter.current;
    return cur && cur.pgn === pgnFromSans(s.history)
      ? reportCard(cur, { me: tôi, opponent: đốiThủ(), currentPly: s.history.length, share: shareStateFor(cur.pgn) })
      : '';
  })()}`;
}

/* ---------------- Gắn vào DOM ---------------- */

export function mountOnline(rerender: () => void): void {
  if (!auth.user) return;
  if (!started) {
    started = true;
    connect(rerender, tickClocks);
    void loadStatus().then(rerender);
  }
  // Chỉ hỏi lại khi đang ở sảnh, và cách lần trước một lúc. Hỏi một lần rồi
  // thôi thì đánh xong một ván quay về sẽ thấy sổ ván cũ mèm.
  if (!live.state && !live.queue && Date.now() - recentAt > 10_000) {
    recentAt = Date.now();
    void recentGames().then((g) => {
      recent = g;
      rerender();
    });
  }

  const s = live.state;
  const host = document.querySelector<HTMLElement>('#board');
  if (!s || !host) {
    view = null;
    board = null;
    return;
  }

  // Hết ván: chấm luôn, ngay tại chỗ. start() tự bỏ qua nếu ván này đã/đang chấm.
  if (s.over) {
    const gameId = s.over.gameId;
    reporter.start(pgnFromSans(s.history), rerender, (r) => {
      // Lưu kết quả cùng ván (sinh thẻ ôn tập từ nước sai), lần sau mở ra là có ngay
      if (gameId) void saveReview(gameId, r);
    });
  }

  // Ván cục bộ chỉ dùng để tô ô đi được. Dựng lại mỗi khi thế cờ đổi.
  if (shownFen !== s.fen) board = new Game(s.fen);
  const tôiĐi = !s.over && s.turn === s.youAre;

  view = new BoardView(host, {
    id: 'online',
    legalFrom: (from) => (tôiĐi && board ? board.legalFrom(from) : { quiet: [], captures: [] }),
    canPick: (sq) => {
      if (!tôiĐi || !board) return false;
      const l = board.legalFrom(sq);
      return l.quiet.length + l.captures.length > 0;
    },
    onMove: (from, to) => {
      if (!tôiĐi || !board) return false;
      if (board.needsPromotion(from, to)) {
        pendingPromotion = { from, to };
        rerender();
        return true;
      }
      if (!playMove(from, to, undefined, rerender)) return false;
      rerender();
      return true;
    },
    premove: {
      active: () => Boolean(live.state && !live.state.over && live.state.turn !== live.state.youAre),
      canPick: (sq) => Boolean(live.state && ownsSquare(live.state.fen, sq, live.state.youAre)),
      dests: (from) => (live.state ? premoveDests(live.state.fen, from) : []),
      set: (from, to) => {
        premove = [from, to];
      },
      clear: dropPremove,
    },
  });

  // Tới lượt mình mà có nước đi trước: đợi nước của đối thủ trượt xong rồi đi.
  // Tốn của mình chừng ấy thời gian trên đồng hồ (chess.com tính 0,1 giây), đổi
  // lại hai quân không trượt chồng lên nhau.
  if (s.over) dropPremove();
  else if (s.turn === s.youAre && premove && premoveTimer === null) {
    premoveTimer = window.setTimeout(() => {
      premoveTimer = null;
      const pm = premove;
      premove = null;
      // Lúc chọn chưa biết đối thủ đi gì; giờ mới hỏi luật thật, sai thì bỏ
      if (pm) playMove(pm[0], pm[1], undefined, rerender);
      rerender();
    }, PIECE_SLIDE_MS);
  }

  // Trượt quân khi vừa có thêm đúng một nước
  const thêmMộtNước = s.history.length === shownPly + 1 && s.lastMove;
  if (s.history.length !== shownPly) {
    const cuối = s.history[s.history.length - 1];
    if (cuối && shownPly >= 0) playSound(cuối.includes('x') ? 'capture' : 'move');
    if (s.over && shownPly >= 0) playSound('end');
  }
  shownPly = s.history.length;
  shownFen = s.fen;

  view.render(
    {
      fen: s.fen,
      orientation: s.youAre,
      lastMove: s.lastMove ?? undefined,
      check: s.over ? undefined : (board?.checkedKing ?? undefined),
      premove: premove ?? undefined,
      // Hết ván: vương miện cho bên thắng, dấu # / lá cờ / đồng hồ cho bên thua
      endBadges: s.over ? endBadgesFor(s.fen, s.over) : undefined,
      label: `Bàn cờ, lượt ${sideName(s.turn)}`,
    },
    thêmMộtNước ? s.lastMove! : undefined,
  );
}

/* ---------------- Bấm nút ---------------- */

export function handleOnlineClick(target: HTMLElement, rerender: () => void): boolean {
  // Chia sẻ ván
  if (target.closest('[data-share-create], [data-share-image]')) {
    const s = live.state;
    const pgn = s ? pgnFromSans(s.history) : '';
    const r = reporter.resultFor(pgn);
    const meta = shareMetaOnline();
    if (r && meta) {
      if (target.closest('[data-share-create]')) void createShareLink(pgn, r, meta, rerender);
      else void downloadShareImage(r, meta);
    }
    return true;
  }
  if (target.closest('[data-share-copy]')) {
    void copyShareLink(rerender);
    return true;
  }

  // Bảng chấm ván: bấm ô nhịp ván / khoảnh khắc -> sang Xem lại đúng nước đó
  const rp = target.closest<HTMLElement>('[data-report-ply]');
  if (rp) {
    mởXemLại(Number(rp.dataset.reportPly));
    rerender();
    return true;
  }

  if (target.closest('[data-invite]')) {
    void createInvite(control).then((r) => {
      if (r) inviteCode = r.code;
      rerender();
    });
    return true;
  }

  const chip = target.closest<HTMLElement>('[data-control]');
  if (chip) {
    control = chip.dataset.control!;
    inviteCode = null;
    rerender();
    return true;
  }

  const promo = target.closest<HTMLElement>('[data-promote]');
  if (promo && pendingPromotion) {
    const { from, to } = pendingPromotion;
    pendingPromotion = null;
    playMove(from, to, promo.dataset.promote, rerender);
    rerender();
    return true;
  }

  const btn = target.closest<HTMLButtonElement>('button');
  if (!btn) return false;
  const nhãn = (btn.textContent ?? '').trim();

  const việc: Record<string, () => void> = {
    'Tìm trận': () => {
      ping('online_queue');
      void joinQueue(control);
    },
    'Tìm trận mới': () => {
      live.state = null;
      resetOnline();
      void joinQueue(control);
    },
    'Hủy tìm': () => void leaveQueue(),
    'Chơi với máy': () => {
      void leaveQueue();
      setPlayMode('machine');
      location.hash = '#/choi';
    },
    // Ván xong: về sảnh online của tab Chơi (bàn cờ trống, chọn thời gian lại)
    'Về sảnh': () => {
      live.state = null;
      resetOnline();
    },
    'Mời người quen': () =>
      void createInvite(control).then((r) => {
        if (r) inviteCode = r.code;
        rerender();
      }),
    'Sao chép': () => {
      if (inviteCode) void navigator.clipboard?.writeText(inviteCode).catch(() => {});
    },
    'Vào ván': () => {
      const ô = document.querySelector<HTMLInputElement>('#join-code');
      if (ô?.value.trim()) void joinByCode(ô.value.trim());
    },
    'Đề nghị hòa': () => void offerDraw(),
    'Đồng ý hòa': () => void acceptDraw(),
    'Từ chối': () => void declineDraw(),
    'Đầu hàng': () => {
      if (confirmResign) {
        confirmResign = false;
        void resign();
      } else {
        confirmResign = true;
      }
    },
    'Đánh tiếp': () => {
      confirmResign = false;
    },
    Hủy: () => {
      pendingPromotion = null;
    },
    'Xem lại ván': () => {
      if (mởXemLại()) return;
      const id = live.state?.over?.gameId;
      if (id) location.hash = `#/xem-lai?game=${id}`;
    },
    'Xem lại chi tiết': () => {
      if (mởXemLại()) return;
      const id = live.state?.over?.gameId;
      if (id) location.hash = `#/xem-lai?game=${id}`;
    },
    'Tới trang đăng nhập': () => {
      location.hash = '#/tai-khoan';
    },
  };

  const chạy = việc[nhãn];
  if (!chạy) return false;
  chạy();
  rerender();
  return true;
}

/* ---------------- Trong tab Chơi (chế độ "Với người") ---------------- */

/** Tên gọi nhịp ván, hiện dưới con số thời gian (phút + giây cộng mỗi nước). */
const TC_NAME: Record<string, string> = { '3+2': 'Chớp', '5+0': 'Nhanh', '10+0': 'Vừa', '15+10': 'Thong thả' };

/** Đang có ván online (đang đánh, hoặc vừa xong mà chưa rời) — tab Chơi hiện ván đó. */
export function hasLiveGame(): boolean {
  return Boolean(auth.user && live.state);
}

/**
 * Cột phải của tab Chơi khi chọn "Với người", lúc chưa vào ván: sảnh gọn
 * (thời gian, tìm trận, mã mời) hoặc đang chờ ghép. Bàn cờ bên trái vẫn là
 * bàn cờ của tab Chơi, nên chuyển qua lại hai chế độ không bị nhảy trang.
 */
export function onlinePanel(modeTabs: string): string {
  if (!auth.user) {
    return `<div class="setup">
      ${modeTabs}
      <div class="bot-card">
        <span class="bot-face">${icon('friends', 30)}</span>
        <span class="bot-text"><b>Đấu với người</b><span>Ghép với người cùng trình độ, có Elo</span></span>
      </div>
      <p class="prose">Đăng nhập để được ghép trận — server cần biết ai đang đánh với ai.</p>
      <div class="google-btn google-slot"></div>
      <p id="login-error" class="notice notice-danger" hidden></p>
    </div>`;
  }

  if (live.queue) {
    const q = live.queue;
    const mộtMình = q.waiting <= 1;
    return `<div class="setup">
      ${modeTabs}
      <div class="searching">
        <span class="searching-dot" aria-hidden="true"></span>
        <b>Đang tìm trận ${CONTROLS[q.control]?.label ?? q.control}</b>
        <span class="mono">${giây(q.waitedMs)}s</span>
      </div>
      ${stats([
        ['Đang chờ cùng thể thức', `${q.waiting} người`],
        ['Chấp nhận lệch Elo', `±${q.band}`],
      ])}
      ${notice(
        mộtMình
          ? 'Chưa có ai khác đang chờ. Sau 5 giây, một AI cùng trình độ sẽ vào đấu với bạn.'
          : 'Không ghép được người trong 5 giây thì một AI cùng trình độ sẽ vào thay.',
        'info',
        'engine',
      )}
      ${button({ label: 'Hủy tìm', kind: 'danger', full: true })}
    </div>`;
  }

  const r = auth.user.gameRating;
  const chọn = Object.keys(CONTROLS)
    .map(
      (k) =>
        `<button class="lv tc${k === control ? ' is-active' : ''}" data-control="${k}" aria-pressed="${k === control}">` +
        `<b>${k}</b><span>${TC_NAME[k] ?? ''}</span></button>`,
    )
    .join('');
  return `<div class="setup">
    ${modeTabs}
    <div class="bot-card">
      <span class="bot-face">${
        auth.user.avatar
          ? `<img src="${auth.user.avatar}" alt="" width="52" height="52" referrerpolicy="no-referrer">`
          : icon('friends', 30)
      }</span>
      <span class="bot-text"><b>Elo ${r}</b><span>${auth.user.gameCount} ván online · ghép người cùng trình độ</span></span>
    </div>
    <div class="setup-block">
      <p class="setup-label">Thời gian mỗi bên</p>
      <div class="tc-row" role="group" aria-label="Thời gian">${chọn}</div>
    </div>
    ${button({ label: 'Tìm trận', kind: 'primary', icon: 'play', full: true })}
    ${
      inviteCode
        ? `<div class="invite-box">
             <p class="setup-label">Gửi mã này cho bạn của bạn</p>
             <div class="invite"><code class="mono">${inviteCode}</code>${button({ label: 'Sao chép', icon: 'copy' })}</div>
           </div>`
        : `<button class="link-btn" data-invite>Mời người quen bằng mã</button>`
    }
    <div class="setup-block">
      <p class="setup-label">Có mã mời?</p>
      <div class="invite">
        <input class="code-input mono" id="join-code" maxlength="8" placeholder="VD: K7M2QP" aria-label="Mã mời" />
        ${button({ label: 'Vào ván', icon: 'play' })}
      </div>
    </div>
    ${live.error ? notice(live.error, 'danger') : ''}
    ${!live.connected ? notice('Đang nối tới server…', 'info', 'clock') : ''}
  </div>`;
}

/** Rời sảnh online (chuyển sang chế độ Với máy): bỏ hàng chờ nếu đang chờ. */
export function leaveOnlineMode(): void {
  if (live.queue) void leaveQueue();
  leaveOnline();
}
