# Lật Cờ — cờ vua online miễn phí, tiếng Việt

**Chơi ngay: [latbai.vn](https://latbai.vn)** — không cần cài, không quảng cáo, chạy được trên điện thoại.

- [Chơi cờ vua với máy](https://latbai.vn/choi-co-vua-voi-may/): 8 cấp độ, từ máy hay để hở quân cho người mới tới khoảng 2500 Elo; có gợi ý ba nấc và đi lại.
- [Chơi cờ vua online với người](https://latbai.vn/choi-co-vua-online/): ghép trận theo Elo, 4 thể thức, mời bạn bè bằng mã.
- Chấm ván ngay trong trình duyệt bằng Stockfish: độ chính xác, nước hay, nước hỏng, nước nên đi ([cách chấm](https://latbai.vn/cham-van-co-vua/)).
- [Bài tập cờ vua có lời giải](https://latbai.vn/bai-tap-co-vua/) (hơn một triệu thế cờ), [bài học chiến thuật](https://latbai.vn/hoc/), [luật cờ vua](https://latbai.vn/luat-co-vua/), [khai cuộc](https://latbai.vn/khai-cuoc/), [bẫy khai cuộc](https://latbai.vn/bay-khai-cuoc/), [tàn cuộc cơ bản](https://latbai.vn/tan-cuoc/).
- Huấn luyện viên đọc các ván của bạn và chỉ ra lỗi hay lặp lại. Nguyên tắc: **engine và luật cờ quyết định đúng sai, mô hình ngôn ngữ chỉ diễn đạt lại**; lời nào nhắc nước đi, ô cờ hay con số không có trong dữ kiện đều bị chặn (`npm run eval:advisor` để tự đo).

Phần mềm tự do theo GPL-3. Thiết kế và kế hoạch: [docs/PLAN.md](docs/PLAN.md), [docs/DESIGN.md](docs/DESIGN.md), [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md); vận hành bản trên web: [docs/VAN-HANH.md](docs/VAN-HANH.md).

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
| `npm run openings` | Tải lại bảng khai cuộc từ Lichess |
| `npm run eval:advisor` | Đo chất lượng lời bình của Huấn luyện viên (cần Ollama) |
| `npm run puzzles` | Tải và nạp kho bài tập Lichess (310 MB, tải tiếp được nếu đứt) |
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
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Nơi chạy mô hình cho Huấn luyện viên |
| `OLLAMA_MODEL` | `qwen3:8b` | Mô hình dùng để viết lời bình |
| `AUTH_DEV` | tắt | `1` để bật đăng nhập thử; chỉ có tác dụng khi `API_HOST` là địa chỉ máy này |
| `CHESS_DB` | `data/chess.db` | File database |

## Database

Một file SQLite: `data/chess.db`. Sao lưu bằng cách chép file. Migration trong `server/migrations/`, server tự chạy những cái còn thiếu lúc khởi động.

## Dữ liệu mẫu

`src/mock/fixtures.json` sinh bằng `npm run fixtures`: nước đi do chess.js kiểm tra, điểm số do Stockfish 19 chạy ở độ sâu 16. Không có thế cờ bịa, không có chữ giả.

## Giấy phép

**GPL-3.0-or-later** — xem [LICENSE](LICENSE). Lý do: Stockfish là GPL-3 và app đưa engine lên web.
Danh sách đầy đủ thành phần của người khác: [THIRD-PARTY.md](THIRD-PARTY.md).
