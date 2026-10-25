import type {
  SolverStreetAction,
  SolverPosition,
  SolverBoardCard,
  SolverTableConfig,
  SolverFormat,
  ActionFrequency,
  RangeData,
  SolverDataSource,
  StrategyProvenance,
} from './types';
import { HAND_CELLS, ACTION_COLORS, CARD_RANKS } from './types';
import { positionsForTable } from './potCalculator';
import {
  findReferenceDataset,
  comboCount,
  TOTAL_COMBOS,
  buildConfigKey,
} from './preflopReferenceData';
import { findReferenceNode, combosTo169, expand169ToCombos, type StructuredAction } from './referenceRangeLibrary';

function seededRandom(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export interface NodeAction {
  action: ActionFrequency['action'];
  label: string;
  amount_bb?: number;
  amount_pot_pct?: number;
  color: string;
}

export interface NodeStrategy {
  player_to_act: SolverPosition;
  available_actions: NodeAction[];
  strategy_by_hand: Record<string, { action: string; frequency: number; color: string }[]>;
  aggregate_strategy: { action: string; label: string; frequency: number; color: string }[];
  is_mock: boolean;
  source: SolverDataSource;
  provenance: StrategyProvenance;
}

export function getAvailableActionsForNode(
  street: 'preflop' | 'flop' | 'turn' | 'river',
  actions: SolverStreetAction[],
  tableConfig: SolverTableConfig,
  potBB: number,
  effectiveStackBB: number,
): NodeAction[] {
  const streetActions = actions.filter((a) => a.street === street);
  const hasBet = streetActions.some((a) => a.action === 'bet' || a.action === 'raise' || a.action === 'all-in');

  if (street === 'preflop') {
    if (!hasBet) {
      return [
        { action: 'fold', label: 'Fold', color: ACTION_COLORS.fold },
        { action: 'call', label: 'Limp', color: ACTION_COLORS.call },
        { action: 'raise', label: 'Raise 2.2', amount_bb: 2.2, color: ACTION_COLORS.raise },
        { action: 'raise', label: 'Raise 2.5', amount_bb: 2.5, color: ACTION_COLORS.raise },
        { action: 'raise', label: 'Raise 3', amount_bb: 3, color: ACTION_COLORS.raise },
        { action: 'all-in', label: 'All-in', amount_bb: effectiveStackBB, color: ACTION_COLORS['all-in'] },
      ];
    }
    return [
      { action: 'fold', label: 'Fold', color: ACTION_COLORS.fold },
      { action: 'call', label: 'Call', color: ACTION_COLORS.call },
      { action: 'raise', label: 'Raise', amount_bb: Math.min(potBB * 2.5, effectiveStackBB), color: ACTION_COLORS.raise },
      { action: 'all-in', label: 'All-in', amount_bb: effectiveStackBB, color: ACTION_COLORS['all-in'] },
    ];
  }

  if (!hasBet) {
    return [
      { action: 'check', label: 'Check', color: ACTION_COLORS.check },
      { action: 'bet', label: 'Bet 25%', amount_pot_pct: 25, amount_bb: +(potBB * 0.25).toFixed(1), color: ACTION_COLORS.bet },
      { action: 'bet', label: 'Bet 50%', amount_pot_pct: 50, amount_bb: +(potBB * 0.5).toFixed(1), color: ACTION_COLORS.bet },
      { action: 'bet', label: 'Bet 75%', amount_pot_pct: 75, amount_bb: +(potBB * 0.75).toFixed(1), color: ACTION_COLORS.bet },
      { action: 'all-in', label: 'All-in', amount_bb: effectiveStackBB, color: ACTION_COLORS['all-in'] },
    ];
  }
  return [
    { action: 'fold', label: 'Fold', color: ACTION_COLORS.fold },
    { action: 'call', label: 'Call', color: ACTION_COLORS.call },
    { action: 'raise', label: 'Raise 2.5x', amount_bb: +(potBB * 2.5).toFixed(1), color: ACTION_COLORS.raise },
    { action: 'all-in', label: 'All-in', amount_bb: effectiveStackBB, color: ACTION_COLORS['all-in'] },
  ];
}

// ===== Scenario classification =====
export type PreflopScenarioType = 'unopened' | 'facing_raise' | 'facing_3bet' | 'bb_defense' | 'facing_allin';

export interface PreflopScenario {
  type: PreflopScenarioType;
  position: SolverPosition;
  openerPosition?: SolverPosition;
  raiseCount: number;
  effectiveStackBB: number;
  seatCount: number;
}

export function classifyPreflopScenario(
  actions: SolverStreetAction[],
  position: SolverPosition,
  effectiveStackBB: number,
  tableConfig: SolverTableConfig,
): PreflopScenario {
  const preflopActions = actions.filter(a => a.street === 'preflop');
  const raises = preflopActions.filter(a => a.action === 'raise' || a.action === 'bet');
  const allIns = preflopActions.filter(a => a.action === 'all-in');

  if (allIns.length > 0 && raises.length >= 1) {
    return { type: 'facing_allin', position, raiseCount: raises.length, effectiveStackBB, seatCount: tableConfig.seat_count };
  }
  if (raises.length === 0) {
    return { type: 'unopened', position, raiseCount: 0, effectiveStackBB, seatCount: tableConfig.seat_count };
  }
  if (raises.length >= 2) {
    return { type: 'facing_3bet', position, raiseCount: raises.length, openerPosition: raises[0].position, effectiveStackBB, seatCount: tableConfig.seat_count };
  }

  const opener = raises[0].position;
  if (position === 'BB') {
    return { type: 'bb_defense', position, raiseCount: 1, openerPosition: opener, effectiveStackBB, seatCount: tableConfig.seat_count };
  }
  return { type: 'facing_raise', position, raiseCount: 1, openerPosition: opener, effectiveStackBB, seatCount: tableConfig.seat_count };
}

// ===== Combo-weighted aggregate calculation =====
// Weights each hand by its combo count (pair=6, suited=4, offsuit=12)
// to produce accurate range frequencies across all 1326 combinations.
function computeComboWeightedAggregate(
  strategyByHand: Record<string, { action: string; frequency: number }[]>,
  availableActions: NodeAction[],
): { action: string; label: string; frequency: number; color: string }[] {
  const result: { action: string; label: string; frequency: number; color: string }[] = [];

  for (const act of availableActions) {
    let weightedSum = 0;
    let totalCombos = 0;

    for (const hand of HAND_CELLS) {
      const handStrat = strategyByHand[hand];
      const combos = comboCount(hand);
      totalCombos += combos;

      if (handStrat) {
        const freq = handStrat.find(f => f.action === act.action)?.frequency ?? 0;
        weightedSum += freq * combos;
      }
    }

    const avg = totalCombos > 0 ? weightedSum / totalCombos : 0;
    result.push({
      action: act.action,
      label: act.label,
      frequency: Math.round(avg * 1000) / 1000,
      color: act.color,
    });
  }

  return result;
}

// ===== Main strategy generation =====
// Returns NodeStrategy if reference data exists for this configuration.
// Returns null if no reference data is available — the UI shows "no data".
export function generateNodeStrategy(
  playerToAct: SolverPosition,
  street: 'preflop' | 'flop' | 'turn' | 'river',
  actions: SolverStreetAction[],
  board: SolverBoardCard[],
  tableConfig: SolverTableConfig,
  effectiveStackBB: number,
  potBB: number,
  format: SolverFormat = 'tournament',
  solveType: 'chipev' | 'icm' = 'chipev',
): NodeStrategy | null {
  const availableActions = getAvailableActionsForNode(street, actions, tableConfig, potBB, effectiveStackBB);

  if (street === 'preflop') {
    const scenario = classifyPreflopScenario(actions, playerToAct, effectiveStackBB, tableConfig);

    // Look up reference data for this exact configuration
    const refDataset = findReferenceDataset({
      format,
      solveType,
      seatCount: tableConfig.seat_count,
      anteType: tableConfig.ante_type,
      anteBB: tableConfig.ante_bb,
      stackBB: effectiveStackBB,
      position: playerToAct,
      scenario: scenario.type,
      openerPosition: scenario.openerPosition,
    });

    if (!refDataset || refDataset.isEmpty) {
      return null;
    }

    // Build strategy from reference data — render exact stored frequencies
    const strategyByHand: Record<string, { action: string; frequency: number; color: string }[]> = {};
    for (const hand of HAND_CELLS) {
      const refHandStrat = refDataset.data.hands[hand];
      if (refHandStrat) {
        strategyByHand[hand] = refHandStrat.map(s => ({
          action: s.action,
          frequency: s.frequency,
          color: ACTION_COLORS[s.action as keyof typeof ACTION_COLORS] ?? '#888888',
        }));
      } else {
        // Hand not in reference data — default to 100% fold
        strategyByHand[hand] = [{ action: 'fold', frequency: 1.0, color: ACTION_COLORS.fold }];
      }
    }

    // Use reference dataset's available actions if present, otherwise computed ones
    const refActions = refDataset.data.available_actions.length > 0
      ? refDataset.data.available_actions.map(a => ({
          action: a.action as ActionFrequency['action'],
          label: a.label,
          color: ACTION_COLORS[a.action as keyof typeof ACTION_COLORS] ?? '#888888',
        }))
      : availableActions;

    const aggregateStrategy = computeComboWeightedAggregate(strategyByHand, refActions);

    const configurationKey = refDataset.configurationKey;

    return {
      player_to_act: playerToAct,
      available_actions: refActions,
      strategy_by_hand: strategyByHand,
      aggregate_strategy: aggregateStrategy,
      is_mock: false,
      source: 'reference',
      provenance: {
        source: 'reference',
        provider: refDataset.provider,
        isMock: false,
        isReference: true,
        solverVersion: refDataset.solverVersion,
        configurationKey,
      },
    };
  }

  // Postflop: no reference data yet — return null
  return null;
}

// ===== Async strategy generation (database-backed) =====
// Checks the preflop_reference_ranges database first, then falls back to
// the in-memory reference data. Returns null when no reference data exists.
export async function generateNodeStrategyAsync(
  playerToAct: SolverPosition,
  street: 'preflop' | 'flop' | 'turn' | 'river',
  actions: SolverStreetAction[],
  board: SolverBoardCard[],
  tableConfig: SolverTableConfig,
  effectiveStackBB: number,
  potBB: number,
  format: SolverFormat = 'tournament',
  solveType: 'chipev' | 'icm' = 'chipev',
): Promise<NodeStrategy | null> {
  if (street !== 'preflop') return null;

  const scenario = classifyPreflopScenario(actions, playerToAct, effectiveStackBB, tableConfig);

  // Build structured action history for database lookup
  const structuredHistory: StructuredAction[] = actions
    .filter(a => a.street === 'preflop')
    .map(a => ({
      position: a.position,
      action: a.action,
      size_bb: a.amount_bb,
    }));

  // Try database first
  try {
    const dbResult = await findReferenceNode({
      format,
      solve_type: solveType,
      table_size: tableConfig.seat_count,
      stack_bb: effectiveStackBB,
      ante_type: tableConfig.ante_type,
      ante_bb: tableConfig.ante_bb,
      hero_position: playerToAct,
      action_history: structuredHistory,
    });

    if (dbResult) {
      const { range } = dbResult;

      // Convert combo-level strategy back to 169-hand grid for display
      // If strategy_data has 169-level keys (e.g., "AKs"), expand to combos first
      const is169Format = Object.keys(range.strategy_data).some(k => k.length <= 4 && !k.match(/^[a-z][0-9a-z][a-z][0-9a-z]$/i));
      let comboLevelData = range.strategy_data;
      if (is169Format) {
        comboLevelData = expand169ToCombos(
          Object.fromEntries(
            Object.entries(range.strategy_data).map(([hand, actions]) => [
              hand,
              Object.entries(actions).map(([action, frequency]) => ({ action, frequency })),
            ]),
          ),
        );
      }
      const handStrategy169 = combosTo169(comboLevelData);

      const strategyByHand: Record<string, { action: string; frequency: number; color: string }[]> = {};
      for (const hand of HAND_CELLS) {
        const handStrat = handStrategy169[hand];
        if (handStrat && handStrat.length > 0) {
          strategyByHand[hand] = handStrat.map(s => ({
            action: s.action,
            frequency: s.frequency,
            color: ACTION_COLORS[s.action as keyof typeof ACTION_COLORS] ?? '#888888',
          }));
        } else {
          strategyByHand[hand] = [{ action: 'fold', frequency: 1.0, color: ACTION_COLORS.fold }];
        }
      }

      const refActions = range.available_actions.length > 0
        ? range.available_actions.map(a => ({
            action: a.action as ActionFrequency['action'],
            label: a.label,
            color: ACTION_COLORS[a.action as keyof typeof ACTION_COLORS] ?? '#888888',
          }))
        : getAvailableActionsForNode(street, actions, tableConfig, potBB, effectiveStackBB);

      const aggregateStrategy = computeComboWeightedAggregate(strategyByHand, refActions);

      return {
        player_to_act: playerToAct,
        available_actions: refActions,
        strategy_by_hand: strategyByHand,
        aggregate_strategy: aggregateStrategy,
        is_mock: false,
        source: 'reference',
        provenance: {
          source: 'reference',
          provider: range.source_name,
          isMock: false,
          isReference: true,
          solverVersion: range.source_version ?? 'db-v1',
          configurationKey: dbResult.node.node_hash,
        },
      };
    }
  } catch {
    // Database lookup failed — fall through to in-memory
  }

  // Fall back to in-memory reference data
  return generateNodeStrategy(
    playerToAct, street, actions, board, tableConfig, effectiveStackBB, potBB, format, solveType,
  );
}

// ===== Convert a SolverNode (from a provider result) to NodeStrategy =====
export function solverNodeToNodeStrategy(
  node: import('./types').SolverNode,
  isMock: boolean,
): NodeStrategy {
  const availableActions: NodeAction[] = node.available_actions.map((a) => ({
    action: a.action,
    label: a.label,
    amount_bb: a.amount_bb,
    amount_pot_pct: a.amount_pot_pct,
    color: ACTION_COLORS[a.action] ?? '#888888',
  }));

  const strategyByHand: Record<string, { action: string; frequency: number; color: string }[]> = {};
  for (const hs of node.strategy_by_hand) {
    strategyByHand[hs.hand] = hs.frequencies.map((f) => ({
      action: f.action,
      frequency: f.frequency,
      color: ACTION_COLORS[f.action] ?? '#888888',
    }));
  }

  const aggregateStrategy = computeComboWeightedAggregate(strategyByHand, availableActions);

  const source: SolverDataSource = isMock ? 'mock' : 'deepsolver';

  return {
    player_to_act: node.player_to_act,
    available_actions: availableActions,
    strategy_by_hand: strategyByHand,
    aggregate_strategy: aggregateStrategy,
    is_mock: isMock,
    source,
    provenance: {
      source,
      provider: isMock ? 'mock-provider' : 'deepsolver',
      isMock,
      isReference: false,
      solverVersion: isMock ? 'mock-v1' : 'deepsolver-v1',
      configurationKey: '',
    },
  };
}

// ===== Derive ranges from actions (for solve submission) =====
export function deriveRangesFromActions(
  actions: SolverStreetAction[],
  tableConfig: SolverTableConfig,
): { hero_range: RangeData; villain_range: RangeData; hero_position: SolverPosition; villain_position: SolverPosition } | null {
  const participants = getParticipantsFromActions(actions, tableConfig);
  if (participants.length < 2) return null;

  const heroPos = participants[0];
  const villainPos = participants[1];

  const heroRange = generateMockRangeForPosition(heroPos, actions, 'hero');
  const villainRange = generateMockRangeForPosition(villainPos, actions, 'villain');

  return {
    hero_range: heroRange,
    villain_range: villainRange,
    hero_position: heroPos,
    villain_position: villainPos,
  };
}

function getParticipantsFromActions(
  actions: SolverStreetAction[],
  tableConfig: SolverTableConfig,
): SolverPosition[] {
  const allPositions = positionsForTable(tableConfig.seat_count);
  const folded = new Set<SolverPosition>();
  const allIn = new Set<SolverPosition>();

  for (const action of actions) {
    if (action.action === 'fold') folded.add(action.position);
    if (action.action === 'all-in') allIn.add(action.position);
  }

  return allPositions.filter(p => !folded.has(p));
}

function generateMockRangeForPosition(
  position: SolverPosition,
  actions: SolverStreetAction[],
  side: 'hero' | 'villain',
): RangeData {
  const seed = `${position}-${side}-${actions.map(a => a.action).join('-')}`;
  const cells: Record<string, number> = {};

  for (const hand of HAND_CELLS) {
    const handSeed = `${seed}-${hand}`;
    const val = seededRandom(handSeed);
    const threshold = position === 'BB' ? 0.55 : position === 'BTN' ? 0.45 : 0.35;
    cells[hand] = val > threshold ? Math.round(seededRandom(`${handSeed}-2`) * 10) / 10 : 0;
  }

  return { cells };
}
