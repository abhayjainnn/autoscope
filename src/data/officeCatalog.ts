import type { OfficeTask } from '../types';

export type OfficeTechKey = 'api' | 'rpa' | 'docai' | 'bi' | 'llm' | 'flow' | 'dqa' | 'aps';

export interface OfficeTech {
  key: OfficeTechKey;
  name: string;
  capex: number; // EUR one-off
  opex: number; // EUR per year running cost
  st: number; // share of time saved (0-1)
  se: number; // share of errors removed (0-1)
  weeks: number; // introduction time
}

/** Planning assumptions, not quotes. Replace with real offers in a pilot. */
export const OFFICE_TECH: Record<OfficeTechKey, OfficeTech> = {
  api: { key: 'api', name: 'API integration', capex: 10000, opex: 1500, st: 0.9, se: 0.7, weeks: 4 },
  rpa: { key: 'rpa', name: 'RPA bot', capex: 12000, opex: 4000, st: 0.8, se: 0.7, weeks: 6 },
  docai: { key: 'docai', name: 'Document AI + review', capex: 15000, opex: 6000, st: 0.65, se: 0.6, weeks: 8 },
  bi: { key: 'bi', name: 'BI dashboard / auto report', capex: 5000, opex: 1200, st: 0.85, se: 0.5, weeks: 3 },
  llm: { key: 'llm', name: 'AI assistant + human check', capex: 8000, opex: 3000, st: 0.5, se: 0.3, weeks: 4 },
  flow: { key: 'flow', name: 'Low-code workflow', capex: 6000, opex: 1800, st: 0.7, se: 0.5, weeks: 4 },
  dqa: { key: 'dqa', name: 'Digital checklists & tablets (HACCP)', capex: 7000, opex: 2000, st: 0.6, se: 0.7, weeks: 4 },
  aps: { key: 'aps', name: 'Planning software (APS)', capex: 15000, opex: 4000, st: 0.4, se: 0.4, weeks: 8 },
};

export const OFFICE_TASK_LABEL: Record<OfficeTask, string> = {
  data: 'Data between systems',
  docs: 'Invoices and orders',
  report: 'Reports and KPIs',
  email: 'Email and requests',
  approve: 'Approvals',
  quality_log: 'Quality & HACCP logs',
  planning: 'Production planning',
};

export const OFFICE_TECH_WHY: Record<OfficeTechKey, string> = {
  api: 'System access rated 5, so a direct API link beats a screen robot.',
  rpa: 'No API available, so a software robot works on the screen.',
  docai: 'Documents are semi-structured, so document AI reads them and a person checks the exceptions.',
  bi: 'The numbers already exist in systems, so an automatic dashboard removes the manual compiling.',
  llm: 'Free-text requests need language understanding, with a human approving the result.',
  flow: 'Routing and sign-off is a workflow problem, solvable without code.',
  dqa: 'HACCP and fill-level checks follow a fixed checklist, so tablets with guided forms (and sensor readings where possible) replace paper, stop missing entries and make audits a click.',
  aps: 'Line and shift plans juggle changeovers, allergen sequences and staff, so planning software proposes a schedule from orders and the planner only adjusts it.',
};

export interface OfficeGlobals {
  weeks: number; // working weeks per year
  hint: number; // internal effort hours per project
  real: number; // realisation factor (feasibility is not adoption)
}

export const DEFAULT_OFFICE_GLOBALS: OfficeGlobals = { weeks: 48, hint: 40, real: 0.8 };

/** Five suitability criteria with weights and plain-language rating labels (1 / 3 / 5). */
export const OFFICE_CRITERIA_INFO = [
  { k: 'Rule-based', w: 0.3, labels: { 1: 'Needs judgement', 3: 'Mixed', 5: 'Fully rule-based' }, q: 'Could I write the steps on a card so a stranger can follow them without thinking?' },
  { k: 'Structured input', w: 0.2, labels: { 1: 'Handwritten or free text', 3: 'PDF, email, varied parts', 5: 'Digital and standard' }, q: 'What does the job start from?' },
  { k: 'Few exceptions', w: 0.2, labels: { 1: 'Many exceptions', 3: 'Some exceptions', 5: 'Rare exceptions' }, q: 'How often does something odd happen?' },
  { k: 'Stability', w: 0.15, labels: { 1: 'Changes often', 3: 'Changes yearly', 5: 'Stable 2+ years' }, q: 'Will the job look the same in two years?' },
  { k: 'System or IO access', w: 0.15, labels: { 1: 'No access', 3: 'Screen or basic IO', 5: 'API or machine IO' }, q: 'Can a computer program reach the place where the data must go?' },
] as const;
