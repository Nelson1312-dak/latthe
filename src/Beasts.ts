/*
 * HÌNH CỦA THÚ DỮ: hang và những con lượn quanh hang.
 *
 * Hai InstancedMesh cho cả bản đồ. Thú không có trạng thái: chỗ đứng của từng con là một hàm
 * của đồng hồ game và mã hang, nên không có gì để lưu, không có gì để lệch giữa hai máy, và
 * tạm dừng game là chúng đứng yên theo.
 */
import * as THREE from 'three';
import { BEASTS } from './config';
import { denOf } from './dens';
import type { Den } from './dens';
import { matte, tinted } from './materials';
import { han, paint } from './shapes';
import { thuHoang } from './rigs';
import { chunkOf, hash2 } from './world';

/** Quét hang trong ngần này khối quanh tâm ngắm. */
const TAM = 4;
const DEN_CAP = 96;
const BEAST_CAP = 480;

function hop(w: number, h: number, d: number, x: number, y: number, z: number, mau: number | null) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return paint(g, mau);
}


/** Cái hang: một ụ đá sáu cạnh, một miệng hang tối, và hai khúc xương trước cửa. */
function hangGeometry(): THREE.BufferGeometry {
  const u = new THREE.CylinderGeometry(1.25, 2.3, 1.7, 6);
  u.translate(0, 0.85, 0);
  const u2 = new THREE.CylinderGeometry(0.7, 1.3, 1.1, 5);
  u2.translate(-1.5, 0.55, -0.6);
  return han([
    paint(u, 0x6f6a66), paint(u2, 0x7d7873),
    hop(1.05, 0.95, 0.5, 0, 0.47, 1.75, 0x191513),
    hop(0.62, 0.1, 0.12, 1.5, 0.08, 1.9, 0xe9e2d0),
    hop(0.12, 0.1, 0.5, 1.9, 0.08, 1.5, 0xe9e2d0),
  ]);
}

export class Beasts {
  readonly group = new THREE.Group();
  private readonly hang: THREE.InstancedMesh;
  private readonly thu: THREE.InstancedMesh;
  private shown: Den[] = [];
  private lan = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly mau = new THREE.Color();

  /**
   * @param groundY cao độ mặt đất
   * @param song    hang này có đang hiện không: đã vén mây VÀ chưa bị dẹp
   */
  constructor(
    private readonly groundY: (x: number, z: number) => number,
    private readonly song: (d: Den) => boolean,
  ) {
    const da = matte(undefined, true);
    da.vertexColors = true;
    this.hang = new THREE.InstancedMesh(hangGeometry(), da, DEN_CAP);
    const long = tinted(matte(undefined, true));
    long.vertexColors = true;
    // Dáng thú bốn chân mới (rigs.ts): ngực sâu, cổ chếch, mõm dài, chân có khớp — thay cho
    // khối hộp cũ. Thân để trắng nên vẫn nhận màu từng loài.
    this.thu = new THREE.InstancedMesh(thuHoang(), long, BEAST_CAP);
    for (const mesh of [this.hang, this.thu]) {
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Một lưới trải khắp bản đồ: hộp bao tính một lần lúc rỗng thì cắt tỉa sai mãi.
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
  }

  /** Những hang đang hiện quanh camera — cũng là danh sách bấm chọn được. */
  get living(): readonly Den[] { return this.shown; }

  /** Vừa dẹp một hang hay vừa vén một ô mây: quét lại ngay khung tới. */
  dirty(): void { this.lan = 0; }

  private quet(center: THREE.Vector3): void {
    const cx = chunkOf(center.x);
    const cz = chunkOf(center.z);
    const ds: Den[] = [];
    for (let dx = -TAM; dx <= TAM; dx += 1) {
      for (let dz = -TAM; dz <= TAM; dz += 1) {
        const d = denOf(cx + dx, cz + dz);
        if (d && this.song(d) && ds.length < DEN_CAP) ds.push(d);
      }
    }
    this.shown = ds;
    let n = 0;
    ds.forEach((d, i) => {
      this.q.setFromAxisAngle(this.up, hash2(d.cx, d.cz, 64) * Math.PI * 2);
      const k = 0.9 + d.level * 0.07;
      this.m.compose(this.v.set(d.x, this.groundY(d.x, d.z) - 0.05, d.z), this.q, this.sc.set(k, k, k));
      this.hang.setMatrixAt(i, this.m);
      const spec = BEASTS[d.kind];
      const con = Math.min(8, spec.pack + Math.floor(d.level / 2));
      for (let j = 0; j < con && n < BEAST_CAP; j += 1, n += 1) {
        // Mỗi con lệch màu một chút, không thì cả bầy là một khối sao chép.
        this.mau.setHex(spec.color).multiplyScalar(0.88 + 0.24 * hash2(d.cx + j, d.cz - j, 65));
        this.thu.setColorAt(n, this.mau);
      }
    });
    this.hang.count = ds.length;
    this.hang.instanceMatrix.needsUpdate = true;
    this.thu.count = n;
    if (this.thu.instanceColor) this.thu.instanceColor.needsUpdate = true;
  }

  /** `t` là đồng hồ GAME (đứng khi tạm dừng), `real` là giây thật để hẹn lần quét kế. */
  update(t: number, real: number, center: THREE.Vector3): void {
    this.lan -= real;
    if (this.lan <= 0) { this.lan = 0.5; this.quet(center); }
    let n = 0;
    for (const d of this.shown) {
      const spec = BEASTS[d.kind];
      const con = Math.min(8, spec.pack + Math.floor(d.level / 2));
      for (let j = 0; j < con && n < BEAST_CAP; j += 1, n += 1) {
        const hat = hash2(d.cx * 7 + j, d.cz * 13 - j, 66);
        const chieu = hat < 0.5 ? 1 : -1;
        const a = hat * Math.PI * 2 + t * chieu * (0.2 + 0.22 * hash2(j, d.cx, 67));
        const r = 3.4 + 3.2 * hash2(d.cz, j, 68);
        const x = d.x + Math.cos(a) * r;
        const z = d.z + Math.sin(a) * r * 0.82;
        // Mặt quay theo hướng đang chạy: tiếp tuyến của vòng lượn.
        const yaw = Math.atan2(-Math.sin(a) * chieu, Math.cos(a) * 0.82 * chieu);
        this.q.setFromAxisAngle(this.up, yaw);
        const k = spec.size * (0.9 + 0.2 * hash2(j, d.cz, 69));
        const nhun = Math.abs(Math.sin(t * 6.5 + hat * 9)) * 0.07;
        const dan = spec.shape;
        if (dan) this.sc.set(k * dan[0], k * dan[1], k * dan[2]); else this.sc.set(k, k, k);
        this.m.compose(this.v.set(x, this.groundY(x, z) + nhun, z), this.q, this.sc);
        this.thu.setMatrixAt(n, this.m);
      }
    }
    if (n > 0) this.thu.instanceMatrix.needsUpdate = true;
  }
}
