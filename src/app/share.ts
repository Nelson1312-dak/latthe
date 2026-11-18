// Chia sẻ ván: tạo link latbai.vn/van/<id> và ảnh tóm tắt để đăng mạng xã hội.
//
// Link: server lưu PGN + kết quả chấm (không gắn tài khoản), ai mở cũng xem
// được bàn cờ và bảng chấm. Ảnh: vẽ ngay trong trình duyệt bằng canvas —
// không gửi gì đi đâu.

import type { ReviewResult } from '../analysis/review.ts';
import type { MoveClass } from '../../shared/winrate.ts';

export interface ShareMeta {
  white: string;
  black: string;
  result: '1-0' | '0-1' | '½-½' | '';
  label: string;
  /** Bên của người chia sẻ (lật bàn cờ đúng phía khi người khác mở). */
  side: 'w' | 'b' | null;
}

export interface ShareState {
  /** PGN của ván đang chia sẻ — đổi ván thì bỏ. */
  pgn: string;
  busy: boolean;
  url: string | null;
  error: string | null;
  copied: boolean;
}

let state: ShareState | null = null;

export const shareStateFor = (pgn: string): ShareState | null => (state?.pgn === pgn ? state : null);

/** Tạo link chia sẻ (một lần cho mỗi ván). */
export async function createShareLink(pgn: string, review: ReviewResult, meta: ShareMeta, rerender: () => void): Promise<void> {
  if (state?.pgn === pgn && (state.busy || state.url)) return;
  state = { pgn, busy: true, url: null, error: null, copied: false };
  rerender();
  try {
    const r = await fetch('/api/share', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pgn, review, meta }),
    });
    const data = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!r.ok || !data.id) throw new Error(data.error ?? `Lỗi ${r.status}`);
    if (state?.pgn !== pgn) return;
    state.url = `${location.origin}/van/${data.id}`;
  } catch (err) {
    if (state?.pgn === pgn) state.error = (err as Error).message;
  } finally {
    if (state?.pgn === pgn) state.busy = false;
    rerender();
  }
}

export async function copyShareLink(rerender: () => void): Promise<void> {
  if (!state?.url) return;
  try {
    await navigator.clipboard.writeText(state.url);
    state.copied = true;
    rerender();
    setTimeout(() => {
      if (state) state.copied = false;
      rerender();
    }, 2000);
  } catch {
    /* trình duyệt không cho chép: người dùng tự bôi đen ô link */
  }
}

/* ---------------- Ảnh tóm tắt ---------------- */

/** Màu xếp loại cho ảnh (canvas không đọc được biến CSS một cách tin cậy). */
const CLS: Record<MoveClass, string> = {
  book: '#a38b6d',
  best: '#67ad72',
  good: '#8fb07a',
  inaccuracy: '#e3b53b',
  mistake: '#e2873a',
  blunder: '#dd5a4e',
  miss: '#c2675e',
};

/**
 * Ảnh 1200×630 (khổ ảnh xem trước của Facebook/Zalo): hai người chơi, kết quả,
 * độ chính xác, dải nhịp ván. Vẽ bằng canvas, xuất PNG.
 */
export async function shareImage(review: ReviewResult, meta: ShareMeta): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const font = (w: number, px: number) => `${w} ${px}px "IBM Plex Sans", system-ui, sans-serif`;

  g.fillStyle = '#302e2b';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#262421';
  g.fillRect(48, 48, W - 96, H - 96);

  // Tên trang
  g.fillStyle = '#56cdbb';
  g.font = font(700, 28);
  g.fillText('Lật Cờ', 88, 110);
  g.fillStyle = '#a7a5a3';
  g.font = font(500, 22);
  g.fillText('latbai.vn · chấm ván cờ miễn phí', 190, 110);

  // Hai người chơi và kết quả
  g.fillStyle = '#ffffff';
  g.font = font(700, 44);
  const vs = `${meta.white}  –  ${meta.black}`;
  g.fillText(fit(g, vs, W - 176), 88, 190);
  g.fillStyle = '#c9c8c6';
  g.font = font(500, 28);
  g.fillText(`${meta.result ? meta.result + ' · ' : ''}${meta.label}`, 88, 236);

  // Độ chính xác
  const row = (y: number, name: string, v: number, mine: boolean) => {
    g.fillStyle = mine ? '#ffffff' : '#c9c8c6';
    g.font = font(mine ? 700 : 500, 28);
    g.fillText(fit(g, name, 260), 88, y + 22);
    g.fillStyle = '#3c3a37';
    g.fillRect(380, y, 600, 20);
    g.fillStyle = mine ? '#00a38c' : '#a7a5a3';
    g.fillRect(380, y, Math.max(6, (600 * v) / 100), 20);
    g.fillStyle = '#ffffff';
    g.font = font(700, 30);
    g.fillText(`${v.toFixed(1)}%`, 1000, y + 22);
  };
  g.fillStyle = '#a7a5a3';
  g.font = font(600, 22);
  g.fillText('ĐỘ CHÍNH XÁC', 88, 300);
  row(326, meta.white, review.accuracy.w, meta.side === 'w');
  row(376, meta.black, review.accuracy.b, meta.side === 'b');

  // Nhịp ván: mỗi ô một nước (của người chia sẻ, hoặc cả ván nếu hai người một máy)
  const mine = review.moves.filter((m) => !meta.side || m.side === meta.side);
  g.fillStyle = '#a7a5a3';
  g.font = font(600, 22);
  g.fillText('NHỊP VÁN', 88, 470);
  const n = Math.max(1, mine.length);
  const slot = Math.min(28, (W - 176) / n);
  const tall: Partial<Record<MoveClass, number>> = { inaccuracy: 40, mistake: 52, blunder: 64, miss: 64 };
  mine.forEach((m, i) => {
    const h = tall[m.cls] ?? 28;
    g.fillStyle = CLS[m.cls];
    g.fillRect(88 + i * slot, 560 - h, Math.max(2, slot - 3), h);
  });

  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('Không tạo được ảnh'))), 'image/png'));
}

/** Cắt bớt chữ cho vừa bề rộng. */
function fit(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

/** Tải ảnh tóm tắt; điện thoại có nút chia sẻ của hệ điều hành thì mở luôn. */
export async function downloadShareImage(review: ReviewResult, meta: ShareMeta): Promise<void> {
  const blob = await shareImage(review, meta);
  const file = new File([blob], 'lat-co-van-co.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await nav.share({ files: [file], title: 'Ván cờ trên Lật Cờ', url: state?.url ?? undefined });
      return;
    } catch {
      /* người dùng huỷ: tải về như thường */
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
