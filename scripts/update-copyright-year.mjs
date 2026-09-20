/* ============================================================
   update-copyright-year.mjs — cập nhật năm bản quyền trong footer

   VÌ SAO CẦN: năm được HARDCODE trong 1114 file HTML và trong template
   của 12 generator. Tới 01/01 hằng năm toàn site hiển thị sai năm cùng
   lúc, và regen cũng không cứu được vì generator cũng bake năm cứng.

   AN TOÀN: chỉ đổi con số đứng NGAY giữa ký hiệu bản quyền và tên miền
   (`© 2026 latbai.vn`). Không đụng mọi năm khác trong nội dung — trang
   này đầy "Tháng 9/2026", "Thần Số Học 2026", "tuoi-*-2027", ngày âm
   lịch... nên thay "2026" bừa sẽ phá nội dung thật.

   Idempotent: chạy lại trong cùng một năm cho ra byte y hệt.
   Chạy: npm run fix:year
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const YEAR = new Date().getFullYear();

// Nhóm 1 = ký hiệu (© hoặc &copy;), nhóm 2 = khoảng trắng, nhóm 3 = năm,
// nhóm 4 = tên miền. Chỉ nhóm 3 bị thay.
const RE = /(&copy;|©)(\s*)(\d{4})(\s+(?:latbai|gieoque)\.vn)/g;

const SKIP_DIRS = new Set(['node_modules', '.git', 'drinking', 'assets-src']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile() && /\.(html|mjs|js)$/.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

let changed = 0, scanned = 0, hits = 0;
for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!RE.test(src)) { RE.lastIndex = 0; continue; }
  RE.lastIndex = 0;
  scanned++;
  const out = src.replace(RE, (m, sym, sp, yr, domain) => {
    hits++;
    return `${sym}${sp}${YEAR}${domain}`;
  });
  if (out !== src) {
    fs.writeFileSync(file, out, 'utf8');
    changed++;
  }
}

console.log(`Nam ban quyen: ${YEAR}`);
console.log(`${scanned} file co chuoi ban quyen (${hits} cho), ${changed} file duoc ghi lai.`);
if (changed === 0) console.log('Tat ca da dung nam — khong co gi de doi.');
