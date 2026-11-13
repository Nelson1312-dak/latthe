/**
 * Dân làng và xe thồ: phân việc, đi lại, đào, giao hàng, và thám hiểm.
 *
 * TOÀN BỘ đơn vị vẽ bằng ba InstancedMesh — thân người, kiện hàng trên lưng, và xe thồ. Hai
 * chục dân mỗi người sáu khối là một trăm hai mươi lệnh vẽ; gom lại còn ba, và con số đó
 * không đổi dù sau này có hai trăm dân. Nhịp lắc khi đi nướng thẳng vào ma trận của từng thực
 * thể nên không mất gì: xoay theo hướng đi, nghiêng người, nhún lên xuống đều là một phép
 * compose duy nhất.
 *
 * VÒNG ĐỜI dân làng:
 *     idle --> moving(tới mỏ) --> gathering --> delivering(về trạm gần nhất) --> idle
 * Trạm trung chuyển là lý do cả bản đồ 60×60 chơi được: không có nó, một chuyến từ rìa về
 * giữa mất hơn một phút và bốn biến sinh thái ngoài xa thành vô dụng.
 *
 * Xe thồ chạy riêng: rời trạm theo chu kỳ, ôm hàng đã gom, bám trục đường về thủ phủ.
 */
import * as THREE from 'three';
import { matte, tinted } from './materials';
import { han, paint } from './shapes';
import { DAN_TAY, DAN_VAI, danLang, tayRoi } from './rigs';
import {
  CART_CAPACITY_MULT, CART_INTERVAL_SECONDS, DEN_YIELD, GATHER_SECONDS, ORDER_HOLD_SECONDS, OUTPOST_RANGE,
  PALETTE, RESOURCES, SCOUT_MIN_VILLAGERS, SCOUT_RANGE_BASE, SCOUT_RANGE_PER_VILLAGER,
} from './config';
import type { Economy } from './Economy';
import type { FogOfWar } from './FogOfWar';
import type { MapManager } from './MapManager';
import type { Building, Patch, ResourceKind, Unit, Vec3 } from './types';
import { RESOURCE_KINDS } from './types';
import { denNearPatch } from './dens';
import { waterAt } from './world';

const ARRIVE = 0.35;
/*
 * Hai mã đích dành cho lệnh của người chơi. Chúng đi nhờ `targetId` như 'scout' đã đi nhờ,
 * nên không cần thêm trạng thái nào vào `UnitState` — mà thêm trạng thái thì mọi `switch`
 * trong bản lưu cũ, trong giao diện và trong bot chạy thử đều phải biết tới.
 */
/** Đang đi tới điểm người chơi chỉ. */
export const LENH = 'lenh';
/** Đã tới điểm ấy, đang đứng chờ (đếm bằng `gatherTimer`). */
export const CHO = 'cho';
/**
 * Ghim "đi khám phá" — đặt vào `pin` như một mã bãi. Người mang ghim này cứ đi tới chỗ chưa
 * ai tới cho tới khi được thả; hết chỗ trong tầm thì tạm đi hái, tầm nở ra thì lại đi tiếp.
 */
export const KHAM_PHA = 'kham-pha';
const MAX_UNITS = 220;
/** Sức chứa của lưới xe thồ. */
const CART_CAP = 24;
/** Bán kính bánh xe, và bốn chỗ trục bánh (x dọc thân xe, z ngang). */
/**
 * Cỡ người dân, xe bò và kiện hàng so với bản dựng gốc.
 *
 * Mô hình vẽ đúng tỉ lệ thật so với ô đất: người cao 1,23 trên ô rộng 4,16 — một người
 * đứng giữa thửa ruộng. Nhưng đây là game nhìn từ trên cao trên màn điện thoại, và ở tỉ lệ
 * thật người dân cao chừng hai chục điểm ảnh, tức một hạt bụi biết đi. Hệ số này nhân cho
 * CẢ người, dụng cụ, kiện hàng lẫn xe bò nên không có món nào lệch cỡ với món nào; nó chỉ
 * đụng tới ma trận vẽ, không đụng tới bán kính tới nơi hay vùng bấm chọn.
 */
const NGUOI = 1.35;
const WHEEL_R = 0.26;
const WHEELS: readonly (readonly [number, number])[] = [[-0.32, -0.42], [-0.32, 0.42], [0.32, -0.42], [0.32, 0.42]];
/**
 * Cỡ vẽ dân làng. Dáng mới có tỉ lệ thật (cao hơn dáng chibi cũ), nên nhân bớt một chút để
 * người vẫn đứng vừa cửa nhà.
 */
const DAN = NGUOI * 0.92;
/** Bộ xương dân làng: thân, chân rời, khớp hông. */
const RIG = danLang();

type Role = ResourceKind | 'scout' | null;

export class WorkerManager {
  private readonly economy: Economy;
  private readonly map: MapManager;
  private readonly fog: FogOfWar;
  readonly group = new THREE.Group();

  private readonly bodies: THREE.InstancedMesh;
  private readonly cargo: THREE.InstancedMesh;
  private readonly carts: THREE.InstancedMesh;
  /** Dụng cụ trên tay — rìu cuốc cho người đang có việc. */
  private readonly tools: THREE.InstancedMesh;
  /** Bánh xe tách khỏi thân xe để lăn được. */
  private readonly wheels: THREE.InstancedMesh;
  /** Hai chân và hai tay của mỗi người — lưới rời để bước và vung tay thật. */
  private readonly legs: THREE.InstancedMesh;
  private readonly arms: THREE.InstancedMesh;
  /** Quãng đường đã đi và mức "đang đi" của từng người, để chân bước đúng nhịp, không trượt. */
  private readonly buocDan = new Map<string, { x: number; z: number; quang: number; di: number }>();
  private readonly mChi = new THREE.Matrix4();
  /** Việc của từng người, nhớ theo đích để khỏi tra bãi mỗi khung. */
  private readonly roles = new Map<string, { t: string; kind: ResourceKind | null }>();
  /** Góc đã lăn của bánh từng xe, và chỗ xe đứng ở khung trước. */
  private readonly wheelTurn = new Map<string, { x: number; z: number; goc: number }>();
  private readonly mPart = new THREE.Matrix4();
  private readonly mRot = new THREE.Matrix4();
  private readonly mTmp = new THREE.Matrix4();
  private elapsed = 0;

  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 1, 0);
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly color = new THREE.Color();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  /**
   * Cao độ ĐANG VẼ của từng người — nội suy về cao độ mặt đất chứ không nhảy thẳng tới. Mặt
   * ô phẳng nên đi qua mép bậc là cao độ đổi đột ngột; gán thẳng thì người giật lên một bậc
   * trong một khung, đọc ra như lỗi. Không lưu vào bản lưu: nó thuần tuý là hình.
   */
  private readonly yVe = new Map<string, number>();

  constructor(economy: Economy, map: MapManager, fog: FogOfWar) {
    this.economy = economy;
    this.map = map;
    this.fog = fog;

    // Áo trắng trong hình nên nhận màu của bản (màu theo việc); mặt, tay, nón giữ màu đỉnh.
    const nguoi = tinted(matte());
    nguoi.vertexColors = true;
    this.bodies = new THREE.InstancedMesh(RIG.body, nguoi, MAX_UNITS);
    const quan = matte();
    quan.vertexColors = true;
    this.legs = new THREE.InstancedMesh(RIG.leg!, quan, MAX_UNITS * 2);
    // Tay áo nhận màu việc như thân áo; bàn tay giữ màu da.
    this.arms = new THREE.InstancedMesh(tayRoi(), nguoi, MAX_UNITS * 2);
    this.cargo = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.38, 0.38, 0.3),
      matte(), MAX_UNITS);
    const xe = tinted(matte(undefined, true));
    xe.vertexColors = true;
    this.carts = new THREE.InstancedMesh(this.cartGeometry(), xe, CART_CAP);
    const go = matte(undefined, true);
    go.vertexColors = true;
    this.tools = new THREE.InstancedMesh(this.toolGeometry(), go, MAX_UNITS);
    this.wheels = new THREE.InstancedMesh(this.wheelGeometry(), go, CART_CAP * 4);

    for (const mesh of [this.bodies, this.cargo, this.carts, this.tools, this.wheels, this.legs, this.arms]) {
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    // HAI người chứ không phải một. Một người thì làng trông như bị bỏ hoang, và quan
    // trọng hơn: chuyến đi biển đòi để lại một người giữ làng, nên với đúng một dân thì
    // thứ duy nhất làm được trong mười phút đầu lại bị khoá mất.
    const seed = () => {
      while (this.economy.state.units.length < 2) {
        this.spawnVillager(this.economy.state.buildings[0]);
      }
    };
    seed();
    this.economy.onReset = seed;
  }

  // ----------------------------------------------------------- hình học


  /**
   * Xe thồ: sàn gỗ có thành, đống hàng (trắng — nhận màu loại hàng), càng xe và con bò.
   * Mũi xe là +X cục bộ. Bánh xe là lưới riêng, xem wheelGeometry.
   */
  private cartGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, hex: number | null): void => {
      g.translate(x, y, z);
      parts.push(paint(g, hex));
    };
    add(new THREE.BoxGeometry(1.0, 0.16, 0.72), 0, 0.42, 0, PALETTE.trunk);
    for (const z of [-0.33, 0.33]) add(new THREE.BoxGeometry(1.0, 0.16, 0.06), 0, 0.57, z, PALETTE.trunk);
    add(new THREE.BoxGeometry(0.8, 0.2, 0.54), 0, 0.6, 0, null);
    add(new THREE.BoxGeometry(0.5, 0.15, 0.4), -0.05, 0.77, 0, null);
    for (const z of [-0.14, 0.14]) add(new THREE.BoxGeometry(0.42, 0.05, 0.05), 0.68, 0.45, z, PALETTE.trunk);
    add(new THREE.BoxGeometry(0.56, 0.34, 0.36), 1.04, 0.5, 0, PALETTE.ox);
    add(new THREE.BoxGeometry(0.22, 0.22, 0.24), 1.38, 0.6, 0, PALETTE.trunk);
    for (const z of [-0.1, 0.1]) add(new THREE.BoxGeometry(0.05, 0.12, 0.05), 1.4, 0.76, z, PALETTE.cloud);
    for (const x of [0.86, 1.22]) {
      for (const z of [-0.12, 0.12]) add(new THREE.BoxGeometry(0.08, 0.32, 0.08), x, 0.16, z, PALETTE.ox);
    }
    return han(parts);
  }

  /** Bánh xe: vành gỗ và hai nan bắt chéo. Nan phải nhô ra hai mặt vành, không thì quay không ai thấy. */
  private wheelGeometry(): THREE.BufferGeometry {
    const vanh = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.08, 10);
    vanh.rotateX(Math.PI / 2);
    const parts = [paint(vanh, PALETTE.iron)];
    for (const a of [0, Math.PI / 2]) {
      const nan = new THREE.BoxGeometry(WHEEL_R * 1.9, 0.05, 0.1);
      nan.rotateZ(a);
      parts.push(paint(nan, PALETTE.trunk));
    }
    return han(parts);
  }

  /** Cuốc: cán gỗ, lưỡi sắt. Gốc toạ độ ở chỗ tay cầm. */
  private toolGeometry(): THREE.BufferGeometry {
    const can = new THREE.CylinderGeometry(0.026, 0.032, 0.6, 5);
    can.translate(0, 0.22, 0);
    const luoi = new THREE.BoxGeometry(0.34, 0.08, 0.08);
    luoi.translate(0, 0.5, 0);
    return han([paint(can, PALETTE.trunk), paint(luoi, PALETTE.granite)]);
  }

  /** Việc của một người: theo hàng đang mang, không thì theo bãi đang nhắm tới. */
  private roleOf(u: Unit): Role {
    // Người đang theo lệnh mặc cùng màu áo với người thám hiểm: cả hai đều "đang đi đâu đó
    // chứ không đi làm", và người chơi cần nhìn ra họ giữa một đám thợ.
    if (u.targetId === 'scout' || u.targetId === LENH || u.targetId === CHO) return 'scout';
    if (u.carryingKind) return u.carryingKind;
    if (!u.targetId) return null;
    const c = this.roles.get(u.id);
    if (c && c.t === u.targetId) return c.kind;
    const kind = this.map.patchById(u.targetId)?.kind ?? null;
    this.roles.set(u.id, { t: u.targetId, kind });
    return kind;
  }

  // ------------------------------------------------------------- sinh đơn vị

  spawnVillager(home: Building): void {
    if (this.economy.state.units.length >= MAX_UNITS) return;
    this.economy.state.units.push({
      id: `v${this.economy.state.units.length}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'villager', state: 'idle',
      speed: this.economy.speed(), capacity: this.economy.capacity(),
      position: [home.position[0], 0, home.position[2]],
      targetId: null, targetPos: null, facing: 0,
      carrying: 0, carryingKind: null, gatherTimer: 0,
      homeId: 'core',
    });
  }

  /** Suc cho mot chuyen xe. Tran gom tai tram rong gap boi so nay de khong nghen. */
  private cartLoad(o: Building): number {
    return Math.floor(
      this.economy.capacity() * CART_CAPACITY_MULT * o.level * (1 + this.economy.bonus.cart));
  }

  private spawnCart(outpost: Building): void {
    // Cho loai dang ton nhieu nhat truoc.
    let kind: ResourceKind | null = null;
    let most = 0;
    for (const k of RESOURCE_KINDS) {
      const v = outpost.stock[k] ?? 0;
      if (v > most) { most = v; kind = k; }
    }
    if (!kind) return;
    const load = Math.min(most, this.cartLoad(outpost));
    outpost.stock[kind] = most - load;
    this.economy.state.units.push({
      id: `c${Date.now().toString(36)}`,
      kind: 'cart', state: 'delivering',
      speed: this.economy.speed() * 0.85,
      capacity: this.economy.capacity() * CART_CAPACITY_MULT * outpost.level,
      position: [outpost.position[0], 0, outpost.position[2]],
      targetId: 'core', targetPos: [0, 0, 0], facing: 0,
      carrying: load, carryingKind: kind, gatherTimer: 0,
      homeId: outpost.id,
    });
  }

  // --------------------------------------------------------------- mô phỏng

  /**
   * `ve = false` khi tua nhanh lúc người chơi quay lại: hai giờ vắng là 14.400 bước mô phỏng,
   * và không ai nhìn thấy khung hình nào trong số đó — dựng ma trận cho từng người mỗi bước
   * là tốn vô ích.
   */
  update(dt: number, ve = true): void {
    this.elapsed += dt;
    const units = this.economy.state.units;

    // Xe roi ben khi DU TAI, khong cho het chu ky.
    //
    // Ban dau chi cho dong ho: 26 giay mot chuyen, moi chuyen toi da 50 don. Do duoc la sau
    // tho do vao nhanh hon the nhieu, nen hang un lai o tram va thu nhap TUT tu 936 xuong
    // 550 trong 300 giay - tram tro thanh nut that chu khong phai loi the. Gio du tai la di
    // ngay; dong ho chi con de vet not cho hang le khong nam mai o tram.
    for (const o of this.economy.outposts()) {
      o.cartTimer -= dt;
      const total = RESOURCE_KINDS.reduce((s, k) => s + (o.stock[k] ?? 0), 0);
      const full = this.cartLoad(o);
      if (total >= full || (o.cartTimer <= 0 && total > 0)) {
        o.cartTimer = CART_INTERVAL_SECONDS;
        this.spawnCart(o);
      }
    }

    for (let i = units.length - 1; i >= 0; i -= 1) {
      const u = units[i];
      if (u.kind === 'cart') {
        if (this.step(u, dt)) {
          if (u.carryingKind) this.economy.deposit(u.carryingKind, u.carrying);
          units.splice(i, 1);          // xe giao xong là về kho bãi, không lảng vảng
        }
        continue;
      }
      // Người đang đi biển không có mặt trên bản đồ: không đi làm, không vén sương, và
      // dưới kia draw() cũng bỏ qua họ nên họ biến mất khỏi cảnh cho tới lúc về.
      if (u.state === 'voyage') continue;
      this.villager(u, dt);
    }
    if (ve) this.draw(dt);
  }

  // ------------------------------------------------------- lệnh của người chơi

  /** Điều một người tới một điểm. Lệnh mới xoá lệnh cũ, kể cả cái ghim bãi. */
  order(u: Unit, x: number, z: number): void {
    if (u.kind !== 'villager' || u.state === 'voyage') return;
    u.pin = null;
    u.targetId = LENH;
    u.targetPos = [x, 0, z];
    u.state = 'moving';
  }

  /** Bảo một người làm ở một bãi, và cứ quay lại đó cho tới khi được thả. */
  orderPatch(u: Unit, patch: Patch, cho: number): void {
    if (u.kind !== 'villager' || u.state === 'voyage') return;
    u.pin = patch.id;
    // Đang vác hàng về thì để họ đổ xong đã: quay ngoắt lại bãi là mất trắng chuyến hàng,
    // vì lúc bắt đầu đào chuyến mới thì thứ đang vác bị ghi đè.
    if (u.carrying > 0) { if (u.state !== 'delivering') this.veKho(u); return; }
    u.targetId = patch.id;
    u.targetPos = patch.spots[cho % patch.spots.length];
    u.state = 'moving';
  }

  /** Thả một người về cho máy tự chia việc. */
  release(u: Unit): void {
    if (u.kind !== 'villager' || u.state === 'voyage') return;
    u.pin = null;
    if (u.targetId === LENH || u.targetId === CHO) this.xongLenh(u);
  }

  /** Hết lệnh: đang vác gì thì mang về kho trước, không thì rảnh tay chờ việc. */
  private xongLenh(u: Unit): void {
    if (u.carrying > 0 && u.carryingKind) { this.veKho(u); return; }
    u.state = 'idle';
    u.targetId = null;
  }

  private veKho(u: Unit): void {
    const drop = this.dropPoint(u.position);
    u.homeId = drop.id;
    u.targetId = drop.id;
    u.targetPos = [drop.position[0], 0, drop.position[2]];
    u.state = 'delivering';
  }

  private villager(u: Unit, dt: number): void {
    switch (u.state) {
      case 'idle':
        if (u.targetId === CHO) {
          u.gatherTimer -= dt;
          if (u.gatherTimer > 0) break;
          this.xongLenh(u);
          if (u.state !== 'idle') break;
        }
        this.dispatch(u);
        break;
      case 'moving':
        if (this.step(u, dt)) {
          if (u.targetId === LENH) {
            u.state = 'idle';
            u.targetId = CHO;
            u.gatherTimer = ORDER_HOLD_SECONDS;
            break;
          }
          if (u.targetId === 'scout') { u.state = 'idle'; u.targetId = null; break; }
          u.state = 'gathering';
          u.gatherTimer = GATHER_SECONDS;
        }
        break;
      case 'gathering':
        u.gatherTimer -= dt;
        if (u.gatherTimer <= 0) {
          const node = u.targetId ? this.map.patchById(u.targetId) : undefined;
          // Bãi nằm trong tầm một hang thú còn sống: đào vội, mang về được ít.
          const thu = node ? denNearPatch(node) : null;
          const he = thu && !this.economy.isHunted(thu.id) ? DEN_YIELD : 1;
          u.carrying = Math.max(1, Math.round(u.capacity * (node?.richness ?? 1) * he));
          u.carryingKind = node?.kind ?? 'wood';
          const drop = this.dropPoint(u.position);
          u.homeId = drop.id;
          u.targetId = drop.id;
          u.targetPos = [drop.position[0], 0, drop.position[2]];
          u.state = 'delivering';
        }
        break;
      case 'delivering':
        if (this.step(u, dt)) {
          this.unload(u);
          u.state = 'idle';
          u.targetId = null;
        }
        break;
    }
  }

  /** Trạm gần nhất trong tầm, nếu không thì thủ phủ. Đây là toàn bộ giá trị của trạm. */
  private dropPoint(from: Vec3): Building {
    const core = this.economy.state.buildings.find((b) => b.type === 'townhall')!;
    let best = core;
    let bestDist = Math.hypot(from[0], from[2]);
    for (const o of this.economy.outposts()) {
      const d = Math.hypot(o.position[0] - from[0], o.position[2] - from[2]);
      if (d < bestDist && d <= OUTPOST_RANGE) { best = o; bestDist = d; }
    }
    return best;
  }

  private unload(u: Unit): void {
    if (!u.carryingKind || u.carrying <= 0) return;
    const target = this.economy.state.buildings.find((b) => b.id === u.targetId);
    if (target && target.type === 'outpost') {
      // Gom tại trạm; xe thồ sẽ chở về sau. Trần gom rộng rãi để trạm không tự nghẽn.
      // Tran gom rong gap bon lan mot chuyen xe: tram chi la cho trung chuyen, khong duoc
      // phep day den muc chan tho lai.
      const cap = this.cartLoad(target) * 4;
      target.stock[u.carryingKind] =
        Math.min(cap, (target.stock[u.carryingKind] ?? 0) + u.carrying);
    } else {
      this.economy.deposit(u.carryingKind, u.carrying);
    }
    u.carrying = 0;
    u.carryingKind = null;
  }

  /**
   * Giao việc. Một người được cắt đi thám hiểm khi còn đất chưa vén — nếu không thì màn mây
   * chẳng bao giờ mở, vì dân chỉ chạy tới những mỏ mà họ đã nhìn thấy.
   */
  private dispatch(u: Unit): void {
    // Cái ghim của người chơi đứng trên mọi phép chia việc của máy. Chỉ nhường khi kho của
    // món ấy đã đầy — lúc đó đào thêm là đổ đi, và người chơi cũng không muốn thế.
    const villagers0 = this.economy.villagers();
    // Người được điều đi khám phá: tầm xa hơn người máy tự cắt, vì đây là ý người chơi.
    if (u.pin === KHAM_PHA) {
      const spot = this.fog.nearestUnrevealed(u.position, (SCOUT_RANGE_BASE
        + SCOUT_RANGE_PER_VILLAGER * villagers0.length) * 1.6);
      if (spot) {
        u.targetId = 'scout';
        u.targetPos = spot;
        u.state = 'moving';
        return;
      }
    }
    const ghim = u.pin ? this.map.patchById(u.pin) : undefined;
    if (ghim && !this.economy.isFull(ghim.kind)) {
      u.targetId = ghim.id;
      u.targetPos = ghim.spots[Math.max(0, this.economy.villagers().indexOf(u)) % ghim.spots.length];
      u.state = 'moving';
      return;
    }

    /*
     * KHÔNG còn nhánh "ra trạm chở hàng". Nó là dấu vết của một bản cũ, và nó khoá cả làng:
     * dân tới trạm thì rơi vào trạng thái "đang hái" với một bãi không tồn tại, nhận về một
     * gánh GỖ từ hư không, đổ ngay vào chính trạm ấy, trạm lại "có hàng cần chở", và người
     * ấy quay lại — mãi mãi. Đo bằng pace: chín dân đứng ở một trạm suốt ba tiếng, kho gỗ
     * đầy tràn còn đá thì không ai đi lấy, làng kẹt ở đời II. Hàng ở trạm là việc của xe thồ.
     */
    const villagers = villagers0;
    /*
     * NGƯỜI KHÁM PHÁ do người chơi đặt số (bảng Dân làng). Lấy những người CUỐI danh sách, và
     * luôn chừa ít nhất hai người đi hái — làng ba người thì một người đi, đúng như bản cũ máy
     * tự cắt.
     */
    const soDi = Math.min(this.economy.state.scouts,
      Math.max(0, villagers.length - (SCOUT_MIN_VILLAGERS - 1)));
    const viTri = villagers.indexOf(u);
    // Hạn ngạch là mệnh lệnh trực tiếp của người chơi, nên nó đứng TRÊN việc đi thám hiểm:
    // giao ba người cho một bãi mà máy vẫn rút một người đi vén mây thì người chơi chỉ thấy
    // lệnh của mình bị phớt lờ.
    if (soDi > 0 && viTri >= villagers.length - soDi && !this.quotaUnmet()) {
      // Chân trời nở theo làng: đông dân hơn thì dám đi xa hơn. Để thả lỏng thì người thám
      // hiểm biến mất khỏi nền kinh tế ngay trong giờ đầu.
      const spot = this.fog.nearestUnrevealed(u.position, SCOUT_RANGE_BASE
        + SCOUT_RANGE_PER_VILLAGER * villagers.length);
      if (spot) {
        u.targetId = 'scout';
        u.targetPos = spot;
        u.state = 'moving';
        return;
      }
    }

    const patch = this.pickPatch(u);
    if (!patch) { u.targetId = null; return; }
    // Chia chỗ đứng theo thứ tự người, nên hai dân cùng bãi không chồng lên nhau.
    const i = Math.max(0, villagers.indexOf(u));
    u.targetId = patch.id;
    u.targetPos = patch.spots[i % patch.spots.length];
    u.state = 'moving';
  }

  /** Bãi đang nạp và đã lộ khỏi màn mây. */
  private visiblePatches(): Patch[] {
    return this.map.patches.filter((b) => this.fog.isRevealed(b.center[0], b.center[2]));
  }

  /** Còn bãi nào người chơi đã giao mà chưa đủ người không. */
  private quotaUnmet(): boolean {
    const dem = this.headcount();
    for (const [id, n] of Object.entries(this.economy.state.assignments)) {
      if (n > (dem.get(id) ?? 0)) return true;
    }
    return false;
  }

  /** Số dân đang làm từng loại hàng, trừ một người (người đang nhận việc). */
  kindCount(tru?: Unit): Map<ResourceKind, number> {
    const out = new Map<ResourceKind, number>();
    for (const v of this.economy.villagers()) {
      if (v === tru || v.state === 'voyage') continue;
      const b = v.targetId ? this.map.patchById(v.targetId) : undefined;
      const k = b ? b.kind : v.state === 'delivering' ? v.carryingKind : null;
      if (k) out.set(k, (out.get(k) ?? 0) + 1);
    }
    return out;
  }

  /** Số người đang trên đường khám phá (máy cắt hay người chơi điều). */
  explorers(): number {
    return this.economy.villagers().filter((u) => u.targetId === 'scout').length;
  }

  /** Điều những người này đi khám phá cho tới khi được thả. */
  explore(us: Unit[]): number {
    let n = 0;
    for (const u of us) {
      if (u.kind !== 'villager' || u.state === 'voyage') continue;
      u.pin = KHAM_PHA;
      // Đang vác hàng thì đổ xong đã, như orderPatch.
      if (u.carrying > 0) { if (u.state !== 'delivering') this.veKho(u); } else {
        u.state = 'idle';
        u.targetId = null;
      }
      n += 1;
    }
    return n;
  }

  /** Số dân đang nhắm từng bãi — để biết hạn ngạch nào còn thiếu người. */
  private headcount(): Map<string, number> {
    const out = new Map<string, number>();
    for (const u of this.economy.villagers()) {
      if (!u.targetId) continue;
      out.set(u.targetId, (out.get(u.targetId) ?? 0) + 1);
    }
    return out;
  }

  /**
   * Dân nhận việc, theo bốn mức ưu tiên.
   *
   * 1. CHỞ HÀNG. Đống hàng đầy ở trạm là trạm đó dừng hẳn, tốn hơn mọi thứ khác.
   * 2. ĐƠN HÀNG XÂY DỰNG. Người chơi bấm xây mà thiếu vật liệu thì cả làng quay sang gom.
   * 3. HẠN NGẠCH BÃI. Người chơi tự điều bao nhiêu người tới bãi nào thì đúng bấy nhiêu.
   *    Đây là mệnh lệnh trực tiếp, nên nó đứng trên mọi suy đoán của máy.
   * 4. TỰ CÂN (nếu bật). Kho nào vơi nhất thì đi lấy loại đó. Kho đầy thì bỏ qua hẳn — đào
   *    thêm vào kho đầy là ném đi công sức.
   *
   * Tắt tự cân mà không đặt hạn ngạch nào thì dân đứng chơi, và đó là điều đúng: người chơi
   * đã nói họ muốn tự điều.
   */
  private pickPatch(u: Unit): Patch | null {
    const seen = this.visiblePatches();
    if (seen.length === 0) return null;
    const con = (b: Patch) => !this.economy.isFull(b.kind);

    const need = this.economy.demandKinds();
    if (need.length > 0) {
      const hop = seen.filter((b) => need.includes(b.kind) && con(b));
      if (hop.length > 0) return this.nearest(u, hop);
    }

    // Hạn ngạch: bãi nào còn thiếu người so với số người chơi đã đặt.
    const dem = this.headcount();
    const thieu = seen
      .filter((b) => con(b))
      .map((b) => ({ b, d: (this.economy.state.assignments[b.id] ?? 0) - (dem.get(b.id) ?? 0) }))
      .filter((x) => x.d > 0)
      .sort((a, z) => z.d - a.d);
    if (thieu.length > 0) return thieu[0].b;

    /*
     * DÂN THEO LOẠI HÀNG: người chơi đặt "4 người lấy lương thực" ở bảng Dân làng. Loại nào
     * còn thiếu người nhất thì người này đi, tới bãi lời nhất của loại đó. Đếm không tính
     * chính người đang nhận việc, nên mỗi chuyến về là một lần chia lại cho đúng.
     */
    const muon = this.economy.state.focus;
    let loai: ResourceKind | null = null;
    let hut = 0;
    if (Object.keys(muon).length > 0) {
      const co = this.kindCount(u);
      for (const k of RESOURCE_KINDS) {
        const d = (muon[k] ?? 0) - (co.get(k) ?? 0);
        if (d > hut && seen.some((b) => b.kind === k && con(b))) { hut = d; loai = k; }
      }
    }
    if (loai) {
      let tot: Patch | null = null;
      let diemTot = -1;
      for (const b of seen) {
        if (b.kind !== loai || !con(b)) continue;
        const diem = this.rateOf(u, b);
        if (diem > diemTot) { diemTot = diem; tot = b; }
      }
      if (tot) return tot;
    }

    if (!this.economy.state.autoFarm) return null;

    /*
     * Tự cân: chấm điểm MỌI bãi một lượt, bằng thu nhập mỗi giây nhân với mức CẦN của loại.
     *
     * Bản trước chọn hai bước — lấy loại có kho vơi nhất, rồi lấy bãi gần nhất trong loại
     * ấy. Nghe hợp lý nhưng đo ra thì hỏng: pha lê hiếm nên kho pha lê LUÔN vơi nhất, nên
     * cả làng bị kéo đi bộ hai trăm đơn vị tới rừng pha lê trong khi có cả rừng gỗ cách nhà
     * ba chục bước. Gộp hai bước thành một phép nhân thì cái gần vẫn thắng khi nó đáng.
     */
    let best: Patch | null = null;
    let bestScore = -1;
    for (const b of seen) {
      if (!con(b)) continue;
      const diem = this.rateOf(u, b) * this.needFor(b.kind);
      if (diem > bestScore) { bestScore = diem; best = b; }
    }
    return best;
  }

  /**
   * Bãi lợi nhất theo TRỌN VÒNG, không theo khoảng cách tới người.
   *
   * Lấy bãi gần người nhất nghe hợp lý nhưng sai: dân sinh ra ở thủ phủ nên cứ quanh quẩn ở
   * giữa, và vì bãi không cạn kiệt nên không bao giờ phải đi xa — trạm trung chuyển đứng
   * không một ngày nào. Chấm điểm cả vòng thì một bãi xa mà cạnh trạm sẽ thắng một bãi gần
   * phải cõng bộ về thủ phủ, và dân tự toả ra bản đồ.
   */
  /**
   * Loại này đang CẦN tới mức nào — hệ số nhân lên thu nhập mỗi giây.
   *
   * Không thể chỉ nhìn "kho vơi bao nhiêu phần trăm": vàng mua được mọi thứ, nhưng không
   * xây nổi căn nhà nào. Pha lê đáng bảy lần khúc gỗ mà chẳng công trình nào cần tới nó —
   * nên khi chấm điểm thuần theo giá trị, cả làng bỏ sang pha lê, gỗ đá cạn sạch, và ván
   * game đứng lại ở cấp 5 với kho đầy pha lê không tiêu được vào đâu. Đo được đúng như vậy.
   *
   * Thước đúng là MỨC KẸT: thiếu so với món đắt nhất đang muốn mua thì loại ấy quý hơn giá
   * thị trường của nó rất nhiều; đủ rồi thì nó tụt về đúng giá, rồi nhạt dần khi kho đầy.
   * Nhờ thế pha lê thành mặt hàng xuất khẩu — thứ đi lấy khi nhà đã đủ ăn — chứ không phải
   * một cái bẫy ở hai đầu.
   *
   * Mức kẹt đo theo GIÁ của món đang muốn mua, không theo mức giữ của thủ phủ. Mức giữ có
   * một cái sàn cố định, và lấy nó làm thước thì pha lê — thứ chẳng công trình nào cần —
   * vẫn bị coi là "đang thiếu 150" nên cả làng kéo nhau đi bộ 113 đơn vị từ phút hai mươi,
   * lúc làng mới có ba người. Đo được: nhịp độ tụt đúng một phần ba.
   */
  private needFor(kind: ResourceKind): number {
    const co = this.economy.state.inv[kind];
    // Chang cong trinh nao can toi no: hang xuat khau, cham diem thuan theo do day kho.
    if (this.economy.costPressure(kind) <= 0) {
      return Math.max(0.15, 1 - this.economy.fillRatio(kind));
    }
    // So voi MUC GIU chu khong voi dung gia: muc giu co san du dia 1,35 lan. Do dung gia
    // thi khi con thieu 2% he so da tut ve 1, nen dan khong buon di lay not - do duoc mot
    // ngoi lang dung o tam nguoi suot ba tieng chi vi thieu ba can luong thuc.
    const muc = Math.max(1, this.economy.reserveOf(kind));
    if (co < muc) return 1 + 3 * (1 - co / muc);
    return Math.max(0.15, 1 - this.economy.fillRatio(kind));
  }

  /**
   * Một chuyến tới bãi này đáng bao nhiêu MỖI GIÂY.
   *
   * Đây là thước đo duy nhất để so hai bãi với nhau, và nó phải tính cả quãng về: đo bản
   * trước thấy dân đứng cách nhà 280 đơn vị mà vẫn cõng bộ từng chuyến về thủ phủ — mỗi
   * vòng bốn phút cho 19 món hàng, tức nền kinh tế đứng im. Quãng từ chỗ đang đứng tới bãi
   * chỉ trả MỘT lần rồi người ấy ở lại chạy vòng, nên nó chia cho số chuyến ước chừng;
   * quãng bãi–kho thì trả lại mỗi chuyến, nên tính đủ hai chiều.
   */
  private rateOf(u: Unit, b: Patch): number {
    const drop = this.dropPoint(b.center);
    const ve = Math.hypot(drop.position[0] - b.center[0], drop.position[2] - b.center[2]);
    const toi = Math.hypot(b.center[0] - u.position[0], b.center[2] - u.position[2]);
    const hang = u.capacity * b.richness * RESOURCES[b.kind].value;
    const giay = (ve * 2 + toi / 4) / Math.max(0.5, u.speed) + GATHER_SECONDS;
    return hang / giay;
  }

  private nearest(u: Unit, list: Patch[]): Patch | null {
    let best: Patch | null = null;
    let bestRate = -1;
    for (const b of list) {
      const rate = this.rateOf(u, b);
      if (rate > bestRate) { bestRate = rate; best = b; }
    }
    return best;
  }

  /**
   * Nhích một đơn vị về đích. Trả về true khi tới nơi.
   *
   * Xe thồ bám trục đường: trước hết tạt về trục gần nhất rồi mới chạy dọc trục về thủ phủ.
   * Dân làng đi thẳng — họ cắt qua đồng cỏ, và ở một thế giới mở thì đó mới là dáng tự nhiên.
   */
  private step(u: Unit, dt: number): boolean {
    if (!u.targetPos) return true;
    let [tx, , tz] = u.targetPos;

    if (u.kind === 'cart') {
      const [px, , pz] = u.position;
      // Còn xa trục thì nhắm vào trục trước; đã bám trục rồi thì chạy thẳng về giữa.
      if (Math.abs(px) > 1.2 && Math.abs(pz) > 1.2) {
        if (Math.abs(px) < Math.abs(pz)) { tx = 0; tz = pz; } else { tx = px; tz = 0; }
      }
    }

    const dx = tx - u.position[0];
    const dz = tz - u.position[2];
    const dist = Math.hypot(dx, dz);
    if (dist > 0.001) u.facing = Math.atan2(dx, dz);

    const budget = u.speed * dt;
    if (dist <= budget + ARRIVE) {
      u.position[0] = tx;
      u.position[2] = tz;
      // Tạt vào trục xong thì chưa phải tới nơi; khung sau tính tiếp chặng dọc trục.
      const real = u.targetPos;
      return Math.hypot(real[0] - u.position[0], real[2] - u.position[2]) <= ARRIVE + 0.01;
    }
    u.position[0] += (dx / dist) * budget;
    u.position[2] += (dz / dist) * budget;
    return false;
  }

  // ------------------------------------------------------------------- vẽ

  /** Cao độ vẽ của một người, đã nội suy về mặt đất bên dưới. */
  private yOf(id: string, x: number, z: number, dt: number): number {
    // Qua sông qua biển thì LỘI: mặt nước chính là mặt đất, nên chìm người xuống một đoạn là
    // mặt đất tự cắt ngang lưng — khỏi cần một hoạt cảnh bơi.
    const dat = this.map.groundY(x, z) - waterAt(x, z) * 0.42;
    const cu = this.yVe.get(id);
    const y = cu === undefined ? dat : cu + (dat - cu) * (1 - Math.exp(-14 * dt));
    this.yVe.set(id, y);
    return y;
  }

  private draw(dt: number): void {
    const units = this.economy.state.units;
    let vi = 0;
    let ci = 0;
    let ti = 0;

    for (const u of units) {
      if (u.kind === 'cart') {
        if (ci >= CART_CAP) continue;
        this.v.set(u.position[0], this.yOf(u.id, u.position[0], u.position[2], dt), u.position[2]);
        // Mũi xe (phía con bò) là +X cục bộ; xoay facing − π/2 thì +X trùng hướng đi. Bản
        // trước cộng π/2 nên bò đi giật lùi, đẩy xe từ phía sau.
        this.q.setFromAxisAngle(this.axis, u.facing - Math.PI / 2);
        this.s.set(NGUOI, NGUOI, NGUOI);
        this.m.compose(this.v, this.q, this.s);
        this.carts.setMatrixAt(ci, this.m);
        this.carts.setColorAt(ci, this.color.setHex(
          u.carryingKind ? RESOURCES[u.carryingKind].color : PALETTE.sand));
        // Bánh lăn ĐÚNG quãng xe đã đi: góc = quãng đường / bán kính. Xe đứng thì bánh đứng.
        const w = this.wheelTurn.get(u.id);
        if (w) {
          // Bán kính thật của bánh là WHEEL_R đã phóng, không thì bánh quay sai nhịp đi.
          w.goc += Math.hypot(u.position[0] - w.x, u.position[2] - w.z) / (WHEEL_R * NGUOI);
          w.x = u.position[0];
          w.z = u.position[2];
        } else {
          this.wheelTurn.set(u.id, { x: u.position[0], z: u.position[2], goc: 0 });
        }
        this.mRot.makeRotationZ(-(w?.goc ?? 0));
        for (let k = 0; k < 4; k += 1) {
          // Toạ độ bánh là CỤC BỘ nên đã được this.m phóng sẵn, giữ nguyên số gốc.
          this.mPart.makeTranslation(WHEELS[k][0], WHEEL_R, WHEELS[k][1]).multiply(this.mRot);
          this.wheels.setMatrixAt(ci * 4 + k, this.mTmp.multiplyMatrices(this.m, this.mPart));
        }
        ci += 1;
        continue;
      }
      if (u.state === 'voyage') continue;
      if (vi >= MAX_UNITS) break;

      /*
       * BƯỚC ĐI THẬT. Nhịp chân tính theo QUÃNG ĐƯỜNG đã đi chia cho sải bước, nên người đi
       * nhanh bước nhanh, đứng lại thì chân khép — không còn cảnh trượt trên đất. Tay vung
       * ngược chân; lúc hái thì tay phải giơ cuốc lên quá đầu rồi bổ xuống.
       */
      const walking = u.state === 'moving' || u.state === 'delivering';
      let bc = this.buocDan.get(u.id);
      if (!bc) {
        bc = { x: u.position[0], z: u.position[2], quang: vi * 0.37, di: 0 };
        this.buocDan.set(u.id, bc);
      }
      const dq = Math.hypot(u.position[0] - bc.x, u.position[2] - bc.z);
      bc.quang += dq;
      bc.x = u.position[0];
      bc.z = u.position[2];
      bc.di += ((walking && dq > 1e-4 ? 1 : 0) - bc.di) * Math.min(1, dt * 12);
      const di = bc.di;
      const nhip = (bc.quang / (RIG.stride * DAN)) * Math.PI;
      const sin = Math.sin(nhip);
      const nhun = Math.abs(sin) * di;
      const dap = u.state === 'gathering' ? Math.max(0, Math.sin(this.elapsed * 7 + vi * 0.9)) : 0;
      const mang = u.carrying > 0 && !!u.carryingKind;

      const y = this.yOf(u.id, u.position[0], u.position[2], dt);
      this.v.set(u.position[0], y + nhun * 0.035 * DAN, u.position[2]);
      this.q.setFromEuler(this.euler.set(0.06 * di + dap * 0.2, u.facing, sin * 0.05 * di, 'YXZ'));
      this.s.set(DAN, DAN, DAN);
      this.m.compose(this.v, this.q, this.s);
      this.bodies.setMatrixAt(vi, this.m);

      const vai = this.roleOf(u);
      this.color.setHex(vai === 'scout' ? PALETTE.water : vai ? RESOURCES[vai].color : PALETTE.villager);
      this.bodies.setColorAt(vi, this.color);

      // Hai chân ngược pha, khớp ở hông.
      for (let j = 0; j < 2; j += 1) {
        const [hx, hy, hz, lech] = RIG.hips[j];
        this.mRot.makeRotationX(Math.sin(nhip + lech) * RIG.amp * di);
        this.mPart.makeTranslation(hx, hy, hz).multiply(this.mRot);
        this.legs.setMatrixAt(vi * 2 + j, this.mTmp.multiplyMatrices(this.m, this.mPart));
      }
      // Hai tay: vung ngược chân khi đi, ôm hàng trước ngực khi mang, bổ cuốc khi hái.
      const traiGoc = mang ? -0.95 : u.state === 'gathering' ? -0.75 + 0.45 * dap : -sin * 0.45 * di;
      const phaiGoc = mang ? -0.95 : u.state === 'gathering' ? -2.5 + 2.0 * dap
        : vai && vai !== 'scout' ? -0.35 + sin * 0.25 * di : sin * 0.45 * di;
      for (let j = 0; j < 2; j += 1) {
        const [sx, sy, sz] = DAN_VAI[j];
        this.mRot.makeRotationX(j === 0 ? traiGoc : phaiGoc);
        this.mPart.makeTranslation(sx, sy, sz).multiply(this.mRot);
        this.mChi.multiplyMatrices(this.m, this.mPart);
        this.arms.setMatrixAt(vi * 2 + j, this.mChi);
        this.arms.setColorAt(vi * 2 + j, this.color);
        // Dụng cụ nằm trong bàn tay phải: lúc hái thì lưỡi chĩa ra trước để bổ xuống; lúc đi
        // thì dựng cán dọc theo cánh tay, lưỡi lên trên — chĩa ngang thì trông như cầm súng.
        if (j === 1 && vai && vai !== 'scout' && !mang) {
          this.mPart.makeTranslation(DAN_TAY[0], DAN_TAY[1], DAN_TAY[2])
            .multiply(this.mRot.makeRotationX(u.state === 'gathering' ? Math.PI / 2 - 0.25 : 0.35));
          this.tools.setMatrixAt(ti, this.mTmp.multiplyMatrices(this.mChi, this.mPart));
          ti += 1;
        }
      }

      if (mang) {
        // Bó hàng ôm trước ngực, theo đúng thân người (nghiêng, nhún cùng).
        this.mPart.makeTranslation(0, 0.78, 0.27);
        this.mRot.makeScale(0.85, 0.75, 0.75);
        this.mPart.multiply(this.mRot);
        this.cargo.setMatrixAt(vi, this.mTmp.multiplyMatrices(this.m, this.mPart));
        this.cargo.setColorAt(vi, this.color.setHex(RESOURCES[u.carryingKind!].color));
      } else {
        this.cargo.setMatrixAt(vi, this.hidden);
      }
      vi += 1;
    }

    /*
     * Vẽ ĐÚNG số đang có. Bản trước để nguyên count = 220 và thu nhỏ phần thừa về 0, nên ván
     * mới một người dân vẫn chạy đỉnh cho 220 thân, 220 kiện hàng — đo được 160 nghìn tam
     * giác mỗi khung cho đúng một người.
     */
    this.bodies.count = vi;
    this.legs.count = vi * 2;
    this.arms.count = vi * 2;
    this.cargo.count = vi;
    this.carts.count = ci;
    this.wheels.count = ci * 4;
    this.tools.count = ti;
    // Xe giao xong thì biến mất; dọn cao độ, việc và bánh xe của chúng khỏi bảng.
    if (this.yVe.size > units.length + 32) {
      const con = new Set(units.map((u) => u.id));
      for (const id of this.yVe.keys()) if (!con.has(id)) this.yVe.delete(id);
      for (const id of this.roles.keys()) if (!con.has(id)) this.roles.delete(id);
      for (const id of this.wheelTurn.keys()) if (!con.has(id)) this.wheelTurn.delete(id);
      for (const id of this.buocDan.keys()) if (!con.has(id)) this.buocDan.delete(id);
    }

    this.bodies.instanceMatrix.needsUpdate = true;
    this.legs.instanceMatrix.needsUpdate = true;
    this.arms.instanceMatrix.needsUpdate = true;
    if (this.arms.instanceColor) this.arms.instanceColor.needsUpdate = true;
    this.cargo.instanceMatrix.needsUpdate = true;
    this.carts.instanceMatrix.needsUpdate = true;
    this.tools.instanceMatrix.needsUpdate = true;
    this.wheels.instanceMatrix.needsUpdate = true;
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
    if (this.cargo.instanceColor) this.cargo.instanceColor.needsUpdate = true;
    if (this.carts.instanceColor) this.carts.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.bodies, this.cargo, this.carts, this.tools, this.wheels]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
}
