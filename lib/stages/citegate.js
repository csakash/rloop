// citegate stage: no LLM. Writes proof/ and blocks on any unresolved citation or thin search.
const fs = require('fs');
const path = require('path');
const citegate = require('../citegate');
const searchlog = require('../searchlog');
const sources = require('../sources');
const { Blocked, readJSONL, seal, verifySeals } = require('../runctx');

async function stage(ctx, { resolve = sources.resolveId } = {}) {
  verifySeals(ctx, 'citegate');
  if (!ctx.logKey) throw new Blocked('citegate', 'no search-log key: disprove and citegate must run in one rloop invocation');
  const read = (f, d) => (fs.existsSync(path.join(ctx.runDir, f)) ? JSON.parse(fs.readFileSync(path.join(ctx.runDir, f), 'utf8')) : d);
  const findings = fs.existsSync(path.join(ctx.runDir, 'disprove'))
    ? fs.readdirSync(path.join(ctx.runDir, 'disprove')).filter((f) => /^cycle-\d+\.json$/.test(f)).flatMap((f) => read(`disprove/${f}`, { findings: [] }).findings)
    : [];
  const res = await citegate.run({
    papers: readJSONL(path.join(ctx.runDir, 'papers.jsonl')),
    claims: readJSONL(path.join(ctx.runDir, 'claims.jsonl')),
    gaps: read('gaps.json', []),
    findings,
    resolutions: read('disprove/resolutions.json', {}),
    logEntries: searchlog.read(ctx.runDir, ctx.logKey),
    thresholds: ctx.thresholds,
    resolve,
  });
  const proof = path.join(ctx.runDir, 'proof');
  fs.mkdirSync(proof, { recursive: true });
  fs.writeFileSync(path.join(proof, 'citations.json'), `${JSON.stringify(res.citations, null, 2)}\n`);
  fs.writeFileSync(path.join(proof, 'quotes.json'), `${JSON.stringify(res.quotes, null, 2)}\n`);
  fs.writeFileSync(path.join(proof, 'search-coverage.json'), `${JSON.stringify({ thresholds: res.thresholds, gaps: res.coverage }, null, 2)}\n`);
  fs.writeFileSync(path.join(proof, 'citegate-problems.json'), `${JSON.stringify(res.problems, null, 2)}\n`);
  seal(ctx, 'proof/citations.json', 'proof/quotes.json', 'proof/search-coverage.json', 'proof/citegate-problems.json');
  const resolved = res.citations.filter((c) => c.resolved).length;
  const quotesOk = res.quotes.filter((q) => q.verified).length;
  ctx.log(`  citations ${resolved}/${res.citations.length} resolved, quotes ${quotesOk}/${res.quotes.length} verified`);
  if (res.problems.length) {
    const first = res.problems.find((p) => p.startsWith('citation')) || res.problems[0];
    throw new Blocked('citegate', `${first}${res.problems.length > 1 ? ` (+${res.problems.length - 1} more in proof/)` : ''}`);
  }
  return { citations: { checked: res.citations.length, failed: res.citations.length - resolved }, quotes: { checked: res.quotes.length, verified: quotesOk } };
}

module.exports = { stage };
