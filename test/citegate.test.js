// The citation gate, with an injected resolver (no network).
const test = require('node:test');
const assert = require('node:assert/strict');
const citegate = require('../lib/citegate');
const searchlog = require('../lib/searchlog');

const papers = [{ id: 'doi:10.1000/a', ids: { doi: '10.1000/a', pmid: '11' }, title: 'Paper A', abstract: 'Older adults showed reduced overnight gains in motor sequence learning.', source: 'pubmed' }];
const claims = [{ id: 'c0001', source: 'pmid:11', quote: 'reduced overnight gains in motor sequence learning' }];
const log = (gap, n, srcs) => Array.from({ length: n }, (_, i) => ({ role: 'disprover', op: 'search', gap, source: srcs[i % srcs.length], query: `q${i}` }));
const okResolve = async (id) => ({ ok: true, via: 'crossref', title: `T ${id}` });

function input(over = {}) {
  return {
    papers, claims,
    gaps: [{ id: 'g01', status: 'survived', claims: ['c0001'] }, { id: 'g02', status: 'dropped', claims: ['c0001'] }],
    findings: [{ id: 'd1-01', gap: 'g02', sources: ['doi:10.5555/prior'] }],
    resolutions: {},
    logEntries: log('g01', 10, ['openalex', 'pubmed']),
    resolve: okResolve,
    ...over,
  };
}

// protects=a clean run passes: fetched ids resolve locally, others via the resolver, quote verified, coverage met; fails_when=a valid run is blocked; no_claim=live resolution (resolver is injected)
test('passes a clean run', async () => {
  const r = await citegate.run(input());
  assert.deepEqual(r.problems, []);
  assert.equal(r.citations.find((c) => c.id === 'pmid:11').via, 'fetched:pubmed');
  assert.equal(r.citations.find((c) => c.id === 'doi:10.5555/prior').via, 'crossref');
  assert.equal(r.quotes[0].verified, true);
  assert.deepEqual(r.coverage.g01.sources, ['openalex', 'pubmed']);
});

// protects=AC4: one fake DOI blocks with "citation doi:… did not resolve"; fails_when=an unresolvable citation passes; no_claim=none beyond protects
test('blocks a fake DOI', async () => {
  const r = await citegate.run(input({
    findings: [{ id: 'd1-01', gap: 'g02', sources: ['doi:10.9999/fake'] }],
    resolve: async () => ({ ok: false, error: 'not found' }),
  }));
  assert.match(r.problems[0], /^citation doi:10\.9999\/fake did not resolve \(not found; cited by finding d1-01\)/);
});

// protects=AC5: a surviving gap with 3 disprover queries, or one source, blocks; fails_when=thin searching passes; no_claim=search quality (only counted)
test('blocks thin disprover coverage', async () => {
  let r = await citegate.run(input({ logEntries: log('g01', 3, ['openalex', 'pubmed']) }));
  assert.match(r.problems.join('\n'), /g01: disprover ran 3 queries across 2 sources/);
  r = await citegate.run(input({ logEntries: log('g01', 12, ['openalex']) }));
  assert.match(r.problems.join('\n'), /across 1 sources/);
  // duplicates, other roles, untagged and errored searches do not count
  const noisy = [...log('g01', 5, ['openalex', 'pubmed']), ...log('g01', 5, ['openalex', 'pubmed']), { role: 'author', op: 'search', gap: 'g01', source: 'arxiv', query: 'x' }, { role: 'disprover', op: 'search', gap: null, source: 'arxiv', query: 'y' }, { role: 'disprover', op: 'search', gap: 'g01', source: 'arxiv', query: 'z', error: 'HTTP 429' }];
  assert.equal(searchlog.coverage(noisy, 'disprover').g01.queries, 5);
});

// protects=a paraphrased quote is unverified, and a surviving gap with no verified claim blocks; fails_when=paraphrased evidence counts; no_claim=quotes from full text (abstracts only)
test('paraphrased quote is not verified', async () => {
  const r = await citegate.run(input({ claims: [{ ...claims[0], quote: 'older people learn motor skills worse overnight' }] }));
  assert.equal(r.quotes[0].verified, false);
  assert.match(r.problems.join('\n'), /g01: none of its claims has a quote found/);
});
