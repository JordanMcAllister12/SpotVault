import { supabase } from '@/lib/supabase';

const TERMS_VERSION = '2025-10-01';
const PRIVACY_VERSION = '2025-10-01';

export { TERMS_VERSION, PRIVACY_VERSION };

export interface ProvisioningData {
  valid: boolean;
  status: 'new_user' | 'existing_user';
  requestId?: string;
  externalUserId: string;
  externalUsername: string;
  displayName: string | null;
  email: string | null;
  metadata?: Record<string, unknown>;
  linkedSpotVaultUserId?: string;
  loginUrl?: string;
  error?: string;
}

export async function redeemProvisioningToken(token: string): Promise<ProvisioningData> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sk-redeem-token`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorBody.error || `Token validation failed (${response.status})`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data as ProvisioningData;
}

export async function recordPolicyAcceptance(
  userId: string,
  policyType: 'terms_of_service' | 'privacy_policy',
  version: string,
): Promise<void> {
  const { error } = await supabase.rpc('sv_record_policy_acceptance', {
    p_user_id: userId,
    p_policy_type: policyType,
    p_policy_version: version,
  });
  if (error) {
    console.error('[skProvisioning] Policy acceptance error:', error.message);
  }
}

export async function linkStakeKingsAccount(
  externalUserId: string,
  spotvaultUserId: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_link_stakekings_account', {
    p_external_user_id: externalUserId,
    p_spotvault_user_id: spotvaultUserId,
    p_metadata: metadata ?? {},
  });
  if (error) {
    console.error('[skProvisioning] Account link error:', error.message);
    return false;
  }
  return data as boolean;
}

export async function grantStakeKingsPortalAccess(_userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_self_provision_stakekings_access');

  if (error) {
    console.error('[skProvisioning] Self-provision SK access error:', error.message);
    return false;
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    console.error('[skProvisioning] Self-provision SK access denied:', result?.error);
    return false;
  }
  return true;
}

export async function completeStakeKingsOnboarding(params: {
  email: string;
  password: string;
  username: string;
  displayName: string;
  externalUserId: string;
}): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        username: params.username,
        display_name: params.displayName,
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      return { ok: false, error: 'An account with that email already exists.' };
    }
    return { ok: false, error: error.message };
  }

  if (!data.user) {
    return { ok: false, error: 'Account creation failed. Please try again.' };
  }

  const userId = data.user.id;

  await supabase.from('user_profiles').upsert({
    user_id: userId,
    username: params.username,
    display_name: params.displayName,
    primary_role: 'player',
    poker_role: '',
    privacy_mode: 'public',
  });

  await supabase.from('sv_portal_access').insert({
    user_id: userId,
    portal_type: 'player',
    status: 'active',
  });

  await supabase.from('sv_roles').insert({
    user_id: userId,
    role: 'player',
    status: 'active',
  });

  await linkStakeKingsAccount(params.externalUserId, userId);
  await grantStakeKingsPortalAccess(userId);
  await recordPolicyAcceptance(userId, 'terms_of_service', TERMS_VERSION);
  await recordPolicyAcceptance(userId, 'privacy_policy', PRIVACY_VERSION);

  return { ok: true, userId };
}
