// Small helpers shared by the stages: run-dir file IO, prompt templates, stop signals.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// A gate failed: the run stops with outcome "blocked".
class Blocked extends Error {
  constructor(gate, message) { super(message); this.gate = gate; }
}
// The run needs a person (paper count, push approval): outcome "needs-human".
class NeedsHuman extends Error {
  constructor(gate, message) { super(message); this.gate = gate; }
}

function readJSONL(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    try { out.push(JSON.parse(line)); } catch { throw new Error(`${path.basename(file)} line ${i + 1} is not JSON`); }
  });
  return out;
}

function writeJSONL(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}

function readJSONFile(file, what) {
  if (!fs.existsSync(file)) return { ok: false, error: `${what || path.basename(file)} was not written` };
  try { return { ok: true, value: JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch (e) {
    return { ok: false, error: `${what || path.basename(file)} is not valid JSON (${e.message})` };
  }
}

const PROMPTS = path.resolve(__dirname, '..', 'prompts');
function prompt(name, vars) {
  const tpl = fs.readFileSync(path.join(PROMPTS, `${name}.md`), 'utf8');
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

// Fingerprint of every file under dir except the given relative paths/prefixes.
function snapshot(dir, ignore = []) {
  const h = crypto.createHash('sha256');
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      const rel = path.relative(dir, p);
      if (ignore.some((x) => rel === x || rel.startsWith(`${x}${path.sep}`))) continue;
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) h.update(rel).update('\0').update(fs.readFileSync(p)).update('\0');
    }
  })(dir);
  return h.digest('hex');
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

// Run async fn over items with at most `limit` in flight. Results keep input order.
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

module.exports = { Blocked, NeedsHuman, readJSONL, writeJSONL, readJSONFile, prompt, snapshot, ask, pool };
