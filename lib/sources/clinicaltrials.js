// ClinicalTrials.gov API v2. https://clinicaltrials.gov/data-api/api
// A registered trial is treated as a "paper": its brief summary is the abstract.
const http = require('../http');
const { paper, q } = require('./common');

const BASE = 'https://clinicaltrials.gov/api/v2/studies';

function toPaper(s) {
  const p = s && s.protocolSection;
  if (!p) return null;
  const idm = p.identificationModule || {};
  const design = p.designModule || {};
  const status = p.statusModule || {};
  const start = (status.startDateStruct && status.startDateStruct.date) || '';
  const alloc = design.designInfo && design.designInfo.allocation;
  const enrollment = design.enrollmentInfo && design.enrollmentInfo.count;
  const summary = [
    (p.descriptionModule && p.descriptionModule.briefSummary) || '',
    `Status: ${status.overallStatus || 'unknown'}.`,
    enrollment ? `Enrollment: ${enrollment}.` : '',
  ].join(' ');
  return paper('clinicaltrials', { nct: idm.nctId }, {
    title: idm.officialTitle || idm.briefTitle,
    abstract: summary,
    year: start ? Number.parseInt(start.slice(0, 4), 10) : null,
    venue: 'ClinicalTrials.gov',
    design: alloc === 'RANDOMIZED' ? 'rct' : (design.studyType === 'OBSERVATIONAL' ? 'observational' : undefined),
  });
}

async function count(query) {
  const { status, json } = await http.getJSON(`${BASE}?query.term=${q(query)}&pageSize=1&countTotal=true&fields=NCTId`);
  if (status !== 200) throw new Error(`clinicaltrials count: HTTP ${status}`);
  return json.totalCount;
}

async function search(query, { limit = 25 } = {}) {
  const papers = [];
  let total = null;
  let token = null;
  while (papers.length < limit) {
    const n = Math.min(100, limit - papers.length);
    const url = `${BASE}?query.term=${q(query)}&pageSize=${n}&countTotal=true${token ? `&pageToken=${q(token)}` : ''}`;
    const { status, json } = await http.getJSON(url);
    if (status !== 200) throw new Error(`clinicaltrials search: HTTP ${status}`);
    if (json.totalCount !== undefined) total = json.totalCount;
    papers.push(...(json.studies || []).map(toPaper).filter(Boolean));
    token = json.nextPageToken;
    if (!token) break;
  }
  return { total, papers: papers.slice(0, limit) };
}

async function resolve(kind, value) {
  const { status, json } = await http.getJSON(`${BASE}/${q(value)}`);
  if (status !== 200) return { ok: false, status };
  const p = toPaper(json);
  return { ok: !!p, title: p ? p.title : null, paper: p };
}

module.exports = {
  name: 'clinicaltrials', label: 'ClinicalTrials.gov', fields: 'registered clinical studies',
  canSearch: true, resolves: ['nct'], count, search, resolve, toPaper,
};
