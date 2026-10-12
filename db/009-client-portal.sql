-- ============================================================
-- Cổng khách hàng: lời mời liên kết, khuyến nghị, xác nhận phiếu lệnh; và sự kiện realtime từ DNSE.
--
-- Nguyên tắc: khách chỉ chạm được vào dữ liệu gắn với tài khoản mình đã liên kết (client_links).
-- Hai thao tác cần quyền cao hơn (nhận lời mời, duyệt phiếu) đi qua hàm SECURITY DEFINER tự kiểm tra uid.
-- ============================================================
\set ON_ERROR_STOP on

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_worker') THEN CREATE ROLE app_worker NOLOGIN; END IF;
END $$;
GRANT app_worker TO authenticator;
GRANT USAGE ON SCHEMA trade TO app_worker;

-- ---------- Lời mời: môi giới tạo, khách nhận bằng mã dùng một lần ----------
CREATE TABLE IF NOT EXISTS trade.client_invites (
  id          bigserial PRIMARY KEY,
  broker_id   uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  investor_id text NOT NULL,
  account_no  text NOT NULL CHECK (account_no ~ '^[0-9A-Za-z]{4,20}$'),
  client_name text,
  token_hash  text NOT NULL UNIQUE,            -- chỉ lưu băm SHA-256, mã gốc chỉ hiện một lần cho môi giới
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  used_by     uuid REFERENCES trade.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trade.client_links (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,   -- tài khoản Lật Bài của khách
  broker_id   uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  investor_id text NOT NULL,
  account_no  text NOT NULL,
  client_name text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_no)
);
CREATE INDEX IF NOT EXISTS client_links_broker_idx ON trade.client_links (broker_id);

-- ---------- Khuyến nghị ----------
CREATE TABLE IF NOT EXISTS trade.advice (
  id          bigserial PRIMARY KEY,
  broker_id   uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  symbol      text NOT NULL CHECK (symbol ~ '^[A-Z0-9]{3,10}$'),
  side        text CHECK (side IN ('B','S')),
  entry_low   numeric(12,2) CHECK (entry_low > 0),
  entry_high  numeric(12,2) CHECK (entry_high > 0),
  target      numeric(12,2) CHECK (target > 0),
  stop        numeric(12,2) CHECK (stop > 0),
  thesis      text NOT NULL CHECK (char_length(thesis) BETWEEN 10 AND 2000),
  valid_until timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS advice_broker_idx ON trade.advice (broker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trade.advice_recipients (
  advice_id bigint NOT NULL REFERENCES trade.advice(id) ON DELETE CASCADE,
  user_id   uuid   NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  broker_id uuid   NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,   -- lặp lại để RLS không phải tham chiếu chéo
  seen_at   timestamptz,
  PRIMARY KEY (advice_id, user_id)
);

-- ---------- Sự kiện realtime từ DNSE WebSocket ----------
CREATE TABLE IF NOT EXISTS trade.order_events (
  id                bigserial PRIMARY KEY,
  investor_id       text NOT NULL,
  account_no        text NOT NULL,
  dnse_order_id     text NOT NULL,
  symbol            text,
  side              text,
  order_type        text,
  price             numeric(14,2),
  quantity          integer,
  fill_quantity     integer NOT NULL DEFAULT 0,
  canceled_quantity integer NOT NULL DEFAULT 0,
  status            text NOT NULL,
  market_type       text,
  event_at          timestamptz NOT NULL DEFAULT now(),
  raw               jsonb,
  UNIQUE (dnse_order_id, status, fill_quantity, canceled_quantity)         -- cùng một sự kiện gửi lại thì bỏ qua
);
CREATE INDEX IF NOT EXISTS order_events_acc_idx ON trade.order_events (account_no, event_at DESC);

CREATE TABLE IF NOT EXISTS trade.worker_status (
  name text PRIMARY KEY,
  at   timestamptz NOT NULL DEFAULT now(),
  info jsonb NOT NULL DEFAULT '{}'
);

-- ---------- Quyền bảng ----------
REVOKE ALL ON trade.client_invites, trade.client_links, trade.advice, trade.advice_recipients, trade.order_events, trade.worker_status
  FROM PUBLIC, web_anon, app_auth, app_rw, app_worker;

GRANT SELECT, INSERT ON trade.client_invites TO app_rw;
GRANT SELECT ON trade.client_links TO app_rw;
GRANT SELECT, INSERT ON trade.advice TO app_rw;
GRANT SELECT, INSERT ON trade.advice_recipients TO app_rw;
GRANT UPDATE (seen_at) ON trade.advice_recipients TO app_rw;
GRANT SELECT ON trade.order_events, trade.worker_status TO app_rw;

GRANT SELECT, INSERT ON trade.order_events TO app_worker;
GRANT SELECT, INSERT, UPDATE ON trade.worker_status TO app_worker;
GRANT SELECT (id, account_no, dnse_order_id, dnse_status) ON trade.order_tickets TO app_worker;
GRANT UPDATE (dnse_status) ON trade.order_tickets TO app_worker;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA trade TO app_rw, app_worker;

-- ---------- RLS ----------
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['client_invites','client_links','advice','advice_recipients','order_events','worker_status'] LOOP
    EXECUTE format('ALTER TABLE trade.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE trade.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS inv_broker ON trade.client_invites;
CREATE POLICY inv_broker ON trade.client_invites FOR ALL TO app_rw USING (broker_id = trade.uid()) WITH CHECK (broker_id = trade.uid());

DROP POLICY IF EXISTS link_client ON trade.client_links;
DROP POLICY IF EXISTS link_broker ON trade.client_links;
CREATE POLICY link_client ON trade.client_links FOR SELECT TO app_rw USING (user_id = trade.uid());
CREATE POLICY link_broker ON trade.client_links FOR SELECT TO app_rw USING (broker_id = trade.uid());

DROP POLICY IF EXISTS adv_broker ON trade.advice;
DROP POLICY IF EXISTS adv_client ON trade.advice;
CREATE POLICY adv_broker ON trade.advice FOR ALL TO app_rw USING (broker_id = trade.uid()) WITH CHECK (broker_id = trade.uid());
CREATE POLICY adv_client ON trade.advice FOR SELECT TO app_rw
  USING (EXISTS (SELECT 1 FROM trade.advice_recipients r WHERE r.advice_id = advice.id AND r.user_id = trade.uid()));

DROP POLICY IF EXISTS rcp_broker_read ON trade.advice_recipients;
DROP POLICY IF EXISTS rcp_broker_ins  ON trade.advice_recipients;
DROP POLICY IF EXISTS rcp_client      ON trade.advice_recipients;
CREATE POLICY rcp_broker_read ON trade.advice_recipients FOR SELECT TO app_rw USING (broker_id = trade.uid());
-- Môi giới chỉ gửi được cho khách đã liên kết với chính mình
CREATE POLICY rcp_broker_ins ON trade.advice_recipients FOR INSERT TO app_rw
  WITH CHECK (broker_id = trade.uid()
    AND EXISTS (SELECT 1 FROM trade.client_links l WHERE l.user_id = advice_recipients.user_id AND l.broker_id = trade.uid()));
CREATE POLICY rcp_client ON trade.advice_recipients FOR ALL TO app_rw USING (user_id = trade.uid()) WITH CHECK (user_id = trade.uid());

-- Khách xem được phiếu lệnh gửi cho tài khoản mình đã liên kết (với đúng môi giới đó)
DROP POLICY IF EXISTS ticket_client ON trade.order_tickets;
CREATE POLICY ticket_client ON trade.order_tickets FOR SELECT TO app_rw
  USING (EXISTS (SELECT 1 FROM trade.client_links l
                 WHERE l.user_id = trade.uid() AND l.account_no = order_tickets.account_no AND l.broker_id = order_tickets.broker_id));

DROP POLICY IF EXISTS tk_worker_sel ON trade.order_tickets;
DROP POLICY IF EXISTS tk_worker_upd ON trade.order_tickets;
CREATE POLICY tk_worker_sel ON trade.order_tickets FOR SELECT TO app_worker USING (true);
CREATE POLICY tk_worker_upd ON trade.order_tickets FOR UPDATE TO app_worker USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ev_worker  ON trade.order_events;
DROP POLICY IF EXISTS ev_broker  ON trade.order_events;
DROP POLICY IF EXISTS ev_client  ON trade.order_events;
CREATE POLICY ev_worker ON trade.order_events FOR ALL TO app_worker USING (true) WITH CHECK (true);
CREATE POLICY ev_broker ON trade.order_events FOR SELECT TO app_rw
  USING (EXISTS (SELECT 1 FROM trade.order_tickets t WHERE t.account_no = order_events.account_no AND t.broker_id = trade.uid()));
CREATE POLICY ev_client ON trade.order_events FOR SELECT TO app_rw
  USING (EXISTS (SELECT 1 FROM trade.client_links l WHERE l.account_no = order_events.account_no AND l.user_id = trade.uid()));

DROP POLICY IF EXISTS ws_worker ON trade.worker_status;
DROP POLICY IF EXISTS ws_read   ON trade.worker_status;
CREATE POLICY ws_worker ON trade.worker_status FOR ALL TO app_worker USING (true) WITH CHECK (true);
CREATE POLICY ws_read   ON trade.worker_status FOR SELECT TO app_rw USING (true);

-- ---------- Nhận lời mời: tạo liên kết, đánh dấu đã dùng, trong một giao dịch ----------
CREATE OR REPLACE FUNCTION trade.accept_invite(p_hash text) RETURNS trade.client_links
LANGUAGE plpgsql SECURITY DEFINER SET search_path = trade, pg_temp AS $$
DECLARE
  v_uid uuid := trade.uid();
  i trade.client_invites;
  l trade.client_links;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO i FROM trade.client_invites WHERE token_hash = p_hash FOR UPDATE;
  IF NOT FOUND OR i.used_at IS NOT NULL OR i.expires_at < now() THEN
    RAISE EXCEPTION 'invite_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF i.broker_id = v_uid THEN RAISE EXCEPTION 'invite_own' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO trade.client_links (user_id, broker_id, investor_id, account_no, client_name)
    VALUES (v_uid, i.broker_id, i.investor_id, i.account_no, i.client_name)
    ON CONFLICT (user_id, account_no) DO UPDATE SET broker_id = EXCLUDED.broker_id, investor_id = EXCLUDED.investor_id
    RETURNING * INTO l;
  UPDATE trade.client_invites SET used_at = now(), used_by = v_uid WHERE id = i.id;
  RETURN l;
END $$;

-- ---------- Khách duyệt / từ chối phiếu lệnh ----------
CREATE OR REPLACE FUNCTION trade.client_decide_ticket(p_id bigint, p_approve boolean) RETURNS trade.order_tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = trade, pg_temp AS $$
DECLARE
  v_uid uuid := trade.uid();
  t trade.order_tickets;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO t FROM trade.order_tickets WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
       SELECT 1 FROM trade.client_links l
       WHERE l.user_id = v_uid AND l.account_no = t.account_no AND l.broker_id = t.broker_id)
  THEN RAISE EXCEPTION 'ticket_not_found' USING ERRCODE = 'P0002'; END IF;
  IF t.status <> 'pending_client' THEN RAISE EXCEPTION 'ticket_not_pending' USING ERRCODE = 'P0001'; END IF;
  IF t.created_at < now() - interval '24 hours' THEN
    UPDATE trade.order_tickets SET status = 'expired' WHERE id = t.id;
    RAISE EXCEPTION 'ticket_expired' USING ERRCODE = 'P0001';
  END IF;
  IF p_approve THEN
    -- Khách bấm xác nhận: đây là bằng chứng chỉ thị. Môi giới có 15 phút để gửi, tránh giá lệch.
    UPDATE trade.order_tickets
      SET status = 'approved', approved_by = v_uid, approved_at = now(), instructed_at = now(),
          expires_at = now() + interval '15 minutes'
      WHERE id = t.id RETURNING * INTO t;
  ELSE
    UPDATE trade.order_tickets SET status = 'rejected', approved_by = v_uid, approved_at = now()
      WHERE id = t.id RETURNING * INTO t;
  END IF;
  RETURN t;
END $$;

REVOKE ALL ON FUNCTION trade.accept_invite(text), trade.client_decide_ticket(bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trade.accept_invite(text), trade.client_decide_ticket(bigint, boolean) TO app_rw;
