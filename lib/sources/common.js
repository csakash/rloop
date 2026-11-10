// Shared helpers for source clients: the paper shape, XML text extraction, query encoding.
const ids = require('../ids');

// The one paper shape every client returns.
function paper(source, rawIds, { title, abstract, year, venue, citations, design } = {}) {
  const idMap = ids.cleanIds(rawIds);
  const id = ids.canonical(idMap);
  if (!id) return null;
  return {
    id,
    ids: idMap,
    title: clean(title),
    abstract: clean(abstract),
    year: Number.isInteger(year) ? year : (Number.parseInt(year, 10) || null),
    venue: clean(venue) || null,
    citations: Number.isInteger(citations) ? citations : null,
    ...(design ? { design } : {}),
    source,
  };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] ?? m));
}

function clean(s) {
  if (s === null || s === undefined) return '';
  return decode(String(s)).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// All inner texts of <tag ...>...</tag> (non-nested tags only).
function tags(xml, tag) {
  const re = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  return [...String(xml).matchAll(re)].map((m) => ({ attrs: m[1] || '', text: m[2] }));
}

function tag(xml, t) {
  const all = tags(xml, t);
  return all.length ? all[0].text : null;
}

function q(s) {
  return encodeURIComponent(s);
}

module.exports = { paper, decode, clean, tags, tag, q };
