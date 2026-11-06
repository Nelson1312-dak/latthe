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
 * đi theo khung hình. Hai đường ấy mà cùng chạy một trận "trực tiếp" thì cho hai kết quả
 * khác nhau, và `npm run pace` hết là một phép đo.
 *
 * Hai luật phải giữ cho diễn lại trùng khít với lúc tính:
 *   — Đồng hồ của trận là SỐ BƯỚC nguyên, không bao giờ là một tổng dt kiểu dấu phẩy động.
 *   — Mọi ngẫu nhiên lấy từ hash2(), hạt giống là số thứ tự đợt. Không Math.random, không
 *     duyệt Map hay Set ở chỗ thứ tự có thể đổi, và mọi phép so hoà nhau phân định bằng
 *     chỉ số trong mảng.
 */
import { ROAD_SPACING, hash2 } from './world';
import type { WaveKind } from './types';

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

/*
 * Máu một con giặc là CỐ ĐỊNH, số con mới chạy theo sức đợt.
 *
 * Thử cho máu lớn theo số đợt thì tổng máu của một đợt thành tích của hai đại lượng cùng
 * tăng, và đo ra là 56 trận thua trên 58: không thế trận nào theo kịp một đường bậc hai.
 * Giữ máu cố định thì tổng máu tỉ lệ thẳng với sức đợt, tức tỉ lệ thẳng với sức thủ mà
 * người chơi dựng được — hai bên mới cùng một thang.
 */
/*
 * Máu một con giặc đủ để một chòi canh cấp 1 phải bắn ba phát, cấp 5 thì một phát. Để máu
 * thấp hơn sát thương một phát bắn thì mọi tháp đều giết-một-phát, và thế trận chỉ còn phụ
 * thuộc vào SỐ PHÁT BẮN MỖI GIÂY — nâng cấp chòi canh hoá ra vô nghĩa.
 */
const RAIDER_HP = 24;
const RAIDER_SPEED = 2.6;
/** Đứng khuân hàng mất ngần này giây, và đứng thì ăn đạn. Đây là chỗ tháp gỡ lại được. */
const LOOT_SECONDS = 2.5;
/** Sát thương mỗi giây lên lính giữ làng. */
const RAIDER_DPS = 4;
/** Tới cách thủ phủ ngần này là khuân được hàng. */
const LOOT_RANGE = 3.2;
/** Chạy ra khỏi vòng này là thoát, hàng mất thật. */
const ESCAPE_DIST = 44;

/** Lính đánh thuê: mua bằng vàng trong ba mươi giây báo động, tan sau trận. */
const MERC_HP = 20;
const MERC_DPS = 8;
const MERC_SPEED = 3.2;
/**
 * Lính chỉ đánh những tên đã vào trong vòng này QUANH THỦ PHỦ — không phải quanh chính nó.
 *
 * Đo bằng mắt ở bản đầu: lấy khoảng cách từ chỗ lính đứng thì cả tốp xông ra bốn chục đơn
 * vị đón đánh, tức ra ngoài hẳn tầm tháp, rồi chết lẻ tẻ ngoài đồng. Giữ vòng này nhỏ hơn
 * tầm bắn của tháp thì lính và tháp đánh CÙNG một chỗ, và đó mới là một thế trận.
 */
const MERC_LEASH = 14;

/** Chòi canh. Tầm bắn là thứ khiến CHỖ ĐẶT có nghĩa. */
export const TOWER_RANGE = 18;
const TOWER_DMG_BASE = 4;
const TOWER_DMG_PER_LEVEL = 4;
const TOWER_RELOAD = 1.25;
/**
 * Mưa bão thì cung nỏ ngắn lại. Đây là chỗ duy nhất "bão" còn khác "cướp": cùng một trận,
 * nhưng tầm bắn co lại một phần tư và hậu quả rơi vào công trình thay vì vào kho.
 */
const STORM_RANGE_MULT = 0.74;

/** Thủ phủ tự chống trả: dân ở nhà cầm gậy đứng trong sân. Không vẽ ra, chỉ là sát thương. */
const CORE_RANGE = 11;
const CORE_DMG_BASE = 2;
const CORE_DMG_PER_MILITIA = 0.5;
const CORE_RELOAD = 1.4;

/** Giặc đổ bộ cách thủ phủ ngần này, dọc theo trục đường. */
const SPAWN_DIST = 46;

// ------------------------------------------------------------------ kiểu

export interface BattleSeed {
  wave: number;
  kind: WaveKind;
  /** Sức đợt — chia ra thành số con giặc. */
  power: number;
  /** Chòi canh: toạ độ thật trên bản đồ. Đây là lý do chỗ đặt tháp có nghĩa. */
  towers: readonly { x: number; z: number; level: number }[];
  /** Lính đánh thuê đã mua cho đúng đợt này. */
  mercs: number;
  /** Dân đang ở nhà. Họ không ra trận, nhưng thủ phủ bắn mạnh hơn nhờ họ. */
  militia: number;
}

export type RaiderState = 'march' | 'loot' | 'flee';

export interface Raider {
  x: number; z: number; hp: number;
  state: RaiderState;
  /** Hướng mặt, để vẽ. */
  face: number;
  /** Đã khuân được hàng chưa. Chết lúc đang ôm thì hàng rơi lại. */
  loaded: boolean;
  /** Số bước còn phải đứng khuân. */
  work: number;
}

export interface Merc {
  x: number; z: number; hp: number; face: number;
  /** Chỗ đứng gác của riêng người này. Không có nó thì cả tốp dồn về đúng một điểm. */
  hx: number; hz: number;
}

/** Một phát bắn vừa nổ ra ở bước này. Thuần để vẽ, nhưng sinh ra trong cùng một dòng chảy. */
export interface Shot { x0: number; z0: number; x1: number; z1: number; }

export interface BattleState {
  seed: BattleSeed;
  tick: number;
  raiders: Raider[];
  mercs: Merc[];
  /** Đồng hồ nạp đạn của từng tháp, tính bằng SỐ BƯỚC còn lại. */
  cool: number[];
  coreCool: number;
  shots: Shot[];
  done: boolean;
  /** Số giặc đã hạ, và số giặc ôm hàng chạy thoát. */
  killed: number;
  escaped: number;
  /** Số giặc tới được thủ phủ, dù sau đó có thoát hay không. */
  reached: number;
}

export interface BattleOutcome {
  /** Tổng số giặc của đợt. */
  count: number;
  killed: number;
  escaped: number;
  reached: number;
  ticks: number;
  /** Phần đợt lọt lưới, 0 tới 1. Hậu quả tính theo đúng con số này. */
  leak: number;
}

// ------------------------------------------------------------------ dựng trận

export function raiderCount(power: number): number {
  return Math.max(RAIDERS_MIN, Math.min(RAIDERS_MAX, Math.round(power / POWER_PER_RAIDER)));
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

export function battleStart(seed: BattleSeed): BattleState {
  const n = raiderCount(seed.power);
  const lanes = lanesOf(seed.wave);
  /*
   * ĐỘI HÌNH, KHÔNG PHẢI HÀNG MỘT.
   *
   * Bản đầu rải mỗi con lùi thêm 2,4 đơn vị, nên một đợt ba sáu tên kéo dài một trăm ba
   * chục đơn vị — chúng lũ lượt bước vào tầm bắn từng đứa một và bị bắn tỉa gọn ghẽ. Đo ra
   * 100% bị hạ, 57 thắng trên 58 trận: không phải thế trận giỏi, mà là đội hình ngu. Mỗi
   * tháp chỉ bắn được MỘT mục tiêu một lúc, nên sức mạnh thật của giặc nằm ở chỗ chúng tới
   * CÙNG LÚC. Xếp sáu tên một hàng ngang thì cả toán gói gọn trong chừng mười lăm đơn vị.
   */
  const HANG = 6;
  const hp = RAIDER_HP;
  const raiders: Raider[] = [];
  for (let i = 0; i < n; i += 1) {
    const lane = lanes[i % lanes.length];
    const k = Math.floor(i / lanes.length);
    const [lx, lz] = lane;
    const doc = SPAWN_DIST + Math.floor(k / HANG) * 2.6;
    const ngang = ((k % HANG) - (HANG - 1) / 2) * 2.2
      + (hash2(seed.wave * 131 + i, 7, 0xba02) - 0.5) * 1.2;
    raiders.push({
      x: lx * doc + lz * ngang,
      z: lz * doc + lx * ngang,
      hp, state: 'march', loaded: false, work: 0,
      face: Math.atan2(-lx, -lz),
    });
  }
  const mercs: Merc[] = [];
  for (let i = 0; i < seed.mercs; i += 1) {
    // Mỗi người một chỗ gác riêng trên vòng quanh thủ phủ. Bản đầu cho tất cả cùng quay
    // về (0,0) lúc rảnh, và sáu người chồng khít lên nhau thành một thân.
    const g = (i / Math.max(1, seed.mercs)) * Math.PI * 2;
    const r = 5.5 + (i % 2) * 1.6;
    const hx = Math.sin(g) * r;
    const hz = Math.cos(g) * r;
    mercs.push({ x: hx, z: hz, hp: MERC_HP, face: g, hx, hz });
  }
  return {
    seed, tick: 0, raiders, mercs,
    cool: seed.towers.map(() => 0),
    coreCool: 0,
    shots: [],
    done: n === 0,
    killed: 0, escaped: 0, reached: 0,
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

function nearestMerc(s: BattleState, x: number, z: number, range: number): number {
  let best = -1;
  let bd = range * range;
  for (let i = 0; i < s.mercs.length; i += 1) {
    const m = s.mercs[i];
    const d = (m.x - x) * (m.x - x) + (m.z - z) * (m.z - z);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Nhích một điểm về phía đích, trả về khoảng cách còn lại sau khi đi. */
function toward(e: { x: number; z: number; face: number }, tx: number, tz: number, speed: number): number {
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
 * Một bước của trận. Thứ tự trong hàm này là một phần của luật chơi: tháp bắn trước, rồi
 * lính đánh, rồi giặc đi. Đổi thứ tự là đổi kết quả.
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
    r.hp -= TOWER_DMG_BASE + TOWER_DMG_PER_LEVEL * t.level;
    s.shots.push({ x0: t.x, z0: t.z, x1: r.x, z1: r.z });
    s.cool[i] = Math.round(TOWER_RELOAD / TICK);
  }

  // --- thủ phủ chống trả, mạnh theo số dân đang ở nhà
  if (s.coreCool > 0) s.coreCool -= 1;
  else {
    const k = nearestRaider(s, 0, 0, CORE_RANGE * (bao ? STORM_RANGE_MULT : 1));
    if (k >= 0) {
      s.raiders[k].hp -= CORE_DMG_BASE + CORE_DMG_PER_MILITIA * s.seed.militia;
      s.shots.push({ x0: 0, z0: 0, x1: s.raiders[k].x, z1: s.raiders[k].z });
      s.coreCool = Math.round(CORE_RELOAD / TICK);
    }
  }

  // --- lính đánh thuê chặn đường
  for (let i = 0; i < s.mercs.length; i += 1) {
    const m = s.mercs[i];
    // Chọn mục tiêu theo khoảng cách TỪ THỦ PHỦ, không theo khoảng cách từ chính mình.
    let k = -1;
    let bd = Infinity;
    for (let j = 0; j < s.raiders.length; j += 1) {
      const r = s.raiders[j];
      if (Math.hypot(r.x, r.z) > MERC_LEASH) continue;
      const d = (r.x - m.x) * (r.x - m.x) + (r.z - m.z) * (r.z - m.z);
      if (d < bd) { bd = d; k = j; }
    }
    if (k < 0) {
      // Không có ai để đánh thì về đúng chỗ gác của mình.
      toward(m, m.hx, m.hz, MERC_SPEED * 0.7);
      continue;
    }
    const r = s.raiders[k];
    const d = Math.hypot(r.x - m.x, r.z - m.z);
    if (d > 1.3) { toward(m, r.x, r.z, MERC_SPEED); continue; }
    m.face = Math.atan2(r.x - m.x, r.z - m.z);
    r.hp -= MERC_DPS * TICK;
    m.hp -= RAIDER_DPS * TICK;
  }

  // --- giặc đi
  for (let i = 0; i < s.raiders.length; i += 1) {
    const r = s.raiders[i];
    if (r.state === 'flee') {
      const d = Math.hypot(r.x, r.z);
      // Chạy thẳng ra ngoài theo hướng đang đứng so với thủ phủ.
      const ux = d > 1e-4 ? r.x / d : 1;
      const uz = d > 1e-4 ? r.z / d : 0;
      toward(r, r.x + ux * 10, r.z + uz * 10, RAIDER_SPEED);
      continue;
    }
    // Đang bị lính chắn ngay trước mặt thì dừng lại mà đánh.
    const km = nearestMerc(s, r.x, r.z, 1.3);
    if (km >= 0) { r.face = Math.atan2(s.mercs[km].x - r.x, s.mercs[km].z - r.z); continue; }
    if (r.state === 'loot') {
      r.work -= 1;
      if (r.work <= 0) { r.state = 'flee'; r.loaded = true; }
      continue;
    }
    const con = toward(r, 0, 0, RAIDER_SPEED);
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
      s.raiders.splice(i, 1);
      continue;
    }
    if (r.state === 'flee' && Math.hypot(r.x, r.z) >= ESCAPE_DIST) {
      if (r.loaded) s.escaped += 1;
      s.raiders.splice(i, 1);
    }
  }
  for (let i = s.mercs.length - 1; i >= 0; i -= 1) {
    if (s.mercs[i].hp <= 0) s.mercs.splice(i, 1);
  }

  s.tick += 1;
  if (s.raiders.length === 0 || s.tick >= MAX_TICKS) s.done = true;
}

// ------------------------------------------------------------------ chạy trọn

/**
 * Chạy trọn một trận và trả về sổ sách. Đây là hàm Economy gọi — cả lúc người chơi đang
 * nhìn lẫn lúc bù giờ vắng mặt, nên hai đường không thể lệch nhau.
 */
export function resolveBattle(seed: BattleSeed): BattleOutcome {
  const s = battleStart(seed);
  const count = s.raiders.length;
  while (!s.done) battleStep(s);
  // Con nào còn sống lúc hết giờ mà đã ôm hàng thì cũng tính là thoát: hết chín chục giây
  // mà chưa hạ được nó thì coi như nó đi mất.
  let con = 0;
  for (const r of s.raiders) if (r.loaded) con += 1;
  const escaped = s.escaped + con;
  return {
    count,
    killed: s.killed,
    escaped,
    reached: s.reached,
    ticks: s.tick,
    leak: count === 0 ? 0 : Math.min(1, escaped / count),
  };
}

/** Bốn làn đường quanh thủ phủ, cho HUD và cho bản mô phỏng vẽ hướng giặc tới. */
export function laneDirs(wave: number): readonly (readonly [number, number])[] {
  return lanesOf(wave);
}

/** Khoảng cách đổ bộ — camera vào trận phải khung được chừng này. */
export const BATTLE_RADIUS = SPAWN_DIST;

/** Giữ ROAD_SPACING được tham chiếu: làn giặc đi bám đúng trục đường của thế giới. */
export const LANE_SPACING = ROAD_SPACING;
