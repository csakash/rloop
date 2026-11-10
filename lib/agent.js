// Spawning one stage's agent. Reuses gloop's runAgent (process spawn) and agentEnv (push
// blocking). Tool permissions are rloop's own: authors read and edit only inside the run dir
// and run only a read-only copy of rsearch; the disprover reads the run dir, searches, and
// fetches scholarly domains, and never edits.
const fs = require('fs');
const os = require('os');
const path = require('path');
const gloop = require('./gloop');
const { verifySeals, Blocked } = require('./runctx');

const RSEARCH = path.resolve(__dirname, '..', 'bin', 'rsearch');
const MAX_TURNS = { scope: 40, extract: 60, detect: 50, disprove: 200, resolve: 80, rank: 40 };
// The disprover may fetch scholarly pages only; WebSearch goes to the search provider.
const WEB_DOMAINS = [
  'arxiv.org', 'export.arxiv.org', 'biorxiv.org', 'www.biorxiv.org', 'medrxiv.org', 'www.medrxiv.org',
  'doi.org', 'dx.doi.org', 'pubmed.ncbi.nlm.nih.gov', 'www.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov',
  'europepmc.org', 'www.ebi.ac.uk', 'www.semanticscholar.org', 'api.semanticscholar.org', 'openalex.org',
  'api.openalex.org', 'clinicaltrials.gov', 'scholar.archive.org', 'openreview.net', 'aclanthology.org',
  'proceedings.neurips.cc', 'papers.ssrn.com', 'osf.io', 'zenodo.org', 'api.crossref.org',
];
// No bare "Bash" here: a deny rule beats the rsearch allow rule. Other commands are denied
// because headless mode denies anything not allowed.
const DENY_ALWAYS = ['NotebookEdit', ...gloop.driver.PUSH_DENY];
const DENY_DISPROVER = ['Edit', 'Write', 'MultiEdit'];
// Files the claude CLI loads as instructions or settings from its working directory.
const CONFIG_PATHS = ['CLAUDE.md', 'CLAUDE.local.md', '.claude/**', '.mcp.json'];
const CONFIG_CHECK = ['CLAUDE.md', 'CLAUDE.local.md', '.claude', '.mcp.json'];

// Absolute-path permission rule ("//abs/path/**").
function under(dir) {
  return `/${path.resolve(dir)}/**`;
}

// A read-only copy of rsearch and lib/ per run. Agents may run only this copy, and nothing
// they can write reaches code that runs: the copy is chmod'ed read-only and fingerprinted,
// and file tools are confined to the run dir anyway.
function toolbox(ctx) {
  if (ctx.toolbox) return ctx.toolbox;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rloop-tools-'));
  const src = path.resolve(__dirname, '..');
  fs.cpSync(path.join(src, 'lib'), path.join(dir, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'bin'));
  fs.copyFileSync(path.join(src, 'bin', 'rsearch'), path.join(dir, 'bin', 'rsearch'));
  (function lock(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) lock(p); else fs.chmodSync(p, e.name === 'rsearch' ? 0o555 : 0o444);
    }
    fs.chmodSync(d, 0o555);
  })(dir);
  const { snapshot } = require('./runctx');
  ctx.toolbox = { dir, rsearch: path.join(dir, 'bin', 'rsearch'), hash: snapshot(dir) };
  return ctx.toolbox;
}

function rsearchPath(ctx) {
  return ctx && ctx.runDir ? toolbox(ctx).rsearch : RSEARCH;
}

function rsearchRule(rsearch = RSEARCH) {
  return `Bash(${rsearch}:*)`;
}

// Tool rules per role. Every file rule is scoped to the run dir: reads (Read rules also cover
// Grep/Glob) and, for authors, edits (Edit rules cover Write). Unlisted tools are denied in
// headless mode.
function args(role, stage, prompt, { runDir, rsearch = RSEARCH } = {}) {
  const scope = runDir ? under(runDir) : '/./**';
  const allowed = [`Read(${scope})`, rsearchRule(rsearch)];
  if (role === 'disprover') allowed.push('WebSearch', ...WEB_DOMAINS.map((d) => `WebFetch(domain:${d})`));
  else allowed.push(`Edit(${scope})`);
  // The run dir is the next agent's project root: an agent must not plant instructions or
  // settings there (deny beats the Edit allow above). After each stage the runner also
  // blocks if any of these appear.
  const configDeny = runDir ? CONFIG_PATHS.map((p) => `Edit(/${path.resolve(runDir, p)})`) : [];
  const denied = role === 'disprover' ? [...DENY_DISPROVER, ...DENY_ALWAYS] : [...DENY_ALWAYS, ...configDeny];
  // No user/project/local settings and no MCP servers: only the rules above apply.
  const a = ['-p', prompt, '--permission-mode', 'default', '--max-turns', String(MAX_TURNS[stage] || 60),
    '--setting-sources', '', '--strict-mcp-config',
    '--allowedTools', ...allowed, '--disallowedTools', ...denied];
  // The disprover's tool calls are counted from the event stream.
  if (role === 'disprover') a.push('--output-format', 'stream-json', '--verbose');
  return a;
}

// RLOOP_AGENT_BIN swaps the agent binary (tests use a stub). gloop's runAgent always spawns
// "claude", so we put a directory with a "claude" link to the replacement first on PATH.
function binEnv() {
  const bin = process.env.RLOOP_AGENT_BIN;
  if (!bin) return {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rloop-bin-'));
  fs.symlinkSync(path.resolve(bin), path.join(dir, gloop.driver.AGENT_BIN));
  return { PATH: `${dir}${path.delimiter}${process.env.PATH}` };
}

// Pull the final text and tool calls out of `--output-format stream-json` output. Plain
// text output (a stub, or an older CLI) comes back as the text with no tool calls.
function parseStream(stdout) {
  const lines = String(stdout || '').split('\n').filter((l) => l.trim().startsWith('{'));
  const tools = [];
  let result = null;
  let parsed = 0;
  for (const l of lines) {
    let ev;
    try { ev = JSON.parse(l); } catch { continue; }
    parsed += 1;
    if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
      for (const part of ev.message.content) if (part.type === 'tool_use') tools.push({ name: part.name, input: part.input });
    }
    if (ev.type === 'result') result = typeof ev.result === 'string' ? ev.result : '';
  }
  if (parsed === 0 || result === null) return { text: String(stdout || ''), tools, stream: false };
  return { text: result, tools, stream: true };
}

// Run one stage agent with cwd = the run dir. Output is saved to logs/<label>.log.
async function run(ctx, { role, stage, label, prompt }) {
  const env = {
    ...gloop.driver.agentEnv({ mode: ctx.mode, stage }),
    ...binEnv(),
    RLOOP_RUN_DIR: ctx.runDir,
    RLOOP_ROLE: role,
    RLOOP_STAGE: stage,
    ...(ctx.logKey ? { RLOOP_LOG_KEY: ctx.logKey } : {}),
    // The toolbox copy is read-only, so its cache must live elsewhere (agents cannot edit it:
    // their Edit rule is the run dir).
    RLOOP_CACHE_DIR: process.env.RLOOP_CACHE_DIR || path.resolve(__dirname, '..', '.cache'),
  };
  fs.mkdirSync(path.join(ctx.runDir, 'logs'), { recursive: true });
  ctx.log(`  → ${label} (${role}, claude -p)`);
  const tb = toolbox(ctx);
  const r = await gloop.driver.runAgent({ args: args(role, stage, prompt, { runDir: ctx.runDir, rsearch: tb.rsearch }), cwd: ctx.runDir, capture: true, echo: false, env });
  fs.writeFileSync(path.join(ctx.runDir, 'logs', `${label}.log`), r.stdout || '');
  if (r.code === 127) throw Object.assign(new Error(`agent binary not found: ${r.error || gloop.driver.AGENT_BIN}`), { gate: 'agent' });
  verifySeals(ctx, stage);
  const planted = CONFIG_CHECK.filter((p) => fs.existsSync(path.join(ctx.runDir, p)));
  if (planted.length) throw new Blocked(stage, `agent wrote CLI config into the run dir: ${planted.join(', ')}`);
  if (require('./runctx').snapshot(tb.dir) !== tb.hash) throw new Blocked(stage, 'rsearch toolbox changed during an agent stage');
  return { code: r.code, stdout: r.stdout, ...parseStream(r.stdout) };
}

module.exports = { RSEARCH, MAX_TURNS, WEB_DOMAINS, CONFIG_PATHS, args, parseStream, run, rsearchRule, rsearchPath, toolbox, under };
