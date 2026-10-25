export type CommunityTier = 'free' | 'member';

export type AccomplishmentCategory =
  | 'tournament_win' | 'final_table' | 'online_score' | 'career_cashes'
  | 'ranking' | 'leaderboard' | 'poker_role' | 'coaching_credential'
  | 'industry_position' | 'other';

export type ReviewStatus = 'unreviewed' | 'pending' | 'verified' | 'needs_info' | 'rejected';

export type ReviewAction = 'submit' | 'verify' | 'request_info' | 'reject' | 'remove_verification';

export type EvidenceType = 'screenshot' | 'image' | 'document' | 'url';

export type PrivacyMode = 'public' | 'members' | 'private';

export interface CommunityEntitlement {
  user_id: string;
  tier: CommunityTier;
  is_paid_member: boolean;
  member_since: string | null;
  privileges: {
    can_post: boolean;
    can_comment: boolean;
    can_chat: boolean;
    can_boost: boolean;
    can_pin: boolean;
    can_sponsor: boolean;
  };
  priority_weight: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  privacy_mode: PrivacyMode;
  poker_site: string | null;
  hendon_mob_url: string | null;
  username: string | null;
  poker_role: string | null;
  home_city_slug: string | null;
  country: string | null;
  title: string | null;
  specialties: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Accomplishment {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: AccomplishmentCategory;
  accomplishment_date: string | null;
  event_name: string | null;
  finish: string | null;
  prize_amount: number | null;
  poker_site: string | null;
  tournament_series: string | null;
  ranking: string | null;
  organization: string | null;
  review_status: ReviewStatus;
  submitted_for_review_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  staff_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccomplishmentEvidence {
  id: string;
  accomplishment_id: string;
  evidence_type: EvidenceType;
  url: string | null;
  label: string | null;
  reviewer_notes: string | null;
  created_at: string;
}

export interface AccomplishmentReview {
  id: string;
  accomplishment_id: string;
  reviewer_id: string | null;
  action: ReviewAction;
  previous_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
}

export interface FeaturedProfileItem {
  id: string;
  user_id: string;
  accomplishment_id: string;
  display_order: number;
  created_at: string;
}

export interface AccomplishmentWithEvidence extends Accomplishment {
  evidence?: AccomplishmentEvidence[];
}

export const CATEGORY_LABELS: Record<AccomplishmentCategory, string> = {
  tournament_win: 'Tournament Win',
  final_table: 'Final Table',
  online_score: 'Major Online Score',
  career_cashes: 'Career Cashes',
  ranking: 'Ranking',
  leaderboard: 'Leaderboard Result',
  poker_role: 'Poker Role/Title',
  coaching_credential: 'Coaching Credential',
  industry_position: 'Industry Position',
  other: 'Other Achievement',
};

export const CATEGORY_ICONS: Record<AccomplishmentCategory, string> = {
  tournament_win: 'Trophy',
  final_table: 'Medal',
  online_score: 'DollarSign',
  career_cashes: 'Wallet',
  ranking: 'BarChart3',
  leaderboard: 'TrendingUp',
  poker_role: 'UserCog',
  coaching_credential: 'GraduationCap',
  industry_position: 'Building2',
  other: 'Star',
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  unreviewed: 'Unreviewed',
  pending: 'Pending Review',
  verified: 'Verified',
  needs_info: 'Needs More Info',
  rejected: 'Rejected',
};

export const REVIEW_STATUS_COLORS: Record<ReviewStatus, { bg: string; text: string; border: string }> = {
  unreviewed: { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af', border: 'rgba(107,114,128,0.3)' },
  pending: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', border: 'rgba(245,158,11,0.4)' },
  verified: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', border: 'rgba(34,197,94,0.4)' },
  needs_info: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', border: 'rgba(59,130,246,0.4)' },
  rejected: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.4)' },
};

export const PRIVACY_LABELS: Record<PrivacyMode, string> = {
  public: 'Public',
  members: 'Members Only',
  private: 'Private',
};

export const DEFAULT_FREE_PRIVILEGES = {
  can_post: false,
  can_comment: true,
  can_chat: true,
  can_boost: false,
  can_pin: false,
  can_sponsor: false,
};

export const DEFAULT_MEMBER_PRIVILEGES = {
  can_post: true,
  can_comment: true,
  can_chat: true,
  can_boost: false,
  can_pin: false,
  can_sponsor: false,
};

export const TIER_PRIORITY: Record<CommunityTier, number> = {
  free: 1,
  member: 5,
};

export const MEMBER_PRICE_MONTHLY = 4.99;
export const MEMBER_PRICE_DISPLAY = '$4.99/mo';
