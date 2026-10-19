-- ============================================================
-- Trạng thái "unknown": đã gọi DNSE nhưng KHÔNG biết lệnh có vào sàn hay không.
--
-- Trước đây mọi lỗi khi gửi lệnh đều ghi 'failed'. Sai ở chỗ: hết 12 giây chờ (AbortController
-- trong api/_dnse.js) hay DNSE trả 5xx thì request VẪN có thể đã tới nơi và lệnh đã nằm trên sàn.
-- Ghi 'failed' làm bàn môi giới hiển thị "chưa gửi" cho một lệnh đang sống — rủi ro lớn nhất là
-- môi giới tạo phiếu mới và khách mua/bán gấp đôi.
--
-- 'failed'  = DNSE đã trả lời và TỪ CHỐI (4xx, 429, 401) — chắc chắn không có lệnh nào.
-- 'unknown' = không có câu trả lời dứt khoát — phải đối soát với sổ lệnh DNSE trước khi làm gì tiếp.
--             /api/broker/tickets action=reconcile liệt kê lệnh khớp mô tả, action=resolve chốt lại.
-- ============================================================
\set ON_ERROR_STOP on

ALTER TABLE trade.order_tickets DROP CONSTRAINT IF EXISTS order_tickets_status_check;
ALTER TABLE trade.order_tickets ADD CONSTRAINT order_tickets_status_check
  CHECK (status IN ('draft','pending_client','pending_broker','approved','sent','unknown','failed','rejected','expired','cancelled'));

-- Hạn mức theo ngày (api/_dnse.js dailyUsage) đọc nhật ký theo user + thời điểm + loại thao tác.
CREATE INDEX IF NOT EXISTS dnse_audit_place_idx ON trade.dnse_audit (user_id, at DESC) WHERE action = 'place';
