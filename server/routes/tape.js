/**
 * GET /api/tape?symbol=HPG — các lệnh vừa khớp của một mã (sổ khớp lệnh theo thời gian).
 *
 * Vì sao có route này: worker market-stream đã ghi từng lệnh khớp vào trade.tape từ lâu — giờ
 * khớp, giá, khối lượng, và chiều mua/bán suy từ bid1/ask1 tại thời điểm đó. Nhưng trình duyệt
 * không đọc được bảng này nên nó TỰ DỰNG một bảng khớp lệnh giả: mỗi lần poll (2,5 giây) lấy
 * chênh lệch tổng khối lượng làm "một lệnh", và đoán chiều bằng cách so giá với lần poll trước.
 * Kết quả là một dòng gộp mỗi 2,5 giây với chiều đoán mò, trong khi dữ liệu thật tick-by-tick
 * nằm ngay trong DB.
 *
 * Chỉ phục vụ mã trong rổ nên không thể bị lợi dụng làm proxy đọc toàn bộ bảng.
 */
import { rest } from '../../api/_db.js';

const MAX = 50;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const symbol = String(new URL(req.url, 'http://x').searchParams.get('symbol') || '').toUpperCase();
  if (!/^[A-Z0-9]{3,10}$/.test(symbol)) return res.status(400).json({ error: 'Mã không hợp lệ.' });

  try {
    const rows = await rest(
      `/tape?symbol=eq.${symbol}&select=at,price,match_qty,side&order=at.desc&limit=${MAX}`,
      { role: 'app_worker' });
    // Giá trong DB tính bằng đồng; bảng giá của site dùng nghìn đồng.
    const trades = (rows || []).map((r) => ({
      t: new Date(r.at).toLocaleTimeString('vi-VN', { hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }),
      p: Number(r.price) / 1000,
      q: Number(r.match_qty) || 0,
      side: r.side === 'B' ? 'B' : 'S',
    })).filter((x) => Number.isFinite(x.p) && x.q > 0);
    // Cache rất ngắn: đây là dữ liệu chạy trong phiên, nhưng cũng đừng để mỗi tab gọi thẳng DB.
    res.setHeader('Cache-Control', 'public, s-maxage=2, stale-while-revalidate=8');
    return res.status(200).json({ symbol, trades });
  } catch (e) {
    // Sổ khớp lệnh hỏng thì KHÔNG được làm hỏng cả màn hình: trả rỗng, phía trình duyệt tự lui
    // về bảng tự dựng như trước.
    return res.status(200).json({ symbol, trades: [], error: 'unavailable' });
  }
}
