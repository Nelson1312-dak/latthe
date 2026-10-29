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
import { PALETTE } from './config';
import { METALNESS, ROUGHNESS } from './materials';
import { roundedBox } from './shapes';
import type { BuildingType } from './types';

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
};

/** Mặt trên tấm bệ đất — mọi thân công trình đứng lên đây. */
const Y0 = 0.18;

/** Mốc đổi dáng: 0 tới 3 (trạm trung chuyển chỉ tới 2, vì nó tối đa cấp 5). */
function stage(type: BuildingType, level: number): number {
  if (type === 'outpost') return level >= 5 ? 2 : level >= 3 ? 1 : 0;
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
    if (!g) throw new Error('Không hàn được hình công trình');
    return g;
  }
}

/** Tấm bệ đất 3×3 dưới mọi công trình trừ thủ phủ. */
function nen(k: Kit): void {
  k.rbox(3, 0.22, 3, 0.3, 0.05, 0, 0, 0, PALETTE.plotDirt);
}

// ------------------------------------------------------------------ nhà ở

function house(level: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('house', level);
  nen(k);
  const w = 1.9;
  const d = 1.7;
  // Mốc 6 lên hai tầng; trước đó nhà cao thêm từng chút một theo cấp.
  const H = st >= 2 ? 1.95 + level * 0.03 : 1.05 + level * 0.04;
  k.rbox(w, H, d, 0.12, 0.05, 0, Y0, 0, PALETTE.wall);
  k.gable(w, d, 0.95, 0.18, 0, Y0 + H, 0, ROOF.house);
  // Ống khói xuyên sườn mái phía sau.
  k.box(0.28, st >= 3 ? 1.25 : 0.95, 0.28, 0.5, Y0 + H + 0.15, -0.38, STONE);
  // Mặt trước: cửa chính giữa, cửa sổ hai bên.
  k.box(0.42, 0.72, 0.06, 0, Y0, d / 2, WOOD);
  for (const x of [-0.6, 0.6]) k.box(0.34, 0.34, 0.06, x, Y0 + 0.36, d / 2, GLASS);
  // Mặt bên +X.
  k.box(0.06, 0.34, 0.34, w / 2, Y0 + 0.36, 0.2, GLASS);
  if (st >= 2) {
    for (const x of [-0.6, 0, 0.6]) k.box(0.32, 0.32, 0.06, x, Y0 + 1.25, d / 2, GLASS);
    k.box(0.06, 0.32, 0.32, w / 2, Y0 + 1.25, 0.2, GLASS);
  }
  if (st >= 1) {
    // Hiên: mái nhỏ trên cửa, hai cột gỗ, và bồn hoa dưới cửa sổ.
    k.gable(0.9, 0.5, 0.28, 0.05, 0, Y0 + 0.82, d / 2 + 0.28, ROOF.house);
    for (const x of [-0.38, 0.38]) k.box(0.07, 0.82, 0.07, x, Y0, d / 2 + 0.48, WOOD);
    for (const x of [-0.6, 0.6]) k.box(0.4, 0.1, 0.12, x, Y0 + 0.3, d / 2 + 0.05, PALETTE.berry);
  }
  if (st >= 3) {
    // Cửa sổ mái nhô ra ở sườn trước.
    k.box(0.5, 0.45, 0.5, -0.45, Y0 + H + 0.15, 0.35, PALETTE.wall);
    k.gable(0.5, 0.5, 0.3, 0.06, -0.45, Y0 + H + 0.6, 0.35, ROOF.house, Math.PI / 2);
    k.box(0.26, 0.24, 0.06, -0.45, Y0 + H + 0.25, 0.6, GLASS);
  }
  return k.build();
}

// ------------------------------------------------------------------ thủ phủ

function townhall(level: number): THREE.BufferGeometry {
  const k = new Kit();
  const st = stage('townhall', level);
  // Bệ lục giác, xoay 30° cho khớp với lưới ô — thủ phủ ngồi đúng trên một ô.
  k.cyl(2, 2, 0.4, 6, 0, 0, 0, STONE_DARK, Math.PI / 6);
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
  k.box(0.55, 0.32, 0.03, 0.3, y0 + Ht + 1.45, zt, st >= 3 ? GOLD : ROOF.townhall);
  if (st >= 1) {
    // Mặt đồng hồ trên tháp và hai dải băng đỏ trên mặt tiền.
    k.disc(0.27, 0, y0 + Ht - 0.5, zt + 0.47, PALETTE.wall);
    k.disc(0.05, 0, y0 + Ht - 0.5, zt + 0.5, WOOD);
    for (const x of [-0.85, 0.85]) k.box(0.24, 0.62, 0.03, x, y0 + H - 0.75, zb + d / 2 + 0.02, ROOF.townhall);
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
  nen(k);
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
  nen(k);
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

// ------------------------------------------------------------------ bộ nhớ đệm

const CACHE = new Map<string, THREE.BufferGeometry>();
let MAT: THREE.MeshStandardMaterial | null = null;

/** Hình học của một công trình ở một cấp. Dựng một lần, dùng lại cho mọi công trình giống nó. */
export function buildingGeometry(type: BuildingType, level: number): THREE.BufferGeometry {
  const key = `${type}:${level}`;
  let g = CACHE.get(key);
  if (!g) {
    g = type === 'house' ? house(level)
      : type === 'townhall' ? townhall(level)
        : type === 'granary' ? granary(level)
          : outpost(level);
    CACHE.set(key, g);
  }
  return g;
}

/** Vật liệu chung của mọi công trình: màu đọc từ đỉnh, nhám như mọi bề mặt khác. */
export function buildingMaterial(): THREE.MeshStandardMaterial {
  MAT ??= new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: ROUGHNESS, metalness: METALNESS, flatShading: true,
  });
  return MAT;
}
