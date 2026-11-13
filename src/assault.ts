/**
 * TẤN CÔNG LÀNG KHÁC — phần luật thuần, dùng chung cho máy chủ và trình duyệt.
 *
 * Máy chủ chạy trận bằng ĐÚNG `battleStart`/`battleStep` mà trình duyệt dùng để diễn lại,
 * nên kết quả máy chủ báo và cái người chơi xem trên màn không thể lệch nhau — đó là lý do
 * `battle.ts` không có `Math.random` và không biết gì về đồng hồ thật.
 *
 * File này không import Three.js hay Economy: nó phải chạy được trong Node.
 */
import { SMITH_ARMOUR, SMITH_ATTACK, TROOPS } from './config';
import { MAX_TICKS, battleStart, battleStep } from './battle';
import type { BattleSeed } from './battle';
import { RESOURCE_KINDS, TROOP_KINDS, noTroops } from './types';
import type { ResourceKind, Troops } from './types';

/** Một làng bị đánh mất tối đa ngần này mỗi loại hàng nếu bên công vét sạch (lọt 100%). */
export const LOOT_SHARE = 0.25;
/** Phần kho được GIỮ nguyên, không ai cướp được — như hầm kho của người mới. */
export const LOOT_PROTECTED = 150;
/** Sau khi bị đánh, làng được che chắn ngần này giây (trận thành công nhiều thì lâu hơn). */
export const SHIELD_SECONDS = 4 * 3600;
export const SHIELD_SECONDS_LIGHT = 30 * 60;
/** Một cặp (bên công, bên thủ) phải chờ ngần này giây mới được đánh lại. */
export const REPEAT_COOLDOWN = 3600;
/** Trần số lính một lượt đem đi — cũng là trần ArmyManager vẽ nổi. */
export const MAX_SENT = 120;

export type Loot = Record<ResourceKind, number>;

/** Một làng trong danh sách có thể đánh — phần công khai máy chủ trả về. */
export interface Opponent {
  id: string;
  name: string;
  color: number;
  level: number;
  age: number;
  power: number;
  /** Cướp tối đa được bao nhiêu nếu bên công lọt 100%. */
  loot: Loot;
  difficulty: 'easy' | 'fair' | 'hard' | 'deadly';
  /** Giây còn phải chờ nếu đã đánh làng này gần đây; 0 là đánh được. */
  wait: number;
}

/** Kết quả một lần đánh, đúng như máy chủ trả. */
export interface AttackReply {
  seed: BattleSeed;
  outcome: AssaultOutcome;
  loot: Loot;
  targetName: string;
  shieldUntil: number;
}

/** Một vụ cướp nhằm vào làng mình, nhận khi đồng bộ. */
export interface RaidNote { id: number; at: number; byName: string; lootFrac: number; loot: Loot }

/** Ảnh chụp một làng: đủ để dựng lại phần THỦ của một trận, không hơn. */
export interface VillageSnapshot {
  name: string;
  color: number;
  level: number;
  age: number;
  towers: { x: number; z: number; level: number }[];
  army: Troops;
  smith: { attack: number; armour: number };
  /** Dân ở nhà — thủ phủ bắn mạnh hơn nhờ họ. */
  militia: number;
  inv: Record<ResourceKind, number>;
}

const num = (v: unknown, lo: number, hi: number, dflt = lo): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : dflt;
  return Math.min(hi, Math.max(lo, n));
};

export function sanitizeTroops(raw: unknown, cap = 500): Troops {
  const out = noTroops();
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  for (const k of TROOP_KINDS) out[k] = Math.floor(num(o[k], 0, cap));
  return out;
}

/**
 * Lọc một ảnh chụp do trình duyệt gửi lên. Máy chủ KHÔNG tin con số nào: kẹp mọi thứ vào
 * khoảng hợp lý, bỏ trường lạ, cắt chuỗi. Kẹp chỉ chặn được dữ liệu vô lý chứ không chặn
 * được dữ liệu bịa hợp lý — xem ghi chú ở server/core.ts.
 */
export function sanitizeSnapshot(raw: unknown): VillageSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const towersRaw = Array.isArray(r.towers) ? r.towers.slice(0, 24) : [];
  const towers = towersRaw.map((t) => {
    const o = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>;
    return { x: num(o.x, -70, 70, 0), z: num(o.z, -70, 70, 0), level: Math.floor(num(o.level, 1, 30, 1)) };
  });
  const smithRaw = (r.smith && typeof r.smith === 'object' ? r.smith : {}) as Record<string, unknown>;
  const invRaw = (r.inv && typeof r.inv === 'object' ? r.inv : {}) as Record<string, unknown>;
  const inv = {} as Record<ResourceKind, number>;
  for (const k of RESOURCE_KINDS) inv[k] = Math.floor(num(invRaw[k], 0, 1e7, 0));
  const name = typeof r.name === 'string' ? r.name.replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 24) : '';
  return {
    name: name || 'Village',
    color: Math.floor(num(r.color, 0, 0xffffff, 0xaaaaaa)),
    level: Math.floor(num(r.level, 1, 200, 1)),
    age: Math.floor(num(r.age, 1, 5, 1)),
    towers,
    army: sanitizeTroops(r.army),
    smith: {
      attack: Math.floor(num(smithRaw.attack, 0, 12, 0)),
      armour: Math.floor(num(smithRaw.armour, 0, 12, 0)),
    },
    militia: Math.floor(num(r.militia, 0, 600, 0)),
    inv,
  };
}

/**
 * Điểm sức của một làng, để ghép đối thủ ngang nhau. Cố ý đơn giản: quân tính theo máu và
 * đòn, tháp theo cấp, bậc rèn nhân thêm. Không phải thước đo công bằng tuyệt đối — chỉ cần
 * đủ để người mới không bị dội vào làng cấp cao.
 */
export function powerOf(s: Pick<VillageSnapshot, 'level' | 'army' | 'towers' | 'smith'>): number {
  let p = s.level * 2;
  for (const t of s.towers) p += 6 + 5 * t.level;
  p += armyPowerOf(s.army, s.smith);
  return Math.round(p);
}

/**
 * Sức một ĐỘI QUÂN (không tính tháp, không tính cấp làng): thứ so với sức của làng bị đánh
 * để biết trận này dễ hay khó. Làng thủ có thêm tháp và dân ở nhà, nên hai bên bằng điểm thì
 * bên công đã thua — xem `difficultyOf`.
 */
export function armyPowerOf(army: Troops, smith: { attack: number; armour: number }): number {
  let p = 0;
  for (const k of TROOP_KINDS) p += army[k] * (TROOPS[k].hp * 0.08 + TROOPS[k].dps * 0.5);
  return Math.round(p * (1 + 0.05 * (smith.attack + smith.armour)));
}

/**
 * Độ khó một trận: tỉ số sức làng bị đánh trên sức đội quân mang đi. Thang đo từ mô phỏng
 * thật (tools: xem ghi chú bảo trì): dưới 0,4 là cướp nhẹ nhàng, quanh 0,6 là cân tài cân
 * sức, trên 0,85 gần như chắc thua.
 */
export function difficultyOf(defPower: number, sentPower: number): 'easy' | 'fair' | 'hard' | 'deadly' {
  const r = defPower / Math.max(1, sentPower);
  return r < 0.4 ? 'easy' : r < 0.65 ? 'fair' : r < 0.85 ? 'hard' : 'deadly';
}

/**
 * Hạt giống của một trận tấn công. `nonce` là số thứ tự trận do máy chủ cấp: nó thay chỗ
 * "số đợt" làm hạt giống ngẫu nhiên, nên cùng hai làng đánh nhau hai lần vẫn ra hai đội hình
 * rải quân hơi khác nhau, mà máy chủ và trình duyệt vẫn dựng ra đúng một bản.
 */
export function assaultSeed(
  def: VillageSnapshot,
  atk: { troops: Troops; smith: { attack: number; armour: number } },
  lane: number,
  nonce: number,
): BattleSeed {
  return {
    wave: nonce,
    kind: 'raid',
    power: 0,
    towers: def.towers.map((t) => ({ ...t })),
    mercs: 0,
    militia: def.militia,
    army: { ...def.army },
    smith: { ...def.smith },
    age: def.age,
    assault: {
      troops: { ...atk.troops },
      smith: { ...atk.smith },
      lane: Math.max(0, Math.min(3, Math.floor(lane))),
    },
  };
}

export interface AssaultOutcome {
  /** Quân bên công đưa ra, còn sống, và đã ngã (theo loại). */
  sent: Troops;
  fell: Troops;
  /** Số tên chạm tới thủ phủ, và số tên mang hàng thoát ra. */
  reached: number;
  escaped: number;
  /** Phần lọt lưới, 0 tới 1 — tiền cướp tính theo đúng con số này. */
  lootFrac: number;
  ticks: number;
}

/** Chạy trọn một trận tấn công. Cùng hạt giống thì mọi lần chạy cho cùng một kết quả. */
export function resolveAssault(seed: BattleSeed): AssaultOutcome {
  const a = seed.assault;
  if (!a) throw new Error('resolveAssault needs an assault seed');
  const s = battleStart(seed);
  const total = s.raiders.length;
  while (!s.done && s.tick < MAX_TICKS) battleStep(s);
  let carrying = 0;
  for (const r of s.raiders) if (r.loaded) carrying += 1;
  const escaped = s.escaped + carrying;
  return {
    sent: { ...a.troops },
    fell: { ...s.fell },
    reached: s.reached,
    escaped,
    lootFrac: total === 0 ? 0 : Math.min(1, escaped / total),
    ticks: s.tick,
  };
}

/** Hàng cướp được từ kho một làng, tính theo phần lọt lưới. */
export function lootOf(inv: Record<ResourceKind, number>, lootFrac: number): Record<ResourceKind, number> {
  const out = {} as Record<ResourceKind, number>;
  for (const k of RESOURCE_KINDS) {
    out[k] = Math.max(0, Math.floor((inv[k] - LOOT_PROTECTED) * LOOT_SHARE * lootFrac));
  }
  return out;
}

/** Bậc rèn quy ra phần trăm, cho báo cáo. */
export const smithBonus = (lvl: number): { atk: number; arm: number } => ({
  atk: Math.round(SMITH_ATTACK * lvl * 100), arm: Math.round(SMITH_ARMOUR * lvl * 100),
});
