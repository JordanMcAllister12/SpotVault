import { useState, useRef, useCallback, useMemo, useEffect, type MouseEvent, type TouchEvent } from 'react';

const GOLD = '#d4a52c';
const GREEN = '#4ade80';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';

export interface GraphPoint {
  index: number;
  hands: number;
  total: number;
  ev: number;
  showdown: number;
  nonShowdown: number;
}

export interface LineConfig {
  key: keyof Pick<GraphPoint, 'total' | 'ev' | 'showdown' | 'nonShowdown'>;
  label: string;
  shortLabel: string;
  color: string;
  dashed?: boolean;
  width: number;
}

export const LINES: LineConfig[] = [
  { key: 'total', label: 'Total', shortLabel: 'Total', color: '#ffffff', width: 2.5 },
  { key: 'ev', label: 'All-In EV', shortLabel: 'EV', color: AMBER, dashed: true, width: 1.8 },
  { key: 'showdown', label: 'Showdown', shortLabel: 'SD', color: GREEN, width: 1.5 },
  { key: 'nonShowdown', label: 'Non-Showdown', shortLabel: 'NSD', color: '#ef4444', width: 1.5 },
];

export function graphSeriesToPoints(graphSeries: any[]): GraphPoint[] {
  return graphSeries.map((p) => ({
    index: p.index,
    hands: p.index,
    total: p.profit ?? 0,
    ev: p.ev ?? 0,
    showdown: p.showdown ?? 0,
    nonShowdown: p.non_showdown ?? p.nonShowdown ?? 0,
  }));
}

export function downsamplePoints(points: GraphPoint[], maxPoints: number): GraphPoint[] {
  if (points.length <= maxPoints) return points;
  const result: GraphPoint[] = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    result.push(points[idx]);
  }
  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]);
  }
  return result;
}

interface Props {
  data: GraphPoint[];
  mode: 'cash' | 'mtt' | 'all';
  variant?: 'full' | 'compact';
}

// Responsive hook for compact variant
function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

// Nice tick step calculator
function niceStep(range: number, targetTicks: number): number {
  const raw = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  let step;
  if (normalized < 1.5) step = 1;
  else if (normalized < 3) step = 2;
  else if (normalized < 7) step = 5;
  else step = 10;
  return step * magnitude;
}

function formatYValue(v: number, mode: 'bb' | 'bb100'): string {
  if (mode === 'bb100') return (v >= 0 ? '+' : '') + v.toFixed(1);
  if (Math.abs(v) >= 1000) return (v >= 0 ? '+' : '') + (v / 1000).toFixed(1) + 'k';
  return (v >= 0 ? '+' : '') + v.toLocaleString();
}

function formatXValue(h: number): string {
  if (h >= 1000) return `${Math.round(h / 1000)}k`;
  return `${h}`;
}

export function CumulativeLineGraph({ data, mode: _mode, variant = 'full' }: Props) {
  const isCompact = variant === 'compact';
  const [yAxisMode, setYAxisMode] = useState<'bb' | 'bb100'>('bb');
  const [visible, setVisible] = useState<Record<string, boolean>>({
    total: true, ev: true, showdown: true, nonShowdown: true,
  });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: containerRef, width: containerWidth } = useContainerWidth();

  // Compact defaults: only Total visible
  useEffect(() => {
    if (isCompact) {
      setVisible({ total: true, ev: false, showdown: false, nonShowdown: false });
    }
  }, [isCompact]);

  // Dimensions
  const W = isCompact ? Math.max(280, containerWidth) : 800;
  const H = isCompact ? 140 : 360;
  const PAD_L = isCompact ? 38 : 56;
  const PAD_R = isCompact ? 8 : 16;
  const PAD_T = isCompact ? 10 : 20;
  const PAD_B = isCompact ? 22 : 36;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const visibleLines = LINES.filter(l => visible[l.key]);

  // Y-axis range — accounts for ALL visible series
  const { yMin: rawYMin, yMax: rawYMax } = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const p of data) {
      for (const l of visibleLines) {
        const v = p[l.key];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (min === Infinity) { min = 0; max = 1; }
    const pad = (max - min) * 0.1 || 100;
    return { yMin: Math.min(0, min - pad), yMax: max + pad };
  }, [data, visibleLines]);

  // For BB/100 mode, compute rolling BB/100
  const chartData = useMemo(() => {
    if (yAxisMode === 'bb') return data;

    const window = 5000;
    return data.map((p, i) => {
      let sum = 0, count = 0;
      let cumHands = 0;
      for (let j = i; j >= 0 && cumHands < window; j--) {
        const h = j > 0 ? data[j].hands - data[j - 1].hands : data[0].hands;
        sum += p.total - (j > 0 ? data[j - 1].total : 0);
        cumHands += h;
        count++;
      }
      const rollingTotal = count > 0 ? (sum / cumHands) * 100 : 0;

      let evSum = 0;
      let evCumHands = 0;
      for (let j = i; j >= 0 && evCumHands < window; j--) {
        const h = j > 0 ? data[j].hands - data[j - 1].hands : data[0].hands;
        evSum += p.ev - (j > 0 ? data[j - 1].ev : 0);
        evCumHands += h;
      }
      const rollingEV = evCumHands > 0 ? (evSum / evCumHands) * 100 : 0;

      let sdSum = 0;
      let sdCumHands = 0;
      for (let j = i; j >= 0 && sdCumHands < window; j--) {
        const h = j > 0 ? data[j].hands - data[j - 1].hands : data[0].hands;
        sdSum += p.showdown - (j > 0 ? data[j - 1].showdown : 0);
        sdCumHands += h;
      }
      const rollingSD = sdCumHands > 0 ? (sdSum / sdCumHands) * 100 : 0;

      let nsdSum = 0;
      let nsdCumHands = 0;
      for (let j = i; j >= 0 && nsdCumHands < window; j--) {
        const h = j > 0 ? data[j].hands - data[j - 1].hands : data[0].hands;
        nsdSum += p.nonShowdown - (j > 0 ? data[j - 1].nonShowdown : 0);
        nsdCumHands += h;
      }
      const rollingNSD = nsdCumHands > 0 ? (nsdSum / nsdCumHands) * 100 : 0;

      return {
        ...p,
        total: Math.round(rollingTotal * 10) / 10,
        ev: Math.round(rollingEV * 10) / 10,
        showdown: Math.round(rollingSD * 10) / 10,
        nonShowdown: Math.round(rollingNSD * 10) / 10,
      };
    });
  }, [data, yAxisMode]);

  // Recompute y-range for BB/100 mode
  const { yMin: chartYMin, yMax: chartYMax } = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const p of chartData) {
      for (const l of visibleLines) {
        const v = p[l.key];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (min === Infinity) { min = 0; max = 1; }
    const pad = (max - min) * 0.15 || 5;
    return { yMin: Math.min(0, min - pad), yMax: max + pad };
  }, [chartData, visibleLines]);

  const xScale = useCallback((i: number) => PAD_L + (i / Math.max(1, data.length - 1)) * plotW, [data.length, plotW]);
  const yScale = useCallback((v: number) => PAD_T + (1 - (v - chartYMin) / (chartYMax - chartYMin || 1)) * plotH, [chartYMin, chartYMax, plotH]);

  const buildPath = useCallback((key: LineConfig['key']) => {
    const pts = chartData.map((p, i) => `${xScale(i)},${yScale(p[key])}`);
    return `M ${pts.join(' L ')}`;
  }, [chartData, xScale, yScale]);

  // Y-axis ticks — responsive count
  const yTicks = useMemo(() => {
    const range = chartYMax - chartYMin;
    const targetTicks = isCompact ? 4 : 6;
    const step = niceStep(range, targetTicks);
    const ticks: number[] = [];
    for (let v = Math.ceil(chartYMin / step) * step; v <= chartYMax; v += step) {
      ticks.push(Math.round(v * 10) / 10);
    }
    return ticks;
  }, [chartYMin, chartYMax, isCompact]);

  // X-axis ticks — responsive count
  const xTicks = useMemo(() => {
    const maxHands = data[data.length - 1]?.hands ?? 0;
    if (maxHands === 0) return [];
    const targetTicks = isCompact ? (containerWidth < 350 ? 4 : 5) : 6;
    const step = niceStep(maxHands, targetTicks);
    const ticks: { value: number; label: string }[] = [];
    for (let h = 0; h <= maxHands; h += step) {
      ticks.push({ value: h, label: formatXValue(h) });
    }
    // Ensure last tick
    if (ticks.length > 0 && ticks[ticks.length - 1].value < maxHands) {
      ticks.push({ value: maxHands, label: formatXValue(maxHands) });
    }
    return ticks;
  }, [data, isCompact, containerWidth]);

  // Hover handling
  const handleMouseMove = useCallback((e: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const relX = x - PAD_L;
    const idx = Math.round((relX / plotW) * (data.length - 1));
    if (idx >= 0 && idx < data.length) setHoverIdx(idx);
  }, [data.length, plotW, W]);

  const handleTouch = useCallback((e: TouchEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || e.touches.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.touches[0].clientX - rect.left) / rect.width) * W;
    const relX = x - PAD_L;
    const idx = Math.round((relX / plotW) * (data.length - 1));
    if (idx >= 0 && idx < data.length) setHoverIdx(idx);
  }, [data.length, plotW, W]);

  const hoveredPoint = hoverIdx !== null ? chartData[hoverIdx] : null;
  const hoveredHands = hoverIdx !== null ? data[hoverIdx]?.hands : null;

  const fontSize = isCompact ? 7 : 9;
  const headerClass = isCompact ? 'text-[9px]' : 'text-[11px]';

  return (
    <div
      ref={containerRef}
      className={isCompact ? 'rounded-lg border p-2.5' : 'mt-4 rounded-lg border p-3 sm:p-4'}
      style={{
        borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.12)',
        background: 'rgba(6, 8, 10, 0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02), 0 8px 24px -12px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header + Toggle */}
      <div className={`mb-2 flex flex-wrap items-center justify-between gap-1.5 ${isCompact ? '' : 'gap-2'}`}>
        <div className="flex items-baseline gap-1.5">
          <span className={`font-semibold tracking-wide text-white/50 ${headerClass}`}>Cumulative Results</span>
          {data.length > 0 && (
            <span className={`font-mono text-white/25 ${isCompact ? 'text-[8px]' : 'text-[9px]'}`}>
              {data[data.length - 1]?.hands.toLocaleString() ?? 0} hands
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Y-axis toggle */}
          <div className="flex items-center rounded-md border border-white/[0.08] bg-black/40 p-0.5">
            <button
              onClick={() => setYAxisMode('bb')}
              className={`rounded ${isCompact ? 'px-1.5 py-0.5 text-[7px]' : 'px-2 py-1 text-[9px]'} font-bold tracking-wider uppercase transition-all`}
              style={{ background: yAxisMode === 'bb' ? 'rgba(212,165,44,0.15)' : 'transparent', color: yAxisMode === 'bb' ? GOLD : 'rgba(255,255,255,0.4)' }}
            >BB</button>
            <button
              onClick={() => setYAxisMode('bb100')}
              className={`rounded ${isCompact ? 'px-1.5 py-0.5 text-[7px]' : 'px-2 py-1 text-[9px]'} font-bold tracking-wider uppercase transition-all`}
              style={{ background: yAxisMode === 'bb100' ? 'rgba(212,165,44,0.15)' : 'transparent', color: yAxisMode === 'bb100' ? GOLD : 'rgba(255,255,255,0.4)' }}
            >BB/100</button>
          </div>
        </div>
      </div>

      {/* Legend — compact inline */}
      <div className={`mb-1.5 flex flex-wrap gap-1.5 ${isCompact ? '' : 'gap-2'}`}>
        {LINES.map(l => (
          <button
            key={l.key}
            onClick={() => setVisible(v => ({ ...v, [l.key]: !v[l.key] }))}
            className={`flex items-center gap-1 rounded border ${isCompact ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-1 text-[9px]'} font-medium transition-all`}
            style={{
              borderColor: visible[l.key] ? `${l.color}40` : 'rgba(255,255,255,0.08)',
              opacity: visible[l.key] ? 1 : 0.35,
              color: visible[l.key] ? l.color : 'rgba(255,255,255,0.3)',
            }}
          >
            {l.dashed ? (
              <svg width="10" height="3" className="shrink-0"><line x1="0" y1="1.5" x2="10" y2="1.5" stroke={visible[l.key] ? l.color : 'rgba(255,255,255,0.2)'} strokeWidth="1.5" strokeDasharray="2 1.5" /></svg>
            ) : (
              <span className="h-1.5 w-2 rounded-full" style={{ background: visible[l.key] ? l.color : 'rgba(255,255,255,0.2)' }} />
            )}
            {isCompact ? l.shortLabel : l.label}
          </button>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="relative w-full" style={{ aspectRatio: `${W}/${H}` }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ touchAction: 'none' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchStart={handleTouch}
          onTouchMove={handleTouch}
          onTouchEnd={() => setHoverIdx(null)}
        >
          {/* Gridlines + Y-axis labels */}
          {yTicks.map((v, i) => {
            const y = yScale(v);
            return (
              <g key={i}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                <text x={PAD_L - 4} y={y + 2.5} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={fontSize} fontFamily="monospace">
                  {formatYValue(v, yAxisMode)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {xTicks.map((t, i) => {
            const x = PAD_L + (t.value / (data[data.length - 1]?.hands ?? 1)) * plotW;
            return (
              <text key={i} x={x} y={H - PAD_B + 12} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={fontSize} fontFamily="monospace">
                {t.label}
              </text>
            );
          })}

          {/* Zero line */}
          {chartYMin < 0 && chartYMax > 0 && (
            <line x1={PAD_L} y1={yScale(0)} x2={W - PAD_R} y2={yScale(0)} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 2" />
          )}

          {/* Lines */}
          {visibleLines.map(l => (
            <path
              key={l.key}
              d={buildPath(l.key)}
              fill="none"
              stroke={l.color}
              strokeWidth={isCompact ? l.width * 0.85 : l.width}
              strokeDasharray={l.dashed ? (isCompact ? '3 2' : '5 3') : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={l.key === 'total' ? 1 : 0.85}
            />
          ))}

          {/* Hover crosshair */}
          {hoveredPoint && hoverIdx !== null && (
            <g>
              <line x1={xScale(hoverIdx)} y1={PAD_T} x2={xScale(hoverIdx)} y2={H - PAD_B} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
              {visibleLines.map(l => (
                <circle
                  key={l.key}
                  cx={xScale(hoverIdx)}
                  cy={yScale(hoveredPoint[l.key])}
                  r={isCompact ? 2 : 3}
                  fill={l.color}
                  stroke="rgba(5,4,3,0.92)"
                  strokeWidth="1.5"
                />
              ))}
            </g>
          )}
        </svg>

        {/* Tooltip */}
        {hoveredPoint && hoveredHands !== null && (
          <div
            className="pointer-events-none absolute rounded-lg border p-2 text-[9px] shadow-xl"
            style={{
              borderColor: 'rgba(212,165,44,0.25)',
              background: 'rgba(8,7,6,0.96)',
              left: `${Math.min(82, Math.max(2, (hoverIdx / Math.max(1, data.length - 1)) * 100))}%`,
              top: isCompact ? '4px' : '8px',
              transform: hoverIdx > data.length / 2 ? 'translateX(-100%)' : 'none',
              minWidth: isCompact ? '110px' : '140px',
            }}
          >
            <p className={`mb-1 font-mono tracking-wider text-white/40 uppercase ${isCompact ? 'text-[8px]' : 'text-[9px]'}`}>Hand {hoveredHands.toLocaleString()}</p>
            {visibleLines.map(l => (
              <div key={l.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
                  {isCompact ? l.shortLabel : l.label}
                </span>
                <span className="font-mono font-bold" style={{ color: l.color }}>
                  {hoveredPoint[l.key] >= 0 ? '+' : ''}{yAxisMode === 'bb' ? hoveredPoint[l.key].toLocaleString() : hoveredPoint[l.key].toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Axis labels */}
      <div className={`mt-0.5 flex items-center justify-between font-mono text-white/25 ${isCompact ? 'text-[7px]' : 'text-[8px]'}`}>
        <span>X: Hands</span>
        <span>Y: {yAxisMode === 'bb' ? 'Cumulative BB' : 'Rolling BB/100'}</span>
      </div>
    </div>
  );
}
