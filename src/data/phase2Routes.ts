import type { LucideIcon } from 'lucide-react';
import {
  MessageSquare, Bell, User, Wallet, Network, Users, Trophy, Gamepad2,
  BarChart3, BookOpen, LayoutDashboard, Store, GraduationCap, Calendar,
  Video, DollarSign, Star, Briefcase, Building2, Mic, Camera, TrendingUp,
  Handshake, Newspaper, FileText, Settings, ShieldCheck, Layers, Search,
  HeartPulse, Heart, Calculator,
} from 'lucide-react';

export interface Phase2Route {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  keywords: string[];
  action: string;
}

export interface Phase2RouteGroup {
  id: string;
  label: string;
  routes: Phase2Route[];
}

export const PHASE2_ROUTE_GROUPS: Phase2RouteGroup[] = [
  {
    id: 'core',
    label: 'Core',
    routes: [
      { id: 'community', label: 'Community Hub', icon: Users, group: 'core', keywords: ['community', 'hub', 'feed', 'posts'], action: 'innercircle' },
      { id: 'gives', label: 'SpotVault Gives', icon: Heart, group: 'core', keywords: ['gives', 'impact', 'contribute', 'wellness', 'education', 'community', 'support', 'charity', 'donate'], action: 'innercircle' },
      { id: 'community-fund', label: 'Community Fund', icon: Trophy, group: 'core', keywords: ['community', 'fund', 'reinvest', 'freeroll', 'wellness', 'education', 'ecosystem', 'poker'], action: 'community-fund' },
      { id: 'network', label: 'Network', icon: Network, group: 'core', keywords: ['network', 'directory', 'map'], action: 'network' },
      { id: 'chat', label: 'Chat', icon: MessageSquare, group: 'core', keywords: ['chat', 'messages', 'dm'], action: 'chat' },
      { id: 'notifications', label: 'Notifications', icon: Bell, group: 'core', keywords: ['notifications', 'alerts'], action: 'notifications' },
      { id: 'profile', label: 'Profile', icon: User, group: 'core', keywords: ['profile', 'account', 'me'], action: 'profile' },
      { id: 'credits', label: 'Credits / Wallet', icon: Wallet, group: 'core', keywords: ['credits', 'wallet', 'balance', 'payment'], action: 'credits' },
      { id: 'solver', label: 'Solver', icon: Calculator, group: 'core', keywords: ['solver', 'gto', 'poker', 'strategy', 'spot', 'solve', 'range', 'ev', 'equity'], action: 'solver' },
    ],
  },
  {
    id: 'portals',
    label: 'Portals',
    routes: [
      { id: 'portal-player', label: 'Player Portal', icon: Gamepad2, group: 'portals', keywords: ['player', 'portal'], action: 'portal:PLAYER' },
      { id: 'portal-business', label: 'Business Portal', icon: Building2, group: 'portals', keywords: ['business', 'portal', 'investor', 'affiliate', 'partner'], action: 'portal:BUSINESS' },
      { id: 'portal-creator', label: 'Creator / Talent Portal', icon: Camera, group: 'portals', keywords: ['creator', 'portal', 'media', 'talent'], action: 'portal:CREATOR' },
      { id: 'portal-coach', label: 'Coach Portal', icon: GraduationCap, group: 'portals', keywords: ['coach', 'portal'], action: 'portal:COACH' },
      { id: 'portal-stable', label: 'Stable Portal', icon: Users, group: 'portals', keywords: ['stable', 'portal'], action: 'portal:STABLE' },
      { id: 'portal-jobs', label: 'Jobs / Industry Portal', icon: Briefcase, group: 'portals', keywords: ['jobs', 'industry', 'portal'], action: 'portal:JOBS' },
    ],
  },
  {
    id: 'player',
    label: 'Player',
    routes: [
      { id: 'player-home', label: 'Player Home', icon: LayoutDashboard, group: 'player', keywords: ['player', 'home', 'dashboard'], action: 'player:home' },
      { id: 'player-locker', label: 'My Spots', icon: Layers, group: 'player', keywords: ['my', 'spots', 'items'], action: 'player:locker' },
      { id: 'player-analytics', label: 'Analytics', icon: BarChart3, group: 'player', keywords: ['analytics', 'stats', 'player'], action: 'player:analytics' },
      { id: 'player-vault', label: 'My Vault', icon: ShieldCheck, group: 'player', keywords: ['vault', 'my', 'player'], action: 'player:vault' },
      { id: 'player-study', label: 'Study Room', icon: BookOpen, group: 'player', keywords: ['study', 'room', 'learn'], action: 'player:study' },
      { id: 'player-board', label: 'Player Board', icon: Users, group: 'player', keywords: ['board', 'player', 'leaderboard'], action: 'player:board' },
      { id: 'player-store', label: 'Store', icon: Store, group: 'player', keywords: ['store', 'shop', 'buy'], action: 'player:store' },
    ],
  },
  {
    id: 'coach',
    label: 'Coach',
    routes: [
      { id: 'coach-home', label: 'Coach Home', icon: LayoutDashboard, group: 'coach', keywords: ['coach', 'home', 'dashboard'], action: 'coach:home' },
      { id: 'coach-students', label: 'Students', icon: Users, group: 'coach', keywords: ['students', 'coach', 'mentees'], action: 'coach:students' },
      { id: 'coach-bookings', label: 'Bookings', icon: Calendar, group: 'coach', keywords: ['bookings', 'coach', 'schedule'], action: 'coach:bookings' },
      { id: 'coach-calendar', label: 'Calendar', icon: Calendar, group: 'coach', keywords: ['calendar', 'coach', 'schedule'], action: 'coach:calendar' },
      { id: 'coach-messages', label: 'Messages', icon: MessageSquare, group: 'coach', keywords: ['messages', 'coach', 'chat'], action: 'coach:messages' },
      { id: 'coach-analytics', label: 'Analytics', icon: BarChart3, group: 'coach', keywords: ['analytics', 'coach', 'stats'], action: 'coach:analytics' },
      { id: 'coach-content', label: 'Content', icon: FileText, group: 'coach', keywords: ['content', 'coach', 'courses'], action: 'coach:content' },
      { id: 'coach-earnings', label: 'Earnings', icon: DollarSign, group: 'coach', keywords: ['earnings', 'coach', 'revenue'], action: 'coach:earnings' },
    ],
  },
  {
    id: 'pro-talent',
    label: 'Pro / Talent',
    routes: [
      { id: 'talent-home', label: 'Talent Home', icon: LayoutDashboard, group: 'pro-talent', keywords: ['talent', 'home', 'dashboard'], action: 'talent:home' },
      { id: 'book-a-pro', label: 'Book a Pro', icon: Trophy, group: 'pro-talent', keywords: ['book', 'pro', 'marketplace'], action: 'talent:marketplace' },
      { id: 'talent-profiles', label: 'Talent Profiles', icon: User, group: 'pro-talent', keywords: ['profiles', 'talent', 'pro'], action: 'talent:profiles' },
      { id: 'talent-services', label: 'Services', icon: DollarSign, group: 'pro-talent', keywords: ['services', 'talent', 'offerings'], action: 'talent:services' },
      { id: 'talent-bookings', label: 'Bookings', icon: Calendar, group: 'pro-talent', keywords: ['bookings', 'talent', 'schedule'], action: 'talent:bookings' },
      { id: 'talent-calendar', label: 'Calendar', icon: Calendar, group: 'pro-talent', keywords: ['calendar', 'talent', 'availability'], action: 'talent:calendar' },
      { id: 'talent-session', label: 'Session Room', icon: Video, group: 'pro-talent', keywords: ['session', 'room', 'private'], action: 'talent:session' },
      { id: 'talent-video', label: 'Video Session', icon: Video, group: 'pro-talent', keywords: ['video', 'session', 'call'], action: 'talent:video' },
      { id: 'talent-messages', label: 'Messages', icon: MessageSquare, group: 'pro-talent', keywords: ['messages', 'talent', 'chat'], action: 'talent:messages' },
      { id: 'talent-earnings', label: 'Earnings', icon: DollarSign, group: 'pro-talent', keywords: ['earnings', 'talent', 'revenue'], action: 'talent:earnings' },
    ],
  },
  {
    id: 'stable',
    label: 'Stable',
    routes: [
      { id: 'stable-home', label: 'Stable Home', icon: LayoutDashboard, group: 'stable', keywords: ['stable', 'home', 'dashboard'], action: 'stable:home' },
      { id: 'stable-players', label: 'Players', icon: Users, group: 'stable', keywords: ['players', 'stable', 'team'], action: 'stable:players' },
      { id: 'stable-applicants', label: 'Applicants', icon: User, group: 'stable', keywords: ['applicants', 'stable', 'applications'], action: 'stable:applicants' },
      { id: 'stable-analytics', label: 'Analytics', icon: BarChart3, group: 'stable', keywords: ['analytics', 'stable', 'stats'], action: 'stable:analytics' },
      { id: 'stable-messages', label: 'Messages', icon: MessageSquare, group: 'stable', keywords: ['messages', 'stable', 'chat'], action: 'stable:messages' },
      { id: 'stable-management', label: 'Management', icon: Settings, group: 'stable', keywords: ['management', 'stable', 'admin'], action: 'stable:management' },
    ],
  },
  {
    id: 'media',
    label: 'Media',
    routes: [
      { id: 'media-home', label: 'Media Home', icon: LayoutDashboard, group: 'media', keywords: ['media', 'home', 'dashboard'], action: 'media:home' },
      { id: 'media-directory', label: 'Directory', icon: Users, group: 'media', keywords: ['directory', 'media', 'contacts'], action: 'media:directory' },
      { id: 'media-stories', label: 'Stories', icon: Newspaper, group: 'media', keywords: ['stories', 'media', 'news'], action: 'media:stories' },
      { id: 'media-publishing', label: 'Publishing', icon: FileText, group: 'media', keywords: ['publishing', 'media', 'publish'], action: 'media:publishing' },
      { id: 'media-messages', label: 'Messages', icon: MessageSquare, group: 'media', keywords: ['messages', 'media', 'chat'], action: 'media:messages' },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    routes: [
      { id: 'business-home', label: 'Business Home', icon: LayoutDashboard, group: 'business', keywords: ['business', 'home', 'dashboard'], action: 'business:home' },
      { id: 'business-directory', label: 'Directory', icon: Building2, group: 'business', keywords: ['directory', 'business', 'companies'], action: 'business:directory' },
      { id: 'business-opportunities', label: 'Opportunities', icon: TrendingUp, group: 'business', keywords: ['opportunities', 'business', 'deals'], action: 'business:opportunities' },
      { id: 'business-messages', label: 'Messages', icon: MessageSquare, group: 'business', keywords: ['messages', 'business', 'chat'], action: 'business:messages' },
    ],
  },
  {
    id: 'industry',
    label: 'Industry',
    routes: [
      { id: 'industry-jobs', label: 'Jobs', icon: Briefcase, group: 'industry', keywords: ['jobs', 'industry', 'careers'], action: 'industry:jobs' },
      { id: 'industry-listings', label: 'Job Listings', icon: FileText, group: 'industry', keywords: ['listings', 'jobs', 'industry'], action: 'industry:listings' },
      { id: 'industry-applications', label: 'Applications', icon: User, group: 'industry', keywords: ['applications', 'jobs', 'apply'], action: 'industry:applications' },
      { id: 'industry-companies', label: 'Companies', icon: Building2, group: 'industry', keywords: ['companies', 'industry', 'organizations'], action: 'industry:companies' },
      { id: 'industry-directory', label: 'Industry Directory', icon: Users, group: 'industry', keywords: ['directory', 'industry', 'contacts'], action: 'industry:directory' },
    ],
  },
  {
    id: 'system',
    label: 'System / Demo',
    routes: [
      { id: 'sys-portal-selector', label: 'Portal Selector', icon: LayoutDashboard, group: 'system', keywords: ['portal', 'selector', 'access'], action: 'system:portal-selector' },
      { id: 'sys-community', label: 'Community Layer', icon: Users, group: 'system', keywords: ['community', 'layer', 'feed'], action: 'system:community' },
      { id: 'sys-credits', label: 'Credits', icon: Wallet, group: 'system', keywords: ['credits', 'wallet', 'balance'], action: 'system:credits' },
      { id: 'sys-transactions', label: 'Transactions', icon: DollarSign, group: 'system', keywords: ['transactions', 'ledger', 'payments'], action: 'system:transactions' },
      { id: 'sys-notifications', label: 'Notifications', icon: Bell, group: 'system', keywords: ['notifications', 'alerts'], action: 'system:notifications' },
      { id: 'sys-chat', label: 'Chat', icon: MessageSquare, group: 'system', keywords: ['chat', 'messages'], action: 'system:chat' },
      { id: 'sys-dms', label: 'DMs', icon: MessageSquare, group: 'system', keywords: ['dms', 'direct', 'messages'], action: 'system:dms' },
      { id: 'sys-booking', label: 'Booking System', icon: Calendar, group: 'system', keywords: ['booking', 'system', 'schedule'], action: 'system:booking' },
      { id: 'sys-video-demo', label: 'Video Session Demo', icon: Video, group: 'system', keywords: ['video', 'session', 'demo'], action: 'system:video-demo' },
      { id: 'sys-admin', label: 'Admin', icon: ShieldCheck, group: 'system', keywords: ['admin', 'superuser', 'controls'], action: 'system:admin' },
      { id: 'sys-access-manager', label: 'Portal Access Manager', icon: Settings, group: 'system', keywords: ['access', 'manager', 'portal'], action: 'system:access-manager' },
    ],
  },
  {
    id: 'help',
    label: 'Help Hub',
    routes: [
      { id: 'help-home', label: 'Help Hub Home', icon: HeartPulse, group: 'help', keywords: ['help', 'wellness', 'performance', 'mental', 'responsible', 'gambling'], action: 'help:home' },
      { id: 'help-performance', label: 'Performance', icon: HeartPulse, group: 'help', keywords: ['performance', 'focus', 'tilt', 'routines', 'recovery'], action: 'help:performance' },
      { id: 'help-wellness', label: 'Mental Wellness', icon: HeartPulse, group: 'help', keywords: ['wellness', 'mental', 'stress', 'anxiety', 'burnout', 'balance'], action: 'help:wellness' },
      { id: 'help-responsible', label: 'Responsible Gambling', icon: ShieldCheck, group: 'help', keywords: ['responsible', 'gambling', 'limits', 'self-exclusion', 'safety'], action: 'help:responsible' },
      { id: 'help-get-help', label: 'Get Help', icon: HeartPulse, group: 'help', keywords: ['get', 'help', 'crisis', 'support', 'resources'], action: 'help:get-help' },
      { id: 'help-library', label: 'Help Library', icon: BookOpen, group: 'help', keywords: ['library', 'content', 'video', 'audio', 'course', 'article'], action: 'help:library' },
      { id: 'help-professionals', label: 'Coaches & Professionals', icon: HeartPulse, group: 'help', keywords: ['coaches', 'professionals', 'therapists', 'counsellors', 'licensed'], action: 'help:professionals' },
    ],
  },
];

export const ALL_PHASE2_ROUTES: Phase2Route[] = PHASE2_ROUTE_GROUPS.flatMap((g) => g.routes);

export function searchRoutes(query: string): Phase2Route[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return ALL_PHASE2_ROUTES.filter((r) =>
    r.label.toLowerCase().includes(q) ||
    r.group.toLowerCase().includes(q) ||
    r.keywords.some((k) => k.includes(q))
  );
}
