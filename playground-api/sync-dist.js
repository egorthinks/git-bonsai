#!/usr/bin/env node
// The /api/metrics endpoint runs the engine's own fetchMetrics(), so it needs
// the compiled data + seed modules alongside it. This copies them from the
// repo's dist/ into playground-api/dist/ so the folder is self-contained and
// deployable on its own. Re-run after `npm run build` if data.ts or seed.ts
// changed, then redeploy (see playground-api/README.md).
const fs = require('fs');
const path = require('path');
const from = path.join(__dirname, '..', 'dist', 'src');
const to = path.join(__dirname, 'dist', 'src');
fs.mkdirSync(to, { recursive: true });
for (const f of ['data.js', 'seed.js']) {
  fs.copyFileSync(path.join(from, f), path.join(to, f));
  console.log('copied', f);
}
