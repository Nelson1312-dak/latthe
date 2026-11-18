-- Thống kê ẩn danh và ván chia sẻ.

-- Đếm số lượt theo ngày (giờ Việt Nam). CHỈ có con số: không IP, không cookie,
-- không định danh ai — biết "hôm nay 40 lượt vào, 25 ván" chứ không biết là ai.
CREATE TABLE daily_counts (
  day   TEXT NOT NULL,   -- YYYY-MM-DD
  event TEXT NOT NULL,
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event)
);

-- Ván được chia sẻ bằng link latbai.vn/van/<id>. Lưu cả kết quả chấm để người
-- mở link xem được ngay, không phải chấm lại. Không gắn với tài khoản nào.
CREATE TABLE shares (
  id         TEXT PRIMARY KEY,
  pgn        TEXT NOT NULL,
  review     TEXT NOT NULL,
  meta       TEXT NOT NULL,
  views      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
