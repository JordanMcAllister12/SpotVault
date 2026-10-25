/**
 * Canonical solver hand-combination ordering.
 *
 * The solver provider requires ranges and strategy outputs as 1,326-element
 * vectors — one entry per two-card Hold'em combination. This module loads the
 * provider's canonical ordering from solver_hand_order.txt, validates it, and
 * exposes bidirectional conversion utilities between SpotVault's 169-cell
 * range representation (AA, AKs, AKo, …) and the 1,326-combo vector.
 *
 * DO NOT sort, regenerate, or rearrange the ordering — it is the provider's
 * canonical index mapping and must be preserved exactly as supplied.
 */

import rawHandOrder from './solver_hand_order.txt?raw';
import { HAND_CELLS, CARD_RANKS, CARD_SUITS } from './types';
import type { RangeData, HandCellId } from './types';

// ===== Parse the raw file into the canonical combo list =====

const CANONICAL_COMBOS: string[] = rawHandOrder
  .trim()
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

// ===== Validation =====

const VALID_RANKS = new Set(['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']);
const VALID_SUITS = new Set(['h', 'd', 'c', 's']);

function isValidCombo(combo: string): boolean {
  if (combo.length !== 4) return false;
  const r1 = combo[0];
  const s1 = combo[1];
  const r2 = combo[2];
  const s2 = combo[3];
  if (!VALID_RANKS.has(r1) || !VALID_RANKS.has(r2)) return false;
  if (!VALID_SUITS.has(s1) || !VALID_SUITS.has(s2)) return false;
  if (r1 === r2 && s1 === s2) return false; // same card twice
  return true;
}

function validateMapping(combos: string[]): void {
  if (combos.length !== 1326) {
    throw new Error(
      `Canonical hand order must have exactly 1326 entries, got ${combos.length}. ` +
      'Check src/lib/solver/solver_hand_order.txt.'
    );
  }

  const seen = new Set<string>();
  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i];
    if (!isValidCombo(combo)) {
      throw new Error(
        `Invalid combo "${combo}" at index ${i} in solver_hand_order.txt. ` +
        "Each entry must be a valid two-card Hold'em combination (e.g. \"AhKd\")."
      );
    }
    if (seen.has(combo)) {
      throw new Error(
        `Duplicate combo "${combo}" at index ${i} in solver_hand_order.txt. ` +
        'Each combination must appear exactly once.'
      );
    }
    seen.add(combo);
  }
}

validateMapping(CANONICAL_COMBOS);

export const TOTAL_SOLVER_COMBOS = 1326;

// ===== Combo → cell classification =====

/**
 * Classify a 4-char combo (e.g. "AhKd") into its 169-cell ID (e.g. "AKo").
 * Pairs → "AA", suited → "AKs", offsuit → "AKo".
 */
function comboToCellId(combo: string): HandCellId {
  const r1 = combo[0];
  const s1 = combo[1];
  const r2 = combo[2];
  const s2 = combo[3];

  const r1Idx = CARD_RANKS.indexOf(r1);
  const r2Idx = CARD_RANKS.indexOf(r2);

  if (r1Idx === r2Idx) {
    // Pair: e.g. "AhAd" → "AA"
    return `${r1}${r2}`;
  }

  const suited = s1 === s2;
  if (r1Idx < r2Idx) {
    // r1 is higher rank
    return suited ? `${r1}${r2}s` : `${r1}${r2}o`;
  } else {
    // r2 is higher rank
    return suited ? `${r2}${r1}s` : `${r2}${r1}o`;
  }
}

// ===== Build lookup tables =====

/**
 * Map from canonical combo string → index in the 1326-vector.
 */
export const COMBO_TO_INDEX: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < CANONICAL_COMBOS.length; i++) {
    map[CANONICAL_COMBOS[i]] = i;
  }
  return map;
})();

/**
 * Map from 169-cell ID → array of indices in the 1326-vector.
 * e.g. "AKs" → [indices of AhKh, AhKd→no, ...] (the 4 suited combos)
 */
const CELL_TO_COMBO_INDICES: Record<HandCellId, number[]> = (() => {
  const map: Record<string, number[]> = {};
  for (const cell of HAND_CELLS) map[cell] = [];

  for (let i = 0; i < CANONICAL_COMBOS.length; i++) {
    const cellId = comboToCellId(CANONICAL_COMBOS[i]);
    if (!map[cellId]) {
      throw new Error(`Combo "${CANONICAL_COMBOS[i]}" classified to unknown cell "${cellId}".`);
    }
    map[cellId].push(i);
  }

  // Verify each cell has the expected combo count
  for (const cell of HAND_CELLS) {
    const expected = cell.length === 2 ? 6 : cell[2] === 's' ? 4 : 12;
    if (map[cell].length !== expected) {
      throw new Error(
        `Cell "${cell}" has ${map[cell].length} combos in the canonical order, expected ${expected}.`
      );
    }
  }

  return map;
})();

// ===== Public conversion API =====

/**
 * Convert a SpotVault 169-cell range into the solver's 1326-element vector.
 *
 * Each cell weight (0..1) is applied uniformly to all combos belonging to
 * that cell. For example, if "AKs" has weight 0.5, all 4 suited AK combos
 * get value 0.5 in the output vector.
 *
 * Returns a Float64Array of length 1326 for efficient transfer to the solver.
 */
export function rangeToSolverVector(range: RangeData): Float64Array {
  const vector = new Float64Array(TOTAL_SOLVER_COMBOS);

  for (const cell of HAND_CELLS) {
    const weight = range.cells[cell] ?? 0;
    if (weight === 0) continue;

    const indices = CELL_TO_COMBO_INDICES[cell];
    for (const idx of indices) {
      vector[idx] = weight;
    }
  }

  return vector;
}

/**
 * Convert a 1326-element solver output vector back into SpotVault's 169-cell
 * range representation.
 *
 * For each cell, the weight is the average of all combo values belonging to
 * that cell. This handles partial frequencies (e.g. a solver that includes
 * 2 of 4 suited combos at full weight → cell weight 0.5).
 */
export function solverVectorToRange(vector: ArrayLike<number>): RangeData {
  if (vector.length !== TOTAL_SOLVER_COMBOS) {
    throw new Error(
      `Solver vector must have ${TOTAL_SOLVER_COMBOS} elements, got ${vector.length}.`
    );
  }

  const cells: Record<string, number> = {};

  for (const cell of HAND_CELLS) {
    const indices = CELL_TO_COMBO_INDICES[cell];
    let sum = 0;
    for (const idx of indices) {
      sum += vector[idx];
    }
    cells[cell] = sum / indices.length;
  }

  return { cells };
}

/**
 * Get the canonical combo string at a given index (0-based).
 */
export function getComboAt(index: number): string {
  if (index < 0 || index >= TOTAL_SOLVER_COMBOS) {
    throw new Error(`Combo index ${index} out of range [0, ${TOTAL_SOLVER_COMBOS}).`);
  }
  return CANONICAL_COMBOS[index];
}

/**
 * Get the canonical index of a specific combo string.
 * Returns -1 if the combo is not in the canonical ordering.
 */
export function getIndexOf(combo: string): number {
  return COMBO_TO_INDEX[combo] ?? -1;
}

/**
 * Get all combo indices belonging to a 169-cell ID.
 */
export function getComboIndicesForCell(cell: HandCellId): number[] {
  return CELL_TO_COMBO_INDICES[cell] ?? [];
}

/**
 * The full canonical combo list (read-only). Use getComboAt() for indexed access.
 */
export const CANONICAL_HAND_ORDER: readonly string[] = CANONICAL_COMBOS;
