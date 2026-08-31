// Check that every published accelerator has a name, manufacturer, colour and sort position.

import { readFileSync } from 'node:fs';
import * as T from '../src/teas/theme.js';
import * as M from '../src/teas/model.js';
import { shortHw } from '../src/teas/charts.js';

const dbPath = process.argv[2] || new URL('../public/data/db.json', import.meta.url);
const db = JSON.parse(readFileSync(dbPath, 'utf8'));

// Include catalog entries and accelerators found in measurements.
const measured = new Set();
for (const m of Object.values(db.models || {}))
  for (const bt of Object.values(m.batches || {}))
    for (const cell of Object.values(bt || {}))
      for (const f of Object.values(cell.fw || {}))
        Object.keys(f.hw || {}).forEach((g) => measured.add(g));
const keys = new Set([...Object.keys(db.hardware || {}), ...measured]);

const fails = [];

for (const g of [...keys].sort()) {
  const name = M.GNM[g];
  const manufacturer = M.MANUFACTURER[g];
  const miss = [
    ['model.js GNM', !!name],
    ['model.js MANUFACTURER', !!manufacturer],
    ['model.js GPUS (sort order)', !!name && M.GPUS.includes(name)],
    ['theme.js GPU_COLORS.light', !!T.GPU_COLORS.light[g]],
    ['theme.js GPU_COLORS.dark', !!T.GPU_COLORS.dark[g]],
    ['theme.js NAMES -> GCOL_BY_NAME', !!name && !!T.GCOL_BY_NAME[name]],
    // A shortened label should remove its known manufacturer prefix.
    ['charts.js shortHw manufacturer arm', !name || !manufacturer || !name.startsWith(manufacturer + ' ')
      || shortHw(name) !== name],
  ].filter(([, ok]) => !ok).map(([k]) => k);

  console.log(`  ${g.padEnd(18)} ${miss.length ? 'MISSING: ' + miss.join(', ') : 'complete'}`);
  if (miss.length) fails.push(g);
}

console.log(fails.length
  ? `\n[verify-gpu-catalogs] FAIL — not in every catalog: ${fails.join(', ')}`
  : `\n[verify-gpu-catalogs] OK — all ${keys.size} accelerators present in every per-GPU catalog`);
process.exitCode = fails.length ? 1 : 0;
