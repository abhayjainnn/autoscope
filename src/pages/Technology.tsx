import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu, Code2, MoveRight, Factory, Bot, Truck, ScanEye, Clock, CheckCircle2, XCircle, ShieldCheck, ArrowRight, Droplets,
} from 'lucide-react';
import { useAnalysis, useApp } from '../store';
import { PageHeader, Card, Badge, ScoreBar, Empty, cx } from '../components/ui';
import { eur, pct, CATEGORY_LABEL, STATION_TYPE_LABEL } from '../lib/format';
import AiExplain from '../components/AiExplain';
import type { AnalysisBundle, TechCategory, TechClass, TechRecommendation, Station, OpportunityScore } from '../types';

const CAT_ICON: Record<TechCategory, typeof Cpu> = {
  software: Code2,
  conveyor: MoveRight,
  special_machine: Factory,
  robot: Bot,
  agv: Truck,
  inspection: ScanEye,
};

const CAT_STYLE: Record<TechCategory, string> = {
  software: 'bg-violet-50 text-violet-700 ring-violet-200',
  conveyor: 'bg-slate-100 text-slate-700 ring-slate-200',
  special_machine: 'bg-amber-50 text-amber-700 ring-amber-200',
  robot: 'bg-brand-50 text-brand-700 ring-brand-200',
  agv: 'bg-teal-50 text-teal-700 ring-teal-200',
  inspection: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const CATS: TechCategory[] = ['software', 'conveyor', 'special_machine', 'robot', 'agv', 'inspection'];

const HYGIENE_LABEL: Record<string, string> = { dry: 'Dry', wet: 'Wet', washdown: 'Washdown' };

function CatBadge({ cat }: { cat: TechCategory }) {
  const Icon = CAT_ICON[cat] ?? Cpu;
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', CAT_STYLE[cat])}>
      <Icon size={12} /> {CATEGORY_LABEL[cat] ?? cat}
    </span>
  );
}

const fitTone = (f: number) => (f >= 70 ? 'good' : f >= 45 ? 'brand' : f >= 25 ? 'warn' : 'bad') as 'good' | 'brand' | 'warn' | 'bad';

const DECISION_RULES: { cat: TechCategory; when: string }[] = [
  { cat: 'software', when: 'Data entry, paperwork, quality & order documentation' },
  { cat: 'conveyor', when: 'Fixed product flow between neighbouring stations' },
  { cat: 'special_machine', when: 'Very high volume, single or few formats' },
  { cat: 'robot', when: 'Variable formats, mid volume, heavy or repetitive handling' },
  { cat: 'agv', when: 'Transport of pallets / bins between areas' },
  { cat: 'inspection', when: 'Quality checks, label / seal / fill verification' },
];

function DecisionLogic() {
  return (
    <Card title="How AutoScope picks a technology class" subtitle="A rule-based fit score per class: station type match, rate window, format variability, hygiene level and budget. Highest fit wins.">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DECISION_RULES.map((r) => {
          const Icon = CAT_ICON[r.cat];
          return (
            <div key={r.cat} className="flex items-start gap-3 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
              <div className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset', CAT_STYLE[r.cat])}><Icon size={16} /></div>
              <div className="min-w-0">
                <div className="text-xs text-ink-500">{r.when}</div>
                <div className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-ink-900"><ArrowRight size={12} className="text-ink-400" /> {CATEGORY_LABEL[r.cat]}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RecCard({ rec, station, score, catalog, rank }: { rec: TechRecommendation; station?: Station; score?: OpportunityScore; catalog: Map<string, TechClass>; rank: number }) {
  const best = rec.best ? catalog.get(rec.best.techId) : undefined;
  const alts = [...rec.alternatives].sort((a, b) => b.fit - a.fit);
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-5">
        {/* Recommendation */}
        <div className="p-5 lg:col-span-2 lg:border-r lg:border-ink-100">
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-ink-100 text-[11px] font-bold text-ink-700">#{rank}</span>
            <span className="font-medium text-ink-800">{station?.name ?? rec.stationId}</span>
            {station && <span className="truncate">· {STATION_TYPE_LABEL[station.type]}</span>}
            {score && <span className="ml-auto shrink-0 tabular-nums">score {Math.round(score.score)}</span>}
          </div>
          {best && rec.best ? (
            <>
              <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Recommended class</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-ink-900">{best.name}</h3>
                <CatBadge cat={best.category} />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="w-full"><ScoreBar value={rec.best.fit} tone={fitTone(rec.best.fit)} /></div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-ink-900">{Math.round(rec.best.fit)} fit</span>
              </div>
              <ul className="mt-4 space-y-1.5">
                {rec.best.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-700"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />{r}</li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-ink-50 p-3">
                  <div className="text-[11px] text-ink-500">Indicative capex</div>
                  <div className="text-sm font-semibold tabular-nums text-ink-900">{eur(best.capexMin)} – {eur(best.capexMax)}</div>
                </div>
                <div className="rounded-xl bg-ink-50 p-3">
                  <div className="flex items-center gap-1 text-[11px] text-ink-500"><Clock size={11} /> Lead time</div>
                  <div className="text-sm font-semibold tabular-nums text-ink-900">{best.leadTimeWeeks} weeks</div>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">No technology class in the catalog fits this station's constraints.</div>
          )}
        </div>

        {/* Alternatives */}
        <div className="bg-ink-50/40 p-5 lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <XCircle size={15} className="text-rose-500" />
            <h4 className="text-sm font-semibold text-ink-900">Why not the alternatives?</h4>
            <span className="text-xs text-ink-400">{alts.length} considered</span>
          </div>
          {alts.length === 0 ? (
            <p className="text-sm text-ink-500">No other suitable classes in the catalog.</p>
          ) : (
            <div className="divide-y divide-ink-100 rounded-xl border border-ink-100 bg-white">
              {alts.map((a) => {
                const t = catalog.get(a.techId);
                return (
                  <div key={a.techId} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[minmax(0,14rem)_4.5rem_1fr]">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink-800">{t?.name ?? a.techId}</div>
                      {t && <div className="mt-0.5"><CatBadge cat={t.category} /></div>}
                    </div>
                    <div className="text-right sm:text-left">
                      <div className="text-sm font-semibold tabular-nums text-ink-700">{Math.round(a.fit)}</div>
                      <div className="mt-1 w-14"><ScoreBar value={a.fit} tone={fitTone(a.fit)} /></div>
                    </div>
                    <div className="col-span-2 text-sm text-ink-600 sm:col-span-1">{a.whyNot}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TechCardItem({ t }: { t: TechClass }) {
  const Icon = CAT_ICON[t.category] ?? Cpu;
  const metric = (label: string, v: number) => (
    <div>
      <div className="flex justify-between text-[11px] text-ink-500"><span>{label}</span><span className="font-semibold tabular-nums text-ink-800">{pct(v)}</span></div>
      <div className="mt-1"><ScoreBar value={v * 100} tone="good" /></div>
    </div>
  );
  return (
    <div className="flex flex-col rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset', CAT_STYLE[t.category])}><Icon size={18} /></div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-900">{t.name}</div>
          <div className="text-xs text-ink-500">{CATEGORY_LABEL[t.category]}</div>
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-xs text-ink-600">{t.description}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-ink-50 px-2.5 py-1.5"><div className="text-ink-500">Capex</div><div className="font-semibold tabular-nums text-ink-900">{eur(t.capexMin)}–{eur(t.capexMax)}</div></div>
        <div className="rounded-lg bg-ink-50 px-2.5 py-1.5"><div className="text-ink-500">Rate</div><div className="font-semibold tabular-nums text-ink-900">{t.minRatePerMin}–{t.maxRatePerMin}/min</div></div>
      </div>
      <div className="mt-3 space-y-2">
        {metric('Labour reduction', t.labourReductionPct)}
        {metric('Scrap reduction', t.scrapReductionPct)}
        {metric('Downtime reduction', t.downtimeReductionPct)}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3 text-xs text-ink-500">
        <Droplets size={12} />
        {t.hygiene.map((h) => <Badge key={h}>{HYGIENE_LABEL[h] ?? h}</Badge>)}
        <span className="ml-auto inline-flex items-center gap-1"><Clock size={12} />{t.leadTimeWeeks} wk</span>
      </div>
    </div>
  );
}

export default function Technology() {
  const analysis: AnalysisBundle = useAnalysis();
  const catalog = useApp((s) => s.catalog);
  const stations = useApp((s) => s.line.stations);
  const [filter, setFilter] = useState<TechCategory | 'all'>('all');

  const { recs, catMap, stMap, scoreMap } = useMemo(() => {
    const catMap = new Map(catalog.map((t) => [t.id, t]));
    const stMap = new Map(stations.map((s) => [s.id, s]));
    const scoreMap = new Map(analysis.scores.map((s) => [s.stationId, s]));
    const recMap = new Map(analysis.recommendations.map((r) => [r.stationId, r]));
    const recs = analysis.scores
      .filter((s) => s.automatable && recMap.has(s.stationId))
      .map((s) => recMap.get(s.stationId)!);
    return { recs, catMap, stMap, scoreMap };
  }, [analysis, catalog, stations]);

  const top = recs.find((r) => r.best);
  const topTech = top?.best ? catMap.get(top.best.techId) : undefined;
  const filtered = filter === 'all' ? catalog : catalog.filter((t) => t.category === filter);
  const usedCats = new Set(recs.map((r) => (r.best ? catMap.get(r.best.techId)?.category : undefined)).filter(Boolean));

  return (
    <>
      <PageHeader
        eyebrow="Answer 2 · How to automate"
        title="The right technology class per station"
        subtitle="AutoScope recommends technology classes, never brands. For every station you see why the winner fits and exactly why each alternative lost."
        actions={<Badge tone="good"><ShieldCheck size={12} /> Vendor-neutral · no commissions</Badge>}
      />

      {recs.length === 0 ? (
        <Empty title="No automatable stations yet">
          Add stations in the <Link to="/line" className="font-semibold text-brand-700 underline">Line Builder</Link> to get technology recommendations.
        </Empty>
      ) : (
        <>
          <div className="mb-6 grid gap-6 xl:grid-cols-5">
            <div className="xl:col-span-3"><DecisionLogic /></div>
            <div className="xl:col-span-2">
              {top?.best && topTech ? (
                <AiExplain
                  title="Why this technology, not the others"
                  prompt={`Explain to a packaging SME owner why "${topTech.name}" is recommended for station "${stMap.get(top.stationId)?.name}" and why each alternative lost. Use only the fit scores, reasons and whyNot sentences in the context. Be vendor-neutral, under 130 words.`}
                  context={{
                    station: stMap.get(top.stationId),
                    recommended: { name: topTech.name, category: topTech.category, fit: top.best.fit, reasons: top.best.reasons, capexMin: topTech.capexMin, capexMax: topTech.capexMax, leadTimeWeeks: topTech.leadTimeWeeks },
                    alternatives: top.alternatives.map((a) => ({ name: catMap.get(a.techId)?.name ?? a.techId, fit: a.fit, whyNot: a.whyNot })),
                  }}
                />
              ) : (
                <Card title="AI explanation"><p className="text-sm text-ink-500">No recommendation available.</p></Card>
              )}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink-900">Recommendations in priority order</h2>
            <div className="flex flex-wrap gap-1.5">{CATS.filter((c) => usedCats.has(c)).map((c) => <CatBadge key={c} cat={c} />)}</div>
          </div>
          <div className="space-y-4">
            {recs.map((r) => (
              <RecCard key={r.stationId} rec={r} station={stMap.get(r.stationId)} score={scoreMap.get(r.stationId)} catalog={catMap} rank={scoreMap.get(r.stationId)?.rank ?? 0} />
            ))}
          </div>
        </>
      )}

      <div className="mt-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Technology catalog</h2>
            <p className="text-xs text-ink-500">
              Vendor-neutral technology classes, not brands. Ranges are indicative and editable under{' '}
              <Link to="/assumptions" className="font-medium text-brand-700 underline">Assumptions</Link>.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['all', ...CATS] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={cx('rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition', filter === c ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50')}
              >
                {c === 'all' ? `All (${catalog.length})` : `${CATEGORY_LABEL[c]} (${catalog.filter((t) => t.category === c).length})`}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <Empty title="No technology classes in this category" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((t) => <TechCardItem key={t.id} t={t} />)}
          </div>
        )}
      </div>
    </>
  );
}
