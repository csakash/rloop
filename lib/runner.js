// The research stage runner: an ordered list of stages over one run directory, status.json
// after every stage, and one history record per run. The shape follows gloop's stage runner
// (lib/pipeline.js there); the stages are research-specific.
const fs = require('fs');
const path = require('path');
const gloop = require('./gloop');
const { Blocked, NeedsHuman, loadSeals } = require('./runctx');
const { cleanup } = require('./agent');
const { scope, gate } = require('./stages/scope');
const { map } = require('./stages/map');
const { detect } = require('./stages/detect');
const { disprove } = require('./stages/disprove');
const citegateStage = require('./stages/citegate');
const { rank } = require('./stages/rank');
const { ship } = require('./stages/ship');

const { readJSON, writeJSON, c } = gloop.util;
const STAGES = ['scope', 'gate', 'map', 'detect', 'disprove', 'citegate', 'rank', 'ship'];
const HISTORY = 'research-history.json';

function historyPath(root) {
  return path.join(root, '.loops', HISTORY);
}

// One record per run directory: a resumed run (gate, then --papers, then ship) replaces its
// earlier record instead of adding another.
function upsertHistory(root, rec) {
  const h = readJSON(historyPath(root), { runs: [] });
  if (!Array.isArray(h.runs)) h.runs = [];
  const i = h.runs.findIndex((r) => r.slug === rec.slug && r.run === rec.run);
  if (i >= 0) h.runs[i] = { ...rec, firstStartedAt: h.runs[i].firstStartedAt || h.runs[i].startedAt };
  else h.runs.push({ ...rec, firstStartedAt: rec.startedAt });
  writeJSON(historyPath(root), h);
}

function loadHistory(root) {
  const h = readJSON(historyPath(root), { runs: [] });
  return Array.isArray(h.runs) ? h.runs : [];
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function newRun(ctx) {
  ctx.runDir = path.join(ctx.runsDir, stamp());
  fs.mkdirSync(ctx.runDir, { recursive: true });
  fs.copyFileSync(ctx.topicFile, path.join(ctx.runDir, 'topic.md'));
  const latest = path.join(ctx.runsDir, 'latest');
  try { fs.rmSync(latest, { force: true }); fs.symlinkSync(path.basename(ctx.runDir), latest); } catch { /* best effort */ }
}

function status(ctx) {
  return readJSON(path.join(ctx.runDir, 'status.json'), null);
}

function mark(ctx, patch) {
  const file = path.join(ctx.runDir, 'status.json');
  const cur = readJSON(file, { slug: ctx.slug, mode: ctx.mode, startedAt: new Date().toISOString(), stages: {} });
  const next = { ...cur, ...patch, stages: { ...cur.stages, ...(patch.stages || {}) }, updatedAt: new Date().toISOString() };
  writeJSON(file, next);
  return next;
}

// Which stages to run. A run parked at the paper-count gate resumes after scope when a
// count is given; a run parked before push resumes at ship.
function plan(ctx, prev) {
  if (prev && prev.outcome === 'needs-human' && prev.blockedGate === 'scope-gate') return STAGES.slice(STAGES.indexOf('gate'));
  if (prev && prev.outcome === 'needs-human' && prev.blockedGate === 'push') return ['ship'];
  return STAGES;
}

async function runStage(ctx, name) {
  switch (name) {
    case 'scope': return scope(ctx);
    case 'gate': return gate(ctx);
    case 'map': return map(ctx);
    case 'detect': return detect(ctx);
    case 'disprove': return disprove(ctx);
    case 'citegate': return citegateStage.stage(ctx);
    case 'rank': return rank(ctx);
    case 'ship': return ship(ctx);
    default: throw new Error(`unknown stage ${name}`);
  }
}

// ctx: { root, slug, topicTitle, topicFile, topicDir, runsDir, mode, opts, fixCycles,
//        research, thresholds, baseBranch, log, resume }
async function runResearch(ctx) {
  const prevDir = ctx.resume ? ctx.resume : null;
  const prev = prevDir ? readJSON(path.join(prevDir, 'status.json'), null) : null;
  const stages = plan(ctx, prev);
  if (stages === STAGES) newRun(ctx); else ctx.runDir = prevDir;
  // One search-log key and one seal map per run, kept across resumes. Both live in the run dir,
  // which no agent can reach (agents work in their own stage dirs).
  const keyFile = path.join(ctx.runDir, '.logkey');
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, require('crypto').randomBytes(32).toString('hex'), { mode: 0o600 });
  ctx.logKey = fs.readFileSync(keyFile, 'utf8').trim();
  loadSeals(ctx);
  ctx.log(c.bold(`▶ rloop ${ctx.slug}  mode=${ctx.mode}  run=${path.basename(ctx.runDir)}`));
  mark(ctx, { outcome: 'running', blockedGate: null, message: null });

  const results = {};
  let outcome = 'shipped';
  let blockedGate = null;
  let message = null;
  // Ctrl-C / kill: remove the temp dirs (the toolbox holds keys.json) before exiting.
  const onSignal = (sig) => {
    cleanup(ctx);
    try { mark(ctx, { outcome: 'blocked', blockedGate: 'interrupted', message: `interrupted by ${sig}` }); } catch { /* best effort */ }
    process.exit(128 + (require('os').constants.signals[sig] || 2));
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    for (const name of stages) {
      ctx.log(c.cyan(`■ ${name}`));
      mark(ctx, { stage: name, stages: { [name]: { status: 'running', at: new Date().toISOString() } } });
      try {
        results[name] = (await runStage(ctx, name)) || {};
        mark(ctx, { stages: { [name]: { status: 'done', at: new Date().toISOString(), result: results[name] } } });
      } catch (e) {
        if (e instanceof NeedsHuman) { outcome = 'needs-human'; blockedGate = e.gate; message = e.message; } else if (e instanceof Blocked) { outcome = 'blocked'; blockedGate = e.gate; message = e.message; } else { outcome = 'blocked'; blockedGate = e.gate || name; message = `${name} crashed: ${e.message}`; }
        mark(ctx, { stages: { [name]: { status: outcome, at: new Date().toISOString(), note: message } } });
        break;
      }
    }
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    cleanup(ctx);
  }
  const final = mark(ctx, { outcome, blockedGate, message, finishedAt: new Date().toISOString(), pr: results.ship ? results.ship.pr : undefined });
  if (outcome === 'blocked') ctx.log(c.red(`BLOCKED: ${message}`));
  else if (outcome === 'needs-human') ctx.log(c.yellow(`NEEDS HUMAN (${blockedGate}): ${message}`));
  else ctx.log(c.green(`✓ shipped: ${results.ship.pr}`));

  const all = Object.values(final.stages || {});
  const d = (final.stages.disprove && final.stages.disprove.result) || {};
  const cg = (final.stages.citegate && final.stages.citegate.result) || {};
  const sel = readJSON(path.join(ctx.runDir, 'selection.json'), {});
  upsertHistory(ctx.root, {
    slug: ctx.slug, mode: ctx.mode, run: path.basename(ctx.runDir), startedAt: final.startedAt, finishedAt: final.finishedAt,
    stagesRun: stages, outcome, blockedGate, message,
    papers: sel.papers || null, sources: sel.sources || null,
    cycles: d.cycles ? { disprove: d.cycles } : {},
    gaps: d.proposed !== undefined ? { proposed: d.proposed, killed: d.killed, survived: d.survived } : null,
    citations: cg.citations || null,
    pr: final.pr || null,
    stagesDone: all.filter((s) => s.status === 'done').length,
  });
  return final;
}

function stats(root) {
  const runs = loadHistory(root);
  const base = gloop.history.computeStats(runs);
  const withGaps = runs.filter((r) => r.gaps && r.gaps.proposed);
  const proposed = withGaps.reduce((a, r) => a + r.gaps.proposed, 0);
  const survived = withGaps.reduce((a, r) => a + r.gaps.survived, 0);
  const cit = runs.filter((r) => r.citations);
  const checked = cit.reduce((a, r) => a + r.citations.checked, 0);
  const failed = cit.reduce((a, r) => a + r.citations.failed, 0);
  return {
    runs: base.total,
    outcomes: base.outcomes,
    blockedByGate: base.blockedByGate,
    needsHumanByGate: runs.filter((r) => r.outcome === 'needs-human').reduce((o, r) => { o[r.blockedGate] = (o[r.blockedGate] || 0) + 1; return o; }, {}),
    gaps: { proposed, survived, survivalPct: proposed ? Math.round((100 * survived) / proposed) : null },
    citations: { checked, failed, failurePct: checked ? Math.round((1000 * failed) / checked) / 10 : null },
  };
}

module.exports = { STAGES, HISTORY, runResearch, plan, mark, status, stats, loadHistory, historyPath };
