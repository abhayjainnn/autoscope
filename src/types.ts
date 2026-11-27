// ============================================================================
// AutoScope shared contract. Every module imports from here. Change with care.
// ============================================================================

export type SubSector = 'beverages' | 'dairy' | 'bakery' | 'confectionery' | 'ready_meals' | 'meat';
export type Goal = 'cost' | 'labour_shortage' | 'quality' | 'ergonomics' | 'throughput';
export type Hygiene = 'dry' | 'wet' | 'washdown';

export interface CompanyProfile {
  name: string;
  subSector: SubSector;
  employees: number;
  shifts: number;               // shifts per day (1-3)
  hoursPerShift: number;        // e.g. 8
  operatingDaysPerYear: number; // e.g. 250
  labourCostPerHour: number;    // EUR, fully loaded
  budget: number;               // EUR available for automation
  horizonYears: number;         // evaluation horizon, e.g. 5
  discountRate: number;         // 0-1, e.g. 0.08
  goals: Goal[];
  hygiene: Hygiene;
  skuCount: number;             // number of product/pack variants
  changeoversPerWeek: number;
  unitValueEur: number;         // value of one finished unit (for scrap & throughput)
  productDescription: string;
}

export type StationType =
  | 'depalletizing'
  | 'filling'
  | 'capping'
  | 'labelling'
  | 'inspection'
  | 'checkweighing'
  | 'case_erecting'
  | 'case_packing'
  | 'palletizing'
  | 'stretch_wrapping'
  | 'internal_transport'
  | 'quality_documentation'
  | 'order_documentation'
  | 'manual_other';

export type AutomationLevel = 'manual' | 'semi' | 'auto';

export interface Station {
  id: string;
  name: string;
  type: StationType;
  level: AutomationLevel;
  operatorsPerShift: number;  // people working this station per shift
  ratePerMin: number;         // nominal capacity in units/min
  scrapRate: number;          // 0-1
  downtimePct: number;        // 0-1 unplanned downtime
  liftKgPerUnit: number;      // kg lifted manually per unit handled (0 if none)
  changeoverMin: number;      // minutes per changeover
  repetitiveness: number;     // 1 (varied) .. 5 (identical motion all shift)
  variability: number;        // 1 (one format) .. 5 (many formats/irregular products)
  notes?: string;
  issues?: string[];          // free-text issues (often from AI capture)
  position?: { x: number; y: number }; // for the line builder canvas
}

export interface Line {
  name: string;
  unitName: string;           // e.g. "bottles", "cases"
  targetRatePerMin: number;   // demanded output (takt), units/min
  stations: Station[];        // in flow order
}

// Editable global assumptions (transparency panel)
export interface Assumptions {
  injuryCostPerHighRiskOperatorYear: number; // EUR/yr absence+insurance per operator at high ergonomic risk
  recruitingPremiumPct: number;              // extra labour cost factor when labour shortage is a goal (0-1)
  monteCarloRuns: number;
  costUncertaintyPct: number;                // +/- for capex in Monte Carlo (0-1)
  savingsUncertaintyPct: number;             // +/- for savings in Monte Carlo (0-1)
  scoreWeights: Record<ScoreFactorKey, number>; // weights for opportunity score, sum ~1
}

// ---------------------------------------------------------------- analysis
export interface StationAnalysis {
  stationId: string;
  effectiveRatePerMin: number; // ratePerMin * (1 - downtime) * (1 - scrap)
  utilization: number;         // targetRate / effectiveRate (can exceed 1)
  isBottleneck: boolean;
  kgLiftedPerShift: number;
  ergonomicRisk: 'low' | 'medium' | 'high';
  labourCostPerYear: number;
  scrapCostPerYear: number;
  downtimeHoursPerYear: number;
}

export interface LineAnalysis {
  stations: StationAnalysis[];
  bottleneckId: string | null;
  lineRatePerMin: number;      // min effective rate across stations
  taktGapPct: number;          // (target - lineRate)/target, positive = short
  oee: number;                 // 0-1 estimate
  annualOutputUnits: number;
  totalOperatorsPerShift: number;
  totalLabourCostPerYear: number;
  operatingHoursPerYear: number;
}

export type ScoreFactorKey = 'labour' | 'repetitiveness' | 'ergonomics' | 'quality' | 'bottleneck' | 'stability';

export interface ScoreFactor {
  key: ScoreFactorKey;
  label: string;
  value: number;        // 0-100 raw factor score
  weight: number;       // 0-1
  contribution: number; // value * weight
  explanation: string;
}

export interface OpportunityScore {
  stationId: string;
  score: number;        // 0-100
  rank: number;         // 1 = best
  factors: ScoreFactor[];
  reasons: string[];    // human-readable top reasons
  automatable: boolean; // false if already auto or nothing to gain
}

export type TechCategory = 'software' | 'conveyor' | 'special_machine' | 'robot' | 'agv' | 'inspection';

export interface TechClass {
  id: string;
  name: string;
  category: TechCategory;
  description: string;
  capexMin: number;               // EUR
  capexMax: number;               // EUR
  integrationPct: number;         // integration/engineering as share of capex (0-1)
  annualOpexPct: number;          // maintenance/energy/licences per year as share of capex
  labourReductionPct: number;     // share of station labour removed (0-1)
  scrapReductionPct: number;      // share of station scrap removed (0-1)
  downtimeReductionPct: number;   // share of station downtime removed (0-1)
  rateUpliftPct: number;          // capacity increase (0-1)
  suitableStationTypes: StationType[];
  minRatePerMin: number;          // below this it is over-engineered
  maxRatePerMin: number;          // above this it cannot keep up
  maxVariability: number;         // 1-5, handles up to this variability
  hygiene: Hygiene[];             // hygiene levels it can be specified for
  leadTimeWeeks: number;
  ergonomicRelief: boolean;
}

export interface TechRecommendation {
  stationId: string;
  best: { techId: string; fit: number; reasons: string[] } | null;
  alternatives: { techId: string; fit: number; whyNot: string }[];
}

export interface RoiResult {
  stationId: string;
  techId: string;
  capex: number;
  integration: number;
  totalInvestment: number;
  annualOpex: number;
  annualSavings: { labour: number; scrap: number; downtime: number; ergonomics: number; throughput: number };
  grossAnnualSavings: number;
  netAnnualBenefit: number;  // gross savings - opex
  paybackYears: number;      // Infinity if never
  npv: number;               // over profile.horizonYears at profile.discountRate
  irr: number | null;        // 0-1
  riskScore: number;         // 0-100, higher = riskier
  riskFactors: { label: string; level: 'low' | 'medium' | 'high'; note: string }[];
  fteFreed: number;          // full-time equivalents freed
}

export interface MonteCarloResult {
  stationId: string | 'portfolio';
  runs: number;
  paybackP10: number;
  paybackP50: number;
  paybackP90: number;
  npvP10: number;
  npvP50: number;
  npvP90: number;
  probPaybackWithinHorizon: number; // 0-1
  histogram: { bucket: string; count: number }[]; // payback years buckets
}

export interface SensitivityItem {
  label: string;
  npvLow: number;   // NPV when input at low value
  npvHigh: number;  // NPV when input at high value
  base: number;
}

export type Phase = 'quick_win' | 'mid_term' | 'strategic';

export interface RoadmapItem {
  stationId: string;
  techId: string;
  phase: Phase;
  startMonth: number;
  durationMonths: number;
  investment: number;
  cumulativeInvestment: number;
  withinBudget: boolean;
}

export interface Portfolio {
  selected: RoiResult[];         // recommended, in roadmap order, within budget
  totalInvestment: number;
  totalNetAnnualBenefit: number;
  paybackYears: number;
  npv: number;
  fteFreed: number;
  budgetUsedPct: number;
}

export interface AnalysisBundle {
  line: LineAnalysis;
  scores: OpportunityScore[];          // sorted by rank
  recommendations: TechRecommendation[];
  roi: RoiResult[];                    // one per station with a best recommendation
  portfolio: Portfolio;
  roadmap: RoadmapItem[];
  monteCarlo: MonteCarloResult;        // portfolio-level
  sensitivity: SensitivityItem[];      // portfolio-level, sorted by swing desc
  verdicts: StationVerdict[];          // per station: now / quick / fix / no / done
}

export interface StationVerdict {
  stationId: string;
  verdict: Verdict;
  label: string;
  message: string;
}

// ---------------------------------------------------------------- AI capture
export interface ExtractedStation {
  name: string;
  type: StationType;
  level: AutomationLevel;
  operatorsPerShift: number;
  ratePerMin: number | null;
  liftKgPerUnit: number | null;
  repetitiveness: number;
  variability: number;
  issues: string[];
  confidence: number; // 0-1
}

export interface ExtractionResult {
  summary: string;
  stations: ExtractedStation[];
  observations: string[];  // waste, safety, bottleneck hints
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ---------------------------------------------------------------- plant details (questionnaire)
export type PackFormat = 'pet' | 'glass' | 'can' | 'carton' | 'pouch' | 'tray' | 'bag' | 'cup' | 'flow_wrap' | 'bulk';
export type SecondaryPack = 'case' | 'shrink' | 'tray' | 'crate' | 'display' | 'none';
export type TempZone = 'ambient' | 'chilled' | 'frozen' | 'hot_fill';
export type DataMaturity = 'paper' | 'excel' | 'erp' | 'mes';

/** Every detail captured by the guided questionnaire. All fields are optional inputs that
 *  refine the analysis and the report; the engine never requires them. */
export interface PlantDetails {
  // Products & packaging
  packFormats: PackFormat[];
  secondaryPack: SecondaryPack;
  containerSizes: string;          // e.g. "0.33 L, 0.75 L"
  temperatureZone: TempZone;
  shelfLifeDays: number;
  allergenChangeovers: boolean;
  newSkusPerYear: number;
  seasonalPeakPct: number;         // 0-1 extra volume in peak season
  // Volumes & logistics
  unitsPerCase: number;
  caseWeightKg: number;
  casesPerPallet: number;
  palletsPerDay: number;
  mixedPalletsPct: number;         // 0-1 share of mixed/customer-specific pallets
  palletType: 'euro' | 'industrial' | 'half' | 'mixed';
  forkliftTripsPerShift: number;
  warehouseDistanceM: number;
  // People & safety
  productionStaff: number;
  openVacancies: number;
  staffTurnoverPct: number;        // 0-1 per year
  sickLeavePct: number;            // 0-1
  temporaryWorkersPct: number;     // 0-1
  ergonomicComplaintsPerYear: number;
  lostTimeInjuriesPerYear: number;
  // Quality & compliance
  certifications: string[];        // IFS, BRCGS, ISO 22000, FSSC 22000, Organic, Halal...
  customerComplaintsPerMonth: number;
  traceability: 'batch_paper' | 'batch_digital' | 'unit_level';
  manualQualityChecksPerShift: number;
  cleaningMinPerDay: number;
  // Site & technical readiness
  floorSpaceM2: number;            // free space near the line
  ceilingHeightM: number;
  compressedAir: boolean;
  maintenanceStaff: number;
  plcConnectivity: 'none' | 'some' | 'most';
  dataMaturity: DataMaturity;
  erpSystem: string;
  existingRobots: number;
  // Decision frame
  decisionTimelineMonths: number;
  fundingInterest: boolean;        // interested in public funding (e.g. KfW, state programmes)
  biggestPain: string;
  previousAutomationExperience: 'none' | 'bad' | 'good';
}

// ---------------------------------------------------------------- office / admin processes
export type OfficeTask = 'data' | 'docs' | 'report' | 'email' | 'approve' | 'quality_log' | 'planning';
/** Five 1/3/5 ratings: rule-based, structured input, few exceptions, stability, system access. */
export type Ratings = [number, number, number, number, number];

export interface OfficeProcess {
  id: string;
  name: string;
  task: OfficeTask;
  minPerRun: number;
  runsPerWeek: number;
  errPct: number;          // 0-100
  costPerError: number;    // EUR
  ratings: Ratings;
}

/** Verdict a station or process gets: the tool must be able to say "no". */
export type Verdict = 'now' | 'quick' | 'fix' | 'no' | 'done';
