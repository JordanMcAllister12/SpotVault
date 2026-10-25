import { useState } from 'react';
import { ChevronUp, Lock, Check, X, ArrowRight, Users } from 'lucide-react';
import {
  PLAYER_NETWORK_FLOORS,
  type FloorId,
  type PlayerNetworkFloor,
} from '@/data/playerNetworkFloors';
import type { PlayerNetworkTierResult } from '@/lib/playerNetworkTier';

const GOLD = '#c0911e';
const GOLD_BRIGHT = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface Props {
  tier: PlayerNetworkTierResult;
  onEnterFloor: (floorId: FloorId) => void;
  onClose: () => void;
}

export function ElevatorPanel({ tier, onEnterFloor, onClose }: Props) {
  const [hoveredFloor, setHoveredFloor] = useState<FloorId | null>(null);

  // Sort floors top-down (5 at top, 1 at bottom) like a real elevator
  const sortedFloors = [...PLAYER_NETWORK_FLOORS].sort((a, b) => b.id - a.id);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md">
      {/* Close on backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Elevator panel */}
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#c0911e]/25 bg-gradient-to-b from-[#0a0908] to-[#050403] shadow-2xl"
        style={{
          boxShadow:
            '0 0 0 1px rgba(192,145,30,0.08), 0 24px 80px -16px rgba(0,0,0,0.9), 0 0 60px -20px rgba(192,145,30,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#c0911e]/12 px-6 py-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <ChevronUp className="h-4 w-4" strokeWidth={2} style={{ color: GOLD_BRIGHT }} />
              <span className="text-sm font-bold tracking-[0.2em] text-white uppercase">
                Player Network
              </span>
            </div>
            <span className="mt-0.5 text-[9px] font-mono tracking-[0.3em] text-[#c0911e]/60 uppercase">
              Las Vegas Tower
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-white/30 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Floor list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex flex-col gap-1.5">
            {sortedFloors.map((floor) => (
              <FloorRow
                key={floor.id}
                floor={floor}
                tier={tier}
                isHovered={hoveredFloor === floor.id}
                onHover={() => setHoveredFloor(floor.id)}
                onLeave={() => setHoveredFloor(null)}
                onEnter={() => onEnterFloor(floor.id)}
              />
            ))}
          </div>
        </div>

        {/* Current access footer */}
        <div className="shrink-0 border-t border-[#c0911e]/12 bg-black/40 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-mono tracking-[0.25em] text-white/30 uppercase">
                Current Access
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="text-lg font-bold tracking-wide"
                  style={{ color: GOLD_SOFT, textShadow: '0 0 12px rgba(212,165,44,0.3)' }}
                >
                  FLOOR {String(tier.currentFloor).padStart(2, '0')}
                </span>
                <span className="text-xs text-white/40">
                  {PLAYER_NETWORK_FLOORS.find((f) => f.id === tier.currentFloor)?.name}
                </span>
              </div>
            </div>
            <button
              onClick={() => onEnterFloor(tier.currentFloor)}
              className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 px-4 py-2.5 text-[10px] font-bold tracking-[0.15em] uppercase transition-all hover:border-[#c0911e]/70 hover:bg-[#c0911e]/10"
              style={{ color: GOLD_SOFT }}
            >
              Enter Current Floor
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>

          {/* Next floor progress */}
          {tier.nextFloorProgress && (
            <div className="mt-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-wide text-white/60">
                  {PLAYER_NETWORK_FLOORS.find((f) => f.id === tier.nextFloorProgress!.floorId)?.name}
                </span>
                <span
                  className="text-[10px] font-mono font-bold tracking-wider"
                  style={{ color: GOLD_BRIGHT }}
                >
                  {tier.nextFloorProgress.percentQualified}% QUALIFIED
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${tier.nextFloorProgress.percentQualified}%`,
                    background: `linear-gradient(90deg, ${GOLD}, ${GOLD_BRIGHT})`,
                    boxShadow: '0 0 8px rgba(212,165,44,0.4)',
                  }}
                />
              </div>
              <div className="mt-2 space-y-0.5">
                {tier.nextFloorProgress.remainingCriteria.map((crit, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#c0911e]/40" />
                    <span className="text-[10px] leading-relaxed text-white/35">{crit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tier.isDemo && (
            <div className="mt-2 flex items-center gap-1.5">
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

// ===== FLOOR ROW =====

function FloorRow({
  floor,
  tier,
  isHovered,
  onHover,
  onLeave,
  onEnter,
}: {
  floor: PlayerNetworkFloor;
  tier: PlayerNetworkTierResult;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onEnter: () => void;
}) {
  const isUnlocked = tier.unlockedFloors.includes(floor.id);
  const isCurrent = tier.currentFloor === floor.id;
  const reasons = tier.qualificationReasons[floor.id] ?? [];

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="group rounded-xl border transition-all duration-200"
      style={{
        borderColor: isCurrent
          ? 'rgba(192,145,30,0.35)'
          : isUnlocked
            ? 'rgba(192,145,30,0.12)'
            : 'rgba(255,255,255,0.04)',
        background: isCurrent
          ? 'linear-gradient(135deg, rgba(192,145,30,0.08), rgba(192,145,30,0.02))'
          : isHovered
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(255,255,255,0.01)',
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Floor number */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold"
          style={{
            background: isUnlocked
              ? `linear-gradient(135deg, ${floor.accentColor}30, ${floor.accentColor}08)`
              : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isUnlocked ? floor.accentColor + '30' : 'rgba(255,255,255,0.05)'}`,
            color: isUnlocked ? floor.accentColor : 'rgba(255,255,255,0.25)',
          }}
        >
          {String(floor.id).padStart(2, '0')}
        </div>

        {/* Floor info */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-bold tracking-wide"
              style={{ color: isUnlocked ? '#fff' : 'rgba(255,255,255,0.4)' }}
            >
              {floor.name}
            </span>
            {isCurrent && (
              <span
                className="rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10 px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase"
                style={{ color: GOLD_SOFT }}
              >
                Current
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-[10px] text-white/30">{floor.tagline}</span>
            <span className="flex items-center gap-0.5 text-[10px] text-white/20">
              <Users className="h-2.5 w-2.5" strokeWidth={1.5} />
              {floor.usersOnline.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Status / action */}
        <div className="shrink-0">
          {isUnlocked ? (
            <button
              onClick={onEnter}
              className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/25 bg-[#c0911e]/8 px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all hover:border-[#c0911e]/50 hover:bg-[#c0911e]/15"
              style={{ color: GOLD_SOFT }}
            >
              {isCurrent ? (
                <>
                  <Check className="h-3 w-3" strokeWidth={2} />
                  Here
                </>
              ) : (
                <>
                  Enter
                  <ArrowRight className="h-3 w-3" strokeWidth={2} />
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2 text-[10px] font-bold tracking-widest text-white/25 uppercase">
              <Lock className="h-3 w-3" strokeWidth={2} />
              Locked
            </div>
          )}
        </div>
      </div>

      {/* Expanded detail on hover */}
      {isHovered && (
        <div className="border-t border-white/[0.03] px-4 py-2.5">
          <p className="text-[10px] leading-relaxed text-white/35">{floor.description}</p>
          {isUnlocked && reasons.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {reasons.map((r, i) => (
                <span
                  key={i}
                  className="rounded border border-[#c0911e]/15 bg-[#c0911e]/5 px-1.5 py-0.5 text-[9px] font-mono tracking-wide text-[#c0911e]/70"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
          {!isUnlocked && (
            <div className="mt-1.5">
              <span className="text-[9px] font-mono tracking-widest text-white/20 uppercase">
                Qualification:
              </span>
              <div className="mt-1 space-y-0.5">
                {floor.qualifications.map((q, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <Lock className="mt-0.5 h-2.5 w-2.5 shrink-0 text-white/15" strokeWidth={2} />
                    <span className="text-[10px] leading-relaxed text-white/25">{q.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
