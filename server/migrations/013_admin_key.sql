-- Siết quyền chủ trang: chỉ theo Gmail trong ADMIN_EMAILS, và kiểm tra lại ở MỖI
-- request chứ không chỉ lúc đăng nhập.
--
-- admin_key = băm SHA-256 của "admin:" + email, chỉ ghi cho tài khoản đăng nhập bằng
-- đúng Gmail có trong ADMIN_EMAILS (mọi tài khoản khác để NULL). Server so admin_key
-- với danh sách băm từ ADMIN_EMAILS hiện tại: bỏ một Gmail khỏi danh sách là người đó
-- mất quyền ngay khi server khởi động lại, không đợi đăng nhập lại.
-- Email không được lưu; chỉ có bản băm, và chỉ của chủ trang.
ALTER TABLE users ADD COLUMN admin_key TEXT;

-- Cột is_admin (bản trước) thôi dùng: xoá hết dấu cũ cho chắc
UPDATE users SET is_admin = 0;
