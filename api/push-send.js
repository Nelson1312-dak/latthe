/**
 * api/push-send.js — Vercel Cron gọi mỗi sáng (7h ICT) để gửi "Vận Hôm Nay".
 * Bảo vệ bằng CRON_SECRET (Vercel Cron tự gửi Authorization: Bearer <CRON_SECRET>).
 * Gọi thủ công để test: /api/push-send?key=<CRON_SECRET>
 * Gửi thông báo CHUNG (quẻ hôm nay) — không cá nhân hóa, không PII.
 * Dọn các subscription hết hạn (404/410) khỏi Upstash.
 */
import webpush from 'web-push';
import { listSubscriptions, removeByField, todaysFortune, upstashEnabled } from './_push.js';

export default async function handler(req, res) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const auth = req.headers.authorization || '';
  const keyQuery = (req.query?.key || '').toString();
  const authorized = secret && (auth === `Bearer ${secret}` || keyQuery === secret);
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });

  const pub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || 'mailto:admin@latbai.vn').trim();
  if (!pub || !priv) return res.status(503).json({ error: 'Thiếu VAPID keys' });
  if (!upstashEnabled) return res.status(503).json({ error: 'Thiếu Upstash' });

  webpush.setVapidDetails(subject, pub, priv);

  const { hex, card } = todaysFortune();
  // Đích MẶC ĐỊNH là /tarot/ (không phải '/'): đó là nơi DUY NHẤT có section "Lá Bài
  // Hôm Nay" tương tác — lật lá 1 chạm rồi luận giải AI. Trước đây url='/' nên thông
  // báo nói "Lá bài: X" mà bấm vào lại về trang chủ, hở đúng chỗ cần khép vòng.
  // /kinh-dich/<slug> là bài viết tĩnh dead-end nên chỉ để làm action phụ.
  // Body phải nói "lật lá bài" — câu cũ "xem nhịp ngày của bạn" trỏ vào block
  // "Nhịp ngày của bạn" ở trang chủ, giữ nguyên sẽ tạo mismatch mới.
  // iOS/Safari BỎ QUA `actions` im lặng ⇒ mọi thứ quan trọng phải nằm ở url mặc định.
  const UTM = 'utm_source=push&utm_medium=daily&utm_campaign=van-hom-nay';
  const payload = JSON.stringify({
    title: `🔮 Vận hôm nay: ${hex.vn}`,
    body: `${trimTo(hex.m, 80)}  •  Lá bài: ${card.vn}. Chạm để lật lá bài hôm nay.`,
    url: `/tarot/?${UTM}`,
    tag: 'van-hom-nay',
    // Chrome/Android Notification.maxActions thường = 2 → gửi đúng 2 (sw.js tự cắt thêm).
    // Giữ được cả 2 lời hứa: trang chủ bán "Vận Hôm Nay" (quẻ), /tarot/ bán "lá bài".
    actions: [
      { action: 'bai', title: 'Lật lá bài', url: `/tarot/?${UTM}&utm_content=act-bai` },
      { action: 'que', title: `Xem quẻ ${hex.n}`, url: `/kinh-dich/${hex.slug}?${UTM}&utm_content=act-que` },
    ],
  });

  let subs;
  try {
    subs = await listSubscriptions();
  } catch (err) {
    console.error('[push-send] list error:', err.message);
    return res.status(502).json({ error: 'Không đọc được danh sách đăng ký' });
  }

  let sent = 0, pruned = 0, failed = 0;
  // Gửi theo lô nhỏ để không mở quá nhiều kết nối cùng lúc.
  const BATCH = 50;
  for (let i = 0; i < subs.length; i += BATCH) {
    const chunk = subs.slice(i, i + BATCH);
    await Promise.all(chunk.map(async ({ field, sub }) => {
      try {
        await webpush.sendNotification(sub, payload, { TTL: 6 * 3600 });
        sent++;
      } catch (err) {
        const code = err.statusCode;
        if (code === 404 || code === 410) {
          pruned++;
          try { await removeByField(field); } catch { /* ignore */ }
        } else {
          failed++;
        }
      }
    }));
  }

  console.log(`[push-send] ${hex.vn} — sent=${sent} pruned=${pruned} failed=${failed} total=${subs.length}`);
  return res.status(200).json({ ok: true, quẻ: hex.vn, sent, pruned, failed, total: subs.length });
}

function trimTo(s, n) {
  s = (s || '').trim();
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}
