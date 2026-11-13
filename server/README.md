# Chế độ online (bản thử)

Đánh không đồng bộ, một chiều, như Clash of Clans: máy chủ giữ "ảnh chụp" từng làng; người
chơi mang quân sang đánh làng khác lúc chủ nó vắng, cướp một phần kho rồi rút.

## Môi trường trên máy này

- **Postgres riêng**: container Docker `postgres_latbai_online` (image `pgvector/pgvector:pg16`,
  đã có sẵn trên máy), volume `latbai_online_data`, chỉ nghe `127.0.0.1:5433`, tự khởi động lại
  cùng Docker (`--restart unless-stopped`). **Tách hẳn khỏi `postgres_latthe`** (DB giao dịch):
  khác container, khác volume, khác cổng, khác mật khẩu — hỏng bên này không động tới bên kia.
- **Hai vai trò**: `postgres` (siêu người dùng, chỉ để quản trị/backup) và `latbai_app` (không
  phải siêu người dùng, không tạo được DB hay vai trò, chỉ sở hữu DB `latbai_online`). Máy chủ
  game chỉ dùng `latbai_app`.
- **Bí mật** nằm ở `.env.online` (đã gitignore, không bao giờ commit): `ONLINE_DB_URL`,
  `ONLINE_DB_ADMIN_PASSWORD`, `PORT`.
- **Bảng** tự tạo khi máy chủ khởi động (`CREATE ... IF NOT EXISTS` trong `store.ts`).
- Không có `ONLINE_DB_URL` thì máy chủ chạy bằng bộ nhớ (mất hết khi tắt) và in cảnh báo.

```bash
npm run server                    # API ở 127.0.0.1:8787, đọc .env.online
VITE_ONLINE=1 npm run build:online
npx vite preview --outDir dist-online --port 4190   # proxy /api về cổng 8787
```

### Backup

```bash
powershell -ExecutionPolicy Bypass -File server/backup.ps1               # sao lưu ngay
powershell -ExecutionPolicy Bypass -File server/backup.ps1 -Register     # lịch hằng ngày 03:30
```

Ghi ra `D:\Claude projects\Project\latbai-online-backup` (ngoài repo), kiểm bằng `pg_restore -l`,
giữ 30 bản gần nhất. Đã thử khôi phục vào một DB tạm: khớp số liệu với DB đang chạy. Script
này tách khỏi `db/backup.ps1` vì script kia từ chối bản sao dưới 10 KB (DB giao dịch lớn, DB game
còn nhỏ).

Bản `npm run build` thường **không chứa** mã online (đã kiểm: không có chuỗi `/api/` trong
bundle) — production không đổi cho tới khi có máy chủ thật và bật `VITE_ONLINE=1`.

## Luật

- `src/assault.ts` — luật thuần, dùng chung máy chủ và trình duyệt. Máy chủ chạy trận bằng đúng
  `battleStart`/`battleStep` mà trình duyệt dùng để diễn lại, nên kết quả không thể lệch.
- `server/core.ts` — đăng ký, ảnh chụp làng, ghép đối thủ, đánh, nhận vụ cướp.
- `server/store.ts` — `Store`: bản Postgres (`PgStore`) và bản bộ nhớ (`MemStore`). Mọi thao tác
  ghi chạy trong giao dịch có khoá tư vấn toàn cục nên ghi xếp hàng nối đuôi nhau: năm người đánh
  cùng một làng cùng lúc thì chỉ một người cướp được (đã thử), bốn người còn lại gặp khiên.
- `server/main.ts` — HTTP, giới hạn tốc độ, tắt êm.

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
4. **Máy chủ chỉ nghe ở 127.0.0.1.** Người chơi ngoài máy này chưa vào được. Muốn mở ra phải
   chủ động bật một đường hầm hoặc reverse proxy tới cổng 8787 (và đặt cùng tên miền với site,
   hoặc nới CSP `connect-src`). Máy này tắt/ngủ thì chế độ online cũng ngừng.
   Máy chủ cũng chưa tự chạy lại khi máy khởi động — cần một tác vụ Task Scheduler.
5. Quân thủ không hao sau trận (chỉ kho bị cướp): tránh phạt người chơi offline.
