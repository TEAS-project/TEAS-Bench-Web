import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Nav } from './teas/Nav.jsx';
import { Footer } from './teas/Footer.jsx';
import { agentScatterSVG, AGENT_KIND, capRadarSVG, tipHandlers } from './teas/charts.js';
import { AGENT_BENCH, AGENT_POINTS } from './teas/agentCardData.js';
import { useChartTheme } from './teas/theme.js';

// MoE-CAP Fig. 3 values, reproduced from the published dashboard on labelled, data-zoomed axes.
const MOECAP_VARIANTS = {
  'Qwen3-30B-A3B': {
    sub: 'serving systems · A5000', costUnit: '$', systems: [
      { name: 'SGLang', col: '#118AB2', cost: 8000, lat: 0.058, acc: 91 },
      { name: 'K-Transformers', col: '#EE9B00', cost: 4000, lat: 0.07, acc: 80 },
      { name: 'MoE-Infinity', col: '#06A77D', cost: 4000, lat: 0.150, acc: 91 },
    ],
  },
  'Qwen3-235B-A22B': {
    sub: 'quantisation · H20', costUnit: 'W', systems: [
      { name: 'MoE-Infinity', col: '#06A77D', cost: 900, lat: 0.51, acc: 95 },
      { name: 'SGLang-FP8', col: '#D7263D', cost: 2000, lat: 0.038, acc: 92 },
      { name: 'SGLang-AWQ (INT4)', col: '#EE9B00', cost: 1400, lat: 0.038, acc: 89 },
    ],
  },
};
function moecapRadar(v) {
  const systems = v.systems.map((s) => ({ name: s.name, col: s.col, v: [s.cost, s.lat, s.acc] }));
  const costFmt = v.costUnit === '$' ? (x) => `$${Math.round(x).toLocaleString()}` : (x) => `${Math.round(x)}W`;
  const axes = [
    { label: `Cost (${v.costUnit})`, fmt: costFmt, invert: true },
    { label: 'Latency (s/tok)', fmt: (x) => (x < 0.1 ? x.toFixed(3) : x.toFixed(2)), invert: true },
    { label: 'Accuracy (EM)', fmt: (x) => `${Math.round(x)}%` },
  ];
  return capRadarSVG(systems, axes);
}

// Lightweight chart controls for the publications page.
function Chart({ html, className = '' }) {
  return <div className={`overflow-x-auto ${className}`} {...tipHandlers()} dangerouslySetInnerHTML={{ __html: html }} />;
}
function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${value === o
            ? 'bg-teal-600 text-white border-teal-600'
            : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-500'}`}>{o}</button>
      ))}
    </div>
  );
}

// Publication measurements are point-in-time rather than live dashboard data.

// Provenance badge for point-in-time data.
function Badge({ children }) {
  return (
    <span className="inline-block align-middle text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded
      bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-500/30">
      {children}
    </span>
  );
}

function Cite({ bibtex }) {
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-xs font-semibold text-teal-700 dark:text-teal-300 hover:underline select-none">Cite (BibTeX)</summary>
      <pre className="mt-2 text-xs bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-700 dark:text-slate-300 whitespace-pre">{bibtex}</pre>
    </details>
  );
}

export default function Research() {
  useChartTheme();  // Rebuild SVG strings after a theme change.
  const [agBench, setAgBench] = useState(AGENT_BENCH[0]);
  const [mcVar, setMcVar] = useState('Qwen3-235B-A22B');
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Nav />

      {/* Hero */}
      <div className="bg-gradient-to-b from-white dark:from-slate-800 to-slate-50 dark:to-slate-900 py-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-slate-100" style={{ lineHeight: 1.2 }}>Publications</h1>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            The dashboard updates as new measurements arrive. The papers below are fixed studies of serving systems,
            offloading, quantisation and mixed-deployment agent teams. Their reported values do not change.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">

        {/* ---- MoE-CAP ---- */}
        <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-lg p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">MoE-CAP: Benchmarking Cost, Accuracy and Performance of Sparse Mixture-of-Experts Systems</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Jiang, Fu, Huang, Nie, Lu, Xue, He, Sit, Xue, Dong, Miao, Du, Xu, Zou, Ponti, Mai</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            NeurIPS 2025 · Datasets &amp; Benchmarks Track ·{' '}
            <a href="https://proceedings.neurips.cc/paper_files/paper/2025/hash/74bd547997917a20331d6df5e6049d6a-Abstract-Datasets_and_Benchmarks_Track.html"
              target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5">
              proceedings <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
            MoE-CAP measures <b>cost, accuracy and performance</b>. In the study, no system improves two without giving up
            ground on the third. The paper also introduces the sparsity-aware utilisation metrics <b>S-MBU</b> and <b>S-MFU</b>
            for comparisons across hardware, and applies the <b>CAP radar</b> to serving systems, <b>offloading</b> engines and
            <b>quantisation</b>.
          </p>
          <p className="text-sm text-teal-700 dark:text-teal-300 mb-1">
            The <Link to="/" className="font-semibold hover:underline">Overview</Link> uses this CAP radar and its S-MBU / S-MFU axes for hardware comparisons.
          </p>
          {/* Recreated from the published dashboard values. */}
          {(() => {
            const v = MOECAP_VARIANTS[mcVar];
            return (
              <figure className="my-5">
                <div className="mb-2"><Chips options={Object.keys(MOECAP_VARIANTS)} value={mcVar} onChange={setMcVar} /></div>
                <p className="text-center text-xs text-slate-500 dark:text-slate-400 mb-1">{mcVar} · {v.sub}</p>
                <Chart html={moecapRadar(v)} className="max-w-md mx-auto" />
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-1 text-xs">
                  {v.systems.map((s) => (
                    <span key={s.name} className="font-semibold" style={{ color: s.col }}>
                      ■ <span className="font-normal text-slate-500 dark:text-slate-400">{s.name}</span>
                    </span>
                  ))}
                </div>
                <figcaption className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <Badge>Published measurement · point-in-time</Badge> Each CAP radar spoke is a raw metric on a labelled scale
                  fitted to the systems shown. Values improve toward the rim. Cost and latency fall, while accuracy rises.
                  No system reaches the rim on all three axes (MoE-CAP, NeurIPS 2025, Fig. 3).
                </figcaption>
              </figure>
            );
          })()}
          <Cite bibtex={`@inproceedings{jiang2025moecap,
  title     = {MoE-CAP: Benchmarking Cost, Accuracy and Performance of Sparse Mixture-of-Experts Systems},
  author    = {Jiang, Yinsicheng and Fu, Yao and Huang, Yeqi and Nie, Ping and Lu, Zhan and Xue, Leyang and He, Congjie and Sit, Man-Kit and Xue, Jilong and Dong, Li and Miao, Ziming and Du, DaYou and Xu, Tairan and Zou, Kai and Ponti, Edoardo Maria and Mai, Luo},
  booktitle = {Advances in Neural Information Processing Systems (NeurIPS), Datasets and Benchmarks Track},
  year      = {2025}
}`} />
        </article>

        {/* ---- AgentCARD ---- */}
        <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-lg p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Specialize Roles, Mix Deployments: Pushing the Cost-Accuracy Frontier of LLM Agent Teams</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Jiang, Cheng, Huang, Zhao, Lu, Dong, Li, Ponti, Mai</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            arXiv · 2026 ·{' '}
            <a href="https://arxiv.org/abs/2606.20629" target="_blank" rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5">
              arXiv:2606.20629 <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
            AgentCARD studies teams in which different models act as <b>planner, executor or verifier</b> and run through an
            API, on self-hosted hardware or across both. In its experiments, <b>heterogeneous teams</b> with <b>mixed deployment</b>{' '}
            reached up to <b>44% higher accuracy</b> at the same cost, or the same accuracy at up to <b>12× lower cost</b>,
            than uniform teams.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            The dashboard measures <i>single-model</i> agentic inference on MCP-Atlas, SWE-bench and IMO-AnswerBench.
            AgentCARD instead measures teams split across API and self-hosted deployments.
          </p>
          {/* Recreated from the paper's data. */}
          <figure className="my-5">
            <div className="mb-3"><Chips options={AGENT_BENCH} value={agBench} onChange={setAgBench} /></div>
            <Chart html={agentScatterSVG(AGENT_POINTS.filter((p) => p.b === agBench))} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2 text-xs">
              {Object.entries(AGENT_KIND).map(([k, v]) => (
                <span key={k} className="font-semibold" style={{ color: v.col }}>
                  {v.glyph} <span className="font-normal text-slate-500 dark:text-slate-400">{v.label}</span>
                </span>
              ))}
              <span className="text-slate-500 dark:text-slate-400">· dashed = Pareto frontier</span>
            </div>
            <figcaption className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              <Badge>Published measurement · point-in-time</Badge> Cost against accuracy on one of AgentCARD&apos;s five
              benchmarks (pick above), where up and to the left is better. Some heterogeneous teams using API and self-hosted
              models are both cheaper and more accurate than every uniform team (AgentCARD, arXiv 2026, Fig. 1).
            </figcaption>
          </figure>
          <Cite bibtex={`@article{jiang2026agentcard,
  title   = {Specialize Roles, Mix Deployments: Pushing the Cost-Accuracy Frontier of LLM Agent Teams},
  author  = {Jiang, Yinsicheng and Cheng, Liang and Huang, Yeqi and Zhao, Yufan and Lu, Zhan and Dong, Li and Li, Wenda and Ponti, Edoardo and Mai, Luo},
  journal = {arXiv preprint arXiv:2606.20629},
  year    = {2026}
}`} />
        </article>
      </div>
      <Footer />
    </div>
  );
}
