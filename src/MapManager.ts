/**
 * Thế giới 60×60: mặt đất, cây cối, đá, mỏ — và cách gom tất cả lại thành vài lệnh vẽ.
 *
 * ĐÂY LÀ CHỖ QUYẾT ĐỊNH GAME CÓ CHẠY 60 KHUNG/GIÂY HAY KHÔNG.
 *
 * Bản trước (đảo 38 đơn vị, 8 ô đất) đo được 225 lệnh vẽ, vì mỗi nón thông, mỗi hòn đá, mỗi
 * thanh rào là một mesh riêng. Thế giới này rộng gấp hơn hai lần rưỡi và dày đặc props hơn
 * nhiều; giữ nguyên cách cũ thì rơi vào khoảng vài nghìn lệnh vẽ, và số lệnh vẽ — chứ không
 * phải số tam giác — mới là thứ bóp chết card đồ hoạ tích hợp trên máy văn phòng.
 *
 * Nên mọi thứ lặp lại đều đi qua InstancedMesh, mỗi KIỂU hình đúng một lệnh vẽ dù có một hay
 * một nghìn cái. Cây thông gồm thân cộng ba tán, nhưng bốn khối đó được HÀN thành một hình
 * học duy nhất trước khi nhân bản — nếu không thì một cây vẫn là bốn lệnh vẽ và việc gom
 * chẳng còn ý nghĩa gì.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES, HALF, PALETTE, PLOTS, WORLD, biomeAt } from './config';
import type { BiomeId, ResourceNode, Vec3 } from './types';

/** Bán kính một ô cỏ lục giác. */
const HEX_R = 1.75;

/** Bộ sinh số giả ngẫu nhiên có hạt giống: thế giới giống hệt nhau ở mọi lần mở, không cần lưu. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PropSpec {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow: boolean;
}

export class MapManager {
  readonly group = new THREE.Group();
  readonly nodes: ResourceNode[] = [];
  /** Tâm các ô sương, để FogOfWar dùng chung một lưới với bản đồ. */
  private readonly owned: THREE.Object3D[] = [];
  private spires: THREE.InstancedMesh | null = null;

  constructor() {
    this.buildTerrain();
    this.buildRoads();
    this.generateNodes();
    this.buildProps();
  }

  // ------------------------------------------------------------- mặt đất

  /**
   * Thảm lục giác phủ cả thế giới, MỘT InstancedMesh. Màu lấy theo biến sinh thái tại chỗ,
   * trộn hai sắc theo nhiễu nên ranh giới giữa các vùng tự nhiên chứ không phải một đường kẻ.
   */
  private buildTerrain(): void {
    const stepX = HEX_R * 1.5;
    const stepZ = HEX_R * Math.sqrt(3);
    const spots: { x: number; z: number; b: BiomeId }[] = [];

    for (let i = -Math.ceil(HALF / stepX); i <= Math.ceil(HALF / stepX); i += 1) {
      for (let j = -Math.ceil(HALF / stepZ); j <= Math.ceil(HALF / stepZ); j += 1) {
        const x = i * stepX;
        const z = j * stepZ + (i % 2 ? stepZ / 2 : 0);
        // Viền bo tròn: pha Chebyshev với Euclid nên đảo vuông mà mềm góc.
        const soft = Math.max(Math.abs(x), Math.abs(z)) * 0.68 + Math.hypot(x, z) * 0.32;
        if (soft <= HALF) spots.push({ x, z, b: biomeAt(x, z) });
      }
    }

    const geo = new THREE.CylinderGeometry(HEX_R, HEX_R, 1.2, 6);
    // KHÔNG bật vertexColors: màu theo thực thể đi qua instanceColor, three tự bật định nghĩa
    // USE_INSTANCING_COLOR khi thấy thuộc tính đó. Bật thêm vertexColors làm shader đòi một
    // thuộc tính màu đỉnh không có trên hình học này, và cả cánh đồng ra màu đen.
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), spots.length);
    mesh.receiveShadow = true;

    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    spots.forEach((s, i) => {
      const biome = BIOMES[s.b];
      // Đồi thoai thoải. Vách đá granit gồ ghề hơn hẳn, sa mạc thì lượn sóng dài.
      let lift = (Math.sin(s.x * 0.35) + Math.cos(s.z * 0.3)) * 0.22;
      if (s.b === 'crags') lift += Math.abs(Math.sin(s.x * 0.8 + s.z * 0.6)) * 1.5;
      if (s.b === 'desert') lift += Math.sin(s.x * 0.22 + s.z * 0.18) * 0.7;
      if (s.b === 'highlands') lift += Math.cos(s.x * 0.5) * 0.35;
      m.makeTranslation(s.x, -0.6 + lift, s.z);
      mesh.setMatrixAt(i, m);
      const mix = (Math.sin(s.x * 1.1) + Math.cos(s.z * 1.4) + 2) / 4;
      mesh.setColorAt(i, c.setHex(biome.ground[mix > 0.5 ? 0 : 1]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);

    // Ba bậc vách đá dưới chân đảo, và vành nước quanh ngoài.
    let y = -1.2;
    for (const [w, h, color] of [
      [WORLD * 1.0, 2.6, PALETTE.cliffTop],
      [WORLD * 0.84, 3.2, PALETTE.cliffMid],
      [WORLD * 0.6, 4.0, PALETTE.cliffLow],
    ] as const) {
      const step = new THREE.Mesh(
        new THREE.CylinderGeometry(w / 2, w / 2 - 1.4, h, 6),
        new THREE.MeshLambertMaterial({ color, flatShading: true }));
      step.rotation.y = Math.PI / 6;
      step.position.y = y - h / 2;
      step.receiveShadow = true;
      this.group.add(step);
      y -= h;
    }
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(WORLD * 0.58, WORLD * 0.58, 0.6, 6),
      new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.55 }));
    rim.rotation.y = Math.PI / 6;
    rim.position.y = -8;
    rim.name = 'water';
    this.group.add(rim);
  }

  /** Bốn trục đường chính toả ra từ thủ phủ, cộng một vành đai. Xe thồ chạy trên đây. */
  private buildRoads(): void {
    const mat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
    const add = (w: number, d: number, x: number, z: number) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), mat);
      r.position.set(x, 0.04, z);
      r.receiveShadow = true;
      this.group.add(r);
    };
    add(2.4, HALF * 1.9, 0, 0);
    add(HALF * 1.9, 2.4, 0, 0);
    for (const r of [13, 24]) {
      add(2 * r, 1.8, 0, -r);
      add(2 * r, 1.8, 0, r);
      add(1.8, 2 * r, -r, 0);
      add(1.8, 2 * r, r, 0);
    }
  }

  // ---------------------------------------------------------------- mỏ

  /**
   * Rải mỏ theo biến sinh thái, bằng số giả ngẫu nhiên có hạt giống. Thế giới vì thế giống
   * hệt nhau ở mọi lần mở mà không phải lưu một byte toạ độ nào — bản lưu chỉ cần nhớ ô sương
   * nào đã vén.
   */
  private generateNodes(): void {
    const r = rng(0x1a7ba1);
    const plan: [BiomeId, number][] = [
      ['meadow', 26], ['crags', 16], ['desert', 14], ['highlands', 12],
    ];
    for (const [biome, count] of plan) {
      let placed = 0;
      let guard = 0;
      while (placed < count && guard < count * 60) {
        guard += 1;
        const x = (r() - 0.5) * WORLD * 0.92;
        const z = (r() - 0.5) * WORLD * 0.92;
        if (biomeAt(x, z) !== biome) continue;
        if (Math.hypot(x, z) < 8) continue;                  // chừa quảng trường thủ phủ
        if (Math.abs(x) < 2.2 || Math.abs(z) < 2.2) continue; // không nằm đè lên đường trục
        if (PLOTS.some((p) => Math.hypot(p.pos[0] - x, p.pos[1] - z) < 5)) continue;
        if (this.nodes.some((n) => Math.hypot(n.position[0] - x, n.position[2] - z) < 4.2)) continue;

        const pick = r();
        let kind: ResourceNode['kind'] = 'wood';
        let shape: ResourceNode['shape'] = 'pine';
        let richness = 1;
        if (biome === 'meadow') {
          if (pick < 0.6) { kind = 'wood'; shape = 'pine'; }
          else { kind = 'food'; shape = 'wheat'; }
        } else if (biome === 'crags') {
          if (pick < 0.7) { kind = 'stone'; shape = 'quarry'; }
          else { kind = 'stone'; shape = 'iron'; richness = 1.6; }
        } else if (biome === 'desert') {
          kind = 'gold'; shape = 'dune_gold'; richness = 0.55;
        } else {
          kind = 'relics'; shape = 'spire'; richness = 0.3;
        }
        this.nodes.push({
          id: `n${this.nodes.length}`, kind, shape, biome, richness,
          position: [x, 0, z],
        });
        placed += 1;
      }
    }
  }

  // ------------------------------------------------------------------ props

  /**
   * Dựng toàn bộ cây cối, đá, mỏ. Mỗi KIỂU hình một InstancedMesh, nên dù có bao nhiêu cái
   * thì vẫn chỉ ngần ấy lệnh vẽ.
   */
  private buildProps(): void {
    const specs: Record<string, PropSpec> = {
      pine: { geometry: this.pineGeometry(), material: new THREE.MeshLambertMaterial({ flatShading: true }), castShadow: true },
      wheat: { geometry: this.wheatGeometry(), material: new THREE.MeshLambertMaterial({ flatShading: true }), castShadow: true },
      rock: { geometry: new THREE.DodecahedronGeometry(1, 0), material: new THREE.MeshLambertMaterial({ flatShading: true }), castShadow: true },
      ore: {
        geometry: new THREE.OctahedronGeometry(0.75, 0),
        material: new THREE.MeshStandardMaterial({
          roughness: 0.25, metalness: 0.15, emissive: 0xffffff, emissiveIntensity: 0.0,
          vertexColors: false,
        }),
        castShadow: true,
      },
      spire: {
        geometry: this.spireGeometry(),
        material: new THREE.MeshStandardMaterial({
          color: 0xffffff, roughness: 0.2, metalness: 0.1,
          emissive: PALETTE.crystal, emissiveIntensity: 0.55,
        }),
        castShadow: true,
      },
      palm: { geometry: this.palmGeometry(), material: new THREE.MeshLambertMaterial({ flatShading: true }), castShadow: true },
      tuft: { geometry: new THREE.ConeGeometry(0.22, 0.5, 4), material: new THREE.MeshLambertMaterial(), castShadow: false },
    };

    // Gom trước: mỗi kiểu một danh sách biến đổi, rồi mới dựng InstancedMesh một lần.
    const batches: Record<string, { m: THREE.Matrix4; c: THREE.Color }[]> = {};
    const push = (key: string, pos: Vec3, scale: number, rotY: number, color: number) => {
      (batches[key] ??= []).push({
        m: new THREE.Matrix4().compose(
          new THREE.Vector3(pos[0], pos[1], pos[2]),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
          new THREE.Vector3(scale, scale, scale)),
        c: new THREE.Color(color),
      });
    };

    const r = rng(0x5eed42);
    for (const node of this.nodes) {
      const [x, , z] = node.position;
      switch (node.shape) {
        case 'pine':
          // Rừng rậm: mỗi mỏ là một cụm 4-6 cây, cao thấp khác nhau.
          for (let i = 0; i < 4 + Math.floor(r() * 3); i += 1) {
            const a = r() * Math.PI * 2;
            const d = r() * 2.1;
            push('pine', [x + Math.cos(a) * d, 0, z + Math.sin(a) * d],
              0.8 + r() * 0.5, r() * 3, PALETTE.pine[Math.floor(r() * 3)]);
          }
          break;
        case 'wheat':
          for (let i = 0; i < 5; i += 1) {
            const a = (i / 5) * Math.PI * 2 + r();
            push('wheat', [x + Math.cos(a) * 1.5, 0, z + Math.sin(a) * 1.5],
              0.85 + r() * 0.35, r() * 3, r() < 0.3 ? PALETTE.berry : PALETTE.wheat);
          }
          break;
        case 'quarry':
        case 'iron':
          for (let i = 0; i < 4; i += 1) {
            const a = r() * Math.PI * 2;
            const d = r() * 1.7;
            push('rock', [x + Math.cos(a) * d, 0.35 + r() * 0.3, z + Math.sin(a) * d],
              0.45 + r() * 0.55, r() * 3,
              node.shape === 'iron' ? PALETTE.iron : (r() < 0.5 ? PALETTE.granite : PALETTE.graniteDark));
          }
          break;
        case 'dune_gold':
          for (let i = 0; i < 3; i += 1) {
            const a = r() * Math.PI * 2;
            push('rock', [x + Math.cos(a) * 1.2, 0.3, z + Math.sin(a) * 1.2],
              0.4 + r() * 0.3, r() * 3, PALETTE.sand);
          }
          for (let i = 0; i < 3; i += 1) {
            push('ore', [x + (r() - 0.5) * 1.6, 0.75 + r() * 0.5, z + (r() - 0.5) * 1.6],
              0.4 + r() * 0.3, r() * 3, PALETTE.goldOre);
          }
          break;
        case 'spire':
          for (let i = 0; i < 3; i += 1) {
            push('spire', [x + (r() - 0.5) * 2.2, 0, z + (r() - 0.5) * 2.2],
              0.7 + r() * 0.8, r() * 3, PALETTE.crystal);
          }
          break;
      }
    }

    // Cây cọ và xương rồng rải khắp sa mạc; bụi cỏ rải khắp đồng cỏ. Thuần tuý trang trí,
    // nhưng chính chúng làm thế giới hết trống trải — và chúng miễn phí vì đã gom chung.
    for (let i = 0; i < 1400; i += 1) {
      const x = (r() - 0.5) * WORLD * 0.95;
      const z = (r() - 0.5) * WORLD * 0.95;
      const soft = Math.max(Math.abs(x), Math.abs(z)) * 0.68 + Math.hypot(x, z) * 0.32;
      if (soft > HALF - 1.5) continue;
      if (Math.abs(x) < 1.8 || Math.abs(z) < 1.8) continue;
      const b = biomeAt(x, z);
      if (b === 'desert') {
        if (r() < 0.12) push('palm', [x, 0, z], 0.8 + r() * 0.5, r() * 3, r() < 0.5 ? PALETTE.palm : PALETTE.cactus);
      } else if (b === 'meadow') {
        push('tuft', [x, 0.1, z], 0.6 + r() * 0.7, r() * 3, r() < 0.5 ? 0x62aa4e : 0x6fbb57);
      } else if (b === 'highlands') {
        if (r() < 0.4) push('tuft', [x, 0.1, z], 0.5 + r() * 0.6, r() * 3, r() < 0.5 ? 0x5b4bb0 : 0x6f5fd0);
      } else if (r() < 0.25) {
        push('rock', [x, 0.15, z], 0.16 + r() * 0.16, r() * 3, PALETTE.graniteDark);
      }
    }

    for (const [key, list] of Object.entries(batches)) {
      const spec = specs[key];
      if (!spec || list.length === 0) continue;
      const mesh = new THREE.InstancedMesh(spec.geometry, spec.material, list.length);
      mesh.castShadow = spec.castShadow;
      mesh.receiveShadow = false;
      list.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        mesh.setColorAt(i, it.c);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.name = `prop-${key}`;
      this.group.add(mesh);
      this.owned.push(mesh);
      if (key === 'spire') this.spires = mesh;
    }
  }

  // -------------------------------------------------- hình học đã hàn sẵn

  /**
   * Cây thông: thân cộng ba tán, HÀN thành một hình học.
   *
   * Không hàn thì một cây là bốn lệnh vẽ, và cả việc gom instancing mất ý nghĩa: bốn trăm cây
   * thành một nghìn sáu trăm lệnh vẽ thay vì một.
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
    const side2 = new THREE.ConeGeometry(0.24, 1.3, 5);
    side2.translate(-0.45, 0.65, -0.3);
    parts.push(side2);
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

  // ------------------------------------------------------------------ chạy

  /** Trụ pha lê xoay nhẹ. Chỉ đụng tới khi camera đang nhìn về phía cao nguyên. */
  update(dt: number, cameraTarget: THREE.Vector3): void {
    if (!this.spires) return;
    // Cao nguyên nằm ở phía bắc; camera quay đi chỗ khác thì khỏi cập nhật ma trận làm gì.
    if (cameraTarget.z > 6) return;
    this.spires.rotation.y += dt * 0.12;
  }

  nodeById(id: string): ResourceNode | undefined {
    return this.nodes.find((n) => n.id === id);
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    });
  }
}
