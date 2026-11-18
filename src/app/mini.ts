// Bàn cờ nổi: một cửa sổ nhỏ chỉ có bàn cờ, nằm trên mọi cửa sổ khác, để chơi
// với máy mà không phải mở cả trang web to.
//
// Chrome/Edge máy tính: Document Picture-in-Picture — cửa sổ nhỏ luôn nổi trên
// cùng, kéo đi đâu cũng được. Trong đó là chính app ở chế độ thu nhỏ (?mini=1),
// nạp qua một iframe, nên mọi thứ (engine, đăng nhập, lưu ván) chạy như thường.
// Trình duyệt khác: mở một cửa sổ popup nhỏ (không nổi trên cùng được).
//
// Chơi với người: ván nằm trên server, cửa sổ nổi tự mở luồng kết nối của nó
// (server cho một người nhiều luồng) — không chuyển gì qua localStorage.
//
// Ván đang dở chuyển qua lại giữa trang chính và bàn cờ nổi bằng localStorage:
// bàn cờ nổi ghi ván sau mỗi nước, đóng nó lại thì trang chính đọc và chơi tiếp.

export const IS_MINI = new URLSearchParams(location.search).has('mini');
/** Bàn cờ nổi mở ở chế độ nào: chơi với máy, hay với người (?che=online). */
export const MINI_MODE: 'machine' | 'online' = new URLSearchParams(location.search).get('che') === 'online' ? 'online' : 'machine';

const KEY = 'mini-van';

export function saveHandoff(state: unknown): void {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    /* chế độ riêng tư: ván không chuyển qua được, chơi ván mới */
  }
}

/** Lấy ván được chuyển sang (và xoá luôn, để không ai đọc lại lần hai). */
export function takeHandoff<T>(): T | null {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

interface DocumentPip {
  requestWindow(o: { width: number; height: number }): Promise<Window>;
  window: Window | null;
}
const docPip = (): DocumentPip | undefined =>
  (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;

/** Cửa sổ nổi luôn trên cùng (Chrome/Edge 116+). Không có thì dùng popup thường. */
export const floatsOnTop = (): boolean => docPip() !== undefined;

let cửaSổ: Window | null = null;
let canhPopup: ReturnType<typeof setInterval> | null = null;

export function miniOpen(): boolean {
  return cửaSổ !== null && !cửaSổ.closed;
}

/** Đóng bàn cờ nổi (nút "Đưa bàn cờ về đây"). onClose sẽ được gọi như khi người chơi tự đóng. */
export function closeMini(): void {
  cửaSổ?.close();
}

// Vừa khít bàn cờ 320px và hai thanh mỏng trên dưới
const RỘNG = 320;
const CAO = 392;

/**
 * Mở bàn cờ nổi. `onClose` chạy khi cửa sổ đóng (tự đóng, hay bấm Đưa về).
 * Phải gọi ngay trong lúc bấm chuột: trình duyệt chỉ cho mở cửa sổ khi đó.
 */
export async function openMini(onClose: () => void, mode: 'machine' | 'online' = 'machine'): Promise<boolean> {
  if (miniOpen()) {
    cửaSổ!.focus();
    return true;
  }
  const url = new URL(`/?mini=1${mode === 'online' ? '&che=online' : ''}#/choi`, location.href).href;
  const pip = docPip();
  if (pip) {
    let w: Window;
    try {
      w = await pip.requestWindow({ width: RỘNG, height: CAO });
    } catch {
      return false;
    }
    w.document.title = 'Lật Cờ';
    const st = w.document.createElement('style');
    st.textContent =
      'html,body{margin:0;height:100%;overflow:hidden;background:#262421}' +
      'iframe{display:block;width:100%;height:100%;border:0}';
    w.document.head.append(st);
    const f = w.document.createElement('iframe');
    f.title = 'Bàn cờ';
    f.src = url;
    w.document.body.append(f);
    cửaSổ = w;
    w.addEventListener('pagehide', () => {
      cửaSổ = null;
      onClose();
    });
    // Bấm vào cửa sổ là gõ phím được ngay (phím tắt, Esc để ẩn)
    f.addEventListener('load', () => f.contentWindow?.focus());
    return true;
  }
  const w = window.open(url, 'latco-mini', `popup,width=${RỘNG},height=${CAO + 40}`);
  if (!w) return false;
  cửaSổ = w;
  if (canhPopup) clearInterval(canhPopup);
  // Popup không báo cho trang mở nó khi bị đóng; nhìn thử mỗi giây
  canhPopup = setInterval(() => {
    if (w.closed) {
      clearInterval(canhPopup!);
      canhPopup = null;
      cửaSổ = null;
      onClose();
    }
  }, 1000);
  return true;
}

/* ---------------- Che bàn cờ: thu cửa sổ nổi thành một thanh ngang ---------------- */

/** Cửa sổ chứa bàn cờ nổi: cửa sổ PiP (trang nằm trong iframe của nó) hoặc chính popup. */
function hostWindow(): Window {
  try {
    return window.parent !== window ? window.parent : window;
  } catch {
    return window;
  }
}

/** Chiều cao thanh ngang khi che (khớp .mini-tab). */
const THANH_PX = 40;
let cỡCũ: { w: number; h: number } | null = null;

/**
 * Che: thu cửa sổ nổi chỉ còn một thanh ngang (giữ bề ngang), nhớ cỡ cũ. Hiện: trả
 * lại đúng cỡ cũ. Trình duyệt chỉ cho đổi cỡ ngay sau một cú bấm chuột (Esc không
 * tính), nên che bằng Esc thì cửa sổ giữ cỡ — vẫn chỉ hiện thanh ngang ở trên cùng.
 */
export function fitMiniWindow(covered: boolean): void {
  const w = hostWindow();
  try {
    if (covered) {
      cỡCũ ??= { w: w.outerWidth, h: w.outerHeight };
      w.resizeTo(w.outerWidth, w.outerHeight - w.innerHeight + THANH_PX);
    } else if (cỡCũ) {
      w.resizeTo(cỡCũ.w, cỡCũ.h);
      cỡCũ = null;
    }
  } catch {
    /* không được đổi cỡ: để nguyên */
  }
}
