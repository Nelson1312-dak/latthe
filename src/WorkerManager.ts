/**
 * Thợ: phân việc, đi lại theo lưới phố, và chạy vòng đào–vác–giao.
 *
 * HAI LOẠI VIỆC
 *
 *   Thợ đào   : cây/mỏ --> chợ, đổ nguyên liệu thô vào kho.
 *   Thợ chở   : xưởng --> chợ, mang hàng đã chế (ván, gạch) về kho.
 *
 * Hạn ngạch của người chơi chỉ nói về thợ ĐÀO. Thợ không nằm trong hạn ngạch nào sẽ đi chở
 * hàng — nên "thợ rảnh" không phải thợ đứng chơi mà là lực lượng hậu cần, và để rảnh quá
 * nhiều hay quá ít đều thấy hậu quả ngay: đống hàng ở xưởng đầy thì XƯỞNG DỪNG.
 *
 * VÒNG ĐỜI, đúng bốn trạng thái:
 *
 *     (mới thuê, đứng ở nhà) --> moving --> gathering --> delivering --> idle
 *                                  ^                                      |
 *                                  +------------ nhận việc mới -----------+
 *
 * Việc chỉ được chọn lại khi thợ đã ĐỔ HÀNG XONG ở chợ. Nhờ vậy đổi hạn ngạch giữa chừng
 * không làm ai bỏ dở chuyến đang vác — đúng như đặc tả: giảm Gỗ từ 2 xuống 1 thì đúng một
 * thợ gỗ sẽ đổi sang đá ở chuyến kế tiếp, không phải ngay lập tức.
 *
 * Điều hướng cố tình đơn giản: không tránh vật cản, không lái mượt, không A*. Lưới phố trong
 * config đã đặt sao cho không đoạn nào cắt qua nền nhà, nên đi thẳng từ ngã tư này sang ngã
 * tư kia là đủ.
 */
import * as THREE from 'three';
import { PALETTE, RECIPES, RESOURCES, slotWaypointId } from './config';
import type { Economy } from './Economy';
import { distance, pathLength, positionOf, shortestPath } from './nav';
import { ECONOMY } from './EconomyMath';
import type {
  RawKind, ResourceKind, ResourceNode, Slot, Vec3, Worker, WorkerAllocation,
} from './types';

/** Coi là tới nơi khi còn cách ngần này — tránh rung quanh đích vì bước nhảy của delta. */
const ARRIVE_EPSILON = 0.06;

/** Dưới ngần này đơn thì chưa bõ một chuyến chở hàng. */
const CARRY_WORTH_IT = 0.5;

/**
 * Tra mỏ theo mã. Dựng lại từ kinh tế mỗi lần hỏi vì vị trí mỏ ĐỔI khi mở rộng đảo — giữ một
 * bảng tĩnh ở đây là đúng kiểu lỗi chỉ lộ ra sau khi người chơi đã mở bậc 3.
 */

export class WorkerManager {
  private readonly scene: THREE.Scene;
  private readonly economy: Economy;
  private readonly meshes = new Map<string, THREE.Group>();
  private readonly geometry: {
    body: THREE.CapsuleGeometry; head: THREE.SphereGeometry; pack: THREE.BoxGeometry;
  };
  private readonly bodyMat: THREE.MeshLambertMaterial;
  private readonly packMats = new Map<ResourceKind, THREE.MeshLambertMaterial>();
  private elapsed = 0;

  private nodeById(): Map<string, ResourceNode> {
    return new Map(this.economy.unlockedNodes().map((n) => [n.id, n]));
  }

  constructor(scene: THREE.Scene, economy: Economy) {
    this.scene = scene;
    this.economy = economy;

    // Cỡ thợ chọn theo MÀN HÌNH chứ không theo tỉ lệ thật: bản đồ rộng 40 đơn vị nằm gọn
    // trong khoảng 700 điểm ảnh, nên thợ cao 0,3 đơn vị sẽ chỉ là năm sáu điểm ảnh. Mà ngắm
    // mấy người bé đi lại lại chính là thứ đáng xem nhất trong thể loại này.
    this.geometry = {
      body: new THREE.CapsuleGeometry(0.26, 0.42, 3, 8),
      head: new THREE.SphereGeometry(0.22, 8, 6),
      pack: new THREE.BoxGeometry(0.34, 0.34, 0.26),
    };
    this.bodyMat = new THREE.MeshLambertMaterial({ color: PALETTE.worker });
    for (const kind of Object.keys(RESOURCES) as ResourceKind[]) {
      this.packMats.set(kind, new THREE.MeshLambertMaterial({ color: RESOURCES[kind].color }));
    }
    this.sync();
  }

  // ------------------------------------------------------------- phân bổ

  get allocation(): WorkerAllocation {
    return this.economy.state.allocation;
  }

  /** Gọi mỗi khi người chơi bấm (+/-) hoặc gạt công tắc Tự cân. */
  setAllocation(next: Partial<WorkerAllocation>): void {
    const merged = { ...this.allocation, ...next };
    const total = this.economy.state.workers.length;
    for (const k of ['wood', 'stone', 'crystal'] as const) {
      merged[k] = Math.max(0, Math.floor(merged[k] || 0));
    }
    // Không cho đặt nhiều hơn số thợ đang có: cắt từ loại được sửa sau cùng trở về trước.
    let budget = total;
    for (const k of ['wood', 'stone', 'crystal'] as const) {
      merged[k] = Math.min(merged[k], Math.max(0, budget));
      budget -= merged[k];
    }
    this.economy.state.allocation = merged;
    this.rebalanceWorkerAssignments();
    this.economy.save();
  }

  /**
   * Thợ đang RẢNH thì nhận việc mới ngay. Thợ đang vác hàng thì không bị đụng tới — họ giao
   * xong mới đổi. Đó là lý do hàm này không hề đặt lại `targetId` của ai đang đi.
   */
  rebalanceWorkerAssignments(): void {
    for (const w of this.economy.state.workers) {
      if (w.state === 'idle') this.dispatch(w);
    }
  }

  /** Số thợ đang nhắm từng loại thô. Dùng để biết hạn ngạch nào còn thiếu người. */
  private counts(): Record<RawKind, number> {
    const out: Record<RawKind, number> = { wood: 0, stone: 0, crystal: 0 };
    for (const w of this.economy.state.workers) {
      const node = w.targetId ? this.nodeById().get(w.targetId) : undefined;
      if (node) out[node.kind] += 1;
    }
    return out;
  }

  /**
   * Loại tài nguyên mà thợ vừa giao hàng xong nên đi đào tiếp.
   *
   * Tự cân: chọn kho VƠI NHẤT theo tỉ lệ đầy, bỏ qua hẳn loại đã đầy — đào thêm vào một kho
   * đầy là ném đi công sức, vì phần thừa không vào kho được.
   * Thủ công: chọn loại đang thiếu người so với hạn ngạch.
   */
  getNextTargetResource(): RawKind | null {
    const available = this.economy.unlockedRaw().filter((k) => !this.economy.isFull(k));
    if (available.length === 0) return null;

    if (this.allocation.isAuto) {
      return available.reduce((min, k) =>
        this.economy.fillRatio(k) < this.economy.fillRatio(min) ? k : min);
    }
    return this.findUnderAllocatedResource(available);
  }

  private findUnderAllocatedResource(available: RawKind[]): RawKind | null {
    const have = this.counts();
    let best: RawKind | null = null;
    let bestDeficit = 0;
    for (const kind of available) {
      const deficit = this.allocation[kind] - have[kind];
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        best = kind;
      }
    }
    return best;
  }

  /**
   * Xưởng nào đang cần người chở hàng nhất. Ưu tiên đống nào to nhất, vì đống đầy là xưởng
   * đó dừng hẳn — tốn hơn nhiều so với việc chở chậm một chuyến.
   */
  private neediestProcessor(worker: Worker): Slot | null {
    const busy = new Set(
      this.economy.state.workers
        .filter((w) => w !== worker && w.role === 'carrier' && w.targetId)
        .map((w) => w.targetId as string));

    let best: Slot | null = null;
    for (const slot of this.economy.processors()) {
      if (slot.buffer < CARRY_WORTH_IT) continue;
      const recipe = RECIPES[slot.type];
      if (!recipe || this.economy.isFull(recipe.to)) continue;
      // Mỗi xưởng chỉ cần thêm người khi đống hàng vượt sức một người đang trên đường tới.
      if (busy.has(slot.id) && slot.buffer < worker.capacity * 2) continue;
      if (!best || slot.buffer > best.buffer) best = slot;
    }
    return best;
  }

  // --------------------------------------------------------------- mesh

  sync(): void {
    const alive = new Set<string>();
    for (const w of this.economy.state.workers) {
      alive.add(w.id);
      if (!this.meshes.has(w.id)) this.meshes.set(w.id, this.createMesh(w));
    }
    for (const [id, group] of this.meshes) {
      if (alive.has(id)) continue;
      this.scene.remove(group);
      this.meshes.delete(id);
    }
  }

  private createMesh(w: Worker): THREE.Group {
    const group = new THREE.Group();

    const body = new THREE.Mesh(this.geometry.body, this.bodyMat);
    body.position.y = 0.45;
    group.add(body);

    const head = new THREE.Mesh(this.geometry.head, this.bodyMat);
    head.position.y = 0.92;
    group.add(head);

    // Thùng hàng trên lưng. Đổi màu theo thứ đang vác, nên nhìn một cái là biết ai chở gì.
    const pack = new THREE.Mesh(this.geometry.pack, this.bodyMat);
    pack.position.set(0, 0.5, -0.26);
    pack.visible = false;
    pack.name = 'pack';
    group.add(pack);

    group.position.set(w.position[0], 0, w.position[2]);
    this.scene.add(group);
    return group;
  }

  // --------------------------------------------------------------- mô phỏng

  update(dt: number): void {
    this.elapsed += dt;
    for (const w of this.economy.state.workers) {
      this.step(w, dt);
      this.draw(w);
    }
  }

  private step(w: Worker, dt: number): void {
    switch (w.state) {
      case 'idle':
        this.dispatch(w);
        break;

      case 'moving':
        if (this.advance(w, dt)) this.onArrive(w);
        break;

      case 'gathering':
        w.gatherTimer -= dt;
        if (w.gatherTimer <= 0) this.finishGathering(w);
        break;

      case 'delivering':
        if (this.advance(w, dt)) this.dropOff(w);
        break;
    }
  }

  /** Giao việc mới. Chở hàng được xét trước, vì đống hàng đầy làm xưởng dừng hẳn. */
  private dispatch(w: Worker): void {
    const from = this.nearestGraphId(w.position);

    const shop = this.neediestProcessor(w);
    if (shop) {
      w.role = 'carrier';
      w.targetId = shop.id;
      w.path = shortestPath(from, slotWaypointId(shop.id));
      w.pathIndex = 0;
      w.state = 'moving';
      if (w.path.length === 0) this.onArrive(w);
      return;
    }

    const kind = this.getNextTargetResource();
    if (!kind) {
      // Không có gì để làm: kho đầy hết và không xưởng nào cần chở. Đứng nghỉ ở chợ.
      w.targetId = null;
      w.role = 'carrier';
      return;
    }

    const node = this.pickNode(w, kind);
    if (!node) return;
    w.role = kind === 'wood' ? 'forester' : 'miner';
    w.targetId = node.id;
    w.path = shortestPath(from, node.id);
    w.pathIndex = 0;
    w.state = 'moving';
    if (w.path.length === 0) this.onArrive(w);
  }

  /**
   * Chọn mỏ nào trong số các mỏ cùng loại. Chia theo thứ tự thợ chứ không phải lúc nào cũng
   * lấy mỏ gần nhất: để cả đám chọn chung một mỏ thì chúng xuất phát cùng lúc, đi cùng tốc
   * độ và chồng khít lên nhau — ba người thợ nhìn ra đúng một người.
   *
   * Nhưng phải SẮP THEO KHOẢNG CÁCH trước khi chia. Lấy thứ tự khai báo trong config thì thợ
   * đầu tiên nhận mỏ gỗ ở góc tây bắc, xa 30,5 đơn vị, trong khi có mỏ ngay trên trục chỉ
   * cách 16,5 — đo ra đúng một nửa thu nhập đáng lẽ phải có, và không ai nhìn màn hình mà
   * đoán được vì sao.
   */
  private pickNode(w: Worker, kind: RawKind): ResourceNode | null {
    const nodes = this.economy.unlockedNodes()
      .filter((n) => n.kind === kind)
      .sort((a, b) =>
        pathLength('hub', shortestPath('hub', a.id)) - pathLength('hub', shortestPath('hub', b.id)));
    if (nodes.length === 0) return null;
    const index = Math.max(0, this.economy.state.workers.indexOf(w));
    return nodes[index % nodes.length];
  }

  private onArrive(w: Worker): void {
    if (w.role === 'carrier' && w.targetId) {
      const slot = this.economy.state.slots.find((s) => s.id === w.targetId);
      const recipe = slot ? RECIPES[slot.type] : undefined;
      if (!slot || !recipe || slot.buffer <= 0) {
        w.state = 'idle';           // ai đó chở mất rồi, tìm việc khác
        w.targetId = null;
        return;
      }
      const take = Math.min(w.capacity, slot.buffer);
      slot.buffer -= take;
      w.carrying = take;
      w.carryingKind = recipe.to;
      w.state = 'delivering';
      w.path = shortestPath(slotWaypointId(slot.id), 'hub');
      w.pathIndex = 0;
      return;
    }

    if (w.targetId && this.nodeById().has(w.targetId)) {
      w.state = 'gathering';
      w.gatherTimer = ECONOMY.gatheringDuration;
      return;
    }
    w.state = 'idle';               // vừa đi từ nhà về chợ xong
  }

  private finishGathering(w: Worker): void {
    const node = w.targetId ? this.nodeById().get(w.targetId) : undefined;
    w.carrying = w.capacity;
    w.carryingKind = node ? node.kind : 'wood';
    w.state = 'delivering';
    w.path = shortestPath(w.targetId ?? 'hub', 'hub');
    w.pathIndex = 0;
  }

  private dropOff(w: Worker): void {
    if (w.carryingKind && w.carrying > 0) {
      // deposit() tự chặn ở trần kho; phần không vào được coi như bỏ lại, và lần giao việc
      // ngay sau đây sẽ thấy kho đầy mà chuyển thợ sang loại khác.
      this.economy.deposit(w.carryingKind, w.carrying);
    }
    w.carrying = 0;
    w.carryingKind = null;
    w.state = 'idle';
    w.targetId = null;
  }

  /**
   * Nhích thợ dọc `path`. Trả về true khi đã đi hết đường.
   *
   * Dùng vòng while vì một khung hình dài có thể vượt qua nhiều chặng ngắn cùng lúc; nếu chỉ
   * xử lý một chặng mỗi khung hình thì sau một lần giật, thợ sẽ lết chậm lại đúng bằng số
   * chặng bị dồn. Chuyện này không phải lý thuyết: lúc tua bù giờ vắng mặt, bước là 0,5 giây.
   */
  private advance(w: Worker, dt: number): boolean {
    let budget = w.speed * dt;
    while (budget > 0) {
      if (w.pathIndex >= w.path.length) return true;
      let target: Vec3;
      try {
        target = positionOf(w.path[w.pathIndex]);
      } catch {
        // Đường trỏ tới điểm không còn tồn tại (đổi bố cục giữa hai bản lưu). Thả việc chứ
        // không để thợ kẹt vĩnh viễn.
        w.path = [];
        w.pathIndex = 0;
        w.targetId = null;
        w.state = 'idle';
        return false;
      }
      const dx = target[0] - w.position[0];
      const dz = target[2] - w.position[2];
      const dist = Math.hypot(dx, dz);

      if (dist <= budget + ARRIVE_EPSILON) {
        w.position[0] = target[0];
        w.position[2] = target[2];
        w.pathIndex += 1;
        budget -= dist;
        continue;
      }
      w.position[0] += (dx / dist) * budget;
      w.position[2] += (dz / dist) * budget;
      const group = this.meshes.get(w.id);
      if (group) group.rotation.y = Math.atan2(dx, dz);
      return false;
    }
    return w.pathIndex >= w.path.length;
  }

  /** Điểm trong đồ thị gần thợ nhất — dùng khi giao việc cho thợ đang đứng giữa đường. */
  private nearestGraphId(pos: Vec3): string {
    let best = 'hub';
    let bestDist = distance(pos, positionOf('hub'));
    for (const node of this.economy.unlockedNodes()) {
      const d = distance(pos, node.position);
      if (d < bestDist) { bestDist = d; best = node.id; }
    }
    for (const slot of this.economy.visibleSlots()) {
      if (slot.id === 'core') continue;
      const d = distance(pos, slot.position);
      if (d < bestDist) { bestDist = d; best = slotWaypointId(slot.id); }
    }
    return best;
  }

  // ------------------------------------------------------------------- vẽ

  private draw(w: Worker): void {
    const group = this.meshes.get(w.id);
    if (!group) return;

    // Lệch làn. Thợ cùng chỗ đào xuất phát cùng lúc và đi cùng tốc độ nên toạ độ TRÙNG KHÍT;
    // đẩy mỗi thợ sang ngang một chút là đủ tách thành hàng nối đuôi. Thuần tuý chuyện nhìn:
    // không đụng vào w.position nên không ảnh hưởng quãng đường hay thu nhập.
    const lane = this.laneOf(w.id);
    const rot = group.rotation.y;
    group.position.x = w.position[0] + Math.cos(rot) * lane;
    group.position.z = w.position[2] - Math.sin(rot) * lane;

    const walking = w.state === 'moving' || w.state === 'delivering';
    const phase = w.id.charCodeAt(w.id.length - 1);
    group.position.y = walking ? Math.abs(Math.sin(this.elapsed * 7 + phase)) * 0.07 : 0;

    const pack = group.getObjectByName('pack') as THREE.Mesh | undefined;
    if (pack) {
      pack.visible = w.carrying > 0 && w.carryingKind !== null;
      if (pack.visible && w.carryingKind) {
        pack.material = this.packMats.get(w.carryingKind) ?? this.bodyMat;
      }
    }
  }

  /** Làn cố định suy từ mã thợ, nằm trong ±0,35 — vừa đủ tách người mà không ai ra khỏi phố. */
  private laneOf(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
    return (((h % 5) + 5) % 5) * 0.175 - 0.35;
  }

  dispose(): void {
    for (const group of this.meshes.values()) this.scene.remove(group);
    this.meshes.clear();
    this.geometry.body.dispose();
    this.geometry.head.dispose();
    this.geometry.pack.dispose();
    this.bodyMat.dispose();
    for (const m of this.packMats.values()) m.dispose();
  }
}
