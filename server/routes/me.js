/**
 * GET /api/me — hồ sơ người dùng của phiên đăng nhập hiện tại.
 *
 * Trước 21/10/2026 route này còn trả tiền ảo, danh mục và sổ lệnh của engine giao dịch thử, và
 * chạy khớp lệnh chờ trên MỖI lần gọi. Engine đó đã bỏ cùng với chế độ tiền ảo: màn Giao dịch
 * giờ chỉ làm việc với tài khoản thật ở DNSE và SHS, số liệu lấy thẳng từ công ty chứng khoán.
 */
import { route } from '../../api/_http.js';
import { rest } from '../../api/_db.js';

export default route('GET, OPTIONS', async ({ uid }) => {
  if (!uid) return { user: null };
  const users = await rest(`/users?id=eq.${uid}&select=id,username,display_name,role&limit=1`, { sub: uid });
  if (!users[0]) return { user: null }; // user đã bị xóa: cookie còn nhưng vô hiệu
  return { user: users[0] };
});
