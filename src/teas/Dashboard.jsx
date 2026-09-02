import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, SlidersHorizontal } from 'lucide-react';
import * as M from './model.js';
import * as PR from './pricing.js';
import { GCOL, useChartTheme } from './theme.js';
import { radarSVG, fig2SVG, fig3SVG, fig4SVG, turnplotSVG, hwScatterSVG, crossModelSVG, expertSVG, bandwidthSVG, variationSVG, controlledMetricFingerprintSVG, varRatio, tipHandlers } from './charts.js';
import { buildInsights, buildVerdicts } from './insights.js';
import { timingProfiles } from './timeProfiles.js';
import { prefillRate, prefillMfu } from './prefillBasis.js';
import { Nav } from './Nav.jsx';
import { Footer } from './Footer.jsx';

const Sel = ({ className = '', ...props }) => (
  <select {...props} className={`px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm font-semibold ${className}`} />
);
// Compact select used inside the scenario sentence.
const SSel = ({ children, ...props }) => (
  <span className="relative inline-flex items-center">
    <select {...props} className="appearance-none cursor-pointer pl-2 pr-6 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm font-semibold transition hover:border-teal-500 focus:outline-none focus-visible:border-teal-500">
      {children}
    </select>
    <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] leading-none text-slate-400 dark:text-slate-500">▾</span>
  </span>
);
function TimeProfileBar({ label, profile }) {
  const title = profile
    ? `${label}: ${profile.basis}. ${profile.source}. Paired n=${profile.n}`
    : `${label}: not available`;
  return (
    <div className="min-w-[260px] flex-1" title={title}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
        {profile && <span className="text-[11px] text-slate-500 dark:text-slate-400">n={profile.n}</span>}
      </div>
      {profile ? (
        <div className="flex h-6 rounded-md overflow-hidden text-[11px] font-bold">
          <div style={{ width: profile.prefill + '%', background: '#184f95' }} className="flex items-center justify-center text-white border-r-2 border-white dark:border-slate-900">{profile.prefill > 6 ? profile.prefill + '%' : ''}</div>
          <div style={{ width: profile.decode + '%', background: '#5598e7' }} className="flex items-center justify-center text-slate-900 dark:text-slate-100">{profile.decode > 6 ? profile.decode + '%' : ''}</div>
          {profile.tool > 0 && <div style={{ width: profile.tool + '%', background: '#eda100' }} className="flex items-center justify-center text-slate-900 dark:text-slate-100 border-l-2 border-white dark:border-slate-900">{profile.tool > 6 ? profile.tool + '%' : ''}</div>}
        </div>
      ) : (
        <div className="h-6 rounded-md border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-[11px] text-slate-500 dark:text-slate-400">not available</div>
      )}
    </div>
  );
}
const Card = ({ children, className = '', id }) => <div id={id} className={'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm dark:shadow-none ' + className}>{children}</div>;
const Chart = ({ html, onPick }) => <div className="flex justify-center" {...tipHandlers(onPick)} dangerouslySetInnerHTML={{ __html: html }} />;
const Chips = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">{options.map((o) => (
    <button type="button" key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}
      className={'px-2.5 py-1 rounded-full text-xs font-semibold border ' + (o.value === value ? 'bg-teal-700 border-teal-700 text-white' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-teal-500')}>{o.label}</button>
  ))}</div>
);
const CtlRow = ({ label, children }) => (
  <div className="flex items-center gap-2"><span className="text-xs font-bold uppercase text-teal-700 dark:text-teal-300">{label}</span>{children}</div>
);
// Render simple bold markers as React spans.
const MD = ({ t }) => (
  <>{String(t).split(/\*\*/).map((part, i) => (i % 2 ? <strong key={i} className="font-semibold text-slate-800 dark:text-slate-100">{part}</strong> : part))}</>
);
function cmTakeaway(pts, money, hwSpread) {
  if (pts.length < 2) return 'Fewer than two models cover this selection.';
  const cheap = pts.reduce((a, b) => (b.x < a.x ? b : a));
  const front = pts.filter((p) => !pts.some((q) => q !== p && q.x <= p.x && q.y >= p.y
    && (q.x < p.x || q.y > p.y)));
  const base = `**${cheap.name}** is cheapest at **${money(cheap.x)} / 1M tokens**. For **${front.length} of the ${pts.length}** models, no other model here is both cheaper and more accurate.`;
  if (pts.length < 3) return base;
  // Compare models only when their span exceeds the widest within-model hardware spread.
  const span = Math.max(...pts.map((p) => p.x)) / Math.min(...pts.map((p) => p.x));
  const top = [...pts].sort((a, b) => b.y - a.y).slice(0, Math.min(4, pts.length));
  const accGap = top[0].y - top[top.length - 1].y;
  const costSpread = hwSpread != null && span > hwSpread
    ? `Model costs span roughly ${Math.round(span)}×, compared with at most ${hwSpread.toFixed(1)}× across hardware for one model.`
    : `Model costs span roughly ${Math.round(span)}×.`;
  return `${base} ${costSpread} The top ${top.length} models are within ${accGap < 1.5 ? 'one accuracy point' : `${Math.round(accGap)} accuracy points`} of one another.`;
}
// `ghost` reserves space so the provenance badge does not move an open pricing popover.
const Badge = ({ children, ghost = false }) => (
  <span className={'ml-2 align-middle px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-amber-500/60 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10' + (ghost ? ' invisible' : '')}>{children}</span>
);
// Placeholder for selections without published data.
const Pending = ({ children }) => (
  <div className="my-3 flex items-center justify-center gap-2 rounded-lg border border-amber-500/60 bg-amber-50 dark:bg-amber-500/10 px-4 py-8 text-sm text-amber-700 dark:text-amber-300">
    <Clock className="w-4 h-4 shrink-0" />
    <span>{children}</span>
  </div>
);
// Collapsible chart reading guide.
const HowTo = ({ children }) => (
  <details className="mt-2">
    <summary className="cursor-pointer text-xs font-semibold text-teal-700 dark:text-teal-300 select-none">How to read this</summary>
    <div className="mt-1.5 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{children}</div>
  </details>
);
// Summary of the measured result.
const Takeaway = ({ children }) => (
  <div className="mt-3 pl-3 border-l-2 border-teal-600 text-sm text-slate-700 dark:text-slate-300">
    <span className="font-bold text-teal-700 dark:text-teal-300">What it shows. </span>{children}
  </div>
);
// Show short tasks in seconds and longer tasks in minutes.
const dur = (s) => (s < 90 ? `${s}s` : `${Math.round(s / 60)}m`);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b), h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
const pctChange = (v) => Math.abs(v) < 0.05
  ? 'unchanged'
  : `${Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1)}% ${v < 0 ? 'lower' : 'higher'}`;

function turnTakeaway(data, metric) {
  const deltas = Object.values(data).flatMap((series) => {
    const supported = (series || []).filter((p) => Number.isFinite(p[metric])
      && (metric === 'tools' ? p[metric] >= 0 : p[metric] > 0) && p.n >= 20)
      .sort((a, b) => a.t - b.t);
    if (supported.length < 2 || supported[0].t === supported[supported.length - 1].t) return [];
    const first = supported[0][metric], last = supported[supported.length - 1][metric];
    return [{ pct: first > 0 ? (last - first) / first * 100 : null, diff: last - first }];
  });
  if (!deltas.length) return 'Too little data for a trend: no two turns have at least 20 examples each.';
  if (metric === 'tools') {
    const d = median(deltas.map((x) => x.diff));
    return `Across ${deltas.length} accelerators, the median number of tool calls per turn changes by ${d > 0 ? '+' : ''}${d.toFixed(1)} between first and last turn.`;
  }
  const d = median(deltas.map((x) => x.pct));
  return `Across ${deltas.length} accelerators, ${M.metricT(metric).toLowerCase()} is ${pctChange(d)} between first and last turn (only turns with at least 20 examples count).`;
}

// ---- measurement-variation controls ---------------------------------------------------
const VMETRIC_LABEL = { e2e_s: 'end-to-end time', ttft: 'TTFT', tpot: 'TPOT', acc: 'accuracy' };
const VTREE_LABEL = { moe: 'Single-turn', agentic: 'Agentic' };
const VTREE_ORDER = ['moe', 'agentic'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Derive controls from the study data.
function vAxes(variation) {
  const seen = {};
  ((variation && variation.points) || []).forEach((p) => {
    const tree = p && p.coordinate && p.coordinate[0];
    if (!tree) return;
    const s = seen[tree] || (seen[tree] = {});
    Object.keys((p && p.typical) || {}).forEach((k) => { if (k !== 'acc') s[k] = true; });
  });
  const rank = (xs, x) => (xs.indexOf(x) < 0 ? xs.length : xs.indexOf(x));
  const order = (variation && variation.metrics) || [];
  const trees = Object.keys(seen).sort((a, b) => rank(VTREE_ORDER, a) - rank(VTREE_ORDER, b));
  const metrics = {};
  trees.forEach((t) => { metrics[t] = Object.keys(seen[t]).sort((a, b) => rank(order, a) - rank(order, b)); });
  return { trees, metrics };
}

const controlledDatasetLabel = (dataset) => {
  const id = String(dataset || '').replace(/_256samples$/, '').replace(/_/g, '-');
  if (id === 'gsm8k') return 'GSM8K';
  if (id === 'arena-hard') return 'Arena-Hard';
  if (id === 'longbench-v1' || id === 'longbench') return 'LongBench';
  return dataset || 'Unknown workload';
};
const evidenceLabel = (key) => String(key).replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
const controlledPlainMetric = (id, metric) => metric?.label || evidenceLabel(id);
const controlledMetricScale = (metric) => /add|difference|point/i.test(String(metric?.effect_scale || metric?.scale || metric?.analysis || '')) ? 'additive' : 'ratio';
const controlledEstimate = (row) => {
  const estimate = row?.estimate;
  if (Number.isFinite(estimate)) return estimate;
  if (estimate && typeof estimate === 'object') {
    for (const key of ['value', 'ratio', 'difference', 'difference_points']) if (Number.isFinite(estimate[key])) return estimate[key];
  }
  for (const key of ['ratio_estimate', 'mean_difference', 'mean_difference_points', 'difference', 'effect']) if (Number.isFinite(row?.[key])) return row[key];
  return null;
};
const controlledDigits = (value) => Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : Math.abs(value) >= 1 ? 2 : 3;
const controlledEffectUnit = (metric) => /point/i.test(String(metric?.effect_scale || '')) ? 'pp' : (metric?.effect_unit || metric?.unit || '');
const controlledEffect = (value, metric) => {
  if (!Number.isFinite(value)) return 'not available';
  if (controlledMetricScale(metric) === 'additive') return `${value >= 0 ? '+' : ''}${value.toFixed(controlledDigits(value))}${controlledEffectUnit(metric) ? ` ${controlledEffectUnit(metric)}` : ''}`;
  return `${value < 0.1 ? value.toFixed(3) : value.toFixed(value >= 10 ? 1 : 2)}×`;
};
function controlledStudyTakeaway(registry, metricOrder, sliceEffects, sliceInteractions, hardware = 'both') {
  const shownEffects = hardware === 'both' ? sliceEffects : sliceEffects.filter((row) => row.hardware === hardware);
  const ratioRows = shownEffects.filter((row) => controlledMetricScale(registry[row.metric_id]) === 'ratio' && controlledEstimate(row) > 0);
  const largest = ratioRows.reduce((best, row) => !best || Math.abs(Math.log2(controlledEstimate(row))) > Math.abs(Math.log2(controlledEstimate(best))) ? row : best, null);
  const ratioInteractions = sliceInteractions.filter((row) => controlledMetricScale(registry[row.metric_id]) === 'ratio' && controlledEstimate(row) > 0);
  const strongestInteraction = ratioInteractions.reduce((best, row) => !best || Math.abs(Math.log2(controlledEstimate(row))) > Math.abs(Math.log2(controlledEstimate(best))) ? row : best, null);
  const hardwareEffect = (metricId, hardware) => sliceEffects.find((row) => row.metric_id === metricId && row.hardware === hardware);
  const comparison = (lead, metricId) => {
    const metric = registry[metricId], label = controlledPlainMetric(metricId, metric).replace(/^./, (letter) => letter.toLowerCase());
    const a100 = hardwareEffect(metricId, 'a100x2'), h100 = hardwareEffect(metricId, 'h100x2');
    return `${lead}: the new build’s ${label} was ${controlledEffect(controlledEstimate(a100), metric)} its old-build value on 2 A100 GPUs, versus ${controlledEffect(controlledEstimate(h100), metric)} on 2 H100 GPUs.`;
  };
  if (hardware !== 'both') {
    const metric = largest && registry[largest.metric_id], label = largest && controlledPlainMetric(largest.metric_id, metric).replace(/^./, (letter) => letter.toLowerCase());
    const hardwareLabel = hardware === 'a100x2' ? '2 A100 GPUs' : '2 H100 GPUs';
    const observation = largest ? `Largest change: the new build’s ${label} was ${controlledEffect(controlledEstimate(largest), metric)} its old-build value on ${hardwareLabel}.` : 'No valid old/new ratio is available here.';
    return `${observation} The chart shows ${metricOrder.length} metrics for ${hardwareLabel}.`;
  }
  let observation;
  if (largest && strongestInteraction && largest.metric_id === strongestInteraction.metric_id) {
    observation = comparison('Largest change', largest.metric_id);
  } else {
    const movement = largest ? comparison('Largest change', largest.metric_id) : 'No valid old/new ratio is available here.';
    const interaction = strongestInteraction ? comparison('Largest GPU difference', strongestInteraction.metric_id) : 'No valid A100/H100 comparison is available.';
    observation = `${movement} ${interaction}`;
  }
  return `${observation} The chart shows ${metricOrder.length} metrics on both GPU types.`;
}

function ControlledVariationCard({ variation, analysis, onAnalysis }) {
  const registry = variation.metric_registry || {};
  const declaredOrder = Array.isArray(variation.metric_order) ? variation.metric_order : [];
  const registryOrder = [...declaredOrder.filter((id) => registry[id]), ...Object.keys(registry).filter((id) => !declaredOrder.includes(id))];
  const aliasEntries = registryOrder.filter((id) => registry[id]?.effect_scale === 'exact_alias' || registry[id]?.alias_of);
  const metricOrder = registryOrder.filter((id) => !aliasEntries.includes(id));
  const summaries = variation.summaries || {};
  const effects = summaries.build_effects || variation.build_effects || [];
  const interactions = summaries.hardware_interactions || variation.hardware_interactions || [];
  const engines = [...new Set(effects.map((row) => row.engine).filter(Boolean))];
  const preferredEngine = engines.includes(analysis.v3Engine) ? analysis.v3Engine : (engines.includes('sglang') ? 'sglang' : engines[0]);
  const datasets = [...new Set(effects.filter((row) => row.engine === preferredEngine).map((row) => row.dataset).filter(Boolean))];
  const preferredDataset = datasets.includes(analysis.v3Dataset) ? analysis.v3Dataset : (datasets.find((dataset) => String(dataset).startsWith('gsm8k')) || datasets[0]);
  const preferredHardware = ['a100x2', 'h100x2'].includes(analysis.v3Hardware) ? analysis.v3Hardware : 'both';
  const sliceEffects = effects.filter((row) => row.engine === preferredEngine && row.dataset === preferredDataset);
  const sliceInteractions = interactions.filter((row) => row.engine === preferredEngine && row.dataset === preferredDataset);
  const selectedEndpointEffect = sliceEffects.find((row) => row.control_version || row.alternate_version);
  const selectedControlVersion = selectedEndpointEffect?.control_version || variation.design?.endpoints?.[preferredEngine]?.control;
  const selectedAlternateVersion = selectedEndpointEffect?.alternate_version || variation.design?.endpoints?.[preferredEngine]?.alternate;
  const immutableEndpointCount = new Set((variation.leaves || []).filter((leaf) => leaf.engine && leaf.role).map((leaf) => `${leaf.engine}/${leaf.role}/${leaf.engine_version || leaf.version || 'unknown'}/${leaf.image_ref || leaf.image_digest || leaf.container_image_digest || leaf.container_image || leaf.image || 'unavailable'}`)).size;
  const takeaway = controlledStudyTakeaway(registry, metricOrder, sliceEffects, sliceInteractions, preferredHardware);
  // Compare build effects with repeatability on job wall time.
  const ratioDev = (v) => Math.max(v, 1 / v);
  const buildDevs = effects.filter((r) => r.metric_id === 'job_s' && r.estimate?.scale === 'ratio' && r.estimate.value > 0).map((r) => ratioDev(r.estimate.value));
  const repeatDevs = (summaries.repeatability || []).filter((r) => r.metric_id === 'job_s' && r.summary?.range?.ratio > 0).map((r) => r.summary.range.ratio);
  const vInsight = buildDevs.length >= 3 && repeatDevs.length >= 3 && median(buildDevs) <= median(repeatDevs) && Math.max(...buildDevs) > Math.max(...repeatDevs)
    ? ` The median build change to job wall time (${median(buildDevs).toFixed(2)}×) is smaller than the median run-to-run spread (${median(repeatDevs).toFixed(2)}×), but the largest (${Math.max(...buildDevs).toFixed(1)}×) sits far outside it: most upgrades are within noise, but not all. Telling these two cases apart requires a measurement on the platform in question.`
    : '';
  if (!preferredEngine || !preferredDataset || !metricOrder.length) return <Card className="scroll-mt-24" id="variation"><h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-1">Engine version comparison</h3><Pending>No measured old/new comparison is available in the published study.</Pending></Card>;
  return (
    <Card className="scroll-mt-24" id="variation">
      <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-1">Engine version comparison</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">This chart compares two versions of the software used for our runs. We kept the model, prompts, and hardware setup the same. Each mark compares three matched old/new run pairs. Thin lines show uncertainty across those three comparisons. Arrows show whether higher or lower is better. A dash marks a descriptive metric with no preferred direction.{preferredHardware === 'both' && ' The grey connector compares the two within-GPU build effects.'}</p>
      <div className="flex flex-wrap gap-5 justify-center mb-4">
        <fieldset><legend className="mb-1 text-xs font-bold uppercase text-teal-700 dark:text-teal-300">Engine</legend><Chips options={engines.map((engine) => ({ value: engine, label: M.FWLABEL[engine] || engine }))} value={preferredEngine} onChange={(value) => onAnalysis({ ...analysis, v3Engine: value })} /></fieldset>
        <fieldset><legend className="mb-1 text-xs font-bold uppercase text-teal-700 dark:text-teal-300">Workload</legend><Chips options={datasets.map((dataset) => ({ value: dataset, label: controlledDatasetLabel(dataset) }))} value={preferredDataset} onChange={(value) => onAnalysis({ ...analysis, v3Dataset: value })} /></fieldset>
        <fieldset><legend className="mb-1 text-xs font-bold uppercase text-teal-700 dark:text-teal-300">GPU view</legend><Chips options={[{ value: 'both', label: 'Both' }, { value: 'a100x2', label: 'A100' }, { value: 'h100x2', label: 'H100' }]} value={preferredHardware} onChange={(value) => onAnalysis({ ...analysis, v3Hardware: value })} /></fieldset>
      </div>
      <p className="mb-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-2 text-xs text-slate-600 dark:text-slate-300"><b>{M.FWLABEL[preferredEngine] || preferredEngine} versions:</b> {selectedControlVersion || 'unknown'} (old) → {selectedAlternateVersion || 'unknown'} (new). Most rows show new build ÷ old build: 1× means no change, below 1× means a lower value, and above 1× a higher value. Every mark compares builds on the same GPU. It does not compare absolute A100 and H100 speed. Quality score shows new minus old in percentage points.</p>
      <figure><div className="overflow-x-auto overscroll-x-contain" tabIndex="0" role="region" aria-label="Scrollable chart comparing old and new engine builds across all metrics"><div className="min-w-[930px]"><Chart html={controlledMetricFingerprintSVG(variation, preferredEngine, preferredDataset, preferredHardware)} /></div></div><figcaption className="mt-1 text-xs text-slate-500 dark:text-slate-400">Hover a row for exact values and uncertainty ranges. On narrow screens, scroll the plot horizontally.</figcaption></figure>
      <Takeaway>{takeaway}{vInsight}</Takeaway>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Need the numbers or run details? <a href="/data/variation_study.json" download className="font-semibold text-teal-700 dark:text-teal-300 hover:underline">Download the study JSON</a>. It includes every run value and the exact software images for all {immutableEndpointCount || 'published'} builds (old and new, on both engines).</p>
    </Card>
  );
}
// Buy-pricing controls stored in the URL.
function PricingCtl({ params, defaults, tier, custom, onChange, onReset }) {
  const S = PR.BUY_PARAM_SPEC;
  const shown = PR.resolveParams(params, defaults, tier);
  const rows = [
    ['lifeYears', `${shown.lifeYears.toFixed(1)} yr`],
    ['util', `${Math.round(shown.util * 100)}%`],
    ['elec', `$${shown.elec.toFixed(2)}/kWh`],
  ];
  return (
    <details className="relative">
      <summary className={'list-none flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 rounded-lg border text-xs font-semibold select-none ' +
        (custom ? 'border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-teal-500')}>
        {/* Keep the label width fixed while a slider is dragged. */}
        <SlidersHorizontal className="w-3.5 h-3.5" />Buy pricing
      </summary>
      <div className="absolute right-0 z-20 mt-1.5 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-lg space-y-2.5">
        {rows.map(([k, val]) => (
          <label key={k} className="block text-xs">
            <span className="flex justify-between font-semibold text-slate-700 dark:text-slate-200">
              <span>{S[k].label}</span><span className="text-teal-700 dark:text-teal-300">{val}</span>
            </span>
            <input type="range" min={S[k].min} max={S[k].max} step={S[k].step} value={shown[k]}
              onChange={(e) => onChange({ [k]: +e.target.value })} className="w-full accent-teal-600" />
          </label>
        ))}
        <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          Shows the {tier} defaults until changed. An explicit value applies across both hardware tiers. Rent, catalogue prices, and measurements stay fixed.
        </p>
        <button onClick={onReset} disabled={!custom}
          className={'w-full px-2 py-1.5 rounded-lg border text-xs font-semibold ' + (custom ? 'border-teal-600 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10' : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-default')}>
          Reset to published defaults
        </button>
      </div>
    </details>
  );
}

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = location.pathname === '/insights' ? 'analysis' : 'overview';  // Map routes to dashboard tabs.
  useChartTheme();  // Rebuild SVG strings after a theme change.
  const [data, setData] = useState(null);
  const [sel, setSel] = useState({ model: null, fam: 'general', member: 'arena-hard', batch: 'batch-size-default', fw: 'vllm', tier: 'datacentre' });
  const [rx, setRx] = useState({ phase: 'decode', cost: 'nCbr' });  // radar: phase drives the axis set
  const [hmAxes, setHmAxes] = useState({
    moe: { experience: 'tpu', capacity: 'nodeTps', burden: 'buyReq' },
    agentic: { experience: 'e2e', capacity: 'taskConc', burden: 'buyReq' },
  });
  const [an, setAn] = useState({ f2model: 'all', f2gpu: 'all', f3model: 'gpt-oss-120b', f3work: 'all', f3gpu: 'all', tModel: 'gpt-oss-120b', tWork: null, tFw: 'vllm', tMetric: 'tps', f4model: 'gpt-oss-120b', f4fw: 'vllm', f4gpu: 'h100x1', f4metric: 'tps', cmWork: 'arena-hard', cmFw: 'vllm', cmCost: 'rent', bwModel: 'gpt-oss-120b', bwBatch: 'batch-size-default', vMetric: 'e2e_s', vArm: 'version', vTree: 'moe', v3Engine: 'sglang', v3Dataset: 'gsm8k', v3Hardware: 'both' });

  useEffect(() => {
    Promise.all([
      ...['db', 'figs', 'turns'].map((n) => fetch(`/data/${n}.json`).then((r) => r.json())),
      // Flags are optional. A missing file must not block the dashboard.
      fetch('/data/flags.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      // The variation study is optional.
      fetch('/data/variation_study.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([db, figs, turns, flags, variation]) => { setData({ db, figs, turns, flags: flags || {}, variation }); setSel((s) => M.fixSel(db, { ...s, model: s.model || db.modelOrder[0] })); });
  }, []);

  // Scroll to card anchors after data and layout are ready.
  useEffect(() => {
    if (tab !== 'analysis' || !data) return;
    const h = location.hash.slice(1);
    if (h !== 'per-turn' && h !== 'fixed-vs-natural' && h !== 'variation') return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(h);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [tab, data, location.hash, location.key]);

  if (!data) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 p-8">Loading benchmark data…</div>;
  const { db } = data;
  const flags = data.flags || {};
  const s = M.fixSel(db, sel);
  const set = (patch) => setSel(M.fixSel(db, { ...s, ...patch }));

  // Store adjustable buy-pricing state in the URL.
  const buyDef = PR.buyDefaults(db.pricing);
  const bp = buyDef ? PR.paramsFromSearch(searchParams) : null;
  const bf = buyDef ? PR.buyFactors(db.pricing, bp) : null;
  const customPricing = !!(bf && !PR.isDefaultParams(bp, buyDef));
  const setBp = (patch) => setSearchParams((sp) => PR.paramsToSearch({ ...bp, ...patch }, sp), { replace: true });
  const resetBp = () => setSearchParams((sp) => PR.paramsToSearch({ lifeYears: null, util: null, elec: null }, sp), { replace: true });
  const scnv = M.scn(db, s);
  const isAgentic = scnv.kind === 'agentic';
  // Clone and rescale buy fields without mutating the loaded data.
  const adjBuy = (c) => {
    if (!customPricing || !c) return c;
    const gm = /^(.*?)x(\d+)$/.exec(c.gpu || '');
    const f = gm && bf(gm[1], +gm[2]);
    if (!f || f === 1) return { ...c };
    return { ...c,
      buy: !isAgentic && c.buy != null ? c.buy * f : c.buy,
      buyReq: c.buyReq != null ? c.buyReq * f : c.buyReq };
  };

  const fd0 = M.fwData(db, s);
  const fd = customPricing
    ? { ...fd0, hw: Object.fromEntries(Object.entries(fd0.hw).map(([g, c]) => [g, adjBuy(c)])), alts: (fd0.alts || []).map(adjBuy) }
    : fd0;
  const hw = fd.hw, mem = Object.keys(hw);
  // Recalculate tier-relative radar cost axes after custom pricing. Cheapest equals 100.
  if (customPricing) {
    for (const [nk, raw] of [['nCb', 'buy'], ['nCbr', 'buyReq']]) {
      mem.forEach((g) => {
        const grp = mem.filter((x) => M.tierOf(hw[x]) === M.tierOf(hw[g]));
        const pool = grp.length >= 2 ? grp.map((x) => hw[x][raw]).filter((v) => v) : [];
        hw[g][nk] = (!hw[g][raw] || pool.length < 2) ? null
          : Math.round((Math.min(...pool) / hw[g][raw]) * 100);
      });
    }
  }
  // Limit visible records to the selected hardware tier.
  const vmem = mem.filter((g) => M.tierOf(hw[g]) === s.tier);
  const valts = (fd.alts || []).filter((a) => M.tierOf(a) === s.tier);
  const fam = M.famObj(s.fam), mem0 = M.memObj(s.fam, s.member);
  // Flags for one hardware record in the current selection.
  const rowFlags = (cell, alt = false) => M.cellFlags(flags, {
    model: s.model, batch: s.batch, ds: s.member, fw: s.fw,
    gpu: (cell.gpu || '').replace(/x\d+$/, ''), gpuFull: cell.gpu, alt,
  });

  // Offer only models measured on the selected workload.
  const modelOpts = M.modelsFor(db, s.batch, s.member, s.tier).map((mid) => ({ value: mid, label: db.modelMeta[mid].name, sub: db.modelMeta[mid].sub }));
  // Offer only families and variants measured on the selected tier.
  const famOpts = M.FAMILIES.filter((f) => M.famAvail(db, f, s.tier)).map((f) => ({ value: f.id, label: f.name, sub: f.sub }));
  const memOpts = fam.members.filter((m) => M.memAvail(db, m, s.tier)).map((m) => ({ value: m.ds, label: m.label, sub: m.sub }));
  // Offer only measured batch regimes.
  const batchOpts = M.availBatches(mem0).map((bk) => ({ value: bk, label: bk === 'batch-size-default' ? 'Concurrent' : 'Single query' }));
  const fwOpts = M.fwsOnTier(scnv, s.tier).map((f) => ({ value: f, label: M.FWLABEL[f] || f }));
  // Tier options cover the full dataset. Later controls narrow to that tier.
  const tiersAll = M.tiersInDb(db);
  const tierOpts = M.TIERS.filter((t) => tiersAll.has(t.id)).map((t) => ({ value: t.id, label: t.label }));

  // Phase selects a consistent set of radar metrics. Cost basis remains independent.
  const costMetrics = M.costMetricsFor(isAgentic);
  const timeProfiles = timingProfiles(fd, scnv.kind);
  const legendProfile = isAgentic ? timeProfiles.task : timeProfiles.request;
  // Map normalised radar axes to raw values, units and optional formatters.
  const perN = isAgentic ? 'task' : 'request';
  const RRAW = { nP: ['tps', 'token/s'], nPp: ['tps_p', 'token/s'], nR: ['reqs', 'req/s'],
    nE: ['tokJ', 'token/joule'], nEr: ['jReq', `J / ${perN}`, M.fmtJoule],
    nM: ['mbu_d', '%'], nMp: ['mbu_p', '%'], nF: ['mfu_p', '%'], nE2e: ['e2e', 's'],
    ...Object.fromEntries(costMetrics.map((c) => [c.norm, [c.key, M.costMeta(c, isAgentic).unit, c.fmt]])) };
  const ax = (k, l) => ({ k, l, raw: (RRAW[k] || [])[0], unit: (RRAW[k] || [])[1], fmt: (RRAW[k] || [])[2] });
  // Radar axes use best-in-view = 100, with raw values in tooltips.
  const radarCostMetric = costMetrics.find((x) => x.norm === rx.cost) || costMetrics[0];
  const costAx = () => ax(radarCostMetric.norm, radarCostMetric.basis === 'Buy' ? 'Buy TCO' : 'Rent');
  const phase = isAgentic ? 'decode' : rx.phase;
  const radarAxes = (phase === 'prefill'
    ? [ax('nPp', 'Prefill throughput'), ax('nR', 'Request rate'), costAx(), ax('nEr', 'Energy'), ax('nMp', 'MBU prefill'), ax('nF', 'MFU prefill')]
    // Missing workload-specific axes are filtered below.
    : [ax('nP', 'Tokens/s per user'), ax('nE2e', 'Task latency'), ax('nR', 'Request rate'), costAx(), ax('nEr', 'Energy'), ax('nM', 'MBU decode')]
  ).filter((a) => vmem.some((n) => hw[n][a.k] != null));  // drop axes nothing measured, don't plot them at 0
  // A radar needs at least two records and three axes.
  const radarShown = vmem.length >= 2 && radarAxes.length >= 3;

  // Agentic rows replace sparsity metrics with tool-call counts.
  const turnsSeries = (g) => (((data.turns[s.model] || {})[s.member] || {})[s.fw] || {})[g];
  const toolCallsPerTask = (g) => {
    const ser = turnsSeries(g);
    if (!ser || !ser.length || ser[0].n == null) return null;
    const tot = ser.reduce((acc, p) => acc + (p.tools || 0) * (p.n || 0), 0);
    return Math.round(tot / ser[0].n * 10) / 10;
  };
  // Group table columns by experience, operating point, cost, energy and diagnostics.
  const groupedCols = isAgentic
    ? [['', [['Hardware', 'name']]],
       ['Experience', [['Task latency (avg e2e, s)', 'e2e'], ['TTFT (ms)', 'ttft'], ['TPOT (ms)', 'tpot_ms'], ['Tokens/s per user', 'tps']]],
       ['Operating point', [['Achieved task concurrency', 'task_concurrency_achieved']]],
       ['Task shape', [['Tokens / task', 'tokReq'], ['Tool calls / task', 'toolcalls']]],
       ['Cost', [['Buy ($ / task)', 'buyReq'], ['Rent ($ / task)', 'rentReq']]],
       ['Energy', [['J / task', 'jReq'], ['Token/joule (decode)', 'tokJ']]],
       ['Quality', [['Task success (%)', 'acc']]]]
    : [['', [['Hardware', 'name']]],
       ['Experience', [['TTFT (ms)', 'ttft'], ['TPOT (ms)', 'tpot_ms'], ['Tokens/s per user', 'tps']]],
       ['Capacity', [['Requests/s', 'reqs'], ['Prefill (token/s)', 'tps_p'], ['Achieved decode batch', 'decode_batch_achieved'], ['Tokens / request', 'tokReq']]],
       ['Cost', [['Buy ($ / request)', 'buyReq'], ['Rent ($ / request)', 'rentReq'], ['Buy ($ / 1M tokens, decode)', 'buy'], ['Rent ($ / 1M tokens, decode)', 'rent']]],
       ['Energy', [['J / request', 'jReq'], ['Token/joule (decode)', 'tokJ']]],
       ['Diagnostics', [['MBU decode (%)', 'mbu_d'], ['MFU prefill (%)', 'mfu_p'], ['Task accuracy (%)', 'acc']]]];
  const cols = groupedCols.flatMap(([, cs], gi) => cs.map((c, ci) => ({ l: c[0], k: c[1], sep: gi > 0 && ci === 0 })));
  const sepCls = ' border-l border-slate-300 dark:border-slate-700';
  const fmtReqs = M.PERF_METRICS.find((m) => m.key === 'reqs').fmt;
  const cell = (d, c, gpuKey, fl, scaling) => {
    const { k } = c;
    const cls = c.sep ? sepCls : '';
    const v = k === 'toolcalls' ? toolCallsPerTask(gpuKey) : d[k];
    // Mark flagged rows and label estimates. Invalid basis pairs stay unavailable.
    if (k === 'tps_p' || k === 'mfu_p') {
      const lv = k === 'tps_p' ? prefillRate(d) : prefillMfu(d);
      if (!lv) return <td key={k} className={'text-slate-500 dark:text-slate-400' + cls}>—</td>;
      return <td key={k} className={cls}>{lv.value}{lv.estimated && (
        <span className="ml-1 cursor-help align-middle rounded-full border border-amber-500/60 bg-amber-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
          data-tip="<b>Estimated</b><br>Prefill rate estimated from this run's summary fields (no exact trace). See Methods.">est</span>
      )}</td>;
    }
    if (k === 'name') return <td key={k} className="text-left font-semibold"><span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: GCOL[gpuKey] || d.col }} />{d.name}{M.WHOLE_MACHINE.has(gpuKey) ? null : <span className="font-normal text-slate-400 dark:text-slate-500"> ×{M.gpuCfg(d.gpu).n}</span>}{scaling && <span className="ml-1.5 whitespace-nowrap rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{scaling}</span>}{fl && fl.length > 0 && (
      <span className="ml-1.5 cursor-help align-middle text-amber-600 dark:text-amber-400"
        data-tip={`<b>Audit flags</b><br>${fl.map(M.flagLine).join('<br>')}`}>⚠</span>
    )}</td>;
    if (v == null) return <td key={k} className={'text-slate-500 dark:text-slate-400' + cls}>—</td>;
    if (k === 'acc') return <td key={k} className={cls}>{(v * 100).toFixed(1)}%</td>;
    if (k === 'ttft') return <td key={k} className={cls}>{Math.round(v * 1000)}</td>;  // stored in s, shown in ms
    if (k === 'e2e') return <td key={k} className={cls}>{Math.round(v)}</td>;  // avg task latency, stored in s
    // Keep per-million prices at two decimals after custom scaling.
    if (k === 'rent' || k === 'buy') return <td key={k} className={cls}>${(+v).toFixed(2)}</td>;
    if (k === 'rentReq' || k === 'buyReq') return <td key={k} className={cls}>{M.fmtReq(v)}</td>;
    if (k === 'jReq') return <td key={k} className={cls}>{M.fmtJoule(v)}</td>;
    if (k === 'tokReq') return <td key={k} className={cls}>{v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v)}</td>;
    if (k === 'decode_batch_achieved' || k === 'task_concurrency_achieved') return <td key={k} className={cls}>{v.toFixed(1)}</td>;
    // Use the shared formatter to preserve precision below 0.1 req/s.
    if (k === 'reqs') return <td key={k} className={cls}>{fmtReqs(v)}</td>;
    return <td key={k} className={cls}>{v}</td>;
  };

  const accs = vmem.map((n) => ({ name: hw[n].name, col: GCOL[n] || hw[n].col, acc: hw[n].acc, nq: hw[n].n, ci: M.wilson(hw[n].acc, hw[n].n), meta: [...M.runMeta(hw[n]), ...rowFlags(hw[n]).map(M.flagLine)] })).filter((x) => x.acc != null);
  // Compare single-turn hardware spread with the typical confidence-interval width.
  const accCI = !isAgentic && accs.length >= 2 && accs.every((x) => x.ci);
  const accSpread = accs.length ? Math.max(...accs.map((x) => x.acc)) - Math.min(...accs.map((x) => x.acc)) : 0;
  const accHalf = accCI ? accs.map((x) => x.ci.half).sort((a, b) => a - b)[Math.floor(accs.length / 2)] : 0;
  const accWithinNoise = accCI && accSpread <= 2 * accHalf;
  const accMn = accs.length ? Math.min(...accs.map((x) => x.acc)) : 0, accMx = accs.length ? Math.max(...accs.map((x) => x.acc)) : 1;

  // ---- Linked hardware view -------------------------------------------------------------
  // Both panels share the experience axis and show two views of the same operating point.
  const comparisonCells = [...vmem.map((g) => hw[g]), ...valts];
  const forKind = (m) => (isAgentic ? !m.moeOnly : !m.agenticOnly);
  const experienceMetrics = M.PERF_METRICS.filter((m) => m.group === 'experience' && forKind(m))
    .map((m) => M.perfMeta(m, isAgentic));
  const capacityMetrics = M.PERF_METRICS.filter((m) => m.group === 'capacity' && forKind(m))
    // Hide node throughput when the loaded data does not provide it.
    .filter((m) => m.key !== 'nodeTps' || comparisonCells.some((c) => m.get(c) != null))
    .map((m) => M.perfMeta(m, isAgentic));
  const energyMetrics = M.PERF_METRICS.filter((m) => m.group === 'energy' && forKind(m))
    .map((m) => ({ ...M.perfMeta(m, isAgentic), group: 'energy' }));
  const burdenMetrics = [
    ...costMetrics.map((m) => ({ ...M.costMeta(m, isAgentic), group: 'cost' })),
    ...energyMetrics,
  ];
  const HM_EM = Object.fromEntries(experienceMetrics.map((m) => [m.key, m]));
  const HM_CM = Object.fromEntries(capacityMetrics.map((m) => [m.key, m]));
  const HM_BM = Object.fromEntries(burdenMetrics.map((m) => [m.key, m]));
  const hmKind = isAgentic ? 'agentic' : 'moe';
  const hmState = hmAxes[hmKind];
  const setHmAxis = (axis, value) => setHmAxes((prev) => ({
    ...prev, [hmKind]: { ...prev[hmKind], [axis]: value },
  }));
  const hmEm = HM_EM[hmState.experience] || experienceMetrics[0];
  const hmCm = HM_CM[hmState.capacity] || capacityMetrics[0];
  const hmBm = HM_BM[hmState.burden] || burdenMetrics[0];
  const hmBurdenIsCost = hmBm?.group === 'cost';
  const operatingPointNote = isAgentic
    ? 'Agentic results are one workload-constrained operating point per hardware, not a concurrency sweep. Achieved task concurrency can differ by point.'
    : s.batch === 'batch-size-default'
      ? 'In concurrent mode the inference engine chooses its own batch size. We report the batch it achieved rather than sweeping concurrency levels.'
      : 'Single query fixes the achieved decode batch at one.';
  const burdenBasisNote = hmBurdenIsCost
    ? (hmBm.per === 'req'
      ? `${hmBm.basis} cost per ${isAgentic ? 'task' : 'request'} divides the node's price by the ${isAgentic ? 'tasks' : 'requests'} it actually served, so speed is already accounted for.`
      : 'Cost per million tokens is the node price divided by its measured total decode rate.')
    : hmBm?.key === 'jReq'
      ? (isAgentic
        ? 'Energy per task uses nameplate power during prefill and decode, plus an idle-draw estimate during tool wait.'
        : 'Energy per request multiplies nameplate node power by the same wall-clock time as the cost basis, so it is an upper bound.')
      : 'Decode energy efficiency assumes nameplate node power. On agentic runs the value is an estimate and labelled as such.';
  // Rank canonical hardware only. Alternates remain visible as scaling points.
  const fdView = { ...fd, hw: Object.fromEntries(vmem.map((g) => [g, hw[g]])), alts: valts };
  const ins = buildInsights(db, s, fdView, scnv, { xm: hmEm, ym: hmCm });
  // Show canonical and alternate node configurations with shared run metadata.
  const configs = [...vmem.map((g) => ({ cell: hw[g], alt: false })), ...valts.map((cell) => ({ cell, alt: true }))];
  const shortMetric = (m) => m.label.replace(/\s*\(.*\)$/, '').toLowerCase();
  const makePanel = (ym) => {
    if (!ym || !hmEm) return { pts: [], missing: [] };
    const pts = [];
    const missing = [];
    configs.forEach(({ cell, alt }) => {
      const x = hmEm.get(cell), y = ym.get(cell);
      const fam = (cell.gpu || '').replace(/x\d+$/, '');
      const cfg = M.gpuCfg(cell.gpu);
      const scaling = alt ? M.nodeScalingLabel(hw[fam], cell) : null;
      if (x == null || y == null) {
        const which = [x == null && shortMetric(hmEm), y == null && shortMetric(ym)].filter(Boolean).join(' or ');
        const node = M.WHOLE_MACHINE.has(fam) ? '' : ` ${scaling || `×${cfg.n}`}`;
        missing.push(`${cfg.name}${node} (no ${which})`);
        return;
      }
      const details = M.operatingPointDetails(cell, isAgentic)
        .filter((d) => d.field !== ym.field && d.field !== hmEm.field);
      pts.push({
        gpuKey: fam, name: cfg.name, manufacturer: cfg.manufacturer, model: cfg.model,
        col: GCOL[fam] || cell.col, x, y,
        sub: M.WHOLE_MACHINE.has(fam) ? '' : (scaling || `×${cfg.n}`),
        details,
        meta: [...(scaling ? [`Comparison role: ${cfg.model} ${scaling}`] : []), ...M.runMeta(cell), ...rowFlags(cell, alt).map(M.flagLine)],
      });
    });
    pts.sort((a, b) => M.GPUS.indexOf(a.name) - M.GPUS.indexOf(b.name));
    return { pts, missing };
  };
  const capacityPanel = makePanel(hmCm);
  const burdenPanel = makePanel(hmBm);
  const sharedXValues = comparisonCells.map((cell) => hmEm?.get(cell)).filter(Number.isFinite);
  const sharedXMax = sharedXValues.length ? Math.max(1e-9, ...sharedXValues) * 1.15 : null;
  // Show achieved concurrency as operating-point context, not a hardware ranking.
  const concurrencyContext = (isAgentic || s.batch === 'batch-size-default') ? configs.flatMap(({ cell }) => {
    const value = isAgentic ? cell.task_concurrency_achieved : cell.decode_batch_achieved;
    if (value == null) return [];
    const fam = (cell.gpu || '').replace(/x\d+$/, '');
    const cfg = M.gpuCfg(cell.gpu);
    return [{
      key: cell.gpu,
      name: cfg.model || cfg.name,
      node: M.WHOLE_MACHINE.has(fam) ? '' : `×${cfg.n}`,
      col: GCOL[fam] || cell.col,
      value: M.fmtOperatingCount(value),
    }];
  }) : [];
  // Interleave canonical and alternate table rows by accelerator and node size.
  const tableRows = [...vmem.map((n) => ({ d: hw[n], key: n, fl: rowFlags(hw[n]), scaling: null })), ...valts.map((a) => { const key = (a.gpu || '').replace(/x\d+$/, ''); return { d: a, key, fl: rowFlags(a, true), scaling: M.nodeScalingLabel(hw[key], a) }; })]
    .sort((a, b) => (M.GPUS.indexOf(M.gpuCfg(a.d.gpu).name) - M.GPUS.indexOf(M.gpuCfg(b.d.gpu).name)) || (M.gpuCfg(a.d.gpu).n - M.gpuCfg(b.d.gpu).n));

  // The cost tile follows the selected basis. Energy views use buy TCO.
  const verdicts = buildVerdicts(fdView.hw, isAgentic, hmBurdenIsCost ? hmBm.basis : 'Buy');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Nav />


      {tab === 'overview' && (
        <div className="max-w-7xl mx-auto px-6 py-4 space-y-4">
          {/* Overview */}
          <Card>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              <b className="text-slate-900 dark:text-slate-100">TEAS</b> is an <Link to="/methods#independence" className="text-blue-600 dark:text-blue-400 hover:underline">independent, university-led benchmark</Link> of AI inference across datacentre and workstation accelerators. It reports <b>cost</b>, <b>performance</b> and <b>accuracy</b> on realistic single-turn and agentic workloads, with each value labelled by its evidence basis. Rather than naming one overall winner, it shows which systems suit a given workload, model and budget.
            </p>
          </Card>

          {/* Scenario controls */}
          <Card>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <span>Serving</span>
              <SSel aria-label="Model" value={s.model} onChange={(e) => { const v = e.target.value; const c = M.fixSel(db, { ...s, model: v }); set({ model: v, batch: M.densestBatch(db, c, s.tier) }); }}>
                {modelOpts.map((o) => <option key={o.value} value={o.value}>{o.label}{o.sub ? ` (${o.sub})` : ''}</option>)}
              </SSel>
              <span>for</span>
              <SSel aria-label="Workload family" value={s.fam} onChange={(e) => { const v = e.target.value; set({ fam: v, member: M.famObj(v).members[0].ds }); }}>
                {famOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SSel>
              <span>·</span>
              <SSel aria-label="Workload variant" value={s.member} onChange={(e) => set({ member: e.target.value })}>
                {memOpts.map((o) => <option key={o.value} value={o.value}>{o.label}{o.sub ? ` (${o.sub})` : ''}</option>)}
              </SSel>
              <span>·</span>
              <SSel aria-label="Batch regime" value={s.batch} onChange={(e) => set({ batch: e.target.value })}>
                {batchOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SSel>
              <span>on</span>
              <SSel aria-label="Inference engine" value={s.fw} onChange={(e) => set({ fw: e.target.value })}>
                {fwOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SSel>
              <span>·</span>
              <SSel aria-label="Hardware tier" value={s.tier} onChange={(e) => { const v = e.target.value; const c = M.fixSel(db, { ...s, tier: v }); set({ tier: v, batch: M.densestBatch(db, c, v) }); }}>
                {tierOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SSel>
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {fam.name} · {fam.sub} · {mem0.sub} · {(db.modelMeta[s.model] || {}).sub}
            </div>
          </Card>

          {/* Selected workload */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{scnv.name}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{scnv.desc}</p>
              {/* Link to available per-turn detail. */}
              {isAgentic && Object.values(((data.turns[s.model] || {})[s.member]) || {}).some((fw) => Object.values(fw || {}).some((a) => a && a.length)) && (
                <button onClick={() => { setAn({ ...an, tModel: s.model, tWork: s.member, tFw: s.fw }); navigate({ pathname: '/insights', hash: '#per-turn', search: location.search }); }}
                  className="ml-auto text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">per-turn detail →</button>
              )}
            </div>
          </div>

          {/* Summary tiles */}
          {verdicts.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {verdicts.map((t) => (
                <div key={t.key} className="flex-1 min-w-[220px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm dark:shadow-none">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">{t.label}{t.custom && customPricing && <Badge>Custom pricing</Badge>}</div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{t.value}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t.unit}</span>
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: GCOL[t.gpu] || t.col }} />{t.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t.basis}</div>
                </div>
              ))}
            </div>
          )}

          {/* Linked operating-point charts */}
          <Card>
            <div className="flex flex-wrap justify-between items-start gap-3 mb-2">
              <div>
                <h3 className="text-slate-800 dark:text-slate-200 font-semibold">Performance and cost by hardware{bf && hmBurdenIsCost && hmBm.basis === 'Buy' && <Badge ghost={!customPricing}>Custom pricing</Badge>}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{scnv.name} · {operatingPointNote}</p>
              </div>
              {bf && hmBurdenIsCost && hmBm.basis === 'Buy' && <PricingCtl params={bp} defaults={buyDef} tier={s.tier} custom={customPricing} onChange={setBp} onReset={resetBp} />}
            </div>
            <div className="grid gap-2 mb-2 lg:grid-cols-3">
              <label className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 whitespace-nowrap text-xs font-bold uppercase text-teal-700 dark:text-teal-300">Experience (X)</span>
                <Sel aria-label="User experience metric" className="min-w-0 flex-1" value={hmEm.key} onChange={(e) => setHmAxis('experience', e.target.value)}>
                  {experienceMetrics.map((m) => <option key={m.key} value={m.key}>{`${m.label} (${m.unit})`}</option>)}
                </Sel>
              </label>
              <label className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 whitespace-nowrap text-xs font-bold uppercase text-teal-700 dark:text-teal-300">{isAgentic ? 'Tasks in flight' : 'System output'} (Y)</span>
                <Sel aria-label={isAgentic ? 'Tasks in flight metric' : 'System output metric'} className="min-w-0 flex-1" value={hmCm.key} onChange={(e) => setHmAxis('capacity', e.target.value)}>
                  {capacityMetrics.map((m) => <option key={m.key} value={m.key}>{`${m.label} (${m.unit})`}</option>)}
                </Sel>
              </label>
              <label className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 whitespace-nowrap text-xs font-bold uppercase text-teal-700 dark:text-teal-300">Cost or energy (Y)</span>
                <Sel aria-label="Cost or energy metric" className="min-w-0 flex-1" value={hmBm.key} onChange={(e) => setHmAxis('burden', e.target.value)}>
                  <optgroup label="Cost">
                    {burdenMetrics.filter((m) => m.group === 'cost').map((m) => <option key={m.key} value={m.key}>{m.pick}</option>)}
                  </optgroup>
                  <optgroup label="Energy">
                    {burdenMetrics.filter((m) => m.group === 'energy').map((m) => <option key={m.key} value={m.key}>{`${m.label} (${m.unit})`}</option>)}
                  </optgroup>
                </Sel>
              </label>
            </div>
            {concurrencyContext.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
                <div className="mr-1">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">{isAgentic ? 'Achieved task concurrency' : 'Achieved decode batch'}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{isAgentic ? 'mean tasks in flight' : 'mean requests in decode'}</div>
                </div>
                {concurrencyContext.map((item) => (
                  <div key={item.key} className="inline-flex items-baseline gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: item.col }} />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{item.name}{item.node && <> <span className="text-slate-500 dark:text-slate-400">{item.node}</span></>}</span>
                    <span className="font-bold tabular-nums text-slate-950 dark:text-slate-50">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{burdenBasisNote}</p>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                <h4 className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{isAgentic ? 'Tasks in flight' : 'System output'} vs user experience</h4>
                {capacityPanel.pts.length
                  ? <Chart html={hwScatterSVG(capacityPanel.pts, hmEm, hmCm, { xMax: sharedXMax })} />
                  : <p className="px-1 py-8 text-sm text-slate-500 dark:text-slate-400">No hardware has both {hmCm.label.toLowerCase()} and {hmEm.label.toLowerCase()} for this selection.</p>}
                {capacityPanel.pts.length > 0 && capacityPanel.missing.length > 0 && (
                  <p className="px-1 text-xs text-slate-500 dark:text-slate-400">Not plotted: {capacityPanel.missing.join(' · ')}.</p>
                )}
              </div>
              <div className="min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                <h4 className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Cost or energy vs user experience</h4>
                {burdenPanel.pts.length
                  ? <Chart html={hwScatterSVG(burdenPanel.pts, hmEm, hmBm, { xMax: sharedXMax })} />
                  : <p className="px-1 py-8 text-sm text-slate-500 dark:text-slate-400">No hardware has both {hmBm.label.toLowerCase()} and {hmEm.label.toLowerCase()} for this selection.</p>}
                {burdenPanel.pts.length > 0 && burdenPanel.missing.length > 0 && (
                  <p className="px-1 text-xs text-slate-500 dark:text-slate-400">Not plotted: {burdenPanel.missing.join(' · ')}.</p>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Both panels share the user-experience X axis. The Y axes indicate system output (left) or cost/energy (right). Each point corresponds to a hardware configuration for this workload.
              {valts.length > 0 && <> We also include a few alternate node sizes as early evidence for scaling, which are excluded from comparisons.</>}
              <> See Methods for a <Link to="/methods#metrics" className="text-blue-600 dark:text-blue-400 hover:underline">definition of the metrics</Link>. Hover a point for other metrics and run provenance.</>
            </p>
          </Card>

          {/* Timing breakdown */}
          <Card>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-2">
                <h3 className="text-slate-800 dark:text-slate-200 font-semibold">Time profile of the workload</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: '#184f95' }} />Prefill</span>
                  <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: '#5598e7' }} />Decode</span>
                  <span className={legendProfile?.tool > 0 ? '' : 'opacity-40'}><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: '#eda100' }} />Tool-wait{legendProfile?.tool > 0 ? '' : ' (agentic only)'}</span>
                  <span>· {M.FWLABEL[s.fw] || s.fw}</span>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {isAgentic ? (
                  <TimeProfileBar label="Task time" profile={timeProfiles.task} />
                ) : (
                  <>
                    <TimeProfileBar label="Request-phase time" profile={timeProfiles.request} />
                    <TimeProfileBar label="Share of accelerator work · estimate" profile={timeProfiles.acceleratorEstimate} />
                  </>
                )}
              </div>
              {!isAgentic && <>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Request-phase time is the user-visible prefill/decode split. The accelerator bar estimates how the accelerator&apos;s own work splits between phases: each phase&apos;s time is divided by the batch size that phase ran at. It is not elapsed time or utilisation.</p>
              </>}
              {isAgentic && (
                <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-2">
                  Agentic protocol: {s.member === 'imo-answerbench'
                    ? 'IMO tool calls time out at 5 s (uncapped, models brute-force answers and hang the tool). Achieved task concurrency describes how the run operated. It is not a throughput result.'
                    : 'requested concurrency follows the external tool API limit. Achieved task concurrency varies by run and is shown so results are read at the operating point the run actually reached.'}{' '}
                  <Link to="/methods#agentic-choices" className="underline hover:text-amber-800 dark:hover:text-amber-300">More</Link>
                </p>
              )}
          </Card>

          {/* CAP radar and findings */}
          <div className="grid md:grid-cols-2 gap-5">
            <Card>
              <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                <h3 className="text-slate-800 dark:text-slate-200 font-semibold">CAP+ radar{bf && radarShown && radarCostMetric.basis === 'Buy' && <Badge ghost={!customPricing}>Custom pricing</Badge>}</h3>
                {bf && radarShown && <PricingCtl params={bp} defaults={buyDef} tier={s.tier} custom={customPricing} onChange={setBp} onReset={resetBp} />}
              </div>
              {/* Keep controls available when records exist, even if the radar has too few axes. */}
              {vmem.length >= 2 && <div className="flex flex-wrap items-center gap-3 mb-2">
                {!isAgentic && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-300">Phase</span>
                    <Sel value={rx.phase} onChange={(e) => setRx({ ...rx, phase: e.target.value })}>
                      <option value="decode">Decode</option>
                      <option value="prefill">Prefill</option>
                    </Sel>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-300">Cost</span>
                  <Sel value={radarCostMetric.norm} onChange={(e) => setRx({ ...rx, cost: e.target.value })}>
                    {costMetrics.map((m) => <option key={m.norm} value={m.norm}>{M.costMeta(m, isAgentic).pick}</option>)}
                  </Sel>
                </div>
              </div>}
              {!radarShown ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{vmem.length === 1
                  ? <>The radar compares hardware, and this view has only one accelerator to compare. Alternate node sizes are shown for scaling context, not ranked.</>
                  : <>Fewer than three axes can be compared across these accelerators, and two points make a line rather than a shape. The measured values are in the results table below.</>}</p>
              ) : (<>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Normalised <b>within the hardware tier shown</b> · <b>outward = better on every axis</b> (cost and latency inverted) · hover a vertex for the measured value.</p>
              <Chart html={radarSVG(hw, vmem, radarAxes)} />
              <div className="flex flex-wrap gap-3 justify-center mt-2 text-xs">
                {vmem.map((n) => { const cfg = M.gpuCfg(hw[n].gpu); return (
                  <span key={n}><i className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ background: GCOL[n] || hw[n].col }} />{hw[n].name}{M.WHOLE_MACHINE.has(n) ? '' : <span className="text-slate-400 dark:text-slate-500"> ×{cfg.n}</span>}</span>
                ); })}
              </div>
              <HowTo>
                <p>Each axis is normalised <b>within the selected hardware tier</b>, so the rim is the best of these accelerators. An axis where fewer than two of these accelerators carry a value is <b>dropped and not drawn</b>, so the axis set may differ across selections. <b>Outward means better on every axis</b>, including the inverted cost and latency axes, where the cheapest and fastest accelerator reaches the rim. Read this plot with caution: a vertex shows how an accelerator ranks, not by how much (hover for the measured value), and the enclosed area depends on the order of the axes.</p>
                {isAgentic && <p>Agentic runs have no sparsity trace, so MBU/MFU are not measured and those axes are excluded rather than drawn at zero. Prefill and decode are not separated for these runs, so the phase picker does not apply.</p>}
              </HowTo>
              </>)}
            </Card>
            <Card>
              <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-2">Insights{customPricing && <Badge>Custom pricing</Badge>}</h3>
              {/* Findings are scoped to the current selection. */}
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 list-disc list-inside">
                {ins.findings.map((t, i) => <li key={i}><MD t={t} /></li>)}
              </ul>
              {ins.basis.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-teal-700 dark:text-teal-300">Basis &amp; caveats ({ins.basis.length})</summary>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 list-disc list-inside">
                    {ins.basis.map((t, i) => <li key={i}><MD t={t} /></li>)}
                  </ul>
                </details>
              )}
            </Card>
          </div>

          {/* Accuracy check */}
          <Card>
            <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-1">Accuracy by hardware: safety check</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Quality is a property of the model, so it barely moves across hardware. Fixed 0–100% scale{accCI ? `. The whisker is the 95% sampling interval (n=${accs[0].nq}).` : '.'}</p>
            {accs.length ? <div {...tipHandlers()}>{accs.map((x) => (
              // Use the shared tooltip for run metadata.
              <div key={x.name} className="grid items-center gap-3 my-2 cursor-help"
                data-tip={`<b>${x.name}</b><br>Accuracy: ${(x.acc * 100).toFixed(1)}%${x.ci ? ` (95% CI ${(x.ci.lo * 100).toFixed(1)}–${(x.ci.hi * 100).toFixed(1)}, n=${x.nq})` : ''}${x.meta.length ? `<div style='margin-top:5px;opacity:0.7;font-size:11px'>${x.meta.join('<br>')}</div>` : ''}`}
                style={{ gridTemplateColumns: '138px 1fr 52px' }}>
                <div className="text-right text-sm font-semibold whitespace-nowrap">{x.name}</div>
                <div className="relative h-4 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                  <div className="absolute top-0 h-full" style={{ width: x.acc * 100 + '%', background: x.col }} />
                  {/* 95% confidence interval */}
                  {x.ci && <>
                    <div className="absolute top-1/2 -translate-y-1/2 h-[1.5px] bg-slate-600 dark:bg-slate-200 opacity-75" style={{ left: x.ci.lo * 100 + '%', width: (x.ci.hi - x.ci.lo) * 100 + '%' }} />
                    <div className="absolute top-[3px] bottom-[3px] w-[1.5px] bg-slate-600 dark:bg-slate-200 opacity-75" style={{ left: x.ci.lo * 100 + '%' }} />
                    <div className="absolute top-[3px] bottom-[3px] w-[1.5px] bg-slate-600 dark:bg-slate-200 opacity-75" style={{ left: `calc(${x.ci.hi * 100}% - 1.5px)` }} />
                  </>}
                </div>
                <div className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">{(x.acc * 100).toFixed(1)}%</div>
              </div>
            ))}</div> : <p className="text-sm text-slate-500 dark:text-slate-400">No accuracy recorded.</p>}
            {accCI && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {/* Compare the spread with twice the median interval half-width. */}
                {accWithinNoise
                  ? <>Spread here (<b>{(accSpread * 100).toFixed(1)} pts</b>) is within what the 95% sampling intervals allow (±{(accHalf * 100).toFixed(1)} pts per run, so up to {(2 * accHalf * 100).toFixed(1)} pts between two runs, n={accs[0].nq}): hardware does not distinguishably change accuracy.</>
                  : <>Spread here (<b>{(accSpread * 100).toFixed(1)} pts</b>) exceeds what the 95% sampling intervals allow (±{(accHalf * 100).toFixed(1)} pts per run, {(2 * accHalf * 100).toFixed(1)} pts between two runs): at least one run differs by more than sampling noise explains.</>}
              </p>
            )}
            {isAgentic && accs.length >= 2 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">No sampling interval is reported for agentic: runs branch on workflow and tool results, so accuracy spread is due to trajectory variance, not hardware quality difference.</p>
            )}
            {accs.length > 0 && !accCI && <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">range {(accMn * 100).toFixed(1)}–{(accMx * 100).toFixed(1)}% (spread {((accMx - accMn) * 100).toFixed(1)} pts)</div>}
          </Card>

          {/* Full results table */}
          <Card>
            <details>
              <summary className="cursor-pointer text-slate-800 dark:text-slate-200 font-semibold marker:text-teal-700 dark:marker:text-teal-300">
                Results: full drill-down
                <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">every metric for the {tableRows.length} hardware {tableRows.length === 1 ? 'config' : 'configs'} in this selection</span>
                {customPricing && <Badge>Custom pricing (buy columns)</Badge>}
              </summary>
              <div className="overflow-x-auto mt-3" {...tipHandlers()}>
                <table className="w-full text-sm text-right [&_td]:py-2 [&_td]:px-2 [&_th]:py-2 [&_th]:px-2 [&_td]:border-b [&_td]:border-slate-200">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wide">
                      {groupedCols.map(([g, cs], gi) => <th key={gi} colSpan={cs.length} className={'text-center font-bold' + (gi > 0 ? sepCls : '')}>{g}</th>)}
                    </tr>
                    <tr className="text-teal-700 dark:text-teal-300 text-xs uppercase">{cols.map((c) => <th key={c.k} className={(c.k === 'name' ? 'text-left' : '') + (c.sep ? sepCls : '')}>{c.l}</th>)}</tr>
                  </thead>
                  <tbody>{tableRows.map((r) => <tr key={r.d.gpu}>{cols.map((c) => cell(r.d, c, r.key, r.fl, r.scaling))}</tr>)}</tbody>
                </table>
              </div>
            </details>
          </Card>

        </div>
      )}

      {tab === 'analysis' && (() => {
        const { figs, turns, variation } = data;
        // Clamp per-turn controls to available data.
        const tModels = Object.keys(turns);
        const tModel = turns[an.tModel] ? an.tModel : (turns['gpt-oss-120b'] ? 'gpt-oss-120b' : tModels[0]);
        // Prefer workloads with data while keeping empty choices visible.
        const tWorkPts = (w) => Object.values((turns[tModel] || {})[w] || {}).reduce((n, fwd) => n + Object.values(fwd || {}).reduce((m, a) => m + (a || []).length, 0), 0);
        const tWorkOrdered = Object.keys(turns[tModel] || {}).sort((a, b) => tWorkPts(b) - tWorkPts(a));
        const tWork = (turns[tModel] || {})[an.tWork] ? an.tWork : (tWorkOrdered[0] || Object.keys(turns[tModel] || {})[0]);
        const tFw = ((turns[tModel] || {})[tWork] || {})[an.tFw] ? an.tFw : Object.keys((turns[tModel] || {})[tWork] || {})[0];
        const tData = ((turns[tModel] || {})[tWork] || {})[tFw] || {};
        const tEmpty = !Object.values(tData).some((a) => a && a.length);
        const tMetricEmpty = !Object.values(tData).some((a) => (a || []).some((p) =>
          Number.isFinite(p[an.tMetric]) && (an.tMetric === 'tools' ? p[an.tMetric] >= 0 : p[an.tMetric] > 0)));
        const tFinding = turnTakeaway(tData, an.tMetric);
        // Compute the suite-wide decode trend independently of the current selection.
        const tpsDeltas = Object.values(turns).flatMap((w) => Object.values(w).flatMap((fw) => Object.values(fw).flatMap((gp) => Object.values(gp).flatMap((pts) => {
          const s = (pts || []).filter((q) => q.tps > 0 && q.n >= 20).sort((a, b) => a.t - b.t);
          return s.length >= 2 && s[0].t !== s[s.length - 1].t ? [(s[s.length - 1].tps - s[0].tps) / s[0].tps * 100] : [];
        }))));
        const tpsWorst = tpsDeltas.length ? Math.min(...tpsDeltas) : 0;
        const tInsight = an.tMetric === 'tps' && tpsDeltas.length >= 10 && median(tpsDeltas) <= 0 && tpsWorst < -10
          ? ` Even as context grows to tens of thousands of tokens, the median config loses only ${Math.round(-median(tpsDeltas))}% decode speed between first and last turn, but the worst loses ${Math.round(-tpsWorst)}%: whether an agent slows down over a task depends on the stack serving it.`
          : '';
        const tShape = (((figs.agentic_shape || {})[tModel] || {})[tWork] || {})[tFw];
        // Available per-turn models, workloads and accelerators.
        const f3models = [...new Set(figs.fig3.pts.map((p) => p.model))];
        const f3model = f3models.includes(an.f3model) ? an.f3model : (f3models.includes('gpt-oss-120b') ? 'gpt-oss-120b' : f3models[0]);
        const f3pts = figs.fig3.pts.filter((p) => p.model === f3model);
        const f3works = [...new Set(f3pts.map((p) => p.ds))];
        const f3gpus = [...new Set(f3pts.map((p) => p.gpu))];
        const f3work = (an.f3work === 'all' || f3works.includes(an.f3work)) ? an.f3work : 'all';
        const f3gpu = (an.f3gpu === 'all' || f3gpus.includes(an.f3gpu)) ? an.f3gpu : 'all';
        // Workload and hardware are clamped independently, so a valid pair can still have no point.
        const f3shown = f3pts.filter((p) => (f3work === 'all' || p.ds === f3work)
          && (f3gpu === 'all' || p.gpu === f3gpu) && p.x > 0 && p.y >= 0);
        const f3empty = !f3shown.length;
        // Show resource guidance only when workload medians separate clearly.
        const f3med = (ds, k) => { const v = figs.fig3.pts.filter((q) => q.ds === ds).map((q) => q[k]).filter((x) => x > 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
        const f3Insight = f3med('IMO', 'x') > 5 * f3med('IMO', 'y') && f3med('SWE', 'y') > 0.4 * f3med('SWE', 'x')
          ? ' Which upgrade shortens tasks depends on the workload: the maths agent waits almost entirely on the model, while the coding agent spends nearly as much time in its tools, and only the measured split can tell the two cases apart.'
          : '';
        // R1 and V3.2 share one architecture band.
        const f2model = an.f2model === 'deepseek-v3.2' ? 'deepseek-r1' : an.f2model;
        const rooflineModels = db.modelOrder.filter((mid) => mid !== 'deepseek-v3.2');
        const f2Label = (mid) => (mid === 'deepseek-r1' ? 'DeepSeek-R1/V3.2 671B' : db.modelMeta[mid].name);
        const mg = f2model === 'all' ? null : M.modelGpuNames(db, f2model);
        const gpuOpts = [{ value: 'all', label: 'All' }, ...M.GPUS.map((g) => ({ value: g, label: g }))];
        const f2Bands = figs.fig2.bands.filter((b) => f2model === 'all' || b.model === f2model);
        const f2Hw = figs.fig2.hw.filter((h) => an.f2gpu === 'all' || h.name.replace(' x8', '') === an.f2gpu);
        const f2Finding = (() => {
          if (!f2Bands.length || !f2Hw.length) return 'No specification data covers this selection.';
          const lo = Math.min(...f2Bands.map((b) => b.lo)), hi = Math.max(...f2Bands.map((b) => b.hi));
          const hwLo = Math.min(...f2Hw.map((h) => h.y)), hwHi = Math.max(...f2Hw.map((h) => h.y));
          const range = (a, b) => a === b ? a.toLocaleString() : `${a.toLocaleString()}–${b.toLocaleString()}`;
          const band = f2Bands.length === 1
            ? `${f2Label(f2model)} requires`
            : `${f2Bands.length} model bands require`;
          const hardware = an.f2gpu === 'all'
            ? `${f2Hw.length} shown hardware configurations span`
            : f2Hw.length === 1
              ? `the shown ${an.f2gpu} configuration is rated at`
              : `${f2Hw.length} shown ${an.f2gpu} node sizes span`;
          // Derive the suite-wide batching range from all model bands.
          const spans = figs.fig2.bands.map((b) => b.hi / b.lo).filter((r) => Number.isFinite(r) && r > 0);
          const wide = spans.filter((r) => r >= 1.5);
          const flat = spans.some((r) => r < 1.05);
          const insight = wide.length >= 2 ? ` Required bandwidth changes by ${Math.round(Math.min(...wide))}–${Math.round(Math.max(...wide))}× between single query and full batch for the MoE models${flat ? ". The dense-model band does not change" : ''}. The next two cards show expert activation and measured bandwidth use.` : '';
          return `${band} ${range(lo, hi)} GB/s at 50 token/s. ${hardware} ${range(hwLo, hwHi)} GB/s.${insight}`;
        })();
        return (
          <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
            <div><h1 className="text-2xl font-bold mb-1">Insights</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Most of these analyses come from measured runs (or are labelled as spec-sheet-based otherwise). Each takeaway updates as you change the controls.</p></div>

            {/* Cross-model comparison */}
            {(() => {
              const cmCandidates = M.FAMILIES.flatMap((f) => f.members).filter((m) => m.mode === 'moe');
              const cmWorks = cmCandidates.filter((m) => Object.keys(M.FWLABEL).some((fw) =>
                M.crossModelPoints(db, { ds: m.ds, fw, cost: an.cmCost, buyFactor: customPricing ? bf : null }).length >= 2));
              const cmWork = cmWorks.some((m) => m.ds === an.cmWork) ? an.cmWork : cmWorks[0]?.ds;
              const cmFws = Object.keys(M.FWLABEL).filter((fw) => M.crossModelPoints(db,
                { ds: cmWork, fw, cost: an.cmCost, buyFactor: customPricing ? bf : null }).length >= 2);
              const cmFw = cmFws.includes(an.cmFw) ? an.cmFw : cmFws[0];
              const cmPts = cmFw ? M.crossModelPoints(db, { ds: cmWork, fw: cmFw, cost: an.cmCost, buyFactor: customPricing ? bf : null }) : [];
              // Guard model comparisons with the widest within-model hardware spread.
              const cmKey = an.cmCost === 'buy' ? 'buy' : 'rent';
              const cmHwSpread = cmPts.length ? Math.max(...cmPts.map((p) => {
                const hwm = ((((db.models[p.mid] || {}).batches || {})['batch-size-default'] || {})[cmWork] || {}).fw?.[cmFw]?.hw || {};
                const vs = Object.values(hwm).map((r) => r[cmKey]).filter((v) => v > 0);
                return vs.length > 1 ? Math.max(...vs) / Math.min(...vs) : 1;
              })) : null;
              // Use decode cost per token so model verbosity does not change the hardware comparison.
              const xm = an.cmCost === 'buy'
                ? { label: 'Decode output-token cost (buy)', unit: '$ / 1M tokens', fmt: (v) => `$${v.toFixed(2)}` }
                : { label: 'Decode output-token cost (rent)', unit: '$ / 1M tokens', fmt: (v) => `$${v.toFixed(2)}` };
              const cmGpus = [...new Set(cmPts.map((p) => p.gpu))];
              return (
                <Card>
                  <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-1">Model cost versus quality — {cmWorks.find((m) => m.ds === cmWork)?.sub || cmWork || 'no selection'}{bf && an.cmCost === 'buy' && <Badge ghost={!customPricing}>Custom pricing</Badge>}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Each point is a model on its cheapest measured accelerator for the selected engine at concurrent batch. Cost is per decode output token, so a model that writes longer answers is not judged on its verbosity. Whiskers are 95% sampling intervals.
                  </p>
                  <div className="flex flex-wrap gap-5 justify-center mb-3">
                    <CtlRow label="Workload"><Chips options={cmWorks.map((m) => ({ value: m.ds, label: m.sub }))} value={cmWork} onChange={(v) => setAn({ ...an, cmWork: v })} /></CtlRow>
                    <CtlRow label="Inference engine"><Chips options={cmFws.map((f) => ({ value: f, label: M.FWLABEL[f] }))} value={cmFw} onChange={(v) => setAn({ ...an, cmFw: v })} /></CtlRow>
                    <CtlRow label="Cost"><Chips options={[{ value: 'rent', label: 'Rent ($/1M, decode)' }, { value: 'buy', label: 'Buy ($/1M, decode)' }]} value={an.cmCost} onChange={(v) => setAn({ ...an, cmCost: v })} /></CtlRow>
                    {/* Expose controls wherever custom buy values appear. */}
                    {bf && an.cmCost === 'buy' && <PricingCtl params={bp} defaults={buyDef} tier={s.tier} custom={customPricing} onChange={setBp} onReset={resetBp} />}
                  </div>
                  {cmPts.length >= 2 ? <Chart html={crossModelSVG(cmPts, xm)} /> : <Pending>Fewer than two models cover this workload, engine, and cost basis.</Pending>}
                  {/* Colour identifies hardware. Point labels identify models. */}
                  <div className="flex flex-wrap gap-3 justify-center mt-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Colour = accelerator:</span>
                    {cmGpus.map((g) => <span key={g}><i className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ background: GCOL[g] }} />{M.GNM[g]}</span>)}
                  </div>
                  <Takeaway><MD t={cmTakeaway(cmPts, xm.fmt, cmHwSpread)} /></Takeaway>
                </Card>
              );
            })()}

            {/* Per-turn analysis */}
            <Card className="scroll-mt-24" id="per-turn">
              <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-1">{M.metricT(an.tMetric)} across workflow turns ({M.amLabel(tModel, db)})</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Median value of the selected metric at each turn for the selected model, workload, and engine. The takeaway compares each accelerator&apos;s first and last turn and needs at least 20 examples at each.</p>
              <div className="flex flex-wrap gap-5 justify-center mb-3">
                <CtlRow label="Model"><Chips options={tModels.map((m) => ({ value: m, label: M.amLabel(m, db) }))} value={tModel} onChange={(v) => setAn({ ...an, tModel: v })} /></CtlRow>
                <CtlRow label="Workload"><Chips options={tWorkOrdered.map((w) => ({ value: w, label: M.TW[w] || w }))} value={tWork} onChange={(v) => setAn({ ...an, tWork: v })} /></CtlRow>
                <CtlRow label="Inference engine"><Chips options={Object.keys((turns[tModel] || {})[tWork] || {}).map((f) => ({ value: f, label: M.FWLABEL[f] || f }))} value={tFw} onChange={(v) => setAn({ ...an, tFw: v })} /></CtlRow>
                <CtlRow label="Metric"><Sel value={an.tMetric} onChange={(e) => setAn({ ...an, tMetric: e.target.value })}>{M.TURN_METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Sel></CtlRow>
              </div>
              {tShape && tShape.peak ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center items-baseline mb-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="uppercase tracking-wide text-teal-600 dark:text-teal-400 font-semibold">Typical task</span>
                  <span><b className="text-slate-700 dark:text-slate-300">{tShape.turns}</b> turns</span>
                  {tShape.tools != null ? <span><b className="text-slate-700 dark:text-slate-300">{tShape.tools}</b> tool calls</span> : null}
                  <span>context grows to <b className="text-slate-700 dark:text-slate-300">~{tShape.peak >= 10000 ? Math.round(tShape.peak / 1000) : (tShape.peak / 1000).toFixed(1)}k</b> tokens</span>
                  {tShape.lat_p50 != null && tShape.lat_p99 != null ? (
                    <span>latency median <b className="text-slate-700 dark:text-slate-300">{dur(tShape.lat_p50)}</b> · p99 <b className="text-slate-700 dark:text-slate-300">{dur(tShape.lat_p99)}</b> (<b className="text-slate-700 dark:text-slate-300">{Math.round(tShape.lat_p99 / tShape.lat_p50)}×</b> tail)</span>
                  ) : null}
                </div>
              ) : null}
              {tEmpty || tMetricEmpty ? (
                <Pending>No {an.tMetric === 'tools' ? 'measured tool-call' : `positive ${M.metricT(an.tMetric).toLowerCase()}`} values for {M.TW[tWork] || tWork} on {M.amLabel(tModel, db)} with {M.FWLABEL[tFw] || tFw}.</Pending>
              ) : (<>
                <Chart html={turnplotSVG(turns, tModel, tWork, tFw, an.tMetric, (((figs.turn_meta || {})[tModel] || {})[tWork] || {})[tFw])} />
                <div className="flex flex-wrap gap-3 justify-center mt-2 text-xs">
                  {Object.keys(tData).map((g) => <span key={g}><i className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ background: GCOL[g] }} />{M.GNM[g]}</span>)}
                  <span className="text-slate-500 dark:text-slate-400">{M.amLabel(tModel, db)} · {M.TW[tWork] || tWork} · {M.FWLABEL[tFw] || tFw}</span>
                </div>
              </>)}
              <Takeaway>{tFinding}{tInsight}</Takeaway>
            </Card>

            {/* Roofline */}
            <Card>
              <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-1">Bandwidth required for 50 token/s decode<Badge>Spec-sheet, not measured</Badge></h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Model bands are estimated bandwidth requirements from batch size 1 to maximum batch size. Hardware points are manufacturers' board-power and bandwidth ratings and do not necessarily reflect achieved throughput.</p>
              <div className="flex flex-wrap gap-5 justify-center mb-3">
                <CtlRow label="Model"><Chips options={[{ value: 'all', label: 'All' }, ...rooflineModels.map((mid) => ({ value: mid, label: f2Label(mid) }))]} value={f2model} onChange={(v) => setAn({ ...an, f2model: v })} /></CtlRow>
                <CtlRow label="Hardware"><Chips options={gpuOpts} value={an.f2gpu} onChange={(v) => setAn({ ...an, f2gpu: v })} /></CtlRow>
              </div>
              <Chart html={fig2SVG(figs, f2model, an.f2gpu, mg)} onPick={(kind, val) => setAn({ ...an, ...(kind === 'f2model' ? { f2model: val } : { f2gpu: val }) })} />
              <Takeaway>{f2Finding}</Takeaway>
            </Card>

            {/* Measured bandwidth use for the selected model and batch */}
            {(() => {
              const bwBatches = ['batch-size-default', 'batch-size-1'];
              const bwModels = db.modelOrder.filter((mid) => bwBatches.some((batch) =>
                M.bandwidthUse(db, { model: mid, batch }).length));
              if (!bwModels.length) return null;
              const bwModel = bwModels.includes(an.bwModel) ? an.bwModel : bwModels[0];
              // Keep flagged measurements visible, dimmed and annotated.
              const rows = M.bandwidthUse(db, { model: bwModel, batch: an.bwBatch, flags });
              const best = rows[0];
              const lowest = rows[rows.length - 1];
              // Pool both batch regimes for the suite-wide batching insight.
              const mbuPool = (bk) => Object.values(db.models).flatMap((m) => Object.values(((m.batches || {})[bk]) || {}).flatMap((cell) => Object.values(cell.fw || {}).flatMap((f) => Object.values(f.hw || {}).map((r) => r.mbu_d).filter((v) => v != null))));
              const mbu1 = mbuPool('batch-size-1'), mbuD = mbuPool('batch-size-default');
              const mbuInsight = mbu1.length > 2 && mbuD.length > 2 && median(mbuD) > median(mbu1)
                ? ` Median bandwidth use is ${Math.round(median(mbu1))}% for single-query runs and ${Math.round(median(mbuD))}% for concurrent runs. The median concurrent configuration uses ${Math.round(median(mbuD))}% of rated bandwidth.`
                : '';
              return (
                <Card>
                  <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-1">Measured bandwidth use — {db.modelMeta[bwModel].name} · {an.bwBatch === 'batch-size-1' ? 'single query' : 'concurrent'}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Median measured decode bandwidth as a share of datasheet peak, pooled across this model's single-turn workloads and engines. Whiskers show the observed range. Sparse MoE runs require their own expert-activation trace, which we capture. Dense-model bandwidth use comes from architecture and timing.
                  </p>
                  <div className="flex flex-wrap gap-5 justify-center mb-3">
                    <CtlRow label="Model"><Chips options={bwModels.map((mid) => ({ value: mid, label: db.modelMeta[mid].name }))} value={bwModel} onChange={(v) => setAn({ ...an, bwModel: v })} /></CtlRow>
                    <CtlRow label="Batch regime"><Chips options={[{ value: 'batch-size-default', label: 'Concurrent' }, { value: 'batch-size-1', label: 'Single query' }]} value={an.bwBatch} onChange={(v) => setAn({ ...an, bwBatch: v })} /></CtlRow>
                  </div>
                  {rows.length ? <Chart html={bandwidthSVG(rows)} /> : <Pending>No measured bandwidth-use rows for this model and batch regime.</Pending>}
                  <Takeaway>{(best ? `${rows.length} accelerators range from ${lowest.pct.toFixed(0)}% to ${best.pct.toFixed(0)}% median use of rated bandwidth. ${best.name} is highest in this selection.` : 'No positive measured bandwidth-use value covers this selection.') + mbuInsight}</Takeaway>
                </Card>
              );
            })()}

            {/* Expert activation */}
            {figs.expert && figs.expert.length ? (() => {
              const decode = figs.expert.filter((m) => m && m.decode && m.n_experts && m.decode.b1 > 0 && m.decode.conc > 0)
                .map((m) => ({ b1: m.decode.b1 / m.n_experts * 100, conc: m.decode.conc / m.n_experts * 100 }));
              return (
                <Card>
                  <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-1">Expert activation by inference phase</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Median experts activated per step as a share of each model's total, pooled across workloads and hardware. Hollow points are batch=1. Filled points are concurrent.</p>
                  <Chart html={expertSVG(figs.expert)} />
                  <Takeaway>{decode.length ? `Across ${decode.length} models, batch-1 decode activates ${Math.min(...decode.map((x) => x.b1)).toFixed(0)}–${Math.max(...decode.map((x) => x.b1)).toFixed(0)}% of experts. Concurrent decode activates ${Math.min(...decode.map((x) => x.conc)).toFixed(0)}–${Math.max(...decode.map((x) => x.conc)).toFixed(0)}%.${decode.every((x) => x.conc > x.b1) ? " Sparse MoE's bandwidth saving is therefore largest for single-user serving and fades as the batch grows." : ''}` : 'No positive decode activation values are published.'}</Takeaway>
                </Card>
              );
            })() : null}

            {/* Agentic time split */}
            <Card>
              <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-1">Model time versus tool time ({M.amLabel(f3model, db)})</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Each point is a published per-turn median. Above the diagonal tool/CPU time is longer. Below it model/GPU time is longer. Most points combine both engines&apos; runs, some only one.</p>
              <div className="flex flex-wrap gap-5 justify-center mb-3">
                <CtlRow label="Model"><Chips options={f3models.map((m) => ({ value: m, label: M.amLabel(m, db) }))} value={f3model} onChange={(v) => setAn({ ...an, f3model: v })} /></CtlRow>
                <CtlRow label="Workload"><Chips options={[{ value: 'all', label: 'All' }, ...f3works.map((w) => ({ value: w, label: w }))]} value={f3work} onChange={(v) => setAn({ ...an, f3work: v })} /></CtlRow>
                <CtlRow label="Hardware"><Chips options={[{ value: 'all', label: 'All' }, ...f3gpus.map((g) => ({ value: g, label: g }))]} value={f3gpu} onChange={(v) => setAn({ ...an, f3gpu: v })} /></CtlRow>
              </div>
              {f3empty ? (
                <Pending>No published agent-time point covers this workload and hardware combination. Try "All" or another selection.</Pending>
              ) : <Chart html={fig3SVG(figs, f3model, f3work, f3gpu)} onPick={(kind, val) => setAn({ ...an, f3work: val })} />}
              <Takeaway>{f3shown.length ? `${f3shown.filter((p) => p.y > p.x).length} of ${f3shown.length} positive published points in this selection spend longer in tools/CPU than in the model/GPU.` : 'No positive published point covers this selection.'}{f3Insight}</Takeaway>
            </Card>

            {/* Fixed-length and natural workloads */}
            {(() => {
              const f4all = data.figs.fig4 || [];
              const f4models = [...new Set(f4all.map((g) => g.model))];
              const f4model = f4models.includes(an.f4model) ? an.f4model : f4models[0];
              const f4fws = [...new Set(f4all.filter((g) => g.model === f4model).map((g) => g.fw))];
              const f4fw = f4fws.includes(an.f4fw) ? an.f4fw : f4fws[0];
              // Average each model and engine across available hardware configurations.
              const f4gpus = [...new Set(f4all.filter((g) => g.model === f4model && g.fw === f4fw).map((g) => g.gpu))]
                .sort((a, b) => M.GPUS.indexOf(M.gpuCfg(a).name) - M.GPUS.indexOf(M.gpuCfg(b).name) || M.gpuCfg(a).n - M.gpuCfg(b).n);
              const f4gpu = f4gpus.includes(an.f4gpu) ? an.f4gpu : f4gpus[0];
              const f4groups = f4all.filter((g) => g.model === f4model && g.fw === f4fw && g.gpu === f4gpu);
              const f4metric = ['tps', 'tps_p', 'ttft'].includes(an.f4metric) ? an.f4metric : 'tps';
              const f4metricLabel = { tps: 'decode token/s', tps_p: 'prefill token/s', ttft: 'TTFT' }[f4metric];
              // Exclude prefill values without a valid basis label.
              const f4v = (v) => f4metric === 'tps_p' ? (prefillRate(v)?.value ?? null) : v[f4metric];
              const f4ratios = f4groups.flatMap((g) => {
                const nat = g.variants.find((v) => v.label === 'natural');
                if (!nat || !(f4v(nat) > 0)) return [];
                return g.variants.filter((v) => v.label !== 'natural' && f4v(v) > 0)
                  .map((v) => f4v(v) / f4v(nat));
              });
              const f4take = f4ratios.length
                ? `Across ${f4ratios.length} workload${f4ratios.length === 1 ? '' : 's'} in this selection, the median fixed-length ${f4metricLabel} is ${pctChange((median(f4ratios) - 1) * 100)} relative to natural-length ${f4metricLabel}.`
                : `No positive fixed-and-natural pair for ${f4metricLabel} covers this selection.`;
              // Use the pooled ratio range to show variation across the suite.
              const f4suite = f4all.flatMap((g) => { const nat = (g.variants || []).find((v) => v.label === 'natural'); if (!nat || !(nat.tps > 0)) return []; return g.variants.filter((v) => v.label !== 'natural' && v.tps > 0).map((v) => v.tps / nat.tps); });
              const f4insight = f4suite.length >= 5 && Math.max(...f4suite) / Math.min(...f4suite) > 2
                ? ` Across all paired runs, fixed-length decode rate is ${Math.min(...f4suite).toFixed(1)}–${Math.max(...f4suite).toFixed(1)}× the natural-length rate. The spread rules out using one correction factor.`
                : '';
              return (
                <Card className="scroll-mt-24" id="fixed-vs-natural">
                  <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-1">Fixed versus natural lengths — {f4metricLabel} ({M.amLabel(f4model, db)} · {f4gpu ? M.gpuCfg(f4gpu).label : '—'})</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Forced input/output lengths compared with each dataset's natural lengths on the same model, engine, and hardware.</p>
                  {f4all.length ? (<>
                    <div className="flex flex-wrap gap-5 justify-center mb-3">
                      <CtlRow label="Model"><Chips options={f4models.map((m) => ({ value: m, label: M.amLabel(m, db) }))} value={f4model} onChange={(v) => setAn({ ...an, f4model: v })} /></CtlRow>
                      <CtlRow label="Inference engine"><Chips options={f4fws.map((f) => ({ value: f, label: M.FWLABEL[f] || f }))} value={f4fw} onChange={(v) => setAn({ ...an, f4fw: v })} /></CtlRow>
                      <CtlRow label="Hardware"><Chips options={f4gpus.map((g) => ({ value: g, label: M.gpuCfg(g).label }))} value={f4gpu} onChange={(v) => setAn({ ...an, f4gpu: v })} /></CtlRow>
                      <CtlRow label="Metric"><Sel value={f4metric} onChange={(e) => setAn({ ...an, f4metric: e.target.value })}>
                        <option value="tps">Decode token/s</option><option value="tps_p">Prefill token/s</option><option value="ttft">TTFT (ms)</option></Sel></CtlRow>
                    </div>
                    {f4ratios.length ? <Chart html={fig4SVG(f4groups, f4metric)} /> : <Pending>No positive fixed-and-natural pair for this metric and selection.</Pending>}
                    <Takeaway>{f4take}{f4insight}</Takeaway>
                  </>) : <Pending>Run pending. No fixed-length runs in the results repo yet.</Pending>}
                </Card>
              );
            })()}

            {/* Measurement variation */}
            {variation?.schema_version === 3 ? <ControlledVariationCard variation={variation} analysis={an} onAnalysis={setAn} /> : <Card className="scroll-mt-24" id="variation">
              <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-1">Spread between repeated measurements</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Only configurations measured more than once enter this study. Each point shows that configuration's median pairwise disagreement in the selected timing metric and in accuracy. It does not estimate uncertainty for unreplicated dashboard cells.</p>
              {!variation ? (
                <Pending>Not yet published. The study is emitted by the data sync. This card fills in on the next one.</Pending>
              ) : (() => {
                // Clamp controls to values present in the study.
                const { trees, metrics } = vAxes(variation);
                const vTree = trees.includes(an.vTree) ? an.vTree : trees[0];
                const mOpts = metrics[vTree] || [];
                const vMetric = mOpts.includes(an.vMetric) ? an.vMetric : mOpts[0];
                const aOpts = [['version', 'Engine build'], ['replication', 'Nothing (re-run)']]
                  .filter(([a]) => ((variation.points || []).some((p) => p.arm === a && p.coordinate[0] === vTree)));
                const vArm = aOpts.some(([a]) => a === an.vArm) ? an.vArm : (aOpts[0] || [])[0];
                if (!vTree || !vMetric || !vArm) return (
                  <Pending>The published study carries no configuration measured more than once.</Pending>);
                const onMetric = (variation.points || []).filter((p) => p.coordinate[0] === vTree
                  && p.typical && p.typical[vMetric] !== undefined);
                const shown = onMetric.filter((p) => p.arm === vArm
                  && p.typical_points && p.typical_points.acc !== undefined);
                const n = shown.length;
                const spread = n ? median(shown.map((p) => p.typical[vMetric])) : null;
                const armStats = aOpts.map(([arm, label]) => {
                  const rows = onMetric.filter((p) => p.arm === arm
                    && p.typical_points && p.typical_points.acc !== undefined);
                  return { arm, label, n: rows.length,
                    spread: rows.length ? median(rows.map((p) => p.typical[vMetric])) : null };
                });
                const build = armStats.find((x) => x.arm === 'version');
                const rerun = armStats.find((x) => x.arm === 'replication');
                const ratio = (d) => d >= 2 ? 'unbounded' : `${varRatio(d).toFixed(2)}×`;
                const vFinding = build?.spread != null && rerun?.spread != null
                  ? `On ${(VTREE_LABEL[vTree] || vTree).toLowerCase()} workloads, repeated measurements of ${VMETRIC_LABEL[vMetric] || vMetric} typically disagree by ${ratio(build.spread)} when the engine build changed (${build.n} configurations) and by ${ratio(rerun.spread)} on plain re-runs (${rerun.n} configurations). The two groups contain different configurations, so this is a description, not a controlled comparison.`
                  : spread == null
                    ? 'No repeated configuration carries both timing and accuracy spread for this selection.'
                    : `For these ${n} configurations, repeated measurements of ${VMETRIC_LABEL[vMetric] || vMetric} typically disagree by ${ratio(spread)}.`;
                return (<>
                  <div className="flex flex-wrap gap-5 justify-center mb-3">
                    {trees.length > 1 && (
                      <CtlRow label="Workload"><Chips options={trees.map((v) => ({ value: v, label: VTREE_LABEL[v] || v }))}
                        value={vTree} onChange={(v) => setAn({ ...an, vTree: v })} /></CtlRow>)}
                    {aOpts.length > 1 && (
                      <CtlRow label="What varied"><Chips options={aOpts.map(([value, label]) => ({ value, label }))}
                        value={vArm} onChange={(v) => setAn({ ...an, vArm: v })} /></CtlRow>)}
                    {mOpts.length > 1 && (
                      <CtlRow label="Performance metric"><Sel value={vMetric} onChange={(e) => setAn({ ...an, vMetric: e.target.value })}>
                        {mOpts.map((k) => <option key={k} value={k}>{cap(VMETRIC_LABEL[k] || k)}</option>)}</Sel></CtlRow>)}
                  </div>
                  {n ? <Chart html={variationSVG(variation.points, vMetric, vArm, variation.dual_arm_coordinates, vTree, variation.better_when_lower)} /> : (
                    <Pending>No configuration carries both axes for this selection.</Pending>)}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    {n} repeated configuration{n === 1 ? '' : 's'} carrying both timing and accuracy spread.
                    {trees.length === 1 && <> Scope: {VTREE_LABEL[vTree] || vTree} only.</>}
                  </p>
                  <Takeaway>{vFinding}</Takeaway>
                </>);
              })()}
            </Card>}
          </div>
        );
      })()}
      <Footer />
    </div>
  );
}
