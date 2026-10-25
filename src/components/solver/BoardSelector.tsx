import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { CARD_RANKS, CARD_SUITS, SUIT_SYMBOLS, SUIT_COLORS, type SolverBoardCard } from '@/lib/solver/types';

export type PickerTarget = 'flop' | 'turn' | 'river';

interface BoardSelectorProps {
  board: SolverBoardCard[];
  onChange: (board: SolverBoardCard[]) => void;
  /** Which street this selector manages cards for. */
  target: PickerTarget;
  /** When true, the picker popover is open. */
  open: boolean;
  /** Called when the picker should close. */
  onClose: () => void;
  /** Called when this street's cards are fully selected (flop: 3, turn: 4th, river: 5th). */
  onComplete: () => void;
}

const SUIT_ORDER = ['s', 'h', 'd', 'c'] as const;

export function BoardSelector({ board, onChange, target, open, onClose, onComplete }: BoardSelectorProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pendingFlop, setPendingFlop] = useState<SolverBoardCard[]>([]);

  const usedCards = new Set(board.map((c) => `${c.rank}${c.suit}`));

  const isCardUsed = useCallback((rank: string, suit: string) => {
    const id = `${rank}${suit}`;
    if (usedCards.has(id)) return true;
    if (target === 'flop') {
      return pendingFlop.some((c) => `${c.rank}${c.suit}` === id);
    }
    return false;
  }, [usedCards, pendingFlop, target]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the click that opened the picker from immediately closing it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  // Reset pending flop when picker closes or target changes
  useEffect(() => {
    if (!open) setPendingFlop([]);
  }, [open, target]);

  const handleCardClick = (rank: string, suit: 'h' | 'd' | 'c' | 's') => {
    if (isCardUsed(rank, suit)) return;

    if (target === 'flop') {
      const newPending = [...pendingFlop, { rank, suit }];
      setPendingFlop(newPending);

      if (newPending.length === 3) {
        // Replace flop cards (keep turn/river if any)
        const turnRiver = board.slice(3);
        onChange([...newPending, ...turnRiver]);
        setPendingFlop([]);
        onClose();
        onComplete();
      }
    } else if (target === 'turn') {
      // Replace the turn card (index 3), keep flop (0-2) and river (4)
      const flop = board.slice(0, 3);
      const river = board.slice(4);
      onChange([...flop, { rank, suit }, ...river]);
      onClose();
      onComplete();
    } else if (target === 'river') {
      // Replace the river card (index 4), keep flop (0-2) and turn (3)
      const flopTurn = board.slice(0, 4);
      onChange([...flopTurn, { rank, suit }]);
      onClose();
      onComplete();
    }
  };

  if (!open) return null;

  const title = target === 'flop' ? 'Select Flop' : target === 'turn' ? 'Select Turn' : 'Select River';
  const subtitle = target === 'flop'
    ? `Click 3 cards — ${pendingFlop.length}/3 selected`
    : 'Click 1 card';

  // Show pending flop cards in the header
  const previewCards = target === 'flop' ? pendingFlop : [];

  return (
    <>
      {/* Backdrop for click-outside (transparent, doesn't block visual) */}
      <div className="fixed inset-0 z-[99]" />

      {/* Picker popover */}
      <div
        ref={pickerRef}
        className="absolute z-[100] mt-1 w-[280px] rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl"
        style={{ backdropFilter: 'blur(12px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase">{title}</div>
            <div className="text-[9px] text-white/40">{subtitle}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-white/30 transition hover:bg-white/5 hover:text-white/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Pending flop preview */}
        {target === 'flop' && previewCards.length > 0 && (
          <div className="flex justify-center gap-1.5 border-b border-white/[0.04] px-3 py-2">
            {Array.from({ length: 3 }).map((_, i) => {
              const card = previewCards[i];
              if (card) {
                return (
                  <div
                    key={i}
                    className="flex h-12 w-9 items-center justify-center rounded-md border border-[#d4a52c]/30 bg-[#1a1a1a] text-base font-bold shadow-md"
                    style={{ color: SUIT_COLORS[card.suit] }}
                  >
                    {card.rank}{SUIT_SYMBOLS[card.suit]}
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className="flex h-12 w-9 items-center justify-center rounded-md border border-dashed border-white/10 bg-white/[0.02]"
                >
                  <span className="text-[8px] text-white/20">{i + 1}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Card grid — 13 ranks × 4 suits */}
        <div className="p-2">
          {/* Suit headers */}
          <div className="mb-1 flex pl-7">
            {SUIT_ORDER.map((suit) => (
              <div key={suit} className="flex-1 text-center text-[10px] font-bold" style={{ color: SUIT_COLORS[suit] }}>
                {SUIT_SYMBOLS[suit]}
              </div>
            ))}
          </div>

          {/* Rank rows */}
          {CARD_RANKS.map((rank) => (
            <div key={rank} className="mb-0.5 flex items-center">
              <div className="w-6 text-center text-[10px] font-bold text-white/40">{rank}</div>
              <div className="flex flex-1 gap-0.5">
                {SUIT_ORDER.map((suit) => {
                  const used = isCardUsed(rank, suit);
                  return (
                    <button
                      key={suit}
                      disabled={used}
                      onClick={() => handleCardClick(rank, suit)}
                      className={`flex h-8 flex-1 items-center justify-center rounded-md border text-[12px] font-bold transition-all ${
                        used
                          ? 'cursor-not-allowed border-white/5 bg-white/[0.01] opacity-20'
                          : 'border-white/10 bg-[#1a1a1a] hover:border-[#d4a52c]/40 hover:bg-[#222] active:scale-95'
                      }`}
                      style={{ color: used ? '#666' : SUIT_COLORS[suit] }}
                    >
                      {rank}{SUIT_SYMBOLS[suit]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="border-t border-white/[0.04] px-3 py-1.5">
          <p className="text-[8px] text-white/25 text-center">
            {target === 'flop' ? 'Click 3 cards to set the flop' : 'Click 1 card to set the ' + target}
          </p>
        </div>
      </div>
    </>
  );
}

// ============ Board Display Component ============
// Renders the board slots (flop/turn/river) with click-to-open behavior.
// This is used inside NewSolveFlow to display the board and trigger pickers.

interface BoardDisplayProps {
  board: SolverBoardCard[];
  onSlotClick: (target: PickerTarget) => void;
}

export function BoardDisplay({ board, onSlotClick }: BoardDisplayProps) {
  const flop = board.slice(0, 3);
  const turn = board[3];
  const river = board[4];

  const cardStyle = (i: number): React.CSSProperties => ({
    borderColor: i < 3 ? 'rgba(212,165,44,0.25)' : i === 3 ? 'rgba(59,130,246,0.3)' : 'rgba(74,222,128,0.3)',
  });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Flop group */}
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => {
          const card = flop[i];
          if (card) {
            return (
              <button
                key={i}
                onClick={() => onSlotClick('flop')}
                className="flex h-12 w-9 items-center justify-center rounded-md border bg-[#1a1a1a] text-base font-bold shadow-md transition-all hover:border-[#d4a52c]/50 hover:bg-[#222]"
                style={cardStyle(i)}
              >
                <span style={{ color: SUIT_COLORS[card.suit] }}>
                  {card.rank}{SUIT_SYMBOLS[card.suit]}
                </span>
              </button>
            );
          }
          return (
            <button
              key={i}
              onClick={() => onSlotClick('flop')}
              className="flex h-12 w-9 items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.02] transition-all hover:border-[#d4a52c]/40 hover:bg-white/[0.04]"
            >
              <span className="text-[9px] text-white/20">{i === 0 ? 'F' : i === 1 ? 'L' : 'P'}</span>
            </button>
          );
        })}
      </div>

      {/* Turn */}
      {turn ? (
        <button
          onClick={() => onSlotClick('turn')}
          className="flex h-12 w-9 items-center justify-center rounded-md border bg-[#1a1a1a] text-base font-bold shadow-md transition-all hover:border-[#d4a52c]/50 hover:bg-[#222]"
          style={cardStyle(3)}
        >
          <span style={{ color: SUIT_COLORS[turn.suit] }}>
            {turn.rank}{SUIT_SYMBOLS[turn.suit]}
          </span>
        </button>
      ) : (
        board.length >= 3 && (
          <button
            onClick={() => onSlotClick('turn')}
            className="flex h-12 w-9 items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.02] transition-all hover:border-[#3b82f6]/40 hover:bg-white/[0.04]"
          >
            <span className="text-[9px] text-white/20">T</span>
          </button>
        )
      )}

      {/* River */}
      {river ? (
        <button
          onClick={() => onSlotClick('river')}
          className="flex h-12 w-9 items-center justify-center rounded-md border bg-[#1a1a1a] text-base font-bold shadow-md transition-all hover:border-[#d4a52c]/50 hover:bg-[#222]"
          style={cardStyle(4)}
        >
          <span style={{ color: SUIT_COLORS[river.suit] }}>
            {river.rank}{SUIT_SYMBOLS[river.suit]}
          </span>
        </button>
      ) : (
        board.length >= 4 && (
          <button
            onClick={() => onSlotClick('river')}
            className="flex h-12 w-9 items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.02] transition-all hover:border-[#4ade80]/40 hover:bg-white/[0.04]"
          >
            <span className="text-[9px] text-white/20">R</span>
          </button>
        )
      )}
    </div>
  );
}
