/**
 * Reference Range Import System
 *
 * Supports multiple import formats:
 * - JSON (full combo-level or 169-hand level)
 * - Simple text (e.g., "AA raise_2.2 100")
 *
 * All imports validate, expand to combo level, and save via referenceRangeLibrary.
 */

import {
  expand169ToCombos,
  validateComboStrategy,
  validate169Strategy,
  saveReferenceRange,
  computeNodeHash,
  type ReferenceNodeIdentity,
  type AvailableAction,
  type ImportResult,
  type StructuredAction,
} from './referenceRangeLibrary';
import { HAND_CELLS } from './types';
import type { SolverFormat, SolverPosition } from './types';

// ===== JSON Import Format =====

export interface JsonImportPayload {
  identity: {
    format: SolverFormat;
    solve_type: 'chipev' | 'icm';
    table_size: number;
    stack_bb: number;
    ante_type: 'none' | 'bb_ante' | 'per_player';
    ante_bb: number;
    hero_position: SolverPosition;
    action_history: StructuredAction[];
  };
  available_actions: AvailableAction[];
  // Either combo-level or hand-level strategy
  strategy_data?: Record<string, Record<string, number>>; // combo-level
  hands?: Record<string, { action: string; frequency: number }[]>; // 169-level
  is_partial?: boolean;
  source_name?: string;
  source_version?: string;
  notes?: string;
  description?: string;
  on_duplicate?: 'new_version' | 'replace_active' | 'cancel';
}

export async function importFromJson(payload: JsonImportPayload): Promise<ImportResult> {
  const warnings: string[] = [];

  // Validate identity
  const id = payload.identity;
  if (!id.format || !id.solve_type || !id.hero_position) {
    return { success: false, error: 'Missing required identity fields', warnings };
  }
  if (typeof id.table_size !== 'number' || typeof id.stack_bb !== 'number') {
    return { success: false, error: 'table_size and stack_bb must be numbers', warnings };
  }
  if (!Array.isArray(id.action_history)) {
    return { success: false, error: 'action_history must be an array', warnings };
  }
  if (!Array.isArray(payload.available_actions) || payload.available_actions.length === 0) {
    return { success: false, error: 'available_actions must be a non-empty array', warnings };
  }

  let strategyData: Record<string, Record<string, number>>;
  let isPartial: boolean;

  if (payload.strategy_data && Object.keys(payload.strategy_data).length > 0) {
    // Combo-level import
    const validation = validateComboStrategy(payload.strategy_data, payload.available_actions);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join('; '), warnings: [...warnings, ...validation.warnings] };
    }
    strategyData = payload.strategy_data;
    isPartial = payload.is_partial ?? validation.is_partial;
    warnings.push(...validation.warnings);
  } else if (payload.hands && Object.keys(payload.hands).length > 0) {
    // 169-hand-level import — expand to combos
    const validation = validate169Strategy(payload.hands, payload.available_actions);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join('; '), warnings: [...warnings, ...validation.warnings] };
    }
    strategyData = expand169ToCombos(payload.hands);
    isPartial = payload.is_partial ?? validation.is_partial;
    warnings.push(...validation.warnings);
  } else {
    return { success: false, error: 'No strategy data found — provide either strategy_data (combo-level) or hands (169-level)', warnings };
  }

  const identity: ReferenceNodeIdentity = {
    format: id.format,
    solve_type: id.solve_type,
    table_size: id.table_size,
    stack_bb: id.stack_bb,
    ante_type: id.ante_type,
    ante_bb: id.ante_bb,
    hero_position: id.hero_position,
    action_history: id.action_history,
  };

  return saveReferenceRange({
    identity,
    available_actions: payload.available_actions,
    strategy_data: strategyData,
    is_partial: isPartial,
    source_name: payload.source_name ?? 'json-import',
    source_version: payload.source_version,
    notes: payload.notes,
    description: payload.description,
    on_duplicate: payload.on_duplicate ?? 'new_version',
  });
}

// ===== Simple Text Import =====
// Format: one hand per line, followed by action/frequency pairs
// Examples:
//   AA raise_2.2 100
//   AKs raise_2.2 95 all-in 5
//   A5s raise_2.2 30 fold 70
//   72o fold 100

export interface TextImportConfig {
  identity: ReferenceNodeIdentity;
  available_actions: AvailableAction[];
  source_name?: string;
  source_version?: string;
  notes?: string;
  on_duplicate?: 'new_version' | 'replace_active' | 'cancel';
}

export async function importFromText(text: string, config: TextImportConfig): Promise<ImportResult> {
  const warnings: string[] = [];
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) {
    return { success: false, error: 'No data lines found', warnings };
  }

  const handStrategy: Record<string, { action: string; frequency: number }[]> = {};
  const validCells = new Set(HAND_CELLS);

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/);
    if (parts.length < 2) {
      warnings.push(`Line ${i + 1}: not enough tokens, skipping`);
      continue;
    }

    const hand = parts[0];
    if (!validCells.has(hand)) {
      warnings.push(`Line ${i + 1}: invalid hand "${hand}", skipping`);
      continue;
    }

    const freqs: { action: string; frequency: number }[] = [];
    let total = 0;

    // Parse action/frequency pairs
    for (let j = 1; j < parts.length; j += 2) {
      const action = parts[j];
      const freqStr = parts[j + 1];
      if (!action || !freqStr) {
        warnings.push(`Line ${i + 1}: missing action or frequency for "${hand}"`);
        continue;
      }

      let freq = parseFloat(freqStr);
      if (isNaN(freq)) {
        warnings.push(`Line ${i + 1}: invalid frequency "${freqStr}" for ${hand}/${action}`);
        continue;
      }

      // Normalize 0-100 scale to 0-1 if needed
      if (freq > 1) {
        freq = freq / 100;
      }

      freq = Math.max(0, Math.min(1, freq));
      freqs.push({ action, frequency: freq });
      total += freq;
    }

    if (freqs.length === 0) {
      freqs.push({ action: 'fold', frequency: 1.0 });
    } else if (Math.abs(total - 1.0) > 0.05) {
      warnings.push(`${hand}: frequencies sum to ${total.toFixed(3)}, expected ~1.0`);
    }

    handStrategy[hand] = freqs;
  }

  if (Object.keys(handStrategy).length === 0) {
    return { success: false, error: 'No valid hands parsed', warnings };
  }

  // Validate and expand
  const validation = validate169Strategy(handStrategy, config.available_actions);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; '), warnings: [...warnings, ...validation.warnings] };
  }

  const strategyData = expand169ToCombos(handStrategy);

  return saveReferenceRange({
    identity: config.identity,
    available_actions: config.available_actions,
    strategy_data: strategyData,
    is_partial: validation.is_partial,
    source_name: config.source_name ?? 'text-import',
    source_version: config.source_version,
    notes: config.notes,
    on_duplicate: config.on_duplicate ?? 'new_version',
  });
}

// ===== Node Hash Export (for debugging/verification) =====

export async function getIdentityHash(identity: ReferenceNodeIdentity): Promise<string> {
  return computeNodeHash(identity);
}
