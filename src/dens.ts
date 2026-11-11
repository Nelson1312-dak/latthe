/*
 * HANG THÚ — phần thuần tuý, không biết gì về hình ảnh hay bản lưu.
 *
 * Một hang là một hàm của toạ độ khối: cùng khối thì cùng hang, ở mọi máy và mọi lần mở
 * game, nên bản lưu chỉ phải nhớ mã những hang đã dẹp. Mọi con số ngẫu nhiên ở đây lấy từ
 * `hash2` với muối riêng (61–69) chứ KHÔNG rút từ `chunkRng` của khối: rút thêm một số từ
 * dãy ấy là mọi bãi tài nguyên và cây cối trong mọi bản lưu dịch chỗ.
 */
import {
  BEAST_BY_BIOME, DEN_CHANCE, DEN_FEAR, DEN_MAX_LEVEL, DEN_MIN_DIST, DEN_POWER, HUNT_LOSS,
  HUNT_POWER, SMITH_ATTACK,
} from './config';
import type { BeastKind } from './config';
import type { BiomeId, Cost, Patch, Troops } from './types';
import { TROOP_KINDS } from './types';
import { CHUNK, ROAD_SPACING, biomeAt, chunkOf, hash2 } from './world';

export interface Den {
  id: string;
  cx: number;
  cz: number;
  x: number;
  z: number;
  kind: BeastKind;
  biome: BiomeId;
  /** 1 tới `DEN_MAX_LEVEL`, tăng theo khoảng cách tới thủ phủ. */
  level: number;
}

const nho = new Map<string, Den | null>();

/** Cách trục đường gần nhất bao xa. Hang không nằm chắn lối đi của xe thồ. */
function cachDuong(v: number): number {
  return Math.abs(v - Math.round(v / ROAD_SPACING) * ROAD_SPACING);
}

export function denOf(cx: number, cz: number): Den | null {
  const key = `${cx},${cz}`;
  const co = nho.get(key);
  if (co !== undefined) return co;
  if (nho.size > 6000) nho.clear();

  let den: Den | null = null;
  const xa = Math.hypot((cx + 0.5) * CHUNK, (cz + 0.5) * CHUNK);
  if (xa >= DEN_MIN_DIST && hash2(cx, cz, 61) < DEN_CHANCE) {
    // Bốn lần thử chỗ; khối nào cả bốn đều rơi lên đường thì thôi không có hang.
    for (let t = 0; t < 4 && !den; t += 1) {
      const x = (cx + 0.2 + 0.6 * hash2(cx, cz, 62 + t * 2)) * CHUNK;
      const z = (cz + 0.2 + 0.6 * hash2(cx, cz, 63 + t * 2)) * CHUNK;
      if (cachDuong(x) < 7 || cachDuong(z) < 7) continue;
      const biome = biomeAt(x, z);
      den = {
        id: `d_${cx}_${cz}`, cx, cz, x, z, biome,
        kind: BEAST_BY_BIOME[biome],
        level: Math.min(DEN_MAX_LEVEL, 1 + Math.floor((xa - DEN_MIN_DIST) / 70)),
      };
    }
  }
  nho.set(key, den);
  return den;
}

export function denById(id: string): Den | null {
  const m = /^d_(-?\d+)_(-?\d+)$/.exec(id);
  return m ? denOf(Number(m[1]), Number(m[2])) : null;
}

export function denPower(d: Den): number {
  return Math.round(DEN_POWER * d.level * (1 + 0.3 * (d.level - 1)));
}

/** Dẹp xong thì được gì. Vàng tăng nhanh hơn cấp: hang xa đáng công đi hơn hẳn hang gần. */
export function denLoot(d: Den): Cost {
  const loot: Cost = {
    gold: Math.round(60 * d.level * (1 + 0.5 * (d.level - 1))),
    food: 80 * d.level,
  };
  if (d.level >= 2) loot.relics = Math.floor(d.level / 2);
  return loot;
}

export function huntPower(army: Troops, attack: number): number {
  let p = 0;
  for (const k of TROOP_KINDS) p += army[k] * HUNT_POWER[k];
  return Math.floor(p * (1 + attack * SMITH_ATTACK));
}

/** Số người ngã. Tỉ lệ nghịch với độ áp đảo, làm tròn XUỐNG — đội đủ đông thì về đủ. */
export function huntLosses(army: Troops, have: number, need: number): Troops {
  const phan = have > 0 ? HUNT_LOSS * Math.min(1, need / have) : 0;
  return {
    spear: Math.floor(army.spear * phan),
    archer: Math.floor(army.archer * phan),
    horse: Math.floor(army.horse * phan),
  };
}

const ganBai = new Map<string, Den | null>();

/** Hang gần nhất đang đủ gần để quấy một bãi — CHƯA xét hang ấy đã dẹp hay chưa. */
export function denNearPatch(p: Patch): Den | null {
  const co = ganBai.get(p.id);
  if (co !== undefined) return co;
  if (ganBai.size > 6000) ganBai.clear();
  const cx = chunkOf(p.center[0]);
  const cz = chunkOf(p.center[2]);
  let best: Den | null = null;
  let bestD = DEN_FEAR;
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      const d = denOf(cx + dx, cz + dz);
      if (!d) continue;
      const xa = Math.hypot(d.x - p.center[0], d.z - p.center[2]);
      if (xa <= bestD) { best = d; bestD = xa; }
    }
  }
  ganBai.set(p.id, best);
  return best;
}
