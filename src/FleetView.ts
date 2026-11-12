/**
 * Hạm đội neo ở bến: mỗi chiến thuyền trong `state.fleet` là một con thuyền thật trên mặt
 * nước gần bến tàu nhất. Thuần phần hình — luật hải chiến nằm ở naval.ts, và trận trên biển
 * vẫn tính bằng số chứ không diễn ra từng phát đạn.
 *
 * Bến tàu đứng trong vành căn cứ, mà vành căn cứ thì luôn khô (world.ts giữ đất trong bán
 * kính 48 không bao giờ ngập). Nên chỗ neo là điểm nước sâu GẦN BẾN NHẤT, dò theo vòng tròn
 * lớn dần — có khi cách bến vài chục bước, giống một cái cảng ra cửa sông.
 */
import * as THREE from 'three';
import type { Economy } from './Economy';
import type { MapManager } from './MapManager';
import { matte, tinted } from './materials';
import { han, paint } from './shapes';
import { PALETTE } from './config';
import { waterAt } from './world';

const CAP = 12;

export class FleetView {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.InstancedMesh;
  private readonly map: MapManager;
  private readonly economy: Economy;
  /** Chỗ neo đã dò, theo toạ độ bến — dò lại chỉ khi bến dời đi. */
  private neoKey = '';
  private neo: { x: number; z: number; huong: number } | null = null;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(0.8, 0.8, 0.8);
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly ngang = new THREE.Vector3(1, 0, 0);
  private readonly lac = new THREE.Quaternion();
  private readonly color = new THREE.Color();

  constructor(map: MapManager, economy: Economy) {
    this.map = map;
    this.economy = economy;
    const mat = tinted(matte(undefined, true));
    mat.vertexColors = true;
    this.mesh = new THREE.InstancedMesh(this.shipGeometry(), mat, CAP);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  /** Điểm nước sâu gần bến nhất, cùng hướng thuyền nằm (dọc bờ). */
  private timNeo(bx: number, bz: number): { x: number; z: number; huong: number } | null {
    for (let r = 6; r <= 150; r += 3) {
      const n = Math.max(12, Math.round(r * 0.8));
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2;
        const x = bx + Math.cos(a) * r;
        const z = bz + Math.sin(a) * r;
        // Đòi cả một dải nước quanh đó, không thì đoàn thuyền xếp hàng sẽ có chiếc mắc cạn.
        if (waterAt(x, z) >= 0.98 && waterAt(x + Math.cos(a) * 6, z + Math.sin(a) * 6) >= 0.98) {
          return { x: x + Math.cos(a) * 3, z: z + Math.sin(a) * 3, huong: a + Math.PI / 2 };
        }
      }
    }
    return null;
  }

  update(t: number): void {
    const st = this.economy.state;
    const dock = st.buildings.find((b) => b.type === 'dock');
    const n = dock ? Math.min(CAP, st.fleet) : 0;
    if (!dock || n === 0) { this.mesh.count = 0; return; }
    const key = `${dock.position[0]},${dock.position[2]}`;
    if (key !== this.neoKey) {
      this.neoKey = key;
      this.neo = this.timNeo(dock.position[0], dock.position[2]);
    }
    const o = this.neo;
    if (!o) { this.mesh.count = 0; return; }
    this.color.setHex(st.village.color);
    const dx = Math.cos(o.huong);
    const dz = Math.sin(o.huong);
    // Hai hàng so le dọc bờ: hàng ngoài lùi ra biển một chút, đọc ra là một đoàn chứ không
    // phải một chuỗi hạt.
    const ra = { x: Math.cos(o.huong - Math.PI / 2), z: Math.sin(o.huong - Math.PI / 2) };
    for (let i = 0; i < n; i += 1) {
      const hang = i % 2;
      const cot = Math.floor(i / 2) - (Math.ceil(n / 2) - 1) / 2;
      // Thân dài 3,4 sau khi thu nhỏ: cách nhau 5 thì giữa hai mũi còn một khoảng nước.
      const x = o.x + dx * (cot * 5 + hang * 2.5) + ra.x * hang * 2.8;
      const z = o.z + dz * (cot * 5 + hang * 2.5) + ra.z * hang * 2.8;
      // Dập dềnh: mỗi chiếc một pha, nghiêng nhẹ theo sóng.
      const song = Math.sin(t * 1.4 + i * 1.7);
      this.p.set(x, this.map.groundY(x, z) + song * 0.06, z);
      this.q.setFromAxisAngle(this.up, -o.huong + hang * 0.12);
      this.q.multiply(this.lac.setFromAxisAngle(this.ngang, song * 0.05));
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /**
   * Chiến thuyền: to gấp đôi thuyền chài, thân sẫm, hai cột buồm, buồm trắng mang MÀU LÀNG
   * (đỉnh trắng nhận màu của bản), và một dải mạn đỏ — nhìn là biết thuyền chiến của mình.
   * Gốc toạ độ ở mớn nước.
   */
  private shipGeometry(): THREE.BufferGeometry {
    const than = new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    than.scale(2.1, 0.8, 0.75);
    than.translate(0, 0.32, 0);
    const boong = new THREE.CircleGeometry(1, 8);
    boong.rotateX(-Math.PI / 2);
    boong.scale(2.06, 1, 0.73);
    boong.translate(0, 0.31, 0);
    const lau = new THREE.BoxGeometry(0.7, 0.42, 0.9);
    lau.translate(-1.35, 0.52, 0);
    const parts = [paint(than, 0x4a3122), paint(boong, 0x8a6a4a), paint(lau, 0x6b4a33)];
    for (const [x, cao] of [[0.55, 2.3], [-0.45, 1.9]] as const) {
      const cot = new THREE.CylinderGeometry(0.05, 0.07, cao, 5);
      cot.translate(x, 0.31 + cao / 2, 0);
      const buom = new THREE.BoxGeometry(0.08, cao * 0.55, 1.15);
      buom.translate(x + 0.06, 0.31 + cao * 0.55, 0);
      parts.push(paint(cot, PALETTE.trunk), paint(buom, null));
    }
    const co = new THREE.ConeGeometry(0.16, 0.42, 3);
    co.rotateZ(-Math.PI / 2);
    co.translate(0.75, 2.62, 0);
    parts.push(paint(co, 0xd8453a));
    return han(parts);
  }
}
