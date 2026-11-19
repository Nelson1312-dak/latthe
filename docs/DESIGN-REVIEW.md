# Rà thiết kế: cổng tự động và agent rà design

Mục tiêu: giao diện không quay lại kiểu "trông như AI làm" sau mỗi lần thêm tính năng.
Không dựa vào cảm nhận từng đợt; có hai lớp với một đích so sánh cố định.

## Lớp 1 — Cổng tự động (máy, mọi lần deploy)

`npm run deploy` build xong thì tự chạy, trên đúng bản vừa build (`vite preview`, không có API):

1. `scripts/check-design.mjs` — **chặn deploy** nếu còn lỗi:
   - danh sách cấm ở `docs/DESIGN.md` mục 2 mà máy đo được: emoji, kính mờ, font Inter, gradient
     (trừ ô Vua bị chiếu), bo góc ≥ 10px, bóng đổ ngoài quy định, vạch màu bên trái ≥ 2px;
   - **màu nhấn ngoài nút chính** (`--accent` chỉ cho `.btn-primary` và công tắc bật);
   - icon thanh điều hướng là nét mảnh (phải là icon đặc `nav-*`);
   - chữ chức năng nhỏ hơn 11px; ô số to (`.stat-tile`) ngoài trang Thống kê;
   - tương phản chữ dưới 4,5:1, vùng bấm dưới 44px trên điện thoại, tràn ngang, lỗi JS.
2. `scripts/visual-diff.mjs` — **chỉ báo**: so ảnh chụp 10 màn cố định (khách, điện thoại và
   máy tính) với ảnh chuẩn `design/baseline/`. Màn nào đổi thì ghi ảnh mới và ảnh tô đỏ vùng
   đổi vào `shots/diff/`. Đổi có thể là cố ý: duyệt xong thì
   `node scripts/visual-diff.mjs --update` rồi commit ảnh chuẩn mới.

Chạy tay lúc đang sửa: `npm run dev` rồi `npm run check:design`; hoặc `npm run build` rồi
`node scripts/visual-diff.mjs`. Khẩn cấp cần deploy bỏ qua cổng: `SKIP_DESIGN_CHECK=1`.

Thêm luật mới: lỗi nào từng phải sửa tay mà máy đo được thì thêm vào `check-design.mjs`
(phần "AI làm", cuối file) để không phải bắt lại bằng mắt lần nữa.

## Lớp 2 — Agent rà design (mỗi lần đổi giao diện)

Agent `design-reviewer` (định nghĩa ở `.claude/agents/design-reviewer.md`, chỉ có trên máy
phát triển). Claude Code gọi nó **trước khi báo xong** mọi thay đổi giao diện. Nó:

1. chụp mọi màn bằng `scripts/design-shots.mjs` (khách và đã đăng nhập; điện thoại 390×844,
   iPhone có thanh Safari 390×705, máy tính 1440×900; đang đánh, hết ván, xem lại, cài đặt…);
2. chạy cổng tự động ở trên;
3. xem từng ảnh, so với đích ở dưới và danh sách cấm, trả về tối đa 15 lỗi xếp theo mức nặng,
   mỗi lỗi có màn, phần tử, vì sao trông như máy làm, cách sửa (selector/file);
4. **chỉ báo, không tự sửa** — để giao diện không trôi theo từng lượt rà.

## Đích so sánh (cố định)

Giao diện là app chơi cờ, không phải dashboard. Đúng khi một người chơi chess.com/Lichess mở ra
là biết mọi thứ ở đâu, và không thấy dấu vết của mẫu dựng sẵn.

- **Bàn cờ là thứ to nhất**, liền mép (điện thoại dọc: tràn hết bề ngang). Quân, bàn: bộ hoạ sĩ vẽ.
- **Một cột bên phải** (máy tính) như chess.com: tiêu đề + thanh công cụ dính liền, sổ nước giãn,
  nút tua và nút việc ở đáy. Điện thoại: thanh điều khiển ván ở đáy khi đang đánh.
- **Một màu nhấn** cho nút chính. Trạng thái đang chọn đọc bằng độ sáng + vạch trắng ở đáy.
- **Icon:** điều hướng đặc, hình của cờ; nút nhỏ trên thanh công cụ mới dùng nét.
- **Chữ:** IBM Plex Sans; 700 chỉ cho tiêu đề màn, nút chính, số to; còn lại 400–500.
- **Dữ liệu thật, viết gọn:** Elo cạnh tên, số đặt thành dòng (nhãn trái, số phải), biểu đồ
  đánh giá như mọi trang cờ; không câu giải thích dưới mỗi dòng, không ô số to, không biểu đồ
  trang trí.
- **Nút việc chính và lối tắt quan trọng** luôn nằm trước mọi bảng tuỳ chọn, trong màn đầu.

Những dấu hiệu từng bị bắt (chi tiết ở `docs/DESIGN.md` mục 2): màu nhấn gánh nhiều việc,
nhiều kiểu "đang chọn", ô xám bo góc rời rạc, icon nét mảnh kiểu bộ dựng sẵn, vạch màu bên trái,
"tiêu đề đậm + câu giải thích xám" lặp ở mọi dòng, ô số to, hộp lồng hộp, chữ đậm khắp nơi,
cột phải trống, thẻ người chơi như dữ liệu giả, dải ô màu tự chế, chân trang chen giữa màn chơi.
