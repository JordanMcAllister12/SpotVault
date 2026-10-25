/**
 * Centralized authorization engine for SpotVault.
 *
 * This module provides the single entry point for all authorization checks.
 * Every protected resource should ultimately answer:
 *
 *   Can USER perform ACTION on RESOURCE under CURRENT CONTEXT?
 *
 * All checks are server-side via Supabase RPC functions (SECURITY DEFINER).
 * The frontend never makes authorization decisions on its own — it asks the server.
 */

import { supabase } from '@/lib/supabase';
import {
  type Action,
  type PermissionLevel,
  type PortalType,
  type ResourceType,
  type RoleType,
  type RelationshipType,
  permissionAllows,
  permissionSatisfies,
  ROLE_TO_PORTAL,
  BASE_PORTAL,
} from '@/lib/authConstants';

// ============================================================
// Types
// ============================================================

export interface UserRole {
  role: RoleType;
  status: 'active' | 'pending' | 'suspended' | 'revoked';
}

export interface PortalAccess {
  portal_type: PortalType;
  status: 'active' | 'pending' | 'suspended' | 'revoked';
  expires_at: string | null;
  metadata: Record<string, unknown>;
}

export interface ResourceGrant {
  id: string;
  resource_type: ResourceType;
  resource_id: string;
  owner_id: string;
  permission_level: PermissionLevel;
  expires_at: string | null;
  created_at: string;
}

export interface Entitlement {
  id: string;
  resource_type: ResourceType;
  resource_id: string;
  entitlement_type: 'purchase' | 'subscription';
  expires_at: string | null;
  metadata: Record<string, unknown>;
}

export interface Relationship {
  id: string;
  type: RelationshipType;
  user_a: string;
  user_b: string;
  status: 'pending' | 'active' | 'paused' | 'ended' | 'blocked';
  is_primary: boolean;
  metadata: Record<string, unknown>;
  started_at: string | null;
  ended_at: string | null;
}

export interface CoachingSubmission {
  id: string;
  student_id: string;
  coach_id: string;
  relationship_id: string | null;
  title: string;
  student_note: string | null;
  coach_feedback: string | null;
  status: 'submitted' | 'awaiting_review' | 'in_review' | 'reviewed' | 'returned' | 'cancelled';
  priority: 'normal' | 'review_soon' | 'urgent';
  submitted_at: string;
  reviewed_at: string | null;
}

// ============================================================
// Role & Portal Access
// ============================================================

/**
 * Fetch the current user's roles from the server.
 */
export async function getMyRoles(): Promise<UserRole[]> {
  const { data, error } = await supabase.rpc('sv_get_my_roles');
  if (error) {
    console.error('Failed to load roles:', error);
    return [];
  }
  return (data ?? []) as UserRole[];
}

/**
 * Fetch the current user's portal access from the server.
 */
export async function getMyPortalAccess(): Promise<PortalAccess[]> {
  const { data, error } = await supabase.rpc('sv_get_my_portal_access');
  if (error) {
    console.error('Failed to load portal access:', error);
    return [];
  }
  return (data ?? []) as PortalAccess[];
}

/**
 * Check if the current user has active access to a portal.
 * This is a server-side check — the frontend does not decide.
 */
export async function hasPortalAccess(portal: PortalType): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_has_portal_access', {
    p_portal_type: portal,
  });
  if (error) {
    console.error('Portal access check failed:', error);
    return false;
  }
  return data === true;
}

/**
 * Check if the user has a specific active role.
 */
export function hasRole(roles: UserRole[], role: RoleType): boolean {
  return roles.some((r) => r.role === role && r.status === 'active');
}

/**
 * Get the portals the user can access based on their roles.
 * Player is always included as the base experience.
 */
export function getAccessiblePortals(roles: UserRole[]): PortalType[] {
  const portals = new Set<PortalType>([BASE_PORTAL]);
  for (const r of roles) {
    if (r.status !== 'active') continue;
    const portal = ROLE_TO_PORTAL[r.role];
    if (portal) portals.add(portal);
  }
  return Array.from(portals);
}

// ============================================================
// Resource Permission Checks
// ============================================================

/**
 * Check the user's permission level on a specific resource.
 * Returns 'owner', 'manage', 'collaborate', 'review', 'view', or null (no access).
 * This is a server-side check.
 */
export async function checkPermission(
  resourceType: ResourceType,
  resourceId: string
): Promise<PermissionLevel> {
  const { data, error } = await supabase.rpc('sv_check_permission', {
    p_resource_type: resourceType,
    p_resource_id: resourceId,
  });
  if (error) {
    console.error('Permission check failed:', error);
    return null;
  }
  return (data as PermissionLevel) ?? null;
}

/**
 * Check if the user can perform a specific action on a resource.
 * Server-side check.
 */
export async function canPerformAction(
  resourceType: ResourceType,
  resourceId: string,
  action: Action
): Promise<boolean> {
  const level = await checkPermission(resourceType, resourceId);
  if (level === null) return false;
  return permissionAllows(level, action);
}

/**
 * Check if the user's permission level satisfies a required level.
 * Server-side check for the permission, client-side comparison.
 */
export async function hasPermissionLevel(
  resourceType: ResourceType,
  resourceId: string,
  required: PermissionLevel
): Promise<boolean> {
  const level = await checkPermission(resourceType, resourceId);
  return permissionSatisfies(level, required);
}

/**
 * Get the reason why the user has access to a resource.
 * Returns 'owner', 'purchase', 'subscription', 'relationship_grant', 'submission', or null.
 */
export async function getAccessReason(
  resourceType: ResourceType,
  resourceId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_get_access_reason', {
    p_resource_type: resourceType,
    p_resource_id: resourceId,
  });
  if (error) {
    console.error('Access reason check failed:', error);
    return null;
  }
  return data as string | null;
}

// ============================================================
// Resource Ownership
// ============================================================

/**
 * Claim ownership of a newly created resource.
 * Called after inserting a resource into its source table.
 */
export async function claimOwnership(
  resourceType: ResourceType,
  resourceId: string,
  ownerType: 'user' | 'organization' = 'user'
): Promise<boolean> {
  const { error } = await supabase.rpc('sv_claim_ownership', {
    p_resource_type: resourceType,
    p_resource_id: resourceId,
    p_owner_type: ownerType,
  });
  if (error) {
    console.error('Failed to claim ownership:', error);
    return false;
  }
  return true;
}

/**
 * Check if the current user owns a resource.
 */
export async function isResourceOwner(
  resourceType: ResourceType,
  resourceId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_is_resource_owner', {
    p_resource_type: resourceType,
    p_resource_id: resourceId,
  });
  if (error) {
    console.error('Ownership check failed:', error);
    return false;
  }
  return data === true;
}

// ============================================================
// ShareSync — Resource Grants
// ============================================================

/**
 * Share a resource with another user (ShareSync).
 * Only the resource owner can do this.
 */
export async function shareResource(
  resourceType: ResourceType,
  resourceId: string,
  recipientId: string,
  permissionLevel: PermissionLevel,
  relationshipId?: string,
  expiresAt?: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_create_grant', {
    p_resource_type: resourceType,
    p_resource_id: resourceId,
    p_recipient_id: recipientId,
    p_permission_level: permissionLevel,
    p_relationship_id: relationshipId ?? null,
    p_expires_at: expiresAt ?? null,
  });
  if (error) {
    console.error('Failed to share resource:', error);
    return null;
  }
  return data as string | null;
}

/**
 * Revoke a ShareSync grant. Only the owner can do this.
 */
export async function revokeShare(grantId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_revoke_grant', {
    p_grant_id: grantId,
  });
  if (error) {
    console.error('Failed to revoke share:', error);
    return false;
  }
  return true;
}

/**
 * Get all active grants the current user has received (as recipient).
 */
export async function getMyGrants(resourceType?: ResourceType): Promise<ResourceGrant[]> {
  const { data, error } = await supabase.rpc('sv_get_my_grants', {
    p_resource_type: resourceType ?? null,
  });
  if (error) {
    console.error('Failed to load grants:', error);
    return [];
  }
  return (data ?? []) as ResourceGrant[];
}

// ============================================================
// Entitlements — Purchases & Subscriptions
// ============================================================

/**
 * Get the current user's active entitlements.
 */
export async function getMyEntitlements(): Promise<Entitlement[]> {
  const { data, error } = await supabase.rpc('sv_get_my_entitlements');
  if (error) {
    console.error('Failed to load entitlements:', error);
    return [];
  }
  return (data ?? []) as Entitlement[];
}

/**
 * Check if the user has an active entitlement for a resource.
 */
export async function hasEntitlement(
  resourceType: ResourceType,
  resourceId: string
): Promise<boolean> {
  const entitlements = await getMyEntitlements();
  return entitlements.some(
    (e) => e.resource_type === resourceType && e.resource_id === resourceId
  );
}

// ============================================================
// Relationships
// ============================================================

/**
 * Get the current user's relationships.
 */
export async function getMyRelationships(type?: RelationshipType): Promise<Relationship[]> {
  const { data, error } = await supabase.rpc('sv_get_my_relationships', {
    p_type: type ?? null,
  });
  if (error) {
    console.error('Failed to load relationships:', error);
    return [];
  }
  return (data ?? []) as Relationship[];
}

/**
 * Check if the current user has an active relationship with another user.
 */
export async function hasRelationship(
  targetUserId: string,
  type: RelationshipType
): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_has_relationship', {
    p_target_user_id: targetUserId,
    p_type: type,
  });
  if (error) {
    console.error('Relationship check failed:', error);
    return false;
  }
  return data === true;
}

/**
 * Create a new relationship (e.g., coach_student).
 */
export async function createRelationship(
  type: RelationshipType,
  userA: string,
  userB: string,
  isPrimary = false,
  metadata: Record<string, unknown> = {}
): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_create_relationship', {
    p_type: type,
    p_user_a: userA,
    p_user_b: userB,
    p_is_primary: isPrimary,
    p_metadata: metadata,
  });
  if (error) {
    console.error('Failed to create relationship:', error);
    return null;
  }
  return data as string | null;
}

/**
 * End a relationship. Revokes relationship-derived ShareSync grants.
 */
export async function endRelationship(relationshipId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_end_relationship', {
    p_relationship_id: relationshipId,
  });
  if (error) {
    console.error('Failed to end relationship:', error);
    return false;
  }
  return true;
}

// ============================================================
// Coaching Submissions (Teleport)
// ============================================================

/**
 * Get the current user's coaching submissions (as student or coach).
 */
export async function getMySubmissions(role?: 'student' | 'coach'): Promise<CoachingSubmission[]> {
  const { data, error } = await supabase.rpc('sv_get_my_submissions', {
    p_role: role ?? null,
  });
  if (error) {
    console.error('Failed to load submissions:', error);
    return [];
  }
  return (data ?? []) as CoachingSubmission[];
}

/**
 * Create a coaching submission (Teleport resources to coach).
 */
export async function createSubmission(
  coachId: string,
  title: string,
  studentNote?: string,
  priority: 'normal' | 'review_soon' | 'urgent' = 'normal',
  relationshipId?: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_create_submission', {
    p_coach_id: coachId,
    p_title: title,
    p_student_note: studentNote ?? null,
    p_priority: priority,
    p_relationship_id: relationshipId ?? null,
  });
  if (error) {
    console.error('Failed to create submission:', error);
    return null;
  }
  return data as string | null;
}

/**
 * Add a resource reference to a coaching submission.
 */
export async function addSubmissionItem(
  submissionId: string,
  resourceType: ResourceType,
  resourceId: string,
  note?: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_add_submission_item', {
    p_submission_id: submissionId,
    p_resource_type: resourceType,
    p_resource_id: resourceId,
    p_note: note ?? null,
  });
  if (error) {
    console.error('Failed to add submission item:', error);
    return null;
  }
  return data as string | null;
}

/**
 * Update a submission's status (coach only).
 */
export async function updateSubmissionStatus(
  submissionId: string,
  status: 'submitted' | 'awaiting_review' | 'in_review' | 'reviewed' | 'returned' | 'cancelled',
  coachFeedback?: string
): Promise<boolean> {
  const { error } = await supabase.rpc('sv_update_submission_status', {
    p_submission_id: submissionId,
    p_status: status,
    p_coach_feedback: coachFeedback ?? null,
  });
  if (error) {
    console.error('Failed to update submission status:', error);
    return false;
  }
  return true;
}

// ============================================================
// Audit
// ============================================================

/**
 * Record an audit event for the current user's action.
 */
export async function recordAuditEvent(
  action: string,
  resourceType?: string,
  resourceId?: string,
  targetUserId?: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase.rpc('sv_record_audit_event', {
    p_action: action,
    p_resource_type: resourceType ?? null,
    p_resource_id: resourceId ?? null,
    p_target_user_id: targetUserId ?? null,
    p_metadata: metadata,
  });
  if (error) {
    console.error('Failed to record audit event:', error);
  }
}

// ============================================================
// Role Requests
// ============================================================

export interface RoleRequest {
  id: string;
  user_id: string;
  role: RoleType;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  note: string | null;
  staff_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export async function requestRole(
  role: RoleType,
  note?: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_request_role', {
    p_role: role,
    p_note: note ?? null,
  });
  if (error) {
    console.error('Failed to request role:', error);
    return null;
  }
  return data as string | null;
}

export async function getMyRoleRequests(): Promise<RoleRequest[]> {
  const { data, error } = await supabase.rpc('sv_get_my_role_requests');
  if (error) {
    console.error('Failed to load role requests:', error);
    return [];
  }
  return (data ?? []) as RoleRequest[];
}

export async function getPendingRoleRequests(): Promise<RoleRequest[]> {
  const { data, error } = await supabase.rpc('sv_get_pending_role_requests');
  if (error) {
    console.error('Failed to load pending role requests:', error);
    return [];
  }
  return (data ?? []) as RoleRequest[];
}

export async function getAllRoleRequests(): Promise<RoleRequest[]> {
  const { data, error } = await supabase.rpc('sv_get_all_role_requests');
  if (error) {
    console.error('Failed to load role requests:', error);
    return [];
  }
  return (data ?? []) as RoleRequest[];
}

export async function reviewRoleRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
  staffNote?: string
): Promise<boolean> {
  const { error } = await supabase.rpc('sv_review_role_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_staff_note: staffNote ?? null,
  });
  if (error) {
    console.error('Failed to review role request:', error);
    return false;
  }
  return true;
}

export async function revokeRoleRequest(requestId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_revoke_role_request', {
    p_request_id: requestId,
  });
  if (error) {
    console.error('Failed to revoke role request:', error);
    return false;
  }
  return true;
}

// ============================================================
// Relationship Acceptance / Decline / Block
// ============================================================

export async function acceptRelationship(
  relationshipId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('sv_accept_relationship', {
    p_relationship_id: relationshipId,
  });
  if (error) {
    console.error('Failed to accept relationship:', error);
    return false;
  }
  return true;
}

export async function declineRelationship(
  relationshipId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('sv_decline_relationship', {
    p_relationship_id: relationshipId,
  });
  if (error) {
    console.error('Failed to decline relationship:', error);
    return false;
  }
  return true;
}

export async function blockRelationship(
  relationshipId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('sv_block_relationship', {
    p_relationship_id: relationshipId,
  });
  if (error) {
    console.error('Failed to block relationship:', error);
    return false;
  }
  return true;
}

export async function setPrimaryRelationship(
  relationshipId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('sv_set_primary_relationship', {
    p_relationship_id: relationshipId,
  });
  if (error) {
    console.error('Failed to set primary relationship:', error);
    return false;
  }
  return true;
}

export interface PendingRelationshipRequest {
  id: string;
  type: RelationshipType;
  user_a: string;
  user_b: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function getPendingRelationshipRequests(): Promise<PendingRelationshipRequest[]> {
  const { data, error } = await supabase.rpc('sv_get_pending_relationship_requests');
  if (error) {
    console.error('Failed to load pending relationship requests:', error);
    return [];
  }
  return (data ?? []) as PendingRelationshipRequest[];
}

// ============================================================
// Contacts (network_contact relationship type)
// ============================================================

export interface Contact {
  relationship_id: string;
  user_id: string;
  status: string;
  created_at: string;
}

export async function requestContact(targetUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_request_contact', {
    p_target_user_id: targetUserId,
  });
  if (error) {
    console.error('Failed to send contact request:', error);
    return null;
  }
  return data as string | null;
}

export async function acceptContact(relationshipId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_accept_contact', {
    p_relationship_id: relationshipId,
  });
  if (error) {
    console.error('Failed to accept contact:', error);
    return false;
  }
  return true;
}

export async function declineContact(relationshipId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_decline_contact', {
    p_relationship_id: relationshipId,
  });
  if (error) {
    console.error('Failed to decline contact:', error);
    return false;
  }
  return true;
}

export async function removeContact(relationshipId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_remove_contact', {
    p_relationship_id: relationshipId,
  });
  if (error) {
    console.error('Failed to remove contact:', error);
    return false;
  }
  return true;
}

export async function getMyContacts(): Promise<Contact[]> {
  const { data, error } = await supabase.rpc('sv_get_my_contacts');
  if (error) {
    console.error('Failed to load contacts:', error);
    return [];
  }
  return (data ?? []) as Contact[];
}

export async function getPendingContactRequests(): Promise<Array<{ relationship_id: string; requester_id: string; created_at: string }>> {
  const { data, error } = await supabase.rpc('sv_get_pending_contact_requests');
  if (error) {
    console.error('Failed to load pending contact requests:', error);
    return [];
  }
  return (data ?? []) as Array<{ relationship_id: string; requester_id: string; created_at: string }>;
}

// ============================================================
// General Feed Posting Permission
// ============================================================

export interface FeedPostingRequest {
  id: string;
  user_id: string;
  status: string;
  reason: string | null;
  category: string | null;
  profile_link: string | null;
  created_at: string;
  reviewed_at: string | null;
  staff_note: string | null;
}

export async function canPostGeneralFeed(): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_can_post_general_feed');
  if (error) {
    console.error('Failed to check feed posting permission:', error);
    return false;
  }
  return data as boolean;
}

export async function requestGeneralFeedPosting(
  reason: string,
  category?: string,
  profileLink?: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_request_general_feed_posting', {
    p_reason: reason,
    p_category: category ?? null,
    p_profile_link: profileLink ?? null,
  });
  if (error) {
    console.error('Failed to request feed posting:', error);
    return null;
  }
  return data as string | null;
}

export async function getMyFeedPostingRequests(): Promise<Array<{ id: string; status: string; reason: string | null; category: string | null; created_at: string; reviewed_at: string | null }>> {
  const { data, error } = await supabase.rpc('sv_get_my_feed_posting_requests');
  if (error) {
    console.error('Failed to load feed posting requests:', error);
    return [];
  }
  return (data ?? []) as Array<{ id: string; status: string; reason: string | null; category: string | null; created_at: string; reviewed_at: string | null }>;
}

export async function getPendingFeedPostingRequests(): Promise<FeedPostingRequest[]> {
  const { data, error } = await supabase.rpc('sv_get_pending_feed_posting_requests');
  if (error) {
    console.error('Failed to load pending feed posting requests:', error);
    return [];
  }
  return (data ?? []) as FeedPostingRequest[];
}

export async function getAllFeedPostingRequests(): Promise<FeedPostingRequest[]> {
  const { data, error } = await supabase.rpc('sv_get_all_feed_posting_requests');
  if (error) {
    console.error('Failed to load feed posting requests:', error);
    return [];
  }
  return (data ?? []) as FeedPostingRequest[];
}

export async function approveFeedPosting(requestId: string, staffNote?: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_approve_general_feed_posting', {
    p_request_id: requestId,
    p_staff_note: staffNote ?? null,
  });
  if (error) {
    console.error('Failed to approve feed posting:', error);
    return false;
  }
  return true;
}

export async function rejectFeedPosting(requestId: string, staffNote?: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_reject_general_feed_posting', {
    p_request_id: requestId,
    p_staff_note: staffNote ?? null,
  });
  if (error) {
    console.error('Failed to reject feed posting:', error);
    return false;
  }
  return true;
}

// Social Feed posting — requires active paid subscription OR staff/superuser
export async function canPostSocialFeed(userId?: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_can_post_community', {
    p_user_id: userId ?? null,
  });
  if (error) {
    console.error('Failed to check social feed posting permission:', error);
    return false;
  }
  return data as boolean;
}

// Info Feed posting — requires staff approval OR staff/superuser role
export async function canPostMainFeed(): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_can_post_network');
  if (error) {
    console.error('Failed to check Info Feed posting permission:', error);
    return false;
  }
  return data as boolean;
}

export async function grantNetworkPosting(targetUserId: string, category?: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_grant_network_posting', {
    p_target_user_id: targetUserId,
    p_category: category ?? null,
  });
  if (error) {
    console.error('Failed to grant network posting:', error);
    return false;
  }
  return data as boolean;
}

export async function revokeNetworkPosting(targetUserId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_revoke_network_posting', {
    p_target_user_id: targetUserId,
  });
  if (error) {
    console.error('Failed to revoke network posting:', error);
    return false;
  }
  return data as boolean;
}

export interface NetworkPostingApproval {
  user_id: string;
  status: string;
  category: string | null;
  granted_at: string;
  granted_by: string | null;
  revoked_at: string | null;
}

export async function getNetworkPostingApprovals(): Promise<NetworkPostingApproval[]> {
  const { data, error } = await supabase.rpc('sv_get_network_posting_approvals');
  if (error) {
    console.error('Failed to load network posting approvals:', error);
    return [];
  }
  return (data ?? []) as NetworkPostingApproval[];
}

export interface NetworkUserSearchResult {
  user_id: string;
  display_name: string;
  username: string;
  poker_role: string;
  is_approved: boolean;
  has_membership: boolean;
}

export async function searchUsersForNetworkApproval(query: string): Promise<NetworkUserSearchResult[]> {
  const { data, error } = await supabase.rpc('sv_search_users_for_network_approval', {
    p_query: query,
  });
  if (error) {
    console.error('Failed to search users:', error);
    return [];
  }
  return (data ?? []) as NetworkUserSearchResult[];
}

export async function revokeFeedPosting(requestId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_revoke_general_feed_posting', {
    p_request_id: requestId,
  });
  if (error) {
    console.error('Failed to revoke feed posting:', error);
    return false;
  }
  return true;
}
