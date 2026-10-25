import { supabase } from '@/lib/supabase';
import type { SpotVaultAccount, PortalGrant, HubId, AccountStatus } from '@/types';
import { buildGrants, ALL_PORTAL_IDS } from '@/types';

export interface AuthResult {
  ok: boolean;
  account: SpotVaultAccount | null;
  error?: string;
  stage?: 'resolve' | 'auth' | 'profile' | 'roles' | 'portals';
  authError?: string;
  authStatus?: number | string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(identifier: string): boolean {
  return EMAIL_RE.test(identifier);
}

export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_resolve_login_email', {
    p_identifier: identifier.trim(),
  });
  if (error) {
    console.error('[authService] resolveLoginEmail RPC error:', error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

const VALID_PORTAL_TYPES = new Set([
  'player',
  'coach',
  'stable',
  'business',
  'creator',
  'media',
  'staff',
]);

function mapPortalTypeToHubId(portalType: string): HubId | null {
  const mapping: Record<string, HubId> = {
    player: 'PLAYER',
    coach: 'COACH',
    stable: 'STABLE',
    business: 'BUSINESS',
    creator: 'CREATOR',
    media: 'MEDIA',
    staff: 'STAFF',
  };
  return mapping[portalType] ?? null;
}

export async function buildAccountFromSession(userId: string, email: string): Promise<SpotVaultAccount | null> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('username, display_name, primary_role, poker_role, avatar_url')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[authService] profile load error:', profileError.message);
    }

    const username = profile?.username ?? email.split('@')[0];
    const displayName = profile?.display_name ?? username;
    const primaryRole = profile?.primary_role ?? 'player';

    const { data: roles, error: rolesError } = await supabase
      .from('sv_roles')
      .select('role, status')
      .eq('user_id', userId);

    if (rolesError) {
      console.error('[authService] roles load error:', rolesError.message);
    }

    const activeRoles = new Set(
      (roles ?? []).filter((r) => r.status === 'active').map((r) => r.role),
    );
    const isStaff = activeRoles.has('staff') || activeRoles.has('superuser') || activeRoles.has('developer_admin');
    const isSuperUser = activeRoles.has('superuser');
    const isDeveloperAdmin = activeRoles.has('developer_admin');
    const isModerator = activeRoles.has('moderator');
    const hasUniversalAccessRole = isSuperUser || activeRoles.has('universal_access');

    const { data: portalAccess, error: portalError } = await supabase
      .from('sv_portal_access')
      .select('portal_type, status')
      .eq('user_id', userId);

    if (portalError) {
      console.error('[authService] portal access load error:', portalError.message);
    }

    const activePortals = new Set(
      (portalAccess ?? [])
        .filter((p) => p.status === 'active' && VALID_PORTAL_TYPES.has(p.portal_type))
        .map((p) => p.portal_type),
    );

    if (activePortals.size === 0) {
      activePortals.add('player');
    }

    // Load partner hub access (StakeKings etc.)
    const { data: partnerAccess, error: partnerError } = await supabase
      .from('partner_hub_access')
      .select('partner_slug, access_granted')
      .eq('user_id', userId);

    if (partnerError) {
      console.error('[authService] partner hub access load error:', partnerError.message);
    }

    const partnerHubAccess: Record<string, boolean> = {};
    for (const pa of partnerAccess ?? []) {
      if (pa.access_granted) {
        if (pa.partner_slug === 'stakekings') {
          partnerHubAccess['stakekings_hub_access'] = true;
          // Grant admin access for superuser/staff
          if (isStaff) {
            partnerHubAccess['stakekings_admin_access'] = true;
          }
        }
      }
    }

    // Check staff organization affiliation — StakeKings staff get routed to the SK portal on sign-in
    if (isStaff) {
      const { data: staffOrg } = await supabase.rpc('sv_get_my_staff_organization');
      if ((staffOrg as string | null) === 'stakekings') {
        partnerHubAccess['stakekings_hub_access'] = true;
        partnerHubAccess['stakekings_admin_access'] = true;
      }
    }

    const grants: PortalGrant[] = [];
    const hubIds: HubId[] = [];
    for (const pt of activePortals) {
      const hubId = mapPortalTypeToHubId(pt);
      if (hubId) hubIds.push(hubId);
    }

    if (hubIds.length === 0) {
      grants.push(...buildGrants('PLAYER'));
    } else {
      const homeHub = hubIds.includes('PLAYER') ? 'PLAYER' : hubIds[0];
      grants.push(...buildGrants(homeHub, hubIds.filter((h) => h !== homeHub)));
    }

    const homePortal: HubId = hubIds.includes('PLAYER') ? 'PLAYER' : hubIds[0] ?? 'PLAYER';

    // Load the user's default lounge membership (is_default = true).
    // This determines whether the user auto-redirects to a custom portal on login.
    // Dedicated portal accounts (e.g. Peak6) have is_default = true; the founder has is_default = false.
    let defaultLoungeSlug: string | null = null;
    const { data: defaultLounge, error: loungeError } = await supabase
      .from('lounge_memberships')
      .select('lounge_slug')
      .eq('user_id', userId)
      .eq('is_default', true)
      .eq('status', 'active')
      .maybeSingle();

    if (loungeError) {
      console.error('[authService] default lounge load error:', loungeError.message);
    }
    if (defaultLounge?.lounge_slug) {
      defaultLoungeSlug = defaultLounge.lounge_slug;
    }

    const account: SpotVaultAccount = {
      id: userId,
      name: displayName,
      username,
      email,
      homePortal,
      status: 'active' as AccountStatus,
      role: isSuperUser ? 'superuser' : hasUniversalAccessRole ? 'universal_access' : isDeveloperAdmin ? 'developer_admin' : isStaff ? 'staff' : isModerator ? 'moderator' : 'member',
      grants,
      primaryRole,
      passwordMigrated: true,
      partnerHubAccess: Object.keys(partnerHubAccess).length > 0 ? partnerHubAccess : undefined,
      defaultLoungeSlug,
    };

    return account;
  } catch (err) {
    console.error('[authService] buildAccountFromSession error:', err);
    return null;
  }
}

export async function loginWithIdentifier(
  identifier: string,
  password: string,
): Promise<AuthResult> {
  const trimmed = identifier.trim();
  const identifierType = isEmail(trimmed) ? 'email' : 'username';
  let email: string;
  if (identifierType === 'email') {
    email = trimmed;
  } else {
    const resolved = await resolveLoginEmail(trimmed);
    console.log('[AUTH-DEBUG] resolveLoginEmail for', trimmed, '=>', resolved);
    if (!resolved) {
      return { ok: false, account: null, error: 'User not found', stage: 'resolve' };
    }
    email = resolved;
  }

  // Clear any stale session before attempting login
  try { await supabase.auth.signOut(); } catch { /* ignore */ }

  console.log('[AUTH-DEBUG] signInWithPassword for email:', email, 'project:', import.meta.env.VITE_SUPABASE_URL);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.user) {
    const errMsg = error?.message ?? 'Unknown auth error';
    const errStatus = error?.status ?? 0;
    const errCode = (error as { code?: string })?.code ?? 'none';
    console.error('[AUTH-DEBUG] signInWithPassword FAILED:', JSON.stringify({ message: errMsg, status: errStatus, code: errCode }));
    return { ok: false, account: null, error: `Auth failed: ${errMsg} (status ${errStatus}, code ${errCode})`, stage: 'auth', authError: errMsg, authStatus: errStatus };
  }

  console.log('[AUTH-DEBUG] signInWithPassword SUCCESS, user:', data.user.id, 'session:', !!data.session);

  const account = await buildAccountFromSession(data.user.id, email);
  if (!account) {
    console.error('[AUTH-DEBUG] buildAccountFromSession returned null for', data.user.id);
    return { ok: false, account: null, error: 'Profile load failed', stage: 'profile' };
  }
  console.log('[AUTH-DEBUG] Account built:', account.username, account.role);

  // Record the sign-in event (deduped server-side via 5-minute window)
  const deviceType = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  supabase.rpc('sv_record_sign_in', {
    p_portal: account.homePortal ?? 'player',
    p_device_type: deviceType,
  }).then(({ error }) => {
    if (error) console.error('[authService] sv_record_sign_in error:', error.message);
  });

  return { ok: true, account };
}

export async function restoreSessionAccount(): Promise<SpotVaultAccount | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return buildAccountFromSession(session.user.id, session.user.email ?? '');
}

export interface SignUpResult {
  ok: boolean;
  error?: string;
  stage?: 'signup' | 'profile' | 'portal';
}

export async function signUpNewUser(params: {
  email: string;
  password: string;
  username: string;
  displayName: string;
  primaryRole?: string;
}): Promise<SignUpResult> {
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
      return { ok: false, error: 'An account with that email already exists.', stage: 'signup' };
    }
    return { ok: false, error: error.message, stage: 'signup' };
  }

  if (!data.user) {
    return { ok: false, error: 'Sign-up failed. Please try again.', stage: 'signup' };
  }

  const userId = data.user.id;

  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: userId,
      username: params.username,
      display_name: params.displayName,
      primary_role: params.primaryRole ?? 'player',
      poker_role: '',
      privacy_mode: 'public',
    });

  if (profileError) {
    console.error('[authService] profile insert error:', profileError.message);
  }

  const { error: portalError } = await supabase
    .from('sv_portal_access')
    .insert({
      user_id: userId,
      portal_type: 'player',
      status: 'active',
    });

  if (portalError) {
    console.error('[authService] portal access insert error:', portalError.message);
  }

  const { error: roleError } = await supabase
    .from('sv_roles')
    .insert({
      user_id: userId,
      role: 'player',
      status: 'active',
    });

  if (roleError) {
    console.error('[authService] role insert error:', roleError.message);
  }

  return { ok: true };
}
