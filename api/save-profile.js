/**
 * api/save-profile.js — Vercel Serverless Function
 * Saves user birth profile info into PostgreSQL / Supabase
 */

const ALLOWED_ORIGINS = new Set([
  'https://latbai.vn',
  'https://www.latbai.vn',
  'https://gieoque.vn',
  'https://www.gieoque.vn',
  'http://localhost:5005',
  'http://localhost:3000',
]);

export default async function handler(req, res) {
  // ---- CORS whitelist ----
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (origin) {
    return res.status(403).json({ error: 'Truy cập bị từ chối: nguồn gọi không hợp lệ.' });
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sbUrl = (process.env.SUPABASE_URL || '').trim();
  const sbKey = (process.env.SUPABASE_ANON_KEY || '').trim();

  if (!sbUrl) {
    return res.status(503).json({ error: 'Database chưa được cấu hình' });
  }

  const { name, birth_date, birth_hour, gender, lunar_date, lunar_hour, chart_json } = req.body || {};

  if (!name?.trim()) return res.status(400).json({ error: 'Thiếu họ tên' });
  if (!birth_date) return res.status(400).json({ error: 'Thiếu ngày sinh' });
  if (birth_hour === undefined) return res.status(400).json({ error: 'Thiếu giờ sinh' });
  if (gender === undefined) return res.status(400).json({ error: 'Thiếu giới tính' });

  const isLocal = sbUrl.includes('localhost') || sbUrl.includes('127.0.0.1') || sbUrl.includes('postgrest') || sbUrl.includes(':3001');
  const path = isLocal ? '/tuvi_profiles' : '/rest/v1/tuvi_profiles';

  const headers = {
    'Content-Type': 'application/json',
    'Prefer': 'return=representation', // Ask database to return the inserted row (containing the generated UUID)
  };
  if (sbKey) {
    headers['apikey'] = sbKey;
    headers['Authorization'] = `Bearer ${sbKey}`;
  }

  try {
    const dbRes = await fetch(`${sbUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: name.trim(),
        birth_date,
        birth_hour,
        gender,
        lunar_date,
        lunar_hour,
        chart_json,
      }),
    });

    if (!dbRes.ok) {
      const errText = await dbRes.text();
      return res.status(dbRes.status).json({ error: `Database error: ${errText.slice(0, 200)}` });
    }

    const data = await dbRes.json();
    const insertedRow = Array.isArray(data) ? data[0] : data;
    return res.status(200).json({ success: true, id: insertedRow?.id });
  } catch (err) {
    return res.status(500).json({ error: `Internal server error: ${err.message}` });
  }
}
