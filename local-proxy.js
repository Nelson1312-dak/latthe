/**
 * local-proxy.js
 * Routes all traffic through one port so a single ngrok tunnel serves both services:
 *   /postgrest/*  -> localhost:3001  (PostgREST / RAG database)
 *   /*            -> localhost:11434 (Ollama AI)
 *
 * Run: node local-proxy.js
 */

import http from 'http';

const PORT = 11435;

function forward(req, res, host, port, path) {
  const opts = {
    hostname: host,
    port,
    path,
    method: req.method,
    headers: { ...req.headers, host: `${host}:${port}` },
  };
  const proxy = http.request(opts, (upstream) => {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });
  proxy.on('error', (e) => { res.writeHead(502); res.end(`Proxy error: ${e.message}`); });
  req.pipe(proxy);
}

http.createServer((req, res) => {
  const url = req.url || '/';

  if (url.startsWith('/postgrest')) {
    // Strip /postgrest prefix + /rest/v1 prefix (Supabase compat → raw PostgREST paths)
    let path = url.slice('/postgrest'.length) || '/';
    path = path.replace(/^\/rest\/v1/, '') || '/';
    forward(req, res, 'localhost', 3001, path);
  } else {
    forward(req, res, 'localhost', 11434, url);
  }
}).listen(PORT, () => {
  console.log(`[proxy] Listening on :${PORT}`);
  console.log(`  /postgrest/* -> localhost:3001 (PostgREST)`);
  console.log(`  /*           -> localhost:11434 (Ollama)`);
});
