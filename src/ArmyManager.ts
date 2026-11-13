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
import { han, paint } from './shapes';
import { HORDES, bossScale } from './beasthorde';
import { beastGeometry } from './beastModels';

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

/** Một bước chân dài chừng này đơn vị (một chu kỳ hai chân = 2π pha). */
const SAI_BUOC = 0.55;
/** Người ít nhất phải nhích ngần này mỗi khung mới tính là đang đi. */
const DANG_DI = 0.004;
/** Biên độ đưa chân: góc tối đa (radian). */
const DUA_CHAN = 0.8;

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
  /** Hai chân của mỗi người đứng thẳng (giáo, cung, pháp sư) — hai cái một người. */
  private readonly legs: THREE.InstancedMesh;
  private buoc = new WeakMap<object, Buoc>();
  private readonly qx = new THREE.Quaternion();
  private readonly qz = new THREE.Quaternion();
  private readonly ox = new THREE.Vector3(1, 0, 0);
  private readonly oz = new THREE.Vector3(0, 0, 1);
  private readonly hip = new THREE.Vector3();

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
      bodies[k] = new THREE.InstancedMesh(this.fighterGeometry(k), than, CAP);
    }
    this.bodies = bodies;
    this.shots = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.09, 0.09, 1), matte(PALETTE.wheat, true), SHOT_CAP);
    /*
     * CHÂN. Thân người lính là một cái áo choàng hình trụ chạm đất, nên đi tới đâu nó TRƯỢT
     * tới đó như quân cờ — người chơi chê đúng câu "đi lướt lướt". Giờ cả người nhấc lên một
     * chút và hai bàn chân thò ra dưới vạt áo, đưa trước đưa sau theo đúng quãng đường đi.
     * Khớp xoay ở hông: hình chân dời xuống để đỉnh nằm ở gốc toạ độ.
     */
    // Dài vừa khít từ hông xuống mặt đất (thân nhấc 0,1 + hông 0,04, cùng nhân NGUOI), nên
    // chân đứng thẳng thì chạm đất, đưa ra thì bàn chân nhấc lên — không lún, không lơ lửng.
    const chan = new THREE.BoxGeometry(0.12, 0.14, 0.17);
    chan.translate(0, -0.07, 0.02);
    this.legs = new THREE.InstancedMesh(chan, matte(0x2e2420), CAP * 4);
    this.beastMinion = new THREE.InstancedMesh(beastGeometry(0, false), than, CAP);
    this.beastBoss = new THREE.InstancedMesh(beastGeometry(0, true), than, 2);
    for (const mesh of [...TROOP_KINDS.map((k) => this.bodies[k]), this.shots,
      this.beastMinion, this.beastBoss, this.legs]) {
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
  }

  /**
   * NĂM DÁNG, một cho mỗi loại lính (ba dáng người đầu có từ bản thời đại).
   *
   * Luật khắc chế chỉ có nghĩa khi nhìn vào là biết đang đánh nhau với cái gì. Ở mức phóng
   * này người chơi đọc BÓNG DÁNG chứ không đọc chi tiết, nên ba dáng phải khác nhau ở
   * đường viền ngoài: giáo chĩa thẳng lên, cung là một cánh cung cong trước mặt, kỵ binh
   * thì thấp và dài vì có con ngựa.
   */
  private thanNguoi(parts: THREE.BufferGeometry[],
    add: (g: THREE.BufferGeometry, x: number, y: number, z: number, hex: number | null) => void,
    cao: number): void {
    add(new THREE.CylinderGeometry(0.21, 0.28, 0.46 * cao, 8), 0, 0.23 * cao, 0, null);
    add(new THREE.SphereGeometry(0.3, 12, 9), 0, 0.73 * cao, 0, PALETTE.skin);
    for (const x of [-0.11, 0.11]) {
      add(new THREE.BoxGeometry(0.055, 0.075, 0.04), x, 0.75 * cao, 0.28, PALETTE.eye);
    }
    for (const x of [-0.27, 0.27]) {
      add(new THREE.SphereGeometry(0.075, 6, 5), x, 0.31 * cao, 0.05, PALETTE.skin);
    }
    add(new THREE.ConeGeometry(0.3, 0.34, 10), 0, 0.98 * cao, 0, PALETTE.granite);
    void parts;
  }

  private fighterGeometry(kind: TroopKind): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, hex: number | null): void => {
      g.translate(x, y, z);
      parts.push(paint(g, hex));
    };
    if (kind === 'horse') {
      // Con ngựa: thân dài, bốn chân, cổ chếch. Người ngồi cao hơn hẳn hai loại kia.
      add(new THREE.BoxGeometry(0.46, 0.5, 1.25), 0, 0.72, 0, PALETTE.trunk);
      for (const [x, z] of [[-0.17, 0.44], [0.17, 0.44], [-0.17, -0.44], [0.17, -0.44]] as const) {
        add(new THREE.CylinderGeometry(0.075, 0.06, 0.66, 5), x, 0.33, z, PALETTE.trunk);
      }
      const co = new THREE.BoxGeometry(0.26, 0.6, 0.26);
      co.rotateX(-0.5);
      add(co, 0, 1.05, 0.52, PALETTE.trunk);
      add(new THREE.BoxGeometry(0.24, 0.22, 0.4), 0, 1.3, 0.76, PALETTE.trunk);
      this.thanNguoi(parts, add, 0.88);
      // Người ngồi trên lưng: nhấc cả cụm vừa thêm lên cao.
      for (let i = parts.length - 6; i < parts.length; i += 1) parts[i].translate(0, 1.0, 0);
      const guom = new THREE.CylinderGeometry(0.035, 0.035, 0.95, 5);
      guom.rotateZ(0.5);
      add(guom, -0.4, 1.6, 0.1, PALETTE.granite);
      return han(parts);
    }
    if (kind === 'siege') {
      /*
       * Xe pháo: KHÔNG có dáng người đứng thẳng. Hai bánh to, một nòng sẫm chếch lên, và
       * một pháo thủ lom khom phía sau — thấp, dài và đen, không lẫn với bất kỳ loại nào.
       * Sàn xe để màu phe (null) cho biết xe của ai.
       */
      add(new THREE.BoxGeometry(0.62, 0.2, 1.1), 0, 0.44, -0.05, null);
      for (const x of [-0.4, 0.4]) {
        const banh = new THREE.CylinderGeometry(0.37, 0.37, 0.1, 10);
        banh.rotateZ(Math.PI / 2);
        add(banh, x, 0.37, 0, PALETTE.trunk);
      }
      const nong = new THREE.CylinderGeometry(0.12, 0.18, 1.3, 8);
      nong.rotateX(Math.PI / 2 - 0.32);
      add(nong, 0, 0.82, 0.22, 0x33343a);
      const cang = new THREE.BoxGeometry(0.14, 0.12, 0.8);
      cang.rotateX(0.32);
      add(cang, 0, 0.3, -0.78, PALETTE.trunk);
      const tu = parts.length;
      this.thanNguoi(parts, add, 0.86);
      for (let i = tu; i < parts.length; i += 1) parts[i].translate(0.42, 0, -0.95);
      return han(parts);
    }
    this.thanNguoi(parts, add, 1);
    if (kind === 'mage') {
      /*
       * Pháp sư: áo choàng xoè tới đất, mũ chóp nhọn tím trùm kín cái mũ sắt của dáng người
       * chung, và một cây trượng có viên ngọc sáng. Đường viền là một hình nón trên một
       * hình nón — thứ duy nhất trên bãi không có vũ khí chĩa ra trước.
       */
      add(new THREE.ConeGeometry(0.44, 0.56, 8), 0, 0.28, 0, null);
      add(new THREE.CylinderGeometry(0.43, 0.43, 0.04, 10), 0, 0.92, 0, 0x6b4fa0);
      add(new THREE.ConeGeometry(0.34, 0.74, 8), 0, 1.14, 0, 0x6b4fa0);
      add(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), -0.34, 0.7, 0.12, PALETTE.trunk);
      // Cầu chứ không phải khối tám mặt: khối đa diện của three.js KHÔNG có chỉ số, gộp với các
      // phần có chỉ số là `han` ném lỗi và cả trò chơi không khởi động.
      add(new THREE.SphereGeometry(0.12, 6, 4), -0.34, 1.5, 0.12, 0x9fdcff);
      return han(parts);
    }
    if (kind === 'archer') {
      // Cánh cung: một vành cong dựng đứng trước mặt, đọc ra ngay từ xa.
      const cung = new THREE.TorusGeometry(0.42, 0.045, 5, 10, Math.PI * 1.15);
      cung.rotateY(Math.PI / 2);
      add(cung, -0.3, 0.74, 0.16, PALETTE.trunk);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), -0.3, 0.74, 0.16, PALETTE.cloud);
      return han(parts);
    }
    // Lính giáo: cây giáo chĩa chếch lên trước.
    const can = new THREE.CylinderGeometry(0.028, 0.028, 1.5, 5);
    can.rotateX(0.28);
    add(can, -0.3, 0.72, 0.1, PALETTE.trunk);
    const mui = new THREE.ConeGeometry(0.07, 0.24, 6);
    mui.rotateX(0.28);
    add(mui, -0.3, 1.5, 0.33, PALETTE.granite);
    return han(parts);
  }

  // ------------------------------------------------------------------ điều khiển

  /** Bắt đầu diễn lại một trận. Gọi lại khi đang diễn thì bỏ trận cũ, lấy trận mới. */
  play(seed: BattleSeed): void {
    if (seed.horde !== undefined) {
      this.beastMinion.geometry = beastGeometry(seed.horde, false);
      this.beastBoss.geometry = beastGeometry(seed.horde, true);
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
    this.legs.count = 0;
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
    b.pha += (d / SAI_BUOC) * Math.PI;
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
    let chan = 0;

    const than = (f: { x: number; z: number; face: number; kind: TroopKind },
      hex: number, cui: number): void => {
      const i = n[f.kind];
      if (i >= CAP) return;
      const b = this.choVe(f, a);
      const x = b.lx;
      const z = b.lz;
      const sin = Math.sin(b.pha);
      const dung = f.kind !== 'horse' && f.kind !== 'siege';
      // Nhún hai lần mỗi chu kỳ (mỗi bước một lần), lắc người sang bên chân đang trụ, và hơi
      // chúi về trước khi đi. Ngựa thì nhấp nhô theo nước kiệu, xe pháo chỉ rung trên đường.
      const nhun = Math.abs(sin) * b.di;
      const nhac = dung ? 0.1 * NGUOI : 0;
      const y = this.map.groundY(x, z) + nhac
        + nhun * (f.kind === 'horse' ? 0.12 : f.kind === 'siege' ? 0.025 : 0.07);
      this.v.set(x, y, z);
      this.q.setFromAxisAngle(this.axis, f.face);
      if (dung) {
        this.qz.setFromAxisAngle(this.oz, sin * 0.09 * b.di);
        this.qx.setFromAxisAngle(this.ox, 0.07 * b.di);
        this.q.multiply(this.qx).multiply(this.qz);
      } else if (f.kind === 'horse') {
        this.qx.setFromAxisAngle(this.ox, Math.sin(b.pha * 2) * 0.05 * b.di);
        this.q.multiply(this.qx);
      }
      if (dung && chan + 2 <= CAP * 4) {
        // Hai bàn chân ngược pha nhau, khớp ở hông ngay dưới vạt áo.
        for (const [lech, dau] of [[-0.11, 1], [0.11, -1]] as const) {
          this.hip.set(lech * NGUOI, 0.04 * NGUOI, 0).applyQuaternion(this.q).add(this.v);
          this.qx.setFromAxisAngle(this.ox, dau * sin * DUA_CHAN * b.di);
          const qc = this.qz.copy(this.q).multiply(this.qx);
          this.sc.set(NGUOI, NGUOI, NGUOI);
          this.legs.setMatrixAt(chan, this.m.compose(this.hip, qc, this.sc));
          chan += 1;
        }
      }
      this.sc.set(NGUOI, NGUOI * cui, NGUOI);
      this.m.compose(this.v, this.q, this.sc);
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
        const b = this.choVe(r, a);
        const nhip = b.pha / Math.max(0.6, co * 0.7);
        const nhun = Math.abs(Math.sin(nhip)) * b.di;
        this.v.set(b.lx, this.map.groundY(b.lx, b.lz) + nhun * 0.09 * co, b.lz);
        this.q.setFromAxisAngle(this.axis, r.face);
        this.qx.setFromAxisAngle(this.ox, Math.sin(nhip * 2) * 0.06 * b.di);
        this.qz.setFromAxisAngle(this.oz, Math.sin(nhip) * 0.07 * b.di);
        this.q.multiply(this.qx).multiply(this.qz);
        const cui = r.state === 'loot' ? 0.85 : 1;
        this.sc.set(NGUOI * co, NGUOI * co * cui, NGUOI * co);
        mesh.setMatrixAt(k, this.m.compose(this.v, this.q, this.sc));
        mesh.setColorAt(k, this.color.setHex(0xffffff));
        if (r.boss) trum += 1; else nho += 1;
        continue;
      }
      // Tên đang khuân hàng thì khom lưng xuống — nhìn một cái là biết đứa nào đang vơ vét.
      than(r, MAU_GIAC, r.state === 'loot' ? 0.82 : 1);
    }
    this.legs.count = chan;
    this.legs.instanceMatrix.needsUpdate = true;
    for (const [mesh, n0] of [[this.beastMinion, nho], [this.beastBoss, trum]] as const) {
      mesh.count = n0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const g of s.guards) than(g, MAU_LINH, 1);
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
