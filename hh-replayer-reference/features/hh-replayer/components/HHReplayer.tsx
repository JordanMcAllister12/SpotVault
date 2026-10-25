import React, { useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw } from 'lucide-react';
import { PokerTable, EMPTY_HAND } from '../../../components/PokerTable';
import { normalizedToParsedHand } from '../adapters/spotVaultAdapter';
import type { NormalizedHand } from '../types/NormalizedHand';
import { EMPTY_NORMALIZED_HAND } from '../types/NormalizedHand';

export interface HHReplayerProps {
  /** A single normalized hand to replay. */
  hand?: NormalizedHand;
  /** Multiple hands for navigation. If provided, takes priority over `hand`. */
  hands?: NormalizedHand[];
  /** Show all hole cards (broadcast/demo mode). */
  showAllCards?: boolean;
  /** Compact mode for inline embedding. */
  compact?: boolean;
  /** Mini mode — smaller cards/seats for analytics previews. */
  mini?: boolean;
  /** Mobile layout. */
  mobile?: boolean;
  /** Variant: 'full' for the main replayer, 'embedded' for inline previews. */
  variant?: 'full' | 'embedded' | 'default';
  /** Called when the user changes the action index. */
  onActionChange?: (index: number) => void;
}

export function HHReplayer({
  hand,
  hands,
  showAllCards = false,
  compact = false,
  mini = false,
  mobile = false,
  variant = 'default',
  onActionChange,
}: HHReplayerProps) {
  const handList = useMemo(() => {
    if (hands && hands.length > 0) return hands;
    if (hand) return [hand];
    return [];
  }, [hand, hands]);

  const [handIndex, setHandIndex] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [internalShowAllCards, setInternalShowAllCards] = useState(showAllCards);

  const activeHand = handList[handIndex] ?? EMPTY_NORMALIZED_HAND;
  const parsedHand = useMemo(
    () => (activeHand === EMPTY_NORMALIZED_HAND ? EMPTY_HAND : normalizedToParsedHand(activeHand)),
    [activeHand],
  );

  const maxIdx = parsedHand.actions.length - 1;
  const realActions = parsedHand.actions.filter((a) => !['post_ante', 'post_sb', 'post_bb'].includes(a.type));
  const nextRealIdx = realActions.findIndex((a) => a.index > currentIdx);
  const prevRealIdx = [...realActions].reverse().findIndex((a) => a.index < currentIdx);

  const step = useCallback(
    (dir: 'back' | 'forward') => {
      if (dir === 'forward') {
        const next = realActions.find((a) => a.index > currentIdx);
        if (next) { setCurrentIdx(next.index); onActionChange?.(next.index); }
      } else {
        const prev = [...realActions].reverse().find((a) => a.index < currentIdx);
        if (prev) { setCurrentIdx(prev.index); onActionChange?.(prev.index); }
        else { setCurrentIdx(-1); onActionChange?.(-1); }
      }
    },
    [currentIdx, realActions, onActionChange],
  );

  const reset = useCallback(() => {
    setCurrentIdx(-1);
    setPlaying(false);
    onActionChange?.(-1);
  }, [onActionChange]);

  const togglePlay = useCallback(() => {
    if (playing) { setPlaying(false); return; }
    if (nextRealIdx === -1) { reset(); return; }
    setPlaying(true);
  }, [playing, nextRealIdx, reset]);

  // Auto-play timer
  React.useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (nextRealIdx === -1) { setPlaying(false); return; }
      step('forward');
    }, 900);
    return () => clearTimeout(t);
  }, [playing, nextRealIdx, step]);

  const selectHand = useCallback((i: number) => {
    setHandIndex(i);
    setCurrentIdx(-1);
    setPlaying(false);
  }, []);

  const currentStreet = parsedHand.actions.find((a) => a.index === currentIdx)?.street ?? 'preflop';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <PokerTable
        hand={parsedHand}
        currentActionIndex={currentIdx}
        showAllCards={internalShowAllCards}
        compact={compact}
        mini={mini}
        mobile={mobile}
        variant={variant}
      />

      {/* Playback controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 0' }}>
        {handList.length > 1 && (
          <button
            onClick={() => selectHand(Math.max(0, handIndex - 1))}
            disabled={handIndex === 0}
            style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', opacity: handIndex === 0 ? 0.3 : 1 }}
          >
            <ChevronLeft size={16} />
          </button>
        )}

        <button onClick={reset} disabled={currentIdx === -1} style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', opacity: currentIdx === -1 ? 0.3 : 1 }}>
          <RotateCcw size={14} />
        </button>

        <button onClick={() => step('back')} disabled={prevRealIdx === -1} style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', opacity: prevRealIdx === -1 ? 0.3 : 1 }}>
          <ChevronLeft size={16} />
        </button>

        <button onClick={togglePlay} disabled={nextRealIdx === -1} style={{ padding: '8px 14px', borderRadius: 10, cursor: 'pointer', opacity: nextRealIdx === -1 ? 0.3 : 1 }}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <button onClick={() => step('forward')} disabled={nextRealIdx === -1} style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', opacity: nextRealIdx === -1 ? 0.3 : 1 }}>
          <ChevronRight size={16} />
        </button>

        {handList.length > 1 && (
          <button
            onClick={() => selectHand(Math.min(handList.length - 1, handIndex + 1))}
            disabled={handIndex === handList.length - 1}
            style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', opacity: handIndex === handList.length - 1 ? 0.3 : 1 }}
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Hand counter */}
      {handList.length > 1 && (
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>
          Hand {handIndex + 1} of {handList.length}
        </div>
      )}
    </div>
  );
}
