import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INITIAL_ACCESS,
  INITIAL_FEED,
  STARTING_CREDITS,
  type FeedItem,
  type HubAccess,
  type HubId,
  type ScreenId,
  type TumblerPhase,
  type SpotVaultAccount,
  type PortalGrant,
  type AccountStatus,
  findAccountByUsername,
  canAccessPortal,
  getGrant,
  buildGrants,
  PORTAL_DEFINITIONS,
  setAccountPin,
  isValidPasswordFormat,
  isLegacyPinCredential,
  verifyPin,
  verifyPassword,
  ALL_PORTAL_IDS,
  addRegisteredAccount,
  isPasswordMigrated,
  isMigration2faCompleted,
  markPasswordMigrated,
  markMigration2faCompleted,
} from '@/types';
import { signInWithMfaCheck, verifyMfaLogin, createShadowAuthAccount, signOutSupabase, migrateShadowPassword, type MfaMethod, isTrustedDevice, issueTrustedDevice, hasQuickPin, verifyQuickPin, isQuickPinLocked } from '@/lib/mfaAuth';
import { loginWithIdentifier, buildAccountFromSession, restoreSessionAccount, signUpNewUser } from '@/lib/authService';
import { redeemPortalCode, getMyPortalMemberships, type CustomPortalMembership } from '@/lib/portalAccessStore';
import { supabase } from '@/lib/supabase';

export type PortalId = HubId;

export const PHASE_2_DEMO_MODE = false;

export interface DemoState {
  screen: ScreenId;
  tumblerPhase: TumblerPhase;
  tumblerTarget: HubId;
  tumblerDenied: boolean;
  selectedPortal: PortalId;
  access: HubAccess[];
  feed: FeedItem[];
  buzzShown: boolean;
  buzzDismissed: boolean;
  guestRemaining: number;
  inInterviewRoom: boolean;
  publishModalOpen: boolean;
  publishPulse: boolean;
  publishModalRestricted: boolean;
  networkMapOpen: boolean;
  networkDirectoryOpen: boolean;
  interviewPublished: boolean;
  credits: number;
  creditsPanelOpen: boolean;
  activeHubView: string | null;
  portalContentView: string | null;
  boothModalOpen: boolean;
  portalSwitchOpen: boolean;

  // Account access control
  currentAccount: SpotVaultAccount | null;
  loginUsername: string;
  loginPin: string;
  signUpOpen: boolean;
  pendingAccount: SpotVaultAccount | null;
  accessRequestOpen: boolean;
  accessRequestPortal: HubId | null;
  portalAccessPanelOpen: boolean;
  accessRequests: { id: string; portal: HubId; reason: string; credentials: string; status: 'submitted' }[];
  phase2PanelOpen: boolean;
  recentDestinations: string[];
  universalView: string | null;
  originPortal: HubId | null;
  justSignedUp: boolean;
  portalSelectionPending: boolean;
  mfaPending: boolean;
  mfaFactorId: string | null;
  mfaError: string | null;
  mfaAvailableMethods: MfaMethod[];
  mfaRememberDevice: boolean;
  passwordMigrationPending: boolean;
  migration2faStep: boolean;
  quickPinAvailable: boolean;
  recoveryResetPending: boolean;
  recoveryResetError: string | null;
  recoveryTempPassword: string;
  customPortalMemberships: CustomPortalMembership[];
  loginError: string | null;
  sessionRestored: boolean;
  pendingSpotOpenId: string | null;
}

const INITIAL_STATE: DemoState = {
  screen: 'access',
  tumblerPhase: 'idle',
  tumblerTarget: 'PLAYER',
  tumblerDenied: false,
  selectedPortal: 'PLAYER',
  access: INITIAL_ACCESS,
  feed: INITIAL_FEED,
  buzzShown: false,
  buzzDismissed: false,
  guestRemaining: 0,
  inInterviewRoom: false,
  publishModalOpen: false,
  publishPulse: false,
  publishModalRestricted: false,
  networkMapOpen: false,
  networkDirectoryOpen: false,
  interviewPublished: false,
  credits: STARTING_CREDITS,
  creditsPanelOpen: false,
  activeHubView: null,
  portalContentView: null,
  boothModalOpen: false,
  portalSwitchOpen: false,

  currentAccount: null,
  loginUsername: '',
  loginPin: '',
  signUpOpen: false,
  pendingAccount: null,
  accessRequestOpen: false,
  accessRequestPortal: null,
  portalAccessPanelOpen: false,
  accessRequests: [],
  phase2PanelOpen: false,
  recentDestinations: [],
  universalView: null,
  originPortal: null,
  justSignedUp: false,
  portalSelectionPending: false,
  mfaPending: false,
  mfaFactorId: null,
  mfaError: null,
  mfaAvailableMethods: [],
  mfaRememberDevice: false,
  passwordMigrationPending: false,
  migration2faStep: false,
  quickPinAvailable: false,
  recoveryResetPending: false,
  recoveryResetError: null,
  recoveryTempPassword: '',
  customPortalMemberships: [],
  loginError: null,
  sessionRestored: false,
  pendingSpotOpenId: null,
};

const LAST_PORTAL_KEY = 'spotvault-last-portal';

function loadLastPortal(): PortalId | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_PORTAL_KEY);
    if (!raw) return null;
    return raw as PortalId;
  } catch {
    return null;
  }
}

function saveLastPortal(portal: PortalId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_PORTAL_KEY, portal);
  } catch {
    // ignore storage failures
  }
}

export function useDemo() {
  const [state, setState] = useState<DemoState>(INITIAL_STATE);
  const guestTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Countdown timer for guest access
  useEffect(() => {
    if (state.guestRemaining > 0) {
      guestTimerRef.current = setInterval(() => {
        setState((s) => ({ ...s, guestRemaining: Math.max(0, s.guestRemaining - 1) }));
      }, 1000);
      return () => {
        if (guestTimerRef.current) clearInterval(guestTimerRef.current);
      };
    }
  }, [state.guestRemaining > 0]);

  // --- Session restore: recover currentAccount from Supabase session on page load ---
  // restoreSessionAccount checks supabase.auth.getSession() and rebuilds the
  // SpotVaultAccount from the database. Without this, a page refresh leaves
  // currentAccount=null even when the user has a valid session, which causes
  // child components like SpotDiscussion to incorrectly show "Sign in".
  useEffect(() => {
    let mounted = true;
    (async () => {
      const account = await restoreSessionAccount();
      if (!mounted) return;
      if (account) {
        const lastPortal = loadLastPortal();
        const validPortal = (lastPortal && canAccessPortal(account, lastPortal)) ? lastPortal : account.homePortal;
        saveLastPortal(validPortal);
        setState((s) => ({
          ...s,
          currentAccount: account,
          selectedPortal: validPortal,
          sessionRestored: true,
        }));
      } else {
        setState((s) => ({ ...s, sessionRestored: true }));
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Listen for auth state changes (sign-in via other tabs, sign-out, etc.)
  useEffect(() => {
    const { data: authData } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          setState((s) => ({ ...s, currentAccount: null, sessionRestored: true }));
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Only rebuild if we don't already have an account (avoid clobbering login flow)
          setState((s) => {
            if (s.currentAccount) return s;
            return s; // account will be set by the login flow or the restore effect
          });
        }
      })();
    });
    return () => {
      authData?.subscription.unsubscribe();
    };
  }, []);

  // Trigger the buzz notification 5s after entering Player Hub
  useEffect(() => {
    if (state.screen === 'player' && !state.buzzShown && !state.buzzDismissed) {
      const t = setTimeout(() => setState((s) => ({ ...s, buzzShown: true })), 5000);
      return () => clearTimeout(t);
    }
  }, [state.screen, state.buzzShown, state.buzzDismissed]);

  const routeToPortal = useCallback((s: DemoState, targetHub: HubId): Partial<DemoState> => {
    const canonicalPortal = targetHub === 'PARTNERSHIPS' ? 'AFFILIATE_PARTNER' : targetHub;
    const hubScreenMap: Partial<Record<HubId, ScreenId>> = {
      PLAYER: 'player',
      MEDIA: 'media',
      INVESTOR: 'investor',
      CREATOR: 'player',
      STABLE: 'player',
      AFFILIATE_PARTNER: 'player',
    };
    const hubViewMap: Partial<Record<HubId, string>> = {
      BUSINESS: 'business',
      MARKETPLACE: 'marketplace',
      EXPO: 'expo',
      COACH: 'coach',
      JOBS: 'jobs',
      PRO: 'pro',
    };
    const directScreen = hubScreenMap[canonicalPortal];
    const hubView = hubViewMap[canonicalPortal];
    return {
      selectedPortal: canonicalPortal as PortalId,
      screen: directScreen ?? 'player',
      networkDirectoryOpen: !!hubView,
      activeHubView: hubView ?? null,
      tumblerPhase: 'idle',
      tumblerDenied: false,
      portalSwitchOpen: false,
      inInterviewRoom: false,
      phase2PanelOpen: false,
      universalView: null,
      originPortal: null,
      networkMapOpen: false,
      creditsPanelOpen: false,
      boothModalOpen: false,
      publishModalOpen: false,
      publishPulse: false,
      publishModalRestricted: false,
      accessRequestOpen: false,
      accessRequestPortal: null,
      portalAccessPanelOpen: false,
      signUpOpen: false,
      portalContentView: null,
    };
  }, []);

  const reset = useCallback(() => {
    if (guestTimerRef.current) clearInterval(guestTimerRef.current);
    signOutSupabase().catch(() => {});
    setState(INITIAL_STATE);
  }, []);

  // --- Login / tumbler sequence ---

  // Called when the user submits the login form.
  // Accepts both legacy PIN (4–8 digits) and new passwords (min 10 chars).
  // If the user logs in with a legacy PIN, sets passwordMigrationPending.
  // ASYNC: waits for the Supabase MFA check to complete before returning.
  // Returns { authenticated: true, needsPortalSelection } if no MFA is required.
  // Returns { authenticated: false, needsMfa: true, mfaMethods: [...] } if MFA is required.
  // The caller must then call completeMfaLogin() with the code.
  const startLogin = useCallback(async (): Promise<
    | false
    | { authenticated: true; needsPortalSelection: boolean; requiresMigration?: boolean }
    | { authenticated: false; needsMfa: true; mfaMethods: string[]; mfaFactorId: string | null }
  > => {
    // Production auth: Supabase Auth is the source of truth.
    // The login identifier can be either an email address or a SpotVault username.
    // We resolve username→email via the sv_resolve_login_email RPC, then call
    // supabase.auth.signInWithPassword. After auth succeeds, we build the
    // SpotVaultAccount from the database (profile, roles, portal access).
    // BUILTIN_ACCOUNTS is only a fallback for legacy email-less demo accounts.

    // First, check if this is a legacy builtin account (email-less demo accounts).
    // These accounts don't exist in Supabase Auth and must use local verification.
    const legacyAccount = findAccountByUsername(state.loginUsername);
    const isLegacyBuiltin = legacyAccount && !legacyAccount.email;

    if (isLegacyBuiltin && legacyAccount) {
      // Legacy demo account — local PIN/password verification only.
      const credentialValid = verifyPassword(legacyAccount.id, state.loginPin);
      if (!credentialValid) return false;

      const passwordAlreadyMigrated = isPasswordMigrated(legacyAccount.id) || legacyAccount.passwordMigrated === true;
      const isLegacy = isLegacyPinCredential(state.loginPin) && !passwordAlreadyMigrated;
      const needs2faStep = passwordAlreadyMigrated && !isMigration2faCompleted(legacyAccount.id);

      const desiredPortal = state.selectedPortal;
      const lastPortal = loadLastPortal();
      let validPortal = desiredPortal;
      if (!canAccessPortal(legacyAccount, desiredPortal)) {
        if (lastPortal && canAccessPortal(legacyAccount, lastPortal)) {
          validPortal = lastPortal;
        } else if (canAccessPortal(legacyAccount, legacyAccount.homePortal)) {
          validPortal = legacyAccount.homePortal;
        } else {
          const firstAuthorized = ALL_PORTAL_IDS.find((p) => canAccessPortal(legacyAccount, p));
          validPortal = firstAuthorized ?? legacyAccount.homePortal;
        }
      }
      saveLastPortal(validPortal);

      setState((s) => ({
        ...s,
        currentAccount: legacyAccount,
        selectedPortal: validPortal,
        tumblerPhase: 'idle',
        tumblerTarget: null,
        tumblerDenied: false,
        portalSelectionPending: true,
        mfaPending: false,
        mfaFactorId: null,
        mfaError: null,
      }));

      if (isLegacy) {
        setState((s) => ({ ...s, passwordMigrationPending: true }));
        return { authenticated: true, needsPortalSelection: true, requiresMigration: true };
      }
      if (needs2faStep) {
        setState((s) => ({ ...s, passwordMigrationPending: false, migration2faStep: true }));
        return { authenticated: true, needsPortalSelection: true, requiresMigration: true };
      }
      return { authenticated: true, needsPortalSelection: true };
    }

    // Production auth path: resolve identifier → Supabase Auth → build account from DB.
    const result = await loginWithIdentifier(state.loginUsername, state.loginPin);
    if (!result.ok || !result.account) {
      console.warn('[auth] Login failed at stage:', result.stage, 'error:', result.error);
      setState((s) => ({ ...s, loginError: 'Invalid username, email, or password' }));
      return false;
    }
    const account = result.account;

    // Validate portal access against the DB-derived account.
    const desiredPortal = state.selectedPortal;
    const lastPortal = loadLastPortal();
    let validPortal = desiredPortal;
    if (!canAccessPortal(account, desiredPortal)) {
      if (lastPortal && canAccessPortal(account, lastPortal)) {
        validPortal = lastPortal;
      } else if (canAccessPortal(account, account.homePortal)) {
        validPortal = account.homePortal;
      } else {
        const firstAuthorized = ALL_PORTAL_IDS.find((p) => canAccessPortal(account, p));
        validPortal = firstAuthorized ?? account.homePortal;
      }
    }
    saveLastPortal(validPortal);

    setState((s) => ({
      ...s,
      currentAccount: account,
      selectedPortal: validPortal,
      tumblerPhase: 'idle',
      tumblerTarget: null,
      tumblerDenied: false,
      portalSelectionPending: true,
      mfaPending: false,
      mfaFactorId: null,
      mfaError: null,
    }));

    // Check Supabase for MFA factors.
    const mfaResult = await signInWithMfaCheck(account.email, state.loginPin);
    if (!mfaResult.ok) return false;

    const trusted = await isTrustedDevice();
    if (mfaResult.requiresMfa && !trusted && mfaResult.availableMethods && mfaResult.availableMethods.length > 0) {
      setState((s) => ({
        ...s,
        mfaPending: true,
        mfaFactorId: mfaResult.factorId ?? null,
        mfaAvailableMethods: mfaResult.availableMethods!,
        mfaError: null,
      }));
      return { authenticated: false, needsMfa: true, mfaMethods: mfaResult.availableMethods!, mfaFactorId: mfaResult.factorId ?? null };
    }

    return { authenticated: true, needsPortalSelection: true };
  }, [state.loginUsername, state.loginPin, state.selectedPortal]);

  // Verify MFA code and complete login.
  // After successful verification, clears mfaPending so the entrance animation can proceed.
  // If mfaRememberDevice is true, issues a trusted-device token.
  const completeMfaLogin = useCallback(async (method: MfaMethod, code: string): Promise<{ ok: boolean; error?: string }> => {
    const factorId = state.mfaFactorId;
    const result = await verifyMfaLogin(method, code, factorId ?? undefined);
    if (!result.ok) return { ok: false, error: result.error };

    // Issue trusted device token if requested
    if (state.mfaRememberDevice) {
      await issueTrustedDevice();
    }

    setState((s) => ({ ...s, mfaPending: false, mfaFactorId: null, mfaError: null, mfaAvailableMethods: [] }));
    return { ok: true };
  }, [state.mfaFactorId, state.mfaRememberDevice]);

  const cancelMfaLogin = useCallback(() => {
    setState((s) => ({ ...s, mfaPending: false, mfaFactorId: null, mfaError: null, mfaAvailableMethods: [], currentAccount: null, portalSelectionPending: false, passwordMigrationPending: false, migration2faStep: false }));
    signOutSupabase().catch(() => {});
  }, []);

  const setMfaRememberDevice = useCallback((value: boolean) => {
    setState((s) => ({ ...s, mfaRememberDevice: value }));
  }, []);

  // --- Password migration (legacy PIN → real password) ---
  const completePasswordMigration = useCallback(async (newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    const account = state.currentAccount;
    if (!account) return { ok: false, error: 'No active account.' };
    if (!isValidPasswordFormat(newPassword)) {
      return { ok: false, error: 'Password must be at least 10 characters.' };
    }

    // Update the local credential store
    setAccountPin(account.id, newPassword);

    // Update the Supabase shadow account password
    const oldCredential = state.loginPin;
    if (account.email) {
      const result = await migrateShadowPassword(oldCredential, newPassword);
      if (!result.ok) {
        // Local store already updated — the Supabase update can be retried later.
        // Don't block the user.
        console.warn('[Auth] Shadow password migration failed:', result.error);
      }
    }

    // Persist the migration flag so it survives logout/refresh/restart.
    // This works for BOTH builtin and registered accounts.
    account.passwordMigrated = true;
    markPasswordMigrated(account.id);
    // Also update registered accounts store if the account exists there.
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('spotvault-registered-accounts');
        if (raw) {
          const accounts = JSON.parse(raw) as SpotVaultAccount[];
          const idx = accounts.findIndex((a) => a.id === account.id);
          if (idx >= 0) {
            accounts[idx] = { ...accounts[idx], passwordMigrated: true };
            window.localStorage.setItem('spotvault-registered-accounts', JSON.stringify(accounts));
          }
        }
      } catch { /* ignore */ }
    }

    setState((s) => ({ ...s, passwordMigrationPending: false, migration2faStep: true, loginPin: '' }));
    return { ok: true };
  }, [state.currentAccount, state.loginPin]);

  const cancelPasswordMigration = useCallback(() => {
    // Legacy users cannot skip migration — cancelling logs them out.
    signOutSupabase().catch(() => {});
    setState((s) => ({ ...s, passwordMigrationPending: false, migration2faStep: false, currentAccount: null, loginUsername: '', loginPin: '', mfaPending: false, mfaFactorId: null, mfaError: null, mfaAvailableMethods: [], portalSelectionPending: false }));
  }, []);

  // Complete the 2FA step of migration — user picked a method, let them into the portal
  const completeMigration2fa = useCallback(async (method: 'authenticator' | 'email' | 'sms'): Promise<{ ok: boolean; error?: string }> => {
    const account = state.currentAccount;
    if (!account) return { ok: false, error: 'No active account.' };

    // Enable the selected 2FA method via Supabase RPC
    if (account.email) {
      try {
        const { supabase } = await import('@/lib/supabase');
        if (method === 'email') {
          await supabase.rpc('sv_set_mfa_preference', { p_method: 'email', p_enabled: true });
        } else if (method === 'sms') {
          await supabase.rpc('sv_set_mfa_preference', { p_method: 'sms', p_enabled: true });
        }
        // For authenticator, the user will complete TOTP setup from Settings → Security
      } catch { /* best-effort — user can configure from Settings */ }
    }

    // Persist the 2FA completion so the user never sees the migration prompt again.
    if (state.currentAccount) {
      markMigration2faCompleted(state.currentAccount.id);
    }

    setState((s) => ({ ...s, passwordMigrationPending: false, migration2faStep: false }));
    return { ok: true };
  }, [state.currentAccount]);

  // --- Quick PIN login (trusted device only) ---
  const checkQuickPinAvailability = useCallback(async () => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setState((s) => ({ ...s, quickPinAvailable: false }));
        return;
      }
      const trusted = await isTrustedDevice();
      if (!trusted) {
        setState((s) => ({ ...s, quickPinAvailable: false }));
        return;
      }
      const pinExists = await hasQuickPin();
      setState((s) => ({ ...s, quickPinAvailable: pinExists }));
    } catch {
      setState((s) => ({ ...s, quickPinAvailable: false }));
    }
  }, []);

  const quickPinLogin = useCallback(async (pin: string): Promise<{ ok: boolean; locked?: boolean }> => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { ok: false };

      const token = window.localStorage.getItem('sv-trusted-device');
      if (!token) return { ok: false };

      const result = await verifyQuickPin(pin, token);
      if (!result.ok) return { ok: false, locked: result.locked };

      // PIN verified — restore the account from the session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { ok: false };

      // Build account from database using the authenticated session.
      const account = await buildAccountFromSession(user.id, user.email ?? '');
      if (!account) return { ok: false };

      setState((s) => ({
        ...s,
        currentAccount: account,
        loginUsername: account.username,
        loginPin: '',
        quickPinAvailable: false,
        portalSelectionPending: true,
        mfaPending: false,
        tumblerPhase: 'idle',
        tumblerDenied: false,
      }));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, []);

  // --- Auto-login: restore session from persisted Supabase auth ---
  // Called on app load when Remember Me was enabled. Sets the account and
  // selected portal without requiring PIN entry.
  const autoLogin = useCallback((account: SpotVaultAccount, portal: HubId) => {
    const validPortal = canAccessPortal(account, portal) ? portal
      : canAccessPortal(account, account.homePortal) ? account.homePortal
      : ALL_PORTAL_IDS.find((p) => canAccessPortal(account, p)) ?? account.homePortal;

    saveLastPortal(validPortal);
    setState((s) => ({
      ...s,
      currentAccount: account,
      loginUsername: account.username,
      loginPin: '',
      selectedPortal: validPortal as PortalId,
      portalSelectionPending: true,
      mfaPending: false,
      tumblerPhase: 'idle',
      tumblerDenied: false,
    }));
  }, []);

  const grantAccess = useCallback(() => {
    setState((s) => {
      if (s.tumblerDenied) {
        // Access denied — leave VaultTumbler mounted so the denial UI
        // (Return Home / Request Access buttons) stays visible.
        return s;
      }

      const isGuestGrant = s.tumblerTarget === 'MEDIA';
      const newAccess = s.access.map((a) =>
        a.hub === s.tumblerTarget
          ? {
              ...a,
              access: (isGuestGrant ? 'guest' : a.access === 'permanent' ? 'permanent' : 'guest') as HubAccess['access'],
            }
          : a
      );
      const target = s.tumblerTarget;
      return {
        ...s,
        ...routeToPortal(s, target),
        access: newAccess,
        guestRemaining: isGuestGrant ? 24 * 3600 : s.guestRemaining,
        networkMapOpen: false,
        creditsPanelOpen: false,
        boothModalOpen: false,
        publishModalOpen: false,
        publishPulse: false,
        publishModalRestricted: false,
      };
    });
  }, [routeToPortal]);

  const finishVault = useCallback(() => {
    setState((s) => ({ ...s, tumblerPhase: 'idle' }));
  }, []);

  // --- Buzz / invite flow ---
  const acceptInvite = useCallback(() => {
    setState((s) => ({
      ...s,
      buzzShown: false,
      buzzDismissed: true,
      tumblerPhase: 'active',
      tumblerTarget: 'MEDIA',
      tumblerDenied: false,
    }));
  }, []);

  const declineInvite = useCallback(() => {
    setState((s) => ({ ...s, buzzShown: false, buzzDismissed: true }));
  }, []);

  // --- Hub navigation ---
  const goToInnerCircle = useCallback(() => {
    setState((s) => ({ ...s, screen: 'innercircle', originPortal: s.selectedPortal }));
  }, []);

  const goBackToHub = useCallback(() => {
    setState((s) => ({ ...s, ...routeToPortal(s, (s.originPortal ?? s.selectedPortal) as HubId) }));
  }, [routeToPortal]);

  const returnToAccessPortal = useCallback(() => {
    signOutSupabase().catch(() => {});
    setState((s) => ({ ...s, screen: 'access', currentAccount: null, loginUsername: '', loginPin: '', tumblerPhase: 'idle', mfaPending: false, mfaFactorId: null, mfaError: null, mfaAvailableMethods: [], portalSelectionPending: false, passwordMigrationPending: false, migration2faStep: false }));
  }, []);

  // --- Portal selection ---
  const setSelectedPortal = useCallback((portal: PortalId) => {
    saveLastPortal(portal);
    setState((s) => ({ ...s, selectedPortal: portal }));
  }, []);

  const confirmPortalSelection = useCallback(() => {
    setState((s) => ({ ...s, portalSelectionPending: false }));
  }, []);

  const switchPortal = useCallback((portal: PortalId) => {
    setState((s) => {
      const account = s.currentAccount;
      if (!account) return s;

      const targetHub = (portal === 'PARTNERSHIPS' ? 'AFFILIATE_PARTNER' : portal) as HubId;
      const hasAccess = canAccessPortal(account, targetHub);

      if (hasAccess) {
        return { ...s, ...routeToPortal(s, targetHub) };
      }

      // No access — vault will deny
      return { ...s, tumblerPhase: 'active', tumblerTarget: targetHub, tumblerDenied: true, portalSwitchOpen: false };
    });
  }, [routeToPortal]);

  const togglePortalSwitch = useCallback(() => {
    setState((s) => ({ ...s, portalSwitchOpen: !s.portalSwitchOpen }));
  }, []);

  const closePortalSwitch = useCallback(() => {
    setState((s) => ({ ...s, portalSwitchOpen: false }));
  }, []);

  // --- Interview room ---
  const enterInterviewRoom = useCallback(() => {
    setState((s) => ({ ...s, inInterviewRoom: true }));
  }, []);
  const exitInterviewRoom = useCallback(() => {
    setState((s) => ({ ...s, inInterviewRoom: false }));
  }, []);

  // --- Publishing ---
  const openPublishModal = useCallback(() => {
    setState((s) => ({ ...s, publishModalOpen: true }));
  }, []);
  const closePublishModal = useCallback(() => {
    setState((s) => ({ ...s, publishModalOpen: false }));
  }, []);

  const publishToInnerCircle = useCallback(() => {
    setState((s) => {
      const newArticle: FeedItem = {
        id: 'f-kevin-interview',
        hub: 'MEDIA',
        author: 'Jeff Platt',
        kind: 'NEW INTERVIEW',
        title: 'Kevin Martin: The Future of Poker Content',
        body: 'Jeff Platt sits down with Kevin Martin to discuss the evolution of poker content creation, streaming, and where the industry is headed in the next era of the game.',
        cta: 'Read Interview',
        timestamp: 'just now',
        published: true,
        comments: [
          { author: 'Maria Ho', text: 'Great read. Kevin has been ahead of the curve on content for years.' },
          { author: 'Ryan DePaulo', text: 'The streaming section is spot on.' },
        ],
      };
      return {
        ...s,
        publishModalOpen: false,
        interviewPublished: true,
        publishPulse: true,
        feed: [newArticle, ...s.feed],
      };
    });
  }, []);

  const finishPublishPulse = useCallback(() => {
    setState((s) => ({ ...s, publishPulse: false, screen: 'innercircle' }));
  }, []);

  // --- Restricted publish ---
  const openRestrictedPublish = useCallback(() => {
    setState((s) => ({ ...s, publishModalRestricted: true }));
  }, []);
  const closeRestrictedPublish = useCallback(() => {
    setState((s) => ({ ...s, publishModalRestricted: false }));
  }, []);

  // --- Network map (secondary) ---
  const openNetworkMap = useCallback(() => {
    setState((s) => ({ ...s, networkMapOpen: true, originPortal: s.selectedPortal }));
  }, []);
  const closeNetworkMap = useCallback(() => {
    setState((s) => ({ ...s, ...routeToPortal(s, (s.originPortal ?? s.selectedPortal) as HubId), networkMapOpen: false, originPortal: null }));
  }, [routeToPortal]);

  // --- Phase 2 Control Panel ---
  const togglePhase2Panel = useCallback(() => {
    setState((s) => ({ ...s, phase2PanelOpen: !s.phase2PanelOpen }));
  }, []);
  const closePhase2Panel = useCallback(() => {
    setState((s) => ({ ...s, phase2PanelOpen: false }));
  }, []);

  const navigateToPhase2Route = useCallback((routeId: string) => {
    setState((s) => {
      const recent = [routeId, ...s.recentDestinations.filter((r) => r !== routeId)].slice(0, 5);
      return { ...s, recentDestinations: recent, phase2PanelOpen: false };
    });
  }, []);

  // --- Network directory ---
  const openNetworkDirectory = useCallback(() => {
    setState((s) => ({ ...s, networkDirectoryOpen: true }));
  }, []);
  const closeNetworkDirectory = useCallback(() => {
    setState((s) => ({ ...s, networkDirectoryOpen: false, activeHubView: null }));
  }, []);

  // --- Hub view navigation (from directory) ---
  const openHubView = useCallback((hubId: string) => {
    setState((s) => ({ ...s, activeHubView: hubId }));
  }, []);
  const closeHubView = useCallback(() => {
    setState((s) => ({ ...s, activeHubView: null, portalContentView: null }));
  }, []);

  const clearPortalContentView = useCallback(() => {
    setState((s) => ({ ...s, portalContentView: null }));
  }, []);

  const setPendingSpotOpenId = useCallback((spotId: string | null) => {
    setState((s) => ({ ...s, pendingSpotOpenId: spotId }));
  }, []);

  // --- Universal views ---
  // Legal/profile views use state.universalView (rendered directly in App.tsx).
  // Network hub views (jobs, advertising, marketplace, store, performance, help)
  // are handled by the active portal shell (PlayerHub, etc.) — NOT standalone overlays.
  const NETWORK_HUB_VIEWS = new Set(['people', 'opportunities', 'marketplace', 'jobs', 'advertising', 'store', 'performance', 'help', 'privacy', 'terms', 'settings', 'custom-portals']);
  const openUniversalView = useCallback((view: string) => {
    if (NETWORK_HUB_VIEWS.has(view)) {
      // Route through the active portal shell by setting portalContentView
      setState((s) => ({ ...s, portalContentView: view, universalView: null }));
    } else {
      setState((s) => ({ ...s, universalView: view, originPortal: s.selectedPortal }));
    }
  }, []);
  const closeUniversalView = useCallback(() => {
    setState((s) => ({ ...s, universalView: null, portalContentView: null, originPortal: null }));
  }, []);

  // --- Credits panel ---
  const openCreditsPanel = useCallback(() => {
    setState((s) => ({ ...s, creditsPanelOpen: true }));
  }, []);
  const closeCreditsPanel = useCallback(() => {
    setState((s) => ({ ...s, creditsPanelOpen: false }));
  }, []);

  // --- Booth modal ---
  const openBoothModal = useCallback(() => {
    setState((s) => ({ ...s, boothModalOpen: true }));
  }, []);
  const closeBoothModal = useCallback(() => {
    setState((s) => ({ ...s, boothModalOpen: false }));
  }, []);

  // --- Sign-up flow ---
  const openSignUp = useCallback(() => {
    setState((s) => ({ ...s, signUpOpen: true }));
  }, []);
  const closeSignUp = useCallback(() => {
    setState((s) => ({ ...s, signUpOpen: false }));
  }, []);

  const submitSignUp = useCallback(async (data: {
    name: string;
    username: string;
    email: string;
    homePortal: HubId;
    password?: string;
    primaryRole?: string;
    accessCode?: string;
    resolvedPartner?: { partner_slug: string; partner_affiliation: string; hub_access: Record<string, boolean>; entitlements: Record<string, unknown> } | null;
  }): Promise<{ ok: boolean; error?: string }> => {
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return { ok: false, error: 'Please enter a valid email address.' };
    }
    // Validate password — must be at least 10 characters
    const password = data.password ?? '';
    if (!isValidPasswordFormat(password)) {
      return { ok: false, error: 'Password must be at least 10 characters.' };
    }

    // Create the real Supabase Auth user + profile + portal access + role.
    const signUpResult = await signUpNewUser({
      email: data.email,
      password,
      username: data.username,
      displayName: data.name,
      primaryRole: data.primaryRole,
    });

    if (!signUpResult.ok) {
      return { ok: false, error: signUpResult.error ?? 'Sign-up failed.' };
    }

    // Build the account from the database so the app has a SpotVaultAccount.
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setState((s) => ({ ...s, signUpOpen: false }));
      return { ok: true };
    }

    const account = await buildAccountFromSession(session.user.id, data.email);
    if (!account) {
      setState((s) => ({ ...s, signUpOpen: false }));
      return { ok: true };
    }

    addRegisteredAccount(account);
    setAccountPin(account.id, password);
    account.passwordMigrated = true;

    setState((s) => ({
      ...s,
      signUpOpen: false,
      currentAccount: account,
      loginUsername: data.username,
      loginPin: '',
      justSignedUp: true,
    }));
    return { ok: true };
  }, []);

  const demoApprove = useCallback(() => {
    setState((s) => {
      if (!s.pendingAccount) return s;
      const account: SpotVaultAccount = {
        ...s.pendingAccount,
        status: 'active',
        grants: s.pendingAccount.grants.map((g) =>
          g.isHome ? { ...g, status: 'active' as AccountStatus } : g
        ),
      };
      return {
        ...s,
        pendingAccount: null,
        currentAccount: account,
      };
    });
  }, []);

  // --- Access request flow ---
  const openAccessRequest = useCallback((portal: HubId) => {
    setState((s) => ({ ...s, accessRequestOpen: true, accessRequestPortal: portal }));
  }, []);
  const closeAccessRequest = useCallback(() => {
    setState((s) => ({ ...s, accessRequestOpen: false, accessRequestPortal: null }));
  }, []);
  const submitAccessRequest = useCallback((reason: string, credentials: string) => {
    setState((s) => {
      if (!s.accessRequestPortal || !s.currentAccount) return s;
      const request = {
        id: `req-${Date.now()}`,
        portal: s.accessRequestPortal,
        reason,
        credentials,
        status: 'submitted' as const,
      };
      return {
        ...s,
        accessRequestOpen: false,
        accessRequestPortal: null,
        accessRequests: [...s.accessRequests, request],
      };
    });
  }, []);

  // --- Portal access management panel ---
  const openPortalAccessPanel = useCallback(() => {
    setState((s) => ({ ...s, portalAccessPanelOpen: true }));
  }, []);
  const closePortalAccessPanel = useCallback(() => {
    setState((s) => ({ ...s, portalAccessPanelOpen: false }));
  }, []);

  // --- Login credentials ---
  const setLoginUsername = useCallback((username: string) => {
    setState((s) => ({ ...s, loginUsername: username, loginError: null }));
  }, []);

  const setLoginPin = useCallback((pin: string) => {
    setState((s) => ({ ...s, loginPin: pin, loginError: null }));
  }, []);

  // --- Change Password (authenticated) ---
  const changePin = useCallback((accountId: string, currentPin: string, newPin: string): { ok: boolean; error?: string } => {
    if (!verifyPin(accountId, currentPin)) return { ok: false, error: 'Current password is incorrect.' };
    if (!isValidPasswordFormat(newPin)) return { ok: false, error: 'Password must be at least 10 characters.' };
    setAccountPin(accountId, newPin);
    return { ok: true };
  }, []);

  const cancelRecoveryReset = useCallback(() => {
    signOutSupabase().catch(() => {});
    setState((s) => ({
      ...s,
      recoveryResetPending: false,
      recoveryResetError: null,
      recoveryTempPassword: '',
      currentAccount: null,
      loginUsername: '',
      loginPin: '',
    }));
  }, []);

  // --- Email recovery flow (standard Supabase password reset) ---
  // Called when onAuthStateChange fires PASSWORD_RECOVERY — the user clicked
  // the reset link in the email and has a temporary recovery session.
  const beginEmailRecovery = useCallback((account: SpotVaultAccount) => {
    setState((s) => ({
      ...s,
      currentAccount: account,
      loginUsername: account.username || account.email,
      recoveryResetPending: true,
      recoveryTempPassword: '',
      recoveryResetError: null,
    }));
  }, []);

  // Complete the email recovery: uses the recovery session to update the password
  // via supabase.auth.updateUser (standard GoTrue flow, no temp password needed).
  const completeEmailRecoveryReset = useCallback(async (newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    if (!isValidPasswordFormat(newPassword)) {
      return { ok: false, error: 'Password must be at least 10 characters.' };
    }
    try {
      const { supabase } = await import('@/lib/supabase');

      // Verify the recovery session exists and belongs to Jordan
      const { data: sessionData } = await supabase.auth.getSession();
      const recoveryUuid = sessionData?.session?.user?.id;
      const recoveryEmail = sessionData?.session?.user?.email;
      console.log('[AUTH-DEBUG] Recovery session UUID:', recoveryUuid);
      console.log('[AUTH-DEBUG] Recovery session email:', recoveryEmail);

      if (!recoveryUuid) {
        console.error('[AUTH-DEBUG] No active recovery session — cannot update password');
        return { ok: false, error: 'Your recovery session has expired. Please request a new reset link.' };
      }

      if (recoveryUuid !== '17ca0743-ccdb-4d43-ab24-f84aa2821170') {
        console.error('[AUTH-DEBUG] Recovery session UUID mismatch:', recoveryUuid);
        return { ok: false, error: 'Recovery session does not match your account. Please request a new reset link.' };
      }

      console.log('[AUTH-DEBUG] Calling supabase.auth.updateUser with new password...');
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        console.error('[AUTH-DEBUG] updateUser failed:', updateError.code, updateError.message);
        return { ok: false, error: updateError.message };
      }

      const returnedUuid = updateData?.user?.id;
      console.log('[AUTH-DEBUG] updateUser succeeded, returned UUID:', returnedUuid);
      console.log('[AUTH-DEBUG] updateUser returned email:', updateData?.user?.email);

      if (returnedUuid && returnedUuid !== recoveryUuid) {
        console.error('[AUTH-DEBUG] UUID mismatch after updateUser:', returnedUuid, '!=', recoveryUuid);
        return { ok: false, error: 'Password update returned a different user. Please contact support.' };
      }

      // Update succeeded — now sign out the recovery session
      console.log('[AUTH-DEBUG] Password updated. Signing out recovery session...');
      await supabase.auth.signOut();

      // Sync local credential store
      const account = state.currentAccount;
      if (account) {
        setAccountPin(account.id, newPassword);
        markPasswordMigrated(account.id);
      }

      setState((s) => ({
        ...s,
        recoveryResetPending: false,
        recoveryResetError: null,
        recoveryTempPassword: '',
        loginPin: '',
        passwordMigrationPending: false,
        migration2faStep: false,
      }));
      console.log('[AUTH-DEBUG] Recovery reset complete. User can now log in with new password.');
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      console.error('[AUTH-DEBUG] completeEmailRecoveryReset exception:', msg);
      return { ok: false, error: msg };
    }
  }, [state.currentAccount]);

  const clearJustSignedUp = useCallback(() => {
    setState((s) => ({ ...s, justSignedUp: false }));
  }, []);

  // --- Custom Portal Access Codes ---
  const loadPortalMemberships = useCallback(async () => {
    const memberships = await getMyPortalMemberships();
    // Merge in synthetic StakeKings custom portal entries based on partner hub access.
    // StakeKings is not stored in the custom_portals table — it uses a legacy portal ID
    // (STAKEKINGS_PLAYER / STAKEKINGS_ADMIN). These synthetic memberships make it appear
    // in the Switch Experience → Custom list alongside database-backed custom portals.
    const account = stateRef.current.currentAccount;
    const skSlugs = new Set(memberships.map((m) => m.portal_slug));
    if (account?.partnerHubAccess?.['stakekings_hub_access'] && !skSlugs.has('stakekings-player')) {
      memberships.push({
        portal_id: 'stakekings-player',
        portal_slug: 'stakekings-player',
        portal_name: 'StakeKings',
        base_portal: 'STAKEKINGS_PLAYER',
        config: {},
        status: 'active',
        access_expires_at: '',
        membership_tier: 'full',
        entitlement_package: {},
        category: 'partner',
      });
    }
    if (account?.partnerHubAccess?.['stakekings_admin_access'] && !skSlugs.has('stakekings-admin')) {
      memberships.push({
        portal_id: 'stakekings-admin',
        portal_slug: 'stakekings-admin',
        portal_name: 'StakeKings Admin',
        base_portal: 'STAKEKINGS_PLAYER',
        config: {},
        status: 'active',
        access_expires_at: '',
        membership_tier: 'full',
        entitlement_package: {},
        category: 'partner',
      });
    }
    setState((s) => ({ ...s, customPortalMemberships: memberships }));
  }, []);

  const handlePortalRedeemed = useCallback((membership: CustomPortalMembership) => {
    setState((s) => {
      const existing = s.customPortalMemberships.filter((m) => m.portal_slug !== membership.portal_slug);
      return { ...s, customPortalMemberships: [...existing, membership] };
    });
  }, []);

  return {
    state,
    actions: {
      reset,
      startLogin,
      grantAccess,
      finishVault,
      checkQuickPinAvailability,
      quickPinLogin,
      acceptInvite,
      declineInvite,
      goToInnerCircle,
      goBackToHub,
      returnToAccessPortal,
      enterInterviewRoom,
      exitInterviewRoom,
      openPublishModal,
      closePublishModal,
      publishToInnerCircle,
      finishPublishPulse,
      openRestrictedPublish,
      closeRestrictedPublish,
      openNetworkMap,
      closeNetworkMap,
      openNetworkDirectory,
      closeNetworkDirectory,
      openHubView,
      closeHubView,
      clearPortalContentView,
      setPendingSpotOpenId,
      openCreditsPanel,
      closeCreditsPanel,
      openBoothModal,
      closeBoothModal,
      setSelectedPortal,
      confirmPortalSelection,
      switchPortal,
      togglePortalSwitch,
      closePortalSwitch,
      openSignUp,
      closeSignUp,
      submitSignUp,
      demoApprove,
      openAccessRequest,
      closeAccessRequest,
      submitAccessRequest,
      openPortalAccessPanel,
      closePortalAccessPanel,
      setLoginUsername,
      setLoginPin,
      changePin,
      togglePhase2Panel,
      closePhase2Panel,
      navigateToPhase2Route,
      openUniversalView,
      closeUniversalView,
      clearJustSignedUp,
      completeMfaLogin,
      cancelMfaLogin,
      setMfaRememberDevice,
      completePasswordMigration,
      cancelPasswordMigration,
      completeMigration2fa,
      cancelRecoveryReset,
      beginEmailRecovery,
      completeEmailRecoveryReset,
      autoLogin,
      loadPortalMemberships,
      handlePortalRedeemed,
    },
  };
}

export type Demo = ReturnType<typeof useDemo>;
