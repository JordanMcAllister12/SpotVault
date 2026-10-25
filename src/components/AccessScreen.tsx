import { useState, useEffect, useRef } from 'react';
import { Lock, ArrowRight, User, Check, ShieldCheck, UserPlus, Star, X, Loader2, Mail, Smartphone, Crown, KeyRound } from 'lucide-react';
import type { PortalId } from '@/useDemo';
import type { SpotVaultAccount, HubId } from '@/types';
import { PORTAL_DEFINITIONS, canAccessPortal, getGrant } from '@/types';
import { setRememberMe } from '@/lib/supabase';
import { type CustomPortalMembership } from '@/lib/portalAccessStore';
import { STAKEKINGS_BRANDING } from '@/lib/stakekingsBranding';

interface Props {
  onEnter: () => Promise<{ authenticated: boolean; needsPortalSelection: boolean } | { authenticated: boolean; needsMfa: true; mfaMethods: string[]; mfaFactorId: string | null } | false>;
  loggingIn: boolean;
  selectedPortal: PortalId;
  onSelectPortal: (portal: PortalId) => void;
  account: SpotVaultAccount | null;
  portalSelectionPending: boolean;
  onConfirmPortal: () => void;
  onCreateAccount: () => void;
  onLogout: () => void;
  onOpenPortalAccess: () => void;
  onUsernameChange: (username: string) => void;
  loginUsername: string;
  loginPin: string;
  onPinChange: (pin: string) => void;
  passwordMigrationPending?: boolean;
  onCompleteMigration?: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  onCancelMigration?: () => void;
  onMigration2faMethod?: (method: 'authenticator' | 'email' | 'sms') => void;
  migration2faStep?: boolean;
  onOpenLegal?: (view: 'privacy' | 'terms') => void;
  onAbout?: () => void;
  rememberPortal: boolean;
  onRememberPortalChange: (enabled: boolean) => void;
  onQuickPinLogin?: (pin: string) => Promise<{ ok: boolean; locked?: boolean }>;
  quickPinAvailable?: boolean;
  recoveryResetPending?: boolean;
  onCompleteRecoveryReset?: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  onCancelRecoveryReset?: () => void;
  onPortalRedeemed?: (membership: CustomPortalMembership) => void;
  customPortals?: CustomPortalMembership[];
  loginError?: string | null;
  skEntry?: boolean;
}

const SELECTABLE_PORTALS = PORTAL_DEFINITIONS;

export function AccessScreen({ onEnter, loggingIn, selectedPortal, onSelectPortal, account, portalSelectionPending, onConfirmPortal, onCreateAccount, onLogout, onOpenPortalAccess, onUsernameChange, loginUsername, loginPin, onPinChange, onOpenLegal, onAbout, rememberPortal, onRememberPortalChange, passwordMigrationPending, onCompleteMigration, onCancelMigration, onMigration2faMethod, migration2faStep, onQuickPinLogin, quickPinAvailable, recoveryResetPending, onCompleteRecoveryReset, onCancelRecoveryReset, onPortalRedeemed, customPortals, loginError, skEntry }: Props) {
  const [remember, setRemember] = useState(true);
  const [portalDropdownOpen, setPortalDropdownOpen] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotSending, setForgotSending] = useState(false);
  const [migrationPassword, setMigrationPassword] = useState('');
  const [migrationConfirm, setMigrationConfirm] = useState('');
  const [migrationError, setMigrationError] = useState('');
  const [migrationSubmitting, setMigrationSubmitting] = useState(false);
  const [showMigrationPwd, setShowMigrationPwd] = useState(false);
  const [migrationStep, setMigrationStep] = useState<'password' | '2fa'>('password');
  const [quickPinMode, setQuickPinMode] = useState(false);
  const [quickPinValue, setQuickPinValue] = useState('');
  const [quickPinError, setQuickPinError] = useState('');
  const [quickPinSubmitting, setQuickPinSubmitting] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [recoveryResetError, setRecoveryResetError] = useState('');
  const [recoveryResetSubmitting, setRecoveryResetSubmitting] = useState(false);
  const [showRecoveryPwd, setShowRecoveryPwd] = useState(false);
  // When migration2faStep prop becomes true, switch to the 2FA step
  useEffect(() => {
    if (migration2faStep) setMigrationStep('2fa');
  }, [migration2faStep]);

  // Clear any stale error as soon as auth transitions away from the credentials stage.
  useEffect(() => {
    if (portalSelectionPending || loggingIn) setSubmitError('');
  }, [portalSelectionPending, loggingIn]);

  // After authentication, the account is known securely. Build the authorized
  // portal list from the authenticated account's grants — NOT from a pre-login
  // username lookup.
  const authenticatedAccount = portalSelectionPending ? account : null;
  const authorizedPortals = authenticatedAccount
    ? SELECTABLE_PORTALS.filter((p) => canAccessPortal(authenticatedAccount, p.id as HubId))
    : [];

  const sortedPortals = [...authorizedPortals].sort((a, b) => {
    const aHome = authenticatedAccount?.homePortal === a.id ? 0 : 1;
    const bHome = authenticatedAccount?.homePortal === b.id ? 0 : 1;
    return aHome - bHome;
  });

  const [submitting, setSubmitting] = useState(false);
  const transitionInProgressRef = useRef(false);
  const portalSelectionPendingRef = useRef(portalSelectionPending);
  const loggingInRef = useRef(loggingIn);
  portalSelectionPendingRef.current = portalSelectionPending;
  loggingInRef.current = loggingIn;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    setRememberMe(remember);
    transitionInProgressRef.current = false;
    try {
      const result = await onEnter();
      if (!result) {
        // onEnter returned falsy — but this can happen when auth actually
        // succeeded and the parent has already started transitioning.
        // Defer the error check to the next tick so the parent state
        // update has propagated.
        setTimeout(() => {
          if (portalSelectionPendingRef.current || loggingInRef.current || transitionInProgressRef.current) {
            return;
          }
          setSubmitError('Invalid username, email, or password.');
        }, 0);
      } else if (!result.authenticated && !(result as { needsMfa?: boolean }).needsMfa) {
        // Genuine auth failure — safe to show immediately.
        setSubmitError('Authentication failed. Please try again.');
      } else {
        // Auth succeeded or MFA/migration required — mark transition in progress
        transitionInProgressRef.current = true;
      }
    } catch {
      setSubmitError('An error occurred during sign-in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async () => {
    if (forgotSending || !forgotIdentifier.trim()) return;
    setForgotSending(true);
    setForgotError('');
    try {
      const identifier = forgotIdentifier.trim();
      let email = identifier;
      if (!identifier.includes('@')) {
        const { resolveLoginEmail } = await import('@/lib/authService');
        const resolved = await resolveLoginEmail(identifier);
        if (!resolved) {
          setForgotSent(true);
          setForgotSending(false);
          return;
        }
        email = resolved;
      }
      const { sendPasswordResetEmail } = await import('@/lib/securityEngine');
      await sendPasswordResetEmail(email);
      setForgotSent(true);
    } catch {
      setForgotSent(true);
    } finally {
      setForgotSending(false);
    }
  };

  const handleMigrationSubmit = async () => {
    if (!onCompleteMigration) return;
    if (migrationPassword !== migrationConfirm) {
      setMigrationError('Passwords do not match.');
      return;
    }
    if (migrationPassword.length < 10) {
      setMigrationError('Password must be at least 10 characters.');
      return;
    }
    setMigrationSubmitting(true);
    setMigrationError('');
    const result = await onCompleteMigration(migrationPassword);
    setMigrationSubmitting(false);
    if (!result.ok) {
      setMigrationError(result.error || 'Migration failed.');
      return;
    }
    setMigrationPassword('');
    setMigrationConfirm('');
    setMigrationStep('2fa');
  };

  const handleQuickPinSubmit = async () => {
    if (!onQuickPinLogin || quickPinSubmitting) return;
    setQuickPinSubmitting(true);
    setQuickPinError('');
    try {
      const result = await onQuickPinLogin(quickPinValue);
      if (!result.ok) {
        setQuickPinError('Incorrect PIN.');
        setQuickPinValue('');
        if (result.locked) {
          setQuickPinError('Quick PIN locked. Use your password instead.');
          setTimeout(() => setQuickPinMode(false), 1500);
        }
      }
    } catch {
      setQuickPinError('An error occurred.');
    } finally {
      setQuickPinSubmitting(false);
    }
  };

  const handleRecoveryResetSubmit = async () => {
    if (!onCompleteRecoveryReset || recoveryResetSubmitting) return;
    if (recoveryPassword !== recoveryConfirm) {
      setRecoveryResetError('Passwords do not match.');
      return;
    }
    if (recoveryPassword.length < 10) {
      setRecoveryResetError('Password must be at least 10 characters.');
      return;
    }
    setRecoveryResetSubmitting(true);
    setRecoveryResetError('');
    const result = await onCompleteRecoveryReset(recoveryPassword);
    setRecoveryResetSubmitting(false);
    if (!result.ok) {
      setRecoveryResetError(result.error || 'Password reset failed.');
      return;
    }
    setRecoveryPassword('');
    setRecoveryConfirm('');
    setRecoveryResetError('');
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050608]">
      {/* ===== Uploaded security door: primary authentication environment ===== */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${skEntry ? STAKEKINGS_BRANDING.playerBackground : '/assets/image copy 2.webp'}")` }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.28),transparent_35%,transparent_65%,rgba(0,0,0,0.32))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(0,0,0,0.62)_100%)]" />
      </div>

      {/* ===== Depth plane: architectural wall (hidden, replaced by door image) ===== */}
      <div className="pointer-events-none absolute inset-0 hidden"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 50% 50%, #0c0e11 0%, #08090b 40%, #050608 80%)',
        }}
      />

      {/* ===== Depth plane: massive vault mechanism (midground) ===== */}
      <div className="pointer-events-none absolute inset-0 hidden items-center justify-center">
        <div
          className="vault-breathe relative"
          style={{ width: 'min(88vh, 820px)', height: 'min(88vh, 820px)' }}
        >
          {/* Outer vault rim — thick gunmetal housing */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, #1a2026 0%, #11151a 70%, #0a0c0e 100%)',
              boxShadow:
                '0 0 0 4px #0a0c0e, 0 0 0 5px #232a32, 0 0 0 6px #0a0c0e, 0 0 120px -30px rgba(212,165,44,0.12), inset 0 0 60px rgba(0,0,0,0.5)',
            }}
          />
          {/* Silver machined edge */}
          <div
            className="absolute inset-[1.5%] rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, #2a323b, #4a5260, #2a323b, #4a5260, #2a323b, #4a5260, #2a323b, #4a5260, #2a323b)',
              opacity: 0.3,
            }}
          />
          {/* Ring 1 — brushed radial door surface */}
          <div
            className="absolute inset-[3%] rounded-full vault-door-brushed"
            style={{ boxShadow: 'inset 0 0 50px rgba(0,0,0,0.6)' }}
          />
          {/* Ring 2 — machined groove */}
          <div
            className="absolute inset-[7%] rounded-full"
            style={{
              background: 'radial-gradient(circle, transparent 60%, #1a2026 100%)',
              boxShadow: 'inset 0 0 0 1px #2a323b, 0 0 0 1px #0a0c0e',
            }}
          />
          {/* Ring 3 — gear teeth ring */}
          <div
            className="absolute inset-[11%] rounded-full"
            style={{
              background: 'radial-gradient(circle, #161b21 0%, #11151a 100%)',
              boxShadow: 'inset 0 0 0 1px #232a32, inset 0 0 30px rgba(0,0,0,0.5)',
            }}
          >
            {/* Gear teeth */}
            {Array.from({ length: 48 }).map((_, i) => {
              const angle = (i * 360) / 48;
              return (
                <div
                  key={`gear-${i}`}
                  className="absolute left-1/2 top-1/2 origin-center"
                  style={{ transform: `rotate(${angle}deg) translateY(-50%)` }}
                >
                  <div
                    className="absolute"
                    style={{
                      width: '2px',
                      height: '8px',
                      background: 'linear-gradient(180deg, #3a4450 0%, #1a2026 100%)',
                      transform: 'translate(-50%, -100%)',
                      boxShadow: '0 1px 0 rgba(255,255,255,0.05)',
                    }}
                  />
                </div>
              );
            })}
          </div>
          {/* Ring 4 — inner concentric plate */}
          <div
            className="absolute inset-[18%] rounded-full"
            style={{
              background: 'radial-gradient(circle, #1a2026 0%, #11151a 100%)',
              boxShadow: 'inset 0 0 0 1px #2a323b, inset 0 0 40px rgba(0,0,0,0.6)',
            }}
          />
          {/* Ring 5 — innermost plate */}
          <div
            className="absolute inset-[24%] rounded-full"
            style={{
              background: 'radial-gradient(circle, #161b21 0%, #0e1114 100%)',
              boxShadow: 'inset 0 0 0 1px #232a32',
            }}
          />

          {/* Bolt circle — outer ring */}
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i * 360) / 36;
            return (
              <div
                key={`bolt-outer-${i}`}
                className="absolute left-1/2 top-1/2 origin-center"
                style={{ transform: `rotate(${angle}deg) translateY(-50%)` }}
              >
                <div
                  className="vault-bolt absolute rounded-full"
                  style={{
                    width: '10px',
                    height: '10px',
                    transform: 'translate(-50%, calc(-50% + 2%))',
                  }}
                />
              </div>
            );
          })}

          {/* Bolt circle — inner ring */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 360) / 24;
            return (
              <div
                key={`bolt-inner-${i}`}
                className="absolute left-1/2 top-1/2 origin-center"
                style={{ transform: `rotate(${angle}deg) translateY(-50%)` }}
              >
                <div
                  className="vault-bolt absolute rounded-full"
                  style={{
                    width: '7px',
                    height: '7px',
                    transform: 'translate(-50%, calc(-50% + 7%))',
                  }}
                />
              </div>
            );
          })}

          {/* Radial spokes — structural arms */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`spoke-${i}`}
              className="absolute left-1/2 top-1/2 origin-center"
              style={{ transform: `rotate(${i * 45}deg)`, height: '100%', width: '1px' }}
            >
              <div
                className="h-full w-px"
                style={{
                  background:
                    'linear-gradient(180deg, transparent 0%, #2a323b 20%, #3a4450 50%, #2a323b 80%, transparent 100%)',
                }}
              />
            </div>
          ))}

          {/* Central vault plate — spindle mechanism */}
          <div
            className="absolute left-1/2 top-1/2 h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: 'radial-gradient(circle, #1a2026 0%, #0e1114 100%)',
              boxShadow:
                'inset 0 0 0 1px #2a323b, inset 0 0 0 2px #0a0c0e, inset 0 0 0 3px #232a32, inset 0 0 30px rgba(0,0,0,0.7), 0 0 20px rgba(0,0,0,0.5)',
            }}
          >
            {/* Inner spindle rings */}
            <div
              className="absolute inset-3 rounded-full"
              style={{ boxShadow: 'inset 0 0 0 1px #232a32' }}
            />
            <div
              className="absolute inset-6 rounded-full"
              style={{ boxShadow: 'inset 0 0 0 1px #1a2026' }}
            />
            {/* Central cross/spindle */}
            <div
              className="absolute left-1/2 top-1/2 h-[55%] w-[2px] -translate-x-1/2 -translate-y-1/2"
              style={{ background: 'linear-gradient(180deg, transparent, #3a4450 30%, #4a5260 50%, #3a4450 70%, transparent)' }}
            />
            <div
              className="absolute left-1/2 top-1/2 h-[2px] w-[55%] -translate-x-1/2 -translate-y-1/2"
              style={{ background: 'linear-gradient(90deg, transparent, #3a4450 30%, #4a5260 50%, #3a4450 70%, transparent)' }}
            />
            {/* Center hub */}
            <div
              className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: 'radial-gradient(circle at 35% 35%, #5a6470 0%, #2a323b 60%, #0e1114 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 0 1px #0a0c0e',
              }}
            />
            {/* Tiny gold alignment indicator */}
            <div className="mech-idle-pulse absolute left-1/2 top-[12%] h-1 w-1 -translate-x-1/2 rounded-full bg-[#c0911e]" style={{ boxShadow: '0 0 4px rgba(192,145,30,0.5)' }} />
          </div>

          {/* Radial mechanical arms (4 locking arms) */}
          {[0, 90, 180, 270].map((angle) => (
            <div
              key={`arm-${angle}`}
              className="absolute left-1/2 top-1/2 origin-center"
              style={{ transform: `rotate(${angle}deg)`, height: '100%', width: '2px' }}
            >
              <div
                className="absolute left-1/2"
                style={{
                  width: '4px',
                  height: '14%',
                  background: 'linear-gradient(180deg, #3a4450 0%, #1a2026 100%)',
                  transform: 'translateX(-50%)',
                  top: '30%',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 4px rgba(0,0,0,0.5)',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ===== Depth separation: console glow behind login ===== */}
      <div
        className="pointer-events-none absolute inset-0 hidden items-center justify-center"
        style={{
          background:
            'radial-gradient(ellipse 30% 40% at 50% 50%, rgba(20,24,29,0.6) 0%, transparent 60%)',
        }}
      />

      {/* ===== Vignette ===== */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 100% at 50% 50%, transparent 30%, rgba(5,6,8,0.5) 65%, #050608 95%)',
        }}
      />

      {/* ===== Frame architecture — vertical metal pillars ===== */}
      <div className="pointer-events-none absolute left-0 top-0 h-full w-12" style={{ background: 'linear-gradient(90deg, #0a0c0e 0%, #0e1114 50%, transparent 100%)' }} />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-12" style={{ background: 'linear-gradient(270deg, #0a0c0e 0%, #0e1114 50%, transparent 100%)' }} />
      {/* Pillar seams */}
      <div className="pointer-events-none absolute left-11 top-0 h-full w-px" style={{ background: 'linear-gradient(180deg, transparent, #1a2026 20%, #232a32 50%, #1a2026 80%, transparent)' }} />
      <div className="pointer-events-none absolute right-11 top-0 h-full w-px" style={{ background: 'linear-gradient(180deg, transparent, #1a2026 20%, #232a32 50%, #1a2026 80%, transparent)' }} />

      {/* ===== Top status bar ===== */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-3 sm:px-8 sm:py-5">
        <div className="flex items-center gap-2 text-[8px] font-mono tracking-widest text-[#5f6e7c] uppercase sm:text-[10px]">
          <span className="net-status-pulse h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
          <span className="hidden sm:inline">Network Online</span>
        </div>
        <div className="text-[8px] font-mono tracking-widest text-[#475565] uppercase sm:text-[10px]">Network Online</div>
      </div>

      {/* ===== Login console (foreground) — wide vault access terminal ===== */}
      <div className="access-screen-content relative z-10 flex h-full flex-col items-center justify-center px-3 sm:px-6 lg:flex-row" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>

        <div
          className={`door-login w-full max-w-[640px] transition-all duration-700 ${
            loggingIn ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
          }`}
          style={{ marginTop: 'max(2rem, env(safe-area-inset-top, 0px))' }}
        >
          {/* ===== Brand signage — SK entry only (floats above panel) ===== */}
          {skEntry && (
          <div className="text-center">
            {/* Ambient gold glow behind logo */}
            <div
              className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-4"
              style={{
                width: '320px',
                height: '180px',
                background: 'radial-gradient(ellipse at center, rgba(212,165,44,0.08) 0%, transparent 65%)',
                filter: 'blur(20px)',
              }}
            />
            {/* SV emblem */}
            <div className="relative flex items-center justify-center">
              <div
                className="relative flex h-10 w-10 items-center justify-center sm:h-14 sm:w-14"
                style={{
                  background: 'radial-gradient(circle, #1a2026 0%, #0e1114 100%)',
                  borderRadius: '50%',
                  boxShadow:
                    'inset 0 0 0 1px #2a323b, inset 0 0 0 2px #0a0c0e, inset 0 0 0 3px #232a32, 0 0 24px -4px rgba(212,165,44,0.18)',
                }}
              >
                <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#2a323b" strokeWidth="0.5" />
                  <circle cx="32" cy="32" r="22" fill="none" stroke="#232a32" strokeWidth="0.5" strokeDasharray="2 4" />
                  <line x1="32" y1="8" x2="32" y2="20" stroke="#3a4450" strokeWidth="0.5" />
                  <line x1="32" y1="44" x2="32" y2="56" stroke="#3a4450" strokeWidth="0.5" />
                  <line x1="8" y1="32" x2="20" y2="32" stroke="#3a4450" strokeWidth="0.5" />
                  <line x1="44" y1="32" x2="56" y2="32" stroke="#3a4450" strokeWidth="0.5" />
                  <circle cx="32" cy="8" r="1.5" fill="#c0911e" opacity="0.7" />
                  <circle cx="32" cy="56" r="1.5" fill="#3a4450" />
                  <circle cx="8" cy="32" r="1.5" fill="#3a4450" />
                  <circle cx="56" cy="32" r="1.5" fill="#3a4450" />
                </svg>
                <span
                  className="relative text-base font-bold tracking-tight"
                  style={
                    skEntry
                      ? { color: '#22c55e', fontSize: 18 }
                      : {
                          background: 'linear-gradient(180deg, #8a6515 0%, #d4a52c 30%, #f5e6b0 50%, #d4a52c 70%, #8a6515 100%)',
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }
                  }
                >
                  {skEntry ? 'SK' : 'SV'}
                </span>
              </div>
            </div>

            {skEntry ? (
              <div className="mt-2 text-[8px] font-mono tracking-[0.35em] text-[#5f6e7c] uppercase sm:mt-2.5 sm:text-[9px]">
                Player Development Academy
              </div>
            ) : (
              <>
                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:mt-4 sm:text-3xl lg:text-4xl">
                  <span className="silver-metal-text">Spot</span>
                  <span
                    style={{
                      background: 'linear-gradient(180deg, #8a6515 0%, #d4a52c 30%, #f5e6b0 50%, #d4a52c 70%, #8a6515 100%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Vault
                  </span>
                </h1>
                <div className="mt-2 text-[8px] font-mono tracking-[0.35em] text-[#5f6e7c] uppercase sm:mt-2.5 sm:text-[9px]">
                  Poker Industry Network
                </div>
              </>
            )}
          </div>
          )}

          {/* ===== Thin gold divider — terminal edge ===== */}
          <div className="mx-auto mt-3 h-px w-full max-w-[560px] sm:mt-6" style={{ background: 'linear-gradient(90deg, transparent, rgba(192,145,30,0.2) 20%, rgba(192,145,30,0.35) 50%, rgba(192,145,30,0.2) 80%, transparent)' }} />

          {/* ===== Access terminal label ===== */}
          <div className="mt-2 flex items-center justify-center gap-3 text-[8px] font-mono tracking-[0.3em] text-[#475565] uppercase sm:mt-3">
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-emerald-500/70" />
              Secure Access Terminal
            </span>
            <span className="hidden text-[#2a323b] sm:inline">·</span>
            <span className="hidden sm:inline">Encrypted Session</span>
          </div>

          {/* ===== Access controls — floating in vault, no outer card ===== */}
          <div
            className="mt-3 rounded-2xl px-3 py-3 sm:mt-4 sm:px-5 sm:py-5 lg:px-7 lg:py-6"
            style={{
              background: 'linear-gradient(180deg, rgba(10,12,14,0.72) 0%, rgba(8,10,12,0.78) 100%)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 20px 60px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {skEntry && (
              <div className="mb-4 flex flex-col items-center text-center sm:mb-5">
                <p className="text-xs font-medium leading-relaxed text-white/75 sm:text-sm">
                  The Official Poker Education &amp; Training Platform of
                </p>
                <img
                  src="/assets/stakekings/image copy 2.webp"
                  alt="StakeKings"
                  className="mt-2 h-auto w-[160px] object-contain sm:w-[180px]"
                />
              </div>
            )}
            {!skEntry && (
              <div className="mb-4 flex flex-col items-center text-center sm:mb-5">
                {/* SV emblem */}
                <div className="relative flex items-center justify-center">
                  <div
                    className="relative flex h-10 w-10 items-center justify-center sm:h-14 sm:w-14"
                    style={{
                      background: 'radial-gradient(circle, #1a2026 0%, #0e1114 100%)',
                      borderRadius: '50%',
                      boxShadow:
                        'inset 0 0 0 1px #2a323b, inset 0 0 0 2px #0a0c0e, inset 0 0 0 3px #232a32, 0 0 24px -4px rgba(212,165,44,0.18)',
                    }}
                  >
                    <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="#2a323b" strokeWidth="0.5" />
                      <circle cx="32" cy="32" r="22" fill="none" stroke="#232a32" strokeWidth="0.5" strokeDasharray="2 4" />
                      <line x1="32" y1="8" x2="32" y2="20" stroke="#3a4450" strokeWidth="0.5" />
                      <line x1="32" y1="44" x2="32" y2="56" stroke="#3a4450" strokeWidth="0.5" />
                      <line x1="8" y1="32" x2="20" y2="32" stroke="#3a4450" strokeWidth="0.5" />
                      <line x1="44" y1="32" x2="56" y2="32" stroke="#3a4450" strokeWidth="0.5" />
                      <circle cx="32" cy="8" r="1.5" fill="#c0911e" opacity="0.7" />
                      <circle cx="32" cy="56" r="1.5" fill="#3a4450" />
                      <circle cx="8" cy="32" r="1.5" fill="#3a4450" />
                      <circle cx="56" cy="32" r="1.5" fill="#3a4450" />
                    </svg>
                    <span
                      className="relative text-base font-bold tracking-tight"
                      style={{
                        background: 'linear-gradient(180deg, #8a6515 0%, #d4a52c 30%, #f5e6b0 50%, #d4a52c 70%, #8a6515 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      SV
                    </span>
                  </div>
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:mt-4 sm:text-3xl lg:text-4xl">
                  <span className="silver-metal-text">Spot</span>
                  <span
                    style={{
                      background: 'linear-gradient(180deg, #8a6515 0%, #d4a52c 30%, #f5e6b0 50%, #d4a52c 70%, #8a6515 100%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Vault
                  </span>
                </h1>
                <div className="mt-2 text-[8px] font-mono tracking-[0.35em] text-[#5f6e7c] uppercase sm:mt-2.5 sm:text-[9px]">
                  Poker Industry Network
                </div>
              </div>
            )}
            <div onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (portalSelectionPending) {
                  onConfirmPortal();
                } else {
                  handleSubmit();
                }
              }
            }}>
              {portalSelectionPending && authenticatedAccount ? (
                /* ===== STAGE 2: POST-AUTH WELCOME ===== */
                <div>
                  <div className="mb-3 text-center sm:mb-4">
                    <div className="text-[8px] font-mono tracking-[0.3em] text-emerald-400/80 uppercase sm:text-[9px]">
                      Authentication Verified
                    </div>

                  </div>

                  <div className="mt-3 flex justify-center sm:mt-4">
                  <button
                    type="button"
                    onClick={onConfirmPortal}
                    className="enter-vault-btn group flex items-center justify-center gap-2 rounded-lg py-3 text-[10px] font-semibold tracking-[0.25em] uppercase sm:gap-2.5 sm:py-3.5 sm:text-[11px]"
                    style={{ color: '#f5e6b0', width: '60%' }}
                  >
                    Enter SpotVault
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 sm:h-4 sm:w-4" strokeWidth={1.5} />
                  </button>
                  </div>

                  <button
                    type="button"
                    onClick={onLogout}
                    className="mt-2 w-full text-center text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase transition-colors hover:text-[#d4a52c]"
                  >
                    Log Out / Switch Account
                  </button>
                </div>
              ) : (
                /* ===== STAGE 1: CREDENTIALS ===== */
                <div>
              {quickPinMode && quickPinAvailable ? (
                /* ===== QUICK PIN LOGIN ===== */
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10">
                      <Smartphone className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
                    </div>
                    <div className="mt-2 text-[8px] font-mono tracking-[0.3em] text-[#84929f] uppercase">Use Quick PIN</div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[9px] font-semibold tracking-[0.25em] text-[#84929f] uppercase">Enter Quick PIN</label>
                    <div className="recessed-field flex items-center gap-2 rounded-lg px-3.5 py-3">
                      <Lock className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={quickPinValue}
                        onChange={(e) => setQuickPinValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && quickPinValue.length >= 4) handleQuickPinSubmit(); }}
                        autoFocus
                        placeholder="•••••••"
                        className="w-full bg-transparent text-lg tracking-[0.3em] text-white outline-none placeholder:text-[#5f6e7c]"
                      />
                    </div>
                  </div>
                  {quickPinError && <p className="text-center text-[10px] font-mono tracking-widest text-red-400 uppercase">{quickPinError}</p>}
                  <button
                    type="button"
                    onClick={handleQuickPinSubmit}
                    disabled={quickPinSubmitting || quickPinValue.length < 4}
                    className="enter-vault-btn group flex w-full items-center justify-center gap-2 rounded-lg py-3 text-[10px] font-semibold tracking-[0.25em] uppercase disabled:opacity-50 sm:py-3.5 sm:text-[11px]"
                    style={{ color: '#f5e6b0' }}
                  >
                    {quickPinSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Sign In <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 sm:h-4 sm:w-4" strokeWidth={1.5} /></>}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQuickPinMode(false); setQuickPinValue(''); setQuickPinError(''); }}
                    className="w-full text-center text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase transition-colors hover:text-[#84929f]"
                  >
                    Use Password Instead
                  </button>
                </div>
              ) : (
                <>
              {/* 2+3. USERNAME + PIN — side by side on desktop, stacked on mobile */}
              <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-[9px] font-semibold tracking-[0.25em] text-[#84929f] uppercase">
                    Username or Email
                  </label>
                  <div className="recessed-field flex items-center gap-2 rounded-lg px-3 py-2.5 sm:gap-2.5 sm:px-3.5 sm:py-3">
                    <User className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                    <input
                      value={loginUsername}
                      onChange={(e) => {
                        onUsernameChange(e.target.value);
                      }}
                      name="username"
                      autoComplete="username"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      placeholder="Username or email"
                      className="spotvault-auth-input w-full bg-transparent font-mono text-[13px] text-white outline-none placeholder:text-white/20"
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <label className="mb-1.5 block text-[9px] font-semibold tracking-[0.25em] text-[#84929f] uppercase">
                    Password
                  </label>
                  <div className="recessed-field flex items-center gap-2 rounded-lg px-3 py-2.5 sm:gap-2.5 sm:px-3.5 sm:py-3">
                    <Lock className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                    <input
                      type="password"
                      value={loginPin}
                      onChange={(e) => onPinChange(e.target.value)}
                      autoComplete="current-password"
                      name="password"
                      placeholder="Enter password"
                      className="spotvault-auth-input w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/20"
                    />
                  </div>
                </div>
              </div>

              {/* 4. REMEMBER ME + FORGOT PIN — same row */}
              <div className="mt-2.5 flex items-center justify-between sm:mt-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRemember((r) => !r)}
                    className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                      remember ? 'border-[#c0911e]/60 bg-[#c0911e]/15' : 'border-[#38424e] bg-[#161b21]'
                    }`}
                  >
                    {remember && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3">
                        <path d="M2 6 L5 9 L10 3" stroke="#d4a52c" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className="text-[10px] text-[#84929f]">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setForgotOpen(true); setForgotSent(false); setForgotIdentifier(''); setForgotError(''); }}
                  className="text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase transition-colors hover:text-[#d4a52c]"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Enter button — centered, ~60% width to match Portal Code button proportion */}
              <div className="mt-3 flex justify-center sm:mt-5">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="enter-vault-btn group flex items-center justify-center gap-2 rounded-lg py-3 text-[10px] font-semibold tracking-[0.25em] uppercase disabled:opacity-50 sm:gap-2.5 sm:py-3.5 sm:text-[11px]"
                style={{ color: '#f5e6b0', width: '60%' }}
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Enter SpotVault <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 sm:h-4 sm:w-4" strokeWidth={1.5} /></>}
              </button>
              </div>
              {(submitError || loginError) && <p className="mt-2.5 text-center text-[10px] font-mono tracking-widest text-red-400 uppercase">Invalid username, email, or password</p>}


              {/* Quick PIN toggle — only show if available */}
              {quickPinAvailable && onQuickPinLogin && (
                <button
                  type="button"
                  onClick={() => { setQuickPinMode(true); setSubmitError(''); }}
                  className="mt-2 w-full text-center text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase transition-colors hover:text-[#d4a52c]"
                >
                  Use Quick PIN Instead
                </button>
              )}
                </>
              )}
                </div>
              )}
            </div>

            {/* Create Account link */}
            <div className="mt-3 flex items-center justify-center gap-3 sm:mt-4">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, #1a2026)' }} />
              <button
                onClick={onCreateAccount}
                className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.2em] text-[#84929f] uppercase transition-colors hover:text-[#d4a52c]"
              >
                <UserPlus className="h-3 w-3" strokeWidth={1.5} />
                Create Account
              </button>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, #1a2026, transparent)' }} />
            </div>

            {/* Legal links */}
            {(onOpenLegal || onAbout) && (
              <div className="mt-2 flex items-center justify-center gap-3 text-[9px] font-mono tracking-widest text-[#364049] uppercase sm:mt-3">
                {onAbout && (
                  <button type="button" onClick={onAbout} className="transition-colors hover:text-[#d4a52c]">How It Works</button>
                )}
                {onAbout && onOpenLegal && <span className="text-[#2a323b]">·</span>}
                {onOpenLegal && (
                  <>
                    <button type="button" onClick={() => onOpenLegal('privacy')} className="transition-colors hover:text-[#84929f]">Privacy Policy</button>
                    <span className="text-[#2a323b]">·</span>
                    <button type="button" onClick={() => onOpenLegal('terms')} className="transition-colors hover:text-[#84929f]">Terms of Service</button>
                  </>
                )}
              </div>
            )}

          </div>

          {/* ===== Bottom gold divider — terminal edge ===== */}
          <div className="mx-auto mt-3 h-px w-full max-w-[560px] sm:mt-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(192,145,30,0.15) 30%, rgba(192,145,30,0.25) 50%, rgba(192,145,30,0.15) 70%, transparent)' }} />
        </div>

      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#2a323b] bg-[#0a0c0e] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold tracking-[0.2em] text-white uppercase">Forgot Password</h2>
                <p className="mt-2 max-w-sm text-xs leading-5 text-[#84929f]">
                  {forgotSent ? 'Check your email for reset instructions.' : 'Enter your username or account email and we\'ll send a password reset link.'}
                </p>
              </div>
              <button type="button" onClick={() => { setForgotOpen(false); setForgotSent(false); setForgotIdentifier(''); setForgotError(''); }} className="text-[#5f6e7c] hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            {!forgotSent ? (
              <div className="mt-5">
                <div className="recessed-field flex items-center gap-2 rounded-lg px-4 py-3">
                  <Mail className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                  <input
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleForgotSubmit(); }}
                    placeholder="Username or email"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#5f6e7c]"
                  />
                </div>
                {forgotError && <p className="mt-3 text-center text-[10px] font-mono tracking-widest text-red-400 uppercase">{forgotError}</p>}
                <button
                  type="button"
                  disabled={forgotSending || !forgotIdentifier.trim()}
                  onClick={handleForgotSubmit}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/10 py-3 text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase disabled:opacity-50"
                >
                  {forgotSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Send Reset Link
                </button>
              </div>
            ) : (
              <div className="mt-5">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <Check className="h-4 w-4 text-emerald-400" strokeWidth={2} />
                  <p className="text-[11px] text-emerald-300">If an account exists for those details, we've sent password reset instructions to the recovery email on file.</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setForgotOpen(false); setForgotSent(false); setForgotIdentifier(''); setForgotError(''); }}
                  className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 py-3 text-[10px] font-semibold tracking-[0.2em] text-white/60 uppercase hover:text-white"
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {recoveryResetPending && onCompleteRecoveryReset && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#c0911e]/30 bg-[#0a0c0e] p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#c0911e]/40 bg-[#c0911e]/10">
                <ShieldCheck className="h-6 w-6 text-[#d4a52c]" strokeWidth={1.5} />
              </div>
              <h2 className="mt-3 text-sm font-bold tracking-[0.2em] text-white uppercase">Reset Your Password</h2>
              <p className="mt-2 text-xs leading-5 text-[#84929f]">
                A temporary recovery credential was used. You must set a new password before continuing. This password will work across all your devices.
              </p>
            </div>
            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-[9px] font-semibold tracking-[0.2em] text-[#84929f] uppercase">New Password</label>
                <div className="recessed-field flex items-center gap-2 rounded-lg px-4 py-3">
                  <Lock className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                  <input
                    type={showRecoveryPwd ? 'text' : 'password'}
                    value={recoveryPassword}
                    onChange={(e) => setRecoveryPassword(e.target.value)}
                    placeholder="At least 10 characters"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#5f6e7c]"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowRecoveryPwd((v) => !v)} className="text-[#5f6e7c] hover:text-[#84929f]">
                    {showRecoveryPwd ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-semibold tracking-[0.2em] text-[#84929f] uppercase">Confirm New Password</label>
                <div className="recessed-field flex items-center gap-2 rounded-lg px-4 py-3">
                  <Lock className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                  <input
                    type={showRecoveryPwd ? 'text' : 'password'}
                    value={recoveryConfirm}
                    onChange={(e) => setRecoveryConfirm(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#5f6e7c]"
                  />
                </div>
              </div>
              {recoveryResetError && (
                <p className="text-center text-[10px] text-red-400">{recoveryResetError}</p>
              )}
              <button
                type="button"
                disabled={recoveryResetSubmitting || !recoveryPassword || !recoveryConfirm}
                onClick={handleRecoveryResetSubmit}
                className="w-full rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/10 py-3 text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase disabled:opacity-50"
              >
                {recoveryResetSubmitting ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Set New Password'}
              </button>
              {onCancelRecoveryReset && (
                <button type="button" onClick={onCancelRecoveryReset} className="w-full text-center text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase hover:text-[#84929f]">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {(passwordMigrationPending || migration2faStep) && onCompleteMigration && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#c0911e]/30 bg-[#0a0c0e] p-6 shadow-2xl">
            {migrationStep === 'password' ? (
              <>
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#c0911e]/40 bg-[#c0911e]/10">
                    <ShieldCheck className="h-6 w-6 text-[#d4a52c]" strokeWidth={1.5} />
                  </div>
                  <h2 className="mt-3 text-sm font-bold tracking-[0.2em] text-white uppercase">Security Upgrade Required</h2>
                  <p className="mt-2 text-xs leading-5 text-[#84929f]">
                    SpotVault has upgraded account security. Please create a password and configure two-factor authentication to continue.
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2 text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">
                    <span className="text-[#d4a52c]">Step 1 — Create Password</span>
                    <span>→</span>
                    <span>Step 2 — Set Up 2FA</span>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  <div>
                    <label className="mb-1 block text-[9px] font-semibold tracking-[0.2em] text-[#84929f] uppercase">New Password</label>
                    <div className="recessed-field flex items-center gap-2 rounded-lg px-4 py-3">
                      <Lock className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                      <input
                        type={showMigrationPwd ? 'text' : 'password'}
                        value={migrationPassword}
                        onChange={(e) => setMigrationPassword(e.target.value)}
                        placeholder="At least 10 characters"
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#5f6e7c]"
                      />
                      <button type="button" onClick={() => setShowMigrationPwd((s) => !s)} className="text-[10px] text-[#5f6e7c] hover:text-[#84929f]">{showMigrationPwd ? 'Hide' : 'Show'}</button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[9px] font-semibold tracking-[0.2em] text-[#84929f] uppercase">Confirm Password</label>
                    <div className="recessed-field flex items-center gap-2 rounded-lg px-4 py-3">
                      <Lock className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                      <input
                        type={showMigrationPwd ? 'text' : 'password'}
                        value={migrationConfirm}
                        onChange={(e) => setMigrationConfirm(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#5f6e7c]"
                      />
                    </div>
                  </div>
                  {migrationError && <p className="text-center text-[10px] font-mono tracking-widest text-red-400 uppercase">{migrationError}</p>}
                  <button
                    type="button"
                    disabled={migrationSubmitting || !migrationPassword || !migrationConfirm}
                    onClick={handleMigrationSubmit}
                    className="w-full rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/10 py-3 text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase disabled:opacity-50"
                  >
                    {migrationSubmitting ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Continue'}
                  </button>
                  {onCancelMigration && (
                    <button type="button" onClick={onCancelMigration} className="w-full text-center text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase hover:text-[#84929f]">
                      Log Out
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#c0911e]/40 bg-[#c0911e]/10">
                    <Smartphone className="h-6 w-6 text-[#d4a52c]" strokeWidth={1.5} />
                  </div>
                  <h2 className="mt-3 text-sm font-bold tracking-[0.2em] text-white uppercase">Set Up Two-Factor Authentication</h2>
                  <p className="mt-2 text-xs leading-5 text-[#84929f]">
                    Choose a verification method. You can change this later in Security settings.
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2 text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">
                    <span className="text-[#d4a52c]">✓ Step 1 — Password</span>
                    <span>→</span>
                    <span className="text-[#d4a52c]">Step 2 — Set Up 2FA</span>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  <button
                    type="button"
                    onClick={() => onMigration2faMethod?.('authenticator')}
                    className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors hover:border-[#c0911e]/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="h-4 w-4 text-white/40" strokeWidth={1.5} />
                      <div>
                        <p className="text-[12px] font-semibold text-white/80">Authenticator App</p>
                        <p className="text-[10px] text-white/30">Recommended — Google Authenticator, Authy, 1Password</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMigration2faMethod?.('email')}
                    className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors hover:border-[#c0911e]/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-white/40" strokeWidth={1.5} />
                      <div>
                        <p className="text-[12px] font-semibold text-white/80">Email Code</p>
                        <p className="text-[10px] text-white/30">Receive a 6-digit code via email</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMigration2faMethod?.('sms')}
                    className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors hover:border-[#c0911e]/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="h-4 w-4 text-white/40" strokeWidth={1.5} />
                      <div>
                        <p className="text-[12px] font-semibold text-white/80">SMS Code</p>
                        <p className="text-[10px] text-white/30">Receive a 6-digit code via text message</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                  </button>
                  {migrationError && <p className="text-center text-[10px] font-mono tracking-widest text-red-400 uppercase">{migrationError}</p>}
                  {onCancelMigration && (
                    <button type="button" onClick={onCancelMigration} className="w-full pt-2 text-center text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase hover:text-[#84929f]">
                      Log Out
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Corner labels */}
      <div className="absolute bottom-3 left-3 z-10 text-[8px] font-mono tracking-widest text-[#2a323b] uppercase sm:bottom-5 sm:left-5 sm:text-[9px]">SpotVault</div>
      <div className="absolute bottom-3 right-3 z-10 text-[8px] font-mono tracking-widest text-[#2a323b] uppercase sm:bottom-5 sm:right-5 sm:text-[9px]">Network</div>
    </div>
  );
}
