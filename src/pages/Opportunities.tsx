import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, LabelList, Cell,
} from 'recharts';
import { Trophy, ChevronDown, CheckCircle2, Calculator, ArrowRight, Info } from 'lucide-react';
import { useAnalysis, useApp } from '../store';
import { PageHeader, Card, Badge, ScoreBar, Empty, Stat, cx } from '../components/ui';
import { eur, pct, STATION_TYPE_LABEL } from '../lib/format';
import AiExplain from '../components/AiExplain';
import type { AnalysisBundle, OpportunityScore, ScoreFactorKey, Station, StationAnalysis, RoiResult } from '../types';

const FACTOR_COLOR: Record<ScoreFactorKey, string> = {
  labour: '#1d6ef1',
  repetitiveness: '#8b5cf6',
  ergonomics: '#f59e0b',
  quality: '#ef4444',
  bottleneck: '#10b981',
  stability: '#64748b',
};

const FACTOR_LABEL: Record<ScoreFactorKey, string> = {
  labour: 'Labour cost',
  repetitiveness: 'Repetitiveness',
  ergonomics: 'Ergonomics',
  quality: 'Quality / scrap',
  bottleneck: 'Bottleneck',
  stability: 'Process stability',
};

const scoreTone = (s: number) => (s >= 65 ? 'good' : s >= 45 ? 'brand' : s >= 30 ? 'warn' : 'bad') as 'good' | 'brand' | 'warn' | 'bad';

function FactorStack({ score }: { score: OpportunityScore }) {
  const total = Math.max(1, score.factors.reduce((s, f) => s + f.contribution, 0));
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-100">
        {score.factors.map((f) => (
          <div
            key={f.key}
            title={`${f.label}: ${f.contribution.toFixed(1)} pts`}
            style={{ width: `${(f.contribution / Math.max(100, total)) * 100}%`, background: FACTOR_COLOR[f.key] }}
            className="h-full transition-all"
          />
        ))}
      </div>
    </div>
  );
}

function FactorLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {(Object.keys(FACTOR_COLOR) as ScoreFactorKey[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5 text-xs text-ink-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: FACTOR_COLOR[k] }} />
          {FACTOR_LABEL[k]}
        </span>
      ))}
    </div>
  );
}

function StationCard({ score, station, sa, roi, muted }: { score: OpportunityScore; station?: Station; sa?: StationAnalysis; roi?: RoiResult; muted?: boolean }) {
  const [open, setOpen] = useState(false);
  const name = station?.name ?? score.stationId;
  return (
    <div className={cx('rounded-2xl border bg-white p-5 shadow-sm transition', muted ? 'border-ink-100 opacity-60' : score.rank === 1 ? 'border-brand-200 ring-1 ring-brand-100' : 'border-ink-100')}>
      <div className="flex flex-wrap items-start gap-4">
        <div className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold', muted ? 'bg-ink-100 text-ink-500' : score.rank === 1 ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700')}>
          {muted ? <CheckCircle2 size={18} /> : `#${score.rank}`}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink-900">{name}</h3>
            {station && <span className="text-xs text-ink-400">{STATION_TYPE_LABEL[station.type] ?? station.type}</span>}
            {muted ? <Badge>Already automated</Badge> : score.automatable ? <Badge tone="good">Automatable</Badge> : <Badge tone="warn">Low potential</Badge>}
            {sa?.isBottleneck && <Badge tone="bad">Bottleneck</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
            {sa && <span>Labour {eur(sa.labourCostPerYear)}/yr</span>}
            {station && <span>{station.operatorsPerShift} operator{station.operatorsPerShift === 1 ? '' : 's'}/shift</span>}
            {sa && <span>Ergonomic risk: {sa.ergonomicRisk}</span>}
            {roi && <span>Est. investment {eur(roi.totalInvestment)}</span>}
          </div>
        </div>
        <div className="w-36 shrink-0 text-right">
          <div className="text-3xl font-extrabold tabular-nums tracking-tight text-ink-900">{Math.round(score.score)}<span className="text-sm font-medium text-ink-400">/100</span></div>
          <div className="mt-1.5"><ScoreBar value={score.score} tone={muted ? 'brand' : scoreTone(score.score)} /></div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-400">Score composition</div>
        <FactorStack score={score} />
      </div>

      {score.reasons.length > 0 && (
        <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {score.reasons.slice(0, 4).map((r, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => setOpen((o) => !o)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800">
        <Calculator size={14} /> How this score is calculated
        <ChevronDown size={14} className={cx('transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-ink-100">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-ink-50 text-left text-[11px] uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Factor</th>
                <th className="px-3 py-2 text-right font-semibold">Value</th>
                <th className="px-3 py-2 text-right font-semibold">× Weight</th>
                <th className="px-3 py-2 text-right font-semibold">= Points</th>
                <th className="px-3 py-2 font-semibold">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {score.factors.map((f) => (
                <tr key={f.key}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-ink-800">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: FACTOR_COLOR[f.key] }} />
                    {f.label}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{Math.round(f.value)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-500">{pct(f.weight)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{f.contribution.toFixed(1)}</td>
                  <td className="px-3 py-2 text-xs text-ink-500">{f.explanation}</td>
                </tr>
              ))}
              <tr className="bg-ink-50 font-semibold">
                <td className="px-3 py-2" colSpan={3}>Opportunity score</td>
                <td className="px-3 py-2 text-right tabular-nums">{score.score.toFixed(1)}</td>
                <td className="px-3 py-2 text-xs font-normal text-ink-500">
                  Weights are editable under <Link to="/assumptions" className="text-brand-700 underline">Assumptions</Link>.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface Pt { id: string; name: string; x: number; y: number; z: number; quadrant: string }

const QUAD_COLOR: Record<string, string> = { 'Quick win': '#10b981', 'Big bet': '#1d6ef1', 'Fill-in': '#94a3b8', Avoid: '#ef4444' };

function ImpactEffort({ points }: { points: Pt[] }) {
  if (points.length === 0) return <Empty title="No investment estimates yet">Add stations with automation potential to see the impact vs effort map.</Empty>;
  const xs = points.map((p) => p.x);
  const xMax = Math.max(...xs) * 1.15 || 1;
  const sorted = [...xs].sort((a, b) => a - b);
  const xSplit = sorted[Math.floor(sorted.length / 2)] ?? xMax / 2;
  const ySplit = 50;
  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
          <ReferenceArea x1={0} x2={xSplit} y1={ySplit} y2={100} fill="#10b981" fillOpacity={0.06} label={{ value: 'Quick wins', position: 'insideTopLeft', fill: '#059669', fontSize: 11, fontWeight: 600 }} />
          <ReferenceArea x1={xSplit} x2={xMax} y1={ySplit} y2={100} fill="#1d6ef1" fillOpacity={0.05} label={{ value: 'Big bets', position: 'insideTopRight', fill: '#1557de', fontSize: 11, fontWeight: 600 }} />
          <ReferenceArea x1={0} x2={xSplit} y1={0} y2={ySplit} fill="#94a3b8" fillOpacity={0.05} label={{ value: 'Fill-ins', position: 'insideBottomLeft', fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
          <ReferenceArea x1={xSplit} x2={xMax} y1={0} y2={ySplit} fill="#ef4444" fillOpacity={0.05} label={{ value: 'Avoid', position: 'insideBottomRight', fill: '#dc2626', fontSize: 11, fontWeight: 600 }} />
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
          <XAxis type="number" dataKey="x" domain={[0, xMax]} tickFormatter={(v) => eur(v)} tick={{ fontSize: 11, fill: '#677084' }} label={{ value: 'Estimated investment (effort)', position: 'insideBottom', offset: -12, fontSize: 11, fill: '#677084' }} />
          <YAxis type="number" dataKey="y" domain={[0, 100]} tick={{ fontSize: 11, fill: '#677084' }} label={{ value: 'Opportunity score (impact)', angle: -90, position: 'insideLeft', offset: 14, fontSize: 11, fill: '#677084' }} />
          <ZAxis type="number" dataKey="z" range={[120, 1100]} />
          <ReferenceLine x={xSplit} stroke="#c3c9d4" strokeDasharray="4 4" />
          <ReferenceLine y={ySplit} stroke="#c3c9d4" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Pt;
              return (
                <div className="rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs shadow-lg">
                  <div className="font-semibold text-ink-900">{p.name}</div>
                  <div className="mt-1 text-ink-600">Score {Math.round(p.y)} · Investment {eur(p.x)}</div>
                  <div className="text-ink-600">Labour cost {eur(p.z)}/yr</div>
                  <div className="mt-1 font-medium" style={{ color: QUAD_COLOR[p.quadrant] }}>{p.quadrant}</div>
                </div>
              );
            }}
          />
          <Scatter data={points.map((p) => ({ ...p, quadrant: p.y >= ySplit ? (p.x <= xSplit ? 'Quick win' : 'Big bet') : p.x <= xSplit ? 'Fill-in' : 'Avoid' }))}>
            {points.map((p) => {
              const q = p.y >= ySplit ? (p.x <= xSplit ? 'Quick win' : 'Big bet') : p.x <= xSplit ? 'Fill-in' : 'Avoid';
              return <Cell key={p.id} fill={QUAD_COLOR[q]} fillOpacity={0.7} stroke={QUAD_COLOR[q]} />;
            })}
            <LabelList dataKey="name" position="top" offset={10} style={{ fontSize: 11, fill: '#252b38', fontWeight: 500 }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Opportunities() {
  const analysis: AnalysisBundle = useAnalysis();
  const stations = useApp((s) => s.line.stations);

  const data = useMemo(() => {
    const st = new Map(stations.map((s) => [s.id, s]));
    const sa = new Map(analysis.line.stations.map((s) => [s.stationId, s]));
    const roi = new Map(analysis.roi.map((r) => [r.stationId, r]));
    const ranked = analysis.scores.filter((s) => st.get(s.stationId)?.level !== 'auto');
    const automated = analysis.scores.filter((s) => st.get(s.stationId)?.level === 'auto');
    const worth = ranked.filter((s) => s.automatable);
    const points: Pt[] = worth
      .filter((s) => roi.has(s.stationId))
      .map((s) => ({
        id: s.stationId,
        name: st.get(s.stationId)?.name ?? s.stationId,
        x: roi.get(s.stationId)!.totalInvestment,
        y: s.score,
        z: sa.get(s.stationId)?.labourCostPerYear ?? 0,
        quadrant: '',
      }));
    return { st, sa, roi, ranked, automated, worth, points };
  }, [analysis, stations]);

  const top = data.worth[0];
  const topStation = top ? data.st.get(top.stationId) : undefined;
  const topSa = top ? data.sa.get(top.stationId) : undefined;
  const topRoi = top ? data.roi.get(top.stationId) : undefined;

  if (analysis.scores.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Answer 1 · What to automate" title="Opportunities" />
        <Empty title="No stations yet">
          Build your line in the <Link to="/line" className="font-semibold text-brand-700 underline">Line Builder</Link> or use AI Process Capture first.
        </Empty>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Answer 1 · What to automate"
        title={`${data.worth.length} of ${stations.length} stations are worth automating`}
        subtitle="Every station gets a transparent 0-100 opportunity score from six weighted factors. Open any card to see the exact arithmetic. No black box."
      />

      {top && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-100"><Trophy size={14} /> Top opportunity</div>
              <div className="mt-1 text-2xl font-bold tracking-tight">{topStation?.name ?? top.stationId}</div>
              <div className="mt-1 max-w-2xl text-sm text-brand-100">{top.reasons[0] ?? 'Highest weighted score across all stations.'}</div>
            </div>
            <div className="flex flex-wrap gap-6">
              <div><div className="text-xs text-brand-200">Score</div><div className="text-3xl font-extrabold tabular-nums">{Math.round(top.score)}</div></div>
              {topSa && <div><div className="text-xs text-brand-200">Labour cost</div><div className="text-3xl font-extrabold tabular-nums">{eur(topSa.labourCostPerYear)}</div></div>}
              {topRoi && <div><div className="text-xs text-brand-200">Investment</div><div className="text-3xl font-extrabold tabular-nums">{eur(topRoi.totalInvestment)}</div></div>}
            </div>
          </div>
          <Link to="/technology" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white">
            See the recommended technology <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Worth automating" value={data.worth.length} hint={`of ${stations.length} stations`} tone="brand" />
        <Stat label="Already automated" value={data.automated.length} />
        <Stat label="Labour in scope" value={eur(data.worth.reduce((s, x) => s + (data.sa.get(x.stationId)?.labourCostPerYear ?? 0), 0))} hint="per year, worth-automating stations" />
        <Stat label="High ergonomic risk" value={analysis.line.stations.filter((s) => s.ergonomicRisk === 'high').length} hint="stations" tone="warn" />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Impact vs effort" subtitle="Bubble size = annual labour cost at the station. Split at score 50 and median investment.">
          <ImpactEffort points={data.points} />
        </Card>
        <div className="xl:col-span-2">
          {top ? (
            <AiExplain
              title="Why this is the top opportunity"
              prompt={`Explain in plain language for a packaging SME owner why "${topStation?.name ?? top.stationId}" is the #1 automation opportunity, referring only to the factor values and numbers in the context. Mention what the runner-up lacks compared to it. Keep it under 120 words.`}
              context={{
                station: topStation,
                score: top.score,
                factors: top.factors.map((f) => ({ factor: f.label, value: Math.round(f.value), weight: f.weight, points: +f.contribution.toFixed(1), why: f.explanation })),
                labourCostPerYear: topSa?.labourCostPerYear,
                ergonomicRisk: topSa?.ergonomicRisk,
                isBottleneck: topSa?.isBottleneck,
                investment: topRoi?.totalInvestment,
                paybackYears: topRoi?.paybackYears,
                runnerUp: data.worth[1] ? { name: data.st.get(data.worth[1].stationId)?.name, score: data.worth[1].score, factors: data.worth[1].factors.map((f) => ({ factor: f.label, points: +f.contribution.toFixed(1) })) } : null,
              }}
            />
          ) : (
            <Card title="AI explanation"><p className="text-sm text-ink-500">No automatable station found.</p></Card>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Ranked stations</h2>
          <p className="flex items-center gap-1 text-xs text-ink-500"><Info size={12} /> Each coloured segment is one factor's contribution to the score.</p>
        </div>
        <FactorLegend />
      </div>

      <div className="space-y-4">
        {data.ranked.map((s) => (
          <StationCard key={s.stationId} score={s} station={data.st.get(s.stationId)} sa={data.sa.get(s.stationId)} roi={data.roi.get(s.stationId)} />
        ))}
      </div>

      {data.automated.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-ink-400">Already automated</h2>
          <div className="space-y-3">
            {data.automated.map((s) => (
              <StationCard key={s.stationId} score={s} station={data.st.get(s.stationId)} sa={data.sa.get(s.stationId)} muted />
            ))}
          </div>
        </>
      )}
    </>
  );
}
