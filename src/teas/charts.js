// Pure SVG chart builders.
import { GNM, metricT, runMeta, FWLABEL } from './model.js';
import * as T from './theme.js';
import { prefillRate } from './prefillBasis.js';

// Dimmed provenance block for a tooltip: runMeta lines + any `extra`. '' when empty.
function metaBlock(cell, extra) {
  const lines = (cell ? runMeta(cell) : []).concat((extra || []).filter(Boolean));
  return lines.length ? `<div style='margin-top:5px;opacity:0.7;font-size:11px'>${lines.join('<br>')}</div>` : '';
}

// ---- shared hover tooltip (imperative, avoids React re-renders on mousemove) ----
let _tip;
function ensureTip() { if (!_tip) { _tip = document.createElement('div'); _tip.className = 'teas-tip'; document.body.appendChild(_tip); } return _tip; }
export function tipHandlers(onPick) {
  const pick = (target) => { const t = target?.getAttribute?.('data-click') ? target : target?.closest?.('[data-click]'); if (!t || !onPick) return; const v = t.getAttribute('data-click'), i = v.indexOf(':'); onPick(v.slice(0, i), v.slice(i + 1)); };
  return {
    onMouseMove: (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); const el = ensureTip();
      if (t) { el.innerHTML = t.getAttribute('data-tip'); el.style.display = 'block'; el.style.left = Math.min(e.clientX + 14, window.innerWidth - 250) + 'px'; el.style.top = (e.clientY + 14) + 'px'; } else el.style.display = 'none'; },
    onMouseLeave: () => { if (_tip) _tip.style.display = 'none'; },
    onClick: (e) => pick(e.target),
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { const t = e.target.closest && e.target.closest('[data-click]'); if (t) { e.preventDefault(); pick(t); } } },
  };
}

// Radar axes use best-in-view = 100. Tooltips show raw values.
const rfmt = (v) => (v >= 100 ? Math.round(v) + '' : v >= 1 ? v.toFixed(1) : v.toFixed(3));
// Append only the unit suffix when the formatter already includes $ or J.
const uval = (fmt, v, unit) => (unit && /^[$J]\s/.test(unit) ? `${fmt(v)}${unit.slice(1)}` : `${fmt(v)} ${unit}`);
// Short hardware label for dense charts. Tooltips retain the full name.
export const shortHw = (s) => String(s).replace(/^(NVIDIA|AMD|Tenstorrent|Cerebras)\s+/, '').replace(' x8', ' ×8');
// Find the nearest non-overlapping label position within the plot.
function dodge(placed, x, y, hw, top, bottom, step = 12) {
  const clash = (yy) => placed.some((p) => Math.abs(p.x - x) < p.hw + hw && Math.abs(p.y - yy) < 11);
  const y0 = Math.max(top, Math.min(y, bottom));
  for (let d = 0; d <= 10; d++) {
    for (const c of (d === 0 ? [y0] : [y0 - d * step, y0 + d * step])) {
      if (c >= top && c <= bottom && !clash(c)) { placed.push({ x, y: c, hw }); return c; }
    }
  }
  placed.push({ x, y: y0, hw }); return y0;
}
export function radarSVG(hw, mem, axesIn) {
  const W = 440, H = 320, cx = 220, cy = 155, R = 95;
  const axes = (axesIn || [{ k: 'nP', l: 'Perf' }, { k: 'nC', l: 'Cost(rent)' }, { k: 'nE', l: 'Energy' }, { k: 'nM', l: 'MBU' }, { k: 'nF', l: 'MFU' }]).map((a, i, arr) => ({ ...a, a: -90 + i * 360 / arr.length }));
  const pt = (a, r) => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)]; let g = '';
  [0.25, 0.5, 0.75, 1].forEach((f) => { g += `<polygon points="${axes.map((ax) => pt(ax.a, R * f).map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${T.TK.grid}"/>`; });
  axes.forEach((ax) => {
    const [x, y] = pt(ax.a, R); g += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${T.TK.grid}"/>`;
    // Anchor by direction: a centred label on a side axis runs back over the polygon, which is
    // what made the longer axis names collide with the marks.
    const c = Math.cos(ax.a * Math.PI / 180), s = Math.sin(ax.a * Math.PI / 180);
    const anc = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
    const [lx, ly] = pt(ax.a, R + (anc === 'middle' ? 16 : 10));
    // Systematic two-line label: Name on top, unit below (dimmer/smaller). Lift a top-of-chart axis
    // so its 2-line block clears the vertex.
    const ny = ly + 4 + (s < -0.35 ? -9 : 0);
    g += `<text x="${lx.toFixed(1)}" y="${ny.toFixed(1)}" text-anchor="${anc}" font-size="11" font-weight="700" fill="${T.TK.sec}">${ax.l}${ax.unit ? `<tspan x="${lx.toFixed(1)}" dy="11" font-size="9" font-weight="500" fill="${T.TK.tick}">${ax.unit}</tspan>` : ''}</text>`;
  });
  mem.forEach((n) => {
    const d = hw[n], col = T.GCOL[n] || d.col;
    // Span axes this hw did not measure (e.g. gb10 has no sparsity) rather than spiking the
    // polygon to the centre — a null is "not measured", not "scored zero". Hit-targets below
    // still label it. Draw only the measured vertices. The shape spans the gap.
    const poly = axes.filter((ax) => d[ax.k] != null).map((ax) => pt(ax.a, R * d[ax.k] / 100).map((z) => z.toFixed(1)).join(',')).join(' ');
    g += `<polygon points="${poly}" fill="${col}" fill-opacity="0.10" stroke="${col}" stroke-width="2.2"/>`;
  });
  // Hit targets last so they sit above every polygon. Raw value first in the tooltip: the
  // percentage is only a rank within the current view, and saying so keeps that honest.
  mem.forEach((n) => {
    const d = hw[n];
    axes.forEach((ax) => {
      const v = d[ax.k] == null ? 0 : d[ax.k];
      const [x, y] = pt(ax.a, R * v / 100);
      const raw = ax.raw ? d[ax.raw] : null;
      const money = ax.unit && ax.unit.charAt(0) === '$';
      // An axis formatter carries its own symbol ('0.4¢', '6 kJ'), so a '$'/'J'-led unit
      // contributes only its remainder (' / request') — same rule as uval above.
      const line = raw == null ? '<i>not measured</i>'
        : ax.fmt ? `${ax.fmt(raw)}${ax.unit && /^[$J]\s/.test(ax.unit) ? ax.unit.slice(1) : ax.unit ? ' ' + ax.unit : ''}`
        : money ? `$${raw.toFixed(2)}${ax.unit.slice(1)}` : `${rfmt(raw)}${ax.unit ? ' ' + ax.unit : ''}`;
      const tip = `<b>${d.name} · ${ax.l}</b><br>${line}<br>${v.toFixed(0)}% of best in this view`;
      g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="transparent" pointer-events="all" data-tip="${tip}"/>`;
    });
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:440px">${g}</svg>`;
}

// ---- Fig 2: HBM-bandwidth roofline (bands per model + spec GPU points) ----
export function fig2SVG(figs, fig2model, fig2gpu, mg) {
  const W = 772, H = 380, m = { l: 64, r: 172, t: 18, b: 48 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  // Pin hardware above the HBM range to the chart boundary.
  const xmin = 100, xmax = 100000, ymin = 100, ymax = 100000;
  const X = (v) => m.l + (Math.log10(v) - Math.log10(xmin)) / (Math.log10(xmax) - Math.log10(xmin)) * pw;
  const Y = (v) => m.t + ph - (Math.log10(v) - Math.log10(ymin)) / (Math.log10(ymax) - Math.log10(ymin)) * ph;
  let g = ''; const ticks = [100, 1000, 10000, 100000], tl = { 100: '100', 1000: '1k', 10000: '10k', 100000: '100k' };
  ticks.forEach((t) => { g += `<line x1="${X(t)}" y1="${m.t}" x2="${X(t)}" y2="${m.t + ph}" stroke="${T.TK.grid}" stroke-opacity="0.4"/><line x1="${m.l}" y1="${Y(t)}" x2="${m.l + pw}" y2="${Y(t)}" stroke="${T.TK.grid}" stroke-opacity="0.4"/>`;
    g += `<text x="${X(t)}" y="${m.t + ph + 16}" text-anchor="middle" font-size="10.5" fill="${T.TK.tick}">${tl[t]}</text><text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end" font-size="10.5" fill="${T.TK.tick}">${tl[t]}</text>`; });
  const mAll = (fig2model === 'all');
  // One placement list for band labels and hardware labels together: the two share the right margin
  // whenever a mark sits near the edge, so dodging them separately lets them collide. Bands claim
  // their slots first because their label position is the only thing tying them to their region.
  const f2placed = [];
  // Bands are regions, not series: neutral by default so they never compete with the GPU marks
  // for identity. The focused model is the only one that takes the accent.
  figs.fig2.bands.forEach((b) => { const yl = Y(b.lo), yh = Y(b.hi), on = mAll || b.model === fig2model, op = on ? 1 : 0.35;
    const foc = !mAll && b.model === fig2model, bc = foc ? T.TK.bandOn : T.TK.band;
    // R1 and V3.2 share the same 671B/37B architecture, so the R1 band represents both DeepSeeks.
    const bnm = b.model === 'deepseek-r1' ? 'DeepSeek-R1/V3.2 37/671B' : b.name;
    g += `<rect x="${m.l}" y="${yh}" width="${pw}" height="${yl - yh}" fill="${bc}" fill-opacity="${foc ? 0.08 : 0.05}"/>`;
    g += `<line x1="${m.l}" y1="${yl}" x2="${m.l + pw}" y2="${yl}" stroke="${bc}" stroke-width="${foc ? 2.4 : 1.5}" stroke-opacity="${op}"/>`;
    g += `<line x1="${m.l}" y1="${yh}" x2="${m.l + pw}" y2="${yh}" stroke="${bc}" stroke-width="${foc ? 2 : 1.3}" stroke-dasharray="5 4" stroke-opacity="${op}"/>`;
    const bly = dodge(f2placed, m.l + pw + 6, (yl + yh) / 2 + 3, bnm.length * 3.1, m.t + 8, m.t + ph - 4);
    g += `<text x="${m.l + pw + 6}" y="${bly}" font-size="10.5" font-weight="${foc ? '800' : '600'}" fill="${foc ? T.TK.bandLabel : T.TK.tick}" fill-opacity="${op}">${bnm}</text>`;
    const tip = `<b>${bnm}</b><br>bandwidth to sustain 50 token/s decode:<br>batch=1 floor: ${b.lo.toLocaleString()} GB/s<br>batch=max ceiling: ${b.hi.toLocaleString()} GB/s`;
    g += `<rect x="${m.l}" y="${yh}" width="${pw}" height="${Math.max(6, yl - yh)}" fill="transparent" pointer-events="all" data-tip="${tip}" data-click="f2model:${b.model}"/>`; });
  // Show off-scale on-wafer SRAM as a labelled caret at the boundary.
  const abbr = (v) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}k` : `${v}`);
  figs.fig2.hw.forEach((d) => { const off = d.y > ymax || d.x > xmax;
    const x = Math.min(X(d.x), m.l + pw - 9), y = Math.max(Y(d.y), m.t + 7), base = d.name.replace(' x8', '');
    const dcol = T.GCOL_BY_NAME[base] || d.col;
    const on = (mg ? mg.has(base) : true) && (fig2gpu === 'all' || base === fig2gpu), op = on ? 0.95 : 0.16;
    if (off) g += `<path d="M ${x} ${y - 8} L ${x - 7} ${y + 5} L ${x + 7} ${y + 5} Z" fill="${dcol}" fill-opacity="${op}"/>`;
    else if (d.node === 8) g += `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" fill="${dcol}" fill-opacity="${op}"/>`;
    else g += `<circle cx="${x}" cy="${y}" r="6" fill="${dcol}" fill-opacity="${op}"/>`;
    const lbl = shortHw(d.name) + (off ? ` ↑ ${abbr(d.y)}` : ''), want = off ? y + 22 : y - 10;
    const ly = dodge(f2placed, x, want, lbl.length * 3.1, m.t + 8, m.t + ph - 4);
    if (Math.abs(ly - want) > 4) g += `<line x1="${x}" y1="${y + (ly > y ? 7 : -7)}" x2="${x}" y2="${ly + (ly > y ? -8 : 2)}" stroke="${dcol}" stroke-opacity="${op * 0.4}" stroke-width="1"/>`;
    g += `<text x="${x}" y="${ly}" text-anchor="middle" font-size="9.5" fill="${T.TK.ink}" fill-opacity="${on ? 1 : 0.28}">${lbl}</text>`;
    const tip = `<b>${d.name}</b><br>board power: ${d.x.toLocaleString()} W<br>memory bandwidth: ${d.y.toLocaleString()} GB/s<br>${d.node === 8 ? '8-GPU node' : 'single GPU'}${off ? '<br>drawn at the axis edge: this part is above the chart maximum' : ''}`;
    g += `<circle cx="${x}" cy="${y}" r="11" fill="transparent" pointer-events="all" data-tip="${tip}" data-click="f2gpu:${base}"/>`; });
  g += `<text x="${m.l + pw / 2}" y="${H - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}">board power (W) →</text>`;
  g += `<text x="16" y="${m.t + ph / 2}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}" transform="rotate(-90,16,${m.t + ph / 2})">bandwidth (GB/s) →</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:772px">${g}</svg>`;
}

// ---- Fig 3: agentic GPU time vs tool time per turn ----
export function fig3SVG(figs, fig3model, fig3work, fig3gpu) {
  const W = 640, H = 400, m = { l: 62, r: 24, t: 18, b: 48 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const xmin = 0.5, xmax = 300, ymin = 0.05, ymax = 100;
  const X = (v) => m.l + (Math.log10(Math.max(v, xmin)) - Math.log10(xmin)) / (Math.log10(xmax) - Math.log10(xmin)) * pw;
  const Y = (v) => m.t + ph - (Math.log10(Math.max(v, ymin)) - Math.log10(ymin)) / (Math.log10(ymax) - Math.log10(ymin)) * ph;
  let g = ''; const xt = [1, 10, 100], yt = [0.1, 1, 10, 100];
  xt.forEach((t) => { g += `<line x1="${X(t)}" y1="${m.t}" x2="${X(t)}" y2="${m.t + ph}" stroke="${T.TK.grid}" stroke-opacity="0.4"/><text x="${X(t)}" y="${m.t + ph + 16}" text-anchor="middle" font-size="10.5" fill="${T.TK.tick}">${t}s</text>`; });
  yt.forEach((t) => { g += `<line x1="${m.l}" y1="${Y(t)}" x2="${m.l + pw}" y2="${Y(t)}" stroke="${T.TK.grid}" stroke-opacity="0.4"/><text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end" font-size="10.5" fill="${T.TK.tick}">${t}s</text>`; });
  const lo = Math.max(xmin, ymin), hi = Math.min(xmax, ymax);
  g += `<line x1="${X(lo)}" y1="${Y(lo)}" x2="${X(hi)}" y2="${Y(hi)}" stroke="${T.TK.hair}" stroke-width="1.3" stroke-dasharray="6 4"/>`;
  g += `<text x="${X(1.5)}" y="${Y(55)}" font-size="11" font-style="italic" fill="${T.TK.tick}">tool / CPU bound</text>`;
  g += `<text x="${X(70)}" y="${Y(2)}" font-size="11" font-style="italic" fill="${T.TK.tick}" text-anchor="end">model / GPU bound</text>`;
  const pts = figs.fig3.pts.filter((p) => p.model === fig3model && (fig3work === 'all' || p.ds === fig3work) && (fig3gpu === 'all' || p.gpu === fig3gpu));
  const f3placed = [];
  pts.forEach((d) => { const x = X(d.x), y = Y(d.y), reg = d.y > d.x ? 'tool / CPU-bound' : 'model / GPU-bound';
    const eng = d.engines && d.engines.length ? [`Pooled across: ${d.engines.map((e) => FWLABEL[e] || e).join(', ')}`] : [];
    const tip = `<b>${d.ds} · ${d.gpu}</b><br>GPU time/turn: ${d.x}s<br>tool time/turn: ${d.y}s<br>${reg}${metaBlock(d, eng)}`;
    const col = T.DSCOL[d.ds] || d.col, lbl = shortHw(d.gpu), ly = dodge(f3placed, x, y - 11, lbl.length * 3.1, m.t + 8, m.t + ph - 4);
    if (Math.abs(ly - (y - 11)) > 4) g += `<line x1="${x}" y1="${y + (ly > y ? 8 : -8)}" x2="${x}" y2="${ly + (ly > y ? -8 : 2)}" stroke="${col}" stroke-opacity="0.35" stroke-width="1"/>`;
    g += `<circle cx="${x}" cy="${y}" r="7" fill="${col}" fill-opacity="0.9" pointer-events="all" data-tip="${tip}" data-click="f3work:${d.ds}"/><text x="${x}" y="${ly}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${T.TK.ink}">${lbl}</text>`; });
  g += `<text x="${m.l + pw / 2}" y="${H - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}">model / GPU time per turn (s) →</text>`;
  g += `<text x="16" y="${m.t + ph / 2}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}" transform="rotate(-90,16,${m.t + ph / 2})">tool / CPU time per turn (s) →</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:640px">${g}</svg>`;
}

// ---- Fig 1 (Analysis): agentic metric across workflow turns ----
export function turnplotSVG(turns, turnModel, turnWork, turnFw, mk, tmeta) {
  const data = (((turns[turnModel] || {})[turnWork] || {})[turnFw]) || {}; const gpus = Object.keys(data);
  const meta = tmeta || {};  // {gpu: provenance}, per line
  if (!gpus.length) return `<p style="color:${T.TK.tick};font-size:13px">No detailed per-turn data for this selection.</p>`;
  const valid = (p) => Number.isFinite(p[mk]) && (mk === 'tools' ? p[mk] >= 0 : p[mk] > 0);
  let maxT = 0, maxY = 0; gpus.forEach((gp) => data[gp].forEach((p) => { if (valid(p)) { maxT = Math.max(maxT, p.t); maxY = Math.max(maxY, p[mk]); } }));
  if (maxY <= 0) maxY = 1;
  const W = 720, H = 340, m = { l: 66, r: 20, t: 16, b: 46 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const X = (v) => m.l + (maxT ? v / maxT : 0) * pw, Y = (v) => m.t + ph - (v / maxY) * ph; let g = '';
  for (let i = 0; i <= 4; i++) { const yv = maxY * i / 4; g += `<line x1="${m.l}" y1="${Y(yv)}" x2="${m.l + pw}" y2="${Y(yv)}" stroke="${T.TK.grid}" stroke-opacity="0.4"/><text x="${m.l - 8}" y="${Y(yv) + 4}" text-anchor="end" font-size="10.5" fill="${T.TK.tick}">${yv >= 100 ? Math.round(yv) : yv.toFixed(1)}</text>`; }
  const step = Math.max(1, Math.ceil(maxT / 12));
  for (let t = 0; t <= maxT; t += step) g += `<text x="${X(t)}" y="${m.t + ph + 16}" text-anchor="middle" font-size="10.5" fill="${T.TK.tick}">${t}</text>`;
  gpus.forEach((gp) => { const pts = data[gp].filter(valid).sort((a, b) => a.t - b.t), col = T.GCOL[gp] || `${T.TK.fallback}`;
    const path = pts.map((p, i) => (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p[mk]).toFixed(1)).join(' ');
    g += `<path d="${path}" fill="none" stroke="${col}" stroke-width="2" stroke-opacity="0.9"/>`;
    const mb = metaBlock(meta[gp]);
    pts.forEach((p) => { const tip = `<b>${GNM[gp]} · turn ${p.t}</b><br>${metricT(mk)}: ${p[mk]}<br>n=${p.n} examples<br>in ${p.inp} · out ${p.out} tok · ${p.tools} tools${mb}`;
      g += `<circle cx="${X(p.t)}" cy="${Y(p[mk])}" r="3.4" fill="${col}" pointer-events="all" data-tip="${tip}"/>`; }); });
  g += `<text x="${m.l + pw / 2}" y="${H - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}">workflow turn →</text>`;
  g += `<text x="16" y="${m.t + ph / 2}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}" transform="rotate(-90,16,${m.t + ph / 2})">${metricT(mk)} →</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:720px">${g}</svg>`;
}

// ---- Expert activation (MoE sparsity): dumbbell, grouped by phase ----
// Two groups (prefill, decode). Each model is one row with a batch=1 dot (hollow) ── concurrent dot
// (filled) on a shared "% of experts" axis. Short prefill dumbbells (concurrency barely widens an
// already-broad prefill) vs long decode dumbbells (one token fires ~top_k. A full batch fires many
// more) are the whole point. Colour = model, mirroring the Fig 2 bands.
export function expertSVG(expert) {
  const models = (expert || []).filter((m) => m && m.prefill && m.decode && m.n_experts);
  if (!models.length) return `<p style="color:${T.TK.tick};font-size:13px">Expert-activation data is not in this build yet.</p>`;
  const groups = [['prefill', 'Prefill'], ['decode', 'Decode']];
  const W = 720, rowH = 30, gap = 30, hdrH = 20, nameX = 118, m = { l: 168, r: 64, t: 60, b: 46 };
  const pw = W - m.l - m.r;
  const H = m.t + groups.length * hdrH + groups.length * models.length * rowH + (groups.length - 1) * gap + m.b;
  const X = (pct) => m.l + Math.max(0, Math.min(100, pct)) / 100 * pw;
  let g = '';
  // x grid + ticks
  [0, 25, 50, 75, 100].forEach((t) => {
    g += `<line x1="${X(t)}" y1="${m.t - 10}" x2="${X(t)}" y2="${H - m.b}" stroke="${T.TK.grid}" stroke-opacity="0.5"/>`;
    g += `<text x="${X(t)}" y="${H - m.b + 16}" text-anchor="middle" font-size="10.5" fill="${T.TK.tick}">${t}%</text>`;
  });
  // legend
  g += `<circle cx="${m.l + 6}" cy="${m.t - 34}" r="5.5" fill="${T.TK.surface}" stroke="${T.TK.tick}" stroke-width="2.2"/><text x="${m.l + 17}" y="${m.t - 30}" font-size="11" fill="${T.TK.tick}">batch = 1</text>`;
  g += `<circle cx="${m.l + 96}" cy="${m.t - 34}" r="5.5" fill="${T.TK.tick}"/><text x="${m.l + 107}" y="${m.t - 30}" font-size="11" fill="${T.TK.tick}">concurrent</text>`;
  let gy = m.t;
  groups.forEach(([ph, label]) => {
    g += `<text x="10" y="${gy + 13}" font-size="10.5" font-weight="800" letter-spacing="0.06em" fill="${T.TK.sec}">${label.toUpperCase()}</text>`;
    gy += hdrH;
    models.forEach((md) => {
      const y = gy + rowH / 2, nE = md.n_experts, b1 = md[ph].b1, cc = md[ph].conc, col = md.col;
      g += `<text x="${nameX}" y="${y + 4}" text-anchor="end" font-size="11" fill="${T.TK.ink}">${md.name}</text>`;
      // A phase can have one regime withheld (e.g. a concurrent value with no
      // trustworthy measurement). Draw whichever points exist, and the
      // connecting line only when both do.
      const pB = b1 != null ? b1 / nE * 100 : null, pC = cc != null ? cc / nE * 100 : null;
      if (pB != null && pC != null) {
        g += `<line x1="${X(pB).toFixed(1)}" y1="${y}" x2="${X(pC).toFixed(1)}" y2="${y}" stroke="${col}" stroke-width="3" stroke-opacity="0.5"/>`;
      }
      if (pB != null) {
        const x1 = X(pB);
        g += `<circle cx="${x1.toFixed(1)}" cy="${y}" r="5.5" fill="${T.TK.surface}" stroke="${col}" stroke-width="2.4"/>`;
        g += `<text x="${(x1 - 9).toFixed(1)}" y="${y + 4}" text-anchor="end" font-size="10" fill="${T.TK.tick}">${Math.round(pB)}%</text>`;
        g += `<circle cx="${x1.toFixed(1)}" cy="${y}" r="9" fill="transparent" pointer-events="all" data-tip="<b>${md.name} &middot; ${label} &middot; batch=1</b><br>${b1} of ${nE} experts (${Math.round(pB)}%)"/>`;
      }
      if (pC != null) {
        const x2 = X(pC);
        g += `<circle cx="${x2.toFixed(1)}" cy="${y}" r="5.5" fill="${col}"/>`;
        g += `<text x="${(x2 + 9).toFixed(1)}" y="${y + 4}" text-anchor="start" font-size="10" font-weight="600" fill="${T.TK.ink}">${Math.round(pC)}%</text>`;
        g += `<circle cx="${x2.toFixed(1)}" cy="${y}" r="9" fill="transparent" pointer-events="all" data-tip="<b>${md.name} &middot; ${label} &middot; concurrent</b><br>${cc} of ${nE} experts (${Math.round(pC)}%)"/>`;
      }
      gy += rowH;
    });
    gy += gap;
  });
  g += `<text x="${m.l + pw / 2}" y="${H - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}">experts activated (% of total) &#8594;</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:720px">${g}</svg>`;
}

/**
 * Achieved decode bandwidth use per accelerator, against the datasheet ceiling.
 *
 * The point of the figure is the EMPTY part of each track, so the axis is pinned to 0-100 and the
 * unused span is drawn explicitly rather than left as background. Auto-scaling to the data would
 * make an 8% bar look full and destroy the whole reading.
 *
 * Median over the model's single-turn datasets and both engines, with the observed range as a
 * whisker — one degraded cell should widen the range, not move the bar.
 */
export function bandwidthSVG(rows) {
  if (!rows || !rows.length) return `<p style="color:${T.TK.tick};font-size:13px">No sparsity trace for this selection, so bandwidth use is not measured here.</p>`;
  const W = 720, rowH = 34, m = { l: 150, r: 76, t: 44, b: 46 };
  const H = m.t + rows.length * rowH + m.b;
  const pw = W - m.l - m.r;
  const X = (pct) => m.l + Math.max(0, Math.min(100, pct)) / 100 * pw;
  let g = '';
  [0, 25, 50, 75, 100].forEach((t) => {
    g += `<line x1="${X(t)}" y1="${m.t - 12}" x2="${X(t)}" y2="${H - m.b}" stroke="${T.TK.grid}" stroke-opacity="0.6"/>`;
    g += `<text x="${X(t)}" y="${H - m.b + 16}" text-anchor="middle" font-size="10.5" fill="${T.TK.tick}">${t}%</text>`;
  });
  g += `<text x="${X(100)}" y="${m.t - 20}" text-anchor="end" font-size="10.5" font-style="italic" fill="${T.TK.tick}">datasheet ceiling &#8594;</text>`;
  rows.forEach((r, i) => {
    const y = m.t + i * rowH, bh = 15, by = y + (rowH - bh) / 2, x = X(r.pct);
    // Dim and annotate flagged rows without dropping them.
    const dim = r.flagged ? 0.45 : 1;
    g += `<text x="${m.l - 12}" y="${by + bh - 3}" text-anchor="end" font-size="11" fill="${T.TK.ink}" fill-opacity="${dim}">${r.name}</text>`;
    if (r.flagged) g += `<text x="${m.l - 12}" y="${by + bh - 3}" text-anchor="start" font-size="10" fill="${T.TK.warn}">&#9888;</text>`;
    // unused span first, so the filled bar sits on top of it
    g += `<rect x="${x.toFixed(1)}" y="${by}" width="${(X(100) - x).toFixed(1)}" height="${bh}" fill="${T.TK.grid}" fill-opacity="0.55" rx="2"/>`;
    g += `<rect x="${m.l}" y="${by}" width="${(x - m.l).toFixed(1)}" height="${bh}" fill="${r.col || T.TK.fallback}" fill-opacity="${dim}" rx="2"/>`;
    if (r.hi - r.lo > 0.5) {
      const yc = by + bh / 2, a = X(r.lo), b = X(r.hi);
      g += `<line x1="${a.toFixed(1)}" y1="${yc}" x2="${b.toFixed(1)}" y2="${yc}" stroke="${T.TK.ink}" stroke-opacity="0.5"/>`;
      [a, b].forEach((cx) => { g += `<line x1="${cx.toFixed(1)}" y1="${yc - 4}" x2="${cx.toFixed(1)}" y2="${yc + 4}" stroke="${T.TK.ink}" stroke-opacity="0.5"/>`; });
    }
    g += `<text x="${X(100) + 8}" y="${by + bh - 3}" font-size="11" font-weight="700" fill="${T.TK.ink}" fill-opacity="${dim}">${r.pct.toFixed(0)}%</text>`;
    // Single quotes only inside data-tip — it is embedded in a double-quoted attribute.
    const range = r.hi - r.lo > 0.5 ? `<br>Range ${r.lo.toFixed(1)}-${r.hi.toFixed(1)}% over ${r.n} runs` : `<br>${r.n} run${r.n === 1 ? '' : 's'}`;
    const fw = r.flagged ? `<br>&#9888; ${r.flagged} of ${r.n} pooled run${r.n === 1 ? '' : 's'} carr${r.flagged === 1 ? 'ies' : 'y'} audit flags (${(r.flagCats || []).join(', ')}) — shown dimmed, not dropped` : '';
    g += `<rect x="${m.l}" y="${y}" width="${pw}" height="${rowH}" fill="transparent" pointer-events="all" data-tip="<b>${r.name}</b><br>Reads <b>${r.pct.toFixed(1)}%</b> of its memory bandwidth, leaving ${(100 - r.pct).toFixed(0)}% unused${range}${fw}${metaBlock(null, r.meta)}"/>`;
  });
  g += `<text x="${m.l + pw / 2}" y="${H - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}">decode memory-bandwidth use (% of datasheet peak) &#8594;</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:720px">${g}</svg>`;
}

// ---- MoE-CAP: CAP radar with labelled value axes (paper data, Research page) ----
// Unlike the dashboard radar (radarSVG, best-in-view = edge), this matches the paper's Fig 3: raw
// values on per-axis scales zoomed to the data and labelled with radial ticks, so exact per-system
// numbers are read off the axis rather than asserted in a tooltip (they are rounded reads).
// Convention, as in the paper: OUTWARD = BETTER on every axis. Axes flagged `invert` (cost, latency
// — lower is better) put the smallest value at the rim, so their tick labels descend outward.
export function capRadarSVG(systems, axes) {
  const W = 460, H = 384, cx = 230, cy = 182, R = 104, n = axes.length;
  const ang = (i) => -90 + i * 360 / n;
  const pt = (a, r) => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
  const scales = axes.map((_, i) => {
    const vs = systems.map((s) => s.v[i]); const mn = Math.min(...vs), mx = Math.max(...vs);
    const rg = (mx - mn) || Math.abs(mx) || 1; return { lo: Math.max(0, mn - rg * 0.35), hi: mx + rg * 0.25 };
  });
  const rad = (i, val) => { const s = scales[i], t = (val - s.lo) / (s.hi - s.lo); return R * Math.max(0, Math.min(1, axes[i].invert ? 1 - t : t)); };
  const tickVal = (i, f) => { const s = scales[i]; return axes[i].invert ? s.hi - f * (s.hi - s.lo) : s.lo + f * (s.hi - s.lo); };
  let g = '';
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    g += `<polygon points="${axes.map((_, i) => pt(ang(i), R * f).map((z) => z.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${T.TK.grid}"/>`;
  });
  axes.forEach((ax, i) => {
    const [x, y] = pt(ang(i), R);
    g += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${T.TK.grid}"/>`;
    const c = Math.cos(ang(i) * Math.PI / 180), anc = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
    const [lx, ly] = pt(ang(i), R + (anc === 'middle' ? 18 : 12));
    g += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anc}" font-size="11" font-weight="700" fill="${T.TK.sec}">${ax.label}</text>`;
    [0.25, 0.5, 0.75, 1].forEach((f) => {
      const [tx, ty] = pt(ang(i), R * f);
      g += `<text x="${(tx + (anc === 'end' ? -3 : 4)).toFixed(1)}" y="${(ty - 2).toFixed(1)}" text-anchor="${anc === 'end' ? 'end' : 'start'}" font-size="8.5" fill="${T.TK.tick}">${ax.fmt(tickVal(i, f))}</text>`;
    });
  });
  systems.forEach((s) => {
    const poly = axes.map((_, i) => pt(ang(i), rad(i, s.v[i])).map((z) => z.toFixed(1)).join(',')).join(' ');
    g += `<polygon points="${poly}" fill="${s.col}" fill-opacity="0.1" stroke="${s.col}" stroke-width="2.2"/>`;
    axes.forEach((_, i) => { const [vx, vy] = pt(ang(i), rad(i, s.v[i])); g += `<circle cx="${vx.toFixed(1)}" cy="${vy.toFixed(1)}" r="2.6" fill="${s.col}"/>`; });
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:460px">${g}</svg>`;
}

// ---- AgentCARD: cost vs accuracy per benchmark (paper data, Research page) ----
// Same idiom as the site's cross-model chart — log cost x, accuracy y, dashed Pareto frontier —
// so the paper figure reads in the site's style. Points are coloured AND shaped by team
// composition × deployment (secondary encoding for CVD safety). Static data from the AgentCARD paper.
export const AGENT_KIND = {
  homo: { col: '#06A77D', glyph: '●', label: 'Homogeneous · API' },
  het:  { col: '#D7263D', glyph: '◆', label: 'Heterogeneous · API' },
  hyb:  { col: '#118AB2', glyph: '■', label: 'Heterogeneous · Hybrid' },
};
export function agentScatterSVG(points) {
  const pts = (points || []).filter((p) => p.c > 0 && p.a > 0);
  const W = 660, H = 420, m = { l: 58, r: 18, t: 18, b: 52 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  if (!pts.length) return `<p style="color:${T.TK.tick};font-size:13px">No data.</p>`;
  const cmin = Math.min(...pts.map((p) => p.c)) * 0.6, cmax = Math.max(...pts.map((p) => p.c)) * 1.8;
  const a0 = Math.min(...pts.map((p) => p.a)), a1 = Math.max(...pts.map((p) => p.a));
  const apad = (a1 - a0) * 0.12 || 5, amin = Math.max(0, a0 - apad), amax = Math.min(100, a1 + apad);
  const X = (c) => m.l + (Math.log10(c) - Math.log10(cmin)) / (Math.log10(cmax) - Math.log10(cmin)) * pw;
  const Y = (a) => m.t + ph - (a - amin) / (amax - amin) * ph;
  let g = '';
  for (let e = Math.floor(Math.log10(cmin)); e <= Math.ceil(Math.log10(cmax)); e++) {
    const t = Math.pow(10, e); if (t < cmin || t > cmax) continue; const x = X(t);
    g += `<line x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + ph}" stroke="${T.TK.grid}" stroke-opacity="0.4"/>`;
    g += `<text x="${x}" y="${m.t + ph + 16}" text-anchor="middle" font-size="10.5" fill="${T.TK.tick}">$${t < 0.01 ? t.toFixed(3) : t < 1 ? t.toFixed(2) : t}</text>`;
  }
  for (let i = 0; i <= 4; i++) { const a = amin + (amax - amin) * i / 4, y = Y(a);
    g += `<line x1="${m.l}" y1="${y}" x2="${m.l + pw}" y2="${y}" stroke="${T.TK.grid}" stroke-opacity="0.4"/>`;
    g += `<text x="${m.l - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="${T.TK.tick}">${Math.round(a)}%</text>`; }
  // Pareto frontier: lower cost + higher accuracy is better. Step line (post).
  const front = []; let mx = -Infinity;
  [...pts].sort((a, b) => a.c - b.c || b.a - a.a).forEach((p) => { if (p.a > mx) { front.push(p); mx = p.a; } });
  if (front.length >= 2) {
    let d = `M ${X(front[0].c).toFixed(1)} ${Y(front[0].a).toFixed(1)}`;
    for (let i = 1; i < front.length; i++) d += ` L ${X(front[i].c).toFixed(1)} ${Y(front[i - 1].a).toFixed(1)} L ${X(front[i].c).toFixed(1)} ${Y(front[i].a).toFixed(1)}`;
    g += `<path d="${d}" fill="none" stroke="${T.TK.hair}" stroke-width="1.4" stroke-dasharray="6 4"/>`;
  }
  const lbl = (p) => (p.k === 'homo' ? `${p.p} self-play` : `${p.p}&#8594;${p.e}`);
  pts.forEach((p) => { const x = X(p.c), y = Y(p.a), col = AGENT_KIND[p.k].col, s = 4.8;
    if (p.k === 'homo') g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${col}" fill-opacity="0.9" stroke="${T.TK.surface}" stroke-width="1"/>`;
    else if (p.k === 'het') g += `<path d="M ${x.toFixed(1)} ${(y - s).toFixed(1)} L ${(x + s).toFixed(1)} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y + s).toFixed(1)} L ${(x - s).toFixed(1)} ${y.toFixed(1)} Z" fill="${col}" fill-opacity="0.9" stroke="${T.TK.surface}" stroke-width="1"/>`;
    else g += `<rect x="${(x - s + 0.5).toFixed(1)}" y="${(y - s + 0.5).toFixed(1)}" width="${2 * s - 1}" height="${2 * s - 1}" fill="${col}" fill-opacity="0.9" stroke="${T.TK.surface}" stroke-width="1"/>`;
    const tip = `<b>${lbl(p)}</b><br>accuracy: ${p.a}%<br>cost: $${p.c}/task<br>${AGENT_KIND[p.k].label}`;
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="transparent" pointer-events="all" data-tip="${tip}"/>`; });
  g += `<text x="${m.l + pw / 2}" y="${H - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}">cost per task (USD, log) — lower better &#8592;</text>`;
  g += `<text x="16" y="${m.t + ph / 2}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}" transform="rotate(-90,16,${m.t + ph / 2})">accuracy (%) &#8594;</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:660px">${g}</svg>`;
}

// ---- Fig 4: fixed-length vs natural-length (grouped bars per dataset) ----
// One bar cluster per group passed in. The caller filters to a single (model, engine, hardware),
// so groups are one-per-dataset. Drawing every group rather than one per unique dataset means a
// wider selection shows up as extra clusters instead of being silently dropped.

const F4METRICS = { tps: 'Decode token/s', tps_p: 'Prefill token/s', ttft: 'TTFT (ms)' };
export function fig4SVG(groups, mk) {
  if (!groups.length) return `<p style="color:${T.TK.tick};font-size:13px">No fixed-length runs in the data yet.</p>`;
  const labels = ['natural', ...new Set(groups.flatMap((g) => g.variants.map((v) => v.label)).filter((l) => l !== 'natural'))];
  const sc = mk === 'ttft' ? 1000 : 1;  // ttft stored in s, shown in ms
  // The prefill rate renders through the fail-closed basis decoder: a variant whose
  // figs snapshot lacks the basis label is unavailable here, never an unlabelled bar.
  const val = (v) => {
    if (mk === 'tps_p') { const lv = prefillRate(v); return lv ? lv.value : null; }
    return v[mk] == null ? null : v[mk] * sc;
  };
  const isEst = (v) => mk === 'tps_p' && v.tps_p_basis === 'estimated';
  const W = 720, H = 340, m = { l: 66, r: 16, t: 18, b: 64 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  let maxY = 0;
  groups.forEach((g) => g.variants.forEach((v) => { if (val(v) != null) maxY = Math.max(maxY, val(v)); }));
  if (maxY <= 0) maxY = 1;
  const Y = (v) => m.t + ph - (v / maxY) * ph; let g = '';
  for (let i = 0; i <= 4; i++) { const yv = maxY * i / 4; g += `<line x1="${m.l}" y1="${Y(yv)}" x2="${m.l + pw}" y2="${Y(yv)}" stroke="${T.TK.grid}" stroke-opacity="0.4"/><text x="${m.l - 8}" y="${Y(yv) + 4}" text-anchor="end" font-size="10.5" fill="${T.TK.tick}">${yv >= 100 ? Math.round(yv) : yv.toFixed(1)}</text>`; }
  const gw = pw / groups.length, bw = Math.min(34, (gw - 24) / labels.length);
  groups.forEach((grp, di) => {
    const ds = grp.ds;
    const x0 = m.l + di * gw + (gw - bw * labels.length) / 2;
    labels.forEach((lab, li) => {
      const v = grp.variants.find((z) => z.label === lab); const vv = v && val(v); if (vv == null) return;
      const x = x0 + li * bw, y = Y(vv), col = T.F4COL[lab] || `${T.TK.fallback}`, disp = vv >= 100 ? Math.round(vv) : Math.round(vv * 10) / 10;
      const est = isEst(v);
      const tip = `<b>${ds} · ${lab}</b><br>${F4METRICS[mk]}: ${disp}${est ? ' (estimated — no exact trace. See Methods)' : ''}${lab === 'natural' ? '<br>(natural dataset lengths)' : '<br>(forced input/output length)'}${metaBlock(v)}`;
      // Estimated bars carry a dashed outline plus an 'est.' mark, so an estimate never
      // reads as a measurement even before hover.
      g += `<rect x="${x + 1.5}" y="${y}" width="${bw - 3}" height="${m.t + ph - y}" fill="${col}" fill-opacity="0.9" rx="2" ${est ? `stroke="${T.TK.ink}" stroke-opacity="0.55" stroke-dasharray="3 2" ` : ''}pointer-events="all" data-tip="${tip}"/>`;
      g += `<text x="${x + bw / 2}" y="${y - 4}" text-anchor="middle" font-size="8.5" fill="${T.TK.sec}">${disp}${est ? `<tspan font-size="7" font-style="italic"> est.</tspan>` : ''}</text>`;
    });
    g += `<text x="${m.l + di * gw + gw / 2}" y="${m.t + ph + 18}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${T.TK.ink}">${ds}</text>`;
  });
  labels.forEach((lab, li) => {
    const lx = m.l + 10 + li * 150;
    g += `<rect x="${lx}" y="${H - 22}" width="10" height="10" fill="${T.F4COL[lab] || `${T.TK.fallback}`}" rx="2"/><text x="${lx + 14}" y="${H - 13}" font-size="10.5" fill="${T.TK.sec}">${lab}</text>`;
  });
  g += `<text x="16" y="${m.t + ph / 2}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}" transform="rotate(-90,16,${m.t + ph / 2})">${F4METRICS[mk]} →</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:720px">${g}</svg>`;
}

// Measured Hardware Map: one MODEL, one point per HARDWARE, both axes measured from db.json.
// Colour = GPU. Both axes start at 0. Linked panels can pass the same X ceiling so a card stays on
// one vertical line in both views. Labels greedily dodge so they stack, not overlap.
// pts: [{ name, short, col, x, y, sub, note }]. xm/ym: { label, unit, better, fmt }.
export function hwScatterSVG(pts, xm, ym, { xMax = null } = {}) {
  const W = 720, H = 380, m = { l: 66, r: 22, t: 20, b: 54 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const xmax = xMax || Math.max(1e-9, ...pts.map((p) => p.x)) * 1.15;
  const ymax = Math.max(1e-9, ...pts.map((p) => p.y)) * 1.15;
  const X = (v) => m.l + (v / xmax) * pw;
  const Y = (v) => m.t + ph - (v / ymax) * ph;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const yv = (ymax / 4) * i, y = Y(yv);
    g += `<line x1="${m.l}" y1="${y}" x2="${m.l + pw}" y2="${y}" stroke="${T.TK.grid}" stroke-opacity="${i === 0 ? 0.7 : 0.22}"/>`;
    g += `<text x="${m.l - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="${T.TK.tick}">${ym.fmt(yv)}</text>`;
    const xv = (xmax / 4) * i, x = X(xv);
    g += `<line x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + ph}" stroke="${T.TK.grid}" stroke-opacity="${i === 0 ? 0.7 : 0.22}"/>`;
    g += `<text x="${x}" y="${m.t + ph + 16}" text-anchor="middle" font-size="10.5" fill="${T.TK.tick}">${xm.fmt(xv)}</text>`;
  }
  const P = pts.map((p) => ({ ...p, sx: X(p.x), sy: Y(p.y) }));
  // Label de-confliction: each 2-line label is a box (~LW wide, 25px tall). For every point, try
  // candidate offsets around it — near first, then fanning out (up/down into empty space, then
  // sideways) — and take the first that fits inside the plot AND overlaps no already-placed label
  // and no point marker. A leader line connects the point to an offset label. This spreads a dense
  // cluster (e.g. GPT-OSS / Arena-Hard / SGLang: 6 points stacked in a thin band) into the empty
  // area above/around it instead of piling the labels on top of each other.
  const LW = 78, Ltop = 9, Lbot = 16;  // label box: width, extent above/below the y anchor
  const boxOf = (lx, ly, anc) => ({ x1: anc === 'end' ? lx - LW : lx - 3, x2: anc === 'end' ? lx + 3 : lx + LW, y1: ly - Ltop, y2: ly + Lbot });
  const inBox = (b) => b.x1 >= m.l && b.x2 <= m.l + pw && b.y1 >= m.t && b.y2 <= m.t + ph;
  const hit = (a, b) => !(a.x2 < b.x1 || b.x2 < a.x1 || a.y2 < b.y1 || b.y2 < a.y1);
  const marks = P.map((p) => ({ x1: p.sx - 8, x2: p.sx + 8, y1: p.sy - 8, y2: p.sy + 8 }));
  // Candidate offsets [dx, dy, anchor], ordered near→far. Up and down at growing distance so labels
  // escape into whichever side has room.
  const cands = [[12, -6, 'start'], [-12, -6, 'end']];
  for (const d of [18, 32, 48, 66, 88, 114, 144, 178]) { cands.push([13, -d, 'start'], [-13, -d, 'end'], [13, d, 'start'], [-13, d, 'end']); }
  for (const dx of [30, 58, 90]) cands.push([dx, -6, 'start'], [-dx, -6, 'end']);
  const placed = [];
  P.slice().sort((a, b) => a.sy - b.sy || a.sx - b.sx).forEach((p) => {
    let ch = null;
    for (const [dx, dy, anc] of cands) {
      const lx = p.sx + dx, ly = p.sy + dy, box = boxOf(lx, ly, anc);
      if (!inBox(box)) continue;
      if (placed.some((q) => hit(box, q))) continue;
      if (marks.some((mk) => mk !== marks[P.indexOf(p)] && hit(box, mk))) continue;  // don't cover other dots
      ch = { lx, ly, anc }; break;
    }
    if (!ch) { const lx = p.sx + 12, ly = Math.max(m.t + Ltop, Math.min(p.sy - 6, m.t + ph - Lbot)); ch = { lx, ly, anc: 'start' }; }
    placed.push(boxOf(ch.lx, ch.ly, ch.anc));
    p._lx = ch.lx; p._ly = ch.ly; p._anc = ch.anc;
  });
  P.forEach((p) => {
    g += `<circle cx="${p.sx}" cy="${p.sy}" r="7" fill="${p.col}" stroke="${T.TK.surface}" stroke-width="2"/>`;
    // Leader line from the dot to the label's inner edge when the label sits away from the point.
    const ax = p._anc === 'end' ? p._lx + 3 : p._lx - 3;
    if (Math.hypot(ax - p.sx, p._ly + 3 - p.sy) > 16) g += `<line x1="${p.sx}" y1="${p.sy}" x2="${ax}" y2="${p._ly + 3}" stroke="${p.col}" stroke-opacity="0.4" stroke-width="1"/>`;
    // 2-line label: manufacturer (small, dim) over model + node count (bold).
    g += `<text x="${p._lx}" y="${p._ly}" text-anchor="${p._anc}" fill="${T.TK.ink}">`
      + (p.manufacturer ? `<tspan font-size="9" font-weight="600" fill="${T.TK.tick}">${p.manufacturer}</tspan>` : '')
      + `<tspan x="${p._lx}" dy="${p.manufacturer ? 12 : 0}" font-size="11.5" font-weight="700">${p.model || p.name}${p.sub ? ` <tspan font-size="9.5" font-weight="600" fill="${T.TK.tick}">${p.sub}</tspan>` : ''}</tspan></text>`;
    // Selected measurements first, then the operating point, then the run's own provenance
    // (precision, checkpoint, engine version) dimmed as context.
    // Single quotes only: this goes inside a double-quoted data-tip attribute.
    const details = (p.details && p.details.length)
      ? `<div style='margin-top:5px'><b>Operating point</b><br>${p.details.map((d) => `${d.label}: ${d.value}`).join('<br>')}</div>` : '';
    const meta = (p.meta && p.meta.length)
      ? `<div style='margin-top:5px;opacity:0.7;font-size:11px'>${p.meta.join('<br>')}</div>` : '';
    const tip = `<b>${p.name}</b><br>${ym.label}: ${uval(ym.fmt, p.y, ym.unit)}<br>${xm.label}: ${uval(xm.fmt, p.x, xm.unit)}${details}${meta}`;
    g += `<circle cx="${p.sx}" cy="${p.sy}" r="13" fill="transparent" pointer-events="all" data-tip="${tip}"/>`;
  });
  const direction = (m) => m.better === 'low' ? 'lower better ←'
    : m.better === 'high' ? 'higher better →' : 'operating point';
  // Y is rotated -90°, so a horizontal ←/→ glyph renders as a vertical down/up arrow pointing at
  // "better" (down for lower-better, up for higher-better). Neutral context axes carry no arrow.
  g += `<text x="16" y="${m.t + ph / 2}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}" transform="rotate(-90,16,${m.t + ph / 2})">${ym.label} (${ym.unit}) · ${direction(ym)}</text>`;
  g += `<text x="${m.l + pw / 2}" y="${H - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}">${xm.label} (${xm.unit}) · ${direction(xm)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:720px">${g}</svg>`;
}

// ---- Cross-model: cost vs accuracy, bubble size = decode throughput ----
// Colour encodes the *card* each point came from, not the model: hardware is not held constant
// here (each model sits on its own cheapest card), so making the card visible is the honest
// encoding. Model identity comes from the direct label on every point, so identity is never
// carried by colour alone. No new hues — this reuses the validated six-accelerator palette.
//
// Y is pinned to 0–100%, matching the accuracy card. A saturated workload (GSM8K: all four models
// within 0.4 pts) therefore renders as a flat row, which is the finding rather than a defect.
export function crossModelSVG(pts, xm) {
  if (!pts.length) return `<p style="color:${T.TK.tick};font-size:13px">No model covers this selection.</p>`;
  const W = 720, H = 400, m = { l: 62, r: 26, t: 20, b: 56 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const xmax = Math.max(1e-9, ...pts.map((p) => p.x)) * 1.18;
  const X = (v) => m.l + (v / xmax) * pw;
  const Y = (v) => m.t + ph - (v / 100) * ph;
  // Uniform marks (throughput is in the tooltip, not encoded as size).
  const R = () => 8;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const yv = 25 * i, y = Y(yv);
    g += `<line x1="${m.l}" y1="${y}" x2="${m.l + pw}" y2="${y}" stroke="${T.TK.grid}" stroke-opacity="${i === 0 ? 0.7 : 0.22}"/>`;
    g += `<text x="${m.l - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="${T.TK.tick}">${yv}%</text>`;
    const xv = (xmax / 4) * i, x = X(xv);
    g += `<line x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + ph}" stroke="${T.TK.grid}" stroke-opacity="${i === 0 ? 0.7 : 0.22}"/>`;
    g += `<text x="${x}" y="${m.t + ph + 16}" text-anchor="middle" font-size="10.5" fill="${T.TK.tick}">${xm.fmt(xv)}</text>`;
  }
  const P = pts.map((p) => ({ ...p, sx: X(p.x), sy: Y(p.y), r: R(p.tps), col: T.GCOL[p.gpu] || T.TK.fallback }));
  // Error bars = the 95% sampling interval (Wilson) on the plotted accuracy. Drawn first, so marks
  // sit on top. Overlap is descriptive and is not treated as a hypothesis test.
  P.forEach((p) => {
    if (p.cLo == null || p.cHi == null || p.cHi - p.cLo < 0.5) return;
    const y1 = Y(p.cHi), y2 = Y(p.cLo);
    g += `<line x1="${p.sx}" y1="${y1}" x2="${p.sx}" y2="${y2}" stroke="${p.col}" stroke-opacity="0.55" stroke-width="1.5"/>`;
    [y1, y2].forEach((y) => { g += `<line x1="${p.sx - 4}" y1="${y}" x2="${p.sx + 4}" y2="${y}" stroke="${p.col}" stroke-opacity="0.55" stroke-width="1.5"/>`; });
  });
  // Label placement. A saturated workload puts every model on nearly the same accuracy, so the
  // labels arrive at one height and must be stacked. Collision is tested on each label's real
  // x-extent — estimated from its text — because a fixed-width assumption lets long names such as
  // 'DeepSeek-R1 671B on MI355X' overlap the neighbour to their right.
  const wOf = (p) => p.name.length * 6.4 + (` on ${p.gpuName}`).length * 5.0 + 6;
  const hits = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  // Seed with the marks themselves: on a saturated workload the bubbles cluster, and a label that
  // only dodges other labels will still land on top of a neighbouring circle.
  const occupied = P.map((p) => ({ x0: p.sx - p.r - 2, x1: p.sx + p.r + 2, y0: p.sy - p.r - 2, y1: p.sy + p.r + 2 }));
  P.slice().sort((a, b) => a.sy - b.sy || a.sx - b.sx).forEach((p) => {
    const w = wOf(p);
    const left = p.sx + p.r + 5 + w > m.l + pw;  // would overrun the plot: flip to the left side
    const lx = left ? p.sx - p.r - 5 : p.sx + p.r + 5;
    const x0 = left ? lx - w : lx, x1 = left ? lx : lx + w;
    let ly = p.sy - 4;
    for (let i = 0; i < 8 && occupied.some((q) => hits({ x0, x1, y0: ly - 9, y1: ly + 3 }, q)); i++) ly += 14;
    occupied.push({ x0, x1, y0: ly - 9, y1: ly + 3 });
    p._lx = lx; p._ly = ly; p._anc = left ? 'end' : 'start';
  });
  P.forEach((p) => {
    g += `<circle cx="${p.sx}" cy="${p.sy}" r="${p.r}" fill="${p.col}" fill-opacity="0.85" stroke="${T.TK.surface}" stroke-width="2"/>`;
    g += `<text x="${p._lx}" y="${p._ly}" text-anchor="${p._anc}" font-size="11.5" font-weight="700" fill="${T.TK.ink}">${p.name} <tspan font-size="9.5" font-weight="600" fill="${T.TK.tick}">on ${p.gpuName}</tspan></text>`;
    // Single quotes only inside the tooltip — it is embedded in a double-quoted data-tip attribute.
    const spread = p.accMax - p.accMin >= 0.5
      ? `<br>across ${p.nHw} accelerators: ${p.accMin.toFixed(1)}–${p.accMax.toFixed(1)}%` : '';
    const meta = (p.meta && p.meta.length)
      ? `<div style='margin-top:5px;opacity:0.7;font-size:11px'>${p.meta.join('<br>')}</div>` : '';
    const ci = (p.cLo != null && p.cHi != null) ? ` (95% CI ${p.cLo.toFixed(1)}–${p.cHi.toFixed(1)}, n=${p.nq})` : '';
    const tip = `<b>${p.name}</b> on ${p.gpuName}<br>accuracy: ${p.y.toFixed(1)}%${ci}${spread}`
      + `<br>${xm.label}: ${uval(xm.fmt, p.x, xm.unit)}<br>decode: ${p.tps != null ? p.tps.toFixed(0) : '—'} tok/s${meta}`;
    g += `<circle cx="${p.sx}" cy="${p.sy}" r="${p.r + 6}" fill="transparent" pointer-events="all" data-tip="${tip}"/>`;
  });
  g += `<text x="16" y="${m.t + ph / 2}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}" transform="rotate(-90,16,${m.t + ph / 2})">accuracy (%) — higher better</text>`;
  g += `<text x="${m.l + pw / 2}" y="${H - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}">${xm.label} (${xm.unit}) — lower better ←</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:720px">${g}</svg>`;
}

// ---- Engine-version contrast: Δaccuracy vs Δthroughput, one point per matched pair ----
// Both axes are RELATIVE deltas (newer build vs older, same configuration), so a raw linear scale
// would be swamped by the few very large moves. Symmetric-log keeps 0 at the origin, spreads the
// 2-10% region where most pairs sit, and still shows a -100% or +250% outlier in place.
// Shaded bands mark the accuracy gate and the throughput-only blind spot.
// theme.js has no semantic warn/pass tokens. These two read acceptably in both modes and match
// the amber-selection / teal-label palette used across the site.
// ---- measurement variation -------------------------------------------------------------
// Both axes are the SAME quantity on two metrics: the typical disagreement between two
// measurements of one cell, as a percentage. Unsigned as emitted -- between two runs of one
// build neither is "before", and between two builds the study records only the size of the
// move. Nothing here can say a newer build ran faster. The origin is a perfectly reproducible
// cell, and distance from it is how much a number moves for reasons that are not the hardware.
const VAR_VERSION = '#d97706', VAR_REPLICATION = '#0d9488';
// The study computes |a-b| / mean(a,b), which saturates at 2.0 and so compresses badly above
// roughly 40%: 1.37x and 5.19x both read as "over a hundred per cent". Inverting it is exact,
// and a ratio is what a reader can act on.
export const varRatio = (d) => (2 + d) / (2 - d);
const VRATIO = (d) => (d >= 2 ? '&infin;' : `${varRatio(d).toFixed(2)}×`);
// Accuracy travels in POINTS. Every other metric here is a duration, where a relative
// difference is the natural reading. A score is already a fraction, so a relative change on it
// invites being read as points when it is a percentage of a percentage.
const VPTS = (v) => `${v.toFixed(v >= 10 ? 0 : 1)} pts`;
const vlog = (v) => Math.log10(1 + v / 0.005);       // 0.5% reads as one unit
const vlogp = (v) => Math.log10(1 + v / 0.25);       // a quarter-point reads as one unit
const VAR_LABEL = { e2e_s: 'end-to-end time', ttft: 'time to first token', tpot: 'time per output token' };

export function variationSVG(points, metric, arm, dualArm, tree, lowerBetter) {
  const dual = new Set((dualArm || []).map((c) => c.join('/')));
  // Never pool the workload classes: first-token and per-token time are different quantities
  // across them, so one cloud over both is a picture of no workload in particular.
  const both = (points || []).filter((p) => (!tree || p.coordinate[0] === tree)
    && p.typical && p.typical[metric] !== undefined
    && p.typical_points && p.typical_points.acc !== undefined);
  const rows = both.filter((p) => p.arm === arm);
  if (!rows.length) return `<p style="color:${T.TK.tick};font-size:13px">No comparisons carry both axes for this selection.</p>`;
  const W = 680, H = 440, m = { l: 66, r: 20, t: 16, b: 58 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  // Scaled over both kinds of repeat, not over the one on screen: build changes spread wider than
  // re-runs, and an axis refitted per selection would redraw that difference as the same cloud
  // twice. Switching the control has to move the points, not the grid under them.
  const xmax = Math.max(0.02, ...both.map((p) => p.typical[metric]));
  const ymax = Math.max(1, ...both.map((p) => p.typical_points.acc));
  const X = (v) => m.l + (vlog(v) / vlog(xmax * 1.08)) * pw;
  const Y = (v) => m.t + ph - (vlogp(v) / vlogp(ymax * 1.08)) * ph;
  // no background rect: the card supplies it, as every other chart here assumes
  let g = `<rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="${T.TK.grid}"/>`;
  const ticks = [0, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1].filter((t) => t <= xmax * 1.08);
  ticks.forEach((t) => {
    const x = X(t);
    g += `<line x1="${x.toFixed(1)}" y1="${m.t}" x2="${x.toFixed(1)}" y2="${m.t + ph}" stroke="${T.TK.grid}" stroke-dasharray="2,3"/>`;
    g += `<text x="${x.toFixed(1)}" y="${m.t + ph + 15}" text-anchor="middle" font-size="10" fill="${T.TK.tick}">${VRATIO(t)}</text>`;
  });
  const yticks = [0, 0.5, 1, 2, 5, 10, 25, 50].filter((t) => t <= ymax * 1.08);
  yticks.forEach((t) => {
    const y = Y(t);
    g += `<line x1="${m.l}" y1="${y.toFixed(1)}" x2="${m.l + pw}" y2="${y.toFixed(1)}" stroke="${T.TK.grid}" stroke-dasharray="2,3"/>`;
    g += `<text x="${m.l - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="${T.TK.tick}">${VPTS(t)}</text>`;
  });
  const ink = arm === 'version' ? VAR_VERSION : VAR_REPLICATION;
  rows.forEach((p) => {
    const [, engine, model, dataset, gpu, batch] = p.coordinate;
    const x = X(p.typical[metric]), y = Y(p.typical_points.acc);
    const isDual = dual.has(p.coordinate.join('/'));
    // a cell measured BOTH ways is the only one whose build delta can be read against its own
    // repeat measurements, so it is marked rather than left indistinguishable
    g += isDual
      ? `<rect x="${(x - 4.5).toFixed(1)}" y="${(y - 4.5).toFixed(1)}" width="9" height="9" fill="${ink}" fill-opacity="0.75" stroke="${T.TK.ink}" stroke-width="1.1"/>`
      : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${ink}" fill-opacity="0.6" stroke="${ink}"/>`;
    // Which two builds a version point compared is the first thing a reader asks of it, and
    // which way the number moved is the second. Both are shown where the study emits them and
    // named as missing where it does not: a study that carries only magnitudes still plots.
    const builds = Array.isArray(p.builds) ? p.builds : [];
    const newer = builds.length > 1 ? builds[builds.length - 1] : null;
    const pairLine = arm !== 'version'
      ? `<br>same build${builds.length === 1 ? ` (<b>${builds[0]}</b>)` : ''}, run twice`
      : builds.length > 1
        ? `<br>builds: <b>${builds.join('</b> &rarr; <b>')}</b>`
        : `<br><span style='opacity:0.7'>which builds: not recorded in the study</span>`;
    // Magnitude always comes from the same figure that positioned the point, so the tooltip can
    // never disagree with the axis. Only the DIRECTION is read off the signed median.
    const sgnPerf = (p.typical_signed || {})[metric];
    const sgnAcc = (p.typical_points_signed || {}).acc;
    // "3.88x apart" where the study gives only a magnitude. "3.88x slower on 0.23.1" where it
    // gives a direction. Never both — the two readings of one number stack into nonsense.
    const dirn = (s, mag, hi, lo) => (typeof s !== 'number' || s === 0
      ? `<b>${mag}</b> apart`
      : `<b>${mag} ${s > 0 ? hi : lo}</b> on ${newer || 'the newer build'}`);
    const perfWord = lowerBetter && lowerBetter[metric] === false ? ['higher', 'lower'] : ['slower', 'faster'];
    const tip = `<b>${model} &middot; ${dataset.replace(/_\d+samples$/, '')}</b><br>${FWLABEL[engine] || engine} &middot; ${gpu} &middot; ${batch.replace('batch-size-', '')}${pairLine}`
      + `<br>${VAR_LABEL[metric] || metric}: ${dirn(sgnPerf, VRATIO(p.typical[metric]), perfWord[0], perfWord[1])}`
      + `<br>accuracy: ${dirn(sgnAcc, VPTS(p.typical_points.acc), 'higher', 'lower')}`
      + `<br><span style='opacity:0.7'>${p.pairs} comparison${p.pairs === 1 ? '' : 's'}`
      // Only where a direction could have existed. On a re-run there is no earlier measurement to
      // move away from, so silence there is the design, not a gap in the record.
      + `${arm === 'version' && sgnPerf === undefined && sgnAcc === undefined ? ' &middot; builds could not be ordered, so no direction' : ''}`
      + `${isDual ? ' &middot; also measured the other way' : ''}</span>`;
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="transparent" pointer-events="all" data-tip="${tip}"/>`;
  });
  g += `<text x="${m.l + pw / 2}" y="${H - 16}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}">how far the two measurements land apart, on ${VAR_LABEL[metric] || metric}</text>`;
  g += `<text x="15" y="${m.t + ph / 2}" text-anchor="middle" font-size="12" font-weight="700" fill="${T.TK.ink}" transform="rotate(-90,15,${m.t + ph / 2})">how far accuracy moves, in points</text>`;
  g += `<text x="${m.l + 8}" y="${m.t + 14}" font-size="10" fill="${T.TK.tick}">near the origin = reproducible</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:680px">${g}</svg>`;
}

// ---- controlled engine-build study ----------------------------------------------------
// Schema v3 supplies a metric registry and generic summaries. The chart therefore does not know
// which metric is "primary": it renders the selected metric on its declared additive or ratio
// scale and retains every raw paired effect behind the estimate.
const cvEsc = (v) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const cvScale = (metric) => /add|difference|point/i.test(String(metric?.effect_scale || metric?.scale || metric?.analysis || '')) ? 'additive' : 'ratio';
const cvEstimate = (row) => {
  if (Number.isFinite(row?.estimate)) return row.estimate;
  if (row?.estimate && typeof row.estimate === 'object') for (const key of ['value', 'ratio', 'difference', 'difference_points']) if (Number.isFinite(row.estimate[key])) return row.estimate[key];
  for (const key of ['ratio_estimate', 'mean_difference', 'mean_difference_points', 'difference', 'effect']) if (Number.isFinite(row?.[key])) return row[key];
  return null;
};
const cvInterval = (row) => row?.estimate?.ci95 || row?.estimate?.ci95_points || row?.ci95 || row?.ci95_points || row?.interval || {};
const cvNumber = (value) => !Number.isFinite(value) ? 'not available' : value.toFixed(Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : Math.abs(value) >= 1 ? 2 : 3);
const cvEffectUnit = (metric) => /point/i.test(String(metric?.effect_scale || '')) ? 'pp' : (metric?.effect_unit || metric?.unit || '');
const cvEffect = (value, metric) => cvScale(metric) === 'additive' ? `${value >= 0 ? '+' : ''}${cvNumber(value)}${cvEffectUnit(metric) ? ` ${cvEffectUnit(metric)}` : ''}` : `${value < 0.1 ? value.toFixed(3) : value.toFixed(value >= 10 ? 1 : 2)}×`;
const cvDataset = (dataset) => String(dataset || '').replace(/_256samples$/, '').replaceAll('_', '-');
const cvMetricLabel = (metric, id) => metric?.label || String(id).replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
const cvFamilyGroup = (family) => {
  if (family === 'quality') return 'quality';
  if (family === 'user-latency') return 'user latency';
  if (['service-capacity', 'delivered-work', 'decode-capacity', 'prefill-capacity'].includes(family)) return 'throughput and capacity';
  if (['decode-mechanics', 'prefill-mechanics', 'scheduler'].includes(family)) return 'batching and step timing';
  if (['workload-response', 'workload-input', 'prefill-physical-work', 'prefill-work-shape'].includes(family)) return 'tokens and prefill work';
  if (family === 'expert-routing') return 'routing';
  if (family === 'lifecycle') return 'setup and job timing';
  return String(family || 'other').replaceAll('-', ' ');
};
const cvHardware = (hardware) => hardware === 'a100x2' ? '2 A100 GPUs' : hardware === 'h100x2' ? '2 H100 GPUs' : hardware;
const cvAvailability = (value) => /^sglang[-_ ]only$/i.test(String(value || '')) ? 'recorded only by SGLang' : String(value || '').replaceAll('_', ' ');
const cvPolarity = (metric) => ['higher', 'lower'].includes(metric?.polarity) ? metric.polarity : 'neutral';
const cvPolarityCue = (metric) => cvPolarity(metric) === 'higher' ? '↑' : cvPolarity(metric) === 'lower' ? '↓' : '—';
const cvPolarityLabel = (metric) => cvPolarity(metric) === 'higher' ? 'higher is better' : cvPolarity(metric) === 'lower' ? 'lower is better' : 'descriptive, with neither direction inherently better';
const cvRatioTick = (exponent) => {
  const value = 2 ** exponent;
  if (Math.abs(exponent) < 1e-9) return '1×';
  return `${value < 0.1 ? value.toFixed(3) : value < 1 ? value.toFixed(2) : value >= 10 ? value.toFixed(1) : value.toFixed(2)}×`;
};

// Dense overview for schema v3: all analytic metrics share one effect fingerprint, while the
// additive quality row stays on its own percentage-point scale. Missing engine-specific metrics
// remain visible as unavailable rows instead of acquiring a zero-valued mark.
export function controlledMetricFingerprintSVG(study, engine, dataset, hardware = 'both') {
  const registry = study?.metric_registry || {}, declared = Array.isArray(study?.metric_order) ? study.metric_order : [];
  const metricIds = [...declared.filter((id) => registry[id]), ...Object.keys(registry).filter((id) => !declared.includes(id))].filter((id) => registry[id]?.effect_scale !== 'exact_alias' && !registry[id]?.alias_of);
  const effects = (study?.summaries?.build_effects || study?.build_effects || []).filter((row) => row.engine === engine && row.dataset === dataset);
  if (!metricIds.length) return `<p style="color:${T.TK.tick};font-size:13px">No measured old/new comparison is available in this study.</p>`;
  const shownHardware = hardware === 'a100x2' || hardware === 'h100x2' ? [hardware] : ['a100x2', 'h100x2'];
  const byCell = new Map(effects.filter((row) => shownHardware.includes(row.hardware)).map((row) => [`${row.metric_id}/${row.hardware}`, row]));
  const ratioIds = metricIds.filter((id) => cvScale(registry[id]) === 'ratio');
  const additiveIds = metricIds.filter((id) => cvScale(registry[id]) === 'additive');
  const groups = [];
  ratioIds.forEach((id) => { const family = cvFamilyGroup(registry[id]?.family || registry[id]?.group); let group = groups.find((entry) => entry.family === family); if (!group) { group = { family, ids: [] }; groups.push(group); } group.ids.push(id); });
  const ratioValues = effects.filter((row) => ratioIds.includes(row.metric_id)).flatMap((row) => { const ci = cvInterval(row); return [cvEstimate(row), ci.low, ci.high]; }).filter((value) => Number.isFinite(value) && value > 0).map(Math.log2);
  const rawRatioExtent = ratioValues.length ? Math.max(...ratioValues.map(Math.abs)) : 1;
  const ratioStep = [0.25, 0.5, 1, 2, 4, 8].find((step) => step >= rawRatioExtent / 3) || 16;
  const ratioExtent = Math.max(ratioStep, Math.ceil(rawRatioExtent / ratioStep) * ratioStep);
  const ratioTicks = Array.from({ length: Math.round(ratioExtent * 2 / ratioStep) + 1 }, (_, index) => -ratioExtent + index * ratioStep);
  const additiveValues = effects.filter((row) => additiveIds.includes(row.metric_id)).flatMap((row) => { const ci = cvInterval(row); return [cvEstimate(row), ci.low, ci.high]; }).filter(Number.isFinite);
  const rawAdditiveExtent = additiveValues.length ? Math.max(...additiveValues.map(Math.abs)) : 1;
  const additiveStep = [0.25, 0.5, 1, 2, 5, 10, 20, 50].find((step) => step >= rawAdditiveExtent / 3) || 100;
  const additiveExtent = Math.max(additiveStep, Math.ceil(rawAdditiveExtent / additiveStep) * additiveStep);
  const additiveTicks = Array.from({ length: Math.round(additiveExtent * 2 / additiveStep) + 1 }, (_, index) => -additiveExtent + index * additiveStep);
  const W = 930, m = { l: 300, r: 30 }, pw = W - m.l - m.r, rowGap = 27, groupGap = 21;
  let cursor = 58;
  const ratioLayout = groups.map((group) => { const headingY = cursor; cursor += groupGap; const rows = group.ids.map((id) => { const y = cursor; cursor += rowGap; return { id, y }; }); return { ...group, headingY, rows }; });
  const ratioTop = 43, ratioBottom = cursor - 8, ratioAxisY = cursor + 4;
  cursor = ratioAxisY + 49;
  const additiveHeadingY = cursor; cursor += 25;
  const additiveRows = additiveIds.map((id) => { const y = cursor; cursor += rowGap; return { id, y }; });
  const additiveTop = additiveHeadingY + 8, additiveBottom = Math.max(additiveTop + 22, cursor - 8), additiveAxisY = cursor + 4;
  const H = additiveAxisY + 38;
  const ratioX = (value) => m.l + (Math.log2(value) + ratioExtent) / (ratioExtent * 2) * pw;
  const additiveX = (value) => m.l + (value + additiveExtent) / (additiveExtent * 2) * pw;
  const safeEngine = String(engine || 'engine').replace(/[^a-zA-Z0-9_-]/g, '-'), safeDataset = String(dataset || 'dataset').replace(/[^a-zA-Z0-9_-]/g, '-');
  const titleId = `controlled-fingerprint-${safeEngine}-${safeDataset}-title`, descId = `controlled-fingerprint-${safeEngine}-${safeDataset}-desc`;
  const unavailable = ratioIds.filter((id) => shownHardware.every((idHardware) => !byCell.has(`${id}/${idHardware}`))).length;
  const title = `${FWLABEL[engine] || engine} ${cvDataset(dataset)}: old build versus new build across every metric`;
  const hardwareDescription = shownHardware.length === 2 ? 'Blue circles are within-A100 effects, green squares are within-H100 effects, and a line connects the two build effects.' : `${cvHardware(shownHardware[0])} is shown on its within-GPU old/new effect.`;
  const description = `${ratioIds.length} metrics show new build divided by old build. One times means no change. Below one means a lower value on the new build and above one means a higher value. Arrows beside metric names state whether higher, lower, or neither direction is preferable. Quality score is separate and shows new minus old in percentage points. ${hardwareDescription} ${unavailable} metrics are unavailable for this selection.`;
  const aColor = T.GCOL.a100, hColor = T.GCOL.h100;
  let g = `<title id="${titleId}">${cvEsc(title)}</title><desc id="${descId}">${cvEsc(description)}</desc>`;
  g += `<text x="${m.l}" y="17" font-size="10.5" font-weight="700" fill="${T.TK.sec}">new build lower</text><text x="${m.l + pw / 2}" y="17" text-anchor="middle" font-size="10.5" font-weight="700" fill="${T.TK.sec}">1× = no change</text><text x="${m.l + pw}" y="17" text-anchor="end" font-size="10.5" font-weight="700" fill="${T.TK.sec}">new build higher</text>`;
  if (shownHardware.includes('a100x2')) g += `<circle cx="${m.l}" cy="34" r="4.5" fill="${aColor}"/><text x="${m.l + 9}" y="37.5" font-size="10" fill="${T.TK.tick}">2 A100 GPUs</text>`;
  if (shownHardware.includes('h100x2')) { const x = m.l + (shownHardware.length === 2 ? 88 : 0); g += `<rect x="${x}" y="29.5" width="9" height="9" rx="1" fill="${hColor}"/><text x="${x + 14}" y="37.5" font-size="10" fill="${T.TK.tick}">2 H100 GPUs</text>`; }
  if (shownHardware.length === 2) g += `<line x1="${m.l + 181}" y1="34" x2="${m.l + 207}" y2="34" stroke="${T.TK.sec}" stroke-width="1.5"/><text x="${m.l + 213}" y="37.5" font-size="10" fill="${T.TK.tick}">difference in build effect</text>`;
  g += `<text x="${m.l + pw}" y="37.5" text-anchor="end" font-size="9.5" fill="${T.TK.tick}">↑ higher better · ↓ lower better · — descriptive</text>`;
  ratioTicks.forEach((exponent) => { const x = ratioX(2 ** exponent), parity = Math.abs(exponent) < 1e-9; g += `<line x1="${x.toFixed(1)}" y1="${ratioTop}" x2="${x.toFixed(1)}" y2="${ratioBottom}" stroke="${parity ? T.TK.ink : T.TK.grid}" stroke-width="${parity ? 1.4 : 1}" stroke-dasharray="${parity ? 'none' : '2,3'}"/><text x="${x.toFixed(1)}" y="${ratioAxisY + 15}" text-anchor="middle" font-size="9.5" fill="${T.TK.tick}">${cvRatioTick(exponent)}</text>`; });
  const drawRow = (id, y, X, scale) => {
    const metric = registry[id] || {}, aRow = byCell.get(`${id}/a100x2`), hRow = byCell.get(`${id}/h100x2`);
    const aEstimate = cvEstimate(aRow), hEstimate = cvEstimate(hRow), valid = (value) => Number.isFinite(value) && (scale === 'additive' || value > 0);
    const availability = cvAvailability(metric.availability || metric.status);
    const label = cvMetricLabel(metric, id), transition = [aRow, hRow].find((row) => row?.control_version || row?.alternate_version);
    const polarity = cvPolarity(metric), polarityLabel = cvPolarityLabel(metric);
    const summary = [aRow, hRow].filter(Boolean).map((row) => { const value = cvEstimate(row), ci = cvInterval(row), comparison = scale === 'additive' ? 'new build minus old build' : 'new build divided by old build'; return `${cvHardware(row.hardware)}: ${comparison} is ${cvEffect(value, metric)}${Number.isFinite(ci.low) && Number.isFinite(ci.high) ? ` (uncertainty range ${cvEffect(ci.low, metric)} to ${cvEffect(ci.high, metric)})` : ''}`; }).join(' · ') || `not available${availability ? ` · ${availability}` : ''}`;
    const parityX = scale === 'additive' ? X(0) : X(1), rowTop = y - rowGap / 2 + 1, rowHeight = rowGap - 2;
    g += `<g role="group" aria-label="${cvEsc(`${label}. ${polarityLabel}. ${summary}.`)}" data-tip="<b>${cvEsc(label)}</b><br>${cvEsc(polarityLabel)}<br>${cvEsc(summary)}${transition ? `<br>old build ${cvEsc(transition.control_version || 'unknown')} &rarr; new build ${cvEsc(transition.alternate_version || 'unknown')}` : ''}">`;
    if (polarity !== 'neutral') { const left = polarity === 'lower' ? T.TK.good : T.TK.bad, right = polarity === 'higher' ? T.TK.good : T.TK.bad; g += `<rect x="${m.l}" y="${rowTop.toFixed(1)}" width="${(parityX - m.l).toFixed(1)}" height="${rowHeight.toFixed(1)}" fill="${left}" fill-opacity="0.045"/><rect x="${parityX.toFixed(1)}" y="${rowTop.toFixed(1)}" width="${(m.l + pw - parityX).toFixed(1)}" height="${rowHeight.toFixed(1)}" fill="${right}" fill-opacity="0.045"/>`; }
    g += `<rect x="8" y="${rowTop.toFixed(1)}" width="${W - 16}" height="${rowHeight.toFixed(1)}" rx="4" fill="transparent" pointer-events="all"/><text x="${m.l - 27}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10.5" font-weight="600" fill="${T.TK.sec}">${cvEsc(label)}</text><text x="${m.l - 12}" y="${(y + 3.5).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="800" fill="${polarity === 'neutral' ? T.TK.tick : T.TK.sec}">${cvPolarityCue(metric)}</text>`;
    if (valid(aEstimate) && valid(hEstimate)) g += `<line x1="${X(aEstimate).toFixed(1)}" y1="${(y - 4).toFixed(1)}" x2="${X(hEstimate).toFixed(1)}" y2="${(y + 4).toFixed(1)}" stroke="${T.TK.sec}" stroke-width="1.4" stroke-opacity="0.72"/>`;
    [[aRow, aEstimate, -4, aColor, 'circle'], [hRow, hEstimate, 4, hColor, 'square']].forEach(([row, estimate, offset, color, shape]) => {
      if (!valid(estimate)) return;
      const ci = cvInterval(row), yy = y + (shownHardware.length === 1 ? 0 : offset);
      if (valid(ci.low) && valid(ci.high)) g += `<line x1="${X(ci.low).toFixed(1)}" y1="${yy.toFixed(1)}" x2="${X(ci.high).toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${color}" stroke-width="2"/><line x1="${X(ci.low).toFixed(1)}" y1="${(yy - 3).toFixed(1)}" x2="${X(ci.low).toFixed(1)}" y2="${(yy + 3).toFixed(1)}" stroke="${color}"/><line x1="${X(ci.high).toFixed(1)}" y1="${(yy - 3).toFixed(1)}" x2="${X(ci.high).toFixed(1)}" y2="${(yy + 3).toFixed(1)}" stroke="${color}"/>`;
      g += shape === 'circle' ? `<circle cx="${X(estimate).toFixed(1)}" cy="${yy.toFixed(1)}" r="4.7" fill="${color}" stroke="${T.TK.surface}" stroke-width="1.2"/>` : `<rect x="${(X(estimate) - 4.5).toFixed(1)}" y="${(yy - 4.5).toFixed(1)}" width="9" height="9" rx="1" fill="${color}" stroke="${T.TK.surface}" stroke-width="1.2"/>`;
    });
    if (!valid(aEstimate) && !valid(hEstimate)) g += `<text x="${m.l + 8}" y="${(y + 3.5).toFixed(1)}" font-size="10" font-style="italic" fill="${T.TK.tick}">not available${availability ? ` · ${cvEsc(availability)}` : ''}</text>`;
    g += '</g>';
  };
  ratioLayout.forEach((group) => { g += `<text x="12" y="${group.headingY}" font-size="10" font-weight="800" letter-spacing="0.8" fill="${T.TK.tick}">${cvEsc(group.family.toUpperCase())}</text><line x1="${m.l}" y1="${group.headingY - 4}" x2="${m.l + pw}" y2="${group.headingY - 4}" stroke="${T.TK.grid}"/>`; group.rows.forEach(({ id, y }) => drawRow(id, y, ratioX, 'ratio')); });
  g += `<text x="${m.l + pw / 2}" y="${ratioAxisY + 32}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${T.TK.ink}">new build ÷ old build · log scale · 1× = no change</text>`;
  g += `<rect x="8" y="${additiveHeadingY - 14}" width="${W - 16}" height="${additiveBottom - additiveHeadingY + 20}" rx="6" fill="${T.TK.grid}" fill-opacity="0.28"/><text x="12" y="${additiveHeadingY}" font-size="10" font-weight="800" letter-spacing="0.8" fill="${T.TK.tick}">QUALITY · PERCENTAGE-POINT SCALE</text>`;
  additiveTicks.forEach((value) => { const x = additiveX(value), parity = Math.abs(value) < 1e-9; g += `<line x1="${x.toFixed(1)}" y1="${additiveTop}" x2="${x.toFixed(1)}" y2="${additiveBottom}" stroke="${parity ? T.TK.ink : T.TK.grid}" stroke-width="${parity ? 1.4 : 1}" stroke-dasharray="${parity ? 'none' : '2,3'}"/><text x="${x.toFixed(1)}" y="${additiveAxisY + 15}" text-anchor="middle" font-size="9.5" fill="${T.TK.tick}">${value > 0 ? '+' : ''}${cvNumber(value)}</text>`; });
  additiveRows.forEach(({ id, y }) => drawRow(id, y, additiveX, 'additive'));
  if (!additiveRows.length) g += `<text x="${m.l + 8}" y="${additiveHeadingY + 20}" font-size="10" font-style="italic" fill="${T.TK.tick}">no additive quality metric registered</text>`;
  g += `<text x="${m.l + pw / 2}" y="${H - 8}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${T.TK.ink}">new build − old build · percentage points</text>`;
  return `<svg role="img" aria-labelledby="${titleId} ${descId}" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:930px">${g}</svg>`;
}
