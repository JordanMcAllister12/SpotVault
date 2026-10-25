import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { GOLD } from '@/components/ui/industry';

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface AudioPlayerProps {
  url: string;
  label?: string;
}

export function CompactAudioPlayer({ url, label }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setReady(false);
  }, [url]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  const seek = (value: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = value;
    setCurrent(value);
  };

  const toggleMute = () => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggle}
          disabled={!ready}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d4a52c] text-black transition hover:brightness-110 disabled:opacity-30"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
        </button>

        <div className="min-w-0 flex-1">
          {label && (
            <div className="mb-0.5 truncate text-[10px] font-semibold text-white/55">{label}</div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.1)}
              step="0.01"
              value={Math.min(current, duration || 0)}
              onChange={(e) => seek(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer accent-[#d4a52c]"
              aria-label="Seek"
            />
            <span className="shrink-0 font-mono text-[9px] text-white/35">
              {formatTime(current)} / {formatTime(duration)}
            </span>
          </div>
        </div>

        <button
          onClick={toggleMute}
          className="shrink-0 rounded p-1 text-white/40 hover:text-white/70"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration || 0); setReady(true); }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}

interface VideoPlayerProps {
  url: string;
  label?: string;
}

export function CompactVideoPlayer({ url, label }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setReady(false);
    setError(false);
  }, [url]);

  const toggle = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  const seek = (value: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = value;
    setCurrent(value);
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-black/30">
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          src={url}
          preload="metadata"
          playsInline
          className="h-full w-full object-contain"
          onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration || 0); setReady(true); }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setError(true)}
        />
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50">
            <span className="text-[10px] font-semibold text-white/50">Video unavailable</span>
          </div>
        )}
        {!playing && ready && !error && (
          <button
            onClick={toggle}
            className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/20"
            aria-label="Play video"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d4a52c]/90 text-black">
              <Play className="ml-1 h-5 w-5" />
            </div>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <button
          onClick={toggle}
          disabled={!ready}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d4a52c] text-black transition hover:brightness-110 disabled:opacity-30"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="h-3 w-3" /> : <Play className="ml-0.5 h-3 w-3" />}
        </button>
        {label && <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-white/55">{label}</span>}
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0.1)}
          step="0.01"
          value={Math.min(current, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 min-w-[80px] flex-1 cursor-pointer accent-[#d4a52c]"
          aria-label="Seek"
        />
        <span className="shrink-0 font-mono text-[9px] text-white/35">
          {formatTime(current)} / {formatTime(duration)}
        </span>
        <button
          onClick={toggleMute}
          className="shrink-0 rounded p-1 text-white/40 hover:text-white/70"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
