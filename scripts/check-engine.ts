// Sanity check: prints the demo analysis. Run: npx esbuild scripts/check-engine.ts --bundle --platform=node --outfile=<tmp>/check.mjs --format=esm && node <tmp>/check.mjs
import { runAnalysis } from '../src/engine';
import { DEMO_LINE, DEMO_PROFILE } from '../src/data/demo';
import { DEFAULT_ASSUMPTIONS, LINE_TEMPLATES } from '../src/data/templates';
import { TECH_CATALOG } from '../src/data/catalog';
import type { Line } from '../src/types';

const k = (x: number) => `€${Math.round(x / 1000)}k`;
const b = runAnalysis(DEMO_PROFILE, DEMO_LINE, DEFAULT_ASSUMPTIONS, TECH_CATALOG);
const name = (id: string) => DEMO_LINE.stations.find((s) => s.id === id)?.name ?? id;
const tname = (id: string) => TECH_CATALOG.find((t) => t.id === id)?.name ?? id;

console.log('LINE', { rate: b.line.lineRatePerMin.toFixed(2), bn: b.line.bottleneckId, gap: b.line.taktGapPct.toFixed(3), oee: b.line.oee.toFixed(3), labour: k(b.line.totalLabourCostPerYear) });
for (const s of b.scores) {
  const a = b.line.stations.find((x) => x.stationId === s.stationId)!;
  console.log(`#${s.rank} ${name(s.stationId)} score=${s.score} auto=${s.automatable} ergo=${a.ergonomicRisk} kg=${Math.round(a.kgLiftedPerShift)} labour=${k(a.labourCostPerYear)}`);
  for (const r of s.reasons) console.log('     - ' + r);
}
for (const r of b.recommendations) {
  if (!r.best) continue;
  console.log(`\n${name(r.stationId)} -> ${tname(r.best.techId)} (fit ${r.best.fit})`);
  for (const x of r.best.reasons) console.log('   + ' + x);
  for (const a of r.alternatives) console.log(`   x ${tname(a.techId)} (${a.fit}): ${a.whyNot}`);
}
console.log('\nROI');
for (const r of b.roi)
  console.log(`${name(r.stationId)} / ${tname(r.techId)}: inv ${k(r.totalInvestment)} net ${k(r.netAnnualBenefit)}/yr payback ${r.paybackYears.toFixed(2)} npv ${k(r.npv)} irr ${r.irr?.toFixed(2)} risk ${r.riskScore} fte ${r.fteFreed.toFixed(1)}`, r.annualSavings);
const p = b.portfolio;
console.log('\nPORTFOLIO', p.selected.map((r) => r.stationId), { inv: k(p.totalInvestment), net: k(p.totalNetAnnualBenefit), payback: p.paybackYears.toFixed(2), npv: k(p.npv), fte: p.fteFreed, budget: p.budgetUsedPct.toFixed(2) });
console.log('ROADMAP', b.roadmap);
console.log('MC', b.monteCarlo);
console.log('SENS', b.sensitivity.map((s) => `${s.label}: ${k(s.npvLow)}..${k(s.npvHigh)}`));

// robustness
const empty: Line = { name: 'x', unitName: 'cases', targetRatePerMin: 0, stations: [] };
const e = runAnalysis({ ...DEMO_PROFILE, budget: 0, shifts: 0 }, empty, DEFAULT_ASSUMPTIONS, TECH_CATALOG);
console.log('\nEMPTY', JSON.stringify(e).includes('null') ? 'has nulls (ok if irr)' : 'ok', e.portfolio, e.monteCarlo.runs);
for (const [sec, l] of Object.entries(LINE_TEMPLATES)) {
  const t = runAnalysis({ ...DEMO_PROFILE, subSector: sec as never }, l, DEFAULT_ASSUMPTIONS, TECH_CATALOG);
  const bad = JSON.stringify(t, (_k, v) => (typeof v === 'number' && Number.isNaN(v) ? 'NaN!!' : v)).includes('NaN!!');
  console.log(sec, 'top:', t.scores.slice(0, 3).map((s) => s.stationId).join(','), 'portfolio', t.portfolio.selected.map((r) => `${r.stationId}:${r.techId}`).join(' '), k(t.portfolio.totalInvestment), 'pb', t.portfolio.paybackYears.toFixed(2), bad ? 'NaN FOUND' : '');
}
