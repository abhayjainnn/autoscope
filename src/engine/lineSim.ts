import type { Assumptions, CompanyProfile, Line, LineAnalysis, Station, StationAnalysis } from '../types';

// ---------------------------------------------------------------- helpers
export const clamp = (x: number, lo: number, hi: number) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo);
export const num = (x: unknown, fallback = 0): number => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);
export const safeDiv = (a: number, b: number, fallback = 0) => (b !== 0 && Number.isFinite(a / b) ? a / b : fallback);

export function eur(x: number): string {
  const v = num(x);
  if (Math.abs(v) >= 1e6) return `€${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `€${Math.round(v / 1e3)}k`;
  return `€${Math.round(v)}`;
}
export const pct = (x: number, digits = 0) => `${(num(x) * 100).toFixed(digits)}%`;
export const fmtN = (x: number, digits = 1) => {
  const v = num(x);
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
};

export function operatingHoursPerYear(p: CompanyProfile): number {
  return Math.max(0, num(p.shifts) * num(p.hoursPerShift) * num(p.operatingDaysPerYear));
}

/** Ergonomic risk thresholds in kg lifted per operator per shift.
 *  Loosely based on the German Leitmerkmalmethode (KIM-LHC): >8 t/shift with
 *  repeated 10+ kg lifts is clearly high load; >2.5 t is a noticeable load. */
export const ERGO_HIGH_KG = 8000;
export const ERGO_MEDIUM_KG = 2500;

export function effectiveRate(s: Station): number {
  const r = num(s.ratePerMin);
  if (r <= 0) return 0;
  return r * (1 - clamp(num(s.downtimePct), 0, 1)) * (1 - clamp(num(s.scrapRate), 0, 1));
}

/** A station with ratePerMin <= 0 is treated as "not in the material flow"
 *  (e.g. documentation) and never limits the line. */
export const inFlow = (s: Station) => num(s.ratePerMin) > 0;

export function analyzeLine(profile: CompanyProfile, line: Line, assumptions: Assumptions): LineAnalysis {
  const hours = operatingHoursPerYear(profile);
  const stations = line?.stations ?? [];
  const target = Math.max(0, num(line?.targetRatePerMin));
  const labourRate =
    num(profile.labourCostPerHour) * (1 + (profile.goals?.includes('labour_shortage') ? num(assumptions.recruitingPremiumPct) : 0));

  // bottleneck
  let bottleneckId: string | null = null;
  let lineRate = Infinity;
  for (const s of stations) {
    if (!inFlow(s)) continue;
    const e = effectiveRate(s);
    if (e < lineRate) {
      lineRate = e;
      bottleneckId = s.id;
    }
  }
  if (!Number.isFinite(lineRate)) lineRate = target; // nothing in flow: assume target is met
  const actual = target > 0 ? Math.min(lineRate, target) : lineRate;
  const annualOutputUnits = Math.max(0, actual * 60 * hours);

  const res: StationAnalysis[] = stations.map((s) => {
    const eff = effectiveRate(s);
    const ops = Math.max(0, num(s.operatorsPerShift));
    const kg = (num(s.liftKgPerUnit) * actual * 60 * num(profile.hoursPerShift)) / Math.max(ops, 1);
    const ergonomicRisk: StationAnalysis['ergonomicRisk'] = ops <= 0 || kg <= 0 ? 'low' : kg > ERGO_HIGH_KG ? 'high' : kg > ERGO_MEDIUM_KG ? 'medium' : 'low';
    return {
      stationId: s.id,
      effectiveRatePerMin: eff,
      utilization: inFlow(s) && eff > 0 ? target / eff : 0,
      isBottleneck: s.id === bottleneckId,
      kgLiftedPerShift: Math.max(0, kg),
      ergonomicRisk,
      labourCostPerYear: ops * hours * labourRate,
      scrapCostPerYear: clamp(num(s.scrapRate), 0, 1) * annualOutputUnits * num(profile.unitValueEur),
      downtimeHoursPerYear: clamp(num(s.downtimePct), 0, 1) * hours,
    };
  });

  // Availability of a serial line: every in-flow station's downtime stops the line,
  // plus changeovers (the longest changeover on the line × changeovers per week).
  const flow = stations.filter(inFlow);
  const uptime = flow.reduce((a, s) => a * (1 - clamp(num(s.downtimePct), 0, 1)), 1);
  const weeklyMin = (Math.max(0, num(profile.shifts)) * Math.max(0, num(profile.hoursPerShift)) * 60 * Math.max(0, num(profile.operatingDaysPerYear))) / 52;
  const longestChangeover = flow.reduce((m, s) => Math.max(m, num(s.changeoverMin)), 0);
  const changeoverLoss = weeklyMin > 0 ? clamp((num(profile.changeoversPerWeek) * longestChangeover) / weeklyMin, 0, 0.9) : 0;
  const availability = uptime * (1 - changeoverLoss);
  const performance = target > 0 ? Math.min(1, actual / target) : 1;
  const quality = stations.reduce((q, s) => q * (1 - clamp(num(s.scrapRate), 0, 1)), 1);

  return {
    stations: res,
    bottleneckId,
    lineRatePerMin: lineRate,
    taktGapPct: target > 0 ? (target - lineRate) / target : 0,
    oee: clamp(availability * performance * quality, 0, 1),
    annualOutputUnits,
    totalOperatorsPerShift: stations.reduce((a, s) => a + Math.max(0, num(s.operatorsPerShift)), 0),
    totalLabourCostPerYear: res.reduce((a, r) => a + r.labourCostPerYear, 0),
    operatingHoursPerYear: hours,
  };
}

/** Second-lowest effective rate (the next constraint once the bottleneck is fixed). */
export function nextConstraintRate(line: Line, excludeId: string): number {
  let m = Infinity;
  for (const s of line.stations ?? []) if (s.id !== excludeId && inFlow(s)) m = Math.min(m, effectiveRate(s));
  return m;
}
