/**
 * js/profile.js — Hồ Sơ Huyền Học dùng chung toàn site.
 * Lưu localStorage 'latbai_profiles': nhiều hồ sơ trên 1 thiết bị
 * (bản thân + người nhà), mỗi lúc 1 hồ sơ "đang chọn" (active).
 * API cũ get()/save()/clear() vẫn hoạt động trên hồ sơ đang chọn,
 * nên các module (tử vi, thần số học, giải mã tên...) không cần sửa.
 * save() với TÊN KHÁC hồ sơ đang chọn sẽ tự tách thành hồ sơ mới —
 * người nhà xem tử vi không làm mất hồ sơ của chủ máy.
 * Kèm các phép tính thần số học nhẹ cho dashboard/widget trang chủ.
 * Global: window.LatbaiProfile
 */
(function () {
  'use strict';

  const KEY = 'latbai_profiles';
  const LEGACY_KEY = 'latbai_profile';
  const MAX_PROFILES = 10;

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

  function isValid(p) {
    return !!(p && p.name && p.day && p.month && p.year);
  }

  function newId() {
    return 'pf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function sameName(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  function readStore() {
    let store = null;
    try { store = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
    if (!store || !Array.isArray(store.list)) {
      store = { active: null, list: [] };
      // migrate hồ sơ đơn từ bản cũ
      try {
        const old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
        if (isValid(old)) {
          old.id = newId();
          store.list.push(old);
          store.active = old.id;
          writeStore(store);
          localStorage.removeItem(LEGACY_KEY);
        }
      } catch (_) {}
    }
    return store;
  }

  function writeStore(store) {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_) {}
  }

  function activeOf(store) {
    return store.list.find((p) => p.id === store.active) || store.list[0] || null;
  }

  window.LatbaiProfile = {
    /** Hồ sơ đang chọn (giữ tương thích API cũ). */
    get() {
      const p = activeOf(readStore());
      return isValid(p) ? p : null;
    },
    /** Tất cả hồ sơ trên thiết bị. */
    list() {
      return readStore().list.filter(isValid);
    },
    /** Đổi hồ sơ đang chọn. */
    setActive(id) {
      const store = readStore();
      if (store.list.some((p) => p.id === id)) {
        store.active = id;
        writeStore(store);
      }
      return activeOf(store);
    },
    /**
     * Cập nhật hồ sơ đang chọn. Nếu patch mang TÊN KHÁC → tách hồ sơ mới
     * (trừ khi truyền id để chỉ định sửa đúng hồ sơ đó).
     */
    save(patch) {
      const store = readStore();
      let target = patch.id
        ? store.list.find((p) => p.id === patch.id)
        : activeOf(store);

      if (!patch.id && target && patch.name && !sameName(patch.name, target.name)) {
        // tên mới → hồ sơ mới; nếu trùng tên hồ sơ khác trong danh sách thì cập nhật hồ sơ đó
        target = store.list.find((p) => sameName(p.name, patch.name)) || null;
      }

      if (!target) {
        if (store.list.length >= MAX_PROFILES) {
          // đầy: ghi đè hồ sơ cũ nhất theo updatedAt
          store.list.sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')));
          target = store.list[0];
        } else {
          target = { id: newId() };
          store.list.push(target);
        }
      }

      Object.assign(target, patch, { id: target.id, updatedAt: new Date().toISOString() });
      store.active = target.id;
      writeStore(store);
      return target;
    },
    /** Xóa 1 hồ sơ (mặc định: hồ sơ đang chọn). */
    remove(id) {
      const store = readStore();
      const cur = activeOf(store);
      const targetId = id || (cur && cur.id);
      store.list = store.list.filter((p) => p.id !== targetId);
      if (store.active === targetId) {
        store.active = store.list.length ? store.list[0].id : null;
      }
      writeStore(store);
    },
    /** Xóa hồ sơ đang chọn (giữ tương thích API cũ). */
    clear() {
      this.remove();
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
