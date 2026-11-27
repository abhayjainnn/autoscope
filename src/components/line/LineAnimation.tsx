import { useEffect, useRef, useState } from 'react';
import type { Line, LineAnalysis } from '../../types';
import { num } from '../../lib/format';
import { UTIL_COLOR, utilTone } from './stationDefaults';

/**
 * Lightweight discrete-event animation of the packaging line.
 * Units arrive at the target (takt) rate; each station serves at its effective rate.
 * Queues build in front of stations whose effective rate is below takt (utilization >= 1).
 */

const PAD_L = 56;
const ST_W = 100;
const GAP = 76;
const PITCH = ST_W + GAP;
const BELT_Y = 128;
const BOX = 10;
const SPACING = 12;
const QUEUE_CAP = 10; // 5 columns x 2 rows
const SPEED = 140; // px / s
const VISUAL_TAKT = 1.1; // boxes per second at target rate

type Phase = 'lane' | 'proc' | 'exit';
interface Item {
  id: number;
  x: number;
  y: number;
  st: number;
  phase: Phase;
  rem: number;
  hue: number;
}

interface SimState {
  items: Map<number, Item>;
  lanes: number[][];
  proc: (number | null)[];
  accum: number;
  nextId: number;
  produced: number;
  blocked: boolean[];
}

const entryX = (i: number) => PAD_L + GAP + i * PITCH;

function slotPos(i: number, k: number) {
  const col = Math.floor(k / 2);
  const row = k % 2;
  return { x: entryX(i) - 6 - BOX - col * SPACING, y: BELT_Y - BOX / 2 - 1 - row * (BOX + 1) };
}

function Person({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x},${y})`} fill={color}>
      <circle cx={0} cy={-6} r={3.2} />
      <path d="M-5 5 Q-5 -2 0 -2 Q5 -2 5 5 Z" />
    </g>
  );
}

export function LineAnimation({ line, analysis, running = true }: { line: Line; analysis: LineAnalysis; running?: boolean }) {
  const n = line.stations.length;
  const width = PAD_L + GAP + n * PITCH + 40;
  const height = 210;
  const byId = new Map(analysis.stations.map((a) => [a.stationId, a]));
  const target = Math.max(0.0001, line.targetRatePerMin);
  const scale = VISUAL_TAKT / target; // visual boxes/s per unit/min

  const serviceTimes = line.stations.map((s) => {
    const eff = byId.get(s.id)?.effectiveRatePerMin ?? s.ratePerMin;
    if (s.ratePerMin <= 0) return 0.05; // not in material flow (e.g. documentation): pass-through
    return eff > 0 ? 1 / (eff * scale) : 30;
  });

  const simRef = useRef<SimState | null>(null);
  const serviceRef = useRef(serviceTimes);
  serviceRef.current = serviceTimes;
  const [, setFrame] = useState(0);

  // reset when line structure changes
  const sig = line.stations.map((s) => s.id).join('|');
  useEffect(() => {
    simRef.current = {
      items: new Map(),
      lanes: Array.from({ length: n }, () => []),
      proc: Array.from({ length: n }, () => null),
      accum: 0,
      nextId: 1,
      produced: 0,
      blocked: Array.from({ length: n }, () => false),
    };
    setFrame((f) => f + 1);
  }, [sig, n]);

  useEffect(() => {
    if (!running || n === 0) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const S = simRef.current;
      if (S) step(S, dt, serviceRef.current, n, width);
      setFrame((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, n, width]);

  const S = simRef.current;
  const items = S ? Array.from(S.items.values()) : [];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" style={{ minWidth: Math.min(width, 120 + n * 110) }}>
        <defs>
          <pattern id="belt" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="#c3c9d4" />
            <rect width="6" height="12" fill="#b4bbc8">
              {running && <animate attributeName="x" from="0" to="12" dur="0.6s" repeatCount="indefinite" />}
            </rect>
          </pattern>
          <linearGradient id="boxg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#d6a86a" />
            <stop offset="1" stopColor="#b9874a" />
          </linearGradient>
        </defs>

        {/* source + sink labels */}
        <text x={8} y={BELT_Y + 4} fontSize={10} fill="#8f97a6" fontWeight={600}>IN</text>
        <text x={width - 30} y={BELT_Y + 4} fontSize={10} fill="#8f97a6" fontWeight={600}>OUT</text>

        {/* stations (behind belt) */}
        {line.stations.map((s, i) => {
          const a = byId.get(s.id);
          const u = a?.utilization ?? 0;
          const tone = utilTone(u);
          const color = UTIL_COLOR[tone];
          const x = entryX(i);
          const isB = analysis.bottleneckId === s.id;
          const ops = Math.round(s.operatorsPerShift * 10) / 10;
          const shown = Math.min(3, Math.ceil(ops));
          return (
            <g key={s.id}>
              {isB && (
                <rect x={x - 5} y={67} width={ST_W + 10} height={98} rx={16} fill="none" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 4">
                  {running && <animate attributeName="stroke-dashoffset" from="0" to="18" dur="1s" repeatCount="indefinite" />}
                </rect>
              )}
              <rect x={x} y={72} width={ST_W} height={88} rx={12} fill={color} fillOpacity={0.14} stroke={color} strokeWidth={1.5} />
              <text x={x + ST_W / 2} y={90} textAnchor="middle" fontSize={13} fontWeight={700} fill={color}>
                {Math.round(u * 100)}%
              </text>
              <text x={x + ST_W / 2} y={102} textAnchor="middle" fontSize={8.5} fill="#677084">utilization</text>
              {/* operators */}
              {ops > 0 ? (
                <g>
                  {Array.from({ length: shown }).map((_, k) => (
                    <Person key={k} x={x + ST_W / 2 - (shown - 1) * 7 + k * 14 - (ops > 3 ? 8 : 0)} y={52} color={s.level === 'manual' ? '#d97706' : '#4d5567'} />
                  ))}
                  <text x={x + ST_W / 2 + (shown - 1) * 7 + 10 - (ops > 3 ? 8 : 0)} y={55} fontSize={10} fontWeight={700} fill="#3a4152">
                    ×{num(ops, 1)}
                  </text>
                </g>
              ) : (
                <text x={x + ST_W / 2} y={55} textAnchor="middle" fontSize={9} fill="#10b981" fontWeight={600}>lights-out</text>
              )}
              <text x={x + ST_W / 2} y={180} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="#252b38">
                {s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name}
              </text>
              <text x={x + ST_W / 2} y={194} textAnchor="middle" fontSize={9} fill="#8f97a6">
                {s.ratePerMin > 0 ? `${num(a?.effectiveRatePerMin ?? 0, 1)}/min eff.` : 'off-flow task'}
              </text>
            </g>
          );
        })}

        {/* belt */}
        <rect x={24} y={BELT_Y - 1} width={width - 60} height={8} rx={4} fill="url(#belt)" />

        {/* boxes */}
        {items.map((it) => (
          <rect key={it.id} x={it.x} y={it.y} width={BOX} height={BOX} rx={2} fill="url(#boxg)" stroke="#8a6232" strokeWidth={0.6} />
        ))}

        {/* produced counter */}
        <g transform={`translate(${width - 120}, 18)`}>
          <rect width={110} height={24} rx={12} fill="#eef7ff" />
          <text x={55} y={16} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#1557de">
            {S?.produced ?? 0} {line.unitName.slice(0, 10)} out
          </text>
        </g>
      </svg>
    </div>
  );
}

function step(S: SimState, dt: number, service: number[], n: number, width: number) {
  if (S.lanes.length !== n) return;
  // 1. source
  S.accum += dt * VISUAL_TAKT;
  while (S.accum >= 1) {
    S.accum -= 1;
    if (S.lanes[0].length < QUEUE_CAP) {
      const id = S.nextId++;
      S.items.set(id, { id, x: 14, y: BELT_Y - BOX / 2 - 1, st: 0, phase: 'lane', rem: 0, hue: 0 });
      S.lanes[0].push(id);
    }
  }
  if (S.accum > 1) S.accum = 1;

  // 2. stations, downstream first so space frees up
  for (let i = n - 1; i >= 0; i--) {
    const pid = S.proc[i];
    if (pid != null) {
      const it = S.items.get(pid)!;
      it.rem -= dt;
      // glide to station centre
      const cx = entryX(i) + ST_W / 2 - BOX / 2;
      it.x = Math.min(cx, it.x + SPEED * dt);
      it.y += (BELT_Y - BOX / 2 - 1 - it.y) * Math.min(1, dt * 10);
      if (it.rem <= 0) {
        if (i === n - 1) {
          it.phase = 'exit';
          S.proc[i] = null;
          S.blocked[i] = false;
        } else if (S.lanes[i + 1].length < QUEUE_CAP) {
          it.phase = 'lane';
          it.st = i + 1;
          S.lanes[i + 1].push(pid);
          S.proc[i] = null;
          S.blocked[i] = false;
        } else {
          S.blocked[i] = true;
        }
      }
    }
    if (S.proc[i] == null && S.lanes[i].length) {
      const head = S.items.get(S.lanes[i][0])!;
      const p = slotPos(i, 0);
      if (head.x >= p.x - 0.5) {
        S.lanes[i].shift();
        head.phase = 'proc';
        head.rem = service[i];
        S.proc[i] = head.id;
      }
    }
  }

  // 3. lane movement
  for (let i = 0; i < n; i++) {
    const lane = S.lanes[i];
    for (let k = 0; k < lane.length; k++) {
      const it = S.items.get(lane[k])!;
      const p = slotPos(i, k);
      if (it.x < p.x) it.x = Math.min(p.x, it.x + SPEED * dt);
      else if (it.x > p.x) it.x = p.x; // shouldn't happen, but keep FIFO tidy
      it.y += (p.y - it.y) * Math.min(1, dt * 8);
    }
  }

  // 4. exits
  for (const it of S.items.values()) {
    if (it.phase === 'exit') {
      it.x += SPEED * dt;
      if (it.x > width - 30) {
        S.items.delete(it.id);
        S.produced++;
      }
    }
  }
}
