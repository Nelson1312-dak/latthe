# Bật đăng nhập Google

App chạy được ngay mà không cần phần này: cứ `npm run dev` rồi vào **Tài khoản → Vào thử**.
Chỉ khi muốn đăng nhập bằng tài khoản Google thật mới cần làm các bước dưới.

Phần này **bạn tự làm**, vì nó gắn với tài khoản Google của bạn. Mình không có quyền
và cũng không nên có quyền.

## 1. Tạo OAuth client ID

1. Mở https://console.cloud.google.com/ và đăng nhập.
2. Tạo một project mới (góc trên bên trái, chỗ chọn project → **New Project**). Đặt tên gì cũng được, ví dụ `co-vua`.
3. Vào **APIs & Services → OAuth consent screen**:
   - Kiểu người dùng: **External**.
   - Điền tên app (`Lật Cờ`), email hỗ trợ, email liên hệ. Các mục khác để trống được.
   - Phần **Test users**: thêm chính địa chỉ Gmail của bạn. Khi app còn ở trạng thái *Testing*,
     chỉ những địa chỉ trong danh sách này mới đăng nhập được — thêm bạn bè vào đây nếu muốn họ thử.
4. Vào **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins** — thêm đúng những dòng này (không có dấu `/` ở cuối):
     ```
     http://localhost:5173
     ```
     Sau này khi chạy thật qua tunnel thì thêm tên miền đó, ví dụ `https://co-vua.ngrok.app`.
   - **Authorized redirect URIs**: để trống. Cách đăng nhập app đang dùng (nút của Google,
     trả về ID token ngay trong trang) không cần chuyển trang.
5. Bấm **Create**. Google hiện ra **Client ID** dạng
   `123456789012-abcdefghijk.apps.googleusercontent.com`.

**Client secret không cần dùng.** App chỉ xác minh chữ ký của ID token bằng khoá công khai
của Google, không trao đổi mã nào với Google từ phía server.

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
| Google báo app chưa được xác minh | Bình thường khi app ở trạng thái *Testing*. Bấm **Advanced → Continue**, hoặc thêm địa chỉ đó vào **Test users** |

## 4. Lưu ý về riêng tư

Server **không lưu email**. Chỉ lưu:

- `sub` của Google — một dãy số định danh, không đổi kể cả khi bạn đổi email;
- tên hiển thị và đường dẫn ảnh đại diện, để hiện trong app.

Mã phiên đăng nhập cũng không lưu dạng thô, chỉ lưu bản băm SHA-256. Xem `server/auth.ts`.
