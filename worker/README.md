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

## Tự khởi động cùng Windows
Tạo tác vụ trong Task Scheduler: Trigger "At log on", Action `node`, Arguments
`--env-file=.env.local worker/broker-stream.mjs`, Start in `D:\Claude projects\Project\latthe`, bật "Restart on failure".

---

# Worker giá thị trường (DNSE Market Data WebSocket)

Nhận giá realtime và độ sâu sổ lệnh thật từ DNSE, ghi vào `trade.market_quotes` / `trade.market_indices` mỗi giây.
`/api/market` ưu tiên đọc từ đây; khi worker chưa chạy hoặc dữ liệu cũ hơn 20 giây thì tự dùng nến 1 phút của Entrade (trễ khoảng 1 phút, không có độ sâu).

```
npm run worker:market
```

- Một kết nối cho cả rổ mã (DNSE cho tối đa 10 kết nối/user, 200 stream/kết nối).
- Kênh: `tick.G1`, `top_price.G1` (3 mức mua/bán với HOSE), `security_definition.G1`, `market_index.{VNINDEX,VN30,HNX,UPCOM}`.
- Giá khớp ngoài biên độ trần/sàn bị coi là dữ liệu hỏng và bị bỏ qua.
- Ghi DB lỗi thì giữ lại hàng đợi để ghi lại lần sau, không mất cập nhật.
- Cần chạy trên cùng máy với DB, giống worker broker. Hai worker dùng chung phần kết nối ở `worker/_socket.mjs`.
- Trình duyệt vẫn lấy giá bằng cách hỏi `/api/market` mỗi 2,5 giây (giây thứ 5 khi dùng nguồn dự phòng), chưa phải đẩy trực tiếp.
