# Kế hoạch: Lật Cờ — game cờ vua đào tạo có AI tư vấn

Lập ngày 16/11/2026, cập nhật cùng ngày theo 2 chế độ chơi. Thay thế toàn bộ game Quần Đảo Vô Tận cũ.

Tài liệu liên quan:
- [DESIGN.md](DESIGN.md) — design system, **làm đầu tiên**
- [IMPLEMENTATION.md](IMPLEMENTATION.md) — kiến trúc, database, việc từng giai đoạn

## 1. Mục tiêu

Web game cờ vua cho **người mới và người chơi trung cấp**, giúp tiến bộ thật nhờ được review và tư vấn sau mỗi nước, mỗi ván.

### Chế độ 1 — Chơi với máy, học không giới hạn

Một vòng lặp không có điểm dừng:

```
Chơi với máy (8 cấp, được xin gợi ý)
   -> Review ván: chấm từng nước, HLV giải thích
   -> Mỗi nước Sai / Sai nghiêm trọng thành một "thẻ ôn tập"
   -> Ôn tập hôm nay: thẻ lỗi của chính mình đến hạn
                     + bài tập từ kho puzzle, ưu tiên chủ đề mình hay sai
   -> quay lại chơi
```

Thẻ ôn tập dùng lặp lại ngắt quãng: giải đúng thì lần sau gặp lại muộn hơn, sai thì gặp lại sớm. Kho puzzle là toàn bộ dữ liệu puzzle của Lichess (vài triệu bài) nạp vào database trên máy này, nên không bao giờ hết bài.

Thêm lộ trình bài học cơ bản (luật đi quân → chiến thuật → chiếu hết cơ bản → nguyên tắc khai cuộc → tàn cuộc Tốt) cho người mới hoàn toàn.

### Chế độ 2 — Chơi với người qua mạng

- Tạo ván, gửi **link mời** cho bạn; chọn thời gian (3+2, 5+0, 10+0, 15+10).
- Server kiểm tra mọi nước đi, giữ đồng hồ, xử lý mất kết nối, đầu hàng, đề nghị hòa.
- **Trong ván: tắt hoàn toàn engine và HLV** (để công bằng).
- **Sau ván**: review và tư vấn từ AI như chế độ 1; lỗi cũng thành thẻ ôn tập.
- Mỗi người chỉ lưu **5 ván online gần nhất**.

### Chung

- Đăng nhập bằng Google.
- Giao diện theo quy ước quen thuộc của chess.com / Lichess nhưng là nhận diện riêng, không mang dáng "sản phẩm AI" (chi tiết ở DESIGN.md).

## 2. Nguyên tắc cốt lõi của AI tư vấn

LLM 8B **không biết đánh cờ**: nếu để nó tự đánh giá nước đi, nó sẽ bịa. Vì vậy chia vai rõ ràng:

| Vai trò | Ai làm | Ghi chú |
|---|---|---|
| Nước nào đúng/sai, mất bao nhiêu | **Stockfish** | Nguồn sự thật duy nhất |
| Lỗi thuộc loại gì (hở quân, đòn đôi, bỏ lỡ chiếu hết...) | **Code tự viết** (bộ nhận diện mô-típ) | Tính bằng luật, kiểm thử được |
| Diễn đạt thành lời dễ hiểu, giọng thầy giáo | **LLM qwen3:8b qua Ollama** | Chỉ được dùng dữ kiện được đưa vào |
| Kiểm tra lại lời giải thích | **Bộ kiểm duyệt** | Sai là bỏ, dùng câu mẫu |

Gợi ý khi đang chơi với máy đi theo 3 nấc để người học tự nghĩ trước: ý tưởng → quân cần đi → nước cụ thể.

## 3. Kiến trúc tóm tắt

```
Trình duyệt người chơi                       Máy này (Windows)
┌──────────────────────────┐   HTTPS/WSS    ┌───────────────────────────────┐
│ UI (Vite + TS)           │ <────────────> │ Server Node                   │
│ Stockfish WASM (chơi,    │   qua tunnel   │  - phục vụ web tĩnh           │
│   review — chạy ở máy    │   tên miền     │  - đăng nhập Google           │
│   người chơi)            │   cố định      │  - ván online (WebSocket)     │
└──────────────────────────┘                │  - API học tập, puzzle        │
                                            │  - hàng đợi HLV -> Ollama     │
                                            │ SQLite: data/chess.db         │
                                            │ Ollama qwen3:8b (GPU)         │
                                            └───────────────────────────────┘
```

- Stockfish chạy ở trình duyệt người chơi, nên máy này không phải gánh việc phân tích.
- Máy này chỉ gánh database, ván online và LLM (một hàng đợi, có lưu đệm).
- **Máy tắt thì app không truy cập được.** Đây là đánh đổi đã chọn để miễn phí và dùng được LLM local.

## 4. Đã chốt

| Việc | Lựa chọn |
|---|---|
| Loại cờ | Cờ vua |
| Nền tảng | Web |
| Người học | Người mới + trung cấp |
| AI | Stockfish + LLM local (Ollama qwen3:8b) |
| Chơi với người | Qua mạng, link mời |
| Server + database | Trên máy này: Node + SQLite |
| Đăng nhập | Google |
| Phong cách | Theo quy ước chess.com / Lichess, nhận diện riêng |

## 5. Còn mở

1. **Tên miền cố định** cho tunnel (Google bắt buộc cần origin cố định). Máy đã cài sẵn cả ngrok và cloudflared: ngrok cho 1 tên miền tĩnh miễn phí; cloudflared cần tên miền riêng của bạn.
2. **Google OAuth client ID**: bạn tạo trên Google Cloud Console (mình sẽ hướng dẫn từng bước ở GĐ1).
3. ~~Giấy phép~~ — đã chốt 17/11/2026: **GPL-3.0-or-later** (vì Stockfish là GPL-3). Mã nguồn công khai tại github.com/Nelson1312-dak/latthe.
4. ~~Chỗ deploy~~ — đã chốt 17/11/2026: **Lật Cờ chạy ở latbai.vn** (project Vercel `latthe`). Game đảo cũ không còn trên web nữa, nhưng vẫn lấy lại được từ lịch sử git và lịch sử deploy của Vercel. Bản trên web là trang tĩnh, không có server, nên phần đăng nhập hiện "Ngoại tuyến"; muốn dùng thật thì chạy `npm run dev` trên máy. Project `co-vua` giữ lại làm nơi xem thử.
5. ~~Tên app~~ — đã chốt: **Lật Cờ**, đặt theo bộ với latbai.vn.
