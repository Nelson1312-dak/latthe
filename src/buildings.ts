/**
 * Hình dáng công trình: mỗi loại một bóng dáng riêng, và lớn lên theo cấp.
 *
 * Bản trước, nhà ở, kho lẫm và trạm trung chuyển là CÙNG một khối — bệ, thân hộp, mái chóp
 * bốn mặt — chỉ khác màu mái. Nhìn một làng chỉ thấy một rừng hộp giống nhau, và người chơi
 * phải bấm vào từng cái mới biết nó là gì. Nâng cấp cũng chỉ làm thân cao thêm vài phân.
 *
 * Giờ mỗi loại có thứ nhận ra được từ xa: nhà có mái hai mái và ống khói, thủ phủ có tháp
 * chuông và cờ, kho lẫm là silo tròn cạnh nhà kho, trạm trung chuyển là hàng rào cọc với lều.
 * Và mỗi loại đổi DÁNG qua các mốc cấp (3, 6, 10 — trạm là 3, 5), chứ không chỉ cao lên.
 *
 * HIỆU NĂNG: cả công trình hàn thành MỘT hình học, màu nằm ở từng đỉnh, dùng chung MỘT vật
 * liệu. Chi tiết hơn hẳn mà mỗi công trình chỉ còn một lệnh vẽ, thay cho ba tới tám. Hình học
 * dựng một lần cho mỗi cặp (loại, cấp) rồi dùng lại.
 *
 * Toạ độ: gốc là tâm nền đất, y = 0 là mặt nền. Camera nhìn từ phía +X +Z, nên cửa, cửa sổ
 * và mọi chi tiết đáng xem đều quay về hai mặt ấy.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MODEL_SCALE, PALETTE } from './config';
import { grain, METALNESS, ROUGHNESS } from './materials';
import { roundedBox } from './shapes';
import type { BuildingType, Vec3 } from './types';

/** Kính cửa sổ: xám lam đậm, đủ tối để đọc ra là lỗ cửa trên tường kem. */
const GLASS = 0x46505e;
const WOOD = PALETTE.trunk;
const STONE = PALETTE.granite;
const STONE_DARK = PALETTE.graniteDark;
const GOLD = PALETTE.goldOre;

export const ROOF: Record<BuildingType, number> = {
  townhall: PALETTE.roofCore,
  house: PALETTE.roofHouse,
  granary: PALETTE.roofGranary,
  outpost: PALETTE.roofOutpost,
  // Mái đá xám lam, lệch hẳn khỏi bốn mái ấm kia: chòi canh không phải chỗ ở, nó là thứ
  // người chơi phải nhận ra ngay giữa một làng toàn mái đỏ cam khi đợt bão sắp tới.
  watchtower: PALETTE.graniteDark,
  // Ba trại quân cùng một tông đất nung sẫm, lệch hẳn khỏi mái ấm của nhà dân: liếc một
  // cái là biết góc nào của làng là khu quân sự.
  barracks: 0x8a4a3a,
  archery: 0x7a5a38,
  stable: 0x6b4a34,
  smithy: 0x4a4440,
  // Hạ tầng: mỗi cái một màu RIÊNG, không dùng chung tông với nhà dân hay trại quân, vì
  // người chơi tìm chúng theo việc ("cái giếng đâu?") chứ không theo khu.
  farm: 0xb9a04a,
  well: 0x6a8fa0,
  market: 0xc0563f,
  lookout: 0x7a5a38,
  dock: 0x4f7a8c,
};

/** Ba kiểu nhà ở: 0 nhà ngói, 1 nhà tranh, 2 nhà có chái. */
export const HOUSE_KINDS = 3;

/**
 * Kiểu nhà của một công trình, suy từ chính mã của nó.
 *
 * Không lưu thêm trường nào vào bản lưu: mã `b_N` đã có sẵn và không bao giờ đổi, nên
 * cùng một căn nhà luôn ra cùng một kiểu, kể cả ở bản lưu có từ trước bản này. Mục đích
 * chỉ là một cái làng mười căn nhà không còn là mười bản sao của một căn.
 */
export function kieuOf(id: string): number {
  const n = Number(id.slice(2));
  return Number.isFinite(n) ? Math.abs(Math.floor(n)) % HOUSE_KINDS : 0;
}

/** Mặt trên tấm bệ đất — mọi thân công trình đứng lên đây. */
const Y0 = 0.18;

/** Mốc đổi dáng: 0 tới 3 (trạm trung chuyển chỉ tới 2, vì nó tối đa cấp 5). */
function stage(type: BuildingType, level: number): number {
  if (type === 'smithy') return level >= 3 ? 2 : level >= 2 ? 1 : 0;
  if (type === 'outpost' || type === 'watchtower' || type === 'stable' || type === 'farm'
    || type === 'well' || type === 'market' || type === 'lookout' || type === 'dock') {
    return level >= 5 ? 2 : level >= 3 ? 1 : 0;
  }
  return level >= 10 ? 3 : level >= 6 ? 2 : level >= 3 ? 1 : 0;
}

/**
 * Hộp đồ nghề để lắp một công trình từ các mảnh đã tô màu.
 *
 * Mọi mảnh bị đưa về không-chỉ-số, bỏ toạ độ UV và gắn màu đỉnh, vì mergeGeometries đòi
 * mọi mảnh có ĐÚNG cùng một bộ thuộc tính. Tham số y luôn là ĐÁY của mảnh, không phải tâm —
 * xếp chồng các mảnh lên nhau thì đọc mã dễ hơn hẳn.
 */
class Kit {
  private readonly parts: THREE.BufferGeometry[] = [];
  private readonly c = new THREE.Color();

  private push(g: THREE.BufferGeometry, color: number): void {
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    n.deleteAttribute('uv');
    this.c.setHex(color);
    const count = n.attributes.position.count;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = this.c.r;
      arr[i * 3 + 1] = this.c.g;
      arr[i * 3 + 2] = this.c.b;
    }
    n.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.parts.push(n);
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, color: number): void {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y + h / 2, z);
    this.push(g, color);
  }

  rbox(w: number, h: number, d: number, bo: number, vat: number,
    x: number, y: number, z: number, color: number): void {
    const g = roundedBox(w, h, d, bo, vat);
    g.translate(x, y + h / 2, z);
    this.push(g, color);
  }

  cyl(rt: number, rb: number, h: number, seg: number,
    x: number, y: number, z: number, color: number, theta = 0): void {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, false, theta);
    g.translate(x, y + h / 2, z);
    this.push(g, color);
  }

  cone(r: number, h: number, seg: number, x: number, y: number, z: number, color: number, ry = 0): void {
    const g = new THREE.ConeGeometry(r, h, seg);
    if (ry) g.rotateY(ry);
    g.translate(x, y + h / 2, z);
    this.push(g, color);
  }

  /** Một mảnh đã dựng sẵn ở ngoài, chỉ còn việc tô màu và gộp vào. */
  raw(g: THREE.BufferGeometry, color: number): void {
    this.push(g, color);
  }

  /** Đĩa tròn dựng đứng, mặt quay về +Z — mặt đồng hồ. */
  disc(r: number, x: number, y: number, z: number, color: number): void {
    const g = new THREE.CylinderGeometry(r, r, 0.05, 14);
    g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    this.push(g, color);
  }

  /**
   * Mái hai mái: nóc chạy dọc trục X, hai sườn dốc về ±Z, hai đầu hồi tam giác ở ±X.
   * `ry = π/2` thì nóc chạy dọc Z và đầu hồi quay ra ±Z — kiểu mặt tiền nhà kho.
   */
  gable(w: number, d: number, h: number, over: number,
    x: number, y: number, z: number, color: number, ry = 0): void {
    const a = w / 2 + over;
    const b = d / 2 + over;
    // Mỗi tam giác ghi theo chiều ngược kim đồng hồ khi nhìn từ phía ngoài.
    const p = [
      -a, 0, b, a, 0, b, a, h, 0, -a, 0, b, a, h, 0, -a, h, 0, // sườn +Z
      a, 0, -b, -a, 0, -b, -a, h, 0, a, 0, -b, -a, h, 0, a, h, 0, // sườn −Z
      -a, 0, -b, -a, 0, b, -a, h, 0, // hồi −X
      a, 0, b, a, 0, -b, a, h, 0, // hồi +X
      -a, 0, -b, a, 0, -b, a, 0, b, -a, 0, -b, a, 0, b, -a, 0, b, // mặt dưới
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.push(g, color);
  }

  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    if (!g) throw new Error('Failed to merge building geometry');
    return g;
  }
}

/**
 * Bệ đất dưới mọi công trình trừ thủ phủ.
 *
 * Trước là một tấm VUÔNG 3×3 — di sản của thời công trình phải đứng trên một nền đất sinh
 * sẵn hình vuông. Giờ đất đã liền mạch và công trình chiếm một vùng TRÒN, nên bệ cũng tròn,
 * đúng bằng diện tích nó chiếm.
 *
 * Và nó THỤT XUỐNG dưới mặt đất gần một đơn vị: mặt đất liền có dốc thật, không còn là
 * những mặt phẳng từng ô, nên một tấm bệ mỏng đặt trên sườn sẽ hở một bên. Cái váy này
 * chôn xuống đủ sâu để không bao giờ hở, và không ai nhìn thấy phần chôn.
 *
 * Dáng là một MÔ ĐẤT ĐẮP, chân choãi ra, chứ không phải một cái đĩa. Bản trước mặt trên
 * rộng hơn đáy nên vành dựng đứng, và dưới nắng xiên nó đọc ra là một đồng xu đặt trên cỏ.
 * Chân choãi thì vành thành một con dốc 45 độ bắt nắng một bên, râm một bên — đất được
 * đắp lên, không phải vật lạ rơi xuống. Ở ngang mặt đất bán kính vẫn xấp xỉ r, nên diện
 * tích nhìn thấy không lấn sang phần đất của công trình bên cạnh.
 */
function nen(k: Kit, r = 1.7): void {
  k.cyl(r * 0.86, r * 1.46, 1.1, 12, 0, -0.88, 0, PALETTE.plotDirt);
}

// ------------------------------------------------------------------ nhà ở

/** Chiều cao thân nhà. Mốc 6 lên hai tầng; trước đó cao thêm từng chút một theo cấp. */
const houseH = (level: number, st: number): number => (st >= 2 ? 1.95 + level * 0.03 : 1.05 + level * 0.04);
/** Ống khói: chỗ đứng trên mặt bằng nhà, và chiều cao theo mốc. */
const CHIMNEY_X = 0.5;
const CHIMNEY_Z = -0.38;
const chimneyH = (st: number): number => (st >= 3 ? 1.25 : 0.95);

/**
 * Miệng ống khói, toạ độ CỤC BỘ của công trình — null nếu loại này không có ống khói. Tính từ
 * đúng những hằng số dựng nên cái ống, nên nhà lên cấp cao thêm thì khói bay ra đúng miệng mới.
 */
export function chimneyTop(type: BuildingType, level: number): Vec3 | null {
  if (type !== 'house') return null;
  const st = stage('house', level);
  return [CHIMNEY_X, Y0 + houseH(level, st) + 0.15 + chimneyH(st), CHIMNEY_Z];
}

/** Mái rạ và tường trát đất của nhà tranh; ngói sẫm của nhà có chái. */
const MAI_RA = 0xc7a95e;
const TUONG_DAT = 0xd6bf97;
const MAI_SAM = 0xa8553c;

/**
 * Nhà ở, BA KIỂU cùng một khung.
 *
 * Cả ba giữ đúng chiều cao thân và đúng chỗ đặt ống khói, vì `chimneyTop` tính miệng khói
 * từ hai con số ấy — đổi dáng mà xê ống khói thì khói bay ra giữa trời. Cái khác nhau là
 * thứ đọc được từ xa: màu mái, độ dốc mái, và bóng dáng (nhà có chái là hình chữ L).
 */
function house(level: number, kieu = 0): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('house', level);
  nen(k, 1.8);
  const w = kieu === 2 ? 1.6 : 1.9;
  const d = 1.7;
  // Nhà có chái lệch thân chính sang phải để cái chái còn nằm gọn trong diện tích chiếm.
  const ox = kieu === 2 ? 0.25 : 0;
  const H = houseH(level, st);
  const tuong = kieu === 1 ? TUONG_DAT : PALETTE.wall;
  const mai = kieu === 1 ? MAI_RA : kieu === 2 ? MAI_SAM : ROOF.house;
  k.rbox(w, H, d, 0.12, 0.05, ox, Y0, 0, tuong);
  // Mái rạ dốc và đua ra nhiều hơn mái ngói — đó là cái làm nó đọc ra là rạ.
  k.gable(w, d, kieu === 1 ? 1.15 : 0.95, kieu === 1 ? 0.28 : 0.18, ox, Y0 + H, 0, mai);
  // Ống khói xuyên sườn mái phía sau.
  k.box(0.28, chimneyH(st), 0.28, CHIMNEY_X, Y0 + H + 0.15, CHIMNEY_Z, STONE);
  // Mặt trước: cửa chính giữa, cửa sổ hai bên.
  const cs = kieu === 2 ? 0.5 : 0.6;
  k.box(0.42, 0.72, 0.06, ox, Y0, d / 2, WOOD);
  for (const x of [-cs, cs]) k.box(0.34, 0.34, 0.06, ox + x, Y0 + 0.36, d / 2, GLASS);
  // Mặt bên +X.
  k.box(0.06, 0.34, 0.34, ox + w / 2, Y0 + 0.36, 0.2, GLASS);
  if (st >= 2) {
    for (const x of [-cs, 0, cs]) k.box(0.32, 0.32, 0.06, ox + x, Y0 + 1.25, d / 2, GLASS);
    k.box(0.06, 0.32, 0.32, ox + w / 2, Y0 + 1.25, 0.2, GLASS);
  }
  if (kieu === 1) {
    // Khung gỗ lộ ra ngoài tường đất: bốn cột góc và một thanh giằng ngang mặt trước.
    for (const x of [-w / 2, w / 2]) {
      for (const z of [-d / 2, d / 2]) k.box(0.12, H, 0.12, x, Y0, z, WOOD);
    }
    k.box(w, 0.09, 0.07, 0, Y0 + Math.min(H - 0.12, 0.9), d / 2, WOOD);
    // Đống rơm cạnh nhà.
    k.cyl(0.26, 0.34, 0.36, 7, -1.25, Y0, 0.75, MAI_RA);
    k.cone(0.3, 0.26, 7, -1.25, Y0 + 0.36, 0.75, MAI_RA);
  }
  if (kieu === 2) {
    // Cái chái: một khối thấp hơn nối vào hồi trái, mái quay ngang so với mái chính.
    const hc = H * 0.72;
    k.rbox(0.8, hc, 1.15, 0.08, 0.04, ox - w / 2 - 0.36, Y0, -0.15, tuong);
    k.gable(1.15, 0.8, 0.5, 0.12, ox - w / 2 - 0.36, Y0 + hc, -0.15, mai, Math.PI / 2);
    k.box(0.3, 0.3, 0.06, ox - w / 2 - 0.36, Y0 + 0.36, 0.43, GLASS);
  }
  if (st >= 1) {
    // Hiên: mái nhỏ trên cửa, hai cột gỗ, và bồn hoa dưới cửa sổ.
    k.gable(0.9, 0.5, 0.28, 0.05, ox, Y0 + 0.82, d / 2 + 0.28, mai);
    for (const x of [-0.38, 0.38]) k.box(0.07, 0.82, 0.07, ox + x, Y0, d / 2 + 0.48, WOOD);
    for (const x of [-cs, cs]) k.box(0.4, 0.1, 0.12, ox + x, Y0 + 0.3, d / 2 + 0.05, PALETTE.berry);
  }
  if (st >= 3) {
    // Cửa sổ mái nhô ra ở sườn trước.
    k.box(0.5, 0.45, 0.5, ox - 0.45, Y0 + H + 0.15, 0.35, tuong);
    k.gable(0.5, 0.5, 0.3, 0.06, ox - 0.45, Y0 + H + 0.6, 0.35, mai, Math.PI / 2);
    k.box(0.26, 0.24, 0.06, ox - 0.45, Y0 + H + 0.25, 0.6, GLASS);
  }
  return k.build();
}

function townhall(level: number, co: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('townhall', level);
  // Bệ lục giác, xoay 30° cho khớp với lưới ô — thủ phủ ngồi đúng trên một ô.
  // Bệ đá tròn, thụt xuống như mọi bệ khác. Bản cũ là lục giác xoay 30 độ cho khớp
  // lưới ô — mà lưới ô thì không còn.
  // Chân choãi như kè đá, cùng lý do với mô đất ở `nen`: vành dựng đứng là một đồng xu.
  k.cyl(2.5, 3.2, 1.3, 16, 0, -1.0, 0, STONE_DARK);
  const y0 = 0.4;
  const w = 2.6;
  const d = 2.3;
  const zb = -0.2;
  const H = 1.5 + level * 0.06;
  k.rbox(w, H, d, 0.2, 0.06, 0, y0, zb, PALETTE.wall);
  k.cone(w * 0.72 + 0.2, 1.3, 4, 0, y0 + H, zb, ROOF.townhall, Math.PI / 4);
  for (const x of [-0.85, 0.85]) k.box(0.38, 0.52, 0.06, x, y0 + 0.5, zb + d / 2, GLASS);
  for (const z of [-0.9, 0.3]) k.box(0.06, 0.52, 0.38, w / 2, y0 + 0.5, z, GLASS);

  // Tháp chuông nhô ra phía trước — thứ nhận ra thủ phủ từ mọi mức phóng.
  const zt = 0.95;
  const Ht = H + 1.3 + level * 0.06;
  k.rbox(0.9, Ht, 0.9, 0.08, 0.04, 0, y0, zt, PALETTE.wall);
  k.cone(0.78, 1.0, 4, 0, y0 + Ht, zt, st >= 3 ? GOLD : ROOF.townhall, Math.PI / 4);
  k.box(0.48, 0.82, 0.06, 0, y0, zt + 0.45, WOOD);
  k.box(1.0, 0.1, 0.25, 0, y0, zt + 0.62, STONE);
  // Cột cờ trên đỉnh tháp, cờ bay về phía +X.
  k.cyl(0.035, 0.035, 0.95, 5, 0, y0 + Ht + 0.9, zt, WOOD);
  // Lá cờ mang MÀU NGƯỜI CHƠI CHỌN. Đây là chỗ duy nhất trên bản đồ nói "làng này là của
  // tôi", nên nó phải ở trên cao nhất và không bị vàng cấp 3 chiếm mất.
  k.box(0.55, 0.32, 0.03, 0.3, y0 + Ht + 1.45, zt, co);
  if (st >= 1) {
    // Mặt đồng hồ trên tháp và hai dải băng đỏ trên mặt tiền.
    k.disc(0.27, 0, y0 + Ht - 0.5, zt + 0.47, PALETTE.wall);
    k.disc(0.05, 0, y0 + Ht - 0.5, zt + 0.5, WOOD);
    // Hai dải băng trên mặt tiền cũng theo màu cờ: một lá cờ bé tí trên đỉnh tháp thì ở mức
    // phóng xa không còn thấy, mà màu của mình thì phải thấy được từ xa.
    for (const x of [-0.85, 0.85]) k.box(0.24, 0.62, 0.03, x, y0 + H - 0.75, zb + d / 2 + 0.02, co);
  }
  if (st >= 2) {
    // Tháp phụ phía sau, thấp hơn.
    k.rbox(0.7, H + 0.7, 0.7, 0.06, 0.03, -0.85, y0, -1.15, PALETTE.wall);
    k.cone(0.62, 0.8, 4, -0.85, y0 + H + 0.7, -1.15, ROOF.townhall, Math.PI / 4);
  }
  return k.build();
}

// ------------------------------------------------------------------ kho lẫm

function silo(k: Kit, x: number, z: number, h: number, r: number): void {
  k.cyl(r, r, h, 10, x, Y0, z, PALETTE.wall);
  for (const t of [0.3, 0.65]) k.cyl(r + 0.02, r + 0.02, 0.06, 10, x, Y0 + h * t, z, WOOD);
  k.cone(r + 0.08, r * 0.9, 10, x, Y0 + h, z, ROOF.granary);
}

function granary(level: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('granary', level);
  nen(k, 2.0);
  const Hs = 1.5 + level * 0.07 + (st >= 2 ? 0.4 : 0);
  silo(k, -0.6, -0.5, Hs, 0.6);
  if (st >= 1) silo(k, 0.7, -0.75, Hs * 0.85, 0.48);
  if (st >= 2) silo(k, -0.85, 0.75, Hs * 0.7, 0.42);
  // Nhà kho: đầu hồi quay ra trước như mặt tiền nhà kho thật.
  k.rbox(1.25, 0.85, 1.1, 0.08, 0.04, 0.55, Y0, 0.55, PALETTE.wall);
  k.gable(1.25, 1.1, 0.5, 0.1, 0.55, Y0 + 0.85, 0.55, ROOF.granary, Math.PI / 2);
  k.box(0.5, 0.62, 0.06, 0.55, Y0, 1.1, WOOD);
  // Bao tải trước cửa.
  for (const [x, z] of [[0.0, 1.27], [0.24, 1.33], [-0.2, 1.2]] as const) {
    k.rbox(0.24, 0.2, 0.18, 0.06, 0.03, x, Y0, z, PALETTE.wheat);
  }
  if (st >= 3) {
    // Chong chóng gió trên silo chính.
    k.cyl(0.025, 0.025, 0.5, 4, -0.6, Y0 + Hs + 0.45, -0.5, WOOD);
    k.box(0.5, 0.06, 0.06, -0.6, Y0 + Hs + 0.9, -0.5, GOLD);
  }
  return k.build();
}

// ------------------------------------------------------------------ trạm trung chuyển

function outpost(level: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('outpost', level);
  nen(k, 2.2);
  // Hàng rào cọc bốn cạnh, chừa cổng ở mặt trước. Chiều cao lệch nhẹ theo chỉ số cho bớt đều.
  const e = 1.32;
  for (let i = 0; i <= 6; i += 1) {
    const t = -e + (i / 6) * 2 * e;
    const h = 0.55 + ((i * 7) % 5) * 0.035;
    k.cyl(0.075, 0.085, h, 5, t, Y0, -e, WOOD);
    k.cyl(0.075, 0.085, h, 5, -e, Y0, t, WOOD);
    k.cyl(0.075, 0.085, h, 5, e, Y0, t, WOOD);
    if (Math.abs(t) > 0.45) k.cyl(0.075, 0.085, h, 5, t, Y0, e, WOOD);
  }
  // Lều.
  k.cone(0.85, 1.35, 6, -0.25, Y0, -0.25, ROOF.outpost);
  k.cyl(0.03, 0.03, 0.35, 4, -0.25, Y0 + 1.25, -0.25, WOOD);
  if (st >= 1) {
    // Chòi canh ở góc sau.
    const x = 0.72;
    const z = -0.72;
    for (const [dx, dz] of [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]] as const) {
      k.box(0.08, 1.7, 0.08, x + dx, Y0, z + dz, WOOD);
    }
    k.box(0.72, 0.08, 0.72, x, Y0 + 1.7, z, WOOD);
    k.cone(0.55, 0.45, 4, x, Y0 + 1.95, z, ROOF.outpost, Math.PI / 4);
    if (st >= 2) {
      k.cyl(0.025, 0.025, 0.6, 4, x, Y0 + 2.35, z, WOOD);
      k.box(0.4, 0.24, 0.03, x + 0.21, Y0 + 2.7, z, GOLD);
    }
  }
  return k.build();
}

/**
 * Chòi canh: một cái tháp đá CAO, và cao hơn nữa theo cấp.
 *
 * Mọi công trình khác ở đây đều bè ra; chòi canh là thứ duy nhất vươn lên, nên nhìn bóng
 * dáng một cái làng là biết ngay nó phòng thủ tới đâu. Đó cũng là thông tin người chơi cần
 * đọc nhanh nhất lúc đồng hồ đếm ngược chuyển đỏ.
 */
function watchtower(level: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('watchtower', level);
  nen(k, 1.5);
  // Thân đá thuôn dần, cao theo cấp. Hai bậc màu để khối đá không đọc ra là một cục phẳng.
  const H = 2.5 + level * 0.42;
  k.cyl(0.62, 0.74, H * 0.55, 6, 0, Y0, 0, STONE);
  k.cyl(0.52, 0.62, H * 0.45, 6, 0, Y0 + H * 0.55, 0, STONE_DARK);
  // Sàn canh nhô ra, có lan can cọc.
  const yS = Y0 + H;
  k.cyl(0.78, 0.78, 0.12, 6, 0, yS, 0, WOOD);
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    k.box(0.1, 0.42, 0.1, Math.cos(a) * 0.62, yS + 0.12, Math.sin(a) * 0.62, WOOD);
  }
  k.cone(0.92, 0.68, 6, 0, yS + 0.54, 0, ROOF.watchtower);
  if (st >= 1) {
    // Ngọn lửa hiệu trên đỉnh: cái làng đã biết báo động cho nhau.
    k.cyl(0.16, 0.2, 0.18, 6, 0, yS + 1.18, 0, STONE_DARK);
    k.cone(0.2, 0.34, 5, 0, yS + 1.3, 0, PALETTE.goldOre);
  }
  if (st >= 2) {
    // Nhà kho áp chân tháp: chòi cấp cuối là một cứ điểm chứ không còn là cái cọc canh.
    k.box(0.86, 0.5, 0.62, -0.78, Y0, 0.42, PALETTE.wall);
    k.cone(0.76, 0.34, 4, -0.78, Y0 + 0.5, 0.42, ROOF.watchtower, Math.PI / 4);
  }
  return k.build();
}

// ------------------------------------------------------------------ hạ tầng

/*
 * NĂM CÔNG TRÌNH HẠ TẦNG.
 *
 * Cùng một luật với trại quân: mỗi cái mang đúng MỘT bóng dáng nói ra nó là gì. Ruộng là
 * thứ duy nhất nằm bẹt; giếng là thứ duy nhất nhỏ hơn một căn nhà; chợ là một cụm mái bạt
 * ba màu; đài quan sát là cái tháp GỖ rỗng (chòi canh là tháp ĐÁ đặc); xưởng thuyền có
 * một con thuyền nằm trên cạn. Ở mức phóng nghỉ không ai đọc được chi tiết nào khác.
 */

/** Ruộng lúa: một thửa đất cày có luống, cái chòi và con bù nhìn. */
function farm(level: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('farm', level);
  nen(k, 2.4);
  k.box(3.0, 0.1, 2.4, 0.3, Y0, 0.35, PALETTE.cliffLow);
  // Luống xen kẽ lúa non và lúa chín; lên cấp thì lúa cao hơn và chín hết.
  const cao = 0.2 + st * 0.07;
  for (let i = 0; i < 6; i += 1) {
    const z = -0.6 + i * 0.38;
    const chin = st >= 2 || i % 2 === 0;
    k.box(2.75, cao, 0.2, 0.3, Y0 + 0.1, z, chin ? PALETTE.wheat : PALETTE.leaf[2]);
  }
  // Chòi nông cụ ở góc sau.
  k.rbox(0.9, 0.7, 0.8, 0.06, 0.03, -1.5, Y0, -1.25, PALETTE.wall);
  k.gable(0.9, 0.8, 0.42, 0.1, -1.5, Y0 + 0.7, -1.25, ROOF.farm);
  k.box(0.3, 0.48, 0.05, -1.5, Y0, -0.84, WOOD);
  // Bù nhìn.
  k.box(0.07, 1.0, 0.07, 1.15, Y0 + 0.1, -0.05, WOOD);
  k.box(0.62, 0.07, 0.07, 1.15, Y0 + 0.78, -0.05, WOOD);
  k.box(0.2, 0.2, 0.2, 1.15, Y0 + 1.08, -0.05, PALETTE.wheat);
  k.cone(0.24, 0.18, 6, 1.15, Y0 + 1.28, -0.05, PALETTE.hat);
  if (st >= 1) {
    // Hàng rào thưa hai cạnh phía người nhìn.
    for (let i = 0; i <= 5; i += 1) {
      k.cyl(0.06, 0.07, 0.42, 5, -1.2 + i * 0.6, Y0, 1.68, WOOD);
      if (i < 5) k.cyl(0.06, 0.07, 0.42, 5, 1.92, Y0, -0.8 + i * 0.6, WOOD);
    }
    k.box(3.1, 0.06, 0.05, 0.3, Y0 + 0.28, 1.68, WOOD);
    k.box(0.05, 0.06, 2.5, 1.92, Y0 + 0.28, 0.42, WOOD);
  }
  if (st >= 2) {
    // Hai đụn rơm: mùa này đã có của ăn của để.
    for (const [x, z] of [[-0.55, -1.4], [0.15, -1.5]] as const) {
      k.cyl(0.3, 0.38, 0.4, 7, x, Y0, z, PALETTE.wheat);
      k.cone(0.34, 0.3, 7, x, Y0 + 0.4, z, PALETTE.wheat);
    }
  }
  return k.build();
}

/** Giếng làng: thành đá tròn, hai cột, mái che và cái gàu. */
function well(level: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('well', level);
  nen(k, 1.4);
  k.cyl(0.62, 0.68, 0.5, 8, 0, Y0, 0, STONE);
  k.cyl(0.47, 0.47, 0.03, 8, 0, Y0 + 0.49, 0, PALETTE.water);
  for (const x of [-0.54, 0.54]) k.box(0.1, 1.55, 0.1, x, Y0, 0, WOOD);
  k.box(1.2, 0.08, 0.08, 0, Y0 + 1.2, 0, WOOD);
  k.gable(1.3, 0.85, 0.42, 0.08, 0, Y0 + 1.5, 0, ROOF.well);
  // Dây và gàu.
  k.box(0.025, 0.36, 0.025, 0.12, Y0 + 0.86, 0, WOOD);
  k.cyl(0.11, 0.09, 0.17, 6, 0.12, Y0 + 0.7, 0, WOOD);
  if (st >= 1) {
    // Máng nước cho trâu bò ở mặt trước.
    k.box(0.78, 0.2, 0.36, 0.15, Y0, 1.0, STONE_DARK);
    k.box(0.64, 0.03, 0.22, 0.15, Y0 + 0.2, 1.0, PALETTE.water);
  }
  if (st >= 2) {
    // Hai chum nước và một bồn hoa: cái giếng đã thành chỗ cả làng ra ngồi.
    k.cyl(0.14, 0.18, 0.34, 7, -0.92, Y0, 0.45, PALETTE.berry);
    k.cyl(0.12, 0.16, 0.28, 7, -1.0, Y0, 0.05, PALETTE.berry);
    k.box(0.5, 0.12, 0.16, 0.95, Y0, -0.3, PALETTE.leaf[2]);
  }
  return k.build();
}

/** Chợ phiên: sân lát, mấy sạp mái bạt khác màu, hàng bày trên bàn. */
function market(level: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('market', level);
  nen(k, 2.3);
  k.cyl(1.95, 1.95, 0.06, 10, 0, Y0, 0, PALETTE.sand);
  const sap: [number, number, number][] = [
    [-0.85, -0.7, ROOF.market], [0.85, -0.55, 0xd9b45a], [0.05, 0.85, 0x5f8f8a],
  ];
  const n = st >= 1 ? 3 : 2;
  for (let i = 0; i < n; i += 1) {
    const [x, z, mau] = sap[i];
    k.box(1.1, 0.42, 0.6, x, Y0 + 0.06, z, WOOD);
    // Ba mẹt hàng: lúa, quả, và một món quý.
    k.box(0.26, 0.14, 0.3, x - 0.34, Y0 + 0.48, z, PALETTE.wheat);
    k.box(0.26, 0.14, 0.3, x, Y0 + 0.48, z, PALETTE.berry);
    k.box(0.26, 0.14, 0.3, x + 0.34, Y0 + 0.48, z, i === 1 ? GOLD : PALETTE.leaf[2]);
    for (const dx of [-0.56, 0.56]) {
      for (const dz of [-0.34, 0.34]) k.box(0.06, 1.2, 0.06, x + dx, Y0 + 0.06, z + dz, WOOD);
    }
    k.gable(1.2, 0.76, 0.32, 0.12, x, Y0 + 1.24, z, mau);
  }
  // Thùng và sọt để ngoài sân.
  k.rbox(0.4, 0.38, 0.4, 0.04, 0.02, -1.2, Y0 + 0.06, 0.55, WOOD);
  k.cyl(0.17, 0.17, 0.42, 7, 1.35, Y0 + 0.06, 0.5, WOOD);
  if (st >= 2) {
    // Cột cờ phiên chợ: nhìn từ xa biết hôm nay họp.
    k.cyl(0.04, 0.04, 2.3, 5, 1.2, Y0, 1.1, WOOD);
    k.box(0.56, 0.34, 0.03, 1.5, Y0 + 1.9, 1.1, ROOF.market);
    k.rbox(0.4, 0.38, 0.4, 0.04, 0.02, -1.45, Y0 + 0.06, -0.05, WOOD);
  }
  return k.build();
}

/**
 * Đài quan sát: tháp GỖ rỗng, bốn chân có giằng.
 *
 * Phải khác hẳn chòi canh, vì hai cái làm hai việc khác nhau mà cùng là "cái tháp": chòi
 * canh là đá đặc, mái nhọn sáu cạnh; đài quan sát là khung gỗ nhìn xuyên qua được, mái
 * vuông. Lẫn hai cái là người chơi xây nhầm cái tháp không cộng sức thủ.
 */
function lookout(level: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('lookout', level);
  nen(k, 1.5);
  const H = 2.6 + level * 0.3;
  const e = 0.5;
  for (const x of [-e, e]) for (const z of [-e, e]) k.box(0.12, H, 0.12, x, Y0, z, WOOD);
  for (let y = 0.8; y < H - 0.3; y += 0.9) {
    for (const z of [-e, e]) k.box(1.1, 0.07, 0.07, 0, Y0 + y, z, WOOD);
    for (const x of [-e, e]) k.box(0.07, 0.07, 1.1, x, Y0 + y, 0, WOOD);
  }
  // Sàn, lan can và mái vuông.
  const yS = Y0 + H;
  k.box(1.5, 0.1, 1.5, 0, yS, 0, WOOD);
  for (const x of [-0.68, 0.68]) for (const z of [-0.68, 0.68]) k.box(0.08, 0.95, 0.08, x, yS + 0.1, z, WOOD);
  for (const z of [-0.7, 0.7]) k.box(1.44, 0.07, 0.05, 0, yS + 0.5, z, WOOD);
  for (const x of [-0.7, 0.7]) k.box(0.05, 0.07, 1.44, x, yS + 0.5, 0, WOOD);
  k.cone(1.15, 0.5, 4, 0, yS + 1.05, 0, ROOF.lookout, Math.PI / 4);
  // Thang ở mặt trước.
  for (const x of [-0.16, 0.16]) k.box(0.05, H, 0.05, x, Y0, e + 0.14, WOOD);
  for (let y = 0.3; y < H; y += 0.36) k.box(0.34, 0.04, 0.04, 0, Y0 + y, e + 0.14, WOOD);
  if (st >= 1) {
    // Lá cờ hiệu: đài đã nối được với làng.
    k.cyl(0.025, 0.025, 0.75, 4, 0, yS + 1.5, 0, WOOD);
    k.box(0.44, 0.26, 0.03, 0.23, yS + 1.95, 0, GOLD);
  }
  if (st >= 2) {
    // Lều của người gác dưới chân tháp.
    k.cone(0.55, 0.75, 5, -1.0, Y0, 0.6, ROOF.lookout);
  }
  return k.build();
}

/** Thân thuyền: một cái hộp bóp nhọn hai đầu, thót đáy, và vểnh mũi. */
function hull(dai: number, cao: number, rong: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(dai, cao, rong, 6, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    const t = p.getX(i) / (dai / 2);
    const day = p.getY(i) < 0;
    const bop = (1 - 0.88 * t * t) * (day ? 0.5 : 1);
    p.setXYZ(i, p.getX(i) * (day ? 0.84 : 1), p.getY(i) + 0.16 * t * t, p.getZ(i) * bop);
  }
  g.computeVertexNormals();
  return g;
}

/** Xưởng thuyền: một con thuyền đang đóng dở trên giá, cạnh cái lán gỗ. */
function dock(level: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('dock', level);
  nen(k, 2.5);
  // Lán thợ phía sau.
  k.rbox(1.5, 1.1, 1.3, 0.1, 0.05, -1.15, Y0, -1.0, PALETTE.wall);
  k.gable(1.5, 1.3, 0.7, 0.15, -1.15, Y0 + 1.1, -1.0, ROOF.dock);
  k.box(0.5, 0.75, 0.06, -1.15, Y0, -0.34, WOOD);
  k.box(0.06, 0.32, 0.32, -0.4, Y0 + 0.42, -1.0, GLASS);
  // Giá đỡ và con thuyền.
  const tx = 0.6;
  const tz = 0.75;
  for (const x of [tx - 0.6, tx + 0.6]) k.box(0.12, 0.34, 1.05, x, Y0, tz, WOOD);
  const than = hull(2.5, 0.46, 0.86);
  than.translate(tx, Y0 + 0.34 + 0.23, tz);
  k.raw(than, 0x9a7650);
  // Ghế ngang trong lòng thuyền, để nó không đọc ra là một khúc gỗ đặc.
  for (const x of [-0.5, 0.15, 0.8]) k.box(0.08, 0.05, 0.6, tx + x, Y0 + 0.8, tz, WOOD);
  // Chồng ván chờ đóng.
  for (let i = 0; i < 3; i += 1) k.box(1.15, 0.1, 0.16, -1.2 + i * 0.05, Y0 + i * 0.1, 0.55 + i * 0.03, WOOD);
  if (st >= 1) {
    // Dựng được cột buồm thì con thuyền đã gần xong.
    k.cyl(0.04, 0.05, 1.75, 5, tx + 0.1, Y0 + 0.6, tz, WOOD);
    k.box(0.03, 0.9, 0.95, tx + 0.14, Y0 + 1.3, tz, PALETTE.cloud);
    k.box(0.05, 0.05, 1.0, tx + 0.1, Y0 + 2.2, tz, WOOD);
  }
  if (st >= 2) {
    // Cần trục gỗ và lá cờ xanh biển.
    k.box(0.12, 2.0, 0.12, 1.75, Y0, -0.75, WOOD);
    k.box(1.1, 0.09, 0.09, 1.3, Y0 + 1.95, -0.75, WOOD);
    k.box(0.02, 0.7, 0.02, 0.8, Y0 + 1.25, -0.75, WOOD);
    k.box(0.2, 0.16, 0.2, 0.8, Y0 + 1.1, -0.75, STONE_DARK);
    k.box(0.4, 0.24, 0.03, 1.97, Y0 + 2.2, -0.75, ROOF.dock);
  }
  return k.build();
}

// ------------------------------------------------------------------ bộ nhớ đệm

const CACHE = new Map<string, THREE.BufferGeometry>();
let MAT: THREE.MeshStandardMaterial | null = null;

/** Hình học của một công trình ở một cấp. Dựng một lần, dùng lại cho mọi công trình giống nó. */

// ------------------------------------------------------------------ trại quân

/*
 * BA TRẠI QUÂN VÀ MỘT LÒ RÈN.
 *
 * Chúng phải nhận ra được từ xa và phải khác hẳn nhà dân, vì khu quân sự là chỗ người chơi
 * quay lại nhiều nhất trong ba mươi giây báo động. Nên cả ba cùng một tông đất nung sẫm,
 * và mỗi cái mang đúng MỘT món đồ nói ra nó là gì: giá giáo, bia bắn, hàng rào ngựa, ống
 * bễ. Ở mức phóng này người chơi đọc bóng dáng chứ không đọc chi tiết.
 */

/** Doanh trại: nhà dài mái dốc, một giá giáo dựng ngoài sân. */
function barracks(level: number): THREE.BufferGeometry {
  const k = new Kit();
  nen(k, 2.4);
  const st = stage('barracks', level);
  const w = 2.9;
  const d = 1.9;
  const H = 1.15 + level * 0.04;
  k.rbox(w, H, d, 0.12, 0.05, 0, Y0, -0.25, PALETTE.wall);
  k.gable(w, d, 0.8, 0.16, 0, Y0 + H, -0.25, ROOF.barracks);
  // Cửa lớn và hai khung cửa sổ hẹp — kiểu nhà lính, không phải nhà ở.
  k.box(0.6, 0.85, 0.06, 0, Y0, -0.25 + d / 2, WOOD);
  for (const x of [-0.95, 0.95]) k.box(0.22, 0.4, 0.06, x, Y0 + 0.5, -0.25 + d / 2, GLASS);
  // Giá giáo: một thanh ngang trên hai cọc, cắm ba ngọn giáo.
  for (const x of [-0.7, 0.7]) k.cyl(0.07, 0.07, 0.6, 5, x, Y0, 1.15, WOOD);
  k.box(1.6, 0.1, 0.12, 0, Y0 + 0.6, 1.15, WOOD);
  for (const x of [-0.5, 0, 0.5]) {
    k.cyl(0.035, 0.035, 1.1, 5, x, Y0 + 0.2, 1.15, WOOD);
    k.cone(0.09, 0.26, 6, x, Y0 + 1.3, 1.15, STONE);
  }
  if (st >= 1) {
    // Cột cờ hiệu bên hông.
    k.cyl(0.05, 0.05, 1.8, 5, -1.6, Y0, 0.3, WOOD);
    k.box(0.5, 0.3, 0.04, -1.37, Y0 + 1.45, 0.3, ROOF.barracks);
  }
  if (st >= 2) {
    k.rbox(1.1, H * 0.8, 1.1, 0.1, 0.04, 1.75, Y0, 0.6, PALETTE.wall);
    k.gable(1.1, 1.1, 0.5, 0.12, 1.75, Y0 + H * 0.8, 0.6, ROOF.barracks, Math.PI / 2);
  }
  return k.build();
}

/** Trường bắn: mái che hở một bên, và hai tấm bia rơm ngoài bãi. */
function archery(level: number): THREE.BufferGeometry {
  const k = new Kit();
  nen(k, 2.3);
  const st = stage('archery', level);
  const H = 1.0 + level * 0.03;
  // Nhà hở: chỉ có vách sau và bốn cột, nên nhìn xuyên qua được — khác hẳn doanh trại kín.
  k.rbox(2.6, H, 0.18, 0.06, 0.03, 0, Y0, -0.95, PALETTE.wall);
  for (const x of [-1.2, 1.2]) {
    for (const z of [-0.9, 0.35]) k.cyl(0.09, 0.09, H, 6, x, Y0, z, WOOD);
  }
  k.gable(2.8, 1.5, 0.55, 0.2, 0, Y0 + H, -0.3, ROOF.archery);
  // Giá cung dựa vách sau.
  for (const x of [-0.6, 0.6]) {
    k.box(0.07, 0.75, 0.07, x, Y0, -0.78, WOOD);
    k.box(0.5, 0.06, 0.06, x, Y0 + 0.75, -0.78, WOOD);
  }
  // Bia rơm: trụ tròn vàng, mặt đỏ quay về phía nhà.
  const bia = (x: number, z: number) => {
    k.cyl(0.42, 0.42, 0.16, 12, x, Y0 + 0.5, z, PALETTE.wheat);
    k.disc(0.2, x, Y0 + 0.58, z + 0.1, ROOF.barracks);
    for (const dx of [-0.3, 0.3]) k.cyl(0.06, 0.06, 0.55, 5, x + dx, Y0, z, WOOD);
  };
  bia(-0.7, 1.35);
  if (st >= 1) bia(0.75, 1.35);
  if (st >= 2) bia(0.05, 1.95);
  return k.build();
}

/** Chuồng ngựa: nhà kho thấp, và một bãi quây rào. */
function stable(level: number): THREE.BufferGeometry {
  const k = new Kit();
  nen(k, 2.6);
  const st = stage('stable', level);
  const H = 1.2 + level * 0.05;
  k.rbox(2.4, H, 1.8, 0.12, 0.05, -0.5, Y0, -0.5, PALETTE.wall);
  k.gable(2.4, 1.8, 0.75, 0.16, -0.5, Y0 + H, -0.5, ROOF.stable);
  // Hai cánh cửa chuồng mở ra hai bên.
  for (const x of [-0.95, -0.05]) k.box(0.42, 0.9, 0.06, x, Y0, 0.42, WOOD);
  // Máng cỏ.
  k.rbox(0.9, 0.22, 0.35, 0.06, 0.03, 1.1, Y0, -1.1, WOOD);
  k.box(0.75, 0.12, 0.25, 1.1, Y0 + 0.22, -1.1, PALETTE.wheat);
  // Hàng rào quây bãi: cọc và hai thanh ngang, chừa một lối vào.
  const coc: [number, number][] = [[0.6, 1.5], [1.6, 1.2], [2.1, 0.3], [1.9, -0.7]];
  for (const [x, z] of coc) k.cyl(0.08, 0.08, 0.62, 5, x, Y0, z, WOOD);
  for (let i = 0; i < coc.length - 1; i += 1) {
    const [x0, z0] = coc[i];
    const [x1, z1] = coc[i + 1];
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.BoxGeometry(len, 0.08, 0.07);
    g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
    g.translate(mx, Y0 + 0.42, mz);
    k.raw(g, WOOD);
  }
  if (st >= 1) k.rbox(1.0, 0.8, 0.9, 0.08, 0.04, -1.9, Y0, 0.5, PALETTE.wall);
  if (st >= 2) k.gable(1.0, 0.9, 0.4, 0.1, -1.9, Y0 + 0.8, 0.5, ROOF.stable, Math.PI / 2);
  return k.build();
}

/** Lò rèn: nhà nhỏ, một ống khói to, và cái đe ngoài sân. */
function smithy(level: number): THREE.BufferGeometry {
  const k = new Kit();
  nen(k, 1.9);
  const st = stage('smithy', level);
  k.rbox(1.9, 1.15, 1.6, 0.1, 0.05, -0.15, Y0, -0.2, PALETTE.wall);
  k.gable(1.9, 1.6, 0.6, 0.14, -0.15, Y0 + 1.15, -0.2, ROOF.smithy);
  // Ống khói đá to quá cỡ: đó là thứ nhận ra lò rèn từ xa.
  k.rbox(0.55, 2.1, 0.55, 0.06, 0.03, 0.72, Y0, -0.75, STONE);
  k.rbox(0.68, 0.18, 0.68, 0.06, 0.03, 0.72, Y0 + 2.1, -0.75, STONE_DARK);
  // Miệng lò đỏ lửa.
  k.box(0.46, 0.38, 0.06, -0.15, Y0 + 0.12, 0.6, st >= 1 ? GOLD : WOOD);
  // Cái đe trên một khúc gỗ.
  k.cyl(0.22, 0.26, 0.3, 8, 0.95, Y0, 0.72, WOOD);
  k.rbox(0.5, 0.16, 0.26, 0.05, 0.03, 0.95, Y0 + 0.3, 0.72, STONE_DARK);
  if (st >= 2) {
    // Giá treo đồ rèn xong.
    for (const z of [-0.95, -0.15]) k.cyl(0.06, 0.06, 0.9, 5, -1.35, Y0, z, WOOD);
    k.box(0.07, 0.07, 0.9, -1.35, Y0 + 0.9, -0.55, WOOD);
  }
  return k.build();
}

/**
 * Hình của một công trình. `co` là màu cờ của người chơi, chỉ thủ phủ dùng tới.
 *
 * Màu cờ nằm trong KHOÁ bộ nhớ đệm chứ không tô sau: cả công trình là một khối đã hàn với
 * màu nằm ở từng đỉnh, nên đổi màu một bộ phận là phải hàn lại. Người chơi đổi cờ mấy lần
 * trong một ván, nên đệm thừa vài hình không đáng kể.
 */
export function buildingGeometry(type: BuildingType, level: number, co = 0,
  kieu = 0): THREE.BufferGeometry {
  const key = type === 'townhall' ? `townhall:${level}:${co}`
    : type === 'house' ? `house:${level}:${kieu}` : `${type}:${level}`;
  let g = CACHE.get(key);
  if (!g) {
    // Bảng thay cho chuỗi ba ngôi: chín loại rồi, và trình biên dịch tự bắt khi thiếu một.
    const lam: Record<BuildingType, () => THREE.BufferGeometry> = {
      house: () => house(level, kieu),
      townhall: () => townhall(level, co || PALETTE.roofCore),
      granary: () => granary(level),
      watchtower: () => watchtower(level),
      outpost: () => outpost(level),
      barracks: () => barracks(level),
      archery: () => archery(level),
      stable: () => stable(level),
      smithy: () => smithy(level),
      farm: () => farm(level),
      well: () => well(level),
      market: () => market(level),
      lookout: () => lookout(level),
      dock: () => dock(level),
    };
    g = lam[type]();
    // To lên theo diện tích chiếm đất. Nhân một lần lúc dựng rồi đệm lại, nên không ai
    // phải nhớ nhân thêm ở chỗ vẽ — kể cả mô hình mờ lúc ngắm chỗ.
    const s = MODEL_SCALE[type];
    if (s !== 1) g.scale(s, s, s);
    CACHE.set(key, g);
  }
  return g;
}

/** Vật liệu chung của mọi công trình: màu đọc từ đỉnh, nhám như mọi bề mặt khác. */
export function buildingMaterial(): THREE.MeshStandardMaterial {
  // Thớ mịn hơn mặt đất: lát lại mỗi 2,2 đơn vị, mà căn nhà cũng chỉ rộng chừng 2 — nên nó
  // đọc ra là vữa tường và ngói rám, không phải cỏ. Biên độ nhẹ hơn mặt đất, vì tường kem
  // sáng nên cùng một biên độ trên tường trông gấp đôi trên cỏ.
  MAT ??= grain(new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: ROUGHNESS, metalness: METALNESS, flatShading: true,
  }), 2.2, 0.11);
  return MAT;
}
