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
import { matte, haloTexture } from './materials';
import { roundedBox } from './shapes';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BUILDINGS, GRID, MAX_FRAME_DELTA, PALETTE } from './config';
import type { Economy } from './Economy';
import { FogOfWar, chime } from './FogOfWar';
import { MapManager } from './MapManager';
import type { Building, Plot } from './types';
import { WorkerManager } from './WorkerManager';
import { CHUNK } from './world';

const MIN_ZOOM = 10;
/**
 * Keo xa toi dau. Khong duoc vuot qua vung dang nap: luoi 11x11 khoi co 30 la 330 don vi.
 * Do bang mat: o muc 72 mat dat con phu kin khung hinh, o 78 thi bon goc da lo ra mau troi
 * - tuc nguoi choi nhin thay ria the gioi, dung cai ma ban do vo han khong duoc phep co.
 * Goc khung hinh la cho lo ra truoc, nen 62 de lai bien an toan cho man hinh rong.
 */
const MAX_ZOOM = 62;
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
/** Cú bật của một công trình vừa đặt xong kéo dài bấy nhiêu giây. */
const POP_SECONDS = 0.42;
/** Tran so nen trong ve mot luc. Vung nap 11x11 khoi hiem khi qua 300. */
const EMPTY_CAP = 520;

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
  /** Nền trống vẽ bằng lưới nhân bản, nên bao nhiêu nền cũng chỉ là hai lệnh vẽ. */
  private emptyPads!: THREE.InstancedMesh;
  private emptyPosts!: THREE.InstancedMesh;
  private readonly mtx = new THREE.Matrix4();
  /** Công trình đang dựng, theo nền đất — kèm chữ ký để biết khi nào phải dựng lại. */
  private readonly structures = new Map<string, { g: THREE.Group; sig: string }>();
  /** Hình học và vật liệu công trình dùng chung: dựng một lần, không huỷ theo từng lần vẽ. */
  private readonly geoCache = new Map<string, THREE.BufferGeometry>();
  private readonly matCache = new Map<string, THREE.Material>();
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpD = new THREE.Vector3();
  /** Hướng nắng và hai trục của camera bóng — hằng số, tính một lần. */
  private readonly sunDir = new THREE.Vector3(18, 28, 14).normalize();
  private readonly sunRight = new THREE.Vector3();
  private readonly sunUp = new THREE.Vector3();
  private composer!: EffectComposer;
  private gtao!: GTAOPass;
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
  onSelectPatch: ((patchId: string | null) => void) | null = null;
  onMilestone: ((label: string) => void) | null = null;
  onSelectUnit: ((unitId: string | null) => void) | null = null;

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
  /** Vòng nhỏ bám theo người dân đang chọn. Phải bám từng khung vì họ di chuyển. */
  private unitRing!: THREE.Mesh;
  private patchRing!: THREE.Mesh;
  private hoveredId: string | null = null;
  /*
   * Ba con số nội suy cho phản hồi tức thì. Giữ riêng chứ không gắn thẳng vào mesh: tween
   * phải chạy theo KHUNG HÌNH, nên nó thuộc về vòng render, còn mấy hàm xử lý chuột chỉ đặt
   * đích rồi thôi. Trộn hai thứ lại là sinh ra giật khi chuột gửi nhiều sự kiện trong một
   * khung — mà chuột thì luôn làm thế.
   */
  /** Nền đất nào đang bật lên, và đã bật được bao lâu. */
  private readonly popping = new Map<string, number>();
  private hoverK = 0;
  private selectK = 0;
  private punch = 0;
  private selectedUnitId: string | null = null;
  private selectedPatchId: string | null = null;
  /** Đang bám theo ai. Khác với "đang chọn ai": chọn rồi vẫn có thể không bám. */
  private followId: string | null = null;

  constructor(canvas: HTMLCanvasElement, economy: Economy) {
    this.economy = economy;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(PALETTE.sky, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    /*
     * PCF có bán kính, KHÔNG phải PCFSoft.
     *
     * PCFSoftShadowMap nghe như thứ cho bóng mềm nhất, nhưng nó BỎ QUA `shadow.radius` —
     * độ mềm của nó cố định theo cỡ bản đồ bóng, không chỉnh được. Với PCFShadowMap thì
     * radius là số lần lấy mẫu toả ra, nên mềm tới đâu là do mình đặt.
     */
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    this.buildComposer();

    /*
     * Ánh sáng ngả hẳn về phía TRỜI, không về phía mặt trời.
     *
     * Trước đây mặt trời 2,2 còn trời 0,8 — một nguồn chiếu xiên mạnh, cho bóng đổ dài và
     * tương phản gắt. Đó là ánh sáng của một cảnh ngoài trời thật, không phải của một mô
     * hình đặt trên bàn. Giờ có ambient occlusion lo phần khối ở các khe, nên mặt trời chỉ
     * còn việc cho biết hướng; đẩy nó xuống 1,0 và kéo ánh sáng bầu trời lên 1,7 thì vật
     * thể sáng đều, bóng chỉ còn là một gợi ý, và chiều sâu đến từ chỗ tiếp xúc.
     *
     * Đất hắt lên cũng đổi: 0x386641 là xanh lá đậm, nên mặt dưới mọi thứ ám xanh. Lấy màu
     * kem trung tính thì bóng râm sạch màu, đúng kiểu đất nặn.
     */
    this.scene.add(new THREE.HemisphereLight(0xdceef5, 0xbfae95, 1.7));
    this.sun = new THREE.DirectionalLight(0xfff6e8, 1.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const d = 30;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    // Bóng nhạt hẳn: nó chỉ còn để nói hướng nắng, còn hình khối thì AO lo.
    this.sun.shadow.intensity = 0.45;
    // Mềm tới mức gần như chỉ còn một vệt tối dưới chân vật thể.
    this.sun.shadow.radius = 5;
    this.scene.add(this.sun, this.sun.target);
    // Camera bóng nhìn dọc hướng nắng với up = +Y, nên hai trục ngang của nó là hằng số.
    this.sunRight.crossVectors(new THREE.Vector3(0, 1, 0), this.sunDir).normalize();
    this.sunUp.crossVectors(this.sunDir, this.sunRight).normalize();

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
    this.buildEmptyMeshes();
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

  /**
   * Ambient occlusion: bóng tiếp xúc ở mọi khe hở.
   *
   * Đây là thứ làm nên hình ảnh của Townscaper, và cũng là thứ duy nhất trong cả bản vẽ mà
   * đèn không làm thay được. Một mặt trời chiếu xiên cho bóng ĐỔ — cái bóng dài nằm trên
   * đất cạnh ngôi nhà. Nhưng chỗ chân tường gặp mặt đất, chỗ mái gặp tường, khe giữa hai
   * khối sát nhau: những chỗ ấy tối đi vì ánh sáng vòng quanh không lọt vào được, và không
   * có đèn nào tả được điều đó. Thiếu nó thì mọi vật như dán lên nền; có nó thì chúng ngồi
   * xuống mặt đất, và cả cảnh đọc ra như một mô hình đất nặn.
   *
   * Dùng GTAO chứ không dùng SSAO: SSAO lấy mẫu bán cầu thô nên trên một bản đồ toàn cạnh
   * thẳng nó sinh ra viền bẩn quanh mọi khối. GTAO tính theo chân trời nên bám sát hình
   * học, đúng kiểu cần cho low-poly.
   *
   * ĐI KÈM MỘT RÀNG BUỘC: một khi vẽ qua EffectComposer thì ảnh trung gian nằm ở không gian
   * tuyến tính, nên PHẢI có OutputPass ở cuối để áp tone mapping và đổi về sRGB. Thiếu nó,
   * toàn bộ màu nhạt toẹt đi mà không báo lỗi gì — chỉ nhìn mới thấy.
   */
  private buildComposer(): void {
    /*
     * Render target ĐA MẪU. Mặc định EffectComposer dựng target 0 mẫu, nên từ khi có AO thì
     * `antialias: true` của renderer chỉ còn áp lên lớp vẽ cuối — một hình chữ nhật phủ kín
     * màn hình, chẳng có cạnh nào để khử. Đo được samples = 0 trên cả hai target.
     *
     * Truyền target tự dựng thì composer coi pixel ratio là 1, nên phải đặt lại ngay sau.
     */
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const w = window.innerWidth;
    const h = window.innerHeight;
    this.gtao = new GTAOPass(this.scene, this.camera, w, h);
    // Bán kính nhỏ: cần bóng Ở KHE, không phải một lớp xám phủ lên cả cảnh. Đơn vị là đơn
    // vị thế giới, mà nhà ở đây rộng 2 — nên 1,2 là đúng tầm chân tường và mép mái.
    this.gtao.updateGtaoMaterial({
      radius: 1.2,
      distanceExponent: 1.0,
      thickness: 1.0,
      scale: 1.0,
      samples: 12,
      distanceFallOff: 1.0,
      screenSpaceRadius: false,
    });
    // 0,85 thì mỗi đường nối giữa hai ô lục giác đều hằn lên, mặt đất đọc ra như lưới mắt
    // cáo. 0,7 giữ được bóng ở chỗ tiếp xúc mà không biến nền thành hoa văn.
    this.gtao.blendIntensity = 0.7;
    this.composer.addPass(this.gtao);
    this.composer.addPass(new OutputPass());
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
    this.unitRing = ring(0x7fd8ff, 0.95, 0.72);

    /*
     * Vòng chọn bãi dùng CHÍNH ảnh quầng của bãi, chỉ sáng hơn.
     *
     * Trước là một vành RingGeometry dày 0,035 — mảnh tới mức ở mức phóng xa nó chỉ còn là
     * một nét răng cưa, mà ở mức phóng gần thì lại là một đường kẻ cứng nằm bẹp trên đất.
     * Dùng chung ảnh gradient thì nó mềm ở mọi cỡ, và nó cùng một ngôn ngữ hình ảnh với
     * cái quầng vốn đã ở đó, nên chọn một bãi trông như bãi ấy sáng lên chứ không như bị
     * khoanh bút.
     */
    const haloGeo = new THREE.PlaneGeometry(2, 2);
    haloGeo.rotateX(-Math.PI / 2);
    this.patchRing = new THREE.Mesh(
      haloGeo,
      new THREE.MeshBasicMaterial({
        map: haloTexture(), color: 0xffffff,
        transparent: true, opacity: 0.95, depthWrite: false,
      }));
    this.patchRing.position.y = 0.26;
    this.patchRing.visible = false;
    this.patchRing.renderOrder = 3;
    this.scene.add(this.patchRing);
  }

  private updateMarkers(): void {
    const place = (mesh: THREE.Mesh, id: string | null) => {
      const plot = id ? this.map.plotById(id) : null;
      mesh.visible = !!plot;
      if (plot) mesh.position.set(plot.position[0], plot.position[1] + 0.22, plot.position[2]);
    };
    place(this.selectRing, this.selectedId);
    place(this.hoverRing, this.hoveredId === this.selectedId ? null : this.hoveredId);

    const b = this.selectedPatchId ? this.map.patchById(this.selectedPatchId) : null;
    this.patchRing.visible = !!b;
    if (b) {
      this.patchRing.position.set(b.center[0], b.center[1] + 0.12, b.center[2]);
      const k = b.radius * 1.2;
      this.patchRing.scale.set(k, 1, k);
    }
  }

  // ------------------------------------------------------------ công trình

  /**
   * Nền trống: hai lưới nhân bản cho cả bản đồ.
   *
   * Mỗi nền trống vốn là một bệ cộng bốn cọc rào — năm lệnh vẽ. Nhân với số nền của một bản
   * đồ mở thì riêng mấy ô đất trống đã tốn nhiều lệnh vẽ hơn toàn bộ phần còn lại của thế
   * giới cộng lại, và đó chính là thứ buộc bản trước phải rải nền thật thưa. Gộp bốn cọc
   * thành một hình học rồi nhân bản cả hai, thì con số tụt xuống hai — cố định, không phụ
   * thuộc số nền.
   *
   * Không đưa vào danh sách bắt tia: pickPlot() vốn đã có đường lùi bắt theo khoảng cách
   * trên mặt đất, và đường ấy còn khớp với cách chấm điểm lúc chọn hơn là bắt trúng hình.
   */
  private buildEmptyMeshes(): void {
    const posts: THREE.BufferGeometry[] = [];
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const c = new THREE.CylinderGeometry(0.1, 0.12, 0.6, 5);
      c.translate(sx * 1.4, 0.38, sz * 1.4);
      posts.push(c);
    }
    // 3×3 đơn vị lưới, bo góc như mọi khối khác.
    const pad = roundedBox(GRID * 3, 0.22, GRID * 3, 0.3, 0.05);
    pad.translate(0, 0.11, 0);

    this.emptyPads = new THREE.InstancedMesh(
      pad, matte(PALETTE.plotDirt), EMPTY_CAP);
    this.emptyPosts = new THREE.InstancedMesh(
      mergeGeometries(posts, false)!,
      matte(PALETTE.fence), EMPTY_CAP);
    for (const m of [this.emptyPads, this.emptyPosts]) {
      m.receiveShadow = true;
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      this.scene.add(m);
    }
  }

  rebuildPlots(): void {
    /*
     * CHỈ DỰNG LẠI CÁI ĐÃ ĐỔI.
     *
     * Bản trước huỷ rồi dựng lại TOÀN BỘ công trình mỗi lần hàm này chạy — mà nó chạy mỗi
     * khi bản đồ nạp thêm khối, tức mỗi lần người chơi kéo qua ranh giới khối. Mỗi khối của
     * mỗi công trình lại mang một vật liệu và một hình học mới tinh. Giờ mỗi công trình có
     * một chữ ký (loại, cấp, số thùng hàng); chữ ký không đổi thì giữ nguyên nhóm cũ, kể cả
     * trạng thái tween đang dở.
     */
    // Công trình vừa đặt xong thì cho bật lên; đọc một lần rồi trả lại null, nên khối
    // được dựng lại vì lý do khác (nạp thêm khối bản đồ) sẽ không bật theo.
    const vuaXay = this.economy.justBuilt;
    this.economy.justBuilt = null;
    if (vuaXay) this.popping.set(vuaXay, 0);

    const con = new Set<string>();
    let trong = 0;
    for (const plot of this.map.plots) {
      const building = this.economy.buildingAt(plot.id);
      if (!building) {
        if (trong >= EMPTY_CAP) continue;
        this.mtx.makeTranslation(plot.position[0], plot.position[1], plot.position[2]);
        this.emptyPads.setMatrixAt(trong, this.mtx);
        this.emptyPosts.setMatrixAt(trong, this.mtx);
        trong += 1;
        continue;
      }
      con.add(plot.id);
      const sig = this.signature(building);
      const cu = this.structures.get(plot.id);
      if (cu && cu.sig === sig) continue;
      if (cu) this.plotGroup.remove(cu.g);
      const g = new THREE.Group();
      g.position.set(plot.position[0], plot.position[1], plot.position[2]);
      g.userData.plotId = plot.id;
      g.userData.baseY = plot.position[1];
      this.buildStructure(g, building, plot.id);
      this.plotGroup.add(g);
      this.structures.set(plot.id, { g, sig });
    }
    for (const [id, st] of this.structures) {
      if (!con.has(id)) {
        this.plotGroup.remove(st.g);
        this.structures.delete(id);
      }
    }
    this.pickable.length = 0;
    for (const st of this.structures.values()) {
      st.g.traverse((o) => {
        if (o instanceof THREE.Mesh && o.userData.plotId) this.pickable.push(o);
      });
    }
    this.emptyPads.count = trong;
    this.emptyPosts.count = trong;
    this.emptyPads.instanceMatrix.needsUpdate = true;
    this.emptyPosts.instanceMatrix.needsUpdate = true;
  }

  /** Chữ ký của một công trình: đổi một trong ba thứ này thì phải dựng lại hình. */
  private signature(b: Building): string {
    const crates = b.type === 'outpost'
      ? Math.min(5, Math.ceil(Object.values(b.stock).reduce<number>((a, v) => a + (v ?? 0), 0) / 20))
      : 0;
    return `${b.type}:${b.level}:${crates}`;
  }

  private geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.geoCache.get(key);
    if (!g) { g = make(); this.geoCache.set(key, g); }
    return g;
  }

  private mat(color: number, flat = false): THREE.Material {
    const key = `${color}:${flat}`;
    let m = this.matCache.get(key);
    if (!m) { m = matte(color, flat); this.matCache.set(key, m); }
    return m;
  }

  private buildStructure(g: THREE.Group, b: Building, id: string): void {
    const core = b.type === 'townhall';
    const h = (core ? 1.6 : 1.15) + b.level * 0.12;

    // Thủ phủ 4×4, công trình thường 3×3 — cùng cỡ nền đất mà nó thay thế.
    const base = new THREE.Mesh(
      core
        ? this.geo('base:core', () => new THREE.CylinderGeometry(GRID * 2, GRID * 2, 0.4, 6))
        : this.geo('base:plot', () => roundedBox(GRID * 3, 0.22, GRID * 3, 0.3, 0.05)),
      this.mat(core ? PALETTE.graniteDark : PALETTE.plotDirt));
    base.position.y = core ? 0.2 : 0.11;
    base.receiveShadow = true;
    g.add(base);

    const w = core ? GRID * 3 : GRID * 2;
    const body = new THREE.Mesh(
      this.geo(`body:${w}:${h.toFixed(2)}`, () => roundedBox(w, h, w, 0.26, 0.1)),
      this.mat(PALETTE.wall, true));
    body.position.y = (core ? 0.4 : 0.18) + h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.plotId = id;
    g.add(body);
    this.pickable.push(body);

    // Mái phủ đúng đường chéo của thân, nên hai cái khớp nhau thay vì xê xích vài phần mười.
    const roof = new THREE.Mesh(
      this.geo(`roof:${core}`, () => new THREE.ConeGeometry(
        (core ? GRID * 3 : GRID * 2) * Math.SQRT1_2 + 0.22, core ? 1.6 : 1.1, 4)),
      this.mat(ROOF[b.type], true));
    roof.position.y = (core ? 0.4 : 0.18) + h + (core ? 0.8 : 0.55);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);

    // Trạm trung chuyển: chồng thùng bên cạnh cho thấy đang gom được bao nhiêu, khỏi mở bảng.
    if (b.type === 'outpost') {
      const total = Object.values(b.stock).reduce<number>((a, v) => a + (v ?? 0), 0);
      const crates = Math.min(5, Math.ceil(total / 20));
      const crateMat = this.mat(PALETTE.roofOutpost);
      const crateGeo = this.geo('crate', () => new THREE.BoxGeometry(0.4, 0.4, 0.4));
      for (let i = 0; i < crates; i += 1) {
        const c = new THREE.Mesh(crateGeo, crateMat);
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
    // Nguoi choi tu keo ban do thi thoi bam. Y muon cua ho thang, va mot camera giang co
    // voi tay nguoi la thu kho chiu nhat trong mot game nhin tu tren xuong.
    if (this.dragged > 6) this.followId = null;
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

    // Trúng thẳng hình khối của một nền đất thì nền đất thắng, không bàn thêm.
    const hit = this.pickMesh(e);
    if (hit) {
      this.chooseUnit(null);
      // Bam thang vao hinh khoi cung phai bo chon bai: khong thi the bai van che mat the
      // cong trinh, vi renderInspector() xet bai truoc nen dat.
      this.pickPatch(null);
      this.punch = 1;
      this.selectedId = hit.userData.plotId as string;
      this.focusOnPlot(this.selectedId);
      this.updateMarkers();
      this.onSelect?.(this.selectedId);
      return;
    }
    if (!this.groundPoint(e)) { this.clearSelection(); return; }

    /*
     * Ba thứ cùng nằm trên mặt đất và có thể chồng lên nhau: người dân, nền đất, mỏ. So
     * khoảng cách thô thì người dân luôn thua, vì họ bé và hiếm khi đứng đúng dưới con trỏ.
     * Nên so TỈ LỆ trên bán kính riêng của từng loại — ai "sát đích của mình" hơn thì thắng.
     */
    const px = this.hitPoint.x;
    const pz = this.hitPoint.z;
    let bestKind: 'unit' | 'plot' | 'node' | null = null;
    let bestId: string | null = null;
    let bestScore = 1;

    const consider = (kind: 'unit' | 'plot' | 'node', id: string, dist: number, radius: number) => {
      const score = dist / radius;
      if (score < bestScore) { bestScore = score; bestKind = kind; bestId = id; }
    };

    for (const u of this.economy.state.units) {
      consider('unit', u.id, Math.hypot(u.position[0] - px, u.position[2] - pz), 1.7);
    }
    for (const plot of this.map.plots) {
      consider('plot', plot.id, Math.hypot(plot.position[0] - px, plot.position[2] - pz), 2.6);
    }
    // Bai lay CHINH ban kinh cua no lam vung bam: bai la mot khu dat, nen bam dau trong khu
    // cung phai trung. Day la dieu kien de "chi vao roi dieu dan toi" thanh mot thao tac tu
    // nhien, chu khong phai tro ngam ban vao mot cai cay.
    for (const b of this.map.patches) {
      if (!this.fog.isRevealed(b.center[0], b.center[2])) continue;
      consider('node', b.id, Math.hypot(b.center[0] - px, b.center[2] - pz), b.radius);
    }

    if (bestKind === 'unit' && bestId) {
      this.selectedId = null;
      this.pickPatch(null);
      this.updateMarkers();
      this.onSelect?.(null);
      this.chooseUnit(bestId);
      return;
    }
    if (bestKind === 'plot' && bestId) {
      this.chooseUnit(null);
      this.pickPatch(null);
      this.punch = 1;
      this.selectedId = bestId;
      this.focusOnPlot(bestId);
      this.updateMarkers();
      this.onSelect?.(bestId);
      return;
    }
    if (bestKind === 'node' && bestId) {
      this.chooseUnit(null);
      this.selectedId = null;
      this.updateMarkers();
      this.onSelect?.(null);
      this.pickPatch(bestId);
      return;
    }
    this.clearSelection();
  };

  private clearSelection(): void {
    this.followId = null;
    this.chooseUnit(null);
    this.pickPatch(null);
    this.selectedId = null;
    this.updateMarkers();
    this.wantedZoom = Math.max(this.wantedZoom, REST_ZOOM);
    this.onSelect?.(null);
  }

  private chooseUnit(id: string | null): void {
    if (this.selectedUnitId === id) return;
    this.selectedUnitId = id;
    if (id === null) this.followId = null;
    this.unitRing.visible = id !== null;
    this.onSelectUnit?.(id);
  }

  get selectedUnit(): string | null {
    return this.selectedUnitId;
  }

  get selectedPatch(): string | null {
    return this.selectedPatchId;
  }

  /**
   * Chon bai, hoac bo chon khi truyen null. Bao ra ngoai luon, nen moi cho bo chon - bam
   * sang nen dat, bam sang nguoi dan, bam ra cho trong - deu dong the bai lai ma khong cho
   * nao phai nho tu goi.
   */
  pickPatch(id: string | null): void {
    if (this.selectedPatchId === id) return;
    this.selectedPatchId = id;
    this.updateMarkers();
    this.onSelectPatch?.(id);
  }

  get following(): string | null {
    return this.followId;
  }

  /**
   * Bật/tắt bám theo một người. Bám thì kéo luôn mức phóng vào gần, vì bám mà nhìn từ xa
   * thì chẳng khác gì không bám.
   */
  setFollow(id: string | null): void {
    this.followId = id;
    if (id && this.wantedZoom > FOCUS_ZOOM) this.wantedZoom = FOCUS_ZOOM;
  }

  /** Điểm trên mặt đất dưới con trỏ. Trả false khi tia không cắt mặt đất. */
  private groundPoint(e: PointerEvent): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.castToGround();
  }

  /**
   * Cắt tia với MẶT ĐẤT THẬT, không phải mặt phẳng y = 0.
   *
   * Mặt đất lên tới +2,8 ở vách đá; cắt với y = 0 thì điểm bấm lệch hai, ba đơn vị theo
   * hướng nhìn — bấm vào căn nhà trên đồi mà trúng nền bên cạnh. Lặp vài lần: cắt với mặt
   * phẳng ở cao độ vừa tìm, đọc cao độ mới ở đó, cắt lại. Mặt ô phẳng nên hội tụ ngay, trừ
   * đúng ở mép bậc — và ở đó lệch nửa ô thì cũng không ai bấm nhầm.
   */
  private castToGround(): boolean {
    let y = 0;
    let ok = false;
    for (let k = 0; k < 4; k += 1) {
      this.ground.constant = -y;
      ok = this.raycaster.ray.intersectPlane(this.ground, this.hitPoint) !== null;
      if (!ok) break;
      const ny = this.map.groundY(this.hitPoint.x, this.hitPoint.z);
      if (Math.abs(ny - y) < 0.01) break;
      y = ny;
    }
    this.ground.constant = 0;
    return ok;
  }

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


  /**
   * Nền đất dưới con trỏ.
   *
   * Bắt tia vào mesh trước; trượt thì lấy điểm chạm mặt đất rồi tìm nền gần nhất trong bán
   * kính rộng rãi. Chỉ bắt tia vào mesh là không đủ: nhà cao 2 đơn vị trên bản đồ 60 đơn vị
   * nên bấm lệch một chút là trượt, và cú bấm đó rơi xuống cụm tài nguyên bên cạnh — người
   * chơi tưởng mình chọn nhà nhưng lại vừa ghim một mỏ đá. Lỗi này quan sát được ngay lần
   * bấm thật đầu tiên.
   */
  /** Chi bat tia vao hinh khoi. Trung thang thi khong can doan gi them. */
  private pickMesh(e: PointerEvent): THREE.Object3D | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickable, false);
    return hits.length ? hits[0].object : null;
  }

  private pickPlot(e: PointerEvent): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickable, false);
    if (hits.length) return hits[0].object.userData.plotId as string;

    if (!this.castToGround()) return null;
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

  /**
   * Dua mot bai vao giua man, va chi keo lai gan KHI dang qua xa.
   *
   * Khac voi nen dat: bai to va doc duoc tu xa, nen keo gan moi lan bam la giat man hinh
   * vo co - nhat la luc nguoi choi dang di giao nguoi cho ba bon bai lien tiep. Chi can
   * thiep khi bai dang nho qua de nhin thay nguoi dan trong do.
   */
  focusOnPatch(id: string): void {
    const b = this.map.patchById(id);
    if (!b) return;
    this.panTo(b.center[0], b.center[2]);
    if (this.wantedZoom > 30) this.wantedZoom = 30;
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
    // composer.setSize tự đặt cỡ cho từng pass, đã nhân pixel ratio. Bản trước gọi thêm
    // gtao.setSize(w, h) theo điểm ảnh CSS, đè mất cỡ đúng trên màn hình mật độ cao.
    this.composer.setSize(w, h);
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
      // Vòng của người dân phải bám từng khung: họ đi liên tục, và cái vòng đứng yên thì
      // tệ hơn là không có vòng nào.
      if (this.selectedUnitId) {
        const u = this.economy.state.units.find((x) => x.id === this.selectedUnitId);
        if (!u) this.chooseUnit(null);           // xe giao xong là biến mất
        else this.unitRing.position.set(
          u.position[0], this.map.groundY(u.position[0], u.position[2]) + 0.3, u.position[2]);
      }
      // Vòng chọn thở nhẹ để mắt bắt được ngay giữa một bản đồ dày đặc.
      if (this.selectRing.visible) {
        const k = 1 + Math.sin(this.elapsed * 3.4) * 0.05;
        this.selectRing.scale.set(k, k, 1);
      }
      this.tweenFeedback(dt);
    }
    this.composer.render();
  };

  /**
   * Phản hồi tức thì khi rê và khi bấm, bằng nội suy chứ không bật tắt.
   *
   * Bật tắt thẳng thì cái vòng nhảy ra nhảy vào và người chơi không chắc mình vừa trỏ trúng
   * cái gì — nhất là trên một bản đồ dày, nơi con trỏ quét qua chục thứ mỗi giây. Nội suy
   * cho mắt một hướng chuyển động để bám theo, và đó mới là thứ đọc ra thành "tôi đang chỉ
   * vào cái này".
   *
   * Ba thành phần: vòng rê nở ra từ nhỏ, công trình dưới con trỏ nhấc lên một chút, và cú
   * bấm tạo một nhịp phình rồi tắt. Tất cả đều dùng hệ số mũ theo dt nên tốc độ cảm nhận
   * giống nhau ở mọi tần số khung hình.
   */
  private tweenFeedback(dt: number): void {
    const toi = (nay: number, dich: number, toc: number) =>
      nay + (dich - nay) * (1 - Math.exp(-toc * dt));

    // Cú bật: nở quá cỡ một chút rồi lắng về 1. Townscaper làm thế mỗi lần người chơi đặt
    // một khối, và đó là thứ khiến thao tác đặt có cảm giác đặt chứ không phải vẽ.
    for (const [id, t] of this.popping) {
      const s = t + dt;
      if (s >= POP_SECONDS) this.popping.delete(id);
      else this.popping.set(id, s);
    }

    this.hoverK = toi(this.hoverK, this.hoveredId ? 1 : 0, 16);
    this.selectK = toi(this.selectK, this.selectedId ? 1 : 0, 14);
    this.punch = toi(this.punch, 0, 7);

    // Vòng rê nở từ 0,72 tới 1. Dưới 0,06 thì tắt hẳn, khỏi tốn một lệnh vẽ cho thứ vô hình.
    if (this.hoverK > 0.06) {
      this.hoverRing.visible = true;
      const k = 0.72 + this.hoverK * 0.28;
      this.hoverRing.scale.set(k, k, 1);
    } else {
      this.hoverRing.visible = false;
    }

    // Công trình dưới con trỏ nhấc lên; công trình vừa bấm phình một nhịp rồi về.
    for (const g of this.plotGroup.children) {
      const id = g.userData.plotId as string | undefined;
      if (!id) continue;
      const re = id === this.hoveredId;
      const chon = id === this.selectedId;
      const bat = this.popping.get(id);
      const y0 = (g.userData.baseY as number | undefined) ?? 0;
      if (!re && !chon && bat === undefined && g.position.y === y0 && g.scale.x === 1) continue;
      g.position.y = toi(g.position.y, y0 + (re ? 0.22 : 0), 16);
      // Nội suy mũ không bao giờ chạm đích; sát rồi thì gán thẳng để vòng lặp còn bỏ qua được.
      if (!re && Math.abs(g.position.y - y0) < 1e-3) g.position.y = y0;
      const phong = (chon ? 1 + this.punch * 0.1 : 1) * (re ? 1.04 : 1);
      if (bat === undefined) {
        const k = toi(g.scale.x, phong, 18);
        g.scale.setScalar(Math.abs(k - phong) < 1e-3 ? phong : k);
      } else {
        // Đường cong nở quá cỡ: tới 1,18 rồi lắng xuống. Không nội suy mượt ở đây, vì mượt
        // thì nó chỉ là "to dần ra", còn cái nảy mới đọc ra là một vật rơi xuống đúng chỗ.
        const k = Math.min(1, bat / POP_SECONDS);
        const nay = 1 + 1.9 * Math.pow(k - 1, 3) + 0.9 * Math.pow(k - 1, 2);
        g.scale.setScalar(Math.max(0.01, nay) * phong);
      }
    }
  }

  private moveCamera(dt: number): void {
    if (this.keys.size) {
      this.followId = null;          // go WASD cung la tu dieu camera
      const pan = 26 * dt * (this.zoom / 28);
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
      const fwd = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right).normalize();
      if (this.keys.has('w') || this.keys.has('arrowup')) this.wanted.addScaledVector(fwd, pan);
      if (this.keys.has('s') || this.keys.has('arrowdown')) this.wanted.addScaledVector(fwd, -pan);
      if (this.keys.has('a') || this.keys.has('arrowleft')) this.wanted.addScaledVector(right, -pan);
      if (this.keys.has('d') || this.keys.has('arrowright')) this.wanted.addScaledVector(right, pan);
      this.clampTarget();
    }

    // Bam theo: dat dich ngam vao nguoi do moi khung. Khong gan thang camera vao vi tri ho,
    // de con duong truot mem san co lam nem - gan cung thi camera giat theo tung buoc chan.
    if (this.followId) {
      const u = this.economy.state.units.find((x) => x.id === this.followId);
      if (!u) this.followId = null;
      else this.wanted.set(u.position[0], 0, u.position[2]);
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
    this.fitShadow();
  }

  /**
   * Khung bóng đổ ôm vừa vùng đất đang thấy, và bám lưới texel.
   *
   * Bản trước cố định ±30 đơn vị quanh tâm ngắm, trong khi ở mức phóng xa nhất khung nhìn
   * phủ hơn ±100 — ra khỏi vùng giữa là cây cối nhà cửa không còn bóng.
   *
   * Bám lưới texel: hướng nắng không đổi nên hai trục ngang của camera bóng là hằng số. Làm
   * tròn hình chiếu của tâm lên hai trục ấy về bội số một texel thì lưới điểm ảnh của bản đồ
   * bóng đứng yên trong thế giới khi người chơi kéo bản đồ. Thiếu bước này thì mép bóng lăn
   * tăn từng điểm ảnh mỗi lần kéo.
   */
  private fitShadow(): void {
    const cam = this.camera;
    cam.updateMatrixWorld();
    const dir = cam.getWorldDirection(this.tmpD);
    let r = 0;
    for (const [nx, ny] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      this.tmpV.set(nx, ny, -1).unproject(cam);
      const t = -this.tmpV.y / dir.y;
      r = Math.max(r, Math.hypot(
        this.tmpV.x + dir.x * t - this.target.x, this.tmpV.z + dir.z * t - this.target.z));
    }
    // Cộng lề cho vật cao ở rìa, rồi lượng tử hoá theo bậc 1,2 lần: cỡ khung chỉ đổi theo
    // từng nấc, nên texel không co giãn liên tục mỗi khung lúc đang phóng.
    const half = Math.pow(1.2, Math.ceil(Math.log(r + 8) / Math.log(1.2)));
    const texel = (2 * half) / this.sun.shadow.mapSize.x;
    const a = this.target.dot(this.sunRight);
    const b = this.target.dot(this.sunUp);
    this.tmpV.copy(this.target)
      .addScaledVector(this.sunRight, Math.round(a / texel) * texel - a)
      .addScaledVector(this.sunUp, Math.round(b / texel) * texel - b);
    this.sun.target.position.copy(this.tmpV);
    this.sun.position.copy(this.tmpV).addScaledVector(this.sunDir, half * 2 + 40);
    this.sun.target.updateMatrixWorld();
    const sc = this.sun.shadow.camera;
    if (sc.right !== half) {
      sc.left = -half;
      sc.right = half;
      sc.top = half;
      sc.bottom = -half;
      sc.near = 1;
      sc.far = half * 4 + 80;
      sc.updateProjectionMatrix();
    }
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
