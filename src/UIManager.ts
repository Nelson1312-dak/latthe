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
import type { Economy } from './Economy';
import type { Game } from './Game';
import type { BiomeId, BuildingType, Cost, OfflineReport, ResourceKind, Unit } from './types';
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
  private timers: number[] = [];
  private toastTimer = 0;
  manualPaused = false;

  private readonly el = {
    resbar: $('resbar'), level: $('level'),
    reach: $('reach'), reachVal: $('reach-val'),
    mute: $<HTMLButtonElement>('mute'), pause: $<HTMLButtonElement>('pause'),
    crewpill: $('crewpill'), tiles: $('tiles'), speed: $<HTMLButtonElement>('speed'),
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
      this.toast(`🏅 ${label} · mốc sau ở ${Math.round(next.at)}`);
      this.el.reach.classList.add('pop');
      window.setTimeout(() => this.el.reach.classList.remove('pop'), 900);
      this.renderDock();
    };
    game.onFocusNode = (nodeId) => {
      const n = nodeId ? game.map.nodeById(nodeId) : null;
      this.toast(n ? `⭐ Ưu tiên ${RESOURCES[n.kind].label}` : 'Đã bỏ ghim mỏ');
      this.renderDock();
    };
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
      chip.append(el('span', 'ico', RESOURCES[kind].icon));
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

    this.updateCrewPill();
  }

  // ------------------------------------------------------------- dock nổi

  private renderDock(): void {
    this.updateCrewPill();
    const tiles = this.el.tiles;
    tiles.innerHTML = '';

    const hire = this.tile('👷', 'Thuê thợ', this.economy.hireCost(),
      () => this.economy.hire((h) => this.game.workers.spawnVillager(h)));
    if (!this.economy.canHire()) {
      hire.disabled = true;
      hire.classList.add('blocked');
      hire.dataset.warn = 'Hết chỗ ở (cần nâng Nhà)';
    }
    tiles.append(hire);

    tiles.append(this.tile('👟', `Giày Lv.${this.economy.state.speedLevel}`,
      this.economy.trainSpeedCost(), () => this.economy.trainSpeed(), '+10% tốc độ'));
    tiles.append(this.tile('🎒', `Balo Lv.${this.economy.state.capacityLevel}`,
      this.economy.trainCapacityCost(), () => this.economy.trainCapacity(), '+25% sức mang'));

    this.el.speed.textContent = `${this.economy.state.speedMult}×`;
    this.el.speed.classList.toggle('on', this.economy.state.speedMult === 2);
  }

  /** Ô vuông trong dock: biểu tượng, tên, giá. */
  private tile(icon: string, label: string, cost: Cost, run: () => boolean, note?: string): HTMLButtonElement {
    const b = el('button', 'tile') as HTMLButtonElement;
    const missing = new Set(this.economy.missing(cost).map((m) => m.kind));
    if (missing.size === 0) b.classList.add('ready');
    else b.disabled = true;

    b.append(el('span', 'tico', icon));
    const col = el('span', 'tcol');
    col.append(el('span', 'tname', label));
    const price = el('span', 'tcost');
    for (const k of RESOURCE_KINDS) {
      const v = cost[k];
      if (!v) continue;
      price.append(el('span', 'bit' + (missing.has(k) ? ' lack' : ''),
        `${RESOURCES[k].icon}${fmt(v)}`));
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
    pill.append(el('span', 'pico', '👷'));
    const col = el('span', 'pcol');
    col.append(el('strong', undefined, `${e.villagers().length}/${Math.floor(e.housing())}`));

    let status = 'Đang tự cân bằng kho';
    let mood = '';
    const d = e.state.demand;
    if (d && this.economy.demandKinds().length > 0) {
      status = `Ưu tiên xây dựng · ${d.label}`;
      mood = 'busy';
    } else if (e.state.focusNodeId) {
      const n = this.game.map.nodeById(e.state.focusNodeId);
      if (n) { status = `⭐ Dồn về ${RESOURCES[n.kind].label}`; mood = 'focus'; }
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
        const n = u.targetId ? this.game.map.nodeById(u.targetId) : null;
        return n ? `Đang tới mỏ ${RESOURCES[n.kind].label.toLowerCase()}` : 'Đang trên đường';
      }
      case 'gathering': {
        const n = u.targetId ? this.game.map.nodeById(u.targetId) : null;
        const con = Math.max(0, u.gatherTimer).toFixed(1);
        return `Đang khai thác ${n ? RESOURCES[n.kind].label.toLowerCase() : ''} · còn ${con}s`;
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
      ?? (u.targetId ? this.game.map.nodeById(u.targetId)?.kind : undefined);
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
    const icon = { cart: '🛻', miner: '⛏️', carrier: '📦', forester: '🪓', idle: '🧍' }[vai];
    const name = { cart: 'Xe thồ', miner: 'Thợ mỏ', carrier: 'Thợ chở hàng',
      forester: 'Thợ rừng', idle: 'Dân làng' }[vai];

    const head = el('div', 'insp-head');
    head.append(el('span', 'insp-ico', icon));
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
    const bit = (ico: string, text: string) => {
      const b = el('span', 'bit');
      b.append(el('span', 'ico', ico), el('span', undefined, text));
      return b;
    };
    if (u.carrying > 0 && u.carryingKind) {
      // Chi hien so dang vac, KHONG hien dang phan so tren suc mang. Suc mang khong phai
      // tran: do giau cua mo nhan len tren no, nen mot nguoi balo 10 vac 13 la binh thuong -
      // ma "13/10" thi doc nhu mot con so hong.
      row.append(bit(RESOURCES[u.carryingKind].icon, fmt(u.carrying)));
    } else {
      row.append(bit('🧺', 'tay không'));
    }
    row.append(bit('👟', u.speed.toFixed(1)));
    row.append(bit('🎒', String(Math.floor(u.capacity))));
    const xa = Math.round(Math.hypot(u.position[0], u.position[2]));
    row.append(bit('🧭', `cách thủ phủ ${xa}`));
    body.append(row);

    // Bam theo nguoi nay, va ghim cho ho dang dao — hai viec nguoi choi muon lam ngay sau
    // khi nhin thay ho dang o dau.
    const acts = el('div', 'insp-choice');
    const dangBam = this.game.following === u.id;
    const follow = el('button', 'insp-go' + (dangBam ? '' : ' want')) as HTMLButtonElement;
    follow.textContent = dangBam ? '◉ ĐANG BÁM THEO' : '◎ BÁM THEO';
    follow.title = dangBam
      ? 'Bấm để thôi bám. Kéo bản đồ hoặc gõ WASD cũng thôi bám.'
      : 'Camera đi theo người này cho tới khi bạn tự kéo bản đồ';
    follow.addEventListener('click', () => {
      this.game.setFollow(dangBam ? null : u.id);
      this.renderInspector();
    });
    acts.append(follow);

    const node = u.targetId ? this.game.map.nodeById(u.targetId) : null;
    if (node) {
      const pinned = this.economy.state.focusNodeId === node.id;
      const pin = el('button', 'insp-go' + (pinned ? '' : ' want')) as HTMLButtonElement;
      pin.textContent = pinned ? '★ BỎ GHIM MỎ' : '☆ GHIM MỎ NÀY';
      pin.addEventListener('click', () => {
        this.economy.state.focusNodeId = pinned ? null : node.id;
        this.economy.save();
        this.renderInspector();
        this.renderDock();
      });
      acts.append(pin);
    }
    body.append(acts);
    box.append(head, body);
  }

  private renderInspector(): void {
    const box = this.el.inspector;

    if (this.selectedUnit) {
      const u = this.economy.state.units.find((x) => x.id === this.selectedUnit);
      if (u) { this.renderUnitCard(u); return; }
      this.selectedUnit = null;      // xe giao xong la bien mat
    }
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
      head.append(el('span', 'insp-ico', BUILDINGS[b.type].icon));
      const t = el('div', 'insp-title');
      t.append(el('strong', undefined, BUILDINGS[b.type].label),
        el('small', undefined, `Cấp ${b.level} · ${BUILDINGS[b.type].describe(b.level)}`));
      head.append(t);

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
      head.append(el('span', 'insp-ico', '🧱'));
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
        row.append(el('span', 'insp-ico small', BUILDINGS[type].icon));
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
      bit.append(el('span', 'ico', RESOURCES[k].icon),
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
    for (const n of this.game.map.nodes) {
      if (!this.game.fog.isRevealed(n.position[0], n.position[2])) continue;
      ctx.fillStyle = `#${RESOURCES[n.kind].color.toString(16).padStart(6, '0')}`;
      ctx.fillRect(tx(n.position[0]) - 1, tz(n.position[2]) - 1, 2.5, 2.5);
    }
    const pin = this.economy.state.focusNodeId
      ? this.game.map.nodeById(this.economy.state.focusNodeId) : null;
    if (pin) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx(pin.position[0]), tz(pin.position[2]), 5, 0, 7);
      ctx.stroke();
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

  private toast(text: string): void {
    this.el.toast.textContent = text;
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
      li.append(el('span', 'ico', RESOURCES[k].icon), el('strong', undefined, fmt(r.gained[k] ?? 0)));
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
    this.el.pause.textContent = p ? '▶' : '⏸';
  }

  private toggleMute(): void {
    this.economy.state.muted = !this.economy.state.muted;
    this.applyMute();
    this.economy.save();
  }

  private applyMute(): void {
    this.el.mute.textContent = this.economy.state.muted ? '🔇' : '🔊';
    this.el.mute.setAttribute('aria-pressed', String(this.economy.state.muted));
  }

  dispose(): void {
    for (const t of this.timers) window.clearInterval(t);
    this.timers = [];
  }
}
