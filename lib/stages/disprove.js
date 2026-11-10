// disprove ⇄ resolve: a fresh-context disprover attacks the gaps; the author drops or rebuts.
// Convergence reuses gloop's review store (ingest / openIds / counts): `kills` maps to
// gloop's `important` (blocks) and `weakens` to `nit` (never blocks).
const fs = require('fs');
const path = require('path');
const agent = require('../agent');
const gloop = require('../gloop');
const sources = require('../sources');
const { validateDisprove, validateGaps, checkResolution } = require('../contracts');
const { Blocked, readJSONL, readJSONFile, prompt, snapshot, seal } = require('../runctx');
const { run: git } = gloop.util;

const SNAP_IGNORE = ['search-log.jsonl', 'logs'];

function toStore(f) {
  return { ...f, severity: f.severity === 'kills' ? 'important' : 'nit', rloopSeverity: f.severity, file: f.gap, line: 1 };
}

function treeState(ctx) {
  const gitState = ctx.topicDir
    ? `${git('git', ['-C', ctx.topicDir, 'rev-parse', 'HEAD'], { allowFail: true })}\n${git('git', ['-C', ctx.topicDir, 'status', '--porcelain'], { allowFail: true })}`
    : '';
  return `${snapshot(ctx.runDir, SNAP_IGNORE)}\n${gitState}`;
}

async function disproveOnce(ctx, k, reviewGaps, previous) {
  const dir = path.join(ctx.runDir, 'disprove');
  fs.mkdirSync(dir, { recursive: true });
  const gapsFile = `disprove/review-${k}.json`;
  fs.writeFileSync(path.join(ctx.runDir, gapsFile), `${JSON.stringify(reviewGaps, null, 2)}\n`);
  const prevText = previous.length
    ? `\nThis is a re-review. These gaps were rebutted by their author after your earlier findings. Earlier findings and the author's resolutions are in \`disprove/previous-${k}.json\`; judge whether each rebuttal holds.`
    : '';
  if (previous.length) fs.writeFileSync(path.join(ctx.runDir, `disprove/previous-${k}.json`), `${JSON.stringify(previous, null, 2)}\n`);
  const t = ctx.thresholds;
  let error = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let text = prompt('disprove', {
      cycle: k, gapsFile, previous: prevText, rsearch: agent.RSEARCH,
      searchable: sources.list().filter((s) => s.canSearch).map((s) => s.name).join(', '),
      minQueries: t.minQueries, minSources: t.minSources,
      noRepeat: previous.length ? `- Do not re-report a finding id already listed in disprove/previous-${k}.json unless the rebuttal fails; then reuse that id.` : '',
    });
    if (error) text += `\n\nYour previous report was rejected: ${error}. Report again as one fenced JSON block.`;
    const before = treeState(ctx);
    const res = await agent.run(ctx, { role: 'disprover', stage: 'disprove', label: `disprove-${k}${attempt > 1 ? '-retry' : ''}`, prompt: text });
    if (treeState(ctx) !== before) throw new Blocked('disprove', 'reviewer modified tree');
    const web = res.tools.filter((x) => x.name === 'WebSearch' || x.name === 'WebFetch').map((x) => ({ tool: x.name, input: x.input }));
    fs.writeFileSync(path.join(dir, `cycle-${k}.tools.json`), `${JSON.stringify({ stream: res.stream, toolCalls: res.tools.length, web }, null, 2)}\n`);
    const doc = gloop.review.extractJSON(res.text);
    const v = validateDisprove(doc, new Set(reviewGaps.map((g) => g.id)));
    if (!v.ok) { error = v.error; continue; }
    doc.cycle = k;
    fs.writeFileSync(path.join(dir, `cycle-${k}.json`), `${JSON.stringify(doc, null, 2)}\n`);
    return doc;
  }
  throw new Blocked('disprove', `disprover output invalid twice: ${error}`);
}

async function resolveOnce(ctx, round, open, rejected) {
  const findingsFile = `disprove/open-${round}.json`;
  const resolutionsFile = `disprove/resolutions-${round}.json`;
  fs.writeFileSync(path.join(ctx.runDir, findingsFile), `${JSON.stringify(open, null, 2)}\n`);
  seal(ctx, findingsFile);
  let text = prompt('resolve', { cycle: round, findingsFile, resolutionsFile, rsearch: agent.RSEARCH });
  if (rejected.length) {
    text += `\n\nSome of your previous resolutions were rejected and those findings are still open:\n${rejected.map((x) => `- ${x.id}: ${x.why}`).join('\n')}\nResolve them again in ${resolutionsFile}.`;
  }
  await agent.run(ctx, { role: 'author', stage: 'resolve', label: `resolve-${round}`, prompt: text });
  // The author may narrow a gap's question/why in gaps.json. Only edits to gaps it rebuts
  // this round are kept (those gaps go back to the disprover); the caller decides.
  const g = readJSONFile(path.join(ctx.runDir, 'gaps.json'));
  const claimIds = new Set(readJSONL(path.join(ctx.runDir, 'claims.jsonl')).map((c) => c.id));
  if (!g.ok) throw new Blocked('resolve', g.error);
  const gv = validateGaps(g.value, claimIds);
  if (!gv.ok) throw new Blocked('resolve', `gaps.json invalid after resolve: ${gv.error}`);
  const r = readJSONFile(path.join(ctx.runDir, resolutionsFile));
  seal(ctx, resolutionsFile);
  return { res: r.ok && r.value && typeof r.value === 'object' ? r.value : {}, edits: new Map(g.value.map((x) => [x.id, x])) };
}

function writeGaps(ctx, gapState) {
  fs.writeFileSync(path.join(ctx.runDir, 'gaps.json'), `${JSON.stringify([...gapState.values()], null, 2)}\n`);
}

const openFindings = (store) => gloop.review.openIds(store).map((id) => {
  const { file, line, severity, rloopSeverity, ...f } = store[id];
  return { ...f, severity: rloopSeverity };
});

// Cycle 1 attacks every gap. Then up to fixCycles resolve rounds: each round the author
// answers every open kill finding; rebutted gaps (with any edits) go back to the disprover;
// rejected resolutions stay open and are answered again next round with the reason.
async function disprove(ctx) {
  const gaps = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'gaps.json'), 'utf8'));
  const gapState = new Map(gaps.map((g) => [g.id, { ...g, status: 'open', findings: [] }]));
  const store = {};
  const allResolutions = {};
  const fixCycles = ctx.fixCycles;
  const ignoredEdits = [];
  let cycles = 0;

  const review = async (list, previous) => {
    cycles += 1;
    ctx.log(`  disprove cycle ${cycles}: ${list.length} gaps`);
    const doc = await disproveOnce(ctx, cycles, list.map(({ findings, ...g }) => g), previous);
    seal(ctx, `disprove/review-${cycles}.json`, `disprove/previous-${cycles}.json`, `disprove/cycle-${cycles}.json`, `disprove/cycle-${cycles}.tools.json`);
    gloop.review.ingest(store, doc.findings.map(toStore), cycles);
    for (const f of doc.findings) gapState.get(f.gap).findings.push({ id: f.id, cycle: cycles, severity: f.severity, class: f.class, summary: f.summary, sources: f.sources });
  };

  await review([...gapState.values()], []);
  let rejected = [];
  for (let round = 1; round <= fixCycles && openFindings(store).length; round += 1) {
    const open = openFindings(store);
    writeGaps(ctx, gapState);
    const { res, edits } = await resolveOnce(ctx, round, open, rejected);
    const rebutted = new Set();
    const previous = [];
    rejected = [];
    for (const f of open) {
      const r = res[f.id];
      const verdict = checkResolution(f, r);
      previous.push({ finding: f, resolution: r || null, accepted: verdict.ok, why: verdict.why || null });
      if (!verdict.ok) { rejected.push({ id: f.id, why: verdict.why }); continue; }
      store[f.id].open = false;
      store[f.id].resolution = { status: r.status, reason: r.reason };
      allResolutions[f.id] = r;
      const g = gapState.get(f.gap);
      if (r.status === 'dropped') { g.status = 'dropped'; g.droppedBy = f.id; g.dropReason = r.reason; } else rebutted.add(f.gap);
    }
    for (const [id, e] of edits) {
      const cur = gapState.get(id);
      if (!cur) continue;
      const changed = cur.question !== e.question || cur.why !== e.why || JSON.stringify(cur.claims) !== JSON.stringify(e.claims);
      if (!changed) continue;
      if (rebutted.has(id) && cur.status !== 'dropped') { cur.question = e.question; cur.why = e.why; cur.claims = e.claims; } else ignoredEdits.push({ round, gap: id });
    }
    writeGaps(ctx, gapState);
    const again = [...gapState.values()].filter((g) => rebutted.has(g.id) && g.status !== 'dropped');
    if (again.length) await review(again, previous);
  }
  fs.writeFileSync(path.join(ctx.runDir, 'disprove', 'resolutions.json'), `${JSON.stringify(allResolutions, null, 2)}\n`);
  if (ignoredEdits.length) fs.writeFileSync(path.join(ctx.runDir, 'disprove', 'ignored-edits.json'), `${JSON.stringify(ignoredEdits, null, 2)}\n`);
  const stillOpen = gloop.review.openIds(store).filter((id) => gapState.get(store[id].file).status !== 'dropped');
  if (stillOpen.length) {
    writeGaps(ctx, gapState);
    throw new Blocked('disprove', `disprove did not converge after ${fixCycles} cycles: open ${stillOpen.join(', ')}`);
  }
  for (const g of gapState.values()) if (g.status !== 'dropped') g.status = 'survived';
  writeGaps(ctx, gapState);
  seal(ctx, 'gaps.json', 'disprove/resolutions.json', 'disprove/ignored-edits.json');
  const c = gloop.review.counts(store);
  const survived = [...gapState.values()].filter((g) => g.status === 'survived').length;
  ctx.log(`  ${survived}/${gapState.size} gaps survived (${c.important} kill findings, ${c.nit} weaken findings)`);
  return { cycles, proposed: gapState.size, survived, killed: gapState.size - survived, findings: c, ignoredEdits: ignoredEdits.length };
}

module.exports = { disprove, toStore, treeState };
