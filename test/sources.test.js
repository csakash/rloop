// Source clients parse recorded API responses (semanticscholar: hand-written, see its fixture note).
const test = require('node:test');
const assert = require('node:assert/strict');
const { useFixtures } = require('./helpers');
const sources = require('../lib/sources');

const Q = 'sleep procedural memory older adults';

// protects=OpenAlex count + abstract rebuilt from inverted index + DOI canonical id; fails_when=meta.count or inverted-index parsing breaks; no_claim=live API still returns this shape
test('openalex: count, search, resolve', async () => {
  useFixtures('openalex');
  const s = sources.get('openalex');
  assert.equal(await s.count(Q), 17990);
  const r = await s.search(Q, { limit: 3 });
  assert.equal(r.papers.length, 3);
  const p = r.papers.find((x) => x.id === 'doi:10.1101/lm.803708');
  assert.ok(p, 'DOI becomes the canonical id');
  assert.ok(p.ids.openalex.startsWith('W'));
  assert.ok(p.abstract.length > 100 && /sleep/i.test(p.abstract), 'abstract rebuilt from inverted index');
  const res = await s.resolve('doi', '10.1101/lm.803708');
  assert.equal(res.ok, true);
  assert.match(res.title, /Sleep in children/);
});

// protects=papers without a DOI fall back to the OpenAlex id; fails_when=a DOI-less work is dropped or gets a null id; no_claim=none beyond protects
test('openalex: work without DOI keeps an openalex id', async () => {
  useFixtures('openalex');
  const r = await sources.get('openalex').search(Q, { limit: 3 });
  assert.ok(r.papers.some((p) => p.id.startsWith('openalex:W')));
});

// protects=S2 externalIds mapping (DOI lowercased, ArXiv, bare S2 id); fails_when=id preference order or field names change; no_claim=fixture is hand-written, not a live S2 response
test('semanticscholar: count, search id mapping, resolve', async () => {
  useFixtures('semanticscholar');
  const s = sources.get('semanticscholar');
  assert.equal(await s.count(Q), 4210);
  const r = await s.search(Q, { limit: 3 });
  assert.deepEqual(r.papers.map((p) => p.id), ['doi:10.1016/j.neurobiolaging.2010.01.001', 'arxiv:2101.00001', 's2:ffeeddccbbaa99887766554433221100ffeeddcc']);
  assert.equal(r.papers[0].ids.pmid, '20117776');
  assert.equal(r.papers[1].abstract, '', 'null abstract becomes empty string');
  assert.equal((await s.resolve('doi', '10.1038/nature14539')).title, 'Deep learning');
});

// protects=arXiv Atom parsing (totalResults, id without version, summary, year); fails_when=XML extraction misses entries or keeps vN suffix; no_claim=arXiv query syntax quality
test('arxiv: count, search, resolve', async () => {
  useFixtures('arxiv');
  const s = sources.get('arxiv');
  assert.equal(await s.count('transformer attention protein folding'), 13);
  const r = await s.search('transformer attention protein folding', { limit: 3 });
  assert.equal(r.papers.length, 3);
  for (const p of r.papers) {
    assert.match(p.id, /^arxiv:\d{4}\.\d{4,5}$/);
    assert.ok(p.abstract.length > 200);
    assert.ok(p.year >= 2019);
  }
  const res = await s.resolve('arxiv', '1706.03762');
  assert.equal(res.title, 'Attention Is All You Need');
});

// protects=unknown arXiv id is "not found", not a crash or a false hit; fails_when=error entry is parsed as a paper; no_claim=none beyond protects
test('arxiv: unknown id does not resolve', async () => {
  useFixtures('arxiv');
  const res = await sources.get('arxiv').resolve('arxiv', '9999.99999');
  assert.equal(res.ok, false);
});

// protects=arXiv query building: plain words AND-ed, field queries passed through; fails_when=queries lose terms or double-prefix; no_claim=relevance of results
test('arxiv: query translation', () => {
  const { toQuery } = sources.get('arxiv');
  assert.equal(toQuery('sleep and memory'), 'all:sleep AND all:memory');
  assert.equal(toQuery('"slow wave" sleep'), 'all:"slow wave" AND all:sleep');
  assert.equal(toQuery('ti:transformer AND cat:cs.LG'), 'ti:transformer AND cat:cs.LG');
});

// protects=PubMed esearch count + efetch XML (labelled abstract sections, DOI, RCT design from PublicationType); fails_when=XML tags or design mapping break; no_claim=PubMed relevance ranking
test('pubmed: count, search, resolve', async () => {
  useFixtures('pubmed');
  const s = sources.get('pubmed');
  assert.equal(await s.count(Q), 2502);
  const r = await s.search(Q, { limit: 3 });
  assert.equal(r.papers.length, 3);
  assert.ok(r.papers.every((p) => p.ids.pmid && p.abstract.length > 500));
  assert.ok(r.papers.some((p) => p.design === 'rct'), 'RCT publication type maps to design rct');
  const res = await s.resolve('pmid', '31452104');
  assert.equal(res.ok, true);
  assert.match(res.title, /Molegro/);
});

// protects=Europe PMC hitCount, core results with DOI/PMCID ids, resolve by PMID; fails_when=field names or cursor paging break; no_claim=full-text availability
test('europepmc: count, search, resolve', async () => {
  useFixtures('europepmc');
  const s = sources.get('europepmc');
  assert.equal(await s.count(Q), 2617);
  const r = await s.search(Q, { limit: 3 });
  assert.equal(r.papers.length, 3);
  assert.ok(r.papers.some((p) => p.id.startsWith('pmcid:') || p.id.startsWith('doi:')));
  assert.equal((await s.resolve('pmid', '31452104')).ok, true);
});

// protects=Crossref total-results count and DOI resolve, 404 for a fake DOI; fails_when=a missing DOI resolves or count path changes; no_claim=Crossref search (not used)
test('crossref: count, resolve, fake DOI fails', async () => {
  useFixtures('crossref');
  const s = sources.get('crossref');
  assert.equal(await s.count(Q), 1570764);
  assert.equal((await s.resolve('doi', '10.1038/nature14539')).title, 'Deep learning');
  assert.equal((await s.resolve('doi', '10.9999/fake.doi.123')).ok, false);
  await assert.rejects(() => s.search(Q), /count\/resolve only/);
});

// protects=ClinicalTrials.gov v2 totalCount, NCT ids, randomized allocation → rct; fails_when=protocolSection paths change; no_claim=trial results data (not fetched)
test('clinicaltrials: count, search, resolve', async () => {
  useFixtures('clinicaltrials');
  const s = sources.get('clinicaltrials');
  assert.equal(await s.count(Q), 19);
  const r = await s.search(Q, { limit: 3 });
  assert.ok(r.papers.every((p) => /^nct:NCT\d{8}$/.test(p.id)));
  assert.ok(r.papers.some((p) => p.design === 'rct'));
  assert.equal((await s.resolve('nct', 'NCT01840839')).ok, true);
});

// protects=resolveId routing and fallback: DOI via Crossref, malformed ids rejected, unknown DOI "not found"; fails_when=a fake id resolves or routing skips a source; no_claim=openalex fallback ordering beyond crossref
test('resolveId: routing and failures', async () => {
  useFixtures('crossref', 'arxiv');
  assert.equal((await sources.resolveId('doi:10.1038/NATURE14539')).ok, true);
  assert.equal((await sources.resolveId('arxiv:1706.03762v5')).ok, true, 'version suffix is ignored');
  assert.equal((await sources.resolveId('not-an-id')).error, 'malformed id');
  const fake = await sources.resolveId('doi:10.9999/fake.doi.123');
  assert.equal(fake.ok, false);
  assert.ok(fake.tried.some((t) => t.source === 'crossref'));
});

// protects=list() reports which sources can search; fails_when=crossref is offered for fetching; no_claim=none beyond protects
test('registry lists 7 sources, crossref count-only', () => {
  const l = sources.list();
  assert.equal(l.length, 7);
  assert.equal(l.find((s) => s.name === 'crossref').canSearch, false);
  assert.throws(() => sources.get('scopus'), /unknown source/);
});
