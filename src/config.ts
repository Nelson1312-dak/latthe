/**
 * Số liệu của cả thế giới: kích thước, biến sinh thái, giá cả, nhịp chơi.
 *
 * Thế giới rộng 60×60 nên toạ độ chạy từ -30 tới 30, thủ phủ ở gốc. Bốn biến sinh thái toả
 * ra bốn phía; vùng giữa luôn là đồng cỏ để người chơi có chỗ đứng chân ngay từ đầu.
 */
import type { Biome, BiomeId, BuildingType, Cost, ResourceKind, TroopKind, VoyageBand } from './types';
import type { IconName } from './icons';

// Kich thuoc the gioi khong con y nghia: ban do la vo han, sinh theo khoi trong world.ts.
// Chi giu lai mot con so cho minimap biet ve rong bao nhieu quanh nguoi choi.
export const MINIMAP_SPAN = 220;

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
/*
 * NGƯỠNG BÁN LÀ MỘT CON SỐ CỐ ĐỊNH, KHÔNG PHẢI MỘT TỈ LỆ CỦA SỨC CHỨA.
 *
 * Bản trước lấy 70% sức chứa. Đo một giờ thì thấy hai hậu quả, cả hai đều nặng:
 *
 *   — Kho cứ đứng lì ngay DƯỚI ngưỡng (623 trên 924, tức 67%), nên vòi vàng gần như đóng
 *     suốt ván: cả giờ chỉ kiếm được 1.178 vàng, không đủ thuê tới người thứ tư.
 *   — Xây thêm vựa lại ĐẨY ngưỡng lên, tức là xây kho xong thì nghèo đi. Một công trình mà
 *     hậu quả ngược hẳn với điều người chơi tưởng là luật chơi phản bội người chơi.
 *
 * Số cố định thì vựa quay về đúng việc của nó — chỗ đệm để đi xa lâu hơn mà không tràn —
 * còn mọi thứ chất trên mức dự trữ đều đặn chảy thành vàng.
 *
 * Đây chỉ là SÀN. Mức giữ thật còn phải trùm được món đắt nhất đang bày bán, xem
 * Economy.reserveFor(): để trơ một số cố định thì tới người thứ mười hai — giá 290 lương
 * thực — thủ phủ vẫn bán sạch xuống 150, và người chơi vĩnh viễn không thuê nổi ai nữa.
 */
/**
 * ĐƠN VỊ LƯỚI. Mọi thực thể có mặt bằng đều là bội số nguyên của nó.
 *
 * Nền đất 3×3, thân công trình 2×2, thủ phủ 4×4 nền và 3×3 thân, props 1×1. Trước đây các
 * số này là 2,9 và 2,4 và 1,85 — mỗi cái lệch một ít, nên đặt cạnh nhau thì mái nhà và bệ
 * không bao giờ thẳng hàng, và mắt đọc ra là cẩu thả chứ không ra phong cách. Giữ mọi thứ
 * trên cùng một lưới thì cảnh vật gọn lại mà không phải thêm chi tiết nào.
 *
 * Nền đất vẫn là lục giác: đó là nhận dạng hình ảnh của game, và lưới nói ở đây là lưới
 * KÍCH THƯỚC của vật thể, không phải cách lát mặt đất.
 */
export const GRID = 1;

export const SURPLUS_RESERVE = 150;
/*
 * Số món thủ phủ bán được mỗi giây, mỗi cấp.
 *
 * 1,4 là quá chậm: đo bốn giờ thì chợ chạy hết công suất 87% thời gian mà vẫn để lại 7.027
 * khúc gỗ không tiêu được. Mười một người dân mang về nhiều hơn mức một cái chợ cấp ba nuốt
 * nổi, nên phần thừa chỉ nằm đó — đúng cảm giác "làm mãi mà không ra tiền". 2,2 cho cấp một
 * một cái sàn dùng được, và vì nó nhân theo cấp nên nâng thủ phủ vẫn là nước đi đáng giá
 * nhất giữa ván.
 */
/** Giữ dư hơn món đắt nhất chừng này lần, để còn mua được mà không phải canh từng giây. */
export const RESERVE_HEADROOM = 1.35;
/**
 * Mức giữ cho thứ CHẲNG CÔNG TRÌNH NÀO cần tới — tức pha lê, hàng thuần để bán.
 *
 * Giữ nó ngang với mọi loại khác (150) là khoá cứng 150×7 = hơn một nghìn vàng trong kho
 * mãi mãi, mà chẳng để làm gì: đo được sáu dân đào hai mươi phút ở rừng pha lê xa, mang về
 * 176 mảnh, và thủ phủ chỉ bán đúng 26 mảnh. Đi xa về rồi mà hàng nằm đó thì cái chuyến đi
 * ấy coi như chưa trả công. Giữ một ít cho người chơi còn nhìn thấy mình có, rồi bán hết.
 */
export const EXPORT_KEEP = 25;
export const SURPLUS_RATE_PER_LEVEL = 2.2;
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
 * Người được điều tới một điểm thì đứng lại đó bấy nhiêu giây rồi mới tự đi làm tiếp.
 * Phải dài hơn `SURVEY_SECONDS` một khoảng thoải mái: điều dân đi khám phá mà họ quay đầu
 * trước khi mây kịp tan thì lệnh ấy vô nghĩa.
 */
export const ORDER_HOLD_SECONDS = 45;
/** Người thám hiểm chỉ đi xa thủ phủ tới chừng này, và chân trời nở ra theo số dân. */
export const SCOUT_RANGE_BASE = 80;
export const SCOUT_RANGE_PER_VILLAGER = 22;

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

// ------------------------------------------------------------- bảng màu

/**
 * NĂM HỆ MÀU, KHÔNG HƠN.
 *
 * Bản trước có 31 màu rời nhau — mỗi lần cần một thứ mới lại thêm một hex, và kết quả là
 * cây xanh lá, cỏ xanh khác, xương rồng xanh khác nữa, ba màu không có họ hàng gì với nhau.
 * Nhìn ra là chắp vá chứ không ra một thế giới.
 *
 * Giờ mọi bề mặt đều rút từ năm hệ bù nhau, mỗi hệ ba bậc sáng tối:
 *
 *   XANH RÊU   đồng cỏ, rừng, cây cối
 *   ĐẤT NUNG   sa mạc, đường, gỗ, tường và mái
 *   XÁM LAM    vách đá, đá, nước, trời
 *   TÍM NHẠT   cao nguyên, pha lê
 *   KEM        người dân, mây, điểm sáng
 *
 * Cộng đúng MỘT màu nhấn — vàng — vì vàng là tiền, thứ duy nhất đáng được phép rực lên giữa
 * một bảng màu trầm. Thiếu nó thì quặng vàng chìm nghỉm vào nền sa mạc.
 *
 * Thêm màu mới thì thêm một BẬC của hệ sẵn có, đừng thêm hệ thứ sáu.
 */

/*
 * Mỗi hệ BỐN bậc, và bậc nào dùng cho nền thì vật thể đứng trên nó phải lấy bậc khác.
 *
 * Bốn bậc nghe như thừa cho tới khi thử ba: đồng cỏ và cây thông cùng lấy bậc "tối" thì cả
 * khu rừng chìm nghỉm vào bãi cỏ, nhìn ra một mảng xanh phẳng không đọc được gì. Nền lấy
 * bậc sáng, vật thể đứng trên lấy bậc tối — hoặc ngược lại ở vách đá, nơi nền tối còn tảng
 * đá sáng. Tách bậc chính là thứ giữ cho một bảng màu hẹp vẫn đọc được.
 */
// ---- năm hệ, mỗi hệ bốn bậc ------------------------------------------------
const REU_RAT_TOI = 0x47603f;
const REU_TOI = 0x5f7d5f;
const REU = 0x83a383;
const REU_SANG = 0x9ab393;
const REU_NHAT = 0xa8bfa0;

const DAT_RAT_TOI = 0x6b4a34;
const DAT_TOI = 0x835b40;
const DAT = 0xa9794f;
const DAT_SANG = 0xd3ab7c;

const LAM_TOI = 0x5d6e7a;
const LAM = 0x8599a6;
const LAM_SANG = 0xb6c6d1;

const TIM_RAT_TOI = 0x3f3660;
const TIM = 0x8a7bab;
const TIM_SANG = 0xc3b8da;

const KEM_TOI = 0xe6dac0;
const KEM = 0xeee3cc;
const KEM_SANG = 0xf7f1e4;

/** Màu nhấn duy nhất: vàng. */
const VANG = 0xd9a441;

/**
 * Vị trí camera so với tâm ngắm. Camera chỉ trượt và thu phóng, không bao giờ xoay, nên hướng
 * nhìn là hằng số — những thứ cần quay mặt về phía camera (quầng sáng) tính một lần là xong.
 */
export const CAMERA_OFFSET = [60, 70, 60] as const;
/** Khoảng cách từ camera tới tâm ngắm — hằng số, vì camera chỉ trượt chứ không đổi góc. */
export const CAM_DIST = Math.hypot(...CAMERA_OFFSET);

export const PALETTE = {
  sky: LAM_SANG,
  cliffTop: DAT,
  cliffMid: DAT_TOI,
  cliffLow: DAT_RAT_TOI,
  water: 0x7fa0b5,

  trunk: DAT_RAT_TOI,
  // Cây lấy ba bậc TỐI của hệ rêu, vì nền đồng cỏ đã chiếm hai bậc sáng.
  pine: [REU_RAT_TOI, 0x55714b, REU_TOI],
  wheat: 0xdcc389,
  berry: 0xb5705a,
  granite: LAM,
  graniteDark: LAM_TOI,
  iron: DAT,
  sand: DAT_SANG,
  palm: REU,
  cactus: REU_TOI,
  goldOre: VANG,
  moss: TIM_RAT_TOI,
  crystal: TIM,
  // Anh phat ra tu pha le sang hon chinh khoi pha le, nen no doc ra la phat sang chu khong
  // phai mot khoi tim nhat.
  crystalGlow: TIM_SANG,
  /** Cây tán tròn của đồng cỏ: sáng hơn thông một bậc, để rừng hỗn giao có hai tầng màu. */
  leaf: [REU_TOI, REU, 0x93ae86],
  bush: [REU_RAT_TOI, REU_TOI],
  /** Hoa dại: lấy từ bốn hệ đang có, không thêm hệ thứ sáu. */
  flowers: [0xb5705a, 0xdcc389, KEM_SANG, TIM_SANG],

  wall: KEM_TOI,
  /*
   * MÀU SỐNG NHẤT CỦA CẢ BẢN ĐỒ NẰM Ở ĐÂY, trên bốn cái mái.
   *
   * Trước đây mái lấy đúng bậc màu của nền mà nó đứng lên, nên cả làng chìm vào bãi cỏ —
   * nhìn một khung hình thì thấy một mảng xanh phẳng có vài chấm nâu. Mặt đất là thứ chiếm
   * chín phần mười màn hình nhưng người chơi không bấm vào nó; công trình thì ngược lại.
   * Nên nền lùi về gần trung tính, còn màu thì dồn hết lên mái: bốn hệ, mỗi hệ ở bậc đậm
   * nhất, nên liếc một cái là biết đâu là nhà, đâu là kho, đâu là trạm.
   */
  roofCore: 0xc9603f,
  roofHouse: 0xd08b4e,
  roofGranary: 0x5d8fa6,
  roofOutpost: 0x6c8f5a,
  plotDirt: DAT_TOI,
  fence: DAT,

  villager: KEM_SANG,
  hat: VANG,
  skin: 0xe8c4a0,
  eye: 0x3a2e2a,
  ox: DAT_TOI,
  cloud: KEM,
  /**
   * Màu đất CHƯA VÉN được pha về phía này 72%. Ấm và nhạt như giấy bản đồ chưa vẽ; vẫn giữ
   * một chút màu gốc nên đồng cỏ, vách đá, cao nguyên còn nhận ra được bóng dáng.
   */
  fogLand: 0xe4e1d6,
} as const;

/**
 * Sáu màu cờ cho người chơi chọn. Lấy thẳng từ bốn màu mái đang có cộng tím và vàng, nên dù
 * chọn màu nào thì lá cờ vẫn nằm trong bảng màu của cả thế giới.
 */
export const VILLAGE_COLORS = [
  PALETTE.roofCore, PALETTE.roofHouse, PALETTE.roofGranary,
  PALETTE.roofOutpost, TIM, VANG,
] as const;

/** Hai nửa của một cái tên gợi ý. Ghép lại ra 96 cái tên, đủ để không ai bấm hai lần ra một. */
const TEN_DAU = ['Isle', 'Bay', 'Village', 'Harbour', 'Sandbar', 'Cape', 'Hamlet', 'Beach'] as const;
const TEN_SAU = [
  'White Cloud', 'South Wind', 'Morning Mist', 'Gold Sand', 'Pinewood', 'Standing Stone',
  'New Moon', 'Silver Wave', 'Summer Sun', 'Tall Grass', 'Warm Fire', 'Sparrow',
] as const;

/** Một cái tên làng bốc ngẫu nhiên. */
export function tenLangNgauNhien(): string {
  const a = TEN_DAU[Math.floor(Math.random() * TEN_DAU.length)];
  const b = TEN_SAU[Math.floor(Math.random() * TEN_SAU.length)];
  return `${b} ${a}`;
}

// ------------------------------------------------------------- tài nguyên

export const RESOURCES: Record<ResourceKind, {
  label: string; icon: IconName; color: number; value: number;
}> = {
  food: { label: 'Food', icon: 'food', color: PALETTE.wheat, value: 1 },
  wood: { label: 'Wood', icon: 'wood', color: PALETTE.pine[1], value: 1 },
  gold: { label: 'Gold', icon: 'gold', color: PALETTE.goldOre, value: 1 },
  stone: { label: 'Stone', icon: 'stone', color: PALETTE.granite, value: 2 },
  relics: { label: 'Relics', icon: 'relics', color: PALETTE.crystal, value: 7 },
};

// ------------------------------------------------------------- biến sinh thái


export const BIOMES: Record<BiomeId, Biome> = {
  meadow: {
    id: 'meadow', label: 'Home Meadow',
    // Nền lấy hai bậc SÁNG, cây lấy ba bậc tối — nên rừng nổi hẳn trên cỏ. Và nhạt hơn
    // chính hệ rêu một chút nữa, để màu còn chỗ cho mái nhà.
    ground: [REU_SANG, REU_NHAT], minimap: '#9ab393',
    yields: ['wood', 'food'],
  },
  crags: {
    id: 'crags', label: 'Granite Crags',
    // Vách đá ngược lại: nền tối, tảng đá sáng. Sáng hơn hệ lam một nửa bậc: với AO phủ lên
    // thì hai bậc tối nhất gần như thành đen, và cả vùng vách đá đọc ra như một lỗ thủng.
    ground: [0x728391, 0x63747f], minimap: '#63747f',
    yields: ['stone'],
  },
  desert: {
    id: 'desert', label: 'Sunken Desert',
    ground: [0xcfa877, 0xbe9868], minimap: '#cfa877',
    yields: ['gold'],
  },
  highlands: {
    id: 'highlands', label: 'Mystic Highlands',
    // Cũng sáng lên nửa bậc vì cùng lý do; pha lê vẫn nổi nhờ tự phát sáng.
    ground: [0x4a4070, 0x5b4f80], minimap: '#4a4070',
    yields: ['relics'],
  },
  swamp: {
    id: 'swamp', label: 'Reed Swamp',
    // Xanh ô-liu ngả nâu: đủ khác đồng cỏ để nhìn minimap là biết, mà vẫn cùng họ rêu.
    ground: [0x7c8f5a, 0x66794c], minimap: '#5f7d58',
    yields: ['wood', 'food'],
  },
  snow: {
    id: 'snow', label: 'Snow Peaks',
    // Không trắng hẳn: trắng tinh qua bloom là cháy thành một mảng, mất hết các mặt thềm.
    ground: [0xd3dde4, 0xb9c8d4], minimap: '#dbe5ec',
    yields: ['stone'],
  },
  ashland: {
    id: 'ashland', label: 'Ashlands',
    // Tro than ấm chứ không đen: đen thì AO nuốt mất hình khối, và dung nham cần một cái
    // nền tối để nổi chứ không cần một cái hố.
    ground: [0x5a5150, 0x4a4342], minimap: '#4d4544',
    yields: ['gold'],
  },
};

/** Hai sắc của mặt vũng, trộn theo cùng phép nhiễu với nền đất. */
export const POOL_COLORS = {
  water: [0x4f9296, 0x3a7786],
  lava: [0xff8f2e, 0xe9521f],
} as const;

/*
 * Màu cây đá RIÊNG của ba vùng biến thể. Cây đá trong bãi vẫn là đúng những cây đá ấy, đúng
 * chỗ ấy — chỉ nhuộm lại: thông phủ tuyết, đá bazan, sậy đầm. Không thêm hình mới nào.
 */
export const BIOME_TINT = {
  swamp: {
    pine: [0x3f5a3c, 0x4b6a41, 0x577548], leaf: [0x6c8440, 0x7f9650, 0x5b7a3e],
    reed: 0x8fa85a, lotus: 0xd58aa8, rock: [0x6d7d62, 0x5a6b55], bush: 0x4a6238, tuft: 0x55803f,
  },
  snow: {
    pine: [0xdfe9ee, 0xb9cfd6, 0x8fb0b3], rock: [0xd5e1e8, 0xb3c4d0], iron: 0x8fa3b5,
  },
  ashland: {
    pine: 0x35302e, rock: [0x4c4543, 0x3d3836], iron: 0x7a3b2c, wheat: 0xb8a25e, ember: 0xffcf6a,
  },
} as const;

// ------------------------------------------------------------------ hạ tầng

/*
 * NĂM CÔNG TRÌNH HẠ TẦNG.
 *
 * Trước bản này mọi công trình đều thuộc một trong hai việc: chứa (nhà, kho) hoặc đánh
 * (chòi, trại). Không có cái nào làm cho CÁI LÀNG chạy khác đi, nên xây cái thứ năm cũng
 * giống hệt xây cái thứ nhất. Mỗi công trình dưới đây đổi đúng một con số mà người chơi
 * đã nhìn thấy sẵn trên màn hình — lương thực, tốc độ dân, sức bán của chợ, vùng sương đã
 * vén, giờ đi biển — để xây xong là thấy ngay nó làm gì.
 */

/** Ruộng lúa: lương thực mỗi giây cho mỗi cấp. */
export const FARM_FOOD_PER_LEVEL = 0.2;
/** Giếng làng: dân đi nhanh thêm bấy nhiêu mỗi cấp, cộng dồn mọi giếng, có trần. */
export const WELL_SPEED_PER_LEVEL = 0.04;
export const WELL_SPEED_CAP = 0.32;
/** Chợ phiên: bán thêm bấy nhiêu món mỗi giây, và mỗi món được thêm giá. */
export const MARKET_RATE_PER_LEVEL = 0.8;
export const MARKET_PRICE_PER_LEVEL = 0.02;
export const MARKET_PRICE_CAP = 0.2;
/** Đài quan sát: tự vén sương trong bán kính này, không cần ai đứng đó. */
export const LOOKOUT_RANGE_BASE = 20;
export const LOOKOUT_RANGE_PER_LEVEL = 10;
/** Xưởng thuyền: chuyến biển về sớm hơn bấy nhiêu mỗi cấp, có trần. */
export const DOCK_VOYAGE_PER_LEVEL = 0.12;
export const DOCK_VOYAGE_CAP = 0.6;

/*
 * MỖI LOẠI HẠ TẦNG CHỈ ĐƯỢC BẤY NHIÊU CÁI.
 *
 * Không có trần thì bản mô phỏng dựng mười một ruộng lúa và mười cái giếng: lúa thừa chảy
 * hết ra chợ (vàng bốn tiếng nhảy từ 128 nghìn lên 244 nghìn), còn cấp căn cứ — tổng cấp
 * mọi công trình chia ba — phồng từ 54 lên 114 và kéo sức giặc lên theo. Giếng thứ ba vốn
 * đã vô dụng vì phần cộng tốc độ có trần; trần số lượng chỉ nói thẳng điều đó ra, để người
 * chơi khỏi trả tiền cho một cái giếng không làm gì.
 */
export const BUILD_LIMIT: Partial<Record<BuildingType, number>> = {
  farm: 4, well: 2, market: 2, lookout: 4, dock: 1,
};

// ------------------------------------------------------------------ công trình

export const BUILDINGS = {
  /*
   * Mô tả PHẢI nói ra việc thủ phủ làm, vì nó là cái chợ — nơi duy nhất hàng hoá biến thành
   * vàng, và vàng thì mua mọi thứ còn lại. Dòng cũ chỉ ghi "Trung tâm quần đảo · cấp 3", tức
   * không một chữ nào về tác dụng, trong khi nhà ở và kho lẫm đều nói rõ. Hậu quả đo được:
   * sau bốn giờ thủ phủ vẫn ở cấp 3, chợ chạy hết công suất 87% thời gian, và 7.027 khúc gỗ
   * nằm chết trong kho. Nâng cấp quan trọng nhất của game lại là cái duy nhất không ai hiểu.
   */
  townhall: {
    label: 'Town Hall', icon: 'townhall', maxLevel: 10,
    describe: (l: number) => `Sells ${(SURPLUS_RATE_PER_LEVEL * l).toFixed(1)} goods/s`
      + ` · houses ${l * HOUSING_FROM_TOWNHALL}`,
  },
  house: {
    label: 'House', icon: 'house', maxLevel: 10,
    describe: (l: number) => `Houses ${l * HOUSING_PER_HOUSE}`,
  },
  granary: {
    label: 'Granary', icon: 'granary', maxLevel: 10,
    describe: (l: number) => `+${l * STORAGE_PER_GRANARY} storage per resource`,
  },
  outpost: {
    label: 'Outpost', icon: 'outpost', maxLevel: 5,
    describe: (l: number) =>
      `Collects nearby goods · cart every ${CART_INTERVAL_SECONDS}s · load ×${CART_CAPACITY_MULT * l}`,
  },
  watchtower: {
    label: 'Watchtower', icon: 'tower', maxLevel: 5,
    describe: (l: number) => `Defence +${l * GUARD_PER_TOWER}`,
  },
  barracks: {
    label: 'Barracks', icon: 'spear', maxLevel: 8,
    describe: (l: number) => `Holds ${l * 3} spearmen`,
  },
  archery: {
    label: 'Archery Range', icon: 'bow', maxLevel: 8,
    describe: (l: number) => `Holds ${l * 3} archers`,
  },
  stable: {
    label: 'Stable', icon: 'horse', maxLevel: 6,
    describe: (l: number) => `Holds ${l * 2} cavalry`,
  },
  smithy: {
    label: 'Smithy', icon: 'anvil', maxLevel: 3,
    describe: () => 'Attack and armour upgrades for all troops',
  },
  farm: {
    label: 'Farm', icon: 'farm', maxLevel: 5,
    describe: (l: number) => `Grows ${(FARM_FOOD_PER_LEVEL * l).toFixed(1)} food/s`,
  },
  well: {
    label: 'Well', icon: 'well', maxLevel: 5,
    describe: (l: number) => `Villagers move ${Math.round(WELL_SPEED_PER_LEVEL * l * 100)}% faster`,
  },
  market: {
    label: 'Market', icon: 'market', maxLevel: 5,
    describe: (l: number) => `Sells ${(MARKET_RATE_PER_LEVEL * l).toFixed(1)} more goods/s`
      + ` · prices +${Math.round(MARKET_PRICE_PER_LEVEL * l * 100)}%`,
  },
  lookout: {
    label: 'Lookout', icon: 'lookout', maxLevel: 5,
    describe: (l: number) =>
      `Clears fog within ${LOOKOUT_RANGE_BASE + LOOKOUT_RANGE_PER_LEVEL * l} steps`,
  },
  dock: {
    label: 'Dock', icon: 'dock', maxLevel: 5,
    describe: (l: number) => `Voyages return ${
      Math.round(Math.min(DOCK_VOYAGE_CAP, DOCK_VOYAGE_PER_LEVEL * l) * 100)}% faster`,
  },
} as const;

/**
 * Ba nhóm của bảng xây. Mười ba loại xếp thành một cột thì dài hơn cả màn hình điện thoại
 * — đo được ở 375×812 — nên chia theo VIỆC người chơi đang muốn làm, không theo thời đại.
 */
export const BUILD_GROUPS = [
  { id: 'dan', label: 'Village', types: ['house', 'farm', 'well', 'granary'] },
  { id: 'kinhte', label: 'Economy', types: ['market', 'outpost', 'dock', 'lookout'] },
  { id: 'quan', label: 'Military', types: ['watchtower', 'barracks', 'archery', 'stable', 'smithy'] },
] as const;

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
  // KHONG doi da. Da chi dao duoc tu phut 13 (do bang npm run pace) con dot bao dau tien
  // ap toi o phut 7 — doi da la bat nguoi choi thua dot dau ma khong co cach nao khac.
  watchtower: { gold: 110, wood: 70 },
  // Ba trại quân đắt dần theo thứ tự mở ra; lò rèn rẻ hơn vì nó không nuôi ai, chỉ bán
  // nâng cấp, và bắt trả tiền hai lần cho cùng một thứ thì chẳng ai xây nó.
  barracks: { gold: 220, wood: 150, stone: 60 },
  archery: { gold: 320, wood: 240, stone: 90 },
  stable: { gold: 600, wood: 320, stone: 180 },
  smithy: { gold: 260, wood: 120, stone: 160 },
  // Hạ tầng. Ruộng và giếng KHÔNG đòi đá, cùng lý do với chòi canh: đá chỉ đào được từ
  // phút 13, mà hai thứ này là để mở đầu ván.
  farm: { gold: 50, wood: 60 },
  well: { gold: 80, wood: 40 },
  market: { gold: 200, wood: 120, stone: 40 },
  lookout: { gold: 120, wood: 140 },
  dock: { gold: 400, wood: 300, stone: 80 },
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

// ------------------------------------------------------------------ mùa bão

/*
 * MÙA BÃO: thứ duy nhất trong game có thể LẤY ĐI của người chơi.
 *
 * Trước khi có nó, chạy `npm run pace` bốn tiếng thì từ phút 60 tới phút 240 quãng đi xa
 * đứng im ở 233, dân đứng im ở 10, gỗ nằm chạm trần, và thứ duy nhất nhúc nhích là con số
 * vàng bò từ 12.646 lên 83.926. Ba tiếng không có một quyết định nào.
 *
 * Nên mỗi vài phút có một đợt ập tới. Bão đánh sập cấp công trình, cướp khuân hàng trong
 * kho. Chống lại bằng SỨC THỦ, mà sức thủ đến từ ba nguồn cố tình đặt lệch nhau: thủ phủ
 * (có sẵn, yếu) và chòi canh (xây bằng vàng). Khi hai thứ đó vẫn chưa đủ thì còn một đòn
 * bẩy cuối: THUÊ LÍNH trong ba mươi giây báo động, trả bằng vàng, chỉ ăn cho đúng đợt ấy.
 *
 * Đã thử một luật khác: gọi dân về giữ nhà. Nó đẹp — cả làng chạy về lúc trời tối sầm — mà
 * đo ra thì hỏng, vì ba mươi giây cả làng đứng không, cứ bốn phút một lần, cắt mất một nửa
 * kinh tế giờ đầu (vàng phút 30: 2.333 nếu không gọi, 1.499 nếu gọi). Và nó đòi người chơi
 * phải đang nhìn màn hình, thứ mà một game nhàn rỗi trên điện thoại không được đòi. Thuê
 * lính thì một cú bấm, không mất một giây công nào, và tiêu đúng vào đống vàng vốn nằm chết.
 */

/** Đợt đầu tiên. Đủ muộn để người chơi đã có kho hàng đáng mất và đã kịp xây một chòi. */
export const WAVE_FIRST_SECONDS = 600;
export const WAVE_EVERY_SECONDS = 240;
/** Khoảng báo động trước khi đợt nổ ra: trời tối lại, đồng hồ đỏ, nút gọi dân hiện ra. */
export const WAVE_WARN_SECONDS = 30;

export const GUARD_PER_TOWNHALL = 6;
export const GUARD_PER_TOWER = 12;
/**
 * Mỗi người dân ĐANG Ở NHÀ cũng là một phần sức thủ.
 *
 * Trước đây sức thủ chỉ đến từ công trình, nên dân số — thứ người chơi dồn hết tâm sức vào
 * — không liên quan gì tới chuyện giữ làng. Cho dân góp vào thì có hai cái được: dân số
 * thành một trục phòng thủ thật, và chuyến đi biển có một cái giá KHÔNG trả bằng tiền được.
 */
export const GUARD_PER_VILLAGER = 1;

/**
 * VÀNH CĂN CỨ: xa tới đâu thì còn xây được.
 *
 * Không có nó thì "căn cứ" chỉ là mấy cái nhà rải rác, và chẳng có gì để mà thủ. Vành lớn
 * dần theo cấp thủ phủ, nên nâng thủ phủ vừa mở thêm chợ vừa mở thêm đất.
 *
 * TRẠM TRUNG CHUYỂN KHÔNG BỊ VÀNH NÀY CHẶN. Việc của nó là gom hàng ở những bãi xa — bắt
 * nó đứng trong làng là xoá sổ chính cái công trình đó.
 */
/**
 * DIỆN TÍCH CHIẾM ĐẤT của từng loại công trình, tính bằng bán kính.
 *
 * Không có ô lưới nào: đặt được ở đâu đất đủ bằng mà không đè lên cái khác là đặt, đúng
 * kiểu đế chế. Bản trước mười bốn loại nằm gọn trong khoảng 1,4 tới 2,6 — cái giếng và
 * thủ phủ chênh nhau chưa tới hai lần bề ngang, nên "diện tích" có trên giấy mà không ai
 * cảm thấy. Giờ trải ra 1,4 tới 3,6: giếng và chòi len vào khe nào cũng được, còn ruộng,
 * chuồng ngựa, doanh trại phải có một khoảng đất bằng thật sự — và chính luật đất bằng
 * (world.ts, `siteOf`) làm cho con số này thành một lựa chọn chứ không phải một nhãn.
 */
export const FOOTPRINT: Record<keyof typeof BUILDINGS, number> = {
  well: 1.4,
  watchtower: 1.5,
  lookout: 1.5,
  house: 1.8,
  smithy: 2.0,
  granary: 2.4,
  outpost: 2.5,
  archery: 2.7,
  market: 2.8,
  dock: 3.0,
  barracks: 3.1,
  stable: 3.2,
  farm: 3.3,
  townhall: 3.6,
};

/**
 * Mô hình to lên theo diện tích.
 *
 * Diện tích rộng ra mà mô hình giữ nguyên thì công trình lớn chỉ là một căn nhà cỡ thường
 * đứng giữa một bãi đất trống. Hệ số nhân thẳng vào hình khối (kể cả mô đất dưới chân), nên
 * mô đất luôn vừa khít vòng diện tích trừ một khe nhỏ. Nhà ở, giếng, chòi giữ nguyên cỡ:
 * chúng là thước đo để mắt so ra thứ khác to tới đâu.
 */
export const MODEL_SCALE: Record<keyof typeof BUILDINGS, number> = {
  well: 1,
  watchtower: 1,
  lookout: 1,
  house: 1,
  smithy: 1,
  granary: 1.15,
  outpost: 1.1,
  archery: 1.15,
  market: 1.2,
  dock: 1.15,
  barracks: 1.25,
  stable: 1.2,
  farm: 1.35,
  townhall: 1.3,
};

export const BASE_RADIUS = 17;
export const BASE_RADIUS_PER_LEVEL = 2.4;

/**
 * Giá một điểm sức thủ thuê thêm, tính theo sức của chính đợt đang tới.
 *
 * Phải đắt dần theo đợt, nếu không thì cuối ván — lúc trong kho có hơn trăm nghìn vàng —
 * một cú bấm là xoá sổ mùa bão. Ở đợt đầu khoảng 25 vàng một điểm, tới đợt cuối gần 300.
 */
export const MERC_BASE = 6;
export const MERC_PER_POWER = 0.9;

/**
 * Sức của một đợt.
 *
 * Phần lớn bám theo CẤP CĂN CỨ chứ không theo thời gian, để người chơi chậm không bị nghiền
 * nát còn người chơi nhanh không thoát ly khỏi mối hoạ. Phần theo số đợt chỉ là một con dốc
 * thoải, đủ để chòi canh cấp 5 không phải là điểm dừng vĩnh viễn.
 */
export const WAVE_BASE = 10;
export const WAVE_PER_LEVEL = 3.6;
export const WAVE_PER_WAVE = 1.8;
/*
 * TRẦN CỦA PHẦN TĂNG THEO SỐ ĐỢT, tính theo chính sức vóc của căn cứ.
 *
 * Số đợt vẫn chạy trong lúc người chơi vắng mặt, còn căn cứ thì không lớn lên được. Một
 * bản lưu thật trên latbai.vn: đợt thứ 272, căn cứ vẫn một cái thủ phủ cấp 1 — đợt tới
 * mạnh 503 trong khi sức thủ là 8. Không có đường nào thắng, và cũng không có đường nào
 * gỡ, vì mỗi đợt thua lại lấy thêm của.
 *
 * Trong lối chơi bình thường phần theo đợt chưa bao giờ vượt 0,7 lần phần theo cấp (đo
 * bằng bản mô phỏng bốn tiếng), nên cái trần này không chạm vào đường cong đã cân — nó
 * chỉ chặn đúng cái trường hợp căn cứ đứng yên mà đồng hồ vẫn chạy.
 */
export const WAVE_RATCHET = 1.5;

// ------------------------------------------------------------------ màu sắc




// ------------------------------------------------------------------ thời đại

/**
 * BỐN THỜI ĐẠI.
 *
 * Mỗi thời mở thêm công trình và thêm một loại lính, nhưng cũng làm GIẶC MẠNH LÊN và cho
 * chúng thêm một loại quân mới. Nếu lên thời đại chỉ toàn cái được thì nó là một nút bấm
 * cho không, và người chơi sẽ bấm mà không cân nhắc một giây nào.
 *
 * Chuyển thời đại mất thời gian chứ không xong ngay: đó phải là một sự kiện trong ván chơi,
 * và là một khoảng người chơi biết mình đang hở sườn.
 */
export interface AgeSpec {
  label: string;
  /**
   * Cấp căn cứ tối thiểu — con số "Cấp" trên thanh trên, không phải cấp riêng của thủ phủ.
   *
   * Lúc đầu dùng cấp của chính toà thủ phủ, và đo ra bản mô phỏng kẹt ở thời đại một suốt
   * bốn tiếng: nó nâng cấp công trình thấp nhất trước, mà nó lại xây nhà mới liên tục nên
   * thủ phủ không bao giờ được nâng. Cấp căn cứ thì người chơi nhìn thấy ngay trên đầu màn,
   * và không phụ thuộc vào thứ tự nâng cấp của ai cả.
   */
  level: number;
  /** Công trình bắt buộc phải có trước khi lên. */
  need: BuildingType | null;
  cost: Cost;
  seconds: number;
  /** Một dòng nói thời đại này mở ra cái gì. */
  opens: string;
}

export const AGES: readonly AgeSpec[] = [
  { label: 'Settler Age', level: 1, need: null, cost: {}, seconds: 0,
    opens: 'House, farm, well, granary, watchtower' },
  { label: 'Frontier Age', level: 4, need: null, cost: { food: 400, wood: 300 }, seconds: 90,
    opens: 'Barracks, smithy, market and lookout' },
  { label: 'Fortress Age', level: 9, need: 'barracks',
    cost: { food: 1200, gold: 900, stone: 400 }, seconds: 150,
    opens: 'Archery range and dock' },
  { label: 'Seafaring Age', level: 16, need: 'smithy',
    cost: { food: 2000, gold: 3000, stone: 700, relics: 20 }, seconds: 240,
    opens: 'Stable, cavalry and tier-two smithing' },
];

/** Thời đại tối thiểu để xây từng loại. Thiếu nghĩa là có từ đầu. */
export const BUILD_MIN_AGE: Partial<Record<BuildingType, number>> = {
  barracks: 2, smithy: 2, archery: 3, stable: 4,
  market: 2, lookout: 2, dock: 3,
};

// ------------------------------------------------------------------ quân đội

/**
 * BA LOẠI LÍNH KHẮC NHAU — cái tam giác của Age of Empires.
 *
 * Nó tồn tại để bắt người chơi NHÌN xem giặc đang tới bằng gì, chứ không chỉ đếm xem mình
 * có bao nhiêu quân. Vì thế bảng đợt phải nói rõ thành phần ngay từ lúc báo động; giấu đi
 * thì luật khắc chế thành một trò may rủi, và may rủi thì không ai học được.
 */
export interface TroopSpec {
  label: string;
  icon: IconName;
  /** Công trình huấn luyện ra nó. */
  from: BuildingType;
  hp: number;
  /** Sát thương mỗi giây. */
  dps: number;
  speed: number;
  /** Tầm đánh. Bộ binh đánh giáp lá cà, cung thủ bắn xa. */
  range: number;
  cost: Cost;
  seconds: number;
  /** Lương ăn mỗi giây. */
  upkeep: number;
  /** Mỗi cấp công trình nuôi được bấy nhiêu người. */
  perLevel: number;
}

export const TROOPS: Record<TroopKind, TroopSpec> = {
  spear: {
    label: 'Spearmen', icon: 'spear', from: 'barracks',
    hp: 34, dps: 7, speed: 2.7, range: 1.4,
    cost: { food: 40, wood: 20 }, seconds: 12, upkeep: 0.028, perLevel: 3,
  },
  archer: {
    label: 'Archers', icon: 'bow', from: 'archery',
    hp: 20, dps: 6, speed: 2.5, range: 9, cost: { food: 30, wood: 45 },
    seconds: 16, upkeep: 0.034, perLevel: 3,
  },
  horse: {
    label: 'Cavalry', icon: 'horse', from: 'stable',
    hp: 58, dps: 10, speed: 4.4, range: 1.6, cost: { food: 80, gold: 60 },
    seconds: 24, upkeep: 0.058, perLevel: 2,
  },
};

/**
 * Hệ số sát thương của hàng ĐÁNH lên hàng BỊ ĐÁNH. Vòng tròn khắc chế:
 * giáo chống kỵ binh, cung bắn bộ binh, kỵ binh chém cung thủ.
 */
export const KHAC: Record<TroopKind, Record<TroopKind, number>> = {
  spear: { spear: 1, archer: 0.6, horse: 2.0 },
  archer: { spear: 1.8, archer: 1, horse: 0.6 },
  horse: { spear: 0.55, archer: 2.0, horse: 1 },
};

/** Lò rèn: mỗi bậc cộng bấy nhiêu phần trăm sát thương, và giảm bấy nhiêu phần sát thương nhận. */
export const SMITH_ATTACK = 0.18;
export const SMITH_ARMOUR = 0.14;
export const SMITH_MAX_AGE2 = 1;
export const SMITH_MAX_AGE4 = 2;
export const SMITH_COST: Cost = { gold: 400, stone: 200 };
export const SMITH_GROWTH = 2.4;

/** Hết lương thì lính bỏ đi — cứ bấy nhiêu giây mất một người. */
export const DESERT_SECONDS = 12;

// ------------------------------------------------------------------ đi biển

/**
 * CHUYẾN ĐI BIỂN: chỗ duy nhất trong game dám hứa một món lời mà không chắc có.
 *
 * Đo bằng một bản thước tạm (đếm xem mỗi giây người chơi có bao nhiêu nút bấm được):
 * MƯỜI PHÚT ĐẦU người chơi không làm được gì trong 99% thời gian — bảy giây có việc trên
 * sáu trăm giây ngồi nhìn. Nửa giờ đầu là 87%, đoạn chết dài nhất 190 giây liền. Mùa bão
 * không vá được chỗ ấy: bốn phút nó mới tới một lần, và tới thì tự nó giải quyết lấy.
 *
 * Cái thiếu là một việc LÚC NÀO CŨNG LÀM ĐƯỢC mà vẫn đáng phải cân nhắc. Nên giá của
 * chuyến đi cố tình KHÔNG phải vàng — mười phút đầu vàng là thứ không có. Giá là NGƯỜI:
 * đi biển là rút tay khỏi bãi, và rút người khỏi làng đúng lúc giặc sắp tới. Lương thực
 * chỉ là phần lương mang theo, cố ý rẻ, vì lương thực là thứ duy nhất lúc nào cũng chạm
 * trần rồi chảy thành vàng — tiêu nó đi gần như không mất gì.
 *
 * Ba tầm xa cố tình lệch hẳn nhau chứ không phải một thang trượt: gần thì chắc ăn và buồn
 * tẻ, xa thì có thể về tay không, và tầm cuối có thể MẤT MỘT NGƯỜI. Người chơi phải tự
 * chọn mức sợ của mình, và cái nhãn nói thẳng ra điều đó trước khi họ bấm.
 */
export interface VoyageSpec {
  id: VoyageBand;
  label: string;
  /** Một dòng nói thẳng cái giá và cái hoạ. Người chơi đọc đúng dòng này rồi mới bấm. */
  blurb: string;
  icon: IconName;
  crew: number;
  seconds: number;
  food: number;
  gold: readonly [number, number];
  relics: readonly [number, number];
  /** Xác suất về tay không. */
  empty: number;
  /** Xác suất một người không về. */
  lost: number;
}

export const VOYAGES: readonly VoyageSpec[] = [
  {
    id: 'coast', label: 'Coast', blurb: 'Always pays',
    icon: 'boot', crew: 1, seconds: 60, food: 18,
    gold: [70, 120], relics: [0, 1], empty: 0, lost: 0,
  },
  {
    id: 'reef', label: 'Reef', blurb: '1 in 5 comes back empty',
    icon: 'compass', crew: 2, seconds: 210, food: 70,
    gold: [360, 620], relics: [4, 9], empty: 0.2, lost: 0,
  },
  {
    id: 'deep', label: 'Deep sea', blurb: 'May lose a crew member',
    icon: 'relics', crew: 3, seconds: 420, food: 160,
    gold: [1500, 2600], relics: [22, 40], empty: 0.24, lost: 0.12,
  },
] as const;

/** Tên hòn đảo đoàn vừa ghé. Thuần kể chuyện — nhưng thiếu nó thì mọi chuyến giống hệt nhau. */
export const VOYAGE_PLACES = [
  'Squid Rock', 'Fishbone Shoal', 'Seven Sisters', 'Wreck Cove', 'Lost Bird Bar',
  'Tidal Cape', 'Broken Reef', 'Nameless Isle', 'Old Lantern Bay', 'Lonely Anchorage',
] as const;

// ------------------------------------------------------------------ thú dữ

/*
 * THÚ DỮ SỐNG TRÊN BẢN ĐỒ.
 *
 * Trước bản này mối nguy duy nhất là đợt giặc: nó tới theo đồng hồ, đánh ở cổng làng, và
 * phần bản đồ còn lại chỉ là một cái kho đợi người tới lấy. Hang thú đặt một cái giá lên
 * chính việc ĐI XA: bãi nằm gần hang cho ít hàng hơn cho tới khi có người mang quân tới dẹp,
 * và dẹp xong thì được một món. Nó cũng là việc đầu tiên trong game mà quân đội làm ngoài
 * lúc có báo động.
 */
export type BeastKind = 'wolf' | 'boar' | 'bear' | 'panther' | 'croc' | 'polar' | 'salamander';

export interface BeastSpec {
  /** Tên bầy thú. */
  label: string;
  /** Tên cái hang. */
  den: string;
  color: number;
  /** Cỡ thân so với một con sói. */
  size: number;
  /** Số con lượn quanh hang ở cấp một. */
  pack: number;
  /** Kéo dãn thân [ngang, cao, dài]. Loài bò sát là con sói bị ép dẹt và kéo dài. */
  shape?: readonly [number, number, number];
}

export const BEASTS: Record<BeastKind, BeastSpec> = {
  wolf: { label: 'Wolves', den: 'Wolf den', color: 0x8d96a3, size: 0.95, pack: 4 },
  boar: { label: 'Boars', den: 'Boar wallow', color: 0x80604a, size: 1.05, pack: 3 },
  bear: { label: 'Bears', den: 'Bear cave', color: 0x54423a, size: 1.5, pack: 2 },
  panther: { label: 'Sand cats', den: 'Sand cat lair', color: 0xd2a55e, size: 1.1, pack: 3 },
  croc: { label: 'Crocodiles', den: 'Crocodile pool', color: 0x5d7a45, size: 1.15, pack: 3, shape: [1.35, 0.55, 1.6] },
  polar: { label: 'Snow bears', den: 'Snow bear cave', color: 0xe8eef2, size: 1.55, pack: 2 },
  salamander: { label: 'Fire lizards', den: 'Fire lizard nest', color: 0xe8552c, size: 1.0, pack: 4, shape: [1.2, 0.6, 1.5] },
};

/** Mỗi vùng đất nuôi một loài. Kiểu `Record<BiomeId, …>` để thêm vùng mới mà quên loài là lỗi biên dịch. */
export const BEAST_BY_BIOME: Record<BiomeId, BeastKind> = {
  meadow: 'wolf', crags: 'bear', desert: 'panther', highlands: 'boar',
  swamp: 'croc', snow: 'polar', ashland: 'salamander',
};

/** Trong bán kính này quanh thủ phủ không bao giờ có hang: ván mới không mở đầu bằng một bầy sói. */
export const DEN_MIN_DIST = 50;
/** Xác suất một khối đất có hang. */
export const DEN_CHANCE = 0.3;
/** Bãi nằm trong tầm này của một hang còn sống thì bị quấy. */
export const DEN_FEAR = 18;
/** Phần hàng còn lại mỗi chuyến ở bãi bị quấy. */
export const DEN_YIELD = 0.6;
export const DEN_POWER = 5;
export const DEN_MAX_LEVEL = 6;
/** Mỗi người lính đáng bấy nhiêu điểm khi đi săn. */
export const HUNT_POWER: Record<TroopKind, number> = { spear: 2, archer: 2, horse: 4 };
/** Vừa đủ sức thì ngã ngần này phần quân; đông gấp đôi thì ngã một nửa số ấy. */
export const HUNT_LOSS = 0.45;
