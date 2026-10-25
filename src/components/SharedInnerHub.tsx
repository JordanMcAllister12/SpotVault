import { useState, useCallback, useEffect } from 'react';
import {
  Circle, Bookmark, Rocket,
  Building2, Zap, ArrowLeft, Eye,
} from 'lucide-react';
import { IndustryWire } from '@/components/IndustryWire';
import { CommunityFeed } from '@/components/CommunityFeed';
import { OfficialMainFeed } from '@/components/community/OfficialMainFeed';
import { CommunityFloorView } from '@/components/CommunityFloorView';
import { SavedPostsView } from '@/components/SavedPostsView';
import { SweatRail } from '@/components/SweatRail';
import { MobileCommunityHub } from '@/components/MobileCommunityHub';
import { FeedFlipCard } from '@/components/shared/FeedFlipCard';
import { QuickMessagesPanel } from '@/components/messaging/QuickMessagesPanel';
import { AccountDropdown } from '@/components/AccountDropdown';
import { PortalSwitcher } from '@/components/PortalSwitcher';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { useMessagingUnread } from '@/lib/messagingCenterStore';
import { useSweatStore } from '@/lib/sweatStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { dispatchMessageUser, dispatchOpenMessaging, dispatchOpenProfileSettings } from '@/lib/profileEvents';
import { isStaffOrAdmin, isFounderUser, type HubId } from '@/types';
import type { UniversalView } from '@/components/UniversalRail';
import type { SpotVaultAccount } from '@/types';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';
import type { PortalId } from '@/useDemo';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface Props {
  onBackToHub: () => void;
  account: SpotVaultAccount | null;
  onNavigateUp?: () => void;
  onOpenUniversalView?: (view: UniversalView | string) => void;
  onNavigateToPortal?: (view: string) => void;
  titleOverride?: string;
  originPortalName?: string;
  onReturnToPortal?: () => void;
  credits?: number;
  onLogout?: () => void;
  onOpenCredits?: () => void;
  onSwitchPortal?: (portal: HubId) => void;
  portalSwitchOpen?: boolean;
  onTogglePortalSwitch?: () => void;
  onClosePortalSwitch?: () => void;
  activePortalId?: string | null;
  customPortalLabel?: string | null;
  customPortals?: CustomPortalMembership[];
  onEnterCustomPortal?: (portal: CustomPortalMembership) => void;
  onReturnToDefault?: () => void;
  onOpenCustomPortals?: () => void;
  selectedPortal?: PortalId;
}

type Panel = 'wire' | 'community' | 'saved' | 'messages' | 'sweat' | null;
type GlassMode = 'glass' | 'solid';

export function SharedInnerHub({
  onBackToHub, account, onOpenUniversalView, onNavigateToPortal, titleOverride, originPortalName, onReturnToPortal,
  credits = 0, onLogout, onOpenCredits, onSwitchPortal, portalSwitchOpen = false, onTogglePortalSwitch, onClosePortalSwitch,
  activePortalId = null, customPortalLabel = null, customPortals = [], onEnterCustomPortal, onReturnToDefault, onOpenCustomPortals,
  selectedPortal = 'PLAYER',
}: Props) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activePanel, setActivePanel] = useState<Panel>('community');
  const [wireGlass, setWireGlass] = useState<GlassMode>('glass');
  const [communityGlass, setCommunityGlass] = useState<GlassMode>('glass');
  const [isAltCommunityBackground, setIsAltCommunityBackground] = useState(false);
  const [communityFloorOpen, setCommunityFloorOpen] = useState(false);
  const [loungeShowcase, setLoungeShowcase] = useState(false);

  useEffect(() => {
    if (!loungeShowcase) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLoungeShowcase(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loungeShowcase]);

  const { chats: chatUnread, inbox: inboxUnread, groups: groupsUnread, activity: activityUnread } = useMessagingUnread(account?.id);
  const totalUnread = chatUnread + inboxUnread + groupsUnread + activityUnread;
  const { sweats } = useSweatStore();
  const liveSweatCount = sweats.filter((s) => s.status === 'live').length;

  const handleWireActivate = useCallback(() => setActivePanel('wire'), []);
  const handleCommunityActivate = useCallback(() => setActivePanel('community'), []);
  const handleMessagesActivate = useCallback(() => { setActivePanel('messages'); }, []);
  const handleSweatActivate = useCallback(() => setActivePanel('sweat'), []);

  const handleSavedClick = () => setActivePanel((p) => p === 'saved' ? 'community' : 'saved');

  const wireOpacity = 1;
  const communityOpacity = 1;

  const isFounder = isFounderUser(account);
  const currentLevel = 1;
  const nextLevel = currentLevel + 1;
  const xpPercent = 0;
  const portalLabel = originPortalName ?? 'SpotVault';

  // Mobile: dedicated full-screen mobile layout
  if (isMobile) {
    return (
      <MobileCommunityHub
        account={account}
        onBackToHub={onBackToHub}
        onOpenUniversalView={onOpenUniversalView}
        onNavigateToPortal={onNavigateToPortal}
      />
    );
  }

  const rightPanelActive = activePanel === 'messages' || activePanel === 'sweat';

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundImage: `url("${isAltCommunityBackground ? '/image%20copy%20copy%20copy%20copy.webp' : '/image%20copy.webp'}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
    >


      <header className="relative z-[30] flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/40 px-3 backdrop-blur-md sm:h-20 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-white/60 transition-all hover:border-[#d4a52c]/40 hover:bg-[#d4a52c]/10 hover:text-[#d4a52c]"
            aria-label="Back to Home"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <div className="text-[10px] font-mono tracking-[0.2em] text-white/60 uppercase">SpotVault Community</div>
          {/* Top nav: Saved Posts + Boost Visibility */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSavedClick}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold tracking-wide transition-all ${
                activePanel === 'saved'
                  ? 'border-[#d4a52c]/40 bg-[#d4a52c]/12 text-[#f5e6b0]'
                  : 'border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-[#c0911e]/20 hover:text-white/80'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Saved Posts</span>
            </button>
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-white/55 transition-all"
              title="Boost Visibility — Coming Soon"
            >
              <Rocket className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: 'rgba(212,165,44,0.6)' }} />
              <span className="hidden sm:inline">Boost Visibility</span>
              <span className="rounded-full border border-[#d4a52c]/25 bg-[#d4a52c]/8 px-1.5 py-0.5 text-[7px] font-bold leading-3 tracking-wide" style={{ color: '#d4a52c' }}>
                SOON
              </span>
            </button>
          </div>
          {/* View Lounge — showcase background */}
          <button
            type="button"
            onClick={() => setLoungeShowcase(true)}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold tracking-wide transition-all sm:hidden"
            style={{ borderColor: GOLD + '30', background: `linear-gradient(135deg, ${GOLD}12, ${GOLD}06)`, color: GOLD_SOFT }}
            title="View Lounge"
          >
            <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setLoungeShowcase(true)}
            className="hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold tracking-wide transition-all sm:flex"
            style={{ borderColor: GOLD + '30', background: `linear-gradient(135deg, ${GOLD}12, ${GOLD}06)`, color: GOLD_SOFT }}
            title="View Lounge"
          >
            <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>VIEW LOUNGE</span>
          </button>
        </div>
        {/* Partner branding group — SK + GhostDawg logos */}
        <div className="hidden items-center gap-3 sm:flex">
          <span className="text-[6px] font-mono tracking-[0.2em] uppercase" style={{ color: 'rgba(232,220,196,0.5)' }}>Partners</span>
          <img
            src="/assets/partners/StakeKings_Transparent_Logo.webp"
            alt="StakeKings"
            className="h-[40px] w-auto object-contain"
          />
          <img
            src="/assets/partners/GhostDawg_Transparent_Logo.webp"
            alt="GhostDawg Consulting"
            className="h-[40px] w-auto object-contain"
          />
          <div className="h-10 w-px bg-white/[0.06]" />
        </div>
        {/* Mobile partner logos — no label, smaller */}
        <div className="flex items-center gap-2 sm:hidden">
          <img
            src="/assets/partners/StakeKings_Transparent_Logo.webp"
            alt="StakeKings"
            className="h-[32px] w-auto object-contain"
          />
          <img
            src="/assets/partners/GhostDawg_Transparent_Logo.webp"
            alt="GhostDawg Consulting"
            className="h-[32px] w-auto object-contain"
          />
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Credits & Level */}
          <button
            type="button"
            onClick={onOpenCredits}
            className="hdr-white-btn group relative flex items-center gap-1.5 overflow-hidden rounded-lg px-2 py-1 text-[9px] font-bold tracking-wide transition-all sm:px-2.5 sm:py-1.5 sm:text-[10px]"
            title="Credits & Level"
          >
            <Zap className="hdr-white-icon h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" strokeWidth={2} />
            <span className="hdr-white-text relative z-10 whitespace-nowrap">{credits.toLocaleString()} Credits</span>
            <span className="hdr-white-text relative z-10 opacity-50">|</span>
            <span className="hdr-white-text relative z-10 whitespace-nowrap">LVL {currentLevel}</span>
            <div className="relative z-10 h-1.5 w-12 overflow-hidden rounded-full bg-black/40 sm:w-16">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${xpPercent}%`, background: 'linear-gradient(90deg, #d4a52c, #c0911e)' }}
              />
            </div>
            <span className="hdr-white-text relative z-10 whitespace-nowrap text-[8px] font-mono opacity-70">LVL {nextLevel}</span>
          </button>
          {/* Portal Switcher — founders only */}
          {isFounder && onSwitchPortal && onTogglePortalSwitch && (
            <PortalSwitcher
              account={account}
              currentPortal={selectedPortal as PortalId}
              onSwitch={(portal) => onSwitchPortal(portal as HubId)}
              open={portalSwitchOpen}
              onToggle={onTogglePortalSwitch}
              onClose={onClosePortalSwitch}
              align="right"
              onOpenCustomPortals={onOpenCustomPortals}
              customPortalLabel={customPortalLabel}
              activePortalId={activePortalId}
              customPortals={customPortals}
              onEnterCustomPortal={onEnterCustomPortal}
              onReturnToDefault={onReturnToDefault}
            />
          )}
          {/* Notification bell */}
          <NotificationBell userId={account?.id} />
          {/* Account dropdown */}
          <div className="hidden sm:flex">
            <AccountDropdown
              account={account}
              portalLabel={portalLabel}
              onMyProfile={() => dispatchOpenProfileSettings('profile')}
              onBackToHome={onBackToHub}
              onAccountSecurity={() => dispatchOpenProfileSettings('account-security')}
              onRewardsProgress={() => dispatchOpenProfileSettings('rewards')}
              onLogout={onLogout}
            />
          </div>
        </div>
      </header>
      <div
        className={`absolute inset-x-0 bottom-0 top-14 z-[5] flex transition-all duration-300 sm:top-20 ${loungeShowcase ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      >
        <div
          className="grid h-full w-full gap-3 px-4 py-4"
          style={{ gridTemplateColumns: 'minmax(300px, 0.9fr) minmax(400px, 1.6fr) 300px' }}
        >
          {/* Industry Wire — LEFT */}
          <PanelShell
            opacity={wireOpacity}
            isActive={activePanel === 'wire'}
            onActivate={handleWireActivate}
            glassMode={wireGlass}
            onToggleGlass={() => setWireGlass((g) => g === 'glass' ? 'solid' : 'glass')}
            width="100%"
            height="100%"
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              <OfficialMainFeed />
              <IndustryWire account={account} />
            </div>
          </PanelShell>

          {/* Community Live Feed — CENTER (flips to profile on avatar click) */}
          <PanelShell
            opacity={communityOpacity}
            isActive={activePanel === 'community' || activePanel === 'saved'}
            onActivate={handleCommunityActivate}
            glassMode={communityGlass}
            onToggleGlass={() => setCommunityGlass((g) => g === 'glass' ? 'solid' : 'glass')}
            width="100%"
            height="100%"
          >
            {activePanel === 'saved' ? <SavedPostsView account={account} /> : (
              <FeedFlipCard
                currentUserId={account?.id ?? ''}
                onMessage={(uid) => dispatchMessageUser(uid)}
                onBack={() => {}}
              >
                <div className="flex h-full flex-col">
                  <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-2">
                    <button
                      onClick={() => setCommunityFloorOpen(true)}
                      className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-all hover:scale-[1.02]"
                      style={{ borderColor: GOLD + '25', background: `linear-gradient(135deg, ${GOLD}10, ${GOLD}05)` }}
                    >
                      <Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} style={{ color: GOLD }} />
                      <span className="text-[11px] font-bold tracking-wide" style={{ color: GOLD_SOFT }}>Enter Community Floor</span>
                    </button>
                  </div>
                  <div className="min-h-0 flex-1">
                    <CommunityFeed account={account} />
                  </div>
                </div>
              </FeedFlipCard>
            )}
          </PanelShell>

          {/* Right Rail — Messages (top) + Sweat Rail (bottom) */}
          <div
            className="flex shrink-0 flex-col overflow-hidden rounded-2xl border transition-all duration-500"
            style={{
              width: '100%',
              height: '100%',
              borderColor: 'rgba(212,165,44,0.22)',
              background: 'rgba(8,7,6,0.42)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 60px -16px rgba(0,0,0,0.7)',
            }}
>
            {/* Top: Messages */}
            <div className="flex min-h-0 flex-1 flex-col border-b border-white/[0.06]">
              <div className="min-h-0 flex-1 overflow-hidden">
                <QuickMessagesPanel
                  account={account}
                  isActive={activePanel === 'messages'}
                  onActivate={handleMessagesActivate}
                  onOpenFullMessaging={() => dispatchOpenMessaging('chats')}
                />
              </div>
            </div>

            {/* Bottom: Sweat Rail */}
            <div className="flex min-h-0 flex-1 flex-col">
              <SweatRail
                isActive={activePanel === 'sweat'}
                onActivate={handleSweatActivate}
              />
            </div>
          </div>
        </div>
      </div>


      {communityFloorOpen && (
        <CommunityFloorView account={account} onBack={() => setCommunityFloorOpen(false)} />
      )}

      {/* Lounge Showcase Mode — floating return button */}
      {loungeShowcase && (
        <button
          type="button"
          onClick={() => setLoungeShowcase(false)}
          className="fixed right-4 top-16 z-[60] flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all hover:scale-105 sm:top-20"
          style={{ borderColor: GOLD + '40', background: 'rgba(10,8,6,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', color: GOLD_SOFT, boxShadow: '0 4px 20px -4px rgba(0,0,0,0.6)' }}
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
          <span>Return to Community</span>
        </button>
      )}
    </div>
  );
}

function PanelShell({
  opacity,
  isActive,
  onActivate,
  glassMode,
  onToggleGlass,
  width,
  height,
  children,
}: {
  opacity: number;
  isActive: boolean;
  onActivate: () => void;
  glassMode: GlassMode;
  onToggleGlass: () => void;
  width: string;
  height: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-500"
      style={{
        width,
        height,
        borderColor: 'rgba(212,165,44,0.22)',
        background: 'rgba(8,7,6,0.42)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 60px -16px rgba(0,0,0,0.7)',
      }}
      onMouseDown={onActivate}
      onTouchStart={onActivate}
    >
      {/* Glass control */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleGlass();
        }}
        className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.08] bg-black/30 text-[8px] font-bold text-white/30 transition-all hover:text-white/60"
        title={glassMode === 'glass' ? 'Switch to solid' : 'Switch to glass'}
      >
        <Circle className="h-2.5 w-2.5" style={{ fill: 'currentColor' }} strokeWidth={0} />
      </button>

      {children}
    </div>
  );
}
