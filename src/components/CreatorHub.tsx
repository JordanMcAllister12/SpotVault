import { useState, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { PortalRoomShell } from '@/components/PortalRoomShell';
import { buildNavForPortal } from '@/data/portalConfigs';
import type { Demo } from '@/useDemo';
import type { HubId, SpotVaultAccount } from '@/types';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';
import type { UniversalView } from '@/components/UniversalRail';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CreatorBusinessPage } from '@/components/creator/CreatorBusinessPage';
import { PrivacyPolicyPage } from '@/components/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/components/TermsOfServicePage';
import { renderSharedPlayerView } from '@/components/player/SharedPlayerViews';
import type { HubTab } from '@/components/player/ProfileSettingsHub';
import { SettingsPage } from '@/components/player/SettingsPage';
import { IndustryRolodex } from '@/components/professional/IndustryRolodex';
import { SubscriptionsPanel } from '@/components/monetization/SubscriptionsPanel';
import { PaidRequestsPanel } from '@/components/monetization/PaidRequestsPanel';
import type { ChannelDef } from '@/components/player/ChatPanel';

type CreatorView =
  | 'home'
  | 'my-library'
  | 'public-library'
  | 'hand-analysis'
  | 'hh-workspace'
  | 'analytics'
  | 'content-lab'
  | 'creator-business'
  | 'rolodex'
  | 'subscriptions'
  | 'paid-requests'
  | 'my-spots'
  | 'solver'
  | 'market-store'
  | 'spot-store'
  | 'multispot-store'
  | 'stakekings-action'
  | 'marketplace'
  | 'profile'
  | 'settings'
  | 'privacy'
  | 'terms';

interface Props {
  demo: Demo;
  onExitHub: () => void;
  onOpenCredits: () => void;
  onSwitchPortal: (portal: HubId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
  onCreatePost: () => void;
  account: SpotVaultAccount | null;
  onOpenCustomPortals?: () => void;
  customPortalLabel?: string | null;
  activePortalId?: string | null;
  customPortals?: CustomPortalMembership[];
  onEnterCustomPortal?: (portal: CustomPortalMembership) => void;
  onReturnToDefault?: () => void;
}

export function CreatorHub({
  demo,
  onExitHub,
  onOpenCredits,
  onSwitchPortal,
  portalSwitchOpen,
  onTogglePortalSwitch,
  onClosePortalSwitch,
  onOpenUniversalView,
  onCreatePost,
  account,
  onOpenCustomPortals,
  customPortalLabel,
  activePortalId,
  customPortals,
  onEnterCustomPortal,
  onReturnToDefault,
}: Props) {
  const { state } = demo;
  const [view, setView] = useState<CreatorView>(
    (state.portalContentView as CreatorView) || 'home',
  );
  const [profileTab, setProfileTab] = useState<HubTab>('profile');

  useEffect(() => {
    if (state.portalContentView) {
      setView(state.portalContentView as CreatorView);
    }
  }, [state.portalContentView]);

  const handleNavigate = (v: string) => {
    if (v === 'hh-replayer' || v === 'hh-jukebox') v = 'hand-analysis';
    if (state.portalContentView) demo.actions.closeUniversalView();
    setView(v as CreatorView);
  };

  const navItems = account ? buildNavForPortal('creator', account) : [];

  const sharedView = renderSharedPlayerView({ view, account, onNavigate: (v) => setView(v as CreatorView), profileInitialTab: profileTab });

  return (
    <PortalRoomShell
      demo={demo}
      icon={Camera}
      portalLabel="Creator / Talent"
      roomLabel="Creator / Talent Room"
      navItems={navItems}
      activeNav={view}
      onNavigate={handleNavigate}
      onSwitchPortal={onSwitchPortal}
      portalSwitchOpen={portalSwitchOpen}
      onTogglePortalSwitch={onTogglePortalSwitch}
      onClosePortalSwitch={onClosePortalSwitch}
      onBack={onExitHub}
      onOpenUniversalView={onOpenUniversalView}
      onOpenProfileSettings={(tab) => { setProfileTab(tab); setView('profile' as CreatorView); }}
      onOpenCredits={onOpenCredits}
      portalKey="creator"
      widgetUserId={account?.id}
      onOpenCustomPortals={onOpenCustomPortals}
      customPortalLabel={customPortalLabel}
      activePortalId={activePortalId}
      customPortals={customPortals}
      onEnterCustomPortal={onEnterCustomPortal}
      onReturnToDefault={onReturnToDefault}
    >
      {view === 'home' && (
        <CreatorHome accountId={account?.id ?? null} account={account} />
      )}

      {view === 'creator-business' && account && (
        <ErrorBoundary variant="widget">
          <CreatorBusinessPage account={account} />
        </ErrorBoundary>
      )}

      {view === 'subscriptions' && account && (
        <ErrorBoundary variant="widget">
          <SubscriptionsPanel creatorUserId={account.id} creatorName={account.name} />
        </ErrorBoundary>
      )}

      {view === 'paid-requests' && account && (
        <ErrorBoundary variant="widget">
          <PaidRequestsPanel userId={account.id} portalType="creator" />
        </ErrorBoundary>
      )}

      {view === 'rolodex' && (
        <ErrorBoundary variant="widget">
          <IndustryRolodex viewerRole="creator-portal" />
        </ErrorBoundary>
      )}

      {view === 'privacy' && (
        <PrivacyPolicyPage embedded onBack={() => setView('home')} />
      )}
      {view === 'terms' && (
        <TermsOfServicePage embedded onBack={() => setView('home')} />
      )}
      {view === 'settings' && (
        <SettingsPage userId={account?.id} account={account} />
      )}

      {sharedView}
    </PortalRoomShell>
  );
}

const CREATOR_CHANNELS: ChannelDef[] = [
  { id: 'general', label: 'General' },
  { id: 'network', label: 'Creator Community' },
];

const CREATOR_CHAT_CONFIG = {
  widgetId: 'creator-chat',
  portalLabel: 'Creator Lounge',
  channels: CREATOR_CHANNELS,
  defaultPos: { x: 24, y: 60 },
  defaultSize: { width: 520, height: 460 },
};

function CreatorHome({ accountId, account }: { accountId: string | null; account: SpotVaultAccount | null }) {
  return null;
}
