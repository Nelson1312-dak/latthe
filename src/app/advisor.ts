// Gọi Huấn luyện viên.
//
// Dữ kiện dựng ở trình duyệt (vì ở đây mới có kết quả engine), server chỉ lo
// phần gọi mô hình ngôn ngữ và kiểm duyệt.

import { buildFacts, type Facts } from '../../shared/advisor/facts.ts';
import { detectMotifs } from '../../shared/advisor/motifs.ts';
import { templateComment } from '../../shared/advisor/templates.ts';
import { material } from '../../shared/fen.ts';
import type { ReviewedMove } from '../analysis/review.ts';

export interface Comment {
  comment: string;
  source: 'llm' | 'template' | 'cache';
  rejected?: string;
}

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

/** Xin lời bình. Không gọi được server thì vẫn có câu mẫu, không để trống. */
export async function explainMove(facts: Facts): Promise<Comment> {
  try {
    const res = await fetch('/api/advisor/explain', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ facts }),
    });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Comment;
  } catch {
    return { comment: templateComment(facts), source: 'template' };
  }
}

export interface AdvisorStatus {
  ollama: boolean;
  hangCho: number;
}

export async function advisorStatus(): Promise<AdvisorStatus> {
  try {
    const res = await fetch('/api/advisor/status', { credentials: 'same-origin' });
    if (!res.ok) return { ollama: false, hangCho: 0 };
    return (await res.json()) as AdvisorStatus;
  } catch {
    return { ollama: false, hangCho: 0 };
  }
}
