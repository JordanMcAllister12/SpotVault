import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  onComplete: () => void;
  reducedMotion: boolean;
  doorImage: string;
  vaultImage: string;
}

type Stage = 'granted' | 'unlock' | 'opening' | 'reveal' | 'push';

const FAILSAFE_MS = 4000;

export function CinematicEntrance({ onComplete, reducedMotion, doorImage, vaultImage }: Props) {
  const [stage, setStage] = useState<Stage>('granted');
  const [doorProgress, setDoorProgress] = useState(0);
  const [vaultScale, setVaultScale] = useState(1);
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completeRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  // Keep latest onComplete in a ref so the effect never needs to re-run
  onCompleteRef.current = onComplete;

  const complete = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    const after = (ms: number, callback: () => void) => {
      timersRef.current.push(setTimeout(callback, ms));
    };

    if (reducedMotion) {
      after(250, () => setOverlayOpacity(0));
      after(600, complete);
    } else {
      after(0, () => setStage('granted'));
      after(280, () => setStage('unlock'));
      after(520, () => { setStage('opening'); setDoorProgress(1); });
      after(900, () => setStage('reveal'));
      after(1250, () => { setStage('push'); setVaultScale(1.14); });
      after(1720, () => setOverlayOpacity(0));
      after(2000, complete);
    }

    // Failsafe: if the normal completion timer fails for any reason,
    // force-complete after FAILSAFE_MS so the user is never locked out.
    after(FAILSAFE_MS, complete);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [reducedMotion, complete]);

  const doorTransition = 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)';
  const cameraTransition = 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)';

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-[#050608]"
      style={{ opacity: overlayOpacity, transition: 'opacity 380ms ease-out' }}
    >
      {/* LAYER 2 — SpotVault vault/smoke environment, mounted from the start.
          It is always present behind the doors; the closed doors simply cover it. */}
      <div
        className="absolute inset-0"
        style={{
          transform: `scale(${vaultScale})`,
          transition: cameraTransition,
        }}
      >
        <img
          src={vaultImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectFit: 'cover' }}
        />
        {/* Atmospheric overlays — subtle, never fully opaque */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,4,3,0.18),rgba(5,4,3,0.55))]" />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 45%, rgba(220,190,135,0.1), transparent 58%)',
            animation: 'smoke-drift 4s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(110deg, transparent 35%, rgba(245,230,176,0.06) 50%, transparent 65%)',
            animation: 'door-light-sweep 5s ease-in-out infinite',
          }}
        />
      </div>

      {/* Warm light waiting in the opening — visible as doors separate */}
      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-3 -translate-x-1/2"
        style={{
          opacity: stage === 'unlock' || stage === 'opening' ? 1 : 0,
          boxShadow: '0 0 38px 14px rgba(212,165,44,0.28)',
          background: 'linear-gradient(180deg, transparent, #f5e6b0 50%, transparent)',
          transition: 'opacity 250ms ease-out',
        }}
      />

      {/* LAYER 3 — Actual black-door asset, split into two physical halves.
          The vault environment is already mounted behind; doors cover it until they open. */}
      <div className="absolute inset-0 z-20 flex">
        <DoorHalf side="left" image={doorImage} progress={doorProgress} transition={doorTransition} />
        <DoorHalf side="right" image={doorImage} progress={doorProgress} transition={doorTransition} />
      </div>

      {/* LAYER 4 — Access granted text, brief, above door artwork */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 text-center"
        style={{
          opacity: stage === 'granted' || stage === 'unlock' ? 1 : 0,
          transition: 'opacity 240ms ease-out',
        }}
      >
        <div className="text-2xl font-bold tracking-[0.3em] text-[#f5e6b0] uppercase [text-shadow:0_0_18px_rgba(212,165,44,0.7)]">
          Access Granted
        </div>
        <div className="mt-2 text-[10px] font-mono tracking-[0.4em] text-[#d4a52c]/70 uppercase">
          SpotVault Secure Entry
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-40"
        style={{ background: 'radial-gradient(ellipse 90% 100% at 50% 50%, transparent 35%, rgba(0,0,0,0.58) 100%)' }}
      />
    </div>
  );
}

function DoorHalf({
  side,
  image,
  progress,
  transition,
}: {
  side: 'left' | 'right';
  image: string;
  progress: number;
  transition: string;
}) {
  const left = side === 'left';
  return (
    <div
      className="relative h-full w-1/2 overflow-hidden"
      style={{
        transform: `translateX(${left ? -progress * 100 : progress * 100}%)`,
        transition,
      }}
    >
      <div
        className="absolute inset-0 h-full w-[200%] bg-cover bg-center bg-no-repeat"
        style={{
          left: left ? 0 : '-100%',
          backgroundImage: `url("${image}")`,
          backgroundPosition: left ? 'left center' : 'right center',
        }}
      />
      <div className="absolute inset-0 bg-black/10" />
    </div>
  );
}
