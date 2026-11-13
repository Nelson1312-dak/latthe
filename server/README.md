# Chế độ online (bản thử)

Đánh không đồng bộ, một chiều, như Clash of Clans: máy chủ giữ "ảnh chụp" từng làng; người
chơi mang quân sang đánh làng khác lúc chủ nó vắng, cướp một phần kho rồi rút.

## Chạy thử trên máy

```bash
npm run server                    # API ở cổng 8787, dữ liệu server/data/online.json
VITE_ONLINE=1 npm run build:online
npx vite preview --outDir dist-online --port 4190   # proxy /api về cổng 8787
```

Bản `npm run build` thường **không chứa** mã online (đã kiểm: không có chuỗi `/api/` trong
bundle) — production không đổi cho tới khi có máy chủ thật và bật `VITE_ONLINE=1`.

## Luật

- `src/assault.ts` — luật thuần, dùng chung máy chủ và trình duyệt. Máy chủ chạy trận bằng đúng
  `battleStart`/`battleStep` mà trình duyệt dùng để diễn lại, nên kết quả không thể lệch.
- `server/core.ts` — đăng ký, ảnh chụp làng, ghép đối thủ, đánh, nhận vụ cướp.
- `server/main.ts` — HTTP + lưu file JSON (đổi sang Postgres chỉ cần thay `load`/`save`).

| API | Việc |
|---|---|
| `POST /api/register` | cấp mã người chơi ẩn danh |
| `PUT /api/village` | gửi ảnh chụp làng (quân, tháp, kho) |
| `GET /api/opponents` | danh sách làng đánh được, kèm độ khó |
| `POST /api/attack` | đánh: máy chủ chạy trận, trả hạt giống để diễn lại |
| `POST /api/inbox/claim` | nhận các vụ cướp nhằm vào làng mình |

Cướp tối đa 25% mỗi loại hàng (phần kho dưới 150 được giữ). Làng bị đánh được che chắn 4 giờ
(30 phút nếu bên công lọt dưới 25%); cùng một cặp phải chờ 1 giờ mới đánh lại; đánh người khác
thì mất che chắn của mình.

## Giới hạn đã biết của bản thử

1. **Ảnh chụp làng do trình duyệt khai.** Máy chủ kẹp số vào khoảng hợp lý, chặn đem nhiều quân
   hơn đã khai, và tự chạy trận — nhưng không chặn được người sửa localStorage rồi khai một đội
   quân hợp lý mà không có thật. Chặn hẳn cần máy chủ giữ cả phần kinh tế.
2. **Chưa có tài khoản.** Mã người chơi nằm trong localStorage; xoá là mất làng online.
3. **Replay diễn trên bản đồ của chính mình** (công trình hiển thị là của mình, tháp và quân thủ
   là của làng bị đánh). Chưa dựng chiến trường riêng.
4. **Chưa có máy chủ thật.** Vercel không chạy tiến trình Node dài hơi; cần hàm serverless +
   Postgres (Neon/Vercel Postgres) hoặc một VPS. CSP `connect-src 'self'` đã đúng nếu API cùng
   tên miền.
5. Quân thủ không hao sau trận (chỉ kho bị cướp): tránh phạt người chơi offline.
