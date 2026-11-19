// Gọi server cho phần ôn tập.

import { auth } from './session.ts';

export interface Card {
  id: number;
  fen: string;
  played_uci: string;
  best_uci: string;
  best_san: string;
  cls: string;
  box: number;
  due_at: string;
  wrong_count: number;
}

export interface Puzzle {
  id: string;
  /** Thế cờ TRƯỚC nước của đối phương. */
  fen: string;
  /** Nước đầu là của đối phương, phần còn lại là lời giải. */
  moves: string[];
  rating: number;
  themes: string[];
}

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

async function post<T>(path: string, body: unknown, fallback: T): Promise<T> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export const dueCards = () =>
  auth.user
    ? get<{ cards: Card[]; total: number; due: number }>('/api/cards', { cards: [], total: 0, due: 0 })
    : Promise.resolve({ cards: [], total: 0, due: 0 });

export const answerCard = (id: number, correct: boolean) =>
  post<{ card: Card | null }>('/api/cards/answer', { id, correct }, { card: null });

export const nextPuzzle = (theme?: string) =>
  get<{ puzzle: Puzzle | null; rating?: number; kho: number }>(
    `/api/puzzles/next${theme ? `?theme=${encodeURIComponent(theme)}` : ''}`,
    { puzzle: null, kho: 0 },
  );

export const puzzleById = (id: string) =>
  get<{ puzzle: Puzzle | null; kho: number }>(`/api/puzzles/one?id=${encodeURIComponent(id)}`, { puzzle: null, kho: 0 });

export const answerPuzzle = (id: string, rating: number, correct: boolean) =>
  post<{ rating: number; attempts: number }>('/api/puzzles/answer', { id, rating, correct }, { rating: 0, attempts: 0 });

export const puzzleThemes = () =>
  get<{ themes: { theme: string; count: number }[]; kho: number }>('/api/puzzles/themes', { themes: [], kho: 0 });

export interface Progress {
  rating: number;
  attempts: number;
  correct: number;
  streak: number;
  the: { total: number; due: number };
  hopThe: { box: number; c: number }[];
  chuDeHaySai: { cls: string; c: number }[];
}

export const progress = () =>
  auth.user
    ? get<Progress | null>('/api/progress', null)
    : Promise.resolve(null);

/** Tên chủ đề bằng tiếng Việt. Chủ đề lạ thì giữ nguyên tên gốc. */
export const THEME_VI: Record<string, string> = {
  fork: 'Đòn đôi',
  pin: 'Ghim quân',
  skewer: 'Đòn xiên',
  hangingPiece: 'Quân bị bỏ hở',
  discoveredAttack: 'Đòn mở',
  doubleCheck: 'Chiếu đôi',
  mateIn1: 'Chiếu hết 1 nước',
  mateIn2: 'Chiếu hết 2 nước',
  mateIn3: 'Chiếu hết 3 nước',
  backRankMate: 'Chiếu hết hàng cuối',
  smotheredMate: 'Chiếu hết nghẹt thở',
  deflection: 'Đánh lạc hướng',
  attraction: 'Dụ quân',
  clearance: 'Dọn đường',
  interference: 'Cắt đường',
  trappedPiece: 'Quân bị kẹt',
  defensiveMove: 'Nước phòng thủ',
  capturingDefender: 'Ăn quân phòng thủ',
  advancedPawn: 'Tốt vượt xa',
  promotion: 'Phong cấp',
  endgame: 'Tàn cuộc',
  rookEndgame: 'Tàn cuộc Xe',
  pawnEndgame: 'Tàn cuộc Tốt',
  queenEndgame: 'Tàn cuộc Hậu',
  bishopEndgame: 'Tàn cuộc Tượng',
  knightEndgame: 'Tàn cuộc Mã',
};

export const themeName = (t: string): string => THEME_VI[t] ?? t;

/* ---------------- Bài học ---------------- */

export const doneLessons = () => get<{ done: string[] }>('/api/lessons', { done: [] });

export const markLessonDone = (id: string) => post<{ ok: boolean }>('/api/lessons', { id }, { ok: false });
