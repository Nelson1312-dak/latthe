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
  │                                │                                              │     ▲
  │                                │                                              │     │(đối soát: có lệnh)
  │                                └──(khách từ chối / quá hạn)──► rejected/expired│   unknown
  │                                                                                │     │(đối soát: sổ lệnh trống)
  └──(môi giới ghi nhận chỉ thị phone/chat/in_person)──► approved                  └──► failed ◄┘
```

Kiểm tra trước khi gửi, theo thứ tự:
1. Môi giới đã đăng nhập và là `broker`.
2. Tiểu khoản nằm trong care-by và có `role = BROKER` cho `UNDERLYING_STOCK` (kiểm tra lại ngay lúc gửi, không dùng bản cache).
3. Phiếu ở trạng thái `approved`, còn hạn (phiếu do khách duyệt hết hạn sau 15 phút để giá không lệch).
4. Giá nằm trong trần/sàn lấy từ `secdef` tại thời điểm gửi; giá trị lệnh không vượt hạn mức mỗi lệnh.
5. Tiểu khoản chưa chạm trần ngày (số lệnh và tổng giá trị, xem mục 7). Kiểm **trước** khi khóa phiếu, nên bị chặn thì phiếu vẫn ở `approved` để gửi lại sau.
6. Có trading token (OTP môi giới) còn hạn.
7. Ghi nhật ký với nonce duy nhất trước khi gọi DNSE, cập nhật kết quả sau.

**Gửi xong có BA kết quả, không phải hai.** Hết 12 giây chờ hoặc DNSE trả 5xx thì request đã rời đi và
lệnh VẪN có thể đang nằm trên sàn — ghi `failed` lúc đó là nói dối màn hình, và hậu quả thật là môi giới
tạo phiếu mới rồi khách khớp gấp đôi.

| Kết quả | Trạng thái | Nghĩa là |
|---|---|---|
| DNSE trả lời và nhận | `sent` | có `dnse_order_id` |
| DNSE trả lời và từ chối (4xx, 429, 401) | `failed` | chắc chắn không có lệnh nào trên sàn |
| Không có câu trả lời dứt khoát (hết giờ chờ, DNSE 5xx) | `unknown` | **phải đối soát**, tuyệt đối không gửi lại |

Đối soát phiếu `unknown`: `POST /api/broker/tickets {action:'reconcile', id}` đọc sổ lệnh của khách từ DNSE và
liệt kê lệnh trùng mã + chiều + khối lượng; `{action:'resolve', id, dnseOrderId?}` chốt lại (`sent` với số hiệu
môi giới chọn, hoặc `failed` nếu sổ lệnh không có gì). Hệ thống **không tự ghép**: một lệnh trùng mô tả có thể là
lệnh môi giới đặt thẳng trên EntradeX, nên người quyết định phải là môi giới.

### 5.2 Khuyến nghị

Môi giới tạo khuyến nghị (mã, chiều, vùng giá, mục tiêu, cắt lỗ, luận điểm, thời hạn) và gửi cho danh sách khách. Khách thấy trong cổng của mình; từ khuyến nghị khách có thể bấm "Muốn đặt lệnh", tạo phiếu lệnh ở trạng thái `pending_broker` để môi giới hoàn tất. Hệ thống ghi nhận kết quả khuyến nghị theo giá thật để đo hiệu quả.

### 5.3 Realtime

Worker đọc danh sách khách có liên kết, mở một kết nối WebSocket mỗi khách (kênh order + position), lưu sự kiện vào `trade.order_events`, đồng bộ trạng thái phiếu lệnh theo `id` lệnh DNSE. Giao diện đọc qua API (poll ngắn hoặc SSE).

### 5.3b Băng lệnh và sổ lệnh theo thời gian (nền cho phần bóc tách dòng tiền)

Khác với `market_quotes` (một dòng mỗi mã, ghi đè liên tục), `trade.tape` và `trade.depth_log` **giữ lịch sử**.
Dữ liệu này không mua lại được: API lịch sử của DNSE chỉ có nến OHLCV, nên phiên nào không ghi là mất hẳn.

- **Rổ ghi**: 150 mã lớn nhất HOSE+HNX (`data/tape-universe.json`) = 97,9% giá trị giao dịch toàn thị trường.
  Danh sách này tách khỏi `UNIVERSE` của giao diện và luôn bao trọn `UNIVERSE`.
- **Chia bảng theo ngày (UTC)**: phiên Việt Nam nằm gọn trong 02:00–08:00 UTC nên một ngày UTC = một phiên.
  Dọn dữ liệu cũ bằng `DROP` phân vùng, và **sao lưu được từng ngày một lần rồi thôi** (xem `docs/DEPLOY.md`).
- **Giới hạn DNSE (đo thật 13/10/2026, hạng `normalUser`)**: mỗi kết nối tối đa **200 cặp (kênh × mã)** —
  không phải 200 mã. 65 mã × 3 kênh + 4 chỉ số = 199 thì được, 66 mã × 3 kênh = 202 thì bị từ chối.
  Giữ được ít nhất 8 kết nối đồng thời. `shardChannels()` chia rổ cho nhiều kết nối; 150 mã × 2 kênh + 4 chỉ số
  = 304 cặp → 2 kết nối.
  Khi tự đo lại: DNSE trả `subscribed` **riêng cho từng kênh** và vẫn trả `subscribed` cho phần hợp lệ rồi mới
  báo `error` cho phần vượt hạn — đóng kết nối ngay khi thấy `subscribed` đầu tiên sẽ cho kết quả sai.
- **Không dùng kênh `security_definition`**: cả phiên 13/10 nó gửi đúng 0 bản tin nhưng chiếm một phần ba hạn mức.
  Giá tham chiếu/trần/sàn vẫn lấy từ nến ngày qua `api/_market.js limits()`.
- **DNSE gửi ảnh chụp gộp, không phải từng lệnh khớp** (khoảng 1 bản tin / 8,5 giây / mã). Vì vậy mỗi dòng giữ
  cả `match_qty` (khối lượng DNSE báo) lẫn `vol_delta` (chênh khối lượng luỹ kế = khối lượng **thật**).
  **Mọi thống kê dòng tiền phải dùng `vol_delta`.** Tỷ lệ `vol_delta / match_qty` chính là mức gộp; worker tự tính
  liên tục (`mucGop` trong `worker_status`), và `worker/do-gop-tin.mjs` phân tích chi tiết theo mã.
  Hệ quả: **không tách được dòng tiền theo quy mô lệnh** (tiền lớn / tiền nhỏ), và lệnh kê–rút dưới ~5 giây là vô hình.
- `side` ('M' mua chủ động / 'B' bán chủ động / '?') suy từ giá khớp so với `bid1`/`ask1`. Hai giá này được **lưu thô**
  chứ không chỉ lưu kết luận, để sau này đổi cách suy luận còn tính lại được trên dữ liệu cũ.

### 5.4 Tư vấn danh mục, tái phân bổ, AI local
- **Danh mục mẫu** (`model_portfolios`, `model_weights`): môi giới tạo theo mức rủi ro (Thận trọng, Cân bằng, Tăng trưởng, Mạo hiểm), tỷ trọng cổ phiếu + tiền mặt = 100%, kèm ngưỡng lệch.
- **Khẩu vị rủi ro** (`client_profiles`): khách tự trả lời 7 câu trong cổng khách hàng (chấm điểm ở máy chủ, `api/_risk.js`), hoặc môi giới đặt. Hệ thống cảnh báo khi danh mục mẫu rủi ro cao hơn khẩu vị.
- **Hiệu suất** (`api/_portfolio.js`): (a) danh mục hiện tại giữ nguyên trong quá khứ (có ngay, là giả định), (b) thực tế từ ảnh chụp cuối ngày `portfolio_snapshots` (tính theo cổ phiếu nắm giữ nên nạp/rút tiền không làm sai), (c) danh mục mẫu. So với VN-Index theo kỳ 1T/3T/6T/YTD/1N, biến động, sụt giảm tối đa, beta. Giá lịch sử tự điều chỉnh các bước nhảy ngoài biên độ (quyền, chia tách).
- **Tái phân bổ** (`api/_rebalance.js`): đưa danh mục về tỷ trọng mục tiêu, bỏ qua mã lệch ít hơn ngưỡng, bán trước mua sau, không dùng thêm ký quỹ, lô 100, chỉ bán phần đã về, chia lệnh theo hạn mức. Đề xuất thành **phiếu lệnh nguồn "app"**: khách xác nhận trong cổng, môi giới gửi lệnh như luồng 5.1.
- **AI local**: Vercel xếp việc vào `ai_jobs`; worker trên máy nhà gọi Qwen (Ollama). AI chỉ diễn giải số liệu hệ thống đã tính, viết bản nháp cho môi giới, không gửi thẳng cho khách. Số % lạ trong câu trả lời bị đánh dấu.
- **Khuyến nghị có AI** (tab Khuyến nghị): `api/_technical.js` tính xu hướng, MA20/50/200, RSI, ATR, biến động, vùng 52 tuần, so với VN-Index; kiểm tra vùng vào, mục tiêu, cắt lỗ (lỗi khi ngược chiều, cảnh báo tỷ lệ lời/lỗ dưới 1,5 lần, vùng vào xa giá). AI (`advice_draft`) soạn luận điểm, môi giới sửa, chọn khách nhận (khách có khẩu vị thấp hơn rủi ro cổ phiếu được cảnh báo và bỏ chọn sẵn). `advice.ai_job_id` lưu lại bản nháp AI đã dùng.
- **Kết quả khuyến nghị**: `api/_adviceperf.js` chấm theo giá thật từ ngày gửi (đạt mục tiêu, chạm cắt lỗ, chưa vào vùng, hết hiệu lực; một phiên chạm cả hai tính là cắt lỗ), kèm thành tích tổng (tỷ lệ thắng, lãi/lỗ trung bình). Khách cũng thấy kết quả trên từng khuyến nghị.
- **Nhận xét gửi khách** (`client_notes`): AI (`client_note`) viết lại phân tích danh mục bằng lời dễ hiểu, môi giới sửa rồi gửi; lưu `ai_edited` (có sửa bản nháp không) và `seen_at` (khách đã xem). RLS: chỉ gửi cho khách đã liên kết đúng tiểu khoản; khách chỉ được đánh dấu đã xem.
- **Cách giữ AI đúng**: các câu chứa số liệu (so sánh VN-Index, dẫn chứng kỹ thuật, kế hoạch giá) do code viết sẵn, AI chỉ ghép và diễn đạt; câu công bố rủi ro bắt buộc (ví dụ mua ngược xu hướng) AI bỏ sót thì worker tự thêm và đánh dấu.
### 5.5 Kho dữ liệu theo mã (tư vấn trả lời ngay)
Mục tiêu: khi khách hỏi "FPT thế nào?", môi giới có câu trả lời trong vài chục mili giây thay vì chờ AI viết 20-40 giây.

- **`trade.symbol_facts`**: mỗi mã một dòng.
  - `tech`: chỉ báo kỹ thuật, worker tính lại mỗi phiên từ giá DNSE (32 mã mất khoảng 13 giây).
  - `fundamentals`: hồ sơ doanh nghiệp + chỉ số tài chính 12 tháng. Lấy qua **bộ công cụ DNSE của Claude**, xuất ra
    `data/symbol-facts.json` rồi nạp bằng `db/import-facts.mjs`. Worker trên máy KHÔNG gọi được bộ công cụ đó (nó chạy trên
    máy chủ Claude, gắn với tài khoản người dùng), nên phần này cập nhật theo quý, không tự động hằng ngày.
- **`trade.symbol_briefs`**: bản tóm tắt do AI local viết sẵn, chỉ viết lại khi dấu vân tay dữ liệu đổi hoặc quá 7 ngày.
- **Đọc**: `GET /api/symbol?symbol=` cho mọi tài khoản đã đăng nhập (dữ liệu thị trường, không gắn với khách nào);
  `/api/broker/symbol` trả kèm tóm tắt khi môi giới soạn khuyến nghị; luận điểm khuyến nghị của AI cũng được nạp thêm phần cơ bản.
- **P/E, P/B, tỷ suất cổ tức tính theo giá hiện tại**, không lưu sẵn. Nếu số cổ tức và tỷ suất cổ tức DNSE cung cấp không khớp
  nhau theo giá hiện tại thì hệ thống không công bố tỷ suất và gắn cảnh báo.
- **Chống AI bịa**: AI chỉ nhận các câu đã viết sẵn (không nhận số thô, không nhận đoạn giới thiệu tự do) và chỉ được ghép lại.
  Sau khi viết, hệ thống soát hai lớp: số phần trăm không khớp dữ liệu, và từ có nghĩa không xuất hiện trong dữ kiện
  (`novelWords`). Ví dụ thật: SSI không có phần giới thiệu, AI tự thêm câu mô tả hoạt động kinh doanh; sau khi siết lại thì hết.

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
| `tape` | Băng lệnh khớp, chia theo ngày. Giá theo **đồng** (số nguyên), kèm `vol_delta`, `bid1`/`ask1`, bên chủ động |
| `depth_log` | Các bước giá theo thời gian, chia theo ngày. Mảng số nguyên — jsonb tốn gấp 5,5 lần cho cùng nội dung |

RLS: môi giới chỉ thấy dữ liệu khách của mình; khách chỉ thấy dữ liệu gắn với investor_id của mình.

## 7. Bảo mật

- API key/secret của môi giới chỉ nằm ở biến môi trường máy chủ.
- Trading token nằm trong cookie HttpOnly mã hóa, gắn với user môi giới.
- Mật khẩu của khách tại DNSE không bao giờ đi qua Lật Bài.
- Đặt lệnh thật có công tắc tổng `DNSE_REAL_TRADING`, hạn mức mỗi lệnh `DNSE_MAX_ORDER_VND` (mặc định 20 triệu),
  và **trần theo ngày cho từng tiểu khoản**: `DNSE_MAX_ORDERS_PER_DAY` (mặc định 20 lệnh) và `DNSE_MAX_DAILY_VND`
  (mặc định 100 triệu). Trần ngày tính từ `trade.dnse_audit` kể từ 00:00 giờ Việt Nam (`api/_dnse.js dailyUsage`).
  Hạn mức mỗi lệnh không giới hạn được thiệt hại trong ngày: một vòng lặp hỏng hay một phiếu bị bấm gửi nhiều lần
  vẫn rải được vô số lệnh đúng hạn mức. Lệnh **chưa rõ kết quả vẫn bị tính vào trần** — chặn nhầm còn hơn bỏ sót
  một lệnh đã vào sàn. Mặc định có sẵn trong code nên trần vẫn chạy dù chưa đặt biến môi trường nào.
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
