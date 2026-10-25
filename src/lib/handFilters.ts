import type { ClassifiedHand, HandRecord } from './handSorter';

export type PotTypeFilter = 'all' | '3bet' | 'srp';
export type ResultFilter = 'all' | 'big_win' | 'big_loss' | 'allin' | 'showdown';
export type DecisionFilter = 'all' | 'river' | 'showdown' | 'facing_allin' | 'blind_defense' | 'steal';
export type PositionFilter = 'all' | 'ep' | 'mp' | 'co' | 'btn' | 'sb' | 'bb';
export type SortMode = 'recent' | 'oldest' | 'biggest_win' | 'biggest_loss' | 'largest_pot' | 'largest_abs';

export interface HandFilterState {
  potType: PotTypeFilter;
  result: ResultFilter;
  decision: DecisionFilter;
  position: PositionFilter;
  bbThreshold: number;
}

export const DEFAULT_HAND_FILTERS: HandFilterState = {
  potType: 'all',
  result: 'all',
  decision: 'all',
  position: 'all',
  bbThreshold: 3,
};

export const BB_THRESHOLDS = [3, 5, 10, 20] as const;

const EP_POSITIONS = new Set(['UTG', 'UTG+1', 'LJ']);
const MP_POSITIONS = new Set(['HJ', 'MP']);
const STEAL_POSITIONS = new Set(['CO', 'BTN', 'SB']);

export interface RichHand extends HandRecord {
  is3betPot: boolean;
  isSRP: boolean;
  isAllIn: boolean;
  isShowdown: boolean;
  isRiverDecision: boolean;
  isFacingAllIn: boolean;
  isBlindDefense: boolean;
  isStealAttempt: boolean;
  absResultBB: number;
  potBB: number | null;
}

export function enrichHand(
  hand: HandRecord & { source?: string; normalizedHand?: unknown },
  classified: ClassifiedHand | undefined,
): RichHand {
  const netResult = hand.net_result ?? 0;
  const isAllIn = classified?.allIn ?? false;
  const isBlindDefense = classified?.blindDefense ?? false;
  const isShowdown = hand.showdown ?? false;
  const isRiverDecision = hand.saw_river ?? false;
  const isFacingAllIn = classified?.allInType === 'hero_faced_allin' || classified?.allInType === 'hero_called_allin';

  const pos = hand.position ?? '';
  const isStealAttempt = STEAL_POSITIONS.has(pos) && (classified?.pfr ?? false);

  const pfRaiseCount = classified?.threeBet ? 2 : classified?.pfr ? 1 : 0;
  const is3betPot = pfRaiseCount >= 2 || classified?.faced3bet === true;
  const isSRP = pfRaiseCount === 1 && !classified?.faced3bet;

  const potAmount = hand.pot_amount ?? null;
  const potBB = potAmount && potAmount > 0 ? potAmount : null;

  return {
    ...hand,
    is3betPot,
    isSRP,
    isAllIn,
    isShowdown,
    isRiverDecision,
    isFacingAllIn,
    isBlindDefense,
    isStealAttempt,
    absResultBB: Math.abs(netResult),
    potBB,
  };
}

export function matchesFilters(h: RichHand, f: HandFilterState): boolean {
  if (f.potType === '3bet' && !h.is3betPot) return false;
  if (f.potType === 'srp' && !h.isSRP) return false;

  if (f.result === 'big_win' && !((h.net_result ?? 0) > f.bbThreshold)) return false;
  if (f.result === 'big_loss' && !((h.net_result ?? 0) < -f.bbThreshold)) return false;
  if (f.result === 'allin' && !h.isAllIn) return false;
  if (f.result === 'showdown' && !h.isShowdown) return false;

  if (f.decision === 'river' && !h.isRiverDecision) return false;
  if (f.decision === 'showdown' && !h.isShowdown) return false;
  if (f.decision === 'facing_allin' && !h.isFacingAllIn) return false;
  if (f.decision === 'blind_defense' && !h.isBlindDefense) return false;
  if (f.decision === 'steal' && !h.isStealAttempt) return false;

  if (f.position !== 'all') {
    const pos = h.position ?? '';
    if (f.position === 'ep' && !EP_POSITIONS.has(pos)) return false;
    if (f.position === 'mp' && !MP_POSITIONS.has(pos)) return false;
    if (f.position === 'co' && pos !== 'CO') return false;
    if (f.position === 'btn' && pos !== 'BTN') return false;
    if (f.position === 'sb' && pos !== 'SB') return false;
    if (f.position === 'bb' && pos !== 'BB') return false;
  }

  return true;
}

export function isInterestingHand(h: RichHand, threshold: number): boolean {
  return (
    (h.net_result ?? 0) > threshold ||
    (h.net_result ?? 0) < -threshold ||
    h.isAllIn ||
    h.is3betPot
  );
}

export function sortHands<T extends HandRecord & { source?: string }>(
  hands: T[],
  mode: SortMode,
): T[] {
  const sorted = [...hands];
  switch (mode) {
    case 'recent':
      return sorted.sort((a, b) => (b.played_at ?? '').localeCompare(a.played_at ?? ''));
    case 'oldest':
      return sorted.sort((a, b) => (a.played_at ?? '').localeCompare(b.played_at ?? ''));
    case 'biggest_win':
      return sorted.sort((a, b) => (b.net_result ?? 0) - (a.net_result ?? 0));
    case 'biggest_loss':
      return sorted.sort((a, b) => (a.net_result ?? 0) - (b.net_result ?? 0));
    case 'largest_pot':
      return sorted.sort((a, b) => (b.pot_amount ?? 0) - (a.pot_amount ?? 0));
    case 'largest_abs':
      return sorted.sort((a, b) => Math.abs(b.net_result ?? 0) - Math.abs(a.net_result ?? 0));
    default:
      return sorted;
  }
}

export function hasActiveFilters(f: HandFilterState): boolean {
  return f.potType !== 'all' || f.result !== 'all' || f.decision !== 'all' || f.position !== 'all';
}
