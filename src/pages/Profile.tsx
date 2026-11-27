import { useNavigate } from 'react-router-dom';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useApp } from '../store';
import { Button, Card, Field, Input, NumberInput, PageHeader, Select, Slider } from '../components/ui';
import { eur, pct, SUBSECTOR_LABEL } from '../lib/format';
import type { Goal, Hygiene, SubSector } from '../types';

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

export default function Profile() {
  const p = useApp((s) => s.profile);
  const set = useApp((s) => s.setProfile);
  const applyTemplate = useApp((s) => s.applyTemplate);
  const loadDemo = useApp((s) => s.loadDemo);
  const nav = useNavigate();

  const toggleGoal = (g: Goal) => set({ goals: p.goals.includes(g) ? p.goals.filter((x) => x !== g) : [...p.goals, g] });
  const hours = p.shifts * p.hoursPerShift * p.operatingDaysPerYear;

  return (
    <div>
      <PageHeader
        eyebrow="Step 1 · Capture"
        title="Company profile"
        subtitle="Tell us about your plant. Takes two minutes and never leaves your browser. These inputs drive every calculation."
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
              <Select
                value={p.subSector}
                onChange={(e) => {
                  const v = e.target.value as SubSector;
                  set({ subSector: v });
                }}
              >
                {Object.entries(SUBSECTOR_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
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
                <button
                  key={g.id}
                  onClick={() => toggleGoal(g.id)}
                  className={`rounded-xl border p-3 text-left transition ${on ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-ink-200 hover:bg-ink-50'}`}
                >
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
                <button
                  key={h.id}
                  onClick={() => set({ hygiene: h.id })}
                  className={`rounded-xl border p-3 text-left transition ${p.hygiene === h.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-ink-200 hover:bg-ink-50'}`}
                >
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
              <Slider value={p.budget} onChange={(v) => set({ budget: v })} min={50000} max={1500000} step={10000} format={(v) => eur(v)} />
            </Field>
            <Field label="Evaluation horizon">
              <Slider value={p.horizonYears} onChange={(v) => set({ horizonYears: v })} min={3} max={10} format={(v) => `${v} yrs`} />
            </Field>
            <Field label="Discount rate" hint="Your cost of capital, used for NPV">
              <Slider value={p.discountRate} onChange={(v) => set({ discountRate: v })} min={0.02} max={0.15} step={0.01} format={(v) => pct(v)} />
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}
