-- Lưu đệm lời bình của Huấn luyện viên.
-- Dùng chung cho mọi người: cùng một thế cờ và cùng một nước thì lời bình giống nhau.

CREATE TABLE advisor_cache (
  -- Băm của gói dữ kiện + phiên bản prompt
  key        TEXT PRIMARY KEY,
  comment    TEXT NOT NULL,
  -- 'llm' hoặc 'template'
  source     TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX advisor_cache_time ON advisor_cache(created_at);
