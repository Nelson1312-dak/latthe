/**
 * Cảnh Three.js: camera trực giao cố định, ánh sáng phẳng, vòng render tính theo delta.
 *
 * Ba quyết định đồ hoạ, đều vì mục tiêu "chạy được trên máy văn phòng":
 *
 * 1. Camera TRỰC GIAO, góc nhìn chéo cố định, không xoay. Khung nhìn tính một lần lúc đổi cỡ
 *    cửa sổ hoặc lúc đảo rộng ra là xong.
 * 2. KHÔNG đổ bóng. Bóng thời gian thực là thứ đắt nhất trong một cảnh bé thế này. Thay vào
 *    đó mỗi vật đứng yên có một vệt tròn mờ dưới chân — vẽ một lần, không tốn gì mỗi khung
 *    hình, mà vẫn đủ để mắt thấy vật chạm đất.
 * 3. Vật liệu Lambert, tô phẳng. Rẻ hơn hẳn vật liệu vật lý và hợp đúng kiểu đa giác thấp.
 *
 * Vòng render luôn vẽ, kể cả khi đang tạm dừng, để màn hình không đen. Cái bị dừng là MÔ PHỎNG.
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
  private crystals: THREE.Mesh[] = [];
  /** Nhóm đang nhô lên: mã -> số giây đã trôi. */
  private popping = new Map<string, number>();

  private raf: number | null = null;
  private lastTime = 0;
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
    this.renderer.setClearColor(PALETTE.sky, 1);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
    this.camera.position.set(40, 40, 40);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c7a4, 1.15));
    const sun = new THREE.DirectionalLight(0xfff3dd, 1.1);
    sun.position.set(12, 22, 8);
    this.scene.add(sun);
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

  /**
   * Dựng lại toàn bộ thế giới. Gọi khi trạng thái đổi (xây, nâng, mở ô, mở rộng đảo).
   *
   * Dựng lại TẤT CẢ thay vì đồng bộ từng phần: chuyện này xảy ra vài giây một lần chứ không
   * phải mỗi khung hình, nên cái giá là không đáng kể, đổi lại tránh hẳn một lớp mã đồng bộ
   * vốn rất dễ sai khi có tới ba thứ cùng đổi (ô, bậc lãnh thổ, vị trí mỏ).
   */
  rebuildWorld(): void {
    const tierChanged = this.builtTier !== this.economy.state.tier;
    const known = new Set(this.slotGroups.keys());

    this.disposeGroup(this.world);
    this.world.clear();
    this.slotGroups.clear();
    this.pickable.length = 0;
    this.crystals = [];

    const spec = tierSpec(this.economy.state.tier);
    this.buildGround(spec.groundSize);
    this.buildStreets();
    this.buildResourceNodes();

    for (const slot of this.economy.visibleSlots()) {
      const group = this.buildSlot(slot);
      group.position.set(slot.position[0], 0, slot.position[2]);
      this.world.add(group);
      this.slotGroups.set(slot.id, group);
      // Đất vừa hiện ra sau khi mở bậc thì nhô lên, chứ không bật ra đột ngột.
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

  private buildGround(size: number): void {
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(size, 0.6, size),
      new THREE.MeshLambertMaterial({ color: PALETTE.ground }));
    ground.position.y = -0.3;
    this.world.add(ground);

    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(size + 1.2, 0.3, size + 1.2),
      new THREE.MeshLambertMaterial({ color: PALETTE.groundEdge }));
    edge.position.y = -0.62;
    this.world.add(edge);
  }

  /** Vẽ lưới phố từ chính đồ thị đường đi, nên cái nhìn thấy đúng là cái thợ đi được. */
  private buildStreets(): void {
    const material = new THREE.MeshLambertMaterial({ color: PALETTE.path });
    const drawn = new Set<string>();
    const visible = new Set(this.economy.visibleSlots().map((s) => slotWaypointId(s.id)));

    for (const w of WAYPOINTS) {
      for (const toId of w.links) {
        const other = WAYPOINTS.find((x) => x.id === toId);
        if (!other) continue;
        // Lối rẽ của ô chưa thuộc lãnh thổ thì chưa có đường.
        if (w.id.startsWith('at_') && !visible.has(w.id)) continue;
        if (other.id.startsWith('at_') && !visible.has(other.id)) continue;
        const key = [w.id, toId].sort().join('|');
        if (drawn.has(key)) continue;
        drawn.add(key);

        const a = w.position;
        const b = other.position;
        const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
        if (length < 0.01) continue;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, length), material);
        strip.position.set((a[0] + b[0]) / 2, 0.02, (a[2] + b[2]) / 2);
        strip.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]);
        this.world.add(strip);
      }
    }
  }

  private buildResourceNodes(): void {
    const unlockedLevel = this.economy.state.level;
    for (const node of resourceNodes(this.economy.state.tier)) {
      const group = new THREE.Group();
      group.position.set(node.position[0], 0, node.position[2]);
      // Mỏ chưa tới cấp vẫn hiện, chỉ nhạt đi — để người chơi thấy trước thứ mình đang nhắm.
      const locked = node.unlockLevel > unlockedLevel;
      const tint = (c: number) => (locked ? new THREE.Color(c).lerp(new THREE.Color(PALETTE.ground), 0.55).getHex() : c);

      if (node.kind === 'wood') {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.2, 0.9, 6),
          new THREE.MeshLambertMaterial({ color: tint(PALETTE.woodTrunk) }));
        trunk.position.y = 0.45;
        group.add(trunk);
        const leaf = new THREE.MeshLambertMaterial({ color: tint(RESOURCES.wood.color), flatShading: true });
        for (const [y, r] of [[1.25, 0.82], [1.85, 0.55]] as const) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 0.95, 7), leaf);
          cone.position.y = y;
          group.add(cone);
        }
      } else if (node.kind === 'stone') {
        const mat = new THREE.MeshLambertMaterial({ color: tint(RESOURCES.stone.color), flatShading: true });
        for (const [x, y, z, s] of [[0, 0.42, 0, 0.62], [0.68, 0.26, 0.3, 0.38], [-0.5, 0.22, -0.4, 0.3]] as const) {
          const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat);
          rock.position.set(x, y, z);
          rock.rotation.set(x, y, z);
          group.add(rock);
        }
      } else {
        const mat = new THREE.MeshLambertMaterial({ color: tint(RESOURCES.crystal.color), flatShading: true });
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), mat);
        shard.position.y = 1.0;
        group.add(shard);
        if (!locked) this.crystals.push(shard);
        const base = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat);
        base.position.y = 0.25;
        group.add(base);
      }

      group.add(this.contactShadow(1.3));
      this.world.add(group);
    }
  }

  /** Vệt tròn mờ dưới chân vật, thay cho bóng đổ thật. */
  private contactShadow(radius: number): THREE.Mesh {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 16),
      new THREE.MeshBasicMaterial({ color: 0x7a6a4a, transparent: true, opacity: 0.12 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05;
    return disc;
  }

  private buildSlot(slot: Slot): THREE.Group {
    const group = new THREE.Group();

    const padColor = slot.state === 'LOCKED' ? PALETTE.slotLocked : PALETTE.slotEmpty;
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.18, 3.1),
      new THREE.MeshLambertMaterial({ color: padColor }));
    pad.position.y = 0.09;
    pad.userData.slotId = slot.id;
    group.add(pad);
    this.pickable.push(pad);

    if (slot.state === 'LOCKED') {
      const lock = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x9c8e74 }));
      lock.position.y = 0.45;
      lock.rotation.y = Math.PI / 4;
      group.add(lock);
      return group;
    }
    if (slot.state !== 'CONSTRUCTED' || slot.type === 'none') return group;

    const height = 1.1 + slot.level * 0.16;
    const mat = new THREE.MeshLambertMaterial({ color: BUILDING_COLOR[slot.type], flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, height, 2.1), mat);
    body.position.y = 0.18 + height / 2;
    body.userData.slotId = slot.id;
    group.add(body);
    this.pickable.push(body);

    const top = 0.18 + height;
    if (slot.type === 'hut') {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.9, 4), mat);
      roof.position.y = top + 0.45;
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
    } else if (slot.type === 'market') {
      const lid = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.8, 8), mat);
      lid.position.y = top + 0.4;
      group.add(lid);
    } else if (slot.type === 'warehouse') {
      const lid = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.28, 2.5), mat);
      lid.position.y = top + 0.14;
      group.add(lid);
    } else {
      // Xưởng cưa và lò gạch đều có ống khói — nhận ra ngay đâu là chỗ chế biến.
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.0, 7), mat);
      chimney.position.set(0.62, top + 0.5, -0.62);
      group.add(chimney);
    }

    // Đống hàng chờ chở, dựng thành chồng thùng ngay cạnh xưởng. Thấy chồng cao là biết
    // thiếu thợ chở hàng, không cần mở bảng nào ra xem.
    if (slot.buffer >= 1) {
      const recipe = slot.type === 'sawmill' ? 'planks' : slot.type === 'masonry' ? 'bricks' : null;
      if (recipe) {
        const crateMat = new THREE.MeshLambertMaterial({ color: RESOURCES[recipe].color });
        const crates = Math.min(6, Math.ceil(slot.buffer / 10));
        for (let i = 0; i < crates; i += 1) {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), crateMat);
          crate.position.set(-1.1 + (i % 3) * 0.48, 0.4 + Math.floor(i / 3) * 0.44, 1.22);
          group.add(crate);
        }
      }
    }

    const pipMat = new THREE.MeshLambertMaterial({ color: 0xfdf6e8 });
    const pipGeo = new THREE.SphereGeometry(0.1, 6, 5);
    for (let i = 0; i < slot.level; i += 1) {
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set(-0.8 + (i % 4) * 0.52, top + 0.02, 0.85 - Math.floor(i / 4) * 0.3);
      group.add(pip);
    }

    group.add(this.contactShadow(1.7));
    return group;
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
      if (this.popping.has(id)) continue;      // đang nhô lên, đừng giành quyền đặt tỉ lệ
      group.position.y = id === this.selectedId ? 0.22 : 0;
      group.scale.setScalar(id === this.hoveredId && id !== this.selectedId ? 1.04 : 1);
    }
  }

  select(id: string | null): void {
    this.selectedId = id;
    this.applyHighlight();
  }

  // ------------------------------------------------------------ vòng render

  /**
   * Khung nhìn, có TÍNH TỚI HAI THANH HUD.
   *
   * Bản đầu canh đảo vào giữa toàn bộ cửa sổ, và ở cửa sổ nhỏ thì hỏng hẳn: đo ở 700×460,
   * hai thanh che mất 63% chiều cao, nên nửa dưới hòn đảo nằm khuất sau bảng Đội thợ và
   * không ai bấm được mấy ô đất ở đó.
   *
   * Nên làm hai việc. Một, phóng theo DẢI TRỐNG giữa hai thanh chứ không theo cả cửa sổ:
   * dải trống chỉ chiếm freeH/H màn hình nên khung nhìn phải nới ra đúng tỉ lệ nghịch đó.
   * Hai, dịch khung nhìn lệch đi để tâm đảo rơi vào giữa dải trống — camera trực giao thì
   * chỉ cần cộng cùng một lượng vào `top` và `bottom`.
   */
  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;

    const topPx = document.querySelector('.bar-top')?.getBoundingClientRect().height ?? 0;
    const botPx = document.querySelector('.bar-bottom')?.getBoundingClientRect().height ?? 0;
    // Giữ lại ít nhất một phần ba màn hình cho sân chơi, kể cả khi HUD phình to.
    const freeH = Math.max(h * 0.34, h - topPx - botPx);

    // Nửa bề rộng của đảo chiếu lên màn theo trục ngang là size/√2, theo trục dọc là size/√6.
    const size = tierSpec(this.economy.state.tier).groundSize + 6;
    const needX = size / Math.SQRT2;
    const needY = size / Math.sqrt(6) + 3;

    const halfH = Math.max(needY * (h / freeH), needX / aspect);
    // Dải trống lệch lên hay xuống bao nhiêu so với tâm cửa sổ, quy ra đơn vị cảnh.
    const shift = ((topPx - botPx) / 2 / h) * 2 * halfH;

    this.camera.top = halfH + shift;
    this.camera.bottom = -halfH + shift;
    this.camera.left = -halfH * aspect;
    this.camera.right = halfH * aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  /** Thanh HUD cao lên hay thấp xuống (mở bảng, đổi nội dung) thì khung nhìn phải tính lại. */
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
    // Nhận lại mốc thời gian để lúc chạy tiếp không dồn một delta khổng lồ vào một khung hình.
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
      // Chặn delta: một khung hình dài (chuyển tab, máy ngủ ngắn) không được phép đẩy cả đàn
      // thợ nhảy cóc qua nửa bản đồ. Phần vượt trần do tính tiền vắng mặt lo.
      const dt = Math.min(raw, MAX_FRAME_DELTA);
      this.workers.update(dt);
      this.economy.tick(dt);
      for (const c of this.crystals) c.rotation.y += dt * 0.6;
      this.animatePop(dt);
    }
    this.renderer.render(this.scene, this.camera);
  };

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
      // Nảy nhẹ: vọt qua 1 một chút rồi lùi về.
      const eased = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
      group.scale.setScalar(Math.max(0.01, eased));
    }
  }

  syncWorkers(): void {
    this.workers.sync();
  }

  describeBuilding(slot: Slot): string {
    return slot.type === 'none' ? '' : BUILDINGS[slot.type].describe(slot.level);
  }
}
