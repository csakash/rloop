// The search log: every database call an agent makes through rsearch, appended to
// $RLOOP_RUN_DIR/search-log.jsonl. Search coverage is measured from this file, not from
// what an agent says it did.
const fs = require('fs');
const path = require('path');

const FILE = 'search-log.jsonl';

function append(runDir, entry) {
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true });
  fs.appendFileSync(path.join(runDir, FILE), `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
}

function read(runDir) {
  const f = path.join(runDir, FILE);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

// Per-gap coverage for one role: { gapId: { queries, sources: [..] } }.
// Only searches count (not count/resolve), and each distinct (source, query) counts once.
function coverage(entries, role) {
  const out = {};
  for (const e of entries) {
    if (e.role !== role || e.op !== 'search' || !e.gap || e.error) continue;
    const g = (out[e.gap] = out[e.gap] || { queries: 0, sources: [], seen: new Set() });
    const key = `${e.source}\u0000${String(e.query).trim().toLowerCase()}`;
    if (g.seen.has(key)) continue;
    g.seen.add(key);
    g.queries += 1;
    if (!g.sources.includes(e.source)) g.sources.push(e.source);
  }
  for (const g of Object.values(out)) delete g.seen;
  return out;
}

module.exports = { FILE, append, read, coverage };
