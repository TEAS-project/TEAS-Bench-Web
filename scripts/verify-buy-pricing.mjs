// Check that adjustable buy pricing matches the published defaults.
// For single-turn cells: buyReq = rate/3600 × jReq/node_W.
// Agentic energy includes idle time, so it cannot recover wall time with this identity.
// Databases without a complete buy catalog use fixed published prices and need no check.

import { readFileSync } from 'node:fs';
import { buyDefaults, buyEntryComplete, buyFactors, isDefaultParams, nodeRateH, paramsFromSearch, paramsToSearch, resolveParams } from '../src/teas/pricing.js';

// The absolute tolerance covers rounding on the smallest published values.
const REL_TOL = 0.015;
const ABS_TOL = 6e-7;
const MIN_CELLS = 100;

// URL fixtures cover tier defaults and explicit cross-tier overrides.
const fixturePricing = { buy: {
  defaults_by_tier: {
    datacentre: { base_lifetime_hours: 43800, lifetime_hours: 39420, utilisation: 0.9, lifetime_years: 5 },
    workstation: { base_lifetime_hours: 26280, lifetime_hours: 10512, utilisation: 0.4, lifetime_years: 3 },
  },
  electricity_usd_per_kwh: 0.15, scale_other_capital: 1.2,
  gpus: [
    { gpu_key: 'dc', tier: 'datacentre', price_per_unit_usd: 1000, tdp_w: 100, cpu_price_per_unit_usd: 0, cpu_tdp_w: 0, cpu_num: 1 },
    { gpu_key: 'ws', tier: 'workstation', price_per_unit_usd: 1000, tdp_w: 100, cpu_price_per_unit_usd: 0, cpu_tdp_w: 0, cpu_num: 1 },
  ],
} };
const fixtureDefaults = buyDefaults(fixturePricing);
const absent = paramsFromSearch(new URLSearchParams());
if (!isDefaultParams(absent, fixtureDefaults)) throw new Error('absent buy URL params must select tier defaults');
if (resolveParams(absent, fixtureDefaults, 'datacentre').lifeYears !== 5 || resolveParams(absent, fixtureDefaults, 'workstation').lifeYears !== 3) throw new Error('absent lifetime override does not resolve by tier');
const explicit = paramsFromSearch(new URLSearchParams('blife=4&butil=0.5&belec=0.2'));
if (isDefaultParams(explicit, fixtureDefaults)) throw new Error('present buy URL params must be custom');
const fixtureFactors = buyFactors(fixturePricing, explicit);
for (const key of ['dc', 'ws']) if (!(fixtureFactors(key, 1) > 0) || fixtureFactors(key, 1) === 1) throw new Error(`${key}: explicit buy override did not produce a factor`);
const kept = paramsToSearch({ lifeYears: 5, util: 0.9, elec: 0.15 }, new URLSearchParams());
if (kept.get('blife') !== '5' || kept.get('butil') !== '0.9' || kept.get('belec') !== '0.15') throw new Error('explicit values equal to one tier default must remain in the URL');
const cleared = paramsToSearch({ lifeYears: null, util: null, elec: null }, kept);
if ([...cleared.keys()].length) throw new Error('reset must clear all three buy URL params');

// An optional path checks a candidate database instead of the bundled one.
const dbPath = process.argv[2] || new URL('../public/data/db.json', import.meta.url);
const db = JSON.parse(readFileSync(dbPath, 'utf8'));
const pricing = db.pricing || {};
const defaults = buyDefaults(pricing);
const entries = ((pricing.buy && pricing.buy.gpus) || []).filter(buyEntryComplete);

if (!defaults || !entries.length) {
  console.log('[verify-buy-pricing] db.json carries no host-CPU buy catalog — sliders stay hidden (defaults-only); nothing to verify.');
  process.exit(0);
}

const soc = pricing.buy.scale_other_capital ?? 1;
const byKey = Object.fromEntries(entries.map((g) => [g.gpu_key, g]));
const failures = [];

// Per-entry capital multipliers must be positive.
for (const g of entries) {
  if (!defaults.legacy && !defaults.tiers[g.tier]) failures.push(`${g.gpu_key}: missing or unknown hardware tier ${g.tier}`);
  if (g.capital_scale != null && (!(g.capital_scale > 0) || !Number.isFinite(g.capital_scale))) {
    failures.push(`${g.gpu_key}: invalid capital_scale ${g.capital_scale}`);
  }
}

let checked = 0;
for (const [mid, m] of Object.entries(db.models || {})) {
  for (const [bk, bv] of Object.entries(m.batches || {})) {
    for (const [ds, dv] of Object.entries(bv)) {
      if (dv.kind === 'agentic') continue;
      for (const [fw, fv] of Object.entries(dv.fw || {})) {
        // Check canonical and alternate node configurations.
        for (const rec of [...Object.values(fv.hw || {}), ...(fv.alts || [])]) {
          const gm = /^(.*?)x(\d+)$/.exec(rec.gpu || '');
          const g = gm && byKey[gm[1]];
          if (!g || rec.buyReq == null || rec.jReq == null) continue;
          if (!defaults.legacy && rec.tier !== g.tier) failures.push(`${mid}/${bk}/${ds}/${fw}/${rec.gpu}: record tier ${rec.tier} != buy catalog tier ${g.tier}`);
          const n = +gm[2];
          const watts = g.tdp_w * n + g.cpu_tdp_w * g.cpu_num;
          const tier = g.tier || 'datacentre';
          const base = resolveParams({ lifeYears: null, util: null, elec: null }, defaults, tier);
          const pred = (nodeRateH(g, n, base, soc) / 3600) * (rec.jReq / watts);
          const err = Math.abs(pred - rec.buyReq);
          checked += 1;
          if (err > REL_TOL * rec.buyReq + ABS_TOL) failures.push(`${mid}/${bk}/${ds}/${fw}/${rec.gpu}: published ${rec.buyReq}, recomputed ${pred.toPrecision(6)} (rel ${((err / rec.buyReq) * 100).toFixed(2)}%)`);
        }
      }
    }
  }
}

// Shorter life, lower utilisation and higher electricity prices must raise the rate.
for (const g of entries) {
  const tier = g.tier || 'datacentre';
  const base = resolveParams({ lifeYears: null, util: null, elec: null }, defaults, tier);
  if (!base) continue;
  const r0 = nodeRateH(g, 8, base, soc);
  const checksDir = [
    ['halved utilisation raises the rate', nodeRateH(g, 8, { ...base, util: base.util / 2 }, soc) > r0],
    ['halved lifetime raises the rate', nodeRateH(g, 8, { ...base, lifeYears: base.lifeYears / 2 }, soc) > r0],
    ['dearer electricity raises the rate', nodeRateH(g, 8, { ...base, elec: base.elec + 0.1 }, soc) > r0],
  ];
  for (const [what, okDir] of checksDir) if (!okDir) failures.push(`${g.gpu_key}: ${what} — violated`);
}

// Every cell with buy figures needs a complete catalog entry.
const uncatalogued = new Set();
for (const m of Object.values(db.models || {}))
  for (const bv of Object.values(m.batches || {}))
    for (const dv of Object.values(bv))
      for (const fv of Object.values(dv.fw || {}))
        for (const rec of [...Object.values(fv.hw || {}), ...(fv.alts || [])]) {
          const gm = /^(.*?)x(\d+)$/.exec(rec.gpu || '');
          if ((rec.buyReq != null || rec.buy != null) && gm && !byKey[gm[1]]) uncatalogued.add(gm[1]);
        }
if (uncatalogued.size) failures.push(`accelerators publish buy figures without a complete buy catalog entry: ${[...uncatalogued].sort().join(', ')}`);

if (checked < MIN_CELLS) failures.push(`only ${checked} cells checked (need ≥${MIN_CELLS}) — the identity cannot be considered established`);

if (failures.length) {
  console.error(`[verify-buy-pricing] FAILED — front-end buy formula disagrees with the sidecar:\n  ${failures.slice(0, 20).join('\n  ')}${failures.length > 20 ? `\n  … and ${failures.length - 20} more` : ''}`);
  process.exit(1);
}
console.log(`[verify-buy-pricing] OK — front-end buy rate reproduces published buyReq on ${checked} single-turn cells (tol ${REL_TOL * 100}%).`);
