// One HTTP client for every database: per-host rate limit, retries with exponential backoff
// on 429/5xx/network errors (honoring Retry-After), a polite User-Agent, and a disk cache of
// successful responses. Never throws on 4xx: callers decide what a 404 means.
//
// The rate limit holds across processes (SPEC.md): every rsearch call is its own process, and an
// agent can run several at once. A per-host lock directory allows one request at a time to a host
// on this machine, and a shared "next allowed" file carries spacing and server back-off
// (Retry-After) to every process.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const USER_AGENT = 'open-research/0.1 (+https://github.com/csakash/open-research)';
const RETRIES = 3;
const TIMEOUT_MS = 30000;
// A lock older than this is from a crashed process: three request timeouts.
const LOCK_STALE_MS = 3 * TIMEOUT_MS;
const POLL_MS = 100;
const MAX_BACKOFF_MS = 60000;

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

// --- cross-process throttle -------------------------------------------------------------------
const nextLocal = new Map(); // host -> earliest next request time, as seen by this process
const chains = new Map(); // host -> tail of this process's queue for that host
let sharedOff = false;

function throttleDir() {
  return process.env.RLOOP_THROTTLE_DIR || path.join(os.homedir(), '.cache', 'rloop', 'throttle');
}

function hostKey(host) {
  return String(host).toLowerCase().replace(/[^a-z0-9.-]/g, '_').replace(/^\.+/, '_');
}

function fallBack(reason) {
  if (!sharedOff) process.stderr.write(`rloop http: shared throttle unavailable (${reason}); spacing requests within this process only\n`);
  sharedOff = true;
}

// A next time further ahead than any back-off we ever write is corrupt (or a clock jump): ignore it.
const MAX_AHEAD_MS = MAX_BACKOFF_MS + 10000;
function readNext(file) {
  try {
    const n = Number(fs.readFileSync(file, 'utf8'));
    if (!Number.isFinite(n) || n > Date.now() + MAX_AHEAD_MS) return 0;
    return n;
  } catch {
    return 0;
  }
}

function writeNext(file, t) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, String(t), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

// Wait until `until`, once per distinct deadline: with a fake sleep in tests the clock doesn't
// move, so re-checking the same deadline would spin.
async function waitUntil(until, state) {
  if (until > Date.now() && until !== state.waited) {
    state.waited = until;
    await sleepImpl(until - Date.now());
    return true;
  }
  return false;
}

// Locks this process holds, released on exit and on SIGINT/SIGTERM/SIGHUP (s1-01): a killed
// rsearch must not leave a host blocked for every other process.
const held = new Map(); // lock path -> the owner token we wrote
let handlersOn = false;
function releaseHeld() {
  for (const lock of [...held.keys()]) unlock(lock);
}
function onSignal(sig) {
  releaseHeld();
  // Re-raise only when no one else handles it (the runner has its own handlers and exits itself).
  if (process.listenerCount(sig) === 1) {
    process.removeListener(sig, signalHandlers[sig]);
    process.kill(process.pid, sig);
  }
}
const signalHandlers = { SIGINT: () => onSignal('SIGINT'), SIGTERM: () => onSignal('SIGTERM'), SIGHUP: () => onSignal('SIGHUP') };
function watchSignals() {
  if (handlersOn) return;
  handlersOn = true;
  process.on('exit', releaseHeld);
  for (const [sig, fn] of Object.entries(signalHandlers)) process.on(sig, fn);
}

function ownerOf(lock) {
  try { return fs.readFileSync(path.join(lock, 'owner'), 'utf8'); } catch { return null; }
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

// A lock is abandoned when its owner process is dead, or when it is older than LOCK_STALE_MS
// (covers a recycled pid, or a lock whose owner file was never written).
function abandoned(lock) {
  let st;
  try { st = fs.statSync(lock); } catch { return null; }
  const owner = ownerOf(lock);
  const pid = owner ? Number(owner.split(' ')[0]) : NaN;
  const young = Date.now() - st.mtimeMs <= LOCK_STALE_MS;
  if (owner && young && pidAlive(pid)) return null;
  if (!owner && young) return null; // just created, owner not written yet
  return { owner };
}

// Break an abandoned lock by renaming it aside first, then checking it is the one we judged
// (s1-03): two waiters can't both break it and end up sharing the host.
function breakLock(lock, judged) {
  const tomb = `${lock}.dead.${process.pid}.${crypto.randomBytes(4).toString('hex')}`;
  try { fs.renameSync(lock, tomb); } catch { return; }
  if (ownerOf(tomb) === judged.owner) {
    fs.rmSync(tomb, { recursive: true, force: true });
    return;
  }
  // We moved a lock someone just took: put it back.
  try { fs.renameSync(tomb, lock); } catch { fs.rmSync(tomb, { recursive: true, force: true }); }
}

// Take the host's lock directory, or report why it can't be taken.
function tryLock(lock) {
  try {
    fs.mkdirSync(lock, { mode: 0o700 });
  } catch (e) {
    if (e.code !== 'EEXIST') return e.code || 'error';
    const judged = abandoned(lock);
    if (judged) breakLock(lock, judged);
    return 'busy';
  }
  watchSignals();
  const token = `${process.pid} ${crypto.randomBytes(6).toString('hex')}`;
  held.set(lock, token);
  try {
    fs.writeFileSync(path.join(lock, 'owner'), token, { mode: 0o600 });
  } catch { /* the mtime rule still covers it */ }
  return 'ok';
}

// Release only our own lock (r1-01): if ours was broken as stale and someone else now holds the
// host, leave theirs alone. Rename aside first so the check and the delete can't race.
function unlock(lock) {
  const token = held.get(lock);
  held.delete(lock);
  if (ownerOf(lock) !== token) return;
  const tomb = `${lock}.dead.${process.pid}.${crypto.randomBytes(4).toString('hex')}`;
  try { fs.renameSync(lock, tomb); } catch { return; }
  if (ownerOf(tomb) === token) {
    fs.rmSync(tomb, { recursive: true, force: true });
    return;
  }
  try { fs.renameSync(tomb, lock); } catch { fs.rmSync(tomb, { recursive: true, force: true }); }
}

// Run fn() as this host's only request on the machine, no earlier than the shared next time.
// fn returns { backoff }: the server's requested pause (0 when none). Afterwards the next time is
// end + max(spacing, backoff) for every process.
async function withHost(host, fn) {
  const prev = chains.get(host) || Promise.resolve();
  const run = prev.then(() => exclusive(host, fn));
  chains.set(host, run.catch(() => {}));
  return run;
}

async function exclusive(host, fn) {
  const gap = SPACING[host] ?? 1000;
  const state = { waited: 0 };
  let lock = null;
  let nextFile = null;
  if (!sharedOff) {
    try {
      const dir = throttleDir();
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      lock = path.join(dir, `${hostKey(host)}.lock`);
      nextFile = path.join(dir, `${hostKey(host)}.next`);
    } catch (e) {
      fallBack(e.code || e.message);
    }
  }
  for (;;) {
    const due = Math.max(nextLocal.get(host) || 0, nextFile ? readNext(nextFile) : 0);
    if (await waitUntil(due, state)) continue;
    if (!lock || sharedOff) break;
    const got = tryLock(lock);
    if (got === 'ok') {
      // Another process may have moved the next time while we waited for the lock.
      const dueNow = readNext(nextFile);
      if (dueNow > Date.now() && dueNow !== state.waited) {
        unlock(lock);
        continue;
      }
      break;
    }
    if (got === 'ENOENT' && !state.recreated) {
      // The throttle dir was removed mid-run: recreate it once rather than give up (r1-04).
      state.recreated = true;
      try { fs.mkdirSync(path.dirname(lock), { recursive: true, mode: 0o700 }); continue; } catch { /* fall back below */ }
    }
    if (got !== 'busy') { fallBack(got); lock = null; nextFile = null; break; }
    // A real timer, not the sleep seam: we are waiting on another process, and a fake sleep
    // would spin without letting it (or a test's timer) run (r1-02).
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  let out;
  try {
    out = await fn();
  } finally {
    const backoff = Math.min((out && out.backoff) || 0, MAX_BACKOFF_MS);
    const next = Date.now() + Math.max(gap, backoff);
    nextLocal.set(host, next);
    if (lock) {
      try { writeNext(nextFile, Math.max(next, readNext(nextFile))); } catch (e) { fallBack(e.code || e.message); }
      unlock(lock);
    }
  }
  return out;
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
    const out = await withHost(host, async () => {
      stats.requests += 1;
      try {
        const res = await fetchImpl(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, application/xml;q=0.9, */*;q=0.8', ...headers },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.status === 429 || res.status >= 500) return { res, backoff: retryAfterMs(res, attempt) };
        return { res, text: await res.text(), backoff: 0 };
      } catch (e) {
        return { err: e, backoff: retryAfterMs(null, attempt) };
      }
    });
    if (out.err) {
      lastErr = out.err;
      if (attempt < RETRIES) { stats.retries += 1; await sleepImpl(out.backoff); continue; }
      throw new Error(`GET ${redact(url)} failed after ${RETRIES + 1} attempts: ${out.err.message}`);
    }
    const { res } = out;
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`HTTP ${res.status}`);
      if (attempt < RETRIES) { stats.retries += 1; await sleepImpl(out.backoff); continue; }
      throw new Error(`GET ${redact(url)} failed after ${RETRIES + 1} attempts: HTTP ${res.status}`);
    }
    const { text } = out;
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
  resetThrottle() {
    nextLocal.clear();
    chains.clear();
    sharedOff = false;
    // Test seam. Only clears a directory the caller chose under the OS temp dir, and only the
    // throttle's own entries (s1-04).
    const dir = process.env.RLOOP_THROTTLE_DIR;
    const tmp = fs.realpathSync(os.tmpdir());
    let real = null;
    try { real = fs.realpathSync(dir); } catch { /* not created yet */ }
    if (dir && real && real.startsWith(`${tmp}${path.sep}`)) {
      for (const e of fs.readdirSync(real)) {
        if (/\.(lock|next)(\..*)?$|\.lock\.dead\./.test(e)) fs.rmSync(path.join(real, e), { recursive: true, force: true });
      }
    }
  },
  throttleDir, hostKey, LOCK_STALE_MS,
};
