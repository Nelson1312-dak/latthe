# Đưa người chơi tới latbai.vn

Trang mới, chưa có link nào trỏ về, nên Google chưa xếp hạng cao. Cách nhanh nhất để có
người chơi trong vài tuần đầu là **đưa link tới tận chỗ người chơi cờ đang ở**: nhóm Facebook,
Zalo, diễn đàn. Mỗi lượt đăng còn tạo một link trỏ về trang, giúp Google tin trang hơn.

Đo kết quả ở màn **Thống kê** trong app (lượt vào, "Xem trang đọc") và **Search Console →
Hiệu suất**. Mỗi bài đăng dùng một link khác nhau để biết bài nào kéo được người.

## 1. Việc làm một lần (khoảng 20 phút)

1. **Search Console → Kiểm tra URL** (ô trên cùng): dán từng link dưới đây, bấm
   **Yêu cầu lập chỉ mục**. Mỗi ngày Google cho khoảng 10 lượt.
   - https://latbai.vn/
   - https://latbai.vn/bai-tap-co-vua/
   - https://latbai.vn/choi-co-vua-voi-may/
   - https://latbai.vn/choi-co-vua-online/
   - https://latbai.vn/luat-co-vua/
   - https://latbai.vn/bay-khai-cuoc/chieu-het-4-nuoc/
   - https://latbai.vn/bai-tap-co-vua/chieu-het-2-nuoc/
   - https://latbai.vn/khai-cuoc/
   - https://latbai.vn/hoc/
   - https://latbai.vn/meo-choi-co-vua/
2. **Bing Webmaster Tools** (bing.com/webmasters): đăng nhập, chọn **Nhập từ Google Search
   Console**. Bing là nguồn kết quả của DuckDuckGo, Yahoo, Ecosia. Từ giờ mỗi lần
   `npm run deploy`, app tự báo Bing các trang mới (IndexNow), không cần làm gì thêm.
3. **GitHub**: ở trang repo, bấm bánh răng cạnh **About**, điền Website `https://latbai.vn`,
   thêm topics `chess`, `co-vua`, `stockfish`, `vietnamese`.

## 2. Đăng ở đâu

| Nơi | Tìm thế nào | Hợp với bài |
|---|---|---|
| Nhóm Facebook cờ vua | Tìm "cờ vua", "cờ vua Việt Nam", "học cờ vua", "câu lạc bộ cờ vua" + tên tỉnh | A, B, C |
| Nhóm phụ huynh | "phụ huynh cho con học cờ vua", nhóm lớp, nhóm trường của con | C, D |
| Zalo | Nhóm bạn bè, đồng nghiệp, nhóm lớp | D |
| Voz, Tinh tế | Mục chia sẻ sản phẩm tự làm / phần mềm | E |
| CLB cờ trường học, đại học | Fanpage CLB, nhắn admin xin đăng | A, B |

Đọc nội quy nhóm trước khi đăng. Mỗi nhóm một bài, cách nhau vài ngày; không dán cùng một bài
vào nhiều nhóm cùng lúc (Facebook coi là spam và chặn link).

## 3. Bài đăng soạn sẵn

Dán link vào là Facebook, Zalo tự hiện ảnh thế cờ của trang đó.

### A. Giới thiệu (nhóm cờ vua)

> Mình làm một trang chơi cờ vua bằng tiếng Việt, miễn phí, không quảng cáo: latbai.vn
>
> Chơi với máy 8 cấp (cấp 1 hợp người mới; cấp 8 là Stockfish mạnh hết sức), chơi với
> người theo Elo, và hết ván thì máy chấm từng nước: nước nào hỏng, đáng lẽ nên đi gì. Có hơn
> một triệu bài tập theo chủ đề.
>
> Trang còn mới, anh em chơi thử rồi góp ý giúp mình chỗ nào chưa tiện nhé.
>
> https://latbai.vn/choi-co-vua-voi-may/

### B. Đố vui (đăng ảnh thế cờ, lời giải ở link)

> Chiếu hết trong 2 nước. Ai giải được không?
>
> Lời giải và thêm 8 bài cùng dạng (dễ, vừa, khó): https://latbai.vn/bai-tap-co-vua/chieu-het-2-nuoc/

Đổi chủ đề cho mỗi lần đăng: `chieu-het-1-nuoc`, `don-doi`, `ghim-quan`, `chieu-het-hang-cuoi`,
`chieu-het-nghet-tho`… (danh sách ở https://latbai.vn/bai-tap-co-vua/).

### C. Bẫy chiếu hết 4 nước (người mới, phụ huynh)

> Con mới học cờ hay bị chiếu hết sau 4 nước? Đây là cái bẫy người mới dính nhiều nhất, kèm
> cách đỡ chỉ bằng một nước Tốt:
>
> https://latbai.vn/bay-khai-cuoc/chieu-het-4-nuoc/

Bài tiếp theo cùng kiểu: https://latbai.vn/bay-khai-cuoc/chieu-het-2-nuoc/ (ván cờ ngắn nhất),
https://latbai.vn/bay-khai-cuoc/bay-legal/.

### D. Rủ bạn chơi (Zalo, nhắn riêng)

> Làm một ván cờ không? Vào latbai.vn → Chơi → Với người → Mời người quen, gửi mã cho tao là vào
> cùng ván. Thua thì máy còn chấm cho xem đi hỏng ở đâu.

### E. Diễn đàn công nghệ (Voz, Tinh tế)

> Mình làm một web cờ vua tiếng Việt, mã nguồn mở (GPL-3): latbai.vn
>
> Stockfish chạy ngay trong trình duyệt để chấm từng nước sau ván. Có Huấn luyện viên
> dùng mô hình ngôn ngữ chạy trên máy nhà để giải thích lỗi; mọi lời nhắc tới nước đi, ô cờ đều
> được code kiểm lại với engine, sai là thay bằng câu mẫu. Ghép trận online theo Elo, không có
> ai thì 5 giây sau cho đấu AI (ghi rõ là AI).
>
> Mã nguồn: https://github.com/Nelson1312-dak/latthe — mọi góp ý đều quý.

## 4. Nhịp đăng gợi ý

- Tuần 1: làm hết mục 1; đăng A ở 2 nhóm cờ, D cho 5–10 người quen.
- Tuần 2: B mỗi 2–3 ngày một chủ đề; C ở 1–2 nhóm phụ huynh.
- Tuần 3: E ở một diễn đàn; xem Thống kê và Search Console, bài nào kéo người nhiều thì làm
  thêm trang cùng dạng.
