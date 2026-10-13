-- ============================================================
-- Kho dữ liệu theo mã (để tư vấn trả lời ngay, không phải đợi AI tính lúc được hỏi).
--
--   symbol_facts  : dữ liệu thô đã chuẩn hóa cho từng mã.
--                   - tech  : chỉ báo kỹ thuật, worker trên máy nhà tính lại mỗi phiên từ giá DNSE.
--                   - fundamentals: hồ sơ doanh nghiệp + chỉ số tài chính + sự kiện quyền, nhập từ DNSE
--                     (xem db/import-facts.mjs). Đổi theo quý nên không cần cập nhật hằng ngày.
--   symbol_briefs : bản tóm tắt do AI local viết sẵn từ symbol_facts. Khi khách hỏi một mã thì đọc thẳng
--                   ở đây (vài chục mili giây) thay vì chờ AI viết 20-40 giây.
--
-- Đây là dữ liệu thị trường, không gắn với người dùng nào: mọi tài khoản đã đăng nhập đều đọc được.
-- ============================================================
\set ON_ERROR_STOP on

CREATE TABLE IF NOT EXISTS trade.symbol_facts (
  symbol       text PRIMARY KEY CHECK (symbol ~ '^[A-Z0-9]{3,10}$'),
  tech         jsonb,
  tech_at      timestamptz,
  fundamentals jsonb,
  fund_at      timestamptz,
  fund_source  text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trade.symbol_briefs (
  symbol       text PRIMARY KEY REFERENCES trade.symbol_facts(symbol) ON DELETE CASCADE,
  brief        text NOT NULL,
  facts_hash   text NOT NULL,              -- dữ liệu không đổi thì không viết lại
  model        text,
  flags        jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON trade.symbol_facts, trade.symbol_briefs FROM PUBLIC, web_anon, app_auth, app_rw, app_worker;
GRANT SELECT ON trade.symbol_facts, trade.symbol_briefs TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON trade.symbol_facts, trade.symbol_briefs TO app_worker;

ALTER TABLE trade.symbol_facts  ENABLE ROW LEVEL SECURITY; ALTER TABLE trade.symbol_facts  FORCE ROW LEVEL SECURITY;
ALTER TABLE trade.symbol_briefs ENABLE ROW LEVEL SECURITY; ALTER TABLE trade.symbol_briefs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sf_read   ON trade.symbol_facts;
DROP POLICY IF EXISTS sf_worker ON trade.symbol_facts;
DROP POLICY IF EXISTS sb_read   ON trade.symbol_briefs;
DROP POLICY IF EXISTS sb_worker ON trade.symbol_briefs;
CREATE POLICY sf_read   ON trade.symbol_facts  FOR SELECT TO app_rw     USING (true);
CREATE POLICY sf_worker ON trade.symbol_facts  FOR ALL    TO app_worker USING (true) WITH CHECK (true);
CREATE POLICY sb_read   ON trade.symbol_briefs FOR SELECT TO app_rw     USING (true);
CREATE POLICY sb_worker ON trade.symbol_briefs FOR ALL    TO app_worker USING (true) WITH CHECK (true);

-- Loại việc AI mới: tóm tắt mã (worker tự chạy, không qua hàng đợi ai_jobs của môi giới)
ALTER TABLE trade.ai_jobs DROP CONSTRAINT IF EXISTS ai_jobs_kind_check;
ALTER TABLE trade.ai_jobs ADD CONSTRAINT ai_jobs_kind_check
  CHECK (kind IN ('portfolio_review','rebalance_note','advice_draft','client_note','symbol_brief'));

NOTIFY pgrst, 'reload schema';
