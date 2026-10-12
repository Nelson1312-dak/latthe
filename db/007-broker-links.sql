-- ============================================================
-- Liên kết tới công ty chứng khoán (DNSE, SHS...). Token lưu dạng mã hóa ở tầng API.
-- Mật khẩu của người dùng tại công ty chứng khoán KHÔNG bao giờ được lưu.
-- ============================================================
\set ON_ERROR_STOP on

CREATE TABLE IF NOT EXISTS trade.broker_links (
  user_id     uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  broker      text NOT NULL CHECK (broker IN ('dnse','shs')),
  account_no  text,
  display     text,                      -- tên hiển thị của chủ tài khoản tại CTCK
  token_enc   text,                      -- access token, đã mã hóa
  token_exp   timestamptz,
  refresh_enc text,                      -- refresh token, đã mã hóa
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, broker)
);

REVOKE ALL ON trade.broker_links FROM PUBLIC, web_anon, app_auth, app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON trade.broker_links TO app_rw;

ALTER TABLE trade.broker_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade.broker_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS blink_own ON trade.broker_links;
CREATE POLICY blink_own ON trade.broker_links FOR ALL TO app_rw
  USING (user_id = trade.uid()) WITH CHECK (user_id = trade.uid());

-- Nhật ký kiểm toán dùng chung cho mọi CTCK
ALTER TABLE trade.dnse_audit ADD COLUMN IF NOT EXISTS broker text NOT NULL DEFAULT 'dnse';
GRANT SELECT (broker), INSERT (broker) ON trade.dnse_audit TO app_rw;
