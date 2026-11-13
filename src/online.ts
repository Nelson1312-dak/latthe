/**
 * CHẾ ĐỘ ONLINE — phía trình duyệt.
 *
 * Bật bằng biến lúc build (`VITE_ONLINE=1`). Bản production hiện chưa có máy chủ nên mặc
 * định TẮT: giao diện không hiện gì, và không có lời gọi mạng nào bị 404 làm bẩn console.
 *
 * Làng nào cũng có một mã người chơi ẩn danh (không đăng nhập) lưu riêng với ván chơi. Ảnh
 * chụp làng gửi lên máy chủ để người khác đánh được lúc mình vắng; vụ cướp nhằm vào mình thì
 * nhận về khi đồng bộ và trừ thẳng khỏi kho.
 */
import type { Economy } from './Economy';
import type { AttackReply, Opponent, RaidNote, VillageSnapshot } from './assault';
import type { Troops } from './types';
import { RESOURCE_KINDS } from './types';

export const ONLINE: boolean = import.meta.env.VITE_ONLINE === '1';

const KEY = 'latbai-online/v1';
/** Đồng bộ nền mỗi hai phút khi đang mở game. */
const SYNC_MS = 120000;

interface Creds { id: string; token: string }

export class Online {
  private creds: Creds | null = null;
  /** Gọi khi nhận được vụ cướp nhằm vào làng mình. */
  onRaided: ((notes: RaidNote[]) => void) | null = null;
  /** Lỗi gần nhất (null là ổn), để bảng hiện đúng lý do thay vì im lặng. */
  lastError: string | null = null;
  private timer = 0;

  constructor(private readonly economy: Economy) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const c = JSON.parse(raw) as Partial<Creds>;
        if (typeof c.id === 'string' && typeof c.token === 'string') this.creds = { id: c.id, token: c.token };
      }
    } catch {
      /* localStorage bị chặn — sẽ đăng ký lại mỗi phiên */
    }
  }

  start(): void {
    window.setTimeout(() => { void this.sync(); }, 3000);
    this.timer = window.setInterval(() => { void this.sync(); }, SYNC_MS);
  }

  stop(): void { window.clearInterval(this.timer); }

  private async call<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (auth) {
      if (!this.creds) throw new Error('Not registered');
      headers.authorization = `Bearer ${this.creds.token}`;
    }
    let res: Response;
    try {
      res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new Error('Cannot reach the online server');
    }
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? `Server said ${res.status}`);
    return data as T;
  }

  private async ensure(): Promise<void> {
    if (this.creds) return;
    this.creds = await this.call<Creds>('POST', '/api/register', {}, false);
    try { localStorage.setItem(KEY, JSON.stringify(this.creds)); } catch { /* bỏ qua */ }
  }

  /** Ảnh chụp làng này lúc này — đúng phần mà `battleSeed` đã dùng để dựng thế thủ. */
  snapshot(): VillageSnapshot {
    const e = this.economy;
    const seed = e.battleSeed(1);
    return {
      name: e.state.village.name,
      color: e.state.village.color,
      level: e.state.level,
      age: e.state.age,
      towers: seed.towers.map((t) => ({ ...t })),
      army: { ...e.state.army },
      smith: { ...e.state.smith },
      militia: seed.militia,
      inv: { ...e.state.inv },
    };
  }

  /**
   * Nhận vụ cướp trước, gửi ảnh sau. Thứ tự này không phải tuỳ ý: máy chủ lưu kho đã trừ
   * phần bị cướp chưa nhận, nên nhận xong rồi trừ ở đây thì ảnh gửi lên khớp với sổ máy chủ.
   */
  async sync(): Promise<void> {
    try {
      await this.ensure();
      const got = await this.call<{ events: RaidNote[] }>('POST', '/api/inbox/claim');
      if (got.events.length > 0) {
        const tong = Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 0])) as Record<string, number>;
        for (const ev of got.events) for (const k of RESOURCE_KINDS) tong[k] += ev.loot[k];
        this.economy.pillage(tong);
        this.onRaided?.(got.events);
      }
      await this.call('PUT', '/api/village', this.snapshot());
      this.lastError = null;
    } catch (e) {
      this.lastError = (e as Error).message;
    }
  }

  async opponents(): Promise<{ sent: number; list: Opponent[] }> {
    await this.sync();
    if (this.lastError) throw new Error(this.lastError);
    return this.call('GET', '/api/opponents');
  }

  async attack(targetId: string, troops: Troops, lane: number): Promise<AttackReply> {
    await this.sync();
    if (this.lastError) throw new Error(this.lastError);
    return this.call('POST', '/api/attack', { targetId, troops, lane });
  }
}
