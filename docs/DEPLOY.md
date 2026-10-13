# Triển khai và vận hành latbai.vn

## Kiến trúc chạy thật

| Phần | Chạy ở đâu | Ghi chú |
|---|---|---|
| Giao diện + API | Vercel (một function duy nhất `api/router.js`) | Gói Hobby giới hạn 12 function, nên mọi endpoint nằm ở `server/routes/` |
| Database | Postgres + PostgREST trong Docker trên máy của bạn (`infra/docker-compose.yml`) | Vercel gọi qua tunnel ngrok → `local-proxy.js` → PostgREST (127.0.0.1:3002), luôn kèm JWT. Dữ liệu nằm ở `latthe-pgdata/` (ngoài Docker) |
| Worker giá + worker lệnh khách | Máy của bạn (Task Scheduler) | Vercel không giữ được WebSocket |
| Sao lưu DB | Máy của bạn, 03:00 mỗi ngày | `latthe-db-backup/` (ngoài repo) |

Nếu máy tắt hoặc ngrok rớt: giá quay về nguồn dự phòng (trễ khoảng 1 phút), còn đăng nhập, bàn môi giới, giao dịch thử báo "hệ thống tạm gián đoạn".

## Dựng (hoặc dựng lại) backend và database

```
powershell -ExecutionPolicy Bypass -File infra\setup-stack.ps1
```
Chạy lại nhiều lần đều an toàn. Script:
1. tạo `..\latthe-secrets\stack.env` một lần (mật khẩu DB ngẫu nhiên, chỉ tài khoản Windows của bạn đọc được; JWT lấy từ `DB_JWT_SECRET` trong `.env.local`);
2. dựng Postgres (`postgres_latthe`) và PostgREST (`postgrest_trade`), chỉ lắng nghe `127.0.0.1`, log bị giới hạn;
3. nếu DB trống thì áp dụng `db/001`, `004`–`011` (`002`/`003` chỉ dọn bảng RAG cũ nên bỏ qua);
4. kiểm tra API bằng `deploy/check-local-db.mjs` (không token 401, token giả 401, token hợp lệ 200, bảng cũ không lộ).

Dữ liệu Postgres nằm ở `D:\Claude projects\Project\latthe-pgdata`, **ngoài Docker**, nên xóa hoặc dựng lại Docker không mất dữ liệu.
Muốn nạp lại từ một bản sao lưu vào DB trống: xóa thư mục `latthe-pgdata` (khi container đã dừng), rồi chạy
`infra\setup-stack.ps1 -Restore "D:\Claude projects\Project\latthe-db-backup\<tệp>.dump"` (chỉ nạp dữ liệu schema `trade`).

## Cập nhật thông tin cơ bản các mã (mỗi quý)

Chỉ số tài chính đổi theo quý. Khi cần làm mới:
1. Nhờ Claude chạy lại bộ công cụ DNSE (`company_get_profile`, `financial_get_index`) cho danh mục đang theo dõi và cập nhật
   `data/symbol-facts.json`.
2. `node --env-file=.env.local db/import-facts.mjs --check` để kiểm tra, rồi bỏ `--check` để nạp vào DB.
3. `node --env-file=.env.local worker/advisory-worker.mjs --knowledge-now` để AI viết lại bản tóm tắt (khoảng 30 giây mỗi mã).

Giá và chỉ báo kỹ thuật thì worker tự cập nhật mỗi phiên, không cần làm gì.

## Danh sách biến môi trường trên Vercel

| Biến | Lấy ở đâu | Bắt buộc cho |
|---|---|---|
| `SUPABASE_URL` | `https://<tên-ngrok>/postgrest` (không phải 127.0.0.1) | mọi tính năng cần DB |
| `DB_JWT_SECRET` | `.env.local` | mọi tính năng cần DB |
| `SESSION_SECRET` | `.env.local` | đăng nhập |
| `BROKER_OWNER_USERNAME` | tên đăng nhập của bạn trên latbai.vn (đăng ký trước) | bàn môi giới, kết nối công ty chứng khoán |
| `DNSE_LOGIN_CUSTODY` | số lưu ký DNSE của bạn (nhiều số cách nhau bằng dấu phẩy) | nút **Đăng nhập bằng DNSE**; các tài khoản này đồng thời là chủ hệ thống |
| `DNSE_API_KEY`, `DNSE_API_SECRET` | EntradeX → LightSpeed API | bàn môi giới, cổng khách (xem tài sản) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console (bên dưới) | đăng nhập Google |
| `DNSE_REAL_TRADING=1` | chỉ đặt khi sẵn sàng gửi lệnh thật | gửi/hủy lệnh thật |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | tùy chọn (upstash.com, gói miễn phí) | giới hạn tần suất đăng nhập dùng chung giữa các instance |

## Các bước

1. **Cách xác định chủ hệ thống** (chọn một hoặc cả hai):
   - **Đăng nhập bằng DNSE (khuyên dùng):** chỉ cần số lưu ký của bạn. Điền vào `-DnseCustody` ở bước 3, rồi vào latbai.vn bấm *Đăng nhập → Đăng nhập bằng tài khoản DNSE*. Mật khẩu chỉ gửi tới DNSE để xác minh, không lưu.
   - **Tên đăng nhập Lật Bài:** đăng ký tài khoản rồi dùng tên đó làm `-Owner` (`BROKER_OWNER_USERNAME`).
2. **Đăng nhập Vercel CLI** (một lần): `vercel login`.
3. **Đẩy biến lên Vercel**, thay `<tên>` bằng tên đăng nhập của bạn:
   ```
   powershell -ExecutionPolicy Bypass -File deploy\push-env.ps1 -DnseCustody <số lưu ký> -IncludeDnse -DryRun   # xem trước
   powershell -ExecutionPolicy Bypass -File deploy\push-env.ps1 -DnseCustody <số lưu ký> -IncludeDnse
   ```
   Biến chỉ áp dụng cho bản deploy mới: chạy `vercel --prod` hoặc đẩy một commit.
4. **Kiểm tra**: mở `https://latbai.vn/api/health`. `ok: true` nghĩa là database và đăng nhập sẵn sàng; các cờ `google`, `dnse`, `brokerOwner`, `realTrading` cho biết nhóm nào đã bật (kể cả `dnseLogin`).
5. **Đăng nhập Google** (tùy chọn): Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → loại *Web application*. Thêm **Authorized redirect URI** đúng bằng `https://latbai.vn/api/auth/google-callback`. Lấy Client ID và Secret dán vào `.env.local`, rồi chạy lại bước 3 với `-IncludeGoogle`.
6. **Gửi lệnh thật** (sau khi đã thử kỹ): chạy lại bước 3 với thêm `-EnableRealTrading`. Lệnh đầu tiên nên là 100 cổ phiếu ở giá sàn rồi hủy ngay. Hạn mức mỗi lệnh mặc định 20 triệu (`DNSE_MAX_ORDER_VND`).

## Vận hành hằng ngày

- **Worker giá**: `worker/README.md`. Kiểm tra: thanh trạng thái dưới cùng của trang giao dịch ghi "DNSE realtime" trong phiên.
- **Sao lưu**: tự chạy 03:00. Chạy tay: `powershell -ExecutionPolicy Bypass -File db\backup.ps1`. Mỗi bản được kiểm tra đọc lại được trước khi giữ; bản lỗi bị xóa. Hệ thống **không** tự xóa bản cũ (khoảng 1,5 MB mỗi ngày), bạn dọn tay khi cần.
- **Khôi phục thử**: `docker exec -i postgres_latthe pg_restore -U postgres -d <db-tạm> --no-owner < <tập .dump>`. Luôn khôi phục vào DB tạm để kiểm tra trước, không ghi đè DB thật.
- **Đổi key DNSE**: sửa `.env.local`, khởi động lại tác vụ `Latbai worker market`, rồi chạy lại `push-env.ps1 -IncludeDnse`.
