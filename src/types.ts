/**
 * Kiểu dữ liệu dùng chung cho quần đảo.
 *
 * Quy ước: mọi thứ LƯU ĐƯỢC đều nằm trong GameState và chỉ gồm dữ liệu thuần (số, chuỗi,
 * mảng) — không Vector3, không mesh, không hàm. Nhờ vậy lưu chỉ là JSON.stringify và đọc lại
 * không cần hồi sinh lớp nào. Phần chạy (mesh, hoạt cảnh) sống riêng và dựng lại được từ
 * trạng thái bất cứ lúc nào.
 */

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

// ---------------------------------------------------------------- tài nguyên

/**
 * Năm loại, đúng như thanh HUD yêu cầu. `gold` vừa là tài nguyên vừa là TIỀN — gom hai thứ
 * làm một vì bản đặc tả đặt 🪙 cho vàng, mà để song song cả vàng lẫn một đồng xu riêng thì
 * người chơi phải nhớ hai thang giá trị chẳng vì lý do gì.
 */
export type ResourceKind = 'food' | 'wood' | 'gold' | 'stone' | 'relics';

export const RESOURCE_KINDS: ResourceKind[] = ['food', 'wood', 'gold', 'stone', 'relics'];

export type Inventory = Record<ResourceKind, number>;

/** Giá một thứ. Thiếu trường nghĩa là không cần loại đó. */
export type Cost = Partial<Inventory>;

// ------------------------------------------------------------- biến sinh thái

export type BiomeId = 'meadow' | 'crags' | 'desert' | 'highlands';

export interface Biome {
  id: BiomeId;
  label: string;
  /** Hai sắc nền, trộn theo nhiễu để mặt đất có hơi thở. */
  ground: [number, number];
  /** Màu chấm trên minimap. */
  minimap: string;
  /** Loại tài nguyên biến này cho ra. */
  yields: ResourceKind[];
}

// -------------------------------------------------------------------- mỏ

/**
 * Bai tai nguyen: mot KHU co vung dat rieng, khong phai mot cham nho.
 *
 * Doi tu "mo le" sang "bai" vi hai ly do, va ca hai deu la thu nguoi choi noi ra: nhin vao
 * ban do phai biet ngay dau la rung, dau la mo da; va phai co mot thu du to de ma chi vao
 * roi bao "cho ba nguoi toi day".
 */
export interface Patch {
  id: string;
  kind: ResourceKind;
  /** Ten hien thi: Rung, Ruong, Mo da, Bai vang, Rung pha le. */
  label: string;
  center: Vec3;
  /** Ban kinh vung dat cua bai. Dung cho ca hinh anh lan vung bam chon. */
  radius: number;
  /** Cho dung dao. Nhieu cho de dan khong chong len nhau. */
  spots: Vec3[];
  biome: BiomeId;
  richness: number;
}

// ------------------------------------------------------------------ công trình

export type BuildingType = 'townhall' | 'house' | 'granary' | 'outpost' | 'watchtower';

// ------------------------------------------------------------------ mùa bão

/** Bão phá công trình, cướp khuân hàng. Hai mối hoạ khác nhau nên phải phòng khác nhau. */
export type WaveKind = 'storm' | 'raid';

/** Chuyện đã xảy ra ở một đợt. Lưu lại để kể cho người chơi, kể cả lúc họ vắng mặt. */
export interface WaveResult {
  wave: number;
  kind: WaveKind;
  /** Sức của đợt và sức thủ lúc đối đầu. Hiện cả hai để người chơi biết còn thiếu bao nhiêu. */
  power: number;
  guard: number;
  won: boolean;
  /** Hàng bị khuân đi. */
  lost: Partial<Inventory>;
  /** Số cấp công trình bị bão đánh sập. */
  levels: number;
  /** Thu được từ xác tàu, nếu đẩy lui được. */
  reward: Partial<Inventory>;
  /** Đợt này nổ ra lúc người chơi không có mặt. */
  away: boolean;
}

export interface Threat {
  /** Giây còn lại tới đợt tới. Chạy cả lúc vắng mặt. */
  next: number;
  /** Số đợt đã qua. Sức của đợt lớn dần theo con số này. */
  wave: number;
  /** Sức thủ đã thuê thêm cho đợt sắp tới. Về 0 ngay khi đợt ấy xong. */
  hired: number;
  /** Kết quả đợt gần nhất. */
  last: WaveResult | null;
}

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  position: Vec3;
  biome: BiomeId;
  /** Hàng đang gom tại trạm, chờ xe thồ chở về thủ phủ. Chỉ `outpost` dùng. */
  stock: Partial<Inventory>;
  /** Giây còn lại tới chuyến xe kế tiếp. Chỉ `outpost` dùng. */
  cartTimer: number;
}

// ---------------------------------------------------------------------- đơn vị

export type UnitKind = 'villager' | 'cart';
export type UnitState = 'idle' | 'moving' | 'gathering' | 'delivering';

export interface Unit {
  id: string;
  kind: UnitKind;
  state: UnitState;
  speed: number;
  capacity: number;

  position: Vec3;
  /** Đích đang nhắm: mã mỏ (thợ đi đào) hoặc mã công trình (đi giao). */
  targetId: string | null;
  /** Toạ độ đích, giữ sẵn để khỏi tra lại mỗi khung hình. */
  targetPos: Vec3 | null;
  /** Hướng mặt, radian. Lưu lại để mở tab ra thợ không quay ngoắt. */
  facing: number;

  carrying: number;
  carryingKind: ResourceKind | null;
  gatherTimer: number;
  /** Trạm sẽ giao hàng về — null nghĩa là về thẳng thủ phủ. */
  homeId: string;
}

// ------------------------------------------------------------------ màn mây

export interface FogChunk {
  id: string;
  /** Tâm ô sương, toạ độ thế giới. */
  center: Vec2;
  revealed: boolean;
}

// ---------------------------------------------------------------- trạng thái

/** Làng của người chơi: cái tên và màu cờ họ chọn lúc mới mở game. */
export interface Village {
  name: string;
  /** Màu cờ, cũng là màu dải băng trên mặt tiền thủ phủ. */
  color: number;
}

export interface GameState {
  /** Rỗng nghĩa là chưa lập làng — mở game ra sẽ hỏi. */
  village: Village;
  threat: Threat;
  inv: Inventory;
  storageLimit: number;
  level: number;

  buildings: Building[];
  units: Unit[];
  /** Mã các ô sương đã vén. Chỉ lưu mã, còn hình dạng thế giới thì sinh lại được. */
  revealed: string[];

  lastSavedTimestamp: number;
  muted: boolean;
  totalGold: number;
  speedLevel: number;
  capacityLevel: number;
  /**
   * Đơn hàng xây dựng đang mở. Khi người chơi bấm xây hoặc nâng cấp mà chưa đủ vật liệu, cả
   * làng quay sang gom đúng những thứ còn thiếu cho tới khi đủ. Đây là thứ thay cho hạn ngạch
   * tay: người chơi nói MUỐN GÌ, không phải điều ai đi đâu.
   */
  demand: { cost: Cost; label: string } | null;
  /**
   * Han ngach dan cho tung bai: ma bai -> so nguoi muon dieu toi.
   *
   * Chi luu nhung bai CO han ngach, nen bang nay nho du ban do vo han. Bai bi huy khoi bo
   * nho (di xa) van giu han ngach, va nguoi choi quay lai thi dan lai keo toi - dung nhu ho
   * da dan.
   */
  assignments: Record<string, number>;
  /** Bat thi phan dan khong co han ngach se tu can theo kho nao voi nhat. */
  autoFarm: boolean;
  /** Hệ số tốc độ game: 1 hoặc 2. */
  speedMult: number;
  /**
   * Quãng xa nhất (tính từ thủ phủ) mà người chơi đã vén được.
   *
   * Đây là TẤT CẢ những gì cần lưu cho hệ mốc thành tựu: danh sách mốc đã đạt và mọi phần
   * thưởng đều suy ra được từ con số này. Hai bản ghi về cùng một sự thật sớm muộn cũng lệch.
   */
  maxReach: number;
}

/**
 * Nen dat. KHONG con la mot mang co dinh trong config nua: nen sinh ra theo tung khoi khi
 * nguoi choi di toi, nen so nen dat la vo han. Ma nen suy duoc tu toa do khoi.
 */
export interface Plot {
  id: string;
  position: Vec3;
  biome: BiomeId;
  /** Chi o goc toa do moi la core; con lai xay gi cung duoc. */
  core: boolean;
}

/** Kết quả tính lúc quay lại sau khi vắng mặt. */
export interface OfflineReport {
  /** Đợt bão/cướp nổ ra lúc vắng mặt, nếu có. */
  wave: WaveResult | null;
  /** Số đợt nữa đã bị bỏ qua — chỉ để kể, không có hậu quả. */
  waveSkipped: number;
  elapsedSeconds: number;
  creditedSeconds: number;
  gained: Partial<Inventory>;
  capped: boolean;
  full: ResourceKind[];
}
