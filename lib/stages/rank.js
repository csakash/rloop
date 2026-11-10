// rank: the author scores surviving gaps; the runner orders them and writes REPORT.md from
// the checked data (so the report can only cite what citegate verified).
const fs = require('fs');
const path = require('path');
const agent = require('../agent');
const { validateScores, SCORE_KEYS } = require('../contracts');
const { Blocked, readJSONL, readJSONFile, prompt, seal } = require('../runctx');

function load(ctx, f, d) {
  const p = path.join(ctx.runDir, f);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : d;
}

function survivors(ctx) {
  const gaps = load(ctx, 'gaps.json', []);
  const claims = new Map(readJSONL(path.join(ctx.runDir, 'claims.jsonl')).map((c) => [c.id, c]));
  const quotes = new Map(load(ctx, 'proof/quotes.json', []).map((q) => [q.claim, q.verified]));
  const cov = load(ctx, 'proof/search-coverage.json', { gaps: {} }).gaps;
  return gaps.filter((g) => g.status === 'survived').map((g) => ({
    id: g.id, signal: g.signal, question: g.question, why: g.why,
    claims: g.claims.map((id) => claims.get(id)).filter((c) => c && quotes.get(c.id)),
    weakens: (g.findings || []).filter((f) => f.severity === 'weakens'),
    disproverCoverage: cov[g.id] || null,
  }));
}

async function rank(ctx) {
  const surv = survivors(ctx);
  if (!surv.length) {
    fs.writeFileSync(path.join(ctx.runDir, 'scores.json'), '{}\n');
    writeReport(ctx, {});
    return { ranked: 0 };
  }
  fs.writeFileSync(path.join(ctx.runDir, 'survivors.json'), `${JSON.stringify(surv, null, 2)}\n`);
  let error = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let text = prompt('rank', { count: surv.length });
    if (error) text += `\n\nYour previous scores.json was rejected: ${error}. Rewrite it, fixing this.`;
    await agent.run(ctx, { role: 'author', stage: 'rank', label: `rank${attempt > 1 ? '-retry' : ''}`, prompt: text, inputs: ['brief.md', 'survivors.json'], outputs: ['scores.json'] });
    const r = readJSONFile(path.join(ctx.runDir, 'scores.json'));
    if (!r.ok) { error = r.error; continue; }
    const v = validateScores(r.value, surv.map((g) => g.id));
    if (!v.ok) { error = v.error; continue; }
    applyScores(ctx, r.value);
    writeReport(ctx, r.value);
    return { ranked: surv.length };
  }
  throw new Blocked('rank', `ranking failed twice: ${error}`);
}

function total(s) {
  return SCORE_KEYS.reduce((a, k) => a * s[k], 1);
}

function applyScores(ctx, scores) {
  const gaps = load(ctx, 'gaps.json', []);
  const ranked = gaps.filter((g) => scores[g.id]).sort((a, b) => total(scores[b.id]) - total(scores[a.id]) || a.id.localeCompare(b.id));
  ranked.forEach((g, i) => {
    const s = scores[g.id];
    g.scores = Object.fromEntries(SCORE_KEYS.map((k) => [k, s[k]]));
    g.rationale = s.rationale;
    g.score = total(s);
    g.rank = i + 1;
  });
  fs.writeFileSync(path.join(ctx.runDir, 'gaps.json'), `${JSON.stringify(gaps, null, 2)}\n`);
  seal(ctx, 'gaps.json');
}

function writeReport(ctx, scores) {
  const gaps = load(ctx, 'gaps.json', []);
  const papers = new Map();
  for (const p of readJSONL(path.join(ctx.runDir, 'papers.jsonl'))) papers.set(p.id, p);
  const claims = new Map(readJSONL(path.join(ctx.runDir, 'claims.jsonl')).map((c) => [c.id, c]));
  const quotes = new Map(load(ctx, 'proof/quotes.json', []).map((q) => [q.claim, q.verified]));
  const cov = load(ctx, 'proof/search-coverage.json', { gaps: {}, thresholds: {} });
  const cites = load(ctx, 'proof/citations.json', []);
  const titles = new Map(cites.map((c) => [c.id, c.title]));
  const fetch = load(ctx, 'fetch.json', {});
  const srcRows = load(ctx, 'sources.json', []);
  const survived = gaps.filter((g) => g.status === 'survived').sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const dropped = gaps.filter((g) => g.status === 'dropped');
  const ref = (id) => {
    const p = papers.get(id);
    const t = p ? p.title : titles.get(id);
    return `${t ? `${t}` : 'untitled'}${p && p.year ? ` (${p.year})` : ''} \`${id}\``;
  };

  const L = [];
  L.push(`# Research gaps: ${ctx.topicTitle}`, '');
  L.push(`Run \`${path.basename(ctx.runDir)}\` · ${new Date().toISOString().slice(0, 10)} · rloop v0.1`, '');
  L.push('## Summary', '');
  L.push(`- Papers: ${fetch.fetched ?? '?'} fetched (asked for ${fetch.requested ?? '?'}) from ${srcRows.filter((s) => (fetch.plan || []).some((p) => p.source === s.source)).map((s) => `${s.source} (${s.count} available)`).join(', ')}`);
  L.push(`- Claims extracted: ${claims.size}; quotes verified against abstracts: ${[...quotes.values()].filter(Boolean).length}`);
  L.push(`- Gaps proposed: ${gaps.length}; killed by the disprover: ${dropped.length}; survived: ${survived.length}`);
  L.push(`- Disprover bar per surviving gap: ≥ ${cov.thresholds.minQueries} searches across ≥ ${cov.thresholds.minSources} databases (from the search log)`);
  L.push(`- Citations checked by code: ${cites.length}, unresolved: ${cites.filter((c) => !c.resolved).length}`, '');

  L.push('## Surviving gaps, ranked', '');
  if (!survived.length) L.push('No gap survived the disprover. See the dropped gaps below for what already answers them.', '');
  for (const g of survived) {
    const s = scores[g.id] || g.scores;
    L.push(`### ${g.rank ? `${g.rank}. ` : ''}${g.question}`, '');
    L.push(`\`${g.id}\` · signal: ${g.signal}${s ? ` · score ${total(s)} (novelty ${s.novelty}, importance ${s.importance}, tractability ${s.tractability}, evidence gap ${s.evidence_gap})` : ''}`, '');
    L.push(g.why, '');
    const ev = g.claims.map((id) => claims.get(id)).filter((c) => c && quotes.get(c.id));
    if (ev.length) {
      L.push('**Evidence it rests on**', '');
      for (const c of ev) L.push(`- ${c.subject} *${c.relation}* ${c.object} (${c.design}${c.n ? `, n=${c.n}` : ''}${c.setting ? `, ${c.setting}` : ''}): "${c.quote}" ${ref(c.source)}`);
      L.push('');
    }
    const cv = cov.gaps[g.id];
    if (cv) L.push(`**Disprover:** ${cv.queries} searches across ${cv.sources.join(', ')}; no work found that answers it.`, '');
    const weak = (g.findings || []).filter((f) => f.severity === 'weakens');
    if (weak.length) {
      L.push('**Caveats raised by the disprover**', '');
      for (const f of weak) L.push(`- ${f.summary}${f.sources.length ? ` (${f.sources.map(ref).join('; ')})` : ''}`);
      L.push('');
    }
    if (s && s.rationale) {
      L.push('<details><summary>Score rationale</summary>', '');
      for (const k of SCORE_KEYS) L.push(`- ${k}: ${s.rationale[k]}`);
      L.push('', '</details>', '');
    }
  }

  if (dropped.length) {
    L.push('## Dropped gaps (already answered or not real)', '');
    for (const g of dropped) {
      const f = (g.findings || []).find((x) => x.id === g.droppedBy) || {};
      L.push(`- **${g.question}** \`${g.id}\`: ${f.class || 'dropped'}. ${f.summary || ''}${(f.sources || []).length ? ` Prior work: ${f.sources.map(ref).join('; ')}.` : ''} Author: ${g.dropReason || ''}`);
    }
    L.push('');
  }
  L.push('## How this was produced', '');
  L.push('scope → (human picked paper count) → fetch + claim extraction → code signals + gap proposals → independent disprover (read-only, web + databases) ⇄ author drop/rebut → citation gate (no LLM) → ranking. Every id above resolved in a live database or was fetched in this run; every quote was matched against its abstract by code. Raw data: `gaps.json`, `claims.jsonl`, `proof/`.', '');
  fs.writeFileSync(path.join(ctx.runDir, 'REPORT.md'), L.join('\n'));
}

module.exports = { rank, survivors, writeReport, total };
