// Theme tokens and chart palettes. Revalidate pairwise contrast in both modes after changing a hue.
// Minimum measured ΔE: light 15.6, dark 15.1. Direct labels provide secondary encoding.

import { useEffect, useSyncExternalStore } from 'react';

export const GPU_COLORS = {
  light: { a100: '#2a78d6', h100: '#1baf7a', h200: '#008300', b200: '#4a3aa7', b300: '#eda100', mi355x: '#e34948', gb10: '#64748b', 'blackhole-p150b': '#0891b2', cs3: '#7e22ce' },
  dark:  { a100: '#256abf', h100: '#1baf7a', h200: '#008300', b200: '#9085e9', b300: '#c98500', mi355x: '#e34948', gb10: '#94a3b8', 'blackhole-p150b': '#22d3ee', cs3: '#a855f7' },
};

// Workload hues for the agentic scatter.
export const DS_COLORS = {
  light: { MCP: '#2a78d6', SWE: '#008300', IMO: '#eda100' },
  dark:  { MCP: '#256abf', SWE: '#008300', IMO: '#c98500' },
};

// Variant hues for grouped bars.
export const F4_COLORS = {
  light: { natural: '#2a78d6', 'in1024/out1024': '#eda100', 'in1024/out8192': '#1baf7a', 'in8192/out1024': '#4a3aa7' },
  dark:  { natural: '#256abf', 'in1024/out1024': '#c98500', 'in1024/out8192': '#1baf7a', 'in8192/out1024': '#9085e9' },
};

// Chart chrome is separate from the accelerator palette.
export const CHROME = {
  light: { ink: '#0f172a', sec: '#475569', tick: '#64748b', grid: '#e2e8f0', hair: '#cbd5e1',
           surface: '#ffffff', fallback: '#94a3b8', band: '#94a3b8', bandOn: '#2a78d6', bandLabel: '#1c5cab', warn: '#b45309', good: '#16a34a', bad: '#dc2626' },
  dark:  { ink: '#e2e8f0', sec: '#cbd5e1', tick: '#94a3b8', grid: '#1e293b', hair: '#334155',
           surface: '#0f172a', fallback: '#64748b', band: '#64748b', bandOn: '#256abf', bandLabel: '#86b6ef', warn: '#fbbf24', good: '#22c55e', bad: '#f87171' },
};

// Chart builders read these live bindings during render.
export let TK = CHROME.light;
export let GCOL = GPU_COLORS.light;
export let DSCOL = DS_COLORS.light;
export let F4COL = F4_COLORS.light;
export let GCOL_BY_NAME = {};

const NAMES = { a100: 'NVIDIA A100', h100: 'NVIDIA H100', h200: 'NVIDIA H200', b200: 'NVIDIA B200', b300: 'NVIDIA B300', mi355x: 'AMD MI355X', gb10: 'NVIDIA DGX Spark', 'blackhole-p150b': 'Tenstorrent P150b', cs3: 'Cerebras CS-3' };
export function applyChartTheme(mode) {
  const m = mode === 'dark' ? 'dark' : 'light';
  TK = CHROME[m]; GCOL = GPU_COLORS[m]; DSCOL = DS_COLORS[m]; F4COL = F4_COLORS[m];
  GCOL_BY_NAME = Object.fromEntries(Object.entries(NAMES).map(([k, n]) => [n, GCOL[k]]));
}

const KEY = 'teas-theme';
export const initialTheme = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* private mode or storage disabled, fall through to the OS preference */ }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Match the stored theme on the first render.
applyChartTheme(typeof window === 'undefined' ? 'light' : initialTheme());

// One shared store keeps React components and generated SVG strings on the same theme.
let _theme = null;
const listeners = new Set();
const readTheme = () => (_theme === null ? (_theme = initialTheme()) : _theme);
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Subscribe a chart component so it rebuilds SVG strings after a theme change. */
export function useChartTheme() {
  return useSyncExternalStore(subscribe, readTheme, () => 'light');
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* not persisting is fine */ }
  }, [theme]);
  // Swap chart tokens before notifying subscribers.
  applyChartTheme(theme);
  return [theme, () => {
    _theme = theme === 'dark' ? 'light' : 'dark';
    applyChartTheme(_theme);
    listeners.forEach((fn) => fn());
  }];
}
