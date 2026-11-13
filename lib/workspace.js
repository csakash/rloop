// Where things live: the workspace root (main checkout holding loops.json), each topic's
// gloop loop and worktree, rloop's research settings, and run directories.
const fs = require('fs');
const path = require('path');
const gloop = require('./gloop');

const { run, readJSON } = gloop.util;
const LOOP_PREFIX = 'r-';
const DEFAULT_RESEARCH = { disprove: { minQueries: 10, minSources: 3, extraQueriesIfFinding: 5 }, signals: {} };

// The main checkout, even when called from inside a worktree (which carries its own copy
// of loops.json): resolve git's common dir and take its parent.
function findRoot(cwd = process.cwd()) {
  const common = run('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { allowFail: true });
  if (common) {
    const main = path.dirname(common);
    if (fs.existsSync(path.join(main, 'loops.json'))) return main;
  }
  const r = gloop.config.findWorkspaceRoot(cwd);
  if (!r) throw new Error('No loops.json found. Run rloop from inside a clone of rloop (or a workspace set up with gloop init).');
  return r;
}

function loadSettings(root) {
  const cfg = readJSON(path.join(root, 'loops.json'), {});
  const research = cfg.research || {};
  const repo = (cfg.repos || [])[0] || {};
  return {
    cfg: { ...cfg, root },
    repoName: repo.name,
    baseBranch: repo.baseBranch || 'main',
    fixCycles: (cfg.review && Number.isInteger(cfg.review.fixCycles)) ? cfg.review.fixCycles : 2,
    research: { ...DEFAULT_RESEARCH, ...research, disprove: { ...DEFAULT_RESEARCH.disprove, ...(research.disprove || {}) } },
  };
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '');
}

function loopName(slug) {
  return `${LOOP_PREFIX}${slug}`;
}

function topicDir(root, slug) {
  const s = loadSettings(root);
  const loop = gloop.registry.getLoop(s.cfg, loopName(slug));
  if (!loop) return null;
  const rel = loop.worktrees && (loop.worktrees[s.repoName] || Object.values(loop.worktrees)[0]);
  return rel ? path.resolve(root, rel) : null;
}

function topics(root) {
  const s = loadSettings(root);
  const reg = gloop.registry.load ? gloop.registry.load(s.cfg) : { loops: {} };
  return Object.keys(reg.loops || {}).filter((k) => k.startsWith(LOOP_PREFIX)).map((k) => k.slice(LOOP_PREFIX.length));
}

function runsDir(tdir, slug) {
  return path.join(tdir, '.loops', 'runs', loopName(slug));
}

function latestRun(tdir, slug) {
  const dir = runsDir(tdir, slug);
  if (!fs.existsSync(dir)) return null;
  const runs = fs.readdirSync(dir).filter((d) => d !== 'latest' && fs.statSync(path.join(dir, d)).isDirectory()).sort();
  return runs.length ? path.join(dir, runs[runs.length - 1]) : null;
}

module.exports = { LOOP_PREFIX, DEFAULT_RESEARCH, findRoot, loadSettings, slugify, loopName, topicDir, topics, runsDir, latestRun };
