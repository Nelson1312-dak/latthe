/**
 * Bàn môi giới: đọc danh sách khách và phân quyền.
 *
 * Nhóm "khuôn dữ liệu care-by" là test HỒI QUY cho lỗi đắt nhất từng gặp (commit 3f1ab04): DNSE
 * trả `{careBy: [...], total: n}` nhưng code tìm khóa `accounts`/`data`, nên danh sách luôn rỗng
 * mà KHÔNG ném lỗi nào. Bàn môi giới hiện "chưa có khách" dù có khách thật, mọi route theo khách
 * trả 403, worker realtime không mở kết nối nào, ảnh chụp danh mục rỗng — bốn luồng chết cùng lúc,
 * im lặng, suốt nhiều ngày. Đúng loại lỗi mà test phải chặn.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClient, listClients, SOURCES, APPROVAL_TTL_MS } from '../api/_desk.js';

const khach = (o = {}) => ({
  accountNo: '0001000013', investorId: 1000622169, custodyCode: '064C953488', fullName: 'Nguyễn Duy Hiệp',
  underlyingNav: 3586228, totalNav: 3586228,
  permissions: [{ product: 'UNDERLYING_STOCK', role: 'BROKER' }], ...o,
});

describe('normalizeClient', () => {
  test('quyền BROKER thì vừa xem vừa giao dịch được', () => {
    const c = normalizeClient(khach());
    assert.equal(c.accountNo, '0001000013');
    assert.equal(c.investorId, '1000622169', 'investorId phải thành chuỗi, WebSocket ghép vào tên kênh');
    assert.equal(c.stockRole, 'BROKER');
    assert.equal(c.canView, true);
    assert.equal(c.canTrade, true);
  });

  test('quyền ADVISOR thì chỉ được xem, KHÔNG được đặt lệnh', () => {
    const c = normalizeClient(khach({ permissions: [{ product: 'UNDERLYING_STOCK', role: 'ADVISOR' }] }));
    assert.equal(c.canView, true);
    assert.equal(c.canTrade, false, 'ADVISOR mà đặt được lệnh là vượt quyền khách đã cấp');
  });

  test('không có permissions thì không được gì', () => {
    const c = normalizeClient(khach({ permissions: undefined }));
    assert.equal(c.canView, false);
    assert.equal(c.canTrade, false);
  });

  test('quyền phái sinh không mở quyền cổ phiếu', () => {
    const c = normalizeClient(khach({ permissions: [{ product: 'DERIVATIVES_STOCK', role: 'BROKER' }] }));
    assert.equal(c.derivativeRole, 'BROKER');
    assert.equal(c.canTrade, false);
  });
});

describe('khuôn dữ liệu care-by (hồi quy 3f1ab04)', () => {
  const doc = (tra) => listClients({ fresh: true, api: { careBy: async () => tra } });

  test('khuôn THẬT của DNSE: { careBy: [...], total }', async () => {
    const r = await doc({ careBy: [khach()], total: 1 });
    assert.equal(r.length, 1, 'đây chính là khuôn làm hỏng bốn luồng khi đọc sai khóa');
    assert.equal(r[0].canTrade, true);
  });

  test('mảng trần — khuôn mà mock cũ dùng, không có thật ở API', async () => {
    assert.equal((await doc([khach()])).length, 1);
  });

  for (const khoa of ['accounts', 'data']) {
    test(`khuôn dự phòng { ${khoa}: [...] }`, async () => {
      assert.equal((await doc({ [khoa]: [khach()] })).length, 1);
    });
  }

  test('rỗng hoặc khuôn lạ thì trả mảng rỗng, không ném lỗi', async () => {
    for (const tra of [null, undefined, {}, { caiGiDo: [khach()] }]) {
      assert.deepEqual(await doc(tra), []);
    }
  });

  test('bỏ qua dòng không có số tiểu khoản', async () => {
    const r = await doc({ careBy: [khach(), khach({ accountNo: '' }), khach({ accountNo: undefined })] });
    assert.equal(r.length, 1);
  });

  test('nguồn tiêm vào không đụng bộ nhớ đệm của nguồn thật', async () => {
    await doc({ careBy: [khach(), khach({ accountNo: '0002' })] });
    const r = await doc({ careBy: [khach()] });
    assert.equal(r.length, 1, 'lần gọi sau phải thấy dữ liệu mới, không phải bản đệm của lần trước');
  });
});

describe('hằng số nghiệp vụ', () => {
  test('nguồn chỉ thị đúng bốn loại theo tài liệu tuân thủ', () => {
    assert.deepEqual(SOURCES, ['app', 'phone', 'chat', 'in_person']);
  });
  test('phiếu đã duyệt sống 15 phút', () => {
    assert.equal(APPROVAL_TTL_MS, 15 * 60 * 1000);
  });
});
