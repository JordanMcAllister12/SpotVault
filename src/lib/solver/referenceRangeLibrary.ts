/**
 * Preflop Reference Range Library
 *
 * Storage and retrieval system for curated preflop strategies.
 * Stores combo-level action frequencies keyed by exact node identity.
 * Designed to feed DeepSolver postflop solves with exact weighted ranges.
 */

import { supabase } from '@/lib/supabase';
import { CANONICAL_HAND_ORDER, getComboIndicesForCell, COMBO_TO_INDEX } from './canonicalHandOrder';
import { HAND_CELLS, CARD_RANKS } from './types';
import type { SolverPosition, SolverFormat } from './types';

// ===== Types =====

export interface StructuredAction {
  position: string;
  action: string;
  size_bb?: number;
}

export interface ReferenceNodeIdentity {
  format: SolverFormat;
  solve_type: 'chipev' | 'icm';
  table_size: number;
  stack_bb: number;
  ante_type: 'none' | 'bb_ante' | 'per_player';
  ante_bb: number;
  hero_position: SolverPosition;
  action_history: StructuredAction[];
}

export interface AvailableAction {
  action: string;
  label: string;
}

export interface ReferenceRangeRecord {
  id: string;
  node_id: string;
  version: number;
  is_active: boolean;
  is_partial: boolean;
  available_actions: AvailableAction[];
  strategy_data: Record<string, Record<string, number>>;
  source_name: string;
  source_version: string | null;
  notes: string | null;
  imported_at: string;
  updated_at: string;
}

export interface ReferenceNodeRecord {
  id: string;
  node_hash: string;
  format: string;
  solve_type: string;
  table_size: number;
  stack_bb: number;
  ante_type: string;
  ante_bb: number;
  hero_position: string;
  action_history: StructuredAction[];
  node_type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  ranges?: ReferenceRangeRecord[];
}

export interface ImportResult {
  success: boolean;
  node?: ReferenceNodeRecord;
  range?: ReferenceRangeRecord;
  error?: string;
  warnings: string[];
}

// ===== Node Hash Computation =====
// Deterministic hash from canonical JSON string of node identity.
// Uses Web Crypto API (available in browser and Deno).

export async function computeNodeHash(identity: ReferenceNodeIdentity): Promise<string> {
  const canonical = [
    identity.format,
    identity.solve_type,
    `${identity.table_size}max`,
    `${identity.stack_bb}bb`,
    identity.ante_type === 'none' ? 'none' : `${identity.ante_type}-${identity.ante_bb}`,
    identity.hero_position,
    JSON.stringify(identity.action_history.map(a => ({
      position: a.position,
      action: a.action,
      size_bb: a.size_bb ?? null,
    }))),
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== 169-Hand Expansion to 1,326 Combos =====

/**
 * Expand a 169-hand strategy to 1,326-combo level.
 * Each 169 cell (e.g., "AKs") maps to its physical combos (e.g., AhKh, AhKc, ...).
 * The same action frequencies are applied to all combos belonging to that cell.
 *
 * @param handStrategy - Map of 169-cell-id → {action: frequency}
 * @returns Map of combo-string → {action: frequency}
 */
export function expand169ToCombos(
  handStrategy: Record<string, { action: string; frequency: number }[]>,
): Record<string, Record<string, number>> {
  const comboStrategy: Record<string, Record<string, number>> = {};

  for (const hand of HAND_CELLS) {
    const freqs = handStrategy[hand];
    if (!freqs || freqs.length === 0) continue;

    const indices = getComboIndicesForCell(hand);
    for (const idx of indices) {
      const combo = CANONICAL_HAND_ORDER[idx];
      comboStrategy[combo] = {};
      for (const f of freqs) {
        comboStrategy[combo][f.action] = f.frequency;
      }
    }
  }

  return comboStrategy;
}

/**
 * Convert combo-level strategy data back to 169-hand grid for display.
 * Averages action frequencies across all combos belonging to each cell.
 */
export function combosTo169(
  comboStrategy: Record<string, Record<string, number>>,
): Record<string, { action: string; frequency: number }[]> {
  const result: Record<string, { action: string; frequency: number }[]> = {};

  for (const hand of HAND_CELLS) {
    const indices = getComboIndicesForCell(hand);
    const actionSums: Record<string, number> = {};

    for (const idx of indices) {
      const combo = CANONICAL_HAND_ORDER[idx];
      const comboData = comboStrategy[combo];
      if (!comboData) continue;
      for (const [action, freq] of Object.entries(comboData)) {
        actionSums[action] = (actionSums[action] ?? 0) + freq;
      }
    }

    const comboCount = indices.length;
    result[hand] = Object.entries(actionSums).map(([action, sum]) => ({
      action,
      frequency: sum / comboCount,
    }));
  }

  return result;
}

// ===== Validation =====

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  is_partial: boolean;
  combo_count: number;
}

const VALID_169_CELLS = new Set(HAND_CELLS);
const VALID_COMBOS = new Set(CANONICAL_HAND_ORDER);

export function validateComboStrategy(
  strategyData: Record<string, Record<string, number>>,
  availableActions: AvailableAction[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let comboCount = 0;

  const validActionNames = new Set(availableActions.map(a => a.action));

  for (const [combo, actions] of Object.entries(strategyData)) {
    if (!VALID_COMBOS.has(combo)) {
      errors.push(`Invalid combo: "${combo}"`);
      continue;
    }
    comboCount++;

    let sum = 0;
    for (const [action, freq] of Object.entries(actions)) {
      if (typeof freq !== 'number' || isNaN(freq)) {
        errors.push(`${combo}: frequency for "${action}" is not a number`);
        continue;
      }
      if (freq < 0 || freq > 1) {
        warnings.push(`${combo}: frequency ${freq} for "${action}" out of [0,1], clamping`);
      }
      if (!validActionNames.has(action) && action !== 'fold') {
        warnings.push(`${combo}: action "${action}" not in available_actions`);
      }
      sum += Math.max(0, Math.min(1, freq));
    }

    if (sum > 1.05) {
      warnings.push(`${combo}: frequencies sum to ${sum.toFixed(3)}, expected ≤ 1.0`);
    }
  }

  const isPartial = comboCount < 1326;
  if (isPartial && comboCount > 0) {
    warnings.push(`Range covers ${comboCount}/1326 combos — marked as partial`);
  }

  return {
    valid: errors.length === 0 && comboCount > 0,
    errors,
    warnings,
    is_partial: isPartial,
    combo_count: comboCount,
  };
}

export function validate169Strategy(
  handStrategy: Record<string, { action: string; frequency: number }[]>,
  availableActions: AvailableAction[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let handCount = 0;

  const validActionNames = new Set(availableActions.map(a => a.action));

  for (const [hand, freqs] of Object.entries(handStrategy)) {
    if (!VALID_169_CELLS.has(hand)) {
      errors.push(`Invalid hand name: "${hand}"`);
      continue;
    }
    handCount++;

    let sum = 0;
    for (const f of freqs) {
      if (typeof f.frequency !== 'number' || isNaN(f.frequency)) {
        errors.push(`${hand}: frequency is not a number`);
        continue;
      }
      if (f.frequency < 0 || f.frequency > 1) {
        warnings.push(`${hand}: frequency ${f.frequency} out of [0,1]`);
      }
      if (!validActionNames.has(f.action) && f.action !== 'fold') {
        warnings.push(`${hand}: action "${f.action}" not in available_actions`);
      }
      sum += Math.max(0, Math.min(1, f.frequency));
    }

    if (freqs.length > 0 && Math.abs(sum - 1.0) > 0.05) {
      warnings.push(`${hand}: frequencies sum to ${sum.toFixed(3)}, expected ~1.0`);
    }
  }

  // Expand to count combos
  const comboStrategy = expand169ToCombos(handStrategy);
  let comboCount = 0;
  for (const combo of Object.keys(comboStrategy)) {
    if (VALID_COMBOS.has(combo)) comboCount++;
  }

  const isPartial = handCount < 169;
  if (isPartial && handCount > 0) {
    warnings.push(`Range covers ${handCount}/169 hands — marked as partial`);
  }

  return {
    valid: errors.length === 0 && handCount > 0,
    errors,
    warnings,
    is_partial: isPartial,
    combo_count: comboCount,
  };
}

// ===== CRUD Operations =====

/**
 * Find a reference node by its identity hash, with the active range.
 */
export async function findReferenceNode(
  identity: ReferenceNodeIdentity,
): Promise<{ node: ReferenceNodeRecord; range: ReferenceRangeRecord } | null> {
  const nodeHash = await computeNodeHash(identity);

  const { data: nodeData, error: nodeError } = await supabase
    .from('preflop_reference_nodes')
    .select('*')
    .eq('node_hash', nodeHash)
    .maybeSingle();

  if (nodeError || !nodeData) return null;

  const { data: rangeData, error: rangeError } = await supabase
    .from('preflop_reference_ranges')
    .select('*')
    .eq('node_id', nodeData.id)
    .eq('is_active', true)
    .maybeSingle();

  if (rangeError || !rangeData) return null;

  return {
    node: mapNodeRow(nodeData),
    range: mapRangeRow(rangeData),
  };
}

/**
 * List all reference nodes (for coverage/admin view).
 */
export async function listReferenceNodes(): Promise<ReferenceNodeRecord[]> {
  const { data, error } = await supabase
    .from('preflop_reference_nodes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(mapNodeRow);
}

/**
 * List all ranges for a node (all versions).
 */
export async function listRangesForNode(nodeId: string): Promise<ReferenceRangeRecord[]> {
  const { data, error } = await supabase
    .from('preflop_reference_ranges')
    .select('*')
    .eq('node_id', nodeId)
    .order('version', { ascending: false });

  if (error || !data) return [];
  return data.map(mapRangeRow);
}

export interface SaveRangeInput {
  identity: ReferenceNodeIdentity;
  available_actions: AvailableAction[];
  strategy_data: Record<string, Record<string, number>>;
  is_partial: boolean;
  source_name: string;
  source_version?: string;
  notes?: string;
  description?: string;
  on_duplicate?: 'new_version' | 'replace_active' | 'cancel';
}

/**
 * Save a reference range. Creates or finds the node, then creates a new
 * range version. Handles duplicate detection via on_duplicate parameter.
 */
export async function saveReferenceRange(input: SaveRangeInput): Promise<ImportResult> {
  const warnings: string[] = [];
  const nodeHash = await computeNodeHash(input.identity);

  // Find or create node
  let { data: existingNode } = await supabase
    .from('preflop_reference_nodes')
    .select('*')
    .eq('node_hash', nodeHash)
    .maybeSingle();

  let nodeId: string;

  if (existingNode) {
    nodeId = existingNode.id;

    // Check for existing ranges
    const { data: existingRanges } = await supabase
      .from('preflop_reference_ranges')
      .select('*')
      .eq('node_id', nodeId)
      .order('version', { ascending: false });

    if (existingRanges && existingRanges.length > 0) {
      if (input.on_duplicate === 'cancel') {
        return { success: false, error: 'Node already exists and on_duplicate is cancel', warnings };
      }

      const nextVersion = (existingRanges[0].version ?? 0) + 1;

      if (input.on_duplicate === 'replace_active') {
        // Deactivate all existing ranges
        await supabase
          .from('preflop_reference_ranges')
          .update({ is_active: false })
          .eq('node_id', nodeId)
          .eq('is_active', true);
      }

      // Insert new version
      const { data: newRange, error: rangeError } = await supabase
        .from('preflop_reference_ranges')
        .insert({
          node_id: nodeId,
          version: nextVersion,
          is_active: true,
          is_partial: input.is_partial,
          available_actions: input.available_actions,
          strategy_data: input.strategy_data,
          source_name: input.source_name,
          source_version: input.source_version ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (rangeError || !newRange) {
        return { success: false, error: rangeError?.message ?? 'Failed to save range', warnings };
      }

      return {
        success: true,
        node: mapNodeRow(existingNode),
        range: mapRangeRow(newRange),
        warnings,
      };
    }
  } else {
    // Create new node
    const { data: newNode, error: nodeError } = await supabase
      .from('preflop_reference_nodes')
      .insert({
        node_hash: nodeHash,
        format: input.identity.format,
        solve_type: input.identity.solve_type,
        table_size: input.identity.table_size,
        stack_bb: input.identity.stack_bb,
        ante_type: input.identity.ante_type,
        ante_bb: input.identity.ante_bb,
        hero_position: input.identity.hero_position,
        action_history: input.identity.action_history,
        node_type: 'preflop_decision',
        description: input.description ?? null,
      })
      .select()
      .single();

    if (nodeError || !newNode) {
      return { success: false, error: nodeError?.message ?? 'Failed to create node', warnings };
    }

    nodeId = newNode.id;
    existingNode = newNode;
  }

  // Insert first version
  const { data: newRange, error: rangeError } = await supabase
    .from('preflop_reference_ranges')
    .insert({
      node_id: nodeId,
      version: 1,
      is_active: true,
      is_partial: input.is_partial,
      available_actions: input.available_actions,
      strategy_data: input.strategy_data,
      source_name: input.source_name,
      source_version: input.source_version ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (rangeError || !newRange) {
    return { success: false, error: rangeError?.message ?? 'Failed to save range', warnings };
  }

  return {
    success: true,
    node: mapNodeRow(existingNode),
    range: mapRangeRow(newRange),
    warnings,
  };
}

/**
 * Set which range version is active for a node.
 */
export async function setActiveRange(nodeId: string, rangeId: string): Promise<boolean> {
  // Deactivate all
  await supabase
    .from('preflop_reference_ranges')
    .update({ is_active: false })
    .eq('node_id', nodeId)
    .eq('is_active', true);

  // Activate the selected one
  const { error } = await supabase
    .from('preflop_reference_ranges')
    .update({ is_active: true })
    .eq('id', rangeId)
    .eq('node_id', nodeId);

  return !error;
}

/**
 * Delete a reference node and all its ranges.
 */
export async function deleteReferenceNode(nodeId: string): Promise<boolean> {
  const { error } = await supabase
    .from('preflop_reference_nodes')
    .delete()
    .eq('id', nodeId);
  return !error;
}

/**
 * Export a reference node with its active range as JSON.
 */
export async function exportReferenceNode(nodeId: string): Promise<string | null> {
  const { data: node } = await supabase
    .from('preflop_reference_nodes')
    .select('*')
    .eq('id', nodeId)
    .maybeSingle();

  if (!node) return null;

  const { data: range } = await supabase
    .from('preflop_reference_ranges')
    .select('*')
    .eq('node_id', nodeId)
    .eq('is_active', true)
    .maybeSingle();

  return JSON.stringify({
    identity: {
      format: node.format,
      solve_type: node.solve_type,
      table_size: node.table_size,
      stack_bb: Number(node.stack_bb),
      ante_type: node.ante_type,
      ante_bb: Number(node.ante_bb),
      hero_position: node.hero_position,
      action_history: node.action_history,
    },
    available_actions: range?.available_actions ?? [],
    strategy_data: range?.strategy_data ?? {},
    is_partial: range?.is_partial ?? false,
    source_name: range?.source_name ?? 'export',
    source_version: range?.source_version ?? null,
    notes: range?.notes ?? null,
  }, null, 2);
}

// ===== Combo Weight Extraction for Postflop Handoff =====

/**
 * Extract a 1,326-element weighted range vector from a reference range,
 * filtered to a specific action branch. This is what gets fed to DeepSolver
 * as a player range for postflop solving.
 *
 * Handles both combo-level and 169-level strategy data.
 *
 * @param range - The reference range record
 * @param actionLabel - The action to filter by (e.g., "raise_2.2", "call")
 * @returns Float64Array of length 1,326 with combo weights
 */
export function extractComboWeightsForAction(
  range: ReferenceRangeRecord,
  actionLabel: string,
): Float64Array {
  const vector = new Float64Array(1326);
  const data = normalizeToComboLevel(range.strategy_data);

  for (let i = 0; i < 1326; i++) {
    const combo = CANONICAL_HAND_ORDER[i];
    const comboData = data[combo];
    if (comboData && typeof comboData[actionLabel] === 'number') {
      vector[i] = comboData[actionLabel];
    }
  }

  return vector;
}

/**
 * Extract the full range weight (all non-fold actions combined) as a
 * 1,326-element vector. This represents the total range entering a branch.
 * Handles both combo-level and 169-level strategy data.
 */
export function extractFullRangeWeights(range: ReferenceRangeRecord): Float64Array {
  const vector = new Float64Array(1326);
  const data = normalizeToComboLevel(range.strategy_data);

  for (let i = 0; i < 1326; i++) {
    const combo = CANONICAL_HAND_ORDER[i];
    const comboData = data[combo];
    if (!comboData) continue;

    let weight = 0;
    for (const [action, freq] of Object.entries(comboData)) {
      if (action !== 'fold') {
        weight += freq;
      }
    }
    vector[i] = Math.min(1, weight);
  }

  return vector;
}

// ===== Internal: normalize 169-level data to combo-level =====
function normalizeToComboLevel(
  strategyData: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> {
  // Check if keys look like 169-level (e.g., "AKs", "TT") vs combo-level (e.g., "AhKh")
  const sampleKeys = Object.keys(strategyData).slice(0, 5);
  const is169 = sampleKeys.some(k => k.length <= 4 && !k.match(/^[a-z][0-9a-z][a-z][0-9a-z]$/i));
  if (!is169) return strategyData;

  return expand169ToCombos(
    Object.fromEntries(
      Object.entries(strategyData).map(([hand, actions]) => [
        hand,
        Object.entries(actions).map(([action, frequency]) => ({ action, frequency })),
      ]),
    ),
  );
}

// ===== Row Mappers =====

function mapNodeRow(row: Record<string, unknown>): ReferenceNodeRecord {
  return {
    id: row.id as string,
    node_hash: row.node_hash as string,
    format: row.format as string,
    solve_type: row.solve_type as string,
    table_size: row.table_size as number,
    stack_bb: Number(row.stack_bb),
    ante_type: row.ante_type as string,
    ante_bb: Number(row.ante_bb),
    hero_position: row.hero_position as string,
    action_history: (row.action_history as StructuredAction[]) ?? [],
    node_type: row.node_type as string,
    description: (row.description as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapRangeRow(row: Record<string, unknown>): ReferenceRangeRecord {
  return {
    id: row.id as string,
    node_id: row.node_id as string,
    version: row.version as number,
    is_active: row.is_active as boolean,
    is_partial: row.is_partial as boolean,
    available_actions: (row.available_actions as AvailableAction[]) ?? [],
    strategy_data: (row.strategy_data as Record<string, Record<string, number>>) ?? {},
    source_name: row.source_name as string,
    source_version: (row.source_version as string) ?? null,
    notes: (row.notes as string) ?? null,
    imported_at: row.imported_at as string,
    updated_at: row.updated_at as string,
  };
}
