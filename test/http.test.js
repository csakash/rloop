// http.js: rate limit spacing, retries, cache, redaction.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('./helpers');
const http = require('../lib/http');

function fakeFetch(responses, log) {
  return async (url, opts) => {
    log.push({ url, ua: opts.headers['User-Agent'] });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return new Response(r.body || '{}', { status: r.status, headers: r.headers || {} });
  };
}

// protects=per-host spacing: a second request to the same host waits the host's gap; fails_when=requests fire back to back; no_claim=real wall-clock timing
test('throttle spaces requests to one host', async () => {
  const waits = [];
  http.setSleep(async (ms) => { waits.push(ms); });
  http.resetThrottle();
  const log = [];
  http.setFetch(fakeFetch([{ status: 200 }, { status: 200 }], log));
  await http.get('https://export.arxiv.org/a');
  await http.get('https://export.arxiv.org/b');
  assert.ok(waits.some((w) => w > 2500), `expected a ~3s wait for arXiv, got ${waits}`);
  assert.equal(log[0].ua, http.USER_AGENT);
});

// protects=429 and 503 are retried with backoff, then succeed; fails_when=a transient error surfaces or no backoff happens; no_claim=Retry-After beyond seconds format
test('retries 429 and 5xx then succeeds', async () => {
  const waits = [];
  http.setSleep(async (ms) => { waits.push(ms); });
  http.resetThrottle();
  const log = [];
  http.setFetch(fakeFetch([{ status: 429, headers: { 'retry-after': '2' } }, { status: 503 }, { status: 200, body: '{"ok":1}' }], log));
  const r = await http.getJSON('https://api.crossref.org/works/x');
  assert.deepEqual(r.json, { ok: 1 });
  assert.equal(log.length, 3);
  assert.ok(waits.includes(2000), 'Retry-After honored');
});

// protects=gives up after RETRIES with a clear error, and 404 is returned not thrown; fails_when=infinite retry or 404 treated as error; no_claim=none beyond protects
test('gives up after retries; 404 is a result', async () => {
  http.setSleep(async () => {});
  http.resetThrottle();
  http.setFetch(fakeFetch(Array.from({ length: http.RETRIES + 1 }, () => ({ status: 500 })), []));
  await assert.rejects(() => http.get('https://api.openalex.org/works/W1'), /after 4 attempts: HTTP 500/);
  http.setFetch(fakeFetch([{ status: 404 }], []));
  assert.equal((await http.get('https://api.openalex.org/works/W2')).status, 404);
});

// protects=200 responses are cached on disk and served without a request; keys never appear in errors; fails_when=cache misses or api_key leaks; no_claim=cache invalidation
test('caches 200s and redacts keys', async () => {
  const dir = tmpdir();
  process.env.RLOOP_CACHE = 'on';
  process.env.RLOOP_CACHE_DIR = dir;
  try {
    http.setSleep(async () => {});
    http.resetThrottle();
    const log = [];
    http.setFetch(fakeFetch([{ status: 200, body: '"x"' }], log));
    await http.get('https://api.openalex.org/works?api_key=SECRET');
    const again = await http.get('https://api.openalex.org/works?api_key=SECRET');
    assert.equal(again.cached, true);
    assert.equal(log.length, 1);
    const files = fs.readdirSync(path.join(dir, 'api.openalex.org'));
    assert.ok(!fs.readFileSync(path.join(dir, 'api.openalex.org', files[0]), 'utf8').includes('SECRET'));
    assert.equal(http.redact('https://x/y?api_key=abc&q=1'), 'https://x/y?api_key=REDACTED&q=1');
  } finally {
    process.env.RLOOP_CACHE = 'off';
    delete process.env.RLOOP_CACHE_DIR;
  }
});
