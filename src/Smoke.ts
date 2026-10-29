/**
 * Khói bếp: những cụm bông nhỏ bay lên từ ống khói, nở ra, trôi theo gió rồi tan.
 *
 * Mỗi cụm là một khối cầu ĐỤC, không phải tấm trong suốt: trong suốt thì phải sắp thứ tự vẽ
 * và AO lại coi nó như vật đặc. Thay cho mờ dần là THU NHỎ dần ở cuối đời — một cụm khói co
 * về không đọc ra là tan đi, và cả cảnh vẫn chỉ có vật đục như mọi thứ khác.
 *
 * Một lưới cho mọi ống khói, nên dù làng có bốn mươi nhà thì khói vẫn là một lệnh vẽ.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from './config';
import type { Vec3 } from './types';

/** Sức chứa. Bốn mươi nhà, mỗi nhà chừng bốn cụm đang bay. */
const CAP = 220;
/** Một cụm sống bấy nhiêu giây. */
const LIFE = 3.2;
/** Mỗi ống khói nhả một cụm sau chừng ấy giây (cộng một chút ngẫu nhiên). */
const EVERY = 0.85;

interface Puff { x: number; y: number; z: number; t: number; seed: number }

export class Smoke {
  readonly mesh: THREE.InstancedMesh;
  /** Miệng ống khói, kèm bộ đếm tới cụm sau. Khoá theo toạ độ để dựng lại không làm mất nhịp. */
  private sources: { key: string; p: Vec3; t: number }[] = [];
  private readonly puffs: Puff[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor() {
    // Ba quả cầu nhỏ chụm lại: một quả tròn thì đọc ra là viên bi, ba quả mới ra cụm bông.
    const parts: THREE.BufferGeometry[] = [];
    const n = new THREE.Vector3();
    for (const [x, y, z, r] of [[0, 0, 0, 0.2], [0.13, -0.04, 0.06, 0.14], [-0.11, -0.03, -0.05, 0.13]] as const) {
      const g = new THREE.IcosahedronGeometry(r, 1);
      const pos = g.getAttribute('position');
      const nor = g.getAttribute('normal');
      for (let i = 0; i < pos.count; i += 1) {
        n.fromBufferAttribute(pos, i).normalize();
        nor.setXYZ(i, n.x, n.y, n.z);
      }
      g.translate(x, y, z);
      parts.push(g);
    }
    const geo = mergeGeometries(parts, false) ?? parts[0];
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({
      color: PALETTE.cloud, roughness: 1, metalness: 0,
      emissive: 0xffffff, emissiveIntensity: 0.12,
    }), CAP);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  /**
   * Đặt lại danh sách miệng ống khói (toạ độ thế giới). Cụm đang bay vẫn bay tiếp.
   *
   * Hàm này chạy MỖI LẦN dựng lại nền đất — tức mỗi khi kho đổi. Ống nào vẫn ở chỗ cũ thì giữ
   * nguyên bộ đếm; đặt lại hết thì ống đầu tiên phun liên hồi còn các ống khác không bao giờ
   * tới lượt.
   */
  setSources(pts: Vec3[]): void {
    const cu = new Map(this.sources.map((s) => [s.key, s.t]));
    this.sources = pts.map((p, i) => {
      const key = p.map((v) => v.toFixed(2)).join(',');
      // Ống mới lệch pha nhau, không thì cả làng nhả khói cùng một nhịp như đồng hồ.
      return { key, p, t: cu.get(key) ?? ((i * 0.618) % 1) * EVERY };
    });
  }

  update(dt: number): void {
    for (const src of this.sources) {
      src.t -= dt;
      if (src.t > 0) continue;
      src.t += EVERY * (0.8 + Math.random() * 0.4);
      if (this.puffs.length >= CAP) continue;
      const [x, y, z] = src.p;
      this.puffs.push({ x, y, z, t: 0, seed: Math.random() });
    }

    let n = 0;
    for (let i = 0; i < this.puffs.length; i += 1) {
      const p = this.puffs[i];
      p.t += dt;
      if (p.t >= LIFE) continue;
      this.puffs[n] = p;
      n += 1;
      const k = p.t / LIFE;
      // Bay lên chậm dần, trôi xiên theo gió, lắc nhẹ sang hai bên.
      const len = 1.9 * (1 - (1 - k) * (1 - k));
      const lac = Math.sin(p.t * 2.1 + p.seed * 6.28) * 0.08 * k;
      this.v.set(p.x + k * 0.55 + lac, p.y + len, p.z + k * 0.3 - lac);
      // Nở ra từ nhỏ, tới 70% đời thì bắt đầu co về không.
      const no = 0.45 + 1.15 * Math.sqrt(k);
      const tan = 1 - THREE.MathUtils.smoothstep(k, 0.62, 1);
      this.s.setScalar(Math.max(0.0001, no * tan));
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.seed * 6.28 + p.t * 0.4);
      this.mesh.setMatrixAt(n - 1, this.m.compose(this.v, this.q, this.s));
    }
    this.puffs.length = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
