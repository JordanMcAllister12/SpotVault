/**
 * Normalized hand interface — the single contract the HHReplayer accepts.
 * Any poker site or database schema can be adapted into this shape.
 */

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type ActionType =
  | 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'
  | 'post_sb' | 'post_bb' | 'post_ante'
  | 'collect' | 'show' | 'muck' | 'win';

export interface NormalizedPlayer {
  seat: number;
  name: string;
  stack: number;
  position?: string;
  isHero: boolean;
  holeCards?: string[];
}

export interface NormalizedAction {
  index: number;
  street: Street;
  player: string;
  type: ActionType;
  amount?: number;
}

export interface NormalizedBoard {
  flop: string[];
  turn: string | null;
  river: string | null;
}

export interface NormalizedWinner {
  player: string;
  amount: number;
}

export interface NormalizedHand {
  handId: string;
  site: string;
  gameType: string;
  stakes: string;
  date: string;
  tableName: string;
  buttonSeat: number;
  heroName: string;
  players: NormalizedPlayer[];
  actions: NormalizedAction[];
  board: NormalizedBoard;
  pot: number;
  rake: number;
  winners: NormalizedWinner[];
  rawText: string;
  title?: string;
}

export const EMPTY_NORMALIZED_HAND: NormalizedHand = {
  handId: '',
  site: 'unknown',
  gameType: "Hold'em",
  stakes: '',
  date: '',
  tableName: '',
  buttonSeat: 0,
  heroName: '',
  players: Array.from({ length: 8 }, (_, i) => ({
    seat: i + 1,
    name: '',
    stack: 0,
    isHero: false,
  })),
  actions: [],
  board: { flop: [], turn: null, river: null },
  pot: 0,
  rake: 0,
  winners: [],
  rawText: '',
};
