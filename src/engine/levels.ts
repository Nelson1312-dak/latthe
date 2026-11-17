// Tám cấp độ máy.
//
// Vì sao không chỉ dùng UCI_Elo: mức thấp nhất Stockfish nhận là 1320, vẫn quá
// mạnh với người mới chơi. Nên ba cấp đầu để engine nghĩ nông rồi CỐ Ý chọn một
// nước không phải nước tốt nhất — cách này cho ra những sai lầm giống người thật
// (để hở quân, bỏ lỡ nước ăn) thay vì đi nước ngẫu nhiên vô nghĩa.

export interface Level {
  id: number;
  name: string;
  /** Mô tả ngắn hiện trong phần chọn cấp. */
  hint: string;
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
  depth?: number;
  /** Có dùng cơ chế giới hạn sức của Stockfish không. */
  elo?: number;
  /**
   * Xác suất KHÔNG chọn nước tốt nhất, với số dòng engine phải tính.
   * weights[i] là trọng số chọn dòng thứ i (0 là nước tốt nhất).
   */
  multipv?: number;
  weights?: number[];
}

export const LEVELS: Level[] = [
  { id: 1, name: 'Cấp 1', hint: 'Mới tập, hay để hở quân', moveTimeMs: 40, minThinkMs: 1300, depth: 1, multipv: 5, weights: [1, 3, 4, 4, 4] },
  { id: 2, name: 'Cấp 2', hint: 'Biết luật, chưa nhìn xa', moveTimeMs: 60, minThinkMs: 1350, depth: 2, multipv: 5, weights: [2, 3, 3, 2, 2] },
  { id: 3, name: 'Cấp 3', hint: 'Thỉnh thoảng đi hỏng', moveTimeMs: 100, minThinkMs: 1400, depth: 4, multipv: 4, weights: [5, 3, 2, 1] },
  { id: 4, name: 'Cấp 4', hint: 'Khoảng 1350 Elo', moveTimeMs: 200, minThinkMs: 1500, elo: 1350 },
  { id: 5, name: 'Cấp 5', hint: 'Khoảng 1550 Elo', moveTimeMs: 300, minThinkMs: 1600, elo: 1550 },
  { id: 6, name: 'Cấp 6', hint: 'Khoảng 1800 Elo', moveTimeMs: 400, minThinkMs: 1700, elo: 1800 },
  { id: 7, name: 'Cấp 7', hint: 'Khoảng 2100 Elo', moveTimeMs: 600, minThinkMs: 1800, elo: 2100 },
  { id: 8, name: 'Cấp 8', hint: 'Mạnh hết mức cho phép', moveTimeMs: 1000, minThinkMs: 1900, elo: 2500 },
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

/**
 * Chọn một dòng trong số các dòng engine đưa ra, theo trọng số của cấp độ.
 * `random` tách ra làm tham số để test được mà không phụ thuộc may rủi.
 */
export function pickLine(level: Level, lineCount: number, random: () => number = Math.random): number {
  if (!level.weights || lineCount <= 1) return 0;
  const weights = level.weights.slice(0, lineCount);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return 0;
}
