import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { X, BookOpen, FileText, Image as ImageIcon } from 'lucide-react';
import { MediaWidget } from '@/components/player/widgets/MediaWidget';
import { playInMediaCenter, clearNowPlaying, useMediaPlayer, type NowPlaying } from '@/lib/mediaPlayerStore';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

let openHandler: ((item: NowPlaying) => void) | null = null;
const openListeners = new Set<() => void>();
let modalItem: NowPlaying | null = null;

function notifyOpen() { openListeners.forEach((l) => l()); }

export function openSpotPlayer(item: NowPlaying) {
  modalItem = item;
  playInMediaCenter(item);
  notifyOpen();
}

export function closeSpotPlayer() {
  modalItem = null;
  clearNowPlaying();
  notifyOpen();
}

export function useSpotPlayerOpen() {
  return useSyncExternalStore(
    (l) => { openListeners.add(l); return () => openListeners.delete(l); },
    () => modalItem,
    () => modalItem,
  );
}

export function SpotMediaPlayer() {
  const activeItem = useSpotPlayerOpen();
  const { nowPlaying } = useMediaPlayer();

  const handleClose = useCallback(() => {
    closeSpotPlayer();
  }, []);

  useEffect(() => {
    if (!activeItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeItem, handleClose]);

  if (!activeItem || !nowPlaying) return null;

  const isYouTube = Boolean(nowPlaying.youtubeVideoId);
  const isAudio = nowPlaying.isAudio;
  const isVideo = !isYouTube && !isAudio && nowPlaying.contentType === 'media';
  const isText = nowPlaying.contentType === 'spot' || nowPlaying.contentType === 'text';
  const isImage = nowPlaying.contentType === 'image';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}>
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/60 transition-colors hover:text-white/90"
      >
        <X className="h-4.5 w-4.5" strokeWidth={1.5} />
      </button>

      {/* Player container — responsive */}
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border"
        style={{ borderColor: BORDER, background: '#0a0908', boxShadow: `0 24px 80px -16px rgba(0,0,0,0.9), 0 0 0 1px ${BORDER}` }}
      >
        {/* Video / Audio player */}
        {(isYouTube || isVideo || isAudio) && (
          <div className="min-h-0 flex-1">
            {/* On mobile, use nearly full width. On desktop, constrain to 16:9 area */}
            <div className="relative aspect-video w-full bg-black">
              <MediaWidget />
            </div>
          </div>
        )}

        {/* Text/Spot content */}
        {isText && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#d4a52c]/20 bg-[#c0911e]/5">
              <FileText className="h-7 w-7" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{nowPlaying.title}</p>
              <p className="mt-1 text-sm text-white/50">{nowPlaying.creator}</p>
            </div>
            <button
              onClick={handleClose}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/30 bg-[#c0911e]/10 px-4 py-2 text-[11px] font-semibold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20"
            >
              <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
              Read in Spot Viewer
            </button>
          </div>
        )}

        {/* Image content */}
        {isImage && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#d4a52c]/20 bg-[#c0911e]/5">
              <ImageIcon className="h-7 w-7" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{nowPlaying.title}</p>
              <p className="mt-1 text-sm text-white/50">{nowPlaying.creator}</p>
            </div>
          </div>
        )}

        {/* Metadata bar below player */}
        {(isYouTube || isVideo || isAudio) && (
          <div className="shrink-0 border-t border-white/[0.06] px-4 py-3" style={{ background: 'rgba(8,7,6,0.9)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-white">{nowPlaying.title}</p>
                <p className="truncate text-[10px] text-white/40">{nowPlaying.creator}</p>
              </div>
              <button
                onClick={handleClose}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-white/60 uppercase transition hover:text-white/90"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
