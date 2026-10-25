import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Users, Handshake, Plus, BriefcaseBusiness, PenTool, Building2, Music, FlaskConical } from 'lucide-react';
import { useDemo, type PortalId } from '@/useDemo';
import { AccessScreen } from '@/components/AccessScreen';
import { MfaChallengeScreen } from '@/components/MfaChallengeScreen';
import { VaultTumbler } from '@/components/VaultTumbler';
import { PlayerHub } from '@/components/PlayerHub';
import { PlayerNetwork } from '@/components/PlayerNetwork';
import { InvestorHub, InvestorChatFloor, PortalChatEdgeTab } from '@/components/InvestorHub';
import { MediaRoom, MediaSecondFloor } from '@/components/MediaRoom';
import { PortalRoomShell, PortalSecondFloor } from '@/components/PortalRoomShell';
import { CommunityHub } from '@/components/CommunityHub';
import { NetworkMap } from '@/components/NetworkMap';
import { NetworkDirectory } from '@/components/NetworkDirectory';
import { CreditsPanel } from '@/components/CreditsPanel';
import { BusinessRoom, BusinessSecondFloor } from '@/components/BusinessRoom';
import { BusinessHub } from '@/components/BusinessHub';
import { CreatorComposer } from '@/components/CreatorComposer';
import { SpotMediaPlayer } from '@/components/player/SpotMediaPlayer';
import { CreatorHub } from '@/components/CreatorHub';
import { ProfilePage } from '@/components/ProfilePage';
import { ProfileViewer } from '@/components/shared/ProfileViewer';
import { MessagingCenter } from '@/components/messaging/MessagingCenter';
import { Store } from '@/components/Store';
import { PerformanceCenter } from '@/components/PerformanceCenter';

import { ExpoHub } from '@/components/ExpoHub';
import { HubPreview } from '@/components/HubPreview';
import { HelpHub } from '@/components/HelpHub';
import { ProTalentHub } from '@/components/ProTalentHub';
import { CoachHub } from '@/components/CoachHub';
import { Phase2ControlPanel } from '@/components/Phase2ControlPanel';
import { CanonicalFloorTabs } from '@/components/CanonicalFloorTabs';

import type { Phase2Route } from '@/data/phase2Routes';
import { PublishModal, RestrictedPublishModal } from '@/components/Modals';
import { SignUpScreen, PendingApprovalScreen, AccessRequestModal, PortalAccessPanel } from '@/components/SignUpScreen';

import { CommunityFund } from '@/components/CommunityFund';
import { canAccessPortal, HUB_LABELS, type HubId, type SpotVaultAccount } from '@/types';
import { PortalComingSoon } from '@/components/PortalComingSoon';
import { StaffHub } from '@/components/StaffHub';
import { SolverHub } from '@/components/solver/SolverHub';
import { PrivacyPolicyPage } from '@/components/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/components/TermsOfServicePage';
import { AboutExperience } from '@/components/AboutExperience';
import { CustomPortalsBrowser } from '@/components/CustomPortalsBrowser';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';
import { isSuperUser, isStaffOrAdmin, ALL_PORTAL_IDS } from '@/types';
import { useNavState, getCurrentScreen, type NavPortal } from '@/lib/navigation';
import { StableHub } from '@/components/StableHub';
import { StakeKingsPlayerPortal } from '@/components/stakekings/StakeKingsPlayerPortal';
import { StakeKingsOnboarding } from '@/components/stakekings/StakeKingsOnboarding';
import { getStakeKingsBackground } from '@/lib/stakekingsBranding';
import { getCustomPortalBackground } from '@/lib/portalBackgrounds';
import { ScreenDebugOverlay } from '@/debug/ScreenDebugOverlay';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MobileAppShell } from '@/components/mobile/MobileAppShell';
import { CinematicEntrance } from '@/components/CinematicEntrance';
import { onOpenProfileFallback, onMessageUser, onOpenMessaging, onOpenProfileSettings } from '@/lib/profileEvents';
import { onOpenGiftModal, type GiftModalRequest } from '@/lib/giftEvents';
import { GiftSpotModal } from '@/components/shared/GiftSpotModal';
import { SharedHandReplayerModal } from '@/components/player/SharedHandReplayerModal';
import { isRememberMeEnabled, setRememberMe as persistRememberMe, supabase } from '@/lib/supabase';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { signOutSupabase } from '@/lib/mfaAuth';
import { recordVisit } from '@/lib/visitTracker';
import { restoreSessionAccount } from '@/lib/authService';
import { hasSKEntryFlag, acquireUserAttribution, clearSKEntry } from '@/lib/skAttribution';
import { clearAllMembershipCache } from '@/lib/membershipStore';

export default function App() {
  const demo = useDemo();
  const { state, actions } = demo;
  const { nav, login, logout, navigateVertical, setPortal, hardReset } = useNavState();

  const [portalChatActive, setPortalChatActive] = useState(false);
  const [playerChatActive, setPlayerChatActive] = useState(false);
  const [communityFundOpen, setCommunityFundOpen] = useState(false);
  const [globalCommunityOpen, setGlobalCommunityOpen] = useState(false);
  const [entranceActive, setEntranceActive] = useState(false);
  const [entrancePhase, setEntrancePhase] = useState<'idle' | 'authenticating' | 'entranceAnimation' | 'complete'>('idle');
  const [reducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [creatorComposerOpen, setCreatorComposerOpen] = useState(false);
  const [profilePageOpen, setProfilePageOpen] = useState<{ accountId: string; isOwn: boolean; initialTab?: 'about' | 'network' | 'accolades' | 'activity' } | null>(null);
  const [messagingInitialWith, setMessagingInitialWith] = useState<string | null>(null);
  const [messagingInitialTab, setMessagingInitialTab] = useState<'chats' | 'groups' | 'inbox' | 'activity'>('chats');
  const [preLoginLegal, setPreLoginLegal] = useState<'privacy' | 'terms' | null>(null);
  const [preLoginAbout, setPreLoginAbout] = useState(false);

  const [customPortalsOpen, setCustomPortalsOpen] = useState(false);
  const [activeCustomPortal, setActiveCustomPortal] = useState<CustomPortalMembership | null>(null);
  const [giftModalReq, setGiftModalReq] = useState<GiftModalRequest | null>(null);

  // Detect /sk entry SYNCHRONOUSLY so AccessScreen renders SK branding on the
  // very first paint. A useEffect-based detection would run after first render,
  // causing the normal SpotVault login to flash before SK branding appears.
  const [skOnboard, setSkOnboard] = useState(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    return path === '/sk/onboard' || path.startsWith('/sk/onboard');
  });

  const [skEntry, setSkEntry] = useState(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    // Match /sk, /sk/, /sk/anything — but NOT /sky or /skate
    // /sk/onboard is handled separately by skOnboard state
    if (path === '/sk' || (path.startsWith('/sk/') && !path.startsWith('/sk/onboard'))) {
      try { sessionStorage.setItem('spotvault-sk-entry', 'true'); } catch { /* ignore */ }
      return true;
    }
    try {
      return sessionStorage.getItem('spotvault-sk-entry') === 'true';
    } catch {
      return false;
    }
  });

  // Clean the URL and parse referral params AFTER the synchronous SK detection
  // has already set skEntry. This effect runs once on mount.
  useEffect(() => {
    // Normalize /sk → / so the app starts at root, but ONLY after skEntry
    // state has been synchronously set above. The state is already true,
    // so cleaning the URL cannot destroy the SK UI.
    const path = window.location.pathname;
    // Don't clean URL for /sk/onboard — the onboarding component needs the ?token= param
    if ((path === '/sk' || path.startsWith('/sk/')) && !path.startsWith('/sk/onboard')) {
      window.history.replaceState({}, '', '/');
    }
    const params = new URLSearchParams(window.location.search);
    const partner = params.get('partner');
    const refToken = params.get('ref') ?? params.get('referral');
    if (partner === 'stakekings' && refToken) {
      try {
        window.localStorage.setItem('spotvault-pending-referral', JSON.stringify({ partner: 'stakekings', token: refToken, ts: Date.now() }));
      } catch { /* ignore */ }
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // After signup or login, if the user entered through /sk, auto-attribute GROUP=SK.
  // This runs once when a new account is created or when an existing user logs in
  // from the /sk route. For existing non-SK users, the RPC safely does NOT overwrite
  // their existing attribution.
  useEffect(() => {
    if (state.currentAccount && hasSKEntryFlag()) {
      void acquireUserAttribution('SK').then(() => {
        clearSKEntry();
      });
    }
  }, [state.currentAccount]);

  // A StakeKings entry can only route into the dedicated portal after the
  // authenticated account proves StakeKings access through the server-built account.
  useEffect(() => {
    if (
      state.currentAccount?.partnerHubAccess?.stakekings_hub_access === true &&
      state.portalSelectionPending
    ) {
      actions.setSelectedPortal('STAKEKINGS_PLAYER');
    }
  }, [actions, state.currentAccount, state.portalSelectionPending]);
  const [rememberPortal, setRememberPortalState] = useState(false);
  const userPrefs = useUserPreferences(state.currentAccount?.id);

  // Sync rememberPortal from user preferences
  useEffect(() => {
    if (!userPrefs.loading && userPrefs.prefs.rememberPortal) {
      setRememberPortalState(true);
    }
  }, [userPrefs.loading, userPrefs.prefs.rememberPortal]);

  // --- AUTO-LOGIN: restore session if Remember Me was enabled ---
  // If Remember Me is NOT enabled, sign out any lingering Supabase session.
  useEffect(() => {
    // Do NOT sign out if the URL contains a recovery token — the
    // PASSWORD_RECOVERY session must survive so updateUser can set a new password.
    const urlHasRecoveryToken = typeof window !== 'undefined'
      && (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery'));
    if (!isRememberMeEnabled() && !urlHasRecoveryToken) {
      signOutSupabase().catch(() => {});
    }
    recordVisit();
  }, []);

  // --- Supabase auth state listener: handle token refresh failures ---
  // On production, if the token refresh fails (expired, revoked, network error),
  // the user should be gracefully logged out rather than stuck in a broken state.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        // Token successfully refreshed — nothing to do
      } else if (event === 'PASSWORD_RECOVERY' && session?.user) {
        // User clicked the password reset link in the email.
        // Build the account from the recovery session and show the reset modal.
        console.log('[AUTH-DEBUG] PASSWORD_RECOVERY event, user:', session.user.id, 'email:', session.user.email);
        import('@/lib/authService').then(({ buildAccountFromSession }) => {
          buildAccountFromSession(session.user.id, session.user.email ?? '').then((account) => {
            if (account) {
              actions.beginEmailRecovery(account);
            } else {
              console.error('[AUTH-DEBUG] buildAccountFromSession failed during recovery');
            }
          });
        });
      } else if (event === 'SIGNED_OUT' || event === 'USER_REMOVED') {
        clearAllMembershipCache();
        if (state.currentAccount && !state.recoveryResetPending) {
          actions.reset();
        }
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isRememberMeEnabled()) {
          const account = await restoreSessionAccount();
          if (cancelled) return;
          if (account) {
            let targetPortal: HubId = account.homePortal;
            let rememberedCustomPortalSlug: string | null = null;
            // Only restore into a custom portal if the account has a designated
            // default lounge (is_default=true in lounge_memberships). This prevents
            // the founder and other non-dedicated accounts from being hijacked into
            // a custom portal they previously visited.
            if (userPrefs.prefs.rememberPortal && account.defaultLoungeSlug) {
              const saved = window.localStorage.getItem('spotvault-last-portal');
              if (saved && canAccessPortal(account, saved as HubId)) {
                targetPortal = saved as HubId;
              }
              rememberedCustomPortalSlug = window.localStorage.getItem('spotvault-last-custom-portal');
            } else if (!account.defaultLoungeSlug) {
              // Non-dedicated accounts: clear any stale custom portal state on restore
              window.localStorage.removeItem('spotvault-last-custom-portal');
              window.localStorage.removeItem('spotvault-last-portal');
            }
            if (!canAccessPortal(account, targetPortal)) {
              targetPortal = ALL_PORTAL_IDS.find((p) => canAccessPortal(account, p)) ?? account.homePortal;
            }
            if (account.partnerHubAccess?.stakekings_hub_access === true) {
              targetPortal = 'STAKEKINGS_PLAYER';
            }
            actions.autoLogin(account, targetPortal);
            if (rememberedCustomPortalSlug) {
              window.localStorage.setItem('spotvault-pending-custom-portal', rememberedCustomPortalSlug);
            }
            logout();
            return;
          }
        }
        logout();
      } catch (err) {
        console.error('[AUTH] Session restore failed:', err);
        if (!cancelled) logout();
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPrefs.loading]);
  const loginUsernameRef = useRef(state.loginUsername);
  loginUsernameRef.current = state.loginUsername;
  const entranceCompleteRef = useRef(false);

  const currentScreen = getCurrentScreen(nav);
  const currentScreenRef = useRef(currentScreen);
  currentScreenRef.current = currentScreen;

  // --- Check Quick PIN availability on mount ---
  // If there's a persisted Supabase session + trusted device + PIN set,
  // show the "Use Quick PIN" option on the login screen.
  useEffect(() => {
    actions.checkQuickPinAvailability();
  }, [actions.checkQuickPinAvailability]);

  useEffect(() => {
    // Only reset useDemo state when transitioning to LOGGED_OUT without
    // an active account. When autoLogin sets state.currentAccount before
    // transitioning nav to LOGGED_OUT, skip the reset so the account survives.
    if (nav.authState === 'LOGGED_OUT' && !state.currentAccount) {
      actions.reset();
      entranceCompleteRef.current = false;
    }
  }, [nav.authState, actions.reset, state.currentAccount]);

  // --- LOGIN ---
  // Explicit state machine: idle → authenticating → entranceAnimation → complete
  // Destination content is blocked until the animation fires its completion callback.
  // ASYNC: waits for the Supabase MFA check before starting the entrance animation.
  // If MFA is required, the MfaChallengeScreen overlay appears (z-200) and blocks
  // all access until the user verifies. The entrance animation only fires after
  // completeMfaLogin() succeeds and mfaPending is cleared.
  const [loginLoading, setLoginLoading] = useState(false);

  const handleEnter = async () => {
    setLoginLoading(true);
    const result = await actions.startLogin();
    setLoginLoading(false);

    if (!result) return false;

    // MFA required — do NOT start the entrance animation.
    // The MfaChallengeScreen overlay (z-200) will appear and block access.
    // After completeMfaLogin() succeeds, mfaPending is cleared and we
    // need to trigger the entrance animation here.
    if (!result.authenticated && result.needsMfa) {
      return true;
    }

    if (!result.authenticated) return false;

    // If password migration is required (legacy PIN user), do NOT start
    // the entrance animation. The migration modal will appear instead.
    if ((result as { requiresMigration?: boolean }).requiresMigration) return true;

    // If the account has multiple authorized portals, the entrance animation
    // is deferred until the user confirms their portal choice (Stage 2).
    if (result.needsPortalSelection) return true;

    entranceCompleteRef.current = false;
    setEntrancePhase('authenticating');
    // Start entrance animation on next frame so the overlay mounts at full opacity
    requestAnimationFrame(() => {
      setEntrancePhase('entranceAnimation');
      setEntranceActive(true);
    });
    return true;
  };

  // After MFA verification succeeds, mfaPending is cleared by completeMfaLogin.
  // This effect watches for that transition and fires the entrance animation.
  const prevMfaPendingRef = useRef(false);
  useEffect(() => {
    const wasPending = prevMfaPendingRef.current;
    prevMfaPendingRef.current = state.mfaPending;

    // If MFA was pending and is now cleared, and the user is still logged in,
    // fire the entrance animation — unless password migration is required.
    if (wasPending && !state.mfaPending && state.currentAccount && nav.authState === 'LOGGED_OUT') {
      if (state.passwordMigrationPending || state.migration2faStep || state.portalSelectionPending) return;
      entranceCompleteRef.current = false;
      setEntrancePhase('authenticating');
      requestAnimationFrame(() => {
        setEntrancePhase('entranceAnimation');
        setEntranceActive(true);
      });
    }
  }, [state.mfaPending, state.currentAccount, state.portalSelectionPending, nav.authState]);

  // After Quick PIN login succeeds, fire the entrance animation.
  const prevQuickPinAvailableRef = useRef(false);
  useEffect(() => {
    const wasAvailable = prevQuickPinAvailableRef.current;
    prevQuickPinAvailableRef.current = state.quickPinAvailable;

    // If quickPinAvailable went from true to false AND we have an account,
    // the PIN was just verified — fire the entrance animation.
    if (wasAvailable && !state.quickPinAvailable && state.currentAccount && nav.authState === 'LOGGED_OUT') {
      if (state.passwordMigrationPending || state.migration2faStep || state.portalSelectionPending) return;
      entranceCompleteRef.current = false;
      setEntrancePhase('authenticating');
      requestAnimationFrame(() => {
        setEntrancePhase('entranceAnimation');
        setEntranceActive(true);
      });
    }
  }, [state.quickPinAvailable, state.currentAccount, state.portalSelectionPending, state.passwordMigrationPending, state.migration2faStep, nav.authState]);

  // After password migration completes, fire the entrance animation.
  const prevMigrationPendingRef = useRef(false);
  useEffect(() => {
    const wasPending = prevMigrationPendingRef.current;
    prevMigrationPendingRef.current = state.passwordMigrationPending;

    if (wasPending && !state.passwordMigrationPending && !state.migration2faStep && state.currentAccount && nav.authState === 'LOGGED_OUT') {
      if (state.portalSelectionPending) return;
      entranceCompleteRef.current = false;
      setEntrancePhase('authenticating');
      requestAnimationFrame(() => {
        setEntrancePhase('entranceAnimation');
        setEntranceActive(true);
      });
    }
  }, [state.passwordMigrationPending, state.currentAccount, state.portalSelectionPending, nav.authState]);

  // After recovery reset completes, fire the entrance animation.
  const prevRecoveryPendingRef = useRef(false);
  useEffect(() => {
    const wasPending = prevRecoveryPendingRef.current;
    prevRecoveryPendingRef.current = state.recoveryResetPending;

    if (wasPending && !state.recoveryResetPending && state.currentAccount && nav.authState === 'LOGGED_OUT') {
      if (state.portalSelectionPending || state.passwordMigrationPending || state.migration2faStep) return;
      entranceCompleteRef.current = false;
      setEntrancePhase('authenticating');
      requestAnimationFrame(() => {
        setEntrancePhase('entranceAnimation');
        setEntranceActive(true);
      });
    }
  }, [state.recoveryResetPending, state.currentAccount, state.portalSelectionPending, state.passwordMigrationPending, state.migration2faStep, nav.authState]);

  // --- AUTO-LOGIN AFTER SIGNUP ---
  // When a new account is created (non-approval), auto-login into Player portal.
  useEffect(() => {
    if (state.justSignedUp && state.currentAccount && nav.authState === 'LOGGED_OUT') {
      entranceCompleteRef.current = false;
      setEntrancePhase('authenticating');
      requestAnimationFrame(() => {
        setEntrancePhase('entranceAnimation');
        setEntranceActive(true);
      });
      actions.clearJustSignedUp();
    }
  }, [state.justSignedUp, state.currentAccount, nav.authState, actions.clearJustSignedUp]);

  const handleConfirmPortal = () => {
    // If a custom portal was selected (CUSTOM_ prefix), set it as active and route to its base portal
    const selected = state.selectedPortal as string;
    if (selected.startsWith('CUSTOM_')) {
      const slug = selected.slice(7);
      const membership = state.customPortalMemberships.find((m) => m.portal_slug === slug);
      if (membership) {
        setActiveCustomPortal(membership);
        actions.setSelectedPortal((membership.base_portal || 'PLAYER') as HubId);
      }
    } else {
      setActiveCustomPortal(null);
    }
    // Auto-route to default lounge if the account has a designated default custom portal
    if (!selected.startsWith('CUSTOM_') && state.currentAccount?.defaultLoungeSlug) {
      const membership = state.customPortalMemberships.find((m) => m.portal_slug === state.currentAccount!.defaultLoungeSlug);
      if (membership) {
        setActiveCustomPortal(membership);
        actions.setSelectedPortal((membership.base_portal || 'PLAYER') as HubId);
      }
    }
    // Save portal preference if Remember My Portal is enabled.
    // Only persist custom portal context for dedicated portal accounts (those with
    // defaultLoungeSlug). For the founder and other non-dedicated accounts, Remember
    // My Portal saves the base portal only — a fresh login always starts in Default Player.
    if (rememberPortal && state.currentAccount) {
      void userPrefs.setRememberPortal(true);
      if (state.currentAccount.defaultLoungeSlug && activeCustomPortal) {
        window.localStorage.setItem('spotvault-last-portal', state.selectedPortal);
        window.localStorage.setItem('spotvault-last-custom-portal', activeCustomPortal.portal_slug);
      } else {
        window.localStorage.setItem('spotvault-last-portal', state.currentAccount.homePortal);
        window.localStorage.removeItem('spotvault-last-custom-portal');
      }
    } else if (state.currentAccount) {
      void userPrefs.setRememberPortal(false);
      window.localStorage.removeItem('spotvault-last-custom-portal');
    }
    actions.confirmPortalSelection();
    entranceCompleteRef.current = false;
    setEntrancePhase('authenticating');
    requestAnimationFrame(() => {
      setEntrancePhase('entranceAnimation');
      setEntranceActive(true);
    });
  };

  // Load custom portal memberships when user reaches portal selection
  useEffect(() => {
    if (state.portalSelectionPending && state.currentAccount) {
      actions.loadPortalMemberships();
    }
  }, [state.portalSelectionPending, state.currentAccount]);

  // Also load portal memberships whenever the account changes (not just during
  // portal selection) so the Switch Experience dropdown shows custom portals
  // for already-logged-in users restoring a session.
  useEffect(() => {
    if (state.currentAccount && !state.portalSelectionPending && state.customPortalMemberships.length === 0) {
      actions.loadPortalMemberships();
    }
  }, [state.currentAccount, state.portalSelectionPending, state.customPortalMemberships.length]);

  // Auto-redirect accounts that have a designated default custom portal (is_default=true
  // in lounge_memberships, loaded as account.defaultLoungeSlug). This applies to dedicated
  // portal accounts like Peak6 → Poker Power. The founder and other users without a default
  // lounge membership are NOT auto-redirected — they see the normal portal picker.
  const autoConfirmedRef = useRef(false);
  useEffect(() => {
    if (
      state.portalSelectionPending &&
      state.currentAccount?.defaultLoungeSlug &&
      state.customPortalMemberships.length > 0 &&
      !window.localStorage.getItem('spotvault-pending-custom-portal') &&
      !autoConfirmedRef.current
    ) {
      const membership = state.customPortalMemberships.find(
        (m) => m.portal_slug === state.currentAccount!.defaultLoungeSlug,
      );
      if (membership) {
        const customKey = `CUSTOM_${membership.portal_slug}`;
        autoConfirmedRef.current = true;
        actions.setSelectedPortal(customKey as HubId);
        setActiveCustomPortal(membership);
        if (rememberPortal && state.currentAccount) {
          window.localStorage.setItem('spotvault-last-portal', customKey);
          window.localStorage.setItem('spotvault-last-custom-portal', membership.portal_slug);
        }
        actions.confirmPortalSelection();
        entranceCompleteRef.current = false;
        setEntrancePhase('authenticating');
        requestAnimationFrame(() => {
          setEntrancePhase('entranceAnimation');
          setEntranceActive(true);
        });
      }
    }
  }, [state.portalSelectionPending, state.customPortalMemberships, state.currentAccount, state.selectedPortal, actions, rememberPortal]);

  // Restore remembered custom portal context after memberships load
  useEffect(() => {
    const pendingSlug = window.localStorage.getItem('spotvault-pending-custom-portal');
    if (pendingSlug && state.customPortalMemberships.length > 0 && state.currentAccount) {
      const membership = state.customPortalMemberships.find((m) => m.portal_slug === pendingSlug);
      if (membership) {
        setActiveCustomPortal(membership);
        actions.setSelectedPortal((membership.base_portal || 'PLAYER') as HubId);
      }
      window.localStorage.removeItem('spotvault-pending-custom-portal');
    }
  }, [state.customPortalMemberships, state.currentAccount]);

  const handleEntranceComplete = useCallback(() => {
    if (entranceCompleteRef.current) return;
    entranceCompleteRef.current = true;

    const rawPortal = state.selectedPortal as string;
    // Strip CUSTOM_ prefix — custom portals ride on top of their base portal (e.g. PLAYER)
    const targetPortal = (rawPortal.startsWith('CUSTOM_') ? 'PLAYER' : rawPortal) as HubId;
    login(targetPortal);
    setEntrancePhase('complete');
    setEntranceActive(false);
  }, [login, state.selectedPortal]);

  const openUserProfile = useCallback((accountId: string) => {
    setProfilePageOpen({ accountId, isOwn: false });
  }, []);

  const messageUser = useCallback((accountId: string) => {
    if (state.currentAccount) {
      setMessagingInitialTab('chats');
      setMessagingInitialWith(accountId);
      actions.openMessaging();
    }
  }, [state.currentAccount, actions]);

  // --- VERTICAL NAVIGATION (canonical owner) ---
  const handleNavigateUp = () => navigateVertical('UP', 'UP_TAB');
  const handleNavigateDown = () => navigateVertical('DOWN', 'DOWN_TAB');
  const handleNavigateRight = () => navigateVertical('RIGHT', 'SWIPE');
  const handleNavigateLeft = () => navigateVertical('LEFT', 'SWIPE');

  const isMobile = useMediaQuery('(max-width: 768px)');

  // Suppress edge-arrow navigation when any modal/overlay is open.
  // This prevents accidental navigation when dragging/selecting text inside modal inputs.
  const navDisabled = Boolean(
    state.mfaPending ||
    state.passwordMigrationPending ||
    state.migration2faStep ||
    state.portalSelectionPending ||
    state.signUpOpen ||
    state.pendingAccount ||
    state.accessRequestOpen ||
    state.portalAccessPanelOpen ||
    state.publishModalOpen ||
    state.publishModalRestricted ||
    state.networkMapOpen ||
    state.networkDirectoryOpen ||
    state.creditsPanelOpen ||
    state.phase2PanelOpen ||
    state.boothModalOpen ||
    state.universalView ||
    (currentScreen !== 'PLAYER_ROOM' && (state.portalContentView || state.activeHubView)) ||
    entranceActive ||
    entrancePhase === 'entranceAnimation' ||
    state.tumblerPhase === 'active' ||
    preLoginLegal ||
    profilePageOpen ||
    creatorComposerOpen ||
    communityFundOpen ||
    portalChatActive ||
    playerChatActive
  );

  // --- LOGOUT / RESET ---
  const handleReset = () => {
    autoConfirmedRef.current = false;
    persistRememberMe(false);
    signOutSupabase().catch(() => {});
    logout();
    actions.reset();
  };

  const handleExitHub = () => {
    const home = state.currentAccount?.homePortal ?? 'PLAYER';
    setActiveCustomPortal(null);
    actions.clearPortalContentView();
    actions.closePortalSwitch();
    setPortal(home as NavPortal);
    actions.switchPortal(home as HubId);
  };

  // Return from a lounge back to the custom portal's home screen.
  // --- PORTAL SWITCH (horizontal — not used for Player test) ---
  const handleSwitchPortal = (portal: HubId) => {
    // Redirect legacy Investor/Affiliate portals to Business Hub
    const canonicalPortal = portal === 'PARTNERSHIPS' || portal === 'INVESTOR' || portal === 'AFFILIATE_PARTNER' ? 'BUSINESS' : portal;

    // Standard SpotVault roles always leave any custom portal context behind.
    setActiveCustomPortal(null);
    actions.clearPortalContentView();
    actions.closePortalSwitch();

    if (!state.currentAccount || !canAccessPortal(state.currentAccount, canonicalPortal)) {
      actions.switchPortal(canonicalPortal);
      return;
    }

    setPortal(canonicalPortal as NavPortal);
    actions.switchPortal(canonicalPortal);
  };

  const handleDirectoryEnter = (hubId: string) => {
    if (hubId === 'investor' || hubId === 'business' || hubId === 'affiliate') {
      handleSwitchPortal('BUSINESS');
      return;
    }
    if (hubId === 'media') {
      handleSwitchPortal('MEDIA');
      return;
    }
    actions.openHubView(hubId);
  };

  const handleReturnHome = () => {
    const home = state.currentAccount?.homePortal ?? 'PLAYER';
    actions.setSelectedPortal(home as HubId);
    actions.finishVault();
  };

  // Return to default SpotVault from a custom portal — clears portal context and switches to PLAYER
  const handleReturnToDefault = () => {
    setActiveCustomPortal(null);
    actions.clearPortalContentView();
    setPortal('PLAYER');
    actions.switchPortal('PLAYER');
    actions.closePortalSwitch();
  };

  // Enter a custom portal (lounge) — sets active portal, switches base, and persists
  // the lounge slug as the user's default lounge preference for next session restore.
  const handleEnterCustomPortal = useCallback((portal: CustomPortalMembership) => {
    actions.clearPortalContentView();
    setActiveCustomPortal(portal);
    const base = (portal.base_portal || 'PLAYER') as NavPortal;
    setPortal(base, 'PLAYER_HUB');
    actions.switchPortal(base);
    if (portal.portal_slug) {
      void userPrefs.save({ defaultLoungeSlug: portal.portal_slug });
    }
  }, [actions, userPrefs]);

  const handlePhase2Navigate = (route: Phase2Route) => {
    const act = route.action;

    if (act.startsWith('portal:')) {
      const portal = act.split(':')[1] as HubId;
      handleSwitchPortal(portal);
      actions.navigateToPhase2Route(route.id);
      return;
    }

    if (act === 'community-fund') { setCommunityFundOpen(true); actions.navigateToPhase2Route(route.id); return; }
    if (act === 'network') { actions.openNetworkDirectory(); actions.navigateToPhase2Route(route.id); return; }
    if (act === 'credits') { actions.openCreditsPanel(); actions.navigateToPhase2Route(route.id); return; }
    if (act === 'solver') { return; }

    if (act.startsWith('talent:')) { actions.openHubView('pro'); actions.navigateToPhase2Route(route.id); return; }
    if (act.startsWith('player:')) { actions.switchPortal('PLAYER'); actions.navigateToPhase2Route(route.id); return; }
    if (act.startsWith('coach:')) { actions.openHubView('coach'); actions.navigateToPhase2Route(route.id); return; }
    if (act.startsWith('stable:')) { handleSwitchPortal('STABLE'); actions.navigateToPhase2Route(route.id); return; }
    if (act.startsWith('media:')) {
      handleSwitchPortal('MEDIA');
      actions.navigateToPhase2Route(route.id);
      return;
    }
    if (act.startsWith('business:')) { actions.openHubView('business'); actions.navigateToPhase2Route(route.id); return; }
    if (act.startsWith('industry:')) { actions.openHubView('jobs'); actions.navigateToPhase2Route(route.id); return; }
    if (act.startsWith('system:')) {
      if (act === 'system:portal-selector') { handleReset(); actions.navigateToPhase2Route(route.id); return; }
      if (act === 'system:community') { navigateVertical('UP', 'PHASE2'); actions.navigateToPhase2Route(route.id); return; }
      if (act === 'system:credits') { actions.openCreditsPanel(); actions.navigateToPhase2Route(route.id); return; }
      if (act === 'system:access-manager') { actions.openPortalAccessPanel(); actions.navigateToPhase2Route(route.id); return; }
      actions.navigateToPhase2Route(route.id);
      return;
    }

    actions.navigateToPhase2Route(route.id);
  };

  // Keyboard shortcut for Phase 2 Control Panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        actions.togglePhase2Panel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions.togglePhase2Panel]);

  // Listen for global profile/message events from any component
  useEffect(() => {
    const unsubProfile = onOpenProfileFallback((accountId, isOwn) => {
      setProfilePageOpen({ accountId, isOwn });
    });
    const unsubGift = onOpenGiftModal((req) => {
      setGiftModalReq(req);
    });
    const unsubMessage = onMessageUser((accountId) => {
      if (state.currentAccount) {
        setMessagingInitialTab('chats');
        setMessagingInitialWith(accountId);
        actions.openMessaging();
      }
    });
    const unsubMessaging = onOpenMessaging((tab) => {
      if (state.currentAccount) {
        setMessagingInitialTab(tab ?? 'chats');
        setMessagingInitialWith(null);
        actions.openMessaging();
      }
    });
    const unsubProfileSettings = onOpenProfileSettings(() => {
      if (currentScreenRef.current !== 'PLAYER_ROOM') {
        handleExitHub();
      }
    });
    return () => { unsubProfile(); unsubGift(); unsubMessage(); unsubMessaging(); unsubProfileSettings(); };
  }, [state.currentAccount]);

  const currentLocationLabel = useMemo(() => {
    if (currentScreen === 'LOGIN') return 'Login';
    if (currentScreen === 'PLAYER_ROOM') return 'Player Room';
    if (currentScreen === 'PLAYER_COMMUNITY') return 'Player Community';
    if (currentScreen === 'PLAYER_CHAT') return 'Lounge';
    if (currentScreen === 'INVESTOR_ROOM') return 'Investor Room';
    if (currentScreen === 'INVESTOR_COMMUNITY') return 'Investor Community';
    if (currentScreen === 'INVESTOR_CHAT') return 'Investor Chat';
    if (state.networkDirectoryOpen && state.activeHubView) {
      const viewLabel = state.activeHubView.charAt(0).toUpperCase() + state.activeHubView.slice(1);
      return `Network → ${viewLabel}`;
    }
    if (state.networkDirectoryOpen) return 'Network Directory';
    return 'SpotVault';
  }, [currentScreen, state.networkDirectoryOpen, state.activeHubView]);

  const handleRequestAccessFromDenied = () => {
    actions.finishVault();
    if (state.tumblerTarget) {
      actions.openAccessRequest(state.tumblerTarget);
    }
  };

  // --- CANONICAL RENDER SWITCH ---
  // Only ONE primary surface is mounted at a time for the Player path.
  // Other portals still use legacy rendering temporarily.

  const showLegacyPortal =
    currentScreen === 'INVESTOR_ROOM' &&
    state.tumblerPhase === 'idle' &&
    !state.signUpOpen &&
    !state.pendingAccount;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050608] text-[#c7cfd8]">
      {/* ===== STAKEKINGS ONBOARDING (z-300) — token-based account provisioning ===== */}
      {skOnboard && (
        <StakeKingsOnboarding onComplete={() => {
          setSkOnboard(false);
          try { sessionStorage.setItem('spotvault-sk-entry', 'true'); } catch { /* ignore */ }
          window.history.replaceState({}, '', '/sk');
          setSkEntry(true);
        }} />
      )}

      {/* ===== CANONICAL PRIMARY SURFACE — exactly one mounted ===== */}
      {/* During entranceAnimation, keep destination hidden — only show LOGIN or entrance overlay */}
      {currentScreen === 'UNKNOWN' && (
        <div className="flex h-screen w-screen items-center justify-center bg-[#050608]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c0911e]/30 border-t-[#d4a52c]" />
        </div>
      )}

      {currentScreen === 'LOGIN' && entrancePhase !== 'entranceAnimation' && (
        <AccessScreen
          onEnter={handleEnter}
          loggingIn={loginLoading || entrancePhase !== 'idle'}
          selectedPortal={state.selectedPortal}
          onSelectPortal={actions.setSelectedPortal}
          account={state.currentAccount}
          portalSelectionPending={state.portalSelectionPending}
          onConfirmPortal={handleConfirmPortal}
          onCreateAccount={actions.openSignUp}
          onLogout={handleReset}
          onOpenPortalAccess={actions.openPortalAccessPanel}
          onUsernameChange={actions.setLoginUsername}
          loginUsername={state.loginUsername}
          loginPin={state.loginPin}
          onPinChange={actions.setLoginPin}
          onOpenLegal={(view: 'privacy' | 'terms') => setPreLoginLegal(view)}
          onAbout={() => setPreLoginAbout(true)}
          rememberPortal={rememberPortal}
          onRememberPortalChange={setRememberPortalState}
          skEntry={skEntry}
          passwordMigrationPending={state.passwordMigrationPending}
          onCompleteMigration={actions.completePasswordMigration}
          onCancelMigration={actions.cancelPasswordMigration}
          onMigration2faMethod={async (method) => { await actions.completeMigration2fa(method); }}
          migration2faStep={state.migration2faStep}
          onQuickPinLogin={actions.quickPinLogin}
          quickPinAvailable={state.quickPinAvailable}
          recoveryResetPending={state.recoveryResetPending}
          onCompleteRecoveryReset={actions.completeEmailRecoveryReset}
          onCancelRecoveryReset={actions.cancelRecoveryReset}
          onPortalRedeemed={actions.handlePortalRedeemed}
          customPortals={state.customPortalMemberships}
          loginError={state.loginError}
        />
      )}

      {currentScreen === 'BUSINESS_ROOM' && state.currentAccount && (
        isStaffOrAdmin(state.currentAccount) ? (
          <BusinessHub
            demo={demo}
            onSwitchPortal={handleSwitchPortal}
            portalSwitchOpen={state.portalSwitchOpen}
            onTogglePortalSwitch={actions.togglePortalSwitch}
            onClosePortalSwitch={actions.closePortalSwitch}
            onBack={handleExitHub}
            onOpenUniversalView={actions.openUniversalView}
            onOpenCustomPortals={() => actions.openUniversalView('custom-portals')}
            customPortalLabel={activeCustomPortal?.portal_name ?? null}
            activePortalId={activeCustomPortal?.portal_slug ?? null}
            customPortals={state.customPortalMemberships}
            onReturnToDefault={handleReturnToDefault}
            onEnterCustomPortal={handleEnterCustomPortal}
          />
        ) : (
          <PortalComingSoon
            portalName="Business"
            description="A dedicated presence for poker businesses and service providers, with booking, advertising, and Rolodex tools."
            Icon={Building2}
            onBack={handleExitHub}
          />
        )
      )}

      {currentScreen === 'BUSINESS_SECOND_FLOOR' && <BusinessSecondFloor demo={demo} />}

      {currentScreen === 'MEDIA_ROOM' && state.currentAccount && (
        isStaffOrAdmin(state.currentAccount) ? (
          <MediaRoom
            demo={demo}
            onSwitchPortal={handleSwitchPortal}
            portalSwitchOpen={state.portalSwitchOpen}
            onTogglePortalSwitch={actions.togglePortalSwitch}
            onClosePortalSwitch={actions.closePortalSwitch}
            onBack={handleExitHub}
            onOpenUniversalView={actions.openUniversalView}
          />
        ) : (
          <PortalComingSoon
            portalName="Media"
            description="A dedicated presence for poker media and content organizations — with site-wide visibility, advertising, and booking tools."
            Icon={Music}
            onBack={handleExitHub}
          />
        )
      )}

      {currentScreen === 'MEDIA_SECOND_FLOOR' && <MediaSecondFloor demo={demo} />}

      {currentScreen === 'STAFF_ROOM' && state.currentAccount && isStaffOrAdmin(state.currentAccount) && (
        <StaffHub
          demo={demo}
          onSwitchPortal={handleSwitchPortal}
          portalSwitchOpen={state.portalSwitchOpen}
          onTogglePortalSwitch={actions.togglePortalSwitch}
          onClosePortalSwitch={actions.closePortalSwitch}
          onBack={handleExitHub}
          onOpenUniversalView={actions.openUniversalView}
          onOpenCustomPortals={() => setCustomPortalsOpen(true)}
        />
      )}

      {currentScreen === 'STABLE_ROOM' && state.currentAccount && (
        isStaffOrAdmin(state.currentAccount) ? (
          <StableHub
            onBack={handleExitHub}
            account={state.currentAccount}
            currentPortal={state.selectedPortal as PortalId}
            onSwitchPortal={handleSwitchPortal}
            portalSwitchOpen={state.portalSwitchOpen}
            onTogglePortalSwitch={actions.togglePortalSwitch}
            onClosePortalSwitch={actions.closePortalSwitch}
            onOpenUniversalView={actions.openUniversalView}
            demo={demo}
            onOpenCustomPortals={() => actions.openUniversalView('custom-portals')}
            customPortalLabel={activeCustomPortal?.portal_name ?? null}
            activePortalId={activeCustomPortal?.portal_slug ?? null}
            customPortals={state.customPortalMemberships}
            onReturnToDefault={handleReturnToDefault}
            onEnterCustomPortal={handleEnterCustomPortal}
          />
        ) : (
          <PortalComingSoon
            portalName="Stable"
            description="Dedicated stable management tools are in development. Streamline day-to-day operations for your entire stable from one workspace."
            Icon={BriefcaseBusiness}
            onBack={handleExitHub}
          />
        )
      )}

      {currentScreen === 'STABLE_SECOND_FLOOR' && state.currentAccount && (
        <PortalSecondFloor demo={demo} label="Stable Second Floor" />
      )}

      {currentScreen === 'CREATOR_ROOM' && state.currentAccount && (
        isStaffOrAdmin(state.currentAccount) ? (
          <CreatorHub
            demo={demo}
            onExitHub={handleExitHub}
            onOpenCredits={actions.openCreditsPanel}
            onSwitchPortal={handleSwitchPortal}
            portalSwitchOpen={state.portalSwitchOpen}
            onTogglePortalSwitch={actions.togglePortalSwitch}
            onClosePortalSwitch={actions.closePortalSwitch}
            onOpenUniversalView={actions.openUniversalView}
            onCreatePost={() => setCreatorComposerOpen(true)}
            account={state.currentAccount}
            onOpenCustomPortals={() => actions.openUniversalView('custom-portals')}
            customPortalLabel={activeCustomPortal?.portal_name ?? null}
            activePortalId={activeCustomPortal?.portal_slug ?? null}
            customPortals={state.customPortalMemberships}
            onReturnToDefault={handleReturnToDefault}
            onEnterCustomPortal={handleEnterCustomPortal}
          />
        ) : (
          <PortalComingSoon
            portalName="Creator / Pro"
            description="A professional presence for poker creators and industry professionals — with advertising, Rolodex access, and booking tools."
            Icon={PenTool}
            onBack={handleExitHub}
          />
        )
      )}

      {currentScreen === 'CREATOR_SECOND_FLOOR' && state.currentAccount && (
        <PortalSecondFloor demo={demo} label="Creator / Talent Second Floor" />
      )}

      {/* Affiliate portal merged into Business Hub */}
      {currentScreen === 'AFFILIATE_PARTNER_ROOM' && state.currentAccount && (
        isStaffOrAdmin(state.currentAccount) ? (
          <BusinessHub
            demo={demo}
            onSwitchPortal={handleSwitchPortal}
            portalSwitchOpen={state.portalSwitchOpen}
            onTogglePortalSwitch={actions.togglePortalSwitch}
            onClosePortalSwitch={actions.closePortalSwitch}
            onBack={handleExitHub}
            onOpenUniversalView={actions.openUniversalView}
            onOpenCustomPortals={() => actions.openUniversalView('custom-portals')}
            customPortalLabel={activeCustomPortal?.portal_name ?? null}
            activePortalId={activeCustomPortal?.portal_slug ?? null}
            customPortals={state.customPortalMemberships}
            onReturnToDefault={handleReturnToDefault}
            onEnterCustomPortal={handleEnterCustomPortal}
          />
        ) : (
          <PortalComingSoon
            portalName="Business"
            description="A dedicated presence for poker businesses and service providers, with booking, advertising, and Rolodex tools."
            Icon={Building2}
            onBack={handleExitHub}
          />
        )
      )}

      {currentScreen === 'AFFILIATE_PARTNER_SECOND_FLOOR' && <BusinessSecondFloor demo={demo} />}

      {currentScreen === 'COACH_ROOM' && state.currentAccount && (
        canAccessPortal(state.currentAccount, 'COACH') ? (
          <CoachHub
            demo={demo}
            onBack={handleExitHub}
            onOpenCredits={actions.openCreditsPanel}
            account={state.currentAccount}
            currentPortal={state.selectedPortal as PortalId}
            onSwitchPortal={handleSwitchPortal}
            portalSwitchOpen={state.portalSwitchOpen}
            onTogglePortalSwitch={actions.togglePortalSwitch}
            onClosePortalSwitch={actions.closePortalSwitch}
            onOpenUniversalView={actions.openUniversalView}
            onOpenCustomPortals={() => actions.openUniversalView('custom-portals')}
            customPortalLabel={activeCustomPortal?.portal_name ?? null}
            activePortalId={activeCustomPortal?.portal_slug ?? null}
            customPortals={state.customPortalMemberships}
            onReturnToDefault={handleReturnToDefault}
            onEnterCustomPortal={handleEnterCustomPortal}
          />
        ) : (
          <PortalComingSoon
            portalName="Coach"
            description="A professional workspace built to make coaching easier and help grow your business — with management tools, marketplace presence, booking, and Rolodex access."
            Icon={FlaskConical}
            onBack={handleExitHub}
          />
        )
      )}

      {currentScreen === 'COACH_SECOND_FLOOR' && state.currentAccount && (
        <PortalSecondFloor demo={demo} label="Coach Second Floor" />
      )}

      {currentScreen === 'STAKEKINGS_PLAYER_ROOM' && state.currentAccount && !isMobile && (
        <StakeKingsPlayerPortal
          demo={demo}
          onExitHub={handleExitHub}
          onSwitchPortal={handleSwitchPortal}
          portalSwitchOpen={state.portalSwitchOpen}
          onTogglePortalSwitch={actions.togglePortalSwitch}
          onClosePortalSwitch={actions.closePortalSwitch}
          onOpenUniversalView={actions.openUniversalView}
          onOpenCredits={actions.openCreditsPanel}
          onNetworkDirectory={actions.openNetworkDirectory}
          onNavigateUp={handleNavigateUp}
          onNavigateDown={handleNavigateDown}
          onNavigateRight={handleNavigateRight}
          onOpenMessaging={() => {
            setMessagingInitialTab('chats');
            setMessagingInitialWith(null);
            actions.openMessaging();
          }}
          onLogout={handleReset}
          initialView={state.portalContentView ?? undefined}
          onOpenCustomPortals={() => actions.openUniversalView('custom-portals')}
          customPortalLabel={activeCustomPortal?.portal_name ?? null}
          activePortalId={activeCustomPortal?.portal_slug ?? null}
          customPortals={state.customPortalMemberships}
          onReturnToDefault={handleReturnToDefault}
          onEnterCustomPortal={handleEnterCustomPortal}
          activePortalSlug={activeCustomPortal?.portal_slug ?? null}
        />
      )}

      {currentScreen === 'PLAYER_ROOM' && !isMobile && (
        <PlayerHub
          demo={demo}
          onExitHub={handleExitHub}
          onNetworkDirectory={actions.openNetworkDirectory}
          onOpenCredits={actions.openCreditsPanel}
          onSwitchPortal={handleSwitchPortal}
          portalSwitchOpen={state.portalSwitchOpen}
          onTogglePortalSwitch={actions.togglePortalSwitch}
          onClosePortalSwitch={actions.closePortalSwitch}
          onPortalChatActiveChange={setPlayerChatActive}
          portalChatActive={playerChatActive}
          onOpenUniversalView={actions.openUniversalView}
          onNavigateUp={handleNavigateUp}
          onNavigateDown={handleNavigateDown}
          onNavigateRight={handleNavigateRight}
          onOpenCommunity={() => {
            setGlobalCommunityOpen(true);
          }}
          onOpenMessaging={() => {
            setMessagingInitialTab('chats');
            setMessagingInitialWith(null);
            actions.openMessaging();
          }}
          onLogout={handleReset}
          initialView={state.portalContentView ?? undefined}
          onOpenCustomPortals={() => actions.openUniversalView('custom-portals')}
          customPortalLabel={activeCustomPortal?.portal_name ?? null}
          activePortalId={activeCustomPortal?.portal_slug ?? null}
          customPortals={state.customPortalMemberships}
          onReturnToDefault={handleReturnToDefault}
          backgroundOverride={getCustomPortalBackground(activeCustomPortal)}
          onEnterCustomPortal={handleEnterCustomPortal}
          activePortalSlug={activeCustomPortal?.portal_slug ?? null}
        />
      )}

      {currentScreen === 'PLAYER_CHAT' && !isMobile && (
        <PlayerNetwork
          onClose={handleNavigateDown}
          account={state.currentAccount}
          activeCustomPortal={activeCustomPortal}
        />
      )}

      {currentScreen === 'PLAYER_MESSAGING' && state.currentAccount && (
        <MessagingCenter
          account={state.currentAccount}
          initialTab={messagingInitialTab}
          initialConversationUserId={messagingInitialWith}
          onBack={actions.closeMessaging}
          isMobile={isMobile}
        />
      )}

      {/* ===== MOBILE APP SHELL — unified mobile navigation ===== */}
      {isMobile && currentScreen === 'STAFF_ROOM' && state.currentAccount && isStaffOrAdmin(state.currentAccount) && (
        <div className="fixed inset-0 z-10 overflow-y-auto bg-[#050608]">
          <StaffHub
            demo={demo}
            onSwitchPortal={handleSwitchPortal}
            portalSwitchOpen={state.portalSwitchOpen}
            onTogglePortalSwitch={actions.togglePortalSwitch}
            onClosePortalSwitch={actions.closePortalSwitch}
            onBack={handleExitHub}
            onOpenUniversalView={actions.openUniversalView}
            onOpenCustomPortals={() => setCustomPortalsOpen(true)}
          />
        </div>
      )}
      {isMobile && (currentScreen === 'PLAYER_ROOM' || currentScreen === 'PLAYER_CHAT' || currentScreen === 'STAKEKINGS_PLAYER_ROOM') && (
        <MobileAppShell
          currentScreen={currentScreen}
          demo={demo}
          onNavigateUp={handleNavigateUp}
          onNavigateDown={handleNavigateDown}
          onNavigateRight={handleNavigateRight}
          onNavigateLeft={handleNavigateLeft}
          onExitHub={handleExitHub}
          onSwitchPortal={handleSwitchPortal}
          backgroundOverride={currentScreen === 'STAKEKINGS_PLAYER_ROOM' ? getStakeKingsBackground('player') : getCustomPortalBackground(activeCustomPortal)}
          customPortalLabel={activeCustomPortal?.portal_name ?? null}
          activePortalId={activeCustomPortal?.portal_slug ?? null}
          customPortals={state.customPortalMemberships}
          onEnterCustomPortal={handleEnterCustomPortal}
          onReturnToDefault={handleReturnToDefault}
        />
      )}

      {globalCommunityOpen && state.currentAccount && (
        <div className="fixed inset-0 z-[140] bg-[#050608]">
          <CommunityHub
            onBackToHub={() => setGlobalCommunityOpen(false)}
            account={state.currentAccount}
            onNavigateUp={handleNavigateUp}
            onOpenUniversalView={actions.openUniversalView}
            onNavigateToPortal={() => {}}
            originPortalName="Player Portal"
            onReturnToPortal={() => setGlobalCommunityOpen(false)}
            credits={state.credits}
            onLogout={logout}
            onOpenCredits={actions.openCreditsPanel}
            onSwitchPortal={handleSwitchPortal}
            portalSwitchOpen={state.portalSwitchOpen}
            onTogglePortalSwitch={actions.togglePortalSwitch}
            onClosePortalSwitch={actions.closePortalSwitch}
            activePortalId={activeCustomPortal?.portal_slug ?? null}
            customPortalLabel={activeCustomPortal?.portal_name ?? null}
            customPortals={state.customPortalMemberships}
            onEnterCustomPortal={handleEnterCustomPortal}
            onReturnToDefault={handleReturnToDefault}
            onOpenCustomPortals={() => actions.openUniversalView('custom-portals')}
            selectedPortal={state.selectedPortal as PortalId}
          />
        </div>
      )}

      {currentScreen === 'INVESTOR_COMMUNITY' && (
        <CommunityHub
          onBackToHub={() => { actions.clearPortalContentView(); handleExitHub(); }}
          account={state.currentAccount}
          onNavigateUp={handleNavigateUp}
          onOpenUniversalView={actions.openUniversalView}
          onNavigateToPortal={() => {}}
          originPortalName={HUB_LABELS[state.selectedPortal as HubId]?.replace(' Hub', ' Portal') ?? 'Investor Portal'}
          onReturnToPortal={() => { actions.clearPortalContentView(); handleExitHub(); }}
          credits={state.credits}
          onLogout={logout}
          onOpenCredits={actions.openCreditsPanel}
          onSwitchPortal={handleSwitchPortal}
          portalSwitchOpen={state.portalSwitchOpen}
          onTogglePortalSwitch={actions.togglePortalSwitch}
          onClosePortalSwitch={actions.closePortalSwitch}
          activePortalId={activeCustomPortal?.portal_slug ?? null}
          customPortalLabel={activeCustomPortal?.portal_name ?? null}
          customPortals={state.customPortalMemberships}
          onEnterCustomPortal={handleEnterCustomPortal}
          onReturnToDefault={handleReturnToDefault}
          onOpenCustomPortals={() => actions.openUniversalView('custom-portals')}
          selectedPortal={state.selectedPortal as PortalId}
        />
      )}

      {currentScreen === 'INVESTOR_CHAT' && (
        <InvestorChatFloor demo={demo} onReturn={handleNavigateDown} />
      )}

      {/* Investor portal merged into Business Hub — redirect to Business Hub */}
      {currentScreen === 'INVESTOR_ROOM' && state.currentAccount && (
        <BusinessHub
          demo={demo}
          onSwitchPortal={handleSwitchPortal}
          portalSwitchOpen={state.portalSwitchOpen}
          onTogglePortalSwitch={actions.togglePortalSwitch}
          onClosePortalSwitch={actions.closePortalSwitch}
          onBack={handleExitHub}
          onOpenUniversalView={actions.openUniversalView}
          initialView={state.portalContentView ?? undefined}
          onOpenCustomPortals={() => actions.openUniversalView('custom-portals')}
          customPortalLabel={activeCustomPortal?.portal_name ?? null}
          activePortalId={activeCustomPortal?.portal_slug ?? null}
          customPortals={state.customPortalMemberships}
          onReturnToDefault={handleReturnToDefault}
          onEnterCustomPortal={handleEnterCustomPortal}
        />
      )}


      {/* ===== MFA CHALLENGE (z-200) — blocks all access until verified ===== */}
      {state.mfaPending && (
        <MfaChallengeScreen
          onVerify={actions.completeMfaLogin}
          onCancel={actions.cancelMfaLogin}
          accountName={state.currentAccount?.name}
          availableMethods={state.mfaAvailableMethods}
          rememberDevice={state.mfaRememberDevice}
          onRememberDeviceChange={actions.setMfaRememberDevice}
          userEmail={state.currentAccount?.email}
          phoneMasked={undefined}
        />
      )}

      {/* ===== CINEMATIC ENTRANCE (z-100) — covers entire viewport during animation ===== */}
      {entranceActive && (
        <CinematicEntrance
          onComplete={handleEntranceComplete}
          reducedMotion={reducedMotion}
          doorImage="/assets/image copy 2.webp"
          vaultImage="/player-portal-high-roller-lounge.webp"
        />
      )}

      {/* During entranceAnimation, block all destination content with an opaque layer */}
      {entrancePhase === 'entranceAnimation' && currentScreen !== 'LOGIN' && (
        <div className="fixed inset-0 z-[99] bg-[#050608]" />
      )}

      {/* ===== VAULT TUMBLER (z-50) ===== */}
      {state.tumblerPhase === 'active' && (
        <VaultTumbler
          phase={state.tumblerPhase}
          target={state.tumblerTarget}
          denied={state.tumblerDenied}
          onComplete={() => {}}
          onVaultOpen={actions.grantAccess}
          onVaultDone={actions.finishVault}
          onReturnHome={handleReturnHome}
          onRequestAccess={handleRequestAccessFromDenied}
        />
      )}

      {/* ===== SIGN UP SCREEN (z-60) ===== */}
      {/* ===== PRE-LOGIN LEGAL PAGES (z-70) ===== */}
      {preLoginLegal === 'privacy' && (
        <PrivacyPolicyPage onBack={() => setPreLoginLegal(null)} />
      )}
      {preLoginLegal === 'terms' && (
        <TermsOfServicePage onBack={() => setPreLoginLegal(null)} />
      )}

      {/* ===== PRE-LOGIN ABOUT / HOW IT WORKS (z-70) ===== */}
      {preLoginAbout && (
        <AboutExperience
          onBack={() => setPreLoginAbout(false)}
          onEnterApp={() => setPreLoginAbout(false)}
        />
      )}

      {state.signUpOpen && (
        <div className="fixed inset-0 z-[60] overflow-hidden bg-[#050608]">
          <SignUpScreen
            onClose={actions.closeSignUp}
            onSubmit={actions.submitSignUp}
            onOpenLegal={(view: 'privacy' | 'terms') => setPreLoginLegal(view)}
            skEntry={skEntry}
          />
        </div>
      )}

      {/* ===== PENDING APPROVAL (z-60) ===== */}
      {state.pendingAccount && !state.signUpOpen && (
        <PendingApprovalScreen
          account={state.pendingAccount}
          onDemoApprove={actions.demoApprove}
          onBackToLogin={handleReset}
        />
      )}

      {/* ===== ACCESS REQUEST MODAL (z-95) ===== */}
      {state.accessRequestOpen && state.accessRequestPortal && state.currentAccount && (
        <AccessRequestModal
          targetPortal={state.accessRequestPortal}
          currentHomePortal={state.currentAccount.homePortal}
          onClose={actions.closeAccessRequest}
          onSubmit={actions.submitAccessRequest}
        />
      )}

      {/* ===== PORTAL ACCESS PANEL (z-95) ===== */}
      {state.portalAccessPanelOpen && state.currentAccount && (
        <PortalAccessPanel
          account={state.currentAccount}
          onClose={actions.closePortalAccessPanel}
          onRequestAccess={actions.openAccessRequest}
          onChangePin={actions.changePin}
        />
      )}

      {/* ===== CUSTOM PORTALS BROWSER (z-200) ===== */}
      <CustomPortalsBrowser
        open={customPortalsOpen}
        onClose={() => setCustomPortalsOpen(false)}
        account={state.currentAccount}
        existingMemberships={state.customPortalMemberships}
        onRedeemed={actions.handlePortalRedeemed}
        onEnterPortal={(portal) => {
          setCustomPortalsOpen(false);
          setActiveCustomPortal(portal);
          const base = (portal.base_portal || 'PLAYER') as HubId;
          setPortal(base as NavPortal, 'COMMUNITY');
          actions.switchPortal(base);
        }}
      />

      {/* Publish data pulse */}
      {state.publishPulse && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center">
          <div className="relative h-1 w-full">
            <div className="data-pulse absolute h-1 w-32 rounded-full bg-gradient-to-r from-transparent via-[#d4a52c] to-transparent shadow-[0_0_24px_rgba(212,165,44,0.6)]" />
          </div>
          <PulseOverlay onFinish={actions.finishPublishPulse} />
        </div>
      )}

      {/* ===== LEGAL PAGES (z-80) ===== */}
      {state.universalView === 'privacy' && (
        <PrivacyPolicyPage onBack={actions.closeUniversalView} />
      )}
      {state.universalView === 'terms' && (
        <TermsOfServicePage onBack={actions.closeUniversalView} />
      )}

      {/* ===== PROFILE PAGE (z-80) ===== */}
      {state.universalView === 'profile' && state.currentAccount && (
        <ProfilePage
          accountId={state.currentAccount.id}
          fallbackName={state.currentAccount.name}
          isOwn
          embedded
          onBack={actions.closeUniversalView}
          onMessage={messageUser}
        />
      )}

      {/* Profile page opened directly (not via universal view) */}
      {profilePageOpen && state.currentAccount && (
        <ProfileViewer
          targetUserId={profilePageOpen.accountId}
          fallbackName={profilePageOpen.isOwn ? state.currentAccount.name : undefined}
          isOwn={profilePageOpen.isOwn}
          initialTab={profilePageOpen.initialTab}
          onBack={() => setProfilePageOpen(null)}
          onMessage={messageUser}
        />
      )}

      {/* Spot Gifting modal — globally accessible */}
      {giftModalReq && state.currentAccount && (
        <GiftSpotModal
          recipientId={giftModalReq.recipientId}
          recipientName={giftModalReq.recipientName}
          recipientAvatar={giftModalReq.recipientAvatar}
          onClose={() => setGiftModalReq(null)}
        />
      )}

      {/* ===== NETWORK DIRECTORY (z-80) ===== */}
      {state.networkDirectoryOpen && !state.activeHubView && (
        <NetworkDirectory
          onEnterHub={handleDirectoryEnter}
          onClose={actions.closeNetworkDirectory}
          onBackToHub={actions.closeNetworkDirectory}
          currentHubId={state.selectedPortal.toLowerCase()}
        />
      )}

      {/* ===== HUB VIEWS (z-80) ===== */}
      {/* Network pages (jobs, advertising, marketplace, store, performance, help)
          are now rendered inside the active portal shell, NOT as standalone overlays.
          Only non-portal hub views (expo, pro, coach, generic previews) remain here. */}

      {state.networkDirectoryOpen && state.activeHubView === 'solver' && state.currentAccount && (
        <div className="fixed inset-0 z-[80] overflow-hidden bg-[#080a0c]">
          <SolverHub
            account={state.currentAccount}
            isSuperUser={isStaffOrAdmin(state.currentAccount)}
          />
        </div>
      )}

      {state.networkDirectoryOpen && state.activeHubView === 'expo' && (
        <div className="fixed inset-0 z-[80] overflow-auto bg-[#080a0c]">
          <ExpoHub
            onBack={actions.closeHubView}
            onOpenBooth={actions.openBoothModal}
            boothModalOpen={state.boothModalOpen}
            onCloseBooth={actions.closeBoothModal}
          />
        </div>
      )}
      {state.networkDirectoryOpen && state.activeHubView === 'pro' && (
        <div className="fixed inset-0 z-[80] overflow-auto bg-[#080a0c]">
          <ProTalentHub
            onBack={actions.closeHubView}
            onOpenCredits={actions.openCreditsPanel}
            account={state.currentAccount}
            currentPortal={state.selectedPortal}
            onSwitchPortal={handleSwitchPortal}
            portalSwitchOpen={state.portalSwitchOpen}
            onTogglePortalSwitch={actions.togglePortalSwitch}
            onClosePortalSwitch={actions.closePortalSwitch}
            onOpenUniversalView={actions.openUniversalView}
          />
        </div>
      )}
      {state.networkDirectoryOpen && state.activeHubView === 'coach' && state.currentAccount && canAccessPortal(state.currentAccount, 'COACH') && (
        <div className="fixed inset-0 z-[80] overflow-auto bg-[#080a0c]">
          <CoachHub
            demo={demo}
            onBack={actions.closeHubView}
            onOpenCredits={actions.openCreditsPanel}
            account={state.currentAccount}
            currentPortal={state.selectedPortal}
            onSwitchPortal={handleSwitchPortal}
            portalSwitchOpen={state.portalSwitchOpen}
            onTogglePortalSwitch={actions.togglePortalSwitch}
            onClosePortalSwitch={actions.closePortalSwitch}
            onOpenUniversalView={actions.openUniversalView}
            onOpenCustomPortals={() => actions.openUniversalView('custom-portals')}
            customPortalLabel={activeCustomPortal?.portal_name ?? null}
            activePortalId={activeCustomPortal?.portal_slug ?? null}
            customPortals={state.customPortalMemberships}
            onReturnToDefault={handleReturnToDefault}
            onEnterCustomPortal={handleEnterCustomPortal}
          />
        </div>
      )}
      {state.networkDirectoryOpen && state.activeHubView &&
        !['business', 'media', 'marketplace', 'expo', 'investor', 'player', 'pro', 'coach', 'people', 'jobs', 'advertising', 'store', 'solver'].includes(state.activeHubView) && (
        <div className="fixed inset-0 z-[80] overflow-auto bg-[#080a0c]">
          <HubPreview
            hubId={state.activeHubView}
            onBack={actions.closeHubView}
            onOpenCredits={actions.openCreditsPanel}
            account={state.currentAccount}
            currentPortal={state.selectedPortal}
            onSwitchPortal={handleSwitchPortal}
            portalSwitchOpen={state.portalSwitchOpen}
            onTogglePortalSwitch={actions.togglePortalSwitch}
            onClosePortalSwitch={actions.closePortalSwitch}
            onOpenUniversalView={actions.openUniversalView}
          />
        </div>
      )}

      {/* ===== COMMUNITY FUND (z-80) ===== */}
      {communityFundOpen && (
        <div className="fixed inset-0 z-[80]">
          <CommunityFund onBack={() => setCommunityFundOpen(false)} />
        </div>
      )}

      {/* ===== CREDITS PANEL (z-85) ===== */}
      {state.creditsPanelOpen && (
        <CreditsPanel credits={state.credits} onClose={actions.closeCreditsPanel} />
      )}

      {/* ===== MODALS ===== */}
      <PublishModal
        open={state.publishModalOpen}
        onClose={actions.closePublishModal}
        onPublish={actions.publishToInnerCircle}
      />
      <RestrictedPublishModal
        open={state.publishModalRestricted}
        onClose={actions.closeRestrictedPublish}
      />
      {state.networkMapOpen && <NetworkMap demo={demo} onClose={actions.closeNetworkMap} />}

      {/* ===== PHASE 2 CONTROL PANEL (z-200) ===== */}
      <Phase2ControlPanel
        open={state.phase2PanelOpen}
        onClose={actions.closePhase2Panel}
        onNavigate={handlePhase2Navigate}
        recentIds={state.recentDestinations}
        currentLocation={currentLocationLabel}
      />

      <CanonicalFloorTabs
        currentDestination={nav.currentDestination}
        currentPortal={nav.currentPortal}
        onNavigate={navigateVertical}
        isMobile={isMobile}
        disabled={navDisabled && currentScreen !== 'PLAYER_ROOM'}
      />


      {/* Creator Composer — only for Creator-permissioned accounts */}
      {creatorComposerOpen && state.currentAccount && canAccessPortal(state.currentAccount, 'CREATOR') && (
        <CreatorComposer
          onClose={() => setCreatorComposerOpen(false)}
          onPublish={() => {}}
        />
      )}

      {/* Universal Spot Media Player — available on all screens */}
      <SpotMediaPlayer />

      {/* Shared Hand Replayer — globally accessible via sv-play-shared-hand event */}
      <SharedHandReplayerModal />

      <ScreenDebugOverlay debug={{
        canonicalScreen: currentScreen,
        authState: nav.authState,
        navPortal: nav.currentPortal,
        navLevel: nav.currentDestination,
        lastNavigation: nav.lastNavigation,
        lastTrigger: nav.lastTrigger,
        selectedPortal: state.selectedPortal,
        loginUsername: state.loginUsername,
        portalContentView: state.portalContentView,
        hubView: state.portalContentView,
        isMobile,
        viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
      }} />

    </div>
  );
}

function PulseOverlay({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFinish, 1400);
    return () => clearTimeout(t);
  }, [onFinish]);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="animate-fade-in rounded-lg border border-[#c0911e]/40 bg-[#0a0c0e]/80 px-6 py-4 text-center backdrop-blur">
        <div className="text-[10px] font-mono tracking-[0.3em] text-[#d4a52c]/70 uppercase">Distributing</div>
        <div className="mt-1 text-sm font-bold tracking-wide text-[#f5e6b0]">To Inner Circle</div>
      </div>
    </div>
  );
}


