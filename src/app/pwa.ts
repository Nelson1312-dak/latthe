// Cài Lật Cờ lên máy như một app (PWA). Service worker ở public/sw.js.
//
// Chrome/Edge/Android: trình duyệt báo "cài được" bằng sự kiện beforeinstallprompt;
// giữ sự kiện đó lại để nút "Cài Lật Cờ lên máy" trong Cài đặt gọi ra hộp cài.
// iPhone/iPad (Safari) không có sự kiện này: chỉ hướng dẫn Chia sẻ → Thêm vào MH chính.

import { ping } from './ping.ts';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let hộpCài: InstallPrompt | null = null;

/** Đang chạy như app đã cài (không còn thanh địa chỉ). */
export function isInstalled(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Có hộp cài của trình duyệt để mở. */
export function canInstall(): boolean {
  return hộpCài !== null && !isInstalled();
}

/** iPhone/iPad chưa cài: chỉ hướng dẫn được bằng chữ. */
export function iosHint(): boolean {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !isInstalled();
}

export async function installApp(): Promise<boolean> {
  const h = hộpCài;
  if (!h) return false;
  hộpCài = null; // mỗi sự kiện chỉ gọi prompt() được một lần
  await h.prompt();
  return (await h.userChoice).outcome === 'accepted';
}

/** Đăng ký service worker (chỉ bản chạy thật) và theo dõi khi nào cài được. */
export function initPwa(onChange: () => void): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // không để trình duyệt tự hiện thanh cài; người chơi bấm trong Cài đặt
    hộpCài = e as InstallPrompt;
    onChange();
  });
  window.addEventListener('appinstalled', () => {
    hộpCài = null;
    ping('pwa_install');
    onChange();
  });
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Không đăng ký được service worker:', err));
  });
}
