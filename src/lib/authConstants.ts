/**
 * Centralized authorization constants for SpotVault.
 *
 * These are the single source of truth for portal types, role types, resource types,
 * actions, permission levels, relationship types, and entitlement types.
 * Do NOT scatter raw strings throughout the application — import from here.
 */

// ============================================================
// PORTAL TYPES — which workspace the user is operating in
// ============================================================
export const PORTAL_TYPES = [
  'player',
  'coach',
  'stable',
  'business',
  'creator',
] as const;
export type PortalType = (typeof PORTAL_TYPES)[number];

export const PORTAL_LABELS: Record<PortalType, string> = {
  player: 'Player Portal',
  coach: 'Coach Portal',
  stable: 'Stable Portal',
  business: 'Business / Investor Portal',
  creator: 'Creator Portal',
};

// ============================================================
// ROLE TYPES — what the user is approved to act as
// ============================================================
export const ROLE_TYPES = [
  'player',
  'coach',
  'creator',
  'investor',
  'stable_operator',
  'business',
  'staff',
] as const;
export type RoleType = (typeof ROLE_TYPES)[number];

export const ROLE_LABELS: Record<RoleType, string> = {
  player: 'Player',
  coach: 'Coach',
  creator: 'Creator',
  investor: 'Investor',
  stable_operator: 'Stable Operator',
  business: 'Business',
  staff: 'Staff',
};

export const ROLE_STATUSES = ['active', 'pending', 'suspended', 'revoked'] as const;
export type RoleStatus = (typeof ROLE_STATUSES)[number];

// ============================================================
// RESOURCE TYPES — protected resources across SpotVault
// ============================================================
export const RESOURCE_TYPES = [
  'hand',
  'hand_collection',
  'tournament',
  'session',
  'analytics_dataset',
  'analytics_report',
  'library_item',
  'spot',
  'video',
  'course',
  'study_set',
  'assignment',
  'submission',
  'coaching_session',
  'coaching_recording',
  'transcript',
  'coaching_notes',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

// ============================================================
// STANDARD ACTIONS — small vocabulary for authorization checks
// ============================================================
export const ACTIONS = [
  'view',
  'review',
  'comment',
  'edit',
  'share',
  'download',
  'publish',
  'sell',
  'delete',
  'manage',
] as const;
export type Action = (typeof ACTIONS)[number];

// ============================================================
// PERMISSION LEVELS — convenience bundles
// ============================================================
export const PERMISSION_LEVELS = [
  'owner',
  'manage',
  'collaborate',
  'review',
  'view',
  null,
] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const PERMISSION_LABELS: Record<NonNullable<PermissionLevel>, string> = {
  owner: 'Owner',
  manage: 'Manage',
  collaborate: 'Collaborate',
  review: 'Review',
  view: 'View',
};

/**
 * Map a permission level to the set of actions it allows.
 * Higher levels include all actions from lower levels.
 */
export const PERMISSION_ACTIONS: Record<NonNullable<PermissionLevel>, Action[]> = {
  owner: ['view', 'review', 'comment', 'edit', 'share', 'download', 'publish', 'sell', 'delete', 'manage'],
  manage: ['view', 'review', 'comment', 'edit', 'share', 'download'],
  collaborate: ['view', 'review', 'comment', 'download'],
  review: ['view', 'review', 'download'],
  view: ['view'],
};

/**
 * Check whether a permission level grants a specific action.
 */
export function permissionAllows(permission: PermissionLevel, action: Action): boolean {
  if (permission === null) return false;
  return PERMISSION_ACTIONS[permission].includes(action);
}

/**
 * Compare two permission levels. Returns true if `level` includes all
 * permissions of `required`.
 */
export function permissionSatisfies(level: PermissionLevel, required: PermissionLevel): boolean {
  if (level === null) return false;
  if (required === null) return true;
  if (level === required) return true;

  const hierarchy: NonNullable<PermissionLevel>[] = ['view', 'review', 'collaborate', 'manage', 'owner'];
  return hierarchy.indexOf(level) >= hierarchy.indexOf(required);
}

// ============================================================
// RELATIONSHIP TYPES — connections between users
// ============================================================
export const RELATIONSHIP_TYPES = [
  'coach_student',
  'stable_player',
  'business_employee',
  'creator_customer',
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  coach_student: 'Coach / Student',
  stable_player: 'Stable / Player',
  business_employee: 'Business / Employee',
  creator_customer: 'Creator / Customer',
};

export const RELATIONSHIP_STATUSES = ['pending', 'active', 'paused', 'ended', 'blocked'] as const;
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

// ============================================================
// ENTITLEMENT TYPES — purchase vs subscription
// ============================================================
export const ENTITLEMENT_TYPES = ['purchase', 'subscription'] as const;
export type EntitlementType = (typeof ENTITLEMENT_TYPES)[number];

// ============================================================
// SUBMISSION STATUSES — coaching submission lifecycle
// ============================================================
export const SUBMISSION_STATUSES = [
  'submitted',
  'awaiting_review',
  'in_review',
  'reviewed',
  'returned',
  'cancelled',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

// ============================================================
// ACCESS REASONS — why a user has access to a resource
// ============================================================
export const ACCESS_REASONS = [
  'owner',
  'purchase',
  'subscription',
  'relationship_grant',
  'submission',
  'organization_member',
  'admin',
] as const;
export type AccessReason = (typeof ACCESS_REASONS)[number];

export const ACCESS_REASON_LABELS: Record<AccessReason, string> = {
  owner: 'Owner',
  purchase: 'Purchased',
  subscription: 'Subscription',
  relationship_grant: 'Shared via relationship',
  submission: 'Coaching submission',
  organization_member: 'Organization member',
  admin: 'Administrator',
};

// ============================================================
// PORTAL ACCESS — which roles unlock which portals
// ============================================================
export const ROLE_TO_PORTAL: Partial<Record<RoleType, PortalType>> = {
  player: 'player',
  coach: 'coach',
  stable_operator: 'stable',
  business: 'business',
  investor: 'business',
  creator: 'creator',
};

/**
 * The player portal is the base experience — every user gets it.
 */
export const BASE_PORTAL: PortalType = 'player';

/**
 * Which roles require approval (not automatic).
 */
export const ROLES_REQUIRING_APPROVAL: RoleType[] = [
  'coach',
  'stable_operator',
  'business',
  'investor',
  'creator',
];

/**
 * Staff is never self-assigned — explicit admin assignment only.
 */
export const ROLES_REQUIRING_EXPLICIT_ASSIGNMENT: RoleType[] = ['staff'];
