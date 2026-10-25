import type { LucideIcon } from 'lucide-react';
import {
  MessageSquare,
  Users,
  Calendar,
  Trophy,
  Radio,
  Newspaper,
  Star,
  Megaphone,
  TrendingUp,
  LayoutGrid,
} from 'lucide-react';

// ── Module Types ──────────────────────────────────────────────────

export type LoungeModuleType =
  | 'socialFeed'
  | 'groupChat'
  | 'directMessages'
  | 'liveTournaments'
  | 'cashGames'
  | 'events'
  | 'leaderboard'
  | 'announcements'
  | 'featuredContent'
  | 'promotions'
  | 'customData';

export type ModulePosition = 'left' | 'center' | 'right' | 'bottom-right';

export interface LoungeModuleConfig {
  id: string;
  type: LoungeModuleType;
  position: ModulePosition;
  priority: number;
  settings?: Record<string, unknown>;
}

export type LoungeType =
  | 'default'
  | 'stakes'
  | 'game-type'
  | 'geographic'
  | 'partner'
  | 'branded'
  | 'stable'
  | 'creator'
  | 'business';

export interface LoungeConfig {
  id?: string;
  slug: string;
  name: string;
  type: LoungeType;
  description?: string;
  logo?: string;
  defaultBackground?: string;
  defaultBackgroundFit?: 'cover' | 'contain';
  defaultBackgroundPosition?: 'center' | 'top' | 'bottom';
  defaultOverlay?: 'light' | 'medium' | 'dark' | 'none';
  theme?: string;
  modules: LoungeModuleConfig[];
  feedSettings?: {
    placeholder?: string;
    showComposer?: boolean;
  };
  chatSettings?: {
    groupChannels?: string[];
    enableDirect?: boolean;
  };
  eventSettings?: {
    title?: string;
    region?: string;
  };
  permissions?: {
    postingAllowed?: boolean;
    visibility?: 'public' | 'members';
  };
  allowUserBackgroundCustomization?: boolean;
  ownerAccent?: string | null;
  ownerLogo?: string | null;
  ownerCover?: string | null;
  memberPersonalization?: boolean;
}

// ── Module Registry ─────────────────────────────────────────────

export interface ModuleMeta {
  type: LoungeModuleType;
  label: string;
  icon: LucideIcon;
  description: string;
  defaultPosition: ModulePosition;
}

export const MODULE_REGISTRY: Record<LoungeModuleType, ModuleMeta> = {
  socialFeed: {
    type: 'socialFeed',
    label: 'Social Feed',
    icon: MessageSquare,
    description: 'Facebook-familiar community feed with posts, reactions, and comments.',
    defaultPosition: 'center',
  },
  groupChat: {
    type: 'groupChat',
    label: 'Group Chat',
    icon: Users,
    description: 'Community group chat with channels.',
    defaultPosition: 'right',
  },
  directMessages: {
    type: 'directMessages',
    label: 'Direct Messages',
    icon: MessageSquare,
    description: 'One-on-one private messaging.',
    defaultPosition: 'right',
  },
  liveTournaments: {
    type: 'liveTournaments',
    label: 'Live Tournaments',
    icon: Trophy,
    description: 'Active tournament data with live updates.',
    defaultPosition: 'left',
  },
  cashGames: {
    type: 'cashGames',
    label: 'Live Cash Games',
    icon: Radio,
    description: 'Active cash game data with table counts.',
    defaultPosition: 'left',
  },
  events: {
    type: 'events',
    label: 'Events',
    icon: Calendar,
    description: 'Upcoming events carousel.',
    defaultPosition: 'right',
  },
  leaderboard: {
    type: 'leaderboard',
    label: 'Leaderboard',
    icon: TrendingUp,
    description: 'Community rankings and stats.',
    defaultPosition: 'left',
  },
  announcements: {
    type: 'announcements',
    label: 'Announcements',
    icon: Megaphone,
    description: 'Community announcements and pinned posts.',
    defaultPosition: 'left',
  },
  featuredContent: {
    type: 'featuredContent',
    label: 'Featured Content',
    icon: Star,
    description: 'Highlighted content from the community.',
    defaultPosition: 'right',
  },
  promotions: {
    type: 'promotions',
    label: 'Promotions',
    icon: Newspaper,
    description: 'Active promotions and offers.',
    defaultPosition: 'left',
  },
  customData: {
    type: 'customData',
    label: 'Custom Data',
    icon: LayoutGrid,
    description: 'Custom partner data module.',
    defaultPosition: 'left',
  },
};

// ── Background Preferences ──────────────────────────────────────

export type BackgroundType = 'default' | 'spotvault-preset' | 'custom';
export type BackgroundFit = 'cover' | 'contain';
export type BackgroundPosition = 'center' | 'top' | 'bottom';
export type OverlayIntensity = 'light' | 'medium' | 'dark' | 'none';

export interface BackgroundPreference {
  backgroundType: BackgroundType;
  backgroundValue: string | null;
  fit: BackgroundFit;
  position: BackgroundPosition;
  overlay: OverlayIntensity;
}

export const DEFAULT_BG_PREFERENCE: BackgroundPreference = {
  backgroundType: 'default',
  backgroundValue: null,
  fit: 'cover',
  position: 'center',
  overlay: 'medium',
};

export const OVERLAY_OPACITY: Record<OverlayIntensity, number> = {
  none: 0,
  light: 0.3,
  medium: 0.55,
  dark: 0.75,
};

// ── SpotVault Background Presets ─────────────────────────────────

export interface BgPreset {
  id: string;
  label: string;
  url: string;
}

export const SPOTVAULT_BG_PRESETS: BgPreset[] = [
  { id: 'sv-vancouver', label: 'Vancouver Sunset', url: '/assets/lounge/image copy 5.webp' },
  { id: 'sv-felt', label: 'Poker Felt', url: '/player-portal-high-roller-lounge.webp' },
  { id: 'sv-tower', label: 'Glass Tower', url: '/glass-tower-toronto.webp' },
  { id: 'sv-dark', label: 'Midnight', url: '' },
];

// ── Feed Post Type ───────────────────────────────────────────────

export interface LoungePost {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_role: string | null;
  body: string | null;
  attachment_type: string | null;
  attachment_url: string | null;
  attachment_label: string | null;
  reply_to: string | null;
  created_at: string;
  lounge_id?: string;
}

// ── Tournament Types (reusable) ──────────────────────────────────

export interface TournamentEvent {
  id: string;
  venue: string;
  operator?: string;
  name: string;
  startTime: string;
  buyIn: number;
  prizePoolContribution: number;
  fee: number;
  feePercent: number;
  startingStack: number;
  blindLevelMinutes: number;
  lateRegistration: string;
  reEntry: boolean;
  reEntryLimit: number | null;
  rebuy: boolean;
  addOn: boolean;
  guarantee: number | null;
  live?: {
    level: number;
    smallBlind: number;
    bigBlind: number;
    ante: number;
    entries: number;
    remaining: number;
    reentries: number;
    rebuys: number;
    totalChips: number;
    avgStack: number;
    lateRegRemaining: string;
    nextBreakIn: string;
    elapsed: string;
    lastUpdated: string;
    prizePool?: number;
    chipCounts?: { rank: number; playerName: string; stack: number; reportedAgo: string }[];
  };
}

export interface CashGameSession {
  id: string;
  venue: string;
  game: string;
  tables: number;
  players: number;
  waiting: number;
  openSeats?: number;
  status?: 'RUNNING' | 'STARTING' | 'INTEREST';
  startsAt?: string;
  lastUpdated: string;
}

// ── Helpers ──────────────────────────────────────────────────────

export function calculateBestPlayerValue(tournaments: TournamentEvent[]): TournamentEvent | null {
  if (!tournaments.length) return null;
  let best = tournaments[0];
  let bestRatio = best.fee / (best.prizePoolContribution + best.fee);
  for (let i = 1; i < tournaments.length; i++) {
    const ratio = tournaments[i].fee / (tournaments[i].prizePoolContribution + tournaments[i].fee);
    if (ratio < bestRatio) {
      best = tournaments[i];
      bestRatio = ratio;
    }
  }
  return best;
}

export function getBestValueExplanation(t: TournamentEvent): string {
  const total = t.prizePoolContribution + t.fee;
  const effectiveFeePct = ((t.fee / total) * 100).toFixed(1);
  return `Buy-in: $${t.buyIn} · Prize pool: $${t.prizePoolContribution} · Fee: $${t.fee} · Effective fee: ${effectiveFeePct}% — the lowest fee-to-prize-pool ratio among tonight's tournaments.`;
}

export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function modulesByPosition(
  modules: LoungeModuleConfig[],
  position: ModulePosition,
): LoungeModuleConfig[] {
  return modules
    .filter((m) => m.position === position)
    .sort((a, b) => a.priority - b.priority);
}

// ── Default Lounge Configs ───────────────────────────────────────

export function createDefaultLoungeConfig(slug: string, name: string, type: LoungeType): LoungeConfig {
  return {
    slug,
    name,
    type,
    modules: [
      { id: 'center-feed', type: 'socialFeed', position: 'center', priority: 1 },
      { id: 'right-chat', type: 'groupChat', position: 'right', priority: 1 },
    ],
    feedSettings: { placeholder: "What's happening?", showComposer: true },
    chatSettings: { groupChannels: ['general'], enableDirect: true },
    allowUserBackgroundCustomization: true,
  };
}

export const SPOTVAULT_DEFAULT_LOUNGE: LoungeConfig = {
  slug: 'spotvault',
  name: 'SpotVault Lounge',
  type: 'default',
  defaultBackground: '/assets/lounge/image.webp',
  defaultBackgroundFit: 'cover',
  defaultBackgroundPosition: 'center',
  defaultOverlay: 'medium',
  modules: [
    { id: 'center-feed', type: 'socialFeed', position: 'center', priority: 1 },
    { id: 'right-chat', type: 'groupChat', position: 'right', priority: 1 },
  ],
  feedSettings: { placeholder: "What's happening in poker?", showComposer: true },
  chatSettings: { groupChannels: ['general'], enableDirect: true },
  allowUserBackgroundCustomization: true,
};
