// Hàng chờ ghép trận ngẫu nhiên theo trình độ.
//
// Nằm hết trong bộ nhớ: server khởi động lại thì hàng chờ rỗng, ai đang chờ sẽ
// phải bấm lại. Chấp nhận được, vì chờ chỉ tính bằng giây.
//
// Luật ghép: hai người cùng thể thức, và **cả hai cùng chịu** khoảng Elo giữa
// họ. Mỗi người có một khoảng chấp nhận nới dần theo thời gian đã chờ, nên
// người vừa vào không bị kéo vào trận lệch trình chỉ vì có ai đó đã chờ lâu.

import type { QueueState } from '../../shared/protocol.ts';

export interface Waiter {
  userId: number;
  name: string;
  rating: number;
  /** Khóa thể thức, ví dụ '5+0'. */
  control: string;
  /** Lúc vào hàng chờ, epoch ms. */
  since: number;
}

/** Khoảng Elo chấp nhận lúc mới vào. */
export const BAND_START = 100;
/** Cứ mỗi BAND_EVERY_MS thì nới thêm chừng này. */
export const BAND_STEP = 40;
export const BAND_EVERY_MS = 5_000;
/** Nới tối đa tới đây: chờ ~87 giây là ghép được với bất kỳ ai cùng thể thức. */
export const BAND_MAX = 800;

/** Khoảng Elo một người chịu ghép, sau khi đã chờ `waitedMs`. */
export function band(waitedMs: number): number {
  const steps = Math.floor(Math.max(0, waitedMs) / BAND_EVERY_MS);
  return Math.min(BAND_MAX, BAND_START + steps * BAND_STEP);
}

/** Hai người này ghép được với nhau chưa? */
export function fits(a: Waiter, b: Waiter, now: number): boolean {
  if (a.userId === b.userId) return false;
  if (a.control !== b.control) return false;
  const chịuĐược = Math.min(band(now - a.since), band(now - b.since));
  return Math.abs(a.rating - b.rating) <= chịuĐược;
}

export class Queue {
  private waiters = new Map<number, Waiter>();

  get size(): number {
    return this.waiters.size;
  }

  has(userId: number): boolean {
    return this.waiters.has(userId);
  }

  /** Vào hàng chờ. Vào lại khi đang chờ thì coi như đổi thể thức, tính giờ lại. */
  join(w: Waiter): void {
    this.waiters.set(w.userId, w);
  }

  leave(userId: number): boolean {
    return this.waiters.delete(userId);
  }

  /** Lấy ra những ai đã chờ ít nhất `ms` mà chưa ghép được — để cho bot vào thay. */
  takeWaitedOver(now: number, ms: number): Waiter[] {
    const out: Waiter[] = [];
    for (const w of this.waiters.values()) if (now - w.since >= ms) out.push(w);
    for (const w of out) this.waiters.delete(w.userId);
    return out;
  }

  /** Số người đang chờ cùng một thể thức. */
  waitingFor(control: string): number {
    let n = 0;
    for (const w of this.waiters.values()) if (w.control === control) n++;
    return n;
  }

  /** Thông tin để hiện lên màn tìm trận. */
  state(userId: number, now: number): QueueState | null {
    const me = this.waiters.get(userId);
    if (!me) return null;
    const waitedMs = Math.max(0, now - me.since);
    return { control: me.control, waitedMs, band: band(waitedMs), waiting: this.waitingFor(me.control) };
  }

  /**
   * Ghép được cặp nào thì lấy ra khỏi hàng chờ và trả về.
   *
   * Ai chờ lâu nhất được xét trước, và trong số những người ghép được thì chọn
   * người gần trình nhất — để trận đấu cân, chứ không phải vớ được ai hay nấy.
   */
  match(now: number): [Waiter, Waiter][] {
    const chờ = [...this.waiters.values()].sort((a, b) => a.since - b.since);
    const đãGhép = new Set<number>();
    const cặp: [Waiter, Waiter][] = [];

    for (const a of chờ) {
      if (đãGhép.has(a.userId)) continue;
      let tốtNhất: Waiter | null = null;
      let lệchÍtNhất = Infinity;
      for (const b of chờ) {
        if (đãGhép.has(b.userId) || b.userId === a.userId) continue;
        if (!fits(a, b, now)) continue;
        const lệch = Math.abs(a.rating - b.rating);
        if (lệch < lệchÍtNhất) {
          lệchÍtNhất = lệch;
          tốtNhất = b;
        }
      }
      if (tốtNhất) {
        đãGhép.add(a.userId);
        đãGhép.add(tốtNhất.userId);
        cặp.push([a, tốtNhất]);
      }
    }

    for (const id of đãGhép) this.waiters.delete(id);
    return cặp;
  }
}
