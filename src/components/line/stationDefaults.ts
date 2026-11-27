import type { AutomationLevel, Station, StationType } from '../../types';
import { STATION_TYPE_LABEL, uid } from '../../lib/format';

type Defaults = Omit<Station, 'id' | 'name' | 'type'>;

const base: Defaults = {
  level: 'manual',
  operatorsPerShift: 1,
  ratePerMin: 30,
  scrapRate: 0.01,
  downtimePct: 0.05,
  liftKgPerUnit: 0,
  changeoverMin: 15,
  repetitiveness: 3,
  variability: 2,
  issues: [],
};

const PER_TYPE: Partial<Record<StationType, Partial<Defaults>>> = {
  depalletizing: { operatorsPerShift: 1, ratePerMin: 40, liftKgPerUnit: 0.8, repetitiveness: 5 },
  filling: { level: 'semi', ratePerMin: 60, scrapRate: 0.015, downtimePct: 0.08, changeoverMin: 45 },
  capping: { level: 'semi', ratePerMin: 60, downtimePct: 0.04, changeoverMin: 20 },
  labelling: { level: 'semi', ratePerMin: 55, scrapRate: 0.02, changeoverMin: 25 },
  inspection: { operatorsPerShift: 1, ratePerMin: 45, scrapRate: 0.005, repetitiveness: 4 },
  checkweighing: { operatorsPerShift: 1, ratePerMin: 35, repetitiveness: 4 },
  case_erecting: { operatorsPerShift: 1, ratePerMin: 8, liftKgPerUnit: 0.3, repetitiveness: 5 },
  case_packing: { operatorsPerShift: 2, ratePerMin: 10, liftKgPerUnit: 6, repetitiveness: 5 },
  palletizing: { operatorsPerShift: 1, ratePerMin: 6, liftKgPerUnit: 11, repetitiveness: 5, variability: 2 },
  stretch_wrapping: { level: 'semi', ratePerMin: 1, operatorsPerShift: 0.5, changeoverMin: 5 },
  internal_transport: { operatorsPerShift: 1, ratePerMin: 2, downtimePct: 0.1, repetitiveness: 3 },
  quality_documentation: { operatorsPerShift: 0.5, ratePerMin: 50, scrapRate: 0, repetitiveness: 4 },
  order_documentation: { operatorsPerShift: 0.5, ratePerMin: 50, scrapRate: 0, repetitiveness: 3 },
  manual_other: {},
};

export function newStation(type: StationType, level?: AutomationLevel): Station {
  return {
    id: uid(),
    name: STATION_TYPE_LABEL[type] ?? 'New station',
    type,
    ...base,
    ...PER_TYPE[type],
    ...(level ? { level } : {}),
    issues: [],
  };
}

export const STATION_TYPES = Object.keys(STATION_TYPE_LABEL) as StationType[];

export const LEVEL_LABEL: Record<AutomationLevel, string> = { manual: 'Manual', semi: 'Semi-auto', auto: 'Automated' };
export const LEVEL_TONE: Record<AutomationLevel, 'warn' | 'brand' | 'good'> = { manual: 'warn', semi: 'brand', auto: 'good' };

export function utilTone(u: number): 'good' | 'warn' | 'bad' {
  return u >= 1 ? 'bad' : u >= 0.85 ? 'warn' : 'good';
}
export const UTIL_COLOR = { good: '#10b981', warn: '#f59e0b', bad: '#f43f5e' } as const;
