// Gap signals computed in code, so the detect agent starts from counts rather than impressions.
// Concepts are the claims' subject/object strings, normalized. Thresholds come from
// loops.json `research.signals` (defaults below match SPEC.md).
const DEFAULTS = { minLinkClaims: 3, minWeakClaims: 3, weakMaxN: 100, minNarrowClaims: 2, maxPerSignal: 25 };
const STRONG = new Set(['rct', 'meta-analysis']);
const OPPOSITE = { increases: ['decreases', 'no-effect'], decreases: ['increases', 'no-effect'], 'no-effect': ['increases', 'decreases'] };
const LIMITATION_RE = /\b(future (work|research|studies)|remains? (unclear|unknown|to be (determined|elucidated|established))|further (research|studies|investigation)|has not (yet )?been|have not (yet )?been|not yet been|poorly understood|little is known|lack of (evidence|data|studies))\b/gi;

function concept(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ');
}

const pairKey = (a, b) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
const unpair = (k) => k.split('\u0000');

function compute(claims, papers, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  // Undirected concept graph: edge weight = number of claims linking the two concepts.
  const edges = new Map();
  const adj = new Map();
  const byPair = new Map(); // directed-agnostic pair -> claims
  for (const c of claims) {
    const a = concept(c.subject);
    const b = concept(c.object);
    if (!a || !b || a === b) continue;
    const k = pairKey(a, b);
    edges.set(k, (edges.get(k) || 0) + 1);
    if (!byPair.has(k)) byPair.set(k, []);
    byPair.get(k).push(c);
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!adj.has(x)) adj.set(x, new Set());
      adj.get(x).add(y);
    }
  }

  // missing-link: A-B and B-C each backed by >= minLinkClaims claims, A-C never linked.
  const missing = new Map();
  for (const [b, nbrs] of adj) {
    const strong = [...nbrs].filter((x) => (edges.get(pairKey(x, b)) || 0) >= o.minLinkClaims).sort();
    for (let i = 0; i < strong.length; i += 1) {
      for (let j = i + 1; j < strong.length; j += 1) {
        const [a, c] = [strong[i], strong[j]];
        if (edges.has(pairKey(a, c))) continue;
        const k = pairKey(a, c);
        if (!missing.has(k)) missing.set(k, { a, c, via: [], claims: [] });
        const m = missing.get(k);
        m.via.push(b);
        m.claims.push(...byPair.get(pairKey(a, b)).map((x) => x.id), ...byPair.get(pairKey(b, c)).map((x) => x.id));
      }
    }
  }

  const weak = [];
  const contradiction = [];
  const narrow = [];
  for (const [k, cs] of byPair) {
    const [a, b] = unpair(k);
    const ns = cs.map((c) => c.n).filter((n) => Number.isInteger(n));
    const maxN = ns.length ? Math.max(...ns) : null;
    const strongCount = cs.filter((c) => STRONG.has(c.design)).length;
    if (cs.length >= o.minWeakClaims && (strongCount === 0 || (maxN !== null && maxN < o.weakMaxN))) {
      weak.push({ a, b, claims: cs.map((c) => c.id), designs: count(cs.map((c) => c.design)), maxN, strongCount });
    }
    const rels = new Set(cs.map((c) => c.relation));
    const clash = [...rels].some((r) => (OPPOSITE[r] || []).some((x) => rels.has(x)));
    if (clash) contradiction.push({ a, b, claims: cs.map((c) => c.id), relations: count(cs.map((c) => c.relation)) });
    const settings = new Set(cs.map((c) => concept(c.setting)).filter(Boolean));
    if (cs.length >= o.minNarrowClaims && settings.size === 1 && cs.every((c) => concept(c.setting))) {
      narrow.push({ a, b, claims: cs.map((c) => c.id), setting: [...settings][0] });
    }
  }

  // stated-limitation: limitation phrases in abstracts, grouped by the concepts that paper's claims use.
  const claimsByPaper = new Map();
  for (const c of claims) {
    if (!claimsByPaper.has(c.source)) claimsByPaper.set(c.source, []);
    claimsByPaper.get(c.source).push(c);
  }
  const limit = new Map();
  for (const p of papers) {
    const hits = [...new Set((p.abstract || '').match(LIMITATION_RE) || [])].map((h) => h.toLowerCase());
    if (!hits.length) continue;
    const cs = paperClaims(p, claimsByPaper);
    for (const c of cs) {
      for (const con of [concept(c.subject), concept(c.object)]) {
        if (!limit.has(con)) limit.set(con, { concept: con, papers: new Set(), phrases: new Set(), claims: new Set() });
        const L = limit.get(con);
        L.papers.add(p.id);
        hits.forEach((h) => L.phrases.add(h));
        L.claims.add(c.id);
      }
    }
  }

  const byWeight = (x, y) => y.claims.length - x.claims.length;
  const cap = (xs) => xs.sort(byWeight).slice(0, o.maxPerSignal);
  return {
    thresholds: o,
    concepts: adj.size,
    pairs: byPair.size,
    'missing-link': cap([...missing.values()].map((m) => ({ ...m, via: [...new Set(m.via)], claims: [...new Set(m.claims)] }))),
    'weak-evidence': cap(weak),
    contradiction: cap(contradiction),
    'narrow-coverage': cap(narrow),
    'stated-limitation': cap([...limit.values()].map((L) => ({ concept: L.concept, papers: [...L.papers], phrases: [...L.phrases], claims: [...L.claims] }))
      .filter((L) => L.papers.length >= 2)),
  };
}

function paperClaims(p, claimsByPaper) {
  const out = [];
  const allIds = Object.entries(p.ids || {}).map(([k, v]) => `${k}:${v}`);
  for (const id of new Set([p.id, ...allIds])) out.push(...(claimsByPaper.get(id) || []));
  return out;
}

function count(xs) {
  const o = {};
  for (const x of xs) o[x] = (o[x] || 0) + 1;
  return o;
}

module.exports = { DEFAULTS, LIMITATION_RE, concept, compute };
