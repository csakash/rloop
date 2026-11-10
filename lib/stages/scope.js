// scope: the author picks databases and queries; the runner measures each query's count.
// Then the human gate: nothing is fetched until a person picks the paper count.
const fs = require('fs');
const path = require('path');
const agent = require('../agent');
const sources = require('../sources');
const { Blocked, NeedsHuman, readJSONFile, prompt, ask, seal } = require('../runctx');

const MAX_BRIEF_BYTES = 8000;

function searchable() {
  return sources.list().filter((s) => s.canSearch).map((s) => s.name).join(', ');
}

async function scope(ctx) {
  const topic = fs.readFileSync(path.join(ctx.runDir, 'topic.md'), 'utf8');
  await agent.run(ctx, {
    role: 'author', stage: 'scope', label: 'scope',
    prompt: prompt('scope', { topic, rsearch: agent.rsearchPath(ctx), searchable: searchable() }),
    inputs: ['topic.md'], outputs: ['brief.md', 'sources.json'],
  });
  const brief = path.join(ctx.runDir, 'brief.md');
  if (!fs.existsSync(brief) || !fs.readFileSync(brief, 'utf8').trim()) throw new Blocked('scope', 'scope stage wrote no brief.md');
  if (fs.statSync(brief).size > MAX_BRIEF_BYTES) throw new Blocked('scope', `brief.md is over ${MAX_BRIEF_BYTES} bytes`);
  const r = readJSONFile(path.join(ctx.runDir, 'sources.json'));
  if (!r.ok) throw new Blocked('scope', r.error);
  if (!Array.isArray(r.value) || r.value.length === 0) throw new Blocked('scope', 'sources.json lists no sources');

  const out = [];
  for (const s of r.value) {
    if (!s || !sources.SOURCES[s.source] || typeof s.query !== 'string' || !s.query.trim()) {
      throw new Blocked('scope', `sources.json entry is invalid: ${JSON.stringify(s)}`);
    }
    if (out.some((x) => x.source === s.source)) continue;
    const src = sources.get(s.source);
    let count = null;
    let error = null;
    try { count = await src.count(s.query); } catch (e) { error = e.message; }
    out.push({ source: s.source, query: s.query.trim(), reason: s.reason || '', count, canSearch: src.canSearch, error });
  }
  fs.writeFileSync(path.join(ctx.runDir, 'sources.json'), `${JSON.stringify(out, null, 2)}\n`);
  seal(ctx, 'sources.json');
  if (!out.some((s) => s.count > 0)) throw new Blocked('scope', 'no source returned a count above 0');
}

function table(rows) {
  const lines = ['  source            papers      query', '  ----------------  ----------  -----'];
  for (const s of rows) {
    const n = s.error ? 'unavailable' : String(s.count);
    lines.push(`  ${s.source.padEnd(16)}  ${n.padStart(10)}  ${s.query}${s.canSearch ? '' : '  (count only)'}`);
  }
  return lines.join('\n');
}

// The paper-count gate. Writes selection.json or stops with needs-human.
async function gate(ctx) {
  const rows = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'sources.json'), 'utf8'));
  ctx.log(`\nPapers available for "${ctx.topicTitle}":\n${table(rows)}\n`);
  let chosen = ctx.opts.sources ? ctx.opts.sources : rows.filter((s) => s.canSearch && s.count > 0).map((s) => s.source);
  let n = ctx.opts.papers;
  if (!n && ctx.mode === 'interactive' && process.stdin.isTTY) {
    const a = await ask(`How many papers should this run use? (blank to stop here) `);
    n = Number.parseInt(a, 10) || null;
    if (n) {
      const b = await ask(`Sources [${chosen.join(',')}] (enter to keep): `);
      if (b) chosen = b.split(',').map((x) => x.trim()).filter(Boolean);
    }
  }
  if (!n) {
    throw new NeedsHuman('scope-gate', `choose how many papers to use, then: rloop run ${ctx.slug} --papers <N> [--sources ${chosen.join(',')}]`);
  }
  if (!Number.isInteger(n) || n < 1) throw new Blocked('scope-gate', '--papers must be a positive integer');
  const unknown = chosen.filter((s) => !rows.some((r) => r.source === s));
  if (unknown.length) throw new Blocked('scope-gate', `--sources names sources scope did not pick: ${unknown.join(', ')}`);
  const usable = rows.filter((r) => chosen.includes(r.source) && r.canSearch && r.count > 0);
  if (!usable.length) throw new Blocked('scope-gate', 'none of the chosen sources can be searched or has papers');
  fs.writeFileSync(path.join(ctx.runDir, 'selection.json'), `${JSON.stringify({ papers: n, sources: usable.map((r) => r.source) }, null, 2)}\n`);
  seal(ctx, 'sources.json', 'selection.json');
}

module.exports = { scope, gate, table };
