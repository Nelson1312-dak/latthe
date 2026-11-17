# Tên miền cố định cho bản chạy thật

App chơi được ngay mà không cần phần này: `npm run public` mở một tunnel tạm,
cho ra một địa chỉ ngẫu nhiên dùng được luôn. Chỉ khi muốn **một địa chỉ không
đổi** (và muốn bật đăng nhập Google) mới cần làm các bước dưới.

Phần này **bạn tự làm**, vì nó gắn với tài khoản Cloudflare và tài khoản nhà
đăng ký tên miền của bạn. Mình không có quyền và cũng không nên có quyền.

## Hiện trạng (kiểm ngày 17/11/2026)

| Thứ | Đang là |
|---|---|
| Nameserver của `latbai.vn` | `ns1.matbao.vn`, `ns2.matbao.vn` — **không phải Cloudflare** |
| `latbai.vn` (A) | `76.76.21.21` → Vercel, tức bản web tĩnh hiện tại |
| TXT | `googlef94974eaa4fe4176.html` (xác minh Google) |
| MX | **không có** — tên miền này không nhận mail |

Không có MX là một tin tốt: chuyển DNS sang chỗ khác thì **không sợ mất mail**,
vì vốn không có hòm thư nào chạy trên tên miền này.

## Vì sao phải chuyển DNS

Cloudflare Tunnel chỉ gắn được tên miền **nằm trong tài khoản Cloudflare**.
Lệnh `cloudflared tunnel route dns` tạo một bản ghi CNAME trỏ tới
`<id>.cfargotunnel.com`, mà bản ghi đó **chỉ chạy khi Cloudflare làm proxy**.
Để CNAME đó ở Mắt Bão thì không ra gì cả — nhà DNS khác không proxy hộ được.

Nên muốn `co.latbai.vn` đi qua tunnel thì phải đưa `latbai.vn` về Cloudflare.

## Các bước

### 1. Đưa latbai.vn vào Cloudflare

1. https://dash.cloudflare.com → **Add a site** → gõ `latbai.vn` → chọn gói **Free**.
2. Cloudflare quét bản ghi cũ. Kiểm cho đủ **đúng hai bản ghi** này:
   - `A` `latbai.vn` → `76.76.21.21`, **Proxy: tắt (DNS only, mây xám)**.
     Vercel tự lo HTTPS; để Cloudflare proxy chồng lên dễ sinh lỗi chứng chỉ.
   - `TXT` `latbai.vn` → `googlef94974eaa4fe4176.html`
3. Cloudflare cho hai nameserver mới. Vào trang quản lý tên miền ở **Mắt Bão**,
   đổi nameserver sang hai cái đó.
4. Chờ Cloudflare báo **Active** (thường vài phút tới vài tiếng).

Trong lúc chờ, latbai.vn vẫn chạy bình thường — bản ghi không đổi, chỉ đổi chỗ
quản lý.

### 2. Tạo tunnel cho app cờ

Chạy trên chính máy này:

```bash
cloudflared tunnel login
```

```bash
cloudflared tunnel create co-vua
```

```bash
cloudflared tunnel route dns co-vua co.latbai.vn
```

> Dịch vụ `cloudflared` đang chạy sẵn trên máy (việc khác) **không bị ảnh hưởng**:
> đây là một tunnel riêng, tên riêng, chạy bằng lệnh riêng.

### 3. Chạy

```bash
npm run public -- --tunnel=named
```

Mở `https://co.latbai.vn` là ra app, có đăng nhập, có đấu online.
Đổi tên tunnel thì đặt biến `CF_TUNNEL`.

### 4. Bật chạy tự động (tuỳ ý)

```bash
powershell -ExecutionPolicy Bypass -File scripts\setup-autostart.ps1
```

Sửa `scripts/setup-autostart.ps1` để thêm `--tunnel=named` nếu muốn bản tự chạy
dùng tên miền cố định.

## Sau khi có tên miền thì làm nốt đăng nhập Google

Xem [GOOGLE-LOGIN.md](GOOGLE-LOGIN.md). Lúc tạo OAuth client, phần
**Authorized JavaScript origins** điền đúng `https://co.latbai.vn`
(không có dấu `/` ở cuối). Rồi đặt vào `.env.chess`:

```
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
```

## Hai cái vẫn tách nhau

- **latbai.vn** (Vercel): bản tĩnh, luôn bật, chơi với máy và giải bài tập được.
- **co.latbai.vn** (tunnel): bản đầy đủ, chỉ chạy khi máy này mở.

Giữ cả hai là cố ý: máy tắt thì vẫn còn chỗ chơi với máy.
