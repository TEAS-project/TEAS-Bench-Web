// Shared data and selection helpers.
export const FAMILIES = [
  { id: 'general', name: 'General assistant', sub: 'open-ended Q&A', members: [
    { ds: 'arena-hard', mode: 'moe', label: 'Single-turn chat', sub: 'Arena-Hard' },
    { ds: 'mcp-atlas', mode: 'agentic', label: 'Agentic + tools', sub: 'MCP-Atlas' } ] },
  { id: 'maths', name: 'Maths & reasoning', sub: 'chain-of-thought', members: [
    { ds: 'gsm8k', mode: 'moe', label: 'Single-turn', sub: 'GSM8K' },
    { ds: 'imo-answerbench', mode: 'agentic', label: 'Agentic', sub: 'IMO-AnswerBench' } ] },
  { id: 'coding', name: 'Coding', sub: 'edit & run tests', members: [
    { ds: 'swe-bench-lite', mode: 'agentic', label: 'Agentic', sub: 'SWE-bench Lite' } ] },
  { id: 'longctx', name: 'Long-context', sub: 'document ingestion', members: [
    { ds: 'longbench', mode: 'moe', label: 'Single-turn', sub: 'LongBench' } ] },
];
export const FWLABEL = { vllm: 'vLLM', sglang: 'SGLang', kai: 'KAI (Tenstorrent)', waferengine: 'WaferEngine (Cerebras)' };
export const BATCHKEYS = ['batch-size-default', 'batch-size-1'];
// Manufacturer prefix for each accelerator.
export const MANUFACTURER = { a100: 'NVIDIA', h100: 'NVIDIA', h200: 'NVIDIA', b200: 'NVIDIA', b300: 'NVIDIA', gb10: 'NVIDIA', mi355x: 'AMD', 'blackhole-p150b': 'Tenstorrent', cs3: 'Cerebras' };
export const GPUS = ['NVIDIA A100', 'NVIDIA H100', 'NVIDIA H200', 'NVIDIA B200', 'NVIDIA B300', 'AMD MI355X', 'NVIDIA DGX Spark', 'Tenstorrent P150b', 'Cerebras CS-3'];

// Tiers keep datacentre and workstation hardware in separate comparisons.
export const TIERS = [
  { id: 'datacentre', label: 'Datacentre' },
  { id: 'workstation', label: 'Workstation' },
];
export const tierOf = (c) => (c && c.tier) || 'datacentre';
/** Tiers present in an engine's canonical and alternate hardware records. */
export const tiersIn = (fd) =>
  new Set([...Object.values((fd && fd.hw) || {}), ...((fd && fd.alts) || [])].map(tierOf));
// Use each record's own engine so comparison-only copies do not affect engine availability.
const ranOnTier = (cell, fw, tier) =>
  Object.values((cell.fw[fw] || {}).hw || {}).some((r) => r.fw === fw && (!tier || tierOf(r) === tier));
/** Engines of this cell that themselves ran on the tier. */
export const fwsOnTier = (cell, tier) =>
  (cell.frameworks || []).filter((fw) => !tier || ranOnTier(cell, fw, tier));
/** Whether a scenario has a selectable engine on the tier. */
export const cellHasTier = (cell, tier) => !tier || fwsOnTier(cell, tier).length > 0;
/** Every tier present in the dataset. */
export function tiersInDb(db) {
  const out = new Set();
  for (const mid of db.modelOrder)
    for (const bt of Object.values((db.models[mid] || {}).batches || {}))
      for (const cell of Object.values(bt || {}))
        for (const fw of cell.frameworks || []) tiersIn(cell.fw[fw]).forEach((t) => out.add(t));
  return out;
}

export const famObj = (fam) => FAMILIES.find((f) => f.id === fam) || FAMILIES[0];
export const memObj = (fam, member) => famObj(fam).members.find((m) => m.ds === member) || famObj(fam).members[0];
export const availBatches = (m) => (m.mode === 'agentic' ? ['batch-size-default'] : BATCHKEYS);

// Workload and batch selections determine which models are available.
export const scnOf = (db, model, batch, ds) =>
  (((db.models[model] || {}).batches || {})[batch] || {})[ds];
/** Models with data for this batch, dataset and tier. */
export const modelsFor = (db, batch, ds, tier) =>
  db.modelOrder.filter((mid) => { const c = scnOf(db, mid, batch, ds); return c && cellHasTier(c, tier); });
/** Whether any model has this variant or family on the tier. */
export const memAvail = (db, m, tier) =>
  db.modelOrder.some((mid) => BATCHKEYS.some((bk) => { const c = scnOf(db, mid, bk, m.ds); return c && cellHasTier(c, tier); }));
export const famAvail = (db, f, tier) => f.members.some((m) => memAvail(db, m, tier));

/** Choose the batch regime with the most cards on this tier. Keep the current regime on ties. */
export function densestBatch(db, sel, tier) {
  const mem = memObj(sel.fam, sel.member);
  let best = sel.batch, bestN = -1;
  for (const bk of availBatches(mem)) {
    const cell = scnOf(db, sel.model, bk, sel.member);
    if (!cell) continue;
    const n = Math.max(0, ...fwsOnTier(cell, tier).map((fw) =>
      Object.values((cell.fw[fw] || {}).hw || {}).filter((r) => tierOf(r) === tier).length));
    if (n > bestN || (n === bestN && bk === sel.batch)) { bestN = n; best = bk; }
  }
  return best;
}

// Clamp a selection in dependency order: tier, family, variant, batch, model, engine.
export function fixSel(db, sel) {
  const s = { ...sel };
  // Tier scopes every later selection.
  const tiers = tiersInDb(db);
  if (tiers.size && !tiers.has(s.tier)) s.tier = TIERS.map((t) => t.id).find((t) => tiers.has(t)) || [...tiers][0];
  const t = s.tier;
  let fam = famObj(s.fam);
  if (!famAvail(db, fam, t)) fam = FAMILIES.find((f) => famAvail(db, f, t)) || FAMILIES[0];
  s.fam = fam.id;
  let mem = memObj(s.fam, s.member);
  if (!memAvail(db, mem, t)) mem = fam.members.find((m) => memAvail(db, m, t)) || fam.members[0];
  s.member = mem.ds;
  if (!availBatches(mem).includes(s.batch)) s.batch = availBatches(mem)[0];
  let models = modelsFor(db, s.batch, s.member, t);
  if (!models.length) {
    // Fall back to a batch regime with at least one model.
    const alt = availBatches(mem).find((bk) => modelsFor(db, bk, s.member, t).length);
    if (alt) { s.batch = alt; models = modelsFor(db, alt, s.member, t); }
  }
  if (!models.includes(s.model)) s.model = models[0];
  const scnv = scnOf(db, s.model, s.batch, s.member);
  // Limit engines to those measured on the tier.
  const fws = (scnv && fwsOnTier(scnv, t)) || [];
  if (!fws.includes(s.fw)) s.fw = fws[0];
  return s;
}
export const scn = (db, s) => db.models[s.model].batches[s.batch][s.member];
export const fwData = (db, s) => { const c = scn(db, s); return c.fw[s.fw] || c.fw[c.frameworks[0]]; };
export const shownGpus = (db, s) => Object.keys(fwData(db, s).hw);

// ---- Analysis-page helpers ----
// Series colours are defined in theme.js.
export const GNM = { a100: 'NVIDIA A100', h100: 'NVIDIA H100', h200: 'NVIDIA H200', b200: 'NVIDIA B200', mi355x: 'AMD MI355X', b300: 'NVIDIA B300', gb10: 'NVIDIA DGX Spark', 'blackhole-p150b': 'Tenstorrent P150b', cs3: 'Cerebras CS-3' };
// Whole-machine labels omit the node count.
export const WHOLE_MACHINE = new Set(['gb10', 'cs3']);
export const TW = { 'mcp-atlas': 'MCP', 'swe-bench-lite': 'SWE', 'imo-answerbench': 'IMO' };
// Fallback model names for agentic charts.
export const AMODEL = { 'gpt-oss-120b': 'GPT-OSS 120B', 'deepseek-v3.2': 'DeepSeek-V3.2', 'qwen3-4b': 'Qwen3-4B' };
export const amLabel = (mid, db) => (db && db.modelMeta[mid] && db.modelMeta[mid].name) || AMODEL[mid] || mid;
// Wilson 95% interval for a binomial proportion. Returns fractions.
export function wilson(p, n, z = 1.96) {
  if (p == null || !n) return null;
  const d = 1 + (z * z) / n, c = (p + (z * z) / (2 * n)) / d;
  const h = (z / d) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { lo: Math.max(0, c - h), hi: Math.min(1, c + h), half: h };
}
// 'h100x2' -> { name: 'H100', n: 2, label: 'H100 ×2' }. gb10 drops the ×N ("DGX Spark").
export function gpuCfg(cfg) {
  const [, key, n] = String(cfg).match(/^(.*?)x(\d+)$/) || [, String(cfg), '1'];
  const name = GNM[key] || key;                       // full, e.g. "NVIDIA A100"
  const manufacturer = MANUFACTURER[key] || '';
  const model = manufacturer && name.startsWith(manufacturer + ' ') ? name.slice(manufacturer.length + 1) : name;  // "A100"
  return { name, manufacturer, model, n: +n, label: WHOLE_MACHINE.has(key) ? name : `${name} ×${n}` };
}
// Label an alternate node as a scaling observation against its canonical record.
export function nodeScalingLabel(canonical, alternate) {
  if (!alternate) return null;
  const to = gpuCfg(alternate.gpu);
  if (!canonical) return `×${to.n} scaling`;
  const from = gpuCfg(canonical.gpu);
  return from.name === to.name ? `×${from.n}→×${to.n} scaling` : `×${to.n} scaling`;
}
export const TURN_METRICS = [['tps', 'Tokens/s per user'], ['tpot_ms', 'TPOT (ms)'], ['inp', 'Input tokens'], ['out', 'Output tokens'], ['tools', 'Tool calls']];
export const metricT = (k) => (TURN_METRICS.find((x) => x[0] === k) || [, k])[1];

// ---- Metric catalog ----
// Shared metric definitions keep charts, controls and tables consistent.
// Per-request prices switch between cents and dollars to preserve useful precision.
export const fmtPerM = (v) => '$' + (v >= 10 ? v.toFixed(0) : v.toFixed(2));
export const fmtReq = (v) => {
  if (v >= 0.995) return '$' + v.toFixed(2);  // 0.995 rounds to "100¢" otherwise. Use 2 dp at all dollar magnitudes.
  const c = v * 100;
  return (c >= 9.95 ? c.toFixed(0) : c >= 1 ? c.toFixed(1) : c.toPrecision(2)) + '¢';
};
export const fmtJoule = (v) => (v >= 999500 ? (v / 1e6).toFixed(1) + ' MJ' : v >= 999.5 ? (v / 1e3).toFixed(1) + ' kJ' : Math.round(v) + ' J');

// Cost bases and their best-in-view normalised radar keys.
export const COST_METRICS = [
  { key: 'buyReq', norm: 'nCbr', basis: 'Buy', per: 'req', get: (c) => c.buyReq, fmt: fmtReq },
  { key: 'rentReq', norm: 'nCr', basis: 'Rent', per: 'req', get: (c) => c.rentReq, fmt: fmtReq },
  { key: 'buy', norm: 'nCb', basis: 'Buy', per: 'tok', get: (c) => c.buy, fmt: fmtPerM },
  { key: 'rent', norm: 'nC', basis: 'Rent', per: 'tok', get: (c) => c.rent, fmt: fmtPerM },
];
export const costMetricsFor = (agentic) => COST_METRICS.filter((m) => !agentic || m.per === 'req');
// Display strings for a cost basis. Agentic views offer only per-task cost. The per-token pair is
// a single-turn decode metric.
export function costMeta(m, agentic) {
  const noun = agentic ? 'task' : 'request';
  return m.per === 'req'
    ? { ...m, better: 'low', label: `${m.basis} cost per ${noun}`, unit: `$ / ${noun}`, pick: `${m.basis} ($ / ${noun})` }
    : { ...m, better: 'low', label: `Output-token cost (${m.basis.toLowerCase()}, decode)`, unit: '$ / 1M tokens', pick: `${m.basis} ($ / 1M tokens, decode)` };
}

export const fmtOperatingCount = (v) => Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

// Hardware-view metrics grouped by experience, capacity and energy.
export const PERF_METRICS = [
  { key: 'tpu', group: 'experience', label: 'Decode speed per user', unit: 'token/s', better: 'high', get: (c) => c.tps, fmt: (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1)) },
  { key: 'ttft', group: 'experience', label: 'TTFT per user', unit: 'ms', better: 'low', get: (c) => (c.ttft == null ? null : c.ttft * 1000), fmt: (v) => Math.round(v) + '' },
  { key: 'tpot', group: 'experience', label: 'TPOT per user', unit: 'ms', better: 'low', get: (c) => c.tpot_ms, fmt: (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1)) },
  // Keep three decimals below 0.095 req/s.
  { key: 'reqs', group: 'capacity', label: 'Request throughput per node', unit: 'req/s', better: 'high', get: (c) => c.reqs, fmt: (v) => (v >= 10 ? v.toFixed(0) : v >= 0.095 ? v.toFixed(2) : v.toFixed(3)), moeOnly: true },
  { key: 'nodeTps', group: 'capacity', field: 'decode_throughput_node_tok_s', label: 'Decode throughput per node', unit: 'token/s', better: 'high', get: (c) => c.decode_throughput_node_tok_s, fmt: (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1)), moeOnly: true },
  { key: 'taskConc', group: 'capacity', field: 'task_concurrency_achieved', label: 'Achieved task concurrency', unit: 'tasks', better: 'neutral', get: (c) => c.task_concurrency_achieved, fmt: fmtOperatingCount, agenticOnly: true },
  { key: 'e2e', group: 'experience', label: 'Latency per task (avg e2e)', unit: 's', better: 'low', get: (c) => c.e2e, fmt: (v) => (v >= 100 ? Math.round(v) + '' : v.toFixed(1)), agenticOnly: true },
  { key: 'jReq', group: 'energy', label: 'Energy per request', unit: 'J / request', better: 'low', get: (c) => c.jReq, fmt: fmtJoule },
  { key: 'tokJ', group: 'energy', label: 'Decode energy efficiency per node', unit: 'token/joule', better: 'high', get: (c) => c.tokJ, fmt: (v) => (v >= 1 ? v.toFixed(1) : v.toFixed(3)) },
];
export function perfMeta(m, agentic) {
  if (m.key === 'jReq' && agentic) return { ...m, label: 'Energy per task', unit: 'J / task' };
  if (m.key === 'tokJ' && agentic) return { ...m, label: 'Decode energy proxy per node' };
  return m;
}

// Published operating-point fields. Missing values remain unavailable.
export function operatingPointDetails(cell, agentic) {
  if (!cell) return [];
  if (agentic) return [
    cell.task_concurrency_achieved != null && { field: 'task_concurrency_achieved', label: 'Achieved task concurrency', value: fmtOperatingCount(cell.task_concurrency_achieved) },
    cell.task_concurrency_nominal != null && { field: 'task_concurrency_nominal', label: 'Requested task concurrency', value: fmtOperatingCount(cell.task_concurrency_nominal) },
  ].filter(Boolean);
  return [
    cell.decode_batch_achieved != null && { field: 'decode_batch_achieved', label: 'Achieved decode batch', value: fmtOperatingCount(cell.decode_batch_achieved) },
    cell.decode_throughput_node_tok_s != null && { field: 'decode_throughput_node_tok_s', label: 'Node decode throughput', value: `${Math.round(cell.decode_throughput_node_tok_s).toLocaleString()} token/s` },
  ].filter(Boolean);
}

// Accelerator names measured for a model.
export function modelGpuNames(db, model) {
  const set = new Set();
  Object.values(db.models[model].batches).forEach((bt) =>
    Object.values(bt).forEach((s) => (s.frameworks || []).forEach((fw) =>
      Object.values(s.fw[fw].hw).forEach((h) => set.add(h.name)))));
  return set;
}


// ---- Cross-model comparison (Analysis) ----
// Cross-model points use each model's cheapest measured accelerator, not a fixed hardware setup.
// Error bars span the model's measured accuracy range across accelerators.
// Run metadata is shared by every chart tooltip.
export function runMeta(c) {
  return [
    c.precision && `Precision: ${c.precision}`,
    c.checkpoint && `Checkpoint: ${c.checkpoint}`,
    (c.engine_version || c.fw) && `Engine: ${FWLABEL[c.fw] || c.fw || '—'}${c.engine_version ? ` ${c.engine_version}` : ''}`,
    c.gpu_type && !/^unknown$/i.test(c.gpu_type) && `Device: ${c.gpu_type}`,
    // The reasoning parser affects scoring comparability.
    c.parser && `Reasoning parser: ${c.parser}`,
  ].filter(Boolean);
}
// ---- published data flags -------------------------------------------------------------
// G-physics and G-floor use model/batch/dataset/engine/accelerator coordinates.
// V-concurrency uses model/batch/dataset/engine and applies to the full comparison group.
export function cellFlags(flags, c) {
  if (!flags) return [];
  const out = [];
  for (const [coord, list] of Object.entries(flags)) {
    const p = coord.split('/');
    for (const f of list || []) {
      let hit = false;
      switch (f.cat) {
        case 'G-physics': case 'G-floor': {
          const m = p.length === 5 && /^([^[]+)(?:\[(.+)\])?$/.exec(p[4]);
          hit = m && p[0] === c.model && p[1] === c.batch && p[2] === c.ds && p[3] === c.fw
            && m[1] === c.gpu && (m[2] ? m[2] === c.gpuFull : !c.alt);
          break;
        }
        case 'V-concurrency':
          hit = p.length === 4 && p[0] === c.model && p[1] === c.batch && p[2] === c.ds && p[3] === c.fw;
          break;
        default: break;
      }
      if (hit) out.push(f);
    }
  }
  return out;
}
// Format one short warning per flag for a double-quoted tooltip attribute.
const FLAG_LEAD = {
  'G-physics': 'audit: exceeds a physical limit',
  'G-floor': 'audit: engine-level collapse at this operating point, not silicon speed',
  'V-concurrency': 'audit: not comparable across this view',
};
export function flagLine(f) {
  let m = String(f.msg).replace(/"/g, "'").split('; ')[0];
  if (m.length > 120) m = m.slice(0, 117) + '…';
  return `⚠ ${FLAG_LEAD[f.cat] || 'audit'} (${f.cat}): ${m}`;
}

/** Summarise decode bandwidth use by accelerator for one model and batch regime. */
export function bandwidthUse(db, { model, batch = 'batch-size-default', flags = null }) {
  const per = new Map();
  const cells = ((db.models[model] || {}).batches || {})[batch] || {};
  for (const [ds, cell] of Object.entries(cells)) {
    if (cell.kind === 'agentic') continue;  // no sparsity trace, so no MBU
    for (const [fw, f] of Object.entries(cell.fw || {})) {
      for (const [g, r] of Object.entries(f.hw || {})) {
        if (r.mbu_d == null) continue;
        if (!per.has(g)) per.set(g, { gpu: g, name: GNM[g] || g, col: r.col, vals: [], meta: runMeta(r), flagged: 0, flagCats: new Set() });
        const e = per.get(g);
        e.vals.push(r.mbu_d);
        // Flagged records remain in the summary but are marked for display.
        const fl = flags ? cellFlags(flags, { model, batch, ds, fw, gpu: g, gpuFull: r.gpu, alt: false }) : [];
        if (fl.length) { e.flagged += 1; fl.forEach((x) => e.flagCats.add(x.cat)); }
      }
    }
  }
  const med = (a) => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  return [...per.values()]
    .map((p) => ({ ...p, pct: med(p.vals), lo: Math.min(...p.vals), hi: Math.max(...p.vals), n: p.vals.length, flagCats: [...p.flagCats].sort() }))
    .sort((a, b) => b.pct - a.pct);
}

export function crossModelPoints(db, { ds, fw, batch = 'batch-size-default', cost = 'rent', buyFactor = null }) {
  // Apply custom pricing before choosing each model's cheapest accelerator.
  const scaled = (v) => {
    if (v[cost] == null) return null;
    if (cost !== 'buy' || !buyFactor) return v[cost];
    const gm = /^(.*?)x(\d+)$/.exec(v.gpu || '');
    const f = gm && buyFactor(gm[1], +gm[2]);
    return f ? v[cost] * f : v[cost];
  };
  const out = [];
  for (const mid of db.modelOrder) {
    const cell = scnOf(db, mid, batch, ds);
    const f = cell && cell.fw[fw];
    if (!f) continue;
    const hw = f.hw || {};
    const cands = Object.entries(hw).filter(([, v]) => scaled(v) != null && v.acc != null);
    if (!cands.length) continue;
    const [g, v0] = cands.reduce((a, b) => (scaled(b[1]) < scaled(a[1]) ? b : a));
    const v = { ...v0, [cost]: scaled(v0) };
    const accs = Object.values(hw).map((x) => x.acc).filter((x) => x != null).map((x) => x * 100);
    const ci = wilson(v.acc, v.n);  // 95% sampling interval on the plotted (cheapest-card) accuracy
    out.push({
      mid, name: db.modelMeta[mid].name, sub: db.modelMeta[mid].sub, gpu: g, gpuName: GNM[g] || g,
      x: v[cost], y: v.acc * 100, tps: v.tps, nq: v.n,
      cLo: ci ? ci.lo * 100 : null, cHi: ci ? ci.hi * 100 : null,
      accMin: Math.min(...accs), accMax: Math.max(...accs), nHw: accs.length,
      meta: runMeta(v),
    });
  }
  return out;
}
