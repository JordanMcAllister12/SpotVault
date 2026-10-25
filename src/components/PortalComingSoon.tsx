import { ArrowLeft, type LucideIcon } from 'lucide-react';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface Props {
  portalName: string;
  description: string;
  Icon: LucideIcon;
  onBack?: () => void;
}

export function PortalComingSoon({ portalName, description, Icon, onBack }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080706] px-6 py-16 text-center">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-2xl border"
        style={{ borderColor: BORDER, background: `${GOLD}10` }}
      >
        <Icon className="h-9 w-9" style={{ color: GOLD }} strokeWidth={1.5} />
      </div>

      <div className="mt-6">
        <p
          className="text-[10px] font-mono tracking-[0.3em] uppercase"
          style={{ color: GOLD }}
        >
          {portalName} Portal
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Coming Soon</h2>
      </div>

      <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/40">{description}</p>

      <div
        className="mt-8 rounded-xl border px-6 py-4"
        style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.04)' }}
      >
        <p className="text-[11px] font-semibold text-white/50">
          This portal is in development and will be available to purchase soon.
        </p>
      </div>

      {onBack && (
        <button
          onClick={onBack}
          className="mt-8 flex items-center gap-2 rounded-lg border px-4 py-2 text-[11px] font-semibold tracking-widest text-white/60 uppercase transition-all hover:border-[#c0911e]/40 hover:text-white/80"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Back to Player
        </button>
      )}
    </div>
  );
}
