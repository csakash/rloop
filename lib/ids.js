// Source identifiers: `<kind>:<value>`. One canonical id per paper so dedupe and citation
// checks agree on what "the same paper" means.
const PATTERNS = {
  doi: /^10\.\d{4,9}\/\S+$/,
  pmid: /^\d{1,9}$/,
  pmcid: /^PMC\d+$/,
  arxiv: /^(\d{4}\.\d{4,5}|[a-z-]+(\.[A-Z]{2})?\/\d{7})(v\d+)?$/,
  openalex: /^W\d+$/,
  s2: /^[0-9a-f]{40}$/,
  nct: /^NCT\d{8}$/,
};
// Preference order for the canonical id.
const ORDER = ['doi', 'pmid', 'arxiv', 'openalex', 's2', 'nct', 'pmcid'];

function normalizeValue(kind, v) {
  let s = String(v || '').trim();
  if (!s) return null;
  if (kind === 'doi') s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:/i, '').toLowerCase();
  if (kind === 'pmid') s = s.replace(/^https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\//i, '').replace(/\/$/, '');
  if (kind === 'pmcid') s = s.toUpperCase().replace(/^(?!PMC)/, 'PMC');
  if (kind === 'arxiv') s = s.replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, '').replace(/^arxiv:/i, '').replace(/v\d+$/, '');
  if (kind === 'openalex') s = s.replace(/^https?:\/\/openalex\.org\//i, '').toUpperCase();
  if (kind === 'nct') s = s.toUpperCase();
  return PATTERNS[kind].test(s) ? s : null;
}

// "doi:10.1/x" -> { kind, value } or null when malformed.
function parse(id) {
  const m = String(id || '').match(/^([a-z0-9]+):(.+)$/i);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  if (!PATTERNS[kind]) return null;
  const value = normalizeValue(kind, m[2]);
  return value ? { kind, value } : null;
}

function format(kind, value) {
  const v = normalizeValue(kind, value);
  return v ? `${kind}:${v}` : null;
}

// Normalize an id string; null when malformed.
function normalize(id) {
  const p = parse(id);
  return p ? `${p.kind}:${p.value}` : null;
}

// { doi, pmid, ... } (raw values) -> cleaned map of kind -> value.
function cleanIds(raw) {
  const out = {};
  for (const k of ORDER) {
    const v = raw && raw[k] ? normalizeValue(k, raw[k]) : null;
    if (v) out[k] = v;
  }
  return out;
}

function canonical(idsMap) {
  for (const k of ORDER) if (idsMap[k]) return `${k}:${idsMap[k]}`;
  return null;
}

// Every id string a paper can be cited by.
function allIds(idsMap) {
  return ORDER.filter((k) => idsMap[k]).map((k) => `${k}:${idsMap[k]}`);
}

function normTitle(t) {
  return String(t || '').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

module.exports = { PATTERNS, ORDER, parse, format, normalize, cleanIds, canonical, allIds, normTitle };
