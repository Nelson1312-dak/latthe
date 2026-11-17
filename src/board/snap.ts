// Bàn cờ nét căng: mỗi ô phải rộng đúng một số nguyên điểm ảnh THẬT của màn hình.
//
// Bàn cờ co giãn theo cửa sổ, nên bề ngang thường là số lẻ kiểu 658px — chia 8
// ra 82,25px một ô. Mép ô rơi vào giữa hai điểm ảnh, trình duyệt phải hoà màu
// hai bên: đường kẻ giữa các ô nhoè, quân cờ trông mờ mờ. Màn hình Windows phóng
// 125% còn tệ hơn: 82px CSS = 102,5 điểm ảnh thật.
//
// CSS không biết tỉ lệ điểm ảnh của màn hình, nên đo bằng JS: lấy chỗ trống,
// đổi ra điểm ảnh thật, làm tròn xuống bội số của 8, rồi đổi ngược lại.

let ro: ResizeObserver | null = null;

/** Cỡ bàn cờ (px CSS) lớn nhất không quá `avail` mà mỗi ô là số nguyên điểm ảnh thật. */
export function snapSize(avail: number, dpr: number): number {
  const r = dpr > 0 ? dpr : 1;
  const device = Math.floor((avail * r) / 8 + 1e-6) * 8;
  return Math.max(0, device / r);
}

function snap(row: HTMLElement): void {
  const bar = row.querySelector<HTMLElement>(':scope > .evalbar-wrap');
  const avail = row.clientWidth - (bar?.offsetWidth ?? 0);
  if (avail <= 0) return;
  const px = snapSize(avail, window.devicePixelRatio || 1);
  const v = `${px}px`;
  if (row.style.getPropertyValue('--board-px') !== v) row.style.setProperty('--board-px', v);
}

/** Gọi sau mỗi lần vẽ màn hình: căn mọi bàn cờ đang có trên trang. */
export function snapBoards(root: ParentNode = document): void {
  if (typeof ResizeObserver === 'undefined') return;
  ro ??= new ResizeObserver((entries) => {
    for (const e of entries) snap(e.target as HTMLElement);
  });
  // Màn hình vẽ lại là thay cả cây DOM, nên bỏ theo dõi các hàng cũ đã mất
  ro.disconnect();
  for (const row of root.querySelectorAll<HTMLElement>('.board-row')) {
    snap(row);
    ro.observe(row);
  }
}
