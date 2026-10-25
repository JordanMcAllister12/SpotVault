export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type ActionType =
  | 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'
  | 'post_sb' | 'post_bb' | 'post_ante'
  | 'collect' | 'show' | 'muck' | 'win' | 'uncalled_return';

export type RevealMode = 'show_from_start' | 'reveal_at_showdown' | 'do_not_reveal';

export interface NormalizedPlayer {
  seat: number;
  name: string;
  stack: number;
  position?: string;
  isHero: boolean;
  holeCards?: string[];
  showdownCards?: string[];
  showdownAction?: 'show' | 'muck';
  revealMode?: RevealMode;
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
  blindLevel?: string;
  heroNetResult?: number | null;
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
