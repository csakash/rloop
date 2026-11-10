// Semantic Scholar Graph API. https://api.semanticscholar.org/api-docs/graph
// Keyless use shares a public rate limit; S2_API_KEY raises it.
const http = require('../http');
const { paper, q } = require('./common');

const BASE = 'https://api.semanticscholar.org/graph/v1';
const FIELDS = 'title,abstract,year,venue,citationCount,externalIds';
const MAX_OFFSET = 1000; // the search endpoint stops at offset + limit = 1000

function headers() {
  return process.env.S2_API_KEY ? { 'x-api-key': process.env.S2_API_KEY } : {};
}

function toPaper(p) {
  if (!p) return null;
  const x = p.externalIds || {};
  return paper('semanticscholar', {
    doi: x.DOI, pmid: x.PubMed, pmcid: x.PubMedCentral, arxiv: x.ArXiv, s2: p.paperId,
  }, { title: p.title, abstract: p.abstract, year: p.year, venue: p.venue, citations: p.citationCount });
}

async function count(query) {
  const { status, json } = await http.getJSON(`${BASE}/paper/search?query=${q(query)}&limit=1&fields=title`, { headers: headers() });
  if (status !== 200) throw new Error(`semanticscholar count: HTTP ${status}`);
  return json.total;
}

async function search(query, { limit = 25 } = {}) {
  const papers = [];
  let total = null;
  let offset = 0;
  const cap = Math.min(limit, MAX_OFFSET);
  while (papers.length < cap) {
    const n = Math.min(100, cap - papers.length);
    const url = `${BASE}/paper/search?query=${q(query)}&offset=${offset}&limit=${n}&fields=${FIELDS}`;
    const { status, json } = await http.getJSON(url, { headers: headers() });
    if (status !== 200) throw new Error(`semanticscholar search: HTTP ${status}`);
    total = json.total;
    const data = json.data || [];
    papers.push(...data.map(toPaper).filter(Boolean));
    if (data.length < n || json.next === undefined) break;
    offset = json.next;
  }
  return { total, papers: papers.slice(0, limit) };
}

const KEY = { s2: (v) => v, doi: (v) => `DOI:${v}`, arxiv: (v) => `ARXIV:${v}`, pmid: (v) => `PMID:${v}` };

async function resolve(kind, value) {
  const { status, json } = await http.getJSON(`${BASE}/paper/${q(KEY[kind](value))}?fields=${FIELDS}`, { headers: headers() });
  if (status !== 200) return { ok: false, status };
  const p = toPaper(json);
  return { ok: !!p, title: p ? p.title : null, paper: p };
}

module.exports = {
  name: 'semanticscholar', label: 'Semantic Scholar', fields: 'all fields, strongest in CS and biomedicine',
  canSearch: true, resolves: ['s2', 'doi', 'arxiv', 'pmid'], count, search, resolve, toPaper,
};
