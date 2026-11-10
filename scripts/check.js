#!/usr/bin/env node
// `npm run build`: syntax-check every JS file (and the extensionless CLIs) with `node --check`.
// There is no compile step; this is the build gate gloop runs.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const skip = new Set(['node_modules', '.git', '.loops', '.cache', '.gstack', 'worktrees', 'fixtures']);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
})(root);
for (const b of ['rloop', 'rsearch']) files.push(path.join(root, 'bin', b));

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    failed += 1;
    process.stderr.write(`FAIL ${path.relative(root, f)}\n${e.stderr}\n`);
  }
}
console.log(`checked ${files.length} files, ${failed} failed`);
process.exit(failed ? 1 : 0);
