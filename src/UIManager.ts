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
import {
  AGES, BIOMES, BUILDINGS, BUILD_GROUPS, BUILD_LIMIT, BUILD_MIN_AGE, BUILD_MIN_LEVEL, KHAC,
  MINIMAP_SPAN, ORDER_HOLD_SECONDS, RESOURCES, BEASTS, DEN_FEAR, DEN_YIELD,
  SMITH_ARMOUR, SMITH_ATTACK, TROOPS, VILLAGE_COLORS, VOYAGES, WAVE_WARN_SECONDS,
  tenLangNgauNhien,
} from './config';
import { voyageSpec } from './voyage';
import { waveKind } from './raids';
import { CHUNK, biomeAt, chunkOf } from './world';
import { rewardText } from './milestones';
import { ico, iconSvg } from './icons';
import type { IconName } from './icons';
import type { Economy } from './Economy';
import { THIEU_VAT_LIEU, doiDuoc } from './Game';
import { CHO, LENH } from './WorkerManager';
import { denById, denLoot, denNearPatch, denOf, denPower, huntLosses } from './dens';
import type { Den } from './dens';
import type { Game } from './Game';
import type { Choice } from './quality';
import type {
  BiomeId, BuildingType, Cost, Inventory, OfflineReport, Patch, ResourceKind, Unit, VoyageBand,
  VoyageResult, WaveResult,
} from './types';
import { RESOURCE_KINDS, TROOP_KINDS } from './types';

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
  private selectedDen: string | null = null;
  /** Dòng chữ sống trên thẻ bãi. Giữ riêng để khỏi vẽ lại cả thẻ mỗi 200ms. */
  private patchLive: HTMLElement | null = null;
  private timers: number[] = [];
  private toastTimer = 0;
  manualPaused = false;

  private readonly el = {
    resbar: $('resbar'), level: $('level'),
    reach: $('reach'), reachVal: $('reach-val'),
    mute: $<HTMLButtonElement>('mute'), pause: $<HTMLButtonElement>('pause'),
    lapLang: $('lap-lang'), langTen: $<HTMLInputElement>('lang-ten'),
    langBoc: $<HTMLButtonElement>('lang-boc'), langMau: $('lang-mau'),
    langOk: $<HTMLButtonElement>('lang-ok'), langChip: $<HTMLButtonElement>('lang-chip'),
    langDot: $('lang-dot'), langHud: $('lang-hud'),
    gfx: $<HTMLButtonElement>('gfx'), gfxMenu: $('gfx-menu'), gfxSeg: $('gfx-seg'),
    gfxExtra: $('gfx-extra'), mapBtn: $<HTMLButtonElement>('map-btn'),
    gfxTilt: $<HTMLButtonElement>('gfx-tilt'), gfxNow: $('gfx-now'), gfxNote: $('gfx-note'),
    tiles: $('tiles'), aim: $('aim'),
    inspector: $('inspector'), dock: $('dock'),
    minimap: $<HTMLCanvasElement>('minimap'),
    welcome: $('welcome'), awayTime: $('away-time'), awayLoot: $('away-loot'),
    awayCapped: $('away-capped'), awayOk: $<HTMLButtonElement>('away-ok'),
    paused: $('paused'), resume: $<HTMLButtonElement>('resume'), toast: $('toast'),
    wave: $('wave'), waveIco: $('wave-ico'), waveKind: $('wave-kind'),
    waveClock: $('wave-clock'), waveMix: $('wave-mix'), waveVerdict: $('wave-verdict'),
    waveFill: $('wave-fill'), waveHire: $<HTMLButtonElement>('wave-hire'),
    alert: $<HTMLButtonElement>('alert'), alertIco: $('alert-ico'),
    alertTitle: $('alert-title'), alertText: $('alert-text'),
  };

  constructor(economy: Economy, game: Game) {
    this.economy = economy;
    this.game = game;

    /*
     * CHỌN MỘT THỨ TRÊN BẢN ĐỒ THÌ NGĂN ĐANG MỞ PHẢI LUI.
     *
     * Trước bản này ngăn kéo thắng mọi thẻ: mở ngăn Dân rồi bấm vào một căn nhà thì không có
     * gì xảy ra cả — vành chọn sáng lên dưới căn nhà, còn thẻ của nó thì bị ngăn Dân che. Với
     * người chơi đó là một cú bấm bị nuốt.
     */
    game.onSelect = (id) => { this.selected = id; if (id) this.dongNgan(); this.renderInspector(); };
    game.onSelectUnit = (id) => {
      this.selectedUnit = id; if (id) this.dongNgan(); this.renderInspector();
    };
    game.onLenh = (loai, n, baiId) => {
      if (n <= 0) return;
      const ai = n === 1 ? 'Một người' : `${n} người`;
      const bai = baiId ? this.game.map.patchById(baiId) : null;
      this.toast(loai === 'bai' && bai
        ? `${ai} tới làm ở ${bai.label.toLowerCase()}`
        : `${ai} lên đường · tới nơi sẽ đứng gác ${ORDER_HOLD_SECONDS} giây`, 'flag');
      this.renderInspector();
    };
    // Bấm ra đất trống đóng ngăn — trừ lúc đang đặt nhà, khi cú bấm là để chọn chỗ.
    game.onTapEmpty = () => { if (this.ngan && !this.game.placing) this.moNgan(null); };
    game.onMilestone = (label) => {
      const { next } = this.economy.milestoneInfo();
      this.toast(`${label} · mốc sau ở ${Math.round(next.at)}`, 'medal');
      this.el.reach.classList.add('pop');
      window.setTimeout(() => this.el.reach.classList.remove('pop'), 900);
      this.renderDock();
    };
    game.onSelectPatch = (id) => {
      this.selectedPatch = id; if (id) this.dongNgan(); this.renderInspector();
    };
    game.onSelectDen = (id) => {
      this.selectedDen = id; if (id) this.dongNgan(); this.renderInspector();
    };
    game.onReveal = (key) => {
      const [cx, cz] = key.split(',').map(Number);
      const b = BIOMES[biomeAt(cx * CHUNK + CHUNK / 2, cz * CHUNK + CHUNK / 2) as BiomeId];
      const hang = denOf(cx, cz);
      this.game.beasts.dirty();
      if (hang && !this.economy.isHunted(hang.id)) {
        this.toast(`Vùng mới · ${b.label} · có ${BEASTS[hang.kind].den.toLowerCase()} cấp ${hang.level}`, 'paw');
      } else this.toast(`Đã vén được vùng mới · ${b.label}`);
    };
    economy.onChange = () => {
      game.rebuildPlots();
      this.renderAll();
    };

    /*
     * ĐỢI DIỄN XONG MỚI KỂ KẾT QUẢ.
     *
     * Hậu quả đã áp xong từ lúc `resolveBattle` chạy, nên bảng kết đợt có thể hiện ra ngay
     * — nhưng hiện ngay là nói trước cái kết của một trận người chơi đang xem. Giữ nó lại
     * cho tới khi ArmyManager diễn hết.
     */
    economy.onWave = (r, seed) => {
      if (r.away) { this.showWave(r); return; }
      this.waveSauTran = r;
      game.playBattle(seed);
    };
    game.onBattleEnd = () => {
      if (!this.waveSauTran) return;
      this.showWave(this.waveSauTran);
      this.waveSauTran = null;
    };
    economy.onVoyage = (r) => this.showVoyage(r);
    this.el.waveHire.addEventListener('click', () => {
      const mua = this.economy.hireGuards();
      if (mua > 0) this.toast(`Thuê thêm ${mua} lính cho đợt này`, 'shield');
      else this.toast('Không đủ vàng để thuê lính', 'warn');
      this.renderWave();
    });
    // Bấm vào dải báo là tắt ngay — không ai muốn đợi hết sáu giây.
    this.el.alert.addEventListener('click', () => { this.el.alert.hidden = true; });
    economy.onAge = (ten) => this.bao('age', `Bước sang ${ten}`,
      this.economy.ageSpec().opens, 'won');
    economy.onDesert = (ten) => this.bao('warn', 'Hết lương, lính bỏ đi',
      `Một ${ten.toLowerCase()} rời làng. Nuôi quân phải có lương thực.`, 'lost');
    this.el.mute.addEventListener('click', () => this.toggleMute());
    this.buildLang();
    this.el.gfx.addEventListener('click', () => this.toggleGfx());
    this.el.gfxSeg.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-q]');
      if (b?.dataset.q) this.game.setQuality(b.dataset.q as Choice);
    });
    this.el.gfxTilt.addEventListener('click', () => {
      const q = this.game.quality;
      if (q.tiltAllowed) this.game.setTilt(!q.tilt);
    });
    // Bấm ra ngoài thì đóng bảng — kể cả bấm xuống bản đồ.
    document.addEventListener('pointerdown', (e) => {
      const t = e.target as Node;
      if (!this.el.gfxMenu.hidden && !this.el.gfxMenu.contains(t) && !this.el.gfx.contains(t)) this.closeGfx();
    });
    game.onQuality = () => this.renderGfx();
    this.el.gfx.innerHTML = iconSvg('gear');
    this.el.mapBtn.innerHTML = iconSvg('map');
    this.el.mapBtn.addEventListener('click', () => {
      const mo = document.body.classList.toggle('map-mo');
      this.el.mapBtn.setAttribute('aria-pressed', String(mo));
      if (mo) this.drawMap();
    });
    this.xepHud();
    window.addEventListener('resize', () => this.xepHud());
    this.renderGfx();
    // Chưa có tên thì hỏi ngay. Không tạm dừng game: đây là game nhàn rỗi, vài giây đầu
    // người chơi gõ tên thì dân vẫn cứ làm việc, mất mát bằng không.
    if (!this.economy.state.village.name) this.openLang(true);
    this.el.pause.addEventListener('click', () => this.setPaused(!game.isPaused));
    this.el.resume.addEventListener('click', () => this.setPaused(false));
    this.el.awayOk.addEventListener('click', () => {
      this.el.welcome.hidden = true;
      // Bảng kết đợt đợi tới đây mới hiện: chồng lên bảng "đi vắng" thì che mất chính cái
      // tiêu đề của nó, và người chơi đọc được một nửa của cả hai.
      if (this.waveCho) { this.showWave(this.waveCho); this.waveCho = null; }
      else if (this.voyageCho) { this.showVoyage(this.voyageCho); this.voyageCho = null; }
    });

    this.buildDock();
    game.onGhost = () => { if (this.xayMo) this.renderInspector(); };
    this.el.minimap.addEventListener('pointerdown', (e) => this.mapClick(e));

    this.applyMute();
    // Nut tam dung phai co icon NGAY TU DAU. setPaused() chi chay khi nguoi choi bam, nen
    // de no tu dat icon thi luc mo game cai nut la mot o trang tron.
    this.el.pause.innerHTML = iconSvg(this.game.isPaused ? 'play' : 'pause');
    this.renderAll();
    this.timers.push(window.setInterval(() => this.refresh(), STAT_MS));
    this.timers.push(window.setInterval(() => this.drawMap(), MAP_MS));
  }

  // ----------------------------------------------------------- mùa bão

  /** Đợt xảy ra lúc vắng mặt, chờ người chơi đóng bảng "đi vắng" rồi mới kể. */
  private waveCho: WaveResult | null = null;
  /** Kết quả đang giữ lại trong lúc trận còn đang diễn trên bản đồ. */
  private waveSauTran: WaveResult | null = null;

  /**
   * Bảng mùa bão, vẽ lại mỗi 200ms cùng phần còn lại của HUD.
   *
   * Hai con số thủ/giặc là toàn bộ thông tin người chơi cần: thiếu bao nhiêu thì biết ngay
   * phải xây thêm chòi hay gọi dân về. Không có thanh máu, không có phần trăm — một phép trừ
   * đọc được trong nửa giây giữa lúc đang làm việc khác.
   */
  /**
   * Dải đợt trên đầu màn hình.
   *
   * Bản trước giấu nó ở góc dưới bên trái dưới dạng "Thủ 68 · Giặc 32" — hai con số không
   * nói ra là gì, cạnh nhau mà không nói quan hệ. Trong một game thủ thành thì "giặc tới
   * khi nào, bằng gì, mình có đủ không" là CÂU HỎI DUY NHẤT, nên nó lên đầu màn, và trả
   * lời bằng chữ chứ không bằng hai con số trần.
   */
  private renderWave(): void {
    const t = this.economy.state.threat;
    const kind = waveKind(t.wave + 1);
    const guard = this.economy.guard();
    const power = this.economy.wavePower();
    const gan = t.next <= WAVE_WARN_SECONDS;
    const e = this.el;

    e.waveIco.innerHTML = iconSvg(kind === 'storm' ? 'storm' : 'raid');
    e.waveKind.textContent = kind === 'storm' ? 'Bão tới' : 'Cướp biển tới';
    const giay = Math.max(0, Math.ceil(t.next));
    e.waveClock.textContent = `${Math.floor(giay / 60)}:${String(giay % 60).padStart(2, '0')}`;

    // Thành phần đợt: biểu tượng kèm số. Luật khắc chế chỉ có nghĩa khi nhìn thấy trước.
    const mix = this.economy.waveMix();
    e.waveMix.innerHTML = '';
    for (const k of TROOP_KINDS) {
      if (mix[k] <= 0) continue;
      const sp = el('span');
      sp.title = TROOPS[k].label;
      sp.append(ico(TROOPS[k].icon, 'gico'), el('b', undefined, String(mix[k])));
      e.waveMix.append(sp);
    }

    const thieu = power - guard;
    e.waveVerdict.textContent = thieu <= 0 ? 'Đủ sức giữ' : `Còn thiếu ${thieu} sức thủ`;
    e.waveFill.style.width = `${Math.round(100 - (t.next / this.economy.waveGap()) * 100)}%`;
    e.wave.classList.toggle('gan', gan);
    e.wave.classList.toggle('thieu', thieu > 0);

    /*
     * Nút thuê lính chỉ hiện khi CÓ VIỆC CHO NÓ: đang thiếu và đồng hồ đã đỏ. Sáng suốt
     * bốn phút thì nó thành đồ trang trí, mà cái cần là thấy nó đúng lúc nó có nghĩa.
     */
    const gia = thieu > 0 ? thieu * this.economy.mercPrice() : 0;
    const du = this.economy.state.inv.gold >= gia;
    e.waveHire.hidden = !gan || thieu <= 0;
    e.waveHire.textContent = du
      ? `Thuê lính · ${fmt(gia)}`
      : `Thuê tạm · ${fmt(Math.floor(this.economy.state.inv.gold))}`;
  }

  // ------------------------------------------------------------ báo sự kiện

  /** Lúc dải báo hiện ra, theo đồng hồ thật. 0 là đang tắt. */
  private baoLuc = 0;

  /**
   * Một dải mảnh trượt xuống dưới thanh trên rồi tự tắt.
   *
   * Bản trước là một thẻ to giữa màn hình, và nó nằm lì ở đó — bộ đếm giờ lỡ một nhịp (tab
   * bị bóp, máy ngủ) là không ai tắt nó nữa. Giờ hạn tắt kiểm bằng ĐỒNG HỒ THẬT trong
   * `refresh()`, nên không còn đường nào kẹt lại.
   */
  private bao(icon: IconName, title: string, text: string, tone: '' | 'won' | 'lost'): void {
    const e = this.el;
    e.alertIco.innerHTML = iconSvg(icon);
    e.alertTitle.textContent = title;
    e.alertText.textContent = text;
    e.alert.classList.toggle('won', tone === 'won');
    e.alert.classList.toggle('lost', tone === 'lost');
    e.alert.hidden = false;
    this.baoLuc = Date.now();
  }

  /**
   * Liệt kê của cải, chỉ hai món NẶNG NHẤT rồi "và N món nữa".
   *
   * Liệt kê đủ năm loại thì dải báo cao năm dòng và che mất bản đồ — mà đọc hết năm con số
   * cũng chẳng để làm gì: cái người chơi cần biết là mất NHIỀU hay ÍT, và mất cái gì đau
   * nhất. Bảng kho trên đầu màn vẫn nói đủ con số chính xác.
   */
  private lootText(inv: Partial<Inventory>, toiDa = 2): string {
    const co = RESOURCE_KINDS.filter((k) => (inv[k] ?? 0) > 0)
      .sort((a, b) => (inv[b] ?? 0) - (inv[a] ?? 0));
    const chu = co.slice(0, toiDa)
      .map((k) => `${fmt(inv[k] ?? 0)} ${RESOURCES[k].label.toLowerCase()}`)
      .join(', ');
    const con = co.length - toiDa;
    return con > 0 ? `${chu} và ${con} món nữa` : chu;
  }

  private showWave(r: WaveResult): void {
    const ten = r.kind === 'storm' ? 'Bão' : 'Cướp biển';
    const mat = this.lootText(r.lost);
    let title: string;
    const bits: string[] = [`Hạ ${r.killed}/${r.count} tên`];
    if (r.won) {
      title = `Đẩy lui ${ten.toLowerCase()}`;
      const thu = this.lootText(r.reward);
      if (thu) bits.push(`nhặt được ${thu}`);
    } else if (r.kind === 'storm') {
      title = r.levels > 0 ? `Bão đánh sập ${r.levels} cấp công trình` : 'Bão càn qua làng';
      if (mat) bits.push(`cuốn đi ${mat}`);
    } else {
      title = mat ? 'Cướp biển khoắng kho' : 'Cướp biển tới, chẳng vơ được gì';
      if (mat) bits.push(`mất ${mat}`);
    }
    if (r.escaped > 0) bits.push(`${r.escaped} tên chạy thoát`);
    if (r.away) bits.push('lúc bạn đi vắng');
    this.bao(r.kind === 'storm' ? 'storm' : 'raid', title, bits.join(' · '),
      r.won ? 'won' : 'lost');
    // Cú đập: thua bão rung mạnh nhất, đẩy lui được thì chỉ giật một cái cho biết.
    this.game.shake(r.won ? 0.3 : r.kind === 'storm' ? 1 : 0.6);
  }

  // ----------------------------------------------------------- đi biển

  /** Chuyến đi biển cập bến lúc vắng mặt, kể sau khi đóng bảng "đi vắng". */
  private voyageCho: VoyageResult | null = null;

  private goSea(band: VoyageBand): void {
    const vi = this.economy.voyageBlock(band);
    if (vi) { this.toast(vi, 'warn'); return; }
    const sp = voyageSpec(band);
    if (!this.economy.startVoyage(band)) return;
    this.toast(`${sp.crew} người lên thuyền · ${sp.label}`, sp.icon);
    this.renderInspector();
  }

  private showVoyage(r: VoyageResult): void {
    const sp = voyageSpec(r.band);
    if (r.outcome === 'lost') {
      this.bao(sp.icon, 'Thiếu một người về', `${sp.label} · ${r.where}`, 'lost');
    } else if (r.outcome === 'empty') {
      this.bao(sp.icon, 'Thuyền về tay không', `${r.where} · đã có người tới trước`, 'lost');
    } else {
      const thu = this.lootText({ gold: r.gold, relics: r.relics }) || 'không có gì đáng kể';
      this.bao(sp.icon, 'Thuyền về', `${r.where} · ${thu}`, 'won');
    }
    this.renderAll();
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
      const chip = el('button', 'chip');
      chip.dataset.kind = kind;
      chip.append(ico(RESOURCES[kind].icon, 'ico', RESOURCES[kind].color));
      const col = el('span', 'col');
      col.append(el('strong', 'amt', '0'), el('small', 'rate', ''));
      // Vạch sức chứa: con số "1.2N" không nói nó đang ở 20% hay 99% kho, mà hai trường hợp
      // ấy đòi hai việc khác hẳn nhau — cứ gom tiếp, hay đi xây kho lẫm.
      const cap = el('span', 'cap');
      cap.append(el('i'));
      chip.append(col, cap);
      // Màn cảm ứng không có rê chuột, nên dòng `title` không bao giờ hiện. Bấm thì đọc ra.
      chip.addEventListener('click', () => this.docKho(kind));
      this.el.resbar.append(chip);
    }
  }

  refresh(): void {
    // Dải đợt treo ngay dưới thanh trên, mà thanh ấy cao thấp tuỳ số dòng chữ xuống hàng.
    const cao = this.el.resbar.closest('.bar')?.getBoundingClientRect().bottom ?? 112;
    document.documentElement.style.setProperty('--bar-h', `${Math.round(cao)}px`);
    this.renderWave();
    // Hạn tắt kiểm bằng ĐỒNG HỒ THẬT, không bằng setTimeout: bộ đếm giờ lỡ một nhịp (tab
    // bị bóp, máy ngủ) là dải báo nằm lì giữa màn — đúng cái lỗi vừa phải đi sửa.
    if (this.baoLuc && Date.now() - this.baoLuc > 5200) {
      this.baoLuc = 0;
      this.el.alert.hidden = true;
    }
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
      const day = s.storageLimit > 0 ? Math.min(1, s.inv[kind] / s.storageLimit) : 0;
      chip.style.setProperty('--p', `${Math.round(day * 100)}%`);
      chip.classList.toggle('gan', !full && day >= 0.85);
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
    if (this.hep) {
      this.mocNote.textContent = `Mốc kế: ${next.label} ở ${Math.round(next.at)}`
        + ` (còn ${thieu}) — ${rewardText(next)}`;
    }

    /*
     * GIÁ SỐNG. Trước bản này ô giá chỉ đúng tại lúc thẻ được vẽ: gom đủ gỗ rồi mà nút vẫn
     * ghi GOM VẬT LIỆU cho tới khi người chơi đóng thẻ mở lại. Vẽ lại cả thẻ mỗi 200ms thì
     * lại nuốt cú bấm (chuột xuống trên nút cũ, lên trên nút mới). Nên: mỗi nhịp chỉ sửa
     * chữ và màu của từng ô giá, và CHỈ vẽ lại thẻ đúng lúc một ô đổi từ thiếu sang đủ
     * hay ngược lại — chuyện xảy ra vài lần một phút chứ không phải năm lần một giây.
     */
    let lat = false;
    for (const g of this.giaSong) {
      const co = Math.floor(s.inv[g.kind]);
      const thieuMon = co < g.need;
      if (g.txt) g.txt.textContent = `${fmt(Math.min(co, g.need))}/${fmt(g.need)}`;
      if (thieuMon !== g.lack) { g.lack = thieuMon; lat = true; }
    }
    if (lat && !this.selectedUnit) this.renderInspector();

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

  // --------------------------------------------------------------- dock

  /*
   * MỘT THANH, BỐN NGĂN.
   *
   * Bản trước có sáu mặt rời nhau — thanh tài nguyên, minimap, bảng bão, bảng đi biển, thẻ
   * kiểm tra, dock — rải ra bốn góc màn hình, và người chơi phải đi tìm từng cái. Giờ mọi
   * việc LÀM ĐƯỢC nằm trong một thanh duy nhất ở đáy màn, mỗi nút mở một ngăn kéo ngay
   * trên nó. Mắt chỉ còn phải nhìn hai chỗ: dải đợt trên đầu, và thanh này.
   */

  private ngan: 'dan' | 'xay' | 'quan' | 'bien' | null = null;
  /** Loại đang cầm trên tay. null = ngăn xây đang ở BẢNG CHỌN, chưa có mô hình mờ nào. */
  private xayType: BuildingType | null = null;
  private xayNhom: (typeof BUILD_GROUPS)[number]['id'] = 'dan';
  /** Các ô giá đang hiện, để `refresh()` sửa tại chỗ thay vì vẽ lại cả thẻ. */
  private giaSong: { el: HTMLElement; txt: HTMLElement | null; kind: ResourceKind;
    need: number; lack: boolean }[] = [];
  /** Màn hẹp (≤ 620): thanh trên chỉ còn tài nguyên, mấy thứ ít bấm dọn vào bảng cài đặt. */
  private hep = false;
  private hepDaXep = false;
  private readonly mocNote = el('p', 'gfx-moc');

  private get xayMo(): boolean { return this.ngan === 'xay'; }

  private buildDock(): void {
    const nut = (
      key: 'dan' | 'xay' | 'quan' | 'bien', icon: IconName, ten: string,
    ): HTMLButtonElement => {
      const b = el('button', 'tile') as HTMLButtonElement;
      b.dataset.ngan = key;
      b.append(ico(icon, 'tico'));
      const col = el('span', 'tcol');
      col.append(el('span', 'tname', ten), el('small', 'tsub', ''));
      b.append(col);
      b.addEventListener('click', () => this.moNgan(this.ngan === key ? null : key));
      return b;
    };
    this.el.tiles.innerHTML = '';
    this.el.tiles.append(
      nut('dan', 'crew', 'Dân'),
      nut('xay', 'hammer', 'Xây'),
      nut('quan', 'spear', 'Quân'),
      nut('bien', 'compass', 'Biển'),
    );
    /*
     * NÚT "DÂN TỰ CHỌN VIỆC" KHÔNG CÒN Ở DOCK.
     *
     * Đo trên khung 375: sáu nút rộng 398 điểm ảnh trong một thanh chỉ còn 343, và nút bị
     * cắt là nút tốc độ. Cái phải đi là nút tự chọn việc: nó bật một lần rồi thôi cả ván,
     * mà lại chiếm chỗ ngang với bốn nút bấm liên tục. Giờ nó nằm trong chính ngăn Dân —
     * ngay cạnh dòng chữ vẫn luôn giải thích nó làm gì.
     */
    const speed = el('button', 'tile speed') as HTMLButtonElement;
    speed.addEventListener('click', () => this.toggleSpeed());
    this.el.tiles.append(speed);
    this.dockSpeed = speed;
  }

  private dockSpeed: HTMLButtonElement | null = null;

  /*
   * XÂY LÀ HAI BƯỚC TÁCH HẲN: CHỌN CÁI GÌ, RỒI CHỌN Ở ĐÂU.
   *
   * Bản trước gộp cả hai vào một bảng: mười ba dòng loại nhà, dưới cùng là nút ĐẶT, và mô
   * hình mờ đã đứng sẵn trên bản đồ từ lúc mở ngăn. Trên khung 375×812 cái bảng ấy cao hơn
   * cả màn hình — nút ĐẶT nằm ngoài mép dưới, còn chỗ định xây thì nằm sau lưng bảng.
   * Giờ mở ngăn chỉ thấy bảng chọn (ba nhóm, mỗi nhóm bốn năm thẻ); bấm một thẻ thì bảng
   * co lại thành một thanh hai nút và trả màn hình cho việc ngắm chỗ.
   */
  private moNgan(k: 'dan' | 'xay' | 'quan' | 'bien' | null): void {
    // Mở ngăn là bỏ thứ đang chọn: thẻ người dân và thẻ bãi được vẽ trước ngăn, nên để
    // nguyên thì bấm nút dock mà không thấy ngăn nào mở ra.
    if (k) { this.selected = null; this.game.boChon(); }
    this.ngan = k;
    this.xayType = null;
    this.game.setPlacing(null);
    this.datLop();
    this.renderDock();
    this.renderInspector();
  }

  /** Đóng ngăn mà KHÔNG vẽ lại thẻ — cho những chỗ ngay sau đó tự vẽ. */
  private dongNgan(): void {
    if (!this.ngan) return;
    this.ngan = null;
    this.xayType = null;
    this.game.setPlacing(null);
    this.datLop();
    this.renderDock();
  }

  /** Lớp trên <body> và khung ngắm đi theo đúng một điều: có đang cầm mô hình mờ không. */
  private datLop(): void {
    const dat = this.game.placing !== null;
    document.body.classList.toggle('xay', this.ngan === 'xay');
    document.body.classList.toggle('dat', dat);
    this.el.aim.hidden = !dat;
  }

  /** Cầm một loại nhà lên (hoặc null để quay về bảng chọn). */
  private chonXay(t: BuildingType | null): void {
    this.xayType = t;
    this.game.setPlacing(t);
    this.datLop();
    this.renderDock();
    this.renderInspector();
  }

  /** Nhấc một công trình đã có lên để đặt lại chỗ khác. */
  private doiNha(id: string): void {
    const b = this.economy.buildingById(id);
    if (!b) return;
    this.selected = null;
    this.game.boChon();
    if (!this.game.startMove(id)) { this.toast('Công trình này không dời được', 'warn'); return; }
    this.ngan = 'xay';
    this.xayType = b.type;
    this.datLop();
    this.renderDock();
    this.renderInspector();
  }

  /** Bấm một ô tài nguyên: đọc ra đúng những gì dòng `title` nói với người dùng chuột. */
  private docKho(kind: ResourceKind): void {
    const e = this.economy;
    const s = e.state;
    const r = e.rates[kind];
    const them = e.isFull(kind) ? ' · KHO ĐẦY, xây thêm kho lẫm'
      : kind !== 'gold' && e.marketBusy && s.inv[kind] > e.reserveOf(kind) * 1.5
        ? ' · chợ bán không kịp' : '';
    this.toast(`${RESOURCES[kind].label} ${fmt(s.inv[kind])}/${fmt(s.storageLimit)}`
      + ` · +${(Number.isFinite(r) ? r : 0).toFixed(1)}/giây${them}`);
  }

  /**
   * Xếp lại thanh trên theo bề rộng màn.
   *
   * Đo trên khung 375: thanh trên xuống HAI dòng (tài nguyên, rồi tên làng + cấp + xa + ba
   * nút tròn), cộng dải đợt là ba tầng — 170 điểm ảnh, hơn một phần năm màn hình, cho những
   * thứ phần lớn không bấm tới một lần mỗi ván. Màn hẹp thì dòng một chỉ còn tài nguyên;
   * ba nút hay bấm (bản đồ, cài đặt, tạm dừng) thành một cột mảnh bên phải; còn tên làng,
   * cấp, quãng xa và nút âm dọn vào bảng cài đặt. Dời THẺ chứ không dựng thẻ thứ hai, để
   * mọi chỗ đang ghi vào `#level`, `#reach-val`… không phải biết mình đang ở đâu.
   */
  private xepHud(): void {
    const hep = window.matchMedia('(max-width: 620px)').matches;
    if (this.hepDaXep && hep === this.hep) return;
    this.hep = hep;
    this.hepDaXep = true;
    const group = this.el.gfx.parentElement as HTMLElement;
    const cap = this.el.level.closest('.stat') as HTMLElement;
    const x = this.el.gfxExtra;
    if (hep) {
      x.append(this.el.langChip, cap, this.el.reach, this.el.mute, this.mocNote);
    } else {
      group.prepend(this.el.langChip, cap, this.el.reach);
      this.el.gfx.after(this.el.mute);
    }
    x.hidden = !hep;
    this.closeGfx();
  }

  private renderDock(): void {
    const e = this.economy;
    const sub: Record<string, string> = {
      dan: `${e.villagers().length}/${e.housing()}`,
      xay: this.xayType ? BUILDINGS[this.xayType].label : `${e.state.buildings.length} nhà`,
      quan: `${e.armySize()}${e.trainLeft() > 0 ? ' · đang rèn' : ''}`,
      bien: e.state.voyage ? `${Math.ceil(e.state.voyage.left / e.voyageSpeed())}s` : 'Rảnh',
    };
    for (const b of Array.from(this.el.tiles.children) as HTMLElement[]) {
      const k = b.dataset.ngan;
      if (!k) continue;
      b.classList.toggle('ready', this.ngan === k);
      const t = b.querySelector('.tsub');
      if (t) t.textContent = sub[k] ?? '';
    }
    if (this.dockSpeed) {
      this.dockSpeed.textContent = e.state.speedMult === 2 ? '2×' : '1×';
      this.dockSpeed.classList.toggle('ready', e.state.speedMult === 2);
    }
  }

  private toggleFarm(): void {
    const e = this.economy;
    e.state.autoFarm = !e.state.autoFarm;
    e.save();
    this.toast(e.state.autoFarm ? 'Dân tự chọn việc' : 'Dân chỉ làm chỗ bạn ghim', 'robot');
    this.renderDock();
    this.renderInspector();
  }

  private toggleSpeed(): void {
    const e = this.economy;
    e.state.speedMult = e.state.speedMult === 2 ? 1 : 2;
    e.save();
    this.renderDock();
  }

  // ------------------------------------------------------------- các ngăn

  /** Một dòng bấm được trong ngăn kéo. */
  private row(
    icon: IconName, ten: string, phu: string, gia: Cost | null,
    chan: string | null, lam: () => void, lieu = false,
  ): HTMLElement {
    const b = el('button', 'row' + (lieu ? ' lieu' : '')) as HTMLButtonElement;
    b.append(ico(icon, 'gico'));
    const col = el('div', 'col');
    col.append(el('b', undefined, ten), el('small', undefined, chan ?? phu));
    b.append(col);
    if (gia) b.append(this.costRow(gia, true));
    b.disabled = chan !== null;
    b.addEventListener('click', lam);
    return b;
  }

  private sheetHead(ten: string, phu: string): HTMLElement {
    const h = el('div', 'sheet-head');
    // Nút đóng ngay trên ngăn. Bấm lại nút dock cũng đóng được, nhưng nút dock lúc ấy nằm
    // DƯỚI ngăn và trông y như lúc chưa mở — không ai đoán ra.
    const dong = el('button', 'insp-close', '×') as HTMLButtonElement;
    dong.title = 'Đóng';
    dong.setAttribute('aria-label', 'Đóng');
    dong.addEventListener('click', () => this.moNgan(null));
    h.append(el('strong', undefined, ten), el('small', undefined, phu), dong);
    return h;
  }

  private renderNgan(): void {
    const box = this.el.inspector;
    box.hidden = false;
    box.innerHTML = '';
    const sheet = el('div', 'sheet');
    box.append(sheet);
    const e = this.economy;

    if (this.ngan === 'dan') {
      sheet.append(this.sheetHead('Dân làng',
        `${e.villagers().length} người · chỗ ở cho ${e.housing()}`));
      sheet.append(this.row('crew', 'Thuê thêm một người', 'Thêm một người đi gom hàng',
        e.hireCost(), e.canHire() ? null : 'Hết chỗ ở — xây thêm nhà',
        () => { e.hire((h) => this.game.workers.spawnVillager(h)); this.renderInspector(); }));
      sheet.append(this.row('boot', `Chạy nhanh hơn · bậc ${e.state.speedLevel}`,
        'Cả làng đi lại nhanh hơn 10%', e.trainSpeedCost(), null,
        () => { e.trainSpeed(); this.renderInspector(); }));
      sheet.append(this.row('pack', `Mang nặng hơn · bậc ${e.state.capacityLevel}`,
        'Mỗi chuyến cõng thêm 25%', e.trainCapacityCost(), null,
        () => { e.trainCapacity(); this.renderInspector(); }));
      const tu = e.state.autoFarm;
      const nutTu = this.row(tu ? 'robot' : 'hand',
        tu ? 'Dân đang tự chọn việc' : 'Bạn đang tự điều dân',
        tu ? 'Bấm để chỉ làm những bãi bạn ghim' : 'Bấm để dân tự chọn bãi',
        null, null, () => { this.toggleFarm(); this.renderInspector(); });
      nutTu.classList.toggle('on', tu);
      sheet.append(nutTu);
      sheet.append(el('p', 'sheet-note', tu
        ? 'Dân đang tự chọn bãi gần và đang vơi nhất. Ghim một bãi thì họ ưu tiên chỗ đó.'
        : 'Dân chỉ tới những bãi bạn đã ghim.'));
      return;
    }

    if (this.ngan === 'bien') {
      const v = e.state.voyage;
      if (v) {
        const sp = voyageSpec(v.band);
        const con = Math.max(0, Math.ceil(v.left / e.voyageSpeed()));
        sheet.append(this.sheetHead('Đang ngoài khơi',
          `${sp.label} · ${v.crew.length} người · còn ${Math.floor(con / 60)}:${String(con % 60).padStart(2, '0')}`));
        sheet.append(el('p', 'sheet-note',
          'Về rồi mới đi chuyến khác được. Người đi biển không gác làng.'));
        return;
      }
      sheet.append(this.sheetHead('Đi biển', 'Đổi người lấy của, mỗi lúc một chuyến'));
      for (const sp of VOYAGES) {
        const chan = e.voyageBlock(sp.id);
        const phut = String(Math.round(sp.seconds / 60 * 10) / 10).replace('.', ',');
        sheet.append(this.row(sp.icon, sp.label,
          `${sp.crew} người · ${phut} phút · ${sp.blurb}`,
          { food: sp.food }, chan, () => this.goSea(sp.id), sp.lost > 0));
      }
      sheet.append(el('p', 'sheet-note', 'Người đi biển không gác làng.'));
      return;
    }

    if (this.ngan === 'quan') {
      this.renderQuan(sheet);
      return;
    }

    // --- ngăn xây: đang cầm một loại thì là thanh đặt, chưa cầm gì thì là bảng chọn
    if (this.xayType) this.renderDat(sheet, this.xayType);
    else this.renderChonNha(sheet);
  }

  /** Vì sao loại này chưa xây được, hoặc null. Cùng một câu cho thẻ và cho thanh đặt. */
  private khoaNha(t: BuildingType): string | null {
    const e = this.economy;
    if (e.state.age < (BUILD_MIN_AGE[t] ?? 0)) return `Cần ${AGES[(BUILD_MIN_AGE[t] ?? 1) - 1].label}`;
    if (e.state.level < (BUILD_MIN_LEVEL[t] ?? 0)) return `Cần căn cứ cấp ${BUILD_MIN_LEVEL[t]}`;
    const tran = BUILD_LIMIT[t];
    if (tran !== undefined && e.countOf(t) >= tran) return `Đã đủ ${tran} cái — nâng cấp cái đang có`;
    return null;
  }

  /** Bước một: chọn CÁI GÌ. Ba nhóm, mỗi loại một thẻ có tên, tác dụng, đã có mấy cái, giá. */
  private renderChonNha(sheet: HTMLElement): void {
    const e = this.economy;
    sheet.append(this.sheetHead('Xây công trình', 'Chọn loại, rồi chọn chỗ'));
    const tabs = el('div', 'tabs');
    tabs.setAttribute('role', 'tablist');
    for (const g of BUILD_GROUPS) {
      const b = el('button', 'tab' + (g.id === this.xayNhom ? ' on' : ''), g.label) as HTMLButtonElement;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(g.id === this.xayNhom));
      b.addEventListener('click', () => { this.xayNhom = g.id; this.renderInspector(); });
      tabs.append(b);
    }
    sheet.append(tabs);

    const luoi = el('div', 'nha-luoi');
    const nhom = BUILD_GROUPS.find((g) => g.id === this.xayNhom) ?? BUILD_GROUPS[0];
    for (const t of nhom.types as readonly BuildingType[]) {
      const spec = BUILDINGS[t];
      const chan = this.khoaNha(t);
      const co = e.countOf(t);
      const tran = BUILD_LIMIT[t];
      const c = el('button', 'nha' + (chan ? ' khoa' : '')) as HTMLButtonElement;
      c.dataset.loai = t;
      const top = el('div', 'nha-top');
      top.append(ico(spec.icon, 'gico'), el('b', undefined, spec.label));
      const dem = tran !== undefined ? `${co}/${tran}` : co ? `×${co}` : '';
      if (dem) top.append(el('span', 'dem', dem));
      c.append(top, el('small', undefined, chan ?? spec.describe(1)));
      if (!chan) c.append(this.costRow(e.buildCostFor(t), true));
      c.disabled = chan !== null;
      c.addEventListener('click', () => this.chonXay(t));
      luoi.append(c);
    }
    sheet.append(luoi);
  }

  /**
   * Bước hai: chọn Ở ĐÂU. Một thanh thấp — tên, câu trả lời "chỗ này được không", giá, và
   * hai nút. Thấp là cố ý: phần màn hình bị che đúng là phần người chơi đang cần nhìn.
   */
  private renderDat(sheet: HTMLElement, t: BuildingType): void {
    const e = this.economy;
    const spec = BUILDINGS[t];
    const doi = this.game.moving !== null;
    const ly = this.game.placeWhy;
    const cost = e.buildCostFor(t);
    const thieu = !doi && ly === THIEU_VAT_LIEU;

    const bar = el('div', 'dat');
    bar.append(ico(spec.icon, 'gico'));
    const col = el('div', 'col');
    col.append(el('b', undefined, doi ? `Dời ${spec.label}` : spec.label),
      el('small', ly ? 'do' : undefined,
        ly ?? 'Chỗ này được · bấm vào bản đồ để đổi chỗ'));
    bar.append(col);
    if (!doi) bar.append(this.costRow(cost, true));
    sheet.append(bar);

    const nut = el('div', 'xay-row');
    const lui = el('button', 'xay-huy', doi ? 'Huỷ' : '‹ Loại khác') as HTMLButtonElement;
    lui.addEventListener('click', () => { if (doi) this.moNgan(null); else this.chonXay(null); });
    const go = el('button', 'insp-go' + (ly ? ' want' : ' pulse')) as HTMLButtonElement;
    go.textContent = thieu ? 'GOM VẬT LIỆU' : ly ? 'CHƯA ĐẶT ĐƯỢC' : doi ? 'ĐẶT Ở ĐÂY' : 'XÂY Ở ĐÂY';
    go.addEventListener('click', () => {
      if (thieu) {
        e.setDemand(cost, spec.label);
        this.toast(`Cả làng đi gom vật liệu cho ${spec.label.toLowerCase()}`, 'hammer');
        return;
      }
      if (!this.game.placeNow()) {
        this.toast(this.game.placeWhy ?? 'Chưa đặt được', 'warn');
        return;
      }
      this.toast(doi ? 'Đã dời xong' : `Đã xây ${spec.label.toLowerCase()}`, 'hammer');
      // Dời là việc làm một lần nên xong là đóng. Xây thì ở lại: nhà thường xây liền mấy cái.
      if (doi) this.moNgan(null);
      else if (this.khoaNha(t)) this.chonXay(null);
      else this.renderInspector();
    });
    nut.append(lui, go);
    sheet.append(nut);
  }

  /** Ngăn quân đội: thời đại, ba loại lính, và lò rèn. */
  private renderQuan(sheet: HTMLElement): void {
    const e = this.economy;
    const s = e.state;
    /*
     * Lương quân tính THEO PHÚT, không theo giây.
     *
     * "0,2 lương/giây" là một con số không ai ước lượng được; "12 lương/phút" thì đặt thẳng
     * cạnh được với tốc độ vào kho mà thanh trên đang hiện. Và khi chưa có quân thì nói
     * "chưa tốn lương" chứ không in ra một số không.
     */
    const an = Math.round(e.upkeep() * 60);
    sheet.append(this.sheetHead(e.ageSpec().label,
      e.armySize() > 0 ? `${e.armySize()} quân · ăn ${an} lương/phút` : 'Chưa có quân'));

    // --- thời đại
    const sau = e.nextAge();
    if (s.ageLeft > 0) {
      sheet.append(el('p', 'sheet-note',
        `Đang chuyển sang ${AGES[s.age].label} — còn ${Math.ceil(s.ageLeft)} giây.`));
    } else if (sau) {
      sheet.append(this.row('age', `Lên ${sau.label}`, sau.opens, sau.cost,
        e.ageBlock(), () => { e.advanceAge(); this.renderInspector(); }));
    }

    // --- ba loại lính
    for (const k of TROOP_KINDS) {
      const sp = TROOPS[k];
      const cap = e.troopCap(k);
      const dang = s.train.filter((x) => x.kind === k).length;
      const khac = TROOP_KINDS.filter((o) => KHAC[k][o] > 1.2).map((o) => TROOPS[o].label.toLowerCase());
      sheet.append(this.row(sp.icon, `${sp.label} · ${s.army[k]}/${cap}`,
        `Khắc ${khac.join(' và ') || 'không ai'}${dang ? ` · đang rèn ${dang}` : ''}`,
        sp.cost, e.trainBlock(k), () => { e.train(k); this.renderInspector(); }));
    }
    if (e.trainLeft() > 0) {
      sheet.append(el('p', 'sheet-note', `Suất kế tiếp xong sau ${Math.ceil(e.trainLeft())} giây.`));
    }

    // --- lò rèn
    if (e.sumLevels('smithy') > 0) {
      sheet.append(this.row('anvil', `Rèn vũ khí · bậc ${s.smith.attack}`,
        `Cả ba loại lính đánh mạnh thêm ${Math.round(SMITH_ATTACK * 100)}%`,
        e.smithCost(s.smith.attack), e.smithBlock('attack'),
        () => { e.buySmith('attack'); this.renderInspector(); }));
      sheet.append(this.row('shield', `Rèn giáp · bậc ${s.smith.armour}`,
        `Cả ba loại lính chịu đòn nhẹ đi ${Math.round(SMITH_ARMOUR * 100)}%`,
        e.smithCost(s.smith.armour), e.smithBlock('armour'),
        () => { e.buySmith('armour'); this.renderInspector(); }));
    }
    sheet.append(el('p', 'sheet-note',
      'Giáo chống kỵ binh, cung bắn bộ binh, kỵ binh ăn cung thủ. Nhìn thành phần đợt trên'
      + ' đầu màn rồi hãy rèn.'));
  }

  /**
   * Dòng phụ đề dưới nút Dân.
   *
   * Bản trước đây là một thẻ riêng trong dock ghi "8/22 · Đang tự cân bằng kho" — một câu
   * không ai hiểu. Giờ nó là phụ đề của chính cái nút mở ngăn Dân, và nói bằng tiếng người.
   */
  private updateCrewPill(): void {
    this.renderDock();
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

    const laDan = u.kind === 'villager' && u.state !== 'voyage';
    const nhom = laDan ? this.game.soChon : 1;
    const head = el('div', 'insp-head');
    head.append(ico(nhom > 1 ? 'people' : icon, 'insp-ico'));
    const t = el('div', 'insp-title');
    const trangThai = this.statusOf(u)
      + (this.game.following === u.id ? ' · camera đang bám' : '');
    t.append(el('strong', undefined, nhom > 1 ? `${nhom} người đang chọn` : name),
      el('small', 'live', trangThai));
    head.append(t);
    const close = el('button', 'insp-close', '×') as HTMLButtonElement;
    close.title = 'Bỏ chọn';
    close.setAttribute('aria-label', 'Bỏ chọn');
    close.addEventListener('click', () => {
      // Bỏ chọn cả trong game, không chỉ đóng thẻ: để nguyên thì vòng chọn vẫn sáng và cú
      // bấm kế tiếp xuống đất vẫn là một mệnh lệnh cho người mà thẻ đã đóng.
      this.selectedUnit = null;
      this.game.boChon();
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

    /*
     * ĐIỀU DÂN. Một dòng nói cách ra lệnh, rồi ba nút: nới nhóm, thả về tự làm, bám theo.
     * Dòng chữ là bắt buộc — "chọn rồi bấm vào bản đồ" là thao tác không có nút nào để bấm
     * thử, nên không viết ra thì không ai biết nó tồn tại.
     */
    if (laDan) {
      const mach = el('p', 'insp-lenh');
      mach.append(ico('flag', 'bico'), el('span', undefined,
        'Bấm vào bản đồ để điều đi tới đó (kể cả vùng mây) · bấm vào một bãi để làm ở đó'));
      body.append(mach);

      const lenh = el('div', 'lenh-row');
      const nut = (ten: IconName, chu: string, goi: string, run: () => void) => {
        const b = el('button', 'xay-huy') as HTMLButtonElement;
        b.append(ico(ten, 'bico'), el('span', undefined, chu));
        b.title = goi;
        b.addEventListener('click', run);
        lenh.append(b);
        return b;
      };
      const caLang = this.economy.villagers().filter((v) => v.state !== 'voyage').length;
      if (nhom < caLang) {
        nut('people', nhom > 1 ? 'Cả làng' : 'Thêm người gần đây',
          nhom > 1 ? 'Chọn mọi người dân đang ở nhà' : 'Chọn thêm những người đứng quanh đây',
          () => {
            const truoc = this.game.soChon;
            // Quanh đây không có ai thì nới thẳng ra cả làng, đừng để nút bấm mà như không.
            if (this.game.chonNhom(nhom > 1) === truoc) this.game.chonNhom(true);
          });
      }
      const dangLenh = u.targetId === LENH || u.targetId === CHO || !!u.pin;
      if (dangLenh || nhom > 1) {
        nut('stop', 'Thả tự làm', 'Bỏ lệnh và cái ghim, để làng tự chia việc', () => {
          const n = this.game.thaDan();
          this.toast(n > 1 ? `${n} người quay về tự chọn việc` : 'Quay về tự chọn việc');
          this.renderInspector();
        });
      }
      body.append(lenh);
    }

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
  /**
   * Thẻ hang thú. Ba câu hỏi người chơi có khi nhìn thấy một bầy sói, theo đúng thứ tự:
   * nó làm gì mình, mình đánh nổi không, và đánh thì được gì mất gì.
   */
  private renderDenCard(d: Den): void {
    const box = this.el.inspector;
    const e = this.economy;
    box.hidden = false;
    box.innerHTML = '';
    const spec = BEASTS[d.kind];

    const head = el('div', 'insp-head');
    head.append(ico('paw', 'insp-ico', 0xff8a7a));
    const t = el('div', 'insp-title');
    t.append(el('strong', undefined, `${spec.den} · cấp ${d.level}`),
      el('small', undefined, `${spec.label} · ${BIOMES[d.biome].label}`));
    head.append(t);
    const close = el('button', 'insp-close', '×') as HTMLButtonElement;
    close.title = 'Đóng';
    close.addEventListener('click', () => this.game.pickDen(null));
    head.append(close);

    const body = el('div', 'insp-body');
    const can = denPower(d);
    const co = e.huntPower();
    const row = el('div', 'insp-cost');
    const bit = (ten: IconName, text: string, cls = '') => {
      const s = el('span', 'bit' + (cls ? ' ' + cls : ''));
      s.append(ico(ten), el('span', undefined, text));
      return s;
    };
    row.append(bit('paw', `sức thú ${can}`), bit('sword', `sức quân ${co}`, co < can ? 'lack' : ''));
    body.append(row);
    body.append(el('p', 'insp-note',
      `Bãi trong ${DEN_FEAR} bước quanh hang chỉ cho ${Math.round(DEN_YIELD * 100)}% mỗi chuyến cho tới khi dẹp xong.`));

    const thuong = el('div', 'den-loot');
    // Không dùng `costRow`: hàng ấy tô đỏ thứ nào kho đang thiếu, mà đây là thứ ĐƯỢC chứ không phải giá.
    const mon = el('div', 'insp-cost gon');
    const duocGi = denLoot(d);
    for (const k of RESOURCE_KINDS) {
      const n = duocGi[k];
      if (!n) continue;
      const b = el('span', 'bit');
      b.append(ico(RESOURCES[k].icon, 'ico', RESOURCES[k].color), el('span', undefined, `+${fmt(n)}`));
      mon.append(b);
    }
    thuong.append(el('span', 'den-cap', 'Dẹp xong được'), mon);
    body.append(thuong);

    const vi = e.huntBlock(d);
    const mat = huntLosses(e.state.army, co, can);
    const nga = TROOP_KINDS.filter((k) => mat[k] > 0)
      .map((k) => `${mat[k]} ${TROOPS[k].label.toLowerCase()}`).join(', ');
    body.append(el('p', 'insp-next' + (vi ? ' chan' : ''), vi ?? (nga
      ? `Đi bây giờ sẽ ngã ${nga}. Quân càng đông càng ít người ngã.`
      : 'Quân đủ đông: không ai ngã.')));

    const go = el('button', 'insp-go') as HTMLButtonElement;
    go.append(ico('sword', 'bico'), el('span', undefined, vi ? 'CHƯA ĐỦ SỨC' : 'MANG QUÂN ĐI SĂN'));
    go.disabled = !!vi;
    go.addEventListener('click', () => {
      const r = e.hunt(d);
      if (!r) return;
      const duoc = RESOURCE_KINDS.filter((k) => r.loot[k])
        .map((k) => `+${r.loot[k]} ${RESOURCES[k].label.toLowerCase()}`).join(' · ');
      const ngaThat = TROOP_KINDS.reduce((n, k) => n + r.lost[k], 0);
      this.toast(`Dẹp xong ${spec.den.toLowerCase()}${duoc ? ' · ' + duoc : ''}`
        + (ngaThat ? ` · ngã ${ngaThat} lính` : ''), 'sword');
      this.game.beasts.dirty();
      this.game.pickDen(null);
      this.refresh();
    });
    body.append(go);
    box.append(head, body);
  }

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
    const thu = denNearPatch(b);
    const biQuay = !!thu && !e.isHunted(thu.id);
    const moiChuyen = Math.floor(
      Math.max(1, e.capacity() * b.richness * (biQuay ? DEN_YIELD : 1)) * RESOURCES[b.kind].value);
    const chuyen = bit('gold', `${fmt(moiChuyen)} mỗi chuyến`);
    chuyen.title = `Mỗi chuyến mang về chừng ${Math.floor(e.capacity() * b.richness)}`
      + ` ${res.label.toLowerCase()} (giàu ×${b.richness.toFixed(2)}),`
      + ` bán ở thủ phủ được chừng ${fmt(moiChuyen)} vàng`;
    row.append(chuyen);
    const xa = Math.round(Math.hypot(b.center[0], b.center[2]));
    row.append(bit('compass', `cách thủ phủ ${xa}`));
    if (e.isFull(b.kind)) row.append(bit('basket', 'kho đã đầy', 'lack'));
    if (thu && biQuay) {
      row.append(bit('paw',
        `${BEASTS[thu.kind].label.toLowerCase()} quấy · chỉ còn ${Math.round(DEN_YIELD * 100)}% mỗi chuyến`, 'lack'));
    }
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
    // Nut chinh cua the bai: ho phach. "BO HET" ben canh la nut phu nen de kieu mo.
    const all = el('button', 'insp-go') as HTMLButtonElement;
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


  private roleOf(u: Unit): 'cart' | 'miner' | 'carrier' | 'forester' | 'idle' {
    if (u.kind === 'cart') return 'cart';
    if (u.targetId && this.economy.state.buildings.some((b) => b.id === u.targetId)) return 'carrier';
    const kind = u.carryingKind
      ?? (u.targetId ? this.game.map.patchById(u.targetId)?.kind : undefined);
    if (!kind) return 'idle';
    return kind === 'wood' || kind === 'food' ? 'forester' : 'miner';
  }


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
      case 'voyage':
        return 'Đang lênh đênh ngoài khơi';
      case 'idle':
        if (u.targetId === CHO) {
          return `Đứng gác theo lệnh · ${Math.ceil(Math.max(0, u.gatherTimer))}s nữa tự đi làm`;
        }
        return 'Đang chờ việc';
      case 'moving': {
        if (u.targetId === LENH) return 'Đang đi tới chỗ bạn chỉ';
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


  private renderInspector(): void {
    const box = this.el.inspector;
    this.giaSong = [];

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
    if (this.selectedDen) {
      const d = denById(this.selectedDen);
      if (d && !this.economy.isHunted(d.id)) { this.renderDenCard(d); return; }
      this.selectedDen = null;
    }
    this.patchLive = null;

    if (this.ngan) { this.renderNgan(); return; }

    const b = this.selected ? this.economy.buildingById(this.selected) : undefined;
    if (!b) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = '';

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

    // Nút dời đứng cạnh nút nâng cấp: cả hai đều là "làm gì với căn nhà NÀY".
    const hang = el('div', 'xay-row');
    if (doiDuoc(b.type)) {
      const doi = el('button', 'xay-huy') as HTMLButtonElement;
      doi.append(ico('move', 'bico'), el('span', undefined, 'Dời'));
      doi.title = 'Nhấc lên đặt chỗ khác, không tốn gì';
      doi.addEventListener('click', () => this.doiNha(b.id));
      hang.append(doi);
    }
    if (b.level >= BUILDINGS[b.type].maxLevel) {
      body.append(el('p', 'insp-note', 'Đã kịch cấp.'));
    } else {
      const cost = this.economy.costFor(b.type, b.level);
      // Nói trước nâng cấp thì ĐƯỢC GÌ. Bản trước chỉ có giá và một cái nút, nên người chơi
      // trả tiền rồi mới biết mình vừa mua cái gì.
      const nay = BUILDINGS[b.type].describe(b.level);
      const sau = BUILDINGS[b.type].describe(b.level + 1);
      if (sau !== nay) {
        const ke = el('p', 'insp-next');
        ke.append(ico('up', 'bico'), el('span', undefined, `Cấp ${b.level + 1}: ${sau}`));
        body.append(ke);
      }
      body.append(this.costRow(cost));
      hang.append(this.bigButton('NÂNG CẤP', cost, `${BUILDINGS[b.type].label} cấp ${b.level + 1}`,
        () => this.economy.upgrade(b)));
    }
    if (hang.childElementCount) body.append(hang);
    head.append(close);
    box.append(head, body);
  }

  /**
   * Hàng giá. Bản gọn (`gon`) chỉ ghi SỐ CẦN, đỏ khi chưa đủ — số đang có đã nằm trên thanh
   * tài nguyên, lặp lại nó trong mười ba dòng là mười ba lần "12/50" chen nhau. Bản đầy đủ
   * (thẻ nâng cấp, nơi chỉ có một hàng giá) thì giữ "có/cần" vì đó là thanh tiến độ.
   */
  private costRow(cost: Cost, gon = false): HTMLElement {
    const row = el('div', 'insp-cost' + (gon ? ' gon' : ''));
    for (const k of RESOURCE_KINDS) {
      const need = cost[k];
      if (!need) continue;
      const have = Math.floor(this.economy.state.inv[k]);
      const lack = have < need;
      const bit = el('span', 'bit' + (lack ? ' lack' : ''));
      const txt = el('span', undefined, gon ? fmt(need) : `${fmt(Math.min(have, need))}/${fmt(need)}`);
      bit.append(ico(RESOURCES[k].icon, 'ico', RESOURCES[k].color), txt);
      row.append(bit);
      this.giaSong.push({ el: bit, txt: gon ? null : txt, kind: k, need, lack });
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
    // Đợt bão lúc vắng mặt được kể bằng chính bảng kết đợt, chứ không nhét vào bảng "đi
    // vắng": nó là một sự kiện, không phải một dòng thu nhập.
    const kinds = RESOURCE_KINDS.filter((k) => (r.gained[k] ?? 0) > 0);
    if (kinds.length === 0) {
      if (r.wave) this.showWave(r.wave);
      else if (r.voyage) this.showVoyage(r.voyage);
      return;
    }
    this.waveCho = r.wave;
    this.voyageCho = r.voyage;
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
    if (r.waveSkipped > 0) {
      notes.push(`Còn ${r.waveSkipped} đợt nữa đi qua trong lúc bạn vắng mặt, nhưng đi vắng`
        + ' bao lâu thì cũng chỉ một đợt được tính.');
    }
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

  // ----------------------------------------------------------- lập làng

  /** Màu cờ đang chọn trong màn lập làng, chưa lưu cho tới khi bấm xong. */
  private mauDangChon = 0;
  /** Lần đầu thì không cho thoát: chưa có tên thì chẳng có gì để quay về. */
  private langBatBuoc = false;

  private buildLang(): void {
    this.el.langBoc.innerHTML = iconSvg('shuffle');
    for (const mau of VILLAGE_COLORS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', `Màu cờ #${mau.toString(16)}`);
      b.style.background = `#${mau.toString(16).padStart(6, '0')}`;
      b.addEventListener('click', () => { this.mauDangChon = mau; this.renderLangMau(); });
      this.el.langMau.append(b);
    }
    this.el.langBoc.addEventListener('click', () => { this.el.langTen.value = tenLangNgauNhien(); });
    this.el.langOk.addEventListener('click', () => this.saveLang());
    this.el.langChip.addEventListener('click', () => this.openLang(false));
    this.el.langTen.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.saveLang(); }
    });
    this.renderLangChip();
  }

  private openLang(batBuoc: boolean): void {
    const v = this.economy.state.village;
    this.langBatBuoc = batBuoc;
    this.mauDangChon = v.color;
    // Lần đầu thì điền sẵn một cái tên: màn hình trống bắt người ta nghĩ, còn một cái tên có
    // sẵn thì chỉ cần bấm tiếp — và ai muốn tên riêng vẫn xoá đi gõ lại được.
    this.el.langTen.value = v.name || tenLangNgauNhien();
    this.el.langOk.textContent = batBuoc ? 'Vào đảo' : 'Xong';
    this.renderLangMau();
    this.el.lapLang.hidden = false;
    this.el.langTen.focus();
    this.el.langTen.select();
  }

  private saveLang(): void {
    const ten = this.el.langTen.value.trim().slice(0, 24) || tenLangNgauNhien();
    this.economy.state.village = { name: ten, color: this.mauDangChon };
    this.economy.save();
    this.el.lapLang.hidden = true;
    this.langBatBuoc = false;
    this.renderLangChip();
    this.game.refreshVillage();
  }

  private renderLangMau(): void {
    const nut = [...this.el.langMau.querySelectorAll('button')];
    nut.forEach((b, i) => {
      const on = VILLAGE_COLORS[i] === this.mauDangChon;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  private renderLangChip(): void {
    const v = this.economy.state.village;
    this.el.langHud.textContent = v.name || 'Lập làng';
    this.el.langDot.style.background = `#${v.color.toString(16).padStart(6, '0')}`;
    document.title = v.name ? `${v.name} · Quần Đảo Vô Tận` : 'Quần Đảo Vô Tận';
  }

  // ----------------------------------------------------------- bảng đồ hoạ

  private toggleGfx(): void {
    if (!this.el.gfxMenu.hidden) {
      this.closeGfx();
      return;
    }
    // Neo ngay dưới nút. Thanh trên xuống hai dòng ở màn hẹp nên không đặt cứng một độ cao.
    const r = this.el.gfx.getBoundingClientRect();
    if (this.hep) {
      // Màn hẹp: nút nằm trong cột bên phải, nên bảng mở sang TRÁI cột, ngang đầu cột —
      // mở xuống dưới thì đè lên chính nút tạm dừng.
      const g = (this.el.gfx.parentElement as HTMLElement).getBoundingClientRect();
      this.el.gfxMenu.style.top = `${Math.round(g.top)}px`;
      this.el.gfxMenu.style.right = `${Math.round(window.innerWidth - g.left + 8)}px`;
    } else {
      this.el.gfxMenu.style.top = `${Math.round(r.bottom + 8)}px`;
      this.el.gfxMenu.style.right = `${Math.max(10, Math.round(window.innerWidth - r.right - 6))}px`;
    }
    this.el.gfxMenu.hidden = false;
    this.el.gfx.setAttribute('aria-expanded', 'true');
    this.renderGfx();
  }

  private closeGfx(): void {
    this.el.gfxMenu.hidden = true;
    this.el.gfx.setAttribute('aria-expanded', 'false');
  }

  /** Esc đóng bảng đang mở trước; chỉ khi không có gì để đóng thì Esc mới là tạm dừng. */
  dismiss(): boolean {
    if (!this.el.lapLang.hidden) {
      // Đổi tên thì Esc là huỷ bỏ. Còn lần lập làng ĐẦU TIÊN thì Esc không làm gì: đóng đi
      // là người chơi ngồi trước một hòn đảo không tên, mà thẻ làng trên HUD lúc ấy vẫn bấm
      // được nên không mất đường quay lại — chỉ là không nên để họ rơi vào đó.
      if (!this.langBatBuoc) this.el.lapLang.hidden = true;
      return true;
    }
    if (this.ngan) { this.moNgan(null); return true; }
    if (this.el.gfxMenu.hidden) return false;
    this.closeGfx();
    return true;
  }

  private renderGfx(): void {
    const q = this.game.quality;
    for (const b of this.el.gfxSeg.querySelectorAll<HTMLButtonElement>('button[data-q]')) {
      const on = b.dataset.q === q.choice;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    }
    // Tự động thì nói rõ nó đang chạy bậc nào — không thì người chơi không biết máy mình ra sao.
    this.el.gfxNow.textContent = q.choice === 'auto' ? `đang ở ${q.label}` : '';
    const bat = q.tilt && q.tiltAllowed;
    this.el.gfxTilt.disabled = !q.tiltAllowed;
    this.el.gfxTilt.classList.toggle('on', bat);
    this.el.gfxTilt.setAttribute('aria-checked', String(bat));
    this.el.gfxNote.textContent = q.tiltAllowed ? '' : 'Mô hình thu nhỏ chỉ có ở bậc Cao.';
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
