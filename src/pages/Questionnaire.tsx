import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Beef, Candy, Check, ChevronDown, Croissant, GlassWater, Lightbulb, Milk, Plus, Soup, Sparkles, Trash2, X,
} from 'lucide-react';
import { useApp } from '../store';
import { LINE_TEMPLATES } from '../data/templates';
import { Button, Field, Input, NumberInput, Select, Slider, cx } from '../components/ui';
import { eur, STATION_TYPE_LABEL, SUBSECTOR_LABEL, uid } from '../lib/format';
import type {
  AutomationLevel, CompanyProfile, Goal, Hygiene, OfficeProcess, OfficeTask, PackFormat, PlantDetails, Ratings, SecondaryPack, Station, StationType, SubSector, TempZone, DataMaturity,
} from '../types';

// ---------------------------------------------------------------- static option lists
const SECTORS: { id: SubSector; icon: typeof Milk; hint: string }[] = [
  { id: 'beverages', icon: GlassWater, hint: 'Water, soft drinks, beer, juice' },
  { id: 'dairy', icon: Milk, hint: 'Yogurt, milk, cheese, desserts' },
  { id: 'bakery', icon: Croissant, hint: 'Bread, rolls, cakes, biscuits' },
  { id: 'confectionery', icon: Candy, hint: 'Chocolate, sweets, snacks' },
  { id: 'ready_meals', icon: Soup, hint: 'Trays, salads, soups, convenience' },
  { id: 'meat', icon: Beef, hint: 'Sausage, cold cuts, fresh meat' },
];

const PACK_FORMATS: { id: PackFormat; label: string }[] = [
  { id: 'pet', label: 'PET bottle' }, { id: 'glass', label: 'Glass bottle / jar' }, { id: 'can', label: 'Can' },
  { id: 'carton', label: 'Carton / box' }, { id: 'pouch', label: 'Pouch' }, { id: 'tray', label: 'Tray' },
  { id: 'bag', label: 'Bag' }, { id: 'cup', label: 'Cup' }, { id: 'flow_wrap', label: 'Flow wrap' }, { id: 'bulk', label: 'Bulk / sacks' },
];
const SECONDARY: { id: SecondaryPack; label: string }[] = [
  { id: 'case', label: 'Cardboard case' }, { id: 'shrink', label: 'Shrink pack' }, { id: 'tray', label: 'Tray' },
  { id: 'crate', label: 'Returnable crate' }, { id: 'display', label: 'Display box' }, { id: 'none', label: 'None' },
];
const TEMPS: { id: TempZone; label: string }[] = [
  { id: 'ambient', label: 'Ambient' }, { id: 'chilled', label: 'Chilled' }, { id: 'frozen', label: 'Frozen' }, { id: 'hot_fill', label: 'Hot fill' },
];
const HYGIENE: { id: Hygiene; label: string; hint: string }[] = [
  { id: 'dry', label: 'Dry', hint: 'Wiped or vacuumed' },
  { id: 'wet', label: 'Wet', hint: 'Splash water, wet cleaning' },
  { id: 'washdown', label: 'Washdown', hint: 'High-pressure hose-down' },
];
const GOALS: { id: Goal; label: string; hint: string }[] = [
  { id: 'labour_shortage', label: 'Labour shortage', hint: "We can't fill open jobs" },
  { id: 'ergonomics', label: 'Ergonomics & safety', hint: 'Heavy lifting, back pain' },
  { id: 'cost', label: 'Lower cost', hint: 'Cheaper per unit' },
  { id: 'quality', label: 'Quality', hint: 'Fewer errors & complaints' },
  { id: 'throughput', label: 'More output', hint: "Line can't keep up" },
];
const CERTS = ['IFS Food', 'BRCGS', 'FSSC 22000', 'ISO 22000', 'Organic', 'Halal', 'Kosher'];
const PROBLEMS = ['Heavy lifting', 'Frequent jams', 'Waits for material', 'Manual counting', 'Label errors', 'Hard to staff', 'Long changeovers', 'Product damage'];
const LEVELS: { id: AutomationLevel; label: string }[] = [{ id: 'manual', label: 'Manual' }, { id: 'semi', label: 'Semi' }, { id: 'auto', label: 'Auto' }];

const SECTOR_PRESET: Record<SubSector, { packFormats: PackFormat[]; secondaryPack: SecondaryPack; temperatureZone: TempZone; hygiene: Hygiene; unitValueEur: number; containerSizes: string; unitsPerCase: number; caseWeightKg: number; shelfLifeDays: number }> = {
  beverages: { packFormats: ['glass', 'pet'], secondaryPack: 'crate', temperatureZone: 'ambient', hygiene: 'wet', unitValueEur: 7, containerSizes: '0.5 L, 1.0 L', unitsPerCase: 12, caseWeightKg: 12, shelfLifeDays: 365 },
  dairy: { packFormats: ['cup'], secondaryPack: 'tray', temperatureZone: 'chilled', hygiene: 'washdown', unitValueEur: 9, containerSizes: '150 g, 500 g', unitsPerCase: 24, caseWeightKg: 6, shelfLifeDays: 30 },
  bakery: { packFormats: ['bag'], secondaryPack: 'crate', temperatureZone: 'ambient', hygiene: 'dry', unitValueEur: 10, containerSizes: '500 g, 750 g', unitsPerCase: 10, caseWeightKg: 6, shelfLifeDays: 7 },
  confectionery: { packFormats: ['flow_wrap', 'carton'], secondaryPack: 'display', temperatureZone: 'ambient', hygiene: 'dry', unitValueEur: 25, containerSizes: '40 g, 100 g', unitsPerCase: 48, caseWeightKg: 5, shelfLifeDays: 270 },
  ready_meals: { packFormats: ['tray'], secondaryPack: 'case', temperatureZone: 'chilled', hygiene: 'wet', unitValueEur: 30, containerSizes: '400 g', unitsPerCase: 8, caseWeightKg: 4, shelfLifeDays: 10 },
  meat: { packFormats: ['tray', 'pouch'], secondaryPack: 'crate', temperatureZone: 'chilled', hygiene: 'washdown', unitValueEur: 35, containerSizes: '200 g, 1 kg', unitsPerCase: 10, caseWeightKg: 10, shelfLifeDays: 21 },
};

// ---------------------------------------------------------------- office jobs
interface OfficeDraft { key: string; on: boolean; name: string; task: OfficeTask; minPerRun: number; runsPerWeek: number; errPct: number; costPerError: number; ratings: Ratings }
const OFFICE_JOBS: OfficeDraft[] = [
  { key: 'orders', on: true, name: 'Customer order entry from email/fax', task: 'docs', minPerRun: 6, runsPerWeek: 120, errPct: 3, costPerError: 40, ratings: [5, 3, 3, 5, 3] },
  { key: 'dispatch', on: true, name: 'Delivery notes & pallet labels', task: 'data', minPerRun: 4, runsPerWeek: 150, errPct: 2, costPerError: 30, ratings: [5, 5, 3, 5, 5] },
  { key: 'haccp', on: true, name: 'HACCP / temperature logs', task: 'quality_log', minPerRun: 10, runsPerWeek: 60, errPct: 4, costPerError: 60, ratings: [5, 3, 5, 5, 3] },
  { key: 'report', on: true, name: 'Weekly production / OEE report', task: 'report', minPerRun: 150, runsPerWeek: 1, errPct: 2, costPerError: 50, ratings: [5, 5, 5, 3, 3] },
  { key: 'planning', on: false, name: 'Shift & line planning', task: 'planning', minPerRun: 60, runsPerWeek: 5, errPct: 5, costPerError: 150, ratings: [3, 3, 3, 3, 3] },
  { key: 'invoices', on: false, name: 'Supplier invoice entry', task: 'docs', minPerRun: 5, runsPerWeek: 80, errPct: 2, costPerError: 35, ratings: [5, 3, 3, 5, 3] },
  { key: 'complaints', on: false, name: 'Customer complaint handling', task: 'email', minPerRun: 30, runsPerWeek: 5, errPct: 3, costPerError: 200, ratings: [1, 1, 1, 3, 3] },
  { key: 'approvals', on: false, name: 'Purchase & leave approvals', task: 'approve', minPerRun: 5, runsPerWeek: 30, errPct: 1, costPerError: 20, ratings: [5, 5, 3, 5, 3] },
];
const RATING_QS: { q: string; opts: [string, string, string] }[] = [
  { q: 'Could a stranger follow the steps written on a card?', opts: ['Yes, always', 'Mostly', 'No'] },
  { q: 'What does the job start from?', opts: ['Clean digital data', 'PDFs, emails, photos', 'Handwriting or talking'] },
  { q: 'How often does something odd happen?', opts: ['Rarely', 'Sometimes', 'Often'] },
  { q: 'Will the job look the same in two years?', opts: ['Yes', 'Changes yearly', 'All the time'] },
  { q: 'Can a program reach where the data must go?', opts: ['Direct connection / API', 'Only by clicking screens', 'Paper or closed machine'] },
];

// ---------------------------------------------------------------- draft model
interface DraftStation extends Station { included: boolean; problems: string[]; extra: string }
interface Draft {
  profile: CompanyProfile;
  details: PlantDetails;
  lineName: string;
  unitName: string;
  targetRate: number;
  stationsFor: SubSector;
  stations: DraftStation[];
  office: OfficeDraft[];
}

const toDraftStations = (sector: SubSector): DraftStation[] =>
  JSON.parse(JSON.stringify(LINE_TEMPLATES[sector].stations)).map((s: Station) => ({
    ...s, id: uid(), included: true, problems: [], extra: (s.issues ?? []).join('. '),
  }));

function initialDraft(): Draft {
  const sector: SubSector = 'beverages';
  const pre = SECTOR_PRESET[sector];
  return {
    profile: {
      name: '', subSector: sector, employees: 60, shifts: 2, hoursPerShift: 8, operatingDaysPerYear: 250, labourCostPerHour: 38,
      budget: 400000, horizonYears: 5, discountRate: 0.08, goals: ['labour_shortage', 'cost'], hygiene: pre.hygiene, skuCount: 20,
      changeoversPerWeek: 5, unitValueEur: pre.unitValueEur, productDescription: '',
    },
    details: {
      packFormats: pre.packFormats, secondaryPack: pre.secondaryPack, containerSizes: pre.containerSizes, temperatureZone: pre.temperatureZone,
      shelfLifeDays: pre.shelfLifeDays, allergenChangeovers: false, newSkusPerYear: 3, seasonalPeakPct: 0.2,
      unitsPerCase: pre.unitsPerCase, caseWeightKg: pre.caseWeightKg, casesPerPallet: 60, palletsPerDay: 40, mixedPalletsPct: 0.1,
      palletType: 'euro', forkliftTripsPerShift: 30, warehouseDistanceM: 60,
      productionStaff: 35, openVacancies: 2, staffTurnoverPct: 0.15, sickLeavePct: 0.06, temporaryWorkersPct: 0.1,
      ergonomicComplaintsPerYear: 4, lostTimeInjuriesPerYear: 1,
      certifications: ['IFS Food'], customerComplaintsPerMonth: 3, traceability: 'batch_paper', manualQualityChecksPerShift: 10, cleaningMinPerDay: 45,
      floorSpaceM2: 80, ceilingHeightM: 5, compressedAir: true, maintenanceStaff: 2, plcConnectivity: 'some', dataMaturity: 'excel', erpSystem: '', existingRobots: 0,
      decisionTimelineMonths: 6, fundingInterest: true, biggestPain: '', previousAutomationExperience: 'none',
    },
    lineName: LINE_TEMPLATES[sector].name,
    unitName: LINE_TEMPLATES[sector].unitName,
    targetRate: LINE_TEMPLATES[sector].targetRatePerMin,
    stationsFor: sector,
    stations: toDraftStations(sector),
    office: OFFICE_JOBS.map((j) => ({ ...j, ratings: [...j.ratings] as Ratings })),
  };
}

const STORAGE_KEY = 'autoscope-questionnaire-draft-v1';
function loadDraft(): { draft: Draft; step: number } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.draft?.profile && parsed?.draft?.details) return { draft: parsed.draft, step: parsed.step ?? 0 };
    }
  } catch { /* ignore */ }
  return { draft: initialDraft(), step: 0 };
}

const STEPS = ['Company', 'Products', 'Operations', 'Your line', 'People', 'Quality', 'Office', 'Site', 'Goals', 'Review'];

// ---------------------------------------------------------------- small building blocks
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition',
        on ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50')}>
      {on && <Check size={14} />}{children}
    </button>
  );
}

function Segmented<T extends string | number>({ value, options, onChange, small }: { value: T; options: { id: T; label: string; hint?: string }[]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-ink-100 p-1">
      {options.map((o) => (
        <button key={String(o.id)} type="button" onClick={() => onChange(o.id)}
          className={cx('flex-1 whitespace-nowrap rounded-lg font-medium transition', small ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm',
            value === o.id ? 'bg-white text-ink-900 shadow-sm ring-1 ring-ink-200' : 'text-ink-500 hover:text-ink-800')}>
          {o.label}
          {o.hint && !small && <span className="block text-[11px] font-normal text-ink-400">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex gap-2 rounded-lg bg-sand-100 px-3 py-2 text-xs text-sand-700">
      <Lightbulb size={14} className="mt-0.5 shrink-0" /><span>{children}</span>
    </div>
  );
}

function Q({ label, help, tip, children, className }: { label: string; help?: string; tip?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-2xl border border-ink-100 bg-white p-4 shadow-sm', className)}>
      <div className="text-sm font-semibold text-ink-900">{label}</div>
      {help && <div className="mt-0.5 text-xs text-ink-500">{help}</div>}
      <div className="mt-3">{children}</div>
      {tip && <Tip>{tip}</Tip>}
    </div>
  );
}

function Stepper({ value, onChange, step = 1, min = 0, max = 9999, suffix }: { value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  const clamp = (n: number) => Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(clamp(value - step))} className="h-9 w-9 shrink-0 rounded-lg border border-ink-200 bg-white text-lg font-semibold text-ink-700 hover:bg-ink-50">−</button>
      <div className="min-w-0 flex-1"><NumberInput value={value} onChange={(n) => onChange(clamp(n))} step={step} min={min} max={max} suffix={suffix} /></div>
      <button type="button" onClick={() => onChange(clamp(value + step))} className="h-9 w-9 shrink-0 rounded-lg border border-ink-200 bg-white text-lg font-semibold text-ink-700 hover:bg-ink-50">+</button>
    </div>
  );
}

function YesNo({ value, onChange, yes = 'Yes', no = 'No' }: { value: boolean; onChange: (v: boolean) => void; yes?: string; no?: string }) {
  return <Segmented value={value ? 'y' : 'n'} options={[{ id: 'y', label: yes }, { id: 'n', label: no }]} onChange={(v) => onChange(v === 'y')} />;
}

const pctFmt = (v: number) => `${Math.round(v)}%`;
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

// ---------------------------------------------------------------- main
export default function Questionnaire() {
  const nav = useNavigate();
  const store = { setProfile: useApp((x) => x.setProfile), setDetails: useApp((x) => x.setDetails), setLine: useApp((x) => x.setLine), setOffice: useApp((x) => x.setOffice), setChat: useApp((x) => x.setChat), setExtraction: useApp((x) => x.setExtraction) };
  const [{ draft: initial, step: initialStep }] = useState(loadDraft);
  const [d, setD] = useState<Draft>(initial);
  const [step, setStep] = useState(initialStep);
  const [openStation, setOpenStation] = useState<string | null>(null);
  const [addType, setAddType] = useState<StationType>('manual_other');

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ draft: d, step })); } catch { /* ignore */ }
  }, [d, step]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  const P = (p: Partial<CompanyProfile>) => setD((x) => ({ ...x, profile: { ...x.profile, ...p } }));
  const D = (p: Partial<PlantDetails>) => setD((x) => ({ ...x, details: { ...x.details, ...p } }));
  const S = (id: string, p: Partial<DraftStation>) => setD((x) => ({ ...x, stations: x.stations.map((s) => (s.id === id ? { ...s, ...p } : s)) }));
  const O = (key: string, p: Partial<OfficeDraft>) => setD((x) => ({ ...x, office: x.office.map((o) => (o.key === key ? { ...o, ...p } : o)) }));

  const pickSector = (sector: SubSector) => {
    const pre = SECTOR_PRESET[sector];
    const t = LINE_TEMPLATES[sector];
    setD((x) => {
      if (x.profile.subSector === sector) return x;
      return {
        ...x,
        profile: { ...x.profile, subSector: sector, hygiene: pre.hygiene, unitValueEur: pre.unitValueEur },
        details: { ...x.details, packFormats: pre.packFormats, secondaryPack: pre.secondaryPack, temperatureZone: pre.temperatureZone, containerSizes: pre.containerSizes, unitsPerCase: pre.unitsPerCase, caseWeightKg: pre.caseWeightKg, shelfLifeDays: pre.shelfLifeDays },
        lineName: t.name, unitName: t.unitName, targetRate: t.targetRatePerMin, stationsFor: sector, stations: toDraftStations(sector),
      };
    });
  };

  const addStation = () => {
    const s: DraftStation = {
      id: uid(), name: STATION_TYPE_LABEL[addType], type: addType, level: 'manual', operatorsPerShift: 1, ratePerMin: Math.round(d.targetRate * 1.2 * 10) / 10,
      scrapRate: 0.01, downtimePct: 0.02, liftKgPerUnit: 0, changeoverMin: 10, repetitiveness: 4, variability: 2, included: true, problems: [], extra: '',
    };
    setD((x) => ({ ...x, stations: [...x.stations, s] }));
    setOpenStation(s.id);
  };

  const included = d.stations.filter((s) => s.included);
  const tickedOffice = d.office.filter((o) => o.on);
  const p = d.profile;
  const det = d.details;

  const finish = () => {
    const stations: Station[] = included.map((s, i) => {
      const { included: _i, problems, extra, ...rest } = s;
      const issues = [...problems, ...extra.split(/\n|\.\s+/).map((t) => t.trim().replace(/\.$/, '')).filter(Boolean)];
      return { ...rest, issues, position: { x: i * 240, y: 0 } };
    });
    const office: OfficeProcess[] = tickedOffice.map((o) => ({
      id: uid(), name: o.name, task: o.task, minPerRun: o.minPerRun, runsPerWeek: o.runsPerWeek, errPct: o.errPct, costPerError: o.costPerError, ratings: o.ratings,
    }));
    store.setProfile({ ...p, name: p.name.trim() || 'My company', skuCount: Math.max(1, p.skuCount) });
    store.setDetails(det);
    store.setLine({ name: d.lineName || 'Packaging line', unitName: d.unitName || 'units', targetRatePerMin: d.targetRate, stations });
    store.setOffice(office);
    store.setChat([]);
    store.setExtraction(null);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    nav('/profile?from=questionnaire');
  };

  const restart = () => { setD(initialDraft()); setStep(0); };
  const last = STEPS.length - 1;
  const progress = Math.round((step / last) * 100);

  const annualHours = p.shifts * p.hoursPerShift * p.operatingDaysPerYear;
  const operators = included.reduce((a, s) => a + s.operatorsPerShift, 0);
  const officeHours = tickedOffice.reduce((a, o) => a + (o.minPerRun * o.runsPerWeek) / 60, 0);

  // ------------------------------------------------------------ steps
  const steps: { title: string; intro: string; body: ReactNode }[] = [
    {
      title: 'Let’s start with your company',
      intro: 'A few basics so we can pick a realistic starting line for your kind of food business.',
      body: (
        <div className="grid gap-4">
          <Q label="What is your company called?" help="Only used on your report. Nothing leaves your browser.">
            <Input placeholder="e.g. Müller Feinkost GmbH" value={p.name} onChange={(e) => P({ name: e.target.value })} />
          </Q>
          <Q label="What do you make?" help="Pick the closest. It loads a typical line we then adjust together.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SECTORS.map(({ id, icon: Icon, hint }) => {
                const on = p.subSector === id;
                return (
                  <button key={id} type="button" onClick={() => pickSector(id)}
                    className={cx('group rounded-2xl border p-4 text-left transition', on ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200' : 'border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/50')}>
                    <div className={cx('mb-3 flex h-11 w-11 items-center justify-center rounded-xl transition', on ? 'bg-brand-600 text-white' : 'bg-sand-100 text-sand-700 group-hover:bg-brand-100 group-hover:text-brand-700')}>
                      <Icon size={22} />
                    </div>
                    <div className="text-sm font-semibold text-ink-900">{SUBSECTOR_LABEL[id]}</div>
                    <div className="mt-0.5 text-xs text-ink-500">{hint}</div>
                  </button>
                );
              })}
            </div>
          </Q>
          <div className="grid gap-4 sm:grid-cols-2">
            <Q label="How many people work for you in total?" help="Office and production together.">
              <Stepper value={p.employees} onChange={(v) => P({ employees: v })} step={5} min={1} />
            </Q>
            <Q label="Describe your products in one sentence" help="Helps the report read like it is about you.">
              <Input placeholder="e.g. Organic yogurt in 150 g cups for retail" value={p.productDescription} onChange={(e) => P({ productDescription: e.target.value })} />
            </Q>
          </div>
        </div>
      ),
    },
    {
      title: 'Products & packaging',
      intro: 'What leaves your line, and how often it changes. Variety is the biggest factor for which machines fit.',
      body: (
        <div className="grid gap-4">
          <Q label="Which pack formats do you fill?" help="Pick all that apply.">
            <div className="flex flex-wrap gap-2">
              {PACK_FORMATS.map((f) => <Chip key={f.id} on={det.packFormats.includes(f.id)} onClick={() => D({ packFormats: toggle(det.packFormats, f.id) })}>{f.label}</Chip>)}
            </div>
          </Q>
          <Q label="What goes around them for shipping?" help="Secondary packaging.">
            <div className="flex flex-wrap gap-2">
              {SECONDARY.map((f) => <Chip key={f.id} on={det.secondaryPack === f.id} onClick={() => D({ secondaryPack: f.id })}>{f.label}</Chip>)}
            </div>
          </Q>
          <div className="grid gap-4 sm:grid-cols-2">
            <Q label="Typical container sizes" help="Free text, comma-separated.">
              <Input value={det.containerSizes} onChange={(e) => D({ containerSizes: e.target.value })} />
            </Q>
            <Q label="Shelf life of your products">
              <Stepper value={det.shelfLifeDays} onChange={(v) => D({ shelfLifeDays: v })} step={1} min={1} suffix="days" />
            </Q>
          </div>
          <Q label="Temperature in the packing area">
            <Segmented value={det.temperatureZone} options={TEMPS} onChange={(v) => D({ temperatureZone: v })} />
          </Q>
          <Q label="How is the packing area cleaned?" help="Decides which machine designs are allowed (e.g. IP69K for washdown).">
            <Segmented value={p.hygiene} options={HYGIENE} onChange={(v) => P({ hygiene: v })} />
          </Q>
          <div className="grid gap-4 sm:grid-cols-2">
            <Q label="How many different products / pack variants (SKUs)?" tip="Count the lines in your article list that run on this packaging line.">
              <Stepper value={p.skuCount} onChange={(v) => P({ skuCount: v })} min={1} />
            </Q>
            <Q label="New products per year">
              <Stepper value={det.newSkusPerYear} onChange={(v) => D({ newSkusPerYear: v })} />
            </Q>
            <Q label="Changeovers per week" help="Switching product, size or label." tip="Look at last week's production plan and count the product switches.">
              <Stepper value={p.changeoversPerWeek} onChange={(v) => P({ changeoversPerWeek: v })} />
            </Q>
            <Q label="Do changeovers need allergen cleaning?">
              <YesNo value={det.allergenChangeovers} onChange={(v) => D({ allergenChangeovers: v })} />
            </Q>
          </div>
          <Q label="How much busier is your peak season?" help="Extra volume on top of a normal month (e.g. summer for drinks, Christmas for sweets).">
            <Slider value={det.seasonalPeakPct * 100} onChange={(v) => D({ seasonalPeakPct: v / 100 })} min={0} max={100} step={5} format={(v) => `+${Math.round(v)}%`} />
          </Q>
          <Q label={`What is one finished unit worth? (one of your ${d.unitName})`} help="Selling price to your customer. Used to value scrap and extra output." tip="Take last year's revenue for this line and divide by the units shipped.">
            <NumberInput value={p.unitValueEur} onChange={(v) => P({ unitValueEur: v })} step={0.5} min={0} suffix="€" />
          </Q>
        </div>
      ),
    },
    {
      title: 'Operations & logistics',
      intro: 'How long your line runs, what an hour of work costs, and what leaves the building every day.',
      body: (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Q label="Shifts per day"><Segmented value={p.shifts} options={[1, 2, 3].map((n) => ({ id: n, label: String(n) }))} onChange={(v) => P({ shifts: v })} /></Q>
            <Q label="Hours per shift"><Stepper value={p.hoursPerShift} onChange={(v) => P({ hoursPerShift: v })} step={0.5} min={4} max={12} suffix="h" /></Q>
            <Q label="Operating days per year" help="5-day week ≈ 250"><Stepper value={p.operatingDaysPerYear} onChange={(v) => P({ operatingDaysPerYear: v })} step={5} min={50} max={365} /></Q>
          </div>
          <div className="rounded-xl bg-brand-50 px-4 py-2 text-sm text-brand-800">That is about <b>{annualHours.toLocaleString('en-US')} line hours</b> per year.</div>
          <Q label="What does one hour of a production worker cost you?" help="Fully loaded: wage plus social security, holidays, and overhead." tip="Gross annual wage × 1.3, divided by about 1,600 working hours. Typical German F&B: €32–45/h.">
            <Slider value={p.labourCostPerHour} onChange={(v) => P({ labourCostPerHour: v })} min={20} max={70} step={1} format={(v) => `€${v}/h`} />
          </Q>
          <div className="grid gap-4 sm:grid-cols-2">
            <Q label="What do you count at the end of the line?" help="All speeds later use this unit.">
              <Segmented value={d.unitName} options={['cases', 'bottles', 'packs'].map((u) => ({ id: u, label: u }))} onChange={(v) => setD((x) => ({ ...x, unitName: v }))} />
            </Q>
            <Q label={`Target output: ${d.unitName} per minute`} help="What the line should deliver to meet demand." tip="Daily demand ÷ (shift hours × 60). Or read the nameplate speed of your filler and divide by units per case.">
              <Stepper value={d.targetRate} onChange={(v) => setD((x) => ({ ...x, targetRate: v }))} step={0.5} min={0.5} />
            </Q>
            <Q label="Units per case"><Stepper value={det.unitsPerCase} onChange={(v) => D({ unitsPerCase: v })} min={1} /></Q>
            <Q label="Weight of one full case" tip="Put one on a bathroom scale."><Stepper value={det.caseWeightKg} onChange={(v) => D({ caseWeightKg: v })} step={0.5} min={0} suffix="kg" /></Q>
            <Q label="Cases per pallet"><Stepper value={det.casesPerPallet} onChange={(v) => D({ casesPerPallet: v })} step={5} min={1} /></Q>
            <Q label="Pallets shipped per day"><Stepper value={det.palletsPerDay} onChange={(v) => D({ palletsPerDay: v })} step={5} min={0} /></Q>
          </div>
          <Q label="Share of mixed or customer-specific pallets" help="Pallets with several products or special stacking patterns.">
            <Slider value={det.mixedPalletsPct * 100} onChange={(v) => D({ mixedPalletsPct: v / 100 })} min={0} max={100} step={5} format={pctFmt} />
          </Q>
          <Q label="Pallet type">
            <Segmented value={det.palletType} options={[{ id: 'euro', label: 'Euro' }, { id: 'industrial', label: 'Industrial' }, { id: 'half', label: 'Half' }, { id: 'mixed', label: 'Mixed' }]} onChange={(v) => D({ palletType: v })} />
          </Q>
          <div className="grid gap-4 sm:grid-cols-2">
            <Q label="Forklift trips per shift" help="Line ↔ warehouse, both directions." tip="Ask the forklift driver to make a tally mark per trip for one shift.">
              <Stepper value={det.forkliftTripsPerShift} onChange={(v) => D({ forkliftTripsPerShift: v })} step={5} />
            </Q>
            <Q label="Distance from line end to warehouse"><Stepper value={det.warehouseDistanceM} onChange={(v) => D({ warehouseDistanceM: v })} step={10} suffix="m" /></Q>
          </div>
        </div>
      ),
    },
    {
      title: 'Your line, station by station',
      intro: `We started from a typical ${SUBSECTOR_LABEL[p.subSector].toLowerCase()} line. Switch off what you don't have, adjust what's different, and add anything missing.`,
      body: (
        <div className="grid gap-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <Q label="Name of this line"><Input value={d.lineName} onChange={(e) => setD((x) => ({ ...x, lineName: e.target.value }))} /></Q>
            <div className="rounded-2xl border border-ink-100 bg-white p-4 text-sm text-ink-600 shadow-sm">
              <b className="text-ink-900">{included.length}</b> stations included · <b className="text-ink-900">{operators.toLocaleString('en-US', { maximumFractionDigits: 1 })}</b> operators per shift.
              <Tip>Speeds are in {d.unitName} per minute. Count how many pass in 1 minute, three times, and take the middle value.</Tip>
            </div>
          </div>
          {d.stations.map((s, i) => {
            const open = openStation === s.id;
            return (
              <div key={s.id} className={cx('rounded-2xl border bg-white shadow-sm transition', s.included ? 'border-ink-100' : 'border-dashed border-ink-200 opacity-60')}>
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <button type="button" onClick={() => S(s.id, { included: !s.included })} aria-label="Include station"
                    className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition', s.included ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 bg-white')}>
                    {s.included && <Check size={14} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{i + 1} · {STATION_TYPE_LABEL[s.type]}</div>
                    <input value={s.name} onChange={(e) => S(s.id, { name: e.target.value })} className="w-full truncate bg-transparent text-sm font-semibold text-ink-900 outline-none focus:underline" />
                  </div>
                  <div className="w-full sm:w-56"><Segmented small value={s.level} options={LEVELS} onChange={(v) => S(s.id, { level: v })} /></div>
                </div>
                {s.included && (
                  <div className="border-t border-ink-100 px-4 pb-4 pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="People at this station per shift"><Stepper value={s.operatorsPerShift} onChange={(v) => S(s.id, { operatorsPerShift: v })} step={0.5} /></Field>
                      <Field label={`Rough speed (${d.unitName}/min)`}><Stepper value={s.ratePerMin} onChange={(v) => S(s.id, { ratePerMin: v })} step={0.5} /></Field>
                    </div>
                    <button type="button" onClick={() => setOpenStation(open ? null : s.id)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
                      <ChevronDown size={14} className={cx('transition', open && 'rotate-180')} /> {open ? 'Less detail' : 'More detail & problems'}
                      {s.problems.length > 0 && <span className="ml-1 rounded-full bg-sand-200 px-1.5 text-[10px] text-sand-700">{s.problems.length}</span>}
                    </button>
                    {open && (
                      <div className="mt-3 grid animate-fade-up gap-3 sm:grid-cols-2">
                        <Field label="Kg lifted by hand per unit" hint="0 if nobody lifts. A 12-bottle crate ≈ 14 kg."><Stepper value={s.liftKgPerUnit} onChange={(v) => S(s.id, { liftKgPerUnit: v })} step={0.5} suffix="kg" /></Field>
                        <Field label="Changeover time" hint="Minutes from last good unit to first good unit."><Stepper value={s.changeoverMin} onChange={(v) => S(s.id, { changeoverMin: v })} step={5} suffix="min" /></Field>
                        <Field label="How repetitive? (1 varied … 5 same motion all shift)"><Segmented small value={s.repetitiveness} options={[1, 2, 3, 4, 5].map((n) => ({ id: n, label: String(n) }))} onChange={(v) => S(s.id, { repetitiveness: v })} /></Field>
                        <Field label="How many formats? (1 one … 5 many / irregular)"><Segmented small value={s.variability} options={[1, 2, 3, 4, 5].map((n) => ({ id: n, label: String(n) }))} onChange={(v) => S(s.id, { variability: v })} /></Field>
                        <Field label="Unplanned stops (share of time)" hint="Jams, waiting, breakdowns."><Slider value={s.downtimePct * 100} onChange={(v) => S(s.id, { downtimePct: v / 100 })} min={0} max={30} step={0.5} format={(v) => `${v}%`} /></Field>
                        <Field label="Scrap / rework" hint="Out of 100 units, how many are lost?"><Slider value={s.scrapRate * 100} onChange={(v) => S(s.id, { scrapRate: v / 100 })} min={0} max={10} step={0.1} format={(v) => `${v.toFixed(1)}%`} /></Field>
                        <div className="sm:col-span-2">
                          <div className="mb-1.5 text-xs font-medium text-ink-600">Common problems here</div>
                          <div className="flex flex-wrap gap-1.5">
                            {PROBLEMS.map((pr) => <Chip key={pr} on={s.problems.includes(pr)} onClick={() => S(s.id, { problems: toggle(s.problems, pr) })}>{pr}</Chip>)}
                          </div>
                          <textarea value={s.extra} onChange={(e) => S(s.id, { extra: e.target.value })} rows={2} placeholder="Anything else? e.g. 'Labels peel off in the cold store'"
                            className="mt-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
                        </div>
                        <div className="sm:col-span-2 flex justify-end">
                          <button type="button" onClick={() => setD((x) => ({ ...x, stations: x.stations.filter((y) => y.id !== s.id) }))} className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700">
                            <Trash2 size={13} /> Remove station
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-ink-300 bg-white/60 p-4 sm:flex-row sm:items-center">
            <span className="text-sm font-medium text-ink-700">Missing a step?</span>
            <div className="flex-1"><Select value={addType} onChange={(e) => setAddType(e.target.value as StationType)}>
              {Object.entries(STATION_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select></div>
            <Button variant="secondary" onClick={addStation}><Plus size={16} /> Add station</Button>
          </div>
        </div>
      ),
    },
    {
      title: 'People & safety',
      intro: 'Staffing pressure and physical strain often matter more than pure cost. Rough numbers are fine.',
      body: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Q label="People in production & packing" help="Across all shifts."><Stepper value={det.productionStaff} onChange={(v) => D({ productionStaff: v })} /></Q>
          <Q label="Open production vacancies right now"><Stepper value={det.openVacancies} onChange={(v) => D({ openVacancies: v })} /></Q>
          <Q label="Staff turnover per year" tip="People who left last year ÷ average headcount."><Slider value={det.staffTurnoverPct * 100} onChange={(v) => D({ staffTurnoverPct: v / 100 })} min={0} max={60} format={pctFmt} /></Q>
          <Q label="Sick leave rate" tip="Your payroll or HR report shows it. German average ≈ 6%."><Slider value={det.sickLeavePct * 100} onChange={(v) => D({ sickLeavePct: v / 100 })} min={0} max={20} step={0.5} format={(v) => `${v}%`} /></Q>
          <Q label="Share of temporary / agency workers"><Slider value={det.temporaryWorkersPct * 100} onChange={(v) => D({ temporaryWorkersPct: v / 100 })} min={0} max={80} step={5} format={pctFmt} /></Q>
          <Q label="Back / joint complaints per year" help="Reported to the works doctor or supervisor."><Stepper value={det.ergonomicComplaintsPerYear} onChange={(v) => D({ ergonomicComplaintsPerYear: v })} /></Q>
          <Q label="Lost-time injuries per year" help="Accidents with at least one day off." className="sm:col-span-2"><Stepper value={det.lostTimeInjuriesPerYear} onChange={(v) => D({ lostTimeInjuriesPerYear: v })} /></Q>
        </div>
      ),
    },
    {
      title: 'Quality & compliance',
      intro: 'Audits, checks and records. Manual checks are often the easiest win.',
      body: (
        <div className="grid gap-4">
          <Q label="Which certifications do you hold?">
            <div className="flex flex-wrap gap-2">
              {CERTS.map((c) => <Chip key={c} on={det.certifications.includes(c)} onClick={() => D({ certifications: toggle(det.certifications, c) })}>{c}</Chip>)}
            </div>
          </Q>
          <Q label="How do you trace a batch today?">
            <Segmented value={det.traceability} options={[{ id: 'batch_paper', label: 'Paper', hint: 'Batch on paper' }, { id: 'batch_digital', label: 'Digital', hint: 'Batch in software' }, { id: 'unit_level', label: 'Per unit', hint: 'Code on each pack' }]} onChange={(v) => D({ traceability: v })} />
          </Q>
          <div className="grid gap-4 sm:grid-cols-3">
            <Q label="Customer complaints per month"><Stepper value={det.customerComplaintsPerMonth} onChange={(v) => D({ customerComplaintsPerMonth: v })} /></Q>
            <Q label="Manual quality checks per shift" help="Weight, seal, label, temperature…" tip="Count the rows on one shift's check sheet."><Stepper value={det.manualQualityChecksPerShift} onChange={(v) => D({ manualQualityChecksPerShift: v })} /></Q>
            <Q label="Cleaning time per day"><Stepper value={det.cleaningMinPerDay} onChange={(v) => D({ cleaningMinPerDay: v })} step={5} suffix="min" /></Q>
          </div>
        </div>
      ),
    },
    {
      title: 'Office & admin around the line',
      intro: 'Paperwork can be automated too, often for a few thousand euros. Tick the jobs your team does by hand.',
      body: (
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Tip>Minutes per run: time it 3 times with a phone stopwatch and take the middle value.</Tip>
            <Tip>Runs per week: how many per day × 5. Error rate: out of 100, how many go wrong?</Tip>
          </div>
          {d.office.map((o) => (
            <div key={o.key} className={cx('rounded-2xl border bg-white shadow-sm transition', o.on ? 'border-brand-200' : 'border-ink-100')}>
              <button type="button" onClick={() => O(o.key, { on: !o.on })} className="flex w-full items-center gap-3 p-4 text-left">
                <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-md border', o.on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300')}>{o.on && <Check size={14} />}</span>
                <span className="flex-1 text-sm font-semibold text-ink-900">{o.name}</span>
                {o.on && <span className="hidden text-xs text-ink-500 sm:inline">≈ {Math.round((o.minPerRun * o.runsPerWeek) / 60)} h/week</span>}
              </button>
              {o.on && (
                <div className="animate-fade-up border-t border-ink-100 px-4 pb-4 pt-3">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Field label="Minutes per run"><NumberInput value={o.minPerRun} onChange={(v) => O(o.key, { minPerRun: v })} min={0} /></Field>
                    <Field label="Runs per week"><NumberInput value={o.runsPerWeek} onChange={(v) => O(o.key, { runsPerWeek: v })} min={0} /></Field>
                    <Field label="Error rate"><NumberInput value={o.errPct} onChange={(v) => O(o.key, { errPct: Math.min(100, v) })} min={0} max={100} suffix="%" /></Field>
                    <Field label="Cost per error"><NumberInput value={o.costPerError} onChange={(v) => O(o.key, { costPerError: v })} min={0} suffix="€" /></Field>
                  </div>
                  <div className="mt-3 grid gap-3">
                    {RATING_QS.map((rq, qi) => (
                      <div key={qi}>
                        <div className="mb-1 text-xs font-medium text-ink-600">{rq.q}</div>
                        <Segmented small value={o.ratings[qi]} options={[{ id: 5, label: rq.opts[0] }, { id: 3, label: rq.opts[1] }, { id: 1, label: rq.opts[2] }]}
                          onChange={(v) => { const r = [...o.ratings] as Ratings; r[qi] = v; O(o.key, { ratings: r }); }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Site & technical readiness',
      intro: 'Can your plant take a machine next month? This decides whether a project starts with prep work.',
      body: (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Q label="Free floor space near the line" tip="Pace it out: one long step ≈ 0.8 m."><Slider value={det.floorSpaceM2} onChange={(v) => D({ floorSpaceM2: v })} min={0} max={400} step={10} format={(v) => `${v} m²`} /></Q>
            <Q label="Ceiling height"><Slider value={det.ceilingHeightM} onChange={(v) => D({ ceilingHeightM: v })} min={2.5} max={12} step={0.5} format={(v) => `${v} m`} /></Q>
            <Q label="Compressed air available at the line?"><YesNo value={det.compressedAir} onChange={(v) => D({ compressedAir: v })} /></Q>
            <Q label="Own maintenance technicians"><Stepper value={det.maintenanceStaff} onChange={(v) => D({ maintenanceStaff: v })} /></Q>
          </div>
          <Q label="Are your machines connected (PLC / network)?">
            <Segmented value={det.plcConnectivity} options={[{ id: 'none', label: 'None' }, { id: 'some', label: 'Some' }, { id: 'most', label: 'Most' }]} onChange={(v) => D({ plcConnectivity: v })} />
          </Q>
          <Q label="Where does production data live today?">
            <Segmented<DataMaturity> value={det.dataMaturity} options={[{ id: 'paper', label: 'Paper' }, { id: 'excel', label: 'Excel' }, { id: 'erp', label: 'ERP' }, { id: 'mes', label: 'MES' }]} onChange={(v) => D({ dataMaturity: v })} />
          </Q>
          <div className="grid gap-4 sm:grid-cols-2">
            <Q label="Which ERP do you use?" help="Leave empty if none."><Input placeholder="e.g. SAP Business One, proALPHA, CSB" value={det.erpSystem} onChange={(e) => D({ erpSystem: e.target.value })} /></Q>
            <Q label="Robots already in the plant"><Stepper value={det.existingRobots} onChange={(v) => D({ existingRobots: v })} /></Q>
          </div>
          <Q label="Previous automation projects went…">
            <Segmented value={det.previousAutomationExperience} options={[{ id: 'none', label: 'None yet' }, { id: 'bad', label: 'Badly' }, { id: 'good', label: 'Well' }]} onChange={(v) => D({ previousAutomationExperience: v })} />
          </Q>
        </div>
      ),
    },
    {
      title: 'Goals & money',
      intro: 'What should automation achieve, and what can you invest? This changes which technology wins.',
      body: (
        <div className="grid gap-4">
          <Q label="What matters most?" help="Pick one or more.">
            <div className="grid gap-2 sm:grid-cols-2">
              {GOALS.map((g) => {
                const on = p.goals.includes(g.id);
                return (
                  <button key={g.id} type="button" onClick={() => P({ goals: toggle(p.goals, g.id) })}
                    className={cx('flex items-start gap-3 rounded-xl border p-3 text-left transition', on ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-ink-200 hover:bg-ink-50')}>
                    <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300')}>{on && <Check size={12} />}</span>
                    <span><span className="block text-sm font-semibold text-ink-900">{g.label}</span><span className="text-xs text-ink-500">{g.hint}</span></span>
                  </button>
                );
              })}
            </div>
          </Q>
          <div className="grid gap-4 sm:grid-cols-2">
            <Q label="Budget you could invest" tip="Not sure? Many Mittelstand plants start with €150–500k."><Slider value={p.budget} onChange={(v) => P({ budget: v })} min={25000} max={1500000} step={25000} format={(v) => eur(v)} /></Q>
            <Q label="How many years should it pay off over?"><Slider value={p.horizonYears} onChange={(v) => P({ horizonYears: v })} min={2} max={10} format={(v) => `${v} yrs`} /></Q>
            <Q label="When do you want to decide?"><Segmented value={det.decisionTimelineMonths} options={[3, 6, 12, 24].map((n) => ({ id: n, label: `${n} mo` }))} onChange={(v) => D({ decisionTimelineMonths: v })} /></Q>
            <Q label="Interested in public funding?" help="e.g. KfW or state digitalisation programmes."><YesNo value={det.fundingInterest} onChange={(v) => D({ fundingInterest: v })} /></Q>
          </div>
          <Q label="What is your single biggest pain on the line?" help="In your own words. It goes straight into the report.">
            <textarea value={det.biggestPain} onChange={(e) => D({ biggestPain: e.target.value })} rows={3} placeholder="e.g. We cannot staff the night shift at the palletizer."
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </Q>
        </div>
      ),
    },
    {
      title: 'Ready when you are',
      intro: 'Here is what we captured. Tap any card to change it, then build your analysis.',
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { s: 0, t: 'Company', v: `${p.name || 'My company'} · ${SUBSECTOR_LABEL[p.subSector]} · ${p.employees} people` },
            { s: 1, t: 'Products & packaging', v: `${det.packFormats.length} pack formats · ${p.skuCount} SKUs · ${p.changeoversPerWeek} changeovers/week · ${p.hygiene}` },
            { s: 2, t: 'Operations', v: `${p.shifts} × ${p.hoursPerShift} h · ${annualHours.toLocaleString('en-US')} h/yr · €${p.labourCostPerHour}/h · ${d.targetRate} ${d.unitName}/min` },
            { s: 3, t: 'Your line', v: `${included.length} stations · ${operators.toLocaleString('en-US', { maximumFractionDigits: 1 })} operators/shift · ${included.filter((x) => x.level === 'manual').length} manual` },
            { s: 4, t: 'People & safety', v: `${det.productionStaff} staff · ${det.openVacancies} vacancies · ${Math.round(det.staffTurnoverPct * 100)}% turnover` },
            { s: 5, t: 'Quality', v: `${det.certifications.join(', ') || 'No certification'} · ${det.manualQualityChecksPerShift} manual checks/shift` },
            { s: 6, t: 'Office & admin', v: `${tickedOffice.length} jobs · ≈ ${Math.round(officeHours)} h of manual work per week` },
            { s: 7, t: 'Site readiness', v: `${det.floorSpaceM2} m² free · ${det.maintenanceStaff} technicians · data in ${det.dataMaturity.toUpperCase()}` },
            { s: 8, t: 'Goals & money', v: `${eur(p.budget)} over ${p.horizonYears} yrs · ${p.goals.length} goals` },
          ].map((c) => (
            <button key={c.t} type="button" onClick={() => setStep(c.s)} className="group rounded-2xl border border-ink-100 bg-white p-4 text-left shadow-sm transition hover:border-brand-300">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-brand-700">{c.t}<span className="text-ink-400 opacity-0 transition group-hover:opacity-100">Edit</span></div>
              <div className="mt-1 text-sm text-ink-700">{c.v}</div>
            </button>
          ))}
          <div className="rounded-2xl bg-brand-700 p-6 text-white sm:col-span-2">
            <div className="font-display text-2xl">Everything is ready.</div>
            <p className="mt-1 text-sm text-brand-100">We'll calculate what to automate, which technology class fits, and whether it pays off. You can still change every value afterwards.</p>
            <button type="button" onClick={finish} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-brand-800 shadow-sm transition hover:bg-brand-50 sm:w-auto">
              <Sparkles size={18} /> Build my analysis
            </button>
          </div>
        </div>
      ),
    },
  ];

  const cur = steps[step];

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-20 border-b border-ink-100 bg-ink-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-display text-xl font-semibold tracking-tight text-ink-900">Auto<span className="text-brand-600">Scope</span></Link>
          <div className="flex items-center gap-3">
            <button type="button" onClick={restart} className="hidden text-xs font-medium text-ink-500 hover:text-ink-800 sm:inline">Start over</button>
            <Link to="/app" className="inline-flex items-center gap-1 text-sm font-medium text-ink-600 hover:text-ink-900"><X size={16} /> Exit</Link>
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-4 pb-3">
          <div className="mb-2 flex items-center justify-between text-xs text-ink-500">
            <span>Step {step + 1} of {STEPS.length} · <b className="text-ink-800">{STEPS[step]}</b></span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-200">
            <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${Math.max(4, progress)}%` }} />
          </div>
          <div className="mt-2 hidden justify-between md:flex">
            {STEPS.map((n, i) => (
              <button key={n} type="button" onClick={() => setStep(i)}
                className={cx('text-[11px] font-medium transition', i === step ? 'text-brand-700' : i < step ? 'text-ink-600 hover:text-ink-900' : 'text-ink-400 hover:text-ink-600')}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-32 pt-8">
        <div key={step} className="animate-fade-up">
          <div className="text-xs font-semibold uppercase tracking-wider text-sand-600">Food & Beverage · {STEPS[step]}</div>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">{cur.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600 md:text-base">{cur.intro}</p>
          {step < last && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs text-ink-500 ring-1 ring-ink-100"><Lightbulb size={12} className="text-sand-600" /> When unsure, keep the default. You can change everything later.</p>}
          <div className="mt-6">{cur.body}</div>
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft size={16} /> Back</Button>
          {step < last ? (
            <Button onClick={() => setStep((s) => Math.min(last, s + 1))}>
              {step === last - 1 ? 'Review' : 'Continue'} <ArrowRight size={16} />
            </Button>
          ) : (
            <Button onClick={finish}><Sparkles size={16} /> Build my analysis</Button>
          )}
        </div>
      </footer>
    </div>
  );
}
