/**
 * Cảnh Three.js: hòn đảo nổi nhiều tầng, ánh sáng có bóng đổ, vòng render tính theo delta.
 *
 * ĐỔI QUYẾT ĐỊNH CŨ, có chủ ý: bản trước tắt hẳn bóng đổ để chạy nhẹ trên máy văn phòng.
 * Chủ hệ thống yêu cầu bật, nên giờ có bóng thật — nhưng bị siết chặt ở ba chỗ: chỉ MỘT đèn
 * đổ bóng, khung bóng bó sát hòn đảo chứ không phủ cả cảnh, và chỉ vật đáng đổ bóng mới bật
 * `castShadow` (nhà, cây, đá, người) còn mặt đất chỉ NHẬN bóng. Mặt đất mà cũng đổ bóng thì
 * tốn gấp đôi mà không ai nhìn ra khác biệt.
 *
 * Mặt đảo là MỘT InstancedMesh vài trăm ô lục giác, không phải vài trăm mesh. Khác biệt này
 * là khác biệt giữa một lệnh vẽ và vài trăm lệnh vẽ mỗi khung hình.
 */
import * as THREE from 'three';
import {
  BUILDINGS, BUILDING_COLOR, MAX_FRAME_DELTA, PALETTE, RESOURCES, WAYPOINTS,
  resourceNodes, slotWaypointId, tierSpec,
} from './config';
import type { Economy } from './Economy';
import type { Slot } from './types';
import { WorkerManager } from './WorkerManager';

/** Giây cho hoạt cảnh đất mới nhô lên. */
const POP_SECONDS = 0.55;
/** Giây hiện giàn giáo sau khi nâng cấp xong. */
const SCAFFOLD_SECONDS = 1.8;
/** Bán kính một ô cỏ lục giác. To thì ít ô, nhỏ thì mặt đất mịn nhưng tốn. */
const HEX_R = 1.9;

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly workers: WorkerManager;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly economy: Economy;

  private readonly world = new THREE.Group();
  private readonly slotGroups = new Map<string, THREE.Group>();
  private readonly pickable: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private gold: THREE.Mesh[] = [];
  private water: THREE.Mesh | null = null;
  private smoke: THREE.Mesh[] = [];
  private popping = new Map<string, number>();
  private scaffolds = new Map<string, number>();

  private raf: number | null = null;
  private lastTime = 0;
  private elapsed = 0;
  private paused = false;
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private builtTier = 0;

  onSelect: ((slot: Slot | null) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, economy: Economy) {
    this.economy = economy;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    // Chặn tỉ lệ điểm ảnh ở 2: màn Retina 3x không đáng để trả gấp rưỡi số điểm cần tô.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(PALETTE.skyFog, 1);
    // ACES làm màu đậm đà mà không cháy vùng sáng — thứ khiến cảnh đa giác thấp trông "nét".
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.camera.position.set(40, 40, 40);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xade8f4, 0x386641, 0.8));
    const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
    sun.position.set(18, 28, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    // Khung bóng bó sát đảo. Để rộng thì cùng 2048 điểm ảnh phải trải trên diện tích lớn hơn,
    // bóng vỡ răng cưa ngay — mà chẳng để làm gì vì ngoài đảo không có vật nào.
    const d = 34;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 110;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.scene.add(this.world);

    this.rebuildWorld();
    this.workers = new WorkerManager(this.scene, economy);

    this.resize();
    this.watchHud();
    window.addEventListener('resize', this.resize);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
  }

  // ------------------------------------------------------------- dựng cảnh

  rebuildWorld(): void {
    const tierChanged = this.builtTier !== this.economy.state.tier;
    const known = new Set(this.slotGroups.keys());

    this.disposeGroup(this.world);
    this.world.clear();
    this.slotGroups.clear();
    this.pickable.length = 0;
    this.gold = [];
    this.smoke = [];
    this.water = null;

    const size = tierSpec(this.economy.state.tier).groundSize;
    this.buildIsland(size);
    this.buildStreets();
    this.buildResourceNodes();

    for (const slot of this.economy.visibleSlots()) {
      const group = this.buildSlot(slot);
      group.position.set(slot.position[0], 0, slot.position[2]);
      this.world.add(group);
      this.slotGroups.set(slot.id, group);
      if (tierChanged && !known.has(slot.id)) this.popping.set(slot.id, 0);
    }

    this.builtTier = this.economy.state.tier;
    this.applyHighlight();
    this.resize();
  }

  private disposeGroup(root: THREE.Object3D): void {
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    });
  }

  /**
   * Hòn đảo nổi: thảm cỏ lục giác trên cùng, ba bậc vách đá sẫm dần bên dưới, vành nước quanh
   * chân. Cả thảm cỏ là một InstancedMesh — vài trăm ô nhưng đúng một lệnh vẽ.
   */
  private buildIsland(size: number): void {
    const half = size / 2;
    const stepX = HEX_R * 1.5;
    const stepZ = HEX_R * Math.sqrt(3);
    const cols = Math.ceil(size / stepX) + 1;
    const rows = Math.ceil(size / stepZ) + 1;

    const spots: { x: number; z: number }[] = [];
    for (let i = -cols; i <= cols; i += 1) {
      for (let j = -rows; j <= rows; j += 1) {
        const x = i * stepX;
        const z = j * stepZ + (i % 2 ? stepZ / 2 : 0);
        // Viền bo tròn: cắt theo khoảng cách Chebyshev pha với Euclid, nên đảo vuông mà mềm góc.
        const soft = Math.max(Math.abs(x), Math.abs(z)) * 0.72 + Math.hypot(x, z) * 0.28;
        if (soft <= half) spots.push({ x, z });
      }
    }

    const geo = new THREE.CylinderGeometry(HEX_R, HEX_R, 1.1, 6);
    // KHONG bat vertexColors o day. Mau theo tung o di qua instanceColor, ma three tu bat
    // dinh nghia USE_INSTANCING_COLOR khi thay thuoc tinh do; bat them vertexColors lam shader
    // doi mot thuoc tinh mau DINH von khong co tren hinh hoc nay, va ca canh dong ra mau den.
    const mat = new THREE.MeshLambertMaterial();
    const field = new THREE.InstancedMesh(geo, mat, spots.length);
    field.receiveShadow = true;
    field.castShadow = false;

    const m = new THREE.Matrix4();
    const a = new THREE.Color(PALETTE.grassA);
    const b = new THREE.Color(PALETTE.grassB);
    spots.forEach((s, i) => {
      // Nhấp nhô rất nhẹ cho mặt đất có hơi thở; quá tay thì nhà đứng chênh vênh.
      const lift = (Math.sin(s.x * 0.7) + Math.cos(s.z * 0.55)) * 0.035;
      m.makeTranslation(s.x, -0.55 + lift, s.z);
      field.setMatrixAt(i, m);
      const mix = (Math.sin(s.x * 1.3) + Math.cos(s.z * 1.7) + 2) / 4;
      field.setColorAt(i, mix > 0.5 ? a : b);
    });
    field.instanceMatrix.needsUpdate = true;
    if (field.instanceColor) field.instanceColor.needsUpdate = true;
    this.world.add(field);

    // Ba bậc vách đá, mỗi bậc thụt vào và sẫm hơn.
    // Bac duoi thut vao kha nhieu va cao hon bac tren: nhin cheo tu tren xuong thi mat
    // dung bi nen lai, bac thap qua la ca vach da bien thanh mot vien chi.
    const terraces: [number, number, number][] = [
      [size * 1.0, 2.2, PALETTE.cliffTop],
      [size * 0.84, 2.8, PALETTE.cliffMid],
      [size * 0.6, 3.4, PALETTE.cliffLow],
    ];
    let y = -1.1;
    for (const [w, h, color] of terraces) {
      const step = new THREE.Mesh(
        new THREE.CylinderGeometry(w / 2, w / 2 - 0.9, h, 6),
        new THREE.MeshLambertMaterial({ color, flatShading: true }));
      step.rotation.y = Math.PI / 6;
      step.position.y = y - h / 2;
      step.receiveShadow = true;
      this.world.add(step);
      y -= h;
    }

    // Mạch vàng lộ ra trên vách: vài khối bé gắn vào bậc trên cùng.
    const veinMat = new THREE.MeshStandardMaterial({
      color: PALETTE.goldVein, roughness: 0.25, metalness: 0.1,
      emissive: PALETTE.goldVein, emissiveIntensity: 0.3,
    });
    const veinGeo = new THREE.OctahedronGeometry(0.26, 0);
    for (let i = 0; i < 10; i += 1) {
      const ang = (i / 10) * Math.PI * 2 + 0.4;
      const r = size * 0.47;
      const v = new THREE.Mesh(veinGeo, veinMat);
      v.position.set(Math.cos(ang) * r, -1.6 - (i % 3) * 0.5, Math.sin(ang) * r);
      v.rotation.set(i, i * 1.7, 0);
      this.world.add(v);
    }

    // Vành nước quanh chân đảo. Nhấp nhô bằng cách nâng hạ cả vành, rẻ hơn hẳn so với làm
    // sóng trên lưới đỉnh, mà ở cỡ này nhìn ra y như nhau.
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.58, size * 0.58, 0.5, 6),
      new THREE.MeshLambertMaterial({
        color: PALETTE.water, transparent: true, opacity: 0.55,
      }));
    rim.rotation.y = Math.PI / 6;
    rim.position.y = -6.4;
    this.world.add(rim);
    this.water = rim;
  }

  /** Đường đi vẽ từ chính đồ thị, nên cái nhìn thấy đúng là cái thợ đi được. */
  private buildStreets(): void {
    const material = new THREE.MeshLambertMaterial({ color: PALETTE.path });
    const drawn = new Set<string>();
    const visible = new Set(this.economy.visibleSlots().map((s) => slotWaypointId(s.id)));

    for (const w of WAYPOINTS) {
      for (const toId of w.links) {
        const other = WAYPOINTS.find((x) => x.id === toId);
        if (!other) continue;
        if (w.id.startsWith('at_') && !visible.has(w.id)) continue;
        if (other.id.startsWith('at_') && !visible.has(other.id)) continue;
        const key = [w.id, toId].sort().join('|');
        if (drawn.has(key)) continue;
        drawn.add(key);

        const a = w.position;
        const b = other.position;
        const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
        if (length < 0.01) continue;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, length), material);
        strip.position.set((a[0] + b[0]) / 2, 0.02, (a[2] + b[2]) / 2);
        strip.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]);
        strip.receiveShadow = true;
        this.world.add(strip);
      }
    }
  }

  private buildResourceNodes(): void {
    const level = this.economy.state.level;
    for (const node of resourceNodes(this.economy.state.tier)) {
      const group = new THREE.Group();
      group.position.set(node.position[0], 0, node.position[2]);
      const locked = node.unlockLevel > level;
      const fade = (c: number) =>
        locked ? new THREE.Color(c).lerp(new THREE.Color(PALETTE.grassA), 0.6).getHex() : c;

      if (node.kind === 'wood') this.buildPines(group, fade);
      else if (node.kind === 'stone') this.buildGranite(group, fade);
      else this.buildGoldRocks(group, fade, locked);

      this.world.add(group);
    }
  }

  /** Rừng thông tí hon: 5 cây, mỗi cây ba nón chồng, ba sắc xanh khác nhau. */
  private buildPines(group: THREE.Group, fade: (c: number) => number): void {
    const trunkMat = new THREE.MeshLambertMaterial({ color: fade(PALETTE.trunk) });
    const shades = [PALETTE.pineA, PALETTE.pineB, PALETTE.pineC];
    const spots: [number, number, number][] = [
      [0, 0, 1.15], [-1.25, -0.7, 0.92], [1.3, -0.5, 0.85], [-0.55, 1.25, 0.78], [0.85, 1.2, 0.7],
    ];
    for (const [dx, dz, scale] of spots) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.75, 6), trunkMat);
      trunk.position.y = 0.37;
      trunk.castShadow = true;
      tree.add(trunk);

      const leafMat = new THREE.MeshLambertMaterial({
        color: fade(shades[Math.abs(Math.round(dx * 3 + dz * 2)) % 3]), flatShading: true,
      });
      for (const [y, r, h] of [[1.0, 0.86, 1.0], [1.62, 0.66, 0.9], [2.14, 0.44, 0.75]] as const) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), leafMat);
        cone.position.y = y;
        cone.castShadow = true;
        tree.add(cone);
      }
      tree.position.set(dx, 0, dz);
      tree.scale.setScalar(scale);
      group.add(tree);
    }
  }

  /** Mỏ đá tảng: khối granit vát cạnh, cộng dăm đá vụn rải dưới chân. */
  private buildGranite(group: THREE.Group, fade: (c: number) => number): void {
    const mat = new THREE.MeshLambertMaterial({ color: fade(PALETTE.granite), flatShading: true });
    const dark = new THREE.MeshLambertMaterial({ color: fade(PALETTE.graniteDark), flatShading: true });
    const rocks: [number, number, number, number][] = [
      [0, 0.62, 0, 0.95], [1.25, 0.4, 0.45, 0.62], [-1.0, 0.34, -0.6, 0.5], [0.3, 0.28, -1.25, 0.42],
    ];
    for (const [x, y, z, s] of rocks) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), x === 0 ? mat : dark);
      rock.position.set(x, y, z);
      rock.rotation.set(x * 1.3, y * 2.1, z * 0.8);
      rock.castShadow = true;
      group.add(rock);
    }
    const chipGeo = new THREE.TetrahedronGeometry(0.17, 0);
    for (let i = 0; i < 6; i += 1) {
      const ang = (i / 6) * Math.PI * 2;
      const chip = new THREE.Mesh(chipGeo, dark);
      chip.position.set(Math.cos(ang) * 1.7, 0.09, Math.sin(ang) * 1.7);
      chip.rotation.set(i, i * 2, i * 0.5);
      group.add(chip);
    }
  }

  /**
   * Mỏ vàng: tảng đá xám với mảnh vàng nhô ra.
   *
   * Đặc tả đòi metalness 0,8. Nhưng kim loại trong Three.js lấy màu từ MÔI TRƯỜNG phản chiếu,
   * mà cảnh này không có bản đồ môi trường — đặt 0,8 thì mảnh vàng ra gần như đen. Nên dùng
   * metalness thấp cộng phát sáng: ra đúng vẻ "lấp lánh" mà không phải gánh thêm một bản đồ
   * môi trường chỉ để phục vụ tám tảng đá.
   */
  private buildGoldRocks(group: THREE.Group, fade: (c: number) => number, locked: boolean): void {
    const rockMat = new THREE.MeshLambertMaterial({ color: fade(PALETTE.graniteDark), flatShading: true });
    for (const [x, y, z, s] of [[0, 0.5, 0, 0.85], [1.1, 0.32, 0.5, 0.52], [-0.95, 0.28, -0.5, 0.45]] as const) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
      rock.position.set(x, y, z);
      rock.rotation.set(x, y * 2, z);
      rock.castShadow = true;
      group.add(rock);
    }
    const shardMat = new THREE.MeshStandardMaterial({
      color: fade(PALETTE.goldVein), roughness: 0.2, metalness: 0.15,
      emissive: locked ? 0x000000 : PALETTE.goldVein, emissiveIntensity: 0.45,
    });
    for (const [x, y, z, s] of [[0.15, 1.15, 0.1, 0.42], [-0.7, 0.75, 0.55, 0.3], [0.8, 0.8, -0.5, 0.26]] as const) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), shardMat);
      shard.position.set(x, y, z);
      shard.castShadow = true;
      group.add(shard);
      if (!locked) this.gold.push(shard);
    }
  }

  // ---------------------------------------------------------------- ô đất

  private buildSlot(slot: Slot): THREE.Group {
    const group = new THREE.Group();

    if (slot.state !== 'CONSTRUCTED' || slot.type === 'none') {
      this.buildSocket(group, slot);
      return group;
    }
    if (slot.type === 'market') this.buildTownHall(group, slot);
    else this.buildWorkBuilding(group, slot);

    if (this.scaffolds.has(slot.id)) this.buildScaffold(group, slot);
    return group;
  }

  /**
   * Ô đất trống: nền đất quây hàng rào gỗ, bốn trụ góc. Ô còn khoá thì trụ là cột đá và nền
   * sẫm hẳn, nên nhìn một cái là phân biệt được "chưa mua" với "mua rồi, chưa xây".
   */
  private buildSocket(group: THREE.Group, slot: Slot): void {
    const locked = slot.state === 'LOCKED';
    const dirt = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 0.16, 2.9),
      new THREE.MeshLambertMaterial({ color: locked ? PALETTE.slotLocked : PALETTE.socketDirt }));
    dirt.position.y = 0.08;
    dirt.receiveShadow = true;
    dirt.userData.slotId = slot.id;
    group.add(dirt);
    this.pickable.push(dirt);

    const postMat = new THREE.MeshLambertMaterial({
      color: locked ? PALETTE.graniteDark : PALETTE.socketFence,
    });
    // Bốn trụ góc.
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const post = new THREE.Mesh(
        locked ? new THREE.BoxGeometry(0.26, 0.74, 0.26) : new THREE.CylinderGeometry(0.11, 0.13, 0.62, 5),
        postMat);
      post.position.set(sx * 1.38, locked ? 0.45 : 0.39, sz * 1.38);
      post.castShadow = true;
      group.add(post);
    }
    if (locked) return;

    // Thanh ngang hàng rào, bốn cạnh.
    const railGeo = new THREE.BoxGeometry(2.76, 0.1, 0.09);
    for (const [ang, dx, dz] of [[0, 0, 1.38], [0, 0, -1.38], [Math.PI / 2, 1.38, 0], [Math.PI / 2, -1.38, 0]] as const) {
      for (const y of [0.3, 0.52]) {
        const rail = new THREE.Mesh(railGeo, postMat);
        rail.position.set(dx, y, dz);
        rail.rotation.y = ang;
        group.add(rail);
      }
    }
  }

  /** Nhà chính: móng lục giác đá, tường khung gỗ, mái ngói dốc, ống khói nhả khói. */
  private buildTownHall(group: THREE.Group, slot: Slot): void {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.85, 1.95, 0.4, 6),
      new THREE.MeshLambertMaterial({ color: PALETTE.graniteDark, flatShading: true }));
    base.position.y = 0.2;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    const h = 1.5 + slot.level * 0.1;
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, h, 2.3),
      new THREE.MeshLambertMaterial({ color: PALETTE.marketWall, flatShading: true }));
    wall.position.y = 0.4 + h / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    wall.userData.slotId = slot.id;
    group.add(wall);
    this.pickable.push(wall);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.25, 1.5, 4),
      new THREE.MeshLambertMaterial({ color: PALETTE.market, flatShading: true }));
    roof.position.y = 0.4 + h + 0.75;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.8, 0.34),
      new THREE.MeshLambertMaterial({ color: PALETTE.graniteDark }));
    chimney.position.set(0.72, 0.4 + h + 0.95, 0.72);
    chimney.castShadow = true;
    group.add(chimney);

    const puffMat = new THREE.MeshLambertMaterial({ color: 0xf4f0e6, transparent: true, opacity: 0.6 });
    const puffGeo = new THREE.IcosahedronGeometry(0.17, 0);
    for (let i = 0; i < 3; i += 1) {
      const puff = new THREE.Mesh(puffGeo, puffMat.clone());
      puff.position.set(0.72, 0.4 + h + 1.4, 0.72);
      puff.userData.phase = i / 3;
      puff.userData.baseY = 0.4 + h + 1.4;
      group.add(puff);
      this.smoke.push(puff);
    }
  }

  /** Nhà ở, xưởng cưa, lò gạch, kho: cùng khung, khác màu và khác chi tiết trên nóc. */
  private buildWorkBuilding(group: THREE.Group, slot: Slot): void {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 0.16, 2.9),
      new THREE.MeshLambertMaterial({ color: PALETTE.socketDirt }));
    pad.position.y = 0.08;
    pad.receiveShadow = true;
    group.add(pad);

    const h = 1.15 + slot.level * 0.14;
    const color = BUILDING_COLOR[slot.type as Exclude<typeof slot.type, 'none'>];
    const wallMat = new THREE.MeshLambertMaterial({ color: PALETTE.marketWall, flatShading: true });
    const roofMat = new THREE.MeshLambertMaterial({ color, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, h, 2.0), wallMat);
    body.position.y = 0.16 + h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.slotId = slot.id;
    group.add(body);
    this.pickable.push(body);

    const top = 0.16 + h;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.85, 1.05, 4), roofMat);
    roof.position.y = top + 0.52;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    if (slot.type === 'sawmill' || slot.type === 'masonry') {
      const chimney = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.23, 0.9, 6),
        new THREE.MeshLambertMaterial({ color: PALETTE.graniteDark }));
      chimney.position.set(0.62, top + 0.75, -0.62);
      chimney.castShadow = true;
      group.add(chimney);
    }

    // Đống hàng chờ chở: nhìn chồng thùng là biết thiếu thợ chở, khỏi mở bảng nào.
    const refined = slot.type === 'sawmill' ? 'planks' : slot.type === 'masonry' ? 'bricks' : null;
    if (refined && slot.buffer >= 1) {
      const crateMat = new THREE.MeshLambertMaterial({ color: RESOURCES[refined].color });
      const crates = Math.min(6, Math.ceil(slot.buffer / 10));
      for (let i = 0; i < crates; i += 1) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), crateMat);
        crate.position.set(-1.0 + (i % 3) * 0.46, 0.36 + Math.floor(i / 3) * 0.42, 1.22);
        crate.castShadow = true;
        group.add(crate);
      }
    }

    const pipMat = new THREE.MeshLambertMaterial({ color: 0xfdf6e8 });
    const pipGeo = new THREE.SphereGeometry(0.095, 6, 5);
    for (let i = 0; i < slot.level; i += 1) {
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set(-0.72 + (i % 4) * 0.48, top + 0.02, 0.82 - Math.floor(i / 4) * 0.28);
      group.add(pip);
    }
  }

  /**
   * Giàn giáo sau khi nâng cấp.
   *
   * Game nâng cấp TỨC THÌ, không có thời gian xây, nên không có "đang xây" để mà vẽ. Thay vì
   * bịa ra một bộ đếm chỉ để có cớ hiện giàn giáo, cho nó bật lên một nhịp ngắn ngay sau khi
   * nâng xong — vẫn là phản hồi "vừa có gì đó đổi ở đây", mà không làm chậm người chơi lại.
   */
  private buildScaffold(group: THREE.Group, slot: Slot): void {
    const mat = new THREE.MeshLambertMaterial({ color: PALETTE.socketFence });
    const h = 2.4 + slot.level * 0.12;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h, 5), mat);
      pole.position.set(sx * 1.2, h / 2, sz * 1.2);
      group.add(pole);
    }
    const plank = new THREE.BoxGeometry(2.5, 0.09, 0.22);
    for (const y of [h * 0.45, h * 0.78]) {
      for (const [ang, dx, dz] of [[0, 0, 1.2], [0, 0, -1.2]] as const) {
        const p = new THREE.Mesh(plank, mat);
        p.position.set(dx, y, dz);
        p.rotation.y = ang;
        group.add(p);
      }
    }
    const hammer = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.26, 0.26),
      new THREE.MeshLambertMaterial({ color: 0xffd166, emissive: 0xffb703, emissiveIntensity: 0.4 }));
    hammer.position.y = h + 0.6;
    hammer.name = 'hammer';
    group.add(hammer);
  }

  /** Gọi sau khi nâng cấp để bật giàn giáo một nhịp. */
  markUpgraded(slotId: string): void {
    this.scaffolds.set(slotId, 0);
  }

  // ---------------------------------------------------------------- tương tác

  private onPointerMove = (e: PointerEvent): void => {
    const hit = this.pick(e);
    const id = hit ? (hit.userData.slotId as string) : null;
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.renderer.domElement.style.cursor = id ? 'pointer' : 'default';
    this.applyHighlight();
  };

  private onPointerDown = (e: PointerEvent): void => {
    const hit = this.pick(e);
    const id = hit ? (hit.userData.slotId as string) : null;
    this.selectedId = id;
    this.applyHighlight();
    this.onSelect?.(id ? this.economy.state.slots.find((s) => s.id === id) ?? null : null);
  };

  private pick(e: PointerEvent): THREE.Object3D | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickable, false);
    return hits.length ? hits[0].object : null;
  }

  private applyHighlight(): void {
    for (const [id, group] of this.slotGroups) {
      if (this.popping.has(id)) continue;
      group.position.y = id === this.selectedId ? 0.24 : 0;
      group.scale.setScalar(id === this.hoveredId && id !== this.selectedId ? 1.04 : 1);
    }
  }

  select(id: string | null): void {
    this.selectedId = id;
    this.applyHighlight();
  }

  // ------------------------------------------------------------ vòng render

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;

    const topPx = document.querySelector('.bar-top')?.getBoundingClientRect().height ?? 0;
    const botPx = document.querySelector('.bar-bottom')?.getBoundingClientRect().height ?? 0;
    // Giữ ít nhất một phần ba màn hình cho sân chơi, kể cả khi HUD phình to.
    const freeH = Math.max(h * 0.34, h - topPx - botPx);

    // Khung nhìn phải ôm trọn đảo, và ôm vào DẢI TRỐNG giữa hai thanh HUD chứ không phải cả
    // cửa sổ: đo ở 700×460, hai thanh che 63% chiều cao nên nửa dưới đảo nằm khuất.
    // Vanh nuoc nho ra ngoai chan dao nen khung phai rong hon groundSize mot chut; le du de
    // nha cao khong bi cat ngon, khong hon - le thua la dao teo lai giua man hinh trong.
    const size = tierSpec(this.economy.state.tier).groundSize * 1.2;
    const needX = size / Math.SQRT2;
    const needY = size / Math.sqrt(6) + 1.5;

    const halfH = Math.max(needY * (h / freeH), needX / aspect);
    const shift = ((topPx - botPx) / 2 / h) * 2 * halfH;

    this.camera.top = halfH + shift;
    this.camera.bottom = -halfH + shift;
    this.camera.left = -halfH * aspect;
    this.camera.right = halfH * aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  /** Thanh HUD cao lên hay thấp xuống thì khung nhìn phải tính lại. */
  private watchHud(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => this.resize());
    for (const sel of ['.bar-top', '.bar-bottom']) {
      const node = document.querySelector(sel);
      if (node) ro.observe(node);
    }
  }

  start(): void {
    if (this.raf !== null) return;
    this.lastTime = performance.now() / 1000;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.lastTime = performance.now() / 1000;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  private loop = (nowMs: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    const now = nowMs / 1000;
    const raw = now - this.lastTime;
    this.lastTime = now;

    if (!this.paused) {
      // Chặn delta: một khung hình dài không được phép đẩy cả đàn thợ nhảy cóc qua nửa bản đồ.
      const dt = Math.min(raw, MAX_FRAME_DELTA);
      this.elapsed += dt;
      this.workers.update(dt);
      this.economy.tick(dt);
      this.animate(dt);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private animate(dt: number): void {
    for (const g of this.gold) g.rotation.y += dt * 0.7;
    if (this.water) this.water.position.y = -6.4 + Math.sin(this.elapsed * 0.9) * 0.16;

    for (const puff of this.smoke) {
      const phase = (this.elapsed * 0.45 + (puff.userData.phase as number)) % 1;
      puff.position.y = (puff.userData.baseY as number) + phase * 1.5;
      puff.scale.setScalar(0.5 + phase * 0.9);
      const mat = puff.material as THREE.MeshLambertMaterial;
      mat.opacity = 0.55 * (1 - phase);
    }

    this.animatePop(dt);
    this.animateScaffold(dt);
  }

  /** Đất mới nhô lên: phóng từ 0 lên 1 có nảy nhẹ ở cuối. */
  private animatePop(dt: number): void {
    if (this.popping.size === 0) return;
    for (const [id, t] of [...this.popping]) {
      const next = t + dt;
      const group = this.slotGroups.get(id);
      if (!group) { this.popping.delete(id); continue; }
      if (next >= POP_SECONDS) {
        this.popping.delete(id);
        group.scale.setScalar(1);
        continue;
      }
      this.popping.set(id, next);
      const k = next / POP_SECONDS;
      const eased = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
      group.scale.setScalar(Math.max(0.01, eased));
    }
  }

  private animateScaffold(dt: number): void {
    if (this.scaffolds.size === 0) return;
    let done = false;
    for (const [id, t] of [...this.scaffolds]) {
      const next = t + dt;
      if (next >= SCAFFOLD_SECONDS) { this.scaffolds.delete(id); done = true; continue; }
      this.scaffolds.set(id, next);
      const hammer = this.slotGroups.get(id)?.getObjectByName('hammer');
      if (hammer) {
        hammer.position.y += Math.sin(this.elapsed * 9) * 0.012;
        hammer.rotation.z = Math.sin(this.elapsed * 9) * 0.5;
      }
    }
    if (done) this.rebuildWorld();
  }

  syncWorkers(): void {
    this.workers.sync();
  }

  describeBuilding(slot: Slot): string {
    return slot.type === 'none' ? '' : BUILDINGS[slot.type].describe(slot.level);
  }

  /** Số liệu vẽ của khung vừa rồi — dùng để đo cái giá của bóng đổ. */
  stats(): { calls: number; triangles: number; programs: number } {
    const i = this.renderer.info;
    return {
      calls: i.render.calls,
      triangles: i.render.triangles,
      programs: i.programs?.length ?? 0,
    };
  }
}
