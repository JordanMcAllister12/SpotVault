// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { buildReplayEvents, computeReplayState, getFirstPlaybackIndex, getPlaybackEvents } from '../replayEngine';
import type { NormalizedHand, NormalizedPlayer, NormalizedAction } from '../types';
import { EMPTY_NORMALIZED_HAND } from '../types';

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;
});

function makePlayer(name: string, seat: number, stack: number, position: string, isHero = false): NormalizedPlayer {
  return { name, seat, stack, position, isHero, holeCards: isHero ? ['Ah', 'Kd'] : undefined };
}

function makeHand(overrides: Partial<NormalizedHand>): NormalizedHand {
  return {
    ...EMPTY_NORMALIZED_HAND,
    handId: 'test-hand',
    site: 'test',
    gameType: "Hold'em",
    stakes: '$1/$2',
    date: '2026-01-01',
    tableName: 'TestTable',
    buttonSeat: 1,
    players: [
      makePlayer('Hero', 1, 1000, 'BTN', true),
      makePlayer('Villain', 2, 1000, 'BB'),
    ],
    winners: [],
    ...overrides,
  };
}

function getStateAtStep(hand: NormalizedHand, stepOffset: number) {
  const events = buildReplayEvents(hand);
  const firstPlaybackIdx = getFirstPlaybackIndex(events);
  const playbackEvents = getPlaybackEvents(events);
  const targetIdx = stepOffset < 0 ? firstPlaybackIdx - 1 : playbackEvents[stepOffset]?.index ?? events[events.length - 1].index;
  return { events, state: computeReplayState(hand, events, targetIdx), firstPlaybackIdx, playbackEvents };
}

function getFinalState(hand: NormalizedHand) {
  const events = buildReplayEvents(hand);
  const lastIdx = events[events.length - 1].index;
  return { events, state: computeReplayState(hand, events, lastIdx) };
}

// ── Scenario 1: Preflop raise → opponent folds → zero board cards ──
describe('Scenario 1: Preflop raise → fold', () => {
  const hand = makeHand({
    actions: [
      { index: 0, street: 'preflop', player: 'Hero', type: 'raise', amount: 60 },
      { index: 1, street: 'preflop', player: 'Villain', type: 'fold' },
    ],
    winners: [{ player: 'Hero', amount: 3 }],
  });

  it('has zero board cards at final state', () => {
    const { state } = getFinalState(hand);
    expect(state.board.length).toBe(0);
    expect(state.streetsDealt).toBe(0);
  });

  it('has streetsDealt=0 throughout', () => {
    const { playbackEvents } = getStateAtStep(hand, 0);
    for (let i = 0; i < playbackEvents.length; i++) {
      const { state } = getStateAtStep(hand, i);
      expect(state.streetsDealt).toBe(0);
      expect(state.board.length).toBe(0);
    }
  });

  it('is complete at final state', () => {
    const { state } = getFinalState(hand);
    expect(state.isComplete).toBe(true);
  });
});

// ── Scenario 2: Preflop shove → opponent folds → zero board cards ──
describe('Scenario 2: Preflop shove → fold', () => {
  const hand = makeHand({
    actions: [
      { index: 0, street: 'preflop', player: 'Hero', type: 'allin', amount: 1000 },
      { index: 1, street: 'preflop', player: 'Villain', type: 'fold' },
    ],
    winners: [{ player: 'Hero', amount: 3 }],
  });

  it('has zero board cards at final state', () => {
    const { state } = getFinalState(hand);
    expect(state.board.length).toBe(0);
    expect(state.streetsDealt).toBe(0);
    expect(state.isComplete).toBe(true);
  });
});

// ── Scenario 3: Preflop shove → opponent calls → full board runout ──
describe('Scenario 3: Preflop shove → call → board runout', () => {
  const hand = makeHand({
    actions: [
      { index: 0, street: 'preflop', player: 'Hero', type: 'allin', amount: 1000 },
      { index: 1, street: 'preflop', player: 'Villain', type: 'call', amount: 1000 },
      { index: 2, street: 'flop', player: 'Villain', type: 'check' },
      { index: 3, street: 'flop', player: 'Hero', type: 'check' },
      { index: 4, street: 'turn', player: 'Villain', type: 'check' },
      { index: 5, street: 'turn', player: 'Hero', type: 'check' },
      { index: 6, street: 'river', player: 'Villain', type: 'check' },
      { index: 7, street: 'river', player: 'Hero', type: 'check' },
      { index: 8, street: 'showdown', player: 'Hero', type: 'show' },
      { index: 9, street: 'showdown', player: 'Villain', type: 'muck' },
    ],
    board: { flop: ['As', 'Kd', '2c'], turn: '7h', river: '9d' },
    winners: [{ player: 'Hero', amount: 2000 }],
    players: [
      { name: 'Hero', seat: 1, stack: 1000, position: 'BTN', isHero: true, holeCards: ['Ah', 'Kd'], showdownCards: ['Ah', 'Kd'] },
      { name: 'Villain', seat: 2, stack: 1000, position: 'BB', isHero: false, showdownCards: ['Qs', 'Js'] },
    ],
  });

  it('deals flop as 3 cards simultaneously', () => {
    const events = buildReplayEvents(hand);
    const dealFlopEvent = events.find(e => e.type === 'deal_flop');
    expect(dealFlopEvent).toBeDefined();
    expect(dealFlopEvent!.cards?.length).toBe(3);
  });

  it('deals turn as exactly 1 card', () => {
    const events = buildReplayEvents(hand);
    const dealTurnEvent = events.find(e => e.type === 'deal_turn');
    expect(dealTurnEvent).toBeDefined();
    expect(dealTurnEvent!.cards?.length).toBe(1);
  });

  it('deals river as exactly 1 card', () => {
    const events = buildReplayEvents(hand);
    const dealRiverEvent = events.find(e => e.type === 'deal_river');
    expect(dealRiverEvent).toBeDefined();
    expect(dealRiverEvent!.cards?.length).toBe(1);
  });

  it('has 5 board cards at final state', () => {
    const { state } = getFinalState(hand);
    expect(state.board.length).toBe(5);
    expect(state.streetsDealt).toBe(3);
  });

  it('has correct board order: flop[3] then turn then river', () => {
    const { state } = getFinalState(hand);
    expect(state.board[0]).toBe('As');
    expect(state.board[1]).toBe('Kd');
    expect(state.board[2]).toBe('2c');
    expect(state.board[3]).toBe('7h');
    expect(state.board[4]).toBe('9d');
  });
});

// ── Scenario 4: Standard postflop hand → 3 flop, 1 turn, 1 river ──
describe('Scenario 4: Standard postflop hand board counts', () => {
  const hand = makeHand({
    actions: [
      { index: 0, street: 'preflop', player: 'Hero', type: 'raise', amount: 6 },
      { index: 1, street: 'preflop', player: 'Villain', type: 'call', amount: 4 },
      { index: 2, street: 'flop', player: 'Villain', type: 'check' },
      { index: 3, street: 'flop', player: 'Hero', type: 'bet', amount: 8 },
      { index: 4, street: 'flop', player: 'Villain', type: 'call', amount: 8 },
      { index: 5, street: 'turn', player: 'Villain', type: 'check' },
      { index: 6, street: 'turn', player: 'Hero', type: 'bet', amount: 20 },
      { index: 7, street: 'turn', player: 'Villain', type: 'call', amount: 20 },
      { index: 8, street: 'river', player: 'Villain', type: 'check' },
      { index: 9, street: 'river', player: 'Hero', type: 'bet', amount: 50 },
      { index: 10, street: 'river', player: 'Villain', type: 'call', amount: 50 },
      { index: 11, street: 'showdown', player: 'Hero', type: 'show' },
      { index: 12, street: 'showdown', player: 'Villain', type: 'muck' },
    ],
    board: { flop: ['Tc', '8d', '3s'], turn: 'Jh', river: '2d' },
    winners: [{ player: 'Hero', amount: 168 }],
    players: [
      { name: 'Hero', seat: 1, stack: 200, position: 'BTN', isHero: true, holeCards: ['Ah', 'Kd'], showdownCards: ['Ah', 'Kd'] },
      { name: 'Villain', seat: 2, stack: 200, position: 'BB', isHero: false, showdownCards: ['Qs', 'Js'] },
    ],
  });

  it('has exactly 3 board cards after flop deal', () => {
    const events = buildReplayEvents(hand);
    const dealFlopIdx = events.find(e => e.type === 'deal_flop')!.index;
    const state = computeReplayState(hand, events, dealFlopIdx);
    expect(state.board.length).toBe(3);
    expect(state.streetsDealt).toBe(1);
  });

  it('has exactly 4 board cards after turn deal', () => {
    const events = buildReplayEvents(hand);
    const dealTurnIdx = events.find(e => e.type === 'deal_turn')!.index;
    const state = computeReplayState(hand, events, dealTurnIdx);
    expect(state.board.length).toBe(4);
    expect(state.streetsDealt).toBe(2);
  });

  it('has exactly 5 board cards after river deal', () => {
    const events = buildReplayEvents(hand);
    const dealRiverIdx = events.find(e => e.type === 'deal_river')!.index;
    const state = computeReplayState(hand, events, dealRiverIdx);
    expect(state.board.length).toBe(5);
    expect(state.streetsDealt).toBe(3);
  });
});

// ── Scenario 5: Hand ending on flop → exactly 3 board cards ──
describe('Scenario 5: Hand ending on flop', () => {
  const hand = makeHand({
    actions: [
      { index: 0, street: 'preflop', player: 'Hero', type: 'raise', amount: 6 },
      { index: 1, street: 'preflop', player: 'Villain', type: 'call', amount: 4 },
      { index: 2, street: 'flop', player: 'Villain', type: 'check' },
      { index: 3, street: 'flop', player: 'Hero', type: 'bet', amount: 100 },
      { index: 4, street: 'flop', player: 'Villain', type: 'fold' },
    ],
    board: { flop: ['Ac', 'Kd', '2c'], turn: null, river: null },
    winners: [{ player: 'Hero', amount: 14 }],
  });

  it('has exactly 3 board cards at final state', () => {
    const { state } = getFinalState(hand);
    expect(state.board.length).toBe(3);
    expect(state.streetsDealt).toBe(1);
    expect(state.isComplete).toBe(true);
  });
});

// ── Scenario 6: Hand ending on turn → exactly 4 board cards ──
describe('Scenario 6: Hand ending on turn', () => {
  const hand = makeHand({
    actions: [
      { index: 0, street: 'preflop', player: 'Hero', type: 'raise', amount: 6 },
      { index: 1, street: 'preflop', player: 'Villain', type: 'call', amount: 4 },
      { index: 2, street: 'flop', player: 'Villain', type: 'check' },
      { index: 3, street: 'flop', player: 'Hero', type: 'bet', amount: 12 },
      { index: 4, street: 'flop', player: 'Villain', type: 'call', amount: 12 },
      { index: 5, street: 'turn', player: 'Villain', type: 'check' },
      { index: 6, street: 'turn', player: 'Hero', type: 'bet', amount: 50 },
      { index: 7, street: 'turn', player: 'Villain', type: 'fold' },
    ],
    board: { flop: ['Ac', 'Kd', '2c'], turn: '7h', river: null },
    winners: [{ player: 'Hero', amount: 38 }],
  });

  it('has exactly 4 board cards at final state', () => {
    const { state } = getFinalState(hand);
    expect(state.board.length).toBe(4);
    expect(state.streetsDealt).toBe(2);
    expect(state.isComplete).toBe(true);
  });
});

// ── Scenario 7: Rapidly switching between hands with different ending streets ──
describe('Scenario 7: Hand switching produces correct board', () => {
  const preflopHand = makeHand({
    handId: 'preflop-only',
    actions: [
      { index: 0, street: 'preflop', player: 'Hero', type: 'raise', amount: 60 },
      { index: 1, street: 'preflop', player: 'Villain', type: 'fold' },
    ],
    winners: [{ player: 'Hero', amount: 3 }],
  });

  const riverHand = makeHand({
    handId: 'river-hand',
    actions: [
      { index: 0, street: 'preflop', player: 'Hero', type: 'raise', amount: 6 },
      { index: 1, street: 'preflop', player: 'Villain', type: 'call', amount: 4 },
      { index: 2, street: 'flop', player: 'Villain', type: 'check' },
      { index: 3, street: 'flop', player: 'Hero', type: 'check' },
      { index: 4, street: 'turn', player: 'Villain', type: 'check' },
      { index: 5, street: 'turn', player: 'Hero', type: 'check' },
      { index: 6, street: 'river', player: 'Villain', type: 'check' },
      { index: 7, street: 'river', player: 'Hero', type: 'check' },
    ],
    board: { flop: ['Ah', 'Kd', '2c'], turn: '7h', river: '9d' },
    winners: [{ player: 'Hero', amount: 12 }],
  });

  it('preflop hand: 0 board cards at final', () => {
    const { state } = getFinalState(preflopHand);
    expect(state.board.length).toBe(0);
  });

  it('river hand: 5 board cards at final', () => {
    const { state } = getFinalState(riverHand);
    expect(state.board.length).toBe(5);
  });

  it('computing preflop hand then river hand gives correct boards independently', () => {
    const preflopFinal = getFinalState(preflopHand);
    const riverFinal = getFinalState(riverHand);
    expect(preflopFinal.state.board.length).toBe(0);
    expect(riverFinal.state.board.length).toBe(5);
    expect(riverFinal.state.board).toEqual(['Ah', 'Kd', '2c', '7h', '9d']);
  });
});

// ── Scenario 8: Rapid step-through — board appears in correct order ──
describe('Scenario 8: Rapid step-through board sequence', () => {
  const hand = makeHand({
    actions: [
      { index: 0, street: 'preflop', player: 'Hero', type: 'raise', amount: 6 },
      { index: 1, street: 'preflop', player: 'Villain', type: 'call', amount: 4 },
      { index: 2, street: 'flop', player: 'Villain', type: 'check' },
      { index: 3, street: 'flop', player: 'Hero', type: 'check' },
      { index: 4, street: 'turn', player: 'Villain', type: 'check' },
      { index: 5, street: 'turn', player: 'Hero', type: 'check' },
      { index: 6, street: 'river', player: 'Villain', type: 'check' },
      { index: 7, street: 'river', player: 'Hero', type: 'check' },
    ],
    board: { flop: ['Ah', 'Kd', '2c'], turn: '7h', river: '9d' },
    winners: [{ player: 'Hero', amount: 12 }],
  });

  it('board grows: 0 → 3 → 4 → 5 as streets are dealt', () => {
    const events = buildReplayEvents(hand);
    const dealFlopIdx = events.find(e => e.type === 'deal_flop')!.index;
    const dealTurnIdx = events.find(e => e.type === 'deal_turn')!.index;
    const dealRiverIdx = events.find(e => e.type === 'deal_river')!.index;

    const beforeFlop = computeReplayState(hand, events, dealFlopIdx - 1);
    const atFlop = computeReplayState(hand, events, dealFlopIdx);
    const atTurn = computeReplayState(hand, events, dealTurnIdx);
    const atRiver = computeReplayState(hand, events, dealRiverIdx);

    expect(beforeFlop.board.length).toBe(0);
    expect(atFlop.board.length).toBe(3);
    expect(atFlop.board).toEqual(['Ah', 'Kd', '2c']);
    expect(atTurn.board.length).toBe(4);
    expect(atTurn.board[3]).toBe('7h');
    expect(atRiver.board.length).toBe(5);
    expect(atRiver.board[4]).toBe('9d');
  });

  it('stepping backward from river to preflop resets board to 0', () => {
    const events = buildReplayEvents(hand);
    const firstPlaybackIdx = getFirstPlaybackIndex(events);
    const riverFinalIdx = events[events.length - 1].index;

    const atRiver = computeReplayState(hand, events, riverFinalIdx);
    expect(atRiver.board.length).toBe(5);

    const atStart = computeReplayState(hand, events, firstPlaybackIdx - 1);
    expect(atStart.board.length).toBe(0);
  });
});

// ── Scenario 9: HHReplayer and PokerTable rendering same hand consistently ──
describe('Scenario 9: Shared engine produces deterministic state', () => {
  const hand = makeHand({
    handId: 'consistency-test',
    actions: [
      { index: 0, street: 'preflop', player: 'Hero', type: 'allin', amount: 1000 },
      { index: 1, street: 'preflop', player: 'Villain', type: 'fold' },
    ],
    winners: [{ player: 'Hero', amount: 5 }],
  });

  it('computeReplayState is deterministic across multiple calls', () => {
    const { state: s1 } = getFinalState(hand);
    const { state: s2 } = getFinalState(hand);
    expect(s1.board).toEqual(s2.board);
    expect(s1.streetsDealt).toEqual(s2.streetsDealt);
    expect(s1.isComplete).toEqual(s2.isComplete);
  });

  it('preflop allin+fold: no deal events in timeline', () => {
    const events = buildReplayEvents(hand);
    const dealEvents = events.filter(e => ['deal_flop', 'deal_turn', 'deal_river'].includes(e.type));
    expect(dealEvents.length).toBe(0);
  });
});

// ── Stale placeholder check: completed preflop hand must not show board slots ──
describe('Stale placeholder check', () => {
  const hand = makeHand({
    actions: [
      { index: 0, street: 'preflop', player: 'Hero', type: 'allin', amount: 1000 },
      { index: 1, street: 'preflop', player: 'Villain', type: 'fold' },
    ],
    winners: [{ player: 'Hero', amount: 5 }],
  });

  it('completed preflop hand: streetsDealt=0 AND isComplete=true', () => {
    const { state } = getFinalState(hand);
    expect(state.streetsDealt).toBe(0);
    expect(state.isComplete).toBe(true);
    expect(state.board.length).toBe(0);
  });

  it('completed flop hand: streetsDealt=1, board=3, no turn/river data', () => {
    const flopHand = makeHand({
      actions: [
        { index: 0, street: 'preflop', player: 'Hero', type: 'raise', amount: 6 },
        { index: 1, street: 'preflop', player: 'Villain', type: 'call', amount: 4 },
        { index: 2, street: 'flop', player: 'Villain', type: 'check' },
        { index: 3, street: 'flop', player: 'Hero', type: 'bet', amount: 100 },
        { index: 4, street: 'flop', player: 'Villain', type: 'fold' },
      ],
      board: { flop: ['Ac', 'Kd', '2c'], turn: null, river: null },
      winners: [{ player: 'Hero', amount: 14 }],
    });
    const { state } = getFinalState(flopHand);
    expect(state.streetsDealt).toBe(1);
    expect(state.isComplete).toBe(true);
    expect(state.board.length).toBe(3);
  });
});
