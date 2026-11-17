# Lật Cờ

Web game cờ vua để học: chơi với máy, xem lại từng nước có Huấn luyện viên giải thích, và ôn tập bằng chính lỗi của mình. Xem [docs/PLAN.md](docs/PLAN.md), [docs/DESIGN.md](docs/DESIGN.md), [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

Đang ở cuối **giai đoạn 1**: đã có server, database và đăng nhập. Các màn hình cờ vẫn là bản dựng tĩnh, chưa đi được quân (đó là giai đoạn 2).

Bản trên web: **https://latbai.vn** (project Vercel `latthe`). Đó là trang tĩnh, không có server, nên phần đăng nhập hiện "Ngoại tuyến" — muốn dùng thật thì chạy trên máy.

## Chạy

```bash
npm install     # tự chép font và bộ quân vào public/
npm run dev     # Vite ở localhost:5173 + server API ở localhost:8787
```

Chưa cần cấu hình gì: vào **Tài khoản → Vào thử** là dùng được ngay.
Muốn đăng nhập bằng Google thật thì xem [docs/GOOGLE-LOGIN.md](docs/GOOGLE-LOGIN.md).

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy Vite và server API cùng lúc |
| `npm run server` | Chỉ chạy server API (phục vụ `dist/` nếu đã build) |
| `npm start` | Build rồi chạy server, không cần Vite |
| `npm test` | Unit test |
| `npm run build` | Kiểm tra kiểu và đóng gói |
| `npm run fixtures` | Sinh lại dữ liệu mẫu bằng Stockfish (vài phút) |
| `npm run shots` | Chụp ảnh các màn hình vào `shots/` (cần `npm run dev`) |
| `npm run check:design` | Rà theo danh sách cấm ở DESIGN.md: emoji, gradient, bo góc lớn, tương phản, vùng bấm, tràn ngang (cần `npm run dev`) |

## Trang thiết kế

`http://localhost:5173/#/thiet-ke` — mọi token và component ở mọi trạng thái. **Component mới phải có mặt ở đây trước khi dùng trong màn hình thật.**

## Cấu hình

Server đọc `.env.chess` ở thư mục gốc (tên riêng để không lẫn với `.env` của dự án giao dịch chạy chung thư mục):

| Biến | Mặc định | Việc |
|---|---|---|
| `GOOGLE_CLIENT_ID` | trống | Bật đăng nhập Google |
| `API_PORT` | `8787` | Cổng của server API (**không** dùng `PORT`: nhiều công cụ đặt sẵn biến đó) |
| `API_HOST` | `127.0.0.1` | Địa chỉ lắng nghe |
| `AUTH_DEV` | tắt | `1` để bật đăng nhập thử; chỉ có tác dụng khi `API_HOST` là địa chỉ máy này |
| `CHESS_DB` | `data/chess.db` | File database |

## Database

Một file SQLite: `data/chess.db`. Sao lưu bằng cách chép file. Migration trong `server/migrations/`, server tự chạy những cái còn thiếu lúc khởi động.

## Dữ liệu mẫu

`src/mock/fixtures.json` sinh bằng `npm run fixtures`: nước đi do chess.js kiểm tra, điểm số do Stockfish 19 chạy ở độ sâu 16. Không có thế cờ bịa, không có chữ giả.

## Giấy phép

- Mã nguồn: chưa chốt. **Stockfish là GPL-3**, nên khi đưa engine vào ở giai đoạn 3 thì mã nguồn phải công khai theo GPL-3. Trong lúc chưa chốt, bản dựng **không** mang theo file engine (`scripts/copy-assets.mjs` chỉ chép khi `WITH_ENGINE=1`).
- Bộ quân cburnett: CC BY-SA 3.0, xem `public/pieces/LICENSE.txt`.
- Font IBM Plex Sans / Mono / Serif: OFL-1.1.
