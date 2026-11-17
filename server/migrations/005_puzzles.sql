-- Bài tập đã làm. Bảng `puzzles` và `puzzle_themes` do `npm run puzzles` tạo,
-- vì chúng là dữ liệu tải về chứ không phải dữ liệu của người dùng.

CREATE TABLE puzzle_attempts (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id  TEXT NOT NULL,
  correct    INTEGER NOT NULL,
  -- Độ khó của người học SAU lần làm này, để vẽ được đường tiến bộ
  rating_after INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX puzzle_attempts_user ON puzzle_attempts(user_id, created_at DESC);
