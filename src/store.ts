import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo } from 'react';
import type { Assumptions, ChatMessage, CompanyProfile, ExtractionResult, Line, OfficeProcess, PlantDetails, Station, SubSector, TechClass } from './types';
import { DEMO_DETAILS, DEMO_OFFICE } from './data/demoDetails';
import { DEMO_PROFILE, DEMO_LINE } from './data/demo';
import { LINE_TEMPLATES, DEFAULT_ASSUMPTIONS } from './data/templates';
import { TECH_CATALOG } from './data/catalog';
import { runAnalysis } from './engine';

interface AppState {
  profile: CompanyProfile;
  line: Line;
  assumptions: Assumptions;
  catalog: TechClass[];
  lastExtraction: ExtractionResult | null;
  chat: ChatMessage[];
  details: PlantDetails;
  office: OfficeProcess[];
  setDetails: (d: Partial<PlantDetails>) => void;
  setOffice: (o: OfficeProcess[]) => void;
  updateOffice: (id: string, patch: Partial<OfficeProcess>) => void;
  setProfile: (p: Partial<CompanyProfile>) => void;
  setLine: (l: Partial<Line>) => void;
  setStations: (s: Station[]) => void;
  updateStation: (id: string, patch: Partial<Station>) => void;
  addStation: (s: Station) => void;
  removeStation: (id: string) => void;
  applyTemplate: (sector: SubSector) => void;
  setAssumptions: (a: Partial<Assumptions>) => void;
  updateTech: (id: string, patch: Partial<TechClass>) => void;
  resetCatalog: () => void;
  setExtraction: (e: ExtractionResult | null) => void;
  setChat: (c: ChatMessage[]) => void;
  loadDemo: () => void;
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      profile: clone(DEMO_PROFILE),
      line: clone(DEMO_LINE),
      assumptions: clone(DEFAULT_ASSUMPTIONS),
      catalog: clone(TECH_CATALOG),
      lastExtraction: null,
      chat: [],
      details: clone(DEMO_DETAILS),
      office: clone(DEMO_OFFICE),
      setDetails: (d) => set((s) => ({ details: { ...s.details, ...d } })),
      setOffice: (office) => set({ office }),
      updateOffice: (id, patch) => set((s) => ({ office: s.office.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      setLine: (l) => set((s) => ({ line: { ...s.line, ...l } })),
      setStations: (stations) => set((s) => ({ line: { ...s.line, stations } })),
      updateStation: (id, patch) =>
        set((s) => ({ line: { ...s.line, stations: s.line.stations.map((st) => (st.id === id ? { ...st, ...patch } : st)) } })),
      addStation: (st) => set((s) => ({ line: { ...s.line, stations: [...s.line.stations, st] } })),
      removeStation: (id) => set((s) => ({ line: { ...s.line, stations: s.line.stations.filter((st) => st.id !== id) } })),
      applyTemplate: (sector) => set((s) => ({ line: clone(LINE_TEMPLATES[sector]), profile: { ...s.profile, subSector: sector } })),
      setAssumptions: (a) => set((s) => ({ assumptions: { ...s.assumptions, ...a } })),
      updateTech: (id, patch) => set((s) => ({ catalog: s.catalog.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      resetCatalog: () => set({ catalog: clone(TECH_CATALOG) }),
      setExtraction: (lastExtraction) => set({ lastExtraction }),
      setChat: (chat) => set({ chat }),
      loadDemo: () =>
        set({
          profile: clone(DEMO_PROFILE),
          line: clone(DEMO_LINE),
          assumptions: clone(DEFAULT_ASSUMPTIONS),
          catalog: clone(TECH_CATALOG),
          lastExtraction: null,
          chat: [],
          details: clone(DEMO_DETAILS),
          office: clone(DEMO_OFFICE),
        }),
    }),
    { name: 'autoscope-v2' },
  ),
);

/** Full deterministic analysis of the current state. Recomputed when inputs change. */
export function useAnalysis() {
  const profile = useApp((s) => s.profile);
  const line = useApp((s) => s.line);
  const assumptions = useApp((s) => s.assumptions);
  const catalog = useApp((s) => s.catalog);
  return useMemo(() => runAnalysis(profile, line, assumptions, catalog), [profile, line, assumptions, catalog]);
}

export function useTech(id: string | undefined) {
  const catalog = useApp((s) => s.catalog);
  return catalog.find((t) => t.id === id);
}

export function useStation(id: string | undefined) {
  const stations = useApp((s) => s.line.stations);
  return stations.find((t) => t.id === id);
}
