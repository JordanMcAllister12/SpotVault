/**
 * WTSD / showdown classification regression tests.
 *
 * Hand2Note defines WTSD as: WentToSDCases(Flop Any Action) / Cases(Flop Any Action)
 * "Flop Any Action" means the player made at least one postflop action on the flop.
 * Preflop all-in hands where the board runs out but Hero made no flop decision
 * are excluded from the WTSD/WWSF denominator.
 *
 * These tests verify:
 *   - Hero sees flop and folds turn → not showdown, saw_flop=true, made flop action
 *   - Hero sees flop and folds river → not showdown, saw_flop=true, made flop action
 *   - Hero reaches showdown and wins → showdown=true, made flop action
 *   - Hero reaches showdown and loses → showdown=true, made flop action
 *   - Hero wins without showdown → showdown=false
 *   - Hero folds preflop while remaining players reach showdown → showdown=false, no flop action
 *   - Hero all-in preflop and reaches showdown → showdown=true, but no flop action
 *   - Opponent reveals cards after Hero folds → showdown=false for Hero
 *   - Multiway pot where Hero folds and other players reach showdown → showdown=false
 *   - Split pot at showdown → showdown=true
 */

import { describe, it, expect } from 'vitest';
import { parseHandBlock } from '@/lib/pokerAnalytics';
import { didReachShowdown } from '@/lib/preflopStateMachine';

const MODE = 'mtt' as const;

function classifyHand(rawText: string, heroName = 'Hero') {
  const parsed = parseHandBlock(rawText, 'GGPoker', MODE);
  if (!parsed) throw new Error('parseHandBlock returned null');

  const heroActions = parsed.actions.filter((a) => a.player === heroName);
  const heroFlopActions = heroActions.filter((a) => a.street === 'flop' &&
    ['check', 'bet', 'call', 'raise', 'all-in', 'fold'].includes(a.action));
  const heroMadeFlopAction = heroFlopActions.length > 0;
  const heroFoldedPreflop = heroActions.some((a) => a.street === 'preflop' && a.action === 'fold');

  const showdown = didReachShowdown(rawText, heroName);

  return {
    sawFlop: parsed.sawFlop,
    showdown,
    heroMadeFlopAction,
    heroFoldedPreflop,
    heroActions,
  };
}

describe('WTSD classification — Hero sees flop and folds turn', () => {
  const hand = `Poker Hand #TM001: Tournament #T1, $10 Hold'em No Limit - Level1(50/100(10)) - 2026/10/21 13:00:00
Table '1' 8-max Seat #5 is the button
Seat 1: Hero (10,000 in chips)
Seat 2: Villain (10,000 in chips)
Seat 5: Button (10,000 in chips)
Hero: posts the ante 10
Villain: posts the ante 10
Button: posts the ante 10
Villain: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Button: folds
Hero: raises 100 to 200
Villain: calls 150
*** FLOP *** [8h 4s 2c]
Hero: bets 150
Villain: calls 150
*** TURN *** [8h 4s 2c] [5d]
Hero: bets 400
Villain: raises 800 to 1,200
Hero: folds
Uncalled bet (800) returned to Villain
Villain collected 800 from pot
*** SUMMARY ***
Total pot 800 | Rake 0
Board [8h 4s 2c 5d]
Seat 1: Hero (big blind) folded on the Turn
Seat 2: Villain (small blind) collected (800)
Seat 5: Button folded before Flop
`;

  it('Hero folded turn — showdown=false, made flop action=true', () => {
    const c = classifyHand(hand);
    expect(c.showdown).toBe(false);
    expect(c.heroMadeFlopAction).toBe(true);
    expect(c.sawFlop).toBe(true);
    expect(c.heroFoldedPreflop).toBe(false);
  });
});

describe('WTSD classification — Hero sees flop and folds river', () => {
  const hand = `Poker Hand #TM002: Tournament #T1, $10 Hold'em No Limit - Level1(50/100(10)) - 2026/10/21 13:05:00
Table '1' 8-max Seat #5 is the button
Seat 1: Hero (10,000 in chips)
Seat 2: Villain (10,000 in chips)
Seat 5: Button (10,000 in chips)
Hero: posts the ante 10
Villain: posts the ante 10
Button: posts the ante 10
Villain: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Button: folds
Hero: raises 100 to 200
Villain: calls 150
*** FLOP *** [8h 4s 2c]
Hero: bets 150
Villain: calls 150
*** TURN *** [8h 4s 2c] [5d]
Hero: checks
Villain: checks
*** RIVER *** [8h 4s 2c 5d] [Js]
Hero: bets 300
Villain: raises 600 to 900
Hero: folds
Uncalled bet (600) returned to Villain
Villain collected 750 from pot
*** SUMMARY ***
Total pot 750 | Rake 0
Board [8h 4s 2c 5d Js]
Seat 1: Hero (big blind) folded on the River
Seat 2: Villain (small blind) collected (750)
Seat 5: Button folded before Flop
`;

  it('Hero folded river — showdown=false, made flop action=true', () => {
    const c = classifyHand(hand);
    expect(c.showdown).toBe(false);
    expect(c.heroMadeFlopAction).toBe(true);
    expect(c.sawFlop).toBe(true);
  });
});

describe('WTSD classification — Hero reaches showdown and wins', () => {
  const hand = `Poker Hand #TM003: Tournament #T1, $10 Hold'em No Limit - Level1(50/100(10)) - 2026/10/21 13:10:00
Table '1' 8-max Seat #5 is the button
Seat 1: Hero (10,000 in chips)
Seat 2: Villain (10,000 in chips)
Seat 5: Button (10,000 in chips)
Hero: posts the ante 10
Villain: posts the ante 10
Button: posts the ante 10
Villain: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Ah Ac]
Button: folds
Hero: raises 100 to 300
Villain: calls 250
*** FLOP *** [8h 4s 2c]
Hero: bets 200
Villain: calls 200
*** TURN *** [8h 4s 2c] [5d]
Hero: bets 500
Villain: calls 500
*** RIVER *** [8h 4s 2c 5d] [Js]
Hero: bets 1,000
Villain: calls 1,000
Hero: shows [Ah Ac] (a pair of Aces)
Villain: shows [Kh Qd] (high card, King)
*** SHOWDOWN ***
Hero collected 3,310 from pot
*** SUMMARY ***
Total pot 3,310 | Rake 0
Board [8h 4s 2c 5d Js]
Seat 1: Hero (big blind) showed [Ah Ac] and won (3,310) with a pair of Aces
Seat 2: Villain (small blind) showed [Kh Qd] and lost with high card, King
Seat 5: Button folded before Flop
`;

  it('Hero won at showdown — showdown=true, made flop action=true', () => {
    const c = classifyHand(hand);
    expect(c.showdown).toBe(true);
    expect(c.heroMadeFlopAction).toBe(true);
    expect(c.sawFlop).toBe(true);
  });
});

describe('WTSD classification — Hero reaches showdown and loses', () => {
  const hand = `Poker Hand #TM004: Tournament #T1, $10 Hold'em No Limit - Level1(50/100(10)) - 2026/10/21 13:15:00
Table '1' 8-max Seat #5 is the button
Seat 1: Hero (10,000 in chips)
Seat 2: Villain (10,000 in chips)
Seat 5: Button (10,000 in chips)
Hero: posts the ante 10
Villain: posts the ante 10
Button: posts the ante 10
Villain: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Button: folds
Hero: raises 100 to 300
Villain: calls 250
*** FLOP *** [8h 4s 2c]
Hero: bets 200
Villain: calls 200
*** TURN *** [8h 4s 2c] [5d]
Hero: bets 500
Villain: calls 500
*** RIVER *** [8h 4s 2c 5d] [Js]
Hero: bets 1,000
Villain: calls 1,000
Villain: shows [8d 8c] (three of a kind, Eights)
Hero: shows [Ah Kh] (high card, Ace)
*** SHOWDOWN ***
Villain collected 3,310 from pot
*** SUMMARY ***
Total pot 3,310 | Rake 0
Board [8h 4s 2c 5d Js]
Seat 1: Hero (big blind) showed [Ah Kh] and lost with high card, Ace
Seat 2: Villain (small blind) showed [8d 8c] and won (3,310) with three of a kind, Eights
Seat 5: Button folded before Flop
`;

  it('Hero lost at showdown — showdown=true, made flop action=true', () => {
    const c = classifyHand(hand);
    expect(c.showdown).toBe(true);
    expect(c.heroMadeFlopAction).toBe(true);
    expect(c.sawFlop).toBe(true);
  });
});

describe('WTSD classification — Hero wins without showdown (opponent folds)', () => {
  const hand = `Poker Hand #TM005: Tournament #T1, $10 Hold'em No Limit - Level1(50/100(10)) - 2026/10/21 13:20:00
Table '1' 8-max Seat #5 is the button
Seat 1: Hero (10,000 in chips)
Seat 2: Villain (10,000 in chips)
Seat 5: Button (10,000 in chips)
Hero: posts the ante 10
Villain: posts the ante 10
Button: posts the ante 10
Villain: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Button: folds
Hero: raises 100 to 300
Villain: folds
Uncalled bet (200) returned to Hero
Hero collected 160 from pot
*** SUMMARY ***
Total pot 160 | Rake 0
Seat 1: Hero (big blind) collected (160)
Seat 2: Villain (small blind) folded before Flop
Seat 5: Button folded before Flop
`;

  it('Hero won without showdown — showdown=false, no flop action', () => {
    const c = classifyHand(hand);
    expect(c.showdown).toBe(false);
    expect(c.heroMadeFlopAction).toBe(false);
    expect(c.sawFlop).toBe(false);
  });
});

describe('WTSD classification — Hero folds preflop, others reach showdown', () => {
  const hand = `Poker Hand #TM006: Tournament #T1, $10 Hold'em No Limit - Level1(50/100(10)) - 2026/10/21 13:25:00
Table '1' 8-max Seat #5 is the button
Seat 1: Hero (10,000 in chips)
Seat 2: Villain (10,000 in chips)
Seat 5: Button (10,000 in chips)
Hero: posts the ante 10
Villain: posts the ante 10
Button: posts the ante 10
Villain: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [2d 7c]
Button: raises 100 to 300
Hero: folds
Villain: calls 250
*** FLOP *** [Ah Kh Qs]
Villain: checks
Button: bets 200
Villain: calls 200
*** TURN *** [Ah Kh Qs] [Jd]
Villain: checks
Button: bets 500
Villain: calls 500
*** RIVER *** [Ah Kh Qs Jd] [Tc]
Villain: checks
Button: bets 1,000
Villain: calls 1,000
Villain: shows [Kc Qd] (two pair, Kings and Queens)
Button: shows [Ad Ac] (a pair of Aces)
*** SHOWDOWN ***
Villain collected 3,510 from pot
*** SUMMARY ***
Total pot 3,510 | Rake 0
Board [Ah Kh Qs Jd Tc]
Seat 1: Hero (big blind) folded before Flop
Seat 2: Villain (small blind) showed [Kc Qd] and won (3,510) with two pair, Kings and Queens
Seat 5: Button showed [Ad Ac] and lost with a pair of Aces
`;

  it('Hero folded preflop, others showed — showdown=false, no flop action', () => {
    const c = classifyHand(hand);
    expect(c.showdown).toBe(false);
    expect(c.heroMadeFlopAction).toBe(false);
    expect(c.sawFlop).toBe(false);
    expect(c.heroFoldedPreflop).toBe(true);
  });
});

describe('WTSD classification — Hero all-in preflop, reaches showdown (no flop action)', () => {
  const hand = `Poker Hand #TM007: Tournament #T1, $10 Hold'em No Limit - Level1(50/100(10)) - 2026/10/21 13:30:00
Table '1' 8-max Seat #5 is the button
Seat 1: Hero (5,000 in chips)
Seat 2: Villain (10,000 in chips)
Seat 5: Button (10,000 in chips)
Hero: posts the ante 10
Villain: posts the ante 10
Button: posts the ante 10
Villain: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Button: folds
Hero: raises 4,900 to 5,000 and is all-in
Villain: calls 4,950
*** FLOP *** [8h 4s 2c]
*** TURN *** [8h 4s 2c] [5d]
*** RIVER *** [8h 4s 2c 5d] [Js]
Hero: shows [Ah Kh] (high card, Ace)
Villain: shows [Kd Qc] (high card, King)
*** SHOWDOWN ***
Hero collected 10,010 from pot
*** SUMMARY ***
Total pot 10,010 | Rake 0
Board [8h 4s 2c 5d Js]
Seat 1: Hero (big blind) showed [Ah Kh] and won (10,010) with high card, Ace
Seat 2: Villain (small blind) showed [Kd Qc] and lost with high card, King
Seat 5: Button folded before Flop
`;

  it('Hero all-in preflop, showdown=true, but NO flop action (excluded from WTSD)', () => {
    const c = classifyHand(hand);
    expect(c.showdown).toBe(true);
    expect(c.heroMadeFlopAction).toBe(false);  // No flop action — excluded from WTSD
    expect(c.sawFlop).toBe(true);              // Board was dealt and Hero didn't fold
    expect(c.heroFoldedPreflop).toBe(false);
  });
});

describe('WTSD classification — Opponent reveals cards after Hero folds (multiway)', () => {
  const hand = `Poker Hand #TM008: Tournament #T1, $10 Hold'em No Limit - Level1(50/100(10)) - 2026/10/21 13:35:00
Table '1' 8-max Seat #5 is the button
Seat 1: Hero (10,000 in chips)
Seat 2: VillainA (10,000 in chips)
Seat 5: VillainB (10,000 in chips)
Hero: posts the ante 10
VillainA: posts the ante 10
VillainB: posts the ante 10
VillainA: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [2d 7c]
VillainB: raises 100 to 300
Hero: folds
VillainA: calls 250
*** FLOP *** [Ah Kh Qs]
VillainA: checks
VillainB: bets 200
VillainA: raises 400 to 600
VillainB: calls 400
*** TURN *** [Ah Kh Qs] [Jd]
VillainA: bets 1,000
VillainB: calls 1,000
*** RIVER *** [Ah Kh Qs Jd] [Tc]
VillainA: bets 2,000
VillainB: calls 2,000
VillainA: shows [Kc Qd] (two pair, Kings and Queens)
VillainB: shows [Ad Ac] (a pair of Aces)
*** SHOWDOWN ***
VillainA collected 7,510 from pot
*** SUMMARY ***
Total pot 7,510 | Rake 0
Board [Ah Kh Qs Jd Tc]
Seat 1: Hero (big blind) folded before Flop
Seat 2: VillainA (small blind) showed [Kc Qd] and won (7,510) with two pair, Kings and Queens
Seat 5: VillainB (button) showed [Ad Ac] and lost with a pair of Aces
`;

  it('Hero folded, others showed — showdown=false, no flop action for Hero', () => {
    const c = classifyHand(hand);
    expect(c.showdown).toBe(false);
    expect(c.heroMadeFlopAction).toBe(false);
    expect(c.sawFlop).toBe(false);
  });
});

describe('WTSD classification — Split pot at showdown', () => {
  const hand = `Poker Hand #TM009: Tournament #T1, $10 Hold'em No Limit - Level1(50/100(10)) - 2026/10/21 13:40:00
Table '1' 8-max Seat #5 is the button
Seat 1: Hero (10,000 in chips)
Seat 2: Villain (10,000 in chips)
Seat 5: Button (10,000 in chips)
Hero: posts the ante 10
Villain: posts the ante 10
Button: posts the ante 10
Villain: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
Button: folds
Hero: raises 100 to 300
Villain: calls 250
*** FLOP *** [8h 4s 2c]
Hero: bets 200
Villain: calls 200
*** TURN *** [8h 4s 2c] [5d]
Hero: bets 500
Villain: calls 500
*** RIVER *** [8h 4s 2c 5d] [Js]
Hero: checks
Villain: checks
Hero: shows [Ah Kd] (high card, Ace)
Villain: shows [Ac Kh] (high card, Ace)
*** SHOWDOWN ***
Hero collected 1,805 from pot
Villain collected 1,805 from pot
*** SUMMARY ***
Total pot 3,610 | Rake 0
Board [8h 4s 2c 5d Js]
Seat 1: Hero (big blind) showed [Ah Kd] and won (1,805) with high card, Ace
Seat 2: Villain (small blind) showed [Ac Kh] and won (1,805) with high card, Ace
Seat 5: Button folded before Flop
`;

  it('Split pot — showdown=true, made flop action=true', () => {
    const c = classifyHand(hand);
    expect(c.showdown).toBe(true);
    expect(c.heroMadeFlopAction).toBe(true);
    expect(c.sawFlop).toBe(true);
  });
});

describe('WTSD classification — Hero sees flop, opponent folds turn (no showdown)', () => {
  const hand = `Poker Hand #TM010: Tournament #T1, $10 Hold'em No Limit - Level1(50/100(10)) - 2026/10/21 13:45:00
Table '1' 8-max Seat #5 is the button
Seat 1: Hero (10,000 in chips)
Seat 2: Villain (10,000 in chips)
Seat 5: Button (10,000 in chips)
Hero: posts the ante 10
Villain: posts the ante 10
Button: posts the ante 10
Villain: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Button: folds
Hero: raises 100 to 300
Villain: calls 250
*** FLOP *** [8h 4s 2c]
Hero: bets 200
Villain: calls 200
*** TURN *** [8h 4s 2c] [5d]
Hero: bets 500
Villain: folds
Uncalled bet (500) returned to Hero
Hero collected 1,010 from pot
*** SUMMARY ***
Total pot 510 | Rake 0
Board [8h 4s 2c 5d]
Seat 1: Hero (big blind) collected (1,010)
Seat 2: Villain (small blind) folded on the Turn
Seat 5: Button folded before Flop
`;

  it('Hero saw flop, opp folded turn — showdown=false, made flop action=true', () => {
    const c = classifyHand(hand);
    expect(c.showdown).toBe(false);
    expect(c.heroMadeFlopAction).toBe(true);
    expect(c.sawFlop).toBe(true);
  });
});
