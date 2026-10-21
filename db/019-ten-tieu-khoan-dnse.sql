-- ============================================================
-- Tên tiểu khoản DNSE.
--
-- Vì sao phải lưu: màn Giao dịch chỉ hiện được dãy 10 chữ số (0001036879, 0001036880) nên không
-- ai biết tiểu khoản nào là tiểu khoản nào. Bên SHS thì có sẵn mã ngắn 00/01/06/08 và loại
-- thường/margin trong chính API đặt lệnh, còn DNSE thì không:
--   openapi.dnse.com.vn/accounts        -> chỉ id, dealAccount, derivativeAccount, derivative.status
--   openapi.dnse.com.vn/accounts/{id}   -> 404, không có endpoint chi tiết
--   gói vay (GD Tiền mặt / RocketX)     -> theo từng MÃ chứ không theo tiểu khoản, cả hai tiểu
--                                          khoản đều có đủ hai gói nên không dùng phân biệt được
-- Tên tiểu khoản (`accountTypeName`) chỉ có ở API dùng token đăng nhập mật khẩu, không phải API
-- key HMAC của đường đặt lệnh.
--
-- CÁCH LÀM, và đây là điểm cần nhớ: KHÔNG lưu token đăng nhập. api/_dnselogin.js vốn đã có token
-- trong tay một lúc để đọc hồ sơ rồi bỏ đi; giờ trong đúng khoảnh khắc đó nó đọc luôn tên các
-- tiểu khoản, và chỉ TÊN được lưu lại. Token vẫn bị bỏ như cũ, quyết định bảo mật cũ giữ nguyên.
-- Tên tiểu khoản gần như không bao giờ đổi nên lấy mỗi lần đăng nhập DNSE là quá đủ.
-- ============================================================
\set ON_ERROR_STOP on

ALTER TABLE trade.users ADD COLUMN IF NOT EXISTS dnse_sub_names jsonb;

COMMENT ON COLUMN trade.users.dnse_sub_names IS
  'Tên tiểu khoản DNSE dạng {"0001036879":"Tien mat"}. Lấy lúc đăng nhập bằng mật khẩu DNSE, chỉ để hiển thị.';

-- Chủ tài khoản đọc được tên tiểu khoản của chính mình; chính sách RLS sẵn có trên users đã giới
-- hạn theo trade.uid() nên ở đây chỉ cần mở quyền cột.
GRANT SELECT (dnse_sub_names) ON trade.users TO app_rw;

NOTIFY pgrst, 'reload schema';
