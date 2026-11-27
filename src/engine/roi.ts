import type { Assumptions, CompanyProfile, Line, LineAnalysis, OpportunityScore, Portfolio, RoiResult, TechClass, TechRecommendation } from '../types';
import { clamp, effectiveRate, nextConstraintRate, num, safeDiv } from './lineSim';
import { capexEstimate } from './techRecommender';

/** Contribution margin on extra / lost output (share of unit value). */
export const CONTRIBUTION_MARGIN = 0.3;

export function npvOf(investment: number, annual: number, years: number, rate: number): number {
  const n = Math.max(0, Math.round(num(years)));
  const r = num(rate);
  let v = -investment;
  for (let t = 1; t <= n; t++) v += annual / Math.pow(1 + r, t);
  return Number.isFinite(v) ? v : 0;
}

export function irrOf(investment: number, annual: number, years: number): number | null {
  const n = Math.max(0, Math.round(num(years)));
  if (investment <= 0 || annual <= 0 || n === 0) return null;
  const f = (r: number) => npvOf(investment, annual, n, r);
  let lo = -0.99;
  let hi = 10;
  if (f(lo) < 0 || f(hi) > 0) return null; // no sign change in range
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  const r = (lo + hi) / 2;
  return Number.isFinite(r) ? r : null;
}

export const paybackOf = (investment: number, net: number) => (net > 0 ? investment / net : Infinity);

type Level = 'low' | 'medium' | 'high';

export function computeRoi(
  profile: CompanyProfile,
  line: Line,
  la: LineAnalysis,
  recs: TechRecommendation[],
  catalog: TechClass[],
  assumptions: Assumptions,
): RoiResult[] {
  const out: RoiResult[] = [];
  const hours = la.operatingHoursPerYear;
  const target = Math.max(0, num(line.targetRatePerMin));
  const actual = target > 0 ? Math.min(la.lineRatePerMin, target) : la.lineRatePerMin;
  const unitValue = Math.max(0, num(profile.unitValueEur));
  const shifts = Math.max(0, num(profile.shifts));

  for (const rec of recs) {
    if (!rec.best) continue;
    const t = catalog.find((c) => c.id === rec.best!.techId);
    const s = line.stations.find((x) => x.id === rec.stationId);
    const sa = la.stations.find((x) => x.stationId === rec.stationId);
    if (!t || !s || !sa) continue;

    const capex = capexEstimate(t, profile.hygiene);
    const integration = capex * Math.max(0, num(t.integrationPct));
    const totalInvestment = capex + integration;
    const annualOpex = capex * Math.max(0, num(t.annualOpexPct));

    const labour = sa.labourCostPerYear * clamp(num(t.labourReductionPct), 0, 1);
    const scrap = sa.scrapCostPerYear * clamp(num(t.scrapReductionPct), 0, 1);
    const downtime = sa.downtimeHoursPerYear * clamp(num(t.downtimeReductionPct), 0, 1) * actual * 60 * unitValue * CONTRIBUTION_MARGIN;
    const ergonomics =
      t.ergonomicRelief && sa.ergonomicRisk !== 'low'
        ? num(assumptions.injuryCostPerHighRiskOperatorYear) * Math.max(0, num(s.operatorsPerShift)) * shifts * (sa.ergonomicRisk === 'high' ? 1 : 0.5)
        : 0;
    let throughput = 0;
    if (sa.isBottleneck && la.taktGapPct > 0 && target > 0) {
      const newEff =
        num(s.ratePerMin) *
        (1 + num(t.rateUpliftPct)) *
        (1 - clamp(num(s.downtimePct) * (1 - num(t.downtimeReductionPct)), 0, 1)) *
        (1 - clamp(num(s.scrapRate) * (1 - num(t.scrapReductionPct)), 0, 1));
      const newLine = Math.min(target, newEff, nextConstraintRate(line, s.id));
      const extra = Math.max(0, newLine - la.lineRatePerMin) * 60 * hours;
      throughput = extra * unitValue * CONTRIBUTION_MARGIN;
    }

    const annualSavings = { labour, scrap, downtime, ergonomics, throughput };
    const gross = labour + scrap + downtime + ergonomics + throughput;
    const net = gross - annualOpex;
    const years = num(profile.horizonYears, 5);

    // ---- risk
    const ratio = safeDiv(num(s.variability, 3), Math.max(1, t.maxVariability), 1);
    const varLevel: Level = ratio > 1 ? 'high' : ratio >= 0.75 ? 'medium' : 'low';
    const hygLevel: Level = profile.hygiene === 'washdown' ? 'high' : profile.hygiene === 'wet' ? 'medium' : 'low';
    const intLevel: Level =
      t.category === 'robot' || t.category === 'agv' ? (totalInvestment > 200000 ? 'high' : 'medium') : t.category === 'special_machine' ? 'medium' : 'low';
    const leadLevel: Level = t.leadTimeWeeks > 20 ? 'high' : t.leadTimeWeeks > 10 ? 'medium' : 'low';
    const dt = num(s.downtimePct);
    const stabLevel: Level = dt > 0.06 ? 'high' : dt > 0.03 ? 'medium' : 'low';
    const pts = (l: Level, lo: number, me: number, hi: number) => (l === 'high' ? hi : l === 'medium' ? me : lo);
    const riskScore = Math.round(
      clamp(
        clamp(ratio, 0, 1.5) * 20 +
          pts(hygLevel, 0, 8, 15) +
          pts(intLevel, 5, 15, 25) +
          pts(leadLevel, 0, 8, 15) +
          pts(stabLevel, 0, 6, 15),
        0,
        100,
      ),
    );
    const allFactors: RoiResult['riskFactors'] = [
      {
        label: 'Product variability',
        level: varLevel,
        note: `Station variability ${num(s.variability, 3)}/5 vs. a technology limit of ${t.maxVariability}/5${varLevel === 'low' ? ': comfortable margin' : varLevel === 'medium' ? ': close to the limit, test all formats in the FAT' : ': beyond the limit, expect manual interventions'}.`,
      },
      {
        label: 'Integration complexity',
        level: intLevel,
        note:
          t.category === 'software'
            ? 'Software rollout; main effort is training and process discipline.'
            : `${t.category === 'robot' ? 'Robot cell' : t.category === 'agv' ? 'Mobile robots' : 'Machine'} with ${Math.round(t.integrationPct * 100)}% integration effort: safety, interfaces to adjacent stations, commissioning.`,
      },
      {
        label: 'Delivery lead time',
        level: leadLevel,
        note: `About ${t.leadTimeWeeks} weeks from order to production.`,
      },
      {
        label: 'Process stability',
        level: stabLevel,
        note: `Current downtime ${(dt * 100).toFixed(1)}%${stabLevel === 'low' ? ': a stable base to automate' : ': stabilise the process first or automation inherits the stops'}.`,
      },
      {
        label: 'Hygiene requirements',
        level: hygLevel,
        note: profile.hygiene === 'dry' ? 'Dry area, standard execution.' : `${profile.hygiene === 'washdown' ? 'Washdown' : 'Wet'} environment: stainless/IP-rated execution and cleaning concept needed.`,
      },
    ];
    const rank: Record<Level, number> = { high: 2, medium: 1, low: 0 };
    const riskFactors = [...allFactors].sort((a, b) => rank[b.level] - rank[a.level]).slice(0, 4);

    out.push({
      stationId: s.id,
      techId: t.id,
      capex,
      integration,
      totalInvestment,
      annualOpex,
      annualSavings,
      grossAnnualSavings: gross,
      netAnnualBenefit: net,
      paybackYears: paybackOf(totalInvestment, net),
      npv: npvOf(totalInvestment, net, years, profile.discountRate),
      irr: irrOf(totalInvestment, net, years),
      riskScore,
      riskFactors,
      fteFreed: Math.max(0, num(s.operatorsPerShift)) * shifts * clamp(num(t.labourReductionPct), 0, 1),
    });
  }
  return out;
}

/** Greedy portfolio: by opportunity rank, then payback; add while within budget and NPV > 0. */
export function buildPortfolio(profile: CompanyProfile, roi: RoiResult[], scores: OpportunityScore[]): Portfolio {
  const rankOf = (id: string) => scores.find((s) => s.stationId === id)?.rank ?? 999;
  const sorted = [...roi].sort((a, b) => rankOf(a.stationId) - rankOf(b.stationId) || a.paybackYears - b.paybackYears);
  const budget = Math.max(0, num(profile.budget));
  const selected: RoiResult[] = [];
  let total = 0;
  for (const r of sorted) {
    if (r.npv <= 0 || !(r.netAnnualBenefit > 0)) continue;
    if (total + r.totalInvestment > budget) continue;
    selected.push(r);
    total += r.totalInvestment;
  }
  return summarisePortfolio(profile, selected);
}

export function summarisePortfolio(profile: CompanyProfile, selected: RoiResult[]): Portfolio {
  const totalInvestment = selected.reduce((a, r) => a + r.totalInvestment, 0);
  const totalNetAnnualBenefit = selected.reduce((a, r) => a + r.netAnnualBenefit, 0);
  const budget = Math.max(0, num(profile.budget));
  return {
    selected,
    totalInvestment,
    totalNetAnnualBenefit,
    paybackYears: selected.length ? paybackOf(totalInvestment, totalNetAnnualBenefit) : 0,
    npv: selected.reduce((a, r) => a + r.npv, 0),
    fteFreed: selected.reduce((a, r) => a + r.fteFreed, 0),
    budgetUsedPct: budget > 0 ? totalInvestment / budget : 0,
  };
}
