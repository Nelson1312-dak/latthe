/**
 * scripts/gen-vapid.mjs — Sinh cặp khóa VAPID cho Web Push (CHẠY MỘT LẦN).
 *   npm install && node scripts/gen-vapid.mjs
 * Rồi dán 3 biến vào Vercel → Settings → Environment Variables:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
 * Public key có thể public; PRIVATE KEY phải giữ bí mật.
 */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log('# Dán vào Vercel Environment Variables:\n');
console.log('VAPID_PUBLIC_KEY=' + publicKey);
console.log('VAPID_PRIVATE_KEY=' + privateKey);
console.log('VAPID_SUBJECT=mailto:admin@latbai.vn');
console.log('\n# Nhớ thêm CRON_SECRET (chuỗi ngẫu nhiên bất kỳ) để bảo vệ /api/push-send.');
