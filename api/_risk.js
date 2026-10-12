/**
 * api/_risk.js — bảng câu hỏi khẩu vị rủi ro và cách chấm điểm. Hàm thuần.
 * Underscore prefix => Vercel không expose thành route.
 *
 * Đây là công cụ hỗ trợ môi giới hiểu khách, không thay thế quy trình đánh giá khách hàng của công ty chứng khoán.
 * Điểm 0–100. Hai câu "chặn trên": thời gian đầu tư dưới 1 năm, hoặc sẽ bán hết khi giảm 20% => tối đa "Cân bằng".
 */
import { RISK_LEVELS, RISK_LABEL } from './_portfolio.js';

export const QUESTIONS = [
  { id: 'horizon', text: 'Bạn dự định đầu tư khoản tiền này trong bao lâu?',
    options: [['lt1', 'Dưới 1 năm', 0], ['1to3', '1 đến 3 năm', 5], ['3to5', '3 đến 5 năm', 10], ['gt5', 'Trên 5 năm', 15]] },
  { id: 'goal', text: 'Mục tiêu chính của bạn là gì?',
    options: [['preserve', 'Giữ an toàn vốn', 0], ['income', 'Có thu nhập đều (cổ tức)', 5], ['balanced', 'Tăng trưởng vừa phải', 10], ['growth', 'Tăng trưởng cao, chấp nhận biến động lớn', 15]] },
  { id: 'experience', text: 'Bạn đã đầu tư cổ phiếu bao lâu?',
    options: [['none', 'Chưa có kinh nghiệm', 0], ['lt2', 'Dưới 2 năm', 5], ['2to5', '2 đến 5 năm', 10], ['gt5', 'Trên 5 năm', 15]] },
  { id: 'drop', text: 'Nếu danh mục giảm 20% trong một tháng, bạn sẽ làm gì?',
    options: [['sell_all', 'Bán hết để tránh lỗ thêm', 0], ['sell_some', 'Bán bớt một phần', 5], ['hold', 'Giữ nguyên, chờ hồi phục', 10], ['buy', 'Mua thêm vì giá rẻ hơn', 15]] },
  { id: 'max_loss', text: 'Trong một năm, bạn chấp nhận lỗ tối đa bao nhiêu?',
    options: [['5', 'Khoảng 5%', 0], ['10', 'Khoảng 10%', 5], ['20', 'Khoảng 20%', 10], ['30', 'Trên 30%', 15]] },
  { id: 'share', text: 'Khoản đầu tư này chiếm bao nhiêu trong tổng tài sản tài chính của bạn?',
    options: [['gt75', 'Trên 75%', 0], ['50to75', '50% đến 75%', 5], ['25to50', '25% đến 50%', 10], ['lt25', 'Dưới 25%', 15]] },
  { id: 'margin', text: 'Bạn có dùng ký quỹ (vay để mua cổ phiếu) không?',
    options: [['never', 'Không bao giờ', 0], ['rare', 'Thỉnh thoảng, mức thấp', 5], ['often', 'Thường xuyên', 10]] },
];

const MAX = QUESTIONS.reduce((a, q) => a + Math.max(...q.options.map((o) => o[2])), 0);

/** Câu hỏi cho giao diện (không lộ điểm từng đáp án). */
export const publicQuestions = () => QUESTIONS.map((q) => ({ id: q.id, text: q.text, options: q.options.map(([id, label]) => ({ id, label })) }));

/**
 * @param {Record<string,string>} answers  { horizon: '3to5', ... }
 * @returns {{ ok: true, score: number, level: string, label: string, notes: string[], answers: object } | { ok: false, error: string }}
 */
export function scoreAnswers(answers) {
  if (!answers || typeof answers !== 'object') return { ok: false, error: 'Thiếu câu trả lời.' };
  let raw = 0;
  const clean = {};
  for (const q of QUESTIONS) {
    const opt = q.options.find((o) => o[0] === answers[q.id]);
    if (!opt) return { ok: false, error: `Chưa trả lời: "${q.text}"` };
    raw += opt[2];
    clean[q.id] = opt[0];
  }
  const score = Math.round((raw / MAX) * 100);
  let level = score < 30 ? 'conservative' : score < 55 ? 'balanced' : score < 75 ? 'growth' : 'aggressive';
  const notes = [];
  const cap = (why) => {
    if (RISK_LEVELS.indexOf(level) > RISK_LEVELS.indexOf('balanced')) { level = 'balanced'; notes.push(why); }
  };
  if (clean.horizon === 'lt1') cap('Thời gian đầu tư dưới 1 năm nên mức rủi ro tối đa là Cân bằng.');
  if (clean.drop === 'sell_all') cap('Bạn sẽ bán hết khi giảm 20%, nên mức rủi ro tối đa là Cân bằng.');
  return { ok: true, score, level, label: RISK_LABEL[level], notes, answers: clean };
}

/** Danh mục mẫu có rủi ro cao hơn khẩu vị của khách không. */
export function suitability(profileLevel, modelLevel) {
  if (!profileLevel || !modelLevel) return null;
  const d = RISK_LEVELS.indexOf(modelLevel) - RISK_LEVELS.indexOf(profileLevel);
  if (d > 0) return { ok: false, text: `Danh mục mẫu (${RISK_LABEL[modelLevel]}) rủi ro cao hơn khẩu vị của khách (${RISK_LABEL[profileLevel]}).` };
  if (d < -1) return { ok: true, text: `Danh mục mẫu (${RISK_LABEL[modelLevel]}) thận trọng hơn nhiều so với khẩu vị của khách (${RISK_LABEL[profileLevel]}).` };
  return { ok: true, text: `Danh mục mẫu phù hợp khẩu vị rủi ro của khách (${RISK_LABEL[profileLevel]}).` };
}
