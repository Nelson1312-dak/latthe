// Huấn luyện viên: nhận định từ lịch sử ván (máy chủ tính từ bảng game_insights),
// và lời khuyên AI viết. Hai lời gọi riêng: nhận định có ngay; lời khuyên có thể
// mất vài chục giây lần đầu (mô hình phải nạp).
//
// Nhớ tạm một lúc vì nhiều chỗ cùng dùng (tab Huấn luyện viên, Sảnh, tab Học,
// Hồ sơ); xong một ván thì quên đi để lần sau lấy số mới.

import type { CoachFacts, Advice } from '../../shared/coach.ts';
import { auth } from './session.ts';

export interface CoachData {
  facts: CoachFacts | null;
  need: number;
  /** Ván đang chờ máy chủ chấm. */
  pending: number;
  lessons: { id: string; title: string; keyPoint: string }[];
}

export interface AdviceData {
  advice: Advice | null;
  source: string;
}

const NHỚ_MS = 60_000;
let coach: { at: number; userId: number; p: Promise<CoachData | null> } | null = null;
let advice: { at: number; userId: number; p: Promise<AdviceData | null> } | null = null;

/** Quên số cũ (vừa xong một ván, vừa học xong một bài). */
export function invalidateCoach(): void {
  coach = null;
  advice = null;
}

export function loadCoach(): Promise<CoachData | null> {
  const u = auth.user?.id;
  if (!u) return Promise.resolve(null);
  if (coach && coach.userId === u && Date.now() - coach.at < NHỚ_MS) return coach.p;
  const p = fetch('/api/coach', { credentials: 'same-origin' })
    .then((r) => (r.ok ? (r.json() as Promise<CoachData>) : null))
    .catch(() => null);
  coach = { at: Date.now(), userId: u, p };
  return p;
}

export function loadAdvice(): Promise<AdviceData | null> {
  const u = auth.user?.id;
  if (!u) return Promise.resolve(null);
  if (advice && advice.userId === u && Date.now() - advice.at < NHỚ_MS) return advice.p;
  const p = fetch('/api/coach/advice', { credentials: 'same-origin' })
    .then((r) => (r.ok ? (r.json() as Promise<AdviceData>) : null))
    .catch(() => null);
  advice = { at: Date.now(), userId: u, p };
  return p;
}
