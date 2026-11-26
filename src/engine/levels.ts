// Tám cấp độ máy.
//
// Cách cũ (đến 11/2026) cho máy nhìn nông rồi bốc bừa một nước không phải tốt
// nhất, cấp cao thì dùng UCI_LimitStrength của Stockfish. Cả hai đều cho ra máy
// "ngu một cách vô lý": cấp 1 bỏ qua cả nước bắt Hậu, còn chế độ giới hạn Elo
// của Stockfish tính đúng 1–2 nước rồi chọn ngẫu nhiên, nên lúc đi như thần lúc
// để hở quân không lý do.
//
// Cách mới: cấp nào cũng để engine tính thật (độ sâu tăng theo cấp), xem vài
// nước tốt nhất kèm điểm, rồi chọn theo MỨC THIỆT so với nước tốt nhất:
//   - nước càng thiệt nhiều càng ít được chọn (độ "lỏng tay" giảm dần theo cấp);
//   - không bao giờ chọn nước thiệt quá ngưỡng của cấp, trừ một xác suất nhỏ
//     "sơ suất" — giống người thật thỉnh thoảng đi hỏng chứ không đi bừa;
//   - đã thấy chiếu hết hay ăn được quân lớn thì gần như luôn đi.
// Cấp 8 không giới hạn gì: Stockfish đầy sức, nghĩ lâu nhất.

import type { Score } from '../../shared/winrate.ts';

/** Kiểu "tay" khi chọn nước: dùng chung cho máy ở màn Chơi và bot online. */
export interface LossStyle {
  /**
   * Độ "lỏng tay" (centipawn): nước thiệt X so với nước tốt nhất được chọn với
   * trọng số e^(−X / spreadCp). 0 là luôn đi nước tốt nhất.
   */
  spreadCp: number;
  /** Ngưỡng thiệt tối đa thường ngày. */
  maxLossCp: number;
  /** Xác suất một nước "sơ suất", được thiệt tới `slipLossCp`. */
  slipChance: number;
  slipLossCp: number;
}

export interface Level extends LossStyle {
  id: number;
  name: string;
  /** Mô tả ngắn hiện trong phần chọn cấp. */
  hint: string;
  /** Elo ước chừng, hiện cạnh tên máy. Chỉ để tham khảo. */
  rating: number;
  /** Thời gian nghĩ tối đa mỗi nước. */
  moveTimeMs: number;
  /**
   * Khoảng dừng tối thiểu trước khi máy đi, kể cả khi nó nghĩ xong tức thì.
   * Máy đáp ngay lập tức làm ván cờ có cảm giác chóng mặt và không giống
   * đang chơi với ai cả; các trang cờ đều để máy "ngẫm" một nhịp.
   *
   * Lần đầu đặt 0,7–1,1 giây vẫn bị chê "đi nhoay nhoáy". Giờ 1,3–1,9 giây,
   * nhân thêm hệ số ngẫu nhiên 0,7–1,5 — tức máy cấp 1 nghĩ khoảng 0,9–2 giây.
   */
  minThinkMs: number;
  /** Độ sâu tối đa; không đặt thì nghĩ hết thời gian. */
  depth?: number;
  /** Số nước tốt nhất engine phải tính để có cái mà chọn. */
  multipv: number;
}

export const LEVELS: Level[] = [
  { id: 1, name: 'Cấp 1', hint: 'Mới tập, đôi khi để hở quân', rating: 800, moveTimeMs: 400, minThinkMs: 1300, depth: 5, multipv: 6, spreadCp: 90, maxLossCp: 250, slipChance: 0.12, slipLossCp: 500 },
  { id: 2, name: 'Cấp 2', hint: 'Biết bắt quân, chưa nhìn xa', rating: 1000, moveTimeMs: 500, minThinkMs: 1350, depth: 7, multipv: 5, spreadCp: 65, maxLossCp: 180, slipChance: 0.08, slipLossCp: 400 },
  { id: 3, name: 'Cấp 3', hint: 'Thỉnh thoảng đi hỏng', rating: 1200, moveTimeMs: 700, minThinkMs: 1400, depth: 9, multipv: 5, spreadCp: 45, maxLossCp: 130, slipChance: 0.05, slipLossCp: 300 },
  { id: 4, name: 'Cấp 4', hint: 'Khoảng 1400 Elo', rating: 1400, moveTimeMs: 900, minThinkMs: 1500, depth: 11, multipv: 4, spreadCp: 32, maxLossCp: 90, slipChance: 0.03, slipLossCp: 220 },
  { id: 5, name: 'Cấp 5', hint: 'Khoảng 1600 Elo', rating: 1600, moveTimeMs: 1100, minThinkMs: 1600, depth: 13, multipv: 4, spreadCp: 22, maxLossCp: 60, slipChance: 0.015, slipLossCp: 180 },
  { id: 6, name: 'Cấp 6', hint: 'Khoảng 1800 Elo', rating: 1800, moveTimeMs: 1300, minThinkMs: 1700, depth: 15, multipv: 3, spreadCp: 14, maxLossCp: 40, slipChance: 0.008, slipLossCp: 140 },
  { id: 7, name: 'Cấp 7', hint: 'Khoảng 2100 Elo', rating: 2100, moveTimeMs: 1600, minThinkMs: 1800, multipv: 3, spreadCp: 7, maxLossCp: 25, slipChance: 0, slipLossCp: 0 },
  { id: 8, name: 'Cấp 8', hint: 'Mạnh nhất, không nương tay', rating: 2800, moveTimeMs: 2500, minThinkMs: 1900, multipv: 1, spreadCp: 0, maxLossCp: 0, slipChance: 0, slipLossCp: 0 },
];

/**
 * Khoảng dừng thật sự của một nước: quanh mức tối thiểu của cấp, lệch đi một
 * chút để máy không đi đều như máy đếm nhịp.
 */
export function thinkDelayMs(level: Level, random: () => number = Math.random): number {
  return Math.round(level.minThinkMs * (0.7 + random() * 0.8));
}

export function levelById(id: number): Level {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[3];
}

/** Elo hiện cạnh tên máy. Cấp 1–3 không đo được chắc chắn nên để "~N". */
export function levelRating(id: number): number | string {
  const l = levelById(id);
  return l.id <= 3 ? `~${l.rating}` : l.rating;
}

/** Một nước engine đưa ra, điểm theo góc nhìn BÊN ĐANG ĐI. */
export interface Candidate {
  uci: string;
  score: Score;
}

/** Quy điểm về một số để so: chiếu hết càng sớm càng cao, bị chiếu hết càng sớm càng thấp. */
export function scoreValue(s: Score): number {
  if (s.mate !== undefined) return s.mate > 0 ? 100_000 - s.mate * 100 : -100_000 - s.mate * 100;
  return s.cp;
}

/**
 * Chọn một chỉ số trong `values` (điểm mỗi nước, góc nhìn bên đang đi, số càng
 * lớn càng tốt) theo kiểu tay `style`. `random` tách ra làm tham số để test được.
 */
export function pickByLoss(style: LossStyle, values: number[], random: () => number = Math.random): number {
  if (values.length <= 1 || style.spreadCp <= 0) return values.indexOf(Math.max(...values));
  const best = Math.max(...values);
  const cap = random() < style.slipChance ? style.slipLossCp : style.maxLossCp;
  const weights = values.map((v) => (best - v > cap ? 0 : Math.exp(-(best - v) / style.spreadCp)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0 && weights[i] > 0) return i;
  }
  return values.indexOf(best);
}

/** Chọn một nước trong các nước engine đưa ra, theo cấp. Trả về chỉ số trong `lines`. */
export function chooseLine(level: Level, lines: Candidate[], random: () => number = Math.random): number {
  return pickByLoss(level, lines.map((l) => scoreValue(l.score)), random);
}
