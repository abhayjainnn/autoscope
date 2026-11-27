import type { Assumptions, CompanyProfile, MonteCarloResult, Portfolio } from '../types';
import { clamp, num } from './lineSim';
import { npvOf, paybackOf } from './roi';

/** Small fast seeded PRNG so results are stable across renders. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Triangular sample in [1-w, 1+w] with mode 1. */
// Asymmetric triangular factor: real projects overrun on cost and under-deliver on savings.
// lo/hi scale the spread below/above 1; mode shifts the most likely outcome.
function tri(rand: () => number, w: number, lo = 1, hi = 1, mode = 1): number {
  const u = rand();
  const a = 1 - w * lo;
  const b = 1 + w * hi;
  const c = Math.min(b, Math.max(a, mode));
  const fc = (c - a) / (b - a);
  return u < fc ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
}

const BUCKETS = ['<1', '1-2', '2-3', '3-4', '4-5', '5+'];
const PAYBACK_CAP = 99; // years, used instead of Infinity for percentiles

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = clamp(Math.floor(q * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[i];
}

export function runMonteCarlo(profile: CompanyProfile, portfolio: Portfolio, assumptions: Assumptions, seed = 42): MonteCarloResult {
  const runs = Math.round(clamp(num(assumptions.monteCarloRuns, 1000), 0, 2000));
  const empty: MonteCarloResult = {
    stationId: 'portfolio',
    runs: 0,
    paybackP10: 0,
    paybackP50: 0,
    paybackP90: 0,
    npvP10: 0,
    npvP50: 0,
    npvP90: 0,
    probPaybackWithinHorizon: 0,
    histogram: BUCKETS.map((bucket) => ({ bucket, count: 0 })),
  };
  if (portfolio.selected.length === 0 || runs === 0) return empty;

  const cw = clamp(num(assumptions.costUncertaintyPct), 0, 0.95);
  const sw = clamp(num(assumptions.savingsUncertaintyPct), 0, 0.95);
  const years = num(profile.horizonYears, 5);
  const rate = num(profile.discountRate);
  const rand = mulberry32(seed);
  const paybacks: number[] = [];
  const npvs: number[] = [];
  const hist = BUCKETS.map(() => 0);

  for (let i = 0; i < runs; i++) {
    let inv = 0;
    let net = 0;
    for (const r of portfolio.selected) {
      const cf = tri(rand, cw, 0.4, 1.2, 1.05); // cost: mostly overruns
      const sf = tri(rand, sw, 1.5, 0.5, 0.92); // savings: optimism bias
      inv += r.totalInvestment * cf;
      net += r.grossAnnualSavings * sf - r.annualOpex * cf;
    }
    const pb = Math.min(PAYBACK_CAP, paybackOf(inv, net));
    paybacks.push(pb);
    npvs.push(npvOf(inv, net, years, rate));
    hist[pb < 1 ? 0 : pb < 2 ? 1 : pb < 3 ? 2 : pb < 4 ? 3 : pb < 5 ? 4 : 5]++;
  }
  const within = paybacks.filter((p) => p <= years).length / runs;
  paybacks.sort((a, b) => a - b);
  npvs.sort((a, b) => a - b);
  // Adaptive histogram: 8 bins spanning the 1st–99th percentile (in months when spread is small).
  const lo = quantile(paybacks, 0.01);
  const hiQ = Math.min(quantile(paybacks, 0.99), Math.max(lo + 0.5, years * 2));
  const nb = 8;
  const width = Math.max((hiQ - lo) / nb, 1 / 12);
  const useMonths = hiQ < 4;
  const fmt = (y: number) => (useMonths ? `${Math.round(y * 12)}` : y.toFixed(1));
  const adaptive = Array.from({ length: nb }, (_, i) => {
    const a = lo + i * width;
    const b = a + width;
    const count = paybacks.filter((p) => (i === 0 ? p < b : i === nb - 1 ? p >= a : p >= a && p < b)).length;
    return { bucket: `${fmt(a)}–${fmt(b)}${useMonths ? ' mo' : ' yrs'}`, count };
  });
  return {
    stationId: 'portfolio',
    runs,
    paybackP10: quantile(paybacks, 0.1),
    paybackP50: quantile(paybacks, 0.5),
    paybackP90: quantile(paybacks, 0.9),
    npvP10: quantile(npvs, 0.1),
    npvP50: quantile(npvs, 0.5),
    npvP90: quantile(npvs, 0.9),
    probPaybackWithinHorizon: within,
    histogram: adaptive.some((b) => b.count > 0) ? adaptive : BUCKETS.map((bucket, i) => ({ bucket, count: hist[i] })),
  };
}
