import { useState } from 'react';
import { Plus, Trash2, RotateCcw, Sparkles, Info } from 'lucide-react';
import { useApp, useOffice } from '../store';
import { PageHeader, Card, Stat, Button, Field, Input, NumberInput, Select, ScoreBar, Empty, cx } from '../components/ui';
import { eur, num, uid } from '../lib/format';
import { DEMO_OFFICE } from '../data/demoDetails';
import { OFFICE_CRITERIA_INFO, OFFICE_TASK_LABEL, OFFICE_TECH_WHY, type OfficeTechKey } from '../data/officeCatalog';
import { OFFICE_VERDICT_LABEL, OFFICE_WAVE_LABEL, fmtMonths, type OfficeRow, type OfficeVerdict } from '../engine/office';
import type { OfficeProcess, OfficeTask, Ratings } from '../types';

const VERDICT_CHIP: Record<OfficeVerdict, { cls: string; short: string }> = {
  now: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', short: 'Automate now' },
  quick: { cls: 'bg-brand-50 text-brand-700 ring-brand-200', short: 'Quick win if cheap' },
  fix: { cls: 'bg-amber-50 text-amber-800 ring-amber-200', short: 'Fix process first' },
  no: { cls: 'bg-rose-50 text-rose-700 ring-rose-200', short: 'Do not automate' },
};

export function OfficeVerdictChip({ v }: { v: OfficeVerdict }) {
  const c = VERDICT_CHIP[v];
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', c.cls)}>{c.short}</span>;
}

const waveText = (r: OfficeRow) => OFFICE_WAVE_LABEL[String(r.wave)];

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3 py-1 text-sm', strong && 'font-semibold text-ink-900')}>
      <span className="text-ink-500">{label}</span>
      <span className="tabular-nums text-ink-800">{value}</span>
    </div>
  );
}

function Detail({ r }: { r: OfficeRow }) {
  const t = r.t;
  const b = r.base;
  return (
    <Card
      title={r.p.name}
      subtitle={<span><OfficeVerdictChip v={r.verdict} /> <span className="ml-1">{OFFICE_VERDICT_LABEL[r.verdict]} · {waveText(r)}</span></span>}
    >
      {r.stop && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Stop check: {r.p.ratings[0] === 1 ? 'the job needs human judgement' : `suitability is only ${r.S.toFixed(1)} (< 40)`}. No technology is recommended until the process is tidied up.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Why this score</h4>
          <div className="space-y-2.5">
            {OFFICE_CRITERIA_INFO.map((c, i) => {
              const v = r.p.ratings[i];
              const pts = 100 * c.w * (v - 1) / 4;
              return (
                <div key={c.k}>
                  <div className="flex justify-between text-xs"><span className="text-ink-700">{c.k} <span className="text-ink-400">· w {c.w}</span></span><span className="tabular-nums text-ink-600">{v} → {pts.toFixed(1)} pts</span></div>
                  <ScoreBar value={v} max={5} tone={v >= 5 ? 'good' : v >= 3 ? 'brand' : 'bad'} />
                </div>
              );
            })}
            <Row label="Suitability S" value={r.S.toFixed(1)} strong />
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Cost today</h4>
          <Row label="Hours per year" value={num(r.hrs)} />
          <Row label="Labour cost" value={eur(r.lab, false)} />
          <Row label="Error cost" value={eur(r.err, false)} />
          <Row label="Total cost C" value={eur(r.C, false)} strong />
          <Row label="Impact I (vs largest)" value={r.I.toFixed(0)} />
          <Row label="Priority P = S·I/100" value={r.P.toFixed(1)} />
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Technology & pay-off</h4>
          {t && b ? (
            <>
              <div className="font-semibold text-ink-900">{t.name}</div>
              <p className="mb-2 text-xs text-ink-500">{OFFICE_TECH_WHY[r.tk]}</p>
              <Row label="Yearly benefit" value={eur(b.B, false)} />
              <Row label="Running cost" value={eur(b.O, false)} />
              <Row label="Net per year" value={eur(b.N, false)} strong />
              <Row label="Investment (incl. internal)" value={eur(b.K, false)} />
              <Row label="Payback" value={<span>{fmtMonths(b.pay)} <span className="text-xs text-ink-400">({fmtMonths(r.best!.pay)}–{fmtMonths(r.worst!.pay)})</span></span>} />
              <Row label="3-year net" value={eur(b.net3, false)} />
              <Row label="Hours freed / yr" value={num(b.freed)} />
              <Row label="Introduction" value={`${t.weeks} weeks`} />
            </>
          ) : (
            <p className="text-sm text-ink-500">No technology recommended. {r.verdict === 'fix' ? 'Standardise the process (Lean), then re-score.' : 'Too little to gain or needs human judgement.'}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function RatingSelect({ i, value, onChange }: { i: number; value: number; onChange: (v: number) => void }) {
  const c = OFFICE_CRITERIA_INFO[i];
  return (
    <label className="block" title={c.q}>
      <span className="text-[11px] font-medium text-ink-500">{c.k}</span>
      <Select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {([5, 3, 1] as const).map((v) => <option key={v} value={v}>{v} · {c.labels[v]}</option>)}
      </Select>
    </label>
  );
}

function ProcessEditor({ p, update, remove }: { p: OfficeProcess; update: (patch: Partial<OfficeProcess>) => void; remove: () => void }) {
  const setR = (i: number, v: number) => { const r = [...p.ratings] as Ratings; r[i] = v; update({ ratings: r }); };
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Input value={p.name} onChange={(e) => update({ name: e.target.value })} />
        <button onClick={remove} className="rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove process"><Trash2 size={16} /></button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Task type">
            <Select value={p.task} onChange={(e) => update({ task: e.target.value as OfficeTask })}>
              {(Object.keys(OFFICE_TASK_LABEL) as OfficeTask[]).map((k) => <option key={k} value={k}>{OFFICE_TASK_LABEL[k]}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Minutes per run"><NumberInput value={p.minPerRun} min={0} onChange={(v) => update({ minPerRun: v })} /></Field>
        <Field label="Runs per week"><NumberInput value={p.runsPerWeek} min={0} onChange={(v) => update({ runsPerWeek: v })} /></Field>
        <Field label="Error rate"><NumberInput value={p.errPct} min={0} max={100} step={0.5} suffix="%" onChange={(v) => update({ errPct: v })} /></Field>
        <Field label="Cost per error"><NumberInput value={p.costPerError} min={0} suffix="€" onChange={(v) => update({ costPerError: v })} /></Field>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {p.ratings.map((v, i) => <RatingSelect key={i} i={i} value={v} onChange={(x) => setR(i, x)} />)}
      </div>
    </div>
  );
}

function AssumptionsPanel() {
  const g = useApp((s) => s.officeGlobals);
  const tech = useApp((s) => s.officeTech);
  const setG = useApp((s) => s.setOfficeGlobals);
  const upd = useApp((s) => s.updateOfficeTech);
  const reset = useApp((s) => s.resetOfficeAssumptions);
  const rate = useApp((s) => s.profile.labourCostPerHour);
  return (
    <Card
      title="Office assumptions"
      subtitle="Planning assumptions, not quotes. Replace them with real offers in a pilot. Everything updates live."
      actions={<Button variant="secondary" onClick={reset}><RotateCcw size={14} /> Reset</Button>}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Labour rate" hint="from company profile"><div className="py-2 text-sm font-semibold tabular-nums">{eur(rate, false)}/h</div></Field>
        <Field label="Working weeks / yr"><NumberInput value={g.weeks} min={1} max={52} onChange={(v) => setG({ weeks: v })} /></Field>
        <Field label="Internal effort / project" hint="hours"><NumberInput value={g.hint} min={0} onChange={(v) => setG({ hint: v })} suffix="h" /></Field>
        <Field label="Realisation factor" hint="feasibility ≠ adoption"><NumberInput value={g.real} min={0} max={1} step={0.05} onChange={(v) => setG({ real: v })} /></Field>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500">
            <tr><th className="py-2 pr-2">Technology</th><th className="px-2">Capex €</th><th className="px-2">Running €/yr</th><th className="px-2">Time saved %</th><th className="px-2">Errors removed %</th><th className="px-2">Weeks</th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {(Object.keys(tech) as OfficeTechKey[]).map((k) => {
              const t = tech[k];
              return (
                <tr key={k}>
                  <td className="py-1.5 pr-2 font-medium text-ink-800">{t.name}</td>
                  <td className="px-2 py-1.5"><NumberInput value={t.capex} min={0} step={500} onChange={(v) => upd(k, { capex: v })} /></td>
                  <td className="px-2 py-1.5"><NumberInput value={t.opex} min={0} step={100} onChange={(v) => upd(k, { opex: v })} /></td>
                  <td className="px-2 py-1.5"><NumberInput value={Math.round(t.st * 100)} min={0} max={100} onChange={(v) => upd(k, { st: v / 100 })} /></td>
                  <td className="px-2 py-1.5"><NumberInput value={Math.round(t.se * 100)} min={0} max={100} onChange={(v) => upd(k, { se: v / 100 })} /></td>
                  <td className="px-2 py-1.5"><NumberInput value={t.weeks} min={0} onChange={(v) => upd(k, { weeks: v })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function Office() {
  const office = useApp((s) => s.office);
  const setOffice = useApp((s) => s.setOffice);
  const updateOffice = useApp((s) => s.updateOffice);
  const { rows, portfolio: pf } = useOffice();
  const [sel, setSel] = useState<string | null>(null);
  const selected = rows.find((r) => r.p.id === sel) ?? rows[0];

  const add = () => {
    const id = uid();
    setOffice([...(office ?? []), { id, name: 'New process', task: 'data', minPerRun: 5, runsPerWeek: 50, errPct: 2, costPerError: 20, ratings: [3, 3, 3, 3, 3] }]);
    setSel(id);
  };
  const loadExamples = () => { setOffice(JSON.parse(JSON.stringify(DEMO_OFFICE))); setSel(null); };

  return (
    <>
      <PageHeader
        eyebrow="2 · What — beyond the line"
        title="Office & admin processes"
        subtitle="Order entry, delivery notes, HACCP logs, reports and planning cost real hours around the line. Rate each process with five plain questions; software is often the cheapest automation you can buy."
        actions={
          <>
            <Button variant="secondary" onClick={loadExamples}><Sparkles size={14} /> Load F&B examples</Button>
            <Button onClick={add}><Plus size={14} /> Add process</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Processes analysed" value={pf.count} />
        <Stat label="In waves 1 + 2" value={pf.inWaves} tone="brand" />
        <Stat label="Investment" value={eur(pf.K)} hint="waves 1 + 2, incl. internal effort" />
        <Stat label="Net per year" value={eur(pf.N)} tone="good" />
        <Stat label="Portfolio payback" value={fmtMonths(pf.pay)} hint={`range ${fmtMonths(pf.payBest)} – ${fmtMonths(pf.payWorst)}`} />
        <Stat label="Hours freed / yr" value={num(pf.freed)} hint="not cash until redeployed" />
      </div>
      <p className="-mt-3 mb-6 flex items-start gap-1.5 text-xs text-ink-500">
        <Info size={12} className="mt-0.5 shrink-0" /> Hours freed are not cash until the company redeploys them, so we show hours next to euros. Benefits are multiplied by a realisation factor because technical feasibility is not the same as adoption.
      </p>

      {rows.length === 0 ? (
        <Empty title="No office processes yet">Add a process or load the F&B examples to see the ranking.</Empty>
      ) : (
        <>
          <Card title="Ranked by priority" subtitle="Priority P = suitability S × impact I / 100. Click a row for the full arithmetic." className="mb-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <tr><th className="py-2 pr-2">#</th><th className="px-2">Process</th><th className="px-2">Verdict</th><th className="px-2">Score</th><th className="px-2 text-right">Payback</th><th className="px-2 text-right">3-yr net</th></tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((r, i) => (
                    <tr key={r.p.id} onClick={() => setSel(r.p.id)} className={cx('cursor-pointer transition hover:bg-ink-50', selected?.p.id === r.p.id && 'bg-brand-50/60')}>
                      <td className="py-2.5 pr-2 font-semibold text-ink-500">{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <div className="font-medium text-ink-900">{r.p.name}</div>
                        <div className="text-xs text-ink-500">{r.t ? r.t.name : 'No technology'} · {waveText(r)}</div>
                      </td>
                      <td className="px-2 py-2.5"><OfficeVerdictChip v={r.verdict} /></td>
                      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-ink-700">S {Math.round(r.S)} · I {Math.round(r.I)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        {r.base ? <><div className="font-semibold text-ink-900">{fmtMonths(r.base.pay)}</div><div className="text-[11px] text-ink-400">{fmtMonths(r.best!.pay)}–{fmtMonths(r.worst!.pay)}</div></> : <span className="text-ink-400">—</span>}
                      </td>
                      <td className={cx('px-2 py-2.5 text-right font-semibold tabular-nums', r.base && r.base.net3 < 0 ? 'text-rose-600' : 'text-ink-900')}>{r.base ? eur(r.base.net3) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {selected && <div className="mb-6"><Detail r={selected} /></div>}
        </>
      )}

      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Process editor</h2>
          <p className="text-xs text-ink-500">Rate each criterion 5 / 3 / 1. When unsure, pick 3. Hover a rating for the plain-language question.</p>
        </div>
        <Button variant="secondary" onClick={add}><Plus size={14} /> Add</Button>
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(office ?? []).map((p) => (
          <ProcessEditor key={p.id} p={p} update={(patch) => updateOffice(p.id, patch)} remove={() => setOffice(office.filter((x) => x.id !== p.id))} />
        ))}
      </div>

      <AssumptionsPanel />
    </>
  );
}
