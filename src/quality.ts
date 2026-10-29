/**
 * Thang chất lượng đồ hoạ: Thấp, Vừa, Cao — và Tự động.
 *
 * Mỗi bậc là MỘT bảng thông số, và mọi chỗ trong game đọc từ bảng ấy; không chỗ nào tự đi
 * hỏi "máy này mạnh không". Thêm một hiệu ứng mới thì thêm một cột vào bảng, rồi quyết bậc
 * nào được dùng nó.
 *
 * Tự động bắt đầu ở bậc lần trước dừng lại (lần đầu là Cao), đo nhịp khung hình trong năm
 * giây đầu và hạ một bậc nếu chậm; hạ xong thì đo lại. KHÔNG bao giờ tự nâng: nhịp khung bị
 * khoá theo tần số màn hình — ở 60 Hz là 16,7 ms dù máy đang rảnh hay sắp đuối — nên không
 * có cách nào đọc ra là "còn dư sức". Muốn thử lại từ Cao thì chọn lại Tự động trong bảng.
 */

export type Tier = 'low' | 'medium' | 'high';
export type Choice = Tier | 'auto';

export interface TierSpec {
  label: string;
  /** Trần mật độ điểm ảnh. */
  dpr: number;
  /** Vẽ qua chuỗi hậu kỳ. Tắt thì vẽ thẳng ra màn hình: không AO, không lọc màu. */
  post: boolean;
  /** AO: độ phân giải so với khung hình, và số mẫu mỗi điểm. */
  aoScale: number;
  aoSamples: number;
  shadowMap: number;
  /**
   * Bán kính lọc bóng, tính bằng texel. Bản đồ bóng to gấp đôi thì texel nhỏ đi một nửa, nên
   * cùng bán kính ấy cho bóng sắc gấp đôi — 4096 với 6 vẫn sắc hơn 2048 với 5 một chút, và
   * đó là chủ ý: bậc Cao là bậc bóng gọn.
   */
  shadowRadius: number;
  /** Ô lục giác vát mép (30 tam giác) hay phẳng (18). */
  bevel: boolean;
  /** Cây cỏ đung đưa theo gió. */
  sway: boolean;
  /** Độ chia của mây: 1 là 320 tam giác mỗi đám, 0 là 80. */
  cloudDetail: 0 | 1;
  /** Quầng sáng quanh pha lê và quặng vàng. */
  glow: boolean;
  /** Được phép bật hiệu ứng mô hình thu nhỏ. */
  tilt: boolean;
}

export const TIERS: Record<Tier, TierSpec> = {
  low: {
    label: 'Thấp', dpr: 1, post: false, aoScale: 0, aoSamples: 0,
    shadowMap: 1024, shadowRadius: 3,
    bevel: false, sway: false, cloudDetail: 0, glow: false, tilt: false,
  },
  medium: {
    label: 'Vừa', dpr: 1.5, post: true, aoScale: 0.5, aoSamples: 8,
    shadowMap: 2048, shadowRadius: 5,
    bevel: true, sway: true, cloudDetail: 1, glow: false, tilt: false,
  },
  /*
   * AO ở 0,75 độ phân giải chứ không phải đủ: đo bằng đồng hồ GPU ở 1920×1080, phóng xa nhất,
   * GTX 1660 SUPER — AO đủ cỡ tốn 3,9 trên tổng 6,8 ms, vượt ngân sách 6 ms của bậc này; ở
   * 0,75 cả khung còn 5,4 ms, mà AO vốn mềm nên mắt không phân biệt được. Bóng 4096 chỉ thêm
   * 0,1 ms và mô hình thu nhỏ gần như không tốn gì, nên giữ cả hai.
   */
  high: {
    label: 'Cao', dpr: 2, post: true, aoScale: 0.75, aoSamples: 12,
    shadowMap: 4096, shadowRadius: 6,
    bevel: true, sway: true, cloudDetail: 1, glow: true, tilt: true,
  },
};

const DOWN: Record<Tier, Tier | null> = { high: 'medium', medium: 'low', low: null };
export const stepDown = (t: Tier): Tier | null => DOWN[t];

export interface GfxSettings {
  choice: Choice;
  /** Hiệu ứng mô hình thu nhỏ — chỉ có tác dụng ở bậc cho phép. */
  tilt: boolean;
  /** Bậc mà Tự động dừng lại lần trước. */
  autoTier: Tier;
}

/*
 * Lưu RIÊNG với bản lưu ván chơi: đây là thiết lập của MÁY, không phải của ván. Chơi lại từ
 * đầu không được kéo đồ hoạ về mặc định, và một bản lưu mang sang máy khác không được kéo
 * theo bậc đồ hoạ của máy cũ.
 */
const KEY = 'quandao-gfx';
const TIER_IDS: readonly string[] = ['low', 'medium', 'high'];

export function loadGfx(): GfxSettings {
  const def: GfxSettings = { choice: 'auto', tilt: true, autoTier: 'high' };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def;
    const p = JSON.parse(raw) as Partial<GfxSettings>;
    return {
      choice: p.choice === 'auto' || TIER_IDS.includes(String(p.choice)) ? p.choice as Choice : def.choice,
      tilt: p.tilt !== false,
      autoTier: TIER_IDS.includes(String(p.autoTier)) ? p.autoTier as Tier : def.autoTier,
    };
  } catch {
    return def;
  }
}

export function saveGfx(s: GfxSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* bị chặn — lần sau lại đo */
  }
}

export const tierOf = (s: GfxSettings): Tier => (s.choice === 'auto' ? s.autoTier : s.choice);

/*
 * Bộ đo của chế độ Tự động.
 *
 * Bỏ một giây đầu — biên dịch shader, nạp khối, khung nào cũng giật và chẳng nói gì về máy —
 * rồi lấy TRUNG VỊ khoảng cách giữa các khung trong bốn giây. Trung vị chứ không phải trung
 * bình: một cú giật vì nạp khối mới không được kéo cả máy xuống bậc thấp.
 *
 * Ngưỡng 22 ms, tức dưới 45 hình mỗi giây. Ở màn 60 Hz một khung tốn 18 ms là lỡ nhịp: khung
 * xen kẽ 16,7 và 33 ms, trung vị thành 33 — nên ngưỡng này bắt được cả trường hợp "chỉ hơi
 * chậm", thứ mà trung bình sẽ bỏ qua.
 */
const WARMUP = 1;
const WINDOW = 4;
const SLOW = 0.022;

export class AutoTune {
  private t = 0;
  private gaps: number[] = [];
  private on = false;

  start(): void {
    this.on = true;
    this.t = 0;
    this.gaps = [];
  }

  stop(): void {
    this.on = false;
  }

  /** Gọi mỗi khung với khoảng cách THẬT giữa hai khung (giây). Đo xong thì trả về kết luận. */
  frame(gap: number): 'slow' | 'ok' | null {
    // Tab vừa quay lại sau khi ẩn: một khoảng trống dài, không phải máy chậm.
    if (!this.on || gap <= 0 || gap > 0.25) return null;
    this.t += gap;
    if (this.t < WARMUP) return null;
    this.gaps.push(gap);
    if (this.t < WARMUP + WINDOW) return null;
    this.on = false;
    const s = this.gaps.sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)] > SLOW ? 'slow' : 'ok';
  }
}
