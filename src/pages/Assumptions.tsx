import { RotateCcw, Scale, ShieldCheck, Sigma, SlidersHorizontal, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../store';
import { PageHeader, Card, Field, NumberInput, Slider, Button, Badge, Empty, cx } from '../components/ui';
import { eur, pct, CATEGORY_LABEL } from '../lib/format';
import type { ScoreFactorKey, TechClass } from '../types';

const SOURCES: { use: string; url: string; label: string; type: string }[] = [
  { use: 'Analyse activities, not whole jobs; feasibility is not adoption; ~59% of manufacturing activities technically automatable', url: 'https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/where-machines-could-replace-humans-and-where-they-cant-yet', label: 'McKinsey: Where machines could replace humans', type: 'Consulting research' },
  { use: '~57% of US work hours technically automatable (a potential, not a forecast)', url: 'https://www.mckinsey.com/no/our-insights/agents-robots-and-us-skill-partnerships-in-the-age-of-ai', label: 'McKinsey: Agents, robots and us', type: 'Consulting research' },
  { use: 'Rule-based, high-volume, low-complexity processes suit RPA', url: 'https://icaew.com/technical/technology/finance-in-a-digital-world/rpa-for-finance-professionals/where-could-rpa-work-for-your-business', label: 'ICAEW: Where could RPA work', type: 'Professional body' },
  { use: 'RPA suitability attributes: rule-based, volume, exceptions, stability, structured input', url: 'https://appian.com/blog/2020/the-best-use-cases-for-rpa', label: 'Appian: Best use cases for RPA', type: 'Vendor blog' },
  { use: 'Academic suitability criteria and score', url: 'https://www.scitepress.org/Papers/2020/98867/98867.pdf', label: 'SciTePress 2020 paper', type: 'Conference paper' },
  { use: 'Rule-based suitability method (RRPA)', url: 'https://espace2.etsmtl.ca/29021/1/Benzarti-I-2024-29021.pdf', label: 'Benzarti 2024, ETS Montreal', type: 'Thesis' },
  { use: '1/3/5 scoring; try Lean or Six Sigma first for judgement-heavy processes', url: 'https://www.morganfranklin.com/?p=11502', label: 'MorganFranklin', type: 'Consultancy' },
  { use: 'Rule of Five for RPA process selection', url: 'https://www.forrester.com/report/Use-The-Rule-Of-Five-To-Find-The-Right-RPA-Process/RES144074', label: 'Forrester: Rule of Five', type: 'Analyst (paywalled)' },
  { use: 'ROI and payback formulas; cobot arm under half of deployed cost; 12-18 month payback', url: 'https://www.evsint.com/cobot-roi-calculator-sme-manufacturing/', label: 'EVS: Cobot ROI calculator', type: 'Vendor blog' },
  { use: 'Cobot payback 6-12 months vs 2-5 years for large robots', url: 'https://www.aerospace.co.uk/news/beyond-the-price-tag-the-obvious-and-hidden-roi-of-cobots/', label: 'Aerospace.co.uk: ROI of cobots', type: 'Vendor blog' },
  { use: 'Cobot price range about USD 25k-75k', url: 'https://standardbots.com/guides/robots-for-manufacturers-a-guide', label: 'Standard Bots guide', type: 'Vendor guide' },
  { use: 'Payback method for robot economics (Amortisationsrechnung)', url: 'https://www.ipa.fraunhofer.de/content/dam/ipa/Leitfaden_Wirtschaftlichkeit_final.pdf', label: 'Fraunhofer IPA: Leitfaden Wirtschaftlichkeit', type: 'Research institute' },
  { use: 'Cost-benefit model for robots in SME production under uncertain data', url: 'https://publica.fraunhofer.de/handle/publica/282741', label: 'Fraunhofer Publica', type: 'Doctoral thesis' },
  { use: 'Investment calculation standard (payback, NPV, IRR)', url: 'https://www.din.de/en/wdc-beuth:din21:144665031/toc-1815206/download', label: 'VDI 6025', type: 'Standard' },
  { use: 'Process for choosing automation hardware', url: 'https://www.ipt.fraunhofer.de/content/dam/ipt/de/documents/praesentationen/133_referenzfolie_automatisierungskonzepte.pdf', label: 'Fraunhofer IPT: Automatisierungskonzepte', type: 'Research institute' },
  { use: 'German SME context: where AI pays off and where a simpler solution is enough', url: 'https://www.ihk.de/regensburg/fachthemen/digitalisierung/kuenstliche-intelligenz/datenmanagement-7188936', label: 'IHK Regensburg', type: 'Chamber of commerce' },
  { use: 'German SME AI handbook', url: 'https://www.ptw.tu-darmstadt.de/media/fachgebietptw/dokumente_3/wissenssammlung_ptw/leitfaeden_2/Handbuch-Kuenstliche-Intelligenz_Mittelstand-Digital-Zentrum-Kaiserslautern.pdf', label: 'Mittelstand-Digital Zentrum Kaiserslautern', type: 'Public programme' },
];

const FACTORS: { key: ScoreFactorKey; label: string; hint: string; color: string }[] = [
  { key: 'labour', label: 'Labour cost', hint: 'Annual labour cost at the station', color: '#636f30' },
  { key: 'repetitiveness', label: 'Repetitiveness', hint: 'Identical motions all shift', color: '#b9874a' },
  { key: 'ergonomics', label: 'Ergonomics', hint: 'Kg lifted and injury risk', color: '#f59e0b' },
  { key: 'quality', label: 'Quality / scrap', hint: 'Scrap cost and error rate', color: '#ef4444' },
  { key: 'bottleneck', label: 'Bottleneck', hint: 'Utilisation vs. takt', color: '#10b981' },
  { key: 'stability', label: 'Process stability', hint: 'Low variability = easier to automate', color: '#7d7563' },
];

const FORMULAS: { term: string; def: string; formula: string }[] = [
  { term: 'Opportunity score', formula: 'Σ (factor value 0-100 × factor weight)', def: 'Six factors are scored 0-100 per station and combined with the weights above. Stations already automated, or with nothing to gain, are excluded.' },
  { term: 'Total investment', formula: 'capex × (1 + integration %)', def: 'Capex is placed inside the class range based on required rate; integration covers engineering, safety and commissioning.' },
  { term: 'Annual savings', formula: 'labour + scrap + downtime + ergonomics + throughput', def: 'Labour = station labour cost × labour reduction %. Scrap and downtime similarly. Ergonomics = avoided injury cost for high-risk operators.' },
  { term: 'Payback', formula: 'investment ÷ (annual savings − running cost)', def: 'Running cost = capex × annual opex %. If savings never exceed running cost, payback is "never".' },
  { term: 'NPV', formula: 'Σₜ net benefit ÷ (1 + r)ᵗ − investment', def: 'Over the evaluation horizon, discounted at the company discount rate from the profile.' },
  { term: 'OEE estimate', formula: 'availability × performance × quality', def: 'Availability = 1 − downtime; performance = line rate ÷ target rate (max 1); quality = 1 − scrap, using the bottleneck path.' },
  { term: 'Monte Carlo', formula: 'N runs, capex ± cost %, savings ± savings %', def: 'Each run draws random capex and savings within the uncertainty bands and recomputes payback and NPV, giving P10 / P50 / P90.' },
];

function Cell({ value, onChange, step = 1, w = 'w-20', percent }: { value: number; onChange: (n: number) => void; step?: number; w?: string; percent?: boolean }) {
  const shown = percent ? Math.round(value * 1000) / 10 : value;
  return (
    <input
      type="number"
      value={Number.isFinite(shown) ? shown : 0}
      step={step}
      onChange={(e) => {
        const n = parseFloat(e.target.value) || 0;
        onChange(percent ? n / 100 : n);
      }}
      className={cx('rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink-900 outline-none hover:border-ink-200 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100', w)}
    />
  );
}

function CatalogTable() {
  const catalog = useApp((s) => s.catalog);
  const updateTech = useApp((s) => s.updateTech);
  const resetCatalog = useApp((s) => s.resetCatalog);
  const up = (id: string) => (patch: Partial<TechClass>) => updateTech(id, patch);
  return (
    <Card
      title="Technology catalog"
      subtitle="Vendor-neutral classes with indicative ranges. Click any number to edit; recommendations and ROI recompute instantly. Percentages are in %."
      actions={<Button variant="secondary" onClick={() => resetCatalog()}><RotateCcw size={14} /> Reset to defaults</Button>}
    >
      {catalog.length === 0 ? (
        <Empty title="Catalog is empty">Click "Reset to defaults" to restore the built-in technology classes.</Empty>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-y border-ink-100 bg-ink-50 text-left text-[11px] uppercase tracking-wider text-ink-500">
              <tr>
                <th className="sticky left-0 bg-ink-50 px-5 py-2 font-semibold">Technology class</th>
                <th className="px-2 py-2 font-semibold">Category</th>
                <th className="px-2 py-2 text-right font-semibold">Capex min €</th>
                <th className="px-2 py-2 text-right font-semibold">Capex max €</th>
                <th className="px-2 py-2 text-right font-semibold">Integr. %</th>
                <th className="px-2 py-2 text-right font-semibold">Opex %/yr</th>
                <th className="px-2 py-2 text-right font-semibold">Labour −%</th>
                <th className="px-2 py-2 text-right font-semibold">Scrap −%</th>
                <th className="px-2 py-2 text-right font-semibold">Rate min</th>
                <th className="px-2 py-2 text-right font-semibold">Rate max</th>
                <th className="px-2 py-2 text-right font-semibold">Max var.</th>
                <th className="px-2 py-2 pr-5 text-right font-semibold">Lead wk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {catalog.map((t) => {
                const u = up(t.id);
                return (
                  <tr key={t.id} className="hover:bg-ink-50/50">
                    <td className="sticky left-0 max-w-[16rem] truncate bg-white px-5 py-1.5 font-medium text-ink-800" title={t.name}>{t.name}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs text-ink-500">{CATEGORY_LABEL[t.category] ?? t.category}</td>
                    <td className="px-2 py-1.5 text-right"><Cell value={t.capexMin} step={1000} w="w-24" onChange={(n) => u({ capexMin: n })} /></td>
                    <td className="px-2 py-1.5 text-right"><Cell value={t.capexMax} step={1000} w="w-24" onChange={(n) => u({ capexMax: n })} /></td>
                    <td className="px-2 py-1.5 text-right"><Cell value={t.integrationPct} percent w="w-16" onChange={(n) => u({ integrationPct: n })} /></td>
                    <td className="px-2 py-1.5 text-right"><Cell value={t.annualOpexPct} percent w="w-16" onChange={(n) => u({ annualOpexPct: n })} /></td>
                    <td className="px-2 py-1.5 text-right"><Cell value={t.labourReductionPct} percent w="w-16" onChange={(n) => u({ labourReductionPct: Math.min(1, n) })} /></td>
                    <td className="px-2 py-1.5 text-right"><Cell value={t.scrapReductionPct} percent w="w-16" onChange={(n) => u({ scrapReductionPct: Math.min(1, n) })} /></td>
                    <td className="px-2 py-1.5 text-right"><Cell value={t.minRatePerMin} w="w-16" onChange={(n) => u({ minRatePerMin: n })} /></td>
                    <td className="px-2 py-1.5 text-right"><Cell value={t.maxRatePerMin} w="w-16" onChange={(n) => u({ maxRatePerMin: n })} /></td>
                    <td className="px-2 py-1.5 text-right"><Cell value={t.maxVariability} w="w-14" onChange={(n) => u({ maxVariability: Math.max(1, Math.min(5, n)) })} /></td>
                    <td className="px-2 py-1.5 pr-5 text-right"><Cell value={t.leadTimeWeeks} w="w-14" onChange={(n) => u({ leadTimeWeeks: n })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function AssumptionsPage() {
  const a = useApp((s) => s.assumptions);
  const setAssumptions = useApp((s) => s.setAssumptions);
  const weights = a.scoreWeights ?? ({} as Record<ScoreFactorKey, number>);
  const sum = FACTORS.reduce((s, f) => s + (weights[f.key] ?? 0), 0);
  const balanced = Math.abs(sum - 1) < 0.015;

  const setWeight = (k: ScoreFactorKey, v: number) => setAssumptions({ scoreWeights: { ...weights, [k]: v } });
  const normalize = () => {
    if (sum <= 0) {
      const eq = 1 / FACTORS.length;
      setAssumptions({ scoreWeights: Object.fromEntries(FACTORS.map((f) => [f.key, eq])) as Record<ScoreFactorKey, number> });
      return;
    }
    setAssumptions({ scoreWeights: Object.fromEntries(FACTORS.map((f) => [f.key, Math.round(((weights[f.key] ?? 0) / sum) * 1000) / 1000])) as Record<ScoreFactorKey, number> });
  };

  return (
    <>
      <PageHeader
        eyebrow="Transparency panel"
        title="Assumptions"
        subtitle="Every number in AutoScope comes from these inputs. Change anything, and every page updates instantly. No black box, no vendor bias."
        actions={<Badge tone="good"><ShieldCheck size={12} /> Deterministic engine · AI only explains</Badge>}
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title={<span className="inline-flex items-center gap-2"><SlidersHorizontal size={15} className="text-brand-600" /> Global assumptions</span>} subtitle="Cost drivers and uncertainty bands used by ROI and Monte Carlo.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Injury cost per high-risk operator" hint="Absence + insurance, € per year">
              <NumberInput value={a.injuryCostPerHighRiskOperatorYear} step={500} min={0} suffix="€/yr" onChange={(n) => setAssumptions({ injuryCostPerHighRiskOperatorYear: Math.max(0, n) })} />
            </Field>
            <Field label="Monte Carlo runs" hint="More runs = smoother distribution">
              <NumberInput value={a.monteCarloRuns} step={100} min={100} max={20000} suffix="runs" onChange={(n) => setAssumptions({ monteCarloRuns: Math.max(50, Math.min(20000, Math.round(n))) })} />
            </Field>
          </div>
          <div className="mt-5 space-y-4">
            <Field label="Recruiting premium" hint="Extra labour cost when labour shortage is a goal">
              <Slider value={a.recruitingPremiumPct} min={0} max={0.5} step={0.01} format={(v) => pct(v)} onChange={(v) => setAssumptions({ recruitingPremiumPct: v })} />
            </Field>
            <Field label="Cost uncertainty (± capex)" hint="Monte Carlo band around investment">
              <Slider value={a.costUncertaintyPct} min={0} max={0.6} step={0.01} format={(v) => `±${pct(v)}`} onChange={(v) => setAssumptions({ costUncertaintyPct: v })} />
            </Field>
            <Field label="Savings uncertainty (± savings)" hint="Monte Carlo band around annual savings">
              <Slider value={a.savingsUncertaintyPct} min={0} max={0.6} step={0.01} format={(v) => `±${pct(v)}`} onChange={(v) => setAssumptions({ savingsUncertaintyPct: v })} />
            </Field>
          </div>
        </Card>

        <Card
          title={<span className="inline-flex items-center gap-2"><Scale size={15} className="text-brand-600" /> Opportunity score weights</span>}
          subtitle="How much each factor counts towards a station's 0-100 score."
          actions={<Button variant="secondary" onClick={normalize} disabled={balanced}>Normalize</Button>}
        >
          <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-ink-100">
            {FACTORS.map((f) => (
              <div key={f.key} title={`${f.label} ${pct((weights[f.key] ?? 0) / Math.max(sum, 1e-9))}`} style={{ width: `${((weights[f.key] ?? 0) / Math.max(sum, 1)) * 100}%`, background: f.color }} className="h-full transition-all" />
            ))}
          </div>
          <div className="space-y-3">
            {FACTORS.map((f) => (
              <div key={f.key}>
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: f.color }} />
                  <span className="font-medium text-ink-700">{f.label}</span>
                  <span className="truncate text-ink-400">· {f.hint}</span>
                </div>
                <Slider value={weights[f.key] ?? 0} min={0} max={0.6} step={0.01} format={(v) => pct(v)} onChange={(v) => setWeight(f.key, v)} />
              </div>
            ))}
          </div>
          <div className={cx('mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm', balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>
            {balanced ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span>Sum of weights: <strong className="tabular-nums">{pct(sum, 1)}</strong>{balanced ? '. Balanced.' : '. Should be 100%; click Normalize.'}</span>
          </div>
        </Card>
      </div>

      <div className="mb-6"><CatalogTable /></div>

      <Card title={<span className="inline-flex items-center gap-2"><Sigma size={15} className="text-brand-600" /> The formulas, in plain language</span>} subtitle="The deterministic engine behind every number. The AI never computes figures; it only captures inputs and explains results.">
        <dl className="grid gap-3 md:grid-cols-2">
          {FORMULAS.map((f) => (
            <div key={f.term} className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">
              <dt className="text-sm font-semibold text-ink-900">{f.term}</dt>
              <dd className="mt-1.5">
                <code className="block rounded-lg bg-white px-2.5 py-1.5 font-mono text-xs text-brand-800 ring-1 ring-ink-100">{f.formula}</code>
                <p className="mt-2 text-xs leading-relaxed text-ink-600">{f.def}</p>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-ink-400">Example: a cobot palletizer at {eur(120000)} capex with 20% integration is a {eur(144000)} investment; saving {eur(70000)}/yr with {eur(6000)}/yr running cost pays back in {(144000 / 64000).toFixed(1)} years.</p>
      </Card>

      <Card className="mt-6" title={<span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-brand-600" /> Methods & sources</span>} subtitle="What the method is built on, and where to check it.">
        <ul className="mb-4 grid gap-2 text-sm text-ink-700 md:grid-cols-2">
          <li><b>Activities, not jobs:</b> each station or office process is scored on its own (McKinsey).</li>
          <li><b>Suitability criteria:</b> rule-based, structured input, few exceptions, stability, system access, rated 1/3/5 (RPA literature, MorganFranklin).</li>
          <li><b>Fix before automate:</b> judgement-heavy or unstable processes go to Lean / standardisation first.</li>
          <li><b>Pay-off:</b> static payback, NPV and IRR per VDI 6025 and the Fraunhofer IPA payback method, with best / worst ranges and Monte Carlo.</li>
        </ul>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500"><tr><th className="py-2 pr-3">Used for</th><th className="pr-3">Source</th><th>Type</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {SOURCES.map((s) => (
                <tr key={s.url}>
                  <td className="py-2 pr-3 text-xs text-ink-600">{s.use}</td>
                  <td className="py-2 pr-3"><a href={s.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-700 underline hover:text-brand-800">{s.label}</a></td>
                  <td className="py-2"><Badge>{s.type}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <b>Honest note:</b> the cost, saving and duration values in the technology catalogues (line and office) are planning assumptions, not quotes and not sourced. Replace them with 2–3 integrator or vendor quotes before investing. Vendor blogs are used for ranges only, never as proof.
        </p>
      </Card>
    </>
  );
}
