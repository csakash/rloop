// PubMed via NCBI E-utilities. https://www.ncbi.nlm.nih.gov/books/NBK25501/
// Keyless: 3 requests/s. NCBI_API_KEY raises it to 10/s.
const http = require('../http');
const { paper, tags, tag, clean, q } = require('./common');

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const BATCH = 200;

function common() {
  return `&tool=rloop${process.env.NCBI_API_KEY ? `&api_key=${q(process.env.NCBI_API_KEY)}` : ''}`;
}

async function esearch(query, retstart, retmax) {
  const url = `${BASE}/esearch.fcgi?db=pubmed&retmode=json&term=${q(query)}&retstart=${retstart}&retmax=${retmax}&sort=relevance${common()}`;
  const { status, json } = await http.getJSON(url);
  if (status !== 200) throw new Error(`pubmed esearch: HTTP ${status}`);
  const r = json.esearchresult || {};
  return { total: Number.parseInt(r.count, 10), ids: r.idlist || [] };
}

function parseArticles(xml) {
  return tags(xml, 'PubmedArticle').map(({ text: full }) => {
    // Cited references carry their own ArticleIds; never let them leak into this paper's ids.
    const text = full.replace(/<ReferenceList[\s\S]*?<\/ReferenceList>/g, '');
    const pmid = clean(tag(text, 'PMID'));
    const own = tag(tag(text, 'PubmedData') || '', 'ArticleIdList') || '';
    const doiTag = tags(own, 'ArticleId').find((t) => /IdType="doi"/.test(t.attrs))
      || tags(text, 'ELocationID').find((t) => /EIdType="doi"/.test(t.attrs));
    const pmcTag = tags(own, 'ArticleId').find((t) => /IdType="pmc"/.test(t.attrs));
    const abstract = tags(text, 'AbstractText').map((t) => {
      const label = (t.attrs.match(/Label="([^"]+)"/) || [])[1];
      return label ? `${label}: ${clean(t.text)}` : clean(t.text);
    }).join(' ');
    const pubDate = tag(text, 'PubDate') || '';
    const year = clean(tag(pubDate, 'Year')) || (clean(tag(pubDate, 'MedlineDate')).match(/\d{4}/) || [])[0];
    const types = tags(text, 'PublicationType').map((t) => clean(t.text).toLowerCase());
    let design;
    if (types.some((t) => t.includes('meta-analysis'))) design = 'meta-analysis';
    else if (types.some((t) => t.includes('randomized controlled trial'))) design = 'rct';
    else if (types.some((t) => t === 'review' || t.includes('systematic review'))) design = 'review';
    return paper('pubmed', { pmid, doi: doiTag ? clean(doiTag.text) : null, pmcid: pmcTag ? clean(pmcTag.text) : null }, {
      title: tag(text, 'ArticleTitle'),
      abstract,
      year,
      venue: tag(text, 'Title'),
      design,
    });
  }).filter(Boolean);
}

async function efetch(pmids) {
  if (!pmids.length) return [];
  const r = await http.get(`${BASE}/efetch.fcgi?db=pubmed&retmode=xml&id=${pmids.join(',')}${common()}`);
  if (r.status !== 200) throw new Error(`pubmed efetch: HTTP ${r.status}`);
  return parseArticles(r.text);
}

async function count(query) {
  return (await esearch(query, 0, 0)).total;
}

async function search(query, { limit = 25 } = {}) {
  const papers = [];
  let total = null;
  let start = 0;
  while (papers.length < limit) {
    const n = Math.min(BATCH, limit - papers.length);
    const res = await esearch(query, start, n);
    total = res.total;
    papers.push(...(await efetch(res.ids)));
    if (res.ids.length < n) break;
    start += n;
  }
  return { total, papers: papers.slice(0, limit) };
}

async function resolve(kind, value) {
  const papers = await efetch([value]);
  const p = papers.find((x) => x.ids.pmid === value);
  if (!p) return { ok: false, status: 404 };
  return { ok: true, title: p.title, paper: p };
}

module.exports = {
  name: 'pubmed', label: 'PubMed', fields: 'biomedicine and life sciences',
  canSearch: true, resolves: ['pmid'], count, search, resolve, parseArticles,
};
