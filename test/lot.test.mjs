/**
 * Lô chẵn, lô lẻ và cách tách khối lượng.
 *
 * Đáng test vì đây là chỗ một con số sai thành tiền thật: tách nhầm là gửi thừa hoặc thiếu cổ
 * phiếu, còn cho qua một khối lượng sàn không nhận (vd 150) thì lệnh bị từ chối giữa phiên.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hopLe, tach, phaiTach, moTaTach, LO_CHAN } from '../api/_lot.js';

describe('khối lượng nào gửi thẳng được', () => {
  test('lô chẵn: bội số của 100', () => {
    for (const q of [100, 200, 1000, 213_000]) assert.equal(hopLe(q, 'LO'), true, String(q));
  });

  test('lô lẻ 1-99 hợp lệ, nhưng CHỈ với lệnh LO', () => {
    for (const q of [1, 13, 99]) {
      assert.equal(hopLe(q, 'LO'), true, `LO ${q}`);
      for (const t of ['MTL', 'ATO', 'ATC', 'MP']) assert.equal(hopLe(q, t), false, `${t} ${q}`);
    }
  });

  test('số ở giữa không phải lệnh hợp lệ với bất kỳ loại nào', () => {
    for (const q of [101, 150, 213, 999]) {
      for (const t of ['LO', 'MTL', 'ATO', 'ATC']) assert.equal(hopLe(q, t), false, `${t} ${q}`);
    }
  });

  test('số không, số âm, số lẻ thập phân đều không hợp lệ', () => {
    for (const q of [0, -100, -1, 10.5, NaN, Infinity]) assert.equal(hopLe(q, 'LO'), false, String(q));
  });

  test('lô chẵn là 100', () => assert.equal(LO_CHAN, 100));
});

describe('tách khối lượng thành các lệnh gửi được', () => {
  test('số lẻ ở giữa tách thành lô chẵn rồi lô lẻ', () => {
    assert.deepEqual(tach(213), [{ qty: 200, le: false }, { qty: 13, le: true }]);
    assert.deepEqual(tach(150), [{ qty: 100, le: false }, { qty: 50, le: true }]);
    assert.deepEqual(tach(101), [{ qty: 100, le: false }, { qty: 1, le: true }]);
  });

  test('lô chẵn giữ nguyên một lệnh', () => {
    assert.deepEqual(tach(200), [{ qty: 200, le: false }]);
    assert.deepEqual(tach(100), [{ qty: 100, le: false }]);
  });

  test('dưới 100 là một lệnh lô lẻ', () => {
    assert.deepEqual(tach(13), [{ qty: 13, le: true }]);
    assert.deepEqual(tach(99), [{ qty: 99, le: true }]);
    assert.deepEqual(tach(1), [{ qty: 1, le: true }]);
  });

  test('lô chẵn LUÔN đi trước: phần lớn tiền vào sàn trước khi có gì hỏng', () => {
    const p = tach(213);
    assert.equal(p[0].le, false);
    assert.equal(p[1].le, true);
  });

  test('tổng các phần đúng bằng khối lượng ban đầu', () => {
    for (const q of [1, 99, 100, 101, 150, 213, 999, 1000, 12_345]) {
      assert.equal(tach(q).reduce((a, x) => a + x.qty, 0), q, String(q));
    }
  });

  test('mọi phần tách ra đều phải tự nó hợp lệ', () => {
    for (const q of [1, 99, 101, 150, 213, 999, 12_345]) {
      for (const p of tach(q)) assert.equal(hopLe(p.qty, 'LO'), true, `${q} -> ${p.qty}`);
    }
  });

  test('số không hợp lệ thì không tách ra gì', () => {
    for (const q of [0, -5, 1.5, NaN]) assert.deepEqual(tach(q), [], String(q));
  });
});

describe('khi nào phải tách và nói với người dùng thế nào', () => {
  test('chỉ số ở giữa mới phải tách', () => {
    assert.equal(phaiTach(213), true);
    assert.equal(phaiTach(200), false);
    assert.equal(phaiTach(13), false);
  });

  test('câu mô tả nêu đủ số lệnh và từng phần', () => {
    const t = moTaTach(213);
    assert.match(t, /2 lệnh/);
    assert.match(t, /200/);
    assert.match(t, /13/);
    assert.match(t, /lô lẻ/);
  });

  test('không phải tách thì không có câu nào', () => {
    assert.equal(moTaTach(200), null);
    assert.equal(moTaTach(13), null);
  });
});
