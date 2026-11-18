# Cho latbai.vn chạy được bản đầy đủ

Mục tiêu: vào `https://latbai.vn` là đăng nhập được, lưu ván được, đấu online
được — mà **không đổi DNS**, **không cần Cloudflare**, **không cần VPS**.

## Vì sao không chỉ trỏ DNS là xong

Máy chạy server **không nhận được kết nối vào từ ngoài** (kiểm 17/11/2026):

| Thứ | Giá trị |
|---|---|
| Địa chỉ máy | `10.223.181.64` (dải nội bộ) |
| Gateway | `10.128.128.128` — mở ra là giao diện một node mesh WiFi, không có mục chuyển tiếp cổng |
| IP nhìn từ ngoài | `101.99.15.211` — dùng chung qua NAT nhà mạng |

Bản ghi DNS là **tấm biển chỉ đường**, phải có một **con đường** để trỏ tới.
Trỏ `latbai.vn` vào `101.99.15.211` thì gói tin dừng ở thiết bị nhà mạng.
Nên máy phải **gọi ra** (tunnel), chứ không thể để người ta gọi vào.

## Cách làm: Vercel chuyển tiếp /api

`latbai.vn` đang ở Vercel. Vercel chuyển tiếp được một đường dẫn sang nơi khác.
Vậy:

```
Trình duyệt  →  https://latbai.vn  →  (Vercel)
                   ├── / , /assets, /pieces …   file tĩnh, luôn bật
                   └── /api/*                   chuyển tiếp → tunnel → máy ở nhà
```

Trình duyệt **chỉ nói chuyện với latbai.vn**, nên:

- cookie phiên là cookie của latbai.vn, chạy bình thường, không cần CORS
- Google OAuth chỉ phải khai đúng một origin: `https://latbai.vn`
- máy ở nhà tắt thì `/api` hỏng, nhưng trang vẫn mở và vẫn **chơi với máy** được

## Các bước

### 1. Có một địa chỉ tunnel CỐ ĐỊNH

Tunnel tạm (`npm run public`) đổi tên mỗi lần chạy nên không dùng được ở đây.
Cần một trong hai:

- **ngrok**: tài khoản miễn phí được một tên miền tĩnh (dạng
  `*.ngrok-free.dev`). Trên máy này đã có sẵn một tên như vậy trong
  `ngrok.yml`, nhưng nó đang dành cho tunnel `latthe` (Ollama + PostgREST).
  Muốn dùng cho cờ thì phải quyết số phận tunnel kia trước.
- **Tailscale Funnel**: miễn phí, cho địa chỉ `*.ts.net` cố định. Tailscale đã
  cài trên máy nhưng **chưa đăng nhập**.

### 2. Chạy server kèm tunnel đó

```bash
npm run public -- --tunnel=ngrok
```

### 3. Khai địa chỉ đó rồi deploy

Thêm vào `.env.chess`:

```
PUBLIC_UPSTREAM=https://<ten-mien-tinh-cua-ban>
```

```bash
npm run deploy
```

Script tự sinh phần `rewrites` trong `vercel.json` rồi đẩy lên. Bỏ
`PUBLIC_UPSTREAM` đi là quay lại bản tĩnh như cũ.

### 4. Bật đăng nhập Google

Xem [GOOGLE-LOGIN.md](GOOGLE-LOGIN.md). **Authorized JavaScript origins** điền
`https://latbai.vn` (không có `/` ở cuối). Rồi `.env.chess`:

```
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
```

## Chỗ chưa kiểm được

**Đấu online qua đường này chưa thử.** Ván online dùng SSE — một kết nối mở
liên tục. Vercel có thể cắt hoặc gom đệm kết nối dài khi chuyển tiếp, lúc đó
nước đi của đối thủ sẽ về chậm hoặc không về. Đăng nhập, lưu ván, xem lại,
ôn tập thì chỉ là request ngắn nên không lo.

Chưa kiểm được vì chưa có địa chỉ tunnel cố định. Khi có rồi thì thử ngay:
mở hai trình duyệt vào latbai.vn, tìm trận, đi vài nước. Nếu SSE bị cắt thật
thì vẫn còn đường: cho riêng `/api/live/stream` đi thẳng tới tunnel thay vì
qua Vercel (lúc đó mới cần CORS cho đúng một đường dẫn đó).

## Trang cảnh báo của ngrok miễn phí (đã xử lý)

Gói miễn phí của ngrok chèn trang HTML "You are about to visit…" trước mọi
request **GET** có User-Agent trình duyệt (POST và OPTIONS thì lọt). Thử bằng
`curl` không thấy, vì curl không phải trình duyệt — nên lỗi này nằm im một thời
gian: trên latbai.vn, trình duyệt hỏi `/api/me` thì nhận về HTML, đăng nhập,
ôn tập, đấu online đều không chạy.

Cách xử lý: mọi lời gọi `/api` gắn header `ngrok-skip-browser-warning: 1`
(`src/app/api-header.ts`). Vercel chuyển nguyên header đó sang ngrok. Luồng đấu
online đi thẳng tới ngrok nên đọc bằng `fetch` (gắn được header) thay cho
`EventSource` (không gắn được); server trả lời OPTIONS cho đúng đường luồng,
chỉ với origin `https://latbai.vn`.

Kiểm cho đúng thì phải kiểm **bằng trình duyệt**, hoặc curl giả User-Agent trình duyệt.
