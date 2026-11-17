// Nối với server cho ván online.
//
// Server đẩy xuống bằng SSE, mình gửi lên bằng POST. `EventSource` tự kết nối
// lại khi đứt mạng, nên chỗ "rớt mạng rồi vào lại" không phải tự viết.

import type { LiveEvent, LiveState, QueueState } from '../../shared/protocol.ts';

export interface LiveStore {
  /** Ván đang chơi, hoặc ván vừa xong (còn `over`). */
  state: LiveState | null;
  queue: QueueState | null;
  /** Luồng tới server có đang mở không. */
  connected: boolean;
  /** Lỗi lần gọi gần nhất, để hiện lên rồi thôi. */
  error: string | null;
}

export const live: LiveStore = { state: null, queue: null, connected: false, error: null };

let es: EventSource | null = null;
let rerender: (() => void) | null = null;
/** Việc làm mỗi giây khi đang có ván: mặc định vẽ lại, màn hình có thể thay. */
let onTick: (() => void) | null = null;
let ticker: number | null = null;

/** Đồng hồ phải nhích mỗi giây dù server chưa gửi gì. */
function startTicker(): void {
  if (ticker !== null) return;
  ticker = window.setInterval(() => {
    if (live.state && !live.state.over) (onTick ?? rerender)?.();
    else stopTicker();
  }, 1000);
}

function stopTicker(): void {
  if (ticker === null) return;
  clearInterval(ticker);
  ticker = null;
}

function apply(ev: LiveEvent): void {
  switch (ev.type) {
    case 'hello':
      live.connected = true;
      break;
    case 'queue':
      live.queue = ev.queue;
      break;
    case 'queue-left':
      live.queue = null;
      break;
    case 'state':
      live.state = ev.state;
      live.queue = null;
      startTicker();
      break;
    case 'ended':
      live.state = ev.state;
      live.queue = null;
      stopTicker();
      break;
  }
  rerender?.();
}

/** Mở luồng. Gọi lại nhiều lần cũng chỉ mở một luồng. */
export function connect(onChange: () => void, tick?: () => void): void {
  rerender = onChange;
  onTick = tick ?? null;
  if (es) return;
  es = new EventSource('/api/live/stream', { withCredentials: true });
  es.onmessage = (e) => {
    try {
      apply(JSON.parse(e.data) as LiveEvent);
    } catch {
      /* gói tin lạ: bỏ qua */
    }
  };
  es.onerror = () => {
    // EventSource tự nối lại; chỉ cần báo cho người dùng biết đang mất kết nối.
    live.connected = false;
    rerender?.();
  };
  es.onopen = () => {
    live.connected = true;
    rerender?.();
  };
}

export function disconnect(): void {
  es?.close();
  es = null;
  stopTicker();
  live.connected = false;
}

async function post<T>(path: string, body?: unknown, method = 'POST'): Promise<T | null> {
  try {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      live.error = data.error ?? `Lỗi ${res.status}`;
      rerender?.();
      return null;
    }
    live.error = null;
    return data;
  } catch {
    live.error = 'Không gọi được server.';
    rerender?.();
    return null;
  }
}

export const joinQueue = (control: string) => post<{ ok: boolean }>('/api/live/queue', { control });
export const leaveQueue = () => post<{ ok: boolean }>('/api/live/queue', undefined, 'DELETE');
export const createInvite = (control: string) => post<{ code: string }>('/api/live/invite', { control });
export const joinByCode = (code: string) => post<{ ok: boolean; id: string }>('/api/live/join', { code });

export const sendMove = (from: string, to: string, promotion?: string) =>
  post<{ ok: boolean }>('/api/live/act', { what: 'move', from, to, promotion });
export const resign = () => post<{ ok: boolean }>('/api/live/act', { what: 'resign' });
export const offerDraw = () => post<{ ok: boolean }>('/api/live/act', { what: 'draw-offer' });
export const acceptDraw = () => post<{ ok: boolean }>('/api/live/act', { what: 'draw-accept' });
export const declineDraw = () => post<{ ok: boolean }>('/api/live/act', { what: 'draw-decline' });

/** Lấy trạng thái một lần, để vẽ ngay mà không phải chờ sự kiện đầu tiên. */
export async function loadStatus(): Promise<void> {
  try {
    const res = await fetch('/api/live/status', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = (await res.json()) as { state: LiveState | null; queue: QueueState | null };
    live.state = data.state;
    live.queue = data.queue;
    if (live.state && !live.state.over) startTicker();
  } catch {
    /* chưa có server: màn hình tự biết đường hiện */
  }
}

/**
 * Giờ còn lại ngay lúc này, tính từ gói tin gần nhất.
 *
 * Server gửi giờ tại thời điểm `state.at`; từ đó tới giờ bên đang đi đã tiêu
 * thêm chừng ấy. Không trừ ở đây thì đồng hồ đứng im giữa hai nước đi.
 */
export function clockNow(state: LiveState, side: 'w' | 'b'): number {
  const p = side === 'w' ? state.white : state.black;
  if (state.over || side !== state.turn) return p.clockMs;
  return Math.max(0, p.clockMs - (Date.now() - state.at));
}
