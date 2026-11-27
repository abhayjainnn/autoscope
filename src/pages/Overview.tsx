import { Link } from 'react-router-dom';
import { ArrowRight, Target, Cpu, PiggyBank, Video, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAnalysis, useApp, useOffice } from '../store';
import { VerdictChip, VERDICT_ORDER, VERDICT_STYLE } from '../components/VerdictChip';
import { fmtMonths } from '../engine/office';
import { Badge, Card, PageHeader, ScoreBar, Stat } from '../components/ui';
import { eur, num, pct, years, STATION_TYPE_LABEL } from '../lib/format';

export default function Overview() {
  const profile = useApp((s) => s.profile);
  const line = useApp((s) => s.line);
  const catalog = useApp((s) => s.catalog);
  const b = useAnalysis();
  const stationName = (id: string | null) => line.stations.find((s) => s.id === id)?.name ?? '—';
  const techName = (id?: string) => catalog.find((t) => t.id === id)?.name ?? '—';
  const top = b.scores.filter((s) => s.automatable).slice(0, 3);
  const pf = b.portfolio;
  const off = useOffice();
  const vcount = (v: string) => (b.verdicts ?? []).filter((x) => x.verdict === v).length;
  const noList = (b.verdicts ?? []).filter((v) => v.verdict === 'no' || v.verdict === 'fix');

  return (
    <div>
      <PageHeader
        eyebrow={profile.name}
        title="Your automation picture at a glance"
        subtitle="Three answers: what to automate, with which technology, and whether it pays off. Every number below is computed from your inputs and can be traced and edited."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Line output vs target" value={`${num(b.line.lineRatePerMin, 1)} / ${num(line.targetRatePerMin, 1)}`} hint={`${line.unitName}/min · ${b.line.taktGapPct > 0 ? `${pct(b.line.taktGapPct)} short of target` : 'meets target'}`} tone={b.line.taktGapPct > 0 ? 'warn' : 'good'} />
        <Stat label="Bottleneck" value={<span className="text-lg">{stationName(b.line.bottleneckId)}</span>} hint={`Estimated OEE ${pct(b.line.oee)}`} tone="bad" />
        <Stat label="Recommended investment" value={eur(pf.totalInvestment)} hint={`${pct(pf.budgetUsedPct)} of ${eur(profile.budget)} budget`} tone="brand" />
        <Stat label="Payback" value={years(pf.paybackYears)} hint={`${pct(b.monteCarlo.probPaybackWithinHorizon)} chance within ${profile.horizonYears} yrs`} tone="good" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card title={<span className="flex items-center gap-2"><Target size={16} className="text-brand-600" /> What to automate</span>} actions={<Link to="/opportunities" className="text-xs font-semibold text-brand-600">Details →</Link>}>
          <ol className="space-y-3">
            {top.map((s) => (
              <li key={s.stationId}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{s.rank}. {stationName(s.stationId)}</span>
                  <span className="font-bold tabular-nums text-brand-700">{Math.round(s.score)}</span>
                </div>
                <ScoreBar value={s.score} />
                <div className="mt-1 text-xs text-ink-500">{s.reasons[0]}</div>
              </li>
            ))}
            {top.length === 0 && <li className="text-sm text-ink-500">No automatable stations yet. Map your line first.</li>}
          </ol>
        </Card>

        <Card title={<span className="flex items-center gap-2"><Cpu size={16} className="text-brand-600" /> How to automate it</span>} actions={<Link to="/technology" className="text-xs font-semibold text-brand-600">Details →</Link>}>
          <ul className="space-y-3">
            {top.map((s) => {
              const rec = b.recommendations.find((r) => r.stationId === s.stationId);
              return (
                <li key={s.stationId} className="rounded-xl bg-ink-50 p-3">
                  <div className="text-xs text-ink-500">{stationName(s.stationId)}</div>
                  <div className="text-sm font-semibold">{techName(rec?.best?.techId)}</div>
                  {rec?.alternatives[0] && <div className="mt-1 text-xs text-ink-500">Beat {techName(rec.alternatives[0].techId)}: {rec.alternatives[0].whyNot}</div>}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title={<span className="flex items-center gap-2"><PiggyBank size={16} className="text-brand-600" /> Does it pay off?</span>} actions={<Link to="/roi" className="text-xs font-semibold text-brand-600">Details →</Link>}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-ink-500">Net benefit / yr</dt><dd className="font-bold">{eur(pf.totalNetAnnualBenefit)}</dd></div>
            <div><dt className="text-xs text-ink-500">NPV ({profile.horizonYears} yrs)</dt><dd className="font-bold">{eur(pf.npv)}</dd></div>
            <div><dt className="text-xs text-ink-500">Payback range</dt><dd className="font-bold">{years(b.monteCarlo.paybackP10)} – {years(b.monteCarlo.paybackP90)}</dd></div>
            <div><dt className="text-xs text-ink-500">Jobs relieved</dt><dd className="font-bold">{num(pf.fteFreed, 1)} FTE</dd></div>
          </dl>
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle2 size={14} className="mr-1 inline" />
            {pf.selected.length} projects fit your budget. Freed operators can move to roles you currently can't fill.
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title="Verdicts: where we say yes, and where we say no" actions={<Link to="/opportunities" className="text-xs font-semibold text-brand-600">Details →</Link>}>
          <div className="grid grid-cols-5 gap-2 text-center">
            {VERDICT_ORDER.map((v) => (
              <Link key={v} to="/opportunities" className="rounded-xl border border-ink-100 px-1 py-2 hover:bg-ink-50">
                <div className="text-2xl font-bold tabular-nums" style={{ color: VERDICT_STYLE[v].dot }}>{vcount(v)}</div>
                <div className="text-[10px] leading-tight text-ink-500">{VERDICT_STYLE[v].name}</div>
              </Link>
            ))}
          </div>
          {noList.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-xs text-ink-600">
              {noList.slice(0, 3).map((v) => (
                <li key={v.stationId} className="flex items-start gap-2"><VerdictChip verdict={v.verdict} label={stationName(v.stationId)} /><span className="line-clamp-2">{v.message}</span></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Beyond the line: office & admin" actions={<Link to="/office" className="text-xs font-semibold text-brand-600">Details →</Link>}>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-ink-500">Processes</dt><dd className="text-lg font-semibold tabular-nums">{off.portfolio.inWaves} / {off.portfolio.count}</dd><dd className="text-[10px] text-ink-400">in waves 1 + 2</dd></div>
            <div><dt className="text-xs text-ink-500">Investment</dt><dd className="text-lg font-semibold tabular-nums">{eur(off.portfolio.K)}</dd></div>
            <div><dt className="text-xs text-ink-500">Net / yr</dt><dd className="text-lg font-semibold tabular-nums text-emerald-700">{eur(off.portfolio.N)}</dd></div>
            <div><dt className="text-xs text-ink-500">Payback</dt><dd className="text-lg font-semibold tabular-nums">{fmtMonths(off.portfolio.pay)}</dd><dd className="text-[10px] text-ink-400">{fmtMonths(off.portfolio.payBest)}–{fmtMonths(off.portfolio.payWorst)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-ink-500">Software for order entry, delivery notes, HACCP logs and reports: {num(off.portfolio.freed)} hours freed per year (not cash until redeployed).</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card title="Your line" subtitle={`${line.stations.length} stations · ${b.line.totalOperatorsPerShift} operators per shift`} className="lg:col-span-2" actions={<Link to="/line" className="text-xs font-semibold text-brand-600">Edit line →</Link>}>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {line.stations.map((s) => {
              const a = b.line.stations.find((x) => x.stationId === s.id);
              const bott = b.line.bottleneckId === s.id;
              return (
                <div key={s.id} className={`min-w-[130px] rounded-xl border p-3 ${bott ? 'border-rose-300 bg-rose-50' : 'border-ink-100 bg-white'}`}>
                  <div className="truncate text-xs font-semibold" title={s.name}>{s.name}</div>
                  <div className="text-[11px] text-ink-400">{STATION_TYPE_LABEL[s.type]}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge tone={s.level === 'auto' ? 'good' : s.level === 'semi' ? 'brand' : 'warn'}>{s.level}</Badge>
                    {a?.ergonomicRisk === 'high' && <Badge tone="bad">ergo</Badge>}
                    {bott && <Badge tone="bad">bottleneck</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Next steps">
          <div className="space-y-2">
            <Link to="/capture" className="flex items-center justify-between rounded-xl border border-ink-100 p-3 text-sm font-medium hover:bg-ink-50"><span className="flex items-center gap-2"><Video size={16} /> Capture your line from a video</span><ArrowRight size={14} /></Link>
            <Link to="/roadmap" className="flex items-center justify-between rounded-xl border border-ink-100 p-3 text-sm font-medium hover:bg-ink-50"><span>See the phased roadmap</span><ArrowRight size={14} /></Link>
            <Link to="/report" className="flex items-center justify-between rounded-xl border border-ink-100 p-3 text-sm font-medium hover:bg-ink-50"><span>Export the one-page report</span><ArrowRight size={14} /></Link>
            <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Ranges are indicative. Use the report to request comparable quotes from 2–3 integrators.</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
