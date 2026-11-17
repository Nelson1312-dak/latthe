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

export async function saveFinishedGame(game: FinishedGame): Promise<void> {
  if (!auth.user) return;
  try {
    await fetch('/api/games', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(game),
    });
  } catch {
    // Mất mạng thì thôi: ván vẫn còn trên màn hình, không chặn người chơi
  }
}

export interface GameRow {
  id: number;
  mode: 'bot' | 'human';
  level: number | null;
  playerSide: 'w' | 'b';
  winner: 'w' | 'b' | 'draw';
  reason: string;
  moveCount: number;
  createdAt: string;
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
