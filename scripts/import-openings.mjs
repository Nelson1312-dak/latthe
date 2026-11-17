// Tải bảng khai cuộc của Lichess rồi đổi sang dạng app dùng được.
// Chạy: npm run openings   (kết quả: public/data/openings.json, có commit)
//
// Nguồn: https://github.com/lichess-org/chess-openings (CC0). Mỗi dòng là
// eco + tên + chuỗi nước đi; mình đổi chuỗi nước thành thế cờ, vì lúc xem lại
// ván mình có thế cờ chứ không có chuỗi nước khớp y hệt.

import { mkdirSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';
const FILES = ['a', 'b', 'c', 'd', 'e'];
/** Chỉ giữ khai cuộc trong ngần này nước đầu: sâu hơn thì người mới không cần. */
const MAX_PLIES = 24;

/** Bỏ phần đếm nước khỏi FEN — hai thế cờ giống nhau vẫn là một khai cuộc. */
const positionKey = (fen) => fen.split(' ').slice(0, 4).join(' ');

const out = {};
let total = 0;
let skipped = 0;

for (const f of FILES) {
  const res = await fetch(`${BASE}/${f}.tsv`);
  if (!res.ok) throw new Error(`Không tải được ${f}.tsv: ${res.status}`);
  const text = await res.text();

  for (const line of text.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const [eco, name, pgn] = line.split('\t');
    if (!eco || !name || !pgn) continue;

    const board = new Chess();
    try {
      board.loadPgn(pgn);
    } catch {
      skipped++;
      continue;
    }
    if (board.history().length > MAX_PLIES) continue;

    const key = positionKey(board.fen());
    // Tên ngắn hơn thường là tên chính của biến thể, giữ tên đó
    if (!out[key] || name.length < out[key][1].length) out[key] = [eco, name];
    total++;
  }
}

mkdirSync('public/data', { recursive: true });
const json = JSON.stringify(out);
writeFileSync('public/data/openings.json', json);
console.log(`${Object.keys(out).length} thế cờ khai cuộc (từ ${total} dòng, bỏ ${skipped} dòng lỗi)`);
console.log(`public/data/openings.json — ${(json.length / 1024).toFixed(0)} KB`);
