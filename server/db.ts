// Database: một file SQLite duy nhất (data/chess.db). Sao lưu = chép file.
// Dùng node:sqlite có sẵn trong Node 22, không cần cài thêm gì.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export type Db = DatabaseSync;

/**
 * node:sqlite trả về Record<string, SQLOutputValue>; mấy hàm dưới đây nói rõ hình dạng
 * mong đợi của một dòng. Chỗ nào dùng `one`/`all` là chỗ đang tin vào schema trong
 * migrations, nên schema đổi thì phải sửa kiểu theo.
 */
export function one<T>(db: Db, sql: string, ...params: SQLInputValue[]): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined;
}

export function all<T>(db: Db, sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

type SQLInputValue = string | number | bigint | null | Uint8Array;

export function openDb(file = process.env.CHESS_DB ?? 'data/chess.db'): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  // WAL cho phép đọc trong lúc đang ghi; foreign_keys để ON DELETE CASCADE có tác dụng.
  if (file !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL');
    // Mặc định là FULL: mỗi lần ghi là một lần ép đĩa, đo được ~60 ms một
    // request. Đi với WAL thì NORMAL vẫn an toàn khi chương trình chết giữa
    // chừng; chỉ mất vài lần ghi cuối nếu cả máy mất điện, chấp nhận được.
    db.exec('PRAGMA synchronous = NORMAL');
  }
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

/** Chạy những migration còn thiếu, theo thứ tự tên file. */
export function migrate(db: Db): string[] {
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set(all<{ name: string }>(db, 'SELECT name FROM migrations').map((r) => r.name));
  const dir = join(HERE, 'migrations');
  const applied: string[] = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(name)) continue;
    const sql = readFileSync(join(dir, name), 'utf8');
    // node:sqlite chưa có API giao dịch riêng, dùng câu lệnh SQL.
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${name} lỗi: ${(err as Error).message}`);
    }
    applied.push(name);
  }
  return applied;
}

export interface User {
  id: number;
  google_sub: string | null;
  display_name: string;
  avatar_url: string | null;
  puzzle_rating: number;
  /** Elo ván đấu với người, tách khỏi Elo bài tập. */
  game_rating: number;
  /** Đã chơi bao nhiêu ván online — để tính hệ số K. */
  game_count: number;
  /** Đã qua màn chào mừng chưa (0/1). */
  onboarded: number;
  /** Đã tự đặt tên gọi (0/1): có thì không lấy tên Google đè lên. */
  custom_name: number;
  /** Tuỳ chọn hiển thị dạng JSON. */
  prefs: string | null;
  /** Thôi dùng (xem migration 013). */
  is_admin?: number;
  /**
   * Băm của Gmail chủ trang (adminKey), chỉ có ở tài khoản đăng nhập bằng đúng Gmail
   * trong ADMIN_EMAILS; mọi tài khoản khác là null. So với ADMIN_EMAILS ở mỗi request.
   */
  admin_key?: string | null;
  created_at: string;
  last_seen_at: string;
}

/** Tìm theo 'sub' của Google, chưa có thì tạo. Đổi tên/ảnh bên Google thì cập nhật theo. */
/**
 * Làm sạch một tên do người dùng (hoặc tài khoản Google) đặt, trước khi lưu.
 *
 * Tên được đưa cho người khác xem (đối thủ online, người mở link ván chia sẻ), và
 * giao diện dựng HTML bằng chuỗi. Nên bỏ hẳn các ký tự có nghĩa trong HTML
 * (< > " & `) ngay từ cửa vào: kể cả có chỗ hiển thị quên thoát ký tự, tên cũng
 * không thể thành thẻ hay thuộc tính. Bỏ cả ký tự điều khiển, gộp khoảng trắng.
 */
export function cleanName(v: unknown, max = 40): string {
  return typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/[<>"&`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';
}

export function upsertGoogleUser(db: Db, sub: string, rawName: string, picture?: string): User {
  const now = new Date().toISOString();
  const name = cleanName(rawName) || 'Người chơi';
  // Ảnh đại diện chỉ nhận đường https (Google luôn gửi https)
  if (picture && !/^https:\/\/[^\s"'<>]+$/.test(picture)) picture = undefined;
  const found = one<User>(db, 'SELECT * FROM users WHERE google_sub = ?', sub);
  if (found) {
    // Tên Google chỉ cập nhật khi người chơi chưa tự đặt tên gọi riêng
    const tên = found.custom_name ? found.display_name : name;
    db.prepare('UPDATE users SET display_name = ?, avatar_url = ?, last_seen_at = ? WHERE id = ?').run(
      tên,
      picture ?? null,
      now,
      found.id,
    );
    return { ...found, display_name: tên, avatar_url: picture ?? null, last_seen_at: now };
  }
  const info = db
    .prepare(
      'INSERT INTO users (google_sub, display_name, avatar_url, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(sub, name, picture ?? null, now, now);
  return one<User>(db, 'SELECT * FROM users WHERE id = ?', Number(info.lastInsertRowid))!;
}

/** Tài khoản chỉ dùng khi phát triển và chạy test (không có google_sub). */
export function createLocalUser(db: Db, rawName: string): User {
  const now = new Date().toISOString();
  const name = cleanName(rawName) || 'Người chơi thử';
  const info = db
    .prepare('INSERT INTO users (google_sub, display_name, created_at, last_seen_at) VALUES (NULL, ?, ?, ?)')
    .run(name, now, now);
  return one<User>(db, 'SELECT * FROM users WHERE id = ?', Number(info.lastInsertRowid))!;
}
