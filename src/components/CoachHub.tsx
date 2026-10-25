import { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { PortalRoomShell } from '@/components/PortalRoomShell';
import type { SpotVaultAccount } from '@/types';
import type { PortalId, Demo } from '@/useDemo';
import type { HubId } from '@/types';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';
import { buildNavForPortal } from '@/data/portalConfigs';
import type { UniversalView } from '@/components/UniversalRail';
import { OpportunitiesPage } from '@/components/OpportunitiesPage';
import { PeopleDirectory } from '@/components/people/PeopleDirectory';
import { PrivacyPolicyPage } from '@/components/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/components/TermsOfServicePage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CoachBusinessPage } from '@/components/coach/CoachBusinessPage';
import { CoachHomeWorkspace } from '@/components/coach/CoachHomeWorkspace';
import { CoachLabView } from '@/components/coach/CoachLabView';
import { renderSharedPlayerView } from '@/components/player/SharedPlayerViews';
import type { HubTab } from '@/components/player/ProfileSettingsHub';
import { SettingsPage } from '@/components/player/SettingsPage';
import { IndustryRolodex } from '@/components/professional/IndustryRolodex';
import { PaidRequestsPanel } from '@/components/monetization/PaidRequestsPanel';

type CoachView =
  | 'home'
  | 'coach-business'
  | 'lab'
  | 'rolodex'
  | 'paid-requests'
  | 'hand-analysis'
  | 'solver'
  | 'analytics'
  | 'opportunities'
  | 'marketplace'
  | 'people'
  | 'my-spots'
  | 'my-library'
  | 'public-library'
  | 'hh-workspace'
  | 'content-lab'
  | 'market-store'
  | 'spot-store'
  | 'multispot-store'
  | 'stakekings-action'
  | 'profile'
  | 'settings'
  | 'privacy'
  | 'terms';

interface Props {
  onBack: () => void;
  onOpenCredits: () => void;
  account: SpotVaultAccount | null;
  currentPortal: PortalId;
  onSwitchPortal: (portal: HubId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
  demo: Demo;
  onOpenCustomPortals?: () => void;
  customPortalLabel?: string | null;
  activePortalId?: string | null;
  customPortals?: CustomPortalMembership[];
  onEnterCustomPortal?: (portal: CustomPortalMembership) => void;
  onReturnToDefault?: () => void;
}

export function CoachHub({
  onBack, onOpenCredits, account, currentPortal, onSwitchPortal,
  portalSwitchOpen, onTogglePortalSwitch, onClosePortalSwitch,
  onOpenUniversalView, demo,
  onOpenCustomPortals, customPortalLabel, activePortalId,
  customPortals, onEnterCustomPortal, onReturnToDefault,
}: Props) {
  const [view, setView] = useState<CoachView>('home');
  const [profileTab, setProfileTab] = useState<HubTab>('profile');

  useEffect(() => {
    if (demo.state.portalContentView) {
      setView(demo.state.portalContentView as CoachView);
    }
  }, [demo.state.portalContentView]);

  const navItems = buildNavForPortal('coach', account);

  const handleNavigate = (v: string) => {
    if (v === 'hh-replayer' || v === 'hh-jukebox') v = 'hand-analysis';
    if (demo.state.portalContentView) demo.actions.closeUniversalView();
    setView(v as CoachView);
  };

  const sharedView = renderSharedPlayerView({ view, account, onNavigate: (v) => setView(v as CoachView), profileInitialTab: profileTab });

  return (
    <PortalRoomShell
      demo={demo}
      icon={GraduationCap}
      portalLabel="Coach"
      roomLabel="Coach Room"
      navItems={navItems}
      activeNav={view}
      onNavigate={handleNavigate}
      onSwitchPortal={onSwitchPortal}
      portalSwitchOpen={portalSwitchOpen}
      onTogglePortalSwitch={onTogglePortalSwitch}
      onClosePortalSwitch={onClosePortalSwitch}
      onBack={onBack}
      onOpenProfileSettings={(tab) => { setProfileTab(tab); setView('profile' as CoachView); }}
      onOpenUniversalView={onOpenUniversalView}
      pushSecondarySectionsDown
      portalKey="coach"
      widgetUserId={account?.id}
      onOpenCustomPortals={onOpenCustomPortals}
      customPortalLabel={customPortalLabel}
      activePortalId={activePortalId}
      customPortals={customPortals}
      onEnterCustomPortal={onEnterCustomPortal}
      onReturnToDefault={onReturnToDefault}
    >
      {view === 'home' && account ? (
        <CoachHomeWorkspace account={account} onNavigate={(v) => setView(v as CoachView)} />
      ) : view === 'coach-business' && account ? (
        <CoachBusinessPage account={account} />
      ) : view === 'lab' && account ? (
        <ErrorBoundary variant="widget">
          <CoachLabView account={account} />
        </ErrorBoundary>
      ) : view === 'paid-requests' && account ? (
        <ErrorBoundary variant="widget">
          <PaidRequestsPanel userId={account.id} portalType="coach" />
        </ErrorBoundary>
      ) : view === 'rolodex' ? (
        <ErrorBoundary variant="widget">
          <IndustryRolodex viewerRole="coach-portal" />
        </ErrorBoundary>
      ) : view === 'opportunities' && account ? (
        <OpportunitiesPage account={account} />
      ) : view === 'people' ? (
        <PeopleDirectory />
      ) : view === 'settings' ? (
        <SettingsPage userId={account?.id} account={account} />
      ) : view === 'privacy' ? (
        <PrivacyPolicyPage embedded onBack={() => setView('home')} />
      ) : view === 'terms' ? (
        <TermsOfServicePage embedded onBack={() => setView('home')} />
      ) : sharedView}
    </PortalRoomShell>
  );
}
