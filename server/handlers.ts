// AutoScope API handlers. Shared by the Vite dev middleware and the Vercel function (api/[name].ts).
// AI only captures processes and explains; every number shown in the app comes from the deterministic engine.
import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, ExtractedStation, ExtractionResult, StationType, AutomationLevel } from '../src/types';

type Result = { status: number; body: any };

const MODEL = 'claude-opus-5-5';

const STATION_TYPES: StationType[] = [
  'depalletizing', 'filling', 'capping', 'labelling', 'inspection', 'checkweighing', 'case_erecting',
  'case_packing', 'palletizing', 'stretch_wrapping', 'internal_transport', 'quality_documentation',
  'order_documentation', 'manual_other',
];
const LEVELS: AutomationLevel[] = ['manual', 'semi', 'auto'];

function getClient(timeoutMs: number): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key, timeout: timeoutMs, maxRetries: 1 });
}

function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'invalid API key';
  if (e instanceof Anthropic.RateLimitError) return 'rate limited';
  if (e instanceof Anthropic.BadRequestError) return `bad request: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionTimeoutError) return 'timeout';
  if (e instanceof Anthropic.APIConnectionError) return 'connection error';
  if (e instanceof Anthropic.APIError) return `API error ${e.status}`;
  return e instanceof Error ? e.message : String(e);
}

function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

// ============================================================================ dispatch
export async function dispatch(name: string, body: any): Promise<Result> {
  body = body ?? {};
  try {
    switch (name) {
      case 'health':
        return { status: 200, body: { ok: true, ai: Boolean(process.env.ANTHROPIC_API_KEY) } };
      case 'extract':
        return { status: 200, body: await extract(body) };
      case 'explain':
        return { status: 200, body: await explainH(body) };
      case 'chat':
        return { status: 200, body: await chatH(body) };
      default:
        return { status: 404, body: { error: `Unknown endpoint: ${name}` } };
    }
  } catch (e) {
    // Last-resort safety net: never break the demo.
    console.error('[autoscope api]', name, e);
    if (name === 'extract') return { status: 200, body: { ...MOCK_EXTRACTION, mock: true, reason: describeError(e) } };
    if (name === 'explain') return { status: 200, body: { text: mockExplain(body?.prompt, body?.context), mock: true } };
    if (name === 'chat') return { status: 200, body: { text: mockChat(body?.messages, body?.context), mock: true } };
    return { status: 500, body: { error: describeError(e) } };
  }
}

// ============================================================================ extract
const EXTRACT_SYSTEM = `You are a neutral, vendor-independent process analyst for food & beverage PACKAGING lines at small and medium-sized enterprises (SMEs).
You receive a plain-language description and/or photos of a packaging line. If several images are given they are frames of ONE video in time order (first to last), so do not count the same station twice across frames.

Your job: map what you see or read to a list of stations in flow order, using ONLY these station types:
- depalletizing: unloading empty containers/bottles/crates from pallets
- filling: filling product into bottles/cans/cups/trays
- capping: capping, closing, sealing, lidding
- labelling: applying labels, sleeves, date/batch coding
- inspection: visual / fill-level / foreign-body / label inspection (manual or camera)
- checkweighing: weight control
- case_erecting: folding/erecting cartons, trays, crates preparation
- case_packing: putting units into cases, crates, trays, shrink packs
- palletizing: stacking cases onto pallets
- stretch_wrapping: wrapping/securing pallets
- internal_transport: moving goods by hand, pallet jack, forklift between areas
- quality_documentation: paper/Excel QA records, HACCP checklists, batch records
- order_documentation: delivery notes, order picking lists, shipping paperwork
- manual_other: anything else

For each station estimate:
- level: manual (people do the work), semi (machine assisted, people feed/unload), auto (runs on its own, people only supervise)
- operatorsPerShift: people working at that station per shift (can be fractional, e.g. 0.5 if shared)
- ratePerMin: nominal capacity expressed in CASES per minute (convert bottles to cases if the case size is known or typical; e.g. 6 or 12 bottles per case). null if you truly cannot estimate.
- liftKgPerUnit: kg lifted manually per case handled (0 if the station involves no manual lifting; a 12 x 0.7 l glass crate is roughly 15-17 kg). null if unknown.
- repetitiveness: 1 (varied tasks) to 5 (identical motion all shift)
- variability: 1 (one format) to 5 (many formats / irregular products)
- issues: short concrete issues at this station (waste, ergonomics, bottlenecks, hygiene, quality, safety)
- confidence: 0-1, how sure you are about this station from the evidence given

Also provide a 2-3 sentence neutral summary of the line and a list of observations (waste, safety/ergonomics, bottleneck hints, hygiene). Never mention or recommend equipment brands or vendors. Be realistic; when unsure, use typical values for an SME line and lower the confidence. Return between 3 and 14 stations.`;

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    stations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: STATION_TYPES },
          level: { type: 'string', enum: LEVELS },
          operatorsPerShift: { type: 'number' },
          ratePerMin: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          liftKgPerUnit: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          repetitiveness: { type: 'integer' },
          variability: { type: 'integer' },
          issues: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
        },
        required: ['name', 'type', 'level', 'operatorsPerShift', 'ratePerMin', 'liftKgPerUnit', 'repetitiveness', 'variability', 'issues', 'confidence'],
        additionalProperties: false,
      },
    },
    observations: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'stations', 'observations'],
  additionalProperties: false,
};

const clamp = (n: unknown, lo: number, hi: number, dflt: number) => {
  const v = typeof n === 'number' ? n : parseFloat(String(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
};
const strArr = (a: unknown, max: number, len = 240): string[] =>
  Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x: string) => x.trim().slice(0, len)) : [];

function sanitizeExtraction(raw: any): ExtractionResult {
  const stations: ExtractedStation[] = (Array.isArray(raw?.stations) ? raw.stations : []).slice(0, 16).map((s: any, i: number) => {
    const type: StationType = STATION_TYPES.includes(s?.type) ? s.type : 'manual_other';
    const level: AutomationLevel = LEVELS.includes(s?.level) ? s.level : 'manual';
    const rate = s?.ratePerMin == null ? null : clamp(s.ratePerMin, 0.1, 2000, NaN);
    const lift = s?.liftKgPerUnit == null ? null : clamp(s.liftKgPerUnit, 0, 60, NaN);
    return {
      name: (typeof s?.name === 'string' && s.name.trim() ? s.name.trim() : `Station ${i + 1}`).slice(0, 60),
      type,
      level,
      operatorsPerShift: Math.round(clamp(s?.operatorsPerShift, 0, 20, level === 'auto' ? 0.5 : 1) * 10) / 10,
      ratePerMin: rate == null || Number.isNaN(rate) ? null : Math.round(rate * 10) / 10,
      liftKgPerUnit: lift == null || Number.isNaN(lift) ? null : Math.round(lift * 10) / 10,
      repetitiveness: Math.round(clamp(s?.repetitiveness, 1, 5, 3)),
      variability: Math.round(clamp(s?.variability, 1, 5, 2)),
      issues: strArr(s?.issues, 6),
      confidence: Math.round(clamp(s?.confidence, 0, 1, 0.6) * 100) / 100,
    };
  });
  return {
    summary: typeof raw?.summary === 'string' ? raw.summary.slice(0, 1200) : '',
    stations,
    observations: strArr(raw?.observations, 10, 300),
  };
}

async function extract(body: any) {
  const text: string = typeof body.text === 'string' ? body.text.slice(0, 12000) : '';
  const images: { mediaType: string; data: string }[] = Array.isArray(body.images) ? body.images.slice(0, 10) : [];
  const sector: string = typeof body.sector === 'string' ? body.sector : '';
  const client = getClient(55_000);
  if (!client || (!text.trim() && images.length === 0)) {
    return { ...MOCK_EXTRACTION, mock: true, reason: client ? 'empty input' : 'no API key' };
  }

  const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const content: any[] = [];
  images.forEach((img, i) => {
    if (!img || typeof img.data !== 'string' || !img.data) return;
    const mt = okTypes.includes(img.mediaType) ? img.mediaType : 'image/jpeg';
    const data = img.data.includes(',') ? img.data.split(',').pop()! : img.data;
    if (images.length > 1) content.push({ type: 'text', text: `Frame ${i + 1} of ${images.length}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: mt, data } });
  });
  content.push({
    type: 'text',
    text:
      (sector ? `Sub-sector: ${sector}.\n` : '') +
      (text.trim() ? `Description from the plant:\n"""\n${text.trim()}\n"""\n` : '') +
      (images.length ? `Analyse the ${images.length > 1 ? 'frames above (time order)' : 'image above'}.\n` : '') +
      'Extract the packaging line stations in flow order, with estimates and issues, as JSON.',
  });

  try {
    const params: any = {
      model: MODEL,
      max_tokens: 8000,
      system: EXTRACT_SYSTEM,
      messages: [{ role: 'user', content }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: EXTRACT_SCHEMA } },
    };
    const msg = (await client.messages.create(params)) as Anthropic.Message;
    if (msg.stop_reason === 'refusal') throw new Error('model refused');
    const raw = textOf(msg);
    const jsonStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    const result = sanitizeExtraction(JSON.parse(jsonStr));
    if (result.stations.length === 0) throw new Error('no stations extracted');
    return { ...result, mock: false };
  } catch (e) {
    console.warn('[autoscope extract] falling back to mock:', describeError(e));
    return { ...MOCK_EXTRACTION, mock: true, reason: describeError(e) };
  }
}

// ============================================================================ explain
const EXPLAIN_SYSTEM = `You are AutoScope, a vendor-neutral automation advisor for food & beverage packaging SMEs.
You explain analysis results to a managing director who has no automation background.
Rules:
- Use ONLY numbers that appear in the provided context JSON. Never invent, recompute or extrapolate figures. If a number is not in the context, describe it qualitatively.
- 120-180 words. Plain language, no jargon (or explain it in a few words).
- Short paragraphs or "- " bullets. No markdown headings. Bold (**like this**) at most 2-3 key figures.
- Never mention or recommend equipment brands or vendors; talk about technology classes.
- End with one practical takeaway.`;

async function explainH(body: any) {
  const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 2000) : 'Explain these results.';
  const ctxStr = safeJson(body.context, 16000);
  const client = getClient(45_000);
  if (!client) return { text: mockExplain(prompt, body.context), mock: true };
  try {
    const params: any = {
      model: MODEL,
      max_tokens: 4000,
      system: EXPLAIN_SYSTEM,
      messages: [{ role: 'user', content: `Context (computed by the AutoScope engine):\n${ctxStr}\n\nTask: ${prompt}` }],
      output_config: { effort: 'low' },
    };
    const msg = (await client.messages.create(params)) as Anthropic.Message;
    if (msg.stop_reason === 'refusal') throw new Error('model refused');
    const text = textOf(msg);
    if (!text) throw new Error('empty response');
    return { text, mock: false };
  } catch (e) {
    console.warn('[autoscope explain] falling back to mock:', describeError(e));
    return { text: mockExplain(prompt, body.context), mock: true };
  }
}

// ============================================================================ chat
const CHAT_SYSTEM = `You are the AutoScope Advisor: a vendor-neutral automation advisor for food & beverage packaging SMEs (typically German Mittelstand plants).
You are grounded in the analysis JSON provided below (company profile, line, line analysis, opportunity scores, technology recommendations, ROI per station, portfolio, roadmap, Monte Carlo risk simulation, sensitivity). A deterministic engine computed every number in it.
Rules:
- Base answers on the analysis. Quote computed numbers exactly as given and call them computed results.
- You may reason about what-ifs approximately (e.g. "labour +10%"), but clearly label such numbers as rough estimates, explain the logic in one line, and point the user to the page where they can change the assumption to get a computed answer: Company profile (/profile: labour cost, budget, shifts, horizon, discount rate, goals), Line Builder (/line: stations, rates, operators, scrap, downtime), Assumptions (/assumptions: injury cost, Monte Carlo uncertainty, score weights, technology catalog), Technology (/technology), ROI & Risk (/roi), Roadmap (/roadmap), Opportunities (/opportunities).
- Never recommend or name equipment brands or vendors. Talk about technology classes (e.g. collaborative robot palletizer, automatic case packer, vision inspection, AMR).
- Be concise and practical: usually under 200 words, short paragraphs or "- " bullets, no markdown headings.
- If the analysis does not contain something, say so honestly.`;

async function chatH(body: any) {
  const messages: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 6000) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return { text: 'Ask me anything about your analysis: what to automate first, why a technology was chosen, or what happens if costs change.', mock: false };
  }
  const client = getClient(55_000);
  if (!client) return { text: mockChat(messages, body.context), mock: true };
  try {
    const params: any = {
      model: MODEL,
      max_tokens: 6000,
      system: `${CHAT_SYSTEM}\n\nAnalysis JSON:\n${safeJson(body.context, 20000)}`,
      messages,
      output_config: { effort: 'medium' },
    };
    const msg = (await client.messages.create(params)) as Anthropic.Message;
    if (msg.stop_reason === 'refusal') return { text: "I can't help with that request. I'm happy to discuss your automation analysis, technologies, ROI or risks.", mock: false };
    const text = textOf(msg);
    if (!text) throw new Error('empty response');
    return { text, mock: false };
  } catch (e) {
    console.warn('[autoscope chat] falling back to mock:', describeError(e));
    return { text: mockChat(messages, body.context), mock: true };
  }
}

function safeJson(x: unknown, max: number): string {
  let s = '';
  try {
    s = JSON.stringify(x ?? {});
  } catch {
    s = '{}';
  }
  return s.length > max ? s.slice(0, max) + '…(truncated)' : s;
}

// ============================================================================ mock / fallback
const MOCK_EXTRACTION: ExtractionResult = {
  summary:
    'A mid-sized mineral water and juice bottling line (glass, 0.7 l and 1 l) running two shifts. Filling, capping and labelling are largely automatic, but everything at the end of the line (case packing into crates, palletizing, wrapping and pallet transport) is done by hand, with paper-based quality records.',
  stations: [
    { name: 'Empty bottle depalletizing', type: 'depalletizing', level: 'semi', operatorsPerShift: 1, ratePerMin: 18, liftKgPerUnit: 4, repetitiveness: 4, variability: 2, issues: ['Operator pushes layers by hand onto the infeed table', 'Glass breakage when layer sheets slip'], confidence: 0.75 },
    { name: 'Rinser & filler', type: 'filling', level: 'auto', operatorsPerShift: 1, ratePerMin: 22, liftKgPerUnit: 0, repetitiveness: 2, variability: 2, issues: ['~25 min product changeover with manual valve cleaning'], confidence: 0.85 },
    { name: 'Capper', type: 'capping', level: 'auto', operatorsPerShift: 0.5, ratePerMin: 22, liftKgPerUnit: 0, repetitiveness: 2, variability: 2, issues: ['Occasional crooked caps cause micro-stops'], confidence: 0.8 },
    { name: 'Labeller & date coding', type: 'labelling', level: 'auto', operatorsPerShift: 0.5, ratePerMin: 20, liftKgPerUnit: 0, repetitiveness: 2, variability: 3, issues: ['Label roll changes stop the line', 'Skewed labels found only at packing'], confidence: 0.8 },
    { name: 'Visual check (manual)', type: 'inspection', level: 'manual', operatorsPerShift: 1, ratePerMin: 16, liftKgPerUnit: 0, repetitiveness: 5, variability: 2, issues: ['Fill level and label checked by eye, fatigue after 1-2 hours', 'Defects slip through at full line speed'], confidence: 0.7 },
    { name: 'Crate packing by hand', type: 'case_packing', level: 'manual', operatorsPerShift: 2, ratePerMin: 12, liftKgPerUnit: 1.5, repetitiveness: 5, variability: 2, issues: ['Bottleneck: bottles accumulate on the conveyor', 'Repetitive grasping and twisting'], confidence: 0.8 },
    { name: 'Manual palletizing', type: 'palletizing', level: 'manual', operatorsPerShift: 2, ratePerMin: 12, liftKgPerUnit: 16, repetitiveness: 5, variability: 2, issues: ['Crates of ~16 kg lifted up to 1.6 m', 'High back strain, frequent sick days'], confidence: 0.85 },
    { name: 'Stretch wrapping', type: 'stretch_wrapping', level: 'semi', operatorsPerShift: 0.5, ratePerMin: 14, liftKgPerUnit: 0, repetitiveness: 3, variability: 1, issues: ['Operator walks around pallet to start and cut film'], confidence: 0.7 },
    { name: 'Pallet transport to warehouse', type: 'internal_transport', level: 'manual', operatorsPerShift: 1, ratePerMin: 14, liftKgPerUnit: 0, repetitiveness: 3, variability: 2, issues: ['Forklift traffic crosses walkway', 'Waiting time when forklift is busy'], confidence: 0.65 },
    { name: 'Paper QA & batch records', type: 'quality_documentation', level: 'manual', operatorsPerShift: 0.5, ratePerMin: 22, liftKgPerUnit: 0, repetitiveness: 4, variability: 1, issues: ['HACCP checklists on paper, typed into Excel later', 'Slow traceability in case of recall'], confidence: 0.6 },
  ],
  observations: [
    'End of line is the bottleneck: manual crate packing and palletizing (≈12 cases/min) cannot keep up with the filler (≈22 cases/min).',
    'Ergonomic hotspot at palletizing: ~16 kg crates lifted repeatedly, two people per shift.',
    'Manual visual inspection at full speed is unreliable and fatiguing.',
    'Wet area around filler: check that any added equipment meets washdown hygiene requirements.',
    'Paper-based QA records slow down traceability and audits.',
  ],
};

// ---- helpers to read numbers from arbitrary context for mock text
function flatten(x: unknown, prefix = '', out: Record<string, unknown> = {}, depth = 0): Record<string, unknown> {
  if (depth > 5 || x == null) return out;
  if (Array.isArray(x)) {
    x.slice(0, 3).forEach((v, i) => flatten(v, `${prefix}[${i}]`, out, depth + 1));
  } else if (typeof x === 'object') {
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) flatten(v, prefix ? `${prefix}.${k}` : k, out, depth + 1);
  } else {
    out[prefix] = x;
  }
  return out;
}

function findNum(flat: Record<string, unknown>, ...patterns: RegExp[]): number | null {
  for (const p of patterns) {
    for (const [k, v] of Object.entries(flat)) {
      if (p.test(k) && typeof v === 'number' && Number.isFinite(v)) return v;
    }
  }
  return null;
}
function findStr(flat: Record<string, unknown>, ...patterns: RegExp[]): string | null {
  for (const p of patterns) {
    for (const [k, v] of Object.entries(flat)) {
      if (p.test(k) && typeof v === 'string' && v.trim()) return v;
    }
  }
  return null;
}

const fmtEur = (n: number) => (Math.abs(n) >= 1_000_000 ? `€${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1000 ? `€${Math.round(n / 1000)}k` : `€${Math.round(n)}`);
const fmtYrs = (n: number) => (n > 50 ? 'never' : `${n.toFixed(1)} years`);

function keyFigures(context: unknown) {
  const flat = flatten(context);
  return {
    flat,
    invest: findNum(flat, /^portfolio\.totalInvestment$/, /totalInvestment$/i, /investment$/i, /capex$/i),
    benefit: findNum(flat, /^portfolio\.totalNetAnnualBenefit$/, /netAnnualBenefit$/i, /annualBenefit/i, /grossAnnualSavings$/i),
    payback: findNum(flat, /^portfolio\.paybackYears$/, /paybackP50$/i, /paybackYears$/i, /payback/i),
    npv: findNum(flat, /^portfolio\.npv$/, /npvP50$/i, /(^|\.)npv$/i),
    fte: findNum(flat, /^portfolio\.fteFreed$/, /fteFreed$/i),
    prob: findNum(flat, /probPaybackWithinHorizonPct$/i, /probPaybackWithinHorizon$/i),
    p10: findNum(flat, /paybackP10$/i),
    p90: findNum(flat, /paybackP90$/i),
    topStation: findStr(flat, /^opportunityScores\[0\]\.station$/, /station$/i, /name$/i),
    topTech: findStr(flat, /^recommendations\[0\]\.best\.tech$/, /^roi\[0\]\.tech$/, /tech$/i, /techName$/i),
    bottleneck: findStr(flat, /^lineAnalysis\.bottleneck$/, /bottleneck$/i),
    budget: findNum(flat, /^profile\.budget$/, /budget$/i),
    horizon: findNum(flat, /^profile\.horizonYears$/, /horizonYears$/i),
  };
}

function mockExplain(prompt: unknown, context: unknown): string {
  const f = keyFigures(context);
  const parts: string[] = [];
  const lead: string[] = [];
  if (f.topStation && f.topTech) lead.push(`The analysis points to **${f.topStation}** as the strongest candidate, best served by a ${f.topTech}.`);
  else if (f.topStation) lead.push(`The analysis points to **${f.topStation}** as the strongest place to start.`);
  else lead.push('The analysis compares where automation would remove the most manual, repetitive and physically demanding work on your line.');
  if (f.bottleneck) lead.push(`Today the line is held back by ${f.bottleneck}, so improvements there also lift total output.`);
  parts.push(lead.join(' '));

  const bullets: string[] = [];
  if (f.invest != null) bullets.push(`- Investment: about ${fmtEur(f.invest)} including integration.`);
  if (f.benefit != null) bullets.push(`- Net yearly benefit: roughly ${fmtEur(f.benefit)}, mainly from labour, less scrap and fewer stoppages.`);
  if (f.payback != null) bullets.push(`- Payback: **${fmtYrs(f.payback)}**.`);
  if (f.npv != null) bullets.push(`- Value over the planning horizon (NPV): ${fmtEur(f.npv)}.`);
  if (f.fte != null) bullets.push(`- About ${f.fte.toFixed(1)} full-time roles freed for other tasks, which helps with hiring shortages.`);
  if (f.p10 != null && f.p90 != null) bullets.push(`- In the risk simulation payback lands between ${fmtYrs(f.p10)} and ${fmtYrs(f.p90)} in most scenarios.`);
  if (bullets.length) parts.push(bullets.join('\n'));
  else parts.push('The figures on this page come straight from the AutoScope engine: investment, yearly savings, payback and risk are all calculated from your own line data and assumptions.');

  parts.push('Takeaway: start with the step that combines a short payback with heavy manual work, then use the savings to fund the next phase. You can adjust any assumption on the Assumptions page and see the effect immediately.');
  return parts.join('\n\n');
}

function mockChat(messages: unknown, context: unknown): string {
  const list = Array.isArray(messages) ? (messages as ChatMessage[]) : [];
  const q = (list.filter((m) => m?.role === 'user').pop()?.content ?? '').toLowerCase();
  const f = keyFigures(context);
  const flat = f.flat;
  const lines: string[] = [];

  if (/cobot|industrial robot|palleti/.test(q)) {
    lines.push('For palletizing at an SME line, a collaborative robot palletizer usually fits better than a full industrial robot cell:');
    lines.push('- Your rate is moderate (roughly 10-15 cases per minute), which a cobot handles comfortably.\n- It needs far less guarding and floor space, so it fits an existing end-of-line area.\n- Lower investment and faster installation, which shortens payback.\n- Staff can be trained to change patterns themselves, useful with frequent SKU changes.');
    lines.push('An industrial robot makes sense when rates are much higher, loads are heavier or you palletize several lines at once. The Technology page shows the fit score and why the alternatives were ranked lower.');
  } else if (/labou?r|wage|salary|cost.*(rise|increase|up)|\d+\s*%/.test(q)) {
    const lab = findNum(flat, /^lineAnalysis\.totalLabourCostPerYear$/, /labourCostPerYear$/i);
    lines.push('Rough estimate (not a computed result): most of the yearly benefit comes from labour savings, so higher labour costs make automation pay back faster.');
    if (f.benefit != null && f.payback != null) {
      const est = f.payback / 1.08;
      lines.push(`- Computed today: net benefit ${fmtEur(f.benefit)} per year, payback ${fmtYrs(f.payback)}.\n- With labour +10%, payback would shorten to roughly ${fmtYrs(est)} (estimate, assuming ~80% of savings are labour).`);
    } else if (lab != null) {
      lines.push(`- Your line currently costs about ${fmtEur(lab)} per year in labour; +10% adds roughly ${fmtEur(lab * 0.1)} per year, which strengthens the case.`);
    }
    lines.push('To get an exact computed answer, change the labour cost per hour on the Company profile page (/profile) and every result updates instantly.');
  } else if (/first|start|€|budget|150/.test(q)) {
    lines.push(`Based on the computed ranking, I would start with ${f.topStation ?? 'the top-ranked station'}${f.topTech ? ` using a ${f.topTech}` : ''}.`);
    const b: string[] = [];
    if (f.invest != null) b.push(`- Recommended portfolio investment: ${fmtEur(f.invest)}${f.budget != null ? ` of your ${fmtEur(f.budget)} budget` : ''} (computed).`);
    if (f.payback != null) b.push(`- Portfolio payback: ${fmtYrs(f.payback)} (computed).`);
    b.push('- Pick quick wins first (short lead time, high manual load), then reinvest the savings in the mid-term steps.');
    lines.push(b.join('\n'));
    lines.push('With a different budget, change it on the Company profile page (/profile) and the Roadmap (/roadmap) re-plans what fits.');
  } else if (/risk|uncertain|wrong|fail/.test(q)) {
    lines.push('The main risks for this plan:');
    const b: string[] = [];
    if (f.p10 != null && f.p90 != null) b.push(`- Payback spread from the Monte Carlo simulation: ${fmtYrs(f.p10)} (optimistic) to ${fmtYrs(f.p90)} (pessimistic) (computed).`);
    if (f.prob != null) b.push(`- Probability of paying back within the horizon: ${Math.round(f.prob <= 1 ? f.prob * 100 : f.prob)}% (computed).`);
    b.push('- Integration effort: interfaces to existing machines and conveyors often take longer than planned.\n- Format variety: many SKUs or frequent changeovers reduce the real savings.\n- Hygiene: equipment near wet areas must meet washdown requirements.\n- People: operators need training and early involvement.');
    lines.push(b.join('\n'));
    lines.push('The ROI & Risk page (/roi) shows the sensitivity chart: which assumption moves the result the most.');
  } else {
    const b: string[] = [];
    if (f.topStation) b.push(`- Top opportunity: ${f.topStation}${f.topTech ? ` → ${f.topTech}` : ''}.`);
    if (f.invest != null) b.push(`- Portfolio investment: ${fmtEur(f.invest)}.`);
    if (f.benefit != null) b.push(`- Net yearly benefit: ${fmtEur(f.benefit)}.`);
    if (f.payback != null) b.push(`- Payback: ${fmtYrs(f.payback)}.`);
    if (f.npv != null) b.push(`- NPV: ${fmtEur(f.npv)}.`);
    lines.push('Here is what the analysis says (all computed by the AutoScope engine):');
    lines.push(b.length ? b.join('\n') : '- Complete your company profile and line to get computed results.');
    lines.push('Ask me why a technology was chosen, what to do first with a given budget, or how a change in costs would affect the payback.');
  }
  return lines.join('\n\n');
}
