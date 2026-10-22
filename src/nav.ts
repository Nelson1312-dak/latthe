/**
 * Đồ thị đường đi và tìm đường.
 *
 * Cố tình KHÔNG dùng A* trên lưới điều hướng: bản đồ chỉ vài chục đỉnh và chỉ đổi đúng những
 * lúc người chơi mở rộng đảo, nên tìm theo chiều rộng là đủ và kết quả còn đem ghi nhớ được.
 * Mỗi cặp điểm chỉ tính một lần cho cả ván, sau đó là tra bảng — gần như không tốn gì, kể cả
 * khi có vài chục thợ cùng chạy trên máy văn phòng yếu.
 *
 * Đỉnh gồm: ngã tư của lưới phố, lối rẽ vào từng ô đất, và các điểm tài nguyên.
 *
 * Đồ thị DỰNG LẠI ĐƯỢC, vì mở bậc lãnh thổ sẽ đẩy vành cây và mỏ ra xa. Dựng lại phải xoá
 * luôn bộ nhớ đường đã tính — quên bước đó thì thợ vẫn đi theo quãng đường cũ tới chỗ mới,
 * và đó là kiểu lỗi chỉ lộ ra sau khi người chơi đã mở rộng đảo.
 */
import { WAYPOINTS, resourceNodes } from './config';
import type { Vec3 } from './types';

const positions = new Map<string, Vec3>();
const neighbours = new Map<string, string[]>();
const cache = new Map<string, string[]>();

function link(a: string, b: string): void {
  const list = neighbours.get(a);
  if (list && !list.includes(b)) list.push(b);
}

/** Dựng lại đồ thị cho một bậc lãnh thổ. Gọi lúc khởi động và sau mỗi lần mở rộng đảo. */
export function rebuildNav(tier: number): void {
  positions.clear();
  neighbours.clear();
  cache.clear();

  for (const w of WAYPOINTS) {
    positions.set(w.id, w.position);
    neighbours.set(w.id, []);
  }
  for (const n of resourceNodes(tier)) {
    positions.set(n.id, n.position);
    neighbours.set(n.id, []);
  }
  // config khai báo cạnh một chiều cho dễ đọc; ở đây khép lại cho đủ hai chiều.
  for (const w of WAYPOINTS) {
    for (const to of w.links) {
      if (!neighbours.has(to)) continue;
      link(w.id, to);
      link(to, w.id);
    }
  }
  for (const n of resourceNodes(tier)) {
    link(n.id, n.waypoint);
    link(n.waypoint, n.id);
  }
}

rebuildNav(1);

export function positionOf(id: string): Vec3 {
  const p = positions.get(id);
  if (!p) throw new Error(`Không có điểm "${id}" trong đồ thị.`);
  return p;
}

export function hasPoint(id: string): boolean {
  return positions.has(id);
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

/**
 * Đường ngắn nhất theo SỐ CHẶNG, trả về danh sách điểm phải đi qua, KHÔNG gồm điểm xuất phát.
 * Mảng rỗng nghĩa là đã ở đó rồi, hoặc không có đường.
 */
export function shortestPath(from: string, to: string): string[] {
  if (from === to) return [];
  const key = `${from}>${to}`;
  const hit = cache.get(key);
  if (hit) return hit.slice();

  const prev = new Map<string, string>();
  const seen = new Set<string>([from]);
  const queue: string[] = [from];
  while (queue.length) {
    const cur = queue.shift() as string;
    for (const next of neighbours.get(cur) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, cur);
      if (next === to) {
        const path: string[] = [];
        for (let at: string | undefined = to; at && at !== from; at = prev.get(at)) path.unshift(at);
        cache.set(key, path);
        return path.slice();
      }
      queue.push(next);
    }
  }
  cache.set(key, []);
  return [];
}

/** Quãng đường thật (không phải số chặng) khi đi từ `from` theo đường `path`. */
export function pathLength(from: string, path: string[]): number {
  let total = 0;
  let at = positionOf(from);
  for (const id of path) {
    const p = positionOf(id);
    total += distance(at, p);
    at = p;
  }
  return total;
}
