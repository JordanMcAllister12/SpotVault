import { SkipBack, SkipForward, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';

const GOLD = '#d4a52c';
const GOLD_BRIGHT = '#f5e6b0';
const GOLD_BORDER = 'rgba(212,175,55,0.7)';
const GOLD_BORDER_DIM = 'rgba(212,175,55,0.25)';
const GOLD_BG = 'rgba(212,175,55,0.08)';

export interface PlaybackControlsProps {
  hasHand: boolean;
  playing: boolean;
  canStepBack: boolean;
  canStepForward: boolean;
  onReset: () => void;
  onStepBack: () => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onGoEnd: () => void;
}

export function PlaybackControls({
  hasHand,
  playing,
  canStepBack,
  canStepForward,
  onReset,
  onStepBack,
  onTogglePlay,
  onStepForward,
  onGoEnd,
}: PlaybackControlsProps) {
  const resetDisabled = !hasHand;
  const stepBackDisabled = !hasHand || !canStepBack;
  const stepFwdDisabled = !hasHand || !canStepForward;
  const goEndDisabled = !hasHand;

  return (
    <>
      {/* Mobile: compact inline controls */}
      <div className="flex md:hidden items-center justify-center gap-2"
        style={{
          padding: '8px 12px',
          background: 'rgba(8,6,4,0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 12,
          border: `1px solid ${GOLD_BORDER_DIM}`,
        }}
      >
        <button type="button" onClick={onReset} disabled={resetDisabled}
          style={mobileBtnStyle(resetDisabled)} title="Jump to start">
          <SkipBack size={16} />
        </button>
        <button type="button" onClick={onStepBack} disabled={stepBackDisabled}
          style={mobileBtnStyle(stepBackDisabled)} title="Previous step">
          <ChevronLeft size={18} />
        </button>
        <button type="button" onClick={onTogglePlay} disabled={!hasHand}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: 12,
            background: playing ? 'linear-gradient(135deg, rgba(220,50,50,0.9), rgba(180,20,20,0.95))' : `linear-gradient(135deg, ${GOLD}, #b8961e)`,
            border: 'none',
            boxShadow: playing ? '0 2px 12px rgba(220,50,50,0.35)' : '0 2px 12px rgba(212,165,44,0.3)',
            cursor: hasHand ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
          }}
          title={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={20} color="#fff" /> : <Play size={20} color="#1a1200" style={{ marginLeft: 2 }} />}
        </button>
        <button type="button" onClick={onStepForward} disabled={stepFwdDisabled}
          style={mobileBtnStyle(stepFwdDisabled)} title="Next step">
          <ChevronRight size={18} />
        </button>
        <button type="button" onClick={onGoEnd} disabled={goEndDisabled}
          style={mobileBtnStyle(goEndDisabled)} title="Jump to end">
          <SkipForward size={16} />
        </button>
      </div>

      {/* Desktop: full controls with styled glass panel */}
      <div className="hidden md:flex" style={{
        alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '10px 18px', marginTop: 4,
        background: 'rgba(8,6,4,0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: 14,
        border: `1px solid ${GOLD_BORDER_DIM}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        position: 'relative', zIndex: 50,
      }}>
        <button type="button" onClick={onReset} disabled={resetDisabled}
          style={sideBtnStyle(resetDisabled)} title="Jump to start (Home)"
          onMouseEnter={(e) => { if (!resetDisabled) e.currentTarget.style.borderColor = GOLD_BORDER; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = resetDisabled ? GOLD_BORDER_DIM : 'rgba(212,175,55,0.5)'; }}
        >
          <SkipBack size={16} />
        </button>
        <button type="button" onClick={onStepBack} disabled={stepBackDisabled}
          style={sideBtnStyle(stepBackDisabled)} title="Previous step (Left Arrow)"
          onMouseEnter={(e) => { if (!stepBackDisabled) e.currentTarget.style.borderColor = GOLD_BORDER; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = stepBackDisabled ? GOLD_BORDER_DIM : 'rgba(212,175,55,0.5)'; }}
        >
          <ChevronLeft size={20} />
        </button>
        <button type="button" onClick={onTogglePlay} disabled={!hasHand}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16,
            background: playing ? 'linear-gradient(135deg, rgba(220,50,50,0.9), rgba(180,20,20,0.95))' : `linear-gradient(135deg, ${GOLD}, #b8961e)`,
            border: 'none',
            boxShadow: playing ? '0 4px 20px rgba(220,50,50,0.4)' : '0 4px 20px rgba(212,165,44,0.35)',
            cursor: hasHand ? 'pointer' : 'default',
            opacity: 1,
            transition: 'all 0.2s ease',
            transform: 'scale(1)',
          }}
          onMouseEnter={(e) => { if (hasHand) e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          title={playing ? 'Pause (Space)' : 'Play (Space)'}>
          {playing ? <Pause size={24} color="#fff" /> : <Play size={24} color="#1a1200" style={{ marginLeft: 3 }} />}
        </button>
        <button type="button" onClick={onStepForward} disabled={stepFwdDisabled}
          style={sideBtnStyle(stepFwdDisabled)} title="Next step (Right Arrow)"
          onMouseEnter={(e) => { if (!stepFwdDisabled) e.currentTarget.style.borderColor = GOLD_BORDER; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = stepFwdDisabled ? GOLD_BORDER_DIM : 'rgba(212,175,55,0.5)'; }}
        >
          <ChevronRight size={20} />
        </button>
        <button type="button" onClick={onGoEnd} disabled={goEndDisabled}
          style={sideBtnStyle(goEndDisabled)} title="Jump to end (End)"
          onMouseEnter={(e) => { if (!goEndDisabled) e.currentTarget.style.borderColor = GOLD_BORDER; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = goEndDisabled ? GOLD_BORDER_DIM : 'rgba(212,175,55,0.5)'; }}
        >
          <SkipForward size={16} />
        </button>
      </div>
    </>
  );
}

function mobileBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 9,
    background: disabled ? 'rgba(10,8,6,0.6)' : GOLD_BG,
    border: `1px solid ${disabled ? GOLD_BORDER_DIM : 'rgba(212,175,55,0.5)'}`,
    color: disabled ? 'rgba(245,230,176,0.3)' : GOLD_BRIGHT,
    cursor: disabled ? 'default' : 'pointer',
    opacity: 1,
    boxShadow: disabled ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 4px rgba(212,165,44,0.1)',
    transition: 'opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease',
  };
}

function sideBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 40, height: 40, borderRadius: 10,
    background: disabled ? 'rgba(10,8,6,0.6)' : GOLD_BG,
    border: `1px solid ${disabled ? GOLD_BORDER_DIM : 'rgba(212,175,55,0.5)'}`,
    color: disabled ? 'rgba(245,230,176,0.3)' : GOLD_BRIGHT,
    cursor: disabled ? 'default' : 'pointer',
    opacity: 1,
    boxShadow: disabled ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 4px rgba(212,165,44,0.1)',
    transition: 'opacity 0.2s ease, transform 0.2s ease, background 0.2s ease, border-color 0.2s ease',
  };
}
