// File contracts between stages. Strict on purpose: an agent's output is a claim until a
// validator accepts it. Every validator returns { ok: true } or { ok: false, error }.
const ids = require('./ids');

const RELATIONS = ['increases', 'decreases', 'associated', 'no-effect', 'enables', 'other'];
const DESIGNS = ['rct', 'meta-analysis', 'observational', 'experiment', 'simulation', 'theory', 'review', 'other'];
const SIGNALS = ['missing-link', 'weak-evidence', 'contradiction', 'narrow-coverage', 'method-transfer', 'newly-tractable', 'stated-limitation'];
const GAP_STATUS = ['open', 'dropped', 'survived'];
const FINDING_SEVERITIES = ['kills', 'weakens'];
const FINDING_CLASSES = ['answered-by-prior-work', 'known-impossible', 'trivial', 'mis-stated', 'already-in-progress'];
const RESOLUTIONS = ['dropped', 'rebutted'];
const SCORE_KEYS = ['novelty', 'importance', 'tractability', 'evidence_gap'];
const NO_ISSUES = 'no issues';
const MAX_QUOTE_WORDS = 40;

const str = (v) => typeof v === 'string' && v.trim().length > 0;
const bad = (error) => ({ ok: false, error });
const OK = { ok: true };

function words(s) {
  return String(s).trim().split(/\s+/).filter(Boolean).length;
}

// One claim line. paperIds: Set of ids (any id of a fetched paper).
function validateClaim(c, paperIds) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return bad('not an object');
  if (!str(c.id)) return bad('missing "id"');
  const at = c.id;
  if (!str(c.source) || !ids.normalize(c.source)) return bad(`${at}: "source" must be an id like doi:10.x/y`);
  if (paperIds && !paperIds.has(ids.normalize(c.source))) return bad(`${at}: source ${c.source} is not one of the fetched papers`);
  for (const k of ['subject', 'object']) if (!str(c[k])) return bad(`${at}: missing "${k}"`);
  if (!RELATIONS.includes(c.relation)) return bad(`${at}: "relation" must be one of ${RELATIONS.join(', ')}`);
  if (!DESIGNS.includes(c.design)) return bad(`${at}: "design" must be one of ${DESIGNS.join(', ')}`);
  if (c.n !== null && c.n !== undefined && !(Number.isInteger(c.n) && c.n > 0)) return bad(`${at}: "n" must be a positive integer or null`);
  if (c.setting !== null && c.setting !== undefined && typeof c.setting !== 'string') return bad(`${at}: "setting" must be a string or null`);
  if (!str(c.quote)) return bad(`${at}: missing "quote"`);
  if (words(c.quote) > MAX_QUOTE_WORDS) return bad(`${at}: "quote" is over ${MAX_QUOTE_WORDS} words`);
  return OK;
}

function validateGap(g, claimIds) {
  if (!g || typeof g !== 'object' || Array.isArray(g)) return bad('not an object');
  if (!str(g.id) || !/^g\d+$/.test(g.id)) return bad('"id" must look like g01');
  const at = g.id;
  if (!SIGNALS.includes(g.signal)) return bad(`${at}: "signal" must be one of ${SIGNALS.join(', ')}`);
  if (!str(g.question)) return bad(`${at}: missing "question"`);
  if (!str(g.why)) return bad(`${at}: missing "why"`);
  if (!Array.isArray(g.claims) || g.claims.length === 0) return bad(`${at}: "claims" must list at least one claim id`);
  for (const cid of g.claims) if (claimIds && !claimIds.has(cid)) return bad(`${at}: claim ${cid} does not exist`);
  if (g.status !== undefined && !GAP_STATUS.includes(g.status)) return bad(`${at}: bad "status"`);
  return OK;
}

function validateGaps(list, claimIds) {
  if (!Array.isArray(list)) return bad('gaps.json must be an array');
  if (list.length === 0) return bad('no gaps proposed');
  const seen = new Set();
  for (const g of list) {
    const v = validateGap(g, claimIds);
    if (!v.ok) return v;
    if (seen.has(g.id)) return bad(`duplicate gap id ${g.id}`);
    seen.add(g.id);
  }
  return OK;
}

// The disprover's output. Mirrors gloop's findings contract: "no issues" iff empty.
function validateDisprove(doc, gapIds) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return bad('not a JSON object');
  if (!str(doc.summary)) return bad('missing "summary"');
  if (!Array.isArray(doc.findings)) return bad('missing "findings" array');
  const clean = doc.summary.trim().toLowerCase().replace(/[.!]+$/, '') === NO_ISSUES;
  if (doc.findings.length === 0 && !clean) return bad('no findings listed but summary is not "no issues"');
  if (doc.findings.length > 0 && clean) return bad('summary says "no issues" but findings are listed');
  const seen = new Set();
  for (const [n, f] of doc.findings.entries()) {
    const at = `finding ${n + 1}`;
    if (!f || typeof f !== 'object' || Array.isArray(f)) return bad(`${at}: not an object`);
    if (!str(f.id)) return bad(`${at}: missing "id"`);
    if (seen.has(f.id)) return bad(`${at}: duplicate id "${f.id}"`);
    seen.add(f.id);
    if (!str(f.gap) || (gapIds && !gapIds.has(f.gap))) return bad(`${f.id}: "gap" must name a gap under review`);
    if (!FINDING_SEVERITIES.includes(f.severity)) return bad(`${f.id}: "severity" must be one of ${FINDING_SEVERITIES.join(', ')}`);
    if (!FINDING_CLASSES.includes(f.class)) return bad(`${f.id}: "class" must be one of ${FINDING_CLASSES.join(', ')}`);
    if (!str(f.summary)) return bad(`${f.id}: missing "summary"`);
    if (!Array.isArray(f.sources)) return bad(`${f.id}: "sources" must be an array`);
    for (const s of f.sources) if (!ids.normalize(s)) return bad(`${f.id}: source "${s}" is not a valid id`);
    if (f.severity === 'kills' && f.class === 'answered-by-prior-work' && f.sources.length === 0) {
      return bad(`${f.id}: "answered-by-prior-work" must cite the prior work`);
    }
  }
  return OK;
}

// One resolution for one finding. Returns { ok, why }.
function checkResolution(finding, r) {
  if (!r || typeof r !== 'object') return { ok: false, why: 'no resolution written' };
  if (!RESOLUTIONS.includes(r.status)) return { ok: false, why: `unknown status "${r.status}"` };
  if (!str(r.reason)) return { ok: false, why: `${r.status} without a reason` };
  if (r.status === 'rebutted') {
    const cited = new Set((finding.sources || []).map(ids.normalize));
    const fresh = (Array.isArray(r.sources) ? r.sources : []).map(ids.normalize).filter(Boolean).filter((s) => !cited.has(s));
    if (fresh.length === 0) return { ok: false, why: 'rebutted without a source the finding did not already cite' };
    const badSrc = (r.sources || []).find((s) => !ids.normalize(s));
    if (badSrc) return { ok: false, why: `rebuttal source "${badSrc}" is not a valid id` };
  }
  return { ok: true };
}

function validateScores(doc, gapIds) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return bad('scores must be an object keyed by gap id');
  for (const gid of gapIds) {
    const s = doc[gid];
    if (!s || typeof s !== 'object') return bad(`${gid}: no scores`);
    for (const k of SCORE_KEYS) {
      if (!Number.isInteger(s[k]) || s[k] < 1 || s[k] > 5) return bad(`${gid}: "${k}" must be an integer 1-5`);
      if (!s.rationale || !str(s.rationale[k])) return bad(`${gid}: missing rationale for "${k}"`);
    }
  }
  return OK;
}

module.exports = {
  RELATIONS, DESIGNS, SIGNALS, FINDING_SEVERITIES, FINDING_CLASSES, RESOLUTIONS, SCORE_KEYS, NO_ISSUES, MAX_QUOTE_WORDS,
  validateClaim, validateGap, validateGaps, validateDisprove, checkResolution, validateScores,
};
