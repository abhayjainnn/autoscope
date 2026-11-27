import type { AnalysisBundle, ChatMessage, CompanyProfile, ExtractionResult, Line, TechClass } from '../types';
import { STATION_TYPE_LABEL } from './format';
import { useApp } from '../store';
import { evaluateOffice } from '../engine/office';
import { OFFICE_TECH, DEFAULT_OFFICE_GLOBALS } from '../data/officeCatalog';

export interface ExtractInput {
  text?: string;
  images?: { mediaType: string; data: string }[];
  sector?: string;
}

export type WithMock<T> = T & { mock: boolean };

async function post<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export async function extractProcess(input: ExtractInput): Promise<WithMock<ExtractionResult>> {
  const r = await post<ExtractionResult & { mock?: boolean }>('extract', input);
  return {
    summary: r.summary ?? '',
    stations: Array.isArray(r.stations) ? r.stations : [],
    observations: Array.isArray(r.observations) ? r.observations : [],
    mock: Boolean(r.mock),
  };
}

export async function explain(prompt: string, context: unknown): Promise<{ text: string; mock: boolean }> {
  const r = await post<{ text: string; mock?: boolean }>('explain', { prompt, context });
  return { text: r.text ?? '', mock: Boolean(r.mock) };
}

export async function chat(messages: ChatMessage[], context: unknown): Promise<{ text: string; mock: boolean }> {
  const r = await post<{ text: string; mock?: boolean }>('chat', { messages, context });
  return { text: r.text ?? '', mock: Boolean(r.mock) };
}

export async function aiHealth(): Promise<{ ok: boolean; ai: boolean }> {
  try {
    const r = await fetch('/api/health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json();
    return { ok: Boolean(d?.ok), ai: Boolean(d?.ai) };
  } catch {
    return { ok: false, ai: false };
  }
}

// ---------------------------------------------------------------- context builder
const r0 = (n: number) => (Number.isFinite(n) ? Math.round(n) : null);
const r1 = (n: number) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
const r2 = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

/** Compact, human-readable JSON summary of the analysis for the AI (names instead of ids, rounded, capped). */
export function buildAiContext(bundle: AnalysisBundle | null | undefined, profile: CompanyProfile, line: Line, catalog: TechClass[]) {
  const stName = (id: string | null | undefined) => line.stations.find((s) => s.id === id)?.name ?? id ?? null;
  const techName = (id: string | null | undefined) => catalog.find((t) => t.id === id)?.name ?? id ?? null;
  const ctx: Record<string, unknown> = {
    note: 'All numbers below are computed by the deterministic AutoScope engine. Currency EUR. Paybacks in years.',
    profile: {
      name: profile.name,
      subSector: profile.subSector,
      employees: profile.employees,
      shifts: profile.shifts,
      hoursPerShift: profile.hoursPerShift,
      operatingDaysPerYear: profile.operatingDaysPerYear,
      labourCostPerHour: profile.labourCostPerHour,
      budget: profile.budget,
      horizonYears: profile.horizonYears,
      discountRatePct: r1(profile.discountRate * 100),
      goals: profile.goals,
      hygiene: profile.hygiene,
      skuCount: profile.skuCount,
      changeoversPerWeek: profile.changeoversPerWeek,
      product: profile.productDescription?.slice(0, 200),
    },
    line: {
      name: line.name,
      unit: line.unitName,
      targetRatePerMin: line.targetRatePerMin,
      stations: line.stations.slice(0, 20).map((s) => ({
        name: s.name,
        type: STATION_TYPE_LABEL[s.type] ?? s.type,
        level: s.level,
        operatorsPerShift: s.operatorsPerShift,
        ratePerMin: r1(s.ratePerMin),
        scrapPct: r1(s.scrapRate * 100),
        downtimePct: r1(s.downtimePct * 100),
        liftKgPerUnit: r1(s.liftKgPerUnit),
      })),
    },
  };
  if (!bundle) return ctx;
  try {
    const la = bundle.line;
    ctx.lineAnalysis = {
      bottleneck: stName(la.bottleneckId),
      lineRatePerMin: r1(la.lineRatePerMin),
      taktGapPct: r1(la.taktGapPct * 100),
      oeePct: r1(la.oee * 100),
      annualOutputUnits: r0(la.annualOutputUnits),
      totalOperatorsPerShift: r1(la.totalOperatorsPerShift),
      totalLabourCostPerYear: r0(la.totalLabourCostPerYear),
      highErgonomicRiskStations: la.stations.filter((s) => s.ergonomicRisk === 'high').map((s) => stName(s.stationId)),
    };
    ctx.opportunityScores = bundle.scores.slice(0, 10).map((s) => ({
      rank: s.rank,
      station: stName(s.stationId),
      score: r0(s.score),
      automatable: s.automatable,
      reasons: s.reasons.slice(0, 3),
    }));
    ctx.recommendations = bundle.recommendations.slice(0, 10).map((r) => ({
      station: stName(r.stationId),
      best: r.best ? { tech: techName(r.best.techId), fit: r0(r.best.fit), reasons: r.best.reasons.slice(0, 3) } : null,
      alternatives: r.alternatives.slice(0, 2).map((a) => ({ tech: techName(a.techId), fit: r0(a.fit), whyNot: a.whyNot })),
    }));
    ctx.roi = bundle.roi.slice(0, 10).map((r) => ({
      station: stName(r.stationId),
      tech: techName(r.techId),
      totalInvestment: r0(r.totalInvestment),
      annualOpex: r0(r.annualOpex),
      savings: Object.fromEntries(Object.entries(r.annualSavings).map(([k, v]) => [k, r0(v)])),
      netAnnualBenefit: r0(r.netAnnualBenefit),
      paybackYears: Number.isFinite(r.paybackYears) ? r1(r.paybackYears) : 'never',
      npv: r0(r.npv),
      irrPct: r.irr == null ? null : r1(r.irr * 100),
      riskScore: r0(r.riskScore),
      fteFreed: r1(r.fteFreed),
    }));
    const p = bundle.portfolio;
    ctx.portfolio = {
      selected: p.selected.map((r) => `${techName(r.techId)} @ ${stName(r.stationId)}`),
      totalInvestment: r0(p.totalInvestment),
      totalNetAnnualBenefit: r0(p.totalNetAnnualBenefit),
      paybackYears: Number.isFinite(p.paybackYears) ? r1(p.paybackYears) : 'never',
      npv: r0(p.npv),
      fteFreed: r1(p.fteFreed),
      budgetUsedPct: r0(p.budgetUsedPct * (p.budgetUsedPct <= 1.5 ? 100 : 1)),
    };
    ctx.roadmap = bundle.roadmap.slice(0, 10).map((r) => ({
      station: stName(r.stationId),
      tech: techName(r.techId),
      phase: r.phase,
      startMonth: r.startMonth,
      durationMonths: r.durationMonths,
      investment: r0(r.investment),
      withinBudget: r.withinBudget,
    }));
    const mc = bundle.monteCarlo;
    ctx.monteCarlo = {
      runs: mc.runs,
      paybackP10: r1(mc.paybackP10),
      paybackP50: r1(mc.paybackP50),
      paybackP90: r1(mc.paybackP90),
      npvP10: r0(mc.npvP10),
      npvP50: r0(mc.npvP50),
      npvP90: r0(mc.npvP90),
      probPaybackWithinHorizonPct: r0(mc.probPaybackWithinHorizon * 100),
    };
    ctx.sensitivity = bundle.sensitivity.slice(0, 6).map((s) => ({ input: s.label, npvLow: r0(s.npvLow), npvHigh: r0(s.npvHigh), base: r0(s.base) }));
    ctx.stationVerdicts = (bundle.verdicts ?? []).map((v) => ({ station: stName(v.stationId), verdict: v.verdict, label: v.label, why: v.message }));
    try {
      const st = useApp.getState();
      const off = evaluateOffice(st.office ?? [], { ...OFFICE_TECH, ...(st.officeTech ?? {}) }, { ...DEFAULT_OFFICE_GLOBALS, ...(st.officeGlobals ?? {}) }, profile.labourCostPerHour);
      ctx.officeProcesses = {
        note: 'Office/admin processes scored with suitability S (0-100) and impact I. Paybacks in MONTHS.',
        rows: off.rows.slice(0, 10).map((r) => ({ name: r.p.name, S: r1(r.S), I: r0(r.I), verdict: r.verdict, wave: r.wave, tech: r.t?.name ?? null, investment: r.base ? r0(r.base.K) : null, netPerYear: r.base ? r0(r.base.N) : null, paybackMonths: r.base && Number.isFinite(r.base.pay) ? r1(r.base.pay) : null, hoursFreed: r.base ? r0(r.base.freed) : null })),
        portfolioWaves12: { investment: r0(off.portfolio.K), netPerYear: r0(off.portfolio.N), paybackMonths: Number.isFinite(off.portfolio.pay) ? r1(off.portfolio.pay) : null, hoursFreed: r0(off.portfolio.freed) },
      };
    } catch { /* office context is optional */ }
  } catch {
    /* partial context is fine */
  }
  // cap size
  let json = JSON.stringify(ctx);
  if (json.length > 14000) {
    delete ctx.sensitivity;
    delete ctx.roadmap;
    json = JSON.stringify(ctx);
    if (json.length > 14000) {
      (ctx.recommendations as unknown[] | undefined)?.splice(5);
      (ctx.roi as unknown[] | undefined)?.splice(6);
    }
  }
  void r2;
  return ctx;
}
