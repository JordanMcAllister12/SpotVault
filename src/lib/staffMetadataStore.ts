import { supabase } from '@/lib/supabase';

export interface StaffMetadata {
  user_id: string;
  staff_title: string;
  badge_text: string;
  badge_color: string;
  badge_text_color: string;
  badge_icon: string | null;
  svi_badge_prefs?: SviBadgePrefs | null;
}

export interface SviBadgePrefs {
  selectedDisplay: 'player' | 'rank' | 'badge' | 'title';
  badgeBg?: string;
  badgeText?: string;
  badgeStyle?: number;
}

export interface StaffDirectoryEntry {
  user_id: string;
  display_name: string;
  username: string;
  email: string;
  sv_user_id: string;
  role: string;
  staff_title: string;
  badge_text: string;
  badge_color: string;
  badge_text_color: string;
  badge_icon: string | null;
  status: string;
}

const metadataCache = new Map<string, StaffMetadata | null>();
const listeners = new Set<() => void>();

export function subscribeStaffMetadata(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

export async function fetchStaffMetadata(userId: string): Promise<StaffMetadata | null> {
  if (metadataCache.has(userId)) return metadataCache.get(userId) ?? null;
  const { data } = await supabase
    .from('sv_staff_metadata')
    .select('user_id, staff_title, badge_text, badge_color, badge_text_color, badge_icon, svi_badge_prefs')
    .eq('user_id', userId)
    .maybeSingle();
  const result = (data as StaffMetadata | null) ?? null;
  metadataCache.set(userId, result);
  return result;
}

export function getCachedStaffMetadata(userId: string): StaffMetadata | null {
  return metadataCache.get(userId) ?? null;
}

export async function refreshStaffMetadata(userId: string): Promise<void> {
  metadataCache.delete(userId);
  await fetchStaffMetadata(userId);
  notifyListeners();
}

export async function setStaffMetadata(
  userId: string,
  staffTitle: string,
  badgeText: string,
  badgeColor: string,
  badgeTextColor: string,
  badgeIcon: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_set_staff_metadata', {
    p_user_id: userId,
    p_staff_title: staffTitle,
    p_badge_text: badgeText,
    p_badge_color: badgeColor,
    p_badge_text_color: badgeTextColor,
    p_badge_icon: badgeIcon,
  });
  if (error) return { error: error.message };
  metadataCache.delete(userId);
  await fetchStaffMetadata(userId);
  notifyListeners();
  return { error: null };
}

export async function setSviBadgePrefs(
  userId: string,
  prefs: SviBadgePrefs,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_set_svi_badge_prefs', {
    p_prefs: prefs,
  });
  if (error) return { error: error.message };
  metadataCache.delete(userId);
  await fetchStaffMetadata(userId);
  notifyListeners();
  return { error: null };
}

export async function promoteStaff(userId: string, staffTitle: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_admin_grant_role', {
    p_target_id: userId,
    p_role: 'staff',
    p_action: 'grant',
  });
  if (error) return { error: error.message };
  const metadataResult = await setStaffMetadata(userId, staffTitle, '', '#d4a52c', '#0a0908', null);
  if (metadataResult.error) return metadataResult;
  metadataCache.delete(userId);
  await fetchStaffMetadata(userId);
  notifyListeners();
  return { error: null };
}

export async function demoteStaff(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_admin_grant_role', {
    p_target_id: userId,
    p_role: 'staff',
    p_action: 'revoke',
  });
  if (error) return { error: error.message };
  metadataCache.delete(userId);
  notifyListeners();
  return { error: null };
}

export async function promoteSuperUser(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_admin_grant_role', {
    p_target_id: userId,
    p_role: 'superuser',
    p_action: 'grant',
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function demoteSuperUser(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('sv_admin_grant_role', {
    p_target_id: userId,
    p_role: 'superuser',
    p_action: 'revoke',
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function fetchStaffDirectory(): Promise<StaffDirectoryEntry[]> {
  const { data, error } = await supabase.rpc('sv_get_staff_directory');
  if (error) {
    console.error('[staffMetadataStore] fetchStaffDirectory error:', error);
    return [];
  }
  return (data as StaffDirectoryEntry[]) ?? [];
}

export async function searchUsersForStaff(query: string): Promise<StaffDirectoryEntry[]> {
  const { data, error } = await supabase.rpc('sv_staff_get_accounts', {
    p_search: query,
    p_sort: 'alpha_az',
    p_limit: 10,
    p_offset: 0,
  });
  if (error) return [];
  const accounts = data as Array<{
    user_id: string;
    display_name: string;
    username: string;
    email: string;
    sv_user_id: string;
    role: string;
    membership_tier: string;
    primary_role: string;
    status: string;
  }>;

  const results: StaffDirectoryEntry[] = [];
  for (const acc of accounts) {
    const meta = await fetchStaffMetadata(acc.user_id);
    results.push({
      user_id: acc.user_id,
      display_name: acc.display_name,
      username: acc.username,
      email: acc.email,
      sv_user_id: acc.sv_user_id,
      role: acc.role,
      staff_title: meta?.staff_title ?? '',
      badge_text: meta?.badge_text ?? '',
      badge_color: meta?.badge_color ?? '#d4a52c',
      badge_text_color: meta?.badge_text_color ?? '#0a0908',
      badge_icon: meta?.badge_icon ?? null,
      status: acc.status,
    });
  }
  return results;
}
