// ===== Solver Types =====
// Internal normalized types used across all solver providers.
// Providers (Mock, DeepSolver, etc.) translate to/from these shapes.

export type SolverGameType = 'nlhe';
export type SolverFormat = 'tournament' | 'cash';
export type SolverAccuracy = 'fast' | 'standard' | 'high';

export type SolverPosition = 'UTG' | 'UTG+1' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export type SolverActionType = 'check' | 'bet' | 'call' | 'raise' | 'fold' | 'all-in';

export interface SolverStreetAction {
  street: 'preflop' | 'flop' | 'turn' | 'river';
  position: SolverPosition;
  action: SolverActionType;
  amount_bb?: number;
  amount_pot_pct?: number;
}

export interface SolverTreeSettings {
  bet_sizes: string[];
  raise_sizes: string[];
  max_raises: number;
  donk_bet_allowed: boolean;
  all_in_sizing: string;
}

export interface SolverBoardCard {
  rank: string;
  suit: 'h' | 'd' | 'c' | 's';
}

// 169 hand cells (AA through 22, AKs, AKo, etc.)
export type HandCellId = string;

export interface RangeCell {
  hand: HandCellId;
  weight: number; // 0 = excluded, 1 = fully included, 0.5 = 50% mixed
}

export interface RangeData {
  cells: Record<HandCellId, number>; // hand -> weight 0..1
}

export interface SolverTableConfig {
  seat_count: number;
  sb_bb: number;
  bb_bb: number;
  ante_type: 'none' | 'bb_ante' | 'per_player';
  ante_bb: number;
}

export interface SolverConfig {
  game_type: SolverGameType;
  format: SolverFormat;
  hero_position: SolverPosition;
  villain_position: SolverPosition;
  effective_stack_bb: number;
  pot_size_bb: number;
  table_config: SolverTableConfig;
  board: SolverBoardCard[];
  action_history: SolverStreetAction[];
  hero_range: RangeData;
  villain_range: RangeData;
  tree_settings: SolverTreeSettings;
  accuracy: SolverAccuracy;
}

export type SolverJobStatus = 'draft' | 'processing' | 'complete' | 'failed';

export interface SolverJob {
  id: string;
  user_id: string;
  provider: string;
  provider_job_id: string | null;
  game_type: SolverGameType;
  format: SolverFormat;
  hero_position: SolverPosition;
  villain_position: SolverPosition;
  effective_stack_bb: number;
  pot_size_bb: number;
  table_config: SolverTableConfig;
  board: SolverBoardCard[];
  action_history: SolverStreetAction[];
  hero_range: RangeData;
  villain_range: RangeData;
  tree_settings: SolverTreeSettings;
  accuracy_setting: SolverAccuracy;
  status: SolverJobStatus;
  error_message: string | null;
  result_data: SolverResult | null;
  saved_to_library: boolean;
  is_favorite: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ===== Normalized Solver Result =====

export interface ActionFrequency {
  action: SolverActionType;
  label: string;
  frequency: number; // 0..1
  amount_bb?: number;
  amount_pot_pct?: number;
}

export interface HandStrategy {
  hand: HandCellId;
  frequencies: ActionFrequency[];
  ev_by_action: { action: SolverActionType; ev: number | null }[];
  equity: number | null; // 0..1, or null when not provided by solver
}

export interface SolverNode {
  id: string;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  board: SolverBoardCard[];
  pot_bb: number;
  player_to_act: SolverPosition;
  available_actions: ActionFrequency[];
  strategy_by_hand: HandStrategy[];
  aggregate_strategy: ActionFrequency[];
  children: SolverNode[];
  parent_id: string | null;
  action_to_here: SolverStreetAction[];
}

export type SolverDataSource = 'reference' | 'mock' | 'deepsolver';

export interface StrategyProvenance {
  source: SolverDataSource;
  provider: string;
  isMock: boolean;
  isReference: boolean;
  solverVersion: string;
  configurationKey: string;
}

export interface SolverResult {
  root_node: SolverNode;
  provider: string;
  is_mock: boolean;
  source: SolverDataSource;
  provenance?: StrategyProvenance;
}

// ===== Provider Interface =====

export interface SolverProvider {
  readonly name: string;
  readonly isMock: boolean;

  createTree(config: SolverConfig): Promise<{ treeId: string }>;
  submitSolve(config: SolverConfig, treeId: string): Promise<{ jobId: string }>;
  getSolveStatus(jobId: string): Promise<{ status: SolverJobStatus; progress?: string; error?: string }>;
  getSolveResult(jobId: string): Promise<SolverResult>;
  cancelSolve(jobId: string): Promise<void>;
}

// ===== Library Entry =====

export interface SolverLibraryEntry {
  id: string;
  user_id: string;
  solver_job_id: string | null;
  title: string;
  notes: string | null;
  tags: string[];
  category: string | null;
  config_snapshot: SolverConfig;
  result_reference: SolverResult | null;
  created_at: string;
}

// ===== Helpers =====

export const POSITIONS: SolverPosition[] = ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export const ACCURACY_OPTIONS: { value: SolverAccuracy; label: string; description: string }[] = [
  { value: 'fast', label: 'Fast', description: 'Quick estimate, lower precision' },
  { value: 'standard', label: 'Standard', description: 'Balanced speed and precision' },
  { value: 'high', label: 'High', description: 'Maximum precision, slower' },
];

export const BET_SIZE_PRESETS = ['20%', '25%', '33%', '50%', '66%', '75%', '100%', '125%', '150%', 'All-in'];

export const STACK_PRESETS = [10, 15, 20, 25, 30, 40, 50, 75, 100];

export const DEFAULT_TABLE_CONFIG: SolverTableConfig = {
  seat_count: 8,
  sb_bb: 0.5,
  bb_bb: 1,
  ante_type: 'bb_ante',
  ante_bb: 1,
};

export const ACTION_COLORS: Record<SolverActionType, string> = {
  fold: '#00aaff',
  check: '#7a8499',
  call: '#00ff7f',
  bet: '#e8a838',
  raise: '#ff0033',
  'all-in': '#cc1144',
};

export const SEAT_COUNTS = [2, 3, 4, 6, 7, 8, 9];

export const CARD_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const CARD_SUITS: ('h' | 'd' | 'c' | 's')[] = ['h', 'd', 'c', 's'];

export const SUIT_SYMBOLS: Record<string, string> = {
  h: '\u2665',
  d: '\u2666',
  c: '\u2663',
  s: '\u2660',
};

export const SUIT_COLORS: Record<string, string> = {
  h: '#e04545',
  d: '#3b82f6',
  c: '#4ade80',
  s: '#cbd5e1',
};

// Generate all 169 hand cell IDs
export const HAND_CELLS: HandCellId[] = (() => {
  const cells: HandCellId[] = [];
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const r1 = CARD_RANKS[i];
      const r2 = CARD_RANKS[j];
      if (i === j) {
        cells.push(`${r1}${r2}`);
      } else if (i < j) {
        cells.push(`${r1}${r2}s`);
      } else {
        cells.push(`${r2}${r1}o`);
      }
    }
  }
  return cells;
})();

export function emptyRange(): RangeData {
  const cells: Record<string, number> = {};
  for (const h of HAND_CELLS) cells[h] = 0;
  return { cells };
}

export function fullRange(): RangeData {
  const cells: Record<string, number> = {};
  for (const h of HAND_CELLS) cells[h] = 1;
  return { cells };
}

export function rangePercent(range: RangeData): number {
  const total = HAND_CELLS.length;
  const included = HAND_CELLS.reduce((sum, h) => sum + (range.cells[h] ?? 0), 0);
  return (included / total) * 100;
}

export function cardToId(card: SolverBoardCard): string {
  return `${card.rank}${card.suit}`;
}

export function cardLabel(card: SolverBoardCard): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function boardLabel(board: SolverBoardCard[]): string {
  return board.map(cardLabel).join(' ');
}

export function positionLabel(pos: SolverPosition): string {
  return pos;
}
