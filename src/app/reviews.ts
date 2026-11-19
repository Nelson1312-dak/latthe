// Gọi server cho phần xem lại ván.

import type { ReviewResult } from '../analysis/review.ts';
import { auth } from './session.ts';

export interface GameDetail {
  id: number;
  pgn: string;
  mode: 'bot' | 'human' | 'online';
  level: number | null;
  playerSide: 'w' | 'b';
  winner: 'w' | 'b' | 'draw';
  reason: string;
  createdAt: string;
  /** Chỉ ván online mới có. */
  opponentName?: string | null;
  opponentRating?: number | null;
  /** Elo của mình lúc vào ván (ván online). */
  ratingBefore?: number | null;
}

export async function fetchGame(id: number): Promise<{ game: GameDetail; review: ReviewResult | null } | null> {
  try {
    const res = await fetch(`/api/games/${id}`, { credentials: 'same-origin' });
    if (!res.ok) return null;
    return (await res.json()) as { game: GameDetail; review: ReviewResult | null };
  } catch {
    return null;
  }
}

/** Lưu kết quả chấm. Trả về số thẻ ôn tập mới sinh ra. */
export async function saveReview(gameId: number, review: ReviewResult): Promise<number> {
  if (!auth.user) return 0;
  try {
    const res = await fetch(`/api/games/${gameId}/review`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ review }),
    });
    if (!res.ok) return 0;
    return ((await res.json()) as { newCards: number }).newCards ?? 0;
  } catch {
    return 0;
  }
}
