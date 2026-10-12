/**
 * Khẩu vị rủi ro do khách tự trả lời.
 *   GET  /api/portal/profile?account=      câu hỏi + kết quả hiện tại
 *   POST /api/portal/profile { account, answers }   chấm điểm ở máy chủ, lưu qua hàm SQL (chỉ tiểu khoản đã liên kết)
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import { publicQuestions, scoreAnswers } from '../../../api/_risk.js';
import { RISK_LABEL } from '../../../api/_portfolio.js';

const okAcc = (a) => /^[0-9A-Za-z]{4,20}$/.test(a || '');

export default route('GET, POST, OPTIONS', async ({ req, res, uid, body }) => {
  if (req.method === 'GET') {
    const acc = new URL(req.url, 'http://x').searchParams.get('account');
    if (!okAcc(acc)) return res.status(400).json({ error: 'Thiếu tiểu khoản.' });
    const p = (await rest(`/client_profiles?account_no=eq.${acc}&select=risk_level,risk_score,answers,answered_by,answered_at&limit=1`, { sub: uid }))[0] || null;
    return { questions: publicQuestions(), profile: p && { ...p, risk_label: RISK_LABEL[p.risk_level] || null } };
  }
  if (!okAcc(body.account)) return res.status(400).json({ error: 'Thiếu tiểu khoản.' });
  const s = scoreAnswers(body.answers);
  if (!s.ok) return res.status(400).json({ error: s.error });
  try {
    const p = await rest('/rpc/submit_risk_profile', { sub: uid, method: 'POST', body: { p_account: body.account, p_answers: s.answers, p_score: s.score, p_level: s.level } });
    return { profile: { ...p, risk_label: s.label }, notes: s.notes };
  } catch (e) {
    if (/account_not_linked/.test(e.message)) return res.status(403).json({ error: 'Tiểu khoản này chưa được liên kết với tài khoản của bạn.' });
    throw e;
  }
}, { auth: true });
