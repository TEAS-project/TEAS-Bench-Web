// Insights computed from the loaded data. Markdown emphasis is rendered as React spans.
import * as M from './model.js';
import { timingProfiles } from './timeProfiles.js';

const gname = (g) => M.GNM[g] || g;
const best = (hw, field, lowest = false) => {
  const rows = Object.entries(hw).filter(([, v]) => v[field] != null);
  if (!rows.length) return null;
  return rows.reduce((a, b) => ((lowest ? b[1][field] < a[1][field] : b[1][field] > a[1][field]) ? b : a));
};
const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/** Card count from a record's node key ("mi355xx8" -> 8). Null when the key carries no count. */
const nodeN = (r) => { const mm = /x(\d+)$/.exec((r && r.gpu) || ''); return mm ? +mm[1] : null; };

/** Return records at the modal node size, or null when no size has a strict plurality. */
function matchedNode(rows) {
  const cnt = {};
  rows.forEach(([, r]) => { const k = nodeN(r); if (k) cnt[k] = (cnt[k] || 0) + 1; });
  const ranked = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  if (!ranked.length || (ranked[1] && ranked[1][1] === ranked[0][1])) return null;
  const node = ranked[0][0];
  return { node: +node, mixed: ranked.length > 1, rows: rows.filter(([, r]) => String(nodeN(r)) === node) };
}

/** Lowercase a label for mid-sentence use without mangling acronyms (TTFT, TPOT). */
const lcl = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** Find canonical peers beaten on both visible axes at the modal node size. */
function dominated(hw, xm, ym) {
  if (!xm || !ym || xm.better === 'neutral' || ym.better === 'neutral') return null;
  // Compare performance only at a shared node size.
  const withAxes = Object.entries(hw).filter(([, v]) => xm.get(v) != null && ym.get(v) != null);
  const matched = matchedNode(withAxes);
  if (!matched) return null;
  const rows = matched.rows.map(([, v]) => [M.gpuCfg(v.gpu).label, xm.get(v), ym.get(v)]);
  if (rows.length < 2) return null;
  const beats = (m, a, b) => (m.better === 'low' ? a < b : a > b);  // a strictly better than b on axis m
  const out = [];
  for (const [nm, x, y] of rows) {
    const by = rows.find(([nm2, x2, y2]) => nm2 !== nm && beats(xm, x2, x) && beats(ym, y2, y));
    if (by) out.push([nm, by[0]]);
  }
  if (!out.length) return null;
  const axes = `both axes shown (${lcl(xm.label)} and ${lcl(ym.label)})`;
  // Explain the node-size restriction only in mixed-size views.
  const scope = matched.mixed ? ' at the same node size' : '';
  if (out.length === 1) {
    return `**${out[0][1]}** is better than **${out[0][0]}** on ${axes}${scope}, so ${out[0][0]} has no advantage in this comparison.`;
  }
  return `**${out.length} of the ${rows.length} configs${scope}** are each beaten on ${axes} by another config here: ${list(out.map(([nm]) => nm))}.`;
}

/** Compare per-request rent and ownership winners. */
function ownVsRent(hw, noun) {
  const r = Object.entries(hw).filter(([, v]) => v.rentReq != null);
  const b = Object.entries(hw).filter(([, v]) => v.buyReq != null);
  if (!r.length || !b.length) return null;
  const rw = r.reduce((a, c) => (c[1].rentReq < a[1].rentReq ? c : a));
  const bw = b.reduce((a, c) => (c[1].buyReq < a[1].buyReq ? c : a));
  if (rw[0] === bw[0]) {
    return `**${gname(rw[0])}** is cheapest on **both** costing bases: lowest to rent (**${M.fmtReq(rw[1].rentReq)} / ${noun}**) and lowest to own (**${M.fmtReq(bw[1].buyReq)} / ${noun}**).`;
  }
  return `**The cheapest accelerator depends on how you pay**: **${gname(rw[0])}** is cheapest to rent at **${M.fmtReq(rw[1].rentReq)} / ${noun}**, while **${gname(bw[0])}** is cheapest to own at **${M.fmtReq(bw[1].buyReq)} / ${noun}** (buy TCO).`;
}

/** Compare engine and accelerator effects on single-turn decode throughput at matched node sizes. */
function engineLever(scnv, s, tier) {
  const fws = Object.keys(scnv.fw || {});
  if (fws.length < 2) return null;
  const other = fws.find((f) => f !== s.fw);
  // Exclude comparison-only copies that did not run under the selected engine.
  const own = (m, fw) => Object.fromEntries(Object.entries(m || {})
    .filter(([, r]) => r.fw === fw && (!tier || M.tierOf(r) === tier)));
  const a = own((scnv.fw[s.fw] || {}).hw, s.fw), b = own((scnv.fw[other] || {}).hw, other);
  const here = M.FWLABEL[s.fw] || s.fw, there = M.FWLABEL[other] || other;

  let top = null;
  for (const g of Object.keys(a)) {
    if (!b[g] || !a[g].tps || !b[g].tps) continue;
    if (a[g].gpu !== b[g].gpu) continue;  // different node size — not an engine contrast
    const ratio = Math.max(a[g].tps, b[g].tps) / Math.min(a[g].tps, b[g].tps);
    if (!top || ratio > top.ratio) top = { g, ratio, here: a[g].tps, there: b[g].tps };
  }
  if (!top) return null;

  // Measure cross-card spread within one tier and the modal node size.
  let cards = null;
  const all = Object.values(a).filter((r) => r.tps);
  const dc = all.filter((r) => r.tier === 'datacentre');
  const scoped = dc.length && dc.length !== all.length ? dc : all;
  const cnt = {};
  scoped.forEach((r) => { const k = nodeN(r); if (k) cnt[k] = (cnt[k] || 0) + 1; });
  const modal = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0];
  const matched = modal ? scoped.filter((r) => String(nodeN(r)) === modal[0]) : [];
  if (matched.length > 1) {
    const t = matched.map((r) => r.tps);
    cards = {
      ratio: Math.max(...t) / Math.min(...t), n: matched.length, node: modal[0],
      label: scoped === dc ? 'datacentre accelerators' : 'accelerators',
    };
  }

  const swap = `switching between ${here} and ${there} moved decode throughput by **${top.ratio.toFixed(1)}×** (${top.here.toFixed(0)} vs ${top.there.toFixed(0)} tok/s)`;
  const tuning = 'Note: this is measured as configured, so an engine gap may reflect tuning, not the engines themselves.';
  if (!cards) {
    // No comparable cross-card spread is available.
    return `**The choice of inference engine matters**: on **${gname(top.g)}**, ${swap}. ${tuning}`;
  }
  if (top.ratio >= cards.ratio) {
    return `**The engine matters more than the accelerator here**: on **${gname(top.g)}**, ${swap}, while across the ${cards.n} ${cards.label} at ×${cards.node} it differs by only **${cards.ratio.toFixed(1)}×**. ${tuning}`;
  }
  return `**The accelerator matters more than the engine here**: decode throughput differs by **${cards.ratio.toFixed(1)}×** across the ${cards.n} ${cards.label} at ×${cards.node}, while the largest change from switching engine is **${top.ratio.toFixed(1)}×** (${gname(top.g)}). ${tuning}`;
}

/** Build findings and provenance for the current selection and visible axes. */
export function buildInsights(db, s, fd, scnv, axes = {}) {
  const hw = fd.hw || {};
  const n = Object.keys(hw).length;
  const agentic = scnv.kind === 'agentic';
  const kind = agentic ? 'agentic' : 'moe';
  const noun = agentic ? 'task' : 'request';
  const findings = [];

  // Rank the current selection only. Compare node-scaled metrics at one node size.
  const capKey = agentic ? null : (Object.values(hw).some((v) => v.reqs != null) ? 'reqs' : 'tps');
  const capRows = capKey ? Object.entries(hw).filter(([, v]) => v[capKey] != null) : [];
  const capField = capRows.length ? matchedNode(capRows) : null;
  const cap = agentic ? best(hw, 'e2e', true) : (capField && best(Object.fromEntries(capField.rows), capKey));
  // Name the node-size scope only for mixed-size views.
  const capAt = capField && capField.mixed ? ` among the ${capField.rows.length} configs at ×${capField.node}` : '';
  const capTxt = cap && (agentic
    ? `**${gname(cap[0])}** finishes tasks fastest (**${Math.round(cap[1].e2e)} s** avg)`
    : (capKey === 'reqs'
      ? `**${gname(cap[0])}** serves the most requests at **${cap[1].reqs >= 10 ? cap[1].reqs.toFixed(0) : cap[1].reqs.toFixed(2)} req/s**${capAt}`
      : `**${gname(cap[0])}** leads decode speed at **${cap[1].tps.toFixed(0)} tok/s per user**${capAt}`));
  const bb = best(hw, 'buyReq', true), br = best(hw, 'rentReq', true);
  const bc = bb || br;
  const costTxt = bc && `**${gname(bc[0])}** is cheapest at **${M.fmtReq(bc[1][bb ? 'buyReq' : 'rentReq'])} / ${noun}** (${bb ? 'buy TCO' : 'rent'}, wall-clock)`;
  // A single-card view reports measurements without declaring a winner.
  if (n === 1) {
    const g = Object.keys(hw)[0], v = hw[g];
    const bits = [
      agentic ? (v.e2e != null && `**${Math.round(v.e2e)} s** avg task latency`)
              : (v.reqs != null ? `**${v.reqs >= 10 ? v.reqs.toFixed(0) : v.reqs.toFixed(2)} req/s**`
                                : v.tps != null && `**${v.tps.toFixed(0)} tok/s per user**`),
      v.buyReq != null ? `**${M.fmtReq(v.buyReq)} / ${noun}** to own`
        : v.rentReq != null && `**${M.fmtReq(v.rentReq)} / ${noun}** to rent`,
    ].filter(Boolean);
    if (bits.length) {
      const scalingN = (fd.alts || []).length;
      const tail = scalingN
        ? `The ${scalingN === 1 ? 'alternate node size is' : `${scalingN} alternate node sizes are`} included only to show how performance scales with node size, and ${scalingN === 1 ? 'is' : 'are'} left out of the rankings.`
        : 'Nothing to compare it against here. Switch tier, model or batch regime for a ranking.';
      findings.push(`Only **${gname(g)}** is in the cross-hardware field: ${bits.join(', ')}. ${tail}`);
    }
  } else if (capTxt && costTxt) {
    findings.push(`Of the **${n} hardware configs in this view**, ${capTxt} and ${costTxt}.`);
  } else if (capTxt) {
    findings.push(`Of the **${n} hardware configs in this view**, ${capTxt}. No cost is available for this selection.`);
  } else if (costTxt && capRows.length) {
    // A tied modal node size prevents a fair throughput ranking.
    findings.push(`Of the **${n} hardware configs in this view**, ${costTxt}. They run at different node sizes, so no throughput leader is named here: requests/s scales with node size.`);
  } else if (costTxt) {
    findings.push(`Of the **${n} hardware configs in this view**, ${costTxt}. No throughput is available for this selection.`);
  }

  // Order findings from headline comparisons to workload context.
  const dom = n > 1 && dominated(hw, axes.xm, axes.ym); if (dom) findings.push(dom);
  const own = n > 1 && ownVsRent(hw, noun); if (own) findings.push(own);
  // Agentic trajectories are not comparable across engines.
  const eng = agentic ? null : engineLever(scnv, s, s.tier); if (eng) findings.push(eng);

  if (agentic) {
    const pf = timingProfiles(fd, 'agentic').task;
    if (pf) {
      findings.push(pf.tool >= 40
        ? `**Tool-bound**: about **${pf.tool}% of wall time** is spent waiting on tools with the GPU idle, so a faster host matters more here than a faster accelerator.`
        : `**Decode-bound**: ${pf.decode}% decode against ${pf.tool}% tool-wait, so this workload behaves much like one long generation.`);
    }
    findings.push('Sparsity-aware MBU and MFU are not measured on agentic runs (no sparsity trace), so the radar shows fewer axes here.');
  } else {
    // Report bandwidth headroom across the visible configurations.
    const mv = Object.entries(hw).filter(([, v]) => v.mbu_d != null);
    if (mv.length) {
      const bm = mv.reduce((a, b) => (b[1].mbu_d > a[1].mbu_d ? b : a));
      const hi = bm[1].mbu_d, lo = Math.min(...mv.map(([, v]) => v.mbu_d));
      // State coverage when some configurations lack a sparsity trace.
      const of = mv.length < n ? ` of the ${n}` : '';
      const spread = mv.length > 1 && hi - lo >= 1
        ? `**${lo.toFixed(0)}–${hi.toFixed(0)}% of rated memory bandwidth** across ${mv.length}${of} configurations`
        : `**${hi.toFixed(0)}% of rated memory bandwidth** on ${gname(bm[0])}`;
      // Do not infer decode compute use without a decode MFU measurement.
      findings.push(`Measured decode uses ${spread}, leaving **${(100 - hi).toFixed(0)}% unused** at the highest observed point. In this view, software-achieved bandwidth is the relevant constraint.`);
    }
  }

  // --- basis and caveats ----------------------------------------------------------------------
  const basis = [];
  basis.push(`**Per-${noun} cost basis (the headline)**: node price per second × the run's wall-clock seconds per ${noun}${agentic ? ' (task wall time divided by the average number of tasks running at once)' : ' (total run time ÷ requests served)'}. All time the node spends is charged, including prefill${agentic ? ', decode and tool-wait' : ' and decode'}.`);
  const lab = ((db.pricing || {}).cost_labels || {})[kind];
  if (!agentic && lab && lab.description) basis.push(`**Per-token rent basis (the steady-state pair)**: ${lab.description}`);
  const priced = M.shownGpus(db, s).map((g) => [g, hw[g]]).filter(([, v]) => v && v.rent_source_kind);
  if (priced.length) {
    basis.push(`**Rent price basis**: ${priced.map(([g, v]) => {
      const price = v.rent_price_per_gpu_hour_usd != null ? ` at $${(+v.rent_price_per_gpu_hour_usd).toFixed(3)}/GPU-h` : '';
      const b = v.rent_price_basis ? ` (${v.rent_price_basis})` : '';
      return `**${gname(g)}**: ${v.rent_source_label || v.rent_source_kind}${price}${b}`;
    }).join(' · ')}`);
    if (new Set(priced.map(([, v]) => v.rent_source_kind)).size > 1) {
      basis.push('**Rent comparability warning**: the rent prices here come from different kinds of sources (marketplace quotes, fallback prices, managed cloud), so rent comparisons across providers are approximate.');
    }
  }

  return { lead: null, findings, basis };
}

/** Build cost, speed and capacity tiles from canonical records in the current tier. */
export function buildVerdicts(hw, agentic, costBasis = 'Buy') {
  const noun = agentic ? 'task' : 'request';
  const one = Object.keys(hw).length === 1;
  const cfgLabel = (v) => M.gpuCfg(v.gpu).label;
  const tiles = [];
  const buy = costBasis === 'Buy';
  const bc = best(hw, buy ? 'buyReq' : 'rentReq', true);
  // Ownership cost includes amortisation, energy and throughput, not sticker price alone.
  if (bc) tiles.push({
    key: 'cost', gpu: bc[0], name: cfgLabel(bc[1]), col: bc[1].col,
    label: one ? `${buy ? 'Buy' : 'Rent'} & run cost` : `Cheapest to ${buy ? 'buy' : 'rent'} & run`,
    value: M.fmtReq(bc[1][buy ? 'buyReq' : 'rentReq']), unit: `/ ${noun}`,
    basis: buy ? 'buy TCO: amortises estimated purchase prices'
      : (bc[1].rent_source_label ? `rent: ${bc[1].rent_source_label}` : 'rent: live quote'),
    custom: buy,
  });
  if (agentic) {
    // Task latency does not require matching node sizes.
    const bt = best(hw, 'e2e', true);
    if (bt) tiles.push({
      key: 'fast', label: one ? 'Task latency' : 'Fastest task', gpu: bt[0], name: cfgLabel(bt[1]), col: bt[1].col,
      value: `${bt[1].e2e >= 100 ? Math.round(bt[1].e2e) : bt[1].e2e.toFixed(1)} s`,
      unit: 'avg end-to-end', basis: 'measured',
    });
  } else {
    const rows = Object.entries(hw).filter(([, v]) => v.tps != null);
    const fmt = (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));
    if (rows.length === 1) {
      tiles.push({
        key: 'fast', label: 'Tokens/s per user', gpu: rows[0][0], name: cfgLabel(rows[0][1]), col: rows[0][1].col,
        value: fmt(rows[0][1].tps), unit: 'tok/s', basis: 'measured',
      });
    } else if (rows.length > 1) {
      // Skip the tile when fewer than two records share the modal node size.
      const m = matchedNode(rows);
      if (m && m.rows.length >= 2) {
        const bt = best(Object.fromEntries(m.rows), 'tps');
        tiles.push({
          key: 'fast', label: 'Fastest per user', gpu: bt[0], name: cfgLabel(bt[1]), col: bt[1].col,
          value: fmt(bt[1].tps), unit: 'tok/s',
          basis: m.mixed ? `measured, ranked among the ${m.rows.length} configs at ×${m.node}` : 'measured',
        });
      }
    }
    // Capacity ranks whole-node request throughput.
    const rfmt = M.PERF_METRICS.find((p) => p.key === 'reqs').fmt;
    const crows = Object.entries(hw).filter(([, v]) => v.reqs != null);
    if (crows.length === 1) {
      tiles.push({
        key: 'cap', label: 'Requests/s', gpu: crows[0][0], name: cfgLabel(crows[0][1]), col: crows[0][1].col,
        value: rfmt(crows[0][1].reqs), unit: 'req/s', basis: 'measured',
      });
    } else if (crows.length > 1) {
      const m = matchedNode(crows);
      if (m && m.rows.length >= 2) {
        const bt = best(Object.fromEntries(m.rows), 'reqs');
        tiles.push({
          key: 'cap', label: 'Highest capacity', gpu: bt[0], name: cfgLabel(bt[1]), col: bt[1].col,
          value: rfmt(bt[1].reqs), unit: 'req/s',
          basis: m.mixed ? `measured, ranked among the ${m.rows.length} configs at ×${m.node}` : 'measured',
        });
      }
    }
  }
  return tiles;
}
