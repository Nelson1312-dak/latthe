/**
 * Kinh tế: kho hàng, chuỗi chế biến, chợ, giá cả, và tiền kiếm được lúc không nhìn màn hình.
 *
 * Dòng chảy một vòng:
 *
 *     cây/mỏ --(thợ đào)--> KHO (gỗ, đá, pha lê)
 *                            │
 *                            ├─(xưởng cưa tự rút)─> đống ván chờ tại xưởng
 *                            └─(lò gạch tự rút)──> đống gạch chờ tại lò
 *                                                    │
 *                                        (thợ chở hàng)
 *                                                    ↓
 *                            KHO (ván, gạch) ──(chợ bán dần)──> XU
 *
 * Ba nút thắt nằm nối tiếp nhau, và đó là chỗ game có gì để nghĩ: thợ đào ít thì xưởng đói,
 * thợ chở ít thì đống hàng ở xưởng đầy và xưởng DỪNG, chợ cấp thấp thì hàng ùn trong kho.
 * Nâng sai chỗ là tiền không tăng — khác hẳn bản một tài nguyên, nâng gì cũng có lợi.
 *
 * TIỀN LÚC VẮNG MẶT: không dùng công thức. Xem collectOffline().
 */
import {
  AUTOSAVE_INTERVAL_MS, BASE_STORAGE, BUFFER_PER_LEVEL, BUILDINGS, HOUSING_PER_HUT_LEVEL,
  LEVELS_PER_PLAYER_LEVEL, MAX_TIER, PROCESS_RESERVE, RECIPES, RESOURCES, SELL_RESERVE,
  SAVE_KEY, SELL_ORDER, STARTING_COINS, STORAGE_PER_WAREHOUSE_LEVEL, buildingCost, makeSlots,
  marketRate, processRate, resourceNodes, tierSpec,
} from './config';
import { rebuildNav } from './nav';
import { ECONOMY, EconomyMath } from './EconomyMath';
import type {
  BuildingType, Cost, GameState, OfflineReport, ResourceKind, ResourceNode, Slot, Vec3,
} from './types';
import { ALL_KINDS } from './types';

/** Hệ số làm mượt cho các con số "mỗi giây" hiện trên HUD. Nhỏ thì nhạy, lớn thì ổn định. */
const RATE_TAU = 3;

function freshState(): GameState {
  return {
    coins: STARTING_COINS,
    wood: 0, stone: 0, crystal: 0, planks: 0, bricks: 0,
    storageLimit: BASE_STORAGE,
    level: 1,
    slots: makeSlots(),
    workers: [],
    lastSavedTimestamp: Date.now(),
    muted: false,
    totalEarned: 0,
    workerSpeedLevel: 1,
    workerCapacityLevel: 1,
    allocation: { wood: 1, stone: 0, crystal: 0, isAuto: true },
    tier: 1,
  };
}

export class Economy {
  state: GameState;
  private timer: number | null = null;
  /** Ai đó vừa tiêu tiền hay xây nhà — để UI biết phải vẽ lại. */
  onChange: (() => void) | null = null;

  /** Con số "mỗi giây" cho HUD, làm mượt. Không lưu: dựng lại trong vài giây là đúng. */
  readonly rates: Record<ResourceKind, number> =
    { wood: 0, stone: 0, crystal: 0, planks: 0, bricks: 0 };
  coinRate = 0;
  /** Loại nào vừa chạm trần kho — để cảnh báo người chơi. */
  readonly fullKinds = new Set<ResourceKind>();

  private gained: Record<ResourceKind, number> =
    { wood: 0, stone: 0, crystal: 0, planks: 0, bricks: 0 };
  private coinsGained = 0;

  constructor(state: GameState) {
    this.state = state;
    rebuildNav(this.state.tier);
    this.recomputeStorage();
    if (this.state.workers.length === 0) this.addWorker();
    this.syncWorkerStats();
  }

  // ------------------------------------------------------------- lưu và đọc

  static load(): Economy {
    let state = freshState();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameState>;
        if (parsed && Array.isArray(parsed.slots) && typeof parsed.coins === 'number') {
          state = { ...freshState(), ...parsed } as GameState;
        }
      }
    } catch {
      /* bản lưu hỏng - chơi lại từ đầu */
    }
    return new Economy(state);
  }

  /** Phải là thuộc tính chứ không phải phương thức: beforeunload cần đúng một tham chiếu. */
  save = (): void => {
    this.state.lastSavedTimestamp = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch {
      /* hết chỗ hoặc bị chặn - cứ chơi tiếp */
    }
  };

  startAutosave(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(this.save, AUTOSAVE_INTERVAL_MS);
    window.addEventListener('beforeunload', this.save);
  }

  stopAutosave(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener('beforeunload', this.save);
  }

  reset(): void {
    this.state = freshState();
    rebuildNav(this.state.tier);
    this.recomputeStorage();
    this.addWorker();
    this.syncWorkerStats();
    this.save();
    this.onChange?.();
  }

  // ------------------------------------------------------------------- kho

  recomputeStorage(): void {
    this.state.storageLimit =
      BASE_STORAGE + this.sumLevels('warehouse') * STORAGE_PER_WAREHOUSE_LEVEL;
  }

  space(kind: ResourceKind): number {
    return Math.max(0, this.state.storageLimit - this.state[kind]);
  }

  isFull(kind: ResourceKind): boolean {
    return this.space(kind) <= 0.001;
  }

  /** Bỏ hàng vào kho, chặn ở trần. Trả về số THỰC SỰ vào được — phần thừa biến mất. */
  deposit(kind: ResourceKind, amount: number): number {
    const taken = Math.min(amount, this.space(kind));
    if (taken > 0) {
      this.state[kind] += taken;
      this.gained[kind] += taken;
    }
    if (this.isFull(kind)) this.fullKinds.add(kind);
    else this.fullKinds.delete(kind);
    return taken;
  }

  fillRatio(kind: ResourceKind): number {
    return this.state.storageLimit > 0 ? this.state[kind] / this.state.storageLimit : 1;
  }

  // ------------------------------------------------------- số liệu suy ra được

  recomputeLevel(): void {
    let total = 0;
    for (const s of this.state.slots) total += s.level;
    this.state.level = 1 + Math.floor(total / LEVELS_PER_PLAYER_LEVEL);
  }

  sumLevels(type: BuildingType): number {
    let n = 0;
    for (const s of this.visibleSlots()) if (s.type === type && s.state === 'CONSTRUCTED') n += s.level;
    return n;
  }

  /** Các xưởng đang hoạt động, dùng cho cả chế biến lẫn việc giữ nguyên liệu khỏi chợ. */
  processors(): Slot[] {
    return this.visibleSlots().filter(
      (s) => s.state === 'CONSTRUCTED' && RECIPES[s.type] !== undefined);
  }

  housing(): number {
    return this.sumLevels('hut') * HOUSING_PER_HUT_LEVEL;
  }

  workerCapacity(): number {
    return EconomyMath.getBuildingOutput(
      ECONOMY.baseOutput, ECONOMY.outputGrowthRate, this.state.workerCapacityLevel);
  }

  workerSpeed(): number {
    return EconomyMath.getWorkerSpeed(this.state.workerSpeedLevel);
  }

  marketLevel(): number {
    return this.state.slots.find((s) => s.id === 'core')?.level ?? 1;
  }

  afkCapSeconds(): number {
    return ECONOMY.maxAfkSeconds;
  }

  unlockedNodes(): ResourceNode[] {
    return resourceNodes(this.state.tier).filter((n) => n.unlockLevel <= this.state.level);
  }

  /** Ô đất đã thuộc lãnh thổ hiện tại. Ô của bậc chưa mở thì chưa tồn tại trên bản đồ. */
  visibleSlots(): Slot[] {
    return this.state.slots.filter((s) => s.tier <= this.state.tier);
  }

  /** Loại thô nào đã mở — quyết định hàng nào hiện trên bảng phân bổ thợ. */
  unlockedRaw(): ('wood' | 'stone' | 'crystal')[] {
    const seen = new Set(this.unlockedNodes().map((n) => n.kind));
    return (['wood', 'stone', 'crystal'] as const).filter((k) => seen.has(k));
  }

  // -------------------------------------------------------------- mỗi khung

  /**
   * Một nhịp của phần KHÔNG phải thợ: xưởng rút nguyên liệu, chợ bán hàng.
   *
   * Tách khỏi WorkerManager để đúng một hàm này chạy được cả lúc chơi thật lẫn lúc tua nhanh
   * bù giờ vắng mặt — nghĩa là con số trả cho người chơi không thể lệch với con số họ thấy
   * khi ngồi nhìn.
   */
  tick(dt: number): void {
    this.produce(dt);
    this.sell(dt);
    this.smoothRates(dt);
  }

  private produce(dt: number): void {
    for (const slot of this.processors()) {
      const recipe = RECIPES[slot.type];
      if (!recipe) continue;
      const bufferCap = BUFFER_PER_LEVEL * slot.level;
      const room = bufferCap - slot.buffer;
      if (room <= 0) continue;   // đống hàng đầy -> xưởng dừng, chờ thợ chở đi

      const want = processRate(slot.level) * dt;
      // Chừa lại một ít nguyên liệu thô: giá xây nào cũng đòi gỗ hoặc đá, mà xưởng ăn sạch
      // thì người chơi không xây được gì nữa.
      const spare = Math.max(0, this.state[recipe.from] - PROCESS_RESERVE);
      const limitedByInput = spare / recipe.ratio;
      const made = Math.min(want, room, limitedByInput);
      if (made <= 0) continue;

      this.state[recipe.from] -= made * recipe.ratio;
      slot.buffer += made;
      this.gained[recipe.to] += made;
    }
  }

  /**
   * Chợ bán dần phần DƯ của hàng chế biến và pha lê. Gỗ với đá không nằm trong danh sách bán:
   * chúng là vật liệu xây dựng, bán đi thì người chơi không bao giờ trả nổi những khoản giá
   * đòi nguyên liệu (mở ô từ thứ 5 đòi ván, mở bậc 3 đòi 250 gỗ).
   */
  private sell(dt: number): void {
    let left = marketRate(this.marketLevel()) * dt;
    for (const kind of SELL_ORDER) {
      if (left <= 0) break;
      const keep = SELL_RESERVE[kind] ?? 0;
      const take = Math.min(left, Math.max(0, this.state[kind] - keep));
      if (take <= 0) continue;
      this.state[kind] -= take;
      const coins = take * RESOURCES[kind].value;
      this.state.coins += coins;
      this.state.totalEarned += coins;
      this.coinsGained += coins;
      left -= take;
      this.fullKinds.delete(kind);
    }
  }

  private smoothRates(dt: number): void {
    const k = Math.min(1, dt / RATE_TAU);
    for (const kind of ALL_KINDS) {
      this.rates[kind] += (this.gained[kind] / Math.max(dt, 1e-6) - this.rates[kind]) * k;
      this.gained[kind] = 0;
    }
    this.coinRate += (this.coinsGained / Math.max(dt, 1e-6) - this.coinRate) * k;
    this.coinsGained = 0;
  }

  // ---------------------------------------------------------------- vắng mặt

  /**
   * Tiền cho quãng thời gian không nhìn màn hình — bằng cách TUA NHANH CHÍNH VÁN GAME, không
   * bằng công thức.
   *
   * Lý do: chuỗi sản xuất giờ có tiêu thụ và có trần kho, nên `tốc độ × thời gian` sẽ nói dối.
   * Thợ chất gỗ đầy kho rồi đứng im; xưởng hết chỗ chứa ván rồi dừng; chợ chỉ bán được chừng
   * ấy đơn mỗi giây. Một công thức khép kín cho đúng cả ba thứ đó vừa khó viết vừa sẽ lệch
   * dần mỗi lần ai đó sửa luật chơi.
   *
   * Chạy thật thì không thể lệch, vì nó dùng ĐÚNG đoạn mã chạy lúc người chơi đang nhìn.
   * Hai tiếng với bước 0,5 giây là 14.400 vòng — vài chục mili giây, không ai kịp thấy.
   */
  collectOffline(nowMs: number, stepWorkers: (dt: number) => void): OfflineReport | null {
    const elapsedSeconds = Math.max(0, (nowMs - this.state.lastSavedTimestamp) / 1000);
    this.state.lastSavedTimestamp = nowMs;
    if (elapsedSeconds < ECONOMY.minimumAfkThreshold) return null;

    const creditedSeconds = Math.min(elapsedSeconds, this.afkCapSeconds());
    const before = this.state.coins;
    const full = new Set<ResourceKind>();

    const STEP = 0.5;
    const steps = Math.floor(creditedSeconds / STEP);
    for (let i = 0; i < steps; i += 1) {
      stepWorkers(STEP);
      this.tick(STEP);
      for (const kind of this.fullKinds) full.add(kind);
    }

    // Hiệu suất vắng mặt áp lên phần KIẾM THÊM, không áp lên số dư sẵn có.
    const earned = this.state.coins - before;
    const kept = Math.floor(earned * ECONOMY.afkEfficiency);
    this.state.coins = before + kept;

    return {
      elapsedSeconds,
      creditedSeconds,
      coins: kept,
      capped: elapsedSeconds > this.afkCapSeconds(),
      full: [...full],
    };
  }

  // ----------------------------------------------------------------- giá cả

  addCoins(n: number): void {
    this.state.coins += n;
    this.state.totalEarned += n;
  }

  /** Thiếu những gì để trả được `cost`. Mảng rỗng nghĩa là đủ tiền đủ hàng. */
  missing(cost: Cost): { kind: 'coins' | ResourceKind; need: number; have: number }[] {
    const out: { kind: 'coins' | ResourceKind; need: number; have: number }[] = [];
    if (this.state.coins < cost.coins) out.push({ kind: 'coins', need: cost.coins, have: Math.floor(this.state.coins) });
    for (const kind of ALL_KINDS) {
      const need = cost[kind as keyof Cost] as number | undefined;
      if (need && this.state[kind] < need) out.push({ kind, need, have: Math.floor(this.state[kind]) });
    }
    return out;
  }

  canAfford(cost: Cost): boolean {
    return this.missing(cost).length === 0;
  }

  private pay(cost: Cost): boolean {
    if (!this.canAfford(cost)) return false;
    this.state.coins -= cost.coins;
    for (const kind of ALL_KINDS) {
      const need = cost[kind as keyof Cost] as number | undefined;
      if (need) this.state[kind] -= need;
    }
    return true;
  }

  /** Giá xây mới hoặc nâng cấp, tính theo TỔNG cấp của loại đó (xem config.buildingCost). */
  costForBuild(type: Exclude<BuildingType, 'none' | 'market'>): Cost {
    return buildingCost(this.sumLevels(type));
  }

  /** Giá lên cấp tiếp theo. null khi đã kịch cấp. */
  upgradeCost(slot: Slot): Cost | null {
    if (slot.type === 'none' || slot.state !== 'CONSTRUCTED') return null;
    if (slot.level >= BUILDINGS[slot.type].maxLevel) return null;
    return buildingCost(this.sumLevels(slot.type));
  }

  hireCost(): Cost {
    return { coins: EconomyMath.cost(ECONOMY.worker, this.state.workers.length) };
  }

  speedCost(): Cost {
    return { coins: EconomyMath.cost(ECONOMY.worker, this.state.workerSpeedLevel) };
  }

  capacityCost(): Cost {
    return { coins: EconomyMath.cost(ECONOMY.worker, this.state.workerCapacityLevel) };
  }

  canHire(): boolean {
    return this.state.workers.length < this.housing();
  }

  // ----------------------------------------------------------------- hành động

  // ------------------------------------------------------------ mở rộng đảo

  /** Bậc kế tiếp, hoặc null khi đã mở hết đảo. */
  nextTier() {
    return this.state.tier >= MAX_TIER ? null : tierSpec(this.state.tier + 1);
  }

  /**
   * Vì sao chưa mở rộng được: thiếu cấp, thiếu nguyên liệu, hay KHO QUÁ NHỎ.
   *
   * Cái thứ ba là một soft-lock thật, đã đo được: mở bậc 3 đòi 250 gỗ trong khi trần kho mặc
   * định là 150. Người chơi đủ cấp, gom cả ngày, kho đầy ở 150 và con số 250 không bao giờ
   * tới — mà màn hình chỉ hiện "150/250" nên không có cách nào đoán ra vấn đề nằm ở sức chứa.
   * Cổng này tự nó hợp lý (phải có Kho trước khi mở đất), chỉ cần nói thẳng ra.
   */
  expandBlockers(): {
    level: number | null;
    missing: ReturnType<Economy['missing']>;
    needStorage: number | null;
  } {
    const next = this.nextTier();
    if (!next) return { level: null, missing: [], needStorage: null };

    let needStorage: number | null = null;
    for (const kind of ALL_KINDS) {
      const need = next.cost[kind as keyof Cost] as number | undefined;
      if (need && need > this.state.storageLimit) needStorage = Math.max(needStorage ?? 0, need);
    }
    return {
      level: this.state.level < next.requiresLevel ? next.requiresLevel : null,
      missing: this.missing(next.cost),
      needStorage,
    };
  }

  canExpand(): boolean {
    const next = this.nextTier();
    if (!next) return false;
    const b = this.expandBlockers();
    return b.level === null && b.missing.length === 0;
  }

  /**
   * Mở bậc lãnh thổ. Phải dựng lại đồ thị đường đi NGAY, vì bậc 3 đẩy vành cây và mỏ ra xa:
   * bỏ bước này thì thợ đi theo quãng đường cũ tới chỗ mới và sẽ dừng giữa đồng trống.
   */
  expandTerritory(): boolean {
    const next = this.nextTier();
    if (!next || !this.canExpand() || !this.pay(next.cost)) return false;
    this.state.tier = next.tier;
    rebuildNav(this.state.tier);
    // Thợ đang trên đường tới mỏ cũ phải tính lại đường; thả việc là xong, khung sau nhận lại.
    for (const w of this.state.workers) {
      w.path = [];
      w.pathIndex = 0;
      w.targetId = null;
      w.state = 'idle';
    }
    this.after();
    return true;
  }

  unlock(slot: Slot): boolean {
    if (slot.tier > this.state.tier) return false;
    if (slot.state !== 'LOCKED' || !this.pay(slot.unlockCost)) return false;
    slot.state = 'UNLOCKED_EMPTY';
    this.after();
    return true;
  }

  build(slot: Slot, type: Exclude<BuildingType, 'none' | 'market'>): boolean {
    if (slot.state !== 'UNLOCKED_EMPTY' || !this.pay(this.costForBuild(type))) return false;
    slot.type = type;
    slot.level = 1;
    slot.state = 'CONSTRUCTED';
    slot.buffer = 0;
    this.after();
    return true;
  }

  upgrade(slot: Slot): boolean {
    const cost = this.upgradeCost(slot);
    if (cost === null || !this.pay(cost)) return false;
    slot.level += 1;
    this.after();
    return true;
  }

  hire(): boolean {
    if (!this.canHire() || !this.pay(this.hireCost())) return false;
    this.addWorker();
    this.after();
    return true;
  }

  trainSpeed(): boolean {
    if (!this.pay(this.speedCost())) return false;
    this.state.workerSpeedLevel += 1;
    this.after();
    return true;
  }

  trainCapacity(): boolean {
    if (!this.pay(this.capacityCost())) return false;
    this.state.workerCapacityLevel += 1;
    this.after();
    return true;
  }

  private after(): void {
    this.recomputeLevel();
    this.recomputeStorage();
    this.syncWorkerStats();
    this.save();
    this.onChange?.();
  }

  // ------------------------------------------------------------------- thợ

  private addWorker(): void {
    const home = this.homeForWorker(this.state.workers.length);
    this.state.workers.push({
      id: `w${this.state.workers.length}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'forester',
      speed: this.workerSpeed(),
      capacity: this.workerCapacity(),
      state: 'moving',
      targetId: null,
      path: ['hub'],
      pathIndex: 0,
      position: [home[0], 0, home[2]],
      carrying: 0,
      carryingKind: null,
      gatherTimer: 0,
    });
  }

  /**
   * Nâng Balo hay Giày thì mọi thợ ĐANG CHẠY cũng được hưởng ngay, không phải đợi chuyến sau.
   * Nếu không, người chơi bỏ tiền ra mà nhìn màn hình không đổi gì trong mười giây.
   */
  syncWorkerStats(): void {
    const capacity = this.workerCapacity();
    const speed = this.workerSpeed();
    for (const w of this.state.workers) {
      w.capacity = capacity;
      w.speed = speed;
    }
    const cap = this.housing();
    while (this.state.workers.length > cap && this.state.workers.length > 1) this.state.workers.pop();
  }

  private homeForWorker(index: number): Vec3 {
    let seen = 0;
    for (const s of this.state.slots) {
      if (s.type !== 'hut' || s.state !== 'CONSTRUCTED') continue;
      if (index < seen + s.level * HOUSING_PER_HUT_LEVEL) return s.position;
      seen += s.level * HOUSING_PER_HUT_LEVEL;
    }
    return [0, 0, 0];
  }
}
