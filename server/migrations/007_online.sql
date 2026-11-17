-- Giai đoạn 7: chơi online, ghép trận ngẫu nhiên theo trình độ.

-- Elo ván đấu tách khỏi Elo bài tập: giải bài tập và chơi cả ván là hai việc
-- khác nhau, gộp chung thì cả hai con số đều sai.
ALTER TABLE users ADD COLUMN game_rating INTEGER NOT NULL DEFAULT 1000;
-- Đã chơi bao nhiêu ván online, để tính hệ số K.
ALTER TABLE users ADD COLUMN game_count INTEGER NOT NULL DEFAULT 0;

-- Ván online lưu chung bảng `games` với ván đánh máy, thêm mode = 'online'.
-- Làm vậy thì màn Xem lại dùng lại được y nguyên, không phải viết hai đường.
ALTER TABLE games ADD COLUMN opponent_name TEXT;
ALTER TABLE games ADD COLUMN opponent_rating INTEGER;
ALTER TABLE games ADD COLUMN rating_before INTEGER;
ALTER TABLE games ADD COLUMN rating_after INTEGER;

CREATE INDEX games_user_mode ON games(user_id, mode, created_at DESC);
