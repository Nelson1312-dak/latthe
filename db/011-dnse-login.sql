-- ============================================================
-- Đăng nhập bằng tài khoản DNSE (dành cho môi giới được cấp quyền).
-- Chỉ lưu SỐ LƯU KÝ để nhận ra người dùng. Mật khẩu DNSE và token DNSE KHÔNG được lưu ở đâu cả.
-- ============================================================
\set ON_ERROR_STOP on

ALTER TABLE trade.users ADD COLUMN IF NOT EXISTS dnse_custody text;
CREATE UNIQUE INDEX IF NOT EXISTS users_dnse_custody_idx ON trade.users (dnse_custody) WHERE dnse_custody IS NOT NULL;

-- Phải có ít nhất một cách đăng nhập: mật khẩu, Google, hoặc tài khoản DNSE
ALTER TABLE trade.users DROP CONSTRAINT IF EXISTS users_has_login;
ALTER TABLE trade.users ADD  CONSTRAINT users_has_login CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL OR dnse_custody IS NOT NULL);

GRANT SELECT (dnse_custody) ON trade.users TO app_auth, app_rw;
GRANT INSERT (dnse_custody) ON trade.users TO app_auth;
