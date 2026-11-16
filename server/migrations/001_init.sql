-- Giai đoạn 1: người dùng và phiên đăng nhập.
-- Các bảng của ván cờ, thẻ ôn tập, puzzle sẽ thêm ở migration sau.

CREATE TABLE users (
  id           INTEGER PRIMARY KEY,
  -- 'sub' của Google: định danh ổn định, không đổi kể cả khi người dùng đổi email.
  google_sub   TEXT UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url   TEXT,
  puzzle_rating INTEGER NOT NULL DEFAULT 1000,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

-- Mã phiên KHÔNG lưu dạng thô: chỉ lưu bản băm, để lộ database cũng không mạo danh được.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
