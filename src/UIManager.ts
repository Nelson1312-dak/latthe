/**
 * Lớp 2D: thanh tài nguyên, minimap, dock nổi, và thẻ kiểm tra công trình.
 *
 * Bỏ hẳn mấy nút +/- phân việc. Người chơi nói MUỐN GÌ — bấm nâng cấp, ghim một mỏ — còn
 * chuyện ai đi đâu là việc của dân. Cái cũ bắt người ta ngồi điều từng người trong khi cả
 * thông tin lẫn quyết định đều đã nằm sẵn trong trạng thái kho.
 *
 * Dock là một dải nổi giữa màn, rộng tối đa 640, cách đáy 16. Nó KHÔNG trải ngang cả màn
 * hình như thanh cũ, nên hai bên vẫn nhìn thấy bản đồ — thứ mà cái khung rỗng bên phải của
 * bản trước chiếm chỗ mà chẳng làm gì.
 */
import { BIOMES, BUILDINGS, MINIMAP_SPAN, RESOURCES } from './config';
import { CHUNK, biomeAt, chunkOf } from './world';
import { rewardText } from './milestones';
import { ico, iconSvg } from './icons';
import type { IconName } from './icons';
import type { Economy } from './Economy';
import type { Game } from './Game';
import type { BiomeId, BuildingType, Cost, OfflineReport, Patch, ResourceKind, Unit } from './types';
import { RESOURCE_KINDS } from './types';

const STAT_MS = 200;
const MAP_MS = 200;

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Thiếu phần tử #${id} trong index.html`);
  return el as T;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

/** Mọi con số hiện ra đều là số nguyên. Kho chạy bằng số thực, mắt người thì không. */
export function fmt(n: number): string {
  const v = Math.floor(Number.isFinite(n) ? n : 0);
  if (v < 1000) return String(v);
  if (v < 1e6) return `${(v / 1e3).toFixed(1).replace('.0', '')}N`;
  return `${(v / 1e6).toFixed(1).replace('.0', '')}Tr`;
}

function dur(seconds: number): string {
  const s = Math.floor(seconds);
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} giờ ${r} phút` : `${h} giờ`;
}

export class UIManager {
  private readonly economy: Economy;
  private readonly game: Game;
  private selected: string | null = null;
  private selectedUnit: string | null = null;
  private selectedPatch: string | null = null;
  /** Dòng chữ sống trên thẻ bãi. Giữ riêng để khỏi vẽ lại cả thẻ mỗi 200ms. */
  private patchLive: HTMLElement | null = null;
  private timers: number[] = [];
  private toastTimer = 0;
  manualPaused = false;

  private readonly el = {
    resbar: $('resbar'), level: $('level'),
    reach: $('reach'), reachVal: $('reach-val'),
    mute: $<HTMLButtonElement>('mute'), pause: $<HTMLButtonElement>('pause'),
    crewpill: $('crewpill'), tiles: $('tiles'), speed: $<HTMLButtonElement>('speed'),
    farm: $<HTMLButtonElement>('farm'),
    inspector: $('inspector'), dock: $('dock'),
    minimap: $<HTMLCanvasElement>('minimap'),
    welcome: $('welcome'), awayTime: $('away-time'), awayLoot: $('away-loot'),
    awayCapped: $('away-capped'), awayOk: $<HTMLButtonElement>('away-ok'),
    paused: $('paused'), resume: $<HTMLButtonElement>('resume'), toast: $('toast'),
  };

  constructor(economy: Economy, game: Game) {
    this.economy = economy;
    this.game = game;

    game.onSelect = (id) => { this.selected = id; this.renderInspector(); };
    game.onSelectUnit = (id) => { this.selectedUnit = id; this.renderInspector(); };
    game.onMilestone = (label) => {
      const { next } = this.economy.milestoneInfo();
      this.toast(`${label} · mốc sau ở ${Math.round(next.at)}`, 'medal');
      this.el.reach.classList.add('pop');
      window.setTimeout(() => this.el.reach.classList.remove('pop'), 900);
      this.renderDock();
    };
    game.onSelectPatch = (id) => { this.selectedPatch = id; this.renderInspector(); };
    game.onReveal = (key) => {
      const [cx, cz] = key.split(',').map(Number);
      const b = BIOMES[biomeAt(cx * CHUNK + CHUNK / 2, cz * CHUNK + CHUNK / 2) as BiomeId];
      this.toast(`Đã vén được vùng mới · ${b.label}`);
    };
    economy.onChange = () => {
      game.rebuildPlots();
      this.renderAll();
    };

    this.el.mute.addEventListener('click', () => this.toggleMute());
    this.el.pause.addEventListener('click', () => this.setPaused(!game.isPaused));
    this.el.resume.addEventListener('click', () => this.setPaused(false));
    this.el.awayOk.addEventListener('click', () => { this.el.welcome.hidden = true; });
    this.el.speed.addEventListener('click', () => this.toggleSpeed());
    this.el.farm.addEventListener('click', () => this.toggleFarm());
    this.el.minimap.addEventListener('pointerdown', (e) => this.mapClick(e));

    this.applyMute();
    this.renderAll();
    this.timers.push(window.setInterval(() => this.refresh(), STAT_MS));
    this.timers.push(window.setInterval(() => this.drawMap(), MAP_MS));
  }

  private renderAll(): void {
    this.renderResourceBar();
    this.renderDock();
    this.renderInspector();
    this.refresh();
  }

  // ----------------------------------------------------------- thanh trên

  private renderResourceBar(): void {
    this.el.resbar.innerHTML = '';
    for (const kind of RESOURCE_KINDS) {
      const chip = el('div', 'chip');
      chip.dataset.kind = kind;
      chip.append(ico(RESOURCES[kind].icon, 'ico', RESOURCES[kind].color));
      const col = el('span', 'col');
      col.append(el('strong', 'amt', '0'), el('small', 'rate', ''));
      chip.append(col);
      this.el.resbar.append(chip);
    }
  }

  refresh(): void {
    const s = this.economy.state;
    const need = new Set(this.economy.demandKinds());
    for (const chip of Array.from(this.el.resbar.children) as HTMLElement[]) {
      const kind = chip.dataset.kind as ResourceKind;
      (chip.querySelector('.amt') as HTMLElement).textContent = fmt(s.inv[kind]);
      const r = this.economy.rates[kind];
      (chip.querySelector('.rate') as HTMLElement).textContent =
        `+${(Number.isFinite(r) ? r : 0).toFixed(1)}/s`;
      const full = this.economy.isFull(kind);
      chip.classList.toggle('full', full);
      // Ùn: còn chỗ chứa nhưng chợ bán không kịp. Khác hẳn kho đầy, và cách chữa cũng khác
      // — một bên xây thêm kho lẫm, một bên nâng cấp thủ phủ.
      // Vang khong bao gio un: cho KHONG ban vang, vang la thu cho tra ve. Danh dau no la
      // noi mot dieu sai va day nguoi choi di nang thu phu vi mot ly do khong co that.
      chip.classList.toggle('jam', kind !== 'gold' && !full && this.economy.marketBusy
        && s.inv[kind] > this.economy.reserveOf(kind) * 1.5);
      // Thứ đang cần cho công trình được đánh dấu, nên nhìn thanh là biết dân đang chạy vì gì.
      chip.classList.toggle('need', need.has(kind));
      chip.title = `${RESOURCES[kind].label}: ${Math.floor(s.inv[kind])}/${Math.floor(s.storageLimit)}`
        + ` — thu ${(Number.isFinite(r) ? r : 0).toFixed(2)} mỗi giây${full ? ' · KHO ĐẦY' : ''}`;
    }
    this.el.level.textContent = String(s.level);

    // Quang duong xa nhat va moc ke tiep. Day la thu bien viec di xa tu mot con so lon hon
    // thanh mot cai dich ngam.
    const { reached, next } = this.economy.milestoneInfo();
    this.el.reachVal.textContent = String(Math.floor(s.maxReach));
    const thieu = Math.max(0, Math.round(next.at - s.maxReach));
    this.el.reach.title = `Đã đạt ${reached} mốc.\nMốc kế tiếp: ${next.label} ở ${next.at}`
      + ` (còn ${thieu}) — ${rewardText(next)}`;
    this.el.reach.classList.toggle('close', thieu <= 25);

    // Nguoi dan di chuyen va doi viec lien tuc, nen the cua ho phai song theo. Ghep vao
    // nhip lam moi san co thay vi dung mot bo dem rieng.
    if (this.selectedUnit) this.renderInspector();
    // Thẻ bãi thì CHỈ thay dòng chữ sống, không vẽ lại cả thẻ. Vẽ lại toàn bộ mỗi 200ms sẽ
    // thay các nút +/− ngay giữa lần bấm: chuột xuống trên nút cũ, chuột lên trên nút mới,
    // và trình duyệt không tính đó là một cú bấm nào cả.
    if (this.patchLive && this.selectedPatch) {
      const b = this.game.map.patchById(this.selectedPatch);
      if (b) this.patchLive.textContent = this.patchLine(b);
    }

    this.updateCrewPill();
  }

  // ------------------------------------------------------------- dock nổi

  private renderDock(): void {
    this.updateCrewPill();
    const tiles = this.el.tiles;
    tiles.innerHTML = '';

    const hire = this.tile('villager', 'Thuê thợ', this.economy.hireCost(),
      () => this.economy.hire((h) => this.game.workers.spawnVillager(h)));
    if (!this.economy.canHire()) {
      hire.disabled = true;
      hire.classList.add('blocked');
      hire.dataset.warn = 'Hết chỗ ở (cần nâng Nhà)';
    }
    tiles.append(hire);

    tiles.append(this.tile('boot', `Giày Lv.${this.economy.state.speedLevel}`,
      this.economy.trainSpeedCost(), () => this.economy.trainSpeed(), '+10% tốc độ'));
    tiles.append(this.tile('pack', `Balo Lv.${this.economy.state.capacityLevel}`,
      this.economy.trainCapacityCost(), () => this.economy.trainCapacity(), '+25% sức mang'));

    this.el.speed.textContent = `${this.economy.state.speedMult}×`;
    this.el.speed.classList.toggle('on', this.economy.state.speedMult === 2);

    const tu = this.economy.state.autoFarm;
    this.el.farm.innerHTML = iconSvg(tu ? 'robot' : 'hand');
    this.el.farm.classList.toggle('on', tu);
    this.el.farm.title = tu
      ? 'Đang TỰ FARM: ai rảnh thì đi lấy thứ trong kho đang vơi nhất. Bấm để tắt.'
      : 'Đang TỰ ĐIỀU: dân chỉ tới bãi bạn đã giao. Bấm để bật tự farm lại.';
  }

  /**
   * Bat/tat tu farm.
   *
   * Tat di thi dan CHI lam viec ban giao - khong giao ai thi ho dung choi, va do la dung:
   * nguoi choi vua noi ho muon tu dieu. Nhung neu de ho dung im ma khong noi gi thi trong
   * nhu game hong, nen bao thang mot cau.
   */
  private toggleFarm(): void {
    const e = this.economy;
    e.state.autoFarm = !e.state.autoFarm;
    e.save();
    const giao = Object.values(e.state.assignments).reduce((s, v) => s + v, 0);
    this.toast(e.state.autoFarm
      ? 'Tự farm: dân tự chọn bãi theo kho nào đang vơi'
      : giao > 0
        ? `Tự điều: dân chỉ tới ${giao} chỗ bạn đã giao`
        : 'Tự điều: bấm vào một bãi rồi giao người, chưa giao thì dân đứng chờ');
    this.renderDock();
    this.renderInspector();
  }

  /** Ô vuông trong dock: biểu tượng, tên, giá. */
  private tile(icon: IconName, label: string, cost: Cost, run: () => boolean, note?: string): HTMLButtonElement {
    const b = el('button', 'tile') as HTMLButtonElement;
    const missing = new Set(this.economy.missing(cost).map((m) => m.kind));
    if (missing.size === 0) b.classList.add('ready');
    else b.disabled = true;

    b.append(ico(icon, 'tico'));
    const col = el('span', 'tcol');
    col.append(el('span', 'tname', label));
    const price = el('span', 'tcost');
    for (const k of RESOURCE_KINDS) {
      const v = cost[k];
      if (!v) continue;
      const bit = el('span', 'bit' + (missing.has(k) ? ' lack' : ''));
      bit.append(ico(RESOURCES[k].icon, 'ico'), el('span', undefined, fmt(v)));
      price.append(bit);
    }
    col.append(price);
    b.append(col);
    if (note) b.title = note;
    b.addEventListener('click', () => { run(); });
    return b;
  }

  private updateCrewPill(): void {
    const e = this.economy;
    const pill = this.el.crewpill;
    pill.innerHTML = '';
    pill.append(ico('crew', 'pico'));
    const col = el('span', 'pcol');
    col.append(el('strong', undefined, `${e.villagers().length}/${Math.floor(e.housing())}`));

    let status = 'Đang tự cân bằng kho';
    let mood = '';
    const d = e.state.demand;
    if (d && this.economy.demandKinds().length > 0) {
      status = `Ưu tiên xây dựng · ${d.label}`;
      mood = 'busy';
    } else if (!e.state.autoFarm) {
      const n = Object.values(e.state.assignments).reduce((s, v) => s + v, 0);
      status = n > 0 ? `Bạn đang điều ${n} người` : 'Tự điều · chưa giao ai việc gì';
      mood = n > 0 ? 'focus' : 'busy';
    } else if (e.villagers().length === 0) {
      status = 'Chưa có ai làm việc';
      mood = 'busy';
    }
    col.append(el('small', undefined, status));
    pill.append(col);
    pill.className = `crewpill ${mood}`;
  }

  private toggleSpeed(): void {
    this.economy.state.speedMult = this.economy.state.speedMult === 2 ? 1 : 2;
    this.economy.save();
    this.renderDock();
  }

  // ------------------------------------------------- thẻ kiểm tra công trình

  /**
   * Trượt lên khi bấm vào một nền đất. Bấm ra chỗ trống thì đóng lại.
   *
   * Thiếu vật liệu KHÔNG làm nút chết hẳn: bấm vào là đặt một đơn hàng, cả làng quay sang
   * gom đúng thứ còn thiếu. Nút xám chỉ nói "không được", còn thế này thì nó nói "chưa được,
   * và đây là cách để được".
   */
  /** Ai dang lam gi, bang mot cau. Day la toan bo ly do cua tinh nang nay. */
  private statusOf(u: Unit): string {
    const kindLabel = u.carryingKind ? RESOURCES[u.carryingKind].label.toLowerCase() : '';
    if (u.kind === 'cart') {
      return `Đang chở ${fmt(u.carrying)} ${kindLabel} về thủ phủ`;
    }
    switch (u.state) {
      case 'idle':
        return 'Đang chờ việc';
      case 'moving': {
        if (u.targetId === 'scout') return 'Đang đi thám hiểm vùng chưa vén';
        const n = u.targetId ? this.game.map.patchById(u.targetId) : null;
        return n ? `Đang tới ${n.label.toLowerCase()}` : 'Đang trên đường';
      }
      case 'gathering': {
        const n = u.targetId ? this.game.map.patchById(u.targetId) : null;
        const con = Math.max(0, u.gatherTimer).toFixed(1);
        return `Đang làm ở ${n ? n.label.toLowerCase() : 'bãi'} · còn ${con}s`;
      }
      case 'delivering': {
        const b = this.economy.state.buildings.find((x) => x.id === u.targetId);
        const noi = !b ? 'kho' : b.type === 'townhall' ? 'thủ phủ' : 'trạm trung chuyển';
        return `Đang chở ${fmt(u.carrying)} ${kindLabel} về ${noi}`;
      }
    }
  }

  private roleOf(u: Unit): 'cart' | 'miner' | 'carrier' | 'forester' | 'idle' {
    if (u.kind === 'cart') return 'cart';
    if (u.targetId && this.economy.state.buildings.some((b) => b.id === u.targetId)) return 'carrier';
    const kind = u.carryingKind
      ?? (u.targetId ? this.game.map.patchById(u.targetId)?.kind : undefined);
    if (!kind) return 'idle';
    return kind === 'wood' || kind === 'food' ? 'forester' : 'miner';
  }

  private renderUnitCard(u: Unit): void {
    const box = this.el.inspector;
    box.hidden = false;
    box.innerHTML = '';

    // Vai suy tu viec dang lam, khong luu thanh mot truong rieng: mot truong nhu the phai
    // duoc cap nhat o moi cho doi viec, va chi can quen mot cho la the hien sai nghe.
    const vai = this.roleOf(u);
    const icon: IconName = { cart: 'cart', miner: 'pick', carrier: 'box',
      forester: 'axe', idle: 'villager' }[vai] as IconName;
    const name = { cart: 'Xe thồ', miner: 'Thợ mỏ', carrier: 'Thợ chở hàng',
      forester: 'Thợ rừng', idle: 'Dân làng' }[vai];

    const head = el('div', 'insp-head');
    head.append(ico(icon, 'insp-ico'));
    const t = el('div', 'insp-title');
    const trangThai = this.statusOf(u)
      + (this.game.following === u.id ? ' · camera đang bám' : '');
    t.append(el('strong', undefined, name), el('small', 'live', trangThai));
    head.append(t);
    const close = el('button', 'insp-close', '×') as HTMLButtonElement;
    close.title = 'Đóng';
    close.addEventListener('click', () => {
      this.selectedUnit = null;
      this.game.select(null);
      this.renderInspector();
    });
    head.append(close);

    const body = el('div', 'insp-body');
    const row = el('div', 'insp-cost');
    const bit = (ten: IconName, text: string) => {
      const b = el('span', 'bit');
      b.append(ico(ten), el('span', undefined, text));
      return b;
    };
    if (u.carrying > 0 && u.carryingKind) {
      // Chi hien so dang vac, KHONG hien dang phan so tren suc mang. Suc mang khong phai
      // tran: do giau cua mo nhan len tren no, nen mot nguoi balo 10 vac 13 la binh thuong -
      // ma "13/10" thi doc nhu mot con so hong.
      row.append(bit(RESOURCES[u.carryingKind].icon, fmt(u.carrying)));
    } else {
      row.append(bit('basket', 'tay không'));
    }
    row.append(bit('boot', u.speed.toFixed(1)));
    row.append(bit('pack', String(Math.floor(u.capacity))));
    const xa = Math.round(Math.hypot(u.position[0], u.position[2]));
    row.append(bit('compass', `cách thủ phủ ${xa}`));
    body.append(row);

    // Bam theo nguoi nay, va ghim cho ho dang dao — hai viec nguoi choi muon lam ngay sau
    // khi nhin thay ho dang o dau.
    const acts = el('div', 'insp-choice');
    const dangBam = this.game.following === u.id;
    const follow = el('button', 'insp-go' + (dangBam ? '' : ' want')) as HTMLButtonElement;
    follow.append(ico(dangBam ? 'ringOn' : 'ring', 'bico'),
      el('span', undefined, dangBam ? 'ĐANG BÁM THEO' : 'BÁM THEO'));
    follow.title = dangBam
      ? 'Bấm để thôi bám. Kéo bản đồ hoặc gõ WASD cũng thôi bám.'
      : 'Camera đi theo người này cho tới khi bạn tự kéo bản đồ';
    follow.addEventListener('click', () => {
      this.game.setFollow(dangBam ? null : u.id);
      this.renderInspector();
    });
    acts.append(follow);

    // Tu nguoi dan nhay sang BAI ho dang lam. Day la duong di tu nhien: thay mot nguoi
    // dang vac go ve thi cai muon biet tiep theo la ho lay o dau, va o do co may nguoi.
    const patch = u.targetId ? this.game.map.patchById(u.targetId) : null;
    if (patch) {
      const go = el('button', 'insp-go want') as HTMLButtonElement;
      go.append(ico('pin', 'bico'), el('span', undefined, `XEM ${patch.label.toUpperCase()}`));
      go.addEventListener('click', () => {
        this.selectedUnit = null;
        this.game.select(null);
        this.game.pickPatch(patch.id);
        this.game.focusOnPatch(patch.id);
      });
      acts.append(go);
    }
    body.append(acts);
    box.append(head, body);
  }

  /** Bãi này đang có bao nhiêu người, và họ đang làm gì. Một dòng, làm mới liên tục. */
  private patchLine(b: Patch): string {
    const toi = this.economy.villagers().filter((v) => v.targetId === b.id);
    const dao = toi.filter((v) => v.state === 'gathering').length;
    if (toi.length === 0) {
      return this.economy.isFull(b.kind)
        ? 'Kho loại này đã đầy · chưa ai tới'
        : 'Chưa có ai làm ở đây';
    }
    return `${toi.length} người ở đây · ${dao} đang khai thác`;
  }

  /**
   * Thẻ bãi: chỗ người chơi ĐIỀU DÂN.
   *
   * Bãi là đơn vị duy nhất để ra lệnh. Nút +/− không phải là "phân bổ lao động" kiểu bảng
   * tính — nó là một câu ngắn: "cho từng này người tới chỗ này". Máy vẫn tự lo phần còn
   * lại, trừ khi người chơi tắt tự farm.
   *
   * Con số ghi lại là SỐ MUỐN, không phải số đang có. Dân đang đổ hàng hay đang trên đường
   * về thì chưa đổi chỗ được ngay, nên nếu ghi số đang có thì con số sẽ tự nhảy quanh và
   * người chơi tưởng mình bấm hỏng.
   */
  private renderPatchCard(b: Patch): void {
    const box = this.el.inspector;
    const e = this.economy;
    box.hidden = false;
    box.innerHTML = '';
    const res = RESOURCES[b.kind];

    const head = el('div', 'insp-head');
    head.append(ico(res.icon, 'insp-ico', res.color));
    const t = el('div', 'insp-title');
    const live = el('small', 'live', this.patchLine(b));
    this.patchLive = live;
    t.append(el('strong', undefined, b.label), live);
    head.append(t);
    const close = el('button', 'insp-close', '×') as HTMLButtonElement;
    close.title = 'Đóng';
    close.addEventListener('click', () => this.game.pickPatch(null));
    head.append(close);

    const body = el('div', 'insp-body');
    const row = el('div', 'insp-cost');
    const bit = (ten: IconName, text: string, cls = '') => {
      const s = el('span', 'bit' + (cls ? ' ' + cls : ''));
      s.append(ico(ten), el('span', undefined, text));
      return s;
    };
    row.append(bit(res.icon, res.label));
    /*
     * MỘT CHUYẾN ĐÁNG BAO NHIÊU VÀNG — chứ không phải hệ số giàu.
     *
     * Thẻ cũ ghi "giàu ×0,78" cho một rừng pha lê và "giàu ×1,40" cho rừng gỗ cạnh nhà, nên
     * đọc ra là rừng pha lê nghèo hơn. Sai hẳn: mỗi mảnh pha lê đáng bảy khúc gỗ, nên cùng
     * một chuyến ấy nó cho gấp mấy lần. Người chơi không có cách nào biết điều đó từ con số
     * kia. Quy hết về vàng thì so sánh được ngay, và câu hỏi "có đáng đi xa không" trả lời
     * được bằng mắt.
     */
    const moiChuyen = Math.floor(
      Math.max(1, e.capacity() * b.richness) * RESOURCES[b.kind].value);
    const chuyen = bit('gold', `${fmt(moiChuyen)} mỗi chuyến`);
    chuyen.title = `Mỗi chuyến mang về chừng ${Math.floor(e.capacity() * b.richness)}`
      + ` ${res.label.toLowerCase()} (giàu ×${b.richness.toFixed(2)}),`
      + ` bán ở thủ phủ được chừng ${fmt(moiChuyen)} vàng`;
    row.append(chuyen);
    const xa = Math.round(Math.hypot(b.center[0], b.center[2]));
    row.append(bit('compass', `cách thủ phủ ${xa}`));
    if (e.isFull(b.kind)) row.append(bit('basket', 'kho đã đầy', 'lack'));
    body.append(row);

    const giao = e.state.assignments[b.id] ?? 0;
    const tong = e.villagers().length;
    const tongGiao = () => Object.values(e.state.assignments).reduce((s, v) => s + v, 0);

    const crew = el('div', 'insp-crew');
    const lab = el('div', 'lab');
    const note = el('small', undefined, '');
    const sayLeft = () => {
      const ranh = Math.max(0, tong - tongGiao());
      note.textContent = tong === 0 ? 'Chưa thuê ai cả'
        : ranh > 0 ? `Còn ${ranh} người chưa được giao chỗ nào`
        : 'Đã giao hết người cho các bãi';
    };
    sayLeft();
    lab.append(el('strong', undefined, 'Điều dân tới đây'), note);
    crew.append(lab);

    const step = el('div', 'insp-step');
    const num = el('span', 'num', String(giao));
    const minus = el('button', undefined, '−') as HTMLButtonElement;
    const plus = el('button', undefined, '+') as HTMLButtonElement;
    const set = (v: number) => {
      const w = Math.max(0, Math.min(tong, v));
      if (w === 0) delete e.state.assignments[b.id];
      else e.state.assignments[b.id] = w;
      e.save();
      num.textContent = String(w);
      minus.disabled = w === 0;
      plus.disabled = w >= tong;
      sayLeft();
      this.updateCrewPill();
    };
    minus.disabled = giao === 0;
    plus.disabled = giao >= tong;
    minus.addEventListener('click', () => set((e.state.assignments[b.id] ?? 0) - 1));
    plus.addEventListener('click', () => set((e.state.assignments[b.id] ?? 0) + 1));
    step.append(minus, num, plus);
    crew.append(step);
    body.append(crew);

    const acts = el('div', 'insp-choice');
    const all = el('button', 'insp-go want') as HTMLButtonElement;
    all.append(ico('crew', 'bico'), el('span', undefined, 'DỒN CẢ LÀNG'));
    all.title = 'Giao hết người cho riêng bãi này, bỏ mọi chỗ đã giao trước đó';
    all.addEventListener('click', () => {
      e.state.assignments = tong > 0 ? { [b.id]: tong } : {};
      e.save();
      this.renderInspector();
      this.renderDock();
    });
    acts.append(all);

    if (tongGiao() > 0) {
      const clear = el('button', 'insp-go want') as HTMLButtonElement;
      clear.append(ico('broom', 'bico'), el('span', undefined, 'BỎ HẾT'));
      clear.title = 'Xoá mọi chỗ đã giao, trả dân về cho máy tự lo';
      clear.addEventListener('click', () => {
        e.state.assignments = {};
        e.save();
        this.renderInspector();
        this.renderDock();
      });
      acts.append(clear);
    }
    body.append(acts);

    // Giao người mà để tự farm bật thì vẫn chạy, chỉ là phần còn lại do máy lo. Tắt đi mới
    // là "chỉ làm đúng những gì tôi bảo" — nói thẳng ra, vì đó là chỗ dễ hiểu nhầm nhất.
    body.append(el('p', 'insp-note', e.state.autoFarm
      ? 'Tự farm đang BẬT: số bạn giao được ưu tiên trước, ai thừa ra thì máy tự xếp việc.'
      : 'Tự farm đang TẮT: dân chỉ tới những bãi bạn đã giao.'));

    box.append(head, body);
  }

  private renderInspector(): void {
    const box = this.el.inspector;

    if (this.selectedUnit) {
      const u = this.economy.state.units.find((x) => x.id === this.selectedUnit);
      if (u) { this.renderUnitCard(u); return; }
      this.selectedUnit = null;      // xe giao xong la bien mat
    }
    if (this.selectedPatch) {
      const b = this.game.map.patchById(this.selectedPatch);
      if (b) { this.renderPatchCard(b); return; }
      this.selectedPatch = null;          // bãi trôi ra ngoài vùng nạp
    }
    this.patchLive = null;

    const plot = this.selected ? this.game.plotById(this.selected) : null;
    if (!plot) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = '';

    const b = this.economy.buildingAt(plot.id);
    const head = el('div', 'insp-head');
    // Nut dong ro rang. Bam ra cho trong cung dong duoc, nhung khong ai doan ra dieu do neu
    // khong co gi noi.
    const close = el('button', 'insp-close', '×') as HTMLButtonElement;
    close.title = 'Dong';
    close.addEventListener('click', () => {
      this.selected = null;
      this.game.select(null);
      this.renderInspector();
    });
    const body = el('div', 'insp-body');

    if (b) {
      head.append(ico(BUILDINGS[b.type].icon, 'insp-ico'));
      const t = el('div', 'insp-title');
      t.append(el('strong', undefined, BUILDINGS[b.type].label),
        el('small', undefined, `Cấp ${b.level} · ${BUILDINGS[b.type].describe(b.level)}`));
      head.append(t);

      /*
       * Chợ nghẽn là thứ người chơi KHÔNG nhìn thấy được: kho cứ đầy lên, vàng nhỏ giọt, và
       * chẳng gì nói cho họ biết nút cần bấm nằm ở đây. Nói thẳng ra, ngay trên cái thẻ có
       * nút nâng cấp.
       */
      if (b.type === 'townhall' && this.economy.marketBusy) {
        const canh = el('p', 'insp-warn');
        canh.append(ico('warn', 'bico'), el('strong', undefined, 'Chợ đang quá tải'),
          el('span', undefined, ' — hàng về nhanh hơn mức bán được, nên phần thừa'
            + ' nằm chết trong kho. Nâng cấp thủ phủ để bán nhanh gấp đôi.'));
        body.append(canh);
      }

      if (b.level >= BUILDINGS[b.type].maxLevel) {
        body.append(el('p', 'insp-note', 'Đã kịch cấp.'));
      } else {
        const cost = this.economy.costFor(b.type, b.level);
        body.append(this.costRow(cost));
        body.append(this.bigButton('NÂNG CẤP', cost, `${BUILDINGS[b.type].label} cấp ${b.level + 1}`,
          () => this.economy.upgrade(b)));
      }
    } else {
      const biome = BIOMES[plot.biome];
      const far = Math.round(Math.hypot(plot.position[0], plot.position[2]));
      head.append(ico('box', 'insp-ico'));
      const t = el('div', 'insp-title');
      t.append(el('strong', undefined, 'Nền đất trống'),
        el('small', undefined, `${biome.label} · cách thủ phủ ${far}`));
      head.append(t);

      // Tren ban do vo han, nen nao cung xay duoc moi thu. Tram trung chuyen van doi cap 4,
      // va chi dang xay khi o xa - nen de no cuoi danh sach.
      const types: BuildingType[] = ['house', 'granary', 'outpost'];
      for (const type of types) {
        const cost = this.economy.buildCostFor(type);
        const row = el('div', 'insp-choice');
        row.append(ico(BUILDINGS[type].icon, 'insp-ico small'));
        const col = el('div', 'insp-title');
        col.append(el('strong', undefined, BUILDINGS[type].label));
        col.append(this.costRow(cost));
        row.append(col);
        row.append(this.bigButton('XÂY', cost, BUILDINGS[type].label,
          () => this.economy.build(plot, type)));
        body.append(row);
      }
    }
    head.append(close);
    box.append(head, body);
  }

  private costRow(cost: Cost): HTMLElement {
    const row = el('div', 'insp-cost');
    for (const k of RESOURCE_KINDS) {
      const need = cost[k];
      if (!need) continue;
      const have = Math.floor(this.economy.state.inv[k]);
      const bit = el('span', 'bit' + (have < need ? ' lack' : ''));
      bit.append(ico(RESOURCES[k].icon, 'ico', RESOURCES[k].color),
        el('span', undefined, `${fmt(Math.min(have, need))}/${fmt(need)}`));
      row.append(bit);
    }
    return row;
  }

  private bigButton(label: string, cost: Cost, what: string, run: () => boolean): HTMLButtonElement {
    const ok = this.economy.canAfford(cost);
    const b = el('button', 'insp-go' + (ok ? ' pulse' : ' want')) as HTMLButtonElement;
    b.textContent = ok ? label : 'GOM VẬT LIỆU';
    b.title = ok ? '' : 'Cả làng sẽ quay sang gom đúng thứ còn thiếu';
    b.addEventListener('click', () => {
      if (ok) run();
      else this.economy.setDemand(cost, what);
    });
    return b;
  }

  // ------------------------------------------------------------- minimap

  /**
   * Minimap trên bản đồ vô hạn: vẽ một CỬA SỔ quanh người chơi chứ không vẽ cả thế giới —
   * cả thế giới thì không có kích thước để mà vẽ. Khung trắng là vùng camera đang nhìn, chấm
   * giữa là thủ phủ nếu nó còn trong tầm.
   */
  private drawMap(): void {
    const c = this.el.minimap;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const span = MINIMAP_SPAN;
    const px = c.width / span;
    const ox = this.game.target.x - span / 2;
    const oz = this.game.target.z - span / 2;
    const tx = (v: number) => (v - ox) * px;
    const tz = (v: number) => (v - oz) * px;

    ctx.clearRect(0, 0, c.width, c.height);
    const step = 4;
    for (let x = ox; x < ox + span; x += step) {
      for (let z = oz; z < oz + span; z += step) {
        ctx.fillStyle = BIOMES[biomeAt(x, z)].minimap;
        ctx.fillRect(tx(x), tz(z), step * px + 1, step * px + 1);
      }
    }
    // Mây phủ những khối chưa vén.
    ctx.fillStyle = 'rgba(236,243,250,0.92)';
    for (let cx = chunkOf(ox); cx <= chunkOf(ox + span); cx += 1) {
      for (let cz = chunkOf(oz); cz <= chunkOf(oz + span); cz += 1) {
        if (this.game.fog.isRevealed(cx * CHUNK + 1, cz * CHUNK + 1)) continue;
        ctx.fillRect(tx(cx * CHUNK), tz(cz * CHUNK), CHUNK * px, CHUNK * px);
      }
    }
    // Bãi vẽ bằng ĐÚNG cỡ thật của nó, không phải một chấm. Minimap là cách duy nhất để
    // nhìn ra bố cục khu vực, nên một chấm 2 điểm ảnh thì nói được rất ít; một vòng tròn
    // đúng cỡ cho biết ngay chỗ nào đáng kéo camera tới.
    for (const b of this.game.map.patches) {
      if (!this.game.fog.isRevealed(b.center[0], b.center[2])) continue;
      const mau = `#${RESOURCES[b.kind].color.toString(16).padStart(6, '0')}`;
      const r = Math.max(2.5, b.radius * px);
      ctx.beginPath();
      ctx.arc(tx(b.center[0]), tz(b.center[2]), r, 0, 7);
      ctx.fillStyle = mau + 'bb';
      ctx.fill();
      // Bãi đã giao người thì viền vàng: nhìn minimap là biết mình đang rải dân ở đâu.
      if (this.economy.state.assignments[b.id]) {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    for (const b of this.economy.state.buildings) {
      ctx.fillStyle = b.type === 'townhall' ? '#d94e34' : '#ffffff';
      ctx.fillRect(tx(b.position[0]) - 2, tz(b.position[2]) - 2, 4, 4);
    }
    if ((Date.now() % 1000) < 550) {
      ctx.fillStyle = '#fff6d8';
      for (const u of this.economy.state.units) {
        ctx.beginPath();
        ctx.arc(tx(u.position[0]), tz(u.position[2]), u.kind === 'cart' ? 2.6 : 1.8, 0, 7);
        ctx.fill();
      }
    }
    const z = this.game.zoomLevel;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      tx(this.game.target.x - z * 0.85), tz(this.game.target.z - z * 0.55),
      z * 1.7 * px, z * 1.1 * px);
  }

  private mapClick(e: PointerEvent): void {
    const r = this.el.minimap.getBoundingClientRect();
    this.game.panTo(
      this.game.target.x + (((e.clientX - r.left) / r.width) - 0.5) * MINIMAP_SPAN,
      this.game.target.z + (((e.clientY - r.top) / r.height) - 0.5) * MINIMAP_SPAN);
  }

  // ------------------------------------------------------------- lớp phủ

  private toast(text: string, bieu?: IconName): void {
    this.el.toast.innerHTML = '';
    if (bieu) this.el.toast.append(ico(bieu, 'bico'));
    this.el.toast.append(document.createTextNode(text));
    this.el.toast.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { this.el.toast.hidden = true; }, 2600);
  }

  showOffline(r: OfflineReport): void {
    const kinds = RESOURCE_KINDS.filter((k) => (r.gained[k] ?? 0) > 0);
    if (kinds.length === 0) return;
    this.el.awayTime.textContent =
      `Bạn đi ${dur(r.elapsedSeconds)}, được tính ${dur(r.creditedSeconds)}.`;
    this.el.awayLoot.innerHTML = '';
    for (const k of kinds) {
      const li = el('li');
      li.append(ico(RESOURCES[k].icon, 'ico', RESOURCES[k].color),
        el('strong', undefined, fmt(r.gained[k] ?? 0)));
      this.el.awayLoot.append(li);
    }
    const notes: string[] = [];
    if (r.capped) notes.push('Đã chạm trần tích luỹ 2 giờ.');
    if (r.full.length) {
      notes.push(`Kho đầy ${r.full.map((k) => RESOURCES[k].label.toLowerCase()).join(', ')} nên dân phải dừng — xây thêm Kho lẫm.`);
    }
    this.el.awayCapped.textContent = notes.join(' ');
    this.el.awayCapped.hidden = notes.length === 0;
    this.el.welcome.hidden = false;
    this.renderAll();
  }

  setPaused(p: boolean): void {
    this.manualPaused = p;
    this.game.setPaused(p);
    this.el.paused.hidden = !p;
    this.el.pause.innerHTML = iconSvg(p ? 'play' : 'pause');
  }

  private toggleMute(): void {
    this.economy.state.muted = !this.economy.state.muted;
    this.applyMute();
    this.economy.save();
  }

  private applyMute(): void {
    this.el.mute.innerHTML = iconSvg(this.economy.state.muted ? 'mute' : 'sound');
    this.el.mute.setAttribute('aria-pressed', String(this.economy.state.muted));
  }

  dispose(): void {
    for (const t of this.timers) window.clearInterval(t);
    this.timers = [];
  }
}
