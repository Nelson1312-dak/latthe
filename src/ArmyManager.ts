/**
 * Vẽ trận đánh. KHÔNG quyết định gì cả — nó diễn lại.
 *
 * Trận đã được `resolveBattle()` chạy xong và áp hậu quả từ trước, trong đúng một lời gọi.
 * Lớp này chạy lại CÙNG hàm `battleStep()` từ CÙNG hạt giống, chỉ để có hình. Vì thế không
 * có đường nào để hình và kết quả lệch nhau, và tắt máy giữa chừng thì chỉ mất phần hoạt
 * hình chứ không mất một món hàng nào.
 *
 * Đồng hồ của bản diễn là SỐ BƯỚC NGUYÊN. Bộ tích `acc` chỉ quyết định khi nào bước tiếp,
 * không bao giờ là đầu vào của luật — khung hình rớt thì bản diễn chạy chậm lại theo đồng
 * hồ treo tường chứ không nhảy cóc.
 *
 * Mọi thân người vẽ bằng InstancedMesh như WorkerManager: một đợt ba sáu tên mà mỗi tên
 * một lệnh vẽ thì bằng cả làng cộng lại.
 */
import * as THREE from 'three';
import { MAX_TICKS, TICK, battleStart, battleStep } from './battle';
import type { BattleSeed, BattleState } from './battle';
import type { TroopKind } from './types';
import { TROOP_KINDS, noTroops } from './types';
import { PALETTE } from './config';
import type { MapManager } from './MapManager';
import { matte, tinted } from './materials';
import { HORDES, bossScale } from './beasthorde';
import { beastRig, fighterRig } from './rigs';
import type { Rig } from './rigs';

/** Trần số thân vẽ được. Giặc tối đa 36, lính thuê hiếm khi quá vài chục. */
const CAP = 96;
/** Trần số vệt tên đang bay. */
const SHOT_CAP = 64;
/** Một vệt tên sống bấy nhiêu giây — đủ để mắt bắt được hướng bắn, không đủ để rối màn. */
const SHOT_LIFE = 0.25;
/** Cùng hệ số phóng với dân làng, nếu không thì giặc và dân khác cỡ nhau. */
const NGUOI = 1.35;
/** Diễn xong thì nán lại chừng này giây rồi mới dọn, cho người chơi kịp nhìn bãi chiến. */
const LINGER = 1.6;

const MAU_GIAC = 0x8c4a4a;
const MAU_LINH = 0x5f7f9c;

interface Vet { x0: number; z0: number; x1: number; z1: number; t: number }

/**
 * Trạng thái BƯỚC ĐI của một người trên bãi — thuần để vẽ, không bao giờ quay lại luật.
 * `px, pz` là chỗ đứng ở bước trận TRƯỚC (để nội suy), `pha` là nhịp bước, tăng theo quãng
 * đường đã đi chứ không theo đồng hồ: đi nhanh thì bước nhanh, đứng lại là chân thôi đưa.
 */
interface Buoc { px: number; pz: number; lx: number; lz: number; pha: number; di: number }

/** Một lưới chân dùng chung cho mọi chân cùng hình, và số đã đặt trong khung này. */
interface Chan { mesh: THREE.InstancedMesh; n: number }

/** Người ít nhất phải nhích ngần này mỗi khung mới tính là đang đi. */
const DANG_DI = 0.004;


export class ArmyManager {
  readonly group = new THREE.Group();
  private readonly map: MapManager;

  private readonly bodies: Record<TroopKind, THREE.InstancedMesh>;
  private readonly shots: THREE.InstancedMesh;
  /** Bầy quái: đám nhỏ và con trùm. Hình đổi theo bầy mỗi lần play(). */
  private readonly beastMinion: THREE.InstancedMesh;
  private readonly beastBoss: THREE.InstancedMesh;
  /** Đồng hồ diễn, chỉ để cho quái nhún bước — không bao giờ là đầu vào của luật. */
  private t = 0;
  /** Kho lưới chân: mỗi hình chân một InstancedMesh, dựng khi cần lần đầu. */
  private readonly chans = new Map<THREE.BufferGeometry, Chan>();
  private readonly chanMat: THREE.MeshStandardMaterial;
  /** Bộ xương của bầy quái đang diễn. */
  private rigNho: Rig = beastRig(0, false);
  private rigTrum: Rig = beastRig(0, true);
  private readonly mChan = new THREE.Matrix4();
  private readonly mXoay = new THREE.Matrix4();
  private buoc = new WeakMap<object, Buoc>();
  private readonly qx = new THREE.Quaternion();
  private readonly qz = new THREE.Quaternion();
  private readonly ox = new THREE.Vector3(1, 0, 0);
  private readonly oz = new THREE.Vector3(0, 0, 1);

  private s: BattleState | null = null;
  private acc = 0;
  private xong = 0;
  private readonly vet: Vet[] = [];

  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 1, 0);
  private readonly color = new THREE.Color();

  /** Gọi khi bản diễn kết thúc, để camera trả về chỗ cũ. */
  onDone: (() => void) | null = null;

  constructor(map: MapManager) {
    this.map = map;
    const than = tinted(matte());
    than.vertexColors = true;
    // Dựng theo danh sách chứ không gõ tay từng loại: thêm loại lính thứ sáu thì chỉ còn
    // việc vẽ dáng của nó.
    const bodies = {} as Record<TroopKind, THREE.InstancedMesh>;
    for (const k of TROOP_KINDS) {
      bodies[k] = new THREE.InstancedMesh(fighterRig(k).body, than, CAP);
    }
    this.bodies = bodies;
    this.shots = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.09, 0.09, 1), matte(PALETTE.wheat, true), SHOT_CAP);
    this.chanMat = matte();
    this.chanMat.vertexColors = true;
    this.beastMinion = new THREE.InstancedMesh(this.rigNho.body, than, CAP);
    this.beastBoss = new THREE.InstancedMesh(this.rigTrum.body, than, 2);
    for (const mesh of [...TROOP_KINDS.map((k) => this.bodies[k]), this.shots,
      this.beastMinion, this.beastBoss]) {
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
  }

  /** Lưới chân cho một hình chân — dựng lần đầu cần tới, rồi dùng mãi. */
  private chanCua(geo: THREE.BufferGeometry): Chan {
    let c = this.chans.get(geo);
    if (!c) {
      const mesh = new THREE.InstancedMesh(geo, this.chanMat, CAP * 4);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      c = { mesh, n: 0 };
      this.chans.set(geo, c);
    }
    return c;
  }

  /**
   * Đặt chân của một thân vừa vẽ (ma trận `this.m`). Mỗi chân xoay quanh khớp hông theo
   * nhịp bước của chính người ấy; đứng yên thì `di` về 0 và chân khép thẳng.
   */
  private datChan(rig: Rig, nhip: number, di: number): void {
    if (!rig.leg || rig.hips.length === 0) return;
    const c = this.chanCua(rig.leg);
    for (const [x, y, z, lech] of rig.hips) {
      if (c.n >= CAP * 4) return;
      this.mXoay.makeRotationX(Math.sin(nhip + lech) * rig.amp * di);
      this.mChan.makeTranslation(x, y, z).multiply(this.mXoay);
      c.mesh.setMatrixAt(c.n, this.mXoay.multiplyMatrices(this.m, this.mChan));
      c.n += 1;
    }
  }

  // ------------------------------------------------------------------ điều khiển

  /** Bắt đầu diễn lại một trận. Gọi lại khi đang diễn thì bỏ trận cũ, lấy trận mới. */
  play(seed: BattleSeed): void {
    if (seed.horde !== undefined) {
      this.rigNho = beastRig(seed.horde, false);
      this.rigTrum = beastRig(seed.horde, true);
      this.beastMinion.geometry = this.rigNho.body;
      this.beastBoss.geometry = this.rigTrum.body;
    }
    this.s = battleStart(seed);
    this.buoc = new WeakMap();
    this.acc = 0;
    this.xong = 0;
    this.vet.length = 0;
  }

  get playing(): boolean { return this.s !== null; }

  /** Số bước còn lại, để HUD biết trận còn dài bao lâu. */
  get leftSeconds(): number {
    return this.s ? Math.max(0, (MAX_TICKS - this.s.tick) * TICK) : 0;
  }

  stop(): void {
    this.s = null;
    for (const k of TROOP_KINDS) this.bodies[k].count = 0;
    this.beastMinion.count = 0;
    this.beastBoss.count = 0;
    for (const c of this.chans.values()) c.mesh.count = 0;
    this.shots.count = 0;
    this.vet.length = 0;
  }

  /** Ghi chỗ đứng hiện tại làm "bước trước" cho mọi người — gọi ngay trước mỗi battleStep. */
  private ghiTruoc(s: BattleState): void {
    for (const f of [...s.raiders, ...s.guards] as { x: number; z: number }[]) {
      const b = this.buoc.get(f);
      if (b) { b.px = f.x; b.pz = f.z; } else {
        this.buoc.set(f, { px: f.x, pz: f.z, lx: f.x, lz: f.z, pha: (f.x * 1.7 + f.z * 2.3) % 6.3, di: 0 });
      }
    }
  }

  /**
   * Chỗ VẼ của một người: nội suy giữa bước trận trước và bước hiện tại theo phần dư của bộ
   * tích. Trận bước 0,1 giây một lần, nên vẽ thẳng toạ độ trận là mười cú nhảy mỗi giây —
   * nhìn ra giật cục. Nội suy chỉ chạm tới HÌNH, luật vẫn chạy đúng bước nguyên.
   */
  private choVe(f: { x: number; z: number }, a: number): Buoc {
    let b = this.buoc.get(f);
    if (!b) {
      b = { px: f.x, pz: f.z, lx: f.x, lz: f.z, pha: (f.x * 1.7 + f.z * 2.3) % 6.3, di: 0 };
      this.buoc.set(f, b);
    }
    const x = b.px + (f.x - b.px) * a;
    const z = b.pz + (f.z - b.pz) * a;
    const d = Math.hypot(x - b.lx, z - b.lz);
    // `pha` là QUÃNG ĐƯỜNG đã đi; bên vẽ chia cho sải bước của từng dáng (và cỡ) ra nhịp.
    b.pha += d;
    // Mức "đang đi" mềm dần chứ không bật tắt: dừng lại thì chân khép về trong vài khung.
    b.di += ((d > DANG_DI ? 1 : 0) - b.di) * 0.25;
    b.lx = x;
    b.lz = z;
    return b;
  }

  update(dt: number): void {
    const s = this.s;
    if (!s) return;
    this.t += dt;

    if (!s.done) {
      // Kẹp ở ĐẦU VÀO, không bao giờ xả bộ tích: tab bị bóp một giây thì bản diễn chạy
      // chậm lại, chứ không nhảy mất mười bước.
      this.acc += Math.min(dt, 0.5);
      let guard = 0;
      while (!s.done && this.acc >= TICK && guard < 40) {
        this.ghiTruoc(s);
        battleStep(s);
        for (const sh of s.shots) this.vet.push({ ...sh, t: 0 });
        this.acc -= TICK;
        guard += 1;
      }
    } else {
      this.xong += dt;
      if (this.xong > LINGER) { this.stop(); this.onDone?.(); return; }
    }

    for (let i = this.vet.length - 1; i >= 0; i -= 1) {
      this.vet[i].t += dt;
      if (this.vet[i].t > SHOT_LIFE) this.vet.splice(i, 1);
    }
    this.draw();
  }

  // ------------------------------------------------------------------ vẽ

  private draw(): void {
    const s = this.s;
    if (!s) return;
    const n = noTroops();
    const a = s.done ? 1 : Math.min(1, this.acc / TICK);
    for (const c of this.chans.values()) c.n = 0;

    const than = (f: { x: number; z: number; face: number; kind: TroopKind },
      hex: number, cui: number): void => {
      const i = n[f.kind];
      if (i >= CAP) return;
      const rig = fighterRig(f.kind);
      const b = this.choVe(f, a);
      const nhip = (b.pha / (rig.stride * NGUOI)) * Math.PI;
      const sin = Math.sin(nhip);
      const dung = f.kind !== 'horse' && f.kind !== 'siege';
      // Nhún mỗi bước một lần, lắc người sang chân trụ, hơi chúi khi đi. Ngựa nhấp nhô theo
      // nước kiệu (hai nhịp mỗi chu kỳ), xe pháo chỉ rung trên đường gồ ghề.
      const nhun = Math.abs(sin) * b.di;
      const y = this.map.groundY(b.lx, b.lz)
        + nhun * (f.kind === 'horse' ? 0.06 : f.kind === 'siege' ? 0.02 : 0.035) * NGUOI;
      this.v.set(b.lx, y, b.lz);
      this.q.setFromAxisAngle(this.axis, f.face);
      if (dung) {
        this.qz.setFromAxisAngle(this.oz, sin * 0.06 * b.di);
        this.qx.setFromAxisAngle(this.ox, 0.06 * b.di);
        this.q.multiply(this.qx).multiply(this.qz);
      } else if (f.kind === 'horse') {
        this.qx.setFromAxisAngle(this.ox, Math.sin(nhip * 2) * 0.035 * b.di);
        this.q.multiply(this.qx);
      }
      this.sc.set(NGUOI, NGUOI * cui, NGUOI);
      this.m.compose(this.v, this.q, this.sc);
      this.datChan(rig, nhip, b.di);
      this.bodies[f.kind].setMatrixAt(i, this.m);
      this.bodies[f.kind].setColorAt(i, this.color.setHex(hex));
      n[f.kind] = i + 1;
    };

    const bay = s.seed.horde !== undefined ? HORDES[s.seed.horde] : null;
    let nho = 0;
    let trum = 0;
    for (let i = 0; i < s.raiders.length; i += 1) {
      const r = s.raiders[i];
      if (bay && r.atk !== undefined) {
        // Quái: cỡ theo bầy (trùm to thêm theo sao), nhún theo bước chạy, cúi xuống khi vồ mồi.
        const co = r.boss ? bossScale(bay, s.seed.tier ?? 1) : bay.minionSize;
        const mesh = r.boss ? this.beastBoss : this.beastMinion;
        const k = r.boss ? trum : nho;
        if (k >= (r.boss ? 2 : CAP)) continue;
        // Bước của quái cũng theo quãng đường, và sải dài theo cỡ con vật: con trùm to bước
        // chậm mà nặng, đám nhỏ lon ton.
        const rig = r.boss ? this.rigTrum : this.rigNho;
        const b = this.choVe(r, a);
        const nhip = (b.pha / (rig.stride * NGUOI * co)) * Math.PI;
        // Nhện không có chân rời: bù bằng nhún nhanh và lắc mạnh hơn cho ra dáng bò lổm ngổm.
        const bo = rig.leg ? 1 : 1.8;
        const nhun = Math.abs(Math.sin(nhip * bo)) * b.di;
        this.v.set(b.lx, this.map.groundY(b.lx, b.lz) + nhun * 0.035 * co * NGUOI, b.lz);
        this.q.setFromAxisAngle(this.axis, r.face);
        this.qx.setFromAxisAngle(this.ox, Math.sin(nhip * 2) * 0.04 * b.di);
        this.qz.setFromAxisAngle(this.oz, Math.sin(nhip * bo) * 0.05 * bo * b.di);
        this.q.multiply(this.qx).multiply(this.qz);
        const cui = r.state === 'loot' ? 0.85 : 1;
        this.sc.set(NGUOI * co, NGUOI * co * cui, NGUOI * co);
        mesh.setMatrixAt(k, this.m.compose(this.v, this.q, this.sc));
        this.datChan(rig, nhip, b.di);
        mesh.setColorAt(k, this.color.setHex(0xffffff));
        if (r.boss) trum += 1; else nho += 1;
        continue;
      }
      // Tên đang khuân hàng thì khom lưng xuống — nhìn một cái là biết đứa nào đang vơ vét.
      than(r, s.seed.assault ? MAU_LINH : MAU_GIAC, r.state === 'loot' ? 0.82 : 1);
    }
    for (const [mesh, n0] of [[this.beastMinion, nho], [this.beastBoss, trum]] as const) {
      mesh.count = n0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    // Trận tấn công đảo vai: quân MÌNH là bên công (xanh), làng bị đánh giữ nhà (đỏ).
    for (const g of s.guards) than(g, s.seed.assault ? MAU_GIAC : MAU_LINH, 1);
    for (const c of this.chans.values()) {
      c.mesh.count = c.n;
      c.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const kind of TROOP_KINDS) {
      const mesh = this.bodies[kind];
      mesh.count = n[kind];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    let k = 0;
    for (const t of this.vet) {
      if (k >= SHOT_CAP) break;
      const dx = t.x1 - t.x0;
      const dz = t.z1 - t.z0;
      const d = Math.hypot(dx, dz);
      if (d < 0.01) continue;
      // Vệt rút ngắn dần về phía đích: đọc ra là một mũi tên đang bay tới, không phải một
      // sợi dây nối hai điểm.
      const u = Math.min(1, t.t / SHOT_LIFE);
      const mx = t.x0 + dx * (0.2 + 0.7 * u);
      const mz = t.z0 + dz * (0.2 + 0.7 * u);
      this.v.set(mx, this.map.groundY(mx, mz) + 1.5, mz);
      this.q.setFromAxisAngle(this.axis, Math.atan2(dx, dz));
      this.sc.set(1, 1, Math.max(0.6, d * 0.18));
      this.shots.setMatrixAt(k, this.m.compose(this.v, this.q, this.sc));
      k += 1;
    }
    this.shots.count = k;
    this.shots.instanceMatrix.needsUpdate = true;
  }
}
