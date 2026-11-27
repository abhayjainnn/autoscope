import { Printer, ScanSearch, Target, Cpu, PiggyBank, Map as MapIcon, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, PageHeader } from '../components/ui';
import { useAnalysis, useApp } from '../store';
import { eur, pct, years, num, PHASE_LABEL, SUBSECTOR_LABEL, STATION_TYPE_LABEL } from '../lib/format';
import type { AnalysisBundle, Phase } from '../types';

const PRINT_CSS = `
@page { size: A4; margin: 10mm; }
@media print {
  html, body { background: #fff !important; }
  .report-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; width: auto !important; max-width: none !important; padding: 0 !important; min-height: 0 !important; }
  .report-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .report-avoid { break-inside: avoid; }
}
`;

const PHASE_COLOR: Record<Phase, string> = { quick_win: '#10b981', mid_term: '#1d6ef1', strategic: '#8b5cf6' };

export default function Report() {
  const a: AnalysisBundle = useAnalysis();
  const profile = useApp((s) => s.profile);
  const line = useApp((s) => s.line);
  const catalog = useApp((s) => s.catalog);
  const assumptions = useApp((s) => s.assumptions);

  const st = (id: string) => line.stations.find((s) => s.id === id);
  const stName = (id: string) => st(id)?.name ?? id;
  const techName = (id: string) => catalog.find((t) => t.id === id)?.name ?? id;

  const p = a.portfolio;
  const mc = a.monteCarlo;
  const H = profile.horizonYears;
  const top = a.scores.filter((s) => s.automatable).slice(0, 3);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const has = p.selected.length > 0;

  // ---------- computed executive summary (deterministic, not AI)
  const topNames = top.map((t) => stName(t.stationId));
  const listText = topNames.length > 1 ? `${topNames.slice(0, -1).join(', ')} and ${topNames[topNames.length - 1]}` : topNames[0] ?? '';
  const bott = a.line.bottleneckId ? stName(a.line.bottleneckId) : null;
  const s1 = top.length
    ? `Across ${line.stations.length} stations on the ${line.name || 'packaging'} line, the strongest automation candidates are ${listText}${bott ? `, with ${bott} currently limiting output` : ''}.`
    : `No station on the ${line.name || 'packaging'} line currently shows a clear automation case.`;
  const s2 = has
    ? `A ${p.selected.length}-project plan within the ${eur(profile.budget)} budget requires ${eur(p.totalInvestment)}, returns ${eur(p.totalNetAnnualBenefit)} per year net, pays back in ${years(p.paybackYears)} and frees ${num(p.fteFreed, 1)} FTE for higher-value work.`
    : `No project fits the current ${eur(profile.budget)} budget; increasing the budget or revisiting station data is recommended.`;
  const s3 = has
    ? `In ${num(mc.runs)} simulated futures the plan pays back within ${H} years in ${pct(mc.probPaybackWithinHorizon)} of cases (NPV range ${eur(mc.npvP10)} to ${eur(mc.npvP90)}), so we recommend ${mc.probPaybackWithinHorizon >= 0.7 ? 'proceeding to integrator quotes and a pilot' : 'validating the key assumptions before committing'}.`
    : `Results are indicative and should be validated with integrator quotes.`;

  const phases = (['quick_win', 'mid_term', 'strategic'] as Phase[]).map((ph) => {
    const its = a.roadmap.filter((r) => r.phase === ph && r.withinBudget);
    return {
      ph,
      its,
      inv: its.reduce((s, i) => s + i.investment, 0),
      from: its.length ? Math.min(...its.map((i) => i.startMonth)) : 0,
      to: its.length ? Math.max(...its.map((i) => i.startMonth + i.durationMonths)) : 0,
    };
  });
  const overBudget = a.roadmap.filter((r) => !r.withinBudget);

  return (
    <div>
      <style>{PRINT_CSS}</style>
      <div className="no-print">
        <PageHeader
          eyebrow="Act"
          title="Executive report"
          subtitle="A one-page summary for your managing director or bank. Prints cleanly to A4."
          actions={
            <Button onClick={() => window.print()}>
              <Printer size={16} /> Download PDF / Print
            </Button>
          }
        />
      </div>

      <article className="report-sheet mx-auto w-full max-w-[210mm] rounded-sm border border-ink-100 bg-white p-6 text-[11px] leading-snug text-ink-700 shadow-xl md:p-10">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b-2 border-ink-900 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <ScanSearch size={18} />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-ink-900">AutoScope</div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">Vendor-neutral automation assessment</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-ink-900">{profile.name}</div>
            <div className="text-[10px] text-ink-500">
              {SUBSECTOR_LABEL[profile.subSector] ?? profile.subSector} · {num(profile.employees)} employees · {date}
            </div>
          </div>
        </header>

        {/* Summary */}
        <section className="report-avoid mt-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-brand-700">Executive summary</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-800">
            {s1} {s2} {s3}
          </p>
        </section>

        {/* KPI strip */}
        <section className="report-avoid mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Kpi label="Investment" value={eur(p.totalInvestment)} sub={`${pct(p.budgetUsedPct)} of budget`} />
          <Kpi label="Net benefit / yr" value={eur(p.totalNetAnnualBenefit)} />
          <Kpi label="Payback" value={years(p.paybackYears)} sub={`P10–P90 ${years(mc.paybackP10)}–${years(mc.paybackP90)}`} />
          <Kpi label={`NPV ${H} yrs`} value={eur(p.npv)} sub={`@ ${pct(profile.discountRate)}`} />
          <Kpi label="FTE freed" value={num(p.fteFreed, 1)} />
          <Kpi label={`Pays back ≤ ${H} yrs`} value={has ? pct(mc.probPaybackWithinHorizon) : '—'} sub={`${num(mc.runs)} simulations`} highlight />
        </section>

        {/* Three answers */}
        <section className="mt-4 grid gap-4 sm:grid-cols-3">
          <Answer icon={<Target size={13} />} n="1" title="What to automate">
            {top.length === 0 && <p className="text-ink-400">No clear candidates.</p>}
            <ol className="space-y-2">
              {top.map((t, i) => (
                <li key={t.stationId}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink-900">
                      {i + 1}. {stName(t.stationId)}
                    </span>
                    <span className="shrink-0 rounded bg-brand-50 px-1.5 font-bold text-brand-700">{Math.round(t.score)}</span>
                  </div>
                  <div className="mt-0.5 h-1 w-full rounded bg-ink-100">
                    <div className="h-1 rounded bg-brand-500" style={{ width: `${Math.min(100, t.score)}%` }} />
                  </div>
                  <div className="mt-0.5 text-[10px] text-ink-500">{t.reasons.slice(0, 2).join('; ') || STATION_TYPE_LABEL[st(t.stationId)?.type ?? '']}</div>
                </li>
              ))}
            </ol>
          </Answer>

          <Answer icon={<Cpu size={13} />} n="2" title="How (technology class)">
            <ul className="space-y-2">
              {top.map((t) => {
                const rec = a.recommendations.find((r) => r.stationId === t.stationId);
                const alt = rec?.alternatives[0];
                return (
                  <li key={t.stationId}>
                    <div className="font-semibold text-ink-900">{rec?.best ? techName(rec.best.techId) : 'No suitable class'}</div>
                    <div className="text-[10px] text-ink-500">
                      for {stName(t.stationId)}
                      {rec?.best ? ` · fit ${Math.round(rec.best.fit)}` : ''}
                    </div>
                    {alt && (
                      <div className="mt-0.5 text-[10px] text-ink-500">
                        <span className="text-ink-400">vs {techName(alt.techId)}:</span> {alt.whyNot}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Answer>

          <Answer icon={<PiggyBank size={13} />} n="3" title="Does it pay off">
            <table className="w-full">
              <tbody>
                {p.selected.slice(0, 5).map((x) => (
                  <tr key={x.stationId} className="border-b border-ink-50">
                    <td className="py-0.5 pr-1 text-ink-800">{stName(x.stationId)}</td>
                    <td className="py-0.5 text-right tabular-nums">{eur(x.totalInvestment)}</td>
                    <td className="py-0.5 pl-1 text-right font-semibold tabular-nums text-ink-900">{years(x.paybackYears)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {p.selected.length > 5 && <div className="mt-0.5 text-[10px] text-ink-400">+{p.selected.length - 5} more</div>}
            <div className="mt-2 rounded-md bg-emerald-50 p-2 text-[10px] text-emerald-800">
              {has ? (
                <>
                  <b>{pct(mc.probPaybackWithinHorizon)}</b> probability of payback within {H} years. Median NPV {eur(mc.npvP50)}.
                  {a.sensitivity[0] && <> Most sensitive to <b>{a.sensitivity[0].label.toLowerCase()}</b>.</>}
                </>
              ) : (
                'No project fits the budget.'
              )}
            </div>
          </Answer>
        </section>

        {/* Roadmap */}
        <section className="report-avoid mt-4">
          <SectionTitle icon={<MapIcon size={12} />}>Roadmap in brief</SectionTitle>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
            {phases.map(({ ph, its, inv, from, to }) => (
              <div key={ph} className="rounded-md border border-ink-100 p-2" style={{ borderTop: `3px solid ${PHASE_COLOR[ph]}` }}>
                <div className="flex justify-between font-semibold text-ink-900">
                  <span>{PHASE_LABEL[ph]}</span>
                  <span>{eur(inv)}</span>
                </div>
                <div className="text-[10px] text-ink-400">{its.length ? `Month ${from}–${to}` : 'No items'}</div>
                <div className="mt-0.5 text-[10px] text-ink-600">{its.map((i) => `${stName(i.stationId)} (${techName(i.techId)})`).join(', ')}</div>
              </div>
            ))}
          </div>
          {overBudget.length > 0 && (
            <div className="mt-1 text-[10px] text-ink-400">
              Beyond current budget: {overBudget.map((o) => `${stName(o.stationId)} (${eur(o.investment)})`).join(', ')}.
            </div>
          )}
        </section>

        {/* Assumptions + disclaimer */}
        <section className="report-avoid mt-4 grid gap-4 sm:grid-cols-[1.3fr_1fr]">
          <div>
            <SectionTitle icon={<ShieldCheck size={12} />}>Key assumptions</SectionTitle>
            <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
              <Li k="Operating time" v={`${profile.shifts} × ${profile.hoursPerShift} h × ${profile.operatingDaysPerYear} d`} />
              <Li k="Labour cost" v={`€${num(profile.labourCostPerHour)}/h loaded`} />
              <Li k="Target rate" v={`${num(line.targetRatePerMin)} ${line.unitName}/min`} />
              <Li k="Unit value" v={`€${num(profile.unitValueEur, 2)}`} />
              <Li k="Horizon / discount" v={`${H} yrs / ${pct(profile.discountRate)}`} />
              <Li k="Budget" v={eur(profile.budget)} />
              <Li k="Capex uncertainty" v={`±${pct(assumptions.costUncertaintyPct)}`} />
              <Li k="Savings uncertainty" v={`±${pct(assumptions.savingsUncertaintyPct)}`} />
            </ul>
          </div>
          <div className="rounded-md bg-ink-50 p-2.5 text-[9.5px] leading-relaxed text-ink-500">
            <b className="text-ink-700">Vendor-neutral disclaimer.</b> AutoScope recommends technology classes, not suppliers, and receives no commissions. All figures are
            indicative ranges from a deterministic model using benchmark data and your inputs; validate with 2–3 integrator quotes before investing. AI was used only to
            capture inputs and explain results, never to compute numbers.
          </div>
        </section>

        <footer className="mt-4 flex justify-between border-t border-ink-100 pt-2 text-[9px] text-ink-400">
          <span>Generated by AutoScope · {date}</span>
          <span>Indicative ranges; validate with quotes.</span>
        </footer>
      </article>
    </div>
  );
}

function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={highlight ? 'rounded-md bg-emerald-600 p-2 text-white' : 'rounded-md border border-ink-100 bg-ink-50 p-2'}>
      <div className={highlight ? 'text-[9px] font-medium text-white/85' : 'text-[9px] font-medium text-ink-500'}>{label}</div>
      <div className={highlight ? 'text-base font-extrabold' : 'text-base font-bold text-ink-900'}>{value}</div>
      {sub && <div className={highlight ? 'text-[8.5px] text-white/80' : 'text-[8.5px] text-ink-400'}>{sub}</div>}
    </div>
  );
}

function Answer({ icon, n, title, children }: { icon: ReactNode; n: string; title: string; children: ReactNode }) {
  return (
    <div className="report-avoid">
      <div className="mb-1.5 flex items-center gap-1.5 border-b border-ink-100 pb-1">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-ink-900 text-[10px] font-bold text-white">{n}</span>
        <span className="text-brand-600">{icon}</span>
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
      {icon}
      {children}
    </h2>
  );
}

function Li({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex justify-between gap-2 border-b border-dotted border-ink-200 py-0.5">
      <span className="text-ink-500">{k}</span>
      <span className="font-medium text-ink-800">{v}</span>
    </li>
  );
}
