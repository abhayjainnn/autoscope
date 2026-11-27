import type {
  CompanyProfile,
  Hygiene,
  Line,
  LineAnalysis,
  OpportunityScore,
  Station,
  StationAnalysis,
  TechClass,
  TechRecommendation,
} from '../types';
import { clamp, eur, fmtN, num } from './lineSim';

/** Capex scaling for hygienic execution (stainless, IP69K, open design). */
export const hygieneFactor = (h: Hygiene) => (h === 'washdown' ? 1.15 : 1);

export function capexEstimate(t: TechClass, h: Hygiene): number {
  const lo = Math.max(0, num(t.capexMin));
  const hi = Math.max(lo, num(t.capexMax));
  return ((lo + hi) / 2) * hygieneFactor(h);
}
export function investmentEstimate(t: TechClass, h: Hygiene): number {
  return capexEstimate(t, h) * (1 + Math.max(0, num(t.integrationPct)));
}

/** Lower-case the first letter for use mid-sentence unless it is an acronym. */
export const inSentence = (name: string) => (/^[A-Z][a-z]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name);
const article = (name: string) => (/^[aeiouAEIOU]/.test(name) ? 'an' : 'a');
const aName = (t: TechClass) => `${article(inSentence(t.name))} ${inSentence(t.name)}`;

/** Rate the technology must handle: the line's demanded takt (or the station's own rate if no target). */
export const demandRate = (line: Line, s: Station) => (num(line.targetRatePerMin) > 0 ? num(line.targetRatePerMin) : num(s.ratePerMin));

interface Check {
  delta: number;
  text: string; // positive reason (delta > 0) or issue (delta < 0)
}

export function evaluateFit(t: TechClass, s: Station, sa: StationAnalysis | undefined, line: Line, profile: CompanyProfile, la: LineAnalysis) {
  const checks: Check[] = [];
  const unit = line.unitName || 'units';
  const d = demandRate(line, s);
  const minR = num(t.minRatePerMin);
  const maxR = Math.max(minR, num(t.maxRatePerMin));
  const isSoftware = t.category === 'software';

  // 1. rate window
  if (!isSoftware && d > 0) {
    if (d < minR) {
      checks.push({
        delta: -(15 + 25 * clamp((minR - d) / Math.max(minR, 1e-9), 0, 1)),
        text: `Line runs ${fmtN(d)} ${unit}/min; ${aName(t)} is sized for ${fmtN(minR)}–${fmtN(maxR)}, so you'd pay for capacity you don't use.`,
      });
    } else if (d > maxR) {
      checks.push({
        delta: -40,
        text: `Line needs ${fmtN(d)} ${unit}/min but ${aName(t)} tops out around ${fmtN(maxR)}, so it would become the new bottleneck.`,
      });
    } else {
      const pos = (d - minR) / Math.max(maxR - minR, 1e-9);
      // Oversizing only matters where capacity drives price (robots, special machines, AGVs).
      const sizeMatters = t.category === 'robot' || t.category === 'special_machine' || t.category === 'agv';
      if (sizeMatters && pos < 0.15 && maxR / d > 2.5) {
        checks.push({
          delta: -12,
          text: `At ${fmtN(d)} ${unit}/min you'd use only ~${Math.round((100 * d) / maxR)}% of ${aName(t)}'s ${fmtN(maxR)} ${unit}/min capacity, so it is oversized for this line.`,
        });
      } else {
        checks.push({ delta: 10, text: `Sized right: ${fmtN(d)} ${unit}/min sits inside its ${fmtN(minR)}–${fmtN(maxR)} ${unit}/min window.` });
      }
    }
  }

  // 2. variability
  const v = clamp(num(s.variability, 3), 1, 5);
  if (v > t.maxVariability) {
    checks.push({
      delta: -12 * (v - t.maxVariability),
      text: `It handles format variability up to ${t.maxVariability}/5, but this station is at ${v}/5 (${profile.skuCount} SKUs), so expect frequent stops and manual help.`,
    });
  } else if (v >= 3 && t.maxVariability >= 4) {
    checks.push({ delta: 4, text: `Copes with your ${profile.skuCount} SKUs (variability ${v}/5) via recipes and quick format changes.` });
  }

  // 3. hygiene
  if (!t.hygiene.includes(profile.hygiene)) {
    checks.push({ delta: -30, text: `It is not offered in ${profile.hygiene} execution, which your plant requires.` });
  }

  // 4. budget
  const inv = investmentEstimate(t, profile.hygiene);
  const budget = Math.max(0, num(profile.budget));
  if (budget > 0) {
    if (inv > budget) {
      checks.push({ delta: -25, text: `At ~${eur(inv)} all-in it alone exceeds your ${eur(budget)} automation budget.` });
    } else if (inv > 0.6 * budget) {
      checks.push({ delta: -8, text: `At ~${eur(inv)} all-in it would tie up ${Math.round((100 * inv) / budget)}% of your ${eur(budget)} budget.` });
    } else if (inv < 0.5 * budget) {
      checks.push({ delta: 5, text: `Affordable: ~${eur(inv)} all-in, ${Math.round((100 * inv) / budget)}% of your budget.` });
    }
  }

  // 5. goal alignment
  const goals = profile.goals ?? [];
  const ops = Math.max(0, num(s.operatorsPerShift));
  if (goals.includes('ergonomics') && sa && sa.ergonomicRisk !== 'low') {
    if (t.ergonomicRelief)
      checks.push({ delta: 12, text: `Takes the ~${Math.round(sa.kgLiftedPerShift).toLocaleString('en-US')} kg/shift of lifting off your operators (ergonomics goal).` });
    else checks.push({ delta: -6, text: `It does not remove the manual lifting, which is your ergonomics priority here.` });
  }
  if ((goals.includes('labour_shortage') || goals.includes('cost')) && ops > 0) {
    const freed = ops * num(profile.shifts) * t.labourReductionPct;
    const w = (goals.includes('labour_shortage') ? 12 : 0) + (goals.includes('cost') ? 8 : 0);
    checks.push({
      delta: w * t.labourReductionPct,
      text: `Frees ~${fmtN(freed)} FTE (${Math.round(t.labourReductionPct * 100)}% of the station's labour) for ${goals.includes('labour_shortage') ? 'hard-to-fill positions' : 'other work'}.`,
    });
  }
  if (goals.includes('quality') && num(s.scrapRate) > 0) {
    checks.push({ delta: 15 * t.scrapReductionPct, text: `Cuts scrap at this station by ~${Math.round(t.scrapReductionPct * 100)}% (quality goal).` });
  }
  if (goals.includes('throughput')) {
    const bn = sa?.isBottleneck && la.taktGapPct > 0;
    checks.push({
      delta: 20 * t.rateUpliftPct * (bn ? 2 : 1),
      text: bn
        ? `Lifts capacity of the bottleneck by ~${Math.round(t.rateUpliftPct * 100)}% (throughput goal).`
        : `Adds ~${Math.round(t.rateUpliftPct * 100)}% capacity at this station.`,
    });
  }
  // Software is a light-touch fix for physically demanding manual stations.
  if (isSoftware && sa && sa.kgLiftedPerShift > 0) checks.push({ delta: -15, text: 'Software alone does not change the physical handling at this station.' });

  const fit = Math.round(clamp(60 + checks.reduce((a, c) => a + c.delta, 0), 0, 100));
  return { fit, checks, investment: inv };
}

export function recommendTech(
  profile: CompanyProfile,
  line: Line,
  la: LineAnalysis,
  scores: OpportunityScore[],
  catalog: TechClass[],
): TechRecommendation[] {
  const out: TechRecommendation[] = [];
  for (const s of line?.stations ?? []) {
    const sc = scores.find((x) => x.stationId === s.id);
    const sa = la.stations.find((x) => x.stationId === s.id);
    const candidates = (catalog ?? []).filter((t) => t.suitableStationTypes?.includes(s.type));
    if (!sc?.automatable || candidates.length === 0) {
      out.push({ stationId: s.id, best: null, alternatives: [] });
      continue;
    }
    const evals = candidates
      .map((t) => ({ t, ...evaluateFit(t, s, sa, line, profile, la) }))
      .sort((a, b) => b.fit - a.fit || a.investment - b.investment);
    const best = evals[0];
    const reasons = best.checks
      .filter((c) => c.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 4)
      .map((c) => c.text);
    if (reasons.length < 2) {
      reasons.push(`Best match of ${evals.length} technology class${evals.length === 1 ? '' : 'es'} suited to ${s.type.replace(/_/g, ' ')}.`);
    }
    // Mention the remaining caveat honestly.
    const caveat = best.checks.filter((c) => c.delta < 0).sort((a, b) => a.delta - b.delta)[0];
    if (caveat && reasons.length < 4) reasons.push(`Watch out: ${caveat.text}`);

    const alternatives = evals.slice(1).map((e) => ({ techId: e.t.id, fit: e.fit, whyNot: whyNot(e, best, s, profile) }));
    out.push({ stationId: s.id, best: { techId: best.t.id, fit: best.fit, reasons: reasons.slice(0, 4) }, alternatives });
  }
  return out;
}

type Eval = { t: TechClass; fit: number; checks: Check[]; investment: number };

function whyNot(alt: Eval, best: Eval, s: Station, profile: CompanyProfile): string {
  const issues = alt.checks.filter((c) => c.delta < 0).sort((a, b) => a.delta - b.delta);
  const bestName = inSentence(best.t.name);
  if (issues.length > 0) {
    const main = issues.slice(0, 2).map((c) => c.text);
    return main.join(' ') + (issues.length > 2 ? ` (+${issues.length - 2} more drawback${issues.length - 2 === 1 ? '' : 's'})` : '');
  }
  const ratio = best.investment > 0 ? alt.investment / best.investment : 1;
  const ops = Math.max(0, num(s.operatorsPerShift));
  if (ratio > 1.3) {
    return `Technically feasible, but at ~${eur(alt.investment)} all-in it costs ${ratio.toFixed(1)}× the ${bestName} (~${eur(best.investment)}) for ${alt.t.labourReductionPct > best.t.labourReductionPct ? 'only moderately more' : 'no more'} labour relief.`;
  }
  if (ops > 0 && alt.t.labourReductionPct < best.t.labourReductionPct - 0.05) {
    const fa = ops * profile.shifts * alt.t.labourReductionPct;
    const fb = ops * profile.shifts * best.t.labourReductionPct;
    return `Cheaper or similar in price, but frees only ~${fmtN(fa)} FTE vs ~${fmtN(fb)} FTE with the ${bestName}.`;
  }
  if (best.t.ergonomicRelief && !alt.t.ergonomicRelief) {
    return `Does not take the manual lifting off operators, which the ${bestName} does.`;
  }
  return `Close runner-up (fit ${alt.fit} vs ${best.fit}); the ${bestName} matches your goals and budget slightly better.`;
}
