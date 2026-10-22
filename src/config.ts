/**
 * Bố cục thế giới, bảng tài nguyên, bảng công trình. Công thức cân bằng nằm ở EconomyMath.ts.
 *
 * Bố cục cố định có chủ ý (không cho đặt nhà tự do). Hệ quả tốt là đường đi cũng cố định được:
 * hành lang chạy dọc trục x=0, z=0 và hai rìa z=±14, còn nhà nằm ở z=±5,5 / ±10,5 và
 * x=±4,5 / ±9,5 — nên thợ KHÔNG BAO GIỜ đi xuyên qua nhà, mà không cần một dòng mã tránh vật
 * cản nào. Bệ đất rộng 3,1 nên nửa bệ là 1,55: hàng z=±5,5 trải từ 3,95 tới 7,05, trong khi
 * hành lang z=0 chỉ rộng từ -0,55 tới 0,55.
 *
 *            z=-16.5  [ gỗ ]      [ gỗ ]      [ gỗ ]
 *            z=-14    ●───────────●───────────●
 *            z=-10.5  [ ][ ]      │      [ ][ ]
 *            z=-5.5   [ ][ ]      │      [ ][ ]
 *   [pha lê] z= 0     ●───────────◆CHỢ────────●  [pha lê]
 *            z= 5.5   [ ][ ]      │      [ ][ ]
 *            z= 10.5  [ ][ ]      │      [ ][ ]
 *            z= 14    ●───────────●───────────●
 *            z= 16.5  [ đá ]      [ đá ]      [ đá ]
 */
import { ECONOMY, EconomyMath } from './EconomyMath';
import type { BuildingType, Cost, ResourceKind, ResourceNode, Slot, Vec3, Waypoint } from './types';

export const AUTOSAVE_INTERVAL_MS = 5000;
export const SAVE_KEY = 'base-idle/v3';

/** Chặn delta để một lần giật khung hình không đẩy thợ xuyên nửa bản đồ. */
export const MAX_FRAME_DELTA = 0.1;

/** Cấp người chơi = 1 + tổng cấp công trình / ngần này. */
export const LEVELS_PER_PLAYER_LEVEL = 3;

/** Mỗi cấp nhà ở chứa được bao nhiêu thợ. Thuê thợ cần CẢ tiền lẫn chỗ ở. */
export const HOUSING_PER_HUT_LEVEL = 2;

/** Xu lúc mới mở game: đủ để hành động đầu tiên xảy ra ngay trong mười giây đầu. */
export const STARTING_COINS = 150;

/** Trần chứa khi chưa có Kho nào, áp cho TỪNG loại tài nguyên. */
export const BASE_STORAGE = 150;
export const STORAGE_PER_WAREHOUSE_LEVEL = 150;

// ---------------------------------------------------------------- tài nguyên

export interface ResourceMeta {
  label: string;
  icon: string;
  /** Xu thu được khi chợ bán một đơn. */
  value: number;
  /** Màu thùng hàng trên lưng thợ, và màu chấm trên thanh tài nguyên. */
  color: number;
}

/**
 * Chế biến đáng giá hay không nằm hết ở bảng này: hai gỗ (2 xu) thành một ván (8 xu) là gấp
 * bốn, hai đá (6 xu) thành một gạch (20 xu) là gấp hơn ba. Đủ lớn để người chơi thấy ngay
 * xưởng cưa là bước ngoặt, chứ không phải một con số phải ngồi tính mới ra.
 */
export const RESOURCES: Record<ResourceKind, ResourceMeta> = {
  wood: { label: 'Gỗ', icon: '🪵', value: 1, color: 0x8fc08a },
  stone: { label: 'Đá', icon: '🪨', value: 3, color: 0xa9b2bd },
  gold: { label: 'Vàng', icon: '💰', value: 9, color: 0xffb703 },
  planks: { label: 'Ván', icon: '🟫', value: 8, color: 0xc89b63 },
  bricks: { label: 'Gạch', icon: '🧱', value: 20, color: 0xc2724f },
};

/**
 * Chợ bán gì, và GIỮ LẠI bao nhiêu.
 *
 * Đây là chỗ bản đầu làm sai và phải sửa hẳn. Lúc đầu chợ bán tuốt mọi thứ, kết quả đo được:
 * ván luôn đứng ở 0 vì vừa chở về là bán mất — trong khi giá mở ô từ ô thứ 5 trở đi lại ĐÒI
 * ván, và mở bậc 3 đòi 250 gỗ. Người chơi không bao giờ gom đủ, game kẹt mà không báo gì.
 *
 * Luật bây giờ khớp đúng câu "xu đến từ việc giao hàng đã chế về chợ":
 *   - Gỗ và đá KHÔNG BAO GIỜ bán. Chúng là vật liệu xây dựng, và là đầu vào của xưởng.
 *   - Ván, gạch, pha lê bán phần DƯ trên một mức giữ lại cố định, nên vừa có xu đều đều vừa
 *     luôn còn hàng trong kho để trả những khoản giá đòi nguyên liệu.
 *
 * Hệ quả cho nhịp chơi, và là chủ ý: chưa có Xưởng cưa thì gần như không có xu. Xưởng cưa
 * đầu tiên (50 xu + 15 gỗ, trả được ngay bằng tiền khởi đầu) chính là bước ngoặt của ván.
 */
export const SELL_ORDER: ResourceKind[] = ['bricks', 'planks', 'gold'];

/**
 * Giữ lại ngần này mỗi loại, phần dư mới đem bán. Để nhỏ thôi: mức giữ lại chỉ cốt sao người
 * chơi luôn có sẵn ít vật liệu trong tay, còn việc tích cho những khoản giá lớn là nhờ xây
 * thêm xưởng cho sản lượng vượt sức bán của chợ.
 */
export const SELL_RESERVE: Partial<Record<ResourceKind, number>> = {
  planks: 10,
  bricks: 10,
  gold: 20,
};

/**
 * Xưởng chừa lại ngần này nguyên liệu thô, không rút xuống dưới.
 *
 * Thiếu chỗ chừa này thì xưởng cưa ăn sạch gỗ và kho gỗ đứng ở 0 vĩnh viễn — mà giá xây nào
 * cũng đòi gỗ, nên người chơi không xây được gì nữa và không có gì trên màn hình nói cho họ
 * biết vì sao.
 */
export const PROCESS_RESERVE = 25;

export interface Recipe {
  from: ResourceKind;
  to: ResourceKind;
  /** Bao nhiêu đơn nguyên liệu cho một đơn thành phẩm. */
  ratio: number;
}

export const RECIPES: Partial<Record<BuildingType, Recipe>> = {
  sawmill: { from: 'wood', to: 'planks', ratio: 2 },
  masonry: { from: 'stone', to: 'bricks', ratio: 2 },
};

/** Hàng chế xong nằm chờ tại chỗ được tối đa ngần này mỗi cấp. Đầy thì xưởng dừng. */
export const BUFFER_PER_LEVEL = 30;

// ------------------------------------------------------------------ công trình

export interface BuildingSpec {
  label: string;
  icon: string;
  maxLevel: number;
  describe: (level: number) => string;
}

/** Đơn mỗi giây mà một xưởng chế ra được. Dùng chung công thức sản lượng của bản đặc tả. */
export function processRate(level: number): number {
  return EconomyMath.getBuildingOutput(ECONOMY.baseOutput, ECONOMY.outputGrowthRate, level) / 10;
}

/**
 * Đơn mỗi giây mà chợ bán được.
 *
 * Cố ý đặt NGANG sản lượng một xưởng (cùng chia 10), chứ không cao hơn. Lúc đầu để chợ bán
 * 5 đơn/giây trong khi xưởng chỉ làm 1 — đo ra là ván không bao giờ tích được quá mức giữ
 * lại, nên những khoản giá đòi ván trở thành không thể trả.
 *
 * Bằng nhau thì có chuyện để nghĩ: thêm xưởng là hàng tồn lên, tích được vật liệu cho những
 * khoản giá lớn; nâng chợ là đổi hàng tồn lấy xu ngay. Hai hướng đối nhau, và người chơi
 * phải chọn.
 */
export function marketRate(level: number): number {
  return EconomyMath.getBuildingOutput(ECONOMY.baseOutput, ECONOMY.outputGrowthRate, level) / 10;
}

export const BUILDINGS: Record<Exclude<BuildingType, 'none'>, BuildingSpec> = {
  market: {
    label: 'Chợ', icon: '⛲', maxLevel: 10,
    describe: (l) => `Bán ${marketRate(l).toFixed(1)} đơn mỗi giây`,
  },
  hut: {
    label: 'Nhà ở', icon: '🏠', maxLevel: 10,
    describe: (l) => `Chỗ ở cho ${l * HOUSING_PER_HUT_LEVEL} thợ`,
  },
  sawmill: {
    label: 'Xưởng cưa', icon: '🪚', maxLevel: 10,
    describe: (l) => `2 gỗ → 1 ván, ${processRate(l).toFixed(1)} ván mỗi giây`,
  },
  masonry: {
    label: 'Lò gạch', icon: '🧱', maxLevel: 10,
    describe: (l) => `2 đá → 1 gạch, ${processRate(l).toFixed(1)} gạch mỗi giây`,
  },
  warehouse: {
    label: 'Kho', icon: '📦', maxLevel: 10,
    describe: (l) => `Chứa thêm ${l * STORAGE_PER_WAREHOUSE_LEVEL} mỗi loại`,
  },
};

/** Thứ tự nút trong bảng xây. `market` không có ở đây: chợ chỉ có một và đã dựng sẵn. */
export const BUILDABLE: Exclude<BuildingType, 'none' | 'market'>[] =
  ['hut', 'sawmill', 'masonry', 'warehouse'];

/**
 * Giá một cấp công trình. Xu theo đúng đường cong của bản đặc tả (50 × 1,15^L); nguyên liệu
 * là phần cộng thêm, và cố tình nhẹ hơn để XU vẫn là cái quyết định nhịp.
 *
 * Đá chỉ bị đòi từ cấp 3 trở đi: đá mở ở cấp người chơi 2, nên đòi sớm hơn là khoá người chơi
 * vào một thứ họ chưa với tới được.
 */
export function buildingCost(totalLevels: number): Cost {
  const cost: Cost = {
    coins: EconomyMath.cost(ECONOMY.building, totalLevels),
    wood: Math.floor(15 * Math.pow(1.25, Math.max(0, totalLevels))),
  };
  if (totalLevels >= 3) cost.stone = Math.floor(6 * Math.pow(1.3, totalLevels - 3));
  return cost;
}

/** Giá mở ô thứ k. Xu giữ nguyên 200 × 2,2^(k-1) như bản đặc tả. */
export function slotCost(k: number): Cost {
  const cost: Cost = {
    coins: EconomyMath.cost(ECONOMY.slot, k),
    wood: Math.floor(40 * Math.pow(1.6, k - 1)),
  };
  if (k >= 2) cost.stone = Math.floor(15 * Math.pow(1.7, k - 2));
  if (k >= 5) cost.planks = Math.floor(20 * Math.pow(1.5, k - 5));
  return cost;
}

// ------------------------------------------------------------------ bậc lãnh thổ

export interface TierSpec {
  tier: number;
  /** Cấp căn cứ tối thiểu. */
  requiresLevel: number;
  cost: Cost;
  /** Bán kính nền đảo ở bậc này. */
  groundSize: number;
  label: string;
}

/**
 * Mở đất theo bậc, tách hẳn khỏi việc mua từng ô.
 *
 * Hai cổng khác nhau và cố ý như vậy: MỞ BẬC là cột mốc, trả bằng nguyên liệu thô và đòi cấp
 * căn cứ — cả vùng đất hiện ra một lượt. MUA Ô là nhịp đều đặn, trả bằng xu theo đường cong
 * 200 × 2,2^k. Nhờ tách ra, người chơi luôn có một việc lớn để nhắm tới và một việc nhỏ để
 * làm ngay, thay vì chỉ có một hàng giá tăng dần.
 */
export const TIERS: TierSpec[] = [
  { tier: 1, requiresLevel: 1, cost: { coins: 0 }, groundSize: 38, label: 'Khu trung tâm' },
  { tier: 2, requiresLevel: 2, cost: { coins: 0, wood: 100, stone: 50 }, groundSize: 43, label: 'Vành trong' },
  { tier: 3, requiresLevel: 3, cost: { coins: 0, wood: 250, stone: 150, gold: 50 }, groundSize: 50, label: 'Bốn góc đảo' },
];

export const MAX_TIER = TIERS.length;

export function tierSpec(tier: number): TierSpec {
  return TIERS[Math.min(Math.max(tier, 1), MAX_TIER) - 1];
}

/**
 * Vành tài nguyên lùi ra xa ở bậc cuối, đúng yêu cầu "đẩy cây và mỏ ra ngoài".
 *
 * Hệ quả cho người chơi không chỉ là thẩm mỹ: đường xa hơn nghĩa là mỗi chuyến lâu hơn, nên
 * đúng lúc đảo rộng ra thì nâng Giày và Balo mới thành việc đáng tiền.
 */
export function nodeRing(tier: number): { edge: number; side: number } {
  return tier >= 3 ? { edge: 20, side: 20.5 } : { edge: 16.5, side: 17 };
}

// ------------------------------------------------------------------ các ô đất

const SLOT_ROWS = [-10.5, -5.5, 5.5, 10.5];
const SLOT_COLS = [-9.5, -4.5, 4.5, 9.5];

/** Số ô mở sẵn lúc bắt đầu (một đã có nhà, một để trống). */
export const FREE_SLOTS = 2;

/**
 * Ô trung tâm là CHỢ, dựng sẵn cấp 1 — không có chợ thì không có xu.
 *
 * Ô gần chợ nhất cũng dựng sẵn một NHÀ Ở, và đây không phải để chiều người chơi mà để game
 * chạy được: thợ cần chỗ ở, mọi thứ khác đến từ thợ. Bắt đầu với 0 chỗ ở thì không có đường
 * nào kiếm đồng đầu tiên. Ô thứ hai mở sẵn nhưng để trống, làm quyết định đầu tiên.
 *
 * Mười bốn ô còn lại khoá dần theo đúng đường cong 200 × 2,2^k: 200, 440, 968, 2.129, 4.685,
 * 10.307, 22.675, 49.887, 109.751, 241.453, 531.198, 1.168.636, 2.571.000, 5.656.201 xu.
 * Xếp theo khoảng cách tới chợ nên ô rẻ nhất luôn là ô gần nhất — trại lớn dần ra ngoài.
 */
/**
 * Thứ tự ô, xếp theo khoảng cách tới chợ. Cả makeSlots() lẫn mạng đường đều hỏi hàm này, nên
 * mã ô và lối rẽ của nó không thể lệch nhau.
 */
function sortedSpots(): Vec3[] {
  const spots: Vec3[] = [];
  for (const z of SLOT_ROWS) for (const x of SLOT_COLS) spots.push([x, 0, z]);
  return spots.sort((a, b) =>
    (Math.hypot(a[0], a[2]) - Math.hypot(b[0], b[2])) || (a[0] - b[0]) || (a[2] - b[2]));
}

/**
 * Ô thuộc bậc nào, suy thẳng từ toạ độ: tám ô ở hai hàng trong là bậc 1; bốn ô hàng ngoài
 * nhưng cột trong là bậc 2 (mỗi góc phần tư một ô, đúng như đặc tả); bốn ô góc ngoài cùng
 * là bậc 3.
 */
function tierOf(position: Vec3): number {
  const outerRow = Math.abs(position[2]) > 8;
  const outerCol = Math.abs(position[0]) > 7;
  if (!outerRow) return 1;
  return outerCol ? 3 : 2;
}

function slotIdAt(x: number, z: number): string {
  const i = sortedSpots().findIndex((p) => p[0] === x && p[2] === z);
  return `s${i + 1}`;
}

export function makeSlots(): Slot[] {
  const spots = sortedSpots();

  const slots: Slot[] = [
    {
      id: 'core', tier: 1, type: 'market', level: 1, position: [0, 0, 0],
      state: 'CONSTRUCTED', unlockCost: { coins: 0 }, buffer: 0,
    },
  ];
  let unlockIndex = 1;
  spots.forEach((position, i) => {
    const free = i < FREE_SLOTS;
    const prebuilt = i === 0;
    slots.push({
      id: `s${i + 1}`,
      tier: tierOf(position),
      type: prebuilt ? 'hut' : 'none',
      level: prebuilt ? 1 : 0,
      position,
      state: prebuilt ? 'CONSTRUCTED' : free ? 'UNLOCKED_EMPTY' : 'LOCKED',
      unlockCost: free ? { coins: 0 } : slotCost(unlockIndex++),
      buffer: 0,
    });
  });
  return slots;
}

// ------------------------------------------------------------------ điểm mút

/**
 * Mạng đường đi, sinh tự động thành một lưới phố.
 *
 * Vì sao phải là lưới chứ không phải vài đoạn như trước: thợ chở hàng đi tới TẬN xưởng, nên
 * mỗi ô đất cần một lối rẽ riêng, và lối rẽ đó không được cắt qua nền nhà bên cạnh. Nối thẳng
 * ô về chợ là hỏng — đường từ (9,5; 10,5) về gốc toạ độ xuyên đúng giữa ô (4,5; 5,5).
 *
 * Cách đặt: ngã tư ở mọi giao điểm của XS × ZS. Nối ngang thì nối hết; nối DỌC thì chỉ ở
 * x = -14, 0, 14. Lý do: một đoạn dọc ở x = ±4,5 chạy từ z=-8 lên z=0 sẽ xuyên qua đúng nền
 * nhà ở (±4,5; -5,5) — nền trải từ -7,05 tới -3,95. Ba trục dọc kia thì sạch, vì nền nhà chỉ
 * nằm trong khoảng |x| từ 2,95 tới 11,05.
 *
 * Mỗi ô đất rẽ thẳng ra phố ngang gần nhất (z = ±8) theo đúng trục x của nó — đoạn rẽ nằm lọt
 * giữa hai hàng nhà nên không chạm gì cả.
 */
const JUNCTION_XS = [-14, -9.5, -4.5, 0, 4.5, 9.5, 14];
const JUNCTION_ZS = [-14, -8, 0, 8, 14];
/** Chỉ ba trục này được nối dọc; xem giải thích ở trên. */
const VERTICAL_XS = [-14, 0, 14];

const num = (n: number) => String(n).replace('.', 'p').replace('-', 'm');
const junctionId = (x: number, z: number) => (x === 0 && z === 0 ? 'hub' : `j${num(x)}_${num(z)}`);
/** Mã điểm đi lại của một ô đất. WorkerManager dùng để bảo thợ chở hàng tới đúng xưởng. */
export const slotWaypointId = (slotId: string) => `at_${slotId}`;

function makeWaypoints(): Waypoint[] {
  const out: Waypoint[] = [];
  const add = (id: string, position: Vec3) => { out.push({ id, position, links: [] }); };
  const link = (a: string, b: string) => {
    out.find((w) => w.id === a)?.links.push(b);
    out.find((w) => w.id === b)?.links.push(a);
  };

  for (const z of JUNCTION_ZS) for (const x of JUNCTION_XS) add(junctionId(x, z), [x, 0, z]);
  for (const z of JUNCTION_ZS) {
    for (let i = 1; i < JUNCTION_XS.length; i += 1) {
      link(junctionId(JUNCTION_XS[i - 1], z), junctionId(JUNCTION_XS[i], z));
    }
  }
  for (const x of VERTICAL_XS) {
    for (let i = 1; i < JUNCTION_ZS.length; i += 1) {
      link(junctionId(x, JUNCTION_ZS[i - 1]), junctionId(x, JUNCTION_ZS[i]));
    }
  }

  // Lối rẽ vào từng ô đất: ra thẳng phố ngang z = ±8 theo đúng trục x của ô.
  for (const z of SLOT_ROWS) {
    for (const x of SLOT_COLS) {
      const id = slotWaypointId(slotIdAt(x, z));
      add(id, [x, 0, z]);
      link(id, junctionId(x, z < 0 ? -8 : 8));
    }
  }
  return out;
}

export const WAYPOINTS: Waypoint[] = makeWaypoints();

/**
 * Thời gian đứng đào là HẰNG SỐ cho mọi chỗ (bản đặc tả: GatheringDuration 2,0 giây), nên cái
 * phân biệt các chỗ đào chỉ còn hai thứ: giá trị mỗi đơn, và quãng đường.
 */
export function resourceNodes(tier: number): ResourceNode[] {
  const { edge, side } = nodeRing(tier);
  return [
    { id: 'wood_nw', kind: 'wood', position: [-14, 0, -edge], unlockLevel: 1, waypoint: junctionId(-14, -14) },
    { id: 'wood_n', kind: 'wood', position: [0, 0, -edge], unlockLevel: 1, waypoint: junctionId(0, -14) },
    { id: 'wood_ne', kind: 'wood', position: [14, 0, -edge], unlockLevel: 1, waypoint: junctionId(14, -14) },
    { id: 'stone_sw', kind: 'stone', position: [-14, 0, edge], unlockLevel: 2, waypoint: junctionId(-14, 14) },
    { id: 'stone_s', kind: 'stone', position: [0, 0, edge], unlockLevel: 3, waypoint: junctionId(0, 14) },
    { id: 'stone_se', kind: 'stone', position: [14, 0, edge], unlockLevel: 2, waypoint: junctionId(14, 14) },
    { id: 'gold_w', kind: 'gold', position: [-side, 0, 0], unlockLevel: 3, waypoint: junctionId(-14, 0) },
    { id: 'gold_e', kind: 'gold', position: [side, 0, 0], unlockLevel: 3, waypoint: junctionId(14, 0) },
  ];
}

// ------------------------------------------------------------------ màu sắc

/**
 * Bảng màu. Chuyển từ tông be phẳng sang kiểu diorama đa giác thấp: cỏ xanh mướt trên mặt,
 * vách đá nâu sẫm xếp bậc bên dưới, nước ngọc lam quanh chân đảo.
 *
 * Hai sắc cỏ là cố ý. Một sắc duy nhất trên vài trăm ô lục giác trông như tấm thảm nhựa;
 * trộn hai sắc theo nhiễu là mặt đất có hơi thở mà không tốn thêm một lệnh vẽ nào, vì cả
 * cánh đồng vẫn là một InstancedMesh.
 */
export const PALETTE = {
  grassA: 0x529342,
  grassB: 0x62aa4e,
  cliffTop: 0x4a3728,
  cliffMid: 0x3a2b1f,
  cliffLow: 0x2e2118,
  goldVein: 0xffb703,
  water: 0x48cae4,
  path: 0xb79a6a,

  market: 0xd94e34,
  marketWall: 0x8d5b4c,
  hut: 0xc96f4a,
  sawmill: 0xa9763f,
  masonry: 0x9a5b4a,
  warehouse: 0x5b8fae,

  socketFence: 0x8d6b4c,
  socketDirt: 0x6f5a3c,
  slotLocked: 0x5a4a34,

  pineA: 0x2f6b3a,
  pineB: 0x3d8248,
  pineC: 0x4e9a55,
  trunk: 0x6b4a32,
  granite: 0x9aa3ad,
  graniteDark: 0x76808a,

  villager: 0xf2e4cf,
  hat: 0xe0b14f,
  sky: 0xade8f4,
  skyFog: 0xc9eef7,
} as const;

export const BUILDING_COLOR: Record<Exclude<BuildingType, 'none'>, number> = {
  market: PALETTE.market,
  hut: PALETTE.hut,
  sawmill: PALETTE.sawmill,
  masonry: PALETTE.masonry,
  warehouse: PALETTE.warehouse,
};
