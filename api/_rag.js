/**
 * api/_rag.js — RAG: embeddings, exact/semantic cache lookups, document storage.
 * Underscore prefix => Vercel does NOT expose this as a route; import only.
 */

import { isInfraDown } from './_llm.js';

// ---- RAG helpers ----

function isLocalUrl(url) {
  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('postgrest') || url.includes(':3001');
}

export async function getEmbedding(ollamaUrl, embedModel, text, breaker) {
  if (!ollamaUrl || breaker.localDown) return null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ model: embedModel, prompt: text }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    return data.embedding || null;
  } catch (err) {
    clearTimeout(t);
    if (isInfraDown(err)) breaker.localDown = true;
    return null;
  }
}

// Shared call to the match_documents RPC. `body` carries the threshold/count/
// filters (filter_source defaults to 'qa' server-side when omitted).
async function rpcMatch(sbUrl, sbKey, body, breaker) {
  if (!sbUrl || breaker.localDown) return [];
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4000);
  try {
    const isLocal = isLocalUrl(sbUrl);
    const path = isLocal ? '/rpc/match_documents' : '/rest/v1/rpc/match_documents';

    const headers = { 'Content-Type': 'application/json' };
    if (sbKey) {
      headers['apikey'] = sbKey;
      headers['Authorization'] = `Bearer ${sbKey}`;
    }

    const res = await fetch(`${sbUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    clearTimeout(t);
    if (isInfraDown(err)) breaker.localDown = true;
    return [];
  }
}

// Tier-2 semantic cache + RAG over PAST Q&As (source = 'qa').
export function retrieveSimilar(sbUrl, sbKey, embedding, type, breaker) {
  if (!embedding) return Promise.resolve([]);
  return rpcMatch(sbUrl, sbKey, {
    query_embedding: embedding,
    match_threshold: 0.78,
    match_count: 2,
    filter_type: type,
  }, breaker);
}

// Knowledge grounding over Thư Viện article chunks (source = 'kb').
// Lower threshold + a bit more breadth, since we want relevant theory, not an
// exact answer. Returns [] until the library has been indexed (build-thuvien-index).
export function retrieveKnowledge(sbUrl, sbKey, embedding, type, breaker) {
  if (!embedding) return Promise.resolve([]);
  return rpcMatch(sbUrl, sbKey, {
    query_embedding: embedding,
    match_threshold: 0.72,
    match_count: 3,
    filter_type: type,
    filter_source: 'kb',
  }, breaker);
}

export async function storeDoc(sbUrl, sbKey, payload) {
  if (!sbUrl || !payload.embedding) return;
  const isLocal = isLocalUrl(sbUrl);
  const path = isLocal ? '/documents' : '/rest/v1/documents';
  
  const headers = {
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };
  if (sbKey) {
    headers['apikey'] = sbKey;
    headers['Authorization'] = `Bearer ${sbKey}`;
  }

  try {
    await fetch(`${sbUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to store document in cache database:", err);
  }
}

export async function checkExactMatchCache(sbUrl, sbKey, type, question, context, breaker) {
  if (!sbUrl || breaker.localDown) return null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 3000);
  try {
    const isLocal = isLocalUrl(sbUrl);
    const basePath = isLocal ? '/documents' : '/rest/v1/documents';
    
    const url = new URL(`${sbUrl}${basePath}`);
    url.searchParams.set('type', `eq.${type}`);
    url.searchParams.set('question', `eq.${question.trim()}`);
    url.searchParams.set('context', `eq.${context || ''}`);
    url.searchParams.set('select', 'answer');
    url.searchParams.set('limit', '1');

    const headers = { 'Content-Type': 'application/json' };
    if (sbKey) {
      headers['apikey'] = sbKey;
      headers['Authorization'] = `Bearer ${sbKey}`;
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0].answer || null;
    }
    return null;
  } catch (err) {
    clearTimeout(t);
    if (isInfraDown(err)) breaker.localDown = true;
    return null;
  }
}

