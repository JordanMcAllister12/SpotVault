import type { BadgeAccountInfo } from '@/components/community/MembershipBadge';

export type PeopleCategory = 'poker_pro' | 'coach' | 'creator' | 'performance' | 'industry_pro' | 'business';

export type PeopleSpecialty =
  | 'MTT' | 'Cash' | 'ICM' | 'Final Tables' | 'Content Creator'
  | 'Streamer' | 'Mental Game' | 'Performance' | 'Fitness' | 'Nutrition'
  | 'Staking' | 'Sponsorship' | 'Media' | 'Tournament Strategy' | 'PLO'
  | 'Founder' | 'Poker Tech' | 'Product / Industry';

export interface SocialLinks {
  twitter?: string;
  instagram?: string;
  youtube?: string;
  twitch?: string;
  discord?: string;
  website?: string;
}

export interface PokerResumeEntry {
  label: string;
  value: string;
  verified: boolean;
}

export interface PokerResume {
  headline: string;
  yearsExperience?: number;
  primaryFormats: string[];
  platforms: string[];
  aliases: string[];
  notableResults: { title: string; result: string; date: string; verified: boolean }[];
  coachingSummary?: string;
  spotvaultRole?: string;
  careerWinnings?: { amount: string; verified: boolean };
}

const BRYAN_PARIS_RESUME: PokerResume = {
  headline:
    'Professional poker player specializing in online multi-table tournaments, with a long history of competing at a high level across the major online poker platforms.',
  yearsExperience: 15,
  primaryFormats: ['Online MTTs', 'High-Roller Tournaments', '$500+ Buy-in Events'],
  platforms: ['GGPoker', 'PokerStars'],
  aliases: ['Bryan Paris'],
  notableResults: [],
  coachingSummary:
    'Available for MTT coaching sessions focused on decision-making, hand analysis, and tournament dynamics for players competing in $500+ buy-in events.',
  spotvaultRole: 'Management / Coaching — COO at SpotVault',
};

export const POKER_RESUMES: Record<string, PokerResume> = {
  'bryan-paris': BRYAN_PARIS_RESUME,
  'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba': BRYAN_PARIS_RESUME,
};

export interface PeopleProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  verified: boolean;
  role: PeopleCategory;
  categories: PeopleCategory[];
  tagline: string;
  bio: string;
  specialties: PeopleSpecialty[];
  social: SocialLinks;
  followerCount: number;
  location?: string;
  acceptPaidMessages: boolean;
  paidMessagePrice?: number;
  paidMessageDescription?: string;
  acceptBookings: boolean;
  bookingServices?: { name: string; description: string; price: number; duration: number }[];
  showInDirectory: boolean;
  showSocialLinks: boolean;
  allowFollows: boolean;
  showCourses: boolean;
  showServices: boolean;
  showReviews: boolean;
  courses?: { title: string; price: number; enrolled: number }[];
  posts?: { title: string; date: string }[];
  reviews?: { author: string; rating: number; text: string; date: string }[];
  stakekingsActionId?: string;
  coachRatingAverage?: number;
  coachRatingCount?: number;
  badgeInfo?: BadgeAccountInfo;
}

export const CATEGORY_LABELS: Record<PeopleCategory, string> = {
  poker_pro: 'Poker Pros',
  coach: 'Coaches',
  creator: 'Creators',
  performance: 'Performance',
  industry_pro: 'Industry Pros',
  business: 'Business',
};

export const CATEGORY_FILTERS = [
  { id: 'featured', label: 'Featured' },
  { id: 'coach', label: 'Coaches' },
  { id: 'creator', label: 'Creators' },
  { id: 'performance', label: 'Performance' },
  { id: 'business', label: 'Business' },
] as const;

export const BRYAN_PARIS_USER_ID = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';
export const JORDAN_MCALLISTER_USER_ID = '17ca0743-ccdb-4d43-ab24-f84aa2821170';

export const FEATURED_PEOPLE: PeopleProfile[] = [
  {
    id: BRYAN_PARIS_USER_ID,
    displayName: 'Bryan Paris',
    avatarUrl: '/assets/profiles/ceopic.jpg',
    verified: true,
    role: 'poker_pro',
    categories: ['poker_pro', 'coach'],
    tagline: 'COO / Coach — MTT / Tournament Poker — $500+ Buy-ins',
    bio: 'Tournament poker professional and coach specializing in MTT strategy and high-stakes play. COO at SpotVault.',
    specialties: ['MTT', 'Tournament Strategy', 'ICM', 'Final Tables'],
    social: {},
    followerCount: 1280,
    location: 'Toronto, Canada',
    acceptPaidMessages: false,
    acceptBookings: true,
    bookingServices: [
      {
        name: 'MTT Strategy Session',
        description: 'High-level MTT coaching focused on decision-making, hand analysis, tournament dynamics and improving performance in $500+ buy-in events.',
        price: 100,
        duration: 60,
      },
    ],
    showInDirectory: true,
    showSocialLinks: false,
    allowFollows: true,
    showCourses: false,
    showServices: true,
    showReviews: false,
    reviews: [],
    badgeInfo: { role: 'staff', title: 'COO' },
  },
  {
    id: JORDAN_MCALLISTER_USER_ID,
    displayName: 'Jordan McAllister',
    avatarUrl: '/assets/profiles/image copy 4.webp',
    verified: true,
    role: 'industry_pro',
    categories: ['business'],
    tagline: 'Founder & CEO — SpotVault — Poker Technology & Community Platform',
    bio: 'Founder and CEO of SpotVault. Building the connected poker study and community platform that unifies players, coaches, stables and businesses.',
    specialties: ['Founder', 'Poker Tech', 'MTT', 'Product / Industry'],
    social: {},
    followerCount: 2150,
    location: 'Winnipeg, Manitoba, Canada',
    acceptPaidMessages: false,
    acceptBookings: false,
    showInDirectory: true,
    showSocialLinks: false,
    allowFollows: true,
    showCourses: false,
    showServices: false,
    showReviews: false,
    reviews: [],
    badgeInfo: { role: 'superuser', title: 'Founder & CEO' },
  },
];

export const DEMO_PEOPLE = FEATURED_PEOPLE;
