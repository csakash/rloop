// One HTTP client for every database: per-host rate limit, retries with exponential backoff
// on 429/5xx/network errors (honoring Retry-After), a polite User-Agent, and a disk cache of
// successful responses. Never throws on 4xx: callers decide what a 404 means.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USER_AGENT = 'open-research/0.1 (+https://github.com/csakash/open-research)';
const RETRIES = 3;
const TIMEOUT_MS = 30000;

// Minimum spacing between requests to one host, in ms. Unknown hosts get 1000.
const SPACING = {
  'api.openalex.org': 150,
  'api.semanticscholar.org': process.env.S2_API_KEY ? 1100 : 1500,
  'export.arxiv.org': 3100,
  'eutils.ncbi.nlm.nih.gov': process.env.NCBI_API_KEY ? 120 : 400,
  'www.ebi.ac.uk': 150,
  'api.crossref.org': 200,
  'clinicaltrials.gov': 300,
};

let fetchImpl = (...a) => globalThis.fetch(...a);
let sleepImpl = (ms) => new Promise((r) => setTimeout(r, ms));
const lastHit = new Map();
const stats = { requests: 0, cacheHits: 0, retries: 0 };

function cacheDir() {
  if (process.env.RLOOP_CACHE === 'off') return null;
  return process.env.RLOOP_CACHE_DIR || path.resolve(__dirname, '..', '.cache');
}

function cacheFile(url) {
  const dir = cacheDir();
  if (!dir) return null;
  const host = new URL(url).host;
  return path.join(dir, host, `${crypto.createHash('sha256').update(url).digest('hex')}.json`);
}

async function throttle(host) {
  const gap = SPACING[host] ?? 1000;
  const wait = (lastHit.get(host) || 0) + gap - Date.now();
  if (wait > 0) await sleepImpl(wait);
  lastHit.set(host, Date.now());
}

function retryAfterMs(res, attempt) {
  const ra = res && res.headers && res.headers.get && res.headers.get('retry-after');
  const secs = ra ? Number(ra) : NaN;
  if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, 60000);
  return 1000 * 2 ** attempt; // 1s, 2s, 4s
}

// GET a URL. Returns { status, text, cached }. Retries 429/5xx/network up to RETRIES times.
async function get(url, { headers = {} } = {}) {
  const file = cacheFile(url);
  if (file && fs.existsSync(file)) {
    stats.cacheHits += 1;
    const hit = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { status: hit.status, text: hit.text, cached: true };
  }
  const host = new URL(url).host;
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    await throttle(host);
    stats.requests += 1;
    let res;
    try {
      res = await fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, application/xml;q=0.9, */*;q=0.8', ...headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      lastErr = e;
      if (attempt < RETRIES) { stats.retries += 1; await sleepImpl(retryAfterMs(null, attempt)); continue; }
      throw new Error(`GET ${redact(url)} failed after ${RETRIES + 1} attempts: ${e.message}`);
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`HTTP ${res.status}`);
      if (attempt < RETRIES) { stats.retries += 1; await sleepImpl(retryAfterMs(res, attempt)); continue; }
      throw new Error(`GET ${redact(url)} failed after ${RETRIES + 1} attempts: HTTP ${res.status}`);
    }
    const text = await res.text();
    if (res.status === 200 && file) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ url: redact(url), status: 200, text }));
      fs.renameSync(tmp, file);
    }
    return { status: res.status, text, cached: false };
  }
  throw lastErr;
}

async function getJSON(url, opts) {
  const r = await get(url, opts);
  if (r.status !== 200) return { status: r.status, json: null };
  try {
    return { status: 200, json: JSON.parse(r.text) };
  } catch {
    throw new Error(`GET ${redact(url)}: response is not JSON`);
  }
}

// Keys never belong in logs or error messages.
function redact(url) {
  return String(url).replace(/(api_key|apikey|key)=[^&]+/gi, '$1=REDACTED');
}

module.exports = {
  USER_AGENT, SPACING, RETRIES, get, getJSON, redact, stats,
  // test seams
  setFetch(fn) { fetchImpl = fn; },
  setSleep(fn) { sleepImpl = fn; },
  resetThrottle() { lastHit.clear(); },
};
