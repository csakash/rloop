// Contracts and ids: what each stage's output must look like.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../lib/contracts');
const ids = require('../lib/ids');

const claim = (over = {}) => ({ id: 'c1', source: 'doi:10.1000/x', subject: 'slow-wave sleep', relation: 'increases', object: 'motor memory', design: 'rct', n: 40, setting: 'older adults', quote: 'sleep improved recall', ...over });
const papers = new Set(['doi:10.1000/x']);

// protects=a well-formed claim from a fetched paper passes; fails_when=valid claims are rejected; no_claim=quote matches the abstract (citegate checks that)
test('claim: valid passes', () => assert.deepEqual(C.validateClaim(claim(), papers), { ok: true }));

// protects=claims must cite a fetched paper; fails_when=a claim cites a paper the run never fetched; no_claim=none beyond protects
test('claim: unfetched source rejected', () => assert.match(C.validateClaim(claim({ source: 'doi:10.2000/y' }), papers).error, /not one of the fetched papers/));

// protects=enum fields and quote length are enforced; fails_when=free-text relation/design or a >40-word quote slips through; no_claim=semantic correctness of the claim
test('claim: bad enums, n, long quote rejected', () => {
  assert.match(C.validateClaim(claim({ relation: 'boosts' }), papers).error, /relation/);
  assert.match(C.validateClaim(claim({ design: 'survey' }), papers).error, /design/);
  assert.match(C.validateClaim(claim({ n: -3 }), papers).error, /"n"/);
  assert.match(C.validateClaim(claim({ quote: Array(41).fill('w').join(' ') }), papers).error, /over 40 words/);
});

// protects=gaps need g-ids, a known signal, a question, and existing claim ids; fails_when=a gap without evidence or with an unknown claim passes; no_claim=question quality
test('gaps: structure and claim references', () => {
  const g = { id: 'g01', signal: 'weak-evidence', question: 'q?', why: 'w', claims: ['c1'] };
  const cl = new Set(['c1']);
  assert.equal(C.validateGaps([g], cl).ok, true);
  assert.match(C.validateGaps([], cl).error, /no gaps/);
  assert.match(C.validateGaps([{ ...g, claims: ['c9'] }], cl).error, /c9 does not exist/);
  assert.match(C.validateGaps([{ ...g, claims: [] }], cl).error, /at least one claim/);
  assert.match(C.validateGaps([g, g], cl).error, /duplicate/);
  assert.match(C.validateGaps([{ ...g, signal: 'hunch' }], cl).error, /signal/);
});

// protects=disprover summary/findings consistency (gloop rule) and gap scoping; fails_when="no issues" with findings, or a finding on a gap not under review, is accepted; no_claim=finding truth
test('disprove: summary consistency and gap scope', () => {
  const gapIds = new Set(['g01']);
  const f = { id: 'd1-01', gap: 'g01', severity: 'kills', class: 'answered-by-prior-work', summary: 's', sources: ['doi:10.1000/x'] };
  assert.equal(C.validateDisprove({ summary: 'no issues', findings: [] }, gapIds).ok, true);
  assert.equal(C.validateDisprove({ summary: '1 issue', findings: [f] }, gapIds).ok, true);
  assert.match(C.validateDisprove({ summary: 'no issues', findings: [f] }, gapIds).error, /no issues/);
  assert.match(C.validateDisprove({ summary: '2 issues', findings: [] }, gapIds).error, /no findings/);
  assert.match(C.validateDisprove({ summary: '1', findings: [{ ...f, gap: 'g07' }] }, gapIds).error, /gap under review/);
});

// protects="answered-by-prior-work" kills must cite the prior work, and sources must be valid ids; fails_when=an uncited kill or a junk source is accepted; no_claim=the cited work says what is claimed
test('disprove: prior-work kill must cite; ids must parse', () => {
  const gapIds = new Set(['g01']);
  const f = { id: 'd1-01', gap: 'g01', severity: 'kills', class: 'answered-by-prior-work', summary: 's', sources: [] };
  assert.match(C.validateDisprove({ summary: '1', findings: [f] }, gapIds).error, /must cite/);
  assert.match(C.validateDisprove({ summary: '1', findings: [{ ...f, sources: ['google.com'] }] }, gapIds).error, /not a valid id/);
  assert.equal(C.validateDisprove({ summary: '1', findings: [{ ...f, severity: 'weakens', class: 'mis-stated' }] }, gapIds).ok, true);
});

// protects=resolutions: dropped needs a reason; rebutted needs a fresh valid source; fails_when=a rebuttal re-cites only the finding's sources or has no reason; no_claim=the rebuttal is correct
test('resolution rules', () => {
  const f = { id: 'd1-01', sources: ['doi:10.1000/x'] };
  assert.equal(C.checkResolution(f, { status: 'dropped', reason: 'right' }).ok, true);
  assert.match(C.checkResolution(f, { status: 'dropped', reason: '' }).why, /without a reason/);
  assert.match(C.checkResolution(f, undefined).why, /no resolution/);
  assert.match(C.checkResolution(f, { status: 'rebutted', reason: 'r', sources: ['doi:10.1000/X'] }).why, /did not already cite/);
  assert.equal(C.checkResolution(f, { status: 'rebutted', reason: 'r', sources: ['pmid:123'] }).ok, true);
  assert.match(C.checkResolution(f, { status: 'ignored', reason: 'r' }).why, /unknown status/);
});

// protects=scores are integers 1-5 with a rationale per axis for every survivor; fails_when=a missing gap, 0/6 score or missing rationale passes; no_claim=calibration of scores
test('scores', () => {
  const s = { novelty: 3, importance: 4, tractability: 2, evidence_gap: 5, rationale: { novelty: 'a', importance: 'b', tractability: 'c', evidence_gap: 'd' } };
  assert.equal(C.validateScores({ g01: s }, ['g01']).ok, true);
  assert.match(C.validateScores({}, ['g01']).error, /no scores/);
  assert.match(C.validateScores({ g01: { ...s, novelty: 6 } }, ['g01']).error, /1-5/);
  assert.match(C.validateScores({ g01: { ...s, rationale: { novelty: 'a' } } }, ['g01']).error, /rationale/);
});

// protects=id normalization: DOI case/URL forms, arXiv versions, PMC prefix collapse to one canonical form; fails_when=the same paper gets two ids; no_claim=ids exist (citegate checks)
test('ids: normalize and canonical order', () => {
  assert.equal(ids.normalize('doi:https://doi.org/10.1038/NATURE14539'), 'doi:10.1038/nature14539');
  assert.equal(ids.normalize('arxiv:1706.03762v5'), 'arxiv:1706.03762');
  assert.equal(ids.normalize('pmcid:123'), 'pmcid:PMC123');
  assert.equal(ids.normalize('pmid:abc'), null);
  assert.equal(ids.normalize('nonsense'), null);
  assert.equal(ids.canonical(ids.cleanIds({ pmid: '1', doi: '10.1000/A', arxiv: '2101.00001' })), 'doi:10.1000/a');
  assert.equal(ids.canonical(ids.cleanIds({ s2: 'f'.repeat(40) })), `s2:${'f'.repeat(40)}`);
});

// protects=old-style arXiv ids and NCT ids parse; fails_when=valid ids from those sources are called malformed; no_claim=none beyond protects
test('ids: arxiv old style, nct', () => {
  assert.equal(ids.normalize('arxiv:hep-th/9901001'), 'arxiv:hep-th/9901001');
  assert.equal(ids.normalize('nct:nct01840839'), 'nct:NCT01840839');
});
