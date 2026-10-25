import { X, Lock, KeyRound, Check, Radio } from 'lucide-react';
import type { Demo } from '@/useDemo';
import { ALL_HUBS, HUB_LABELS, type HubId } from '@/types';

interface Props {
  demo: Demo;
  onClose: () => void;
}

const HUB_POSITIONS: Record<HubId, { angle: number }> = {
  PLAYER: { angle: 0 },
  MEDIA: { angle: 30 },
  BUSINESS: { angle: 60 },
  COACH: { angle: 90 },
  STABLE: { angle: 120 },
  JOBS: { angle: 150 },
  CREATOR: { angle: 180 },
  TOURNAMENTS: { angle: 210 },
  MARKETPLACE: { angle: 240 },
  INVESTOR: { angle: 270 },
  EVENTS: { angle: 300 },
  PARTNERSHIPS: { angle: 330 },
  EXPO: { angle: 360 },
  HELP: { angle: 390 },
};

export function NetworkMap({ demo, onClose }: Props) {
  const { state } = demo;
  const radius = 200;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#050608]/85 backdrop-blur-sm">
      <div className="metal-frame-raised brushed-metal clip-bevel relative w-[640px] max-w-[94vw] rounded-2xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
              <h2 className="text-lg font-bold tracking-tight text-white">Network Map</h2>
            </div>
            <p className="mt-1 text-xs text-[#5f6e7c]">SpotVault — Industry Network</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#84929f] transition-all hover:border-[#38424e] hover:text-[#c7cfd8]">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="relative mx-auto mt-6" style={{ width: 480, height: 480 }}>
          <svg className="absolute inset-0" width="480" height="480">
            {ALL_HUBS.map((hub) => {
              const { angle } = HUB_POSITIONS[hub];
              const rad = ((angle - 90) * Math.PI) / 180;
              const x = 240 + Math.cos(rad) * radius;
              const y = 240 + Math.sin(rad) * radius;
              const a = state.access.find((x2) => x2.hub === hub);
              const isHome = a?.access === 'permanent';
              const isGuest = a?.access === 'guest';
              const isAvailable = a?.access === 'available';
              const stroke = isHome || isGuest ? '#d4a52c' : isAvailable ? '#84929f' : '#2a323b';
              const opacity = isHome || isGuest ? 0.5 : isAvailable ? 0.3 : 0.2;
              return (
                <line key={hub} x1="240" y1="240" x2={x} y2={y} stroke={stroke} strokeWidth={isHome || isGuest ? 1.5 : 1} opacity={opacity} strokeDasharray={isHome || isGuest ? '0' : '4 4'} />
              );
            })}
          </svg>

          {/* Central Inner Circle */}
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-[#c0911e]/50 bg-gradient-to-b from-[#1a1408] to-[#0e0a04] gold-glow">
              <div className="text-[9px] font-mono tracking-[0.3em] text-[#d4a52c]/70 uppercase">Central</div>
              <div className="mt-0.5 text-xs font-bold tracking-wide text-[#f5e6b0]">Inner Circle</div>
              <div className="mt-1 h-px w-8 bg-[#c0911e]/50" />
            </div>
          </div>

          {/* Hub nodes */}
          {ALL_HUBS.map((hub) => {
            const { angle } = HUB_POSITIONS[hub];
            const rad = ((angle - 90) * Math.PI) / 180;
            const x = 240 + Math.cos(rad) * radius;
            const y = 240 + Math.sin(rad) * radius;
            const a = state.access.find((x2) => x2.hub === hub);
            const isHome = a?.access === 'permanent';
            const isGuest = a?.access === 'guest';
            const isAvailable = a?.access === 'available';

            return (
              <div key={hub} className="absolute z-10" style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}>
                <div
                  className={`flex h-20 w-20 flex-col items-center justify-center rounded-xl border transition-all ${
                    isHome
                      ? 'border-[#c0911e] bg-[#c0911e]/20 gold-glow'
                      : isGuest
                      ? 'border-[#c0911e]/40 bg-[#c0911e]/10'
                      : isAvailable
                      ? 'border-[#5f6e7c]/40 bg-[#475565]/10'
                      : 'border-[#1a1f25] bg-[#11151a]/60'
                  }`}
                >
                  {isHome ? (
                    <Check className="h-4 w-4 text-[#d4a52c]" strokeWidth={2} />
                  ) : isGuest ? (
                    <KeyRound className="h-4 w-4 text-[#d4a52c]/80" strokeWidth={1.5} />
                  ) : isAvailable ? (
                    <KeyRound className="h-4 w-4 text-[#aab6c2]" strokeWidth={1.5} />
                  ) : (
                    <Lock className="h-4 w-4 text-[#475565]" strokeWidth={1.5} />
                  )}
                  <div className={`mt-1 text-center text-[9px] font-semibold tracking-widest uppercase ${isHome || isGuest ? 'text-[#f5e6b0]' : isAvailable ? 'text-[#aab6c2]' : 'text-[#5f6e7c]'}`}>
                    {HUB_LABELS[hub].replace(' Hub', '').replace('Tournaments', 'Events')}
                  </div>
                  <div className={`mt-0.5 text-[8px] font-mono tracking-widest uppercase ${isHome ? 'text-[#d4a52c]' : isGuest ? 'text-[#d4a52c]/70' : isAvailable ? 'text-[#aab6c2]' : 'text-[#475565]'}`}>
                    {isHome ? 'Home' : isGuest ? 'Guest' : isAvailable ? 'Open' : 'Locked'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-5">
          <LegendItem color="bg-[#d4a52c]" label="Home Hub" />
          <LegendItem color="bg-[#d4a52c]/60" label="Guest Access" />
          <LegendItem color="bg-[#aab6c2]" label="Available" />
          <LegendItem color="bg-[#475565]" label="Locked" />
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">{label}</span>
    </div>
  );
}
