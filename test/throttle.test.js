// Cross-process per-host throttle (SPEC.md): one request at a time per host on the machine,
// shared spacing and shared server back-off.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const httpServer = require('http');
const { spawn } = require('child_process');
const { tmpdir } = require('./helpers');
const http = require('../lib/http');

const HTTP_JS = path.resolve(__dirname, '..', 'lib', 'http.js');

// A local server that records when each request starts and ends.
function startServer(handler) {
  const events = [];
  const server = httpServer.createServer((req, res) => {
    const ev = { path: req.url, start: Date.now(), end: null };
    events.push(ev);
    handler(req, res, ev, events);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, events, base: `http://127.0.0.1:${server.address().port}` })));
}

function reply(res, ev, { status = 200, delay = 120, headers = {} } = {}) {
  setTimeout(() => {
    ev.end = Date.now();
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end('{"ok":1}');
  }, delay);
}

// A separate node process making `n` requests through lib/http.js with real sleeps.
function child(base, paths, dir, spacing) {
  const code = `
    const http = require(${JSON.stringify(HTTP_JS)});
    const host = new URL(${JSON.stringify(base)}).host;
    http.SPACING[host] = ${spacing};
    (async () => { for (const p of ${JSON.stringify(paths)}) await http.get(${JSON.stringify(base)} + p); })()
      .then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });`;
  const env = { ...process.env, RLOOP_THROTTLE_DIR: dir, RLOOP_CACHE: 'off' };
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['-e', code], { env, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`child exited ${c}: ${err}`))));
  });
}

// protects=one request at a time per host across processes, with spacing between them; fails_when=two processes overlap or start closer than the spacing; no_claim=machines other than this one
test('two processes never overlap on one host and keep the spacing', { timeout: 20000 }, async () => {
  const { server, events, base } = await startServer((req, res, ev) => reply(res, ev));
  const dir = tmpdir('rloop-throttle-x-');
  try {
    await Promise.all([child(base, ['/a1', '/a2', '/a3'], dir, 250), child(base, ['/b1', '/b2', '/b3'], dir, 250)]);
    assert.equal(events.length, 6);
    const ordered = [...events].sort((x, y) => x.start - y.start);
    for (let i = 1; i < ordered.length; i += 1) {
      assert.ok(ordered[i].start >= ordered[i - 1].end, `request ${ordered[i].path} started before ${ordered[i - 1].path} ended`);
      assert.ok(ordered[i].start - ordered[i - 1].end >= 200, `gap ${ordered[i].start - ordered[i - 1].end}ms under spacing`);
    }
  } finally {
    server.close();
  }
});

// protects=a 429's Retry-After slows every process, not only the one that got it; fails_when=a second process requests during another's back-off; no_claim=HTTP-date Retry-After values
test('Retry-After from one process holds back another', { timeout: 20000 }, async () => {
  let first = true;
  let gotFirst;
  const firstSeen = new Promise((r) => { gotFirst = r; });
  const { server, events, base } = await startServer((req, res, ev) => {
    if (first && req.url === '/slow') {
      first = false;
      reply(res, ev, { status: 429, delay: 20, headers: { 'retry-after': '1' } });
      setTimeout(gotFirst, 60);
    } else {
      reply(res, ev, { delay: 20 });
    }
  });
  const dir = tmpdir('rloop-throttle-r-');
  try {
    const a = child(base, ['/slow'], dir, 50);
    await firstSeen;
    await child(base, ['/other'], dir, 50);
    await a;
    const e429 = events.find((e) => e.path === '/slow');
    const other = events.find((e) => e.path === '/other');
    assert.ok(other.start - e429.end >= 900, `second process waited only ${other.start - e429.end}ms after a Retry-After of 1s`);
  } finally {
    server.close();
  }
});

// protects=a lock left by a crashed process is broken after LOCK_STALE_MS, a fresh one is waited for; fails_when=a crash blocks a host forever or a live lock is ignored; no_claim=the race between two breakers of the same stale lock
test('stale locks are broken, live locks are waited for', { timeout: 20000 }, async () => {
  http.resetThrottle();
  const dir = http.throttleDir();
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, `${http.hostKey('api.crossref.org')}.lock`);
  http.setFetch(async () => new Response('{}', { status: 200 }));
  http.setSleep((ms) => new Promise((r) => setTimeout(r, Math.min(ms, 20))));
  try {
    fs.writeFileSync(lock, '');
    const old = (Date.now() - http.LOCK_STALE_MS - 5000) / 1000;
    fs.utimesSync(lock, old, old);
    await http.get('https://api.crossref.org/works/stale');
    assert.ok(!fs.existsSync(lock), 'lock released after the request');

    http.resetThrottle();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(lock, `${process.pid} live`);
    const t0 = Date.now();
    setTimeout(() => fs.rmSync(lock, { recursive: true, force: true }), 300);
    await http.get('https://api.crossref.org/works/live');
    assert.ok(Date.now() - t0 >= 250, 'waited for the live lock');
  } finally {
    http.setSleep(async () => {});
  }
});

// protects=hosts don't block each other, and cache hits skip the lock; fails_when=a busy host delays another host or a cached read; no_claim=none beyond protects
test('other hosts and cache hits are not blocked by a held lock', { timeout: 20000 }, async () => {
  const cache = tmpdir('rloop-cache-');
  process.env.RLOOP_CACHE = 'on';
  process.env.RLOOP_CACHE_DIR = cache;
  http.resetThrottle();
  http.setFetch(async () => new Response('{"x":1}', { status: 200 }));
  try {
    await http.get('https://export.arxiv.org/cached');
    const dir = http.throttleDir();
    fs.mkdirSync(dir, { recursive: true });
    const lock = path.join(dir, `${http.hostKey('export.arxiv.org')}.lock`);
    fs.writeFileSync(lock, `${process.pid} held`);
    const t0 = Date.now();
    assert.equal((await http.get('https://export.arxiv.org/cached')).cached, true);
    await http.get('https://www.ebi.ac.uk/other');
    assert.ok(Date.now() - t0 < 1000, 'not blocked by the arXiv lock');
    fs.rmSync(lock, { recursive: true, force: true });
  } finally {
    process.env.RLOOP_CACHE = 'off';
    delete process.env.RLOOP_CACHE_DIR;
  }
});

// protects=an unwritable throttle dir falls back to the in-process throttle with one warning, still spacing requests; fails_when=requests fail or go unthrottled; no_claim=cross-process safety in fallback mode
test('falls back to the in-process throttle when the directory is unusable', { timeout: 20000 }, async () => {
  const saved = process.env.RLOOP_THROTTLE_DIR;
  const file = path.join(tmpdir('rloop-notdir-'), 'file');
  fs.writeFileSync(file, 'x');
  const writes = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (s) => { writes.push(String(s)); return true; };
  const waits = [];
  try {
    delete process.env.RLOOP_THROTTLE_DIR;
    http.resetThrottle();
    process.env.RLOOP_THROTTLE_DIR = path.join(file, 'sub');
    http.setSleep(async (ms) => { waits.push(ms); });
    http.setFetch(async () => new Response('{}', { status: 200 }));
    await http.get('https://export.arxiv.org/f1');
    await http.get('https://export.arxiv.org/f2');
    assert.equal(writes.filter((w) => w.includes('shared throttle unavailable')).length, 1);
    assert.ok(waits.some((w) => w > 2500), `expected an in-process arXiv wait, got ${waits}`);
  } finally {
    process.stderr.write = origWrite;
    process.env.RLOOP_THROTTLE_DIR = saved;
    http.setSleep(async () => {});
    http.resetThrottle();
  }
});

// protects=host names can't escape the throttle dir; fails_when=a crafted host yields a path outside it; no_claim=none beyond protects
test('host keys are safe file names', () => {
  for (const h of ['../../etc', 'a/b', '..', 'EXPORT.arxiv.org:443']) {
    const k = http.hostKey(h);
    assert.ok(!k.includes('/') && !k.startsWith('.'), `${h} -> ${k}`);
    assert.equal(path.dirname(path.join(os.tmpdir(), `${k}.lock`)), os.tmpdir());
  }
});

// protects=a lock whose owner process is dead is broken at once, not after LOCK_STALE_MS; fails_when=a killed rsearch blocks the host for 90 s; no_claim=recycled pids
test('a dead owner\'s lock is broken immediately', { timeout: 20000 }, async () => {
  http.resetThrottle();
  const dir = http.throttleDir();
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, `${http.hostKey('api.crossref.org')}.lock`);
  const dead = spawn(process.execPath, ['-e', '0']);
  await new Promise((r) => dead.on('exit', r));
  fs.writeFileSync(lock, `${dead.pid} deadbeef`);
  http.setFetch(async () => new Response('{}', { status: 200 }));
  const t0 = Date.now();
  await http.get('https://api.crossref.org/works/dead-owner');
  assert.ok(Date.now() - t0 < 5000, `took ${Date.now() - t0}ms`);
  assert.ok(!fs.existsSync(lock));
});

// protects=a process whose lock was broken never deletes the next holder's lock on release; fails_when=release removes a foreign lock and lets a third process in; no_claim=none beyond protects
test('release leaves another holder\'s lock alone', { timeout: 20000 }, async () => {
  http.resetThrottle();
  const dir = http.throttleDir();
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, `${http.hostKey('api.crossref.org')}.lock`);
  http.setFetch(async () => {
    // While our request is in flight, our lock is broken and someone else takes the host.
    fs.rmSync(lock, { recursive: true, force: true });
    fs.writeFileSync(lock, '999999 someoneelse');
    return new Response('{}', { status: 200 });
  });
  await http.get('https://api.crossref.org/works/foreign');
  assert.equal(fs.readFileSync(lock, 'utf8'), '999999 someoneelse');
  fs.rmSync(lock, { recursive: true, force: true });
});

// protects=a process killed by SIGTERM mid-request releases its lock; fails_when=the lock outlives the process; no_claim=SIGKILL (covered by the dead-owner test)
test('SIGTERM mid-request releases the lock', { timeout: 20000 }, async () => {
  let started;
  const inFlight = new Promise((r) => { started = r; });
  const { server, base } = await startServer((req, res, ev) => { started(); reply(res, ev, { delay: 5000 }); });
  const dir = tmpdir('rloop-throttle-k-');
  try {
    const code = `const http = require(${JSON.stringify(HTTP_JS)}); http.get(${JSON.stringify(base)} + '/hang');`;
    const p = spawn(process.execPath, ['-e', code], { env: { ...process.env, RLOOP_THROTTLE_DIR: dir, RLOOP_CACHE: 'off' } });
    await inFlight;
    const lock = path.join(dir, `${http.hostKey(new URL(base).host)}.lock`);
    assert.ok(fs.existsSync(lock), 'lock held during the request');
    p.kill('SIGTERM');
    await new Promise((r) => p.on('exit', r));
    assert.ok(!fs.existsSync(lock), 'lock released on SIGTERM');
  } finally {
    server.close();
  }
});

// protects=a run started under nohup survives SIGHUP after making requests; fails_when=the throttle installs a SIGHUP handler that re-raises with the default action; no_claim=other ignored signals
test('SIGHUP is left alone (nohup keeps working)', { timeout: 20000 }, async () => {
  const { server, base } = await startServer((req, res, ev) => reply(res, ev, { delay: 10 }));
  const dir = tmpdir('rloop-throttle-h-');
  try {
    const code = `process.on('SIGHUP', () => {});
      const http = require(${JSON.stringify(HTTP_JS)});
      http.get(${JSON.stringify(base)} + '/x').then(() => {
        process.kill(process.pid, 'SIGHUP');
        setTimeout(() => { console.log(process.listenerCount('SIGHUP')); process.exit(0); }, 100);
      });`;
    const out = await new Promise((resolve, reject) => {
      const p = spawn(process.execPath, ['-e', code], { env: { ...process.env, RLOOP_THROTTLE_DIR: dir, RLOOP_CACHE: 'off' } });
      let o = '';
      p.stdout.on('data', (d) => { o += d; });
      p.on('exit', (c, sig) => (c === 0 ? resolve(o.trim()) : reject(new Error(`exited ${c} ${sig}`))));
    });
    assert.equal(out, '1', 'only the caller\'s own SIGHUP listener');
  } finally {
    server.close();
  }
});

// protects=a lock file is created with its owner token already in it, and two takers can't both hold it; fails_when=an ownerless lock exists or a second taker overwrites the first; no_claim=none beyond protects
test('a lock is born with its owner and is never replaced', { timeout: 20000 }, async () => {
  http.resetThrottle();
  const dir = http.throttleDir();
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, `${http.hostKey('api.crossref.org')}.lock`);
  let seen = null;
  http.setFetch(async () => { seen = fs.readFileSync(lock, 'utf8'); return new Response('{}', { status: 200 }); });
  await http.get('https://api.crossref.org/works/born');
  assert.match(seen, new RegExp(`^${process.pid} [0-9a-f]{12}$`));
  assert.ok(!fs.existsSync(lock), 'released');
  assert.deepEqual(fs.readdirSync(dir).filter((e) => /\.(new|dead)\./.test(e)), [], 'no temp files left');
});
