-- Hồ sơ người chơi.

-- Đã qua màn chào mừng (đặt tên gọi, chọn trình độ) chưa.
ALTER TABLE users ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0;
-- Người chơi đã tự đặt tên gọi. Có thì lần đăng nhập sau không lấy tên Google đè lên.
ALTER TABLE users ADD COLUMN custom_name INTEGER NOT NULL DEFAULT 0;
-- Tuỳ chọn hiển thị (màu bàn cờ, âm thanh...) dạng JSON, để theo người dùng sang máy khác.
ALTER TABLE users ADD COLUMN prefs TEXT;
