/**
 * api/_facts.js — kho dữ liệu theo mã: chuẩn hóa thông tin cơ bản, tính định giá theo giá hiện tại,
 * và dựng sẵn các câu dữ kiện cho AI. Hàm thuần, không gọi DB hay mạng.
 * Underscore prefix => Vercel không expose thành route.
 *
 * Đơn vị: giá theo nghìn đồng (như bảng giá); EPS, giá trị sổ sách, cổ tức theo đồng; vốn hóa, doanh thu theo đồng.
 * Chỉ số tài chính do DNSE cung cấp theo 12 tháng gần nhất, đổi theo quý (xem db/import-facts.mjs).
 */
import crypto from 'node:crypto';

const r1 = (v) => (v == null || !Number.isFinite(+v) ? null : Math.round(+v * 10) / 10);
const r2 = (v) => (v == null || !Number.isFinite(+v) ? null : Math.round(+v * 100) / 100);
const vi = (v, d = 1) => (v == null || !Number.isFinite(+v) ? null : (+v).toFixed(d).replace('.', ','));
const num = (v) => (v == null || v === '' || !Number.isFinite(+v) ? null : +v);

/** Tiền lớn thành chuỗi dễ đọc: 174.769 tỷ đồng. */
export function money(v) {
  const n = num(v);
  if (n == null) return null;
  const a = Math.abs(n);
  if (a >= 1e12) return `${vi(n / 1e12, 1)} nghìn tỷ đồng`;
  if (a >= 1e9) return `${vi(n / 1e9, 0)} tỷ đồng`;
  if (a >= 1e6) return `${vi(n / 1e6, 0)} triệu đồng`;
  return `${Math.round(n).toLocaleString('vi-VN')} đồng`;
}

/** P/E, P/B, tỷ suất cổ tức theo giá hiện tại (nghìn đồng). Không lưu sẵn vì phụ thuộc giá. */
export function valuation(fund, priceK) {
  const p = num(priceK);
  const trong = { pe: null, pb: null, tySuatCoTucPct: null, coTucLech: false };
  if (!fund || !p) return trong;
  const vnd = p * 1000;
  const eps = num(fund.eps), bv = num(fund.gia_tri_so_sach), div = num(fund.co_tuc_tien_dong);
  const live = div > 0 ? (div / vnd) * 100 : null;
  // DNSE trả kèm tỷ suất cổ tức của họ. Lệch quá nửa so với tỷ suất tính theo giá hiện tại nghĩa là
  // số cổ tức hoặc giá họ dùng không khớp nguồn giá của mình => không công bố tỷ suất, chỉ nêu số tiền.
  const ref = num(fund.ty_suat_co_tuc_dnse_pct);
  const lech = live != null && ref > 0 && Math.abs(live - ref) / ref > 0.5;
  return {
    pe: eps > 0 ? r2(vnd / eps) : null,
    pb: bv > 0 ? r2(vnd / bv) : null,
    tySuatCoTucPct: lech ? null : r2(live),
    coTucLech: !!lech,
  };
}

const LEVELS = { pe: [10, 20], pb: [1.5, 3] };
const judge = (v, [lo, hi], low, mid, high) => (v == null ? null : v < lo ? low : v <= hi ? mid : high);

/** Sự kiện quyền chưa tới ngày giao dịch không hưởng quyền. */
export const upcomingEvents = (fund, now = Date.now()) =>
  (fund?.su_kien || []).filter((e) => e.ngay_gdkhq && Date.parse(e.ngay_gdkhq + 'T00:00:00+07:00') >= now - 86400e3)
    .sort((a, b) => a.ngay_gdkhq.localeCompare(b.ngay_gdkhq));

const d2 = (s) => (s ? s.split('-').reverse().join('/') : '');

/**
 * Dữ kiện một mã, gồm các câu viết sẵn để AI chép lại (model nhỏ hay đảo dấu hoặc bịa số nếu phải tự diễn đạt).
 * @param {{symbol, tech, fundamentals, priceK, fundAt}} o
 */
export function symbolFacts({ symbol, tech, fundamentals: f, priceK, fundAt }) {
  const val = valuation(f, priceK);
  const bank = f?.loai_hinh === 'Ngân hàng';
  const broker = f?.loai_hinh === 'Chứng khoán';
  const out = {
    ma: symbol,
    ten: f?.ten || null,
    san: f?.san || null,
    nganh: f?.nganh || null,
    gioi_thieu: f?.gioi_thieu || null,
    quy_mo: f ? { von_hoa: money(f.von_hoa), vn30: !!f.vn30, duoc_vay_ky_quy: !!f.margin } : null,
    dinh_gia: f ? { pe: val.pe, pb: val.pb, eps_dong: r1(f.eps), gia_tri_so_sach_dong: r1(f.gia_tri_so_sach) } : null,
    suc_khoe: f ? {
      roe_pct: r1(f.roe_pct), roa_pct: r1(f.roa_pct),
      ...(bank
        ? { nim_pct: r1(f.nim_pct), casa_pct: r1(f.casa_pct), no_xau_pct: r2(f.no_xau_pct), bao_phu_no_xau_lan: r2(f.bao_phu_no_xau_lan), tong_tai_san: money(f.tong_tai_san), tang_truong_tin_dung_ytd_pct: r1(f.tang_truong_tin_dung_ytd_pct) }
        : broker
        ? { doanh_thu_12t: money(f.doanh_thu_12t), ty_trong_tu_doanh_pct: r1(f.ty_trong_tu_doanh_pct), tang_truong_cho_vay_margin_pct: r1(f.tang_truong_cho_vay_margin_pct) }
        : { bien_loi_nhuan_gop_pct: r1(f.bien_loi_nhuan_gop_pct), no_tren_von_chu_lan: r2(f.no_tren_von_chu), doanh_thu_12t: money(f.doanh_thu_12t), thi_phan_nganh_pct: r1(f.thi_phan_nganh_pct) }),
      loi_nhuan_12t: money(f.loi_nhuan_12t),
      tang_truong_loi_nhuan_quy_pct: r1(f.tang_truong_loi_nhuan_quy_pct),
    } : null,
    so_huu: f ? { ngoai_nam_giu_pct: r1(f.so_huu_ngoai_pct), room_con_lai_pct: r1(f.room_ngoai_con_pct), free_float_pct: r1(f.free_float_pct), co_dong_lon: (f.co_dong_lon || []).slice(0, 3) } : null,
    ky_thuat: tech || null,
    cap_nhat_co_ban: fundAt ? String(fundAt).slice(0, 10) : null,
  };

  // ---- Câu viết sẵn ----
  const s = {};
  if (f) {
    // Giới thiệu do CODE cắt (tối đa 2 câu đầu), AI chỉ được chép lại: không có thì không được tự viết
    if (f.gioi_thieu) {
      const parts = String(f.gioi_thieu).split(/(?<=\.)\s+/).filter(Boolean);
      s.cau_gioi_thieu = parts.slice(0, 2).join(' ').slice(0, 400);
    }
    s.cau_doanh_nghiep = [f.ten, f.nganh ? `ngành ${f.nganh}` : null, f.san ? `niêm yết trên ${f.san}` : null,
      f.von_hoa ? `vốn hóa ${money(f.von_hoa)}` : null, f.vn30 ? 'thuộc rổ VN30' : null].filter(Boolean).join(', ') + '.';
    const dg = [];
    if (val.pe != null) dg.push(`P/E ${vi(val.pe)} lần`);
    if (val.pb != null) dg.push(`P/B ${vi(val.pb, 2)} lần`);
    if (f.roe_pct != null) dg.push(`ROE ${vi(f.roe_pct)}%`);
    if (bank && f.nim_pct != null) dg.push(`NIM ${vi(f.nim_pct)}%`);
    if (bank && f.no_xau_pct != null) dg.push(`nợ xấu ${vi(f.no_xau_pct, 2)}%`);
    if (broker && f.ty_trong_tu_doanh_pct != null) dg.push(`tự doanh chiếm ${vi(f.ty_trong_tu_doanh_pct)}% tài sản`);
    if (!bank && !broker && f.bien_loi_nhuan_gop_pct != null) dg.push(`biên lợi nhuận gộp ${vi(f.bien_loi_nhuan_gop_pct)}%`);
    if (!bank && !broker && f.no_tren_von_chu != null) dg.push(`nợ trên vốn chủ ${vi(f.no_tren_von_chu, 2)} lần`);
    if (dg.length) s.cau_co_ban = dg.join(', ') + '.';
    const g = num(f.tang_truong_loi_nhuan_quy_pct);
    if (g != null) s.cau_loi_nhuan = `Lợi nhuận 12 tháng gần nhất ${money(f.loi_nhuan_12t)}, quý gần nhất ${g >= 0 ? 'tăng' : 'giảm'} ${vi(Math.abs(g))}% so với quý trước.`;
    const div = num(f.co_tuc_tien_dong);
    s.cau_co_tuc = div > 0
      ? `Cổ tức tiền mặt ${Math.round(div).toLocaleString('vi-VN')} đồng/cổ phiếu theo dữ liệu DNSE${val.tySuatCoTucPct != null ? `, tỷ suất ${vi(val.tySuatCoTucPct)}%/năm theo giá hiện tại` : ''}.`
      : 'Chưa ghi nhận cổ tức tiền mặt trong dữ liệu.';
    if (val.coTucLech) out.canh_bao_du_lieu = 'Số cổ tức và tỷ suất cổ tức DNSE cung cấp không khớp nhau theo giá hiện tại, cần đối chiếu lại trước khi dùng.';
    const hold = [];
    const top = (f.co_dong_lon || [])[0];
    if (top) hold.push(`cổ đông lớn nhất ${top.ten} nắm ${vi(top.ty_le_pct)}%`);
    if (f.so_huu_ngoai_pct != null) hold.push(`khối ngoại nắm ${vi(f.so_huu_ngoai_pct)}%${f.room_ngoai_con_pct != null ? `, room còn ${vi(f.room_ngoai_con_pct)}%` : ''}`);
    if (f.free_float_pct != null) hold.push(`tỷ lệ cổ phiếu tự do chuyển nhượng ${vi(f.free_float_pct)}%`);
    if (hold.length) s.cau_so_huu = 'Sở hữu: ' + hold.join('; ') + '.';
    const up = upcomingEvents(f);
    if (up.length) s.cau_su_kien = 'Sự kiện quyền sắp tới: ' + up.slice(0, 2).map((e) => `${d2(e.ngay_gdkhq)} ${e.noi_dung || e.loai}`).join('; ') + '.';
    const peJ = judge(val.pe, LEVELS.pe, 'thấp hơn mặt bằng chung', 'ở mức trung bình', 'cao hơn mặt bằng chung');
    if (peJ) s.cau_nhan_dinh_dinh_gia = `P/E ${vi(val.pe)} lần, ${peJ} (chỉ để tham khảo, cần so với doanh nghiệp cùng ngành).`;
  }
  if (tech?.xu_huong) {
    s.cau_ky_thuat = [`Xu hướng ${tech.xu_huong}`, tech.rsi14 != null ? `RSI 14 phiên ${vi(tech.rsi14)}${tech.rsi_nhan_dinh && tech.rsi_nhan_dinh !== 'trung tính' ? ` (${tech.rsi_nhan_dinh})` : ''}` : null,
      tech.hieu_suat?.['1M']?.so_voi_vnindex ? `1 tháng qua ${tech.hieu_suat['1M'].so_voi_vnindex}` : null].filter(Boolean).join('; ') + '.';
  }
  out.cau_viet_san = s;
  return out;
}

/**
 * Dấu vân tay dữ liệu: đổi thì mới cần viết lại bản tóm tắt.
 *
 * Bản đầu băm thẳng ngày, giá, RSI và hiệu suất 1 tháng — cả bốn đều đổi MỖI NGÀY, nên vân tay
 * ngày nào cũng khác và cả 32 mã đều được LLM viết lại hằng ngày. Tốn vô ích: bản tóm tắt là một
 * đoạn văn kể chuyện, giá nhúc nhích 0,5% thì câu chữ y như cũ.
 *
 * Giờ băm theo MỨC chứ không theo số thô, nên chỉ viết lại khi có thay đổi đáng kể:
 *   - bỏ hẳn ngày: sang ngày mới không phải là một thay đổi về nội dung
 *   - giá: chia mức ~3% một bậc
 *   - RSI: chia mức 10 điểm, nên các ngưỡng hay nhắc tới (30 và 70) rơi đúng vào ranh giới bậc
 *   - hiệu suất 1 tháng: chia mức 5 điểm %
 *   - xu hướng và toàn bộ phần cơ bản: giữ NGUYÊN, vì chúng đổi là đổi thật
 * Bản tóm tắt vẫn không bao giờ cũ quá lâu: worker còn ngưỡng maxAgeDays bắt viết lại định kỳ.
 */
const mucLog = (v, buoc) => (Number.isFinite(v) && v > 0 ? Math.round(Math.log(v) / Math.log(1 + buoc)) : null);
const mucDeu = (v, buoc) => (Number.isFinite(v) ? Math.floor(v / buoc) : null);

export function factsHash(tech, fund) {
  const t = tech ? {
    g: mucLog(tech.gia, 0.03),
    x: tech.xu_huong,
    r: mucDeu(tech.rsi14, 10),
    m: mucDeu(tech.hieu_suat?.['1M']?.ma, 5),
  } : null;
  const f = fund ? { e: fund.eps, b: fund.gia_tri_so_sach, r: fund.roe_pct, p: fund.loi_nhuan_12t, s: (fund.su_kien || [])[0]?.ngay_gdkhq } : null;
  return crypto.createHash('sha256').update(JSON.stringify({ t, f })).digest('hex').slice(0, 16);
}

/** Dữ kiện rút gọn để nhét vào luận điểm khuyến nghị (không lặp lại phần kỹ thuật đã có ở đó). */
export function fundamentalsForAdvice(facts) {
  if (!facts?.cau_viet_san) return null;
  const c = facts.cau_viet_san;
  return {
    cau_doanh_nghiep: c.cau_doanh_nghiep || null,
    cau_co_ban: c.cau_co_ban || null,
    cau_co_tuc: c.cau_co_tuc || null,
    cau_su_kien: c.cau_su_kien || null,
    cap_nhat_co_ban: facts.cap_nhat_co_ban,
  };
}

/**
 * Dữ kiện tối thiểu cho AI viết bản tóm tắt: chỉ các câu đã viết sẵn và phần giới thiệu.
 * Không gửi cả khối chỉ báo (hàng nghìn token) vì AI chỉ cần ghép câu, và ngữ cảnh model local có hạn.
 */
export function briefFacts(facts) {
  if (!facts) return null;
  const c = facts.cau_viet_san || {};
  const keep = ['cau_doanh_nghiep', 'cau_gioi_thieu', 'cau_co_ban', 'cau_loi_nhuan', 'cau_co_tuc', 'cau_so_huu', 'cau_ky_thuat'];
  // Chỉ gửi các câu đã viết sẵn: AI không có nguyên liệu nào khác để tự diễn giải hay bịa thêm.
  return { ma: facts.ma, cau_viet_san: Object.fromEntries(keep.filter((k) => c[k]).map((k) => [k, c[k]])) };
}
