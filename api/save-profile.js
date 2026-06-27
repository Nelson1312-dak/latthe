/**
 * api/save-profile.js — Vercel Serverless Function
 * Saves user birth profile info into PostgreSQL / Supabase
 */

import { applyCors } from './_cors.js';

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;

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

  // Validate types/sizes before hitting the DB (prevents storage abuse & junk rows).
  if (typeof name !== 'string' || name.trim().length > 120) {
    return res.status(400).json({ error: 'Họ tên không hợp lệ' });
  }
  if (typeof birth_date !== 'string' || birth_date.length > 40) {
    return res.status(400).json({ error: 'Ngày sinh không hợp lệ' });
  }
  const hourNum = Number(birth_hour);
  if (!Number.isInteger(hourNum) || hourNum < 0 || hourNum > 23) {
    return res.status(400).json({ error: 'Giờ sinh không hợp lệ' });
  }
  if (chart_json && JSON.stringify(chart_json).length > 100000) {
    return res.status(400).json({ error: 'Dữ liệu lá số quá lớn' });
  }

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
      // Keep DB schema/constraint details in server logs, not in the client response.
      console.error(`[save-profile] DB error ${dbRes.status}: ${errText.slice(0, 300)}`);
      return res.status(502).json({ error: 'Không lưu được hồ sơ. Vui lòng thử lại sau.' });
    }

    const data = await dbRes.json();
    const insertedRow = Array.isArray(data) ? data[0] : data;
    return res.status(200).json({ success: true, id: insertedRow?.id });
  } catch (err) {
    console.error(`[save-profile] Internal error: ${err.message}`);
    return res.status(500).json({ error: 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.' });
  }
}
