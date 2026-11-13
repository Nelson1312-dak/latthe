/**
 * Lưu trữ của máy chủ online: một giao diện nhỏ, hai bản cài đặt.
 *
 * `core.ts` chỉ biết `Store`, không biết SQL. `PgStore` là bản dùng thật (Postgres); `MemStore`
 * giữ mọi thứ trong bộ nhớ cho kiểm thử và cho lúc chưa có `ONLINE_DB_URL`.
 *
 * ĐỒNG THỜI: mọi thao tác GHI chạy trong `tx`, và `tx` giữ một khoá tư vấn toàn cục nên các
 * thao tác ghi xếp hàng nối đuôi nhau. Hai người đánh cùng một làng cùng lúc thì người thứ hai
 * thấy làng đã có khiên chứ không cướp lần hai. Chậm hơn khoá theo từng hàng, nhưng bản thử
 * không cần nhanh, cần ĐÚNG — nâng cấp thành khoá hàng khi có người chơi thật đủ đông.
 */
import pg from 'pg';
import type { Loot, VillageSnapshot } from '../src/assault';
import { RESOURCE_KINDS } from '../src/types';

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

export interface Store {
  playerByToken(hash: string): Promise<Player | null>;
  player(id: string): Promise<Player | null>;
  createPlayer(p: Player): Promise<void>;
  savePlayer(p: Player): Promise<void>;
  /** Làng có ảnh chụp, hết che chắn, còn hoạt động — ứng viên cho danh sách đối thủ. */
  candidates(excludeId: string, now: number, since: number, limit: number): Promise<Player[]>;
  /** Hàng đang chờ bị trừ khỏi kho một làng: các vụ cướp chưa được trình duyệt của nó nhận. */
  pendingLoss(id: string): Promise<Loot>;
  addEvent(e: Omit<RaidEvent, 'id' | 'claimed'>): Promise<void>;
  /** Giao các vụ chưa nhận và đánh dấu đã nhận trong cùng một lệnh. */
  claimEvents(id: string, now: number): Promise<RaidEvent[]>;
  nextNonce(): Promise<number>;
  tx<T>(fn: (s: Store) => Promise<T>): Promise<T>;
}

const zeroLoot = (): Loot => Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 0])) as Loot;
const DAY = 24 * 3600 * 1000;

// ------------------------------------------------------------------ bộ nhớ

export class MemStore implements Store {
  private players = new Map<string, Player>();
  private events: RaidEvent[] = [];
  private evId = 1;
  private nonce = 1;
  /** Hàng đợi ghi: mỗi `tx` chờ cái trước xong, y như khoá tư vấn của Postgres. */
  private chain: Promise<unknown> = Promise.resolve();

  async playerByToken(hash: string): Promise<Player | null> {
    for (const p of this.players.values()) if (p.tokenHash === hash) return structuredClone(p);
    return null;
  }
  async player(id: string): Promise<Player | null> {
    const p = this.players.get(id);
    return p ? structuredClone(p) : null;
  }
  async createPlayer(p: Player): Promise<void> { this.players.set(p.id, structuredClone(p)); }
  async savePlayer(p: Player): Promise<void> { this.players.set(p.id, structuredClone(p)); }
  async candidates(excludeId: string, now: number, since: number, limit: number): Promise<Player[]> {
    return [...this.players.values()]
      .filter((p) => p.id !== excludeId && p.snapshot && p.shieldUntil <= now && p.updated >= since)
      .sort((a, b) => b.updated - a.updated).slice(0, limit).map((p) => structuredClone(p));
  }
  async pendingLoss(id: string): Promise<Loot> {
    const out = zeroLoot();
    for (const e of this.events) {
      if (e.targetId !== id || e.claimed) continue;
      for (const k of RESOURCE_KINDS) out[k] += e.loot[k];
    }
    return out;
  }
  async addEvent(e: Omit<RaidEvent, 'id' | 'claimed'>): Promise<void> {
    this.events.push({ ...e, id: this.evId, claimed: false });
    this.evId += 1;
  }
  async claimEvents(id: string, now: number): Promise<RaidEvent[]> {
    const mine = this.events.filter((e) => e.targetId === id && !e.claimed);
    for (const e of mine) e.claimed = true;
    this.events = this.events.filter((e) => !e.claimed || e.at > now - DAY);
    return structuredClone(mine);
  }
  async nextNonce(): Promise<number> { return this.nonce++; }
  tx<T>(fn: (s: Store) => Promise<T>): Promise<T> {
    const run = this.chain.then(() => fn(this));
    this.chain = run.catch(() => undefined);
    return run;
  }
}

// ------------------------------------------------------------------ Postgres

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id            text PRIMARY KEY,
  token_hash    text NOT NULL UNIQUE,
  created       bigint NOT NULL,
  updated       bigint NOT NULL,
  snapshot      jsonb,
  shield_until  bigint NOT NULL DEFAULT 0,
  last_hit      jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS players_active ON players (updated) WHERE snapshot IS NOT NULL;
CREATE TABLE IF NOT EXISTS raid_events (
  id         bigserial PRIMARY KEY,
  at         bigint NOT NULL,
  target_id  text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  by_name    text NOT NULL,
  loot_frac  double precision NOT NULL,
  loot       jsonb NOT NULL,
  claimed    boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS raid_events_pending ON raid_events (target_id) WHERE NOT claimed;
CREATE SEQUENCE IF NOT EXISTS battle_nonce;
`;

/** Khoá tư vấn toàn cục cho mọi thao tác ghi. Số tuỳ ý, miễn là cả máy chủ dùng chung một số. */
const LOCK_KEY = 878701;

interface Queryable { query: (text: string, params?: unknown[]) => Promise<pg.QueryResult> }

const rowToPlayer = (r: Record<string, unknown>): Player => ({
  id: r.id as string,
  tokenHash: r.token_hash as string,
  created: Number(r.created),
  updated: Number(r.updated),
  snapshot: (r.snapshot as VillageSnapshot | null) ?? null,
  shieldUntil: Number(r.shield_until),
  lastHit: (r.last_hit as Record<string, number>) ?? {},
});

export class PgStore implements Store {
  private constructor(private readonly pool: pg.Pool, private readonly q: Queryable) {}

  static async open(url: string): Promise<PgStore> {
    // bigint về dạng số: mọi mốc thời gian ở đây nhỏ hơn 2^53.
    pg.types.setTypeParser(20, (v) => Number(v));
    const pool = new pg.Pool({ connectionString: url, max: 6 });
    await pool.query(SCHEMA);
    return new PgStore(pool, pool);
  }

  async close(): Promise<void> { await this.pool.end(); }

  async playerByToken(hash: string): Promise<Player | null> {
    const r = await this.q.query('SELECT * FROM players WHERE token_hash = $1', [hash]);
    return r.rows[0] ? rowToPlayer(r.rows[0]) : null;
  }
  async player(id: string): Promise<Player | null> {
    const r = await this.q.query('SELECT * FROM players WHERE id = $1', [id]);
    return r.rows[0] ? rowToPlayer(r.rows[0]) : null;
  }
  async createPlayer(p: Player): Promise<void> {
    await this.q.query(
      'INSERT INTO players (id, token_hash, created, updated, snapshot, shield_until, last_hit) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [p.id, p.tokenHash, p.created, p.updated, p.snapshot, p.shieldUntil, p.lastHit]);
  }
  async savePlayer(p: Player): Promise<void> {
    await this.q.query(
      'UPDATE players SET updated=$2, snapshot=$3, shield_until=$4, last_hit=$5 WHERE id=$1',
      [p.id, p.updated, p.snapshot, p.shieldUntil, p.lastHit]);
  }
  async candidates(excludeId: string, now: number, since: number, limit: number): Promise<Player[]> {
    const r = await this.q.query(
      `SELECT * FROM players WHERE id <> $1 AND snapshot IS NOT NULL AND shield_until <= $2 AND updated >= $3
       ORDER BY updated DESC LIMIT $4`, [excludeId, now, since, limit]);
    return r.rows.map(rowToPlayer);
  }
  async pendingLoss(id: string): Promise<Loot> {
    const r = await this.q.query('SELECT loot FROM raid_events WHERE target_id = $1 AND NOT claimed', [id]);
    const out = zeroLoot();
    for (const row of r.rows) for (const k of RESOURCE_KINDS) out[k] += Number((row.loot as Loot)[k] ?? 0);
    return out;
  }
  async addEvent(e: Omit<RaidEvent, 'id' | 'claimed'>): Promise<void> {
    await this.q.query('INSERT INTO raid_events (at, target_id, by_name, loot_frac, loot) VALUES ($1,$2,$3,$4,$5)',
      [e.at, e.targetId, e.byName, e.lootFrac, e.loot]);
  }
  async claimEvents(id: string, now: number): Promise<RaidEvent[]> {
    const r = await this.q.query(
      `UPDATE raid_events SET claimed = true WHERE target_id = $1 AND NOT claimed
       RETURNING id, at, target_id, by_name, loot_frac, loot`, [id]);
    await this.q.query('DELETE FROM raid_events WHERE claimed AND at < $1', [now - DAY]);
    return r.rows.map((x) => ({
      id: Number(x.id), at: Number(x.at), targetId: x.target_id as string, byName: x.by_name as string,
      lootFrac: Number(x.loot_frac), loot: x.loot as Loot, claimed: true,
    })).sort((a, b) => a.id - b.id);
  }
  async nextNonce(): Promise<number> {
    const r = await this.q.query("SELECT nextval('battle_nonce') AS n");
    return Number(r.rows[0].n);
  }
  async tx<T>(fn: (s: Store) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
      const out = await fn(new PgStore(this.pool, c));
      await c.query('COMMIT');
      return out;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
  }
}
