import {
  Home,
  Library,
  Globe,
  Music,
  BarChart3,
  FlaskConical,
  Play,
  TrendingUp,
  Building2,
  Users,
  Presentation,
  Bookmark,
  BookOpen,
  Mic2,
  Camera,
  Newspaper,
  Film,
  BriefcaseBusiness,
  Package,
  Megaphone,
  Handshake,
  Trophy,
  CalendarDays,
  MessageSquare,
  CalendarCheck,
  Flame,
  UserCircle,
  ShoppingBag,
  Store,
  Activity,
  HeartPulse,
  FileText,
  FileCheck,
  ScrollText,
  ShieldCheck,
  KeyRound,
  BadgeCheck,
  Radio,
  Lock,
  LayoutDashboard,
  DollarSign,
  Star,
  Calculator,
  Crown,
  MoreHorizontal,
  Settings,
  Contact,
  Zap,
  Info,
  Compass,
  type LucideIcon,
} from 'lucide-react';

export interface PortalNavEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  section?: string;
  /** Optional sub-group within a section. Items sharing the same subSection
   *  value are rendered as a nested collapsible group inside the section. */
  subSection?: string;
}

export interface PortalConfig {
  id: string;
  title: string;
  subtitle: string;
  navigation: PortalNavEntry[];
}

// ── Shared reusable menu groups ──────────────────────────────────

export const SOLVER_NAV_ENTRY: PortalNavEntry = { id: 'solver', label: 'Solver', icon: Calculator, section: 'Tools' };
export const ANALYTICS_NAV_ENTRY: PortalNavEntry = { id: 'analytics', label: 'Analytics', icon: BarChart3, section: 'Tools' };

export const INDUSTRY_NAV_ENTRIES: PortalNavEntry[] = [
  { id: 'people', label: 'People', icon: Users, section: 'Industry' },
  { id: 'opportunities', label: 'Opportunities', icon: BriefcaseBusiness, section: 'Industry' },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, section: 'Industry' },
];

export const LEGAL_NAV_ENTRIES: PortalNavEntry[] = [
  { id: 'privacy', label: 'Privacy Policy', icon: FileText, section: 'Legal' },
  { id: 'terms', label: 'Terms of Service', icon: ScrollText, section: 'Legal' },
];

export const UNIVERSAL_NAV_ENTRIES: PortalNavEntry[] = [
  ...INDUSTRY_NAV_ENTRIES,
  ...LEGAL_NAV_ENTRIES,
];

export const PLAYER_CORE_TOOLS: PortalNavEntry[] = [
  { id: 'my-library', label: 'My Spots', icon: Library, section: 'Account' },
  { id: 'public-library', label: 'Spot Library', icon: Globe, section: 'Account' },
  { id: 'hand-analysis', label: 'Hand Analysis', icon: Play, section: 'Account' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, section: 'Account' },
  { id: 'content-lab', label: 'Content Lab', icon: FlaskConical, section: 'Account' },
  { id: 'bookings', label: 'Bookings', icon: CalendarCheck, section: 'Account' },
  { id: 'profile', label: 'Profile', icon: UserCircle, section: 'Account' },
];

// ── Portal-specific nav arrays ───────────────────────────────────

export const PLAYER_NAV: PortalNavEntry[] = [
  { id: 'home', label: 'Home', icon: Home, section: 'Home' },
  { id: 'about', label: 'About', icon: Info, section: 'Home' },
  { ...SOLVER_NAV_ENTRY, section: 'Tools' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, section: 'Tools' },
  { id: 'hand-analysis', label: 'HH Replayer', icon: Play, section: 'Tools' },
  { id: 'my-spots', label: 'My Spots', icon: Lock, section: 'Tools' },
  { id: 'content-lab', label: 'Create', icon: FlaskConical, section: 'Tools' },
  { id: 'profile', label: 'My Account', icon: UserCircle, section: 'Tools' },
  { id: 'discover', label: 'Discover', icon: Compass, section: 'Tools' },
  { id: 'market-store', label: 'Store', icon: ShoppingBag, section: 'Market' },
  { id: 'spot-store', label: 'Spots', icon: Globe, section: 'Market' },
  { id: 'multispot-store', label: 'Multi-Spots / Courses', icon: Music, section: 'Market' },
  ...LEGAL_NAV_ENTRIES,
];

export const INVESTOR_NAV: PortalNavEntry[] = [
  { id: 'home', label: 'Home', icon: Home, section: 'Investor' },
  { id: 'about', label: 'About', icon: Info, section: 'Investor' },
  { id: 'deal-flow', label: 'Deal Flow', icon: TrendingUp, section: 'Investor' },
  { id: 'startups', label: 'Startups', icon: Building2, section: 'Investor' },
  { id: 'founders', label: 'Founders', icon: Users, section: 'Investor' },
  { id: 'pitch-room', label: 'Pitch Room', icon: Presentation, section: 'Investor' },
  { id: 'meetings', label: 'Meetings', icon: CalendarDays, section: 'Investor' },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark, section: 'Investor' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, section: 'Investor' },
  { id: 'directory', label: 'Directory', icon: BookOpen, section: 'Investor' },
  { id: 'bookings', label: 'Bookings', icon: CalendarCheck, section: 'Investor' },
  ...INDUSTRY_NAV_ENTRIES,
  ...LEGAL_NAV_ENTRIES,
];

// Shared Rolodex nav entry — added to every professional portal
export const ROLODEX_NAV_ENTRY: PortalNavEntry = { id: 'rolodex', label: 'Rolodex', icon: Contact, section: '__ROLE__' };

// Portal-specific additions appended after PLAYER_NAV
const COACH_ADDITIONS: PortalNavEntry[] = [
  { id: 'coach-business', label: 'Coach Business', icon: BriefcaseBusiness, section: 'Coach' },
  { id: 'lab', label: 'Lab', icon: FlaskConical, section: 'Coach' },
  { ...ROLODEX_NAV_ENTRY, section: 'Coach' },
  { id: 'paid-requests', label: 'Paid Requests', icon: Zap, section: 'Coach' },
];

const CREATOR_ADDITIONS: PortalNavEntry[] = [
  { id: 'creator-business', label: 'Creator Business', icon: BriefcaseBusiness, section: 'Creator' },
  { ...ROLODEX_NAV_ENTRY, section: 'Creator' },
  { id: 'subscriptions', label: 'Subscriptions', icon: Star, section: 'Creator' },
  { id: 'paid-requests', label: 'Paid Requests', icon: Zap, section: 'Creator' },
];

const STABLE_ADDITIONS: PortalNavEntry[] = [
  { id: 'business', label: 'Stable Business', icon: Building2, section: 'Stable' },
  { ...ROLODEX_NAV_ENTRY, section: 'Stable' },
  { id: 'paid-requests', label: 'Paid Requests', icon: Zap, section: 'Stable' },
];

const BUSINESS_ADDITIONS: PortalNavEntry[] = [
  { id: 'business-profile', label: 'Business Profile', icon: Building2, section: 'Business' },
  { ...ROLODEX_NAV_ENTRY, section: 'Business' },
  { id: 'paid-requests', label: 'Paid Requests', icon: Zap, section: 'Business' },
];

export const BUSINESS_NAV: PortalNavEntry[] = [...PLAYER_NAV, ...BUSINESS_ADDITIONS];

export const CREATOR_NAV: PortalNavEntry[] = [...PLAYER_NAV, ...CREATOR_ADDITIONS];

export const AFFILIATE_NAV: PortalNavEntry[] = [
  { id: 'home', label: 'Home', icon: Home, section: 'Affiliate' },
  { id: 'about', label: 'About', icon: Info, section: 'Affiliate' },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, section: 'Affiliate' },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone, section: 'Affiliate' },
  { id: 'partners', label: 'Partners', icon: Handshake, section: 'Affiliate' },
  { id: 'earnings', label: 'Earnings', icon: TrendingUp, section: 'Affiliate' },
  { id: 'bookings', label: 'Bookings', icon: CalendarCheck, section: 'Affiliate' },
  ...INDUSTRY_NAV_ENTRIES,
  ...LEGAL_NAV_ENTRIES,
];

export const STABLE_NAV: PortalNavEntry[] = [...PLAYER_NAV, ...STABLE_ADDITIONS];

const MEDIA_ADDITIONS: PortalNavEntry[] = [
  { id: 'media-business', label: 'Media Business', icon: Mic2, section: 'Media' },
  { ...ROLODEX_NAV_ENTRY, section: 'Media' },
  { id: 'paid-requests', label: 'Paid Requests', icon: Zap, section: 'Media' },
];

export const STAFF_NAV: PortalNavEntry[] = [
  { id: 'home', label: 'Home', icon: Home, section: 'Staff' },
  { id: 'about', label: 'About', icon: Info, section: 'Staff' },
  ...INDUSTRY_NAV_ENTRIES,
  ...LEGAL_NAV_ENTRIES,
];

export const COACH_NAV: PortalNavEntry[] = [...PLAYER_NAV, ...COACH_ADDITIONS];

export const COMMUNITY_NAV: PortalNavEntry[] = [
  { id: 'community-feed', label: 'Social Feed', icon: MessageSquare },
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'industry-wire', label: 'Info', icon: Newspaper },
  { id: 'chat', label: 'Chat / Messages', icon: MessageSquare },
  { id: 'bookings', label: 'Bookings', icon: CalendarCheck },
  { id: 'sweat-rail', label: 'Sweat Rail', icon: Flame },
];

export const PORTAL_CONFIGS: Record<string, PortalConfig> = {
  player: {
    id: 'player',
    title: 'Player Portal',
    subtitle: 'Your game. Your study. your vault.',
    navigation: PLAYER_NAV,
  },
  community: {
    id: 'community',
    title: 'Community',
    subtitle: 'Connect. Learn. Book time.',
    navigation: COMMUNITY_NAV,
  },
};

import type { SpotVaultAccount } from '@/types';
import { hasSolverAccess, hasAnalyticsAccess } from '@/types';

const PLAYER_BASED_PORTALS = new Set(['coach', 'creator', 'stable', 'business', 'media']);

const PORTAL_ADDITIONS: Record<string, PortalNavEntry[]> = {
  coach: COACH_ADDITIONS,
  creator: CREATOR_ADDITIONS,
  stable: STABLE_ADDITIONS,
  business: BUSINESS_ADDITIONS,
  media: MEDIA_ADDITIONS,
};

const STANDALONE_NAV: Record<string, PortalNavEntry[]> = {
  player: PLAYER_NAV,
  investor: INVESTOR_NAV,
  affiliate: AFFILIATE_NAV,
  staff: STAFF_NAV,
  community: COMMUNITY_NAV,
};

export function buildNavForPortal(portalId: string, account: SpotVaultAccount | null): PortalNavEntry[] {
  if (PLAYER_BASED_PORTALS.has(portalId)) {
    const additions = PORTAL_ADDITIONS[portalId] ?? [];
    const roleSection = additions[0]?.section ?? 'Player';

    // Split PLAYER_NAV: Home first, then role-specific additions, then the rest
    const playerHome = PLAYER_NAV.filter((e) => e.id === 'home');
    const playerTools = PLAYER_NAV.filter((e) => e.section === 'Tools');
    const playerStore = PLAYER_NAV.filter((e) => e.section === 'Market');
    const playerOther = PLAYER_NAV.filter((e) => e.id !== 'home' && e.section !== 'Tools' && e.section !== 'Market');

    let tools = [...playerTools];
    const solverEnabled = account ? hasSolverAccess(account) : true;
    const analyticsEnabled = account ? hasAnalyticsAccess(account) : true;
    if (!solverEnabled) tools = tools.filter((e) => e.id !== 'solver');
    if (!analyticsEnabled) tools = tools.filter((e) => e.id !== 'analytics');

    // Order: Home → Role-specific section → Tools → Store → Legal
    return [
      ...playerHome,
      ...additions,
      ...tools,
      ...playerStore,
      ...playerOther,
    ];
  }
  return STANDALONE_NAV[portalId] ?? PLAYER_NAV;
}
