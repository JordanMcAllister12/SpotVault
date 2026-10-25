import { ChevronUp, X, Lock } from 'lucide-react';
import {
  PLAYER_NETWORK_FLOORS,
} from '@/data/playerNetworkFloors';
import type { PlayerNetworkTierResult } from '@/lib/playerNetworkTier';

const GOLD = '#c0911e';
const GOLD_BRIGHT = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface Props {
  tier: PlayerNetworkTierResult;
  onClose: () => void;
}

export function FloorStatusModal({ tier, onClose }: Props) {
  const currentFloor = PLAYER_NETWORK_FLOORS.find((f) => f.id === tier.currentFloor)!;
  const higherFloors = PLAYER_NETWORK_FLOORS.filter((f) => f.id > tier.currentFloor);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[#c0911e]/25 bg-gradient-to-b from-[#0a0908] to-[#050403] shadow-2xl"
        style={{
          boxShadow:
            '0 0 0 1px rgba(192,145,30,0.08), 0 24px 80px -16px rgba(0,0,0,0.9), 0 0 60px -20px rgba(192,145,30,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#c0911e]/12 px-5 py-4">
          <div className="flex items-center gap-2">
            <ChevronUp className="h-4 w-4" strokeWidth={2} style={{ color: GOLD_BRIGHT }} />
            <span className="text-sm font-bold tracking-[0.2em] text-white uppercase">Your Floor</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-white/30 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Current floor */}
          <div
            className="rounded-xl border p-4"
            style={{
              borderColor: currentFloor.accentColor + '40',
              background: `linear-gradient(135deg, ${currentFloor.accentColor}12, ${currentFloor.accentColor}04)`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg font-mono text-sm font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${currentFloor.accentColor}30, ${currentFloor.accentColor}08)`,
                    border: `1px solid ${currentFloor.accentColor}40`,
                    color: currentFloor.accentColor,
                  }}
                >
                  {String(currentFloor.id).padStart(2, '0')}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{currentFloor.name}</div>
                  <div className="text-[10px] text-white/40">{currentFloor.tagline}</div>
                </div>
              </div>
              <span
                className="rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10 px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase"
                style={{ color: GOLD_SOFT }}
              >
                Current
              </span>
            </div>
          </div>

          {/* Next floor progress */}
          {tier.nextFloorProgress && (
            <div className="mt-4">
              <div className="mb-2 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
                Next Floor
              </div>
              {(() => {
                const nextFloor = PLAYER_NETWORK_FLOORS.find(
                  (f) => f.id === tier.nextFloorProgress!.floorId,
                )!;
                return (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-bold"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.3)',
                          }}
                        >
                          {String(nextFloor.id).padStart(2, '0')}
                        </div>
                        <span className="text-xs font-semibold text-white/70">{nextFloor.name}</span>
                      </div>
                      <span
                        className="text-[10px] font-mono font-bold tracking-wider"
                        style={{ color: GOLD_BRIGHT }}
                      >
                        {tier.nextFloorProgress.percentQualified}% QUALIFIED
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${tier.nextFloorProgress.percentQualified}%`,
                          background: `linear-gradient(90deg, ${GOLD}, ${GOLD_BRIGHT})`,
                          boxShadow: '0 0 8px rgba(212,165,44,0.4)',
                        }}
                      />
                    </div>
                    <div className="mt-3 space-y-1">
                      {tier.nextFloorProgress.remainingCriteria.map((crit, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#c0911e]/40" />
                          <span className="text-[10px] leading-relaxed text-white/35">{crit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Locked higher floors */}
          {higherFloors.length > 1 && (
            <div className="mt-4 space-y-1.5">
              {higherFloors.slice(1).map((floor) => (
                <div
                  key={floor.id}
                  className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[10px] font-bold"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.2)',
                      }}
                    >
                      {String(floor.id).padStart(2, '0')}
                    </div>
                    <span className="text-[11px] font-semibold text-white/40">{floor.name}</span>
                  </div>
                  <span className="flex items-center gap-1 text-[9px] font-bold tracking-widest text-white/20 uppercase">
                    <Lock className="h-2.5 w-2.5" strokeWidth={2} />
                    Locked
                  </span>
                </div>
              ))}
            </div>
          )}

          {tier.isDemo && (
            <div className="mt-4 flex items-center gap-1.5">
              <span className="rounded border border-amber-500/20 bg-amber-500/5 px-1.5 py-0.5 text-[8px] font-mono font-bold tracking-widest text-amber-400/70 uppercase">
                Demo
              </span>
              <span className="text-[9px] text-white/25">
                Tier based on simulated poker data. Connect SpotVault data for real qualification.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
