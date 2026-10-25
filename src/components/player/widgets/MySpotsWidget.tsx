import { useEffect, useState } from 'react';
import { Lock, ArrowRight, FileText, Video, Target, BookOpen, BarChart3, Users, Package, Play, Youtube, Film } from 'lucide-react';
import { useMySpotsWidgetItems, formatAcquiredLabel, type MySpotsItemType, type MySpotsWidgetItem } from '@/hooks/useMySpotsItems';
import { supabase } from '@/lib/supabase';
import { playInMediaCenter } from '@/lib/mediaPlayerStore';
import { parseYouTubeId } from '@/components/player/widgets/YouTubePlayer';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';
const MEDIA_BUCKET = 'media-manager';

const TYPE_ICON: Record<MySpotsItemType, typeof FileText> = {
  'HH Bundle': FileText,
  'Tournament HHs': FileText,
  Course: BookOpen,
  Video: Video,
  Spot: Target,
  Coaching: Users,
  Analysis: BarChart3,
  'Digital Product': Package,
};

const TYPE_TAG: Record<MySpotsItemType, string> = {
  'HH Bundle': 'HH',
  'Tournament HHs': 'HH',
  Course: 'COURSE',
  Video: 'VIDEO',
  Spot: 'SPOT',
  Coaching: 'COACH',
  Analysis: 'ANALYSIS',
  'Digital Product': 'PACK',
};

interface PublishedMedia {
  id: string;
  title: string;
  source_type: 'uploaded' | 'youtube';
  storage_path: string | null;
  youtube_video_id: string | null;
  youtube_url: string | null;
  thumbnail_url: string | null;
}

interface Props {
  onOpenItem?: (item: MySpotsWidgetItem) => void;
  onViewAll?: () => void;
  onExplore?: () => void;
}

export function MySpotsWidget({ onOpenItem, onViewAll, onExplore }: Props) {
  const [items] = useMySpotsWidgetItems();
  const [publishedMedia, setPublishedMedia] = useState<PublishedMedia[]>([]);
  const recent = [...items].sort((a, b) => b.acquiredAt - a.acquiredAt).slice(0, 5);

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
        .filter((asset): asset is PublishedMedia => asset != null && !Array.isArray(asset));
      setPublishedMedia(assets);
    };
    void loadPublishedMedia();
    return () => { mounted = false; };
  }, []);

  const playPublishedMedia = (media: PublishedMedia) => {
    const videoUrl = media.storage_path
      ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(media.storage_path).data.publicUrl
      : '';
    const youtubeVideoId = media.youtube_video_id ?? (media.youtube_url ? parseYouTubeId(media.youtube_url) : undefined);
    if (import.meta.env.DEV) {
      console.debug('[MySpotsWidget] playPublishedMedia', { id: media.id, title: media.title, source_type: media.source_type, youtube_video_id: media.youtube_video_id, youtube_url: media.youtube_url, parsedId: youtubeVideoId, videoUrl });
    }
    playInMediaCenter({
      id: media.id,
      title: media.title,
      creator: 'SpotVault',
      videoUrl,
      contentType: 'media',
      posterUrl: media.thumbnail_url ?? undefined,
      youtubeVideoId,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-white/50 uppercase">My Spots</span>
        <span className="text-[9px] text-white/25">{items.length + publishedMedia.length} items in My Spots</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {publishedMedia.length > 0 && (
          <section className="mb-3">
            <div className="mb-1.5 flex items-center gap-1.5 px-1">
              <Video className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
              <span className="text-[9px] font-semibold tracking-[0.16em] text-[#d4a52c]/70 uppercase">Media</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {publishedMedia.map((media) => (
                <div key={media.id} className="rounded-lg border border-[#c0911e]/20 bg-black/25 p-2">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-14 shrink-0 overflow-hidden rounded border border-white/[0.06] bg-black/40">
                      {media.thumbnail_url ? (
                        <img src={media.thumbnail_url} alt={media.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center"><Film className="h-4 w-4 text-white/20" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-medium text-white/85">{media.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[8px] text-white/30">
                        {media.source_type === 'youtube' ? <Youtube className="h-2.5 w-2.5 text-red-300/70" /> : <Film className="h-2.5 w-2.5" />}
                        {media.source_type === 'youtube' ? 'YouTube' : 'Uploaded'}
                      </p>
                    </div>
                    <button onClick={() => playPublishedMedia(media)} className="flex shrink-0 items-center gap-1 rounded-md border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2 py-1.5 text-[8px] font-bold tracking-widest text-[#f5e6b0] uppercase hover:bg-[#d4a52c]/20">
                      <Play className="h-3 w-3" fill="currentColor" /> Play
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {recent.length === 0 && publishedMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-4 text-center sm:py-6">
            <Lock className="h-5 w-5 text-white/15" strokeWidth={1.5} />
            <p className="mt-1.5 text-[11px] font-medium text-white/40 sm:mt-2">Nothing in My Spots yet</p>
            <p className="mt-0.5 text-[10px] text-white/25">Content you purchase or save will appear here.</p>
            <button onClick={onExplore} className="mt-2.5 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-semibold tracking-wide transition-colors hover:bg-white/5 sm:mt-3" style={{ borderColor: BORDER, color: GOLD }}>
              <ArrowRight className="h-3 w-3" strokeWidth={1.5} /> Explore Content
            </button>
          </div>
        ) : (
          <>
            {recent.length > 0 && <div className="mb-1.5 px-1 text-[9px] font-semibold tracking-[0.16em] text-white/35 uppercase">Recent</div>}
            <div className="flex flex-col gap-1.5">
              {recent.map((item) => {
                const Icon = TYPE_ICON[item.type] ?? Package;
                return (
                  <button key={item.id} onClick={() => onOpenItem?.(item)} className="group flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-black/20 p-2 text-left transition-colors hover:border-[#c0911e]/25 hover:bg-black/30">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.08)' }}>
                      <Icon className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-white/85">{item.title}</p>
                      <p className="truncate text-[9px] text-white/35">{item.creator}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="rounded px-1 py-0.5 text-[7px] font-bold tracking-wide" style={{ background: 'rgba(192,145,30,0.1)', color: GOLD, border: `1px solid ${BORDER}` }}>{TYPE_TAG[item.type]}</span>
                        <span className="text-[8px] text-white/25">{formatAcquiredLabel(item.acquiredAt)}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-3 w-3 shrink-0 text-white/15 transition-colors group-hover:text-white/40" strokeWidth={1.5} />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.06] p-2">
        <button onClick={onViewAll} className="flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold tracking-wide transition-colors hover:bg-white/5" style={{ borderColor: BORDER, color: GOLD }}>
          View All
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
