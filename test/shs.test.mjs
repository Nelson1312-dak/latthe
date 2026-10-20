/**
 * Đường đặt lệnh SHS: hình dạng request gửi đi, và lớp an toàn dùng chung giữa hai công ty
 * chứng khoán (mã xác nhận, tách hạn mức theo broker).
 *
 * Vì sao đáng test: đường SHS đọc ra từ bundle JavaScript của app SHSmart chứ không từ tài liệu,
 * nên mỗi tên trường ở đây là một giả định. Ba chỗ sai là mất tiền thật chứ không phải lỗi hiển thị:
 *   - `stockCode` với `code`: cổ phiếu và phái sinh dùng tên khác nhau
 *   - `sellBuyType`: trong bundle có HAI bảng enum, một bảng "BUY"/"SELL", một bảng "1"/"2" (bảng
 *     "1"/"2" là loại giao dịch lưu ký, KHÔNG phải chiều lệnh) — lấy nhầm là mua thành bán
 *   - đơn vị giá: SHS nhận ĐỒNG, bảng giá của site để nghìn đồng
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeConfirm, readConfirm, startOfVnDay } from '../api/_broker.js';
import * as shs from '../api/_shs.js';

/** Bắt lấy request mà _shs.js gửi đi, không chạm mạng. */
async function batRequest(fn) {
  const that = globalThis.fetch;
  let got = null;
  globalThis.fetch = async (url, opts) => {
    got = { url: String(url), method: opts?.method, headers: opts?.headers, body: opts?.body ? JSON.parse(opts.body) : null };
    return new Response(JSON.stringify({ orderNumber: '123' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try { await fn(); } finally { globalThis.fetch = that; }
  return got;
}

describe('hình dạng lệnh gửi SHS', () => {
  const lenh = { accountNumber: '069C130706', subNumber: '0001075179', symbol: 'HQC', side: 'BUY', type: 'LO', price: 1980, qty: 100 };

  test('đặt lệnh: POST /api/v1/equity/order, cổ phiếu đi bằng stockCode', async () => {
    const r = await batRequest(() => shs.placeOrder('tok', lenh));
    assert.equal(r.method, 'POST');
    assert.ok(r.url.endsWith('/api/v1/equity/order'), r.url);
    assert.equal(r.body.stockCode, 'HQC');
    assert.equal(r.body.code, undefined, 'code là của phái sinh, cổ phiếu dùng stockCode');
    assert.equal(r.body.accountNumber, '069C130706');
    assert.equal(r.body.subNumber, '0001075179');
    assert.equal(r.body.orderPrice, 1980);
    assert.equal(r.body.orderQuantity, 100);
    assert.equal(r.body.orderType, 'LO');
    assert.equal(r.body.mediaType, '11');
    assert.equal(r.headers.Authorization, 'Bearer tok');
  });

  test('chiều lệnh là chữ BUY/SELL, không phải số 1/2', () => {
    assert.equal(shs.SIDE.B, 'BUY');
    assert.equal(shs.SIDE.S, 'SELL');
  });

  test('hủy lệnh là PUT /cancel và phải kèm số hiệu lệnh', async () => {
    const r = await batRequest(() => shs.cancelOrder('tok', { ...lenh, orderNumber: '987', branchCode: 'HN' }));
    assert.equal(r.method, 'PUT');
    assert.ok(r.url.endsWith('/api/v1/equity/order/cancel'), r.url);
    assert.equal(r.body.orderNumber, '987');
    assert.equal(r.body.branchCode, 'HN');
  });

  test('không có branchCode thì không gửi trường rỗng', async () => {
    const r = await batRequest(() => shs.cancelOrder('tok', { ...lenh, orderNumber: '987' }));
    assert.ok(!('branchCode' in r.body));
  });

  test('loại lệnh hợp lệ đúng bảng enum của SHS', () => {
    for (const t of ['LO', 'MP', 'ATO', 'ATC', 'MOK', 'MAK', 'MTL', 'PLO']) assert.ok(shs.ORDER_TYPES.includes(t), t);
    assert.ok(!shs.ORDER_TYPES.includes('MTL_POST'));
  });

  test('giá tính bằng đồng, không phải nghìn đồng', () => {
    assert.equal(shs.DON_VI_GIA, 'vnd');
  });
});

describe('công tắc và hạn mức SHS', () => {
  const dat = (k, v) => { const cu = process.env[k]; if (v === null) delete process.env[k]; else process.env[k] = v; return () => { if (cu === undefined) delete process.env[k]; else process.env[k] = cu; }; };

  test('đặt lệnh thật mặc định TẮT', () => {
    const tra = dat('SHS_REAL_TRADING', null);
    try { assert.equal(shs.realTradingEnabled(), false); } finally { tra(); }
  });

  test('chỉ đúng chuỗi "1" mới bật', () => {
    for (const [v, mong] of [['1', true], ['0', false], ['true', false], ['', false]]) {
      const tra = dat('SHS_REAL_TRADING', v);
      try { assert.equal(shs.realTradingEnabled(), mong, `SHS_REAL_TRADING=${v}`); } finally { tra(); }
    }
  });

  test('mặc định hạn mức nhỏ hơn hẳn DNSE vì đây là bước đầu', () => {
    const tra = [dat('SHS_MAX_ORDER_VND', null), dat('SHS_MAX_DAILY_VND', null), dat('SHS_MAX_ORDERS_PER_DAY', null)];
    try {
      assert.equal(shs.maxOrderVnd(), 2_000_000);
      assert.equal(shs.maxDailyVnd(), 5_000_000);
      assert.equal(shs.maxOrdersPerDay(), 5);
    } finally { tra.forEach((f) => f()); }
  });

  test('giá trị rác trong biến môi trường không làm hạn mức thành 0 hay NaN', () => {
    const tra = dat('SHS_MAX_ORDER_VND', 'nhieu');
    try { assert.equal(shs.maxOrderVnd(), 2_000_000); } finally { tra(); }
  });
});

describe('mã xác nhận xem trước -> đặt', () => {
  const uid = '11111111-2222-3333-4444-555555555555';
  const lenh = { symbol: 'HQC', qty: 100, accountNo: '0001075179' };

  test('đọc lại được đúng nội dung đã ký', () => {
    const t = makeConfirm('shs', uid, lenh, 198_000);
    const v = readConfirm('shs', uid, t);
    assert.deepEqual(v.order, lenh);
    assert.equal(v.estValueVnd, 198_000);
    assert.ok(v.nonce);
  });

  test('mã của broker này KHÔNG dùng được cho broker kia', () => {
    const t = makeConfirm('dnse', uid, lenh, 198_000);
    assert.equal(readConfirm('shs', uid, t), null);
  });

  test('người khác không dùng được mã của mình', () => {
    const t = makeConfirm('shs', uid, lenh, 198_000);
    assert.equal(readConfirm('shs', '99999999-2222-3333-4444-555555555555', t), null);
  });

  test('sửa một ký tự trong phần nội dung là hỏng chữ ký', () => {
    const t = makeConfirm('shs', uid, lenh, 198_000);
    const [p, s] = t.split('.');
    const hong = p.slice(0, -1) + (p.slice(-1) === 'A' ? 'B' : 'A');
    assert.equal(readConfirm('shs', uid, `${hong}.${s}`), null);
  });

  test('mã rỗng hoặc sai định dạng trả null chứ không ném lỗi', () => {
    for (const t of ['', null, undefined, 'khong-co-dau-cham', 'a.b']) {
      assert.equal(readConfirm('shs', uid, t), null);
    }
  });

  test('hết hạn thì không dùng được', () => {
    const that = Date.now;
    const t = makeConfirm('shs', uid, lenh, 1);
    try {
      Date.now = () => that() + 91_000;       // quá 90 giây
      assert.equal(readConfirm('shs', uid, t), null);
    } finally { Date.now = that; }
  });
});

describe('mốc ngày giao dịch', () => {
  test('00:00 giờ Việt Nam là 17:00 UTC hôm trước', () => {
    // 20/10/2026 09:30 giờ VN = 02:30 UTC
    assert.equal(startOfVnDay(Date.parse('2026-10-20T02:30:00Z')), '2026-10-19T17:00:00.000Z');
  });

  test('ngay sau nửa đêm giờ VN đã sang ngày mới', () => {
    assert.equal(startOfVnDay(Date.parse('2026-10-19T17:00:01Z')), '2026-10-19T17:00:00.000Z');
    assert.equal(startOfVnDay(Date.parse('2026-10-19T16:59:59Z')), '2026-10-18T17:00:00.000Z');
  });
});
