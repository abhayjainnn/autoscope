import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart,
} from 'recharts';
import { ChevronDown, ChevronRight, Dices, Info, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Badge, Card, Empty, PageHeader, Slider, Stat, cx } from '../components/ui';
import AiExplain from '../components/AiExplain';
import { useAnalysis, useApp } from '../store';
import { eur, pct, years, num, STATION_TYPE_LABEL } from '../lib/format';
import type { AnalysisBundle, RoiResult } from '../types';

const C = {
  brand: '#636f30',
  brandLight: '#b8c27f',
  good: '#10b981',
  bad: '#f43f5e',
  warn: '#f59e0b',
  ink: '#a39a84',
  grid: '#f1ece0',
};

const SAVING_KEYS: { key: keyof RoiResult['annualSavings']; label: string; color: string }[] = [
  { key: 'labour', label: 'Labour', color: '#636f30' },
  { key: 'scrap', label: 'Scrap', color: '#10b981' },
  { key: 'downtime', label: 'Downtime', color: '#f59e0b' },
  { key: 'ergonomics', label: 'Ergonomics', color: '#b9874a' },
  { key: 'throughput', label: 'Throughput', color: '#06b6d4' },
];

const axisEur = (v: number) => eur(v);
const tipStyle = { borderRadius: 12, border: '1px solid #e3dccb', fontSize: 12, boxShadow: '0 4px 16px rgba(20,24,36,.08)' };

const riskTone = (r: number) => (r < 35 ? 'good' : r < 60 ? 'warn' : 'bad') as 'good' | 'warn' | 'bad';
const riskLabel = (r: number) => (r < 35 ? 'Low' : r < 60 ? 'Medium' : 'High');
const levelTone = (l: 'low' | 'medium' | 'high') => (l === 'low' ? 'good' : l === 'medium' ? 'warn' : 'bad') as 'good' | 'warn' | 'bad';

export default function Roi() {
  const a: AnalysisBundle = useAnalysis();
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const stations = useApp((s) => s.line.stations);
  const catalog = useApp((s) => s.catalog);
  const [open, setOpen] = useState<string | null>(null);

  const stName = (id: string) => stations.find((s) => s.id === id)?.name ?? id;
  const stType = (id: string) => STATION_TYPE_LABEL[stations.find((s) => s.id === id)?.type ?? ''] ?? '';
  const techName = (id: string) => catalog.find((t) => t.id === id)?.name ?? id;

  const p = a.portfolio;
  const mc = a.monteCarlo;
  const H = profile.horizonYears;
  const r = profile.discountRate;
  const selectedIds = useMemo(() => new Set(p.selected.map((x) => x.stationId)), [p.selected]);

  // ---- budget slider: track which projects drop in / out
  const prevSel = useRef<Set<string>>(selectedIds);
  const [delta, setDelta] = useState<{ added: string[]; removed: string[] }>({ added: [], removed: [] });
  useEffect(() => {
    const prev = prevSel.current;
    const added = [...selectedIds].filter((id) => !prev.has(id));
    const removed = [...prev].filter((id) => !selectedIds.has(id));
    if (added.length || removed.length) setDelta({ added, removed });
    prevSel.current = selectedIds;
  }, [selectedIds]);

  // ---- cumulative cash flow
  const cash = useMemo(() => {
    const rows: { year: number; cum: number; disc: number }[] = [];
    let cum = -p.totalInvestment;
    let disc = -p.totalInvestment;
    rows.push({ year: 0, cum, disc });
    for (let y = 1; y <= H; y++) {
      cum += p.totalNetAnnualBenefit;
      disc += p.totalNetAnnualBenefit / Math.pow(1 + r, y);
      rows.push({ year: y, cum: Math.round(cum), disc: Math.round(disc) });
    }
    return rows;
  }, [p.totalInvestment, p.totalNetAnnualBenefit, H, r]);
  const breakEven = isFinite(p.paybackYears) && p.paybackYears <= H ? p.paybackYears : null;

  // ---- savings breakdown
  const savingsData = p.selected.map((x) => ({
    name: stName(x.stationId),
    ...x.annualSavings,
    opex: -x.annualOpex,
  }));

  // ---- tornado
  const tornado = a.sensitivity.slice(0, 7).map((s) => ({
    label: s.label,
    low: s.npvLow - s.base,
    high: s.npvHigh - s.base,
    npvLow: s.npvLow,
    npvHigh: s.npvHigh,
  }));
  const baseNpv = a.sensitivity[0]?.base ?? p.npv;

  const empty = p.selected.length === 0;
  const totalBudget = profile.budget;
  const probTone = mc.probPaybackWithinHorizon >= 0.8 ? 'good' : mc.probPaybackWithinHorizon >= 0.5 ? 'warn' : 'bad';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Answer 3 · Does it pay off?"
        title="ROI & Risk"
        subtitle="Every number below comes from a transparent, deterministic engine. We show ranges and probabilities, not one magic number."
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total investment" value={eur(p.totalInvestment)} hint={`${pct(p.budgetUsedPct)} of ${eur(totalBudget)} budget`} />
        <Stat label="Net annual benefit" value={eur(p.totalNetAnnualBenefit)} tone={p.totalNetAnnualBenefit > 0 ? 'good' : 'bad'} hint="savings minus running costs" />
        <Stat label="Payback" value={years(p.paybackYears)} tone="brand" hint="simple, undiscounted" />
        <Stat label={`NPV (${H} yrs)`} value={eur(p.npv)} tone={p.npv >= 0 ? 'good' : 'bad'} hint={`at ${pct(r)} discount rate`} />
        <Stat label="FTE freed" value={num(p.fteFreed, 1)} hint="people redeployable" />
        <div
          className={cx(
            'rounded-2xl p-4 text-white shadow-md',
            probTone === 'good' ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' : probTone === 'warn' ? 'bg-gradient-to-br from-amber-500 to-amber-700' : 'bg-gradient-to-br from-rose-500 to-rose-700',
          )}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-white/80">
            <Dices size={13} /> Pays back within {H} yrs
          </div>
          <div className="mt-1 text-3xl font-extrabold tracking-tight">{empty ? '—' : pct(mc.probPaybackWithinHorizon)}</div>
          <div className="mt-1 text-xs text-white/80">probability, {num(mc.runs)} simulations</div>
        </div>
      </div>

      {/* Budget slider */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Wallet size={16} className="text-brand-600" /> What if the budget changes?
          </span>
        }
        subtitle="Drag to re-run the portfolio live. Projects are added in order of value until the budget is used."
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <Slider value={profile.budget} min={50_000} max={1_500_000} step={10_000} onChange={(v) => setProfile({ budget: v })} format={(v) => eur(v)} />
            <div className="mt-1 flex justify-between text-[11px] text-ink-400">
              <span>€50k</span>
              <span>€1.5M</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, p.budgetUsedPct * 100)}%` }} />
            </div>
            <div className="mt-1 text-xs text-ink-500">
              {eur(p.totalInvestment)} committed · {eur(Math.max(0, totalBudget - p.totalInvestment))} headroom
            </div>
            {(delta.added.length > 0 || delta.removed.length > 0) && (
              <div className="mt-3 space-y-1 text-xs">
                {delta.added.map((id) => (
                  <div key={id} className="flex items-center gap-1.5 text-emerald-700">
                    <TrendingUp size={13} /> <b>{stName(id)}</b> now fits the budget
                  </div>
                ))}
                {delta.removed.map((id) => (
                  <div key={id} className="flex items-center gap-1.5 text-rose-700">
                    <TrendingDown size={13} /> <b>{stName(id)}</b> dropped out
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap content-start gap-2">
            {a.roi.length === 0 && <span className="text-sm text-ink-400">No automation candidates yet. Build your line first.</span>}
            {[...a.roi]
              .sort((x, y) => Number(selectedIds.has(y.stationId)) - Number(selectedIds.has(x.stationId)))
              .map((x) => {
                const inn = selectedIds.has(x.stationId);
                return (
                  <div
                    key={x.stationId}
                    className={cx(
                      'rounded-xl border px-3 py-2 text-xs transition',
                      inn ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-dashed border-ink-200 bg-ink-50 text-ink-400 line-through decoration-ink-300',
                    )}
                  >
                    <div className="font-semibold">{stName(x.stationId)}</div>
                    <div className={inn ? 'text-brand-600' : ''}>
                      {eur(x.totalInvestment)} · {years(x.paybackYears)}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </Card>

      {empty ? (
        <Empty title="No project fits the current budget">Raise the budget above or add stations with automation potential in the Line Builder.</Empty>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Cash flow */}
            <Card title="Cumulative cash flow" subtitle={`Year 0 = investment, then net benefit each year. Discounted at ${pct(r)}.`}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cash} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.brand} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={C.brand} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="year" type="number" domain={[0, H]} ticks={cash.map((c) => c.year)} tickFormatter={(v) => `Y${v}`} tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={axisEur} tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} width={56} />
                    <Tooltip contentStyle={tipStyle} formatter={(v: number, n: string) => [eur(v), n]} labelFormatter={(l) => `Year ${l}`} />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="#474237" strokeWidth={1} />
                    <Area type="monotone" dataKey="cum" name="Cumulative (undiscounted)" stroke={C.brand} strokeWidth={2.5} fill="url(#cumFill)" />
                    <Line type="monotone" dataKey="disc" name="Cumulative (discounted)" stroke={C.good} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                    {breakEven !== null && (
                      <ReferenceDot x={breakEven} y={0} r={6} fill="#fff" stroke={C.brand} strokeWidth={3} ifOverflow="extendDomain" label={{ value: `Break-even ${years(breakEven)}`, position: 'top', fontSize: 11, fill: '#4d5727', fontWeight: 600 }} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Savings breakdown */}
            <Card title="Where the savings come from" subtitle="Annual gross savings per project, stacked by source, against running costs (opex).">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={savingsData} stackOffset="sign" margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + '…' : v)} />
                    <YAxis tickFormatter={axisEur} tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} width={56} />
                    <Tooltip contentStyle={tipStyle} formatter={(v: number, n: string) => [eur(v), n]} cursor={{ fill: 'rgba(29,110,241,.05)' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                    <ReferenceLine y={0} stroke="#474237" />
                    {SAVING_KEYS.map((k, i) => (
                      <Bar key={k.key} dataKey={k.key} name={k.label} stackId="s" fill={k.color} maxBarSize={56} radius={i === SAVING_KEYS.length - 1 ? [4, 4, 0, 0] : undefined} />
                    ))}
                    <Bar dataKey="opex" name="Annual opex" stackId="s" fill="#fda4af" maxBarSize={56} radius={[0, 0, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Tornado */}
            <Card title="What moves the result most" subtitle={`NPV swing around the base case of ${eur(baseNpv)} when each input moves to its low / high value.`}>
              {tornado.length === 0 ? (
                <Empty title="No sensitivity data" />
              ) : (
                <div style={{ height: Math.max(220, tornado.length * 44 + 50) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tornado} layout="vertical" stackOffset="sign" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap={8}>
                      <CartesianGrid stroke={C.grid} horizontal={false} />
                      <XAxis type="number" tickFormatter={(v: number) => eur(v + baseNpv)} tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: '#474237' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={tipStyle}
                        cursor={{ fill: 'rgba(29,110,241,.05)' }}
                        formatter={(v: number, n: string) => [`NPV ${eur(v + baseNpv)} (${v >= 0 ? '+' : ''}${eur(v)})`, n]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                      <ReferenceLine x={0} stroke="#474237" strokeWidth={1.5} label={{ value: 'base', position: 'top', fontSize: 10, fill: C.ink }} />
                      <Bar dataKey="low" name="Input at low value" stackId="t" radius={4}>
                        {tornado.map((t, i) => (
                          <Cell key={i} fill={t.low < 0 ? C.bad : C.good} fillOpacity={0.85} />
                        ))}
                      </Bar>
                      <Bar dataKey="high" name="Input at high value" stackId="t" radius={4}>
                        {tornado.map((t, i) => (
                          <Cell key={i} fill={t.high < 0 ? '#fb7185' : '#34d399'} fillOpacity={0.6} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Monte Carlo */}
            <Card
              title={
                <span className="flex items-center gap-2">
                  <Dices size={16} className="text-brand-600" /> Monte Carlo: {num(mc.runs)} simulated futures
                </span>
              }
              subtitle="Investment and savings drawn randomly within their uncertainty ranges. Distribution of payback times."
            >
              <p className="mb-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
                In {num(mc.runs)} simulated futures, the plan pays back within {H} years in <b>{pct(mc.probPaybackWithinHorizon)}</b> of cases.
                Typical payback is <b>{years(mc.paybackP50)}</b>; in a bad case (P90) it takes <b>{years(mc.paybackP90)}</b>.
              </p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mc.histogram} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: C.ink }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: C.ink }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v} runs`, 'Simulations']} labelFormatter={(l) => `Payback ${l}`} />
                    <Area type="step" dataKey="count" stroke={C.brand} fill={C.brand} fillOpacity={0.18} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                {(
                  [
                    ['Optimistic case', mc.paybackP10, mc.npvP90],
                    ['Median case', mc.paybackP50, mc.npvP50],
                    ['Cautious case', mc.paybackP90, mc.npvP10],
                  ] as const
                ).map(([l, pb, npv]) => (
                  <div key={l} className="rounded-xl border border-ink-100 bg-ink-50 p-2">
                    <div className="text-[11px] text-ink-500">{l}</div>
                    <div className="mt-0.5 text-sm font-bold text-ink-900">{years(pb)}</div>
                    <div className={cx('text-[11px] font-medium', npv >= 0 ? 'text-emerald-600' : 'text-rose-600')}>NPV {eur(npv)}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-400">P10/P90 for payback are the fast/slow ends; NPV percentiles shown alongside for each band.</p>
            </Card>
          </div>
        </>
      )}

      {/* Per-project table */}
      <Card title="Business case per project" subtitle="Click a row for risk factors and the savings formula. Greyed rows are outside the current budget.">
        {a.roi.length === 0 ? (
          <Empty title="No projects to evaluate yet" />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-[11px] uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-2 font-semibold">Station</th>
                  <th className="px-3 py-2 font-semibold">Technology</th>
                  <th className="px-3 py-2 text-right font-semibold">Investment</th>
                  <th className="px-3 py-2 text-right font-semibold">Net benefit / yr</th>
                  <th className="px-3 py-2 text-right font-semibold">Payback</th>
                  <th className="px-3 py-2 text-right font-semibold">NPV</th>
                  <th className="px-3 py-2 text-right font-semibold">IRR</th>
                  <th className="px-5 py-2 font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {a.roi.map((x) => {
                  const inn = selectedIds.has(x.stationId);
                  const isOpen = open === x.stationId;
                  const op = profile.shifts * profile.hoursPerShift * profile.operatingDaysPerYear;
                  return (
                    <Fragment key={x.stationId}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : x.stationId)}
                        className={cx('cursor-pointer border-b border-ink-50 transition hover:bg-ink-50', !inn && 'text-ink-400', isOpen && 'bg-brand-50/40')}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {isOpen ? <ChevronDown size={14} className="text-ink-400" /> : <ChevronRight size={14} className="text-ink-400" />}
                            <div>
                              <div className={cx('font-semibold', inn ? 'text-ink-900' : 'text-ink-500')}>{stName(x.stationId)}</div>
                              <div className="text-[11px] text-ink-400">{stType(x.stationId)}{!inn && ' · outside budget'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">{techName(x.techId)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{eur(x.totalInvestment)}</td>
                        <td className={cx('px-3 py-3 text-right font-medium tabular-nums', inn && (x.netAnnualBenefit >= 0 ? 'text-emerald-600' : 'text-rose-600'))}>{eur(x.netAnnualBenefit)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{years(x.paybackYears)}</td>
                        <td className={cx('px-3 py-3 text-right tabular-nums', inn && (x.npv >= 0 ? 'text-emerald-600' : 'text-rose-600'))}>{eur(x.npv)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{x.irr === null ? '—' : pct(x.irr)}</td>
                        <td className="px-5 py-3">
                          <Badge tone={riskTone(x.riskScore)}>
                            {riskLabel(x.riskScore)} · {Math.round(x.riskScore)}
                          </Badge>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-ink-100 bg-ink-50/60">
                          <td colSpan={8} className="px-5 py-4">
                            <div className="grid gap-5 md:grid-cols-2">
                              <div>
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Risk factors</div>
                                {x.riskFactors.length === 0 && <div className="text-xs text-ink-400">No notable risks flagged.</div>}
                                <ul className="space-y-1.5">
                                  {x.riskFactors.map((f) => (
                                    <li key={f.label} className="flex items-start gap-2 text-xs">
                                      <Badge tone={levelTone(f.level)}>{f.level}</Badge>
                                      <span>
                                        <b className="text-ink-800">{f.label}</b> <span className="text-ink-500">{f.note}</span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">How the numbers are built</div>
                                <div className="space-y-1 rounded-xl border border-ink-100 bg-white p-3 font-mono text-[11px] leading-relaxed text-ink-700">
                                  <div>investment = capex {eur(x.capex)} + integration {eur(x.integration)} = <b>{eur(x.totalInvestment)}</b></div>
                                  <div>labour = labour cost × reduction% × ({num(op)} h/yr) = {eur(x.annualSavings.labour)}</div>
                                  <div>scrap = scrap cost × scrap reduction% = {eur(x.annualSavings.scrap)}</div>
                                  <div>downtime = lost hours × reduction% × value/h = {eur(x.annualSavings.downtime)}</div>
                                  <div>ergonomics = high-risk operators × injury cost = {eur(x.annualSavings.ergonomics)}</div>
                                  <div>throughput = extra units × unit value = {eur(x.annualSavings.throughput)}</div>
                                  <div className="border-t border-ink-100 pt-1">
                                    net = gross {eur(x.grossAnnualSavings)} − opex {eur(x.annualOpex)} = <b>{eur(x.netAnnualBenefit)}/yr</b>
                                  </div>
                                  <div>payback = investment / net = <b>{years(x.paybackYears)}</b> · FTE freed {num(x.fteFreed, 1)}</div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AiExplain
        title="Explain this business case to our managing director"
        prompt="Explain this automation business case to our managing director in plain language: what we invest, what we get back, how certain it is (use the Monte Carlo probability and P10/P90), what moves the result most, and the main risks. Max 180 words, no jargon, do not invent numbers."
        context={{
          company: profile.name,
          budget: profile.budget,
          horizonYears: H,
          portfolio: {
            totalInvestment: p.totalInvestment,
            netAnnualBenefit: p.totalNetAnnualBenefit,
            paybackYears: p.paybackYears,
            npv: p.npv,
            fteFreed: p.fteFreed,
            projects: p.selected.map((x) => ({ station: stName(x.stationId), tech: techName(x.techId), investment: x.totalInvestment, net: x.netAnnualBenefit, payback: x.paybackYears, risk: x.riskScore })),
          },
          monteCarlo: { prob: mc.probPaybackWithinHorizon, p10: mc.paybackP10, p50: mc.paybackP50, p90: mc.paybackP90, npvP10: mc.npvP10, npvP90: mc.npvP90 },
          sensitivity: a.sensitivity.slice(0, 4),
        }}
      />

      <p className="flex items-start gap-1.5 text-xs text-ink-400">
        <Info size={13} className="mt-0.5 shrink-0" /> Indicative, vendor-neutral ranges based on technology-class benchmarks. Validate with 2–3 integrator quotes before committing.
      </p>
    </div>
  );
}
