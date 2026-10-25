import { supabase } from '@/lib/supabase';

export interface UserGroupAttribution {
  attribution_id: string;
  group_code: string;
  p1_code: string;
  p2_code: string;
  deal_code: string | null;
  acquisition_code: string | null;
  status: string;
}

/**
 * Auto-create an attribution record for the current user based on an
 * acquisition code (defaults to 'SK' for StakeKings).
 * Does NOT overwrite existing attribution — safe for existing users.
 * Returns the attribution_id, or null if it failed.
 */
export async function acquireUserAttribution(
  acquisitionCode = 'SK',
): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_acquire_user_attribution', {
    p_acquisition_code: acquisitionCode,
  });
  if (error) {
    console.error('acquireUserAttribution:', error);
    return null;
  }
  return data as string | null;
}

/**
 * Fetch the current user's primary group attribution.
 * Returns the first active attribution row, prioritizing non-'0' group codes.
 * Returns null if not authenticated or no attribution exists.
 */
export async function getUserGroupAttribution(): Promise<UserGroupAttribution | null> {
  const { data, error } = await supabase.rpc('sv_get_user_group_attribution');
  if (error) {
    console.error('getUserGroupAttribution:', error);
    return null;
  }
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as UserGroupAttribution;
}

/**
 * Check if the current user has StakeKings (GROUP=SK) attribution.
 */
export async function isStakeKingsUser(): Promise<boolean> {
  const attr = await getUserGroupAttribution();
  if (!attr) return false;
  return attr.group_code === 'SK';
}

// ── SK Entry Route Detection ────────────────────────────────────

const SK_ENTRY_KEY = 'spotvault-sk-entry';

/**
 * Detect if the user entered through the /sk route.
 * Checks both the URL path and a sessionStorage flag set by the /sk route handler.
 * Also stores the entry flag in sessionStorage so it survives the signup flow.
 */
export function detectSKEntry(): boolean {
  if (typeof window === 'undefined') return false;

  // Check URL path
  const path = window.location.pathname;
  if (path === '/sk' || path === '/sk/') {
    markSKEntry();
    return true;
  }

  // Check sessionStorage (set by /sk route or a previous detect)
  try {
    return sessionStorage.getItem(SK_ENTRY_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark that the user entered through the SK route.
 * Stored in sessionStorage so it survives redirects but doesn't persist
 * across sessions (unlike localStorage).
 */
export function markSKEntry(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SK_ENTRY_KEY, 'true');
  } catch { /* ignore */ }
}

/**
 * Clear the SK entry flag. Called after attribution has been applied
 * or after the signup flow completes.
 */
export function clearSKEntry(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SK_ENTRY_KEY);
  } catch { /* ignore */ }
}

/**
 * Check if the SK entry flag is currently set.
 */
export function hasSKEntryFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SK_ENTRY_KEY) === 'true';
  } catch {
    return false;
  }
}
