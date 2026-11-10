// disprove ⇄ resolve: a fresh-context disprover attacks the gaps; the author drops or rebuts.
// Convergence reuses gloop's review store (ingest / openIds / counts): `kills` maps to
// gloop's `important` (blocks) and `weakens` to `nit` (never blocks).
const fs = require('fs');
const path = require('path');
const agent = require('../agent');
const gloop = require('../gloop');
const sources = require('../sources');
const { validateDisprove, validateGaps, checkResolution } = require('../contracts');
const { Blocked, readJSONL, readJSONFile, prompt, snapshot } = require('../runctx');
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

async function resolveOnce(ctx, k, open, gapState) {
  const findingsFile = `disprove/open-${k}.json`;
  const resolutionsFile = `disprove/resolutions-${k}.json`;
  fs.writeFileSync(path.join(ctx.runDir, findingsFile), `${JSON.stringify(open, null, 2)}\n`);
  await agent.run(ctx, {
    role: 'author', stage: 'resolve', label: `resolve-${k}`,
    prompt: prompt('resolve', { cycle: k, findingsFile, resolutionsFile, rsearch: agent.RSEARCH }),
  });
  // The author may narrow a gap's question/why. Status stays the runner's.
  const g = readJSONFile(path.join(ctx.runDir, 'gaps.json'));
  const claimIds = new Set(readJSONL(path.join(ctx.runDir, 'claims.jsonl')).map((c) => c.id));
  if (!g.ok) throw new Blocked('resolve', g.error);
  const gv = validateGaps(g.value, claimIds);
  if (!gv.ok) throw new Blocked('resolve', `gaps.json invalid after resolve: ${gv.error}`);
  for (const edited of g.value) {
    const cur = gapState.get(edited.id);
    if (cur) { cur.question = edited.question; cur.why = edited.why; cur.claims = edited.claims; }
  }
  const r = readJSONFile(path.join(ctx.runDir, resolutionsFile));
  return r.ok && r.value && typeof r.value === 'object' ? r.value : {};
}

function writeGaps(ctx, gapState) {
  fs.writeFileSync(path.join(ctx.runDir, 'gaps.json'), `${JSON.stringify([...gapState.values()], null, 2)}\n`);
}

async function disprove(ctx) {
  const gaps = JSON.parse(fs.readFileSync(path.join(ctx.runDir, 'gaps.json'), 'utf8'));
  const gapState = new Map(gaps.map((g) => [g.id, { ...g, status: 'open', findings: [] }]));
  const store = {};
  const allResolutions = {};
  const fixCycles = ctx.fixCycles;
  let review = [...gapState.values()];
  let previous = [];
  let k = 0;
  for (k = 1; k <= fixCycles + 1 && review.length; k += 1) {
    ctx.log(`  disprove cycle ${k}: ${review.length} gaps`);
    const doc = await disproveOnce(ctx, k, review.map(({ findings, ...g }) => g), previous);
    gloop.review.ingest(store, doc.findings.map(toStore), k);
    for (const f of doc.findings) gapState.get(f.gap).findings.push({ id: f.id, cycle: k, severity: f.severity, class: f.class, summary: f.summary, sources: f.sources });
    const open = gloop.review.openIds(store);
    if (!open.length) break;
    if (k === fixCycles + 1) break; // cap reached; checked below
    const openFindings = open.map((id) => { const { file, line, severity, rloopSeverity, ...f } = store[id]; return { ...f, severity: rloopSeverity }; });
    const res = await resolveOnce(ctx, k, openFindings, gapState);
    const rebutted = new Set();
    previous = [];
    for (const f of openFindings) {
      const r = res[f.id];
      const verdict = checkResolution(f, r);
      previous.push({ finding: f, resolution: r || null, accepted: verdict.ok, why: verdict.why || null });
      if (!verdict.ok) continue;
      store[f.id].open = false;
      store[f.id].resolution = { status: r.status, reason: r.reason };
      allResolutions[f.id] = r;
      const g = gapState.get(f.gap);
      if (r.status === 'dropped') { g.status = 'dropped'; g.droppedBy = f.id; g.dropReason = r.reason; } else rebutted.add(f.gap);
    }
    // A gap stays dropped even if another finding on it was rebutted.
    review = [...gapState.values()].filter((g) => rebutted.has(g.id) && g.status !== 'dropped');
  }
  fs.writeFileSync(path.join(ctx.runDir, 'disprove', 'resolutions.json'), `${JSON.stringify(allResolutions, null, 2)}\n`);
  const stillOpen = gloop.review.openIds(store).filter((id) => gapState.get(store[id].file).status !== 'dropped');
  const cycles = Math.min(k, fixCycles + 1);
  if (stillOpen.length) {
    writeGaps(ctx, gapState);
    throw new Blocked('disprove', `disprove did not converge after ${fixCycles} cycles: open ${stillOpen.join(', ')}`);
  }
  for (const g of gapState.values()) if (g.status !== 'dropped') g.status = 'survived';
  writeGaps(ctx, gapState);
  const c = gloop.review.counts(store);
  const survived = [...gapState.values()].filter((g) => g.status === 'survived').length;
  ctx.log(`  ${survived}/${gapState.size} gaps survived (${c.important} kill findings, ${c.nit} weaken findings)`);
  return { cycles, proposed: gapState.size, survived, killed: gapState.size - survived, findings: c };
}

module.exports = { disprove, toStore, treeState };
