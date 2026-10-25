import { useState, useEffect, useCallback } from 'react';
import { Lock, User, Mail, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import {
  redeemProvisioningToken,
  completeStakeKingsOnboarding,
  recordPolicyAcceptance,
  linkStakeKingsAccount,
  grantStakeKingsPortalAccess,
  TERMS_VERSION,
  PRIVACY_VERSION,
  type ProvisioningData,
} from '@/lib/skProvisioning';
import { supabase } from '@/lib/supabase';
import { acquireUserAttribution } from '@/lib/skAttribution';
import { STAKEKINGS_BRANDING } from '@/lib/stakekingsBranding';

type OnboardStage = 'validating' | 'invalid' | 'form' | 'existing' | 'creating' | 'success' | 'error';

export function StakeKingsOnboarding({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState<OnboardStage>('validating');
  const [provisioning, setProvisioning] = useState<ProvisioningData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  const validateToken = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      setErrorMsg('No onboarding token found. Please use the link provided by StakeKings.');
      setStage('invalid');
      return;
    }
    try {
      const data = await redeemProvisioningToken(token);
      if (!data.valid) {
        setErrorMsg(data.error ?? 'This onboarding link is invalid or has expired.');
        setStage('invalid');
        return;
      }
      setProvisioning(data);
      if (data.status === 'existing_user') {
        setStage('existing');
        return;
      }
      setDisplayName(data.displayName ?? '');
      setUsername(data.externalUsername ?? '');
      setEmail(data.email ?? '');
      setStage('form');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Token validation failed.');
      setStage('invalid');
    }
  }, []);

  useEffect(() => {
    void validateToken();
  }, [validateToken]);

  const handleSubmit = async () => {
    if (!provisioning || provisioning.status !== 'new_user') return;

    if (!displayName.trim() || !username.trim() || !email.trim()) {
      setErrorMsg('All fields are required.');
      setStage('error');
      return;
    }
    if (password.length < 10) {
      setErrorMsg('Password must be at least 10 characters.');
      setStage('error');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      setStage('error');
      return;
    }
    if (!agreeTerms || !agreePrivacy) {
      setErrorMsg('You must accept the Terms of Service and Privacy Policy to continue.');
      setStage('error');
      return;
    }

    setStage('creating');
    setErrorMsg('');

    try {
      const result = await completeStakeKingsOnboarding({
        email: email.trim(),
        password,
        username: username.trim(),
        displayName: displayName.trim(),
        externalUserId: provisioning.externalUserId,
      });

      if (!result.ok || !result.userId) {
        setErrorMsg(result.error ?? 'Account creation failed.');
        setStage('error');
        return;
      }

      // Sign in the newly created user to establish a session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        // Account was created but auto-login failed — redirect to login
        setStage('success');
        return;
      }

      // Set SK attribution
      try { await acquireUserAttribution('SK'); } catch { /* ignore */ }

      // Mark the provisioning request as consumed by this user
      try {
        await supabase
          .from('sk_provisioning_requests')
          .update({ consumed_by_user_id: result.userId })
          .eq('id', provisioning.requestId);
      } catch { /* ignore */ }

      setStage('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Account creation failed.');
      setStage('error');
    }
  };

  const handleExistingUserLink = async () => {
    if (!provisioning || provisioning.status !== 'existing_user') return;
    // For existing users, we need to link their account and grant portal access
    // They'll need to log in normally — redirect to /sk login
    try {
      sessionStorage.setItem('spotvault-sk-entry', 'true');
    } catch { /* ignore */ }
    onComplete();
  };

  const bgImage = STAKEKINGS_BRANDING.playerBackground;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-[#050608]"
      style={bgImage ? {
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md px-4 py-8 my-auto">
        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(8,7,6,0.82)',
            border: '1px solid rgba(212,165,44,0.12)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            boxShadow: '0 4px 24px -4px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header inside card */}
          <div className="mb-5 flex flex-col items-center text-center">
            <p className="text-sm font-medium leading-relaxed text-white/80 sm:text-base">
              Welcome to the Official Poker Education &amp; Training Platform of
            </p>
            <img
              src="/assets/stakekings/image copy 2.webp"
              alt="StakeKings"
              className="mt-3 h-auto w-[170px] object-contain sm:w-[190px]"
            />
          </div>
          {/* Validating */}
          {stage === 'validating' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#d4a52c] mb-3" />
              <p className="text-sm text-white/70">Validating your onboarding link...</p>
            </div>
          )}

          {/* Invalid */}
          {stage === 'invalid' && (
            <div className="flex flex-col items-center py-8 text-center">
              <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
              <p className="text-sm text-white/80 mb-4">{errorMsg}</p>
              <button
                onClick={onComplete}
                className="px-4 py-2 text-sm font-medium text-[#d4a52c] hover:text-[#c0911e] transition-colors"
              >
                Go to login
              </button>
            </div>
          )}

          {/* Existing user */}
          {stage === 'existing' && (
            <div className="flex flex-col items-center py-6 text-center">
              <AlertCircle className="h-10 w-10 text-[#d4a52c] mb-3" />
              <p className="text-sm text-white/80 mb-2">
                A SpotVault account is already associated with this StakeKings identity.
              </p>
              <p className="text-xs text-white/50 mb-5">
                Please log in using your existing SpotVault credentials. StakeKings portal access is linked to your account through the authorized provisioning process and cannot be activated through this onboarding flow.
              </p>
              <button
                onClick={handleExistingUserLink}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-[#050608] bg-[#d4a52c] hover:bg-[#c0911e] transition-colors"
              >
                Go to Login
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Form */}
          {(stage === 'form' || stage === 'error') && (
            <div className="space-y-4">
              <div className="mb-2">
                <h2 className="text-lg font-semibold text-white">Create Your Account</h2>
                <p className="text-xs text-white/50 mt-1">
                  Set up your SpotVault account to access the StakeKings Player Portal.
                </p>
              </div>

              {stage === 'error' && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-300">{errorMsg}</p>
                </div>
              )}

              {/* Display Name */}
              <Field label="Display Name" icon={<User className="h-4 w-4" />}>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none"
                  placeholder="Your name"
                />
              </Field>

              {/* Username */}
              <Field label="Username" icon={<User className="h-4 w-4" />}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none"
                  placeholder="username"
                />
              </Field>

              {/* Email */}
              <Field label="Email" icon={<Mail className="h-4 w-4" />}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none"
                  placeholder="you@example.com"
                />
              </Field>

              {/* Password */}
              <Field label="Password (min 10 characters)" icon={<Lock className="h-4 w-4" />}>
                <div className="flex items-center w-full">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none"
                    placeholder="••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-white/40 hover:text-white/60 transition-colors ml-2"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {/* Confirm Password */}
              <Field label="Confirm Password" icon={<Lock className="h-4 w-4" />}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none"
                  placeholder="••••••••••"
                />
              </Field>

              {/* Terms acceptance */}
              <div className="space-y-2.5 pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setAgreeTerms(!agreeTerms)}
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors flex items-center justify-center ${
                      agreeTerms
                        ? 'bg-[#d4a52c] border-[#d4a52c]'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {agreeTerms && <CheckCircle2 className="h-3 w-3 text-[#050608]" />}
                  </button>
                  <span className="text-xs text-white/60 leading-relaxed">
                    I agree to the <span className="text-[#d4a52c]">Terms of Service</span> (v{TERMS_VERSION})
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setAgreePrivacy(!agreePrivacy)}
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors flex items-center justify-center ${
                      agreePrivacy
                        ? 'bg-[#d4a52c] border-[#d4a52c]'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {agreePrivacy && <CheckCircle2 className="h-3 w-3 text-[#050608]" />}
                  </button>
                  <span className="text-xs text-white/60 leading-relaxed">
                    I acknowledge the <span className="text-[#d4a52c]">Privacy Policy</span> (v{PRIVACY_VERSION})
                  </span>
                </label>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={stage === 'creating'}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm text-[#050608] bg-[#d4a52c] hover:bg-[#c0911e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
              >
                {stage === 'creating' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating your account...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Create Account & Enter
                  </>
                )}
              </button>
            </div>
          )}

          {/* Success */}
          {stage === 'success' && (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-[#d4a52c] mb-3" />
              <p className="text-sm text-white/80 mb-2">Your account is ready!</p>
              <p className="text-xs text-white/50 mb-5">
                Redirecting you to the StakeKings Player Portal...
              </p>
              <button
                onClick={onComplete}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-[#050608] bg-[#d4a52c] hover:bg-[#c0911e] transition-colors"
              >
                Enter SpotVault
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/30 mt-4">
          Secured by SpotVault · One-time onboarding link
        </p>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(212,165,44,0.10)',
        }}
      >
        <span className="text-white/30 shrink-0">{icon}</span>
        {children}
      </div>
    </div>
  );
}
