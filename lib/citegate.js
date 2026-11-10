// The citation gate: no LLM. Every id the run cites must resolve in a real database, every
// claim's quote must appear in its paper's abstract, and every surviving gap must have been
// searched hard enough by the disprover (measured from the search log).
const ids = require('./ids');
const searchlog = require('./searchlog');

const DEFAULTS = { minQueries: 10, minSources: 2 };
const { MIN_QUOTE_WORDS } = require('./contracts');

function norm(s) {
  return String(s || '').toLowerCase().replace(/[‘’“”]/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();
}

// Map every id of every fetched paper to that paper.
function paperIndex(papers) {
  const idx = new Map();
  for (const p of papers) for (const id of [p.id, ...ids.allIds(p.ids || {})]) idx.set(id, p);
  return idx;
}

// resolve(id) -> { ok, via, title, error }. Injected so tests run offline.
async function run({ papers, claims, gaps, findings, resolutions, logEntries, thresholds = {}, resolve }) {
  const t = { ...DEFAULTS, ...thresholds };
  const idx = paperIndex(papers);
  const problems = [];

  // 1. Claims: source must be a fetched paper; quote must be in its abstract or title.
  const quotes = [];
  const verified = new Set();
  for (const c of claims) {
    const sid = ids.normalize(c.source);
    const p = sid && idx.get(sid);
    const q = norm(c.quote);
    const longEnough = q.split(' ').filter(Boolean).length >= MIN_QUOTE_WORDS;
    const ok = !!p && longEnough && (norm(p.abstract).includes(q) || norm(p.title).includes(q));
    const reason = !p ? 'source not fetched' : !longEnough ? `quote under ${MIN_QUOTE_WORDS} words` : ok ? null : 'quote not found in abstract';
    quotes.push({ claim: c.id, source: c.source, verified: ok, reason });
    if (ok) verified.add(c.id);
  }

  // 2. Every cited id, fetched-paper ids first, then everything else over the network.
  const cited = new Map(); // id -> where
  const note = (id, where) => {
    const n = ids.normalize(id);
    const key = n || String(id);
    if (!cited.has(key)) cited.set(key, new Set());
    cited.get(key).add(where);
  };
  claims.forEach((c) => note(c.source, `claim ${c.id}`));
  (findings || []).forEach((f) => (f.sources || []).forEach((s) => note(s, `finding ${f.id}`)));
  Object.entries(resolutions || {}).forEach(([fid, r]) => (r.sources || []).forEach((s) => note(s, `resolution ${fid}`)));

  const citations = [];
  for (const [id, where] of cited) {
    if (!ids.normalize(id)) {
      citations.push({ id, resolved: false, error: 'malformed id', citedBy: [...where] });
      continue;
    }
    const p = idx.get(id);
    if (p) {
      citations.push({ id, resolved: true, via: `fetched:${p.source}`, title: p.title, citedBy: [...where] });
      continue;
    }
    const r = await resolve(id);
    citations.push({ id, resolved: !!r.ok, via: r.via || null, title: r.title || null, error: r.ok ? null : (r.error || 'not found'), citedBy: [...where] });
  }
  for (const c of citations.filter((x) => !x.resolved)) {
    problems.push(`citation ${c.id} did not resolve (${c.error}; cited by ${c.citedBy.join(', ')})`);
  }

  // 3. Surviving gaps: at least one verified claim, and enough disprover searching.
  const cov = searchlog.coverage(logEntries || [], 'disprover');
  const coverage = {};
  for (const g of gaps.filter((x) => x.status === 'survived')) {
    const c = cov[g.id] || { queries: 0, sources: [] };
    const okQ = c.queries >= t.minQueries;
    const okS = c.sources.length >= t.minSources;
    const vClaims = g.claims.filter((cid) => verified.has(cid));
    coverage[g.id] = { queries: c.queries, sources: c.sources, verifiedClaims: vClaims.length, pass: okQ && okS && vClaims.length > 0 };
    if (!okQ || !okS) problems.push(`gap ${g.id}: disprover ran ${c.queries} queries across ${c.sources.length} sources (need ${t.minQueries} across ${t.minSources})`);
    if (vClaims.length === 0) problems.push(`gap ${g.id}: none of its claims has a quote found in the source abstract`);
  }

  return { citations, quotes, coverage, problems, thresholds: t };
}

module.exports = { DEFAULTS, run, norm, paperIndex };
