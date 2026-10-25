import { TrendingUp } from 'lucide-react';
import { CoachImpactView } from '@/components/coach/CoachImpactView';

interface Props {
  account: { id: string; name: string };
}

export function PerformancePage({ account }: Props) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.04] px-6 py-4">
          <TrendingUp className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
          <div>
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">Performance</h2>
            <p className="text-[10px] text-[#5f6e7c]">Student improvement metrics and coaching impact</p>
          </div>
        </div>
        <CoachImpactView account={account} />
      </div>
    </div>
  );
}
