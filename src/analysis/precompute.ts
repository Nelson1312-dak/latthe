// Chấm ngầm trong lúc chơi: mỗi thế cờ vừa có là đem đi phân tích ngay, bằng một
// engine RIÊNG (không đụng engine đang đánh với bạn). Hết ván, bảng chấm chỉ việc
// lấy kết quả đã có — gần như không phải chờ.
//
// Ván online cũng chấm ngầm, nhưng kết quả chỉ hiện khi ván đã xong.
//
// Cùng thời gian nghĩ và số dòng với lúc chấm ván, nên chấm ngầm hay chấm sau
// đều ra đúng một kết quả.

import { Engine } from '../engine/engine.ts';
import type { Score } from '../../shared/winrate.ts';
import type { Analyser } from './review.ts';

export const REVIEW_MS = 300;
export const REVIEW_PV = 2;
/** Nhớ tối đa ngần này thế cờ (một ván dài ~150), bỏ cái cũ nhất. */
const MAX_CACHE = 600;

type Lines = { uci: string; score: Score }[];

interface Job {
  done: Promise<Lines>;
  resolve: (l: Lines) => void;
  reject: (e: unknown) => void;
}

let eng: Engine | null = null;
const cache = new Map<string, Lines>();
const jobs = new Map<string, Job>();
/** Việc gấp (bảng chấm đang chờ) đi trước việc chấm ngầm. */
const urgent: string[] = [];
const background: string[] = [];
let running = false;

function job(fen: string): Job {
  let j = jobs.get(fen);
  if (!j) {
    let resolve!: (l: Lines) => void;
    let reject!: (e: unknown) => void;
    const done = new Promise<Lines>((ok, no) => {
      resolve = ok;
      reject = no;
    });
    done.catch(() => {}); // việc chấm ngầm hỏng thì thôi, không ai chờ
    j = { done, resolve, reject };
    jobs.set(fen, j);
  }
  return j;
}

function remember(fen: string, lines: Lines): void {
  cache.set(fen, lines);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
}

async function pump(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const fen = urgent.shift() ?? background.shift();
      if (fen === undefined) break;
      const j = jobs.get(fen);
      if (!j) continue; // đã xong ở lượt trước
      const có = cache.get(fen);
      if (có) {
        jobs.delete(fen);
        j.resolve(có);
        continue;
      }
      try {
        eng ??= new Engine();
        const a = await eng.analyse(fen, { movetimeMs: REVIEW_MS, multipv: REVIEW_PV });
        const lines = a.lines.map((l) => ({ uci: l.uci, score: l.score }));
        remember(fen, lines);
        jobs.delete(fen);
        j.resolve(lines);
      } catch (err) {
        jobs.delete(fen);
        j.reject(err);
      }
    }
  } finally {
    running = false;
  }
}

/** Đem các thế cờ của ván đang chơi đi chấm ngầm (thế nào chấm rồi thì bỏ qua). */
export function preAnalyse(fens: readonly string[]): void {
  for (const fen of fens) {
    if (cache.has(fen) || jobs.has(fen)) continue;
    job(fen);
    background.push(fen);
  }
  void pump();
}

/** Bỏ các thế cờ đang chờ chấm ngầm (ván mới). Kết quả đã có vẫn giữ. */
export function dropBackground(): void {
  for (const fen of background.splice(0)) {
    if (!urgent.includes(fen)) jobs.delete(fen);
  }
}

/** Kết quả một thế cờ: có sẵn thì trả ngay, chưa có thì chấm trước mọi việc ngầm. */
export function analyseNow(fen: string): Promise<Lines> {
  const có = cache.get(fen);
  if (có) return Promise.resolve(có);
  const j = job(fen);
  urgent.push(fen);
  void pump();
  return j.done;
}

/** Đã có sẵn kết quả cho thế cờ này chưa (để báo tiến độ cho đúng). */
export const isAnalysed = (fen: string): boolean => cache.has(fen);

/** Bộ chấm dùng cho reviewGame: lấy từ kết quả chấm ngầm. */
export const cachedAnalyser: Analyser = {
  async analyse(fen) {
    return { lines: await analyseNow(fen) };
  },
};
