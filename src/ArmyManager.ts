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
import { PALETTE } from './config';
import type { MapManager } from './MapManager';
import { matte, tinted } from './materials';
import { han, paint } from './shapes';

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

export class ArmyManager {
  readonly group = new THREE.Group();
  private readonly map: MapManager;

  private readonly bodies: THREE.InstancedMesh;
  private readonly shots: THREE.InstancedMesh;

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
    this.bodies = new THREE.InstancedMesh(this.fighterGeometry(), than, CAP);
    this.shots = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.09, 0.09, 1), matte(PALETTE.wheat, true), SHOT_CAP);
    for (const mesh of [this.bodies, this.shots]) {
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
  }

  /**
   * Một người cầm giáo. Cùng khối lượng chi tiết với dân làng nhưng dáng khác hẳn: mũ chóp
   * thay nón lá, và cây giáo chĩa lên — ở mức phóng này người chơi đọc dáng chứ không đọc
   * mặt, nên khác dáng mới là khác phe.
   */
  private fighterGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, hex: number | null): void => {
      g.translate(x, y, z);
      parts.push(paint(g, hex));
    };
    add(new THREE.CylinderGeometry(0.21, 0.28, 0.46, 8), 0, 0.23, 0, null);
    add(new THREE.SphereGeometry(0.3, 12, 9), 0, 0.73, 0, PALETTE.skin);
    for (const x of [-0.11, 0.11]) add(new THREE.BoxGeometry(0.055, 0.075, 0.04), x, 0.75, 0.28, PALETTE.eye);
    for (const x of [-0.27, 0.27]) add(new THREE.SphereGeometry(0.075, 6, 5), x, 0.31, 0.05, PALETTE.skin);
    // Mũ chóp sắt.
    add(new THREE.ConeGeometry(0.3, 0.34, 10), 0, 0.98, 0, PALETTE.granite);
    // Cây giáo trong tay phải, chĩa chếch lên trước.
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
    this.s = battleStart(seed);
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
    this.bodies.count = 0;
    this.shots.count = 0;
    this.vet.length = 0;
  }

  update(dt: number): void {
    const s = this.s;
    if (!s) return;

    if (!s.done) {
      // Kẹp ở ĐẦU VÀO, không bao giờ xả bộ tích: tab bị bóp một giây thì bản diễn chạy
      // chậm lại, chứ không nhảy mất mười bước.
      this.acc += Math.min(dt, 0.5);
      let guard = 0;
      while (!s.done && this.acc >= TICK && guard < 40) {
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
    let n = 0;

    const than = (x: number, z: number, face: number, hex: number, cui: number): void => {
      if (n >= CAP) return;
      this.v.set(x, this.map.groundY(x, z), z);
      this.q.setFromAxisAngle(this.axis, face);
      this.sc.set(NGUOI, NGUOI * cui, NGUOI);
      this.m.compose(this.v, this.q, this.sc);
      this.bodies.setMatrixAt(n, this.m);
      this.bodies.setColorAt(n, this.color.setHex(hex));
      n += 1;
    };

    for (const r of s.raiders) {
      // Tên đang khuân hàng thì khom lưng xuống — nhìn một cái là biết đứa nào đang vơ vét.
      than(r.x, r.z, r.face, MAU_GIAC, r.state === 'loot' ? 0.82 : 1);
    }
    for (const m of s.mercs) than(m.x, m.z, m.face, MAU_LINH, 1);
    this.bodies.count = n;
    this.bodies.instanceMatrix.needsUpdate = true;
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;

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
