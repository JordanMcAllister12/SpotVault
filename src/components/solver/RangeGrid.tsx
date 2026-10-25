import { useState, useCallback, useRef } from 'react';
import { CARD_RANKS, HAND_CELLS, type RangeData } from '@/lib/solver/types';
import { rangePercent } from '@/lib/solver/types';

interface RangeGridProps {
  range: RangeData;
  onChange: (range: RangeData) => void;
  title?: string;
  compact?: boolean;
  readOnly?: boolean;
  // For results display: show strategy frequencies per hand
  strategyByHand?: Record<string, { label: string; frequency: number; color: string }[]>;
  onHandClick?: (hand: string) => void;
  selectedHand?: string | null;
}

export function RangeGrid({
  range,
  onChange,
  title,
  compact = false,
  readOnly = false,
  strategyByHand,
  onHandClick,
  selectedHand,
}: RangeGridProps) {
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null);
  const isDragging = useRef(false);

  const cellSize = compact ? 'h-5 w-5 text-[7px]' : 'h-7 w-7 text-[8px] sm:h-9 sm:w-9 sm:text-[9px]';
  const gap = compact ? 'gap-px' : 'gap-0.5';

  const setCell = useCallback((hand: string, weight: number) => {
    if (readOnly) return;
    onChange({ cells: { ...range.cells, [hand]: weight } });
  }, [range, onChange, readOnly]);

  const handleCellDown = useCallback((hand: string, e: React.MouseEvent) => {
    if (readOnly) {
      onHandClick?.(hand);
      return;
    }
    e.preventDefault();
    isDragging.current = true;
    const current = range.cells[hand] ?? 0;
    const newWeight = current > 0 ? 0 : 1;
    setDragMode(newWeight > 0 ? 'add' : 'remove');
    setCell(hand, newWeight);
  }, [range.cells, readOnly, setCell, onHandClick]);

  const handleCellEnter = useCallback((hand: string) => {
    if (readOnly || !isDragging.current || !dragMode) return;
    setCell(hand, dragMode === 'add' ? 1 : 0);
  }, [readOnly, dragMode, setCell]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    setDragMode(null);
  }, []);

  const selectAll = () => {
    if (readOnly) return;
    const cells: Record<string, number> = {};
    for (const h of HAND_CELLS) cells[h] = 1;
    onChange({ cells });
  };

  const clearAll = () => {
    if (readOnly) return;
    const cells: Record<string, number> = {};
    for (const h of HAND_CELLS) cells[h] = 0;
    onChange({ cells });
  };

  const pct = rangePercent(range);

  return (
    <div className="select-none" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-[0.2em] text-[#c0911e]/70 uppercase">{title}</span>
          {!readOnly && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/40">{pct.toFixed(1)}%</span>
              <button onClick={selectAll} className="rounded border border-white/10 px-1.5 py-0.5 text-[8px] text-white/50 hover:bg-white/5 hover:text-white/80">All</button>
              <button onClick={clearAll} className="rounded border border-white/10 px-1.5 py-0.5 text-[8px] text-white/50 hover:bg-white/5 hover:text-white/80">Clear</button>
            </div>
          )}
          {readOnly && <span className="text-[10px] font-mono text-white/40">{pct.toFixed(1)}%</span>}
        </div>
      )}
      <div className={`flex flex-col ${gap}`}>
        {CARD_RANKS.map((rowRank, i) => (
          <div key={i} className={`flex ${gap}`}>
            {CARD_RANKS.map((colRank, j) => {
              let hand: string;
              if (i === j) hand = `${rowRank}${rowRank}`;
              else if (i < j) hand = `${rowRank}${colRank}s`;
              else hand = `${colRank}${rowRank}o`;

              const weight = range.cells[hand] ?? 0;
              const isSelected = selectedHand === hand;
              const strategy = strategyByHand?.[hand];

              let bg = 'bg-white/[0.02]';
              let opacity = 0.3;

              if (strategy && strategy.length > 0) {
                // Strategy mode: show mixed colors based on action frequencies
                const dominant = strategy.reduce((max, s) => s.frequency > max.frequency ? s : max, strategy[0]);
                bg = '';
                opacity = 1;
                return (
                  <div
                    key={hand}
                    onClick={() => onHandClick?.(hand)}
                    className={`${cellSize} flex cursor-pointer items-center justify-center rounded-[2px] border text-center font-mono font-bold leading-none transition-all ${
                      isSelected ? 'ring-1 ring-[#d4a52c] ring-offset-1 ring-offset-[#0a0c0e]' : ''
                    }`}
                    style={{
                      background: dominant.color,
                      opacity: 0.3 + dominant.frequency * 0.7,
                      color: dominant.frequency > 0.5 ? '#0a0c0e' : 'rgba(255,255,255,0.7)',
                      borderColor: 'rgba(255,255,255,0.08)',
                    }}
                  >
                    {hand}
                  </div>
                );
              }

              if (weight > 0) {
                opacity = 0.3 + weight * 0.7;
                bg = 'bg-[#d4a52c]';
              }

              return (
                <div
                  key={hand}
                  onMouseDown={(e) => handleCellDown(hand, e)}
                  onMouseEnter={() => handleCellEnter(hand)}
                  onClick={() => readOnly && onHandClick?.(hand)}
                  className={`${cellSize} flex items-center justify-center rounded-[2px] border text-center font-mono font-bold leading-none transition-all ${
                    readOnly ? 'cursor-pointer' : 'cursor-pointer'
                  } ${weight > 0 ? 'text-[#0a0c0e]' : 'text-white/30'} ${isSelected ? 'ring-1 ring-[#d4a52c]' : ''}`}
                  style={{
                    background: weight > 0 ? `rgba(212,165,44,${opacity})` : 'rgba(255,255,255,0.02)',
                    borderColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  {hand}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
