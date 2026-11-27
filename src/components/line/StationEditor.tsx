import { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2, X } from 'lucide-react';
import type { AutomationLevel, Station, StationAnalysis, StationType } from '../../types';
import { Button, Field, Input, NumberInput, Select, Slider, Badge } from '../ui';
import { STATION_TYPE_LABEL, eur, num } from '../../lib/format';
import { LEVEL_LABEL, STATION_TYPES } from './stationDefaults';

interface Props {
  station: Station;
  analysis?: StationAnalysis;
  index: number;
  count: number;
  onChange: (patch: Partial<Station>) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onClose: () => void;
}

export function StationEditor({ station, analysis, index, count, onChange, onDelete, onMove, onClose }: Props) {
  const [issue, setIssue] = useState('');
  const issues = station.issues ?? [];
  const addIssue = () => {
    const t = issue.trim();
    if (!t) return;
    onChange({ issues: [...issues, t] });
    setIssue('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-ink-100 pb-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">Station {index + 1} of {count}</div>
          <div className="truncate text-base font-semibold text-ink-900">{station.name || 'Unnamed station'}</div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Close editor">
          <X size={16} />
        </button>
      </div>

      {analysis && (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-ink-50 p-2.5 text-center">
          <div>
            <div className="text-[10px] text-ink-500">Effective</div>
            <div className="text-sm font-bold tabular-nums">{num(analysis.effectiveRatePerMin, 1)}/min</div>
          </div>
          <div>
            <div className="text-[10px] text-ink-500">Utilization</div>
            <div className={`text-sm font-bold tabular-nums ${analysis.utilization >= 1 ? 'text-rose-600' : analysis.utilization >= 0.85 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {Math.round(analysis.utilization * 100)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-ink-500">Labour/yr</div>
            <div className="text-sm font-bold tabular-nums">{eur(analysis.labourCostPerYear)}</div>
          </div>
        </div>
      )}

      <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
        <Field label="Name">
          <Input value={station.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={station.type} onChange={(e) => onChange({ type: e.target.value as StationType })}>
              {STATION_TYPES.map((t) => (
                <option key={t} value={t}>{STATION_TYPE_LABEL[t]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Automation level">
            <Select value={station.level} onChange={(e) => onChange({ level: e.target.value as AutomationLevel })}>
              {(Object.keys(LEVEL_LABEL) as AutomationLevel[]).map((l) => (
                <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Operators / shift">
            <NumberInput value={station.operatorsPerShift} step={0.5} min={0} onChange={(n) => onChange({ operatorsPerShift: Math.max(0, n) })} />
          </Field>
          <Field label="Nominal rate">
            <NumberInput value={station.ratePerMin} step={1} min={0} suffix="/min" onChange={(n) => onChange({ ratePerMin: Math.max(0, n) })} />
          </Field>
          <Field label="Scrap rate">
            <NumberInput value={+(station.scrapRate * 100).toFixed(2)} step={0.5} min={0} max={100} suffix="%" onChange={(n) => onChange({ scrapRate: Math.min(1, Math.max(0, n / 100)) })} />
          </Field>
          <Field label="Unplanned downtime">
            <NumberInput value={+(station.downtimePct * 100).toFixed(2)} step={1} min={0} max={100} suffix="%" onChange={(n) => onChange({ downtimePct: Math.min(1, Math.max(0, n / 100)) })} />
          </Field>
          <Field label="Manual lift per unit">
            <NumberInput value={station.liftKgPerUnit} step={0.5} min={0} suffix="kg" onChange={(n) => onChange({ liftKgPerUnit: Math.max(0, n) })} />
          </Field>
          <Field label="Changeover">
            <NumberInput value={station.changeoverMin} step={5} min={0} suffix="min" onChange={(n) => onChange({ changeoverMin: Math.max(0, n) })} />
          </Field>
        </div>
        <Field label="Repetitiveness" hint="1 = varied work · 5 = identical motion all shift">
          <Slider value={station.repetitiveness} min={1} max={5} onChange={(n) => onChange({ repetitiveness: n })} format={(n) => `${n} / 5`} />
        </Field>
        <Field label="Product / format variability" hint="1 = one format · 5 = many formats, irregular products">
          <Slider value={station.variability} min={1} max={5} onChange={(n) => onChange({ variability: n })} format={(n) => `${n} / 5`} />
        </Field>
        <Field label="Notes">
          <textarea
            value={station.notes ?? ''}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </Field>
        <div>
          <div className="text-xs font-medium text-ink-600">Issues observed</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {issues.length === 0 && <span className="text-xs text-ink-400">None recorded</span>}
            {issues.map((it, i) => (
              <Badge key={i} tone="warn">
                <span className="max-w-[220px] truncate" title={it}>{it}</span>
                <button onClick={() => onChange({ issues: issues.filter((_, j) => j !== i) })} className="hover:text-amber-900" aria-label="Remove issue">
                  <X size={11} />
                </button>
              </Badge>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input value={issue} placeholder="e.g. jams at format change" onChange={(e) => setIssue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addIssue()} />
            <Button variant="secondary" className="px-3" onClick={addIssue} aria-label="Add issue">
              <Plus size={14} />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-ink-100 pt-3">
        <Button variant="secondary" className="px-3" disabled={index === 0} onClick={() => onMove(-1)} title="Move upstream">
          <ArrowLeft size={14} />
        </Button>
        <Button variant="secondary" className="px-3" disabled={index === count - 1} onClick={() => onMove(1)} title="Move downstream">
          <ArrowRight size={14} />
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={onDelete}>
          <Trash2 size={14} /> Delete
        </Button>
      </div>
    </div>
  );
}
