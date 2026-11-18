// Nạp bộ quân đang chọn vào DOM (một <svg> chứa 12 <symbol id="wk"...>) để
// <use href="#wk"> dùng được. Tham chiếu <use> sang file ngoài không chạy ổn định
// trên mọi trình duyệt, nên chèn thẳng vào trang. Đổi bộ quân là thay nội dung
// khung này: mọi <use> đang có tự vẽ lại theo bộ mới, không phải vẽ lại màn.
// Sprite dựng bằng scripts/build-pieces.mjs (public/pieces/sets/<bộ>.svg).

const cache = new Map<string, Promise<string>>();
let shown: string | null = null;
let latest: string | null = null;

function fetchSet(set: string): Promise<string> {
  let p = cache.get(set);
  if (!p) {
    p = fetch(`/pieces/sets/${set}.svg`).then((r) => {
      if (!r.ok) throw new Error(`Không tải được bộ quân ${set}: ${r.status}`);
      return r.text();
    });
    p.catch(() => cache.delete(set));
    cache.set(set, p);
  }
  return p;
}

const DEFAULT_SET = 'merida';

export async function loadPieces(set = DEFAULT_SET): Promise<void> {
  latest = set;
  if (shown === set) return;
  let svg: string;
  try {
    svg = await fetchSet(set);
  } catch (err) {
    // Chưa có quân nào trên bàn (vd. mở app lúc mất mạng với bộ chưa từng tải): dùng
    // bộ mặc định, còn hơn bàn cờ trống
    if (shown === null && set !== DEFAULT_SET) return loadPieces(DEFAULT_SET);
    throw err;
  }
  // Bấm đổi nhanh nhiều bộ: chỉ bộ chọn sau cùng được hiện
  if (latest !== set) return;
  let host = document.getElementById('piece-sprite');
  if (!host) {
    host = document.createElement('div');
    host.id = 'piece-sprite';
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.prepend(host);
  }
  host.innerHTML = svg;
  host.dataset.set = set;
  shown = set;
}
