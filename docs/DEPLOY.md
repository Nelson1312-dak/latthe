# Triển khai và vận hành latbai.vn

## Kiến trúc chạy thật

| Phần | Chạy ở đâu | Ghi chú |
|---|---|---|
| Giao diện + API | Vercel (một function duy nhất `api/router.js`) | Gói Hobby giới hạn 12 function, nên mọi endpoint nằm ở `server/routes/` |
| Database | Postgres + PostgREST trong Docker trên máy của bạn (`infra/docker-compose.yml`) | Vercel gọi qua tunnel ngrok → `local-proxy.js` → PostgREST (127.0.0.1:3002), luôn kèm JWT. Dữ liệu nằm ở `latthe-pgdata/` (ngoài Docker) |
| Nến giá (nguồn dự phòng) | Entrade, nhưng **đi vòng qua máy của bạn** | Vercel → tunnel → `local-proxy.js /feed` → `services.entrade.com.vn`, kèm header `x-feed-key` |
| Worker giá + worker lệnh khách | Máy của bạn (Task Scheduler) | Vercel không giữ được WebSocket |
| Sao lưu DB | Máy của bạn, 03:00 mỗi ngày | `latthe-db-backup/` (ngoài repo) |

Nếu máy tắt hoặc ngrok rớt: **cả hai nguồn giá đều đi qua máy này**, nên bảng giá sẽ hỏng chứ không còn đường lui; đăng nhập, bàn môi giới, giao dịch thử báo "hệ thống tạm gián đoạn".

### Vì sao nến giá và Open API phải đi vòng qua máy nhà

**Hai host, hai câu chuyện khác nhau — đừng gộp làm một.**

`services.entrade.com.vn` (nến giá, đăng nhập DNSE): ngày 19/10/2026, sau một lần deploy, Vercel vùng `sin1`
gọi thẳng bị treo tới hết giờ chờ 8 giây, `/api/market` và `/api/history` trả 502 suốt mấy tiếng, trong khi
máy ở nhà gọi đủ 32 mã xong trong 237ms. **Đến chiều cùng ngày thì tự hồi phục** (170ms từ chính Vercel).
Nên đây là chặn TẠM THỜI, nhiều khả năng do mỗi lần deploy là một instance mới với bộ nhớ đệm trống, request
đầu tiên bắn 32 cuộc gọi cùng lúc và bị WAF chặn một lúc. Không phải chặn theo vùng.

`openapi.dnse.com.vn` (toàn bộ bàn môi giới: care-by, số dư, danh mục, sổ lệnh, đặt lệnh): đo năm lần liên
tiếp từ Vercel `sin1`, **lần nào cũng treo đủ 8 giây**, trong khi máy ở nhà gọi bình thường. Đây là chặn
thường trực. Không đi vòng thì bàn môi giới không chạy được trên Vercel, chấm hết.

Ba thay đổi:
- `local-proxy.js` có thêm đường `/feed/*`, dựng lại request từ các tham số đã lọc (kind, symbol, from, to,
  resolution) rồi gọi Entrade bằng IP Việt Nam của máy này. Khóa riêng `FEED_KEY`, không dùng chung với
  `PROXY_KEY` của Ollama. Proxy không chuyển tiếp URL nguyên văn nên không thành proxy mở.
- `api/_market.js` giữ tối đa 6 request đang bay tới nguồn giá, phần còn lại xếp hàng; và sau 5 lần nguồn
  **không trả lời** liên tiếp thì ngắt mạch 30 giây để API hỏng ngay thay vì treo 8 giây mỗi lần. Nguồn trả
  400 vì mã không tồn tại không tính vào ngắt mạch.
- `local-proxy.js` có thêm đường `/dnse/*` chuyển tiếp tới `openapi.dnse.com.vn`, khóa riêng `RELAY_KEY`.
  Khác `/feed`, đây là cả một REST API nên không dựng lại được từ tham số đã lọc; bù lại siết ba lớp: đích
  đến đóng cứng, chỉ các nhánh `/accounts /brokers /price /registration` với GET/POST/DELETE, và chỉ chuyển
  tiếp đúng các header của chữ ký. DNSE vẫn tự kiểm HMAC nên không có API secret thì có khóa relay cũng
  không ký nổi request mới. Trên Vercel đặt `DNSE_BASE_URL` + `DNSE_RELAY_KEY`; ở máy nhà để trống cả hai.

## Dựng (hoặc dựng lại) backend và database

```
powershell -ExecutionPolicy Bypass -File infra\setup-stack.ps1
```
Chạy lại nhiều lần đều an toàn. Script:
1. tạo `..\latthe-secrets\stack.env` một lần (mật khẩu DB ngẫu nhiên, chỉ tài khoản Windows của bạn đọc được; JWT lấy từ `DB_JWT_SECRET` trong `.env.local`);
2. dựng Postgres (`postgres_latthe`) và PostgREST (`postgrest_trade`), chỉ lắng nghe `127.0.0.1`, log bị giới hạn;
3. nếu DB trống thì áp dụng `db/001`, `004`–`015` (`002`/`003` chỉ dọn bảng RAG cũ nên bỏ qua);
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
| `PRICE_FEED_URL` | `https://<tên-ngrok>/feed` | bảng giá, lịch sử giá, hiệu suất danh mục |
| `PRICE_FEED_KEY` | `FEED_KEY` trong `.env.local` | như trên |
| `DNSE_BASE_URL` | `https://<tên-ngrok>/dnse` | **bắt buộc** — cả bàn môi giới và cổng khách |
| `DNSE_RELAY_KEY` | `RELAY_KEY` trong `.env.local` | như trên |
| `SESSION_SECRET` | `.env.local` | đăng nhập |
| `BROKER_OWNER_USERNAME` | tên đăng nhập của bạn trên latbai.vn (đăng ký trước) | bàn môi giới, kết nối công ty chứng khoán |
| `DNSE_LOGIN_CUSTODY` | số lưu ký DNSE của bạn (nhiều số cách nhau bằng dấu phẩy) | nút **Đăng nhập bằng DNSE**; các tài khoản này đồng thời là chủ hệ thống |
| `DNSE_API_KEY`, `DNSE_API_SECRET` | EntradeX → LightSpeed API | bàn môi giới, cổng khách (xem tài sản) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console (bên dưới) | đăng nhập Google |
| `DNSE_REAL_TRADING=1` | chỉ đặt khi sẵn sàng gửi lệnh thật | gửi/hủy lệnh thật |
| `DNSE_MAX_ORDER_VND` | tùy chọn, mặc định 20.000.000 | trần giá trị **mỗi lệnh** |
| `DNSE_MAX_ORDERS_PER_DAY` | tùy chọn, mặc định 20 | trần **số lệnh mỗi ngày** cho từng tiểu khoản |
| `DNSE_MAX_DAILY_VND` | tùy chọn, mặc định 100.000.000 | trần **giá trị đặt mỗi ngày** cho từng tiểu khoản |
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
6. **Gửi lệnh thật** (sau khi đã thử kỹ): chạy lại bước 3 với thêm `-EnableRealTrading`. Lệnh đầu tiên nên là 100 cổ phiếu ở giá sàn rồi hủy ngay. Hạn mức mỗi lệnh mặc định 20 triệu (`DNSE_MAX_ORDER_VND`), thêm trần ngày 20 lệnh / 100 triệu cho từng tiểu khoản.

   **Kiểm tra công tắc đang bật hay tắt:** `https://latbai.vn/api/health` → `config.realTrading`. Đang bật mà
   `trade.dnse_audit` chưa có dòng nào nghĩa là đường gửi lệnh thật chưa chạy lần nào — hãy làm bài thử 100 cổ
   phiếu ở trên trước, hoặc tắt công tắc lại cho tới lúc làm:
   ```
   vercel env rm DNSE_REAL_TRADING production --yes
   vercel --prod
   ```

## Vận hành hằng ngày

- **Worker giá**: `worker/README.md`. Kiểm tra: thanh trạng thái dưới cùng của trang giao dịch ghi "DNSE realtime" trong phiên.
- **Sao lưu**: tự chạy 03:00. Chạy tay: `powershell -ExecutionPolicy Bypass -File db\backup.ps1`. Mỗi bản được kiểm tra đọc lại được trước khi giữ; bản lỗi bị xóa. Hệ thống **không** tự xóa bản cũ, bạn dọn tay khi cần.

  Có **hai loại bản lưu**, cố ý tách rời:
  | Tệp | Nội dung | Nhịp |
  |---|---|---|
  | `latthe-<lúc>.dump` | Toàn bộ DB **trừ dữ liệu băng lệnh** | mỗi đêm, nhỏ |
  | `tape/tape-<YYYYMMDD>.dump` | Một phiên của `trade.tape` + `trade.depth_log` | **ghi một lần rồi thôi** |

  Lý do: hai bảng băng lệnh lớn dần không giới hạn. Nếu để chúng nằm trong bản dump toàn bộ mỗi đêm thì bản thứ N
  chứa lại cả N ngày lịch sử. Đo ở rổ 150 mã: khoảng 16 MB mỗi phiên sau khi nén → **bản dump đêm sẽ đạt ~500 GB
  trong năm đầu**, trong khi lưu từng ngày một lần chỉ tốn **~4 GB**. Ngày nào chưa có tệp sẽ được bù ở lần chạy sau,
  nên một ngày máy tắt không bị mất.

- **Dọn dữ liệu băng lệnh cũ**: dữ liệu thô chỉ cần giữ một thời gian (bản tổng hợp theo ngày mới giữ lâu dài).
  `select trade.drop_old_tape_partitions(90);` — xoá nguyên phân vùng nên tức thì. Hàm từ chối nếu đòi giữ dưới 30 ngày.
- **Khôi phục thử**: `docker exec -i postgres_latthe pg_restore -U postgres -d <db-tạm> --no-owner < <tập .dump>`. Luôn khôi phục vào DB tạm để kiểm tra trước, không ghi đè DB thật.
- **Đổi key DNSE**: sửa `.env.local`, khởi động lại tác vụ `Latbai worker market`, rồi chạy lại `push-env.ps1 -IncludeDnse`.
