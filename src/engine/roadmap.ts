import type { Phase, Portfolio, RoadmapItem, RoiResult, TechClass } from '../types';

const PHASE_ORDER: Record<Phase, number> = { quick_win: 0, mid_term: 1, strategic: 2 };

export function phaseOf(r: RoiResult, tech: TechClass | undefined): Phase {
  const lead = tech?.leadTimeWeeks ?? 12;
  if (r.totalInvestment < 60000 && r.paybackYears < 1.5 && lead <= 12) return 'quick_win';
  if (r.totalInvestment > 250000) return 'strategic';
  return 'mid_term';
}

/**
 * Roadmap: selected (in-budget) items first, ordered by phase then payback; then
 * further positive-NPV items that did not fit the budget (withinBudget=false).
 * Projects start sequentially with modest overlap (next starts after ~60% of the previous).
 */
export function buildRoadmap(portfolio: Portfolio, roi: RoiResult[], catalog: TechClass[]): RoadmapItem[] {
  const tech = (id: string) => catalog.find((t) => t.id === id);
  const order = (a: RoiResult, b: RoiResult) =>
    PHASE_ORDER[phaseOf(a, tech(a.techId))] - PHASE_ORDER[phaseOf(b, tech(b.techId))] || a.paybackYears - b.paybackYears;
  const selIds = new Set(portfolio.selected.map((r) => r.stationId));
  const inBudget = [...portfolio.selected].sort(order);
  const outBudget = roi.filter((r) => !selIds.has(r.stationId) && r.npv > 0 && r.netAnnualBenefit > 0).sort(order);

  const items: RoadmapItem[] = [];
  let cursor = 0;
  let cumulative = 0;
  for (const [list, within] of [
    [inBudget, true],
    [outBudget, false],
  ] as [RoiResult[], boolean][]) {
    for (const r of list) {
      const t = tech(r.techId);
      const durationMonths = Math.max(1, Math.round((t?.leadTimeWeeks ?? 12) / 4 + 1));
      cumulative += r.totalInvestment;
      items.push({
        stationId: r.stationId,
        techId: r.techId,
        phase: phaseOf(r, t),
        startMonth: cursor,
        durationMonths,
        investment: r.totalInvestment,
        cumulativeInvestment: cumulative,
        withinBudget: within,
      });
      cursor += Math.max(1, Math.round(durationMonths * 0.6));
    }
  }
  return items;
}
