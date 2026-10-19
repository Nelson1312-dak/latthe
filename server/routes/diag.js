/**
 * GET /api/diag?key=<DIAG_KEY> — TẠM THỜI, XOÁ SAU KHI DÙNG XONG.
 *
 * Trả lời đúng một câu hỏi: từ Vercel có gọi được các host bên ngoài không.
 * Ngày 19/10/2026 phát hiện Entrade (services.entrade.com.vn) treo tới hết giờ chờ khi gọi từ
 * Vercel sin1, trong khi máy ở nhà gọi bình thường. Chưa ai biết openapi.dnse.com.vn — host của
 * toàn bộ bàn môi giới — có bị như vậy không. Nếu có thì mọi thứ phải chuyển về chạy ở máy nhà.
 *
 * Chỉ cần biết host có TRẢ LỜI hay không, nên không ký request: 401 cũng là đạt, chỉ treo hoặc
 * lỗi mạng mới là hỏng. Vì vậy route này không đụng tới API key và không lộ gì của tài khoản.
 *
 * Khoá riêng DIAG_KEY để không thành công cụ dò mạng cho người ngoài.
 */
const MUC_TIEU = [
  { ten: 'openapi.dnse.com.vn (ban moi gioi)', url: 'https://openapi.dnse.com.vn/accounts', datKhi: 'tra ve bat ky ma HTTP nao' },
  { ten: 'services.entrade.com.vn (dang nhap DNSE + nen gia)', url: 'https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=1792000000&to=1792300000&symbol=FPT&resolution=1D', datKhi: 'tra ve 200' },
  { ten: 'tunnel /feed (duong vong qua may nha)', url: (process.env.PRICE_FEED_URL || '') + '/stock?from=1792000000&to=1792300000&symbol=FPT&resolution=1D', datKhi: 'tra ve 200', khoaFeed: true },
];

async function thu(m) {
  if (!m.url || m.url.startsWith('/')) return { ten: m.ten, bo_qua: 'chua cau hinh' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  const t0 = Date.now();
  try {
    const headers = { Accept: 'application/json' };
    if (m.khoaFeed && process.env.PRICE_FEED_KEY) headers['x-feed-key'] = process.env.PRICE_FEED_KEY;
    const r = await fetch(m.url, { signal: ctl.signal, headers });
    return { ten: m.ten, goi_duoc: true, http: r.status, ms: Date.now() - t0, dat_khi: m.datKhi };
  } catch (e) {
    return { ten: m.ten, goi_duoc: false, loi: e?.name === 'AbortError' ? 'treo qua 8s' : (e?.cause?.code || e?.name || 'loi mang'), ms: Date.now() - t0 };
  } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const key = (process.env.DIAG_KEY || '').trim();
  const given = new URL(req.url, 'http://x').searchParams.get('key') || '';
  if (!key || given !== key) return res.status(404).json({ error: 'Không tìm thấy.' });
  return res.status(200).json({ vung: process.env.VERCEL_REGION || null, ket_qua: await Promise.all(MUC_TIEU.map(thu)) });
}
