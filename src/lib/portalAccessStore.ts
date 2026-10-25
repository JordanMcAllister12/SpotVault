import { supabase } from '@/lib/supabase';

export interface CustomPortalMembership {
  portal_id: string;
  portal_slug: string;
  portal_name: string;
  base_portal: string;
  config: {
    backgrounds?: { lounge?: string; community?: string };
    logo?: string;
    communityId?: string;
    themeOverrides?: Record<string, unknown>;
  };
  status: string;
  access_expires_at: string;
  membership_tier: string;
  entitlement_package: Record<string, unknown>;
  category?: string;
}

export interface RedeemResult {
  ok: boolean;
  error?: string;
  already_member?: boolean;
  portal_slug?: string;
  portal_name?: string;
  portal_id?: string;
  base_portal?: string;
  access_expires_at?: string;
  config?: CustomPortalMembership['config'];
}

export async function redeemPortalCode(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('sv_redeem_portal_code', { p_code: code });
  if (error) {
    return { ok: false, error: 'Unable to validate code. Please try again.' };
  }
  return data as RedeemResult;
}

export async function getMyPortalMemberships(): Promise<CustomPortalMembership[]> {
  const { data, error } = await supabase.rpc('sv_get_accessible_custom_portals');
  if (error || !data) return [];
  return data as CustomPortalMembership[];
}

export async function getPortalMembers(portalId: string): Promise<unknown[]> {
  const { data, error } = await supabase.rpc('sv_get_portal_members', { p_portal_id: portalId });
  if (error || !data) return [];
  return data;
}

export async function getAllCustomPortals(): Promise<Array<{
  id: string;
  slug: string;
  name: string;
  base_portal: string;
  active: boolean;
  category: string;
  config: CustomPortalMembership['config'];
}>> {
  const { data, error } = await supabase.from('custom_portals').select('*');
  if (error || !data) return [];
  return data;
}

export async function getAllAccessCodes(): Promise<Array<{
  id: string;
  portal_id: string;
  code: string;
  active: boolean;
  redemption_count: number;
  redemption_limit: number | null;
  access_duration_months: number;
  membership_tier: string;
  new_users_only: boolean;
}>> {
  const { data, error } = await supabase.from('custom_portal_access_codes').select('*');
  if (error || !data) return [];
  return data;
}
