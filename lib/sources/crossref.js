// Crossref REST: counts and DOI resolution only (its search ranks metadata, not abstracts,
// and most records have no abstract, so v1 never fetches papers from it).
const http = require('../http');
const { paper, q } = require('./common');

const BASE = 'https://api.crossref.org';

function polite() {
  return process.env.CROSSREF_MAILTO ? `mailto=${q(process.env.CROSSREF_MAILTO)}` : '';
}

async function count(query) {
  const { status, json } = await http.getJSON(`${BASE}/works?query=${q(query)}&rows=0&${polite()}`);
  if (status !== 200) throw new Error(`crossref count: HTTP ${status}`);
  return json.message['total-results'];
}

async function search() {
  throw new Error('crossref is count/resolve only in v1; fetch papers from another source');
}

async function resolve(kind, value) {
  // Crossref DOIs are case-insensitive; the path segment keeps "/" literal.
  const { status, json } = await http.getJSON(`${BASE}/works/${value.split('/').map(q).join('/')}?${polite()}`);
  if (status !== 200) return { ok: false, status };
  const m = json.message || {};
  const year = m.issued && m.issued['date-parts'] && m.issued['date-parts'][0] ? m.issued['date-parts'][0][0] : null;
  const p = paper('crossref', { doi: m.DOI }, {
    title: (m.title || [])[0], abstract: m.abstract, year, venue: (m['container-title'] || [])[0],
    citations: m['is-referenced-by-count'],
  });
  return { ok: !!p, title: p ? p.title : null, paper: p };
}

module.exports = {
  name: 'crossref', label: 'Crossref', fields: 'all fields (metadata only)',
  canSearch: false, resolves: ['doi'], count, search, resolve,
};
