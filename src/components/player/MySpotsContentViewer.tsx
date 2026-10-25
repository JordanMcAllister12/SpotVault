import { ArrowLeft, BookOpen, Package, Clock, Share2 } from 'lucide-react';
import type { MySpotsItem } from '@/lib/mySpotsStore';
import { GOLD, BORDER_GOLD, BG_CARD } from '@/components/ui/industry';
import { SpotViewer as SpotViewerPage } from '@/components/player/SpotViewer';
import { HHPackViewer } from '@/components/player/HHPackViewer';
import { MultiSpotViewer } from '@/components/player/MultiSpotViewer';

interface Props {
  item: MySpotsItem;
  onBack: () => void;
  onEditSpotId?: (spotId: string) => void;
}

/**
 * My Spots content launcher — routes each content type to its proper experience.
 *
 * Routing model (kept explicit so new content types plug in without a generic viewer):
 *   spot        -> SpotViewer (text-primary, optional supplementary video)
 *   hh-jukebox  -> HHPackViewer (Hand Workspace read-only pack mode)
 *   media       -> Media Center (handled in MySpotsContentView via onPlayMedia, never reaches here)
 *   course      -> CourseViewer (structured lessons + progress, NOT the Media Center)
 *   bundle      -> BundleViewer
 */
export function MySpotsContentViewer({ item, onBack, onEditSpotId }: Props) {
  const contentType = item.contentType;

  if (contentType === 'spot') {
    return <SpotViewerPage item={item} onBack={onBack} onEditSpotId={onEditSpotId} />;
  }

  if (contentType === 'hh-jukebox') {
    return <HHPackViewer item={item} onBack={onBack} />;
  }

  if (contentType === 'msa') {
    return <MultiSpotViewer spotId={item.contentId} onBack={onBack} />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-5 sm:py-5">
      <BackButton onBack={onBack} />
      {contentType === 'course' && <CourseViewer item={item} />}
      {contentType === 'bundle' && <BundleViewer item={item} />}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="mb-3 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold text-white/60 transition hover:bg-white/5 hover:text-white/80"
      style={{ borderColor: BORDER_GOLD, background: BG_CARD }}
    >
      <ArrowLeft className="h-4 w-4" />
      My Spots
    </button>
  );
}

function CourseViewer({ item }: { item: MySpotsItem }) {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: BORDER_GOLD, background: BG_CARD }}>
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <BookOpen className="h-4 w-4" style={{ color: GOLD }} />
        <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Course</span>
      </div>
      <div className="p-5">
        <h2 className="text-lg font-bold text-white">{item.title}</h2>
        <p className="mt-1 text-[11px] text-white/40">by {item.creator}</p>
        {item.courseLessonCount !== undefined && (
          <p className="mt-2 text-[11px] text-white/50">
            {item.courseCompletedLessons ?? 0} / {item.courseLessonCount} lessons completed
          </p>
        )}
        {item.progress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[9px] text-white/30">
              <span>{item.progress.currentLabel}</span>
              <span>{item.progress.percent}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-white/5">
              <div className="h-full rounded-full transition-all" style={{ width: `${item.progress.percent}%`, background: GOLD }} />
            </div>
          </div>
        )}
      </div>
      <ViewerMeta item={item} embedded />
    </div>
  );
}

function BundleViewer({ item }: { item: MySpotsItem }) {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: BORDER_GOLD, background: BG_CARD }}>
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <Package className="h-4 w-4" style={{ color: GOLD }} />
        <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Bundle</span>
      </div>
      <div className="p-5">
        <h2 className="text-lg font-bold text-white">{item.title}</h2>
        <p className="mt-1 text-[11px] text-white/40">by {item.creator}</p>
        <p className="mt-3 text-[12px] leading-relaxed text-white/50">
          This bundle contains multiple content items. Access individual items from My Spots.
        </p>
      </div>
      <ViewerMeta item={item} embedded />
    </div>
  );
}

function ViewerMeta({ item, embedded }: { item: MySpotsItem; embedded?: boolean }) {
  return (
    <div className={`px-4 py-3 ${embedded ? '' : 'border-t'}`} style={embedded ? {} : { borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/30">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(item.grantedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        {item.source === 'syncshare' && item.syncsharedBy && (
          <span className="flex items-center gap-1" style={{ color: GOLD + '99' }}>
            <Share2 className="h-3 w-3" />
            SyncShared by {item.syncsharedBy}
          </span>
        )}
        {item.source === 'purchase' && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> Purchased
          </span>
        )}
      </div>
    </div>
  );
}
