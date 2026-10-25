// Central debug navigation registry — derives from the SAME portal configs
// that control the real sidebar navigation. This is the single source of truth
// for debug metadata; it does NOT create a parallel navigation model.

import type { PortalNavEntry } from '@/data/portalConfigs';
import {
  PLAYER_NAV, INVESTOR_NAV, AFFILIATE_NAV, STAFF_NAV, COMMUNITY_NAV,
  BUSINESS_NAV, CREATOR_NAV, STABLE_NAV, COACH_NAV,
} from '@/data/portalConfigs';

export interface DebugNavInfo {
  navSection: string;
  navItem: string;
  component: string;
  source: string;
  parent: string;
}

const UNKNOWN_INFO: DebugNavInfo = {
  navSection: 'unknown',
  navItem: 'unknown',
  component: 'unknown',
  source: 'unknown',
  parent: 'unknown',
};

// ── View → component/source map ──
const VIEW_COMPONENT_MAP: Record<string, { component: string; source: string; parent: string }> = {
  'home': { component: 'HomeWorkspace', source: 'src/components/player/HomeWorkspace.tsx', parent: 'PlayerHub' },
  'market-store': { component: 'Store', source: 'src/components/Store.tsx', parent: 'PlayerHub' },
  'spot-store': { component: 'Store', source: 'src/components/Store.tsx', parent: 'PlayerHub' },
  'multispot-store': { component: 'Store', source: 'src/components/Store.tsx', parent: 'PlayerHub' },
  'marketplace': { component: 'Store', source: 'src/components/Store.tsx', parent: 'PlayerHub' },
  'analytics': { component: 'AnalyticsView', source: 'src/components/player/AnalyticsView.tsx', parent: 'PlayerHub' },
  'hand-analysis': { component: 'HandReviewWorkspace', source: 'src/components/player/HandReviewWorkspace.tsx', parent: 'PlayerHub' },
  'content-lab': { component: 'ContentLabView', source: 'src/components/player/ContentLabView.tsx', parent: 'PlayerHub' },
  'solver': { component: 'SolverHub', source: 'src/components/solver/SolverHub.tsx', parent: 'PlayerHub' },
  'people': { component: 'PeopleDirectory', source: 'src/components/people/PeopleDirectory.tsx', parent: 'PlayerHub' },
  'opportunities': { component: 'OpportunitiesPage', source: 'src/components/OpportunitiesPage.tsx', parent: 'PlayerHub' },
  'jobs': { component: 'JobsPage', source: 'src/components/JobsPage.tsx', parent: 'PlayerHub' },
  'advertising': { component: 'AdvertisingPage', source: 'src/components/AdvertisingPage.tsx', parent: 'PlayerHub' },
  'profile': { component: 'ProfilePage', source: 'src/components/ProfilePage.tsx', parent: 'PlayerHub' },
  'settings': { component: 'SettingsPage', source: 'src/components/player/SettingsPage.tsx', parent: 'PlayerHub' },
  'privacy': { component: 'PrivacyPolicyPage', source: 'src/components/PrivacyPolicyPage.tsx', parent: 'PlayerHub' },
  'terms': { component: 'TermsOfServicePage', source: 'src/components/TermsOfServicePage.tsx', parent: 'PlayerHub' },
  'my-spots': { component: 'MySpotsView', source: 'src/components/player/MySpotsView.tsx', parent: 'PlayerHub' },
  'my-library': { component: 'MyLibraryView', source: 'src/components/player/MyLibraryView.tsx', parent: 'PlayerHub' },
  'public-library': { component: 'PublicLibraryView', source: 'src/components/player/PublicLibraryView.tsx', parent: 'PlayerHub' },
  'hh-replayer': { component: 'HHReplayerView', source: 'src/components/player/HHReplayerView.tsx', parent: 'PlayerHub' },
  'hh-jukebox': { component: 'HHJukeboxView', source: 'src/components/player/HHJukeboxView.tsx', parent: 'PlayerHub' },
  'hh-workspace': { component: 'HandReviewWorkspace', source: 'src/components/player/HandReviewWorkspace.tsx', parent: 'PlayerHub' },
  'bookings': { component: 'MyBookings', source: 'src/components/booking/MyBookings.tsx', parent: 'PlayerHub' },
  'rolodex': { component: 'IndustryRolodex', source: 'src/components/professional/IndustryRolodex.tsx', parent: 'PlayerHub' },
  'stakekings-action': { component: 'StakeKingsActionMarketplace', source: 'src/components/stakekings/StakeKingsActionMarketplace.tsx', parent: 'PlayerHub' },
  'creator-business': { component: 'CreatorBusinessPage', source: 'src/components/creator/CreatorBusinessPage.tsx', parent: 'CreatorHub' },
  'coach-business': { component: 'CoachBusinessPage', source: 'src/components/coach/CoachBusinessPage.tsx', parent: 'CoachHub' },
  'lab': { component: 'CoachLabView', source: 'src/components/coach/CoachLabView.tsx', parent: 'CoachHub' },
  'business-profile': { component: 'BusinessProfilePage', source: 'src/components/business/BusinessProfilePage.tsx', parent: 'BusinessHub' },
  'create': { component: 'BusinessCreateStudio', source: 'src/components/business/BusinessCreateStudio.tsx', parent: 'BusinessHub' },
  'custom-portals': { component: 'CustomPortalsBrowser', source: 'src/components/CustomPortalsBrowser.tsx', parent: 'PlayerHub' },
  'help': { component: 'HelpHub', source: 'src/components/HelpHub.tsx', parent: 'PlayerHub' },
  'performance': { component: 'PerformancePage', source: 'src/components/coach/PerformancePage.tsx', parent: 'CoachHub' },
  'explore': { component: 'ExploreSpotVaultPage', source: 'src/components/ExploreSpotVaultPage.tsx', parent: 'PlayerHub' },
};

// ── Build nav-entry lookup from ALL portal nav arrays ──
const ALL_NAV_ENTRIES: PortalNavEntry[] = [
  ...PLAYER_NAV,
  ...INVESTOR_NAV,
  ...AFFILIATE_NAV,
  ...STAFF_NAV,
  ...COMMUNITY_NAV,
  ...COACH_NAV,
  ...CREATOR_NAV,
  ...STABLE_NAV,
  ...BUSINESS_NAV,
];

const NAV_LOOKUP: Map<string, PortalNavEntry> = new Map();
for (const entry of ALL_NAV_ENTRIES) {
  if (!NAV_LOOKUP.has(entry.id)) {
    NAV_LOOKUP.set(entry.id, entry);
  }
}

export function resolveNavInfo(viewId: string | null | undefined): DebugNavInfo {
  if (!viewId) return UNKNOWN_INFO;
  const navEntry = NAV_LOOKUP.get(viewId);
  const compInfo = VIEW_COMPONENT_MAP[viewId];
  return {
    navSection: navEntry?.section ?? 'unknown',
    navItem: navEntry?.label ?? viewId,
    component: compInfo?.component ?? `CustomView(${viewId})`,
    source: compInfo?.source ?? 'unknown',
    parent: compInfo?.parent ?? 'unknown',
  };
}

// ── Portal type map ──
const PORTAL_MAP: Record<string, { type: string; component: string; source: string }> = {
  PLAYER: { type: 'Player', component: 'PlayerHub', source: 'src/components/PlayerHub.tsx' },
  CREATOR: { type: 'Creator', component: 'CreatorHub', source: 'src/components/CreatorHub.tsx' },
  COACH: { type: 'Coach', component: 'CoachHub', source: 'src/components/CoachHub.tsx' },
  STABLE: { type: 'Stable', component: 'StableHub', source: 'src/components/StableHub.tsx' },
  BUSINESS: { type: 'Business', component: 'BusinessHub', source: 'src/components/BusinessHub.tsx' },
  INVESTOR: { type: 'Investor', component: 'BusinessHub', source: 'src/components/BusinessHub.tsx' },
  STAFF: { type: 'Staff', component: 'StaffHub', source: 'src/components/StaffHub.tsx' },
  MEDIA: { type: 'Media', component: 'MediaRoom', source: 'src/components/MediaRoom.tsx' },
  AFFILIATE_PARTNER: { type: 'Affiliate', component: 'BusinessHub', source: 'src/components/BusinessHub.tsx' },
  STAKEKINGS_PLAYER: { type: 'StakeKings Player', component: 'StakeKingsPlayerPortal', source: 'src/components/stakekings/StakeKingsPlayerPortal.tsx' },
  STAKEKINGS_ADMIN: { type: 'StakeKings Admin', component: 'StakeKingsManagementHub', source: 'src/components/stakekings/StakeKingsManagementHub.tsx' },
};

export function resolvePortalInfo(portal: string) {
  return PORTAL_MAP[portal] ?? { type: portal, component: 'unknown', source: 'unknown' };
}

export function buildDebugId(portalType: string, navSection: string, navItem: string, subView: string | null): string {
  const parts = [portalType.toUpperCase()];
  if (navSection !== 'unknown') parts.push(navSection.toUpperCase());
  if (navItem !== 'unknown') parts.push(navItem.toUpperCase());
  if (subView) parts.push(subView.toUpperCase());
  return parts.join('.');
}
