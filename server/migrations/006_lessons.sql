-- Bài học đã hoàn thành. Nội dung bài nằm trong mã nguồn (src/training/lessons.ts),
-- ở đây chỉ ghi ai đã học xong bài nào.

CREATE TABLE lesson_progress (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  done_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, lesson_id)
);
