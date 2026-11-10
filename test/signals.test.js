// Code-computed gap signals on a tiny hand-built claim set.
const test = require('node:test');
const assert = require('node:assert/strict');
const signals = require('../lib/signals');

let n = 0;
const cl = (subject, relation, object, extra = {}) => ({ id: `c${(n += 1)}`, source: `doi:10.1000/p${n}`, subject, relation, object, design: 'observational', n: null, setting: null, quote: 'q', ...extra });

// protects=missing-link: A-B and B-C each ≥3 claims, A-C never linked → flagged with B as the bridge; fails_when=an already-linked pair is flagged or the bridge is lost; no_claim=the link is scientifically plausible
test('missing-link', () => {
  const claims = [
    ...[1, 2, 3].map(() => cl('exercise', 'increases', 'slow-wave sleep')),
    ...[1, 2, 3].map(() => cl('slow-wave sleep', 'increases', 'motor memory')),
    ...[1, 2, 3].map(() => cl('slow-wave sleep', 'increases', 'glymphatic clearance')),
    cl('motor memory', 'associated', 'glymphatic clearance'),
  ];
  const s = signals.compute(claims, []);
  const pairs = s['missing-link'].map((m) => [m.a, m.c].sort().join('|'));
  assert.ok(pairs.includes('exercise|motor memory'));
  assert.ok(!pairs.includes('glymphatic clearance|motor memory'), 'linked pair not flagged');
  assert.deepEqual(s['missing-link'].find((m) => m.a === 'exercise' || m.c === 'exercise').via, ['slow-wave sleep']);
});

// protects=weak-evidence: ≥3 claims and no RCT/meta-analysis, or all n<100; fails_when=a pair with an RCT of n≥100 is flagged, or 3 observational claims are not; no_claim=quality of individual studies
test('weak-evidence', () => {
  const weak = [1, 2, 3].map(() => cl('napping', 'increases', 'recall', { n: 30 }));
  const strong = [cl('cbt-i', 'increases', 'sleep quality', { design: 'rct', n: 400 }), cl('cbt-i', 'increases', 'sleep quality'), cl('cbt-i', 'increases', 'sleep quality')];
  const s = signals.compute([...weak, ...strong], []);
  const keys = s['weak-evidence'].map((w) => [w.a, w.b].sort().join('|'));
  assert.ok(keys.includes('napping|recall'));
  assert.ok(!keys.includes('cbt-i|sleep quality'));
});

// protects=contradiction: increases vs decreases/no-effect on the same pair; fails_when=agreeing claims are flagged or opposing ones missed; no_claim=which side is right
test('contradiction', () => {
  const s = signals.compute([cl('caffeine', 'increases', 'consolidation'), cl('caffeine', 'no-effect', 'consolidation'), cl('melatonin', 'increases', 'sleep onset'), cl('melatonin', 'increases', 'sleep onset')], []);
  assert.deepEqual(s.contradiction.map((x) => [x.a, x.b].sort().join('|')), ['caffeine|consolidation']);
});

// protects=narrow-coverage: every claim on a pair shares one setting; fails_when=multi-setting pairs are flagged or a missing setting counts as one; no_claim=none beyond protects
test('narrow-coverage', () => {
  const s = signals.compute([
    cl('tdcs', 'increases', 'slow oscillation', { setting: 'young adults' }), cl('tdcs', 'increases', 'slow oscillations', { setting: 'Young adults' }),
    cl('rocking', 'increases', 'spindle', { setting: 'young adults' }), cl('rocking', 'increases', 'spindle', { setting: 'older adults' }),
  ], []);
  assert.deepEqual(s['narrow-coverage'].map((x) => x.setting), ['young adult']);
});

// protects=stated-limitation: limitation phrases in ≥2 abstracts grouped by the concepts of those papers' claims; fails_when=one paper alone triggers it or phrases are missed; no_claim=the limitation is still open
test('stated-limitation', () => {
  const c1 = cl('sleep spindle', 'associated', 'memory', { source: 'doi:10.9999/a' });
  const c2 = cl('sleep spindle', 'associated', 'aging', { source: 'doi:10.9999/b' });
  const papers = [
    { id: 'doi:10.9999/a', ids: { doi: '10.9999/a' }, abstract: 'The mechanism remains unclear in humans.' },
    { id: 'doi:10.9999/b', ids: { doi: '10.9999/b' }, abstract: 'Further research is needed.' },
  ];
  const s = signals.compute([c1, c2], papers);
  const sp = s['stated-limitation'].find((x) => x.concept === 'sleep spindle');
  assert.ok(sp);
  assert.equal(sp.papers.length, 2);
  assert.ok(sp.phrases.includes('remains unclear'));
});
