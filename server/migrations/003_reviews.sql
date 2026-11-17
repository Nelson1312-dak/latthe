-- Kết quả chấm ván, và thẻ ôn tập sinh ra từ những nước sai.

CREATE TABLE reviews (
  game_id    INTEGER PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  -- Toàn bộ kết quả chấm từng nước, dạng JSON
  data       TEXT NOT NULL,
  accuracy_w REAL NOT NULL,
  accuracy_b REAL NOT NULL,
  opening    TEXT,
  created_at TEXT NOT NULL
);

-- Mỗi nước sai của người chơi thành một thẻ ôn tập.
-- Hộp Leitner: 1..5, càng cao thì càng lâu gặp lại.
CREATE TABLE cards (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id    INTEGER REFERENCES games(id) ON DELETE SET NULL,
  -- Thế cờ trước nước sai: người học phải tìm nước tốt hơn
  fen        TEXT NOT NULL,
  -- Nước người chơi đã đi (sai) và nước engine khuyên
  played_uci TEXT NOT NULL,
  best_uci   TEXT NOT NULL,
  best_san   TEXT NOT NULL,
  cls        TEXT NOT NULL,
  box        INTEGER NOT NULL DEFAULT 1,
  due_at     TEXT NOT NULL,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  -- Cùng một thế cờ không tạo hai thẻ cho cùng một người
  UNIQUE (user_id, fen)
);

CREATE INDEX cards_due ON cards(user_id, due_at);
