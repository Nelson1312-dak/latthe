// Gửi ván đã chơi lên server. Không đăng nhập thì bỏ qua, không làm phiền người chơi.

import { auth } from './session.ts';

export interface FinishedGame {
  mode: 'bot' | 'human';
  level?: number;
  playerSide: 'w' | 'b';
  pgn: string;
  winner: 'w' | 'b' | 'draw';
  reason: string;
}

/** Lưu ván. Trả về id của ván trên server, null nếu không lưu được (chưa đăng nhập, mất mạng). */
export async function saveFinishedGame(game: FinishedGame): Promise<number | null> {
  if (!auth.user) return null;
  try {
    const res = await fetch('/api/games', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(game),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { id?: number }).id ?? null;
  } catch {
    // Mất mạng thì thôi: ván vẫn còn trên màn hình, không chặn người chơi
    return null;
  }
}

export interface GameRow {
  id: number;
  mode: 'bot' | 'human' | 'online';
  level: number | null;
  playerSide: 'w' | 'b';
  winner: 'w' | 'b' | 'draw';
  reason: string;
  moveCount: number;
  createdAt: string;
  /** Chỉ ván online mới có. */
  opponentName: string | null;
  opponentRating: number | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
}

export async function recentGames(): Promise<GameRow[]> {
  if (!auth.user) return [];
  try {
    const res = await fetch('/api/games', { credentials: 'same-origin' });
    if (!res.ok) return [];
    return ((await res.json()) as { games: GameRow[] }).games;
  } catch {
    return [];
  }
}
