// Trợ lý trong ván (chỉ khi chơi với máy): mỗi nước bạn vừa đi được chấm ngay,
// nếu có nước tốt hơn hẳn thì máy dừng lại chờ, và Trợ lý hướng dẫn trên bàn cờ.
//
// Nhanh vì dùng kết quả chấm ngầm (precompute.ts): thế cờ TRƯỚC nước của bạn đã
// được chấm trong lúc bạn nghĩ, chỉ còn thế cờ SAU là phải chấm thêm ~300ms.
// Lời giải thích lấy từ bộ nhận diện mô-típ (để hở quân, đòn đôi...), không chờ AI.

import { Game, type Side } from '../../shared/chess.ts';
import type { Square } from '../../shared/fen.ts';
import { classify, scoreFor, winPercent, moveAccuracy, type MoveClass, type Score } from '../../shared/winrate.ts';
import { whyText } from '../../shared/advisor/templates.ts';
import type { Motif } from '../../shared/advisor/motifs.ts';
import { factsForMove } from '../app/advisor.ts';
import { analyseNow } from './precompute.ts';
import { openingAt } from './openings.ts';
import type { ReviewedMove } from './review.ts';
import { sanVi, thếCờ } from './words.ts';

/** Những xếp loại khiến Trợ lý dừng máy lại. "Thiếu chính xác" thì chỉ báo nhẹ, không dừng. */
export const HOLD_ON: MoveClass[] = ['blunder', 'mistake', 'miss'];

export interface AssistVerdict {
  /** Nước thứ mấy của ván (1 là nước đầu của Trắng). */
  ply: number;
  side: Side;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  cls: MoveClass;
  /** Vì sao (mô-típ hoặc theo xếp loại). */
  why: string;
  /** Kiểu lỗi chính nhận ra được (để khoanh ô trên bàn cờ). */
  motif: Motif | null;
  /** Nước nên đi và các nước tiếp theo engine thấy (UCI + SAN). */
  best: { uci: string; san: string; score: Score } | null;
  line: { uci: string; san: string; side: Side }[];
  /** Thế cờ trước/sau nước của bạn, nói bằng lời. */
  before: string;
  after: string;
}

/** Chấm nước vừa đi. `fenBefore` là thế cờ trước nước đó. */
export async function judgeMove(fenBefore: string, uci: string, ply: number): Promise<AssistVerdict | null> {
  const g = new Game(fenBefore);
  const side = g.turn;
  const m = g.move(uci.slice(0, 2) as Square, uci.slice(2, 4) as Square, uci[4]);
  if (!m) return null;
  const fenAfter = g.fen;
  const [trước, sau] = await Promise.all([analyseNow(fenBefore), analyseNow(fenAfter)]);
  const top = trước[0];
  if (!top) return null;
  const scoreBefore = top.score;
  // Hết cờ sau nước này (mình chiếu hết, hay hòa): không có dòng nào, tự suy
  const o = g.outcome();
  const scoreAfter: Score = sau[0]?.score ?? (o && o.winner !== 'draw' ? { mate: o.winner === 'w' ? 1 : -1 } : { cp: 0 });
  const isBest = top.uci === uci;
  const cls = classify({ before: scoreBefore, after: scoreAfter, side, isBest, isBook: Boolean(openingAt(fenAfter)) });

  const wb = side === 'w' ? winPercent(scoreBefore) : 100 - winPercent(scoreBefore);
  const wa = side === 'w' ? winPercent(scoreAfter) : 100 - winPercent(scoreAfter);
  const reviewed: ReviewedMove = {
    ply,
    san: m.san,
    uci,
    side,
    fenBefore,
    fenAfter,
    scoreBefore,
    scoreAfter,
    best: trước.map((l) => ({ uci: l.uci, san: sanAt(fenBefore, l.uci), score: l.score })),
    cls,
    accuracy: moveAccuracy(wb, wa),
  };
  const facts = factsForMove(reviewed);

  // Đường đi tốt nhất, đổi ra SAN để nói thành lời
  const line: AssistVerdict['line'] = [];
  const đi = new Game(fenBefore);
  for (const u of top.pv ?? [top.uci]) {
    const turn = đi.turn;
    const x = đi.move(u.slice(0, 2) as Square, u.slice(2, 4) as Square, u[4]);
    if (!x) break;
    line.push({ uci: u, san: x.san, side: turn });
    if (line.length >= 4) break;
  }

  return {
    ply,
    side,
    san: m.san,
    uci,
    fenBefore,
    fenAfter,
    cls,
    why: whyText(facts),
    motif: (facts.the[0] as Motif | undefined) ?? null,
    best: isBest ? null : { uci: top.uci, san: line[0]?.san ?? top.uci, score: top.score },
    line,
    before: thếCờ(scoreBefore, side),
    after: thếCờ(scoreAfter, side),
  };
}

function sanAt(fen: string, uci: string): string {
  try {
    const g = new Game(fen);
    return g.move(uci.slice(0, 2) as Square, uci.slice(2, 4) as Square, uci[4])?.san ?? uci;
  } catch {
    return uci;
  }
}

/** "chiếu hết sau 3 nước" / "thế cờ đang hơn" — điều nước tốt nhất mang lại, nhìn từ bên đi. */
export function bestGain(v: AssistVerdict): string {
  if (!v.best) return '';
  const s = scoreFor(v.best.score, v.side);
  return s.mate !== undefined && s.mate > 0 ? `chiếu hết sau ${s.mate} nước` : `thế cờ ${thếCờ(v.best.score, v.side)}`;
}

/** Các nước tiếp theo nói bằng lời: "đối thủ đáp Mã f6, rồi bạn đi Tượng c4". */
export function lineText(v: AssistVerdict): string {
  const tiếp = v.line.slice(1, 4);
  if (!tiếp.length) return '';
  return tiếp
    .map((x, i) => `${i === 0 ? '' : 'rồi '}${x.side === v.side ? 'bạn đi' : 'đối thủ đáp'} ${sanVi(x.san)}`)
    .join(', ');
}
