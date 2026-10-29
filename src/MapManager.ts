/**
 * Thế giới vô hạn, nạp theo khối, với BÃI tài nguyên thay cho mỏ lẻ.
 *
 * Mỗi khối chứa một hoặc hai bãi: mỗi bãi là một khu có nền đất riêng tô màu theo loại tài
 * nguyên, một viền bao quanh, và props dày đặc bên trong. Bản trước rải hai tới bốn mỏ nhỏ
 * mỗi khối và kết quả là một tấm thảm chấm — nhìn không ra đâu là khu gì, nên cũng chẳng có
 * gì để mà chỉ vào rồi bảo "cho ba người tới đây".
 *
 * HIỆU NĂNG: mỗi KIỂU hình đúng MỘT InstancedMesh cho toàn thế giới, không phải một bộ cho
 * mỗi khối. 121 khối × 11 kiểu hình sẽ là hơn một nghìn ba trăm lệnh vẽ; gom lại còn mười
 * một, và con số đó không đổi dù người chơi đi xa tới đâu.
 *
 * HAI TẦNG: BỐ CỤC của một khối (bãi, nền đất, props) là hàm thuần của toạ độ khối, không
 * phụ thuộc cao độ — còn CAO ĐỘ của từng ô thì phụ thuộc bố cục của cả các khối lân cận, vì
 * ô nằm gần một nền đất hay trong lòng một bãi thì bị san phẳng. Tách hai tầng ra thì không
 * có vòng lặp: bố cục không cần cao độ, cao độ chỉ cần bố cục.
 */
import * as THREE from 'three';
import { gem, matte, metal, glowTexture, haloTexture, sway, SWAY_ON, WIND } from './materials';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES, CAMERA_OFFSET, PALETTE, RESOURCES } from './config';
import type { BiomeId, Patch, Plot, Vec3 } from './types';
import {
  CHUNK, HEX_R, HEX_STEP_X, HEX_STEP_Z, KEEP_RADIUS, LOAD_RADIUS, PLOT_FLAT_R,
  biomeAt, chunkKey, chunkOf, chunkRng, hash2, hexCenterAt, hexIsRoad, levelAtCenter,
  naturalTop, onRoad, patchFlatR, patchesOf, valueNoise,
} from './world';

/*
 * Tran so ban ban dau cho tung kieu hinh. Do bang cach dem that tren sau vung khac nhau roi
 * cong 30% du dia, vi so props doi theo bien sinh thai.
 *
 * Gio tran TU NOI ra khi can (xem refill): truoc day vuot tran la refill() lang le bo qua,
 * va do duoc cay thong da dung 1.072/1.100 - them vai khoi rung nua la cay bien mat ma
 * khong co gi bao.
 */
const CAP = {
  tile: 11400, halo: 300,
  pine: 1100, wheat: 900, rock: 1400, ore: 800, spire: 500, palm: 300, tuft: 2300,
  leaf: 520, bush: 350, flower: 900, glow: 750,
} as const;

type PropKey = keyof typeof CAP;

/**
 * Cột ô cao 6 chứ không phải 2,6. San phẳng có thể đặt hai ô cạnh nhau chênh nhau hơn ba đơn
 * vị ở vách đá, và cột thấp hơn độ chênh thì đáy của ô cao lơ lửng phía trên mặt ô thấp —
 * để lộ một khe nhìn xuyên xuống. Cột cao thêm không tốn thêm tam giác nào.
 */
const TILE_H = 6;

/**
 * Mép vát trên của ô: tụt 0,1 trên bề ngang 0,14. Đủ để mỗi ô bắt sáng một viền mảnh và hai
 * ô kề nhau có một rãnh nhỏ — mặt đất đọc ra là lát bằng từng viên, như Townscaper, thay cho
 * một tấm phẳng có kẻ màu. Nhỏ hơn nữa thì ở mức phóng xa viền chỉ còn nửa điểm ảnh.
 */
const VAT_CAO = 0.1;
const VAT_RONG = 0.14;

/** Sáu ô kề một ô, theo lưới cột lệch nửa bước của world.ts. */
const KE: readonly (readonly [number, number])[] = [
  [0, HEX_STEP_Z], [0, -HEX_STEP_Z],
  [HEX_STEP_X, HEX_STEP_Z / 2], [HEX_STEP_X, -HEX_STEP_Z / 2],
  [-HEX_STEP_X, HEX_STEP_Z / 2], [-HEX_STEP_X, -HEX_STEP_Z / 2],
];

/** Hướng từ tâm ngắm về phía camera — hằng số, vì camera không bao giờ xoay. */
const VIEW = new THREE.Vector3(...CAMERA_OFFSET).normalize();

/** Bốn nền quanh thủ phủ. Chúng nằm vắt sang ba khối lân cận, nên trang trí phải tránh riêng. */
const CORE_PLOTS = [[-9, -8], [9, -8], [-9, 8], [9, 8]] as const;

/** Đất chưa vén pha về màu sương chừng này phần. */
const FOG_MIX = 0.72;
/** Hoạt cảnh vén: đất chuyển màu, quầng hiện, rồi cây đá mọc lên lần lượt. */
const REVEAL_SECONDS = 1.6;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
/** Mọc lên có nảy: vượt quá cỡ một chút rồi lắng về 1. */
const nay = (k: number): number => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2));

/** Một props: pos[1] là độ cao TÍNH TỪ MẶT ĐẤT, không phải cao độ tuyệt đối. */
interface Prop { key: PropKey; pos: Vec3; scale: number; rot: number; color: number }

interface Layout {
  patches: Patch[];
  plots: Plot[];
  props: Prop[];
}

interface Chunk extends Layout {
  cx: number;
  cz: number;
  tiles: { pos: Vec3; color: number }[];
}

export class MapManager {
  readonly group = new THREE.Group();
  private readonly chunks = new Map<string, Chunk>();
  /** Bố cục đã tính, kể cả của các khối CHƯA nạp — cần để san phẳng ô ở rìa vùng nạp. */
  private readonly layouts = new Map<string, Layout>();
  /** Cao độ mặt trên của từng ô đã tính, theo toạ độ tâm ô. */
  private readonly tops = new Map<string, number>();
  private readonly meshes = {} as Record<PropKey, THREE.InstancedMesh>;
  private readonly cap = { ...CAP } as Record<PropKey, number>;
  private readonly m = new THREE.Matrix4();
  private readonly v = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 1, 0);
  private readonly color = new THREE.Color();
  private readonly fogC = new THREE.Color();
  private readonly fogLand = new THREE.Color(PALETTE.fogLand);
  private readonly mixC = new THREE.Color();
  private lastCenter = '';
  /** Khối nào đã vén — Game nối vào FogOfWar. Mặc định coi như đã vén hết. */
  private lo: (cx: number, cz: number) => boolean = () => true;
  /** Khối đang vén dở, và đã vén được bao lâu. */
  private readonly revealing = new Map<string, number>();
  /** Chỉ số bắt đầu của từng khối trong từng lưới, ghi lại ở mỗi lần refill. */
  private readonly ranges = new Map<string, Record<PropKey, number>>();

  /** Đổi mỗi khi tập khối thay đổi — Game dựa vào đây để dựng lại nền đất. */
  version = 0;

  /** Ô vát mép (30 tam giác) cho bậc Vừa và Cao, ô phẳng (18) cho bậc Thấp. */
  private readonly tileBevel = hexTile(HEX_R, TILE_H, VAT_CAO, VAT_RONG);
  private readonly tileFlat = hexTile(HEX_R, TILE_H, 0, 0);

  constructor() {
    const make = (key: PropKey, geo: THREE.BufferGeometry, material: THREE.Material, shadow: boolean) => {
      const mesh = new THREE.InstancedMesh(geo, material, CAP[key]);
      mesh.castShadow = shadow;
      mesh.receiveShadow = key === 'tile';
      mesh.frustumCulled = false;
      mesh.renderOrder = key === 'halo' ? 1 : key === 'glow' ? 2 : 0;
      mesh.count = 0;
      this.meshes[key] = mesh;
      this.group.add(mesh);
    };

    /*
     * Lục giác phải xoay 30° (thetaStart = π/6).
     *
     * CylinderGeometry của three đặt ĐỈNH đầu tiên trên trục +Z, tức cạnh phẳng quay về ±X.
     * Nhưng lưới ở đây xếp ô kề nhau dọc theo trục Z, nên nó cần cạnh phẳng quay về ±Z. Thiếu
     * góc xoay này thì theo một hướng các ô chồng lên nhau, hướng kia hở khe tam giác — mặt
     * đất chưa từng khít, và AO bám vào mấy cái khe đó nên trông như những rãnh tối.
     */
    make('tile', this.tileBevel, matte(), false);

    // Quầng của bãi: một hình vuông phẳng mang ảnh gradient tròn. Đây là thứ khiến một bãi
    // đọc được ngay từ mức phóng xa nhất, khi props đã nhỏ như hạt vừng.
    const halo = new THREE.PlaneGeometry(2, 2);
    halo.rotateX(-Math.PI / 2);
    make('halo', halo, new THREE.MeshBasicMaterial({
      map: haloTexture(),
      transparent: true, depthWrite: false, opacity: 0.85,
      blending: THREE.NormalBlending,
    }), false);

    /*
     * Tán lá lắc theo gió. Độ mạnh tính theo chiều cao CỤC BỘ của từng hình (lệch = độ mạnh ×
     * cao²): thông cao gần 3 nên chỉ cần 0,014 là ngọn đã lắc chừng 0,1; bó lúa cao 0,85 cần
     * gấp mười mới thấy. `mau` = hình có màu đỉnh (thân nâu), xem sway().
     */
    const la = (amount: number, mau = false): THREE.MeshStandardMaterial => {
      const m = matte(undefined, true);
      m.vertexColors = mau;
      return sway(m, amount);
    };
    make('pine', this.pineGeometry(), la(0.014, true), true);
    make('wheat', this.wheatGeometry(), la(0.12), true);
    make('rock', new THREE.DodecahedronGeometry(1, 0), matte(undefined, true), true);
    // Quặng vàng là phần kim loại duy nhất của thế giới, nên cũng là ngoại lệ duy nhất
    // của trần kim loại 0,2.
    make('ore', new THREE.OctahedronGeometry(0.75, 0), metal(PALETTE.goldOre, PALETTE.goldOre), true);
    make('spire', this.spireGeometry(), gem(PALETTE.crystal, PALETTE.crystalGlow), true);
    make('palm', this.palmGeometry(), la(0.025, true), true);
    make('tuft', new THREE.ConeGeometry(0.22, 0.5, 4), sway(matte(), 1.0), false);
    make('leaf', this.leafGeometry(), la(0.016, true), true);
    make('bush', this.bushGeometry(), la(0.05), true);
    // Hoa không đổ bóng: thân mảnh như sợi chỉ, bóng của nó chỉ thành những chấm nhiễu.
    make('flower', this.flowerGeometry(), la(0.4, true), false);

    /*
     * Quầng sáng quanh pha lê và quặng vàng — thay cho bloom.
     *
     * Bloom thật lọc theo độ sáng, mà ở đây tường kem dưới nắng còn sáng hơn pha lê: lọc
     * kiểu gì cũng loé luôn cả làng. Bloom chọn lọc thì phải vẽ lại cả cảnh thêm một lượt.
     * Còn đây là một tấm phẳng mang đốm sáng mềm, cộng dồn ánh sáng, đặt đúng chỗ từng viên
     * — một lệnh vẽ, vài trăm tấm. Camera không bao giờ xoay nên tấm quay sẵn về phía camera
     * một lần là đủ, khỏi xoay theo từng khung.
     */
    const glow = new THREE.PlaneGeometry(2, 2);
    glow.lookAt(VIEW);
    make('glow', glow, new THREE.MeshBasicMaterial({
      map: glowTexture(),
      transparent: true, depthWrite: false, opacity: 0.24,
      blending: THREE.AdditiveBlending,
    }), false);
  }

  // ------------------------------------------------------------ nạp và huỷ

  update(center: THREE.Vector3): void {
    const cx = chunkOf(center.x);
    const cz = chunkOf(center.z);
    const key = chunkKey(cx, cz);
    if (key === this.lastCenter) return;
    this.lastCenter = key;

    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx += 1) {
      for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz += 1) {
        const k = chunkKey(cx + dx, cz + dz);
        if (!this.chunks.has(k)) this.chunks.set(k, this.makeChunk(cx + dx, cz + dz));
      }
    }
    for (const [k, c] of this.chunks) {
      if (Math.abs(c.cx - cx) > KEEP_RADIUS || Math.abs(c.cz - cz) > KEEP_RADIUS) this.chunks.delete(k);
    }
    // Bố cục giữ rộng hơn vùng nạp một vòng: ô ở rìa cần biết bãi của khối bên ngoài.
    for (const k of this.layouts.keys()) {
      const [lx, lz] = k.split(',').map(Number);
      if (Math.abs(lx - cx) > KEEP_RADIUS + 1 || Math.abs(lz - cz) > KEEP_RADIUS + 1) this.layouts.delete(k);
    }
    if (this.tops.size > 60000) this.tops.clear();
    this.refill();
    this.version += 1;
  }

  /** Áp bậc đồ hoạ: dạng ô, gió, quầng sáng. Không đụng gì tới bố cục hay cao độ. */
  setQuality(q: { bevel: boolean; sway: boolean; glow: boolean }): void {
    const tile = this.meshes.tile;
    const want = q.bevel ? this.tileBevel : this.tileFlat;
    if (tile.geometry !== want) tile.geometry = want;
    SWAY_ON.value = q.sway ? 1 : 0;
    this.meshes.glow.visible = q.glow;
  }

  /** Nối danh sách khối đã vén. */
  setFog(lo: (cx: number, cz: number) => boolean): void {
    this.lo = lo;
  }

  /** Tô lại đất theo trạng thái sương hiện tại — sau khi danh sách ô đã vén bị đặt lại. */
  refreshFog(): void {
    this.revealing.clear();
    this.refill();
  }

  /** Một khối vừa được vén: chạy hoạt cảnh chuyển màu và mọc cây đá. */
  reveal(key: string): void {
    this.revealing.set(key, 0);
    this.refill();
  }

  /** Màu một ô: pha về màu sương theo k (0 = chưa vén, 1 = màu thật). */
  private tint(hex: number, k: number): THREE.Color {
    this.color.setHex(hex);
    if (k >= 1) return this.color;
    this.fogC.setHex(hex).lerp(this.fogLand, FOG_MIX);
    return this.fogC.lerp(this.color, k);
  }

  /** InstancedMesh mới với sức chứa lớn hơn, dùng lại hình học và vật liệu của cái cũ. */
  private regrow(key: PropKey, need: number): void {
    const old = this.meshes[key];
    const n = Math.ceil(need * 1.3);
    const mesh = new THREE.InstancedMesh(old.geometry, old.material, n);
    mesh.castShadow = old.castShadow;
    mesh.receiveShadow = old.receiveShadow;
    mesh.frustumCulled = false;
    mesh.renderOrder = old.renderOrder;
    mesh.visible = old.visible;
    mesh.count = 0;
    this.group.remove(old);
    old.dispose();
    this.group.add(mesh);
    this.meshes[key] = mesh;
    this.cap[key] = n;
  }

  private refill(): void {
    // Đếm trước, nới trần nếu thiếu — không bao giờ lặng lẽ bỏ bớt nữa.
    const need = {} as Record<PropKey, number>;
    for (const k of Object.keys(CAP) as PropKey[]) need[k] = 0;
    for (const chunk of this.chunks.values()) {
      need.tile += chunk.tiles.length;
      need.halo += chunk.patches.length;
      for (const pr of chunk.props) need[pr.key] += 1;
    }
    for (const k of Object.keys(CAP) as PropKey[]) {
      if (need[k] > this.cap[k]) this.regrow(k, need[k]);
    }

    const used = {} as Record<PropKey, number>;
    for (const k of Object.keys(CAP) as PropKey[]) used[k] = 0;
    const put = (key: PropKey, mat: THREE.Matrix4, color: THREE.Color) => {
      const i = used[key];
      this.meshes[key].setMatrixAt(i, mat);
      this.meshes[key].setColorAt(i, color);
      used[key] = i + 1;
    };

    this.ranges.clear();
    for (const chunk of this.chunks.values()) {
      const key = chunkKey(chunk.cx, chunk.cz);
      const start = { ...used };
      this.ranges.set(key, start);

      /*
       * ĐẤT CHƯA VÉN: nhạt màu, và TRỐNG TRƠN — không cây, không đá, không quầng bãi.
       *
       * Trước đây đất dưới mây vẫn vẽ đầy đủ, nên nhìn xuyên qua kẽ mây là thấy hết bãi tài
       * nguyên của vùng chưa ai tới — sương mù khám phá mà chẳng giấu được gì. Giờ vùng chưa
       * vén đọc ra như phần bản đồ chưa vẽ, và liếc là biết đâu đã khám phá.
       */
      const daVen = this.lo(chunk.cx, chunk.cz);
      const t = this.revealing.get(key);
      const kDat = !daVen ? 0 : t === undefined ? 1 : this.kDat(t);
      for (const tile of chunk.tiles) {
        put('tile', this.m.makeTranslation(tile.pos[0], tile.pos[1], tile.pos[2]), this.tint(tile.color, kDat));
      }
      if (!daVen) continue;

      chunk.patches.forEach((p, i) => {
        put('halo', this.haloMatrix(p, t === undefined ? 1 : this.kQuang(t, i)), this.color.setHex(RESOURCES[p.kind].color));
      });
      chunk.props.forEach((pr, i) => {
        put(pr.key, this.propMatrix(pr, t === undefined ? 1 : this.kMoc(t, i)), this.color.setHex(pr.color));
      });
    }

    // Vẽ ĐÚNG số đã dùng. Bản trước để count = trần và thu nhỏ phần thừa về 0, nên GPU vẫn
    // chạy đỉnh cho cả phần thừa — đo được 11.400 ô được vẽ cho 8.507 ô dùng, 500 tinh thể
    // cho 27 tinh thể thật.
    for (const key of Object.keys(CAP) as PropKey[]) {
      const mesh = this.meshes[key];
      mesh.count = used[key];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Quầng nằm ngay trên khoảnh đất đã san của bãi, rộng hơn bãi một chút. */
  private haloMatrix(p: Patch, k: number): THREE.Matrix4 {
    this.v.set(p.center[0], p.center[1] + 0.06, p.center[2]);
    this.q.identity();
    const r = p.radius * 1.16 * Math.max(0.0001, k);
    this.s.set(r, 1, r);
    return this.m.compose(this.v, this.q, this.s);
  }

  private propMatrix(pr: Prop, k: number): THREE.Matrix4 {
    this.v.set(pr.pos[0], this.groundY(pr.pos[0], pr.pos[2]) + pr.pos[1], pr.pos[2]);
    this.q.setFromAxisAngle(this.axis, pr.rot);
    this.s.setScalar(pr.scale * Math.max(0.0001, k));
    return this.m.compose(this.v, this.q, this.s);
  }

  /** Tiến độ của ba lớp trong hoạt cảnh vén: đất trước, quầng sau, cây đá mọc lần lượt. */
  private kDat(t: number): number {
    const k = clamp01(t / 0.9);
    return k * k * (3 - 2 * k);
  }

  private kQuang(t: number, i: number): number {
    return clamp01((t - 0.35 - i * 0.12) / 0.6);
  }

  private kMoc(t: number, i: number): number {
    return nay(clamp01((t - 0.3 - i * 0.006) / 0.5));
  }

  // ------------------------------------------------------------ cao độ

  /**
   * Cao độ mặt đất tại (x, z): mặt trên của ô lục giác chứa điểm đó.
   *
   * Dùng cho MỌI THỨ đứng trên mặt đất — props, nền đất, nhà, dân làng, vòng chọn. Có bộ
   * nhớ đệm theo ô vì dân làng hỏi mỗi khung hình.
   */
  groundY(x: number, z: number): number {
    const [hx, hz] = hexCenterAt(x, z);
    return this.tileTop(hx, hz);
  }

  private tileTop(hx: number, hz: number): number {
    const key = `${Math.round(hx * 10)},${Math.round(hz * 10)}`;
    let t = this.tops.get(key);
    if (t === undefined) {
      t = this.levelAt(hx, hz) ?? naturalTop(hx, hz);
      this.tops.set(key, t);
    }
    return t;
  }

  /**
   * Cao độ san phẳng của ô có tâm (x, z), hoặc null nếu ô ấy để tự nhiên.
   *
   * Nền đất thắng bãi: một ô nằm trong cả vành san của nền lẫn của bãi thì theo nền, vì nhà
   * cắm lệch nền trông tệ hơn nhiều so với rìa quầng bãi lệch một chút. Xét cả tám khối
   * xung quanh: bãi gần ranh giới khối thì lòng bãi tràn sang khối bên cạnh.
   */
  private levelAt(x: number, z: number): number | null {
    const cx = chunkOf(x);
    const cz = chunkOf(z);
    let plotY: number | null = null;
    let plotD = PLOT_FLAT_R;
    let patchY: number | null = null;
    let patchK = 1;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const l = this.layoutOf(cx + dx, cz + dz);
        for (const p of l.plots) {
          const d = Math.hypot(p.position[0] - x, p.position[2] - z);
          if (d < plotD) { plotD = d; plotY = p.position[1]; }
        }
        for (const b of l.patches) {
          const k = Math.hypot(b.center[0] - x, b.center[2] - z) / patchFlatR(b);
          if (k < patchK) { patchK = k; patchY = b.center[1]; }
        }
      }
    }
    return plotY ?? patchY;
  }

  // ------------------------------------------------------------ sinh khối

  private makeChunk(cx: number, cz: number): Chunk {
    const ox = cx * CHUNK;
    const oz = cz * CHUNK;
    const layout = this.layoutOf(cx, cz);
    const chunk: Chunk = { cx, cz, ...layout, tiles: [] };

    /*
     * --- thảm cỏ, VÀ ĐƯỜNG ĐI LÀ MỘT LOẠI Ô TRONG CHÍNH THẢM ẤY ---
     *
     * Đường không phải một vật thể: nó chỉ là những ô lục giác được tô màu đất nện thay vì
     * màu cỏ. Nhờ thế mép đường luôn khớp lưới, luôn đúng cao độ địa hình, và tốn đúng không
     * lệnh vẽ nào.
     *
     * Chỉ số ô tính theo TOÀN THẾ GIỚI, nên lưới liền mạch qua ranh giới khối.
     */
    const i0 = Math.ceil(ox / HEX_STEP_X);
    const i1 = Math.floor((ox + CHUNK - 0.001) / HEX_STEP_X);
    for (let i = i0; i <= i1; i += 1) {
      const x = i * HEX_STEP_X;
      // Cột lẻ lệch nửa bước. Phải lấy dư KHÔNG ÂM, vì i âm ở nửa bản đồ bên kia.
      const lech = (((i % 2) + 2) % 2) ? HEX_STEP_Z / 2 : 0;
      const j0 = Math.ceil((oz - lech) / HEX_STEP_Z);
      const j1 = Math.floor((oz + CHUNK - 0.001 - lech) / HEX_STEP_Z);
      for (let j = j0; j <= j1; j += 1) {
        const z = j * HEX_STEP_Z + lech;
        chunk.tiles.push({
          pos: [x, this.tileTop(x, z) - TILE_H / 2, z],
          color: hexIsRoad(x, z) ? PALETTE.road : this.groundColor(x, z, biomeAt(x, z)),
        });
      }
    }
    return chunk;
  }

  /**
   * Màu một ô đất.
   *
   * Trước đây mỗi ô bốc thăm một trong hai bậc màu của vùng, nên mặt đất là một bàn ca-rô
   * lấm tấm đều khắp. Giờ ba phần tư lấy từ NHIỄU TRƠN cỡ 14 đơn vị — những mảng sáng tối
   * lớn, loang dần như cỏ chỗ dày chỗ thưa — và một phần tư từ hàm băm của riêng ô, để hai ô
   * cạnh nhau vẫn khác nhau một chút.
   *
   * Ô GIÁP RANH pha 25% sang màu của vùng bên kia. Cả hai phía cùng pha nên ranh giới thành
   * một dải chuyển hai ô (100 → 75 → 25 → 0), không còn là một đường cắt thẳng tắp ở mép
   * vùng 90×90. Thử 35% thì giữa đồng cỏ và cao nguyên hiện ra một dải xám lam — xanh trộn
   * tím ra xám — đọc nhầm thành một dải vách đá.
   */
  private groundColor(x: number, z: number, b: BiomeId): number {
    const [c0, c1] = BIOMES[b].ground;
    const k = valueNoise(x, z, 14, 31) * 0.75 + hash2(Math.round(x * 2), Math.round(z * 2), 11) * 0.25;
    this.color.setHex(c0).lerp(this.fogC.setHex(c1), k);
    let n = 0;
    this.mixC.setRGB(0, 0, 0);
    for (const [dx, dz] of KE) {
      const nb = biomeAt(x + dx, z + dz);
      if (nb === b) continue;
      this.mixC.add(this.fogC.setHex(BIOMES[nb].ground[0]));
      n += 1;
    }
    if (n > 0) this.color.lerp(this.mixC.multiplyScalar(1 / n), 0.25);
    return this.color.getHex();
  }

  /**
   * Bố cục của một khối: bãi, nền đất, props. Hàm thuần của toạ độ khối, có bộ nhớ đệm.
   *
   * GIỮ NGUYÊN THỨ TỰ RÚT SỐ NGẪU NHIÊN của bản trước — trang trí bãi, rồi nền đất, rồi trang
   * trí rải rác — vì mã nền đất (p_cx_cz_k) và vị trí của nó đã nằm trong bản lưu của người
   * chơi. Đổi thứ tự rút là mọi căn nhà đã xây trỏ vào một nền không còn tồn tại.
   */
  private layoutOf(cx: number, cz: number): Layout {
    const key = chunkKey(cx, cz);
    const cached = this.layouts.get(key);
    if (cached) return cached;

    const ox = cx * CHUNK;
    const oz = cz * CHUNK;
    const layout: Layout = { patches: patchesOf(cx, cz), plots: [], props: [] };
    const r = chunkRng(cx, cz);

    // --- bãi tài nguyên ---
    for (const p of layout.patches) this.dressPatch(layout, p, r);

    // --- nền đất ---
    const nen = (id: string, x: number, z: number, core: boolean): Plot => ({
      id, position: [x, levelAtCenter(x, z), z], biome: biomeAt(x, z), core,
    });
    if (cx === 0 && cz === 0) {
      layout.plots.push(nen('core', 0, 0, true));
      for (const [px, pz] of CORE_PLOTS) {
        layout.plots.push(nen(`p_0_0_${px}_${pz}`, px, pz, false));
      }
    } else {
      /*
       * Một tới ba nền mỗi khối.
       *
       * Bản trước chỉ 32% số khối có nền, và nền ấy còn bị loại nếu rơi trúng đường hay
       * trúng bãi — đo ra 26 nền trên 121 khối đang nạp. Chơi một giờ là hết chỗ xây.
       */
      const soNen = r() < 0.3 ? 3 : r() < 0.7 ? 2 : 1;
      for (let k = 0; k < soNen; k += 1) {
        const x = Math.round(ox + 5 + r() * (CHUNK - 10));
        const z = Math.round(oz + 5 + r() * (CHUNK - 10));
        if (onRoad(x, z)) continue;
        if (layout.patches.some((p) =>
          Math.hypot(p.center[0] - x, p.center[2] - z) < p.radius + 4)) continue;
        // Hai nền chồng lên nhau thì bấm vào không biết trúng cái nào.
        if (layout.plots.some((q) => Math.hypot(q.position[0] - x, q.position[2] - z) < 7)) continue;
        layout.plots.push(nen(`p_${cx}_${cz}_${k}`, x, z, false));
      }
    }

    // --- trang trí thưa ngoài bãi ---
    const biome = biomeAt(ox + CHUNK / 2, oz + CHUNK / 2);
    for (let i = 0; i < 14; i += 1) {
      const x = ox + r() * CHUNK;
      const z = oz + r() * CHUNK;
      if (onRoad(x, z)) continue;
      if (layout.patches.some((p) =>
        Math.hypot(p.center[0] - x, p.center[2] - z) < p.radius + 2)) continue;
      const b = biomeAt(x, z);
      if (b === 'desert') {
        if (r() < 0.3) layout.props.push({ key: 'palm', pos: [x, 0, z], scale: 0.8 + r() * 0.5, rot: r() * 6, color: r() < 0.5 ? PALETTE.palm : PALETTE.cactus });
      } else if (b === 'crags') {
        if (r() < 0.5) layout.props.push({ key: 'rock', pos: [x, 0.15, z], scale: 0.18 + r() * 0.2, rot: r() * 6, color: PALETTE.graniteDark });
      } else {
        layout.props.push({ key: 'tuft', pos: [x, 0.1, z], scale: 0.55 + r() * 0.7, rot: r() * 6, color: biome === 'highlands' ? 0x6f5fd0 : 0x62aa4e });
      }
    }

    this.decorate(layout, cx, cz);

    this.layouts.set(key, layout);
    return layout;
  }

  /**
   * Hoa, bụi và vài cây lẻ cho đồng cỏ — thứ làm khoảng trống giữa các bãi bớt trơ.
   *
   * Rút từ một chuỗi ngẫu nhiên RIÊNG (muối 17), không đụng chuỗi chính: chuỗi chính quyết
   * định vị trí và mã nền đất, mà mã nền đất nằm trong bản lưu. Rút thêm một số ở chuỗi chính
   * là mọi căn nhà đã xây trỏ vào một nền không còn tồn tại. Mỗi lượt rút đủ sáu số TRƯỚC khi
   * xét điều kiện, nên đổi luật gạt sau này cũng không làm xô lệch các lượt sau.
   *
   * Tránh cả bãi của tám khối xung quanh (lòng bãi tràn qua ranh giới khối) và năm nền của thủ
   * phủ (chúng nằm vắt sang ba khối khác, không có trong bố cục của khối đang xét).
   */
  private decorate(layout: Layout, cx: number, cz: number): void {
    const ox = cx * CHUNK;
    const oz = cz * CHUNK;
    const bai: Patch[] = [];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) bai.push(...(dx || dz ? patchesOf(cx + dx, cz + dz) : layout.patches));
    }
    const rr = chunkRng(cx, cz, 17);
    for (let i = 0; i < 26; i += 1) {
      const x = ox + rr() * CHUNK;
      const z = oz + rr() * CHUNK;
      const loai = rr();
      const sc = rr();
      const rot = rr() * 6;
      const mau = rr();
      if (biomeAt(x, z) !== 'meadow' || onRoad(x, z)) continue;
      if (bai.some((p) => Math.hypot(p.center[0] - x, p.center[2] - z) < p.radius + 1.5)) continue;
      if (layout.plots.some((q) => Math.hypot(q.position[0] - x, q.position[2] - z) < PLOT_FLAT_R)) continue;
      if (Math.hypot(x, z) < PLOT_FLAT_R + 1) continue;
      if (CORE_PLOTS.some(([px, pz]) => Math.hypot(px - x, pz - z) < PLOT_FLAT_R)) continue;
      if (loai < 0.1) {
        layout.props.push({ key: 'leaf', pos: [x, 0, z], scale: 0.7 + sc * 0.35, rot, color: PALETTE.leaf[Math.floor(mau * 3)] });
      } else if (loai < 0.36) {
        layout.props.push({ key: 'bush', pos: [x, 0, z], scale: 0.8 + sc * 0.6, rot, color: PALETTE.bush[Math.floor(mau * 2)] });
      } else {
        layout.props.push({ key: 'flower', pos: [x, 0, z], scale: 1 + sc * 0.5, rot, color: PALETTE.flowers[Math.floor(mau * 4)] });
      }
    }
  }

  /** Props bên trong một bãi: dày, cao, và bám sát vùng đất của nó. */
  private dressPatch(layout: Layout, p: Patch, r: () => number): void {
    const [x, , z] = p.center;
    const put = (key: PropKey, dx: number, dy: number, dz: number, scale: number, color: number) => {
      layout.props.push({ key, pos: [x + dx, dy, z + dz], scale, rot: r() * 6, color });
      /*
       * Quầng sáng đi kèm pha lê và quặng. Không rút số nào: chuỗi ngẫu nhiên giữ nguyên.
       *
       * Quầng LÙI ra sau viên đá theo hướng nhìn, nên chính viên đá che phần giữa và ánh sáng
       * chỉ còn toả quanh viền, như được rọi từ phía sau. Đặt ngay tâm thì quầng phủ lên chính
       * nó: chín viên một rừng cộng dồn lại, cả rừng pha lê bạc trắng mất màu tím.
       */
      if (key === 'spire' || key === 'ore') {
        const tinh = key === 'spire';
        const lui = (tinh ? 1.0 : 0.6) * scale;
        layout.props.push({
          key: 'glow',
          pos: [x + dx - VIEW.x * lui, dy + (tinh ? 1.5 * scale : 0) - VIEW.y * lui, z + dz - VIEW.z * lui],
          scale: (tinh ? 1.8 : 1.4) * scale,
          rot: 0,
          color: tinh ? PALETTE.crystalGlow : PALETTE.goldOre,
        });
      }
    };
    const rai = (n: number, fn: (a: number, d: number) => void) => {
      for (let i = 0; i < n; i += 1) fn(r() * Math.PI * 2, Math.sqrt(r()) * p.radius * 0.88);
    };

    switch (p.kind) {
      case 'wood':
        /*
         * Rừng đồng cỏ là rừng HỖN GIAO: chừng một phần ba là cây tán tròn. Chọn loại bằng hàm
         * băm theo vị trí chứ không rút thêm số — mỗi cây vẫn rút đúng năm số (góc, khoảng
         * cách, cỡ, màu, hướng) theo đúng thứ tự cũ, nên nền đất rút sau đó không xê dịch.
         */
        rai(16, (a, d) => {
          const sc = 0.85 + r() * 0.6;
          const ci = Math.floor(r() * 3);
          const dx = Math.cos(a) * d;
          const dz = Math.sin(a) * d;
          const tron = p.biome === 'meadow'
            && hash2(Math.round((x + dx) * 7), Math.round((z + dz) * 7), 41) < 0.34;
          put(tron ? 'leaf' : 'pine', dx, 0, dz, tron ? sc * 0.92 : sc, (tron ? PALETTE.leaf : PALETTE.pine)[ci]);
        });
        break;
      case 'food':
        rai(14, (a, d) => put('wheat', Math.cos(a) * d, 0, Math.sin(a) * d,
          0.85 + r() * 0.4, r() < 0.25 ? PALETTE.berry : PALETTE.wheat));
        break;
      case 'stone':
        rai(13, (a, d) => put('rock', Math.cos(a) * d, 0.3 + r() * 0.4, Math.sin(a) * d,
          0.4 + r() * 0.75, r() < 0.3 ? PALETTE.iron : (r() < 0.5 ? PALETTE.granite : PALETTE.graniteDark)));
        break;
      case 'gold':
        rai(7, (a, d) => put('rock', Math.cos(a) * d, 0.3, Math.sin(a) * d, 0.4 + r() * 0.4, PALETTE.sand));
        rai(8, (a, d) => put('ore', Math.cos(a) * d, 0.7 + r() * 0.6, Math.sin(a) * d, 0.35 + r() * 0.35, PALETTE.goldOre));
        break;
      case 'relics':
        rai(9, (a, d) => put('spire', Math.cos(a) * d, 0, Math.sin(a) * d, 0.7 + r() * 0.9, PALETTE.crystal));
        break;
    }
  }

  // ------------------------------------------------------------------ tra cứu

  get patches(): Patch[] {
    const out: Patch[] = [];
    for (const c of this.chunks.values()) out.push(...c.patches);
    return out;
  }

  get plots(): Plot[] {
    const out: Plot[] = [];
    for (const c of this.chunks.values()) out.push(...c.plots);
    return out;
  }

  patchById(id: string): Patch | undefined {
    for (const c of this.chunks.values()) {
      for (const p of c.patches) if (p.id === id) return p;
    }
    return undefined;
  }

  plotById(id: string): Plot | undefined {
    for (const c of this.chunks.values()) {
      const p = c.plots.find((x) => x.id === id);
      if (p) return p;
    }
    return undefined;
  }

  private tho = 0;

  /*
   * KHÔNG quay khối pha lê nữa. Bản trước làm `meshes.spire.rotation.y += dt * 0.12` — tức
   * quay CẢ InstancedMesh quanh gốc toạ độ thế giới, không phải quay từng tinh thể quanh
   * chính nó. Mọi tinh thể vì thế trôi vòng quanh thủ phủ: đo được sau 34° thì tinh thể gần
   * tâm rừng pha lê nhất nằm cách 62,9 đơn vị, trong khi bán kính rừng là 4,8. Rừng pha lê
   * nào cũng trống trơn, còn tinh thể của chúng lang thang khắp bản đồ.
   */
  animate(dt: number): void {
    // Quầng bãi thở rất chậm và rất nhẹ. Mạnh hơn nữa thì cả bản đồ nhấp nháy, mà bản đồ
    // này có tới hai trăm bãi cùng lúc — một nhịp đập đồng loạt sẽ thành thứ gây nhiễu.
    this.tho += dt;
    WIND.value += dt;
    const mat = this.meshes.halo.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.78 + Math.sin(this.tho * 1.25) * 0.1;

    // Hoạt cảnh vén: chỉ cập nhật đúng các phần tử của khối đang vén, không đụng phần còn lại.
    for (const [key, t0] of this.revealing) {
      const t = t0 + dt;
      const chunk = this.chunks.get(key);
      const start = this.ranges.get(key);
      if (!chunk || !start || t >= REVEAL_SECONDS + chunk.props.length * 0.006) {
        this.revealing.delete(key);
        if (chunk && start) this.paintReveal(chunk, start, 1e9);
        continue;
      }
      this.revealing.set(key, t);
      this.paintReveal(chunk, start, t);
    }
  }

  private paintReveal(chunk: Chunk, start: Record<PropKey, number>, t: number): void {
    const kDat = this.kDat(t);
    chunk.tiles.forEach((tile, i) => {
      this.meshes.tile.setColorAt(start.tile + i, this.tint(tile.color, kDat));
    });
    chunk.patches.forEach((p, i) => {
      this.meshes.halo.setMatrixAt(start.halo + i, this.haloMatrix(p, this.kQuang(t, i)));
    });
    const seen = {} as Record<PropKey, number>;
    chunk.props.forEach((pr, i) => {
      const j = seen[pr.key] ?? 0;
      seen[pr.key] = j + 1;
      this.meshes[pr.key].setMatrixAt(start[pr.key] + j, this.propMatrix(pr, this.kMoc(t, i)));
    });
    if (this.meshes.tile.instanceColor) this.meshes.tile.instanceColor.needsUpdate = true;
    for (const k of Object.keys(CAP) as PropKey[]) this.meshes[k].instanceMatrix.needsUpdate = true;
  }

  // -------------------------------------------------- hình học đã hàn sẵn

  /** Thân cộng ba tán, HÀN thành một hình học — không hàn thì một cây là bốn lệnh vẽ. */
  private pineGeometry(): THREE.BufferGeometry {
    const trunk = new THREE.CylinderGeometry(0.14, 0.2, 0.9, 5);
    trunk.translate(0, 0.45, 0);
    const parts = [paint(trunk, PALETTE.trunk)];
    for (const [y, rad, h] of [[1.15, 0.95, 1.2], [1.9, 0.72, 1.0], [2.5, 0.48, 0.8]] as const) {
      const cone = new THREE.ConeGeometry(rad, h, 6);
      cone.translate(0, y, 0);
      parts.push(paint(cone, null));
    }
    return han(parts);
  }

  /** Cây tán tròn: thân thấp, hai khối tán lệch nhau cho dáng không đối xứng. */
  private leafGeometry(): THREE.BufferGeometry {
    const trunk = new THREE.CylinderGeometry(0.11, 0.17, 1.2, 5).toNonIndexed();
    trunk.translate(0, 0.6, 0);
    const tan = new THREE.IcosahedronGeometry(0.88, 0);
    tan.scale(1, 0.9, 1);
    tan.translate(0, 1.72, 0);
    const tan2 = new THREE.IcosahedronGeometry(0.52, 0);
    tan2.translate(0.5, 1.32, 0.18);
    return han([paint(trunk, PALETTE.trunk), paint(tan, null), paint(tan2, null)]);
  }

  /** Bụi: ba khối tròn thấp chụm vào nhau. */
  private bushGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    for (const [r, x, y, z, dep] of [[0.55, 0, 0.36, 0, 0.78], [0.4, 0.46, 0.26, 0.12, 0.8], [0.34, -0.3, 0.24, 0.36, 1]] as const) {
      const g = new THREE.IcosahedronGeometry(r, 0);
      g.scale(1, dep, 1);
      g.translate(x, y, z);
      parts.push(g);
    }
    return han(parts);
  }

  /**
   * Một khóm năm bông: thân xanh cố định, bông trắng để nhận màu của bản.
   *
   * Bông TO và DẸT, thân ngắn và nhạt: nhìn từ trên xuống thứ cần đọc ra là một chấm màu.
   * Bản đầu bông 0,1 trên thân sẫm cao 0,42 — ở mức phóng gần nhất trông như mấy que tăm
   * cắm xuống cỏ, chẳng ai nhận ra là hoa.
   */
  private flowerGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    for (const [x, z, h] of [[0, 0, 0.34], [0.24, 0.1, 0.27], [-0.17, 0.22, 0.24], [0.08, -0.26, 0.29], [-0.28, -0.12, 0.21]] as const) {
      const than = new THREE.CylinderGeometry(0.02, 0.026, h, 3, 1, true).toNonIndexed();
      than.translate(x, h / 2, z);
      parts.push(paint(than, PALETTE.leaf[1]));
      const bong = new THREE.OctahedronGeometry(0.16, 0);
      bong.scale(1, 0.62, 1);
      bong.translate(x, h + 0.05, z);
      parts.push(paint(bong, null));
    }
    return han(parts);
  }

  private wheatGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    for (const [dx, dz] of [[0, 0], [0.26, 0.12], [-0.2, 0.22]] as const) {
      const sheaf = new THREE.CylinderGeometry(0.1, 0.22, 0.85, 5);
      sheaf.translate(dx, 0.42, dz);
      parts.push(sheaf);
    }
    return mergeGeometries(parts, false) ?? parts[0];
  }

  private spireGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const main = new THREE.ConeGeometry(0.5, 3.2, 5);
    main.translate(0, 1.6, 0);
    parts.push(main);
    const side = new THREE.ConeGeometry(0.3, 1.8, 5);
    side.translate(0.55, 0.9, 0.2);
    parts.push(side);
    return mergeGeometries(parts, false) ?? main;
  }

  private palmGeometry(): THREE.BufferGeometry {
    const trunk = new THREE.CylinderGeometry(0.1, 0.16, 1.9, 5);
    trunk.translate(0, 0.95, 0);
    const parts = [paint(trunk, PALETTE.trunk)];
    for (let i = 0; i < 5; i += 1) {
      const frond = new THREE.ConeGeometry(0.22, 1.25, 4);
      frond.rotateZ(Math.PI / 2.4);
      frond.rotateY((i / 5) * Math.PI * 2);
      frond.translate(0, 1.95, 0);
      parts.push(paint(frond, null));
    }
    return han(parts);
  }

  dispose(): void {
    for (const mesh of Object.values(this.meshes)) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.tileBevel.dispose();
    this.tileFlat.dispose();
  }
}

/**
 * Ô lục giác vát mép trên, KHÔNG có đáy (đáy chôn sâu dưới các ô kề, không ai nhìn thấy).
 * `vatCao` bằng 0 thì không vát: thành và mặt, 18 tam giác.
 *
 * Ghép tay thay cho LatheGeometry: lathe sinh thêm một tam giác suy biến cho mỗi cạnh ở tâm
 * mặt trên. Ba mươi tam giác mỗi ô — thành, mép vát, mặt — so với hai mươi tư của hình trụ
 * cũ, mà hình trụ cũ còn phí sáu cho cái đáy.
 *
 * Đỉnh ở góc π/6 + kπ/3, cùng quy ước x = r·sinφ, z = r·cosφ với CylinderGeometry, nên cạnh
 * phẳng quay về ±Z như lưới cần (xem chú thích ở constructor). Mặt nào cũng có pháp tuyến
 * riêng: mép vát phải bắt sáng thành một viền sắc, không được nội suy loang sang mặt trên.
 */
function hexTile(r: number, h: number, vatCao: number, vatRong: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const dinh = (rad: number, y: number, k: number): number[] => {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    return [rad * Math.sin(a), y, rad * Math.cos(a)];
  };
  const tamGiac = (...p: number[][]): void => { for (const v of p) pos.push(...v); };
  const day = -h / 2;
  const vai = h / 2 - vatCao;
  const mat = h / 2;
  const trong = r - vatRong;
  for (let k = 0; k < 6; k += 1) {
    const a0 = dinh(r, day, k);
    const a1 = dinh(r, day, k + 1);
    if (vatCao <= 0) {
      const m0 = dinh(r, mat, k);
      const m1 = dinh(r, mat, k + 1);
      tamGiac(a0, a1, m0);
      tamGiac(m1, m0, a1);
      tamGiac(m0, m1, [0, mat, 0]);
      continue;
    }
    const b0 = dinh(r, vai, k);
    const b1 = dinh(r, vai, k + 1);
    const c0 = dinh(trong, mat, k);
    const c1 = dinh(trong, mat, k + 1);
    tamGiac(a0, a1, b0);
    tamGiac(b1, b0, a1);
    tamGiac(b0, b1, c0);
    tamGiac(c1, c0, b1);
    tamGiac(c0, c1, [0, mat, 0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Tô cả một phần hình bằng một màu đỉnh; null là trắng — tức nhận màu của bản (xem sway). */
function paint(geo: THREE.BufferGeometry, hex: number | null): THREE.BufferGeometry {
  const c = new THREE.Color(hex ?? 0xffffff);
  const n = geo.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

/**
 * Hàn nhiều phần thành một hình. Ném lỗi thay vì lặng lẽ trả về một phần: mergeGeometries trả
 * null khi các phần lệch thuộc tính (một phần có màu đỉnh, phần kia không; một phần có chỉ
 * mục, phần kia không), và bản cũ `?? trunk` sẽ biến cả cây thành một cái thân trơ trọi.
 */
function han(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('han: cac phan lech thuoc tinh');
  return g;
}
