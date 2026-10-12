# Lật Bài — Kiến trúc nền tảng môi giới (tư vấn + đặt lệnh cho khách hàng)

Cập nhật: 12/10/2026

## 1. Mục tiêu

Lật Bài là bàn làm việc của **môi giới/SACO tại DNSE**:

- Xem danh sách khách hàng đang quản lý, tài sản và danh mục từng khách.
- Gửi khuyến nghị và đề xuất lệnh, khách xác nhận ngay trong ứng dụng.
- Đặt lệnh trên tài khoản khách **khi khách đã ủy quyền giao dịch**, kèm bằng chứng chỉ thị của khách.
- Theo dõi lệnh và vị thế của khách theo thời gian thực.

Khách hàng có cổng riêng để xem khuyến nghị, xác nhận lệnh và theo dõi danh mục.

## 2. Nền tảng pháp lý và kỹ thuật: cơ chế Broker của DNSE OpenAPI

Nguồn: https://developers.dnse.com.vn/docs/guide/broker

- Môi giới dùng **API key của chính mình** (dịch vụ LightSpeed API) và phải được DNSE xác nhận là môi giới/SACO chính thức.
- Khách **tự liên kết** với môi giới trên App/Web Entrade X và chọn phạm vi ủy quyền. Lật Bài không tạo hay hủy liên kết, không bao giờ nhận mật khẩu của khách.
- `GET /brokers/accounts/care-by` trả danh sách tiểu khoản thuộc phạm vi quản lý, kèm `permissions[]` theo từng sản phẩm:
  - `ADVISOR`: chỉ xem và theo dõi tài sản.
  - `BROKER`: được giao dịch, xem và quản lý tài sản.
- Mọi thao tác khác dùng các endpoint chuẩn (`/accounts/{accountNo}/balances`, `/positions`, `/orders`, `POST /accounts/orders`...) với `accountNo` của khách. DNSE tự kiểm tra ủy quyền phía họ.
- Đặt lệnh cần trading token từ **OTP của môi giới** (8 giờ).
- Realtime: `wss://ws-openapi.dnse.com.vn`, kênh `order.broker.{STOCK|DERIVATIVE}.{investor_id}.{json|msgpack}`. **Mỗi kết nối chỉ một investor_id**, tối đa 8 giờ, ping mỗi 3 phút, phải pong trong 1 phút.
- Rate limit theo API key: Get Accounts 1.000/giờ, Balance/Positions 10.000/giờ, Place Order 50.000/giờ, Create Trading Token 100/giờ. Vượt giờ trả 429, vượt ngày trả 403 `OA-401`.

### Kiểm soát tuân thủ (cần DNSE/pháp chế xác nhận)

Quy định cho nhân viên môi giới nhìn chung yêu cầu lệnh xuất phát từ **chỉ thị của khách** và cấm môi giới tự quyết định thay khách. Vì vậy hệ thống ghi lại nguồn chỉ thị cho mọi lệnh đặt trên tài khoản khách:

- `app`: khách bấm xác nhận trong Lật Bài (bằng chứng mạnh nhất, là mặc định).
- `phone`, `chat`, `in_person`: môi giới ghi nhận chỉ thị kèm thời điểm và ghi chú.

Mọi lệnh và mọi lần gửi đều nằm trong nhật ký kiểm toán không sửa được từ ứng dụng.

## 3. Sơ đồ thành phần

> **Giới hạn Vercel Hobby: tối đa 12 serverless function mỗi lần deploy, và mỗi file trong `api/` là một function.**
> Toàn bộ API vì vậy chạy qua MỘT function duy nhất `api/router.js`; các endpoint nằm ở `server/routes/` và được
> đăng ký trong bảng ROUTES. `vercel.json` viết lại `/api/<đường dẫn>` thành `/api/router?p=<đường dẫn>`.
> Không đặt file handler mới trực tiếp vào `api/` (file bắt đầu bằng `_` là helper, không tính là function).

```
Trình duyệt (môi giới / khách)
   │  HTTPS, cookie phiên HttpOnly
   ▼
Lật Bài Web (static)  ──►  Lật Bài API (Node)  ──HMAC──►  DNSE OpenAPI (openapi.dnse.com.vn)
                              │   ▲
                              │   │ đọc sự kiện
                              ▼   │
                        Postgres (local) ◄──── Realtime Worker ◄──WebSocket── wss://ws-openapi.dnse.com.vn
```

| Thành phần | Vai trò | Chạy ở đâu |
|---|---|---|
| Web | Giao diện môi giới + cổng khách hàng + bảng giá | Vercel (static) |
| API | Xác thực, phân quyền, nghiệp vụ, gọi DNSE bằng API key của môi giới | Hiện tại: Vercel Functions. Đích: máy chủ local cùng chỗ với DB |
| Postgres | Người dùng, khách, khuyến nghị, phiếu lệnh, sự kiện lệnh, kiểm toán | Máy local (Docker) |
| Realtime Worker | Giữ kết nối WebSocket theo từng khách, ghi sự kiện lệnh/vị thế vào DB | Máy local, chạy liên tục |

Vì sao cần worker riêng: serverless không giữ được WebSocket; DNSE giới hạn mỗi kết nối một khách và ngắt sau 8 giờ, nên cần tiến trình quản lý pool kết nối, tự nối lại và trả pong.

Đề xuất hạ tầng: chuyển API sang chạy chung máy với DB và worker (một tiến trình Node), mở ra ngoài bằng Cloudflare Tunnel thay ngrok. Vercel chỉ phục vụ file tĩnh. Giảm một chặng mạng, không phải mở DB ra internet nữa.

## 4. Vai trò và phân quyền

| Vai trò | Ai | Được làm |
|---|---|---|
| `broker` | Môi giới (bạn) | Xem mọi khách trong care-by; tạo khuyến nghị; tạo và gửi phiếu lệnh cho khách có quyền `BROKER` |
| `client` | Khách đã liên kết tài khoản Lật Bài với investorId | Xem khuyến nghị gửi cho mình, xác nhận/từ chối phiếu lệnh, xem danh mục của mình |
| `user` | Người dùng thường | Bảng giá, cộng đồng, giao dịch thử |

Khách liên kết thế nào: môi giới tạo **link mời một lần** cho một khách cụ thể (gắn investorId), gửi qua Zalo/SMS. Khách đăng nhập Lật Bài (Google hoặc tài khoản riêng) rồi chấp nhận lời mời, từ đó tài khoản Lật Bài đó là `client` của investorId này. Lật Bài không xác thực khách qua DNSE vì không có API cho việc đó, nên link mời là ranh giới tin cậy: một lần, có hạn 72 giờ, chỉ môi giới tạo được.

## 5. Luồng chính

### 5.1 Phiếu lệnh (đặt lệnh cho khách)

```
draft ──(gửi khách duyệt)──► pending_client ──(khách xác nhận)──► approved ──(môi giới gửi)──► sent
  │                                │                                                  │
  │                                └──(khách từ chối / quá hạn)──► rejected / expired  └──► failed
  └──(môi giới ghi nhận chỉ thị phone/chat/in_person)──► approved
```

Kiểm tra trước khi gửi, theo thứ tự:
1. Môi giới đã đăng nhập và là `broker`.
2. Tiểu khoản nằm trong care-by và có `role = BROKER` cho `UNDERLYING_STOCK` (kiểm tra lại ngay lúc gửi, không dùng bản cache).
3. Phiếu ở trạng thái `approved`, còn hạn (phiếu do khách duyệt hết hạn sau 15 phút để giá không lệch).
4. Giá nằm trong trần/sàn lấy từ `secdef` tại thời điểm gửi; giá trị lệnh không vượt hạn mức.
5. Có trading token (OTP môi giới) còn hạn.
6. Ghi nhật ký với nonce duy nhất trước khi gọi DNSE, cập nhật kết quả sau.

### 5.2 Khuyến nghị

Môi giới tạo khuyến nghị (mã, chiều, vùng giá, mục tiêu, cắt lỗ, luận điểm, thời hạn) và gửi cho danh sách khách. Khách thấy trong cổng của mình; từ khuyến nghị khách có thể bấm "Muốn đặt lệnh", tạo phiếu lệnh ở trạng thái `pending_broker` để môi giới hoàn tất. Hệ thống ghi nhận kết quả khuyến nghị theo giá thật để đo hiệu quả.

### 5.3 Realtime

Worker đọc danh sách khách có liên kết, mở một kết nối WebSocket mỗi khách (kênh order + position), lưu sự kiện vào `trade.order_events`, đồng bộ trạng thái phiếu lệnh theo `id` lệnh DNSE. Giao diện đọc qua API (poll ngắn hoặc SSE).

### 5.4 Tư vấn danh mục, tái phân bổ, AI local
- **Danh mục mẫu** (`model_portfolios`, `model_weights`): môi giới tạo theo mức rủi ro (Thận trọng, Cân bằng, Tăng trưởng, Mạo hiểm), tỷ trọng cổ phiếu + tiền mặt = 100%, kèm ngưỡng lệch.
- **Khẩu vị rủi ro** (`client_profiles`): khách tự trả lời 7 câu trong cổng khách hàng (chấm điểm ở máy chủ, `api/_risk.js`), hoặc môi giới đặt. Hệ thống cảnh báo khi danh mục mẫu rủi ro cao hơn khẩu vị.
- **Hiệu suất** (`api/_portfolio.js`): (a) danh mục hiện tại giữ nguyên trong quá khứ (có ngay, là giả định), (b) thực tế từ ảnh chụp cuối ngày `portfolio_snapshots` (tính theo cổ phiếu nắm giữ nên nạp/rút tiền không làm sai), (c) danh mục mẫu. So với VN-Index theo kỳ 1T/3T/6T/YTD/1N, biến động, sụt giảm tối đa, beta. Giá lịch sử tự điều chỉnh các bước nhảy ngoài biên độ (quyền, chia tách).
- **Tái phân bổ** (`api/_rebalance.js`): đưa danh mục về tỷ trọng mục tiêu, bỏ qua mã lệch ít hơn ngưỡng, bán trước mua sau, không dùng thêm ký quỹ, lô 100, chỉ bán phần đã về, chia lệnh theo hạn mức. Đề xuất thành **phiếu lệnh nguồn "app"**: khách xác nhận trong cổng, môi giới gửi lệnh như luồng 5.1.
- **AI local**: Vercel xếp việc vào `ai_jobs`; worker trên máy nhà gọi Qwen (Ollama). AI chỉ diễn giải số liệu hệ thống đã tính, viết bản nháp cho môi giới, không gửi thẳng cho khách. Số % lạ trong câu trả lời bị đánh dấu.
- Phân quyền: môi giới đọc ảnh chụp bằng `app_worker` sau khi đã `assertOwner` + kiểm tra care-by trong code (khách care-by chưa chắc có tài khoản Lật Bài); khách chỉ đọc dữ liệu tiểu khoản đã liên kết qua RLS.

## 6. Dữ liệu (schema `trade`)

| Bảng | Nội dung |
|---|---|
| `users` | Tài khoản Lật Bài (mật khẩu hoặc Google), `role` thêm `broker` |
| `client_links` | user_id ↔ investor_id, account_no, broker_user_id |
| `client_invites` | Link mời một lần: token băm, investor_id, hạn, đã dùng |
| `advice` | Khuyến nghị của môi giới |
| `advice_recipients` | Khuyến nghị gửi cho khách nào, đã xem chưa |
| `order_tickets` | Phiếu lệnh: khách, lệnh, trạng thái, nguồn chỉ thị, người duyệt, thời điểm, id lệnh DNSE |
| `order_events` | Sự kiện lệnh/vị thế từ WebSocket |
| `dnse_audit` | Nhật ký mọi lần gửi/hủy lên DNSE (đã có) |

RLS: môi giới chỉ thấy dữ liệu khách của mình; khách chỉ thấy dữ liệu gắn với investor_id của mình.

## 7. Bảo mật

- API key/secret của môi giới chỉ nằm ở biến môi trường máy chủ.
- Trading token nằm trong cookie HttpOnly mã hóa, gắn với user môi giới.
- Mật khẩu của khách tại DNSE không bao giờ đi qua Lật Bài.
- Đặt lệnh thật có công tắc tổng `DNSE_REAL_TRADING`, hạn mức mỗi lệnh `DNSE_MAX_ORDER_VND`, và hạn mức theo ngày cho từng khách.
- Mọi request ghi lên DNSE đều có nhật ký kiểm toán.

## 8. Lộ trình

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 1 | Danh sách khách (care-by), tài sản từng khách, phiếu lệnh + gửi lệnh có kiểm tra quyền, nhật ký | Xong |
| 2 | Cổng khách: link mời, khách xác nhận phiếu lệnh, khuyến nghị, xem tài sản | Xong |
| 3 | Worker realtime (WebSocket broker), đồng bộ trạng thái lệnh | Xong, chưa chạy với DNSE thật |
| 3b | Worker giá thị trường (WebSocket): giá realtime, độ sâu sổ lệnh, chỉ số, độ rộng thị trường | Xong, chưa chạy với DNSE thật |
| 4 | Bảng giá toàn thị trường, heatmap ngành, thông tin thị trường | Chưa làm |
| 5 | Chuyển API về máy local cùng DB, Cloudflare Tunnel | Chưa làm |

## 9. Thay đổi so với bản trước

- Bỏ hướng đăng nhập SHS cho nhiều người dùng: tài liệu SHS hiện có không có đặt lệnh, và mô hình hứng mật khẩu khách không phù hợp. Kết nối SHS giữ ở mức chỉ xem cho riêng chủ hệ thống.
- DNSE chuyển từ "tài khoản của riêng chủ" sang "tài khoản môi giới + khách ủy quyền".
- Giao dịch thử bằng tiền ảo giữ lại cho người dùng chưa phải khách.
