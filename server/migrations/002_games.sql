-- Ván đã chơi. Giai đoạn 3 mới chỉ lưu ván với máy; ván qua mạng thêm sau.

CREATE TABLE games (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'bot' hoặc 'human' (hai người một máy)
  mode       TEXT NOT NULL,
  -- Cấp độ máy, NULL nếu không đấu với máy
  level      INTEGER,
  -- Bên người chơi cầm: 'w' hoặc 'b'
  player_side TEXT NOT NULL,
  pgn        TEXT NOT NULL,
  -- 'w', 'b' hoặc 'draw'
  winner     TEXT NOT NULL,
  reason     TEXT NOT NULL,
  move_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX games_user_time ON games(user_id, created_at DESC);
