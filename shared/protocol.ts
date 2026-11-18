// Những gì trình duyệt và server nói với nhau trong một ván online.
//
// Đường truyền: server đẩy xuống bằng SSE (`/api/live/stream`), trình duyệt gửi
// lên bằng POST thường. Lý do không dùng WebSocket ở docs/IMPLEMENTATION.md.
//
// File này nằm trong shared/ vì cả hai bên phải hiểu giống hệt nhau. Đổi ở đây
// là đổi hợp đồng giữa hai bên — đổi một phía thôi là hỏng.

import type { EndReason, Side } from './chess.ts';
import type { Square } from './fen.ts';

/* ---------------- Thể thức ---------------- */

export interface TimeControl {
  /** Tổng thời gian mỗi bên, tính bằng mili giây. */
  initialMs: number;
  /** Cộng thêm sau mỗi nước đi. */
  incrementMs: number;
  /** Cách người ta quen gọi, ví dụ "5+0". */
  label: string;
}

/** Bốn thể thức cho chọn. Khóa cũng là thứ trình duyệt gửi lên. */
export const CONTROLS: Record<string, TimeControl> = {
  '3+2': { initialMs: 3 * 60_000, incrementMs: 2_000, label: '3+2' },
  '5+0': { initialMs: 5 * 60_000, incrementMs: 0, label: '5+0' },
  '10+0': { initialMs: 10 * 60_000, incrementMs: 0, label: '10+0' },
  '15+10': { initialMs: 15 * 60_000, incrementMs: 10_000, label: '15+10' },
};

export const DEFAULT_CONTROL = '10+0';

export type ControlKey = keyof typeof CONTROLS;

export const isControlKey = (v: unknown): v is string => typeof v === 'string' && v in CONTROLS;

/* ---------------- Trạng thái gửi xuống ---------------- */

export interface LivePlayer {
  name: string;
  /** Elo ván đấu lúc bắt đầu ván. */
  rating: number;
  /** Giờ còn lại tại thời điểm server gửi gói tin này. */
  clockMs: number;
  connected: boolean;
  /** Đối thủ là AI (bot của server, vào thay khi hàng chờ trống). */
  bot?: { id: string; blurb: string };
}

export interface LiveOver {
  winner: Side | 'draw';
  reason: EndReason;
  /** Elo sau ván của hai bên, để hiện "+8 / −8". */
  whiteRating: number;
  blackRating: number;
  whiteChange: number;
  blackChange: number;
  /** Id ván đã lưu, để bấm sang Xem lại. NULL nếu chưa lưu được. */
  gameId: number | null;
}

/** Một ván nhìn từ phía một người chơi. */
export interface LiveState {
  id: string;
  /** Bên mà NGƯỜI NHẬN gói tin này đang cầm. */
  youAre: Side;
  fen: string;
  /** Nước đi đã đánh, ghi bằng SAN. */
  history: string[];
  turn: Side;
  lastMove: [Square, Square] | null;
  white: LivePlayer;
  black: LivePlayer;
  control: TimeControl;
  /** Bên vừa đề nghị hòa, nếu đang có lời đề nghị chưa trả lời. */
  drawOfferFrom: Side | null;
  /** Hạn chót để bên mất kết nối quay lại, tính theo epoch ms. */
  reconnectBy: number | null;
  over: LiveOver | null;
  /** Lúc server gửi, để trình duyệt tự đếm lùi đồng hồ cho mượt. */
  at: number;
}

/* ---------------- Hàng chờ ---------------- */

export interface QueueState {
  /** Thể thức đang chờ. */
  control: string;
  /** Đã chờ bao lâu, mili giây. */
  waitedMs: number;
  /** Khoảng Elo đang chấp nhận ghép, ±bao nhiêu. */
  band: number;
  /** Tổng số người đang chờ cùng thể thức này, kể cả mình. */
  waiting: number;
}

/* ---------------- Sự kiện server đẩy xuống ---------------- */

export type LiveEvent =
  /** Gửi ngay khi mở luồng, và mỗi khi có gì đổi. */
  | { type: 'hello'; rating: number }
  | { type: 'queue'; queue: QueueState }
  | { type: 'queue-left' }
  | { type: 'state'; state: LiveState }
  /** Ván vừa kết thúc; `state.over` có đủ thông tin. */
  | { type: 'ended'; state: LiveState }
  /** Bot nói một câu (lời thoại viết sẵn). */
  | { type: 'say'; name: string; text: string };

/* ---------------- Mô tả lỗi ---------------- */

/** Lý do server từ chối, viết sẵn bằng tiếng Việt để hiện thẳng lên. */
export const REFUSALS: Record<string, string> = {
  'not-your-turn': 'Chưa tới lượt bạn.',
  'illegal-move': 'Nước này không hợp lệ.',
  'game-over': 'Ván đã kết thúc.',
  'not-in-game': 'Bạn không ở trong ván này.',
  'no-such-game': 'Không tìm thấy ván.',
  'no-draw-offer': 'Không có lời đề nghị hòa nào.',
  'already-queued': 'Bạn đang ở trong hàng chờ rồi.',
  'already-playing': 'Bạn đang có một ván chưa xong.',
  'advisor-during-game': 'Đang trong ván online thì không xem được lời bình.',
};
