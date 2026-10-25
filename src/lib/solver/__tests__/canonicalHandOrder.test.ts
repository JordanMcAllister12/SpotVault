import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_HAND_ORDER,
  TOTAL_SOLVER_COMBOS,
  COMBO_TO_INDEX,
  rangeToSolverVector,
  solverVectorToRange,
  getComboAt,
  getIndexOf,
  getComboIndicesForCell,
} from '@/lib/solver/canonicalHandOrder';
import { HAND_CELLS, emptyRange, fullRange } from '@/lib/solver/types';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the edge function's embedded copy for cross-environment comparison
const edgeHandOrderPath = resolve(__dirname, '../../../supabase/functions/deepsolver-solve/handOrder.ts');
const edgeSource = readFileSync(edgeHandOrderPath, 'utf-8');

// Extract the array entries from the edge function source
const edgeComboMatch = edgeSource.match(/export const CANONICAL_COMBOS[^[]*=\s*\[([\s\S]*?)\];/);
const edgeCombos: string[] = edgeComboMatch
  ? edgeComboMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/["']/g, ''))
      .filter((s) => s.length > 0)
  : [];

describe('Canonical hand order — structural validation', () => {
  it('has exactly 1326 entries', () => {
    expect(CANONICAL_HAND_ORDER.length).toBe(TOTAL_SOLVER_COMBOS);
    expect(TOTAL_SOLVER_COMBOS).toBe(1326);
  });

  it('has no duplicate combos', () => {
    const seen = new Set<string>();
    for (const combo of CANONICAL_HAND_ORDER) {
      expect(seen.has(combo)).toBe(false);
      seen.add(combo);
    }
    expect(seen.size).toBe(1326);
  });

  it("every entry is a valid two-card Hold'em combination", () => {
    const validRanks = new Set(['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']);
    const validSuits = new Set(['h', 'd', 'c', 's']);
    for (let i = 0; i < CANONICAL_HAND_ORDER.length; i++) {
      const combo = CANONICAL_HAND_ORDER[i];
      expect(combo.length).toBe(4);
      expect(validRanks.has(combo[0])).toBe(true);
      expect(validRanks.has(combo[2])).toBe(true);
      expect(validSuits.has(combo[1])).toBe(true);
      expect(validSuits.has(combo[3])).toBe(true);
      // Not the same card twice
      expect(combo[0] === combo[2] && combo[1] === combo[3]).toBe(false);
    }
  });

  it('COMBO_TO_INDEX is consistent with CANONICAL_HAND_ORDER', () => {
    for (let i = 0; i < CANONICAL_HAND_ORDER.length; i++) {
      expect(COMBO_TO_INDEX[CANONICAL_HAND_ORDER[i]]).toBe(i);
    }
  });

  it('getComboAt and getIndexOf are inverse operations', () => {
    for (let i = 0; i < 1326; i++) {
      const combo = getComboAt(i);
      expect(getIndexOf(combo)).toBe(i);
    }
  });
});

describe('Canonical hand order — 169-cell expansion', () => {
  it('every 169-cell maps to the correct combo count', () => {
    for (const cell of HAND_CELLS) {
      const indices = getComboIndicesForCell(cell);
      const expected = cell.length === 2 ? 6 : cell[2] === 's' ? 4 : 12;
      expect(indices.length).toBe(expected);
    }
  });

  it('all 169 cells cover all 1326 combos with no overlap', () => {
    const allIndices: number[] = [];
    for (const cell of HAND_CELLS) {
      allIndices.push(...getComboIndicesForCell(cell));
    }
    expect(allIndices.length).toBe(1326);
    expect(new Set(allIndices).size).toBe(1326);
  });
});

describe('Canonical hand order — range conversion round-trip', () => {
  it('full range converts to all-1s and back', () => {
    const range = fullRange();
    const vector = rangeToSolverVector(range);
    expect(vector.length).toBe(1326);
    for (let i = 0; i < 1326; i++) {
      expect(vector[i]).toBe(1);
    }
    const back = solverVectorToRange(vector);
    for (const cell of HAND_CELLS) {
      expect(back.cells[cell]).toBeCloseTo(1, 10);
    }
  });

  it('empty range converts to all-0s and back', () => {
    const range = emptyRange();
    const vector = rangeToSolverVector(range);
    expect(vector.length).toBe(1326);
    for (let i = 0; i < 1326; i++) {
      expect(vector[i]).toBe(0);
    }
    const back = solverVectorToRange(vector);
    for (const cell of HAND_CELLS) {
      expect(back.cells[cell]).toBe(0);
    }
  });

  it('partial range preserves weights through round-trip', () => {
    const range = emptyRange();
    range.cells['AKs'] = 0.5;
    range.cells['QQ'] = 0.75;
    range.cells['72o'] = 0.25;

    const vector = rangeToSolverVector(range);
    const back = solverVectorToRange(vector);

    expect(back.cells['AKs']).toBeCloseTo(0.5, 10);
    expect(back.cells['QQ']).toBeCloseTo(0.75, 10);
    expect(back.cells['72o']).toBeCloseTo(0.25, 10);
    // Cells not set should be 0
    expect(back.cells['AA']).toBe(0);
    expect(back.cells['KQo']).toBe(0);
  });
});

describe('Canonical hand order — frontend/edge-function parity', () => {
  it('edge function file has exactly 1326 embedded combos', () => {
    expect(edgeCombos.length).toBe(1326);
  });

  it('frontend and edge function copies are entry-for-entry identical', () => {
    expect(edgeCombos.length).toBe(CANONICAL_HAND_ORDER.length);

    for (let i = 0; i < CANONICAL_HAND_ORDER.length; i++) {
      expect(
        edgeCombos[i],
        `Mismatch at index ${i}: frontend="${CANONICAL_HAND_ORDER[i]}" edge="${edgeCombos[i]}"`
      ).toBe(CANONICAL_HAND_ORDER[i]);
    }
  });
});
