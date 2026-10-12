/**
 * POST /api/broker/profile { account, riskLevel?, modelId?, note? }
 * Môi giới đặt khẩu vị rủi ro (sau khi trao đổi với khách), gán danh mục mẫu, ghi chú. Chỉ cập nhật trường được gửi.
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import * as dnse from '../../../api/_dnse.js';
import { requireClient } from '../../../api/_desk.js';
import { getModel } from '../../../api/_advisory.js';
import { RISK_LEVELS } from '../../../api/_portfolio.js';
import { suitability } from '../../../api/_risk.js';

export default route('POST, OPTIONS', async ({ res, uid, body }) => {
  await dnse.assertOwner(uid);
  const client = await requireClient(body.account, { need: 'view' });
  const row = { broker_id: uid, account_no: client.accountNo, updated_at: new Date().toISOString() };

  if ('riskLevel' in body) {
    if (body.riskLevel !== null && !RISK_LEVELS.includes(body.riskLevel)) return res.status(400).json({ error: 'Mức rủi ro không hợp lệ.' });
    Object.assign(row, { risk_level: body.riskLevel, answered_by: body.riskLevel ? 'broker' : null, answered_at: body.riskLevel ? row.updated_at : null });
  }
  let model = null;
  if ('modelId' in body) {
    if (body.modelId != null) {
      model = await getModel(body.modelId, uid);
      if (!model || model.archived) return res.status(400).json({ error: 'Danh mục mẫu không tồn tại hoặc đã lưu trữ.' });
    }
    row.model_id = model ? model.id : null;
  }
  if ('note' in body) row.note = String(body.note || '').trim().slice(0, 2000) || null;

  const saved = (await rest('/client_profiles?on_conflict=broker_id,account_no', {
    sub: uid, method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: row,
  }))[0];
  if (!model && saved.model_id) model = await getModel(saved.model_id, uid);
  return { profile: saved, suitability: suitability(saved.risk_level, model?.riskLevel) };
}, { auth: true });
