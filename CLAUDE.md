# Ghi chú cho Claude Code

Thư mục này chứa app cờ **Lật Cờ** (latbai.vn: `src/`, `server/`, `shared/`, `public/`, `scripts/`,
`docs/`). Dự án giao dịch "Lật Bài" dùng chung thư mục (`.env`, `.env.local`, `db/`, `worker/`):
không xoá, không commit, không sửa các phần đó.

## Đổi giao diện app cờ (src/ui, src/board, CSS, màn mới)

Giao diện không được trông như AI làm. Quy trình ở `docs/DESIGN-REVIEW.md`; danh sách cấm ở
`docs/DESIGN.md` mục 2. Trước khi báo xong một thay đổi giao diện:

1. `npm run check:design` (cần server thử chạy) — phải sạch.
2. `npm run build` rồi `node scripts/visual-diff.mjs` — xem màn nào đổi; đổi đúng ý thì
   `--update` và commit ảnh chuẩn mới trong `design/baseline/`.
3. Gọi agent **design-reviewer** (`.claude/agents/design-reviewer.md`) và sửa các lỗi nặng nó
   báo, rồi mới báo xong. Agent chỉ báo, không tự sửa.

`npm run deploy` tự chạy cổng thiết kế và không deploy nếu `check-design` còn lỗi.
