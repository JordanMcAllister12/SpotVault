import { useEffect, useRef, useState } from 'react';
import { TUMBLER_HUBS, type HubId, type TumblerPhase } from '@/types';

interface Props {
  phase: TumblerPhase;
  target: HubId;
  denied?: boolean;
  onVaultOpen: () => void;
  onVaultDone: () => void;
  onReturnHome?: () => void;
  onRequestAccess?: () => void;
}

type MechPhase = 'verifying' | 'aligning' | 'locked' | 'opening' | 'denied';

const HUB_ORDER: HubId[] = TUMBLER_HUBS;
const SLICE = 360 / HUB_ORDER.length;

export function VaultTumbler({ phase, target, denied, onVaultOpen, onVaultDone, onReturnHome, onRequestAccess }: Props & { onComplete: () => void }) {
  const [mech, setMech] = useState<MechPhase>('verifying');
  const [statusMsg, setStatusMsg] = useState('AUTHENTICATING CREDENTIALS...');
  const [statusChecks, setStatusChecks] = useState<string[]>([]);

  const [outerRot, setOuterRot] = useState(0);
  const [middleRot, setMiddleRot] = useState(30);
  const [innerRot, setInnerRot] = useState(-20);

  const [ring1Aligned, setRing1Aligned] = useState(false);
  const [ring2Aligned, setRing2Aligned] = useState(false);
  const [gearAligned, setGearAligned] = useState(false);

  const [playerLit, setPlayerLit] = useState(false);
  const [boltsLocked, setBoltsLocked] = useState(false);
  const [recoil, setRecoil] = useState(false);
  const [clickPulse, setClickPulse] = useState(0);

  const [doorOpen, setDoorOpen] = useState(false);
  const [vaultGone, setVaultGone] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef<number | null>(null);
  const done = useRef(false);
  const r1 = useRef(false);
  const r2 = useRef(false);
  const rg = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };
  const after = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(() => {
    if (phase !== 'active') return;
    done.current = false;
    r1.current = false;
    r2.current = false;
    rg.current = false;
    clearTimers();
    setMech('verifying');
    setStatusMsg('AUTHENTICATING CREDENTIALS...');
    setStatusChecks([]);
    setOuterRot(0);
    setMiddleRot(30);
    setInnerRot(-20);
    setRing1Aligned(false);
    setRing2Aligned(false);
    setGearAligned(false);
    setPlayerLit(false);
    setBoltsLocked(false);
    setRecoil(false);
    setClickPulse(0);
    setDoorOpen(false);
    setVaultGone(false);

    const targetLabel = target === 'INVESTOR' ? 'INVESTOR PORTAL' : 'PLAYER HUB';

    after(700, () => {
      setStatusMsg('IDENTITY VERIFIED');
      setStatusChecks(['IDENTITY VERIFIED']);
    });
    after(1100, () => setStatusMsg('VERIFYING PORTAL ACCESS...'));
    after(1500, () => {
      if (denied) {
        setStatusMsg('ALIGNING ACCESS MECHANISM...');
        setMech('aligning');
        runDeniedAlignment();
      } else {
        setStatusMsg('ALIGNING ACCESS MECHANISM...');
        setMech('aligning');
        runAlignment();
      }
    });

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, target, denied]);

  const runAlignment = () => {
    const targetIndex = HUB_ORDER.indexOf(target);
    const outerFinal = 720 - targetIndex * SLICE; // clockwise, target at top
    const middleFinal = -720; // counter-clockwise, notch at 0°
    const innerFinal = 720; // clockwise, notch at 0°
    const middleStart = 30;
    const innerStart = -20;

    const duration = 3000;
    const startTime = performance.now();
    const outerStop = 0.55;
    const middleStop = 0.75;
    const gearStop = 0.90;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);

      const oT = Math.min(t / outerStop, 1);
      const oE = 1 - Math.pow(1 - oT, 3);
      setOuterRot(outerFinal * oE);

      const mT = Math.min(t / middleStop, 1);
      const mE = 1 - Math.pow(1 - mT, 3);
      setMiddleRot(middleStart + (middleFinal - middleStart) * mE);

      const gT = Math.min(t / gearStop, 1);
      const gE = 1 - Math.pow(1 - gT, 3);
      setInnerRot(innerStart + (innerFinal - innerStart) * gE);

      if (oT >= 1 && !r1.current) {
        r1.current = true;
        setRing1Aligned(true);
        setClickPulse((p) => p + 1);
      }
      if (mT >= 1 && !r2.current) {
        r2.current = true;
        setRing2Aligned(true);
        setClickPulse((p) => p + 1);
      }
      if (gT >= 1 && !rg.current) {
        rg.current = true;
        setGearAligned(true);
        setClickPulse((p) => p + 1);
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // All aligned — snap/recoil + lock
        setMech('locked');
        setRecoil(true);
        after(200, () => setRecoil(false));

        const targetLabel = target === 'INVESTOR' ? 'INVESTOR PORTAL' : 'PLAYER HUB';

        after(300, () => {
          setPlayerLit(true);
          setStatusMsg(`${targetLabel} IDENTIFIED`);
          setStatusChecks((c) => [...c, `${targetLabel} IDENTIFIED`]);
        });
        after(600, () => {
          setStatusMsg('ACCESS PATH ALIGNED');
          setStatusChecks((c) => [...c, 'ACCESS PATH ALIGNED']);
        });
        after(900, () => {
          setBoltsLocked(true);
          setClickPulse((p) => p + 1);
          setStatusMsg('');
        });
        after(1100, () => setStatusMsg('ACCESS GRANTED'));
        after(1600, () => {
          setMech('opening');
          setDoorOpen(true);
          setStatusMsg('');
          if (!done.current) {
            done.current = true;
            onVaultOpen();
          }
        });
        after(2800, () => {
          setVaultGone(true);
          onVaultDone();
        });
      }
    };
    rafRef.current = requestAnimationFrame(animate);
  };

  const runDeniedAlignment = () => {
    const targetIndex = HUB_ORDER.indexOf(target);
    const outerFinal = 720 - targetIndex * SLICE;
    const middleFinal = -720;
    const innerFinal = 720;
    const middleStart = 30;
    const innerStart = -20;

    const duration = 2200;
    const startTime = performance.now();
    const outerStop = 0.45;
    const middleStop = 0.60;
    const gearStop = 0.75;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Animate partially then JAM — mechanisms fail to align
      const oT = Math.min(t / outerStop, 1);
      const oE = 1 - Math.pow(1 - oT, 3);
      setOuterRot(outerFinal * oE * 0.85); // stops short

      const mT = Math.min(t / middleStop, 1);
      const mE = 1 - Math.pow(1 - mT, 3);
      setMiddleRot(middleStart + (middleFinal - middleStart) * mE * 0.7); // stops short

      const gT = Math.min(t / gearStop, 1);
      const gE = 1 - Math.pow(1 - gT, 3);
      setInnerRot(innerStart + (innerFinal - innerStart) * gE * 0.5); // stops short

      if (oT >= 1 && !r1.current) {
        r1.current = true;
        setClickPulse((p) => p + 1);
      }
      if (mT >= 1 && !r2.current) {
        r2.current = true;
        setClickPulse((p) => p + 1);
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Mechanisms JAM — denial sequence
        setRecoil(true);
        after(200, () => setRecoil(false));

        after(400, () => {
          setMech('denied');
          setStatusMsg('ACCESS MECHANISM MISALIGNED');
        });
        after(900, () => {
          setStatusMsg('');
          setStatusChecks((c) => [...c, 'PORTAL ACCESS NOT FOUND']);
        });
        after(1400, () => {
          if (!done.current) {
            done.current = true;
            onVaultOpen(); // signals App to show denied screen
          }
        });
      }
    };
    rafRef.current = requestAnimationFrame(animate);
  };

  if (phase === 'idle' || vaultGone) return null;

  const targetIndex = HUB_ORDER.indexOf(target);
  const targetLabel = target === 'INVESTOR' ? 'INVESTOR PORTAL' : target === 'PLAYER' ? 'PLAYER PORTAL' : target === 'MEDIA' ? 'MEDIA PORTAL' : `${target} PORTAL`;

  return (
    <div className="absolute inset-0 z-50 overflow-hidden bg-[#050608]">
      {/* ===== VAULT DOOR (behind mechanism) ===== */}
      <div
        className="absolute inset-0 transition-all duration-[1200ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
        style={{
          transform: doorOpen ? 'translateX(-100%) scale(0.92)' : 'translateX(0) scale(1)',
          opacity: doorOpen ? 0 : 1,
        }}
      >
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, #0e1115 0%, #050608 70%)' }} />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-[#1a1f25]"
          style={{
            width: '90vmin', height: '90vmin', maxWidth: 900, maxHeight: 900,
            background: 'linear-gradient(135deg, #12161b 0%, #0a0c0e 100%)',
            boxShadow: 'inset 0 0 80px rgba(0,0,0,0.8), 0 0 0 6px #0a0c0e, 0 0 0 7px #1a1f25',
          }}
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={`bolt-${i}`} className="absolute left-1/2 top-1/2 origin-center"
              style={{ transform: `rotate(${(i * 360) / 24}deg) translateY(-44vmin)` }}>
              <div className="bolt h-3 w-3 rounded-full" style={{ transform: 'translate(-50%, -50%)' }} />
            </div>
          ))}
        </div>
      </div>

      {/* ===== MECHANISM ===== */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-[1200ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
        style={{
          perspective: '1400px',
          perspectiveOrigin: '50% 45%',
          transform: doorOpen ? 'translateX(-100%) scale(0.85)' : 'translateX(0) scale(1)',
          opacity: doorOpen ? 0 : 1,
        }}
      >
        <div
          className="relative"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(8deg) scale(${recoil ? 1.008 : 1})`,
            transition: recoil ? 'transform 0.1s ease-out' : 'transform 0.2s ease-out',
          }}
        >
          <div className="relative" style={{ width: 680, height: 680, maxWidth: '75vmin', maxHeight: '75vmin' }}>

            {/* ===== OUTER RING (hub labels) ===== */}
            <div className="absolute inset-0">
              {/* Rim */}
              <div className="absolute inset-0 rounded-full" style={{
                background: 'linear-gradient(135deg, #2a323b 0%, #1a1f25 40%, #12161b 70%, #1c2228 100%)',
                boxShadow: 'inset 0 0 0 3px #38424e, inset 0 0 0 6px #12161b, inset 0 0 40px rgba(0,0,0,0.7), 0 20px 60px -10px rgba(0,0,0,0.9), 0 0 0 2px #0a0c0e',
              }} />
              {/* Inner face */}
              <div className="absolute rounded-full" style={{
                inset: 28,
                background: 'radial-gradient(circle at 40% 35%, #232a32 0%, #161b21 50%, #0e1216 100%)',
                boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)',
              }} />

              {/* Rotating content */}
              <div className="absolute inset-0" style={{
                transform: `rotate(${outerRot}deg)`,
                transition: mech === 'locked' ? 'transform 0.12s cubic-bezier(0.2,0.8,0.2,1)' : 'none',
              }}>
                {/* Gear teeth on inner edge */}
                {Array.from({ length: 32 }).map((_, i) => (
                  <div key={`ot-${i}`} className="absolute left-1/2 top-1/2 origin-center"
                    style={{ transform: `rotate(${(i * 360) / 32}deg) translateY(-305px)` }}>
                    <div style={{ width: 4, height: 10, background: '#38424e', borderRadius: '1px', transform: 'translate(-50%, -50%)' }} />
                  </div>
                ))}

                {/* Hub labels + tick marks */}
                {HUB_ORDER.map((hub, i) => {
                  const angle = i * SLICE;
                  const rad = (angle * Math.PI) / 180;
                  const isTarget = hub === target;
                  const isLit = isTarget && playerLit;
                  return (
                    <div key={hub}>
                      {/* Tick mark */}
                      <div className="absolute left-1/2 top-1/2 origin-center"
                        style={{ transform: `rotate(${angle}deg) translateY(-330px)` }}>
                        <div className="absolute rounded-sm" style={{
                          width: 3, height: 16,
                          background: isLit ? '#d4a52c' : '#38424e',
                          boxShadow: isLit ? '0 0 8px rgba(212,165,44,0.6)' : 'none',
                          transform: 'translate(-50%, -50%)',
                        }} />
                      </div>
                      {/* Indicator light */}
                      <div className="absolute left-1/2 top-1/2 origin-center"
                        style={{ transform: `rotate(${angle}deg) translateY(-315px)` }}>
                        <div className="absolute rounded-full" style={{
                          width: 5, height: 5,
                          background: isLit ? '#d4a52c' : ring1Aligned ? '#2a323b' : '#1a1f25',
                          boxShadow: isLit ? '0 0 6px rgba(212,165,44,0.5)' : 'none',
                          transform: 'translate(-50%, -50%)',
                        }} />
                      </div>
                      {/* Label */}
                      <div className="absolute" style={{
                        left: '50%', top: '50%',
                        transform: `translate(-50%, -50%) translate(${Math.cos(rad) * 285}px, ${Math.sin(rad) * 285}px) rotate(${angle + 90}deg)`,
                      }}>
                        <div className="whitespace-nowrap text-[11px] font-bold tracking-[0.2em] transition-all duration-500" style={{
                          color: isLit ? '#f5e6b0' : '#5f6e7c',
                          textShadow: isLit ? '0 0 12px rgba(212,165,44,0.5), 0 0 4px rgba(212,165,44,0.3)' : '0 1px 0 rgba(0,0,0,0.7)',
                        }}>
                          {hub}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ===== MIDDLE MECHANICAL RING ===== */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 480, height: 480 }}>
              {/* Ring body */}
              <div className="absolute inset-0 rounded-full" style={{
                background: 'linear-gradient(135deg, #232a32 0%, #1a1f25 50%, #12161b 100%)',
                boxShadow: 'inset 0 0 0 2px #2a323b, inset 0 0 20px rgba(0,0,0,0.5)',
              }} />
              {/* Inner cutout */}
              <div className="absolute rounded-full" style={{
                inset: 30,
                background: 'radial-gradient(circle at 40% 35%, #161b21 0%, #0e1216 100%)',
                boxShadow: 'inset 0 0 0 2px #1a1f25, inset 0 0 15px rgba(0,0,0,0.6)',
              }} />

              {/* Rotating content */}
              <div className="absolute inset-0" style={{ transform: `rotate(${middleRot}deg)` }}>
                {/* Outer gear teeth */}
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={`mt-${i}`} className="absolute left-1/2 top-1/2 origin-center"
                    style={{ transform: `rotate(${(i * 360) / 24}deg) translateY(-238px)` }}>
                    <div style={{ width: 4, height: 9, background: '#2a323b', borderRadius: '1px', transform: 'translate(-50%, -50%)' }} />
                  </div>
                ))}
                {/* Machined grooves */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`mg-${i}`} className="absolute left-1/2 top-1/2 origin-center"
                    style={{ transform: `rotate(${(i * 360) / 8}deg) translateY(-215px)` }}>
                    <div style={{ width: 2, height: 18, background: '#1a1f25', borderRadius: '1px', transform: 'translate(-50%, -50%)' }} />
                  </div>
                ))}
                {/* Alignment notches (4 channels) */}
                {[0, 90, 180, 270].map((angle) => (
                  <div key={`mn-${angle}`} className="absolute left-1/2 top-1/2 origin-center"
                    style={{ transform: `rotate(${angle}deg) translateY(-240px)` }}>
                    <div style={{
                      width: 6, height: 32,
                      background: ring2Aligned ? 'linear-gradient(180deg, #d4a52c 0%, #835e17 100%)' : '#0a0c0e',
                      borderRadius: '2px',
                      transform: 'translate(-50%, -50%)',
                      boxShadow: ring2Aligned ? '0 0 8px rgba(212,165,44,0.4)' : 'inset 0 0 4px rgba(0,0,0,0.8)',
                    }} />
                  </div>
                ))}
                {/* Indicator light */}
                <div className="absolute left-1/2 top-1/2 origin-center" style={{ transform: `rotate(0deg) translateY(-200px)` }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: ring2Aligned ? '#d4a52c' : '#1a1f25',
                    boxShadow: ring2Aligned ? '0 0 6px rgba(212,165,44,0.5)' : 'none',
                    transform: 'translate(-50%, -50%)',
                  }} />
                </div>
              </div>
            </div>

            {/* ===== INNER LOCKING GEAR ===== */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 300, height: 300 }}>
              {/* Gear body */}
              <div className="absolute inset-0 rounded-full" style={{
                background: 'linear-gradient(135deg, #2a323b 0%, #1a1f25 50%, #12161b 100%)',
                boxShadow: 'inset 0 0 0 2px #38424e, inset 0 0 15px rgba(0,0,0,0.5)',
              }} />
              {/* Inner cutout */}
              <div className="absolute rounded-full" style={{
                inset: 24,
                background: 'radial-gradient(circle at 40% 35%, #1c2228 0%, #0e1216 100%)',
                boxShadow: 'inset 0 0 0 2px #1a1f25',
              }} />

              {/* Rotating content */}
              <div className="absolute inset-0" style={{ transform: `rotate(${innerRot}deg)` }}>
                {/* Gear teeth */}
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={`gt-${i}`} className="absolute left-1/2 top-1/2 origin-center"
                    style={{ transform: `rotate(${(i * 360) / 16}deg) translateY(-148px)` }}>
                    <div style={{ width: 5, height: 12, background: '#38424e', borderRadius: '1px', transform: 'translate(-50%, -50%)' }} />
                  </div>
                ))}
                {/* Alignment notch */}
                <div className="absolute left-1/2 top-1/2 origin-center" style={{ transform: `rotate(0deg) translateY(-150px)` }}>
                  <div style={{
                    width: 8, height: 28,
                    background: gearAligned ? 'linear-gradient(180deg, #d4a52c 0%, #835e17 100%)' : '#0a0c0e',
                    borderRadius: '2px',
                    transform: 'translate(-50%, -50%)',
                    boxShadow: gearAligned ? '0 0 8px rgba(212,165,44,0.4)' : 'inset 0 0 4px rgba(0,0,0,0.8)',
                  }} />
                </div>
                {/* Machined details */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`gd-${i}`} className="absolute left-1/2 top-1/2 origin-center"
                    style={{ transform: `rotate(${(i * 360) / 6}deg) translateY(-120px)` }}>
                    <div style={{ width: 3, height: 10, background: '#232a32', borderRadius: '1px', transform: 'translate(-50%, -50%)' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* ===== CENTER PLATE ===== */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 130, height: 130 }}>
              <div className="absolute inset-0 rounded-full" style={{
                background: 'radial-gradient(circle at 35% 30%, #2a323b 0%, #1a1f25 60%, #12161b 100%)',
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.08), inset 0 -2px 0 rgba(0,0,0,0.5), inset 0 0 12px rgba(0,0,0,0.5)',
              }} />
              <div className="absolute inset-3 rounded-full border border-[#38424e]/40" />
              <div className="absolute inset-6 rounded-full border border-[#2a323b]/40" />
              {/* Center indicator */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-500" style={{
                width: 36, height: 36,
                background: playerLit ? 'radial-gradient(circle, #d4a52c 0%, #835e17 70%, #4a330c 100%)' : 'radial-gradient(circle, #2a323b 0%, #1a1f25 100%)',
                boxShadow: playerLit ? '0 0 16px rgba(212,165,44,0.5), inset 0 1px 0 rgba(255,255,255,0.2)' : 'inset 0 1px 0 rgba(255,255,255,0.08)',
              }} />
              {/* Bolts around center */}
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`cb-${i}`} className="absolute left-1/2 top-1/2 origin-center"
                  style={{ transform: `rotate(${(i * 360) / 6}deg) translateY(-55px)` }}>
                  <div className="bolt rounded-full" style={{ width: 5, height: 5, transform: 'translate(-50%, -50%)' }} />
                </div>
              ))}
            </div>

            {/* ===== LOCKING BOLTS (4 between center and inner gear) ===== */}
            {[0, 90, 180, 270].map((angle) => (
              <div key={`lb-${angle}`} className="absolute left-1/2 top-1/2 origin-center z-20"
                style={{ transform: `rotate(${angle}deg) translateY(-85px)` }}>
                <div className="absolute rounded-full transition-all duration-300" style={{
                  width: 8, height: 18,
                  background: boltsLocked
                    ? 'linear-gradient(180deg, #d4a52c 0%, #835e17 100%)'
                    : 'linear-gradient(180deg, #38424e 0%, #1a1f25 100%)',
                  boxShadow: boltsLocked ? '0 0 8px rgba(212,165,44,0.5)' : 'inset 0 1px 0 rgba(255,255,255,0.1)',
                  transform: `translate(-50%, -50%) translateY(${boltsLocked ? 10 : 0}px)`,
                }} />
              </div>
            ))}

            {/* ===== GOLD ACCESS PATH (when locked) ===== */}
            {playerLit && (
              <div className="absolute left-1/2 top-0 z-15 -translate-x-1/2" style={{
                width: 3, height: '50%',
                background: 'linear-gradient(180deg, transparent 0%, #d4a52c 20%, #d4a52c 80%, transparent 100%)',
                boxShadow: '0 0 12px rgba(212,165,44,0.5)',
                animation: 'fade-in 0.4s ease forwards',
              }} />
            )}

            {/* Gold ring around center when locked */}
            {playerLit && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#d4a52c]/40 gold-glow z-15" style={{
                width: 150, height: 150,
                animation: 'fade-in 0.5s ease forwards',
              }} />
            )}
          </div>

          {/* ===== FIXED GOLD ACCESS MARKER (12 o'clock) ===== */}
          <div className="absolute left-1/2 z-30 flex flex-col items-center" style={{ top: -22, transform: 'translateX(-50%)' }}>
            <div style={{
              width: 0, height: 0,
              borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
              borderTop: '14px solid #d4a52c',
              filter: 'drop-shadow(0 0 6px rgba(212,165,44,0.5))',
            }} />
            <div className="text-[9px] font-bold tracking-[0.25em] text-[#d4a52c] uppercase">Access</div>
          </div>

          {/* Click pulse at marker */}
          {clickPulse > 0 && (
            <div key={`click-${clickPulse}`} className="absolute left-1/2 z-25 -translate-x-1/2" style={{ top: 5 }}>
              <div className="rounded-full border border-[#d4a52c]" style={{
                width: 20, height: 20,
                animation: 'gold-pulse-ring 0.35s ease-out forwards',
              }} />
            </div>
          )}
        </div>
      </div>

      {/* ===== STATUS TEXT ===== */}
      <div className="absolute bottom-[14vh] left-1/2 z-40 -translate-x-1/2 text-center">
        {/* Checkmark list */}
        {statusChecks.length > 0 && (
          <div className="mb-3 flex flex-col items-center gap-1">
            {statusChecks.map((c) => (
              <div key={c} className="animate-fade-in flex items-center gap-2 text-[11px] font-mono tracking-[0.25em] uppercase" style={{ color: '#d4a52c' }}>
                <span style={{ fontSize: '10px' }}>✓</span>
                {c}
              </div>
            ))}
          </div>
        )}
        {/* Current status */}
        {statusMsg && !statusChecks.includes(statusMsg) && (
          <div key={statusMsg} className="animate-fade-in text-sm font-mono tracking-[0.3em] uppercase" style={{
            color: statusMsg.includes('GRANTED') || statusMsg.includes('ALIGNED') ? '#d4a52c' : '#5f6e7c',
          }}>
            {statusMsg}
          </div>
        )}
        {/* Final lock display */}
        {mech === 'locked' && playerLit && boltsLocked && (
          <div className="mt-3 flex flex-col items-center gap-1.5">
            <div className="flex items-center justify-center gap-6">
              <div className="text-lg font-bold tracking-[0.2em] text-[#f5e6b0] uppercase">{target === 'INVESTOR' ? 'INVESTOR PORTAL' : 'PLAYER HUB'}</div>
              <div className="h-4 w-px bg-[#c0911e]/40" />
              <div className="text-sm font-mono tracking-[0.25em] text-[#d4a52c] uppercase">ACCESS GRANTED</div>
            </div>
            <div className="text-[10px] font-mono tracking-[0.3em] text-[#5f6e7c] uppercase">Secure Access Established</div>
          </div>
        )}

        {/* ACCESS DENIED display */}
        {mech === 'denied' && (
          <div className="mt-3 flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-3">
              <div className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
              <div className="text-lg font-bold tracking-[0.2em] text-red-400 uppercase">ACCESS DENIED</div>
              <div className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
            </div>
            <div className="text-sm font-mono tracking-[0.25em] text-red-300/70 uppercase">{targetLabel}</div>
            <div className="max-w-md text-center text-[11px] leading-relaxed text-white/50">
              Your SpotVault identity does not currently have access to this Portal.
            </div>
            <div className="mt-2 flex gap-2">
              {onReturnHome && (
                <button
                  onClick={onReturnHome}
                  className="rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/10 px-5 py-2.5 text-[10px] font-semibold tracking-[0.2em] text-[#d4a52c] uppercase transition-all hover:border-[#c0911e]/60 hover:bg-[#c0911e]/15"
                >
                  Return to {target === 'INVESTOR' ? 'Investor' : 'Home'} Portal
                </button>
              )}
              {onRequestAccess && (
                <button
                  onClick={onRequestAccess}
                  className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-[10px] font-semibold tracking-[0.2em] text-white/60 uppercase transition-all hover:border-white/20 hover:text-white"
                >
                  Request Access
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== TOP LABEL ===== */}
      <div className="absolute left-1/2 top-[6vh] z-40 -translate-x-1/2 text-center">
        <div className="text-[10px] font-mono tracking-[0.35em] uppercase" style={{
          color: mech === 'denied' ? '#ef4444' : '#5f6e7c',
        }}>SpotVault Secure Routing</div>
      </div>

      {/* Corner labels */}
      <div className="absolute bottom-6 left-8 z-40 text-[9px] font-mono tracking-widest text-[#2a323b] uppercase">SV-VAULT-02</div>
      <div className="absolute bottom-6 right-8 z-40 text-[9px] font-mono tracking-widest text-[#2a323b] uppercase">
        {mech === 'denied' ? 'Access Denied' : target === 'INVESTOR' ? 'Investor Routing' : target === 'PLAYER' ? 'Home Hub Routing' : 'Guest Hub Routing'}
      </div>
    </div>
  );
}
