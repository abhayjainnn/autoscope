import type { Assumptions, CompanyProfile, Line, LineAnalysis, OpportunityScore, ScoreFactor, ScoreFactorKey } from '../types';
import { clamp, eur, fmtN, num, pct } from './lineSim';

const LABELS: Record<ScoreFactorKey, string> = {
  labour: 'Labour cost',
  repetitiveness: 'Repetitiveness',
  ergonomics: 'Ergonomics',
  quality: 'Quality / scrap',
  bottleneck: 'Bottleneck',
  stability: 'Process stability',
};

const opsText = (ops: number, shifts: number) =>
  `${fmtN(ops)} operator${ops === 1 ? '' : 's'} × ${shifts} shift${shifts === 1 ? '' : 's'}`;

/**
 * Opportunity score per station: weighted sum of six 0–100 factors.
 * Weights come from assumptions.scoreWeights (normalised to sum 1).
 */
export function scoreStations(
  profile: CompanyProfile,
  line: Line,
  la: LineAnalysis,
  assumptions: Assumptions,
): OpportunityScore[] {
  const stations = line?.stations ?? [];
  const w = assumptions.scoreWeights ?? ({} as Assumptions['scoreWeights']);
  const keys: ScoreFactorKey[] = ['labour', 'repetitiveness', 'ergonomics', 'quality', 'bottleneck', 'stability'];
  const wSum = keys.reduce((a, k) => a + Math.max(0, num(w[k])), 0) || 1;
  const weight = (k: ScoreFactorKey) => Math.max(0, num(w[k])) / wSum;
  const maxLabour = Math.max(0, ...la.stations.map((s) => s.labourCostPerYear));
  const shifts = Math.max(1, num(profile.shifts, 1));
  const cpw = Math.max(0, num(profile.changeoversPerWeek));
  const unit = line.unitName || 'units';

  const scored = stations.map((s) => {
    const a = la.stations.find((x) => x.stationId === s.id)!;
    const ops = Math.max(0, num(s.operatorsPerShift));
    const manualShare = s.level === 'manual' ? 1 : s.level === 'semi' ? 0.7 : 0.15;

    // labour
    const labourV = maxLabour > 0 ? (100 * a.labourCostPerYear) / maxLabour : 0;
    const labourE =
      ops <= 0
        ? 'No operators assigned, so there is no labour to save.'
        : a.labourCostPerYear >= maxLabour - 1
          ? `${opsText(ops, shifts)} cost ${eur(a.labourCostPerYear)}/yr, the highest on the line.`
          : `${opsText(ops, shifts)} cost ${eur(a.labourCostPerYear)}/yr (${Math.round(labourV)}% of the costliest station).`;

    // repetitiveness
    const rep = clamp(num(s.repetitiveness, 3), 1, 5);
    const repV = ops > 0 ? ((rep - 1) / 4) * 100 * manualShare + (rep >= 4 ? 0 : 0) : 0;
    const repE =
      ops <= 0
        ? 'No manual work at this station.'
        : rep >= 4
          ? `Repetitiveness ${rep}/5: the same motion all shift, a classic automation task.`
          : rep >= 3
            ? `Repetitiveness ${rep}/5: partly routine work with some judgement involved.`
            : `Repetitiveness ${rep}/5: varied tasks that are harder to automate.`;

    // ergonomics
    const kg = a.kgLiftedPerShift;
    let ergoV = 0;
    if (a.ergonomicRisk === 'high') ergoV = clamp(70 + kg / 1000, 70, 100);
    else if (a.ergonomicRisk === 'medium') ergoV = clamp(40 + kg / 250, 40, 65);
    else ergoV = kg > 0 ? clamp(kg / 100, 0, 25) : 0;
    const kgPerUnit = num(s.liftKgPerUnit);
    const ergoE =
      kg <= 0
        ? 'No manual lifting recorded.'
        : `Each operator lifts ~${Math.round(kg).toLocaleString('en-US')} kg per shift (${fmtN(kgPerUnit)} kg per ${unit.replace(/s$/, '')}): ${a.ergonomicRisk} ergonomic risk.`;

    // quality
    const scrap = clamp(num(s.scrapRate), 0, 1);
    const qualV = clamp((scrap / 0.015) * 100, 0, 100);
    const qualE =
      scrap <= 0
        ? 'No scrap recorded at this station.'
        : `${pct(scrap, 1)} scrap costs ${eur(a.scrapCostPerYear)}/yr.`;

    // bottleneck
    const u = a.utilization;
    const bnV = a.isBottleneck && la.taktGapPct > 0 ? 100 : clamp(((u - 0.7) / 0.3) * 100, 0, 100);
    const bnE =
      a.isBottleneck && la.taktGapPct > 0
        ? `Line bottleneck: runs ${fmtN(a.effectiveRatePerMin)} ${unit}/min effective vs. a target of ${fmtN(line.targetRatePerMin)} (${pct(la.taktGapPct, 1)} short).`
        : a.isBottleneck
          ? `Slowest station on the line (${fmtN(a.effectiveRatePerMin)} ${unit}/min effective) but still meets the target.`
          : u > 0
            ? `Utilisation ${pct(u)} of capacity: ${u > 0.9 ? 'little headroom' : 'enough headroom'} at the current target.`
            : 'Outside the material flow, so it does not limit output.';

    // stability (easy to automate)
    const variab = clamp(num(s.variability, 3), 1, 5);
    const coHrs = (num(s.changeoverMin) * cpw) / 60;
    const stabV = clamp(100 - ((variab - 1) / 4) * 60 - Math.min(40, coHrs * 8), 0, 100);
    const stabE = `Variability ${variab}/5 and ${coHrs > 0 ? `${fmtN(coHrs)} h/week of changeovers` : 'no changeover effort'}: ${stabV >= 70 ? 'a stable process that is easy to automate' : stabV >= 45 ? 'moderately stable' : 'many formats make automation harder'}.`;

    const factors: ScoreFactor[] = (
      [
        ['labour', labourV, labourE],
        ['repetitiveness', repV, repE],
        ['ergonomics', ergoV, ergoE],
        ['quality', qualV, qualE],
        ['bottleneck', bnV, bnE],
        ['stability', stabV, stabE],
      ] as [ScoreFactorKey, number, string][]
    ).map(([key, v, explanation]) => {
      const value = Math.round(clamp(v, 0, 100));
      return { key, label: LABELS[key], value, weight: weight(key), contribution: value * weight(key), explanation };
    });

    const automatable = s.level !== 'auto' && (ops > 0 || scrap > 0);
    let score = factors.reduce((acc, f) => acc + f.contribution, 0);
    if (!automatable) score *= 0.2;
    // Without manual work, stability alone should not make a station attractive.
    if (ops <= 0) score *= 0.5;

    const reasons = [...factors]
      .filter((f) => f.value >= 20 && (f.key !== 'bottleneck' || f.value >= 60) && (f.key !== 'stability' || f.value >= 80))
      .sort((x, y) => y.contribution - x.contribution)
      .slice(0, 3)
      .map((f) => f.explanation);
    if (!automatable) reasons.unshift(s.level === 'auto' ? 'Already automated: only incremental gains possible.' : 'Nothing to gain: no operators and no scrap.');

    return { stationId: s.id, score: Math.round(clamp(score, 0, 100) * 10) / 10, rank: 0, factors, reasons: reasons.slice(0, 3), automatable };
  });

  scored.sort((a, b) => b.score - a.score);
  scored.forEach((s, i) => (s.rank = i + 1));
  return scored;
}
