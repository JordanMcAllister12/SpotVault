import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, History, Bug } from 'lucide-react';
import { PokerTable } from './PokerTable';
import { useTableScale, NATURAL_SCENE_HEIGHT, TABLE_BOTTOM_GAP } from './useTableScale';
import { PlaybackControls } from './PlaybackControls';
import { buildReplayEvents, computeReplayState, getFirstPlaybackIndex, getPlaybackEvents, getSetupEvents, type ReplayEvent } from './replayEngine';
import type { NormalizedHand, Street, ActionType } from './types';
import { EMPTY_NORMALIZED_HAND } from './types';
import { phase2HandToNormalized, type Phase2HandRecord } from './adapter';
import { AddToBatchButton } from '@/components/player/AddToBatchButton';

const GOLD_DIM = 'rgba(201,162,39,0.35)';

export interface HHReplayerProps {
  hand?: NormalizedHand;
  hands?: NormalizedHand[];
  showAllCards?: boolean;
  mini?: boolean;
  variant?: 'full' | 'embedded' | 'default';
  visualSize?: 'main' | 'student';
  desktopScale?: number;
  fitToContainer?: boolean;
  holeCardScale?: number;
  cardScale?: number;
  onActionChange?: (index: number) => void;
  controlledStep?: number;
  hidePlaybackControls?: boolean;
  standaloneLayout?: boolean;
  leftControls?: ReactNode;
  rightControls?: ReactNode;
}

export function HHReplayer({ hand, hands, showAllCards = false, mini = false, variant = 'full', visualSize, desktopScale = 1, onActionChange, controlledStep, hidePlaybackControls = false, fitToContainer = false, holeCardScale, cardScale, standaloneLayout = false, leftControls, rightControls }: HHReplayerProps) {
  const [handIndex, setHandIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'none' | 'history' | 'info'>('none');
  const [rawHandText, setRawHandText] = useState('');
  const [manualHand, setManualHand] = useState<NormalizedHand | null>(null);
  const [replayerReady, setReplayerReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const animatingRef = useRef(false);

  const handList = useMemo(() => {
    if (manualHand) return [manualHand];
    if (hands && hands.length > 0) return hands;
    if (hand) return [hand];
    return [];
  }, [hand, hands, manualHand]);

  const activeHand = handList[handIndex] ?? EMPTY_NORMALIZED_HAND;
  const hasHand = handList.length > 0 && activeHand.handId !== '';

  const events = useMemo(() => hasHand ? buildReplayEvents(activeHand) : [], [activeHand, hasHand]);

  const firstPlaybackIdx = useMemo(() => getFirstPlaybackIndex(events), [events]);
  const playbackEvents = useMemo(() => getPlaybackEvents(events), [events]);
  const setupEvents = useMemo(() => getSetupEvents(events), [events]);
  const totalPlaybackSteps = playbackEvents.length;
  const isExternallyControlled = controlledStep !== undefined;

  useEffect(() => {
    if (controlledStep !== undefined) setCurrentStep(controlledStep);
  }, [controlledStep]);

  useEffect(() => {
    if (hasHand && firstPlaybackIdx >= 0) {
      setCurrentStep(firstPlaybackIdx - 1);
    } else {
      setCurrentStep(-1);
    }
    setPlaying(false);
  }, [activeHand.handId, firstPlaybackIdx, hasHand]);

  const replayState = useMemo(
    () => hasHand ? computeReplayState(activeHand, events, currentStep) : null,
    [activeHand, events, currentStep, hasHand]
  );

  const { containerRef: tableContainerRef, scale: tableScale, scaledHeight: tableScaledHeight, isMobile: tableIsMobile } = useTableScale<HTMLDivElement>(true, desktopScale, fitToContainer);

  // Gate visibility: show the table when hand data and events are ready.
  // No longer unmount/remount on hand change — PokerTable stays mounted and
  // just receives new props, preventing board card flicker.
  useEffect(() => {
    if (!hasHand) {
      setReplayerReady(false);
      setLoadError(false);
      return;
    }
    if (events.length > 0 && replayState) {
      setReplayerReady(true);
      setLoadError(false);
      return;
    }
    // Still loading events — wait
    if (events.length === 0 && !loadError) {
      setReplayerReady(false);
    }
  }, [hasHand, events.length, replayState, loadError]);

  // Error detection: if hand exists but events are empty after parse, show error
  useEffect(() => {
    if (hasHand && events.length === 0 && !replayerReady) {
      const t = setTimeout(() => {
        if (events.length === 0) setLoadError(true);
      }, 3000);
      return () => clearTimeout(t);
    }
    setLoadError(false);
  }, [hasHand, events.length, replayerReady]);

  const canStepForward = hasHand && currentStep < (events.length > 0 ? events[events.length - 1].index : 0);
  const canStepBack = hasHand && currentStep >= firstPlaybackIdx;

  const step = useCallback((dir: 'back' | 'forward') => {
    if (dir === 'forward') {
      const next = playbackEvents.find(e => e.index > currentStep);
      if (next) {
        setCurrentStep(next.index);
        onActionChange?.(next.index);
      }
    } else {
      const prevEvents = playbackEvents.filter(e => e.index < currentStep);
      if (prevEvents.length > 0) {
        const prev = prevEvents[prevEvents.length - 1];
        setCurrentStep(prev.index);
        onActionChange?.(prev.index);
      } else {
        setCurrentStep(firstPlaybackIdx - 1);
        onActionChange?.(firstPlaybackIdx - 1);
      }
    }
  }, [currentStep, playbackEvents, firstPlaybackIdx, onActionChange]);

  const reset = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    setCurrentStep(firstPlaybackIdx - 1);
    setPlaying(false);
    onActionChange?.(firstPlaybackIdx - 1);
  }, [firstPlaybackIdx, onActionChange]);

  const goEnd = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    const lastIdx = events.length > 0 ? events[events.length - 1].index : 0;
    setCurrentStep(lastIdx);
    setPlaying(false);
    onActionChange?.(lastIdx);
  }, [events, onActionChange]);

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    if (playing) { setPlaying(false); return; }
    const lastIdx = events.length > 0 ? events[events.length - 1].index : 0;
    if (currentStep >= lastIdx) { reset(); return; }
    setPlaying(true);
  }, [playing, currentStep, events, reset]);

  // Autoplay: advance through playback events with pacing
  useEffect(() => {
    if (!playing || isExternallyControlled) return;
    const nextEvent = playbackEvents.find(e => e.index > currentStep);
    if (!nextEvent) { setPlaying(false); return; }
    const delay = ['deal_flop', 'deal_turn', 'deal_river', 'collect_chips', 'showdown_reveal', 'pot_award', 'hand_complete'].includes(nextEvent.type)
      ? 1000 : 800;
    const t = setTimeout(() => step('forward'), delay);
    return () => clearTimeout(t);
  }, [playing, currentStep, playbackEvents, step, isExternallyControlled]);

  const loadRawHand = useCallback(() => {
    if (!rawHandText.trim()) return;
    try {
      const fakeRecord: Phase2HandRecord = {
        hand_id: 'MANUAL-' + Date.now(),
        site: 'manual',
        game_mode: 'cash',
        tournament_id: null,
        played_at: new Date().toISOString(),
        blinds: '',
        position: null,
        hero_name: 'Hero',
        hero_cards: null,
        board: null,
        action_sequence: [],
        pot_amount: 0,
        net_result: 0,
        showdown: false,
        raw_hand_text: rawHandText,
      };
      const normalized = phase2HandToNormalized(fakeRecord);
      setManualHand(normalized);
      setHandIndex(0);
    } catch (err) {
      console.error('[HHReplayer] Failed to parse raw hand text:', err);
      setManualHand(null);
    }
  }, [rawHandText]);

  const clearRawHand = useCallback(() => {
    setRawHandText('');
    setManualHand(null);
  }, []);

  const selectHand = useCallback((i: number) => {
    setHandIndex(i);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step('back'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step('forward'); }
      else if (e.key === 'Home') { e.preventDefault(); reset(); }
      else if (e.key === 'End') { e.preventDefault(); goEnd(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, step, reset, goEnd]);

  const streetLabel = replayState?.street ?? 'preflop';
  const STREET_DISPLAY: Record<string, string> = {
    preflop: 'PREFLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN',
  };
  const streetDisplay = replayState?.isComplete ? 'RESULT' : STREET_DISPLAY[streetLabel] ?? streetLabel.toUpperCase();

  const currentPlaybackIdx = playbackEvents.findIndex(e => e.index === currentStep);
  const stepNum = currentPlaybackIdx < 0 ? 'Start' : `${currentPlaybackIdx + 1} / ${totalPlaybackSteps}`;

  const GOLD = '#d4a52c';

  const isEmbedded = variant === 'embedded';

  return (
    <div className={`hh-replayer-root${standaloneLayout ? ' hh-standalone-flow' : ''}`} style={{ display: 'flex', flexDirection: 'column', width: '100%', ...(standaloneLayout ? { minHeight: '100%' } : { height: '100%' }) }}>
      {/* Mobile panel toggle bar — only on narrow screens */}
      {!isEmbedded && (
        <div className="flex items-center gap-1 px-2 py-1 md:hidden" style={{ background: 'rgba(8,6,14,0.95)', borderBottom: '1px solid rgba(52,56,72,0.5)' }}>
          <button onClick={() => setMobilePanel(mobilePanel === 'history' ? 'none' : 'history')} className={`flex-1 rounded-md border px-2 py-1.5 text-[10px] font-bold ${mobilePanel === 'history' ? 'border-[#d4a52c]/40 bg-[#d4a52c]/10 text-[#f5e6b0]' : 'border-white/10 bg-white/[0.02] text-white/50'}`}>History</button>
          <button onClick={() => setMobilePanel(mobilePanel === 'info' ? 'none' : 'info')} className={`flex-1 rounded-md border px-2 py-1.5 text-[10px] font-bold ${mobilePanel === 'info' ? 'border-[#d4a52c]/40 bg-[#d4a52c]/10 text-[#f5e6b0]' : 'border-white/10 bg-white/[0.02] text-white/50'}`}>Info</button>
        </div>
      )}

      {/* Main replayer area with collapsible side panels */}
      <div className="hh-replayer-main" style={{ display: 'flex', flex: standaloneLayout ? '0 0 auto' : 1, minHeight: standaloneLayout ? undefined : 0, gap: 0, position: 'relative' }}>
        {/* Left panel — Action History (desktop only) */}
        {!isEmbedded && (
          <div className="hidden md:flex" style={{ flexShrink: 0 }}>
            <button
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 24, flexShrink: 0,
                background: 'rgba(12,10,18,0.95)',
                border: 'none', borderRight: '1px solid rgba(52,56,72,0.5)',
                color: leftPanelOpen ? '#d4a52c' : 'rgba(156,163,175,0.5)',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
              title={leftPanelOpen ? 'Collapse action history' : 'Expand action history'}
            >
              {leftPanelOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>

            <div style={{
              width: leftPanelOpen ? 260 : 0,
              flexShrink: 0,
              overflow: 'hidden',
              transition: 'width 0.3s ease',
              background: 'rgba(8,6,14,0.98)',
              borderRight: leftPanelOpen ? '1px solid rgba(52,56,72,0.5)' : 'none',
            }}>
              <ReplayerLeftPanel
                debugMode={debugMode}
                setDebugMode={setDebugMode}
                rawHandText={rawHandText}
                setRawHandText={setRawHandText}
                loadRawHand={loadRawHand}
                clearRawHand={clearRawHand}
                hasHand={hasHand}
                activeHand={activeHand}
                events={events}
                setupEvents={setupEvents}
                playbackEvents={playbackEvents}
                currentStep={currentStep}
                onJump={(idx) => { setCurrentStep(idx); onActionChange?.(idx); setPlaying(false); }}
                historyOpen={historyOpen}
                setHistoryOpen={setHistoryOpen}
              />
            </div>
          </div>
        )}

        {/* Center — Poker table */}
        <div className="hh-replayer-center flex flex-col" style={{ flex: 1, minWidth: 0 }}>
          <div
            ref={tableContainerRef}
            className="hh-table-container"
            style={{
              overflow: 'visible',
              display: 'flex',
              alignItems: tableIsMobile ? 'flex-start' : 'flex-end',
              justifyContent: 'center',
              width: '100%',
              boxSizing: 'border-box',
              flex: standaloneLayout ? '0 0 auto' : '1 1 auto',
              minHeight: standaloneLayout ? `${(tableScaledHeight || NATURAL_SCENE_HEIGHT) + (tableIsMobile ? 8 : TABLE_BOTTOM_GAP)}px` : 0,
              padding: `${tableIsMobile ? 0 : 0} 2px ${tableIsMobile ? 8 : TABLE_BOTTOM_GAP}px`,
              ...(fitToContainer
                ? { minHeight: 0 }
                : tableScaledHeight > 0
                  ? { height: `${tableScaledHeight + (tableIsMobile ? 8 : TABLE_BOTTOM_GAP)}px` }
                  : { minHeight: `${(hasHand ? NATURAL_SCENE_HEIGHT : 200) + (tableIsMobile ? 8 : TABLE_BOTTOM_GAP)}px` }),
            }}
          >
            {/* Loading state — clean placeholder, no partial table */}
            {hasHand && !replayerReady && !loadError && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: tableIsMobile ? (tableScaledHeight || 300) : NATURAL_SCENE_HEIGHT, gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2.5px solid rgba(212,165,44,0.2)', borderTopColor: '#d4a52c', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em' }}>Loading hand...</span>
              </div>
            )}
            {/* Error state */}
            {hasHand && loadError && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: isEmbedded ? 200 : 400, gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af' }}>Unable to load hand.</span>
                <button
                  onClick={() => { setLoadError(false); setReplayerReady(false); }}
                  style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.1)', color: '#f5e6b0', fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                >Retry</button>
              </div>
            )}
            {/* No hand state */}
            {!hasHand && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: isEmbedded ? 200 : 400, gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>No hand loaded</span>
                <span style={{ fontSize: 10, color: '#4b5563' }}>Select a hand to begin playback</span>
              </div>
            )}
            {/* Fully ready replayer — only visible when replayerReady */}
            {hasHand && replayerReady && !loadError && (
              (tableIsMobile || desktopScale !== 1 || fitToContainer) ? (
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'visible', alignItems: 'flex-start' }}>
                <div
                  className="hh-scale-wrapper"
                  style={{
                    width: 720 * tableScale,
                    height: tableScaledHeight,
                    flexShrink: 0,
                    position: 'relative',
                    overflow: 'visible',
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, width: 720, transformOrigin: 'left top', transform: `scale(${tableScale})` }}>
                    <PokerTable
                      hand={activeHand}
                      replayState={replayState}
                      showAllCards={showAllCards}
                      mini={mini}
                      variant={variant}
                      visualSize={visualSize}
                      holeCardScale={holeCardScale}
                      cardScale={cardScale}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <PokerTable
                hand={activeHand}
                replayState={replayState}
                showAllCards={showAllCards}
                mini={mini}
                variant={variant}
                visualSize={visualSize}
                holeCardScale={holeCardScale}
                cardScale={cardScale}
              />
            )
            )}
          </div>

          {/* Street + Step info bar — reserve space during loading */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '2px 0 0', flexShrink: 0, height: 20 }}>
            {hasHand && (
              <>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: replayState?.isComplete ? GOLD : '#9ca3af' }}>
                  {streetDisplay}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>{'\u2022'}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>
                  Step {stepNum}
                </span>
              </>
            )}
          </div>

          {/* Hand navigation (multi-hand only) */}
          {handList.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 0, flexShrink: 0 }}>
              <button type="button" onClick={(e) => { e.preventDefault(); selectHand(Math.max(0, handIndex - 1)); }} disabled={handIndex === 0}
                style={sideBtnStyle(handIndex === 0)} title="Previous hand">
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>
                Hand {handIndex + 1} / {handList.length}
              </span>
              <button type="button" onClick={(e) => { e.preventDefault(); selectHand(Math.min(handList.length - 1, handIndex + 1)); }} disabled={handIndex === handList.length - 1}
                style={sideBtnStyle(handIndex === handList.length - 1)} title="Next hand">
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {!standaloneLayout && !hidePlaybackControls && <div style={{ flexShrink: 0, position: 'relative', zIndex: 50, marginTop: 4 }}>
            {/* Mobile: recording controls on their own row, playback controls centered below */}
            <div className="flex flex-col gap-1 md:hidden" style={{ background: 'rgba(8,6,14,0.95)', borderTop: '1px solid rgba(52,56,72,0.35)', borderRadius: 8, padding: '4px 0' }}>
              {leftControls && <div className="flex items-center justify-center gap-1.5">{leftControls}</div>}
              <div className="flex items-center justify-center gap-2 px-2">
                <div className="flex-1" />
                <PlaybackControls
                  hasHand={hasHand}
                  playing={playing}
                  canStepBack={canStepBack}
                  canStepForward={canStepForward}
                  onReset={reset}
                  onStepBack={() => step('back')}
                  onTogglePlay={togglePlay}
                  onStepForward={() => step('forward')}
                  onGoEnd={goEnd}
                />
                <div className="flex-1" />
              </div>
              {rightControls && <div className="flex items-center justify-center gap-1.5">{rightControls}</div>}
            </div>
            {/* Desktop: single inline row */}
            <div className="hidden md:flex items-center gap-2 px-2" style={{ padding: '2px 0' }}>
              {leftControls && <div className="flex items-center gap-1.5">{leftControls}</div>}
              <div className="flex-1">
                <PlaybackControls
                  hasHand={hasHand}
                  playing={playing}
                  canStepBack={canStepBack}
                  canStepForward={canStepForward}
                  onReset={reset}
                  onStepBack={() => step('back')}
                  onTogglePlay={togglePlay}
                  onStepForward={() => step('forward')}
                  onGoEnd={goEnd}
                />
              </div>
              {rightControls && <div className="flex items-center gap-1.5">{rightControls}</div>}
            </div>
          </div>}
        </div>

        {/* Right panel — Hand info (desktop only, collapsible) */}
        {!isEmbedded && hasHand && (
          <div className="hidden md:flex" style={{ flexShrink: 0 }}>
            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 24, flexShrink: 0,
                background: 'rgba(12,10,18,0.95)',
                border: 'none', borderLeft: '1px solid rgba(52,56,72,0.5)',
                color: rightPanelOpen ? '#d4a52c' : 'rgba(156,163,175,0.5)',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
              title={rightPanelOpen ? 'Collapse hand info' : 'Expand hand info'}
            >
              {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>

            <div style={{
              width: rightPanelOpen ? 220 : 0,
              flexShrink: 0,
              overflow: 'hidden',
              transition: 'width 0.3s ease',
              background: 'rgba(8,6,14,0.98)',
              borderLeft: rightPanelOpen ? '1px solid rgba(52,56,72,0.5)' : 'none',
            }}>
              <HandInfoPanel hand={activeHand} replayState={replayState} debugMode={debugMode} />
            </div>
          </div>
        )}

        {/* Mobile bottom-sheet panels for history and info */}
        {!isEmbedded && mobilePanel !== 'none' && (
          <div className="absolute inset-0 z-40 flex flex-col md:hidden" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setMobilePanel('none')}>
            <div className="mt-auto max-h-[60%] overflow-y-auto rounded-t-2xl" style={{ background: 'rgba(8,6,14,0.99)', borderTop: '1px solid rgba(201,162,39,0.3)' }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                <span className="text-[11px] font-bold tracking-wider text-[#d4a52c]">{mobilePanel === 'history' ? 'ACTION HISTORY' : 'HAND INFO'}</span>
                <button onClick={() => setMobilePanel('none')} className="text-white/40 hover:text-white/70">✕</button>
              </div>
              {mobilePanel === 'history' ? (
                <ReplayerLeftPanel
                  debugMode={debugMode}
                  setDebugMode={setDebugMode}
                  rawHandText={rawHandText}
                  setRawHandText={setRawHandText}
                  loadRawHand={loadRawHand}
                  clearRawHand={clearRawHand}
                  hasHand={hasHand}
                  activeHand={activeHand}
                  events={events}
                  setupEvents={setupEvents}
                  playbackEvents={playbackEvents}
                  currentStep={currentStep}
                  onJump={(idx) => { setCurrentStep(idx); onActionChange?.(idx); setPlaying(false); setMobilePanel('none'); }}
                  historyOpen={historyOpen}
                  setHistoryOpen={setHistoryOpen}
                />
              ) : (
                <HandInfoPanel hand={activeHand} replayState={replayState} debugMode={debugMode} />
              )}
            </div>
          </div>
        )}
      </div>

      {standaloneLayout && !hidePlaybackControls && (
        <div className="hh-standalone-playback-controls" style={{ paddingTop: 16, paddingBottom: 16, borderTop: '1px solid rgba(52,56,72,0.35)' }}>
          <PlaybackControls
            hasHand={hasHand}
            playing={playing}
            canStepBack={canStepBack}
            canStepForward={canStepForward}
            onReset={reset}
            onStepBack={() => step('back')}
            onTogglePlay={togglePlay}
            onStepForward={() => step('forward')}
            onGoEnd={goEnd}
          />
        </div>
      )}
    </div>
  );
}

// ── Replayer Left Panel (shared between desktop and mobile) ──

function ReplayerLeftPanel({
  debugMode, setDebugMode, rawHandText, setRawHandText, loadRawHand, clearRawHand,
  hasHand, activeHand, events, setupEvents, playbackEvents, currentStep, onJump, historyOpen, setHistoryOpen,
}: {
  debugMode: boolean; setDebugMode: (v: boolean) => void; rawHandText: string; setRawHandText: (v: string) => void;
  loadRawHand: () => void; clearRawHand: () => void; hasHand: boolean; activeHand: NormalizedHand;
  events: ReplayEvent[]; setupEvents: ReplayEvent[]; playbackEvents: ReplayEvent[]; currentStep: number;
  onJump: (idx: number) => void; historyOpen: boolean; setHistoryOpen: (v: boolean) => void;
}) {
  return (
    <>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(52,56,72,0.5)' }}>
        <button
          onClick={() => setDebugMode(!debugMode)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: debugMode ? 'rgba(201,162,39,0.15)' : 'none',
            border: `1px solid ${debugMode ? 'rgba(201,162,39,0.4)' : 'rgba(52,56,72,0.5)'}`,
            borderRadius: 5, padding: '4px 8px', cursor: 'pointer',
            color: debugMode ? '#d4a52c' : '#6b7280', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.08em', width: '100%',
          }}
        >
          <Bug size={11} /> DEBUG MODE {debugMode ? 'ON' : 'OFF'}
        </button>
        {debugMode && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#6b7280', marginBottom: 4, letterSpacing: '0.1em' }}>PASTE RAW HAND TEXT</div>
            <textarea
              value={rawHandText}
              onChange={(e) => setRawHandText(e.target.value)}
              placeholder="Paste a raw PokerStars hand history here..."
              style={{
                width: '100%', height: 80, fontSize: 8, fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.4)', color: '#9ca3af', border: '1px solid rgba(52,56,72,0.5)',
                borderRadius: 4, padding: 4, resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <button onClick={loadRawHand} style={{ flex: 1, padding: '4px', fontSize: 9, fontWeight: 700, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 4, color: '#4ade80', cursor: 'pointer' }}>LOAD HAND</button>
              <button onClick={clearRawHand} style={{ flex: 1, padding: '4px', fontSize: 9, fontWeight: 700, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 4, color: '#f87171', cursor: 'pointer' }}>CLEAR</button>
            </div>
          </div>
        )}
      </div>
      {debugMode && hasHand && (
        <DebugSeatMap hand={activeHand} />
      )}
      <ActionHistoryPanel
        events={events}
        setupEvents={setupEvents}
        playbackEvents={playbackEvents}
        currentStep={currentStep}
        onJump={onJump}
        hand={activeHand}
        historyOpen={historyOpen}
        setHistoryOpen={setHistoryOpen}
      />
    </>
  );
}

// ── Debug Seat Map ──

function DebugSeatMap({ hand }: { hand: NormalizedHand }) {
  const heroIndex = hand.players.findIndex(p => p.isHero);
  const base = heroIndex >= 0 ? heroIndex : 0;
  const ordered = hand.players.length > 0 ? [...hand.players.slice(base), ...hand.players.slice(0, base)] : hand.players;

  return (
    <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(52,56,72,0.5)' }}>
      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', color: '#d4a52c', marginBottom: 4 }}>SEAT MAP DEBUG</div>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
        Button Seat: {hand.buttonSeat}
      </div>
      <table style={{ width: '100%', fontSize: 8, fontFamily: 'monospace', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: '#6b7280', textAlign: 'left', borderBottom: '1px solid rgba(52,56,72,0.3)' }}>
            <th style={{ padding: '2px 4px' }}>Player</th>
            <th style={{ padding: '2px 4px' }}>Raw</th>
            <th style={{ padding: '2px 4px' }}>Vis</th>
            <th style={{ padding: '2px 4px' }}>Pos</th>
          </tr>
        </thead>
        <tbody>
          {hand.players.map((p, i) => {
            const visIdx = ordered.findIndex(op => op.name === p.name);
            const isBtn = p.seat === hand.buttonSeat;
            return (
              <tr key={i} style={{ color: isBtn ? '#f5e17a' : p.isHero ? '#4ade80' : '#9ca3af', borderBottom: '1px solid rgba(52,56,72,0.15)' }}>
                <td style={{ padding: '2px 4px' }}>{shortName(p.name)}{p.isHero ? ' (H)' : ''}</td>
                <td style={{ padding: '2px 4px' }}>{p.seat}</td>
                <td style={{ padding: '2px 4px' }}>{visIdx >= 0 ? visIdx : '—'}</td>
                <td style={{ padding: '2px 4px', fontWeight: 700 }}>{p.position ?? '—'}{isBtn ? ' ★' : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Action History Panel ──

function ActionHistoryPanel({ events, setupEvents, playbackEvents, currentStep, onJump, hand, historyOpen, setHistoryOpen }: {
  events: ReplayEvent[];
  setupEvents: ReplayEvent[];
  playbackEvents: ReplayEvent[];
  currentStep: number;
  onJump: (idx: number) => void;
  hand: NormalizedHand;
  historyOpen: boolean;
  setHistoryOpen: (v: boolean) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentPlaybackIdx = playbackEvents.findIndex(e => e.index === currentStep);

  useEffect(() => {
    if (!scrollRef.current || currentPlaybackIdx < 0) return;
    const el = scrollRef.current.querySelector(`[data-event-idx="${currentStep}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentStep, currentPlaybackIdx]);

  // Group events by street
  const STREET_LABEL: Record<string, string> = { preflop: 'PREFLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN' };
  const streetGroups: { street: string; label: string; events: ReplayEvent[] }[] = [];
  let currentGroup: { street: string; label: string; events: ReplayEvent[] } | null = null;

  for (const e of events) {
    if (e.type === 'hand_start' || e.type === 'hand_complete') continue;
    const streetKey = e.street;
    if (!currentGroup || currentGroup.street !== streetKey) {
      currentGroup = { street: streetKey, label: STREET_LABEL[streetKey] ?? streetKey.toUpperCase(), events: [] };
      streetGroups.push(currentGroup);
    }
    currentGroup.events.push(e);
  }

  const ACTION_CLR: Record<string, string> = {
    fold: '#f87171', check: '#9ca3af', call: '#34d399', bet: '#d4a827', raise: '#fb923c', allin: '#fca5a5',
    post_sb: '#6b7280', post_bb: '#6b7280', post_ante: '#555568', post_blinds: '#6b7280',
    collect: '#c9a227', show: '#60a5fa', muck: '#555568', win: '#c9a227', uncalled_return: '#9ca3af',
  };

  function eventText(e: ReplayEvent): string {
    const name = e.player ? shortName(e.player) : '';
    const amt = e.amount != null ? e.amount.toLocaleString() : '';
    switch (e.type) {
      case 'post_blinds':
        return e.label;
      case 'action':
        switch (e.actionType) {
          case 'fold': return `${name} Fold`;
          case 'check': return `${name} Check`;
          case 'call': return `${name} Call ${amt}`;
          case 'bet': return `${name} Bet ${amt}`;
          case 'raise': return `${name} Raise ${amt}`;
          case 'allin': return `${name} All-In ${amt}`;
          default: return `${name} ${e.actionType}`;
        }
      case 'deal_flop': return `FLOP [${e.cards?.join(' ') ?? ''}]`;
      case 'deal_turn': return `TURN [${e.cards?.join(' ') ?? ''}]`;
      case 'deal_river': return `RIVER [${e.cards?.join(' ') ?? ''}]`;
      case 'collect_chips': return 'Chips collected to pot';
      case 'showdown_reveal': return `${name} ${e.actionType === 'muck' ? 'Mucks' : 'Shows'}`;
      case 'uncalled_return': return `${name} Uncalled ${amt}`;
      case 'pot_award': return `${name} Wins ${amt}`;
      default: return e.label;
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(52,56,72,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <History size={14} style={{ color: '#d4a52c' }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#d4a52c' }}>ACTION HISTORY</span>
        </div>
        <button onClick={() => setHistoryOpen(!historyOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(156,163,175,0.5)', padding: 2 }}>
          <ChevronRight size={14} style={{ transform: historyOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>
      </div>

      {/* Scrollable history */}
      {historyOpen && (
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {/* Setup events (blinds/antes) */}
          {setupEvents.length > 0 && (
            <div style={{ padding: '0 12px 4px' }}>
              <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(156,163,175,0.4)', marginBottom: 4 }}>BLINDS</div>
              {setupEvents.map(e => (
                <div key={`setup-${e.index}`} style={{ fontSize: 10, color: 'rgba(156,163,175,0.5)', padding: '2px 0' }}>
                  {eventText(e)}
                </div>
              ))}
            </div>
          )}

          {/* Playback events grouped by street */}
          {streetGroups.map((group, gi) => (
            <div key={`group-${gi}`} style={{ padding: '4px 12px' }}>
              <div style={{
                fontSize: 8, fontWeight: 800, letterSpacing: '0.15em',
                color: group.street === 'flop' ? '#34d399' : group.street === 'turn' ? '#f59e0b' : group.street === 'river' ? '#fb923c' : group.street === 'showdown' ? '#d4af37' : 'rgba(156,163,175,0.5)',
                marginBottom: 4, marginTop: 6,
                paddingBottom: 2, borderBottom: '1px solid rgba(52,56,72,0.3)',
              }}>{group.label}</div>
              {group.events.map(e => {
                const isCurrent = e.index === currentStep;
                const isPast = e.index < currentStep;
                const clr = e.actionType ? ACTION_CLR[e.actionType] ?? '#9ca3af' : '#9ca3af';
                const player = hand.players.find(p => p.name === e.player);
                const posLabel = player?.position ?? '';
                return (
                  <div
                    key={e.index}
                    data-event-idx={e.index}
                    onClick={() => onJump(e.index)}
                    style={{
                      fontSize: 10, padding: '3px 6px', borderRadius: 4, cursor: 'pointer',
                      color: isCurrent ? '#fff' : isPast ? clr : 'rgba(156,163,175,0.45)',
                      background: isCurrent ? 'rgba(201,162,39,0.15)' : 'transparent',
                      border: isCurrent ? '1px solid rgba(201,162,39,0.4)' : '1px solid transparent',
                      fontWeight: isCurrent ? 700 : 400,
                      transition: 'all 0.15s ease',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {posLabel && <span style={{ fontSize: 8, fontWeight: 800, color: 'rgba(156,163,175,0.5)', minWidth: 28 }}>{posLabel}</span>}
                    <span>{eventText(e)}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hand Info Panel ──

function HandInfoPanel({ hand, replayState, debugMode }: { hand: NormalizedHand; replayState: any; debugMode?: boolean }) {
  return (
    <div style={{ padding: '12px', height: '100%', overflowY: 'auto' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#d4a52c', marginBottom: 10 }}>HAND INFO</div>

      <div style={{ marginBottom: 10 }}>
        <AddToBatchButton handId={hand.handId} variant="inline" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <InfoRow label="Stakes" value={hand.stakes} />
        <InfoRow label="Game" value={hand.gameType} />
        <InfoRow label="Date" value={hand.date} />
        <InfoRow label="Table" value={hand.tableName} />
        <InfoRow label="Players" value={`${hand.players.length}`} />
        <InfoRow label="Button Seat" value={`${hand.buttonSeat}`} />
        <InfoRow label="Central Pot" value={(replayState?.centralPot ?? 0).toLocaleString()} />
        <InfoRow label="Street Bets" value={Object.values(replayState?.currentStreetBets ?? {}).reduce((a: number, b: number) => a + b, 0).toLocaleString()} />
        <InfoRow label="Total Pot" value={(replayState?.pot ?? 0).toLocaleString()} />
      </div>

      {hand.players.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#d4a52c', margin: '14px 0 8px' }}>PLAYERS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {hand.players.map((p, i) => {
              const rp = replayState?.players?.find((sp: any) => sp.name === p.name);
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderBottom: '1px solid rgba(52,56,72,0.3)' }}>
                  <span style={{ color: p.isHero ? '#4ade80' : '#8a96a4' }}>
                    {p.position ?? '—'} {p.isHero ? '(Hero)' : ''}
                  </span>
                  <span style={{ fontFamily: 'monospace', color: rp?.folded ? '#555568' : '#dde2e8' }}>
                    {(rp?.currentStack ?? p.stack).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {debugMode && hand.actions.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#d4a52c', margin: '14px 0 8px' }}>REPLAY TIMELINE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {hand.actions.map((a, i) => (
              <div key={i} style={{ fontSize: 8, fontFamily: 'monospace', color: '#6b7280', padding: '1px 0' }}>
                <span style={{ color: '#4a90d9', fontWeight: 700 }}>{a.index}.</span>{' '}
                <span style={{ color: '#9ca3af' }}>{a.street}</span>{' '}
                <span style={{ color: '#dde2e8' }}>{shortName(a.player)}</span>{' '}
                <span style={{ color: a.type === 'fold' ? '#f87171' : a.type === 'raise' ? '#fb923c' : a.type === 'bet' ? '#d4a827' : a.type === 'call' ? '#34d399' : '#6b7280', fontWeight: 700 }}>{a.type}</span>
                {a.amount != null ? ` ${a.amount.toLocaleString()}` : ''}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
      <span style={{ color: 'rgba(156,163,175,0.5)' }}>{label}</span>
      <span style={{ color: '#dde2e8', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function shortName(name: string): string {
  if (/^[a-f0-9]{6,}$/i.test(name)) return name.slice(0, 6);
  return name;
}

function sideBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 40, height: 40, borderRadius: 10,
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${GOLD_DIM}`,
    color: disabled ? 'rgba(156,163,175,0.4)' : '#d4a52c',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'opacity 0.2s ease, transform 0.2s ease',
  };
}
