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
  process.env.STUB_SCENARIO = scenario;
  const dir = workspace();
  const { ctx } = ctxFor(dir, { opts: { papers: 6, sources: null }, ...over });
  const final = await runner.runResearch(ctx);
  return { dir, ctx, final };
}

// protects=AC2: with no paper count the run stops needs-human at the scope gate with measured counts per source, and a later --papers resumes the same run; fails_when=papers are fetched before a human picks the count, or resume re-runs scope; no_claim=real agent's source choice
test('scope gate stops, then resumes with --papers', async () => {
  process.env.STUB_SCENARIO = 'clean';
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
  assert.deepEqual(sel, { papers: 6, sources: ['openalex', 'pubmed'] });
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
  assert.deepEqual(h.gaps, { proposed: 2, killed: 1, survived: 1 });
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
