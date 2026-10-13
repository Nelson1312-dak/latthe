-- ============================================================
-- Tư vấn có AI hỗ trợ: khuyến nghị soạn với AI, nhận xét danh mục gửi khách.
-- Nguyên tắc: AI chỉ soạn bản nháp; môi giới sửa và bấm gửi. Lưu lại việc AI đã dùng (ai_job_id) để đối chiếu khi cần.
-- ============================================================
\set ON_ERROR_STOP on

-- Loại việc AI mới: luận điểm khuyến nghị, nhận xét danh mục viết cho khách đọc
ALTER TABLE trade.ai_jobs DROP CONSTRAINT IF EXISTS ai_jobs_kind_check;
ALTER TABLE trade.ai_jobs ADD CONSTRAINT ai_jobs_kind_check
  CHECK (kind IN ('portfolio_review','rebalance_note','advice_draft','client_note'));

-- Khuyến nghị: có dùng bản nháp AI nào không
ALTER TABLE trade.advice ADD COLUMN IF NOT EXISTS ai_job_id bigint REFERENCES trade.ai_jobs(id) ON DELETE SET NULL;

-- ---------- Nhận xét danh mục môi giới gửi khách ----------
CREATE TABLE IF NOT EXISTS trade.client_notes (
  id          bigserial PRIMARY KEY,
  broker_id   uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,   -- tài khoản Lật Bài của khách
  account_no  text NOT NULL CHECK (account_no ~ '^[0-9A-Za-z]{4,20}$'),
  title       text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  body        text NOT NULL CHECK (char_length(body) BETWEEN 20 AND 4000),
  ai_job_id   bigint REFERENCES trade.ai_jobs(id) ON DELETE SET NULL,
  ai_edited   boolean,                 -- môi giới có sửa bản nháp AI trước khi gửi không
  seen_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_notes_user_idx ON trade.client_notes (user_id, id DESC);
CREATE INDEX IF NOT EXISTS client_notes_broker_idx ON trade.client_notes (broker_id, id DESC);

REVOKE ALL ON trade.client_notes FROM PUBLIC, web_anon, app_auth, app_rw, app_worker;
GRANT SELECT, INSERT ON trade.client_notes TO app_rw;
GRANT UPDATE (seen_at) ON trade.client_notes TO app_rw;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA trade TO app_rw;
ALTER TABLE trade.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade.client_notes FORCE ROW LEVEL SECURITY;

-- Môi giới: chỉ gửi cho khách đã liên kết đúng tiểu khoản với chính mình
DROP POLICY IF EXISTS cn_broker_sel ON trade.client_notes;
DROP POLICY IF EXISTS cn_broker_ins ON trade.client_notes;
DROP POLICY IF EXISTS cn_client_sel ON trade.client_notes;
DROP POLICY IF EXISTS cn_client_upd ON trade.client_notes;
CREATE POLICY cn_broker_sel ON trade.client_notes FOR SELECT TO app_rw USING (broker_id = trade.uid());
CREATE POLICY cn_broker_ins ON trade.client_notes FOR INSERT TO app_rw
  WITH CHECK (broker_id = trade.uid() AND seen_at IS NULL
    AND EXISTS (SELECT 1 FROM trade.client_links l
                WHERE l.user_id = client_notes.user_id AND l.account_no = client_notes.account_no AND l.broker_id = trade.uid()));
-- Khách: đọc nhận xét gửi cho mình, chỉ được đánh dấu đã xem
CREATE POLICY cn_client_sel ON trade.client_notes FOR SELECT TO app_rw USING (user_id = trade.uid());
CREATE POLICY cn_client_upd ON trade.client_notes FOR UPDATE TO app_rw USING (user_id = trade.uid()) WITH CHECK (user_id = trade.uid());

NOTIFY pgrst, 'reload schema';
