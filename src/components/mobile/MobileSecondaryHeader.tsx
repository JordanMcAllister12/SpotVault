import { ArrowLeft, Zap, type LucideIcon } from 'lucide-react';
import { useDemoUserState } from '@/lib/demoUserStore';
import { FEATURE_FLAGS } from '@/lib/entitlements';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.15)';

interface Props {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onBack: () => void;
  showCredits?: boolean;
}

export function MobileSecondaryHeader({ title, subtitle, icon: Icon, onBack, showCredits = true }: Props) {
  const user = useDemoUserState();

  return (
    <header
      className="shrink-0 border-b"
      style={{
        borderColor: 'rgba(212,165,44,0.12)',
        background: 'rgba(8,7,6,0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Row 1: Back + Title */}
      <div className="flex items-center gap-2 px-4 pt-2.5 pb-1.5">
        <button
          onClick={onBack}
          aria-label="Back"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition-colors active:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />}
            <h1 className="truncate text-sm font-bold tracking-wide text-white">{title}</h1>
          </div>
          {subtitle && (
            <p className="mt-0.5 truncate text-[9px] font-mono tracking-[0.15em] uppercase" style={{ color: 'rgba(212,165,44,0.5)' }}>
              {subtitle}
            </p>
          )}
        </div>

        {showCredits && (
          <div className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1" style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.08)' }}>
            <Zap className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[11px] font-bold" style={{ color: GOLD_SOFT }}>
              {user.credits.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Row 2: Rewards status bar */}
      {showCredits && (
        <div className="flex items-center gap-3 px-4 pb-2 text-[9px]">
          <span className="font-mono font-bold tracking-wider" style={{ color: GOLD_SOFT }}>
            LVL {user.level}
          </span>
          <span className="text-white/15">·</span>
          <span className="font-mono font-bold tracking-wider" style={{ color: GOLD }}>
            {user.tier}
          </span>
          <span className="text-white/15">·</span>
          <span className="font-mono text-white/40">
            {user.xp.toLocaleString()} XP
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Zap className="h-2.5 w-2.5" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="font-mono font-bold" style={{ color: GOLD_SOFT }}>
              0
            </span>
            <span className="ml-1 text-[8px] font-mono tracking-wider text-white/30">
              · SOON
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
