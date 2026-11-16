# Cờ vua

Web game cờ vua để học: chơi với máy, xem lại từng nước có Huấn luyện viên giải thích, và ôn tập bằng chính lỗi của mình. Xem [docs/PLAN.md](docs/PLAN.md), [docs/DESIGN.md](docs/DESIGN.md), [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

Đang ở **giai đoạn 0: design system**. Các màn hình hiện là bản dựng tĩnh, chưa có logic chơi cờ.

## Chạy

```bash
npm install     # tự chép font, bộ quân và engine vào public/
npm run dev     # http://localhost:5173
```

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy thử |
| `npm test` | Unit test |
| `npm run build` | Kiểm tra kiểu và đóng gói |
| `npm run fixtures` | Sinh lại dữ liệu mẫu bằng Stockfish (vài phút) |
| `npm run shots` | Chụp ảnh các màn hình vào `shots/` (cần `npm run dev`) |
| `npm run check:design` | Rà theo danh sách cấm ở DESIGN.md: emoji, gradient, bo góc lớn, tương phản, vùng bấm, tràn ngang (cần `npm run dev`) |

## Trang thiết kế

`http://localhost:5173/#/thiet-ke` — mọi token và component ở mọi trạng thái. **Component mới phải có mặt ở đây trước khi dùng trong màn hình thật.**

## Dữ liệu mẫu

`src/mock/fixtures.json` sinh bằng `npm run fixtures`: nước đi do chess.js kiểm tra, điểm số do Stockfish 19 chạy ở độ sâu 16. Không có thế cờ bịa, không có chữ giả.

## Giấy phép

- Mã nguồn: chưa chốt. **Stockfish là GPL-3**, nên khi đưa engine vào ở giai đoạn 3 thì mã nguồn phải công khai theo GPL-3.
- Bộ quân cburnett: CC BY-SA 3.0, xem `public/pieces/LICENSE.txt`.
- Font IBM Plex: OFL-1.1.
