import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReactFlow, ReactFlowProvider, Background, Controls, MarkerType, useReactFlow, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, ArrowRight, LayoutTemplate, MousePointerClick, Plus, Trash2, Video, Activity } from 'lucide-react';
import { useApp, useAnalysis } from '../store';
import type { StationType } from '../types';
import { PageHeader, Card, Button, Select, Input, NumberInput, Empty, Stat } from '../components/ui';
import { STATION_TYPE_LABEL, eur, num, pct } from '../lib/format';
import { TemplatePicker } from '../components/line/TemplatePicker';
import { StationNode, type StationFlowNode } from '../components/line/StationNode';
import { StationEditor } from '../components/line/StationEditor';
import { STATION_TYPES, newStation } from '../components/line/stationDefaults';

const nodeTypes = { station: StationNode };
const X_GAP = 240;

function FitOnChange({ count }: { count: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.1, duration: 300, maxZoom: 1.1, minZoom: 0.6 }), 30);
    return () => clearTimeout(t);
  }, [count, fitView]);
  return null;
}

function LineBuilderInner() {
  const line = useApp((s) => s.line);
  const setLine = useApp((s) => s.setLine);
  const setStations = useApp((s) => s.setStations);
  const updateStation = useApp((s) => s.updateStation);
  const addStation = useApp((s) => s.addStation);
  const removeStation = useApp((s) => s.removeStation);
  const applyTemplate = useApp((s) => s.applyTemplate);
  const bundle = useAnalysis();
  const la = bundle.line;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newType, setNewType] = useState<StationType>('case_packing');

  const stations = line.stations;
  const selIndex = stations.findIndex((s) => s.id === selectedId);
  const selected = selIndex >= 0 ? stations[selIndex] : undefined;
  const byId = useMemo(() => new Map(la.stations.map((a) => [a.stationId, a])), [la.stations]);

  const nodes: StationFlowNode[] = useMemo(
    () =>
      stations.map((s, i) => ({
        id: s.id,
        type: 'station',
        position: { x: i * X_GAP, y: 0 },
        draggable: false,
        data: {
          station: s,
          analysis: byId.get(s.id),
          index: i,
          isBottleneck: la.bottleneckId === s.id,
          selected: s.id === selectedId,
          unitName: line.unitName,
        },
      })),
    [stations, byId, la.bottleneckId, selectedId, line.unitName],
  );

  const edges: Edge[] = useMemo(
    () =>
      stations.slice(1).map((s, i) => {
        const hot = la.bottleneckId === s.id;
        const color = hot ? '#f43f5e' : '#338dfc';
        return {
          id: `${stations[i].id}-${s.id}`,
          source: stations[i].id,
          target: s.id,
          animated: true,
          style: { stroke: color, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        };
      }),
    [stations, la.bottleneckId],
  );

  const move = (dir: -1 | 1) => {
    if (selIndex < 0) return;
    const j = selIndex + dir;
    if (j < 0 || j >= stations.length) return;
    const next = [...stations];
    [next[selIndex], next[j]] = [next[j], next[selIndex]];
    setStations(next);
  };

  const add = () => {
    const st = newStation(newType);
    addStation(st);
    setSelectedId(st.id);
  };

  const del = () => {
    if (!selected) return;
    removeStation(selected.id);
    setSelectedId(null);
  };

  const bottleneck = stations.find((s) => s.id === la.bottleneckId);
  const short = la.taktGapPct > 0;

  return (
    <div>
      <PageHeader
        eyebrow="1 · Capture"
        title="Line Builder"
        subtitle="Model your packaging line station by station. Every edit flows straight into the deterministic analysis — bottleneck, OEE, labour cost and ROI update live."
        actions={
          <Link to="/analysis">
            <Button variant="secondary"><Activity size={15} /> View analysis</Button>
          </Link>
        }
      />

      {/* Toolbar */}
      <Card className="mb-4 !p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-600"><LayoutTemplate size={12} /> Template</div>
            <TemplatePicker onPick={(s) => { applyTemplate(s); setSelectedId(null); }} />
          </div>
          <div className="flex items-end gap-2">
            <div className="w-48">
              <div className="mb-1 text-xs font-medium text-ink-600">New station type</div>
              <Select value={newType} onChange={(e) => setNewType(e.target.value as StationType)}>
                {STATION_TYPES.map((t) => <option key={t} value={t}>{STATION_TYPE_LABEL[t]}</option>)}
              </Select>
            </div>
            <Button onClick={add}><Plus size={15} /> Add station</Button>
          </div>
          <div className="flex items-end gap-1.5">
            <Button variant="secondary" className="px-3" disabled={!selected || selIndex === 0} onClick={() => move(-1)} title="Move left">
              <ArrowLeft size={15} />
            </Button>
            <Button variant="secondary" className="px-3" disabled={!selected || selIndex === stations.length - 1} onClick={() => move(1)} title="Move right">
              <ArrowRight size={15} />
            </Button>
            <Button variant="secondary" className="px-3 text-rose-600" disabled={!selected} onClick={del} title="Delete station">
              <Trash2 size={15} />
            </Button>
          </div>
          <div className="ml-auto flex flex-wrap items-end gap-2">
            <div className="w-44">
              <div className="mb-1 text-xs font-medium text-ink-600">Line name</div>
              <Input value={line.name} onChange={(e) => setLine({ name: e.target.value })} />
            </div>
            <div className="w-28">
              <div className="mb-1 text-xs font-medium text-ink-600">Target rate</div>
              <NumberInput value={line.targetRatePerMin} min={0} step={1} suffix="/min" onChange={(n) => setLine({ targetRatePerMin: Math.max(0, n) })} />
            </div>
            <div className="w-28">
              <div className="mb-1 text-xs font-medium text-ink-600">Unit</div>
              <Input value={line.unitName} onChange={(e) => setLine({ unitName: e.target.value })} />
            </div>
          </div>
        </div>
      </Card>

      {stations.length === 0 ? (
        <Empty title="This line has no stations yet">
          <p>Start from an industry template, add stations manually, or capture the line from a video.</p>
          <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-2">
            <Button onClick={() => applyTemplate('beverages')}><LayoutTemplate size={15} /> Load beverage template</Button>
            <Link to="/capture"><Button variant="secondary"><Video size={15} /> Capture from video</Button></Link>
          </div>
        </Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="relative h-[420px] overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, n) => setSelectedId(n.id)}
              onPaneClick={() => setSelectedId(null)}
              nodesDraggable={false}
              nodesConnectable={false}
              fitView
              fitViewOptions={{ padding: 0.1, maxZoom: 1.1, minZoom: 0.6 }}
              panOnScroll
              minZoom={0.3}
              maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} color="#dde1e8" />
              <Controls showInteractive={false} position="bottom-left" />
              <FitOnChange count={stations.length} />
            </ReactFlow>
            <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-3 rounded-xl bg-white/90 px-3 py-1.5 text-[11px] text-ink-500 ring-1 ring-ink-100 backdrop-blur">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Manual</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-500" />Semi</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Auto</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full ring-2 ring-rose-500" />Bottleneck</span>
            </div>
          </div>

          <Card className="h-[420px] overflow-hidden">
            {selected ? (
              <StationEditor
                key={selected.id}
                station={selected}
                analysis={byId.get(selected.id)}
                index={selIndex}
                count={stations.length}
                onChange={(patch) => updateStation(selected.id, patch)}
                onDelete={del}
                onMove={move}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <MousePointerClick size={22} />
                </div>
                <div className="mt-3 text-sm font-semibold text-ink-800">Select a station to edit</div>
                <p className="mt-1 max-w-[240px] text-xs text-ink-500">
                  Click any card on the canvas to change its rate, staffing, downtime, ergonomics and issues. The analysis recalculates instantly.
                </p>
                {bottleneck && (
                  <Button variant="secondary" className="mt-4" onClick={() => setSelectedId(bottleneck.id)}>
                    Inspect bottleneck: {bottleneck.name}
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {stations.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Line rate vs target"
              value={<span>{num(la.lineRatePerMin, 1)} <span className="text-sm font-medium text-ink-400">/ {num(line.targetRatePerMin)} {line.unitName}/min</span></span>}
              hint={short ? `${pct(la.taktGapPct)} short of takt` : `${pct(-la.taktGapPct)} headroom`}
              tone={short ? 'bad' : 'good'}
            />
            <Stat label="Bottleneck" value={<span className="block truncate">{bottleneck?.name ?? 'None'}</span>} hint={bottleneck ? STATION_TYPE_LABEL[bottleneck.type] : 'All stations keep up'} tone={bottleneck ? 'warn' : 'good'} />
            <Stat label="Operators per shift" value={num(la.totalOperatorsPerShift, 1)} hint={`${stations.filter((s) => s.level === 'manual').length} manual stations`} />
            <Stat label="Labour cost / year" value={eur(la.totalLabourCostPerYear)} hint="fully loaded, all shifts" tone="brand" />
          </div>
          <Link
            to="/capture"
            className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-white px-5 py-4 transition hover:border-brand-300"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white"><Video size={18} /></div>
              <div>
                <div className="text-sm font-semibold text-ink-900">Build this from a video instead</div>
                <div className="text-xs text-ink-500">AI Process Capture turns a phone video or description into stations — you stay in control of every number.</div>
              </div>
            </div>
            <ArrowRight size={18} className="shrink-0 text-brand-600" />
          </Link>
        </>
      )}
    </div>
  );
}

export default function LineBuilder() {
  return (
    <ReactFlowProvider>
      <LineBuilderInner />
    </ReactFlowProvider>
  );
}
