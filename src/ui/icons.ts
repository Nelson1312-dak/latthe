// Bộ icon tự vẽ: lưới 24px, nét 1,5px, đầu nét vuông, không dùng bộ icon có sẵn.
// Mọi icon kế thừa màu chữ qua currentColor.

export type IconName = keyof typeof PATHS;

const PATHS = {
  // Điều hướng
  play: '<path d="M7 4.5 19 12 7 19.5Z"/>',
  review: '<path d="M4 19V5"/><path d="M4 15l5-6 4 4 7-8"/><circle cx="9" cy="9" r="1.6"/>',
  learn: '<path d="M4 5.5h7v14H4Z"/><path d="M13 5.5h7v14h-7Z"/><path d="M11 8.5h2"/>',
  cards: '<path d="M6.5 7.5h13v12h-13Z"/><path d="M4.5 4.5h13"/><path d="M10 12h6"/><path d="M10 15.5h3.5"/>',
  friends: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 7.2a3 3 0 0 1 0 5.6"/><path d="M17.5 14.4c1.9.6 3 2.4 3 4.6"/>',
  // Hành động trong ván
  flip: '<path d="M7 7.5h10l-3-3"/><path d="M17 16.5H7l3 3"/>',
  first: '<path d="M18 5.5 10 12l8 6.5Z"/><path d="M6.5 5.5v13"/>',
  prev: '<path d="M15.5 5.5 7.5 12l8 6.5Z"/>',
  next: '<path d="M8.5 5.5 16.5 12l-8 6.5Z"/>',
  last: '<path d="M6 5.5 14 12l-8 6.5Z"/><path d="M17.5 5.5v13"/>',
  resign: '<path d="M6 20V4"/><path d="M6 5h11l-2.2 3.5L17 12H6"/>',
  draw: '<path d="M4 10h16"/><path d="M4 14h16"/>',
  // Trợ giúp và AI
  coach: '<path d="M4.5 5.5h15v10h-9l-4 3.5Z"/><path d="M8.5 9.5h7"/><path d="M8.5 12.5h4"/>',
  hint: '<path d="M12 3.5a5.5 5.5 0 0 1 3.4 9.8c-.6.5-.9 1.1-.9 1.8v.4h-5v-.4c0-.7-.3-1.3-.9-1.8A5.5 5.5 0 0 1 12 3.5Z"/><path d="M10 19h4"/>',
  book: '<path d="M4 5.5h6c1.1 0 2 .9 2 2v11c0-1.1-.9-2-2-2H4Z"/><path d="M20 5.5h-6c-1.1 0-2 .9-2 2v11c0-1.1.9-2 2-2h6Z"/>',
  engine: '<path d="M7.5 7.5h9v9h-9Z"/><path d="M10.5 10.5h3v3h-3Z"/><path d="M10 7.5V5M14 7.5V5M10 19v-2.5M14 19v-2.5M7.5 10H5M7.5 14H5M19 10h-2.5M19 14h-2.5"/>',
  // Khác
  clock: '<circle cx="12" cy="12.5" r="7.5"/><path d="M12 8v4.5l3 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"/>',
  sound: '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5Z"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5"/>',
  show: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  hide: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/><path d="M4.5 19.5 19.5 4.5"/>',
  float: '<path d="M3.5 5h17v14h-17Z"/><path d="M12 12h6v4.5h-6Z"/>',
  copy: '<path d="M8.5 8.5h11v11h-11Z"/><path d="M15.5 5.5h-11v11"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  random: '<path d="M4 7h3.5l9 10H20"/><path d="M4 17h3.5l2.5-2.8"/><path d="M14 9.8 16.5 7H20"/><path d="M17.5 4.5 20 7l-2.5 2.5"/><path d="M17.5 14.5 20 17l-2.5 2.5"/>',
  edit: '<path d="M5 19h4L19 9l-4-4L5 15Z"/><path d="M13 7l4 4"/>',
  undo: '<path d="M9 5.5 5.5 9 9 12.5"/><path d="M5.5 9H14a4.5 4.5 0 0 1 0 9h-4"/>',
  check: '<path d="M5 12.5 10 17 19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/>',
  trophy: '<path d="M8 4.5h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5.5v1.5A3 3 0 0 0 8 10.4"/><path d="M16 6h2.5v1.5A3 3 0 0 1 16 10.4"/><path d="M12 13.5V17"/><path d="M8.5 19.5h7"/>',
  // Thanh điều hướng: icon ĐẶC, hình của cờ (như chess.com, Lichess), không phải
  // nét mảnh kiểu bộ icon dựng sẵn. Màu vẫn theo currentColor.
  'nav-play': '<path fill="currentColor" stroke="none" d="M12 2.5a3.2 3.2 0 0 0-2.1 5.6C8.6 8.8 7.8 9.9 7.8 11h2c-.2 2.6-1.4 4.6-3 6v1.5h10.4V17c-1.6-1.4-2.8-3.4-3-6h2c0-1.1-.8-2.2-2.1-2.9A3.2 3.2 0 0 0 12 2.5Z"/><path fill="currentColor" stroke="none" d="M5.5 19.5h13v2h-13Z"/>',
  'nav-puzzle': '<path fill="currentColor" stroke="none" d="M4.5 6H8a2.2 2.2 0 1 1 4.4 0H18v4.5a2.2 2.2 0 1 1 0 4.4v4.6h-5.6a2.2 2.2 0 1 0-4.4 0H4.5V15a2.2 2.2 0 1 0 0-4.4Z"/>',
  'nav-learn': '<path fill="currentColor" stroke="none" d="M12 4 1.5 9 12 14l8.5-4.05V15H22V9Z"/><path fill="currentColor" stroke="none" d="M6 12.6V16c0 1.9 2.7 3.5 6 3.5s6-1.6 6-3.5v-3.4l-6 2.9Z"/>',
  'nav-coach': '<path fill="currentColor" stroke="none" d="M4 4.5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8.5L7 20.5v-4H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"/>',
  'nav-user': '<circle fill="currentColor" stroke="none" cx="12" cy="8" r="4"/><path fill="currentColor" stroke="none" d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5Z"/>',
  'nav-stats': '<path fill="currentColor" stroke="none" d="M4 20v-9h4v9ZM10 20V4h4v16ZM16 20v-6h4v6Z"/>',
  flame: '<path d="M12 3.5s4.5 3.8 4.5 8a4.5 4.5 0 0 1-9 0c0-1.6.8-2.8 1.6-3.6 0 1.4.9 2.2 1.7 2.2.9 0 1.6-.8 1.6-2 0-2-.4-3.6-.4-4.6Z"/>',
} as const;

export function icon(name: IconName, size = 20): string {
  return (
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" ` +
    `fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">` +
    PATHS[name] +
    `</svg>`
  );
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
