/**
 * GET /api/health: hệ thống đã sẵn sàng chưa. Chỉ trả về đúng/sai, không lộ giá trị hay tên biến cụ thể của bí mật.
 * Dùng sau khi thêm biến môi trường trên Vercel để biết còn thiếu nhóm nào.
 */
import { rest } from '../../api/_db.js';

const has = (...k) => k.every((x) => !!(process.env[x] || '').trim());

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const config = {
    database: has('SUPABASE_URL', 'DB_JWT_SECRET'),
    login: has('SESSION_SECRET'),
    google: has('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
    brokerOwner: has('BROKER_OWNER_USERNAME'),
    dnse: has('DNSE_API_KEY', 'DNSE_API_SECRET'),
    realTrading: process.env.DNSE_REAL_TRADING === '1',
  };
  let db = false, dbMs = null;
  if (config.database) {
    const t0 = Date.now();
    try { await rest('/worker_status?select=name&limit=1', { role: 'app_worker' }); db = true; dbMs = Date.now() - t0; } catch { db = false; }
  }
  const missing = [];
  if (!config.database) missing.push('database');
  else if (!db) missing.push('database_unreachable');
  if (!config.login) missing.push('login');
  const ok = missing.length === 0;
  return res.status(ok ? 200 : 503).json({ ok, db: { configured: config.database, reachable: db, ms: dbMs }, config, missing });
}
