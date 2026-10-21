/**
 * Giá: biên độ, bước giá, giá tham chiếu, luật khớp của giao dịch thử, và lớp bảo vệ nguồn giá.
 * Phần nguồn giá chạy với một máy chủ giả tại chỗ — không chạm mạng thật.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { tickU, limits, refFromBars, vnNow, sessionState } from '../api/_market.js';

describe('bước giá', () => {
  test('HOSE đổi bước theo mức giá', () => {
    assert.equal(tickU(999, 'HOSE'), 1, 'dưới 10.000đ: bước 10đ');
    assert.equal(tickU(4999, 'HOSE'), 5, 'từ 10.000 đến dưới 50.000đ: bước 50đ');
    assert.equal(tickU(5000, 'HOSE'), 10, 'từ 50.000đ: bước 100đ');
  });
  test('HNX và UPCOM một bước duy nhất', () => {
    for (const ex of ['HNX', 'UPCOM']) assert.equal(tickU(999, ex), 10);
  });
});

describe('trần/sàn', () => {
  test('biên độ đúng từng sàn', () => {
    assert.deepEqual(limits(100, 'HOSE'), { ceil: 107, floor: 93 });
    assert.deepEqual(limits(100, 'HNX'), { ceil: 110, floor: 90 });
    assert.deepEqual(limits(100, 'UPCOM'), { ceil: 115, floor: 85 });
  });
  test('làm tròn về bước giá, và luôn nằm TRONG biên', () => {
    for (const ref of [9.82, 20.9, 57.1, 58.2, 2.0]) {
      const { ceil, floor } = limits(ref, 'HOSE');
      assert.ok(ceil <= ref * 1.07 + 1e-9, `trần ${ceil} vượt +7% của ${ref}`);
      assert.ok(floor >= ref * 0.93 - 1e-9, `sàn ${floor} thủng -7% của ${ref}`);
      assert.ok(ceil > ref && floor < ref);
    }
  });
  // Đối chiếu với secdef thật của DNSE và bảng giá, đo ngày 19/10/2026.
  // SHB là ca bắt được lỗi: tham chiếu 10.550đ nằm trên mốc đổi bước giá, nhưng SÀN 9.820đ lại
  // nằm dưới mốc đó, nên bước giá phải lấy theo mức giá kết quả chứ không theo tham chiếu.
  for (const [ma, ref, tran, san] of [['SHB', 10.55, 11.25, 9.82], ['HPG', 20.9, 22.35, 19.45]]) {
    test(`khớp số thật của DNSE: ${ma} tham chiếu ${ref}`, () => {
      assert.deepEqual(limits(ref, 'HOSE'), { ceil: tran, floor: san });
    });
  }
});

describe('giá tham chiếu', () => {
  const ngay = (ymd, c) => ({ t: Date.parse(`${ymd}T09:00:00+07:00`) / 1000, o: c, h: c, l: c, c, v: 1 });
  const luc = Date.parse('2026-10-19T05:00:00Z');   // 12:00 VN ngày 19, đang trong phiên

  test('lấy giá đóng cửa phiên TRƯỚC, không phải nến hôm nay', () => {
    const bars = [ngay('2026-10-16', 57.5), ngay('2026-10-17', 58.2), ngay('2026-10-19', 57.1)];
    assert.equal(refFromBars(bars, luc), 58.2, 'nến hôm nay không bao giờ là tham chiếu');
  });
  test('chưa có nến hôm nay thì lấy nến cuối', () => {
    assert.equal(refFromBars([ngay('2026-10-16', 57.5), ngay('2026-10-17', 58.2)], luc), 58.2);
  });
  test('chỉ có nến hôm nay, hoặc rỗng, thì không kết luận', () => {
    assert.equal(refFromBars([ngay('2026-10-19', 57.1)], luc), null);
    assert.equal(refFromBars([], luc), null);
    assert.equal(refFromBars(null, luc), null);
  });
});

describe('giờ giao dịch', () => {
  const vn = (ymd, hm) => Date.parse(`${ymd}T${hm}:00+07:00`);
  test('phân phiên đúng mốc', () => {
    assert.equal(sessionState(vn('2026-10-19', '08:59')), 'closed');
    assert.equal(sessionState(vn('2026-10-19', '09:00')), 'ato');
    assert.equal(sessionState(vn('2026-10-19', '09:15')), 'open');
    assert.equal(sessionState(vn('2026-10-19', '11:30')), 'closed', 'nghỉ trưa');
    assert.equal(sessionState(vn('2026-10-19', '13:00')), 'open');
    assert.equal(sessionState(vn('2026-10-19', '14:30')), 'atc');
    assert.equal(sessionState(vn('2026-10-19', '14:45')), 'closed');
  });
  test('cuối tuần luôn đóng', () => {
    assert.equal(sessionState(vn('2026-10-17', '10:00')), 'closed');   // thứ Bảy
    assert.equal(sessionState(vn('2026-10-18', '10:00')), 'closed');   // Chủ nhật
  });
  test('vnNow đổi ngày lúc 00:00 giờ VN', () => {
    assert.equal(vnNow(Date.parse('2026-10-19T16:59:00Z')).ymd, '2026-10-19');
    assert.equal(vnNow(Date.parse('2026-10-19T17:00:00Z')).ymd, '2026-10-20');
  });
});

describe('bảo vệ nguồn giá: trần song song và ngắt mạch', () => {
  test('không bao giờ quá 6 request cùng lúc, và vẫn gọi đủ', async () => {
    let dang = 0, dinh = 0, tong = 0;
    const srv = http.createServer((req, res) => {
      tong++; dang++; dinh = Math.max(dinh, dang);
      setTimeout(() => { dang--; res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ t: [1], o: [1], h: [1], l: [1], c: [1], v: [1] })); }, 30);
    });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    process.env.PRICE_FEED_URL = `http://127.0.0.1:${srv.address().port}`;
    const { fetchBars } = await import(`../api/_market.js?t=${Date.now()}`);

    const ma = Array.from({ length: 40 }, (_, i) => `SYM${String(i).padStart(3, '0')}`);
    await Promise.allSettled(ma.map((s) => fetchBars(s, 8)));
    srv.close();
    delete process.env.PRICE_FEED_URL;

    assert.ok(dinh <= 6, `đỉnh ${dinh} request đồng thời, trần là 6`);
    assert.equal(tong, 40, 'xếp hàng chứ không bỏ mã nào');
  });

  test('mã sai (400) KHÔNG làm ngắt mạch — tra vài mã sai không được làm sập bảng giá', async () => {
    let che = '400';
    const srv = http.createServer((req, res) => {
      if (che === '400') { res.writeHead(400); return res.end('{"error":"not found"}'); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ t: [1], o: [1], h: [1], l: [1], c: [1], v: [1] }));
    });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    process.env.PRICE_FEED_URL = `http://127.0.0.1:${srv.address().port}`;
    const { fetchBars } = await import(`../api/_market.js?t=${Date.now()}`);

    for (let i = 0; i < 8; i++) await fetchBars(`SAI${i}`, 8).catch(() => {});
    che = 'ok';
    const bars = await fetchBars('FPT', 8);
    srv.close();
    delete process.env.PRICE_FEED_URL;
    assert.equal(bars.length, 1, 'nguồn vẫn trả lời nên không được ngắt mạch');
  });

  test('nguồn CHẾT thì sau vài lần hỏng là từ chối ngay, không treo 8 giây mỗi lần', async () => {
    const srv = http.createServer(() => { /* không bao giờ trả lời */ });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    process.env.PRICE_FEED_URL = `http://127.0.0.1:${srv.address().port}`;
    const { fetchBars } = await import(`../api/_market.js?t=${Date.now()}`);

    await Promise.allSettled(Array.from({ length: 6 }, (_, i) => fetchBars(`CHET${i}`, 8)));
    const t = Date.now();
    const loi = await fetchBars('FPT', 8).then(() => null, (e) => e.message);
    const ms = Date.now() - t;
    srv.close();
    delete process.env.PRICE_FEED_URL;

    assert.match(loi ?? '', /ngắt mạch/, `phải bị ngắt mạch, nhận được: ${loi}`);
    assert.ok(ms < 500, `phải hỏng ngay, mất ${ms}ms`);
  });
});
