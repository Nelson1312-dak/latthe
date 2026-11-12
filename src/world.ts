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
  return pickBiome(Math.floor(x / 90), Math.floor(z / 90));
}

/**
 * Biến sinh thái của MỘT Ô LƯỚI 90×90 — phép bốc DUY NHẤT, dùng chung cho `biomeAt` và cho
 * phép hoà cao độ. Hai bản sao của cùng một phép bốc là hai chỗ để lệch nhau.
 *
 * Bốc hai lần: lần đầu ra vùng gốc đúng như trước nay (muối 7 — không được đổi, bãi tài
 * nguyên của mọi bản lưu đứng trên nó), lần hai (muối 71) quyết vùng ấy có hoá biến thể hay
 * không. Bốn ô quanh thủ phủ không bao giờ hoá: làng của người chơi cũ không tự dưng ngập.
 */
function pickBiome(ci: number, cj: number): BiomeId {
  const pick = hash2(ci, cj, 7);
  const goc: BiomeId = pick < 0.34 ? 'meadow' : pick < 0.56 ? 'crags' : pick < 0.78 ? 'desert' : 'highlands';
  if (ci >= -1 && ci <= 0 && cj >= -1 && cj <= 0) return goc;
  const v = hash2(ci, cj, 71);
  if (goc === 'meadow') return v < 0.45 ? 'swamp' : goc;
  if (goc === 'crags') return v < 0.5 ? 'snow' : goc;
  if (goc === 'desert') return v < 0.45 ? 'ashland' : goc;
  return goc;
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
  // Đầm lầy: trũng và bẹt, gợn sóng ngắn — phần dưới mực nước thành vũng (xem POOL_Y).
  else if (biome === 'swamp') h = h * 0.4 - 0.75 + Math.sin(x * 0.21 + z * 0.17) * 0.45;
  // Đỉnh tuyết: sống núi chạy chéo NGƯỢC chiều vách đá, nên hai vùng nằm cạnh nhau không
  // nối thành một dãy.
  else if (biome === 'snow') h += Math.abs(Math.sin(x * 0.13 - z * 0.11)) * 2.0 + 0.2;
  // Đất núi lửa: cồn thoải bị khoét những rãnh sâu — đáy rãnh là dung nham.
  else if (biome === 'ashland') h += Math.sin(x * 0.07 + z * 0.05) * 0.7 - Math.abs(Math.cos(x * 0.16 - z * 0.12)) * 0.8;
  return h;
}

/*
 * BẢN ĐỒ KHÔNG CÒN ĐƯỜNG.
 *
 * Trước bản này có một lưới đường thẳng tắp, sáu chục đơn vị một trục, chạy vô hạn theo hai
 * chiều và cắt nhau đúng ở thủ phủ. Nó không làm gì cho cuộc chơi — dân không đi theo nó,
 * không ai nhanh hơn trên nó — mà chỉ CẤM: cấm xây, cấm cây mọc. Và một cái lưới kẻ thước
 * trên một hòn đảo thì đọc ra là máy sinh chứ không phải người đi mà thành.
 *
 * Còn lại đúng một con số và một phép thử, giữ vì DỮ LIỆU CŨ chứ không vì hình: hang thú và
 * các nền đất sinh sẵn (mã của chúng nằm trong bản lưu) đã né các trục ấy từ lúc sinh ra,
 * nên bỏ phép né đi là chúng xê chỗ. Không thứ gì người chơi nhìn thấy còn dùng tới hai thứ này.
 */
export const LANE_SPACING = CHUNK * 2;

/** Điểm này từng nằm trong lòng một trục đường cũ. CHỈ để dữ liệu sinh sẵn đứng yên chỗ cũ. */
export function oldAxis(x: number, z: number): boolean {
  const near = (v: number) => Math.abs(v - Math.round(v / LANE_SPACING) * LANE_SPACING) < 2.6;
  return near(x) || near(z);
}

/**
 * Nhiễu giá trị trơn: nội suy song tuyến giữa các nút lưới cỡ `cell`, mỗi nút một số băm.
 * Dùng cho màu mặt đất — những mảng sáng tối lớn dần dần, thay cho kiểu ca-rô hai màu.
 */
export function valueNoise(x: number, z: number, cell: number, salt: number): number {
  const gx = x / cell;
  const gz = z / cell;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, salt);
  const b = hash2(ix + 1, iz, salt);
  const c = hash2(ix, iz + 1, salt);
  const d = hash2(ix + 1, iz + 1, salt);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

// ---------------------------------------------------------------- cao độ

/**
 * MỌI THỨ ĐỨNG TRÊN MẶT ĐẤT LẤY CAO ĐỘ TỪ ĐÂY.
 *
 * Trước đây cây, đá, nền đất, nhà và dân làng đều đặt ở y = 0, trong khi mặt đất lượn ±0,7
 * ở đồng cỏ và lên tới +2,8 ở vách đá. Cây nổi lơ lửng hoặc lún, và một mỏ đá ở vách đá có
 * mặt đất cao 2,02 trong khi đá đặt ở 0,3–0,7 — chìm hẳn trong cột đất, bấm được mà không
 * thấy gì. Không ai phát hiện vì không có gì báo lỗi: chỉ có hình là sai.
 *
 * Mặt trên mỗi ô lục giác là PHẲNG, nên cao độ tại một điểm chính là cao độ mặt trên của ô
 * chứa điểm đó. Ô thì có hai loại: ô tự nhiên (naturalTop) và ô đã bị san phẳng quanh một
 * nền đất hay trong lòng một bãi — phần san phẳng do MapManager quyết vì nó cần biết các
 * khối lân cận.
 */

/** Tâm ô lục giác chứa điểm (x, z). Lưới lục giác chính quy nên tâm gần nhất là ô chứa. */
export function hexCenterAt(x: number, z: number): [number, number] {
  const ic = Math.round(x / HEX_STEP_X);
  let bx = 0;
  let bz = 0;
  let bd = Infinity;
  for (let i = ic - 1; i <= ic + 1; i += 1) {
    const hx = i * HEX_STEP_X;
    const lech = (((i % 2) + 2) % 2) ? HEX_STEP_Z / 2 : 0;
    const hz = Math.round((z - lech) / HEX_STEP_Z) * HEX_STEP_Z + lech;
    const d = (hx - x) * (hx - x) + (hz - z) * (hz - z);
    if (d < bd) { bd = d; bx = hx; bz = hz; }
  }
  return [bx, bz];
}

/**
 * Ô lục giác dưới dạng MỘT CẶP SỐ NGUYÊN.
 *
 * Từ bản "đặt tự do", công trình không còn gắn vào nền đất sinh sẵn nữa mà đứng trên một ô
 * lục giác. Ô là đơn vị tự nhiên của thế giới này: mặt ô vốn đã phẳng, nên công trình đứng
 * lên không phải san nền — tức không đụng một dòng nào của `MapManager.layoutOf`, nơi thứ
 * tự rút số ngẫu nhiên bị khoá vì bản lưu người chơi.
 *
 * Phép làm tròn ở đây PHẢI y hệt `hexCenterAt`, nên nó gọi thẳng hàm ấy thay vì tự tính
 * lại: hai hàm lục giác lệch nhau nửa ô là một lỗi chỉ lộ ra ở mối nối, rất khó tìm.
 */
export function cellOf(x: number, z: number): [number, number] {
  const [hx, hz] = hexCenterAt(x, z);
  const i = Math.round(hx / HEX_STEP_X);
  const lech = (((i % 2) + 2) % 2) ? HEX_STEP_Z / 2 : 0;
  return [i, Math.round((hz - lech) / HEX_STEP_Z)];
}

/** Tâm thật của ô (i, j). Cột lẻ lệch xuống nửa bước, đúng như lưới của hexCenterAt. */
export function cellCenter(i: number, j: number): [number, number] {
  const lech = (((i % 2) + 2) % 2) ? HEX_STEP_Z / 2 : 0;
  return [i * HEX_STEP_X, j * HEX_STEP_Z + lech];
}

export const cellKey = (i: number, j: number): string => `${i},${j}`;



// ------------------------------------------------- mặt đất liền mạch

/*
 * MẶT ĐẤT KHÔNG CÒN LÁT BẰNG Ô.
 *
 * Trước đây mỗi ô lục giác là một khối riêng, mặt trên phẳng, và cao độ của nó là một con
 * số. Giờ mặt đất là một tấm lưới tam giác liền — nên cao độ phải là một HÀM LIÊN TỤC, và
 * hàm ấy phải trả về đúng cái mặt phẳng tam giác mà lưới vẽ ra, không xê một li: cây cối,
 * người dân, công trình, mũi tên đều đứng theo nó.
 *
 * Ba điều học được lúc thiết kế, ghi lại vì không nhìn công thức mà thấy:
 *
 *   1. CHẤT TẠO HÌNH KHÔNG ĐẾN TỪ ĐỊA HÌNH. `heightAt` quá thoải: ở đồng cỏ, sa mạc và cao
 *      nguyên, hai mặt cạnh nhau cách 3 đơn vị chỉ lệch nhau dưới hai độ — mắt không đọc ra,
 *      và kết quả là một tấm vải gợn sóng chứ không phải low-poly. Cái làm nên những mảng
 *      bắt sáng của bản cũ là cú nhiễu `hash2` mỗi ô trong `naturalTop` và vành vát quanh
 *      mặt ô. Nên ở đây phải CỐ Ý nhiễu lại, khoá theo đỉnh lưới.
 *
 *   2. PHẢI HOÀ CAO ĐỘ GIỮA CÁC BIẾN SINH THÁI. `heightAt` đổi cứng theo biến, mà `biomeAt`
 *      lại đổi cứng trên lưới 90×90 — để nguyên thì mặt đất RÁCH một đường thẳng tắp ở mọi
 *      ranh giới. Và đừng quên cái đĩa bán kính 26 quanh gốc: nó cắt ngang lưới 90, quên nó
 *      là có một vành vách đứng quây đúng quanh thủ phủ.
 *
 *   3. CHỈ HOÀ CAO ĐỘ, KHÔNG HOÀ `biomeAt`. Biến sinh thái quyết loại bãi tài nguyên, loại
 *      cây, `Building.biome` nằm trong bản lưu, và màu minimap. Làm mượt nó là đổi luật chơi.
 */

/** Bước lưới. Chia hết cho 30 (khối) và 60 (trục đường) nên đường luôn rơi đúng hàng đỉnh. */
export const GRID_STEP = 3;
/** Cạnh một ô biến sinh thái — phải khớp với phép chia trong biomeAt. */
const BIOME_CELL = 90;
/** Bề rộng dải hoà giữa hai biến sinh thái. */
const BLEND_BAND = 12;
/**
 * Biên độ nhiễu theo đỉnh lưới: thứ giữ cho mặt đất còn là những mảng phẳng bắt sáng.
 *
 * Bản đầu để 0,35 và nhìn ảnh thử thì mặt đất là một tấm vải phẳng lì — đúng cái mà bản kế
 * hoạch đã đoán trước. Lý do: hai mặt cạnh nhau chỉ lệch chừng bảy độ, mà qua tone mapping
 * và lớp màu ấm thì bảy độ không ra nổi một bậc sáng. Phải mạnh gấp đôi.
 */
const FACET = 0.7;
const FACET_CRAGS = 1.1;
/**
 * Đồi thoai thoải tầm trung. `heightAt` có bước sóng 70–88 đơn vị, mà khung nhìn lúc chơi
 * chỉ rộng chừng 80 — tức người chơi luôn đứng giữa một sườn dốc thoải và không thấy hình
 * thù gì. Một lớp nhiễu 21 đơn vị cho bảy mặt mỗi quả đồi: đủ để có bóng, đủ để đọc ra là
 * đất gợn chứ không phải sàn nhà.
 */
const ROLL_CELL = 21;
const ROLL_AMP = 0.85;
/**
 * Bậc cao độ trên toàn bản đồ.
 *
 * Đây là đường lui đã viết sẵn trong kế hoạch, và nó đã phải dùng tới. Lát bằng ô lục giác
 * thì mỗi ô là một mặt PHẲNG có vách đứng lộ ra ở chỗ chênh — cái đọc ra là "mặt phẳng xếp
 * bậc". Lưới liền không có vách đứng, nên phải lấy lại cái phẳng: ghim cao độ vào bậc 0,2
 * thì mỗi mảng vài ô liền nhau bằng phẳng rồi gãy một nhịp sang mảng bên.
 */
const STEP_Y = 0.2;
/** Bậc thềm ở vách đá. Năm thềm trên biên độ 2,1. */
const CRAG_STEP = 0.45;

/**
 * Biên trên và dưới của cao độ. Dùng để kẹp tia lúc bấm chọn — tia bắt đầu từ dưới lòng đất
 * thì phép dò trả về rác mà không báo gì.
 */
export const GROUND_MAX = 4.4;
export const GROUND_MIN = -2.8;

/**
 * Mực nước đầm và mực dung nham. Là bội của STEP_Y, nên mọi đỉnh bị dâng lên đều rơi đúng
 * một cao độ và mặt vũng phẳng tuyệt đối — lệch một bậc là mặt nước có nếp gấp.
 */
const POOL_Y = -1.0;

const muot = (t: number): number => t * t * (3 - 2 * t);

/**
 * Dốc bị ÉP: lưới biến sinh thái rộng 90 nên nội suy thẳng cho một dải chuyển rộng 90 đơn
 * vị, tức biến sinh thái mất hẳn phần ruột. Ép lại còn BLEND_BAND quanh đúng ranh giới.
 */
function epDoc(f: number): number {
  return muot(Math.min(1, Math.max(0, (f - 0.5) * (BIOME_CELL / BLEND_BAND) + 0.5)));
}

/**
 * Trọng số của từng biến sinh thái tại một điểm — tổng bằng 1.
 *
 * MỘT nguồn duy nhất cho cả cao độ lẫn màu: nếu màu hoà theo một phép còn đất hoà theo một
 * phép khác thì ở mọi ranh giới sẽ có một dải mà màu đã đổi còn đất thì chưa, và mắt đọc
 * ra ngay là sai.
 */
export function biomeWeights(x: number, z: number): [BiomeId, number][] {
  // Lệch nửa ô: điểm nằm GIỮA hai tâm ô, nên ranh giới rơi đúng vào f = 0,5.
  const gx = x / BIOME_CELL - 0.5;
  const gz = z / BIOME_CELL - 0.5;
  const ci = Math.floor(gx);
  const cj = Math.floor(gz);
  const u = epDoc(gx - ci);
  const v = epDoc(gz - cj);
  const w = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v];
  const o = [[0, 0], [1, 0], [0, 1], [1, 1]] as const;

  // Đĩa đồng cỏ quanh gốc cắt ngang lưới 90, nên nó là một trọng số riêng chồng lên trên.
  const r = Math.hypot(x, z);
  const dia = 1 - muot(Math.min(1, Math.max(0, (r - (26 - BLEND_BAND / 2)) / BLEND_BAND)));

  const out: [BiomeId, number][] = [];
  if (dia > 1e-6) out.push(['meadow', dia]);
  for (let k = 0; k < 4; k += 1) {
    const g = w[k] * (1 - dia);
    if (g < 1e-6) continue;
    out.push([pickBiome(ci + o[k][0], cj + o[k][1]), g]);
  }
  return out;
}

/** Cao độ đã hoà giữa các biến sinh thái, kèm trọng số vách đá để biết chỗ nào cần thềm. */
export function heightBlended(x: number, z: number): { h: number; crags: number; dam: number; lua: number } {
  let h = 0;
  let crags = 0;
  let dam = 0;
  let lua = 0;
  for (const [b, w] of biomeWeights(x, z)) {
    h += w * heightAt(x, z, b);
    // Đỉnh tuyết cũng xếp thềm như vách đá: nó là vách đá phủ tuyết.
    if (b === 'crags' || b === 'snow') crags += w;
    else if (b === 'swamp') dam += w;
    else if (b === 'ashland') lua += w;
  }
  return { h, crags, dam, lua };
}


/**
 * Cao độ tại MỘT ĐỈNH LƯỚI. Đây là nơi duy nhất sinh ra con số; `groundAt` chỉ nội suy
 * giữa ba đỉnh, nên hình vẽ ra và cao độ tra được không bao giờ lệch nhau.
 */
export function nodeHeight(i: number, j: number): number {
  return nodeCalc(i, j);
}

/**
 * Đỉnh này ngập tới đâu: 0 là khô, dương là NƯỚC đầm, âm là DUNG NHAM; độ lớn 0–1 theo độ
 * sâu. Mặt đất dùng nó để tô màu, trang trí dùng nó để biết chỗ nào mọc sậy, chỗ nào bốc lửa.
 */
export function nodePool(i: number, j: number): number {
  nodeCalc(i, j);
  return uot;
}

/** Kênh phụ của nodeCalc — độ ngập của đỉnh vừa tính. */
let uot = 0;
/** Kênh phụ thứ hai: đỉnh vừa tính chìm dưới SÔNG hay BIỂN tới đâu, 0–1. */
let sau = 0;

// ------------------------------------------------- sông và biển

/*
 * SÔNG VÀ BIỂN LÀ MỘT TRƯỜNG NHIỄU RIÊNG, phủ lên trên mọi biến sinh thái.
 *
 * Không thêm biến sinh thái "biển": `biomeAt` quyết loại bãi tài nguyên và nằm trong bản lưu
 * (`Building.biome`), đổi nó là đổi luật chơi của mọi làng đã có. Nước chỉ là một lớp phủ:
 * chỗ nào trường này dương thì mặt đất bị KÉO XUỐNG đúng mực nước và tô màu nước — cùng mẹo
 * với vũng đầm ở trên, nên dân vẫn lội qua được, bóng vẫn đổ lên, sương vẫn phủ.
 *
 * Hai lớp nhiễu, hai muối MỚI (101, 103, 107) — không đụng chuỗi ngẫu nhiên nào đã có:
 *   · BIỂN: phần đỉnh của một lớp nhiễu rất rộng. Ra những vùng nước lớn, bờ lượn.
 *   · SÔNG: đường đồng mức 0,5 của một lớp nhiễu khác. Đường đồng mức của nhiễu trơn là
 *     những đường cong dài không đứt, tự uốn khúc — đúng dáng một con sông, mà không phải
 *     dò dòng chảy gì cả.
 *
 * Quanh thủ phủ luôn KHÔ: trong bán kính 48 không có nước, tới 66 mới ngập hẳn. Vành căn cứ
 * lớn nhất chưa tới 45, nên không căn nhà nào trong làng của bản lưu cũ bị nước tràn vào.
 */
/** Mực nước sông biển. Bội của STEP_Y, thấp hơn mực đầm một bậc. */
export const SEA_Y = -1.2;
const DRY_IN = 48;
const DRY_OUT = 66;
const SEA_CELL = 190;
const SEA_AT = 0.69;
const SEA_BAND = 0.05;
const RIVER_CELL = 130;
const RIVER_IN = 0.02;
const RIVER_OUT = 0.042;

/**
 * Độ sâu thô của nước tại một điểm: 0 là đất khô, 0–1 là bờ thoải, trên 1 là nước sâu dần.
 * Hàm thuần của toạ độ, rẻ (ba phép nhiễu) — dùng được ở mọi nơi mà không phải tính cao độ.
 */
export function waterDepth(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= DRY_IN) return 0;
  const bien = (valueNoise(x, z, SEA_CELL, 101) - SEA_AT) / SEA_BAND;
  // Một chút nhiễu nhỏ cho bờ sông bớt trơn như ống nước.
  const n = valueNoise(x, z, RIVER_CELL, 103) + (valueNoise(x, z, 34, 107) - 0.5) * 0.05;
  const song = (RIVER_OUT - Math.abs(n - 0.5)) / (RIVER_OUT - RIVER_IN);
  const d = Math.max(bien, song);
  if (d <= 0) return 0;
  return d * muot(Math.min(1, (r - DRY_IN) / (DRY_OUT - DRY_IN)));
}

/** Chỗ này ngập tới đâu, 0–1: 0 là khô, 1 là mặt nước phẳng. */
export function waterAt(x: number, z: number): number {
  const d = waterDepth(x, z);
  return d <= 0 ? 0 : d >= 1 ? 1 : muot(d);
}

function nodeCalc(i: number, j: number): number {
  const x = i * GRID_STEP;
  const z = j * GRID_STEP;
  const { h: nen, crags, dam, lua } = heightBlended(x, z);
  const h = nen + (valueNoise(x, z, ROLL_CELL, 41) - 0.5) * 2 * ROLL_AMP;
  // Thềm ở vách đá, mạnh dần theo trọng số vách đá: một thềm cứng đâm vào đồng cỏ đã hoà
  // thì đọc ra như lỗi, nên nó phải tan dần đúng ở chỗ hai biến sinh thái gặp nhau.
  const bac = Math.round(h / CRAG_STEP) * CRAG_STEP;
  let y = h * (1 - crags) + bac * crags;
  y += (hash2(i, j, 23) - 0.5) * (FACET + (FACET_CRAGS - FACET) * crags);
  // Ghim vào bậc: mặt đất là những thềm thấp, không phải một tấm vải gợn sóng.
  const y0 = Math.round(y / STEP_Y) * STEP_Y;
  /*
   * VŨNG. Không dựng một mặt nước riêng: đỉnh nào nằm dưới mực thì DÂNG lên đúng mực, thế là
   * cả đáy trũng thành một mặt phẳng, và mặt đất tô nó màu nước. Một mặt nước rời sẽ phải
   * biết bờ ở đâu, phải xếp lớp với sương, với đường, với bóng — còn cách này thì vũng chỉ
   * là đất, mọi thứ đang chạy trên đất đều chạy trên nó: dân đi qua, bóng đổ lên, sương phủ.
   *
   * Độ dâng tan dần theo trọng số vùng, nên ở ranh giới vũng cạn dần chứ không dựng vách.
   */
  uot = 0;
  let y1 = y0;
  const vung = dam + lua;
  if (vung >= 0.15 && y0 < POOL_Y) {
    const m = muot(Math.min(1, (vung - 0.15) / 0.35));
    uot = Math.min(1, (POOL_Y - y0) / 0.5) * m * (lua > dam ? -1 : 1);
    y1 = y0 + (POOL_Y - y0) * m;
  }
  /*
   * SÔNG BIỂN. Đất bị kéo về đúng mực nước theo độ ngập: ngập hẳn thì trả về CHÍNH hằng số
   * (không qua phép cộng trừ nào) để mặt nước phẳng tuyệt đối, còn bờ thì thoải dần. Ở vách
   * đá bờ ấy thành một cái hẻm sâu — con sông tự khoét lòng mà không ai phải vẽ.
   */
  sau = waterAt(x, z);
  if (sau <= 0) return y1;
  uot *= 1 - sau;
  return sau >= 1 ? SEA_Y : y1 + (SEA_Y - y1) * sau;
}

/**
 * Cao độ mặt đất tại một điểm bất kỳ.
 *
 * Nội suy theo ĐÚNG mặt phẳng tam giác của lưới, không nội suy song tuyến: song tuyến là
 * một mặt yên ngựa, lệch tới một phần tư biên độ nhiễu ở giữa ô, và chênh ngần ấy là cây
 * cối lửng lơ hoặc lún nửa thân. Ô chia chéo so le theo (i+j) chẵn lẻ — một chiều chéo duy
 * nhất tạo ra một dải xương cá chạy khắp bản đồ, dấu hiệu "lưới máy sinh" dễ nhận nhất.
 */
export function groundAt(x: number, z: number): number {
  const gi = x / GRID_STEP;
  const gj = z / GRID_STEP;
  const i = Math.floor(gi);
  const j = Math.floor(gj);
  const u = gi - i;
  const v = gj - j;
  const hA = nodeHeight(i, j);
  const hB = nodeHeight(i + 1, j);
  const hC = nodeHeight(i, j + 1);
  const hD = nodeHeight(i + 1, j + 1);
  if (((i + j) & 1) === 0) {
    // Chéo từ A tới D.
    return u >= v
      ? hA + (hB - hA) * u + (hD - hB) * v
      : hA + (hD - hC) * u + (hC - hA) * v;
  }
  // Chéo từ B tới C.
  return u + v <= 1
    ? hA + (hB - hA) * u + (hC - hA) * v
    : hD + (hD - hC) * (u - 1) + (hD - hB) * (v - 1);
}

/**
 * Chênh cao tối đa dưới chân một công trình: bốn bậc thềm.
 *
 * Đo trên chính trường cao độ này (đĩa bán kính 17 quanh thủ phủ): ở 0,8 thì nhà nhỏ đặt
 * được gần như mọi chỗ, nhà cỡ vừa mất chừng 3% chỗ, nhà lớn mất 12%, thủ phủ mất gần 30% —
 * tức là luật có CẮN, và cắn đúng vào thứ to. Vách đá và núi tuyết thì nhà lớn gần như
 * không còn chỗ nào, còn chòi canh vẫn len được: đúng cái đọc "trên núi chỉ dựng được chòi".
 * Xuống 0,6 là nhà cỡ vừa mất một phần năm đất ngay trong làng — người chơi sẽ thấy mình bị
 * phạt vì một thứ không nhìn ra bằng mắt.
 */
export const FLAT_MAX = 0.8;

/** 0 dựng được · 1 dốc quá · 2 dính nước đầm · 3 dính dung nham. */
export type Site = 0 | 1 | 2 | 3;

/**
 * Chỗ này có dựng được một công trình bán kính `r` không.
 *
 * Mặt đất là những tam giác phẳng nên cực trị chỉ nằm ở ĐỈNH LƯỚI hoặc trên VÀNH: xét mọi
 * đỉnh lọt trong vòng tròn cộng tám điểm trên vành là đủ, không cần rải mẫu dày. Nước thì
 * xét rộng hơn một chút — mọi đỉnh của các ô mà vòng tròn chạm tới — vì mép vũng nằm giữa
 * hai đỉnh, và một căn nhà đứng "sát bờ" mà nửa nền chìm trong đầm thì trông là lỗi.
 */
export function siteOf(x: number, z: number, r: number): Site {
  const i0 = Math.floor((x - r) / GRID_STEP);
  const i1 = Math.ceil((x + r) / GRID_STEP);
  const j0 = Math.floor((z - r) / GRID_STEP);
  const j1 = Math.ceil((z + r) / GRID_STEP);
  let lo = groundAt(x, z);
  let hi = lo;
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const h = nodeCalc(i, j);
      // Bờ sông bờ biển cũng là nước: nhà dựng trên bãi thoải thì nửa nền chìm.
      if (uot > 0 || sau > 0.05) return 2;
      if (uot < 0) return 3;
      const dx = i * GRID_STEP - x;
      const dz = j * GRID_STEP - z;
      if (dx * dx + dz * dz > r * r) continue;
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
  }
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    const h = groundAt(x + Math.cos(a) * r, z + Math.sin(a) * r);
    if (h < lo) lo = h;
    if (h > hi) hi = h;
  }
  return hi - lo > FLAT_MAX + 1e-6 ? 1 : 0;
}

/**
 * Cao độ tâm một nền đất hay một bãi.
 *
 * PHẢI gọi `groundAt`, không gọi thẳng `heightAt`. Mặt đất giờ đã hoà cao độ giữa các biến
 * sinh thái, còn `heightAt` thì không — để nó gọi thẳng là quầng sáng của mọi bãi tài nguyên
 * nằm gần ranh giới sẽ lửng lơ hoặc lún tới hai đơn vị, mà chẳng có gì báo.
 */
export function levelAtCenter(x: number, z: number): number {
  return groundAt(x, z) + 0.04;
}

/**
 * Bán kính san phẳng quanh một nền đất. Nền rộng 3×3, nhưng tâm nền không trùng tâm ô nên
 * nó có thể chồm sang tới sáu ô xung quanh; 4,4 phủ hết các ô ấy và để lại một vành đất bằng
 * nho nhỏ, đọc ra như một cái nền móng chứ không như căn nhà bị cắm vào sườn dốc.
 */
export const PLOT_FLAT_R = 4.4;

/** Bán kính san phẳng trong một bãi: phủ hết quầng sáng của nó (1,16 × bán kính) và thêm một chút. */
export function patchFlatR(p: Patch): number {
  return p.radius * 1.16 + 1.2;
}

// ---------------------------------------------------------------- bãi

/** Mỗi loại tài nguyên một kiểu bãi, với tên gọi và cỡ riêng. */
const PATCH_SPEC: Record<ResourceKind, { label: string; radius: number; spots: number; base: number }> = {
  wood: { label: 'Forest', radius: 5.6, spots: 6, base: 1 },
  food: { label: 'Field', radius: 5.2, spots: 5, base: 1 },
  stone: { label: 'Quarry', radius: 4.8, spots: 5, base: 0.9 },
  gold: { label: 'Gold field', radius: 4.4, spots: 4, base: 0.5 },
  // Pha lê sản lượng thấp nhưng mỗi mảnh đáng bảy lần một khúc gỗ. Số cũ là 0,3 và đo ra
  // thì đó là một cái bẫy: rừng pha lê cách nhà 122 đơn vị có hệ số giàu 0,78 — THẤP HƠN
  // rừng gỗ ngay cạnh nhà (1,40) — nên ai đi xa lấy pha lê đều kiếm ít hơn người ở nhà.
  // Cả bốn giờ chơi không một mảnh nào vào kho. 0,55 đặt nó cao hơn hàng gần chừng 1,3 lần
  // sau khi trừ quãng đi: đủ để đi là đáng, chưa đủ để thành lựa chọn duy nhất.
  relics: { label: 'Crystal grove', radius: 4.8, spots: 4, base: 0.55 },
};

/** Tâm bãi ngập quá mức này thì bãi thành bãi cá. */
const FISH_AT = 0.6;
/** Bãi cá cho nhiều hơn ruộng một nửa: phải lội ra tận nước, và thường nằm xa làng. */
const FISH_BASE = 1.5;

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
  // Ba biến thể CHÉP NGUYÊN bảng của vùng gốc. Không phải lười: `kindFor` rút cùng một số
  // với cùng các ngưỡng, nên mọi bãi tài nguyên ra đúng loại cũ ở đúng chỗ cũ.
  swamp: [['wood', 0.45], ['food', 0.85], ['stone', 1]],
  snow: [['stone', 0.5], ['gold', 0.75], ['wood', 1]],
  ashland: [['gold', 0.45], ['stone', 0.7], ['food', 1]],
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
  /*
   * BÃI NẰM GIỮA NƯỚC THÌ THÀNH BÃI CÁ. Bãi vẫn đúng mã ấy, đúng chỗ ấy, đúng những chỗ đứng
   * ấy (mã bãi nằm trong bản lưu, qua lệnh giao dân) — chỉ đổi thứ lấy được: cá, tính là
   * lương thực, và nhiều hơn ruộng. Không thì một khu rừng đứng giữa biển, mà dẹp nó đi thì
   * mọi bãi phía sau trong khối đổi mã.
   */
  const ca = waterAt(x, z) >= FISH_AT;
  return {
    id: `b_${cx}_${cz}_${k}`,
    kind: ca ? 'food' : kind,
    label: ca ? 'Fishing ground' : spec.label,
    // center[1] là CAO ĐỘ của khoảnh đất đã san trong bãi — xem levelAtCenter().
    center: [x, levelAtCenter(x, z), z],
    radius: spec.radius,
    spots,
    biome,
    richness: (ca ? FISH_BASE : spec.base) * richnessAt(x, z),
    ...(ca ? { was: kind } : {}),
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
