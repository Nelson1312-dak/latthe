/**
 * api/_push.js — Helper dùng chung cho Web Push (subscribe + send).
 * Underscore => Vercel không expose thành route.
 * Lưu subscription ẩn danh trong Upstash Redis hash `push:subs`
 * (field = hash của endpoint, value = JSON subscription). Không có PII.
 */
import daily from './_daily.js';

function cleanEnv(v) {
  return (v || '').trim().replace(/^[<'"]+|[>'"]+$/g, '').trim().replace(/\/+$/, '');
}
const UPSTASH_URL = cleanEnv(process.env.UPSTASH_REDIS_REST_URL);
const UPSTASH_TOKEN = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
export const upstashEnabled = !!(UPSTASH_URL && UPSTASH_TOKEN);

const SUBS_KEY = 'push:subs';

// Gọi một lệnh Redis qua Upstash REST (body = mảng lệnh). Trả .result hoặc ném lỗi.
async function upstash(cmd) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Upstash: ${data.error}`);
  return data.result;
}

// FNV-1a — cùng thuật toán với js/profile.js, để field key ổn định theo endpoint.
export function hashKey(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0).toString(36);
}

export async function saveSubscription(sub) {
  const field = hashKey(sub.endpoint);
  await upstash(['HSET', SUBS_KEY, field, JSON.stringify(sub)]);
  return field;
}

export async function removeSubscription(endpoint) {
  await upstash(['HDEL', SUBS_KEY, hashKey(endpoint)]);
}

export async function removeByField(field) {
  await upstash(['HDEL', SUBS_KEY, field]);
}

// Trả [{ field, sub }]
export async function listSubscriptions() {
  const flat = await upstash(['HGETALL', SUBS_KEY]);
  if (!Array.isArray(flat)) return [];
  const out = [];
  for (let i = 0; i < flat.length; i += 2) {
    try { out.push({ field: flat[i], sub: JSON.parse(flat[i + 1]) }); } catch { /* skip */ }
  }
  return out;
}

// "Quẻ hôm nay" — CHUNG cho mọi người, đổi theo ngày (giờ VN, UTC+7).
// Dùng cùng FNV-seed như client nên nội dung khớp trang chủ (ở nhánh chưa cá nhân hóa).
export function todaysFortune(nowMs = Date.now()) {
  const ict = new Date(nowMs + 7 * 3600 * 1000);
  const dateKey = `${ict.getUTCFullYear()}-${ict.getUTCMonth() + 1}-${ict.getUTCDate()}`;
  const hex = daily.hex[hashHex(dateKey + '#que') % daily.hex.length];
  const card = daily.tarot[hashHex(dateKey + '#tarot') % daily.tarot.length];
  return { dateKey, hex, card };
}

// FNV trả số nguyên (dùng cho index mảng)
function hashHex(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
