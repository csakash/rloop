// Source registry and id resolution.
const ids = require('../ids');

const SOURCES = {
  openalex: require('./openalex'),
  semanticscholar: require('./semanticscholar'),
  arxiv: require('./arxiv'),
  pubmed: require('./pubmed'),
  europepmc: require('./europepmc'),
  crossref: require('./crossref'),
  clinicaltrials: require('./clinicaltrials'),
};

// Which source resolves which id kind, in the order tried.
const RESOLVERS = {
  doi: ['crossref', 'openalex'],
  pmid: ['pubmed', 'europepmc'],
  pmcid: ['europepmc'],
  arxiv: ['arxiv', 'semanticscholar'],
  openalex: ['openalex'],
  s2: ['semanticscholar'],
  nct: ['clinicaltrials'],
};

function get(name) {
  const s = SOURCES[name];
  if (!s) throw new Error(`unknown source "${name}". Known: ${Object.keys(SOURCES).join(', ')}`);
  return s;
}

function list() {
  return Object.values(SOURCES).map((s) => ({ name: s.name, label: s.label, fields: s.fields, canSearch: s.canSearch }));
}

// Resolve "kind:value" against its databases. A source that errors (network, 5xx after
// retries) is recorded and the next one is tried; "not found" from one source is not
// final while another remains.
async function resolveId(id) {
  const p = ids.parse(id);
  if (!p) return { id, ok: false, error: 'malformed id' };
  const tried = [];
  for (const name of RESOLVERS[p.kind]) {
    try {
      const r = await SOURCES[name].resolve(p.kind, p.value);
      tried.push({ source: name, ok: r.ok, status: r.status || 200 });
      if (r.ok) return { id: `${p.kind}:${p.value}`, ok: true, via: name, title: r.title, paper: r.paper, tried };
    } catch (e) {
      tried.push({ source: name, ok: false, error: e.message });
    }
  }
  const allErrored = tried.every((t) => t.error);
  return { id: `${p.kind}:${p.value}`, ok: false, error: allErrored ? 'lookup failed' : 'not found', tried };
}

module.exports = { SOURCES, RESOLVERS, get, list, resolveId };
