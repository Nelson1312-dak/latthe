// Tải kho bài tập của Lichess rồi nạp vào SQLite.
// Chạy: npm run puzzles
//
// Nguồn: https://database.lichess.org/#puzzles (CC0). File nén 310 MB, giải ra
// khoảng 1 GB. Chỉ nạp bài hợp với người mới và trung cấp, nên database cuối
// cùng nhỏ hơn nhiều.
//
// Lưu ý về dữ liệu: cột FEN là thế cờ TRƯỚC nước của đối phương, và nước đầu
// trong cột Moves là nước của đối phương. Người học bắt đầu giải từ nước thứ hai.

import { closeSync, createWriteStream, existsSync, mkdirSync, openSync, readSync, renameSync, rmSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';

const URL_ZST = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const RAW = 'assets-src/lichess_db_puzzle.csv.zst';
const DB_FILE = process.env.CHESS_DB ?? 'data/chess.db';

/** Lọc: đúng đối tượng người mới + trung cấp, và bài đã được nhiều người chơi. */
const MIN_RATING = Number(process.env.PUZZLE_MIN ?? 600);
const MAX_RATING = Number(process.env.PUZZLE_MAX ?? 1800);
const MIN_PLAYS = Number(process.env.PUZZLE_PLAYS ?? 1000);
const MIN_POPULARITY = Number(process.env.PUZZLE_POP ?? 80);
/** Chủ đề mình dạy; bài không thuộc chủ đề nào trong đây thì bỏ. */
const THEMES = new Set([
  'fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'doubleCheck',
  'mateIn1', 'mateIn2', 'mateIn3', 'backRankMate', 'smotheredMate',
  'deflection', 'attraction', 'clearance', 'interference', 'trappedPiece',
  'defensiveMove', 'capturingDefender', 'advancedPawn', 'promotion',
  'endgame', 'rookEndgame', 'pawnEndgame', 'queenEndgame', 'bishopEndgame', 'knightEndgame',
]);

const human = (n) => (n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`);

/** Độ dài thật của file trên máy chủ, để biết file đã tải có đủ chưa. */
async function remoteSize() {
  try {
    const res = await fetch(URL_ZST, { method: 'HEAD' });
    return res.ok ? Number(res.headers.get('content-length') ?? 0) : 0;
  } catch {
    return 0;
  }
}

/**
 * Tải file 310 MB, tải tiếp được nếu đứt giữa chừng.
 *
 * Ghi vào RAW.part rồi mới đổi tên, nên file dở dang không bao giờ bị nhầm là
 * đã xong — lần trước mạng đứt ở 162 MB và script coi như tải đủ. Đứt lần nữa
 * thì xin tiếp từ chỗ dở bằng HTTP Range chứ không tải lại từ đầu.
 */
async function download() {
  mkdirSync('assets-src', { recursive: true });
  const full = await remoteSize();

  if (existsSync(RAW)) {
    const có = statSync(RAW).size;
    if (!full || có === full) {
      console.log(`Đã có ${RAW} (${human(có)}), không tải lại.`);
      return;
    }
    // File cũ thiếu: chuyển thành phần dở dang rồi tải tiếp.
    // Nếu đã có sẵn một phần dở dang khác thì giữ cái dài hơn, đừng đè mất.
    console.log(`${RAW} chỉ có ${human(có)} / ${human(full)} — tải tiếp.`);
    const cũ = existsSync(`${RAW}.part`) ? statSync(`${RAW}.part`).size : 0;
    if (có > cũ) renameSync(RAW, `${RAW}.part`);
    else {
      console.log(`  (đã có phần dở dang ${human(cũ)} dài hơn, dùng cái đó)`);
      rmSync(RAW);
    }
  }

  const part = `${RAW}.part`;
  for (let lần = 1; lần <= 5; lần++) {
    const đãCó = existsSync(part) ? statSync(part).size : 0;
    console.log(đãCó ? `Tải tiếp từ ${human(đãCó)} …` : `Tải ${URL_ZST} …`);
    try {
      const res = await fetch(URL_ZST, đãCó ? { headers: { Range: `bytes=${đãCó}-` } } : undefined);
      if (!res.ok && res.status !== 206) throw new Error(`máy chủ trả về ${res.status}`);
      // Máy chủ không chịu tải tiếp thì bỏ phần cũ, bắt đầu lại
      const nốiTiếp = res.status === 206;
      if (đãCó && !nốiTiếp) rmSync(part);

      const total = Number(res.headers.get('content-length') ?? 0) + (nốiTiếp ? đãCó : 0);
      let done = nốiTiếp ? đãCó : 0;
      let lastPrint = 0;
      const body = Readable.fromWeb(res.body);
      body.on('data', (c) => {
        done += c.length;
        if (Date.now() - lastPrint > 2000) {
          lastPrint = Date.now();
          process.stdout.write(
            `\r  ${human(done)}${total ? ` / ${human(total)} (${Math.round((done / total) * 100)}%)` : ''}`,
          );
        }
      });
      await pipeline(body, createWriteStream(part, { flags: nốiTiếp ? 'a' : 'w' }));
      process.stdout.write('\r');

      const đượcBaoNhiêu = statSync(part).size;
      if (total && đượcBaoNhiêu !== total) throw new Error(`tải thiếu: ${human(đượcBaoNhiêu)} / ${human(total)}`);
      renameSync(part, RAW);
      console.log(`Xong: ${human(statSync(RAW).size)}`);
      return;
    } catch (err) {
      console.log(`\n  Lần ${lần} hỏng: ${err.message}`);
      if (lần === 5) throw new Error('Tải thất bại sau 5 lần thử');
      await new Promise((r) => setTimeout(r, 3000 * lần));
    }
  }
}

function openDb() {
  mkdirSync('data', { recursive: true });
  const db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL');
  // Nạp một triệu dòng: tắt fsync mỗi lần ghi, nếu không sẽ mất hàng giờ
  db.exec('PRAGMA synchronous = OFF');
  db.exec(`CREATE TABLE IF NOT EXISTS puzzles (
    id TEXT PRIMARY KEY, fen TEXT NOT NULL, moves TEXT NOT NULL,
    rating INTEGER NOT NULL, themes TEXT NOT NULL, popularity INTEGER NOT NULL
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS puzzles_rating ON puzzles(rating)');
  return db;
}

/**
 * Vị trí byte của khung dữ liệu zstd đầu tiên.
 *
 * File của Lichess mở đầu bằng một "khung bỏ qua" (skippable frame) chứa dữ
 * liệu phụ. Bộ giải nén zstd của Node không tự bỏ qua khung này mà báo lỗi
 * ZSTD_error_prefix_unknown, nên phải tự nhảy qua.
 */
function firstDataOffset(file) {
  const fd = openSync(file, 'r');
  const head = Buffer.alloc(8);
  let offset = 0;
  try {
    for (;;) {
      if (readSync(fd, head, 0, 8, offset) < 8) return 0;
      // Khung bỏ qua: 50..5F 2A 4D 18, rồi 4 byte độ dài
      const isSkippable = head[0] >= 0x50 && head[0] <= 0x5f && head[1] === 0x2a && head[2] === 0x4d && head[3] === 0x18;
      if (!isSkippable) return offset;
      offset += 8 + head.readUInt32LE(4);
    }
  } finally {
    closeSync(fd);
  }
}

async function load(db) {
  const insert = db.prepare(
    'INSERT OR REPLACE INTO puzzles (id, fen, moves, rating, themes, popularity) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const rl = createInterface({
    input: createReadStream(RAW, { start: firstDataOffset(RAW) }).pipe(createZstdDecompress()),
    crlfDelay: Infinity,
  });

  let read = 0;
  let kept = 0;
  let first = true;
  db.exec('BEGIN');
  for await (const line of rl) {
    if (first) {
      first = false;
      if (line.startsWith('PuzzleId')) continue;
    }
    read++;
    // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
    const c = line.split(',');
    if (c.length < 8) continue;
    const rating = Number(c[3]);
    const popularity = Number(c[5]);
    const plays = Number(c[6]);
    if (rating < MIN_RATING || rating > MAX_RATING) continue;
    if (popularity < MIN_POPULARITY || plays < MIN_PLAYS) continue;
    const themes = c[7].split(' ').filter((t) => THEMES.has(t));
    if (!themes.length) continue;

    insert.run(c[0], c[1], c[2], rating, themes.join(' '), popularity);
    kept++;
    if (kept % 50_000 === 0) {
      db.exec('COMMIT');
      db.exec('BEGIN');
      process.stdout.write(`\r  đọc ${read.toLocaleString('vi')} dòng, giữ ${kept.toLocaleString('vi')}`);
    }
  }
  db.exec('COMMIT');
  process.stdout.write('\r');
  return { read, kept };
}

await download();
const db = openDb();
console.log('Nạp vào database …');
const t0 = Date.now();
const { read, kept } = await load(db);

// Bảng chủ đề riêng để lấy bài theo chủ đề mà không phải quét cả kho
db.exec('DROP TABLE IF EXISTS puzzle_themes');
db.exec('CREATE TABLE puzzle_themes (theme TEXT NOT NULL, puzzle_id TEXT NOT NULL, rating INTEGER NOT NULL)');
db.exec('BEGIN');
const addTheme = db.prepare('INSERT INTO puzzle_themes (theme, puzzle_id, rating) VALUES (?, ?, ?)');
for (const row of db.prepare('SELECT id, themes, rating FROM puzzles').all()) {
  for (const t of String(row.themes).split(' ')) addTheme.run(t, row.id, row.rating);
}
db.exec('COMMIT');
db.exec('CREATE INDEX puzzle_themes_lookup ON puzzle_themes(theme, rating)');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('ANALYZE');

const giay = ((Date.now() - t0) / 1000).toFixed(0);
const theo = db.prepare('SELECT theme, count(*) c FROM puzzle_themes GROUP BY theme ORDER BY c DESC LIMIT 8').all();
console.log(`Đọc ${read.toLocaleString('vi')} dòng, giữ ${kept.toLocaleString('vi')} bài trong ${giay} giây.`);
console.log(`Database: ${human(statSync(DB_FILE).size)}`);
console.log('Chủ đề nhiều bài nhất:', theo.map((t) => `${t.theme} ${t.c.toLocaleString('vi')}`).join(', '));
db.close();
