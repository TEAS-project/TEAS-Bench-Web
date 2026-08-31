// Adjustable buy pricing recalculates node ownership rates without changing measurements.
// Rent quotes and catalog prices remain fixed. Custom values receive a visible badge.
// Formula:
//   capital  = (gpu_price × n_gpus + cpu_price × n_cpus) × scale_other_capital
//   rate_$/h = capital / (base_lifetime_hours × utilisation) + node_kW × electricity_$/kWh
// Buy values scale by rate(params) / rate(defaults). Measured time cancels out.

/** Slider ranges. Defaults come from db.pricing.buy, not from here. */
export const BUY_PARAM_SPEC = {
  lifeYears: { min: 1, max: 7, step: 0.5, label: 'Hardware lifetime', unit: 'years' },
  util: { min: 0.1, max: 1, step: 0.05, label: 'Utilisation', unit: '×' },
  elec: { min: 0.03, max: 0.5, step: 0.01, label: 'Electricity', unit: '$/kWh' },
};

const TIERS = ['datacentre', 'workstation'];

/** Published defaults, or null when the buy catalog is unavailable. */
export function buyDefaults(pricing) {
  const b = pricing && pricing.buy;
  if (!b || b.electricity_usd_per_kwh == null) return null;
  if (b.defaults_by_tier) {
    const tiers = Object.fromEntries(TIERS.map((tier) => {
      const v = b.defaults_by_tier[tier];
      if (!v || v.base_lifetime_hours == null || v.utilisation == null) return [tier, null];
      return [tier, { lifeYears: v.base_lifetime_hours / 8760, util: v.utilisation }];
    }));
    if (TIERS.some((tier) => !tiers[tier])) return null;
    return { tiers, elec: b.electricity_usd_per_kwh, legacy: false };
  }
  // Older data used one global default for both tiers.
  if (b.lifetime_hours == null) return null;
  const util = b.utilisation != null ? b.utilisation : 1;
  const baseH = b.base_lifetime_hours != null ? b.base_lifetime_hours : b.lifetime_hours / util;
  const one = { lifeYears: baseH / 8760, util };
  return { tiers: { datacentre: one, workstation: one }, elec: b.electricity_usd_per_kwh, legacy: true };
}

/** Resolve absent global URL overrides against the tier currently being priced or displayed. */
export function resolveParams(params, defaults, tier) {
  const d = defaults && defaults.tiers[tier];
  if (!d) return null;
  return {
    lifeYears: params.lifeYears == null ? d.lifeYears : params.lifeYears,
    util: params.util == null ? d.util : params.util,
    elec: params.elec == null ? defaults.elec : params.elec,
  };
}

/** Whole-node owned rate in $/h for `n` accelerators of catalog entry `g`, under `p`. */
export function nodeRateH(g, n, p, scaleOtherCapital) {
  // Complete-system entries may override the normal host and chassis uplift.
  const capitalScale = g.capital_scale != null ? g.capital_scale : scaleOtherCapital;
  const capital = (g.price_per_unit_usd * n + g.cpu_price_per_unit_usd * g.cpu_num) * capitalScale;
  const watts = g.tdp_w * n + g.cpu_tdp_w * g.cpu_num;
  return capital / (p.lifeYears * 8760 * p.util) + (watts / 1000) * p.elec;
}

/** Whether a catalog entry contains every field needed for the rate. */
export const buyEntryComplete = (g) => g && g.price_per_unit_usd != null && g.tdp_w != null
  && g.cpu_price_per_unit_usd != null && g.cpu_tdp_w != null && g.cpu_num != null;

/** Return rate(params)/rate(defaults) by accelerator and node size, or null if the catalog is incomplete. */
export function buyFactors(pricing, params) {
  const d = buyDefaults(pricing);
  if (!d) return null;
  const all = (pricing.buy && pricing.buy.gpus) || [];
  const entries = all.filter(buyEntryComplete);
  if (!entries.length || entries.length !== all.length) return null;
  if (!d.legacy && entries.some((g) => !d.tiers[g.tier])) return null;
  const soc = pricing.buy.scale_other_capital != null ? pricing.buy.scale_other_capital : 1;
  const byKey = Object.fromEntries(entries.map((g) => [g.gpu_key, g]));
  return (gpuKey, n) => {
    const g = byKey[gpuKey];
    if (!g) return null;  // No buy price is available for this accelerator.
    const tier = g.tier || (d.legacy ? 'datacentre' : null);
    const base = tier && resolveParams({ lifeYears: null, util: null, elec: null }, d, tier);
    const selected = tier && resolveParams(params, d, tier);
    if (!base || !selected) return null;
    return nodeRateH(g, n, selected, soc) / nodeRateH(g, n, base, soc);
  };
}

export const isDefaultParams = (p, d) => !!d && p.lifeYears == null && p.util == null && p.elec == null;

// URL values are global overrides. Missing values use each accelerator tier's default.
export function paramsToSearch(p, sp) {
  const set = (k, v) => (v == null ? sp.delete(k) : sp.set(k, String(v)));
  set('blife', p.lifeYears); set('butil', p.util); set('belec', p.elec);
  return sp;
}
export function paramsFromSearch(sp) {
  const num = (k, { min, max }) => {
    if (!sp.has(k)) return null;
    const v = parseFloat(sp.get(k));
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;
  };
  return {
    lifeYears: num('blife', BUY_PARAM_SPEC.lifeYears),
    util: num('butil', BUY_PARAM_SPEC.util),
    elec: num('belec', BUY_PARAM_SPEC.elec),
  };
}
