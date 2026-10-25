/**
 * MFA-aware authentication bridge.
 *
 * The app uses a local username/password system as the primary auth (useDemo.ts).
 * A shadow Supabase Auth account (email + password) enables Supabase's native
 * MFA/TOTP APIs for second-factor enforcement.
 *
 * Legacy users (pre-upgrade) had a 4–8 digit PIN. Their Supabase shadow password
 * was derived as `sv_<pin>_sv`. Migrated users have a real password (min 10 chars)
 * stored directly as the Supabase Auth password.
 *
 * Supports three MFA methods:
 *   - TOTP (authenticator app) — via Supabase's native MFA API
 *   - SMS (phone OTP) — via sv_create_sms_otp / sv_verify_sms_otp RPC
 *   - Email OTP — via sv_create_email_otp / sv_verify_email_otp RPC
 *
 * Flow:
 *   1. Local password auth succeeds (useDemo.startLogin)
 *   2. signInWithMfaCheck() signs into Supabase Auth with email + password
 *      (tries raw password first, then derived PIN format for legacy accounts)
 *   3. Checks for verified TOTP factors + user_mfa_preferences (SMS/email enabled)
 *   4. If any factor exists → returns { requiresMfa: true, factorId, availableMethods }
 *   5. Caller shows MFA challenge UI with method selection
 *   6. verifyMfaLogin() completes the MFA challenge (TOTP, SMS, or email)
 *   7. Only then is full app access granted
 */

import { supabase } from '@/lib/supabase';
import { listMfaFactors, createMfaChallenge, verifyMfaChallenge } from '@/lib/securityEngine';

export type MfaMethod = 'totp' | 'sms' | 'email';

export interface MfaCheckResult {
  ok: boolean;
  requiresMfa: boolean;
  factorId?: string;
  availableMethods?: MfaMethod[];
  error?: string;
}

export interface MfaPreferences {
  totp_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
  phone_masked?: string | null;
  phone_verified?: boolean;
  preferred_method?: string | null;
}

/**
 * Derive a Supabase-compatible password from a legacy PIN.
 * Used only for backward-compatible sign-in of pre-upgrade accounts.
 */
function deriveSupabasePasswordFromPin(pin: string): string {
  return `sv_${pin}_sv`;
}

/**
 * Create a shadow Supabase Auth account during signup.
 * The password is stored directly as the Supabase Auth password.
 */
export async function createShadowAuthAccount(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    // If user already exists, that's fine — they may have been created before
    if (error.message.includes('already') || error.message.includes('registered')) {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Fetch the user's MFA preferences from the database.
 */
export async function getMfaPreferences(): Promise<MfaPreferences | null> {
  try {
    const { data, error } = await supabase.rpc('sv_get_mfa_preferences');
    if (error || !data) return null;
    return data as MfaPreferences;
  } catch {
    return null;
  }
}

/**
 * Sign into Supabase Auth and check for MFA requirements.
 * Called after local password auth succeeds.
 *
 * Tries the raw password first (migrated users). If that fails, falls back to
 * the derived PIN format (legacy users whose Supabase shadow account was
 * created with the old derivation).
 *
 * Returns:
 *   - { ok: true, requiresMfa: false } — no MFA enrolled, full access granted
 *   - { ok: true, requiresMfa: true, factorId, availableMethods } — MFA challenge required
 *   - { ok: false, error } — Supabase auth failed (credential rejected)
 *   - { ok: true, requiresMfa: false } — no MFA enrolled, full access granted
 *   - { ok: true, requiresMfa: true, factorId, availableMethods } — MFA challenge required
 */
export async function signInWithMfaCheck(email: string, credential: string): Promise<MfaCheckResult> {
  // Check if we already have an active session from the initial signInWithPassword
  // in the login flow. If so, use it directly instead of re-authenticating.
  const { data: { session } } = await supabase.auth.getSession();
  let user = session?.user ?? null;

  if (!user) {
    // No active session — sign in with the raw credential.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: credential });
    if (error || !data?.user) {
      return { ok: false, requiresMfa: false, error: 'Authentication failed.' };
    }
    user = data.user;
  }

  // Check for verified TOTP factors (Supabase native MFA)
  const factors = await listMfaFactors();
  const verifiedTotp = factors.find((f) => f.status === 'verified');

  // Check user's MFA preferences for SMS/email
  const prefs = await getMfaPreferences();

  const availableMethods: MfaMethod[] = [];
  let factorId: string | undefined;

  // TOTP: only count if the factor is actually verified in Supabase
  if (verifiedTotp) {
    availableMethods.push('totp');
    factorId = verifiedTotp.id;
  }

  // SMS: requires both the flag AND a verified phone number
  if (prefs?.sms_enabled && prefs?.phone_verified) {
    availableMethods.push('sms');
  }

  // Email: requires the flag AND the email is confirmed in Supabase Auth
  if (prefs?.email_enabled && user?.email_confirmed_at) {
    availableMethods.push('email');
  }

  // Safety fallback: if no usable verified factors exist, do NOT lock the user out.
  // Reset stale preference flags so the Security page shows the correct state.
  if (availableMethods.length === 0) {
    const anyFlagSet = prefs?.sms_enabled || prefs?.email_enabled || prefs?.totp_enabled;
    if (anyFlagSet && prefs) {
      // Clear stale flags — no usable factor backs them
      await supabase.rpc('sv_set_mfa_preference', { p_method: 'email', p_enabled: false }).catch(() => {});
      await supabase.rpc('sv_set_mfa_preference', { p_method: 'sms', p_enabled: false }).catch(() => {});
      await supabase.rpc('sv_set_mfa_preference', { p_method: 'totp', p_enabled: false }).catch(() => {});
      console.warn('[MFA] Cleared stale MFA preference flags — no usable verified factors found.');
    }
    return { ok: true, requiresMfa: false };
  }

  return {
    ok: true,
    requiresMfa: true,
    factorId: factorId ?? (availableMethods[0] === 'totp' ? factors[0]?.id : undefined),
    availableMethods,
  };
}

/**
 * Verify an MFA challenge during login.
 * Supports TOTP, SMS OTP, and Email OTP.
 */
export async function verifyMfaLogin(
  method: MfaMethod,
  code: string,
  factorId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (method === 'totp') {
    if (!factorId) return { ok: false, error: 'No TOTP factor found.' };
    const challengeResult = await createMfaChallenge(factorId);
    if (!challengeResult.ok || !challengeResult.challengeId) {
      return { ok: false, error: challengeResult.error || 'Failed to create MFA challenge.' };
    }
    const verifyResult = await verifyMfaChallenge(factorId, challengeResult.challengeId, code);
    if (!verifyResult.ok) {
      return { ok: false, error: verifyResult.error || 'Invalid code.' };
    }
    return { ok: true };
  }

  if (method === 'sms') {
    const { data, error } = await supabase.rpc('sv_verify_sms_otp', {
      p_code: code,
      p_purpose: 'login',
    });
    if (error || !data) {
      return { ok: false, error: 'Invalid or expired SMS code.' };
    }
    return { ok: true };
  }

  if (method === 'email') {
    const { data, error } = await supabase.rpc('sv_verify_email_otp', {
      p_code: code,
      p_purpose: 'login',
    });
    if (error || !data) {
      return { ok: false, error: 'Invalid or expired email code.' };
    }
    return { ok: true };
  }

  return { ok: false, error: 'Unknown MFA method.' };
}

/**
 * Send an OTP code for login verification (SMS or Email).
 * Calls the send-otp edge function.
 */
export async function sendLoginOtp(
  channel: 'sms' | 'email',
  destination: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: 'Not authenticated.' };

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`;
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ channel, destination, purpose: 'login' }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to send code' }));
    return { ok: false, error: err.error || 'Failed to send code.' };
  }
  return { ok: true };
}

// ============================================================
// Trusted Device
// ============================================================

const TRUSTED_DEVICE_KEY = 'sv-trusted-device';
const TRUSTED_DEVICE_DURATION_DAYS = 30;

/**
 * Issue a trusted-device token for the current user.
 * The plaintext token is stored in localStorage; only its hash is in the DB.
 * Returns true if a valid trusted-device token exists and is not expired.
 */
export async function issueTrustedDevice(): Promise<void> {
  const { data, error } = await supabase.rpc('sv_issue_trusted_device', {
    p_device_label: navigator.userAgent.slice(0, 120),
  });
  if (error || !data) return;
  try {
    window.localStorage.setItem(TRUSTED_DEVICE_KEY, data as string);
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Check if the current device is trusted and the token is still valid.
 */
export async function isTrustedDevice(): Promise<boolean> {
  let token: string | null = null;
  try {
    token = window.localStorage.getItem(TRUSTED_DEVICE_KEY);
  } catch {
    return false;
  }
  if (!token) return false;

  const { data, error } = await supabase.rpc('sv_verify_trusted_device', {
    p_token: token,
  });
  if (error || !data) {
    // Token is invalid or expired — clean up
    try { window.localStorage.removeItem(TRUSTED_DEVICE_KEY); } catch { /* ignore */ }
    return false;
  }
  return data as boolean;
}

/**
 * Revoke all trusted devices for the current user.
 */
export async function revokeTrustedDevices(): Promise<void> {
  await supabase.rpc('sv_revoke_trusted_devices');
  try { window.localStorage.removeItem(TRUSTED_DEVICE_KEY); } catch { /* ignore */ }
}

// ============================================================
// Security Notifications
// ============================================================

/**
 * Send a security notification email for a security event.
 */
export async function sendSecurityNotification(
  eventType: string,
  userEmail: string,
  details?: string,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/security-notify`;
  try {
    await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ event_type: eventType, user_email: userEmail, details }),
    });
  } catch {
    // Best-effort — don't block on notification failures
  }
}

/**
 * Migrate a legacy user's Supabase Auth password from the derived PIN format
 * to a real password. Called after the user successfully logs in with their
 * old PIN and creates a new password.
 *
 * Requires an active Supabase session (the user must have just signed in).
 */
export async function migrateShadowPassword(
  oldCredential: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  // Re-authenticate with the old credential to get a fresh session,
  // then update the password.
  // Try raw credential first (in case it's already a real password)
  let signInResult = await supabase.auth.signInWithPassword({
    email: (await supabase.auth.getUser()).data.user?.email ?? '',
    password: oldCredential,
  });

  if (signInResult.error) {
    // Fall back to derived PIN format
    const derivedPassword = deriveSupabasePasswordFromPin(oldCredential);
    signInResult = await supabase.auth.signInWithPassword({
      email: (await supabase.auth.getUser()).data.user?.email ?? '',
      password: derivedPassword,
    });
  }

  if (signInResult.error) {
    return { ok: false, error: 'Could not verify current credentials.' };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

/**
 * Sign out of the Supabase Auth session.
 * Called when the user logs out of the app.
 */
export async function signOutSupabase(): Promise<void> {
  await supabase.auth.signOut();
}

// ============================================================
// Quick Login PIN (variable-length, trusted-device-bound)
// ============================================================

/**
 * Set or update the quick login PIN.
 * The PIN must be 4–12 numeric digits.
 * Requires an authenticated Supabase session.
 */
export async function setQuickPin(pin: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^[0-9]{4,12}$/.test(pin)) {
    return { ok: false, error: 'PIN must be 4–12 digits.' };
  }
  const { error } = await supabase.rpc('sv_set_quick_pin', { p_pin: pin });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Remove the quick login PIN.
 */
export async function removeQuickPin(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('sv_remove_quick_pin');
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Check if the current user has a quick PIN set.
 * Does NOT reveal the PIN or its length.
 */
export async function hasQuickPin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('sv_has_quick_pin');
    if (error || !data) return false;
    return data as boolean;
  } catch {
    return false;
  }
}

/**
 * Check if the user is currently locked out of quick PIN login.
 */
export async function isQuickPinLocked(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('sv_is_quick_pin_locked');
    if (error || !data) return false;
    return data as boolean;
  } catch {
    return false;
  }
}

/**
 * Verify a quick PIN for login.
 * Both the PIN and the trusted device token must be valid.
 * Returns a generic error on failure — does not reveal whether the
 * PIN length, value, or device was the problem.
 *
 * NOTE: This requires an active Supabase session. The caller must
 * sign in with the user's email + password first (or use a cached
 * session), then call this to verify the PIN as an additional gate.
 * However, the typical flow is: user enters PIN on a trusted device,
 * we sign in with a stored credential, then verify the PIN.
 *
 * For the login flow, we use a different approach: the user enters
 * their PIN, we look up their account by username, sign in with the
 * Supabase session, and then verify the PIN + device token.
 */
export async function verifyQuickPin(pin: string, deviceToken: string): Promise<{ ok: boolean; locked?: boolean }> {
  const { data, error } = await supabase.rpc('sv_verify_quick_pin', {
    p_pin: pin,
    p_device_token: deviceToken,
  });
  if (error || !data) {
    // Check if locked
    const locked = await isQuickPinLocked();
    return { ok: false, locked };
  }
  return { ok: data as boolean };
}
