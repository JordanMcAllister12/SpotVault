import { describe, it, expect } from 'vitest';
import { generateNodeStrategy } from '@/lib/solver/nodeStrategy';
import { findReferenceDataset, comboCount } from '@/lib/solver/preflopReferenceData';
import { HAND_CELLS, DEFAULT_TABLE_CONFIG, ACTION_COLORS } from '@/lib/solver/types';
import type { SolverStreetAction, SolverTableConfig, SolverFormat } from '@/lib/solver/types';

const DEFAULT_PARAMS = {
  format: 'tournament' as SolverFormat,
  solveType: 'chipev' as const,
  seatCount: 8,
  anteType: 'bb_ante',
  anteBB: 1,
  stackBB: 40,
  position: 'UTG' as const,
  scenario: 'unopened',
};

describe('Strategy propagation — reference data to NodeStrategy', () => {
  it('reference dataset exists for default UTG unopened config', () => {
    const ds = findReferenceDataset(DEFAULT_PARAMS);
    expect(ds).not.toBeNull();
    expect(ds!.isEmpty).toBeFalsy();
  });

  it('100% Fold combo (72o) survives mapping as valid strategy', () => {
    const ds = findReferenceDataset(DEFAULT_PARAMS);
    const hand72o = ds!.data.hands['72o'];
    expect(hand72o).toBeDefined();
    expect(hand72o).toHaveLength(1);
    expect(hand72o[0].action).toBe('fold');
    expect(hand72o[0].frequency).toBeCloseTo(1.0, 5);
  });

  it('100% Raise combo (AA) survives mapping with correct frequencies', () => {
    const ds = findReferenceDataset(DEFAULT_PARAMS);
    const aa = ds!.data.hands['AA'];
    expect(aa).toBeDefined();
    const raiseFreq = aa.find(f => f.action === 'raise')?.frequency ?? 0;
    const allInFreq = aa.find(f => f.action === 'all-in')?.frequency ?? 0;
    expect(raiseFreq).toBeCloseTo(0.95, 5);
    expect(allInFreq).toBeCloseTo(0.05, 5);
    expect(raiseFreq + allInFreq).toBeCloseTo(1.0, 5);
  });

  it('mixed-frequency combo (KQo) preserves all frequencies', () => {
    const ds = findReferenceDataset(DEFAULT_PARAMS);
    const kqo = ds!.data.hands['KQo'];
    expect(kqo).toBeDefined();
    expect(kqo).toHaveLength(3);
    const total = kqo.reduce((sum, f) => sum + f.frequency, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('generateNodeStrategy returns non-null for valid config', () => {
    const actions: SolverStreetAction[] = [];
    const tableConfig: SolverTableConfig = { ...DEFAULT_TABLE_CONFIG };
    const strategy = generateNodeStrategy(
      'UTG', 'preflop', actions, [], tableConfig, 40, 1.5, 'tournament', 'chipev'
    );
    expect(strategy).not.toBeNull();
    expect(strategy!.source).toBe('reference');
  });

  it('Fold-only hand is considered VALID strategy (not missing)', () => {
    const actions: SolverStreetAction[] = [];
    const tableConfig: SolverTableConfig = { ...DEFAULT_TABLE_CONFIG };
    const strategy = generateNodeStrategy(
      'UTG', 'preflop', actions, [], tableConfig, 40, 1.5, 'tournament', 'chipev'
    );
    expect(strategy).not.toBeNull();
    const hand72o = strategy!.strategy_by_hand['72o'];
    expect(hand72o).toBeDefined();
    expect(hand72o.length).toBeGreaterThan(0);
    // The hand has valid strategy data even though it's 100% fold
    const hasFold = hand72o.some(f => f.action === 'fold' && f.frequency > 0.99);
    expect(hasFold).toBe(true);
  });

  it('missing strategy remains null (returns null from generateNodeStrategy)', () => {
    // Use a config that has no reference data
    const actions: SolverStreetAction[] = [];
    const tableConfig: SolverTableConfig = { ...DEFAULT_TABLE_CONFIG, seat_count: 2 };
    const strategy = generateNodeStrategy(
      'UTG', 'preflop', actions, [], tableConfig, 40, 1.5, 'tournament', 'chipev'
    );
    expect(strategy).toBeNull();
  });

  it('every hand with reference data has frequencies summing to ~1.0', () => {
    const ds = findReferenceDataset(DEFAULT_PARAMS);
    expect(ds).not.toBeNull();
    for (const [hand, freqs] of Object.entries(ds!.data.hands)) {
      const total = freqs.reduce((sum, f) => sum + f.frequency, 0);
      expect(total, `Hand ${hand} sums to ${total}, expected ~1.0`).toBeCloseTo(1.0, 2);
    }
  });

  it('no action disappears simply because its frequency is zero for other actions', () => {
    const ds = findReferenceDataset(DEFAULT_PARAMS);
    expect(ds).not.toBeNull();
    // 72o is 100% fold — it should have fold in its strategy, not be empty
    const hand72o = ds!.data.hands['72o'];
    expect(hand72o.length).toBe(1);
    expect(hand72o[0].action).toBe('fold');
    // AA is 95% raise + 5% all-in — it should NOT have fold/call entries
    const aa = ds!.data.hands['AA'];
    const hasFold = aa.some(f => f.action === 'fold');
    expect(hasFold).toBe(false);
  });

  it('aggregated 169-cell frequencies are combo-weighted averages of underlying data', () => {
    const actions: SolverStreetAction[] = [];
    const tableConfig: SolverTableConfig = { ...DEFAULT_TABLE_CONFIG };
    const strategy = generateNodeStrategy(
      'UTG', 'preflop', actions, [], tableConfig, 40, 1.5, 'tournament', 'chipev'
    );
    expect(strategy).not.toBeNull();

    // Verify aggregate fold frequency matches combo-weighted calculation
    const ds = findReferenceDataset(DEFAULT_PARAMS);
    expect(ds).not.toBeNull();

    let weightedFoldSum = 0;
    let totalCombos = 0;
    for (const hand of HAND_CELLS) {
      const handStrat = ds!.data.hands[hand];
      const combos = comboCount(hand);
      totalCombos += combos;
      if (handStrat) {
        const foldFreq = handStrat.find(f => f.action === 'fold')?.frequency ?? 0;
        weightedFoldSum += foldFreq * combos;
      }
    }
    const expectedFoldPct = weightedFoldSum / totalCombos;
    const aggregateFold = strategy!.aggregate_strategy.find(a => a.action === 'fold');
    expect(aggregateFold).toBeDefined();
    expect(aggregateFold!.frequency).toBeCloseTo(expectedFoldPct, 3);
  });

  it('ACTION_COLORS uses the correct neon palette (fold=blue, call=green, raise=red, all-in=maroon)', () => {
    expect(ACTION_COLORS.fold).toBe('#00aaff');
    expect(ACTION_COLORS.call).toBe('#00ff7f');
    expect(ACTION_COLORS.raise).toBe('#ff0033');
    expect(ACTION_COLORS['all-in']).toBe('#cc1144');
  });
});

describe('Strategy propagation — representative hand values from UTG unopened', () => {
  const actions: SolverStreetAction[] = [];
  const tableConfig: SolverTableConfig = { ...DEFAULT_TABLE_CONFIG };
  const strategy = generateNodeStrategy(
    'UTG', 'preflop', actions, [], tableConfig, 40, 1.5, 'tournament', 'chipev'
  );

  it('AA: 95% raise + 5% all-in', () => {
    expect(strategy).not.toBeNull();
    const aa = strategy!.strategy_by_hand['AA'];
    expect(aa.find(f => f.action === 'raise')?.frequency).toBeCloseTo(0.95, 5);
    expect(aa.find(f => f.action === 'all-in')?.frequency).toBeCloseTo(0.05, 5);
  });

  it('AKs: 95% raise + 5% all-in', () => {
    const aks = strategy!.strategy_by_hand['AKs'];
    expect(aks.find(f => f.action === 'raise')?.frequency).toBeCloseTo(0.95, 5);
    expect(aks.find(f => f.action === 'all-in')?.frequency).toBeCloseTo(0.05, 5);
  });

  it('A5s: 30% raise + 70% call', () => {
    const a5s = strategy!.strategy_by_hand['A5s'];
    expect(a5s.find(f => f.action === 'raise')?.frequency).toBeCloseTo(0.30, 5);
    expect(a5s.find(f => f.action === 'call')?.frequency).toBeCloseTo(0.70, 5);
  });

  it('KQo: 50% raise + 40% call + 10% fold', () => {
    const kqo = strategy!.strategy_by_hand['KQo'];
    expect(kqo.find(f => f.action === 'raise')?.frequency).toBeCloseTo(0.50, 5);
    expect(kqo.find(f => f.action === 'call')?.frequency).toBeCloseTo(0.40, 5);
    expect(kqo.find(f => f.action === 'fold')?.frequency).toBeCloseTo(0.10, 5);
  });

  it('72o: 100% fold', () => {
    const hand72o = strategy!.strategy_by_hand['72o'];
    expect(hand72o.find(f => f.action === 'fold')?.frequency).toBeCloseTo(1.0, 5);
    expect(hand72o).toHaveLength(1);
  });
});
