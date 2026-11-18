-- Tóm tắt lỗi của từng ván đã chấm, cho Huấn luyện viên (AI) đọc.
--
-- Tính từ kết quả chấm (bảng reviews) bằng code — shared/coach.ts gameInsight():
-- độ chính xác, số nước hỏng, độ chính xác theo giai đoạn, và các kiểu lỗi
-- (để hở quân, dính đòn đôi...) kèm nước nào. Một dòng mỗi ván, nên Huấn luyện
-- viên của từng người và bảng tổng hợp toàn trang đọc nhanh, không phải chấm lại.
--
-- Ván nào chưa được trình duyệt chấm thì máy chủ tự chấm (server/analyst.ts).

CREATE TABLE game_insights (
  game_id    INTEGER PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode       TEXT NOT NULL,
  side       TEXT NOT NULL,
  winner     TEXT NOT NULL,
  -- JSON của GameInsight (shared/coach.ts)
  data       TEXT NOT NULL,
  -- Giờ của VÁN (không phải giờ tính), để lấy "các ván gần nhất"
  played_at  TEXT NOT NULL
);

CREATE INDEX game_insights_user ON game_insights(user_id, played_at DESC);
CREATE INDEX game_insights_time ON game_insights(played_at);
