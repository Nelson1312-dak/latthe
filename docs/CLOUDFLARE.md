# Chuyển từ ngrok sang Cloudflare Tunnel

## Vì sao đổi
Vercel gọi database của bạn qua một tunnel. Hiện đang là ngrok gói miễn phí (`stiffness-glade-coliseum.ngrok-free.dev`):
một tên miền cố định, có giới hạn băng thông, và sống phụ thuộc vào tài khoản ngrok miễn phí. Cloudflare Tunnel miễn phí,
không giới hạn băng thông, dùng tên miền của chính bạn và có thể thêm lớp bảo vệ (Access, WAF, giới hạn tần suất).

## Hiện trạng trên máy bạn (đã kiểm tra 12/10/2026)
- `cloudflared` 2026.5.1 đã cài và **đang chạy như dịch vụ Windows** (tự khởi động), tunnel ID `93092b4e-01f1-4b7c-8960-899178e73a46`.
  Đây là tunnel được quản lý trên dashboard Cloudflare, nên **không cần cài thêm gì trên máy**, chỉ cần thêm một "Public Hostname".
- `local-proxy.js` đã lắng nghe `127.0.0.1:11435` và là điểm vào duy nhất: `/postgrest/*` (bắt buộc JWT) và Ollama (bắt buộc khóa).
  Cloudflare dùng đúng điểm vào này như ngrok đang dùng, không đổi code.
- DNS của `latbai.vn` hiện ở **Mắt Bão** (`ns1.matbao.vn`, `ns2.matbao.vn`), chưa ở Cloudflare. Tên miền phải nằm trên Cloudflare thì
  mới gắn được Public Hostname. Có hai cách (chọn một):

### Cách A: chuyển DNS của latbai.vn sang Cloudflare (khuyên dùng, dùng `db.latbai.vn`)
1. Cloudflare dashboard → **Add a site** → nhập `latbai.vn` → gói **Free**.
2. Cloudflare tự quét bản ghi cũ. **Đối chiếu với bảng DNS đang dùng ở Mắt Bão** và đảm bảo có đủ:
   - `A` `@` → `76.76.21.21` (Vercel), để **DNS only** (đám mây xám, không bật proxy)
   - `CNAME` `www` → `cname.vercel-dns.com`, để **DNS only**
   - mọi bản ghi `MX`, `TXT` (email, xác minh Google/Search Console…) nếu có. Thiếu `MX` là mất email.
3. Cloudflare cho 2 máy chủ tên (dạng `xxx.ns.cloudflare.com`). Vào Mắt Bão đổi **Name Server** của `latbai.vn` sang 2 máy chủ đó.
   Chờ lan truyền (vài phút đến vài giờ). Trong lúc chờ site vẫn chạy bình thường.
4. Khi Cloudflare báo **Active**, kiểm tra `https://latbai.vn` vẫn mở được.

### Cách B: dùng một tên miền khác đã nằm trong tài khoản Cloudflare của bạn
Nếu tunnel hiện có đang phục vụ một tên miền khác trên Cloudflare, dùng luôn tên miền đó (ví dụ `db.ten-mien-khac.com`).
Không cần động tới DNS của `latbai.vn`.

## Thêm Public Hostname vào tunnel có sẵn
1. Cloudflare dashboard → **Zero Trust** → **Networks** → **Tunnels** → bấm tunnel `93092b4e…` → **Public Hostname** → **Add**.
2. Subdomain: `db`, Domain: tên miền đã chọn ở trên. **Service**: `HTTP` / `localhost:11435`.
3. Lưu. **Không xóa hay sửa các hostname đang có**, chúng đang phục vụ việc khác.

## Kiểm tra trước khi chuyển (không ảnh hưởng gì đang chạy)
```
node --env-file=.env.local deploy/check-tunnel.mjs https://db.<tên-miền>/postgrest
```
Phải ra `8 đạt, 0 lỗi`, gồm: không token bị chặn, token giả bị từ chối, token hợp lệ đọc được, bảng cũ không lộ, Ollama không khóa bị chặn.
Mốc so sánh ngrok hiện tại: 7/7 điểm an toàn, độ trễ trung vị khoảng 129 ms.

## Chuyển Vercel sang địa chỉ mới
```
vercel login        (nếu chưa)
powershell -ExecutionPolicy Bypass -File deploy\push-env.ps1 -DnseCustody <số lưu ký> -IncludeDnse -SupabaseUrl https://db.<tên-miền>/postgrest
```
Sau đó deploy lại (`vercel --prod` hoặc đẩy một commit) và mở `https://latbai.vn/api/health`: `db.reachable` phải là `true`.

## Dọn ngrok
Giữ ngrok chạy song song khoảng một tuần như đường lui. Khi chắc chắn:
1. Dừng ngrok (đóng cửa sổ hoặc tắt tiến trình `ngrok`).
2. Bỏ phần ngrok trong `start-services.ps1` và `update-db-tunnel.ps1` (hai script này vẫn đặt biến Vercel theo URL ngrok, đừng chạy chúng nữa).
3. Hủy tunnel `latthe` trong tài khoản ngrok nếu muốn.

## Tùy chọn: thêm lớp bảo vệ ở Cloudflare
Mọi yêu cầu tới `/postgrest` đã bắt buộc JWT do chính server của bạn ký, nên đây chỉ là lớp thêm:
- **WAF / Rate limiting**: giới hạn số yêu cầu mỗi IP tới `db.<tên-miền>`.
- **Access**: yêu cầu một Service Token (hai header `CF-Access-Client-Id` / `CF-Access-Client-Secret`) mà chỉ Vercel biết. Cần thêm hai biến
  vào Vercel và sửa `api/_db.js` để gửi hai header đó. Hỏi mình nếu muốn bật.
