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

/** Bàn cờ không nhỏ hơn mức này dù cửa sổ thấp tới đâu (thà cuộn còn hơn không nhìn rõ quân). */
const MIN_BOARD = 220;

/**
 * Chiều cao còn lại cho bàn cờ để cả bàn cờ VÀ thanh người chơi phía dưới lọt
 * trong cửa sổ (khi trang ở đầu): cửa sổ trừ phần nằm trên bàn cờ (tiêu đề,
 * thanh người chơi phía trên), phần nằm dưới (thanh người chơi phía dưới), và
 * thanh điều hướng dính ở đáy trên điện thoại.
 *
 * Trước đây chỉ tính theo bề ngang: cửa sổ hẹp mà cao vừa phải (trình duyệt thu
 * nhỏ một nửa màn hình) là hàng 1 và thanh của mình bị thanh điều hướng che mất.
 */
function roomBelowTop(row: HTMLElement): number {
  const trên = row.getBoundingClientRect().top + window.scrollY;
  let dưới = 0;
  const gb = row.parentElement!;
  const gap = parseFloat(getComputedStyle(gb).rowGap) || 0;
  for (let el = row.nextElementSibling as HTMLElement | null; el; el = el.nextElementSibling as HTMLElement | null) {
    dưới += el.getBoundingClientRect().height + gap;
  }
  const nav = document.querySelector<HTMLElement>('.nav');
  if (nav && nav.offsetHeight && getComputedStyle(nav).position !== 'static') dưới += nav.offsetHeight;
  return window.innerHeight - trên - dưới - 8;
}

function snap(row: HTMLElement): void {
  const bar = row.querySelector<HTMLElement>(':scope > .evalbar-wrap');
  const gb = row.parentElement;
  const vừaCửaSổ = Boolean(gb?.classList.contains('game-board'));
  // Đo bề ngang thật (bỏ giới hạn lần trước đặt, không thì cửa sổ rộng ra cũng không to lại)
  const game = gb?.closest<HTMLElement>('.game') ?? null;
  if (vừaCửaSổ) {
    gb!.style.removeProperty('--board-fit');
    game?.style.removeProperty('--board-fit');
  }
  const barW = bar?.offsetWidth ?? 0;
  const ngang = row.clientWidth - barW;
  if (ngang <= 0) return;
  const avail = vừaCửaSổ ? Math.min(ngang, Math.max(MIN_BOARD, roomBelowTop(row))) : ngang;
  const px = snapSize(avail, window.devicePixelRatio || 1);
  const v = `${px}px`;
  if (row.style.getPropertyValue('--board-px') !== v) row.style.setProperty('--board-px', v);
  // Bàn cờ phải nhỏ lại vì cửa sổ thấp: thu cả cột (hai thanh người chơi) theo, cho thẳng mép
  if (vừaCửaSổ && px + barW < ngang + barW - 1) {
    gb!.style.setProperty('--board-fit', `${px + barW}px`);
    // Màn một cột: cột dưới bàn cờ (chọn đối thủ, sổ nước) cũng thẳng mép bàn cờ
    game?.style.setProperty('--board-fit', `${px + barW}px`);
  }
}

let ngheCửaSổ = false;

function đoHết(): void {
  for (const row of document.querySelectorAll<HTMLElement>('.board-row')) snap(row);
}

/** Gọi sau mỗi lần vẽ màn hình: căn mọi bàn cờ đang có trên trang. */
export function snapBoards(root: ParentNode = document): void {
  if (typeof ResizeObserver === 'undefined') return;
  ro ??= new ResizeObserver((entries) => {
    for (const e of entries) snap(e.target as HTMLElement);
  });
  // Cửa sổ thấp đi/cao lên không đổi bề ngang hàng bàn cờ, nên ResizeObserver
  // không báo: nghe thêm sự kiện đổi cỡ cửa sổ.
  // Không dùng sự kiện "resize" của cửa sổ: nó có lúc chạy TRƯỚC khi trình duyệt
  // tính lại bố cục, đo ra cỡ cũ (bàn cờ 744px trong cửa sổ 390px, tràn ngang).
  // ResizeObserver trên <html> chỉ báo SAU khi bố cục đã xong.
  if (!ngheCửaSổ) {
    ngheCửaSổ = true;
    let rộng = 0;
    let cao = 0;
    new ResizeObserver(() => {
      // Chỉ đo lại khi cửa sổ đổi cỡ, không phải mỗi lần nội dung trang dài ra
      if (window.innerWidth === rộng && window.innerHeight === cao) return;
      rộng = window.innerWidth;
      cao = window.innerHeight;
      đoHết();
    }).observe(document.documentElement);
    window.addEventListener('resize', () => requestAnimationFrame(đoHết));
  }
  // Màn hình vẽ lại là thay cả cây DOM, nên bỏ theo dõi các hàng cũ đã mất
  ro.disconnect();
  for (const row of root.querySelectorAll<HTMLElement>('.board-row')) {
    snap(row);
    ro.observe(row);
  }
}
