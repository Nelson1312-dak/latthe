/* ============================================================
   board-data.js — Dữ liệu TĨNH của bàn Cờ Tỷ Phú (40 ô)
   Bare global const (theo chuẩn repo: xam-data.js, zodiac-data.js).
   Nạp KHÔNG defer, TRƯỚC các file logic.

   QUAN TRỌNG — chỉ chứa DỮ KIỆN BẤT BIẾN. Trạng thái thay đổi trong ván
   (chủ sở hữu, số nhà) nằm ở state.tiles[i] = {owner, level} bên engine.
   Tách vậy để payload save ~1.5KB thay vì ~12KB.

   Giá/thuê giữ nguyên ĐƯỜNG CONG kinh điển của thể loại — số là dữ kiện,
   tự cân lại kinh tế 40 ô là hàng tuần playtest. Chỉ đổi TÊN sang địa danh
   Việt (tránh nhãn hiệu Hasbro).
   Đơn vị tiền = 1 triệu VNĐ.
   ============================================================ */

'use strict';

/* Nhóm màu — tông "sơn mài" trầm, ngả ấm để ngồi được trên nền kem #fbf3e4.
   Màu nguyên bản của thể loại (đỏ tươi, xanh chói) sẽ gào lên trên nền này. */
const CTP_GROUPS = {
  taybac:  { ten: 'Tây Bắc',      mau: '#8c5a3c', so: 2 },
  mekong:  { ten: 'Mekong',       mau: '#0e7490', so: 3 },
  hoadao:  { ten: 'Hoa Đào',      mau: '#c0475c', so: 3 },
  phoco:   { ten: 'Phố Cổ',       mau: '#ea6a17', so: 3 },
  luado:   { ten: 'Lụa Đỏ',       mau: '#9f1239', so: 3 },
  luavang: { ten: 'Lúa Vàng',     mau: '#d98a0a', so: 3 },
  rungngoc:{ ten: 'Rừng Ngọc',    mau: '#0d9668', so: 3 },
  demsg:   { ten: 'Đêm Sài Gòn',  mau: '#4338ca', so: 2 },
};

/* Màu các loại ô đặc biệt */
const CTP_KIND_COLORS = {
  sanbay:  '#3f3f46',
  tienich: '#6366f1',
  cohoi:   '#7c3aed',
  vanmenh: '#0d9668',
  thue:    '#a16207',
  goc:     '#d98a0a',
};

/* ------------------------------------------------------------
   BOARD[40] — index 0 = XUẤT PHÁT (góc dưới-phải), đi NGƯỢC chiều kim đồng hồ.
   kind: 'goc' | 'dat' | 'sanbay' | 'tienich' | 'cohoi' | 'vanmenh' | 'thue'
   rent[6] cho 'dat': [trống, 1 nhà, 2, 3, 4, khách sạn]
   xay: giá mỗi căn nhà / khách sạn
   ------------------------------------------------------------ */
const CTP_BOARD = [
  // ---- cạnh DƯỚI: 0 → 10, chạy sang trái ----
  { i: 0,  kind: 'goc',     ten: 'Xuất Phát',      nhan: 'XUẤT PHÁT', icon: 'ti-arrow-right' },
  { i: 1,  kind: 'dat',     ten: 'Hà Giang',       nhom: 'taybac',  gia: 60,
    rent: [2, 10, 30, 90, 160, 250],    xay: 50 },
  { i: 2,  kind: 'vanmenh', ten: 'Vận Mệnh',       icon: 'ti-heart-handshake' },
  { i: 3,  kind: 'dat',     ten: 'Cao Bằng',       nhom: 'taybac',  gia: 60,
    rent: [4, 20, 60, 180, 320, 450],   xay: 50 },
  { i: 4,  kind: 'thue',    ten: 'Thuế Thu Nhập',  tien: 200, icon: 'ti-coins' },
  { i: 5,  kind: 'sanbay',  ten: 'Sân Bay Nội Bài',  nhan: 'Nội Bài',  gia: 200, icon: 'ti-plane-departure' },
  { i: 6,  kind: 'dat',     ten: 'Ninh Bình',      nhom: 'mekong',  gia: 100,
    rent: [6, 30, 90, 270, 400, 550],   xay: 50 },
  { i: 7,  kind: 'cohoi',   ten: 'Cơ Hội',         icon: 'ti-sparkles' },
  { i: 8,  kind: 'dat',     ten: 'Mộc Châu',       nhom: 'mekong',  gia: 100,
    rent: [6, 30, 90, 270, 400, 550],   xay: 50 },
  { i: 9,  kind: 'dat',     ten: 'Tam Cốc',        nhom: 'mekong',  gia: 120,
    rent: [8, 40, 100, 300, 450, 600],  xay: 50 },
  { i: 10, kind: 'goc',     ten: 'Trạm Giam',      nhan: 'TRẠM GIAM', icon: 'ti-lock' },

  // ---- cạnh TRÁI: 11 → 20, chạy lên ----
  { i: 11, kind: 'dat',     ten: 'Huế',            nhom: 'hoadao',  gia: 140,
    rent: [10, 50, 150, 450, 625, 750], xay: 100 },
  { i: 12, kind: 'tienich', ten: 'Điện Lực',       gia: 150, nhan: 'ĐIỆN', icon: 'ti-bolt' },
  { i: 13, kind: 'dat',     ten: 'Hội An',         nhom: 'hoadao',  gia: 140,
    rent: [10, 50, 150, 450, 625, 750], xay: 100 },
  { i: 14, kind: 'dat',     ten: 'Đà Lạt',         nhom: 'hoadao',  gia: 160,
    rent: [12, 60, 180, 500, 700, 900], xay: 100 },
  { i: 15, kind: 'sanbay',  ten: 'Sân Bay Đà Nẵng',  nhan: 'Đà Nẵng',  gia: 200, icon: 'ti-plane-departure' },
  { i: 16, kind: 'dat',     ten: 'Sa Pa',          nhom: 'phoco',   gia: 180,
    rent: [14, 70, 200, 550, 750, 950], xay: 100 },
  { i: 17, kind: 'vanmenh', ten: 'Vận Mệnh',       icon: 'ti-heart-handshake' },
  { i: 18, kind: 'dat',     ten: 'Hạ Long',        nhom: 'phoco',   gia: 180,
    rent: [14, 70, 200, 550, 750, 950], xay: 100 },
  { i: 19, kind: 'dat',     ten: 'Phú Quốc',       nhom: 'phoco',   gia: 200,
    rent: [16, 80, 220, 600, 800, 1000], xay: 100 },
  { i: 20, kind: 'goc',     ten: 'Bãi Đỗ Miễn Phí', nhan: 'BÃI ĐỖ', icon: 'ti-car' },

  // ---- cạnh TRÊN: 21 → 30, chạy sang phải ----
  { i: 21, kind: 'dat',     ten: 'Nha Trang',      nhom: 'luado',   gia: 220,
    rent: [18, 90, 250, 700, 875, 1050], xay: 150 },
  { i: 22, kind: 'cohoi',   ten: 'Cơ Hội',         icon: 'ti-sparkles' },
  { i: 23, kind: 'dat',     ten: 'Vũng Tàu',       nhom: 'luado',   gia: 220,
    rent: [18, 90, 250, 700, 875, 1050], xay: 150 },
  { i: 24, kind: 'dat',     ten: 'Đà Nẵng',        nhom: 'luado',   gia: 240,
    rent: [20, 100, 300, 750, 925, 1100], xay: 150 },
  { i: 25, kind: 'sanbay',  ten: 'Sân Bay Cam Ranh', nhan: 'Cam Ranh', gia: 200, icon: 'ti-plane-departure' },
  { i: 26, kind: 'dat',     ten: 'Hồ Tây',         nhom: 'luavang', gia: 260,
    rent: [22, 110, 330, 800, 975, 1150], xay: 150 },
  { i: 27, kind: 'dat',     ten: 'Phố Cổ Hà Nội',  nhom: 'luavang', gia: 260,
    rent: [22, 110, 330, 800, 975, 1150], xay: 150 },
  { i: 28, kind: 'tienich', ten: 'Nước Sạch',      gia: 150, nhan: 'NƯỚC', icon: 'ti-bolt' },
  { i: 29, kind: 'dat',     ten: 'Hoàn Kiếm',      nhom: 'luavang', gia: 280,
    rent: [24, 120, 360, 850, 1025, 1200], xay: 150 },
  { i: 30, kind: 'goc',     ten: 'Vào Tù',         nhan: 'VÀO TÙ', icon: 'ti-shield-check' },

  // ---- cạnh PHẢI: 31 → 39, chạy xuống ----
  { i: 31, kind: 'dat',     ten: 'Bà Nà Hills',    nhom: 'rungngoc', gia: 300,
    rent: [26, 130, 390, 900, 1100, 1275], xay: 200 },
  { i: 32, kind: 'dat',     ten: 'Thủ Thiêm',      nhom: 'rungngoc', gia: 300,
    rent: [26, 130, 390, 900, 1100, 1275], xay: 200 },
  { i: 33, kind: 'vanmenh', ten: 'Vận Mệnh',       icon: 'ti-heart-handshake' },
  // "Landmark 81" đổi thành "Thảo Điền": 1 từ dài như LANDMARK (~62px) không có
  // điểm ngắt nên tràn ô 43px; tên 2 từ ngắn thì wrap 2 dòng đẹp.
  { i: 34, kind: 'dat',     ten: 'Thảo Điền',      nhom: 'rungngoc', gia: 320,
    rent: [28, 150, 450, 1000, 1200, 1400], xay: 200 },
  { i: 35, kind: 'sanbay',  ten: 'Sân Bay Tân Sơn Nhất', nhan: 'Tân Sơn Nhất', gia: 200, icon: 'ti-plane-departure' },
  { i: 36, kind: 'cohoi',   ten: 'Cơ Hội',         icon: 'ti-sparkles' },
  { i: 37, kind: 'dat',     ten: 'Đồng Khởi',      nhom: 'demsg',   gia: 350,
    rent: [35, 175, 500, 1100, 1300, 1500], xay: 200 },
  { i: 38, kind: 'thue',    ten: 'Thuế Xa Xỉ',     tien: 100, icon: 'ti-coins' },
  { i: 39, kind: 'dat',     ten: 'Nguyễn Huệ',     nhom: 'demsg',   gia: 400,
    rent: [50, 200, 600, 1400, 1700, 2000], xay: 200 },
];

/* ------------------------------------------------------------
   LAND_FREQ[40] — xác suất đáp xuống từng ô ở trạng thái dừng (%).
   Kết quả Markov đã biết của thể loại (có tính ô "Vào Tù", 3 đôi vào tù,
   và các thẻ dịch chuyển). Đây là BÍ QUYẾT làm bot mua hàng trông thông minh:
   ROI thật = tần suất đáp × tiền thuê, không phải chỉ tiền thuê.
   Hằng số precompute — 0 chi phí runtime.
   Tổng ≈ 100. Trạm giam cao nhất (~6%) vì hút từ ô Vào Tù + thẻ + 3 đôi.
   ------------------------------------------------------------ */
const CTP_LAND_FREQ = [
  3.14, 2.17, 2.02, 2.21, 2.35, 2.97, 2.21, 0.88, 2.21, 2.33,
  5.97, 2.58, 2.65, 2.47, 2.58, 3.02, 2.90, 2.56, 2.89, 2.90,
  2.86, 2.78, 1.04, 2.74, 3.22, 3.22, 2.69, 2.66, 2.82, 2.53,
  0.00, 2.56, 2.53, 2.43, 2.45, 2.54, 0.87, 2.32, 2.19, 2.54,
];

/* Cấu hình mặc định — 'nhanh' là mặc định CÓ CHỦ Ý: ván cổ điển 90-150 phút
   trên điện thoại thì không ai chơi hết. Xem plan. */
const CTP_DEFAULTS = {
  mode: 'nhanh',      // 'nhanh' | 'codien'
  roundCap: 20,       // 0 = chơi tới khi còn 1 người
  startCash: 1500,
  goSalary: 200,
  jailFine: 50,
  speed: 1,
};

/* Màu quân — cố ý tách khỏi hệ màu nhóm đất để không bao giờ nhầm
   "quân của ai" với "đất nhóm nào". Mỗi quân thêm viền trắng 2px. */
const CTP_TOKENS = [
  { mau: '#e11d48', ten: 'Hồng Ngọc', icon: 'ti-flame' },
  { mau: '#0369a1', ten: 'Thanh Long', icon: 'ti-paw' },
  { mau: '#65a30d', ten: 'Lục Bảo',   icon: 'ti-key' },
  { mau: '#7e22ce', ten: 'Tử Vi',     icon: 'ti-trophy' },
];

/* Tra cứu nhanh: nhóm -> mảng index các ô thuộc nhóm đó */
const CTP_GROUP_TILES = (() => {
  const m = {};
  for (const t of CTP_BOARD) {
    if (t.kind === 'dat') (m[t.nhom] || (m[t.nhom] = [])).push(t.i);
  }
  return m;
})();

const CTP_SANBAY_TILES = CTP_BOARD.filter(t => t.kind === 'sanbay').map(t => t.i);
const CTP_TIENICH_TILES = CTP_BOARD.filter(t => t.kind === 'tienich').map(t => t.i);

/* Ô mốc dùng trong luật */
const CTP_GO = 0;
const CTP_JAIL = 10;
const CTP_GOTO_JAIL = 30;
