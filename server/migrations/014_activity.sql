-- Ngày nào ai hoạt động (để vẽ xu hướng người dùng theo ngày/tuần/tháng ở trang
-- Thống kê). Mỗi tài khoản tối đa một dòng mỗi ngày, ngày theo giờ Việt Nam.
-- Ghi khi tài khoản dùng app (server/auth.ts userForSession). Không có gì khác
-- ngoài mã tài khoản và ngày.
CREATE TABLE user_activity (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL, -- YYYY-MM-DD, giờ Việt Nam
  PRIMARY KEY (user_id, day)
);
CREATE INDEX user_activity_day ON user_activity(day);

-- Bù lịch sử từ những gì đã có: ngày tạo tài khoản, đăng nhập, chơi ván, giải bài
-- tập, bài tập của ngày, học xong bài, lần cuối thấy.
INSERT OR IGNORE INTO user_activity (user_id, day) SELECT id, date(created_at, '+7 hours') FROM users;
INSERT OR IGNORE INTO user_activity (user_id, day) SELECT id, date(last_seen_at, '+7 hours') FROM users WHERE last_seen_at IS NOT NULL;
INSERT OR IGNORE INTO user_activity (user_id, day) SELECT user_id, date(created_at, '+7 hours') FROM sessions;
INSERT OR IGNORE INTO user_activity (user_id, day) SELECT user_id, date(created_at, '+7 hours') FROM games;
INSERT OR IGNORE INTO user_activity (user_id, day) SELECT user_id, date(created_at, '+7 hours') FROM puzzle_attempts;
INSERT OR IGNORE INTO user_activity (user_id, day) SELECT user_id, date(created_at, '+7 hours') FROM daily_solves;
INSERT OR IGNORE INTO user_activity (user_id, day) SELECT user_id, date(done_at, '+7 hours') FROM lesson_progress;
