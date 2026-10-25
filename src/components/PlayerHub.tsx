import { useState, useCallback, useEffect } from 'react';
import {
  BarChart3,
  FlaskConical,
  Play,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { PortalRoomShell } from '@/components/PortalRoomShell';
import { HomeWorkspace } from '@/components/player/HomeWorkspace';
import { AnalyticsView } from '@/components/player/AnalyticsView';
import { HandAnalysisView } from '@/components/player/HandAnalysisView';
import { StudentCenter } from '@/components/player/StudentCenter';
import { MySpotsView } from '@/components/player/MySpotsView';
import { PublicLibraryView } from '@/components/player/PublicLibraryView';
import { ContentLabView } from '@/components/player/ContentLabView';
import { HHJukeboxView } from '@/components/player/HHJukeboxView';
import { TournamentWorkspaceView } from '@/components/player/TournamentWorkspaceView';
import { BookingComingSoon } from '@/components/booking/BookingComingSoon';

import { ProfileSettingsHub, type HubTab } from '@/components/player/ProfileSettingsHub';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EnvironmentMediaScreen } from '@/components/player/EnvironmentMediaScreen';
import { CustomPortalsBrowser } from '@/components/CustomPortalsBrowser';
import { Store } from '@/components/Store';
import { StakeKingsActionMarketplace } from '@/components/stakekings/StakeKingsActionMarketplace';
import { PeopleDirectory } from '@/components/people/PeopleDirectory';
import { PrivacyPolicyPage } from '@/components/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/components/TermsOfServicePage';
import { SolverHub } from '@/components/solver/SolverHub';
import { PLAYER_NAV } from '@/data/portalConfigs';

import { AboutPage } from '@/components/AboutPage';
import type { Demo } from '@/useDemo';
import { isSuperUser as isSuperUserCheck } from '@/types';
import type { HubId } from '@/types';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';
import type { MediaItem } from '@/data/mediaLibrary';
import type { UniversalView } from '@/components/UniversalRail';
import { fetchSpotById, type ContentSpot } from '@/lib/contentLab';
import { onOpenProfileSettings, consumePendingProfileSettingsTab, type ProfileSettingsTab } from '@/lib/profileEvents';
import { fetchWorkspaceHandQueue, markQueueItemConsumed } from '@/lib/workspaceHandQueueStore';

const GOLD_BRIGHT = '#d4a52c';

interface Props {
  demo: Demo;
  onExitHub: () => void;
  onNetworkDirectory: () => void;
  onOpenCredits: () => void;
  onSwitchPortal: (portal: HubId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onPortalChatActiveChange?: (active: boolean) => void;
  portalChatActive: boolean;
  onOpenUniversalView: (view: UniversalView) => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onNavigateRight?: () => void;
  onOpenCommunity?: () => void;
  onOpenMessaging?: () => void;
  initialView?: string;
  /** StakeKings branding overrides — null/undefined for normal SpotVault portal. */
  portalLogoOverride?: string | null;
  backgroundOverride?: string | null;
  portalLabelOverride?: string;
  roomLabelOverride?: string;
  portalContext?: 'player' | 'stakekings';
  accentOverride?: string;
  activePortalSlug?: string | null;
  onOpenCustomPortals?: () => void;
  customPortalLabel?: string | null;
  onEnterCustomPortal?: (portal: CustomPortalMembership) => void;
  activePortalId?: string | null;
  customPortals?: CustomPortalMembership[];
  onReturnToDefault?: () => void;
  onLogout?: () => void;
}

type PlayerView =
  | 'explore'
  | 'home'
  | 'profile'
  | 'my-spots'
  | 'public-library'
  | 'spot-store'
  | 'multispot-store'
  | 'hand-analysis'
  | 'hh-workspace'
  | 'tournament-workspace'
  | 'analytics'
  | 'content-lab'
  | 'student'
  | 'market-store'
  | 'bookings'
  | 'people'
  | 'discover'
  | 'stakekings-action'
  | 'privacy'
  | 'terms'
  | 'solver'
  | 'settings'
  | 'about'
  | 'custom-portals';

type HomeWidget = 'media' | 'my-spots' | 'stats' | 'analytics' | 'notes' | 'schedule' | 'chat';

export function PlayerHub({
  demo,
  onExitHub,
  onOpenCredits,
  onSwitchPortal,
  portalSwitchOpen,
  onTogglePortalSwitch,
  onClosePortalSwitch,
  onOpenUniversalView,
  onNavigateUp,
  onNavigateDown,
  onNavigateRight,
  onOpenCommunity,
  onOpenMessaging,
  initialView,
  portalLogoOverride,
  backgroundOverride,
  portalLabelOverride,
  roomLabelOverride,
  portalContext,
  accentOverride,
  activePortalSlug,
  onOpenCustomPortals,
  customPortalLabel,
  onEnterCustomPortal,
  activePortalId,
  customPortals,
  onReturnToDefault,
  onLogout,
}: Props) {
  const { state, actions } = demo;
  const [view, setView] = useState<PlayerView>((initialView as PlayerView) || 'home');
  const [profileTab, setProfileTab] = useState<HubTab>('profile');
  const [externalPlayItem, setExternalPlayItem] = useState<MediaItem | null>(null);
  const [tvOn, setTvOn] = useState(false);
  const [editSpot, setEditSpot] = useState<ContentSpot | null>(null);
  const [pendingBatchId, setPendingBatchId] = useState<string | null>(null);
  const [workspaceHandId, setWorkspaceHandId] = useState<string | null>(null);
  const [workspaceReturnTo, setWorkspaceReturnTo] = useState<PlayerView | null>(null);

  const navItems = PLAYER_NAV;

  const handlePlayHandInWorkspace = useCallback((handId: string) => {
    setWorkspaceReturnTo(view);
    setWorkspaceHandId(handId);
    setView('hand-analysis');
  }, [view]);

  const handleWorkspaceReturn = useCallback(() => {
    if (workspaceReturnTo) setView(workspaceReturnTo);
    else setView('home');
    setWorkspaceHandId(null);
    setWorkspaceReturnTo(null);
  }, [workspaceReturnTo]);

  useEffect(() => {
    if (view !== 'hh-workspace') return;
    if (workspaceHandId) return;
    let cancelled = false;
    (async () => {
      const queue = await fetchWorkspaceHandQueue();
      if (cancelled || queue.length === 0) return;
      const next = queue.find((item) => !item.consumed) ?? queue[0];
      setWorkspaceHandId(next.hand_id);
      void markQueueItemConsumed(next.id);
    })();
    return () => { cancelled = true; };
  }, [view, workspaceHandId]);

  const handleEditSpotId = useCallback(async (spotId: string) => {
    const spot = await fetchSpotById(spotId);
    if (!spot) return;
    setEditSpot(spot);
    setView('content-lab');
  }, []);

  const handleEditConsumed = useCallback(() => setEditSpot(null), []);
  const handleExitEditor = useCallback(() => { setEditSpot(null); setView('my-spots'); }, []);

  // Sync portalContentView from the global state into local view state.
  // This lets sidebar Network/Legal links navigate within the shell.
  useEffect(() => {
    if (state.portalContentView && !editSpot) {
      setView(state.portalContentView as PlayerView);
    }
  }, [state.portalContentView, editSpot]);

  // Consume a pending spot open request.
  useEffect(() => {
    if (state.pendingSpotOpenId && !editSpot) {
      void handleEditSpotId(state.pendingSpotOpenId);
      actions.setPendingSpotOpenId(null);
    }
  }, [state.pendingSpotOpenId, editSpot]);

  // Consume pending profile-settings tab from a dispatch that occurred before PlayerHub mounted
  useEffect(() => {
    const pending = consumePendingProfileSettingsTab();
    if (pending) {
      setProfileTab(pending);
      setView('profile');
    }
  }, []);

  // Listen for global profile-settings navigation (e.g. from Community header dropdown)
  useEffect(() => {
    const unsub = onOpenProfileSettings((tab: ProfileSettingsTab) => {
      setProfileTab(tab);
      setView('profile');
    });
    return unsub;
  }, []);

  const handlePlayOnTv = useCallback((item: MediaItem) => {
    setExternalPlayItem(item);
    setTvOn(true);
    if (view !== 'home') setView('home');
  }, [view]);

  const handleNavigate = (v: string) => {
    if (v === 'community') {
      onOpenCommunity?.();
      return;
    }
    if (v === 'lounge') {
      onOpenMessaging?.();
      return;
    }
    if (v !== 'content-lab') setEditSpot(null);
    if (v === 'hh-replayer') v = 'hand-analysis';
    if (v === 'student' || v === 'hh-jukebox' || v === 'hh-workspace') v = 'hand-analysis';
    if (state.portalContentView) actions.closeUniversalView();
    setView(v as PlayerView);
  };

  return (
    <PortalRoomShell
      demo={demo}
      icon={MessageSquare}
      portalLabel={portalLabelOverride ?? "Player"}
      roomLabel={roomLabelOverride ?? "Player Room"}
      navItems={navItems}
      activeNav={editSpot ? 'my-spots' : view}
      onNavigate={handleNavigate}
      onSwitchPortal={onSwitchPortal}
      portalSwitchOpen={portalSwitchOpen}
      onTogglePortalSwitch={onTogglePortalSwitch}
      onClosePortalSwitch={onClosePortalSwitch}
      onBack={onExitHub}
      onOpenUniversalView={onOpenUniversalView}
      onOpenProfileSettings={(tab) => { setProfileTab(tab); setView('profile'); }}
      onOpenCredits={onOpenCredits}
      backgroundOverride={backgroundOverride}
      portalLogoOverride={portalLogoOverride}
      accentOverride={accentOverride}
      onOpenCustomPortals={onOpenCustomPortals}
      customPortalLabel={customPortalLabel}
      activePortalId={activePortalId}
      customPortals={customPortals}
      onEnterCustomPortal={onEnterCustomPortal}
      onReturnToDefault={onReturnToDefault}
      onOpenCommunity={onOpenCommunity}
      onLogout={onLogout}
      expandAllSections={false}
      onOpenLoungesNav={() => {
        // Communications — unified across all portals.
        onOpenMessaging?.();
      }}
    >
      {tvOn && view === 'home' && (
        <EnvironmentMediaScreen
          externalPlayItem={externalPlayItem}
          onExternalPlayConsumed={() => setExternalPlayItem(null)}
          enabled
          onPowerOff={() => setTvOn(false)}
        />
      )}

      {view === 'home' && (
        <HomeWorkspace
          onOpenAnalytics={() => setView('analytics')}
          onOpenMySpots={() => setView('my-spots')}
          onPlayOnTv={handlePlayOnTv}
          onNavigateUp={onNavigateUp}
          onNavigateDown={onNavigateDown}
          onNavigateRight={onOpenMessaging}
          userId={state.currentAccount?.id}
          account={state.currentAccount}
        />
      )}

      {view === 'profile' && state.currentAccount && (
        <ProfileSettingsHub
          account={state.currentAccount}
          onBack={() => setView('home')}
          portalContext={portalContext}
          initialTab={profileTab}
        />
      )}

      {view === 'my-spots' && (
        <MySpotsView
          userId={state.currentAccount?.id}
          onOpenHHJukebox={() => setView('hand-analysis')}
          onOpenTournamentWorkspace={() => setView('tournament-workspace')}
          onEditSpot={(spot) => { setEditSpot(spot); setView('content-lab'); }}
          onEditSpotId={handleEditSpotId}
          onOpenBatch={(reviewSetId) => { setPendingBatchId(reviewSetId); setView('hand-analysis'); }}
          portalSlug={activePortalSlug ?? null}
        />
      )}

      {view === 'public-library' && (
        <PublicLibraryView portalSlug={activePortalSlug ?? null} />
      )}

      {view === 'hand-analysis' && (
        <ErrorBoundary variant="widget">
          <HandAnalysisView
            userId={state.currentAccount?.id}
            initialBatchId={pendingBatchId}
            onBatchConsumed={() => setPendingBatchId(null)}
            initialHandId={workspaceHandId}
            onHandConsumed={() => setWorkspaceHandId(null)}
          />
        </ErrorBoundary>
      )}

      {view === 'hh-workspace' && (
        <ErrorBoundary variant="widget">
          <StudentCenter
            fill
            onMessageCoach={() => {}}
            initialBatchId={pendingBatchId}
            onBatchConsumed={() => setPendingBatchId(null)}
            initialHandId={workspaceHandId}
            onHandConsumed={() => setWorkspaceHandId(null)}
            showReturnButton={!!workspaceReturnTo}
            onReturn={handleWorkspaceReturn}
          />
        </ErrorBoundary>
      )}

      {view === 'tournament-workspace' && (
        <ErrorBoundary variant="widget">
          <TournamentWorkspaceView />
        </ErrorBoundary>
      )}

      {view === 'analytics' && (
        <ErrorBoundary variant="widget">
          <AnalyticsView userId={state.currentAccount?.id} account={state.currentAccount} onPlayHand={handlePlayHandInWorkspace} />
        </ErrorBoundary>
      )}

      {view === 'content-lab' && state.currentAccount && (
        <ErrorBoundary variant="widget">
          <ContentLabView
            account={state.currentAccount}
            onOpenLibrary={() => { setEditSpot(null); setView('my-spots'); }}
            editSpot={editSpot}
            onEditConsumed={handleEditConsumed}
            onExitEditor={handleExitEditor}
            portalSlug={activePortalSlug ?? null}
          />
        </ErrorBoundary>
      )}

      {view === 'bookings' && (
        <BookingComingSoon />
      )}

      {view === 'solver' && state.currentAccount && (
        <ErrorBoundary variant="widget">
          <SolverHub
            account={state.currentAccount}
            isSuperUser={isSuperUserCheck(state.currentAccount)}
          />
        </ErrorBoundary>
      )}

      {view === 'market-store' && (
        <Store account={state.currentAccount} />
      )}

      {view === 'spot-store' && (
        <PublicLibraryView portalSlug={activePortalSlug ?? null} />
      )}

      {view === 'multispot-store' && (
        <ErrorBoundary variant="widget">
          <HHJukeboxView userId={state.currentAccount?.id} onOpenHandWorkspace={() => setView('hand-analysis')} />
        </ErrorBoundary>
      )}

      {view === 'stakekings-action' && (
        <StakeKingsActionMarketplace onViewPlayer={() => setView('discover')} />
      )}

      {(view === 'people' || view === 'discover') && (
        <PeopleDirectory
          account={state.currentAccount}
          onBuyAction={() => setView('stakekings-action')}
        />
      )}

      {view === 'privacy' && (
        <PrivacyPolicyPage embedded onBack={() => setView('home')} />
      )}

      {view === 'terms' && (
        <TermsOfServicePage embedded onBack={() => setView('home')} />
      )}

      {view === 'about' && (
        <AboutPage onBack={() => setView('home')} />
      )}

      {view === 'custom-portals' && (
        <CustomPortalsBrowser
          open
          onClose={() => setView('home')}
          account={state.currentAccount}
          existingMemberships={state.customPortalMemberships}
          onRedeemed={actions.handlePortalRedeemed}
          onEnterPortal={(portal) => {
            onEnterCustomPortal?.(portal);
            setView('home');
          }}
        />
      )}

    </PortalRoomShell>
  );
}

function ToolShell({
  icon: Icon,
  title,
  tagline,
  children,
}: {
  icon: LucideIcon;
  title: string;
  tagline: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6 sm:py-4">
      <div
        className="rounded-2xl border border-[#c0911e]/12 bg-black/30 p-6 backdrop-blur-md sm:p-8"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 12px 40px -16px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.04] pb-5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))',
              border: '1px solid rgba(192,145,30,0.15)',
            }}
          >
            <Icon className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD_BRIGHT }} />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
            <span className="text-[10px] font-mono tracking-[0.2em] text-[#c0911e]/60 uppercase">
              {tagline}
            </span>
          </div>
        </div>
        <div className="pt-6">{children}</div>
      </div>
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="max-w-sm text-sm leading-relaxed text-white/35">{children}</p>
    </div>
  );
}
