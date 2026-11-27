import type { Assumptions, AutomationLevel, Line, Station, StationType, SubSector } from '../types';
import { DEMO_LINE } from './demo';

// Compact station factory: all rates in CASES per minute.
function st(
  id: string,
  name: string,
  type: StationType,
  level: AutomationLevel,
  operatorsPerShift: number,
  ratePerMin: number,
  scrapRate: number,
  downtimePct: number,
  liftKgPerUnit: number,
  changeoverMin: number,
  repetitiveness: number,
  variability: number,
  issues: string[] = [],
): Station {
  return { id, name, type, level, operatorsPerShift, ratePerMin, scrapRate, downtimePct, liftKgPerUnit, changeoverMin, repetitiveness, variability, issues };
}

function line(name: string, targetRatePerMin: number, stations: Station[]): Line {
  return { name, unitName: 'cases', targetRatePerMin, stations: stations.map((s, i) => ({ ...s, position: { x: i * 240, y: 0 } })) };
}

export const LINE_TEMPLATES: Record<SubSector, Line> = {
  beverages: JSON.parse(JSON.stringify(DEMO_LINE)) as Line,

  dairy: line('Yogurt cup line', 20, [
    st('fill', 'Cup filling & sealing (FFS)', 'filling', 'auto', 1, 26, 0.012, 0.06, 0, 40, 2, 3, ['CIP and cup-size changeovers take 40 min']),
    st('code', 'Date coding & labelling', 'labelling', 'auto', 0.5, 28, 0.008, 0.05, 0, 15, 2, 3),
    st('weigh', 'Fill-weight sampling', 'checkweighing', 'manual', 0.5, 24, 0.01, 0.01, 0, 0, 4, 2, ['Hourly manual sampling on a bench scale, no 100% check']),
    st('erect', 'Tray erecting', 'case_erecting', 'manual', 1, 22, 0.01, 0.02, 0.5, 5, 5, 3, ['Trays folded by hand']),
    st('pack', 'Tray packing', 'case_packing', 'manual', 2, 21, 0.01, 0.03, 4, 10, 5, 3, ['4-pack clusters placed into trays by hand']),
    st('pal', 'Palletizing', 'palletizing', 'manual', 1.5, 24, 0.002, 0.02, 7, 10, 5, 3, ['Cold store, 7 kg trays stacked by hand']),
    st('wrap', 'Stretch wrapping', 'stretch_wrapping', 'semi', 0.5, 50, 0.001, 0.02, 0, 5, 4, 1),
    st('qadoc', 'HACCP documentation (paper)', 'quality_documentation', 'manual', 0.5, 0, 0, 0, 0, 0, 4, 1, ['Temperature and CCP checks on paper']),
  ]),

  bakery: line('Packaged bread line', 12, [
    st('slice', 'Slicing & bagging', 'filling', 'auto', 1, 16, 0.02, 0.07, 0, 20, 2, 3, ['Bagger jams with soft rolls']),
    st('close', 'Clip closing & date label', 'labelling', 'semi', 1, 15, 0.01, 0.05, 0, 10, 4, 3),
    st('insp', 'Visual check (foreign bodies, seal)', 'inspection', 'manual', 1, 14, 0.008, 0.01, 0, 0, 5, 3, ['Operator checks bags by eye']),
    st('weigh', 'Weight check', 'checkweighing', 'manual', 0.5, 15, 0.01, 0.01, 0, 0, 4, 2),
    st('pack', 'Crate packing', 'case_packing', 'manual', 2, 11.5, 0.015, 0.03, 3, 10, 5, 4, ['Bags placed into returnable crates by hand', 'Bottleneck during the morning peak']),
    st('pal', 'Crate stacking & dolly loading', 'palletizing', 'manual', 1, 14, 0.003, 0.02, 6, 5, 5, 3),
    st('fork', 'Transport to dispatch', 'internal_transport', 'manual', 1, 20, 0.002, 0.02, 0, 0, 3, 2),
    st('order', 'Delivery notes & route labels', 'order_documentation', 'manual', 0.5, 0, 0, 0, 0, 0, 4, 2, ['Labels typed manually from the order list']),
  ]),

  confectionery: line('Chocolate bar line', 10, [
    st('flow', 'Flow wrapping', 'filling', 'auto', 1, 14, 0.015, 0.06, 0, 30, 2, 3),
    st('weigh', 'Checkweighing', 'checkweighing', 'auto', 0, 15, 0.01, 0.02, 0, 5, 1, 2),
    st('insp', 'Visual wrapper inspection', 'inspection', 'manual', 1, 12, 0.01, 0.01, 0, 0, 5, 3, ['Misprinted wrappers reach the customer']),
    st('erect', 'Display box erecting', 'case_erecting', 'manual', 1, 11, 0.012, 0.02, 0.3, 10, 5, 4),
    st('pack', 'Box & case packing', 'case_packing', 'manual', 3, 9.6, 0.012, 0.03, 2.5, 20, 5, 4, ['Seasonal SKUs change packing patterns weekly', 'Line waits for packers']),
    st('label', 'Case labelling', 'labelling', 'manual', 0.5, 14, 0.005, 0.01, 0, 5, 4, 3),
    st('pal', 'Palletizing', 'palletizing', 'manual', 1, 12, 0.002, 0.02, 5, 10, 5, 3),
    st('qadoc', 'Quality records', 'quality_documentation', 'manual', 0.5, 0, 0, 0, 0, 0, 4, 1),
  ]),

  ready_meals: line('Ready meal tray line', 8, [
    st('dose', 'Tray dosing', 'filling', 'semi', 3, 10, 0.02, 0.05, 0, 30, 4, 4, ['Components dosed partly by hand']),
    st('seal', 'Tray sealing', 'capping', 'auto', 0.5, 11, 0.012, 0.06, 0, 20, 2, 3),
    st('label', 'Labelling', 'labelling', 'auto', 0.5, 12, 0.01, 0.05, 0, 15, 2, 4),
    st('weigh', 'Checkweighing', 'checkweighing', 'manual', 0.5, 10, 0.015, 0.01, 0, 0, 4, 3),
    st('insp', 'Seal & label inspection', 'inspection', 'manual', 1, 9, 0.01, 0.01, 0, 0, 5, 4, ['Leaking seals found at the customer']),
    st('pack', 'Case packing', 'case_packing', 'manual', 2, 7.8, 0.01, 0.03, 4, 15, 5, 4, ['Bottleneck: trays pile up before packing']),
    st('pal', 'Palletizing', 'palletizing', 'manual', 1, 10, 0.002, 0.02, 8, 10, 5, 3),
    st('qadoc', 'HACCP documentation', 'quality_documentation', 'manual', 0.5, 0, 0, 0, 0, 0, 4, 1),
  ]),

  meat: line('Vacuum pack line', 9, [
    st('pack_vac', 'Thermoforming vacuum packer', 'filling', 'auto', 2, 12, 0.02, 0.07, 0, 35, 3, 4, ['Product loaded into pockets by hand']),
    st('label', 'Weigh-price labelling', 'labelling', 'auto', 0.5, 12, 0.01, 0.05, 0, 10, 2, 4),
    st('insp', 'Leak & foreign-body check', 'inspection', 'manual', 1, 10, 0.012, 0.01, 0, 0, 5, 4, ['Leakers detected late, returns from retail']),
    st('erect', 'Crate preparation', 'case_erecting', 'manual', 0.5, 12, 0.005, 0.01, 1, 0, 4, 2),
    st('pack', 'Crate packing', 'case_packing', 'manual', 2, 8.6, 0.01, 0.03, 5, 10, 5, 4, ['Cold, wet environment, high staff turnover']),
    st('pal', 'Palletizing', 'palletizing', 'manual', 1, 11, 0.002, 0.02, 10, 5, 5, 3, ['10 kg crates stacked in the chill room']),
    st('wrap', 'Stretch wrapping', 'stretch_wrapping', 'manual', 0.5, 30, 0.001, 0.02, 0, 0, 4, 1),
    st('qadoc', 'Temperature & HACCP logs', 'quality_documentation', 'manual', 0.5, 0, 0, 0, 0, 0, 4, 1),
  ]),
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  injuryCostPerHighRiskOperatorYear: 6000,
  recruitingPremiumPct: 0.1,
  monteCarloRuns: 1000,
  costUncertaintyPct: 0.25,
  savingsUncertaintyPct: 0.3,
  scoreWeights: {
    labour: 0.3,
    repetitiveness: 0.15,
    ergonomics: 0.2,
    quality: 0.1,
    bottleneck: 0.15,
    stability: 0.1,
  },
};
