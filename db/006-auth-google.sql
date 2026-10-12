-- ============================================================
-- Đăng nhập bằng Google, song song với tài khoản tạo trên hệ thống.
-- Tài khoản Google không có mật khẩu => password_hash cho phép NULL.
-- ============================================================
\set ON_ERROR_STOP on

ALTER TABLE trade.users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE trade.users ADD COLUMN IF NOT EXISTS email      citext;
ALTER TABLE trade.users ADD COLUMN IF NOT EXISTS google_sub text;
ALTER TABLE trade.users ADD COLUMN IF NOT EXISTS avatar_url text;

-- Mỗi tài khoản Google chỉ gắn với một user; email cũng là duy nhất.
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx ON trade.users (google_sub) WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx      ON trade.users (email)      WHERE email IS NOT NULL;

-- Phải có ít nhất một cách đăng nhập
ALTER TABLE trade.users DROP CONSTRAINT IF EXISTS users_has_login;
ALTER TABLE trade.users ADD  CONSTRAINT users_has_login CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL);

-- app_auth: thêm quyền trên các cột mới để đăng ký/đăng nhập Google
GRANT SELECT (id, username, password_hash, display_name, role, email, google_sub, avatar_url) ON trade.users TO app_auth;
GRANT INSERT (username, password_hash, display_name, email, google_sub, avatar_url)           ON trade.users TO app_auth;
GRANT UPDATE (google_sub, avatar_url, email)                                                  ON trade.users TO app_auth;
-- app_rw vẫn KHÔNG đọc được password_hash
GRANT SELECT (id, username, display_name, role, created_at, email, avatar_url) ON trade.users TO app_rw;

DROP POLICY IF EXISTS users_link ON trade.users;
CREATE POLICY users_link ON trade.users FOR UPDATE TO app_auth USING (true) WITH CHECK (true);
