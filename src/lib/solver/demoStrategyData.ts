// ===== Demo / Development Strategy Data =====
// Temporary development ranges for testing preflop navigation UX.
// These are NOT DeepSolver outputs — they are approximate development ranges
// marked as DEMO DATA so the UI can be tested end-to-end.
// When DeepSolver is connected, it becomes the authoritative source.

import type { SolverPosition } from './types';
import type { ReferenceHandStrategy, ReferenceNodeStrategy, ReferenceDataset } from './preflopReferenceData';
import { buildConfigKey } from './preflopReferenceData';

// ── Hand classification helpers ──

const RANKS = 'AKQJT98765432';
function rankValue(r: string): number { return RANKS.indexOf(r); }
function isPair(h: string): boolean { return h[0] === h[1]; }
function isSuited(h: string): boolean { return h.length === 3 && h[2] === 's'; }
function highCard(h: string): string { return h[0]; }
function lowCard(h: string): string { return isPair(h) ? h[0] : h[1]; }
function isConnector(h: string): boolean {
  if (isPair(h)) return false;
  const gap = rankValue(highCard(h)) - rankValue(lowCard(h));
  return gap <= 1;
}
function isSuitedConnector(h: string): boolean { return isSuited(h) && isConnector(h); }

// ── Range tier definitions ──
// Each tier defines which hands get which action frequencies.
// This produces recognizable poker ranges without claiming GTO accuracy.

interface RangeTier {
  // Hands that raise/open with high frequency
  raiseHands: (h: string) => boolean;
  raiseFreq: number;
  // Hands that call/limp
  callHands: (h: string) => boolean;
  callFreq: number;
  // Hands that 3-bet (for facing_raise scenarios)
  threeBetHands?: (h: string) => boolean;
  threeBetFreq?: number;
  // Description for metadata
  description: string;
}

// ── Tier definitions per position/scenario ──

function isPremium(h: string): boolean {
  const p = ['AA','KK','QQ','JJ','TT'];
  return p.includes(h);
}
function isStrongBroadway(h: string): boolean {
  const b = ['AKs','AKo','AQs','AQo','AJs','KQs'];
  return b.includes(h);
}
function isPlayableBroadway(h: string): boolean {
  const b = ['AJo','ATs','KJs','KJo','QJs','QTs','JTs'];
  return b.includes(h);
}
function isMidPair(h: string): boolean {
  return ['99','88','77','66','55'].includes(h);
}
function isSmallPair(h: string): boolean {
  return ['44','33','22'].includes(h);
}
function isSuitedAce(h: string): boolean {
  return h[0] === 'A' && isSuited(h) && h !== 'AKs' && h !== 'AQs' && h !== 'AJs' && h !== 'ATs';
}
function isSuitedKing(h: string): boolean {
  return h[0] === 'K' && isSuited(h) && !['KQs','KJs'].includes(h);
}
function isSuitedConnectorLow(h: string): boolean {
  return isSuitedConnector(h) && rankValue(highCard(h)) >= rankValue('9');
}

// ── Unopened tiers by position ──

const UNOPENED_TIERS: Record<SolverPosition, RangeTier> = {
  UTG: {
    raiseHands: (h) => isPremium(h) || isStrongBroadway(h) || isMidPair(h) || h === 'AJo' || h === 'KQs',
    raiseFreq: 0.85,
    callHands: (h) => isSmallPair(h) || isPlayableBroadway(h) || ['ATs','KTs','QJs','JTs','T9s','98s'].includes(h),
    callFreq: 0.50,
    description: 'UTG unopened (tight)',
  },
  'UTG+1': {
    raiseHands: (h) => isPremium(h) || isStrongBroadway(h) || isMidPair(h) || isPlayableBroadway(h) || h === 'KQs',
    raiseFreq: 0.82,
    callHands: (h) => isSmallPair(h) || isSuitedAce(h) || ['KTs','QTs','JTs','T9s','98s','87s'].includes(h),
    callFreq: 0.45,
    description: 'UTG+1 unopened',
  },
  LJ: {
    raiseHands: (h) => isPremium(h) || isStrongBroadway(h) || isMidPair(h) || isPlayableBroadway(h) || ['KQs','KJs','KTs','QTs'].includes(h),
    raiseFreq: 0.80,
    callHands: (h) => isSmallPair(h) || isSuitedAce(h) || isSuitedConnectorLow(h) || ['QJo','JTo'].includes(h),
    callFreq: 0.40,
    description: 'LJ unopened',
  },
  HJ: {
    raiseHands: (h) => isPremium(h) || isStrongBroadway(h) || isMidPair(h) || isPlayableBroadway(h) ||
      ['KQs','KJs','KTs','QJs','QTs','A9s','A8s','A7s'].includes(h),
    raiseFreq: 0.78,
    callHands: (h) => isSmallPair(h) || isSuitedAce(h) || isSuitedConnectorLow(h) ||
      ['QJo','JTo','97s','76s'].includes(h),
    callFreq: 0.35,
    description: 'HJ unopened',
  },
  CO: {
    raiseHands: (h) => isPremium(h) || isStrongBroadway(h) || isMidPair(h) || isSmallPair(h) ||
      isPlayableBroadway(h) || ['KQs','KJs','KTs','QJs','QTs','QJo','JTs','A9s','A8s','A7s','A6s','A5s'].includes(h),
    raiseFreq: 0.75,
    callHands: (h) => isSuitedAce(h) || isSuitedConnectorLow(h) || ['JTo','T9o','98s','87s','76s','65s'].includes(h),
    callFreq: 0.30,
    description: 'CO unopened (wide)',
  },
  BTN: {
    raiseHands: (h) => isPremium(h) || isStrongBroadway(h) || isMidPair(h) || isSmallPair(h) ||
      isPlayableBroadway(h) || isSuitedAce(h) ||
      ['KQs','KJs','KTs','K9s','QJs','QTs','Q9s','JTs','J9s','T9s','98s','87s','76s','65s','54s','A9o','KQo','KJo'].includes(h),
    raiseFreq: 0.70,
    callHands: (h) => isSuitedConnectorLow(h) || ['JTo','T9o','98o','A8o','A7o','A6o','A5o','A4o','KTo','QTo'].includes(h),
    callFreq: 0.25,
    description: 'BTN unopened (very wide)',
  },
  SB: {
    raiseHands: (h) => isPremium(h) || isStrongBroadway(h) || isMidPair(h) || isSmallPair(h) ||
      ['KQs','KJs','KTs','QJs','QTs','JTs','A9s','A8s','A7s','A6s','A5s','KQo'].includes(h),
    raiseFreq: 0.72,
    callHands: (h) => isSuitedAce(h) || isSuitedConnectorLow(h) || ['KJo','QJo','JTo','T9s','98s','87s'].includes(h),
    callFreq: 0.30,
    description: 'SB unopened (limp/raise mix)',
  },
  BB: {
    raiseHands: () => false,
    raiseFreq: 0,
    callHands: () => true, // BB checks option
    callFreq: 1.0,
    description: 'BB unopened (check option)',
  },
};

// ── Facing raise tiers ──
// When facing an open raise, tighter ranges than unopened.

const FACING_RAISE_TIERS: Record<SolverPosition, RangeTier> = {
  UTG: {
    raiseHands: (h) => ['AA','KK','QQ','AKs','AKo'].includes(h),
    raiseFreq: 0.90, // 3-bet
    callHands: (h) => ['JJ','TT','99','88','AQs','AQo','AJs','KQs'].includes(h),
    callFreq: 0.60,
    threeBetHands: (h) => ['AA','KK','QQ','AKs','AKo'].includes(h),
    threeBetFreq: 0.85,
    description: 'UTG facing 3bet (very tight)',
  },
  'UTG+1': {
    raiseHands: (h) => ['AA','KK','QQ','JJ','AKs','AKo','AQs'].includes(h),
    raiseFreq: 0.85,
    callHands: (h) => ['TT','99','88','77','AQo','AJs','KQs','KJs','QJs'].includes(h),
    callFreq: 0.50,
    threeBetHands: (h) => ['AA','KK','QQ','JJ','AKs','AKo'].includes(h),
    threeBetFreq: 0.80,
    description: 'UTG+1 facing raise',
  },
  LJ: {
    raiseHands: (h) => ['AA','KK','QQ','JJ','TT','AKs','AKo','AQs'].includes(h),
    raiseFreq: 0.80,
    callHands: (h) => ['99','88','77','66','55','AQo','AJs','KQs','KJs','KTs','QJs'].includes(h),
    callFreq: 0.45,
    threeBetHands: (h) => ['AA','KK','QQ','JJ','AKs','AKo'].includes(h),
    threeBetFreq: 0.75,
    description: 'LJ facing raise',
  },
  HJ: {
    raiseHands: (h) => ['AA','KK','QQ','JJ','TT','99','AKs','AKo','AQs','AQo'].includes(h),
    raiseFreq: 0.75,
    callHands: (h) => ['88','77','66','55','44','AJs','KQs','KJs','KTs','QJs','QTs','JTs'].includes(h),
    callFreq: 0.40,
    threeBetHands: (h) => ['AA','KK','QQ','JJ','TT','AKs','AKo'].includes(h),
    threeBetFreq: 0.70,
    description: 'HJ facing raise',
  },
  CO: {
    raiseHands: (h) => ['AA','KK','QQ','JJ','TT','99','88','AKs','AKo','AQs','AQo','AJs'].includes(h),
    raiseFreq: 0.70,
    callHands: (h) => ['77','66','55','44','33','KQs','KJs','KTs','QJs','QTs','JTs','T9s','ATs','AJo'].includes(h),
    callFreq: 0.35,
    threeBetHands: (h) => ['AA','KK','QQ','JJ','TT','AKs','AKo','AQs'].includes(h),
    threeBetFreq: 0.65,
    description: 'CO facing raise',
  },
  BTN: {
    raiseHands: (h) => ['AA','KK','QQ','JJ','TT','99','88','77','AKs','AKo','AQs','AQo','AJs','KQs'].includes(h),
    raiseFreq: 0.65,
    callHands: (h) => ['66','55','44','33','22','KJs','KTs','QJs','QTs','JTs','T9s','98s','87s','AJo','AJo','ATs'].includes(h),
    callFreq: 0.30,
    threeBetHands: (h) => ['AA','KK','QQ','JJ','TT','99','AKs','AKo','AQs','A5s','A4s'].includes(h),
    threeBetFreq: 0.60,
    description: 'BTN facing raise (wide call)',
  },
  SB: {
    raiseHands: (h) => ['AA','KK','QQ','JJ','TT','AKs','AKo','AQs','AQo'].includes(h),
    raiseFreq: 0.70,
    callHands: (h) => ['99','88','77','66','55','44','33','22','AJs','KQs','KJs','KTs','QJs','JTs','T9s'].includes(h),
    callFreq: 0.35,
    threeBetHands: (h) => ['AA','KK','QQ','JJ','AKs','AKo'].includes(h),
    threeBetFreq: 0.75,
    description: 'SB facing raise',
  },
  BB: {
    raiseHands: (h) => ['AA','KK','QQ','JJ','TT','99','88','AKs','AKo','AQs','AQo'].includes(h),
    raiseFreq: 0.65, // 3-bet from BB
    callHands: (h) => ['77','66','55','44','33','22','AJs','ATs','KQs','KJs','KTs','QJs','QTs','JTs','T9s','98s','87s','76s','65s','54s','AJo','KQo'].includes(h),
    callFreq: 0.40,
    threeBetHands: (h) => ['AA','KK','QQ','JJ','TT','AKs','AKo','AQs','A5s','A4s','KQs'].includes(h),
    threeBetFreq: 0.55,
    description: 'BB defense facing raise',
  },
};

// ── Build strategy for a hand given a tier ──

function buildHandStrategy(hand: string, tier: RangeTier, isFacingRaise: boolean): ReferenceHandStrategy[] {
  const result: ReferenceHandStrategy[] = [];

  if (isFacingRaise && tier.threeBetHands?.(hand)) {
    // 3-bet with some call mix
    const threeBetFreq = tier.threeBetFreq ?? 0.75;
    result.push({ action: 'raise', frequency: threeBetFreq });
    if (tier.callHands(hand)) {
      result.push({ action: 'call', frequency: 1 - threeBetFreq });
    } else {
      result.push({ action: 'fold', frequency: 1 - threeBetFreq });
    }
    return result;
  }

  if (tier.raiseHands(hand)) {
    const freq = tier.raiseFreq;
    result.push({ action: 'raise', frequency: freq });
    if (tier.callHands(hand)) {
      result.push({ action: 'call', frequency: 1 - freq });
    } else {
      result.push({ action: 'fold', frequency: 1 - freq });
    }
    return result;
  }

  if (tier.callHands(hand)) {
    result.push({ action: 'call', frequency: tier.callFreq });
    result.push({ action: 'fold', frequency: 1 - tier.callFreq });
    return result;
  }

  return [{ action: 'fold', frequency: 1.0 }];
}

// ── Generate all 169 hands for a given tier ──

const ALL_HANDS: string[] = (() => {
  const hands: string[] = [];
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = i; j < RANKS.length; j++) {
      if (i === j) hands.push(`${RANKS[i]}${RANKS[j]}`);
      else hands.push(`${RANKS[i]}${RANKS[j]}s`);
      if (i !== j) hands.push(`${RANKS[i]}${RANKS[j]}o`);
    }
  }
  return hands;
})();

function buildDemoDataset(params: {
  format: 'tournament';
  solveType: 'chipev' | 'icm';
  seatCount: number;
  anteType: 'none' | 'bb_ante' | 'per_player';
  anteBB: number;
  stackBB: number;
  position: SolverPosition;
  scenario: 'unopened' | 'facing_raise' | 'facing_3bet' | 'bb_defense' | 'facing_allin';
  openerPosition?: SolverPosition;
}): ReferenceDataset {
  const tier = params.scenario === 'unopened'
    ? UNOPENED_TIERS[params.position]
    : FACING_RAISE_TIERS[params.position] ?? UNOPENED_TIERS[params.position];

  const isFacingRaise = params.scenario !== 'unopened';

  const hands: Record<string, ReferenceHandStrategy[]> = {};
  for (const hand of ALL_HANDS) {
    hands[hand] = buildHandStrategy(hand, tier, isFacingRaise);
  }

  const availableActions = params.scenario === 'unopened'
    ? [
        { action: 'fold', label: 'Fold' },
        { action: 'call', label: 'Limp' },
        { action: 'raise', label: 'Raise 2.2' },
        { action: 'all-in', label: 'All-in' },
      ]
    : [
        { action: 'fold', label: 'Fold' },
        { action: 'call', label: 'Call' },
        { action: 'raise', label: '3-Bet' },
        { action: 'all-in', label: 'All-in' },
      ];

  const key = buildConfigKey({
    format: params.format,
    solveType: params.solveType,
    seatCount: params.seatCount,
    anteType: params.anteType,
    anteBB: params.anteBB,
    stackBB: params.stackBB,
    position: params.position,
    scenario: params.scenario,
    openerPosition: params.openerPosition,
  });

  return {
    configurationKey: key,
    format: params.format,
    solveType: params.solveType,
    seatCount: params.seatCount,
    anteType: params.anteType,
    anteBB: params.anteBB,
    stackBB: params.stackBB,
    position: params.position,
    scenario: params.scenario,
    openerPosition: params.openerPosition,
    data: { hands, available_actions: availableActions },
    source: 'reference',
    provider: 'demo-development-data',
    solverVersion: 'demo-v1',
    notes: `DEMO DATA — ${tier.description}. Temporary development range for UX testing.`,
    isEmpty: false,
  };
}

// ── Demo data provider ──
// Generates demo datasets on-demand for any preflop configuration.

export function findDemoDataset(params: {
  format: SolverFormat;
  solveType: 'chipev' | 'icm';
  seatCount: number;
  anteType: string;
  anteBB: number;
  stackBB: number;
  position: SolverPosition;
  scenario: string;
  openerPosition?: SolverPosition;
}): ReferenceDataset | null {
  // Only provide demo data for the default configuration
  if (params.format !== 'tournament' || params.solveType !== 'chipev' || params.seatCount !== 8) return null;
  if (params.anteType !== 'bb_ante' || params.anteBB !== 1 || params.stackBB !== 40) return null;

  // Only handle preflop scenarios we have tiers for
  if (!['unopened', 'facing_raise', 'facing_3bet', 'bb_defense'].includes(params.scenario)) return null;

  return buildDemoDataset({
    format: 'tournament',
    solveType: 'chipev',
    seatCount: 8,
    anteType: 'bb_ante',
    anteBB: 1,
    stackBB: 40,
    position: params.position,
    scenario: params.scenario as 'unopened' | 'facing_raise' | 'facing_3bet' | 'bb_defense',
    openerPosition: params.openerPosition,
  });
}
