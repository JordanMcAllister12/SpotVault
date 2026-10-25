import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Lock, ArrowRight, X, Loader2, Smartphone, Mail, KeyRound, ChevronDown } from 'lucide-react';
import type { MfaMethod } from '@/lib/mfaAuth';
import { sendLoginOtp } from '@/lib/mfaAuth';

interface Props {
  onVerify: (method: MfaMethod, code: string) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
  accountName?: string;
  availableMethods: MfaMethod[];
  rememberDevice: boolean;
  onRememberDeviceChange: (value: boolean) => void;
  userEmail?: string;
  phoneMasked?: string;
}

const METHOD_LABELS: Record<MfaMethod, { label: string; icon: typeof ShieldCheck; hint: string }> = {
  totp: { label: 'Authenticator App', icon: KeyRound, hint: 'Enter the 6-digit code from your authenticator app.' },
  sms: { label: 'Text Message', icon: Smartphone, hint: 'We sent a verification code to your phone.' },
  email: { label: 'Email Code', icon: Mail, hint: 'We sent a verification code to your email.' },
};

export function MfaChallengeScreen({
  onVerify,
  onCancel,
  accountName,
  availableMethods,
  rememberDevice,
  onRememberDeviceChange,
  userEmail,
  phoneMasked,
}: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<MfaMethod | null>(null);
  const [methodSelectorOpen, setMethodSelectorOpen] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Auto-select the first available method
  useEffect(() => {
    if (!selectedMethod && availableMethods.length > 0) {
      setSelectedMethod(availableMethods[0]);
    }
  }, [availableMethods, selectedMethod]);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const sendOtp = useCallback(async (method: MfaMethod) => {
    if (method !== 'sms' && method !== 'email') return;
    setOtpSending(true);
    setError('');
    try {
      let destination = '';
      if (method === 'sms') {
        // We need the phone number — but we only have the masked version.
        // The edge function will look up the real number from the DB.
        destination = phoneMasked ?? '';
      } else {
        destination = userEmail ?? '';
      }
      if (!destination) {
        setError('No destination configured for this method.');
        return;
      }
      const result = await sendLoginOtp(method, destination);
      if (!result.ok) {
        setError(result.error || 'Failed to send code.');
        return;
      }
      setOtpSent(true);
      setResendCooldown(30);
    } finally {
      setOtpSending(false);
    }
  }, [phoneMasked, userEmail]);

  // Auto-send OTP when SMS or email method is selected
  useEffect(() => {
    if (selectedMethod === 'sms' || selectedMethod === 'email') {
      if (!otpSent) {
        sendOtp(selectedMethod);
      }
    }
  }, [selectedMethod, otpSent, sendOtp]);

  const handleMethodChange = (method: MfaMethod) => {
    setSelectedMethod(method);
    setMethodSelectorOpen(false);
    setCode('');
    setError('');
    setOtpSent(false);
    // Auto-send OTP for the new method
    if (method === 'sms' || method === 'email') {
      sendOtp(method);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMethod) return;
    if (code.length !== 6) {
      setError('Enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await onVerify(selectedMethod, code);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || 'Invalid code. Please try again.');
      setCode('');
    }
  };

  const currentMethodInfo = selectedMethod ? METHOD_LABELS[selectedMethod] : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#050608] px-4">
      {/* Background — same vault aesthetic as AccessScreen */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url("/assets/image copy 2.webp")' }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.28),transparent_35%,transparent_65%,rgba(0,0,0,0.32))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(0,0,0,0.72)_100%)]" />
      </div>

      {/* Challenge card */}
      <div className="relative z-10 w-full max-w-md">
        <div
          className="rounded-2xl px-6 py-8"
          style={{
            background: 'linear-gradient(180deg, rgba(10,12,14,0.82) 0%, rgba(8,10,12,0.88) 100%)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 20px 60px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: 'radial-gradient(circle, #1a2026 0%, #0e1114 100%)',
                boxShadow: 'inset 0 0 0 1px #2a323b, inset 0 0 0 2px #0a0c0e, inset 0 0 0 3px #232a32, 0 0 24px -4px rgba(212,165,44,0.22)',
              }}
            >
              <ShieldCheck className="h-6 w-6" style={{ color: '#d4a52c' }} strokeWidth={1.5} />
            </div>
          </div>

          {/* Title */}
          <div className="mt-4 text-center">
            <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Verify It's You
            </h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
              {accountName ? `Welcome, ${accountName.split(' ')[0]}. ` : ''}
              {currentMethodInfo?.hint ?? 'Choose a verification method below.'}
            </p>
          </div>

          {/* Method selector (only if multiple methods available) */}
          {availableMethods.length > 1 && (
            <div className="mt-5">
              <label className="mb-1.5 block text-[9px] font-semibold tracking-[0.25em] text-[#84929f] uppercase">
                Verification Method
              </label>
              <button
                type="button"
                onClick={() => setMethodSelectorOpen((v) => !v)}
                className="recessed-field flex w-full items-center justify-between rounded-lg px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  {selectedMethod && (() => {
                    const Icon = METHOD_LABELS[selectedMethod].icon;
                    return <Icon className="h-3.5 w-3.5" style={{ color: '#d4a52c' }} strokeWidth={1.5} />;
                  })()}
                  <span className="text-[12px] text-white/80">
                    {selectedMethod ? METHOD_LABELS[selectedMethod].label : 'Select method'}
                  </span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-[#5f6e7c] transition-transform ${methodSelectorOpen ? 'rotate-180' : ''}`} />
              </button>
              {methodSelectorOpen && (
                <div className="mt-1 overflow-hidden rounded-lg border border-[#2a323b] bg-[#0a0c0e]">
                  {availableMethods.map((method) => {
                    const info = METHOD_LABELS[method];
                    const Icon = info.icon;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => handleMethodChange(method)}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                        style={selectedMethod === method ? { background: 'rgba(212,165,44,0.06)' } : undefined}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: selectedMethod === method ? '#d4a52c' : '#5f6e7c' }} strokeWidth={1.5} />
                        <span className="text-[12px]" style={{ color: selectedMethod === method ? '#f5e6b0' : 'rgba(255,255,255,0.6)' }}>
                          {info.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Code input */}
          <div className="mt-5">
            <label className="mb-1.5 block text-[9px] font-semibold tracking-[0.25em] text-[#84929f] uppercase">
              Verification Code
            </label>
            <div className="recessed-field flex items-center gap-2 rounded-lg px-3 py-3">
              <Lock className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="000000"
                autoFocus
                className="w-full bg-transparent text-center text-lg tracking-[0.5em] text-white outline-none placeholder:text-white/20"
              />
            </div>
          </div>

          {/* Resend button for SMS/Email */}
          {(selectedMethod === 'sms' || selectedMethod === 'email') && (
            <div className="mt-2.5 text-center">
              {otpSending ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">
                  <Loader2 className="h-3 w-3 animate-spin" /> Sending code...
                </span>
              ) : resendCooldown > 0 ? (
                <span className="text-[10px] font-mono tracking-widest text-[#475565] uppercase">
                  Resend code in {resendCooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => selectedMethod && sendOtp(selectedMethod)}
                  className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase transition-colors hover:text-[#d4a52c]"
                >
                  Resend Code
                </button>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-3 text-center text-[10px] font-mono tracking-widest text-red-400 uppercase">{error}</p>
          )}

          {/* Remember this device */}
          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onRememberDeviceChange(!rememberDevice)}
              className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                rememberDevice ? 'border-[#c0911e]/60 bg-[#c0911e]/15' : 'border-[#38424e] bg-[#161b21]'
              }`}
            >
              {rememberDevice && (
                <svg viewBox="0 0 12 12" className="h-3 w-3">
                  <path d="M2 6 L5 9 L10 3" stroke="#d4a52c" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <span className="text-[10px] text-[#84929f]">Remember this device for 30 days</span>
          </label>

          {/* Actions */}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 py-3 text-[10px] font-semibold tracking-[0.25em] text-white/60 uppercase transition-colors hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || code.length !== 6}
              className="enter-vault-btn group flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-[10px] font-semibold tracking-[0.25em] uppercase disabled:opacity-50"
              style={{ color: '#f5e6b0' }}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  Verify
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
                </>
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-5 flex items-center justify-center gap-2 text-[8px] font-mono tracking-widest text-[#475565] uppercase">
            <span className="h-1 w-1 rounded-full bg-[#d4a52c]/60" />
            Two-Factor Authentication Required
          </div>
        </div>
      </div>
    </div>
  );
}
