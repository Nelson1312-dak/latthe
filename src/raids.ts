/**
 * Luật mùa bão: tính sức đợt, sức thủ, và quyết hậu quả. Toàn hàm THUẦN.
 *
 * Để riêng khỏi Economy vì đây là phần duy nhất của game lấy đi của người chơi, nên nó phải
 * đọc được hết trong một màn hình và thử được mà không cần dựng cả ván. Economy chỉ làm việc
 * áp kết quả vào kho và vào công trình.
 */
import {
  GUARD_PER_TOWER, GUARD_PER_TOWNHALL, MERC_BASE, MERC_PER_POWER,
  WAVE_BASE, WAVE_PER_LEVEL, WAVE_PER_WAVE,
} from './config';
import type { Building, Inventory, WaveKind, WaveResult } from './types';
import { RESOURCE_KINDS } from './types';

/** Đợt chẵn là bão, đợt lẻ là cướp. Xen kẽ cố định để người chơi biết trước mà phòng. */
export function waveKind(wave: number): WaveKind {
  return wave % 2 === 1 ? 'raid' : 'storm';
}

export function wavePower(wave: number, level: number): number {
  return Math.round(WAVE_BASE + WAVE_PER_LEVEL * level + WAVE_PER_WAVE * Math.max(0, wave - 1));
}

/** Sức thủ sẵn có của một cái làng. `hired` là lính thuê thêm cho riêng đợt sắp tới. */
export function guardOf(buildings: Building[], hired = 0): number {
  let th = 0;
  let tw = 0;
  for (const b of buildings) {
    if (b.type === 'townhall') th += b.level;
    else if (b.type === 'watchtower') tw += b.level;
  }
  return th * GUARD_PER_TOWNHALL + tw * GUARD_PER_TOWER + Math.max(0, Math.round(hired));
}

/** Giá vàng cho mỗi điểm sức thủ thuê thêm, ở một đợt mạnh chừng ấy. */
export function mercPrice(power: number): number {
  return Math.max(1, Math.round(MERC_BASE + MERC_PER_POWER * power));
}

/**
 * Hậu quả của một đợt.
 *
 * Thua KHÔNG phải mất sạch: thiệt hại tỉ lệ với phần còn thiếu, nên thủ được 80% thì chỉ mất
 * một góc nhỏ. Ngược lại thủ đủ thì có thưởng chứ không chỉ "không mất gì" — phần thưởng là
 * MẢNH CỔ VẬT, thứ hiếm nhất game (cả bốn tiếng chơi mới gom được 25), nên đẩy lui được một
 * đợt là một sự kiện đáng nhớ chứ không phải một việc vặt.
 *
 * `away` chỉ dùng để kể lại; mức thiệt hại lúc vắng mặt do bên gọi chặn trước, xem Economy.
 */
export function resolveWave(
  wave: number, power: number, guard: number, inv: Inventory, away: boolean,
): { result: WaveResult; take: Partial<Inventory>; levels: number } {
  const kind = waveKind(wave);
  const won = guard >= power;
  const base: WaveResult = {
    wave, kind, power, guard, won, lost: {}, levels: 0, reward: {}, away,
  };

  if (won) {
    base.reward = { relics: Math.max(1, Math.round(power * 0.22)), gold: Math.round(power * 2.6) };
    return { result: base, take: {}, levels: 0 };
  }

  const thieu = Math.min(1, 1 - guard / Math.max(1, power));
  const take: Partial<Inventory> = {};
  // Cướp khuân hàng, bão chỉ cuốn đi một ít — cái đau của bão nằm ở công trình.
  const phan = kind === 'raid' ? Math.min(0.45, thieu * 0.55) : Math.min(0.15, thieu * 0.2);
  for (const k of RESOURCE_KINDS) {
    const n = Math.floor(inv[k] * phan);
    if (n > 0) take[k] = n;
  }
  base.lost = take;
  const levels = kind === 'storm' ? Math.max(1, Math.ceil(thieu * 3)) : 0;
  base.levels = levels;
  return { result: base, take, levels };
}

/**
 * Công trình bão sẽ đánh sập một cấp, cao nhất trước.
 *
 * Chọn cái cao nhất chứ không chọn ngẫu nhiên vì hai lẽ: cơn bão quật cái gì vươn cao nhất
 * là chuyện tự nhiên, và mất một cấp của công trình cấp 8 thì đau mà vẫn gượng được, còn
 * xoá sổ một căn nhà cấp 1 vừa dựng thì chỉ thấy vô lý. THỦ PHỦ MIỄN NHIỄM: sập nó là mất
 * cả chợ lẫn chỗ ở, và người chơi không còn đường quay lại.
 */
export function stormTargets(buildings: Building[], levels: number): string[] {
  const ok = buildings
    .filter((b) => b.type !== 'townhall' && b.level > 1)
    .sort((a, b) => b.level - a.level);
  const out: string[] = [];
  // Một công trình có thể ăn nhiều cấp nếu không còn cái nào khác đủ cao.
  const con = new Map(ok.map((b) => [b.id, b.level] as const));
  for (let i = 0; i < levels; i += 1) {
    let best: string | null = null;
    let cao = 1;
    for (const [id, lv] of con) if (lv > cao) { best = id; cao = lv; }
    if (!best) break;
    con.set(best, cao - 1);
    out.push(best);
  }
  return out;
}
