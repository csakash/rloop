// OpenAlex: every field. https://docs.openalex.org
const http = require('../http');
const { paper, q } = require('./common');

const BASE = 'https://api.openalex.org';
const SELECT = 'id,doi,display_name,publication_year,abstract_inverted_index,cited_by_count,ids,primary_location';

function auth() {
  const p = [];
  if (process.env.OPENALEX_MAILTO) p.push(`mailto=${q(process.env.OPENALEX_MAILTO)}`);
  if (process.env.OPENALEX_API_KEY) p.push(`api_key=${q(process.env.OPENALEX_API_KEY)}`);
  return p.length ? `&${p.join('&')}` : '';
}

// OpenAlex ships abstracts as { word: [positions] }.
function abstractFrom(inv) {
  if (!inv || typeof inv !== 'object') return '';
  const words = [];
  for (const [w, pos] of Object.entries(inv)) for (const p of pos) words[p] = w;
  return words.filter((w) => w !== undefined).join(' ');
}

function toPaper(w) {
  if (!w) return null;
  const venue = w.primary_location && w.primary_location.source ? w.primary_location.source.display_name : null;
  return paper('openalex', {
    doi: w.doi || (w.ids && w.ids.doi),
    openalex: w.id,
    pmid: w.ids && w.ids.pmid,
    pmcid: w.ids && w.ids.pmcid,
  }, {
    title: w.display_name || w.title,
    abstract: abstractFrom(w.abstract_inverted_index),
    year: w.publication_year,
    venue,
    citations: w.cited_by_count,
  });
}

async function count(query) {
  const { status, json } = await http.getJSON(`${BASE}/works?search=${q(query)}&per-page=1&select=id${auth()}`);
  if (status !== 200) throw new Error(`openalex count: HTTP ${status}`);
  return json.meta.count;
}

async function search(query, { limit = 25 } = {}) {
  const papers = [];
  let total = null;
  let cursor = '*';
  while (papers.length < limit && cursor) {
    const per = Math.min(200, limit - papers.length);
    const url = `${BASE}/works?search=${q(query)}&per-page=${per}&cursor=${q(cursor)}&select=${SELECT}${auth()}`;
    const { status, json } = await http.getJSON(url);
    if (status !== 200) throw new Error(`openalex search: HTTP ${status}`);
    total = json.meta.count;
    const batch = (json.results || []).map(toPaper).filter(Boolean);
    papers.push(...batch);
    cursor = json.meta.next_cursor;
    if (!json.results || json.results.length === 0) break;
  }
  return { total, papers: papers.slice(0, limit) };
}

// kind: openalex | doi | pmid
async function resolve(kind, value) {
  const key = kind === 'openalex' ? value : kind === 'doi' ? `doi:${value}` : `pmid:${value}`;
  const { status, json } = await http.getJSON(`${BASE}/works/${key}?select=${SELECT}${auth()}`);
  if (status !== 200) return { ok: false, status };
  const p = toPaper(json);
  return { ok: !!p, title: p ? p.title : null, paper: p };
}

module.exports = {
  name: 'openalex', label: 'OpenAlex', fields: 'all fields', canSearch: true,
  resolves: ['openalex', 'doi', 'pmid'], count, search, resolve, toPaper, abstractFrom,
};
