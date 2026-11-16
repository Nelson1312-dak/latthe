# Kế hoạch: Game cờ vua đào tạo có AI tư vấn

Ngày lập: 16/11/2026. Thay thế toàn bộ game Quần Đảo Vô Tận cũ.

## 1. Mục tiêu

Một web game cờ vua giúp **người mới và người chơi trung cấp** tiến bộ thật, không chỉ để chơi:

- **Học**: lộ trình bài học từ luật đi quân đến chiến thuật cơ bản.
- **Luyện**: bài tập chiến thuật (puzzle) theo chủ đề và theo cấp độ.
- **Chơi**: đấu với máy ở nhiều mức, có thể xin gợi ý.
- **Review**: sau mỗi ván, AI chấm từng nước và giải thích bằng tiếng Việt vì sao hay/dở, nên đi gì.

Chốt với người dùng: cờ vua, web (Vite + TypeScript), AI = engine + LLM chạy local (Ollama).

## 2. Nguyên tắc cốt lõi của AI tư vấn

LLM 8B **không biết đánh cờ**: nếu để nó tự đánh giá nước đi, nó sẽ bịa. Vì vậy chia vai rõ ràng:

| Vai trò | Ai làm | Ghi chú |
|---|---|---|
| Nước nào đúng/sai, mất bao nhiêu | **Stockfish** | Nguồn sự thật duy nhất |
| Lỗi thuộc loại gì (để hở quân, bỏ lỡ chiếu hết, bị đòn đôi...) | **Code tự viết** (bộ nhận diện mô-típ) | Tính bằng luật, kiểm thử được |
| Diễn đạt thành lời dễ hiểu, giọng thầy giáo | **LLM (qwen3:8b qua Ollama)** | Chỉ được dùng dữ kiện được đưa vào |
| Kiểm tra lại lời giải thích | **Bộ kiểm duyệt** | Sai là bỏ, dùng câu mẫu |

Luồng cho mỗi nước cần review:

```
FEN + nước đã đi
  -> Stockfish (MultiPV 3, độ sâu cố định)        -> đánh giá trước/sau, 3 nước tốt nhất
  -> Tính % thắng mất đi (công thức Lichess)        -> xếp loại: Hay / Tốt / Thiếu chính xác / Sai / Sai nghiêm trọng
  -> Bộ nhận diện mô-típ                            -> thẻ: hở quân, đòn đôi, ghim, chiếu hết bỏ lỡ, hàng cuối...
  -> Gói dữ kiện JSON -> LLM (prompt tiếng Việt, tắt chế độ "think")
  -> Kiểm duyệt: mọi nước cờ nêu trong câu trả lời phải nằm trong danh sách cho phép,
     không được nêu con số không có trong dữ kiện, độ dài trong giới hạn
  -> Đạt: hiển thị | Không đạt hoặc Ollama tắt: dùng câu mẫu theo thẻ mô-típ
```

Kết quả được lưu đệm theo (FEN, nước đi) để không gọi lại.

**Gợi ý khi đang chơi** đi theo 3 nấc để người học tự nghĩ trước:
1. Ý tưởng ("Có một quân đen đang không được bảo vệ")
2. Quân cần đi ("Hãy nhìn con mã")
3. Nước cụ thể (Nf5)

## 3. Kiến trúc và công nghệ

```
Trình duyệt
 ├─ UI: Vite + TypeScript thuần (không framework nặng)
 ├─ Luật cờ: chess.js
 ├─ Bàn cờ: cm-chessboard (MIT) hoặc tự vẽ SVG
 ├─ Engine: Stockfish WASM chạy trong Web Worker
 ├─ Bộ nhận diện mô-típ + kiểm duyệt: TypeScript, có unit test
 └─ Lưu tiến độ: localStorage / IndexedDB
       │
       │  /ollama  (Vite dev proxy khi chạy local)
       ▼
Ollama trên máy (qwen3:8b, đã có sẵn; GTX 1660 Super 6 GB)
```

Dữ liệu (đều CC0, dùng tự do):
- Puzzle: cơ sở dữ liệu puzzle của Lichess, có sẵn thẻ chủ đề và độ khó. Lọc lấy khoảng 3.000 bài phù hợp người mới/trung cấp.
- Khai cuộc: bộ `chess-openings` của Lichess (tên khai cuộc theo ECO).

**Về chuyện LLM local khi deploy lên Vercel:** trang web công khai không gọi được Ollama trên máy bạn. Khi không kết nối được Ollama, AI tư vấn tự chuyển sang chế độ câu mẫu (vẫn có Stockfish và thẻ mô-típ, chỉ kém tự nhiên hơn). Mở Ollama ra internet (qua tunnel) chỉ làm sau, khi có khóa xác thực.

## 4. Lộ trình theo giai đoạn

Mỗi giai đoạn kết thúc bằng một bản chạy được và có tiêu chí "xong" rõ ràng.

### GĐ0 — Dọn repo, dựng khung
- Commit việc xóa game cũ. Cập nhật `.gitignore`, `.claude/launch.json`, README.
- Vite + TS + Vitest. Cấu trúc `src/core`, `src/engine`, `src/advisor`, `src/ui`, `src/training`.
- Chốt giấy phép (xem mục 7).
- **Xong khi:** `npm run dev` mở trang trống, `npm test` chạy được.

### GĐ1 — Bàn cờ chơi được
- Đi quân bằng kéo thả và bấm-chọn, tô ô đi được, nước vừa đi, chiếu.
- Đủ luật: nhập thành, bắt tốt qua đường, phong cấp (hộp chọn quân), hòa (3 lần lặp, 50 nước, thiếu quân, hết nước đi).
- Lật bàn, lùi/tiến nước, nhập/xuất PGN và FEN, tự lưu ván đang chơi.
- **Xong khi:** chơi trọn một ván 2 người trên máy tính và điện thoại; test perft của chess.js đạt.

### GĐ2 — Chơi với máy
- Stockfish WASM trong Web Worker, giao tiếp UCI qua lớp bọc có hàng đợi lệnh.
- 8 cấp độ (dùng `UCI_LimitStrength` / `UCI_Elo`, cấp thấp nhất tự cố ý đi kém).
- Thanh đánh giá thế cờ (bật/tắt được).
- **Xong khi:** thắng được cấp 1 dễ dàng, cấp 8 đánh như máy mạnh; UI không đứng hình khi máy nghĩ.

### GĐ3 — Review ván (chưa cần LLM)
- Phân tích toàn ván chạy nền, có thanh tiến độ.
- Xếp loại từng nước, độ chính xác (%) mỗi bên, biểu đồ đánh giá theo nước, nhảy tới các nước sai.
- Với mỗi nước sai: hiện nước tốt hơn và cho "thử lại" từ thế cờ đó.
- **Xong khi:** review một ván 40 nước trong dưới 60 giây; kết quả xếp loại khớp Lichess ở đa số nước trên bộ ván mẫu.

### GĐ4 — AI tư vấn
- Bộ nhận diện mô-típ: quân bị treo, đòn đôi, ghim, xiên, chiếu hết trong 1–3 nước bị bỏ lỡ, yếu hàng cuối, đổi quân thiệt.
- Client Ollama (stream câu trả lời), prompt tiếng Việt, kiểm duyệt đầu ra, câu mẫu dự phòng, lưu đệm.
- Gợi ý 3 nấc khi đang chơi; nút "Vì sao?" ở mọi nước trong review.
- **Xong khi:** trên bộ 50 thế cờ mẫu có đáp án, giải thích không nêu sai nước nào (bộ kiểm duyệt chặn hết); tắt Ollama thì app vẫn chạy bình thường bằng câu mẫu.

### GĐ5 — Đào tạo
- Lộ trình bài học (khoảng 30 bài): đi quân → chiếu/chiếu hết → giá trị quân → chiến thuật (đòn đôi, ghim, xiên, tấn công lộ) → chiếu hết cơ bản (Hậu+Vua, Xe+Vua) → nguyên tắc khai cuộc → tàn cuộc Tốt cơ bản. Mỗi bài: giải thích ngắn + bàn cờ tương tác + vài bài tập.
- Luyện puzzle theo chủ đề, độ khó tự điều chỉnh theo kết quả (rating người học).
- Bảng tiến độ: bài đã học, chủ đề mạnh/yếu (rút ra từ lỗi trong các ván đã review), chuỗi ngày luyện.
- AI gợi ý "hôm nay nên luyện gì" dựa trên chủ đề yếu nhất.
- **Xong khi:** một người mới đi hết được lộ trình từ đầu đến cuối, tiến độ lưu lại sau khi tải lại trang.

### GĐ6 — Hoàn thiện và phát hành
- Giao diện điện thoại, chế độ tối, âm thanh, hướng dẫn lần đầu.
- Deploy Vercel (bản công khai dùng chế độ câu mẫu).
- Kiểm thử end-to-end các luồng chính.

## 5. Kiểm thử

- **Luật cờ:** perft và các thế cờ đặc biệt (phong cấp, bắt tốt qua đường, nhập thành bị chặn).
- **Bộ nhận diện mô-típ:** mỗi mô-típ có thế cờ mẫu dương tính và âm tính.
- **AI tư vấn:** bộ 50 thế cờ có đáp án; đo tỉ lệ câu trả lời bị bộ kiểm duyệt chặn và đọc tay một mẫu để chấm độ dễ hiểu.
- **Hiệu năng:** thời gian review một ván, thời gian LLM trả lời (mục tiêu dưới 5 giây cho câu đầu tiên).

## 6. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| LLM 8B nói sai về thế cờ | Chỉ cho diễn đạt dữ kiện; kiểm duyệt; câu mẫu dự phòng |
| qwen3:8b chậm hoặc thiếu VRAM (5,2 GB / 6 GB) | Câu trả lời ngắn, stream, lưu đệm; thử bản lượng tử hóa nhỏ hơn nếu cần |
| Stockfish WASM nặng trên điện thoại | Dùng bản lite, giới hạn độ sâu trên mobile |
| Bản web công khai không có LLM | Chế độ câu mẫu là tính năng chính thức, không phải lỗi |
| Giấy phép GPL của Stockfish | Xem mục 7 |

## 7. Quyết định còn mở

1. **Giấy phép.** Stockfish là GPL-3; đưa nó lên web là phân phối, nên mã nguồn game cũng phải công khai theo GPL-3 (repo GitHub đang có sẵn). Nếu muốn giữ mã kín thì phải chạy engine ở server riêng thay vì trong trình duyệt.
2. **Bản Vercel cũ** (project `latthe`) vẫn đang chạy game cũ cho tới khi deploy bản mới hoặc gỡ.
3. **Tài khoản người dùng / đồng bộ tiến độ** giữa các máy: chưa làm ở các giai đoạn trên, chỉ lưu trong trình duyệt.
