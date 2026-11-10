#!/usr/bin/env node
// Record real API responses for the offline test suite: node scripts/record-fixtures.js [source...]
// Each source's calls go to test/fixtures/<source>.json as { url: { status, text } }.
// Bodies are trimmed only by asking the APIs for few results; nothing is edited by hand.
const fs = require('fs');
const path = require('path');
const http = require('../lib/http');
const sources = require('../lib/sources');

process.env.RLOOP_CACHE = 'off';
const OUT = path.resolve(__dirname, '..', 'test', 'fixtures');

const PLAN = {
  openalex: async (s) => { await s.count('sleep procedural memory older adults'); await s.search('sleep procedural memory older adults', { limit: 3 }); await s.resolve('doi', '10.1101/lm.803708'); },
  semanticscholar: async (s) => { await s.count('sleep procedural memory older adults'); await s.search('sleep procedural memory older adults', { limit: 3 }); await s.resolve('doi', '10.1038/nature14539'); },
  arxiv: async (s) => { await s.count('transformer attention protein folding'); await s.search('transformer attention protein folding', { limit: 3 }); await s.resolve('arxiv', '1706.03762'); await s.resolve('arxiv', '9999.99999'); },
  pubmed: async (s) => { await s.count('sleep procedural memory older adults'); await s.search('sleep procedural memory older adults', { limit: 3 }); await s.resolve('pmid', '31452104'); },
  europepmc: async (s) => { await s.count('sleep procedural memory older adults'); await s.search('sleep procedural memory older adults', { limit: 3 }); await s.resolve('pmid', '31452104'); },
  crossref: async (s) => { await s.count('sleep procedural memory older adults'); await s.resolve('doi', '10.1038/nature14539'); await s.resolve('doi', '10.9999/fake.doi.123'); },
  clinicaltrials: async (s) => { await s.count('sleep procedural memory older adults'); await s.search('sleep procedural memory older adults', { limit: 3 }); await s.resolve('nct', 'NCT01840839'); },
};

async function main() {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PLAN);
  fs.mkdirSync(OUT, { recursive: true });
  for (const name of names) {
    const rec = {};
    http.setFetch(async (url, opts) => {
      const res = await globalThis.fetch(url, opts);
      const text = await res.text();
      if (res.status === 200 || res.status === 404) rec[http.redact(url)] = { status: res.status, text };
      return new Response(text, { status: res.status, headers: res.headers });
    });
    try {
      await PLAN[name](sources.get(name));
      fs.writeFileSync(path.join(OUT, `${name}.json`), `${JSON.stringify(rec, null, 1)}\n`);
      console.log(`${name}: recorded ${Object.keys(rec).length} responses`);
    } catch (e) {
      console.error(`${name}: FAILED ${e.message}`);
      process.exitCode = 1;
    }
  }
}

main();
