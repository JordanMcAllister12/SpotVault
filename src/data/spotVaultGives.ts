// ===== SPOTVAULT GIVES — DEMO DATA =====
// Community-funded support and impact system.
// DEMO only — no real charitable claims, tax deductibility, or cash transfers.

export type GivesCategory = 'wellness' | 'education' | 'community' | 'where-needed';

export interface GivesCategoryConfig {
  id: GivesCategory;
  label: string;
  shortLabel: string;
  description: string;
  accent: string;
}

export const GIVES_CATEGORIES: GivesCategoryConfig[] = [
  {
    id: 'wellness',
    label: 'Wellness & Support',
    shortLabel: 'Wellness',
    description: 'Help subsidize eligible professional wellness and support services.',
    accent: '#a8c4b8',
  },
  {
    id: 'education',
    label: 'Education & Career',
    shortLabel: 'Education',
    description: 'Help poker players transition into education, training, certification, or new careers.',
    accent: '#c9a44c',
  },
  {
    id: 'community',
    label: 'Poker Community',
    shortLabel: 'Community',
    description: 'Support approved projects that improve the poker ecosystem.',
    accent: '#7a9b8e',
  },
  {
    id: 'where-needed',
    label: 'Where Needed Most',
    shortLabel: 'Where Needed',
    description: 'Allow SpotVault Gives to allocate the contribution among approved programs.',
    accent: '#8a9ab5',
  },
];

export const CONTRIBUTION_AMOUNTS = [100, 250, 500, 1000];

export type ContributionPrivacy = 'public' | 'anonymous' | 'private';

export interface Contribution {
  id: string;
  contributorName: string;
  amount: number;
  category: GivesCategory;
  privacy: ContributionPrivacy;
  timestamp: string;
}

// ===== MONTHLY IMPACT (demo) =====

export interface MonthlyImpact {
  totalCredits: number;
  wellnessSessions: number;
  educationCredits: number;
  communityProjects: number;
}

export const MONTHLY_IMPACT: MonthlyImpact = {
  totalCredits: 48250,
  wellnessSessions: 21,
  educationCredits: 3200,
  communityProjects: 2,
};

// ===== ALL-TIME IMPACT (demo) =====

export const ALL_TIME_CREDITS = 1284500;

// ===== CATEGORY IMPACT DETAIL =====

export interface CategoryImpact {
  categoryId: GivesCategory;
  stats: { label: string; value: string }[];
}

export const CATEGORY_IMPACT: CategoryImpact[] = [
  {
    categoryId: 'wellness',
    stats: [
      { label: 'Sessions Funded', value: '21' },
      { label: 'Professionals Participating', value: '8' },
    ],
  },
  {
    categoryId: 'education',
    stats: [
      { label: 'Education Grants', value: '3' },
      { label: 'Certifications Funded', value: '2' },
      { label: 'Career Transition Programs', value: '1' },
    ],
  },
  {
    categoryId: 'community',
    stats: [
      { label: 'Projects Funded', value: '2' },
      { label: 'Projects Under Review', value: '4' },
    ],
  },
];

// ===== TRANSPARENCY =====

export interface TransparencyAllocation {
  category: string;
  percentage: number;
  color: string;
}

export const TRANSPARENCY_ALLOCATIONS: TransparencyAllocation[] = [
  { category: 'Wellness & Support', percentage: 42, color: '#a8c4b8' },
  { category: 'Education & Career', percentage: 31, color: '#c9a44c' },
  { category: 'Poker Community', percentage: 18, color: '#7a9b8e' },
  { category: 'Where Needed Most', percentage: 9, color: '#8a9ab5' },
];

// ===== NEXT CHAPTER FUND =====

export const NEXT_CHAPTER_FUND = {
  title: 'The Next Chapter Fund',
  subtitle: 'Life After Poker',
  description:
    'Help experienced poker players transition into another career when they are ready to leave professional poker.',
  eligibleUses: [
    'University / College',
    'Trade School',
    'Professional Certification',
    'Technology Training',
    'Business Education',
    'Career Coaching',
  ],
};

// ===== COMMUNITY STORIES (opt-in only) =====

export interface CommunityStory {
  id: string;
  title: string;
  excerpt: string;
  category: GivesCategory;
  authorOptedIn: boolean;
}

export const COMMUNITY_STORIES: CommunityStory[] = [
  {
    id: 'story-1',
    title: 'The Next Chapter',
    excerpt:
      'After 11 years playing professionally, a SpotVault member used Next Chapter support toward a software-development certification.',
    category: 'education',
    authorOptedIn: true,
  },
];

// ===== SPONSOR MATCHING (architecture ready) =====

export interface SponsorMatch {
  communityContributions: number;
  matchedBy: string;
  totalImpact: number;
}

export const DEMO_SPONSOR_MATCH: SponsorMatch = {
  communityContributions: 18400,
  matchedBy: 'Industry Partner',
  totalImpact: 36800,
};

// ===== ADMIN / ACCOUNTING (demo) =====

export interface FundBalance {
  categoryId: GivesCategory;
  label: string;
  balance: number;
}

export const FUND_BALANCES: FundBalance[] = [
  { categoryId: 'wellness', label: 'Wellness Fund', balance: 8400 },
  { categoryId: 'education', label: 'Education Fund', balance: 6200 },
  { categoryId: 'community', label: 'Poker Community Fund', balance: 3600 },
  { categoryId: 'where-needed', label: 'Where Needed Most', balance: 1800 },
];

// ===== CONTRIBUTOR BADGE =====

export interface ContributorBadge {
  id: string;
  label: string;
  threshold: number;
}

export const CONTRIBUTOR_BADGES: ContributorBadge[] = [
  { id: 'contributor', label: 'Gives Contributor', threshold: 100 },
  { id: 'supporter', label: 'Gives Supporter', threshold: 1000 },
  { id: 'patron', label: 'Gives Patron', threshold: 10000 },
];
