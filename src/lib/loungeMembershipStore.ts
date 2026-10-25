import { supabase } from '@/lib/supabase';
import { ENTITLEMENTS, type MembershipTier } from '@/lib/entitlements';

export interface LoungeMembership {
  id: string;
  lounge_slug: string;
  status: string;
  joined_at: string;
  favorite: boolean;
  role?: string;
  is_default?: boolean;
}

export interface LoungeInfo {
  slug: string;
  name: string;
  type: string;
  access_mode?: string;
  discoverability?: string;
  region?: string | null;
  tags?: string[] | null;
  member_count?: number;
  description?: string | null;
  logo?: string | null;
}

export interface JoinRequest {
  id: string;
  user_id: string;
  lounge_slug: string;
  status: string;
  password_verified: boolean;
  created_at: string;
}

export interface RedeemResult {
  success: boolean;
  already_member?: boolean;
  lounge_slug?: string;
  lounge_name?: string;
  error?: string;
}

// ============================================================
// Memberships
// ============================================================

export async function fetchUserLoungeMemberships(userId: string): Promise<LoungeMembership[]> {
  const { data, error } = await supabase
    .from('lounge_memberships')
    .select('id, lounge_slug, status, joined_at, favorite, role, is_default')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .order('joined_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as LoungeMembership[];
}

export async function fetchAllLounges(): Promise<LoungeInfo[]> {
  const { data, error } = await supabase
    .from('lounge_configs')
    .select('slug, name, type, access_mode, discoverability, region, tags, member_count, description, logo')
    .eq('is_active', true)
    .order('name');
  if (error) return [];
  return (data ?? []) as LoungeInfo[];
}

export async function fetchDiscoverableLounges(): Promise<LoungeInfo[]> {
  const { data, error } = await supabase
    .from('lounge_configs')
    .select('slug, name, type, access_mode, discoverability, region, tags, member_count, description, logo')
    .eq('is_active', true)
    .eq('discoverability', 'public')
    .order('name');
  if (error) return [];
  return (data ?? []) as LoungeInfo[];
}

export async function canJoinLounge(userId: string, tier: MembershipTier): Promise<{ allowed: boolean; currentCount: number; limit: number; message: string | null }> {
  const entitlements = ENTITLEMENTS[tier];
  const memberships = await fetchUserLoungeMemberships(userId);
  const currentCount = memberships.length;
  const limit = entitlements.lounges;
  const allowed = currentCount < limit;
  const message = !allowed
    ? "You've reached your Lounge limit. Leave a Lounge or upgrade your membership."
    : null;
  return { allowed, currentCount, limit, message };
}

export async function joinLounge(slug: string, userId: string): Promise<RedeemResult> {
  const { error } = await supabase
    .from('lounge_memberships')
    .insert({ user_id: userId, lounge_slug: slug, status: 'active', role: 'member' });
  if (error) {
    if (error.code === '23505') {
      return { success: true, already_member: true, lounge_slug: slug };
    }
    return { success: false, error: error.message };
  }
  return { success: true, already_member: false, lounge_slug: slug };
}

export async function redeemLoungeCode(code: string, userId: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('sv_redeem_lounge_code', {
    p_code: code,
    p_user_id: userId,
  });
  if (error) return { success: false, error: error.message };
  return data as RedeemResult;
}

export async function fetchUserLoungeMembershipsForSlug(userId: string, slug: string): Promise<LoungeMembership | null> {
  const { data, error } = await supabase
    .from('lounge_memberships')
    .select('id, lounge_slug, status, joined_at, favorite, role, is_default')
    .eq('user_id', userId)
    .eq('lounge_slug', slug)
    .maybeSingle();
  if (error) return null;
  return data as LoungeMembership | null;
}

export function isLoungeOwner(memberships: LoungeMembership[], slug: string): boolean {
  return memberships.some((m) => m.lounge_slug === slug && (m.role === 'owner' || m.role === 'admin'));
}

export function isLoungeModerator(memberships: LoungeMembership[], slug: string): boolean {
  return memberships.some((m) => m.lounge_slug === slug && (m.role === 'owner' || m.role === 'admin' || m.role === 'moderator'));
}

export function getLoungeRole(memberships: LoungeMembership[], slug: string): string | null {
  const m = memberships.find((m) => m.lounge_slug === slug);
  return m?.role ?? null;
}

// ============================================================
// Default Lounge
// ============================================================

export async function setDefaultLounge(userId: string, loungeSlug: string): Promise<boolean> {
  // Clear all defaults for this user, then set the new one
  await supabase
    .from('lounge_memberships')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true);
  const { error } = await supabase
    .from('lounge_memberships')
    .update({ is_default: true })
    .eq('user_id', userId)
    .eq('lounge_slug', loungeSlug)
    .eq('status', 'active');
  return !error;
}

export async function getDefaultLounge(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('lounge_memberships')
    .select('lounge_slug')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('is_default', true)
    .maybeSingle();
  if (error || !data) {
    // Fallback to first membership
    const { data: firstData } = await supabase
      .from('lounge_memberships')
      .select('lounge_slug')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return firstData?.lounge_slug ?? null;
  }
  return data.lounge_slug;
}

// ============================================================
// Join Requests (for approval-based lounges)
// ============================================================

export async function submitJoinRequest(
  loungeSlug: string,
  userId: string,
  passwordVerified: boolean = false,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('lounge_join_requests')
    .upsert({
      user_id: userId,
      lounge_slug: loungeSlug,
      status: 'pending',
      password_verified: passwordVerified,
    }, { onConflict: 'user_id,lounge_slug' });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function fetchUserJoinRequests(userId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase
    .from('lounge_join_requests')
    .select('id, user_id, lounge_slug, status, password_verified, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as JoinRequest[];
}

export async function fetchPendingJoinRequests(loungeSlug: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase
    .from('lounge_join_requests')
    .select('id, user_id, lounge_slug, status, password_verified, created_at')
    .eq('lounge_slug', loungeSlug)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as JoinRequest[];
}

export async function approveJoinRequest(requestId: string, userId: string, loungeSlug: string, moderatorId: string): Promise<boolean> {
  // Update the request
  const { error: reqError } = await supabase
    .from('lounge_join_requests')
    .update({ status: 'approved', reviewed_by: moderatorId, reviewed_at: new Date().toISOString() })
    .eq('id', requestId);
  if (reqError) return false;
  // Create the membership
  const { error: memError } = await supabase
    .from('lounge_memberships')
    .insert({ user_id: userId, lounge_slug: loungeSlug, status: 'active', role: 'member', approved_by: moderatorId });
  if (memError && memError.code !== '23505') return false;
  return true;
}

export async function declineJoinRequest(requestId: string, moderatorId: string): Promise<boolean> {
  const { error } = await supabase
    .from('lounge_join_requests')
    .update({ status: 'declined', reviewed_by: moderatorId, reviewed_at: new Date().toISOString() })
    .eq('id', requestId);
  return !error;
}

// ============================================================
// Password Verification (via edge function)
// ============================================================

export async function verifyLoungePassword(loungeSlug: string, password: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('lounge-verify-password', {
      body: { loungeSlug, password },
    });
    if (error) return { valid: false, error: 'Password verification failed.' };
    return data as { valid: boolean; error?: string };
  } catch {
    return { valid: false, error: 'Password verification failed.' };
  }
}

// ============================================================
// Lounge Management (for owners/admins)
// ============================================================

export async function updateLoungeAccessMode(slug: string, accessMode: string): Promise<boolean> {
  const { error } = await supabase
    .from('lounge_configs')
    .update({ access_mode: accessMode })
    .eq('slug', slug);
  return !error;
}

export async function updateLoungePassword(slug: string, password: string): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('lounge-set-password', {
      body: { loungeSlug: slug, password },
    });
    return !error;
  } catch {
    return false;
  }
}

export async function updateLoungeDiscoverability(slug: string, discoverability: string): Promise<boolean> {
  const { error } = await supabase
    .from('lounge_configs')
    .update({ discoverability })
    .eq('slug', slug);
  return !error;
}

export async function updateMemberRole(loungeSlug: string, userId: string, newRole: string): Promise<boolean> {
  const { error } = await supabase
    .from('lounge_memberships')
    .update({ role: newRole })
    .eq('lounge_slug', loungeSlug)
    .eq('user_id', userId);
  return !error;
}

export async function removeLoungeMember(loungeSlug: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('lounge_memberships')
    .delete()
    .eq('lounge_slug', loungeSlug)
    .eq('user_id', userId);
  return !error;
}

export async function fetchLoungeMembers(loungeSlug: string): Promise<{ user_id: string; role: string; status: string; joined_at: string }[]> {
  const { data, error } = await supabase
    .from('lounge_memberships')
    .select('user_id, role, status, joined_at')
    .eq('lounge_slug', loungeSlug)
    .order('joined_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as { user_id: string; role: string; status: string; joined_at: string }[];
}

export async function logModerationAction(
  loungeSlug: string,
  moderatorId: string,
  action: string,
  targetUserId?: string,
  targetId?: string,
  reason?: string,
): Promise<void> {
  await supabase.from('lounge_moderation_logs').insert({
    lounge_slug: loungeSlug,
    moderator_id: moderatorId,
    action,
    target_user_id: targetUserId ?? null,
    target_type: action.includes('post') ? 'post' : action.includes('comment') ? 'comment' : 'member',
    target_id: targetId ?? null,
    reason: reason ?? null,
  });
}

// ============================================================
// Onboarding
// ============================================================

const LOUNGE_ONBOARDING_KEY = 'lounge-onboarding-dismissed';

export function isLoungeOnboardingDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${LOUNGE_ONBOARDING_KEY}-${userId}`) === '1';
  } catch {
    return false;
  }
}

export function dismissLoungeOnboarding(userId: string): void {
  try {
    localStorage.setItem(`${LOUNGE_ONBOARDING_KEY}-${userId}`, '1');
  } catch { /* noop */ }
}
