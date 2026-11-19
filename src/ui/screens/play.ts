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
import { playMode, setPlayMode } from '../../app/playmode.ts';
import { ping } from '../../app/ping.ts';
import { copyShareLink, createShareLink, downloadShareImage, shareStateFor, type ShareMeta } from '../../app/share.ts';
import { leaveOnlineMode, onlinePanel, onlineQuick } from './online.ts';
import { icon, type IconName } from '../icons.ts';
import type { ReviewResult } from '../../analysis/review.ts';
import { saveReview } from '../../app/reviews.ts';
import { boardMarks, createReporter, endClickable, endDialog, endSummary, reviewPanel, reviewProgress } from '../report.ts';
import { dropBackground, preAnalyse } from '../../analysis/precompute.ts';
import { bestGain, HOLD_ON, judgeMove, lineText, type AssistVerdict } from '../../analysis/assist.ts';
import { sanVi } from '../../analysis/words.ts';
import { IS_MINI } from '../../app/mini.ts';
import { setPref } from '../../app/prefs.ts';
import { CLASS_LABEL } from '../../board/Board.ts';
import type { Arrow, Circle } from '../../board/Board.ts';
import { invalidateCoach } from '../../app/coach.ts';
import { buildFacts } from '../../../shared/advisor/facts.ts';
import { detectMotifs } from '../../../shared/advisor/motifs.ts';
import { hintSteps } from '../../../shared/advisor/templates.ts';
import {
  button,
  classBadge,
  hintLabel,
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

/**
 * Trợ lý (chỉ chơi với máy): chấm nước bạn vừa đi trong lúc máy nghĩ. Đi hỏng
 * (sai, sai nghiêm trọng, bỏ lỡ) thì máy KHÔNG đáp mà dừng lại chờ: "Có nước tốt
 * hơn". Bấm xem thì Trợ lý hướng dẫn trên bàn cờ theo từng bước.
 */
interface AssistState {
  /** Đang chấm nước thứ mấy, và lời hứa kết quả (máy đợi nó trước khi đáp). */
  ply: number;
  pending: Promise<AssistVerdict | null> | null;
  verdict: AssistVerdict | null;
  /** Máy đang dừng chờ người chơi chọn. */
  held: boolean;
  /** Đang xem bước hướng dẫn thứ mấy (null là chưa mở hướng dẫn). */
  step: number | null;
}
let assist: AssistState = { ply: 0, pending: null, verdict: null, held: false, step: null };
const assistOn = () => setup.mode === 'bot' && prefs().assist && !IS_MINI;
function resetAssist(): void {
  assist = { ply: 0, pending: null, verdict: null, held: false, step: null };
}

/** Bắt đầu chấm nước người chơi vừa đi (chạy song song với máy nghĩ). */
function startJudge(rerender: () => void): void {
  const last = game.lastMove;
  if (!last) return;
  const ply = game.length;
  const fenBefore = ply >= 2 ? game.history[ply - 2].fen : START_FEN;
  const p = judgeMove(fenBefore, last.uci, ply).catch(() => null);
  assist = { ply, pending: p, verdict: null, held: false, step: null };
  void p.then((v) => {
    if (assist.ply !== ply) return;
    assist.verdict = v;
    rerender();
  });
}

/** Các bước hướng dẫn cho nước vừa hỏng: vấn đề → nước tốt hơn → rồi sao. */
function guideSteps(v: AssistVerdict): { title: string; text: string; arrows: Arrow[]; circles: Circle[] }[] {
  const from = v.uci.slice(0, 2) as Square;
  const to = v.uci.slice(2, 4) as Square;
  const steps: { title: string; text: string; arrows: Arrow[]; circles: Circle[] }[] = [
    {
      title: 'Vấn đề',
      text:
        `Bạn đi ${sanVi(v.san)}. ${v.why}` + (v.before !== v.after ? ` Thế cờ của bạn: ${v.before} → ${v.after}.` : ''),
      arrows: [{ from, to, brush: 'r' as const }],
      circles: v.motif?.square ? [{ square: v.motif.square, brush: 'r' as const }] : [],
    },
  ];
  if (v.best) {
    steps.push({
      title: 'Nước tốt hơn',
      text: `Nên đi ${sanVi(v.best.san)} — ${bestGain(v)}.`,
      arrows: [{ from: v.best.uci.slice(0, 2) as Square, to: v.best.uci.slice(2, 4) as Square, brush: 'g' as const }],
      circles: [],
    });
    if (v.line.length > 1) {
      steps.push({
        title: 'Rồi sao',
        text: `Sau ${sanVi(v.best.san)}: ${lineText(v)}.`,
        arrows: v.line.map((x, i) => ({
          from: x.uci.slice(0, 2) as Square,
          to: x.uci.slice(2, 4) as Square,
          brush: (x.side === v.side ? 'g' : 'r') as 'g' | 'r',
          label: String(i + 1),
        })),
        circles: [],
      });
    }
  }
  return steps;
}

/** Khối Trợ lý ở đầu cột phải, trong ván với máy. */
function assistCard(): string {
  if (!assistOn() || !started || outcome()) return '';
  const v = assist.verdict;
  const đổi = `<span class="assist-actions">` +
    `${button({ label: 'Đi nước gợi ý', kind: 'primary' })}${button({ label: 'Tự đi lại' })}${button({ label: 'Bỏ qua', kind: 'text' })}</span>`;
  if (assist.held && v) {
    if (assist.step === null) {
      return `<div class="assist is-held" role="status">
        <p class="assist-head">${icon('coach', 18)}<b>Có nước tốt hơn</b>${classBadge(v.cls)}<span>${CLASS_LABEL[v.cls]}</span></p>
        <p class="assist-text">${v.why}</p>
        <span class="assist-actions">${button({ label: 'Xem hướng dẫn', kind: 'primary', icon: 'coach' })}${button({ label: 'Tự đi lại' })}${button({ label: 'Bỏ qua', kind: 'text' })}</span>
      </div>`;
    }
    const steps = guideSteps(v);
    const i = Math.min(assist.step, steps.length - 1);
    const s = steps[i];
    return `<div class="assist is-guide" role="status">
      <p class="assist-head">${icon('coach', 18)}<b>Trợ lý</b><span class="assist-step">Bước ${i + 1}/${steps.length} · ${s.title}</span>
        ${iconButton('prev', 'Bước trước', { disabled: i === 0 })}${iconButton('next', 'Bước sau', { disabled: i >= steps.length - 1 })}</p>
      <p class="assist-text">${s.text}</p>
      ${đổi}
    </div>`;
  }
  // Không dừng: chỉ báo nhẹ nước vừa rồi
  if (assist.pending && !v && assist.ply === game.length) {
    return `<p class="assist-line">${icon('coach', 16)}<span>Trợ lý đang xem…</span></p>`;
  }
  if (v && v.ply <= game.length) {
    const tốt = !HOLD_ON.includes(v.cls) && v.cls !== 'inaccuracy';
    return `<p class="assist-line">${classBadge(v.cls)}<span>${sanVi(v.san)} — <b>${CLASS_LABEL[v.cls].toLowerCase()}</b>${
      !tốt && v.best ? ` · hay hơn là ${sanVi(v.best.san)}` : ''
    }</span></p>`;
  }
  return '';
}

/** Bàn cờ lúc đang xem hướng dẫn: thế cờ TRƯỚC nước hỏng, mũi tên và khoanh ô của bước đó. */
function guideBoard(): { fen: string; arrows: Arrow[]; circles: Circle[] } | null {
  const v = assist.verdict;
  if (!assist.held || assist.step === null || !v) return null;
  const steps = guideSteps(v);
  const s = steps[Math.min(assist.step, steps.length - 1)];
  return { fen: v.fenBefore, arrows: s.arrows, circles: s.circles };
}

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
  // Lưu xong thì máy chủ tính lại nhận xét: quên số cũ của Huấn luyện viên
  void saveReview(savedGameId, r).then(() => invalidateCoach());
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
// Trợ lý đang dừng máy lại (người chơi vừa đi hỏng) thì chưa tới lượt máy: không thì
// mỗi lần vẽ lại màn hình, mountPlay lại gọi máy nghĩ — lặp mãi.
const isBotTurn = () => setup.mode === 'bot' && game.turn === botSide() && !ended && game.atLive && !assist.held;

/** Hộp thoại hết ván: đã đóng chưa, bắt đầu hiện lúc nào (để hiệu ứng chạy đúng một lần). */
let endClosed = false;
let endShownAt: number | null = null;
const endShownMs = () => (endShownAt === null ? 0 : performance.now() - endShownAt);

function newGame(): void {
  endClosed = false;
  endShownAt = null;
  void engine().cancel();
  dropBackground();
  resetAssist();
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
/**
 * Hai chế độ của tab Chơi, ở ngay đầu cột phải: đánh với máy hay đấu với người.
 * Trước đây là hai tab riêng (Chơi / Đấu) — cùng là "vào chơi một ván", tách ra
 * chỉ bắt người chơi đi tìm.
 */
function modeTabs(): string {
  const m = playMode();
  const tab = (id: 'machine' | 'online', label: string) =>
    `<button class="mode-tab${m === id ? ' is-active' : ''}" data-play-mode="${id}" aria-pressed="${m === id}">` +
    `<span>${label}</span></button>`;
  return `<div class="mode-tabs" role="group" aria-label="Chế độ chơi">${tab('machine', 'Với máy')}${tab('online', 'Với người')}</div>`;
}

function setupPanel(): string {
  if (playMode() === 'online') return onlinePanel(modeTabs());
  if (setup.mode === 'human') {
    return `<div class="setup">
      ${modeTabs()}
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
      ['r', 'Ngẫu nhiên', icon('random', 20)],
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
      ${modeTabs()}
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
      <button class="pref-row assist-toggle" data-pref="assist" role="switch" aria-checked="${prefs().assist}">
        <span class="pref-text"><b>Trợ lý</b><span>Dừng lại chỉ khi bạn đi hỏng</span></span>
        <span class="switch${prefs().assist ? ' is-on' : ''}" aria-hidden="true"><i></i></span>
      </button>
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
  const nhãnGợiÝ = hintLoading ? 'Đang xem…' : hintLabel(hintLevel);
  return `<div class="game-actions">
    ${
      setup.mode === 'bot'
        ? act('hint', 'hint', nhãnGợiÝ, {
            disabled: hintLevel === 3 || hintLoading || !game.atLive,
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
      ${button({ label: 'Chơi lại', kind: 'primary', icon: 'play' })}
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

  // Chế độ "Với người" mà chưa vào ván: bàn cờ trống, phía trên là đối thủ chưa biết
  const chờNgười = playMode() === 'online' && !started;
  const strip = (side: Side, tools?: string) => {
    const isBot = !chờNgười && setup.mode === 'bot' && side === botSide();
    return playerStrip({
      // Đấu với máy thì bên mình mang tên mình, không phải chữ "Trắng"
      name: chờNgười
        ? side === orientation
          ? (auth.user?.name ?? 'Bạn')
          : 'Đối thủ'
        : isBot
          ? `Máy ${levelById(setup.level).name.toLowerCase()}`
          : setup.mode === 'bot' && side === setup.side && auth.user
            ? auth.user.name
            : sideName(side),
      side,
      avatar: !isBot && setup.mode === 'bot' && side === setup.side ? auth.user?.avatar : null,
      // Elo cạnh tên như mọi trang cờ: máy theo cấp (cấp thấp ước chừng), mình theo Elo online
      rating: chờNgười
        ? side === orientation
          ? auth.user?.gameRating
          : undefined
        : isBot
          ? (levelById(setup.level).elo ?? `~${BOT_RATING[setup.level] ?? 1000}`)
          : setup.mode === 'bot' && side === setup.side
            ? auth.user?.gameRating
            : undefined,
      bot: isBot,
      you: setup.mode === 'bot' && side === setup.side,
      status: !started
        ? undefined
        : thinking && isBot
          ? 'đang nghĩ…'
          : assist.held && side === botSide()
            ? 'đang đợi bạn'
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
        // Chưa vào ván: chỉ ghi "Chơi" — hai nút Với máy / Với người ngay bên
        // dưới đã nói rõ chế độ, ghi lại ở đây là thừa
        !started
          ? 'Chơi'
          : setup.mode === 'human'
            ? 'Hai người một máy'
            : `Máy ${levelById(setup.level).name.toLowerCase()}`
      }</span>
      ${toolbar([
        // Bàn cờ nổi: cửa sổ nhỏ chỉ có bàn cờ (máy tính; cả với máy lẫn với người)
        iconButton('float', 'Bàn cờ nổi').replace('class="btn btn-icon"', 'class="btn btn-icon only-mouse"'),
        iconButton('flip', 'Lật bàn cờ'),
        ...(started && setup.mode === 'bot' ? [iconButton('coach', 'Trợ lý', { pressed: prefs().assist })] : []),
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
          `<span class="only-narrow">${iconButton('float', 'Bàn cờ nổi').replace('class="btn btn-icon"', 'class="btn btn-icon only-mouse"')}${iconButton('flip', 'Lật bàn cờ')}</span>`,
        )}
        ${started ? '' : quickStart()}
      </div>

      <div class="game-side">
        ${
          !started
            ? sheet(setupPanel())
            : sheet(
                ...(result ? [endClosed ? resultCard(result) : '', reviewBlock()] : []),
                assistCard(),
                khaiCuoc(),
                game.length
                  ? moveList(
                      game.history.map((m, i) => ({ san: m.san, cls: reviewed()?.moves[i]?.cls })),
                      game.ply,
                    )
                  : '<p class="muted moves-empty">Chưa có nước nào.</p>',
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

    ${promoDialog()}
    ${result && !IS_MINI ? resultModal(result) : ''}
  </div>`;
}

/** Elo ước chừng của cấp 1–3 (không đặt Elo cho engine, nên chỉ để hiện cạnh tên). */
const BOT_RATING: Record<number, number> = { 1: 400, 2: 700, 3: 1000 };

const PICK_NAME: Record<Pick, string> = { w: 'cầm Trắng', b: 'cầm Đen', r: 'bên ngẫu nhiên' };

/**
 * Điện thoại và máy tính bảng: nút Chơi và các lối tắt nằm NGAY DƯỚI bàn cờ (như
 * chess.com), không bắt cuộn qua cả bảng tuỳ chọn mới thấy chỗ bấm chơi. Một dòng
 * tóm tắt đang chọn gì; muốn đổi thì "Tuỳ chọn" cuộn xuống bảng đầy đủ. Nằm trong
 * .game-board nên src/board/snap.ts tính luôn chiều cao của nó khi chia chỗ cho bàn cờ.
 * Máy tính: ẩn (bảng tuỳ chọn và nút Chơi đã nằm sẵn ở cột phải, ngang tầm mắt).
 */
function quickStart(): string {
  const online = playMode() === 'online';
  const q = online ? onlineQuick() : null;
  const tómTắt = online
    ? (q?.sum ?? 'Đăng nhập để ghép trận với người')
    : setup.mode === 'human'
      ? 'Hai người một máy'
      : `Máy ${levelById(setup.level).name.toLowerCase()} · ${PICK_NAME[setup.pick]}${prefs().assist ? ' · có Trợ lý' : ''}`;
  // Nút chính mang luôn dòng tóm tắt ở dòng dưới: bấm là biết mình vào ván gì
  const chính = (label: string, kind: 'primary' | 'danger') =>
    `<button class="btn btn-${kind} btn-full qs-play" data-label="${label}"><b>${label}</b><small>${tómTắt}</small></button>`;
  const nút = online
    ? q
      ? chính(q.label, q.label === 'Hủy tìm' ? 'danger' : 'primary')
      : `<p class="qs-sum">${tómTắt}</p>`
    : chính('Chơi', 'primary');
  const tắt = (attrs: string, name: IconName, label: string) =>
    `<${attrs.startsWith('href') ? 'a' : 'button'} class="gb-act" ${attrs}>${icon(name, 22)}<span>${label}</span></${attrs.startsWith('href') ? 'a' : 'button'}>`;
  return `<div class="quick-start only-narrow">
    ${nút}
    <div class="gb-acts qs-acts">
      ${tắt('data-qs-options', 'settings', 'Tuỳ chọn')}
      ${online ? tắt('data-play-mode="machine"', 'engine', 'Với máy') : tắt('data-play-mode="online"', 'friends', 'Với người')}
      ${tắt('href="#/on-tap"', 'cards', 'Bài tập')}
      ${tắt('href="#/xem-lai"', 'review', 'Ván đã chơi')}
    </div>
  </div>`;
}

/** Hộp thoại hết ván (với máy, hai người một máy). */
function resultModal(result: Outcome): string {
  if (endClosed) return '';
  const bot = setup.mode === 'bot';
  const mine = bot && result.winner !== 'draw';
  const won = mine && result.winner === setup.side;
  const [who, why] = outcomeText(result).split(' · ');
  const sum = endSummary(reporter.current, game.pgn(), bot ? setup.side : null);
  endShownAt ??= performance.now();
  return endDialog({
    title: !mine ? who : won ? 'Bạn thắng' : 'Bạn thua',
    tone: !mine ? 'draw' : won ? 'win' : 'loss',
    why: bot ? `${why} · Máy ${levelById(setup.level).name.toLowerCase()}` : why,
    body: sum.html,
    actions:
      `<button class="btn btn-primary btn-full" data-end-review="${sum.ply}">Xem lại ván</button>` +
      `<div class="end-row">${button({ label: 'Chơi lại' })}${button({ label: 'Ván mới' })}</div>`,
    shownMs: endShownMs(),
  });
}

/**
 * Thanh điều khiển ván ở đáy màn điện thoại, thay thanh điều hướng trong lúc
 * đang đánh (như chess.com): hàng việc (Gợi ý, Đi lại, Trợ lý, Đầu hàng) và hàng
 * tua nước to. Hết ván thì trả lại thanh điều hướng. Trên máy tính CSS ẩn đi.
 */
export function playBar(): string {
  if (!started || outcome() || IS_MINI) return '';
  const bot = setup.mode === 'bot';
  const act = (id: string, name: IconName, label: string, o: { disabled?: boolean; danger?: boolean } = {}) =>
    `<button class="gb-act${o.danger ? ' is-danger' : ''}" data-act="${id}"${o.disabled ? ' disabled' : ''}>` +
    `${icon(name, 22)}<span>${label}</span></button>`;
  const gợiÝ = bot && hints && hintLevel > 0 && game.atLive ? hints[hintLevel - 1] : '';
  return `<nav class="nav game-bar" aria-label="Điều khiển ván">
    ${gợiÝ ? `<p class="gb-hint" role="status">${gợiÝ}</p>` : ''}
    <div class="gb-acts">
      ${
        bot
          ? act('hint', 'hint', hintLoading ? 'Đang xem…' : hintLabel(hintLevel), {
              disabled: hintLevel === 3 || hintLoading || !game.atLive,
            })
          : act('flip', 'flip', 'Lật bàn')
      }
      ${act('undo', 'undo', 'Đi lại', { disabled: game.length === 0 || thinking })}
      ${bot ? `<button class="gb-act" title="Trợ lý" aria-pressed="${prefs().assist}">${icon('coach', 22)}<span>Trợ lý</span></button>` : ''}
      ${act('resign', 'resign', resignArmed ? 'Chắc chưa?' : 'Đầu hàng', { danger: resignArmed, disabled: game.length === 0 })}
    </div>
    <div class="gb-nav">
      ${iconButton('first', 'Về đầu ván', { disabled: game.ply === 0 })}
      ${iconButton('prev', 'Lùi một nước', { disabled: game.ply === 0 })}
      ${iconButton('next', 'Tiến một nước', { disabled: game.atLive })}
      ${iconButton('last', 'Tới nước mới nhất', { disabled: game.atLive })}
    </div>
  </nav>`;
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
  // Chấm ngầm từng thế cờ ngay trong lúc chơi (engine riêng), hết ván là có kết quả
  if (started) preAnalyse(fensOfGame());
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
  if (!started || !game.atLive || ended || thinking || assist.held) return false;
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
  const hd = guideBoard();
  if (hd) {
    view?.render({ fen: hd.fen, orientation, arrows: hd.arrows, circles: hd.circles, label: 'Bàn cờ, Trợ lý đang hướng dẫn' });
    return;
  }
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
      // Trợ lý đang dừng máy: nhãn ?? ngay trên quân vừa đi hỏng
      ...(assist.held && assist.verdict && game.atLive
        ? { badge: { square: assist.verdict.uci.slice(2, 4) as Square, cls: assist.verdict.cls } }
        : {}),
      label: `Bàn cờ, lượt ${sideName(game.turn)}`,
    },
    stepped ? [last.from, last.to] : undefined,
  );
}

function afterMove(rerender: () => void): void {
  const result = outcome();
  const last = game.lastMove!;
  if (assistOn() && !result) startJudge(rerender);
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
    // Trợ lý: đợi chấm xong nước của người chơi (thường đã xong). Đi hỏng thì
    // không đáp, dừng lại cho người chơi xem hướng dẫn / đi lại.
    if (assistOn() && assist.pending && assist.ply === game.length) {
      const v = await Promise.race([assist.pending, new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
      if (game.fen !== fenAtStart || ended) return;
      if (v && HOLD_ON.includes(v.cls)) {
        assist.verdict = v;
        assist.held = true;
        premove = null;
        ping('assist_hold');
        return;
      }
    }
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
  ping('play_end');
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
  // "Tuỳ chọn" ở hàng chơi nhanh: cuộn xuống bảng tuỳ chọn đầy đủ
  if (target.closest('[data-qs-options]')) {
    document.querySelector('.game-side')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  // Hộp thoại hết ván: đóng (X, bấm ra ngoài) hoặc Xem lại ván (nhảy tới nước đáng xem nhất)
  if (target.closest('.end-backdrop') && !endClickable(endShownMs())) return true;
  if (target.closest('[data-end-close]') || target.classList.contains('end-backdrop')) {
    endClosed = true;
    rerender();
    return true;
  }
  const xemLại = target.closest<HTMLElement>('[data-end-review]');
  if (xemLại) {
    endClosed = true;
    const p = Number(xemLại.dataset.endReview);
    if (p > 0) game.goTo(p);
    rerender();
    return true;
  }
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
  // Đổi chế độ: Với máy / Với người
  const pm = target.closest<HTMLElement>('[data-play-mode]');
  if (pm) {
    const m = pm.dataset.playMode as 'machine' | 'online';
    if (m !== playMode()) {
      if (m === 'machine') leaveOnlineMode();
      setPlayMode(m);
    }
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

  // Chia sẻ ván: tạo link, chép link, tải ảnh tóm tắt
  if (target.closest('[data-share-create]')) {
    const r = reviewed();
    const meta = shareMeta();
    if (r && meta) void createShareLink(game.pgn(), r, meta, rerender);
    return true;
  }
  if (target.closest('[data-share-copy]')) {
    void copyShareLink(rerender);
    return true;
  }
  if (target.closest('[data-share-image]')) {
    const r = reviewed();
    const meta = shareMeta();
    if (r && meta) void downloadShareImage(r, meta);
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
  const label = btn.dataset.label ?? btn.getAttribute('title') ?? btn.textContent?.trim() ?? '';

  const actions: Record<string, () => void> = {
    Chơi: () => {
      const start = startBotGame;
      // Chưa đăng nhập: mời đăng nhập để ván này được lưu. Luôn có lối chơi luôn.
      if (shouldAskLogin()) {
        openGate({
          title: 'Đăng nhập để lưu ván',
          text: 'Một chạm với Google, hồ sơ tạo tự động.',
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
      ping('play_start');
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
    // Trợ lý
    'Trợ lý': () => {
      setPref('assist', !prefs().assist);
      if (!prefs().assist && assist.held) {
        resetAssist();
        void botMove(rerender);
      } else if (!prefs().assist) resetAssist();
    },
    'Xem hướng dẫn': () => {
      assist.step = 0;
      ping('assist_guide');
    },
    'Bước trước': () => {
      if (assist.step !== null) assist.step = Math.max(0, assist.step - 1);
    },
    'Bước sau': () => {
      if (assist.step !== null) assist.step++;
    },
    'Bỏ qua': () => {
      if (!assist.held) return;
      assist.held = false;
      assist.pending = null; // người chơi chấp nhận nước này: máy đáp luôn, không đợi kết quả chấm nữa
      assist.step = null;
      void botMove(rerender);
    },
    'Tự đi lại': () => {
      if (!assist.held) return;
      resetAssist();
      game.undo();
      hints = null;
      hintLevel = 0;
    },
    'Đi nước gợi ý': () => {
      const v = assist.verdict;
      if (!assist.held || !v?.best) return;
      resetAssist();
      game.undo();
      const u = v.best.uci;
      if (game.move(u.slice(0, 2) as Square, u.slice(2, 4) as Square, u[4])) {
        hints = null;
        hintLevel = 0;
        afterMove(rerender);
      }
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
    resetAssist();
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
    endClosed = false;
    endShownAt = null;
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
function markForPly(): ReturnType<typeof boardMarks> {
  return boardMarks(reviewed(), game.ply);
}

/** Xem lại ván ngay dưới thẻ kết quả: đang chấm thì thanh tiến độ, xong thì bảng xem lại. */
function reviewBlock(): string {
  const cur = reporter.current;
  if (!cur || cur.pgn !== game.pgn()) return '';
  if (cur.phase !== 'done' || !cur.result) return reviewProgress(cur);
  return reviewPanel(cur.result, {
    me: setup.mode === 'bot' ? setup.side : null,
    opponent: `Máy ${levelById(setup.level).name.toLowerCase()}`,
    ply: game.ply,
    share: shareStateFor(game.pgn()),
    coach: Boolean(auth.user) && setup.mode === 'bot',
  });
}

/** Mọi thế cờ của ván đang chơi, để chấm ngầm. */
function fensOfGame(): string[] {
  return [START_FEN, ...game.history.map((m) => m.fen)];
}
const START_FEN = new Game().fen;

/** Thông tin ván để chia sẻ: tên hai bên, kết quả. */
function shareMeta(): ShareMeta | null {
  const res = outcome();
  if (!res) return null;
  const máy = `Máy ${levelById(setup.level).name.toLowerCase()}`;
  const tôi = auth.user?.name ?? 'Người chơi';
  const [white, black] =
    setup.mode === 'bot' ? (setup.side === 'w' ? [tôi, máy] : [máy, tôi]) : ['Trắng', 'Đen'];
  return {
    white,
    black,
    result: res.winner === 'draw' ? '½-½' : res.winner === 'w' ? '1-0' : '0-1',
    label: outcomeText(res),
    side: setup.mode === 'bot' ? setup.side : null,
  };
}

/* ---------------- Bàn cờ nổi (cửa sổ nhỏ, xem src/app/mini.ts) ---------------- */

/** Ván đang dở, gói lại để chuyển giữa trang chính và bàn cờ nổi. */
export interface PlayHandoff {
  pgn: string;
  level: number;
  pick: Pick;
  side: Side;
  orientation: Side;
  resigned: Side | null;
  saved: boolean;
}

/** Ván với máy đang có (kể cả vừa xong); null nếu chưa vào ván. */
export function exportPlayState(): PlayHandoff | null {
  if (!started || setup.mode !== 'bot') return null;
  return { pgn: game.pgn(), level: setup.level, pick: setup.pick, side: setup.side, orientation, resigned, saved };
}

/** Nhận ván được chuyển sang và chơi tiếp đúng chỗ đó. */
export function importPlayState(h: PlayHandoff): void {
  let g: Game;
  try {
    g = Game.fromPgn(h.pgn);
  } catch {
    return;
  }
  newGame();
  setup = { mode: 'bot', level: h.level, pick: h.pick, side: h.side };
  game = g;
  orientation = h.orientation;
  animatedOrientation = orientation;
  animatedPly = game.length;
  resigned = h.resigned;
  saved = h.saved;
  ended = outcome() !== null;
  // Ván chuyển về từ bàn cờ nổi mà đã xong thì không bật hộp thoại lần nữa
  endClosed = ended;
  started = true;
}

/** Đã vào ván chưa (bàn cờ nổi: bấm vào bàn cờ lúc chưa vào ván là bắt đầu luôn). */
export function playStarted(): boolean {
  return started;
}

/** Vào ván với máy theo cấp và bên đang chọn. */
export function startBotGame(): void {
  newGame();
  started = true;
  ping('play_start');
}

/** Bỏ ván đang hiện ở đây (ván đã chuyển sang bàn cờ nổi). */
export function resetPlay(): void {
  newGame();
  started = false;
}

/** Hỏi chọn quân khi Tốt tới hàng cuối (dùng chung cho màn to và bàn cờ nổi). */
function promoDialog(): string {
  return pendingPromotion
    ? dialog(
        'Phong cấp thành quân gì?',
        `<div class="promo-row">${PROMOTION_PIECES.map(
          ([code, name]) =>
            `<button class="promo" data-promote="${code}" title="${name}">` +
            `${pieceGlyph(((game.turn === 'w' ? 'w' : 'b') + code) as never, 'promo-piece')}<span>${name}</span></button>`,
        ).join('')}</div>`,
        button({ label: 'Hủy', kind: 'text' }),
      )
    : '';
}

/**
 * Bàn cờ nổi: chỉ bàn cờ và hai thanh mỏng. Không chữ to, không logo, không màu
 * nhấn chói — liếc qua chỉ thấy một ô cửa sổ nhỏ. Esc (hoặc nút mắt) che bàn cờ
 * bằng một tấm trơn; bấm vào tấm đó là mở lại.
 */
export function miniPlay(covered: boolean): string {
  const result = outcome();
  const lv = levelById(setup.level);
  // Đang che: cả cửa sổ chỉ còn một thanh ngang, kèm trạng thái kín đáo
  if (covered) {
    const tt = !started || result ? '' : thinking ? 'máy đang nghĩ' : game.turn === setup.side ? 'tới lượt bạn' : '';
    return `<div class="mini is-covered" data-mini-cover role="button" aria-label="Hiện bàn cờ">
      <div class="mini-tab">${icon('show', 16)}${tt ? `<span class="mini-dot${game.turn === setup.side ? ' is-you' : ''}"></span><span>${tt}</span>` : '<span>Hiện bàn cờ</span>'}</div>
    </div>`;
  }
  const nút = (name: IconName, title: string, attrs = '', disabled = false) =>
    `<button class="btn btn-icon mini-btn" title="${title}" aria-label="${title}"${attrs}${disabled ? ' disabled' : ''}>${icon(name, 17)}</button>`;

  let trên: string;
  if (!started) trên = `<span class="mini-title">Chơi với máy</span>`;
  else if (result) {
    const [ai] = outcomeText(result).split(' · ');
    trên = `<span class="mini-title"><b>${result.winner === 'draw' ? 'Hòa' : result.winner === setup.side ? 'Bạn thắng' : 'Bạn thua'}</b>${result.winner === 'draw' ? '' : ` · ${ai}`}</span>`;
  } else
    trên =
      `<span class="mini-title"><b>Máy ${lv.name.toLowerCase()}</b>` +
      `${thinking ? ' · đang nghĩ…' : game.turn === setup.side && game.atLive ? ' · tới lượt bạn' : ''}</span>`;

  let dưới: string;
  if (!started)
    dưới =
      `<span class="mini-level">` +
      nút('prev', 'Dễ hơn', ` data-level="${setup.level - 1}"`, setup.level <= 1) +
      `<span class="mini-lv mono">${lv.name}</span>` +
      nút('next', 'Khó hơn', ` data-level="${setup.level + 1}"`, setup.level >= LEVELS.length) +
      `</span>` +
      `<span class="mini-side">${pieceGlyph((setup.side + 'k') as never, 'mini-king')}</span>` +
      nút('flip', 'Lật bàn cờ') +
      `<button class="btn btn-primary mini-go">Chơi</button>`;
  else if (result)
    dưới =
      nút('prev', 'Lùi một nước', '', game.ply === 0) +
      nút('next', 'Tiến một nước', '', game.atLive) +
      `<span class="mini-gap"></span>` +
      `<button class="btn btn-secondary mini-go">Ván mới</button>` +
      `<button class="btn btn-primary mini-go">Chơi lại</button>`;
  else
    dưới =
      nút('prev', 'Lùi một nước', '', game.ply === 0) +
      nút('next', 'Tiến một nước', '', game.atLive) +
      `<span class="mini-gap"></span>` +
      nút('undo', 'Đi lại', ' data-act="undo"', game.length === 0 || thinking) +
      `<button class="btn btn-icon mini-btn${resignArmed ? ' is-armed' : ''}" data-act="resign"` +
      ` title="${resignArmed ? 'Bấm lần nữa để đầu hàng' : 'Đầu hàng'}" aria-label="Đầu hàng"${game.length === 0 ? ' disabled' : ''}>${icon('resign', 17)}</button>`;

  return `<div class="mini">
    <div class="mini-bar">${covered ? '' : trên}<span class="mini-gap"></span>${
      // Nút mắt luôn ở đúng chỗ này, kể cả lúc đang che: bấm lại là hiện
      covered ? nút('show', 'Hiện bàn cờ (Esc)', ' data-mini-hide') : nút('hide', 'Che bàn cờ (Esc)', ' data-mini-hide')
    }</div>
    <div class="board-row mini-board"><div id="board" class="board-host"></div></div>
    <div class="mini-bar">${dưới}</div>
    ${covered ? '<button class="mini-cover" data-mini-cover aria-label="Hiện bàn cờ"><span>Bấm để hiện bàn cờ</span></button>' : ''}
    ${promoDialog()}
  </div>`;
}
