// The one place that finds gstack-loops and pulls in the pieces rloop reuses.
// gstack-loops is required, never copied or edited. If an export rloop depends on is
// missing (an incompatible gstack-loops version), fail loudly here instead of deep in a run.
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = process.env.GSTACK_LOOPS_DIR || path.join(os.homedir(), '.claude', 'skills', 'gstack-loops');

const NEED = {
  driver: ['runAgent', 'agentEnv', 'AGENT_BIN', 'MODES', 'PUSH_DENY'],
  review: ['extractJSON', 'ingest', 'openIds', 'counts'],
  history: ['computeStats'],
  config: ['findWorkspaceRoot'],
  util: ['readJSON', 'writeJSON', 'run', 'slugOk', 'c'],
  registry: ['getLoop', 'load'],
};

function load() {
  const lib = path.join(DIR, 'lib');
  if (!fs.existsSync(lib)) {
    throw new Error(`gstack-loops not found at ${DIR}. Install it, or set GSTACK_LOOPS_DIR.`);
  }
  const out = {};
  for (const [mod, names] of Object.entries(NEED)) {
    const m = require(path.join(lib, `${mod}.js`));
    for (const n of names) {
      if (!(n in m)) throw new Error(`gstack-loops at ${DIR}: lib/${mod}.js has no export "${n}" (rloop needs it). Update gstack-loops or rloop.`);
    }
    out[mod] = m;
  }
  return out;
}

module.exports = { DIR, NEED, ...load() };
