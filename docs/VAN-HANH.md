# Vận hành latbai.vn

Trang web (file tĩnh) nằm trên Vercel, luôn sống. Phần `/api` (đăng nhập, lưu
ván, ôn tập, đấu online, bot AI) chạy trên **máy chủ ở nhà** (máy riêng, bật thường trực), đi ra internet qua
tunnel ngrok. Máy tắt / ngủ / mất mạng là phần `/api` chết; trang vẫn mở và
vẫn chơi với máy được.

## Tự khởi động (đã cài 18/11/2026)

| Task (Task Scheduler) | Khi nào | Làm gì |
|---|---|---|
| `LatCo-Server` | Đăng nhập Windows + kiểm mỗi 15 phút | Chạy `scripts/public.mjs --tunnel=ngrok` |
| `LatCo-Backup` | 2 giờ sáng mỗi ngày (máy tắt thì chạy khi bật lại) | Sao lưu database vào `data/backup/`, giữ 14 bản |

`scripts/public.mjs` là "người canh":

- server hoặc ngrok chết thì tự dựng lại (chờ 2, 4, 8… tối đa 60 giây);
- mỗi phút kiểm sức khoẻ cả trong máy lẫn qua tunnel (đúng đường người dùng
  đi); hỏng 3 lần liền thì khởi động lại phần hỏng;
- đã có một bản đang chạy thì bản mới tự thoát — nên lần kiểm 15 phút không
  bao giờ bật trùng.

Đã thử: giết server → 2 giây sau tự lên; giết ngrok → tự lên; latbai.vn không
gián đoạn quá vài giây.

Nhật ký: `data/logs/public.log` (quá 5MB thì đổi thành `.1`, giữ một bản cũ).

```powershell
Get-ScheduledTask -TaskName LatCo-*            # xem
Start-ScheduledTask -TaskName LatCo-Server     # bật ngay
powershell -ExecutionPolicy Bypass -File scripts\setup-autostart.ps1 -Remove   # gỡ
```

## Sau khi sửa code server

Server không tự nạp code mới. Khởi động lại: tắt tiến trình `public.mjs` (Task
Manager, hoặc `Stop-ScheduledTask LatCo-Server`) rồi `Start-ScheduledTask
LatCo-Server`. Sửa phần web thì chỉ cần `npm run deploy`.

## Những điều tự động hoá KHÔNG lo được

- **Máy ngủ.** Đặt Windows: Settings → System → Power → *Sleep: Never* khi cắm sạc.
- **Máy khởi động lại mà không ai đăng nhập.** Task chạy theo phiên đăng nhập,
  nên cần đăng nhập Windows (hoặc bật tự đăng nhập).
- **Ổ cứng hỏng.** Bản sao lưu nằm cùng ổ. Nên chép thêm ra chỗ khác (OneDrive,
  ổ ngoài) — chưa làm.
- **Báo khi sập.** Cần một dịch vụ bên ngoài (xem dưới).

## Báo động khi `/api` chết (UptimeRobot, miễn phí)

1. Tạo tài khoản ở https://uptimerobot.com.
2. *Add New Monitor* → loại **Keyword**.
3. URL: `https://latbai.vn/api/health` · Keyword: `"ok":true` · kiểm mỗi 5 phút.
4. Alert contact: email (hoặc app UptimeRobot trên điện thoại).

## Thống kê (#/thong-ke)

Chỉ tài khoản có id trong `ADMIN_USER_IDS` (`.env.chess`, hiện là 218) xem được.
Tài khoản đó thấy mục **Thống kê** ngay trên thanh điều hướng (máy tính: cột trái;
điện thoại: thanh dưới). Cài latbai.vn lên điện thoại như app là mở một chạm.

- **Trực tiếp** (đầu trang, tự cập nhật mỗi 15 giây khi đang mở trang): số người đang
  mở trang và đang ở mục nào, ván online đang đánh (bao nhiêu với AI), người đang chờ
  ghép. "Đang mở trang" là mã ngẫu nhiên mỗi tab gửi ~45 giây/lần, server chỉ giữ trong
  bộ nhớ 2 phút (`server/presence.ts`) — khởi động lại server là về 0, vài chục giây
  sau đủ lại. Tính cả chính bạn nếu đang mở latbai.vn.
- **Theo ngày** (tự cập nhật mỗi phút): lượt vào, bắt đầu/xong ván, tìm trận, ghép
  người/AI, đăng ký, chia sẻ, mở link, bài tập.
- **Tính năng mới · 7 ngày**: Trợ lý dừng máy / mở hướng dẫn, mở Huấn luyện viên, xem
  trang bài học /hoc/ (trang tĩnh, tự gửi một lượt), bàn cờ nổi, cài app.
- **Người chơi hay sai gì**: AI đọc tóm tắt lỗi gộp của mọi người (xem Huấn luyện viên).

Lượt từ chính máy chủ (lúc phát triển, lúc chạy `check:design` qua Vite) không được tính.

## Ván chia sẻ (latbai.vn/van/<id>)

Lưu trong bảng `shares` (không gắn tài khoản). Ảnh xem trước khi dán link lên
Facebook/Zalo là ảnh chung `public/og.png`, không phải ảnh riêng từng ván: bot đọc
link của mạng xã hội đi qua ngrok miễn phí sẽ gặp trang cảnh báo. Người chơi có
nút tải ảnh tóm tắt riêng của ván để đăng kèm.

## Trang bài học (latbai.vn/hoc/)

Sinh từ `src/training/lessons.ts` + kho bài tập `data/chess.db` (chỉ có trên máy
này, nên file sinh ra được đưa vào git):

```
node --experimental-strip-types --no-warnings scripts/build-lessons.ts
```

Chạy lại khi thêm/sửa bài học, rồi deploy. Script cũng viết lại `public/sitemap.xml`.
Nút "Luyện bài này ngay" mở `/#/hoc?bai=<id>` — app vào thẳng bài đó.

## Cài như app (PWA)

`public/manifest.webmanifest`, icon trong `public/icons/` (sinh bằng
`node scripts/make-icons.mjs`), service worker `public/sw.js` (chỉ đăng ký ở bản build).

- Trang luôn lấy mạng trước; mạng chậm quá 4 giây hoặc mất mạng mới dùng bản đã lưu.
  Deploy xong thì lần mở tiếp theo người chơi có bản mới, không cần làm gì.
- `/api/*` không bao giờ qua service worker (đăng nhập Google, ván online...).
- Đổi cách lưu trong `sw.js` thì tăng `PHIÊN_BẢN` để xoá bộ nhớ cũ trên máy người chơi.
- Nút "Cài Lật Cờ lên máy" nằm trong Cài đặt, chỉ hiện khi trình duyệt cho cài
  (Chrome/Edge/Android). iPhone chỉ có dòng hướng dẫn Chia sẻ → Thêm vào MH chính.

## Người chấm ván nền (Huấn luyện viên)

`server/analyst.ts` chạy cùng server: cứ 4 giây xem có ván đã lưu nào chưa chấm thì chấm
MỘT ván (Stockfish, tiến trình riêng, ~20–40 giây/ván), rồi ghi bảng `game_insights`.
Lần đầu bật nó chấm dồn các ván cũ (mới nhất trước) — một lõi CPU bận vài chục phút,
xong thì gần như nghỉ. Ván lỗi không chấm được thì bỏ qua tới lần khởi động sau
(log: `[chấm ván] ván N lỗi`).

Số ván còn chờ: trang Thống kê (dòng "Máy chủ còn … ván chưa chấm"), hoặc
`SELECT count(*) FROM games g LEFT JOIN reviews r ON r.game_id = g.id WHERE r.game_id IS NULL`.

## Không thuê VPS

Máy ở nhà là máy chủ riêng, bật thường trực cho việc này (quyết định 18/11/2026).
Việc làm cho ổn định đi vào chính máy này: người canh, Task Scheduler, sao lưu,
báo động — không chuyển đi đâu.
