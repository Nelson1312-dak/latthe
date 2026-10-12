-- ============================================================
-- Giá thị trường realtime từ DNSE Market Data WebSocket.
-- Worker ghi (app_worker), API đọc bằng cùng role đó. Trình duyệt không bao giờ chạm trực tiếp vào bảng này.
-- ============================================================
\set ON_ERROR_STOP on

CREATE TABLE IF NOT EXISTS trade.market_quotes (
  symbol text PRIMARY KEY CHECK (symbol ~ '^[A-Z0-9]{3,10}$'),
  data   jsonb NOT NULL,                      -- last, open, high, low, vol, bid[], offer[], ref, ceil, floor
  at     timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trade.market_indices (
  name text PRIMARY KEY CHECK (name ~ '^[A-Z0-9]{2,20}$'),
  data jsonb NOT NULL,                        -- value, prior, pct, breadth (tăng/giảm/đứng), thanh khoản
  at   timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON trade.market_quotes, trade.market_indices FROM PUBLIC, web_anon, app_auth, app_rw, app_worker;
GRANT SELECT, INSERT, UPDATE ON trade.market_quotes, trade.market_indices TO app_worker;

ALTER TABLE trade.market_quotes  ENABLE ROW LEVEL SECURITY; ALTER TABLE trade.market_quotes  FORCE ROW LEVEL SECURITY;
ALTER TABLE trade.market_indices ENABLE ROW LEVEL SECURITY; ALTER TABLE trade.market_indices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mq_worker ON trade.market_quotes;
DROP POLICY IF EXISTS mi_worker ON trade.market_indices;
CREATE POLICY mq_worker ON trade.market_quotes  FOR ALL TO app_worker USING (true) WITH CHECK (true);
CREATE POLICY mi_worker ON trade.market_indices FOR ALL TO app_worker USING (true) WITH CHECK (true);
