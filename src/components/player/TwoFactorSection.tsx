import { useState, useEffect, useCallback } from 'react';
import {
  Shield, KeyRound, Check, X, Loader2,
  AlertTriangle, Copy, RefreshCw,
} from 'lucide-react';
import {
  enrollTotp, removeTotpFactor, listMfaFactors,
  createMfaChallenge, verifyMfaChallenge,
  logSecurityEvent,
  type MFAFactor,
} from '@/lib/securityEngine';
import { getMfaPreferences, sendSecurityNotification, type MfaPreferences } from '@/lib/mfaAuth';
import { supabase } from '@/lib/supabase';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

function StatusBadge({ status, label }: { status: 'ok' | 'warn' | 'off'; label: string }) {
  const colors = {
    ok: { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.3)', text: '#4ade80', icon: Check },
    warn: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', text: '#fbbf24', icon: AlertTriangle },
    off: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.35)', icon: X },
  };
  const c = colors[status];
  const Icon = c.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase" style={{ borderColor: c.border, background: c.bg, color: c.text }}>
      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} /> {label}
    </span>
  );
}

function SectionCard({ icon, title, children, action }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4 md:p-5" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(212,165,44,0.06)' }}>
            {icon}
          </span>
          <h3 className="text-[11px] font-bold tracking-widest text-white/85 uppercase">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border p-5" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.95)' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-widest text-white/90 uppercase">{title}</h3>
          <button onClick={onClose} className="text-white/85 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Main 2FA section ──

export function TwoFactorSection({ email }: { email: string | null }) {
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [mfaPrefs, setMfaPrefs] = useState<MfaPreferences | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const results = await Promise.allSettled([
        listMfaFactors(),
        getMfaPreferences(),
      ]);
      const [f, prefs] = results.map(r => r.status === 'fulfilled' ? r.value : null);
      setFactors((f as MFAFactor[]) ?? []);
      setMfaPrefs(prefs as MfaPreferences | null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-white/85" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4">
        <p className="text-[11px] text-red-300">Unable to load two-factor authentication settings.</p>
        <button onClick={load} className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/90 uppercase hover:text-white">
          <RefreshCw className="mr-1.5 inline h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

  return (
    <MfaContent
      factors={factors}
      prefs={mfaPrefs}
      email={email}
      onReload={load}
    />
  );
}

function MfaContent({ factors, prefs, email, onReload }: {
  factors: MFAFactor[];
  prefs: MfaPreferences | null;
  email: string | null;
  onReload: () => void;
}) {
  const totpFactors = factors.filter(f => f.factor_type === 'totp' && f.status === 'verified');
  const hasTotp = totpFactors.length > 0;
  const [enrollModal, setEnrollModal] = useState(false);
  const [removeModal, setRemoveModal] = useState(false);
  const anyEnabled = hasTotp;

  return (
    <div className="space-y-4">
      {/* Status summary */}
      <SectionCard icon={<Shield className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />} title="Two-Factor Authentication">
        <div className="mb-3 flex items-center gap-2">
          {anyEnabled ? <StatusBadge status="ok" label="Enabled" /> : <StatusBadge status="off" label="Disabled" />}
          <span className="text-[10px] text-white/85">{anyEnabled ? 'Your account is protected with 2FA.' : 'Add an additional layer of security to your SpotVault account.'}</span>
        </div>

        <div className="space-y-2">
          {/* Authenticator App */}
          <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-4 w-4 text-white/90" strokeWidth={1.5} />
              <div>
                <p className="text-[12px] font-semibold text-white/90">Authenticator App</p>
                <p className="text-[10px] text-white/85">Recommended — Google Authenticator, Authy, 1Password</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasTotp ? <StatusBadge status="ok" label="Enabled" /> : <StatusBadge status="off" label="Not Enabled" />}
              {hasTotp ? (
                <button onClick={() => setRemoveModal(true)} className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-[9px] font-semibold tracking-widest text-red-400 uppercase hover:bg-red-500/10">Remove</button>
              ) : (
                <button onClick={() => setEnrollModal(true)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-semibold tracking-widest text-white/90 uppercase hover:text-white">Set Up</button>
              )}
            </div>
          </div>
        </div>

        {enrollModal && <TotpEnrollModal onClose={() => setEnrollModal(false)} onReload={onReload} email={email} />}
        {removeModal && <TotpRemoveModal factorId={totpFactors[0]?.id ?? ''} onClose={() => setRemoveModal(false)} onReload={onReload} email={email} isLastFactor />}
      </SectionCard>

    </div>
  );
}

// ── TOTP Enrollment ──

function TotpEnrollModal({ onClose, onReload, email }: { onClose: () => void; onReload: () => void; email: string | null }) {
  const [step, setStep] = useState<'qr' | 'verify'>('qr');
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await enrollTotp();
      setLoading(false);
      if (!result.ok || !result.qrUri || !result.secret || !result.factorId) {
        setError(result.error || 'Failed to start enrollment.');
        return;
      }
      setQrUri(result.qrUri);
      setSecret(result.secret);
      setFactorId(result.factorId);
    })();
  }, []);

  const handleVerify = async () => {
    setError('');
    if (code.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setLoading(true);
    const challengeResult = await createMfaChallenge(factorId);
    if (!challengeResult.ok || !challengeResult.challengeId) {
      setLoading(false);
      setError(challengeResult.error || 'Failed to create challenge.');
      return;
    }
    const verifyResult = await verifyMfaChallenge(factorId, challengeResult.challengeId, code);
    setLoading(false);
    if (!verifyResult.ok) { setError(verifyResult.error || 'Invalid code. Try again.'); return; }
    await supabase.rpc('sv_set_mfa_preference', { p_method: 'totp', p_enabled: true });
    if (email) await sendSecurityNotification('authenticator_added', email);
    await logSecurityEvent('mfa_enabled');
    onReload();
    onClose();
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal title="Set Up Authenticator App" onClose={onClose}>
      {loading && step === 'qr' ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-white/85" /></div>
      ) : error && step === 'qr' ? (
        <p className="text-center text-[10px] font-mono tracking-widest text-red-400 uppercase">{error}</p>
      ) : (
        <div className="space-y-4">
          {step === 'qr' && (
            <>
              <p className="text-[11px] leading-relaxed text-white/85">Scan this QR code with your authenticator app, or enter the manual key below.</p>
              <div className="flex justify-center">
                <div className="rounded-lg border border-white/10 bg-white p-3">
                  <img src={qrUri} alt="QR Code" className="h-40 w-40" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/90 uppercase">Manual Key</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-mono text-white/90">{secret}</code>
                  <button onClick={copySecret} className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/90 hover:text-white">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <button onClick={() => setStep('verify')} className="w-full rounded-lg border py-3 text-[10px] font-semibold tracking-widest uppercase" style={{ borderColor: GOLD + '60', background: GOLD + '15', color: GOLD_SOFT }}>
                I've Scanned — Enter Code
              </button>
            </>
          )}
          {step === 'verify' && (
            <>
              <p className="text-[11px] leading-relaxed text-white/85">Enter the 6-digit verification code from your authenticator app.</p>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="auth-input text-center text-lg tracking-[0.5em]" />
              {error && <p className="text-center text-[10px] font-mono tracking-widest text-red-400 uppercase">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep('qr')} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-3 text-[10px] font-semibold tracking-widest text-white/90 uppercase hover:text-white">Back</button>
                <button onClick={handleVerify} disabled={loading} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-3 text-[10px] font-semibold tracking-widest uppercase disabled:opacity-50" style={{ borderColor: GOLD + '60', background: GOLD + '15', color: GOLD_SOFT }}>
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Verify
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function TotpRemoveModal({ factorId, onClose, onReload, email, isLastFactor }: {
  factorId: string; onClose: () => void; onReload: () => void; email: string | null; isLastFactor: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRemove = async () => {
    setLoading(true);
    const result = await removeTotpFactor(factorId);
    setLoading(false);
    if (!result.ok) { setError(result.error || 'Failed to remove.'); return; }
    await supabase.rpc('sv_set_mfa_preference', { p_method: 'totp', p_enabled: false });
    if (email) await sendSecurityNotification('authenticator_removed', email);
    await logSecurityEvent('mfa_disabled');
    onReload();
    onClose();
  };

  return (
    <Modal title="Remove Authenticator App" onClose={onClose}>
      {confirming ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" strokeWidth={1.5} />
            <p className="text-[11px] leading-relaxed text-red-300/80">{isLastFactor ? 'This is your last 2FA method. Removing it will completely disable two-factor authentication. Anyone with your password will be able to sign in.' : 'Removing this method will disable authenticator-based 2FA. You still have other methods enabled.'}</p>
          </div>
          {error && <p className="text-[10px] font-mono tracking-widest text-red-400 uppercase">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-3 text-[10px] font-semibold tracking-widest text-white/90 uppercase hover:text-white">Cancel</button>
            <button onClick={handleRemove} disabled={loading} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 py-3 text-[10px] font-semibold tracking-widest text-red-400 uppercase disabled:opacity-50">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Confirm Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] text-white/85">Are you sure you want to remove your authenticator app? This will disable 2FA.</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-3 text-[10px] font-semibold tracking-widest text-white/90 uppercase hover:text-white">Cancel</button>
            <button onClick={() => setConfirming(true)} className="flex-1 rounded-lg border border-red-500/20 bg-red-500/5 py-3 text-[10px] font-semibold tracking-widest text-red-400 uppercase">Remove</button>
          </div>
        </div>
      )}
    </Modal>
  );
}




