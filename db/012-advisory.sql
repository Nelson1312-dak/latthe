-- ============================================================
-- Tư vấn đầu tư: danh mục mẫu, hồ sơ khẩu vị rủi ro của khách, ảnh chụp danh mục hằng ngày, hàng đợi việc AI.
--
-- Nguyên tắc (giống 009):
--   * Môi giới chỉ chạm vào bản ghi có broker_id = mình.
--   * Khách chỉ đọc được dữ liệu gắn với tiểu khoản đã liên kết (client_links); ghi hồ sơ rủi ro qua hàm SECURITY DEFINER.
--   * Ảnh chụp danh mục do worker local ghi (app_worker). API phía môi giới đọc bằng app_worker SAU KHI đã kiểm tra
--     quyền trong code (như bảng giá ở 010), vì khách care-by chưa chắc đã có tài khoản Lật Bài.
--   * AI chạy trên máy local: API xếp việc vào ai_jobs, worker local lấy việc, gọi Ollama, ghi kết quả.
--     Đầu vào cho AI chỉ có số liệu đã tính sẵn, không có tên hay số tài khoản của khách.
-- ============================================================
\set ON_ERROR_STOP on

-- ---------- Danh mục mẫu ----------
CREATE TABLE IF NOT EXISTS trade.model_portfolios (
  id          bigserial PRIMARY KEY,
  broker_id   uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  risk_level  text NOT NULL CHECK (risk_level IN ('conservative','balanced','growth','aggressive')),
  description text CHECK (char_length(description) <= 1000),
  cash_pct    numeric(5,2) NOT NULL DEFAULT 0 CHECK (cash_pct BETWEEN 0 AND 100),
  drift_pct   numeric(5,2) NOT NULL DEFAULT 5 CHECK (drift_pct BETWEEN 0.5 AND 50),   -- lệch quá ngưỡng này mới đề xuất mua/bán
  archived    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS model_portfolios_broker_idx ON trade.model_portfolios (broker_id);

CREATE TABLE IF NOT EXISTS trade.model_weights (
  model_id  bigint NOT NULL REFERENCES trade.model_portfolios(id) ON DELETE CASCADE,
  broker_id uuid   NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,       -- lặp lại để RLS không phải tham chiếu chéo
  symbol    text   NOT NULL CHECK (symbol ~ '^[A-Z0-9]{3,10}$'),
  weight    numeric(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),        -- % trên tài sản ròng
  PRIMARY KEY (model_id, symbol)
);

-- ---------- Hồ sơ khách theo tiểu khoản ----------
CREATE TABLE IF NOT EXISTS trade.client_profiles (
  broker_id   uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  account_no  text NOT NULL CHECK (account_no ~ '^[0-9A-Za-z]{4,20}$'),
  risk_level  text CHECK (risk_level IN ('conservative','balanced','growth','aggressive')),
  risk_score  integer CHECK (risk_score BETWEEN 0 AND 100),
  answers     jsonb,
  answered_by text CHECK (answered_by IN ('client','broker')),
  answered_at timestamptz,
  model_id    bigint REFERENCES trade.model_portfolios(id) ON DELETE SET NULL,
  note        text CHECK (char_length(note) <= 2000),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (broker_id, account_no)
);

-- ---------- Ảnh chụp danh mục cuối ngày ----------
CREATE TABLE IF NOT EXISTS trade.portfolio_snapshots (
  account_no  text NOT NULL CHECK (account_no ~ '^[0-9A-Za-z]{4,20}$'),
  day         date NOT NULL,
  nav         numeric(18,0),           -- tài sản ròng (đồng) = giá trị cổ phiếu + tiền - nợ
  cash        numeric(18,0),
  stock_value numeric(18,0),
  debt        numeric(18,0),
  positions   jsonb NOT NULL DEFAULT '[]',   -- [{symbol, qty, price, cost}] giá theo đồng
  taken_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_no, day)
);

-- ---------- Việc cho AI local ----------
CREATE TABLE IF NOT EXISTS trade.ai_jobs (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('portfolio_review','rebalance_note')),
  input       jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  output      text,
  model       text,
  flags       jsonb,                   -- vd số liệu AI viết ra mà không có trong dữ liệu đầu vào
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS ai_jobs_queue_idx ON trade.ai_jobs (id) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS ai_jobs_user_idx ON trade.ai_jobs (user_id, id DESC);

-- ---------- Quyền bảng ----------
REVOKE ALL ON trade.model_portfolios, trade.model_weights, trade.client_profiles, trade.portfolio_snapshots, trade.ai_jobs
  FROM PUBLIC, web_anon, app_auth, app_rw, app_worker;

GRANT SELECT, INSERT, UPDATE ON trade.model_portfolios TO app_rw;
GRANT SELECT, INSERT, DELETE ON trade.model_weights TO app_rw;
GRANT SELECT, INSERT, UPDATE ON trade.client_profiles TO app_rw;
GRANT SELECT ON trade.portfolio_snapshots TO app_rw;
GRANT SELECT, INSERT ON trade.ai_jobs TO app_rw;

GRANT SELECT, INSERT, UPDATE ON trade.portfolio_snapshots TO app_worker;
GRANT SELECT ON trade.ai_jobs TO app_worker;
GRANT UPDATE (status, output, model, flags, error, started_at, finished_at) ON trade.ai_jobs TO app_worker;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA trade TO app_rw, app_worker;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['model_portfolios','model_weights','client_profiles','portfolio_snapshots','ai_jobs'] LOOP
    EXECUTE format('ALTER TABLE trade.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE trade.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Môi giới: bản ghi của mình
DROP POLICY IF EXISTS mp_broker ON trade.model_portfolios;
CREATE POLICY mp_broker ON trade.model_portfolios FOR ALL TO app_rw USING (broker_id = trade.uid()) WITH CHECK (broker_id = trade.uid());
DROP POLICY IF EXISTS mw_broker ON trade.model_weights;
CREATE POLICY mw_broker ON trade.model_weights FOR ALL TO app_rw USING (broker_id = trade.uid())
  WITH CHECK (broker_id = trade.uid() AND EXISTS (SELECT 1 FROM trade.model_portfolios m WHERE m.id = model_weights.model_id AND m.broker_id = trade.uid()));
DROP POLICY IF EXISTS cp_broker ON trade.client_profiles;
CREATE POLICY cp_broker ON trade.client_profiles FOR ALL TO app_rw USING (broker_id = trade.uid())
  WITH CHECK (broker_id = trade.uid()
    AND (model_id IS NULL OR EXISTS (SELECT 1 FROM trade.model_portfolios m WHERE m.id = client_profiles.model_id AND m.broker_id = trade.uid())));

-- Khách: hồ sơ, danh mục mẫu được gán, ảnh chụp của tiểu khoản đã liên kết (đúng môi giới đó)
DROP POLICY IF EXISTS cp_client ON trade.client_profiles;
CREATE POLICY cp_client ON trade.client_profiles FOR SELECT TO app_rw
  USING (EXISTS (SELECT 1 FROM trade.client_links l
                 WHERE l.user_id = trade.uid() AND l.account_no = client_profiles.account_no AND l.broker_id = client_profiles.broker_id));
-- Danh mục mẫu khách được xem. Hàm SECURITY DEFINER để cắt vòng RLS: chính sách của client_profiles tham chiếu
-- model_portfolios, nên chính sách của model_portfolios không được tham chiếu ngược client_profiles qua RLS.
CREATE OR REPLACE FUNCTION trade.client_model_ids() RETURNS SETOF bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = trade, pg_temp AS $$
  SELECT p.model_id FROM trade.client_profiles p
  JOIN trade.client_links l ON l.account_no = p.account_no AND l.broker_id = p.broker_id
  WHERE l.user_id = trade.uid() AND p.model_id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION trade.client_model_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trade.client_model_ids() TO app_rw;

DROP POLICY IF EXISTS mp_client ON trade.model_portfolios;
CREATE POLICY mp_client ON trade.model_portfolios FOR SELECT TO app_rw USING (id IN (SELECT trade.client_model_ids()));
DROP POLICY IF EXISTS mw_client ON trade.model_weights;
CREATE POLICY mw_client ON trade.model_weights FOR SELECT TO app_rw USING (model_id IN (SELECT trade.client_model_ids()));
DROP POLICY IF EXISTS ps_client ON trade.portfolio_snapshots;
CREATE POLICY ps_client ON trade.portfolio_snapshots FOR SELECT TO app_rw
  USING (EXISTS (SELECT 1 FROM trade.client_links l WHERE l.user_id = trade.uid() AND l.account_no = portfolio_snapshots.account_no));
DROP POLICY IF EXISTS ps_worker ON trade.portfolio_snapshots;
CREATE POLICY ps_worker ON trade.portfolio_snapshots FOR ALL TO app_worker USING (true) WITH CHECK (true);

-- AI: người tạo việc đọc được việc của mình; chỉ tạo được việc mới ở trạng thái chờ
DROP POLICY IF EXISTS ai_owner_sel ON trade.ai_jobs;
DROP POLICY IF EXISTS ai_owner_ins ON trade.ai_jobs;
CREATE POLICY ai_owner_sel ON trade.ai_jobs FOR SELECT TO app_rw USING (user_id = trade.uid());
CREATE POLICY ai_owner_ins ON trade.ai_jobs FOR INSERT TO app_rw
  WITH CHECK (user_id = trade.uid() AND status = 'queued' AND output IS NULL AND started_at IS NULL AND finished_at IS NULL);
DROP POLICY IF EXISTS ai_worker ON trade.ai_jobs;
CREATE POLICY ai_worker ON trade.ai_jobs FOR ALL TO app_worker USING (true) WITH CHECK (true);

-- ---------- Khách tự trả lời bảng câu hỏi khẩu vị rủi ro ----------
-- Giữ nguyên danh mục mẫu và ghi chú môi giới đã đặt; chỉ cập nhật phần trả lời.
CREATE OR REPLACE FUNCTION trade.submit_risk_profile(p_account text, p_answers jsonb, p_score integer, p_level text)
RETURNS trade.client_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = trade, pg_temp AS $$
DECLARE
  v_uid uuid := trade.uid();
  l trade.client_links;
  p trade.client_profiles;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_level NOT IN ('conservative','balanced','growth','aggressive') OR p_score NOT BETWEEN 0 AND 100
     OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'profile_invalid' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO l FROM trade.client_links WHERE user_id = v_uid AND account_no = p_account LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'account_not_linked' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO trade.client_profiles (broker_id, account_no, risk_level, risk_score, answers, answered_by, answered_at, updated_at)
    VALUES (l.broker_id, l.account_no, p_level, p_score, p_answers, 'client', now(), now())
    ON CONFLICT (broker_id, account_no) DO UPDATE
      SET risk_level = EXCLUDED.risk_level, risk_score = EXCLUDED.risk_score, answers = EXCLUDED.answers,
          answered_by = 'client', answered_at = now(), updated_at = now()
    RETURNING * INTO p;
  RETURN p;
END $$;
REVOKE ALL ON FUNCTION trade.submit_risk_profile(text, jsonb, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trade.submit_risk_profile(text, jsonb, integer, text) TO app_rw;

-- ---------- Lưu danh mục mẫu: thông tin + thay toàn bộ tỷ trọng trong MỘT giao dịch ----------
-- SECURITY INVOKER: chạy bằng quyền app_rw, RLS vẫn ép broker_id = người gọi. API đã kiểm tra tổng tỷ trọng.
CREATE OR REPLACE FUNCTION trade.save_model(p jsonb) RETURNS trade.model_portfolios
LANGUAGE plpgsql SECURITY INVOKER SET search_path = trade, pg_temp AS $$
DECLARE
  v_uid uuid := trade.uid();
  m trade.model_portfolios;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF (p->>'id') IS NULL THEN
    INSERT INTO trade.model_portfolios (broker_id, name, risk_level, description, cash_pct, drift_pct)
      VALUES (v_uid, p->>'name', p->>'risk_level', NULLIF(p->>'description', ''), (p->>'cash_pct')::numeric, (p->>'drift_pct')::numeric)
      RETURNING * INTO m;
  ELSE
    UPDATE trade.model_portfolios
      SET name = p->>'name', risk_level = p->>'risk_level', description = NULLIF(p->>'description', ''),
          cash_pct = (p->>'cash_pct')::numeric, drift_pct = (p->>'drift_pct')::numeric, updated_at = now()
      WHERE id = (p->>'id')::bigint AND broker_id = v_uid
      RETURNING * INTO m;
    IF NOT FOUND THEN RAISE EXCEPTION 'model_not_found' USING ERRCODE = 'P0002'; END IF;
    DELETE FROM trade.model_weights WHERE model_id = m.id;
  END IF;
  INSERT INTO trade.model_weights (model_id, broker_id, symbol, weight)
    SELECT m.id, v_uid, upper(x->>'symbol'), (x->>'weight')::numeric FROM jsonb_array_elements(p->'weights') AS x;
  RETURN m;
END $$;
REVOKE ALL ON FUNCTION trade.save_model(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trade.save_model(jsonb) TO app_rw;

-- PostgREST nạp lại cấu trúc (bảng, hàm mới) mà không cần khởi động lại
NOTIFY pgrst, 'reload schema';
