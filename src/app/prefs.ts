// Tuỳ chọn hiển thị của người chơi: màu bàn cờ, toạ độ, chấm nước đi, tự phong Hậu.
// Lưu trong trình duyệt (localStorage), không gửi lên server.
//
// Phần hiển thị (màu bàn, toạ độ, chấm) đặt thành thuộc tính trên <html> để CSS
// tự lo — không phải truyền tuỳ chọn qua từng màn hình có bàn cờ.

import { loadPieces } from '../board/sprite.ts';

export type BoardTheme =
  | 'green'
  | 'wood'
  | 'blue'
  | 'stone'
  | 'walnut'
  | 'olive'
  | 'sand'
  | 'teal'
  | 'purple'
  | 'coral'
  | 'tex-wood'
  | 'tex-rosewood'
  | 'tex-marble'
  | 'tex-slate'
  | 'tex-book';

/**
 * Bộ quân (public/pieces/sets, dựng bằng scripts/build-pieces.mjs). Bộ nào cũng do
 * hoạ sĩ vẽ, giấy phép mở — ghi công ở chân trang và trong LICENSES.txt.
 */
export const PIECE_SETS = [
  { id: 'merida', name: 'Merida', author: 'Armando Hernandez Marroquin', license: 'GPLv2+' },
  { id: 'celtic', name: 'Celtic', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'papercut', name: 'Papercut', author: 'Nikolay Anzarov', license: 'CC BY 4.0' },
  { id: 'fantasy', name: 'Fantasy', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'spatial', name: 'Spatial', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'chessnut', name: 'Chessnut', author: 'Alexis Luengas', license: 'Apache 2.0' },
  { id: 'mpchess', name: 'MPChess', author: 'Maxime Chupin', license: 'GPLv3+' },
  { id: 'cburnett', name: 'Cburnett', author: 'Colin M.L. Burnett', license: 'CC BY-SA 3.0' },
] as const;
export type PieceSet = (typeof PIECE_SETS)[number]['id'];

export interface Prefs {
  board: BoardTheme;
  /** Bộ quân cờ. */
  pieces: PieceSet;
  /** Chữ a–h, 1–8 ở mép bàn cờ. */
  coords: boolean;
  /** Chấm các ô đi được khi cầm quân. */
  legal: boolean;
  /** Tốt đi tới hàng cuối thì thành Hậu luôn, không hỏi. */
  autoQueen: boolean;
  /** Trợ lý khi chơi với máy: đi hỏng thì máy dừng lại, chỉ nước tốt hơn trên bàn cờ. */
  assist: boolean;
}

/**
 * Chủ đề bàn cờ. `light`/`dark` là màu đặc (ô mẫu, toạ độ); bàn có vân (`tex`) thì ô
 * cờ tô bằng ảnh vân sinh từ scripts/build-boards.mjs: một tấm cho cả bàn, nên vân
 * chạy liền qua các ô như bàn thật.
 */
export const BOARD_THEMES: { id: BoardTheme; name: string; light: string; dark: string; tex?: [string, string] }[] = [
  { id: 'tex-wood', name: 'Gỗ thật', light: '#e3c796', dark: '#7b4f2f', tex: ['maple', 'walnut'] },
  { id: 'tex-rosewood', name: 'Hồng mộc', light: '#ead6ad', dark: '#6b3121', tex: ['boxwood', 'rosewood'] },
  { id: 'tex-marble', name: 'Cẩm thạch', light: '#e9e7e1', dark: '#4f7564', tex: ['marble-white', 'marble-green'] },
  { id: 'tex-slate', name: 'Đá xám', light: '#e9e7e1', dark: '#6e6f73', tex: ['marble-white', 'marble-grey'] },
  { id: 'tex-book', name: 'Sách cờ', light: '#f1ead9', dark: '#b7ae9c', tex: ['paper', 'paper-hatch'] },
  { id: 'green', name: 'Xanh lá', light: '#ebecd0', dark: '#739552' },
  { id: 'wood', name: 'Gỗ sáng', light: '#ead8b6', dark: '#b08a62' },
  { id: 'walnut', name: 'Óc chó', light: '#e6cfa8', dark: '#8e6141' },
  { id: 'blue', name: 'Xanh dương', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'stone', name: 'Đá', light: '#dadfe3', dark: '#8697a6' },
  { id: 'olive', name: 'Ô liu', light: '#e6e3c8', dark: '#878752' },
  { id: 'sand', name: 'Cát', light: '#f1e4c6', dark: '#c49d6e' },
  { id: 'teal', name: 'Ngọc', light: '#dce8e3', dark: '#5a8a7f' },
  { id: 'purple', name: 'Tím', light: '#e5e0ec', dark: '#81719f' },
  { id: 'coral', name: 'San hô', light: '#f0dfd2', dark: '#b97a63' },
];

// Mặc định giống chess.com: bàn xanh lá, có toạ độ, có chấm, hỏi khi phong cấp.
const DEFAULT: Prefs = { board: 'green', pieces: 'merida', coords: true, legal: true, autoQueen: false, assist: true };

let current: Prefs = load();

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem('prefs') ?? '{}') as Partial<Prefs>;
    const board = BOARD_THEMES.some((t) => t.id === raw.board) ? raw.board! : DEFAULT.board;
    return {
      board,
      pieces: PIECE_SETS.some((s) => s.id === raw.pieces) ? raw.pieces! : DEFAULT.pieces,
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
  applyBoardTexture(current.board);
  void loadPieces(current.pieces).catch((err) => console.error(err));
  d.coords = current.coords ? 'on' : 'off';
  d.legal = current.legal ? 'on' : 'off';
}

/**
 * Bàn có vân: hai <pattern> (ô sáng, ô tối) phủ cả bàn 400x400 (hệ toạ độ của
 * src/board/Board.ts), đặt vào trang để ô cờ tô `fill: url(#tex-light)`. Chỉ nạp
 * ảnh của chủ đề đang dùng; bàn màu đặc thì gỡ đi.
 */
function applyBoardTexture(id: BoardTheme): void {
  const t = BOARD_THEMES.find((x) => x.id === id)?.tex;
  let host = document.getElementById('board-tex');
  if (!t) {
    host?.remove();
    return;
  }
  const key = t.join('/');
  if (host?.dataset.tex === key) return;
  if (!host) {
    host = document.createElement('div');
    host.id = 'board-tex';
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.prepend(host);
  }
  host.dataset.tex = key;
  const pat = (name: string, img: string) =>
    `<pattern id="${name}" patternUnits="userSpaceOnUse" width="400" height="400">` +
    `<image href="/board/${img}.webp" width="400" height="400" preserveAspectRatio="none"/></pattern>`;
  host.innerHTML = `<svg width="0" height="0"><defs>${pat('tex-light', t[0])}${pat('tex-dark', t[1])}</defs></svg>`;
}
