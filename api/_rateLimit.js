/**
 * api/_rateLimit.js — Per-IP rate limiting (Upstash Redis with in-memory fallback).
 * Underscore prefix => Vercel does NOT expose this as a route; import only.
 */

// ---- Rate-limit config ----

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_WINDOW_SEC = RATE_LIMIT_WINDOW_MS / 1000;
const RATE_LIMIT_MAX = 5;

// Strip accidental surrounding junk from pasted env values — quotes, angle
// brackets (e.g. copied from a markdown <url> link), whitespace and trailing
// slashes — which otherwise make the fetch URL malformed (throws TypeError) and
// silently drop us to the in-memory limiter.
function cleanEnv(v) {
  return (v || '')
    .trim()
    .replace(/^[<'"]+|[>'"]+$/g, '') // wrapping < > ' "
    .trim()
    .replace(/\/+$/, '');            // trailing slash(es)
}
const UPSTASH_URL   = cleanEnv(process.env.UPSTASH_REDIS_REST_URL);
const UPSTASH_TOKEN = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
const upstashEnabled = !!(UPSTASH_URL && UPSTASH_TOKEN);

const rateLimitStore = new Map(); // ip -> { count, windowStart } — in-memory fallback

export function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// In-memory limiter — per-instance only. Used as a fallback when Upstash is not
// configured or unreachable, so a misconfig never takes the whole endpoint down.
function checkRateLimitLocal(ip) {
  const now = Date.now();
  if (rateLimitStore.size > 500) {
    for (const [k, v] of rateLimitStore) {
      if (now - v.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitStore.delete(k);
    }
  }
  const record = rateLimitStore.get(ip);
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }
  if (record.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }
  record.count++;
  return { allowed: true };
}

// Distributed limiter backed by Upstash Redis (shared across all serverless
// instances, unlike the in-memory Map). Fixed-window counter: INCR the per-IP
// key, and set a TTL on the first hit of each window so it auto-expires. Done in
// one pipelined REST call. Any failure falls back to the in-memory limiter.
export async function checkRateLimit(ip) {
  if (!upstashEnabled) return { ...checkRateLimitLocal(ip), backend: 'memory-noenv' };

  const key = `rl:interpret:${ip}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      // INCR returns the new count; EXPIRE NX sets TTL only if none exists, so the
      // window starts at the first request and is not extended by later ones.
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(RATE_LIMIT_WINDOW_SEC), 'NX'],
      ]),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { ...checkRateLimitLocal(ip), backend: `memory-http${res.status}` };

    const data = await res.json();
    const count = Array.isArray(data) ? Number(data[0]?.result) : NaN;
    if (!Number.isFinite(count)) return { ...checkRateLimitLocal(ip), backend: 'memory-badresp' };

    if (count > RATE_LIMIT_MAX) {
      // Read remaining TTL to give the client an accurate Retry-After.
      let retryAfter = RATE_LIMIT_WINDOW_SEC;
      try {
        const ttlRes = await fetch(`${UPSTASH_URL}/ttl/${encodeURIComponent(key)}`, {
          headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` },
        });
        if (ttlRes.ok) {
          const ttl = Number((await ttlRes.json())?.result);
          if (Number.isFinite(ttl) && ttl > 0) retryAfter = ttl;
        }
      } catch { /* keep default */ }
      return { allowed: false, retryAfter, backend: 'upstash' };
    }
    return { allowed: true, backend: 'upstash' };
  } catch (err) {
    clearTimeout(t);
    return { ...checkRateLimitLocal(ip), backend: `memory-err:${err.name || 'unknown'}` };
  }
}

