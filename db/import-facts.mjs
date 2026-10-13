/**
 * db/import-facts.mjs — nạp thông tin cơ bản từng mã (data/symbol-facts.json) vào trade.symbol_facts.
 *
 *   node --env-file=.env.local db/import-facts.mjs            nạp
 *   node --env-file=.env.local db/import-facts.mjs --check    chỉ kiểm tra file, không ghi DB
 *
 * Nguồn dữ liệu: bộ công cụ DNSE của Claude (company_get_profile, financial_get_index, company_get_company_events).
 * Worker trên máy KHÔNG gọi được bộ công cụ đó (nó chạy trên máy chủ Claude, gắn với tài khoản của bạn), nên
 * thông tin cơ bản được xuất ra file này rồi nạp vào DB. Chỉ số tài chính đổi theo quý nên nạp lại mỗi quý là đủ;
 * giá và chỉ báo kỹ thuật thì worker tự cập nhật mỗi phiên.
 */
import fs from 'node:fs';
import path from 'node:path';
import { rest } from '../api/_db.js';
import { UNIVERSE } from '../api/_market.js';

const FILE = path.join(process.cwd(), 'data', 'symbol-facts.json');
const NUMS = ['von_hoa', 'ty_suat_co_tuc_dnse_pct', 'ty_trong_tu_doanh_pct', 'tang_truong_cho_vay_margin_pct', 'eps', 'gia_tri_so_sach', 'roe_pct', 'roa_pct', 'bien_loi_nhuan_gop_pct', 'no_tren_von_chu',
  'doanh_thu_12t', 'loi_nhuan_12t', 'tang_truong_loi_nhuan_quy_pct', 'co_tuc_tien_dong', 'beta', 'free_float_pct',
  'so_huu_ngoai_pct', 'room_ngoai_con_pct', 'thi_phan_nganh_pct', 'nim_pct', 'casa_pct', 'no_xau_pct',
  'bao_phu_no_xau_lan', 'tong_tai_san', 'tang_truong_tin_dung_ytd_pct'];

const PCTS = ['roe_pct', 'roa_pct', 'bien_loi_nhuan_gop_pct', 'nim_pct', 'casa_pct', 'no_xau_pct', 'free_float_pct', 'so_huu_ngoai_pct'];

/**
 * Nghi ngờ chép nhầm tỷ lệ (0,18) thành phần trăm (18%). Chỉ cảnh báo, không chặn: ROA ngân hàng hay nợ xấu
 * dưới 1% là bình thường, nên không thể kết luận chắc chắn.
 * @returns {string[]}
 */
export function suspect(f) {
  return PCTS.filter((k) => f?.[k] != null && Number.isFinite(+f[k]) && f[k] !== 0 && Math.abs(f[k]) < 1)
    .map((k) => `${k} = ${f[k]} (nếu DNSE trả tỷ lệ thì phải nhân 100)`);
}

/** @returns {string[]} danh sách lỗi; rỗng là hợp lệ */
export function validate(symbol, f) {
  const e = [];
  if (!/^[A-Z0-9]{3,10}$/.test(symbol)) e.push('mã không hợp lệ');
  if (!f || typeof f !== 'object') return [...e, 'thiếu dữ liệu'];
  if (!f.ten) e.push('thiếu tên doanh nghiệp');
  if (f.gioi_thieu && f.gioi_thieu.length > 1200) e.push('giới thiệu quá dài (>1200 ký tự)');
  for (const k of NUMS) if (f[k] != null && !Number.isFinite(+f[k])) e.push(`${k} không phải số`);
  if (f.eps != null && Math.abs(f.eps) > 1e6) e.push('eps bất thường (đơn vị phải là đồng)');
  for (const k of PCTS) {
    const v = f[k];
    if (v != null && Number.isFinite(+v) && Math.abs(v) > 200) e.push(`${k} bất thường (đơn vị phải là %)`);
  }
  for (const k of ['co_dong_lon', 'lanh_dao', 'su_kien']) {
    if (f[k] != null && !Array.isArray(f[k])) e.push(`${k} phải là danh sách`);
  }
  for (const s of f.su_kien || []) {
    if (s.ngay_gdkhq && !/^\d{4}-\d{2}-\d{2}$/.test(s.ngay_gdkhq)) e.push(`sự kiện có ngày sai định dạng: ${s.ngay_gdkhq}`);
  }
  return e;
}

async function main() {
  if (!fs.existsSync(FILE)) { console.error(`Không thấy ${FILE}`); process.exit(2); }
  const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const entries = Object.entries(doc.symbols || {});
  if (!entries.length) { console.error('File không có mã nào.'); process.exit(2); }

  let bad = 0, warned = 0;
  for (const [s, f] of entries) {
    const errs = validate(s, f);
    if (errs.length) { bad++; console.error(`${s}: ${errs.join('; ')}`); }
    const w = suspect(f);
    if (w.length) { warned++; console.log(`  ${s}: kiểm tra lại ${w.join('; ')}`); }
  }
  if (bad) { console.error(`\n${bad} mã có lỗi, không nạp.`); process.exit(1); }

  const known = new Set(UNIVERSE.map((x) => x.s));
  const missing = [...known].filter((s) => !doc.symbols[s]);
  const extra = entries.map(([s]) => s).filter((s) => !known.has(s));
  if (warned) console.log(`${warned} mã có số nhỏ hơn 1% (đã liệt kê ở trên) — bình thường với ROA ngân hàng và nợ xấu.`);
  console.log(`${entries.length} mã hợp lệ, nguồn: ${doc.source || '?'} (${doc.generated_at || '?'})`);
  if (missing.length) console.log(`Thiếu so với danh mục đang theo dõi: ${missing.join(', ')}`);
  if (extra.length) console.log(`Ngoài danh mục đang theo dõi: ${extra.join(', ')}`);
  if (process.argv.includes('--check')) { console.log('Chỉ kiểm tra, không ghi DB.'); return; }

  const at = new Date((doc.generated_at || new Date().toISOString().slice(0, 10)) + 'T00:00:00+07:00').toISOString();
  const body = entries.map(([symbol, f]) => ({ symbol, fundamentals: f, fund_at: at, fund_source: doc.source || 'DNSE', updated_at: new Date().toISOString() }));
  for (let i = 0; i < body.length; i += 20) {
    await rest('/symbol_facts?on_conflict=symbol', { role: 'app_worker', method: 'POST', prefer: 'resolution=merge-duplicates', body: body.slice(i, i + 20) });
  }
  console.log(`Đã nạp ${body.length} mã vào trade.symbol_facts.`);
}

if (process.argv[1]?.endsWith('import-facts.mjs')) main().catch((e) => { console.error(e.message); process.exit(1); });
