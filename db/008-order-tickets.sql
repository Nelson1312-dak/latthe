-- ============================================================
-- Phiếu lệnh môi giới đặt cho khách hàng (DNSE broker / care-by).
-- Mỗi lệnh trên tài khoản khách phải gắn với chỉ thị của khách: khách xác nhận trong app,
-- hoặc môi giới ghi nhận chỉ thị qua điện thoại / chat / gặp trực tiếp, kèm thời điểm.
-- ============================================================
\set ON_ERROR_STOP on

CREATE TABLE IF NOT EXISTS trade.order_tickets (
  id               bigserial PRIMARY KEY,
  broker_id        uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  account_no       text NOT NULL CHECK (account_no ~ '^[0-9A-Za-z]{4,20}$'),
  investor_id      text,
  client_name      text,
  symbol           text NOT NULL CHECK (symbol ~ '^[A-Z0-9]{3,10}$'),
  side             text NOT NULL CHECK (side IN ('B','S')),
  type             text NOT NULL CHECK (type IN ('LO','MTL','ATO','ATC')),
  price            numeric(12,2) CHECK (price > 0),          -- nghìn đồng, như bảng giá
  qty              integer NOT NULL CHECK (qty > 0 AND qty % 100 = 0),
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','pending_client','pending_broker','approved','sent','failed','rejected','expired','cancelled')),
  source           text NOT NULL CHECK (source IN ('app','phone','chat','in_person')),
  instruction_note text CHECK (char_length(instruction_note) <= 1000),
  instructed_at    timestamptz,                               -- lúc khách ra chỉ thị
  approved_by      uuid REFERENCES trade.users(id),
  approved_at      timestamptz,
  expires_at       timestamptz,
  dnse_order_id    text,
  dnse_status      text,
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz,
  CHECK (type <> 'LO' OR price IS NOT NULL),
  CHECK (source = 'app' OR instructed_at IS NOT NULL)          -- chỉ thị ngoài app phải có thời điểm
);
CREATE INDEX IF NOT EXISTS tickets_broker_idx ON trade.order_tickets (broker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_account_idx ON trade.order_tickets (account_no, created_at DESC);

REVOKE ALL ON trade.order_tickets FROM PUBLIC, web_anon, app_auth, app_rw;
GRANT SELECT, INSERT ON trade.order_tickets TO app_rw;
GRANT UPDATE (status, approved_by, approved_at, expires_at, dnse_order_id, dnse_status, error, sent_at) ON trade.order_tickets TO app_rw;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA trade TO app_rw;

ALTER TABLE trade.order_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade.order_tickets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_broker ON trade.order_tickets;
CREATE POLICY ticket_broker ON trade.order_tickets FOR ALL TO app_rw
  USING (broker_id = trade.uid()) WITH CHECK (broker_id = trade.uid());

-- Nhật ký kiểm toán: thêm tham chiếu phiếu lệnh
ALTER TABLE trade.dnse_audit ADD COLUMN IF NOT EXISTS ticket_id bigint REFERENCES trade.order_tickets(id);
GRANT SELECT (ticket_id), INSERT (ticket_id) ON trade.dnse_audit TO app_rw;
