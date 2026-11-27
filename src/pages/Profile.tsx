import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, ClipboardList, RotateCcw, Sparkles } from 'lucide-react';
import { useApp } from '../store';
import { Badge, Button, Card, Field, Input, NumberInput, PageHeader, Select, Slider, cx } from '../components/ui';
import { eur, pct, SUBSECTOR_LABEL } from '../lib/format';
import type { DataMaturity, Goal, Hygiene, PackFormat, PlantDetails, SecondaryPack, SubSector, TempZone } from '../types';

const GOALS: { id: Goal; label: string; hint: string }[] = [
  { id: 'labour_shortage', label: 'Labour shortage', hint: "We can't fill open positions" },
  { id: 'ergonomics', label: 'Ergonomics & safety', hint: 'Heavy lifting, injuries, sick days' },
  { id: 'cost', label: 'Reduce cost', hint: 'Lower cost per unit' },
  { id: 'quality', label: 'Quality', hint: 'Fewer errors, complaints, recalls' },
  { id: 'throughput', label: 'More output', hint: 'Line cannot meet demand' },
];

const HYGIENE: { id: Hygiene; label: string; hint: string }[] = [
  { id: 'dry', label: 'Dry', hint: 'Packaged goods, dry cleaning' },
  { id: 'wet', label: 'Wet', hint: 'Splash water, regular wet cleaning' },
  { id: 'washdown', label: 'Washdown', hint: 'High-pressure cleaning, IP69K' },
];

const PACK_FORMATS: { id: PackFormat; label: string }[] = [
  { id: 'pet', label: 'PET' }, { id: 'glass', label: 'Glass' }, { id: 'can', label: 'Can' }, { id: 'carton', label: 'Carton' }, { id: 'pouch', label: 'Pouch' },
  { id: 'tray', label: 'Tray' }, { id: 'bag', label: 'Bag' }, { id: 'cup', label: 'Cup' }, { id: 'flow_wrap', label: 'Flow wrap' }, { id: 'bulk', label: 'Bulk' },
];
const SECONDARY: Record<SecondaryPack, string> = { case: 'Cardboard case', shrink: 'Shrink pack', tray: 'Tray', crate: 'Returnable crate', display: 'Display box', none: 'None' };
const TEMPS: Record<TempZone, string> = { ambient: 'Ambient', chilled: 'Chilled', frozen: 'Frozen', hot_fill: 'Hot fill' };
const CERTS = ['IFS Food', 'BRCGS', 'FSSC 22000', 'ISO 22000', 'Organic', 'Halal', 'Kosher'];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-700 hover:bg-brand-50')}>
      {on && <Check size={12} />}{children}
    </button>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-ink-100 p-1">
      {(Object.keys(options) as T[]).map((k) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={cx('flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium transition', value === k ? 'bg-white text-ink-900 shadow-sm ring-1 ring-ink-200' : 'text-ink-500 hover:text-ink-800')}>
          {options[k]}
        </button>
      ))}
    </div>
  );
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const PctField = ({ label, value, onChange, max = 100, hint }: { label: string; value: number; onChange: (v: number) => void; max?: number; hint?: string }) => (
  <Field label={label} hint={hint}>
    <Slider value={Math.round(value * 1000) / 10} onChange={(v) => onChange(v / 100)} min={0} max={max} step={max <= 20 ? 0.5 : 1} format={(v) => `${v}%`} />
  </Field>
);

/** Simple, explainable readiness check from site details. Max 9 points. */
function readiness(d: PlantDetails) {
  const items = [
    { label: 'Data', pts: d.dataMaturity === 'paper' ? 0 : d.dataMaturity === 'excel' ? 1 : 2, max: 2, note: d.dataMaturity === 'paper' ? 'Paper records: digitise first' : `Data in ${d.dataMaturity.toUpperCase()}` },
    { label: 'Maintenance', pts: Math.min(2, d.maintenanceStaff), max: 2, note: d.maintenanceStaff === 0 ? 'No own technicians' : `${d.maintenanceStaff} technician(s)` },
    { label: 'Floor space', pts: d.floorSpaceM2 < 30 ? 0 : d.floorSpaceM2 < 80 ? 1 : 2, max: 2, note: `${d.floorSpaceM2} m² free near the line` },
    { label: 'Machine connectivity', pts: d.plcConnectivity === 'none' ? 0 : d.plcConnectivity === 'some' ? 1 : 2, max: 2, note: `PLC connectivity: ${d.plcConnectivity}` },
    { label: 'Compressed air', pts: d.compressedAir ? 1 : 0, max: 1, note: d.compressedAir ? 'Available' : 'Needs installing' },
  ];
  const total = items.reduce((a, i) => a + i.pts, 0);
  const verdict = total >= 7 ? { label: 'Ready', tone: 'good' as const } : total >= 4 ? { label: 'Some prep needed', tone: 'warn' as const } : { label: 'Prep first', tone: 'bad' as const };
  return { items, total, verdict };
}

export default function Profile() {
  const p = useApp((s) => s.profile);
  const set = useApp((s) => s.setProfile);
  const d = useApp((s) => s.details);
  const setD = useApp((s) => s.setDetails);
  const officeCount = useApp((s) => s.office.length);
  const applyTemplate = useApp((s) => s.applyTemplate);
  const loadDemo = useApp((s) => s.loadDemo);
  const nav = useNavigate();
  const [params] = useSearchParams();
  const fromQ = params.get('from') === 'questionnaire';

  const toggleGoal = (g: Goal) => set({ goals: p.goals.includes(g) ? p.goals.filter((x) => x !== g) : [...p.goals, g] });
  const hours = p.shifts * p.hoursPerShift * p.operatingDaysPerYear;
  const ready = readiness(d);

  return (
    <div>
      {fromQ ? (
        <div className="mb-6 animate-fade-up rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <CheckCircle2 className="shrink-0 text-brand-600" size={28} />
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg font-semibold text-ink-900">Your answers are in.</div>
              <p className="text-sm text-ink-600">Here is everything we captured — adjust anything, then see the analysis.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => nav('/line')}>Check my line</Button>
              <Button onClick={() => nav('/app')}><Sparkles size={16} /> See the analysis</Button>
            </div>
          </div>
        </div>
      ) : null}

      <PageHeader
        eyebrow="Step 1 · Capture"
        title="Company profile"
        subtitle="Tell us about your plant. Never leaves your browser. These inputs drive every calculation."
        actions={
          <>
            <Button variant="secondary" onClick={loadDemo}>
              <RotateCcw size={16} /> Load demo company
            </Button>
            <Button onClick={() => nav('/line')}>
              Next: map your line <ArrowRight size={16} />
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Company" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name">
              <Input value={p.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Sub-sector" hint="Changing it offers a matching line template">
              <Select value={p.subSector} onChange={(e) => set({ subSector: e.target.value as SubSector })}>
                {Object.entries(SUBSECTOR_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field label="Products & packaging">
              <Input value={p.productDescription} onChange={(e) => set({ productDescription: e.target.value })} />
            </Field>
            <Field label="Employees">
              <NumberInput value={p.employees} onChange={(v) => set({ employees: v })} min={1} />
            </Field>
            <Field label="Product / pack variants (SKUs)">
              <NumberInput value={p.skuCount} onChange={(v) => set({ skuCount: v })} min={1} />
            </Field>
            <Field label="Changeovers per week">
              <NumberInput value={p.changeoversPerWeek} onChange={(v) => set({ changeoversPerWeek: v })} min={0} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
            Want a starting point for a {SUBSECTOR_LABEL[p.subSector]} line?
            <Button variant="secondary" className="!py-1" onClick={() => { applyTemplate(p.subSector); nav('/line'); }}>
              Load {SUBSECTOR_LABEL[p.subSector]} line template
            </Button>
          </div>
        </Card>

        <Card title="Operations" subtitle={`${hours.toLocaleString('en-US')} operating hours per year`}>
          <div className="grid gap-4">
            <Field label="Shifts per day">
              <Slider value={p.shifts} onChange={(v) => set({ shifts: v })} min={1} max={3} />
            </Field>
            <Field label="Hours per shift">
              <NumberInput value={p.hoursPerShift} onChange={(v) => set({ hoursPerShift: v })} suffix="h" />
            </Field>
            <Field label="Operating days per year">
              <NumberInput value={p.operatingDaysPerYear} onChange={(v) => set({ operatingDaysPerYear: v })} suffix="days" />
            </Field>
            <Field label="Labour cost (fully loaded)">
              <NumberInput value={p.labourCostPerHour} onChange={(v) => set({ labourCostPerHour: v })} suffix="€/h" />
            </Field>
            <Field label="Value per finished unit" hint="Used to price scrap and extra output">
              <NumberInput value={p.unitValueEur} onChange={(v) => set({ unitValueEur: v })} step={0.1} suffix="€" />
            </Field>
          </div>
        </Card>

        <Card title="Goals" subtitle="What should automation achieve? This changes which technology wins." className="lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {GOALS.map((g) => {
              const on = p.goals.includes(g.id);
              return (
                <button key={g.id} onClick={() => toggleGoal(g.id)}
                  className={cx('rounded-xl border p-3 text-left transition', on ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-ink-200 hover:bg-ink-50')}>
                  <div className="text-sm font-semibold text-ink-900">{g.label}</div>
                  <div className="text-xs text-ink-500">{g.hint}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-5">
            <div className="mb-2 text-xs font-medium text-ink-600">Hygiene level of the packaging area</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {HYGIENE.map((h) => (
                <button key={h.id} onClick={() => set({ hygiene: h.id })}
                  className={cx('rounded-xl border p-3 text-left transition', p.hygiene === h.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-ink-200 hover:bg-ink-50')}>
                  <div className="text-sm font-semibold">{h.label}</div>
                  <div className="text-xs text-ink-500">{h.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Investment frame">
          <div className="grid gap-4">
            <Field label="Budget for automation">
              <Slider value={p.budget} onChange={(v) => set({ budget: v })} min={25000} max={1500000} step={10000} format={(v) => eur(v)} />
            </Field>
            <Field label="Evaluation horizon">
              <Slider value={p.horizonYears} onChange={(v) => set({ horizonYears: v })} min={2} max={10} format={(v) => `${v} yrs`} />
            </Field>
            <Field label="Discount rate" hint="Your cost of capital, used for NPV">
              <Slider value={p.discountRate} onChange={(v) => set({ discountRate: v })} min={0.02} max={0.15} step={0.01} format={(v) => pct(v)} />
            </Field>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------ plant details */}
      <div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-sand-600">Plant details</div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-900">Processes & every small detail</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">Optional inputs that sharpen the recommendations and the report.</p>
        </div>
        <Link to="/office" className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-ink-700 ring-1 ring-ink-200 transition hover:bg-ink-50">
          <ClipboardList size={16} className="text-brand-600" /> Office & admin processes: <b>{officeCount}</b> captured <span className="text-brand-700">→ manage</span>
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Products & packaging" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="mb-1.5 text-xs font-medium text-ink-600">Pack formats</div>
              <div className="flex flex-wrap gap-1.5">
                {PACK_FORMATS.map((f) => <Chip key={f.id} on={d.packFormats.includes(f.id)} onClick={() => setD({ packFormats: toggle(d.packFormats, f.id) })}>{f.label}</Chip>)}
              </div>
            </div>
            <Field label="Secondary packaging">
              <Select value={d.secondaryPack} onChange={(e) => setD({ secondaryPack: e.target.value as SecondaryPack })}>
                {Object.entries(SECONDARY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Container sizes"><Input value={d.containerSizes} onChange={(e) => setD({ containerSizes: e.target.value })} /></Field>
            <Field label="Temperature zone"><Seg value={d.temperatureZone} options={TEMPS} onChange={(v) => setD({ temperatureZone: v })} /></Field>
            <Field label="Shelf life"><NumberInput value={d.shelfLifeDays} onChange={(v) => setD({ shelfLifeDays: v })} min={0} suffix="days" /></Field>
            <Field label="New SKUs per year"><NumberInput value={d.newSkusPerYear} onChange={(v) => setD({ newSkusPerYear: v })} min={0} /></Field>
            <Field label="Allergen changeovers"><Seg value={d.allergenChangeovers ? 'y' : 'n'} options={{ y: 'Yes', n: 'No' }} onChange={(v) => setD({ allergenChangeovers: v === 'y' })} /></Field>
            <div className="sm:col-span-2"><PctField label="Seasonal peak (extra volume)" value={d.seasonalPeakPct} onChange={(v) => setD({ seasonalPeakPct: v })} /></div>
          </div>
        </Card>

        <Card title="Site & technical readiness" actions={<Badge tone={ready.verdict.tone}>{ready.verdict.label}</Badge>} subtitle={`${ready.total} of 9 readiness points`}>
          <ul className="mb-4 space-y-1.5">
            {ready.items.map((i) => (
              <li key={i.label} className="flex items-center gap-2 text-xs">
                <span className={cx('h-2 w-2 shrink-0 rounded-full', i.pts === i.max ? 'bg-emerald-500' : i.pts > 0 ? 'bg-amber-500' : 'bg-rose-500')} />
                <span className="font-medium text-ink-700">{i.label}</span>
                <span className="ml-auto text-right text-ink-500">{i.note}</span>
              </li>
            ))}
          </ul>
          <div className="grid gap-3">
            <Field label="Free floor space near line"><Slider value={d.floorSpaceM2} onChange={(v) => setD({ floorSpaceM2: v })} min={0} max={400} step={10} format={(v) => `${v} m²`} /></Field>
            <Field label="Ceiling height"><Slider value={d.ceilingHeightM} onChange={(v) => setD({ ceilingHeightM: v })} min={2.5} max={12} step={0.5} format={(v) => `${v} m`} /></Field>
            <Field label="Compressed air"><Seg value={d.compressedAir ? 'y' : 'n'} options={{ y: 'Available', n: 'Not available' }} onChange={(v) => setD({ compressedAir: v === 'y' })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Maintenance staff"><NumberInput value={d.maintenanceStaff} onChange={(v) => setD({ maintenanceStaff: v })} min={0} /></Field>
              <Field label="Existing robots"><NumberInput value={d.existingRobots} onChange={(v) => setD({ existingRobots: v })} min={0} /></Field>
            </div>
            <Field label="PLC connectivity"><Seg value={d.plcConnectivity} options={{ none: 'None', some: 'Some', most: 'Most' }} onChange={(v) => setD({ plcConnectivity: v })} /></Field>
            <Field label="Data maturity"><Seg<DataMaturity> value={d.dataMaturity} options={{ paper: 'Paper', excel: 'Excel', erp: 'ERP', mes: 'MES' }} onChange={(v) => setD({ dataMaturity: v })} /></Field>
            <Field label="ERP system"><Input value={d.erpSystem} placeholder="None" onChange={(e) => setD({ erpSystem: e.target.value })} /></Field>
            <Field label="Previous automation experience"><Seg value={d.previousAutomationExperience} options={{ none: 'None', bad: 'Bad', good: 'Good' }} onChange={(v) => setD({ previousAutomationExperience: v })} /></Field>
          </div>
        </Card>

        <Card title="Volumes & logistics" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Units per case"><NumberInput value={d.unitsPerCase} onChange={(v) => setD({ unitsPerCase: v })} min={1} /></Field>
            <Field label="Case weight"><NumberInput value={d.caseWeightKg} onChange={(v) => setD({ caseWeightKg: v })} step={0.5} suffix="kg" /></Field>
            <Field label="Cases per pallet"><NumberInput value={d.casesPerPallet} onChange={(v) => setD({ casesPerPallet: v })} min={1} /></Field>
            <Field label="Pallets per day"><NumberInput value={d.palletsPerDay} onChange={(v) => setD({ palletsPerDay: v })} min={0} /></Field>
            <Field label="Forklift trips per shift"><NumberInput value={d.forkliftTripsPerShift} onChange={(v) => setD({ forkliftTripsPerShift: v })} min={0} /></Field>
            <Field label="Distance to warehouse"><NumberInput value={d.warehouseDistanceM} onChange={(v) => setD({ warehouseDistanceM: v })} min={0} suffix="m" /></Field>
            <Field label="Pallet type"><Seg value={d.palletType} options={{ euro: 'Euro', industrial: 'Industrial', half: 'Half', mixed: 'Mixed' }} onChange={(v) => setD({ palletType: v })} /></Field>
            <div className="sm:col-span-2"><PctField label="Mixed / customer-specific pallets" value={d.mixedPalletsPct} onChange={(v) => setD({ mixedPalletsPct: v })} /></div>
          </div>
        </Card>

        <Card title="People & safety">
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Production staff"><NumberInput value={d.productionStaff} onChange={(v) => setD({ productionStaff: v })} min={0} /></Field>
              <Field label="Open vacancies"><NumberInput value={d.openVacancies} onChange={(v) => setD({ openVacancies: v })} min={0} /></Field>
              <Field label="Ergonomic complaints/yr"><NumberInput value={d.ergonomicComplaintsPerYear} onChange={(v) => setD({ ergonomicComplaintsPerYear: v })} min={0} /></Field>
              <Field label="Lost-time injuries/yr"><NumberInput value={d.lostTimeInjuriesPerYear} onChange={(v) => setD({ lostTimeInjuriesPerYear: v })} min={0} /></Field>
            </div>
            <PctField label="Staff turnover per year" value={d.staffTurnoverPct} onChange={(v) => setD({ staffTurnoverPct: v })} max={60} />
            <PctField label="Sick leave" value={d.sickLeavePct} onChange={(v) => setD({ sickLeavePct: v })} max={20} />
            <PctField label="Temporary workers" value={d.temporaryWorkersPct} onChange={(v) => setD({ temporaryWorkersPct: v })} max={80} />
          </div>
        </Card>

        <Card title="Quality & compliance" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="mb-1.5 text-xs font-medium text-ink-600">Certifications</div>
              <div className="flex flex-wrap gap-1.5">
                {CERTS.map((c) => <Chip key={c} on={d.certifications.includes(c)} onClick={() => setD({ certifications: toggle(d.certifications, c) })}>{c}</Chip>)}
              </div>
            </div>
            <Field label="Traceability"><Seg value={d.traceability} options={{ batch_paper: 'Batch · paper', batch_digital: 'Batch · digital', unit_level: 'Per unit' }} onChange={(v) => setD({ traceability: v })} /></Field>
            <Field label="Customer complaints per month"><NumberInput value={d.customerComplaintsPerMonth} onChange={(v) => setD({ customerComplaintsPerMonth: v })} min={0} /></Field>
            <Field label="Manual quality checks per shift"><NumberInput value={d.manualQualityChecksPerShift} onChange={(v) => setD({ manualQualityChecksPerShift: v })} min={0} /></Field>
            <Field label="Cleaning time per day"><NumberInput value={d.cleaningMinPerDay} onChange={(v) => setD({ cleaningMinPerDay: v })} min={0} suffix="min" /></Field>
          </div>
        </Card>

        <Card title="Decision frame">
          <div className="grid gap-3">
            <Field label="Decision timeline"><Slider value={d.decisionTimelineMonths} onChange={(v) => setD({ decisionTimelineMonths: v })} min={1} max={24} format={(v) => `${v} mo`} /></Field>
            <Field label="Interested in public funding (KfW, state programmes)"><Seg value={d.fundingInterest ? 'y' : 'n'} options={{ y: 'Yes', n: 'No' }} onChange={(v) => setD({ fundingInterest: v === 'y' })} /></Field>
            <Field label="Biggest pain">
              <textarea value={d.biggestPain} onChange={(e) => setD({ biggestPain: e.target.value })} rows={4}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
            </Field>
          </div>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => nav('/line')}>Map your line</Button>
        <Button onClick={() => nav('/app')}>See the analysis <ArrowRight size={16} /></Button>
      </div>
    </div>
  );
}
