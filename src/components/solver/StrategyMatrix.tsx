import { useState, useRef, useEffect } from 'react';
import { CARD_RANKS, HAND_CELLS, type RangeData } from '@/lib/solver/types';
import type { NodeStrategy } from '@/lib/solver/nodeStrategy';

interface StrategyMatrixProps {
  strategy: NodeStrategy | null;
  range?: RangeData;
  onCellClick?: (hand: string) => void;
  selectedHand?: string | null;
  noDataMessage?: string;
}

// ---- Neon action colors (R G B tuples for dynamic CSS) ----
const FLUOR = {
  fold:    { hex: '#00aaff', rgb: '0,170,255' },
  call:    { hex: '#00ff7f', rgb: '0,255,127' },
  raise:   { hex: '#ff0033', rgb: '255,0,51' },
  'all-in':{ hex: '#cc1144', rgb: '204,17,68' },
  check:   { hex: '#7a8499', rgb: '122,132,153' },
  bet:     { hex: '#e8a838', rgb: '232,168,56' },
} as const;

type FluorKey = keyof typeof FLUOR;

function fluorFor(action: string): { hex: string; rgb: string } {
  if (action in FLUOR) return FLUOR[action as FluorKey];
  return FLUOR.fold;
}

// ---- Tile style builder ----
interface Seg { action: string; frequency: number; }

function buildTileStyle(
  segs: Seg[],
  isHovered: boolean,
  _isSelected: boolean,
): React.CSSProperties {
  if (segs.length === 0) {
    return {
      background: isHovered ? 'rgba(28,30,34,0.75)' : 'rgba(18,20,24,0.55)',
    };
  }

  if (segs.length === 1) {
    const c = fluorFor(segs[0].action);
    const freq = segs[0].frequency;
    const hoverBoost = isHovered ? 0.18 : 0;
    const core = Math.min(0.92, 0.55 + freq * 0.35 + hoverBoost);
    const mid = Math.min(0.65, 0.30 + freq * 0.20 + hoverBoost * 0.6);
    const edge = 0.06 + hoverBoost * 0.3;
    const innerGlow = 0.45 + hoverBoost;
    const outerGlow = 0.20 + hoverBoost * 0.5;
    const outerSize = isHovered ? '6px' : '3px';
    const innerSize = isHovered ? '5px' : '3px';
    return {
      background: `radial-gradient(ellipse at 50% 45%, rgba(${c.rgb},${core}) 0%, rgba(${c.rgb},${mid}) 40%, rgba(${c.rgb},${edge}) 75%, rgba(10,11,14,0.95) 100%)`,
      boxShadow: `inset 0 0 ${innerSize} 2px rgba(${c.rgb},${innerGlow}), inset 0 1px 3px rgba(0,0,0,0.6), 0 0 ${outerSize} 1px rgba(${c.rgb},${outerGlow})`,
      border: `1px solid rgba(${c.rgb},${0.25 + (isHovered ? 0.15 : 0)})`,
    };
  }

  const hoverBoost = isHovered ? 0.18 : 0;
  const coreOpacity = 0.60 + hoverBoost;
  const midOpacity = 0.35 + hoverBoost * 0.5;

  const stops: string[] = [];
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const c = fluorFor(seg.action);
    const start = acc * 100;
    acc += seg.frequency;
    const end = acc * 100;
    const transitionWidth = 3;
    const softStart = Math.max(0, start - (i > 0 ? transitionWidth : 0));
    const softEnd = Math.min(100, end + (i < segs.length - 1 ? transitionWidth : 0));
    const segMid = (start + end) / 2;
    stops.push(`rgba(${c.rgb},${midOpacity}) ${softStart}%`);
    stops.push(`rgba(${c.rgb},${coreOpacity}) ${segMid}%`);
    stops.push(`rgba(${c.rgb},${midOpacity}) ${softEnd}%`);
  }

  const dominant = segs.reduce((max, s) => (s.frequency > max.frequency ? s : max), segs[0]);
  const dc = fluorFor(dominant.action);
  const innerGlow = 0.35 + hoverBoost;
  const outerGlow = 0.15 + hoverBoost * 0.4;
  const outerSize = isHovered ? '5px' : '3px';
  const innerSize = isHovered ? '4px' : '3px';

  return {
    background: `linear-gradient(to right, ${stops.join(', ')}), radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.08) 0%, transparent 50%)`,
    boxShadow: `inset 0 0 ${innerSize} 2px rgba(${dc.rgb},${innerGlow}), inset 0 1px 3px rgba(0,0,0,0.6), 0 0 ${outerSize} 1px rgba(${dc.rgb},${outerGlow})`,
    border: `1px solid rgba(${dc.rgb},${0.20 + (isHovered ? 0.12 : 0)})`,
  };
}

function buildEmptyStyle(isHovered: boolean): React.CSSProperties {
  return {
    background: isHovered ? 'rgba(28,30,34,0.75)' : 'rgba(18,20,24,0.55)',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.03)',
  };
}

export function StrategyMatrix({
  strategy,
  range,
  onCellClick,
  selectedHand,
  noDataMessage,
}: StrategyMatrixProps) {
  const [hoveredHand, setHoveredHand] = useState<string | null>(null);
  const hasStrategy = strategy !== null;

  // Measure available height to compute grid size that fits all 13 rows
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setGridSize(Math.min(w, h));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gridPixelSize = gridSize > 0 ? gridSize : 0;

  return (
    <div className="flex h-full w-full flex-col items-center">
      <div
        ref={containerRef}
        className="relative flex w-full flex-1 items-center justify-center overflow-hidden"
        style={{ minHeight: 0 }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(13, 1fr)',
            gridTemplateRows: 'repeat(13, 1fr)',
            gap: '2px',
            background: '#000',
            padding: '4px',
            borderRadius: '6px',
            boxShadow: 'inset 0 0 12px rgba(0,0,0,0.8), 0 2px 12px rgba(0,0,0,0.5), 0 0 20px rgba(0,0,0,0.3)',
            width: gridPixelSize > 0 ? `${gridPixelSize}px` : '100%',
            height: gridPixelSize > 0 ? `${gridPixelSize}px` : 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: '1 / 1',
          }}
        >
          {CARD_RANKS.map((rowRank, i) =>
            CARD_RANKS.map((colRank, j) => {
              let hand: string;
              if (i === j) hand = `${rowRank}${rowRank}`;
              else if (i < j) hand = `${rowRank}${colRank}s`;
              else hand = `${colRank}${rowRank}o`;

              const isSelected = selectedHand === hand;
              const isHovered = hoveredHand === hand;

              if (hasStrategy) {
                const handStrategy = strategy?.strategy_by_hand[hand];
                if (handStrategy && handStrategy.length > 0) {
                  const segs = handStrategy
                    .filter((s) => s.frequency > 0.005)
                    .map((s) => ({ action: s.action, frequency: s.frequency }));
                  const tileStyle = buildTileStyle(segs, isHovered, isSelected);

                  return (
                    <div
                      key={hand}
                      onClick={() => onCellClick?.(hand)}
                      onMouseEnter={() => setHoveredHand(hand)}
                      onMouseLeave={() => setHoveredHand(null)}
                      className="relative w-full h-full cursor-pointer overflow-hidden transition-all duration-100"
                      style={{
                        ...tileStyle,
                        borderRadius: '2px',
                        outline: isSelected ? '2px solid #d4a52c' : 'none',
                        outlineOffset: '-2px',
                        zIndex: isSelected ? 10 : 1,
                      }}
                      title={segs.map((s) => `${s.action}: ${(s.frequency * 100).toFixed(0)}%`).join(' · ')}
                    >
                      <span
                        className="absolute inset-0 flex items-center justify-center font-bold leading-none"
                        style={{
                          fontSize: 'clamp(7px, min(1.2vw, 1.4dvh), 14px)',
                          color: 'rgba(255,255,255,0.98)',
                          textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.8)',
                        }}
                      >
                        {hand}
                      </span>
                    </div>
                  );
                }
              }

              // No strategy — show empty grid cells with hand labels
              const rangeWeight = range?.cells[hand] ?? 0;
              const hasWeight = rangeWeight > 0;
              const emptyStyle = hasWeight
                ? {
                    background: `radial-gradient(ellipse at center, rgba(212,165,44,${0.3 + rangeWeight * 0.5}) 0%, rgba(212,165,44,${0.1 + rangeWeight * 0.2}) 50%, rgba(14,15,18,0.92) 100%)`,
                    boxShadow: `inset 0 0 2px 1px rgba(212,165,44,${0.15 + rangeWeight * 0.2}), inset 0 1px 2px rgba(0,0,0,0.5)`,
                    border: '1px solid rgba(212,165,44,0.1)',
                    borderRadius: '2px',
                  }
                : { ...buildEmptyStyle(isHovered), borderRadius: '2px' };

              return (
                <div
                  key={hand}
                  onClick={() => onCellClick?.(hand)}
                  onMouseEnter={() => setHoveredHand(hand)}
                  onMouseLeave={() => setHoveredHand(null)}
                  className="relative w-full h-full cursor-pointer overflow-hidden transition-all duration-100"
                  style={{
                    ...emptyStyle,
                    outline: isSelected ? '2px solid #d4a52c' : 'none',
                    outlineOffset: '-2px',
                    zIndex: isSelected ? 10 : 1,
                  }}
                >
                  <span
                    className="absolute inset-0 flex items-center justify-center font-bold leading-none"
                    style={{
                      fontSize: 'clamp(7px, min(1.2vw, 1.4dvh), 14px)',
                      color: hasWeight ? 'rgba(255,255,255,0.98)' : 'rgba(220,215,205,0.25)',
                      textShadow: hasWeight ? '0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)' : 'none',
                    }}
                  >
                    {hand}
                  </span>
                </div>
              );
            }),
          )}
        </div>

        {/* No-data overlay — rendered on top of the grid, inside the grid area only */}
        {!hasStrategy && noDataMessage && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <p className="text-[13px] font-semibold text-white/40">{noDataMessage}</p>
            {strategy === null && (
              <p className="text-[10px] text-white/25">Reference data can be added or solved later with DeepSolver.</p>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      {hasStrategy && strategy && strategy.available_actions.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {strategy.available_actions.map((act, i) => {
            const c = fluorFor(act.action);
            return (
              <div key={i} className="flex items-center gap-1.5 rounded-[3px] border border-white/[0.06] bg-white/[0.02] px-2 py-0.5">
                <div
                  className="h-2.5 w-2.5 rounded-[1px]"
                  style={{
                    background: `radial-gradient(ellipse at center, ${c.hex} 0%, rgba(14,15,18,0.9) 100%)`,
                    boxShadow: `inset 0 0 2px 1px rgba(${c.rgb},0.5), 0 0 4px 1px rgba(${c.rgb},0.3)`,
                  }}
                />
                <span className="text-[9px] font-mono uppercase tracking-wide text-white/45">{act.label}</span>
              </div>
            );
          })}
          {strategy.source === 'reference' && (
            <span className="text-[8px] font-mono text-[#4ade80]/40 italic">REFERENCE DATA</span>
          )}
          {strategy.source === 'deepsolver' && (
            <span className="text-[8px] font-mono text-[#3b82f6]/40 italic">DEEPSOLVER</span>
          )}
        </div>
      )}
    </div>
  );
}
