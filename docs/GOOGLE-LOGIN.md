# Bật đăng nhập Google

App chạy được ngay mà không cần phần này: cứ `npm run dev` rồi vào **Tài khoản → Vào thử**.
Chỉ khi muốn đăng nhập bằng tài khoản Google thật mới cần làm các bước dưới.

Phần này **bạn tự làm**, vì nó gắn với tài khoản Google của bạn. Mình không có quyền
và cũng không nên có quyền.

## 1. Tạo OAuth client ID

1. Mở https://console.cloud.google.com/ và đăng nhập, tạo một project mới.
2. **Google Auth Platform** (giao diện cũ: *OAuth consent screen*):
   - **Branding**: tên app `Lật Cờ`, email hỗ trợ, email liên hệ.
   - **Audience**: **External**.
3. **Clients → Create client → Web application**:
   - **Authorized JavaScript origins**: MỖI Ô MỘT ĐỊA CHỈ, bấm **+ Add URI** để thêm ô.
     Không có dấu `/` ở cuối:
     ```
     https://latbai.vn
     http://localhost:5173
     ```
   - **Authorized redirect URIs**: để trống. Nút của Google trả về ID token ngay
     trong trang, không chuyển trang.
4. Bấm **Create**, chép **Client ID** dạng `123…-abc….apps.googleusercontent.com`.
5. **Audience → Publish app → In production.** Bỏ qua bước này thì app ở chế độ
   *Testing*: chỉ những Gmail trong danh sách Test users đăng nhập được, khách lạ
   bị chặn. App chỉ xin tên, ảnh và mã định danh (quyền thường) nên không phải
   chờ Google duyệt.

**Client secret không cần dùng, đừng lưu nó ở đâu cả.** App chỉ xác minh chữ ký của ID
token bằng khoá công khai của Google, không trao đổi mã nào với Google từ phía server.
Lỡ để lộ secret thì vào Clients → client đó → xoá secret cũ / tạo secret mới; app không
bị ảnh hưởng. Client ID thì không phải bí mật — ai mở trang web cũng thấy.

## 2. Đưa Client ID vào app

Tạo file **`.env.chess`** ở thư mục gốc, nội dung một dòng:

```
GOOGLE_CLIENT_ID=123456789012-abcdefghijk.apps.googleusercontent.com
```

File này đã được `.gitignore` bỏ qua nên không lên GitHub. Dùng tên riêng `.env.chess`
để không lẫn với `.env` và `.env.local` của dự án giao dịch đang nằm chung thư mục.

Chỉ cần **một** dòng này. Trình duyệt lấy Client ID từ chính server qua `/api/me`,
nên không có chuyện hai nơi đặt lệch nhau.

Chạy lại `npm run dev`. Vào **Tài khoản**, nút "Đăng nhập bằng Google" sẽ hiện ra.

Kiểm tra nhanh xem server đã nhận chưa:

```bash
curl -s http://localhost:8787/api/health
```

Thấy `"googleConfigured":true` là được.

## 3. Những lỗi hay gặp

| Hiện tượng | Nguyên nhân |
|---|---|
| Nút Google không hiện, báo "Server chưa đặt GOOGLE_CLIENT_ID" | Thiếu dòng trong `.env.chess`, hoặc chưa chạy lại `npm run dev` |
| Google báo `origin_mismatch` | Địa chỉ đang mở không có trong **Authorized JavaScript origins**. Phải khớp cả giao thức và cổng: `http://localhost:5173` khác `http://127.0.0.1:5173` |
| Đăng nhập xong báo "Token Google không hợp lệ" | Client ID trong `.env.chess` không phải cái vừa tạo, hoặc đã bị xoá bên Google Cloud |
| Khách lạ bấm đăng nhập thì Google báo bị chặn / chưa xác minh | App còn ở *Testing*. Vào **Audience → Publish app** |
| Trên latbai.vn mọi thứ cần đăng nhập đều hỏng, mở `/api/me` thấy trang "You are about to visit…" | Trang cảnh báo của ngrok miễn phí. Mọi lời gọi `/api` phải có header `ngrok-skip-browser-warning` — `src/app/api-header.ts` lo việc này |

## 4. Lưu ý về riêng tư

Server **không lưu email**. Chỉ lưu:

- `sub` của Google — một dãy số định danh, không đổi kể cả khi bạn đổi email;
- tên hiển thị và đường dẫn ảnh đại diện, để hiện trong app.

Mã phiên đăng nhập cũng không lưu dạng thô, chỉ lưu bản băm SHA-256. Xem `server/auth.ts`.

## 5. Xác minh tên miền latbai.vn (để Google duyệt thương hiệu)

Đã xác minh trong Google Search Console (property `https://latbai.vn`, cách HTML
file) bằng tài khoản sở hữu project `latco`, ngày 18/11/2026.

**Không được xoá `public/google101f32caa56fc651.html`.** Google kiểm định kỳ;
file mất là mất xác minh, và Google lại báo "home page is not registered to you".

File `public/googlef94974eaa4fe4176.html` là mã cũ (khớp với một bản ghi TXT đặt
nhầm trên DNS Mắt Bão), không dùng tới — giữ cũng không sao.
