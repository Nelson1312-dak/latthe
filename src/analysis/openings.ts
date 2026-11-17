// Tra tên khai cuộc theo thế cờ.
//
// Bảng 449 KB nên chỉ tải khi thật sự cần (màn xem lại), không nằm trong
// gói chính của app.

export interface Opening {
  eco: string;
  name: string;
}

let table: Record<string, [string, string]> | null = null;
let loading: Promise<void> | null = null;

/** Bỏ phần đếm nước khỏi FEN — hai thế cờ giống nhau vẫn là một khai cuộc. */
export const positionKey = (fen: string): string => fen.split(' ').slice(0, 4).join(' ');

export function loadOpenings(url = '/data/openings.json'): Promise<void> {
  loading ??= fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Không tải được khai cuộc: ${r.status}`))))
    .then((data: Record<string, [string, string]>) => {
      table = data;
    })
    .catch((err) => {
      // Không tra được tên khai cuộc thì vẫn xem lại ván bình thường
      console.warn(err);
      table = {};
    });
  return loading;
}

/** Thế cờ này có trong sách khai cuộc không. Phải gọi loadOpenings() trước. */
export function openingAt(fen: string): Opening | null {
  const hit = table?.[positionKey(fen)];
  return hit ? { eco: hit[0], name: hit[1] } : null;
}

/** Tên khai cuộc của cả ván: lấy thế cờ sâu nhất còn nằm trong sách. */
export function openingOfGame(fens: string[]): { opening: Opening; ply: number } | null {
  let found: { opening: Opening; ply: number } | null = null;
  for (let i = 0; i < fens.length; i++) {
    const o = openingAt(fens[i]);
    if (o) found = { opening: o, ply: i + 1 };
  }
  return found;
}
