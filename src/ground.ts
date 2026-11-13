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
import type { BiomeId } from './types';
import { BIOMES, PALETTE, POOL_COLORS, SEA_COLORS } from './config';
import { WIND, fogPaint, grain, matte } from './materials';
import {
  CHUNK, GRID_STEP, biomeWeights, chunkOf, hash2, nodeHeight, nodePool, valueNoise, waterDepth,
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

/*
 * ĐẤT CÓ VÂN THẬT (giai đoạn 1 của bản nâng hình kiểu AoE1).
 *
 * Tám ảnh đất chụp thật (CC0, Poly Haven — xem public/tex/CREDITS.txt) gói thành MỘT dải
 * 512 × 4096, nạp vào một texture mảng: một lần tải, một bộ lấy mẫu cho cả tám lớp. Mỗi
 * đỉnh mang tám trọng số (hai vec4), shader trộn đúng những lớp có mặt.
 *
 * Màu KHÔNG lấy thẳng từ ảnh: ảnh chụp thật nhạt và xám hơn hẳn bảng màu ấm của game. Ảnh
 * chỉ góp VÂN — chia cho màu trung bình của chính nó (mip nhỏ nhất) rồi nhân vào màu biến
 * sinh thái — cộng thêm một phần màu thật (DAT_THAT) cho bớt "tô màu". Nhờ vậy bảng màu,
 * lớp lọc ấm và minimap vẫn nói cùng một thứ tiếng.
 */
const LOP = ['grass', 'grassRock', 'dirt', 'sand', 'rock', 'snow', 'mud', 'ash'] as const;
type Lop = typeof LOP[number];
/** Lớp vân của từng biến sinh thái. */
const LOP_CUA: Record<BiomeId, Lop> = {
  meadow: 'grass', highlands: 'grassRock', desert: 'sand', crags: 'rock',
  snow: 'snow', swamp: 'mud', ashland: 'ash',
};
/**
 * Độ đậm vân của từng lớp (theo thứ tự LOP). Ảnh chụp không đều tay: "cỏ lẫn đá" chụp từ
 * trên cao có những mảng sáng tối gắt, phóng lên cỡ một ô 11 đơn vị thì thành vệt loang
 * cả cánh đồng. Ghìm nó lại cho cùng một độ "ồn" với cỏ thường.
 */
const VAN_DAM = [0.8, 0.5, 0.9, 0.9, 1, 0.8, 0.5, 0.9];
/** Một ô vân phủ ngần này đơn vị, và lớp thứ hai (chống lặp) phủ ngần này. */
const VAN_GAN = 6;
const VAN_XA = 17;
/** Phần màu ảnh thật trộn vào; 0 là chỉ lấy vân, 1 là ảnh chụp nguyên màu. */
const DAT_THAT = 0.15;
/** Bật lại kiểu mặt gãy đa giác cũ (để so hai bên). */
const MAT_PHANG = false;

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
    // Thứ tự bọc có nghĩa: `grain` khai báo varying toạ độ thế giới mà lớp sương dùng lại,
    // nên nó phải ở trong cùng.
    this.mat = fogPaint(
      datVan(grain(m, 6, 0.07), this.vanTex, this.vanTb, this.vanCo), this.fogTex, this.fogOrigin,
      FOG_SPAN, PALETTE.fogLand);
    napVan(this.vanTex, this.vanTb);
  }

  /** Màu trung bình (tuyến tính) của từng lớp, tính một lần lúc nạp ảnh. */
  private readonly vanTb = { value: Array.from({ length: 8 }, () => new THREE.Vector3(1, 1, 1)) };
  /** (1/cỡ gần, 1/cỡ xa, phần màu thật, có lấy mẫu lớp xa không). */
  private readonly vanCo = { value: new THREE.Vector4(1 / VAN_GAN, 1 / VAN_XA, DAT_THAT, 1) };

  /**
   * Máy yếu chỉ lấy MỘT mẫu mỗi lớp thay vì hai: mặt đất phủ gần hết màn hình, nên mỗi
   * lần lấy mẫu bớt đi là bớt trên từng ấy điểm ảnh. Đổi lại thấy ô lặp rõ hơn một chút.
   */
  setDetail(full: boolean): void {
    this.vanCo.value.w = full ? 1 : 0;
  }

  /** Texture mảng tám lớp. Lúc chưa tải xong là một tấm 1×1 trắng: đất về đúng màu cũ. */
  private readonly vanTex = { value: vanTam() as THREE.Texture };

  /**
   * Trọng số tám lớp vân ở một đỉnh. Cùng trọng số biến sinh thái với màu và cao độ, cộng:
   * mảng đất trơ lốm đốm trên cỏ (kiểu AoE1), đá lộ ra ở sườn dốc, cát dọc bờ, và vân mờ
   * dần khi xuống nước hay vào vũng — dưới nước là việc của màu.
   */
  private nodeLayers(i: number, j: number, ny: number, out: Float32Array, o: number): void {
    const x = i * GRID_STEP;
    const z = j * GRID_STEP;
    for (let k = 0; k < 8; k += 1) out[o + k] = 0;
    let co = false;
    for (const [b, w] of biomeWeights(x, z)) {
      out[o + LOP.indexOf(LOP_CUA[b])] += w;
      if (b === 'swamp' || b === 'ashland') co = true;
    }
    // Mảng đất trơ trên cỏ. Muối 109 của valueNoise là của riêng phần hình này.
    const tro = Math.min(1, Math.max(0, (valueNoise(x, z, 38, 109) - 0.64) / 0.12)) * 0.85;
    if (tro > 0) {
      const co2 = out[o] + out[o + 1];
      out[o] *= 1 - tro; out[o + 1] *= 1 - tro;
      out[o + 2] += co2 * tro;
    }
    // Sườn dốc lộ đá: dốc chừng 17 độ trở lên bắt đầu thấy đá.
    const doc = Math.min(1, Math.max(0, (1 - ny - 0.045) / 0.1));
    if (doc > 0) {
      for (let k = 0; k < 8; k += 1) if (k !== 4 && k !== 5) out[o + k] *= 1 - doc;
      out[o + 4] += doc;
    }
    let con = 1;
    if (co) {
      const ngap = nodePool(i, j);
      if (ngap !== 0) con *= 1 - Math.min(1, 0.55 + Math.abs(ngap) * 0.6);
    }
    const d = waterDepth(x, z);
    if (d > 0) {
      const m = d >= 1 ? 1 : d * d * (3 - 2 * d);
      const cat = Math.min(1, m * 2.4);
      for (let k = 0; k < 8; k += 1) if (k !== 3) out[o + k] *= 1 - cat;
      out[o + 3] += cat;
      if (m > 0.3) con *= 1 - Math.min(1, (m - 0.3) / 0.45);
    }
    let tong = 0;
    for (let k = 0; k < 8; k += 1) tong += out[o + k];
    const ti = tong > 0 ? con / tong : 0;
    for (let k = 0; k < 8; k += 1) out[o + k] *= ti;
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
    let coVung = false;
    for (const [b, w] of biomeWeights(x, z)) {
      const [a, c] = BIOMES[b].ground;
      this.c0.setHex(a).lerp(this.c1.setHex(c), k);
      this.acc.add(this.c0.multiplyScalar(w));
      if (b === 'swamp' || b === 'ashland') coVung = true;
    }
    out.copy(this.acc);
    // Vũng nước và dung nham. Chỉ hỏi độ ngập ở nơi có thể có vũng: phép hỏi tính lại cả
    // cao độ, mà ba phần tư bản đồ không bao giờ cần tới nó.
    if (coVung) {
      const ngap = nodePool(i, j);
      if (ngap !== 0) {
        const [a, c] = ngap > 0 ? POOL_COLORS.water : POOL_COLORS.lava;
        this.c0.setHex(a).lerp(this.c1.setHex(c), k);
        // Mép vũng còn lẫn màu đất — bùn, hay đá đang nguội — rồi mới tới màu vũng thật.
        out.lerp(this.c0, Math.min(1, 0.55 + Math.abs(ngap) * 0.6));
      }
    }
    /*
     * SÔNG BIỂN: đất → cát bờ → nước nông → nước sâu, theo đúng độ sâu mà cao độ đang dùng.
     * Hỏi `waterDepth` chứ không hỏi lại cao độ: nó là ba phép nhiễu, và bốn phần năm bản
     * đồ trả về 0 ngay.
     */
    const d = waterDepth(x, z);
    if (d <= 0) return;
    const m = d >= 1 ? 1 : d * d * (3 - 2 * d);
    out.lerp(this.c0.setHex(SEA_COLORS.sand), Math.min(1, m * 2.4));
    if (m <= 0.3) return;
    const [a, c] = SEA_COLORS.shallow;
    this.c0.setHex(a).lerp(this.c1.setHex(c), k);
    this.c0.lerp(this.c1.setHex(SEA_COLORS.deep), Math.min(1, Math.max(0, (d - 1) / 1.6)));
    out.lerp(this.c0, Math.min(1, (m - 0.3) / 0.45));
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
    const w0 = new Float32Array(tris * 12);
    const w1 = new Float32Array(tris * 12);
    const ws = new Float32Array(V * V * 8);
    const nuoc = new Float32Array(tris * 3);
    const ds = new Float32Array(V * V);

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
        this.nodeLayers(i0 + i, j0 + j, l, ws, n * 8);
        ds[n] = waterDepth((i0 + i) * GRID_STEP, (j0 + j) * GRID_STEP);
      }
    }

    let k = 0;
    let kw = 0;
    const ax = new THREE.Vector3();
    const bx = new THREE.Vector3();
    const nv = new THREE.Vector3();
    const dat = (i: number, j: number): [number, number, number] =>
      [i * GRID_STEP, hs[j * V + i], j * GRID_STEP];
    /*
     * BỎ MẶT PHẲNG. Hồi đất còn tô một màu thì hình khối phải dựng bằng mặt gãy và hệ số
     * sáng riêng từng mặt (xem đoạn dưới, giữ lại để biết vì sao từng làm thế). Giờ vân ảnh
     * thật làm việc ấy, còn mặt gãy thì đọc ra ngay là "đồ chơi đa giác" — thứ người chơi
     * nói là thiếu thực tế. Nên mỗi ĐỈNH mang pháp tuyến mượt, màu và trọng số vân của nó.
     */
    const muot = (p: [number, number, number][], ns3: number[]): void => {
      for (let q = 0; q < 3; q += 1) {
        const n = ns3[q];
        const pp = p[q];
        pos[k] = pp[0]; pos[k + 1] = pp[1]; pos[k + 2] = pp[2];
        nor[k] = ns[n * 3]; nor[k + 1] = ns[n * 3 + 1]; nor[k + 2] = ns[n * 3 + 2];
        col[k] = cs[n * 3]; col[k + 1] = cs[n * 3 + 1]; col[k + 2] = cs[n * 3 + 2];
        for (let t = 0; t < 4; t += 1) { w0[kw + t] = ws[n * 8 + t]; w1[kw + t] = ws[n * 8 + 4 + t]; }
        nuoc[kw / 4] = ds[n];
        k += 3;
        kw += 4;
      }
    };

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
        // (Vẫn giữ: groundAt tra đúng tam giác theo luật này, nên lưới phải theo nó.)
        if (MAT_PHANG) {
          if (((i + j) & 1) === 0) {
            mat(A, D, B, nA, nD, nB, r1);
            mat(A, C, D, nA, nC, nD, r2);
          } else {
            mat(A, C, B, nA, nC, nB, r1);
            mat(B, C, D, nB, nC, nD, r2);
          }
        } else if (((i + j) & 1) === 0) {
          muot([A, D, B], [nA, nD, nB]);
          muot([A, C, D], [nA, nC, nD]);
        } else {
          muot([A, C, B], [nA, nC, nB]);
          muot([B, C, D], [nB, nC, nD]);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aW0', new THREE.BufferAttribute(w0, 4));
    geo.setAttribute('aW1', new THREE.BufferAttribute(w1, 4));
    geo.setAttribute('aNuoc', new THREE.BufferAttribute(nuoc, 1));
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

// ------------------------------------------------------------------ vân đất

/** Tấm tạm 1×1×8 trắng: shader chia cho trung bình nên ra hệ số 1 — đất y như chưa có vân. */
function vanTam(): THREE.DataArrayTexture {
  const t = new THREE.DataArrayTexture(new Uint8Array(4 * 8).fill(255), 1, 1, 8);
  t.needsUpdate = true;
  return t;
}

/**
 * Tải dải vân và dựng texture mảng. Ảnh webp nạp qua thẻ img rồi vẽ ra canvas để lấy điểm
 * ảnh — texture mảng của three nhận mảng byte, không nhận ảnh. Tải hỏng thì đất cứ giữ tấm
 * tạm: xấu hơn nhưng không vỡ gì.
 */
function napVan(u: { value: THREE.Texture }, tb: { value: THREE.Vector3[] }): void {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    const n = img.width;
    const so = Math.round(img.height / n);
    const cv = document.createElement('canvas');
    cv.width = n;
    cv.height = n * so;
    const g = cv.getContext('2d', { willReadFrequently: true });
    if (!g) return;
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, n, n * so).data;
    // Trung bình tính trên CPU một lần, ở không gian tuyến tính như shader thấy sau khi giải
    // mã sRGB. Lấy từ mip nhỏ nhất trong shader thì tốn thêm một lần lấy mẫu mỗi lớp mỗi điểm
    // ảnh, chỉ để ra cùng một con số.
    const bang = new Float32Array(256);
    for (let v = 0; v < 256; v += 1) {
      const c = v / 255;
      bang[v] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }
    for (let l = 0; l < Math.min(so, 8); l += 1) {
      let r = 0; let gg = 0; let b = 0; let dem = 0;
      const dau = l * n * n * 4;
      // Bước 7 điểm ảnh: ba vạn mẫu mỗi lớp là thừa cho một con số trung bình.
      for (let p = dau; p < dau + n * n * 4; p += 28) {
        r += bang[px[p]]; gg += bang[px[p + 1]]; b += bang[px[p + 2]];
        dem += 1;
      }
      tb.value[l].set(r / dem, gg / dem, b / dem);
    }
    const t = new THREE.DataArrayTexture(new Uint8Array(px.buffer), n, n, so);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.needsUpdate = true;
    u.value = t;
  };
  img.src = "/tex/ground.webp";
}

/**
 * Lớp bọc shader: trộn tám lớp vân theo trọng số đỉnh, hai cỡ lấy mẫu chống lặp ô.
 *
 * Chèn ở `map_fragment` — TRƯỚC `color_fragment` — và nhân vào diffuseColor một hệ số sao
 * cho sau khi color_fragment nhân màu đỉnh vào thì ra đúng màu vân. Chèn sau color_fragment
 * thì phải đứng sau cả lớp sương (fogPaint cũng chèn ở đó), tức là vân sẽ in lên cả mây.
 */
function datVan<T extends THREE.Material>(
  mat: T, tex: { value: THREE.Texture }, tb: { value: THREE.Vector3[] }, co: { value: THREE.Vector4 },
): T {
  const khoaTruoc = mat.customProgramCacheKey();
  const truoc = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    truoc?.call(mat, shader, renderer);
    shader.uniforms.uDat = tex;
    shader.uniforms.uDatCo = co;
    shader.uniforms.uDatTb = tb;
    shader.uniforms.uDatK = { value: VAN_DAM };
    shader.uniforms.uTime = WIND;
    shader.vertexShader = 'attribute vec4 aW0;\nattribute vec4 aW1;\nattribute float aNuoc;\nvarying vec4 vW0;\nvarying vec4 vW1;\nvarying float vNuoc;\n'
      + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vW0 = aW0; vW1 = aW1; vNuoc = aNuoc;`);
    shader.fragmentShader = 'uniform highp sampler2DArray uDat;\nuniform vec4 uDatCo;\nuniform vec3 uDatTb[8];\nuniform float uDatK[8];\nuniform float uTime;\nvarying float vNuoc;\nvarying vec4 vW0;\nvarying vec4 vW1;\n'
      + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      /*
       * MẶT NƯỚC. Nước là chính mặt đất hạ xuống SEA_Y và tô xanh (xem world.ts), nên nó ở
       * luôn trong shader này: gợn sóng chạy (bẻ pháp tuyến theo hai lớp nhiễu trôi ngược
       * chiều), mặt nước nhẵn bóng để nắng và bầu trời lấp lánh trên đó, và những vệt bọt
       * trắng chạy vào bờ. Không thêm lưới, không thêm lệnh vẽ.
       */
      float mNuoc = vNuoc >= 1.0 ? 1.0 : vNuoc * vNuoc * (3.0 - 2.0 * vNuoc);
      float datUot = smoothstep(0.32, 0.6, mNuoc);
      vec2 songG = vec2(0.0);
      if (datUot > 0.0) {
        vec2 p1 = vVanXZ * 0.045 + vec2(uTime * 0.012, uTime * 0.008);
        vec2 p2 = vVanXZ * 0.07 - vec2(uTime * 0.009, -uTime * 0.006);
        float e = 0.012;
        float n0 = texture2D(uVan, p1).r + texture2D(uVan, p2).r;
        float nx = texture2D(uVan, p1 + vec2(e, 0.0)).r + texture2D(uVan, p2 + vec2(e, 0.0)).r;
        float nz = texture2D(uVan, p1 + vec2(0.0, e)).r + texture2D(uVan, p2 + vec2(0.0, e)).r;
        songG = vec2(nx - n0, nz - n0) / e * datUot;
        // Bọt: những vệt chạy song song bờ, ở dải nước nông, đứt quãng theo nhiễu.
        float bo = 1.0 - smoothstep(0.38, 0.7, mNuoc);
        float vet = sin(vNuoc * 26.0 - uTime * 1.6 + n0 * 4.0);
        float bot = smoothstep(0.72, 0.96, vet) * bo * smoothstep(0.3, 0.42, mNuoc)
          * smoothstep(0.35, 0.75, n0);
        vec3 gocN = max(vColor.rgb, vec3(0.02));
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.92, 0.95, 0.96) / gocN, min(bot, 0.85));
      }
      {
        // Lớp thứ hai xoay lệch và to hơn: hai lưới lặp khác nhịp thì mắt hết bắt được ô.
        vec2 uvA = vVanXZ * uDatCo.x;
        vec2 uvB = mat2(0.8, -0.6, 0.6, 0.8) * vVanXZ * uDatCo.y;
        vec3 van = vec3(0.0);
        vec3 that = vec3(0.0);
        float tong = 0.0;
        for (int i = 0; i < 8; i++) {
          float w = i < 4 ? vW0[i] : vW1[i - 4];
          if (w < 0.004) continue;
          float l = float(i);
          vec3 a = texture(uDat, vec3(uvA, l)).rgb;
          if (uDatCo.w > 0.5) a = mix(a, texture(uDat, vec3(uvB, l)).rgb, 0.38);
          vec3 tb = max(uDatTb[i], vec3(0.02));
          van += w * mix(vec3(1.0), a / tb, uDatK[i]);
          that += w * a;
          tong += w;
        }
        if (tong > 0.0) {
          vec3 goc = max(vColor.rgb, vec3(0.02));
          // Ảnh chụp thật tối hơn bảng màu: kéo độ sáng về đúng màu đỉnh trước khi trộn.
          float sang = dot(goc, vec3(0.299, 0.587, 0.114)) / max(dot(that / tong, vec3(0.299, 0.587, 0.114)), 0.02);
          vec3 heSo = mix(van / tong, that / tong * sang / goc, uDatCo.z);
          diffuseColor.rgb *= mix(vec3(1.0), heSo, min(tong, 1.0));
        }
      }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.16, datUot);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (datUot > 0.0) {
        normal = normalize(normal + (viewMatrix * vec4(-songG.x, 0.0, -songG.y, 0.0)).xyz * 0.022);
      }`);
  };
  mat.customProgramCacheKey = () => `${khoaTruoc}|datvan`;
  return mat;
}
