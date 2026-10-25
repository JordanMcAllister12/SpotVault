import { Play, Video } from 'lucide-react';
import { MediaWidget } from '@/components/player/widgets/MediaWidget';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212,165,44,0.18)';

interface MediaCenterViewProps {
  userId?: string;
  onOpenMySpots?: () => void;
  onOpenMarketplace?: () => void;
}

export function MediaCenterView({ userId, onOpenMySpots }: MediaCenterViewProps) {
  return (
    <div className="mx-auto w-full max-w-5xl px-2 py-3 sm:px-6 sm:py-5">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5 sm:mb-5 sm:gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border sm:h-9 sm:w-9" style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.08)' }}>
          <Video className="h-4 w-4 sm:h-4.5 sm:w-4.5" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-xs font-bold tracking-widest text-white/80 uppercase sm:text-sm">Media Center</h1>
          <p className="text-[9px] text-white/40 sm:text-[10px]">Video player and library.</p>
        </div>
      </div>

      {/* Unified Media Center: player + attached library */}
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.88)' }}>
        <div className="h-[420px] sm:h-[520px]">
          <MediaWidget
            userId={userId}
            onViewAll={onOpenMySpots}
          />
        </div>
      </div>
    </div>
  );
}
