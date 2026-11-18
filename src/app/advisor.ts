// Dữ kiện của một nước đã chấm (xếp loại, mô-típ, nước tốt hơn), dựng ở trình
// duyệt vì ở đây mới có kết quả engine. Bảng xem lại dùng nó để viết câu "vì sao"
// bằng lời viết sẵn — không gọi AI cho từng nước.

import { buildFacts, type Facts } from '../../shared/advisor/facts.ts';
import { detectMotifs } from '../../shared/advisor/motifs.ts';
import { material } from '../../shared/fen.ts';
import type { ReviewedMove } from '../analysis/review.ts';

/** Dựng gói dữ kiện cho một nước đã chấm. */
export function factsForMove(m: ReviewedMove): Facts {
  const sign = m.side === 'w' ? 1 : -1;
  const motifs = detectMotifs({
    fenBefore: m.fenBefore,
    fenAfter: m.fenAfter,
    san: m.san,
    side: m.side,
    replyUci: m.best[0]?.uci,
    hadMate: m.scoreBefore.mate !== undefined && sign * m.scoreBefore.mate > 0,
    allowsMate: m.scoreAfter.mate !== undefined && sign * m.scoreAfter.mate < 0,
    materialBefore: sign * material(m.fenBefore).diff,
    materialAfter: sign * material(m.fenAfter).diff,
  });
  return buildFacts({
    side: m.side,
    ply: m.ply,
    san: m.san,
    cls: m.cls,
    best: m.best,
    pv: [],
    motifs,
    material: { truoc: sign * material(m.fenBefore).diff, sau: sign * material(m.fenAfter).diff },
  });
}
