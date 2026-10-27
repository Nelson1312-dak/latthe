/**
 * Cảnh Three.js: ánh sáng, công trình, camera kéo thả, vòng render.
 *
 * Bản đồ giờ rộng 60×60 nên camera KHÔNG còn cố định được nữa: nhìn trọn cả thế giới thì mọi
 * thứ bé như hạt vừng, mà phóng đủ to thì không thấy được bốn biến sinh thái. Nên camera trực
 * giao có tâm ngắm di chuyển được (kéo chuột hoặc WASD) và mức thu phóng chạy trong khoảng
 * 15–55. Cả hai đều trượt mượt về giá trị đích thay vì nhảy cóc.
 *
 * Bóng đổ: đo ở bản trước là 0,84 ms mỗi khung cho một đèn. Giữ đúng một đèn đổ bóng, và
 * khung bóng BÁM THEO tâm ngắm chứ không phủ cả 60×60 — phủ hết thì cùng 2048 điểm ảnh phải
 * trải trên diện tích gấp mười, bóng vỡ răng cưa ngay mà chẳng thêm được gì.
 */
import * as THREE from 'three';
import { BUILDINGS, MAX_FRAME_DELTA, PALETTE } from './config';
import type { Economy } from './Economy';
import { FogOfWar, chime } from './FogOfWar';
import { MapManager } from './MapManager';
import type { Building, Plot } from './types';
import { WorkerManager } from './WorkerManager';
import { CHUNK } from './world';

const MIN_ZOOM = 10;
/**
 * Keo xa toi dau. Khong duoc vuot qua vung dang nap: luoi 9x9 khoi la 180 don vi, ma o muc
 * phong Z thi khung nhin rong chung 2*Z*ti_le - nen qua 45 la nguoi choi nhin thay khoang
 * trong ngoai ria vung nap.
 */
const MAX_ZOOM = 45;
/**
 * Mức phóng khi người chơi chọn một nền đất.
 *
 * Phải sâu hơn cảm giác cần thiết, vì khung nhìn tự nới ra theo chiều cao HUD: thẻ kiểm tra
 * trượt lên chiếm chỗ dọc, phần bù đó nhân khung nhìn lên khoảng 1,5 lần. Đo lần đầu với 17
 * thì sau khi bù ra đúng 26 — tức là bấm chọn mà màn hình không nhúc nhích.
 */
const FOCUS_ZOOM = 12;
/** Mức phóng mặc định lúc mở game và sau khi bỏ chọn. */
const REST_ZOOM = 26;
/** Hệ số trượt: càng lớn càng bám sát, càng nhỏ càng trôi. */
const GLIDE = 9;

const ROOF: Record<string, number> = {
  townhall: PALETTE.roofCore, house: PALETTE.roofHouse,
  granary: PALETTE.roofGranary, outpost: PALETTE.roofOutpost,
};

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly map: MapManager;
  readonly fog: FogOfWar;
  readonly workers: WorkerManager;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly economy: Economy;
  private readonly sun: THREE.DirectionalLight;

  private readonly plotGroup = new THREE.Group();
  private readonly pickable: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  /** Tâm ngắm hiện tại và tâm ngắm đích — khoảng cách giữa hai cái tạo ra độ trượt. */
  readonly target = new THREE.Vector3(0, 0, 0);
  private wanted = new THREE.Vector3(0, 0, 0);
  private zoom = REST_ZOOM;
  private wantedZoom = REST_ZOOM;

  private dragging = false;
  private dragged = 0;
  private last = new THREE.Vector2();
  private readonly keys = new Set<string>();

  private raf: number | null = null;
  private lastTime = 0;
  private elapsed = 0;
  private paused = false;
  private selectedId: string | null = null;

  onSelect: ((plotId: string | null) => void) | null = null;
  onReveal: ((chunkId: string) => void) | null = null;
  onFocusNode: ((nodeId: string | null) => void) | null = null;
  onMilestone: ((label: string) => void) | null = null;

  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hitPoint = new THREE.Vector3();

  /**
   * Hai vòng đánh dấu dưới chân công trình: một cho ô đang chọn, một cho ô con trỏ đang rê.
   *
   * Thiếu chúng là thiếu hẳn phản hồi: bấm vào nhà mà cảnh không nhúc nhích thì người chơi
   * không biết mình vừa chọn cái nào, và thẻ hiện lên bên dưới trông như rơi từ đâu xuống.
   * Vòng đặt sát mặt đất nên không che nhà, và nó NẰM TRONG CẢNH chứ không phải một khung
   * HTML — thế mới dính theo công trình khi camera trôi.
   */
  private selectRing!: THREE.Mesh;
  private hoverRing!: THREE.Mesh;
  private hoveredId: string | null = null;

  constructor(canvas: HTMLCanvasElement, economy: Economy) {
    this.economy = economy;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(PALETTE.sky, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);

    this.scene.add(new THREE.HemisphereLight(0xade8f4, 0x386641, 0.8));
    this.sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const d = 30;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.map = new MapManager();
    this.fog = new FogOfWar(economy.state.revealed);
    this.fog.onReveal = (key) => {
      economy.state.revealed = this.fog.revealedKeys();
      // Quang duong tinh toi TAM o vua ven. Lay goc xa nhat se thuong hoi hao phong, lay
      // canh gan nhat thi nguoi choi phai di qua han o moi duoc tinh - tam la o giua.
      const [cx, cz] = key.split(',').map(Number);
      const dist = Math.round(Math.hypot(cx * CHUNK + CHUNK / 2, cz * CHUNK + CHUNK / 2));
      const hit = economy.noteReach(dist);
      chime(economy.state.muted);
      this.onReveal?.(key);
      if (hit) this.onMilestone?.(hit.label);
      economy.save();
    };
    this.workers = new WorkerManager(economy, this.map, this.fog);
    // Man may song lau hon trang thai game, nen lam lai tu dau phai phu may lai cho khop.
    const prevReset = economy.onReset;
    economy.onReset = () => {
      prevReset?.();
      this.fog.resync(economy.state.revealed);
      this.rebuildPlots();
    };

    this.scene.add(this.map.group, this.fog.group, this.workers.group, this.plotGroup);
    this.buildMarkers();
    this.rebuildPlots();

    this.resize();
    this.watchHud();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  // ------------------------------------------------------------ đánh dấu

  private buildMarkers(): void {
    const ring = (color: number, opacity: number, r: number) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.3, 44),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
        }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.22;
      m.visible = false;
      m.renderOrder = 2;
      this.scene.add(m);
      return m;
    };
    // Ban kinh phai RONG hon chan cong trinh. De sat qua (2,1 so voi chan 2,0) thi nhin
    // cheo tu tren xuong, chinh toa nha che mat nua vong phia sau - do duoc bang mat ngay
    // lan thu dau.
    this.selectRing = ring(0xffc766, 0.95, 2.7);
    this.hoverRing = ring(0xffffff, 0.55, 2.55);
  }

  private updateMarkers(): void {
    const place = (mesh: THREE.Mesh, id: string | null) => {
      const plot = id ? this.map.plotById(id) : null;
      mesh.visible = !!plot;
      if (plot) mesh.position.set(plot.position[0], 0.22, plot.position[2]);
    };
    place(this.selectRing, this.selectedId);
    place(this.hoverRing, this.hoveredId === this.selectedId ? null : this.hoveredId);
  }

  // ------------------------------------------------------------ công trình

  rebuildPlots(): void {
    this.plotGroup.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      if (!Array.isArray(o.material)) o.material.dispose();
    });
    this.plotGroup.clear();
    this.pickable.length = 0;

    for (const plot of this.map.plots) {
      const building = this.economy.buildingAt(plot.id);
      const g = new THREE.Group();
      g.position.set(plot.position[0], 0, plot.position[2]);
      g.userData.plotId = plot.id;
      if (building) this.buildStructure(g, building, plot.id);
      else this.buildEmptyPlot(g, plot.id);
      this.plotGroup.add(g);
    }
  }

  private buildEmptyPlot(g: THREE.Group, id: string): void {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.18, 3.0),
      new THREE.MeshLambertMaterial({ color: PALETTE.plotDirt }));
    pad.position.y = 0.09;
    pad.receiveShadow = true;
    pad.userData.plotId = id;
    g.add(pad);
    this.pickable.push(pad);

    const postMat = new THREE.MeshLambertMaterial({ color: PALETTE.fence });
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.6, 5), postMat);
      post.position.set(sx * 1.4, 0.38, sz * 1.4);
      post.castShadow = true;
      g.add(post);
    }
  }

  private buildStructure(g: THREE.Group, b: Building, id: string): void {
    const core = b.type === 'townhall';
    const h = (core ? 1.6 : 1.15) + b.level * 0.12;

    const base = new THREE.Mesh(
      core ? new THREE.CylinderGeometry(1.9, 2.0, 0.4, 6) : new THREE.BoxGeometry(2.9, 0.18, 2.9),
      new THREE.MeshLambertMaterial({ color: core ? PALETTE.graniteDark : PALETTE.plotDirt }));
    base.position.y = core ? 0.2 : 0.09;
    base.receiveShadow = true;
    g.add(base);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(core ? 2.4 : 2.0, h, core ? 2.4 : 2.0),
      new THREE.MeshLambertMaterial({ color: PALETTE.wall, flatShading: true }));
    body.position.y = (core ? 0.4 : 0.18) + h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.plotId = id;
    g.add(body);
    this.pickable.push(body);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(core ? 2.3 : 1.85, core ? 1.6 : 1.1, 4),
      new THREE.MeshLambertMaterial({ color: ROOF[b.type], flatShading: true }));
    roof.position.y = (core ? 0.4 : 0.18) + h + (core ? 0.8 : 0.55);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);

    // Trạm trung chuyển: chồng thùng bên cạnh cho thấy đang gom được bao nhiêu, khỏi mở bảng.
    if (b.type === 'outpost') {
      const total = Object.values(b.stock).reduce<number>((a, v) => a + (v ?? 0), 0);
      const crates = Math.min(5, Math.ceil(total / 20));
      const crateMat = new THREE.MeshLambertMaterial({ color: PALETTE.roofOutpost });
      for (let i = 0; i < crates; i += 1) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), crateMat);
        c.position.set(-1.0 + (i % 3) * 0.46, 0.38 + Math.floor(i / 3) * 0.42, 1.25);
        c.castShadow = true;
        g.add(c);
      }
    }
  }

  // ---------------------------------------------------------------- điều khiển

  private onKeyDown = (e: KeyboardEvent): void => { this.keys.add(e.key.toLowerCase()); };
  private onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.key.toLowerCase()); };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.wantedZoom = THREE.MathUtils.clamp(
      this.wantedZoom * (1 + Math.sign(e.deltaY) * 0.12), MIN_ZOOM, MAX_ZOOM);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.dragged = 0;
    this.last.set(e.clientX, e.clientY);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) {
      // Rê tới đâu sáng tới đó. Con trỏ đổi hình là tín hiệu rẻ nhất cho biết "bấm được".
      const id = this.pickPlot(e);
      if (id !== this.hoveredId) {
        this.hoveredId = id;
        this.renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
        this.updateMarkers();
      }
      return;
    }
    const dx = e.clientX - this.last.x;
    const dy = e.clientY - this.last.y;
    this.last.set(e.clientX, e.clientY);
    this.dragged += Math.abs(dx) + Math.abs(dy);
    // Đổi dịch chuyển trên màn thành dịch chuyển trên mặt đất: lấy trục phải và trục tiến của
    // camera rồi dẹt xuống mặt phẳng XZ, nên kéo hướng nào thì đất trôi đúng hướng đó.
    const k = (this.zoom * 2) / window.innerHeight;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
    const fwd = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right).normalize();
    this.wanted.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k);
    this.clampTarget();
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.dragging = false;
    // Đã kéo thì đừng coi là bấm chọn — ngưỡng nhỏ để bấm nhanh vẫn ăn.
    if (this.dragged > 6) return;

    const plotId = this.pickPlot(e);
    if (plotId) {
      this.selectedId = plotId;
      this.focusOnPlot(plotId);
      this.updateMarkers();
      this.onSelect?.(this.selectedId);
      return;
    }

    // Không trúng nền đất nào: thử xem có bấm vào một cụm tài nguyên không.
    //
    // Bắt tia vào MẶT ĐẤT rồi tìm mỏ gần điểm đó, thay vì dựng 67 khối vô hình chỉ để bắt
    // tia. Cây cối và đá đều nằm trong InstancedMesh, mà bắt tia vào từng thực thể của
    // InstancedMesh thì vừa chậm vừa trả về chỉ số chứ không phải mỏ.
    const node = this.nodeUnder(e);
    if (node) {
      const cur = this.economy.state.focusNodeId;
      this.economy.state.focusNodeId = cur === node.id ? null : node.id;
      this.economy.save();
      this.onFocusNode?.(this.economy.state.focusNodeId);
      return;
    }
    this.selectedId = null;
    this.updateMarkers();
    // Bỏ chọn thì lùi lại cho thấy toàn cảnh, nhưng giữ nguyên chỗ đang đứng.
    this.wantedZoom = Math.max(this.wantedZoom, REST_ZOOM);
    this.onSelect?.(null);
  };

  /**
   * Đưa ô vừa chọn vào giữa màn và phóng gần lại.
   *
   * Trên bản đồ 60×60 nhìn từ mức mặc định, một căn nhà chỉ cao chừng ba chục điểm ảnh — bấm
   * trúng rồi vẫn không đọc nổi nó là nhà gì. Bay tới là cách duy nhất khiến thao tác chọn
   * có nghĩa, và vì camera vốn đã trượt mượt nên không cần thêm hoạt cảnh nào.
   */
  private focusOnPlot(id: string): void {
    const plot = this.map.plotById(id);
    if (!plot) return;
    this.panTo(plot.position[0], plot.position[2]);
    if (this.wantedZoom > FOCUS_ZOOM) this.wantedZoom = FOCUS_ZOOM;
  }

  /** Mỏ nằm dưới con trỏ, trong bán kính chấp nhận được. */
  private nodeUnder(e: PointerEvent): { id: string } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.ground, this.hitPoint)) return null;
    let best = null;
    // Hep hon ban kinh bat nen dat, nen khi hai thu ke nhau thi NEN DAT luon thang.
    let bestDist = 2.4;
    for (const n of this.map.nodes) {
      if (!this.fog.isRevealed(n.position[0], n.position[2])) continue;
      const d = Math.hypot(n.position[0] - this.hitPoint.x, n.position[2] - this.hitPoint.z);
      if (d < bestDist) { bestDist = d; best = n; }
    }
    return best;
  }

  /**
   * Nền đất dưới con trỏ.
   *
   * Bắt tia vào mesh trước; trượt thì lấy điểm chạm mặt đất rồi tìm nền gần nhất trong bán
   * kính rộng rãi. Chỉ bắt tia vào mesh là không đủ: nhà cao 2 đơn vị trên bản đồ 60 đơn vị
   * nên bấm lệch một chút là trượt, và cú bấm đó rơi xuống cụm tài nguyên bên cạnh — người
   * chơi tưởng mình chọn nhà nhưng lại vừa ghim một mỏ đá. Lỗi này quan sát được ngay lần
   * bấm thật đầu tiên.
   */
  private pickPlot(e: PointerEvent): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickable, false);
    if (hits.length) return hits[0].object.userData.plotId as string;

    if (!this.raycaster.ray.intersectPlane(this.ground, this.hitPoint)) return null;
    let best: string | null = null;
    let bestDist = 2.6;
    for (const p of this.map.plots) {
      const d = Math.hypot(p.position[0] - this.hitPoint.x, p.position[2] - this.hitPoint.z);
      if (d < bestDist) { bestDist = d; best = p.id; }
    }
    return best;
  }

  /**
   * Bản đồ không có rìa nên không chặn gì cả. Giữ hàm lại để chỗ gọi khỏi rải rác điều kiện,
   * và để sau này muốn giới hạn thì chỉ phải sửa một nơi.
   */
  private clampTarget(): void {
    /* vô hạn — không chặn */
  }

  /** Bấm vào minimap thì camera trôi tới đó. */
  panTo(x: number, z: number): void {
    this.wanted.set(x, 0, z);
    this.clampTarget();
  }

  get zoomLevel(): number { return this.zoom; }
  select(id: string | null): void {
    this.selectedId = id;
    this.updateMarkers();
  }
  get selected(): string | null { return this.selectedId; }

  // ------------------------------------------------------------ vòng render

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const topPx = document.querySelector('.bar-top')?.getBoundingClientRect().height ?? 0;
    const dockPx = document.querySelector('.dock')?.getBoundingClientRect().height ?? 0;
    const inspPx = document.querySelector('.inspector:not([hidden])')?.getBoundingClientRect().height ?? 0;
    const botPx = dockPx + inspPx + 24;
    const freeH = Math.max(h * 0.34, h - topPx - botPx);

    const aspect = w / h;
    // Phóng theo DẢI TRỐNG giữa hai thanh HUD rồi dịch khung nhìn để tâm rơi vào giữa dải đó
    // — đo ở 700×460, hai thanh che 63% chiều cao nên nửa dưới bản đồ nằm khuất.
    const halfH = this.zoom * (h / freeH);
    const shift = ((topPx - botPx) / 2 / h) * 2 * halfH;
    this.camera.top = halfH + shift;
    this.camera.bottom = -halfH + shift;
    this.camera.left = -halfH * aspect;
    this.camera.right = halfH * aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private watchHud(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => this.resize());
    for (const sel of ['.bar-top', '.dock', '.inspector']) {
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

  get isPaused(): boolean { return this.paused; }

  private loop = (nowMs: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    const now = nowMs / 1000;
    const dt = Math.min(now - this.lastTime, MAX_FRAME_DELTA);
    this.lastTime = now;

    this.moveCamera(dt);
    // Nạp khối chạy cả khi tạm dừng: người chơi vẫn kéo bản đồ đi xem được, và đất mới phải
    // hiện ra theo.
    const before = this.map.version;
    this.map.update(this.target);
    if (this.map.version !== before) this.rebuildPlots();

    if (!this.paused) {
      // Nut 1x/2x chi nhan cho MO PHONG, khong nhan cho camera - keo tha ma nhanh gap doi
      // thi tay khong theo kip.
      const sim = dt * (this.economy.state.speedMult === 2 ? 2 : 1);
      this.elapsed += sim;
      this.workers.update(sim);
      this.fog.update(sim, this.economy.state.units, this.target,
        1 / (1 - this.economy.bonus.survey));
      this.economy.tick(sim);
      this.map.animate(sim);
      // Vòng chọn thở nhẹ để mắt bắt được ngay giữa một bản đồ dày đặc.
      if (this.selectRing.visible) {
        const k = 1 + Math.sin(this.elapsed * 3.4) * 0.05;
        this.selectRing.scale.set(k, k, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
  };

  private moveCamera(dt: number): void {
    if (this.keys.size) {
      const pan = 26 * dt * (this.zoom / 28);
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
      const fwd = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right).normalize();
      if (this.keys.has('w') || this.keys.has('arrowup')) this.wanted.addScaledVector(fwd, pan);
      if (this.keys.has('s') || this.keys.has('arrowdown')) this.wanted.addScaledVector(fwd, -pan);
      if (this.keys.has('a') || this.keys.has('arrowleft')) this.wanted.addScaledVector(right, -pan);
      if (this.keys.has('d') || this.keys.has('arrowright')) this.wanted.addScaledVector(right, pan);
      this.clampTarget();
    }

    const glide = 1 - Math.exp(-GLIDE * dt);
    this.target.lerp(this.wanted, glide);
    const z = this.zoom + (this.wantedZoom - this.zoom) * glide;
    if (Math.abs(z - this.zoom) > 0.002) {
      this.zoom = z;
      this.resize();
    }

    this.camera.position.set(this.target.x + 60, 70, this.target.z + 60);
    this.camera.lookAt(this.target);
    this.sun.position.set(this.target.x + 18, 28, this.target.z + 14);
    this.sun.target.position.copy(this.target);
    this.sun.target.updateMatrixWorld();
  }

  plotById(id: string): Plot | undefined {
    return this.map.plotById(id);
  }

  describe(b: Building): string {
    return BUILDINGS[b.type].describe(b.level);
  }

  stats(): { calls: number; triangles: number } {
    const i = this.renderer.info.render;
    return { calls: i.calls, triangles: i.triangles };
  }
}
