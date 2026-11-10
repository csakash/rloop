// ship: no LLM. Commit the report into the topic branch; push and open a PR only in
// autonomous mode (or after a yes in interactive mode, or via `rloop ship`).
const fs = require('fs');
const path = require('path');
const gloop = require('../gloop');
const { Blocked, NeedsHuman, ask } = require('../runctx');

const { run } = gloop.util;
const COPY = ['REPORT.md', 'gaps.json', 'claims.jsonl', 'papers.jsonl', 'sources.json', 'brief.md', 'fetch.json', 'signals.json'];
const PROOF_DIRS = ['proof', 'disprove'];
const MAX_BODY = 60000; // GitHub caps PR bodies at 65536 chars

function git(ctx, args, opts = {}) {
  return run('git', ['-C', ctx.topicDir, ...args], opts);
}

function copyOut(ctx) {
  const dest = path.join(ctx.topicDir, 'research', ctx.slug);
  fs.mkdirSync(dest, { recursive: true });
  for (const f of COPY) {
    const src = path.join(ctx.runDir, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, f));
  }
  // Only runner-written (sealed) proof files ship; anything else an agent dropped there does not.
  for (const rel of ctx.seals ? ctx.seals.keys() : []) {
    if (!PROOF_DIRS.some((d) => rel.startsWith(`${d}/`)) || !fs.existsSync(path.join(ctx.runDir, rel))) continue;
    fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true });
    fs.copyFileSync(path.join(ctx.runDir, rel), path.join(dest, rel));
  }
  // The search log ships as verified: only entries signed in this run.
  if (fs.existsSync(path.join(ctx.runDir, 'search-log.verified.jsonl'))) fs.copyFileSync(path.join(ctx.runDir, 'search-log.verified.jsonl'), path.join(dest, 'search-log.jsonl'));
  return dest;
}

function commit(ctx) {
  const dest = copyOut(ctx);
  git(ctx, ['add', path.relative(ctx.topicDir, dest)]);
  const staged = git(ctx, ['diff', '--cached', '--name-only']);
  if (staged) git(ctx, ['commit', '-q', '-m', `research: ${ctx.slug} gap report\n\nRun ${path.basename(ctx.runDir)}`]);
  return dest;
}

function prBody(ctx) {
  const report = fs.readFileSync(path.join(ctx.runDir, 'REPORT.md'), 'utf8');
  const proof = [
    '', '---', '## Proof', '',
    `- Citations: \`research/${ctx.slug}/proof/citations.json\` (every id resolved by code)`,
    `- Quotes: \`research/${ctx.slug}/proof/quotes.json\` (matched against abstracts)`,
    `- Disprover search coverage: \`research/${ctx.slug}/proof/search-coverage.json\`, verified search log \`research/${ctx.slug}/search-log.jsonl\``,
    `- Disprove cycles and resolutions: \`research/${ctx.slug}/disprove/\``,
    '', '## How to revert', '', 'Close this PR, or revert its single commit; it only adds files under `research/`.',
  ].join('\n');
  const room = MAX_BODY - proof.length - 200;
  const body = report.length > room ? `${report.slice(0, room)}\n\n…(truncated; full report in research/${ctx.slug}/REPORT.md)` : report;
  return `${body}\n${proof}\n`;
}

// Never publish a secret an injected agent copied into the report. Checks every file that
// would be pushed plus the PR body for common credential shapes and for the values of
// key-like environment variables.
const SECRET_RES = [
  /gh[pousr]_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{40,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /sk-ant-[A-Za-z0-9_-]{20,}/, /sk-[A-Za-z0-9]{32,}/, /xox[abpr]-[A-Za-z0-9-]{10,}/, /AIza[0-9A-Za-z_-]{35}/,
];

function scanSecrets(texts, env = process.env) {
  const vals = Object.entries(env).filter(([k, v]) => /(KEY|TOKEN|SECRET|PASSWORD)$/i.test(k) && typeof v === 'string' && v.length >= 8);
  const hits = [];
  for (const [name, text] of texts) {
    for (const re of SECRET_RES) if (re.test(text)) hits.push(`${name} matches a credential pattern`);
    for (const [k, v] of vals) if (text.includes(v)) hits.push(`${name} contains the value of $${k}`);
  }
  return hits;
}

function filesUnder(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else out.push(p);
    }
  })(dir);
  return out;
}

// Push the topic branch and open (or reuse) its PR. Returns the PR URL.
function push(ctx) {
  const body = prBody(ctx);
  const dest = path.join(ctx.topicDir, 'research', ctx.slug);
  const hits = scanSecrets([['PR body', body], ...filesUnder(dest).map((f) => [path.relative(ctx.topicDir, f), fs.readFileSync(f, 'utf8')])]);
  if (hits.length) throw new Blocked('ship', `possible secret in the report, not pushing: ${hits.slice(0, 3).join('; ')}`);
  const origin = git(ctx, ['remote', 'get-url', 'origin'], { allowFail: true, stdio: ['ignore', 'pipe', 'ignore'] });
  if (!origin) throw new Blocked('ship', 'no origin remote');
  const branch = git(ctx, ['branch', '--show-current']);
  git(ctx, ['push', '-q', '-u', 'origin', branch]);
  const existing = run('gh', ['pr', 'view', branch, '--json', 'url', '-q', '.url'], { cwd: ctx.topicDir, allowFail: true });
  if (existing) return existing;
  const bodyFile = path.join(ctx.runDir, 'pr-body.md');
  fs.writeFileSync(bodyFile, body);
  const base = ctx.baseBranch || 'main';
  return run('gh', ['pr', 'create', '--base', base, '--head', branch, '--title', `research: ${ctx.topicTitle}`.slice(0, 250), '--body-file', bodyFile], { cwd: ctx.topicDir });
}

async function ship(ctx) {
  const dest = commit(ctx);
  ctx.log(`  committed ${path.relative(ctx.topicDir, dest)}/ on ${git(ctx, ['branch', '--show-current'])}`);
  let go = ctx.mode === 'autonomous' || ctx.opts.ship === true;
  if (!go && ctx.mode === 'interactive' && process.stdin.isTTY) {
    go = /^y(es)?$/i.test(await ask('Push the topic branch and open a PR? [y/N] '));
  }
  if (!go) throw new NeedsHuman('push', `report committed locally. Review research/${ctx.slug}/REPORT.md, then: rloop ship ${ctx.slug}`);
  const url = push(ctx);
  ctx.log(`  PR: ${url}`);
  return { pr: url };
}

module.exports = { ship, push, commit, prBody, scanSecrets, COPY };
