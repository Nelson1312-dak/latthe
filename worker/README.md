# Worker realtime (DNSE Broker WebSocket)

Giữ kết nối WebSocket tới DNSE cho từng khách đã ủy quyền cho môi giới, ghi sự kiện lệnh vào
`trade.order_events` và cập nhật `dnse_status` của phiếu lệnh. Chạy liên tục trên **máy local cùng DB**
(Vercel không giữ được WebSocket).

## Chạy
```
npm run worker
```
Cần Node 22 trở lên và các biến trong `.env.local`:
`DNSE_API_KEY`, `DNSE_API_SECRET`, `SUPABASE_URL` (PostgREST local, ví dụ `http://127.0.0.1:3002`), `DB_JWT_SECRET`.

## Hành vi
- Mỗi 60 giây dò lại danh sách khách (`/brokers/accounts/care-by`): mở kết nối cho khách mới, đóng kết nối của khách đã bỏ ủy quyền.
- Mỗi kết nối chỉ một `investor_id`, tự nối lại khi rớt (lùi dần 1s đến 60s), chủ động nối mới ở 7 giờ 30 phút trước mốc 8 giờ của DNSE.
- Trả `pong` cho mọi `ping` của server, tự `ping` mỗi 25 giây.
- Sự kiện trùng bị DB bỏ qua; các sự kiện của một khách được xử lý tuần tự nên trạng thái cuối cùng luôn là mới nhất.
- Giới hạn `WORKER_MAX_CONNECTIONS` (mặc định 50). Hỏi DNSE về số kết nối tối đa của gói API.
- Trạng thái ghi vào `trade.worker_status`; màn Khách hàng hiện "Realtime: n/m khách đang kết nối".


---

# Worker giá thị trường (DNSE Market Data WebSocket)

Nhận giá realtime và độ sâu sổ lệnh thật từ DNSE, ghi vào `trade.market_quotes` / `trade.market_indices` mỗi giây.
`/api/market` ưu tiên đọc từ đây; khi worker chưa chạy hoặc dữ liệu cũ hơn 20 giây thì tự dùng nến 1 phút của Entrade (trễ khoảng 1 phút, không có độ sâu).

```
npm run worker:market
```

## Chạy tự động trên Windows (khuyên dùng)

```
powershell -ExecutionPolicy Bypass -File worker\register-worker.ps1 -Name market          # worker giá
powershell -ExecutionPolicy Bypass -File worker\register-worker.ps1 -Name broker          # worker lệnh của khách
powershell -ExecutionPolicy Bypass -File worker\register-worker.ps1 -Name advisory        # AI local + ảnh chụp danh mục
powershell -ExecutionPolicy Bypass -File worker\register-worker.ps1 -Name market -Remove  # gỡ
```

- Tạo tác vụ "Latbai worker <tên>" trong Task Scheduler: chạy mỗi lần đăng nhập và nhắc lại mỗi 10 phút. Chỉ chạy khi bạn đã đăng nhập Windows, nên không lưu mật khẩu ở đâu cả.
- `worker/supervise.ps1` giữ đúng một bản worker chạy ẩn và dựng lại khi nó chết (chờ 5 giây; chết nhanh liên tiếp thì lùi dần tới 5 phút để không dồn dập gọi DNSE khi sai key).
- Log ở `worker/logs/<tên>.log` (tự cắt khi quá 1 MB, nằm trong .gitignore), không chứa key hay secret.
- Key và secret chỉ nằm trong `.env.local`. Đổi key thì sửa file đó rồi `Stop-ScheduledTask` và `Start-ScheduledTask` tác vụ tương ứng.

- Một kết nối cho cả rổ mã (DNSE cho tối đa 10 kết nối/user, 200 stream/kết nối).
- Kênh: `tick.G1`, `top_price.G1` (3 mức mua/bán với HOSE), `security_definition.G1`, `market_index.{VNINDEX,VN30,HNX,UPCOM}`.
- Giá khớp ngoài biên độ trần/sàn bị coi là dữ liệu hỏng và bị bỏ qua.
- Ghi DB lỗi thì giữ lại hàng đợi để ghi lại lần sau, không mất cập nhật.
- Cần chạy trên cùng máy với DB, giống worker broker. Hai worker dùng chung phần kết nối ở `worker/_socket.mjs`.
- Trình duyệt vẫn lấy giá bằng cách hỏi `/api/market` mỗi 2,5 giây (giây thứ 5 khi dùng nguồn dự phòng), chưa phải đẩy trực tiếp.

---

# Chạy tự động trên Windows

```
powershell -ExecutionPolicy Bypass -File worker
egister-worker.ps1 -Name market    # worker giá
powershell -ExecutionPolicy Bypass -File worker
egister-worker.ps1 -Name broker    # worker lệnh của khách
powershell -ExecutionPolicy Bypass -File worker
egister-worker.ps1 -Name market -Remove   # gỡ
```

- Tạo tác vụ "Latbai worker <tên>" trong Task Scheduler: chạy mỗi lần đăng nhập và nhắc lại mỗi 10 phút. Chỉ chạy khi bạn đã đăng nhập Windows, nên không lưu mật khẩu ở đâu cả.
- `worker/supervise.ps1` giữ đúng một bản worker chạy ẩn và dựng lại khi nó chết (chờ 5 giây; chết nhanh liên tiếp thì lùi dần tới 5 phút để không dồn dập gọi DNSE khi sai key).
- Log: `worker/logs/<tên>.log` (tự cắt khi quá 1 MB, đã nằm trong .gitignore). Log không chứa key hay secret.
- Key/secret chỉ nằm trong `.env.local`. Đổi key thì sửa file đó rồi khởi động lại tác vụ (Stop-ScheduledTask rồi Start-ScheduledTask).

---

# Worker tư vấn (`worker/advisory-worker.mjs`)

Chạy trên máy nhà, cạnh Postgres và Ollama. Hai việc:

1. **AI local**: API trên Vercel chỉ xếp việc vào bảng `trade.ai_jobs`; worker lấy việc, gọi Qwen qua Ollama ở `127.0.0.1:11434`
   (không đi qua tunnel, không ra Internet), ghi kết quả. Mọi số % trong câu trả lời được đối chiếu với dữ kiện đầu vào; số lạ được đánh dấu cho môi giới.
   Dữ kiện gửi AI chỉ có số liệu đã tính (tỷ trọng, hiệu suất, cảnh báo), không có tên, số tài khoản hay giá trị tài sản tuyệt đối của khách.
2. **Ảnh chụp danh mục**: thứ 2 đến thứ 6, sau 15:05 giờ VN, chụp tiền + danh mục của mọi khách care-by vào `trade.portfolio_snapshots`
   để tính hiệu suất thực tế. Chụp tay: `node --env-file=.env.local worker/advisory-worker.mjs --snapshot-now`.

Biến môi trường (trong `.env.local`, đều có mặc định): `ADVISORY_MODEL` (mặc định `qwen3:8b`), `ADVISORY_OLLAMA_URL` (mặc định `http://127.0.0.1:11434`), `ADVISORY_TIMEOUT_MS`.

Ollama cài bản Windows, model lưu ở `D:\ollama-models` (biến người dùng `OLLAMA_MODELS`), tự chạy khi đăng nhập. Đổi model: `ollama pull <tên>` rồi đặt `ADVISORY_MODEL` và khởi động lại tác vụ "Latbai worker advisory".
GTX 1660 SUPER 6 GB: `qwen3:8b` (khoảng 5,2 GB) vừa đủ; muốn nhanh hơn dùng `qwen3:4b`.
