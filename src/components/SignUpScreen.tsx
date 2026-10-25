import { useState } from 'react';
import {
  ArrowRight,
  User,
  X,
  ArrowLeft,
  Mail,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { HubId } from '@/types';
import { STAKEKINGS_BRANDING } from '@/lib/stakekingsBranding';

interface SignUpProps {
  onClose: () => void;
  onSubmit: (data: { name: string; username: string; email: string; homePortal: HubId; password: string }) => Promise<{ ok: boolean; error?: string }>
  onOpenLegal?: (view: 'privacy' | 'terms') => void;
  skEntry?: boolean;
}

export function SignUpScreen({ onClose, onSubmit, onOpenLegal, skEntry }: SignUpProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !username.trim() || !email.trim()) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setSubmitting(true);
    const result = await onSubmit({
      name, username, email,
      homePortal: 'PLAYER',
      password,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050608]">
      {/* SK branded background or default vault wall */}
      {skEntry ? (
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url("${STAKEKINGS_BRANDING.playerBackground}")` }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg,rgba(0,0,0,0.28),transparent 35%,transparent 65%,rgba(0,0,0,0.32))' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center,transparent 38%,rgba(0,0,0,0.62) 100%)' }} />
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 50%, #0c0e11 0%, #08090b 40%, #050608 80%)' }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 100% at 50% 50%, transparent 30%, rgba(5,6,8,0.5) 65%, #050608 95%)' }} />
        </>
      )}

      <div className="relative z-10 flex h-full items-center justify-center px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-[560px]">
          {/* Chassis */}
          <div className="console-chassis clip-industrial relative rounded-2xl">
            <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ boxShadow: 'inset 0 0 0 1px rgba(192,145,30,0.25)' }} />
            <div className="pointer-events-none absolute inset-[2px] rounded-2xl" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }} />

            {/* Corner bolts */}
            {['left-3 top-3', 'right-3 top-3', 'left-3 bottom-3', 'right-3 bottom-3'].map((pos) => (
              <div key={pos} className={`absolute ${pos} h-2 w-2 rounded-full`} style={{ background: 'radial-gradient(circle at 35% 35%, #4a5260 0%, #2a323b 50%, #0e1114 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 0 1px #0a0c0e' }} />
            ))}

            <div className="console-inner clip-industrial relative m-2 rounded-xl px-8 py-8 lg:py-10">
              {/* Header */}
              <div className="flex items-center justify-between">
                <button onClick={onClose} className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase transition-colors hover:text-white">
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Back to Login
                </button>
                <button onClick={onClose} className="text-[#5f6e7c] transition-colors hover:text-white">
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              <div className="mt-4 text-center">
                <h1 className="text-2xl font-bold tracking-tight">
                  {skEntry ? (
                    <>
                      <span className="silver-metal-text">SpotVault</span>
                      <span className="text-[#22c55e]"> × </span>
                      <span className="text-[#22c55e]" style={{ textShadow: '0 0 12px rgba(34,197,94,0.3)' }}>StakeKings</span>
                    </>
                  ) : (
                    <>
                      <span className="silver-metal-text">Create Your</span>{' '}
                      <span style={{ background: 'linear-gradient(180deg, #8a6515 0%, #d4a52c 30%, #f5e6b0 50%, #d4a52c 70%, #8a6515 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        SpotVault Identity
                      </span>
                    </>
                  )}
                </h1>
                <p className="mt-2 text-[11px] font-mono tracking-[0.25em] text-[#5f6e7c] uppercase">
                  {skEntry ? 'Player Development Academy — Create Your Account' : 'Every account starts with the free Player Portal'}
                </p>
              </div>

              <div className="my-6 h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #232a32 30%, #2a323b 50%, #232a32 70%, transparent)' }} />

              <div className="space-y-4">
                <SignUpField label="Full Name" value={name} onChange={setName} placeholder="Your name" />
                <SignUpField label="Username" value={username} onChange={setUsername} placeholder="Choose a username" />
                <SignUpField label="Email" value={email} onChange={setEmail} placeholder="you@example.com" icon={<Mail className="h-4 w-4 text-[#5f6e7c]" strokeWidth={1.5} />} />
                <SignUpField label="Password (min 10 characters)" value={password} onChange={setPassword} placeholder="Create a password" type={showPassword ? 'text' : 'password'} icon={
                  <button onClick={() => setShowPassword(!showPassword)} className="text-[#5f6e7c] transition-colors hover:text-white">
                    {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                  </button>
                } />
                <SignUpField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" type={showPassword ? 'text' : 'password'} />

                {error && <div className="text-[11px] font-medium text-red-400">{error}</div>}

                {onOpenLegal && (
                  <p className="pt-1 text-center text-[10px] leading-relaxed text-[#5f6e7c]">
                    By creating an account, you agree to the{' '}
                    <button type="button" onClick={() => onOpenLegal('terms')} className="text-[#84929f] underline transition-colors hover:text-[#d4a52c]">Terms of Service</button>
                    {' '}and acknowledge the{' '}
                    <button type="button" onClick={() => onOpenLegal('privacy')} className="text-[#84929f] underline transition-colors hover:text-[#d4a52c]">Privacy Policy</button>.
                  </p>
                )}

                <button onClick={handleSubmit} className="enter-vault-btn group flex w-full items-center justify-center gap-2.5 rounded-lg py-3.5 text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: '#f5e6b0' }}>
                  Continue
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignUpField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  icon?: React.ReactNode;
  inputMode?: 'numeric' | 'text' | 'email';
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold tracking-[0.25em] text-[#84929f] uppercase">{label}</label>
      <div className="recessed-field flex items-center gap-3 rounded-lg px-4 py-3">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className="w-full bg-transparent font-mono text-sm text-white placeholder-[#364049] outline-none"
        />
        {icon}
      </div>
    </div>
  );
}

// ===== PENDING APPROVAL SCREEN =====

interface PendingProps {
  account: import('@/types').SpotVaultAccount;
  onDemoApprove: () => void;
  onBackToLogin: () => void;
}

export function PendingApprovalScreen({ account, onDemoApprove, onBackToLogin }: PendingProps) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050608]">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 50%, #0c0e11 0%, #08090b 40%, #050608 80%)' }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 100% at 50% 50%, transparent 30%, rgba(5,6,8,0.5) 65%, #050608 95%)' }} />

      <div className="relative z-10 flex h-full items-center justify-center px-6">
        <div className="w-full max-w-[460px]">
          <div className="console-chassis clip-industrial relative rounded-2xl">
            <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ boxShadow: 'inset 0 0 0 1px rgba(192,145,30,0.25)' }} />
            <div className="console-inner clip-industrial relative m-2 rounded-xl px-8 py-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/5">
                <User className="h-8 w-8 text-amber-400/80" strokeWidth={1.5} />
              </div>

              <h1 className="mt-5 text-xl font-bold tracking-wide text-white">Application Submitted</h1>
              <p className="mt-2 text-sm text-[#84929f]">Your account is being reviewed.</p>

              <div className="my-6 h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #232a32 30%, #2a323b 50%, #232a32 70%, transparent)' }} />

              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between rounded-lg border border-[#1a2026] bg-[#0a0c0e] px-4 py-2.5">
                  <span className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Account Name</span>
                  <span className="text-xs font-semibold text-white">{account.name}</span>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <button
                  onClick={onDemoApprove}
                  className="enter-vault-btn group flex w-full items-center justify-center gap-2.5 rounded-lg py-3.5 text-xs font-semibold tracking-[0.25em] uppercase"
                  style={{ color: '#f5e6b0' }}
                >
                  Demo Approve
                </button>
                <button
                  onClick={onBackToLogin}
                  className="w-full rounded-lg border border-[#1a2026] bg-[#0a0c0e] py-3 text-[10px] font-semibold tracking-widest text-[#5f6e7c] uppercase transition-all hover:text-white"
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== ACCESS REQUEST MODAL =====

interface AccessRequestProps {
  targetPortal: HubId;
  currentHomePortal: HubId;
  onClose: () => void;
  onSubmit: (reason: string, credentials: string) => void;
}

export function AccessRequestModal({ targetPortal, currentHomePortal, onClose, onSubmit }: AccessRequestProps) {
  const [reason, setReason] = useState('');
  const [credentials, setCredentials] = useState('');

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-xl border border-white/10 bg-[#0a0c0e] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-wide text-white">Request {targetPortal} Access</h3>
          <button onClick={onClose} className="text-white/30 transition-colors hover:text-white">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-[10px] font-semibold tracking-widest text-white/40 uppercase">Reason for access</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="I need access because..."
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/20"
            rows={3}
          />
        </div>

        <div className="mt-3">
          <label className="mb-1.5 block text-[10px] font-semibold tracking-widest text-white/40 uppercase">Poker profile / credentials (optional)</label>
          <input
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
            placeholder="e.g. HendonMob link, Twitter handle"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/20"
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[10px] font-semibold tracking-widest text-white/60 uppercase transition-all hover:border-white/20 hover:text-white">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(reason, credentials)}
            disabled={!reason.trim()}
            className="flex-1 rounded-lg border border-[#c091e]/40 bg-[#c091e]/10 py-2.5 text-[10px] font-semibold tracking-widest text-[#d4a52c] uppercase transition-all hover:border-[#c091e]/60 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== PORTAL ACCESS MANAGEMENT PANEL =====

interface PortalAccessPanelProps {
  account: import('@/types').SpotVaultAccount;
  onClose: () => void;
  onRequestAccess: (portal: HubId) => void;
  onChangePin: (accountId: string, currentPin: string, newPin: string) => { ok: boolean; error?: string };
}

export function PortalAccessPanel({ account, onClose, onRequestAccess, onChangePin }: PortalAccessPanelProps) {
  const [changeOpen, setChangeOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);

  const submitPinChange = () => {
    if (newPin !== confirmPin) {
      setPinError('Passwords do not match.');
      return;
    }
    const result = onChangePin(account.id, currentPin, newPin);
    if (!result.ok) {
      setPinError(result.error ?? 'Unable to change password.');
      return;
    }
    setPinError('');
    setPinSuccess(true);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-xl border border-white/10 bg-[#0a0c0e] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-wide text-white">My Portal Access</h3>
            <p className="mt-0.5 text-[10px] font-mono tracking-widest text-white/30 uppercase">{account.name}</p>
          </div>
          <button onClick={onClose} className="text-white/30 transition-colors hover:text-white">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-4 max-h-[400px] space-y-2 overflow-y-auto">
          {account.grants.map((grant) => (
            <div key={grant.portal} className={`flex items-center gap-3 rounded-lg border p-3 ${
              grant.level === 'permanent' && grant.isHome
                ? 'border-[#c091e]/30 bg-[#c091e]/5'
                : grant.level === 'permanent'
                ? 'border-emerald-400/20 bg-emerald-400/5'
                : 'border-white/5 bg-white/[0.02]'
            }`}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${grant.level === 'none' ? 'text-white/40' : 'text-white'}`}>{grant.portal}</span>
                  {grant.isHome && <span className="rounded-full bg-[#c091e]/20 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-[#d4a52c] uppercase">Home</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!changeOpen ? (
          <button onClick={() => setChangeOpen(true)} className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 py-2.5 text-[10px] font-semibold tracking-widest text-white/60 uppercase transition-all hover:border-white/20 hover:text-white">
            Change Password
          </button>
        ) : (
          <div className="mt-4 space-y-2">
            <input type="password" value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} placeholder="Current password" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/20" />
            <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="New password (min 10 chars)" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/20" />
            <input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} placeholder="Confirm new password" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/20" />
            {pinError && <p className="text-[11px] text-red-400">{pinError}</p>}
            {pinSuccess && <p className="text-[11px] text-emerald-400">Password changed successfully.</p>}
            <div className="flex gap-2">
              <button onClick={() => { setChangeOpen(false); setPinError(''); setPinSuccess(false); }} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[10px] font-semibold tracking-widest text-white/60 uppercase transition-all hover:border-white/20 hover:text-white">
                Cancel
              </button>
              <button onClick={submitPinChange} className="flex-1 rounded-lg border border-[#c091e]/40 bg-[#c091e]/10 py-2.5 text-[10px] font-semibold tracking-widest text-[#d4a52c] uppercase transition-all hover:border-[#c091e]/60">
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
