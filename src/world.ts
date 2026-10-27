/**
 * Thế giới vô hạn: mọi thứ ở một toạ độ đều SINH RA ĐƯỢC từ chính toạ độ đó.
 *
 * Không lưu bản đồ. Biến sinh thái, địa hình, bãi tài nguyên, nền đất, đường — tất cả đều là
 * hàm thuần của toạ độ qua một hàm băm có hạt giống. Bản lưu chỉ nhớ những gì người chơi ĐÃ
 * LÀM. Nếu địa hình phải lưu thì chơi càng lâu bản lưu càng phình, và sớm muộn cũng vỡ.
 */
import type { BiomeId, Patch, ResourceKind, Vec3 } from './types';

export const SEED = 0x1a7ba1;

/**
 * Cạnh một khối. To hơn bản trước (20 → 30) vì giờ mỗi khối chứa trọn một BÃI tài nguyên có
 * vùng đất riêng, không còn là mấy cái cây rải rác — bãi cần chỗ để đọc ra là một khu.
 */
export const CHUNK = 30;

/**
 * Bước của lưới ô lục giác, TÍNH THEO TOÀN THẾ GIỚI chứ không theo từng khối.
 *
 * Đây là chỗ đã sai lặng lẽ từ đầu: mỗi khối tự dựng lưới riêng bắt đầu từ góc của nó, mà
 * 30 không chia hết cho 3,6 — nên ở mỗi đường nối giữa hai khối có hai cột ô cách nhau 1,2
 * thay vì 3,6, tức là chúng ĐÈ LÊN NHAU. Nhìn kỹ thì thấy một vệt ô chen chúc chạy dọc mọi
 * ranh giới khối. Đánh số ô theo toạ độ thế giới thì lưới liền một mạch, và khối chỉ còn
 * là cái khung để biết nạp những ô nào.
 */
export const HEX_R = 2.4;
export const HEX_STEP_X = HEX_R * 1.5;
export const HEX_STEP_Z = HEX_R * Math.sqrt(3);
/** Bán kính nạp quanh tâm ngắm, tính bằng khối. 5 nghĩa là lưới 11×11 = 330×330 đơn vị. */
export const LOAD_RADIUS = 5;
export const KEEP_RADIUS = 6;

export function hash2(x: number, z: number, salt = 0): number {
  let h = (x | 0) * 374761393 + (z | 0) * 668265263 + salt * 1442695040 + SEED;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function chunkRng(cx: number, cz: number, salt = 0): () => number {
  let a = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ Math.imul(salt + 1, 83492791) ^ SEED) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const chunkKey = (cx: number, cz: number): string => `${cx},${cz}`;
export const chunkOf = (v: number): number => Math.floor(v / CHUNK);

/**
 * Biến sinh thái. Quanh thủ phủ luôn là đồng cỏ; ra ngoài chia thành vùng 90×90, mỗi vùng
 * bốc thăm một biến — nên đi hướng nào cũng gặp đủ bốn loại mà không đều đặn như bàn cờ.
 */
export function biomeAt(x: number, z: number): BiomeId {
  if (Math.hypot(x, z) < 26) return 'meadow';
  const pick = hash2(Math.floor(x / 90), Math.floor(z / 90), 7);
  if (pick < 0.34) return 'meadow';
  if (pick < 0.56) return 'crags';
  if (pick < 0.78) return 'desert';
  return 'highlands';
}

/**
 * Hệ số giàu theo khoảng cách. Đây là thứ làm "vô hạn" có nghĩa: không có nó, đi xa chỉ tốn
 * thời gian đi lại và người chơi sẽ bám quanh nhà mãi mãi.
 */
export function richnessAt(x: number, z: number): number {
  return 1 + Math.log2(1 + Math.hypot(x, z) / 60);
}

export function heightAt(x: number, z: number, biome: BiomeId): number {
  let h = (Math.sin(x * 0.09) + Math.cos(z * 0.075)) * 0.35;
  if (biome === 'crags') h += Math.abs(Math.sin(x * 0.18 + z * 0.14)) * 2.1;
  else if (biome === 'desert') h += Math.sin(x * 0.055 + z * 0.045) * 1.1;
  else if (biome === 'highlands') h += Math.cos(x * 0.12) * 0.6 + 0.3;
  return h;
}

/**
 * Lưới đường thưa, một trục mỗi CHUNK. Vô hạn mà không phải lưu gì.
 *
 * Hàm này chỉ dùng để GẠT những thứ khác ra khỏi lòng đường — nền đất, cây cối. Còn việc ô
 * nào được tô màu đường thì do MapManager quyết, bằng một phép khác hẳn: mỗi cột ô chọn
 * đúng một ô gần trục nhất. Hai phép khác nhau là có chủ ý — cái này rộng rãi một chút để
 * cây cối không mọc sát mép đường, cái kia phải chặt chẽ để con đường rộng đúng một ô.
 */
export const ROAD_HALF = 2.6;

/**
 * Khoảng cách giữa hai con đường.
 *
 * Một đường mỗi khối nghe hợp lý cho tới khi đếm: khối rộng 30 mà một ô lục giác rộng 4,16,
 * nên khối chỉ có bảy ô ngang. Lát đường rộng một ô theo cả hai trục thì 39% mặt đất là
 * đường — không còn là đường nữa mà là một cái sân. Cách hai khối thì còn chừng 9%, đủ để
 * ra một mạng đường mà vẫn là đường.
 */
export const ROAD_SPACING = CHUNK * 2;

/**
 * Gần một trục đường tới mức không nên đặt gì ở đó.
 *
 * Chỉ dùng để GẠT những thứ khác ra khỏi lòng đường — nền đất, cây cối. Còn ô nào được tô
 * màu đường thì xem hexIsRoad(): hai phép khác nhau là có chủ ý, cái này rộng rãi một chút
 * để cây không mọc sát mép, cái kia chặt chẽ để đường rộng đúng một ô.
 */
export function onRoad(x: number, z: number): boolean {
  const near = (v: number) => Math.abs(v - Math.round(v / ROAD_SPACING) * ROAD_SPACING) < ROAD_HALF;
  return near(x) || near(z);
}

/**
 * Ô lục giác ở (x, z) có phải một ô ĐƯỜNG không.
 *
 * Mỗi trục đường chỉ lấy ĐÚNG MỘT hàng ô. Lấy theo kiểu "cách trục dưới ngưỡng X" thì sai,
 * vì ô xếp so le: cột chẵn có một ô nằm đúng trên trục, cột lẻ có hai ô cách trục nửa bước
 * về hai phía. Ngưỡng nào với tới được cột lẻ cũng sẽ ôm cả hai ô của nó, nên đường chạy
 * 1 ô rồi 2 ô rồi 1 ô và đọc ra như vệt loang. So trong một cửa sổ nửa mở — một đầu mở,
 * một đầu đóng — thì hai ô cách đều vẫn chỉ chọn được một.
 */
export function hexIsRoad(x: number, z: number): boolean {
  const trong = (v: number, buoc: number) => {
    const d = v - Math.round(v / ROAD_SPACING) * ROAD_SPACING;
    return d > -buoc / 2 && d <= buoc / 2;
  };
  return trong(x, HEX_STEP_X) || trong(z, HEX_STEP_Z);
}

// ---------------------------------------------------------------- bãi

/** Mỗi loại tài nguyên một kiểu bãi, với tên gọi và cỡ riêng. */
const PATCH_SPEC: Record<ResourceKind, { label: string; radius: number; spots: number; base: number }> = {
  wood: { label: 'Rừng', radius: 5.6, spots: 6, base: 1 },
  food: { label: 'Ruộng', radius: 5.2, spots: 5, base: 1 },
  stone: { label: 'Mỏ đá', radius: 4.8, spots: 5, base: 0.9 },
  gold: { label: 'Bãi vàng', radius: 4.4, spots: 4, base: 0.5 },
  // Pha lê sản lượng thấp nhưng mỗi mảnh đáng bảy lần một khúc gỗ. Số cũ là 0,3 và đo ra
  // thì đó là một cái bẫy: rừng pha lê cách nhà 122 đơn vị có hệ số giàu 0,78 — THẤP HƠN
  // rừng gỗ ngay cạnh nhà (1,40) — nên ai đi xa lấy pha lê đều kiếm ít hơn người ở nhà.
  // Cả bốn giờ chơi không một mảnh nào vào kho. 0,55 đặt nó cao hơn hàng gần chừng 1,3 lần
  // sau khi trừ quãng đi: đủ để đi là đáng, chưa đủ để thành lựa chọn duy nhất.
  relics: { label: 'Rừng pha lê', radius: 4.8, spots: 4, base: 0.55 },
};

export function patchLabel(kind: ResourceKind): string {
  return PATCH_SPEC[kind].label;
}

/**
 * Mỗi biến sinh thái có một loại CHỦ ĐẠO và hai loại phụ.
 *
 * Khoá cứng mỗi biến một loại nghe gọn, nhưng đo ra thì hỏng: vàng chỉ có ở sa mạc, mà vùng
 * sa mạc gần nhất có thể nằm cách nhà hai trăm đơn vị — nên suốt giờ đầu cả làng đi bộ lấy
 * vàng và nền kinh tế đứng im. Cho mỗi vùng vài loại phụ thì quanh nhà lúc nào cũng có cái
 * để làm, trong khi pha lê vẫn chỉ mọc ở cao nguyên nên đi xa vẫn còn lý do.
 */
const BIOME_MIX: Record<BiomeId, [ResourceKind, number][]> = {
  meadow: [['wood', 0.45], ['food', 0.85], ['stone', 1]],
  crags: [['stone', 0.5], ['gold', 0.75], ['wood', 1]],
  desert: [['gold', 0.45], ['stone', 0.7], ['food', 1]],
  // Cao nguyên là nơi DUY NHẤT có pha lê, nên phần của nó phải đủ lớn: với 0,4 thì cả vùng
  // nạp chỉ có 5 rừng pha lê so với 63 rừng gỗ, và cái gần nhất nằm cách nhà 122 đơn vị.
  highlands: [['relics', 0.6], ['wood', 0.8], ['stone', 1]],
};

function kindFor(biome: BiomeId, roll: number): ResourceKind {
  for (const [kind, nguong] of BIOME_MIX[biome]) if (roll < nguong) return kind;
  return 'wood';
}

function makePatch(
  cx: number, cz: number, k: number, x: number, z: number, r: () => number,
): Patch {
  const biome = biomeAt(x, z);
  const kind = kindFor(biome, r());
  const spec = PATCH_SPEC[kind];
  const spots: Vec3[] = [];
  for (let i = 0; i < spec.spots; i += 1) {
    const a = (i / spec.spots) * Math.PI * 2 + r() * 0.5;
    const d = spec.radius * (0.45 + r() * 0.3);
    spots.push([x + Math.cos(a) * d, 0, z + Math.sin(a) * d]);
  }
  return {
    id: `b_${cx}_${cz}_${k}`,
    kind,
    label: spec.label,
    center: [x, 0, z],
    radius: spec.radius,
    spots,
    biome,
    richness: spec.base * richnessAt(x, z),
  };
}

/**
 * Các bãi của một khối: không, một, hoặc hai.
 *
 * Một bãi mỗi khối đọc rất rõ nhưng đo ra là quá thưa — 106 bãi trong vùng nạp, chia cho
 * năm loại thì bãi đúng loại đang cần nằm cách cả trăm đơn vị, và cả làng tiêu hết giờ vào
 * việc đi bộ. Hai bãi, đặt cách nhau đủ xa để không dính vào nhau, giữ được cái rõ ràng mà
 * vẫn đủ dày để quanh nhà lúc nào cũng có việc.
 */
export function patchesOf(cx: number, cz: number): Patch[] {
  const r = chunkRng(cx, cz, 3);
  const out: Patch[] = [];
  const dem = r() < 0.12 ? 0 : r() < 0.5 ? 1 : 2;

  const ox = cx * CHUNK;
  const oz = cz * CHUNK;
  /*
   * Hai bãi thì đặt vào HAI NỬA đối nhau của khối, chứ không bốc ngẫu nhiên rồi loại cái
   * nào chồng lên nhau. Cách bốc-rồi-loại đo ra chỉ còn 125 bãi thay vì 160: trong một khối
   * rộng 30, hai điểm ngẫu nhiên gần như luôn đứng gần nhau hơn tổng hai bán kính, nên bãi
   * thứ hai hầu như không bao giờ sống sót. Chia nửa thì nó luôn sống, và luôn tách bạch.
   */
  const doc = r() < 0.5;
  const nua = CHUNK / 2;
  for (let k = 0; k < dem; k += 1) {
    const off = dem === 1 ? nua / 2 + r() * nua : k * nua;
    const lech = 6 + r() * (nua - 12);
    // Tâm bãi nằm đúng trên lưới một đơn vị, như mọi thực thể khác.
    const x = Math.round(ox + (doc ? off + lech : 6 + r() * (CHUNK - 12)));
    const z = Math.round(oz + (doc ? 6 + r() * (CHUNK - 12) : off + lech));
    if (Math.hypot(x, z) < 16) continue;             // chừa quảng trường thủ phủ
    out.push(makePatch(cx, cz, k, x, z, r));
  }
  return out;
}
