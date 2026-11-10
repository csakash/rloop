// Europe PMC REST. https://europepmc.org/RestfulWebService
const http = require('../http');
const { paper, q } = require('./common');

const BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

function toPaper(r) {
  if (!r) return null;
  const types = ((r.pubTypeList && r.pubTypeList.pubType) || []).map((t) => String(t).toLowerCase());
  let design;
  if (types.some((t) => t.includes('meta-analysis'))) design = 'meta-analysis';
  else if (types.some((t) => t.includes('randomized controlled trial'))) design = 'rct';
  return paper('europepmc', { doi: r.doi, pmid: r.pmid, pmcid: r.pmcid }, {
    title: r.title,
    abstract: r.abstractText,
    year: r.pubYear,
    venue: r.journalTitle || (r.journalInfo && r.journalInfo.journal && r.journalInfo.journal.title),
    citations: r.citedByCount,
    design,
  });
}

async function page(query, size, cursor) {
  const url = `${BASE}?query=${q(query)}&format=json&resultType=core&pageSize=${size}&cursorMark=${q(cursor)}`;
  const { status, json } = await http.getJSON(url);
  if (status !== 200) throw new Error(`europepmc: HTTP ${status}`);
  return json;
}

async function count(query) {
  const { status, json } = await http.getJSON(`${BASE}?query=${q(query)}&format=json&resultType=idlist&pageSize=1`);
  if (status !== 200) throw new Error(`europepmc count: HTTP ${status}`);
  return json.hitCount;
}

async function search(query, { limit = 25 } = {}) {
  const papers = [];
  let total = null;
  let cursor = '*';
  while (papers.length < limit) {
    const n = Math.min(1000, limit - papers.length);
    const json = await page(query, n, cursor);
    total = json.hitCount;
    const rows = (json.resultList && json.resultList.result) || [];
    papers.push(...rows.map(toPaper).filter(Boolean));
    if (rows.length < n || !json.nextCursorMark || json.nextCursorMark === cursor) break;
    cursor = json.nextCursorMark;
  }
  return { total, papers: papers.slice(0, limit) };
}

const FIELD = { pmid: (v) => `EXT_ID:${v} AND SRC:MED`, pmcid: (v) => `PMCID:${v}`, doi: (v) => `DOI:"${v}"` };

async function resolve(kind, value) {
  const json = await page(FIELD[kind](value), 1, '*');
  const p = toPaper(((json.resultList && json.resultList.result) || [])[0]);
  if (!p || p.ids[kind] !== value) return { ok: false, status: 404 };
  return { ok: true, title: p.title, paper: p };
}

module.exports = {
  name: 'europepmc', label: 'Europe PMC', fields: 'life sciences, with open full text and preprints',
  canSearch: true, resolves: ['pmcid', 'pmid', 'doi'], count, search, resolve, toPaper,
};
