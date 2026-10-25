import { HAND_CELLS, CARD_RANKS } from './types';
import type { SolverPosition, SolverTableConfig } from './types';

// ===== Hand classification utilities =====

export interface HandInfo {
  hand: string;
  r1: string;
  r2: string;
  r1Idx: number; // 0=A, 12=2
  r2Idx: number;
  isPair: boolean;
  isSuited: boolean;
  isOffsuit: boolean;
  gap: number; // connector gap (0 = connector, 1 = one-gapper, etc.)
}

export function classifyHand(hand: string): HandInfo {
  const r1 = hand[0];
  const r2 = hand[1];
  const isPair = r1 === r2;
  const isSuited = hand.length === 3 && hand[2] === 's';
  const isOffsuit = hand.length === 3 && hand[2] === 'o';
  const r1Idx = CARD_RANKS.indexOf(r1);
  const r2Idx = CARD_RANKS.indexOf(r2);
  const gap = isPair ? 0 : Math.abs(r1Idx - r2Idx) - 1;
  return { hand, r1, r2, r1Idx, r2Idx, isPair, isSuited, isOffsuit, gap };
}

const HAND_INFO_CACHE: Record<string, HandInfo> = {};
for (const h of HAND_CELLS) HAND_INFO_CACHE[h] = classifyHand(h);
export function getHandInfo(hand: string): HandInfo {
  return HAND_INFO_CACHE[hand] ?? classifyHand(hand);
}

// ===== Position width tiers =====
// Index 0 = tightest (UTG), higher = wider
const POSITION_TIERS: Record<string, number> = {
  UTG: 0,
  'UTG+1': 1,
  LJ: 2,
  HJ: 3,
  CO: 4,
  BTN: 5,
  SB: 6,
  BB: -1, // special
};

// Stack depth adjustments: shorter stacks = tighter ranges, more all-in
function stackTightnessFactor(effectiveStackBB: number): number {
  if (effectiveStackBB <= 10) return 0.55;
  if (effectiveStackBB <= 15) return 0.70;
  if (effectiveStackBB <= 20) return 0.80;
  if (effectiveStackBB <= 30) return 0.90;
  return 1.0; // 40bb+ = full ranges
}

// Player count adjustment: fewer players = wider per-position ranges
function playerCountWidenFactor(seatCount: number): number {
  if (seatCount <= 4) return 1.35;
  if (seatCount <= 6) return 1.15;
  if (seatCount <= 7) return 1.05;
  return 1.0; // 8-9 max
}

// ===== Hand class strength scoring =====
// Returns a "tier score" 0..1 where higher = stronger hand class
function handClassScore(info: HandInfo): number {
  const { isPair, isSuited, r1Idx, r2Idx, gap } = info;

  if (isPair) {
    // Pairs: AA=1.0, KK=0.95, ... 22=0.30
    return 0.30 + (12 - r1Idx) / 12 * 0.70;
  }

  // Non-pairs: base on high card, kicker, suitedness, connectivity
  let score = 0;
  // High card contribution (A high = 0.45, K high = 0.35, ...)
  score += (12 - r1Idx) / 12 * 0.45;
  // Kicker contribution
  score += (12 - r2Idx) / 12 * 0.25;

  if (isSuited) score += 0.12;
  // Connectivity bonus
  if (gap === 0) score += 0.08;
  else if (gap === 1) score += 0.04;
  else if (gap === 2) score += 0.02;

  return Math.min(1.0, score);
}

// ===== Opening range generation =====
// Returns a set of hand IDs that are "in range" for opening
function generateOpeningRange(
  position: SolverPosition,
  effectiveStackBB: number,
  seatCount: number,
): Set<string> {
  const tier = POSITION_TIERS[position] ?? 0;
  const tightness = stackTightnessFactor(effectiveStackBB);
  const widen = playerCountWidenFactor(seatCount);

  // Base threshold: higher tier (later position) = lower threshold = wider range
  // UTG tier 0 → threshold ~0.62, BTN tier 5 → threshold ~0.30
  const baseThreshold = 0.62 - tier * 0.065;
  const threshold = baseThreshold * tightness / widen;

  const range = new Set<string>();
  for (const hand of HAND_CELLS) {
    const info = getHandInfo(hand);
    const score = handClassScore(info);
    if (score >= threshold) {
      range.add(hand);
    }
  }

  // Always include all pairs 55+ for most positions (they're playable set-mines)
  if (tier >= 1 && effectiveStackBB >= 20) {
    for (const hand of HAND_CELLS) {
      const info = getHandInfo(hand);
      if (info.isPair && info.r1Idx <= 8) { // 55+
        range.add(hand);
      }
    }
  }

  // For very short stacks, add small pairs as shove candidates
  if (effectiveStackBB <= 15) {
    for (const hand of HAND_CELLS) {
      const info = getHandInfo(hand);
      if (info.isPair && info.r1Idx <= 10) { // 22+
        range.add(hand);
      }
    }
  }

  return range;
}

// ===== 3-bet range generation (vs an open) =====
function generate3betRange(
  position: SolverPosition,
  effectiveStackBB: number,
  _openerPosition: SolverPosition,
): Set<string> {
  const tier = POSITION_TIERS[position] ?? 0;
  const tightness = stackTightnessFactor(effectiveStackBB);

  // 3-bet ranges are much tighter than opening ranges
  const baseThreshold = 0.78 - tier * 0.03;
  const threshold = baseThreshold * tightness;

  const range = new Set<string>();
  for (const hand of HAND_CELLS) {
    const info = getHandInfo(hand);
    const score = handClassScore(info);
    if (score >= threshold) {
      range.add(hand);
    }
  }

  // Add some suited A-x as bluff 3-bets for later positions
  if (tier >= 3) {
    for (const hand of HAND_CELLS) {
      const info = getHandInfo(hand);
      if (info.isSuited && info.r1 === 'A' && info.r2Idx >= 3 && info.r2Idx <= 5) {
        // A5s, A4s, A3s as bluffs
        range.add(hand);
      }
    }
  }

  return range;
}

// ===== Cold-call range generation (vs an open) =====
function generateColdCallRange(
  position: SolverPosition,
  effectiveStackBB: number,
  _openerPosition: SolverPosition,
): Set<string> {
  const tier = POSITION_TIERS[position] ?? 0;
  const tightness = stackTightnessFactor(effectiveStackBB);

  // Cold-call range sits between opening and 3-bet
  const baseThreshold = 0.55 - tier * 0.04;
  const threshold = baseThreshold * tightness;

  const range = new Set<string>();
  for (const hand of HAND_CELLS) {
    const info = getHandInfo(hand);
    const score = handClassScore(info);
    if (score >= threshold) {
      range.add(hand);
    }
  }

  // Add suited connectors for later positions
  if (tier >= 3) {
    for (const hand of HAND_CELLS) {
      const info = getHandInfo(hand);
      if (info.isSuited && info.gap <= 2 && info.r1Idx >= 4 && info.r1Idx <= 8) {
        range.add(hand);
      }
    }
  }

  // Remove the very top hands (those go to 3-bet instead)
  const threebet = generate3betRange(position, effectiveStackBB, _openerPosition);
  for (const h of threebet) range.delete(h);

  return range;
}

// ===== BB defense range (vs an open) =====
function generateBBDefenseRange(
  effectiveStackBB: number,
  _openerPosition: SolverPosition,
): { call: Set<string>; threebet: Set<string> } {
  const threebet = generate3betRange('BB', effectiveStackBB, _openerPosition);

  // BB calls wider than any other position
  const tightness = stackTightnessFactor(effectiveStackBB);
  const threshold = 0.35 * tightness;

  const call = new Set<string>();
  for (const hand of HAND_CELLS) {
    const info = getHandInfo(hand);
    const score = handClassScore(info);
    if (score >= threshold && !threebet.has(hand)) {
      call.add(hand);
    }
  }

  // Add suited hands more liberally for BB
  for (const hand of HAND_CELLS) {
    const info = getHandInfo(hand);
    if (info.isSuited && info.r1Idx <= 6) {
      call.add(hand);
    }
  }

  return { call, threebet };
}

// ===== Scenario classification =====
export interface PreflopScenario {
  type: 'open' | 'facing_raise' | 'facing_3bet' | 'bb_defense' | 'facing_allin';
  position: SolverPosition;
  openerPosition?: SolverPosition;
  raiseCount: number;
  effectiveStackBB: number;
  seatCount: number;
}

export function classifyPreflopScenario(
  actions: import('./types').SolverStreetAction[],
  position: SolverPosition,
  effectiveStackBB: number,
  tableConfig: SolverTableConfig,
): PreflopScenario {
  const preflopActions = actions.filter(a => a.street === 'preflop');
  const raises = preflopActions.filter(a => a.action === 'raise' || a.action === 'bet');
  const allIns = preflopActions.filter(a => a.action === 'all-in');

  if (allIns.length > 0 && raises.length >= 1) {
    return { type: 'facing_allin', position, raiseCount: raises.length, effectiveStackBB, seatCount: tableConfig.seat_count };
  }
  if (raises.length === 0) {
    return { type: 'open', position, raiseCount: 0, effectiveStackBB, seatCount: tableConfig.seat_count };
  }
  if (raises.length >= 2) {
    return { type: 'facing_3bet', position, raiseCount: raises.length, openerPosition: raises[0].position, effectiveStackBB, seatCount: tableConfig.seat_count };
  }

  const opener = raises[0].position;
  if (position === 'BB') {
    return { type: 'bb_defense', position, raiseCount: 1, openerPosition: opener, effectiveStackBB, seatCount: tableConfig.seat_count };
  }
  return { type: 'facing_raise', position, raiseCount: 1, openerPosition: opener, effectiveStackBB, seatCount: tableConfig.seat_count };
}

// ===== Hand strategy generation =====
export interface HandStrategy {
  action: string;
  frequency: number;
}

export function generatePreflopStrategy(
  scenario: PreflopScenario,
  effectiveStackBB: number,
): Record<string, HandStrategy[]> {
  const result: Record<string, HandStrategy[]> = {};

  let openingRange: Set<string> | null = null;
  let threebetRange: Set<string> | null = null;
  let callRange: Set<string> | null = null;
  let bbCall: Set<string> | null = null;
  let bbThreebet: Set<string> | null = null;

  switch (scenario.type) {
    case 'open':
      openingRange = generateOpeningRange(scenario.position, effectiveStackBB, scenario.seatCount);
      break;
    case 'facing_raise':
      threebetRange = generate3betRange(scenario.position, effectiveStackBB, scenario.openerPosition ?? 'UTG');
      callRange = generateColdCallRange(scenario.position, effectiveStackBB, scenario.openerPosition ?? 'UTG');
      break;
    case 'bb_defense':
      {
        const def = generateBBDefenseRange(effectiveStackBB, scenario.openerPosition ?? 'UTG');
        bbCall = def.call;
        bbThreebet = def.threebet;
      }
      break;
    case 'facing_3bet':
    case 'facing_allin':
      // These use inline logic below
      break;
  }

  for (const hand of HAND_CELLS) {
    result[hand] = getHandStrategy(
      hand,
      scenario,
      effectiveStackBB,
      openingRange,
      threebetRange,
      callRange,
      bbCall,
      bbThreebet,
    );
  }

  return result;
}

function getHandStrategy(
  hand: string,
  scenario: PreflopScenario,
  effectiveStackBB: number,
  openingRange: Set<string> | null,
  threebetRange: Set<string> | null,
  callRange: Set<string> | null,
  bbCall: Set<string> | null,
  bbThreebet: Set<string> | null,
): HandStrategy[] {
  const info = getHandInfo(hand);
  const score = handClassScore(info);
  const isShort = effectiveStackBB <= 15;

  switch (scenario.type) {
    case 'open': {
      if (!openingRange || !openingRange.has(hand)) {
        return [{ action: 'fold', frequency: 1.0 }];
      }

      // Premium hands (AA, KK, QQ, AKs, AKo): mostly raise, some all-in
      if (info.isPair && info.r1Idx <= 2) {
        if (isShort) return [{ action: 'all-in', frequency: 0.85 }, { action: 'raise', frequency: 0.15 }];
        return [{ action: 'raise', frequency: 0.85 }, { action: 'all-in', frequency: 0.15 }];
      }
      if (info.r1Idx <= 0 && info.r2Idx <= 1 && (info.isSuited || !info.isSuited)) {
        // AK
        if (isShort) return [{ action: 'all-in', frequency: 0.60 }, { action: 'raise', frequency: 0.40 }];
        return [{ action: 'raise', frequency: 0.90 }, { action: 'call', frequency: 0.10 }];
      }

      // Strong hands (JJ-TT, AQ, AJs, KQs): mostly raise
      if (score >= 0.75) {
        return [{ action: 'raise', frequency: 0.85 }, { action: 'call', frequency: 0.15 }];
      }

      // Medium hands (88-99, AJo, KJo, suited connectors): mixed raise/call
      if (score >= 0.60) {
        if (isShort) return [{ action: 'raise', frequency: 0.50 }, { action: 'fold', frequency: 0.30 }, { action: 'all-in', frequency: 0.20 }];
        return [{ action: 'raise', frequency: 0.65 }, { action: 'call', frequency: 0.25 }, { action: 'fold', frequency: 0.10 }];
      }

      // Marginal opening hands: mixed raise/call/fold
      if (isShort) return [{ action: 'fold', frequency: 0.45 }, { action: 'raise', frequency: 0.30 }, { action: 'all-in', frequency: 0.25 }];
      return [
        { action: 'raise', frequency: 0.45 },
        { action: 'call', frequency: 0.35 },
        { action: 'fold', frequency: 0.20 },
      ];
    }

    case 'facing_raise': {
      if (threebetRange && threebetRange.has(hand)) {
        if (info.isPair && info.r1Idx <= 2) {
          return [{ action: 'raise', frequency: 0.75 }, { action: 'all-in', frequency: 0.25 }];
        }
        if (info.r1Idx <= 0 && info.r2Idx <= 1) {
          // AK
          return [{ action: 'raise', frequency: 0.70 }, { action: 'call', frequency: 0.30 }];
        }
        return [{ action: 'raise', frequency: 0.65 }, { action: 'call', frequency: 0.35 }];
      }
      if (callRange && callRange.has(hand)) {
        return [{ action: 'call', frequency: 0.75 }, { action: 'fold', frequency: 0.25 }];
      }
      return [{ action: 'fold', frequency: 1.0 }];
    }

    case 'bb_defense': {
      if (bbThreebet && bbThreebet.has(hand)) {
        if (info.isPair && info.r1Idx <= 1) {
          return [{ action: 'raise', frequency: 0.80 }, { action: 'all-in', frequency: 0.20 }];
        }
        return [{ action: 'raise', frequency: 0.65 }, { action: 'call', frequency: 0.35 }];
      }
      if (bbCall && bbCall.has(hand)) {
        return [{ action: 'call', frequency: 0.80 }, { action: 'fold', frequency: 0.20 }];
      }
      // BB already has money in — some trash suited hands defend slightly
      if (info.isSuited || info.isPair) {
        return [{ action: 'call', frequency: 0.25 }, { action: 'fold', frequency: 0.75 }];
      }
      return [{ action: 'fold', frequency: 1.0 }];
    }

    case 'facing_3bet': {
      // Facing a 3bet — only premium hands continue
      if (info.isPair && info.r1Idx <= 1) {
        // AA, KK
        return [{ action: 'raise', frequency: 0.55 }, { action: 'call', frequency: 0.45 }];
      }
      if (info.isPair && info.r1Idx <= 3) {
        // QQ, JJ
        return [{ action: 'call', frequency: 0.60 }, { action: 'raise', frequency: 0.25 }, { action: 'fold', frequency: 0.15 }];
      }
      if (info.r1Idx <= 0 && info.r2Idx <= 1 && info.isSuited) {
        // AKs
        return [{ action: 'raise', frequency: 0.45 }, { action: 'call', frequency: 0.55 }];
      }
      if (info.r1Idx <= 0 && info.r2Idx <= 1) {
        // AKo
        return [{ action: 'call', frequency: 0.55 }, { action: 'fold', frequency: 0.45 }];
      }
      if (info.r1Idx <= 0 && info.r2Idx <= 2 && info.isSuited) {
        // AQs, AJs
        return [{ action: 'call', frequency: 0.40 }, { action: 'fold', frequency: 0.60 }];
      }
      if (info.isPair && info.r1Idx <= 5) {
        // TT-77
        return [{ action: 'call', frequency: 0.35 }, { action: 'fold', frequency: 0.65 }];
      }
      return [{ action: 'fold', frequency: 1.0 }];
    }

    case 'facing_allin': {
      // Facing all-in: only call with very strong hands
      if (info.isPair && info.r1Idx <= 2) {
        return [{ action: 'call', frequency: 1.0 }];
      }
      if (info.r1Idx <= 0 && info.r2Idx <= 1 && info.isSuited) {
        return [{ action: 'call', frequency: 0.85 }, { action: 'fold', frequency: 0.15 }];
      }
      if (info.r1Idx <= 0 && info.r2Idx <= 1) {
        return [{ action: 'call', frequency: 0.55 }, { action: 'fold', frequency: 0.45 }];
      }
      if (info.isPair && info.r1Idx <= 4) {
        return [{ action: 'call', frequency: 0.45 }, { action: 'fold', frequency: 0.55 }];
      }
      return [{ action: 'fold', frequency: 1.0 }];
    }

    default:
      return [{ action: 'fold', frequency: 1.0 }];
  }
}

// Get range percentage for display
export function getRangePercentage(strategy: Record<string, HandStrategy[]>): number {
  let inRange = 0;
  for (const hand of HAND_CELLS) {
    const freqs = strategy[hand];
    if (!freqs) continue;
    const nonFold = freqs.filter(f => f.action !== 'fold' && f.frequency > 0.05);
    if (nonFold.length > 0) inRange++;
  }
  return Math.round((inRange / HAND_CELLS.length) * 100);
}
