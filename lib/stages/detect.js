// detect: compute signals in code, then the author turns them into specific gaps.
const fs = require('fs');
const path = require('path');
const agent = require('../agent');
const signals = require('../signals');
const { validateGaps } = require('../contracts');
const { Blocked, readJSONL, readJSONFile, prompt } = require('../runctx');

const MAX_GAPS = 12;

async function detect(ctx) {
  const claims = readJSONL(path.join(ctx.runDir, 'claims.jsonl'));
  const papers = readJSONL(path.join(ctx.runDir, 'papers.jsonl'));
  if (claims.length === 0) throw new Blocked('detect', 'no claims to detect gaps from');
  const sig = signals.compute(claims, papers, ctx.research.signals || {});
  fs.writeFileSync(path.join(ctx.runDir, 'signals.json'), `${JSON.stringify(sig, null, 2)}\n`);
  ctx.log(`  signals: ${['missing-link', 'weak-evidence', 'contradiction', 'narrow-coverage', 'stated-limitation'].map((k) => `${k} ${sig[k].length}`).join(', ')}`);

  const claimIds = new Set(claims.map((c) => c.id));
  let error = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let text = prompt('detect', { claimCount: claims.length, paperCount: papers.length, maxGaps: MAX_GAPS, rsearch: agent.RSEARCH });
    if (error) text += `\n\nYour previous gaps.json was rejected: ${error}\nRewrite gaps.json, fixing this.`;
    await agent.run(ctx, { role: 'author', stage: 'detect', label: `detect${attempt > 1 ? '-retry' : ''}`, prompt: text });
    const r = readJSONFile(path.join(ctx.runDir, 'gaps.json'));
    if (!r.ok) { error = r.error; continue; }
    const v = validateGaps(r.value, claimIds);
    if (!v.ok) { error = v.error; continue; }
    const gaps = r.value.map((g) => ({ ...g, status: 'open' }));
    fs.writeFileSync(path.join(ctx.runDir, 'gaps.json'), `${JSON.stringify(gaps, null, 2)}\n`);
    ctx.log(`  ${gaps.length} candidate gaps`);
    return { gaps: gaps.length };
  }
  throw new Blocked('detect', `gap detection failed twice: ${error}`);
}

module.exports = { detect, MAX_GAPS };
