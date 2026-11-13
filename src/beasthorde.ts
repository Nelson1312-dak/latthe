/**
 * ĐỢT QUÁI THÚ: một con trùm to và vài chục con nhỏ theo sau. Toàn hàm THUẦN.
 *
 * Người chơi xin "mấy hình mẫu quái thú đến raid một lần — một con to và vài chục con nhỏ —
 * và nâng cấp quái khi mình lên cấp". Nên có NĂM BẦY, mở dần theo cấp làng: bầy sói ở đầu
 * ván, rồi yêu tinh với gã khổng lồ, nhện, đạo quân xương, và cuối cùng là rồng lửa. Bầy càng
 * về sau thì trùm càng to, và mỗi bầy còn có BẬC (★) lớn theo cấp làng.
 *
 * SỨC CỦA BẦY KHÔNG PHẢI MỘT CON SỐ MỚI. Nó lấy đúng tổng máu và tổng đòn của một đợt cướp
 * cùng sức (cùng waveMix, cùng giặc tinh nhuệ, cùng thời đại) rồi chia lại: trùm ôm hơn một
 * phần ba số máu, đám nhỏ chia nhau phần còn lại. Thế là cả bảng cân bằng đã đo của mùa bão
 * vẫn đứng, chỉ có HÌNH của trận là khác: tháp canh mỗi lần chỉ bắn một con, nên vài chục
 * con nhỏ ùa vào thì lọt nhiều hơn, còn con trùm thì là một bao cát nuốt đạn.
 *
 * Mọi ngẫu nhiên lấy từ hash2 theo số đợt (muối 0xbe01–0xbe03), không Math.random.
 */
import type { TroopKind } from './types';
import { hash2 } from './world';

export interface HordeSpec {
  id: string;
  /** Tên bầy, ví dụ "Wolf pack". */
  name: string;
  /** Tên con trùm. */
  boss: string;
  /** Tên số nhiều của đám nhỏ. */
  minion: string;
  /** Cấp làng tối thiểu để bầy này xuất hiện. */
  minLevel: number;
  /**
   * Hạng khắc chế. Quái dùng chung bảng KHAC với người: sói là "kỵ" nên lính giáo khắc,
   * yêu tinh là "bộ" nên cung thủ khắc, v.v. Một luật chung thì người chơi học một lần.
   */
  minionKind: TroopKind;
  bossKind: TroopKind;
  minionSpeed: number;
  bossSpeed: number;
  /** Tầm đánh. Trên 3 là bắn xa (trùm nhện phun tơ, rồng phun lửa). */
  minionRange: number;
  bossRange: number;
  /** Đòn trùm nổ lan bấy nhiêu đơn vị (gậy khổng lồ, lửa rồng). 0 là đánh một người. */
  bossSplash: number;
  /** Cỡ vẽ so với người dân. */
  minionSize: number;
  bossSize: number;
}

export const HORDES: readonly HordeSpec[] = [
  {
    id: 'wolf', name: 'Wolf pack', boss: 'Dire Wolf Alpha', minion: 'wolves', minLevel: 1,
    minionKind: 'horse', bossKind: 'horse', minionSpeed: 4.0, bossSpeed: 3.4,
    minionRange: 1.3, bossRange: 2.0, bossSplash: 0, minionSize: 1.05, bossSize: 2.1,
  },
  {
    id: 'goblin', name: 'Goblin warband', boss: 'Ogre Warlord', minion: 'goblins', minLevel: 10,
    minionKind: 'spear', bossKind: 'spear', minionSpeed: 3.0, bossSpeed: 2.0,
    minionRange: 1.3, bossRange: 2.4, bossSplash: 1.6, minionSize: 0.95, bossSize: 2.4,
  },
  {
    id: 'spider', name: 'Spider brood', boss: 'Brood Queen', minion: 'spiderlings', minLevel: 22,
    minionKind: 'spear', bossKind: 'archer', minionSpeed: 3.6, bossSpeed: 2.2,
    minionRange: 1.2, bossRange: 7, bossSplash: 1.5, minionSize: 1.0, bossSize: 2.5,
  },
  {
    id: 'bone', name: 'Bone legion', boss: 'Bone Giant', minion: 'skeletons', minLevel: 38,
    minionKind: 'spear', bossKind: 'siege', minionSpeed: 2.6, bossSpeed: 1.8,
    minionRange: 1.4, bossRange: 2.6, bossSplash: 1.8, minionSize: 1.0, bossSize: 2.8,
  },
  {
    id: 'drake', name: 'Drake swarm', boss: 'Fire Drake', minion: 'lizardfolk', minLevel: 60,
    minionKind: 'spear', bossKind: 'mage', minionSpeed: 3.0, bossSpeed: 2.6,
    minionRange: 1.4, bossRange: 9, bossSplash: 2.0, minionSize: 1.0, bossSize: 2.7,
  },
];

/** Phần máu và phần đòn của cả bầy dồn vào con trùm. */
export const BOSS_HP_SHARE = 0.3;
/**
 * Bầy quái mỏng máu và nhẹ tay hơn đợt cướp cùng sức. Không phải số đẹp — số đo bằng pace
 * (đích 45–53 trên 58 trận): để nguyên máu và đòn thì vài chục con nhỏ ùa vào cùng lúc vừa
 * lọt qua tháp nhiều hơn một đợt người, vừa xé nát quân giữ làng — mất quân ở đợt quái là
 * thua luôn hai đợt sau, và cả ván rơi xuống 30. Đã đo: máu 0,85 · đòn 1 → 41; 0,85 · 0,7
 * → 44; 0,8 · 0,55 → 47.
 */
export const HORDE_HP = 0.8;
export const HORDE_DPS = 0.55;
export const BOSS_DPS_SHARE = 0.15;

/**
 * Bậc của bầy theo cấp làng: ★1 ở đầu ván, thêm một sao mỗi 15 cấp, tối đa chín. Bậc không
 * cộng sức (sức đã lớn theo cấp qua wavePower) — nó là thứ người chơi NHÌN THẤY lớn lên:
 * trùm to thêm, tên có thêm sao.
 */
export function hordeTier(level: number): number {
  return Math.min(9, 1 + Math.floor(Math.max(0, level - 1) / 15));
}

/** Vài chục con nhỏ: 18 ở đầu ván, thêm một con mỗi ba cấp, trần 44. */
export function minionCount(level: number): number {
  return Math.min(44, 18 + Math.floor(Math.max(0, level) / 3));
}

/**
 * Bầy nào tới ở đợt này. Sáu phần mười là bầy MỚI NHẤT đã mở — lên cấp là thấy quái mới
 * ngay — còn lại bốc ngẫu nhiên trong những bầy đã mở, để bầy cũ thỉnh thoảng quay lại.
 */
export function pickHorde(wave: number, level: number): number {
  let mo = 0;
  for (let i = 0; i < HORDES.length; i += 1) if (level >= HORDES[i].minLevel) mo = i;
  if (hash2(wave, 5, 0xbe01) < 0.6) return mo;
  return Math.min(mo, Math.floor(hash2(wave, 9, 0xbe02) * (mo + 1)));
}

/** Kích cỡ trùm sau khi tính bậc: mỗi sao to thêm 7%. */
export function bossScale(spec: HordeSpec, tier: number): number {
  return spec.bossSize * (1 + 0.07 * (tier - 1));
}

/** Tên trùm kèm sao, cho bảng đợt và dải báo. */
export function bossTitle(spec: HordeSpec, tier: number): string {
  return `${spec.boss} ★${tier}`;
}

/** Độ rung ngang của đám nhỏ trong đội hình — lấy theo số đợt để diễn lại trùng khít. */
export function swarmJitter(wave: number, i: number, axis: number): number {
  return hash2(wave * 151 + i, axis, 0xbe03) - 0.5;
}
