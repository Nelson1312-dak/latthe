// Trạng thái đăng nhập ở phía trình duyệt.
//
// Mật khẩu không bao giờ đi qua app này: nút của Google trả về một ID token,
// server xác minh token đó rồi đặt cookie phiên (httpOnly, JS không đọc được).

export interface Me {
  id: number;
  name: string;
  avatar: string | null;
  puzzleRating: number;
  /** Elo ván đấu với người, tách khỏi Elo bài tập. */
  gameRating: number;
  gameCount: number;
  /** Tài khoản thử lúc phát triển, không gắn với Google. */
  local: boolean;
}

export interface AuthState {
  user: Me | null;
  googleClientId: string | null;
  devAuth: boolean;
  /** Không gọi được server (chưa chạy, hoặc mất mạng). */
  offline: boolean;
}

export const auth: AuthState = { user: null, googleClientId: null, devAuth: false, offline: false };

type Listener = () => void;
const listeners = new Set<Listener>();
export function onAuthChange(fn: Listener): void {
  listeners.add(fn);
}
const announce = () => listeners.forEach((fn) => fn());

async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Lỗi ${res.status}`);
  return body;
}

/** Hỏi server xem đang là ai. Gọi một lần lúc mở app. */
export async function loadMe(): Promise<void> {
  try {
    const r = await callApi<{ user: Me | null; googleClientId: string | null; devAuth: boolean }>('/api/me');
    auth.user = r.user;
    auth.googleClientId = r.googleClientId;
    auth.devAuth = r.devAuth;
    auth.offline = false;
  } catch {
    auth.offline = true;
  }
  announce();
}

export async function logout(): Promise<void> {
  await callApi('/api/auth/logout', { method: 'POST' }).catch(() => {});
  auth.user = null;
  announce();
}

export async function devLogin(name: string): Promise<void> {
  const r = await callApi<{ user: Me }>('/api/auth/dev', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  auth.user = r.user;
  announce();
}

/* ---------------- Nút của Google ---------------- */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
          renderButton(el: HTMLElement, o: Record<string, unknown>): void;
        };
      };
    };
  }
}

let gsiLoading: Promise<void> | null = null;

/** Thư viện của Google bắt buộc phải tải từ chính Google, không tự host được. */
function loadGoogleScript(): Promise<void> {
  gsiLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Không tải được thư viện đăng nhập của Google'));
    document.head.append(s);
  });
  return gsiLoading;
}

/** Vẽ nút "Đăng nhập bằng Google" vào `el`. */
export async function renderGoogleButton(el: HTMLElement, onError: (msg: string) => void): Promise<void> {
  if (!auth.googleClientId) return;
  try {
    await loadGoogleScript();
    const gsi = window.google?.accounts.id;
    if (!gsi) throw new Error('Thiếu thư viện Google');
    gsi.initialize({
      client_id: auth.googleClientId,
      callback: async (r) => {
        try {
          const out = await callApi<{ user: Me }>('/api/auth/google', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ credential: r.credential }),
          });
          auth.user = out.user;
          announce();
        } catch (err) {
          onError((err as Error).message);
        }
      },
    });
    gsi.renderButton(el, {
      type: 'standard',
      theme: document.documentElement.dataset.theme === 'light' ? 'outline' : 'filled_black',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      locale: 'vi',
      width: 260,
    });
  } catch (err) {
    onError((err as Error).message);
  }
}
