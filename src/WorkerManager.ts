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
import {
  CART_CAPACITY_MULT, CART_INTERVAL_SECONDS, GATHER_SECONDS, OUTPOST_RANGE, PALETTE, RESOURCES,
  SCOUT_MIN_VILLAGERS, SCOUT_RANGE_BASE, SCOUT_RANGE_PER_VILLAGER,
} from './config';
import type { Economy } from './Economy';
import type { FogOfWar } from './FogOfWar';
import type { MapManager } from './MapManager';
import type { Building, Patch, ResourceKind, Unit, Vec3 } from './types';
import { RESOURCE_KINDS } from './types';

const ARRIVE = 0.35;
/** Duoi ngan nay don thi chua bo mot chuyen cho hang. */
const CARRY_WORTH_IT = 0.5;
const MAX_UNITS = 220;
/** Sức chứa của lưới xe thồ. */
const CART_CAP = 24;
/** Bán kính bánh xe, và bốn chỗ trục bánh (x dọc thân xe, z ngang). */
const WHEEL_R = 0.26;
const WHEELS: readonly (readonly [number, number])[] = [[-0.32, -0.42], [-0.32, 0.42], [0.32, -0.42], [0.32, 0.42]];
/** Tay phải của dân làng. Mặt hướng +Z cục bộ, nên bên phải là −X. */
const HAND: Vec3 = [-0.27, 0.3, 0.05];

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
    this.bodies = new THREE.InstancedMesh(this.villagerGeometry(), nguoi, MAX_UNITS);
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

    for (const mesh of [this.bodies, this.cargo, this.carts, this.tools, this.wheels]) {
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    const seed = () => {
      if (this.economy.state.units.length === 0) {
        this.spawnVillager(this.economy.state.buildings[0]);
      }
    };
    seed();
    this.economy.onReset = seed;
  }

  // ----------------------------------------------------------- hình học

  /**
   * Dân làng kiểu CHIBI: đầu to gần bằng thân, mắt chấm, hai bàn tay, nón lá rộng vành.
   *
   * Bản trước một màu kem từ nón tới chân — nhìn xa là một hạt gạo, gần cũng chẳng ra người.
   * Giờ áo mang màu của việc đang làm (gỗ, lúa, đá, vàng, pha lê — đúng màu trên thanh tài
   * nguyên), nên liếc bãi nào cũng đọc được ai đang làm gì mà không cần bấm vào.
   */
  private villagerGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, hex: number | null): void => {
      g.translate(x, y, z);
      parts.push(paint(g, hex));
    };
    add(new THREE.CylinderGeometry(0.2, 0.27, 0.44, 8), 0, 0.22, 0, null);
    add(new THREE.SphereGeometry(0.31, 12, 9), 0, 0.72, 0, PALETTE.skin);
    for (const x of [-0.11, 0.11]) add(new THREE.BoxGeometry(0.055, 0.075, 0.04), x, 0.74, 0.29, PALETTE.eye);
    for (const x of [-0.27, 0.27]) add(new THREE.SphereGeometry(0.075, 6, 5), x, 0.3, 0.05, PALETTE.skin);
    add(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 12), 0, 0.96, 0, PALETTE.hat);
    add(new THREE.ConeGeometry(0.3, 0.26, 12), 0, 1.1, 0, PALETTE.hat);
    return han(parts);
  }

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
    if (u.targetId === 'scout') return 'scout';
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
      this.villager(u, dt);
    }
    if (ve) this.draw(dt);
  }

  private villager(u: Unit, dt: number): void {
    switch (u.state) {
      case 'idle':
        this.dispatch(u);
        break;
      case 'moving':
        if (this.step(u, dt)) {
          if (u.targetId === 'scout') { u.state = 'idle'; u.targetId = null; break; }
          u.state = 'gathering';
          u.gatherTimer = GATHER_SECONDS;
        }
        break;
      case 'gathering':
        u.gatherTimer -= dt;
        if (u.gatherTimer <= 0) {
          const node = u.targetId ? this.map.patchById(u.targetId) : undefined;
          u.carrying = Math.max(1, Math.round(u.capacity * (node?.richness ?? 1)));
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
    const shop = this.neediestProcessor(u);
    if (shop) {
      u.targetId = shop.id;
      u.targetPos = [shop.position[0], 0, shop.position[2]];
      u.state = 'moving';
      return;
    }

    const villagers = this.economy.villagers();
    const scoutIndex = villagers.length >= SCOUT_MIN_VILLAGERS ? villagers.length - 1 : -1;
    // Hạn ngạch là mệnh lệnh trực tiếp của người chơi, nên nó đứng TRÊN việc đi thám hiểm:
    // giao ba người cho một bãi mà máy vẫn rút một người đi vén mây thì người chơi chỉ thấy
    // lệnh của mình bị phớt lờ.
    if (villagers.indexOf(u) === scoutIndex && !this.quotaUnmet()) {
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

  /**
   * Xưởng nào đang cần người chở hàng nhất. Ưu tiên đống to nhất, vì đống đầy là trạm đó
   * dừng hẳn — tốn hơn nhiều so với việc chở chậm một chuyến.
   */
  private neediestProcessor(worker: Unit): Building | null {
    const busy = new Set(
      this.economy.state.units
        .filter((u) => u !== worker && u.kind === 'villager' && u.targetId)
        .map((u) => u.targetId as string));

    let best: Building | null = null;
    for (const o of this.economy.outposts()) {
      const total = RESOURCE_KINDS.reduce((s, k) => s + (o.stock[k] ?? 0), 0);
      if (total < CARRY_WORTH_IT) continue;
      if (busy.has(o.id) && total < worker.capacity * 2) continue;
      if (!best) { best = o; continue; }
      const bestTotal = RESOURCE_KINDS.reduce((s, k) => s + (best!.stock[k] ?? 0), 0);
      if (total > bestTotal) best = o;
    }
    return best;
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
    const dat = this.map.groundY(x, z);
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
        this.s.set(1, 1, 1);
        this.m.compose(this.v, this.q, this.s);
        this.carts.setMatrixAt(ci, this.m);
        this.carts.setColorAt(ci, this.color.setHex(
          u.carryingKind ? RESOURCES[u.carryingKind].color : PALETTE.sand));
        // Bánh lăn ĐÚNG quãng xe đã đi: góc = quãng đường / bán kính. Xe đứng thì bánh đứng.
        const w = this.wheelTurn.get(u.id);
        if (w) {
          w.goc += Math.hypot(u.position[0] - w.x, u.position[2] - w.z) / WHEEL_R;
          w.x = u.position[0];
          w.z = u.position[2];
        } else {
          this.wheelTurn.set(u.id, { x: u.position[0], z: u.position[2], goc: 0 });
        }
        this.mRot.makeRotationZ(-(w?.goc ?? 0));
        for (let k = 0; k < 4; k += 1) {
          this.mPart.makeTranslation(WHEELS[k][0], WHEEL_R, WHEELS[k][1]).multiply(this.mRot);
          this.wheels.setMatrixAt(ci * 4 + k, this.mTmp.multiplyMatrices(this.m, this.mPart));
        }
        ci += 1;
        continue;
      }
      if (vi >= MAX_UNITS) break;

      // Nhịp đi nướng thẳng vào ma trận: lệch pha theo chỉ số nên cả đoàn không bước răm rắp.
      const walking = u.state === 'moving' || u.state === 'delivering';
      const phase = this.elapsed * 12 + vi * 1.7;
      const nhun = Math.abs(Math.sin(phase));
      const lift = walking ? nhun * 0.1 : 0;
      const tilt = walking ? Math.sin(phase) * 0.15 : 0;
      const dap = u.state === 'gathering' ? Math.max(0, Math.sin(this.elapsed * 7 + vi * 0.9)) : 0;
      const chop = dap * 0.5;

      const y = this.yOf(u.id, u.position[0], u.position[2], dt);
      this.v.set(u.position[0], y + lift, u.position[2]);
      this.q.setFromEuler(this.euler.set(chop, u.facing, tilt, 'YXZ'));
      // Nhún kiểu hoạt hình: chạm đất thì bè ra, bật lên thì thon lại.
      const co = walking ? (nhun - 0.5) * 0.08 : 0;
      this.s.set(1 - co * 0.6, 1 + co, 1 - co * 0.6);
      this.m.compose(this.v, this.q, this.s);
      this.bodies.setMatrixAt(vi, this.m);

      const vai = this.roleOf(u);
      this.bodies.setColorAt(vi, this.color.setHex(
        vai === 'scout' ? PALETTE.water : vai ? RESOURCES[vai].color : PALETTE.villager));

      // Dụng cụ ở tay phải: vác ngả ra sau khi đi, giơ lên rồi bổ xuống theo nhịp khi đào.
      if (vai && vai !== 'scout') {
        const vung = u.state === 'gathering' ? -1.1 + 2.3 * dap : walking ? -0.75 : -0.35;
        this.mPart.makeTranslation(HAND[0], HAND[1], HAND[2]);
        this.mPart.multiply(this.mRot.makeRotationZ(0.15));
        this.mPart.multiply(this.mRot.makeRotationX(vung));
        this.tools.setMatrixAt(ti, this.mTmp.multiplyMatrices(this.m, this.mPart));
        ti += 1;
      }

      if (u.carrying > 0 && u.carryingKind) {
        this.v.set(
          u.position[0] - Math.sin(u.facing) * 0.33,
          y + 0.5 + lift,
          u.position[2] - Math.cos(u.facing) * 0.33);
        this.s.set(1, 1, 1);
        this.cargo.setMatrixAt(vi, this.m.compose(this.v, this.q, this.s));
        this.cargo.setColorAt(vi, this.color.setHex(RESOURCES[u.carryingKind].color));
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
    }

    this.bodies.instanceMatrix.needsUpdate = true;
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
