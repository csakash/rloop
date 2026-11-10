// Agent permissions, paper allocation/dedupe, the gstack-loops export check, and the CLI on a
// real gloop workspace.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { tmpdir, FIX } = require('./helpers');
const agent = require('../lib/agent');
const { allocate, dedupe } = require('../lib/stages/map');

const ROOT = path.resolve(__dirname, '..');

// protects=s1-01/s1-02/s2-03/s3-03: file rules scoped to the stage dir (no bare Read/Write/Edit/Grep/Glob), only the toolbox rsearch may run, WebFetch domain-limited, the disprover never edits, nobody pushes, "Bash" not denied outright (that would cancel the rsearch rule), and the CLI starts in --safe-mode with dontAsk (a valid mode per `claude --help`), no settings sources and no MCP; fails_when=an agent can read or write outside its stage dir, fetch any domain, run other commands, or load customizations; no_claim=the CLI's runtime enforcement (not testable here: its login has expired)
test('agent tool permissions per role', () => {
  const dir = '/tmp/rloop-stage-x';
  const rs = '/tmp/rloop-tools-x/bin/rsearch';
  const d = agent.args('disprover', 'disprove', 'p', { dir, rsearch: rs });
  const allowed = d.slice(d.indexOf('--allowedTools') + 1, d.indexOf('--disallowedTools'));
  const denied = d.slice(d.indexOf('--disallowedTools') + 1, d.indexOf('--output-format'));
  assert.deepEqual(allowed.slice(0, 3), ['Read(//tmp/rloop-stage-x/**)', `Bash(${rs}:*)`, 'WebSearch']);
  assert.ok(allowed.slice(3).every((t) => /^WebFetch\(domain:[a-z0-9.-]+\)$/.test(t)));
  assert.ok(allowed.includes('WebFetch(domain:arxiv.org)'));
  for (const t of ['Edit', 'Write', 'NotebookEdit', 'Bash(git push:*)']) assert.ok(denied.includes(t), t);
  assert.ok(!denied.includes('Bash'));
  const a = agent.args('author', 'detect', 'p', { dir, rsearch: rs });
  const aAllowed = a.slice(a.indexOf('--allowedTools') + 1, a.indexOf('--disallowedTools'));
  assert.deepEqual(aAllowed, ['Read(//tmp/rloop-stage-x/**)', `Bash(${rs}:*)`, 'Edit(//tmp/rloop-stage-x/**)']);
  for (const bare of ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'WebFetch', 'Bash']) assert.ok(![...allowed, ...aAllowed].includes(bare), bare);
  for (const x of [a, d]) {
    assert.equal(x[x.indexOf('--permission-mode') + 1], 'dontAsk');
    assert.ok(x.includes('--safe-mode') && x.includes('--strict-mcp-config'));
    assert.equal(x[x.indexOf('--setting-sources') + 1], '');
  }
});

// protects=the stage sandbox: only declared inputs are copied in, only declared regular-file outputs come back, symlinks and ../ paths are refused, and the stage dir is outside any git repo; fails_when=undeclared files (CLAUDE.md, .git, .claude) or a symlink escape flow into the run dir; no_claim=the CLI's in-stage behavior
test('stage sandbox copies only declared files', () => {
  const runDir = tmpdir();
  fs.writeFileSync(path.join(runDir, 'brief.md'), 'b');
  fs.writeFileSync(path.join(runDir, 'papers.jsonl'), 'p');
  const ctx = { runDir };
  const dir = agent.stageDir(ctx, ['brief.md', 'missing.json']);
  assert.deepEqual(fs.readdirSync(dir), ['brief.md']);
  assert.ok(!dir.startsWith(ROOT));
  assert.equal(spawnSync('git', ['-C', dir, 'rev-parse', '--git-dir'], { encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(dir) } }).status !== 0, true, 'not inside a git repo');
  fs.writeFileSync(path.join(dir, 'gaps.json'), '[]');
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'evil');
  fs.mkdirSync(path.join(dir, '.git'));
  agent.collect(ctx, dir, ['gaps.json'], 'detect');
  assert.ok(fs.existsSync(path.join(runDir, 'gaps.json')));
  assert.ok(!fs.existsSync(path.join(runDir, 'CLAUDE.md')) && !fs.existsSync(path.join(runDir, '.git')));
  fs.symlinkSync('/etc/hosts', path.join(dir, 'scores.json'));
  assert.throws(() => agent.collect(ctx, dir, ['scores.json'], 'rank'), /not a regular file/);
  assert.throws(() => agent.stageDir(ctx, ['../x']), /bad stage path/);
});

// protects=s1-01: agents run a read-only per-run copy of rsearch, and any change to it is detected; fails_when=an agent's Write can alter code that rsearch later runs; no_claim=root or chmod-capable processes (agents have no shell)
test('rsearch toolbox is read-only and fingerprinted', () => {
  const ctx = { runDir: tmpdir() };
  const tb = agent.toolbox(ctx);
  assert.ok(tb.rsearch.endsWith(path.join('bin', 'rsearch')) && !tb.rsearch.startsWith(ROOT));
  assert.throws(() => fs.writeFileSync(path.join(tb.dir, 'lib', 'http.js'), 'evil'), /EACCES|EPERM/);
  assert.throws(() => fs.writeFileSync(path.join(tb.dir, 'lib', 'new.js'), 'evil'), /EACCES|EPERM/);
  const out = execFileSync(tb.rsearch, ['sources'], { encoding: 'utf8' });
  assert.equal(JSON.parse(out).length, 7, 'the copy runs');
  assert.equal(agent.toolbox(ctx), tb, 'one toolbox per run');
});

// protects=s1-02: a credential pattern or an env key value in the report blocks the push; fails_when=an injected agent's copied secret is published; no_claim=secrets in formats not listed
test('secret scan before push', () => {
  const { scanSecrets } = require('../lib/stages/ship');
  assert.deepEqual(scanSecrets([['REPORT.md', 'clean text about sleep']], { NCBI_API_KEY: 'abcd1234efgh' }), []);
  assert.match(scanSecrets([['REPORT.md', 'token ghp_abcdefghijklmnopqrstuvwxyz0123456789']], {})[0], /credential pattern/);
  assert.match(scanSecrets([['brief.md', 'key abcd1234efgh here']], { NCBI_API_KEY: 'abcd1234efgh' })[0], /value of \$NCBI_API_KEY/);
  assert.match(scanSecrets([['PR body', '-----BEGIN OPENSSH PRIVATE KEY-----']], {})[0], /credential pattern/);
});

// protects=stream-json parsing yields the final result text and every tool call; plain text passes through; fails_when=findings are read from the wrong event or tool calls are lost; no_claim=future CLI event formats
test('parseStream', () => {
  const s = [
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }, { type: 'tool_use', name: 'WebSearch', input: { query: 'a' } }] } }),
    JSON.stringify({ type: 'user', message: { content: [] } }),
    JSON.stringify({ type: 'result', result: 'final {"x":1}' }),
  ].join('\n');
  const r = agent.parseStream(s);
  assert.equal(r.text, 'final {"x":1}');
  assert.deepEqual(r.tools.map((t) => t.name), ['WebSearch']);
  assert.equal(agent.parseStream('plain text').text, 'plain text');
});

// protects=paper allocation splits N by count share, gives every source ≥1, never exceeds a source's count, and sums to N; fails_when=allocation over- or under-fetches; no_claim=dedupe losses (topped up at fetch time)
test('allocate', () => {
  const a = allocate(100, [{ source: 'a', query: 'q', count: 9000 }, { source: 'b', query: 'q', count: 1000 }, { source: 'c', query: 'q', count: 3 }]);
  assert.equal(a.reduce((s, x) => s + x.n, 0), 100);
  assert.ok(a.find((x) => x.source === 'c').n >= 1 && a.find((x) => x.source === 'c').n <= 3);
  assert.ok(a.find((x) => x.source === 'a').n > a.find((x) => x.source === 'b').n);
  const small = allocate(2, [{ source: 'a', count: 10 }, { source: 'b', count: 10 }, { source: 'c', count: 10 }]);
  assert.equal(small.reduce((s, x) => s + x.n, 0), 2);
});

// protects=dedupe merges a paper found in two databases by shared id or title, keeping the longer abstract and all ids; fails_when=the same paper counts twice; no_claim=fuzzy title matching beyond normalization
test('dedupe', () => {
  const out = dedupe([
    { id: 'pmid:1', ids: { pmid: '1' }, title: 'Sleep, Memory!', abstract: 'short', citations: null, source: 'pubmed' },
    { id: 'doi:10.1000/x', ids: { doi: '10.1000/x', pmid: '1' }, title: 'Sleep memory', abstract: 'a much longer abstract', citations: 5, source: 'openalex' },
    { id: 'arxiv:2101.00001', ids: { arxiv: '2101.00001' }, title: 'sleep memory', abstract: '', citations: null, source: 'arxiv' },
    { id: 'doi:10.1000/y', ids: { doi: '10.1000/y' }, title: 'Other', abstract: 'x', citations: null, source: 'openalex' },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'doi:10.1000/x');
  assert.deepEqual(out[0].foundIn.sort(), ['arxiv', 'openalex', 'pubmed']);
  assert.equal(out[0].abstract, 'a much longer abstract');
});

// protects=AC11: lib/gloop.js fails clearly when gstack-loops is missing or lacks an export; fails_when=a missing dependency surfaces as a confusing crash mid-run; no_claim=compatibility with future gstack-loops versions
test('gloop export check', () => {
  const missing = spawnSync(process.execPath, ['-e', "require('./lib/gloop')"], { cwd: ROOT, env: { ...process.env, GSTACK_LOOPS_DIR: '/nonexistent' }, encoding: 'utf8' });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /gstack-loops not found at \/nonexistent/);
  const fake = tmpdir();
  const real = require('../lib/gloop').DIR;
  fs.mkdirSync(path.join(fake, 'lib'));
  for (const f of fs.readdirSync(path.join(real, 'lib'))) fs.copyFileSync(path.join(real, 'lib', f), path.join(fake, 'lib', f));
  fs.appendFileSync(path.join(fake, 'lib', 'review.js'), '\ndelete module.exports.ingest;\n');
  const bad = spawnSync(process.execPath, ['-e', "require('./lib/gloop')"], { cwd: ROOT, env: { ...process.env, GSTACK_LOOPS_DIR: fake }, encoding: 'utf8' });
  assert.match(bad.stderr, /lib\/review\.js has no export "ingest"/);
});

// Pre-fill the http cache with recorded responses so a CLI subprocess runs offline.
function seedCache(dir, ...names) {
  for (const n of names) {
    for (const [url, r] of Object.entries(JSON.parse(fs.readFileSync(path.join(FIX, `${n}.json`), 'utf8')))) {
      if (r.status !== 200) continue;
      const host = new URL(url).host;
      fs.mkdirSync(path.join(dir, host), { recursive: true });
      fs.writeFileSync(path.join(dir, host, `${crypto.createHash('sha256').update(url).digest('hex')}.json`), JSON.stringify({ url, status: 200, text: r.text }));
    }
  }
}

function hasGloop() {
  return spawnSync('gloop', ['--help'], { encoding: 'utf8' }).error === undefined;
}

// protects=AC1 + AC2 + AC9 through the real CLI and real gloop: `rloop new` makes feat/r-<slug> with topic.md; `rloop run` stops at the gate printing measured counts; `rloop ls`/`stats` report it; fails_when=topic loops are not gloop loops or the CLI fetches before the gate; no_claim=gloop's own behavior beyond creating the loop
test('CLI: new, run to the gate, ls, stats', { skip: !hasGloop() && 'gloop not on PATH' }, () => {
  const ws = tmpdir('rloop-ws-');
  const cache = tmpdir('rloop-cache-');
  seedCache(cache, 'openalex', 'pubmed');
  const sh = (cmd, args, extra = {}) => execFileSync(cmd, args, { cwd: ws, encoding: 'utf8', env: { ...process.env, RLOOP_CACHE: 'on', RLOOP_CACHE_DIR: cache, RLOOP_TEST_SCENARIO: 'clean', RLOOP_AGENT_BIN: path.join(__dirname, 'stub-claude.js'), ...extra } });
  sh('git', ['init', '-q', '-b', 'main']);
  sh('git', ['config', 'user.email', 't@example.com']);
  sh('git', ['config', 'user.name', 'T']);
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'loops.json'), 'utf8'));
  cfg.repos[0].name = path.basename(ws);
  fs.writeFileSync(path.join(ws, 'loops.json'), JSON.stringify(cfg));
  fs.writeFileSync(path.join(ws, '.gitignore'), '.loops/\nworktrees/\n');
  sh('git', ['add', '-A']);
  sh('git', ['commit', '-q', '-m', 'init']);
  const rloop = path.join(ROOT, 'bin', 'rloop');

  const created = sh(rloop, ['new', 'sleep and procedural memory in older adults']);
  assert.match(created, /branch=feat\/r-sleep-and-procedural-memory-in-older-adults/);
  const reg = JSON.parse(fs.readFileSync(path.join(ws, '.loops', 'registry.json'), 'utf8'));
  const tdir = path.join(ws, reg.loops['r-sleep-and-procedural-memory-in-older-adults'].worktrees[cfg.repos[0].name]);
  assert.ok(fs.existsSync(path.join(tdir, 'research', 'sleep-and-procedural-memory-in-older-adults', 'topic.md')));

  const out = sh(rloop, ['run', 'sleep-and-procedural-memory-in-older-adults', '--mode', 'bypass']);
  assert.match(out, /openalex\s+17990\s+sleep procedural memory older adults/);
  assert.match(out, /pubmed\s+2502/);
  assert.match(out, /NEEDS HUMAN \(scope-gate\).*--papers <N>/);
  assert.match(sh(rloop, ['ls']), /sleep-and-procedural-memory-in-older-adults\s+needs-human/);
  const stats = JSON.parse(sh(rloop, ['stats', '--json']));
  assert.equal(stats.runs, 1);
  assert.deepEqual(stats.needsHumanByGate, { 'scope-gate': 1 });
  assert.match(sh(rloop, ['run', 'sleep-and-procedural-memory-in-older-adults', '--papers', '50', '--dry-run']), /would run: gate → map → detect → disprove → citegate → rank → ship .*resuming/);
});

// protects=t1-01: agents get a minimal env (no GITHUB_TOKEN, AWS keys, database keys), database keys reach rsearch only via an owner-only file outside the stage dir, and rsearch refuses arguments carrying any 8-char piece of a secret; fails_when=a secret is in the agent env or can be passed through rsearch to an API or the published log; no_claim=the CLI's handling of its own auth env
test('agent env is minimal; rsearch guards secrets', () => {
  const env = agent.minimalEnv({ PATH: '/bin', HOME: '/h', GITHUB_TOKEN: 'ghp_x', AWS_SECRET_ACCESS_KEY: 'a', NCBI_API_KEY: 'k', DATABASE_URL: 'u', ANTHROPIC_API_KEY: 'sk', RLOOP_TEST_SCENARIO: 's' });
  assert.deepEqual(Object.keys(env).filter((k) => env[k] === undefined).sort(), ['AWS_SECRET_ACCESS_KEY', 'DATABASE_URL', 'GITHUB_TOKEN', 'NCBI_API_KEY']);
  const { leaksSecret } = require('../bin/rsearch');
  const e = { GH_TOKEN: 'ghp_abcdefghijklmnop', HOME: '/Users/someone/long/path' };
  assert.equal(leaksSecret(['search', 'openalex', 'sleep memory'], e), null);
  assert.equal(leaksSecret(['count', 'openalex', 'x defghijk y'], e), 'GH_TOKEN', 'any 8-char window');
  assert.equal(leaksSecret(['count', 'openalex', '/Users/someone/long/path'], e), null, 'non-secret names ignored');
  const prev = process.env.NCBI_API_KEY;
  process.env.NCBI_API_KEY = 'ncbi-secret-123';
  try {
    const ctx = { runDir: tmpdir() };
    const tb = agent.toolbox(ctx);
    assert.equal(fs.statSync(tb.keys).mode & 0o777, 0o400);
    assert.deepEqual(JSON.parse(fs.readFileSync(tb.keys, 'utf8')), { NCBI_API_KEY: 'ncbi-secret-123' });
    agent.cleanup(ctx);
    assert.ok(!fs.existsSync(tb.dir), 't1-03: toolbox removed despite read-only modes');
  } finally {
    if (prev === undefined) delete process.env.NCBI_API_KEY; else process.env.NCBI_API_KEY = prev;
  }
});
