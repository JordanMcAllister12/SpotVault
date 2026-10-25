import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────

export interface AccessControlUser {
  user_id: string;
  display_name: string;
  username: string;
  email: string;
  primary_role: string;
  account_status: string;
  has_feed_posting: boolean;
  has_network_posting: boolean;
  has_creator_video: boolean;
  has_creator_multispot: boolean;
  has_stakekings: boolean;
  has_stakekings_manager: boolean;
  is_booking_provider: boolean;
  is_verified: boolean;
}

export interface UserRoleEntry {
  role: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface PortalEntry {
  portal_type: string;
  status: string;
  expires_at: string | null;
}

export interface CapabilityEntry {
  capability: string;
  status: string;
  granted_by: string | null;
  granted_at: string | null;
}

export interface CreatorPermEntry {
  can_publish_video_spots: boolean;
  can_create_multispot: boolean;
  granted_at: string | null;
}

export interface PartnerEntry {
  partner_slug: string;
  status: string;
  verified: boolean;
  entitlement_active: boolean;
  stakekings_role: string | null;
  joined_at: string | null;
  verified_at: string | null;
}

export interface BookingEntry {
  id: string;
  status: string;
  categories: string[] | null;
  approved_at: string | null;
  revoked_at: string | null;
}

export interface CommunityEntry {
  tier: string;
  is_paid_member: boolean;
  member_since: string | null;
  privileges: Record<string, boolean> | null;
  priority_weight: number | null;
}

export interface EntitlementEntry {
  id: string;
  entitlement_type: string;
  reference_id: string | null;
  expires_at: string | null;
}

export interface UserProfileEntry {
  display_name: string;
  username: string;
  email: string;
  avatar_url: string | null;
  poker_role: string | null;
  created_at: string | null;
  account_status: string;
}

export interface ToolEntry {
  key: string;
  label: string;
  status: string;
  source: string;
}

export interface UserPermissionMatrix {
  profile: UserProfileEntry;
  roles: UserRoleEntry[];
  portals: PortalEntry[];
  capabilities: CapabilityEntry[];
  feed_posting: Array<{ id: string; status: string; category: string | null; created_at: string; reviewed_at: string | null }>;
  network_posting: Array<{ id: string; status: string; category: string | null; granted_at: string | null }>;
  creator_permissions: CreatorPermEntry;
  creator_applications: Array<{ id: string; application_type: string; status: string; created_at: string; reviewed_at: string | null }>;
  partner: PartnerEntry[];
  booking_provider: BookingEntry[];
  community: CommunityEntry;
  entitlements: EntitlementEntry[];
  tools: ToolEntry[];
}

export interface AuditLogEntry {
  id: string;
  target_user_id: string;
  target_user_name: string | null;
  permission_key: string;
  permission_label: string | null;
  previous_state: string | null;
  new_state: string | null;
  actor_id: string;
  actor_name: string | null;
  note: string | null;
  created_at: string;
}

// ── API ───────────────────────────────────────────────────────────

export async function searchUsersForAccessControl(query: string): Promise<AccessControlUser[]> {
  const { data, error } = await supabase.rpc('sv_staff_search_users_access', {
    p_query: query || null,
    p_limit: 50,
  });
  if (error) throw error;
  return (data as AccessControlUser[]) ?? [];
}

export async function getUserPermissions(userId: string): Promise<UserPermissionMatrix | null> {
  const { data, error } = await supabase.rpc('sv_staff_get_user_permissions', {
    p_user_id: userId,
  });
  if (error) throw error;
  return (data as UserPermissionMatrix) ?? null;
}

export async function getPermissionAuditLog(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase.rpc('sv_staff_get_permission_audit_log', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return (data as AuditLogEntry[]) ?? [];
}

// ── Permission change wrappers (call existing functions + record audit) ──

export async function grantNetworkPostingWithAudit(
  targetUserId: string,
  targetUserName: string,
  staffId: string,
  staffName: string,
): Promise<boolean> {
  const { error } = await supabase.rpc('sv_grant_network_posting', { p_target_user_id: targetUserId });
  if (error) throw error;
  await recordAudit(targetUserId, targetUserName, 'network_posting', 'Not Granted', 'Granted', 'Info Feed Posting', staffId, staffName);
  return true;
}

export async function revokeNetworkPostingWithAudit(
  targetUserId: string,
  targetUserName: string,
  staffId: string,
  staffName: string,
): Promise<boolean> {
  const { error } = await supabase.rpc('sv_revoke_network_posting', { p_target_user_id: targetUserId });
  if (error) throw error;
  await recordAudit(targetUserId, targetUserName, 'network_posting', 'Granted', 'Not Granted', 'Info Feed Posting', staffId, staffName);
  return true;
}

export async function grantStakeKingsManagerWithAudit(
  targetUserId: string,
  targetUserName: string,
  staffId: string,
  staffName: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('sv_grant_stakekings_manager', { p_user_id: targetUserId });
  if (error) return { ok: false, error: error.message };
  await recordAudit(targetUserId, targetUserName, 'stakekings_manager', 'Not Granted', 'Granted', 'StakeKings Manager', staffId, staffName);
  return { ok: true };
}

export async function revokeStakeKingsManagerWithAudit(
  targetUserId: string,
  targetUserName: string,
  staffId: string,
  staffName: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('sv_revoke_stakekings_manager', { p_user_id: targetUserId });
  if (error) return { ok: false, error: error.message };
  await recordAudit(targetUserId, targetUserName, 'stakekings_manager', 'Granted', 'Not Granted', 'StakeKings Manager', staffId, staffName);
  return { ok: true };
}

export async function grantStakeKingsAccessWithAudit(
  targetUserId: string,
  targetUserName: string,
  staffId: string,
  staffName: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('sv_grant_partner_hub_access', {
    p_user_id: targetUserId,
    p_partner_slug: 'stakekings',
  });
  if (error) return { ok: false, error: error.message };
  await recordAudit(targetUserId, targetUserName, 'stakekings_access', 'Not Granted', 'Granted', 'StakeKings Portal Access', staffId, staffName);
  return { ok: true };
}

export async function revokeStakeKingsAccessWithAudit(
  targetUserId: string,
  targetUserName: string,
  staffId: string,
  staffName: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('sv_revoke_partner_hub_access', {
    p_user_id: targetUserId,
    p_partner_slug: 'stakekings',
  });
  if (error) return { ok: false, error: error.message };
  await recordAudit(targetUserId, targetUserName, 'stakekings_access', 'Granted', 'Not Granted', 'StakeKings Portal Access', staffId, staffName);
  return { ok: true };
}

// ── Internal audit recorder ──────────────────────────────────────

async function recordAudit(
  targetUserId: string,
  targetUserName: string,
  permissionKey: string,
  prevState: string,
  newState: string,
  label: string,
  _staffId: string,
  _staffName: string,
): Promise<void> {
  const { error } = await supabase.rpc('sv_record_permission_audit', {
    p_target_user_id: targetUserId,
    p_permission_key: permissionKey,
    p_previous_state: prevState,
    p_new_state: newState,
    p_permission_label: label,
    p_note: null,
  });
  if (error) console.error('[AccessControl] Failed to record audit:', error.message);
}
