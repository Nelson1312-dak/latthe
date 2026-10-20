/**
 * api/_lot.js — lô chẵn, lô lẻ và cách tách một khối lượng bất kỳ thành lệnh gửi được.
 * Underscore prefix => Vercel không expose thành route.
 *
 * Quy tắc trên ba sàn Việt Nam (HOSE, HNX, UPCOM) từ 2021:
 *   - Lô chẵn: bội số của 100.
 *   - Lô lẻ: 1–99, và CHỈ đặt được bằng lệnh LO. Lô lẻ khớp trong sổ riêng, không khớp với
 *     lô chẵn, nên thường lâu hơn và giá có thể kém hơn.
 *   - Giữa hai mức đó không có gì: 150 cổ phiếu không phải một lệnh hợp lệ.
 *
 * Vì sao cần TÁCH: nhận cổ tức bằng cổ phiếu hay mua gộp nhiều lần là sinh ra số lẻ, nên "bán hết
 * 213 cổ" là việc rất đời thường — mà gửi thẳng 213 thì sàn từ chối. Tách thành 200 + 13 là đúng
 * cách làm tay lâu nay, chỉ là trước đây người dùng phải tự nhớ và tự đặt hai lần.
 *
 * File này cố ý chỉ có hàm thuần: cùng một quy tắc dùng chung cho đường DNSE, đường SHS và cả
 * phía trình duyệt, để không có chỗ nào tự nghĩ ra một luật riêng.
 */

export const LO_CHAN = 100;

/** Khối lượng này gửi thẳng được không, với loại lệnh đang chọn? */
export function hopLe(qty, type = 'LO') {
  if (!Number.isInteger(qty) || qty <= 0) return false;
  if (qty % LO_CHAN === 0) return true;
  return qty < LO_CHAN && type === 'LO';     // lô lẻ chỉ đi bằng LO
}

/**
 * Tách một khối lượng bất kỳ thành danh sách lệnh gửi được, theo thứ tự gửi.
 * 213 -> [{qty:200, le:false}, {qty:13, le:true}]
 * 200 -> [{qty:200, le:false}]
 *  13 -> [{qty:13,  le:true}]
 * Lô chẵn đi TRƯỚC vì đó là phần khớp nhanh và là phần lớn tiền; nếu lệnh thứ hai hỏng thì phần
 * quan trọng đã vào sàn rồi.
 */
export function tach(qty) {
  if (!Number.isInteger(qty) || qty <= 0) return [];
  const chan = Math.floor(qty / LO_CHAN) * LO_CHAN;
  const le = qty - chan;
  const ra = [];
  if (chan) ra.push({ qty: chan, le: false });
  if (le) ra.push({ qty: le, le: true });
  return ra;
}

/** Có phải tách làm nhiều lệnh không. */
export const phaiTach = (qty) => tach(qty).length > 1;

/** Câu mô tả cho người dùng, dùng chung giữa máy chủ và trình duyệt. */
export function moTaTach(qty) {
  const p = tach(qty);
  if (p.length < 2) return null;
  return `Tách thành ${p.length} lệnh: ${p.map((x) => `${x.qty.toLocaleString('vi-VN')} ${x.le ? '(lô lẻ)' : '(lô chẵn)'}`).join(' + ')}`;
}
