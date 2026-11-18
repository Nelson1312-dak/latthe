// Đi trước (premove): chọn sẵn nước của mình trong lúc đối thủ còn đang nghĩ.
//
// Lúc chọn, chưa biết đối thủ sẽ đi gì, nên không thể hỏi luật cờ "nước này
// có hợp lệ không". Cách của Lichess (chessground) và cũng là cách ở đây: cho
// chọn mọi ô quân đó *về hình học* có thể tới được trên bàn trống, rồi tới
// lượt mình mới kiểm tra luật thật. Không hợp lệ thì bỏ, không đi.
//
// Ô đang có quân của chính mình VẪN được chọn: nước đi trước hay gặp nhất là
// ăn lại, tức là đi vào đúng ô mà quân mình sắp bị ăn mất.

import { FILES, piecesFromFen, squareOf, type Square } from './fen.ts';

const inside = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

function ray(f: number, r: number, df: number, dr: number): Square[] {
  const out: Square[] = [];
  for (let x = f + df, y = r + dr; inside(x, y); x += df, y += dr) out.push(squareOf(x, y));
  return out;
}

const KNIGHT = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];
const DIAG = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const LINE = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Các ô quân ở `from` có thể đi trước tới. Rỗng nếu ô đó không có quân. */
export function premoveDests(fen: string, from: Square): Square[] {
  const code = piecesFromFen(fen).get(from);
  if (!code) return [];
  const side = code[0] as 'w' | 'b';
  const kind = code[1];
  const f = FILES.indexOf(from[0] as (typeof FILES)[number]);
  const r = Number(from[1]) - 1;
  const out: Square[] = [];

  switch (kind) {
    case 'n':
      for (const [df, dr] of KNIGHT) if (inside(f + df, r + dr)) out.push(squareOf(f + df, r + dr));
      break;
    case 'b':
      for (const [df, dr] of DIAG) out.push(...ray(f, r, df, dr));
      break;
    case 'r':
      for (const [df, dr] of LINE) out.push(...ray(f, r, df, dr));
      break;
    case 'q':
      for (const [df, dr] of [...DIAG, ...LINE]) out.push(...ray(f, r, df, dr));
      break;
    case 'k': {
      for (const [df, dr] of [...DIAG, ...LINE]) if (inside(f + df, r + dr)) out.push(squareOf(f + df, r + dr));
      // Nhập thành: chỉ khi Vua còn ở ô gốc và FEN còn quyền nhập thành
      const rights = fen.split(' ')[2] ?? '-';
      const home = side === 'w' ? 0 : 7;
      if (f === 4 && r === home) {
        if (rights.includes(side === 'w' ? 'K' : 'k')) out.push(squareOf(6, home));
        if (rights.includes(side === 'w' ? 'Q' : 'q')) out.push(squareOf(2, home));
      }
      break;
    }
    case 'p': {
      const dir = side === 'w' ? 1 : -1;
      const start = side === 'w' ? 1 : 6;
      if (inside(f, r + dir)) out.push(squareOf(f, r + dir));
      if (r === start) out.push(squareOf(f, r + 2 * dir));
      // Ăn chéo: lúc đi trước chưa biết ô đó có quân không, nên cứ cho chọn
      for (const df of [-1, 1]) if (inside(f + df, r + dir)) out.push(squareOf(f + df, r + dir));
      break;
    }
  }
  return out;
}

/** Bên `side` có quân ở ô này không — chỉ quân của mình mới được đi trước. */
export function ownsSquare(fen: string, sq: Square, side: 'w' | 'b'): boolean {
  return piecesFromFen(fen).get(sq)?.[0] === side;
}

/**
 * Những ô được vẽ mũi tên tới, tính từ ô `from`.
 *
 * Mũi tên là để chỉ một nước đi, nên nó phải đi đúng đường quân đó đi được:
 * Tốt chỉ lên một/hai ô hoặc chéo một ô, Mã hình chữ L, Tượng chéo... Vẽ từ
 * Tốt h2 thẳng tới f7 là một nước không quân nào đi được — vô nghĩa.
 *
 * Ô trống thì không có quân nào để theo, nên cho mọi đường của Hậu và của Mã
 * (đủ để chỉ "quân nào đó sẽ tới đây").
 */
export function arrowDests(fen: string, from: Square): Square[] {
  if (piecesFromFen(fen).has(from)) return premoveDests(fen, from);
  const f = FILES.indexOf(from[0] as (typeof FILES)[number]);
  const r = Number(from[1]) - 1;
  const out: Square[] = [];
  for (const [df, dr] of [...DIAG, ...LINE]) out.push(...ray(f, r, df, dr));
  for (const [df, dr] of KNIGHT) if (inside(f + df, r + dr)) out.push(squareOf(f + df, r + dr));
  return out;
}
