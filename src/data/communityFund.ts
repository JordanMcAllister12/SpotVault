// ===== SPOTVAULT COMMUNITY FUND — DATA MODEL =====
// SpotVault periodically reinvests in the poker community.
// Funding amounts are admin-controlled, NOT a percentage of profits.

import {
  Trophy, GraduationCap, HeartPulse, Building2, Briefcase, Camera,
  type LucideIcon,
} from 'lucide-react';

export type FundCategory =
  | 'PLAYER_DROPS'
  | 'POKER_EDUCATION'
  | 'PLAYER_WELLNESS'
  | 'COMMUNITY_PROJECTS'
  | 'CAREER_TRANSITIONS'
  | 'CREATOR_INDUSTRY_INITIATIVES';

export type FundStatus = 'upcoming' | 'active' | 'completed';

export interface FundInitiative {
  id: string;
  title: string;
  description: string;
  category: FundCategory;
  amount: number;          // USD
  amountDistributed: number;
  playersSupported: number;
  partner?: string;
  status: FundStatus;
  startDate?: string;
  endDate?: string;
  eligibility?: string;
  image?: string;
  externalLink?: string;
  isFeatured?: boolean;
}

export interface FundCategoryConfig {
  id: FundCategory;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}

export const FUND_CATEGORIES: FundCategoryConfig[] = [
  {
    id: 'PLAYER_DROPS',
    label: 'Player Drops',
    shortLabel: 'Drops',
    description: 'Freerolls, tournament seats, promotions and player opportunities.',
    icon: Trophy,
    accent: '#d4a52c',
  },
  {
    id: 'POKER_EDUCATION',
    label: 'Poker Education',
    shortLabel: 'Education',
    description: 'Training, scholarships, coaching initiatives and educational opportunities.',
    icon: GraduationCap,
    accent: '#60a5fa',
  },
  {
    id: 'PLAYER_WELLNESS',
    label: 'Player Wellness',
    shortLabel: 'Wellness',
    description: 'Therapy assistance, mental-performance resources and responsible gambling support.',
    icon: HeartPulse,
    accent: '#4ade80',
  },
  {
    id: 'COMMUNITY_PROJECTS',
    label: 'Community Projects',
    shortLabel: 'Projects',
    description: 'Projects or initiatives that improve the poker ecosystem.',
    icon: Building2,
    accent: '#a78bfa',
  },
  {
    id: 'CAREER_TRANSITIONS',
    label: 'Career Transitions',
    shortLabel: 'Careers',
    description: 'Education or career-development assistance for players transitioning away from professional poker.',
    icon: Briefcase,
    accent: '#f59e0b',
  },
  {
    id: 'CREATOR_INDUSTRY_INITIATIVES',
    label: 'Creator / Industry Initiatives',
    shortLabel: 'Industry',
    description: 'Projects that contribute useful content, technology, media or infrastructure to poker.',
    icon: Camera,
    accent: '#ec4899',
  },
];

// ===== DEMO INITIATIVES =====

export const FEATURED_INITIATIVE: FundInitiative = {
  id: 'featured-freeroll-2026',
  title: '$100,000 Community Freeroll',
  description:
    'A flagship community freeroll open to 1,000 SpotVault players. Buy-in-free entry, real prize pool, hosted in partnership with a partner poker site. Eligibility based on active SpotVault membership.',
  category: 'PLAYER_DROPS',
  amount: 100000,
  amountDistributed: 0,
  playersSupported: 1000,
  partner: 'Partner Poker Site',
  status: 'upcoming',
  startDate: '2026-09-15',
  endDate: '2026-09-30',
  eligibility: 'Active SpotVault members with verified account standing.',
  externalLink: '#',
  isFeatured: true,
};

export const PAST_INITIATIVES: FundInitiative[] = [
  {
    id: 'past-001',
    title: 'Player Freeroll',
    description: 'Monthly community freeroll with prize pool funded by SpotVault.',
    category: 'PLAYER_DROPS',
    amount: 25000,
    amountDistributed: 25000,
    playersSupported: 500,
    status: 'completed',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  },
  {
    id: 'past-002',
    title: 'Wellness Assistance',
    description: 'Therapy sessions and mental-performance coaching for qualifying players.',
    category: 'PLAYER_WELLNESS',
    amount: 10000,
    amountDistributed: 10000,
    playersSupported: 20,
    status: 'completed',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
  },
  {
    id: 'past-003',
    title: 'Education Grants',
    description: 'Tuition assistance for poker study courses and coaching programs.',
    category: 'POKER_EDUCATION',
    amount: 15000,
    amountDistributed: 15000,
    playersSupported: 35,
    status: 'completed',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
  },
  {
    id: 'past-004',
    title: 'Community Project',
    description: 'Funded an open-source poker hand-history analysis tool.',
    category: 'COMMUNITY_PROJECTS',
    amount: 5000,
    amountDistributed: 5000,
    playersSupported: 0,
    status: 'completed',
    startDate: '2026-03-01',
    endDate: '2026-03-31',
  },
];

export const ALL_INITIATIVES: FundInitiative[] = [FEATURED_INITIATIVE, ...PAST_INITIATIVES];

// ===== TRANSPARENCY STATS =====

export const FUND_STATS = {
  totalReturnedToPoker: 55000,   // sum of past initiatives
  totalInitiatives: PAST_INITIATIVES.length,
  playersSupported: 555,         // 500 + 20 + 35
  currentInitiatives: 1,         // the featured freeroll
};

export const COMMUNITY_FUND_FEED_EVENTS = [
  {
    id: 'feed-001',
    body: 'SpotVault Community Fund has added $25,000 to this month\'s player freeroll.',
    timestamp: '2h ago',
    category: 'PLAYER_DROPS' as FundCategory,
  },
  {
    id: 'feed-002',
    body: 'Community Fund supported 20 player wellness sessions this month.',
    timestamp: '1d ago',
    category: 'PLAYER_WELLNESS' as FundCategory,
  },
  {
    id: 'feed-003',
    body: 'Applications are open for the next SpotVault education grant.',
    timestamp: '3d ago',
    category: 'POKER_EDUCATION' as FundCategory,
  },
];
