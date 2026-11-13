/**
 * HÌNH CỦA NĂM BẦY QUÁI: mỗi bầy một dáng con nhỏ và một dáng con trùm.
 *
 * Ở mức phóng của game người chơi đọc BÓNG DÁNG chứ không đọc chi tiết, nên mỗi bầy phải
 * khác nhau ngay ở đường viền: sói thấp và dài, yêu tinh lùn tai vểnh, nhện bè ngang tám
 * chân, xương trắng gầy, thằn lằn có đuôi. Con trùm không chỉ là con nhỏ phóng to — nó có
 * thêm thứ riêng (bờm gai, ngà, dấu đồng hồ cát đỏ, sừng, đôi cánh) để nhìn một cái là biết
 * "đây là con phải hạ".
 *
 * Mọi phần đều là hình CÓ CHỈ SỐ (hộp, trụ, nón, cầu): khối đa diện của three.js không có chỉ
 * số, gộp chung là `han` ném lỗi. Mặt quay về +Z, chân chạm y = 0. Mọi màu đều tô sẵn (không
 * để trắng), nên màu bản của InstancedMesh không nhuộm lên quái.
 */
import * as THREE from 'three';
import { han, paint } from './shapes';

type Add = (g: THREE.BufferGeometry, x: number, y: number, z: number, hex: number) => void;

function bo(): { parts: THREE.BufferGeometry[]; add: Add } {
  const parts: THREE.BufferGeometry[] = [];
  const add: Add = (g, x, y, z, hex) => {
    g.translate(x, y, z);
    parts.push(paint(g, hex));
  };
  return { parts, add };
}

const hop = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const tru = (a: number, b: number, h: number, n = 7) => new THREE.CylinderGeometry(a, b, h, n);
const non = (r: number, h: number, n = 6) => new THREE.ConeGeometry(r, h, n);
const cau = (r: number, a = 10, b = 8) => new THREE.SphereGeometry(r, a, b);
function xoay<T extends THREE.BufferGeometry>(g: T, x: number, y = 0, z = 0): T {
  if (x) g.rotateX(x);
  if (y) g.rotateY(y);
  if (z) g.rotateZ(z);
  return g;
}

const MAT_DO = 0xff4a2a;
const XUONG = 0xe2dac6;

// ------------------------------------------------------------------ sói

function soi(trum: boolean): THREE.BufferGeometry {
  const { parts, add } = bo();
  const long = trum ? 0x3e3a3d : 0x8a847d;
  const toi = trum ? 0x232023 : 0x4a4541;
  add(hop(0.42, 0.38, 0.9), 0, 0.58, 0, long);
  add(hop(0.48, 0.46, 0.38), 0, 0.63, 0.3, long);
  add(hop(0.32, 0.3, 0.34), 0, 0.8, 0.62, long);
  add(hop(0.18, 0.14, 0.26), 0, 0.72, 0.87, toi);
  for (const x of [-0.1, 0.1]) {
    add(non(0.07, 0.17, 4), x, 1.0, 0.56, toi);
    add(hop(0.05, 0.04, 0.02), x * 0.85, 0.85, 0.795, MAT_DO);
  }
  for (const [x, z] of [[-0.14, 0.3], [0.14, 0.3], [-0.14, -0.3], [0.14, -0.3]] as const) {
    add(hop(0.1, 0.42, 0.1), x, 0.21, z, toi);
  }
  add(xoay(hop(0.09, 0.09, 0.44), 0.55), 0, 0.72, -0.6, long);
  if (trum) {
    // Bờm gai xương dọc sống lưng và hàm răng nanh: con đầu đàn.
    for (let i = 0; i < 5; i += 1) {
      add(xoay(non(0.07, 0.3, 4), -0.5), 0, 0.86 - i * 0.015, 0.42 - i * 0.18, XUONG);
    }
    for (const x of [-0.05, 0.05]) add(xoay(non(0.025, 0.09, 4), Math.PI), x, 0.63, 0.97, XUONG);
  }
  return han(parts);
}

// ------------------------------------------------------------------ yêu tinh và gã khổng lồ

function yeuTinh(): THREE.BufferGeometry {
  const { parts, add } = bo();
  const da = 0x7aa64a;
  for (const x of [-0.08, 0.08]) add(tru(0.06, 0.06, 0.3), x, 0.15, 0, 0x4d3a25);
  add(tru(0.16, 0.21, 0.36, 8), 0, 0.46, 0, 0x6b4f2e);
  add(cau(0.2), 0, 0.82, 0.02, da);
  for (const s of [-1, 1]) {
    add(xoay(non(0.06, 0.26, 5), 0, 0, -s * 1.25), s * 0.25, 0.87, 0, da);
    add(hop(0.05, 0.04, 0.02), s * 0.07, 0.87, 0.19, 0xffd23a);
  }
  add(xoay(non(0.04, 0.1, 4), Math.PI / 2), 0, 0.8, 0.23, da);
  add(xoay(tru(0.035, 0.075, 0.6, 6), 0.6), -0.25, 0.55, 0.16, 0x5b3d22);
  return han(parts);
}

function khongLo(): THREE.BufferGeometry {
  const { parts, add } = bo();
  const da = 0x8f9a62;
  for (const x of [-0.17, 0.17]) add(tru(0.12, 0.11, 0.44), x, 0.22, 0, 0x6f7a4a);
  const bung = cau(0.42, 12, 10);
  bung.scale(1, 0.95, 0.9);
  add(bung, 0, 0.8, 0.05, da);
  add(tru(0.37, 0.42, 0.2, 10), 0, 0.5, 0, 0x5a3b26);
  add(hop(0.72, 0.4, 0.44), 0, 1.13, -0.02, da);
  add(cau(0.2), 0, 1.45, 0.12, da);
  for (const s of [-1, 1]) {
    add(non(0.03, 0.13, 4), s * 0.07, 1.38, 0.3, XUONG);
    add(hop(0.05, 0.04, 0.02), s * 0.07, 1.5, 0.3, 0xffd23a);
    add(xoay(tru(0.09, 0.08, 0.62), 0, 0, s * 0.25), s * 0.44, 0.95, 0.05, da);
  }
  add(hop(0.32, 0.12, 0.32), -0.4, 1.33, 0, 0x55575c);
  // Cây chuỳ to bằng cả người, đầu có gai sắt.
  add(xoay(tru(0.06, 0.15, 1.15, 7), 0.9), -0.52, 1.0, 0.38, 0x5b3d22);
  for (const [x, y, z] of [[-0.52, 1.36, 0.86], [-0.42, 1.28, 0.8], [-0.62, 1.28, 0.8]] as const) {
    add(xoay(non(0.04, 0.14, 4), 0.9), x, y, z, 0x55575c);
  }
  return han(parts);
}

// ------------------------------------------------------------------ nhện

function nhen(trum: boolean): THREE.BufferGeometry {
  const { parts, add } = bo();
  const than = trum ? 0x4b2c5e : 0x2e2a35;
  const chan = trum ? 0x2a1834 : 0x1f1c24;
  const bung = cau(0.3, 10, 8);
  bung.scale(1, 0.78, 1.25);
  add(bung, 0, 0.42, -0.26, than);
  add(cau(0.18, 8, 6), 0, 0.38, 0.12, than);
  add(cau(0.12, 8, 6), 0, 0.36, 0.3, than);
  for (const x of [-0.05, 0.05]) add(hop(0.04, 0.04, 0.02), x, 0.42, 0.41, MAT_DO);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      const z = 0.24 - i * 0.14;
      add(xoay(hop(0.34, 0.05, 0.05), 0, s * (0.35 - i * 0.25), -s * 0.65), s * 0.27, 0.5, z, chan);
      add(hop(0.05, 0.44, 0.05), s * 0.47, 0.24, z + (0.1 - i * 0.07), chan);
    }
  }
  if (trum) {
    // Dấu đồng hồ cát đỏ trên lưng và đôi nanh trắng: nhện chúa.
    add(hop(0.13, 0.04, 0.22), 0, 0.66, -0.3, 0xc22a2a);
    add(hop(0.22, 0.04, 0.07), 0, 0.665, -0.3, 0xc22a2a);
    for (const x of [-0.05, 0.05]) add(xoay(non(0.025, 0.12, 4), Math.PI), x, 0.27, 0.38, XUONG);
  }
  return han(parts);
}

// ------------------------------------------------------------------ xương

function xuong(trum: boolean): THREE.BufferGeometry {
  const { parts, add } = bo();
  const mat = trum ? 0x7dff6a : 0x1a1612;
  for (const x of [-0.08, 0.08]) add(tru(0.035, 0.035, 0.42, 5), x, 0.21, 0, XUONG);
  add(hop(0.26, 0.08, 0.12), 0, 0.44, 0, XUONG);
  add(tru(0.03, 0.03, 0.3, 5), 0, 0.6, 0, XUONG);
  add(hop(0.3, 0.26, 0.16), 0, 0.68, 0, XUONG);
  add(cau(0.15, 8, 6), 0, 0.96, 0.02, XUONG);
  for (const x of [-0.05, 0.05]) add(hop(0.05, 0.05, 0.03), x, 0.98, 0.15, mat);
  for (const s of [-1, 1]) add(xoay(tru(0.03, 0.03, 0.4, 5), 0, 0, s * 0.15), s * 0.2, 0.6, 0.04, XUONG);
  if (trum) {
    // Sừng cong và cây chuỳ bằng một khúc xương đùi khổng lồ.
    for (const s of [-1, 1]) add(xoay(non(0.05, 0.3, 5), 0, 0, -s * 0.9), s * 0.18, 1.1, 0, 0x3a352f);
    add(xoay(tru(0.05, 0.1, 0.9, 6), 0.8), -0.28, 0.72, 0.3, XUONG);
    add(cau(0.12, 8, 6), -0.28, 1.0, 0.63, XUONG);
    add(hop(0.42, 0.3, 0.06), 0, 0.62, -0.12, 0x3b2f3f);
  } else {
    add(hop(0.04, 0.5, 0.02), -0.25, 0.64, 0.22, 0x8a8f96);
    add(xoay(tru(0.16, 0.16, 0.04, 10), Math.PI / 2), 0.25, 0.62, 0.12, 0x6b4f2e);
  }
  return han(parts);
}

// ------------------------------------------------------------------ thằn lằn và rồng

function thanLan(): THREE.BufferGeometry {
  const { parts, add } = bo();
  const vay = 0x4f8a5c;
  for (const x of [-0.09, 0.09]) add(tru(0.06, 0.06, 0.34, 5), x, 0.17, 0, 0x3e6e49);
  add(tru(0.14, 0.18, 0.44, 8), 0, 0.52, 0, vay);
  add(hop(0.15, 0.3, 0.04), 0, 0.52, 0.15, 0xc9b77a);
  add(hop(0.2, 0.18, 0.3), 0, 0.86, 0.08, vay);
  add(hop(0.14, 0.1, 0.2), 0, 0.81, 0.3, vay);
  for (const x of [-0.07, 0.07]) add(hop(0.04, 0.04, 0.02), x, 0.9, 0.23, 0xffd94a);
  add(xoay(non(0.09, 0.62, 6), -1.9), 0, 0.34, -0.38, vay);
  const can = xoay(tru(0.026, 0.026, 1.4, 5), 0.28);
  add(can, -0.28, 0.7, 0.1, 0x5b3d22);
  add(xoay(non(0.06, 0.22, 5), 0.28), -0.28, 1.43, 0.31, 0x8a8f96);
  return han(parts);
}

function rong(): THREE.BufferGeometry {
  const { parts, add } = bo();
  const vay = 0xa83a2a;
  add(hop(0.6, 0.55, 1.2), 0, 0.95, 0, vay);
  add(hop(0.5, 0.2, 0.9), 0, 0.72, 0.05, 0xe0a050);
  for (const [x, z] of [[-0.24, 0.38], [0.24, 0.38], [-0.24, -0.38], [0.24, -0.38]] as const) {
    add(tru(0.1, 0.08, 0.72, 6), x, 0.36, z, 0x7a2a20);
  }
  add(xoay(hop(0.26, 0.26, 0.62), -0.7), 0, 1.36, 0.64, vay);
  add(hop(0.32, 0.26, 0.48), 0, 1.62, 0.96, vay);
  add(hop(0.24, 0.12, 0.26), 0, 1.52, 1.22, 0x7a2a20);
  for (const s of [-1, 1]) {
    add(xoay(non(0.05, 0.32, 5), -0.9), s * 0.11, 1.83, 0.82, XUONG);
    add(hop(0.05, 0.04, 0.02), s * 0.11, 1.68, 1.2, 0xffd94a);
    // Đôi cánh: hai tấm màng chếch lên, một tấm lớn một tấm nhỏ cho ra dáng răng cưa.
    add(xoay(hop(1.25, 0.04, 0.72), 0, 0, s * 0.45), s * 0.85, 1.42, -0.05, 0x6e2620);
    add(xoay(hop(0.7, 0.04, 0.42), 0, 0.3 * s, s * 0.7), s * 1.25, 1.82, -0.35, 0x6e2620);
  }
  add(xoay(non(0.16, 1.15, 6), -1.75), 0, 0.85, -1.08, vay);
  return han(parts);
}

const CACHE = new Map<string, THREE.BufferGeometry>();

/** Hình của bầy thứ `i` (theo HORDES), con nhỏ hoặc con trùm. Dựng một lần, dùng mãi. */
export function beastGeometry(i: number, trum: boolean): THREE.BufferGeometry {
  const key = `${i}|${trum ? 1 : 0}`;
  const co = CACHE.get(key);
  if (co) return co;
  let g: THREE.BufferGeometry;
  switch (i) {
    case 0: g = soi(trum); break;
    case 1: g = trum ? khongLo() : yeuTinh(); break;
    case 2: g = nhen(trum); break;
    case 3: g = xuong(trum); break;
    default: g = trum ? rong() : thanLan(); break;
  }
  CACHE.set(key, g);
  return g;
}
