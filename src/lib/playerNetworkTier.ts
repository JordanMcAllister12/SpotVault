// ===== PLAYER NETWORK TIER EVALUATOR =====
// Separate service function. All qualification logic lives here —
// never scattered across React components.
//
// In production, `playerData` will be derived from verified SpotVault
// uploads (hand histories, tournament summaries, cash stakes, etc.).
// For now we pass in the demo data from playerNetworkFloors.ts.

import {
  PLAYER_NETWORK_FLOORS,
  DEMO_PLAYER_DATA,
  DEMO_TIER_RESULT,
  type FloorId,
  type FloorProgress,
  type PlayerNetworkTierResult,
  type DemoPlayerData,
} from '@/data/playerNetworkFloors';

export { DEMO_PLAYER_DATA, DEMO_TIER_RESULT };
export type { DemoPlayerData, PlayerNetworkTierResult, FloorProgress, FloorId };

// ===== QUALIFICATION THRESHOLDS =====
// Centralized so they can be tuned without touching component code.

interface TierThresholds {
  // Floor 2 — Poker Room
  minHandHistories: number;
  minTournamentResults: number;
  minRecentActivityDays: number;
  // Floor 3 — Resort
  minMttAbi: number;
  minTotalVolumeHands: number;
  minCashStakesNumeric: number;
  // Floor 4 — High Roller
  highRollerMttAbi: number;
  highRollerCashStakesNumeric: number;
  highRollerMinVolumeHands: number;
  // Floor 5 — Penthouse
  penthouseMttAbi: number;
  penthouseCashStakesNumeric: number;
  requiresMajorAccomplishment: boolean;
}

const THRESHOLDS: TierThresholds = {
  minHandHistories: 50,
  minTournamentResults: 10,
  minRecentActivityDays: 5,
  minMttAbi: 150,
  minTotalVolumeHands: 20000,
  minCashStakesNumeric: 5,
  highRollerMttAbi: 500,
  highRollerCashStakesNumeric: 25,
  highRollerMinVolumeHands: 100000,
  penthouseMttAbi: 1000,
  penthouseCashStakesNumeric: 50,
  requiresMajorAccomplishment: true,
};

// Helper: parse a cash stakes string like "5/10" into the big blind number.
function parseCashStakes(stakes: string): number {
  const match = stakes.match(/(\d+)\/(\d+)/);
  return match ? parseInt(match[2], 10) : 0;
}

// ===== INDIVIDUAL FLOOR CHECKS =====
// Each returns { qualified, reasons } so we can explain *why* a floor
// is or is not unlocked.

function checkFloor1(_data: DemoPlayerData): { qualified: boolean; reasons: string[] } {
  return { qualified: true, reasons: ['Default access — available to all members.'] };
}

function checkFloor2(data: DemoPlayerData): { qualified: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (data.verifiedHandHistories >= THRESHOLDS.minHandHistories)
    reasons.push(`Verified hand histories: ${data.verifiedHandHistories.toLocaleString()}`);
  if (data.verifiedTournamentResults >= THRESHOLDS.minTournamentResults)
    reasons.push(`Verified tournament results: ${data.verifiedTournamentResults}`);
  if (data.recentActivityDays >= THRESHOLDS.minRecentActivityDays)
    reasons.push(`Recent activity: ${data.recentActivityDays} days`);
  const qualified = reasons.length >= 2;
  return { qualified, reasons };
}

function checkFloor3(data: DemoPlayerData): { qualified: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (data.mttAbi >= THRESHOLDS.minMttAbi)
    reasons.push(`MTT ABI: $${data.mttAbi} (above $${THRESHOLDS.minMttAbi} threshold)`);
  if (data.totalVolumeHands >= THRESHOLDS.minTotalVolumeHands)
    reasons.push(`Total volume: ${data.totalVolumeHands.toLocaleString()} hands`);
  const stakesNum = parseCashStakes(data.cashStakesLevel);
  if (stakesNum >= THRESHOLDS.minCashStakesNumeric)
    reasons.push(`Cash stakes: ${data.cashStakesLevel}`);
  const qualified = reasons.length >= 2;
  return { qualified, reasons };
}

function checkFloor4(data: DemoPlayerData): { qualified: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (data.mttAbi >= THRESHOLDS.highRollerMttAbi)
    reasons.push(`MTT ABI: $${data.mttAbi} (above $${THRESHOLDS.highRollerMttAbi} threshold)`);
  const stakesNum = parseCashStakes(data.cashStakesLevel);
  if (stakesNum >= THRESHOLDS.highRollerCashStakesNumeric)
    reasons.push(`Cash stakes: ${data.cashStakesLevel} (meets 25/50+ threshold)`);
  if (data.totalVolumeHands >= THRESHOLDS.highRollerMinVolumeHands)
    reasons.push(`Volume: ${data.totalVolumeHands.toLocaleString()} hands (meets high-roller volume)`);
  if (data.majorAccomplishments.length > 0)
    reasons.push(`Major accomplishment: ${data.majorAccomplishments.join(', ')}`);
  // Need at least one qualifying criterion
  const qualified = reasons.length >= 1;
  return { qualified, reasons };
}

function checkFloor5(data: DemoPlayerData): { qualified: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (data.mttAbi >= THRESHOLDS.penthouseMttAbi)
    reasons.push(`MTT ABI: $${data.mttAbi} (elite threshold $${THRESHOLDS.penthouseMttAbi})`);
  const stakesNum = parseCashStakes(data.cashStakesLevel);
  if (stakesNum >= THRESHOLDS.penthouseCashStakesNumeric)
    reasons.push(`Cash stakes: ${data.cashStakesLevel} (meets 50/100+ threshold)`);
  if (THRESHOLDS.requiresMajorAccomplishment && data.majorAccomplishments.length > 0)
    reasons.push(`Major accomplishment: ${data.majorAccomplishments.join(', ')}`);
  const qualified = reasons.length >= 2;
  return { qualified, reasons };
}

const FLOOR_CHECKS = [
  checkFloor1,
  checkFloor2,
  checkFloor3,
  checkFloor4,
  checkFloor5,
];

// ===== MAIN EVALUATOR =====

export function calculatePlayerNetworkTier(
  playerData: DemoPlayerData,
): PlayerNetworkTierResult {
  const checks = FLOOR_CHECKS.map((fn, i) => ({
    floorId: (i + 1) as FloorId,
    ...fn(playerData),
  }));

  // Find the highest unlocked floor
  let highestUnlocked: FloorId = 1;
  const unlocked: FloorId[] = [];
  const reasons: Record<FloorId, string[]> = {} as Record<FloorId, string[]>;

  for (const check of checks) {
    reasons[check.floorId] = check.reasons;
    if (check.qualified) {
      unlocked.push(check.floorId);
      if (check.floorId > highestUnlocked) highestUnlocked = check.floorId;
    }
  }

  // Ensure floor 1 is always unlocked
  if (!unlocked.includes(1)) unlocked.push(1);
  unlocked.sort((a, b) => a - b);

  // Find next locked floor above current
  const allFloorIds = PLAYER_NETWORK_FLOORS.map((f) => f.id);
  const nextFloor = allFloorIds.find((id) => id > highestUnlocked && !unlocked.includes(id)) ?? null;

  // Compute progress toward next floor
  let nextFloorProgress: FloorProgress | null = null;
  if (nextFloor) {
    const nextCheck = checks.find((c) => c.floorId === nextFloor)!;
    const floorDef = PLAYER_NETWORK_FLOORS.find((f) => f.id === nextFloor)!;
    const totalCriteria = floorDef.qualifications.length;
    const metCriteria = nextCheck.reasons.length;
    const percent = Math.min(99, Math.round((metCriteria / totalCriteria) * 100));

    const remainingCriteria: string[] = [];
    if (nextFloor === 4) {
      remainingCriteria.push(
        'Increase rolling ABI above $500',
        'OR meet qualifying cash-stakes threshold (25/50+)',
        'OR earn a qualifying major achievement',
      );
    } else if (nextFloor === 5) {
      remainingCriteria.push(
        'Verified regular participation around 50/100+ stakes',
        'OR elite verified ABI / volume combination',
        'OR a major verified poker accomplishment',
      );
    } else {
      floorDef.qualifications.forEach((q) => {
        if (!nextCheck.reasons.some((r) => r.includes(q.label))) {
          remainingCriteria.push(q.description);
        }
      });
    }

    nextFloorProgress = {
      floorId: nextFloor,
      percentQualified: percent,
      remainingCriteria,
    };
  }

  return {
    currentFloor: highestUnlocked,
    unlockedFloors: unlocked,
    qualificationReasons: reasons,
    nextFloor,
    nextFloorProgress,
    isDemo: true,
    permanentFloor: highestUnlocked,
    temporaryGuestFloor: null,
    guestPassExpiresAt: null,
  };
}

// Convenience: get the floor definition by id
export function getFloorDefinition(floorId: FloorId) {
  return PLAYER_NETWORK_FLOORS.find((f) => f.id === floorId)!;
}

// Convenience: can a user access a specific floor?
export function canAccessFloor(
  tier: PlayerNetworkTierResult,
  floorId: FloorId,
): boolean {
  return tier.unlockedFloors.includes(floorId);
}
