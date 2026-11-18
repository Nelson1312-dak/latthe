// Bảng chấm ván: hết ván là engine chấm luôn từng nước, ngay tại chỗ.
// Dùng chung cho tab Chơi (đấu với máy, hai người một máy) và tab Đấu (online).
//
// Chạy trong trình duyệt nên miễn phí, không cần đăng nhập, không tốn server.
// 250ms mỗi thế cờ (màn Xem lại dùng 450ms) vì người chơi đang ngồi chờ.

import { reviewGame, ReviewCancelled, type ReviewResult, type ReviewedMove } from '../analysis/review.ts';
import { loadOpenings } from '../analysis/openings.ts';
import { engine } from '../engine/engine.ts';
import { CLASS_LABEL } from '../board/Board.ts';
import { Game, type Side } from '../../shared/chess.ts';
import type { MoveClass } from '../../shared/winrate.ts';
import { button, classBadge, figurine, notice } from './components/index.ts';
import { icon } from './icons.ts';

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
      rerender();
      void (async () => {
        try {
          await loadOpenings();
          const result = await reviewGame(pgn, engine(), {
            movetimeMs: 250,
            multipv: 2,
            onProgress: (done, total) => {
              if (my !== token || !report) return;
              report.done = done;
              report.total = total;
              if (done % 3 === 0 || done === total) rerender();
            },
            cancelled: () => my !== token,
          });
          if (my !== token) return;
          report = { phase: 'done', done: report?.total ?? 0, total: report?.total ?? 0, pgn, result };
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

const moveNo = (m: ReviewedMove) => `${Math.ceil(m.ply / 2)}.${m.side === 'b' ? '..' : ''}`;

export interface ReportView {
  /** Bên của người chơi; null là hai người một máy (chấm cả hai bên). */
  me: Side | null;
  /** Tên đối thủ ("Máy cấp 3", tên người chơi online). */
  opponent: string;
  /** Nước đang xem trên bàn cờ, để tô ô / khoảnh khắc tương ứng. */
  currentPly: number;
}

/**
 * Bảng chấm ván. Thiết kế riêng, không theo khuôn "Game Review" của chess.com:
 * - độ chính xác hai bên là hai thanh ngang;
 * - "nhịp ván": một dải ô màu, mỗi ô một nước của bạn, tô theo xếp loại, nước
 *   càng hỏng ô càng cao — nhìn là thấy ván đổ ở đoạn nào;
 * - tối đa ba khoảnh khắc đáng xem nhất, kèm nước tốt hơn.
 * Ô nhịp ván và khoảnh khắc mang `data-report-ply`; màn hình tự lo khi bấm.
 */
export function reportCard(report: Report | null, v: ReportView): string {
  if (!report) return '';
  if (report.phase === 'running') {
    const pct = report.total ? Math.round((report.done / report.total) * 100) : 0;
    return `<div class="report">
      <p class="report-title">${icon('engine', 18)}<span>Đang chấm ván…</span><b class="mono">${pct}%</b></p>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <p class="report-note">Engine chấm từng nước ngay trên máy bạn — miễn phí, không cần đăng nhập.</p>
    </div>`;
  }
  if (report.phase === 'error' || !report.result) {
    return `<div class="report">${notice(`Không chấm được ván: ${report.error ?? 'lỗi lạ'}`, 'danger', 'engine')}</div>`;
  }
  const r = report.result;
  const me = v.me;
  const opp: Side = me === 'w' ? 'b' : 'w';
  const accRow = (name: string, value: number, mine: boolean) =>
    `<div class="acc-row${mine ? ' is-me' : ''}"><span>${name}</span>` +
    `<span class="acc-bar"><i style="width:${Math.max(2, value)}%"></i></span><b class="mono">${value.toFixed(1)}</b></div>`;
  const acc = me
    ? accRow('Bạn', me === 'w' ? r.accuracy.w : r.accuracy.b, true) +
      accRow(v.opponent.replace(/[<>&"]/g, ''), opp === 'w' ? r.accuracy.w : r.accuracy.b, false)
    : accRow('Trắng', r.accuracy.w, false) + accRow('Đen', r.accuracy.b, false);

  const mine = r.moves.filter((m) => !me || m.side === me);
  const beats = mine
    .map(
      (m) =>
        `<button class="beat${m.ply === v.currentPly ? ' is-current' : ''}" data-report-ply="${m.ply}" ` +
        `style="--c:var(--cls-${m.cls})" title="${moveNo(m)} ${m.san} — ${CLASS_LABEL[m.cls]}" ` +
        `aria-label="${moveNo(m)} ${m.san}, ${CLASS_LABEL[m.cls]}"></button>`,
    )
    .join('');

  const counts = new Map<MoveClass, number>();
  for (const m of mine) counts.set(m.cls, (counts.get(m.cls) ?? 0) + 1);
  const order: MoveClass[] = ['best', 'good', 'book', 'inaccuracy', 'mistake', 'blunder', 'miss'];
  const chips = order
    .filter((c) => counts.get(c))
    .map(
      (c) =>
        `<span class="cls-chip" title="${CLASS_LABEL[c]}">${classBadge(c)}<span>${CLASS_LABEL[c]}</span><b class="mono">${counts.get(c)}</b></span>`,
    )
    .join('');

  const moments = mine
    .filter((m) => BAD_MOVES.includes(m.cls))
    .sort((a, b) => SEVERITY[b.cls] - SEVERITY[a.cls] || a.accuracy - b.accuracy)
    .slice(0, 3)
    .sort((a, b) => a.ply - b.ply)
    .map((m) => {
      const best = m.best[0];
      return (
        `<button class="moment${m.ply === v.currentPly ? ' is-current' : ''}" data-report-ply="${m.ply}">` +
        `<span class="moment-move"><span class="mono">${moveNo(m)}</span>${figurine(m.san, m.side)}${classBadge(m.cls)}</span>` +
        `<span class="moment-text">${CLASS_LABEL[m.cls]}${best && best.uci !== m.uci ? ` · nên đi ${figurine(best.san, m.side)}` : ''}</span>` +
        `</button>`
      );
    })
    .join('');

  return `<div class="report">
    <p class="report-title">${icon('engine', 18)}<span>Chấm ván</span></p>
    <div class="acc-rows">${acc}</div>
    <div class="beats-wrap">
      <p class="report-label">Nhịp ván${me ? ' của bạn' : ''} <span>· bấm một ô để xem nước đó</span></p>
      <div class="beats">${beats}</div>
    </div>
    <div class="cls-chips">${chips}</div>
    ${
      moments
        ? `<p class="report-label">Đáng xem lại</p><div class="moments">${moments}</div>`
        : `<p class="report-note">Không có nước hỏng nào đáng kể. Ván đẹp!</p>`
    }
    ${button({ label: 'Xem lại chi tiết', icon: 'review', full: true })}
  </div>`;
}

/** PGN từ danh sách nước SAN (ván online chỉ có danh sách này). */
export function pgnFromSans(sans: readonly string[]): string {
  const out: string[] = [];
  sans.forEach((san, i) => out.push(i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san));
  return out.join(' ');
}
