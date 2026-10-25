export type RangeAction = {
  id: string;
  label: string;
  color: string;
};

export const DEFAULT_PREFLOP_ACTIONS: RangeAction[] = [
  { id: 'fold', label: 'Fold', color: '#3a3a3a' },
  { id: 'call', label: 'Call', color: '#2563eb' },
  { id: 'raise', label: 'Raise', color: '#16a34a' },
  { id: '3bet', label: '3-Bet', color: '#d4a52c' },
  { id: '4bet', label: '4-Bet', color: '#dc2626' },
  { id: 'jam', label: 'Jam', color: '#7c3aed' },
];

export const DEFAULT_POSTFLOP_ACTIONS: RangeAction[] = [
  { id: 'check', label: 'Check', color: '#3a3a3a' },
  { id: 'bet', label: 'Bet', color: '#16a34a' },
  { id: 'call', label: 'Call', color: '#2563eb' },
  { id: 'raise', label: 'Raise', color: '#d4a52c' },
  { id: 'fold', label: 'Fold', color: '#6b7280' },
];

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

export type HandClass = string;

export function getHandLabel(rowIdx: number, colIdx: number): string {
  const r1 = RANKS[rowIdx];
  const r2 = RANKS[colIdx];
  if (rowIdx === colIdx) return `${r1}${r2}`;
  if (rowIdx < colIdx) return `${r1}${r2}s`;
  return `${r2}${r1}o`;
}

export function getHandType(rowIdx: number, colIdx: number): 'pair' | 'suited' | 'offsuit' {
  if (rowIdx === colIdx) return 'pair';
  if (rowIdx < colIdx) return 'suited';
  return 'offsuit';
}

export function getComboCount(rowIdx: number, colIdx: number): number {
  const type = getHandType(rowIdx, colIdx);
  if (type === 'pair') return 6;
  if (type === 'suited') return 4;
  return 12;
}

export type RangeCellData = {
  actionId: string | null;
  frequency: number;
};

export type RangeGrid = Record<string, RangeCellData>;

export function emptyRangeGrid(): RangeGrid {
  const grid: RangeGrid = {};
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      grid[`${r}-${c}`] = { actionId: null, frequency: 0 };
    }
  }
  return grid;
}

export function countCombos(grid: RangeGrid): number {
  let total = 0;
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const cell = grid[`${r}-${c}`];
      if (cell.actionId) {
        total += getComboCount(r, c) * (cell.frequency / 100);
      }
    }
  }
  return Math.round(total);
}

export function countFilled(grid: RangeGrid): number {
  let count = 0;
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (grid[`${r}-${c}`].actionId) count++;
    }
  }
  return count;
}

export interface RangeLabConfig {
  mode: 'preflop_mines' | 'postflop' | 'combo_analysis' | 'multi_street' | 'range_comparison' | 'combo_sorting';
  effectiveStack: string;
  heroPosition: string;
  actionFacing: string;
  previousAction: string;
  availableActions: RangeAction[];
  referenceGrid: RangeGrid | null;
  explanation: string;
  boardCards: string;
  potSize: string;
  villainRange: string;
}

export const DEFAULT_CONFIG: RangeLabConfig = {
  mode: 'preflop_mines',
  effectiveStack: '',
  heroPosition: '',
  actionFacing: '',
  previousAction: '',
  availableActions: DEFAULT_PREFLOP_ACTIONS,
  referenceGrid: null,
  explanation: '',
  boardCards: '',
  potSize: '',
  villainRange: '',
};
