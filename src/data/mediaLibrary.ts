export type MediaContentType = 'organic' | 'owned' | 'featured' | 'live' | 'sponsored';

export type MediaCategory =
  | 'Poker Show' | 'Creator Video' | 'Tournament Coverage' | 'Interview'
  | 'Podcast' | 'Educational' | 'HH Preview' | 'Live Stream'
  | 'Announcement' | 'Marketplace' | 'Sponsored';

export interface MediaItem {
  id: string;
  title: string;
  creator: string;
  category: MediaCategory;
  contentType: MediaContentType;
  duration: number | null;
  description: string;
  accent: string;
  badge?: string;
}

export const MEDIA_CONTENT_TYPE_LABEL: Record<MediaContentType, string> = {
  organic: 'Organic',
  owned: 'Owned',
  featured: 'Featured',
  live: 'Live',
  sponsored: 'Sponsored',
};

export const MEDIA_LIBRARY: MediaItem[] = [
  {
    id: 'feat-hh-bundle',
    title: 'High Stakes HH Bundle — WSOP Main Event',
    creator: 'SpotVault Originals',
    category: 'HH Preview',
    contentType: 'featured',
    duration: 740,
    description: 'A curated bundle of the most instructive hands from the WSOP Main Event final table.',
    accent: '#d4a52c',
    badge: 'Featured',
  },
  {
    id: 'feat-tournament-coverage',
    title: 'Tournament Coverage — Triton Super High Roller',
    creator: 'SpotVault Media',
    category: 'Tournament Coverage',
    contentType: 'featured',
    duration: 1820,
    description: 'Live coverage and breakdown of the Triton Super High Roller final table.',
    accent: '#e0b540',
    badge: 'Featured',
  },
  {
    id: 'feat-creator-spotlight',
    title: 'Creator Spotlight — Inside the Mind of a Pro',
    creator: 'SpotVault Media',
    category: 'Creator Video',
    contentType: 'featured',
    duration: 612,
    description: 'An intimate profile of a top poker creator and their study routine.',
    accent: '#c9a845',
    badge: 'Creator Spotlight',
  },
  {
    id: 'feat-poker-show',
    title: 'The Vault — Poker Strategy Show',
    creator: 'SpotVault Originals',
    category: 'Poker Show',
    contentType: 'organic',
    duration: 2640,
    description: 'A weekly poker strategy show breaking down advanced concepts and hand analysis.',
    accent: '#b89530',
  },
  {
    id: 'feat-podcast',
    title: 'Poker Industry Podcast — Founders & Operators',
    creator: 'SpotVault Media',
    category: 'Podcast',
    contentType: 'organic',
    duration: 3300,
    description: 'Long-form conversations with the founders and operators shaping poker.',
    accent: '#a89028',
  },
  {
    id: 'feat-educational',
    title: 'ICM Masterclass — Module 03',
    creator: 'Raise Your Edge',
    category: 'Educational',
    contentType: 'owned',
    duration: 1480,
    description: 'Deep dive into Independent Chip Model theory with real tournament examples.',
    accent: '#d4a52c',
    badge: 'In My Spots',
  },
  {
    id: 'feat-live-stream',
    title: 'Live Stream — High Roller Cash Game',
    creator: 'SpotVault Live',
    category: 'Live Stream',
    contentType: 'live',
    duration: null,
    description: 'A live high stakes cash game stream with real-time hole cards.',
    accent: '#e0593a',
    badge: 'Live Now',
  },
  {
    id: 'feat-announcement',
    title: 'SpotVault Announces — Network Expansion',
    creator: 'SpotVault',
    category: 'Announcement',
    contentType: 'organic',
    duration: 95,
    description: 'A brief announcement about the SpotVault Network expansion.',
    accent: '#d4a52c',
  },
  {
    id: 'spon-poker-site',
    title: 'Play on the Premier Poker Platform',
    creator: 'Partner Poker Site',
    category: 'Sponsored',
    contentType: 'sponsored',
    duration: 30,
    description: 'A 30-second sponsored placement from a premier poker platform.',
    accent: '#5f8fb3',
    badge: 'Sponsored',
  },
  {
    id: 'spon-product-launch',
    title: 'New Poker Training Tool — Launch',
    creator: 'Partner Brand',
    category: 'Sponsored',
    contentType: 'sponsored',
    duration: 15,
    description: 'A 15-second sponsored product launch placement.',
    accent: '#6b9bb8',
    badge: 'Sponsored',
  },
  {
    id: 'spon-event-promo',
    title: 'Upcoming Tournament Series — Register Now',
    creator: 'Partner Tour',
    category: 'Sponsored',
    contentType: 'sponsored',
    duration: 30,
    description: 'A 30-second sponsored event promotion.',
    accent: '#7aa5c4',
    badge: 'Sponsored',
  },
];

export const IDLE_ROTATION: MediaItem[] = [
  MEDIA_LIBRARY[0],
  MEDIA_LIBRARY[1],
  MEDIA_LIBRARY[2],
  MEDIA_LIBRARY[3],
  MEDIA_LIBRARY[4],
  MEDIA_LIBRARY[6],
];

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'LIVE';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
