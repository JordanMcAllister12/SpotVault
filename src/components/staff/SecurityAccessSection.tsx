import { useState, useEffect, useCallback } from 'react';
import {
  Shield, ShieldCheck, KeyRound, Clock, UserPlus, UserMinus, AlertTriangle,
  Check, X, QrCode, Lock, Unlock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  enrollTotp, verifyTotp, listMfaFactors, createMfaChallenge, verifyMfaChallenge,
  logSecurityEvent, type MFAFactor,
} from '@/lib/securityEngine';
import { useStaffAccounts } from '@/hooks/useStaffAccounts';
import { STAFF_GLASS_PANEL } from '@/components/staff/staffGlass';
import type { SpotVaultAccount } from '@/types';

// ── Types ──────────────────────────────────────────────────────

interface SecurityConfig {
  mfa_required: boolean;
  session_timeout_minutes: number;
  updated_by: string | null;
  updated_at: string;
}

interface TemporaryAccessGrant {
  id: string;
  granted_to: string;
  granted_by: string;
  permission_level: 'read_only' | 'support_admin' | 'custom';
  permissions: string[];
  reason: string | null;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  status: 'active' | 'expired' | 'revoked';
  created_at: string;
}

type EnrollmentStep = 'idle' | 'enrolling' | 'verifying' | 'verified' | 'error';

// ── Component ──────────────────────────────────────────────────

export function SecurityAccessSection({ staffAccount }: { staffAccount: SpotVaultAccount }) {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [factorsLoading, setFactorsLoading] = useState(true);
  const [grants, setGrants] = useState<TemporaryAccessGrant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);

  // MFA enrollment state
  const [enrollStep, setEnrollStep] = useState<EnrollmentStep>('idle');
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [enrollSecret, setEnrollSecret] = useState<string | null>(null);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [enrollCode, setEnrollCode] = useState('');
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // MFA challenge state (for toggling MFA on/off)
  const [challengeStep, setChallengeStep] = useState<'idle' | 'challenging' | 'done'>('idle');
  const [challengeCode, setChallengeCode] = useState('');
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [pendingToggleValue, setPendingToggleValue] = useState<boolean | null>(null);

  const isFounder = staffAccount.role === 'superuser' || staffAccount.primaryRole === 'superuser';

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    const { data, error } = await supabase.from('staff_security_config').select('*').limit(1).maybeSingle();
    if (!error && data) setConfig(data as SecurityConfig);
    setConfigLoading(false);
  }, []);

  const loadFactors = useCallback(async () => {
    setFactorsLoading(true);
    const f = await listMfaFactors();
    setFactors(f);
    setFactorsLoading(false);
  }, []);

  const loadGrants = useCallback(async () => {
    setGrantsLoading(true);
    // First expire any stale grants
    await supabase.rpc('sv_expire_staff_temporary_access');
    const { data, error } = await supabase
      .from('staff_temporary_access')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setGrants(data as TemporaryAccessGrant[]);
    setGrantsLoading(false);
  }, []);

  useEffect(() => { loadConfig(); loadFactors(); loadGrants(); }, [loadConfig, loadFactors, loadGrants]);

  const hasVerifiedTotp = factors.some((f) => f.status === 'verified');

  // ── MFA Enrollment ──
  const handleEnroll = async () => {
    setEnrollStep('enrolling');
    setEnrollError(null);
    const result = await enrollTotp();
    if (result.ok && result.qrUri && result.factorId) {
      setQrUri(result.qrUri);
      setEnrollSecret(result.secret ?? null);
      setEnrollFactorId(result.factorId);
      setEnrollStep('verifying');
    } else {
      setEnrollError(result.error ?? 'Enrollment failed.');
      setEnrollStep('error');
    }
  };

  const handleVerifyEnroll = async () => {
    if (!enrollFactorId || enrollCode.length !== 6) return;
    setEnrollStep('verifying');
    setEnrollError(null);
    // Create challenge then verify
    const challengeResult = await createMfaChallenge(enrollFactorId);
    if (!challengeResult.ok || !challengeResult.challengeId) {
      setEnrollError(challengeResult.error ?? 'Could not create challenge.');
      setEnrollStep('error');
      return;
    }
    const verifyResult = await verifyMfaChallenge(enrollFactorId, challengeResult.challengeId, enrollCode);
    if (verifyResult.ok) {
      setEnrollStep('verified');
      await loadFactors();
      setMessage({ kind: 'success', text: 'Authenticator enrolled successfully.' });
      setTimeout(() => { setEnrollStep('idle'); setQrUri(null); setEnrollSecret(null); setEnrollFactorId(null); setEnrollCode(''); }, 2000);
    } else {
      setEnrollError(verifyResult.error ?? 'Verification failed. Check your code and try again.');
      setEnrollStep('error');
    }
  };

  // ── MFA Toggle ──
  const handleToggleMfa = async (enable: boolean) => {
    if (!hasVerifiedTotp && enable) {
      setMessage({ kind: 'error', text: 'You must enroll an authenticator before enabling MFA.' });
      return;
    }
    if (enable === config?.mfa_required) return;

    // If turning OFF, require MFA challenge first
    if (!enable && config?.mfa_required) {
      setPendingToggleValue(false);
      setChallengeStep('challenging');
      setChallengeCode('');
      setChallengeError(null);
      return;
    }

    // If turning ON, just update
    setPendingToggleValue(enable);
    await applyToggle(enable);
  };

  const applyToggle = async (enable: boolean) => {
    setToggleLoading(true);
    const { error } = await supabase
      .from('staff_security_config')
      .update({ mfa_required: enable, updated_by: staffAccount.id, updated_at: new Date().toISOString() })
      .eq('id', config?.id ?? '');
    setToggleLoading(false);
    if (error) {
      setMessage({ kind: 'error', text: `Failed to ${enable ? 'enable' : 'disable'} MFA: ${error.message}` });
    } else {
      await logSecurityEvent(enable ? 'staff_mfa_enabled' : 'staff_mfa_disabled', { actor: staffAccount.id });
      setMessage({ kind: 'success', text: `Google Authenticator requirement ${enable ? 'enabled' : 'disabled'}.` });
      await loadConfig();
    }
    setChallengeStep('idle');
    setPendingToggleValue(null);
  };

  const handleChallengeVerify = async () => {
    const verifiedFactor = factors.find((f) => f.status === 'verified');
    if (!verifiedFactor || challengeCode.length !== 6) return;
    const challengeResult = await createMfaChallenge(verifiedFactor.id);
    if (!challengeResult.ok || !challengeResult.challengeId) {
      setChallengeError(challengeResult.error ?? 'Could not create challenge.');
      return;
    }
    const verifyResult = await verifyMfaChallenge(verifiedFactor.id, challengeResult.challengeId, challengeCode);
    if (verifyResult.ok) {
      setChallengeStep('done');
      if (pendingToggleValue !== null) await applyToggle(pendingToggleValue);
    } else {
      setChallengeError(verifyResult.error ?? 'Invalid code. Try again.');
    }
  };

  // ── Temporary Access ──
  const handleRevoke = async (grantId: string) => {
    const { error } = await supabase
      .from('staff_temporary_access')
      .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoked_by: staffAccount.id })
      .eq('id', grantId);
    if (error) {
      setMessage({ kind: 'error', text: `Failed to revoke: ${error.message}` });
    } else {
      await logSecurityEvent('staff_temporary_access_revoked', { grant_id: grantId, actor: staffAccount.id });
      setMessage({ kind: 'success', text: 'Access revoked.' });
      loadGrants();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/[0.06] bg-[#0a0c0e]/40 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#d4a52c]" />
          <div>
            <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Security &amp; Access</div>
            <h1 className="mt-0.5 text-xl font-semibold text-white">Founder Authentication &amp; Temporary Access</h1>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-white/40">
          Control who can enter the Staff Console and for how long. Google Authenticator (TOTP) protects founder access.
        </p>
        {!isFounder && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[11px] text-amber-200">Only the founder can change security settings. You are viewing in read-only mode.</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5" style={{ overscrollBehavior: 'contain' }}>
        {message && (
          <div className={`flex items-center gap-2 rounded-lg border p-3 text-[11px] ${message.kind === 'success' ? 'border-emerald-300/20 bg-emerald-300/5 text-emerald-300' : message.kind === 'error' ? 'border-red-300/20 bg-red-300/5 text-red-300' : 'border-[#d4a52c]/20 bg-[#d4a52c]/5 text-[#f5e6b0]'}`}>
            {message.kind === 'success' ? <Check className="h-4 w-4" /> : message.kind === 'error' ? <AlertTriangle className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            {message.text}
            <button type="button" onClick={() => setMessage(null)} className="ml-auto text-white/40 hover:text-white"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        {/* ── Founder Authentication Panel ── */}
        <div className="rounded-xl border border-[#c0911e]/15 backdrop-blur-md" style={STAFF_GLASS_PANEL}>
          <div className="border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#d4a52c]" />
              <h2 className="text-[13px] font-bold tracking-widest text-white/80 uppercase">Founder Authentication</h2>
            </div>
            <p className="mt-1 text-[10px] text-white/40">Require Google Authenticator to enter the Staff Console.</p>
          </div>

          <div className="p-5 space-y-5">
            {/* MFA Toggle */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="flex items-center gap-3">
                {config?.mfa_required ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300/30 bg-emerald-300/10"><Lock className="h-5 w-5 text-emerald-300" /></div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5"><Unlock className="h-5 w-5 text-white/50" /></div>
                )}
                <div>
                  <div className="text-[12px] font-bold text-white">Require Google Authenticator</div>
                  <div className="mt-0.5 text-[10px] text-white/40">
                    {configLoading ? 'Loading...' : config?.mfa_required ? 'Enabled — TOTP code required to enter console' : 'Disabled — founder can enter without TOTP'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={!isFounder || toggleLoading || configLoading || challengeStep === 'challenging'}
                onClick={() => handleToggleMfa(!config?.mfa_required)}
                className={`relative flex h-7 w-14 items-center rounded-full border transition-all disabled:opacity-40 ${
                  config?.mfa_required
                    ? 'border-emerald-300/50 bg-emerald-300/20'
                    : 'border-white/15 bg-white/5'
                }`}
              >
                <span className={`absolute h-5 w-5 rounded-full transition-all ${config?.mfa_required ? 'left-8 bg-emerald-300' : 'left-1 bg-white/40'}`} />
              </button>
            </div>

            {/* Session timeout */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-white/50" />
                <div>
                  <div className="text-[12px] font-bold text-white">Session Timeout</div>
                  <div className="mt-0.5 text-[10px] text-white/40">Elevated staff session expires after this period</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {[15, 30, 60, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    disabled={!isFounder}
                    onClick={async () => {
                      const { error } = await supabase.from('staff_security_config').update({ session_timeout_minutes: mins, updated_by: staffAccount.id, updated_at: new Date().toISOString() }).eq('id', config?.id ?? '');
                      if (!error) { loadConfig(); setMessage({ kind: 'success', text: `Session timeout set to ${mins} minutes.` }); }
                    }}
                    className={`rounded-md border px-2.5 py-1.5 text-[9px] font-bold tracking-widest uppercase transition disabled:opacity-40 ${config?.session_timeout_minutes === mins ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}
                  >
                    {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </button>
                ))}
              </div>
            </div>

            {/* MFA Enrollment section */}
            <div className="rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2">
                <QrCode className="h-4 w-4 text-[#d4a52c]" />
                <span className="text-[10px] font-bold tracking-widest text-[#d4a52c] uppercase">Authenticator Setup</span>
              </div>

              {factorsLoading ? (
                <div className="py-4 text-center text-[10px] text-white/40">Checking authenticator status...</div>
              ) : hasVerifiedTotp ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-300" />
                  <div>
                    <div className="text-[11px] font-bold text-emerald-300">Authenticator Active</div>
                    <div className="mt-0.5 text-[10px] text-white/50">
                      {factors.length} factor(s) enrolled. Your Google Authenticator is ready.
                    </div>
                  </div>
                </div>
              ) : enrollStep === 'verifying' && qrUri ? (
                <div className="space-y-4">
                  <p className="text-[10px] text-white/50">Scan this QR code with Google Authenticator, then enter the 6-digit code.</p>
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-lg border border-white/10 bg-white p-2">
                      <img src={qrUri} alt="QR Code" className="h-40 w-40" />
                    </div>
                    {enrollSecret && (
                      <div className="text-center">
                        <div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Manual Entry Key</div>
                        <div className="mt-1 font-mono text-[10px] text-white/60 break-all max-w-xs">{enrollSecret}</div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] font-mono tracking-widest text-white/40 uppercase">6-Digit Verification Code</label>
                    <input
                      value={enrollCode}
                      onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center text-[16px] font-mono font-bold tracking-[0.3em] text-white outline-none focus:border-[#d4a52c]/60 placeholder:text-white/20"
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleVerifyEnroll} disabled={enrollCode.length !== 6} className="flex-1 rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/20 py-2.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#d4a52c]/30 disabled:opacity-40">
                      Verify &amp; Complete
                    </button>
                    <button type="button" onClick={() => { setEnrollStep('idle'); setQrUri(null); setEnrollSecret(null); setEnrollFactorId(null); setEnrollCode(''); }} className="rounded-lg border border-white/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:text-white/80">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : enrollStep === 'verified' ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-3">
                  <Check className="h-5 w-5 text-emerald-300" />
                  <span className="text-[11px] font-bold text-emerald-300">Enrollment successful! You can now enable MFA.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] text-white/50">
                    No authenticator enrolled yet. Enroll Google Authenticator to enable TOTP protection for Staff Console access.
                  </p>
                  {enrollError && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/5 p-2 text-[10px] text-red-300">
                      <AlertTriangle className="h-3.5 w-3.5" /> {enrollError}
                    </div>
                  )}
                  <button type="button" disabled={!isFounder} onClick={handleEnroll} className="flex items-center gap-2 rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/15 px-4 py-2.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#d4a52c]/25 disabled:opacity-40">
                    <QrCode className="h-3.5 w-3.5" /> Enroll Authenticator
                  </button>
                </div>
              )}
            </div>

            {/* MFA Challenge for toggling OFF */}
            {challengeStep === 'challenging' && (
              <div className="rounded-lg border border-amber-300/30 bg-amber-300/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                  <span className="text-[11px] font-bold text-amber-200">Verify with your authenticator to disable MFA</span>
                </div>
                <p className="mb-3 text-[10px] text-white/50">Enter a 6-digit code from Google Authenticator to confirm this change.</p>
                <input
                  value={challengeCode}
                  onChange={(e) => { setChallengeCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setChallengeError(null); }}
                  placeholder="000000"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center text-[16px] font-mono font-bold tracking-[0.3em] text-white outline-none focus:border-amber-300/60 placeholder:text-white/20"
                  inputMode="numeric"
                  maxLength={6}
                />
                {challengeError && <p className="mt-2 text-[10px] text-red-300">{challengeError}</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={handleChallengeVerify} disabled={challengeCode.length !== 6} className="flex-1 rounded-lg border border-amber-300/40 bg-amber-300/10 py-2.5 text-[10px] font-bold tracking-widest text-amber-200 uppercase transition hover:bg-amber-300/20 disabled:opacity-40">
                    Verify &amp; Disable
                  </button>
                  <button type="button" onClick={() => { setChallengeStep('idle'); setChallengeCode(''); setChallengeError(null); setPendingToggleValue(null); }} className="rounded-lg border border-white/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:text-white/80">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Last updated */}
            {config?.updated_at && (
              <div className="text-[9px] text-white/30">
                Last changed: {new Date(config.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>

        {/* ── Temporary Administrative Access Panel ── */}
        <TemporaryAccessPanel
          staffAccount={staffAccount}
          grants={grants}
          grantsLoading={grantsLoading}
          isFounder={isFounder}
          onRevoke={handleRevoke}
          onGrantCreated={() => { loadGrants(); setMessage({ kind: 'success', text: 'Temporary access granted.' }); }}
        />
      </div>
    </div>
  );
}

// ── Temporary Access Panel ─────────────────────────────────────

function TemporaryAccessPanel({
  staffAccount, grants, grantsLoading, isFounder, onRevoke, onGrantCreated,
}: {
  staffAccount: SpotVaultAccount;
  grants: TemporaryAccessGrant[];
  grantsLoading: boolean;
  isFounder: boolean;
  onRevoke: (id: string) => void;
  onGrantCreated: () => void;
}) {
  const staff = useStaffAccounts();
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [permissionLevel, setPermissionLevel] = useState<'read_only' | 'support_admin' | 'custom'>('read_only');
  const [reason, setReason] = useState('');
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const STAFF_ROLES = new Set(['staff', 'moderator', 'developer_admin']);
  const staffUsers = staff.accounts.filter((u) => STAFF_ROLES.has(u.role) && u.role !== 'superuser');

  const handleSubmit = async () => {
    if (!selectedUserId || !reason.trim()) {
      setError('Select a staff member and provide a reason.');
      return;
    }
    setGranting(true);
    setError(null);
    const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString();
    const { error: insertError } = await supabase.from('staff_temporary_access').insert({
      granted_to: selectedUserId,
      granted_by: staffAccount.id,
      permission_level: permissionLevel,
      permissions: [],
      reason: reason.trim(),
      expires_at: expiresAt,
      status: 'active',
    });
    setGranting(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      await logSecurityEvent('staff_temporary_access_granted', { granted_to: selectedUserId, permission_level: permissionLevel, actor: staffAccount.id });
      setShowGrantForm(false);
      setSelectedUserId('');
      setReason('');
      setDuration(60);
      setPermissionLevel('read_only');
      onGrantCreated();
    }
  };

  const formatExpiry = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const formatRemaining = (iso: string) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'expired';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m left`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
  };

  const grantUserIds = grants.map((g) => g.granted_to);
  const grantNames = useGrantUserNames(grantUserIds);

  return (
    <div className="rounded-xl border border-[#c0911e]/15 backdrop-blur-md" style={STAFF_GLASS_PANEL}>
      <div className="border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-[#d4a52c]" />
            <h2 className="text-[13px] font-bold tracking-widest text-white/80 uppercase">Temporary Administrative Access</h2>
          </div>
          {isFounder && (
            <button type="button" onClick={() => setShowGrantForm((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/10 px-3 py-2 text-[9px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#d4a52c]/20">
              <UserPlus className="h-3.5 w-3.5" /> Grant Access
            </button>
          )}
        </div>
        <p className="mt-1 text-[10px] text-white/40">Authorize staff for limited-time administrative access with scoped permissions.</p>
      </div>

      <div className="p-5 space-y-4">
        {/* Grant form */}
        {showGrantForm && isFounder && (
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4 space-y-3">
            {error && <div className="flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/5 p-2 text-[10px] text-red-300"><AlertTriangle className="h-3.5 w-3.5" /> {error}</div>}
            <div>
              <label className="text-[9px] font-mono tracking-widest text-white/40 uppercase">Staff Member</label>
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#d4a52c]/60">
                <option value="">Select staff member...</option>
                {staffUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>{u.display_name} (@{u.username})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-mono tracking-widest text-white/40 uppercase">Access Duration</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  { mins: 30, label: '30 min' },
                  { mins: 60, label: '1 hour' },
                  { mins: 240, label: '4 hours' },
                  { mins: 1440, label: '24 hours' },
                ].map((d) => (
                  <button key={d.mins} type="button" onClick={() => setDuration(d.mins)} className={`rounded-md border px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase transition ${duration === d.mins ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-mono tracking-widest text-white/40 uppercase">Permission Level</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {([
                  { value: 'read_only', label: 'Read Only' },
                  { value: 'support_admin', label: 'Support Admin' },
                  { value: 'custom', label: 'Custom' },
                ] as const).map((p) => (
                  <button key={p.value} type="button" onClick={() => setPermissionLevel(p.value)} className={`rounded-md border px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase transition ${permissionLevel === p.value ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[9px] text-white/30">
                {permissionLevel === 'read_only' && 'View administrative information without making changes.'}
                {permissionLevel === 'support_admin' && 'Access user-support and moderation controls.'}
                {permissionLevel === 'custom' && 'Founder selects individual capabilities (coming soon).'}
              </p>
            </div>
            <div>
              <label className="text-[9px] font-mono tracking-widest text-white/40 uppercase">Reason for Access</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Investigating user support ticket #123" className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#d4a52c]/60 placeholder:text-white/25" />
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={granting || !selectedUserId || !reason.trim()} onClick={handleSubmit} className="flex-1 rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/20 py-2.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#d4a52c]/30 disabled:opacity-40">
                {granting ? 'Granting...' : 'Grant Access'}
              </button>
              <button type="button" onClick={() => setShowGrantForm(false)} className="rounded-lg border border-white/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:text-white/80">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Active grants table */}
        {grantsLoading ? (
          <div className="py-6 text-center text-[11px] text-white/40">Loading access grants...</div>
        ) : grants.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-[11px] text-white/40">
            <Clock className="mx-auto h-6 w-6 text-white/15" />
            <p className="mt-2">No temporary access grants active.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {grants.map((grant) => {
              const name = grantNames[grant.granted_to] ?? grant.granted_to.slice(0, 8);
              const isActive = grant.status === 'active' && new Date(grant.expires_at) > new Date();
              return (
                <div key={grant.id} className={`flex items-center justify-between rounded-lg border p-3 ${isActive ? 'border-emerald-300/20 bg-emerald-300/[0.03]' : 'border-white/[0.06] bg-white/[0.01] opacity-70'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-white">{name}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase ${
                        isActive ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-300' :
                        grant.status === 'revoked' ? 'border-red-300/25 bg-red-300/10 text-red-300' :
                        'border-white/15 bg-white/5 text-white/40'
                      }`}>
                        {isActive ? 'Active' : grant.status === 'revoked' ? 'Revoked' : 'Expired'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-white/40">
                      <span className="font-bold tracking-widest text-[#d4a52c] uppercase">{grant.permission_level.replace(/_/g, ' ')}</span>
                      <span>·</span>
                      <span>Expires: {formatExpiry(grant.expires_at)}</span>
                      {isActive && <><span>·</span><span className="text-emerald-300/70">{formatRemaining(grant.expires_at)}</span></>}
                    </div>
                    {grant.reason && <div className="mt-1 text-[10px] text-white/50">{grant.reason}</div>}
                  </div>
                  {isActive && isFounder && (
                    <button type="button" onClick={() => onRevoke(grant.id)} className="flex shrink-0 items-center gap-1 rounded-lg border border-red-300/20 bg-red-300/5 px-3 py-2 text-[9px] font-bold tracking-widest text-red-200 uppercase transition hover:bg-red-300/10">
                      <UserMinus className="h-3 w-3" /> Revoke
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper: resolve grant user names ───────────────────────────

function useGrantUserNames(userIds: string[]): Record<string, { display_name: string; username: string } | undefined> {
  const [names, setNames] = useState<Record<string, { display_name: string; username: string } | undefined>>({});
  useEffect(() => {
    if (userIds.length === 0) return;
    (async () => {
      const unique = [...new Set(userIds)];
      const { data } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, username')
        .in('user_id', unique);
      const map: Record<string, { display_name: string; username: string }> = {};
      for (const row of data ?? []) {
        map[row.user_id] = { display_name: row.display_name ?? 'Unknown', username: row.username ?? '' };
      }
      setNames(map);
    })();
  }, [userIds.join(',')]);
  return names;
}
