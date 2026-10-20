/**
 * Worker realtime: phân loại bản tin DNSE, chia kênh theo hạn mức, và ghi sự kiện lệnh.
 * Không mở WebSocket, không chạm DB — mọi phụ thuộc đều tiêm vào.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classify as classifyGia, shardChannels, demCap, MarketState } from '../worker/market-stream.mjs';
import { classify as classifyLenh, channelsFor, saveOrderEvent } from '../worker/broker-stream.mjs';

describe('phân loại bản tin giá', () => {
  test('nhận đúng từng loại', () => {
    assert.equal(classifyGia({ indexName: 'VNINDEX', valueIndexes: 1689 }), 'index');
    assert.equal(classifyGia({ symbol: 'FPT', bid: [], offer: [] }), 'depth');
    assert.equal(classifyGia({ symbol: 'FPT', matchPrice: 57.1 }), 'tick');
    assert.equal(classifyGia({ symbol: 'FPT', basicPrice: 58.2, ceilingPrice: 62.2 }), 'secdef');
  });
  test('bỏ qua bản tin điều khiển và rác', () => {
    for (const m of [{ action: 'subscribed' }, { action: 'pong' }, { action: 'error' }, null, 'abc', {}, { symbol: 'FPT' }]) {
      assert.equal(classifyGia(m), null);
    }
  });
});

describe('chia kênh theo hạn mức DNSE', () => {
  // Đo thật 13/10/2026 hạng normalUser: mỗi kết nối tối đa 200 CẶP (kênh × mã), không phải 200 mã.
  const MAX = 200;
  const chiSo = ['VNINDEX', 'VN30', 'HNX', 'UPCOM'];

  test('rổ 150 mã chia ra, không kết nối nào vượt trần', () => {
    const ma = Array.from({ length: 150 }, (_, i) => `M${i}`);
    const phan = shardChannels(ma, chiSo, MAX);
    for (const ch of phan) assert.ok(demCap(ch) <= MAX, `một kết nối có ${demCap(ch)} cặp, trần ${MAX}`);
  });

  test('không bỏ sót mã nào và không lặp mã', () => {
    const ma = Array.from({ length: 150 }, (_, i) => `M${i}`);
    const thay = shardChannels(ma, chiSo, MAX).flatMap((ch) => ch.flatMap((c) => c.symbols));
    const rieng = new Set(thay);
    assert.equal(rieng.size, 150, 'thiếu mã nghĩa là mất dữ liệu phiên đó, không mua lại được');
    assert.equal(thay.length, 150 * 2, 'mỗi mã đúng 2 kênh: tick và top_price');
  });

  test('đủ cả 4 chỉ số', () => {
    const ten = shardChannels(['A'], chiSo, MAX).flatMap((ch) => ch.map((c) => c.name));
    for (const i of chiSo) assert.ok(ten.includes(`market_index.${i}.json`), `thiếu chỉ số ${i}`);
  });

  test('rổ nhỏ thì gói gọn một kết nối', () => {
    assert.equal(shardChannels(['A', 'B'], chiSo, MAX).length, 1);
  });

  test('rổ rỗng không làm vòng lặp chạy mãi', () => {
    assert.ok(shardChannels([], chiSo, MAX).length <= 4);
  });
});

describe('trạng thái giá', () => {
  const thongTin = new Map([['FPT', { ex: 'HOSE', name: 'Công ty CP FPT', sector: 'Công nghệ' }]]);

  test('gắn mô tả mã vào bản ghi mới', () => {
    const st = new MarketState({ tape: false, thongTin });
    st.apply({ symbol: 'FPT', matchPrice: 57.1, totalVolumeTraded: 1000, time: { Seconds: 1792000000 } });
    const q = st.quotes.get('FPT');
    assert.equal(q.name, 'Công ty CP FPT');
    assert.equal(q.sector, 'Công nghệ');
    assert.equal(q.last, 57.1);
  });

  test('đặt trần/sàn rồi vẫn giữ nguyên giá đang có', () => {
    const st = new MarketState({ tape: false, thongTin });
    st.apply({ symbol: 'FPT', matchPrice: 57.1, totalVolumeTraded: 1000, time: { Seconds: 1792000000 } });
    st.datTranSan('FPT', { ref: 58.2, ceil: 62.2, floor: 54.2, refDay: '2026-10-19' });
    const q = st.quotes.get('FPT');
    assert.equal(q.last, 57.1, 'ghi trần/sàn không được xoá giá — đã từng làm trống bảng giá ngoài phiên');
    assert.equal(q.ref, 58.2);
    assert.ok(st.dirty.has('FPT'));
  });

  test('bản tin đầu tiên của một mã không sinh khối lượng ảo', () => {
    const st = new MarketState({ tape: true, thongTin });
    st.apply({ symbol: 'FPT', matchPrice: 57.1, matchQtty: 100, totalVolumeTraded: 5_000_000, time: { Seconds: 1792000000 } });
    assert.equal(st.tapeRows[0].vol_delta, null, 'luỹ kế đầu phiên mà ghi thành một lệnh thì thống kê dòng tiền sai hẳn');
    st.apply({ symbol: 'FPT', matchPrice: 57.2, matchQtty: 100, totalVolumeTraded: 5_000_300, time: { Seconds: 1792000010 } });
    assert.equal(st.tapeRows[1].vol_delta, 300, 'từ bản tin thứ hai mới có khối lượng thật');
  });
});

describe('sự kiện lệnh của khách', () => {
  test('tên kênh đúng đặc tả broker', () => {
    assert.deepEqual(channelsFor('1000622169').map((c) => c.name), [
      'order.broker.STOCK.1000622169.json',
      'position.broker.STOCK.1000622169.json',
    ]);
  });

  test('phân loại lệnh và vị thế', () => {
    assert.equal(classifyLenh({ orderStatus: 'Filled', accountNo: '0001' }), 'order');
    assert.equal(classifyLenh({ openQuantity: 100, accountNo: '0001' }), 'position');
    assert.equal(classifyLenh({ action: 'subscribed' }), null);
    assert.equal(classifyLenh({ orderStatus: 'Filled' }), null, 'thiếu accountNo thì không đủ để ghi');
  });

  test('ghi sự kiện và đồng bộ trạng thái sang phiếu lệnh', async () => {
    const goi = [];
    const db = async (path, o) => { goi.push({ path, method: o.method, body: o.body }); return []; };
    await saveOrderEvent('1000622169', {
      id: 987654, accountNo: '0001000013', symbol: 'SHB', side: 'NB', orderType: 'LO',
      price: 9.82, quantity: 100, fillQuantity: 100, orderStatus: 'Filled',
      modifiedDate: '2026-10-19T07:30:00Z',
    }, db);

    assert.equal(goi.length, 2, 'một lần ghi sự kiện, một lần cập nhật phiếu');
    assert.match(goi[0].path, /^\/order_events\?on_conflict=/, 'phải chống ghi trùng sự kiện');
    assert.equal(goi[0].body.dnse_order_id, '987654');
    assert.equal(goi[0].body.status, 'Filled');
    assert.equal(goi[0].body.fill_quantity, 100);
    assert.equal(goi[1].method, 'PATCH');
    assert.match(goi[1].path, /dnse_order_id=eq\.987654/);
    assert.deepEqual(goi[1].body, { dnse_status: 'Filled' });
  });
});
