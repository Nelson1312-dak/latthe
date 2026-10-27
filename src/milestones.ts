/**
 * Mốc thành tựu theo khoảng cách: đi xa tới đâu thì mở được gì.
 *
 * Trên một bản đồ vô hạn, "đi xa" phải có đích ngắm chứ không chỉ là một con số lớn hơn.
 * Mỗi mốc cho một phần thưởng VĨNH VIỄN và cộng dồn, nên quãng đường đã đi biến thành sức
 * mạnh chứ không biến mất.
 *
 * KHÔNG LƯU DANH SÁCH MỐC ĐÃ ĐẠT. Chỉ lưu quãng xa nhất đã vén; toàn bộ phần thưởng là hàm
 * thuần của con số đó. Cùng một nguyên tắc đã dùng cho địa hình: thứ gì suy ra được thì đừng
 * lưu, vì hai bản ghi về cùng một sự thật sớm muộn cũng lệch nhau.
 */

export type RewardKind = 'speed' | 'capacity' | 'storage' | 'cart' | 'survey';

export interface Milestone {
  at: number;
  label: string;
  kind: RewardKind;
  /** Phần cộng thêm, đã tính sẵn thành hệ số hoặc lượng tuyệt đối tuỳ loại. */
  amount: number;
}

const REWARD_TEXT: Record<RewardKind, (a: number) => string> = {
  speed: (a) => `Dân đi nhanh hơn ${Math.round(a * 100)}%`,
  capacity: (a) => `Mang thêm ${Math.round(a * 100)}% mỗi chuyến`,
  storage: (a) => `Kho chứa thêm ${Math.round(a * 100)}%`,
  cart: (a) => `Xe thồ chở thêm ${Math.round(a * 100)}%`,
  survey: (a) => `Khảo sát nhanh hơn ${Math.round(a * 100)}%`,
};

export function rewardText(m: Milestone): string {
  return REWARD_TEXT[m.kind](m.amount);
}

/**
 * Mười mốc đầu có tên riêng, vì chúng là phần người chơi nhớ. Sau đó cứ mỗi 200 đơn vị lại
 * có một mốc nữa, xoay vòng năm loại phần thưởng — nên danh sách cũng vô hạn như bản đồ.
 */
const NAMED: Milestone[] = [
  { at: 40, label: 'Rìa làng', kind: 'speed', amount: 0.06 },
  { at: 80, label: 'Bên kia đồi', kind: 'capacity', amount: 0.1 },
  { at: 130, label: 'Người mở đường', kind: 'survey', amount: 0.1 },
  { at: 190, label: 'Đất lạ', kind: 'storage', amount: 0.15 },
  { at: 260, label: 'Đoàn xe đầu tiên', kind: 'cart', amount: 0.25 },
  { at: 340, label: 'Chân trời thứ hai', kind: 'speed', amount: 0.08 },
  { at: 430, label: 'Vùng biên', kind: 'capacity', amount: 0.12 },
  { at: 530, label: 'Bản đồ không rìa', kind: 'storage', amount: 0.2 },
  { at: 640, label: 'Kẻ lang thang', kind: 'cart', amount: 0.3 },
  { at: 760, label: 'Xa khỏi mọi con đường', kind: 'survey', amount: 0.12 },
];

const STEP = 200;
const CYCLE: { kind: RewardKind; amount: number }[] = [
  { kind: 'speed', amount: 0.05 },
  { kind: 'capacity', amount: 0.08 },
  { kind: 'storage', amount: 0.12 },
  { kind: 'cart', amount: 0.2 },
  { kind: 'survey', amount: 0.06 },
];

/** Mốc thứ n (từ 0). Vô hạn: hết danh sách có tên thì sinh tiếp theo chu kỳ. */
export function milestoneAt(n: number): Milestone {
  if (n < NAMED.length) return NAMED[n];
  const k = n - NAMED.length;
  const c = CYCLE[k % CYCLE.length];
  const at = NAMED[NAMED.length - 1].at + STEP * (k + 1);
  return { at, label: `Cột mốc ${Math.round(at)}`, kind: c.kind, amount: c.amount };
}

/** Số mốc đã đạt với quãng xa nhất đã đi. */
export function reachedCount(maxReach: number): number {
  let n = 0;
  while (milestoneAt(n).at <= maxReach) {
    n += 1;
    if (n > 500) break;            // chặn cứng, phòng con số hỏng lọt vào
  }
  return n;
}

export function nextMilestone(maxReach: number): Milestone {
  return milestoneAt(reachedCount(maxReach));
}

export interface Bonuses {
  speed: number;
  capacity: number;
  storage: number;
  cart: number;
  survey: number;
}

/** Tổng phần thưởng, cộng dồn từ mọi mốc đã đạt. Hàm thuần — không đọc, không ghi gì. */
export function bonusesFor(maxReach: number): Bonuses {
  const b: Bonuses = { speed: 0, capacity: 0, storage: 0, cart: 0, survey: 0 };
  const n = reachedCount(maxReach);
  for (let i = 0; i < n; i += 1) {
    const m = milestoneAt(i);
    b[m.kind] += m.amount;
  }
  // Khảo sát nhanh hơn thì chặn ở 70%: nhanh quá là màn mây mất hết ý nghĩa, mà đó lại đúng
  // là lỗi đã phải sửa một lần rồi.
  b.survey = Math.min(b.survey, 0.7);
  return b;
}
