// Nạp một lần bộ quân cburnett vào DOM để <use href="#wk"> dùng được.
// (Tham chiếu <use> sang file ngoài không chạy ổn định trên mọi trình duyệt.)

let loading: Promise<void> | null = null;

export function loadPieces(url = '/pieces/cburnett.svg'): Promise<void> {
  if (loading) return loading;
  loading = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Không tải được bộ quân: ${r.status}`);
      return r.text();
    })
    .then((svg) => {
      const host = document.createElement('div');
      host.id = 'piece-sprite';
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      host.innerHTML = svg;
      document.body.prepend(host);
    });
  return loading;
}
