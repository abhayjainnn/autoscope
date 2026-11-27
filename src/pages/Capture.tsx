import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Image as ImageIcon, Video, Sparkles, Upload, X, Check, Loader2, ShieldCheck, Trash2, ArrowRight, Plus, AlertTriangle, Eye, ScanSearch, Gauge, Film,
} from 'lucide-react';
import { useApp } from '../store';
import { extractProcess } from '../lib/ai';
import { STATION_TYPE_LABEL, uid } from '../lib/format';
import { Badge, Button, Card, PageHeader, Select, cx } from '../components/ui';
import type { AutomationLevel, ExtractedStation, ExtractionResult, Station, StationType } from '../types';

type Tab = 'describe' | 'photos' | 'video';
type Frame = { mediaType: string; data: string; url: string };

const SAMPLE_DESCRIPTION = `We are a family-run mineral water and juice bottler in Bavaria, about 85 employees, two shifts of 8 hours. Our glass line runs 0.7 l and 1 l bottles, 12 bottles per crate.

At the start, one person unloads pallets of empty bottles. A machine pushes the layers but he has to slide them onto the table and take off the cardboard sheets by hand. Then the rinser and filler run automatically, about 15,000 bottles per hour on a good day, followed by the capper and the labeller with date coding. One colleague looks after these three machines.

After labelling, a woman checks fill level and labels by eye on the conveyor. At full speed she misses things, especially late in the shift.

The end of the line is where it hurts. Two people put the bottles into crates by hand, and the bottles often back up on the conveyor. Two more people stack the full crates (about 16 kg each) onto pallets, up to shoulder height. We have a lot of back problems and sick days there. The pallet goes to a semi-automatic wrapper; someone has to start it and cut the film. Then a forklift takes it to the warehouse, which often means waiting.

Quality records (HACCP checks, batch numbers) are written on paper and typed into Excel at the end of the week.`;

const STEPS = [
  { label: 'Reading input', icon: Eye },
  { label: 'Identifying stations', icon: ScanSearch },
  { label: 'Estimating rates', icon: Gauge },
  { label: 'Spotting issues', icon: AlertTriangle },
];

const STATION_TYPES = Object.keys(STATION_TYPE_LABEL) as StationType[];

// ---------------------------------------------------------------- image helpers
function downscale(source: CanvasImageSource, w: number, h: number, maxW = 768, quality = 0.7): Frame {
  const scale = Math.min(1, maxW / w);
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, cw, ch);
  const url = canvas.toDataURL('image/jpeg', quality);
  return { mediaType: 'image/jpeg', data: url.split(',')[1], url };
}

function loadImageFile(file: File): Promise<Frame> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        resolve(downscale(img, img.naturalWidth, img.naturalHeight));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(src);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error(`Could not read ${file.name}`));
    };
    img.src = src;
  });
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', finish);
      resolve();
    };
    video.addEventListener('seeked', finish);
    video.currentTime = t;
    setTimeout(finish, 3000);
  });
}

async function extractVideoFrames(file: File, count: number, onFrame: (f: Frame, i: number) => void): Promise<void> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('This video format cannot be read by your browser. Try MP4 (H.264) or WebM.'));
      setTimeout(() => reject(new Error('Timed out loading the video.')), 15000);
    });
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    for (let i = 0; i < count; i++) {
      const t = Math.min(duration - 0.05, ((i + 0.5) / count) * duration);
      await seek(video, Math.max(0, t));
      onFrame(downscale(video, video.videoWidth || 768, video.videoHeight || 432), i);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------- mapping
function toStation(e: ExtractedStation, i: number, targetRate: number, offset: number): Station {
  return {
    id: uid(),
    name: e.name,
    type: e.type,
    level: e.level,
    operatorsPerShift: e.operatorsPerShift ?? (e.level === 'auto' ? 0.5 : 1),
    ratePerMin: e.ratePerMin && e.ratePerMin > 0 ? e.ratePerMin : targetRate || 10,
    scrapRate: 0.01,
    downtimePct: 0.05,
    liftKgPerUnit: e.liftKgPerUnit ?? 0,
    changeoverMin: 20,
    repetitiveness: e.repetitiveness ?? 3,
    variability: e.variability ?? 2,
    issues: e.issues ?? [],
    notes: e.issues?.length ? `AI capture: ${e.issues.join('; ')}` : 'Added by AI Process Capture',
    position: { x: (offset + i) * 240, y: 0 },
  };
}

// ============================================================================
export default function Capture() {
  const navigate = useNavigate();
  const line = useApp((s) => s.line);
  const profile = useApp((s) => s.profile);
  const setStations = useApp((s) => s.setStations);
  const setExtraction = useApp((s) => s.setExtraction);
  const lastExtraction = useApp((s) => s.lastExtraction);

  const [tab, setTab] = useState<Tab>('describe');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<Frame[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [videoName, setVideoName] = useState('');
  const [frameProgress, setFrameProgress] = useState<number | null>(null);
  const [inputError, setInputError] = useState('');

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<ExtractionResult | null>(lastExtraction);
  const [rows, setRows] = useState<ExtractedStation[]>(lastExtraction?.stations ?? []);
  const [mock, setMock] = useState(false);
  const [error, setError] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  const FRAME_COUNT = 8;

  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 1600);
    return () => clearInterval(id);
  }, [busy]);

  const onPhotos = async (files: FileList | null) => {
    if (!files) return;
    setInputError('');
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const room = 6 - photos.length;
    if (list.length > room) setInputError('Up to 6 photos. Extra images were skipped.');
    const loaded: Frame[] = [];
    for (const f of list.slice(0, Math.max(0, room))) {
      try {
        loaded.push(await loadImageFile(f));
      } catch (e) {
        setInputError(e instanceof Error ? e.message : String(e));
      }
    }
    setPhotos((p) => [...p, ...loaded].slice(0, 6));
  };

  const onVideo = async (file: File | undefined) => {
    if (!file) return;
    setInputError('');
    setFrames([]);
    setVideoName(file.name);
    setFrameProgress(0);
    try {
      await extractVideoFrames(file, FRAME_COUNT, (f, i) => {
        setFrames((prev) => [...prev, f]);
        setFrameProgress((i + 1) / FRAME_COUNT);
      });
    } catch (e) {
      setInputError(e instanceof Error ? e.message : String(e));
    } finally {
      setFrameProgress(null);
    }
  };

  const images = tab === 'photos' ? photos : tab === 'video' ? frames : [];
  const canAnalyse = !busy && frameProgress === null && (tab === 'describe' ? text.trim().length > 20 : images.length > 0);

  const analyse = async () => {
    setBusy(true);
    setError('');
    const started = Date.now();
    try {
      const r = await extractProcess({
        text: tab === 'describe' ? text : text.trim() ? text : undefined,
        images: images.map(({ mediaType, data }) => ({ mediaType, data })),
        sector: profile.subSector,
      });
      const wait = 5200 - (Date.now() - started);
      if (wait > 0) await new Promise((res) => setTimeout(res, wait));
      setResult(r);
      setRows(r.stations);
      setMock(r.mock);
      setExtraction({ summary: r.summary, stations: r.stations, observations: r.observations });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateRow = (i: number, patch: Partial<ExtractedStation>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const removeRow = (i: number) => setRows((r) => r.filter((_, j) => j !== i));
  const addRow = () =>
    setRows((r) => [...r, { name: 'New station', type: 'manual_other', level: 'manual', operatorsPerShift: 1, ratePerMin: null, liftKgPerUnit: 0, repetitiveness: 3, variability: 2, issues: [], confidence: 1 }]);

  const apply = (mode: 'replace' | 'merge') => {
    if (!result) return;
    const target = line.targetRatePerMin;
    const offset = mode === 'merge' ? line.stations.length : 0;
    const mapped = rows.map((e, i) => toStation(e, i, target, offset));
    setStations(mode === 'merge' ? [...line.stations, ...mapped] : mapped);
    setExtraction({ ...result, stations: rows });
    navigate('/line');
  };

  return (
    <div>
      <PageHeader
        eyebrow="1 · Capture"
        title="AI Process Capture"
        subtitle="Describe your line in your own words, upload a few photos, or record a short walk-through video. AI maps it to stations with rates, staffing and issues; you review it, then the deterministic engine does the maths."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-0">
          {/* tabs */}
          <div className="flex gap-1 border-b border-ink-100 p-2">
            {([
              ['describe', 'Describe', FileText],
              ['photos', 'Photos', ImageIcon],
              ['video', 'Video', Video],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cx(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
                  tab === key ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800',
                )}
              >
                <Icon className="h-4 w-4" /> {label}
                {key === 'photos' && photos.length > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] text-white">{photos.length}</span>}
                {key === 'video' && frames.length > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] text-white">{frames.length}</span>}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'describe' && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-ink-600">Describe your packaging line, from goods-in to pallet out</label>
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setText(SAMPLE_DESCRIPTION)}>
                    <Sparkles className="h-3.5 w-3.5" /> Use sample description
                  </Button>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={12}
                  placeholder="e.g. One person unloads empty bottles from pallets, then the filler and capper run automatically at about 15,000 bottles per hour. Two people pack crates by hand…"
                  className="w-full resize-y rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm leading-relaxed text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <div className="mt-1 text-right text-[11px] text-ink-400">{text.length.toLocaleString()} characters</div>
              </div>
            )}

            {tab === 'photos' && (
              <div>
                <DropZone accept="image/*" multiple onFiles={onPhotos} icon={ImageIcon} title="Upload 1–6 photos of your line" hint="JPG, PNG or WebP. Images are resized in your browser before upload." disabled={photos.length >= 6} />
                {photos.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {photos.map((p, i) => (
                      <div key={i} className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-ink-100">
                        <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                        <button onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink-900/70 text-white opacity-0 transition group-hover:opacity-100" aria-label="Remove photo">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'video' && (
              <div>
                <DropZone accept="video/*" onFiles={(f) => onVideo(f?.[0])} icon={Film} title="Upload a short walk-through video (10–60 s)" hint={`We grab ${FRAME_COUNT} frames evenly across the clip, in your browser.`} disabled={frameProgress !== null} />
                {(frames.length > 0 || frameProgress !== null) && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-ink-500">
                      <span className="truncate font-medium text-ink-700">{videoName}</span>
                      <span>{frameProgress !== null ? `Extracting frames… ${Math.round(frameProgress * 100)}%` : `${frames.length} frames ready`}</span>
                    </div>
                    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(frameProgress ?? 1) * 100}%` }} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                      {Array.from({ length: FRAME_COUNT }).map((_, i) => (
                        <div key={i} className="relative aspect-video overflow-hidden rounded-lg bg-ink-100 ring-1 ring-ink-100">
                          {frames[i] ? (
                            <img src={frames[i].url} alt={`Frame ${i + 1}`} className="h-full w-full object-cover" style={{ animation: 'fadeIn .4s ease' }} />
                          ) : (
                            <div className="h-full w-full animate-pulse bg-ink-100" />
                          )}
                          <span className="absolute bottom-0.5 left-1 text-[9px] font-semibold text-white drop-shadow">{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab !== 'describe' && (
              <div className="mt-4">
                <label className="text-xs font-medium text-ink-600">Optional context (what are we looking at?)</label>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. End of our glass bottle line, 12 bottles per crate, 2 shifts"
                  className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            )}

            {inputError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {inputError}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Frames are processed for analysis only; nothing is stored on our servers.
              </div>
              <Button onClick={analyse} disabled={!canAnalyse} className="bg-gradient-to-r from-brand-600 to-brand-700">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {busy ? 'Analysing…' : 'Analyse with AI'}
              </Button>
            </div>
          </div>
        </Card>

        {/* side panel */}
        <div className="space-y-4">
          <Card title="How it works">
            <ol className="space-y-3 text-sm text-ink-600">
              {[
                ['Capture', 'Text, photos or a short video of your line.'],
                ['AI extraction', 'Stations, staffing, rates, lifting loads and issues.'],
                ['You review', 'Edit anything in the table; nothing is applied automatically.'],
                ['Engine computes', 'Scores, technology fit and ROI are deterministic.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                  <span>
                    <span className="font-semibold text-ink-800">{t}.</span> {d}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
          {busy && (
            <Card title="Analysing your line">
              <ul className="space-y-3">
                {STEPS.map((s, i) => {
                  const state = i < step ? 'done' : i === step ? 'active' : 'todo';
                  const Icon = s.icon;
                  return (
                    <li key={s.label} className="flex items-center gap-3 text-sm">
                      <span
                        className={cx(
                          'grid h-7 w-7 place-items-center rounded-full transition',
                          state === 'done' && 'bg-emerald-100 text-emerald-700',
                          state === 'active' && 'bg-brand-100 text-brand-700',
                          state === 'todo' && 'bg-ink-100 text-ink-400',
                        )}
                      >
                        {state === 'done' ? <Check className="h-4 w-4" /> : state === 'active' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <span className={cx(state === 'todo' ? 'text-ink-400' : 'font-medium text-ink-800')}>
                        {i === 0 ? (images.length ? (tab === 'video' ? 'Reading frames' : 'Reading photos') : 'Reading description') : s.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Analysis failed: {error}
        </div>
      )}

      {result && !busy && (
        <div ref={resultRef} className="mt-8 scroll-mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <Card
              title={
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-600" /> What the AI found
                </span>
              }
              actions={mock ? <Badge tone="warn">demo mode</Badge> : <Badge tone="brand">{rows.length} stations</Badge>}
            >
              <p className="text-sm leading-relaxed text-ink-700">{result.summary}</p>
            </Card>
            <Card title="Observations">
              <ul className="space-y-2">
                {result.observations.map((o, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> <span>{o}</span>
                  </li>
                ))}
                {result.observations.length === 0 && <li className="text-sm text-ink-400">No specific observations.</li>}
              </ul>
            </Card>
          </div>

          <Card
            title="Extracted stations"
            subtitle="Review and edit before applying. Rates are in cases per minute; empty values get sensible defaults."
            actions={
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={addRow}>
                <Plus className="h-3.5 w-3.5" /> Add row
              </Button>
            }
          >
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2">#</th>
                    <th className="px-2 py-2">Station</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Level</th>
                    <th className="px-2 py-2">Operators</th>
                    <th className="px-2 py-2">Rate /min</th>
                    <th className="px-2 py-2">Lift kg</th>
                    <th className="px-2 py-2">Confidence</th>
                    <th className="px-2 py-2">Issues</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-ink-50 align-top hover:bg-ink-50/50">
                      <td className="px-5 py-2 pt-4 text-xs font-semibold text-ink-400">{i + 1}</td>
                      <td className="px-2 py-2">
                        <CellInput value={r.name} onChange={(v) => updateRow(i, { name: v })} className="w-44" />
                      </td>
                      <td className="px-2 py-2">
                        <Select value={r.type} onChange={(e) => updateRow(i, { type: e.target.value as StationType })} className="w-40 py-1.5 text-xs">
                          {STATION_TYPES.map((t) => (
                            <option key={t} value={t}>{STATION_TYPE_LABEL[t]}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Select value={r.level} onChange={(e) => updateRow(i, { level: e.target.value as AutomationLevel })} className="w-24 py-1.5 text-xs">
                          <option value="manual">Manual</option>
                          <option value="semi">Semi</option>
                          <option value="auto">Auto</option>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <CellNum value={r.operatorsPerShift} onChange={(v) => updateRow(i, { operatorsPerShift: v ?? 0 })} step={0.5} />
                      </td>
                      <td className="px-2 py-2">
                        <CellNum value={r.ratePerMin} onChange={(v) => updateRow(i, { ratePerMin: v })} placeholder={`${line.targetRatePerMin}`} />
                      </td>
                      <td className="px-2 py-2">
                        <CellNum value={r.liftKgPerUnit} onChange={(v) => updateRow(i, { liftKgPerUnit: v })} placeholder="0" />
                      </td>
                      <td className="px-2 py-2 pt-3.5">
                        <Badge tone={r.confidence >= 0.75 ? 'good' : r.confidence >= 0.5 ? 'warn' : 'bad'}>{Math.round(r.confidence * 100)}%</Badge>
                      </td>
                      <td className="px-2 py-2 pt-3">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {r.issues.map((iss, j) => (
                            <span key={j} className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] leading-snug text-amber-800 ring-1 ring-inset ring-amber-100">{iss}</span>
                          ))}
                          {r.issues.length === 0 && <span className="text-xs text-ink-300">—</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2 pt-3">
                        <button onClick={() => removeRow(i)} className="rounded-md p-1 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600" aria-label="Remove station">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-500">
                Defaults for missing values: rate = line target ({line.targetRatePerMin}/min), scrap 1%, downtime 5%, changeover 20 min.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => apply('merge')} disabled={rows.length === 0}>
                  <Plus className="h-4 w-4" /> Merge into line ({line.stations.length} + {rows.length})
                </Button>
                <Button onClick={() => apply('replace')} disabled={rows.length === 0}>
                  Apply to Line Builder <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      <style>{`@keyframes fadeIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// ---------------------------------------------------------------- small components
function DropZone({ accept, multiple, onFiles, icon: Icon, title, hint, disabled }: { accept: string; multiple?: boolean; onFiles: (f: FileList | null) => void; icon: typeof Upload; title: string; hint: string; disabled?: boolean }) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && ref.current?.click()}
      className={cx(
        'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
        over ? 'border-brand-400 bg-brand-50' : 'border-ink-200 bg-ink-50/40 hover:border-brand-300 hover:bg-brand-50/40',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm ring-1 ring-ink-100">
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-3 text-sm font-semibold text-ink-800">{title}</div>
      <div className="mt-1 text-xs text-ink-500">{hint}</div>
      <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600">
        <Upload className="h-3.5 w-3.5" /> Click or drag & drop
      </div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function CellInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx('rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium text-ink-900 outline-none hover:border-ink-200 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100', className)}
    />
  );
}

function CellNum({ value, onChange, step = 1, placeholder }: { value: number | null; onChange: (v: number | null) => void; step?: number; placeholder?: string }) {
  return (
    <input
      type="number"
      step={step}
      min={0}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        onChange(Number.isFinite(v) ? v : null);
      }}
      className="w-20 rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm tabular-nums text-ink-900 outline-none placeholder:text-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
    />
  );
}
