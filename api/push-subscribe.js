/**
 * api/push-subscribe.js — Đăng ký / hủy nhận thông báo "Vận Hôm Nay".
 *   GET               → { publicKey }  (VAPID public key cho client subscribe)
 *   POST { subscription }              → lưu subscription ẩn danh vào Upstash
 *   POST { unsubscribe:true, endpoint } → xóa subscription
 * Không lưu thông tin cá nhân — chỉ endpoint push do trình duyệt sinh ra.
 */
import { applyCors } from './_cors.js';
import { getClientIp, checkRateLimit } from './_rateLimit.js';
import { saveSubscription, removeSubscription, upstashEnabled } from './_push.js';

export default async function handler(req, res) {
  if (!applyCors(req, res, { methods: 'GET, POST, OPTIONS' })) return;

  const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();

  if (req.method === 'GET') {
    if (!publicKey) return res.status(503).json({ error: 'Push chưa được cấu hình' });
    return res.status(200).json({ publicKey, enabled: upstashEnabled });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!upstashEnabled) return res.status(503).json({ error: 'Push chưa được cấu hình (thiếu Upstash)' });

  // Rate-limit bucket riêng, tránh spam ghi Redis.
  const rl = await checkRateLimit(getClientIp(req), 'push-sub');
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Thao tác quá nhanh, thử lại sau.' });
  }

  const body = req.body || {};

  // Hủy đăng ký
  if (body.unsubscribe) {
    const endpoint = body.endpoint || body.subscription?.endpoint;
    if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint)) {
      return res.status(400).json({ error: 'Endpoint không hợp lệ' });
    }
    try {
      await removeSubscription(endpoint);
      return res.status(200).json({ ok: true, unsubscribed: true });
    } catch (err) {
      console.error('[push-subscribe] unsub error:', err.message);
      return res.status(502).json({ error: 'Không hủy được, thử lại sau.' });
    }
  }

  // Đăng ký
  const sub = body.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) ||
      !sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string') {
    return res.status(400).json({ error: 'Subscription không hợp lệ' });
  }
  // Chặn payload rác
  if (JSON.stringify(sub).length > 4000) {
    return res.status(400).json({ error: 'Subscription quá lớn' });
  }

  try {
    await saveSubscription({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
    return res.status(200).json({ ok: true, subscribed: true });
  } catch (err) {
    console.error('[push-subscribe] save error:', err.message);
    return res.status(502).json({ error: 'Không lưu được đăng ký, thử lại sau.' });
  }
}
