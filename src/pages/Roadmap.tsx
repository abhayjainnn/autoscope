import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, Circle, Flag, Rocket, Zap, Mountain } from 'lucide-react';
import { Badge, Card, Empty, PageHeader, cx } from '../components/ui';
import AiExplain from '../components/AiExplain';
import { useAnalysis, useApp } from '../store';
import { eur, years, PHASE_LABEL } from '../lib/format';
import type { AnalysisBundle, Phase, RoadmapItem } from '../types';

const PHASES: { key: Phase; title: string; color: string; soft: string; text: string; icon: typeof Zap; blurb: string }[] = [
  { key: 'quick_win', title: 'Quick wins', color: '#10b981', soft: 'bg-emerald-50', text: 'text-emerald-700', icon: Zap, blurb: 'Low risk, fast payback, builds confidence' },
  { key: 'mid_term', title: 'Mid-term', color: '#636f30', soft: 'bg-brand-50', text: 'text-brand-700', icon: Rocket, blurb: 'Core automation of the line' },
  { key: 'strategic', title: 'Strategic', color: '#b9874a', soft: 'bg-violet-50', text: 'text-violet-700', icon: Mountain, blurb: 'Larger bets once the basics run' },
];

const HATCH = 'repeating-linear-gradient(135deg, #e3dccb 0 6px, #f1ece0 6px 12px)';
const tipStyle = { borderRadius: 12, border: '1px solid #e3dccb', fontSize: 12 };

const STEPS = [
  { t: 'Request 2–3 integrator quotes per technology class', d: "Send AutoScope's vendor-neutral spec sheet so quotes are comparable." },
  { t: 'Check public funding and financing programmes', d: 'Regional and national digitalisation / automation grants and low-interest loans often cover 20–40%.' },
  { t: 'Plan a pilot cell for the first quick win', d: 'Define success metrics (rate, scrap, hours freed) before go-live.' },
  { t: 'Involve operators and the works council early', d: 'Explain which tasks change, how freed people are redeployed, and collect their input.' },
  { t: 'Re-run AutoScope with real quotes', d: 'Replace benchmark ranges with quoted figures to firm up the business case.' },
];

export default function Roadmap() {
  const a: AnalysisBundle = useAnalysis();
  const profile = useApp((s) => s.profile);
  const stations = useApp((s) => s.line.stations);
  const catalog = useApp((s) => s.catalog);
  const [done, setDone] = useState<Record<number, boolean>>({});

  const stName = (id: string) => stations.find((s) => s.id === id)?.name ?? id;
  const techName = (id: string) => catalog.find((t) => t.id === id)?.name ?? id;
  const roiOf = (id: string) => a.roi.find((r) => r.stationId === id);

  const items = a.roadmap;
  const totalMonths = useMemo(() => {
    const end = items.reduce((m, i) => Math.max(m, i.startMonth + i.durationMonths), 0);
    return Math.max(6, Math.ceil((end + 1) / 6) * 6);
  }, [items]);

  // cumulative investment over months: spread each item evenly across its duration
  const curve = useMemo(() => {
    const rows: { month: number; withinBudget: number; all: number }[] = [];
    for (let m = 0; m <= totalMonths; m++) {
      let inB = 0;
      let all = 0;
      for (const it of items) {
        const d = Math.max(1, it.durationMonths);
        const frac = Math.min(1, Math.max(0, (m - it.startMonth) / d));
        all += it.investment * frac;
        if (it.withinBudget) inB += it.investment * frac;
      }
      rows.push({ month: m, withinBudget: Math.round(inB), all: Math.round(all) });
    }
    return rows;
  }, [items, totalMonths]);

  const byPhase = (ph: Phase) => items.filter((i) => i.phase === ph);
  const tickStep = totalMonths > 24 ? 6 : 3;
  const ticks = Array.from({ length: Math.floor(totalMonths / tickStep) + 1 }, (_, i) => i * tickStep);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Answer 3 · Does it pay off?"
        title="Implementation roadmap"
        subtitle="Sequenced so early wins fund and de-risk the bigger steps. Items beyond the budget are shown, but greyed out."
      />

      {items.length === 0 ? (
        <Empty title="No roadmap yet">Add stations with automation potential in the Line Builder and set a budget in the company profile.</Empty>
      ) : (
        <>
          {/* Phase cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {PHASES.map((ph) => {
              const its = byPhase(ph.key);
              const inv = its.filter((i) => i.withinBudget).reduce((s, i) => s + i.investment, 0);
              const ben = its.filter((i) => i.withinBudget).reduce((s, i) => s + (roiOf(i.stationId)?.netAnnualBenefit ?? 0), 0);
              const first = [...its].sort((x, y) => x.startMonth - y.startMonth || (roiOf(x.stationId)?.paybackYears ?? 99) - (roiOf(y.stationId)?.paybackYears ?? 99))[0];
              const fr = first && roiOf(first.stationId);
              return (
                <div key={ph.key} className="relative overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                  <div className="absolute inset-x-0 top-0 h-1" style={{ background: ph.color }} />
                  <div className="flex items-center justify-between">
                    <div className={cx('flex items-center gap-2 text-sm font-semibold', ph.text)}>
                      <span className={cx('grid h-7 w-7 place-items-center rounded-lg', ph.soft)}>
                        <ph.icon size={15} />
                      </span>
                      {ph.title}
                    </div>
                    <Badge>{its.length} item{its.length === 1 ? '' : 's'}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-400">{ph.blurb}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] text-ink-500">Investment</div>
                      <div className="text-lg font-bold text-ink-900">{eur(inv)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-ink-500">Annual benefit</div>
                      <div className="text-lg font-bold text-emerald-600">{eur(ben)}</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
                    {first ? (
                      <>
                        <Flag size={12} className="mr-1 inline" style={{ color: ph.color }} />
                        Start with <b className="text-ink-800">{techName(first.techId)}</b> at {stName(first.stationId)}: {eur(first.investment)}
                        {fr && isFinite(fr.paybackYears) ? `, pays back in ${years(fr.paybackYears)}` : ''}.
                        {!first.withinBudget && <span className="text-rose-600"> (needs more budget)</span>}
                      </>
                    ) : (
                      <span className="text-ink-400">Nothing in this phase.</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gantt */}
          <Card title="Timeline" subtitle={`Month 0 = project kick-off. Bars include lead time, installation and ramp-up. Budget ${eur(profile.budget)}.`}>
            <div className="-mx-5 overflow-x-auto px-5">
              <div className="min-w-[720px]">
                {/* axis */}
                <div className="flex border-b border-ink-100 pb-1 text-[10px] font-medium text-ink-400">
                  <div className="w-56 shrink-0" />
                  <div className="relative h-4 flex-1">
                    {ticks.map((t) => (
                      <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(t / totalMonths) * 100}%` }}>
                        M{t}
                      </span>
                    ))}
                  </div>
                </div>
                {PHASES.map((ph) => {
                  const its = byPhase(ph.key);
                  if (!its.length) return null;
                  return (
                    <div key={ph.key} className="border-b border-ink-50 py-2 last:border-0">
                      <div className={cx('mb-1 text-[11px] font-semibold uppercase tracking-wider', ph.text)}>{ph.title}</div>
                      {its.map((it) => (
                        <GanttRow key={it.stationId + it.techId} it={it} color={ph.color} total={totalMonths} ticks={ticks} label={stName(it.stationId)} tech={techName(it.techId)} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-ink-500">
              {PHASES.map((ph) => (
                <span key={ph.key} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded" style={{ background: ph.color }} /> {PHASE_LABEL[ph.key]}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded border border-ink-200" style={{ background: HATCH }} /> Over budget
              </span>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {/* Cumulative investment */}
            <Card title="Cumulative investment vs budget" subtitle="Cash out over time (spread over each project's duration).">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={curve} margin={{ top: 16, right: 16, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="invFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#636f30" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#636f30" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#f1ece0" vertical={false} />
                    <XAxis dataKey="month" type="number" domain={[0, totalMonths]} ticks={ticks} tickFormatter={(v) => `M${v}`} tick={{ fontSize: 11, fill: '#a39a84' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v: number) => eur(v)} tick={{ fontSize: 11, fill: '#a39a84' }} axisLine={false} tickLine={false} width={56} domain={[0, (max: number) => Math.max(max, profile.budget) * 1.08]} />
                    <Tooltip contentStyle={tipStyle} formatter={(v: number, n: string) => [eur(v), n]} labelFormatter={(l) => `Month ${l}`} />
                    <Area type="monotone" dataKey="all" name="Incl. over-budget items" stroke="#cdc4ae" strokeDasharray="4 4" fill="transparent" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="withinBudget" name="Within budget" stroke="#636f30" fill="url(#invFill)" strokeWidth={2.5} />
                    <ReferenceLine y={profile.budget} stroke="#f43f5e" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `Budget ${eur(profile.budget)}`, position: 'insideTopRight', fontSize: 11, fill: '#e11d48', fontWeight: 600 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Next steps */}
            <Card title="Next steps" subtitle="Turn the plan into a decision within weeks, not months.">
              <ul className="space-y-2">
                {STEPS.map((s, i) => (
                  <li key={i}>
                    <button onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))} className="flex w-full items-start gap-2.5 rounded-xl p-2 text-left transition hover:bg-ink-50">
                      {done[i] ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" /> : <Circle size={18} className="mt-0.5 shrink-0 text-ink-300" />}
                      <span>
                        <span className={cx('block text-sm font-medium', done[i] ? 'text-ink-400 line-through' : 'text-ink-800')}>{s.t}</span>
                        <span className="block text-xs text-ink-500">{s.d}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <AiExplain
            title="Explain the sequencing"
            prompt="Explain in under 120 words why the roadmap is sequenced this way (quick wins first, then mid-term, then strategic) and what the company should do in the next 90 days. Use only the numbers provided."
            context={{
              budget: profile.budget,
              items: items.map((i) => ({ station: stName(i.stationId), tech: techName(i.techId), phase: i.phase, startMonth: i.startMonth, durationMonths: i.durationMonths, investment: i.investment, withinBudget: i.withinBudget, paybackYears: roiOf(i.stationId)?.paybackYears })),
            }}
          />
        </>
      )}
    </div>
  );
}

function GanttRow({ it, color, total, ticks, label, tech }: { it: RoadmapItem; color: string; total: number; ticks: number[]; label: string; tech: string }) {
  const left = (it.startMonth / total) * 100;
  const width = Math.max(2, (Math.max(0.5, it.durationMonths) / total) * 100);
  const over = !it.withinBudget;
  return (
    <div className="flex items-center py-1">
      <div className="w-56 shrink-0 pr-3">
        <div className={cx('truncate text-sm font-medium', over ? 'text-ink-400' : 'text-ink-800')} title={label}>
          {label}
        </div>
        <div className="truncate text-[11px] text-ink-400" title={tech}>
          {tech}
        </div>
      </div>
      <div className="relative h-8 flex-1">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-y-0 border-l border-dashed border-ink-100" style={{ left: `${(t / total) * 100}%` }} />
        ))}
        <div
          className={cx('absolute inset-y-1 flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg px-2 text-[11px] font-semibold shadow-sm', over ? 'border border-dashed border-ink-300 text-ink-500' : 'text-white')}
          style={{ left: `${left}%`, width: `${width}%`, minWidth: 64, background: over ? HATCH : color }}
          title={`${label}: ${tech} · M${it.startMonth}–M${it.startMonth + it.durationMonths} · ${eur(it.investment)}`}
        >
          {eur(it.investment)}
          {over && <span className="rounded bg-rose-100 px-1 text-[9px] font-bold uppercase text-rose-700">over budget</span>}
        </div>
      </div>
    </div>
  );
}
