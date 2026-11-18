// Trang công khai của một ván được chia sẻ: latbai.vn/van/<id>.
// Dùng lại màn Xem lại (bàn cờ, bảng chấm, từng nước), nạp từ server.

import type { ReviewResult } from '../../analysis/review.ts';
import { ping } from '../../app/ping.ts';
import { notice } from '../components/index.ts';
import { openReviewResult, review } from './review.ts';

let loadedId: string | null = null;
let loadingId: string | null = null;
let error: string | null = null;

/** Id ván trong đường dẫn /van/<id>, nếu đang ở trang đó. */
export function sharedIdFromPath(): string | null {
  return /^\/van\/([A-Za-z0-9_-]{6,12})\/?$/.exec(location.pathname)?.[1] ?? null;
}

export function sharedView(id: string): string {
  if (error && loadedId !== id) {
    return `<div class="screen screen-narrow"><div class="screen-head"><h1>Ván được chia sẻ</h1></div>
      ${notice(error, 'danger')}
      <p><a class="btn btn-primary" href="/#/choi">Tự chơi một ván</a></p></div>`;
  }
  if (loadedId !== id) {
    return `<div class="screen screen-narrow"><div class="screen-head"><h1>Ván được chia sẻ</h1></div>
      ${notice('Đang mở ván…', 'info', 'clock')}</div>`;
  }
  return review();
}

export function mountShared(id: string, rerender: () => void): void {
  if (loadedId === id || loadingId === id) return;
  loadingId = id;
  error = null;
  void fetch(`/api/share/${id}`)
    .then(async (r) => {
      const data = (await r.json().catch(() => ({}))) as {
        pgn?: string;
        review?: ReviewResult;
        meta?: { white: string; black: string; label: string; side: 'w' | 'b' | null };
        error?: string;
      };
      if (!r.ok || !data.pgn || !data.review || !data.meta) {
        throw new Error(r.status === 404 ? 'Không tìm thấy ván này — có thể link bị gõ sai.' : (data.error ?? `Lỗi ${r.status}`));
      }
      openReviewResult({
        pgn: data.pgn,
        playerSide: data.meta.side,
        label: `${data.meta.white} – ${data.meta.black} · ${data.meta.label}`,
        opponent: null,
        gameId: null,
        result: data.review,
        names: { w: data.meta.white, b: data.meta.black },
        shared: true,
      });
      loadedId = id;
      ping('share_open');
    })
    .catch((e: Error) => {
      error = e.message.startsWith('Failed') ? 'Máy chủ đang tạm nghỉ, thử lại sau ít phút.' : e.message;
    })
    .finally(() => {
      loadingId = null;
      rerender();
    });
}
