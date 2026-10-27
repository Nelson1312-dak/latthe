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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  CART_CAPACITY_MULT, CART_INTERVAL_SECONDS, GATHER_SECONDS, OUTPOST_RANGE, PALETTE, RESOURCES,
  SCOUT_MIN_VILLAGERS,
} from './config';
import type { Economy } from './Economy';
import type { FogOfWar } from './FogOfWar';
import type { MapManager } from './MapManager';
import type { Building, ResourceKind, Unit, Vec3 } from './types';
import { RESOURCE_KINDS } from './types';

const ARRIVE = 0.35;
const MAX_UNITS = 220;

export class WorkerManager {
  private readonly economy: Economy;
  private readonly map: MapManager;
  private readonly fog: FogOfWar;
  readonly group = new THREE.Group();

  private readonly bodies: THREE.InstancedMesh;
  private readonly cargo: THREE.InstancedMesh;
  private readonly carts: THREE.InstancedMesh;
  private elapsed = 0;

  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 1, 0);
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly color = new THREE.Color();

  constructor(economy: Economy, map: MapManager, fog: FogOfWar) {
    this.economy = economy;
    this.map = map;
    this.fog = fog;

    this.bodies = new THREE.InstancedMesh(
      this.villagerGeometry(),
      new THREE.MeshLambertMaterial({ flatShading: true }), MAX_UNITS);
    this.cargo = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.38, 0.38, 0.3),
      new THREE.MeshLambertMaterial(), MAX_UNITS);
    this.carts = new THREE.InstancedMesh(
      this.cartGeometry(),
      new THREE.MeshLambertMaterial({ flatShading: true }), 24);

    for (const mesh of [this.bodies, this.cargo, this.carts]) {
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

  /** Thân, đầu, nón rơm — hàn thành một hình học để một dân làng là một thực thể. */
  private villagerGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const body = new THREE.CylinderGeometry(0.26, 0.3, 0.5, 7);
    body.translate(0, 0.25, 0);
    parts.push(body);
    const head = new THREE.SphereGeometry(0.27, 8, 6);
    head.translate(0, 0.65, 0);
    parts.push(head);
    const brim = new THREE.CylinderGeometry(0.42, 0.42, 0.05, 8);
    brim.translate(0, 0.83, 0);
    parts.push(brim);
    const cone = new THREE.ConeGeometry(0.33, 0.26, 8);
    cone.translate(0, 0.96, 0);
    parts.push(cone);
    return mergeGeometries(parts, false) ?? body;
  }

  private cartGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const bed = new THREE.BoxGeometry(1.0, 0.36, 0.72);
    bed.translate(0, 0.46, 0);
    parts.push(bed);
    for (const dx of [-0.32, 0.32]) {
      for (const dz of [-0.42, 0.42]) {
        const wheel = new THREE.CylinderGeometry(0.26, 0.26, 0.1, 8);
        wheel.rotateX(Math.PI / 2);
        wheel.translate(dx, 0.26, dz);
        parts.push(wheel);
      }
    }
    const ox = new THREE.BoxGeometry(0.5, 0.4, 0.38);
    ox.translate(0.82, 0.4, 0);
    parts.push(ox);
    return mergeGeometries(parts, false) ?? bed;
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
    return this.economy.capacity() * CART_CAPACITY_MULT * o.level;
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

  update(dt: number): void {
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
    this.draw();
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
          const node = u.targetId ? this.map.nodeById(u.targetId) : undefined;
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
    const villagers = this.economy.villagers();
    const scoutIndex = villagers.length >= SCOUT_MIN_VILLAGERS ? villagers.length - 1 : -1;
    if (villagers.indexOf(u) === scoutIndex) {
      const spot = this.scoutTarget(u.position);
      if (spot) {
        u.targetId = 'scout';
        u.targetPos = spot;
        u.state = 'moving';
        return;
      }
    }

    const kind = this.pickKind(u);
    if (!kind) return;
    const pinned = this.economy.state.focusNodeId
      ? this.map.nodeById(this.economy.state.focusNodeId) : undefined;
    const node = (pinned && pinned.kind === kind
      && this.fog.isRevealed(pinned.position[0], pinned.position[2]))
      ? pinned : this.nearestNode(u.position, kind);
    if (!node) return;
    u.targetId = node.id;
    u.targetPos = node.position;
    u.state = 'moving';
  }

  /**
   * Dân tự nghĩ, theo đúng ba mức ưu tiên.
   *
   * 1. ĐƠN HÀNG XÂY DỰNG. Người chơi bấm xây mà thiếu vật liệu thì cả làng quay sang gom đúng
   *    thứ còn thiếu. Đây là chỗ thay cho mấy nút +/- cũ: người chơi nói muốn GÌ, không phải
   *    điều ai đi ĐÂU.
   * 2. MỎ ĐƯỢC GHIM. Bảy phần mười nhân lực dồn về đó; phần còn lại vẫn tự cân, nếu không
   *    thì ghim một mỏ là mọi kho khác cạn dần mà người chơi không hiểu vì sao.
   * 3. TỰ CÂN. Kho nào vơi nhất theo tỉ lệ thì đi lấy loại đó. Kho đầy thì bỏ qua hẳn — đào
   *    thêm vào một kho đầy là ném đi công sức, vì phần thừa không vào được.
   */
  private pickKind(u: Unit): ResourceKind | null {
    const open = RESOURCE_KINDS.filter((k) =>
      !this.economy.isFull(k) && this.map.nodes.some((n) =>
        n.kind === k && this.fog.isRevealed(n.position[0], n.position[2])));
    if (open.length === 0) return null;

    const need = this.economy.demandKinds().filter((k) => open.includes(k));
    if (need.length > 0) {
      // Chia đều giữa những thứ còn thiếu, theo thứ tự người, nên không ai giẫm chân ai.
      const i = Math.max(0, this.economy.villagers().indexOf(u));
      return need[i % need.length];
    }

    const pinned = this.economy.state.focusNodeId
      ? this.map.nodeById(this.economy.state.focusNodeId) : undefined;
    if (pinned && open.includes(pinned.kind)) {
      const list = this.economy.villagers();
      const i = Math.max(0, list.indexOf(u));
      if (i < Math.ceil(list.length * 0.7)) return pinned.kind;
    }

    return open.reduce((min, k) =>
      this.economy.fillRatio(k) < this.economy.fillRatio(min) ? k : min);
  }

  private nearestNode(from: Vec3, kind: ResourceKind) {
    let best = null;
    let bestScore = Infinity;
    for (const n of this.map.nodes) {
      if (n.kind !== kind) continue;
      if (!this.fog.isRevealed(n.position[0], n.position[2])) continue;
      const toNode = Math.hypot(n.position[0] - from[0], n.position[2] - from[2]);
      const drop = this.dropPoint(n.position);
      const back = Math.hypot(drop.position[0] - n.position[0], drop.position[2] - n.position[2]);
      const score = toNode + back * 2;   // chang ve lap lai moi chuyen nen nang gap doi
      if (score < bestScore) { bestScore = score; best = n; }
    }
    return best;
  }

  /** Ô chưa vén gần nhất — màn mây tự biết ô nào đang có mây thật trong cảnh. */
  private scoutTarget(from: Vec3): Vec3 | null {
    return this.fog.nearestUnrevealed(from);
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

  private draw(): void {
    const units = this.economy.state.units;
    let vi = 0;
    let ci = 0;

    for (const u of units) {
      if (u.kind === 'cart') {
        if (ci < this.carts.count) {
          this.v.set(u.position[0], 0, u.position[2]);
          this.q.setFromAxisAngle(this.axis, u.facing + Math.PI / 2);
          this.s.set(1, 1, 1);
          this.carts.setMatrixAt(ci, this.m.compose(this.v, this.q, this.s));
          this.carts.setColorAt(ci, this.color.setHex(
            u.carryingKind ? RESOURCES[u.carryingKind].color : 0xa9763f));
          ci += 1;
        }
        continue;
      }
      if (vi >= MAX_UNITS) break;

      // Nhịp đi nướng thẳng vào ma trận: lệch pha theo chỉ số nên cả đoàn không bước răm rắp.
      const walking = u.state === 'moving' || u.state === 'delivering';
      const phase = this.elapsed * 12 + vi * 1.7;
      const lift = walking ? Math.abs(Math.sin(phase)) * 0.1 : 0;
      const tilt = walking ? Math.sin(phase) * 0.15 : 0;
      const chop = u.state === 'gathering' ? Math.max(0, Math.sin(this.elapsed * 7)) * 0.5 : 0;

      this.v.set(u.position[0], lift, u.position[2]);
      this.q.setFromEuler(new THREE.Euler(chop, u.facing, tilt, 'YXZ'));
      this.s.set(1, 1, 1);
      this.bodies.setMatrixAt(vi, this.m.compose(this.v, this.q, this.s));

      if (u.carrying > 0 && u.carryingKind) {
        this.v.set(
          u.position[0] - Math.sin(u.facing) * 0.33,
          0.52 + lift,
          u.position[2] - Math.cos(u.facing) * 0.33);
        this.cargo.setMatrixAt(vi, this.m.compose(this.v, this.q, this.s));
        this.cargo.setColorAt(vi, this.color.setHex(RESOURCES[u.carryingKind].color));
      } else {
        this.cargo.setMatrixAt(vi, this.hidden);
      }
      this.bodies.setColorAt(vi, this.color.setHex(PALETTE.villager));
      vi += 1;
    }

    for (let i = vi; i < MAX_UNITS; i += 1) {
      this.bodies.setMatrixAt(i, this.hidden);
      this.cargo.setMatrixAt(i, this.hidden);
    }
    for (let i = ci; i < this.carts.count; i += 1) this.carts.setMatrixAt(i, this.hidden);

    this.bodies.instanceMatrix.needsUpdate = true;
    this.cargo.instanceMatrix.needsUpdate = true;
    this.carts.instanceMatrix.needsUpdate = true;
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
    if (this.cargo.instanceColor) this.cargo.instanceColor.needsUpdate = true;
    if (this.carts.instanceColor) this.carts.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.bodies, this.cargo, this.carts]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
}
