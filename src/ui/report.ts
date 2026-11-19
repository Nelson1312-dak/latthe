// Xem lại ván: hết ván là có ngay, ngay trên bàn cờ vừa chơi — không sang màn khác.
// Dùng chung cho tab Chơi (với máy, hai người một máy), ván online, và ván đã lưu.
//
// Việc chấm là của Stockfish chạy trên máy người chơi (không phải AI), và phần lớn
// đã chấm ngầm trong lúc chơi (src/analysis/precompute.ts), nên thường không phải chờ.
//
// Bố cục cột phải sau ván, từ trên xuống:
// 1. Độ chính xác: của bạn (to) và của đối thủ (nhỏ).
// 2. Nhịp ván: mỗi ô một nước của bạn, tô theo xếp loại — thấy ngay ván đổ ở đâu.
// 3. Khoảnh khắc đáng xem (tối đa 5) và thẻ nước đang xem: vì sao hỏng, nên đi gì,
//    thế cờ đổi ra sao. Nút ‹ › nhảy qua từng khoảnh khắc; bàn cờ đi theo.
// Lời giải thích lấy từ engine và bộ nhận diện mô-típ, không gọi AI — AI chỉ làm
// Huấn luyện viên nhìn cả lịch sử ván (Hồ sơ).

import { reviewGame, ReviewCancelled, type ReviewResult, type ReviewedMove } from '../analysis/review.ts';
import { cachedAnalyser, REVIEW_PV } from '../analysis/precompute.ts';
import { loadOpenings } from '../analysis/openings.ts';
import { CLASS_LABEL } from '../board/Board.ts';
import { Game, type Side } from '../../shared/chess.ts';
import type { Square } from '../../shared/fen.ts';
import { scoreFor, winningChances, type MoveClass } from '../../shared/winrate.ts';
import { whyText } from '../../shared/advisor/templates.ts';
import { factsForMove } from '../app/advisor.ts';
import { thếCờ } from '../analysis/words.ts';
import { classBadge, figurine, notice } from './components/index.ts';
import { icon } from './icons.ts';
import type { ShareState } from '../app/share.ts';

export interface Report {
  phase: 'running' | 'done' | 'error';
  done: number;
  total: number;
  /** Ván đã chấm (PGN). Ván đổi (đi lại, ván mới) thì bảng này hết dùng được. */
  pgn: string;
  result: ReviewResult | null;
  error?: string;
}

/** Một "người chấm" giữ đúng một bảng chấm; chấm ván mới là huỷ ván cũ. */
export interface Reporter {
  readonly current: Report | null;
  /** Kết quả chấm, nếu đã xong và đúng là của ván `pgn`. */
  resultFor(pgn: string): ReviewResult | null;
  start(pgn: string, rerender: () => void, onDone?: (r: ReviewResult) => void): void;
  drop(): void;
}

export function createReporter(): Reporter {
  let report: Report | null = null;
  let token = 0;
  return {
    get current() {
      return report;
    },
    resultFor(pgn) {
      return report?.phase === 'done' && report.result && report.pgn === pgn ? report.result : null;
    },
    drop() {
      token++;
      report = null;
    },
    start(pgn, rerender, onDone) {
      if (report && report.pgn === pgn) return; // đang chấm / đã chấm đúng ván này
      const my = ++token;
      let plies = 0;
      try {
        plies = Game.fromPgn(pgn).length;
      } catch {
        plies = 0;
      }
      if (plies < 2) {
        report = null;
        return;
      }
      report = { phase: 'running', done: 0, total: plies + 1, pgn, result: null };
      void (async () => {
        try {
          await loadOpenings();
          const result = await reviewGame(pgn, cachedAnalyser, {
            multipv: REVIEW_PV,
            onProgress: (done, total) => {
              if (my !== token || !report) return;
              report.done = done;
              report.total = total;
              if (done % 4 === 0) rerender();
            },
            cancelled: () => my !== token,
          });
          if (my !== token) return;
          report = { phase: 'done', done: plies + 1, total: plies + 1, pgn, result };
          onDone?.(result);
          rerender();
        } catch (err) {
          if (err instanceof ReviewCancelled || my !== token) return;
          report = { phase: 'error', done: 0, total: 0, pgn, result: null, error: (err as Error).message };
          rerender();
        }
      })();
    },
  };
}

export const BAD_MOVES: MoveClass[] = ['inaccuracy', 'mistake', 'blunder', 'miss'];
/** Mức nặng nhẹ, để chọn ra những khoảnh khắc đáng xem nhất. */
const SEVERITY: Record<MoveClass, number> = { miss: 4, blunder: 4, mistake: 3, inaccuracy: 2, good: 0, best: 0, book: 0 };
/** Tối đa ngần này khoảnh khắc: nhiều hơn là thành đọc lại cả ván. */
const MAX_MOMENTS = 5;

const moveNo = (m: ReviewedMove) => `${Math.ceil(m.ply / 2)}.${m.side === 'b' ? '..' : ''}`;

/** Những nước đáng xem lại nhất của bạn (hai người một máy: của cả hai), theo thứ tự ván. */
export function momentsOf(r: ReviewResult, me: Side | null): ReviewedMove[] {
  return r.moves
    .filter((m) => (!me || m.side === me) && BAD_MOVES.includes(m.cls))
    .sort((a, b) => SEVERITY[b.cls] - SEVERITY[a.cls] || a.accuracy - b.accuracy)
    .slice(0, MAX_MOMENTS)
    .sort((a, b) => a.ply - b.ply);
}

/** Nhãn xếp loại và mũi tên nước nên đi, cho thế cờ sau nước `ply`. */
export function boardMarks(
  r: ReviewResult | null,
  ply: number,
): { badge?: { square: Square; cls: MoveClass }; arrows?: { from: Square; to: Square; kind: 'coach' }[] } {
  const m = r && ply > 0 ? r.moves[ply - 1] : null;
  if (!m) return {};
  const best = m.best[0];
  return {
    badge: { square: m.uci.slice(2, 4) as Square, cls: m.cls },
    arrows:
      BAD_MOVES.includes(m.cls) && best && best.uci !== m.uci
        ? [{ from: best.uci.slice(0, 2) as Square, to: best.uci.slice(2, 4) as Square, kind: 'coach' }]
        : undefined,
  };
}

/** Trong lúc chấm (thường chỉ vài giây vì đã chấm ngầm phần lớn). */
export function reviewProgress(report: Report | null): string {
  if (!report) return '';
  if (report.phase === 'error') {
    return notice(`Không chấm được ván: ${report.error ?? 'lỗi lạ'}`, 'danger', 'engine');
  }
  if (report.phase !== 'running') return '';
  const pct = report.total ? Math.round((report.done / report.total) * 100) : 0;
  return `<div class="rv rv-wait">
    <p class="rv-kicker">${icon('engine', 16)}<span>Đang chấm ván</span><b class="mono">${pct}%</b></p>
    <div class="progress"><span style="width:${pct}%"></span></div>
  </div>`;
}

export interface PanelView {
  /** Bên của người chơi; null là hai người một máy (chấm cả hai bên). */
  me: Side | null;
  /** Tên đối thủ ("Máy cấp 3", tên người chơi online). */
  opponent: string;
  /** Nước đang xem trên bàn cờ (0 là thế cờ đầu). */
  ply: number;
  /** Tình trạng chia sẻ; undefined là không có nút chia sẻ (ván người khác). */
  share?: ShareState | null;
  /** Tên người chơi khi người xem không phải họ (ván được chia sẻ); thay cho chữ "bạn". */
  meName?: string;
  /** Có dòng dẫn sang Huấn luyện viên (người đã đăng nhập, ván của chính mình). */
  coach?: boolean;
}

const CLASS_NOTE: Partial<Record<MoveClass, string>> = {
  best: 'Đúng nước engine chọn.',
  good: 'Nước ổn, thế cờ giữ nguyên.',
  book: 'Nước theo sách khai cuộc.',
};

/** Nước nên đi, kèm điều nó mang lại, nhìn từ bên vừa đi. */
function betterLine(m: ReviewedMove): string {
  const best = m.best[0];
  if (!best || best.uci === m.uci) return '';
  const s = scoreFor(best.score, m.side);
  const được =
    s.mate !== undefined && s.mate > 0 ? `chiếu hết sau ${s.mate} nước` : `thế cờ ${thếCờ(best.score, m.side)}`;
  return `<p class="rv-better"><span>Nên đi</span>${figurine(best.san, m.side)}<span class="rv-note">— ${được}</span></p>`;
}

/** Thẻ nước đang xem: xếp loại, vì sao, nên đi gì, thế cờ đổi ra sao. */
function focusCard(m: ReviewedMove | null, me: Side | null, meName?: string): string {
  if (!m) return `<p class="rv-why">Thế cờ đầu ván.</p>`;
  const bad = BAD_MOVES.includes(m.cls);
  const ai = me && m.side !== me ? 'Đối thủ' : me ? (meName ?? 'Bạn') : m.side === 'w' ? 'Trắng' : 'Đen';
  const trước = thếCờ(m.scoreBefore, m.side);
  const sau = thếCờ(m.scoreAfter, m.side);
  return `<p class="rv-move">
      <span class="mono">${moveNo(m)}</span>${figurine(m.san, m.side)}${classBadge(m.cls, 'md')}
      <b style="color:var(--cls-${m.cls})">${CLASS_LABEL[m.cls]}</b>
    </p>
    <p class="rv-why">${bad ? whyText(factsForMove(m)) : (CLASS_NOTE[m.cls] ?? '')}</p>
    ${bad ? betterLine(m) : ''}
    ${bad && trước !== sau ? `<p class="rv-shift">Thế cờ của ${meName && ai === meName ? ai : ai.toLowerCase()}: ${trước} → <b>${sau}</b></p>` : ''}`;
}

/**
 * Khối xem lại ván ở cột phải. Mọi thứ bấm được mang `data-report-ply` (nước
 * cần nhảy tới); màn hình chứa nó tự lo việc đổi thế cờ trên bàn.
 */
export function reviewPanel(r: ReviewResult, v: PanelView): string {
  const me = v.me;
  const accMe = me === 'b' ? r.accuracy.b : r.accuracy.w;
  const accOpp = me === 'b' ? r.accuracy.w : r.accuracy.b;
  const tênOpp = (me ? v.opponent : 'Đen').replace(/[<>&"]/g, '');

  const moments = momentsOf(r, me);
  const idx = moments.findIndex((m) => m.ply === v.ply);
  const prev = [...moments].reverse().find((m) => m.ply < v.ply);
  const next = moments.find((m) => m.ply > v.ply);
  const nav = (m: ReviewedMove | undefined, name: 'prev' | 'next', title: string) =>
    `<button class="btn btn-icon" title="${title}" aria-label="${title}"${m ? ` data-report-ply="${m.ply}"` : ' disabled'}>${icon(name, 17)}</button>`;

  const current = v.ply > 0 ? (r.moves[v.ply - 1] ?? null) : null;

  return `<section class="rv">
    <div class="rv-acc">
      <div class="rv-acc-main"><b class="mono">${accMe.toFixed(1)}</b><span>độ chính xác của ${
        me ? (v.meName ?? 'bạn').replace(/[<>&"]/g, '') : 'Trắng'
      }</span></div>
      <div class="rv-acc-opp"><b class="mono">${accOpp.toFixed(1)}</b><span>${tênOpp}</span></div>
    </div>
    ${evalGraph(r, v.ply, me)}

    <div class="rv-focus">
      <div class="rv-focus-head">
        <span class="rv-kicker">${
          moments.length
            ? idx >= 0
              ? `Khoảnh khắc ${idx + 1}/${moments.length}`
              : `${moments.length} khoảnh khắc đáng xem`
            : 'Không có nước hỏng đáng kể'
        }</span>
        ${moments.length ? nav(prev, 'prev', 'Khoảnh khắc trước') + nav(next, 'next', 'Khoảnh khắc sau') : ''}
      </div>
      ${
        moments.length
          ? `<div class="rv-chips">${moments
              .map(
                (m) =>
                  `<button class="rv-chip${m.ply === v.ply ? ' is-current' : ''}" data-report-ply="${m.ply}">` +
                  `<span class="mono">${moveNo(m)}</span>${figurine(m.san, m.side)}${classBadge(m.cls)}</button>`,
              )
              .join('')}</div>`
          : ''
      }
      ${focusCard(current, me, v.meName?.replace(/[<>&"]/g, ''))}
    </div>
    ${
      v.coach
        ? `<a class="rv-coach" href="#/huan-luyen">${icon('coach', 18)}<span><b>Huấn luyện viên</b> · lỗi bạn hay lặp lại</span>${icon('next', 14)}</a>`
        : ''
    }
    ${
      v.share === undefined
        ? ''
        : v.share
          ? shareBox(v.share)
          : `<button class="link-btn" data-share-create>${icon('friends', 16)}<span>Chia sẻ ván này</span></button>`
    }
  </section>`;
}

/** Ô chia sẻ: link để gửi, chép link, tải ảnh tóm tắt. */
function shareBox(s: ShareState): string {
  if (s.busy) return `<p class="rv-note">Đang tạo link chia sẻ…</p>`;
  if (s.error || !s.url) {
    return `<div class="share-box">${notice(`Không tạo được link: ${s.error ?? 'lỗi lạ'}`, 'danger')}
      <button class="link-btn" data-share-create>Thử lại</button></div>`;
  }
  return `<div class="share-box">
    <p class="rv-note">Link ván này — ai mở cũng xem được bàn cờ và bảng chấm</p>
    <div class="share-link">
      <input class="field mono" readonly value="${s.url}" aria-label="Link chia sẻ" onclick="this.select()">
      <button class="btn btn-primary" data-share-copy>${icon(s.copied ? 'check' : 'copy', 17)}<span>${s.copied ? 'Đã chép' : 'Chép link'}</span></button>
    </div>
    <button class="link-btn" data-share-image>${icon('review', 16)}<span>Tải ảnh tóm tắt để đăng Facebook, Zalo</span></button>
  </div>`;
}

/** PGN từ danh sách nước SAN (ván online chỉ có danh sách này). */
export function pgnFromSans(sans: readonly string[]): string {
  const out: string[] = [];
  sans.forEach((san, i) => out.push(i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san));
  return out.join(' ');
}

/* ---------------- Hộp thoại hết ván ---------------- */

/**
 * Phần số của hộp thoại hết ván: độ chính xác, số nước tốt nhất, số nước hỏng,
 * và một câu chỉ ra nước đáng xem nhất. `ply` là nước đó (0 nếu không có), để nút
 * "Xem lại ván" nhảy thẳng tới. Đang chấm thì chỉ báo phần trăm; ván quá ngắn
 * hoặc chấm lỗi thì không có gì — hộp thoại vẫn dùng được không cần số.
 */
export function endSummary(cur: Report | null, pgn: string, me: Side | null): { html: string; ply: number } {
  if (!cur || cur.pgn !== pgn || cur.phase === 'error') return { html: '', ply: 0 };
  if (cur.phase !== 'done' || !cur.result) {
    const pct = cur.total ? Math.round((cur.done / cur.total) * 100) : 0;
    return { html: `<p class="end-wait">Đang chấm ván <b class="mono">${pct}%</b></p>`, ply: 0 };
  }
  const r = cur.result;
  const của = r.moves.filter((m) => !me || m.side === me);
  const tốtNhất = của.filter((m) => m.cls === 'best').length;
  const hỏngHẳn = của.filter((m) => m.cls === 'mistake' || m.cls === 'blunder' || m.cls === 'miss');
  const tệNhất = [...hỏngHẳn].sort((a, b) => SEVERITY[b.cls] - SEVERITY[a.cls] || a.accuracy - b.accuracy)[0];
  const ô = (v: string, nhãn: string) => `<span><b class="mono">${v}</b> ${nhãn}</span>`;
  const số = me
    ? ô(r.accuracy[me].toFixed(1), 'chính xác') + ô(String(tốtNhất), 'nước tốt nhất') + ô(String(hỏngHẳn.length), 'nước hỏng')
    : ô(r.accuracy.w.toFixed(1), 'Trắng') + ô(r.accuracy.b.toFixed(1), 'Đen') + ô(String(hỏngHẳn.length), 'nước hỏng');
  const lời = tệNhất
    ? `Đáng xem nhất: ${moveNo(tệNhất)} ${figurine(tệNhất.san, tệNhất.side)} · ${CLASS_LABEL[tệNhất.cls].toLowerCase()}`
    : của.length >= 6
      ? 'Không có nước hỏng nào.'
      : '';
  return { html: `<p class="end-nums">${số}</p>${lời ? `<p class="end-coach">${lời}</p>` : ''}`, ply: tệNhất?.ply ?? 0 };
}

export interface EndView {
  title: string;
  tone: 'win' | 'loss' | 'draw';
  /** Lý do và đối thủ, một dòng. */
  why: string;
  body: string;
  actions: string;
  /**
   * Bao lâu (ms) kể từ lúc hộp thoại bắt đầu hiện. Màn vẽ lại liên tục (đang chấm
   * ván…), nên hiệu ứng tính theo thời gian: vẽ lại giữa chừng thì chạy tiếp đúng
   * chỗ (animation-delay âm), không bắt đầu lại, cũng không mất hẳn.
   */
  shownMs: number;
}

/** Hộp thoại đợi nước cuối đi xong rồi mới hiện (ms); hiện ra trong END_FADE_MS. */
export const END_DELAY_MS = 350;
const END_FADE_MS = 260;
/** Bấm trong lúc hộp thoại chưa hiện hẳn thì bỏ qua (tránh bấm nhầm khi đang đi quân). */
export const endClickable = (shownMs: number) => shownMs >= END_DELAY_MS + 120;

/**
 * Hộp thoại hết ván, nổi trên bàn cờ như chess.com: kết quả to, lý do, vài con
 * số, nút chính "Xem lại ván", hai nút phụ. Đóng bằng X, Esc hoặc bấm ra ngoài;
 * kết quả vẫn nằm ở cột bên.
 */
export function endDialog(v: EndView): string {
  const anim = v.shownMs < END_DELAY_MS + END_FADE_MS;
  const delay = ` style="animation-delay:${Math.round(END_DELAY_MS - v.shownMs)}ms"`;
  return `<div class="dialog-backdrop end-backdrop${anim ? ' is-enter' : ''}"${anim ? delay : ''}>
    <div class="dialog end-dialog" role="dialog" aria-modal="true" aria-labelledby="end-title"${anim ? delay : ''}>
      <button class="btn btn-icon end-close" data-end-close aria-label="Đóng">${icon('close', 18)}</button>
      <h2 id="end-title" class="end-title is-${v.tone}">${v.title}</h2>
      <p class="end-why">${v.why}</p>
      ${v.body}
      <div class="end-actions">${v.actions}</div>
    </div>
  </div>`;
}

/* ---------------- Biểu đồ đánh giá ---------------- */

/**
 * Biểu đồ đánh giá cả ván, như mọi trang cờ: phần sáng là lợi thế của Trắng, phần
 * tối của Đen, vạch giữa là cân bằng. Chấm màu ở những nước hỏng đáng xem (của bạn),
 * vạch dọc là nước đang xem. Bấm vào đâu thì bàn cờ nhảy tới nước đó.
 * Thay cho dải ô màu cũ (mỗi nước một ô): kiểu "dòng thời gian" tự chế đó không trang
 * cờ nào dùng, nhìn như đồ trang trí.
 */
function evalGraph(r: ReviewResult, ply: number, me: Side | null): string {
  const n = r.moves.length;
  if (!n) return '';
  const W = 600;
  const H = 72;
  const x = (i: number) => (i / n) * W;
  const y = (wc: number) => H / 2 - wc * (H / 2) * 0.92;
  // Sau nước chiếu hết engine trả "mate 0" (bên phải đi đã bị chiếu hết): bên vừa đi thắng
  const wc = (m: ReviewedMove) => (m.scoreAfter.mate === 0 ? (m.side === 'w' ? 1 : -1) : winningChances(m.scoreAfter));
  const pts = [`0,${H / 2}`, ...r.moves.map((m, i) => `${x(i + 1).toFixed(1)},${y(wc(m)).toFixed(1)}`)];
  const area = `M0,${H} L${pts.join(' L')} L${W},${H} Z`;
  // Cột bấm được: mỗi nước một dải dọc trong suốt
  const cols = r.moves
    .map(
      (m, i) =>
        `<rect x="${x(i).toFixed(1)}" y="0" width="${(W / n).toFixed(2)}" height="${H}" fill="transparent" data-report-ply="${m.ply}"><title>${moveNo(m)} ${m.san}</title></rect>`,
    )
    .join('');
  const cur = ply > 0 ? `<line class="eg-cur" x1="${x(ply)}" x2="${x(ply)}" y1="0" y2="${H}" vector-effect="non-scaling-stroke"/>` : '';
  const dots = momentsOf(r, me)
    .map((m) => {
      const left = (x(m.ply) / W) * 100;
      const top = (y(wc(m)) / H) * 100;
      return (
        // Chấm chỉ để nhìn; bấm thì dải cột bên dưới nhận (chấm nhỏ hơn vùng chạm 44px)
        `<span class="eg-dot" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;--c:var(--cls-${m.cls})" ` +
        `title="${moveNo(m)} ${m.san} — ${CLASS_LABEL[m.cls]}"></span>`
      );
    })
    .join('');
  return `<div class="eval-graph" aria-label="Biểu đồ đánh giá cả ván">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="false">
      <rect class="eg-black" width="${W}" height="${H}"/>
      <path class="eg-white" d="${area}"/>
      <line class="eg-mid" x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" vector-effect="non-scaling-stroke"/>
      ${cur}${cols}
    </svg>${dots}
  </div>`;
}
