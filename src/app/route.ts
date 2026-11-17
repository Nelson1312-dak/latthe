// Đọc địa chỉ trên thanh URL.
//
// Để riêng ra khỏi main.ts: màn hình nào cũng cần đọc, mà main.ts thì lại
// import tất cả các màn hình — để chung sẽ thành vòng tròn.

/** Tham số sau dấu ? trong hash, ví dụ '#/xem-lai?game=12'. */
export function routeQuery(): URLSearchParams {
  return new URLSearchParams(location.hash.split('?')[1] ?? '');
}

/** Tên màn hình, đã bỏ phần ?... */
export function routeName(): string {
  return location.hash.replace(/^#\/?/, '').split('?')[0];
}
