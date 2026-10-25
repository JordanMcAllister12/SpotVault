import { supabase } from '@/lib/supabase';

export interface StaffTag {
  id: string;
  title: string;
  bg_color: string;
  text_color: string;
  border_color: string | null;
  icon: string | null;
  scope: 'spotvault' | 'stakekings' | 'shared';
  is_active: boolean;
  is_system: boolean;
}

export interface StaffInvitation {
  id: string;
  email: string;
  full_name: string;
  username: string | null;
  organization: 'spotvault' | 'stakekings';
  status: 'pending' | 'consumed' | 'expired';
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface EnhancedStaffEntry {
  user_id: string;
  display_name: string;
  username: string;
  email: string;
  sv_user_id: string;
  role: string;
  staff_title: string;
  organization: 'spotvault' | 'stakekings';
  status: string;
  badge_text: string;
  badge_color: string;
  badge_text_color: string;
  badge_icon: string | null;
}

export interface StaffPermissions {
  solver: boolean;
  analytics: boolean;
  chat: boolean;
  main_board: boolean;
}

let tagCache: StaffTag[] | null = null;
const tagListeners = new Set<() => void>();

export function subscribeStaffTags(cb: () => void): () => void {
  tagListeners.add(cb);
  return () => tagListeners.delete(cb);
}

function notifyTagListeners() {
  tagListeners.forEach((cb) => cb());
}

export async function fetchStaffTags(): Promise<StaffTag[]> {
  const { data, error } = await supabase.rpc('sv_get_staff_tags');
  if (error) {
    console.error('[staffAccountStore] fetchStaffTags:', error);
    return [];
  }
  tagCache = (data as StaffTag[]) ?? [];
  notifyTagListeners();
  return tagCache;
}

export function getCachedStaffTags(): StaffTag[] | null {
  return tagCache;
}

export async function createStaffTag(
  title: string, bgColor: string, textColor: string,
  borderColor: string | null, icon: string | null, scope: StaffTag['scope'],
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_create_staff_tag', {
    p_title: title, p_bg_color: bgColor, p_text_color: textColor,
    p_border_color: borderColor, p_icon: icon, p_scope: scope,
  });
  if (error) return { error: error.message };
  await fetchStaffTags();
  return { error: null };
}

export async function updateStaffTag(
  tagId: string, title: string, bgColor: string, textColor: string,
  borderColor: string | null, icon: string | null, scope: StaffTag['scope'], isActive: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_update_staff_tag', {
    p_tag_id: tagId, p_title: title, p_bg_color: bgColor, p_text_color: textColor,
    p_border_color: borderColor, p_icon: icon, p_scope: scope, p_is_active: isActive,
  });
  if (error) return { error: error.message };
  await fetchStaffTags();
  return { error: null };
}

export async function deleteStaffTag(tagId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_delete_staff_tag', { p_tag_id: tagId });
  if (error) return { error: error.message };
  await fetchStaffTags();
  return { error: null };
}

export async function assignStaffTag(userId: string, tagId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_assign_staff_tag', { p_user_id: userId, p_tag_id: tagId });
  if (error) return { error: error.message };
  return { error: null };
}

export async function removeStaffTag(userId: string, tagId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_remove_staff_tag', { p_user_id: userId, p_tag_id: tagId });
  if (error) return { error: error.message };
  return { error: null };
}

export async function fetchUserStaffTags(userId: string): Promise<StaffTag[]> {
  const { data, error } = await supabase.rpc('sv_get_user_staff_tags', { p_user_id: userId });
  if (error) return [];
  return (data as StaffTag[]) ?? [];
}

export async function setStaffOrganization(userId: string, org: 'spotvault' | 'stakekings'): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_set_staff_organization', { p_user_id: userId, p_organization: org });
  if (error) return { error: error.message };
  return { error: null };
}

export async function getMyStaffOrganization(): Promise<'spotvault' | 'stakekings' | null> {
  const { data } = await supabase.rpc('sv_get_my_staff_organization');
  return (data as 'spotvault' | 'stakekings' | null) ?? null;
}

export async function fetchEnhancedStaffDirectory(): Promise<EnhancedStaffEntry[]> {
  const { data, error } = await supabase.rpc('sv_get_enhanced_staff_directory');
  if (error) {
    console.error('[staffAccountStore] fetchEnhancedStaffDirectory:', error);
    return [];
  }
  return (data as EnhancedStaffEntry[]) ?? [];
}

export async function createStaffInvitation(
  email: string, fullName: string, username: string,
  organization: 'spotvault' | 'stakekings', tagId: string | null,
  permissions: StaffPermissions,
): Promise<{ token: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('sv_create_staff_invitation', {
    p_email: email, p_full_name: fullName, p_username: username,
    p_organization: organization, p_tag_id: tagId,
    p_permissions: permissions,
  });
  if (error) {
    const msg = error.message;
    if (msg.includes('EMAIL_EXISTS')) return { token: null, error: 'An account with this email already exists. Use the promote flow instead.' };
    return { token: null, error: msg };
  }
  return { token: data as string, error: null };
}

export async function listStaffInvitations(): Promise<StaffInvitation[]> {
  const { data, error } = await supabase.rpc('sv_list_staff_invitations');
  if (error) return [];
  return (data as StaffInvitation[]) ?? [];
}

export async function resendStaffInvitation(invitationId: string): Promise<{ token: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('sv_resend_staff_invitation', { p_invitation_id: invitationId });
  if (error) return { token: null, error: error.message };
  return { token: data as string, error: null };
}

export async function revokeStaffInvitation(invitationId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_revoke_staff_invitation', { p_invitation_id: invitationId });
  if (error) return { error: error.message };
  return { error: null };
}

export async function suspendStaff(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_suspend_staff', { p_user_id: userId });
  if (error) return { error: error.message };
  return { error: null };
}

export async function reactivateStaff(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_reactivate_staff', { p_user_id: userId });
  if (error) return { error: error.message };
  return { error: null };
}
