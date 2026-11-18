// Huấn luyện viên (Hồ sơ): nhận định từ lịch sử ván, và lời khuyên AI viết.
// Hai lời gọi riêng: nhận định có ngay; lời khuyên có thể mất vài chục giây lần đầu.

import type { CoachFacts, Advice } from '../../shared/coach.ts';

export interface CoachData {
  facts: CoachFacts | null;
  need: number;
  lessons: { id: string; title: string; keyPoint: string }[];
}

export async function loadCoach(): Promise<CoachData | null> {
  try {
    const r = await fetch('/api/coach', { credentials: 'same-origin' });
    return r.ok ? ((await r.json()) as CoachData) : null;
  } catch {
    return null;
  }
}

export async function loadAdvice(): Promise<{ advice: Advice | null; source: string } | null> {
  try {
    const r = await fetch('/api/coach/advice', { credentials: 'same-origin' });
    return r.ok ? ((await r.json()) as { advice: Advice | null; source: string }) : null;
  } catch {
    return null;
  }
}
