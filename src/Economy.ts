/**
 * Kinh tế: kho năm loại, công trình, trạm trung chuyển, và tiền kiếm được lúc vắng mặt.
 *
 * Vàng vừa là tài nguyên vừa là TIỀN. Gom hai thứ làm một vì bản đặc tả đặt 🪙 cho vàng; để
 * song song cả vàng lẫn một đồng xu riêng thì người chơi phải nhớ hai thang giá trị chẳng vì
 * lý do gì, mà sa mạc đằng nào cũng đã là nguồn thu chính.
 *
 * TIỀN LÚC VẮNG MẶT không tính bằng công thức — xem collectOffline().
 */
import {
  AFK_CAP_SECONDS, AFK_EFFICIENCY, AFK_MIN_SECONDS, AUTOSAVE_INTERVAL_MS, BASE_CAPACITY,
  BASE_SPEED, BASE_STORAGE, BUILDINGS, BUILD_COST, CAPACITY_PER_LEVEL, COST_GROWTH,
  BUILD_MIN_LEVEL, HIRE_COST, HIRE_GROWTH, HOUSING_FROM_TOWNHALL, HOUSING_PER_HOUSE,
  PLOTS, RESOURCES, SURPLUS_RATE_PER_LEVEL, SURPLUS_THRESHOLD, SAVE_KEY, SPEED_PER_LEVEL, STARTING,
  STORAGE_PER_GRANARY, TRAIN_COST, TRAIN_GROWTH, biomeAt,
} from './config';
import type {
  Building, BuildingType, Cost, GameState, Inventory, OfflineReport, ResourceKind, Unit,
} from './types';
import { RESOURCE_KINDS } from './types';

/**
 * Hang so lam muot con so "moi giay" tren HUD.
 *
 * De 3 thi so nhay loan va rat hay doc ra +0,0: hang ve kho theo tung chuyen chu khong deu
 * dan, nen giua hai chuyen gia tri tut ve khong. Tam giay la du dai de bat trung mot vai
 * chuyen, ma van phan ung kip khi nguoi choi thue them dan.
 */
const RATE_TAU = 8;

function emptyInv(): Inventory {
  return { food: 0, wood: 0, gold: 0, stone: 0, relics: 0 };
}

function freshState(): GameState {
  const core = PLOTS.find((p) => p.kind === 'core')!;
  return {
    inv: { ...STARTING },
    storageLimit: BASE_STORAGE,
    level: 1,
    buildings: [{
      id: 'core', type: 'townhall', level: 1,
      position: [core.pos[0], 0, core.pos[1]], biome: 'meadow',
      stock: {}, cartTimer: 0,
    }],
    units: [],
    // Bốn ô giữa mở sẵn, đủ để nhìn thấy thủ phủ và vài mỏ quanh đó; phần còn lại là mây.
    revealed: ['c2_2', 'c3_2', 'c2_3', 'c3_3'],
    lastSavedTimestamp: Date.now(),
    muted: false,
    totalGold: 0,
    speedLevel: 1,
    capacityLevel: 1,
    demand: null,
    focusNodeId: null,
    speedMult: 1,
  };
}

export class Economy {
  state: GameState;
  private timer: number | null = null;
  onChange: (() => void) | null = null;

  readonly rates: Inventory = emptyInv();
  readonly fullKinds = new Set<ResourceKind>();
  private gained: Inventory = emptyInv();

  constructor(state: GameState) {
    this.state = state;
    this.recompute();
  }

  // ------------------------------------------------------------- lưu và đọc

  /**
   * Đọc bản lưu, trộn SÂU ở phần kho.
   *
   * Trộn nông (`{...fresh, ...parsed}`) từng gây một lỗi khó thấy: bản lưu của phiên bản cũ
   * chỉ có gỗ/đá/pha lê, nên nó thay nguyên cục `inv` và `food` với `relics` thành undefined.
   * Từ đó mọi phép cộng ra NaN, và NaN lan sang cả chỗ hiển thị vàng — người chơi thấy
   * "undefined" mà không biết nó đến từ đâu. Giờ từng loại được điền khuyết riêng.
   */
  static load(): Economy {
    let state = freshState();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameState>;
        if (parsed && Array.isArray(parsed.buildings)) {
          const base = freshState();
          state = { ...base, ...parsed } as GameState;
          state.inv = { ...base.inv };
          for (const k of RESOURCE_KINDS) {
            const v = Number(parsed.inv?.[k]);
            state.inv[k] = Number.isFinite(v) ? v : 0;
          }
          // Mấy trường thêm về sau có thể thiếu hẳn trong bản lưu cũ.
          state.speedMult = parsed.speedMult === 2 ? 2 : 1;
          state.demand = parsed.demand ?? null;
          state.focusNodeId = parsed.focusNodeId ?? null;
          state.storageLimit = Number(parsed.storageLimit) || base.storageLimit;
          state.totalGold = Number(parsed.totalGold) || 0;
        }
      }
    } catch {
      /* bản lưu hỏng - chơi lại từ đầu */
    }
    return new Economy(state);
  }

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

  /** Goi lai khi lam lai tu dau. WorkerManager dua vao day de sinh lai nguoi dan dau tien. */
  onReset: (() => void) | null = null;

  reset(): void {
    this.state = freshState();
    this.recompute();
    // Khong co ai thi man hinh dung im va nguoi choi khong hieu game dang cho gi.
    this.onReset?.();
    this.save();
    this.onChange?.();
  }

  // ------------------------------------------------------------------- kho

  recompute(): void {
    this.state.storageLimit = BASE_STORAGE + this.sumLevels('granary') * STORAGE_PER_GRANARY;
    let total = 0;
    for (const b of this.state.buildings) total += b.level;
    this.state.level = 1 + Math.floor(total / 3);
    const cap = this.capacity();
    const spd = this.speed();
    for (const u of this.state.units) {
      if (u.kind === 'cart') continue;
      u.capacity = cap;
      u.speed = spd;
    }
  }

  sumLevels(type: BuildingType): number {
    let n = 0;
    for (const b of this.state.buildings) if (b.type === type) n += b.level;
    return n;
  }

  space(kind: ResourceKind): number {
    return Math.max(0, this.state.storageLimit - this.state.inv[kind]);
  }

  isFull(kind: ResourceKind): boolean {
    return this.space(kind) <= 0.001;
  }

  fillRatio(kind: ResourceKind): number {
    return this.state.inv[kind] / Math.max(1, this.state.storageLimit);
  }

  /** Bỏ hàng vào kho chính, chặn ở trần. Trả về số thực sự vào được. */
  deposit(kind: ResourceKind, amount: number): number {
    const taken = Math.min(amount, this.space(kind));
    if (taken > 0) {
      this.state.inv[kind] += taken;
      this.gained[kind] += taken;
      if (kind === 'gold') this.state.totalGold += taken;
    }
    if (this.isFull(kind)) this.fullKinds.add(kind);
    else this.fullKinds.delete(kind);
    return taken;
  }

  // ------------------------------------------------------- số liệu suy ra

  housing(): number {
    return this.sumLevels('townhall') * HOUSING_FROM_TOWNHALL
      + this.sumLevels('house') * HOUSING_PER_HOUSE;
  }

  villagers(): Unit[] {
    return this.state.units.filter((u) => u.kind === 'villager');
  }

  speed(): number {
    return BASE_SPEED * (1 + (this.state.speedLevel - 1) * SPEED_PER_LEVEL);
  }

  capacity(): number {
    return Math.floor(BASE_CAPACITY * (1 + (this.state.capacityLevel - 1) * CAPACITY_PER_LEVEL));
  }

  outposts(): Building[] {
    return this.state.buildings.filter((b) => b.type === 'outpost');
  }

  buildingAt(plotId: string): Building | undefined {
    return this.state.buildings.find((b) => b.id === plotId);
  }

  canHire(): boolean {
    return this.villagers().length < this.housing();
  }

  // ----------------------------------------------------------------- giá cả

  private scale(cost: Cost, growth: number, level: number): Cost {
    const out: Cost = {};
    for (const k of RESOURCE_KINDS) {
      const v = cost[k];
      if (v) out[k] = Math.floor(v * Math.pow(growth, Math.max(0, level)));
    }
    return out;
  }

  costFor(type: BuildingType, level: number): Cost {
    return this.scale(BUILD_COST[type], COST_GROWTH, level);
  }

  hireCost(): Cost {
    return this.scale(HIRE_COST, HIRE_GROWTH, this.villagers().length);
  }

  trainSpeedCost(): Cost {
    return this.scale(TRAIN_COST, TRAIN_GROWTH, this.state.speedLevel - 1);
  }

  trainCapacityCost(): Cost {
    return this.scale(TRAIN_COST, TRAIN_GROWTH, this.state.capacityLevel - 1);
  }

  missing(cost: Cost): { kind: ResourceKind; need: number; have: number }[] {
    const out: { kind: ResourceKind; need: number; have: number }[] = [];
    for (const k of RESOURCE_KINDS) {
      const need = cost[k];
      if (need && this.state.inv[k] < need) {
        out.push({ kind: k, need, have: Math.floor(this.state.inv[k]) });
      }
    }
    return out;
  }

  canAfford(cost: Cost): boolean {
    return this.missing(cost).length === 0;
  }

  private pay(cost: Cost): boolean {
    if (!this.canAfford(cost)) return false;
    for (const k of RESOURCE_KINDS) if (cost[k]) this.state.inv[k] -= cost[k] as number;
    return true;
  }

  // ----------------------------------------------------------------- hành động

  // --------------------------------------------------- nhu cầu xây dựng

  /**
   * Người chơi bấm xây hay nâng cấp mà chưa đủ vật liệu: thay vì chỉ báo nút xám, ghi lại
   * thành một ĐƠN HÀNG rồi cả làng quay sang gom đúng thứ còn thiếu. Đủ thì tự xoá.
   */
  setDemand(cost: Cost, label: string): void {
    this.state.demand = { cost, label };
    this.save();
    this.onChange?.();
  }

  clearDemand(): void {
    if (!this.state.demand) return;
    this.state.demand = null;
    this.save();
    this.onChange?.();
  }

  /** Những loại còn thiếu cho đơn hàng đang mở. Rỗng nghĩa là gom đủ rồi. */
  demandKinds(): ResourceKind[] {
    const d = this.state.demand;
    if (!d) return [];
    return this.missing(d.cost).map((m) => m.kind);
  }

  /** Gọi mỗi khung: đơn hàng đã đủ thì thôi giữ, để dân quay lại tự cân. */
  checkDemand(): void {
    if (this.state.demand && this.demandKinds().length === 0) this.clearDemand();
  }

  build(plotId: string, type: BuildingType): boolean {
    const plot = PLOTS.find((p) => p.id === plotId);
    if (!plot || this.buildingAt(plotId)) return false;
    if (type === 'outpost' && plot.kind !== 'outpost') return false;
    if (type !== 'outpost' && plot.kind === 'outpost') return false;
    if (this.state.level < (BUILD_MIN_LEVEL[type] ?? 0)) return false;
    if (!this.pay(this.costFor(type, 0))) return false;

    this.state.buildings.push({
      id: plotId, type, level: 1,
      position: [plot.pos[0], 0, plot.pos[1]],
      biome: biomeAt(plot.pos[0], plot.pos[1]),
      stock: {}, cartTimer: 0,
    });
    this.state.demand = null;
    this.after();
    return true;
  }

  upgrade(b: Building): boolean {
    if (b.level >= BUILDINGS[b.type].maxLevel) return false;
    if (!this.pay(this.costFor(b.type, b.level))) return false;
    b.level += 1;
    this.state.demand = null;
    this.after();
    return true;
  }

  hire(onSpawn: (home: Building) => void): boolean {
    if (!this.canHire() || !this.pay(this.hireCost())) return false;
    const house = this.state.buildings.find((x) => x.type === 'house')
      ?? this.state.buildings[0];
    onSpawn(house);
    this.after();
    return true;
  }

  trainSpeed(): boolean {
    if (!this.pay(this.trainSpeedCost())) return false;
    this.state.speedLevel += 1;
    this.after();
    return true;
  }

  trainCapacity(): boolean {
    if (!this.pay(this.trainCapacityCost())) return false;
    this.state.capacityLevel += 1;
    this.after();
    return true;
  }

  private after(): void {
    this.recompute();
    this.save();
    this.onChange?.();
  }

  // -------------------------------------------------------------- mỗi khung

  /**
   * Thủ phủ bán phần dư ra vàng. Chỉ bán thứ chất quá ngưỡng, nên không bao giờ moi mất số
   * nguyên liệu người chơi đang gom cho một công trình.
   */
  private sellSurplus(dt: number): void {
    const hall = this.state.buildings.find((b) => b.type === 'townhall');
    if (!hall) return;
    let left = SURPLUS_RATE_PER_LEVEL * hall.level * dt;
    const keep = this.state.storageLimit * SURPLUS_THRESHOLD;
    // Bán thứ đáng tiền trước, và không bao giờ bán chính vàng.
    for (const kind of ['relics', 'stone', 'food', 'wood'] as ResourceKind[]) {
      if (left <= 0) break;
      const take = Math.min(left, this.state.inv[kind] - keep);
      if (take <= 0) continue;
      this.state.inv[kind] -= take;
      this.deposit('gold', take * RESOURCES[kind].value);
      left -= take;
      this.fullKinds.delete(kind);
    }
  }

  tick(dt: number): void {
    this.checkDemand();
    this.sellSurplus(dt);
    const k = Math.min(1, dt / RATE_TAU);
    for (const kind of RESOURCE_KINDS) {
      this.rates[kind] += (this.gained[kind] / Math.max(dt, 1e-6) - this.rates[kind]) * k;
      this.gained[kind] = 0;
    }
  }

  // ---------------------------------------------------------------- vắng mặt

  /**
   * Bù giờ bằng cách TUA NHANH CHÍNH VÁN GAME, không bằng công thức.
   *
   * Lý do: có trần kho, có trạm gom hàng rồi mới chở về, có đoàn xe chạy theo chu kỳ. Một
   * công thức `tốc độ × thời gian` sẽ nói dối ở cả ba chỗ đó, và sẽ lệch thêm mỗi lần ai sửa
   * luật chơi. Chạy thật thì không thể lệch, vì dùng đúng đoạn mã chạy lúc người chơi đang
   * nhìn. Hai tiếng với bước 0,5 giây là 14.400 vòng.
   */
  collectOffline(nowMs: number, step: (dt: number) => void): OfflineReport | null {
    const elapsedSeconds = Math.max(0, (nowMs - this.state.lastSavedTimestamp) / 1000);
    this.state.lastSavedTimestamp = nowMs;
    if (elapsedSeconds < AFK_MIN_SECONDS) return null;

    const creditedSeconds = Math.min(elapsedSeconds, AFK_CAP_SECONDS);
    const before = { ...this.state.inv };
    const full = new Set<ResourceKind>();

    const STEP = 0.5;
    const steps = Math.floor(creditedSeconds / STEP);
    for (let i = 0; i < steps; i += 1) {
      step(STEP);
      for (const kind of this.fullKinds) full.add(kind);
    }

    // Hiệu suất vắng mặt áp lên phần KIẾM THÊM, không áp lên số đang có.
    const gained: Partial<Inventory> = {};
    for (const kind of RESOURCE_KINDS) {
      const earned = this.state.inv[kind] - before[kind];
      if (earned <= 0) continue;
      const kept = Math.floor(earned * AFK_EFFICIENCY);
      this.state.inv[kind] = before[kind] + kept;
      if (kept > 0) gained[kind] = kept;
    }

    return {
      elapsedSeconds, creditedSeconds, gained,
      capped: elapsedSeconds > AFK_CAP_SECONDS,
      full: [...full],
    };
  }
}
