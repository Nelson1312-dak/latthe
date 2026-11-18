-- Bài tập của ngày: lần giải ĐẦU TIÊN của mỗi người mỗi ngày (giờ Việt Nam).
CREATE TABLE daily_solves (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        TEXT NOT NULL,
  correct    INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);
