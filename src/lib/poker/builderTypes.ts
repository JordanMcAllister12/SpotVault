import type { Street, ActionType, NormalizedHand, NormalizedPlayer, NormalizedAction, NormalizedBoard, NormalizedWinner } from '@/features/hh-replayer/types';

export type HandSource = 'imported' | 'manual' | 'scenario';

export interface BuilderPlayer {
  seat: number;
  name: string;
  position: string;
  stack: number | null;
  stackChips?: number | null;
  isSystemGenerated?: boolean;
  isHero: boolean;
  holeCards: string[] | null;
}

export interface BuilderAction {
  actionId: string;
  street: Street;
  player: string;
  position: string;
  type: BuilderActionType;
  amount?: number;
  isAllIn: boolean;
}

export type BuilderActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';

export interface BuilderBoard {
  flop: string[];
  turn: string | null;
  river: string | null;
}

export interface TableSetup {
  seatCount: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  anteType: 'none' | 'bb_ante' | 'per_player';
  gameFormat: 'cash' | 'tournament';
  blindLevel: string;
  heroPosition: string;
  source: HandSource;
  stackMode: 'bb' | 'chips';
  players: BuilderPlayer[];
  constructionMode?: 'simplified' | 'full';
  autoFoldPositions?: string[];
}

export interface PlayerState {
  name: string;
  seat: number;
  position: string;
  isHero: boolean;
  startingStack: number;
  currentStack: number;
  committedThisStreet: number;
  committedTotal: number;
  folded: boolean;
  allIn: boolean;
  holeCards: string[] | null;
  hasActedThisStreet: boolean;
}

export interface BuilderState {
  setup: TableSetup;
  players: PlayerState[];
  actions: BuilderAction[];
  board: BuilderBoard;
  street: Street;
  pot: number;
  centralPot: number;
  currentStreetBet: number;
  lastAggressor: string | null;
  currentActor: string | null;
  legalActions: BuilderActionType[];
  amountToCall: number;
  minRaise: number;
  isComplete: boolean;
  winners: NormalizedWinner[];
}

export const POSITIONS_ORDER = ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

const TABLE_POSITIONS: Record<number, string[]> = {
  2: ['SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  6: ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'BB+1'],
};

export function positionsForTable(seatCount: number): string[] {
  return TABLE_POSITIONS[Math.max(2, Math.min(9, seatCount))] ?? TABLE_POSITIONS[2];
}

export function firstToActPreflop(seatCountOrPositions: number | string[]): string {
  if (typeof seatCountOrPositions === 'number') {
    if (seatCountOrPositions === 2) return 'SB';
    return 'UTG';
  }

  const preflopOrder = ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  return preflopOrder.find(position => seatCountOrPositions.includes(position)) ?? seatCountOrPositions[0] ?? 'BB';
}

export function firstToActPostflop(activePositions: string[]): string {
  // Heads-up: the SB is the button, so postflop the BB acts first.
  if (activePositions.length === 2 && activePositions.includes('SB') && activePositions.includes('BB')) {
    return 'BB';
  }
  // Multiway: first active player clockwise from the button (SB, then BB, then UTG, …)
  const postflopOrder = ['SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN'];
  for (const pos of postflopOrder) {
    if (activePositions.includes(pos)) return pos;
  }
  return activePositions[0];
}

export function nextActor(currentActor: string, activePositions: string[]): string {
  const postflopOrder = ['SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN'];
  const idx = postflopOrder.indexOf(currentActor);
  for (let offset = 1; offset <= postflopOrder.length; offset++) {
    const candidate = postflopOrder[(idx + offset) % postflopOrder.length];
    if (activePositions.includes(candidate)) {
      return candidate;
    }
  }
  return currentActor;
}

export const CARD_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const CARD_SUITS = ['s', 'h', 'd', 'c'] as const;

export const SUIT_SYMBOLS: Record<string, string> = {
  s: '\u2660',
  h: '\u2665',
  d: '\u2666',
  c: '\u2663',
};

export const SUIT_COLORS: Record<string, string> = {
  s: '#cbd5e1',
  h: '#e04545',
  d: '#3b82f6',
  c: '#4ade80',
};

export function allCards(): string[] {
  const cards: string[] = [];
  for (const rank of CARD_RANKS) {
    for (const suit of CARD_SUITS) {
      cards.push(`${rank}${suit}`);
    }
  }
  return cards;
}

export function cardLabel(card: string): string {
  if (!card || card.length < 2) return '';
  const rank = card[0];
  const suit = card[1];
  return `${rank}${SUIT_SYMBOLS[suit] ?? suit}`;
}

export function cardColor(card: string): string {
  if (!card || card.length < 2) return '#cbd5e1';
  return SUIT_COLORS[card[1]] ?? '#cbd5e1';
}

export function generateActionId(): string {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateHandId(): string {
  return `SVH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export function playerNameForPosition(position: string, heroPosition: string): string {
  if (position === heroPosition) return 'Hero';
  return 'Opponent';
}
