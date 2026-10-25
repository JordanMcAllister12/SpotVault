import { describe, it, expect } from 'vitest';
import { analyzePreflopState, didReachShowdown } from '@/lib/preflopStateMachine';
import type { ActionEntry } from '@/lib/pokerAnalytics';
import { computeAdvancedStatsForHand, createEmptyAdvancedStats } from '@/lib/advancedStats';
import { computeDerivedFields } from '@/lib/pokerAnalytics';

const HERO = 'Hero';

function act(street: 'preflop' | 'flop' | 'turn' | 'river', player: string, action: string, amount: number | null = null): ActionEntry {
  return { street, player, action, amount };
}

describe('Preflop state machine — VPIP', () => {
  it('call counts as VPIP', () => {
    const actions = [act('preflop', HERO, 'call', 100)];
    const s = analyzePreflopState(actions, HERO);
    expect(s.vpip).toBe(true);
  });

  it('raise counts as VPIP', () => {
    const actions = [act('preflop', HERO, 'raise', 200)];
    const s = analyzePreflopState(actions, HERO);
    expect(s.vpip).toBe(true);
  });

  it('posting BB does NOT count as VPIP', () => {
    const actions = [act('preflop', HERO, 'post', 100)];
    const s = analyzePreflopState(actions, HERO);
    expect(s.vpip).toBe(false);
  });

  it('posting ante does NOT count as VPIP', () => {
    const actions = [act('preflop', HERO, 'post_ante', 20)];
    const s = analyzePreflopState(actions, HERO);
    expect(s.vpip).toBe(false);
  });

  it('checking BB does NOT count as VPIP', () => {
    const actions = [act('preflop', HERO, 'post', 100), act('preflop', HERO, 'check')];
    const s = analyzePreflopState(actions, HERO);
    expect(s.vpip).toBe(false);
  });

  it('fold after posting BB does NOT count as VPIP', () => {
    const actions = [act('preflop', HERO, 'post', 100), act('preflop', HERO, 'fold')];
    const s = analyzePreflopState(actions, HERO);
    expect(s.vpip).toBe(false);
  });
});

describe('Preflop state machine — PFR', () => {
  it('open raise counts as PFR', () => {
    const actions = [act('preflop', HERO, 'raise', 200)];
    const s = analyzePreflopState(actions, HERO);
    expect(s.pfr).toBe(true);
    expect(s.raiseLevel).toBe(1);
  });

  it('call does NOT count as PFR', () => {
    const actions = [act('preflop', 'Villain', 'raise', 200), act('preflop', HERO, 'call', 200)];
    const s = analyzePreflopState(actions, HERO);
    expect(s.pfr).toBe(false);
    expect(s.vpip).toBe(true);
  });

  it('all-in counts as PFR', () => {
    const actions = [act('preflop', HERO, 'all-in', 5000)];
    const s = analyzePreflopState(actions, HERO);
    expect(s.pfr).toBe(true);
  });

  it('PFR <= VPIP invariant: raise implies VPIP', () => {
    const actions = [act('preflop', HERO, 'raise', 200)];
    const s = analyzePreflopState(actions, HERO);
    expect(s.pfr).toBe(true);
    expect(s.vpip).toBe(true);
  });
});

describe('Preflop state machine — 3-Bet', () => {
  it('villain opens, hero reraises = 3-bet', () => {
    const actions = [
      act('preflop', 'Villain', 'raise', 200),
      act('preflop', HERO, 'raise', 600),
    ];
    const s = analyzePreflopState(actions, HERO);
    expect(s.threeBet).toBe(true);
    expect(s.threeBetOpportunity).toBe(true);
    expect(s.raiseLevel).toBe(2);
  });

  it('hero open raises = NOT a 3-bet', () => {
    const actions = [act('preflop', HERO, 'raise', 200)];
    const s = analyzePreflopState(actions, HERO);
    expect(s.threeBet).toBe(false);
    expect(s.threeBetOpportunity).toBe(false);
    expect(s.raiseLevel).toBe(1);
  });

  it('villain limps, hero raises = NOT a 3-bet (isolation raise)', () => {
    const actions = [
      act('preflop', 'Villain', 'call', 100),
      act('preflop', HERO, 'raise', 300),
    ];
    const s = analyzePreflopState(actions, HERO);
    expect(s.threeBet).toBe(false);
    expect(s.raiseLevel).toBe(1);
  });

  it('hero opens, villain reraises, hero reraises = 4-bet NOT 3-bet', () => {
    const actions = [
      act('preflop', HERO, 'raise', 200),
      act('preflop', 'Villain', 'raise', 600),
      act('preflop', HERO, 'raise', 1800),
    ];
    const s = analyzePreflopState(actions, HERO);
    expect(s.threeBet).toBe(false);
    expect(s.raiseLevel).toBe(3);
  });

  it('villain opens, hero calls = NOT a 3-bet opportunity consumed', () => {
    const actions = [
      act('preflop', 'Villain', 'raise', 200),
      act('preflop', HERO, 'call', 200),
    ];
    const s = analyzePreflopState(actions, HERO);
    expect(s.threeBet).toBe(false);
    expect(s.threeBetOpportunity).toBe(true);
  });

  it('villain opens, hero folds = opportunity but no 3-bet', () => {
    const actions = [
      act('preflop', 'Villain', 'raise', 200),
      act('preflop', HERO, 'fold'),
    ];
    const s = analyzePreflopState(actions, HERO);
    expect(s.threeBet).toBe(false);
    expect(s.threeBetOpportunity).toBe(true);
  });

  it('multiple raisers: UTG opens, MP reraises, hero reraises = 4-bet', () => {
    const actions = [
      act('preflop', 'UTG', 'raise', 200),
      act('preflop', 'MP', 'raise', 600),
      act('preflop', HERO, 'raise', 1800),
    ];
    const s = analyzePreflopState(actions, HERO);
    expect(s.threeBet).toBe(false);
    expect(s.raiseLevel).toBe(3);
  });

  it('3-bet <= opportunity invariant', () => {
    const actions = [
      act('preflop', 'Villain', 'raise', 200),
      act('preflop', HERO, 'raise', 600),
    ];
    const s = analyzePreflopState(actions, HERO);
    expect(s.threeBet).toBe(true);
    expect(s.threeBetOpportunity).toBe(true);
    expect(s.threeBet === true ? 1 : 0).toBeLessThanOrEqual(s.threeBetOpportunity ? 1 : 0);
  });

  it('covers the seven preflop opportunity outcomes', () => {
    const cases = [
      { actions: [act('preflop', 'Villain', 'raise', 200), act('preflop', HERO, 'fold')], opp: true, threeBet: false },
      { actions: [act('preflop', 'Villain', 'raise', 200), act('preflop', HERO, 'call', 200)], opp: true, threeBet: false },
      { actions: [act('preflop', 'Villain', 'raise', 200), act('preflop', HERO, 'raise', 600)], opp: true, threeBet: true },
      { actions: [act('preflop', HERO, 'raise', 200), act('preflop', 'Villain', 'raise', 600), act('preflop', HERO, 'fold')], opp: false, threeBet: false },
      { actions: [act('preflop', HERO, 'raise', 200), act('preflop', 'Villain', 'raise', 600), act('preflop', HERO, 'call', 400)], opp: false, threeBet: false },
      { actions: [act('preflop', HERO, 'raise', 200), act('preflop', 'Villain', 'raise', 600), act('preflop', HERO, 'raise', 1800)], opp: false, threeBet: false },
      { actions: [act('preflop', 'Player A', 'raise', 200), act('preflop', 'Player B', 'raise', 600), act('preflop', HERO, 'call', 600)], opp: true, threeBet: false },
    ];

    for (const testCase of cases) {
      const result = analyzePreflopState(testCase.actions, HERO);
      expect(result.threeBetOpportunity).toBe(testCase.opp);
      expect(result.threeBet).toBe(testCase.threeBet);
    }
  });
});

describe('Flat 3-bet classification', () => {
  it('classifies Hero open, villain 3-bet, Hero call as flat 3-bet', () => {
    const result = computeDerivedFields([
      act('preflop', HERO, 'raise', 200),
      act('preflop', 'Villain', 'raise', 600),
      act('preflop', HERO, 'call', 400),
    ], HERO, false, false, false);
    expect(result.hero_flat_3bet).toBe(true);
    expect(result.hero_cold_call_3bet).toBe(false);
  });

  it('classifies open, 3-bet, Hero fold as faced 3-bet but not flat call', () => {
    const result = computeDerivedFields([
      act('preflop', HERO, 'raise', 200),
      act('preflop', 'Villain', 'raise', 600),
      act('preflop', HERO, 'fold'),
    ], HERO, false, false, false);
    expect(result.hero_faced_3bet).toBe(true);
    expect(result.hero_flat_3bet).toBe(false);
  });

  it('separates cold-calling a 3-bet from flat-calling after Hero opens', () => {
    const result = computeDerivedFields([
      act('preflop', 'Player A', 'raise', 200),
      act('preflop', 'Player B', 'raise', 600),
      act('preflop', HERO, 'call', 600),
    ], HERO, false, false, false);
    expect(result.hero_flat_3bet).toBe(false);
    expect(result.hero_cold_call_3bet).toBe(true);
  });
});

describe('Flop c-bet success', () => {
  it('counts an uncontested heads-up c-bet as successful', () => {
    const stats = createEmptyAdvancedStats();
    computeAdvancedStatsForHand(stats, [
      act('preflop', HERO, 'raise', 200),
      act('preflop', 'Villain', 'call', 200),
      act('flop', 'Villain', 'check'),
      act('flop', HERO, 'bet', 300),
      act('flop', 'Villain', 'fold'),
    ], HERO, 'BTN', true, false, false);
    expect(stats.flopCbetSuccessOppCount).toBe(1);
    expect(stats.flopCbetSuccessCount).toBe(1);
  });

  it('does not count a c-bet success when one opponent calls', () => {
    const stats = createEmptyAdvancedStats();
    computeAdvancedStatsForHand(stats, [
      act('preflop', HERO, 'raise', 200),
      act('preflop', 'Villain A', 'call', 200),
      act('preflop', 'Villain B', 'call', 200),
      act('flop', 'Villain A', 'check'),
      act('flop', 'Villain B', 'check'),
      act('flop', HERO, 'bet', 300),
      act('flop', 'Villain A', 'fold'),
      act('flop', 'Villain B', 'call', 300),
    ], HERO, 'BTN', true, false, false);
    expect(stats.flopCbetSuccessOppCount).toBe(1);
    expect(stats.flopCbetSuccessCount).toBe(0);
  });

  it('counts a multiway c-bet as successful only when every opponent folds', () => {
    const stats = createEmptyAdvancedStats();
    computeAdvancedStatsForHand(stats, [
      act('preflop', HERO, 'raise', 200),
      act('preflop', 'Villain A', 'call', 200),
      act('preflop', 'Villain B', 'call', 200),
      act('flop', 'Villain A', 'check'),
      act('flop', 'Villain B', 'check'),
      act('flop', HERO, 'bet', 300),
      act('flop', 'Villain A', 'fold'),
      act('flop', 'Villain B', 'fold'),
    ], HERO, 'BTN', true, false, false);
    expect(stats.flopCbetSuccessOppCount).toBe(1);
    expect(stats.flopCbetSuccessCount).toBe(1);
  });
});

describe('didReachShowdown', () => {
  it('returns true when SHOW DOWN section has hero showing cards', () => {
    const raw = `*** RIVER *** [As Kh 2d 5c 9h]
Hero: bets 100
Villain: calls 100
*** SHOW DOWN ***
Hero: shows [Ah Kd] (pair of Aces)
Villain: shows [Ks Qc] (pair of Kings)
*** SUMMARY ***`;
    expect(didReachShowdown(raw, 'Hero')).toBe(true);
  });

  it('returns false when no SHOW DOWN section', () => {
    const raw = `*** RIVER *** [As Kh 2d 5c 9h]
Hero: bets 100
Villain: folds
*** SUMMARY ***`;
    expect(didReachShowdown(raw, 'Hero')).toBe(false);
  });

  it('returns false when SHOW DOWN exists but hero is not in it', () => {
    const raw = `*** RIVER *** [As Kh 2d 5c 9h]
Hero: folds
*** SHOW DOWN ***
Villain1: shows [Ah Kd]
Villain2: shows [Ks Qc]
*** SUMMARY ***`;
    expect(didReachShowdown(raw, 'Hero')).toBe(false);
  });

  it('returns false for empty text', () => {
    expect(didReachShowdown('', 'Hero')).toBe(false);
  });

  it('returns false for all-in without showdown section', () => {
    const raw = `Poker Hand #123
Hero: all-in 5000
Villain: calls 5000
*** SUMMARY ***
Total pot 10000`;
    expect(didReachShowdown(raw, 'Hero')).toBe(false);
  });

  it('returns true for all-in WITH showdown section showing cards', () => {
    const raw = `Poker Hand #123
Hero: all-in 5000
Villain: calls 5000
*** SHOW DOWN ***
Hero: shows [Ah Kd]
Villain: shows [Ks Qc]
*** SUMMARY ***`;
    expect(didReachShowdown(raw)).toBe(true);
  });

  it('handles GG format with \\\+ markers', () => {
    const raw = `\\\+ RIVER \\\+ [As Kh 2d 5c 9h]
Hero: bets 100
Villain: calls 100
\\\+ SHOW DOWN \\\+
Hero: shows [Ah Kd]
\\\+ SUMMARY \\\+`;
    expect(didReachShowdown(raw, 'Hero')).toBe(true);
  });
});
