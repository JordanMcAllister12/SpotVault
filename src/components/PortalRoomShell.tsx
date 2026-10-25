import { type ReactNode, useMemo, useState } from 'react';
import { Bell, Home, Menu, Zap, X, Settings as SettingsIcon, Info, Users, MessageSquare, type LucideIcon } from 'lucide-react';
import { AccountDropdown } from '@/components/AccountDropdown';

import { PortalSwitcher } from '@/components/PortalSwitcher';
import { CollapsibleNavSection } from '@/components/CollapsibleNavSection';
import { usePortalBackground, getPortalScreenTarget } from '@/data/environmentAssets';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { resolveLoungeAccent } from '@/lib/portalTheme';
import { HomeWorkspace } from '@/components/player/HomeWorkspace';
import { MobilePortalHome } from '@/components/player/MobilePortalHome';
import type { UniversalView } from '@/components/UniversalRail';
import type { PortalNavEntry } from '@/data/portalConfigs';
import type { Demo } from '@/useDemo';
import { isStaffOrAdmin, isFounderUser, type HubId } from '@/types';
import type { PortalId } from '@/useDemo';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const GOLD = '#d4a52c';

export interface PortalRoomShellProps {
  demo: Demo;
  icon: LucideIcon;
  portalLabel: string;
  roomLabel: string;
  navItems: PortalNavEntry[];
  activeNav: string;
  onNavigate: (view: string) => void;
  onSwitchPortal: (portal: HubId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onBack: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
  onOpenCredits?: () => void;
  screenTarget?: string;
  /** Deprecated: no longer used. Sections now flow naturally top-to-bottom
   *  with only normal spacing between groups. Kept in props for backward compat. */
  pushSecondarySectionsDown?: boolean;
  /** Override the wallpaper with a custom background URL (e.g. StakeKings branding). */
  backgroundOverride?: string | null;
  /** Override the portal logo shown in the sidebar header (URL). */
  portalLogoOverride?: string | null;
  /** Override the accent color used for active nav, borders, etc. */
  accentOverride?: string;
  /** Callback to open the Custom Portals browser from the portal switcher. */
  onOpenCustomPortals?: () => void;
  /** Label to show in the switcher when a custom portal is active. */
  customPortalLabel?: string | null;
  /** Active custom portal slug (null = default SpotVault). */
  activePortalId?: string | null;
  /** Custom portal memberships available to this user. */
  customPortals?: CustomPortalMembership[];
  /** Enter a custom portal from the switcher's nested menu. */
  onEnterCustomPortal?: (portal: CustomPortalMembership) => void;
  /** Return to default SpotVault from a custom portal. */
  onReturnToDefault?: () => void;
  /** Portal key for per-portal widget layout persistence. When provided,
   *  the shared bottom widget dock (Media Player, Analytics, Chat) is rendered
   *  as an overlay layer inside the room. Defaults to 'player'. */
  portalKey?: string;
  /** User ID for widget layout persistence (Supabase). */
  widgetUserId?: string;
  /** Callback to open the Profile/Settings page with a specific tab. */
  onOpenProfileSettings?: (tab: 'profile' | 'account-security' | 'rewards') => void;
  /** Callback to open Community (desktop header button). */
  onOpenCommunity?: () => void;
  /** Callback for the LOUNGES nav button (navigates to lounge area). */
  onOpenLoungesNav?: () => void;
  /** Callback to sign out the current user. */
  onLogout?: () => void;
  /** When true, all sidebar sections are expanded by default. */
  expandAllSections?: boolean;
  children?: ReactNode;
}

export function PortalRoomShell({
  demo,
  icon: Icon,
  portalLabel,
  roomLabel,
  navItems,
  activeNav,
  onNavigate,
  onSwitchPortal,
  portalSwitchOpen,
  onTogglePortalSwitch,
  onClosePortalSwitch,
  onBack,
  onOpenUniversalView,
  onOpenCredits,
  screenTarget,
  pushSecondarySectionsDown = false,
  backgroundOverride,
  portalLogoOverride,
  accentOverride,
  onOpenCustomPortals,
  customPortalLabel,
  activePortalId,
  customPortals,
  onEnterCustomPortal,
  onReturnToDefault,
  portalKey = 'player',
  widgetUserId,
  onOpenProfileSettings,
  onOpenCommunity,
  onOpenLoungesNav,
  onLogout,
  expandAllSections = false,
  children,
}: PortalRoomShellProps) {
  const { state } = demo;
  const account = state.currentAccount;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sectionOpenState, setSectionOpenState] = useState<Record<string, boolean>>({});
  const credits = state.credits;
  const currentLevel = 1;
  const nextLevel = currentLevel + 1;
  const xpPercent = 0;
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isFounder = isFounderUser(account);

  const showWidgetDock = !isMobile && portalKey !== 'player' && portalKey !== 'staff' && activeNav === 'home';
  const showMobilePortalHome = isMobile && portalKey !== 'player' && portalKey !== 'staff' && activeNav === 'home';

  const resolvedTarget = screenTarget ?? getPortalScreenTarget(state.selectedPortal);
  const portalBackground = usePortalBackground(resolvedTarget, account?.id);
  const userPrefs = useUserPreferences(account?.id);
  // Priority: explicit override > user site bg > portal default
  const userSiteBg = userPrefs.prefs.siteBgType === 'custom' && userPrefs.prefs.siteBgValue
    ? userPrefs.prefs.siteBgValue
    : userPrefs.prefs.siteBgType === 'preset' && userPrefs.prefs.siteBgValue
      ? userPrefs.prefs.siteBgValue
      : null;
  const backgroundSrc = backgroundOverride ?? userSiteBg ?? portalBackground?.src ?? null;
  // Lounge accent: explicit accentOverride > user lounge accent preference
  const userLoungeAccent = userPrefs.prefs.loungeAccent
    ? resolveLoungeAccent(userPrefs.prefs.loungeAccent).accent
    : null;
  const accent = accentOverride ?? userLoungeAccent ?? GOLD;

  // Group nav items by section, preserving order. The first section encountered
  // (the portal's own section) is the "primary" section — open by default.
  // All other sections are collapsed by default and auto-expand only when
  // they contain the active route.
  const standaloneAbout = useMemo(
    () => navItems.find((item) => item.id === 'about' && item.section === 'Home') ?? null,
    [navItems],
  );

  const groupedSections = useMemo(() => {
    const nonHome = navItems.filter(
      (item) => item.id !== 'home' && !(item.id === 'about' && item.section === 'Home'),
    );
    const sections: { section: string; items: PortalNavEntry[]; isPrimary: boolean; isLegal: boolean }[] = [];
    const seen = new Set<string>();
    for (const item of nonHome) {
      const sec = item.section ?? 'Other';
      if (!seen.has(sec)) {
        seen.add(sec);
        sections.push({
          section: sec,
          items: nonHome.filter((i) => (i.section ?? 'Other') === sec),
          isPrimary: sections.length === 0,
          isLegal: sec === 'Legal',
        });
      }
    }
    return sections;
  }, [navItems]);

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-5">
        {portalLogoOverride ? (
          <img src={portalLogoOverride} alt={portalLabel} className="max-h-8 max-w-[80px] object-contain" />
        ) : (
          <Icon className="h-4 w-4" style={{ color: accent }} />
        )}
        <div>
          <div className="text-[11px] font-bold tracking-[0.2em] text-white uppercase">{portalLabel}</div>
          <div className="text-[9px] font-mono tracking-widest uppercase" style={{ color: accent, opacity: 0.7 }}>Menu</div>
        </div>
      </div>
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
            activeNav === 'home'
              ? ''
              : 'border-transparent text-[#9A9D9F]'
          }`}
          style={activeNav === 'home' ? { borderColor: accent + '4D', background: accent + '1A', color: accent } : { borderColor: 'transparent' }}
        >
          <Home className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span className="text-xs font-medium tracking-wide">Home</span>
        </button>
        {standaloneAbout && (
          <button
            type="button"
            onClick={() => onNavigate('about')}
            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
              activeNav === 'about'
                ? ''
                : 'border-transparent text-[#9A9D9F]'
            }`}
            style={activeNav === 'about' ? { borderColor: accent + '4D', background: accent + '1A', color: accent } : { borderColor: 'transparent' }}
          >
            <Info className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="text-xs font-medium tracking-wide">About</span>
          </button>
        )}
        <div className="my-2 border-t border-white/[0.04]" />
        {(() => {
          // For non-player portals: role section + Tools open, Store/Player/Industry/Legal closed.
          // For player portal: preserve existing behavior (primary + Library/Study Tools/Store/Tools/Staff/Stable open).
          const isPlayerPortal = portalKey === 'player';
          const isDefaultOpen = (s: string) =>
            isPlayerPortal
              ? (s === 'Market' || s === 'Tools')
              : s === 'Tools';

          // The "SpotVault" section (Explore SpotVault) should never auto-open.
          // It is the first section in PLAYER_NAV so isPrimary is true, but we
          // override that here — the user must manually expand it.
          const forceCollapsed = (s: string) => s === 'SpotVault';

          // For non-player portals, the role-specific section (primary) should be open
          // but Store should be closed. isDefaultOpen already handles Store for non-player.
          // The primary section (role-specific) is opened via group.isPrimary in the render below.
          // For non-player portals we also need to force-collapse Store even if it's primary.
          const shouldSectionBeOpen = (group: { section: string; isPrimary: boolean }) => {
            if (forceCollapsed(group.section)) return false;
            if (expandAllSections) return true;
            if (isPlayerPortal) return group.isPrimary || isDefaultOpen(group.section);
            // Non-player: role section (primary) open, Tools open, everything else closed
            return group.isPrimary || isDefaultOpen(group.section);
          };

          const handleOpenChange = (section: string, open: boolean) => {
            setSectionOpenState((prev) => ({ ...prev, [section]: open }));
          };

          const legalGroup = groupedSections.find((g) => g.section === 'Legal');
          const otherGroups = groupedSections.filter((g) => g.section !== 'Legal');

          const legalOpen = sectionOpenState['Legal'] ?? expandAllSections;

          return (
            <>
              {otherGroups.map((group) => (
                <div key={group.section}>
                  <CollapsibleNavSection
                    section={group.section}
                    items={group.items}
                    activeNav={activeNav}
                    defaultOpen={shouldSectionBeOpen(group)}
                    onNavigate={onNavigate}
                    onOpenUniversalView={(id) => onOpenUniversalView(id as UniversalView)}
                  />
                </div>
              ))}
              {legalGroup && (
                <div>
                  <CollapsibleNavSection
                    section={legalGroup.section}
                    items={legalGroup.items}
                    activeNav={activeNav}
                    defaultOpen={false}
                    onNavigate={onNavigate}
                    onOpenUniversalView={(id) => onOpenUniversalView(id as UniversalView)}
                    controlledOpen={legalOpen}
                    onOpenChange={(o) => handleOpenChange('Legal', o)}
                  />
                </div>
              )}
            </>
          );
        })()}
      </nav>
    </>
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-transparent">
      {/* Desktop sidebar */}
      <aside className="portal-shell-sidebar relative z-20 hidden w-[220px] shrink-0 flex-col overflow-hidden border-r bg-[#080a0c] px-5 py-6 md:flex" style={{ borderColor: accent + '26' }}>
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="portal-shell-sidebar fixed left-0 top-0 z-50 flex h-full w-[280px] max-w-[85vw] flex-col overflow-y-auto overscroll-contain border-r bg-[#080a0c] px-5 py-6 md:hidden" style={{ borderColor: accent + '26' }}>
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 text-white/50 hover:text-white">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main column — wallpaper fills this area, UI floats over it.
          Portal accent CSS variables are set here so all child components
          (Analytics, charts, etc.) can use var(--portal-accent) instead of
          hardcoding gold, achieving visual parity across portal skins. */}
      <div
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
        style={{
          ['--portal-accent' as string]: accent,
          ['--portal-accent-soft' as string]: accent + 'cc',
          ['--portal-accent-rgb' as string]: hexToRgbString(accent),
        }}
      >
        {/* Wallpaper layer (z-0) */}
        {backgroundSrc && (
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url("${backgroundSrc}")` }}
          />
        )}
        {/* Subtle readability scrim — NOT opaque, just enough for text legibility */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />

        {/* TopBar (z-20) — compact on mobile, matching Player mobile header */}
        <header className="relative z-[30] flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/40 px-3 backdrop-blur-md sm:h-20 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition-all hover:border-white/20 hover:text-white md:hidden"
            >
              <Menu className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <div className="text-[10px] font-mono tracking-[0.2em] text-white/60 uppercase">{roomLabel}</div>
            {/* Community + Lounges text nav — visible on all viewports */}
            {onOpenCommunity && (
              <button
                type="button"
                onClick={onOpenCommunity}
                className="hdr-gold-btn group relative flex items-center gap-1.5 overflow-hidden rounded-lg px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all duration-250 active:scale-95 active:bg-[#c0911e]/30 active:text-[#1a1408]"
                title="Community"
              >
                <Users className="hdr-gold-icon h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span className="relative z-10">Community</span>
                <span className="hdr-sweep pointer-events-none absolute inset-0 z-0" />
              </button>
            )}
            {onOpenLoungesNav && (
              <button
                type="button"
                onClick={onOpenLoungesNav}
                className="hdr-gold-btn group relative flex items-center gap-1.5 overflow-hidden rounded-lg px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all duration-250 active:scale-95 active:bg-[#c0911e]/30 active:text-[#1a1408]"
                title="Messages"
              >
                <MessageSquare className="hdr-gold-icon h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span className="relative z-10">Messages</span>
                <span className="hdr-sweep pointer-events-none absolute inset-0 z-0" />
              </button>
            )}
          </div>
          {/* Partner branding group — SK + GhostDawg logos (transparent PNGs) */}
          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-[8px] font-mono tracking-[0.2em] uppercase" style={{ color: 'rgba(232,220,196,0.5)' }}>Partners</span>
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
            {/* Unified Credits & Level progression — compact single component */}
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
            {isFounder && (
            <div>
              <PortalSwitcher
                account={account}
                currentPortal={state.selectedPortal as PortalId}
                onSwitch={(portal) => onSwitchPortal(portal as HubId)}
                open={portalSwitchOpen}
                onToggle={onTogglePortalSwitch}
                onClose={onClosePortalSwitch}
                accent={accent}
                align="right"
                onOpenCustomPortals={onOpenCustomPortals}
                customPortalLabel={customPortalLabel}
                activePortalId={activePortalId}
                customPortals={customPortals}
                onEnterCustomPortal={onEnterCustomPortal}
                onReturnToDefault={onReturnToDefault}
              />
            </div>
            )}
            {/* Notification bell — gold-accented to match left-side design language */}
            <button type="button" className="hdr-white-btn group relative flex h-7 items-center justify-center overflow-hidden rounded-lg px-2 transition-all" title="Notifications">
              <Bell className="hdr-white-icon h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            {/* Profile — functional dropdown */}
            <div className="hidden sm:flex">
              <AccountDropdown
                account={account}
                portalLabel={portalLabel}
                onMyProfile={() => onOpenProfileSettings?.('profile')}
                onBackToHome={onBack}
                onAccountSecurity={() => onOpenProfileSettings?.('account-security')}
                onRewardsProgress={() => onOpenProfileSettings?.('rewards')}
                onLogout={onLogout}
              />
            </div>
          </div>
        </header>

        {/* Main workspace (z-10) — transparent so wallpaper shows through */}
        <main className="relative z-10 min-h-0 flex-1 overflow-auto bg-transparent pb-[calc(env(safe-area-inset-bottom)+4rem)]">{children}</main>

        {/* Mobile portal home — vertical widget stack for professional portals */}
        {showMobilePortalHome && (
          <MobilePortalHome
            portalKey={portalKey}
            portalLabel={portalLabel}
            userId={widgetUserId ?? account?.id}
            account={account}
            onOpenFullMessaging={onOpenCommunity}
          />
        )}

        {/* Shared widget dock overlay — same system as Player Room.
            Rendered for non-player portals on desktop. Player Room renders
            its own HomeWorkspace inside the children content.
            Positioned below the top bar (top-12 on mobile, top-14 on desktop)
            so widgets never overlap the global navigation. */}
        {showWidgetDock && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 top-12 z-[8000] sm:top-14">
            <HomeWorkspace
              portalKey={portalKey}
              userId={widgetUserId ?? account?.id}
              account={account}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function hexToRgbString(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return '212,165,44';
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}

export function PortalSecondFloor({ demo, label }: { demo: Demo; label: string }) {
  const { state } = demo;
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#080a0c]">
      <div className="relative z-10 flex h-full items-center justify-center">
        <div className="text-center">
          <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">{label}</div>
          <div className="mt-2 text-sm text-white/50">Private communication floor for {state.currentAccount?.name ?? 'members'}</div>
        </div>
      </div>
    </div>
  );
}
