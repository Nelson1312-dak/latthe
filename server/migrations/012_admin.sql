-- Chủ trang theo địa chỉ Gmail (ADMIN_EMAILS trong .env.chess), thay vì phải biết
-- trước mã tài khoản. Email KHÔNG được lưu: lúc đăng nhập, server so email Google
-- gửi kèm với danh sách, rồi chỉ ghi lại kết quả (có/không) ở cột này.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
