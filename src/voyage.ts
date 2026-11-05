/**
 * Luật của một chuyến đi biển. Hàm thuần, không biết gì về Economy lẫn màn hình.
 *
 * BỐC THĂM PHẢI XÁC ĐỊNH ĐƯỢC. Nếu kết cục lấy từ Math.random thì `npm run pace` mỗi lần
 * chạy ra một số khác, và cái thước đo duy nhất của game này hỏng ngay. Nên hạt giống là
 * SỐ CHUYẾN ĐÃ XONG — một con số nằm trong bản lưu, tăng đều, không ai đoán trước được.
 * Thêm một cái lợi không định trước: tải lại trang không đổi được kết cục chuyến đang đi.
 */
import { VOYAGES, VOYAGE_PLACES } from './config';
import type { VoyageSpec } from './config';
import type { VoyageBand, VoyageResult } from './types';
import { hash2 } from './world';

export function voyageSpec(band: VoyageBand): VoyageSpec {
  return VOYAGES.find((v) => v.id === band) ?? VOYAGES[0];
}

/** Khoảng [a, b] theo một số thăm trong [0, 1). */
function giua(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/**
 * Kết cục chuyến thứ `seq` (đếm từ 0). Ba lần thăm độc lập: một cho kết cục, hai cho món
 * hàng — nếu dùng chung một số thì chuyến nào suýt thất bại cũng là chuyến ít vàng nhất,
 * và người chơi đọc ra quy luật ấy trong vài lần.
 */
export function resolveVoyage(band: VoyageBand, seq: number): VoyageResult {
  const s = voyageSpec(band);
  const a = hash2(seq, 11, 0x5ea1);
  const b = hash2(seq, 22, 0x5ea2);
  const c = hash2(seq, 33, 0x5ea3);
  const where = VOYAGE_PLACES[Math.floor(hash2(seq, 44, 0x5ea4) * VOYAGE_PLACES.length)];
  if (a < s.lost) return { band, outcome: 'lost', gold: 0, relics: 0, where };
  if (a < s.lost + s.empty) return { band, outcome: 'empty', gold: 0, relics: 0, where };
  return {
    band, outcome: 'win', where,
    gold: giua(s.gold[0], s.gold[1], b),
    relics: giua(s.relics[0], s.relics[1], c),
  };
}
