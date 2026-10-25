import { useMemo } from 'react';
import { ChevronUp, Lock } from 'lucide-react';
import {
  PLAYER_NETWORK_FLOORS,
} from '@/data/playerNetworkFloors';
import {
  calculatePlayerNetworkTier,
  DEMO_PLAYER_DATA,
  type PlayerNetworkTierResult,
} from '@/lib/playerNetworkTier';

const GOLD = '#c0911e';
const GOLD_BRIGHT = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface Props {
  onEnterNetwork: () => void;
  onOpenFloorStatus: () => void;
}

export function PlayerNetworkStatus({ onEnterNetwork, onOpenFloorStatus }: Props) {
  const tier = useMemo(() => calculatePlayerNetworkTier(DEMO_PLAYER_DATA), []);
  const currentFloor = PLAYER_NETWORK_FLOORS.find((f) => f.id === tier.currentFloor)!;
  const nextFloor = tier.nextFloor
    ? PLAYER_NETWORK_FLOORS.find((f) => f.id === tier.nextFloor)
    : null;

  return (
    <div className="px-3 pb-2">
      <div className="mb-1.5 flex items-center gap-1.5 px-1">
        <span className="text-[8px] font-mono tracking-[0.2em] text-white/30 uppercase">
          Player Network
        </span>
      </div>

      <button
        onClick={onOpenFloorStatus}
        className="group w-full overflow-hidden rounded-xl border transition-all"
        style={{
          borderColor: 'rgba(192,145,30,0.12)',
          background: 'linear-gradient(135deg, rgba(192,145,30,0.06), rgba(0,0,0,0.2))',
        }}
      >
        {/* Current room */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold"
            style={{
              background: `linear-gradient(135deg, ${currentFloor.accentColor}25, ${currentFloor.accentColor}08)`,
              border: `1px solid ${currentFloor.accentColor}30`,
              color: currentFloor.accentColor,
            }}
          >
            {String(currentFloor.id).padStart(2, '0')}
          </div>
          <div className="flex min-w-0 flex-1 flex-col text-left">
            <span className="truncate text-[11px] font-bold text-white">{currentFloor.name}</span>
            <span className="text-[8px] font-mono tracking-widest uppercase" style={{ color: GOLD_SOFT + '99' }}>
              {currentFloor.tagline}
            </span>
          </div>
          <span
            className="shrink-0 rounded-full border px-1.5 py-0.5 text-[7px] font-bold tracking-widest uppercase"
            style={{ borderColor: GOLD + '30', color: GOLD_SOFT }}
          >
            Current
          </span>
        </div>

        {/* Progress bar */}
        {tier.nextFloorProgress && nextFloor && (
          <div className="border-t border-white/[0.04] px-3 py-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[8px] font-mono tracking-widest text-white/30 uppercase">
                <Lock className="h-2 w-2" strokeWidth={2} />
                {String(nextFloor.id).padStart(2, '0')} {nextFloor.shortName}
              </span>
              <span className="text-[8px] font-mono font-bold" style={{ color: GOLD_BRIGHT }}>
                {tier.nextFloorProgress.percentQualified}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${tier.nextFloorProgress.percentQualified}%`,
                  background: `linear-gradient(90deg, ${GOLD}, ${GOLD_BRIGHT})`,
                }}
              />
            </div>
          </div>
        )}
      </button>

      {/* Enter Player Network button */}
      <button
        onClick={onEnterNetwork}
        className="group mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/5 py-2 text-[9px] font-bold tracking-[0.15em] uppercase transition-all hover:border-[#c0911e]/40 hover:bg-[#c0911e]/10"
        style={{ color: GOLD_SOFT }}
      >
        <ChevronUp className="h-3 w-3" strokeWidth={2} style={{ color: GOLD_BRIGHT }} />
        Enter Network
      </button>
    </div>
  );
}

export type { PlayerNetworkTierResult };
