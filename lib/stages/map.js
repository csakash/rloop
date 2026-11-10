// map: the runner fetches the chosen number of papers (split across sources by count share,
// deduped), then author agents extract claims in batches.
const fs = require('fs');
const path = require('path');
const agent = require('../agent');
const ids = require('../ids');
const sources = require('../sources');
const { validateClaim } = require('../contracts');
const { Blocked, readJSONL, writeJSONL, readJSONFile, prompt, pool } = require('../runctx');

const BATCH = 40;
const CONCURRENCY = 3;
const MIN_PROCESSED = 0.8;

// Split n across sources by count share; every source with papers gets at least 1.
function allocate(n, rows) {
  let usable = rows.filter((r) => r.count > 0);
  // Fewer papers than sources: one paper each from the largest n sources.
  if (n < usable.length) usable = [...usable].sort((a, b) => b.count - a.count).slice(0, n);
  const total = usable.reduce((a, r) => a + r.count, 0);
  const alloc = usable.map((r) => ({ source: r.source, query: r.query, count: r.count, n: Math.min(r.count, Math.max(1, Math.floor((n * r.count) / total))) }));
  let left = n - alloc.reduce((a, x) => a + x.n, 0);
  for (const x of [...alloc].sort((a, b) => b.count - a.count)) {
    if (left <= 0) break;
    const add = Math.min(left, x.count - x.n);
    x.n += add;
    left -= add;
  }
  while (left < 0) { // the min-1 rule can overshoot n; take back from the largest
    const big = alloc.filter((x) => x.n > 1).sort((a, b) => b.n - a.n)[0];
    if (!big) break;
    big.n -= 1;
    left += 1;
  }
  return alloc;
}

// Merge papers that share any id or a normalized title.
function dedupe(papers) {
  const out = [];
  const byKey = new Map();
  for (const p of papers) {
    const keys = [...ids.allIds(p.ids), p.title ? `title:${ids.normTitle(p.title)}` : null].filter(Boolean);
    const hit = keys.map((k) => byKey.get(k)).find(Boolean);
    if (hit) {
      hit.ids = { ...p.ids, ...hit.ids };
      if ((p.abstract || '').length > (hit.abstract || '').length) hit.abstract = p.abstract;
      if (!hit.design && p.design) hit.design = p.design;
      if (hit.citations === null && p.citations !== null) hit.citations = p.citations;
      hit.foundIn = [...new Set([...hit.foundIn, p.source])];
      hit.id = ids.canonical(hit.ids);
      for (const k of [...ids.allIds(hit.ids), ...keys]) byKey.set(k, hit);
    } else {
      const q = { ...p, foundIn: [p.source] };
      out.push(q);
      for (const k of keys) byKey.set(k, q);
    }
  }
  return out;
}

async function fetchPapers(ctx) {
  const sel = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'selection.json'), 'utf8'));
  const rows = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'sources.json'), 'utf8')).filter((r) => sel.sources.includes(r.source));
  const plan = allocate(sel.papers, rows);
  const report = [];
  let all = [];
  for (const a of plan) {
    try {
      const res = await sources.get(a.source).search(a.query, { limit: a.n });
      all.push(...res.papers);
      report.push({ source: a.source, asked: a.n, got: res.papers.length });
      ctx.log(`  fetched ${res.papers.length}/${a.n} from ${a.source}`);
    } catch (e) {
      report.push({ source: a.source, asked: a.n, got: 0, error: e.message });
      ctx.log(`  ${a.source} failed: ${e.message}`);
    }
  }
  let papers = dedupe(all);
  // One top-up round from the largest working source if dedupe or failures left a shortfall.
  const short = sel.papers - papers.length;
  const donor = report.filter((r) => !r.error && r.got >= r.asked).map((r) => plan.find((p) => p.source === r.source)).sort((a, b) => b.count - a.count)[0];
  if (short > 0 && donor && donor.count > donor.n) {
    const want = Math.min(donor.count, donor.n + Math.ceil(short * 1.5));
    try {
      const res = await sources.get(donor.source).search(donor.query, { limit: want });
      all.push(...res.papers);
      papers = dedupe(all);
      report.push({ source: donor.source, topUp: true, asked: want, got: res.papers.length });
    } catch (e) {
      report.push({ source: donor.source, topUp: true, error: e.message });
    }
  }
  papers = papers.slice(0, sel.papers);
  if (papers.length === 0) throw new Blocked('map', 'no papers could be fetched from the chosen sources');
  writeJSONL(path.join(ctx.runDir, 'papers.jsonl'), papers);
  fs.writeFileSync(path.join(ctx.runDir, 'fetch.json'), `${JSON.stringify({ requested: sel.papers, fetched: papers.length, plan, report }, null, 2)}\n`);
  return papers;
}

function paperIdSet(papers) {
  const s = new Set();
  for (const p of papers) for (const id of [p.id, ...ids.allIds(p.ids)]) s.add(id);
  return s;
}

// Canonical id for any id of a fetched paper.
function canonicalizer(papers) {
  const m = new Map();
  for (const p of papers) for (const id of [p.id, ...ids.allIds(p.ids)]) m.set(id, p.id);
  return (id) => m.get(ids.normalize(id)) || null;
}

async function extractBatch(ctx, batch, k, paperIds) {
  const input = `batches/input-${k}.jsonl`;
  const output = `batches/claims-${k}.jsonl`;
  const done = `batches/done-${k}.json`;
  writeJSONL(path.join(ctx.runDir, input), batch.map((p) => ({ id: p.id, title: p.title, abstract: p.abstract, year: p.year, venue: p.venue, ...(p.design ? { design: p.design } : {}) })));
  let error = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let text = prompt('extract', { input, output, done, count: batch.length });
    if (error) text += `\n\nYour previous attempt was rejected: ${error}\nRewrite ${output} and ${done} from scratch, fixing this.`;
    await agent.run(ctx, { role: 'author', stage: 'extract', label: `extract-${k}${attempt > 1 ? '-retry' : ''}`, prompt: text });
    try {
      const claims = readJSONL(path.join(ctx.runDir, output));
      const bad = claims.map((c) => validateClaim(c, paperIds)).find((v) => !v.ok);
      if (bad) { error = bad.error; continue; }
      const d = readJSONFile(path.join(ctx.runDir, done));
      if (!d.ok) { error = d.error; continue; }
      const processed = Array.isArray(d.value.processed) ? d.value.processed : [];
      return { claims, processed };
    } catch (e) {
      error = e.message;
    }
  }
  throw new Blocked('map', `claim extraction batch ${k} failed twice: ${error}`);
}

async function map(ctx) {
  const papers = await fetchPapers(ctx);
  const paperIds = paperIdSet(papers);
  const canon = canonicalizer(papers);
  const batches = [];
  for (let i = 0; i < papers.length; i += BATCH) batches.push(papers.slice(i, i + BATCH));
  ctx.log(`  extracting claims from ${papers.length} papers in ${batches.length} batches`);
  const results = await pool(batches, CONCURRENCY, (b, i) => extractBatch(ctx, b, i + 1, paperIds));

  const processed = new Set();
  results.forEach((r) => r.processed.forEach((id) => { const c = canon(id); if (c) processed.add(c); }));
  const share = processed.size / papers.length;
  if (share < MIN_PROCESSED) {
    throw new Blocked('map', `only ${processed.size}/${papers.length} papers were processed (need ${Math.round(MIN_PROCESSED * 100)}%)`);
  }
  let n = 0;
  const claims = results.flatMap((r) => r.claims).map((c) => {
    n += 1;
    return { ...c, id: `c${String(n).padStart(4, '0')}`, source: canon(c.source) };
  });
  writeJSONL(path.join(ctx.runDir, 'claims.jsonl'), claims);
  ctx.log(`  ${claims.length} claims from ${processed.size} papers`);
  return { papers: papers.length, processed: processed.size, claims: claims.length };
}

module.exports = { map, allocate, dedupe, fetchPapers, BATCH, MIN_PROCESSED };
