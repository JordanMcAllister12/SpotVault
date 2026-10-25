import { describe, test, expect } from 'vitest';
import {
  evaluate7, computeAllInEquity, computeAllInEquityMC, computeAllInEquityAuto,
  parseCards,
} from './handEvaluator';
import { computeHandAllInEv } from './allInEv';
import {
  computeTournamentMetrics,
  type TournamentResult,
} from '../tournamentResultsStore';

// Extract hand category from evaluate7's integer encoding
function category(score: number): number {
  return Math.floor(score / 0x100000);
}

// ============================================================
// SPR Batch 3 — Scoring Validation Tests (A–H)
// ============================================================

describe('Test A: Hand evaluator correctness', () => {
  test('royal flush', () => {
    const cards = parseCards('AsKsQsJsTs2h3d');
    expect(category(evaluate7(cards))).toBe(9);
  });

  test('quads', () => {
    const cards = parseCards('AsAhAdAc2h3d4c');
    expect(category(evaluate7(cards))).toBe(8);
  });

  test('full house', () => {
    const cards = parseCards('AsAhAd2h2s3d4c');
    expect(category(evaluate7(cards))).toBe(7);
  });

  test('flush', () => {
    const cards = parseCards('As9s7s3s2sKhQd');
    expect(category(evaluate7(cards))).toBe(6);
  });

  test('straight', () => {
    const cards = parseCards('5h6d7c8s9h2cKd');
    expect(category(evaluate7(cards))).toBe(5);
  });

  test('trips', () => {
    const cards = parseCards('AsAhAd2h5s9dKc');
    expect(category(evaluate7(cards))).toBe(4);
  });

  test('two pair', () => {
    const cards = parseCards('AsAh2d2h5s9dKc');
    expect(category(evaluate7(cards))).toBe(3);
  });

  test('one pair', () => {
    const cards = parseCards('AsAh3d5h8s9dKc');
    expect(category(evaluate7(cards))).toBe(2);
  });

  test('high card', () => {
    const cards = parseCards('As3h5d7h9sJdKc');
    expect(category(evaluate7(cards))).toBe(1);
  });
});

describe('Test B: All-in equity — pair vs overcards (preflop)', () => {
  test('KK vs AK has ~70% equity', () => {
    const hero = parseCards('KsKh');
    const villain = parseCards('AsQd');
    const equity = computeAllInEquityAuto(hero, [villain], []);
    expect(equity).not.toBeNull();
    expect(equity!).toBeGreaterThan(0.65);
    expect(equity!).toBeLessThan(0.75);
  });
});

describe('Test C: All-in equity — dominated (AK vs AQ)', () => {
  test('AK vs AQ has ~70% equity', () => {
    const hero = parseCards('AsKd');
    const villain = parseCards('AhQs');
    const equity = computeAllInEquityMC(hero, [villain], [], 5000);
    expect(equity).not.toBeNull();
    expect(equity!).toBeGreaterThan(0.60);
    expect(equity!).toBeLessThan(0.80);
  });
});

describe('Test D: All-in equity — postflop with draws', () => {
  test('flush draw + overcards on flop', () => {
    const hero = parseCards('AhKh');
    const villain = parseCards('TsTc');
    const board = parseCards('2h7h9d');
    const equity = computeAllInEquity(hero, [villain], board);
    expect(equity).not.toBeNull();
    expect(equity!).toBeGreaterThan(0.40);
    expect(equity!).toBeLessThan(0.65);
  });

  test('AK high vs pair on turn (few outs)', () => {
    const hero = parseCards('AsKd');
    const villain = parseCards('8h9h');
    const board = parseCards('2h7h9dTs');
    const equity = computeAllInEquity(hero, [villain], board);
    expect(equity).not.toBeNull();
    // AK high vs pair of 9s on turn, only A or K river saves hero (~6 outs)
    expect(equity!).toBeGreaterThan(0.05);
    expect(equity!).toBeLessThan(0.20);
  });
});

describe('Test E: All-in EV — positive EV scenario', () => {
  test('KK vs AQ all-in preflop with showdown produces eligible EV', () => {
    const rawHandText = [
      'GGPoker Hand #12345',
      'Table TableX 6-max',
      'Hero posts small blind 50',
      'Villain posts big blind 100',
      'Hero raises to 300',
      'Villain raises to 10000',
      'Hero calls 9700 and is all-in',
      '*** FLOP *** [2h 7d 9c]',
      '*** TURN *** [2h 7d 9c] [Ks]',
      '*** RIVER *** [2h 7d 9c Ks] [3d]',
      'Villain: shows [As Qd]',
      'Hero: shows [Ks Kh]',
      'Hero collected 20000',
    ].join('\n');

    const result = computeHandAllInEv(
      'KsKh', '2h7d9cKs3d', rawHandText, 'Hero', true, false, 100, 20000, true,
    );
    expect(result.eligible).toBe(true);
    expect(result.ev_bb).not.toBeNull();
    if (result.ev_bb !== null) {
      // KK vs AQ on K-high board: hero has trips, equity = 1.0
      // EV = 1.0 * 200BB - 100BB = 100BB
      expect(result.ev_bb).toBeGreaterThan(50);
      expect(result.ev_bb).toBeLessThan(120);
    }
  });
});

describe('Test F: All-in EV — ineligible hand', () => {
  test('no showdown → ineligible', () => {
    const rawHandText = [
      'GGPoker Hand #12346',
      'Hero raises to 300',
      'Villain raises to 10000',
      'Hero calls 9700 and is all-in',
      '*** FLOP *** [2h 7d 9c]',
      '*** TURN *** [2h 7d 9c] [Ks]',
      '*** RIVER *** [2h 7d 9c Ks] [3d]',
    ].join('\n');

    const result = computeHandAllInEv(
      'KsKh', '2h7d9cKs3d', rawHandText, 'Hero', true, false, 100, 20000, false,
    );
    expect(result.eligible).toBe(false);
    expect(result.ev_bb).toBeNull();
  });

  test('no opponent cards in raw text → ineligible', () => {
    const rawHandText = [
      'GGPoker Hand #12347',
      'Hero raises to 300',
      'Villain raises to 10000',
      'Hero calls 9700 and is all-in',
      '*** FLOP *** [2h 7d 9c]',
      '*** RIVER *** [2h 7d 9c Ks 3d]',
      'Hero: shows [Ks Kh]',
    ].join('\n');

    const result = computeHandAllInEv(
      'KsKh', '2h7d9cKs3d', rawHandText, 'Hero', true, false, 100, 20000, true,
    );
    expect(result.eligible).toBe(false);
    expect(result.ev_bb).toBeNull();
  });

  test('not all-in → ineligible', () => {
    const rawHandText = [
      'GGPoker Hand #12348',
      'Hero raises to 300',
      'Villain calls',
      '*** FLOP *** [2h 7d 9c]',
      'Villain: shows [As Qd]',
      'Hero: shows [Ks Kh]',
    ].join('\n');

    const result = computeHandAllInEv(
      'KsKh', '2h7d9c', rawHandText, 'Hero', false, false, 100, 600, true,
    );
    expect(result.eligible).toBe(false);
    expect(result.ev_bb).toBeNull();
  });
});

describe('Test G: Tournament metrics — ROI/ITM computation', () => {
  test('3 ITM from 10 entries with negative ROI', () => {
    const results: TournamentResult[] = [
      makeResult(55, 0, 250, 1),
      makeResult(55, 0, 100, 2),
      makeResult(55, 0, 0, 50),
      makeResult(55, 0, 0, 80),
      makeResult(55, 0, 0, 120),
      makeResult(55, 0, 55, 10),
      makeResult(55, 0, 0, 200),
      makeResult(55, 0, 0, 300),
      makeResult(55, 0, 0, 500),
      makeResult(55, 0, 0, 800),
    ];
    const metrics = computeTournamentMetrics(results);
    expect(metrics.totalEntries).toBe(10);
    expect(metrics.itmCount).toBe(3);
    expect(metrics.itm).toBeCloseTo(30, 0);
    expect(metrics.totalCost).toBe(550);
    expect(metrics.totalPayout).toBe(405);
    expect(metrics.netProfit).toBe(-145);
    expect(metrics.roi).toBeLessThan(0);
  });

  test('winning player with positive ROI', () => {
    const results: TournamentResult[] = [
      makeResult(100, 10, 500, 1),
      makeResult(100, 10, 0, 50),
      makeResult(100, 10, 200, 5),
      makeResult(100, 10, 0, 80),
    ];
    const metrics = computeTournamentMetrics(results);
    expect(metrics.totalEntries).toBe(4);
    expect(metrics.totalCost).toBe(440);
    expect(metrics.totalPayout).toBe(700);
    expect(metrics.netProfit).toBe(260);
    expect(metrics.roi).toBeGreaterThan(0);
    expect(metrics.itmCount).toBe(2);
    expect(metrics.itm).toBeCloseTo(50, 0);
  });
});

describe('Test H: Tournament metrics — empty/missing data', () => {
  test('empty results → all zeros, no division errors', () => {
    const metrics = computeTournamentMetrics([]);
    expect(metrics.totalEntries).toBe(0);
    expect(metrics.roi).toBe(0);
    expect(metrics.itm).toBe(0);
    expect(metrics.abi).toBe(0);
    expect(metrics.netProfit).toBe(0);
  });

  test('results with zero buy-in are excluded', () => {
    const results: TournamentResult[] = [
      makeResult(0, 0, 100, 1),
      makeResult(50, 0, 0, 30),
    ];
    const metrics = computeTournamentMetrics(results);
    expect(metrics.totalEntries).toBe(1);
    expect(metrics.totalBuyIns).toBe(50);
  });
});

// ============================================================
// Helpers
// ============================================================

function makeResult(buyIn: number, entryFee: number, payout: number, finish: number): TournamentResult {
  return {
    tournament_id: `test-${buyIn}-${finish}-${Math.random()}`,
    buy_in: buyIn,
    entry_fee: entryFee,
    payout: payout,
    finish_position: finish,
    total_entrants: 100,
    is_re_entry: false,
    re_entry_number: 0,
    manually_entered: true,
  };
}
