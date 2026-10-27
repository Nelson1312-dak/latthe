/**
 * Số liệu của cả thế giới: kích thước, biến sinh thái, giá cả, nhịp chơi.
 *
 * Thế giới rộng 60×60 nên toạ độ chạy từ -30 tới 30, thủ phủ ở gốc. Bốn biến sinh thái toả
 * ra bốn phía; vùng giữa luôn là đồng cỏ để người chơi có chỗ đứng chân ngay từ đầu.
 */
import type { Biome, BiomeId, Cost, ResourceKind } from './types';
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

const LAM_RAT_TOI = 0x4a5a66;
const LAM_TOI = 0x5d6e7a;
const LAM = 0x8599a6;
const LAM_SANG = 0xb6c6d1;

const TIM_RAT_TOI = 0x3f3660;
const TIM_TOI = 0x55497a;
const TIM = 0x8a7bab;
const TIM_SANG = 0xc3b8da;

const KEM_TOI = 0xe6dac0;
const KEM = 0xeee3cc;
const KEM_SANG = 0xf7f1e4;

/** Màu nhấn duy nhất: vàng. */
const VANG = 0xd9a441;

export const PALETTE = {
  sky: LAM_SANG,
  cliffTop: DAT,
  cliffMid: DAT_TOI,
  cliffLow: DAT_RAT_TOI,
  water: 0x7fa0b5,
  // Đậm hơn cát sa mạc (0xcfa877) hẳn một bậc, nếu không thì đường xuyên qua sa mạc biến
  // mất — hai thứ cùng là đất nên rất dễ trùng tông.
  road: 0xb08a5e,

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
  cloud: KEM,
} as const;

// ------------------------------------------------------------- tài nguyên

export const RESOURCES: Record<ResourceKind, {
  label: string; icon: IconName; color: number; value: number;
}> = {
  food: { label: 'Lương thực', icon: 'food', color: PALETTE.wheat, value: 1 },
  wood: { label: 'Gỗ', icon: 'wood', color: PALETTE.pine[1], value: 1 },
  gold: { label: 'Vàng', icon: 'gold', color: PALETTE.goldOre, value: 1 },
  stone: { label: 'Đá', icon: 'stone', color: PALETTE.granite, value: 2 },
  relics: { label: 'Mảnh cổ vật', icon: 'relics', color: PALETTE.crystal, value: 7 },
};

// ------------------------------------------------------------- biến sinh thái


export const BIOMES: Record<BiomeId, Biome> = {
  meadow: {
    id: 'meadow', label: 'Đồng Cỏ Khởi Đầu',
    // Nền lấy hai bậc SÁNG, cây lấy ba bậc tối — nên rừng nổi hẳn trên cỏ. Và nhạt hơn
    // chính hệ rêu một chút nữa, để màu còn chỗ cho mái nhà.
    ground: [REU_SANG, REU_NHAT], minimap: '#9ab393',
    yields: ['wood', 'food'],
  },
  crags: {
    id: 'crags', label: 'Vách Đá Granit',
    // Vách đá ngược lại: nền tối, tảng đá sáng.
    ground: [LAM_TOI, LAM_RAT_TOI], minimap: '#5d6e7a',
    yields: ['stone'],
  },
  desert: {
    id: 'desert', label: 'Sa Mạc Chìm',
    ground: [0xcfa877, 0xbe9868], minimap: '#cfa877',
    yields: ['gold'],
  },
  highlands: {
    id: 'highlands', label: 'Cao Nguyên Huyền Bí',
    ground: [TIM_RAT_TOI, TIM_TOI], minimap: '#3f3660',
    yields: ['relics'],
  },
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
    label: 'Thủ phủ', icon: 'townhall', maxLevel: 10,
    describe: (l: number) => `Chợ bán ${(SURPLUS_RATE_PER_LEVEL * l).toFixed(1)} món mỗi giây`
      + ` · chỗ ở cho ${l * HOUSING_FROM_TOWNHALL} dân`,
  },
  house: {
    label: 'Nhà ở', icon: 'house', maxLevel: 10,
    describe: (l: number) => `Chỗ ở cho ${l * HOUSING_PER_HOUSE} dân`,
  },
  granary: {
    label: 'Kho lẫm', icon: 'granary', maxLevel: 10,
    describe: (l: number) => `Chứa thêm ${l * STORAGE_PER_GRANARY} mỗi loại`,
  },
  outpost: {
    label: 'Trạm trung chuyển', icon: 'outpost', maxLevel: 5,
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

// ------------------------------------------------------------------ màu sắc


