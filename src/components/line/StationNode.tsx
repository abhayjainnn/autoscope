import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { AlertTriangle, Users, Gauge } from 'lucide-react';
import type { Station, StationAnalysis } from '../../types';
import { Badge, ScoreBar } from '../ui';
import { STATION_TYPE_LABEL, num } from '../../lib/format';
import { LEVEL_LABEL, LEVEL_TONE, utilTone } from './stationDefaults';

export type StationNodeData = {
  station: Station;
  analysis?: StationAnalysis;
  index: number;
  isBottleneck: boolean;
  selected: boolean;
  unitName: string;
};

export type StationFlowNode = Node<StationNodeData, 'station'>;

function StationNodeImpl({ data }: NodeProps<StationFlowNode>) {
  const { station, analysis, index, isBottleneck, selected } = data;
  const util = analysis?.utilization ?? 0;
  const tone = utilTone(util);
  const ring = isBottleneck
    ? 'ring-2 ring-rose-500 shadow-rose-200 shadow-lg'
    : selected
      ? 'ring-2 ring-brand-500 shadow-brand-100 shadow-lg'
      : 'ring-1 ring-ink-200 shadow-sm hover:ring-brand-300';
  return (
    <div className={`relative w-[200px] cursor-pointer rounded-2xl bg-white p-3 transition ${ring}`}>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-ink-300" />
      {isBottleneck && (
        <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
          <AlertTriangle size={10} /> Bottleneck
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {index + 1} · {STATION_TYPE_LABEL[station.type]}
          </div>
          <div className="truncate text-sm font-semibold text-ink-900" title={station.name}>
            {station.name}
          </div>
        </div>
      </div>
      <div className="mt-2">
        <Badge tone={LEVEL_TONE[station.level]}>{LEVEL_LABEL[station.level]}</Badge>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1 text-ink-600">
          <Gauge size={12} className="text-ink-400" />
          <span className="font-semibold tabular-nums text-ink-800">{num(station.ratePerMin, 1)}</span>/min
        </div>
        <div className="flex items-center gap-1 text-ink-600">
          <Users size={12} className="text-ink-400" />
          <span className="font-semibold tabular-nums text-ink-800">{num(station.operatorsPerShift, 1)}</span> ops
        </div>
      </div>
      <div className="mt-2.5">
        <div className="mb-1 flex justify-between text-[10px] text-ink-500">
          <span>Utilization</span>
          <span className={`font-semibold tabular-nums ${tone === 'bad' ? 'text-rose-600' : tone === 'warn' ? 'text-amber-600' : 'text-emerald-600'}`}>
            {Math.round(util * 100)}%
          </span>
        </div>
        <ScoreBar value={Math.min(util, 1.2)} max={1.2} tone={tone} />
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-ink-300" />
    </div>
  );
}

export const StationNode = memo(StationNodeImpl);
