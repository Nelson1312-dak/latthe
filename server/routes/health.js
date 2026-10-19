/**
 * GET /api/health: hệ thống đã sẵn sàng chưa. Chỉ trả về đúng/sai, không lộ giá trị hay tên biến cụ thể của bí mật.
 * Dùng sau khi thêm biến môi trường trên Vercel để biết còn thiếu nhóm nào.
 */
import { rest } from '../../api/_db.js';
import { dnseLoginEnabled } from '../../api/_dnselogin.js';

const has = (...k) => k.every((x) => !!(process.env[x] || '').trim());

const IM_LANG_MS = 10 * 60e3;   // worker nào cũng tự báo trong vòng vài phút

/**
 * Worker có đang chạy, và có đang chạy ĐÚNG code không.
 *
 * Ngày 13/10/2026 một bản vá landed lúc 23:31, nhưng cả ba worker đã khởi động từ sớm hôm đó và
 * không thoát lần nào, nên chạy code cũ suốt SÁU NGÀY: broker-stream giữ 0 kết nối, advisory-worker
 * chụp được 0 khách, mà không chỗ nào nói vì sao. `supervise.ps1` giờ truyền commit đang chạy vào
 * biến WORKER_SHA, worker ghi lại vào trade.worker_status, và đây là chỗ đối chiếu với bản đã deploy.
 *
 * Lệch SHA không phải lúc nào cũng là lỗi — commit ở máy chưa push thì cũng lệch — nên chỉ báo
 * `lech_ban_deploy` để người đọc tự xét, không tính vào `ok`.
 */
function soatWorker(rows) {
  const banDeploy = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null;
  const gio = Date.now();
  return (rows || []).map((r) => {
    const sha = r.info?.sha || null;
    const imLangGiay = r.at ? Math.round((gio - Date.parse(r.at)) / 1000) : null;
    return {
      ten: r.name,
      sha,
      im_lang_giay: imLangGiay,
      im_lang: imLangGiay == null || imLangGiay * 1000 > IM_LANG_MS,
      lech_ban_deploy: !!(sha && banDeploy && sha !== banDeploy),
    };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const config = {
    database: has('SUPABASE_URL', 'DB_JWT_SECRET'),
    login: has('SESSION_SECRET'),
    google: has('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
    dnseLogin: dnseLoginEnabled(),
    brokerOwner: has('BROKER_OWNER_USERNAME'),
    dnse: has('DNSE_API_KEY', 'DNSE_API_SECRET'),
    realTrading: process.env.DNSE_REAL_TRADING === '1',
  };
  let db = false, dbMs = null, workers = null;
  if (config.database) {
    const t0 = Date.now();
    try {
      const rows = await rest('/worker_status?select=name,at,info', { role: 'app_worker' });
      db = true; dbMs = Date.now() - t0;
      workers = soatWorker(rows);
    } catch { db = false; }
  }
  const missing = [];
  if (!config.database) missing.push('database');
  else if (!db) missing.push('database_unreachable');
  if (!config.login) missing.push('login');
  const ok = missing.length === 0;
  return res.status(ok ? 200 : 503).json({
    ok,
    db: { configured: config.database, reachable: db, ms: dbMs },
    config,
    banDeploy: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
    workers,
    missing,
  });
}
