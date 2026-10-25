/**
 * Frontend adapter: converts SpotVault ranges to/from the solver provider's
 * canonical 1326-combo vector using the centralized mapping in canonicalHandOrder.ts.
 *
 * This replaces the previous stub that threw "NOT CONFIGURED".
 */

import type { RangeData } from './types';
import { rangeToSolverVector } from './canonicalHandOrder';

export const DEEPSOLVER_HAND_ORDER_CONFIGURED = true;

/**
 * Convert a SpotVault range (169 cells with weights 0..1) into the solver's
 * 1326-element vector. Each cell's weight is applied to all combos in that cell.
 */
export function toDeepSolverRange(range: RangeData): number[] {
  return Array.from(rangeToSolverVector(range));
}
