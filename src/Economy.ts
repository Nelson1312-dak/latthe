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
  EXPORT_KEEP, RESERVE_HEADROOM, RESOURCES, SURPLUS_RATE_PER_LEVEL, SURPLUS_RESERVE, SAVE_KEY,
  AGES, BASE_RADIUS, BASE_RADIUS_PER_LEVEL, BUILD_MIN_AGE, DESERT_SECONDS, FOOTPRINT,
  SMITH_COST, SMITH_GROWTH, SMITH_MAX_AGE2, SMITH_MAX_AGE4, SMITH_MAX_AGE5, TROOPS,
  AGE_FARM, AGE_STORAGE, ageBonus,
  VILLAGE_COLORS, WAVE_EVERY_SECONDS, WAVE_FIRST_SECONDS, VOYAGES,
  SPEED_PER_LEVEL, STARTING,
  STORAGE_PER_GRANARY, TRAIN_COST, TRAIN_GROWTH,
  DOCK_VOYAGE_CAP, DOCK_VOYAGE_PER_LEVEL, FARM_FOOD_PER_LEVEL, LOOKOUT_RANGE_BASE,
  LOOKOUT_RANGE_PER_LEVEL, MARKET_PRICE_CAP, MARKET_PRICE_PER_LEVEL, MARKET_RATE_PER_LEVEL,
  WELL_SPEED_CAP, WELL_SPEED_PER_LEVEL, BUILD_LIMIT,
  RESERVE_STORAGE_SHARE, TAX_PER_HALL_LEVEL, TAX_PER_VILLAGER, tenLangSangAnh,
  AUTO_HIRE_MARGIN, AUTO_HIRE_SECONDS,
} from './config';
import type {
  Building, BuildingType, Cost, GameState, Inventory, OfflineReport, ResourceKind, Threat,
  TroopKind, Troops, Unit, Voyage, VoyageBand, VoyageResult, WaveResult,
} from './types';
import { TROOP_KINDS, noTroops } from './types';
import { biomeAt, siteOf } from './world';
import { resolveVoyage, voyageSpec } from './voyage';
import { denLoot, denPower, huntLosses, huntPower } from './dens';
import type { Den } from './dens';
import { guardOf, mercPrice, stormTargets, waveKind, waveOutcome, wavePower } from './raids';
import { raiderCount, resolveBattle, waveMix } from './battle';
import type { BattleSeed } from './battle';
import { HORDES, bossTitle, hordeTier, minionCount, pickHorde } from './beasthorde';
import type { HordeSpec } from './beasthorde';
import { RESOURCE_KINDS } from './types';
import {
  SHIP_AGE, SHIP_COST, SHIP_PER_DOCK, SHIP_SECONDS, SORTIE_SECONDS,
  fleetStop, lairNeed, resolveLair, seaClash, seaPower,
} from './naval';
import type { LairResult } from './naval';
import { bonusesFor, milestoneAt, nextMilestone, reachedCount } from './milestones';

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
  return {
    village: { name: '', color: VILLAGE_COLORS[0] },
    threat: { next: WAVE_FIRST_SECONDS, wave: 0, hired: 0, last: null },
    inv: { ...STARTING },
    storageLimit: BASE_STORAGE,
    level: 1,
    voyage: null,
    voyagesDone: 0,
    buildings: [{
      id: 'core', type: 'townhall', level: 1,
      position: [0, 0, 0], biome: 'meadow',
      stock: {}, cartTimer: 0,
    }],
    units: [],
    // Bốn ô giữa mở sẵn, đủ để nhìn thấy thủ phủ và vài mỏ quanh đó; phần còn lại là mây.
    // Bốn khối quanh gốc mở sẵn, đủ thấy thủ phủ và vài mỏ; phần còn lại là mây.
    revealed: ['0,0', '-1,0', '0,-1', '-1,-1'],
    hunted: [],
    nextBuildingId: 1,
    age: 1,
    ageLeft: 0,
    army: noTroops(),
    train: [],
    smith: { attack: 0, armour: 0 },
    fleet: 0,
    shipLeft: 0,
    lairs: 0,
    sortie: null,
    lastSavedTimestamp: Date.now(),
    muted: false,
    totalGold: 0,
    speedLevel: 1,
    capacityLevel: 1,
    demand: null,
    assignments: {},
    autoFarm: true,
    focus: {},
    scouts: 1,
    autoHire: true,
    speedMult: 1,
    maxReach: 0,
  };
}

export class Economy {
  state: GameState;
  private timer: number | null = null;
  onChange: (() => void) | null = null;

  readonly rates: Inventory = emptyInv();
  readonly fullKinds = new Set<ResourceKind>();
  /**
   * Gọi khi làng tự thuê được một người — Game nối vào WorkerManager.spawnVillager. Để trống
   * (như trong bản chạy thử) thì không tự thuê.
   */
  onSpawnVillager: ((home: Building) => void) | null = null;
  private hireClock = 0;
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
          state.assignments = parsed.assignments ?? {};
          state.autoFarm = parsed.autoFarm !== false;
          // Ba trường của bản "chơi văn phòng". Bản lưu cũ: không dồn ai, một người đi khám
          // phá (đúng như máy vẫn tự cắt trước đây), và tự thuê dân bật sẵn.
          state.focus = {};
          for (const k of RESOURCE_KINDS) {
            const n = Math.floor(Number(parsed.focus?.[k]) || 0);
            if (n > 0) state.focus[k] = Math.min(99, n);
          }
          state.scouts = parsed.scouts === undefined ? 1
            : Math.max(0, Math.min(20, Math.floor(Number(parsed.scouts) || 0)));
          state.autoHire = parsed.autoHire !== false;
          state.maxReach = Number(parsed.maxReach) || 0;
          // Bản lưu cũ không có làng: để trống thì màn lập làng tự hiện ra, người chơi đang
          // chơi dở vẫn được đặt tên cho chỗ mình đã xây.
          state.village = {
            name: tenLangSangAnh(String(parsed.village?.name ?? '').trim()).slice(0, 24),
            color: Number(parsed.village?.color) || VILLAGE_COLORS[0],
          };
          /*
           * Bản lưu TRƯỚC mùa bão được cho hẳn hai kỳ chuẩn bị.
           *
           * Sức của một đợt bám theo cấp căn cứ, nên một người đã chơi bốn tiếng sẽ gặp
           * ngay một đợt mạnh gấp mười đợt đầu của người mới — mà họ thì chưa từng nghe
           * nói tới chòi canh, chưa xây cái nào, và sẽ mất gần nửa kho ngay lần mở game
           * đầu tiên sau khi cập nhật. Hai mươi phút là đủ để nhìn thấy bảng đếm ngược ở
           * góc màn hình, đọc hai con số thủ/giặc, và dựng mấy cái chòi.
           */
          const th = parsed.threat as Partial<Threat> | undefined;
          state.threat = {
            next: Number(th?.next) > 0 ? Number(th?.next) : WAVE_FIRST_SECONDS * 2,
            wave: Math.max(0, Math.floor(Number(th?.wave) || 0)),
            hired: 0,
            last: th?.last ?? null,
          };
          // Bản lưu trước khi có đi biển: không có chuyến nào đang chạy, và người nào
          // lỡ mang trạng thái 'voyage' thì trả về làm việc, không thì họ đứng hình mãi.
          /*
           * Mã công trình mới đánh số tiếp từ mã lớn nhất đang có. Bản lưu cũ toàn mã
           * `core` và `p_…`, nên số bắt đầu lại từ 1 mà không đụng ai.
           */
          let maxId = 0;
          for (const b of state.buildings) {
            const m = /^b_(\d+)$/.exec(b.id);
            if (m) maxId = Math.max(maxId, Number(m[1]));
          }
          state.nextBuildingId = Math.max(Number(parsed.nextBuildingId) || 0, maxId + 1);
          /*
           * Bản lưu trước thời đại: ai cũng bắt đầu lại ở thời đại một, quân rỗng. Không
           * đền bù gì — thời đại là thứ mở ra công trình mới chứ không lấy đi cái gì đang
           * có, nên một người chơi cũ chỉ thấy có thêm việc để làm.
           */
          state.age = Math.min(AGES.length, Math.max(1, Math.floor(Number(parsed.age) || 1)));
          state.ageLeft = Math.max(0, Number(parsed.ageLeft) || 0);
          // Bản lưu trước tháp phép chỉ có ba loại lính: hai loại mới đọc ra 0, không ai mất gì.
          state.army = noTroops();
          for (const k of TROOP_KINDS) {
            state.army[k] = Math.max(0, Math.floor(Number(parsed.army?.[k]) || 0));
          }
          state.train = Array.isArray(parsed.train) ? parsed.train.slice(0, 12) : [];
          state.smith = {
            attack: Math.max(0, Math.floor(Number(parsed.smith?.attack) || 0)),
            armour: Math.max(0, Math.floor(Number(parsed.smith?.armour) || 0)),
          };
          // Bản lưu trước hạm đội: chưa có thuyền, chưa dẹp hang nào.
          state.fleet = Math.max(0, Math.floor(Number(parsed.fleet) || 0));
          state.shipLeft = Math.max(0, Number(parsed.shipLeft) || 0);
          state.lairs = Math.max(0, Math.floor(Number(parsed.lairs) || 0));
          state.sortie = parsed.sortie && Number(parsed.sortie.ships) > 0
            ? { ships: Math.floor(Number(parsed.sortie.ships)), left: Math.max(0, Number(parsed.sortie.left) || 0) }
            : null;
          state.voyage = parsed.voyage ?? null;
          state.voyagesDone = Math.max(0, Math.floor(Number(parsed.voyagesDone) || 0));
          // Bản lưu trước khi có thú dữ: chưa dẹp hang nào, và mọi hang đều còn đó.
          state.hunted = Array.isArray(parsed.hunted)
            ? parsed.hunted.filter((x): x is string => typeof x === 'string') : [];
          if (!state.voyage) {
            for (const u of state.units) if (u.state === 'voyage') u.state = 'idle';
          }
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

  /** Phần thưởng cộng dồn từ các mốc đã đạt. Hàm thuần của maxReach. */
  get bonus() {
    return bonusesFor(this.state.maxReach);
  }

  /** Số mốc đã đạt và mốc kế tiếp — cho HUD. */
  milestoneInfo() {
    return { reached: reachedCount(this.state.maxReach), next: nextMilestone(this.state.maxReach) };
  }

  /**
   * Ghi nhận một điểm vừa được vén. Trả về mốc vừa vượt qua, nếu có.
   *
   * Chỉ tiến, không lùi: mất một vùng khỏi bộ nhớ (huỷ khối) không được phép lấy lại phần
   * thưởng đã trao.
   */
  noteReach(distance: number): { label: string } | null {
    if (distance <= this.state.maxReach) return null;
    const before = reachedCount(this.state.maxReach);
    this.state.maxReach = distance;
    const after = reachedCount(distance);
    if (after <= before) return null;
    // Moc VUA QUA, khong phai moc ke tiep. Lay nextMilestone() o day la lech mot bac: vuot
    // "Ria lang" ma bao thanh "Ben kia doi" - quan sat duoc ngay lan chay thu dau tien.
    // Nhay mot lan qua nhieu moc thi bao cai cao nhat.
    return { label: milestoneAt(after - 1).label };
  }

  /**
   * Mức thủ phủ phải GIỮ LẠI mỗi loại, thay vì bán đi.
   *
   * Luôn trùm được món đắt nhất đang bày bán — thuê người, xây mới, nâng cấp — vì nếu
   * không thì người chơi nhìn thấy nút giá 290 trong khi thủ phủ lặng lẽ bán sạch xuống
   * 150, và cái nút ấy không bao giờ sáng. Lỗi kiểu đó không ai đoán ra được, chỉ thấy
   * game tự dưng dừng.
   */
  private readonly reserve: Inventory = emptyInv();
  /** Món đắt nhất đang bày bán đòi bao nhiêu mỗi loại. 0 nghĩa là chẳng gì cần tới nó. */
  private readonly maxCost: Inventory = emptyInv();

  private recomputeReserve(): void {
    const gia: Cost[] = [this.hireCost(), this.trainSpeedCost(), this.trainCapacityCost()];
    /*
     * GIÁ LÊN THỜI ĐẠI VÀ GIÁ LÍNH CŨNG PHẢI VÀO ĐÂY.
     *
     * Thiếu chúng là một cái bẫy kín: chợ bán sạch mọi thứ chất trên mức dự trữ, mà mức dự
     * trữ chỉ tính theo giá công trình — nên một thời đại đòi 400 lương thực thì VĨNH VIỄN
     * không gom nổi, vì chợ bán đi ngay khi vượt 150. Đo được bằng bản mô phỏng: bốn tiếng
     * vẫn kẹt ở Thời Dựng Làng dù căn cứ đã lên cấp 40.
     */
    const sau = this.nextAge();
    if (sau) gia.push(sau.cost);
    for (const k of TROOP_KINDS) gia.push(TROOPS[k].cost);
    /*
     * CHỈ GIỮ CHO THỨ MUA ĐƯỢC LÚC NÀY.
     *
     * Bản trước giữ cho MỌI loại nhà, kể cả chuồng ngựa của thời đại bốn (320 gỗ) khi làng
     * còn ở thời đại một. Giữ cho thứ chưa mở khoá là khoá chết hàng trong kho mà chẳng để
     * làm gì — và là một nửa lý do người mới không thấy vàng về. Lên thời đại thì mức giữ tự
     * nhảy theo (after() gọi lại hàm này), hàng lại dồn lên tới đó.
     */
    for (const t of Object.keys(BUILDINGS) as BuildingType[]) {
      if (t === 'townhall' || (BUILD_MIN_AGE[t] ?? 0) > this.state.age) continue;
      gia.push(this.buildCostFor(t));
    }
    for (const b of this.state.buildings) {
      if (b.level < BUILDINGS[b.type].maxLevel) gia.push(this.costFor(b.type, b.level));
    }
    /*
     * MỨC GIỮ KHÔNG ĐƯỢC CAO HƠN CÁI KHO.
     *
     * Chợ chỉ bán phần vượt mức giữ, còn kho thì chặn ở storageLimit. Mức giữ mà cao hơn
     * kho thì "phần vượt" không bao giờ tồn tại: kho đầy, dân đứng chơi, vàng không về. Hai
     * luật sửa nó, và cả hai đều giữ nguyên lời hứa cũ (món nào mua được thì gom được):
     *   - món đắt hơn sức chứa của kho thì bỏ ra khỏi phép tính — gom tới bao giờ cũng không
     *     đủ, và nút mua đã nói thẳng "Storage too small";
     *   - phần dư 1,35 lần bị chặn ở 80% kho, nhưng KHÔNG BAO GIỜ xuống dưới chính cái giá
     *     của món đắt nhất còn mua được.
     */
    const kho = this.state.storageLimit;
    for (const k of RESOURCE_KINDS) {
      let max = 0;
      let vua = 0;
      for (const c of gia) {
        const v = c[k] ?? 0;
        max = Math.max(max, v);
        if (v <= kho) vua = Math.max(vua, v);
      }
      this.maxCost[k] = max;
      // Thứ không công trình nào cần thì giữ rất ít: nó sinh ra để chảy thành vàng.
      this.reserve[k] = max > 0
        ? Math.min(Math.max(SURPLUS_RESERVE, vua * RESERVE_HEADROOM),
          Math.max(vua, kho * RESERVE_STORAGE_SHARE))
        : EXPORT_KEEP;
    }
  }

  /** Mức phải giữ lại của một loại, để thủ phủ biết bán từ đâu trở lên. */
  reserveOf(kind: ResourceKind): number {
    return this.reserve[kind];
  }

  /**
   * Món đắt nhất người chơi đang với tới đòi bao nhiêu loại này. Trả 0 khi CHẲNG CÔNG TRÌNH
   * NÀO cần tới nó — như pha lê, thứ chỉ để bán. Dân dùng số này để biết lúc nào mình đang
   * kẹt thật, khác hẳn với "kho còn vơi".
   */
  costPressure(kind: ResourceKind): number {
    return this.maxCost[kind];
  }

  recompute(): void {
    this.state.storageLimit = Math.floor(
      (BASE_STORAGE + this.sumLevels('granary') * STORAGE_PER_GRANARY) * (1 + this.bonus.storage)
      * ageBonus(this.state.age, AGE_STORAGE));
    let total = 0;
    for (const b of this.state.buildings) total += b.level;
    this.state.level = 1 + Math.floor(total / 3);
    this.recomputeReserve();
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
    return BASE_SPEED * (1 + (this.state.speedLevel - 1) * SPEED_PER_LEVEL) * (1 + this.bonus.speed)
      * (1 + this.wellBonus());
  }

  // ------------------------------------------------------------------ hạ tầng

  /** Giếng làng: phần cộng vào tốc độ đi của dân, đã chặn trần. */
  wellBonus(): number {
    return Math.min(WELL_SPEED_CAP, WELL_SPEED_PER_LEVEL * this.sumLevels('well'));
  }

  /** Chợ phiên: phần cộng vào giá mỗi món bán ra, đã chặn trần. */
  marketBonus(): number {
    return Math.min(MARKET_PRICE_CAP, MARKET_PRICE_PER_LEVEL * this.sumLevels('market'));
  }

  /** Ruộng lúa: lương thực tự ra mỗi giây. */
  farmRate(): number {
    return FARM_FOOD_PER_LEVEL * this.sumLevels('farm') * ageBonus(this.state.age, AGE_FARM);
  }

  /**
   * Xưởng thuyền: đồng hồ chuyến biển chạy nhanh gấp bấy nhiêu lần.
   *
   * Nhân vào NHỊP TRỪ chứ không sửa `voyage.left` lúc ra khơi: xây thêm xưởng giữa chuyến
   * thì chuyến đang đi cũng về sớm hơn, và bản lưu không phải nhớ thêm con số nào.
   */
  voyageSpeed(): number {
    return 1 + Math.min(DOCK_VOYAGE_CAP, DOCK_VOYAGE_PER_LEVEL * this.sumLevels('dock'));
  }

  /** Các đài quan sát và tầm nhìn của từng cái — màn sương đọc danh sách này mỗi nhịp. */
  lookouts(): { x: number; z: number; r: number }[] {
    const ra: { x: number; z: number; r: number }[] = [];
    for (const b of this.state.buildings) {
      if (b.type !== 'lookout') continue;
      ra.push({
        x: b.position[0], z: b.position[2],
        r: LOOKOUT_RANGE_BASE + LOOKOUT_RANGE_PER_LEVEL * b.level,
      });
    }
    return ra;
  }

  capacity(): number {
    return Math.floor(
      BASE_CAPACITY * (1 + (this.state.capacityLevel - 1) * CAPACITY_PER_LEVEL)
      * (1 + this.bonus.capacity));
  }

  outposts(): Building[] {
    return this.state.buildings.filter((b) => b.type === 'outpost');
  }

  buildingById(id: string): Building | undefined {
    return this.state.buildings.find((b) => b.id === id);
  }

  /** Công trình nào đang chiếm chỗ quanh điểm này, nếu có. */
  buildingNear(x: number, z: number, r: number, boQua?: string): Building | undefined {
    for (const b of this.state.buildings) {
      // Đang dời một công trình thì chính nó không được tính là vật cản của nó.
      if (b.id === boQua) continue;
      const d = Math.hypot(b.position[0] - x, b.position[2] - z);
      if (d < r + FOOTPRINT[b.type]) return b;
    }
    return undefined;
  }

  /** Bán kính xây được quanh thủ phủ, lớn dần theo cấp thủ phủ. */
  baseRadius(): number {
    return BASE_RADIUS + BASE_RADIUS_PER_LEVEL * this.sumLevels('townhall');
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

  countOf(type: BuildingType): number {
    return this.state.buildings.filter((b) => b.type === type).length;
  }

  /**
   * Gia XAY MOI, tinh theo so cai da co cua loai do.
   *
   * Tren ban do co dinh thi dung gia nen cung duoc, vi chi co 15 nen dat. Ban do vo han thi
   * khong: do duoc 46 tram trung chuyen o phut 60, boi cai thu bon muoi sau re y het cai dau
   * tien. Cho gia tang theo so luong thi mo rong ra thanh mot khoan dau tu that, va cang di
   * xa cang phai can nhac - dung cai ma "vo han" can de khong nham chan.
   */
  buildCostFor(type: BuildingType): Cost {
    return this.scale(BUILD_COST[type], COST_GROWTH, this.countOf(type));
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

  /**
   * Nền đất giờ là đối tượng sinh ra theo khối chứ không phải một dòng trong bảng cố định,
   * nên hàm nhận thẳng cái nền thay vì đi tra mã. Trên bản đồ vô hạn thì không có bảng nào
   * để mà tra.
   */
  /**
   * Nền đất của công trình VỪA được đặt, chưa ai lấy ra xem.
   *
   * Game đọc rồi xoá, để biết khối nào đáng cho bật lên. Không lưu vào bản lưu: tải lại
   * game thì cả làng đã đứng sẵn đó rồi, bật lên lúc ấy là nói dối.
   */
  justBuilt: string | null = null;

  /**
   * Vì sao chưa đặt được lên ô này, hoặc null nếu đặt được. Trả về LÝ DO chứ không phải
   * true/false: một ô đỏ không nói gì cả, còn "ngoài vành căn cứ" thì vừa từ chối vừa chỉ
   * đường. Hàm này cũng là thứ chế độ đặt gọi mỗi khung để tô màu ô dưới ngón tay.
   */
  placeBlock(cx: number, cz: number, type: BuildingType, revealed: boolean,
    boQua?: string): string | null {
    const r = FOOTPRINT[type];
    // Trần số lượng xét TRƯỚC chỗ đứng: đã đủ thì kéo đi đâu cũng không đặt được, và lý
    // do phải là lý do thật chứ không phải "chồng lên công trình khác". Đang dời thì bỏ qua.
    const tran = BUILD_LIMIT[type];
    if (tran && !boQua && this.countOf(type) >= tran) {
      return `Limit of ${tran} reached`;
    }
    if (this.buildingNear(cx, cz, r, boQua)) return 'Overlaps another building';
    if (this.state.level < (BUILD_MIN_LEVEL[type] ?? 0)) {
      return `Needs village level ${BUILD_MIN_LEVEL[type]}`;
    }
    const doi = BUILD_MIN_AGE[type] ?? 0;
    if (this.state.age < doi) return `Needs ${AGES[doi - 1].label}`;
    if (!revealed) return 'Still under fog';
    // Trạm trung chuyển và đài quan sát sống bằng việc đứng xa; mọi thứ khác phải nằm
    // trong vành căn cứ.
    if (type !== 'outpost' && type !== 'lookout' && Math.hypot(cx, cz) > this.baseRadius()) {
      return 'Outside the base ring';
    }
    // Đất bằng xét SAU CÙNG: nó là phép thử đắt nhất (đọc cao độ cả chục đỉnh lưới), và
    // con bot dò chỗ thì gọi hàm này hàng nghìn lần cho một căn nhà.
    const dat = siteOf(cx, cz, r);
    if (dat === 1) return 'Ground too steep';
    if (dat === 2) return 'Too close to water';
    if (dat === 3) return 'Too close to lava';
    return null;
  }

  /**
   * Vì sao chưa dời được công trình này tới đây, hoặc null nếu dời được.
   *
   * Ba thứ đứng yên: thủ phủ (mọi vành và mọi đường đều đo từ nó), trạm trung chuyển (xe
   * hàng đang chạy tuyến của nó) và đài quan sát (giá trị của nó CHÍNH LÀ chỗ đứng — dời
   * miễn phí thì một đài vén được cả bản đồ).
   */
  moveBlock(b: Building, cx: number, cz: number, revealed: boolean): string | null {
    if (b.type === 'townhall') return 'The Town Hall stays put';
    if (b.type === 'outpost' || b.type === 'lookout') return 'This building cannot move';
    return this.placeBlock(cx, cz, b.type, revealed, b.id);
  }

  /** Dời một công trình sang chỗ khác. Không tốn gì: đặt nhầm chỗ không phải là một cái tội. */
  moveBuilding(id: string, cx: number, cz: number, revealed = true): boolean {
    const b = this.buildingById(id);
    if (!b || this.moveBlock(b, cx, cz, revealed)) return false;
    b.position = [cx, 0, cz];
    b.biome = biomeAt(cx, cz);
    this.after();
    return true;
  }

  build(cx: number, cz: number, type: BuildingType, revealed = true): boolean {
    if (this.placeBlock(cx, cz, type, revealed)) return false;
    if (!this.pay(this.buildCostFor(type))) return false;

    const id = `b_${this.state.nextBuildingId}`;
    this.state.nextBuildingId += 1;
    this.state.buildings.push({
      id, type, level: 1,
      position: [cx, 0, cz],
      biome: biomeAt(cx, cz),
      stock: {}, cartTimer: 0,
    });
    this.state.demand = null;
    this.justBuilt = id;
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
  /**
   * Thuế: số vàng tự về mỗi giây, không cần ai đi lấy. Xem TAX_PER_HALL_LEVEL để biết vì
   * sao nó tồn tại. Tính theo cấp thủ phủ VÀ số dân, nên thuê thêm người là thu thêm thuế —
   * "vàng tăng dần theo thời gian" đúng theo cách làng lớn lên.
   */
  taxRate(): number {
    const hall = this.state.buildings.find((b) => b.type === 'townhall');
    return hall
      ? TAX_PER_HALL_LEVEL * hall.level + TAX_PER_VILLAGER * this.villagers().length
      : 0;
  }

  /** Số món chợ bán được mỗi giây lúc này. 0 khi chưa có thủ phủ. */
  marketRate(): number {
    const hall = this.state.buildings.find((b) => b.type === 'townhall');
    // Chợ phiên cộng thêm sức bán, nhưng không thay được thủ phủ: không có thủ phủ thì
    // không có ai đứng ra bán.
    return hall
      ? SURPLUS_RATE_PER_LEVEL * hall.level + MARKET_RATE_PER_LEVEL * this.sumLevels('market')
      : 0;
  }

  /**
   * Chợ có đang bán hết công suất không — tức hàng về nhanh hơn mức bán đi.
   *
   * Đây là thứ người chơi cần biết mà nhìn màn hình không thấy được: kho cứ đầy lên, vàng
   * cứ nhỏ giọt, và chẳng có gì nói cho họ biết nút cần bấm là NÂNG CẤP THỦ PHỦ.
   */
  marketBusy = false;

  private sellSurplus(dt: number): void {
    const hall = this.state.buildings.find((b) => b.type === 'townhall');
    if (!hall) return;
    const budget = this.marketRate() * dt;
    const gia = 1 + this.marketBonus();
    let left = budget;
    // Bán thứ đáng tiền trước, và không bao giờ bán chính vàng.
    for (const kind of ['relics', 'stone', 'food', 'wood'] as ResourceKind[]) {
      if (left <= 0) break;
      const take = Math.min(left, this.state.inv[kind] - this.reserve[kind]);
      if (take <= 0) continue;
      this.state.inv[kind] -= take;
      this.deposit('gold', take * RESOURCES[kind].value * gia);
      left -= take;
      this.fullKinds.delete(kind);
    }
    this.marketBusy = budget > 0 && left <= budget * 0.02;
  }

  // --------------------------------------------------------------- mùa bão

  /** Đợt vừa nổ ra. Game dựng cảnh, UI kể lại — Economy không biết gì về hai việc đó. */
  /**
   * Báo một đợt vừa xong. Kèm HẠT GIỐNG TRẬN để bên vẽ diễn lại đúng trận ấy — hạt giống
   * không nằm trong bản lưu, mất nó thì chỉ mất phần hoạt hình, kết quả đã áp xong rồi.
   */
  onWave: ((r: WaveResult, seed: BattleSeed) => void) | null = null;

  /** Người dân đang có mặt ở làng — người đi biển không tính. */
  atHome(): number {
    return this.villagers().filter((u) => u.state !== 'voyage').length;
  }

  /** Sức thủ lúc này, đã gồm lính vừa thuê và số dân đang ở nhà. */
  guard(): number {
    return guardOf(this.state.buildings, this.state.threat.hired, this.atHome(), this.state.age);
  }

  // ------------------------------------------------------------------ săn thú

  isHunted(id: string): boolean {
    return this.state.hunted.includes(id);
  }

  /** Sức quân mang đi săn: chỉ quân thường trực, không tính dân và lính thuê. */
  huntPower(): number {
    return huntPower(this.state.army, this.state.smith.attack);
  }

  /** Vì sao chưa săn được hang này; null là săn được. */
  huntBlock(d: Den): string | null {
    if (this.isHunted(d.id)) return 'Den already cleared';
    const co = this.huntPower();
    if (co <= 0) return 'No army — train troops first';
    const can = denPower(d);
    if (co < can) return `Needs ${can} army power — you have ${co}`;
    return null;
  }

  /**
   * Mang quân đi dẹp một hang. Thắng chắc — luật đã chặn từ trước khi không đủ sức — và cái
   * giá là số người ngã, tính được trước khi bấm. Không có xúc xắc: người chơi nhìn thẻ là
   * biết đi bây giờ thì mất ai, đợi thêm một lứa lính thì không mất ai.
   */
  hunt(d: Den): { lost: Troops; loot: Cost } | null {
    if (this.huntBlock(d)) return null;
    const lost = huntLosses(this.state.army, this.huntPower(), denPower(d));
    for (const k of TROOP_KINDS) this.state.army[k] -= lost[k];
    const loot: Cost = {};
    const thuong = denLoot(d);
    for (const k of RESOURCE_KINDS) {
      const n = thuong[k];
      if (!n) continue;
      const lay = this.deposit(k, n);
      if (lay > 0) loot[k] = lay;
    }
    this.state.hunted.push(d.id);
    this.onChange?.();
    return { lost, loot };
  }

  /** Giá vàng mỗi điểm sức thủ thuê thêm cho đợt đang tới. */
  mercPrice(): number {
    return mercPrice(this.wavePower());
  }

  /**
   * Thuê lính bù vào chỗ còn thiếu. Trả về số điểm thực sự mua được.
   *
   * Thiếu tiền thì mua được bao nhiêu hay bấy nhiêu, chứ không từ chối: thiệt hại tính theo
   * TỈ LỆ chỗ còn hở, nên lấp được một nửa cái hố cũng là cứu được một nửa kho hàng. Từ chối
   * một nửa là bắt người chơi hiểu sai luật của chính mình.
   */
  hireGuards(): number {
    const thieu = this.wavePower() - this.guard();
    if (thieu <= 0) return 0;
    const gia = this.mercPrice();
    const mua = Math.min(thieu, Math.floor(this.state.inv.gold / gia));
    if (mua <= 0) return 0;
    this.state.inv.gold -= mua * gia;
    this.state.threat.hired += mua;
    this.onChange?.();
    return mua;
  }

  /** Khoảng cách giữa hai đợt tính từ đợt vừa rồi — thanh đếm ngược chia theo số này. */
  waveGap(): number {
    return this.state.threat.wave === 0 ? WAVE_FIRST_SECONDS : WAVE_EVERY_SECONDS;
  }

  /** Sức của đợt đang tới. */
  wavePower(): number {
    return wavePower(this.state.threat.wave + 1, this.state.level);
  }

  /** Bao nhiêu tên sẽ đổ bộ ở đợt tới. Con số này mới là thứ người chơi đếm được trên màn. */
  raiderCount(): number {
    return raiderCount(this.wavePower());
  }

  /**
   * Cho một đợt nổ ra ngay bây giờ và áp hậu quả.
   *
   * `away` là đợt xảy ra lúc người chơi vắng mặt — xem guardOf.
   */
  /** Hạt giống trận vừa rồi, để bên vẽ diễn lại. KHÔNG lưu: mất nó chỉ mất hoạt hình. */
  lastSeed: BattleSeed | null = null;

  /** Dựng hạt giống cho một đợt: tháp nào đứng đâu, bao nhiêu lính, bao nhiêu dân ở nhà. */
  battleSeed(wave: number): BattleSeed {
    const towers: { x: number; z: number; level: number }[] = [];
    for (const b of this.state.buildings) {
      // Thủ phủ cũng là một ụ súng, nhưng nó bắn riêng trong battle.ts nên không vào đây.
      if (b.type === 'watchtower') {
        towers.push({ x: b.position[0], z: b.position[2], level: b.level });
      }
    }
    const seed: BattleSeed = {
      wave,
      kind: waveKind(wave),
      power: wavePower(wave, this.state.level),
      towers,
      mercs: this.state.threat.hired,
      militia: this.atHome() + this.sumLevels('townhall'),
      army: { ...this.state.army },
      smith: { ...this.state.smith },
      age: this.state.age,
    };
    if (seed.kind === 'beast') {
      const h = this.hordeOf(wave);
      seed.horde = h.index;
      seed.tier = h.tier;
      seed.minions = h.minions;
    }
    return seed;
  }

  /** Bầy quái của một đợt: bầy nào, bậc mấy, bao nhiêu con nhỏ — theo cấp làng LÚC NÀY. */
  hordeOf(wave: number): { index: number; spec: HordeSpec; tier: number; minions: number } {
    const index = pickHorde(wave, this.state.level);
    return {
      index, spec: HORDES[index], tier: hordeTier(this.state.level),
      minions: minionCount(this.state.level),
    };
  }

  /** Bầy quái của đợt sắp tới, hoặc null nếu đợt tới không phải quái. */
  nextHorde(): { index: number; spec: HordeSpec; tier: number; minions: number } | null {
    const w = this.state.threat.wave + 1;
    return waveKind(w) === 'beast' ? this.hordeOf(w) : null;
  }

  private runWave(away: boolean): WaveResult {
    const t = this.state.threat;
    const power = wavePower(t.wave, this.state.level);
    const guard = guardOf(this.state.buildings, t.hired, this.atHome(), this.state.age);
    const seed = this.battleSeed(t.wave);
    /*
     * HẢI CHIẾN TRƯỚC, TRẬN BỘ SAU. Cánh quân biển bị chặn ngoài khơi bao nhiêu thì đợt
     * trên bộ nhẹ đi bấy nhiêu; phần lọt qua cộng thẳng vào SỨC ĐỢT của hạt giống trận —
     * nên bản diễn lại (ArmyManager đọc lastSeed) và bản tính kết quả thấy cùng một đợt.
     * Thuyền đang đi đánh hang thì không ở nhà mà chặn.
     */
    const sea = seaPower(power, this.state.age, waveKind(t.wave) === 'raid');
    const clash = seaClash(t.wave, sea, this.state.fleet, this.state.age);
    this.state.fleet = Math.max(0, this.state.fleet - clash.sunk);
    seed.power += clash.landed;
    this.lastSeed = seed;
    const bat = resolveBattle(seed);
    const { result, take, levels } = waveOutcome(t.wave, power, guard, bat, this.state.inv, away);
    if (clash.power > 0) result.sea = clash;
    if (seed.horde !== undefined) {
      const spec = HORDES[seed.horde];
      result.beast = {
        name: spec.name, boss: bossTitle(spec, seed.tier ?? 1), tier: seed.tier ?? 1,
        minions: seed.minions ?? 0, bossDown: bat.bossDown,
      };
    }
    for (const k of RESOURCE_KINDS) {
      const n = take[k];
      if (n) this.state.inv[k] = Math.max(0, this.state.inv[k] - n);
    }
    // Số cấp THỰC SỰ hạ được có thể ít hơn số bão định đánh: làng toàn công trình cấp 1 thì
    // chẳng còn gì để sập. Ghi lại con số thật, đừng kể một thiệt hại không xảy ra.
    let ha = 0;
    for (const id of stormTargets(this.state.buildings, levels)) {
      const b = this.state.buildings.find((x) => x.id === id);
      if (b && b.level > 1) { b.level -= 1; ha += 1; }
    }
    // Quân nằm lại trừ thẳng vào quân thường trực — đếm từ chính bản chạy trận.
    for (const k of TROOP_KINDS) {
      this.state.army[k] = Math.max(0, this.state.army[k] - (bat.lost[k] ?? 0));
    }
    result.levels = ha;
    for (const k of RESOURCE_KINDS) {
      const n = result.reward[k];
      if (n) this.deposit(k, n);
    }
    t.hired = 0;
    t.last = result;
    this.recompute();
    this.onChange?.();
    return result;
  }

  private tickThreat(dt: number): void {
    const t = this.state.threat;
    t.next -= dt;
    if (t.next > 0) return;
    t.wave += 1;
    t.next = WAVE_EVERY_SECONDS;
    /*
     * CHẠY TRƯỚC, BÁO SAU. `this.onWave?.(this.runWave(false))` đọc thì gọn mà sai: toán
     * tử ?. bỏ qua CẢ BIỂU THỨC ĐỐI SỐ khi chưa ai gắn hàm nghe, nên đợt bão lặng lẽ không
     * nổ ra. Tìm ra bằng bản thước đo quên gắn onVoyage: chuyến đi không bao giờ cập bến,
     * và cả hệ thống đứng im mà không một lỗi nào báo.
     */
    const r = this.runWave(false);
    if (this.lastSeed) this.onWave?.(r, this.lastSeed);
  }

  /**
   * Một nhịp kinh tế. `vang = true` khi tua bù giờ vắng mặt: mùa bão, chuyến biển và hạm đội
   * đã có luật vắng mặt riêng trong collectOffline (một đợt duy nhất, cập bến theo giờ thật),
   * nên ở đây bỏ qua ba thứ ấy — còn lại chạy y như lúc đang nhìn.
   */
  tick(dt: number, vang = false): void {
    // Ruộng ra lúa TRƯỚC khi lính ăn: thứ tự ngược lại thì một nhịp nào đó kho về 0 và
    // lính bỏ đi, dù trong cùng nhịp ấy ruộng đã kịp bù.
    const lua = this.farmRate();
    if (lua > 0) this.deposit('food', lua * dt);
    // Thuế vào kho qua đúng cửa deposit(): bị chặn bởi sức chứa, tính vào tổng vàng đã
    // kiếm, hiện lên con số "mỗi giây" của HUD, và chạy cả trong lúc vắng mặt.
    const thue = this.taxRate();
    if (thue > 0) this.deposit('gold', thue * dt);
    if (!vang) {
      this.tickThreat(dt);
      this.tickVoyage(dt);
    }
    this.tickAge(dt);
    this.tickArmy(dt);
    if (!vang) this.tickFleet(dt);
    this.tickAutoHire(dt);
    this.checkDemand();
    this.sellSurplus(dt);
    const k = Math.min(1, dt / RATE_TAU);
    for (const kind of RESOURCE_KINDS) {
      this.rates[kind] += (this.gained[kind] / Math.max(dt, 1e-6) - this.rates[kind]) * k;
      this.gained[kind] = 0;
    }
  }


  /**
   * TỰ THUÊ DÂN. Làng lớn lên trong lúc người chơi đi họp: còn chỗ ở, không có đơn xây nào
   * đang gom, và kho dư hơn giá một khoảng thì thuê thêm một người. Dư một khoảng chứ không
   * vừa khít, để không vét sạch lương thực mà lính đang ăn.
   */
  private tickAutoHire(dt: number): void {
    if (!this.state.autoHire || !this.onSpawnVillager) return;
    this.hireClock -= dt;
    if (this.hireClock > 0) return;
    this.hireClock = AUTO_HIRE_SECONDS;
    if (!this.canHire() || this.state.demand) return;
    const gia = this.hireCost();
    for (const k of RESOURCE_KINDS) {
      if (this.state.inv[k] < (gia[k] ?? 0) * AUTO_HIRE_MARGIN) return;
    }
    this.hire(this.onSpawnVillager);
  }

  // ----------------------------------------------------------------- thời đại

  /** Thời đại hiện tại. */
  ageSpec(): typeof AGES[number] { return AGES[this.state.age - 1]; }

  /** Thời đại kế tiếp, hoặc null nếu đã hết. */
  nextAge(): typeof AGES[number] | null {
    return this.state.age < AGES.length ? AGES[this.state.age] : null;
  }

  /** Vì sao chưa lên thời đại được, hoặc null nếu lên được ngay. */
  ageBlock(): string | null {
    const n = this.nextAge();
    if (!n) return 'Final age reached';
    if (this.state.ageLeft > 0) return 'Advancing…';
    if (this.state.level < n.level) return `Needs village level ${n.level}`;
    if (n.need && !this.state.buildings.some((b) => b.type === n.need)) {
      return `Requires ${BUILDINGS[n.need].label.toLowerCase()}`;
    }
    // Kho nhỏ hơn cái giá thì gom tới bao giờ cũng không đủ. Nói thẳng ra, không thì người
    // chơi ngồi nhìn kho đầy mà nút vẫn xám — bản mô phỏng kẹt đúng chỗ này suốt hai tiếng.
    for (const k of RESOURCE_KINDS) {
      if ((n.cost[k] ?? 0) > this.state.storageLimit) return 'Storage too small — upgrade granaries';
    }
    if (!this.canAfford(n.cost)) return 'Not enough resources';
    return null;
  }

  advanceAge(): boolean {
    const n = this.nextAge();
    if (!n || this.ageBlock()) return false;
    if (!this.pay(n.cost)) return false;
    this.state.ageLeft = n.seconds;
    this.after();
    return true;
  }

  private tickAge(dt: number): void {
    if (this.state.ageLeft <= 0) return;
    this.state.ageLeft -= dt;
    if (this.state.ageLeft > 0) return;
    this.state.ageLeft = 0;
    this.state.age += 1;
    this.onAge?.(AGES[this.state.age - 1].label);
    this.after();
  }

  onAge: ((label: string) => void) | null = null;

  // ----------------------------------------------------------------- hạm đội

  /** Trần chiến thuyền, theo tổng cấp bến tàu. */
  shipCap(): number {
    return this.sumLevels('dock') * SHIP_PER_DOCK;
  }

  /** Thuyền đang có, kể cả chiếc trên triền và những chiếc đang đi đánh hang. */
  shipHave(): number {
    return this.state.fleet + (this.state.shipLeft > 0 ? 1 : 0) + (this.state.sortie?.ships ?? 0);
  }

  shipBlock(): string | null {
    if (this.state.age < SHIP_AGE) return `Unlocks in ${AGES[SHIP_AGE - 1].label}`;
    if (this.sumLevels('dock') === 0) return 'Requires dock';
    if (this.state.shipLeft > 0) return 'Shipyard busy';
    if (this.shipHave() >= this.shipCap()) return `Full (${this.shipCap()}) — upgrade dock`;
    if (!this.canAfford(SHIP_COST)) return 'Not enough resources';
    return null;
  }

  buildShip(): boolean {
    if (this.shipBlock()) return false;
    if (!this.pay(SHIP_COST)) return false;
    this.state.shipLeft = SHIP_SECONDS;
    this.onChange?.();
    return true;
  }

  /** Sức chặn của hạm đội đang ở nhà, và cánh quân biển của đợt tới. */
  seaThreat(): { stop: number; sea: number } {
    const w = this.state.threat.wave + 1;
    return {
      stop: fleetStop(this.state.fleet, this.state.age),
      sea: seaPower(wavePower(w, this.state.level), this.state.age, waveKind(w) === 'raid'),
    };
  }

  lairBlock(): string | null {
    if (this.state.age < SHIP_AGE) return `Unlocks in ${AGES[SHIP_AGE - 1].label}`;
    if (this.state.sortie) return 'Fleet is already out';
    const can = lairNeed(this.state.lairs);
    if (this.state.fleet < can) return `Needs ${can} warships at the dock`;
    return null;
  }

  /** Cả hạm đội đang ở bến ra khơi đánh hang hải tặc kế tiếp. */
  raidLair(): boolean {
    if (this.lairBlock()) return false;
    this.state.sortie = { ships: this.state.fleet, left: SORTIE_SECONDS };
    this.state.fleet = 0;
    this.onChange?.();
    return true;
  }

  onShip: (() => void) | null = null;
  onLair: ((r: LairResult) => void) | null = null;

  private tickFleet(dt: number): void {
    if (this.state.shipLeft > 0) {
      this.state.shipLeft -= dt;
      if (this.state.shipLeft <= 0) {
        this.state.shipLeft = 0;
        this.state.fleet += 1;
        this.onShip?.();
        this.onChange?.();
      }
    }
    const s = this.state.sortie;
    if (!s) return;
    s.left -= dt;
    if (s.left > 0) return;
    const r = this.landSortie(s);
    this.onLair?.(r);   // chạy trước, báo sau — xem tickThreat
  }

  private landSortie(s: { ships: number }): LairResult {
    const r = resolveLair(this.state.lairs, s.ships, this.state.threat.wave);
    this.state.sortie = null;
    this.state.fleet += Math.max(0, s.ships - r.sunk);
    if (r.won) this.state.lairs += 1;
    if (r.gold) this.deposit('gold', r.gold);
    if (r.relics) this.deposit('relics', r.relics);
    this.recompute();
    this.onChange?.();
    return r;
  }

  // ----------------------------------------------------------------- quân đội

  /** Trần quân của một loại, theo cấp công trình huấn luyện ra nó. */
  troopCap(kind: TroopKind): number {
    return this.sumLevels(TROOPS[kind].from) * TROOPS[kind].perLevel;
  }

  /** Đã có bao nhiêu, kể cả đang trong hàng đợi — không thì xếp hàng vượt trần được. */
  troopHave(kind: TroopKind): number {
    let n = this.state.army[kind];
    for (const t of this.state.train) if (t.kind === kind) n += 1;
    return n;
  }

  /** Vì sao chưa huấn luyện được, hoặc null. */
  trainBlock(kind: TroopKind): string | null {
    const spec = TROOPS[kind];
    if (this.sumLevels(spec.from) === 0) return `Requires ${BUILDINGS[spec.from].label.toLowerCase()}`;
    if (this.troopHave(kind) >= this.troopCap(kind)) {
      return `Full (${this.troopCap(kind)}) — upgrade ${BUILDINGS[spec.from].label.toLowerCase()}`;
    }
    if (this.state.train.length >= 8) return 'Queue is full';
    if (!this.canAfford(spec.cost)) return 'Not enough resources';
    return null;
  }

  train(kind: TroopKind): boolean {
    if (this.trainBlock(kind)) return false;
    if (!this.pay(TROOPS[kind].cost)) return false;
    this.state.train.push({ kind, left: TROOPS[kind].seconds });
    this.onChange?.();
    return true;
  }

  /** Tổng quân thường trực. */
  armySize(): number {
    return TROOP_KINDS.reduce((n, k) => n + this.state.army[k], 0);
  }

  /** Lương quân ăn mỗi giây. */
  upkeep(): number {
    return TROOP_KINDS.reduce((n, k) => n + this.state.army[k] * TROOPS[k].upkeep, 0);
  }

  /** Giây còn lại của suất đang huấn luyện. */
  trainLeft(): number {
    return this.state.train.length ? Math.max(0, this.state.train[0].left) : 0;
  }

  private doiKhat = 0;

  /**
   * Huấn luyện và nuôi quân.
   *
   * HẾT LƯƠNG THÌ LÍNH BỎ ĐI. Không có cái đó thì nuôi quân là một quyết định chỉ có một
   * lần — bấm xong là xong, và con số ấy không bao giờ phải nhìn lại. Có nó thì quân là
   * một khoản chi chạy suốt ván, và nó tranh lương thực với chính chuyến đi biển.
   */
  private tickArmy(dt: number): void {
    const q = this.state.train;
    if (q.length) {
      q[0].left -= dt;
      if (q[0].left <= 0) {
        const xong = q.shift();
        if (xong) this.state.army[xong.kind] += 1;
        this.onChange?.();
      }
    }

    const an = this.upkeep() * dt;
    if (an <= 0) { this.doiKhat = 0; return; }
    if (this.state.inv.food >= an) {
      this.state.inv.food -= an;
      this.doiKhat = 0;
      return;
    }
    this.state.inv.food = 0;
    this.doiKhat += dt;
    if (this.doiKhat < DESERT_SECONDS) return;
    this.doiKhat = 0;
    // Bỏ đi theo thứ tự đắt nhất trước: xe pháo và kỵ binh ăn nhiều nhất thì cũng đi trước.
    for (const k of ['siege', 'horse', 'mage', 'archer', 'spear'] as TroopKind[]) {
      if (this.state.army[k] > 0) {
        this.state.army[k] -= 1;
        this.onDesert?.(TROOPS[k].label);
        this.onChange?.();
        return;
      }
    }
  }

  onDesert: ((label: string) => void) | null = null;

  // ------------------------------------------------------------------ lò rèn

  /** Trần bậc rèn theo thời đại: bậc hai chỉ mở ở thời đại cuối. */
  smithCap(): number {
    const doi = this.state.age;
    return doi >= 5 ? SMITH_MAX_AGE5 : doi >= 4 ? SMITH_MAX_AGE4 : SMITH_MAX_AGE2;
  }

  smithCost(bac: number): Cost {
    return this.scale(SMITH_COST, SMITH_GROWTH, bac);
  }

  smithBlock(which: 'attack' | 'armour'): string | null {
    if (this.sumLevels('smithy') === 0) return 'Requires smithy';
    const bac = this.state.smith[which];
    if (bac >= this.smithCap()) return 'Maxed for this age';
    if (!this.canAfford(this.smithCost(bac))) return 'Not enough resources';
    return null;
  }

  buySmith(which: 'attack' | 'armour'): boolean {
    if (this.smithBlock(which)) return false;
    if (!this.pay(this.smithCost(this.state.smith[which]))) return false;
    this.state.smith[which] += 1;
    this.after();
    return true;
  }

  /** Thành phần đợt tới, để bảng đợt báo trước. */
  waveMix(): Troops {
    return waveMix(this.wavePower(), this.state.age);
  }

  // ----------------------------------------------------------------- đi biển

  onVoyage: ((r: VoyageResult) => void) | null = null;

  /**
   * Vì sao chưa đi được, hoặc null nếu đi được ngay. Trả về LÝ DO chứ không phải true/false:
   * nút xám không nói gì cả, còn "cần 3 người ở nhà" thì vừa là lời từ chối vừa là chỉ dẫn.
   */
  voyageBlock(band: VoyageBand): string | null {
    if (this.state.voyage) return 'A voyage is already out';
    const s = voyageSpec(band);
    const co = this.atHome();
    // Phải chừa lại một người. Làng trống không thì sản xuất đứng hẳn và sức thủ tụt
    // xuống đáy — đó không còn là một canh bạc, đó là một cái bẫy.
    // Câu phải NGẮN: nó in vừa một dòng rộng chừng 120 điểm ảnh dưới tên chuyến, dài hơn
    // là bị cắt mất đúng cái con số người chơi cần đọc.
    if (co - s.crew < 1) return `Needs ${s.crew + 1} villagers at home`;
    if (this.state.inv.food < s.food) return `Short ${Math.ceil(s.food - this.state.inv.food)} food`;
    return null;
  }

  /**
   * Cho một đoàn ra khơi. Người được chọn là NHỮNG NGƯỜI ĐANG TAY KHÔNG trước: ai đang cõng
   * hàng về thì để họ về đã, không thì chuyến hàng ấy bốc hơi cùng với họ.
   */
  startVoyage(band: VoyageBand): boolean {
    if (this.voyageBlock(band)) return false;
    const s = voyageSpec(band);
    const san = this.villagers().filter((u) => u.state !== 'voyage');
    san.sort((a, b) => (a.carrying > 0 ? 1 : 0) - (b.carrying > 0 ? 1 : 0));
    const doan = san.slice(0, s.crew);
    this.state.inv.food -= s.food;
    for (const u of doan) {
      // Hàng trên vai vào kho trước khi lên thuyền: mất nó đi thì người chơi đọc ra là lỗi.
      if (u.carryingKind && u.carrying > 0) this.deposit(u.carryingKind, u.carrying);
      u.carrying = 0;
      u.carryingKind = null;
      u.state = 'voyage';
      u.targetId = null;
      u.targetPos = null;
    }
    this.state.voyage = { band, left: s.seconds, crew: doan.map((u) => u.id) };
    this.onChange?.();
    return true;
  }

  /** Giây còn lại của chuyến đang chạy, hoặc 0. */
  private tickVoyage(dt: number): void {
    const v = this.state.voyage;
    if (!v) return;
    v.left -= dt * this.voyageSpeed();
    if (v.left > 0) return;
    const r = this.landVoyage(v);   // chạy trước, báo sau — xem tickThreat
    this.onVoyage?.(r);
  }

  /**
   * Cập bến: áp kết quả, trả người về làng. Người "không về" bị xoá khỏi units — đây là
   * thứ duy nhất trong game lấy mất một người dân, và chỉ ở tầm xa nhất.
   */
  private landVoyage(v: Voyage): VoyageResult {
    const r = resolveVoyage(v.band, this.state.voyagesDone);
    this.state.voyagesDone += 1;
    this.state.voyage = null;
    const mat = r.outcome === 'lost' ? v.crew[v.crew.length - 1] : null;
    for (const id of v.crew) {
      const u = this.state.units.find((x) => x.id === id);
      if (!u) continue;
      if (u.id === mat) {
        this.state.units.splice(this.state.units.indexOf(u), 1);
        continue;
      }
      u.state = 'idle';
      // Về đúng thủ phủ chứ không về chỗ cũ: chỗ cũ có khi cách đây hai trăm đơn vị.
      const core = this.state.buildings.find((b) => b.type === 'townhall');
      if (core) u.position = [core.position[0], 0, core.position[2]];
    }
    if (r.gold) this.deposit('gold', r.gold);
    if (r.relics) this.deposit('relics', r.relics);
    this.recompute();
    this.onChange?.();
    return r;
  }

  /** Bảng chuyến cho HUD đọc. */
  voyageList(): typeof VOYAGES { return VOYAGES; }

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
    // Đồng hồ mùa bão chạy theo giờ THẬT, không theo giờ được bù: đi vắng ba ngày thì lúc
    // quay lại đợt tới phải sát nút, chứ không phải còn nguyên hai tiếng.
    const soDot = Math.floor(Math.max(0, elapsedSeconds - this.state.threat.next)
      / WAVE_EVERY_SECONDS) + (elapsedSeconds >= this.state.threat.next ? 1 : 0);
    const full = new Set<ResourceKind>();

    /*
     * Bước tua dãn theo độ dài vắng mặt: tối đa 14.400 vòng dù vắng hai hay tám tiếng, để mở
     * máy không phải đợi lâu hơn chừng hai giây. Tám tiếng là bước 2 giây — người dân vẫn
     * tới đúng chỗ (step() kẹp ở đích), chỉ thô hơn một chút ở lúc đứng hái.
     *
     * KINH TẾ CŨNG PHẢI CHẠY. Bản trước chỉ tua người dân và màn mây, quên hẳn economy.tick:
     * suốt lúc vắng mặt không có thuế, ruộng không ra lúa, chợ không bán hàng dư ra vàng —
     * kho đầy rồi thì dân đứng chơi tới lúc quay lại. Đó là phần lớn của câu "offline chưa ra
     * gì".
     */
    const STEP = Math.max(0.5, creditedSeconds / 14400);
    const steps = Math.floor(creditedSeconds / STEP);
    for (let i = 0; i < steps; i += 1) {
      step(STEP);
      this.tick(STEP, true);
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

    /*
     * ĐI VẮNG BAO LÂU THÌ CŨNG CHỈ MỘT ĐỢT NỔ RA.
     *
     * Dồn cả tám đợt của một đêm vào lúc mở game là vừa vô lý vừa tàn nhẫn: người chơi mở
     * máy ra thấy làng tan hoang vì một việc họ không có mặt để ngăn. Một đợt thì vừa đủ để
     * tắt máy không còn là cách né mùa bão, mà vẫn giữ được chuyện "đi vắng rồi quay lại"
     * là điều game này mời gọi.
     */
    /*
     * Chuyến đi biển cũng cập bến trong lúc vắng mặt, và cũng tính SAU vòng tua như mùa
     * bão — nên món mang về không bị nhân với hiệu suất vắng mặt. Nó là phần thưởng của
     * một quyết định đã ra TRƯỚC lúc tắt máy, không phải thứ kiếm thêm trong lúc ngủ.
     */
    let voyage: VoyageResult | null = null;
    const vo = this.state.voyage;
    if (vo) {
      vo.left -= elapsedSeconds * this.voyageSpeed();
      if (vo.left <= 0) voyage = this.landVoyage(vo);
    }

    // Triền đóng xong chiếc đang đóng, và hạm đội đi đánh hang cũng cập bến trong lúc vắng.
    if (this.state.shipLeft > 0 && this.state.shipLeft <= elapsedSeconds) {
      this.state.shipLeft = 0;
      this.state.fleet += 1;
    } else if (this.state.shipLeft > 0) {
      this.state.shipLeft -= elapsedSeconds;
    }
    const so = this.state.sortie;
    if (so) {
      so.left -= elapsedSeconds;
      if (so.left <= 0) this.landSortie(so);
    }

    let wave: WaveResult | null = null;
    if (soDot > 0) {
      this.state.threat.wave += 1;
      wave = this.runWave(true);
    }
    this.state.threat.next = soDot > 0
      ? WAVE_EVERY_SECONDS - (elapsedSeconds - this.state.threat.next) % WAVE_EVERY_SECONDS
      : this.state.threat.next - elapsedSeconds;

    return {
      elapsedSeconds, creditedSeconds, gained,
      capped: elapsedSeconds > AFK_CAP_SECONDS,
      full: [...full],
      wave,
      voyage,
      waveSkipped: Math.max(0, soDot - 1),
    };
  }
}
