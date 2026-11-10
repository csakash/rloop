// arXiv API (Atom). https://info.arxiv.org/help/api/user-manual.html
// arXiv asks for one request every 3 seconds; http.js spaces export.arxiv.org at 3.1s.
const http = require('../http');
const { paper, tags, tag, clean, q } = require('./common');

const BASE = 'https://export.arxiv.org/api/query';

// Plain words become all:w1 AND all:w2. A query that already uses field prefixes
// (ti:, abs:, all:, cat:, au:) is passed through unchanged.
function toQuery(s) {
  if (/\b(ti|abs|all|cat|au|co|jr|rn|id):/.test(s)) return s;
  const phrases = [...s.matchAll(/"([^"]+)"/g)].map((m) => `all:"${m[1]}"`);
  const rest = s.replace(/"[^"]+"/g, ' ').split(/\s+/).filter((w) => w && !/^(and|or|the|of|in|a|an)$/i.test(w));
  return [...phrases, ...rest.map((w) => `all:${w}`)].join(' AND ');
}

function parseFeed(xml) {
  const total = Number.parseInt(clean(tag(xml, 'opensearch:totalResults')), 10);
  const papers = tags(xml, 'entry').map(({ text }) => {
    const absUrl = clean(tag(text, 'id'));
    const m = absUrl.match(/arxiv\.org\/abs\/(.+)$/);
    const published = clean(tag(text, 'published'));
    return paper('arxiv', { arxiv: m ? m[1] : null, doi: clean(tag(text, 'arxiv:doi')) || null }, {
      title: tag(text, 'title'),
      abstract: tag(text, 'summary'),
      year: published ? Number.parseInt(published.slice(0, 4), 10) : null,
      venue: clean(tag(text, 'arxiv:journal_ref')) || 'arXiv',
    });
  }).filter(Boolean);
  return { total: Number.isFinite(total) ? total : null, papers };
}

async function fetchFeed(url) {
  const r = await http.get(url);
  if (r.status !== 200) throw new Error(`arxiv: HTTP ${r.status}`);
  return parseFeed(r.text);
}

async function count(query) {
  return (await fetchFeed(`${BASE}?search_query=${q(toQuery(query))}&start=0&max_results=1`)).total;
}

async function search(query, { limit = 25 } = {}) {
  const papers = [];
  let total = null;
  let start = 0;
  while (papers.length < limit) {
    const n = Math.min(100, limit - papers.length);
    const res = await fetchFeed(`${BASE}?search_query=${q(toQuery(query))}&start=${start}&max_results=${n}&sortBy=relevance`);
    total = res.total;
    papers.push(...res.papers);
    if (res.papers.length < n) break;
    start += n;
  }
  return { total, papers: papers.slice(0, limit) };
}

async function resolve(kind, value) {
  const res = await fetchFeed(`${BASE}?id_list=${q(value)}&max_results=1`);
  const p = res.papers[0];
  // arXiv answers an unknown id with an empty feed or an error entry without an abs URL.
  if (!p || !p.ids.arxiv || p.ids.arxiv !== value) return { ok: false, status: 404 };
  return { ok: true, title: p.title, paper: p };
}

module.exports = {
  name: 'arxiv', label: 'arXiv', fields: 'CS, physics, math, quantitative biology, statistics, economics',
  canSearch: true, resolves: ['arxiv'], count, search, resolve, parseFeed, toQuery,
};
