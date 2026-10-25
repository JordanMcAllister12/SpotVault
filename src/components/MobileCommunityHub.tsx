import { useState, useEffect, useCallback } from 'react';
import { Newspaper, MessageSquare, Flame, CalendarCheck, CalendarDays, Menu, X, Home, Bookmark, type LucideIcon } from 'lucide-react';
import { IndustryWire } from '@/components/IndustryWire';
import { OfficialMainFeed } from '@/components/community/OfficialMainFeed';import { CommunityFeed } from '@/components/CommunityFeed';
import { SavedPostsView } from '@/components/SavedPostsView';
import { QuickMessagesPanel } from '@/components/messaging/QuickMessagesPanel';
import { SweatRail } from '@/components/SweatRail';
import { CommunityAvailability } from '@/components/booking/CommunityAvailability';
import { UniversalNavSection } from '@/components/UniversalNavSection';
import { FeedFlipCard } from '@/components/shared/FeedFlipCard';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { useMessagingUnread } from '@/lib/messagingCenterStore';
import { useSweatStore } from '@/lib/sweatStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { dispatchMessageUser, dispatchOpenMessaging } from '@/lib/profileEvents';
import { COMMUNITY_NAV, type PortalNavEntry } from '@/data/portalConfigs';
import type { UniversalView } from '@/components/UniversalRail';
import type { SpotVaultAccount } from '@/types';

type MobileTab = 'feed' | 'community' | 'saved' | 'sweat' | 'messages' | 'book';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface Props {
  account: SpotVaultAccount | null;
  onBackToHub: () => void;
  onOpenUniversalView?: (view: UniversalView | string) => void;
  onNavigateToPortal?: (view: string) => void;
}

const TABS: { id: MobileTab; label: string; icon: typeof Newspaper }[] = [
  { id: 'feed', label: 'Info', icon: Newspaper },
  { id: 'community', label: 'Social', icon: MessageSquare },
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'sweat', label: 'Sweat', icon: Flame },
  { id: 'messages', label: 'Messages', icon: CalendarDays },
  { id: 'book', label: 'Book', icon: CalendarCheck },
];

export function MobileCommunityHub({ account, onBackToHub, onOpenUniversalView, onNavigateToPortal }: Props) {
  const [tab, setTab] = useState<MobileTab>('community');
  const [menuOpen, setMenuOpen] = useState(false);
  const { chats: chatUnread, inbox: inboxUnread, groups: groupsUnread, activity: activityUnread } = useMessagingUnread(account?.id);
  const totalUnread = chatUnread + inboxUnread + groupsUnread + activityUnread;
  const liveSweatCount = sweats.filter((s) => s.status === 'live').length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#07060a]">
      {/* Compact mobile header */}
      <header
        className="flex shrink-0 items-center justify-between px-4 py-2.5"
        style={{
          borderBottom: '1px solid rgba(212,165,44,0.12)',
          background: 'rgba(8,7,6,0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          paddingTop: 'max(0.625rem, env(safe-area-inset-top))',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToHub}
            aria-label="Back"
            title="Back"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/60 text-white/75"
          >
            <span aria-hidden="true" className="text-lg leading-none">←</span>
          </button>
          <button
            type="button"
            onClick={onBackToHub}
            aria-label="Player Home"
            title="Player Home"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4a52c]/35 bg-[#d4a52c]/10 text-[#f5e6b0]"
          >
            <Home className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg border"
            style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(192,145,30,0.1)' }}
          >
            <span className="text-[10px] font-bold" style={{ color: GOLD }}>SV</span>
          </div>
          <div>
            <span className="truncate text-[11px] font-bold tracking-[0.12em] text-white uppercase">{tab === 'feed' ? 'SPOTVAULT INFO' : 'SPOTVAULT COMMUNITY'}</span>
            <span className="ml-2 text-[8px] font-mono tracking-[0.2em] uppercase" style={{ color: 'rgba(212,165,44,0.5)' }}>
              SpotVault
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: '#4ade80', boxShadow: '0 0 6px rgba(74,222,128,0.5)' }}
            />
            <span className="text-[9px] font-medium text-white/40">247</span>
          </div>
          {account && (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-bold text-white/80"
              style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.08)' }}
            >
              {account.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
          <NotificationBell userId={account?.id} variant="mobile" />
          {/* Hamburger — SpotVault-wide navigation */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4a52c]/30 bg-black/50 backdrop-blur"
            title="SpotVault Menu"
          >
            <Menu className="h-4 w-4" style={{ color: GOLD_SOFT }} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Site menu slide-over */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div
            data-swipe-exclude="true"
            className="fixed right-0 top-0 z-[91] flex h-full w-72 max-w-[85vw] flex-col border-l bg-[#0b0a08] shadow-2xl"
            style={{ borderColor: 'rgba(212,165,44,0.2)' }}
          >
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: 'rgba(212,165,44,0.12)' }}>
              <div>
                <p className="text-[11px] font-bold tracking-[0.2em] text-white uppercase">SpotVault</p>
                <p className="text-[8px] font-mono tracking-widest uppercase" style={{ color: 'rgba(212,165,44,0.5)' }}>Platform Navigation</p>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:text-white/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <button
                onClick={() => { setMenuOpen(false); onBackToHub(); }}
                className="mb-3 flex w-full items-center gap-3 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-2.5 text-left transition-all hover:bg-[#d4a52c]/20"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10">
                  <Home className="h-4 w-4" style={{ color: GOLD_SOFT }} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-white">Back to Hub</p>
                  <p className="text-[9px] text-white/40">Return to portal selection</p>
                </div>
              </button>

              <p className="mb-2 px-1 text-[8px] font-mono tracking-[0.2em] uppercase text-white/25">Community</p>
              <div className="flex flex-col gap-1">
                {COMMUNITY_NAV.map((item: PortalNavEntry) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigateToPortal?.(item.id);
                        onBackToHub();
                      }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5"
                    >
                      <ItemIcon className="h-4 w-4 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} strokeWidth={1.5} />
                      <span className="text-[11px] font-medium text-white/70">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {onOpenUniversalView && (
                <div className="mt-3">
                  <UniversalNavSection onNavigate={(v) => { setMenuOpen(false); onOpenUniversalView(v); }} variant="player" />
                </div>
              )}
            </div>

            {account && (
              <div className="shrink-0 border-t px-4 py-3" style={{ borderColor: 'rgba(212,165,44,0.12)' }}>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full border text-[9px] font-bold text-white/80"
                    style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.08)' }}
                  >
                    {account.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-white">{account.name}</p>
                    <p className="text-[8px] text-white/30">{account.username}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Content area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'feed' && (
          <div className="h-full overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
            <OfficialMainFeed />
            <IndustryWire account={account} />
          </div>
        )}
        {tab === 'community' && (
          <FeedFlipCard
            currentUserId={account?.id ?? ''}
            onMessage={(uid) => dispatchMessageUser(uid)}
            onBack={() => {}}
          >
            <div className="h-full overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
              <CommunityFeed account={account} />
            </div>
          </FeedFlipCard>
        )}
        {tab === 'saved' && (
          <div className="h-full">
            <SavedPostsView account={account} />
          </div>
        )}
        {tab === 'sweat' && (
          <div className="h-full">
            <SweatRail isActive={true} onActivate={() => {}} />
          </div>
        )}
        {tab === 'messages' && (
          <div className="h-full">
            <QuickMessagesPanel account={account} isActive={true} onActivate={() => {}} onOpenFullMessaging={() => dispatchOpenMessaging('chats')} />
          </div>
        )}
        {tab === 'book' && (
          <div className="h-full overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
            {account ? (
              <CommunityAvailability account={account} onBookProvider={() => {}} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-[11px] text-white/30">Sign in to browse available providers.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom navigation — Community-internal navigation */}
      <nav
        data-swipe-exclude="true"
        className="flex shrink-0 items-stretch justify-around"
        style={{
          borderTop: '1px solid rgba(212,165,44,0.15)',
          background: 'rgba(8,7,6,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-all"
              style={{
                background: active ? 'rgba(212,165,44,0.06)' : 'transparent',
              }}
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full"
                  style={{ background: GOLD, boxShadow: '0 0 8px rgba(212,165,44,0.4)' }}
                />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.5}
                style={{ color: active ? GOLD : 'rgba(255,255,255,0.35)' }}
              />
              <span
                className="text-[9px] font-bold tracking-wide transition-colors"
                style={{ color: active ? GOLD_SOFT : 'rgba(255,255,255,0.3)' }}
              >
                {label}
              </span>
              {/* Badges */}
              {id === 'messages' && totalUnread > 0 && (
                <span
                  className="absolute right-1.5 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[7px] font-bold"
                  style={{ background: GOLD, color: '#080706' }}
                >
                  {totalUnread}
                </span>
              )}
              {id === 'sweat' && liveSweatCount > 0 && (
                <span
                  className="absolute right-1.5 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[7px] font-bold"
                  style={{ background: '#34d399', color: '#080706' }}
                >
                  {liveSweatCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

    </div>
  );
}
