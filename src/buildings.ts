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
  // Tím than: màu duy nhất trong làng không có trong tự nhiên, nên tháp phép đọc ra là
  // "chỗ này có phép" trước cả khi nhìn thấy viên pha lê.
  magetower: 0x5b4a8a,
  // Xám khói: xưởng là nơi có lửa và sắt, cùng họ với lò rèn nhưng nhạt hơn một bậc.
  workshop: 0x5a5148,
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

/** Đất nện dưới chân — đúng màu vệt đất nện ground.ts vẽ quanh công trình. */
const DAT_NEN = 0x84705a;

/** Mặt trên tấm bệ đất — mọi thân công trình đứng lên đây. */
const Y0 = 0.18;

/** Mốc đổi dáng: 0 tới 3 (trạm trung chuyển chỉ tới 2, vì nó tối đa cấp 5). */
function stage(type: BuildingType, level: number): number {
  if (type === 'smithy') return level >= 3 ? 2 : level >= 2 ? 1 : 0;
  if (type === 'outpost' || type === 'watchtower' || type === 'stable' || type === 'farm'
    || type === 'well' || type === 'market' || type === 'lookout' || type === 'dock'
    || type === 'magetower' || type === 'workshop') {
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

  private push(g: THREE.BufferGeometry, color: number, nguyen = false): void {
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    n.deleteAttribute('uv');
    // Mọi mảnh của mọi công trình đi qua đúng chỗ này, nên đây là nơi duy nhất cần biết
    // làng đang ở thời đại nào — xem `mauDoi`.
    this.c.setHex(nguyen ? color : mauDoi(color));
    const count = n.attributes.position.count;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = this.c.r;
      arr[i * 3 + 1] = this.c.g;
      arr[i * 3 + 2] = this.c.b;
    }
    n.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    // Loại vật liệu cho shader vân (xem `vanVatLieu`): tính từ màu GỐC, trước khi pha theo
    // thời đại, vì cùng một màu tường ở thời Thành Luỹ là đá xây còn thời Công Nghiệp là gạch.
    n.setAttribute('aVl', new THREE.BufferAttribute(new Float32Array(count).fill(nguyen ? 0 : loaiVl(color)), 1));
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

  /**
   * Một tấm mang MÀU CỜ của người chơi. Không đi qua bảng màu thời đại: màu cờ có thể
   * trùng đúng một màu mái, và lá cờ thì không được ngả màu theo thời đại.
   */
  flag(w: number, h: number, d: number, x: number, y: number, z: number, color: number): void {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y + h / 2, z);
    this.push(g, color, true);
  }

  /** Nửa quả cầu úp: mái vòm. `y` là chân vòm. */
  dome(r: number, x: number, y: number, z: number, color: number): void {
    const g = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    g.translate(x, y, z);
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
  // Mô đất thấp, choãi rộng, cùng màu với vệt đất nện vẽ trên mặt đất quanh nó (ground.ts):
  // chân mô chìm vào vệt đất chứ không còn là một cái đĩa nâu tròn đặt trên cỏ.
  k.cyl(r * 0.78, r * 1.5, 1.1, 20, 0, -0.92, 0, DAT_NEN);
  /*
   * Hạ tầng lớn lên theo thời đại, và nó nằm ở ĐÂY vì mọi công trình con đều gọi `nen`:
   * thêm một lần là cả làng đổi. Ruộng và bến thuyền thì không — không ai lát đá ruộng lúa.
   *   - Thời Thành Luỹ: sân lát đá thay cho đất nện.
   *   - Thời Đế Quốc: hai cột đèn lồng trước sân.
   *   - Thời Công Nghiệp: cột đèn sắt cao có bóng sáng, và một viền gạch quanh sân.
   */
  if (DOI < 3 || LOAI === 'farm' || LOAI === 'dock') return;
  k.cyl(r * 0.8, r * 0.87, 0.07, 12, 0, 0.19, 0, DOI >= 5 ? 0x8d8a86 : STONE);
  if (DOI >= 5) k.cyl(r * 0.87, r * 0.9, 0.05, 12, 0, 0.17, 0, 0x9c5a44);
  if (DOI < 4 || LOAI === 'well') return;
  const cao = DOI >= 5 ? 1.25 : 0.8;
  for (const sx of [-1, 1]) {
    const x = sx * r * 0.62;
    const z = r * 0.58;
    k.cyl(0.035, 0.05, cao, 5, x, 0.24, z, STONE_DARK);
    if (DOI >= 5) {
      k.box(0.3, 0.04, 0.04, x, 0.24 + cao, z, STONE_DARK);
      for (const dx of [-0.14, 0.14]) k.box(0.1, 0.12, 0.1, x + dx, 0.24 + cao - 0.14, z, DEN);
    } else {
      k.box(0.14, 0.17, 0.14, x, 0.24 + cao, z, GOLD);
      k.cone(0.13, 0.1, 4, x, 0.24 + cao + 0.17, z, STONE_DARK, Math.PI / 4);
    }
  }
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

// ------------------------------------------------------------------ dáng theo thời đại

/*
 * LÊN ĐỜI THÌ CẢ LÀNG ĐỔI DÁNG.
 *
 * Người chơi đòi: "khi lên đời nhà thì sẽ đổi giao diện (theo theme hiện đại dần dần) và
 * nâng cấp toàn bộ cấu trúc của các nhà con". Mười mấy loại nhà nhân năm thời đại là bảy
 * chục cái hình vẽ tay — không ai giữ nổi. Thay vào đó mỗi thời đại là một BỘ VẬT LIỆU,
 * áp vào chính những hình đang có ở đúng một chỗ (Kit.push):
 *
 *   I   Dựng Làng    tường trát đất, mái rạ, cửa sổ là lỗ tối (chưa có kính)
 *   II  Mở Đất       gỗ và ngói — đúng dáng cũ, không đổi gì
 *   III Thành Luỹ    tường đá xám, ngói sẫm lại, sân lát đá
 *   IV  Đế Quốc      tường vôi trắng, ngói đỏ thắm, đèn lồng vàng
 *   V   Công Nghiệp  tường gạch, mái đá đen, cửa kính sáng, đèn đường
 *
 * Màu mái được PHA về phía màu của thời đại chứ không thay hẳn: mỗi loại nhà vẫn giữ sắc
 * riêng để nhận ra nhau (xem ROOF), chỉ là cả làng ngả về cùng một tông. Riêng thủ phủ thì
 * có năm bóng dáng vẽ tay, vì nó là thứ người chơi nhìn nhiều nhất và là thứ "lên đời".
 */
let DOI = 2;
/** Loại đang dựng — `nen` cần biết để không lát đá ruộng lúa. */
let LOAI: BuildingType = 'house';
/** Bóng đèn và cửa sổ sáng đèn của thời đại năm. */
const DEN = 0xfff0b8;

interface BoMau { tuong: number; mai: number; pha: number; kinh: number }
const BO_MAU: Record<number, BoMau> = {
  // Rạ thật ngả vàng xám, không cam: pha gần hết về màu rơm để mái nào cũng đọc ra là rạ.
  1: { tuong: 0xd2b88c, mai: 0xb59a5c, pha: 0.84, kinh: 0x4a3d31 },
  3: { tuong: 0xd4cfc2, mai: 0x7a4636, pha: 0.28, kinh: GLASS },
  4: { tuong: 0xf4efe3, mai: 0xa02f2c, pha: 0.36, kinh: 0x3f5a78 },
  5: { tuong: 0xb3654c, mai: 0x3b3f47, pha: 0.6, kinh: 0x9fd2e6 },
};
const LA_TUONG = new Set<number>([PALETTE.wall, TUONG_DAT]);
const LA_MAI = new Set<number>([...Object.values(ROOF), MAI_RA, MAI_SAM]
  // Đá và vàng cũng được dùng làm mái (chòi canh, chóp tháp cấp cao), nhưng chúng là đá và
  // vàng ở mọi thời đại.
  .filter((m) => m !== STONE_DARK && m !== GOLD));
const TAM_A = new THREE.Color();
const TAM_B = new THREE.Color();

/*
 * LOẠI VẬT LIỆU — mỗi đỉnh mang một con số, shader vẽ vân theo nó:
 *   0 trơn · 1 tường trát có khung gỗ · 2 ngói · 3 rạ · 4 ván gỗ · 5 đá xây · 6 gạch
 *   7 kính · 8 đất nện
 * Trước đây mọi mặt chỉ là MỘT màu phẳng cộng chút nhiễu, nên ngôi nhà đọc ra là đồ nhựa
 * đúc: không có viên ngói, không có thớ gỗ, không có mạch vữa. Vẽ bằng hình học thì mỗi
 * viên ngói là mười hai tam giác; vẽ trong shader thì không tốn thêm đỉnh nào.
 */
function loaiVl(hex: number): number {
  if (hex === GLASS) return 7;
  if (LA_TUONG.has(hex)) return DOI === 3 ? 5 : DOI >= 5 ? 6 : 1;
  if (hex === MAI_RA || (DOI === 1 && LA_MAI.has(hex))) return 3;
  if (LA_MAI.has(hex)) return 2;
  if (hex === WOOD) return 4;
  if (hex === STONE || hex === STONE_DARK) return 5;
  if (hex === PALETTE.plotDirt || hex === DAT_NEN) return 8;
  return 0;
}

/** Màu của một mảnh ở thời đại đang dựng. Thời đại hai trả lại đúng màu gốc. */
function mauDoi(hex: number): number {
  const bo = BO_MAU[DOI];
  if (!bo) return hex;
  if (hex === GLASS) return bo.kinh;
  if (LA_TUONG.has(hex)) return bo.tuong;
  if (LA_MAI.has(hex)) return TAM_A.setHex(hex).lerp(TAM_B.setHex(bo.mai), bo.pha).getHex();
  return hex;
}

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

/*
 * NĂM THỦ PHỦ.
 *
 * Mỗi thời đại một bóng dáng khác hẳn, vì thủ phủ là thứ duy nhất trên bản đồ nói "làng
 * này đang ở đời nào" mà không cần mở bảng: nhà dài mái rạ có rào cọc, hội quán gỗ có tháp
 * chuông, pháo đài đá bốn tháp góc, cung điện mái vòm vàng, toà thị chính gạch có tháp
 * đồng hồ. Cả năm cùng đứng trên một cái kè tròn bán kính 2,5 và cùng mang lá cờ màu người
 * chơi ở điểm cao nhất, nên diện tích chiếm đất và chỗ tìm lá cờ không bao giờ đổi.
 */
function townhall(level: number, co: number): THREE.BufferGeometry {
  if (DOI <= 1) return townhall1(level, co);
  if (DOI === 3) return townhall3(level, co);
  if (DOI === 4) return townhall4(level, co);
  if (DOI >= 5) return townhall5(level, co);
  return townhall2(level, co);
}

/** Thời Dựng Làng: nhà dài của trưởng làng, mái rạ dốc, rào cọc nhọn quây phía sau. */
function townhall1(level: number, co: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('townhall', level);
  // Nền đất nện chứ chưa phải kè đá: làng này chưa biết xẻ đá.
  k.cyl(2.5, 3.6, 1.3, 24, 0, -1.0, 0, DAT_NEN);
  const y0 = 0.3;
  const w = 3.0;
  const d = 1.9;
  const zb = -0.35;
  const H = 0.95 + level * 0.04;
  k.rbox(w, H, d, 0.16, 0.05, 0, y0, zb, PALETTE.wall);
  k.gable(w, d, 1.6, 0.34, 0, y0 + H - 0.05, zb, ROOF.townhall);
  // Hai cặp kèo bắt chéo nhô khỏi nóc ở hai đầu hồi — cái sừng của nhà dài.
  for (const sx of [-1, 1]) {
    for (const nghieng of [-0.5, 0.5]) {
      const keo = new THREE.CylinderGeometry(0.035, 0.035, 0.8, 4);
      keo.rotateX(nghieng);
      keo.translate(sx * (w / 2 + 0.3), y0 + H + 1.72, zb);
      k.raw(keo, WOOD);
    }
  }
  k.box(0.62, 0.8, 0.06, 0, y0, zb + d / 2, WOOD);
  // Hiên trước: hai cột và một tấm mái rạ.
  for (const x of [-0.6, 0.6]) k.cyl(0.06, 0.06, 0.95, 5, x, y0, zb + d / 2 + 0.55, WOOD);
  k.box(1.6, 0.09, 0.8, 0, y0 + 0.95, zb + d / 2 + 0.3, ROOF.townhall);
  // Rào cọc nhọn quây nửa sau.
  for (let i = 0; i <= 12; i += 1) {
    const a = Math.PI + 0.22 + (i / 12) * (Math.PI - 0.44);
    const x = Math.cos(a) * 2.32;
    const z = Math.sin(a) * 2.32;
    const cao = 0.8 + (i % 2) * 0.16;
    k.cyl(0.07, 0.09, cao, 5, x, y0 - 0.05, z, WOOD);
    k.cone(0.08, 0.2, 5, x, y0 - 0.05 + cao, z, WOOD);
  }
  // Cột cờ trước sân, cao hơn nóc nhà.
  k.cyl(0.05, 0.06, 3.1, 5, 1.55, y0, 1.25, WOOD);
  k.flag(0.62, 0.38, 0.03, 1.88, y0 + 2.62, 1.25, co);
  // Bếp lửa chung của làng.
  k.cyl(0.3, 0.34, 0.1, 7, -1.35, y0, 1.3, STONE_DARK);
  k.cone(0.2, 0.44, 5, -1.35, y0 + 0.1, 1.3, GOLD);
  if (st >= 1) {
    // Chòi kho tròn bên hông.
    k.cyl(0.5, 0.56, 0.7, 8, -1.95, y0, 0.25, PALETTE.wall);
    k.cone(0.74, 0.8, 8, -1.95, y0 + 0.7, 0.25, ROOF.townhall);
  }
  if (st >= 2) {
    // Hai cờ đuôi nheo hai bên cửa.
    for (const x of [-1.05, 1.05]) {
      k.cyl(0.035, 0.035, 1.5, 5, x, y0, zb + d / 2 + 0.2, WOOD);
      k.flag(0.03, 0.5, 0.26, x, y0 + 0.95, zb + d / 2 + 0.36, co);
    }
  }
  if (st >= 3) k.cone(0.16, 0.36, 5, 0, y0 + H + 1.55, zb, GOLD);
  return k.build();
}

/** Thời Thành Luỹ: pháo đài đá vuông, bốn tháp góc, một vọng lâu ở giữa. */
function townhall3(level: number, co: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('townhall', level);
  k.cyl(2.5, 3.2, 1.3, 24, 0, -1.0, 0, STONE_DARK);
  const y0 = 0.3;
  const w = 2.7;
  const zb = -0.15;
  const H = 1.55 + level * 0.05;
  k.rbox(w, H, w, 0.06, 0.03, 0, y0, zb, PALETTE.wall);
  // Lỗ châu mai chạy quanh bốn mặt tường.
  for (let i = -2; i <= 2; i += 1) {
    const t = i * 0.42;
    k.box(0.22, 0.24, 0.2, t, y0 + H, zb + w / 2 - 0.1, PALETTE.wall);
    k.box(0.22, 0.24, 0.2, t, y0 + H, zb - w / 2 + 0.1, PALETTE.wall);
    k.box(0.2, 0.24, 0.22, w / 2 - 0.1, y0 + H, zb + t, PALETTE.wall);
    k.box(0.2, 0.24, 0.22, -w / 2 + 0.1, y0 + H, zb + t, PALETTE.wall);
  }
  // Bốn tháp góc tròn, mái chóp.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - 0.05);
      const z = zb + sz * (w / 2 - 0.05);
      k.cyl(0.42, 0.47, H + 0.7, 8, x, y0, z, PALETTE.wall);
      k.cyl(0.52, 0.42, 0.16, 8, x, y0 + H + 0.7, z, STONE);
      k.cone(0.54, 0.8, 8, x, y0 + H + 0.86, z, st >= 2 && sz > 0 ? GOLD : ROOF.townhall);
      k.box(0.1, 0.3, 0.05, x, y0 + H + 0.1, z + sz * 0.45, GLASS);
    }
  }
  // Vọng lâu giữa: cao hơn hẳn, để pháo đài có một đỉnh.
  const zv = zb - 0.25;
  const Hv = H + 1.5 + level * 0.06;
  k.rbox(1.3, Hv, 1.3, 0.05, 0.03, 0, y0, zv, PALETTE.wall);
  k.box(1.5, 0.16, 1.5, 0, y0 + Hv, zv, STONE);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) k.box(0.24, 0.22, 0.24, sx * 0.63, y0 + Hv + 0.16, zv + sz * 0.63, STONE);
  }
  k.cone(0.9, 1.05, 4, 0, y0 + Hv + 0.16, zv, st >= 3 ? GOLD : ROOF.townhall, Math.PI / 4);
  for (const y of [0.45, 1.0]) k.box(0.16, 0.36, 0.05, 0, y0 + H + y, zv + 0.65, GLASS);
  k.cyl(0.035, 0.035, 1.0, 5, 0, y0 + Hv + 1.1, zv, WOOD);
  k.flag(0.6, 0.36, 0.03, 0.32, y0 + Hv + 1.7, zv, co);
  // Cổng thành nhô ra phía trước, có bậc đá.
  const zc = zb + w / 2;
  k.rbox(1.3, H * 0.86, 0.5, 0.05, 0.03, 0, y0, zc + 0.2, PALETTE.wall);
  for (const x of [-0.45, 0, 0.45]) k.box(0.2, 0.2, 0.2, x, y0 + H * 0.86, zc + 0.3, PALETTE.wall);
  k.box(0.72, 0.95, 0.06, 0, y0, zc + 0.45, WOOD);
  k.box(0.86, 0.1, 0.1, 0, y0 + 0.95, zc + 0.46, STONE);
  k.box(1.1, 0.1, 0.34, 0, y0 - 0.02, zc + 0.62, STONE);
  if (st >= 1) {
    // Hai dải băng màu cờ treo hai bên cổng.
    for (const x of [-0.95, 0.95]) k.flag(0.26, 0.74, 0.03, x, y0 + H - 0.95, zc + 0.02, co);
  }
  return k.build();
}

/** Thời Đế Quốc: cung điện vôi trắng, mái vòm vàng, hàng cột và bậc thềm. */
function townhall4(level: number, co: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('townhall', level);
  k.cyl(2.5, 3.2, 1.3, 24, 0, -1.0, 0, STONE);
  const y0 = 0.3;
  // Bệ thềm: cả cung điện đứng cao hơn sân một bậc.
  k.rbox(4.1, 0.22, 2.7, 0.05, 0.03, 0, y0, -0.1, STONE);
  const y1 = y0 + 0.22;
  const zb = -0.3;
  const Hc = 1.85 + level * 0.05;
  k.rbox(2.0, Hc, 1.9, 0.07, 0.03, 0, y1, zb, PALETTE.wall);
  k.box(2.16, 0.12, 2.06, 0, y1 + Hc, zb, GOLD);
  // Trống mái và mái vòm.
  k.cyl(0.78, 0.82, 0.42, 12, 0, y1 + Hc + 0.12, zb, PALETTE.wall);
  const yv = y1 + Hc + 0.54;
  k.dome(0.84, 0, yv, zb, GOLD);
  k.cyl(0.13, 0.16, 0.26, 8, 0, yv + 0.8, zb, PALETTE.wall);
  k.cone(0.17, 0.62, 8, 0, yv + 1.06, zb, GOLD);
  k.cyl(0.03, 0.03, 0.9, 5, 0, yv + 1.6, zb, WOOD);
  k.flag(0.6, 0.36, 0.03, 0.32, yv + 2.1, zb, co);
  // Hai cánh nhà, mái bốn mái.
  const Hw = 1.25 + level * 0.03;
  for (const sx of [-1, 1]) {
    const x = sx * 1.5;
    k.rbox(1.1, Hw, 1.5, 0.06, 0.03, x, y1, zb, PALETTE.wall);
    k.box(1.2, 0.08, 1.6, x, y1 + Hw, zb, GOLD);
    k.cone(0.98, 0.72, 4, x, y1 + Hw + 0.08, zb, ROOF.townhall, Math.PI / 4);
    for (const dx of [-0.3, 0.3]) k.box(0.2, 0.52, 0.05, x + dx, y1 + 0.4, zb + 0.75, GLASS);
    k.flag(0.18, 0.62, 0.03, x, y1 + Hw - 0.78, zb + 0.77, co);
    k.box(0.05, 0.52, 0.22, sx * 2.05, y1 + 0.4, zb, GLASS);
    // Tháp mảnh ở góc sau mỗi cánh.
    k.cyl(0.25, 0.29, Hw + 1.15, 8, sx * 2.0, y1, zb - 0.6, PALETTE.wall);
    k.cone(0.36, 0.95, 8, sx * 2.0, y1 + Hw + 1.15, zb - 0.6, ROOF.townhall);
    if (st >= 1) k.cone(0.09, 0.3, 6, x, y1 + Hw + 0.78, zb, GOLD);
    if (st >= 3) k.dome(0.2, sx * 2.0, y1 + Hw + 2.05, zb - 0.6, GOLD);
  }
  // Hàng hiên bốn cột, có trán tường.
  const zh = zb + 0.95;
  for (const x of [-0.75, -0.26, 0.26, 0.75]) k.cyl(0.085, 0.1, 1.25, 8, x, y1, zh + 0.34, PALETTE.cloud);
  k.box(1.9, 0.12, 0.6, 0, y1 + 1.25, zh + 0.22, PALETTE.cloud);
  k.gable(0.6, 1.9, 0.46, 0.03, 0, y1 + 1.37, zh + 0.22, ROOF.townhall, Math.PI / 2);
  k.box(0.62, 0.98, 0.06, 0, y1, zh, WOOD);
  k.box(0.74, 0.08, 0.08, 0, y1 + 0.98, zh + 0.01, GOLD);
  // Ba bậc thềm đổ xuống sân.
  for (let i = 0; i < 3; i += 1) k.box(1.7, 0.22 - i * 0.073, 0.2, 0, y0, 1.35 + i * 0.2, STONE);
  if (st >= 2) {
    // Hai chậu lửa vàng hai bên bậc thềm.
    for (const x of [-1.15, 1.15]) {
      k.cyl(0.14, 0.1, 0.5, 6, x, y0, 1.6, STONE);
      k.cone(0.13, 0.3, 5, x, y0 + 0.5, 1.6, GOLD);
    }
  }
  return k.build();
}

/** Thời Công Nghiệp: toà thị chính gạch, tháp đồng hồ mái vòm đồng, ống khói và đèn đường. */
function townhall5(level: number, co: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('townhall', level);
  k.cyl(2.5, 3.2, 1.3, 24, 0, -1.0, 0, STONE_DARK);
  const y0 = 0.3;
  k.rbox(4.2, 0.2, 2.7, 0.04, 0.02, 0, y0, -0.1, 0x8d8a86);
  const y1 = y0 + 0.2;
  const zb = -0.35;
  const Hm = 1.7 + level * 0.04;
  k.rbox(3.8, Hm, 1.9, 0.04, 0.02, 0, y1, zb, PALETTE.wall);
  k.box(3.86, 0.16, 1.96, 0, y1, zb, 0x8d8a86);
  k.box(3.94, 0.14, 2.04, 0, y1 + Hm, zb, PALETTE.cloud);
  k.box(3.6, 0.1, 1.7, 0, y1 + Hm + 0.14, zb, ROOF.townhall);
  // Cửa sổ cao sáng đèn dọc mặt tiền và hai đầu hồi.
  const zf = zb + 0.95;
  for (const x of [-1.62, -1.24, 1.24, 1.62]) {
    k.box(0.24, 0.98, 0.05, x, y1 + 0.38, zf, GLASS);
    k.box(0.3, 0.06, 0.07, x, y1 + 0.32, zf, PALETTE.cloud);
  }
  for (const sx of [-1, 1]) {
    for (const z of [-0.55, 0, 0.55]) k.box(0.05, 0.98, 0.24, sx * 1.9, y1 + 0.38, zb + z, GLASS);
  }
  // Hàng hiên cột đá giữa mặt tiền.
  for (const x of [-0.78, -0.28, 0.28, 0.78]) k.cyl(0.08, 0.09, Hm - 0.12, 8, x, y1, zf + 0.36, PALETTE.cloud);
  k.box(1.96, 0.14, 0.56, 0, y1 + Hm - 0.12, zf + 0.22, PALETTE.cloud);
  k.gable(0.56, 1.96, 0.42, 0.02, 0, y1 + Hm + 0.02, zf + 0.22, PALETTE.cloud, Math.PI / 2);
  k.box(0.72, 1.02, 0.05, 0, y1, zf, WOOD);
  k.box(0.26, 0.3, 0.06, 0, y1 + 1.1, zf, DEN);
  for (let i = 0; i < 2; i += 1) k.box(2.0, 0.2 - i * 0.1, 0.22, 0, y0, 1.36 + i * 0.22, 0x8d8a86);
  // Tháp đồng hồ mọc lên từ giữa toà nhà.
  const zt = zb - 0.1;
  const Ht = Hm + 2.0 + level * 0.06;
  k.rbox(1.0, Ht, 1.0, 0.03, 0.02, 0, y1, zt, PALETTE.wall);
  k.box(1.14, 0.1, 1.14, 0, y1 + Ht, zt, PALETTE.cloud);
  k.box(1.08, 0.08, 1.08, 0, y1 + Hm + 0.5, zt, PALETTE.cloud);
  k.disc(0.33, 0, y1 + Ht - 0.5, zt + 0.52, st >= 3 ? GOLD : STONE_DARK);
  k.disc(0.28, 0, y1 + Ht - 0.5, zt + 0.54, PALETTE.cloud);
  k.box(0.035, 0.22, 0.02, 0, y1 + Ht - 0.5, zt + 0.58, STONE_DARK);
  k.box(0.16, 0.035, 0.02, 0.07, y1 + Ht - 0.52, zt + 0.58, STONE_DARK);
  // Mái vòm đồng đã lên gỉ xanh.
  k.dome(0.5, 0, y1 + Ht + 0.1, zt, 0x5fa08a);
  k.cyl(0.08, 0.1, 0.22, 6, 0, y1 + Ht + 0.58, zt, PALETTE.cloud);
  k.cone(0.1, 0.5, 6, 0, y1 + Ht + 0.8, zt, GOLD);
  k.cyl(0.03, 0.03, 0.8, 5, 0, y1 + Ht + 1.25, zt, STONE_DARK);
  k.flag(0.6, 0.36, 0.03, 0.32, y1 + Ht + 1.66, zt, co);
  // Dải băng màu cờ thả dọc thân tháp, dưới mặt đồng hồ.
  k.flag(0.3, 0.8, 0.03, 0, y1 + Hm + 0.7, zt + 0.52, co);
  // Hai ống khói gạch ở góc sau, và hai giếng trời kính trên mái.
  for (const sx of [-1, 1]) {
    k.box(0.3, Hm + 1.0, 0.3, sx * 1.55, y1, zb - 0.65, PALETTE.wall);
    k.box(0.38, 0.1, 0.38, sx * 1.55, y1 + Hm + 1.0, zb - 0.65, STONE_DARK);
    k.gable(1.0, 0.72, 0.3, 0, sx * 1.2, y1 + Hm + 0.24, zb + 0.25, GLASS);
    // Đèn đường trước sân.
    k.cyl(0.035, 0.05, 1.2, 5, sx * 1.55, y0, 1.5, STONE_DARK);
    k.box(0.16, 0.16, 0.16, sx * 1.55, y0 + 1.2, 1.5, DEN);
    k.cone(0.14, 0.1, 4, sx * 1.55, y0 + 1.36, 1.5, STONE_DARK, Math.PI / 4);
  }
  if (st >= 1) {
    // Băng rôn hai đầu mặt tiền.
    for (const x of [-0.98, 0.98]) k.flag(0.2, 0.7, 0.03, x, y1 + Hm - 0.95, zf + 0.02, co);
  }
  if (st >= 2) {
    // Bồn nước tròn trước sân.
    k.cyl(0.34, 0.38, 0.14, 10, -1.2, y0, 1.72, 0x8d8a86);
    k.cyl(0.28, 0.28, 0.04, 10, -1.2, y0 + 0.12, 1.72, 0x6fa7c2);
  }
  return k.build();
}

/** Thời Mở Đất: hội quán gỗ có tháp chuông — dáng thủ phủ từ trước khi có thời đại. */
function townhall2(level: number, co: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('townhall', level);
  // Bệ lục giác, xoay 30° cho khớp với lưới ô — thủ phủ ngồi đúng trên một ô.
  // Bệ đá tròn, thụt xuống như mọi bệ khác. Bản cũ là lục giác xoay 30 độ cho khớp
  // lưới ô — mà lưới ô thì không còn.
  // Chân choãi như kè đá, cùng lý do với mô đất ở `nen`: vành dựng đứng là một đồng xu.
  k.cyl(2.5, 3.2, 1.3, 24, 0, -1.0, 0, STONE_DARK);
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
  k.flag(0.55, 0.32, 0.03, 0.3, y0 + Ht + 1.45, zt, co);
  if (st >= 1) {
    // Mặt đồng hồ trên tháp và hai dải băng đỏ trên mặt tiền.
    k.disc(0.27, 0, y0 + Ht - 0.5, zt + 0.47, PALETTE.wall);
    k.disc(0.05, 0, y0 + Ht - 0.5, zt + 0.5, WOOD);
    // Hai dải băng trên mặt tiền cũng theo màu cờ: một lá cờ bé tí trên đỉnh tháp thì ở mức
    // phóng xa không còn thấy, mà màu của mình thì phải thấy được từ xa.
    for (const x of [-0.85, 0.85]) k.flag(0.24, 0.62, 0.03, x, y0 + H - 0.75, zb + d / 2 + 0.02, co);
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

/** Một khẩu pháo dựng sẵn: hai bánh, càng gỗ, nòng sắt chếch lên trời. */
function phao(k: Kit, x: number, z: number): void {
  for (const dx of [-0.3, 0.3]) {
    const banh = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10);
    banh.rotateZ(Math.PI / 2);
    banh.translate(x + dx, Y0 + 0.28, z);
    k.raw(banh, WOOD);
  }
  k.box(0.44, 0.14, 0.8, x, Y0 + 0.2, z - 0.12, WOOD);
  const nong = new THREE.CylinderGeometry(0.1, 0.15, 1.05, 8);
  nong.rotateX(Math.PI / 2 - 0.36);
  nong.translate(x, Y0 + 0.56, z + 0.12);
  k.raw(nong, 0x33343a);
}

/** Tháp phép: tháp đá tròn mái chóp tím, một viên pha lê lơ lửng trên đỉnh. */
function magetower(level: number): THREE.BufferGeometry {
  const k = new Kit();
  nen(k, 1.9);
  const st = stage('magetower', level);
  const H = 2.2 + level * 0.3;
  k.cyl(0.8, 0.98, 0.5, 8, 0, Y0, 0, STONE_DARK);
  k.cyl(0.6, 0.74, H, 8, 0, Y0 + 0.5, 0, PALETTE.wall);
  const yB = Y0 + 0.5 + H;
  // Ban công xoè ra đỡ lấy cái mái chóp rộng hơn thân tháp.
  k.cyl(0.9, 0.64, 0.22, 8, 0, yB, 0, STONE);
  k.cone(0.98, 1.6, 8, 0, yB + 0.22, 0, ROOF.magetower);
  // Viên pha lê KHÔNG chạm mái: khoảng hở ấy chính là cái nói "có phép".
  const tinh = new THREE.OctahedronGeometry(0.22);
  tinh.scale(1, 1.7, 1);
  tinh.translate(0, yB + 2.3, 0);
  k.raw(tinh, 0x9fdcff);
  k.box(0.44, 0.72, 0.06, 0, Y0, 0.9, WOOD);
  // Cửa sổ sáng đèn xoắn dần lên theo thân tháp.
  for (let i = 0; i < 3; i += 1) {
    const a = 0.5 + i * 1.1;
    const g = new THREE.BoxGeometry(0.2, 0.34, 0.06);
    g.translate(0, Y0 + 1.1 + i * (H - 0.6) / 3 + 0.17, 0.7 - i * 0.03);
    g.rotateY(a - 0.5);
    k.raw(g, DEN);
  }
  if (st >= 1) {
    // Ba tinh thể mọc quanh chân tháp.
    for (let i = 0; i < 3; i += 1) {
      const a = 0.9 + i * 2.1;
      k.cone(0.13, 0.56, 5, Math.cos(a) * 1.3, Y0, Math.sin(a) * 1.3, 0x9fdcff);
    }
  }
  if (st >= 2) {
    // Tháp con áp lưng, cũng mái tím.
    k.cyl(0.36, 0.42, H * 0.6, 8, -0.9, Y0, -0.4, PALETTE.wall);
    k.cone(0.52, 0.85, 8, -0.9, Y0 + H * 0.6, -0.4, ROOF.magetower);
  }
  return k.build();
}

/** Xưởng công thành: nhà xưởng cửa mở toang, ống khói gạch, một khẩu pháo dựng trước sân. */
function workshop(level: number): THREE.BufferGeometry {
  const k = new Kit();
  nen(k, 2.8);
  const st = stage('workshop', level);
  const w = 3.0;
  const d = 2.1;
  const zb = -0.5;
  const H = 1.35 + level * 0.05;
  k.rbox(w, H, d, 0.1, 0.04, 0, Y0, zb, PALETTE.wall);
  k.gable(w, d, 0.9, 0.18, 0, Y0 + H, zb, ROOF.workshop);
  // Cửa xưởng: một khoảng tối rộng bằng nửa mặt tiền, đủ cho một cỗ xe lăn ra.
  k.box(1.5, 1.08, 0.06, -0.45, Y0, zb + d / 2, 0x2c2622);
  k.box(1.72, 0.12, 0.1, -0.45, Y0 + 1.08, zb + d / 2 + 0.02, WOOD);
  k.box(0.3, 0.42, 0.06, 0.98, Y0 + 0.5, zb + d / 2, GLASS);
  k.box(0.44, H + 1.5, 0.44, 1.1, Y0, zb - 0.55, 0x8a4a3a);
  k.box(0.54, 0.12, 0.54, 1.1, Y0 + H + 1.5, zb - 0.55, STONE_DARK);
  phao(k, 0.95, 1.35);
  // Chồng đạn bên cạnh pháo.
  for (const [x, z, y] of [[-0.1, 1.5, 0], [0.14, 1.5, 0], [0.02, 1.7, 0], [0.02, 1.57, 0.17]] as const) {
    const dan = new THREE.SphereGeometry(0.12, 6, 5);
    dan.translate(x, Y0 + 0.12 + y, z);
    k.raw(dan, 0x33343a);
  }
  if (st >= 1) {
    // Cần cẩu gỗ để nhấc nòng pháo.
    k.cyl(0.07, 0.08, 2.1, 5, -1.7, Y0, 0.9, WOOD);
    k.box(1.2, 0.09, 0.09, -1.2, Y0 + 2.0, 0.9, WOOD);
    k.box(0.02, 0.7, 0.02, -0.68, Y0 + 1.3, 0.9, STONE_DARK);
  }
  if (st >= 2) phao(k, -1.0, 1.75);
  return k.build();
}

/**
 * Hình của một công trình. `co` là màu cờ của người chơi, chỉ thủ phủ dùng tới.
 * `doi` là thời đại của làng: nó đổi vật liệu của mọi công trình và bóng dáng của thủ phủ.
 *
 * Màu cờ nằm trong KHOÁ bộ nhớ đệm chứ không tô sau: cả công trình là một khối đã hàn với
 * màu nằm ở từng đỉnh, nên đổi màu một bộ phận là phải hàn lại. Người chơi đổi cờ mấy lần
 * trong một ván, nên đệm thừa vài hình không đáng kể.
 */
export function buildingGeometry(type: BuildingType, level: number, co = 0,
  kieu = 0, doi = 2): THREE.BufferGeometry {
  const key = (type === 'townhall' ? `townhall:${level}:${co}`
    : type === 'house' ? `house:${level}:${kieu}` : `${type}:${level}`) + `:${doi}`;
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
      magetower: () => magetower(level),
      workshop: () => workshop(level),
    };
    // Hai biến này chỉ sống trong lúc dựng: mọi hình dựng xong đều nằm trong bộ đệm, khoá
    // theo thời đại, nên không ai đọc chúng ở ngoài hàm này.
    DOI = Math.min(5, Math.max(1, Math.floor(doi)));
    LOAI = type;
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
  MAT ??= vanVatLieu(grain(new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: ROUGHNESS, metalness: METALNESS, flatShading: true,
  }), 2.2, 0.11));
  return MAT;
}

/** Bật/tắt vân vật liệu — bậc đồ hoạ Thấp tắt cho nhẹ máy. */
export const VAN_VL_ON = { value: 1 };

/*
 * Hàm GLSL dùng chung. Mọi khoảng cách tính bằng ĐƠN VỊ THẾ GIỚI trong toạ độ của chính
 * công trình, nên một viên gạch to đúng bằng nhau trên nhà nhỏ lẫn doanh trại.
 *
 * Mỗi mẫu tự PHAI ĐI khi nó nhỏ hơn chừng hai điểm ảnh (đo bằng fwidth): không phai thì
 * lúc thu nhỏ bản đồ, những hàng ngói 0,16 đơn vị thành sọc moiré nhấp nháy khắp làng.
 */
const VL_GLSL = `
float vlHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// Lưới viên xếp so le (gạch, đá, ngói). Trả về (mức mạch vữa 0..1, độ sáng riêng từng viên,
// vị trí dọc trong viên 0..1).
vec3 vlVien(vec2 q, vec2 co, float mach, float fw) {
  float hang = floor(q.y / co.y);
  q.x += mod(hang, 2.0) * co.x * 0.5;
  vec2 o = floor(q / co);
  vec2 f = fract(q / co);
  vec2 kc = min(f, 1.0 - f) * co;
  float m = smoothstep(mach - fw, mach + fw, min(kc.x, kc.y));
  return vec3(m, vlHash(o + hang * 7.31), f.y);
}
`;

/**
 * Lớp bọc shader: vân vật liệu theo `aVl`, cộng một dải bẩn ở chân tường.
 *
 * Dải bẩn là thứ làm công trình ĐỨNG trên đất: ngoài đời chân tường luôn sẫm hơn (bùn bắn,
 * rêu, ít ánh trời), và thiếu nó thì ngôi nhà trông như đặt lên từ trên cao xuống.
 */
function vanVatLieu<T extends THREE.Material>(mat: T): T {
  const khoaTruoc = mat.customProgramCacheKey();
  const truoc = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    truoc?.call(mat, shader, renderer);
    shader.uniforms.uVlOn = VAN_VL_ON;
    shader.vertexShader = 'attribute float aVl;\nvarying float vVl;\nvarying vec3 vVlP;\nvarying vec3 vVlN;\n'
      + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vVl = aVl; vVlP = position; vVlN = normal;`);
    shader.fragmentShader = 'uniform float uVlOn;\nvarying float vVl;\nvarying vec3 vVlP;\nvarying vec3 vVlN;\n'
      + VL_GLSL + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 p = vVlP;
        vec3 n = normalize(vVlN);
        float vl = floor(vVl + 0.5);
        // Trục ngang trên mặt: vuông góc với hướng nằm ngang của pháp tuyến. Mặt đứng, mái
        // dốc, chóp nón đều dùng được; mặt nằm ngang thì lấy thẳng (x, z).
        vec2 nh = n.xz;
        float dai = length(nh);
        float u = dai > 0.2 ? dot(p.xz, vec2(-nh.y, nh.x) / dai) : p.x;
        float v = dai > 0.2 ? p.y : p.z;
        float doc = abs(n.y);
        float fw = max(fwidth(u), fwidth(v));
        float k = 1.0;
        if (uVlOn > 0.5 && vl > 0.5) {
          if (vl < 1.5) {
            // Tường trát: vữa loang nhẹ, và KHUNG GỖ lộ ra — cột mỗi 0,7 đơn vị, một xà ngang
            // sát chân. Chỉ trên mặt đứng: mặt trên của tường là chỗ mái che, không ai thấy.
            float loang = texture2D(uVan, p.xy * 0.9 + p.zz * 0.6).r;
            k = 0.93 + loang * 0.12;
            if (doc < 0.3) {
              float cot = abs(fract(u / 0.7 + 0.5) - 0.5) * 0.7;
              float xa = abs(p.y - 0.26);
              float go = 1.0 - smoothstep(0.035 - fw, 0.035 + fw, min(cot, xa));
              go *= 1.0 - smoothstep(0.12, 0.35, fw);
              k = mix(k, 0.36, go);
            }
          } else if (vl < 2.5) {
            // Ngói: hàng ngang theo độ cao, mỗi hàng sẫm dần về mép dưới (bóng của hàng trên
            // đè lên), mạch đứng so le, viên nào cũng lệch màu một chút.
            vec3 vi = vlVien(vec2(u, v), vec2(0.21, 0.15), 0.012, fw);
            float bong = mix(0.74, 1.06, smoothstep(0.0, 0.8, vi.z));
            float am = (0.94 + vi.y * 0.12) * mix(0.8, 1.0, vi.x) * bong;
            k = mix(1.0, am, 1.0 - smoothstep(0.04, 0.09, fw));
          } else if (vl < 3.5) {
            // Rạ: lớp dày hơn ngói, sợi rơm chạy dọc theo dốc mái.
            float hang = fract(v / 0.24);
            float soi = vlHash(vec2(floor(u * 34.0), floor(v / 0.24)));
            float am = mix(0.72, 1.05, smoothstep(0.0, 0.7, hang)) * (0.9 + soi * 0.18);
            k = mix(1.0, am, 1.0 - smoothstep(0.05, 0.12, fw));
          } else if (vl < 4.5) {
            // Ván gỗ: tấm đứng trên mặt đứng, tấm nằm trên mặt ngang; khe tối giữa hai tấm và
            // thớ gỗ kéo dài theo chiều tấm.
            float q = doc < 0.5 ? u : p.x;
            float dt = doc < 0.5 ? v : p.z;
            float tam = floor(q / 0.17);
            float f = abs(fract(q / 0.17) - 0.5) * 0.17;
            float khe = smoothstep(0.072 - fw, 0.08 + fw, f);
            float tho = texture2D(uVan, vec2(q * 3.0 + tam * 0.37, dt * 0.35)).r;
            float am = (0.86 + vlHash(vec2(tam, 3.1)) * 0.2) * (0.9 + tho * 0.18) * mix(0.62, 1.0, 1.0 - khe);
            k = mix(1.0, am, 1.0 - smoothstep(0.05, 0.1, fw));
          } else if (vl < 6.5) {
            // Đá xây (khối to, lệch màu nhiều) và gạch (viên nhỏ, đều). Mặt trên của từng
            // viên sáng lên một chút — cái gờ bắt nắng làm bức tường có độ nổi.
            bool gach = vl > 5.5;
            vec2 co = gach ? vec2(0.27, 0.115) : vec2(0.46, 0.25);
            vec2 q = doc > 0.7 ? p.xz : vec2(u, v);
            vec3 vi = vlVien(q, co, gach ? 0.014 : 0.022, fw);
            float noi = gach ? 1.0 : mix(0.92, 1.06, smoothstep(0.1, 0.95, vi.z));
            float am = (gach ? 0.9 + vi.y * 0.18 : 0.8 + vi.y * 0.34) * noi;
            am = mix(gach ? 1.18 : 0.55, am, vi.x);
            k = mix(1.0, am, 1.0 - smoothstep(0.06, 0.13, fw));
          } else if (vl < 7.5) {
            // Kính: sáng dần lên trên (bầu trời phản chiếu), có song cửa chữ thập.
            float song = min(abs(fract(u / 0.17 + 0.5) - 0.5) * 0.17, abs(fract(p.y / 0.17 + 0.5) - 0.5) * 0.17);
            k = mix(0.8, 1.25, fract(p.y / 0.34 + 0.15));
            k = mix(k, 1.9, (1.0 - smoothstep(0.012 - fw, 0.012 + fw, song)) * (1.0 - smoothstep(0.03, 0.07, fw)));
          } else {
            // Đất nện: loang to, sỏi lấm tấm.
            float loang = texture2D(uVan, p.xz * 0.35).r;
            float soi = step(0.93, vlHash(floor(p.xz * 9.0)));
            k = (0.86 + loang * 0.24) * (1.0 + soi * 0.25);
          }
        }
        // Chân tường sẫm lại trong nửa đơn vị đầu, mạnh nhất ngay sát đất.
        // Không áp lên đất nện: mô đất nằm dưới mức ấy, sẫm theo thì thành một vành đen.
        if (vl < 7.5) k *= mix(0.62, 1.0, smoothstep(0.15, 0.9, p.y));
        diffuseColor.rgb *= k;
      }`);
  };
  mat.customProgramCacheKey = () => `${khoaTruoc}|vatlieu`;
  return mat;
}
