/**
 * js/profile.js — Hồ Sơ Huyền Học dùng chung toàn site.
 * Lưu localStorage 'latbai_profile': nhập tên + ngày sinh MỘT LẦN,
 * mọi module (tử vi, thần số học, giải mã tên...) tự điền lại.
 * Kèm các phép tính thần số học nhẹ cho dashboard/widget trang chủ.
 * Global: window.LatbaiProfile
 */
(function () {
  'use strict';

  const KEY = 'latbai_profile';

  function reduceToSingle(num) {
    while (num > 9) {
      num = num.toString().split('').reduce((s, d) => s + parseInt(d), 0);
    }
    return num;
  }

  function lifePath(day, month, year) {
    const digits = `${day}${month}${year}`.replace(/\D/g, '');
    let sum = digits.split('').reduce((s, d) => s + parseInt(d), 0);
    while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
      sum = sum.toString().split('').reduce((s, d) => s + parseInt(d), 0);
    }
    if (sum === 22) return '22/4';
    if (sum === 33) return '33/6';
    return String(sum);
  }

  function personalYear(day, month, forYear) {
    return reduceToSingle(reduceToSingle(day) + reduceToSingle(month) + reduceToSingle(forYear));
  }

  function personalDay(day, month, date) {
    const py = personalYear(day, month, date.getFullYear());
    const pm = reduceToSingle(py + (date.getMonth() + 1));
    return reduceToSingle(pm + date.getDate());
  }

  const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
  const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
  const GIAP = ['Chuột', 'Trâu', 'Hổ', 'Mèo', 'Rồng', 'Rắn', 'Ngựa', 'Dê', 'Khỉ', 'Gà', 'Chó', 'Lợn'];

  function canChi(year) {
    const can = ((year - 4) % 10 + 10) % 10;
    const chi = ((year - 4) % 12 + 12) % 12;
    return { text: `${CAN[can]} ${CHI[chi]}`, giap: GIAP[chi], chiIdx: chi };
  }

  // FNV-1a hash — seed ổn định cho "Vận Hôm Nay"
  function seedHash(str) {
    let h = 2166136261;
    for (const c of str) {
      h ^= c.codePointAt(0);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  window.LatbaiProfile = {
    get() {
      try {
        const p = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (!p || !p.name || !p.day || !p.month || !p.year) return null;
        return p;
      } catch (_) { return null; }
    },
    save(patch) {
      const cur = this.get() || {};
      const next = Object.assign({}, cur, patch, { updatedAt: new Date().toISOString() });
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) {}
      return next;
    },
    clear() {
      try { localStorage.removeItem(KEY); } catch (_) {}
    },
    // các phép tính nhẹ dùng cho dashboard
    reduceToSingle,
    lifePath,
    personalYear,
    personalDay,
    canChi,
    seedHash
  };
})();
