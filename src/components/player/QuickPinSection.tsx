import { useState, useEffect, useCallback } from 'react';
import { Lock, Check, Loader2, X, Smartphone, Info } from 'lucide-react';
import { setQuickPin, removeQuickPin, hasQuickPin, isQuickPinLocked } from '@/lib/mfaAuth';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';
const DARK_PANEL = 'rgba(8,7,6,0.88)';

export function QuickPinSection() {
  const [pinExists, setPinExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showChange, setShowChange] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [locked, setLocked] = useState(false);

  const checkPin = useCallback(async () => {
    setLoading(true);
    const [exists, isLocked] = await Promise.all([hasQuickPin(), isQuickPinLocked()]);
    setPinExists(exists);
    setLocked(isLocked);
    setLoading(false);
  }, []);

  useEffect(() => { checkPin(); }, [checkPin]);

  const handleSetup = async () => {
    setError('');
    if (!/^[0-9]{4,12}$/.test(pin)) {
      setError('PIN must be 4–12 digits, numbers only.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    setSubmitting(true);
    const result = await setQuickPin(pin);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Could not save PIN.');
      return;
    }
    setPin('');
    setConfirmPin('');
    setShowSetup(false);
    setShowChange(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
    await checkPin();
  };

  const handleRemove = async () => {
    setSubmitting(true);
    const result = await removeQuickPin();
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Could not remove PIN.');
      return;
    }
    setShowRemove(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
    await checkPin();
  };

  if (loading) {
    return (
      <div className="rounded-xl border p-5" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-white/85" />
          <span className="text-[11px] text-white/80">Checking Quick Login status…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: BORDER, background: DARK_PANEL }}>
      <div className="mb-3 flex items-center gap-2">
        <Smartphone className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
        <h3 className="text-[11px] font-bold tracking-widest text-white/85 uppercase">Quick Login</h3>
      </div>

      {locked && (
        <div className="mb-3 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2">
          <p className="text-[10px] text-red-300">
            Quick PIN is temporarily locked due to repeated failed attempts. Use your password + 2FA to sign in.
          </p>
        </div>
      )}

      {/* Main row: label + status + description + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {/* Status badge */}
          <div className="flex shrink-0 items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase ${
              pinExists
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/5 text-white/80'
            }`}>
              {pinExists ? 'Enabled' : 'Not Enabled'}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-white/85">Quick Login PIN</span>
              <div className="relative">
                <button
                  onClick={() => setShowTooltip((v) => !v)}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="text-white/85 hover:text-white/85 transition-colors"
                  aria-label="More info about Quick Login PIN"
                >
                  <Info className="h-3 w-3" />
                </button>
                {showTooltip && (
                  <div className="absolute left-1/2 top-full z-10 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-white/10 bg-[#0a0c0e] p-3 shadow-xl">
                    <p className="text-[10px] leading-relaxed text-white/85">
                      Set a short numeric PIN (4–12 digits) for faster sign-in on this trusted device.
                      The PIN is optional, device-bound, and does not replace your password or 2FA.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-white/85">Faster sign-in on this trusted device.</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-2">
          {pinExists ? (
            <>
              <button
                onClick={() => { setShowChange(true); setError(''); }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/85 uppercase hover:text-white hover:bg-white/10 transition-colors"
              >
                Change
              </button>
              <button
                onClick={() => setShowRemove(true)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/85 uppercase hover:text-white hover:bg-white/10 transition-colors"
              >
                Remove
              </button>
            </>
          ) : (
            <button
              onClick={() => { setShowSetup(true); setError(''); }}
              className="rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-colors"
              style={{ borderColor: GOLD + '60', background: GOLD + '15', color: GOLD_SOFT }}
            >
              Set Up
            </button>
          )}
        </div>
      </div>

      {savedFlash && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-400">
          <Check className="h-3 w-3" /> Saved
        </div>
      )}

      {/* Setup modal */}
      {(showSetup || showChange) && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#2a323b] bg-[#0a0c0e] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold tracking-[0.2em] text-white uppercase">
                  {showChange ? 'Change Quick PIN' : 'Set Up Quick PIN'}
                </h2>
                <p className="mt-2 text-xs leading-5 text-[#84929f]">
                  Choose a numeric PIN (4–12 digits). You'll use this on trusted devices instead of your password.
                </p>
              </div>
              <button type="button" onClick={() => { setShowSetup(false); setShowChange(false); setPin(''); setConfirmPin(''); setError(''); }}
                className="text-[#5f6e7c] hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-[9px] font-semibold tracking-[0.2em] text-[#84929f] uppercase">
                  {showChange ? 'New PIN' : 'Create PIN'}
                </label>
                <div className="recessed-field flex items-center gap-2 rounded-lg px-4 py-3">
                  <Lock className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                    placeholder="4–12 digits"
                    className="w-full bg-transparent text-sm tracking-widest text-white outline-none placeholder:text-[#5f6e7c]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-semibold tracking-[0.2em] text-[#84929f] uppercase">Confirm PIN</label>
                <div className="recessed-field flex items-center gap-2 rounded-lg px-4 py-3">
                  <Lock className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={1.5} />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                    placeholder="Re-enter PIN"
                    className="w-full bg-transparent text-sm tracking-widest text-white outline-none placeholder:text-[#5f6e7c]"
                  />
                </div>
              </div>
              {error && <p className="text-center text-[10px] font-mono tracking-widest text-red-400 uppercase">{error}</p>}
              <button type="button" disabled={submitting || !pin || !confirmPin}
                onClick={handleSetup}
                className="w-full rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/10 py-3 text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase disabled:opacity-50">
                {submitting ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : showChange ? 'Update PIN' : 'Save PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirmation */}
      {showRemove && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#2a323b] bg-[#0a0c0e] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h2 className="text-sm font-bold tracking-[0.2em] text-white uppercase">Remove Quick PIN?</h2>
              <button type="button" onClick={() => setShowRemove(false)} className="text-[#5f6e7c] hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#84929f]">
              You'll need to use your full password + 2FA to sign in on all devices. You can set up a new PIN anytime.
            </p>
            <div className="mt-5 flex gap-2">
              <button type="button" disabled={submitting} onClick={handleRemove}
                className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-red-300 uppercase disabled:opacity-50">
                {submitting ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Remove PIN'}
              </button>
              <button type="button" onClick={() => setShowRemove(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-white/85 uppercase">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
