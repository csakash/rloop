// Test helpers: serve recorded API responses with no network, and build throwaway workspaces.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('../lib/http');

process.env.RLOOP_CACHE = 'off';
// Each test process gets its own throttle state, never the machine-wide one.
process.env.RLOOP_THROTTLE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rloop-throttle-test-'));
http.setSleep(async () => {});

const FIX = path.join(__dirname, 'fixtures');

// Serve exactly the recorded URLs; anything else fails the test (no silent network).
function useFixtures(...names) {
  const map = {};
  for (const n of names) {
    const file = fs.existsSync(path.join(FIX, `${n}.json`)) ? path.join(FIX, `${n}.json`) : path.join(FIX, `${n}.handwritten.json`);
    Object.assign(map, JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  const seen = [];
  http.resetThrottle();
  http.setFetch(async (url) => {
    seen.push(url);
    const hit = map[url];
    if (!hit) throw new Error(`no fixture for ${url}`);
    return new Response(hit.text, { status: hit.status });
  });
  return { seen, urls: Object.keys(map).filter((k) => k.startsWith('http')) };
}

function noNetwork() {
  http.setFetch(async (url) => { throw new Error(`unexpected network call: ${url}`); });
}

function tmpdir(prefix = 'rloop-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

module.exports = { FIX, useFixtures, noNetwork, tmpdir };
