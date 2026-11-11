/**
 * Thang chất lượng đồ hoạ: Thấp, Vừa, Cao — và Tự động.
 *
 * Mỗi bậc là MỘT bảng thông số, và mọi chỗ trong game đọc từ bảng ấy; không chỗ nào tự đi
 * hỏi "máy này mạnh không". Thêm một hiệu ứng mới thì thêm một cột vào bảng, rồi quyết bậc
 * nào được dùng nó.
 *
 * Tự động bắt đầu ở bậc lần trước dừng lại (lần đầu là Cao, trên máy cảm ứng là Vừa — xem
 * firstAutoTier), đo nhịp khung hình trong năm
 * giây đầu và hạ một bậc nếu chậm; hạ xong thì đo lại. KHÔNG bao giờ tự nâng: nhịp khung bị
 * khoá theo tần số màn hình — ở 60 Hz là 16,7 ms dù máy đang rảnh hay sắp đuối — nên không
 * có cách nào đọc ra là "còn dư sức". Muốn thử lại từ Cao thì chọn lại Tự động trong bảng.
 */

export type Tier = 'low' | 'medium' | 'high';
export type Choice = Tier | 'auto';

export interface TierSpec {
  label: string;
  /** Mật độ điểm ảnh ở khung nhìn tham chiếu 1920x1080 — xem pixelRatioFor. */
  dpr: number;
  /** Trần mật độ trên khung nhìn hẹp, nơi ngân sách điểm ảnh cho phép vẽ dày hơn. */
  dprMax: number;
  /** Vẽ qua chuỗi hậu kỳ. Tắt thì vẽ thẳng ra màn hình: không AO, không lọc màu. */
  post: boolean;
  /** AO: độ phân giải so với khung hình, và số mẫu mỗi điểm. */
  aoScale: number;
  aoSamples: number;
  shadowMap: number;
  /**
   * Bán kính lọc bóng, tính bằng texel. Bản đồ bóng to gấp đôi thì texel nhỏ đi một nửa, nên
   * cùng bán kính ấy cho bóng sắc gấp đôi — 4096 với 3 vẫn sắc hơn 2048 với 2 một chút, và
   * đó là chủ ý: bậc Cao là bậc bóng gọn.
   *
   * Cả ba con số đều hạ chừng một nửa so với bản trước (6 / 5 / 3). Hồi ấy nắng chiếu từ
   * sau lưng người chơi nên bóng đổ khuất sau vật thể, mềm bao nhiêu cũng được. Giờ nắng
   * xiên và bóng nằm dài ngay trong tầm mắt: lọc rộng như cũ thì bóng một ngôi nhà thành
   * một vệt khói, và cái nhìn "không sắc nét" quay lại bằng đường khác.
   */
  shadowRadius: number;
  /** Ô lục giác vát mép (30 tam giác) hay phẳng (18). */
  bevel: boolean;
  /** Cây cỏ đung đưa theo gió. */
  sway: boolean;
  /** Độ chia của mây: 1 là 320 tam giác mỗi đám, 0 là 80. */
  cloudDetail: 0 | 1;
  /** Bầu trời làm nguồn sáng (bản đồ môi trường PMREM). */
  env: boolean;
  /** Vân bề mặt theo toạ độ thế giới. */
  grain: boolean;
  /** Sương xa: vật ở xa nhoà dần về màu trời. */
  haze: boolean;
  /** Quầng sáng quanh pha lê và quặng vàng. */
  glow: boolean;
  /** Được phép bật hiệu ứng mô hình thu nhỏ. */
  tilt: boolean;
}

export const TIERS: Record<Tier, TierSpec> = {
  low: {
    // Đã thử cho bậc này chạy qua hậu kỳ mà bỏ AO, để nó cũng được lọc màu ấm: đo ra
    // 1,54 → 2,39 ms, tức đắt thêm hơn nửa, chỉ vì phải cấp một target đa mẫu rồi phân giải
    // nó. Quá nhiều cho một bậc mà cả lý do tồn tại là chạy được trên máy yếu.
    label: 'Low', dpr: 1, dprMax: 2, post: false, aoScale: 0, aoSamples: 0,
    shadowMap: 1024, shadowRadius: 1.5,
    // Không có bầu trời làm nguồn sáng: đo ở 1920x1080, phóng xa nhất, GTX 1660 SUPER thì nó
    // tốn 0,84 trên tổng 2,4 ms — hơn một phần ba cả khung hình, cho một bậc mà cả lý do tồn
    // tại là chạy được trên máy yếu. Hemisphere nhận lại phần việc, xem applyQuality.
    env: false, grain: false, haze: true,
    bevel: false, sway: false, cloudDetail: 0, glow: false, tilt: false,
  },
  medium: {
    label: 'Medium', dpr: 1.5, dprMax: 2.5, post: true, aoScale: 0.5, aoSamples: 8,
    shadowMap: 2048, shadowRadius: 2,
    env: true, grain: true, haze: true,
    bevel: true, sway: true, cloudDetail: 1, glow: false, tilt: false,
  },
  /*
   * AO ở 0,75 độ phân giải chứ không phải đủ: đo bằng đồng hồ GPU ở 1920×1080, phóng xa nhất,
   * GTX 1660 SUPER — AO đủ cỡ tốn 3,9 trên tổng 6,8 ms, vượt ngân sách 6 ms của bậc này; ở
   * 0,75 cả khung còn 5,4 ms, mà AO vốn mềm nên mắt không phân biệt được. Bóng 4096 chỉ thêm
   * 0,1 ms và mô hình thu nhỏ gần như không tốn gì, nên giữ cả hai.
   */
  high: {
    label: 'High', dpr: 2, dprMax: 3, post: true, aoScale: 0.75, aoSamples: 12,
    shadowMap: 4096, shadowRadius: 3,
    env: true, grain: true, haze: true,
    bevel: true, sway: true, cloudDetail: 1, glow: true, tilt: true,
  },
};

/**
 * Mật độ điểm ảnh thật sự dùng, cho một khung nhìn cỡ bất kỳ.
 *
 * `dpr` của mỗi bậc được chọn khi ngắm một màn hình bàn giấy, và đem thẳng sang điện thoại
 * thì hỏng nặng: khung nhìn CSS của điện thoại chỉ bằng một phần sáu màn 1080p, nhưng màn
 * hình nó lại dày gấp ba. "Trần 1" ở đó nghĩa là vẽ ở một phần ba độ phân giải màn hình rồi
 * phóng to lên — mờ tịt — trong khi GPU mới gánh một phần sáu khối lượng nó chịu được.
 *
 * Nên trần không phải một TỈ LỆ mà là một NGÂN SÁCH ĐIỂM ẢNH: đúng bằng số điểm bậc ấy vẽ ở
 * 1920×1080. Khung nhìn nhỏ hơn thì được vẽ dày hơn, vừa đúng chỗ dư ra. Ở đúng khung tham
 * chiếu con số không đổi, nên không máy bàn nào thấy khác đi.
 *
 * `dprMax` chặn trên, vì ngân sách suy từ một con GTX còn chip điện thoại yếu hơn nhiều; và
 * vì trên 2 lần thì mắt gần như không phân biệt được nữa.
 */
const THAM_CHIEU = 1920 * 1080;

export function pixelRatioFor(q: TierSpec, w: number, h: number, dpr: number): number {
  const css = Math.max(1, w * h);
  const can = Math.sqrt((THAM_CHIEU * q.dpr * q.dpr) / css);
  return Math.min(dpr, q.dprMax, Math.max(q.dpr, can));
}

const DOWN: Record<Tier, Tier | null> = { high: 'medium', medium: 'low', low: null };
export const stepDown = (t: Tier): Tier | null => DOWN[t];

export interface GfxSettings {
  choice: Choice;
  /** Hiệu ứng mô hình thu nhỏ — chỉ có tác dụng ở bậc cho phép. */
  tilt: boolean;
  /** Bậc mà Tự động dừng lại lần trước. */
  autoTier: Tier;
  /** Đời của bộ thiết lập — xem DOI. */
  v: number;
}

/*
 * Đời 2: mô hình thu nhỏ thành thứ PHẢI BẬT mới có, không còn mặc định.
 *
 * Nó giữ nét một dải ngang giữa màn hình và làm mờ phần còn lại — đo được chừng sáu phần
 * mười khung hình bị mờ. Đẹp trong một tấm ảnh chụp, nhưng người chơi nhìn nó suốt cả ván,
 * và điều họ nói ra là "không đủ sắc nét". Bản lưu thiết lập đời cũ mang `tilt: true` chỉ
 * vì đó là mặc định chứ không ai chọn, nên lên đời thì tắt MỘT lần; từ đó trở đi ai bật thì
 * được giữ.
 */
const DOI = 2;

/**
 * Bậc mà Tự động thử đầu tiên.
 *
 * Máy cảm ứng bắt đầu từ Vừa chứ không phải Cao. Bộ đo chỉ chạy năm giây đầu, lúc máy còn
 * nguội; một chiếc điện thoại qua được năm giây ấy ở bậc Cao — 2,7 triệu điểm ảnh, bóng
 * 4096, AO 12 mẫu — rồi nóng dần và tụt khung ở phút thứ ba, khi không còn ai đo nữa. Bậc
 * Vừa trên màn điện thoại vẫn vẽ dày 2,5 lần, nên cái mất đi là quầng sáng và bóng 4096,
 * không phải độ nét. Ai muốn Cao thì chọn tay trong bảng.
 */
export function firstAutoTier(): Tier {
  try {
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return 'medium';
  } catch {
    /* trình duyệt cổ — coi như máy bàn */
  }
  return 'high';
}

/*
 * Lưu RIÊNG với bản lưu ván chơi: đây là thiết lập của MÁY, không phải của ván. Chơi lại từ
 * đầu không được kéo đồ hoạ về mặc định, và một bản lưu mang sang máy khác không được kéo
 * theo bậc đồ hoạ của máy cũ.
 */
const KEY = 'quandao-gfx';
const TIER_IDS: readonly string[] = ['low', 'medium', 'high'];

export function loadGfx(): GfxSettings {
  const def: GfxSettings = { choice: 'auto', tilt: false, autoTier: firstAutoTier(), v: DOI };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def;
    const p = JSON.parse(raw) as Partial<GfxSettings>;
    return {
      choice: p.choice === 'auto' || TIER_IDS.includes(String(p.choice)) ? p.choice as Choice : def.choice,
      tilt: p.v === DOI && p.tilt === true,
      autoTier: TIER_IDS.includes(String(p.autoTier)) ? p.autoTier as Tier : def.autoTier,
      v: DOI,
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
