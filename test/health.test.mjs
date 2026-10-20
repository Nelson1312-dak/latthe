/**
 * /api/health phải đỏ khi hệ thống hỏng, nếu không thì mọi thứ theo dõi từ bên ngoài đều vô dụng.
 *
 * Vì sao đáng test: ngày 13/10/2026 broker-stream nằm chết sáu ngày mà health vẫn trả 200, nên
 * không có cách nào biết ngoài việc tình cờ mở log ra xem. Lớp này là thứ duy nhất biến "worker
 * chết" thành một tín hiệu máy móc đọc được.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { soatWorker, thieuWorker, WORKER_PHAI_CO } from '../server/routes/health.js';

const GIO = Date.parse('2026-10-20T10:00:00Z');
const dong = (ten, truocBaoNhieuGiay, sha = 'abc1234') =>
  ({ name: ten, at: new Date(GIO - truocBaoNhieuGiay * 1000).toISOString(), info: { sha } });

describe('đọc trạng thái worker', () => {
  test('vừa báo xong thì không im lặng', () => {
    const [w] = soatWorker([dong('market-stream', 20)], GIO);
    assert.equal(w.im_lang, false);
    assert.equal(w.im_lang_giay, 20);
  });

  test('im quá 10 phút là hỏng', () => {
    assert.equal(soatWorker([dong('market-stream', 601)], GIO)[0].im_lang, true);
    assert.equal(soatWorker([dong('market-stream', 599)], GIO)[0].im_lang, false);
  });

  test('khởi động lại mất vài giây nên không bị báo nhầm', () => {
    assert.equal(soatWorker([dong('broker-stream', 5)], GIO)[0].im_lang, false);
  });

  test('không có mốc thời gian thì coi như im lặng, không coi như khỏe', () => {
    const [w] = soatWorker([{ name: 'advisory', at: null, info: {} }], GIO);
    assert.equal(w.im_lang, true);
    assert.equal(w.im_lang_giay, null);
  });

  test('lệch bản deploy chỉ để báo, không phải lỗi', () => {
    const truoc = process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.VERCEL_GIT_COMMIT_SHA = 'zzz9999aaaa';
    try {
      const [w] = soatWorker([dong('market-stream', 10, 'abc1234')], GIO);
      assert.equal(w.lech_ban_deploy, true);
      assert.equal(w.im_lang, false);          // lệch SHA KHÔNG làm nó thành im lặng
    } finally {
      if (truoc === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA; else process.env.VERCEL_GIT_COMMIT_SHA = truoc;
    }
  });

  test('không có worker nào thì trả danh sách rỗng chứ không ném lỗi', () => {
    assert.deepEqual(soatWorker(null, GIO), []);
    assert.deepEqual(soatWorker([], GIO), []);
  });
});

describe('worker nào thiếu thì health phải đỏ', () => {
  const khoe = () => WORKER_PHAI_CO.map((t) => ({ ten: t, im_lang: false }));

  test('đủ ba worker và đều đang báo thì không thiếu gì', () => {
    assert.deepEqual(thieuWorker(khoe()), []);
  });

  test('thiếu hẳn một worker', () => {
    const w = khoe().filter((x) => x.ten !== 'broker-stream');
    assert.deepEqual(thieuWorker(w), ['worker_broker-stream_chua_chay']);
  });

  test('có mặt nhưng im lặng cũng là thiếu', () => {
    const w = khoe().map((x) => (x.ten === 'advisory' ? { ...x, im_lang: true } : x));
    assert.deepEqual(thieuWorker(w), ['worker_advisory_im_lang']);
  });

  test('chết hết thì kể tên cả ba, không gộp thành một dòng chung chung', () => {
    assert.deepEqual(thieuWorker([]), WORKER_PHAI_CO.map((t) => `worker_${t}_chua_chay`));
  });

  test('không truyền gì vào cũng không ném lỗi', () => {
    assert.equal(thieuWorker(null).length, WORKER_PHAI_CO.length);
    assert.equal(thieuWorker(undefined).length, WORKER_PHAI_CO.length);
  });

  test('worker lạ không nằm trong danh sách thì bỏ qua, không báo thừa', () => {
    assert.deepEqual(thieuWorker([...khoe(), { ten: 'khong-biet-la-gi', im_lang: true }]), []);
  });
});
