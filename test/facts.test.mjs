/**
 * Dấu vân tay quyết định khi nào LLM phải viết lại bản tóm tắt mã.
 *
 * Đáng test vì nó sai theo cả hai hướng đều tốn: nhạy quá thì ngày nào cũng viết lại cả rổ cho
 * một thay đổi không ai đọc ra (đúng chuyện đã xảy ra — vân tay cũ băm thẳng NGÀY nên không bao
 * giờ trùng); trơ quá thì xu hướng đã đảo mà bản tóm tắt vẫn kể chuyện cũ.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { factsHash } from '../api/_facts.js';

const tech = (p = {}) => ({
  ngay: '2026-10-20', gia: 21.1, rsi14: 54.8,
  xu_huong: 'giằng co (giá và các đường MA đan xen)',
  hieu_suat: { '1M': { ma: 0 } },
  ...p,
});
const fund = (p = {}) => ({ eps: 1500, gia_tri_so_sach: 18000, roe_pct: 12.4, loi_nhuan_12t: 9e11, su_kien: [{ ngay_gdkhq: '2026-11-05' }], ...p });

describe('đổi mà không đáng kể thì KHÔNG viết lại', () => {
  const goc = factsHash(tech(), fund());

  test('sang ngày mới, số liệu y nguyên', () => {
    assert.equal(factsHash(tech({ ngay: '2026-10-21' }), fund()), goc);
  });

  test('giá nhúc nhích dưới một bậc 3%', () => {
    assert.equal(factsHash(tech({ gia: 21.2 }), fund()), goc);
    assert.equal(factsHash(tech({ gia: 20.95 }), fund()), goc);
  });

  test('RSI đi trong cùng một mức 10 điểm', () => {
    assert.equal(factsHash(tech({ rsi14: 50.1 }), fund()), goc);
    assert.equal(factsHash(tech({ rsi14: 59.9 }), fund()), goc);
  });

  test('hiệu suất 1 tháng đổi vài phần mười điểm', () => {
    assert.equal(factsHash(tech({ hieu_suat: { '1M': { ma: 4.9 } } }), fund()), goc);
  });
});

describe('đổi đáng kể thì PHẢI viết lại', () => {
  const goc = factsHash(tech(), fund());

  test('giá chạy quá một bậc 3%', () => {
    assert.notEqual(factsHash(tech({ gia: 23 }), fund()), goc);
  });

  test('xu hướng đảo', () => {
    assert.notEqual(factsHash(tech({ xu_huong: 'tăng (giá trên cả MA20 và MA50)' }), fund()), goc);
  });

  test('RSI vượt ngưỡng 70, và rơi xuống dưới 30', () => {
    assert.notEqual(factsHash(tech({ rsi14: 71 }), fund()), goc);
    assert.notEqual(factsHash(tech({ rsi14: 28 }), fund()), goc);
  });

  test('ranh giới 70 và 30 rơi đúng vào ranh giới mức', () => {
    assert.notEqual(factsHash(tech({ rsi14: 69 }), fund()), factsHash(tech({ rsi14: 70 }), fund()));
    assert.notEqual(factsHash(tech({ rsi14: 29 }), fund()), factsHash(tech({ rsi14: 30 }), fund()));
  });

  test('số liệu cơ bản đổi: giữ nguyên độ nhạy, không chia mức', () => {
    assert.notEqual(factsHash(tech(), fund({ eps: 1501 })), goc);
    assert.notEqual(factsHash(tech(), fund({ roe_pct: 12.5 })), goc);
    assert.notEqual(factsHash(tech(), fund({ su_kien: [{ ngay_gdkhq: '2026-12-01' }] })), goc);
  });
});

describe('thiếu dữ liệu thì không ném lỗi', () => {
  test('không có kỹ thuật, không có cơ bản', () => {
    assert.equal(typeof factsHash(null, null), 'string');
    assert.equal(factsHash(null, null).length, 16);
  });

  test('giá hỏng hoặc bằng 0 vẫn băm được', () => {
    for (const g of [0, -1, null, undefined, NaN]) {
      assert.equal(typeof factsHash(tech({ gia: g }), fund()), 'string', String(g));
    }
  });

  test('thiếu hẳn khối hiệu suất', () => {
    assert.equal(typeof factsHash(tech({ hieu_suat: undefined }), fund()), 'string');
  });

  test('hai mã khác số liệu thì vân tay khác nhau', () => {
    assert.notEqual(factsHash(tech(), fund()), factsHash(tech({ gia: 57.4 }), fund({ eps: 4200 })));
  });
});
