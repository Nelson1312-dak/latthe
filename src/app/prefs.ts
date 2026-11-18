// Tuỳ chọn hiển thị của người chơi: màu bàn cờ, toạ độ, chấm nước đi, tự phong Hậu.
// Lưu trong trình duyệt (localStorage), không gửi lên server.
//
// Phần hiển thị (màu bàn, toạ độ, chấm) đặt thành thuộc tính trên <html> để CSS
// tự lo — không phải truyền tuỳ chọn qua từng màn hình có bàn cờ.

export type BoardTheme = 'green' | 'wood' | 'blue' | 'stone';

export interface Prefs {
  board: BoardTheme;
  /** Chữ a–h, 1–8 ở mép bàn cờ. */
  coords: boolean;
  /** Chấm các ô đi được khi cầm quân. */
  legal: boolean;
  /** Tốt đi tới hàng cuối thì thành Hậu luôn, không hỏi. */
  autoQueen: boolean;
  /** Trợ lý khi chơi với máy: đi hỏng thì máy dừng lại, chỉ nước tốt hơn trên bàn cờ. */
  assist: boolean;
}

export const BOARD_THEMES: { id: BoardTheme; name: string; light: string; dark: string }[] = [
  { id: 'green', name: 'Xanh lá', light: '#ebecd0', dark: '#739552' },
  { id: 'wood', name: 'Gỗ', light: '#ead8b6', dark: '#b08a62' },
  { id: 'blue', name: 'Xanh dương', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'stone', name: 'Đá', light: '#dadfe3', dark: '#8697a6' },
];

// Mặc định giống chess.com: bàn xanh lá, có toạ độ, có chấm, hỏi khi phong cấp.
const DEFAULT: Prefs = { board: 'green', coords: true, legal: true, autoQueen: false, assist: true };

let current: Prefs = load();

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem('prefs') ?? '{}') as Partial<Prefs>;
    const board = BOARD_THEMES.some((t) => t.id === raw.board) ? raw.board! : DEFAULT.board;
    return {
      board,
      coords: typeof raw.coords === 'boolean' ? raw.coords : DEFAULT.coords,
      legal: typeof raw.legal === 'boolean' ? raw.legal : DEFAULT.legal,
      autoQueen: typeof raw.autoQueen === 'boolean' ? raw.autoQueen : DEFAULT.autoQueen,
      assist: typeof raw.assist === 'boolean' ? raw.assist : DEFAULT.assist,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function prefs(): Readonly<Prefs> {
  return current;
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem('prefs', JSON.stringify(current));
  } catch {
    /* chế độ riêng tư: chỉ nhớ trong phiên này */
  }
  applyPrefs();
}

/** Đặt tuỳ chọn hiển thị lên <html> để CSS dùng. */
export function applyPrefs(): void {
  const d = document.documentElement.dataset;
  d.board = current.board;
  d.coords = current.coords ? 'on' : 'off';
  d.legal = current.legal ? 'on' : 'off';
}
