// Spawning one stage's agent. Reuses gloop's runAgent (process spawn) and agentEnv (push
// blocking). Tool permissions are rloop's own: authors get file tools plus rsearch; the
// disprover gets read-only tools plus web and rsearch, and never Edit/Write.
const fs = require('fs');
const os = require('os');
const path = require('path');
const gloop = require('./gloop');

const RSEARCH = path.resolve(__dirname, '..', 'bin', 'rsearch');
const READ = ['Read', 'Grep', 'Glob'];
const WRITE = ['Write', 'Edit'];
const WEB = ['WebSearch', 'WebFetch'];
const NEVER_FOR_DISPROVER = ['Edit', 'Write', 'NotebookEdit', 'MultiEdit'];
const MAX_TURNS = { scope: 40, extract: 60, detect: 50, disprove: 200, resolve: 80, rank: 40 };

function rsearchRule() {
  return `Bash(${RSEARCH}:*)`;
}

function args(role, stage, prompt) {
  const allowed = role === 'disprover' ? [...READ, ...WEB, rsearchRule()] : [...READ, ...WRITE, rsearchRule()];
  const denied = role === 'disprover' ? [...NEVER_FOR_DISPROVER, ...gloop.driver.PUSH_DENY] : [...gloop.driver.PUSH_DENY];
  const a = ['-p', prompt, '--permission-mode', 'default', '--max-turns', String(MAX_TURNS[stage] || 60),
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
  };
  fs.mkdirSync(path.join(ctx.runDir, 'logs'), { recursive: true });
  ctx.log(`  → ${label} (${role}, claude -p)`);
  const r = await gloop.driver.runAgent({ args: args(role, stage, prompt), cwd: ctx.runDir, capture: true, echo: false, env });
  fs.writeFileSync(path.join(ctx.runDir, 'logs', `${label}.log`), r.stdout || '');
  if (r.code === 127) throw Object.assign(new Error(`agent binary not found: ${r.error || gloop.driver.AGENT_BIN}`), { gate: 'agent' });
  return { code: r.code, stdout: r.stdout, ...parseStream(r.stdout) };
}

module.exports = { RSEARCH, MAX_TURNS, args, parseStream, run, rsearchRule };
