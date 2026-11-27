import type { LineAnalysis, OpportunityScore, RoiResult, Station, StationVerdict, TechRecommendation, Verdict } from '../types';
export type { StationVerdict };

export const VERDICT_LABEL: Record<Verdict, string> = {
  now: 'Automate now',
  quick: 'Quick win / later',
  fix: 'Fix the process first',
  no: 'Do not automate',
  done: 'Already automated',
};

/** Thresholds used by the verdict rules (exported for transparency in the UI). */
export const VERDICT_RULES = {
  unstableDowntime: 0.06, // >= 6 % unplanned downtime = process not stable
  unstableScrap: 0.02, // >= 2 % scrap = process not stable
  highVariability: 4, // >= 4 of 5 = too many formats / irregular products
  nowScore: 45,
  nowPaybackYears: 2,
  cheapInvestment: 50_000,
  lowScore: 30,
};

const pctTxt = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Per-station verdict: the tool must be able to say "no".
 * Pure function of existing analysis outputs; it does not change any number.
 */
export function computeVerdicts(
  stations: Station[],
  scores: OpportunityScore[],
  recommendations: TechRecommendation[],
  roi: RoiResult[],
  line: LineAnalysis,
): StationVerdict[] {
  const R = VERDICT_RULES;
  const sc = new Map(scores.map((s) => [s.stationId, s]));
  const rec = new Map(recommendations.map((r) => [r.stationId, r]));
  const ro = new Map(roi.map((r) => [r.stationId, r]));
  const sa = new Map(line.stations.map((s) => [s.stationId, s]));

  return stations.map((st): StationVerdict => {
    const s = sc.get(st.id);
    const r = rec.get(st.id);
    const x = ro.get(st.id);
    const a = sa.get(st.id);
    const score = s?.score ?? 0;
    const downtime = st.downtimePct ?? 0;
    const scrap = st.scrapRate ?? 0;
    const unstable = downtime >= R.unstableDowntime || scrap >= R.unstableScrap;
    const instabilityTxt = [
      downtime >= R.unstableDowntime ? `${pctTxt(downtime)} unplanned downtime` : '',
      scrap >= R.unstableScrap ? `${pctTxt(scrap)} scrap` : '',
    ].filter(Boolean).join(' and ');
    const mk = (verdict: Verdict, message: string, label = VERDICT_LABEL[verdict]): StationVerdict => ({ stationId: st.id, verdict, label, message });

    // 1. No technology recommendation / not automatable
    if (!r?.best || !x || !s?.automatable) {
      if (st.level === 'auto') {
        if (unstable)
          return mk('fix', `Already automated, but ${instabilityTxt} shows the process is not stable. Stabilise it (root cause, maintenance, materials) before adding more automation around it.`);
        return mk('done', 'Already automated and running stably. Nothing to gain from more automation here.');
      }
      const why =
        st.variability >= R.highVariability
          ? 'too many formats or irregular products for a robust machine'
          : (a?.labourCostPerYear ?? 0) < 40_000
            ? 'too little manual labour to pay for a machine'
            : 'no technology in the catalogue fits this station well';
      return mk('no', `Do not automate: ${why}. Keep it manual and improve the method instead.`);
    }

    // 2. Process unstable or too variable -> fix first
    if (st.variability >= R.highVariability)
      return mk('fix', `Variability is ${st.variability}/5. Standardise formats and the incoming product first, then re-score. Automating chaos only makes it faster.`);
    if (unstable)
      return mk('fix', `${instabilityTxt[0].toUpperCase()}${instabilityTxt.slice(1)}: stabilise the process before automating, or the machine will inherit the losses.`);

    // 3. Strong score and fast payback -> now
    if (score >= R.nowScore && x.paybackYears <= R.nowPaybackYears)
      return mk('now', `Strong case: score ${Math.round(score)}/100 and payback in ${x.paybackYears < 1 ? `${Math.round(x.paybackYears * 12)} months` : `${x.paybackYears.toFixed(1)} years`}.`);

    // 4. Cheap and quick -> quick win
    if (x.totalInvestment <= R.cheapInvestment && x.paybackYears <= R.nowPaybackYears)
      return mk('quick', `Small, cheap step (about €${Math.round(x.totalInvestment / 1000)}k) that pays back fast. Do it alongside the main projects.`, 'Quick win');

    // 5. Low score -> no
    if (score < R.lowScore)
      return mk('no', `Score only ${Math.round(score)}/100: little manual load or risk to remove here. €${Math.round(x.totalInvestment / 1000)}k is better spent on the top stations.`);

    // 6. Attractive but slower / bigger -> later
    return mk('quick', `Worth doing, but the score (${Math.round(score)}/100) or payback (${x.paybackYears.toFixed(1)} yrs) puts it behind the top projects. Do it later or only if a cheap offer comes up.`, 'Later / only if cheap');
  });
}
