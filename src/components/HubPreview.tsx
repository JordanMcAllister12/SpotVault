import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { DIRECTORY_HUBS, isFounderUser, type SpotVaultAccount } from '@/types';
import { PortalSwitcher } from '@/components/PortalSwitcher';
import type { PortalId } from '@/useDemo';
import { UniversalNavSection } from '@/components/UniversalNavSection';
import type { UniversalView } from '@/components/UniversalRail';

interface Props {
  hubId: string;
  onBack: () => void;
  onOpenCredits: () => void;
  account: SpotVaultAccount | null;
  currentPortal: PortalId;
  onSwitchPortal: (portal: PortalId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
}

export function HubPreview({ hubId, onBack, account, currentPortal, onSwitchPortal, portalSwitchOpen, onTogglePortalSwitch, onClosePortalSwitch, onOpenUniversalView }: Props) {
  const hub = DIRECTORY_HUBS.find((item) => item.id === hubId);
  if (!hub) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#050608]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#1a1f25] bg-[#0a0c0e]/60 px-8 py-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Network
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">{hub.name}</h1>
            <p className="text-[10px] font-mono tracking-[0.2em] text-[#d4a52c]/70 uppercase">{hub.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isFounderUser(account) && <PortalSwitcher account={account} currentPortal={currentPortal} onSwitch={onSwitchPortal} open={portalSwitchOpen} onToggle={onTogglePortalSwitch} onClose={onClosePortalSwitch} accent="#d4a52c" align="right" />}
          <div className="flex items-center gap-2 rounded-full border border-[#232a32] bg-[#161b21] px-3.5 py-1.5">
            {hub.status === 'restricted' || hub.status === 'request' ? <Lock className="h-3 w-3 text-[#aab6c2]" strokeWidth={1.5} /> : <ShieldCheck className="h-3 w-3 text-[#d4a52c]" strokeWidth={1.5} />}
            <span className="text-[10px] font-semibold tracking-widest text-[#aab6c2] uppercase">{hub.statusLabel}</span>
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-[#1a1f25] bg-[#0a0c0e]/40 md:flex md:flex-col">
          <UniversalNavSection onNavigate={onOpenUniversalView} />
        </aside>
        <main className="flex-1" aria-label={`${hub.name} workspace`} />
      </div>
    </div>
  );
}
