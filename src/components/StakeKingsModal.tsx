import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, AlertCircle, ArrowRight, Link2, ShieldCheck } from 'lucide-react';
import {
  checkPartnerAccess, verifyWithCode, getStakeKingsAccessInfo,
  type PartnerSlug, type StakeKingsRole,
} from '@/lib/partnerStore';
import { supabase } from '@/lib/supabase';
import { STAKEKINGS_BRANDING, STAKEKINGS_OWNER_TEST_USER_ID } from '@/lib/stakekingsBranding';

const PARTNER: PartnerSlug = 'stakekings';

type ModalPhase = 'loading' | 'chooser' | 'enroll' | 'verifying' | 'rechecking';

interface StakeKingsModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: (role: StakeKingsRole) => void;
  userId: string | null;
}

export function StakeKingsModal({ open, onClose, onVerified, userId }: StakeKingsModalProps) {
  const [phase, setPhase] = useState<ModalPhase>('loading');
  const [role, setRole] = useState<StakeKingsRole>('player');
  const [code, setCode] = useState('');
  const [firstTimeChecked, setFirstTimeChecked] = useState(false);
  const [error, setError] = useState('');
  const [recheckMessage, setRecheckMessage] = useState('');

  const checkAccess = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const { data: { session } } = await supabase.auth.getSession();
    const isOwnerTestAccount = session?.user.id === STAKEKINGS_OWNER_TEST_USER_ID;
    if (isOwnerTestAccount) {
      setPhase('chooser');
      return true;
    }

    const access = await checkPartnerAccess(userId, PARTNER);
    if (access) {
      const info = await getStakeKingsAccessInfo(userId);
      setRole(info.role);
      onVerified(info.role);
      return true;
    }
    setPhase('enroll');
    return false;
  }, [userId, onVerified]);

  useEffect(() => {
    if (!open || !userId) return;
    setPhase('loading');
    setError('');
    setRecheckMessage('');
    setCode('');
    setFirstTimeChecked(false);
    checkAccess();
  }, [open, userId, checkAccess]);

  if (!open) return null;

  const handleVerify = async () => {
    if (!userId || !code.trim()) return;
    setPhase('verifying');
    setError('');
    const result = await verifyWithCode(userId, PARTNER, code.trim().toUpperCase());
    if (!result.ok) {
      setError(result.error || 'Verification failed.');
      setPhase('enroll');
      return;
    }
    onVerified('player');
  };

  const handleRecheck = async () => {
    setPhase('rechecking');
    setRecheckMessage('');
    const granted = await checkAccess();
    if (!granted) {
      setRecheckMessage('No StakeKings access found. Please complete first-time enrollment below.');
      setPhase('enroll');
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-emerald-500/25 bg-[#0a0c0e] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-16 items-center justify-center overflow-hidden rounded-md border border-emerald-500/40 bg-black/30 px-1">
              <img src={STAKEKINGS_BRANDING.logo} alt="StakeKings" className="max-h-full max-w-full object-contain" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide text-emerald-300">StakeKings</h2>
              <p className="text-[10px] text-emerald-400/60">Player Development</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {phase === 'loading' && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400/60" />
          </div>
        )}

        {/* Chooser — ONLY for owner/test accounts with testOverride */}
        {phase === 'chooser' && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">StakeKings</p>
            <p className="mt-1 text-[10px] text-white/40">Owner / Test Account</p>
            <div className="mt-5 space-y-2.5">
              <button
                onClick={() => onVerified('player')}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 py-3 text-[11px] font-bold tracking-wide text-emerald-300 uppercase hover:bg-emerald-500/20 transition"
              >
                Enter Player Portal <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onVerified('manager')}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 py-3 text-[11px] font-bold tracking-wide text-emerald-300 uppercase hover:bg-emerald-500/20 transition"
              >
                Enter Management Portal <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* First-time enrollment */}
        {(phase === 'enroll' || phase === 'verifying' || phase === 'rechecking') && (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-white/10 bg-black/30 p-4">
              <p className="text-[12px] leading-relaxed text-white/60">
                Is this your first time accessing StakeKings Player Development through SpotVault?
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={firstTimeChecked}
                  onChange={(e) => setFirstTimeChecked(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-black/40 accent-emerald-500"
                />
                <span className="text-[11px] text-white/70">
                  Yes — link my StakeKings Player Development access
                </span>
              </label>
            </div>

            {firstTimeChecked && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-[9px] font-semibold tracking-[0.2em] text-white/40 uppercase">
                    StakeKings Access Code
                  </label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="SK-XXXX-XXXX"
                    autoFocus
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-3 text-[13px] tracking-wider text-white placeholder-white/20 focus:border-emerald-500/40 focus:outline-none"
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-[11px] text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                  </div>
                )}
                <button
                  onClick={handleVerify}
                  disabled={phase === 'verifying' || !code.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 py-3 text-[11px] font-bold tracking-wide text-emerald-300 uppercase hover:bg-emerald-500/20 disabled:opacity-40 transition"
                >
                  {phase === 'verifying' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Verify Access <ArrowRight className="h-3.5 w-3.5" /></>}
                </button>
                <p className="text-center text-[9px] text-white/25">
                  Don't have a code? Contact your StakeKings partner manager.
                </p>
              </div>
            )}

            {recheckMessage && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0" /> {recheckMessage}
              </div>
            )}

            <div className="border-t border-white/5 pt-3">
              <button
                onClick={handleRecheck}
                disabled={phase === 'rechecking'}
                className="flex w-full items-center justify-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 transition disabled:opacity-40"
              >
                {phase === 'rechecking' ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Checking access...</>
                ) : (
                  <><Link2 className="h-3 w-3" /> Already linked your StakeKings account? Re-check access</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
