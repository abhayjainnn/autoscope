import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowRight, Clock, Dumbbell, LayoutTemplate, Pause, Play, Sparkles, Trash2, Workflow } from 'lucide-react';
import { useApp, useAnalysis } from '../store';
import { analyzeLine, simulateAfter } from '../engine';
import type { Line, LineAnalysis } from '../types';
import { PageHeader, Card, Stat, Badge, Button, Empty } from '../components/ui';
import { STATION_TYPE_LABEL, eur, num, pct } from '../lib/format';
import { LineAnimation } from '../components/line/LineAnimation';
import { TemplatePicker } from '../components/line/TemplatePicker';

type Mode = 'before' | 'after';

function Delta({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ring-1 ${good ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-ink-50 text-ink-600 ring-ink-100'}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default function Analysis() {
  const profile = useApp((s) => s.profile);
  const line = useApp((s) => s.line);
  const assumptions = useApp((s) => s.assumptions);
  const catalog = useApp((s) => s.catalog);
  const applyTemplate = useApp((s) => s.applyTemplate);
  const bundle = useAnalysis();
  const la = bundle.line;

  const [mode, setMode] = useState<Mode>('before');
  const [running, setRunning] = useState(true);

  const after = useMemo<{ line: Line; analysis: LineAnalysis } | null>(() => {
    try {
      if (!bundle.portfolio?.selected?.length) return null;
      const l = simulateAfter(line, bundle.portfolio.selected, catalog);
      return { line: l, analysis: analyzeLine(profile, l, assumptions) };
    } catch {
      return null;
    }
  }, [line, bundle.portfolio, catalog, profile, assumptions]);

  const byId = useMemo(() => new Map(line.stations.map((s) => [s.id, s])), [line.stations]);

  if (line.stations.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="2 · What" title="Line Analysis" />
        <Empty title="No stations to analyse yet">
          <p>Load an industry template or build your line first.</p>
          <div className="mx-auto mt-4 flex max-w-sm flex-wrap justify-center gap-2">
            <Button onClick={() => applyTemplate(profile.subSector ?? 'beverages')}><LayoutTemplate size={15} /> Load template</Button>
            <Link to="/line"><Button variant="secondary"><Workflow size={15} /> Open Line Builder</Button></Link>
          </div>
        </Empty>
      </div>
    );
  }

  const bottleneck = la.bottleneckId ? byId.get(la.bottleneckId) : undefined;
  const short = la.taktGapPct > 0;

  // chart data
  const chartData = line.stations.map((s) => {
    const a = la.stations.find((x) => x.stationId === s.id);
    return {
      name: s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name,
      full: s.name,
      rate: +(a?.effectiveRatePerMin ?? 0).toFixed(1),
      nominal: s.ratePerMin,
      isB: s.id === la.bottleneckId,
      under: (a?.utilization ?? 0) >= 1,
    };
  });

  // ergonomics
  const ergo = la.stations
    .filter((a) => a.kgLiftedPerShift > 0)
    .map((a) => ({ a, s: byId.get(a.stationId)! }))
    .filter((x) => x.s)
    .sort((x, y) => y.a.kgLiftedPerShift - x.a.kgLiftedPerShift);

  // waste & issues
  type WasteItem = { station: string; text: string; kind: 'issue' | 'downtime' | 'scrap'; cost?: number };
  const waste: WasteItem[] = [];
  for (const a of la.stations) {
    const s = byId.get(a.stationId);
    if (!s) continue;
    if (a.scrapCostPerYear > 500) waste.push({ station: s.name, kind: 'scrap', text: `${pct(s.scrapRate, 1)} scrap ≈ ${eur(a.scrapCostPerYear)} lost per year`, cost: a.scrapCostPerYear });
    if (a.downtimeHoursPerYear > 20) waste.push({ station: s.name, kind: 'downtime', text: `${num(a.downtimeHoursPerYear)} h/yr unplanned downtime (${pct(s.downtimePct)})`, cost: a.downtimeHoursPerYear });
    for (const iss of s.issues ?? []) waste.push({ station: s.name, kind: 'issue', text: iss });
  }
  const kindOrder = { scrap: 0, downtime: 1, issue: 2 };
  waste.sort((x, y) => kindOrder[x.kind] - kindOrder[y.kind] || (y.cost ?? 0) - (x.cost ?? 0));
  const totalScrap = la.stations.reduce((t, a) => t + a.scrapCostPerYear, 0);

  const view = mode === 'after' && after ? after : { line, analysis: la };
  const deltas = after
    ? {
        rate: la.lineRatePerMin > 0 ? (after.analysis.lineRatePerMin - la.lineRatePerMin) / la.lineRatePerMin : 0,
        ops: la.totalOperatorsPerShift - after.analysis.totalOperatorsPerShift,
        oee: (after.analysis.oee - la.oee) * 100,
        labour: la.totalLabourCostPerYear - after.analysis.totalLabourCostPerYear,
      }
    : null;
  const afterBottleneck = after?.analysis.bottleneckId ? after.line.stations.find((s) => s.id === after.analysis.bottleneckId) : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="2 · What"
        title="Line Analysis"
        subtitle={<>Deterministic capacity, OEE, labour and ergonomics analysis of <b className="text-ink-700">{line.name}</b>. Change any station in the Line Builder and every number here updates.</>}
        actions={
          <>
            <div className="w-44"><TemplatePicker onPick={applyTemplate} /></div>
            <Link to="/opportunities"><Button>What to automate <ArrowRight size={15} /></Button></Link>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Line rate vs target"
          value={<>{num(la.lineRatePerMin, 1)}<span className="text-sm font-medium text-ink-400"> / {num(line.targetRatePerMin)}</span></>}
          hint={short ? `${pct(la.taktGapPct)} short of takt` : `${pct(-la.taktGapPct)} headroom`}
          tone={short ? 'bad' : 'good'}
        />
        <Stat label="Estimated OEE" value={pct(la.oee)} hint={la.oee < 0.65 ? 'below 65% typical SME' : 'world class ≈ 85%'} tone={la.oee < 0.6 ? 'warn' : 'default'} />
        <Stat label="Bottleneck" value={<span className="block truncate text-xl">{bottleneck?.name ?? 'None'}</span>} hint={bottleneck ? STATION_TYPE_LABEL[bottleneck.type] : 'all stations keep up'} tone={bottleneck ? 'bad' : 'good'} />
        <Stat label="Operators / shift" value={num(la.totalOperatorsPerShift, 1)} hint={`${profile.shifts} shift(s)/day`} />
        <Stat label="Labour cost / yr" value={eur(la.totalLabourCostPerYear)} hint={`@ €${profile.labourCostPerHour}/h loaded`} tone="brand" />
        <Stat label="Annual output" value={la.annualOutputUnits >= 1_000_000 ? `${num(la.annualOutputUnits / 1_000_000, 2)}M` : `${num(la.annualOutputUnits / 1000, 0)}k`} hint={`${line.unitName} · ${num(la.operatingHoursPerYear)} h/yr`} />
      </div>

      {/* Animated line */}
      <Card
        className="mt-4"
        title={<span className="flex items-center gap-2"><Sparkles size={15} className="text-brand-600" /> Live line simulation</span>}
        subtitle={mode === 'before' ? 'Units arrive at takt. Stations coloured by utilization — watch the queue pile up in front of the bottleneck.' : 'Same demand, after the recommended automation portfolio is installed.'}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setRunning((r) => !r)} className="rounded-lg p-2 text-ink-500 ring-1 ring-ink-200 hover:bg-ink-50" aria-label={running ? 'Pause' : 'Play'}>
              {running ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <div className="inline-flex rounded-xl bg-ink-100 p-1 text-xs font-semibold">
              {(['before', 'after'] as Mode[]).map((m) => (
                <button
                  key={m}
                  disabled={m === 'after' && !after}
                  onClick={() => setMode(m)}
                  className={`rounded-lg px-3 py-1.5 capitalize transition disabled:opacity-40 ${mode === m ? (m === 'after' ? 'bg-emerald-600 text-white shadow' : 'bg-white text-ink-900 shadow') : 'text-ink-500 hover:text-ink-800'}`}
                >
                  {m === 'before' ? 'Today' : 'After automation'}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="rounded-xl bg-gradient-to-b from-ink-50 to-white p-2 ring-1 ring-ink-100">
          <LineAnimation key={mode} line={view.line} analysis={view.analysis} running={running} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ink-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-emerald-500" /> &lt; 85% utilized</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-amber-500" /> 85–100%</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-rose-500" /> ≥ 100% — cannot keep up with takt</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> manual operator</span>
        </div>
        {deltas ? (
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
            <Delta label="Line rate" value={`${deltas.rate >= 0 ? '+' : ''}${pct(deltas.rate)}`} good={deltas.rate > 0.001} />
            <Delta label="Operators / shift" value={`${deltas.ops > 0 ? '−' : '+'}${num(Math.abs(deltas.ops), 1)}`} good={deltas.ops > 0} />
            <Delta label="OEE" value={`${deltas.oee >= 0 ? '+' : ''}${num(deltas.oee, 1)} pts`} good={deltas.oee > 0.05} />
            <Delta label="Labour saved / yr" value={eur(deltas.labour)} good={deltas.labour > 0} />
            <Delta label="Bottleneck after" value={afterBottleneck ? (after!.analysis.taktGapPct > 0 ? afterBottleneck.name : 'cleared ✓') : 'cleared ✓'} good={!after || after.analysis.taktGapPct <= 0} />
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-400">No automation portfolio within budget yet — adjust budget in the company profile to see the “after” line.</p>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* Bar chart */}
        <Card className="lg:col-span-3" title="Effective rate per station" subtitle={`${line.unitName}/min after downtime and scrap · dashed line = target ${num(line.targetRatePerMin)}/min`}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#677084' }} interval={0} angle={-25} textAnchor="end" height={56} tickLine={false} axisLine={{ stroke: '#dde1e8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#677084' }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: '#f7f8fa' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #eef0f4', fontSize: 12 }}
                  formatter={(v: number) => [`${v} /min`, 'Effective rate']}
                  labelFormatter={(_, p) => (p?.[0]?.payload?.full as string) ?? ''}
                />
                <ReferenceLine y={line.targetRatePerMin} stroke="#141824" strokeDasharray="5 4" label={{ value: 'target', position: 'insideTopRight', fontSize: 10, fill: '#4d5567' }} />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.isB ? '#f43f5e' : d.under ? '#fb923c' : '#338dfc'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Ergonomics */}
        <Card className="lg:col-span-2" title={<span className="flex items-center gap-2"><Dumbbell size={15} className="text-amber-600" /> Ergonomic hotspots</span>} subtitle="Kg lifted per operator per shift (units handled × kg per unit)">
          {ergo.length === 0 ? (
            <p className="text-sm text-ink-500">No manual lifting recorded on this line.</p>
          ) : (
            <div className="space-y-2.5">
              {ergo.slice(0, 5).map(({ a, s }) => {
                const perOp = a.kgLiftedPerShift; // engine reports kg per operator-shift
                const total = a.kgLiftedPerShift * Math.max(1, s.operatorsPerShift);
                const tone = a.ergonomicRisk === 'high' ? 'bad' : a.ergonomicRisk === 'medium' ? 'warn' : 'good';
                return (
                  <div key={s.id} className="rounded-xl border border-ink-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate text-sm font-semibold text-ink-800">{s.name}</div>
                      <Badge tone={tone}>{a.ergonomicRisk} risk</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs text-ink-500">
                      <span><b className="text-base tabular-nums text-ink-900">{num(perOp / 1000, 1)} t</b> per operator-shift</span>
                      <span>{num(total / 1000, 1)} t station total</span>
                      <span>{num(s.liftKgPerUnit, 1)} kg / unit</span>
                    </div>
                  </div>
                );
              })}
              {(() => {
                const pal = ergo.find((x) => x.s.type === 'palletizing') ?? ergo[0];
                return (
                  <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                    At <b>{num(pal.s.liftKgPerUnit, 1)} kg</b> per unit, {pal.s.name.toLowerCase()} means lifting about <b>{num(pal.a.kgLiftedPerShift / 1000, 1)} tonnes per operator</b> every shift. Above ~8 t/shift with repeated heavy lifts counts as high load in manual-handling risk assessments (KIM-LHC). This drives absence, turnover and recruiting cost.
                  </p>
                );
              })()}
            </div>
          )}
        </Card>
      </div>

      {/* Waste & issues */}
      <Card
        className="mt-4"
        title={<span className="flex items-center gap-2"><AlertTriangle size={15} className="text-rose-500" /> Waste & issues</span>}
        subtitle={`${waste.length} findings · ${eur(totalScrap)} scrap per year across the line`}
      >
        {waste.length === 0 ? (
          <p className="text-sm text-ink-500">No significant waste or issues recorded.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {waste.slice(0, 16).map((w, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-ink-100 p-3">
                <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${w.kind === 'scrap' ? 'bg-rose-50 text-rose-600' : w.kind === 'downtime' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'}`}>
                  {w.kind === 'scrap' ? <Trash2 size={14} /> : w.kind === 'downtime' ? <Clock size={14} /> : <AlertTriangle size={14} />}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{w.station}</div>
                  <div className="text-sm text-ink-700">{w.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
