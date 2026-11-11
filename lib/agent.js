// Spawning one stage's agent. Reuses gloop's runAgent (process spawn) and agentEnv (push
// blocking). The sandbox is rloop's own:
// - every agent runs in a fresh, empty stage dir under the OS temp dir (outside any git repo),
//   holding only copies of that stage's declared inputs; only its declared outputs (regular
//   files) are copied back to the run dir, and the stage dir is deleted. Nothing an agent
//   writes can be loaded by a later agent as instructions, settings or git config.
// - the claude CLI starts in --safe-mode (no CLAUDE.md, skills, hooks, MCP, plugins), with no
//   settings sources, and --permission-mode dontAsk (anything not allowed is denied).
// - file rules are scoped to the stage dir; the only command is a read-only, fingerprinted
//   copy of rsearch; the disprover never edits and may fetch scholarly domains only.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('./http');
const gloop = require('./gloop');
const { verifySeals, Blocked, snapshot } = require('./runctx');

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
const DENY_ALWAYS = [
  'NotebookEdit', 'Agent', 'Task', 'RemoteTrigger', 'CronCreate', 'CronDelete', 'CronList', 'ScheduleWakeup',
  'SendMessage', 'Monitor', 'Skill', 'Workflow', 'PushNotification', 'EnterWorktree', 'ExitWorktree',
  ...gloop.driver.PUSH_DENY,
];
const TOOLS_AUTHOR = ['Read', 'Edit', 'Write', 'Bash'];
const TOOLS_DISPROVER = ['Read', 'Bash', 'WebSearch', 'WebFetch'];
// Proxies that need a password are not supported: the password would have to reach the
// claude process, and anything it runs (rsearch, Bash) would inherit it.
const PROXY_NAMES = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy'];
function authenticatedProxy(env = process.env) {
  return PROXY_NAMES.find((k) => typeof env[k] === 'string' && env[k].includes('@')) || null;
}
const DENY_DISPROVER = ['Edit', 'Write', 'MultiEdit'];
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

// Absolute-path permission rule ("//abs/path/**").
function under(dir) {
  return `/${path.resolve(dir)}/**`;
}

// A read-only copy of rsearch and lib/ per run. Agents may run only this copy, and nothing
// they can write reaches code that runs: the copy is chmod'ed read-only and fingerprinted,
// and file tools are confined to the run dir anyway.
// Database API keys never sit in an agent's environment: the toolbox holds them in an
// owner-only file outside every stage dir (agents' Read rule is the stage dir), and rsearch
// loads them itself.
const DB_KEYS = ['OPENALEX_API_KEY', 'OPENALEX_MAILTO', 'NCBI_API_KEY', 'S2_API_KEY', 'CROSSREF_MAILTO'];

function toolbox(ctx) {
  if (ctx.toolbox) return ctx.toolbox;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rloop-tools-'));
  trackTemp(ctx, dir);
  const src = path.resolve(__dirname, '..');
  fs.cpSync(path.join(src, 'lib'), path.join(dir, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'bin'));
  fs.copyFileSync(path.join(src, 'bin', 'rsearch'), path.join(dir, 'bin', 'rsearch'));
  const keys = Object.fromEntries(DB_KEYS.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
  if (ctx.logKey) keys.RLOOP_LOG_KEY = ctx.logKey;
  fs.writeFileSync(path.join(dir, 'keys.json'), JSON.stringify(keys), { mode: 0o600 });
  (function lock(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) lock(p); else fs.chmodSync(p, e.name === 'rsearch' ? 0o555 : (e.name === 'keys.json' ? 0o400 : 0o444));
    }
    fs.chmodSync(d, 0o555);
  })(dir);
  ctx.toolbox = { dir, rsearch: path.join(dir, 'bin', 'rsearch'), keys: path.join(dir, 'keys.json'), hash: snapshot(dir) };
  return ctx.toolbox;
}

// Temp dirs a run creates (toolbox, stub bin); removed by cleanup() at the end of the run.
function trackTemp(ctx, dir) {
  ctx.tempDirs = ctx.tempDirs || [];
  ctx.tempDirs.push(dir);
}

function cleanup(ctx) {
  for (const d of [...(ctx.tempDirs || []), ...(ctx.activeStages || [])]) {
    try {
      (function unlock(p) {
        fs.chmodSync(p, 0o700);
        for (const e of fs.readdirSync(p, { withFileTypes: true })) if (e.isDirectory()) unlock(path.join(p, e.name));
      })(d);
      fs.rmSync(d, { recursive: true, force: true });
    } catch { /* temp dir; best effort */ }
  }
  ctx.tempDirs = [];
  ctx.activeStages = new Set();
  ctx.toolbox = null;
  ctx.binEnv = null;
}

// Agents get a minimal environment: everything not on this list (GITHUB_TOKEN, AWS_*,
// database keys, git config, ...) is removed. The claude process keeps its own auth vars
// (ANTHROPIC_*, CLAUDE_CODE_OAUTH_TOKEN). They are not readable through rsearch: the CLI
// (2.1.318, dontAsk) denies any rsearch command containing ${...}, $(...), quoting it cannot
// check, or chained commands (verified by scripts/probe-sandbox.js against the real CLI).
// CLAUDE_CODE_SUBPROCESS_ENV_SCRUB is deliberately NOT set: it strips RLOOP_KEYS_FILE (its
// name matches "_KEYS_") and forces the permission mode back to "default".
// Network vars (proxy, CA bundles) pass so claude and rsearch work behind a proxy. A proxy
// value containing "@" (credentials, with or without a scheme) never passes: run() refuses
// to start agents in that case (authenticated proxies are unsupported). Bedrock/Vertex auth
// is not supported for agents.
const ENV_ALLOW = /^(PATH|HOME|USER|LOGNAME|SHELL|TMPDIR|LANG|LC_[A-Z]+|TERM|TZ|ANTHROPIC_[A-Z_]+|CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CONFIG_DIR|RLOOP_CACHE|HTTPS?_PROXY|https?_proxy|NO_PROXY|no_proxy|ALL_PROXY|all_proxy|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|SSL_CERT_DIR)$/;
// Test hooks pass only when the agent binary itself is a test stub.
const TEST_ALLOW = /^RLOOP_TEST_[A-Z_]+$/;

function minimalEnv(base = process.env) {
  const testing = !!base.RLOOP_AGENT_BIN;
  const out = {};
  for (const k of Object.keys(base)) {
    if (PROXY_NAMES.includes(k) && String(base[k]).includes('@')) { out[k] = undefined; continue; }
    if (!ENV_ALLOW.test(k) && !(testing && TEST_ALLOW.test(k))) out[k] = undefined;
  }
  return out;
}

// gloop's agentEnv numbers its push-blocking GIT_CONFIG_* entries after the parent's
// GIT_CONFIG_COUNT; minimalEnv drops the parent's entries, so renumber from 0.
function pushBlockEnv(mode, stage) {
  const raw = gloop.driver.agentEnv({ mode, stage });
  const base = Number.parseInt(process.env.GIT_CONFIG_COUNT, 10) || 0;
  const count = Number.parseInt(raw.GIT_CONFIG_COUNT, 10) || 0;
  if (!count) return {};
  const out = { GIT_CONFIG_COUNT: String(count - base) };
  for (let i = base; i < count; i += 1) {
    out[`GIT_CONFIG_KEY_${i - base}`] = raw[`GIT_CONFIG_KEY_${i}`];
    out[`GIT_CONFIG_VALUE_${i - base}`] = raw[`GIT_CONFIG_VALUE_${i}`];
  }
  return out;
}

function rsearchPath(ctx) {
  return ctx && ctx.runDir ? toolbox(ctx).rsearch : RSEARCH;
}

function rsearchRule(rsearch = RSEARCH) {
  return `Bash(${rsearch}:*)`;
}

// Tool rules per role. Every file rule is scoped to the stage dir: reads (Read rules also
// cover Grep/Glob) and, for authors, edits (Edit rules cover Write).
function args(role, stage, prompt, { dir, rsearch = RSEARCH } = {}) {
  const scope = dir ? under(dir) : '/./**';
  const allowed = [`Read(${scope})`, rsearchRule(rsearch)];
  if (role === 'disprover') allowed.push('WebSearch', ...WEB_DOMAINS.map((d) => `WebFetch(domain:${d})`));
  else allowed.push(`Edit(${scope})`);
  const denied = role === 'disprover' ? [...DENY_DISPROVER, ...DENY_ALWAYS] : [...DENY_ALWAYS];
  // Only these built-in tools exist for the agent at all. Without --tools the CLI also loads
  // tools that need no allow rule (RemoteTrigger, CronCreate, Agent, ...): a real-CLI probe
  // listed the user's claude.ai routines through RemoteTrigger.
  const tools = role === 'disprover' ? TOOLS_DISPROVER : TOOLS_AUTHOR;
  const a = ['-p', prompt, '--permission-mode', 'dontAsk', '--safe-mode', '--setting-sources', '', '--strict-mcp-config',
    '--tools', tools.join(','),
    '--max-turns', String(MAX_TURNS[stage] || 60),
    '--allowedTools', ...allowed, '--disallowedTools', ...denied];
  // The disprover's tool calls are counted from the event stream.
  if (role === 'disprover') a.push('--output-format', 'stream-json', '--verbose');
  return a;
}

// RLOOP_AGENT_BIN swaps the agent binary (tests use a stub). gloop's runAgent always spawns
// "claude", so we put a directory with a "claude" link to the replacement first on PATH.
function binEnv(ctx) {
  const bin = process.env.RLOOP_AGENT_BIN;
  if (!bin) return {};
  if (!ctx.binEnv) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rloop-bin-'));
    trackTemp(ctx, dir);
    fs.symlinkSync(path.resolve(bin), path.join(dir, gloop.driver.AGENT_BIN));
    ctx.binEnv = { PATH: `${dir}${path.delimiter}${process.env.PATH}` };
  }
  return ctx.binEnv;
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

function safeRel(rel) {
  const n = path.normalize(rel);
  if (path.isAbsolute(n) || n.split(path.sep).includes('..')) throw new Error(`bad stage path ${rel}`);
  return n;
}

// Fresh stage dir with copies of the declared inputs (realpath, so rules match what the CLI sees).
function stageDir(ctx, inputs) {
  const rels = inputs.map(safeRel);
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rloop-stage-')));
  try {
    for (const r of rels) {
      const src = path.join(ctx.runDir, r);
      if (!fs.existsSync(src)) continue;
      fs.mkdirSync(path.dirname(path.join(dir, r)), { recursive: true });
      fs.copyFileSync(src, path.join(dir, r));
    }
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  return dir;
}

// Copy declared outputs back: regular files only (no symlinks), size-capped.
function collect(ctx, dir, outputs, stage) {
  for (const rel of outputs) {
    const r = safeRel(rel);
    const p = path.join(dir, r);
    let st;
    try { st = fs.lstatSync(p); } catch { continue; }
    if (!st.isFile()) throw new Blocked(stage, `stage output ${r} is not a regular file`);
    if (st.size > MAX_OUTPUT_BYTES) throw new Blocked(stage, `stage output ${r} is over ${MAX_OUTPUT_BYTES} bytes`);
    fs.mkdirSync(path.dirname(path.join(ctx.runDir, r)), { recursive: true });
    fs.copyFileSync(p, path.join(ctx.runDir, r));
  }
}

// Run one stage agent in its own sandbox dir. inputs/outputs are run-dir-relative paths.
// Output is saved to logs/<label>.log in the run dir.
async function run(ctx, { role, stage, label, prompt, inputs = [], outputs = [] }) {
  const proxy = authenticatedProxy();
  if (proxy) throw new Blocked(stage, `$${proxy} carries credentials; rloop agents do not support authenticated proxies`);
  const tb = toolbox(ctx);
  const rels = inputs.map(safeRel); // validate before creating anything
  const bin = binEnv(ctx);
  fs.mkdirSync(path.join(ctx.runDir, 'logs'), { recursive: true });
  const dir = stageDir(ctx, rels); // last: nothing that can throw sits between here and the try
  ctx.activeStages = ctx.activeStages || new Set();
  ctx.activeStages.add(dir); // so a signal mid-stage can still remove it
  const env = {
    ...minimalEnv(),
    ...pushBlockEnv(ctx.mode, stage),
    ...bin,
    // The search-log key and database keys are in this owner-only file, read by rsearch.
    RLOOP_KEYS_FILE: tb.keys,
    // rsearch (not the agent) appends to the run's search log.
    RLOOP_RUN_DIR: ctx.runDir,
    RLOOP_ROLE: role,
    RLOOP_STAGE: stage,
    // The toolbox copy is read-only, so its cache lives in the repo's .cache (outside the stage dir).
    RLOOP_CACHE_DIR: process.env.RLOOP_CACHE_DIR || path.resolve(__dirname, '..', '.cache'),
    // Every rsearch process and the runner share one per-host rate limit (lib/http.js).
    RLOOP_THROTTLE_DIR: http.throttleDir(),
    // git never looks above the stage dir for a repository.
    GIT_CEILING_DIRECTORIES: path.dirname(dir),
  };
  ctx.log(`  → ${label} (${role}, claude -p)`);
  try {
    const before = role === 'disprover' ? snapshot(dir) : null;
    const r = await gloop.driver.runAgent({ args: args(role, stage, prompt, { dir, rsearch: tb.rsearch }), cwd: dir, capture: true, echo: false, env });
    fs.writeFileSync(path.join(ctx.runDir, 'logs', `${label}.log`), r.stdout || '');
    if (r.code === 127) throw Object.assign(new Error(`agent binary not found: ${r.error || gloop.driver.AGENT_BIN}`), { gate: 'agent' });
    if (role === 'disprover' && snapshot(dir) !== before) throw new Blocked(stage, 'reviewer modified tree');
    if (snapshot(tb.dir) !== tb.hash) throw new Blocked(stage, 'rsearch toolbox changed during an agent stage');
    if (role !== 'disprover') collect(ctx, dir, outputs, stage);
    verifySeals(ctx, stage);
    return { code: r.code, stdout: r.stdout, ...parseStream(r.stdout) };
  } finally {
    ctx.activeStages.delete(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { RSEARCH, MAX_TURNS, WEB_DOMAINS, DB_KEYS, ENV_ALLOW, TOOLS_AUTHOR, TOOLS_DISPROVER, DENY_ALWAYS, authenticatedProxy, pushBlockEnv, args, stageDir, collect, parseStream, run, rsearchRule, rsearchPath, toolbox, cleanup, minimalEnv, under };
