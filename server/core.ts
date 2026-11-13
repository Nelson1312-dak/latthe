/**
 * Máy chủ chế độ online — LUẬT, không dính HTTP hay đĩa.
 *
 * Mọi hàm ở đây nhận `Db` (một object JSON thuần) và trả về kết quả hoặc ném `HttpError`.
 * Lớp HTTP và lớp lưu trữ nằm ở main.ts, nên muốn đổi sang Postgres hay hàm serverless chỉ
 * phải viết lại hai chỗ đó, còn luật giữ nguyên.
 *
 * ĐÂY LÀ BẢN THỬ, và nó có một giới hạn thẳng thắn phải nói ra: ảnh chụp làng (quân, tháp,
 * kho) do TRÌNH DUYỆT gửi lên, vì kinh tế của game chạy hết ở trình duyệt. Máy chủ kẹp mọi
 * số vào khoảng hợp lý, chặn đem nhiều quân hơn ảnh chụp đã khai, và TỰ CHẠY trận (không
 * tin kết quả client báo) — nhưng không chặn được người sửa localStorage rồi khai một đội
 * quân hợp lý mà không có thật. Muốn chặn hẳn thì máy chủ phải giữ cả phần kinh tế; việc
 * ấy là bước sau, không phải bản thử.
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  LOOT_SHARE, MAX_SENT, REPEAT_COOLDOWN, SHIELD_SECONDS, SHIELD_SECONDS_LIGHT, armyPowerOf,
  assaultSeed, difficultyOf, lootOf, powerOf, resolveAssault, sanitizeSnapshot, sanitizeTroops,
} from '../src/assault';
import type { AttackReply, Loot, Opponent, VillageSnapshot } from '../src/assault';
import { RESOURCE_KINDS, TROOP_KINDS } from '../src/types';
import type { Troops } from '../src/types';

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export interface Player {
  id: string;
  tokenHash: string;
  created: number;
  updated: number;
  snapshot: VillageSnapshot | null;
  /** Thời điểm hết che chắn (ms). Đang che thì không ai đánh được. */
  shieldUntil: number;
  /** Lần cuối đánh từng đối thủ (ms), để chặn cày một làng liên tục. */
  lastHit: Record<string, number>;
}

export interface RaidEvent {
  id: number;
  at: number;
  targetId: string;
  byName: string;
  lootFrac: number;
  loot: Loot;
  claimed: boolean;
}

export interface Db {
  players: Record<string, Player>;
  events: RaidEvent[];
  nextEvent: number;
  nextNonce: number;
}

export const emptyDb = (): Db => ({ players: {}, events: [], nextEvent: 1, nextNonce: 1 });

const hash = (t: string): string => createHash('sha256').update(t).digest('hex');

export function register(db: Db, now: number): { id: string; token: string } {
  const id = randomBytes(6).toString('hex');
  const token = randomBytes(24).toString('hex');
  db.players[id] = {
    id, tokenHash: hash(token), created: now, updated: now, snapshot: null, shieldUntil: 0, lastHit: {},
  };
  return { id, token };
}

export function authenticate(db: Db, header: string | undefined): Player {
  const m = /^Bearer ([0-9a-f]{48})$/.exec(header ?? '');
  if (!m) throw new HttpError(401, 'Missing token');
  const h = hash(m[1]);
  for (const p of Object.values(db.players)) if (p.tokenHash === h) return p;
  throw new HttpError(401, 'Unknown token');
}

/** Hàng đang chờ bị trừ khỏi kho một làng: các vụ cướp chưa được trình duyệt của nó nhận. */
function pendingLoss(db: Db, id: string): Loot {
  const out = Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 0])) as Loot;
  for (const e of db.events) {
    if (e.targetId !== id || e.claimed) continue;
    for (const k of RESOURCE_KINDS) out[k] += e.loot[k];
  }
  return out;
}

/**
 * Lưu ảnh chụp làng. Kho lưu ở đây đã TRỪ phần bị cướp mà trình duyệt chưa nhận: nếu không,
 * một trình duyệt chậm gửi ảnh cũ lên là xoá mất vụ cướp, và kẻ cướp được hàng hai lần.
 */
export function putVillage(db: Db, me: Player, raw: unknown, now: number): { power: number; shieldUntil: number } {
  const snap = sanitizeSnapshot(raw);
  if (!snap) throw new HttpError(400, 'Bad village');
  const lo = pendingLoss(db, me.id);
  for (const k of RESOURCE_KINDS) snap.inv[k] = Math.max(0, snap.inv[k] - lo[k]);
  me.snapshot = snap;
  me.updated = now;
  return { power: powerOf(snap), shieldUntil: me.shieldUntil };
}

const ACTIVE_MS = 30 * 24 * 3600 * 1000;

/**
 * Danh sách làng có thể đánh: bỏ làng mình, làng đang được che chắn, làng bỏ hoang. Xếp theo
 * độ gần của "độ khó" tới mức cân tài cân sức (0,5), để người ta thấy ngay những trận đáng
 * đánh trước.
 */
export function opponents(db: Db, me: Player, now: number): { sent: number; list: Opponent[] } {
  if (!me.snapshot) throw new HttpError(400, 'Sync your village first');
  const mine = armyPowerOf(me.snapshot.army, me.snapshot.smith);
  const list: Opponent[] = [];
  for (const p of Object.values(db.players)) {
    if (p.id === me.id || !p.snapshot || p.shieldUntil > now || now - p.updated > ACTIVE_MS) continue;
    const pw = powerOf(p.snapshot);
    const loot = lootOf(p.snapshot.inv, 1);
    // Làng không có gì để cướp (kho còn trong phần được giữ) thì không đáng mang quân tới.
    if (RESOURCE_KINDS.every((k) => loot[k] === 0)) continue;
    list.push({
      id: p.id, name: p.snapshot.name, color: p.snapshot.color, level: p.snapshot.level,
      age: p.snapshot.age, power: pw, loot,
      difficulty: difficultyOf(pw, mine),
      wait: Math.max(0, Math.ceil(((me.lastHit[p.id] ?? 0) + REPEAT_COOLDOWN * 1000 - now) / 1000)),
    });
  }
  const gan = (o: Opponent): number => Math.abs(o.power / Math.max(1, mine) - 0.5);
  list.sort((a, b) => gan(a) - gan(b) || a.id.localeCompare(b.id));
  return { sent: mine, list: list.slice(0, 8) };
}

export function attack(db: Db, me: Player, body: unknown, now: number): AttackReply {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (!me.snapshot) throw new HttpError(400, 'Sync your village first');
  const target = typeof b.targetId === 'string' ? db.players[b.targetId] : undefined;
  if (!target || !target.snapshot) throw new HttpError(404, 'No such village');
  if (target.id === me.id) throw new HttpError(400, 'Cannot raid yourself');
  if (target.shieldUntil > now) throw new HttpError(409, 'That village is shielded');
  const wait = (me.lastHit[target.id] ?? 0) + REPEAT_COOLDOWN * 1000 - now;
  if (wait > 0) throw new HttpError(429, `Raided recently, wait ${Math.ceil(wait / 60000)} min`);

  const troops: Troops = sanitizeTroops(b.troops, MAX_SENT);
  let total = 0;
  for (const k of TROOP_KINDS) {
    if (troops[k] > me.snapshot.army[k]) throw new HttpError(400, `You do not have that many ${k}`);
    total += troops[k];
  }
  if (total < 1) throw new HttpError(400, 'Send at least one soldier');
  if (total > MAX_SENT) throw new HttpError(400, `At most ${MAX_SENT} soldiers per raid`);
  const lane = typeof b.lane === 'number' ? Math.floor(b.lane) : 0;

  const seed = assaultSeed(target.snapshot, { troops, smith: me.snapshot.smith }, lane, db.nextNonce);
  db.nextNonce += 1;
  const outcome = resolveAssault(seed);
  const loot = lootOf(target.snapshot.inv, outcome.lootFrac);

  // Sổ sách: kho làng bị đánh giảm ngay (kẻ đến sau không cướp lại phần đã mất), quân bên
  // công hao đi phần đã ngã, và hai bên đổi trạng thái che chắn.
  for (const k of RESOURCE_KINDS) target.snapshot.inv[k] -= loot[k];
  for (const k of TROOP_KINDS) me.snapshot.army[k] = Math.max(0, me.snapshot.army[k] - outcome.fell[k]);
  me.shieldUntil = 0;
  me.lastHit[target.id] = now;
  target.shieldUntil = now + 1000 * (outcome.lootFrac >= LOOT_SHARE ? SHIELD_SECONDS : SHIELD_SECONDS_LIGHT);
  db.events.push({
    id: db.nextEvent, at: now, targetId: target.id, byName: me.snapshot.name,
    lootFrac: outcome.lootFrac, loot, claimed: false,
  });
  db.nextEvent += 1;
  return { seed, outcome, loot, targetName: target.snapshot.name, shieldUntil: target.shieldUntil };
}

/**
 * Giao các vụ cướp chưa nhận cho chủ làng, và đánh dấu đã nhận NGAY TRONG LÚC TRẢ. Nếu
 * trình duyệt chết giữa chừng thì mất một thông báo chứ không bị trừ hàng hai lần.
 */
export function claimInbox(db: Db, me: Player, now: number): { events: RaidEvent[]; shieldUntil: number } {
  const events = db.events.filter((e) => e.targetId === me.id && !e.claimed);
  for (const e of events) e.claimed = true;
  // Giữ nhật ký ngắn: bỏ những vụ đã nhận cũ hơn một ngày.
  const han = now - 24 * 3600 * 1000;
  db.events = db.events.filter((e) => !e.claimed || e.at > han);
  return { events, shieldUntil: me.shieldUntil };
}
