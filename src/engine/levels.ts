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
  { id: 1, name: 'Cấp 1', hint: 'Mới tập, hay để hở quân', moveTimeMs: 40, depth: 1, multipv: 5, weights: [1, 3, 4, 4, 4] },
  { id: 2, name: 'Cấp 2', hint: 'Biết luật, chưa nhìn xa', moveTimeMs: 60, depth: 2, multipv: 5, weights: [2, 3, 3, 2, 2] },
  { id: 3, name: 'Cấp 3', hint: 'Thỉnh thoảng đi hỏng', moveTimeMs: 100, depth: 4, multipv: 4, weights: [5, 3, 2, 1] },
  { id: 4, name: 'Cấp 4', hint: 'Khoảng 1350 Elo', moveTimeMs: 200, elo: 1350 },
  { id: 5, name: 'Cấp 5', hint: 'Khoảng 1550 Elo', moveTimeMs: 300, elo: 1550 },
  { id: 6, name: 'Cấp 6', hint: 'Khoảng 1800 Elo', moveTimeMs: 400, elo: 1800 },
  { id: 7, name: 'Cấp 7', hint: 'Khoảng 2100 Elo', moveTimeMs: 600, elo: 2100 },
  { id: 8, name: 'Cấp 8', hint: 'Mạnh hết mức cho phép', moveTimeMs: 1000, elo: 2500 },
];

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
