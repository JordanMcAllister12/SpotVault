/**
 * Centralized membership entitlement and permissions configuration.
 *
 * This is the SINGLE SOURCE OF TRUTH for all tier-based limits and feature
 * gating across the SpotVault application.  Update here first — navigation,
 * route guards, action buttons, and the comparison matrix all derive from
 * this file.
 *
 * Canonical hierarchy:
 *   FREE   = level 0  — $0/mo
 *   CORE   = level 1  — $9.99/mo
 *   PRO    = level 2  — $29.99/mo
 *   ELITE  = level 3  — $99.99/mo
 *
 * Internal code uses the canonical `MembershipTier` values ('free' | 'core' |
 * 'pro' | 'elite').  The human-readable tier names shown to users are defined
 * in TIER_DISPLAY.  The internal alias "player" that existed in older code is
 * now deprecated; use 'free'.
 */

export type MembershipTier = 'free' | 'core' | 'pro' | 'elite';

// ─── Quantitative limits ────────────────────────────────────────────────────

export interface Entitlements {
  tier: MembershipTier;
  label: string;
  priceMonthly: number;
  lounges: number;
  /** New Spots a user may save per month; null = unlimited */
  personalSpotsMonthly: number | null;
  /** SyncShare grants per month; null = unlimited */
  syncSharesMonthly: number | null;
  /**
   * AI Assist calls per week.
   * Set to 0 AND check FEATURE_FLAGS.aiAssistEnabled before using — when the
   * feature is not yet live the quota is irrelevant.
   */
  aiAssistsWeekly: number;
  /**
   * Monetized Spots that can be active simultaneously; null = unlimited.
   * Only meaningful when FEATURE_FLAGS.monetizationEnabled is true.
   */
  monetizedSpotsActive: number | null;
  monetizationEnabled: boolean;
  savedTournaments: number | null;
}

export const ENTITLEMENTS: Record<MembershipTier, Entitlements> = {
  free: {
    tier: 'free',
    label: 'FREE',
    priceMonthly: 0,
    lounges: 2,
    personalSpotsMonthly: 0,
    syncSharesMonthly: 0,
    aiAssistsWeekly: 0,
    monetizedSpotsActive: 0,
    monetizationEnabled: false,
    savedTournaments: null,
  },
  core: {
    tier: 'core',
    label: 'CORE',
    priceMonthly: 999,
    lounges: 2,
    personalSpotsMonthly: 10,
    syncSharesMonthly: 10,
    aiAssistsWeekly: 10,
    monetizedSpotsActive: 1,
    monetizationEnabled: false,
    savedTournaments: null,
  },
  pro: {
    tier: 'pro',
    label: 'PRO',
    priceMonthly: 2999,
    lounges: 2,
    personalSpotsMonthly: 50,
    syncSharesMonthly: 50,
    aiAssistsWeekly: 50,
    monetizedSpotsActive: 5,
    monetizationEnabled: false,
    savedTournaments: null,
  },
  elite: {
    tier: 'elite',
    label: 'ELITE',
    priceMonthly: 9999,
    lounges: 2,
    personalSpotsMonthly: null,
    syncSharesMonthly: null,
    aiAssistsWeekly: 250,
    monetizedSpotsActive: null,
    monetizationEnabled: false,
    savedTournaments: null,
  },
};

// ─── Global feature flags (Coming Soon gates) ───────────────────────────────

/**
 * When false the feature is not yet live.  Show "Coming Soon" instead of the
 * quota/tier value.  Do NOT remove the quota configuration — it will be
 * activated at launch by flipping the flag.
 */
export const FEATURE_FLAGS = {
  /** AI Assist text-generation tool */
  aiAssistEnabled: false,
  /** Monetised Spot selling through the SpotVault marketplace */
  monetizationEnabled: false,
  /** Rewards / Mystery Vault system */
  rewardsEnabled: false,
  /** SpotVault Performance Index — temporarily suspended during analytics accuracy audit */
  spiEnabled: false,
  /** Coach session booking — temporarily disabled until booking system is ready to launch */
  coachBookingsEnabled: false,
} as const;

// ─── Granular boolean permissions ───────────────────────────────────────────

export interface TierPermissions {
  // Community
  canViewCommunity: boolean;
  /** Post/comment in the global Community feed */
  canPostCommunity: boolean;

  // Lounges
  canJoinLounge: boolean;
  /** Chat inside a Lounge the user has joined */
  canChatInLounge: boolean;

  // Marketplace / purchasing
  canBrowseMarketplace: boolean;
  canPurchaseSpot: boolean;
  /** Access My Spots to view purchased/received content */
  canViewMySpots: boolean;

  // Creation
  /** Create original Spots or content */
  canCreateSpot: boolean;
  /** Upload content to My Spots/library */
  canUploadContent: boolean;
  /** Edit or organise own Spots */
  canEditOwnSpot: boolean;
  /** Publish a Spot to the public library */
  canPublishSpot: boolean;
  /** Use creator/content-lab features */
  canUseCreatorTools: boolean;

  // Analytics
  canViewAnalytics: boolean;

  // Study tools
  canUseSyncShare: boolean;
  canUseHHReplayer: boolean;
  /** Full Replayer (no limit); false = limited/read-only access */
  canUseFullHHReplayer: boolean;
  canUseSolver: boolean;

  // Commentary
  canAddTextCommentary: boolean;
  canAddVoiceCommentary: boolean;

  // Coming-soon gated features — always false until FEATURE_FLAGS enables them
  canMonetizeSpot: boolean;
  canUseAiAssist: boolean;
  canAccessRewards: boolean;
}

export const PERMISSIONS: Record<MembershipTier, TierPermissions> = {
  free: {
    canViewCommunity: true,
    canPostCommunity: false,

    canJoinLounge: true,
    canChatInLounge: true,

    canBrowseMarketplace: true,
    canPurchaseSpot: true,
    canViewMySpots: true,

    canCreateSpot: false,
    canUploadContent: false,
    canEditOwnSpot: false,
    canPublishSpot: false,
    canUseCreatorTools: false,

    canViewAnalytics: false,

    canUseSyncShare: false,
    canUseHHReplayer: true,
    canUseFullHHReplayer: false,
    canUseSolver: false,

    canAddTextCommentary: false,
    canAddVoiceCommentary: false,

    canMonetizeSpot: false,
    canUseAiAssist: false,
    canAccessRewards: false,
  },
  core: {
    canViewCommunity: true,
    canPostCommunity: true,

    canJoinLounge: true,
    canChatInLounge: true,

    canBrowseMarketplace: true,
    canPurchaseSpot: true,
    canViewMySpots: true,

    canCreateSpot: true,
    canUploadContent: true,
    canEditOwnSpot: true,
    canPublishSpot: true,
    canUseCreatorTools: true,

    canViewAnalytics: false,

    canUseSyncShare: true,
    canUseHHReplayer: true,
    canUseFullHHReplayer: true,
    canUseSolver: false,

    canAddTextCommentary: true,
    canAddVoiceCommentary: false,

    canMonetizeSpot: FEATURE_FLAGS.monetizationEnabled,
    canUseAiAssist: FEATURE_FLAGS.aiAssistEnabled,
    canAccessRewards: FEATURE_FLAGS.rewardsEnabled,
  },
  pro: {
    canViewCommunity: true,
    canPostCommunity: true,

    canJoinLounge: true,
    canChatInLounge: true,

    canBrowseMarketplace: true,
    canPurchaseSpot: true,
    canViewMySpots: true,

    canCreateSpot: true,
    canUploadContent: true,
    canEditOwnSpot: true,
    canPublishSpot: true,
    canUseCreatorTools: true,

    canViewAnalytics: true,

    canUseSyncShare: true,
    canUseHHReplayer: true,
    canUseFullHHReplayer: true,
    canUseSolver: false,

    canAddTextCommentary: true,
    canAddVoiceCommentary: true,

    canMonetizeSpot: FEATURE_FLAGS.monetizationEnabled,
    canUseAiAssist: FEATURE_FLAGS.aiAssistEnabled,
    canAccessRewards: FEATURE_FLAGS.rewardsEnabled,
  },
  elite: {
    canViewCommunity: true,
    canPostCommunity: true,

    canJoinLounge: true,
    canChatInLounge: true,

    canBrowseMarketplace: true,
    canPurchaseSpot: true,
    canViewMySpots: true,

    canCreateSpot: true,
    canUploadContent: true,
    canEditOwnSpot: true,
    canPublishSpot: true,
    canUseCreatorTools: true,

    canViewAnalytics: true,

    canUseSyncShare: true,
    canUseHHReplayer: true,
    canUseFullHHReplayer: true,
    canUseSolver: false,

    canAddTextCommentary: true,
    canAddVoiceCommentary: true,

    canMonetizeSpot: FEATURE_FLAGS.monetizationEnabled,
    canUseAiAssist: FEATURE_FLAGS.aiAssistEnabled,
    canAccessRewards: FEATURE_FLAGS.rewardsEnabled,
  },
};

/** Convenience helper — check a single named permission for a tier. */
export function hasPermission(tier: MembershipTier, permission: keyof TierPermissions): boolean {
  return PERMISSIONS[tier][permission];
}

// ─── Capabilities (legacy — kept for backwards compat) ─────────────────────

export type Capability = 'AI_COACH' | 'AI_COACH_DEEP' | 'SOLVER' | 'ANALYTICS_ADVANCED';

const TIER_CAPABILITIES: Record<MembershipTier, Set<Capability>> = {
  free: new Set<Capability>([]),
  core: new Set<Capability>([]),
  pro: new Set<Capability>(['AI_COACH', 'ANALYTICS_ADVANCED']),
  elite: new Set<Capability>(['AI_COACH', 'AI_COACH_DEEP', 'ANALYTICS_ADVANCED']),
};

export function hasCapability(tier: MembershipTier, cap: Capability): boolean {
  return TIER_CAPABILITIES[tier]?.has(cap) ?? false;
}

export function tierHasAiCoach(tier: MembershipTier): boolean {
  return hasCapability(tier, 'AI_COACH');
}

// ─── Tier helpers ───────────────────────────────────────────────────────────

export const TIER_ORDER: MembershipTier[] = ['free', 'core', 'pro', 'elite'];

/** Human-readable display data used in the UI. */
export const TIER_DISPLAY: Record<MembershipTier, { name: string; price: string; features: string[] }> = {
  free: {
    name: 'FREE',
    price: '$0',
    features: [
      'Community access',
      'Browse Spot Library',
      'Limited HH Replayer',
      '5 HH Vault saves / month',
    ],
  },
  core: {
    name: 'CORE',
    price: '$9.99/mo',
    features: [
      'Everything in FREE',
      'Full HH Replayer',
      'Post in Community',
      'Create & upload content',
      'Publish to Public Library',
      'Knowledge SyncShare',
      'Text Commentary',
    ],
  },
  pro: {
    name: 'PRO',
    price: '$29.99/mo',
    features: [
      'Everything in CORE',
      'Full Analytics Suite',
      'Tournament & Cash Analytics',
      'Board Analysis',
      'Advanced Reports',
      'HH SyncShare',
      'Voice Commentary',
    ],
  },
  elite: {
    name: 'ELITE',
    price: '$99.99/mo',
    features: [
      'Everything in PRO',
      'Unlimited Spot saves',
      'Unlimited SyncShares',
      'Priority support',
    ],
  },
};

// ─── Quantitative helpers ───────────────────────────────────────────────────

export function isUnlimited(value: number | null): boolean {
  return value === null;
}

export function formatRemaining(used: number, limit: number | null): string {
  if (limit === null) return 'Unlimited';
  return `${Math.max(0, limit - used)} of ${limit} remaining`;
}

export function formatUsage(used: number, limit: number | null): string {
  if (limit === null) return 'Unlimited';
  return `${used} / ${limit}`;
}

export function canPerformAction(limit: number | null, used: number): boolean {
  if (limit === null) return true;
  return used < limit;
}

export function nextTier(tier: MembershipTier): MembershipTier | null {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

/**
 * Resolve the user's membership tier from their account.
 * Staff / superuser accounts are treated as Elite for tool access.
 * If the account carries a `membership_tier` field (from sv_staff_get_accounts
 * or sv_resolve_effective_membership), that value takes priority — it already
 * encodes admin overrides, Stripe subscriptions, and role-based elite.
 */
export function resolveTier(account: { role?: string; membership_tier?: string } | null | undefined): MembershipTier {
  if (!account) return 'free';
  // If the account already carries an effective membership tier (from the DB RPC),
  // trust it — it has the full override > stripe > role hierarchy baked in.
  if (account.membership_tier) {
    const t = account.membership_tier.toLowerCase();
    if (t === 'elite' || t === 'pro' || t === 'core' || t === 'free') return t;
  }
  if (account.role === 'superuser' || account.role === 'staff' || account.role === 'developer_admin' || account.role === 'universal_access') return 'elite';
  return 'free';
}

/**
 * Async tier resolution via the database RPC `sv_resolve_effective_membership`.
 * Use this when you have a user_id and need the authoritative tier including
 * admin overrides. Falls back to the sync `resolveTier` on error.
 */
export async function resolveTierAsync(
  userId: string,
  fallbackAccount?: { role?: string; membership_tier?: string } | null,
): Promise<MembershipTier> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.rpc('sv_resolve_effective_membership', { p_user_id: userId });
    if (error || !data) return resolveTier(fallbackAccount);
    const tier = String(data).toLowerCase();
    if (tier === 'elite' || tier === 'pro' || tier === 'core' || tier === 'free') return tier as MembershipTier;
    return resolveTier(fallbackAccount);
  } catch {
    return resolveTier(fallbackAccount);
  }
}
