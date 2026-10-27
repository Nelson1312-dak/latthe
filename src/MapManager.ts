/**
 * Thế giới vô hạn, nạp theo khối.
 *
 * Bản đồ không có rìa. Khối nào nằm trong bán kính quanh tâm ngắm thì được sinh ra; đi xa
 * thì khối sau lưng bị huỷ. Mọi thứ trong một khối đều suy được từ toạ độ của nó (xem
 * world.ts), nên huỷ rồi quay lại vẫn thấy đúng cảnh cũ mà không lưu một byte nào.
 *
 * ĐIỂM QUAN TRỌNG NHẤT VỀ HIỆU NĂNG: mỗi kiểu hình chỉ có ĐÚNG MỘT InstancedMesh cho toàn
 * thế giới, không phải một bộ cho mỗi khối. Bốn chín khối × bảy kiểu hình sẽ là ba trăm bốn
 * ba lệnh vẽ; gom lại còn bảy, và con số đó KHÔNG ĐỔI dù người chơi đi xa tới đâu. Lúc tập
 * khối đang nạp thay đổi thì chỉ việc ghi lại các ma trận trong bộ đệm sẵn có.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES, PALETTE } from './config';
import type { BiomeId, Plot, ResourceNode, Vec3 } from './types';
import {
  CHUNK, KEEP_RADIUS, LOAD_RADIUS, biomeAt, chunkKey, chunkOf, chunkRng, hash2, heightAt,
  onRoad, richnessAt,
} from './world';

/** Bán kính một ô cỏ lục giác. */
const HEX_R = 1.75;

/**
 * Sức chứa mỗi bộ đệm. Đặt dư so với lượng thật của 7×7 khối; đầy thì phần thừa bị bỏ, và
 * đó là cách hỏng nhẹ nhàng nhất — mất vài bụi cỏ chứ không vỡ cả khung hình.
 */
const CAP = {
  road: 400, tile: 4200, pine: 1400, wheat: 700, rock: 1800, ore: 700, spire: 500, palm: 600, tuft: 3200,
} as const;

type PropKey = keyof typeof CAP;

interface Chunk {
  cx: number;
  cz: number;
  biome: BiomeId;
  nodes: ResourceNode[];
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
  private spireIndexStart = 0;

  /** Đổi mỗi khi tập khối thay đổi — Game dựa vào đây để dựng lại nền đất. */
  version = 0;

  constructor() {
    const mat = (flat: boolean) => new THREE.MeshLambertMaterial({ flatShading: flat });
    const make = (key: PropKey, geo: THREE.BufferGeometry, material: THREE.Material, shadow: boolean) => {
      const mesh = new THREE.InstancedMesh(geo, material, CAP[key]);
      mesh.castShadow = shadow;
      mesh.receiveShadow = key === 'tile';
      mesh.frustumCulled = false;
      for (let i = 0; i < CAP[key]; i += 1) mesh.setMatrixAt(i, this.hidden);
      this.meshes[key] = mesh;
      this.group.add(mesh);
    };

    make('tile', new THREE.CylinderGeometry(HEX_R, HEX_R, 2.4, 6), new THREE.MeshLambertMaterial(), false);
    // Duong la mot luoi thua cu CHUNK don vi mot truc, nen no cung vo han ma khong phai luu
    // gi - va xe tho luon tim duoc truc gan nhat de bam ve thu phu.
    make('road', new THREE.BoxGeometry(CHUNK, 0.12, 2.2), new THREE.MeshLambertMaterial(), false);
    make('pine', this.pineGeometry(), mat(true), true);
    make('wheat', this.wheatGeometry(), mat(true), true);
    make('rock', new THREE.DodecahedronGeometry(1, 0), mat(true), true);
    make('ore', new THREE.OctahedronGeometry(0.75, 0), new THREE.MeshStandardMaterial({
      roughness: 0.25, metalness: 0.15, emissive: PALETTE.goldOre, emissiveIntensity: 0.4,
    }), true);
    make('spire', this.spireGeometry(), new THREE.MeshStandardMaterial({
      roughness: 0.2, metalness: 0.1, emissive: PALETTE.crystal, emissiveIntensity: 0.5,
    }), true);
    make('palm', this.palmGeometry(), mat(true), true);
    make('tuft', new THREE.ConeGeometry(0.22, 0.5, 4), new THREE.MeshLambertMaterial(), false);
  }

  // ------------------------------------------------------------ nạp và huỷ

  /**
   * Giữ cho tập khối quanh tâm ngắm luôn đúng. Chỉ làm việc thật khi người chơi bước sang
   * một khối mới — còn lại thoát ngay, nên gọi mỗi khung hình cũng không sao.
   */
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

  /** Đổ toàn bộ khối đang nạp vào các bộ đệm dùng chung. */
  private refill(): void {
    const used: Record<string, number> = {};
    for (const k of Object.keys(CAP)) used[k] = 0;

    for (const chunk of this.chunks.values()) {
      for (const t of chunk.tiles) {
        const i = used.tile;
        if (i >= CAP.tile) break;
        this.m.makeTranslation(t.pos[0], t.pos[1], t.pos[2]);
        this.meshes.tile.setMatrixAt(i, this.m);
        this.meshes.tile.setColorAt(i, this.color.setHex(t.color));
        used.tile = i + 1;
      }
      for (const p of chunk.props) {
        const i = used[p.key];
        if (i >= CAP[p.key]) continue;
        this.v.set(p.pos[0], p.pos[1], p.pos[2]);
        this.q.setFromAxisAngle(this.axis, p.rot);
        this.s.setScalar(p.scale);
        this.meshes[p.key].setMatrixAt(i, this.m.compose(this.v, this.q, this.s));
        this.meshes[p.key].setColorAt(i, this.color.setHex(p.color));
        used[p.key] = i + 1;
      }
    }

    for (const key of Object.keys(CAP) as PropKey[]) {
      const mesh = this.meshes[key];
      for (let i = used[key]; i < CAP[key]; i += 1) mesh.setMatrixAt(i, this.hidden);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.spireIndexStart = used.spire;
  }

  // ------------------------------------------------------------ sinh khối

  private makeChunk(cx: number, cz: number): Chunk {
    const ox = cx * CHUNK;
    const oz = cz * CHUNK;
    const biome = biomeAt(ox + CHUNK / 2, oz + CHUNK / 2);
    const chunk: Chunk = { cx, cz, biome, nodes: [], plots: [], tiles: [], props: [] };
    const r = chunkRng(cx, cz);

    // --- thảm cỏ ---
    const stepX = HEX_R * 1.5;
    const stepZ = HEX_R * Math.sqrt(3);
    for (let i = 0; i * stepX < CHUNK; i += 1) {
      for (let j = 0; j * stepZ < CHUNK; j += 1) {
        const x = ox + i * stepX;
        const z = oz + j * stepZ + (i % 2 ? stepZ / 2 : 0);
        const b = biomeAt(x, z);
        const mix = hash2(Math.round(x * 3), Math.round(z * 3), 11) > 0.5 ? 0 : 1;
        chunk.tiles.push({
          pos: [x, -1.2 + heightAt(x, z, b), z],
          color: BIOMES[b].ground[mix],
        });
      }
    }

    // --- đường ---
    for (const [ax, az, rot] of [[ox + CHUNK / 2, oz, 0], [ox, oz + CHUNK / 2, Math.PI / 2]] as const) {
      chunk.props.push({ key: 'road', pos: [ax, 0.06, az], scale: 1, rot, color: PALETTE.road });
    }

    // --- mỏ ---
    const wanted = 2 + Math.floor(r() * 2);
    for (let n = 0; n < wanted; n += 1) {
      const x = ox + 2 + r() * (CHUNK - 4);
      const z = oz + 2 + r() * (CHUNK - 4);
      if (onRoad(x, z)) continue;
      if (Math.hypot(x, z) < 9) continue;                 // chừa quảng trường thủ phủ
      const b = biomeAt(x, z);
      const pick = r();
      let kind: ResourceNode['kind'] = 'wood';
      let shape: ResourceNode['shape'] = 'pine';
      if (b === 'meadow') {
        if (pick < 0.58) { kind = 'wood'; shape = 'pine'; } else { kind = 'food'; shape = 'wheat'; }
      } else if (b === 'crags') {
        kind = 'stone'; shape = pick < 0.7 ? 'quarry' : 'iron';
      } else if (b === 'desert') {
        kind = 'gold'; shape = 'dune_gold';
      } else {
        kind = 'relics'; shape = 'spire';
      }
      // Mỏ quý vốn hiếm hơn, nhưng độ giàu theo khoảng cách bù lại khi đi xa.
      const base = kind === 'gold' ? 0.5 : kind === 'relics' ? 0.28 : kind === 'stone' ? 0.9 : 1;
      chunk.nodes.push({
        id: `n_${cx}_${cz}_${n}`, kind, shape, biome: b,
        position: [x, 0, z],
        richness: base * richnessAt(x, z),
      });
      this.decorateNode(chunk, kind, shape, x, z, r);
    }

    // --- nền đất ---
    if (cx === 0 && cz === 0) {
      chunk.plots.push({ id: 'core', position: [0, 0, 0], biome: 'meadow', core: true });
      for (const [px, pz] of [[-7, -6], [7, -6], [-7, 6], [7, 6]] as const) {
        chunk.plots.push({ id: `p_0_0_${px}_${pz}`, position: [px, 0, pz], biome: biomeAt(px, pz), core: false });
      }
    } else if (r() < 0.75) {
      const count = 1 + (r() < 0.45 ? 1 : 0);
      for (let k = 0; k < count; k += 1) {
        const x = ox + 4 + r() * (CHUNK - 8);
        const z = oz + 4 + r() * (CHUNK - 8);
        if (onRoad(x, z)) continue;
        if (chunk.nodes.some((n) => Math.hypot(n.position[0] - x, n.position[2] - z) < 5)) continue;
        chunk.plots.push({
          id: `p_${cx}_${cz}_${k}`, position: [x, 0, z], biome: biomeAt(x, z), core: false,
        });
      }
    }

    // --- trang trí ---
    const tufts = biome === 'meadow' ? 26 : biome === 'highlands' ? 14 : biome === 'desert' ? 6 : 8;
    for (let i = 0; i < tufts; i += 1) {
      const x = ox + r() * CHUNK;
      const z = oz + r() * CHUNK;
      if (onRoad(x, z)) continue;
      const b = biomeAt(x, z);
      if (b === 'desert') {
        chunk.props.push({ key: 'palm', pos: [x, 0, z], scale: 0.8 + r() * 0.5, rot: r() * 6,
          color: r() < 0.5 ? PALETTE.palm : PALETTE.cactus });
      } else if (b === 'crags') {
        chunk.props.push({ key: 'rock', pos: [x, 0.15, z], scale: 0.18 + r() * 0.18, rot: r() * 6,
          color: PALETTE.graniteDark });
      } else {
        chunk.props.push({ key: 'tuft', pos: [x, 0.1, z], scale: 0.55 + r() * 0.7, rot: r() * 6,
          color: b === 'highlands' ? 0x6f5fd0 : 0x62aa4e });
      }
    }
    return chunk;
  }

  private decorateNode(
    chunk: Chunk, kind: ResourceNode['kind'], shape: ResourceNode['shape'],
    x: number, z: number, r: () => number,
  ): void {
    const push = (key: PropKey, dx: number, dy: number, dz: number, scale: number, color: number) => {
      chunk.props.push({ key, pos: [x + dx, dy, z + dz], scale, rot: r() * 6, color });
    };
    if (shape === 'pine') {
      for (let i = 0; i < 4 + Math.floor(r() * 3); i += 1) {
        const a = r() * Math.PI * 2;
        const d = r() * 2.1;
        push('pine', Math.cos(a) * d, 0, Math.sin(a) * d, 0.8 + r() * 0.5,
          PALETTE.pine[Math.floor(r() * 3)]);
      }
    } else if (shape === 'wheat') {
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        push('wheat', Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5, 0.85 + r() * 0.35,
          r() < 0.3 ? PALETTE.berry : PALETTE.wheat);
      }
    } else if (shape === 'quarry' || shape === 'iron') {
      for (let i = 0; i < 4; i += 1) {
        const a = r() * Math.PI * 2;
        const d = r() * 1.7;
        push('rock', Math.cos(a) * d, 0.35 + r() * 0.3, Math.sin(a) * d, 0.45 + r() * 0.55,
          shape === 'iron' ? PALETTE.iron : (r() < 0.5 ? PALETTE.granite : PALETTE.graniteDark));
      }
    } else if (shape === 'dune_gold') {
      for (let i = 0; i < 3; i += 1) {
        push('rock', (r() - 0.5) * 2.2, 0.3, (r() - 0.5) * 2.2, 0.4 + r() * 0.3, PALETTE.sand);
      }
      for (let i = 0; i < 3; i += 1) {
        push('ore', (r() - 0.5) * 1.6, 0.75 + r() * 0.5, (r() - 0.5) * 1.6, 0.4 + r() * 0.3, PALETTE.goldOre);
      }
    } else {
      for (let i = 0; i < 3; i += 1) {
        push('spire', (r() - 0.5) * 2.2, 0, (r() - 0.5) * 2.2, 0.7 + r() * 0.8, PALETTE.crystal);
      }
    }
    void kind;
  }

  // ------------------------------------------------------------------ tra cứu

  get nodes(): ResourceNode[] {
    const out: ResourceNode[] = [];
    for (const c of this.chunks.values()) out.push(...c.nodes);
    return out;
  }

  get plots(): Plot[] {
    const out: Plot[] = [];
    for (const c of this.chunks.values()) out.push(...c.plots);
    return out;
  }

  nodeById(id: string): ResourceNode | undefined {
    for (const c of this.chunks.values()) {
      const n = c.nodes.find((x) => x.id === id);
      if (n) return n;
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

  /** Trụ pha lê xoay nhẹ. Bỏ qua khi quanh đây không có cái nào. */
  animate(dt: number): void {
    if (this.spireIndexStart > 0) this.meshes.spire.rotation.y += dt * 0.12;
  }

  // -------------------------------------------------- hình học đã hàn sẵn

  /**
   * Cây thông: thân cộng ba tán, HÀN thành một hình học.
   *
   * Không hàn thì một cây là bốn lệnh vẽ và cả việc gom instancing mất ý nghĩa.
   */
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
