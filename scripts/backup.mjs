// Sao lưu database cờ vua.
// Chạy: npm run backup
//
// LƯU Ý: chỉ đụng tới data/chess.db của app này. Thư mục db/ và db/backup.ps1
// trong cùng folder là của việc khác (dự án giao dịch), không liên quan.
//
// Chỉ lưu dữ liệu NGƯỜI DÙNG, bỏ kho bài tập ra ngoài. Kho puzzles +
// puzzle_themes chiếm 3,2 triệu dòng / ~250 MB và lần nào cũng y hệt nhau —
// lưu mỗi đêm một bản là mất hàng chục GB cho thứ tải lại được bằng
// `npm run puzzles`. Phần còn lại (ván cờ, thẻ ôn tập, tài khoản) mới là thứ
// mất là mất hẳn, và nó chỉ vài trăm KB.
//
// Dùng ATTACH + INSERT ... SELECT chứ không chép file: đang chạy WAL mà chép
// tay thì bản sao có thể thiếu phần chưa dồn từ -wal sang, mở ra là hỏng.

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const NGUỒN = process.env.CHESS_DB ?? 'data/chess.db';
const THƯ_MỤC = process.env.CHESS_BACKUP_DIR ?? 'data/backup';
/** Giữ bao nhiêu bản. Mỗi đêm một bản thì đây là hai tuần. */
const GIỮ = Number(process.env.CHESS_BACKUP_KEEP ?? 14);
/** Tải lại được bằng `npm run puzzles`, không cần lưu. */
const BỎ_QUA = new Set(['puzzles', 'puzzle_themes']);

const cỡ = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);
const nháy = (s) => s.replace(/'/g, "''");

if (!existsSync(NGUỒN)) {
  console.error(`Không thấy ${NGUỒN}. Chưa chạy app lần nào?`);
  process.exit(1);
}

mkdirSync(THƯ_MỤC, { recursive: true });
const giờ = new Date();
const pad = (n) => String(n).padStart(2, '0');
const dấu = `${giờ.getFullYear()}${pad(giờ.getMonth() + 1)}${pad(giờ.getDate())}-${pad(giờ.getHours())}${pad(giờ.getMinutes())}${pad(giờ.getSeconds())}`;
const đích = join(THƯ_MỤC, `chess-${dấu}.db`);
if (existsSync(đích)) {
  console.error(`${đích} đã có rồi.`);
  process.exit(1);
}

const out = new DatabaseSync(đích);
let bảng = [];
try {
  out.exec(`ATTACH '${nháy(resolve(NGUỒN))}' AS src`);
  // Lấy nguyên câu lệnh tạo bảng/chỉ mục từ chính database gốc, để bản sao
  // giống hệt chứ không phải mình chép tay schema rồi lệch lúc nào không biết.
  const đồ = out
    .prepare("SELECT type, name, tbl_name, sql FROM src.sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'")
    .all();

  for (const m of đồ) {
    if (m.type !== 'table' || BỎ_QUA.has(String(m.tbl_name))) continue;
    out.exec(String(m.sql));
    out.exec(`INSERT INTO "${m.tbl_name}" SELECT * FROM src."${m.tbl_name}"`);
    bảng.push(String(m.name));
  }
  // Chỉ mục tạo SAU khi đổ dữ liệu: nhanh hơn, và phải bỏ chỉ mục của bảng đã bỏ
  for (const m of đồ) {
    if (m.type !== 'index' || BỎ_QUA.has(String(m.tbl_name))) continue;
    out.exec(String(m.sql));
  }
  out.exec('DETACH src');
} finally {
  out.close();
}

// Kiểm lại: mở bản vừa tạo xem có đọc được không. Sao lưu mà không mở được thì
// tới lúc cần mới biết là đã muộn.
const thử = new DatabaseSync(đích, { readOnly: true });
let sốVán = 0;
let sốNgười = 0;
try {
  const ok = thử.prepare('PRAGMA integrity_check').get();
  const kq = String(Object.values(ok)[0]);
  if (kq !== 'ok') throw new Error(`integrity_check nói: ${kq}`);
  sốVán = Number(thử.prepare('SELECT count(*) c FROM games').get().c);
  sốNgười = Number(thử.prepare('SELECT count(*) c FROM users').get().c);
} finally {
  thử.close();
}

console.log(`Đã lưu ${đích} — ${cỡ(statSync(đích).size)}, ${sốVán} ván, ${sốNgười} người, ${bảng.length} bảng.`);
console.log('(Kho bài tập không nằm trong bản lưu; lấy lại bằng `npm run puzzles`.)');

const cũ = readdirSync(THƯ_MỤC)
  .filter((f) => f.startsWith('chess-') && f.endsWith('.db'))
  .sort()
  .reverse()
  .slice(GIỮ);
for (const f of cũ) {
  rmSync(join(THƯ_MỤC, f));
  console.log(`  bỏ bản cũ ${f}`);
}
