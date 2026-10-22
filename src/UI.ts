/**
 * Lớp 2D đè trên canvas. Chỉ đọc trạng thái và gọi Economy — không tự tính luật chơi ở đây.
 *
 * Thanh trên tự làm mới theo nhịp riêng (không bám vào vòng render) để số liệu vẫn nhảy đều
 * kể cả khi game đang tạm dừng, và để lúc tab chạy nền thì nó cũng bị trình duyệt bóp theo,
 * đúng như mong muốn.
 */
import {
  BUILDABLE, BUILDINGS, RESOURCES, tierSpec,
} from './config';
import type { Economy } from './Economy';
import type { Game } from './Game';
import type { Cost, OfflineReport, RawKind, ResourceKind, Slot } from './types';
import { ALL_KINDS } from './types';

const STAT_REFRESH_MS = 200;

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Thiếu phần tử #${id} trong index.html`);
  return el as T;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 1 234 -> "1,2N". Giữ ngắn để thanh trên không bị giãn khi số lớn dần. */
export function formatNumber(n: number): string {
  const v = Math.floor(n);
  if (v < 1000) return String(v);
  if (v < 1e6) return `${(v / 1e3).toFixed(1).replace('.0', '')}N`;
  if (v < 1e9) return `${(v / 1e6).toFixed(1).replace('.0', '')}Tr`;
  return `${(v / 1e9).toFixed(1).replace('.0', '')}T`;
}

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} giờ ${rem} phút` : `${h} giờ`;
}

export class UI {
  private readonly economy: Economy;
  private readonly game: Game;
  private selected: Slot | null = null;
  private statTimer: number | null = null;
  private readonly bottom = document.querySelector('.bar-bottom') as HTMLElement;
  /** Thu gọn bảng dưới còn một dòng. Ở cửa sổ nhỏ thì bật sẵn. */
  private compact = false;
  /** Người chơi đã tự bấm thu gọn chưa — bấm rồi thì đừng tự ý đổi lại khi họ chỉnh cửa sổ. */
  private compactByUser = false;

  /**
   * Người chơi có TỰ BẤM tạm dừng hay không. Khác hẳn với việc game bị dừng vì tab chạy nền:
   * lúc quay lại tab, chỉ ý muốn này mới quyết định có chạy tiếp hay không.
   */
  manualPaused = false;

  private readonly el = {
    resbar: $('resbar'),
    level: $('level'),
    expand: $<HTMLButtonElement>('expand'),
    expandLabel: $('expand-label'),
    afkcap: $('afkcap'),
    mute: $<HTMLButtonElement>('mute'),
    pause: $<HTMLButtonElement>('pause'),
    crew: $('crew'),
    panel: $('panel'),
    welcome: $('welcome'),
    awayTime: $('away-time'),
    awayCoins: $('away-coins'),
    awayCapped: $('away-capped'),
    awayOk: $<HTMLButtonElement>('away-ok'),
    paused: $('paused'),
    resume: $<HTMLButtonElement>('resume'),
  };

  constructor(economy: Economy, game: Game) {
    this.economy = economy;
    this.game = game;

    game.onSelect = (slot) => {
      this.selected = slot;
      this.renderPanel();
    };
    economy.onChange = () => {
      game.rebuildWorld();
      game.syncWorkers();
      if (this.selected) {
        this.selected = economy.state.slots.find((s) => s.id === this.selected?.id) ?? null;
        game.select(this.selected?.id ?? null);
      }
      this.renderAll();
    };

    this.el.mute.addEventListener('click', () => this.toggleMute());
    this.el.pause.addEventListener('click', () => this.setPaused(!game.isPaused));
    this.el.resume.addEventListener('click', () => this.setPaused(false));
    this.el.awayOk.addEventListener('click', () => { this.el.welcome.hidden = true; });
    this.el.expand.addEventListener('click', () => { this.economy.expandTerritory(); });

    this.applyMute();
    this.autoCompact();
    window.addEventListener('resize', () => this.autoCompact());
    this.renderAll();
    this.statTimer = window.setInterval(() => this.refreshStats(), STAT_REFRESH_MS);
  }

  /**
   * Cửa sổ nhỏ thì bảng dưới tự thu lại. Đo trước khi làm: ở 700×460, bảng Đội thợ mở hết
   * cùng dòng gợi ý chiếm 232 điểm ảnh trên tổng 460, tức HUD nuốt 63% màn hình và nửa dưới
   * hòn đảo nằm khuất, không bấm được.
   */
  private autoCompact(): void {
    if (this.compactByUser) return;
    const want = window.innerWidth < 860 || window.innerHeight < 640;
    if (want === this.compact) return;
    this.compact = want;
    this.applyCompact();
  }

  private applyCompact(): void {
    this.bottom.classList.toggle('compact', this.compact);
  }

  private renderAll(): void {
    this.renderResourceBar();
    this.renderCrew();
    this.renderPanel();
    this.refreshStats();
  }

  // ----------------------------------------------------------- thanh trên

  /**
   * Thanh tài nguyên dựng lại khi SỐ LOẠI đổi, còn con số thì cập nhật tại chỗ mỗi 200ms.
   * Dựng lại cả thanh bốn lần mỗi giây sẽ làm mất con trỏ chuột đang rê và nháy chữ.
   */
  private renderResourceBar(): void {
    this.el.resbar.innerHTML = '';
    for (const kind of this.visibleKinds()) {
      const meta = RESOURCES[kind];
      const chip = el('div', 'chip');
      chip.dataset.kind = kind;
      chip.append(el('span', 'ico', meta.icon));
      const col = el('span', 'col');
      col.append(el('strong', 'amt', '0'), el('small', 'rate', ''));
      chip.append(col);
      this.el.resbar.append(chip);
    }
    const coin = el('div', 'chip coin');
    coin.dataset.kind = 'coins';
    coin.append(el('span', 'ico', '🪙'));
    const col = el('span', 'col');
    col.append(el('strong', 'amt', '0'), el('small', 'rate', ''));
    coin.append(col);
    this.el.resbar.append(coin);
  }

  /** Loại nào đáng hiện: thô đã mở, cộng hàng chế biến khi đã có xưởng tương ứng. */
  private visibleKinds(): ResourceKind[] {
    const kinds: ResourceKind[] = [...this.economy.unlockedRaw()];
    if (this.economy.sumLevels('sawmill') > 0) kinds.push('planks');
    if (this.economy.sumLevels('masonry') > 0) kinds.push('bricks');
    return kinds;
  }

  refreshStats(): void {
    const s = this.economy.state;
    const limit = s.storageLimit;

    for (const chip of Array.from(this.el.resbar.children) as HTMLElement[]) {
      const kind = chip.dataset.kind as ResourceKind | 'coins';
      const amt = chip.querySelector('.amt') as HTMLElement;
      const rate = chip.querySelector('.rate') as HTMLElement;
      if (kind === 'coins') {
        amt.textContent = formatNumber(s.coins);
        rate.textContent = `+${this.economy.coinRate.toFixed(1)}/s`;
        chip.title = `Xu — thu ${this.economy.coinRate.toFixed(2)} mỗi giây`;
        continue;
      }
      const have = s[kind];
      amt.textContent = `${formatNumber(have)}`;
      const r = this.economy.rates[kind];
      rate.textContent = `+${r.toFixed(1)}/s`;
      const full = this.economy.isFull(kind);
      chip.classList.toggle('full', full);
      chip.title = `${RESOURCES[kind].label}: ${Math.floor(have)}/${limit}`
        + ` — thu ${r.toFixed(2)} mỗi giây${full ? ' · KHO ĐẦY' : ''}`;
    }

    this.el.level.textContent = String(s.level);
    this.el.afkcap.textContent = formatDuration(this.economy.afkCapSeconds());
    this.refreshExpandButton();
  }

  private refreshExpandButton(): void {
    const next = this.economy.nextTier();
    if (!next) {
      this.el.expand.disabled = true;
      this.el.expandLabel.textContent = 'Đảo đã mở hết';
      this.el.expand.title = 'Không còn bậc lãnh thổ nào.';
      return;
    }
    const blockers = this.economy.expandBlockers();
    const ok = blockers.level === null && blockers.missing.length === 0;
    this.el.expand.disabled = !ok;
    this.el.expand.classList.toggle('ready', ok);
    this.el.expandLabel.textContent = `Mở rộng đất · ${next.label}`;

    const parts = [`Bậc ${next.tier} — ${next.label}`, `Cần cấp căn cứ ${next.requiresLevel}`];
    for (const kind of ALL_KINDS) {
      const need = next.cost[kind as keyof Cost] as number | undefined;
      if (need) parts.push(`${RESOURCES[kind].icon} ${Math.floor(this.economy.state[kind])}/${need}`);
    }
    if (blockers.level !== null) parts.push(`Còn thiếu cấp ${blockers.level}`);
    if (blockers.needStorage !== null) {
      parts.push(`Kho chỉ chứa ${this.economy.state.storageLimit} mỗi loại,`
        + ` cần ít nhất ${blockers.needStorage} — xây thêm Kho trước.`);
    }
    this.el.expand.title = parts.join('\n');
  }

  // ------------------------------------------------------------ đội thợ

  /**
   * Bảng phân bổ thợ. Ba hàng (-/+), một công tắc Tự cân, và con số thợ rảnh.
   *
   * "Rảnh" ở đây không phải đứng chơi: thợ ngoài hạn ngạch sẽ đi CHỞ HÀNG từ xưởng về chợ.
   * Nói rõ ra trong chính nhãn, vì nếu không thì người chơi sẽ dồn hết thợ vào hạn ngạch và
   * tự bóp chết chuỗi chế biến của mình.
   */
  private renderCrew(): void {
    const box = this.el.crew;
    box.innerHTML = '';
    const a = this.economy.state.allocation;
    const total = this.economy.state.workers.length;
    const assigned = a.isAuto ? 0 : a.wood + a.stone + a.crystal;

    const head = el('div', 'crew-head');
    head.append(el('h3', undefined, 'Đội thợ'));
    const free = el('span', 'free',
      a.isAuto ? `Tự cân · ${total} thợ` : `Chở hàng: ${total - assigned} / Tổng: ${total}`);
    head.append(free);

    const fold = el('button', 'fold', this.compact ? '▴' : '▾') as HTMLButtonElement;
    fold.title = this.compact ? 'Mở bảng đội thợ' : 'Thu gọn bảng đội thợ';
    fold.setAttribute('aria-expanded', String(!this.compact));
    fold.addEventListener('click', () => {
      this.compact = !this.compact;
      this.compactByUser = true;
      this.applyCompact();
      this.renderCrew();
    });

    const toggle = el('label', 'toggle');
    const box2 = el('input') as HTMLInputElement;
    box2.type = 'checkbox';
    box2.checked = a.isAuto;
    box2.addEventListener('change', () => {
      this.game.workers.setAllocation({ isAuto: box2.checked });
      this.renderCrew();
    });
    toggle.append(box2, el('span', undefined, 'Tự cân'));
    head.append(toggle, fold);
    box.append(head);

    const rows = el('div', 'crew-rows');
    for (const kind of ['wood', 'stone', 'crystal'] as RawKind[]) {
      const unlocked = this.economy.unlockedRaw().includes(kind);
      const row = el('div', 'crew-row' + (unlocked ? '' : ' off'));
      row.append(el('span', 'ico', RESOURCES[kind].icon));
      row.append(el('span', 'nm', RESOURCES[kind].label));

      const minus = el('button', 'step', '−') as HTMLButtonElement;
      const value = el('span', 'val', String(a[kind]));
      const plus = el('button', 'step', '+') as HTMLButtonElement;
      const locked = a.isAuto || !unlocked;
      minus.disabled = locked || a[kind] <= 0;
      plus.disabled = locked || assigned >= total;
      minus.addEventListener('click', () => {
        this.game.workers.setAllocation({ [kind]: a[kind] - 1 });
        this.renderCrew();
      });
      plus.addEventListener('click', () => {
        this.game.workers.setAllocation({ [kind]: a[kind] + 1 });
        this.renderCrew();
      });
      row.append(minus, value, plus);
      if (!unlocked) row.title = 'Chưa mở — cần lên cấp căn cứ.';
      rows.append(row);
    }
    box.append(rows);

    const actions = el('div', 'actions');
    const hire = this.costButton('Thuê thợ', this.economy.hireCost(), () => this.economy.hire());
    if (!this.economy.canHire()) {
      hire.disabled = true;
      hire.classList.remove('buy');
      hire.title = 'Hết chỗ ở. Xây hoặc nâng Nhà ở trước.';
    }
    actions.append(hire);
    actions.append(this.costButton(`👟 Giày ${this.economy.state.workerSpeedLevel}`,
      this.economy.speedCost(), () => this.economy.trainSpeed()));
    actions.append(this.costButton(`🎒 Balo ${this.economy.state.workerCapacityLevel}`,
      this.economy.capacityCost(), () => this.economy.trainCapacity()));
    box.append(actions);
  }

  // ------------------------------------------------------------ bảng ô đất

  private renderPanel(): void {
    const panel = this.el.panel;
    panel.innerHTML = '';
    const slot = this.selected;

    if (!slot) {
      panel.classList.add('panel-empty');
      panel.append(el('p', 'hint', this.nextGoalHint()));
      return;
    }
    panel.classList.remove('panel-empty');

    const who = el('div', 'who');
    const title = el('h3');
    const meta = el('p', 'meta');
    who.append(title, meta);
    const actions = el('div', 'actions');

    if (slot.state === 'LOCKED') {
      title.textContent = 'Ô đất khoá';
      meta.textContent = `Bậc ${slot.tier} · mở ra để xây thêm công trình.`;
      actions.append(this.costButton('Mở ô', slot.unlockCost, () => this.economy.unlock(slot)));
    } else if (slot.state === 'UNLOCKED_EMPTY') {
      title.textContent = 'Đất trống';
      meta.textContent = 'Chọn thứ muốn xây.';
      for (const type of BUILDABLE) {
        actions.append(this.costButton(
          `${BUILDINGS[type].icon} ${BUILDINGS[type].label}`,
          this.economy.costForBuild(type),
          () => this.economy.build(slot, type)));
      }
    } else {
      const spec = BUILDINGS[slot.type as Exclude<typeof slot.type, 'none'>];
      title.textContent = `${spec.icon} ${spec.label} · cấp ${slot.level}`;
      meta.textContent = spec.describe(slot.level)
        + (slot.buffer >= 1 ? ` · ${Math.floor(slot.buffer)} đơn chờ chở` : '');
      const cost = this.economy.upgradeCost(slot);
      if (cost === null) actions.append(el('p', 'meta', 'Đã kịch cấp.'));
      else actions.append(this.costButton('Nâng cấp', cost, () => this.economy.upgrade(slot)));
    }
    panel.append(who, actions);
  }

  /**
   * Nút có bảng giá nhiều loại. Thứ nào thiếu thì tô đỏ — người chơi biết ngay phải đi kiếm
   * gì, thay vì chỉ thấy nút xám và không hiểu vì sao.
   */
  private costButton(label: string, cost: Cost, run: () => boolean): HTMLButtonElement {
    const b = el('button', 'act') as HTMLButtonElement;
    const missing = new Set(this.economy.missing(cost).map((m) => m.kind));
    const affordable = missing.size === 0;
    if (affordable) b.classList.add('buy');
    b.disabled = !affordable;

    b.append(el('span', 'nm', label));
    const price = el('span', 'cost');
    if (cost.coins > 0) {
      price.append(el('span', 'bit' + (missing.has('coins') ? ' lack' : ''),
        `🪙${formatNumber(cost.coins)}`));
    }
    for (const kind of ALL_KINDS) {
      const need = cost[kind as keyof Cost] as number | undefined;
      if (!need) continue;
      price.append(el('span', 'bit' + (missing.has(kind) ? ' lack' : ''),
        `${RESOURCES[kind].icon}${formatNumber(need)}`));
    }
    b.append(price);
    b.addEventListener('click', () => { run(); });
    return b;
  }

  /** Gợi ý việc tiếp theo — để người chơi mới không bơ vơ. */
  private nextGoalHint(): string {
    const e = this.economy;
    if (!e.canHire()) return 'Hết chỗ ở. Xây hoặc nâng Nhà ở để thuê thêm thợ.';
    if (e.sumLevels('sawmill') === 0) {
      return 'Xây Xưởng cưa: hai gỗ thành một ván, mà ván đáng gấp bốn lần gỗ.';
    }
    const stuck = e.processors().find((s) => s.buffer >= 10);
    if (stuck) return 'Hàng đang ùn ở xưởng. Bớt thợ đào lại để có người chở hàng về chợ.';
    const full = [...e.fullKinds];
    if (full.length) {
      return `Kho đầy ${full.map((k) => RESOURCES[k].label.toLowerCase()).join(', ')}. Xây thêm Kho hoặc nâng Chợ để bán nhanh hơn.`;
    }
    const next = e.nextTier();
    if (next) {
      const b = e.expandBlockers();
      if (b.needStorage !== null) {
        return `Mở ${next.label} cần ${b.needStorage} một loại, mà kho chỉ chứa ${e.state.storageLimit}. Xây thêm Kho trước.`;
      }
      if (e.state.level >= next.requiresLevel) return `Đủ cấp để mở ${next.label}. Gom nguyên liệu rồi bấm Mở rộng đất.`;
    }
    return 'Bấm vào một ô đất để xây hoặc nâng cấp.';
  }

  // ------------------------------------------------------------- lớp phủ

  showOffline(report: OfflineReport): void {
    if (report.coins <= 0) return;
    this.el.awayTime.textContent =
      `Bạn đi ${formatDuration(report.elapsedSeconds)}, được tính ${formatDuration(report.creditedSeconds)}.`;
    this.el.awayCoins.textContent = formatNumber(report.coins);

    const notes: string[] = [];
    if (report.capped) notes.push('Đã chạm trần tích luỹ 2 giờ.');
    if (report.full.length) {
      notes.push(`Kho đầy ${report.full.map((k) => RESOURCES[k].label.toLowerCase()).join(', ')} nên thợ phải dừng — xây thêm Kho.`);
    }
    this.el.awayCapped.textContent = notes.join(' ');
    this.el.awayCapped.hidden = notes.length === 0;
    this.el.welcome.hidden = false;
    this.renderAll();
  }

  setPaused(paused: boolean): void {
    this.manualPaused = paused;
    this.game.setPaused(paused);
    this.el.paused.hidden = !paused;
    this.el.pause.textContent = paused ? '▶' : '⏸';
  }

  private toggleMute(): void {
    this.economy.state.muted = !this.economy.state.muted;
    this.applyMute();
    this.economy.save();
  }

  private applyMute(): void {
    // Game chưa có âm thanh; nút vẫn có thật và trạng thái vẫn được lưu, nên lúc thêm tiếng
    // chỉ cần đọc cờ này chứ không phải sửa gì ở lớp UI.
    this.el.mute.textContent = this.economy.state.muted ? '🔇' : '🔊';
    this.el.mute.setAttribute('aria-pressed', String(this.economy.state.muted));
  }

  dispose(): void {
    if (this.statTimer !== null) window.clearInterval(this.statTimer);
    this.statTimer = null;
  }
}

/** Nhãn bậc lãnh thổ hiện tại, dùng khi cần nói gọn trong một dòng. */
export const tierLabel = (tier: number): string => tierSpec(tier).label;
