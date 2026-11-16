# Design system

Lập ngày 16/11/2026. Đây là phần **làm đầu tiên**, trước mọi logic. Không màn hình nào được dựng khi token và component của nó chưa có trên trang mẫu (specimen) và chưa được duyệt.

## 1. Định hướng

**Theo quy ước của chess.com và Lichess, nhưng là sản phẩm của riêng mình.**

Người chơi cờ đã quen bố cục của hai trang này: bàn cờ chiếm phần lớn màn hình, tên và đồng hồ hai bên nằm sát mép trên/dưới bàn, danh sách nước đi hai cột ở bảng bên phải, ký hiệu `!!` `?` `??` cho chất lượng nước đi. Đi theo những quy ước đó giúp app dễ dùng ngay. Nhưng **không sao chép** nhận diện thương hiệu của họ.

| Lấy theo (quy ước chung của cờ) | Không lấy (thuộc về thương hiệu của họ) |
|---|---|
| Bàn cờ là trung tâm, bảng bên phải, thanh đánh giá bên trái bàn | Logo, tên, linh vật, giọng văn |
| Thanh người chơi + đồng hồ sát mép bàn | Bảng màu thương hiệu (xanh lá chess.com, nâu-cam Lichess) làm màu chủ đạo |
| Danh sách nước đi dạng bảng 2 cột, ký hiệu quân bằng hình | Bộ quân cờ độc quyền của chess.com |
| Ký hiệu chú giải cờ chuẩn: `!!` `!` `!?` `?!` `?` `??` | Biểu tượng xếp loại nước đi riêng của chess.com |
| Phím tắt: ← → để lùi/tiến, `f` lật bàn | |
| Giao diện tối là mặc định, có giao diện sáng | |

## 2. Thế nào là "trông như sản phẩm AI" và quy tắc tránh

Danh sách **cấm**, dùng để duyệt mọi màn hình:

- Gradient tím/xanh, nền "mesh", hiệu ứng kính mờ (backdrop blur).
- Emoji làm icon, biểu tượng lấp lánh ✨ cho tính năng AI, huy hiệu "AI-powered".
- Thẻ bo góc lớn (16px trở lên) với bóng đổ mềm và to; mọi thứ nằm trong card.
- Hero căn giữa kiểu trang marketing, khẩu hiệu to ở trang chủ.
- Font Inter mặc định, bộ icon Lucide dùng nguyên không chọn lọc.
- Chữ xám nhạt trên nền xám (tương phản kém), khoảng trắng thừa thãi khiến thông tin loãng.
- Văn phong: "Hãy cùng khám phá!", dấu chấm than dày đặc, gọi AI là "trợ lý thông minh".
- Nội dung giả: "Lorem ipsum", "Người chơi 1", bàn cờ ở thế khai cuộc trong ảnh minh họa.

Thay vào đó:

- **Ít hộp, nhiều nhịp.** Đây là luật quan trọng nhất. Thứ làm giao diện trông như máy sinh ra
  là nhét mỗi mẩu thông tin vào một thẻ bo góc riêng. Mỗi cột chỉ có **một** mặt nền (`.sheet`),
  bên trong chia bằng nét kẻ 1px. Tiêu đề phần là chữ nhỏ kèm nét kẻ (`rule()`), không phải
  tiêu đề to.
- **Số liệu viết thành dòng** (`stats()`), không phải ô to kiểu bảng điều khiển. Không có
  "nhãn xám nhỏ + số mono to" xếp thành lưới.
- **Mật độ thông tin cao, bề mặt phẳng.** Tách lớp bằng độ sáng của nền (4 bậc), không dùng bóng đổ.
  Chỉ hộp thoại được nổi lên và có bóng, vì nó chặn thao tác.
- **Bo góc nhỏ**: 4px cho nút/ô nhập, 6px cho mặt nền.
- **Chữ là chữ của người chơi cờ**: chiếu, chiếu hết, nhập thành, phong cấp, bắt tốt qua đường, khai cuộc, trung cuộc, tàn cuộc. AI tư vấn gọi là **"Huấn luyện viên"**, nói ngắn, như một người thầy ngồi cạnh, không có hình robot.
- **Icon tự vẽ** 26 cái trên lưới 24px, nét 1,5px, đầu nét vuông, cùng một bộ.
- **Dùng từ vựng hình của cờ**: nước đi viết bằng hình quân (`Nf3` → hình Mã + `f3`), bên cầm
  quân hiện bằng một con Vua nhỏ chứ không phải ảnh đại diện chung chung hay ô vuông tô màu
  (dễ bị nhầm thành ô tích chọn).
- **Việc phụ gom thành nhóm nút dính liền** (`toolbar()`), không phải một hàng nút rời rạc
  cùng cỡ.
- **Dữ liệu thật** ở mọi chỗ, kể cả trang mẫu: thế cờ thật, ván thật, tên khai cuộc thật.

## 3. Bố cục

### Header chung

Mọi màn hình đều nằm dưới một header cao 56px:

```
┌──────────────────────────────────────────────────────────────┐
│ ♘ Cờ vua   Chơi  Xem lại  Ôn tập  Bạn bè    Thiết kế  Nelson │
└──────────────────────────────────────────────────────────────┘
```

- **Tên app là thứ to nhất trên header** (21px, đậm) kèm một con Mã làm dấu nhận diện,
  bấm vào về sảnh. Không màn nào lặp lại tên app trong tiêu đề của mình.
- Mục điều hướng đang mở có vạch nhấn 2px sát đáy header — quy ước quen thuộc của
  chess.com và Lichess.
- Tài khoản nằm bên phải, hiện tên gọi của người đang đăng nhập.
- Dưới 1100px: nhãn các mục ẩn đi, chỉ còn icon. Dưới 768px: điều hướng chuyển
  hẳn xuống thanh đáy cho vừa tầm ngón tay, header chỉ còn tên app và tài khoản.

### Desktop (từ 1024px)

```
┌──────────────────────────────────────────────────────────────┐
│ ♘ Cờ vua   Chơi  Xem lại  Ôn tập  Bạn bè           Nelson    │
├──────────────────────────────────────────────────────────────┤
│ Xem lại ván                    Phòng thủ hai Mã · C55  [nút] │
│                                                               │
│ ♚ Máy cấp 4  1550              96.1%   │ Huấn luyện viên      │
│ ┌─┬─────────────────────────────────┐  │ (lời bình)           │
│ │E│                                 │  ├──────────────────────┤
│ │v│            BÀN CỜ               │  │ Diễn biến (biểu đồ)  │
│ │a│   (vuông, cao tối đa = chiều    │  ├──────────────────────┤
│ │l│    cao cửa sổ trừ header và     │  │ 1. e4     e5         │
│ │ │    hai thanh người chơi)        │  │ 2. ♘f3    ♘c6        │
│ └─┴─────────────────────────────────┘  │ ...                  │
│ ♔ Nelson  1180                 90.6%   │ |◀ ◀ ▶ ▶|            │
└──────────────────────────────────────────────────────────────┘
```

- Thanh đánh giá rộng 22px, **dính sát** cạnh trái bàn cờ (cùng trong một khung viền).
- Bảng bên phải rộng 380px, cố định; bàn cờ co giãn theo phần còn lại.

### Điện thoại (dưới 768px)

```
┌───────────────────────┐
│ ♘ Cờ vua      📖  👤 │  header rút gọn
├───────────────────────┤
│ Máy cấp 4       08:41 │
│ ┌───────────────────┐ │
│ │      BÀN CỜ       │ │  rộng hết màn hình
│ └───────────────────┘ │
│ Bạn             09:12 │
│ ▬▬▬▬ thanh đánh giá ▬ │  nằm ngang dưới bàn
│ 1.e4 e5 2.♘f3 ♘c6 ... │  danh sách nước cuộn ngang
│ ┌───────────────────┐ │
│ │ Huấn luyện viên   │ │
│ └───────────────────┘ │
├───────────────────────┤
│ Chơi  Ôn  Học  Bạn    │  nav dưới
└───────────────────────┘
```

Máy tính bảng (768–1100px): như desktop nhưng các mục trên header chỉ còn icon, bảng bên phải 320px.

## 4. Token

Tất cả màu, cỡ chữ, khoảng cách là biến CSS trong `src/ui/tokens.css`. Không component nào được viết màu cứng. Giá trị dưới đây là điểm xuất phát, sẽ chỉnh trên trang mẫu.

### 4.1 Màu nền và chữ

| Token | Tối (mặc định) | Sáng | Dùng cho |
|---|---|---|---|
| `--bg-0` | `#1A1917` | `#F3F1EC` | Nền trang |
| `--bg-1` | `#22211E` | `#FFFFFF` | Bảng, nav |
| `--bg-2` | `#2C2A27` | `#ECE9E2` | Ô nhập, dòng được chọn |
| `--bg-3` | `#37352F` | `#E2DED5` | Hover |
| `--line` | `#3A3833` | `#D9D4C9` | Viền 1px |
| `--text-1` | `#ECE8E1` | `#1D1B18` | Chữ chính |
| `--text-2` | `#B3ADA3` | `#57524A` | Chữ phụ (vẫn đạt tương phản 4.5:1) |
| `--text-3` | `#857F75` | `#7D776D` | Nhãn, chú thích nhỏ |

Nền ngả ấm (xám nâu) chứ không phải xám xanh lạnh kiểu dashboard.

### 4.2 Màu nhấn và trạng thái

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--accent` | `#E2A03F` (hổ phách) | Nút hành động chính ("Chơi"), trạng thái đang chọn. Chữ trên nền nhấn màu tối `#1A1917` |
| `--accent-hover` | `#EDB25A` | |
| `--danger` | `#D2493E` | Đầu hàng, xóa, hết giờ |
| `--ok` | `#6FA35A` | Kết nối tốt, giải đúng |
| `--clock-active` | `--text-1` trên `--bg-3` | Đồng hồ bên đang đi |
| `--clock-low` | `#D2493E` | Dưới 20 giây |

Chỉ có **một** màu nhấn. Màu xếp loại nước đi (dưới đây) là ngôn ngữ riêng, không dùng làm màu trang trí.

### 4.3 Xếp loại nước đi

Dùng ký hiệu chú giải cờ chuẩn, hiển thị thành huy hiệu tròn 16px cạnh nước đi và trên ô đích của bàn cờ khi review.

| Loại | Ký hiệu | Màu | Điều kiện (xem IMPLEMENTATION.md) |
|---|---|---|---|
| Sách (nước khai cuộc lý thuyết) | icon sách (tự vẽ) | `#A38B6D` | Có trong dữ liệu khai cuộc |
| Tốt nhất | `★` | `#5FA36A` | Trùng nước tốt nhất của engine |
| Tốt | `✓` | `#8FB07A` | Mất cơ hội thắng < 0,1 |
| Thiếu chính xác | `?!` | `#E3B53B` | ≥ 0,1 |
| Sai | `?` | `#E2873A` | ≥ 0,2 |
| Sai nghiêm trọng | `??` | `#D2493E` | ≥ 0,3 |
| Bỏ lỡ | `✕` | `#C2675E` | Có chiếu hết hoặc thắng quân mà không đi |

Thang màu xanh → vàng → cam → đỏ là quy ước chung; giá trị màu là của riêng app.

### 4.4 Chữ

- **IBM Plex Sans** cho giao diện; **IBM Plex Mono** cho đồng hồ, điểm đánh giá, FEN/PGN;
  **IBM Plex Serif** cho lời bình của Huấn luyện viên và chữ đọc thành câu. Ba kiểu chữ cùng
  một họ nên đi với nhau được, mà chữ có chân ở phần lời bình tạo cảm giác chú thích trong
  sách cờ thay vì khung chat của trợ lý. Cả ba có đủ dấu tiếng Việt (đã kiểm tra).
- Tự host file woff2 (bộ ký tự Latin + Việt) trong `public/fonts/`, không gọi Google Fonts lúc chạy.

| Token | Cỡ / dòng | Độ đậm | Dùng cho |
|---|---|---|---|
| `--fs-xs` | 12 / 16 | 500 | Nhãn, tọa độ bàn cờ |
| `--fs-sm` | 13 / 18 | 400 | Danh sách nước, chú thích |
| `--fs-md` | 14 / 20 | 400 | Chữ cơ bản trên desktop |
| `--fs-lg` | 16 / 24 | 500 | Chữ cơ bản trên điện thoại, lời bình HLV |
| `--fs-xl` | 20 / 28 | 600 | Tiêu đề màn hình |
| `--fs-2xl` | 28 / 34 | 600 | Kết quả ván ("Trắng thắng · hết giờ") |
| `--fs-clock` | 24 / 28 Mono | 500 | Đồng hồ |

Không có cỡ chữ nào lớn hơn 28px. Không chữ in hoa toàn bộ trừ nhãn rất nhỏ.

### 4.5 Khoảng cách, bo góc, viền

- Khoảng cách theo bậc 4px: `4, 8, 12, 16, 24, 32, 48`.
- Bo góc: `--r-sm 4px` (nút, ô nhập, huy hiệu vuông), `--r-md 6px` (bảng). Huy hiệu xếp loại tròn.
- Không bóng đổ, trừ menu nổi và hộp thoại: một bóng duy nhất `0 8px 24px rgb(0 0 0 / .35)`.

### 4.6 Chuyển động

- Quân cờ di chuyển 150ms `ease-out`; ăn quân: quân bị ăn mờ dần 100ms.
- Bảng, tab: chuyển ngay, không trượt, không nảy.
- Tôn trọng `prefers-reduced-motion`: tắt mọi chuyển động trừ quân cờ (giảm còn 60ms).

### 4.7 Âm thanh

Bốn âm ngắn: đi quân, ăn quân, chiếu, kết thúc ván; thêm tiếng tích khi đồng hồ dưới 10 giây. Mặc định bật, có nút tắt. Nguồn âm thanh phải có giấy phép rõ ràng (CC0 hoặc tự thu).

## 5. Bàn cờ

| Phần | Quy định |
|---|---|
| Màu ô | 3 chủ đề: **Gỗ** `#EAD8B6 / #B08A62` (mặc định), **Xanh** `#E8E9D0 / #7A9A5C`, **Đá** `#DADFE3 / #8697A6` |
| Quân | Bộ **cburnett** (CC BY-SA 3.0, xem `public/pieces/LICENSE.txt`). Hình quân nhỏ trong chữ có quầng mảnh (`--piece-halo`) để quân cùng tông với nền vẫn đọc được |
| Tọa độ | Chữ `--fs-xs` nằm trong góc ô biên, màu là màu ô đối diện |
| Nước vừa đi | Phủ `rgb(232 196 80 / .42)` lên ô đi và ô đến |
| Ô đang chọn | Phủ `rgb(232 196 80 / .55)` |
| Nước hợp lệ | Chấm tròn đường kính 28% ô, `rgb(0 0 0 / .2)`; ô có quân đối phương: vòng tròn viền dày |
| Vua bị chiếu | Gradient tròn đỏ từ tâm ô (gradient duy nhất được phép, vì có chức năng) |
| Mũi tên HLV | Màu "Tốt nhất" `#5FA36A`, độ mờ 0,8 |
| Mũi tên người chơi | Chuột phải kéo để vẽ, màu cam `#E2873A` |
| Huy hiệu xếp loại | Góc trên phải ô đích, 30% kích thước ô |

## 6. Component

Mỗi component có đủ trạng thái (thường, hover, nhấn, focus, vô hiệu, đang tải) ở cả hai giao diện trên trang mẫu.

| Component | Ghi chú chính |
|---|---|
| `Button` | 4 kiểu: chính (nền nhấn), phụ, chữ, nguy hiểm. Cao 34px desktop, 44px điện thoại |
| `toolbar` | Gom nút phụ thành nhóm dính liền, ngăn bằng nét kẻ |
| `sheet` / `rule` / `stats` | Mặt nền chung, tiêu đề nhỏ kèm nét kẻ, số liệu viết thành dòng |
| `figurine` | Nước đi viết bằng hình quân, kèm tên quân cho trình đọc màn hình |
| `PlayerStrip` | Con Vua chỉ bên cầm quân, tên, rating, trạng thái, quân đã ăn xếp chồng + chênh lệch vật chất, đồng hồ hoặc độ chính xác |
| `Clock` | Mono, bên đang đi có nền sáng hơn; dưới 20 giây chuyển đỏ và hiện phần mười giây |
| `MoveList` | Sổ ghi ván: số nước treo ra lề, hai cột Trắng/Đen, ký hiệu hình, huy hiệu xếp loại, cột điểm khi xem lại, dòng đang xem có vạch nhấn |
| `EvalBar` | Dọc (desktop) hoặc ngang (điện thoại), hiển thị `+1.4` / `M3`, chuyển 300ms |
| `EvalGraph` | Biểu đồ vùng theo nước, chấm màu ở nước Sai/Sai nghiêm trọng, bấm để nhảy tới |
| `CoachPanel` | Lời bình như chú thích bên lề sách cờ: vạch dọc bên trái, đầu đề là nước đi + xếp loại, phần giải thích dùng chữ có chân. Chữ hiện dần khi đang sinh. Luôn có dòng nhỏ cho biết nguồn ("Engine chấm nước · máy viết lời bình") |
| `HintButton` | 3 nấc, mỗi lần bấm mở thêm một nấc; hiện số nấc đã dùng |
| `GameResult` | Hộp thoại cuối ván: kết quả, lý do, độ chính xác hai bên, nút "Xem lại ván" là nút chính |
| `InviteCard` | Link mời, nút sao chép, trạng thái "Đang chờ đối thủ…" |
| `ReviewQueueItem` | Thẻ ôn tập: thế cờ thu nhỏ, chủ đề, lần ôn kế tiếp |
| `siteHeader` | Header chung: tên app, điều hướng, tài khoản. Mục đang chọn có vạch nhấn 2px sát đáy header |
| `Nav` | Thanh đáy, chỉ trên điện thoại; mục đang chọn có vạch nhấn 3px |
| `sideGlyph` | Con Vua nhỏ cho biết bên cầm quân |
| `notice` | Dòng trạng thái nằm trong luồng nội dung, không nổi lên trên |
| `Dialog` | Chỉ cho quyết định (đầu hàng, đề nghị hòa, phong cấp) |

## 7. Trợ năng

- Tương phản chữ tối thiểu 4.5:1; huy hiệu xếp loại luôn có ký hiệu, không chỉ dựa vào màu.
- Đi quân bằng bàn phím: Tab vào bàn cờ, phím mũi tên chọn ô, Enter chọn/đặt quân.
- Vùng bấm tối thiểu 44px trên điện thoại.
- `aria-live` cho nước đi mới của đối thủ và lời bình HLV.

## 8. Quy trình làm design (GĐ0)

1. **Token + font + bộ quân + icon** → `src/ui/tokens.css`, `public/fonts/`, `public/pieces/`, `src/ui/icons.ts`.
2. **Trang mẫu `/#/thiet-ke`**: mọi component ở mọi trạng thái, hai giao diện sáng/tối, bàn cờ ba chủ đề.
3. **Bản dựng tĩnh 5 màn hình chính** với dữ liệu thật, chưa có logic: Sảnh, Chơi với máy (đang có gợi ý), Review (đang xem một nước Sai nghiêm trọng), Ôn tập, Ván online (đồng hồ đang chạy). Mỗi màn có bản desktop và điện thoại.
4. **Duyệt**: chụp ảnh từng màn, đối chiếu danh sách cấm ở mục 2, gửi bạn xem. Chỉ sau khi bạn duyệt mới sang giai đoạn logic.
5. Từ đó về sau, màn hình mới nào cũng phải dựng từ component có sẵn; cần component mới thì thêm vào trang mẫu trước.

### Đã làm được bằng máy

`npm run check:design` tự rà và **chặn** những thứ sau, chạy lại được bất cứ lúc nào:

- Emoji trong giao diện, hiệu ứng kính mờ, font Inter, bộ icon tải sẵn, chữ giả.
- Gradient ngoài ô Vua bị chiếu; bo góc từ 10px trở lên; bóng đổ ngoài `--shadow-float`.
- Tương phản chữ dưới 4.5:1 (hoặc 3:1 cho chữ lớn) ở **cả hai** giao diện, trên **cả sáu** màn hình.
- Vùng bấm thấp hơn 44px ở cỡ điện thoại.
- Trang tràn ngang ở cỡ điện thoại.
- Lỗi console.

Vài token đã phải đổi để qua được phần tương phản: `--text-3`, `--danger`, `--cls-blunder`,
`--cls-inaccuracy`, và mực trên huy hiệu (`--on-badge`) đổi theo giao diện sáng/tối.

Máy **không** kiểm được "trông có giống sản phẩm AI không" — phần đó vẫn phải nhìn bằng mắt.
Những thứ chỉ phát hiện được khi xem ảnh chụp: mọi thứ đều là hộp bo góc giống nhau, số liệu
bị nhét vào ô kiểu bảng điều khiển, lời chào kiểu trợ lý ở trang chủ, và ô vuông tô màu bị
đọc nhầm thành ô tích chọn.
