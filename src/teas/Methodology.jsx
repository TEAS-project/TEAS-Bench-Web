import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Nav } from './Nav.jsx';
import { Footer } from './Footer.jsx';
import { timingProfiles } from './timeProfiles.js';

// Methods for interpreting hardware suitability rather than a single overall ranking.

const Card = ({ children, className = '' }) => (
  <div className={'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm dark:shadow-none ' + className}>{children}</div>
);
const H = ({ children, id }) => (
  <h3 id={id} className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 pl-2 border-l-4 border-blue-500 scroll-mt-24">{children}</h3>
);
// Top-level section divider.
const Band = ({ children }) => (
  <div className="flex items-center gap-3 pt-2">
    <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300 whitespace-nowrap">{children}</h2>
    <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
  </div>
);
const SubH = ({ children, id }) => (
  <p id={id} className={'text-sm text-slate-600 dark:text-slate-300 mb-2 font-semibold' + (id ? ' scroll-mt-24' : '')}>{children}</p>
);
const P = ({ children }) => <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">{children}</p>;
// Inline diagrams inherit the text colour and scroll within their container.
const Fig = ({ children }) => (
  <div className="overflow-x-auto my-2 text-slate-500 dark:text-slate-400">{children}</div>
);
const TH = ({ children, className = '' }) => <th className={'text-left text-xs uppercase text-teal-700 dark:text-teal-300 py-2 px-3 border-b border-slate-200 dark:border-slate-800 ' + className}>{children}</th>;
const TD = ({ children, className = '' }) => <td className={'py-2 px-3 border-b border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300 align-top ' + className}>{children}</td>;
const Eq = ({ children }) => <span className="font-mono text-xs">{children}</span>;
const Practice = ({ children }) => (
  <div className="border-l-2 border-teal-500 bg-teal-50/60 dark:bg-teal-500/10 text-slate-700 dark:text-slate-200 pl-3 pr-2 py-1.5 mt-1.5 rounded-r">{children}</div>
);
// Long field names break after underscores rather than mid-token.
const FieldName = ({ name }) => name.split('_').map((p, i, a) => (
  <span key={i}>{p}{i < a.length - 1 && <>_<wbr /></>}</span>
));

// Shared section definitions for the contents menu and page dividers.
const GROUPS = [
  ['What we measure', [
    ['workloads', 'Workloads & datasets'],
    ['catalogs', 'Model & hardware catalogues'],
    ['selection', 'Why these choices'],
    ['engines', 'Engines & batch regimes'],
  ]],
  ['How we measure it', [
    ['metrics', 'Metric definitions & sources'],
    ['cost', 'Unified cost model'],
    ['engine-versions', 'Engine version selection'],
  ]],
  ['How far to trust it', [
    ['quality', 'Data quality & run validity'],
    ['variation', 'Measurement variation'],
    ['limits', 'Limits & coverage'],
    ['lessons', 'Lessons from realistic workloads'],
    ['independence', 'Independence & industry involvement'],
  ]],
];
// Timing shares use validated profiles for the selected framework.
function shapeShare(snap, ds, key) {
  const v = [];
  for (const m of Object.values(snap?.models || {})) {
    const cell = m.batches?.['batch-size-default']?.[ds];
    if (!cell) continue;
    for (const block of Object.values(cell.fw || {})) {
      const decoded = timingProfiles(block, cell.kind);
      const p = cell.kind === 'agentic' ? decoded.task : decoded.request;
      if (p) v.push(p[key]);
    }
  }
  if (!v.length) return null;
  const lo = Math.min(...v), hi = Math.max(...v);
  return lo === hi ? `~${lo}%` : `~${lo}–${hi}%`;
}
// Add available timing shares to a qualitative label.
function shapeText(base, parts, tail) {
  const got = parts.filter(([v]) => v).map(([v, l]) => `${v} ${l}`);
  if (tail) got.push(tail);
  return got.length ? `${base} (${got.join(', ')})` : base;
}

function ControlledVariationMethods({ study }) {
  const summaries = study.summaries || {}, effects = summaries.build_effects || study.build_effects || [];
  const hardwares = new Set(effects.map((row) => row.hardware).filter(Boolean));
  const datasets = new Set(effects.map((row) => row.dataset).filter(Boolean));
  const leafCount = study.selection?.selected_leaves ?? study.selection?.accepted_count ?? study.selection?.count ?? study.leaves?.length;
  return (<>
    <P>Every configuration on the site is measured once, and engine builds are not uniform across the map (see Engine version selection), because replicating every run and searching over builds is infeasible at naturalistic workload lengths. Hence, we ran a controlled study to quantify the effects of repeating an identical run or switching engine build. One model and {datasets.size} workloads were run on {hardwares.size} hardware platforms, on paired old and new builds of both engines, with three matched run pairs per comparison, resulting in {Number.isFinite(leafCount) ? leafCount : 'the selected'} runs.</P>
    <P>For every metric this yields a repeatability spread and a build effect with an uncertainty interval, per hardware platform. The two spreads are the scale against which the benchmark&apos;s own single-run numbers should be read: a difference between two cells that is smaller than the run-to-run or build-to-build variation measured here is not evidence about the hardware.</P>
    <SubH>Effect estimation</SubH>
    <P>For each metric, the build effect is the average over the three matched pairs, expressed as a ratio of new over old for rates and latencies and as a plain difference for task scores, with an uncertainty interval from the three pairs. Repeatability is the spread of the three runs on the identical stack. Every effect belongs to one engine, one workload and one hardware platform. Nothing is averaged across them.</P>
    <SubH>Scope</SubH>
    <P>A contrast is a claim about the exact builds that were run, not about package versions in general. The intervals describe the observed effects and are not significance tests, and matched-prompt accuracy is unavailable because generations are not retained. No run from the study is published as an ordinary benchmark result. The <Link to="/insights#variation" className="text-blue-600 dark:text-blue-400 hover:underline">dashboard</Link> shows the results, and the complete record is in the <a href="/data/variation_study.json" className="text-blue-600 dark:text-blue-400 hover:underline">downloadable study file</a>.</P>
  </>);
}

export default function Methodology() {
  const location = useLocation();
  const [snap, setSnap] = useState(null);
  const [vs, setVs] = useState(null);   // variation_study.json — the measurement-variation study
  useEffect(() => { fetch('/data/db.json').then((r) => r.json()).then((db) => setSnap(db)).catch(() => {}); }, []);
  useEffect(() => { fetch('/data/variation_study.json').then((r) => r.json()).then(setVs).catch(() => {}); }, []);
  // React Router does not scroll cross-route hash links after the target page mounts.
  useEffect(() => {
    const h = location.hash.slice(1);
    if (!h) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(h);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [location.hash, location.key]);
  // Count canonical and alternate published measurements.
  const cells = snap && Object.values(snap.models).reduce((n, m) =>
    n + Object.values(m.batches || {}).reduce((a, bv) =>
      a + Object.values(bv).reduce((b, dv) =>
        b + Object.values(dv.fw || {}).reduce((c, fv) =>
          c + Object.keys(fv.hw || {}).length + (fv.alts || []).length, 0), 0), 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Nav />

      <div className="bg-gradient-to-b from-white dark:from-slate-800 to-slate-50 dark:to-slate-900 py-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-slate-100" style={{ lineHeight: 1.2 }}>Methods</h1>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            This page documents the design behind the live dashboard
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Contents by section */}
        <div className="mb-8 space-y-2">
          {GROUPS.map(([band, items]) => (
            <div key={band} className="flex flex-wrap items-center gap-2">
              <span className="w-full sm:w-auto sm:mr-1 text-[11px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">{band}</span>
              {items.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-teal-500 hover:text-teal-800 dark:hover:text-teal-300">{label}</a>
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <H id="different">Benchmark scope</H>
            <P>TEAS maps hardware to use cases rather than assigning one overall rank. The relevant comparison depends on cost, speed or efficiency, as well as model size and batch regime. Comparisons hold the model, workload and cost assumptions fixed.</P>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li><b>Accelerator coverage.</b> We validate every platform against the same checks and use one cost model. Current results cover NVIDIA and AMD datacentre GPUs, NVIDIA DGX Spark workstations, Tenstorrent Blackhole cards and Cerebras CS-3 systems.</li>
              <li><b>Natural-length workloads.</b> Benchmark runs use each dataset&apos;s natural context lengths. Fixed-length results appear only in the study that measures how much they differ. Agentic workloads include tool calls, and every dataset version is recorded.</li>
              <li><b>Whole-system timing.</b> Agentic tool calls run on the CPU. Each step splits into model compute and tool wait, so the full time budget accounts for both.</li>
              <li><b>CAP metrics.</b> We report cost, performance and accuracy for each configuration. Accuracy is a validity check. We reject faster runs if their answers degrade. It is not a hardware score.</li>
              <li><b>Open pipelines.</b> The NVIDIA pipeline is public and can be rerun from model launch through result generation.</li>
            </ul>
          </Card>

          <Band>What we measure</Band>

          <Card>
            <H id="workloads">Workloads &amp; datasets</H>
            <P>Here, <b>benchmark</b> means the code, data and procedures together. A <b>workload</b> is a use case represented by a versioned <b>dataset</b>. We group workloads as <b>Single-turn</b> or <b>Agentic</b> (multi-turn with tools) according to their serving pattern. The timing shares below are recalculated from each run and retain their provenance labels.</P>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><TH>Category</TH><TH>Workload</TH><TH>Dataset</TH><TH>Size</TH><TH>Serving shape (run timing)</TH></tr></thead>
                <tbody>
                  {[
                    ['Single-turn', 'Maths & reasoning', 'GSM8K', '256 examples', shapeText('decode-heavy', [[shapeShare(snap, 'gsm8k', 'decode'), 'decode time']])],
                    ['Single-turn', 'General assistant', 'Arena-Hard', '256 examples', shapeText('decode-heavy', [[shapeShare(snap, 'arena-hard', 'decode'), 'decode time']])],
                    // LongBench stays qualitative because this profile has no TTFT split.
                    ['Single-turn', 'Long-context QA', 'LongBench v1', '256 examples', 'prefill-heavy (most tokens are input)'],
                    ['Agentic', 'Coding agents', 'SWE-bench Lite', '~100 tasks', shapeText('mixed', [[shapeShare(snap, 'swe-bench-lite', 'decode'), 'decode'], [shapeShare(snap, 'swe-bench-lite', 'tool'), 'tool-wait']])],
                    ['Agentic', 'Tool/API agents', 'MCP-Atlas', '~60 tasks', shapeText('decode-led', [[shapeShare(snap, 'mcp-atlas', 'decode'), 'decode'], [shapeShare(snap, 'mcp-atlas', 'tool'), 'tool-wait']], '~1 tool call/turn')],
                    ['Agentic', 'Maths agents', 'IMO-AnswerBench', '100 tasks', shapeText('decode-bound', [[shapeShare(snap, 'imo-answerbench', 'decode'), 'decode'], [shapeShare(snap, 'imo-answerbench', 'tool'), 'tool-wait']])],
                  ].map((r) => (
                    <tr key={r[1]}>
                      <TD><span className={'text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ' + (r[0] === 'Single-turn' ? 'border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' : 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300')}>{r[0]}</span></TD>
                      <TD className="font-semibold text-slate-800 dark:text-slate-200">{r[1]}</TD><TD>{r[2]}</TD><TD className="text-xs whitespace-nowrap">{r[3]}</TD><TD>{r[4]}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <br></br>
            <P>The metrics that compare configurations are the same within each category:</P>
            <div className="overflow-x-auto mb-3">
              <table className="w-full">
                <thead><tr><TH>Category</TH><TH>Decision evidence</TH></tr></thead>
                <tbody>
                  <tr><TD className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">Single-turn</TD><TD className="text-xs">accuracy · unified cost · energy per request · decode and prefill throughput · TTFT/TPOT · S-MBU · S-MFU</TD></tr>
                  <tr><TD className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">Agentic</TD><TD className="text-xs">task success · unified cost · energy per task · task latency · decode speed per user · tool calls per task · tool-wait share · context growth</TD></tr>
                </tbody>
              </table>
            </div>
            <P>The metric set differs by category for a <em>measurement</em> reason: single-turn tasks carry the serving-efficiency diagnostics (sparsity-aware S-MBU / S-MFU on sparse MoE models, plain MBU / MFU on the dense one). We do not capture the sparsity trace of agentic tasks, but they report tool-call counts, turn counts, and context growth from per-request traces instead.</P>
            <SubH>Single-turn scoring</SubH>
            <div className="overflow-x-auto mb-3">
              <table className="w-full">
                <thead><tr><TH>Dataset</TH><TH>Scoring</TH></tr></thead>
                <tbody>
                  <tr><TD className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">GSM8K</TD><TD className="text-xs">Exact match. The model is told to end with <code>#### &lt;number&gt;</code>, and the extracted number is compared to the reference.</TD></tr>
                  <tr><TD className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">LongBench</TD><TD className="text-xs">Deterministic overlap per subtask (token F1, ROUGE-L and similar). No LLM judge.</TD></tr>
                  <tr><TD className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">Arena-Hard</TD><TD className="text-xs">Win rate against a fixed baseline model. An LLM judge compares each answer pair twice with positions swapped, and the two verdicts average into the score. Judge and baseline are recorded with each run.</TD></tr>
                </tbody>
              </table>
            </div>

            <SubH id="agentic-choices">Inside an agentic run</SubH>
            <P>For each task, the harness sends the current context to the model, runs any requested tools, appends their output and calls the model again. It stops when the model submits an answer or reaches the workload cap. Each workload defines its own harness, tools, grader and caps.</P>
            <div className="overflow-x-auto mb-3">
              <table className="w-full">
                <thead><tr><TH>Workload</TH><TH>Agent loop</TH><TH>Tools</TH><TH>Caps</TH><TH>Scoring</TH></tr></thead>
                <tbody>
                  <tr>
                    <TD className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">SWE-bench Lite<div className="text-xs font-normal text-slate-500 dark:text-slate-400 whitespace-normal">real GitHub issues · a curated subset balanced across the suite&apos;s 12 repositories</div></TD>
                    <TD className="text-xs">SWE-agent, one container per task from the official task image.</TD>
                    <TD className="text-xs">bash · file editor · submit</TD>
                    <TD className="text-xs">200 model calls</TD>
                    <TD className="text-xs">Official SWE-bench harness: the patch is applied and the repository&apos;s own tests decide.</TD>
                  </tr>
                  <tr>
                    <TD className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">MCP-Atlas<div className="text-xs font-normal text-slate-500 dark:text-slate-400 whitespace-normal">factual questions needing tools · the subset whose tools are free to access</div></TD>
                    <TD className="text-xs">Custom runner against an MCP tool server shared across tasks</TD>
                    <TD className="text-xs">~160 tools on 22 MCP servers (web search, GitHub, Wikipedia, scientific databases, filesystem, code execution), mostly live external services</TD>
                    <TD className="text-xs">20 turns · 10 min/task · 120 s/tool call</TD>
                    <TD className="text-xs">An LLM judge scores each ground-truth claim (fulfilled 1, partial ½, else 0). Pass at <Eq>mean ≥ 0.75</Eq>.</TD>
                  </tr>
                  <tr>
                    <TD className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">IMO-AnswerBench<div className="text-xs font-normal text-slate-500 dark:text-slate-400">competition maths, 25 per category</div></TD>
                    <TD className="text-xs">Custom runner, fresh Python kernel per task</TD>
                    <TD className="text-xs">python: a persistent Jupyter kernel</TD>
                    <TD className="text-xs">128 turns · 5 s/tool call</TD>
                    <TD className="text-xs">The final boxed answer goes to an LLM judge for equivalence with the reference: 1 or 0.</TD>
                  </tr>
                </tbody>
              </table>
            </div>
            <P>The 5-second Python timeout is deliberate: without it, models brute-force answers and hang the tool, so IMO accuracy should be read with this caveat in mind. All judge models are recorded with each run.</P>
            <P><b>Task concurrency follows the external services.</b> MCP-Atlas and SWE-bench call external APIs, so requested concurrency follows the API limit, and achieved tasks in flight can be lower and vary by run. The site shows the achieved number so results are read at the operating point the run actually reached, and it does not publish task throughput as hardware capacity because trajectories and external waits differ.</P>
          </Card>

          <Card>
            <H id="catalogs">Model &amp; hardware catalogues</H>
            <P>Both tables read live from the data file, so they always match the published measurements.</P>
            <SubH>Models</SubH>
            <P>The suite column shows which workload categories ran for each model.</P>
            {snap?.modelOrder ? (
              <div className="overflow-x-auto mb-4">
                <table className="w-full">
                  <thead><tr><TH>Model</TH><TH>Active / precision</TH><TH>Suites</TH></tr></thead>
                  <tbody>
                    {snap.modelOrder.map((mid) => {
                      const bt = snap.models?.[mid]?.batches?.['batch-size-default'] || {};
                      const kinds = new Set(Object.values(bt).map((sc) => sc.kind));
                      const suites = [kinds.has('moe') && 'Single-turn', kinds.has('agentic') && 'Agentic'].filter(Boolean).join(' · ') || '—';
                      return (
                        <tr key={mid}>
                          <TD className="font-semibold text-slate-800 dark:text-slate-200">{snap.modelMeta[mid].name}</TD>
                          <TD>{snap.modelMeta[mid].sub}</TD>
                          <TD className="text-xs">{suites}</TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <span className="text-xs text-slate-500 dark:text-slate-400">The model list appears after the data loads.</span>}
            <SubH>Accelerators</SubH>
            <P>Specs come from manufacturer datasheets. A platform appears here only after it passes the validation checks and has a documented cost basis.</P>
            {(() => {
              const HW = snap?.hardware;
              const price = {};
              (snap?.pricing?.prices || []).forEach((p) => { price[p.gpu_key] = p.price_per_gpu_hour_usd; });
              if (!HW) return <span className="text-xs text-slate-500 dark:text-slate-400">Hardware specs appear after the next data sync.</span>;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><TH>Accelerator</TH><TH>Memory</TH><TH>HBM</TH><TH>Bandwidth</TH><TH>Board power</TH><TH>Host CPU</TH><TH>Rent</TH></tr></thead>
                    <tbody>
                      {Object.entries(HW).map(([g, h]) => (
                        <tr key={g}>
                          <TD className="font-semibold text-slate-800 dark:text-slate-200">{h.name}</TD>
                          <TD>{h.mem_gb} GB</TD>
                          <TD className="text-xs">{h.hbm_type}</TD>
                          <TD className="whitespace-nowrap">{h.hbm_gb_s.toLocaleString()} GB/s</TD>
                          <TD>{h.tdp_w} W</TD>
                          <TD>{h.cpu_w} W</TD>
                          <TD className="whitespace-nowrap">{price[g] != null ? '$' + price[g].toFixed(2) + '/h' : '—'}</TD>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </Card>

          <Card>
            <H id="selection">Why these choices</H>
            <SubH>Why these workloads</SubH>
            <P>The workload set covers sparse MoE routing, long reasoning sequences and agents that call tools. Single-turn runs use established benchmarks. Agentic runs add CPU tools and network waits.</P>
            <SubH>Why these datasets</SubH>
            <P>The three single-turn datasets have different input and output lengths. GSM8K is short-in short-out, Arena-Hard is short-in long-out under judge scoring, and LongBench is long-in short-out, making prefill its dominant phase.</P>
            <P>We take each dataset&apos;s sample deterministically, so every engine, model and accelerator receives the same examples. Full runs at natural lengths would take days per configuration. The effect of sampling is reported under <a href="#variation" className="text-blue-600 dark:text-blue-400 hover:underline">Measurement variation</a>.</P>
            <SubH>Why these models</SubH>
            <P>We use open-weight models that fit the workloads and cover different scales, families and architectures. The MoE models range from roughly 5B to 37B active parameters and from 117B to one trillion total parameters across four families. This gives the sparsity-aware utilisation metrics several routing patterns to measure.</P>
            <P>Where a family offers variants, we use the one that fits the workload lengths. Qwen3-235B runs as Instruct-2507 because its 262K context window holds the long-context work and the original&apos;s 40K window does not. Qwen3-4B is both a dense control for the sparsity metrics and small enough to run on DGX Spark, P150b and CS-3.</P>
            <SubH>Why these engines</SubH>
            <P>We use vLLM and SGLang on NVIDIA and AMD GPUs because both are widely deployed, support MoE serving, long sequences, structured tool calls and prefix caching, and remain stable during sustained runs. The reason for running both, and the rule for choosing each build, are under <a href="#engines" className="text-blue-600 dark:text-blue-400 hover:underline">Engines &amp; batch regimes</a> and <a href="#engine-versions" className="text-blue-600 dark:text-blue-400 hover:underline">Engine version selection</a>.</P>
          </Card>

          <Card>
            <H id="engines">Engines &amp; batch regimes</H>
            <P>The site measures each configuration with one inference engine and one batch regime. You select both in the control bar.</P>
            <SubH>Inference engines</SubH>
            <P>NVIDIA and AMD runs use <b>vLLM</b> or <b>SGLang</b>, which lets the dashboard compare engines while holding the model, workload and hardware fixed. Tenstorrent runs use <b>KAI</b>, and Cerebras runs use <b>WaferEngine</b>. Those platforms each have one supported stack in the benchmark. Every cell names the stack that produced it.</P>
            <SubH>Batch regimes</SubH>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-300 mb-3">
              <li><b>Single query.</b> The engine runs one request at a time (batch size 1). This shows the best latency.</li>
              <li><b>Concurrent.</b> We ask the engine to maximise concurrency and let it choose how many requests to run together, with the config&apos;s VRAM as the ceiling. This shows the throughput under load.</li>
            </ul>
            <P>The agentic workloads use the Concurrent regime only.</P>
            <SubH>Node sizing</SubH>
            <P>Each model runs at a <b>matched node size across accelerators</b> (eight GPUs for the 670B–1T models, two for the 235B, one for the small ones), so a cross-accelerator comparison at the same model compares the same serving shape. A smaller-memory accelerator uses a larger node only where the model forces it: the 235B takes four H100s, and the small dense model two P150b cards. Where a view mixes node sizes the Insights panel names no throughput leader across the mismatch.</P>
            <P>Where a model fit is at the edge of two node sizes, both configurations are shown in the linked charts and results table. The alternate is labelled a scaling comparison (for example <b>H100 ×1→×2 scaling</b>) and excluded from leaders, rankings, the radar and the accuracy strip: other accelerators could also have used more hardware, so the pair answers only how this accelerator changes with node size.</P>
          </Card>

          <Band>How we measure it</Band>

          <Card>
            <H id="metrics">Metric definitions &amp; sources</H>
            <P>Every metric on the site carries its unit and provenance based on its inputs. The basis chip marks the weakest input in a metric&apos;s chain: <b>measured</b> means every input came from the run, <b>mixed</b> means a datasheet or price input enters it, and <b>recorded</b> means configuration metadata rather than a measurement. A metric derived from others opens with its formula, stated in terms of the rows above it.</P>
            <div className="overflow-x-auto mb-4">
              <table className="w-full">
                <thead><tr><TH className="w-[15%]">Metric</TH><TH className="w-[13%]">Field</TH><TH>Unit</TH><TH>Scope</TH><TH>Basis</TH><TH className="w-[40%]">Definition</TH></tr></thead>
                <tbody>
                  {[
                    ['User experience'],
                    ['Time to first token (TTFT)', 'ttft', 'ms', 'both', 'measured', 'The time until a request’s first output token. Prefill scheduling differs between engines, so compare TTFT with the engine held fixed.', ['†', '#reading-ttft']],
                    ['Time per output token (TPOT)', 'tpot_ms', 'ms', 'both', 'measured', 'The steady-state time for each decode token.'],
                    ['Tokens/s per user', 'tps', 'token/s', 'both', 'measured', <><Eq>= 1 / TPOT</Eq>: the decode speed one user experiences in a single stream. Industry serving plots call this rate interactivity.</>],
                    ['Task latency (avg end-to-end)', 'e2e', 's', 'agentic', 'measured', 'The average wall time to finish one task. Achieved task concurrency is published beside it so the latency is read at the run’s actual operating point.'],
                    ['Task latency (median · p99)', 'lat_p50 · lat_p99', 's', 'agentic', 'measured', 'The same wall time as a distribution, shown on the per-turn card as the median and the p99 tail because agentic tasks are heavy-tailed. Pooled per engine across hardware: a workload property, not a hardware cell value.'],
                    ['Capacity & operating point'],
                    ['Requests/s', 'reqs', 'req/s', 'single-turn', 'measured', <><Eq>= requests served / wall-clock s</Eq>: end-to-end throughput under concurrency, for the whole node. Not published for agentic runs: a task rate follows the trajectory, the tool-wait and the concurrency setting more than the hardware.</>],
                    ['Prefill throughput', 'tps_p', 'token/s', 'single-turn', 'mixed', 'Input tokens per second across the node during prefill, the main axis for long-context work. Each cell resolves to measured, estimated or unavailable.', ['‡', '#prefill-basis']],
                    ['Decode throughput per node', 'decode_throughput_node_tok_s', 'token/s', 'single-turn', 'measured', <><Eq>= achieved decode batch / TPOT</Eq>, or the engine’s recorded aggregate rate where present: total output tokens per second from the deployed node. Not normalised per accelerator, so take the node shape into consideration.</>],
                    ['Achieved decode batch', 'decode_batch_achieved', 'requests', 'single-turn', 'measured', 'Mean requests active during decode: the operating point published beside per-user latency and node decode throughput.'],
                    ['Achieved task concurrency', 'task_concurrency_achieved', 'tasks', 'agentic', 'measured', <><Eq>= task-seconds / wall-clock s</Eq>: mean tasks in flight, the operating point used to amortise task cost.</>],
                    ['Requested task concurrency', 'task_concurrency_nominal', 'tasks', 'agentic', 'recorded', 'The configured task concurrency from the run metadata: context for the achieved value, not a substitute for it.'],
                    ['Tokens per request', 'tokReq', 'tokens', 'both', 'measured', 'Output tokens per request or task. Per-request cost scales almost one-for-one with it: verbosity is a model property the headline deliberately includes.'],
                    ['Cost'],
                    ['Cost per request (headline)', 'buyReq · rentReq', '$ / request · $ / task', 'both', 'mixed', <><Eq>= node $/s × wall-clock s per request</Eq>: every second the node spends is charged, tool-wait included. Buy (amortised estimated purchase prices) and live-quoted rent appear side by side. The full construction is under <a href="#cost" className="text-blue-600 dark:text-blue-400 hover:underline">Unified cost model</a>.</>],
                    ['Decode output-token cost (rent)', 'rent', '$ / 1M tokens', 'single-turn', 'measured', <><Eq>= rent $/s / decode throughput per node</Eq>: the steady-state price of an output token at the live quote, excluding full request wall time, which the headline carries.</>],
                    ['Decode output-token cost (buy TCO)', 'buy', '$ / 1M tokens', 'single-turn', 'mixed', <><Eq>= TCO $/s / decode throughput per node</Eq>: the same rate priced against owning the hardware, amortised purchase price plus electricity.</>],
                    ['Energy'],
                    ['Energy per request (headline)', 'jReq', 'J / request · J / task', 'both', 'mixed', <>Single-turn: <Eq>= nameplate node W × wall-clock s per request</Eq>, an upper bound. Agentic: <Eq>= nameplate W × (prefill + decode s) + idle W × tool-wait s</Eq>, a two-term estimate with a per-accelerator idle draw.</>],
                    ['Energy efficiency (decode)', 'tokJ', 'token/joule', 'both', 'mixed', <><Eq>= decode throughput per node / nameplate node W</Eq>: a lower bound. The agentic value is a labelled proxy (per-user decode rate × achieved task concurrency), not a measured node rate.</>],
                    ['Utilisation diagnostics'],
                    ['Memory-bandwidth use (S-MBU, MBU on the dense model)', 'mbu_d · mbu_p', '%', 'single-turn', 'mixed', <><Eq>= phase token rate × bytes per token / datasheet bandwidth</Eq>: bytes per token come from the run’s own expert activation on MoE models, while the dense model needs no trace. Decode is the headline, and prefill appears on the radar’s prefill phase. A diagnostic value.</>, ['§', '#s-metrics']],
                    ['FLOPs use, prefill (S-MFU, MFU on the dense model)', 'mfu_p', '%', 'single-turn', 'mixed', <><Eq>= prefill token rate × FLOPs per token / datasheet dense peak</Eq> at the run’s precision. It inherits the prefill rate’s basis cell by cell. A diagnostic value.</>, ['§', '#s-metrics']],
                    ['Quality & task shape'],
                    ['Task accuracy / success', 'acc', '%', 'both', 'measured', 'The quality on the workload: a property of the model and the scaffold. Single-turn accuracy carries a 95% Wilson sampling interval (from n samples). Agentic accuracy has none, since runs branch on tool results and a spread is trajectory variance, not sampling.'],
                    ['Tool calls per task', '—', 'count', 'agentic', 'measured', 'Counted from the per-request traces.'],
                  ].map((r) => r.length === 1 ? (
                    <tr key={r[0]}><td colSpan={6} className="pt-4 pb-1 px-3 text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">{r[0]}</td></tr>
                  ) : (
                    <tr key={r[0]}>
                      <TD className="font-semibold text-slate-800 dark:text-slate-200">{r[0]}{r[6] && <> <a href={r[6][1]} className="font-normal text-blue-600 dark:text-blue-400 hover:underline">{r[6][0]}</a></>}</TD>
                      <TD className="font-mono text-xs"><FieldName name={r[1]} /></TD>
                      <TD className="text-xs">{r[2]}</TD>
                      <TD className="text-xs whitespace-nowrap">{r[3]}</TD>
                      <TD className="whitespace-nowrap">{r[4].split(' · ').map((b) => (
                        <span key={b} className={'text-xs px-2 py-0.5 rounded-full border mr-1 ' + (b === 'measured' ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' : b === 'mixed' ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300')}>{b}</span>
                      ))}</TD>
                      <TD>{r[5]}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>            <SubH id="prefill-basis">How the prefill rate resolves</SubH>
            <P>Each cell carries one of three bases, published with the data. <b>Measured</b>: an exact aggregation from the run&apos;s own records. A batch-1 prompt&apos;s tokens over its own TTFT, or a trace reconstruction of the prefill-carrying passes. <b>Estimated</b>: a concurrent run without a trace, rebuilt from the measured mean prefill batch and pass latency or TTFT, validated against the trace-exact runs and always labelled. Counts include every attempted request, and count the tokens present in the prompt rather than the tokens computed: a cached prefix counts though it is not recomputed (see <a href="#lessons" className="text-blue-600 dark:text-blue-400 hover:underline">Lessons</a>).</P>
            <SubH id="reading-ttft">Reading TTFT</SubH>
            <P>A request&apos;s prefill can span several scheduler passes: a long prompt is chunked, even at batch 1, and above batch 1 a pass can carry several requests. TTFT is the time to complete the passes carrying the request&apos;s own prefill. Waiting behind earlier passes is not included. A value spanning several passes needs an exact record: a per-request first-token latency measured at run time, or a weighted reconstruction from the run&apos;s own trace.</P>
            <SubH id="s-metrics">Reading the S-metrics</SubH>
            <P>S-MBU needs the run&apos;s own expert-activation trace: activation depends on the batch the run realised and varies several-fold across accelerators, so it is never imputed from another run. The dense model activates fully on every step and needs no trace. S-MFU needs none either, since a prefill pass tends to activate the model fully, and it inherits the prefill rate&apos;s basis instead. Ceilings are datasheet peaks, with NVIDIA&apos;s 2:4-sparse tensor-core quote halved onto AMD&apos;s dense convention.</P>
            <SubH>Where the numbers come from</SubH>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><TH>Input</TH><TH>Source</TH><TH>Basis</TH></tr></thead>
                <tbody>
                  {[
                    ['Rent price', <>The Vast.ai live marketplace (median of the lowest asks) for NVIDIA accelerators. Vultr for the MI355X, EPCC EIDF for the CS-3. Per-accelerator sources under <a href="#cost" className="text-blue-600 dark:text-blue-400 hover:underline">Unified cost model</a>.</>, 'measured'],
                    ['Accelerator board power (TDP)', 'The manufacturer datasheet (nameplate).', 'spec'],
                    ['Accelerator memory size and bandwidth', 'The manufacturer datasheet (nameplate).', 'spec'],
                    ['Host CPU power', 'A representative host CPU per accelerator, at datasheet TDP × socket count (detailed below).', 'estimate'],
                    ['Task accuracy or success', 'The scorer for each benchmark dataset.', 'measured'],
                    ['Throughput and latency', 'The serving engine’s telemetry (vLLM, SGLang, WaferEngine, KAI).', 'measured'],
                  ].map((r) => (
                    <tr key={r[0]}>
                      <TD className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{r[0]}</TD>
                      <TD>{r[1]}</TD>
                      <TD><span className={'text-xs px-2 py-0.5 rounded-full border ' + (r[2] === 'measured' ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' : r[2] === 'estimate' ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300')}>{r[2]}</span></TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P><b>Host-CPU power in detail.</b> Energy charges the accelerator board at nameplate TDP. The host CPU is a further platform assumption, since the actual server CPU varies by cloud node. We pair each accelerator with a representative host and charge that CPU&apos;s published TDP times its socket count:</P>
            <div className="overflow-x-auto mb-3">
              <table className="w-full">
                <thead><tr><TH>Accelerator</TH><TH>Assumed host</TH><TH>Charged</TH></tr></thead>
                <tbody>
                  {[
                    ['A100 · H100 · H200 · B200', 'dual Intel Xeon Platinum 8468', '2 × 350 W'],
                    ['B300', 'dual Intel Xeon Platinum 8558', '2 × 330 W'],
                    ['MI355X', 'dual AMD EPYC 7713P', '2 × 225 W'],
                    ['Tenstorrent P150b', 'single AMD Ryzen 7 9700X (the host CPU in Tenstorrent’s own Blackhole workstation)', '65 W'],
                    ['DGX Spark · Cerebras CS-3', 'integrated host', 'inside system power & price'],
                  ].map((r) => (
                    <tr key={r[0]}>
                      <TD className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{r[0]}</TD>
                      <TD>{r[1]}</TD>
                      <TD className="whitespace-nowrap">{r[2]}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P>The assumption weighs most on the single-accelerator datacentre nodes, where a dual-socket host can draw as much as the card it serves and cost nearly as much. Host-CPU power feeds only owned-hardware energy and TCO, and never touches throughput, latency, accuracy or rent.</P>
          </Card>

          <Card>
            <H id="cost">Unified cost model</H>
            <P>We measure cost under one model, and two scenarios: <b>rented</b> and <b>owned</b>. The site labels them distinctly and <b>never silently combines them</b>. Both are computed in the open TEASBench postprocessing from explicit, auditable price inputs.</P>

            <SubH>Per-request and per-task headlines</SubH>
            <P><b>$ / request</b>, single-turn: <Eq>= node $/s × makespan / requests served</Eq>.</P>
            
            <P><b>$ / task</b>, agentic: <Eq>= node $/s × task wall time / achieved task concurrency</Eq>. Every second the node spends is charged: prefill, decode and tool-wait all count.</P>
            <P><b>J / request</b>, single-turn: <Eq>= nameplate node W × wall-clock s per request</Eq>, an upper bound.</P>

            <P><b>J / task</b>, agentic: <Eq>= nameplate W × (prefill + decode s) + idle W × tool-wait s</Eq>, null where the time split is missing.</P>
            <P>A property of the wall-time denominator is deliberate, namely <b>ramp-up counts</b>: a short run&apos;s warm-up transient is real cost a deployer pays, so there is no minimum-duration correction. The per-token counterparts account for the steady-state scenario.</P>

            <SubH>Rent: from live quotes, not assumptions</SubH>
            <P>Rent prices are <b>fetched from live provider quotes at every data refresh</b>, not hardcoded. For accelerators on the Vast.ai marketplace we take a representative low-price sample, the median of the lowest N live rentable asks (N&nbsp;=&nbsp;5, or fewer where fewer are listed), so a single outlier ask cannot set the price. Where no machine-readable same-provider quote exists, a provider list price stands in and is <b>labelled as such</b>: Vultr on-demand for the MI355X, the EPCC EIDF commercial rate per CS-3 machine-hour.</P>
            <P>Every price carries its <b>source URL</b>, <b>source kind</b>, <b>quote time</b> and sample range, so a figure traces back to the exact quotes behind it.</P>

            {snap?.pricing?.prices?.length > 0 && (
              <div className="overflow-x-auto mb-3">
                <table className="w-full">
                  <thead><tr><TH>Hardware</TH><TH>$ / GPU-hour</TH><TH>Source</TH></tr></thead>
                  <tbody>
                    {snap.pricing.prices.map((p) => (
                      <tr key={p.gpu_key}>
                        <TD className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</TD>
                        <TD>${p.price_per_gpu_hour_usd?.toFixed?.(4) ?? '—'}</TD>
                        <TD className="text-xs">
                          <span className={p.source_kind?.startsWith('vast_live') ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}>{p.source_label}</span>
                          {p.note && <span className="text-slate-500 dark:text-slate-400"> · {p.note}</span>}
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {snap.pricing.price_quote_time && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Quoted {snap.pricing.price_quote_time}. This table is generated from the same price file the cost metrics were computed with.</p>
                )}
              </div>
            )}

            <SubH>The single-turn per-token pair</SubH>
            <P><b>$ / 1M output tokens</b>, single-turn only: <Eq>= node $/s / node decode rate</Eq>, with the decode rate from TPOT and achieved decode batch. It prices steady-state decode and excludes request wall time. Agentic publishes no per-token cost: task concurrency is not a decode batch, and agent time also goes to reasoning, tool calls and the harness.</P>

            <SubH>Buy: amortised from purchase price, power, and tier-specific duty cycles</SubH>
            <P><b>Buy pricing</b> addresses the scenario where hardware is owned by the user: <Eq>node $/s = capital × whole-node scale / effective lifetime s + node W × electricity</Eq>, with capital the accelerator and host purchase prices. The wall time and decode rates it prices are measured. Purchase prices and power draw are <span className="text-amber-700 dark:text-amber-300">estimated</span> from sourced catalogues and datasheets, and lifetime, utilisation and electricity are published defaults the user can adjust on the dashboard. Every buy figure is labelled <b>mixed</b>. The exact inputs are listed here.</P>
            {snap?.pricing?.buy && (() => {
              const b = snap.pricing.buy;
              const tierDefaults = b.defaults_by_tier || {};
              const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };
              return (<>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-300 mb-3">
                  {Object.entries(tierDefaults).map(([tier, d]) => <li key={tier}><b>{tier === 'datacentre' ? 'Datacentre' : 'Workstation'}</b>: hardware amortised over {d?.lifetime_years ?? '—'} years at {d?.utilisation != null ? Math.round(d.utilisation * 100) : '—'}% average utilisation ({d?.lifetime_hours?.toLocaleString?.() ?? '—'} effective hours).</li>)}
                  <li><b>Electricity</b>: ${b.electricity_usd_per_kwh}/kWh, applied to nameplate board and host power draw.</li>
                  <li><b>Whole-node capital</b>: accelerator and host-CPU purchase price, normally scaled ×{b.scale_other_capital} to cover the rest of the node (chassis, networking, memory). A catalogued complete-system price uses ×1 instead, so included equipment is not wrongly counted twice.</li>
                </ul>
                <P><b>The CS-3 is priced as one complete system.</b> Cerebras does not publish a list price and provided the $1.2M purchase price privately. The price and 23 kW rating cover the same integrated system, so we add no host CPU, MemoryX, SwarmX or whole-node scale. Its buy results remain <b>mixed</b>.</P>
                <div className="border-l-2 border-amber-500 bg-amber-50/60 dark:bg-amber-500/10 pl-3 py-2 mb-3">
                  <p className="text-sm text-slate-700 dark:text-slate-200">Owned $/token scales roughly as one over true utilisation, so a machine that runs below its tier&apos;s published duty cycle pays proportionally more per token.</p>
                </div>
                <P><b>Lifetime, utilisation and electricity are adjustable on the dashboard.</b> An override applies one explicit value across both tiers and marks every affected figure with a <b>custom pricing</b> badge.</P>
                {b.gpus?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr><TH>Accelerator</TH><TH>Purchase price</TH><TH>Board power</TH><TH>Source</TH></tr></thead>
                      <tbody>
                        {b.gpus.map((g) => (
                          <tr key={g.gpu_key}>
                            <TD className="font-semibold text-slate-800 dark:text-slate-200">{g.name}</TD>
                            <TD>{g.price_per_unit_usd != null ? '$' + g.price_per_unit_usd.toLocaleString() : '—'}</TD>
                            <TD>{g.tdp_w} W</TD>
                            <TD className="text-xs">{g.price_source
                              ? (/^https?:\/\//.test(g.price_source)
                                ? <a href={g.price_source} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">{host(g.price_source)}</a>
                                : g.price_source)
                              : '—'}</TD>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {b.gpus[0]?.price_quote_time && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Purchase prices quoted {b.gpus[0].price_quote_time}. Amortised capital = (accelerator + host) × {b.scale_other_capital} ÷ the published effective lifetime hours, plus energy.</p>
                    )}
                  </div>
                )}
              </>);
            })()}
          </Card>

          <Card>
            <H id="engine-versions">Engine version selection</H>
            <P>Engine builds can materially change cost, accuracy and performance. Natural-length runs are too expensive for an exhaustive version search, and newer builds do not always perform better.</P>
            <SubH>Which build a configuration starts on</SubH>
            <P>For each model, engine, accelerator and workload we use a build established to serve that combination correctly. One build serves every model where engine support permits it. Otherwise we establish a working build model by model from our own tests and guidance from the hardware company. A build established on one single-turn dataset serves the whole suite, whereas the agentic datasets exercise different engine features and need a build each. We change the build of a running configuration only when it cannot serve the model, when accuracy degrades, or when speed degrades severely, moving to a newer build or a larger node, whichever is the smaller change.</P>
            <SubH>Which run we publish</SubH>
            <P>This often leaves a configuration with runs on two builds, and we choose between them in the following order:</P>
            <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600 dark:text-slate-300 mb-3">
              <li><b>Validity.</b> The run served the model and completed the full sample set. Validity is assessed on <b>both</b> runs. A rerun that repairs an unreliable metric replaces the earlier run regardless of the comparisons below.</li>
              <li><b>Accuracy.</b> Any build whose accuracy is more than <b>5% relative</b> below the best valid build at that configuration is rejected.</li>
              <li><b>Throughput.</b> Among the remaining builds we take the fastest, measured as aggregate throughput in the Concurrent regime and as per-token latency at batch size 1. A margin under <b>10%</b> counts as a tie.</li>
              <li><b>Ties.</b> A tie goes to the build that keeps engine versions most consistent across the published runs on the same hardware or the same model.</li>
            </ol>

            <SubH>Unifying the build across accelerators</SubH>
            <P>We run one build across as many accelerators as possible. How far this extends is determined by each accelerator&apos;s engine support. A comparison across accelerators therefore evaluates each accelerator on the stack that actually serves it, and a difference between two accelerators reflects their software stacks as well as their silicon (see <a href="#limits" className="text-blue-600 dark:text-blue-400 hover:underline">Limits &amp; coverage</a>).</P>
            <SubH>Measuring the effect of a build change</SubH>
            <P>The effect of a build change is measured directly by a controlled replacement study, which repeats one model and its workloads on paired old and new builds of both engines on fixed hardware, and estimates the effect on every metric from the paired runs. The design is described under <a href="#variation" className="text-blue-600 dark:text-blue-400 hover:underline">Measurement variation</a>, and the results are shown on the <Link to="/insights#variation" className="text-blue-600 dark:text-blue-400 hover:underline">Insights page</Link>.</P>
            <P>Finally, version numbers are not comparable between ROCm builds and mainline releases because the two use separate numbering.</P>
          </Card>

          <Band>How far to trust it</Band>

          <Card>
            <H id="quality">Data quality &amp; run validity</H>
            <P>Every run shown on the site is a <b>valid, comparable run</b>. A run whose measurement itself failed (invalid, corrupted or non-comparable) is removed from the underlying results collection and never appears in the comparisons. A run that merely <b>underperforms</b> is not removed: degraded accuracy or severely degraded speed triggers the escalation described above, and where escalation does not fix the result, it is published and labelled.</P>
            <p className="text-sm text-amber-800 dark:text-amber-300/90 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 mb-3">
              The filter is for validity rather than quality: a valid run is never hidden because it scored low after escalation.</p>
            <P>The published data is regenerated from the committed measurements on every change, and validation is a stage of automated checks over the assembled data, run before every publication. There is no blocklist or suppression filter anywhere in the pipeline: every run the data holds is published, and a metric that cannot be evidenced is published as <b>null</b> rather than quietly dropped.</P>
          </Card>


          <Card>
            <H id="variation">Measurement variation</H>
            {vs?.schema_version === 3 ? <ControlledVariationMethods study={vs} /> : <P>The study loads with the published data.</P>}
          </Card>

          <Card>
            <H id="limits">Limits &amp; coverage</H>
            <P><b>Every result describes a full stack.</b> Each figure on this site is a property of one model, one inference-engine build, one accelerator and one workload. Changing the engine build changes the number, in some cases by more than the gap between accelerators. Each point shows its stack on hover (the run&apos;s precision, model checkpoint, inference-engine version and device) and should be read together with it.</P>

            <P><b>Each configuration is measured once.</b> Each of the {cells ? cells.toLocaleString() : ''} measurements shown here comes from a single run, so one number carries both the hardware&apos;s behaviour and whatever was true of that particular run. Runs with anomalous accuracy or performance were escalated as described under <a href="#engine-versions" className="text-blue-600 dark:text-blue-400 hover:underline">Engine version selection</a>, and the run that survived is the one shown. Far more runs were made than are published. That escalation is a plausibility filter we applied, and it is not repeated measurement. The run-to-run and build-to-build spreads under <a href="#variation" className="text-blue-600 dark:text-blue-400 hover:underline">Measurement variation</a> give the scale for reading a single number.</P>

            <P><b>Concurrency is chosen by the engine.</b> In the concurrent regime we ask the engine to maximise concurrency, and the level it achieves varies between engines and accelerators. Per-stream throughput is therefore measured at whatever concurrency each run reached, and two cells on one chart are not always in the same regime. Cost per token accounts for the achieved concurrency and per-stream latency does not, so prefer cost when comparing across configurations.</P>

            <P><b>Accuracy can differ between engines on the same hardware.</b> GPT-OSS is the one model whose two engines require different reasoning parsers, and on Arena-Hard, the judge-scored workload where answer extraction matters most, its two engines score visibly apart on the same hardware. The other workloads&apos; extraction is format-tolerant. A second gap, DeepSeek-R1 LongBench on MI355X, traces to generation degrading under concurrent batching on that engine build. Both are properties of the serving stack rather than of the model.</P>
            <P><b>Speed can also differ between engines by large factors.</b> Batch-size-default means the engine&apos;s out-of-the-box behaviour under natural request arrival, and some engines degrade badly at specific operating points: we have measured one engine falling more than an order of magnitude behind the other on the same model, hardware and workload, reproduced across independent machines. Such cells are published as measured, because a deployer using default settings would experience exactly this. They measure that combination of model, engine build and accelerator, and support no claim about the accelerator family in general.</P>

            <P><b>Some per-token definitions depend on the engine.</b> A GPU step can carry prefill and decode work at once, and vLLM and SGLang file such steps under different labels, so a cross-engine per-token comparison inherits the bookkeeping convention. The effect grows with the ratio of prefill work to generated tokens, and agentic per-token time is unaffected. Compare per-token latency within one workload category and one engine wherever possible. The mechanism is set out under Lessons.</P>

            <P><b>Rent prices are not always on the same basis.</b> Rent quotes can come from different providers, and a marketplace ask and a managed-cloud list price are not directly comparable, so a cross-provider rent ranking should be read as approximate.</P>

            <P><b>Fixed-length figures support performance comparisons only.</b> A fixed input or output length does not match the natural workload, so accuracy from a fixed-length run is not meaningful. <Link to="/insights#fixed-vs-natural" className="text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">See the measured gap on the dashboard →</Link></P>

            <SubH>What the suite does not cover</SubH>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li><b>Power draw is not measured.</b> Every energy figure is an estimate computed from nameplate ratings under the cost model above. J/request and token/joule assume the accelerator board and host CPU at full draw throughout, so they bound the truth: energy per request is overstated and tokens per joule understated. Agentic J/task adds an estimated idle draw during tool-wait, so it is a bound in neither direction.</li>
              <li><b>Some gaps are deliberate.</b> The single-turn and agentic suites run different model sets, shown in the catalogue above, so an agentic dataset for a single-turn-only model is not a pending run and will not be produced. The largest models also skip the A100 and H100, because they do not fit well on them.</li>
            </ul>
          </Card>

          <Card>
            <H id="lessons">Lessons from realistic workloads</H>
            <P>Fixed-length benchmarking is easy to measure because identical requests, one phase at a time, no refusals and known denominators remove most sources of ambiguity. Realistic workloads must account for all of these. This section records what we learned measuring them and, set off in teal, how we addressed it.</P>

            <SubH>Counting the work</SubH>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300 mb-4">
              <li><b>Some requests never reach the forward pass.</b> Real open-ended prompts get refused by the model, by a safety layer, or by a client failure before any token is computed. Dividing by the number of tasks in the dataset therefore mixes work done with work never attempted.<Practice>Keep three nested cohorts, <b>attempted ⊇ served ⊇ completed</b>, and bind each metric to one: throughput and utilisation divide by served work, while accuracy divides by everything attempted, since a refusal counts against quality but contributes no serving work.</Practice></li>
              <li><b>Missing measurements must stay distinct from zeros.</b> Usage is recorded by several instruments across client, server and scheduler, and some records arrive without it. A pipeline that defaults absent usage to 0 averages phantom zeros into real rates.<Practice>Record absence as null and let aggregation skip it. Admit a zero only where something positive backs it, and enforce physical invariants (a completed response implies a non-empty processed prompt) so sentinel zeros cannot pass as data.</Practice></li>
              <li><b>Prefix caching separates context tokens from computed tokens.</b> Realistic traffic repeats itself (shared system prompts, templates, an agent&apos;s growing context re-sent every turn), which is exactly what prefix caches exploit and random synthetic prompts never trigger. The accelerator therefore computes fewer tokens than a request&apos;s context holds, and the difference depends on the cache hit rate. A prefill rate computed over the full context length overstates the hardware&apos;s speed, because it counts cached tokens that were never computed.<Practice>Compute rates must sum forwarded tokens from the engine&apos;s own per-pass records. Context-length counts remain correct for capability and cost claims, and every metric has to say which it uses.</Practice></li>
            </ul>

            <SubH>Attributing the time</SubH>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300 mb-4">
              <li><b>Queue time versus service time.</b> Requests that arrive at natural times with variable lengths form queues, which an offline batch that starts all requests together never has. Under load, part of a request&apos;s latency therefore passes before the engine begins serving it: client-observed TTFT = queue wait + prefill service + network and streaming overhead, while an engine-side TTFT counts only the service. The first depends on the arrival pattern as much as on the machine, and the second leaves out the waiting a user experiences.<Practice>Record both boundaries, publish which one a number uses, and never compare across the two.</Practice></li>
              <li><b>Chunked prefill.</b> A prompt of size L longer than the scheduler&apos;s per-pass token budget B is served as at least ⌈L/B⌉ chunks across several passes, with other requests interleaved. At short fixed lengths this never happens. A mean over passes then differs from a mean over requests: a long prompt contributes many chunks that each complete quickly, while its first token waits for the last of them, so the pass mean understates first-token latency.<Practice>Per-request time must span all of a request&apos;s chunks, and pass records must be weighted by the requests each pass carries.</Practice>
                <Fig>
                  <svg viewBox="0 0 560 96" width="100%" style={{ maxWidth: 560 }} aria-hidden="true">
                    <text x="4" y="14" fontSize="10" fill="currentColor">scheduler passes →</text>
                    {[
                      ['A·1', 40, 88, true], ['B', 132, 56, false], ['A·2', 192, 88, true],
                      ['C', 284, 56, false], ['A·3', 344, 88, true],
                    ].map(([l, x, w, a]) => (
                      <g key={l}>
                        <rect x={x} y={24} width={w} height={22} rx={3} fill="currentColor" opacity={a ? 0.5 : 0.18} />
                        <text x={x + w / 2} y={39} fontSize="10" textAnchor="middle" fill="currentColor">{l}</text>
                      </g>
                    ))}
                    <path d="M40 56 v6 h392 v-6" stroke="currentColor" fill="none" />
                    <text x="236" y="76" fontSize="10" textAnchor="middle" fill="currentColor">request A&apos;s first token: spans all five passes, not the mean of its three chunks</text>
                  </svg>
                </Fig>
              </li>
              <li><b>Steps that carry both phases.</b> Continuous batching puts prefill chunks and decode tokens into one accelerator step. The step&apos;s latency belongs to both phases at once, and different engines file it under different labels. A prefill/decode split read off step labels therefore reflects the engine&apos;s bookkeeping convention rather than the physical work.<Practice>Either attribute time by the work inside the step, or publish the split with its convention named, and compare phase timings only within one convention.</Practice>
                <Fig>
                  <svg viewBox="0 0 560 92" width="100%" style={{ maxWidth: 560 }} aria-hidden="true">
                    <rect x="40" y="10" width="300" height="24" rx="3" fill="currentColor" opacity="0.5" />
                    <rect x="340" y="10" width="140" height="24" rx="3" fill="currentColor" opacity="0.18" />
                    <text x="190" y="26" fontSize="10" textAnchor="middle" fill="currentColor">prefill chunk (request D)</text>
                    <text x="410" y="26" fontSize="10" textAnchor="middle" fill="currentColor">decode (A, B, C)</text>
                    <text x="40" y="52" fontSize="10" fill="currentColor">one GPU step, one latency t</text>
                    <text x="40" y="72" fontSize="10" fill="currentColor">engine 1 files it: decode at full t · engine 2 files it: prefill at full t</text>
                    <text x="40" y="86" fontSize="10" fill="currentColor">so phase timings are never additive across conventions</text>
                  </svg>
                </Fig>
              </li>
              <li><b>Batching raises latency and throughput together.</b> The engine chooses the batch, and chooses differently on every accelerator: more memory means a larger batch, and a larger batch raises per-token latency and aggregate throughput at once. The two describe one operating point from two sides, so ranking on either alone is misleading.<Practice>Publish achieved decode batch or task concurrency beside latency, and compare on batch-integrating metrics (cost or energy per request or task) or at a pinned batch of one.</Practice></li>
            </ul>

            <SubH>Scoping and aggregating</SubH>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300 mb-4">
              <li><b>Per-request and node-aggregate rates share a unit.</b> One stream&apos;s decode speed and a node&apos;s total output are both &ldquo;tokens per second&rdquo;, equal at batch 1 and apart by the achieved batch under real concurrency, often by orders of magnitude: node rate = per-stream rate × achieved batch.<Practice>Every rate must name its scope in the metric itself, and one scope must never be derived from the other without the measured batch that connects them.</Practice></li>
              <li><b>Parallel ranks duplicate telemetry.</b> Under tensor or pipeline parallelism every rank executes the same forward pass, and a distributed engine can emit one record per rank for it. Data-parallel replicas, by contrast, hold distinct requests. Summing records across the node counts each token once per rank, and everything downstream inherits the multiple.<Practice>Normalise to one logical record per group at ingest, and prove it with an invariant whose true total is known independently, such as the tokenizer&apos;s count of the prompts.</Practice>
                <Fig>
                  <svg viewBox="0 0 560 96" width="100%" style={{ maxWidth: 560 }} aria-hidden="true">
                    <rect x="40" y="8" width="200" height="22" rx="3" fill="currentColor" opacity="0.5" />
                    <text x="140" y="23" fontSize="10" textAnchor="middle" fill="currentColor">one pass · 4,096 tokens · TP=4</text>
                    {[0, 1, 2, 3].map((r) => (
                      <g key={r}>
                        <path d={`M140 30 L${70 + r * 110} 48`} stroke="currentColor" fill="none" opacity="0.4" />
                        <rect x={30 + r * 110} y={50} width={80} height={20} rx={3} fill="currentColor" opacity="0.18" />
                        <text x={70 + r * 110} y={64} fontSize="10" textAnchor="middle" fill="currentColor">rank {r}: 4,096</text>
                      </g>
                    ))}
                    <text x="40" y="88" fontSize="10" fill="currentColor">naive sum: 16,384 tokens for 4,096 of work · keep one record per group</text>
                  </svg>
                </Fig>
              </li>
              <li><b>The trace holds work the workload never asked for.</b> Warm-up requests, health probes, client retries and aborted streams all leave genuine records, and the shorter the run, the more they distort its rates.<Practice>Such records must be identifiable at source, marked when they happen rather than reconstructed afterwards. A retry counts fully in end-to-end latency but only once in work done.</Practice></li>
              <li><b>The average is part of the question.</b> With identical requests all averages agree. At heavy-tailed natural lengths, an unweighted mean over requests (what a typical request sees) and total work over total time (what the system produces) diverge widely, and they answer different questions rather than one being correct.<Practice>Decide which question the metric answers, weight to it, and print the unit of analysis beside the number.</Practice></li>
            </ul>

            <SubH>Scoring the answers and the agents</SubH>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300 mb-4">
              <li><b>Scoring infrastructure fails as well.</b> Open-ended tasks cannot be scored by exact match. They need answer parsers, chat templates and judge models, and that machinery is part of the measurement chain with its own failure modes. A judge call that errors must not be scored as a tie, a parser that cannot read one engine&apos;s output format says nothing about model quality, and a scoring failure that is averaged in without notice corrupts the accuracy figure.<Practice>Count scoring errors as their own cohort, exclude them from the mean or fail the cell above a threshold, and before attributing an accuracy gap to hardware or model, check whether the scaffold (template, parser, judge) differs between the cells.</Practice></li>
              <li><b>Agents choose their own workload.</b> An agentic task branches at every turn on the model&apos;s own generations and on tool results, so two correct runs can take different trajectories with different token counts, and run-to-run spread is trajectory variance rather than sampling noise around a fixed truth. External tools add a second complication: a rate-limited API caps requested concurrency from outside, so a task-throughput figure can simply mirror the cap.<Practice>Report per-task latency, name the caps and timeouts as part of the benchmark definition, and never quote an agentic spread as a sampling interval.</Practice></li>
            </ul>

            <SubH>Keeping the record honest</SubH>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300 mb-3">
              <li><b>Schema drift with silent fallbacks.</b> A benchmark that tracks an evolving field lives across harness and engine generations, so fields get renamed, semantics shift under a stable name, and old records sit beside new ones. Code that reads such records and quietly falls back to a default, an older field or a neighbouring record produces wrong numbers without any visible error.<Practice>Version the record schema and fail closed: a record that does not carry a field on the current basis contributes nothing, and the gap stays visible.</Practice></li>
              <li><b>Provenance is part of the value.</b> No realistic pipeline measures everything, so every published number mixes run-measured timing with datasheet ceilings, modelled constants or reconstructed values, and a bare number hides which is which.<Practice>Label every metric by the weakest input in its chain: <b>measured</b> only when every input came from the run, <b>mixed</b> or <b>estimated</b> otherwise, and <b>unavailable</b>, with the reason, where the evidence supports no value.</Practice></li>
            </ul>

            <P>Realistic workloads require explicit rules for which requests and tokens count, which timing boundary applies and how results are averaged. TEAS publishes those choices with the measurements.</P>
          </Card>

          <Card>
            <H id="independence">Independence &amp; industry involvement</H>
            <P>In TEAS, our academic team independently selects the models, workloads, deployment regimes, node sizes, configurations and metrics. The team also runs and audits the measurements, and makes the final publication decisions.</P>
            <P>Hardware companies provided access to machines, technical information and factual corrections. The disclosures below set out that involvement, the investigators&apos; affiliations and the review process.</P>
            <SubH id="industry-involvement">Where companies were involved</SubH>

            <P><b>Hardware access.</b> AMD and Tenstorrent gave us temporary access to machines for the MI355X and Blackhole measurements because we could not procure either platform in time. No other company supplied hardware access.</P>

            <P><b>Bringing up new accelerators.</b> Neither vLLM nor SGLang supports the Cerebras CS-3 or the Tenstorrent Blackhole, so our team wrote the serving code for both accelerators. Tenstorrent maintains its own fork of vLLM, but we found our alternative, built on Tenstorrent&apos;s public engine, provided better support for our models. Cerebras and Tenstorrent supplied information about their hardware and software, covering what was needed to run the models and what affected performance. Public documentation for these accelerators is much scarcer than for NVIDIA and AMD parts, so the two companies were often the only source. Where a configuration underperformed on an NVIDIA or AMD part, the information needed to correct it was usually already public.</P>

            <P><b>Reproducibility differs by platform.</b> The NVIDIA results come from <a href="https://github.com/TEAS-project/TEASBench/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">open benchmarking pipelines</a> anyone can re-run and verify, and the AMD pipeline will be made available shortly. The code for the Cerebras CS-3 and the Tenstorrent Blackhole is not yet released, so for those two accelerators the site shows the measured results only, without a runnable pipeline.</P>

            <P><b>One pricing input came directly from Cerebras.</b> The company privately communicated the CS-3 purchase price, which is detailed under the cost model above. Every other purchase price in the catalogue has a public source.</P>

            <P><b>What the companies did not contribute to.</b> The hardware companies did not select the models, workloads, deployment regimes, node sizes or configurations, or define, aggregate or label a metric.</P>

            <P><b>Affiliations and collaborations.</b> Edoardo Ponti was a visiting professor at NVIDIA before the start of the TEAS project. Luo Mai&apos;s group has published research on large language model inference at wafer scale, developed and evaluated on Cerebras hardware, and has worked on developing inference engines for Tenstorrent hardware. Nick Brown has led EPSRC-funded research using Cerebras and AMD hardware.</P>

            <P><b>Company review and corrections.</b> Before publication, we contacted people at each hardware company represented on the site. We shared the website in advance and invited corrections of factual errors. The window closed on 24 August 2026. Their responses:</P>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300 mb-4">
              <li><b>Cerebras</b>: corrected the CS-3 purchase price to the privately communicated $1.2M, now applied to all CS-3 buy costs with the source labelled.</li>
              <li><b>AMD</b>: noted that the default chart showed per-user speed at a concurrent operating point without the achieved batch or node throughput visible. We accepted this, and the data and charts now show the operating point.</li>
              <li><b>Tenstorrent</b>: attested the Blackhole serving configuration (110 usable Tensix cores per card, BF16 with HiFi2 math fidelity) and queried the published throughput. We reran the experiment and published the corrected values.</li>
              <li><b>NVIDIA</b>: no corrections received.</li>
            </ul>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}
