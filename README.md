# Trại Nhỏ

Game idle xây căn cứ, nhìn chéo từ trên xuống, chạy thẳng trong trình duyệt. Dành cho người
ngồi văn phòng: mở một tab, thỉnh thoảng liếc, đi họp về vẫn có tiền.

```bash
npm install
npm run dev     # http://localhost:5180
```

Không máy chủ, không tài khoản, không tệp `.glb` nào — mọi hình khối dựng bằng hình nguyên
thuỷ của Three.js.

## Vòng chơi

```
cây/mỏ --(thợ đào)--> KHO (gỗ, đá, pha lê)
                       │
                       ├─(xưởng cưa rút)──> đống ván chờ tại xưởng ─┐
                       └─(lò gạch rút)────> đống gạch chờ tại lò ───┤
                                                                    │
                                                        (thợ chở hàng)
                                                                    ↓
                       KHO (ván, gạch) ──(chợ bán phần dư)──> XU
```

Ba nút thắt nối tiếp nhau, và đó là chỗ game có gì để nghĩ: thiếu thợ đào thì xưởng đói;
thiếu thợ chở thì đống hàng ở xưởng đầy và **xưởng dừng hẳn**; chợ cấp thấp thì hàng ùn
trong kho. Nâng sai chỗ là tiền không tăng.

Gỗ và đá **không bao giờ bị bán** — chúng là vật liệu xây dựng. Xu chỉ đến từ ván, gạch và
pha lê. Nên chưa có Xưởng cưa thì gần như không có thu nhập, và cái xưởng đầu tiên (50 xu +
15 gỗ, trả được ngay bằng tiền khởi đầu) là bước ngoặt của cả ván.

## Bố cục mã

| Tệp | Việc |
|---|---|
| `src/EconomyMath.ts` | Công thức cân bằng thuần tuý. Chỉnh nhịp game là chỉnh ở đây. |
| `src/Economy.ts` | Kho, chế biến, chợ, giá cả, bù giờ vắng mặt, lưu/đọc. |
| `src/WorkerManager.ts` | Phân bổ thợ, điều hướng, vòng đào–vác–giao. |
| `src/Game.ts` | Cảnh Three.js, camera, vòng render, hoạt cảnh đất mới. |
| `src/nav.ts` | Lưới phố, tìm đường theo chiều rộng, có ghi nhớ, dựng lại được. |
| `src/UI.ts` | Thanh tài nguyên, bảng đội thợ, bảng ô đất. |
| `src/config.ts` | Bố cục thế giới, bảng tài nguyên, bảng công trình, bậc lãnh thổ. |

## Những chỗ đặc tả bỏ ngỏ, và lựa chọn đã dùng

**Hiệu suất vắng mặt: 0,8 hay 0,85?** Phần chữ ghi `0.8`, đoạn mã mẫu ghi `0.85`. Đang lấy
**0,85**. Đổi ở `ECONOMY.afkEfficiency`, đúng một dòng.

**"Thuê thợ" và "Nhà ở" là hai thứ khác nhau.** Thuê thợ có đường cong giá riêng (100 × 1,25ⁿ)
nhưng đặc tả không nói nhà ở còn để làm gì. Cách giải: nhà ở quyết định **chỗ**, tiền quyết
định **lượt thuê** — muốn thêm thợ phải có cả hai.

**Thợ chở hàng không nằm trong hạn ngạch.** Hạn ngạch (-/+) chỉ nói về thợ đào. Thợ ngoài hạn
ngạch tự đi chở hàng từ xưởng về chợ, nên "thợ rảnh" là lực lượng hậu cần chứ không phải thợ
đứng chơi. Dồn hết thợ vào hạn ngạch là tự bóp chết chuỗi chế biến của mình.

**Nâng Balo và Giày** là nâng dùng chung cho cả đội, mua bằng xu, hưởng ngay cả với thợ đang
đi dở đường.

## Bốn lỗi cân bằng đã đo được và đã sửa

Mỗi lỗi dưới đây đều phát hiện bằng cách tua nhanh ván game rồi đọc số, không phải bằng cách
nhìn màn hình.

**1. Thu nhập nổ theo bậc ba.** `Output(L)` viết cho cấp của *một* công trình, nhưng sức mang,
hệ số xưởng và chỗ ở đều lấy *tổng* cấp — và ba thứ đó nhân nhau. Đo được: **5 phút lên cấp
31, 13.284 xu/giây**. Đã thử mũ giá 1,35 / 1,55 / 1,75 đều không cứu được; không đường cong
giá mũ nào đuổi kịp một hàm bậc ba. Sửa: giá công trình tính theo tổng cấp của cả loại, và
trần sản lượng nở theo số ô đã mở (`OUTPUT_CAP_*`), nên khoá duy nhất của tăng trưởng là
đường cong mở ô 200 × 2,2ᵏ — đường dốc nhất trong hệ.

**2. Chợ bán sạch mọi thứ.** Ván vừa chở về là bán mất, luôn đứng ở 0 — trong khi giá mở ô từ
ô thứ 5 trở đi *đòi ván*. Không bao giờ trả nổi. Sửa: chợ chỉ bán ván, gạch, pha lê, và chỉ
bán phần dư trên mức giữ lại.

**3. Chợ nhanh gấp năm lần xưởng.** Chợ bán 5 đơn/giây còn xưởng làm 1 — hàng không bao giờ
tích được. Sửa: cho hai tốc độ bằng nhau, nên thêm xưởng là tích được vật liệu, nâng chợ là
đổi hàng tồn lấy xu ngay. Hai hướng đối nhau.

**4. Xưởng ăn sạch gỗ.** Kho gỗ đứng ở 0 vĩnh viễn, mà giá xây nào cũng đòi gỗ. Sửa:
`PROCESS_RESERVE`, xưởng chừa lại 25 đơn.

Nhịp sau khi sửa, đo bằng một người chơi tự động mua ngay khi đủ tiền: 1 phút — 2 thợ, cấp 2;
3 phút — có xu đều; 5 phút — 4 thợ; 10 phút — 9 thợ, cấp 3, 378 xu.

## Một soft-lock đã bịt

Mở bậc 3 đòi **250 gỗ**, mà trần kho mặc định là **150**. Người chơi đủ cấp, gom cả ngày, kho
đầy ở 150 và con số 250 không bao giờ tới — màn hình chỉ hiện `150/250` nên không có cách nào
đoán ra vấn đề nằm ở sức chứa. Cổng này tự nó hợp lý (phải có Kho trước khi mở đất), nên giữ
nguyên luật và **nói thẳng lý do** ra nút Mở rộng đất lẫn dòng gợi ý.

## Tab chạy nền và bù giờ

Trình duyệt bóp `requestAnimationFrame` khi tab không được nhìn, nên không đếm khung hình mà
dùng mốc thời gian. Lúc tab bị ẩn phải dừng **ba** thứ: mô phỏng, vòng render, **và tự động
lưu**. Quên cái thứ ba là hỏng hết — bộ đếm 5 giây sẽ dập `lastSavedTimestamp` thành "bây giờ"
suốt lúc bạn đi vắng. Xem `src/main.ts`.

Tiền bù giờ **không tính bằng công thức** mà bằng cách tua nhanh chính ván game: cùng đoạn mã
chạy lúc người chơi đang nhìn, bước 0,5 giây. Lý do là chuỗi sản xuất có tiêu thụ và có trần
kho, nên `tốc độ × thời gian` sẽ nói dối — thợ chất đầy kho rồi đứng im, xưởng hết chỗ rồi
dừng. Hai tiếng là 14.400 vòng, **đo được 82 mili giây**.
