/**
 * Tử Vi Đẩu Số Calculation Module (ES6+)
 * 
 * This module converts Gregorian date/time to Vietnamese Lunar date/time,
 * determines the Mệnh, Thân, Cục, and places the major/minor stars
 * on the 12 earthly branch palaces (Tý to Hợi) according to traditional rules.
 * 
 * Author: Antigravity AI
 * Copyright (c) 2026. All rights reserved.
 */

// ==========================================
// 1. ASTRONOMICAL LUNAR CALENDAR ALGORITHMS
// (Based on Dr. Ho Ngoc Duc's algorithms)
// ==========================================

const PI = Math.PI;

function INT(d) {
  return Math.floor(d);
}

/**
 * Calculates Julian Day Number from Gregorian Date
 */
function jdFromDate(dd, mm, yy) {
  let a, y, m, jd;
  a = INT((14 - mm) / 12);
  y = yy + 4800 - a;
  m = mm + 12 * a - 3;
  jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

/**
 * Converts Julian Day Number to Gregorian Date
 */
function jdToDate(jd) {
  let a, b, c, d, e, m, day, month, year;
  if (jd > 2299160) {
    a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  d = INT((4 * c + 3) / 1461);
  e = c - INT((1461 * d) / 4);
  m = INT((5 * e + 2) / 153);
  day = e - INT((153 * m + 2) / 5) + 1;
  month = m + 3 - 12 * INT(m / 10);
  year = b * 100 + d - 4800 + INT(m / 10);
  return [day, month, year];
}

/**
 * Calculates the time of the k-th new moon since 1/1/1900 13:52 UTC
 */
function NewMoon(k) {
  let T, T2, T3, dr, Jd1, M, Mpr, F, C1, deltat, JdNew;
  T = k / 1236.85;
  T2 = T * T;
  T3 = T2 * T;
  dr = PI / 180;
  Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  JdNew = Jd1 + C1 - deltat;
  return JdNew;
}

/**
 * Calculates sun's true longitude
 */
function SunLongitude(jdn) {
  let T, T2, dr, M, L0, DL, L;
  T = (jdn - 2451545.0) / 36525;
  T2 = T * T;
  dr = PI / 180;
  M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
  L = L0 + DL;
  L = L * dr;
  L = L - PI * 2 * (INT(L / (PI * 2)));
  if (L < 0) L += PI * 2;
  return L;
}

function getSunLongitude(dayNumber, timeZone) {
  return INT(SunLongitude(dayNumber - 0.5 - timeZone / 24) / PI * 6);
}

function getNewMoonDay(k, timeZone) {
  return INT(NewMoon(k) + 0.5 + timeZone / 24);
}

function getLunarMonth11(yy, timeZone) {
  let k, off, nm, sunLong;
  off = jdFromDate(31, 12, yy) - 2415021;
  k = INT(off / 29.530588853);
  nm = getNewMoonDay(k, timeZone);
  sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11, timeZone) {
  let k, last, arc, i;
  k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  last = 0;
  i = 1;
  arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc != last && i < 14);
  return i - 1;
}

/**
 * Converts Gregorian solar date (dd/mm/yyyy) to Lunar date [lunarDay, lunarMonth, lunarYear, lunarLeap]
 * Timezone offset: 7.0 for Vietnam
 */
function convertSolar2Lunar(dd, mm, yy, timeZone = 7.0) {
  let k, dayNumber, monthStart, a11, b11, lunarDay, lunarMonth;
  let lunarYear, lunarLeap, diff, leapMonthDiff;
  
  dayNumber = jdFromDate(dd, mm, yy);
  k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  
  a11 = getLunarMonth11(yy, timeZone);
  b11 = a11;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  
  lunarDay = dayNumber - monthStart + 1;
  diff = INT((monthStart - a11) / 29);
  lunarLeap = 0;
  lunarMonth = diff + 11;
  
  if (b11 - a11 > 365) {
    leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff == leapMonthDiff) {
        lunarLeap = 1;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth = lunarMonth - 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return [lunarDay, lunarMonth, lunarYear, lunarLeap];
}

/**
 * Converts Lunar date to Gregorian Solar Date
 */
export function convertLunar2Solar(lunarDay, lunarMonth, lunarYear, lunarLeap = 0, timeZone = 7.0) {
  let a11 = getLunarMonth11(lunarYear - 1, timeZone);
  let k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  
  let offset = 0;
  if (lunarMonth >= 11) {
    offset = lunarMonth - 11;
  } else {
    offset = lunarMonth + 1;
  }
  
  let b11 = getLunarMonth11(lunarYear, timeZone);
  let hasLeap = (b11 - a11 > 365);
  let leapMonth = 0;
  if (hasLeap) {
    leapMonth = getLeapMonthOffset(a11, timeZone);
  }
  
  let targetK = k + offset;
  if (hasLeap) {
    if (lunarLeap === 1) {
      targetK = k + leapMonth;
    } else if (offset >= leapMonth) {
      targetK = k + offset + 1;
    }
  }
  
  let monthStartJd = getNewMoonDay(targetK, timeZone);
  let dayJd = monthStartJd + lunarDay - 1;
  
  return jdToDate(dayJd);
}

// ==========================================
// 2. CONSTANTS AND LUNI-SOLAR TERMINOLOGY
// ==========================================

export const CANS = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"];
export const CHIS = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"];

// Mapping of 12 branch houses for output JSON
export const CUNG_KEYS = ["Ty", "Suu", "Dan", "Mao", "Thin", "Ty2", "Ngo", "Mui", "Than", "Dau", "Tuat", "Hoi"];

// 12 Palaces in order (counter-clockwise from Mệnh)
export const PALACE_NAMES = [
  "Mệnh", "Phụ Mẫu", "Phúc Đức", "Điền Trạch", "Quan Lộc", "Nô Bộc",
  "Thiên Di", "Tật Ách", "Tài Bạch", "Tử Tức", "Phu Thê", "Huynh Đệ"
];

// Elements color mapping
export const STAR_ELEMENTS = {
  // 14 Chính tinh
  "Tử Vi": "tho",
  "Liêm Trinh": "hoa",
  "Thiên Đồng": "thuy",
  "Vũ Khúc": "kim",
  "Thái Dương": "hoa",
  "Thiên Cơ": "moc",
  "Thiên Phủ": "tho",
  "Thái Âm": "thuy",
  "Tham Lang": "moc",
  "Cự Môn": "thuy",
  "Thiên Tướng": "thuy",
  "Thiên Lương": "moc",
  "Thất Sát": "kim",
  "Phá Quân": "thuy",
  // Phụ tinh
  "Hóa Lộc": "moc",
  "Hóa Quyền": "moc",
  "Hóa Khoa": "moc",
  "Hóa Kỵ": "thuy",
  "Lộc Tồn": "tho",
  "Kình Dương": "kim",
  "Đà La": "kim",
  "Thiên Khôi": "hoa",
  "Thiên Việt": "hoa",
  "Tả Phù": "tho",
  "Hữu Bật": "thuy",
  "Văn Xương": "kim",
  "Văn Khúc": "thuy",
  "Địa Không": "hoa",
  "Địa Kiếp": "hoa",
  "Thiên Khốc": "kim",
  "Thiên Hư": "kim",
  "Thiên Mã": "hoa"
};

// Ratings lookup table (0: Tý, 1: Sửu, 2: Dần... 11: Hợi)
export const STAR_RATINGS = {
  "Tử Vi":      ["B", "M", "M", "V", "M", "V", "M", "M", "M", "V", "M", "V"],
  "Liêm Trinh": ["V", "Đ", "M", "H", "M", "H", "M", "Đ", "M", "H", "M", "H"],
  "Thiên Đồng": ["V", "H", "M", "M", "H", "M", "H", "H", "Đ", "H", "H", "M"],
  "Vũ Khúc":    ["V", "M", "M", "H", "M", "H", "M", "M", "M", "V", "M", "H"],
  "Thái Dương": ["H", "H", "V", "M", "V", "V", "M", "Đ", "H", "H", "H", "H"],
  "Thiên Cơ":   ["M", "H", "M", "M", "V", "Đ", "M", "H", "M", "M", "V", "Đ"],
  "Thiên Phủ":  ["M", "M", "M", "Đ", "M", "Đ", "M", "M", "M", "V", "M", "V"],
  "Thái Âm":    ["M", "M", "H", "H", "H", "H", "H", "H", "H", "M", "M", "M"],
  "Tham Lang":  ["V", "M", "H", "H", "M", "H", "V", "M", "H", "H", "M", "H"],
  "Cự Môn":     ["V", "H", "V", "M", "H", "H", "V", "H", "M", "M", "H", "H"],
  "Thiên Tướng":["V", "M", "M", "H", "M", "Đ", "M", "M", "M", "V", "M", "H"],
  "Thiên Lương":["M", "V", "M", "M", "M", "H", "M", "V", "M", "H", "M", "H"],
  "Thất Sát":   ["V", "M", "M", "H", "M", "H", "M", "M", "M", "H", "M", "H"],
  "Phá Quân":   ["M", "V", "H", "H", "M", "H", "M", "V", "H", "H", "M", "H"]
};

// ==========================================
// 3. UTILITY METHODS FOR CAN-CHI & METAPHYSICS
// ==========================================

function xetSo(so) {
  let ret = so % 12;
  if (ret <= 0) ret += 12;
  return ret;
}

/**
 * Gets Can-Chi of the year
 */
function getCanChiYear(lunarYear) {
  let canIdx = (lunarYear - 4) % 10;
  if (canIdx < 0) canIdx += 10;
  let chiIdx = (lunarYear - 4) % 12;
  if (chiIdx < 0) chiIdx += 12;
  return { canIdx, chiIdx, text: `${CANS[canIdx]} ${CHIS[chiIdx]}` };
}

/**
 * Gets Can-Chi of the lunar month
 */
function getCanChiMonth(lunarMonth, yearCanIdx) {
  const startCanIndex = (yearCanIdx % 5) * 2 + 2; // Can of Month 1 (Dần)
  const monthCanIdx = (startCanIndex + (lunarMonth - 1)) % 10;
  const monthChiIdx = (lunarMonth - 1 + 2) % 12; // Month 1 is Dần (index 2)
  return `${CANS[monthCanIdx]} ${CHIS[monthChiIdx]}`;
}

/**
 * Gets Can-Chi of the day from Julian Day Number
 */
function getCanChiDay(jdn) {
  let canIdx = (jdn + 9) % 10;
  let chiIdx = (jdn + 1) % 12;
  return { canIdx, chiIdx, text: `${CANS[canIdx]} ${CHIS[chiIdx]}` };
}

/**
 * Gets Can-Chi of the hour
 */
function getCanChiHour(gioSinhIndex, dayCanIdx) {
  const startCanIdx = (dayCanIdx % 5) * 2; // Can of Tý hour
  const hourCanIdx = (startCanIdx + (gioSinhIndex - 1)) % 10;
  const hourChiIdx = (gioSinhIndex - 1) % 12;
  return `${CANS[hourCanIdx]} ${CHIS[hourChiIdx]}`;
}

/**
 * Calculates Cục (State/Element) based on Can of Mệnh Cung and Chi of Mệnh Cung
 */
function getCuc(menhCanIndex, menhChiIndex) {
  // Can value assignment for Nạp Âm
  // Giáp/Ất=1, Bính/Đinh=2, Mậu/Kỷ=3, Canh/Tân=4, Nhâm/Quý=5
  const canVal = Math.floor(menhCanIndex / 2) + 1;
  
  // Chi value assignment for Nạp Âm
  // Tý/Sửu/Ngọ/Mùi=0, Dần/Mão/Thân/Dậu=1, Thìn/Tỵ/Tuất/Hợi=2
  const CHI_VALS = [0, 0, 1, 1, 2, 2, 0, 0, 1, 1, 2, 2];
  const chiVal = CHI_VALS[menhChiIndex];
  
  let sum = canVal + chiVal;
  if (sum > 5) sum -= 5;
  
  const CUC_MAP = {
    1: { name: "Kim Tứ Cục", value: 4 },
    2: { name: "Thủy Nhị Cục", value: 2 },
    3: { name: "Hỏa Lục Cục", value: 6 },
    4: { name: "Thổ Ngũ Cục", value: 5 },
    5: { name: "Mộc Tam Cục", value: 3 }
  };
  return CUC_MAP[sum];
}

/**
 * Computes Minor Limit (Tiểu Hạn) Palace Index (0-indexed: Tý=0... Hợi=11)
 */
function getMinorLimitPalace(birthChiIdx, gioiTinh, birthYear, readingYear) {
  const age = readingYear - birthYear + 1;
  let startIdx = 10; // Default: Thân/Tý/Thìn starts at Tuất (10)
  
  if ([8, 0, 4].includes(birthChiIdx)) startIdx = 10; // Tuất
  else if ([2, 6, 10].includes(birthChiIdx)) startIdx = 4; // Thìn
  else if ([5, 9, 1].includes(birthChiIdx)) startIdx = 1; // Sửu
  else if ([11, 3, 7].includes(birthChiIdx)) startIdx = 7; // Mùi
  
  const dir = (gioiTinh === 1) ? 1 : -1; // Nam: Clockwise, Nữ: Counter-clockwise
  return (startIdx + dir * (age - 1) + 120) % 12;
}

// ==========================================
// 4. MAIN TỬ VI CALCULATION API
// ==========================================

/**
 * Main chart calculation function
 * @param {Object} input - { namSinh, thangSinh, ngaySinh, gioSinh, gioiTinh, namXem, inputCalendar, lunarLeapInput }
 * @returns {Object} JSON result matching target structure
 */
export function getTuViChart({ namSinh, thangSinh, ngaySinh, gioSinh, gioiTinh, namXem = 2026, inputCalendar = "solar", lunarLeapInput = 0 }) {
  let solarDay = ngaySinh;
  let solarMonth = thangSinh;
  let solarYear = namSinh;
  
  // Convert Lunar to Solar if specified
  if (inputCalendar === "lunar") {
    const solarDate = convertLunar2Solar(ngaySinh, thangSinh, namSinh, lunarLeapInput, 7.0);
    solarDay = solarDate[0];
    solarMonth = solarDate[1];
    solarYear = solarDate[2];
  }

  // 1. Julian Day & Hour calculation
  // In Lunar calendar, 23:00 - 00:59 counts as Tý hour of the next day.
  let jdn = jdFromDate(solarDay, solarMonth, solarYear);
  const hourIndex = (gioSinh >= 23) ? 1 : Math.floor((gioSinh + 1) / 2) + 1; // 1-indexed, Tý=1, Sửu=2 ... Hợi=12
  
  if (gioSinh >= 23) {
    jdn += 1; // Transition to next day
  }
  
  // Convert JDN back to Gregorian date to compute adjusted Lunar date
  const [adjDay, adjMonth, adjYear] = jdToDate(jdn);
  const [lunarDay, lunarMonth, lunarYear, lunarLeap] = convertSolar2Lunar(adjDay, adjMonth, adjYear, 7.0);
  
  // 2. Leap Month rule handling
  let thangTuVi = lunarMonth;
  if (lunarLeap === 1) {
    if (lunarDay > 15 || (lunarDay === 15 && gioSinh >= 11)) {
      thangTuVi = lunarMonth + 1;
      if (thangTuVi > 12) thangTuVi = 1;
    }
  }
  
  // 3. Can Chi values
  const yearCanChi = getCanChiYear(lunarYear);
  const monthCanChiStr = getCanChiMonth(thangTuVi, yearCanChi.canIdx);
  const dayCanChi = getCanChiDay(jdn);
  const hourCanChiStr = getCanChiHour(hourIndex, dayCanChi.canIdx);
  
  // Lục Thập Hoa Giáp Nạp Âm
  const cycleIdx = (lunarYear - 4) % 60;
  const cycleIdxCorrected = cycleIdx < 0 ? cycleIdx + 60 : cycleIdx;
  const NAP_AM = [
    "Hải Trung Kim", "Lư Trung Hỏa", "Đại Lâm Mộc", "Lộ Bàng Thổ", "Kiếm Phong Kim",
    "Sơn Đầu Hỏa", "Giản Hạ Thủy", "Thành Đầu Thổ", "Bạch Lạp Kim", "Dương Liễu Mộc",
    "Tuyền Trung Thủy", "Ốc Thượng Thổ", "Tích Lịch Hỏa", "Tòng Bá Mộc", "Trường Lưu Thủy",
    "Sa Trung Kim", "Sơn Hạ Hỏa", "Bình Địa Mộc", "Bích Thượng Thổ", "Kim Bạch Kim",
    "Phú Đăng Hỏa", "Thiên Hà Thủy", "Đại Trạch Thổ", "Thoa Xuyến Kim", "Tang Đố Mộc",
    "Đại Khê Thủy", "Sa Trung Thổ", "Thiên Thượng Hỏa", "Thạch Lựu Mộc", "Đại Hải Thủy"
  ];
  const menhNapAm = NAP_AM[Math.floor(cycleIdxCorrected / 2)];
  const menhElement = menhNapAm.split(' ').pop(); // returns "Kim", "Hỏa", "Mộc", "Thổ", "Thủy"

  // Âm Dương thuận nghịch lý
  const isDuongYear = (yearCanChi.canIdx % 2 === 0);
  const isNam = (gioiTinh === 1);
  const amDuongText = isDuongYear === isNam ? "Âm dương thuận lý" : "Âm dương nghịch lý";

  // Gender & Polarity classification
  const isDuong = isDuongYear;
  const phanLoai = (isDuong ? "Dương " : "Âm ") + (gioiTinh === 1 ? "Nam" : "Nữ");
  
  // 4. Mệnh & Thân Palace Placement (1-indexed: Tý=1... Hợi=12)
  const menhPos = xetSo(3 + thangTuVi - hourIndex);
  const thanPos = xetSo(3 + thangTuVi + hourIndex - 2);
  const menhChiIndex = menhPos - 1; // 0-indexed
  
  // Can index of Mệnh cung (Ngũ hổ độn rule)
  const distFromDan = (menhChiIndex - 2 + 12) % 12;
  const startCanOfDan = (yearCanChi.canIdx % 5) * 2 + 2;
  const menhCanIndex = (startCanOfDan + distFromDan) % 10;
  
  // Cục determination
  const cuc = getCuc(menhCanIndex, menhChiIndex);

  // Mệnh vs Cục relation
  function getCucMenhRelation(menh, cucName) {
    let c = "";
    if (cucName.includes("Kim")) c = "Kim";
    else if (cucName.includes("Mộc")) c = "Mộc";
    else if (cucName.includes("Thủy")) c = "Thủy";
    else if (cucName.includes("Hỏa")) c = "Hỏa";
    else if (cucName.includes("Thổ")) c = "Thổ";
    
    if (menh === c) return "Bản Mệnh Cục hòa hợp";
    
    const sinh = {
      "Kim": "Thủy",
      "Thủy": "Mộc",
      "Mộc": "Hỏa",
      "Hỏa": "Thổ",
      "Thổ": "Kim"
    };
    if (sinh[menh] === c) return "Bản Mệnh sinh Cục";
    if (sinh[c] === menh) return "Cục sinh Bản Mệnh";
    
    const khac = {
      "Kim": "Mộc",
      "Mộc": "Thổ",
      "Thổ": "Thủy",
      "Thủy": "Hỏa",
      "Hỏa": "Kim"
    };
    if (khac[menh] === c) return "Bản Mệnh khắc Cục";
    if (khac[c] === menh) return "Cục khắc Bản Mệnh";
    
    return "";
  }
  const menhCucRelation = getCucMenhRelation(menhElement, cuc.name);
  
  // 5. Star Placement Calculations
  // Prepare palaces database (0-indexed, Tý=0... Hợi=11)
  const laSoPalaces = Array.from({ length: 12 }, (_, i) => ({
    ten_cung: PALACE_NAMES[(menhPos - 1 - i + 12) % 12],
    chinh_tinh: [],
    phu_tinh: [],
    dai_han: 0,
    trang_sinh: "",
    nguyet_han: 0,
    is_than: false,
    tuan: false,
    triet: false
  }));

  // Calculate Triệt
  const yearCanIdx = yearCanChi.canIdx; // 0 to 9
  let trietPalaces = [];
  if (yearCanIdx === 0 || yearCanIdx === 5) trietPalaces = [8, 9];      // Thân, Dậu
  else if (yearCanIdx === 1 || yearCanIdx === 6) trietPalaces = [6, 7]; // Ngọ, Mùi
  else if (yearCanIdx === 2 || yearCanIdx === 7) trietPalaces = [4, 5]; // Thìn, Tỵ
  else if (yearCanIdx === 3 || yearCanIdx === 8) trietPalaces = [2, 3]; // Dần, Mão
  else if (yearCanIdx === 4 || yearCanIdx === 9) trietPalaces = [0, 11]; // Tý, Hợi
  
  trietPalaces.forEach(idx => {
    laSoPalaces[idx].triet = true;
  });

  // Calculate Tuần
  const startChi = (yearCanChi.chiIdx - yearCanIdx + 12) % 12;
  const tuanPalaces = [(startChi + 10) % 12, (startChi + 11) % 12];
  tuanPalaces.forEach(idx => {
    laSoPalaces[idx].tuan = true;
  });
  
  // Đại Hạn (10-year major cycle age) calculation
  const isDuongNamAmNu = (isDuong && gioiTinh === 1) || (!isDuong && gioiTinh === 0);
  const direction = isDuongNamAmNu ? 1 : -1;
  const startAge = cuc.value;
  
  for (let k = 0; k < 12; k++) {
    const palaceIdx = (menhPos - 1 + direction * k + 12) % 12;
    laSoPalaces[palaceIdx].dai_han = startAge + 10 * k;
  }
  
  // Vòng Tử Vi & Thiên Phủ Star Tables
  const cucTables = {
    2: [2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 1, 1, 2, 2, 3, 3, 4, 4, 5],
    3: [5, 2, 3, 6, 3, 4, 7, 4, 5, 8, 5, 6, 9, 6, 7, 10, 7, 8, 11, 8, 9, 12, 9, 10, 1, 10, 11, 2, 11, 12],
    4: [12, 5, 2, 3, 1, 6, 3, 4, 2, 7, 4, 5, 3, 8, 5, 6, 4, 9, 6, 7, 5, 10, 7, 8, 6, 11, 8, 9, 7, 12],
    5: [7, 12, 5, 2, 3, 8, 1, 6, 3, 4, 9, 2, 7, 4, 5, 10, 3, 8, 5, 6, 11, 4, 9, 6, 7, 12, 5, 10, 7, 8],
    6: [10, 7, 12, 5, 2, 3, 11, 8, 1, 6, 3, 4, 12, 9, 2, 7, 4, 5, 1, 10, 3, 8, 5, 6, 2, 11, 4, 9, 6, 7]
  };
  
  const tv = cucTables[cuc.value][lunarDay - 1];
  const tp = xetSo(6 - tv);
  
  const starPositions = {
    "Tử Vi": tv,
    "Liêm Trinh": xetSo(tv + 4),
    "Thiên Đồng": xetSo(tv + 7),
    "Vũ Khúc": xetSo(tv + 8),
    "Thái Dương": xetSo(tv + 9),
    "Thiên Cơ": xetSo(tv + 11),
    
    "Thiên Phủ": tp,
    "Thái Âm": xetSo(tp + 1),
    "Tham Lang": xetSo(tp + 2),
    "Cự Môn": xetSo(tp + 3),
    "Thiên Tướng": xetSo(tp + 4),
    "Thiên Lương": xetSo(tp + 5),
    "Thất Sát": xetSo(tp + 6),
    "Phá Quân": xetSo(tp + 10),
    
    "Văn Xương": xetSo(11 - hourIndex + 1),
    "Văn Khúc": xetSo(5 + hourIndex - 1),
    "Tả Phù": xetSo(5 + thangTuVi - 1),
    "Hữu Bật": xetSo(11 - thangTuVi + 1)
  };
  
  Object.entries(starPositions).forEach(([name, pos]) => {
    if (name !== "Văn Xương" && name !== "Văn Khúc" && name !== "Tả Phù" && name !== "Hữu Bật") {
      laSoPalaces[pos - 1].chinh_tinh.push(name);
    }
  });
  
  const tc1 = yearCanChi.canIdx + 1;
  const dc1 = yearCanChi.chiIdx + 1;
  
  const ltTable = [3, 4, 6, 7, 6, 7, 9, 10, 12, 1];
  const locTonPos = ltTable[tc1 - 1];
  const kinhDuongPos = xetSo(locTonPos + 1);
  const daLaPos = xetSo(locTonPos - 1);
  
  let khôiPos = 0, việtPos = 0;
  switch (tc1) {
    case 1:
    case 5:
      khôiPos = 2;
      việtPos = 8;
      break;
    case 2:
    case 6:
      khôiPos = 1;
      việtPos = 9;
      break;
    case 7:
    case 8:
      khôiPos = 7;
      việtPos = 3;
      break;
    case 3:
    case 4:
      khôiPos = 12;
      việtPos = 10;
      break;
    case 9:
    case 10:
      khôiPos = 4;
      việtPos = 6;
      break;
  }
  
  const thienKhocPos = xetSo(7 - dc1 + 1);
  const thienHuPos = xetSo(7 + dc1 - 1);
  
  const diaKhongPos = xetSo(12 - hourIndex + 1);
  const diaKiepPos = xetSo(12 + hourIndex - 1);
  
  const locStars = ["Liêm Trinh", "Thiên Cơ", "Thiên Đồng", "Thái Âm", "Tham Lang", "Vũ Khúc", "Thái Dương", "Cự Môn", "Thiên Lương", "Phá Quân"];
  const quyenStars = ["Phá Quân", "Thiên Lương", "Thiên Cơ", "Thiên Đồng", "Thái Âm", "Tham Lang", "Vũ Khúc", "Thái Dương", "Tử Vi", "Cự Môn"];
  const khoaStars = ["Vũ Khúc", "Tử Vi", "Văn Xương", "Thiên Cơ", "Hữu Bật", "Thiên Lương", "Thái Âm", "Văn Khúc", "Tả Phù", "Thái Âm"];
  const kyStars = ["Thái Dương", "Thái Âm", "Liêm Trinh", "Cự Môn", "Thiên Cơ", "Văn Khúc", "Thiên Đồng", "Văn Xương", "Vũ Khúc", "Tham Lang"];
  
  const hoaLocPos = starPositions[locStars[tc1 - 1]] || locTonPos;
  const hoaQuyenPos = starPositions[quyenStars[tc1 - 1]];
  const hoaKhoaPos = starPositions[khoaStars[tc1 - 1]];
  const hoaKyPos = starPositions[kyStars[tc1 - 1]];
  
  // Additional minor stars
  const yChi = yearCanChi.chiIdx; // 0 to 11

  // Thiên Mã
  let thienMaPos = 3; // Default Dần (3)
  if (yChi === 2 || yChi === 6 || yChi === 10) thienMaPos = 9;      // Thân
  else if (yChi === 8 || yChi === 0 || yChi === 4) thienMaPos = 3;  // Dần
  else if (yChi === 5 || yChi === 9 || yChi === 1) thienMaPos = 12; // Hợi
  else if (yChi === 11 || yChi === 3 || yChi === 7) thienMaPos = 6; // Tỵ

  // Đào Hoa
  let daoHoaPos = 1; // Default Tý (1)
  if (yChi === 2 || yChi === 6 || yChi === 10) daoHoaPos = 4;      // Mão
  else if (yChi === 8 || yChi === 0 || yChi === 4) daoHoaPos = 10; // Dậu
  else if (yChi === 5 || yChi === 9 || yChi === 1) daoHoaPos = 7;  // Ngọ
  else if (yChi === 11 || yChi === 3 || yChi === 7) daoHoaPos = 1; // Tý

  // Hồng Loan
  const hongLoanPos = xetSo(4 - yChi);

  // Thiên Hỷ
  const thienHyPos = xetSo(hongLoanPos + 6);

  // Cô Thần, Quả Tú
  let coThanPos = 3, quaTuPos = 11;
  if (yChi === 11 || yChi === 0 || yChi === 1) {
    coThanPos = 3; quaTuPos = 11; // Dần, Tuất
  } else if (yChi === 2 || yChi === 3 || yChi === 4) {
    coThanPos = 6; quaTuPos = 2;  // Tỵ, Sửu
  } else if (yChi === 5 || yChi === 6 || yChi === 7) {
    coThanPos = 9; quaTuPos = 5;  // Thân, Thìn
  } else if (yChi === 8 || yChi === 9 || yChi === 10) {
    coThanPos = 12; quaTuPos = 8; // Hợi, Mùi
  }

  // Song Hao (Đại Hao & Tiểu Hao) - from year Chi
  const daiHaoPos = xetSo(yChi + 3);
  const tieuHaoPos = xetSo(daiHaoPos + 6);

  const phuTinhList = [
    { name: "Lộc Tồn", pos: locTonPos },
    { name: "Kình Dương", pos: kinhDuongPos },
    { name: "Đà La", pos: daLaPos },
    { name: "Thiên Khôi", pos: khôiPos },
    { name: "Thiên Việt", pos: việtPos },
    { name: "Thiên Khốc", pos: thienKhocPos },
    { name: "Thiên Hư", pos: thienHuPos },
    { name: "Tả Phù", pos: starPositions["Tả Phù"] },
    { name: "Hữu Bật", pos: starPositions["Hữu Bật"] },
    { name: "Văn Xương", pos: starPositions["Văn Xương"] },
    { name: "Văn Khúc", pos: starPositions["Văn Khúc"] },
    { name: "Địa Không", pos: diaKhongPos },
    { name: "Địa Kiếp", pos: diaKiepPos },
    { name: "Hóa Lộc", pos: hoaLocPos },
    { name: "Hóa Quyền", pos: hoaQuyenPos },
    { name: "Hóa Khoa", pos: hoaKhoaPos },
    { name: "Hóa Kỵ", pos: hoaKyPos },
    { name: "Thiên Mã", pos: thienMaPos },
    { name: "Đào Hoa", pos: daoHoaPos },
    { name: "Hồng Loan", pos: hongLoanPos },
    { name: "Thiên Hỷ", pos: thienHyPos },
    { name: "Cô Thần", pos: coThanPos },
    { name: "Quả Tú", pos: quaTuPos },
    { name: "Đại Hao", pos: daiHaoPos },
    { name: "Tiểu Hao", pos: tieuHaoPos }
  ];

  // 1. Vòng Bác Sĩ
  const bacSiStars = ["Bác Sĩ", "Lực Sĩ", "Thanh Long", "Tiểu Hao", "Tướng Quân", "Tấu Thư", "Phi Liêm", "Hỷ Thần", "Bệnh Phù", "Đại Hao", "Phục Binh", "Quan Phù"];
  const bacSiDir = (isDuong && gioiTinh === 1) || (!isDuong && gioiTinh === 0) ? 1 : -1;
  for (let i = 0; i < 12; i++) {
    const starName = bacSiStars[i];
    const starPos = xetSo(locTonPos + bacSiDir * i);
    phuTinhList.push({ name: starName, pos: starPos });
  }

  // 2. Vòng Thái Tuế
  const thaiTueStars = ["Thái Tuế", "Thiếu Dương", "Tang Môn", "Thiếu Âm", "Quan Phù", "Tử Phù", "Tuế Phá", "Long Đức", "Bạch Hổ", "Phúc Đức", "Điếu Khách", "Trực Phù"];
  const startChiPos = yChi + 1; // 1-indexed
  for (let i = 0; i < 12; i++) {
    const starName = thaiTueStars[i];
    const starPos = xetSo(startChiPos + i);
    phuTinhList.push({ name: starName, pos: starPos });
  }

  // 3. Long Trì, Phượng Các, Giải Thần
  const longTriPos = xetSo(5 + yChi); // Starts at Thìn (5)
  const phuongCacPos = xetSo(11 - yChi + 12); // Starts at Tuất (11)
  phuTinhList.push({ name: "Long Trì", pos: longTriPos });
  phuTinhList.push({ name: "Phượng Các", pos: phuongCacPos });
  phuTinhList.push({ name: "Giải Thần", pos: phuongCacPos }); // Co-located with Phượng Các

  // 4. Ân Quang, Thiên Quý
  const anQuangPos = xetSo(starPositions["Văn Xương"] + lunarDay - 2);
  const thienQuyPos = xetSo(starPositions["Văn Khúc"] - lunarDay + 2);
  phuTinhList.push({ name: "Ân Quang", pos: anQuangPos });
  phuTinhList.push({ name: "Thiên Quý", pos: thienQuyPos });

  // 5. Tam Thai, Bát Tọa
  const tamThaiPos = xetSo(starPositions["Tả Phù"] + lunarDay - 1);
  const batToaPos = xetSo(starPositions["Hữu Bật"] - lunarDay + 1);
  phuTinhList.push({ name: "Tam Thai", pos: tamThaiPos });
  phuTinhList.push({ name: "Bát Tọa", pos: batToaPos });

  // 6. Thiên Tài, Thiên Thọ
  const thienTaiPos = xetSo(menhPos + yChi);
  const thienThoPos = xetSo(thanPos + yChi);
  phuTinhList.push({ name: "Thiên Tài", pos: thienTaiPos });
  phuTinhList.push({ name: "Thiên Thọ", pos: thienThoPos });

  // 7. Thiên Hình, Thiên Riêu, Thiên Y
  const thienHinhPos = xetSo(10 + thangTuVi - 1); // starts at Dậu (10)
  const thienRieuPos = xetSo(2 + thangTuVi - 1); // starts at Sửu (2)
  phuTinhList.push({ name: "Thiên Hình", pos: thienHinhPos });
  phuTinhList.push({ name: "Thiên Riêu", pos: thienRieuPos });
  phuTinhList.push({ name: "Thiên Y", pos: thienRieuPos }); // same as Thiên Riêu

  // 8. Thiên Quan, Thiên Phúc
  const quanList = [8, 5, 6, 3, 4, 10, 12, 10, 11, 7];
  const phucList = [10, 9, 1, 12, 4, 3, 7, 6, 7, 8];
  const thienQuanPos = quanList[tc1 - 1];
  const thienPhucPos = phucList[tc1 - 1];
  phuTinhList.push({ name: "Thiên Quan", pos: thienQuanPos });
  phuTinhList.push({ name: "Thiên Phúc", pos: thienPhucPos });

  // 9. Kiếp Sát, Lưu Hà
  let kiepSatPos = 9;
  if ([2, 6, 10].includes(yChi)) kiepSatPos = 12;
  else if ([8, 0, 4].includes(yChi)) kiepSatPos = 6;
  else if ([5, 9, 1].includes(yChi)) kiepSatPos = 3;
  else if ([11, 3, 7].includes(yChi)) kiepSatPos = 9;
  phuTinhList.push({ name: "Kiếp Sát", pos: kiepSatPos });

  const luuHaList = [10, 11, 8, 9, 6, 7, 5, 4, 12, 3];
  const luuHaPos = luuHaList[tc1 - 1];
  phuTinhList.push({ name: "Lưu Hà", pos: luuHaPos });

  // 10. Hoa Cái, Phá Toái
  let hoaCaiPos = 8;
  if ([2, 6, 10].includes(yChi)) hoaCaiPos = 11;
  else if ([8, 0, 4].includes(yChi)) hoaCaiPos = 5;
  else if ([5, 9, 1].includes(yChi)) hoaCaiPos = 2;
  else if ([11, 3, 7].includes(yChi)) hoaCaiPos = 8;
  phuTinhList.push({ name: "Hoa Cái", pos: hoaCaiPos });

  let phaToaiPos = 10;
  if ([0, 6, 3, 9].includes(yChi)) phaToaiPos = 6;
  else if ([4, 10, 1, 7].includes(yChi)) phaToaiPos = 2;
  phuTinhList.push({ name: "Phá Toái", pos: phaToaiPos });

  // 11. Thiên Sứ, Thiên Sử
  const thienSuPos = xetSo(menhPos - 5); // always at Tật Ách (6th counter-clockwise, which is Mệnh - 5)
  const thienSu2Pos = xetSo(menhPos + 5); // always at Nô Bộc (6th clockwise, which is Mệnh + 5)
  phuTinhList.push({ name: "Thiên Sứ", pos: thienSuPos });
  phuTinhList.push({ name: "Thiên Sử", pos: thienSu2Pos });
  
  phuTinhList.forEach(({ name, pos }) => {
    const palace = laSoPalaces[pos - 1];
    if (!palace.phu_tinh.includes(name)) {
      palace.phu_tinh.push(name);
    }
  });
  
  // 6. Calculate Tràng Sinh cycle stars
  const TRANG_SINH_STARS = [
    "Tràng Sinh", "Mộc Dục", "Quan Đới", "Lâm Quan", "Đế Vượng", "Suy",
    "Bệnh", "Tử", "Mộ", "Tuyệt", "Thai", "Dưỡng"
  ];
  let startBranchIdx = 2; // Default Hỏa Cục starts at Dần (2)
  if (cuc.name.includes("Kim")) startBranchIdx = 5;      // Tỵ
  else if (cuc.name.includes("Thủy") || cuc.name.includes("Thổ")) startBranchIdx = 8; // Thân
  else if (cuc.name.includes("Mộc")) startBranchIdx = 11;     // Hợi
  
  for (let k = 0; k < 12; k++) {
    const palaceIdx = (startBranchIdx + direction * k + 12) % 12;
    laSoPalaces[palaceIdx].trang_sinh = TRANG_SINH_STARS[k];
  }
  
  // 7. Mark Thân palace and compute Monthly Limit (Nguyệt Hạn)
  laSoPalaces[thanPos - 1].is_than = true;
  
  const minorLimitIdx = getMinorLimitPalace(yearCanChi.chiIdx, gioiTinh, lunarYear, namXem);
  let month1Idx = (minorLimitIdx - (thangTuVi - 1) + (hourIndex - 1) + 12) % 12;
  
  for (let idx = 0; idx < 12; idx++) {
    const monthNum = (idx - month1Idx + 12) % 12 + 1;
    laSoPalaces[idx].nguyet_han = monthNum;
  }
  
  // 8. Build the final output JSON structure
  const laSoOutput = {};
  CUNG_KEYS.forEach((key, idx) => {
    laSoOutput[key] = laSoPalaces[idx];
  });
  
  return {
    thong_tin_goc: {
      am_lich: {
        nam: yearCanChi.text,
        thang: monthCanChiStr,
        ngay: dayCanChi.text,
        gio: hourCanChiStr,
        ngay_so: lunarDay,
        thang_so: lunarMonth,
        nam_so: lunarYear,
        leap: lunarLeap
      },
      phan_loai: phanLoai,
      cuc: cuc.name,
      than_pos: thanPos,
      am_duong_text: amDuongText,
      menh_nap_am: menhNapAm,
      menh_cuc_relation: menhCucRelation
    },
    la_so: laSoOutput,
    star_properties: {
      elements: STAR_ELEMENTS,
      ratings: STAR_RATINGS
    }
  };
}
