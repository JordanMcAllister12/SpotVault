import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2,
  Loader2, AlertCircle, RotateCcw, ChevronLeft, ChevronRight,
  PictureInPicture2, Music, ArrowRight, Search, ChevronDown, ChevronUp,
  Library, ShoppingBag, Bookmark, GripHorizontal,
  Stethoscope, Copy, Check, Activity,
} from 'lucide-react';
import {
  useMediaPlayer, updatePlayback, clearNowPlaying,
  getSavedPosition, clearPosition, playInMediaCenter,
  INTRO_VIDEO,
} from '@/lib/mediaPlayerStore';
import { YouTubePlayer } from './YouTubePlayer';
import { useMySpotsWidgetItems, type MySpotsWidgetItem } from '@/hooks/useMySpotsItems';
import { supabase } from '@/lib/supabase';
import { parseYouTubeId } from './YouTubePlayer';
import { useStaffBadge } from '@/hooks/useStaffBadge';
import { hubGlassNav, hubGlassCard } from '@/components/shared/hubGlass';

const MEDIA_BUCKET = 'media-manager';
const GOLD = '#d4a52c';
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

type ContentTab = 'my-content' | 'purchased' | 'saved';

const LIB_MIN = 80;
const LIB_MAX = 400;
const LIB_DEFAULT = 140;

function formatTime(sec: number): string {
  if (!sec || isNaN(sec)) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  onViewAll?: () => void;
  autoSelectYouTubeId?: string;
  autoSelectStartAt?: number;
  autoStartPaused?: boolean;
  isVisible?: boolean;
  userId?: string;
}

interface PublishedMedia {
  id: string;
  title: string;
  source_type: 'uploaded' | 'youtube';
  storage_path: string | null;
  youtube_video_id: string | null;
  youtube_url: string | null;
  thumbnail_url: string | null;
}

export function MediaWidget({ onViewAll, autoSelectYouTubeId, autoSelectStartAt, autoStartPaused, isVisible = true, userId }: Props) {
  const { nowPlaying, playback } = useMediaPlayer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [dragPct, setDragPct] = useState<number | null>(null);
  const controlsTimeout = useRef<number | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ active: boolean; pointerId: number | null }>({ active: false, pointerId: null });
  const lastSavedRef = useRef(0);
  const [items] = useMySpotsWidgetItems();

  // Video-only filter for the library tray. Non-video My Spots repository entries
  // (written Spots, articles, analysis, packs) are excluded here only — the
  // standalone My Spots page is untouched and keeps showing everything.
  const videoItems = items.filter((i) => i.type === 'Video' || i.type === 'Course');
  const [publishedMedia, setPublishedMedia] = useState<PublishedMedia[]>([]);
  const [contentSearch, setContentSearch] = useState('');
  const [contentTab, setContentTab] = useState<ContentTab>('my-content');
  const [libraryExpanded, setLibraryExpanded] = useState(false);
  const [libraryHeight, setLibraryHeight] = useState<number>(() => {
    const saved = localStorage.getItem('sv-media-lib-height');
    return saved ? Math.max(LIB_MIN, Math.min(LIB_MAX, parseInt(saved))) : LIB_DEFAULT;
  });
  const libDragRef = useRef<{ startY: number; startH: number } | null>(null);
  const [isDraggingLib, setIsDraggingLib] = useState(false);
  const staffBadge = useStaffBadge(userId);
  const isStaff = !!staffBadge;
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagReport, setDiagReport] = useState<string | null>(null);
  const [diagTesting, setDiagTesting] = useState(false);
  const [diagCopied, setDiagCopied] = useState(false);

  // Library resize drag — only changes library height, never touches the video player
  useEffect(() => {
    if (!isDraggingLib) return;
    const onMove = (e: globalThis.MouseEvent | TouchEvent) => {
      if (!libDragRef.current) return;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dy = clientY - libDragRef.current.startY;
      // Dragging down expands the library
      const newH = Math.max(LIB_MIN, Math.min(LIB_MAX, libDragRef.current.startH - dy));
      setLibraryHeight(newH);
      if ('touches' in e) e.preventDefault();
    };
    const onUp = () => {
      libDragRef.current = null;
      setIsDraggingLib(false);
    };
    window.addEventListener('mousemove', onMove as EventListener);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove as EventListener, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove as EventListener);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove as EventListener);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDraggingLib]);

  const handleLibDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    libDragRef.current = { startY: clientY, startH: libraryHeight };
    setIsDraggingLib(true);
  }, [libraryHeight]);

  // Persist the chosen library height whenever it settles (not mid-drag).
  useEffect(() => {
    if (isDraggingLib) return;
    localStorage.setItem('sv-media-lib-height', String(libraryHeight));
  }, [libraryHeight, isDraggingLib]);

  useEffect(() => {
    let mounted = true;
    const loadPublishedMedia = async () => {
      const { data } = await supabase
        .from('media_assignments')
        .select('media_assets(id, title, source_type, storage_path, youtube_video_id, youtube_url, thumbnail_url)')
        .eq('destination', 'player_my_spots')
        .eq('status', 'active')
        .order('assigned_at', { ascending: false });
      if (!mounted) return;
      const assets = (data ?? [])
        .map((row) => row.media_assets)
        .filter((asset): asset is PublishedMedia =>
          asset != null && !Array.isArray(asset) &&
          (asset.source_type === 'uploaded' || asset.source_type === 'youtube'),
        );
      setPublishedMedia(assets);
    };
    void loadPublishedMedia();
    return () => { mounted = false; };
  }, []);

  const playMySpotsItem = useCallback((item: MySpotsWidgetItem) => {
    playInMediaCenter({
      id: item.id,
      title: item.title,
      creator: item.creator,
      videoUrl: '',
      contentType: 'media',
      posterUrl: item.thumbnail,
    });
  }, []);

  const playPublishedMedia = useCallback((media: PublishedMedia) => {
    const videoUrl = media.storage_path
      ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(media.storage_path).data.publicUrl
      : '';
    const youtubeVideoId = media.youtube_video_id ?? (media.youtube_url ? parseYouTubeId(media.youtube_url) : undefined);
    playInMediaCenter({
      id: media.id,
      title: media.title,
      creator: 'SpotVault',
      videoUrl,
      contentType: 'media',
      posterUrl: media.thumbnail_url ?? undefined,
      youtubeVideoId,
    });
  }, []);

  const playPublicIntro = useCallback(() => {
    clearPosition(INTRO_VIDEO.id);
    playInMediaCenter(INTRO_VIDEO);
  }, []);

  const purchasedItems = videoItems.filter((i) => i.source === 'purchased' || i.acquiredAt > 0);
  const savedItems = videoItems.filter((i) => i.source === 'saved' || i.source === 'library');
  const myContentItems = videoItems.filter((i) => i.source === 'created' || i.source === 'uploaded' || !i.source);

  const tabItems: Record<ContentTab, MySpotsWidgetItem[]> = {
    'my-content': myContentItems.length > 0 ? myContentItems : videoItems,
    'purchased': purchasedItems,
    'saved': savedItems,
  };

  const currentTabItems = contentSearch
    ? tabItems[contentTab].filter((i) => i.title.toLowerCase().includes(contentSearch.toLowerCase()) || i.creator.toLowerCase().includes(contentSearch.toLowerCase()))
    : tabItems[contentTab];

  useEffect(() => {
    if (!nowPlaying || nowPlaying.youtubeVideoId || !videoRef.current) return;
    if (nowPlaying.id === INTRO_VIDEO.id) return;
    const video = videoRef.current;
    const savedPos = getSavedPosition(nowPlaying.id);
    if (savedPos > 0 && video.readyState >= 1) {
      video.currentTime = savedPos;
      updatePlayback({ currentTime: savedPos, error: null });
    } else if (savedPos > 0) {
      const onReady = () => { video.currentTime = savedPos; updatePlayback({ currentTime: savedPos }); video.removeEventListener('loadedmetadata', onReady); };
      video.addEventListener('loadedmetadata', onReady);
    }
  }, [nowPlaying?.id, nowPlaying?.youtubeVideoId]);

  useEffect(() => {
    if (!playback.isLoading) return;
    const timeout = setTimeout(() => {
      updatePlayback({ isLoading: false, error: 'Video took too long to load. Check your connection and try again.' });
    }, 15000);
    return () => clearTimeout(timeout);
  }, [playback.isLoading, nowPlaying?.videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      updatePlayback({ duration: video.duration, isLoading: false });
    };
    const onLoadedData = () => updatePlayback({ isLoading: false });
    const onTimeUpdate = () => {
      if (!seeking) {
        updatePlayback({ currentTime: video.currentTime, isPlaying: !video.paused });
        if (Math.abs(video.currentTime - lastSavedRef.current) > 5) {
          lastSavedRef.current = video.currentTime;
          if (nowPlaying && nowPlaying.id !== INTRO_VIDEO.id) {
            try {
              const positions = JSON.parse(localStorage.getItem('sv-media-positions') || '{}');
              positions[nowPlaying.id] = video.currentTime;
              localStorage.setItem('sv-media-positions', JSON.stringify(positions));
            } catch { /* ignore */ }
          }
        }
      }
    };
    const onPlay = () => updatePlayback({ isPlaying: true });
    const onPause = () => {
      updatePlayback({ isPlaying: false });
      if (nowPlaying && nowPlaying.id !== INTRO_VIDEO.id) {
        try {
          const positions = JSON.parse(localStorage.getItem('sv-media-positions') || '{}');
          positions[nowPlaying.id] = video.currentTime;
          localStorage.setItem('sv-media-positions', JSON.stringify(positions));
        } catch { /* ignore */ }
        lastSavedRef.current = video.currentTime;
      }
    };
    const onWaiting = () => { if (!video.paused && video.readyState < 3) updatePlayback({ isLoading: true }); };
    const onPlaying = () => updatePlayback({ isLoading: false, isPlaying: true });
    const onCanPlay = () => updatePlayback({ isLoading: false });
    const onCanPlayThrough = () => updatePlayback({ isLoading: false });
    const onEnded = () => { updatePlayback({ isPlaying: false, currentTime: 0 }); if (nowPlaying) clearPosition(nowPlaying.id); };
    const onError = () => {
      const v = videoRef.current;
      let detail = 'Unable to play this media';
      if (v?.error) {
        const codes: Record<number, string> = { 1: 'MEDIA_ERR_ABORTED', 2: 'MEDIA_ERR_NETWORK', 3: 'MEDIA_ERR_DECODE', 4: 'MEDIA_ERR_SRC_NOT_SUPPORTED' };
        detail = `Video error: ${codes[v.error.code] ?? v.error.code} — ${v.error.message || 'no message'}`;
      }
      updatePlayback({ isLoading: false, error: detail });
    };
    const onStalled = () => { if (!video.paused && video.readyState < 2) updatePlayback({ isLoading: true }); };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('canplaythrough', onCanPlayThrough);
    video.addEventListener('stalled', onStalled);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);

    if (video.readyState >= 1 && video.duration > 0) {
      updatePlayback({ duration: video.duration, isLoading: false });
    }

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('canplaythrough', onCanPlayThrough);
      video.removeEventListener('stalled', onStalled);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
    };
  }, [seeking, nowPlaying?.id, nowPlaying]);

  useEffect(() => {
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    return () => {
      if (nowPlaying && nowPlaying.id !== INTRO_VIDEO.id && videoRef.current) {
        try {
          const positions = JSON.parse(localStorage.getItem('sv-media-positions') || '{}');
          positions[nowPlaying.id] = videoRef.current.currentTime;
          localStorage.setItem('sv-media-positions', JSON.stringify(positions));
        } catch { /* ignore */ }
      }
    };
  }, [nowPlaying]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    updatePlayback({ muted: video.muted });
  }, []);

  const setVolume = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    if (video.muted && v > 0) video.muted = false;
    updatePlayback({ volume: v, muted: v === 0 });
  }, []);

  const setSpeed = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    updatePlayback({ playbackRate: rate });
    setShowSpeedMenu(false);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = window.setTimeout(() => {
      if (playback.isPlaying && !showSpeedMenu && !dragRef.current.active) setShowControls(false);
    }, 3000);
  }, [playback.isPlaying, showSpeedMenu]);

  const onSeek = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    updatePlayback({ currentTime: value });
  }, []);

  const pctFromPointer = useCallback((clientX: number): number => {
    const bar = seekBarRef.current;
    if (!bar || !playback.duration) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, [playback.duration]);

  const onSeekClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!playback.duration) return;
    const pct = pctFromPointer(e.clientX);
    onSeek(pct * playback.duration);
  }, [playback.duration, onSeek, pctFromPointer]);

  const onSeekPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!playback.duration) return;
    e.preventDefault();
    e.stopPropagation();
    setSeeking(true);
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    dragRef.current = { active: true, pointerId: e.pointerId };
    const bar = e.currentTarget;
    try { bar.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const pct = pctFromPointer(e.clientX);
    setDragPct(pct);
  }, [playback.duration, pctFromPointer]);

  const onSeekPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    e.preventDefault();
    const pct = pctFromPointer(e.clientX);
    setDragPct(pct);
  }, [pctFromPointer]);

  const onSeekPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    e.preventDefault();
    const bar = e.currentTarget;
    if (dragRef.current.pointerId !== null) {
      try { bar.releasePointerCapture(dragRef.current.pointerId); } catch { /* ignore */ }
    }
    const pct = pctFromPointer(e.clientX);
    onSeek(pct * playback.duration);
    setDragPct(null);
    setSeeking(false);
    dragRef.current = { active: false, pointerId: null };
    showControlsTemporarily();
  }, [pctFromPointer, onSeek, showControlsTemporarily]);

  const onSeekPointerCancel = useCallback(() => {
    if (!dragRef.current.active) return;
    setDragPct(null);
    setSeeking(false);
    dragRef.current = { active: false, pointerId: null };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else containerRef.current.requestFullscreen().catch(() => {});
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch { /* ignore */ }
  }, []);

  const retry = useCallback(async () => {
    if (!nowPlaying || !videoRef.current) return;
    updatePlayback({ error: null, isLoading: true });
    videoRef.current.src = nowPlaying.videoUrl;
    videoRef.current.load();
  }, [nowPlaying]);

  const runDiagnostics = useCallback(() => {
    const v = videoRef.current;
    if (!v || !nowPlaying) return;
    setDiagTesting(true);
    const readyStates = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
    const networkStates = ['NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE'];
    const report = [
      '=== SpotVault Playback Diagnostics ===',
      `Time: ${new Date().toISOString()}`,
      `Video: ${nowPlaying.title} (${nowPlaying.id})`,
      `URL: ${nowPlaying.videoUrl?.slice(0, 150) ?? 'N/A'}`,
      '',
      '--- Element State ---',
      `readyState: ${v.readyState} (${readyStates[v.readyState] ?? '?'})`,
      `networkState: ${v.networkState} (${networkStates[v.networkState] ?? '?'})`,
      `error: ${v.error ? `code=${v.error.code} message=${v.error.message || 'none'}` : 'none'}`,
      `paused: ${v.paused}, ended: ${v.ended}, seeking: ${v.seeking}`,
      `duration: ${v.duration}s, currentTime: ${v.currentTime}s`,
      `volume: ${v.volume}, muted: ${v.muted}, playbackRate: ${v.playbackRate}`,
      `buffered ranges: ${v.buffered.length}`,
    ].join('\n');
    setDiagReport(report);
    setDiagTesting(false);
  }, [nowPlaying]);

  const copyDiagnostics = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const text = diagReport ?? `Video: ${nowPlaying?.title}\nURL: ${nowPlaying?.videoUrl}\nreadyState: ${v.readyState}\nerror: ${v.error?.code ?? 'none'}`;
    navigator.clipboard?.writeText(text).then(() => {
      setDiagCopied(true);
      setTimeout(() => setDiagCopied(false), 2000);
    }).catch(() => {});
  }, [diagReport, nowPlaying]);

  // Auto-select a YouTube video when none is playing and the widget mounts.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (nowPlaying) { autoSelectedRef.current = true; return; }
    if (!autoSelectYouTubeId || publishedMedia.length === 0) return;
    const target = publishedMedia.find((m) => m.youtube_video_id === autoSelectYouTubeId);
    if (!target) return;
    autoSelectedRef.current = true;
    playInMediaCenter({
      id: target.id,
      title: target.title,
      creator: 'SpotVault',
      videoUrl: '',
      contentType: 'media',
      posterUrl: target.thumbnail_url ?? undefined,
      youtubeVideoId: target.youtube_video_id ?? undefined,
      startAt: autoSelectStartAt,
    });
  }, [nowPlaying, autoSelectYouTubeId, autoSelectStartAt, publishedMedia]);

  const introDefaultRef = useRef(false);
  useEffect(() => {
    if (introDefaultRef.current || autoSelectedRef.current || nowPlaying || autoSelectYouTubeId || !isVisible) return;
    introDefaultRef.current = true;
    clearPosition(INTRO_VIDEO.id);
    playInMediaCenter(INTRO_VIDEO);
  }, [autoSelectYouTubeId, isVisible, nowPlaying]);

  const progressPct = dragPct !== null && playback.duration
    ? dragPct * 100
    : playback.duration ? (playback.currentTime / playback.duration) * 100 : 0;

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col">
      {/* === VIDEO PLAYER AREA — flexes to fill space the library doesn't use === */}
      {!nowPlaying ? (
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
              <Play className="h-5 w-5 text-white/20" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white/40">Select a video to play</p>
              <p className="mt-0.5 text-[11px] text-white/25">Choose from the library below</p>
            </div>
            <button
              onClick={() => playInMediaCenter({ ...INTRO_VIDEO, noAutoplay: false })}
              className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/30 bg-[#c0911e]/10 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20"
            >
              <Play className="h-3 w-3" strokeWidth={1.5} /> Play SpotVault Intro
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Metadata bar */}
          <div className="shrink-0 border-b border-white/[0.06] px-3 py-2" style={hubGlassNav}>
            <p className="truncate text-[11px] font-semibold text-white">{nowPlaying.title}</p>
            <p className="truncate text-[9px] text-white/40">{nowPlaying.creator}</p>
          </div>

          {/* Staff diagnostics bar */}
          {isStaff && !nowPlaying.youtubeVideoId && (
            <div className="shrink-0 border-b border-white/[0.06] bg-[#0a0c0e]">
              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
              >
                <Stethoscope className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
                <span className="text-[9px] font-bold tracking-widest text-white/50 uppercase">Playback Diagnostics</span>
                {playback.error && <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[7px] font-bold text-red-400">ERROR</span>}
                <ChevronDown className={`ml-auto h-3 w-3 text-white/30 transition-transform ${showDiagnostics ? 'rotate-180' : ''}`} strokeWidth={1.5} />
              </button>
              {showDiagnostics && (
                <div className="px-3 pb-2 space-y-1.5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] font-mono">
                    {(() => {
                      const v = videoRef.current;
                      const readyStates = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
                      const networkStates = ['NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE'];
                      return (
                        <>
                          <div><span className="text-white/30">readyState:</span> <span className="text-white/60">{v ? `${v.readyState} (${readyStates[v.readyState] ?? '?'})` : 'N/A'}</span></div>
                          <div><span className="text-white/30">networkState:</span> <span className="text-white/60">{v ? `${v.networkState} (${networkStates[v.networkState] ?? '?'})` : 'N/A'}</span></div>
                          <div><span className="text-white/30">error:</span> <span className={playback.error ? 'text-red-400' : 'text-emerald-400'}>{v?.error ? `${v.error.code} — ${v.error.message || 'none'}` : 'none'}</span></div>
                          <div><span className="text-white/30">paused:</span> <span className="text-white/60">{String(v?.paused ?? true)}</span></div>
                          <div className="col-span-2"><span className="text-white/30">src:</span> <span className="break-all text-white/50">{(v?.currentSrc || nowPlaying.videoUrl || 'N/A').slice(0, 120)}</span></div>
                        </>
                      );
                    })()}
                  </div>
                  {diagReport && (
                    <pre className="rounded border border-white/[0.06] bg-black/30 p-1.5 text-[8px] font-mono text-white/50 whitespace-pre-wrap max-h-32 overflow-y-auto">{diagReport}</pre>
                  )}
                  <div className="flex gap-1.5">
                    <button
                      onClick={runDiagnostics}
                      disabled={diagTesting}
                      className="flex items-center gap-1 rounded border border-[#d4a52c]/30 bg-[#c0911e]/10 px-2 py-1 text-[8px] font-bold tracking-wide text-[#f5e6b0] uppercase disabled:opacity-50"
                    >
                      {diagTesting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Activity className="h-2.5 w-2.5" />}
                      Test
                    </button>
                    <button
                      onClick={copyDiagnostics}
                      className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[8px] font-bold tracking-wide text-white/50 uppercase hover:bg-white/5"
                    >
                      {diagCopied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                      {diagCopied ? 'Copied' : 'Copy Report'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Video / player area — flexes to fill space the library doesn't use */}
          <div
            className="relative min-h-0 flex-1 bg-black"
            onMouseMove={nowPlaying.youtubeVideoId ? undefined : showControlsTemporarily}
            onMouseLeave={nowPlaying.youtubeVideoId ? undefined : () => { if (playback.isPlaying && !showSpeedMenu && !dragRef.current.active) setShowControls(false); }}
            onTouchStart={nowPlaying.youtubeVideoId ? undefined : showControlsTemporarily}
          >
            {nowPlaying.youtubeVideoId ? (
              <div className="absolute inset-0 h-full w-full">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${encodeURIComponent(nowPlaying.youtubeVideoId)}?rel=0&modestbranding=1&autoplay=${autoStartPaused ? '0' : '1'}${nowPlaying.startAt ? `&start=${nowPlaying.startAt}` : ''}`}
                  title={nowPlaying.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            ) : nowPlaying.isAudio ? (
              <>
                <div className="flex h-full flex-col items-center justify-center gap-3 bg-black">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#d4a52c]/20 bg-[#c0911e]/5">
                    <Music className="h-8 w-8" style={{ color: GOLD }} strokeWidth={1} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white/80">{nowPlaying.title}</p>
                    <p className="mt-0.5 text-[11px] text-white/40">{nowPlaying.creator}</p>
                  </div>
                </div>
                <audio ref={videoRef as React.RefObject<HTMLAudioElement>} className="hidden" />
              </>
            ) : (
              <video
                ref={videoRef}
                className={`h-full w-full transition-opacity duration-300 ${playback.isLoading && playback.isPlaying ? 'opacity-0' : 'opacity-100'}`}
                style={{ background: '#000', objectFit: 'contain' }}
                src={nowPlaying.videoUrl || undefined}
                poster={nowPlaying.posterUrl || undefined}
                preload="metadata"
                playsInline
                controls={false}
                onClick={(e) => { if (!dragRef.current.active) { togglePlay(e); } }}
              />
            )}

            {/* Loading overlay — only during active playback buffering, never on initial idle */}
            {playback.isLoading && playback.isPlaying && !nowPlaying.youtubeVideoId && !playback.error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} strokeWidth={2} />
                  <span className="text-[10px] text-white/50">Buffering...</span>
                </div>
              </div>
            )}

            {/* Ready/paused overlay — shows poster + play button when video is ready but not playing */}
            {!playback.isLoading && !playback.isPlaying && !playback.error && !nowPlaying.youtubeVideoId && (
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
                className="group absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/10"
                aria-label="Play video"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#d4a52c]/60 bg-black/50 backdrop-blur-sm transition-transform group-hover:scale-110" style={{ boxShadow: `0 0 20px rgba(212,165,44,0.3)` }}>
                  <Play className="h-6 w-6 text-[#f5e6b0] ml-0.5" strokeWidth={2} fill="currentColor" />
                </div>
              </button>
            )}

            {!nowPlaying.youtubeVideoId && (
            <div
              className="absolute inset-x-0 bottom-0 transition-opacity duration-300"
              style={{ opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none' }}
            >
              <div className="px-3 pb-1 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-white/50 tabular-nums">{formatTime(dragPct !== null && playback.duration ? dragPct * playback.duration : playback.currentTime)}</span>
                  <div
                    ref={seekBarRef}
                    className="group relative flex-1 cursor-pointer py-2"
                    style={{ touchAction: 'none' }}
                    onClick={onSeekClick}
                    onPointerDown={onSeekPointerDown}
                    onPointerMove={onSeekPointerMove}
                    onPointerUp={onSeekPointerUp}
                    onPointerCancel={onSeekPointerCancel}
                  >
                    <div className="relative h-1 rounded-full bg-white/10">
                      <div className="absolute h-full rounded-full" style={{ width: `${progressPct}%`, background: GOLD }} />
                      <div
                        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{ left: `${progressPct}%`, background: GOLD, boxShadow: `0 0 4px ${GOLD}`, opacity: showControls || dragPct !== null ? 1 : undefined }}
                      />
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-white/50 tabular-nums">{formatTime(playback.duration)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 pb-2">
                <button onClick={togglePlay} className="flex h-7 w-7 items-center justify-center rounded text-white/70 transition-colors hover:text-white" title={playback.isPlaying ? 'Pause' : 'Play'}>
                  {playback.isPlaying ? <Pause className="h-4 w-4" strokeWidth={1.5} /> : <Play className="h-4 w-4" strokeWidth={1.5} />}
                </button>
                <button onClick={toggleMute} className="flex h-7 w-7 items-center justify-center rounded text-white/70 transition-colors hover:text-white" title={playback.muted ? 'Unmute' : 'Mute'}>
                  {playback.muted || playback.volume === 0 ? <VolumeX className="h-4 w-4" strokeWidth={1.5} /> : <Volume2 className="h-4 w-4" strokeWidth={1.5} />}
                </button>
                <input type="range" min={0} max={1} step={0.05} value={playback.muted ? 0 : playback.volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="h-1 w-12 cursor-pointer accent-[#d4a52c]" aria-label="Volume" />
                <div className="relative">
                  <button onClick={() => setShowSpeedMenu(!showSpeedMenu)} className="flex h-7 items-center justify-center rounded px-1.5 text-[10px] font-semibold text-white/60 transition-colors hover:text-white" title="Playback speed">
                    {playback.playbackRate}x
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full left-0 mb-1 flex flex-col gap-0.5 rounded-md border border-white/10 bg-[#0d0f12] p-1 shadow-xl">
                      {SPEEDS.map((s) => (
                        <button key={s} onClick={() => setSpeed(s)} className={`rounded px-3 py-1 text-[10px] font-semibold transition-colors ${playback.playbackRate === s ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/50 hover:bg-white/5 hover:text-white/70'}`}>{s}x</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1" />
                {nowPlaying.courseContext?.prevUrl && (
                  <button onClick={() => playInMediaCenter({ ...nowPlaying, id: nowPlaying.courseContext!.prevId!, title: nowPlaying.courseContext!.prevTitle!, videoUrl: nowPlaying.courseContext!.prevUrl! })} className="flex h-7 w-7 items-center justify-center rounded text-white/50 transition-colors hover:text-white" title="Previous lesson">
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                )}
                {nowPlaying.courseContext?.nextUrl && (
                  <button onClick={() => playInMediaCenter({ ...nowPlaying, id: nowPlaying.courseContext!.nextId!, title: nowPlaying.courseContext!.nextTitle!, videoUrl: nowPlaying.courseContext!.nextUrl! })} className="flex h-7 w-7 items-center justify-center rounded text-white/50 transition-colors hover:text-white" title="Next lesson">
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                )}
                {!nowPlaying.isAudio && 'pictureInPictureEnabled' in document && (
                  <button onClick={togglePiP} className="flex h-7 w-7 items-center justify-center rounded text-white/50 transition-colors hover:text-white" title="Picture in picture">
                    <PictureInPicture2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                )}
                <button onClick={toggleFullscreen} className="flex h-7 w-7 items-center justify-center rounded text-white/50 transition-colors hover:text-white" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                  {isFullscreen ? <Minimize2 className="h-4 w-4" strokeWidth={1.5} /> : <Maximize2 className="h-4 w-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>
            )}

            {playback.error && !nowPlaying.youtubeVideoId && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/85 px-4 text-center">
                <AlertCircle className="h-7 w-7 text-red-400/70" strokeWidth={1.5} />
                <p className="text-[11px] font-medium text-white/60">Unable to load this video</p>
                <p className="max-w-sm text-[9px] leading-relaxed text-white/30">{playback.error}</p>
                <button onClick={retry} className="mt-1 flex items-center gap-1.5 rounded-md border border-[#d4a52c]/30 bg-[#c0911e]/10 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20">
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* === DRAG HANDLE — resizable library border === */}
      <ResizeHandle onDragStart={handleLibDragStart} dragging={isDraggingLib} />

      {/* === VIDEO LIBRARY — explicit height controlled by the divider === */}
      <VideoLibrary
        contentTab={contentTab}
        setContentTab={setContentTab}
        libraryExpanded={libraryExpanded}
        setLibraryExpanded={setLibraryExpanded}
        contentSearch={contentSearch}
        setContentSearch={setContentSearch}
        currentTabItems={currentTabItems}
        publishedMedia={publishedMedia}
        playMySpotsItem={playMySpotsItem}
        playPublishedMedia={playPublishedMedia}
        onViewAll={onViewAll}
        playPublicIntro={playPublicIntro}
        height={libraryHeight}
        expanded={libraryExpanded}
      />
    </div>
  );
}

function ResizeHandle({ onDragStart, dragging }: { onDragStart: (e: React.MouseEvent | React.TouchEvent) => void; dragging: boolean }) {
  return (
    // The visible bar is thin, but the touch hit area is 16px tall so fingers
    // can grab it reliably on mobile without an oversized visual divider.
    <div
      className="group relative flex shrink-0 touch-none select-none cursor-row-resize items-center justify-center border-y border-white/[0.06] bg-[#0a0c0e] transition-colors hover:bg-[#c0911e]/10"
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
      style={{ zIndex: dragging ? 100 : 1, height: 16 }}
    >
      <div className="flex h-3 w-10 items-center justify-center rounded-full border border-white/10 bg-[#151719] opacity-0 transition-opacity group-hover:opacity-100" style={{ opacity: dragging ? 1 : undefined }}>
        <GripHorizontal className="h-3 w-5" strokeWidth={1.5} style={{ color: '#d4a52c' }} />
      </div>
    </div>
  );
}

function VideoLibrary({
  contentTab, setContentTab, libraryExpanded, setLibraryExpanded,
  contentSearch, setContentSearch, currentTabItems, publishedMedia,
  playMySpotsItem, playPublishedMedia, onViewAll, playPublicIntro,
  height, expanded,
}: {
  contentTab: ContentTab;
  setContentTab: (t: ContentTab) => void;
  libraryExpanded: boolean;
  setLibraryExpanded: (e: boolean) => void;
  contentSearch: string;
  setContentSearch: (s: string) => void;
  currentTabItems: MySpotsWidgetItem[];
  publishedMedia: PublishedMedia[];
  playMySpotsItem: (item: MySpotsWidgetItem) => void;
  playPublishedMedia: (media: PublishedMedia) => void;
  onViewAll?: () => void;
  playPublicIntro: () => void;
  height: number;
  expanded: boolean;
}) {
  const showPublicIntro = contentTab === 'my-content' && (!contentSearch || INTRO_VIDEO.title.toLowerCase().includes(contentSearch.toLowerCase()) || 'spotvault'.includes(contentSearch.toLowerCase()));
  const tabs: { id: ContentTab; label: string; icon: typeof Library }[] = [
    { id: 'my-content', label: 'My Content', icon: Library },
    { id: 'purchased', label: 'Purchased', icon: ShoppingBag },
    { id: 'saved', label: 'Saved', icon: Bookmark },
  ];

  return (
    <div
      className="flex shrink-0 flex-col border-t border-white/[0.08] overflow-hidden"
      style={{ ...hubGlassCard, height, minHeight: LIB_MIN }}
    >
      {/* Tab bar + collapse toggle — always visible, never scrolls away */}
      <div className="flex shrink-0 items-center justify-between px-2 py-1">
        <div className="flex items-center gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setContentTab(tab.id)}
              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold tracking-wide transition-colors ${
                contentTab === tab.id
                  ? 'bg-[#c0911e]/15 text-[#f5e6b0]'
                  : 'text-white/35 hover:bg-white/5 hover:text-white/60'
              }`}
            >
              <tab.icon className="h-2.5 w-2.5" strokeWidth={1.5} />
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setLibraryExpanded(!libraryExpanded)}
          className="flex h-5 w-5 items-center justify-center rounded text-white/40 hover:bg-white/5 hover:text-white/70"
          title={libraryExpanded ? 'Collapse' : 'Expand'}
        >
          {libraryExpanded ? <ChevronDown className="h-3 w-3" strokeWidth={1.5} /> : <ChevronUp className="h-3 w-3" strokeWidth={1.5} />}
        </button>
      </div>

      {/* Collapsed: show 2-3 preview rows */}
      {!libraryExpanded && (
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1">
          {showPublicIntro && (
            <button onClick={playPublicIntro} className="group mb-1 flex w-full items-center gap-1.5 rounded border border-[#d4a52c]/20 bg-[#c0911e]/[0.06] px-1.5 py-1 text-left transition-colors hover:border-[#d4a52c]/40 hover:bg-[#c0911e]/[0.1]">
              <div className="h-5 w-8 shrink-0 overflow-hidden rounded border border-[#d4a52c]/20 bg-black/40"><div className="flex h-full items-center justify-center"><Play className="h-2 w-2 text-[#d4a52c]" /></div></div>
              <p className="min-w-0 flex-1 truncate text-[9px] font-medium text-[#f5e6b0]">SpotVault Introduction</p>
              <Play className="h-2 w-2 shrink-0 text-[#d4a52c]" strokeWidth={1.5} />
            </button>
          )}
          {publishedMedia.length > 0 && contentTab === 'my-content' ? (
            publishedMedia.slice(0, 3).map((media) => (
              <button key={media.id} onClick={() => playPublishedMedia(media)} className="group mb-1 flex w-full items-center gap-1.5 rounded border border-white/[0.04] bg-black/20 px-1.5 py-1 text-left transition-colors hover:border-[#c0911e]/25 hover:bg-black/30">
                <div className="h-5 w-8 shrink-0 overflow-hidden rounded border border-white/[0.06] bg-black/40">
                  {media.thumbnail_url ? <img src={media.thumbnail_url} alt={media.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Play className="h-2 w-2 text-white/20" /></div>}
                </div>
                <p className="min-w-0 flex-1 truncate text-[9px] font-medium text-white/75">{media.title}</p>
                <Play className="h-2 w-2 shrink-0 text-white/15 group-hover:text-[#d4a52c]" strokeWidth={1.5} />
              </button>
            ))
          ) : currentTabItems.length > 0 ? (
            currentTabItems.slice(0, 3).map((item) => (
              <button key={item.id} onClick={() => playMySpotsItem(item)} className="group mb-1 flex w-full items-center gap-1.5 rounded border border-white/[0.04] bg-black/20 px-1.5 py-1 text-left transition-colors hover:border-[#c0911e]/25 hover:bg-black/30">
                <p className="min-w-0 flex-1 truncate text-[9px] font-medium text-white/75">{item.title}</p>
                <Play className="h-2 w-2 shrink-0 text-white/15 group-hover:text-[#d4a52c]" strokeWidth={1.5} />
              </button>
            ))
          ) : contentTab !== 'my-content' ? (
            <p className="px-2 py-1 text-[9px] text-white/20">No videos available.</p>
          ) : null}
        </div>
      )}

      {/* Expanded: search + independently scrollable video list */}
      {libraryExpanded && (
        <div className="flex min-h-0 flex-1 flex-col" style={{ minHeight: 0 }}>
          <div className="shrink-0 px-2 pb-1">
            <input
              type="text"
              value={contentSearch}
              onChange={(e) => setContentSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/70 placeholder:text-white/25 focus:border-[#d4a52c]/30 focus:outline-none"
            />
          </div>
          {/* Independently scrollable video list — tabs stay fixed above */}
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1">
            {showPublicIntro && (
              <div className="mb-1">
                <div className="mb-0.5 px-1 text-[7px] font-semibold tracking-[0.16em] text-[#d4a52c]/60 uppercase">Public</div>
                <button onClick={playPublicIntro} className="group flex w-full items-center gap-1.5 rounded border border-[#d4a52c]/20 bg-[#c0911e]/[0.06] px-1.5 py-1 text-left transition-colors hover:border-[#d4a52c]/40 hover:bg-[#c0911e]/[0.1]">
                  <div className="h-5 w-8 shrink-0 overflow-hidden rounded border border-[#d4a52c]/20 bg-black/40"><div className="flex h-full items-center justify-center"><Play className="h-2 w-2 text-[#d4a52c]" /></div></div>
                  <p className="min-w-0 flex-1 truncate text-[9px] font-medium text-[#f5e6b0]">SpotVault Introduction</p>
                  <Play className="h-2 w-2 shrink-0 text-[#d4a52c]" strokeWidth={1.5} />
                </button>
              </div>
            )}
            {publishedMedia.length > 0 && contentTab === 'my-content' && (
              <div className="mb-1">
                <div className="mb-0.5 px-1 text-[7px] font-semibold tracking-[0.16em] text-[#d4a52c]/60 uppercase">Published</div>
                {publishedMedia.map((media) => (
                  <button key={media.id} onClick={() => playPublishedMedia(media)} className="group mb-1 flex w-full items-center gap-1.5 rounded border border-white/[0.04] bg-black/20 px-1.5 py-1 text-left transition-colors hover:border-[#c0911e]/25 hover:bg-black/30">
                    <div className="h-5 w-8 shrink-0 overflow-hidden rounded border border-white/[0.06] bg-black/40">
                      {media.thumbnail_url ? <img src={media.thumbnail_url} alt={media.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Play className="h-2 w-2 text-white/20" /></div>}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-[9px] font-medium text-white/75">{media.title}</p>
                    <Play className="h-2 w-2 shrink-0 text-white/15 group-hover:text-[#d4a52c]" strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            )}
            {currentTabItems.length > 0 ? (
              currentTabItems.map((item) => (
                <button key={item.id} onClick={() => playMySpotsItem(item)} className="group mb-1 flex w-full items-center gap-1.5 rounded border border-white/[0.04] bg-black/20 px-1.5 py-1 text-left transition-colors hover:border-[#c0911e]/25 hover:bg-black/30">
                  <p className="min-w-0 flex-1 truncate text-[9px] font-medium text-white/75">{item.title}</p>
                  <Play className="h-2 w-2 shrink-0 text-white/15 group-hover:text-[#d4a52c]" strokeWidth={1.5} />
                </button>
              ))
            ) : contentTab === 'my-content' ? null : (
              <p className="px-2 py-2 text-center text-[9px] text-white/25">No videos available in this category.</p>
            )}
          </div>
          {onViewAll && (
            <div className="shrink-0 border-t border-white/[0.06] p-1">
              <button onClick={onViewAll} className="flex w-full items-center justify-center gap-1 rounded border border-[#d4a52c]/30 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-[#f5e6b0] transition-colors hover:bg-[#c0911e]/10">
                View All <ArrowRight className="h-2.5 w-2.5" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
