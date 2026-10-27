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

export type NodeShape = 'pine' | 'wheat' | 'quarry' | 'iron' | 'dune_gold' | 'spire';

export interface ResourceNode {
  id: string;
  kind: ResourceKind;
  shape: NodeShape;
  position: Vec3;
  biome: BiomeId;
  /** Mỗi chuyến đào ra bao nhiêu phần so với sức mang. Mỏ quý thì nhỏ hơn 1. */
  richness: number;
}

// ------------------------------------------------------------------ công trình

export type BuildingType = 'townhall' | 'house' | 'granary' | 'outpost';

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

export interface GameState {
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
  /** Mỏ đang được ghim. 70% nhân lực dồn về đó. */
  focusNodeId: string | null;
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
  elapsedSeconds: number;
  creditedSeconds: number;
  gained: Partial<Inventory>;
  capped: boolean;
  full: ResourceKind[];
}
