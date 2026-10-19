/**
 * GET /api/market — báo giá cả rổ mã và chỉ số.
 * Nguồn ưu tiên: DNSE Market Data WebSocket (worker/market-stream.mjs ghi vào DB mỗi giây), có độ sâu sổ lệnh thật.
 * Dự phòng: nến 1 phút của Entrade (trễ khoảng 1 phút, không có độ sâu) khi worker chưa chạy hoặc dữ liệu đã cũ.
 * Chỉ phục vụ mã trong UNIVERSE nên không thể bị lợi dụng làm proxy tới nguồn giá.
 */
import { UNIVERSE, INDICES, fetchBars, liveBar, quoteFromBars, indexFromBars, sessionState, cached, vnNow } from '../../api/_market.js';
import { rest } from '../../api/_db.js';

const FRESH_MS = 20_000;
const orNull = (p) => p.catch(() => null);

/** Giá WebSocket đang lưu trong DB. Lỗi DB không được làm hỏng API: quay về nguồn dự phòng. */
async function wsSnapshot() {
  try {
    const [q, i] = await Promise.all([
      rest('/market_quotes?select=symbol,data,at', { role: 'app_worker' }),
      rest('/market_indices?select=name,data,at', { role: 'app_worker' }),
    ]);
    return { quotes: Object.fromEntries(q.map((r) => [r.symbol, { ...r.data, at: r.at }])), indices: Object.fromEntries(i.map((r) => [r.name, { ...r.data, at: r.at }])) };
  } catch { return { quotes: {}, indices: {} }; }
}

/** Dòng WebSocket còn dùng được: mới trong 20 giây, hoặc (ngoài giờ) là dữ liệu của chính hôm nay. */
function usable(row, session) {
  if (!row?.at) return false;
  const age = Date.now() - Date.parse(row.at);
  if (age < FRESH_MS) return true;
  return session === 'closed' && vnNow(Date.parse(row.at)).ymd === vnNow().ymd;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = sessionState();
  const ws = await wsSnapshot();

  const [settled, idxSettled] = await Promise.all([
    Promise.allSettled(UNIVERSE.map(async (x) => {
      const w = ws.quotes[x.s];
      const wsOk = usable(w, session) && Number.isFinite(w.last) && Number.isFinite(w.vol);
      const [daily, live] = await Promise.all([
        cached('d:' + x.s, 600_000, () => fetchBars(x.s, 8)),
        wsOk ? { o: w.open ?? w.last, h: w.high ?? w.last, l: w.low ?? w.last, c: w.last, v: w.vol, asof: w.tickAt ? Math.floor(Date.parse(w.tickAt) / 1000) : null } : orNull(cached('l:' + x.s, 12_000, () => liveBar(x.s))),
      ]);
      const q = quoteFromBars(x, daily, live);
      if (!q) return null;
      q.source = wsOk ? 'ws' : 'poll';
      // Ngành lấy từ DB (worker ghi theo data/nganh.json) chứ không giữ nhãn cũ trong UNIVERSE:
      // để mỗi bên một kiểu thì bộ lọc ngành trên bảng giá tách đôi, cùng một ngành thành hai mục.
      if (w?.sector) q.sector = w.sector;
      // Giá khớp ngoài biên độ là dữ liệu hỏng: bỏ WebSocket, dùng nguồn dự phòng
      if (wsOk && (q.last > q.ceil + 1e-9 || q.last < q.floor - 1e-9)) {
        const alt = quoteFromBars(x, daily, await orNull(cached('l:' + x.s, 12_000, () => liveBar(x.s))));
        if (alt) { alt.source = 'poll'; return alt; }
      }
      if (wsOk && usable({ at: w.depthAt }, session) && (w.bid?.length || w.offer?.length)) {
        q.depth = { bid: w.bid || [], offer: w.offer || [], totalBid: w.totalBid ?? null, totalOffer: w.totalOffer ?? null };
      }
      return q;
    })),
    Promise.allSettled(INDICES.map(async (s) => {
      const w = ws.indices[s];
      if (usable(w, session) && Number.isFinite(w.value) && Number.isFinite(w.prior) && w.prior > 0) {
        return { s, last: w.value, ref: w.prior, pct: (w.value / w.prior - 1) * 100, source: 'ws',
          breadth: { up: w.up, down: w.down, flat: w.flat, ceil: w.ceil, floor: w.floor }, volume: w.volume, valueTraded: w.value_traded };
      }
      const [daily, live] = await Promise.all([cached('i:' + s, 600_000, () => fetchBars(s, 8, '1D', 'index')), orNull(liveBar(s, 'index'))]);
      const r = indexFromBars(s, daily, live);
      return r ? { ...r, source: 'poll' } : null;
    })),
  ]);
  const indices = idxSettled.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean);
  const quotes = {};
  const failed = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) quotes[UNIVERSE[i].s] = r.value;
    else failed.push(UNIVERSE[i].s);
  });
  // Phần rổ còn lại (worker ghi ~150 mã, giao diện chỉ mô tả kỹ 32): dựng thẳng từ WebSocket trong DB.
  // Trần/sàn do worker tính sẵn mỗi phiên một lần, nên ở đây KHÔNG gọi nguồn nến lượt nào — chính vì
  // vậy mở rộng rổ không làm tăng tải lên nguồn giá.
  for (const [s, w] of Object.entries(ws.quotes)) {
    if (quotes[s] || !usable(w, session)) continue;
    if (!Number.isFinite(w.last) || !Number.isFinite(w.ref) || !Number.isFinite(w.ceil)) continue;
    const q = {
      s, ex: w.ex || null, name: w.name || null, sector: w.sector || null, vn30: !!w.vn30, watch: !!w.watch,
      ref: w.ref, ceil: w.ceil, floor: w.floor,
      last: w.last, open: w.open ?? w.last, high: w.high ?? w.last, low: w.low ?? w.last, vol: w.vol ?? 0,
      // Phiên của giá, lấy theo lúc KHỚP chứ không theo lúc ghi: dòng trần/sàn làm `at` nhảy sang
      // hôm nay trong khi giá vẫn là của phiên trước.
      lastSession: vnNow(Date.parse(w.tickAt || w.at)).ymd, asof: w.tickAt ? Math.floor(Date.parse(w.tickAt) / 1000) : null,
      source: 'ws',
    };
    if (usable({ at: w.depthAt }, session) && (w.bid?.length || w.offer?.length)) {
      q.depth = { bid: w.bid || [], offer: w.offer || [], totalBid: w.totalBid ?? null, totalOffer: w.totalOffer ?? null };
    }
    quotes[s] = q;
  }
  if (!Object.keys(quotes).length) {
    return res.status(502).json({ error: 'Không lấy được giá từ nguồn dữ liệu.' });
  }
  const nWs = Object.values(quotes).filter((q) => q.source === 'ws').length;
  const source = nWs === 0 ? 'poll' : nWs === Object.keys(quotes).length ? 'ws' : 'mixed';
  res.setHeader('Cache-Control', `public, s-maxage=${session === 'closed' ? 30 : 2}, stale-while-revalidate=10`);
  return res.status(200).json({ asof: new Date().toISOString(), session, source, quotes, indices, failed });
}
