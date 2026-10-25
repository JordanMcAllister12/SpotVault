import { LayoutDashboard } from 'lucide-react';

interface Props {
  account: { id: string; name: string };
  onNavigate?: (view: string) => void;
}

const GOLD = '#d4a52c';

export function CoachHomeWorkspace({ account }: Props) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 px-3 pt-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(10,12,14,0.62)', border: '1px solid rgba(192,145,30,0.18)', borderRadius: '12px', backdropFilter: 'blur(6px)' }}>
          <LayoutDashboard className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: '#f5e6b0' }}>Coach Room</span>
        </div>
      </div>
    </div>
  );
}
