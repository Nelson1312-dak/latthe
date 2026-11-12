/**
 * Luật đường thuỷ: chiến thuyền, phần giặc đi đường biển, và hang hải tặc. Toàn hàm THUẦN.
 *
 * Để riêng như raids.ts và voyage.ts: đây là phần thứ hai của game lấy đi của người chơi
 * (thuyền chìm), nên nó phải đọc được trong một màn hình và thử được mà không cần cả ván.
 *
 * Mọi lần bốc thăm đều XÁC ĐỊNH: hạt giống là số đợt hoặc số hang đã dẹp — hai con số nằm
 * trong bản lưu. Math.random ở đây là `npm run pace` mỗi lần ra một số khác. Muối băm dùng
 * dải 0xf1e0+, chưa ai dùng.
 */
import { AGE_DEFENCE, ageBonus } from './config';
import type { Cost } from './types';
import { hash2 } from './world';

/** Chiến thuyền mở từ thời đại này (Imperial Age), và phải có bến tàu. */
export const SHIP_AGE = 4;
export const SHIP_COST: Cost = { wood: 260, gold: 180 };
/** Giây đóng một chiếc. Mỗi lúc chỉ đóng một chiếc: xưởng đóng tàu có một triền. */
export const SHIP_SECONDS = 35;
/** Trần thuyền = tổng cấp bến tàu × ngần này. Bến cấp 5 là mười chiếc. */
export const SHIP_PER_DOCK = 2;
/**
 * Sức một chiếc chặn được trên biển, đo bằng đúng đơn vị "sức đợt" của raids.ts. Lớn lên
 * theo thời đại cùng nhịp với tháp canh — chiến thuyền cũng là phòng thủ.
 */
export const SHIP_STOP = 9;

/**
 * Từ thời đại bốn, mỗi đợt CƯỚP có thêm một cánh quân đi đường biển, nặng bằng ngần này
 * phần sức đợt. Nó là phần CỘNG THÊM chứ không cắt từ đợt cũ: không có hạm đội thì cả
 * cánh ấy đổ bộ, đợt nặng hơn trước; có hạm đội thì chặn được nó ngoài khơi. Cắt từ đợt cũ
 * thì chiến thuyền chỉ là một nút "đợt nhẹ đi", không phải một thứ phải lo.
 */
export const SEA_SHARE = 0.3;

/** Một chuyến đánh hang hải tặc mất ngần này giây; thuyền đi vắng không chặn được giặc. */
export const SORTIE_SECONDS = 60;

/** Hang thứ n (đếm từ 0) đòi ngần này chiến thuyền mới dám đánh. */
export function lairNeed(n: number): number {
  return 3 + 2 * Math.min(n, 3);
}

/** Phần thưởng của hang thứ n — lớn dần, vì hang sau xa hơn và đông hơn. */
export function lairLoot(n: number): { gold: number; relics: number } {
  return { gold: 400 + 250 * n, relics: 6 + 3 * n };
}

/** Sức chặn của cả hạm đội ở thời đại ấy. */
export function fleetStop(ships: number, age: number): number {
  return Math.round(ships * SHIP_STOP * ageBonus(age, AGE_DEFENCE));
}

/** Cánh quân đường biển của một đợt; 0 nếu chưa tới thời đại có giặc biển hoặc đợt là bão. */
export function seaPower(power: number, age: number, raid: boolean): number {
  return raid && age >= SHIP_AGE ? Math.round(power * SEA_SHARE) : 0;
}

export interface SeaClash {
  /** Sức của cánh quân biển. */
  power: number;
  /** Phần bị hạm đội chặn lại ngoài khơi. */
  stopped: number;
  /** Phần đổ bộ được — cộng vào đợt trên bộ. */
  landed: number;
  /** Số chiến thuyền chìm. */
  sunk: number;
}

/**
 * Hải chiến trước đợt: hạm đội chặn được bao nhiêu, mất bao nhiêu thuyền.
 *
 * Thuyền chìm theo TỈ SỐ giữa cánh quân biển và sức chặn: áp đảo thì gần như không mất
 * chiếc nào, ngang ngửa thì mất một, bị áp đảo thì mất nhiều. Thêm một lần thăm theo số đợt
 * để hai trận giống hệt nhau không cho cùng một kết cục — nhưng chỉ xê dịch được một chiếc.
 */
export function seaClash(wave: number, sea: number, ships: number, age: number): SeaClash {
  if (sea <= 0) return { power: 0, stopped: 0, landed: 0, sunk: 0 };
  const chan = fleetStop(ships, age);
  const stopped = Math.min(sea, chan);
  const tiSo = sea / Math.max(1, chan);
  const sunk = ships <= 0 ? 0
    : Math.min(ships, Math.floor(tiSo * 0.6 + hash2(wave, ships, 0xf1e0) * 0.7));
  return { power: sea, stopped, landed: sea - stopped, sunk };
}

export interface LairResult {
  /** Hang thứ mấy (đếm từ 0). */
  lair: number;
  won: boolean;
  sunk: number;
  gold: number;
  relics: number;
}

/**
 * Kết cục một chuyến đánh hang. Mang dư thuyền thì chắc thắng hơn và ít chìm hơn; vừa đủ
 * thì vẫn có một phần tư khả năng bị đánh bật.
 *
 * Thăm theo cả SỐ ĐỢT lúc cập bến (`wave`), không chỉ theo hang và số thuyền: thiếu nó thì
 * thua một lần là thua mãi — cùng hang, cùng số thuyền, cùng một lá thăm. Bản mô phỏng
 * đầu tiên bị đánh bật mười hai lần liền ở đúng một hang.
 */
export function resolveLair(n: number, ships: number, wave: number): LairResult {
  const need = lairNeed(n);
  const du = Math.max(0, ships - need);
  const won = hash2(n * 97 + wave, ships, 0xf1e1) < Math.min(0.95, 0.75 + 0.07 * du);
  const h = hash2(n * 97 + wave, 7, 0xf1e2);
  const sunk = Math.min(ships, won
    ? Math.floor(h * (du >= 2 ? 1.4 : 2))
    : 1 + Math.floor(h * need * 0.5));
  const loot = won ? lairLoot(n) : { gold: 0, relics: 0 };
  return { lair: n, won, sunk, ...loot };
}
