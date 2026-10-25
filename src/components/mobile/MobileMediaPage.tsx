import { Play } from 'lucide-react';
import { MediaWidget } from '@/components/player/widgets/MediaWidget';

const GOLD = '#d4a52c';

export function MobileMediaPage() {
  return (
    <div className="flex min-h-full flex-col px-3 py-3">
      {/* Media Center */}
      <div className="mb-2 flex items-center gap-2">
        <Play className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} fill="currentColor" />
        <span className="text-[10px] font-semibold tracking-[0.18em] text-[#d4a52c]/70 uppercase">Media Center</span>
      </div>
      <MediaWidget />
    </div>
  );
}
