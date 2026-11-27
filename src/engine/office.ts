// Office & admin process engine. Implements the AutomationCompass formulas (brief sections 4, 5, 7, 16).
import type { OfficeProcess } from '../types';
import { OFFICE_CRITERIA_INFO, type OfficeGlobals, type OfficeTech, type OfficeTechKey } from '../data/officeCatalog';

export const OFFICE_CRITERIA = OFFICE_CRITERIA_INFO.map((c) => ({ k: c.k, w: c.w }));

export type OfficeVerdict = 'now' | 'quick' | 'fix' | 'no';
export type OfficeWave = 1 | 2 | 'park' | 'fix' | 'no';

export interface OfficeRoi {
  B: number; // yearly benefit
  O: number; // yearly running cost
  K: number; // total investment incl. internal effort
  N: number; // net per year
  pay: number; // payback months (Infinity = never)
  net3: number; // 3-year net
  freed: number; // hours freed per year
}

export interface OfficeRow {
  p: OfficeProcess;
  hrs: number;
  lab: number;
  err: number;
  C: number;
  S: number;
  I: number;
  P: number;
  stop: boolean;
  verdict: OfficeVerdict;
  tk: OfficeTechKey;
  t: OfficeTech | null;
  base?: OfficeRoi;
  best?: OfficeRoi;
  worst?: OfficeRoi;
  wave: OfficeWave;
}

export interface OfficePortfolio {
  count: number;
  inWaves: number;
  K: number;
  N: number;
  pay: number;
  payBest: number;
  payWorst: number;
  freed: number;
  net3: number;
}

export interface OfficeResult {
  rows: OfficeRow[];
  portfolio: OfficePortfolio;
}

export function officeTechFor(p: OfficeProcess): OfficeTechKey {
  if (p.task === 'data') return p.ratings[4] === 5 ? 'api' : 'rpa';
  return ({ docs: 'docai', report: 'bi', email: 'llm', approve: 'flow', quality_log: 'dqa', planning: 'aps' } as const)[p.task];
}

const n = (x: unknown) => (typeof x === 'number' && isFinite(x) ? x : 0);

function roi(r: { hrs: number; err: number }, t: OfficeTech, f: { vol: number; sav: number; cost: number }, G: OfficeGlobals, rate: number): OfficeRoi {
  const hrs = r.hrs * f.vol;
  const lab = hrs * rate;
  const err = r.err * f.vol;
  const sv = (x: number) => Math.min(1, x * f.sav);
  const B = G.real * (sv(t.st) * lab + sv(t.se) * err);
  const O = t.opex * f.cost;
  const K = t.capex * f.cost + G.hint * rate;
  const N = B - O;
  return { B, O, K, N, pay: N > 0 ? K / (N / 12) : Infinity, net3: 3 * N - K, freed: hrs * sv(t.st) * G.real };
}

export function evaluateOffice(processes: OfficeProcess[], tech: Record<OfficeTechKey, OfficeTech>, G: OfficeGlobals, rate: number): OfficeResult {
  const rows: OfficeRow[] = (processes ?? []).map((p) => {
    const hrs = (n(p.minPerRun) * n(p.runsPerWeek)) / 60 * n(G.weeks);
    const lab = hrs * n(rate);
    const err = (n(p.runsPerWeek) * n(G.weeks) * n(p.errPct)) / 100 * n(p.costPerError);
    const S = 100 * OFFICE_CRITERIA.reduce((a, c, i) => a + c.w * (n(p.ratings?.[i]) - 1) / 4, 0);
    return { p, hrs, lab, err, C: lab + err, S, I: 0, P: 0, stop: false, verdict: 'no', tk: officeTechFor(p), t: null, wave: 'no' } as OfficeRow;
  });
  const cmax = Math.max(1, ...rows.map((r) => r.C));
  for (const r of rows) {
    r.I = (100 * r.C) / cmax;
    r.P = (r.S * r.I) / 100;
    r.stop = r.S < 40 || r.p.ratings?.[0] === 1;
    r.verdict = r.S >= 60 ? (r.I >= 50 ? 'now' : 'quick') : r.I >= 50 ? 'fix' : 'no';
    if (r.stop && r.verdict !== 'no') r.verdict = 'fix';
    r.t = r.stop ? null : tech[r.tk] ?? null;
    if (r.t) {
      r.base = roi(r, r.t, { vol: 1, sav: 1, cost: 1 }, G, rate);
      r.best = roi(r, r.t, { vol: 1.25, sav: 1, cost: 1 }, G, rate);
      r.worst = roi(r, r.t, { vol: 1, sav: 0.7, cost: 1.3 }, G, rate);
    }
    r.wave = r.verdict === 'no' ? 'no' : r.verdict === 'fix' ? 'fix' : !r.base ? 'no' : r.base.pay <= 12 ? 1 : r.base.pay <= 24 ? 2 : 'park';
  }
  rows.sort((a, b) => b.P - a.P);

  const inW = rows.filter((r) => (r.wave === 1 || r.wave === 2) && r.base);
  const sum = (k: 'base' | 'best' | 'worst', f: keyof OfficeRoi) => inW.reduce((a, r) => a + n(r[k]![f]), 0);
  const pay = (k: 'base' | 'best' | 'worst') => {
    const N = sum(k, 'N');
    return N > 0 ? sum(k, 'K') / (N / 12) : Infinity;
  };
  return {
    rows,
    portfolio: {
      count: rows.length,
      inWaves: inW.length,
      K: sum('base', 'K'),
      N: sum('base', 'N'),
      pay: inW.length ? pay('base') : Infinity,
      payBest: inW.length ? pay('best') : Infinity,
      payWorst: inW.length ? pay('worst') : Infinity,
      freed: sum('base', 'freed'),
      net3: sum('base', 'net3'),
    },
  };
}

export const OFFICE_VERDICT_LABEL: Record<OfficeVerdict, string> = {
  now: 'Automate now',
  quick: 'Quick win only if the tool is cheap',
  fix: 'Fix the process first (standardise, Lean), then re-score',
  no: 'Do not automate',
};

export const OFFICE_WAVE_LABEL: Record<string, string> = {
  '1': 'Wave 1: start now',
  '2': 'Wave 2: next',
  park: 'Not worth it yet',
  fix: 'Fix process first',
  no: 'Do not automate',
};

export const fmtMonths = (m: number) => (!isFinite(m) ? 'never' : m > 120 ? '> 10 yrs' : `${m.toFixed(1)} mo`);
