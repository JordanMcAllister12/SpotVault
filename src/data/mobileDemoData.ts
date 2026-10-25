import type { SweatCategory } from '@/lib/sweatStore';

export interface DemoProfile {
  id: string;
  name: string;
  handle: string;
  verified: boolean;
  roles: string[];
  badges: string[];
  accomplishments: string[];
  majorScore?: string;
  spotvaultLevel: number;
  bio: string;
  affiliations: string[];
  featured: boolean;
  hasOffers: boolean;
  recentActivity?: string;
}

export const DEMO_PROFILES: Record<string, DemoProfile> = {};

export interface DemoSweat {
  authorName: string;
  authorId: string;
  site: string;
  tournament: string;
  table: string;
  position: string;
  stack: string;
  bigBlinds?: string;
  prizeFirst?: string;
  watchers?: number;
  day?: string;
  comment: string;
  category: SweatCategory;
}

export const DEMO_SWEATS: DemoSweat[] = [];

export interface DemoSweatCompleted {
  authorName: string;
  tournament: string;
  position: string;
  prize: string;
  date: string;
}

export const DEMO_COMPLETED_SWEATS: DemoSweatCompleted[] = [];

export interface DemoWirePost {
  id: string;
  source_name: string;
  source_handle: string | null;
  source_verified: boolean;
  content_type: string;
  title: string;
  body: string | null;
  cta_label: string | null;
  is_promoted: boolean;
  is_demo: boolean;
  metadata?: Record<string, unknown> | null;
}

export const DEMO_WIRE_POSTS: DemoWirePost[] = [];

export interface DemoMarketplaceProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  seller: string;
  rating: number;
  reviews: number;
  badge?: string;
  is_demo: boolean;
  description: string;
  features: string[];
  image: string;
}

export const DEMO_MARKETPLACE_PRODUCTS: DemoMarketplaceProduct[] = [];

export const DEMO_MARKETPLACE_CATEGORIES = [
  'All', 'Poker Tables', 'Chip Sets', 'Playing Cards', 'Accessories',
  'Electronics', 'Poker Room Furniture', 'Apparel', 'Training / Books', 'Collectibles',
];

export interface DemoAnalyticsData {
  headlineMetrics: Array<{ label: string; value: string; sub?: string }>;
  graphSeries: Array<{ index: number; profit: number; showdown: number; non_showdown: number }>;
  positionPerformance: Array<{ position: string; bb100: number; hands: number }>;
  tournamentStats: {
    games: number;
    abi: string;
    roi: string;
    itm: string;
    finalTables: number;
    wins: number;
    biggestScore: string;
  };
  stagePerformance: Array<{ stage: string; bb100: number; color: string }>;
  recentSessions: Array<{ date: string; stakes: string; hands: number; profit: string; bb100: string }>;
  leakCards: Array<{ title: string; value: string; type: 'strength' | 'leak' | 'insight' }>;
  spi: number;
}

export const DEMO_ANALYTICS: DemoAnalyticsData = {
  headlineMetrics: [],
  graphSeries: [],
  positionPerformance: [],
  tournamentStats: {
    games: 0,
    abi: '$0',
    roi: '0%',
    itm: '0%',
    finalTables: 0,
    wins: 0,
    biggestScore: '$0',
  },
  stagePerformance: [],
  recentSessions: [],
  leakCards: [],
  spi: 0,
};

export function getDemoProfileByName(name: string): DemoProfile | null {
  const normalized = name.toLowerCase().trim();
  for (const profile of Object.values(DEMO_PROFILES)) {
    if (profile.name.toLowerCase() === normalized) return profile;
  }
  return null;
}

export function getDemoProfileById(id: string): DemoProfile | null {
  return DEMO_PROFILES[id] ?? null;
}
