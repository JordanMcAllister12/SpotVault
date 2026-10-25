import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import { isStaffOrAdmin } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const GOLD_DIM = '#835e17';

type VaultPhase = 'idle' | 'aligning' | 'locked' | 'opening' | 'revealed';

const DEMO_REWARD = {
  title: 'Founder Bonus Pack',
  description: 'Exclusive credits, premium badge, and early-access features',
  icon: Trophy,
};

export function isVaultFounder(account: SpotVaultAccount | null | undefined): boolean {
  return !!account && (account.role === 'developer_admin' || account.isAuthUser === true || isStaffOrAdmin(account));
}

export function MysteryVaultPreview({ account }: { account: SpotVaultAccount | null }) {
  const isFounder = isVaultFounder(account);

  if (!isFounder) return <LockedVault />;

  return <FounderVault />;
}

function LockedVault() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-6">
        <div
          className="flex h-28 w-28 items-center justify-center rounded-full border border-[#c0911e]/15"
          style={{ background: 'radial-gradient(circle at 40% 35%, #1a1f25 0%, #0a0c0e 100%)' }}
        >
          <Lock className="h-10 w-10 text-[#c0911e]/25" strokeWidth={1.2} />
        </div>
        <div
          className="absolute inset-0 rounded-full border border-[#d4a52c]/10"
          style={{ animation: 'vault-pulse 3s ease-in-out infinite' }}
        />
      </div>
      <h3 className="text-sm font-bold tracking-wide text-white/70">Mystery Rewards Vault</h3>
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#c0911e]/20 bg-[#c0911e]/8 px-3 py-1">
        <Sparkles className="h-3 w-3 text-[#d4a52c]" strokeWidth={1.5} />
        <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#d4a52c]">Coming Soon</span>
      </div>
      <p className="mt-3 max-w-xs text-[11px] leading-relaxed text-white/35">
        The Mystery Vault is being prepared. Founders get an exclusive preview — stay tuned for the full launch.
      </p>
      <style>{`
        @keyframes vault-pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.08); opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}

function FounderVault() {
  const [phase, setPhase] = useState<VaultPhase>('idle');
  const [outerRot, setOuterRot] = useState(0);
  const [middleRot, setMiddleRot] = useState(30);
  const [innerRot, setInnerRot] = useState(-20);
  const [ringsAligned, setRingsAligned] = useState(0);
  const [boltsLocked, setBoltsLocked] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [prizeFloat, setPrizeFloat] = useState(false);
  const [vaultGone, setVaultGone] = useState(false);
  const [clickPulse, setClickPulse] = useState(0);

  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const alignedRef = useRef(0);

  const clearAll = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const after = (ms: number, fn: () => void) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  const reset = useCallback(() => {
    clearAll();
    alignedRef.current = 0;
    setPhase('idle');
    setOuterRot(0);
    setMiddleRot(30);
    setInnerRot(-20);
    setRingsAligned(0);
    setBoltsLocked(false);
    setDoorOpen(false);
    setPrizeFloat(false);
    setVaultGone(false);
    setClickPulse(0);
  }, [clearAll]);

  const runAnimation = useCallback(() => {
    clearAll();
    alignedRef.current = 0;
    setPhase('aligning');
    setOuterRot(0);
    setMiddleRot(30);
    setInnerRot(-20);
    setRingsAligned(0);
    setBoltsLocked(false);
    setDoorOpen(false);
    setPrizeFloat(false);
    setVaultGone(false);
    setClickPulse(0);

    const outerFinal = 720;
    const middleFinal = -720;
    const innerFinal = 720;
    const middleStart = 30;
    const innerStart = -20;
    const duration = 2600;
    const startTime = performance.now();
    const outerStop = 0.55;
    const middleStop = 0.75;
    const gearStop = 0.90;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);

      const oT = Math.min(t / outerStop, 1);
      setOuterRot(outerFinal * (1 - Math.pow(1 - oT, 3)));

      const mT = Math.min(t / middleStop, 1);
      setMiddleRot(middleStart + (middleFinal - middleStart) * (1 - Math.pow(1 - mT, 3)));

      const gT = Math.min(t / gearStop, 1);
      setInnerRot(innerStart + (innerFinal - innerStart) * (1 - Math.pow(1 - gT, 3)));

      if (oT >= 1 && alignedRef.current === 0) {
        alignedRef.current = 1;
        setRingsAligned(1);
        setClickPulse((p) => p + 1);
      }
      if (mT >= 1 && alignedRef.current === 1) {
        alignedRef.current = 2;
        setRingsAligned(2);
        setClickPulse((p) => p + 1);
      }
      if (gT >= 1 && alignedRef.current === 2) {
        alignedRef.current = 3;
        setRingsAligned(3);
        setClickPulse((p) => p + 1);
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setPhase('locked');
        after(400, () => { setBoltsLocked(true); setClickPulse((p) => p + 1); });
        after(1000, () => {
          setPhase('opening');
          setDoorOpen(true);
        });
        after(1800, () => setPrizeFloat(true));
        after(2200, () => {
          setVaultGone(true);
          setPhase('revealed');
        });
      }
    };
    rafRef.current = requestAnimationFrame(animate);
  }, [clearAll, after]);

  useEffect(() => () => { clearAll(); }, [clearAll]);

  const showVault = phase !== 'revealed' || !vaultGone;
  const RewardIcon = DEMO_REWARD.icon;

  return (
    <div className="flex flex-col items-center px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
        <h3 className="text-sm font-bold tracking-[0.15em] uppercase text-[#f5e6b0]">Mystery Rewards Vault</h3>
        <span className="rounded-full border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2 py-0.5 text-[8px] font-bold tracking-wide text-[#d4a52c] uppercase">Founder Preview</span>
      </div>

      {/* Vault stage */}
      <div className="relative flex h-[320px] w-full max-w-[420px] items-center justify-center overflow-hidden rounded-2xl border border-[#c0911e]/12 bg-[#050608]">
        {/* Background glow */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 45%, #0e1115 0%, #050608 70%)' }}
        />

        {/* Vault door (behind mechanism) */}
        {showVault && (
          <div
            className="absolute inset-0 transition-all duration-[1000ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
            style={{
              transform: doorOpen ? 'translateX(-100%) scale(0.9)' : 'translateX(0) scale(1)',
              opacity: doorOpen ? 0 : 1,
            }}
          >
            {/* Door body */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] border border-[#1a1f25]"
              style={{
                width: '78vmin', height: '78vmin', maxWidth: 280, maxHeight: 280,
                background: 'linear-gradient(135deg, #12161b 0%, #0a0c0e 100%)',
                boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8), 0 0 0 4px #0a0c0e, 0 0 0 5px #1a1f25',
              }}
            >
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={`bolt-${i}`} className="absolute left-1/2 top-1/2 origin-center"
                  style={{ transform: `rotate(${(i * 360) / 16}deg) translateY(-130px)` }}>
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      transform: 'translate(-50%, -50%)',
                      background: boltsLocked
                        ? `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DIM} 100%)`
                        : '#38424e',
                      boxShadow: boltsLocked ? '0 0 6px rgba(212,165,44,0.5)' : 'none',
                      transition: 'background 0.3s, box-shadow 0.3s',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mechanism rings */}
        {showVault && (
          <div
            className="absolute inset-0 flex items-center justify-center transition-all duration-[1000ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
            style={{
              transform: doorOpen ? 'translateX(-100%) scale(0.8)' : 'translateX(0) scale(1)',
              opacity: doorOpen ? 0 : 1,
            }}
          >
            <div className="relative" style={{ width: 260, height: 260, maxWidth: '70vmin', maxHeight: '70vmin' }}>
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full" style={{
                background: 'linear-gradient(135deg, #2a323b 0%, #1a1f25 40%, #12161b 70%, #1c2228 100%)',
                boxShadow: 'inset 0 0 0 3px #38424e, inset 0 0 0 5px #12161b, inset 0 0 30px rgba(0,0,0,0.7), 0 0 0 1px #0a0c0e',
              }} />
              <div className="absolute rounded-full" style={{
                inset: 20,
                background: 'radial-gradient(circle at 40% 35%, #232a32 0%, #161b21 50%, #0e1216 100%)',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)',
              }} />
              {/* Outer gear teeth */}
              <div className="absolute inset-0" style={{ transform: `rotate(${outerRot}deg)` }}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={`ot-${i}`} className="absolute left-1/2 top-1/2 origin-center"
                    style={{ transform: `rotate(${(i * 360) / 24}deg) translateY(-118px)` }}>
                    <div style={{ width: 3, height: 8, background: '#38424e', borderRadius: '1px', transform: 'translate(-50%, -50%)' }} />
                  </div>
                ))}
                {/* Alignment indicator */}
                <div className="absolute left-1/2 top-1/2 origin-center" style={{ transform: 'rotate(0deg) translateY(-120px)' }}>
                  <div style={{
                    width: 4, height: 12,
                    background: ringsAligned >= 1 ? `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DIM} 100%)` : '#0a0c0e',
                    borderRadius: '2px', transform: 'translate(-50%, -50%)',
                    boxShadow: ringsAligned >= 1 ? '0 0 6px rgba(212,165,44,0.5)' : 'inset 0 0 3px rgba(0,0,0,0.8)',
                    transition: 'background 0.3s, box-shadow 0.3s',
                  }} />
                </div>
              </div>

              {/* Middle ring */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 180, height: 180 }}>
                <div className="absolute inset-0 rounded-full" style={{
                  background: 'linear-gradient(135deg, #232a32 0%, #1a1f25 50%, #12161b 100%)',
                  boxShadow: 'inset 0 0 0 2px #2a323b, inset 0 0 15px rgba(0,0,0,0.5)',
                }} />
                <div className="absolute rounded-full" style={{
                  inset: 22,
                  background: 'radial-gradient(circle at 40% 35%, #161b21 0%, #0e1216 100%)',
                  boxShadow: 'inset 0 0 0 2px #1a1f25',
                }} />
                <div className="absolute inset-0" style={{ transform: `rotate(${middleRot}deg)` }}>
                  {Array.from({ length: 18 }).map((_, i) => (
                    <div key={`mt-${i}`} className="absolute left-1/2 top-1/2 origin-center"
                      style={{ transform: `rotate(${(i * 360) / 18}deg) translateY(-88px)` }}>
                      <div style={{ width: 3, height: 7, background: '#2a323b', borderRadius: '1px', transform: 'translate(-50%, -50%)' }} />
                    </div>
                  ))}
                  {[0, 90, 180, 270].map((angle) => (
                    <div key={`mn-${angle}`} className="absolute left-1/2 top-1/2 origin-center"
                      style={{ transform: `rotate(${angle}deg) translateY(-90px)` }}>
                      <div style={{
                        width: 5, height: 24,
                        background: ringsAligned >= 2 ? `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DIM} 100%)` : '#0a0c0e',
                        borderRadius: '2px', transform: 'translate(-50%, -50%)',
                        boxShadow: ringsAligned >= 2 ? '0 0 6px rgba(212,165,44,0.4)' : 'inset 0 0 3px rgba(0,0,0,0.8)',
                        transition: 'background 0.3s, box-shadow 0.3s',
                      }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Inner gear */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 110, height: 110 }}>
                <div className="absolute inset-0 rounded-full" style={{
                  background: 'linear-gradient(135deg, #2a323b 0%, #1a1f25 50%, #12161b 100%)',
                  boxShadow: 'inset 0 0 0 2px #38424e, inset 0 0 10px rgba(0,0,0,0.5)',
                }} />
                <div className="absolute rounded-full" style={{
                  inset: 16,
                  background: 'radial-gradient(circle at 40% 35%, #1c2228 0%, #0e1216 100%)',
                }} />
                <div className="absolute inset-0" style={{ transform: `rotate(${innerRot}deg)` }}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={`gt-${i}`} className="absolute left-1/2 top-1/2 origin-center"
                      style={{ transform: `rotate(${(i * 360) / 12}deg) translateY(-54px)` }}>
                      <div style={{ width: 4, height: 9, background: '#38424e', borderRadius: '1px', transform: 'translate(-50%, -50%)' }} />
                    </div>
                  ))}
                  <div className="absolute left-1/2 top-1/2 origin-center" style={{ transform: 'rotate(0deg) translateY(-56px)' }}>
                    <div style={{
                      width: 6, height: 20,
                      background: ringsAligned >= 3 ? `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DIM} 100%)` : '#0a0c0e',
                      borderRadius: '2px', transform: 'translate(-50%, -50%)',
                      boxShadow: ringsAligned >= 3 ? '0 0 6px rgba(212,165,44,0.4)' : 'inset 0 0 3px rgba(0,0,0,0.8)',
                      transition: 'background 0.3s, box-shadow 0.3s',
                    }} />
                  </div>
                </div>
              </div>

              {/* Center plate */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 50, height: 50 }}>
                <div className="absolute inset-0 rounded-full" style={{
                  background: boltsLocked
                    ? `radial-gradient(circle, ${GOLD} 0%, ${GOLD_DIM} 70%, #4a330c 100%)`
                    : 'radial-gradient(circle, #2a323b 0%, #1a1f25 100%)',
                  boxShadow: boltsLocked
                    ? `0 0 14px rgba(212,165,44,0.5), inset 0 1px 0 rgba(255,255,255,0.2)`
                    : 'inset 0 1px 0 rgba(255,255,255,0.08)',
                  transition: 'background 0.4s, box-shadow 0.4s',
                }} />
              </div>

              {/* Locking bolts */}
              {[0, 90, 180, 270].map((angle) => (
                <div key={`lb-${angle}`} className="absolute left-1/2 top-1/2 origin-center"
                  style={{ transform: `rotate(${angle}deg) translateY(-32px)` }}>
                  <div className="absolute rounded-full" style={{
                    width: 6, height: 14,
                    background: boltsLocked
                      ? `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DIM} 100%)`
                      : 'linear-gradient(180deg, #38424e 0%, #1a1f25 100%)',
                    boxShadow: boltsLocked ? '0 0 6px rgba(212,165,44,0.5)' : 'inset 0 1px 0 rgba(255,255,255,0.1)',
                    transform: `translate(-50%, -50%) translateY(${boltsLocked ? 5 : 0}px)`,
                    transition: 'background 0.3s, box-shadow 0.3s, transform 0.3s',
                  }} />
                </div>
              ))}

              {/* Gold access path when locked */}
              {boltsLocked && (
                <div className="absolute left-1/2 top-0 -translate-x-1/2" style={{
                  width: 2, height: '50%',
                  background: `linear-gradient(180deg, transparent 0%, ${GOLD} 20%, ${GOLD} 80%, transparent 100%)`,
                  boxShadow: '0 0 8px rgba(212,165,44,0.5)',
                  animation: 'fade-in 0.4s ease forwards',
                }} />
              )}

              {/* Fixed gold marker */}
              <div className="absolute left-1/2 z-30 -translate-x-1/2" style={{ top: -8 }}>
                <div style={{
                  width: 0, height: 0,
                  borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
                  borderTop: '10px solid #d4a52c',
                  filter: 'drop-shadow(0 0 4px rgba(212,165,44,0.5))',
                }} />
              </div>

              {/* Click pulse */}
              {clickPulse > 0 && (
                <div key={`click-${clickPulse}`} className="absolute left-1/2 z-25 -translate-x-1/2" style={{ top: 2 }}>
                  <div className="rounded-full border border-[#d4a52c]" style={{
                    width: 14, height: 14,
                    animation: 'gold-pulse-ring 0.35s ease-out forwards',
                  }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prize reveal */}
        {prizeFloat && (
          <div
            className="absolute z-40 flex flex-col items-center"
            style={{
              animation: 'prize-float 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}
          >
            <div
              className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DIM} 100%)`,
                boxShadow: `0 0 30px rgba(212,165,44,0.6), 0 8px 24px -8px rgba(212,165,44,0.4)`,
              }}
            >
              <RewardIcon className="h-8 w-8 text-white" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <div className="text-sm font-bold tracking-wide text-[#f5e6b0]">{DEMO_REWARD.title}</div>
              <div className="mt-1 max-w-[200px] text-[10px] leading-relaxed text-white/50">{DEMO_REWARD.description}</div>
            </div>
            <div
              className="mt-3 rounded-full border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-1 text-[8px] font-bold tracking-[0.2em] uppercase text-[#d4a52c]"
            >
              Demo Reward
            </div>
          </div>
        )}

        {/* Status text */}
        {phase === 'aligning' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
            <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#5f6e7c]" style={{ animation: 'fade-in 0.3s ease' }}>
              Aligning Mechanism...
            </div>
          </div>
        )}
        {phase === 'locked' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
            <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#d4a52c]" style={{ animation: 'fade-in 0.3s ease' }}>
              Vault Secured
            </div>
          </div>
        )}
        {phase === 'opening' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
            <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#d4a52c]" style={{ animation: 'fade-in 0.3s ease' }}>
              Opening Vault...
            </div>
          </div>
        )}

        {/* Top label */}
        {showVault && (
          <div className="absolute left-1/2 top-3 -translate-x-1/2">
            <div className="text-[8px] font-mono tracking-[0.3em] uppercase text-[#5f6e7c]">SV-VAULT-02</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-5 flex items-center gap-3">
        {phase === 'idle' && (
          <button
            onClick={runAnimation}
            className="flex items-center gap-2 rounded-xl border border-[#d4a52c]/40 bg-[#d4a52c]/12 px-5 py-2.5 text-[11px] font-bold tracking-[0.15em] uppercase text-[#f5e6b0] transition-all hover:border-[#d4a52c]/60 hover:bg-[#d4a52c]/18"
          >
            <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
            Open Mystery Vault
          </button>
        )}
        {phase === 'revealed' && (
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-[11px] font-bold tracking-[0.15em] uppercase text-white/60 transition-all hover:border-white/25 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
            Replay
          </button>
        )}
        {(phase === 'aligning' || phase === 'locked' || phase === 'opening') && (
          <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30">Unlocking...</div>
        )}
      </div>

      <style>{`
        @keyframes prize-float {
          0% { transform: translateY(40px) scale(0.6); opacity: 0; }
          60% { transform: translateY(-10px) scale(1.05); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes gold-pulse-ring {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
