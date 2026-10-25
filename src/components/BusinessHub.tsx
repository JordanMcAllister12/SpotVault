import { useState, useEffect } from 'react';
import { Briefcase, LayoutDashboard } from 'lucide-react';
import { PortalRoomShell } from '@/components/PortalRoomShell';
import { buildNavForPortal } from '@/data/portalConfigs';
import type { Demo } from '@/useDemo';
import type { HubId } from '@/types';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';
import type { UniversalView } from '@/components/UniversalRail';
import type { SpotVaultAccount } from '@/types';
import { OpportunitiesPage } from '@/components/OpportunitiesPage';
import { PeopleDirectory } from '@/components/people/PeopleDirectory';
import { PrivacyPolicyPage } from '@/components/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/components/TermsOfServicePage';
import { BusinessProfilePage } from '@/components/business/BusinessProfilePage';
import { BusinessCreateStudio } from '@/components/business/BusinessCreateStudio';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { renderSharedPlayerView } from '@/components/player/SharedPlayerViews';
import type { HubTab } from '@/components/player/ProfileSettingsHub';
import { SettingsPage } from '@/components/player/SettingsPage';
import { IndustryRolodex } from '@/components/professional/IndustryRolodex';
import { PaidRequestsPanel } from '@/components/monetization/PaidRequestsPanel';
import type { ChannelDef } from '@/components/player/ChatPanel';

type BusinessView =
  | 'home'
  | 'people'
  | 'opportunities'
  | 'marketplace'
  | 'create'
  | 'business-profile'
  | 'rolodex'
  | 'paid-requests'
  | 'my-spots'
  | 'my-library'
  | 'public-library'
  | 'hand-analysis'
  | 'hh-workspace'
  | 'analytics'
  | 'content-lab'
  | 'solver'
  | 'market-store'
  | 'spot-store'
  | 'multispot-store'
  | 'stakekings-action'
  | 'profile'
  | 'settings'
  | 'privacy'
  | 'terms';

interface Props {
  demo: Demo;
  onSwitchPortal: (portal: HubId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onBack: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
  hasAnalyticsEntitlement?: boolean;
  initialView?: string;
  onOpenCustomPortals?: () => void;
  customPortalLabel?: string | null;
  activePortalId?: string | null;
  customPortals?: CustomPortalMembership[];
  onEnterCustomPortal?: (portal: CustomPortalMembership) => void;
  onReturnToDefault?: () => void;
}

export function BusinessHub({
  demo, onSwitchPortal, portalSwitchOpen, onTogglePortalSwitch,
  onClosePortalSwitch, onBack, onOpenUniversalView,
  initialView,
  onOpenCustomPortals, customPortalLabel, activePortalId,
  customPortals, onEnterCustomPortal, onReturnToDefault,
}: Props) {
  const { state } = demo;
  const [view, setView] = useState<BusinessView>((initialView as BusinessView) || 'home');
  const [profileTab, setProfileTab] = useState<HubTab>('profile');

  useEffect(() => {
    if (state.portalContentView) setView(state.portalContentView as BusinessView);
  }, [state.portalContentView]);

  const handleNavigate = (v: string) => {
    if (state.portalContentView) demo.actions.closeUniversalView();
    setView(v as BusinessView);
  };

  const navItems = state.currentAccount ? buildNavForPortal('business', state.currentAccount) : [];
  const account = state.currentAccount;

  const sharedView = renderSharedPlayerView({ view, account, onNavigate: (v) => setView(v as BusinessView), profileInitialTab: profileTab });

  return (
    <PortalRoomShell
      demo={demo}
      icon={Briefcase}
      portalLabel="Business Hub"
      roomLabel="Business Room"
      navItems={navItems}
      activeNav={view}
      onNavigate={handleNavigate}
      onSwitchPortal={onSwitchPortal}
      portalSwitchOpen={portalSwitchOpen}
      onTogglePortalSwitch={onTogglePortalSwitch}
      onClosePortalSwitch={onClosePortalSwitch}
      onOpenProfileSettings={(tab) => { setProfileTab(tab); setView('profile' as BusinessView); }}
      onBack={onBack}
      onOpenUniversalView={onOpenUniversalView}
      portalKey="business"
      widgetUserId={account?.id}
      onOpenCustomPortals={onOpenCustomPortals}
      customPortalLabel={customPortalLabel}
      activePortalId={activePortalId}
      customPortals={customPortals}
      onEnterCustomPortal={onEnterCustomPortal}
      onReturnToDefault={onReturnToDefault}
    >
      {view === 'home' && <BusinessHome accountId={account?.id ?? null} />}

      {view === 'people' && <PeopleDirectory account={account ?? undefined} />}
      {view === 'opportunities' && account && (
        <ErrorBoundary variant="widget">
          <OpportunitiesPage account={account} />
        </ErrorBoundary>
      )}
      {view === 'create' && account && (
        <ErrorBoundary variant="widget">
          <BusinessCreateStudio account={account} />
        </ErrorBoundary>
      )}
      {view === 'business-profile' && account && (
        <ErrorBoundary variant="widget">
          <BusinessProfilePage account={account} />
        </ErrorBoundary>
      )}

      {view === 'paid-requests' && account && (
        <ErrorBoundary variant="widget">
          <PaidRequestsPanel userId={account.id} portalType="business" />
        </ErrorBoundary>
      )}

      {view === 'rolodex' && (
        <ErrorBoundary variant="widget">
          <IndustryRolodex viewerRole="business-portal" />
        </ErrorBoundary>
      )}

      {view === 'privacy' && <PrivacyPolicyPage embedded onBack={() => setView('home')} />}
      {view === 'terms' && <TermsOfServicePage embedded onBack={() => setView('home')} />}
      {view === 'settings' && <SettingsPage userId={account?.id} account={account} />}

      {sharedView}
    </PortalRoomShell>
  );
}

const BUSINESS_CHANNELS: ChannelDef[] = [
  { id: 'general', label: 'General' },
  { id: 'network', label: 'Business Community' },
];

const BUSINESS_CHAT_CONFIG = {
  widgetId: 'business-chat',
  portalLabel: 'Business Hub',
  channels: BUSINESS_CHANNELS,
  defaultPos: { x: 24, y: 60 },
  defaultSize: { width: 520, height: 460 },
};

function BusinessHome({ accountId }: { accountId: string | null }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 px-3 pt-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(10,12,14,0.62)', border: '1px solid rgba(192,145,30,0.18)', borderRadius: '12px', backdropFilter: 'blur(6px)' }}>
          <LayoutDashboard className="h-4 w-4" style={{ color: '#d4a52c' }} strokeWidth={1.5} />
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: '#f5e6b0' }}>Business Room</span>
        </div>
      </div>

    </div>
  );
}
