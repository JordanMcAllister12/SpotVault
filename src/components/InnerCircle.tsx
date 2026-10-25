import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  MessageCircle,
  Share2,
  Bookmark,
  Heart,
  Send,
  ShieldCheck,
  ArrowRight,
  Network as NetworkIcon,
  Globe,
  Home,
  UserPlus,
  Calendar,
  Hash,
  TrendingUp,
  Users,
  Radio,
  Check,
  ChevronDown,
  Building2,
} from 'lucide-react';
import type { Demo } from '@/useDemo';
import type { FeedItem, HubId } from '@/types';
import {
  HUB_SHORT,
  IC_NAV,
  TRENDING_TOPICS,
  WHO_TO_FOLLOW,
  UPCOMING_EVENTS,
  ACTIVE_ROOMS,
} from '@/types';
import {
  COMMUNITY_THEMES,
  DEFAULT_COMMUNITY_THEME,
  COMMUNITY_THEME_STORAGE_KEY,
  CommunityThemeBackground,
  COMMUNITY_THEME_SURFACES,
  type CommunityThemeId,
  type CommunityThemeSurface,
} from '@/themes/communityThemes';
import { useEnvironmentAssets } from '@/data/environmentAssets';
import {
  SpotVaultGivesWidget,
  ContributeModal,
  ImpactCenterModal,
  GivesFeedEvent,
  type Contribution,
} from '@/components/SpotVaultGives';

interface Props {
  demo: Demo;
  onBackToHub: () => void;
  onOpenPublish: () => void;
  onNetworkMap: () => void;
  originHub?: HubId;
}

const TABS = ['For You', 'Following', 'Info', 'Trending'] as const;
type Tab = (typeof TABS)[number];

const floatStyle = (surface: CommunityThemeSurface): React.CSSProperties => ({
  background: surface.cardBg,
  border: `1px solid ${surface.border}`,
  borderRadius: '12px',
  boxShadow: surface.shadow,
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
});

export function InnerCircle({ demo, onBackToHub, onOpenPublish, onNetworkMap, originHub }: Props) {
  const { state } = demo;
  const [tab, setTab] = useState<Tab>('For You');
  const [commenting, setCommenting] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [navItem, setNavItem] = useState('Home');
  const assetStore = useEnvironmentAssets();
  const availableThemes = useMemo(() => {
    const assigned = new Set(assetStore.assets.filter((asset) => asset.allowedScreens.includes('COMMUNITY')).map((asset) => asset.id));
    const builtIn = COMMUNITY_THEMES.filter((theme) => assigned.has(theme.id));
    const custom = assetStore.assets.filter((asset) => asset.kind === 'image' && asset.src && asset.allowedScreens.includes('COMMUNITY') && !COMMUNITY_THEMES.some((theme) => theme.id === asset.id)).map((asset) => ({ id: asset.id, name: asset.name, description: asset.notes || asset.fileName, src: asset.src }));
    return [...builtIn, ...custom];
  }, [assetStore.assets]);
  const [themeId, setThemeId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(COMMUNITY_THEME_STORAGE_KEY);
      if (stored) return stored;
    } catch { /* ignore */ }
    return DEFAULT_COMMUNITY_THEME;
  });
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const customizeSpaceRef = useRef<HTMLButtonElement>(null);
  const [givesContributeOpen, setGivesContributeOpen] = useState(false);
  const [givesImpactOpen, setGivesImpactOpen] = useState(false);
  const [givesContributions, setGivesContributions] = useState<Contribution[]>([]);

  const isInvestorOrigin = originHub === 'INVESTOR' || state.selectedPortal === 'INVESTOR';
  const hubShort = isInvestorOrigin ? 'Investor Hub' : 'Player Hub';

  const surface = COMMUNITY_THEME_SURFACES[themeId as CommunityThemeId] ?? COMMUNITY_THEME_SURFACES[DEFAULT_COMMUNITY_THEME];
  const customTheme = availableThemes.find((theme) => theme.id === themeId && 'src' in theme);

  useEffect(() => {
    if (availableThemes.some((theme) => theme.id === themeId)) return;
    const fallback = availableThemes[0]?.id ?? DEFAULT_COMMUNITY_THEME;
    setThemeId(fallback);
  }, [availableThemes, themeId]);

  useEffect(() => {
    try { localStorage.setItem(COMMUNITY_THEME_STORAGE_KEY, themeId); } catch { /* ignore */ }
  }, [themeId]);

  const updateMenuPos = useCallback(() => {
    if (!customizeSpaceRef.current) return;
    const rect = customizeSpaceRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
  }, []);

  const toggleThemeMenu = () => {
    if (!themeMenuOpen) updateMenuPos();
    setThemeMenuOpen((v) => !v);
  };

  const selectTheme = (id: string) => {
    setThemeId(id);
    setThemeMenuOpen(false);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent p-3 lg:p-5">
      {/* ===== Layer 0: Environment background — SHARP, no blur ===== */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {customTheme?.src ? <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${customTheme.src})` }} /> : <CommunityThemeBackground themeId={themeId as CommunityThemeId} />}
      </div>

      {/* ===== Layer 10: Floating UI — NO column plates, only individual floating pieces ===== */}
      <div className="relative z-10 flex h-full w-full flex-col gap-3">
        {/* ===== Floating Header ===== */}
        <header
          className="flex shrink-0 items-center justify-between px-5 py-3"
          style={floatStyle(surface)}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={onNetworkMap}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all hover:text-[#c7cfd8]"
              style={{
                borderColor: surface.border,
                background: surface.panelBgLight,
                color: '#84929f',
              }}
            >
              <NetworkIcon className="h-3.5 w-3.5" strokeWidth={1.5} /> Network Map
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <Globe className="h-4 w-4" strokeWidth={1.5} style={{ color: surface.accent }} />
            <span className="text-[10px] font-mono tracking-[0.25em] text-[#aab6c2] uppercase">The Poker Industry — Live</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] font-mono tracking-[0.25em] text-[#475565] uppercase sm:block">Public Network</span>

            {/* Customize Space */}
            <button
              ref={customizeSpaceRef}
              onClick={toggleThemeMenu}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#C7C9C7] uppercase transition-all hover:text-white"
              style={{
                borderColor: surface.border,
                background: surface.panelBgLight,
              }}
            >
              <Building2 className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: surface.accent }} />
              Customize Space
              <ChevronDown className={`h-3 w-3 transition-transform ${themeMenuOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
            </button>
          </div>
        </header>

        {/* ===== Body: 3 columns — ALL TRANSPARENT, individual pieces float ===== */}
        <div className="flex min-h-0 flex-1 gap-4">
          {/* ===== LEFT COLUMN — transparent, individual nav items float ===== */}
          <aside className="flex w-52 shrink-0 flex-col gap-3 lg:flex">
            {/* Nav title floats */}
            <div className="px-4 py-3" style={floatStyle(surface)}>
              <div className="text-[9px] font-mono tracking-[0.25em] text-[#475565] uppercase">Inner Circle</div>
              <div className="mt-1 text-sm font-bold" style={{ color: surface.accentText }}>Navigation</div>
              <div className="mt-0.5 text-[9px] font-mono tracking-[0.2em] text-[#5f6e7c] uppercase">Community Hub</div>
            </div>

            {/* Nav items float as a group */}
            <nav className="flex flex-col gap-1 px-2.5 py-2" style={floatStyle(surface)}>
              {IC_NAV.map((item) => {
                const Icon =
                  item.label === 'Home' ? Home :
                  item.label === 'Following' ? Users :
                  item.label === 'Trending' ? TrendingUp :
                  item.label === 'Info' ? Radio :
                  item.label === 'Bookmarks' ? Bookmark :
                  UserPlus;
                const active = navItem === item.label;
                return (
                  <button
                    key={item.label}
                    onClick={() => setNavItem(item.label)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all"
                    style={{
                      border: active ? `1px solid ${surface.borderLight}` : '1px solid transparent',
                      background: active ? surface.tabActive : 'transparent',
                      color: active ? surface.accentText : '#84929f',
                    }}
                    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = surface.hoverBg; e.currentTarget.style.color = '#c7cfd8'; } }}
                    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#84929f'; } }}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span className="text-xs font-medium tracking-wide">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Your Hub floats */}
            <div className="mt-auto p-4" style={floatStyle(surface)}>
              <div className="mb-2 text-[9px] font-mono tracking-[0.25em] text-[#475565] uppercase">Your Hub</div>
              <div className="rounded-lg border p-3" style={{ borderColor: surface.borderLight, background: surface.accentSoft }}>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: surface.borderLight, background: surface.panelBgLight }}>
                    <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: surface.accent }} />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold" style={{ color: surface.accentText }}>{hubShort}</div>
                    <div className="text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">Active</div>
                  </div>
                </div>
                <button
                  onClick={onBackToHub}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-[10px] font-semibold tracking-widest uppercase transition-all"
                  style={{
                    borderColor: surface.border,
                    background: surface.panelBgLight,
                    color: '#aab6c2',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = surface.accent; e.currentTarget.style.color = surface.accent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = surface.border; e.currentTarget.style.color = '#aab6c2'; }}
                >
                  <ArrowLeft className="h-3 w-3" strokeWidth={1.5} /> Return to Hub
                </button>
              </div>
            </div>
          </aside>

          {/* ===== CENTER COLUMN — transparent, title/tabs/composer/posts float individually ===== */}
          <main className="flex min-w-0 flex-1 flex-col gap-3">
            {/* Title + tabs float */}
            <div className="shrink-0 px-6 pt-5 pb-2" style={floatStyle(surface)}>
              <h1 className="text-2xl font-bold tracking-tight text-white">Community Hub</h1>
              <p className="mt-0.5 text-xs text-[#5f6e7c]">The poker industry — live. Curated. Verified. Distributed.</p>

              <div className="mt-4 flex gap-1">
                {TABS.map((t) => {
                  const active = tab === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className="relative px-4 py-2.5 text-xs font-semibold tracking-wide transition-all"
                      style={{ color: active ? surface.accentText : '#5f6e7c' }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#aab6c2'; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#5f6e7c'; }}
                    >
                      {t}
                      {active && (
                        <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: surface.accent }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable feed area — transparent, individual posts float */}
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-2xl space-y-4 px-1">
                {/* Composer floats */}
                <div className="p-4" style={floatStyle(surface)}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
                      style={{ borderColor: surface.borderLight, background: surface.panelBgLight, color: surface.accent }}>RK</div>
                    <button
                      onClick={onOpenPublish}
                      className="flex-1 rounded-lg border px-4 py-2.5 text-left text-sm transition-all"
                      style={{ borderColor: surface.border, background: surface.inputBg, color: '#5f6e7c' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = surface.borderLight; e.currentTarget.style.color = '#aab6c2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = surface.border; e.currentTarget.style.color = '#5f6e7c'; }}
                    >
                      What's happening in poker?
                    </button>
                    <button
                      onClick={onOpenPublish}
                      className="rounded-lg border px-4 py-2.5 text-[10px] font-semibold tracking-[0.2em] uppercase transition-all"
                      style={{
                        borderColor: surface.borderLight,
                        background: surface.accentSoft,
                        color: surface.accentText,
                      }}
                    >
                      Create Post
                    </button>
                  </div>
                </div>

                {/* Each post floats independently */}
                {state.feed.map((item) => (
                  <FeedCard
                    key={item.id}
                    item={item}
                    surface={surface}
                    commenting={commenting === item.id}
                    commentDraft={commentDraft}
                    setCommentDraft={setCommentDraft}
                    onToggleComment={() => setCommenting((c) => (c === item.id ? null : item.id))}
                    onSubmitComment={() => {
                      setCommentDraft('');
                      setCommenting(null);
                    }}
                  />
                ))}

                {/* SpotVault Gives contribution feed events */}
                {givesContributions.filter((c) => c.privacy !== 'private').length > 0 && (
                  <>
                    {givesContributions
                      .filter((c) => c.privacy !== 'private')
                      .map((contribution) => (
                        <GivesFeedEvent key={contribution.id} contribution={contribution} />
                      ))
                      .reverse()}
                  </>
                )}

                <div className="mt-6 mb-4 text-center text-[10px] font-mono tracking-[0.3em] text-[#2a323b] uppercase">
                  End of feed · Inner Circle
                </div>
              </div>
            </div>
          </main>

          {/* ===== RIGHT COLUMN — transparent, each widget floats independently ===== */}
          <aside className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto lg:flex">
            {/* Trending floats */}
            <div className="p-4" style={floatStyle(surface)}>
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" strokeWidth={1.5} style={{ color: surface.accent }} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: surface.accentText }}>Trending in Poker</span>
              </div>
              <div className="space-y-2.5">
                {TRENDING_TOPICS.map((topic) => (
                  <div key={topic.tag} className="cursor-pointer rounded-lg px-2 py-1.5 transition-all"
                    onMouseEnter={(e) => { e.currentTarget.style.background = surface.hoverBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-3 w-3" strokeWidth={1.5} style={{ color: surface.secondaryAccent }} />
                      <span className="text-xs font-semibold text-white">{topic.tag}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[#475565]">{topic.posts}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* SpotVault Gives widget floats */}
            <SpotVaultGivesWidget
              onContribute={() => setGivesContributeOpen(true)}
              onSeeImpact={() => setGivesImpactOpen(true)}
            />

            {/* Who to follow floats */}
            <div className="p-4" style={floatStyle(surface)}>
              <div className="mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4" strokeWidth={1.5} style={{ color: surface.accent }} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: surface.accentText }}>Who to Follow</span>
              </div>
              <div className="space-y-3">
                {WHO_TO_FOLLOW.map((person) => (
                  <div key={person.name} className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold text-[#c7cfd8]"
                      style={{ borderColor: surface.border, background: surface.panelBgLight }}>
                      {person.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs font-semibold text-white">{person.name}</span>
                        {person.verified && <ShieldCheck className="h-3 w-3 shrink-0" strokeWidth={1.5} style={{ color: surface.accent }} />}
                      </div>
                      <div className="truncate text-[10px] text-[#5f6e7c]">{person.handle}</div>
                    </div>
                    <button className="shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold transition-all"
                      style={{ borderColor: surface.borderLight, background: surface.accentSoft, color: surface.accentText }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = surface.accentSoft.replace('0.12', '0.2').replace('0.14', '0.22'); }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = surface.accentSoft; }}
                    >
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming events floats */}
            <div className="p-4" style={floatStyle(surface)}>
              <div className="mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" strokeWidth={1.5} style={{ color: surface.accent }} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: surface.accentText }}>Upcoming Events</span>
              </div>
              <div className="space-y-2.5">
                {UPCOMING_EVENTS.map((event) => (
                  <div key={event.title} className="rounded-lg border p-2.5 transition-all"
                    style={{ borderColor: surface.border, background: surface.inputBg }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = surface.borderLight; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = surface.border; }}
                  >
                    <div className="text-xs font-semibold text-white">{event.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[#5f6e7c]">
                      <span className="font-mono">{event.date}</span>
                      <span>·</span>
                      <span>{event.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active rooms floats */}
            <div className="p-4" style={floatStyle(surface)}>
              <div className="mb-3 flex items-center gap-2">
                <Radio className="h-4 w-4" strokeWidth={1.5} style={{ color: surface.accent }} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: surface.accentText }}>Active Industry Rooms</span>
              </div>
              <div className="space-y-2">
                {ACTIVE_ROOMS.map((room) => (
                  <div key={room.name} className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-all"
                    onMouseEnter={(e) => { e.currentTarget.style.background = surface.hoverBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="flex items-center gap-2">
                      {room.live && <span className="h-1.5 w-1.5 rounded-full" style={{ background: surface.secondaryAccent, boxShadow: `0 0 6px ${surface.secondaryAccent}` }} />}
                      <span className="text-xs font-medium text-[#aab6c2]">{room.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#475565]">{room.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ===== Customize Space dropdown — PORTAL to body, z-9999 ===== */}
      {themeMenuOpen && typeof document !== 'undefined' && createPortal(
        <>
          <div
            onClick={() => setThemeMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'transparent' }}
          />
          <div
            style={{
              position: 'fixed',
              top: `${menuPos.top}px`,
              right: `${menuPos.right}px`,
              zIndex: 9999,
              width: '264px',
              borderRadius: '12px',
              border: `1px solid ${surface.border}`,
              background: 'rgba(8, 9, 10, 0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              padding: '8px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ padding: '4px 12px 8px' }}>
              <div style={{ fontSize: '8px', fontFamily: 'monospace', letterSpacing: '0.25em', color: '#666A6D', textTransform: 'uppercase' }}>Environment</div>
              <div style={{ marginTop: '2px', fontSize: '9px', color: '#4A4D4F' }}>Choose your community atmosphere</div>
            </div>
            {availableThemes.map((theme) => {
              const active = themeId === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => selectTheme(theme.id)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                    background: active ? surface.accentSoft : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = surface.hoverBg; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: active ? surface.accentText : '#C7C9C7' }}>{theme.name}</span>
                    <span style={{ fontSize: '9px', color: '#7A7D7F', marginTop: '1px' }}>{theme.description}</span>
                  </span>
                  {active && <Check style={{ height: '16px', width: '16px', flexShrink: 0, color: surface.accent, strokeWidth: 2 }} />}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}

      {/* SpotVault Gives modals */}
      <ContributeModal
        open={givesContributeOpen}
        onClose={() => setGivesContributeOpen(false)}
        onComplete={(contribution) => {
          setGivesContributions((prev) => [...prev, contribution]);
        }}
      />
      <ImpactCenterModal
        open={givesImpactOpen}
        onClose={() => setGivesImpactOpen(false)}
        onContribute={() => {
          setGivesImpactOpen(false);
          setGivesContributeOpen(true);
        }}
      />
    </div>
  );
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2);
}

function FeedCard({
  item,
  surface,
  commenting,
  commentDraft,
  setCommentDraft,
  onToggleComment,
  onSubmitComment,
}: {
  item: FeedItem;
  surface: CommunityThemeSurface;
  commenting: boolean;
  commentDraft: string;
  setCommentDraft: (v: string) => void;
  onToggleComment: () => void;
  onSubmitComment: () => void;
}) {
  const isNew = item.published;
  return (
    <div className="p-5" style={floatStyle(surface)}>
      {isNew && (
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: surface.accent, boxShadow: `0 0 8px ${surface.accent}` }} />
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase" style={{ color: surface.accent }}>Just Published · From Media Hub</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border text-[10px] font-semibold text-[#c7cfd8]"
          style={{ borderColor: surface.border, background: surface.panelBgLight }}>
          {initials(item.author)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{item.author}</span>
            {item.verified && <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: surface.accent }} />}
            {item.org && (
              <span className="rounded border px-1.5 py-0.5 text-[8px] font-mono tracking-widest uppercase"
                style={{ borderColor: surface.border, background: surface.inputBg, color: '#aab6c2' }}>
                Org
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border px-1.5 py-0.5 text-[8px] font-mono font-medium tracking-widest uppercase"
              style={{ borderColor: surface.border, background: surface.inputBg, color: '#aab6c2' }}>
              {HUB_SHORT[item.hub]}
            </span>
            <span className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">{item.kind}</span>
            <span className="text-[10px] text-[#475565]">· {item.timestamp}</span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <h3 className="text-base font-semibold leading-snug text-white">{item.title}</h3>
        {item.body && <p className="mt-1.5 text-sm leading-relaxed text-[#aab6c2]">{item.body}</p>}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button className="rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all"
          style={{ borderColor: surface.borderLight, background: surface.accentSoft, color: surface.accentText }}
          onMouseEnter={(e) => { e.currentTarget.style.background = surface.accentSoft.replace('0.12', '0.2').replace('0.14', '0.22'); }}
          onMouseLeave={(e) => { e.currentTarget.style.background = surface.accentSoft; }}
        >
          {item.cta}
        </button>
        <div className="flex items-center gap-1">
          <FeedAction icon={Heart} label="Like" count={item.likes} surface={surface} />
          <FeedAction icon={MessageCircle} label="Comment" count={item.comments_count} onClick={onToggleComment} active={commenting} surface={surface} />
          <FeedAction icon={Share2} label="Repost" count={item.reposts} surface={surface} />
          <FeedAction icon={Bookmark} label="Save" count={item.saves} surface={surface} />
          <FeedAction icon={ArrowRight} label="Share" count={item.shares} surface={surface} />
        </div>
      </div>

      {item.comments && item.comments.length > 0 && (
        <div className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: surface.borderLight }}>
          {item.comments.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[8px] font-semibold text-[#aab6c2]"
                style={{ borderColor: surface.border, background: surface.inputBg }}>
                {initials(c.author)}
              </div>
              <div className="flex-1">
                <span className="text-xs font-semibold text-[#c7cfd8]">{c.author}</span>
                <span className="ml-2 text-xs text-[#aab6c2]">{c.text}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {commenting && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 rounded-lg border px-3 py-2 text-xs text-white placeholder-[#475565]"
            style={{ borderColor: surface.border, background: surface.inputBg }}
          />
          <button
            onClick={onSubmitComment}
            className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all"
            style={{ borderColor: surface.borderLight, background: surface.accentSoft, color: surface.accent }}
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}

function FeedAction({
  icon: Icon,
  label,
  count,
  onClick,
  active,
  surface,
}: {
  icon: typeof Heart;
  label: string;
  count?: number;
  onClick?: () => void;
  active?: boolean;
  surface: CommunityThemeSurface;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-all"
      style={{
        background: active ? surface.accentSoft : 'transparent',
        color: active ? surface.accentText : '#5f6e7c',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = surface.hoverBg; e.currentTarget.style.color = '#aab6c2'; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5f6e7c'; } }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      {count !== undefined && <span>{count}</span>}
      <span className="sr-only">{label}</span>
    </button>
  );
}
