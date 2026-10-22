/**
 * Số liệu của cả thế giới: kích thước, biến sinh thái, giá cả, nhịp chơi.
 *
 * Thế giới rộng 60×60 nên toạ độ chạy từ -30 tới 30, thủ phủ ở gốc. Bốn biến sinh thái toả
 * ra bốn phía; vùng giữa luôn là đồng cỏ để người chơi có chỗ đứng chân ngay từ đầu.
 */
import type { Biome, BiomeId, Cost, ResourceKind, Vec2 } from './types';

export const WORLD = 60;
export const HALF = WORLD / 2;

export const SAVE_KEY = 'latbai-archipelago/v1';
export const AUTOSAVE_INTERVAL_MS = 5000;
export const MAX_FRAME_DELTA = 0.1;

// ------------------------------------------------------------------ nhịp chơi

export const AFK_CAP_SECONDS = 7200;
export const AFK_MIN_SECONDS = 30;
export const AFK_EFFICIENCY = 0.85;

export const BASE_SPEED = 3.4;
export const SPEED_PER_LEVEL = 0.1;
export const BASE_CAPACITY = 10;
export const CAPACITY_PER_LEVEL = 0.25;
export const GATHER_SECONDS = 2.0;

/**
 * Trần kho. Để 200 thì mọi loại chạm trần trong vài phút và dân đứng chơi; nhưng kho lẫm
 * cộng 220 mỗi cấp lại vọt quá nhanh ở cuối. Nới nền, giảm bước.
 */
export const BASE_STORAGE = 400;
export const STORAGE_PER_GRANARY = 260;
export const HOUSING_PER_HOUSE = 2;

/**
 * Thủ phủ bán phần DƯ ra vàng.
 *
 * Đây là chỗ vá cái "khoảng chết" đo được: từ phút 14 tới phút 26 người chơi không mua nổi
 * thứ gì, vì vàng là tiền thuê dân mà vàng chỉ có ở sa mạc, trong khi tự cân lại dàn thợ ra
 * cả năm loại. Giờ mọi thứ chất quá ngưỡng đều chảy thành vàng — vừa cho thu nhập một cái
 * sàn, vừa biến phần tràn vốn đang bị vứt đi thành có ích, vừa làm kho lẫm đáng xây hơn.
 */
export const SURPLUS_THRESHOLD = 0.7;
export const SURPLUS_RATE_PER_LEVEL = 1.4;
/**
 * Thu phu tu no chua duoc may nguoi. Khong co dong nay thi vua mo game da thay 1/0 - mot dan
 * dang lam viec trong khi cho o bang khong - nhin nhu loi chu khong nhu luat choi.
 */
export const HOUSING_FROM_TOWNHALL = 2;

/** Xe thồ: sức mang gấp năm thợ, và cứ chừng này giây lại rời trạm một chuyến. */
export const CART_CAPACITY_MULT = 5;
export const CART_INTERVAL_SECONDS = 26;

/**
 * Thợ giao hàng về trạm gần nhất trong bán kính này; xa hơn thì cuốc bộ về thủ phủ.
 * Đây chính là lý do tồn tại của trạm trung chuyển: không có nó, một chuyến từ rìa bản đồ
 * về giữa mất hơn một phút và cả biến sinh thái ngoài xa thành vô dụng.
 */
export const OUTPOST_RANGE = 22;

/**
 * Bán kính vén mây quanh một người.
 *
 * Để 5 thì đo được: 36 ô sương sạch bong trước phút thứ 10, tức cả cơ chế khám phá biến mất
 * đúng lúc người chơi mới bắt đầu. Hạ xuống 1,5 nghĩa là phải thực sự ĐI VÀO vùng đó, nên
 * mở bản đồ trở thành việc tốn thời gian thật chứ không phải hiệu ứng trang trí.
 */
export const REVEAL_RADIUS = 1.5;

/** Dưới ngần này dân thì không ai được cắt đi thám hiểm — còn phải lo cái ăn đã. */
export const SCOUT_MIN_VILLAGERS = 3;

/**
 * Giây phải ĐỨNG LẠI khảo sát trước khi một ô sương tan.
 *
 * Chỉ cần đi ngang qua là vén thì đo được: cả 36 ô sạch bong trong chưa tới ba phút kể từ
 * lúc có người thám hiểm đầu tiên — khám phá xong trước khi người chơi kịp nhận ra có thứ
 * để khám phá. Hai mươi giây mỗi ô kéo việc mở bản đồ ra khoảng mười lăm phút, đủ để nó
 * thành một mạch chơi chứ không phải một hiệu ứng thoáng qua.
 */
export const SURVEY_SECONDS = 20;
/** Cạnh một ô sương. 60 chia 10 là lưới 6×6, tức 36 ô. */
export const FOG_CHUNK = 10;

export const STARTING: Record<ResourceKind, number> =
  { food: 40, wood: 40, gold: 120, stone: 20, relics: 0 };

// ------------------------------------------------------------- tài nguyên

export const RESOURCES: Record<ResourceKind, {
  label: string; icon: string; color: number; value: number;
}> = {
  food: { label: 'Lương thực', icon: '🌾', color: 0xe3b23c, value: 1 },
  wood: { label: 'Gỗ', icon: '🪵', color: 0x4e9a55, value: 1 },
  gold: { label: 'Vàng', icon: '🪙', color: 0xffb703, value: 1 },
  stone: { label: 'Đá', icon: '🪨', color: 0x9aa3ad, value: 2 },
  relics: { label: 'Mảnh cổ vật', icon: '🔮', color: 0x9d7bd8, value: 7 },
};

// ------------------------------------------------------------- biến sinh thái

export const BIOMES: Record<BiomeId, Biome> = {
  meadow: {
    id: 'meadow', label: 'Đồng Cỏ Khởi Đầu',
    ground: [0x529342, 0x62aa4e], minimap: '#529342',
    yields: ['wood', 'food'],
  },
  crags: {
    id: 'crags', label: 'Vách Đá Granit',
    ground: [0x7f8c8d, 0x6c7a7b], minimap: '#7f8c8d',
    yields: ['stone'],
  },
  desert: {
    id: 'desert', label: 'Sa Mạc Chìm',
    ground: [0xe9c46a, 0xd9b45c], minimap: '#e9c46a',
    yields: ['gold'],
  },
  highlands: {
    id: 'highlands', label: 'Cao Nguyên Huyền Bí',
    ground: [0x3d348b, 0x342c77], minimap: '#3d348b',
    yields: ['relics'],
  },
};

/**
 * Biến sinh thái tại một điểm. Vùng giữa luôn là đồng cỏ; ngoài ra chia theo trục trội hơn,
 * nên ranh giới là hai đường chéo và bốn vùng toả đều quanh thủ phủ.
 */
export function biomeAt(x: number, z: number): BiomeId {
  if (Math.hypot(x, z) < 13) return 'meadow';
  if (Math.abs(z) >= Math.abs(x)) return z < 0 ? 'highlands' : 'meadow';
  return x < 0 ? 'crags' : 'desert';
}

// ------------------------------------------------------------------ công trình

export const BUILDINGS = {
  townhall: {
    label: 'Thủ phủ', icon: '🏛️', maxLevel: 10,
    describe: (l: number) => `Trung tâm quần đảo · cấp ${l}`,
  },
  house: {
    label: 'Nhà ở', icon: '🏠', maxLevel: 10,
    describe: (l: number) => `Chỗ ở cho ${l * HOUSING_PER_HOUSE} dân`,
  },
  granary: {
    label: 'Kho lẫm', icon: '📦', maxLevel: 10,
    describe: (l: number) => `Chứa thêm ${l * STORAGE_PER_GRANARY} mỗi loại`,
  },
  outpost: {
    label: 'Trạm trung chuyển', icon: '🛖', maxLevel: 5,
    describe: (l: number) =>
      `Gom hàng trong vùng, ${CART_INTERVAL_SECONDS}s một chuyến xe · sức chở ×${CART_CAPACITY_MULT * l}`,
  },
} as const;

/** Giá xây mới. Nâng cấp dùng cùng bảng này nhân theo cấp, xem Economy.costFor. */
export const BUILD_COST: Record<keyof typeof BUILDINGS, Cost> = {
  // Thu phu khong xay moi duoc, nhung NANG CAP thi phai co gia. De { gold: 0 } tu thoi no
  // chi la cho giu cho, hau qua la bam vao thu phu thay dong gia trong va nut NANG CAP bam
  // bao nhieu lan cung duoc - mot nguon cap mien phi giua long game.
  townhall: { gold: 150, wood: 80, stone: 60 },
  house: { gold: 60, wood: 30 },
  granary: { gold: 90, wood: 40, stone: 20 },
  // Tram chi ton go va da thi dau game da xay het tam cai trong bay phut - do duoc. No phai
  // la buoc ngoat hau can giua van, nen doi ca vang va cap can cu.
  outpost: { gold: 300, wood: 150, stone: 100 },
};

/**
 * Giá tăng theo cấp số nhân: mỗi cấp đắt thêm 55%.
 *
 * Đã thử 1,7 để ghìm đà nửa giờ cuối: đo ra 79 lượt mua so với 75, tức gần như không đổi.
 * Đà đó đến từ thu nhập cộng dồn (thêm dân, thêm trạm, thủ phủ bán thừa) chứ không từ giá
 * công trình, nên giữ 1,55 — đắt hơn mà không được gì thì chỉ làm khổ phần giữa.
 */
export const COST_GROWTH = 1.55;

/** Cấp căn cứ tối thiểu để xây từng loại. Trống nghĩa là không chặn. */
export const BUILD_MIN_LEVEL: Partial<Record<keyof typeof BUILDINGS, number>> = {
  outpost: 4,
};

export const HIRE_COST: Cost = { gold: 80, food: 25 };
export const HIRE_GROWTH = 1.25;
export const TRAIN_COST: Cost = { gold: 120 };
export const TRAIN_GROWTH = 1.3;

/**
 * Chỗ đặt công trình. KHÔNG cho đặt tự do: mỗi biến sinh thái có sẵn mấy nền đất, nên bản đồ
 * luôn đọc được và thợ luôn có đường đi hợp lý. Thủ phủ ở gốc, nhà cửa quanh đó, trạm trung
 * chuyển nằm sâu trong từng vùng.
 */
export const PLOTS: { id: string; pos: Vec2; kind: 'core' | 'town' | 'outpost' }[] = [
  { id: 'core', pos: [0, 0], kind: 'core' },
  { id: 't1', pos: [-6, -5], kind: 'town' },
  { id: 't2', pos: [6, -5], kind: 'town' },
  { id: 't3', pos: [-6, 5], kind: 'town' },
  { id: 't4', pos: [6, 5], kind: 'town' },
  { id: 't5', pos: [-11, 0], kind: 'town' },
  { id: 't6', pos: [11, 0], kind: 'town' },
  { id: 'o_crags', pos: [-21, -3], kind: 'outpost' },
  { id: 'o_crags2', pos: [-24, 9], kind: 'outpost' },
  { id: 'o_desert', pos: [21, 3], kind: 'outpost' },
  { id: 'o_desert2', pos: [24, -9], kind: 'outpost' },
  { id: 'o_high', pos: [-4, -22], kind: 'outpost' },
  { id: 'o_high2', pos: [9, -25], kind: 'outpost' },
  { id: 'o_meadow', pos: [3, 22], kind: 'outpost' },
  { id: 'o_meadow2', pos: [-10, 24], kind: 'outpost' },
];

// ------------------------------------------------------------------ màu sắc

export const PALETTE = {
  sky: 0xbfe6f0,
  cliffTop: 0x4a3728,
  cliffMid: 0x3a2b1f,
  cliffLow: 0x2e2118,
  water: 0x48cae4,
  road: 0xc2a878,

  trunk: 0x6b4a32,
  pine: [0x2f6b3a, 0x3d8248, 0x4e9a55],
  wheat: 0xe3b23c,
  berry: 0xc3423f,
  granite: 0x9aa3ad,
  graniteDark: 0x6c7a7b,
  iron: 0xb08968,
  sand: 0xe9c46a,
  palm: 0x52b788,
  cactus: 0x40916c,
  goldOre: 0xffb703,
  moss: 0x3d348b,
  crystal: 0x9d7bd8,

  wall: 0x8d5b4c,
  roofCore: 0xd94e34,
  roofHouse: 0xc96f4a,
  roofGranary: 0x5b8fae,
  roofOutpost: 0xa9763f,
  plotDirt: 0x6f5a3c,
  fence: 0x8d6b4c,

  villager: 0xf2e4cf,
  hat: 0xe0b14f,
  cloud: 0xf4f7fb,
} as const;
