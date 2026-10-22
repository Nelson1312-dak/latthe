/**
 * Lớp 2D đè trên canvas: thanh tài nguyên, bảng dân, bảng nền đất, và minimap.
 *
 * Minimap vẽ bằng canvas 2D chứ không phải một cảnh Three thứ hai. Một cảnh thứ hai nghĩa là
 * một lượt render nữa mỗi khung hình cho thứ chỉ to bằng bao diêm; canvas 2D vẽ năm lần mỗi
 * giây là quá đủ mượt cho mắt và gần như không tốn gì.
 */
import {
  BIOMES, BUILDINGS, BUILD_COST, HALF, PALETTE, PLOTS, RESOURCES, WORLD, biomeAt,
} from './config';
import type { Economy } from './Economy';
import type { Game } from './Game';
import type { BuildingType, Cost, OfflineReport, ResourceKind } from './types';
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

export function fmt(n: number): string {
  const v = Math.floor(n);
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

export class UI {
  private readonly economy: Economy;
  private readonly game: Game;
  private selected: string | null = null;
  private timers: number[] = [];
  private toastTimer = 0;
  manualPaused = false;

  private compact = false;
  private compactByUser = false;
  private readonly bottom = document.querySelector('.bar-bottom') as HTMLElement;

  private readonly el = {
    resbar: $('resbar'), level: $('level'), afkcap: $('afkcap'),
    mute: $<HTMLButtonElement>('mute'), pause: $<HTMLButtonElement>('pause'),
    crew: $('crew'), panel: $('panel'),
    minimap: $<HTMLCanvasElement>('minimap'), mapbox: $('mapbox'),
    welcome: $('welcome'), awayTime: $('away-time'), awayLoot: $('away-loot'),
    awayCapped: $('away-capped'), awayOk: $<HTMLButtonElement>('away-ok'),
    paused: $('paused'), resume: $<HTMLButtonElement>('resume'), toast: $('toast'),
  };

  constructor(economy: Economy, game: Game) {
    this.economy = economy;
    this.game = game;

    game.onSelect = (id) => { this.selected = id; this.renderPanel(); };
    game.onReveal = () => {
      const b = BIOMES[biomeAt(game.target.x, game.target.z)];
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
    this.el.minimap.addEventListener('pointerdown', (e) => this.mapClick(e));

    this.applyMute();
    this.autoCompact();
    window.addEventListener('resize', () => this.autoCompact());
    this.renderAll();
    this.timers.push(window.setInterval(() => this.refresh(), STAT_MS));
    this.timers.push(window.setInterval(() => this.drawMap(), MAP_MS));
  }

  private renderAll(): void {
    this.renderResourceBar();
    this.renderCrew();
    this.renderPanel();
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
    for (const chip of Array.from(this.el.resbar.children) as HTMLElement[]) {
      const kind = chip.dataset.kind as ResourceKind;
      (chip.querySelector('.amt') as HTMLElement).textContent = fmt(s.inv[kind]);
      const r = this.economy.rates[kind];
      (chip.querySelector('.rate') as HTMLElement).textContent = `+${r.toFixed(1)}/s`;
      const full = this.economy.isFull(kind);
      chip.classList.toggle('full', full);
      chip.title = `${RESOURCES[kind].label}: ${Math.floor(s.inv[kind])}/${s.storageLimit}`
        + ` — thu ${r.toFixed(2)} mỗi giây${full ? ' · KHO ĐẦY' : ''}`;
    }
    this.el.level.textContent = String(s.level);
    this.el.afkcap.textContent = '2 giờ';
  }

  // ------------------------------------------------------------- minimap

  /**
   * Vẽ cả thế giới vào một ô vuông: nền theo biến sinh thái, ô chưa vén phủ mây, chấm cho mỏ
   * và cho dân. Khung trắng là vùng camera đang nhìn.
   */
  private drawMap(): void {
    const c = this.el.minimap;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const px = c.width / WORLD;
    const to = (v: number) => (v + HALF) * px;

    ctx.clearRect(0, 0, c.width, c.height);
    // Nền bốn vùng: vẽ thô theo ô 2 đơn vị, đủ mịn ở cỡ này.
    for (let x = -HALF; x < HALF; x += 2) {
      for (let z = -HALF; z < HALF; z += 2) {
        const soft = Math.max(Math.abs(x), Math.abs(z)) * 0.68 + Math.hypot(x, z) * 0.32;
        if (soft > HALF) continue;
        ctx.fillStyle = BIOMES[biomeAt(x, z)].minimap;
        ctx.fillRect(to(x), to(z), 2 * px + 1, 2 * px + 1);
      }
    }
    // Mây phủ phần chưa khám phá.
    ctx.fillStyle = 'rgba(236,243,250,0.92)';
    for (const chunk of this.game.fog.chunks) {
      if (chunk.revealed) continue;
      ctx.fillRect(to(chunk.center[0] - 5), to(chunk.center[1] - 5), 10 * px, 10 * px);
    }
    // Mỏ đã lộ.
    for (const n of this.game.map.nodes) {
      if (!this.game.fog.isRevealed(n.position[0], n.position[2])) continue;
      ctx.fillStyle = `#${RESOURCES[n.kind].color.toString(16).padStart(6, '0')}`;
      ctx.fillRect(to(n.position[0]) - 1, to(n.position[2]) - 1, 2.5, 2.5);
    }
    // Công trình.
    for (const b of this.economy.state.buildings) {
      ctx.fillStyle = b.type === 'townhall' ? '#d94e34' : '#ffffff';
      ctx.fillRect(to(b.position[0]) - 2, to(b.position[2]) - 2, 4, 4);
    }
    // Dân: nhấp nháy để phân biệt với mỏ đứng yên.
    const blink = (Date.now() % 1000) < 550;
    if (blink) {
      ctx.fillStyle = '#fff6d8';
      for (const u of this.economy.state.units) {
        ctx.beginPath();
        ctx.arc(to(u.position[0]), to(u.position[2]), u.kind === 'cart' ? 2.6 : 1.8, 0, 7);
        ctx.fill();
      }
    }
    // Khung nhìn.
    const z = this.game.zoomLevel;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      to(this.game.target.x - z * 0.85), to(this.game.target.z - z * 0.55),
      z * 1.7 * px, z * 1.1 * px);
  }

  private mapClick(e: PointerEvent): void {
    const r = this.el.minimap.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * WORLD - HALF;
    const z = ((e.clientY - r.top) / r.height) * WORLD - HALF;
    this.game.panTo(x, z);
  }

  // ------------------------------------------------------------- đội dân

  private renderCrew(): void {
    const box = this.el.crew;
    box.innerHTML = '';
    const a = this.economy.state.allocation;
    const total = this.economy.villagers().length;
    const assigned = a.isAuto ? 0 : RESOURCE_KINDS.reduce((s, k) => s + (a[k] ?? 0), 0);

    const head = el('div', 'crew-head');
    head.append(el('h3', undefined, 'Đội dân'));
    head.append(el('span', 'free',
      a.isAuto ? `Tự cân · ${total} dân` : `Rảnh: ${total - assigned} / Tổng: ${total}`));

    const fold = el('button', 'fold', this.compact ? '▴' : '▾') as HTMLButtonElement;
    fold.title = this.compact ? 'Mở bảng' : 'Thu gọn bảng';
    fold.addEventListener('click', () => {
      this.compact = !this.compact;
      this.compactByUser = true;
      this.applyCompact();
      this.renderCrew();
    });

    const toggle = el('label', 'toggle');
    const cb = el('input') as HTMLInputElement;
    cb.type = 'checkbox';
    cb.checked = a.isAuto;
    cb.addEventListener('change', () => {
      a.isAuto = cb.checked;
      this.economy.save();
      this.renderCrew();
    });
    toggle.append(cb, el('span', undefined, 'Tự cân'));
    head.append(toggle, fold);
    box.append(head);

    const rows = el('div', 'crew-rows');
    for (const kind of RESOURCE_KINDS) {
      const seen = this.game.map.nodes.some((n) =>
        n.kind === kind && this.game.fog.isRevealed(n.position[0], n.position[2]));
      const row = el('div', 'crew-row' + (seen ? '' : ' off'));
      row.append(el('span', 'ico', RESOURCES[kind].icon));
      const minus = el('button', 'step', '−') as HTMLButtonElement;
      const val = el('span', 'val', String(a[kind] ?? 0));
      const plus = el('button', 'step', '+') as HTMLButtonElement;
      const locked = a.isAuto || !seen;
      minus.disabled = locked || (a[kind] ?? 0) <= 0;
      plus.disabled = locked || assigned >= total;
      minus.addEventListener('click', () => { a[kind] = (a[kind] ?? 0) - 1; this.economy.save(); this.renderCrew(); });
      plus.addEventListener('click', () => { a[kind] = (a[kind] ?? 0) + 1; this.economy.save(); this.renderCrew(); });
      row.append(minus, val, plus);
      if (!seen) row.title = 'Chưa tìm thấy mỏ loại này — đi thám hiểm thêm.';
      rows.append(row);
    }
    box.append(rows);

    const actions = el('div', 'actions');
    const hire = this.costButton('Thuê dân', this.economy.hireCost(),
      () => this.economy.hire((home) => this.game.workers.spawnVillager(home)));
    if (!this.economy.canHire()) {
      hire.disabled = true;
      hire.classList.remove('buy');
      hire.title = 'Hết chỗ ở. Xây hoặc nâng Nhà ở trước.';
    }
    actions.append(hire);
    actions.append(this.costButton(`👟 Giày ${this.economy.state.speedLevel}`,
      this.economy.trainSpeedCost(), () => this.economy.trainSpeed()));
    actions.append(this.costButton(`🎒 Balo ${this.economy.state.capacityLevel}`,
      this.economy.trainCapacityCost(), () => this.economy.trainCapacity()));
    box.append(actions);
  }

  // ------------------------------------------------------------ nền đất

  private renderPanel(): void {
    const panel = this.el.panel;
    panel.innerHTML = '';
    const id = this.selected;
    const plot = id ? PLOTS.find((p) => p.id === id) : null;

    if (!plot) {
      panel.classList.add('panel-empty');
      panel.append(el('p', 'hint', this.hint()));
      return;
    }
    panel.classList.remove('panel-empty');

    const who = el('div', 'who');
    const title = el('h3');
    const meta = el('p', 'meta');
    who.append(title, meta);
    const actions = el('div', 'actions');

    const b = this.economy.buildingAt(plot.id);
    if (b) {
      title.textContent = `${BUILDINGS[b.type].icon} ${BUILDINGS[b.type].label} · cấp ${b.level}`;
      let note = BUILDINGS[b.type].describe(b.level);
      if (b.type === 'outpost') {
        const tot = Object.values(b.stock).reduce<number>((s, v) => s + (v ?? 0), 0);
        note += ` · đang gom ${Math.floor(tot)}`;
      }
      meta.textContent = note;
      if (b.level >= BUILDINGS[b.type].maxLevel) actions.append(el('p', 'meta', 'Đã kịch cấp.'));
      else actions.append(this.costButton('Nâng cấp', this.economy.costFor(b.type, b.level),
        () => this.economy.upgrade(b)));
    } else {
      const biome = BIOMES[biomeAt(plot.pos[0], plot.pos[1])];
      title.textContent = plot.kind === 'outpost' ? 'Nền trạm trung chuyển' : 'Nền đất trống';
      meta.textContent = biome.label;
      const types: BuildingType[] = plot.kind === 'outpost' ? ['outpost'] : ['house', 'granary'];
      for (const t of types) {
        actions.append(this.costButton(`${BUILDINGS[t].icon} ${BUILDINGS[t].label}`,
          BUILD_COST[t], () => this.economy.build(plot.id, t)));
      }
    }
    panel.append(who, actions);
  }

  private costButton(label: string, cost: Cost, run: () => boolean): HTMLButtonElement {
    const b = el('button', 'act') as HTMLButtonElement;
    const missing = new Set(this.economy.missing(cost).map((m) => m.kind));
    const ok = missing.size === 0;
    if (ok) b.classList.add('buy');
    b.disabled = !ok;
    b.append(el('span', 'nm', label));
    const price = el('span', 'cost');
    for (const k of RESOURCE_KINDS) {
      const need = cost[k];
      if (!need) continue;
      price.append(el('span', 'bit' + (missing.has(k) ? ' lack' : ''),
        `${RESOURCES[k].icon}${fmt(need)}`));
    }
    b.append(price);
    b.addEventListener('click', () => { run(); });
    return b;
  }

  private hint(): string {
    const e = this.economy;
    if (!e.canHire()) return 'Hết chỗ ở. Bấm một nền đất trống rồi xây Nhà ở.';
    const unseen = this.game.fog.chunks.filter((c) => !c.revealed).length;
    if (unseen > 0 && e.villagers().length < 2) {
      return 'Thuê người thứ hai: một người sẽ đi thám hiểm vén màn mây, người kia ở lại đào.';
    }
    if (e.outposts().length === 0 && unseen < 24) {
      return 'Vùng xa đi lại quá lâu. Xây Trạm trung chuyển ở đó để dân đổ hàng tại chỗ, xe thồ lo phần còn lại.';
    }
    const full = [...e.fullKinds];
    if (full.length) {
      return `Kho đầy ${full.map((k) => RESOURCES[k].label.toLowerCase()).join(', ')}. Xây thêm Kho lẫm.`;
    }
    if (unseen > 0) return `Còn ${unseen} vùng chưa khám phá. Kéo bản đồ hoặc bấm minimap để xem.`;
    return 'Bấm một nền đất để xây hoặc nâng cấp.';
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

  private autoCompact(): void {
    if (this.compactByUser) return;
    const want = window.innerWidth < 860 || window.innerHeight < 640;
    if (want === this.compact) return;
    this.compact = want;
    this.applyCompact();
    this.renderCrew();
  }

  private applyCompact(): void {
    this.bottom.classList.toggle('compact', this.compact);
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

export const PALETTE_REF = PALETTE;
