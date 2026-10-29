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
import { gem, matte, metal, haloTexture } from './materials';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES, PALETTE, RESOURCES } from './config';
import type { Patch, Plot, Vec3 } from './types';
import {
  CHUNK, HEX_R, HEX_STEP_X, HEX_STEP_Z, KEEP_RADIUS, LOAD_RADIUS, PLOT_FLAT_R,
  biomeAt, chunkKey, chunkOf, chunkRng, hash2, hexCenterAt, hexIsRoad, levelAtCenter,
  naturalTop, onRoad, patchFlatR, patchesOf,
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
} as const;

type PropKey = keyof typeof CAP;

/**
 * Cột ô cao 6 chứ không phải 2,6. San phẳng có thể đặt hai ô cạnh nhau chênh nhau hơn ba đơn
 * vị ở vách đá, và cột thấp hơn độ chênh thì đáy của ô cao lơ lửng phía trên mặt ô thấp —
 * để lộ một khe nhìn xuyên xuống. Cột cao thêm không tốn thêm tam giác nào.
 */
const TILE_H = 6;

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
  private lastCenter = '';

  /** Đổi mỗi khi tập khối thay đổi — Game dựa vào đây để dựng lại nền đất. */
  version = 0;

  constructor() {
    const make = (key: PropKey, geo: THREE.BufferGeometry, material: THREE.Material, shadow: boolean) => {
      const mesh = new THREE.InstancedMesh(geo, material, CAP[key]);
      mesh.castShadow = shadow;
      mesh.receiveShadow = key === 'tile';
      mesh.frustumCulled = false;
      mesh.renderOrder = key === 'halo' ? 1 : 0;
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
    make('tile', new THREE.CylinderGeometry(HEX_R, HEX_R, TILE_H, 6, 1, false, Math.PI / 6), matte(), false);

    // Quầng của bãi: một hình vuông phẳng mang ảnh gradient tròn. Đây là thứ khiến một bãi
    // đọc được ngay từ mức phóng xa nhất, khi props đã nhỏ như hạt vừng.
    const halo = new THREE.PlaneGeometry(2, 2);
    halo.rotateX(-Math.PI / 2);
    make('halo', halo, new THREE.MeshBasicMaterial({
      map: haloTexture(),
      transparent: true, depthWrite: false, opacity: 0.85,
      blending: THREE.NormalBlending,
    }), false);

    make('pine', this.pineGeometry(), matte(undefined, true), true);
    make('wheat', this.wheatGeometry(), matte(undefined, true), true);
    make('rock', new THREE.DodecahedronGeometry(1, 0), matte(undefined, true), true);
    // Quặng vàng là phần kim loại duy nhất của thế giới, nên cũng là ngoại lệ duy nhất
    // của trần kim loại 0,2.
    make('ore', new THREE.OctahedronGeometry(0.75, 0), metal(PALETTE.goldOre, PALETTE.goldOre), true);
    make('spire', this.spireGeometry(), gem(PALETTE.crystal, PALETTE.crystalGlow), true);
    make('palm', this.palmGeometry(), matte(undefined, true), true);
    make('tuft', new THREE.ConeGeometry(0.22, 0.5, 4), matte(), false);
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

  /** InstancedMesh mới với sức chứa lớn hơn, dùng lại hình học và vật liệu của cái cũ. */
  private regrow(key: PropKey, need: number): void {
    const old = this.meshes[key];
    const n = Math.ceil(need * 1.3);
    const mesh = new THREE.InstancedMesh(old.geometry, old.material, n);
    mesh.castShadow = old.castShadow;
    mesh.receiveShadow = old.receiveShadow;
    mesh.frustumCulled = false;
    mesh.renderOrder = old.renderOrder;
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
    const put = (key: PropKey, mat: THREE.Matrix4, color: number) => {
      const i = used[key];
      this.meshes[key].setMatrixAt(i, mat);
      this.meshes[key].setColorAt(i, this.color.setHex(color));
      used[key] = i + 1;
    };

    for (const chunk of this.chunks.values()) {
      for (const t of chunk.tiles) {
        put('tile', this.m.makeTranslation(t.pos[0], t.pos[1], t.pos[2]), t.color);
      }
      for (const p of chunk.patches) {
        // Quầng nằm ngay trên khoảnh đất đã san của bãi. Rộng hơn bãi một chút, vì phần
        // ngoài cùng của ảnh gradient đã tắt gần hết.
        this.v.set(p.center[0], p.center[1] + 0.06, p.center[2]);
        this.q.identity();
        this.s.set(p.radius * 1.16, 1, p.radius * 1.16);
        put('halo', this.m.compose(this.v, this.q, this.s), RESOURCES[p.kind].color);
      }
      for (const pr of chunk.props) {
        this.v.set(pr.pos[0], this.groundY(pr.pos[0], pr.pos[2]) + pr.pos[1], pr.pos[2]);
        this.q.setFromAxisAngle(this.axis, pr.rot);
        this.s.setScalar(pr.scale);
        put(pr.key, this.m.compose(this.v, this.q, this.s), pr.color);
      }
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
        const b = biomeAt(x, z);
        const mix = hash2(Math.round(x * 2), Math.round(z * 2), 11) > 0.5 ? 0 : 1;
        chunk.tiles.push({
          pos: [x, this.tileTop(x, z) - TILE_H / 2, z],
          color: hexIsRoad(x, z) ? PALETTE.road : BIOMES[b].ground[mix],
        });
      }
    }
    return chunk;
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
      for (const [px, pz] of [[-9, -8], [9, -8], [-9, 8], [9, 8]] as const) {
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

    this.layouts.set(key, layout);
    return layout;
  }

  /** Props bên trong một bãi: dày, cao, và bám sát vùng đất của nó. */
  private dressPatch(layout: Layout, p: Patch, r: () => number): void {
    const [x, , z] = p.center;
    const put = (key: PropKey, dx: number, dy: number, dz: number, scale: number, color: number) => {
      layout.props.push({ key, pos: [x + dx, dy, z + dz], scale, rot: r() * 6, color });
    };
    const rai = (n: number, fn: (a: number, d: number) => void) => {
      for (let i = 0; i < n; i += 1) fn(r() * Math.PI * 2, Math.sqrt(r()) * p.radius * 0.88);
    };

    switch (p.kind) {
      case 'wood':
        rai(16, (a, d) => put('pine', Math.cos(a) * d, 0, Math.sin(a) * d,
          0.85 + r() * 0.6, PALETTE.pine[Math.floor(r() * 3)]));
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
    const mat = this.meshes.halo.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.78 + Math.sin(this.tho * 1.25) * 0.1;
  }

  // -------------------------------------------------- hình học đã hàn sẵn

  /** Thân cộng ba tán, HÀN thành một hình học — không hàn thì một cây là bốn lệnh vẽ. */
  private pineGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const trunk = new THREE.CylinderGeometry(0.14, 0.2, 0.9, 5);
    trunk.translate(0, 0.45, 0);
    parts.push(trunk);
    for (const [y, rad, h] of [[1.15, 0.95, 1.2], [1.9, 0.72, 1.0], [2.5, 0.48, 0.8]] as const) {
      const cone = new THREE.ConeGeometry(rad, h, 6);
      cone.translate(0, y, 0);
      parts.push(cone);
    }
    return mergeGeometries(parts, false) ?? trunk;
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
    const parts: THREE.BufferGeometry[] = [];
    const trunk = new THREE.CylinderGeometry(0.1, 0.16, 1.9, 5);
    trunk.translate(0, 0.95, 0);
    parts.push(trunk);
    for (let i = 0; i < 5; i += 1) {
      const frond = new THREE.ConeGeometry(0.22, 1.25, 4);
      frond.rotateZ(Math.PI / 2.4);
      frond.rotateY((i / 5) * Math.PI * 2);
      frond.translate(0, 1.95, 0);
      parts.push(frond);
    }
    return mergeGeometries(parts, false) ?? trunk;
  }

  dispose(): void {
    for (const mesh of Object.values(this.meshes)) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
}
