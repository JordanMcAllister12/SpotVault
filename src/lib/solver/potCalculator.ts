import type { SolverStreetAction, SolverPosition, SolverBoardCard, SolverTableConfig } from './types';
import { POSITIONS } from './types';

export interface PotCalcResult {
  pot_bb: number;
  remaining_stacks: Partial<Record<SolverPosition, number>>;
  player_to_act: SolverPosition | null;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  is_hand_over: boolean;
  active_positions: SolverPosition[];
  folded_positions: SolverPosition[];
  participants: SolverPosition[];
}

export function positionsForTable(seatCount: number): SolverPosition[] {
  if (seatCount === 2) return ['SB', 'BB'];
  return POSITIONS.slice(0, seatCount);
}

export function firstToActPreflop(seatCount: number): SolverPosition {
  if (seatCount === 2) return 'SB';
  return 'UTG';
}

export function firstToActPostflop(participants: SolverPosition[]): SolverPosition {
  const order = POSITIONS;
  for (const pos of order) {
    if (participants.includes(pos)) return pos;
  }
  return participants[0];
}

export function nextActor(
  currentActor: SolverPosition,
  activePositions: SolverPosition[],
): SolverPosition {
  const order = POSITIONS;
  const idx = order.indexOf(currentActor);
  for (let offset = 1; offset <= order.length; offset++) {
    const candidate = order[(idx + offset) % order.length];
    if (activePositions.includes(candidate)) {
      return candidate;
    }
  }
  return currentActor;
}

export function potBeforeAction(tableConfig: SolverTableConfig): number {
  let pot = tableConfig.sb_bb + tableConfig.bb_bb;
  if (tableConfig.ante_type === 'bb_ante') {
    pot += tableConfig.ante_bb;
  } else if (tableConfig.ante_type === 'per_player') {
    pot += tableConfig.ante_bb * tableConfig.seat_count;
  }
  return Math.round(pot * 100) / 100;
}

export function calculatePot(
  effectiveStackBB: number,
  tableConfig: SolverTableConfig,
  actions: SolverStreetAction[],
  board: SolverBoardCard[],
): PotCalcResult {
  const allPositions = positionsForTable(tableConfig.seat_count);
  const stacks: Record<string, number> = {};
  for (const pos of allPositions) {
    stacks[pos] = effectiveStackBB;
  }

  let pot = potBeforeAction(tableConfig);

  // Deduct blinds from stacks
  if (allPositions.includes('SB')) {
    stacks['SB'] -= tableConfig.sb_bb;
  }
  if (allPositions.includes('BB')) {
    stacks['BB'] -= tableConfig.bb_bb;
  }
  // Deduct ante from stacks
  if (tableConfig.ante_type === 'bb_ante' && allPositions.includes('BB')) {
    stacks['BB'] -= tableConfig.ante_bb;
  } else if (tableConfig.ante_type === 'per_player') {
    for (const pos of allPositions) {
      stacks[pos] -= tableConfig.ante_bb;
    }
  }

  const foldedPositions = new Set<SolverPosition>();
  const allInPositions = new Set<SolverPosition>();

  let currentStreet: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
  let lastAggressor: SolverPosition | null = null;
  void lastAggressor;
  let lastBetAmount = tableConfig.bb_bb;

  let currentActor: SolverPosition | null = firstToActPreflop(tableConfig.seat_count);

  for (const action of actions) {
    if (action.street !== currentStreet) {
      currentStreet = action.street;
      lastAggressor = null;
      lastBetAmount = 0;
      const remaining = allPositions.filter(p => !foldedPositions.has(p) && !allInPositions.has(p));
      if (remaining.length > 1) {
        currentActor = firstToActPostflop(remaining);
      }
    }

    const actor = action.position;
    const actorStack = stacks[actor] ?? effectiveStackBB;

    if (action.action === 'fold') {
      foldedPositions.add(actor);
    } else if (action.action === 'check') {
      // No pot change
    } else if (action.action === 'call') {
      const callAmount = lastBetAmount;
      const actualCall = Math.min(callAmount, actorStack);
      stacks[actor] = Math.max(0, stacks[actor] - actualCall);
      pot += actualCall;
      if (stacks[actor] <= 0) allInPositions.add(actor);
    } else if (action.action === 'bet' || action.action === 'raise') {
      let betAmount: number;
      if (action.amount_bb !== undefined) {
        betAmount = action.amount_bb;
      } else if (action.amount_pot_pct !== undefined) {
        betAmount = pot * (action.amount_pot_pct / 100);
      } else {
        betAmount = 0;
      }
      const actualBet = Math.min(betAmount, actorStack);
      stacks[actor] = Math.max(0, stacks[actor] - actualBet);
      pot += actualBet;
      lastBetAmount = actualBet;
      lastAggressor = actor;
      if (stacks[actor] <= 0) allInPositions.add(actor);
    } else if (action.action === 'all-in') {
      const actualBet = actorStack;
      stacks[actor] = 0;
      pot += actualBet;
      lastBetAmount = Math.max(actualBet, lastBetAmount);
      lastAggressor = actor;
      allInPositions.add(actor);
    }

    const remaining = allPositions.filter(p => !foldedPositions.has(p) && !allInPositions.has(p));
    if (remaining.length <= 1) {
      currentActor = remaining[0] ?? null;
    } else {
      currentActor = nextActor(actor, remaining);
    }
  }

  let street: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
  if (board.length >= 5) street = 'river';
  else if (board.length === 4) street = 'turn';
  else if (board.length === 3) street = 'flop';
  if (actions.length > 0) {
    street = actions[actions.length - 1].street;
  }

  const participants = allPositions.filter(p => !foldedPositions.has(p));
  const isHandOver = participants.length <= 1;

  const remainingStacks: Partial<Record<SolverPosition, number>> = {};
  for (const pos of allPositions) {
    remainingStacks[pos] = Math.max(0, stacks[pos] ?? effectiveStackBB);
  }

  return {
    pot_bb: Math.round(pot * 100) / 100,
    remaining_stacks: remainingStacks,
    player_to_act: currentActor,
    street,
    is_hand_over: isHandOver,
    active_positions: allPositions,
    folded_positions: [...foldedPositions],
    participants,
  };
}

export function formatActionLabel(action: SolverStreetAction): string {
  const pos = action.position;
  switch (action.action) {
    case 'fold':
      return `${pos} folds`;
    case 'check':
      return `${pos} checks`;
    case 'call':
      return `${pos} calls`;
    case 'bet': {
      const amt = action.amount_bb !== undefined
        ? `${action.amount_bb}BB`
        : action.amount_pot_pct !== undefined
          ? `${action.amount_pot_pct}% pot`
          : '';
      return `${pos} bets ${amt}`;
    }
    case 'raise': {
      const amt = action.amount_bb !== undefined
        ? `${action.amount_bb}BB`
        : action.amount_pot_pct !== undefined
          ? `${action.amount_pot_pct}% pot`
          : '';
      return `${pos} raises ${amt}`;
    }
    case 'all-in':
      return `${pos} all-in`;
    default:
      return `${pos} ${action.action}`;
  }
}

export function formatActionShort(action: SolverStreetAction): string {
  const pos = action.position;
  switch (action.action) {
    case 'fold': return `${pos} F`;
    case 'check': return `${pos} X`;
    case 'call': return `${pos} Call`;
    case 'bet': return `${pos} B${action.amount_bb ?? action.amount_pot_pct + '%'}`;
    case 'raise': return `${pos} R${action.amount_bb ?? action.amount_pot_pct + '%'}`;
    case 'all-in': return `${pos} AI`;
    default: return `${pos} ${action.action}`;
  }
}

export function streetLabel(street: 'preflop' | 'flop' | 'turn' | 'river'): string {
  return street.charAt(0).toUpperCase() + street.slice(1);
}
