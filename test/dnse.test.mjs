/**
 * Lớp an toàn của đường đặt lệnh thật: chữ ký HMAC, mã xác nhận, và trần ngày.
 * Toàn hàm thuần hoặc chỉ đọc biến môi trường — không gọi DNSE, không chạm DB.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  rfc2822, signatureHeaders, makeConfirm, readConfirm, startOfVnDay,
  maxOrderVnd, maxDailyVnd, maxOrdersPerDay, DnseError,
} from '../api/_dnse.js';

describe('chữ ký HMAC gửi DNSE', () => {
  const key = 'KHOA_THU', secret = 'BI_MAT_THU';

  test('đúng công thức trong SDK: (request-target), date, nonce', () => {
    const date = 'Mon, 19 Oct 2026 10:00:00 +0000', nonce = 'abc123';
    const h = signatureHeaders('GET', '/accounts', { apiKey: key, apiSecret: secret, date, nonce });
    const mong = crypto.createHmac('sha256', secret)
      .update(`(request-target): get /accounts\ndate: ${date}\nnonce: ${nonce}`).digest('base64');
    assert.equal(h['x-api-key'], key);
    assert.equal(h.date, date);
    assert.ok(h['X-Signature'].includes(`signature="${encodeURIComponent(mong)}"`));
    assert.ok(h['X-Signature'].includes(`nonce="${nonce}"`));
  });

  test('phương thức được hạ chữ thường trong chuỗi ký', () => {
    const chung = { apiKey: key, apiSecret: secret, date: 'D', nonce: 'N' };
    assert.equal(signatureHeaders('POST', '/p', chung)['X-Signature'],
                 signatureHeaders('post', '/p', chung)['X-Signature']);
  });

  test('mỗi lần gọi một nonce khác — DNSE từ chối nonce đã dùng', () => {
    const a = signatureHeaders('GET', '/accounts', { apiKey: key, apiSecret: secret });
    const b = signatureHeaders('GET', '/accounts', { apiKey: key, apiSecret: secret });
    assert.notEqual(a['X-Signature'], b['X-Signature']);
  });

  test('rfc2822 theo UTC, đúng khuôn strftime của SDK', () => {
    assert.equal(rfc2822(new Date('2026-10-19T07:05:09Z')), 'Mon, 19 Oct 2026 07:05:09 +0000');
  });
});

describe('mã xác nhận lệnh (xem trước -> đặt)', () => {
  const uid = '11111111-1111-1111-1111-111111111111';
  const lenh = { accountNo: '0001036879', symbol: 'SHB', side: 'NB', orderType: 'LO', quantity: 100, price: 9.82 };
  beforeEach(() => { process.env.SESSION_SECRET = 'bi-mat-phien-dung-de-test'; });

  test('đi và về nguyên vẹn, giữ cả giá trị lệnh', () => {
    const c = readConfirm(uid, makeConfirm(uid, lenh, 982000));
    assert.deepEqual(c.order, lenh);
    assert.equal(c.estValueVnd, 982000, 'trần ngày cộng dồn theo con số này');
    assert.ok(c.nonce);
  });

  test('người khác cầm mã cũng không dùng được', () => {
    assert.equal(readConfirm('22222222-2222-2222-2222-222222222222', makeConfirm(uid, lenh)), null);
  });

  test('sửa nội dung lệnh thì mã hỏng — không đổi được lệnh sau khi xem trước', () => {
    const [payload, sig] = makeConfirm(uid, lenh).split('.');
    const gian = JSON.parse(Buffer.from(payload, 'base64url').toString());
    gian.order.quantity = 100000;
    const gia = Buffer.from(JSON.stringify(gian)).toString('base64url');
    assert.equal(readConfirm(uid, `${gia}.${sig}`), null);
  });

  test('mã rác hoặc thiếu phần thì trả null chứ không ném lỗi', () => {
    for (const x of ['', 'khongcodau', 'a.b', null, undefined, 'a.b.c']) {
      assert.equal(readConfirm(uid, x), null);
    }
  });

  test('đổi SESSION_SECRET thì mã cũ hết hiệu lực', () => {
    const m = makeConfirm(uid, lenh);
    process.env.SESSION_SECRET = 'bi-mat-khac';
    assert.equal(readConfirm(uid, m), null);
  });
});

describe('mốc 00:00 giờ Việt Nam (trần ngày tính từ đây)', () => {
  // VN là UTC+7 quanh năm, nên 00:00 VN = 17:00 UTC hôm trước.
  const ca = [
    ['2026-10-19T11:15:00Z', '2026-10-18T17:00:00.000Z', '18:15 VN, giữa ngày 19'],
    ['2026-10-19T01:30:00Z', '2026-10-18T17:00:00.000Z', '08:30 VN, trước phiên'],
    ['2026-10-19T16:59:59Z', '2026-10-18T17:00:00.000Z', '23:59:59 VN, vẫn ngày 19'],
    ['2026-10-19T17:00:00Z', '2026-10-19T17:00:00.000Z', '00:00 VN ngày 20, sang mốc mới'],
  ];
  for (const [luc, mong, ten] of ca) {
    test(ten, () => assert.equal(startOfVnDay(Date.parse(luc)), mong));
  }
});

describe('hạn mức', () => {
  const cu = { ...process.env };
  beforeEach(() => { for (const k of ['DNSE_MAX_ORDER_VND', 'DNSE_MAX_DAILY_VND', 'DNSE_MAX_ORDERS_PER_DAY']) delete process.env[k]; });

  test('mặc định an toàn ngay cả khi chưa đặt biến môi trường nào', () => {
    assert.equal(maxOrderVnd(), 20_000_000);
    assert.equal(maxDailyVnd(), 100_000_000);
    assert.equal(maxOrdersPerDay(), 20);
  });

  test('đọc được giá trị đặt trên Vercel', () => {
    process.env.DNSE_MAX_ORDER_VND = '2000000';
    process.env.DNSE_MAX_DAILY_VND = '5000000';
    process.env.DNSE_MAX_ORDERS_PER_DAY = '5';
    assert.equal(maxOrderVnd(), 2_000_000);
    assert.equal(maxDailyVnd(), 5_000_000);
    assert.equal(maxOrdersPerDay(), 5);
    Object.assign(process.env, cu);
  });

  test('giá trị rác rơi về mặc định chứ không thành 0 (0 sẽ chặn mọi lệnh)', () => {
    process.env.DNSE_MAX_ORDER_VND = 'linh tinh';
    assert.equal(maxOrderVnd(), 20_000_000);
    process.env.DNSE_MAX_ORDER_VND = '0';
    assert.equal(maxOrderVnd(), 20_000_000);
  });
});

describe('DnseError', () => {
  test('cờ chuaRo quyết định phiếu thành unknown hay failed', () => {
    assert.equal(new DnseError('x', 503, 'unreachable', { chuaRo: true }).chuaRo, true);
    assert.equal(new DnseError('x', 400, 'dnse').chuaRo, false);
  });
});
