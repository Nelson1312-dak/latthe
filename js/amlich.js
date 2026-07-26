/**
 * js/amlich.js — Engine âm lịch Việt Nam dùng chung (thuật toán Hồ Ngọc Đức).
 *
 * Gộp từ hai bản copy-paste trước đây:
 *   - ngay-tot/js/amlich.js  (can chi, 12 Trực, sao hoàng/hắc đạo, giờ hoàng đạo) — đã xoá
 *   - tuvi/js/tuvi.js        (jdToDate, lunar→solar) — tuvi giữ bản riêng, KHÔNG dùng file này
 * và bổ sung: đổi ngày 2 chiều, 24 tiết khí, nạp âm, hướng xuất hành, ngày kiêng.
 *
 * PHẢI giữ dạng IIFE gán window.AmLich (không ES module): scripts/build-*-pages.mjs
 * nạp file này bằng `new Function('window', src)(W)`. Không tham chiếu document/
 * location/navigator ở top level. CSP của site cũng cấm script inline.
 *
 * Globals: AmLich
 */
(function () {
  'use strict';

  const PI = Math.PI;
  const INT = (d) => Math.floor(d);

  function jdFromDate(dd, mm, yy) {
    const a = INT((14 - mm) / 12);
    const y = yy + 4800 - a;
    const m = mm + 12 * a - 3;
    let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
    if (jd < 2299161) {
      jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
    }
    return jd;
  }

  // Nghịch đảo của jdFromDate. Trả object (bản tuvi.js trả mảng) — API mới, không có caller cũ.
  function jdToDate(jd) {
    let a, b, c;
    if (jd > 2299160) {
      a = jd + 32044;
      b = INT((4 * a + 3) / 146097);
      c = a - INT((b * 146097) / 4);
    } else {
      b = 0;
      c = jd + 32082;
    }
    const d = INT((4 * c + 3) / 1461);
    const e = c - INT((1461 * d) / 4);
    const m = INT((5 * e + 2) / 153);
    return {
      day: e - INT((153 * m + 2) / 5) + 1,
      month: m + 3 - 12 * INT(m / 10),
      year: b * 100 + d - 4800 + INT(m / 10),
    };
  }

  function NewMoon(k) {
    const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
    let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
    C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
    C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
    C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
    C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
    C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
    let deltat;
    if (T < -11) {
      deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
    } else {
      deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
    }
    return Jd1 + C1 - deltat;
  }

  function SunLongitude(jdn) {
    const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = PI / 180;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
    let L = (L0 + DL) * dr;
    L = L - PI * 2 * INT(L / (PI * 2));
    if (L < 0) L += PI * 2;
    return L;
  }

  // CẢNH BÁO: hàm này chia kinh độ mặt trời thành 12 bucket 30° (trung khí) và chỉ
  // phục vụ getLunarMonth11/getLeapMonthOffset. Đổi nó là lệch TOÀN BỘ ngày âm của site.
  // Tiết khí dùng sunLongitudeDeg() riêng bên dưới — đừng trộn hai hàm.
  const getSunLongitude = (dayNumber, tz) => INT(SunLongitude(dayNumber - 0.5 - tz / 24) / PI * 6);
  const getNewMoonDay = (k, tz) => INT(NewMoon(k) + 0.5 + tz / 24);

  function getLunarMonth11(yy, tz) {
    const off = jdFromDate(31, 12, yy) - 2415021;
    const k = INT(off / 29.530588853);
    let nm = getNewMoonDay(k, tz);
    if (getSunLongitude(nm, tz) >= 9) nm = getNewMoonDay(k - 1, tz);
    return nm;
  }

  function getLeapMonthOffset(a11, tz) {
    const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last = 0, i = 1;
    let arc = getSunLongitude(getNewMoonDay(k + i, tz), tz);
    do {
      last = arc;
      i++;
      arc = getSunLongitude(getNewMoonDay(k + i, tz), tz);
    } while (arc != last && i < 14);
    return i - 1;
  }

  function solar2lunar(dd, mm, yy, tz = 7.0) {
    const dayNumber = jdFromDate(dd, mm, yy);
    const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = getNewMoonDay(k + 1, tz);
    if (monthStart > dayNumber) monthStart = getNewMoonDay(k, tz);
    let a11 = getLunarMonth11(yy, tz);
    let b11 = a11;
    let lunarYear;
    if (a11 >= monthStart) {
      lunarYear = yy;
      a11 = getLunarMonth11(yy - 1, tz);
    } else {
      lunarYear = yy + 1;
      b11 = getLunarMonth11(yy + 1, tz);
    }
    const lunarDay = dayNumber - monthStart + 1;
    const diff = INT((monthStart - a11) / 29);
    let lunarLeap = 0;
    let lunarMonth = diff + 11;
    if (b11 - a11 > 365) {
      const leapMonthDiff = getLeapMonthOffset(a11, tz);
      if (diff >= leapMonthDiff) {
        lunarMonth = diff + 10;
        if (diff == leapMonthDiff) lunarLeap = 1;
      }
    }
    if (lunarMonth > 12) lunarMonth -= 12;
    if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
    return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap, jdn: dayNumber };
  }

  /**
   * Âm → Dương. Trả null nếu tháng nhuận không tồn tại trong năm đó.
   *
   * Neo a11 theo chính lunarMonth: tháng 11–12 của năm âm Y nằm trong năm DƯƠNG Y
   * (xem `if (lunarMonth >= 11 && diff < 4) lunarYear -= 1` ở solar2lunar), nên phải
   * dùng getLunarMonth11(Y) chứ không phải (Y-1). Bản tuvi/js/tuvi.js neo (Y-1) cho
   * mọi tháng nên sai ~1 năm với tháng 11-12 (16% số ngày) — bug đã vá riêng ở đó.
   */
  function lunar2solar(lunarDay, lunarMonth, lunarYear, lunarLeap = 0, tz = 7.0) {
    let a11, b11;
    if (lunarMonth < 11) {
      a11 = getLunarMonth11(lunarYear - 1, tz);
      b11 = getLunarMonth11(lunarYear, tz);
    } else {
      a11 = getLunarMonth11(lunarYear, tz);
      b11 = getLunarMonth11(lunarYear + 1, tz);
    }
    let off = lunarMonth - 11;
    if (off < 0) off += 12;
    if (b11 - a11 > 365) {
      const leapOff = getLeapMonthOffset(a11, tz);
      let leapMonth = leapOff - 2;
      if (leapMonth < 0) leapMonth += 12;
      if (lunarLeap !== 0 && lunarMonth !== leapMonth) return null;  // năm có nhuận, nhưng không phải tháng này
      if (lunarLeap !== 0 || leapOff <= off) off += 1;
    } else if (lunarLeap !== 0) {
      return null;                                                   // năm không có tháng nhuận
    }
    const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
    const jdn = getNewMoonDay(k + off, tz) + lunarDay - 1;
    const g = jdToDate(jdn);
    return { day: g.day, month: g.month, year: g.year, jdn };
  }

  // Số ngày của một tháng âm (29 hoặc 30). null nếu tháng nhuận đó không tồn tại.
  function lunarMonthDays(lunarMonth, lunarYear, lunarLeap = 0, tz = 7.0) {
    const a = lunar2solar(1, lunarMonth, lunarYear, lunarLeap, tz);
    if (!a) return null;
    let nm = lunarMonth + 1, ny = lunarYear, nl = 0;
    if (lunarLeap === 0) {
      // tháng kế có thể chính là tháng nhuận của cùng số tháng
      const leapSame = lunar2solar(1, lunarMonth, lunarYear, 1, tz);
      if (leapSame && leapSame.jdn > a.jdn) return leapSame.jdn - a.jdn;
    }
    if (nm > 12) { nm = 1; ny += 1; }
    const b = lunar2solar(1, nm, ny, nl, tz);
    return b ? b.jdn - a.jdn : null;
  }

  // Năm âm ly có tháng nhuận không, và là tháng mấy.
  function isLeapYear(lunarYear, tz = 7.0) {
    const a11 = getLunarMonth11(lunarYear - 1, tz);
    const b11 = getLunarMonth11(lunarYear, tz);
    if (b11 - a11 <= 365) return { hasLeap: false, leapMonth: 0 };
    let leapMonth = getLeapMonthOffset(a11, tz) - 2;
    if (leapMonth < 0) leapMonth += 12;
    return { hasLeap: true, leapMonth };
  }

  // ==================== CAN CHI / TRỰC / HOÀNG ĐẠO ====================
  const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
  const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

  // Can chi của ngày theo JDN
  function dayCanChi(jdn) {
    const can = (jdn + 9) % 10;
    const chi = (jdn + 1) % 12;
    return { can, chi, text: `${CAN[can]} ${CHI[chi]}` };
  }

  // Vị trí trong vòng 60 hoa giáp của ngày (0 = Giáp Tý). Khớp với dayCanChi ở trên.
  const sexagenaryOfDay = (jdn) => (jdn + 49) % 60;

  // Chi của tháng âm (Giêng = Dần)
  const monthChiIdx = (lunarMonth) => (lunarMonth + 1) % 12;

  function yearCanChi(lunarYear) {
    const can = ((lunarYear - 4) % 10 + 10) % 10;
    const chi = ((lunarYear - 4) % 12 + 12) % 12;
    return { can, chi, text: `${CAN[can]} ${CHI[chi]}` };
  }

  // Can của tháng âm (Ngũ Hổ Độn theo can năm)
  function monthCanChi(lunarMonth, lunarYear) {
    const yCan = ((lunarYear - 4) % 10 + 10) % 10;
    const danCan = ((yCan % 5) * 2 + 2) % 10;
    const chi = monthChiIdx(lunarMonth);
    const can = (danCan + ((chi - 2 + 12) % 12)) % 10;
    return { can, chi, text: `${CAN[can]} ${CHI[chi]}` };
  }

  // Can chi của giờ (Ngũ Thử Độn theo can ngày). hourChiIdx: 0 = giờ Tý.
  function hourCanChi(hourChiIdx, dayCanIdx) {
    const can = (dayCanIdx * 2 + hourChiIdx) % 10;
    return { can, chi: hourChiIdx, text: `${CAN[can]} ${CHI[hourChiIdx]}` };
  }

  // 12 Trực: trực Kiến tại ngày có chi = chi tháng
  const TRUC = ['Kiến', 'Trừ', 'Mãn', 'Bình', 'Định', 'Chấp', 'Phá', 'Nguy', 'Thành', 'Thu', 'Khai', 'Bế'];
  const trucOfDay = (dayChi, lunarMonth) => (dayChi - monthChiIdx(lunarMonth) + 12) % 12;

  // 12 sao Hoàng/Hắc đạo — Thanh Long khởi theo tháng: Giêng&7 Tý, 2&8 Dần, 3&9 Thìn...
  const GODS = ['Thanh Long', 'Minh Đường', 'Thiên Hình', 'Chu Tước', 'Kim Quỹ', 'Kim Đường',
                'Bạch Hổ', 'Ngọc Đường', 'Thiên Lao', 'Huyền Vũ', 'Tư Mệnh', 'Câu Trần'];
  const GOOD_GODS = new Set([0, 1, 4, 5, 7, 10]); // hoàng đạo
  function dayGod(dayChi, lunarMonth) {
    const start = ((lunarMonth - 1) % 6) * 2; // chi khởi Thanh Long
    const idx = (dayChi - start + 12) % 12;
    return { name: GODS[idx], good: GOOD_GODS.has(idx) };
  }

  // Giờ hoàng đạo theo chi ngày (bảng cổ truyền, nhóm theo dayChi % 6)
  const GOOD_HOURS = [
    ['Tý', 'Sửu', 'Mão', 'Ngọ', 'Thân', 'Dậu'],   // Tý / Ngọ
    ['Dần', 'Mão', 'Tỵ', 'Thân', 'Tuất', 'Hợi'],  // Sửu / Mùi
    ['Tý', 'Sửu', 'Thìn', 'Tỵ', 'Mùi', 'Tuất'],   // Dần / Thân
    ['Tý', 'Dần', 'Mão', 'Ngọ', 'Mùi', 'Dậu'],    // Mão / Dậu
    ['Dần', 'Thìn', 'Tỵ', 'Thân', 'Dậu', 'Hợi'],  // Thìn / Tuất
    ['Sửu', 'Thìn', 'Ngọ', 'Mùi', 'Tuất', 'Hợi']  // Tỵ / Hợi
  ];
  const HOUR_RANGE = {
    'Tý': '23–1h', 'Sửu': '1–3h', 'Dần': '3–5h', 'Mão': '5–7h', 'Thìn': '7–9h', 'Tỵ': '9–11h',
    'Ngọ': '11–13h', 'Mùi': '13–15h', 'Thân': '15–17h', 'Dậu': '17–19h', 'Tuất': '19–21h', 'Hợi': '21–23h'
  };
  const goodHoursOfDay = (dayChi) =>
    GOOD_HOURS[dayChi % 6].map(h => `${h} (${HOUR_RANGE[h]})`);

  // Đủ 12 canh giờ kèm can chi và cờ tốt/xấu — cho trang lịch chi tiết.
  function hoursOfDay(dayChi, dayCan) {
    const good = new Set(GOOD_HOURS[dayChi % 6]);
    return CHI.map((chi, i) => ({
      chi, chiIdx: i,
      canChi: hourCanChi(i, dayCan).text,
      range: HOUR_RANGE[chi],
      good: good.has(chi),
    }));
  }

  // ==================== NGÀY KIÊNG DÂN GIAN ====================
  // Gom về một chỗ — trước đây trùng ở ngay-tot/js/app.js và scripts/build-ngaytot-pages.mjs.
  const TAM_NUONG = [3, 7, 13, 18, 22, 27];
  const NGUYET_KY = [5, 14, 23];

  // Dương công kỵ nhật: 13 ngày âm cố định, lùi 2 ngày mỗi tháng (tháng 7 có 2 ngày).
  const DUONG_CONG = { 1: [13], 2: [11], 3: [9], 4: [7], 5: [5], 6: [3], 7: [1, 29],
                       8: [27], 9: [25], 10: [23], 11: [21], 12: [19] };
  const duongCongKyNhat = (lunarDay, lunarMonth) =>
    (DUONG_CONG[lunarMonth] || []).indexOf(lunarDay) !== -1;

  // ==================== NẠP ÂM ====================
  // Chính tả lấy theo scripts/build-congiap-pages.mjs (đã lên trang SEO).
  // tuvi/js/tuvi.js viết khác vài mục (Lư Trung Hỏa / Tòng Bá Mộc / Phú Đăng Hỏa) — không đồng bộ có chủ đích.
  const NAP_AM = [
    'Hải Trung Kim', 'Lô Trung Hỏa', 'Đại Lâm Mộc', 'Lộ Bàng Thổ', 'Kiếm Phong Kim',
    'Sơn Đầu Hỏa', 'Giản Hạ Thủy', 'Thành Đầu Thổ', 'Bạch Lạp Kim', 'Dương Liễu Mộc',
    'Tuyền Trung Thủy', 'Ốc Thượng Thổ', 'Tích Lịch Hỏa', 'Tùng Bách Mộc', 'Trường Lưu Thủy',
    'Sa Trung Kim', 'Sơn Hạ Hỏa', 'Bình Địa Mộc', 'Bích Thượng Thổ', 'Kim Bạch Kim',
    'Phúc Đăng Hỏa', 'Thiên Hà Thủy', 'Đại Trạch Thổ', 'Thoa Xuyến Kim', 'Tang Đố Mộc',
    'Đại Khê Thủy', 'Sa Trung Thổ', 'Thiên Thượng Hỏa', 'Thạch Lựu Mộc', 'Đại Hải Thủy',
  ];
  const napAmName = (s60) => NAP_AM[INT(s60 / 2)];
  const elementOf = (name) => name.split(' ').pop();
  function napAmOfDay(jdn) {
    const name = napAmName(sexagenaryOfDay(jdn));
    return { name, element: elementOf(name) };
  }
  function napAmOfYear(lunarYear) {
    const name = napAmName((((lunarYear - 1984) % 60 + 60) % 60));
    return { name, element: elementOf(name) };
  }

  // ==================== HƯỚNG XUẤT HÀNH ====================
  // Hỷ thần theo can ngày: Giáp/Kỷ ĐB · Ất/Canh TB · Bính/Tân TN · Đinh/Nhâm chính Nam · Mậu/Quý ĐN
  const HY_THAN = ['Đông Bắc', 'Tây Bắc', 'Tây Nam', 'Chính Nam', 'Đông Nam'];
  // Tài thần theo can ngày. LƯU Ý: dân gian lưu hành 2 biến thể bảng này; đây là bản
  // phổ biến hơn (Giáp/Ất ĐB · Bính/Đinh TN · Mậu/Kỷ chính Bắc · Canh/Tân chính Đông · Nhâm/Quý chính Nam).
  // Đã chốt một bản — về sau đừng "sửa" theo một trang web ngẫu nhiên.
  const TAI_THAN = ['Đông Bắc', 'Tây Nam', 'Chính Bắc', 'Chính Đông', 'Chính Nam'];
  // Hạc thần: 6 ngày mỗi hướng theo vòng 60, 12 ngày cuối lên trời (không kỵ hướng nào).
  const HAC_THAN = ['Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc', 'Bắc', 'Đông Bắc', 'Trên trời'];
  function huongXuatHanh(dayCan, jdn) {
    return {
      hyThan: HY_THAN[dayCan % 5],
      taiThan: TAI_THAN[INT(dayCan / 2)],
      hacThan: HAC_THAN[Math.min(INT(sexagenaryOfDay(jdn) / 6), 8)],
    };
  }

  // ==================== 24 TIẾT KHÍ ====================
  // Chỉ số = floor(kinh độ mặt trời biểu kiến / 15), 0..23, mốc 0° = Xuân Phân.
  // Thứ tự hậu-1645 (Vũ Thủy 330°, Kinh Trập 345°).
  const TIET_KHI = [
    { name: 'Xuân Phân', deg: 0 },   { name: 'Thanh Minh', deg: 15 },  { name: 'Cốc Vũ', deg: 30 },
    { name: 'Lập Hạ', deg: 45 },     { name: 'Tiểu Mãn', deg: 60 },    { name: 'Mang Chủng', deg: 75 },
    { name: 'Hạ Chí', deg: 90 },     { name: 'Tiểu Thử', deg: 105 },   { name: 'Đại Thử', deg: 120 },
    { name: 'Lập Thu', deg: 135 },   { name: 'Xử Thử', deg: 150 },     { name: 'Bạch Lộ', deg: 165 },
    { name: 'Thu Phân', deg: 180 },  { name: 'Hàn Lộ', deg: 195 },     { name: 'Sương Giáng', deg: 210 },
    { name: 'Lập Đông', deg: 225 },  { name: 'Tiểu Tuyết', deg: 240 }, { name: 'Đại Tuyết', deg: 255 },
    { name: 'Đông Chí', deg: 270 },  { name: 'Tiểu Hàn', deg: 285 },   { name: 'Đại Hàn', deg: 300 },
    { name: 'Lập Xuân', deg: 315 },  { name: 'Vũ Thủy', deg: 330 },    { name: 'Kinh Trập', deg: 345 },
  ];

  // Kinh độ mặt trời BIỂU KIẾN (độ) — có hiệu chỉnh quang sai + chương động + ΔT.
  // Bản hình học của SunLongitude() lệch sớm ~13 phút, đủ để đẩy lệch ngày ở các ca sát nửa đêm.
  // Hàm này CHỈ dùng cho tiết khí; getSunLongitude() ở trên vẫn giữ nguyên cho lịch âm.
  function sunLongitudeDeg(jdUT) {
    const jd = jdUT + 69 / 86400;                       // ΔT ≈ 69 giây (hợp lý cho 2000-2050)
    const T = (jd - 2451545.0) / 36525, T2 = T * T, dr = PI / 180;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
    const Om = 125.04 - 1934.136 * T;                   // kinh độ điểm nút lên của Mặt Trăng
    let L = L0 + DL - 0.00569 - 0.00478 * Math.sin(dr * Om);
    L = L % 360;
    if (L < 0) L += 360;
    return L;
  }

  // JD (UT) của thời điểm mặt trời đi qua kinh độ targetDeg, tìm bằng chia đôi.
  // f() chuẩn hoá về (-180,180] nên đơn điệu trong bracket ±20 ngày (~±20°).
  function _solveSunLongitude(targetDeg, jdGuess) {
    const f = (jd) => {
      let x = sunLongitudeDeg(jd) - targetDeg;
      while (x > 180) x -= 360;
      while (x <= -180) x += 360;
      return x;
    };
    let lo = jdGuess - 20, hi = jdGuess + 20;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  // JD phân số (UT) → số ngày Julian theo lịch địa phương. Nghịch của quy ước jdn-0.5-tz/24.
  const _localJdn = (jdUT, tz) => Math.floor(jdUT + tz / 24 + 0.5);

  const _tkCache = new Map();

  /**
   * 24 tiết khí có ngày bắt đầu rơi trong năm dương gregYear, sắp theo thời gian.
   * Lưu ý: các tiết 285°-345° của "năm mặt trời" rơi vào tháng 1-3 dương lịch,
   * nên phải thử neo ở cả năm trước — và kết quả PHẢI sort theo jdn, không theo index.
   */
  function tietKhiOfYear(gregYear, tz = 7.0) {
    const key = `${gregYear}|${tz}`;
    if (_tkCache.has(key)) return _tkCache.get(key);
    const out = [];
    for (let i = 0; i < 24; i++) {
      const deg = TIET_KHI[i].deg;
      for (const anchor of [gregYear - 1, gregYear]) {
        const jdGuess = jdFromDate(20, 3, anchor) + deg * 365.2422 / 360;
        const jd = _solveSunLongitude(deg, jdGuess);
        const jdn = _localJdn(jd, tz);
        const g = jdToDate(jdn);
        if (g.year === gregYear) {
          const frac = jd + tz / 24 + 0.5;
          const hourFloat = (frac - Math.floor(frac)) * 24;
          out.push({
            index: i, deg, name: TIET_KHI[i].name, jdn, jd,
            day: g.day, month: g.month, year: g.year,
            hour: INT(hourFloat), minute: INT((hourFloat % 1) * 60),
            isTrungKhi: i % 2 === 0,
          });
          break;
        }
      }
    }
    out.sort((a, b) => a.jdn - b.jdn);
    _tkCache.set(key, out);
    return out;
  }

  // Tiết khí đang diễn ra tại ngày jdn.
  function tietKhiOfDay(jdn, tz = 7.0) {
    const y = jdToDate(jdn).year;
    let list = tietKhiOfYear(y, tz);
    let cur = null;
    for (const t of list) { if (t.jdn <= jdn) cur = t; else break; }
    if (!cur) {                                   // đầu tháng 1 có thể còn thuộc tiết cuối năm trước
      const prev = tietKhiOfYear(y - 1, tz);
      cur = prev[prev.length - 1];
      list = prev.concat(list);
    }
    const all = tietKhiOfYear(y, tz).concat(tietKhiOfYear(y + 1, tz));
    let next = null;
    for (const t of all) { if (t.jdn > jdn) { next = t; break; } }
    return {
      index: cur.index, deg: cur.deg, name: cur.name,
      startJdn: cur.jdn, isStartDay: cur.jdn === jdn,
      dayInTerm: jdn - cur.jdn + 1,
      nextJdn: next ? next.jdn : null,
      nextName: next ? next.name : null,
    };
  }

  // Ngày bắt đầu của một tiết khí cụ thể trong năm dương gregYear.
  function tietKhiStart(index, gregYear, tz = 7.0) {
    return tietKhiOfYear(gregYear, tz).find((t) => t.index === index) || null;
  }

  // ==================== TỔNG HỢP ====================
  // Một call duy nhất cho mỗi ô lịch / mỗi trang ngày.
  function dayInfo(dd, mm, yy, tz = 7.0) {
    const lunar = solar2lunar(dd, mm, yy, tz);
    const jdn = lunar.jdn;
    const dcc = dayCanChi(jdn);
    const truc = trucOfDay(dcc.chi, lunar.month);
    const god = dayGod(dcc.chi, lunar.month);
    return {
      solar: { day: dd, month: mm, year: yy },
      jdn,
      weekday: (jdn + 1) % 7,                    // 0 = Chủ Nhật
      lunar,
      dayCanChi: dcc,
      monthCanChi: monthCanChi(lunar.month, lunar.year),
      yearCanChi: yearCanChi(lunar.year),
      truc: { index: truc, name: TRUC[truc] },
      god,
      hours: hoursOfDay(dcc.chi, dcc.can),
      goodHours: goodHoursOfDay(dcc.chi),
      tietKhi: tietKhiOfDay(jdn, tz),
      napAm: napAmOfDay(jdn),
      huong: huongXuatHanh(dcc.can, jdn),
      xungChi: CHI[(dcc.chi + 6) % 12],
      kieng: {
        tamNuong: TAM_NUONG.indexOf(lunar.day) !== -1,
        nguyetKy: NGUYET_KY.indexOf(lunar.day) !== -1,
        duongCong: duongCongKyNhat(lunar.day, lunar.month),
      },
    };
  }

  window.AmLich = {
    CAN, CHI, TRUC, TIET_KHI, NAP_AM, TAM_NUONG, NGUYET_KY,
    jdFromDate, jdToDate,
    solar2lunar, lunar2solar, lunarMonthDays, isLeapYear,
    dayCanChi, monthCanChi, yearCanChi, monthChiIdx, hourCanChi, sexagenaryOfDay,
    trucOfDay, dayGod, goodHoursOfDay, hoursOfDay,
    napAmOfDay, napAmOfYear, huongXuatHanh, duongCongKyNhat,
    sunLongitudeDeg, tietKhiOfYear, tietKhiOfDay, tietKhiStart,
    dayInfo,
  };
})();
