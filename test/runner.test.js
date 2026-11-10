// End-to-end runner tests: real stages and gates, a stub agent binary, fake databases.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { tmpdir } = require('./helpers');
const sources = require('../lib/sources');
const runner = require('../lib/runner');
const { DEFAULT_RESEARCH } = require('../lib/workspace');

process.env.RLOOP_AGENT_BIN = path.join(__dirname, 'stub-claude.js');

// Fake databases: deterministic papers, counts, and resolution of the stub's citations.
const PAPERS = (src, n) => Array.from({ length: n }, (_, i) => ({
  id: `doi:10.4242/${src}.${i}`, ids: { doi: `10.4242/${src}.${i}` }, title: `${src} paper ${i}`,
  abstract: `Study ${i} of sleep and procedural memory in older adults found overnight gains in motor sequence learning.`,
  year: 2020, venue: 'J', citations: 1, source: src,
}));
for (const name of ['openalex', 'pubmed']) {
  const s = sources.SOURCES[name];
  s.count = async () => (name === 'openalex' ? 500 : 100);
  s.search = async (q, { limit }) => ({ total: 500, papers: PAPERS(name, limit) });
}
const fakeResolve = async (kind, value) => (/^10\.(5555|7777|4242)\//.test(value) ? { ok: true, title: `T ${value}` } : { ok: false, status: 404 });
sources.SOURCES.crossref.resolve = fakeResolve;
sources.SOURCES.openalex.resolve = fakeResolve;

function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
}

function workspace() {
  const dir = tmpdir();
  git(dir, 'init', '-q', '-b', 'feat/r-t');
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  fs.mkdirSync(path.join(dir, 'research', 't'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'research', 't', 'topic.md'), '# sleep and procedural memory in older adults\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), '.loops/\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

function ctxFor(dir, over = {}) {
  const logs = [];
  return {
    ctx: {
      root: dir, slug: 't', topicTitle: 'sleep and procedural memory in older adults',
      topicFile: path.join(dir, 'research', 't', 'topic.md'), topicDir: dir,
      runsDir: path.join(dir, '.loops', 'runs', 'r-t'), mode: 'bypass', fixCycles: 2, baseBranch: 'main',
      research: DEFAULT_RESEARCH, thresholds: DEFAULT_RESEARCH.disprove,
      opts: { papers: null, sources: null }, log: (m) => logs.push(m), ...over,
    },
    logs,
  };
}

async function fullRun(scenario, over = {}) {
  process.env.RLOOP_TEST_SCENARIO = scenario;
  const dir = workspace();
  const { ctx } = ctxFor(dir, { opts: { papers: 6, sources: null }, ...over });
  const final = await runner.runResearch(ctx);
  return { dir, ctx, final };
}

// protects=AC2: with no paper count the run stops needs-human at the scope gate with measured counts per source, and a later --papers resumes the same run; fails_when=papers are fetched before a human picks the count, or resume re-runs scope; no_claim=real agent's source choice
test('scope gate stops, then resumes with --papers', async () => {
  process.env.RLOOP_TEST_SCENARIO = 'clean';
  const dir = workspace();
  const first = ctxFor(dir);
  const st = await runner.runResearch(first.ctx);
  assert.equal(st.outcome, 'needs-human');
  assert.equal(st.blockedGate, 'scope-gate');
  const rows = JSON.parse(fs.readFileSync(path.join(first.ctx.runDir, 'sources.json'), 'utf8'));
  assert.deepEqual(rows.map((r) => [r.source, r.count]), [['openalex', 500], ['pubmed', 100]]);
  assert.ok(!fs.existsSync(path.join(first.ctx.runDir, 'papers.jsonl')), 'nothing fetched before the gate');

  const second = ctxFor(dir, { opts: { papers: 6, sources: null }, resume: first.ctx.runDir });
  const st2 = await runner.runResearch(second.ctx);
  assert.equal(second.ctx.runDir, first.ctx.runDir, 'same run resumed');
  assert.ok(!st2.stages.scope || st2.stages.scope.status === 'done');
  assert.equal(st2.outcome, 'needs-human');
  assert.equal(st2.blockedGate, 'push');
  const sel = JSON.parse(fs.readFileSync(path.join(first.ctx.runDir, 'selection.json'), 'utf8'));
  assert.deepEqual(sel, { papers: 6, sources: ['openalex', 'pubmed'], split: [{ source: 'openalex', n: 4 }, { source: 'pubmed', n: 2 }] });
});

// protects=AC3: a bypass run goes through every stage, kills g02 via a cited prior work, keeps g01 with its weakens caveat, writes REPORT.md, commits it, and stops before push; fails_when=a killed gap survives, the report is missing, or bypass pushes; no_claim=report prose quality
test('bypass run end to end', async () => {
  const { dir, ctx, final } = await fullRun('kill-g02');
  assert.equal(final.outcome, 'needs-human', final.message);
  assert.equal(final.blockedGate, 'push');
  for (const s of ['map', 'detect', 'disprove', 'citegate', 'rank']) assert.equal(final.stages[s].status, 'done', s);
  const gaps = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'gaps.json'), 'utf8'));
  assert.equal(gaps.find((g) => g.id === 'g02').status, 'dropped');
  const g01 = gaps.find((g) => g.id === 'g01');
  assert.equal(g01.status, 'survived');
  assert.equal(g01.rank, 1);
  assert.equal(g01.score, 4 * 3 * 4 * 5);
  const report = fs.readFileSync(path.join(ctx.runDir, 'REPORT.md'), 'utf8');
  assert.match(report, /Narrow to adults over 70/);
  assert.match(report, /Dropped gaps/);
  assert.match(report, /doi:10\.5555\/prior/);
  assert.match(git(dir, 'log', '-1', '--name-only'), /research\/t\/REPORT\.md/);
  const cites = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'proof', 'citations.json'), 'utf8'));
  assert.ok(cites.every((c) => c.resolved));
  const tools = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'disprove', 'cycle-1.tools.json'), 'utf8'));
  assert.equal(tools.web.length, 1, 'web tool calls counted from stream-json');
  const h = runner.loadHistory(dir).pop();
  assert.deepEqual(h.gaps, { proposed: 2, killed: 1, survived: 1, narrowed: 0 });
});

// protects=AC6: a disprover that changes any file in the run dir blocks the run; fails_when=a writing reviewer goes unnoticed; no_claim=tool permissions of the real CLI (checked separately in agent args)
test('reviewer modifying the tree blocks', async () => {
  const { final } = await fullRun('modify-tree');
  assert.equal(final.outcome, 'blocked');
  assert.equal(final.blockedGate, 'disprove');
  assert.equal(final.message, 'reviewer modified tree');
});

// protects=AC7: kill findings still open after fixCycles block with the convergence message and ids; fails_when=the loop cycles forever or ships with an open kill; no_claim=none beyond protects
test('non-convergence blocks after fixCycles', async () => {
  const { final } = await fullRun('never-converge');
  assert.equal(final.outcome, 'blocked');
  assert.equal(final.message, 'disprove did not converge after 2 cycles: open d3-01');
});

// protects=AC5 end to end: a disprover that searched 3 times per gap is caught by citegate; fails_when=thin searching reaches the report; no_claim=none beyond protects
test('thin disprover search blocks at citegate', async () => {
  const { final } = await fullRun('thin');
  assert.equal(final.outcome, 'blocked');
  assert.equal(final.blockedGate, 'citegate');
  assert.match(final.message, /disprover ran 3 queries/);
});

// protects=AC8 (no-remote half): autonomous mode without an origin remote blocks at ship, after committing; fails_when=it pushes somewhere or claims success; no_claim=the PR path with a real remote (live run)
test('autonomous without origin blocks at ship', async () => {
  const { dir, final } = await fullRun('clean', { mode: 'autonomous' });
  assert.equal(final.outcome, 'blocked');
  assert.equal(final.message, 'no origin remote');
  assert.match(git(dir, 'log', '-1', '--format=%s'), /^research: t gap report/);
});

// protects=r1-03 under the stage sandbox: an agent appending a fake paper to its copy of papers.jsonl changes nothing in the run, because only declared outputs come back; fails_when=a stage's input copy flows back into the run dir; no_claim=the CLI's own file-rule enforcement
test('agent edits to stage inputs never reach the run', async () => {
  const { ctx, final } = await fullRun('tamper-papers');
  assert.equal(final.outcome, 'needs-human', final.message);
  assert.ok(!fs.readFileSync(path.join(ctx.runDir, 'papers.jsonl'), 'utf8').includes('10.6666/fake'));
});

// protects=r1-03 seal check still guards the run dir itself; fails_when=a changed runner-owned file goes unnoticed; no_claim=none beyond protects
test('a changed runner-owned file blocks', () => {
  const { seal, verifySeals } = require('../lib/runctx');
  const ctx = { runDir: tmpdir() };
  fs.writeFileSync(path.join(ctx.runDir, 'papers.jsonl'), 'a\n');
  seal(ctx, 'papers.jsonl');
  fs.appendFileSync(path.join(ctx.runDir, 'papers.jsonl'), 'b\n');
  assert.throws(() => verifySeals(ctx, 'detect'), /runner-owned file changed by an agent: papers.jsonl/);
});

// protects=r1-03: unsigned search-log entries written by an author do not count toward disprover coverage; fails_when=forged entries satisfy the 10-query bar; no_claim=an agent that can read the process env (denied by tool permissions)
test('forged search-log entries do not count', async () => {
  const { ctx, final } = await fullRun('forge-log');
  assert.equal(final.outcome, 'blocked');
  assert.equal(final.blockedGate, 'citegate');
  assert.match(final.message, /g01: disprover ran 3 queries/);
  assert.ok(fs.readFileSync(path.join(ctx.runDir, 'search-log.jsonl'), 'utf8').includes('forged'));
});

// protects=r1-02: an author edit to a gap it did not rebut (never re-reviewed) is discarded and recorded; fails_when=a survivor carries a question the disprover never saw; no_claim=quality of legitimate narrowing edits
test('edits to unreviewed gaps are ignored', async () => {
  const { ctx, final } = await fullRun('edit-unreviewed');
  assert.equal(final.outcome, 'needs-human', final.message);
  const g01 = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'gaps.json'), 'utf8')).find((g) => g.id === 'g01');
  assert.match(g01.question, /^Does enhancing slow-wave sleep/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'disprove', 'ignored-edits.json'), 'utf8')), [{ round: 1, gap: 'g01' }]);
});

// protects=r1-04: a rejected resolution gets another resolve round with the reason, within fixCycles, instead of blocking; fails_when=one bad resolution file ends the run as non-converged; no_claim=none beyond protects
test('rejected resolution is retried next round', async () => {
  const { ctx, final } = await fullRun('bad-resolution');
  assert.equal(final.outcome, 'needs-human', final.message);
  assert.equal(final.stages.disprove.result.cycles, 1, 'r1-06: no extra disprove cycle counted');
  const gaps = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'gaps.json'), 'utf8'));
  assert.equal(gaps.find((g) => g.id === 'g02').status, 'dropped');
  assert.ok(fs.existsSync(path.join(ctx.runDir, 'disprove', 'resolutions-2.json')));
});

// protects=r1-05: a run stopped at the gate and resumed leaves one history record, not two; fails_when=stats double-count resumed runs; no_claim=none beyond protects
test('history keeps one record per run', async () => {
  process.env.RLOOP_TEST_SCENARIO = 'clean';
  const dir = workspace();
  const first = ctxFor(dir);
  await runner.runResearch(first.ctx);
  await runner.runResearch(ctxFor(dir, { opts: { papers: 6, sources: null }, resume: first.ctx.runDir }).ctx);
  const runs = runner.loadHistory(dir);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].blockedGate, 'push');
  assert.equal(runner.stats(dir).runs, 1);
});

// protects=r2-03: ship commits only runner-sealed proof files and the verified search log; forged log lines and stray agent files never reach the PR; fails_when=unsigned entries or agent-dropped files are committed as proof; no_claim=none beyond protects
test('ship commits only verified proof', async () => {
  const { dir, ctx, final } = await fullRun('kill-g02');
  assert.equal(final.blockedGate, 'push');
  const out = path.join(dir, 'research', 't');
  const shipped = fs.readFileSync(path.join(out, 'search-log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(shipped.length >= 20 && shipped.every((e) => /^[0-9a-f]{64}$/.test(e.sig)));
  assert.ok(fs.existsSync(path.join(out, 'proof', 'citations.json')));
  assert.ok(fs.existsSync(path.join(out, 'disprove', 'cycle-1.json')));
  assert.ok(!fs.existsSync(path.join(out, 'disprove', 'open-1.json')) || ctx.seals.has('disprove/open-1.json'));
});

// protects=s2-01/s3-01: a CLAUDE.md (or .claude/, .git) an agent writes stays in its own stage dir, which is deleted; the next agent never sees it; fails_when=undeclared files flow back to the run dir; no_claim=what the CLI loads inside one stage (--safe-mode)
test('planted CLI config never reaches a later stage', async () => {
  const { ctx, final } = await fullRun('plant-config');
  assert.equal(final.outcome, 'needs-human', final.message);
  const all = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else all.push(p); } })(ctx.runDir);
  assert.ok(!all.some((f) => /CLAUDE\.md$/.test(f)));
});

// protects=s2-02: the pre-push scan covers branch history, so a secret committed by an earlier run and later overwritten still blocks the push; fails_when=only the working tree is scanned; no_claim=encoded or split secrets
test('secret in branch history blocks push', async () => {
  const { push } = require('../lib/stages/ship');
  const dir = workspace();
  const out = path.join(dir, 'research', 't');
  fs.writeFileSync(path.join(out, 'brief.md'), 'leaked ghp_abcdefghijklmnopqrstuvwxyz0123456789\n');
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'run 1');
  fs.writeFileSync(path.join(out, 'brief.md'), 'clean\n');
  fs.writeFileSync(path.join(out, 'REPORT.md'), '# clean\n');
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'run 2');
  git(dir, 'branch', 'base', 'HEAD~2');
  const bare = tmpdir();
  execFileSync('git', ['init', '-q', '--bare', bare]);
  git(dir, 'remote', 'add', 'origin', bare);
  const runDir = tmpdir();
  fs.writeFileSync(path.join(runDir, 'REPORT.md'), '# clean\n');
  assert.throws(() => push({ topicDir: dir, slug: 't', runDir, baseBranch: 'base', topicTitle: 't' }), /possible secret in the report, not pushing: commits base\.\.HEAD matches a credential pattern/);
});

// protects=t1-04: the search-log key and seal map survive a resume, so a run parked at the gate keeps its signed entries and `rloop ship` still knows which proof files are runner-written; t1-02: the disprover gets topic.md, not the agent-written brief.md; fails_when=resume re-keys the log or loses seals; no_claim=none beyond protects
test('resume keeps the log key and seals; disprover never sees brief.md', async () => {
  process.env.RLOOP_TEST_SCENARIO = 'clean';
  const dir = workspace();
  const first = ctxFor(dir);
  await runner.runResearch(first.ctx);
  const key1 = fs.readFileSync(path.join(first.ctx.runDir, '.logkey'), 'utf8');
  assert.equal(fs.statSync(path.join(first.ctx.runDir, '.logkey')).mode & 0o777, 0o600);
  const second = ctxFor(dir, { opts: { papers: 6, sources: null }, resume: first.ctx.runDir });
  await runner.runResearch(second.ctx);
  assert.equal(second.ctx.logKey, key1);
  const seals = JSON.parse(fs.readFileSync(path.join(first.ctx.runDir, '.seals.json'), 'utf8'));
  assert.ok(seals['proof/citations.json'] && seals['sources.json']);
  const prompt = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'disprove.md'), 'utf8');
  assert.ok(!prompt.includes('brief.md') && prompt.includes('topic.md'));
});

// protects=rloop-quality AC4: a partly answered gap (weakens + cited answering work) forces a resolve round; the author narrows it, the narrowed question goes back to the disprover (cycle 2 clean), and the gap survives with the new question, narrowedFrom, and a "Narrowed from" section in REPORT.md; fails_when=a partly answered gap keeps its over-broad question or skips re-review; no_claim=quality of the real author's narrowing
test('partly answered gap is narrowed and re-checked', async () => {
  const { ctx, final } = await fullRun('narrow');
  assert.equal(final.outcome, 'needs-human', final.message);
  assert.equal(final.stages.disprove.result.cycles, 2, 'narrowed gap re-reviewed');
  assert.equal(final.stages.disprove.result.narrowed, 1);
  const g01 = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'gaps.json'), 'utf8')).find((g) => g.id === 'g01');
  assert.equal(g01.status, 'survived');
  assert.match(g01.question, /finger-tapping gains in adults aged 60-80 \(round 1\)/);
  assert.match(g01.narrowedFrom, /^Does enhancing slow-wave sleep/);
  const review2 = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'disprove', 'review-2.json'), 'utf8'));
  assert.deepEqual(review2.map((g) => g.question), [g01.question], 'disprover saw the narrowed question');
  const report = fs.readFileSync(path.join(ctx.runDir, 'REPORT.md'), 'utf8');
  assert.match(report, /\*\*Narrowed from:\*\* Does enhancing slow-wave sleep/);
  assert.match(report, /narrowed to their open part: 1/);
  // q1-01: the narrowing finding is not repeated as a caveat; the verdict names the narrowed question
  assert.match(report, /no work found that answers the narrowed question/);
  assert.doesNotMatch(report, /Caveats raised by the disprover[\s\S]*coupling half is answered[\s\S]*### /);
  assert.equal(final.stages.disprove.result.findings.narrowing, 1, 'q1-02: counted once');
  // AC3 end to end: g01 had a finding, so it needed 15 searches (the stub ran 15 per cycle).
  const cov = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'proof', 'search-coverage.json'), 'utf8')).gaps;
  assert.deepEqual(cov.g01.required, { queries: 15, sources: 3 });
  assert.deepEqual(cov.g02.required, { queries: 10, sources: 3 });
});

// protects=rloop-quality AC5: "narrowed" with an unchanged question is rejected and stays open; at the cap an open narrowing does not block (gap flagged incomplete), unlike an open kill; fails_when=a no-op narrowing is accepted, or narrowing blocks the whole run; no_claim=none beyond protects
test('narrowing: unchanged question rejected; incomplete at cap does not block', async () => {
  const { ctx, final } = await fullRun('narrow-unchanged');
  assert.equal(final.outcome, 'needs-human', final.message);
  const g01 = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'gaps.json'), 'utf8')).find((g) => g.id === 'g01');
  assert.equal(g01.narrowing, 'incomplete');
  assert.deepEqual(g01.openNarrowing, ['d1-01']);
  assert.equal(g01.narrowedFrom, undefined);
  const prev = fs.readFileSync(path.join(ctx.runDir, 'disprove', 'resolutions-2.json'), 'utf8');
  assert.ok(prev.includes('narrowed'), 'author got a second round');
  assert.match(fs.readFileSync(path.join(ctx.runDir, 'REPORT.md'), 'utf8'), /\*\*Narrowing incomplete:\*\*/);
  const stuck = await fullRun('narrow-stuck');
  assert.equal(stuck.final.outcome, 'needs-human', stuck.final.message);
  const s01 = JSON.parse(fs.readFileSync(path.join(stuck.ctx.runDir, 'gaps.json'), 'utf8')).find((g) => g.id === 'g01');
  assert.equal(s01.narrowing, 'incomplete');
  assert.ok(s01.narrowedFrom, 'narrowed twice but still asked to narrow');
});
