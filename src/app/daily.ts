// Bài tập của ngày, phía trình duyệt.

import type { Puzzle } from './training.ts';

export interface DailyMe {
  done: boolean;
  correct: boolean;
  streak: number;
}

export interface Daily {
  day: string;
  puzzle: Puzzle | null;
  /** null khi chưa đăng nhập. */
  me: DailyMe | null;
  count: { tried: number; solved: number };
}

let daily: Daily | null = null;

export const currentDaily = (): Daily | null => daily;

export async function loadDaily(): Promise<Daily | null> {
  try {
    const r = await fetch('/api/daily', { credentials: 'same-origin' });
    if (!r.ok) return null;
    daily = (await r.json()) as Daily;
    // Khách chưa đăng nhập: nhớ trong trình duyệt là hôm nay đã làm chưa
    if (!daily.me) {
      const g = guestResult(daily.day);
      if (g !== null) daily.me = { done: true, correct: g, streak: 0 };
    }
    return daily;
  } catch {
    return null;
  }
}

function guestResult(day: string): boolean | null {
  try {
    const v = localStorage.getItem(`daily:${day}`);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

/** Ghi kết quả bài của ngày. Đã đăng nhập thì lên server (giữ chuỗi), chưa thì nhớ trong trình duyệt. */
export async function answerDaily(id: string, correct: boolean, loggedIn: boolean): Promise<DailyMe | null> {
  if (!daily || daily.puzzle?.id !== id) return null;
  if (!loggedIn) {
    try {
      if (localStorage.getItem(`daily:${daily.day}`) === null) localStorage.setItem(`daily:${daily.day}`, correct ? '1' : '0');
    } catch {
      /* bỏ qua */
    }
    daily.me = { done: true, correct: guestResult(daily.day) ?? correct, streak: 0 };
    return daily.me;
  }
  try {
    const r = await fetch('/api/daily/answer', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, correct }),
    });
    if (!r.ok) return null;
    daily.me = ((await r.json()) as { me: DailyMe }).me;
    return daily.me;
  } catch {
    return null;
  }
}
