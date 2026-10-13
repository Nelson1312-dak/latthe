-- ============================================================
-- Băng lệnh và sổ lệnh theo thời gian: nền dữ liệu cho phần bóc tách dòng tiền.
--
-- Khác với trade.market_quotes (một dòng mỗi mã, ghi đè liên tục), hai bảng này GIỮ LỊCH SỬ.
-- Dữ liệu tick không mua lại được: API lịch sử của DNSE chỉ có nến OHLCV, nên mỗi phiên
-- không ghi là mất vĩnh viễn.
--
-- Chia bảng theo NGÀY (UTC) vì ba lý do:
--   1. dọn dữ liệu cũ bằng DROP phân vùng, tức thì, thay vì DELETE hàng chục triệu dòng;
--   2. sao lưu được từng ngày một lần rồi thôi, không phải dump lại toàn bộ lịch sử mỗi đêm
--      (xem db/backup.ps1 — nếu dump lại cả lịch sử thì một năm tốn hàng trăm GB);
--   3. truy vấn theo khoảng thời gian chỉ đọc đúng mấy phân vùng cần.
-- Phiên Việt Nam 09:00-15:00 (UTC+7) nằm gọn trong 02:00-08:00 UTC nên một ngày UTC = một phiên.
--
-- LƯU Ý về nguồn dữ liệu: DNSE không gửi từng lệnh khớp mà gửi ảnh chụp gộp theo nhịp
-- (đo được khoảng 1 bản tin / 8,5 giây / mã). Vì vậy bảng giữ CẢ HAI con số:
--   match_qty = khối lượng lệnh khớp DNSE báo trong bản tin đó,
--   vol_delta = chênh lệch khối lượng luỹ kế so với bản tin trước = khối lượng THẬT trong khoảng.
-- vol_delta lớn hơn match_qty bao nhiêu lần chính là mức gộp. Mọi thống kê dòng tiền phải
-- dùng vol_delta; match_qty chỉ để đo mức gộp và đối chiếu.
-- ============================================================
\set ON_ERROR_STOP on

-- ---------- Băng lệnh khớp ----------
CREATE TABLE IF NOT EXISTS trade.tape (
  symbol    text        NOT NULL CHECK (symbol ~ '^[A-Z0-9]{3,10}$'),
  at        timestamptz NOT NULL,
  price     integer     NOT NULL,     -- đồng, số nguyên nên không lệch như số thực
  match_qty integer,                  -- khối lượng DNSE báo cho lệnh khớp cuối (có thể đã gộp)
  vol_delta integer,                  -- khối lượng thật trong khoảng; NULL ở bản tin đầu tiên của mã trong phiên
  total_vol bigint,                   -- luỹ kế cả phiên, giữ lại để tính lại được vol_delta nếu cần
  bid1      integer,                  -- giá mua tốt nhất NGAY LÚC ĐÓ
  ask1      integer,                  -- giá bán tốt nhất ngay lúc đó
  side      "char"                    -- 'M' mua chủ động, 'B' bán chủ động, '?' không xác định
) PARTITION BY RANGE (at);

-- Giữ bid1/ask1 thô chứ không chỉ giữ kết luận `side`: sau này đổi cách suy luận thì còn
-- tính lại được trên dữ liệu cũ. Nếu chỉ lưu `side`, muốn sửa phải chờ cả năm để có lại dữ liệu.

-- ---------- Sổ lệnh (các bước giá) ----------
-- HOSE công bố 3 bước giá mỗi bên, HNX công bố 10. Lưu bằng mảng số nguyên chứ không phải jsonb:
-- đo thật trên 109.886 dòng thì jsonb tốn 1.203 byte/dòng còn mảng chỉ 218 byte — gấp 5,5 lần
-- cho cùng một nội dung, vì jsonb lặp lại tên trường ở từng mức giá.
CREATE TABLE IF NOT EXISTS trade.depth_log (
  symbol text        NOT NULL CHECK (symbol ~ '^[A-Z0-9]{3,10}$'),
  at     timestamptz NOT NULL,
  bid_p  integer[]   NOT NULL,        -- giá các bước mua, tốt nhất trước
  bid_q  integer[]   NOT NULL,        -- khối lượng tương ứng
  ask_p  integer[]   NOT NULL,
  ask_q  integer[]   NOT NULL
) PARTITION BY RANGE (at);

CREATE INDEX IF NOT EXISTS tape_symbol_at   ON trade.tape      (symbol, at);
CREATE INDEX IF NOT EXISTS depth_log_sym_at ON trade.depth_log (symbol, at);

-- Phân vùng hứng: dữ liệu đến ngoài khoảng đã tạo thì rơi vào đây thay vì làm hỏng lần ghi.
-- Bình thường phải luôn RỖNG; có dòng nghĩa là hàm tạo phân vùng đã không chạy kịp.
CREATE TABLE IF NOT EXISTS trade.tape_default      PARTITION OF trade.tape      DEFAULT;
CREATE TABLE IF NOT EXISTS trade.depth_log_default PARTITION OF trade.depth_log DEFAULT;

-- ---------- Tạo phân vùng cho hôm nay và vài ngày tới ----------
CREATE OR REPLACE FUNCTION trade.ensure_tape_partitions(p_days int DEFAULT 7)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = trade, pg_temp AS $$
DECLARE d date; i int; tbl text; part text; n int := 0;
BEGIN
  FOR i IN 0..greatest(coalesce(p_days, 7), 0) LOOP
    d := ((now() AT TIME ZONE 'UTC')::date) + i;
    FOREACH tbl IN ARRAY ARRAY['tape', 'depth_log'] LOOP
      part := tbl || '_' || to_char(d, 'YYYYMMDD');
      IF to_regclass('trade.' || quote_ident(part)) IS NULL THEN
        -- Mốc ghi rõ múi giờ +00: nếu để Postgres tự ép kiểu từ `date` thì mốc sẽ trôi
        -- theo múi giờ của phiên làm việc và các phân vùng lệch nhau.
        EXECUTE format('CREATE TABLE trade.%I PARTITION OF trade.%I FOR VALUES FROM (%L) TO (%L)',
                       part, tbl, to_char(d, 'YYYY-MM-DD') || ' 00:00:00+00',
                                  to_char(d + 1, 'YYYY-MM-DD') || ' 00:00:00+00');
        n := n + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN n;
END $$;

-- ---------- Dọn phân vùng cũ ----------
-- Dữ liệu thô chỉ cần giữ một thời gian; phần tổng hợp theo ngày mới giữ lâu dài.
CREATE OR REPLACE FUNCTION trade.drop_old_tape_partitions(p_keep_days int)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = trade, pg_temp AS $$
DECLARE moc date; r record; da text[] := '{}';
BEGIN
  IF p_keep_days IS NULL OR p_keep_days < 30 THEN
    RAISE EXCEPTION 'p_keep_days phai tu 30 tro len (nhan duoc %), tranh xoa nham du lieu chua kip tong hop', p_keep_days;
  END IF;
  moc := ((now() AT TIME ZONE 'UTC')::date) - p_keep_days;
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'trade' AND c.relkind = 'r'
      AND c.relname ~ '^(tape|depth_log)_[0-9]{8}$'
      AND to_date(right(c.relname, 8), 'YYYYMMDD') < moc
    ORDER BY c.relname
  LOOP
    EXECUTE format('DROP TABLE trade.%I', r.relname);
    da := da || r.relname;
  END LOOP;
  RETURN da;
END $$;

-- ---------- Quyền ----------
REVOKE ALL ON trade.tape, trade.depth_log FROM PUBLIC, web_anon, app_auth, app_rw, app_worker;
GRANT SELECT, INSERT ON trade.tape, trade.depth_log TO app_worker;
GRANT SELECT          ON trade.tape, trade.depth_log TO app_rw;

ALTER TABLE trade.tape      ENABLE ROW LEVEL SECURITY; ALTER TABLE trade.tape      FORCE ROW LEVEL SECURITY;
ALTER TABLE trade.depth_log ENABLE ROW LEVEL SECURITY; ALTER TABLE trade.depth_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tape_worker  ON trade.tape;
DROP POLICY IF EXISTS tape_read    ON trade.tape;
DROP POLICY IF EXISTS depth_worker ON trade.depth_log;
DROP POLICY IF EXISTS depth_read   ON trade.depth_log;
-- Dữ liệu thị trường, không gắn với khách nào, nên ai đã đăng nhập cũng đọc được.
CREATE POLICY tape_worker  ON trade.tape      FOR ALL    TO app_worker USING (true) WITH CHECK (true);
CREATE POLICY tape_read    ON trade.tape      FOR SELECT TO app_rw     USING (true);
CREATE POLICY depth_worker ON trade.depth_log FOR ALL    TO app_worker USING (true) WITH CHECK (true);
CREATE POLICY depth_read   ON trade.depth_log FOR SELECT TO app_rw     USING (true);

REVOKE ALL ON FUNCTION trade.ensure_tape_partitions(int)   FROM PUBLIC;
REVOKE ALL ON FUNCTION trade.drop_old_tape_partitions(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trade.ensure_tape_partitions(int)   TO app_worker;
GRANT EXECUTE ON FUNCTION trade.drop_old_tape_partitions(int) TO app_worker;

SELECT trade.ensure_tape_partitions(7);
