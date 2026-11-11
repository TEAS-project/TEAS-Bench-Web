import { Link } from 'react-router-dom';

const ASSETS = '/blog-assets/introducing-teasbench';

function Fig({ src, alt, children }) {
  return (
    <figure>
      <img src={`${ASSETS}/${src}`} alt={alt} loading="lazy" className="mx-auto rounded-md bg-white p-2 border border-slate-200 dark:border-slate-700" />
      <figcaption>{children}</figcaption>
    </figure>
  );
}

const In = ({ to, children }) => <Link to={to}>{children}</Link>;
const Out = ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;

export default function IntroducingTeasbench() {
  return (
    <>
      <p>Inference, running trained models to answer people's requests, now consumes more of the world's accelerators than any other application. The people who buy that hardware, design it, and write the software that runs on it all rely on benchmarks to decide what to do next. Our concern is simple: <i>the benchmarks they rely on lag behind the workloads frontier labs actually serve.</i></p>
      <p>This post introduces <b>TEASBench</b> (<i>Tracking Evolving AI and Systems</i>), a benchmark for the <b>Cost</b>, <b>Accuracy</b>, and <b>Performance</b> of AI inference, and shares four lessons from its first 484 configurations (each one a combination of model, task, engine, accelerator, and serving mode).</p>
      <h2>Why Another Benchmark?</h2>
      <p>Well-known inference benchmarks such as MLPerf Inference and InferenceX are useful, and they are moving in our direction: InferenceX now reports cost per token, and MLPerf added an agentic workload in 2026. But they still fix prompt and output lengths, treat accuracy as a tolerance gate rather than a result, and replay recorded agent traces rather than letting an agent run real tools. Infrastructure buyers ask a broader question: <i>for the models I plan to serve, in the way I actually serve them, what does each option cost, how fast is it, and does it still get the answers right?</i></p>
      <p>Two shifts make that harder to answer: Mixture-of-Experts (MoE) models use only a small slice of themselves per token, and how much gets used depends on the load; and AI agents split each task between the GPU and external tools. For older models, cost, accuracy, and speed moved together, so one speed number was a fair summary. For today's workloads they come apart.</p>
      <h2>What TEASBench Does</h2>
      <p>TEASBench measures <b>Cost, Accuracy, and Performance (CAP)</b> for each combination of model, task, engine, and hardware it runs. The first release covers:</p>
      <ul>
        <li><b>Models:</b> four MoE models (GPT-OSS-120B, Qwen3-235B, DeepSeek-R1, Kimi K2.5), a small dense model (Qwen3-4B) for comparison, and two agents (GPT-OSS-120B and DeepSeek-V3.2).</li>
        <li><b>Tasks:</b> maths questions, open-ended chat, and long documents, plus three agent tasks: competition maths with a code tool, remote tool servers, and fixing real software bugs. Prompt and answer lengths are never capped.</li>
        <li><b>Hardware:</b> NVIDIA A100, H100, H200, B200, and B300; AMD MI355X; NVIDIA DGX Spark; Tenstorrent Blackhole; and Cerebras CS-3.</li>
        <li><b>Software:</b> two open-source engines, vLLM and SGLang.</li>
      </ul>
      <p>Every setup is tested <i>one request at a time</i>, like a personal assistant, and <i>many requests together</i>, like a busy cloud service, recording accuracy, speed, cost per request (renting and owning), and energy per request. We also compute the best speed each chip could physically deliver for each model. That gives us a ruler: <i>if a result is close to the limit, the hardware is the bottleneck; if it is far away, the software is.</i></p>
      <h2>Finding 1: How You Serve a Model Decides What Hardware You Need</h2>
      <Fig src="fig2.png" alt="Memory bandwidth needed by each model versus what each accelerator provides.">
        Figure 1. Bandwidth each model needs for 50 tokens per second (bands) against what each accelerator or 8-accelerator server provides (points). The solid line is one user, reading only the active experts; the dashed line is the worst case for a loaded server, reading every expert.
      </Fig>
      <p>For these models, token speed is limited by how fast the chip can read the model's weights from memory, not by raw computing power. Serving one user, each step reads only the few experts that token needs: DeepSeek-R1 has 671 billion parameters but uses about 37 billion per token. Fifty tokens per second then takes under 2 TB/s even for the largest models, so a single H100 or MI355X has enough bandwidth for all four models. Bandwidth is not enough on its own, though: the GPU must also hold the model's weights in memory. In our runs only GPT-OSS-120B fits on a single GPU; Qwen3-235B needs two to four GPUs, and DeepSeek-R1 and Kimi K2.5 need four to eight. Serving many users, different requests call on different experts. A loaded server read five to ten times as many experts per step in our measurements, and in the worst case reads all of them, 10 to 30 times as many. That means 6 to 50 TB/s, and only full 8-GPU servers are fast enough for the largest models.</p>
      <p><b>Takeaway:</b> memory capacity must hold the whole model either way; beyond that, size bandwidth to the active slice of the model for interactive use, and to the whole model for a busy service.</p>
      <h2>Finding 2: Most of the Chip's Memory Speed Goes Unused</h2>
      <p>If speed is limited by memory bandwidth, you would expect these models to use most of it. They do not. Serving one request at a time, the MoE models used only <b>2–17%</b> of their chips' rated bandwidth, against <b>26–52%</b> for the dense model on the same hardware and software. Part of this is inherent, since each MoE step does little arithmetic for one request, but the dense model shows the gap can be much smaller. Newer chips also deliver less than their spec sheets suggest: the B300 has 3.9 times the bandwidth of the A100 but ran GPT-OSS-120B only 2.1 times faster for one user (Table 1). By our ruler, that points to the software as the bottleneck.</p>
      <h2>Finding 3: Software Can Matter as Much as Hardware</h2>
      <p><i>Table 1. GPT-OSS-120B answering maths questions (GSM8K) with each engine. Bold marks the faster engine on that accelerator. The many-user column was measured with [N] concurrent requests.</i></p>
      <div className="overflow-x-auto">
      <table>
        <thead>
          <tr><th>Accelerator</th><th style={{ textAlign: 'center' }}>One user: tokens/s (vLLM / SGLang)</th><th style={{ textAlign: 'center' }}>Many users: requests/s (vLLM / SGLang)</th></tr>
        </thead>
        <tbody>
          <tr><td>NVIDIA A100</td><td style={{ textAlign: 'center' }}><b>139</b> / 86</td><td style={{ textAlign: 'center' }}><b>7.7</b> / 2.0</td></tr>
          <tr><td>NVIDIA H100</td><td style={{ textAlign: 'center' }}><b>195</b> / 177</td><td style={{ textAlign: 'center' }}><b>6.3</b> / 4.3</td></tr>
          <tr><td>NVIDIA H200</td><td style={{ textAlign: 'center' }}><b>202</b> / 194</td><td style={{ textAlign: 'center' }}><b>9.1</b> / 8.3</td></tr>
          <tr><td>AMD MI355X</td><td style={{ textAlign: 'center' }}><b>236</b> / 95</td><td style={{ textAlign: 'center' }}><b>7.1</b> / 5.9</td></tr>
          <tr><td>NVIDIA B200</td><td style={{ textAlign: 'center' }}>206 / <b>282</b></td><td style={{ textAlign: 'center' }}>7.6 / <b>20.0</b></td></tr>
          <tr><td>NVIDIA B300</td><td style={{ textAlign: 'center' }}>187 / <b>286</b></td><td style={{ textAlign: 'center' }}>7.6 / <b>20.5</b></td></tr>
        </tbody>
      </table>
      </div>
      <p>Switching engine can change speed as much as switching chip generation, and which engine is faster depends on the hardware. On AMD's MI355X, vLLM was 2.5 times faster than SGLang for one user. On NVIDIA's B200 and B300 with many users, SGLang served nearly three times as many requests as vLLM, a bigger gap than between all six datacentre GPUs running vLLM. Even small updates matter: moving SGLang from version [X] to version [Y] made the same requests take about <b>seven times longer</b> on A100, with no clear effect on H100. <b>A hardware result is always a result for the hardware and its software version together.</b></p>
      <h2>Finding 4: The Cheapest Option Depends on How You Pay</h2>
      <p>We price every request two ways: <b>renting</b> at cloud-marketplace prices (the Vast.ai quote of 12 October 2026) and <b>owning</b> over five years, electricity included. The answers can disagree (Table 2). For GPT-OSS-120B under load, the cheapest to <b>rent</b> is the oldest chip, the A100, at about $16 per million requests, while the cheapest to <b>own</b> is the newest, the B300, at about $24. Renting a B300 costs 22 times more per hour but serves only 2.7 times as many requests.</p>
      <p><i>Table 2. Cost and energy per request for GPT-OSS-120B on GSM8K under load, using the better engine on each accelerator and [N] accelerator(s) per run. Ownership assumes a purchase price of [P], five years at 90% utilisation, and electricity at [E] per kWh. Energy is rated board power multiplied by time per request.</i></p>
      <div className="overflow-x-auto">
      <table>
        <thead>
          <tr><th>Accelerator</th><th style={{ textAlign: 'center' }}>Rent price per GPU-hour</th><th style={{ textAlign: 'center' }}>Rent: $ per million requests</th><th style={{ textAlign: 'center' }}>Own: $ per million requests</th><th style={{ textAlign: 'center' }}>Energy per request</th></tr>
        </thead>
        <tbody>
          <tr><td>NVIDIA A100</td><td style={{ textAlign: 'center' }}>$0.44</td><td style={{ textAlign: 'center' }}><b>$16</b></td><td style={{ textAlign: 'center' }}>$38</td><td style={{ textAlign: 'center' }}>143 J</td></tr>
          <tr><td>NVIDIA H100</td><td style={{ textAlign: 'center' }}>$1.93</td><td style={{ textAlign: 'center' }}>$86</td><td style={{ textAlign: 'center' }}>$65</td><td style={{ textAlign: 'center' }}>224 J</td></tr>
          <tr><td>NVIDIA H200</td><td style={{ textAlign: 'center' }}>$3.80</td><td style={{ textAlign: 'center' }}>$116</td><td style={{ textAlign: 'center' }}>$49</td><td style={{ textAlign: 'center' }}>154 J</td></tr>
          <tr><td>NVIDIA B200</td><td style={{ textAlign: 'center' }}>$4.75</td><td style={{ textAlign: 'center' }}>$66</td><td style={{ textAlign: 'center' }}>$27</td><td style={{ textAlign: 'center' }}><b>85 J</b></td></tr>
          <tr><td>NVIDIA B300</td><td style={{ textAlign: 'center' }}>$9.94</td><td style={{ textAlign: 'center' }}>$135</td><td style={{ textAlign: 'center' }}><b>$24</b></td><td style={{ textAlign: 'center' }}>101 J</td></tr>
          <tr><td>AMD MI355X</td><td style={{ textAlign: 'center' }}>$2.65 (list price)</td><td style={{ textAlign: 'center' }}>$103</td><td style={{ textAlign: 'center' }}>$58</td><td style={{ textAlign: 'center' }}>259 J</td></tr>
        </tbody>
      </table>
      </div>
      <p>Keeping hardware busy matters for energy too: on a B200, serving many requests together used 25 times less energy per request than serving one at a time.</p>
      <h2>Beyond the GPU</h2>
      <p>Other hardware shows how different the trade-offs can be. <b>Cerebras CS-3</b>, which keeps the whole model in on-chip memory, ran Qwen3-4B at about <b>1,180 tokens per second</b> for one user, over three times the fastest GPU, but cost more and used more energy per request. <b>Tenstorrent Blackhole</b> ran the same model at 74 tokens per second with accuracy close to the GPUs'. The desktop <b>NVIDIA DGX Spark</b> runs GPT-OSS-120B slowly, about 30 tokens per second, but for one request at a time it used the least energy per request of any machine we tested on that model: good for a developer working locally, less so for a shared service.</p>
      <h2>What's Next</h2>
      <p>We are adding more AMD chips, multi-agent, vision, and speech workloads, and carbon per token, with results refreshed every six months. TEASBench is open source: explore the results at <In to="/">teasbench.com</In> and the code at <Out href="https://github.com/TEAS-project/TEASBench">github.com/TEAS-project/TEASBench</Out>. If you run hardware or workloads we haven't covered, we would love to hear from you.</p>
      <p><i>TEASBench is built by AI, systems, and HPC researchers at the University of Edinburgh, EPCC, and Imperial College London, and funded by ARIA's Scaling Compute programme.</i></p>
    </>
  );
}
