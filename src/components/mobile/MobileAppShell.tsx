import { useState, useCallback, useEffect, useRef } from 'react';
import { Menu, ChevronRight, Library, FlaskConical, Zap,
  MessageSquare, MessageCircle, TrendingUp, CalendarCheck, Newspaper, Video,
  type LucideIcon,
} from 'lucide-react';
import { MobileNavDrawer } from '@/components/mobile/MobileNavDrawer';
import { PortalSwitcher } from '@/components/PortalSwitcher';
import { MessagingCenter } from '@/components/messaging/MessagingCenter';
import { MobileLoungeHub } from '@/components/lounge/MobileLoungeHub';
import { MobileMediaPage } from '@/components/mobile/MobileMediaPage';
import { CommunityFeed } from '@/components/CommunityFeed';
import { FeedFlipCard } from '@/components/shared/FeedFlipCard';
import { dispatchMessageUser } from '@/lib/profileEvents';
import { IndustryWire } from '@/components/IndustryWire';
import { OfficialMainFeed } from '@/components/community/OfficialMainFeed';import type { LoungeOption } from '@/components/lounge/MobileLoungeSelector';
import { BookingComingSoon } from '@/components/booking/BookingComingSoon';
import { DEMO_USER } from '@/data/demoData';
import { HandAnalysisView } from '@/components/player/HandAnalysisView';
import { MySpotsView } from '@/components/player/MySpotsView';
import { StudentCenter } from '@/components/player/StudentCenter';
import { ContentLabView } from '@/components/player/ContentLabView';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { initSweatUser, postSweat } from '@/lib/sweatStore';
import { useSweatStore } from '@/lib/sweatStore';
import { ProfileSettingsHub } from '@/components/player/ProfileSettingsHub';
import { SolverHub } from '@/components/solver/SolverHub';
import { PublicLibraryView } from '@/components/player/PublicLibraryView';
import { SettingsPage } from '@/components/player/SettingsPage';
import { AboutPage } from '@/components/AboutPage';
import { isSuperUser as isSuperUserCheck, isFounderUser } from '@/types';
import { DEMO_SWEATS } from '@/data/mobileDemoData';
import { AnalyticsView } from '@/components/player/AnalyticsView';
import { PeopleDirectory } from '@/components/people/PeopleDirectory';
import { OpportunitiesPage } from '@/components/OpportunitiesPage';
import { Store } from '@/components/Store';
import { HHJukeboxView } from '@/components/player/HHJukeboxView';
import { StakeKingsActionMarketplace } from '@/components/stakekings/StakeKingsActionMarketplace';
import { fetchSpotById, type ContentSpot } from '@/lib/contentLab';

import { PrivacyPolicyPage } from '@/components/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/components/TermsOfServicePage';
import { useDemoUserState } from '@/lib/demoUserStore';
import { useUserPreferences } from '@/hooks/useUserPreferences';

import type { Demo, PortalId } from '@/useDemo';
import type { SpotVaultAccount } from '@/types';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';
const ROOM_BG = '/player-portal-high-roller-lounge.webp';

type BottomTab = 'social' | 'media' | 'main-feed' | 'comms' | 'sweat';
type ToolView = 'analytics' | 'hand-analysis' | 'hh-workspace' | 'student' | 'my-spots' | 'public-library' | 'content-lab' | 'profile' | 'solver' | 'settings' | 'about';
type NetworkView = 'people' | 'opportunities' | 'marketplace' | 'privacy' | 'terms' | 'bookings' | 'market-store' | 'spot-store' | 'multispot-store' | 'stakekings-action';

interface Props {
  currentScreen: string;
  demo: Demo;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onNavigateRight: () => void;
  onNavigateLeft: () => void;
  onExitHub: () => void;
  onSwitchPortal?: (portal: PortalId) => void;
  backgroundOverride?: string | null;
  customPortalLabel?: string | null;
  activePortalId?: string | null;
  customPortals?: CustomPortalMembership[];
  onEnterCustomPortal?: (portal: CustomPortalMembership) => void;
  onReturnToDefault?: () => void;

}

const TABS: { id: BottomTab; label: string; icon: LucideIcon }[] = [
  { id: 'social', label: 'Social Feed', icon: MessageSquare },
  { id: 'media', label: 'Media', icon: Video },
  { id: 'main-feed', label: 'Info', icon: Newspaper },
  { id: 'comms', label: 'Comms', icon: MessageCircle },
  { id: 'sweat', label: 'Sweat Rail', icon: TrendingUp },
];

const LOUNGE_OPTIONS: LoungeOption[] = [
  {
    slug: 'manitoba-poker',
    name: 'Manitoba Poker',
    configOverride: {
      name: 'Manitoba Poker',
      type: 'geographic',
      modules: [
        { id: 'left-live', type: 'liveTournaments', position: 'left', priority: 1, settings: { region: 'Manitoba' } },
        { id: 'center-feed', type: 'socialFeed', position: 'center', priority: 1 },
        { id: 'right-events', type: 'events', position: 'right', priority: 1 },
      ],
      feedSettings: { placeholder: "What's happening in Manitoba poker?", showComposer: true },
      eventSettings: { title: 'Tonight in Manitoba', region: 'Manitoba' },
    },
  },
  {
    slug: 'low-stakes-mtt',
    name: 'Low Stakes MTTs',
    configOverride: {
      name: 'Low Stakes MTTs',
      type: 'stakes',
      modules: [
        { id: 'center-feed', type: 'socialFeed', position: 'center', priority: 1 },
        { id: 'right-chat', type: 'groupChat', position: 'right', priority: 1 },
      ],
      feedSettings: { placeholder: "What's happening at the tables?", showComposer: true },
    },
  },
];


let demoSweatsSeeded = false;

function seedDemoSweats() {
  if (demoSweatsSeeded) return;
  demoSweatsSeeded = true;
  initSweatUser('demo-user', DEMO_USER.name);
  for (const s of DEMO_SWEATS) {
    postSweat(s.site, s.tournament, s.table, s.position, s.stack, s.comment, s.category);
  }
}

export function MobileAppShell({
  currentScreen,
  demo,
  onNavigateUp,
  onExitHub,
  onSwitchPortal,
  backgroundOverride,
  customPortalLabel,
  activePortalId,
  customPortals,
  onEnterCustomPortal,
  onReturnToDefault,
}: Props) {
  const { state } = demo;
  const account = state.currentAccount;
  const [portalSwitchOpen, setPortalSwitchOpen] = useState(false);
  const userPrefs = useUserPreferences(account?.id);
  const userSiteBg = userPrefs.prefs.siteBgType === 'custom' && userPrefs.prefs.siteBgValue
    ? userPrefs.prefs.siteBgValue
    : userPrefs.prefs.siteBgType === 'preset' && userPrefs.prefs.siteBgValue
      ? userPrefs.prefs.siteBgValue
      : null;
  const bgImage = backgroundOverride ?? userSiteBg ?? ROOM_BG;

  const [tab, setTab] = useState<BottomTab>('social');
  const [activeTool, setActiveTool] = useState<ToolView | null>(null);
  const [editSpot, setEditSpot] = useState<ContentSpot | null>(null);
  const [activeNetwork, setActiveNetwork] = useState<NetworkView | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLoungeSlug, setSelectedLoungeSlug] = useState('manitoba-poker');
  const [workspaceHandId, setWorkspaceHandId] = useState<string | null>(null);
  const [workspaceReturnTo, setWorkspaceReturnTo] = useState<ToolView | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);

  const demoUser = useDemoUserState();

  useEffect(() => {
    seedDemoSweats();
  }, []);

  useEffect(() => {
    if (currentScreen === 'PLAYER_COMMUNITY') { setTab('social'); setActiveTool(null); }
    else if (currentScreen === 'PLAYER_MAIN_FEED') { setTab('main-feed'); setActiveTool(null); }
    else if (currentScreen === 'PLAYER_CHAT') { setTab('comms'); setActiveTool(null); }
  else if (currentScreen === 'PLAYER_NETWORK') { setTab('comms'); setActiveTool(null); }
  }, [currentScreen]);

  const switchTab = useCallback((newTab: BottomTab) => {
    setActiveTool(null);
    setTab(newTab);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleDrawerSelect = useCallback((id: string) => {
    if (id !== 'content-lab') setEditSpot(null);
    if (id === 'hh-workspace') id = 'student';
    const toolViews: ToolView[] = ['analytics', 'hand-analysis', 'student', 'hh-workspace', 'my-spots', 'public-library', 'content-lab', 'profile', 'solver'];
    const networkViews: NetworkView[] = ['people', 'opportunities', 'marketplace', 'privacy', 'terms', 'bookings', 'market-store', 'spot-store', 'multispot-store', 'stakekings-action'];
    if (id === 'home') { setActiveTool(null); setActiveNetwork(null); setTab('social'); return; }
    if (id === 'discover') { setActiveTool(null); setActiveNetwork('people'); return; }
    if (id === 'player-network') { onNavigateUp(); return; }
    if (id === 'profile') {
      setActiveNetwork(null);
      setActiveTool('profile');
      return;
    }
    if (id === 'settings') { setActiveNetwork(null); setActiveTool('settings'); return; }
    if (id === 'about') { setActiveNetwork(null); setActiveTool('about'); return; }
    if (id === 'solver') { setActiveNetwork(null); setActiveTool('solver'); return; }
    if (toolViews.includes(id as ToolView)) { setActiveNetwork(null); setActiveTool(id as ToolView); return; }
    if (networkViews.includes(id as NetworkView)) { setActiveTool(null); setActiveNetwork(id as NetworkView); return; }
  }, [onNavigateUp, account]);

  const handleBack = useCallback(() => {
    if (activeTool) setActiveTool(null);
    if (activeNetwork) setActiveNetwork(null);
  }, [activeTool, activeNetwork]);

  const handlePlayHandInWorkspace = useCallback((handId: string) => {
    setWorkspaceHandId(handId);
    setWorkspaceReturnTo(activeTool);
    setActiveTool('student');
  }, [activeTool]);

  const handleWorkspaceReturn = useCallback(() => {
    if (workspaceReturnTo) {
      setActiveTool(workspaceReturnTo);
    } else {
      setActiveTool(null);
    }
    setWorkspaceHandId(null);
    setWorkspaceReturnTo(null);
  }, [workspaceReturnTo]);



  const headerTitle = activeTool
    ? TOOL_TITLES[activeTool]
    : activeNetwork
      ? NETWORK_TITLES[activeNetwork]
      : TABS.find((t) => t.id === tab)?.label ?? 'SpotVault';

  const showBack = activeTool !== null || activeNetwork !== null;

  return (
    <div className="fixed inset-0 z-10 flex flex-col overflow-hidden bg-[#050608]">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: `url("${bgImage}")`,
          backgroundPosition: 'center 25%',
          backgroundSize: 'cover',
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />

      {/* Header */}
      <div
        className="relative z-30 flex shrink-0 items-center gap-2 border-b px-3"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(3rem + env(safe-area-inset-top))',
          borderColor: 'rgba(212,165,44,0.12)',
          background: 'rgba(8,7,6,0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors active:bg-white/10"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {showBack && (
          <button
            onClick={handleBack}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:text-white/90"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>
        )}

        {onSwitchPortal && account && isFounderUser(account) ? (
          <PortalSwitcher
            account={account}
            currentPortal={state.selectedPortal}
            onSwitch={(p) => { setPortalSwitchOpen(false); onSwitchPortal(p); }}
            open={portalSwitchOpen}
            onToggle={() => setPortalSwitchOpen((v) => !v)}
            onClose={() => setPortalSwitchOpen(false)}
            align="left"
            customPortalLabel={customPortalLabel}
            activePortalId={activePortalId}
            customPortals={customPortals}
            onEnterCustomPortal={onEnterCustomPortal}
            onReturnToDefault={onReturnToDefault}
          />
        ) : (
          <h2 className="text-sm font-bold tracking-wide text-white">{headerTitle}</h2>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold tracking-wider" style={{ color: GOLD_SOFT }}>
            LVL {demoUser.level}
          </span>
          <span className="text-white/15">·</span>
          <span className="text-[9px] font-mono font-bold tracking-wider" style={{ color: GOLD }}>
            {demoUser.tier}
          </span>
          <span className="text-white/15">·</span>
          <div className="flex items-center gap-0.5">
            <Zap className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[10px] font-mono font-bold" style={{ color: GOLD_SOFT }}>
              {demoUser.credits.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div
        ref={contentRef}
        className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', overscrollBehavior: 'contain' }}
      >
        {/* Network views */}
        {activeNetwork === 'opportunities' && account && (
          <OpportunitiesPage account={account} />
        )}
        {activeNetwork === 'marketplace' && (
          <Store account={account} />
        )}
        {activeNetwork === 'market-store' && (
          <Store account={account} />
        )}
        {activeNetwork === 'spot-store' && (
          <PublicLibraryView />
        )}
        {activeNetwork === 'multispot-store' && (
          <ErrorBoundary variant="widget">
            <HHJukeboxView userId={account?.id} />
          </ErrorBoundary>
        )}
        {activeNetwork === 'stakekings-action' && (
          <StakeKingsActionMarketplace onViewPlayer={() => setActiveNetwork('people')} />
        )}
        {activeNetwork === 'people' && (
          <PeopleDirectory />
        )}
        {activeNetwork === 'privacy' && (
          <PrivacyPolicyPage embedded onBack={() => setActiveNetwork(null)} />
        )}
        {activeNetwork === 'terms' && (
          <TermsOfServicePage embedded onBack={() => setActiveNetwork(null)} />
        )}
        {activeNetwork === 'bookings' && (
          <BookingComingSoon />
        )}
        {activeNetwork === 'bookings_unused' && !account && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-white/35">Sign in to view bookings.</p>
          </div>
        )}

        {/* Tool views */}
        {activeTool === 'analytics' && (
          <ErrorBoundary variant="widget">
            <AnalyticsView userId={account?.id} account={account} onPlayHand={handlePlayHandInWorkspace} />
          </ErrorBoundary>
        )}
        {activeTool === 'hand-analysis' && (
          <ErrorBoundary variant="widget">
            <HandAnalysisView userId={account?.id} />
          </ErrorBoundary>
        )}
        {activeTool === 'student' && (
          <ErrorBoundary variant="widget">
            <StudentCenter
              fill
              onMessageCoach={() => setActiveTool(null)}
              initialHandId={workspaceHandId}
              onHandConsumed={() => setWorkspaceHandId(null)}
              showReturnButton={!!workspaceReturnTo}
              onReturn={handleWorkspaceReturn}
            />
          </ErrorBoundary>
        )}
        {activeTool === 'my-spots' && (
          <MySpotsView
            userId={account?.id}
            onEditSpot={(spot) => { setEditSpot(spot); setActiveTool('content-lab'); }}
            onEditSpotId={async (spotId) => {
              const spot = await fetchSpotById(spotId);
              if (spot) { setEditSpot(spot); setActiveTool('content-lab'); }
            }}
          />
        )}
        {activeTool === 'public-library' && (
          <PublicLibraryView />
        )}
        {activeTool === 'content-lab' && account && (
          <ErrorBoundary variant="widget">
            <ContentLabView
              account={account}
              onOpenLibrary={() => { setEditSpot(null); setActiveTool('my-spots'); }}
              editSpot={editSpot}
              onEditConsumed={() => setEditSpot(null)}
              onExitEditor={() => { setEditSpot(null); setActiveTool('my-spots'); }}
            />
          </ErrorBoundary>
        )}
        {activeTool === 'profile' && account && (
          <ProfileSettingsHub
            account={account}
            onBack={() => setActiveTool(null)}
          />
        )}
        {activeTool === 'solver' && account && (
          <ErrorBoundary variant="widget">
            <SolverHub
              account={account}
              isSuperUser={isSuperUserCheck(account)}
            />
          </ErrorBoundary>
        )}
        {activeTool === 'about' && (
          <div className="fixed inset-0 z-[60] isolate overflow-hidden bg-[#050608]">
            <AboutPage onBack={() => setActiveTool(null)} />
          </div>
        )}
        {activeTool === 'settings' && (
          <SettingsPage userId={account?.id} account={account} />
        )}

        {/* Tab content */}
        {!activeTool && !activeNetwork && tab === 'media' && (
          <MobileMediaPage />
        )}
        {!activeTool && !activeNetwork && tab === 'main-feed' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0">
              <OfficialMainFeed />
            </div>
            <div className="min-h-0 flex-1">
              <IndustryWire account={account} />
            </div>
          </div>
        )}
        {!activeTool && !activeNetwork && tab === 'social' && (
          <FeedFlipCard
            currentUserId={account?.id ?? ''}
            onMessage={(uid) => dispatchMessageUser(uid)}
            onBack={() => {}}
          >
            <CommunityFeed account={account} />
          </FeedFlipCard>
        )}
        {!activeTool && !activeNetwork && tab === 'comms' && (
          <MobileCommsView
            account={account}
            loungeOptions={LOUNGE_OPTIONS}
            selectedSlug={selectedLoungeSlug}
            onSelectLounge={setSelectedLoungeSlug}
          />
        )}
        {!activeTool && !activeNetwork && tab === 'sweat' && (
          <SweatRailMobile account={account} />
        )}
      </div>

      {/* Bottom navigation — Community module only.
          Hidden when a tool or network view is active (non-Community pages). */}
      {!activeTool && !activeNetwork && (
      <nav
        className="relative z-30 flex h-14 shrink-0 items-stretch border-t"
        style={{
          borderColor: 'rgba(212,165,44,0.12)',
          background: 'rgba(8,7,6,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = tab === id;
          const isPrimary = id === 'home';
          return (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
              style={{ color: isActive ? GOLD : 'rgba(255,255,255,0.4)' }}
            >
              <div className="relative">
                <Icon
                  className="h-5 w-5"
                  strokeWidth={isActive ? 2 : 1.5}
                  style={{ color: isActive ? GOLD : 'rgba(255,255,255,0.4)' }}
                />
                {false && (
                  <span
                    className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full"
                    style={{ background: GOLD, boxShadow: `0 0 6px ${GOLD}80` }}
                  />
                )}
              </div>
              <span
                className="text-[9px] font-semibold tracking-wide"
                style={{
                  color: isActive ? GOLD_SOFT : 'rgba(255,255,255,0.4)',
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
      )}

      {/* Hamburger drawer */}
      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelect={handleDrawerSelect}
        accountName={account?.name ?? DEMO_USER.name}
        accountUsername={account?.username ?? DEMO_USER.username}
        currentTitle={headerTitle}
      />
    </div>
  );
}

const TOOL_TITLES: Record<ToolView, string> = {
  analytics: 'Analytics',
  'hand-analysis': 'HH Replayer',
  'hh-workspace': 'Workspace',
  student: 'Workspace',
  'my-spots': 'My Spots',
  'public-library': 'Spot Library',
  'content-lab': 'Content Lab',
  profile: 'Profile',
  solver: 'Solver',
  about: 'About SpotVault',
  settings: 'Settings',
};

const NETWORK_TITLES: Record<NetworkView, string> = {
  jobs: 'Jobs',
  advertising: 'Advertising',
  marketplace: 'Store',
  store: 'Store',
  'market-store': 'Store',
  'spot-store': 'Spots',
  'multispot-store': 'Multi-Spots',
  'stakekings-action': 'StakeKings Action',
  people: 'People',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  bookings: 'Bookings',
};

function timeAgoMobile(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function MobileCommsView({ account, loungeOptions, selectedSlug, onSelectLounge }: {
  account: SpotVaultAccount | null;
  loungeOptions: LoungeOption[];
  selectedSlug: string;
  onSelectLounge: (slug: string) => void;
}) {
  const [section, setSection] = useState<'messages' | 'lounges'>('messages');
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex shrink-0 gap-1 border-b border-white/[0.06] bg-black/30 p-2">
        <button onClick={() => setSection('messages')} className={`flex-1 rounded-md px-2 py-2 text-[10px] font-bold uppercase tracking-wider ${section === 'messages' ? 'bg-[#d4a52c]/15 text-[#f5e6b0]' : 'text-white/45'}`}>Messages & Alerts</button>
        <button onClick={() => setSection('lounges')} className={`flex-1 rounded-md px-2 py-2 text-[10px] font-bold uppercase tracking-wider ${section === 'lounges' ? 'bg-[#d4a52c]/15 text-[#f5e6b0]' : 'text-white/45'}`}>Lounges</button>
      </div>
      {section === 'messages' && account ? <MessagingCenter account={account} initialTab="chats" onBack={() => {}} isMobile /> : null}
      {section === 'lounges' ? <MobileLoungeHub account={account} loungeOptions={loungeOptions} selectedSlug={selectedSlug} onSelectLounge={onSelectLounge} /> : null}
      {!account && section === 'messages' && <div className="p-6 text-center text-xs text-white/40">Sign in to view messages and notifications.</div>}
    </div>
  );
}

function SweatRailMobile({ account }: { account: SpotVaultAccount | null }) {
  const { sweats: rawSweats } = useSweatStore();
  const sweats = Array.isArray(rawSweats) ? rawSweats : [];
  const [tab, setTab] = useState<'following' | 'notables'>('following');
  const [site, setSite] = useState('');
  const [tournament, setTournament] = useState('');
  const [stack, setStack] = useState('');
  const [comment, setComment] = useState('');

  const post = () => {
    if (!site.trim() || !tournament.trim()) return;
    postSweat(site.trim(), tournament.trim(), '', '', stack.trim(), comment.trim(), 'friends');
    setSite(''); setTournament(''); setStack(''); setComment('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] px-3 py-1.5">
        {(['following', 'notables'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="rounded-md px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase transition-colors"
            style={tab === t ? { background: 'rgba(212,165,44,0.12)', color: GOLD_SOFT } : { color: 'rgba(255,255,255,0.3)' }}>
            {t === 'following' ? 'Following' : 'Notables'}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {sweats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <TrendingUp className="mb-2 h-8 w-8 text-white/10" />
            <p className="text-[12px] text-white/40">No active sweats right now.</p>
            <p className="mt-1 text-[10px] text-white/25">Share your tournament run below.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sweats.map((s) => (
              <div key={s.id} className="rounded-lg border border-[#c0911e]/15 bg-[#0d1115]/95 p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-red-300">I'M DEEP</span>
                  <span className="ml-auto text-[9px] text-white/25">{timeAgoMobile(s.createdAt)}</span>
                </div>
                <div className="mt-1 text-[12px] font-semibold text-white/90">{s.tournament}</div>
                <div className="text-[10px] text-white/50">{s.site}</div>
                {s.stack && <div className="mt-1 text-[11px] text-[#d4a52c]">Stack: {s.stack}</div>}
                {s.comment && <p className="mt-0.5 text-[11px] text-white/60">{s.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      {account && (
        <div
          className="shrink-0 border-t border-[#c0911e]/12 p-2"
          style={{
            background: 'rgba(10,12,14,0.72)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
          }}
        >
          <div
            className="rounded-xl border border-[#c0911e]/18 p-2.5"
            style={{ background: 'rgba(12,10,8,0.6)' }}
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
              <span className="text-[9px] font-bold tracking-widest text-white/60 uppercase">Post a Sweat</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Site" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white/80 placeholder:text-white/30 focus:border-[#c0911e]/30 focus:outline-none" />
              <input value={tournament} onChange={(e) => setTournament(e.target.value)} placeholder="Tournament" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white/80 placeholder:text-white/30 focus:border-[#c0911e]/30 focus:outline-none" />
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <input value={stack} onChange={(e) => setStack(e.target.value)} placeholder="Stack" className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white/80 placeholder:text-white/30 focus:border-[#c0911e]/30 focus:outline-none" />
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white/80 placeholder:text-white/30 focus:border-[#c0911e]/30 focus:outline-none" />
              <button onClick={post} disabled={!site.trim() || !tournament.trim()} className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-2.5 text-[10px] font-semibold text-[#f5e6b0] disabled:opacity-30 active:scale-95">
                <TrendingUp className="h-3 w-3" strokeWidth={1.5} /> Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileToolShell({ icon: Icon, title, tagline, children }: { icon: typeof Library; title: string; tagline: string; children: string }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-3 sm:py-6">
      <div
        className="rounded-2xl border border-[#c0911e]/12 p-4 sm:p-6"
        style={{ background: 'rgba(12,10,8,0.92)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 12px 40px -16px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.04] pb-5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))',
              border: '1px solid rgba(192,145,30,0.15)',
            }}
          >
            <Icon className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD }} />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
            <span className="text-[10px] font-mono tracking-[0.2em] text-[#c0911e]/60 uppercase">{tagline}</span>
          </div>
        </div>
        <div className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-white/35">{children}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
