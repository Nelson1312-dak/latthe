// Đọc phần bố trí quân của FEN. Tách riêng để vẽ bàn cờ mà không cần cả chess.js.

export type PieceCode = 'wk' | 'wq' | 'wr' | 'wb' | 'wn' | 'wp' | 'bk' | 'bq' | 'br' | 'bb' | 'bn' | 'bp';
export type Square = string; // 'a1'..'h8'

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

export function squareOf(fileIndex: number, rankIndex: number): Square {
  return FILES[fileIndex] + String(rankIndex + 1);
}

/** Vị trí quân theo ô, đọc từ FEN. Ném lỗi nếu FEN sai dạng. */
export function piecesFromFen(fen: string): Map<Square, PieceCode> {
  const rows = fen.trim().split(/\s+/)[0].split('/');
  if (rows.length !== 8) throw new Error(`FEN phải có 8 hàng, có ${rows.length}`);
  const out = new Map<Square, PieceCode>();
  rows.forEach((row, i) => {
    const rank = 7 - i; // hàng đầu của FEN là hàng 8
    let file = 0;
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        file += Number(ch);
        continue;
      }
      const lower = ch.toLowerCase();
      if (!'kqrbnp'.includes(lower)) throw new Error(`Ký tự quân lạ: ${ch}`);
      if (file > 7) throw new Error(`Hàng ${8 - i} quá dài`);
      out.set(squareOf(file, rank), ((ch === lower ? 'b' : 'w') + lower) as PieceCode);
      file++;
    }
    if (file !== 8) throw new Error(`Hàng ${8 - i} có ${file} ô, phải là 8`);
  });
  return out;
}

/** Chênh lệch vật chất theo góc nhìn Trắng, và danh sách quân đã ăn của mỗi bên. */
const VALUE: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1, k: 0 };
const FULL: Record<string, number> = { q: 1, r: 2, b: 2, n: 2, p: 8, k: 1 };

export function material(fen: string): { diff: number; whiteTook: PieceCode[]; blackTook: PieceCode[] } {
  const pieces = [...piecesFromFen(fen).values()];
  const count = (c: 'w' | 'b', t: string) => pieces.filter((p) => p === c + t).length;
  let diff = 0;
  const whiteTook: PieceCode[] = []; // quân Đen đã mất
  const blackTook: PieceCode[] = [];
  for (const t of ['q', 'r', 'b', 'n', 'p']) {
    const w = count('w', t);
    const b = count('b', t);
    diff += (w - b) * VALUE[t];
    for (let i = 0; i < FULL[t] - b; i++) whiteTook.push(('b' + t) as PieceCode);
    for (let i = 0; i < FULL[t] - w; i++) blackTook.push(('w' + t) as PieceCode);
  }
  return { diff, whiteTook, blackTook };
}
