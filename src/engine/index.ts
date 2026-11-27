import type { AnalysisBundle, Assumptions, CompanyProfile, Line, RoiResult, TechClass } from '../types';
import { analyzeLine, clamp, num } from './lineSim';
import { scoreStations } from './scoring';
import { recommendTech } from './techRecommender';
import { buildPortfolio, computeRoi } from './roi';
import { runMonteCarlo } from './montecarlo';
import { computeSensitivity } from './sensitivity';
import { buildRoadmap } from './roadmap';
import { computeVerdicts } from './verdict';

export { analyzeLine, operatingHoursPerYear, effectiveRate, ERGO_HIGH_KG, ERGO_MEDIUM_KG } from './lineSim';
export { scoreStations } from './scoring';
export { recommendTech, evaluateFit, capexEstimate, investmentEstimate } from './techRecommender';
export { computeRoi, buildPortfolio, npvOf, irrOf, CONTRIBUTION_MARGIN } from './roi';
export { runMonteCarlo } from './montecarlo';
export { computeSensitivity } from './sensitivity';
export { buildRoadmap, phaseOf } from './roadmap';
export { computeVerdicts, VERDICT_LABEL, VERDICT_RULES } from './verdict';
export { evaluateOffice, OFFICE_CRITERIA } from './office';

/** Full deterministic analysis. Pure function of its inputs. */
export function runAnalysis(profile: CompanyProfile, line: Line, assumptions: Assumptions, catalog: TechClass[]): AnalysisBundle {
  const safeLine: Line = { ...line, stations: line?.stations ?? [] };
  const la = analyzeLine(profile, safeLine, assumptions);
  const scores = scoreStations(profile, safeLine, la, assumptions);
  const recommendations = recommendTech(profile, safeLine, la, scores, catalog ?? []);
  const roi = computeRoi(profile, safeLine, la, recommendations, catalog ?? [], assumptions);
  const portfolio0 = buildPortfolio(profile, roi, scores);
  const roadmap = buildRoadmap(portfolio0, roi, catalog ?? []);
  // Portfolio.selected in roadmap order
  const order = roadmap.filter((r) => r.withinBudget).map((r) => r.stationId);
  const portfolio = {
    ...portfolio0,
    selected: [...portfolio0.selected].sort((a, b) => order.indexOf(a.stationId) - order.indexOf(b.stationId)),
  };
  const monteCarlo = runMonteCarlo(profile, portfolio, assumptions);
  const sensitivity = computeSensitivity(profile, portfolio);
  const verdicts = computeVerdicts(safeLine.stations, scores, recommendations, roi, la);
  return { line: la, scores, recommendations, roi, portfolio, roadmap, monteCarlo, sensitivity, verdicts };
}

/** The line as it would look after the portfolio is implemented (for before/after views). */
export function simulateAfter(line: Line, roi: RoiResult[], catalog: TechClass[]): Line {
  const byStation = new Map(roi.map((r) => [r.stationId, r]));
  return {
    ...line,
    stations: (line?.stations ?? []).map((s) => {
      const r = byStation.get(s.id);
      const t = r && catalog.find((c) => c.id === r.techId);
      if (!r || !t) return s;
      const round2 = (x: number) => Math.round(x * 100) / 100;
      return {
        ...s,
        level: 'auto',
        ratePerMin: round2(num(s.ratePerMin) * (1 + num(t.rateUpliftPct))),
        operatorsPerShift: round2(Math.max(0, num(s.operatorsPerShift)) * (1 - clamp(num(t.labourReductionPct), 0, 1))),
        scrapRate: num(s.scrapRate) * (1 - clamp(num(t.scrapReductionPct), 0, 1)),
        downtimePct: num(s.downtimePct) * (1 - clamp(num(t.downtimeReductionPct), 0, 1)),
        liftKgPerUnit: t.ergonomicRelief ? 0 : s.liftKgPerUnit,
      };
    }),
  };
}
