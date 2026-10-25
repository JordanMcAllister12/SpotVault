import { type ReactNode } from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import { PortalWorkspaceShell } from '@/components/shared/PortalWorkspaceShell';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.15)';

interface LegalPageProps {
  title: string;
  subtitle: string;
  onBack?: () => void;
  embedded?: boolean;
  children: ReactNode;
}

export function LegalPageShell({ title, subtitle, onBack, embedded, children }: LegalPageProps) {
  if (embedded) {
    return (
      <PortalWorkspaceShell maxWidth="max-w-3xl">
        <div className="mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="legal-header mb-8 flex items-center gap-3 pb-6">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))',
              border: '1px solid rgba(192,145,30,0.15)',
            }}
          >
            <Shield className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
            <p className="mt-0.5 text-[10px] font-mono tracking-[0.2em] text-[#c0911e]/60 uppercase">{subtitle}</p>
          </div>
        </div>
        <div className="space-y-3 pb-12">{children}</div>
        </div>
      </PortalWorkspaceShell>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#050608]">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 30%, #0c0e11 0%, #08090b 40%, #050608 80%)' }} />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Back button */}
        <button
          onClick={onBack!}
          className="mb-6 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/60 uppercase backdrop-blur-sm transition-all hover:border-white/20 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Back
        </button>

        {/* Header */}
        <div className="legal-header mb-8 flex items-center gap-3 pb-6">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))',
              border: '1px solid rgba(192,145,30,0.15)',
            }}
          >
            <Shield className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
            <p className="mt-0.5 text-[10px] font-mono tracking-[0.2em] text-[#c0911e]/60 uppercase">{subtitle}</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3 pb-12">{children}</div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] pt-6 pb-12">
          <p className="text-[10px] font-mono tracking-widest text-[#364049] uppercase">
            SpotVault · Poker Industry Network
          </p>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  number: number;
  title: string;
  children: ReactNode;
}

export function LegalSection({ number, title, children }: SectionProps) {
  return (
    <section className="legal-section">
      <h2 className="mb-3 flex items-baseline gap-2 text-sm font-bold tracking-wide text-white sm:text-base">
        <span className="text-[10px] font-mono" style={{ color: GOLD }}>{number}.</span>
        {title}
      </h2>
      <div className="space-y-2 pl-5 text-[12px] leading-relaxed text-white/65 sm:text-[13px]">
        {children}
      </div>
    </section>
  );
}

export function LegalPlaceholder({ label }: { label: string }) {
  return (
    <span
      className="inline-block rounded border border-amber-400/20 bg-amber-400/5 px-1.5 py-0.5 text-[10px] font-mono text-amber-400/70"
    >
      [{label}]
    </span>
  );
}

export { GOLD, GOLD_SOFT, BORDER };
