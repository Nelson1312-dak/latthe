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
import { matte, haloTexture, labelTexture, skyEnvTexture, GRAIN_ON } from './materials';
import { buildingGeometry, buildingMaterial, chimneyTop, kieuOf } from './buildings';
import { Smoke } from './Smoke';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {
  BUILDINGS, CAMERA_OFFSET, CAM_DIST, FOOTPRINT, MAX_FRAME_DELTA, PALETTE, WAVE_WARN_SECONDS,
} from './config';
import { OpaqueGTAOPass, finishPass } from './post';
import { AutoTune, TIERS, firstAutoTier, loadGfx, pixelRatioFor, saveGfx, stepDown, tierOf } from './quality';
import type { Choice, GfxSettings, Tier, TierSpec } from './quality';
import type { Economy } from './Economy';
import { ArmyManager } from './ArmyManager';
import { FleetView } from './FleetView';
import { Beasts } from './Beasts';
import { TOWER_RANGE } from './battle';
import { BATTLE_RADIUS } from './battle';
import type { BattleSeed } from './battle';
import { FogOfWar, chime } from './FogOfWar';
import { Ground } from './ground';
import { MapManager } from './MapManager';
import type { Building, BuildingType, Unit } from './types';
import { LENH, WorkerManager } from './WorkerManager';
import { CHUNK } from './world';

/** Màu sương ngày thường và lúc trời sắp đổ. Xám lam, không phải xám chì: vẫn là bảng màu này. */
const TROI_THUONG = new THREE.Color(PALETTE.sky);
const TROI_BAO = new THREE.Color(0x4d5b6b);

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
/**
 * Tỉ lệ nghỉ: bấy nhiêu điểm ảnh CSS cho một đơn vị thế giới.
 *
 * Trước đây mức phóng nghỉ là một CON SỐ CỐ ĐỊNH (26), mà khung nhìn còn nở ra theo phần
 * chiều cao HUD chiếm của màn. Trên điện thoại hai thanh HUD ăn gần một phần ba, nên cùng
 * con số ấy màn 375 điểm ảnh chỉ vẽ 11,8 điểm cho một đơn vị thế giới trong khi màn 1080p
 * vẽ 16,9 — máy có màn hình dày gấp ba lại nhìn thế giới NHỎ HƠN máy bàn. Đặt thẳng tỉ lệ
 * thì mọi màn hình nhìn cùng một cỡ thật, và điện thoại được kéo lại gần đúng chỗ nó thiệt.
 */
const PX_PER_UNIT = 20;
/** Mức phóng tạm lúc chưa đo được HUD; resize() đầu tiên thay bằng mức theo tỉ lệ trên. */
const SEED_ZOOM = 26;
/*
 * NẮNG CHIẾU XIÊN TỪ BÊN TRÁI MÀN HÌNH, không còn từ sau lưng người chơi.
 *
 * Camera đứng ở (60, 70, 60) nhìn về gốc. Hướng nắng cũ (18, 28, 14) lệch khỏi trục nhìn
 * chưa tới bảy độ — tức là đèn gắn trên máy ảnh. Mọi mặt mà người chơi thấy đều quay về
 * phía đèn nên sáng bằng nhau, còn bóng đổ thì rơi ra SAU vật thể, khuất hẳn. Đo được dải
 * sáng tối của cả khung hình chỉ từ 87 tới 208 trên 255: không có mặt tối nào, và một khối
 * không có mặt tối thì mắt đọc ra là một miếng nhựa đúc chứ không phải một ngôi nhà.
 *
 * Phải của màn hình là (+x, −z), nên nắng mang (−x, +z) là nắng từ bên trái, hơi ngả về
 * phía người chơi. Mỗi ngôi nhà giờ có đủ ba tông: mái sáng, một mặt tường nắng, một mặt
 * tường râm — và bóng đổ nằm dài sang phải, nơi nhìn thấy được.
 */
const HUONG_NANG: readonly [number, number, number] = [-0.45, 0.6, 0.66];
/** Nắng mạnh, bóng đậm: nắng xiên mà bóng nhạt thì vẫn là một cảnh không có mặt trời. */
const NANG = 2.6;
const BONG = 0.9;
/**
 * Ánh sáng nền. Hạ xuống vì nó là thứ LẤP mặt râm: để ở mức cũ (trời 0,7 + môi trường 0,4)
 * thì mặt tường quay lưng với nắng vẫn sáng gần bằng mặt hứng nắng.
 */
const NEN_TROI = 0.4;
const NEN_MOI_TRUONG = 0.3;
/** Bậc Thấp không có bản đồ môi trường, nên hemisphere gánh cả phần ấy. */
const NEN_TROI_TRAN = 0.95;
/*
 * Màu trời của hemisphere. Bậc Thấp không có lớp hậu kỳ chỉnh màu ấm, mà ở đó hemisphere lại
 * là gần hết ánh sáng nền — để nguyên màu xanh nhạt thì cả cảnh ngả lạnh và xám so với hai
 * bậc trên. Đổi sang kem ấm là cách rẻ nhất để ba bậc trông cùng một buổi chiều.
 */
const MAU_TROI = 0xdceef5;
const MAU_TROI_TRAN = 0xf6ecd4;
/*
 * Phơi sáng đi với ánh xạ tông Neutral, xem chỗ đặt toneMapping. Neutral giữ nguyên độ
 * sáng dưới 0,8 nên cảnh tối hơn ACES một chút ở cùng mức đèn; 1,2 bù lại đúng chỗ ấy.
 */
const PHOI_SANG = 1.2;
/** Hệ số trượt: càng lớn càng bám sát, càng nhỏ càng trôi. */
const GLIDE = 9;
/** Cú bật của một công trình vừa đặt xong kéo dài bấy nhiêu giây. */
const POP_SECONDS = 0.42;


/** Lý do "đặt được nhưng chưa đủ tiền". Giao diện so đúng chuỗi này để đổi nút thành GOM. */
export const THIEU_VAT_LIEU = 'Not enough materials';

/**
 * Loại nào nhấc lên đặt lại được. Thủ phủ là gốc của vành căn cứ; trạm trung chuyển và đài
 * quan sát thì giá trị của chúng CHÍNH LÀ chỗ đứng — dời được thì thành vén sương miễn phí.
 */
export function doiDuoc(t: BuildingType): boolean {
  return t !== 'townhall' && t !== 'outpost' && t !== 'lookout';
}

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly map: MapManager;
  readonly fog: FogOfWar;
  readonly army: ArmyManager;
  /** Chiến thuyền neo ở bến — chỉ phần hình của hạm đội. */
  private readonly fleet: FleetView;
  readonly dat = new Ground();
  /** Khối ở giữa tấm sương lần nạp gần nhất — đổi khối thì nạp lại cả tấm. */
  private fogAt = '';
  readonly workers: WorkerManager;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly economy: Economy;
  private readonly sun: THREE.DirectionalLight;

  private readonly plotGroup = new THREE.Group();
  private readonly pickable: THREE.Mesh[] = [];
  /** Nền trống vẽ bằng lưới nhân bản, nên bao nhiêu nền cũng chỉ là hai lệnh vẽ. */
  /** Công trình đang dựng, theo nền đất — kèm chữ ký để biết khi nào phải dựng lại. */
  private readonly structures = new Map<string, { g: THREE.Group; sig: string }>();
  /** Hình học và vật liệu công trình dùng chung: dựng một lần, không huỷ theo từng lần vẽ. */
  private readonly geoCache = new Map<string, THREE.BufferGeometry>();
  private readonly matCache = new Map<string, THREE.Material>();
  private readonly tmpV = new THREE.Vector3();
  /** Phien ban ban do ma nen dat va cong trinh dang phan anh. */
  private builtVersion = -1;
  private readonly tmpD = new THREE.Vector3();
  /** Hướng nắng và hai trục của camera bóng — hằng số, tính một lần. */
  private readonly sunDir = new THREE.Vector3(...HUONG_NANG).normalize();
  private readonly sunRight = new THREE.Vector3();
  private readonly sunUp = new THREE.Vector3();
  /** Chuỗi hậu kỳ. Null ở bậc Thấp — khi đó vẽ thẳng ra màn hình. */
  private composer: EffectComposer | null = null;
  private gtao: OpaqueGTAOPass | null = null;
  private finish: ShaderPass | null = null;
  private readonly gfx: GfxSettings = loadGfx();
  private tier: Tier = 'high';
  private spec: TierSpec = TIERS.high;
  private readonly tune = new AutoTune();
  /**
   * Nấc rút lui cuối cùng của chế độ Tự động, nhân vào mật độ điểm ảnh.
   *
   * Dưới bậc Thấp không còn bậc nào để hạ, nên trước đây một chiếc máy quá yếu cứ chạy giật
   * mãi mà hệ thống hết cách. Sàn 1,0 là đúng mức bậc Thấp từng chạy, nên tệ nhất cũng chỉ
   * quay về chỗ cũ chứ không tụt xuống dưới.
   */
  private dprScale = 1;
  private readonly focusV = new THREE.Vector3();
  private hazeFar = 400;
  /** Báo cho HUD mỗi khi bậc đồ hoạ đổi — kể cả lúc Tự động tự hạ. */
  onQuality: (() => void) | null = null;
  private readonly smoke = new Smoke();
  /** Biển tên làng treo trên thủ phủ. */
  private villageLabel!: THREE.Sprite;
  /** Bầu trời đã qua PMREM, dùng làm ánh sáng nền. Dựng một lần, bật tắt theo bậc. */
  private env: THREE.Texture | null = null;
  private hemi!: THREE.HemisphereLight;
  /**
   * Trời dữ tới đâu: 0 là ngày thường, 1 là lúc đợt ập tới.
   *
   * Cái đồng hồ đếm ngược ở góc màn hình là thông tin; cái này mới là thứ người chơi CẢM
   * thấy. Nắng tắt dần, bóng nhạt đi, sương dày lên và ngả xám trong ba mươi giây cuối, nên
   * ngay cả người đang mải bấm ở chỗ khác cũng ngẩng lên.
   */
  private baoLuc = 0;
  /** Biên độ rung camera còn lại sau cú đập của một đợt. */
  private rung = 0;
  /** Cường độ hemisphere mà bậc đồ hoạ đang đặt — trời bão nhân vào con số này. */
  private hemiBase = NEN_TROI;
  private readonly troi = new THREE.Color();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  /** Tâm ngắm hiện tại và tâm ngắm đích — khoảng cách giữa hai cái tạo ra độ trượt. */
  readonly target = new THREE.Vector3(0, 0, 0);
  private wanted = new THREE.Vector3(0, 0, 0);
  private zoom = SEED_ZOOM;
  private wantedZoom = SEED_ZOOM;
  /** Các ngón đang chạm. Hai ngón trở lên thì đó là cử chỉ chụm, không phải kéo bản đồ. */
  private readonly ngon = new Map<number, { x: number; y: number }>();
  /** Khoảng cách hai ngón ở lần đo trước, để biết đang chụm vào hay xoè ra. */
  private khoangNgon = 0;
  /** Mức nghỉ đã tính lần gần nhất. Xem theoHud() để biết vì sao phải nhớ lại. */
  private mucNghi = SEED_ZOOM;

  private dragging = false;
  private dragged = 0;
  private last = new THREE.Vector2();
  private readonly keys = new Set<string>();

  private raf: number | null = null;
  private lastTime = 0;
  private elapsed = 0;
  private paused = false;
  private selectedId: string | null = null;

  onSelect: ((buildingId: string | null) => void) | null = null;
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
  /**
   * Cả nhóm đang chọn, GỒM cả người chính (`selectedUnitId`). Thẻ vẫn nói về người chính;
   * nhóm chỉ quyết định lệnh đi tới bao nhiêu người.
   */
  private readonly doi = new Set<string>();
  /** Vòng chọn cho những người trong nhóm ngoài người chính. Dựng dần, không bao giờ huỷ. */
  private readonly doiRings: THREE.Mesh[] = [];
  /** Lá cờ cắm ở chỗ vừa điều dân tới. */
  private co!: THREE.Group;
  /** Người chơi vừa ra một lệnh: 'di' = tới một điểm, 'bai' = làm ở một bãi. */
  onLenh: ((loai: 'di' | 'bai', soNguoi: number, baiId: string | null) => void) | null = null;
  private selectedPatchId: string | null = null;
  /** Hang thú đang chọn. */
  private selectedDenId: string | null = null;
  private denRing!: THREE.Mesh;
  onSelectDen: ((denId: string | null) => void) | null = null;
  readonly beasts: Beasts;
  /** Đang bám theo ai. Khác với "đang chọn ai": chọn rồi vẫn có thể không bám. */
  private followId: string | null = null;
  /** Mức phóng trước lúc bấm "Follow", để thôi bám thì trả lại đúng mức ấy. */
  private zoomTruocBam: number | null = null;
  /** Chỗ vừa chọn, chờ thẻ kiểm tra dựng xong rồi mới xét nó có bị thẻ che không. */
  private choLo: { x: number; z: number; khung: number } | null = null;
  private readonly tam = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, economy: Economy) {
    this.economy = economy;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.setClearColor(PALETTE.sky, 1);
    /*
     * Neutral chứ không ACES.
     *
     * ACES là đường cong của phim nhựa: nó bẻ vai từ rất sớm và kéo mọi màu sáng về phía
     * trắng. Trên một bảng màu vốn đã nhạt thì kết quả là sữa — đo được độ bão hoà trung
     * bình 0,33, cỏ thành xanh bạc hà, và đó là nửa còn lại của cái nhìn "đồ nhựa". Neutral
     * (Khronos PBR Neutral) để nguyên màu cho tới 0,8 rồi mới nén, nên màu trên màn hình là
     * màu đã chọn trong bảng: cùng cảnh ấy đo ra 0,41.
     */
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = PHOI_SANG;
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
    /*
     * Ánh sáng nền tới từ MỘT BẦU TRỜI, không phải từ hai con số.
     *
     * HemisphereLight chỉ biết màu trời và màu đất, pha theo pháp tuyến ngửa lên hay úp
     * xuống. Nên mọi mặt ĐỨNG — tường nhà, vách đá, thân cây — nhận đúng một màu ở giữa, bất
     * kể quay về phía mặt trời hay quay đi; cảnh phẳng vì thế, và cái bóng đổ là manh mối duy
     * nhất về hướng nắng. Bản đồ môi trường thì mỗi hướng một màu: mặt quay về phía mặt trời
     * tự ấm lên, mặt quay đi tự xanh đi, và bề mặt có một lớp phản chiếu mờ rất nhẹ.
     *
     * Giữ lại HemisphereLight nhưng hạ từ 1,7 xuống 0,7: nó giờ chỉ còn việc nâng nền cho
     * bậc Thấp và vá những chỗ bản đồ môi trường còn thiếu. Cộng cả hai ở mức cũ thì cảnh
     * cháy trắng, mất sạch bóng râm — đo được độ sáng trung bình vọt từ 0,48 lên 0,59.
     */
    this.env = new THREE.PMREMGenerator(this.renderer)
      .fromEquirectangular(skyEnvTexture(this.sunDir)).texture;
    this.scene.environmentIntensity = NEN_MOI_TRUONG;
    this.hemi = new THREE.HemisphereLight(MAU_TROI, 0xbfae95, NEN_TROI);
    this.scene.add(this.hemi);

    /*
     * Sương xa. Bản đồ vô hạn nên mép vùng nạp luôn nằm đâu đó trong khung hình; không có
     * sương thì nó là một đường cắt thẳng giữa đất và trời. Khoảng sương bám theo mức phóng
     * (xem moveCamera): phóng gần thì sương lùi ra xa, không thì ngôi nhà cách ba ô đã mờ.
     */
    this.scene.fog = new THREE.Fog(PALETTE.sky, 100, 400);

    /*
     * Nắng mạnh lên 1,5 và ngả vàng hơn, bóng đậm lên 0,62.
     *
     * Bản trước cố tình để nắng 1,0 và bóng 0,45 — "bóng chỉ là một gợi ý, hình khối để AO
     * lo". Nhưng AO chỉ tả được chỗ TIẾP XÚC, nên giữa một bãi cỏ trống thì không còn gì nói
     * lên là trời đang nắng. Ánh sáng nền giờ tới từ bản đồ môi trường nên nó đã lo phần dịu;
     * nắng được rảnh tay làm đúng việc của nắng.
     */
    /*
     * Và giờ lên 2,6 với bóng 0,9, cùng lúc nắng xoay sang bên — xem HUONG_NANG. Nắng xiên
     * rọi lên mặt đất yếu hơn nắng đứng bóng (cos của góc tới), nên cùng một con số thì cảnh
     * tối đi; và bóng đổ giờ nằm ngay trong tầm mắt, nó phải đủ đậm để đọc ra là bóng.
     */
    this.sun = new THREE.DirectionalLight(0xffeccd, NANG);
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
    this.sun.shadow.intensity = BONG;
    // Bán kính lọc do bậc đồ hoạ đặt, xem applyQuality.
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    // Camera bóng nhìn dọc hướng nắng với up = +Y, nên hai trục ngang của nó là hằng số.
    this.sunRight.crossVectors(new THREE.Vector3(0, 1, 0), this.sunDir).normalize();
    this.sunUp.crossVectors(this.sunDir, this.sunRight).normalize();

    this.map = new MapManager();
    this.fog = new FogOfWar(economy.state.revealed);
    // Ban do can biet o nao da ven (de nhuom dat chua ven), may can biet mat dat cao bao
    // nhieu (de bay tren vach da chu khong cam vao no).
    this.map.setFog((cx, cz) => this.fog.isRevealed(cx * CHUNK + 1, cz * CHUNK + 1));
    this.fog.setGround((x, z) => this.map.groundY(x, z));
    this.fog.onResync = () => this.map.refreshFog();
    this.fog.onReveal = (key) => {
      economy.state.revealed = this.fog.revealedKeys();
      this.map.reveal(key);
      this.rebuildPlots();
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

    this.army = new ArmyManager(this.map);
    this.army.onDone = () => this.endBattle();
    this.fleet = new FleetView(this.map, economy);
    this.scene.add(this.fleet.group);
    // Thú chỉ hiện ở chỗ mây đã tan: hang lộ ra dưới mây là mất luôn cái công đi khám phá.
    this.beasts = new Beasts(
      (x, z) => this.map.groundY(x, z),
      (d) => this.fog.isRevealed(d.x, d.z) && !this.economy.isHunted(d.id));
    this.scene.add(this.beasts.group);
    this.scene.add(this.map.group, this.fog.group, this.workers.group, this.plotGroup,
      this.smoke.mesh, this.army.group, this.dat.group);

    this.buildMarkers();
    this.buildVillageLabel();
    this.rebuildPlots();

    // Áp bậc đồ hoạ (cũng gọi resize). Tự động thì đo ngay từ khung đầu.
    this.applyQuality(tierOf(this.gfx));
    this.theoHud();
    if (this.gfx.choice === 'auto') this.tune.start();
    this.watchHud();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    // Chuột phải giờ là "bỏ mô hình đang cầm" — bảng chọn của trình duyệt không được chen vào.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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
  private buildComposer(q: TierSpec): void {
    /*
     * Render target ĐA MẪU. Mặc định EffectComposer dựng target 0 mẫu, nên từ khi có AO thì
     * `antialias: true` của renderer chỉ còn áp lên lớp vẽ cuối — một hình chữ nhật phủ kín
     * màn hình, chẳng có cạnh nào để khử. Đo được samples = 0 trên cả hai target.
     *
     * Truyền target tự dựng thì composer coi pixel ratio là 1, nên phải đặt lại ngay sau.
     */
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(this.renderer, rt);
    composer.setPixelRatio(this.renderer.getPixelRatio());
    composer.addPass(new RenderPass(this.scene, this.camera));

    const gtao = new OpaqueGTAOPass(this.scene, this.camera, size.x, size.y);
      // Bán kính nhỏ: cần bóng Ở KHE, không phải một lớp xám phủ lên cả cảnh. Đơn vị là đơn
      // vị thế giới, mà nhà ở đây rộng 2 — nên 1,2 là đúng tầm chân tường và mép mái.
      gtao.updateGtaoMaterial({
        radius: 1.2,
        distanceExponent: 1.0,
        thickness: 1.0,
        scale: 1.0,
        samples: q.aoSamples,
        distanceFallOff: 1.0,
        screenSpaceRadius: false,
      });
      // 0,85 thì mỗi đường nối giữa hai ô lục giác đều hằn lên, mặt đất đọc ra như lưới mắt
      // cáo. 0,7 giữ được bóng ở chỗ tiếp xúc mà không biến nền thành hoa văn.
    gtao.blendIntensity = 0.7;
    composer.addPass(gtao);
    composer.addPass(new OutputPass());
    // Lớp hoàn thiện: lọc màu ấm, tối góc, mô hình thu nhỏ — xem post.ts.
    const finish = finishPass();
    composer.addPass(finish);
    this.composer = composer;
    this.gtao = gtao;
    this.finish = finish;
  }

  /**
   * Đặt mật độ điểm ảnh theo khung nhìn HIỆN TẠI, trả về true nếu nó vừa đổi.
   *
   * Gọi lại ở mỗi lần đổi cỡ chứ không chỉ lúc đổi bậc: xoay ngang một chiếc điện thoại là
   * khung nhìn đổi hình dạng, mà ngân sách điểm ảnh lại tính từ diện tích khung nhìn.
   */
  private applyPixelRatio(): boolean {
    const raw = pixelRatioFor(this.spec, window.innerWidth, window.innerHeight, window.devicePixelRatio);
    const pr = Math.max(Math.min(raw, 1), raw * this.dprScale);
    if (Math.abs(pr - this.renderer.getPixelRatio()) < 0.001) return false;
    this.renderer.setPixelRatio(pr);
    return true;
  }

  private disposeComposer(): void {
    if (!this.composer) return;
    for (const p of this.composer.passes) p.dispose();
    this.composer.dispose();
    this.composer = null;
    this.gtao = null;
    this.finish = null;
  }

  /**
   * Áp một bậc đồ hoạ: mật độ điểm ảnh, bản đồ bóng, chuỗi hậu kỳ, và phần hình học của bản
   * đồ và mây. Chuỗi hậu kỳ dựng lại từ đầu thay vì vá từng chỗ: số mẫu MSAA của một target
   * không đổi được sau khi đã cấp phát, và đổi bậc là việc hiếm.
   */
  private applyQuality(tier: Tier): void {
    const q = TIERS[tier];
    this.tier = tier;
    this.spec = q;
    this.applyPixelRatio();
    this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    this.sun.shadow.radius = q.shadowRadius;
    // Bản đồ bóng cũ mang cỡ cũ; bỏ đi để three cấp phát lại đúng cỡ ở lượt vẽ sau.
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.scene.environment = q.env ? this.env : null;
    // Không có bản đồ môi trường thì ánh sáng nền phải quay về trông cậy cả vào hemisphere.
    this.hemiBase = q.env ? NEN_TROI : NEN_TROI_TRAN;
    this.hemi.color.setHex(q.env ? MAU_TROI : MAU_TROI_TRAN);
    this.datDen(this.baoLuc);
    if (this.scene.fog) (this.scene.fog as THREE.Fog).far = q.haze ? this.hazeFar : 1e6;
    GRAIN_ON.value = q.grain ? 1 : 0;
    this.map.setQuality(q);
    this.fog.setDetail(q.cloudDetail);
    this.disposeComposer();
    if (q.post) this.buildComposer(q);
    this.resize();
    this.onQuality?.();
  }

  /** Trạng thái đồ hoạ cho HUD. */
  get quality(): { choice: Choice; tier: Tier; label: string; tilt: boolean; tiltAllowed: boolean } {
    return {
      choice: this.gfx.choice, tier: this.tier, label: this.spec.label,
      tilt: this.gfx.tilt, tiltAllowed: this.spec.tilt,
    };
  }

  /** Người chơi chọn bậc. Chọn Tự động là đo lại từ Cao — cách duy nhất để thử lại bậc cao hơn. */
  setQuality(choice: Choice): void {
    this.gfx.choice = choice;
    if (choice === 'auto') {
      this.gfx.autoTier = firstAutoTier();
      this.tune.start();
    } else {
      this.tune.stop();
    }
    saveGfx(this.gfx);
    const t = tierOf(this.gfx);
    if (t !== this.tier) this.applyQuality(t);
    else this.onQuality?.();
  }

  setTilt(on: boolean): void {
    this.gfx.tilt = on;
    saveGfx(this.gfx);
    this.onQuality?.();
  }

  /** Chế độ Tự động: đo xong một đợt mà chậm thì hạ một bậc, rồi đo lại ở bậc mới. */
  private autoTune(gap: number): void {
    if (this.gfx.choice !== 'auto') return;
    if (this.tune.frame(gap) !== 'slow') return;
    const next = stepDown(this.tier);
    if (!next) {
      // Đã ở đáy thang mà vẫn chậm: bớt điểm ảnh. Mờ đi một chút còn hơn giật.
      if (this.dprScale <= 0.5) return;
      this.dprScale = Math.max(0.5, this.dprScale - 0.2);
      if (this.applyPixelRatio()) {
        this.composer?.setPixelRatio(this.renderer.getPixelRatio());
        this.resize();
      }
      this.tune.start();
      return;
    }
    this.dprScale = 1;
    this.gfx.autoTier = next;
    saveGfx(this.gfx);
    this.applyQuality(next);
    this.tune.start();
  }

  /**
   * Thông số của lớp hoàn thiện mỗi khung. Dải nét bám tâm ngắm — tâm ngắm nằm giữa DẢI
   * TRỐNG giữa hai thanh HUD chứ không giữa màn hình. Phóng gần thì dải hẹp và mờ đậm (cảm
   * giác sa bàn rõ nhất), kéo xa thì dải rộng và mờ nhạt: lúc ấy người chơi đang nhìn bao
   * quát, không được làm nhoè chỗ họ cần đọc.
   */
  private updateFinish(): void {
    const f = this.finish;
    if (!f) return;
    /*
     * MÀN HẸP THÌ KHÔNG LÀM MỜ.
     *
     * Dải nét chỉ chiếm chừng một phần ba chiều cao màn hình; trên màn bàn giấy phần còn lại
     * là rìa bản đồ, nhưng trên một chiếc điện thoại dựng đứng thì đó là gần như cả chỗ
     * người chơi đang nhìn — hiệu ứng sa bàn biến thành "nhìn gì cũng mờ". Đây là đúng cái
     * người chơi chụp màn hình gửi về.
     */
    const tilt = this.spec.tilt && this.gfx.tilt && window.innerWidth >= 820;
    f.uniforms.uTilt.value = tilt ? 1 : 0;
    if (!tilt) return;
    const p = this.focusV.copy(this.target).project(this.camera);
    f.uniforms.uFocus.value = (p.y + 1) / 2;
    const k = THREE.MathUtils.clamp((this.zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM), 0, 1);
    f.uniforms.uBand.value = THREE.MathUtils.lerp(0.12, 0.24, k);
    f.uniforms.uBlur.value = THREE.MathUtils.lerp(5, 2.5, k) * this.renderer.getPixelRatio();
  }

  /**
   * Biển tên làng: một Sprite nên nó tự quay mặt về người chơi, không cần xoay gì.
   *
   * KHÔNG xét độ sâu và vẽ sau cùng: cái tên phải đọc được cả khi thủ phủ khuất sau một
   * vách đá. Và nó nằm NGOÀI nhóm công trình, vì nhóm ấy bị co giãn mỗi lần nảy hay rê
   * chuột — biển tên mà nảy theo thì thành ra cái tên đang bị bóp.
   */
  private buildVillageLabel(): void {
    this.villageLabel = new THREE.Sprite(new THREE.SpriteMaterial({
      transparent: true, depthTest: false, depthWrite: false, fog: false,
    }));
    this.villageLabel.scale.set(5.2, 1.3, 1);
    this.villageLabel.renderOrder = 5;
    this.villageLabel.visible = false;
    this.scene.add(this.villageLabel);
    // CHỈ vẽ chữ, không dựng lại nền đất: hàm này chạy trong khối khởi tạo, lúc lưới nền
    // trống còn chưa tồn tại — gọi rebuildPlots ở đây là ném lỗi ngay khi mở game.
    this.paintVillageLabel();
  }

  private paintVillageLabel(): void {
    const v = this.economy.state.village;
    const mat = this.villageLabel.material;
    mat.map?.dispose();
    mat.map = v.name ? labelTexture(v.name, v.color) : null;
    mat.needsUpdate = true;
    this.villageLabel.visible = !!v.name;
  }

  /** Người chơi vừa đổi tên hay đổi cờ: vẽ lại biển tên và dựng lại thủ phủ. */
  refreshVillage(): void {
    this.paintVillageLabel();
    this.rebuildPlots();
  }

  // ------------------------------------------------------------ đánh dấu

  private buildMarkers(): void {
    /*
     * Vòng chọn công trình và người cũng dùng ảnh quầng mềm như vòng chọn bãi, thay cho vành
     * RingGeometry mép cứng — cả game chỉ còn một ngôn ngữ "đang chọn": một vùng sáng dần ra
     * mép rồi tắt, không phải một nét khoanh bút. Đỉnh sáng của ảnh nằm ở 93% bán kính, nên
     * tấm phẳng được nới ra cho vành sáng rơi đúng chỗ vành cũ. Vẫn xoay −π/2 quanh X như vành
     * cũ, để mấy đoạn co giãn sẵn có (scale x, y) chạy y nguyên.
     */
    const quang = haloTexture();
    const ring = (color: number, opacity: number, r: number) => {
      const nua = (r + 0.15) / 0.93;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(nua * 2, nua * 2),
        new THREE.MeshBasicMaterial({
          map: quang, color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
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
    this.selectRing = ring(0xffc766, 1, 2.7);
    this.hoverRing = ring(0xffffff, 0.7, 2.55);
    this.unitRing = ring(0x7fd8ff, 1, 0.72);
    this.denRing = ring(0xff6b5e, 1, 3.6);

    // Lá cờ lệnh: một cái cọc và một tam giác vải. Vật liệu không nhận sáng, để nó nổi
    // hẳn lên khỏi cảnh — nó là giao diện cắm xuống đất, không phải một đồ vật của làng.
    this.co = new THREE.Group();
    const coc = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 5),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
    coc.position.y = 0.75;
    const vai = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',
      new THREE.Float32BufferAttribute([0, 1.5, 0, 0, 1.0, 0, 0.62, 1.25, 0], 3)),
      new THREE.MeshBasicMaterial({ color: 0x7fd8ff, side: THREE.DoubleSide }));
    this.co.add(coc, vai);
    // To gấp đôi cỡ một người dân: đo trên màn 375 điểm, cờ cao bằng người thì lẫn vào cỏ.
    this.co.scale.setScalar(2.1);
    this.co.visible = false;
    this.scene.add(this.co);

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
      const b = id ? this.economy.buildingById(id) : undefined;
      mesh.visible = !!b;
      if (b) {
        mesh.position.set(b.position[0],
          this.map.groundY(b.position[0], b.position[2]) + 0.22, b.position[2]);
      }
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

    /*
     * HAI VONG RIENG, vi cong trinh khong con la mot nen dat nua.
     *
     * Ban cu duyet nen dat roi tra xem nen ay co cong trinh chua - nen cong trinh chi ton
     * tai o noi may sinh the gioi da rai san mot o nau. Gio cong trinh dung tren o luc giac
     * cua rieng no: vong mot ve cong trinh theo state.buildings, vong hai ve nhung nen nau
     * con trong, bo qua nen nao da bi mot cong trinh chiem mat o.
     */
    const con = new Set<string>();
    const khoi: [number, number, number][] = [];
    for (const building of this.economy.state.buildings) {
      const x = building.position[0];
      const z = building.position[2];
      const y = this.map.groundY(x, z);
      con.add(building.id);
      const ong = chimneyTop(building.type, building.level);
      if (ong) khoi.push([x + ong[0], y + ong[1], z + ong[2]]);
      const sig = this.signatureOf(building);
      const cu = this.structures.get(building.id);
      if (cu && cu.sig === sig) {
        // Dat duoi chan co the doi cao do khi khoi ban do nap lai; bam theo. Ca toa do
        // ngang nua: cong trinh gio DOI DUOC, ma chu ky thi khong mang toa do.
        cu.g.userData.baseY = y;
        cu.g.position.set(x, y, z);
        continue;
      }
      if (cu && cu.sig.split(':').slice(0, 2).join(':') !== sig.split(':').slice(0, 2).join(':')) {
        this.popping.set(building.id, 0);
      }
      if (cu) this.plotGroup.remove(cu.g);
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.userData.bid = building.id;
      g.userData.baseY = y;
      this.buildStructure(g, building, building.id);
      this.plotGroup.add(g);
      this.structures.set(building.id, { g, sig });
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
        if (o instanceof THREE.Mesh && o.userData.bid) this.pickable.push(o);
      });
    }
    // Bien ten bam THU PHU, khong bam nen dat: nen dat bien mat khi khoi goc roi bo nho,
    // va bien ten thi khong duoc phep bien theo.
    const core = this.economy.state.buildings.find((b) => b.type === 'townhall');
    if (core) {
      const cy = this.map.groundY(core.position[0], core.position[2]);
      this.villageLabel.position.set(
        core.position[0], cy + 6.2 + core.level * 0.12, core.position[2]);
    }
    this.smoke.setSources(khoi);
  }


  /** Chữ ký của một công trình: đổi một trong ba thứ này thì phải dựng lại hình. */
  /**
   * Chữ ký của một công trình: đổi một trong các thứ này thì phải dựng lại hình.
   *
   * Thủ phủ mang thêm màu cờ, vì màu ấy nằm trong các đỉnh của khối đã hàn chứ không tô
   * sau được — đổi cờ mà chữ ký không đổi thì lá cờ cứ giữ màu cũ tới khi lên cấp.
   */
  private signatureOf(b: Building): string {
    return b.type === 'townhall'
      ? `${this.signature(b)}:${this.economy.state.village.color}`
      : this.signature(b);
  }

  private signature(b: Building): string {
    const crates = b.type === 'outpost'
      ? Math.min(5, Math.ceil(Object.values(b.stock).reduce<number>((a, v) => a + (v ?? 0), 0) / 20))
      : 0;
    // Thời đại nằm trong chữ ký: lên đời là MỌI công trình dựng lại với vật liệu mới.
    return `${b.type}:${b.level}:${crates}:${this.economy.state.age}`;
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
    // Cả công trình là MỘT khối đã hàn, tô bằng màu đỉnh — xem buildings.ts.
    const mesh = new THREE.Mesh(
      buildingGeometry(b.type, b.level, this.economy.state.village.color, kieuOf(id),
        this.economy.state.age),
      buildingMaterial());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.bid = id;
    g.add(mesh);

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

  /** Khoảng cách giữa hai ngón đầu tiên đang chạm; 0 khi chưa đủ hai ngón. */
  private doNgon(): number {
    const [a, b] = [...this.ngon.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  /**
   * Ghi chỗ con trỏ CHUỘT trên khung vẽ; ngón tay thì xoá đi.
   *
   * Hai kiểu ngắm cho hai kiểu tay. Chuột có một con trỏ luôn hiện và rê không tốn gì, nên
   * mô hình mờ đi theo nó và bấm là đặt — đúng như đế chế. Ngón tay thì che mất đúng chỗ nó
   * chỉ, và không có "rê": ở đó khung ngắm đứng yên giữa màn, bản đồ trượt bên dưới.
   */
  private ghiChuot(e: PointerEvent): void {
    const la = e.pointerType === 'mouse';
    if (la) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      (this.chuot ??= new THREE.Vector2()).set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1);
    } else {
      this.chuot = null;
    }
    if (la !== this.laChuot) {
      this.laChuot = la;
      document.body.classList.toggle('chuot', la);
    }
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.ghiChuot(e);
    this.ngon.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Bắt con trỏ SAU khi đã ghi xong trạng thái: setPointerCapture ném lỗi khi id không
    // còn sống, và ném giữa chừng là cả cử chỉ chụm chết theo.
    try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* bỏ qua */ }
    if (this.ngon.size >= 2) {
      // Ngón thứ hai chạm xuống là chuyển hẳn sang chụm: buông kéo, và đánh dấu đã rê đủ
      // xa để lúc nhấc tay không bị tính thành một cú bấm chọn.
      this.dragging = false;
      this.dragged = 99;
      this.khoangNgon = this.doNgon();
      return;
    }
    this.dragging = true;
    this.dragged = 0;
    this.last.set(e.clientX, e.clientY);
  };

  private onPointerCancel = (e: PointerEvent): void => {
    this.ngon.delete(e.pointerId);
    this.khoangNgon = 0;
    this.dragging = false;
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.ghiChuot(e);
    const ghi = this.ngon.get(e.pointerId);
    if (ghi) { ghi.x = e.clientX; ghi.y = e.clientY; }
    // Chụm hai ngón: tỉ lệ khoảng cách đổi bao nhiêu thì khung nhìn đổi bấy nhiêu, nên
    // ngón tay giữ đúng chỗ nó đang nắm. Trên điện thoại đây là ĐƯỜNG DUY NHẤT để phóng —
    // trước bản này máy không có con lăn chuột thì chỉ còn cách chụm trang web cho mờ ra.
    if (this.ngon.size >= 2) {
      const d = this.doNgon();
      if (this.khoangNgon > 0 && d > 0) {
        this.wantedZoom = THREE.MathUtils.clamp(
          this.wantedZoom * (this.khoangNgon / d), MIN_ZOOM, MAX_ZOOM);
      }
      this.khoangNgon = d;
      return;
    }
    if (!this.dragging) {
      // Đang cầm mô hình mờ bằng chuột: con trỏ là điểm ngắm, không phải thứ để chọn nhà.
      if (this.ghostType && this.chuot) {
        this.renderer.domElement.style.cursor = 'crosshair';
        return;
      }
      // Rê tới đâu sáng tới đó. Con trỏ đổi hình là tín hiệu rẻ nhất cho biết "bấm được".
      const id = this.pickBuilding(e);
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
    // Tỉ lệ lấy THẲNG từ khung camera chứ không đoán lại từ mức phóng: khung ấy còn bị dải
    // HUD và hệ số màn hẹp nắn lại, nên đoán lại là đất trôi không khớp ngón tay.
    const k = (this.camera.top - this.camera.bottom) / window.innerHeight;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
    const fwd = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right).normalize();
    this.wanted.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k);
    this.clampTarget();
  };

  private onPointerUp = (e: PointerEvent): void => {
    const dangChum = this.ngon.size >= 2;
    this.ngon.delete(e.pointerId);
    this.dragging = false;
    if (dangChum) {
      // Nhấc một ngón giữa lúc chụm: ngón còn lại thành điểm kéo mới. Không đặt lại thì
      // lần rê kế tiếp tính từ toạ độ của ngón vừa nhấc, và bản đồ giật một đoạn.
      this.khoangNgon = 0;
      const con = [...this.ngon.values()][0];
      if (con) { this.dragging = true; this.last.set(con.x, con.y); }
      return;
    }
    // Đã kéo thì đừng coi là bấm chọn — ngưỡng nhỏ để bấm nhanh vẫn ăn.
    if (this.dragged > 6) return;

    /*
     * ĐANG ĐẶT NHÀ: BẤM VÀO ĐÂU, KHUNG NGẮM TRƯỢT TỚI ĐÓ.
     *
     * Trước bản này cách duy nhất để chọn chỗ là kéo cả bản đồ cho tới khi chỗ ấy chui vào
     * dưới khung ngắm — trên điện thoại là ba, bốn lần vuốt cho một căn nhà. Ai cũng thử
     * bấm thẳng vào chỗ mình muốn trước, và cú bấm ấy lại đi chọn một người dân đứng gần.
     * Giờ cú bấm dời camera đúng bằng độ lệch giữa điểm bấm và điểm ngắm, nên mô hình mờ
     * tới đúng chỗ ngón tay vừa chạm. Kéo vẫn dùng được như cũ.
     */
    if (this.ghostType) {
      if (e.pointerType === 'mouse') {
        // Chuột: mô hình mờ đã đứng sẵn dưới con trỏ. Bấm trái là đặt, bấm phải là bỏ.
        if (e.button === 2) { this.onPlaceCancel?.(); return; }
        if (e.button !== 0) return;
        this.ghiChuot(e);
        this.updateGhost();
        this.onPlaceClick?.();
        return;
      }
      if (this.groundPoint(e)) {
        this.wanted.x = this.target.x + this.hitPoint.x - this.aimRaw.x;
        this.wanted.z = this.target.z + this.hitPoint.z - this.aimRaw.z;
      }
      return;
    }

    // Cú bấm nào cũng bỏ hang đang chọn trước; bấm lại đúng hang ấy thì nhánh dưới chọn lại.
    this.pickDen(null);
    // Trúng thẳng hình khối của một nền đất thì nền đất thắng, không bàn thêm.
    const hit = this.pickMesh(e);
    if (hit) {
      this.chooseUnit(null);
      // Bam thang vao hinh khoi cung phai bo chon bai: khong thi the bai van che mat the
      // cong trinh, vi renderInspector() xet bai truoc nen dat.
      this.pickPatch(null);
      this.punch = 1;
      this.selectedId = hit.userData.bid as string;
      this.focusOnBuilding(this.selectedId);
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
    let bestKind: 'unit' | 'build' | 'node' | 'den' | null = null;
    let bestId: string | null = null;
    let bestScore = 1;

    const consider = (
      kind: 'unit' | 'build' | 'node' | 'den', id: string, dist: number, radius: number,
    ) => {
      const score = dist / radius;
      if (score < bestScore) { bestScore = score; bestKind = kind; bestId = id; }
    };

    for (const u of this.economy.state.units) {
      consider('unit', u.id, Math.hypot(u.position[0] - px, u.position[2] - pz), 1.7);
    }
    // Bán kính 2,1 là bán kính nội tiếp của một ô lục giác: bấm trong ô nào thì trúng
    // công trình của ô ấy, không với sang ô bên.
    for (const b of this.economy.state.buildings) {
      consider('build', b.id, Math.hypot(b.position[0] - px, b.position[2] - pz), 2.1);
    }
    // Bai lay CHINH ban kinh cua no lam vung bam: bai la mot khu dat, nen bam dau trong khu
    // cung phai trung. Day la dieu kien de "chi vao roi dieu dan toi" thanh mot thao tac tu
    // nhien, chu khong phai tro ngam ban vao mot cai cay.
    for (const b of this.map.patches) {
      if (!this.fog.isRevealed(b.center[0], b.center[2])) continue;
      consider('node', b.id, Math.hypot(b.center[0] - px, b.center[2] - pz), b.radius);
    }
    for (const d of this.beasts.living) {
      consider('den', d.id, Math.hypot(d.x - px, d.z - pz), 3.4);
    }

    // Hang thú: luôn là CHỌN, kể cả lúc đang cầm dân — không ai muốn lỡ tay lùa dân vào hang.
    if (bestKind === 'den' && bestId) {
      this.chooseUnit(null);
      this.pickPatch(null);
      this.selectedId = null;
      this.updateMarkers();
      this.onSelect?.(null);
      this.pickDen(bestId);
      return;
    }

    if (bestKind === 'unit' && bestId) {
      this.selectedId = null;
      this.pickPatch(null);
      this.updateMarkers();
      this.onSelect?.(null);
      this.chooseUnit(bestId);
      return;
    }
    if (bestKind === 'build' && bestId) {
      this.chooseUnit(null);
      this.pickPatch(null);
      this.punch = 1;
      this.selectedId = bestId;
      this.focusOnBuilding(bestId);
      this.updateMarkers();
      this.onSelect?.(bestId);
      return;
    }
    /*
     * ĐANG CHỌN DÂN THÌ CÚ BẤM TIẾP THEO LÀ MỘT MỆNH LỆNH.
     *
     * Trước bản này người chơi chỉ điều dân được qua con số +/− trên thẻ bãi — "cho ba
     * người tới đây" — và không có cách nào bảo một người đi tới một chỗ KHÔNG có bãi, tức
     * là không tự đi khám phá được: mây chỉ tan theo ý của một người thám hiểm do máy cắt
     * cử. Giờ chọn người rồi bấm vào đất là họ đi tới đó (và đứng đủ lâu cho mây tan), bấm
     * vào bãi là họ làm ở bãi ấy. Cú bấm trúng một người khác hay một công trình vẫn là
     * chọn, như cũ — nên bỏ chọn bằng nút × trên thẻ chứ không bằng cách bấm ra đất trống.
     */
    const quan = this.dieuDuoc();
    if (quan.length > 0 && bestKind !== 'unit' && bestKind !== 'build') {
      if (bestKind === 'node' && bestId) {
        this.onLenh?.('bai', this.lenhBai(bestId), bestId);
      } else {
        this.onLenh?.('di', this.lenhDi(px, pz), null);
      }
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
    this.onTapEmpty?.();
  };

  /** Vòng chọn của những người trong nhóm, và lá cờ ở đích của lệnh đang chạy. */
  private veDoi(): void {
    let k = 0;
    let dich: Unit | null = null;
    if (this.doi.size > 0) {
      for (const u of this.economy.state.units) {
        if (!this.doi.has(u.id)) continue;
        if (!dich && u.targetId === LENH && u.state === 'moving' && u.targetPos) dich = u;
        if (u.id === this.selectedUnitId || u.state === 'voyage') continue;
        let m = this.doiRings[k];
        if (!m) {
          m = new THREE.Mesh(this.unitRing.geometry, this.unitRing.material);
          m.rotation.x = -Math.PI / 2;
          m.renderOrder = 2;
          this.scene.add(m);
          this.doiRings[k] = m;
        }
        m.visible = true;
        m.position.set(
          u.position[0], this.map.groundY(u.position[0], u.position[2]) + 0.3, u.position[2]);
        k += 1;
      }
    }
    for (let i = k; i < this.doiRings.length; i += 1) this.doiRings[i].visible = false;

    // Cờ cắm ở đích của người ĐẦU TIÊN còn đang trên đường; cả nhóm tới nơi thì cờ rút.
    const p = dich?.targetPos;
    this.co.visible = !!p;
    if (p) {
      this.co.position.set(p[0], this.map.groundY(p[0], p[2]), p[2]);
      this.co.rotation.y = Math.PI * 0.25 + Math.sin(this.elapsed * 2.2) * 0.3;
    }
  }

  /** Bỏ mọi thứ đang chọn. Giao diện gọi khi mở một ngăn: hai thẻ không đứng chung được. */
  boChon(): void { this.clearSelection(); }

  private clearSelection(): void {
    this.thoiBam();
    this.choLo = null;
    this.chooseUnit(null);
    this.pickPatch(null);
    this.pickDen(null);
    this.selectedId = null;
    this.updateMarkers();
    // KHÔNG đụng mức phóng ở đây nữa. Bản trước kéo về mức nghỉ mỗi lần bỏ chọn, nên ai đã
    // tự chụm vào gần thì cứ bấm ra đất trống là khung nhìn lại nhảy ra xa.
    this.onSelect?.(null);
  }

  private chooseUnit(id: string | null): void {
    if (this.selectedUnitId === id && this.doi.size <= 1) return;
    this.selectedUnitId = id;
    this.doi.clear();
    if (id) this.doi.add(id);
    if (id === null) this.thoiBam();
    else {
      const u = this.economy.state.units.find((x) => x.id === id);
      if (u) this.giuTrongKhung(u.position[0], u.position[2]);
    }
    this.unitRing.visible = id !== null;
    this.onSelectUnit?.(id);
  }

  get selectedUnit(): string | null {
    return this.selectedUnitId;
  }

  get selectedDen(): string | null {
    return this.selectedDenId;
  }

  /** Chọn một hang thú (null = bỏ chọn). Vòng đỏ nằm yên ở chân hang. */
  pickDen(id: string | null): void {
    if (this.selectedDenId === id) return;
    const d = id ? this.beasts.living.find((x) => x.id === id) : undefined;
    this.selectedDenId = d ? d.id : null;
    this.denRing.visible = !!d;
    if (d) {
      this.denRing.position.set(d.x, this.map.groundY(d.x, d.z) + 0.3, d.z);
      this.giuTrongKhung(d.x, d.z);
    }
    this.onSelectDen?.(this.selectedDenId);
  }

  /** Bao nhiêu người đang được chọn (một người chính cộng nhóm của họ). */
  get soChon(): number { return this.doi.size; }

  /** Những người trong nhóm nhận được lệnh: dân làng đang có mặt trên bản đồ. */
  private dieuDuoc(): Unit[] {
    if (this.doi.size === 0) return [];
    return this.economy.state.units.filter(
      (u) => this.doi.has(u.id) && u.kind === 'villager' && u.state !== 'voyage');
  }

  /**
   * Nới nhóm ra quanh người chính: `tat` = cả làng, không thì những người trong 18 bước.
   * Không có kéo khung chọn như đế chế: trên màn cảm ứng một ngón kéo đã là kéo bản đồ.
   */
  chonNhom(tat: boolean): number {
    const chinh = this.economy.state.units.find((u) => u.id === this.selectedUnitId);
    if (!chinh) return 0;
    for (const u of this.economy.villagers()) {
      if (u.state === 'voyage') continue;
      const d = Math.hypot(u.position[0] - chinh.position[0], u.position[2] - chinh.position[2]);
      if (tat || d <= 18) this.doi.add(u.id);
    }
    this.onSelectUnit?.(this.selectedUnitId);
    return this.doi.size;
  }

  /** Điều cả nhóm tới một điểm. Mỗi người một chỗ đứng riêng quanh điểm ấy, xếp xoắn ốc. */
  lenhDi(x: number, z: number): number {
    const quan = this.dieuDuoc();
    quan.forEach((u, i) => {
      // Góc vàng: rải đều mà không cần biết trước nhóm có bao nhiêu người.
      const r = i === 0 ? 0 : 0.95 * Math.sqrt(i);
      const g = i * 2.399963;
      this.workers.order(u, x + Math.cos(g) * r, z + Math.sin(g) * r);
    });
    return quan.length;
  }

  /** Bảo cả nhóm làm ở một bãi. */
  lenhBai(id: string): number {
    const bai = this.map.patchById(id);
    if (!bai) return 0;
    const quan = this.dieuDuoc();
    const ca = this.economy.villagers();
    for (const u of quan) this.workers.orderPatch(u, bai, Math.max(0, ca.indexOf(u)));
    return quan.length;
  }

  /** Thả cả nhóm về cho máy tự chia việc. */
  thaDan(): number {
    const quan = this.dieuDuoc();
    for (const u of quan) this.workers.release(u);
    return quan.length;
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
    const bai = id ? this.map.patchById(id) : null;
    if (bai) this.giuTrongKhung(bai.center[0], bai.center[2]);
    this.updateMarkers();
    this.onSelectPatch?.(id);
  }

  get following(): string | null {
    return this.followId;
  }

  /**
   * Bật/tắt bám theo một người. Bám thì kéo luôn mức phóng vào gần, vì bám mà nhìn từ xa
   * thì chẳng khác gì không bám. Đây là chỗ DUY NHẤT một cú bấm được đổi mức phóng — người
   * chơi đã bấm đúng cái nút "Follow" — và thôi bám thì mức cũ được trả lại.
   */
  setFollow(id: string | null): void {
    if (!id) { this.thoiBam(); return; }
    this.followId = id;
    this.zoomTruocBam = null;
    if (this.wantedZoom > FOCUS_ZOOM) {
      this.zoomTruocBam = this.wantedZoom;
      this.wantedZoom = FOCUS_ZOOM;
    }
  }

  /**
   * Thôi bám, và trả mức phóng về như trước lúc bám — nhưng chỉ khi người chơi chưa tự
   * chụm hay lăn chuột trong lúc bám: mức họ tự chọn thì là của họ.
   */
  private thoiBam(): void {
    if (!this.followId) return;
    this.followId = null;
    if (this.zoomTruocBam !== null && Math.abs(this.wantedZoom - FOCUS_ZOOM) < 0.01) {
      this.wantedZoom = this.zoomTruocBam;
    }
    this.zoomTruocBam = null;
  }

  /*
   * CHỌN MỘT THỨ KHÔNG ĐƯỢC LÀM KHUNG NHÌN NHẢY.
   *
   * Trước bản này mỗi cú bấm đổi khung nhìn theo HAI cách chồng lên nhau: bấm vào nhà thì
   * camera bay tới và phóng vào mức 12; và thẻ kiểm tra vừa trượt lên là cả cảnh bị co lại
   * cho vừa phần màn còn trống — trên điện thoại thẻ chiếm gần nửa màn, nên cảnh nhỏ đi
   * gần một nửa. Bấm ra chỗ trống thì mọi thứ lại nở ra. Người chơi gọi đúng tên nó: "cứ
   * click vào cái gì là nó lại zoom".
   *
   * Giờ cú bấm không đổi mức phóng, và thẻ kiểm tra không còn nắn khung camera (xem
   * resize()). Chỉ còn một can thiệp: nếu thứ vừa chọn nằm DƯỚI tấm thẻ hoặc sát mép màn
   * thì camera trượt vừa đủ để nó ló ra. Thấy sẵn rồi thì không nhúc nhích gì cả.
   *
   * Phải đợi hai khung: thẻ được dựng trong chính cú bấm này, và chiều cao của nó chỉ đo
   * được sau khi trình duyệt dàn trang xong.
   */
  private giuTrongKhung(x: number, z: number): void {
    this.choLo = { x, z, khung: 2 };
  }

  private xetChoLo(): void {
    const c = this.choLo;
    if (!c) return;
    c.khung -= 1;
    if (c.khung > 0) return;
    this.choLo = null;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const tren = document.querySelector('.bar-top')?.getBoundingClientRect().bottom ?? 0;
    const the = document.querySelector('.inspector:not([hidden])')?.getBoundingClientRect();
    const dock = document.querySelector('.dock')?.getBoundingClientRect();
    const duoi = Math.min(the?.top ?? h, dock?.top ?? h);
    // Lề đủ cho một căn nhà đứng trọn trong khung; dải trống quá hẹp thì co lề lại.
    const leY = Math.min(64, Math.max(0, (duoi - tren) / 3));
    const leX = Math.min(44, w / 4);
    // Xét ở chỗ camera SẼ DỪNG chứ không phải chỗ nó đang trôi qua: camera trực giao nên
    // dời camera một đoạn thì mọi thứ trên màn dời đúng ngược lại đoạn ấy.
    this.tam.set(
      c.x - (this.wanted.x - this.target.x), this.map.groundY(c.x, c.z),
      c.z - (this.wanted.z - this.target.z)).project(this.camera);
    const sx = (this.tam.x + 1) / 2 * w;
    const sy = (1 - this.tam.y) / 2 * h;
    const dx = THREE.MathUtils.clamp(sx, leX, w - leX);
    const dy = THREE.MathUtils.clamp(sy, tren + leY, duoi - leY);
    if (Math.abs(dx - sx) < 1 && Math.abs(dy - sy) < 1) return;
    // Điểm trên mặt đất đang nằm ở chỗ mình muốn thứ kia hiện ra; dời camera đúng bằng độ
    // lệch giữa hai điểm thì thứ kia trượt tới đó. Dời ÍT NHẤT có thể, không đưa vào giữa.
    this.pointer.set((dx / w) * 2 - 1, -(dy / h) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.castToGround()) return;
    this.wanted.x = this.target.x + c.x - this.hitPoint.x;
    this.wanted.z = this.target.z + c.z - this.hitPoint.z;
    this.clampTarget();
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
   * Công trình vừa chọn: chỉ bảo đảm nó không nằm dưới tấm thẻ. Bản trước bay tới và phóng
   * vào gần ở mọi cú bấm — xem giuTrongKhung() để biết vì sao bỏ.
   */
  private focusOnBuilding(id: string): void {
    const b = this.economy.buildingById(id);
    if (b) this.giuTrongKhung(b.position[0], b.position[2]);
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

  private pickBuilding(e: PointerEvent): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickable, false);
    if (hits.length) return hits[0].object.userData.bid as string;

    if (!this.castToGround()) return null;
    let best: string | null = null;
    let bestDist = 2.1;
    for (const b of this.economy.state.buildings) {
      const d = Math.hypot(b.position[0] - this.hitPoint.x, b.position[2] - this.hitPoint.z);
      if (d < bestDist) { bestDist = d; best = b.id; }
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
   * Nút "VIEW …" trên thẻ người dân: camera trượt tới bãi, mức phóng để yên. Trượt xong mà
   * bãi rơi vào dưới tấm thẻ thì xetChoLo() nhích thêm cho nó ló ra.
   */
  focusOnPatch(id: string): void {
    const b = this.map.patchById(id);
    if (!b) return;
    this.panTo(b.center[0], b.center[2]);
    this.giuTrongKhung(b.center[0], b.center[2]);
  }

  /**
   * Kéo khung nhìn ra cho vừa một vòng tròn bán kính `r` quanh tâm ngắm.
   *
   * Phải xét CẢ hai chiều: màn điện thoại dựng đứng thì chiều ngang mới là chiều hẹp, màn
   * máy bàn thì ngược lại. Lấy chiều nào hẹp hơn làm chuẩn, không thì trận đánh tràn ra
   * ngoài mép đúng ở cái máy người ta đang cầm.
   */
  frameRadius(r: number): void {
    const aspect = window.innerWidth / window.innerHeight;
    const no = window.innerHeight / this.freeHeight();
    this.wantedZoom = THREE.MathUtils.clamp(
      r / (Math.min(1, aspect) * no), MIN_ZOOM, MAX_ZOOM);
  }

  /** Mức phóng và tâm ngắm trước lúc vào trận, để xong trận trả lại y nguyên. */
  private truocTran: { zoom: number; x: number; z: number } | null = null;
  /** Báo khi bản diễn trận kết thúc — UI đợi tín hiệu này mới kể kết quả. */
  onBattleEnd: (() => void) | null = null;

  /**
   * Diễn lại một trận: kéo camera về làng, mở khung cho thấy cả đường giặc tới.
   *
   * Không có bước này thì chẳng xem được gì: ở tỉ lệ nghỉ, một màn 393 điểm ảnh chỉ thấy
   * chừng 17 đơn vị bề ngang, mà giặc đổ bộ cách thủ phủ bốn sáu đơn vị.
   */
  playBattle(seed: BattleSeed): void {
    this.truocTran = { zoom: this.wantedZoom, x: this.wanted.x, z: this.wanted.z };
    this.followId = null;
    this.panTo(0, 0);
    this.frameRadius(BATTLE_RADIUS * 0.62);
    this.army.play(seed);
  }

  private endBattle(): void {
    const t = this.truocTran;
    this.truocTran = null;
    if (t) { this.wantedZoom = t.zoom; this.panTo(t.x, t.z); }
    this.onBattleEnd?.();
  }

  get zoomLevel(): number { return this.zoom; }
  select(id: string | null): void {
    this.selectedId = id;
    this.updateMarkers();
  }
  get selected(): string | null { return this.selectedId; }



  /**
   * Nạp mảnh đất và cập nhật tấm sương.
   *
   * Cả tấm sương chỉ nạp lại khi tâm ngắm sang khối khác; giữa hai lần ấy chỉ những khối
   * đang chạy hoạt cảnh vén mới phải ghi, và mỗi khối là đúng một byte.
   */
  private updateGround(): void {
    this.dat.update(this.target.x, this.target.z);
    const cx = Math.floor(this.target.x / CHUNK);
    const cz = Math.floor(this.target.z / CHUNK);
    const key = `${cx},${cz}`;
    if (key !== this.fogAt) {
      this.fogAt = key;
      this.dat.refillFog(cx, cz, (a, b) => this.map.fogLevel(a, b));
      return;
    }
    for (const [a, b] of this.map.revealingChunks()) {
      this.dat.setFogAt(a, b, this.map.fogLevel(a, b));
    }
  }

  // ------------------------------------------------------------ chế độ đặt

  /*
   * NGẮM BẰNG BẢN ĐỒ, KHÔNG BẰNG NGÓN TAY.
   *
   * Cách quen thuộc là rê mô hình mờ theo ngón tay, nhưng trên một màn 393 điểm ảnh thì
   * ngón tay che đúng cái đang chọn, và nó giành mất cử chỉ kéo bản đồ — đang đặt mà muốn
   * nhìn chỗ khác thì không còn ngón nào rảnh. Nên mô hình mờ đứng yên ở GIỮA MÀN, hơi
   * chếch lên trên vùng thanh xác nhận, còn người chơi kéo thế giới trôi bên dưới nó. Kéo,
   * chụm, thả tay — mọi cử chỉ cũ chạy y nguyên, và không có gì bị che.
   */

  private ghost: THREE.Mesh | null = null;
  private ghostType: BuildingType | null = null;
  private ghostCell: [number, number] | null = null;
  private ghostWhy: string | null = 'No spot yet';
  /** Điểm khung ngắm chạm đất, CHƯA làm tròn — để bấm-tới-đâu-trượt-tới-đó tính độ lệch. */
  private readonly aimRaw = new THREE.Vector3();
  /** Con trỏ chuột trên khung vẽ (toạ độ chuẩn hoá); null khi lần chạm gần nhất là ngón tay. */
  private chuot: THREE.Vector2 | null = null;
  private laChuot = false;
  private baseRing: THREE.Mesh | null = null;
  private rangeRings: THREE.Mesh[] = [];

  private readonly ghostMat = new THREE.MeshBasicMaterial({
    color: 0x5eead4, transparent: true, opacity: 0.62, depthWrite: false,
  });
  /** Ô đang ngắm, sáng lên dưới chân mô hình mờ. */
  private ghostCellMesh: THREE.Mesh | null = null;
  private readonly cellMat = new THREE.MeshBasicMaterial({
    color: 0x5eead4, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
    depthWrite: false, depthTest: false,
  });

  /**
   * Báo khi LÝ DO đổi. Thanh xác nhận vẽ lại mỗi 200ms, nên nếu chỉ dựa vào nhịp ấy thì
   * có lúc ô đã đỏ mà nút vẫn còn ghi ĐẶT — một phần năm giây nói sai cũng là nói sai.
   */
  onGhost: (() => void) | null = null;
  /** Bấm chuột trái xuống bản đồ lúc đang cầm mô hình mờ: giao diện lo việc đặt và báo. */
  onPlaceClick: (() => void) | null = null;
  /** Bấm chuột phải lúc đang cầm mô hình mờ: bỏ xuống. */
  onPlaceCancel: (() => void) | null = null;
  /** Đang ngắm bằng chuột (mô hình mờ đi theo con trỏ) hay bằng khung ngắm giữa màn. */
  get aimByMouse(): boolean { return this.chuot !== null; }
  /** Bấm xuống chỗ đất trống, không trúng ai. Giao diện dùng nó để đóng ngăn đang mở. */
  onTapEmpty: (() => void) | null = null;

  get placing(): BuildingType | null { return this.ghostType; }
  /**
   * Mã của công trình ĐANG ĐƯỢC DỜI, hoặc null khi chế độ đặt đang dựng cái mới. Dời dùng
   * lại nguyên chế độ đặt — cùng mô hình mờ, cùng vành, cùng nút — vì với người chơi đó là
   * một thao tác: "cái này đứng ở đâu".
   */
  private movingId: string | null = null;
  get moving(): string | null { return this.movingId; }

  /** Nhấc một công trình lên để đặt lại. Trả false khi loại ấy không dời được. */
  startMove(id: string): boolean {
    const b = this.economy.buildingById(id);
    if (!b || !doiDuoc(b.type)) return false;
    this.setPlacing(b.type, id);
    return true;
  }
  /** null nghĩa là đặt được; khác null là lý do chưa đặt được, hiện thẳng lên nút. */
  get placeWhy(): string | null { return this.ghostWhy; }

  private ringMesh(r: number, color: number, opacity: number): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.1, r - 0.28), r, 72),
      // depthTest tắt: vành là lớp chỉ dẫn, nó phải thấy được cả khi chạy qua sau một quả
      // đồi. Vẽ sau cùng nên không che mất gì.
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
        depthTest: false,
      }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 6;
    this.scene.add(m);
    return m;
  }

  /** Bật/tắt chế độ đặt. Truyền null là thoát. */
  setPlacing(type: BuildingType | null, doi: string | null = null): void {
    this.movingId = type ? doi : null;
    // KHÔNG dispose hình học của mô hình mờ: `buildingGeometry` trả về một hình học DÙNG
    // CHUNG, có cache theo loại và cấp. Huỷ nó ở đây là huỷ luôn cái mà mọi căn nhà cùng
    // loại đang vẽ bằng — và lỗi ấy chỉ lộ ra ở lần dựng sau, xa chỗ gây ra nó.
    if (this.ghost) this.scene.remove(this.ghost);
    this.ghost = null;
    this.ghostType = type;
    this.ghostCell = null;
    this.ghostWhy = 'No spot yet';
    for (const r of this.rangeRings) this.scene.remove(r);
    this.rangeRings = [];
    if (this.baseRing) { this.scene.remove(this.baseRing); this.baseRing = null; }
    if (this.ghostCellMesh) this.ghostCellMesh.visible = type !== null;
    if (!type) {
      this.renderer.domElement.style.cursor = 'grab';
      this.updateMarkers();
      return;
    }

    // Mô hình mờ phải là ĐÚNG căn sắp mọc lên: cùng kiểu nhà (kiểu đi theo mã), và khi
    // đang dời thì cùng cấp — không thì nhấc một căn nhà ngói cấp 5 lên lại thấy cái lều.
    const dang = doi ? this.economy.buildingById(doi) : undefined;
    const ma = dang ? dang.id : `b_${this.economy.state.nextBuildingId}`;
    this.ghost = new THREE.Mesh(
      buildingGeometry(type, dang ? dang.level : 1, this.economy.state.village.color, kieuOf(ma),
        this.economy.state.age),
      this.ghostMat);
    this.ghost.renderOrder = 5;
    this.scene.add(this.ghost);
    /*
     * Ô sáng dưới chân. Thiếu nó thì mô hình mờ chỉ là một khối trong trong giữa đồng cỏ —
     * nhìn ảnh thử lần đầu không đọc được nó đang nhắm vào ô nào. Sáu cạnh, bán kính bằng
     * đúng bán kính ngoại tiếp của ô, nên nó TRÙNG KHÍT mặt ô chứ không phải một vệt tròn.
     */
    /*
     * Vùng sáng dưới chân là ĐÚNG diện tích công trình sẽ chiếm — không còn ô lục giác nào
     * để bám. Thiếu nó thì mô hình mờ chỉ là một khối trong trong giữa đồng cỏ, và người
     * chơi không biết nó ăn tới đâu.
     */
    if (this.ghostCellMesh) this.scene.remove(this.ghostCellMesh);
    const g = new THREE.CircleGeometry(FOOTPRINT[type], 28);
    this.ghostCellMesh = new THREE.Mesh(g, this.cellMat);
    this.ghostCellMesh.rotation.x = -Math.PI / 2;
    this.ghostCellMesh.renderOrder = 4;
    this.scene.add(this.ghostCellMesh);
    this.ghostCellMesh.visible = true;

    // Vành căn cứ, và vòng tầm bắn của MỌI chòi canh đang có — chỗ hở nằm ở đâu phải nhìn
    // một cái là thấy, chứ không phải đặt xong mới biết.
    this.baseRing = this.ringMesh(this.economy.baseRadius(), 0x9ab393, 0.5);
    this.baseRing.position.y = 0.3;
    for (const b of this.economy.state.buildings) {
      if (b.type !== 'watchtower') continue;
      const r = this.ringMesh(TOWER_RANGE, 0xfbbf24, 0.28);
      r.position.set(b.position[0], this.map.groundY(b.position[0], b.position[2]) + 0.3,
        b.position[2]);
      this.rangeRings.push(r);
    }
    this.updateGhost();
  }

  /**
   * Chỗ đang ngắm. Có chuột thì là chỗ con trỏ; không thì là điểm giữa màn, nhích lên một
   * phần tư chiều cao cho khỏi nằm dưới thanh xác nhận và dưới bàn tay đang cầm máy.
   */
  private updateGhost(): void {
    const type = this.ghostType;
    if (!type || !this.ghost) return;
    if (this.chuot) this.pointer.copy(this.chuot);
    else this.pointer.set(0, 0.22);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.castToGround()) {
      this.ghost.visible = false;
      if (this.ghostCellMesh) this.ghostCellMesh.visible = false;
      return;
    }
    this.aimRaw.copy(this.hitPoint);
    // Làm tròn về lưới nửa đơn vị: đặt tự do không có nghĩa là toạ độ lẻ tới bảy chữ số,
    // và một con số gọn thì bản lưu cũng gọn.
    const cx = Math.round(this.hitPoint.x * 2) / 2;
    const cz = Math.round(this.hitPoint.z * 2) / 2;
    this.ghostCell = [cx, cz];
    const truoc = this.ghostWhy;
    const dang = this.movingId ? this.economy.buildingById(this.movingId) : undefined;
    if (dang) {
      // Dời thì không tốn gì, nên không có chuyện "chưa đủ vật liệu".
      this.ghostWhy = this.economy.moveBlock(dang, cx, cz, this.fog.isRevealed(cx, cz));
    } else {
      this.ghostWhy = this.economy.placeBlock(cx, cz, type, this.fog.isRevealed(cx, cz));
      const du = this.economy.canAfford(this.economy.buildCostFor(type));
      if (!this.ghostWhy && !du) this.ghostWhy = THIEU_VAT_LIEU;
    }
    if (truoc !== this.ghostWhy) this.onGhost?.();
    this.ghost.visible = true;
    const gy = this.map.groundY(cx, cz);
    this.ghost.position.set(cx, gy, cz);
    const mau = this.ghostWhy ? 0xfb7185 : 0x5eead4;
    this.ghostMat.color.setHex(mau);
    this.cellMat.color.setHex(mau);
    if (this.ghostCellMesh) {
      this.ghostCellMesh.visible = true;
      this.ghostCellMesh.position.set(cx, gy + 0.26, cz);
    }
  }

  /** Đặt xuống ô đang ngắm. Trả về false kèm lý do nằm ở placeWhy. */
  placeNow(): boolean {
    if (!this.ghostType || !this.ghostCell || this.ghostWhy) return false;
    const [cx, cz] = this.ghostCell;
    if (this.movingId) {
      const xong = this.economy.moveBuilding(this.movingId, cx, cz, true);
      // Dời xong là thoát: dời là việc làm MỘT lần, khác với xây là việc làm liền tay.
      if (xong) { this.punch = 1; this.setPlacing(null); }
      return xong;
    }
    const ok = this.economy.build(cx, cz, this.ghostType, true);
    if (ok) {
      this.punch = 1;
      // Dựng lại vành tầm bắn: vừa đặt thêm một chòi canh thì vùng phủ đã khác, mà cái
      // người chơi cần thấy nhất lúc này đúng là vùng phủ mới.
      this.setPlacing(this.ghostType);
    }
    return ok;
  }

  // ------------------------------------------------------------ vòng render

  /**
   * Chiều cao còn trống giữa hai thanh HUD. KHÔNG trừ thẻ kiểm tra: thẻ trượt lên trượt
   * xuống suốt ván, mà tỉ lệ nghỉ thì phải đứng yên.
   */
  private freeHeight(): number {
    const h = window.innerHeight;
    const topPx = document.querySelector('.bar-top')?.getBoundingClientRect().height ?? 0;
    const dockPx = document.querySelector('.dock')?.getBoundingClientRect().height ?? 0;
    return Math.max(h * 0.34, h - topPx - dockPx - 24);
  }

  /**
   * Mức phóng cho ra đúng PX_PER_UNIT. Suy thẳng từ công thức khung nhìn dưới đây:
   * halfH = zoom × h/freeH, nên số điểm ảnh cho một đơn vị = freeH / (2 × zoom).
   */
  private restZoom(): number {
    return THREE.MathUtils.clamp(this.freeHeight() / (2 * PX_PER_UNIT), MIN_ZOOM, MAX_ZOOM);
  }

  /**
   * Bám mức nghỉ theo HUD, nhưng KHÔNG giằng tay người chơi.
   *
   * Lúc dựng game chưa đo được HUD thật: chữ trong hai thanh còn chưa xuống dòng xong nên
   * chúng thấp hơn cỡ cuối chừng bốn mươi điểm ảnh, tính mức nghỉ ngay lúc ấy là lệch một
   * phần mười. Xoay máy hay mở bàn phím cũng đổi. Nên tính lại mỗi lần khung đổi cỡ — chỉ
   * kéo camera theo khi nó đang ĐỨNG ĐÚNG mức nghỉ cũ; ai đã tự chụm hay lăn chuột tới
   * mức riêng thì mức ấy là của họ, không ai được đụng vào.
   */
  private theoHud(): void {
    const moi = this.restZoom();
    if (Math.abs(moi - this.mucNghi) < 0.01) return;
    const dangNghi = Math.abs(this.wantedZoom - this.mucNghi) < 0.01;
    this.mucNghi = moi;
    if (!dangNghi) return;
    this.wantedZoom = moi;
    this.zoom = moi;
    this.resize();
  }

  private resize = (): void => {
    this.theoHud();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const topPx = document.querySelector('.bar-top')?.getBoundingClientRect().height ?? 0;
    const dockPx = document.querySelector('.dock')?.getBoundingClientRect().height ?? 0;
    // Thẻ kiểm tra KHÔNG tham gia vào khung camera. Bản trước trừ cả chiều cao của nó, nên
    // thẻ mở ra là cả cảnh co lại và dồn lên trên, thẻ đóng là nở ra — một cú "zoom" ở mỗi
    // lần bấm. Thứ đang chọn có bị thẻ che thì xetChoLo() trượt camera, không co cảnh.
    const botPx = dockPx + 24;
    const freeH = this.freeHeight();

    const aspect = w / h;
    const halfH = this.zoom * (h / freeH);
    const shift = ((topPx - botPx) / 2 / h) * 2 * halfH;
    this.camera.top = halfH + shift;
    this.camera.bottom = -halfH + shift;
    this.camera.left = -halfH * aspect;
    this.camera.right = halfH * aspect;
    this.camera.updateProjectionMatrix();
    const doiMatDo = this.applyPixelRatio();
    this.renderer.setSize(w, h, false);
    if (!this.composer) return;
    // Chuỗi hậu kỳ giữ mật độ điểm ảnh riêng; quên đồng bộ là mọi target lệch cỡ với khung.
    if (doiMatDo) this.composer.setPixelRatio(this.renderer.getPixelRatio());
    // composer.setSize tự đặt cỡ cho từng pass, đã nhân pixel ratio. Bản trước gọi thêm
    // gtao.setSize(w, h) theo điểm ảnh CSS, đè mất cỡ đúng trên màn hình mật độ cao.
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    // Bậc Vừa tính AO ở nửa độ phân giải: AO vốn là thứ mềm, nửa cỡ mắt khó nhận ra, mà
    // lượt vẽ pháp tuyến lẫn lượt tính AO đều rẻ đi bốn lần.
    if (this.gtao && this.spec.aoScale < 1) {
      this.gtao.setSize(
        Math.max(1, Math.round(w * pr * this.spec.aoScale)),
        Math.max(1, Math.round(h * pr * this.spec.aoScale)));
    }
    this.finish?.uniforms.uRes.value.set(w * pr, h * pr);
  };

  private watchHud(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => this.resize());
    for (const sel of ['.bar-top', '.dock']) {
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
    const gap = now - this.lastTime;
    // Kẹp cả hai đầu. Mốc của rAF là lúc khung BẮT ĐẦU, có thể sớm hơn lúc setPaused() ghi
    // lastTime, nên gap âm là có thật; một dt âm đủ lớn làm người đứng đúng đích chia 0/0
    // ra NaN, và toạ độ NaN thì nằm luôn trong bản lưu.
    const dt = Math.min(Math.max(gap, 0), MAX_FRAME_DELTA);
    this.lastTime = now;
    this.autoTune(gap);

    this.updateWeather(this.paused ? 0 : dt);
    this.xetChoLo();
    this.moveCamera(dt);
    // Nạp khối chạy cả khi tạm dừng: người chơi vẫn kéo bản đồ đi xem được, và đất mới phải
    // hiện ra theo.
    this.map.update(this.target);
    this.updateGround();
    this.beasts.update(this.elapsed, dt, this.target);
    this.fleet.update(this.elapsed);
    // Mô hình mờ bám ô giữa màn, nên phải tính SAU khi camera đã trôi xong trong khung này.
    if (this.ghostType) this.updateGhost();
    // So voi phien ban DA DUNG chu khong so truoc/sau trong cung mot khung: ai khac goi
    // map.update() (bu gio, cong cu do, bang dieu khien) thi lan doi do khong bi bo qua.
    if (this.map.version !== this.builtVersion) {
      this.builtVersion = this.map.version;
      this.rebuildPlots();
    }

    if (!this.paused) {
      // Nut 1x/2x chi nhan cho MO PHONG, khong nhan cho camera - keo tha ma nhanh gap doi
      // thi tay khong theo kip.
      const sim = dt * (this.economy.state.speedMult === 2 ? 2 : 1);
      this.elapsed += sim;
      this.workers.update(sim);
      this.army.update(sim);
      this.fog.update(sim, this.economy.state.units, this.target,
        1 / (1 - this.economy.bonus.survey), true, this.economy.lookouts());
      this.economy.tick(sim);
      this.map.animate(sim);
      this.smoke.update(sim);
      // Vòng của người dân phải bám từng khung: họ đi liên tục, và cái vòng đứng yên thì
      // tệ hơn là không có vòng nào.
      if (this.selectedUnitId) {
        const u = this.economy.state.units.find((x) => x.id === this.selectedUnitId);
        if (!u) this.chooseUnit(null);           // xe giao xong là biến mất
        else this.unitRing.position.set(
          u.position[0], this.map.groundY(u.position[0], u.position[2]) + 0.3, u.position[2]);
      }
      this.veDoi();
      // Vòng chọn thở nhẹ để mắt bắt được ngay giữa một bản đồ dày đặc.
      if (this.selectRing.visible) {
        const k = 1 + Math.sin(this.elapsed * 3.4) * 0.05;
        this.selectRing.scale.set(k, k, 1);
      }
      this.tweenFeedback(dt);
    }
    if (this.composer) {
      this.updateFinish();
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
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
      const id = g.userData.bid as string | undefined;
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

  /**
   * Trời chuyển theo đồng hồ mùa bão, và camera rung sau cú đập.
   *
   * Màu sương đổi theo chứ không chỉ đèn: sương là thứ chiếm phần lớn mép màn hình ở mức
   * phóng xa, nên để nó xanh trong khi nắng đã tắt thì cảnh đọc ra là "đèn hỏng" chứ không
   * phải "trời sắp mưa".
   */
  private updateWeather(dt: number): void {
    const t = this.economy.state.threat;
    const toi = t.next <= WAVE_WARN_SECONDS
      ? 1 - Math.max(0, t.next) / WAVE_WARN_SECONDS
      : 0;
    this.baoLuc += (toi - this.baoLuc) * Math.min(1, dt * 2.6);
    this.rung = Math.max(0, this.rung - dt * 1.8);
    const k = this.baoLuc;
    if (k < 0.002 && this.rung <= 0) return;
    this.datDen(k);
    // Cả nền trời sau mép bản đồ cũng phải tối theo, nếu không thì đất xám dưới một bầu
    // trời xanh trong đọc ra là lỗi dựng hình.
    this.troi.copy(TROI_THUONG).lerp(TROI_BAO, k);
    this.renderer.setClearColor(this.troi, 1);
    const f = this.scene.fog as THREE.Fog | null;
    if (f) f.color.copy(this.troi);
  }

  /**
   * Đặt cả bốn nguồn sáng theo mức bão `k` (0 là trời quang).
   *
   * MỘT chỗ duy nhất ghi các con số này. Trước đây chúng nằm rải ở ba nơi, và updateWeather
   * thoát sớm khi trời quang — nên `hemiBase` của bậc Thấp (bậc không có bản đồ môi trường)
   * KHÔNG BAO GIỜ được áp cho tới ba mươi giây trước một đợt giặc. Cả bậc Thấp vì thế chạy
   * với nửa lượng ánh sáng nền nó được thiết kế, tối và xám: đo được độ sáng giữa 139 so
   * với 167 của hai bậc kia. Mà bậc Thấp chính là bậc của điện thoại yếu.
   */
  private datDen(k: number): void {
    this.sun.intensity = NANG * (1 - 0.74 * k);
    this.sun.shadow.intensity = BONG * (1 - 0.8 * k);
    this.hemi.intensity = this.hemiBase * (1 - 0.26 * k);
    this.scene.environmentIntensity = NEN_MOI_TRUONG * (1 - 0.6 * k);
  }

  /** Cú đập lúc một đợt nổ ra. Rung mạnh hay nhẹ tuỳ thiệt hại. */
  shake(manh: number): void {
    this.rung = Math.max(this.rung, manh);
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

    /*
     * Khoảng sương tính từ khoảng cách camera tới tâm ngắm cộng một bội của mức phóng. Camera
     * trực giao nên bề rộng khung nhìn tỉ lệ thẳng với mức phóng: lấy một khoảng cố định thì
     * ở mức 10 cả bản đồ chìm trong sương, còn ở mức 62 sương không với tới đâu.
     */
    const f = this.scene.fog as THREE.Fog | null;
    if (f) {
      this.hazeFar = CAM_DIST + this.zoom * 3.4;
      /*
       * Sương bắt đầu ở 1,6 lần mức phóng sau tâm ngắm, không phải 0,9. Ở 0,9 thì lớp sương
       * đã phủ lên từ ngay sau giữa màn hình — nửa trên của khung hình bị rửa trắng dần, và
       * đó là một phần lý do cả cảnh thiếu tương phản. Điểm kết (3,4) giữ nguyên, nên mép
       * vùng nạp vẫn chìm hẳn như cũ.
       */
      f.near = CAM_DIST + this.zoom * 1.6;
      if (this.spec.haze) f.far = this.hazeFar;
    }
    this.camera.position.set(
      this.target.x + CAMERA_OFFSET[0], CAMERA_OFFSET[1], this.target.z + CAMERA_OFFSET[2]);
    this.camera.lookAt(this.target);
    if (this.rung > 0) {
      // Rung SAU lookAt, nếu không thì hướng nhìn tự chỉnh lại và cú rung triệt tiêu chính
      // nó. Hai tần số lệch nhau cho ra nhịp vỡ chứ không phải một con lắc.
      const a = this.elapsed * 47;
      const m = this.rung * this.rung * this.zoom * 0.05;
      this.camera.position.x += Math.sin(a) * m;
      this.camera.position.y += Math.sin(a * 1.63 + 1.1) * m * 0.6;
    }
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

  describe(b: Building): string {
    return BUILDINGS[b.type].describe(b.level);
  }

  stats(): { calls: number; triangles: number } {
    const i = this.renderer.info.render;
    return { calls: i.calls, triangles: i.triangles };
  }
}
