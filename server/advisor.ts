// Huấn luyện viên: gọi Ollama trên máy này, kiểm duyệt, rồi trả lời bình.
//
// Ollama KHÔNG bao giờ được mở ra ngoài: chỉ server này gọi nó. Một GPU dùng
// chung cho mọi người nên chỉ chạy một yêu cầu một lúc, có hàng chờ và hạn giờ;
// quá hạn thì trả câu mẫu chứ không bắt người học ngồi đợi.

import { createHash } from 'node:crypto';
import { one, type Db } from './db.ts';
import { cacheKey, SYSTEM_PROMPT, userPrompt } from '../shared/advisor/prompt.ts';
import { templateComment } from '../shared/advisor/templates.ts';
import { parseModelReply, validateComment } from '../shared/advisor/validate.ts';
import type { Facts } from '../shared/advisor/facts.ts';
import {
  COACH_PROMPT,
  COACH_VERSION,
  coachUserPrompt,
  factLines,
  templateAdvice,
  validateAdvice,
  type Advice,
  type CoachFacts,
} from '../shared/coach.ts';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'qwen3:8b';
/**
 * Quá thời gian này thì thôi, dùng câu mẫu. Để rộng vì lần gọi đầu sau khi máy
 * nghỉ lâu phải nạp lại mô hình; những lần sau chỉ mất vài giây.
 */
const TIMEOUT_MS = Number(process.env.ADVISOR_TIMEOUT_MS ?? 60_000);
/** Hàng chờ dài hơn mức này thì không nhận thêm. */
const MAX_QUEUE = 20;
/** Mỗi người tối đa ngần này lời bình LLM trong một giờ. */
const HOURLY_LIMIT = 60;

export type Source = 'llm' | 'template' | 'cache';

export interface AdvisorResult {
  comment: string;
  source: Source;
  /** Lý do không dùng được lời của mô hình, để đo chất lượng. */
  rejected?: string;
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/* ---------------- Hàng đợi ---------------- */

let running = 0;
let queued = 0;

async function withSlot<T>(fn: () => Promise<T>): Promise<T | null> {
  if (queued >= MAX_QUEUE) return null;
  queued++;
  try {
    // Một yêu cầu một lúc: GPU chỉ có một, chạy song song chỉ làm chậm cả hai
    while (running > 0) await new Promise((r) => setTimeout(r, 60));
    running++;
    try {
      return await fn();
    } finally {
      running--;
    }
  } finally {
    queued--;
  }
}

export function queueDepth(): number {
  return queued;
}

/* ---------------- Giới hạn theo người ---------------- */

const hits = new Map<number, number[]>();

export function withinLimit(userId: number, now = Date.now()): boolean {
  const list = (hits.get(userId) ?? []).filter((t) => now - t < 3600_000);
  hits.set(userId, list);
  return list.length < HOURLY_LIMIT;
}

function noteHit(userId: number, now = Date.now()): void {
  hits.set(userId, [...(hits.get(userId) ?? []), now]);
}

/* ---------------- Gọi Ollama ---------------- */

export async function ollamaAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function askOllama(facts: Facts): Promise<string | null> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      // Giữ mô hình thường trú: lần nạp đầu mất hàng chục giây vì 5,2 GB phải
      // vào card 6 GB, để nó rơi ra rồi nạp lại là người dùng phải chờ dài
      keep_alive: '15m',
      // Tắt phần "suy nghĩ" của qwen3: mình chỉ cần câu trả lời, nghĩ lâu chỉ tốn thời gian
      think: false,
      format: {
        type: 'object',
        properties: { giaiThich: { type: 'string' } },
        required: ['giaiThich'],
      },
      options: { temperature: 0.3, num_predict: 220 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(facts) },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? null;
}

/* ---------------- Đầu vào chính ---------------- */

export async function explain(db: Db, userId: number, rawFacts: Facts): Promise<AdvisorResult> {
  const fallback = templateComment(rawFacts);
  // Mô hình chỉ được diễn đạt lại nhận định đã kiểm chứng này
  const facts: Facts = { ...rawFacts, suThat: fallback };
  const key = hash(cacheKey(facts));

  const cached = one<{ comment: string; source: string }>(
    db,
    'SELECT comment, source FROM advisor_cache WHERE key = ?',
    key,
  );
  if (cached) return { comment: cached.comment, source: 'cache' };

  if (!withinLimit(userId)) return { comment: fallback, source: 'template', rejected: 'quá giới hạn mỗi giờ' };

  const raw = await withSlot(() => askOllama(facts).catch(() => null));
  if (raw === null) return { comment: fallback, source: 'template', rejected: 'không gọi được mô hình' };
  noteHit(userId);

  const text = parseModelReply(raw);
  if (!text) return { comment: fallback, source: 'template', rejected: 'câu trả lời sai dạng' };

  const verdict = validateComment(text, facts);
  if (!verdict.ok) return { comment: fallback, source: 'template', rejected: verdict.reason };

  db.prepare('INSERT OR REPLACE INTO advisor_cache (key, comment, source, created_at) VALUES (?, ?, ?, ?)').run(
    key,
    text,
    'llm',
    new Date().toISOString(),
  );
  return { comment: text, source: 'llm' };
}

/* ---------------- Huấn luyện viên: lời khuyên từ lịch sử ván ---------------- */

export interface AdviceResult {
  advice: Advice;
  source: Source;
  rejected?: string;
}

async function askCoach(lines: string[], lessons: { title: string; keyPoint: string }[]): Promise<string | null> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      keep_alive: '15m',
      think: false,
      format: {
        type: 'object',
        properties: { nhanXet: { type: 'string' }, loTrinh: { type: 'array', items: { type: 'string' } } },
        required: ['nhanXet', 'loTrinh'],
      },
      options: { temperature: 0.4, num_predict: 520 },
      messages: [
        { role: 'system', content: COACH_PROMPT },
        { role: 'user', content: coachUserPrompt(lines, lessons) },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? null;
}

/**
 * Lời khuyên tổng quát + vì sao nên học từng bài, từ các nhận định đã tính.
 * Nhận định không đổi thì dùng lại lời đã viết (không gọi mô hình lại).
 * Mô hình tắt, quá hạn, hay viết con số / ô cờ không có trong nhận định thì
 * dùng lời viết sẵn.
 */
export async function advise(
  db: Db,
  userId: number,
  facts: CoachFacts,
  lessons: { title: string; keyPoint: string }[],
): Promise<AdviceResult> {
  const lines = factLines(facts);
  const fallback = templateAdvice(facts, lessons);
  const key = hash(`${COACH_VERSION}|${JSON.stringify(lines)}|${lessons.map((l) => l.title).join('|')}`);
  const cached = one<{ comment: string }>(db, 'SELECT comment FROM advisor_cache WHERE key = ?', key);
  if (cached) {
    try {
      return { advice: JSON.parse(cached.comment) as Advice, source: 'cache' };
    } catch {
      /* đệm hỏng: viết lại */
    }
  }
  if (!withinLimit(userId)) return { advice: fallback, source: 'template', rejected: 'quá giới hạn mỗi giờ' };
  const raw = await withSlot(() => askCoach(lines, lessons).catch(() => null));
  if (raw === null) return { advice: fallback, source: 'template', rejected: 'không gọi được mô hình' };
  noteHit(userId);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { advice: fallback, source: 'template', rejected: 'câu trả lời sai dạng' };
  }
  const ok = validateAdvice(lines, lessons.length, parsed);
  if (!ok) return { advice: fallback, source: 'template', rejected: 'viết thêm điều không có trong nhận định' };
  db.prepare('INSERT OR REPLACE INTO advisor_cache (key, comment, source, created_at) VALUES (?, ?, ?, ?)').run(
    key,
    JSON.stringify(ok),
    'llm',
    new Date().toISOString(),
  );
  return { advice: ok, source: 'llm' };
}
