-- ============================================================
-- Nhật ký kiểm toán lệnh thật gửi lên DNSE (chỉ tài khoản chủ sở hữu, qua API key riêng).
-- nonce UNIQUE: một lần xác nhận chỉ gửi được đúng một lệnh, bấm lại hay gửi lại request đều bị chặn.
-- API key/secret và trading token KHÔNG lưu ở đây.
-- ============================================================
\set ON_ERROR_STOP on

CREATE TABLE IF NOT EXISTS trade.dnse_audit (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  at         timestamptz NOT NULL DEFAULT now(),
  action     text NOT NULL CHECK (action IN ('place','cancel')),
  nonce      text UNIQUE,
  request    jsonb NOT NULL,
  result     jsonb
);
CREATE INDEX IF NOT EXISTS dnse_audit_user_idx ON trade.dnse_audit (user_id, at DESC);

REVOKE ALL ON trade.dnse_audit FROM PUBLIC, web_anon, app_auth, app_rw;
GRANT SELECT, INSERT, UPDATE (result) ON trade.dnse_audit TO app_rw;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA trade TO app_rw;

ALTER TABLE trade.dnse_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade.dnse_audit FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_read ON trade.dnse_audit;
DROP POLICY IF EXISTS audit_ins  ON trade.dnse_audit;
DROP POLICY IF EXISTS audit_upd  ON trade.dnse_audit;
CREATE POLICY audit_read ON trade.dnse_audit FOR SELECT TO app_rw USING (user_id = trade.uid());
CREATE POLICY audit_ins  ON trade.dnse_audit FOR INSERT TO app_rw WITH CHECK (user_id = trade.uid());
CREATE POLICY audit_upd  ON trade.dnse_audit FOR UPDATE TO app_rw USING (user_id = trade.uid()) WITH CHECK (user_id = trade.uid());
