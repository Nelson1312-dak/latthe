/**
 * ngay-tot/js/amlich.js — Âm lịch VN (thuật toán Hồ Ngọc Đức, bản rút từ tuvi.js)
 * + Can Chi ngày/tháng/năm, 12 Trực, sao Hoàng đạo/Hắc đạo, giờ hoàng đạo.
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

  // ==================== CAN CHI / TRỰC / HOÀNG ĐẠO ====================
  const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
  const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

  // Can chi của ngày theo JDN
  function dayCanChi(jdn) {
    const can = (jdn + 9) % 10;
    const chi = (jdn + 1) % 12;
    return { can, chi, text: `${CAN[can]} ${CHI[chi]}` };
  }

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

  window.AmLich = {
    CAN, CHI, TRUC,
    jdFromDate, solar2lunar,
    dayCanChi, monthCanChi, yearCanChi, monthChiIdx,
    trucOfDay, dayGod, goodHoursOfDay
  };
})();
