// Ai đang mở trang LÚC NÀY (cho bảng Thống kê trực tiếp của chủ trang).
//
// Mỗi tab đang mở gửi một mã ngẫu nhiên (tạo lúc mở trang, chỉ nằm trong bộ nhớ
// tab đó) khoảng 45 giây một lần, kèm đang ở mục nào. Server chỉ giữ mã và lúc
// gửi cuối TRONG BỘ NHỚ, quá 2 phút là quên. Không IP, không tài khoản, không ghi
// xuống đĩa — tắt server là mất hết, đúng ý.

/** Mục người dùng đang xem. Lạ thì gom vào "khác". */
export const WHERE = ['choi', 'online', 'hoc', 'on-tap', 'huan-luyen', 'xem-lai', 'khac'] as const;
export type Where = (typeof WHERE)[number];

const HẠN_MS = 120_000;
/** Không giữ quá ngần này mã (chặn ai đó gửi bừa cho đầy bộ nhớ). */
const TỐI_ĐA = 5_000;

const seen = new Map<string, { at: number; where: Where }>();

function dọn(now: number): void {
  for (const [id, v] of seen) if (now - v.at > HẠN_MS) seen.delete(id);
}

export function presenceBeat(id: unknown, where: unknown, now = Date.now()): boolean {
  if (typeof id !== 'string' || !/^[a-z0-9-]{8,40}$/i.test(id)) return false;
  const w: Where = (WHERE as readonly string[]).includes(where as string) ? (where as Where) : 'khac';
  if (!seen.has(id) && seen.size >= TỐI_ĐA) {
    dọn(now);
    if (seen.size >= TỐI_ĐA) return false;
  }
  seen.set(id, { at: now, where: w });
  return true;
}

export function presenceNow(now = Date.now()): { total: number; byWhere: Record<Where, number> } {
  dọn(now);
  const byWhere = Object.fromEntries(WHERE.map((w) => [w, 0])) as Record<Where, number>;
  for (const v of seen.values()) byWhere[v.where]++;
  return { total: seen.size, byWhere };
}

/** Cho test: quên hết. */
export function resetPresence(): void {
  seen.clear();
}
