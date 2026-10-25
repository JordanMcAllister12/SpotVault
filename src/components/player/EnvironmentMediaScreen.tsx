import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Tv, Play, Pause, Volume2, VolumeX, Maximize2, Minimize2,
  ChevronUp, Radio, Sparkles, Clock, Power,
} from 'lucide-react';
import {
  IDLE_ROTATION, formatDuration,
  type MediaItem,
} from '@/data/mediaLibrary';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

export type ScreenState = 'off' | 'standard' | 'expanded' | 'fullscreen';

interface Props {
  /** External "play on TV" trigger from Media Center. */
  externalPlayItem?: MediaItem | null;
  onExternalPlayConsumed?: () => void;
  /** Whether this environment has a TV. Default true. */
  enabled?: boolean;
  /** Called when the user powers off the screen from the TV's own controls. */
  onPowerOff?: () => void;
}

export function EnvironmentMediaScreen({
  externalPlayItem,
  onExternalPlayConsumed,
  enabled = true,
  onPowerOff,
}: Props) {
  const [screenState, setScreenState] = useState<ScreenState>('standard');
  const [current, setCurrent] = useState<MediaItem | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [progress, setProgress] = useState(0);
  const [idleIndex, setIdleIndex] = useState(0);
  const [idleMode, setIdleMode] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const progressTimer = useRef<number | null>(null);
  const controlsTimeout = useRef<number | null>(null);

  // Idle rotation when on but nothing playing
  useEffect(() => {
    if (screenState === 'off') return;
    if (current && playing) return;
    setIdleMode(true);
    const t = setInterval(() => {
      setIdleIndex((i) => (i + 1) % IDLE_ROTATION.length);
    }, 5000);
    return () => clearInterval(t);
  }, [screenState, current, playing]);

  // Progress timer
  useEffect(() => {
    if (!playing || !current || current.duration === null) return;
    progressTimer.current = window.setInterval(() => {
      setProgress((p) => {
        const next = p + 100 / current.duration!;
        if (next >= 100) {
          setPlaying(false);
          setCurrent(null);
          setProgress(0);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [playing, current]);

  // External play trigger
  useEffect(() => {
    if (externalPlayItem && enabled) {
      setCurrent(externalPlayItem);
      setIdleMode(false);
      setProgress(0);
      setPlaying(true);
      setScreenState((s) => (s === 'off' ? 'standard' : s));
      onExternalPlayConsumed?.();
    }
  }, [externalPlayItem, enabled]);

  const turnOff = useCallback(() => {
    setScreenState('off');
    setPlaying(false);
    setCurrent(null);
    setProgress(0);
    setIdleMode(false);
    onPowerOff?.();
  }, [onPowerOff]);

  const togglePlay = () => {
    if (!current) return;
    setPlaying((p) => !p);
  };

  const cycleSize = () => {
    setScreenState((s) => {
      if (s === 'standard') return 'expanded';
      if (s === 'expanded') return 'fullscreen';
      return 'standard';
    });
  };

  const showControls = () => {
    setControlsVisible(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = window.setTimeout(() => setControlsVisible(false), 3000);
  };

  if (!enabled || screenState === 'off') return null;

  const displayed = idleMode ? IDLE_ROTATION[idleIndex] : current;
  const isSponsored = displayed?.contentType === 'sponsored';
  const isLive = displayed?.duration === null;

  // Fullscreen overlay
  if (screenState === 'fullscreen') {
    return (
      <div
        className="fixed inset-0 z-[2000] flex items-center justify-center bg-black animate-fade-in"
        onMouseMove={showControls}
        onMouseLeave={() => setControlsVisible(false)}
      >
        <FlatScreen
          item={displayed}
          idle={idleMode}
          progress={progress}
          playing={playing}
          muted={muted}
          volume={volume}
          controlsVisible={controlsVisible}
          onTogglePlay={togglePlay}
          onToggleMute={() => setMuted((m) => !m)}
          onVolume={setVolume}
          onCycleSize={() => setScreenState('expanded')}
          onPowerOff={turnOff}
          fullscreen
        />
      </div>
    );
  }

  // In-room positioned screen — percentage-based, anchored to the wall
  const widthPct = screenState === 'expanded' ? 52 : 38;

  return (
    <div
      className="absolute z-[55] transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        left: '50%',
        top: '14%',
        transform: 'translateX(-50%)',
        width: `${widthPct}`,
        maxWidth: screenState === 'expanded' ? 1100 : 760,
      }}
      onMouseMove={showControls}
      onMouseLeave={() => setControlsVisible(false)}
    >
      <FlatScreen
        item={displayed}
        idle={idleMode}
        progress={progress}
        playing={playing}
        muted={muted}
        volume={volume}
        controlsVisible={controlsVisible}
        onTogglePlay={togglePlay}
        onToggleMute={() => setMuted((m) => !m)}
        onVolume={setVolume}
        onCycleSize={cycleSize}
        onPowerOff={turnOff}
      />
    </div>
  );
}

// ===== The physical flat screen =====
function FlatScreen({
  item,
  idle,
  progress,
  playing,
  muted,
  volume,
  controlsVisible,
  onTogglePlay,
  onToggleMute,
  onVolume,
  onCycleSize,
  onPowerOff,
  fullscreen,
}: {
  item: MediaItem | null;
  idle: boolean;
  progress: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  controlsVisible: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolume: (v: number) => void;
  onCycleSize: () => void;
  onPowerOff: () => void;
  fullscreen?: boolean;
}) {
  const isSponsored = item?.contentType === 'sponsored';
  const isLive = item?.duration === null;

  return (
    <div
      className="relative aspect-video w-full"
      style={{
        borderRadius: 4,
        background: '#000',
        boxShadow: '0 0 0 2px #0a0a0a, 0 0 0 4px #1a1a1a, 0 30px 80px -20px rgba(0,0,0,0.9), 0 12px 40px -10px rgba(0,0,0,0.7)',
      }}
    >
      {/* Bezel */}
      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 3, border: '2px solid #0c0c0c' }}>

        {/* Screen surface */}
        <div className="relative h-full w-full overflow-hidden bg-black">
          {/* Content backdrop */}
          <div
            className="absolute inset-0 transition-all duration-700"
            style={{
              background: item
                ? `radial-gradient(ellipse at 30% 40%, ${item.accent}22, transparent 60%), radial-gradient(ellipse at 70% 80%, ${item.accent}10, transparent 50%), linear-gradient(135deg, #0a0c0e, #050608)`
                : 'linear-gradient(135deg, #0a0c0e, #050608)',
            }}
          />

          {/* Scanline texture */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px)',
            }}
          />

          {/* Glass reflection (top-left light) */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.02) 100%)',
            }}
          />

          {/* Badges */}
          {idle && (
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 backdrop-blur-sm">
              <Sparkles className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
              <span className="text-[8px] font-semibold tracking-widest text-white/50 uppercase">Idle Rotation</span>
            </div>
          )}
          {isSponsored && (
            <div className="absolute right-3 top-3 rounded border border-[#5f8fb3]/30 bg-[#5f8fb3]/10 px-2 py-0.5 backdrop-blur-sm">
              <span className="text-[7px] font-bold tracking-widest text-[#9bc4e0] uppercase">Sponsored</span>
            </div>
          )}
          {isLive && (
            <div className="absolute left-3 top-3 flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 backdrop-blur-sm">
              <Radio className="h-2.5 w-2.5 text-red-400" strokeWidth={2} />
              <span className="text-[7px] font-bold tracking-widest text-red-300 uppercase">Live</span>
            </div>
          )}

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            {item ? (
              <>
                <div
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border"
                  style={{ borderColor: `${item.accent}40`, background: `${item.accent}15` }}
                >
                  <Play className="h-5 w-5" style={{ color: item.accent }} strokeWidth={1.5} />
                </div>
                <p className="text-[8px] font-mono tracking-[0.2em] uppercase" style={{ color: item.accent }}>
                  {item.category}
                </p>
                <h3 className="mt-1.5 max-w-md text-sm font-bold leading-tight text-white">{item.title}</h3>
                <p className="mt-1 text-[10px] text-white/40">{item.creator}</p>
                {fullscreen && (
                  <p className="mt-3 max-w-sm text-[10px] leading-relaxed text-white/35">{item.description}</p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/25">
                <Tv className="h-7 w-7" strokeWidth={1} />
                <p className="text-[10px] tracking-wide">Select content from Media Center</p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {item && !idle && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
              <div className="h-full transition-all" style={{ width: `${progress}%`, background: item.accent }} />
            </div>
          )}

          {/* Hover controls — fade in/out */}
          <div
            className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 py-2 transition-opacity duration-300"
            style={{
              opacity: controlsVisible ? 1 : 0,
              background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
              pointerEvents: controlsVisible ? 'auto' : 'none',
            }}
          >
            <button
              onClick={onTogglePlay}
              className="flex h-6 w-6 items-center justify-center rounded text-white/70 transition-colors hover:text-white"
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Play className="h-3.5 w-3.5" strokeWidth={1.5} />}
            </button>
            <button
              onClick={onToggleMute}
              className="flex h-6 w-6 items-center justify-center rounded text-white/70 transition-colors hover:text-white"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Volume2 className="h-3.5 w-3.5" strokeWidth={1.5} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => { onVolume(parseFloat(e.target.value)); if (muted) onToggleMute(); }}
              className="h-1 w-12 cursor-pointer accent-[#d4a52c]"
              aria-label="Volume"
            />
            {item && (
              <span className="flex items-center gap-1 text-[8px] font-mono text-white/35">
                <Clock className="h-2.5 w-2.5" strokeWidth={1.5} />
                {formatDuration(item.duration)}
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={onCycleSize}
              className="flex h-6 w-6 items-center justify-center rounded text-white/70 transition-colors hover:text-white"
              title={fullscreen ? 'Shrink' : 'Expand'}
            >
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />}
            </button>
            <button
              onClick={onPowerOff}
              className="flex h-6 w-6 items-center justify-center rounded text-white/70 transition-colors hover:text-red-400"
              title="Power off"
            >
              <Power className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Trigger button — exported so the parent places it in room chrome =====
export function MediaScreenTrigger({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex h-7 w-7 items-center justify-center rounded-md border transition-all hover:scale-105"
      style={{
        borderColor: on ? 'rgba(212,165,44,0.45)' : 'rgba(255,255,255,0.08)',
        background: on ? 'rgba(212,165,44,0.12)' : 'rgba(255,255,255,0.03)',
        color: on ? GOLD_SOFT : 'rgba(255,255,255,0.4)',
        backdropFilter: 'blur(10px)',
      }}
      title={on ? 'Turn off media screen' : 'Turn on media screen'}
    >
      <Tv className="h-3.5 w-3.5" strokeWidth={1.5} />
    </button>
  );
}
