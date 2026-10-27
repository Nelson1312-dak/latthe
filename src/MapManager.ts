/**
 * Thế giới vô hạn, nạp theo khối, với BÃI tài nguyên thay cho mỏ lẻ.
 *
 * Mỗi khối chứa một hoặc hai bãi: mỗi bãi là một khu có nền đất riêng tô màu theo loại tài
 * nguyên, một viền bao quanh, và props dày đặc bên trong. Bản trước rải hai tới bốn mỏ nhỏ
 * mỗi khối và kết quả là một tấm thảm chấm — nhìn không ra đâu là khu gì, nên cũng chẳng có
 * gì để mà chỉ vào rồi bảo "cho ba người tới đây".
 *
 * HIỆU NĂNG: mỗi KIỂU hình đúng MỘT InstancedMesh cho toàn thế giới, không phải một bộ cho
 * mỗi khối. 121 khối × 11 kiểu hình sẽ là hơn một nghìn ba trăm lệnh vẽ; gom lại còn mười
 * một, và con số đó không đổi dù người chơi đi xa tới đâu.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES, PALETTE, RESOURCES } from './config';
import type { Patch, Plot, Vec3 } from './types';
import {
  CHUNK, KEEP_RADIUS, LOAD_RADIUS, biomeAt, chunkKey, chunkOf, chunkRng, hash2, heightAt,
  onRoad, patchesOf,
} from './world';

/**
 * Bán kính một ô cỏ. To hơn bản trước (1,75 → 2,4) vì tầm nhìn rộng gấp đôi: giữ nguyên cỡ
 * cũ thì số ô tăng gấp ba mà mắt không nhìn ra khác biệt ở mức phóng xa.
 */
const HEX_R = 2.4;

/*
 * Tran so ban cho tung kieu hinh. Do bang cach dem that tren sau vung khac nhau roi cong
 * 30% du dia, vi so props doi theo bien sinh thai.
 *
 * Vuot tran thi refill() LANG LE bo qua, khong bao gi het. Dung con so cu (8000 o co, 160
 * vong bai) thi vung nap can 8.712 o va 172 bai: nen dat thung mot mang o ria, va 12 bai
 * khong co vong bao nao - dung cai dieu kien "bai phai nhin ra ngay" ma ca ban nay dua vao.
 */
const CAP = {
  tile: 11400, disc: 300, ring: 300, road: 400,
  pine: 1100, wheat: 900, rock: 1400, ore: 800, spire: 500, palm: 300, tuft: 2300,
} as const;

type PropKey = keyof typeof CAP;

interface Chunk {
  cx: number;
  cz: number;
  patches: Patch[];
  plots: Plot[];
  tiles: { pos: Vec3; color: number }[];
  props: { key: PropKey; pos: Vec3; scale: number; rot: number; color: number }[];
}

export class MapManager {
  readonly group = new THREE.Group();
  private readonly chunks = new Map<string, Chunk>();
  private readonly meshes = {} as Record<PropKey, THREE.InstancedMesh>;
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly m = new THREE.Matrix4();
  private readonly v = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 1, 0);
  private readonly color = new THREE.Color();
  private lastCenter = '';
  private spireCount = 0;

  /** Đổi mỗi khi tập khối thay đổi — Game dựa vào đây để dựng lại nền đất. */
  version = 0;

  constructor() {
    const lambert = (flat: boolean) => new THREE.MeshLambertMaterial({ flatShading: flat });
    const make = (key: PropKey, geo: THREE.BufferGeometry, material: THREE.Material, shadow: boolean) => {
      const mesh = new THREE.InstancedMesh(geo, material, CAP[key]);
      mesh.castShadow = shadow;
      mesh.receiveShadow = key === 'tile';
      mesh.frustumCulled = false;
      mesh.renderOrder = key === 'disc' || key === 'ring' ? 1 : 0;
      for (let i = 0; i < CAP[key]; i += 1) mesh.setMatrixAt(i, this.hidden);
      this.meshes[key] = mesh;
      this.group.add(mesh);
    };

    make('tile', new THREE.CylinderGeometry(HEX_R, HEX_R, 2.6, 6), new THREE.MeshLambertMaterial(), false);

    // Nền bãi và viền bãi: hai vòng tròn dẹt nằm sát mặt đất. Đây là thứ khiến một bãi đọc
    // được ngay từ mức phóng xa nhất, khi props đã nhỏ như hạt vừng.
    const disc = new THREE.CircleGeometry(1, 28);
    disc.rotateX(-Math.PI / 2);
    make('disc', disc, new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.3, depthWrite: false,
    }), false);
    const ring = new THREE.RingGeometry(0.93, 1, 40);
    ring.rotateX(-Math.PI / 2);
    make('ring', ring, new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide,
    }), false);

    make('road', new THREE.BoxGeometry(CHUNK, 0.12, 2.6), new THREE.MeshLambertMaterial(), false);
    make('pine', this.pineGeometry(), lambert(true), true);
    make('wheat', this.wheatGeometry(), lambert(true), true);
    make('rock', new THREE.DodecahedronGeometry(1, 0), lambert(true), true);
    make('ore', new THREE.OctahedronGeometry(0.75, 0), new THREE.MeshStandardMaterial({
      roughness: 0.25, metalness: 0.15, emissive: PALETTE.goldOre, emissiveIntensity: 0.4,
    }), true);
    make('spire', this.spireGeometry(), new THREE.MeshStandardMaterial({
      roughness: 0.2, metalness: 0.1, emissive: PALETTE.crystal, emissiveIntensity: 0.5,
    }), true);
    make('palm', this.palmGeometry(), lambert(true), true);
    make('tuft', new THREE.ConeGeometry(0.22, 0.5, 4), new THREE.MeshLambertMaterial(), false);
  }

  // ------------------------------------------------------------ nạp và huỷ

  update(center: THREE.Vector3): void {
    const cx = chunkOf(center.x);
    const cz = chunkOf(center.z);
    const key = chunkKey(cx, cz);
    if (key === this.lastCenter) return;
    this.lastCenter = key;

    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx += 1) {
      for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz += 1) {
        const k = chunkKey(cx + dx, cz + dz);
        if (!this.chunks.has(k)) this.chunks.set(k, this.makeChunk(cx + dx, cz + dz));
      }
    }
    for (const [k, c] of this.chunks) {
      if (Math.abs(c.cx - cx) > KEEP_RADIUS || Math.abs(c.cz - cz) > KEEP_RADIUS) this.chunks.delete(k);
    }
    this.refill();
    this.version += 1;
  }

  private refill(): void {
    const used: Record<string, number> = {};
    for (const k of Object.keys(CAP)) used[k] = 0;

    const put = (key: PropKey, mat: THREE.Matrix4, color: number) => {
      const i = used[key];
      if (i >= CAP[key]) return;
      this.meshes[key].setMatrixAt(i, mat);
      this.meshes[key].setColorAt(i, this.color.setHex(color));
      used[key] = i + 1;
    };

    for (const chunk of this.chunks.values()) {
      for (const t of chunk.tiles) {
        put('tile', this.m.makeTranslation(t.pos[0], t.pos[1], t.pos[2]), t.color);
      }
      for (const p of chunk.patches) {
        const tint = RESOURCES[p.kind].color;
        this.v.set(p.center[0], 0.14, p.center[2]);
        this.q.identity();
        this.s.set(p.radius, 1, p.radius);
        put('disc', this.m.compose(this.v, this.q, this.s), tint);
        this.v.y = 0.16;
        put('ring', this.m.compose(this.v, this.q, this.s), tint);
      }
      for (const pr of chunk.props) {
        this.v.set(pr.pos[0], pr.pos[1], pr.pos[2]);
        this.q.setFromAxisAngle(this.axis, pr.rot);
        this.s.setScalar(pr.scale);
        put(pr.key, this.m.compose(this.v, this.q, this.s), pr.color);
      }
    }

    for (const key of Object.keys(CAP) as PropKey[]) {
      const mesh = this.meshes[key];
      for (let i = used[key]; i < CAP[key]; i += 1) mesh.setMatrixAt(i, this.hidden);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.spireCount = used.spire;
  }

  // ------------------------------------------------------------ sinh khối

  private makeChunk(cx: number, cz: number): Chunk {
    const ox = cx * CHUNK;
    const oz = cz * CHUNK;
    const chunk: Chunk = { cx, cz, patches: patchesOf(cx, cz), plots: [], tiles: [], props: [] };
    const r = chunkRng(cx, cz);

    // --- thảm cỏ ---
    const stepX = HEX_R * 1.5;
    const stepZ = HEX_R * Math.sqrt(3);
    for (let i = 0; i * stepX < CHUNK; i += 1) {
      for (let j = 0; j * stepZ < CHUNK; j += 1) {
        const x = ox + i * stepX;
        const z = oz + j * stepZ + (i % 2 ? stepZ / 2 : 0);
        const b = biomeAt(x, z);
        const mix = hash2(Math.round(x * 2), Math.round(z * 2), 11) > 0.5 ? 0 : 1;
        chunk.tiles.push({ pos: [x, -1.3 + heightAt(x, z, b), z], color: BIOMES[b].ground[mix] });
      }
    }

    // --- đường ---
    chunk.props.push({ key: 'road', pos: [ox + CHUNK / 2, 0.06, oz], scale: 1, rot: 0, color: PALETTE.road });
    chunk.props.push({ key: 'road', pos: [ox, 0.06, oz + CHUNK / 2], scale: 1, rot: Math.PI / 2, color: PALETTE.road });

    // --- bãi tài nguyên ---
    for (const p of chunk.patches) this.dressPatch(chunk, p, r);

    // --- nền đất ---
    if (cx === 0 && cz === 0) {
      chunk.plots.push({ id: 'core', position: [0, 0, 0], biome: 'meadow', core: true });
      for (const [px, pz] of [[-9, -8], [9, -8], [-9, 8], [9, 8]] as const) {
        chunk.plots.push({ id: `p_0_0_${px}_${pz}`, position: [px, 0, pz], biome: biomeAt(px, pz), core: false });
      }
    } else {
      /*
       * Một tới ba nền mỗi khối.
       *
       * Bản trước chỉ 32% số khối có nền, và nền ấy còn bị loại nếu rơi trúng đường hay
       * trúng bãi — đo ra 26 nền trên 121 khối đang nạp. Chơi một giờ là hết chỗ xây, kho
       * đầy cả bốn loại mà không tiêu được vào đâu: đúng cái bế tắc "chơi một lúc là chán".
       * Nền đất giờ chỉ còn tốn hai lệnh vẽ cho TOÀN BẢN ĐỒ, nên không còn lý do phải hà
       * tiện nữa.
       */
      const soNen = r() < 0.3 ? 3 : r() < 0.7 ? 2 : 1;
      for (let k = 0; k < soNen; k += 1) {
        const x = ox + 5 + r() * (CHUNK - 10);
        const z = oz + 5 + r() * (CHUNK - 10);
        if (onRoad(x, z)) continue;
        if (chunk.patches.some((p) =>
          Math.hypot(p.center[0] - x, p.center[2] - z) < p.radius + 4)) continue;
        // Hai nền chồng lên nhau thì bấm vào không biết trúng cái nào.
        if (chunk.plots.some((q) => Math.hypot(q.position[0] - x, q.position[2] - z) < 7)) continue;
        chunk.plots.push({
          id: `p_${cx}_${cz}_${k}`, position: [x, 0, z], biome: biomeAt(x, z), core: false,
        });
      }
    }

    // --- trang trí thưa ngoài bãi ---
    const biome = biomeAt(ox + CHUNK / 2, oz + CHUNK / 2);
    for (let i = 0; i < 14; i += 1) {
      const x = ox + r() * CHUNK;
      const z = oz + r() * CHUNK;
      if (onRoad(x, z)) continue;
      if (chunk.patches.some((p) =>
        Math.hypot(p.center[0] - x, p.center[2] - z) < p.radius + 2)) continue;
      const b = biomeAt(x, z);
      if (b === 'desert') {
        if (r() < 0.3) chunk.props.push({ key: 'palm', pos: [x, 0, z], scale: 0.8 + r() * 0.5, rot: r() * 6, color: r() < 0.5 ? PALETTE.palm : PALETTE.cactus });
      } else if (b === 'crags') {
        if (r() < 0.5) chunk.props.push({ key: 'rock', pos: [x, 0.15, z], scale: 0.18 + r() * 0.2, rot: r() * 6, color: PALETTE.graniteDark });
      } else {
        chunk.props.push({ key: 'tuft', pos: [x, 0.1, z], scale: 0.55 + r() * 0.7, rot: r() * 6, color: biome === 'highlands' ? 0x6f5fd0 : 0x62aa4e });
      }
    }
    return chunk;
  }

  /** Props bên trong một bãi: dày, cao, và bám sát vùng đất của nó. */
  private dressPatch(chunk: Chunk, p: Patch, r: () => number): void {
    const [x, , z] = p.center;
    const put = (key: PropKey, dx: number, dy: number, dz: number, scale: number, color: number) => {
      chunk.props.push({ key, pos: [x + dx, dy, z + dz], scale, rot: r() * 6, color });
    };
    const rai = (n: number, fn: (a: number, d: number) => void) => {
      for (let i = 0; i < n; i += 1) fn(r() * Math.PI * 2, Math.sqrt(r()) * p.radius * 0.88);
    };

    switch (p.kind) {
      case 'wood':
        rai(16, (a, d) => put('pine', Math.cos(a) * d, 0, Math.sin(a) * d,
          0.85 + r() * 0.6, PALETTE.pine[Math.floor(r() * 3)]));
        break;
      case 'food':
        rai(14, (a, d) => put('wheat', Math.cos(a) * d, 0, Math.sin(a) * d,
          0.85 + r() * 0.4, r() < 0.25 ? PALETTE.berry : PALETTE.wheat));
        break;
      case 'stone':
        rai(13, (a, d) => put('rock', Math.cos(a) * d, 0.3 + r() * 0.4, Math.sin(a) * d,
          0.4 + r() * 0.75, r() < 0.3 ? PALETTE.iron : (r() < 0.5 ? PALETTE.granite : PALETTE.graniteDark)));
        break;
      case 'gold':
        rai(7, (a, d) => put('rock', Math.cos(a) * d, 0.3, Math.sin(a) * d, 0.4 + r() * 0.4, PALETTE.sand));
        rai(8, (a, d) => put('ore', Math.cos(a) * d, 0.7 + r() * 0.6, Math.sin(a) * d, 0.35 + r() * 0.35, PALETTE.goldOre));
        break;
      case 'relics':
        rai(9, (a, d) => put('spire', Math.cos(a) * d, 0, Math.sin(a) * d, 0.7 + r() * 0.9, PALETTE.crystal));
        break;
    }
  }

  // ------------------------------------------------------------------ tra cứu

  get patches(): Patch[] {
    const out: Patch[] = [];
    for (const c of this.chunks.values()) out.push(...c.patches);
    return out;
  }

  get plots(): Plot[] {
    const out: Plot[] = [];
    for (const c of this.chunks.values()) out.push(...c.plots);
    return out;
  }

  patchById(id: string): Patch | undefined {
    for (const c of this.chunks.values()) {
      for (const p of c.patches) if (p.id === id) return p;
    }
    return undefined;
  }

  plotById(id: string): Plot | undefined {
    for (const c of this.chunks.values()) {
      const p = c.plots.find((x) => x.id === id);
      if (p) return p;
    }
    return undefined;
  }

  animate(dt: number): void {
    if (this.spireCount > 0) this.meshes.spire.rotation.y += dt * 0.12;
  }

  // -------------------------------------------------- hình học đã hàn sẵn

  /** Thân cộng ba tán, HÀN thành một hình học — không hàn thì một cây là bốn lệnh vẽ. */
  private pineGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const trunk = new THREE.CylinderGeometry(0.14, 0.2, 0.9, 5);
    trunk.translate(0, 0.45, 0);
    parts.push(trunk);
    for (const [y, rad, h] of [[1.15, 0.95, 1.2], [1.9, 0.72, 1.0], [2.5, 0.48, 0.8]] as const) {
      const cone = new THREE.ConeGeometry(rad, h, 6);
      cone.translate(0, y, 0);
      parts.push(cone);
    }
    return mergeGeometries(parts, false) ?? trunk;
  }

  private wheatGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    for (const [dx, dz] of [[0, 0], [0.26, 0.12], [-0.2, 0.22]] as const) {
      const sheaf = new THREE.CylinderGeometry(0.1, 0.22, 0.85, 5);
      sheaf.translate(dx, 0.42, dz);
      parts.push(sheaf);
    }
    return mergeGeometries(parts, false) ?? parts[0];
  }

  private spireGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const main = new THREE.ConeGeometry(0.5, 3.2, 5);
    main.translate(0, 1.6, 0);
    parts.push(main);
    const side = new THREE.ConeGeometry(0.3, 1.8, 5);
    side.translate(0.55, 0.9, 0.2);
    parts.push(side);
    return mergeGeometries(parts, false) ?? main;
  }

  private palmGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const trunk = new THREE.CylinderGeometry(0.1, 0.16, 1.9, 5);
    trunk.translate(0, 0.95, 0);
    parts.push(trunk);
    for (let i = 0; i < 5; i += 1) {
      const frond = new THREE.ConeGeometry(0.22, 1.25, 4);
      frond.rotateZ(Math.PI / 2.4);
      frond.rotateY((i / 5) * Math.PI * 2);
      frond.translate(0, 1.95, 0);
      parts.push(frond);
    }
    return mergeGeometries(parts, false) ?? trunk;
  }

  dispose(): void {
    for (const mesh of Object.values(this.meshes)) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
}
