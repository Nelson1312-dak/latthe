// Nối với server cho ván online.
//
// Server đẩy xuống bằng SSE, mình gửi lên bằng POST. Luồng tự nối lại khi đứt
// mạng (xem mởLuồng).

import type { LiveEvent, LiveState, QueueState } from '../../shared/protocol.ts';
import { NGROK_SKIP } from './api-header.ts';

export interface LiveStore {
  /** Ván đang chơi, hoặc ván vừa xong (còn `over`). */
  state: LiveState | null;
  queue: QueueState | null;
  /** Luồng tới server có đang mở không. */
  connected: boolean;
  /** Lỗi lần gọi gần nhất, để hiện lên rồi thôi. */
  error: string | null;
  /** Lời thoại của bot trong ván đang xem (mới nhất ở cuối). */
  chat: { name: string; text: string; at: number }[];
}

export const live: LiveStore = { state: null, queue: null, connected: false, error: null, chat: [] };

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
    case 'say':
      live.chat = [...live.chat, { name: ev.name, text: ev.text, at: Date.now() }].slice(-4);
      break;
    case 'state':
      // Sang ván khác thì lời thoại ván cũ không còn liên quan
      if (live.state?.id !== ev.state.id) live.chat = [];
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
  if (stream) return;
  void mởLuồng();
}

/** Luồng đang mở; huỷ nó là đóng luồng. */
let stream: AbortController | null = null;

/**
 * Mở luồng sự kiện và giữ nó sống: đứt thì tự nối lại (chờ 1, 2, 4… tối đa 10 giây).
 *
 * Trên bản web công khai, `/api` đi qua Vercel — mà Vercel gom đệm kết nối dài
 * nên luồng không bao giờ tới (thử thật: 12 giây không một gói nào). Nên xin
 * một cái vé qua đường thường rồi mở luồng THẲNG tới máy chủ bằng vé đó.
 * Chạy trong máy thì server trả url rỗng, dùng đường tương đối.
 *
 * Đọc bằng fetch chứ không dùng EventSource, vì hai lẽ:
 * - EventSource không gắn được header, mà thiếu header `ngrok-skip-browser-warning`
 *   thì ngrok miễn phí trả về trang cảnh báo HTML thay vì luồng sự kiện.
 * - EventSource tự nối lại bằng ĐÚNG địa chỉ cũ, tức là bằng cái vé đã dùng rồi
 *   → bị từ chối → nó bỏ cuộc luôn. Mỗi lần nối lại phải xin vé mới.
 */
async function mởLuồng(): Promise<void> {
  if (stream) return;
  const me = new AbortController();
  stream = me;
  let lần = 0;
  while (stream === me) {
    let địaChỉ = '/api/live/stream';
    let khácOrigin = false;
    try {
      const r = await fetch('/api/live/ticket', { method: 'POST', credentials: 'same-origin' });
      if (r.status === 401) {
        // Chưa đăng nhập: không có gì để nghe
        if (stream === me) stream = null;
        return;
      }
      if (r.ok) {
        const { ticket, url } = (await r.json()) as { ticket: string; url: string };
        địaChỉ = `${url}/api/live/stream?ticket=${encodeURIComponent(ticket)}`;
        khácOrigin = Boolean(url);
      }
    } catch {
      /* chưa xin được vé: thử lại sau */
    }
    if (stream !== me) return;

    try {
      const res = await fetch(địaChỉ, {
        signal: me.signal,
        // Khác origin thì đi bằng vé, không gửi cookie
        credentials: khácOrigin ? 'omit' : 'same-origin',
        cache: 'no-store',
        headers: { accept: 'text/event-stream', [NGROK_SKIP]: '1' },
      });
      if (!res.ok || !res.body) throw new Error(`Lỗi ${res.status}`);
      live.connected = true;
      lần = 0;
      rerender?.();
      await đọcLuồng(res.body);
    } catch {
      if (me.signal.aborted) return;
    }
    if (stream !== me) return;
    live.connected = false;
    rerender?.();
    await new Promise((r) => setTimeout(r, Math.min(10_000, 1000 * 2 ** lần++)));
  }
}

/** Đọc luồng SSE: mỗi gói cách nhau một dòng trống, dữ liệu nằm sau "data:". */
async function đọcLuồng(body: ReadableStream<Uint8Array>): Promise<void> {
  const reader = body.getReader();
  const giải = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += giải.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const gói = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = gói
        .split('\n')
        .filter((d) => d.startsWith('data:'))
        .map((d) => d.slice(5).trimStart())
        .join('\n');
      if (!data) continue; // dòng giữ kết nối (": .") hoặc "retry:"
      try {
        apply(JSON.parse(data) as LiveEvent);
      } catch {
        /* gói tin lạ: bỏ qua */
      }
    }
  }
}

export function disconnect(): void {
  stream?.abort();
  stream = null;
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

export interface LadderStep {
  id: string;
  name: string;
  elo: number;
  blurb: string;
  beaten: boolean;
}

/** Sáu AI và những AI mình đã thắng (bậc thang). */
export async function loadLadder(): Promise<LadderStep[]> {
  try {
    const r = await fetch('/api/bots', { credentials: 'same-origin' });
    if (!r.ok) return [];
    return ((await r.json()) as { bots: LadderStep[] }).bots;
  } catch {
    return [];
  }
}

export const challengeBot = (bot: string, control: string) => post<{ ok: boolean }>('/api/live/bot', { bot, control });
