/**
 * js/push.js — Web Push client cho "Vận Hôm Nay".
 * window.LatbaiPush: isSupported(), getState(), enable(), disable().
 * SW đã được shell.js đăng ký; ở đây chỉ subscribe/unsubscribe PushManager.
 */
(function () {
  'use strict';

  const LS_KEY = 'latbai_push'; // 'on' — ghi nhớ ý định của user để render UI

  function isSupported() {
    return 'serviceWorker' in navigator &&
           'PushManager' in window &&
           'Notification' in window;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  // serviceWorker.ready có thể chưa resolve ở lần tải đầu (SW đang activate) —
  // race với timeout để UI không bị treo; trả null nếu chưa sẵn sàng.
  function swReady(timeoutMs = 3000) {
    if (!isSupported()) return Promise.resolve(null);
    return Promise.race([
      navigator.serviceWorker.ready.catch(() => null),
      new Promise((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
  }

  async function currentSubscription() {
    const reg = await swReady();
    if (!reg) return null;
    return reg.pushManager.getSubscription();
  }

  // Trạng thái để hiển thị nút: 'unsupported' | 'blocked' | 'on' | 'off'
  async function getState() {
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'blocked';
    const sub = await currentSubscription();
    return sub ? 'on' : 'off';
  }

  async function enable() {
    if (!isSupported()) return { ok: false, reason: 'unsupported' };

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: perm === 'denied' ? 'blocked' : 'dismissed' };

    // Lấy VAPID public key
    let publicKey;
    try {
      const cfg = await fetch('/api/push-subscribe').then(r => r.json());
      if (!cfg.publicKey) return { ok: false, reason: 'notconfigured' };
      publicKey = cfg.publicKey;
    } catch {
      return { ok: false, reason: 'network' };
    }

    const reg = await swReady(8000);
    if (!reg) return { ok: false, reason: 'subscribe-failed' };
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      } catch {
        return { ok: false, reason: 'subscribe-failed' };
      }
    }

    try {
      const r = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!r.ok) return { ok: false, reason: 'save-failed' };
    } catch {
      return { ok: false, reason: 'network' };
    }

    try { localStorage.setItem(LS_KEY, 'on'); } catch {}
    return { ok: true };
  }

  async function disable() {
    try { localStorage.removeItem(LS_KEY); } catch {}
    const sub = await currentSubscription();
    if (!sub) return { ok: true };
    const endpoint = sub.endpoint;
    try { await sub.unsubscribe(); } catch {}
    try {
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unsubscribe: true, endpoint }),
      });
    } catch {}
    return { ok: true };
  }

  window.LatbaiPush = { isSupported, getState, enable, disable };
})();
