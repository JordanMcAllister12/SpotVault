import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────

/**
 * Resolve the real Supabase auth UID from the current session.
 * The app uses local account IDs (e.g. "acc-jordan") for its own state,
 * but partner_attributions.user_id is a UUID referencing auth.users.
 * RLS policies check auth.uid() against user_id, so we must use the real UID.
 */
async function resolveAuthUid(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export type PartnerSlug = 'stakekings';

export type AcquisitionSource = 'referral_link' | 'manual_code' | 'admin_grant';

export type AttributionStatus = 'pending' | 'verified' | 'active' | 'inactive' | 'revoked';

export type StakeKingsRole = 'player' | 'manager';

export interface StakeKingsAccessInfo {
  role: StakeKingsRole;
  testOverride: boolean;
}

export interface PartnerAttribution {
  id: string;
  user_id: string;
  partner_slug: string;
  status: AttributionStatus;
  referral_code: string | null;
  acquisition_source: AcquisitionSource | null;
  verified: boolean;
  entitlement_active: boolean;
  stakekings_role: StakeKingsRole | null;
  stakekings_test_override: boolean | null;
  stakekings_player_background: string | null;
  stakekings_manager_background: string | null;
  joined_at: string | null;
  verified_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ReferralCode {
  id: string;
  partner_slug: string;
  code: string;
  label: string | null;
  max_uses: number | null;
  use_count: number;
  active: boolean;
  expires_at: string | null;
}

export interface ReferralLink {
  id: string;
  partner_slug: string;
  link_token: string;
  label: string | null;
  max_uses: number | null;
  use_count: number;
  active: boolean;
  expires_at: string | null;
}

// ── Attribution CRUD ────────────────────────────────────────────

export async function getAttribution(_userId: string, partnerSlug: PartnerSlug): Promise<PartnerAttribution | null> {
  const uid = await resolveAuthUid();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('partner_attributions')
    .select('*')
    .eq('user_id', uid)
    .eq('partner_slug', partnerSlug)
    .maybeSingle();
  if (error) { console.error('getAttribution:', error); return null; }
  return data as unknown as PartnerAttribution | null;
}

export async function verifyWithCode(
  _userId: string,
  partnerSlug: PartnerSlug,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const uid = await resolveAuthUid();
  if (!uid) return { ok: false, error: 'Not signed in.' };

  // 1. Check the code is valid
  const { data: codeRecord, error: codeError } = await supabase
    .from('partner_referral_codes')
    .select('*')
    .eq('code', code)
    .eq('partner_slug', partnerSlug)
    .eq('active', true)
    .maybeSingle();

  if (codeError || !codeRecord) {
    return { ok: false, error: 'Invalid or expired access code.' };
  }

  const refCode = codeRecord as unknown as ReferralCode;
  if (refCode.expires_at && new Date(refCode.expires_at) < new Date()) {
    return { ok: false, error: 'This access code has expired.' };
  }
  if (refCode.max_uses !== null && refCode.use_count >= refCode.max_uses) {
    return { ok: false, error: 'This access code has reached its usage limit.' };
  }

  // 2. Increment the use count via RPC
  const { error: incrementError } = await supabase.rpc('increment_referral_code_use', { p_code: code });
  if (incrementError) {
    console.error('increment_referral_code_use:', incrementError);
  }

  // 3. Upsert the attribution
  const { error: upsertError } = await supabase
    .from('partner_attributions')
    .upsert({
      user_id: uid,
      partner_slug: partnerSlug,
      status: 'active',
      referral_code: code,
      acquisition_source: 'manual_code',
      verified: true,
      entitlement_active: true,
      joined_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
    }, { onConflict: 'user_id,partner_slug' });

  if (upsertError) {
    console.error('verifyWithCode upsert:', upsertError);
    return { ok: false, error: 'Could not save partner access. Please try again.' };
  }

  return { ok: true };
}

export async function verifyWithReferralLink(
  _userId: string,
  partnerSlug: PartnerSlug,
  linkToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const uid = await resolveAuthUid();
  if (!uid) return { ok: false, error: 'Not signed in.' };

  // 1. Check the link is valid
  const { data: linkRecord, error: linkError } = await supabase
    .from('partner_referral_links')
    .select('*')
    .eq('link_token', linkToken)
    .eq('partner_slug', partnerSlug)
    .eq('active', true)
    .maybeSingle();

  if (linkError || !linkRecord) {
    return { ok: false, error: 'Invalid or expired referral link.' };
  }

  const refLink = linkRecord as unknown as ReferralLink;
  if (refLink.expires_at && new Date(refLink.expires_at) < new Date()) {
    return { ok: false, error: 'This referral link has expired.' };
  }
  if (refLink.max_uses !== null && refLink.use_count >= refLink.max_uses) {
    return { ok: false, error: 'This referral link has reached its usage limit.' };
  }

  // 2. Increment the use count
  const { error: incrementError } = await supabase.rpc('increment_referral_link_use', { p_token: linkToken });
  if (incrementError) {
    console.error('increment_referral_link_use:', incrementError);
  }

  // 3. Upsert the attribution
  const { error: upsertError } = await supabase
    .from('partner_attributions')
    .upsert({
      user_id: uid,
      partner_slug: partnerSlug,
      status: 'active',
      acquisition_source: 'referral_link',
      verified: true,
      entitlement_active: true,
      joined_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
    }, { onConflict: 'user_id,partner_slug' });

  if (upsertError) {
    console.error('verifyWithReferralLink upsert:', upsertError);
    return { ok: false, error: 'Could not save partner access. Please try again.' };
  }

  return { ok: true };
}

export async function checkPartnerAccess(userId: string, partnerSlug: PartnerSlug): Promise<boolean> {
  const attribution = await getAttribution(userId, partnerSlug);
  if (!attribution) return false;
  return attribution.verified && attribution.entitlement_active;
}

export async function getStakeKingsRole(userId: string): Promise<StakeKingsRole> {
  const attribution = await getAttribution(userId, 'stakekings');
  if (!attribution || !attribution.verified || !attribution.entitlement_active) return 'player';
  return attribution.stakekings_role ?? 'player';
}

export async function getStakeKingsAccessInfo(userId: string): Promise<StakeKingsAccessInfo> {
  const attribution = await getAttribution(userId, 'stakekings');
  if (!attribution || !attribution.verified || !attribution.entitlement_active) {
    return { role: 'player', testOverride: false };
  }
  return {
    role: attribution.stakekings_role ?? 'player',
    testOverride: attribution.stakekings_test_override ?? false,
  };
}

// ── Referral Link Parsing ───────────────────────────────────────

export function parseReferralTokenFromURL(): { partner: PartnerSlug; token: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const partner = params.get('partner') as PartnerSlug | null;
  const token = params.get('ref') ?? params.get('referral');
  if (partner && token) return { partner, token };
  return null;
}

export function storePendingReferral(partner: PartnerSlug, token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('spotvault-pending-referral', JSON.stringify({ partner, token, ts: Date.now() }));
  } catch { /* ignore */ }
}

export function getPendingReferral(): { partner: PartnerSlug; token: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('spotvault-pending-referral');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { partner: PartnerSlug; token: string; ts: number };
    // Expire after 24 hours
    if (Date.now() - parsed.ts > 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem('spotvault-pending-referral');
      return null;
    }
    return { partner: parsed.partner, token: parsed.token };
  } catch {
    return null;
  }
}

export function clearPendingReferral(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('spotvault-pending-referral');
  } catch { /* ignore */ }
}

// ── Staff Management (SECURITY DEFINER functions) ──────────────

export interface StaffUserSearchResult {
  user_id: string;
  email: string;
  username: string | null;
  display_name: string | null;
}

export interface StakeKingsManager {
  user_id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  stakekings_role: string;
  stakekings_test_override: boolean;
  granted_at: string | null;
}

export async function staffSearchUserByUsername(username: string): Promise<StaffUserSearchResult[]> {
  const { data, error } = await supabase.rpc('sv_staff_search_user_by_username', { p_username: username });
  if (error) { console.error('staffSearchUserByUsername:', error); return []; }
  return (data as StaffUserSearchResult[]) ?? [];
}

export async function staffGrantStakeKingsManager(userId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('sv_grant_stakekings_manager', { p_user_id: userId });
  if (error) { console.error('staffGrantStakeKingsManager:', error); return { ok: false, error: error.message }; }
  return { ok: true };
}

export async function staffRevokeStakeKingsManager(userId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('sv_revoke_stakekings_manager', { p_user_id: userId });
  if (error) { console.error('staffRevokeStakeKingsManager:', error); return { ok: false, error: error.message }; }
  return { ok: true };
}

export async function staffListStakeKingsManagers(): Promise<StakeKingsManager[]> {
  const { data, error } = await supabase.rpc('sv_list_stakekings_managers');
  if (error) { console.error('staffListStakeKingsManagers:', error); return []; }
  return (data as StakeKingsManager[]) ?? [];
}

// ── Generic Partner Access Code System (signup-time) ────────────

export interface ResolvedAccessCode {
  partner_slug: string;
  partner_affiliation: string;
  hub_access: Record<string, boolean>;
  entitlements: Record<string, unknown>;
}

export async function resolveAccessCode(code: string): Promise<ResolvedAccessCode | null> {
  const { data, error } = await supabase.rpc('sv_resolve_access_code', { p_code: code });
  if (error) { console.error('resolveAccessCode:', error); return null; }
  if (!data) return null;
  return data as unknown as ResolvedAccessCode;
}

// ── Partner Hub Access (runtime check) ──────────────────────────

export async function checkHubAccess(partnerSlug: string): Promise<boolean> {
  const uid = await resolveAuthUid();
  if (!uid) return false;
  const { data, error } = await supabase
    .from('partner_hub_access')
    .select('access_granted')
    .eq('user_id', uid)
    .eq('partner_slug', partnerSlug)
    .maybeSingle();
  if (error) { console.error('checkHubAccess:', error); return false; }
  return data?.access_granted ?? false;
}

// ── Admin Partner Management (generic) ─────────────────────────

export async function staffGrantPartnerHubAccess(userId: string, partnerSlug: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('sv_grant_partner_hub_access', {
    p_user_id: userId,
    p_partner_slug: partnerSlug,
    p_reason: reason ?? null,
  });
  if (error) { console.error('staffGrantPartnerHubAccess:', error); return { ok: false, error: error.message }; }
  const result = data as { ok: boolean; error?: string };
  return result;
}

export async function staffRevokePartnerHubAccess(userId: string, partnerSlug: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('sv_revoke_partner_hub_access', {
    p_user_id: userId,
    p_partner_slug: partnerSlug,
    p_reason: reason ?? null,
  });
  if (error) { console.error('staffRevokePartnerHubAccess:', error); return { ok: false, error: error.message }; }
  const result = data as { ok: boolean; error?: string };
  return result;
}

export async function staffCorrectAcquisitionSource(userId: string, partnerSlug: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('sv_correct_acquisition_source', {
    p_user_id: userId,
    p_partner_slug: partnerSlug,
    p_reason: reason ?? null,
  });
  if (error) { console.error('staffCorrectAcquisitionSource:', error); return { ok: false, error: error.message }; }
  const result = data as { ok: boolean; error?: string };
  return result;
}

export interface PartnerProfile {
  attributions: {
    partner_slug: string;
    status: string;
    acquisition_source: string | null;
    verified: boolean;
    entitlement_active: boolean;
    stakekings_role: string | null;
    joined_at: string | null;
    created_at: string;
  }[];
  hub_access: {
    partner_slug: string;
    access_granted: boolean;
    granted_at: string | null;
    revoked_at: string | null;
  }[];
}

export async function staffGetPartnerProfile(userId: string): Promise<PartnerProfile | null> {
  const { data, error } = await supabase.rpc('sv_staff_get_partner_profile', { p_user_id: userId });
  if (error) { console.error('staffGetPartnerProfile:', error); return null; }
  if (!data) return null;
  return data as unknown as PartnerProfile;
}
