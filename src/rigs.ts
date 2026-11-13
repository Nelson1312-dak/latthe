/**
 * DÁNG NGƯỜI VÀ DÁNG THÚ: thân, cộng chân (và tay) tách rời để bước đi thật.
 *
 * Bản trước là kiểu chibi: một cái áo trụ chạm đất, một quả đầu to bằng nửa người, không
 * chân không tay — đi tới đâu thì TRƯỢT tới đó như quân cờ. Người chơi muốn "thật real và
 * hợp lý", nên giờ người có tỉ lệ thật (đầu chừng một phần sáu chiều cao), có hông, vai,
 * hai chân, hai tay; lính mặc giáp, cầm vũ khí đúng tay, khiên bên trái; ngựa bốn chân.
 *
 * MỘT BỘ XƯƠNG = thân (một hình hàn, vẽ bằng InstancedMesh như cũ) + MỘT hình chân dùng
 * chung cho mọi chân + danh sách khớp hông. Chân dựng thẳng xuống từ gốc toạ độ (khớp ở
 * y = 0), nên bên vẽ chỉ việc đặt nó vào khớp rồi xoay quanh trục X theo nhịp bước. Không
 * cần xương thật, không cần SkinnedMesh — vẫn một lệnh vẽ cho cả trăm cái chân.
 *
 * Mọi phần đều là hình CÓ CHỈ SỐ (hộp, trụ, nón, cầu, xuyến): khối đa diện của three.js
 * không có chỉ số, hàn chung là `han` ném lỗi. Mặt quay về +Z, chân chạm y = 0. Phần tô
 * `null` là trắng, tức nhận màu bản (màu phe, màu việc) qua `tinted`.
 */
import * as THREE from 'three';
import { PALETTE } from './config';
import { han, paint } from './shapes';

/** Một khớp: toạ độ cục bộ (x, y, z) và độ lệch pha bước (0 hoặc π). */
export type Khop = readonly [number, number, number, number];

export interface Rig {
  body: THREE.BufferGeometry;
  /** Hình một cái chân, khớp ở gốc toạ độ, duỗi xuống −Y. Null là chân đã nằm trong thân. */
  leg: THREE.BufferGeometry | null;
  hips: readonly Khop[];
  /** Góc đưa chân lớn nhất khi đi (radian). */
  amp: number;
  /** Một bước dài chừng này đơn vị CỤC BỘ — bên vẽ nhân với cỡ để chân không trượt. */
  stride: number;
}

// ------------------------------------------------------------------ dụng cụ dựng hình

class Ke {
  readonly parts: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, x: number, y: number, z: number, hex: number | null): this {
    g.translate(x, y, z);
    this.parts.push(paint(g, hex));
    return this;
  }
  /** Thêm một nhóm đã dựng sẵn quanh gốc, xoay quanh X rồi dời tới (x, y, z). */
  nhom(k: Ke, rx: number, x: number, y: number, z: number, ry = 0, rz = 0): this {
    for (const g of k.parts) {
      if (rz) g.rotateZ(rz);
      if (rx) g.rotateX(rx);
      if (ry) g.rotateY(ry);
      g.translate(x, y, z);
      this.parts.push(g);
    }
    return this;
  }
  build(): THREE.BufferGeometry { return han(this.parts); }
}

const hop = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const tru = (a: number, b: number, h: number, n = 8) => new THREE.CylinderGeometry(a, b, h, n);
const non = (r: number, h: number, n = 8) => new THREE.ConeGeometry(r, h, n);
const cau = (r: number, a = 10, b = 8) => new THREE.SphereGeometry(r, a, b);
function xoay<T extends THREE.BufferGeometry>(g: T, x: number, y = 0, z = 0): T {
  if (z) g.rotateZ(z);
  if (x) g.rotateX(x);
  if (y) g.rotateY(y);
  return g;
}
function dep<T extends THREE.BufferGeometry>(g: T, x: number, y: number, z: number): T {
  g.scale(x, y, z);
  return g;
}

// ------------------------------------------------------------------ người

/** Tỉ lệ người: hông, vai, chiều dài tay. Đầu ở 1,16 — chừng một phần sáu chiều cao. */
export const HONG_Y = 0.56;
export const HONG_X = 0.075;
export const VAI_Y = 0.99;
export const VAI_X = 0.2;
export const TAY_DAI = 0.49;

const SAT = 0x8a8f96;
const SAT_TOI = 0x5d6168;
const GO = 0x6b4a2e;
const DA_THUOC = 0x6e4a2c;
const XUONG = 0xe2dac6;

/** Một cái chân người: đùi, cẳng, ủng. Khớp hông ở gốc. */
export function chanNguoi(quan: number, ung: number): THREE.BufferGeometry {
  return new Ke()
    .add(hop(0.12, 0.3, 0.13), 0, -0.15, 0, quan)
    .add(hop(0.1, 0.22, 0.11), 0, -0.4, 0, quan)
    .add(hop(0.11, 0.09, 0.2), 0, -0.515, 0.035, ung)
    .build();
}

/** Một cánh tay buông thẳng: bắp tay, cẳng tay, bàn tay. Khớp vai ở gốc. */
function tay(ao: number | null): Ke {
  return new Ke()
    .add(hop(0.085, 0.25, 0.095), 0, -0.125, 0, ao)
    .add(hop(0.075, 0.21, 0.085), 0, -0.355, 0, ao)
    .add(cau(0.048, 6, 5), 0, -0.49, 0, PALETTE.skin);
}

/** Cánh tay rời cho dân làng (vung khi đi, bổ cuốc khi làm). */
export function tayRoi(): THREE.BufferGeometry {
  return tay(null).build();
}

/** Chỗ bàn tay khi cánh tay ở vai (x) xoay một góc rx quanh trục X. */
function banTay(x: number, rx: number): [number, number, number] {
  return [x, VAI_Y - TAY_DAI * Math.cos(rx), -TAY_DAI * Math.sin(rx)];
}

/**
 * Thân người tới cổ, và cái đầu. `ao` là màu áo (null = nhận màu bản), `that` là thắt lưng.
 * Vạt áo xoè ra phủ đầu đùi, nên chân đưa trước đưa sau trông như bước ra từ dưới áo.
 */
function thanNguoi(k: Ke, ao: number | null, that: number, toc: number | null): void {
  k.add(dep(tru(0.15, 0.2, 0.2, 10), 1, 1, 0.75), 0, 0.6, 0, ao)
    .add(dep(tru(0.19, 0.15, 0.36, 10), 1, 1, 0.68), 0, 0.85, 0, ao)
    .add(dep(cau(0.1, 8, 6), 1.1, 0.7, 1), -0.16, 0.99, 0, ao)
    .add(dep(cau(0.1, 8, 6), 1.1, 0.7, 1), 0.16, 0.99, 0, ao)
    .add(dep(tru(0.155, 0.155, 0.05, 10), 1, 1, 0.72), 0, 0.69, 0, that)
    .add(tru(0.045, 0.05, 0.08, 6), 0, 1.06, 0, PALETTE.skin)
    .add(cau(0.115, 12, 9), 0, 1.16, 0.005, PALETTE.skin)
    .add(hop(0.03, 0.045, 0.035), 0, 1.15, 0.12, PALETTE.skin);
  for (const x of [-0.042, 0.042]) k.add(hop(0.024, 0.022, 0.012), x, 1.18, 0.112, PALETTE.eye);
  if (toc !== null) k.add(dep(cau(0.12, 10, 6), 1, 0.7, 1), 0, 1.21, -0.015, toc);
}

/** Khớp hông người: hai chân ngược pha. */
const HONG_NGUOI: readonly Khop[] = [[-HONG_X, HONG_Y, 0, 0], [HONG_X, HONG_Y, 0, Math.PI]];

// ------------------------------------------------------------------ dân làng

/**
 * Dân làng: áo vải (nhận màu theo việc đang làm, đúng màu trên thanh tài nguyên), thắt lưng
 * da, quần nâu, nón lá rộng vành. Hai tay là lưới riêng (`tayRoi`) để vung và bổ cuốc.
 */
export function danLang(): Rig {
  const k = new Ke();
  thanNguoi(k, null, DA_THUOC, 0x3a2a1e);
  k.add(tru(0.3, 0.3, 0.025, 16), 0, 1.26, 0, PALETTE.hat)
    .add(non(0.22, 0.19, 16), 0, 1.37, 0, PALETTE.hat);
  return { body: k.build(), leg: chanNguoi(0x5a4632, 0x3a2a1e), hips: HONG_NGUOI, amp: 0.55, stride: 0.42 };
}

export const DAN_VAI: readonly (readonly [number, number, number])[] = [[-VAI_X, VAI_Y, 0], [VAI_X, VAI_Y, 0]];
/** Bàn tay ở cuối cánh tay rời, trong hệ của cánh tay. */
export const DAN_TAY: readonly [number, number, number] = [0, -TAY_DAI, 0];

// ------------------------------------------------------------------ lính

const CHAN_LINH = (): THREE.BufferGeometry => chanNguoi(0x4a4038, 0x2e241c);

/** Mũ sắt chóp có mũi che: vành, chỏm, mũi sắt. */
function muSat(k: Ke, y: number): void {
  k.add(dep(cau(0.128, 12, 8), 1, 0.85, 1), 0, y, 0, SAT)
    .add(non(0.07, 0.1, 8), 0, y + 0.12, 0, SAT)
    .add(tru(0.135, 0.135, 0.03, 12), 0, y - 0.035, 0, SAT_TOI)
    .add(hop(0.025, 0.07, 0.02), 0, y - 0.07, 0.125, SAT_TOI);
}

/** Lính giáo: áo giáp xích dưới áo choàng màu phe, khiên tròn tay trái, giáo dài tay phải. */
/** Giáp vai sắt đè lên vai áo — không có nó thì vai áo màu phe đọc ra như hai nắm tay. */
function giapVai(k: Ke): void {
  for (const s of [-1, 1]) k.add(dep(cau(0.115, 8, 6), 1.15, 0.75, 1.05), s * 0.17, 1.0, 0, SAT_TOI);
}

function linhGiao(): Rig {
  const k = new Ke();
  thanNguoi(k, null, DA_THUOC, null);
  k.add(dep(tru(0.2, 0.2, 0.16, 10), 1, 1, 0.7), 0, 0.97, 0, SAT);
  giapVai(k);
  muSat(k, 1.21);
  const rp = -0.75;
  // Tay khiên co sát người: khiên che ngực chứ không chìa ra một sải tay.
  const rt = -0.45;
  k.nhom(tay(SAT), rp, VAI_X, VAI_Y, 0).nhom(tay(SAT), rt, -VAI_X, VAI_Y, 0);
  const [px, py, pz] = banTay(VAI_X, rp);
  k.add(xoay(tru(0.022, 0.022, 2.0, 6), 0.12), px, py + 0.35, pz + 0.04, GO)
    .add(xoay(non(0.045, 0.2, 6), 0.12), px, py + 1.44, pz + 0.17, SAT);
  const [tx, ty, tz] = banTay(-VAI_X, rt);
  k.add(xoay(tru(0.23, 0.23, 0.05, 16), Math.PI / 2), tx + 0.02, ty + 0.16, tz + 0.1, null)
    .add(xoay(tru(0.24, 0.24, 0.035, 16), Math.PI / 2), tx + 0.02, ty + 0.16, tz + 0.075, GO)
    .add(dep(cau(0.06, 8, 6), 1, 1, 0.6), tx + 0.02, ty + 0.16, tz + 0.135, SAT);
  return { body: k.build(), leg: CHAN_LINH(), hips: HONG_NGUOI, amp: 0.5, stride: 0.42 };
}

/** Cung thủ: mũ trùm, áo da, ống tên sau lưng, cung giương ở tay trái. */
function cungThu(): Rig {
  const k = new Ke();
  thanNguoi(k, null, DA_THUOC, null);
  k.add(dep(tru(0.195, 0.16, 0.3, 10), 1, 1, 0.66), 0, 0.86, 0.01, 0x7a5636);
  k.add(dep(cau(0.13, 10, 8), 1, 1, 1.05), 0, 1.19, -0.02, 0x3f5a35)
    .add(xoay(non(0.07, 0.16, 6), -0.9), 0, 1.25, -0.15, 0x3f5a35);
  // Ống tên chếch sau lưng, đầu tên trắng thò ra.
  k.add(xoay(tru(0.055, 0.05, 0.42, 8), 0, 0, 0.3), 0.08, 0.9, -0.16, DA_THUOC);
  for (const d of [-0.02, 0.02]) k.add(hop(0.02, 0.1, 0.02), 0.15 + d, 1.13, -0.16 + d, PALETTE.cloud);
  const rt = -1.45;
  const rp = -1.25;
  k.nhom(tay(0x7a5636), rt, -VAI_X, VAI_Y, 0).nhom(tay(0x7a5636), rp, VAI_X - 0.06, VAI_Y, 0, -0.35);
  const [tx, ty, tz] = banTay(-VAI_X, rt);
  const R = 0.38;
  const cung = new THREE.TorusGeometry(R, 0.022, 5, 14, Math.PI * 0.9);
  cung.rotateZ(-Math.PI * 0.45);
  cung.rotateY(-Math.PI / 2);
  k.add(cung, tx, ty, tz - R + 0.02, GO)
    .add(hop(0.008, 2 * R * Math.sin(Math.PI * 0.45), 0.008), tx, ty, tz - R + 0.02 + R * Math.cos(Math.PI * 0.45), PALETTE.cloud);
  return { body: k.build(), leg: CHAN_LINH(), hips: HONG_NGUOI, amp: 0.5, stride: 0.42 };
}

/** Pháp sư: áo choàng dài tím, khăn màu phe, mũ chóp rộng vành, râu bạc, gậy có ngọc. */
function phapSu(): Rig {
  const k = new Ke();
  thanNguoi(k, 0x5b4290, 0xd8b45a, null);
  k.add(tru(0.2, 0.34, 0.62, 12), 0, 0.42, 0, 0x5b4290)
    .add(dep(tru(0.205, 0.205, 0.08, 12), 1, 1, 0.75), 0, 0.72, 0, null)
    .add(xoay(non(0.09, 0.26, 6), Math.PI), 0, 1.03, 0.1, 0xe8e4dc)
    .add(tru(0.27, 0.27, 0.025, 14), 0, 1.25, 0, 0x4a3478)
    .add(xoay(non(0.15, 0.42, 10), -0.18), 0, 1.45, -0.03, 0x4a3478);
  const rp = -0.55;
  k.nhom(tay(0x5b4290), rp, VAI_X, VAI_Y, 0).nhom(tay(0x5b4290), -0.25, -VAI_X, VAI_Y, 0);
  const [px, py, pz] = banTay(VAI_X, rp);
  k.add(tru(0.028, 0.032, 1.55, 6), px, py + 0.25, pz, GO)
    .add(cau(0.075, 8, 6), px, py + 1.06, pz, 0x9fdcff)
    .add(tru(0.05, 0.03, 0.08, 6), px, py + 0.99, pz, 0xd8b45a);
  // Áo dài che gần hết chân: chỉ còn bàn chân thò ra khi bước.
  return { body: k.build(), leg: chanNguoi(0x3b2c5e, 0x2e241c), hips: HONG_NGUOI, amp: 0.38, stride: 0.36 };
}

/** Chân ngựa: đùi, ống, móng. Khớp ở gốc. */
function chanNgua(): THREE.BufferGeometry {
  return new Ke()
    .add(hop(0.12, 0.38, 0.17), 0, -0.19, 0, 0x6b4a32)
    .add(hop(0.075, 0.32, 0.085), 0, -0.53, 0, 0x5a3c28)
    .add(hop(0.095, 0.07, 0.11), 0, -0.72, 0.01, 0x241a14)
    .build();
}

/**
 * Kỵ binh: con ngựa thân dài cổ cao, bờm và đuôi, yên phủ vải màu phe; người cưỡi mặc giáp,
 * hai chân kẹp hai bên mình ngựa, gươm giơ chếch. Bốn chân ngựa là lưới rời, đi nước kiệu.
 */
function kyBinh(): Rig {
  const k = new Ke();
  const nau = 0x7a5538;
  const toi = 0x2a1e16;
  k.add(xoay(dep(tru(0.25, 0.25, 1.05, 10), 0.9, 1, 1), Math.PI / 2), 0, 0.98, 0, nau);
  k.add(dep(cau(0.25, 10, 8), 0.9, 1, 1), 0, 0.98, 0.5, nau)
    .add(dep(cau(0.24, 10, 8), 0.9, 1, 1), 0, 1.0, -0.48, nau)
    .add(xoay(dep(tru(0.11, 0.16, 0.62, 8), 1, 1, 1.25), 0.62), 0, 1.33, 0.72, nau)
    .add(xoay(hop(0.17, 0.2, 0.44), 1.15), 0, 1.58, 0.98, nau)
    .add(hop(0.13, 0.11, 0.14), 0, 1.47, 1.17, 0x4a3426)
    .add(xoay(hop(0.05, 0.5, 0.1), 0.62), 0, 1.45, 0.66, toi)
    .add(xoay(non(0.07, 0.6, 6), -2.6), 0, 0.86, -0.82, toi);
  for (const x of [-0.05, 0.05]) k.add(non(0.03, 0.09, 4), x, 1.78, 0.9, nau);
  // Yên và vải phủ màu phe.
  k.add(xoay(dep(tru(0.27, 0.27, 0.42, 10), 0.95, 1, 1), Math.PI / 2), 0, 0.98, 0.0, null);
  k.add(hop(0.3, 0.08, 0.32), 0, 1.24, -0.02, DA_THUOC);
  // Người cưỡi.
  const ng = new Ke();
  thanNguoi(ng, null, DA_THUOC, null);
  ng.add(dep(tru(0.2, 0.2, 0.16, 10), 1, 1, 0.7), 0, 0.97, 0, SAT);
  giapVai(ng);
  muSat(ng, 1.21);
  ng.nhom(tay(SAT), -1.9, VAI_X, VAI_Y, 0).nhom(tay(SAT), -0.7, -VAI_X, VAI_Y, 0);
  const [px, py, pz] = banTay(VAI_X, -1.9);
  ng.add(xoay(hop(0.04, 0.78, 0.015), -0.5), px, py + 0.32, pz + 0.2, SAT)
    .add(hop(0.18, 0.03, 0.05), px, py + 0.02, pz + 0.02, 0xd8b45a);
  for (const s of [-1, 1]) {
    ng.add(xoay(hop(0.11, 0.3, 0.13), -0.5, 0, s * 0.35), s * 0.24, 0.46, 0.08, 0x4a4038)
      .add(hop(0.1, 0.26, 0.11), s * 0.32, 0.22, 0.2, 0x2e241c);
  }
  k.nhom(ng, 0, 0, 0.66, -0.02);
  const hips: Khop[] = [[-0.15, 0.8, 0.44, 0], [0.15, 0.8, 0.44, Math.PI],
    [-0.15, 0.8, -0.44, Math.PI], [0.15, 0.8, -0.44, 0]];
  return { body: k.build(), leg: chanNgua(), hips, amp: 0.45, stride: 0.75 };
}

/**
 * Xe pháo: giá gỗ đai sắt, nòng đồng sẫm chếch lên, hai bánh có nan, càng kéo phía sau, và
 * một pháo thủ (áo màu phe) đứng sau cầm que mồi. Không đi bộ nên không có chân rời.
 */
function xePhao(): Rig {
  const k = new Ke();
  k.add(hop(0.5, 0.16, 1.1), 0, 0.46, -0.05, GO)
    .add(hop(0.52, 0.04, 0.06), 0, 0.55, 0.3, SAT_TOI)
    .add(hop(0.52, 0.04, 0.06), 0, 0.55, -0.35, SAT_TOI);
  for (const x of [-0.36, 0.36]) {
    k.add(xoay(tru(0.38, 0.38, 0.07, 14), 0, 0, Math.PI / 2), x, 0.38, 0.05, GO)
      .add(xoay(tru(0.4, 0.4, 0.05, 14), 0, 0, Math.PI / 2), x * 1.02, 0.38, 0.05, SAT_TOI)
      .add(xoay(tru(0.07, 0.07, 0.12, 8), 0, 0, Math.PI / 2), x * 1.08, 0.38, 0.05, SAT);
    for (const a of [0, Math.PI / 3, -Math.PI / 3]) {
      k.add(xoay(hop(0.035, 0.7, 0.04), a), x, 0.38, 0.05, 0x4a3426);
    }
  }
  k.add(xoay(tru(0.11, 0.16, 1.25, 12), Math.PI / 2 - 0.3), 0, 0.78, 0.2, 0x3a3530)
    .add(xoay(tru(0.13, 0.13, 0.06, 12), Math.PI / 2 - 0.3), 0, 0.96, 0.78, 0x3a3530)
    .add(xoay(tru(0.18, 0.18, 0.08, 12), Math.PI / 2 - 0.3), 0, 0.62, -0.32, 0x8a6a3a)
    .add(xoay(hop(0.12, 0.1, 0.9), 0.3), 0, 0.32, -0.85, GO);
  const ng = new Ke();
  thanNguoi(ng, null, DA_THUOC, 0x3a2a1e);
  ng.add(dep(tru(0.13, 0.13, 0.06, 10), 1, 1, 1), 0, 1.25, 0, 0x4a3426);
  ng.nhom(tay(null), -1.0, VAI_X, VAI_Y, 0).nhom(tay(null), -0.4, -VAI_X, VAI_Y, 0);
  for (const s of [-1, 1]) {
    ng.add(xoay(hop(0.12, 0.3, 0.13), s * 0.25), s * HONG_X, 0.4, 0.04 * s, 0x4a4038)
      .add(hop(0.1, 0.26, 0.11), s * HONG_X, 0.13, 0.08 * s, 0x2e241c);
  }
  k.nhom(ng, 0, 0.5, 0, -1.0, -0.4);
  return { body: k.build(), leg: null, hips: [], amp: 0, stride: 1 };
}

const LINH = new Map<string, Rig>();

/** Bộ xương của một loại lính (cả quân mình lẫn giặc: màu phe nhuộm qua `tinted`). */
export function fighterRig(kind: 'spear' | 'archer' | 'horse' | 'mage' | 'siege'): Rig {
  const co = LINH.get(kind);
  if (co) return co;
  const r = kind === 'spear' ? linhGiao() : kind === 'archer' ? cungThu()
    : kind === 'horse' ? kyBinh() : kind === 'mage' ? phapSu() : xePhao();
  LINH.set(kind, r);
  return r;
}

// ------------------------------------------------------------------ thú bốn chân

/** Chân thú: đùi, ống, bàn. `dai` là độ dài cả chân. */
function chanThu(dai: number, day: number, mau: number, ban: number): THREE.BufferGeometry {
  return new Ke()
    .add(hop(day, dai * 0.52, day * 1.2), 0, -dai * 0.26, 0, mau)
    .add(hop(day * 0.72, dai * 0.42, day * 0.8), 0, -dai * 0.73, 0, mau)
    .add(hop(day * 0.9, dai * 0.1, day * 1.15), 0, -dai * 0.96, day * 0.15, ban)
    .build();
}

/**
 * Thân sói (hay thú bốn chân nói chung): ngực sâu hơn hông, lưng hơi võng, cổ chếch, mõm
 * dài, tai dựng, đuôi rủ. `long` null thì nhận màu bản — dùng cho thú quanh hang.
 */
export function thanSoi(long: number | null, toi: number, mat: number, gai: boolean): Ke {
  const k = new Ke();
  k.add(dep(cau(0.25, 10, 8), 0.85, 0.95, 1.2), 0, 0.6, 0.24, long)
    .add(dep(cau(0.21, 10, 8), 0.85, 0.85, 1.25), 0, 0.58, -0.22, long)
    .add(xoay(dep(tru(0.11, 0.15, 0.32, 8), 1, 1, 1.1), 0.9), 0, 0.73, 0.5, long)
    .add(dep(cau(0.14, 10, 8), 0.95, 0.9, 1.05), 0, 0.82, 0.66, long)
    .add(hop(0.13, 0.11, 0.22), 0, 0.77, 0.83, long)
    .add(hop(0.07, 0.05, 0.06), 0, 0.79, 0.95, toi)
    .add(xoay(non(0.06, 0.48, 6), -2.3), 0, 0.6, -0.55, long);
  for (const s of [-1, 1]) {
    k.add(xoay(non(0.05, 0.13, 4), -0.2), s * 0.07, 0.97, 0.62, long)
      .add(hop(0.035, 0.03, 0.02), s * 0.065, 0.86, 0.77, mat);
  }
  if (gai) {
    for (let i = 0; i < 6; i += 1) {
      k.add(xoay(non(0.05, 0.26, 4), -0.55), 0, 0.84 - i * 0.02, 0.42 - i * 0.15, XUONG);
    }
    for (const x of [-0.04, 0.04]) k.add(xoay(non(0.02, 0.08, 4), Math.PI), x, 0.71, 0.92, XUONG);
  }
  return k;
}

const HONG_SOI: readonly Khop[] = [[-0.12, 0.48, 0.3, 0], [0.12, 0.48, 0.3, Math.PI],
  [-0.11, 0.48, -0.28, Math.PI], [0.11, 0.48, -0.28, 0]];

/** Thú quanh hang: thân sói nhận màu loài, bốn chân dựng sẵn trong thân (không có chân rời). */
export function thuHoang(): THREE.BufferGeometry {
  const k = thanSoi(null, 0x2b2622, PALETTE.eye, false);
  const chan = chanThu(0.48, 0.09, 0xffffff, 0x2b2622);
  for (const [x, y, z, p] of HONG_SOI) {
    const g = chan.clone();
    g.rotateX(p ? 0.25 : -0.25);
    g.translate(x, y, z);
    k.parts.push(g);
  }
  return k.build();
}

// ------------------------------------------------------------------ quái

const MAT_DO = 0xff4a2a;

function soi(trum: boolean): Rig {
  const long = trum ? 0x3e3a3d : 0x8a847d;
  const toi = trum ? 0x232023 : 0x4a4541;
  return {
    body: thanSoi(long, toi, MAT_DO, trum).build(),
    leg: chanThu(0.48, 0.09, long, toi), hips: HONG_SOI, amp: 0.55, stride: 0.5,
  };
}

/** Thân người lùn/khổng lồ chung cho yêu tinh, khổng lồ, xương, thằn lằn. */
function yeuTinh(): Rig {
  const k = new Ke();
  const da = 0x7aa64a;
  k.add(dep(tru(0.13, 0.17, 0.2, 8), 1, 1, 0.8), 0, 0.4, 0, 0x5a4428)
    .add(dep(tru(0.16, 0.13, 0.28, 8), 1, 1, 0.75), 0, 0.6, 0.02, 0x6b4f2e)
    .add(dep(cau(0.15, 10, 8), 1.1, 0.95, 1), 0, 0.86, 0.06, da)
    .add(xoay(non(0.035, 0.1, 4), Math.PI / 2), 0, 0.84, 0.23, da);
  for (const s of [-1, 1]) {
    k.add(xoay(non(0.05, 0.24, 5), 0, 0, -s * 1.3), s * 0.21, 0.9, 0.04, da)
      .add(hop(0.035, 0.03, 0.015), s * 0.055, 0.89, 0.2, 0xffd23a);
  }
  const t = (): Ke => new Ke().add(hop(0.07, 0.36, 0.08), 0, -0.18, 0, da);
  k.nhom(t(), -0.9, 0.17, 0.7, 0.02).nhom(t(), -0.3, -0.17, 0.7, 0.02);
  k.add(xoay(tru(0.03, 0.07, 0.55, 6), 0.4), 0.18, 0.62, 0.42, 0x5b3d22);
  return {
    body: k.build(), leg: chanThu(0.32, 0.075, da, 0x3a2a1e),
    hips: [[-0.07, 0.32, 0, 0], [0.07, 0.32, 0, Math.PI]], amp: 0.6, stride: 0.26,
  };
}

function khongLo(): Rig {
  const k = new Ke();
  const da = 0x8f9a62;
  k.add(dep(cau(0.42, 12, 10), 1, 0.95, 0.9), 0, 0.82, 0.06, da)
    .add(tru(0.36, 0.42, 0.22, 10), 0, 0.52, 0, 0x5a3b26)
    .add(dep(hop(0.74, 0.38, 0.46), 1, 1, 1), 0, 1.15, -0.02, da)
    .add(dep(cau(0.19, 10, 8), 1, 0.95, 1), 0, 1.45, 0.14, da)
    .add(hop(0.34, 0.12, 0.34), -0.4, 1.33, 0, SAT_TOI);
  for (const s of [-1, 1]) {
    k.add(non(0.03, 0.13, 4), s * 0.07, 1.38, 0.31, XUONG)
      .add(hop(0.05, 0.035, 0.02), s * 0.07, 1.5, 0.31, 0xffd23a);
  }
  const t = (): Ke => new Ke().add(tru(0.1, 0.08, 0.6, 7), 0, -0.3, 0, da).add(cau(0.1, 7, 5), 0, -0.62, 0, da);
  k.nhom(t(), -1.0, 0.46, 1.25, 0.02).nhom(t(), -0.2, -0.46, 1.25, 0.02, 0, -0.2);
  // Chuỳ to bằng cả người, đầu đóng gai sắt, cầm tay phải.
  k.add(xoay(tru(0.06, 0.15, 1.15, 7), 1.0), 0.48, 1.0, 0.75, 0x5b3d22);
  for (const [x, y, z] of [[0.48, 1.28, 1.22], [0.38, 1.22, 1.18], [0.58, 1.22, 1.18]] as const) {
    k.add(xoay(non(0.04, 0.14, 4), 1.0), x, y, z, SAT_TOI);
  }
  return {
    body: k.build(), leg: chanThu(0.48, 0.17, da, 0x3a2a1e),
    hips: [[-0.17, 0.48, 0, 0], [0.17, 0.48, 0, Math.PI]], amp: 0.4, stride: 0.4,
  };
}

/** Nhện: tám chân nằm trong thân (bò lổm ngổm bằng nhún và lắc, không đưa chân). */
function nhen(trum: boolean): Rig {
  const k = new Ke();
  const than = trum ? 0x4b2c5e : 0x2e2a35;
  const chan = trum ? 0x2a1834 : 0x1f1c24;
  k.add(dep(cau(0.3, 12, 9), 1, 0.78, 1.25), 0, 0.44, -0.28, than)
    .add(dep(cau(0.18, 10, 8), 1, 0.85, 1.1), 0, 0.38, 0.12, than)
    .add(cau(0.12, 8, 6), 0, 0.36, 0.3, than);
  for (const x of [-0.05, 0.05]) k.add(hop(0.04, 0.04, 0.02), x, 0.42, 0.41, MAT_DO);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      const z = 0.24 - i * 0.14;
      k.add(xoay(hop(0.34, 0.045, 0.045), 0, s * (0.35 - i * 0.25), -s * 0.75), s * 0.27, 0.53, z, chan)
        .add(xoay(hop(0.045, 0.5, 0.045), 0, 0, s * 0.22), s * 0.5, 0.26, z + (0.1 - i * 0.07), chan);
    }
  }
  if (trum) {
    k.add(hop(0.13, 0.04, 0.22), 0, 0.68, -0.3, 0xc22a2a)
      .add(hop(0.22, 0.04, 0.07), 0, 0.685, -0.3, 0xc22a2a);
    for (const x of [-0.05, 0.05]) k.add(xoay(non(0.025, 0.12, 4), Math.PI), x, 0.27, 0.38, XUONG);
  }
  return { body: k.build(), leg: null, hips: [], amp: 0, stride: 0.3 };
}

function xuong(trum: boolean): Rig {
  const k = new Ke();
  const mat = trum ? 0x7dff6a : 0x1a1612;
  k.add(hop(0.26, 0.08, 0.12), 0, 0.46, 0, XUONG)
    .add(tru(0.03, 0.03, 0.28, 5), 0, 0.62, 0, XUONG);
  for (let i = 0; i < 4; i += 1) {
    k.add(dep(tru(0.15 - i * 0.01, 0.15 - i * 0.01, 0.035, 10), 1, 1, 0.65), 0, 0.68 + i * 0.07, 0, XUONG);
  }
  k.add(dep(cau(0.135, 10, 8), 1, 1.05, 1.05), 0, 1.06, 0.02, XUONG)
    .add(hop(0.15, 0.06, 0.12), 0, 0.96, 0.06, XUONG);
  for (const x of [-0.045, 0.045]) k.add(hop(0.045, 0.045, 0.03), x, 1.07, 0.14, mat);
  const t = (): Ke => new Ke().add(tru(0.025, 0.025, 0.42, 5), 0, -0.21, 0, XUONG);
  if (trum) {
    for (const s of [-1, 1]) k.add(xoay(non(0.05, 0.3, 5), 0, 0, -s * 0.9), s * 0.17, 1.18, 0, 0x3a352f);
    k.nhom(t(), -2.2, 0.22, 0.92, 0).nhom(t(), -0.3, -0.22, 0.92, 0);
    k.add(xoay(tru(0.05, 0.1, 0.9, 6), -0.4), 0.26, 1.35, 0.15, XUONG)
      .add(cau(0.12, 8, 6), 0.26, 1.76, -0.02, XUONG)
      // Khố rách quanh hông — tấm áo choàng phẳng sau lưng cũ phóng lên cỡ trùm thành tấm ván.
      .add(dep(tru(0.17, 0.22, 0.24, 8), 1, 1, 0.8), 0, 0.45, 0, 0x3b2f3f);
  } else {
    k.nhom(t(), -0.9, 0.22, 0.92, 0).nhom(t(), -1.1, -0.22, 0.92, 0);
    k.add(xoay(hop(0.04, 0.55, 0.015), 1.2), 0.22, 0.64, 0.6, SAT)
      .add(xoay(tru(0.16, 0.16, 0.035, 12), Math.PI / 2), -0.24, 0.72, 0.35, GO)
      .add(xoay(tru(0.05, 0.05, 0.05, 8), Math.PI / 2), -0.24, 0.72, 0.38, SAT);
  }
  const leg = new Ke().add(tru(0.03, 0.025, 0.42, 5), 0, -0.21, 0, XUONG)
    .add(hop(0.07, 0.04, 0.13), 0, -0.43, 0.03, XUONG).build();
  return { body: k.build(), leg, hips: [[-0.08, 0.45, 0, 0], [0.08, 0.45, 0, Math.PI]], amp: 0.5, stride: 0.34 };
}

function thanLan(): Rig {
  const k = new Ke();
  const vay = 0x4f8a5c;
  k.add(dep(tru(0.15, 0.18, 0.46, 8), 1, 1, 0.85), 0, 0.62, 0, vay)
    .add(hop(0.15, 0.32, 0.04), 0, 0.62, 0.14, 0xc9b77a)
    .add(hop(0.19, 0.17, 0.28), 0, 0.96, 0.08, vay)
    .add(hop(0.13, 0.09, 0.2), 0, 0.92, 0.3, vay)
    .add(xoay(non(0.1, 0.66, 6), -1.95), 0, 0.42, -0.36, vay);
  for (const x of [-0.07, 0.07]) k.add(hop(0.04, 0.035, 0.02), x, 1.0, 0.22, 0xffd94a);
  for (let i = 0; i < 4; i += 1) k.add(non(0.03, 0.09, 4), 0, 1.07 - i * 0.12, -0.04 - i * 0.05, 0x2f5a3a);
  const t = (): Ke => new Ke().add(hop(0.07, 0.34, 0.08), 0, -0.17, 0, vay);
  k.nhom(t(), -0.7, 0.19, 0.82, 0).nhom(t(), -0.4, -0.19, 0.82, 0);
  k.add(xoay(tru(0.024, 0.024, 1.45, 5), 0.25), 0.2, 0.75, 0.3, 0x5b3d22)
    .add(xoay(non(0.05, 0.2, 5), 0.25), 0.2, 1.47, 0.48, SAT);
  return {
    body: k.build(), leg: chanThu(0.4, 0.08, vay, 0x3e6e49),
    hips: [[-0.08, 0.4, 0, 0], [0.08, 0.4, 0, Math.PI]], amp: 0.55, stride: 0.32,
  };
}

function rong(): Rig {
  const k = new Ke();
  const vay = 0xa83a2a;
  k.add(dep(cau(0.36, 12, 9), 0.85, 0.85, 1.7), 0, 1.02, 0, vay)
    .add(dep(cau(0.3, 10, 8), 0.8, 0.5, 1.5), 0, 0.84, 0.05, 0xe0a050)
    .add(xoay(dep(tru(0.12, 0.17, 0.66, 8), 1, 1, 1), -0.75 + Math.PI / 2), 0, 1.38, 0.66, vay)
    .add(hop(0.3, 0.24, 0.46), 0, 1.66, 0.96, vay)
    .add(hop(0.22, 0.1, 0.26), 0, 1.56, 1.22, 0x7a2a20)
    .add(xoay(non(0.17, 1.2, 6), -1.75), 0, 0.92, -1.12, vay);
  for (let i = 0; i < 5; i += 1) k.add(non(0.05, 0.16, 4), 0, 1.33 - i * 0.03, 0.35 - i * 0.22, 0x6e2620);
  for (const s of [-1, 1]) {
    k.add(xoay(non(0.05, 0.32, 5), -0.9), s * 0.1, 1.86, 0.82, XUONG)
      .add(hop(0.05, 0.04, 0.02), s * 0.11, 1.72, 1.2, 0xffd94a)
      // Cánh: xương cánh và hai tấm màng chếch lên.
      .add(xoay(hop(1.3, 0.05, 0.06), 0, 0, s * 0.5), s * 0.82, 1.55, 0.2, 0x6e2620)
      .add(xoay(hop(1.2, 0.025, 0.7), 0, 0, s * 0.45), s * 0.8, 1.45, -0.15, 0x8a3326)
      .add(xoay(hop(0.7, 0.025, 0.45), 0, 0.3 * s, s * 0.75), s * 1.25, 1.86, -0.38, 0x8a3326);
  }
  const hips: Khop[] = [[-0.25, 0.78, 0.38, 0], [0.25, 0.78, 0.38, Math.PI],
    [-0.25, 0.78, -0.4, Math.PI], [0.25, 0.78, -0.4, 0]];
  return { body: k.build(), leg: chanThu(0.78, 0.14, 0x7a2a20, 0x3a1510), hips, amp: 0.42, stride: 0.7 };
}

const QUAI = new Map<string, Rig>();

/** Bộ xương của bầy thứ `i` (theo HORDES), con nhỏ hoặc con trùm. Dựng một lần, dùng mãi. */
export function beastRig(i: number, trum: boolean): Rig {
  const key = `${i}|${trum ? 1 : 0}`;
  const co = QUAI.get(key);
  if (co) return co;
  let r: Rig;
  switch (i) {
    case 0: r = soi(trum); break;
    case 1: r = trum ? khongLo() : yeuTinh(); break;
    case 2: r = nhen(trum); break;
    case 3: r = xuong(trum); break;
    default: r = trum ? rong() : thanLan(); break;
  }
  QUAI.set(key, r);
  return r;
}
