/**
 * Mặt đất liền mạch — không còn lát bằng ô lục giác.
 *
 * Trước đây cả mặt đất là MỘT `InstancedMesh` của 8.507 khối lục giác, mỗi khối 30 tam
 * giác: 255 nghìn tam giác, và vì một lưới trải 330×330 đơn vị thì hộp bao của nó luôn
 * chứa camera nên nó buộc phải `frustumCulled = false` — toàn bộ chỗ ấy được nộp mỗi khung,
 * kể cả phần nằm ngoài màn hình.
 *
 * Giờ là những MẢNH ĐẤT 90×90 rời nhau, mỗi mảnh 1.800 tam giác. Nhiều lệnh vẽ hơn (một
 * tới bốn mảnh thường trực, tối đa hai lăm) nhưng cắt tỉa theo khung nhìn mới có tác dụng,
 * và ở mức phóng nghỉ khung nhìn chỉ phủ chừng 80×71 đơn vị. Đổi một lệnh vẽ lấy bốn lần ít
 * tam giác hơn.
 *
 * BA ĐIỀU DỄ LÀM SAI, ghi lại vì cái nào cũng mất một vòng mới nhận ra:
 *
 *   — `flatShading` tính pháp tuyến phẳng bằng đạo hàm màn hình và BỎ QUA hẳn thuộc tính
 *     normal — tức là bật nó lên thì không còn cách nào chỉnh được mặt nào sáng mặt nào
 *     tối. Mặt đất vì thế tắt flatShading và tự ghi pháp tuyến cho từng mặt (xem
 *     MAT_NGHIENG); thuộc tính ấy cũng là thứ `shadow.normalBias` đọc.
 *   — Ô chia chéo SO LE theo (i+j). Một chiều chéo duy nhất tạo ra một dải xương cá chạy
 *     khắp bản đồ, dấu hiệu "lưới máy sinh" dễ nhận nhất.
 *   — Đường và sương KHÔNG vẽ bằng màu đỉnh. Một con đường rộng 5,2 đơn vị trên lưới 3 đơn
 *     vị sẽ phập phồng rộng hẹp theo từng ô; và sương đổi theo thời gian chạy nên tô vào
 *     đỉnh là mỗi lần vén một khối lại phải ghi lại cả một mảng. Cả hai nằm trong shader.
 */
import * as THREE from 'three';
import { BIOMES, PALETTE } from './config';
import { fogPaint, grain, matte, roadPaint } from './materials';
import {
  CHUNK, GRID_STEP, biomeWeights, chunkOf, hash2, nodeHeight, valueNoise,
} from './world';

/** Cạnh một mảnh đất, bằng ba khối bản đồ. */
const TILE = 90;
/** Số ô mỗi cạnh mảnh. 90 / 3 = 30 — chẵn, nên chiều chéo so le khớp nhau giữa hai mảnh. */
const N = TILE / GRID_STEP;
/** Số đỉnh mỗi cạnh. */
const V = N + 1;
/**
 * Phần pháp tuyến THẬT của mỗi mặt được giữ lại; phần còn lại lấy từ pháp tuyến mượt.
 *
 * Nắng giờ chiếu xiên ở độ cao chừng 37 độ. Hai mặt đất cạnh nhau nghiêng lệch nhau tới
 * mười sáu độ, và ở góc nắng ấy thì chừng đó đổi độ sáng tới một phần ba: cả bãi cỏ thành
 * một bàn cờ hình thoi sáng tối, lấn át luôn những ngôi nhà đứng trên nó. Giữ 0,3 thì mỗi
 * mặt vẫn bắt sáng khác nhau chừng một phần mười — đủ đọc ra là đất nặn có mặt phẳng, mà
 * hình khối lớn (sườn đồi, bậc vách đá) vẫn nguyên vì nó nằm ở phần mượt.
 */
const MAT_NGHIENG = 0.3;
/** Bán kính giữ mảnh, tính bằng mảnh. 2 phủ 450×450, rộng hơn vùng nạp 330×330. */
const KEEP = 2;

/** Ô sương trong texture. 64 × 30 = 1.920 đơn vị, thừa sức trùm vùng nạp. */
const FOG_N = 64;
const FOG_SPAN = FOG_N * CHUNK;

export class Ground {
  readonly group = new THREE.Group();
  private readonly tiles = new Map<string, THREE.Mesh>();
  private readonly mat: THREE.MeshStandardMaterial;

  /** Sương: một texel một khối. Đổi một byte là xong, không phải ghi lại màu đỉnh. */
  private readonly fogData = new Uint8Array(FOG_N * FOG_N);
  private readonly fogTex: THREE.DataTexture;
  private readonly fogOrigin = { value: new THREE.Vector2(0, 0) };
  /** Góc dưới-trái của texture, tính bằng chỉ số khối. */
  private fogCx = 0;
  private fogCz = 0;

  private readonly c0 = new THREE.Color();
  private readonly c1 = new THREE.Color();
  private readonly acc = new THREE.Color();
  private lastKey = '';

  constructor() {
    this.fogTex = new THREE.DataTexture(this.fogData, FOG_N, FOG_N, THREE.RedFormat);
    this.fogTex.minFilter = THREE.LinearFilter;
    this.fogTex.magFilter = THREE.LinearFilter;
    this.fogTex.wrapS = THREE.ClampToEdgeWrapping;
    this.fogTex.wrapT = THREE.ClampToEdgeWrapping;
    this.fogTex.needsUpdate = true;

    const m = matte(0xffffff);
    m.vertexColors = true;
    // KHÔNG flatShading: pháp tuyến do buildTile tự ghi, mỗi mặt một hướng nhưng đã ghìm
    // bớt độ nghiêng — xem MAT_NGHIENG.
    m.flatShading = false;
    // Thứ tự bọc có nghĩa: `grain` khai báo varying toạ độ thế giới mà hai lớp sau dùng lại,
    // nên nó phải ở trong cùng.
    this.mat = fogPaint(
      roadPaint(grain(m, 6, 0.18), PALETTE.road, 2.25, 0.12, 0.35),
      this.fogTex, this.fogOrigin, FOG_SPAN, PALETTE.fogLand);
  }

  /**
   * Màu một đỉnh: hoà hai bậc màu của từng biến sinh thái theo nhiễu, rồi hoà giữa các biến
   * bằng ĐÚNG trọng số mà cao độ đang dùng — hai phép khác nhau là ở ranh giới sẽ có một
   * dải mà màu đã đổi còn đất thì chưa.
   */
  private nodeColor(i: number, j: number, out: THREE.Color): void {
    const x = i * GRID_STEP;
    const z = j * GRID_STEP;
    const k = valueNoise(x, z, 14, 31) * 0.75 + hash2(i, j, 11) * 0.25;
    this.acc.setRGB(0, 0, 0);
    for (const [b, w] of biomeWeights(x, z)) {
      const [a, c] = BIOMES[b].ground;
      this.c0.setHex(a).lerp(this.c1.setHex(c), k);
      this.acc.add(this.c0.multiplyScalar(w));
    }
    out.copy(this.acc);
  }

  /**
   * Dựng một mảnh. KHÔNG dùng chỉ số: mỗi tam giác có ba đỉnh riêng.
   *
   * (Đoạn dưới viết hồi nắng còn treo cao sau lưng người chơi. Từ khi nắng chiếu xiên thì
   * bài toán lật ngược: pháp tuyến mặt giờ đổi độ sáng tới một phần ba chứ không còn bốn
   * phần trăm, nên nó phải bị GHÌM lại — xem MAT_NGHIENG. Màu riêng từng mặt vẫn giữ.)
   *
   * Lưới có chỉ số nhẹ hơn sáu lần và `flatShading` vẫn chạy được trên nó — nhưng thử xong
   * rồi mới thấy cái bẫy: mặt đất hoá ra PHẲNG LÌ. Lý do không nằm ở hình học (đo được hai
   * đỉnh cạnh nhau chênh tới 0,87 trên 3 đơn vị, tức mười sáu độ) mà ở ÁNH SÁNG: mặt trời
   * treo cao, nên nghiêng mười sáu độ chỉ đổi độ sáng chừng bốn phần trăm, và qua tone
   * mapping thì không còn gì. Bản lát ô lục giác không gặp chuyện này vì mỗi ô mang MỘT màu
   * riêng — cái tạo nên hình khối ở đó là màu, không phải bóng.
   *
   * Nên mỗi MẶT một màu riêng, và muốn thế thì ba đỉnh không được dùng chung. Đổi sáu lần
   * số đỉnh lấy lại đúng chất tạo hình của cả trò chơi là một cái giá rẻ.
   */
  private buildTile(gi: number, gj: number): THREE.Mesh {
    const i0 = gi * N;
    const j0 = gj * N;
    const tris = N * N * 2;
    const pos = new Float32Array(tris * 9);
    const nor = new Float32Array(tris * 9);
    const col = new Float32Array(tris * 9);

    // Cao độ và màu của từng đỉnh lưới, tính một lần rồi dùng cho tới bốn mặt quanh nó.
    const hs = new Float32Array(V * V);
    const cs = new Float32Array(V * V * 3);
    const c = new THREE.Color();
    // Cao độ có thêm một vành đỉnh bao ngoài mảnh, để pháp tuyến ở mép mảnh tính bằng đúng
    // phép mà mảnh bên cạnh sẽ tính — không thì mỗi đường nối mảnh là một nếp gấp.
    const W = V + 2;
    const hr = new Float32Array(W * W);
    for (let j = 0; j < W; j += 1) {
      for (let i = 0; i < W; i += 1) hr[j * W + i] = nodeHeight(i0 + i - 1, j0 + j - 1);
    }
    // Pháp tuyến MƯỢT ở từng đỉnh: sai phân trung tâm của cao độ.
    const ns = new Float32Array(V * V * 3);
    for (let j = 0; j < V; j += 1) {
      for (let i = 0; i < V; i += 1) {
        const n = j * V + i;
        const o = (j + 1) * W + i + 1;
        hs[n] = hr[o];
        const dx = (hr[o + 1] - hr[o - 1]) / (2 * GRID_STEP);
        const dz = (hr[o + W] - hr[o - W]) / (2 * GRID_STEP);
        const l = 1 / Math.hypot(dx, 1, dz);
        ns[n * 3] = -dx * l; ns[n * 3 + 1] = l; ns[n * 3 + 2] = -dz * l;
        this.nodeColor(i0 + i, j0 + j, c);
        cs[n * 3] = c.r; cs[n * 3 + 1] = c.g; cs[n * 3 + 2] = c.b;
      }
    }

    let k = 0;
    const ax = new THREE.Vector3();
    const bx = new THREE.Vector3();
    const nv = new THREE.Vector3();
    const dat = (i: number, j: number): [number, number, number] =>
      [i * GRID_STEP, hs[j * V + i], j * GRID_STEP];

    const mat = (
      p0: [number, number, number], p1: [number, number, number], p2: [number, number, number],
      n0: number, n1: number, n2: number, rung: number,
    ): void => {
      ax.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      bx.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
      nv.crossVectors(ax, bx).normalize();
      // Ghìm mặt: kéo pháp tuyến của mặt về phía pháp tuyến mượt của vùng đất quanh nó.
      // Vẫn MỘT hướng cho cả mặt, nên cạnh giữa hai mặt vẫn là một đường gãy sắc.
      const t = 1 - MAT_NGHIENG;
      nv.set(
        nv.x * MAT_NGHIENG + (ns[n0 * 3] + ns[n1 * 3] + ns[n2 * 3]) / 3 * t,
        nv.y * MAT_NGHIENG + (ns[n0 * 3 + 1] + ns[n1 * 3 + 1] + ns[n2 * 3 + 1]) / 3 * t,
        nv.z * MAT_NGHIENG + (ns[n0 * 3 + 2] + ns[n1 * 3 + 2] + ns[n2 * 3 + 2]) / 3 * t,
      ).normalize();
      const r = (cs[n0 * 3] + cs[n1 * 3] + cs[n2 * 3]) / 3 * rung;
      const g = (cs[n0 * 3 + 1] + cs[n1 * 3 + 1] + cs[n2 * 3 + 1]) / 3 * rung;
      const b = (cs[n0 * 3 + 2] + cs[n1 * 3 + 2] + cs[n2 * 3 + 2]) / 3 * rung;
      for (const p of [p0, p1, p2]) {
        pos[k] = p[0]; pos[k + 1] = p[1]; pos[k + 2] = p[2];
        nor[k] = nv.x; nor[k + 1] = nv.y; nor[k + 2] = nv.z;
        col[k] = r; col[k + 1] = g; col[k + 2] = b;
        k += 3;
      }
    };

    for (let j = 0; j < N; j += 1) {
      for (let i = 0; i < N; i += 1) {
        const A = dat(i, j);
        const B = dat(i + 1, j);
        const C = dat(i, j + 1);
        const D = dat(i + 1, j + 1);
        const nA = j * V + i;
        const nB = j * V + i + 1;
        const nC = (j + 1) * V + i;
        const nD = (j + 1) * V + i + 1;
        // Mỗi mặt một hệ số sáng riêng. Đây mới là thứ dựng nên hình khối.
        const r1 = 0.93 + hash2(i0 + i, j0 + j, 29) * 0.14;
        const r2 = 0.93 + hash2(i0 + i, j0 + j, 53) * 0.14;
        // Chéo so le: một chiều chéo duy nhất cho ra một dải xương cá chạy khắp bản đồ.
        if (((i + j) & 1) === 0) {
          mat(A, D, B, nA, nD, nB, r1);
          mat(A, C, D, nA, nC, nD, r2);
        } else {
          mat(A, C, B, nA, nC, nB, r1);
          mat(B, C, D, nB, nC, nD, r2);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.position.set(i0 * GRID_STEP, 0, j0 * GRID_STEP);
    mesh.receiveShadow = true;
    // Vẽ trước tiên, để quầng bãi (−1) dán được lên mặt đất mà vẫn nằm dưới mọi thứ khác.
    mesh.renderOrder = -2;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }

  /** Nạp và thả mảnh theo tâm ngắm. Chỉ chạy khi tâm đổi sang mảnh khác. */
  update(x: number, z: number): void {
    const gi = Math.floor(x / TILE);
    const gj = Math.floor(z / TILE);
    const key = `${gi},${gj}`;
    if (key === this.lastKey && this.tiles.size > 0) return;
    this.lastKey = key;
    for (let di = -KEEP; di <= KEEP; di += 1) {
      for (let dj = -KEEP; dj <= KEEP; dj += 1) {
        const k = `${gi + di},${gj + dj}`;
        if (this.tiles.has(k)) continue;
        const t = this.buildTile(gi + di, gj + dj);
        this.tiles.set(k, t);
        this.group.add(t);
      }
    }
    for (const [k, t] of this.tiles) {
      const [a, b] = k.split(',').map(Number);
      if (Math.abs(a - gi) <= KEEP && Math.abs(b - gj) <= KEEP) continue;
      this.group.remove(t);
      t.geometry.dispose();
      this.tiles.delete(k);
    }
  }

  // ------------------------------------------------------------------ sương

  /**
   * Nạp lại cả tấm sương quanh một chỗ. Một texel một khối, nên cả tấm là 4 KB — rẻ hơn
   * nhiều so với ghi lại màu của bảy trăm ô đất như bản cũ làm mỗi khung suốt 1,6 giây.
   */
  refillFog(cx: number, cz: number, muc: (cx: number, cz: number) => number): void {
    this.fogCx = cx - FOG_N / 2;
    this.fogCz = cz - FOG_N / 2;
    this.fogOrigin.value.set(this.fogCx * CHUNK, this.fogCz * CHUNK);
    for (let j = 0; j < FOG_N; j += 1) {
      for (let i = 0; i < FOG_N; i += 1) {
        this.fogData[j * FOG_N + i] = Math.round(255 * muc(this.fogCx + i, this.fogCz + j));
      }
    }
    this.fogTex.needsUpdate = true;
  }

  /** Đổi đúng một ô sương — dùng cho hoạt cảnh vén, chạy mỗi khung. */
  setFogAt(cx: number, cz: number, k: number): void {
    const i = cx - this.fogCx;
    const j = cz - this.fogCz;
    if (i < 0 || j < 0 || i >= FOG_N || j >= FOG_N) return;
    const v = Math.round(255 * Math.min(1, Math.max(0, k)));
    if (this.fogData[j * FOG_N + i] === v) return;
    this.fogData[j * FOG_N + i] = v;
    this.fogTex.needsUpdate = true;
  }

  /** Khối chứa một điểm — để bên gọi khỏi phải nhớ CHUNK. */
  static chunkAt(x: number, z: number): [number, number] {
    return [chunkOf(x), chunkOf(z)];
  }
}
