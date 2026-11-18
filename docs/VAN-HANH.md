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

## Không thuê VPS

Máy ở nhà là máy chủ riêng, bật thường trực cho việc này (quyết định 18/11/2026).
Việc làm cho ổn định đi vào chính máy này: người canh, Task Scheduler, sao lưu,
báo động — không chuyển đi đâu.
