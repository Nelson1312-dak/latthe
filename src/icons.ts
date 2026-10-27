/**
 * Icon phẳng một nét, thay cho emoji.
 *
 * Emoji tiện lúc dựng nháp nhưng sai với một giao diện tối giản: chúng nhiều màu, mỗi hệ
 * điều hành vẽ một kiểu — 🪙 trên Windows là đồng xu vàng, trên Android là thứ khác hẳn —
 * và không cái nào chịu ăn theo màu chữ, nên không thể làm nổi bật hay làm mờ đi. Trên nền
 * kem của thanh tài nguyên, mấy biểu tượng nhiều màu ấy còn tranh mất chú ý với chính con
 * số bên cạnh, mà con số mới là thứ người chơi đọc.
 *
 * Đây là nét vẽ 24×24, `fill: none`, màu lấy từ `currentColor` — nên một icon ăn theo màu
 * của chỗ nó đứng, và tô màu tài nguyên cho nó chỉ là đặt `color` lên thẻ cha.
 */

export type IconName =
  | 'food' | 'wood' | 'gold' | 'stone' | 'relics'
  | 'townhall' | 'house' | 'granary' | 'outpost'
  | 'villager' | 'cart' | 'pick' | 'box' | 'axe'
  | 'boot' | 'pack' | 'compass' | 'basket'
  | 'crew' | 'broom' | 'robot' | 'hand' | 'medal' | 'warn' | 'pin'
  | 'sound' | 'mute' | 'pause' | 'play' | 'ring' | 'ringOn';

/** Phần bên trong <svg>. Giữ mỗi icon trong vài nét, đừng thêm chi tiết. */
const PATH: Record<IconName, string> = {
  food: '<path d="M12 21V8"/><path d="M12 8c0-3 1.8-5 4-5 0 3-1.8 5-4 5z"/>'
    + '<path d="M12 8c0-3-1.8-5-4-5 0 3 1.8 5 4 5z"/>'
    + '<path d="M12 15c0-3 1.8-5 4-5 0 3-1.8 5-4 5z"/>'
    + '<path d="M12 15c0-3-1.8-5-4-5 0 3 1.8 5 4 5z"/>',
  wood: '<path d="M7 7h10a5 5 0 010 10H7a5 5 0 010-10z"/>'
    + '<path d="M17 7a5 5 0 000 10"/><path d="M7 10a2 2 0 000 4"/>',
  gold: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
  stone: '<path d="M5 14.5l2.5-7.5 7.5-2 4 5-2 7.5-8.5 2z"/><path d="M7.5 7l5 3 6.5-3"/>',
  relics: '<path d="M12 2.5l6 7-6 12-6-12z"/><path d="M6 9.5h12"/><path d="M12 2.5v19"/>',

  townhall: '<path d="M3 10l9-6 9 6"/><path d="M5 10v9"/><path d="M19 10v9"/>'
    + '<path d="M9.5 19v-5.5"/><path d="M14.5 19v-5.5"/><path d="M2.5 20h19"/>',
  house: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  granary: '<path d="M6.5 5h11"/><path d="M6.5 19h11"/>'
    + '<path d="M6.5 5c-1.8 4.7-1.8 9.3 0 14"/><path d="M17.5 5c1.8 4.7 1.8 9.3 0 14"/>'
    + '<path d="M4.5 12h15"/>',
  outpost: '<path d="M12 3.5L4 20h16z"/><path d="M12 3.5V20"/><path d="M8 20l4-6.5 4 6.5"/>',

  villager: '<circle cx="12" cy="7.5" r="3.8"/><path d="M4.5 21c0-4 3.4-6.8 7.5-6.8s7.5 2.8 7.5 6.8"/>',
  cart: '<path d="M3 7h10.5l2 7.5H5z"/><circle cx="7.5" cy="18.5" r="2"/>'
    + '<circle cx="16.5" cy="18.5" r="2"/><path d="M15.5 10H20l1.2 4.5"/>',
  pick: '<path d="M4 20.5l8.5-8.5"/><path d="M5.5 8.5c3.6-3.6 9.4-3.6 13 0"/>'
    + '<path d="M9 5c2.4 2.4 5.8 5.8 8.2 8.2"/>',
  box: '<path d="M3 8l9-4 9 4v9l-9 4-9-4z"/><path d="M3 8l9 4 9-4"/><path d="M12 12v9"/>',
  axe: '<path d="M4 20.5l8.5-8.5"/><path d="M12.5 12l3.5-8 5.5 3.3-6 6z"/>',

  boot: '<path d="M7 3.5v9.5H5.5V19h11.5a3.5 3.5 0 003.5-3.5c0-3.3-6.5-3.3-8.5-6.5V3.5z"/>',
  pack: '<path d="M8 8V6.5a4 4 0 018 0V8"/><path d="M5 8h14v12.5H5z"/><path d="M5 13.5h14"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 5.3-5.3 2.2 2.2-5.3z"/>',
  basket: '<path d="M3 9h18l-2 11.5H5z"/><path d="M8.5 9L11 3.5"/><path d="M15.5 9L13 3.5"/>',

  crew: '<circle cx="9" cy="8" r="3.3"/><path d="M2.5 20.5c0-3.6 3-6 6.5-6"/>'
    + '<circle cx="17" cy="9.5" r="2.8"/><path d="M14 15c4 0 7.5 2 7.5 5.5"/>',
  broom: '<path d="M4 20.5l7-7"/><path d="M11 13.5l4.5-4.5 4 4-4.5 4.5z"/>'
    + '<path d="M15 17.5l1.5 4h4.5l-2-4z"/>',
  robot: '<path d="M12 2.5v3.5"/><path d="M5.5 6h13v12.5h-13z"/>'
    + '<path d="M9.5 10.5v1.5"/><path d="M14.5 10.5v1.5"/><path d="M9.5 15.5h5"/>',
  hand: '<path d="M8.5 12V5.5a1.9 1.9 0 013.8 0V11"/>'
    + '<path d="M12.3 11V4.2a1.9 1.9 0 013.8 0V11"/>'
    + '<path d="M16.1 11.5V7.3a1.9 1.9 0 013.8 0v7.2a7 7 0 01-7 7h-1.6a5.7 5.7 0 01-5.7-5.7v-4.3a1.9 1.9 0 013.8 0"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 2.5l2.4 6"/><path d="M15.5 2.5l-2.4 6"/>',
  warn: '<path d="M12 3.5l9.5 17H2.5z"/><path d="M12 10v4.5"/><path d="M12 17.5v.5"/>',
  pin: '<path d="M12 21.5s7-6.2 7-11.5a7 7 0 10-14 0c0 5.3 7 11.5 7 11.5z"/>'
    + '<circle cx="12" cy="9.5" r="2.4"/>',

  sound: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M15.5 9a4.5 4.5 0 010 6"/>'
    + '<path d="M18.5 6a8.5 8.5 0 010 12"/>',
  mute: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M16 10l5 4"/><path d="M21 10l-5 4"/>',
  pause: '<path d="M8.5 4.5v15"/><path d="M15.5 4.5v15"/>',
  play: '<path d="M7.5 4.5l11.5 7.5-11.5 7.5z"/>',
  ring: '<circle cx="12" cy="12" r="8.5"/>',
  ringOn: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
};

/** Một icon, dưới dạng chuỗi SVG. Dùng khi cần nhét vào innerHTML sẵn có. */
export function iconSvg(name: IconName): string {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    + PATH[name] + '</svg>';
}

/**
 * Một icon, dưới dạng thẻ. `cls` là lớp của thẻ bọc, để dùng chung với mấy lớp sẵn có
 * (`ico`, `insp-ico`, `tico`...). Màu lấy từ `color` của chính thẻ ấy.
 */
export function ico(name: IconName, cls = 'ico', color?: number): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = cls;
  s.innerHTML = iconSvg(name);
  if (color !== undefined) s.style.color = `#${color.toString(16).padStart(6, '0')}`;
  return s;
}
