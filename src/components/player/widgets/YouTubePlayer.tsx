import { useState, useEffect, useRef } from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';

export function getYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'youtube-nocookie.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v');
        return id && /^[\w-]{11}$/.test(id) ? id : null;
      }
      const embedMatch = parsed.pathname.match(/^\/(?:embed|shorts|v|live)\/([\w-]{11})/);
      if (embedMatch) return embedMatch[1];
    }
  } catch {
    // not a URL
  }
  return null;
}

export function getYouTubeEmbedUrl(input: string, autoplay = true): string | null {
  const videoId = getYouTubeVideoId(input);
  if (!videoId) return null;
  const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
  if (autoplay) params.set('autoplay', '1');
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

export const parseYouTubeId = getYouTubeVideoId;

interface YouTubePlayerProps {
  videoId: string;
  title?: string;
  autoplay?: boolean;
}

export function YouTubePlayer({ videoId, title, autoplay = true }: YouTubePlayerProps) {
  const parsedId = getYouTubeVideoId(videoId);
  const embedUrl = parsedId
    ? `https://www.youtube.com/embed/${encodeURIComponent(parsedId)}?rel=0&modestbranding=1&playsinline=1${autoplay ? '&autoplay=1' : ''}`
    : null;
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (embedUrl) console.log('[YouTubePlayer] iframe src:', embedUrl);
  }, [embedUrl]);

  useEffect(() => {
    setFailed(false);
    if (!embedUrl) return;
    const timer = setTimeout(() => {
      try {
        if (iframeRef.current && !iframeRef.contentWindow) {
          setFailed(true);
        }
      } catch { /* cross-origin — ignore */ }
    }, 5000);
    return () => clearTimeout(timer);
  }, [embedUrl]);

  if (!embedUrl) {
    return (
      <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-center">
        <AlertCircle className="h-8 w-8 text-white/30" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-medium text-white/60">Invalid video URL</p>
          <p className="mt-1 text-[11px] text-white/30">This media item has no valid YouTube video ID.</p>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-center">
        <AlertCircle className="h-8 w-8 text-white/30" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-medium text-white/60">This video can't be played inside SpotVault.</p>
          <a
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(parsedId ?? videoId)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center gap-1.5 rounded-md border border-[#d4a52c]/30 bg-[#c0911e]/10 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Watch on YouTube
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 h-full w-full">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={title ?? 'YouTube video'}
        className="absolute inset-0 h-full w-full"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
      <a
        href={`https://www.youtube.com/watch?v=${encodeURIComponent(parsedId ?? videoId)}`}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[8px] font-semibold tracking-wide text-white/50 uppercase opacity-0 transition-opacity hover:text-white/80"
        style={{ opacity: 0.6 }}
      >
        <ExternalLink className="h-2.5 w-2.5" /> YouTube
      </a>
    </div>
  );
}
