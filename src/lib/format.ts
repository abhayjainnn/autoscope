export const eur = (n: number, compact = true) => {
  if (!isFinite(n)) return '—';
  if (compact && Math.abs(n) >= 1000) {
    const v = Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : `${Math.round(n / 1000)}k`;
    return `€${v}`;
  }
  return `€${Math.round(n).toLocaleString('en-US')}`;
};

export const pct = (n: number, digits = 0) => (isFinite(n) ? `${(n * 100).toFixed(digits)}%` : '—');

export const years = (n: number) => (!isFinite(n) || n > 50 ? 'never' : n < 1 ? `${Math.round(n * 12)} mo` : `${n.toFixed(1)} yrs`);

export const num = (n: number, digits = 0) => (isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: digits }) : '—');

export const uid = () => Math.random().toString(36).slice(2, 9);

export const STATION_TYPE_LABEL: Record<string, string> = {
  depalletizing: 'Depalletizing',
  filling: 'Filling',
  capping: 'Capping / sealing',
  labelling: 'Labelling',
  inspection: 'Inspection',
  checkweighing: 'Checkweighing',
  case_erecting: 'Case erecting',
  case_packing: 'Case packing',
  palletizing: 'Palletizing',
  stretch_wrapping: 'Stretch wrapping',
  internal_transport: 'Internal transport',
  quality_documentation: 'Quality documentation',
  order_documentation: 'Order documentation',
  manual_other: 'Other manual task',
};

export const SUBSECTOR_LABEL: Record<string, string> = {
  beverages: 'Beverages',
  dairy: 'Dairy',
  bakery: 'Bakery',
  confectionery: 'Confectionery',
  ready_meals: 'Ready meals',
  meat: 'Meat & sausage',
};

export const CATEGORY_LABEL: Record<string, string> = {
  software: 'Software',
  conveyor: 'Conveyor',
  special_machine: 'Special machine',
  robot: 'Robot',
  agv: 'AGV / AMR',
  inspection: 'Inspection system',
};

export const PHASE_LABEL: Record<string, string> = {
  quick_win: 'Quick win',
  mid_term: 'Mid-term',
  strategic: 'Strategic',
};
