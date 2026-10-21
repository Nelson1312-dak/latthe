-- ============================================================
-- Bỏ hẳn engine giao dịch thử (tiền ảo).
--
-- Ngày 21/10/2026, khi nền tảng đã đặt được lệnh thật trên cả DNSE lẫn SHS, chủ hệ thống quyết
-- định bỏ chế độ tiền ảo. Lý do không phải là nó thừa dung lượng, mà là RỦI RO NHẦM: một ngăn
-- tiền giả đứng ngay cạnh tài khoản thật buộc người đặt lệnh phải kiểm tra "mình đang ở đâu"
-- trước mỗi lần bấm gửi. Một lần quên là một lệnh thật tưởng là lệnh thử, hoặc ngược lại.
--
-- Lúc xoá: trade.orders và trade.holdings đều RỖNG (0 dòng) — lịch sử giao dịch thử đã được dọn
-- từ hôm 20/10. trade.accounts còn đúng 1 dòng là số dư ảo của chủ tài khoản. Đã sao lưu cả ba
-- bảng ra latthe-db-backup/truoc-xoa-giao-dich-thu-20261021-1352.dump và kiểm tra đọc lại được
-- trước khi chạy file này.
--
-- Phía mã nguồn đã gỡ trong cùng một commit: api/_trade.js, server/routes/orders.js, lối vào
-- 'orders' trong api/router.js, và phần giao dịch thử trong server/routes/me.js.
-- ============================================================
\set ON_ERROR_STOP on

-- Trigger seed tài khoản ảo cho mỗi user mới. Hàm này KHÔNG làm gì khác ngoài chèn vào
-- trade.accounts, nên bỏ cùng là đúng; người dùng mới từ nay không có ví ảo nào được tạo.
DROP TRIGGER IF EXISTS users_account ON trade.users;
DROP FUNCTION IF EXISTS trade.on_user_created();

-- Hàm khớp lệnh giả lập.
DROP FUNCTION IF EXISTS trade.place_order(text, text, text, numeric, integer);
DROP FUNCTION IF EXISTS trade.place_order(text, text, text, numeric, int);
DROP FUNCTION IF EXISTS trade.fill_order(bigint, numeric);
DROP FUNCTION IF EXISTS trade.cancel_order(bigint);

-- Bảng dữ liệu. CASCADE vì holdings/orders tham chiếu accounts; không có bảng nào khác trỏ vào
-- ba bảng này (đã soát: order_tickets, dnse_audit, order_events đều đứng độc lập).
DROP TABLE IF EXISTS trade.orders CASCADE;
DROP TABLE IF EXISTS trade.holdings CASCADE;
DROP TABLE IF EXISTS trade.accounts CASCADE;

NOTIFY pgrst, 'reload schema';
