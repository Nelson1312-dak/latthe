/**
 * Trận đánh: luật thuần, không biết gì về Three.js, Economy hay màn hình.
 *
 * MỘT ĐIỀU QUYẾT ĐỊNH TOÀN BỘ THIẾT KẾ Ở ĐÂY: trận KHÔNG chạy trong vòng lặp game.
 * `resolveBattle()` chạy trọn trận trong một lời gọi, bằng vòng lặp riêng bước cố định, rồi
 * trả về kết quả. Phần người chơi xem là DIỄN LẠI: ArmyManager chạy đúng `battleStep()` này
 * từ đúng hạt giống ấy, chỉ để vẽ, không đụng một byte nào của trạng thái game.
 *
 * Nhờ thế biến mất sạch một họ lỗi mà kiểu "mô phỏng trực tiếp" nào cũng phải trả giá: tạm
 * dừng giữa trận, ẩn tab giữa trận, tốc độ 2×, khung hình rớt, lưu giữa trận — và cái bẫy
 * lớn nhất của game này: `collectOffline` tua lại bằng bước 0,5 giây trong khi lúc chơi dt
 * đi theo khung hình.
 *
 * Hai luật phải giữ cho diễn lại trùng khít với lúc tính:
 *   — Đồng hồ của trận là SỐ BƯỚC nguyên, không bao giờ là một tổng dt kiểu dấu phẩy động.
 *   — Mọi ngẫu nhiên lấy từ hash2(), hạt giống là số thứ tự đợt. Không Math.random, không
 *     duyệt Map hay Set ở chỗ thứ tự có thể đổi, và mọi phép so hoà nhau phân định bằng
 *     chỉ số trong mảng.
 */
import {
  AGE_DEFENCE, AGE_RAIDER_HP, KHAC, SMITH_ARMOUR, SMITH_ATTACK, SPLASH_SHARE, TROOPS, ageBonus,
} from './config';
import { hash2 } from './world';
import { BOSS_DPS_SHARE, BOSS_HP_SHARE, HORDES, HORDE_DPS, HORDE_HP, swarmJitter } from './beasthorde';
import type { TroopKind, Troops, WaveKind } from './types';
import { TROOP_KINDS, noTroops } from './types';

/** Một bước mô phỏng. Nhỏ hơn thì mượt hơn mà cũng tốn hơn; 0,1 giây là đủ cho tốc độ này. */
export const TICK = 0.1;
/**
 * Trần số bước. Trận chưa ngã ngũ trong chín chục giây thì coi như giặc hết hơi và rút —
 * một trận bế tắc là lỗi thiết kế, nên thà kết thúc nó còn hơn để vòng lặp treo.
 */
export const MAX_TICKS = 900;

// ------------------------------------------------------------------ số liệu

/** Mỗi con giặc gánh bấy nhiêu "sức đợt". Chia ra được bao nhiêu con là bấy nhiêu. */
const POWER_PER_RAIDER = 7;
const RAIDERS_MIN = 3;
const RAIDERS_MAX = 36;

/**
 * Giặc dùng CHUNG bảng chỉ số với quân người chơi, chỉ nhân xuống.
 *
 * Dùng chung thì luật khắc chế đọc được hai chiều: cung thủ của giặc cũng sợ kỵ binh đúng
 * như cung thủ của người chơi. Nhân xuống vì giặc đông hơn hẳn, và vì tổng máu một đợt phải
 * tỉ lệ THẲNG với sức đợt — chỗ này từng sai một lần, cho máu tăng theo số đợt trong khi số
 * lượng cũng tăng, và tổng máu thành một đường bậc hai mà không thế trận nào theo kịp.
 */
const RAIDER_HP = 0.72;
const RAIDER_DPS = 0.85;
/** Giặc tinh nhuệ dày da và nặng tay thêm theo luỹ thừa này của `eliteOf`. Xem ở đó. */
const ELITE_HP = 2.4;
const ELITE_DPS = 0.6;

/** Tới cách thủ phủ ngần này là khuân được hàng. */
const LOOT_RANGE = 3.2;
/** Đứng khuân hàng mất ngần này giây, và đứng thì ăn đạn. */
const LOOT_SECONDS = 2.5;
/** Chạy ra khỏi vòng này là thoát, hàng mất thật. */
const ESCAPE_DIST = 44;

/**
 * Quân giữ làng chỉ đánh những tên đã vào trong vòng này QUANH THỦ PHỦ — không phải quanh
 * chính nó. Đo bằng mắt ở bản đầu: lấy khoảng cách từ chỗ lính đứng thì cả tốp xông ra bốn
 * chục đơn vị đón đánh, tức ra ngoài hẳn tầm tháp, rồi chết lẻ tẻ ngoài đồng.
 */
const GUARD_LEASH = 14;

/** Chòi canh. Tầm bắn là thứ khiến CHỖ ĐẶT có nghĩa. */
export const TOWER_RANGE = 18;
const TOWER_DMG_BASE = 4;
const TOWER_DMG_PER_LEVEL = 4;
const TOWER_RELOAD = 1.25;
/** Mưa bão thì cung nỏ ngắn lại — chỗ duy nhất "bão" còn khác "cướp". */
const STORM_RANGE_MULT = 0.74;

/** Thủ phủ tự chống trả: dân ở nhà cầm gậy đứng trong sân. Không vẽ ra, chỉ là sát thương. */
const CORE_RANGE = 11;
const CORE_DMG_BASE = 2;
const CORE_DMG_PER_MILITIA = 0.5;
const CORE_RELOAD = 1.4;

/** Giặc đổ bộ cách thủ phủ ngần này, dọc theo trục đường. */
const SPAWN_DIST = 46;

/**
 * Thành phần một đợt theo thời đại.
 *
 * Lên thời đại không chỉ mở thêm quân cho người chơi — giặc cũng có thêm loại mới. Nếu chỉ
 * toàn cái được thì lên thời đại là một nút bấm cho không, và không ai cân nhắc một giây.
 */
const DOI_HINH: readonly (readonly [number, number])[] = [
  [1, 0],
  [0.7, 0.3],
  [0.55, 0.3],
  [0.45, 0.32],
  [0.4, 0.32],
];

// ------------------------------------------------------------------ kiểu

export interface BattleSeed {
  wave: number;
  kind: WaveKind;
  /** Sức đợt — chia ra thành số con giặc. */
  power: number;
  /** Chòi canh: toạ độ thật trên bản đồ. Đây là lý do chỗ đặt tháp có nghĩa. */
  towers: readonly { x: number; z: number; level: number }[];
  /** Lính đánh thuê mua cho đúng đợt này — bộ binh tạm, tan sau trận. */
  mercs: number;
  /** Dân đang ở nhà. Họ không ra trận, nhưng thủ phủ bắn mạnh hơn nhờ họ. */
  militia: number;
  /** Quân thường trực. */
  army: Troops;
  /** Bậc rèn. */
  smith: { attack: number; armour: number };
  /** Thời đại, quyết định đội hình giặc. */
  age: number;
  /** Đợt quái thú: chỉ số bầy trong HORDES, bậc, và số con nhỏ. Thiếu là đợt người. */
  horde?: number;
  tier?: number;
  minions?: number;
}

export type RaiderState = 'march' | 'loot' | 'flee';

/** Một người trên chiến trường. Hai bên dùng chung kiểu — luật khắc chế đọc được hai chiều. */
export interface Fighter {
  x: number; z: number; hp: number;
  kind: TroopKind;
  face: number;
  /** Số bước còn lại tới đòn kế tiếp. */
  cool: number;
}

export interface Raider extends Fighter {
  state: RaiderState;
  loaded: boolean;
  work: number;
  /*
   * Chỉ số riêng của QUÁI THÚ. Giặc người đọc mọi thứ từ TROOPS theo `kind`; quái thì `kind`
   * chỉ còn là hạng khắc chế, còn đòn, tốc độ, tầm và nổ lan nằm ở đây.
   */
  boss?: boolean;
  /** Sát thương mỗi giây, đã gồm hệ số giặc và tinh nhuệ. */
  atk?: number;
  spd?: number;
  rng?: number;
  spl?: number;
}

export interface Guard extends Fighter {
  /** Chỗ đứng gác của riêng người này; cả tốp quay về một điểm thì chồng khít lên nhau. */
  hx: number; hz: number;
}

/** Một phát đánh vừa nổ ra ở bước này. Thuần để vẽ, nhưng sinh trong cùng một dòng chảy. */
export interface Shot { x0: number; z0: number; x1: number; z1: number }

export interface BattleState {
  seed: BattleSeed;
  tick: number;
  raiders: Raider[];
  guards: Guard[];
  /** Đồng hồ nạp đạn của từng tháp, tính bằng SỐ BƯỚC còn lại. */
  cool: number[];
  coreCool: number;
  shots: Shot[];
  done: boolean;
  killed: number;
  escaped: number;
  reached: number;
  /** Con trùm của đợt quái đã ngã chưa. */
  bossDown: boolean;
}

export interface BattleOutcome {
  count: number;
  killed: number;
  escaped: number;
  reached: number;
  ticks: number;
  /** Phần đợt lọt lưới, 0 tới 1. Hậu quả tính theo đúng con số này. */
  leak: number;
  /** Thành phần đợt, để kể lại và để bảng đợt báo trước. */
  mix: Troops;
  /** Quân người chơi nằm lại, đếm từ chính bản diễn chứ không đoán. */
  lost: Troops;
  bossDown: boolean;
}

// ------------------------------------------------------------------ dựng trận

export function raiderCount(power: number): number {
  return Math.max(RAIDERS_MIN, Math.min(RAIDERS_MAX, Math.round(power / POWER_PER_RAIDER)));
}

/**
 * GIẶC TINH NHUỆ: sức đợt vượt quá mức mà ba mươi sáu tên gánh nổi thì phần dôi ra dồn vào
 * từng tên, chứ không biến mất.
 *
 * Trước đây nó biến mất thật: số giặc chạm trần ở sức 252 (làng cấp 67, chừng giờ thứ hai),
 * và từ đó đợt nào cũng y như đợt nào trong khi quân người chơi cứ đông lên — đo bốn tiếng
 * ra 56 thắng trên 58 trận với hai trăm lính đứng nhìn ba chục tên giặc.
 *
 * Số mũ (ELITE_HP, ELITE_DPS) là số ĐO, không phải số đẹp. Máu tăng thẳng theo sức đợt
 * (mũ 1) thì vẫn 56/58: quân người chơi lớn theo TỪNG CẤP của TỪNG nhà quân, nhanh hơn
 * hẳn một đường thẳng. Mũ 2,4 cho máu và 0,6 cho đòn ra 53/58 với 96% giặc bị hạ; nhích
 * đòn lên 0,75 là rơi xuống 49 và quân thường trực bị quét sạch mỗi đợt.
 */
export function eliteOf(power: number): number {
  return Math.max(1, power / (RAIDERS_MAX * POWER_PER_RAIDER));
}

/** Đội hình một đợt: bao nhiêu giáo, bao nhiêu cung, bao nhiêu ngựa. */
export function waveMix(power: number, age: number): Troops {
  const n = raiderCount(power);
  const [a, b] = DOI_HINH[Math.min(DOI_HINH.length - 1, Math.max(0, age - 1))];
  const spear = Math.round(n * a);
  const archer = Math.round(n * b);
  // Giặc chỉ có ba loại cũ: pháp sư và xe pháo là lợi thế RIÊNG của người đã lên đời.
  return { ...noTroops(), spear, archer, horse: Math.max(0, n - spear - archer) };
}

/**
 * Hai trục đường của thế giới cắt nhau ĐÚNG tại thủ phủ, nên có sẵn bốn làn đâm vào giữa
 * làng. Đợt lẻ đổ bộ một làn, đợt chẵn hai làn đối nhau — biết trước hướng giặc tới thì
 * việc đặt tháp mới là một quyết định chứ không phải một trò may rủi.
 */
function lanesOf(wave: number): readonly (readonly [number, number])[] {
  const huong = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
  const a = huong[Math.floor(hash2(wave, 3, 0xba01) * 4) % 4];
  if (wave % 2 === 1) return [a];
  return [a, [-a[0], -a[1]] as const];
}

/** Tổng máu và tổng đòn của một đợt CƯỚP cùng sức — đợt quái chia lại đúng hai con số này. */
function raidTotals(seed: BattleSeed): { hp: number; dps: number } {
  const mix = waveMix(seed.power, seed.age);
  const tinh = eliteOf(seed.power);
  let hp = 0;
  let dps = 0;
  for (const k of TROOP_KINDS) {
    hp += mix[k] * TROOPS[k].hp * RAIDER_HP * ageBonus(seed.age, AGE_RAIDER_HP) * tinh ** ELITE_HP;
    dps += mix[k] * TROOPS[k].dps * RAIDER_DPS * tinh ** ELITE_DPS;
  }
  return { hp, dps };
}

/**
 * Bầy quái: con trùm đi đầu làn thứ nhất, đám nhỏ ùa theo thành một đám lộn xộn tám con một
 * hàng — thú không đi đội hình thẳng tắp như lính.
 */
function hordeRaiders(seed: BattleSeed, lanes: readonly (readonly [number, number])[]): Raider[] {
  const spec = HORDES[Math.max(0, Math.min(HORDES.length - 1, seed.horde ?? 0))];
  const m = Math.max(1, seed.minions ?? 20);
  const tong = raidTotals(seed);
  const hp = tong.hp * HORDE_HP;
  const dps = tong.dps * HORDE_DPS;
  const out: Raider[] = [];
  const [bx, bz] = lanes[0];
  out.push({
    x: bx * (SPAWN_DIST - 3), z: bz * (SPAWN_DIST - 3),
    hp: hp * BOSS_HP_SHARE, kind: spec.bossKind, state: 'march', loaded: false, work: 0, cool: 0,
    face: Math.atan2(-bx, -bz),
    boss: true, atk: dps * BOSS_DPS_SHARE, spd: spec.bossSpeed, rng: spec.bossRange, spl: spec.bossSplash,
  });
  const mau = (hp * (1 - BOSS_HP_SHARE)) / m;
  const don = (dps * (1 - BOSS_DPS_SHARE)) / m;
  for (let i = 0; i < m; i += 1) {
    const [lx, lz] = lanes[i % lanes.length];
    const k = Math.floor(i / lanes.length);
    const doc = SPAWN_DIST + 1 + Math.floor(k / 8) * 2.1 + swarmJitter(seed.wave, i, 1) * 2.8;
    const ngang = ((k % 8) - 3.5) * 1.9 + swarmJitter(seed.wave, i, 2) * 2.8;
    out.push({
      x: lx * doc + lz * ngang, z: lz * doc + lx * ngang,
      hp: mau, kind: spec.minionKind, state: 'march', loaded: false, work: 0, cool: 0,
      face: Math.atan2(-lx, -lz),
      atk: don, spd: spec.minionSpeed, rng: spec.minionRange, spl: 0,
    });
  }
  return out;
}

export function battleStart(seed: BattleSeed): BattleState {
  const mix = waveMix(seed.power, seed.age);
  const lanes = lanesOf(seed.wave);
  /*
   * ĐỘI HÌNH, KHÔNG PHẢI HÀNG MỘT. Bản đầu rải mỗi con lùi thêm 2,4 đơn vị, nên một đợt ba
   * sáu tên kéo dài một trăm ba chục đơn vị — chúng lũ lượt bước vào tầm bắn từng đứa một
   * và bị bắn tỉa gọn ghẽ: đo ra 100% bị hạ, 57 thắng trên 58 trận. Mỗi tháp chỉ bắn được
   * MỘT mục tiêu một lúc, nên sức mạnh thật của giặc nằm ở chỗ chúng tới CÙNG LÚC.
   */
  const HANG = 6;
  const raiders: Raider[] = seed.horde !== undefined ? hordeRaiders(seed, lanes) : [];
  const danh: TroopKind[] = [];
  if (seed.horde !== undefined) { mix.spear = 0; mix.archer = 0; mix.horse = 0; }
  for (let i = 0; i < mix.spear; i += 1) danh.push('spear');
  for (let i = 0; i < mix.archer; i += 1) danh.push('archer');
  for (let i = 0; i < mix.horse; i += 1) danh.push('horse');
  for (let i = 0; i < danh.length; i += 1) {
    const lane = lanes[i % lanes.length];
    const k = Math.floor(i / lanes.length);
    const [lx, lz] = lane;
    const doc = SPAWN_DIST + Math.floor(k / HANG) * 2.6;
    const ngang = ((k % HANG) - (HANG - 1) / 2) * 2.2
      + (hash2(seed.wave * 131 + i, 7, 0xba02) - 0.5) * 1.2;
    const kind = danh[i];
    raiders.push({
      x: lx * doc + lz * ngang,
      z: lz * doc + lx * ngang,
      // Giặc dày da lên theo thời đại của LÀNG: lên đời thì tháp bắn mạnh hơn, nên giặc
      // cũng phải chịu được nhiều hơn, không thì lên đời là thắng sẵn.
      hp: TROOPS[kind].hp * RAIDER_HP * ageBonus(seed.age, AGE_RAIDER_HP) * eliteOf(seed.power) ** ELITE_HP,
      kind,
      state: 'march',
      loaded: false,
      work: 0,
      cool: 0,
      face: Math.atan2(-lx, -lz),
    });
  }

  /*
   * Quân giữ làng đứng thành ba vòng: cung thủ trong cùng (họ bắn xa nên không cần ra
   * trước), bộ binh ở giữa, kỵ binh ngoài cùng vì họ xông ra đón đánh.
   */
  const guards: Guard[] = [];
  const dat = (kind: TroopKind, n: number, r: number, lech: number): void => {
    for (let i = 0; i < n; i += 1) {
      const g = (i / Math.max(1, n)) * Math.PI * 2 + lech;
      const rr = r + (i % 2) * 1.3;
      const hx = Math.sin(g) * rr;
      const hz = Math.cos(g) * rr;
      guards.push({ x: hx, z: hz, hp: TROOPS[kind].hp, kind, face: g, hx, hz, cool: 0 });
    }
  };
  dat('archer', seed.army.archer, 4.2, 0.4);
  dat('spear', seed.army.spear + seed.mercs, 6.4, 0);
  dat('horse', seed.army.horse, 8.6, 0.8);
  // Pháp sư đứng lẫn với cung thủ; xe pháo dàn ở vòng ngoài cùng, tầm 13 nên không phải lăn
  // bánh đi đâu — và đứng ngoài thì không chắn đường quân bộ chạy ra.
  dat('mage', seed.army.mage, 5.3, 1.1);
  dat('siege', seed.army.siege, 10.8, 0.3);

  return {
    seed,
    tick: 0,
    raiders,
    guards,
    cool: seed.towers.map(() => 0),
    coreCool: 0,
    shots: [],
    done: raiders.length === 0,
    killed: 0,
    escaped: 0,
    reached: 0,
    bossDown: false,
  };
}

// ------------------------------------------------------------------ một bước

/** Con giặc gần nhất một điểm, trong tầm. Hoà nhau thì chỉ số nhỏ thắng — phải xác định được. */
function nearestRaider(s: BattleState, x: number, z: number, range: number): number {
  let best = -1;
  let bd = range * range;
  for (let i = 0; i < s.raiders.length; i += 1) {
    const r = s.raiders[i];
    const d = (r.x - x) * (r.x - x) + (r.z - z) * (r.z - z);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Nhích một điểm về phía đích, trả về khoảng cách còn lại sau khi đi. */
function toward(e: Fighter, tx: number, tz: number, speed: number): number {
  const dx = tx - e.x;
  const dz = tz - e.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return 0;
  e.face = Math.atan2(dx, dz);
  const budget = speed * TICK;
  if (d <= budget) { e.x = tx; e.z = tz; return 0; }
  e.x += (dx / d) * budget;
  e.z += (dz / d) * budget;
  return d - budget;
}

/**
 * Sát thương một đòn, đã tính khắc chế và bậc rèn.
 *
 * Luật khắc chế áp CHO CẢ HAI BÊN: cung thủ của giặc cũng sợ kỵ binh đúng như cung thủ của
 * người chơi. Một luật chỉ đúng một chiều thì người chơi không học được nó.
 */
function damage(s: BattleState, kind: TroopKind, target: TroopKind, ta: boolean, atk?: number): number {
  const base = atk ?? TROOPS[kind].dps * (ta ? 1 : RAIDER_DPS * eliteOf(s.seed.power) ** ELITE_DPS);
  const d = base * KHAC[kind][target];
  if (ta) return d * (1 + SMITH_ATTACK * s.seed.smith.attack);
  return d * (1 - Math.min(0.6, SMITH_ARMOUR * s.seed.smith.armour));
}

/** Đánh một đòn theo nhịp: cung thủ dồn sát thương vào một phát, bộ binh rỉ đều. */
function strike(s: BattleState, me: Fighter, you: Fighter, ta: boolean): void {
  me.face = Math.atan2(you.x - me.x, you.z - me.z);
  // Quái mang chỉ số riêng; người (cả hai phe) đọc từ TROOPS.
  const q = me as Raider;
  const atk = ta ? undefined : q.atk;
  const tam = (!ta && q.rng !== undefined) ? q.rng : TROOPS[me.kind].range;
  const lan = (!ta && q.atk !== undefined) ? q.spl ?? 0 : TROOPS[me.kind].splash ?? 0;
  const danLan = (): void => {
    // Nổ lan: mọi kẻ cùng phe đứng quanh mục tiêu ăn một phần. Người chết được quét ở cuối
    // bước, nên trừ máu ở đây là đủ.
    if (lan <= 0) return;
    const phe: readonly Fighter[] = ta ? s.raiders : s.guards;
    for (const o of phe) {
      if (o === you || Math.hypot(o.x - you.x, o.z - you.z) > lan) continue;
      o.hp -= damage(s, me.kind, o.kind, ta, atk) * 1.2 * SPLASH_SHARE;
    }
  };
  if (tam > 3) {
    // Bắn xa: một phát mỗi 1,2 giây, và có vệt để nhìn thấy đường tên.
    if (me.cool > 0) { me.cool -= 1; return; }
    you.hp -= damage(s, me.kind, you.kind, ta, atk) * 1.2;
    danLan();
    s.shots.push({ x0: me.x, z0: me.z, x1: you.x, z1: you.z });
    me.cool = Math.round(1.2 / TICK);
    return;
  }
  // Trùm cận chiến nổ lan theo nhịp (cú gậy, cú vồ) thay vì rỉ đều: một cú mỗi 1,2 giây.
  if (lan > 0) {
    if (me.cool > 0) { me.cool -= 1; return; }
    you.hp -= damage(s, me.kind, you.kind, ta, atk) * 1.2;
    danLan();
    me.cool = Math.round(1.2 / TICK);
    return;
  }
  you.hp -= damage(s, me.kind, you.kind, ta, atk) * TICK;
}

/**
 * Một bước của trận. Thứ tự trong hàm này là một phần của luật chơi: tháp bắn trước, rồi
 * quân giữ làng, rồi giặc đi. Đổi thứ tự là đổi kết quả.
 */
export function battleStep(s: BattleState): void {
  if (s.done) return;
  s.shots.length = 0;
  const bao = s.seed.kind === 'storm';

  // --- tháp canh bắn
  for (let i = 0; i < s.seed.towers.length; i += 1) {
    const t = s.seed.towers[i];
    if (s.cool[i] > 0) { s.cool[i] -= 1; continue; }
    const tam = TOWER_RANGE * (bao ? STORM_RANGE_MULT : 1);
    const k = nearestRaider(s, t.x, t.z, tam);
    if (k < 0) continue;
    const r = s.raiders[k];
    r.hp -= (TOWER_DMG_BASE + TOWER_DMG_PER_LEVEL * t.level)
      * (1 + SMITH_ATTACK * s.seed.smith.attack) * ageBonus(s.seed.age, AGE_DEFENCE);
    s.shots.push({ x0: t.x, z0: t.z, x1: r.x, z1: r.z });
    s.cool[i] = Math.round(TOWER_RELOAD / TICK);
  }

  // --- thủ phủ chống trả, mạnh theo số dân đang ở nhà
  if (s.coreCool > 0) s.coreCool -= 1;
  else {
    const k = nearestRaider(s, 0, 0, CORE_RANGE * (bao ? STORM_RANGE_MULT : 1));
    if (k >= 0) {
      s.raiders[k].hp -= (CORE_DMG_BASE + CORE_DMG_PER_MILITIA * s.seed.militia)
        * ageBonus(s.seed.age, AGE_DEFENCE);
      s.shots.push({ x0: 0, z0: 0, x1: s.raiders[k].x, z1: s.raiders[k].z });
      s.coreCool = Math.round(CORE_RELOAD / TICK);
    }
  }

  // --- quân giữ làng
  for (let i = 0; i < s.guards.length; i += 1) {
    const g = s.guards[i];
    const spec = TROOPS[g.kind];
    // Chọn mục tiêu theo khoảng cách TỪ THỦ PHỦ, không theo khoảng cách từ chính mình.
    let k = -1;
    let bd = Infinity;
    for (let j = 0; j < s.raiders.length; j += 1) {
      const r = s.raiders[j];
      if (Math.hypot(r.x, r.z) > GUARD_LEASH) continue;
      const d = (r.x - g.x) * (r.x - g.x) + (r.z - g.z) * (r.z - g.z);
      if (d < bd) { bd = d; k = j; }
    }
    if (k < 0) { toward(g, g.hx, g.hz, spec.speed * 0.7); continue; }
    const r = s.raiders[k];
    if (Math.sqrt(bd) > spec.range) { toward(g, r.x, r.z, spec.speed); continue; }
    strike(s, g, r, true);
  }

  // --- giặc
  for (let i = 0; i < s.raiders.length; i += 1) {
    const r = s.raiders[i];
    const spec = TROOPS[r.kind];
    const tocDo = r.spd ?? spec.speed;
    const tamDanh = r.rng ?? spec.range;
    if (r.state === 'flee') {
      const d = Math.hypot(r.x, r.z);
      const ux = d > 1e-4 ? r.x / d : 1;
      const uz = d > 1e-4 ? r.z / d : 0;
      toward(r, r.x + ux * 10, r.z + uz * 10, tocDo);
      continue;
    }
    // Có quân chắn trong tầm thì dừng lại mà đánh.
    let k = -1;
    let bd = Infinity;
    for (let j = 0; j < s.guards.length; j += 1) {
      const g = s.guards[j];
      const d = (g.x - r.x) * (g.x - r.x) + (g.z - r.z) * (g.z - r.z);
      if (d < bd) { bd = d; k = j; }
    }
    if (k >= 0 && Math.sqrt(bd) <= tamDanh) { strike(s, r, s.guards[k], false); continue; }
    if (r.state === 'loot') {
      r.work -= 1;
      if (r.work <= 0) { r.state = 'flee'; r.loaded = true; }
      continue;
    }
    const con = toward(r, 0, 0, tocDo);
    if (con <= LOOT_RANGE) {
      r.state = 'loot';
      r.work = Math.round(LOOT_SECONDS / TICK);
      s.reached += 1;
    }
  }

  // --- dọn xác, đếm sổ
  for (let i = s.raiders.length - 1; i >= 0; i -= 1) {
    const r = s.raiders[i];
    if (r.hp <= 0) {
      s.killed += 1;
      if (r.boss) s.bossDown = true;
      s.raiders.splice(i, 1);
      continue;
    }
    if (r.state === 'flee' && Math.hypot(r.x, r.z) >= ESCAPE_DIST) {
      if (r.loaded) s.escaped += 1;
      s.raiders.splice(i, 1);
    }
  }
  for (let i = s.guards.length - 1; i >= 0; i -= 1) {
    if (s.guards[i].hp <= 0) s.guards.splice(i, 1);
  }

  s.tick += 1;
  if (s.raiders.length === 0 || s.tick >= MAX_TICKS) s.done = true;
}

// ------------------------------------------------------------------ chạy trọn

/**
 * Chạy trọn một trận và trả về sổ sách. Đây là hàm Economy gọi — cả lúc người chơi đang
 * nhìn lẫn lúc bù giờ vắng mặt, nên hai đường không thể lệch nhau.
 *
 * Quân nằm lại đếm từ CHÍNH bản chạy này, không ước lượng: một con số đoán ra thì sớm muộn
 * cũng lệch với cái người chơi vừa xem trên màn.
 */
export function resolveBattle(seed: BattleSeed): BattleOutcome {
  const s = battleStart(seed);
  const count = s.raiders.length;
  while (!s.done) battleStep(s);
  let con = 0;
  for (const r of s.raiders) if (r.loaded) con += 1;
  const escaped = s.escaped + con;

  const song = noTroops();
  for (const g of s.guards) song[g.kind] += 1;
  // Lính thuê tan sau trận dù sống hay chết, nên trừ chúng khỏi phần bộ binh còn lại.
  song.spear = Math.max(0, song.spear - seed.mercs);
  const lost = noTroops();
  for (const k of TROOP_KINDS) lost[k] = Math.max(0, seed.army[k] - song[k]);

  return {
    count,
    killed: s.killed,
    escaped,
    reached: s.reached,
    ticks: s.tick,
    leak: count === 0 ? 0 : Math.min(1, escaped / count),
    mix: waveMix(seed.power, seed.age),
    lost,
    bossDown: s.bossDown,
  };
}

/** Bốn làn đường quanh thủ phủ, cho HUD và cho bản mô phỏng vẽ hướng giặc tới. */
export function laneDirs(wave: number): readonly (readonly [number, number])[] {
  return lanesOf(wave);
}

/** Khoảng cách đổ bộ — camera vào trận phải khung được chừng này. */
export const BATTLE_RADIUS = SPAWN_DIST;
