/**
 * Kiểu dữ liệu dùng chung.
 *
 * Quy ước quan trọng: mọi thứ LƯU ĐƯỢC đều nằm trong GameState và chỉ gồm dữ liệu thuần
 * (số, chuỗi, mảng) — không Vector3, không mesh, không hàm. Nhờ vậy lưu chỉ là JSON.stringify
 * và đọc lại không cần hồi sinh lớp nào. Phần chạy (mesh, đường đi đang đi dở) sống riêng
 * trong WorkerManager và dựng lại được từ trạng thái bất cứ lúc nào.
 */

export type Vec3 = [number, number, number];

// ---------------------------------------------------------------- tài nguyên

/** Bậc 1: đào trực tiếp từ bản đồ. */
export type RawKind = 'wood' | 'stone' | 'gold';
/** Bậc 2: do công trình chế ra từ bậc 1. */
export type RefinedKind = 'planks' | 'bricks';
export type ResourceKind = RawKind | RefinedKind;

/**
 * Tên loại tài nguyên trùng đúng tên trường trong GameState, nên `state[kind]` chạy thẳng.
 * Nghe thì vụn vặt, nhưng một bảng ánh xạ giữa 'plank' và 'planks' là đúng loại lỗi âm thầm
 * mà trình biên dịch không bắt được và chỉ lòi ra khi người chơi mất đồ.
 */
export const RAW_KINDS: RawKind[] = ['wood', 'stone', 'gold'];
export const REFINED_KINDS: RefinedKind[] = ['planks', 'bricks'];
export const ALL_KINDS: ResourceKind[] = [...RAW_KINDS, ...REFINED_KINDS];

/** Giá một thứ, tính bằng nhiều loại cùng lúc. Thiếu trường nghĩa là không cần loại đó. */
export interface Cost {
  coins: number;
  wood?: number;
  stone?: number;
  gold?: number;
  planks?: number;
  bricks?: number;
}

// ---------------------------------------------------------------- công trình

/** LOCKED: chưa mở. UNLOCKED_EMPTY: mở rồi, đất trống. CONSTRUCTED: đã có nhà, xem `level`. */
export type SlotState = 'LOCKED' | 'UNLOCKED_EMPTY' | 'CONSTRUCTED';

/**
 * - `market`    chợ ở giữa, bán hàng ra xu. Có sẵn, không phá được.
 * - `hut`       nhà ở, quyết định số thợ ở được
 * - `sawmill`   xưởng cưa: gỗ -> ván
 * - `masonry`   lò gạch: đá -> gạch
 * - `warehouse` kho: nâng trần chứa cho MỌI loại
 */
export type BuildingType = 'none' | 'market' | 'hut' | 'sawmill' | 'masonry' | 'warehouse';

export interface Slot {
  id: string;
  /** Bậc lãnh thổ chứa ô này. Ô thuộc bậc chưa mở thì chưa tồn tại trên bản đồ. */
  tier: number;
  type: BuildingType;
  level: number;
  position: Vec3;
  state: SlotState;
  /** Giá mở ô. Ô mở sẵn từ đầu để 0 xu. */
  unlockCost: Cost;
  /**
   * Hàng đã chế xong đang nằm chờ tại chỗ, chưa ai chở về chợ. Chỉ xưởng cưa và lò gạch dùng.
   * Đầy thì CHẾ BIẾN DỪNG — đó là lý do vai thợ chở hàng có nghĩa chứ không phải trang trí.
   */
  buffer: number;
}

// -------------------------------------------------------------------- thợ

export type WorkerRole = 'forester' | 'miner' | 'carrier';

/**
 * Ai đào gì. `isAuto` bật thì ba con số kia bị bỏ qua và thợ tự dàn theo kho nào vơi nhất.
 *
 * Hạn ngạch chỉ nói về thợ ĐÀO. Thợ không nằm trong hạn ngạch nào sẽ đi CHỞ HÀNG từ xưởng
 * về chợ — nên "thợ rảnh" không phải là thợ đứng chơi, mà là lực lượng hậu cần.
 */
export interface WorkerAllocation {
  wood: number;
  stone: number;
  gold: number;
  isAuto: boolean;
}
export type WorkerState = 'idle' | 'moving' | 'gathering' | 'delivering';

export interface Worker {
  id: string;
  role: WorkerRole;
  speed: number;
  capacity: number;
  state: WorkerState;

  // ----- phần chạy, vẫn lưu để quay lại thấy thợ đứng đúng chỗ -----
  /** Mã điểm tài nguyên (thợ đào) hoặc mã ô đất (thợ chở hàng). null khi rảnh. */
  targetId: string | null;
  /** Đường đi còn lại, theo mã điểm mút. */
  path: string[];
  /** Đang đi tới path[pathIndex]. */
  pathIndex: number;
  position: Vec3;
  /** Số đơn đang vác. */
  carrying: number;
  /** Đang vác loại gì — quyết định cả màu thùng hàng trên lưng. */
  carryingKind: ResourceKind | null;
  /** Giây còn lại của nhịp đào hiện tại. */
  gatherTimer: number;
}

// ---------------------------------------------------------------- trạng thái

export interface GameState {
  coins: number;

  // Kho hàng. Mỗi loại bị chặn riêng ở storageLimit; đầy thì thợ thôi đào loại đó.
  wood: number;
  stone: number;
  gold: number;
  planks: number;
  bricks: number;
  /** Trần chứa, áp cho TỪNG loại. Nâng bằng công trình Kho. */
  storageLimit: number;

  level: number;
  slots: Slot[];
  workers: Worker[];
  lastSavedTimestamp: number;
  muted: boolean;
  /** Tổng xu kiếm được từ đầu. Chỉ để khoe, không tiêu được. */
  totalEarned: number;
  /** Cấp luyện dùng chung cho cả đội: mỗi cấp cộng 10% tốc độ đi bộ. */
  workerSpeedLevel: number;
  /** Cấp sức mang dùng chung: quyết định mỗi chuyến vác được bao nhiêu đơn. */
  workerCapacityLevel: number;
  /** Phân bổ thợ theo loại tài nguyên. Lưu lại để mở tab ra vẫn đúng ý người chơi. */
  allocation: WorkerAllocation;
  /** Bậc lãnh thổ đã mở. Quyết định đảo rộng bao nhiêu và có bao nhiêu ô để mua. */
  tier: number;
}

// ---------------------------------------------------------------- thế giới tĩnh

export interface ResourceNode {
  id: string;
  kind: RawKind;
  position: Vec3;
  /** Cấp người chơi tối thiểu để đào được. */
  unlockLevel: number;
  /** Điểm mút mà chỗ này nối vào. */
  waypoint: string;
}

export interface Waypoint {
  id: string;
  position: Vec3;
  links: string[];
}

/** Kết quả tính lúc quay lại sau khi vắng mặt. */
export interface OfflineReport {
  /** Giây đã trôi qua thật. */
  elapsedSeconds: number;
  /** Giây được tính tiền, sau khi chặn trần. */
  creditedSeconds: number;
  coins: number;
  /** Đã chạm trần tích luỹ hay chưa. */
  capped: boolean;
  /** Kho đầy loại nào trong lúc vắng mặt — để nói cho người chơi biết mà xây thêm Kho. */
  full: ResourceKind[];
}
