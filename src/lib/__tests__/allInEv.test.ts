import { describe, it, expect } from 'vitest';
import { computeHandAllInEv } from '@/lib/poker/allInEv';

describe('computeHandAllInEv', () => {
  it('returns eligible with positive EV when hero has dominant equity', () => {
    const acesRaw = `Poker Hand #TEST001: Tournament #123, $55 Hold'em No Limit - 2026/07/11 14:46:45
Table '1' 8-max Seat #8 is the button
Seat 1: Hero (1000 in chips)
Seat 2: Villain (1000 in chips)
Hero: posts small blind 10
Villain: posts big blind 20
*** HOLE CARDS ***
Dealt to Hero [Ah As]
Hero: raises 20 to 60 and is all-in
Villain: calls 40
Hero: shows [Ah As] (a pair of Aces)
Villain: shows [Ks Qc] (King high)
*** FLOP *** [Qd 8s 2h]
*** TURN *** [Qd 8s 2h] [4c]
*** RIVER *** [Qd 8s 2h 4c] [7d]
*** SHOWDOWN ***
Hero collected 120 from pot
*** SUMMARY ***
Total pot 120 | Rake 0
Board [Qd 8s 2h 4c 7d]
Seat 1: Hero (small blind) showed [Ah As] and won (120) with a pair of Aces
Seat 2: Villain (big blind) showed [Ks Qc] and lost with King high`;

    const result = computeHandAllInEv(
      'Ah As',
      'Qd 8s 2h 4c 7d',
      acesRaw,
      'Hero',
      true,
      false,
      20,
      120,
      true
    );
    expect(result.eligible).toBe(true);
    expect(result.ev_bb).not.toBeNull();
    // AA vs KQ on Q82 4 7 — hero wins, equity = 1.0
    // pot_bb = 6, investment = 3, ev = 1.0*6 - 3 = 3 BB
    expect(result.ev_bb).toBeGreaterThan(0);
  });

  it('returns eligible with negative EV when hero loses at showdown', () => {
    const lostRaw = `Poker Hand #TEST003: Tournament #789, $55 Hold'em No Limit - 2026/07/11 14:46:45
Table '1' 8-max Seat #8 is the button
Seat 1: Hero (1000 in chips)
Seat 2: Villain (1000 in chips)
Hero: posts small blind 10
Villain: posts big blind 20
*** HOLE CARDS ***
Dealt to Hero [7c Ac]
Villain: raises 20 to 60
Hero: calls 40
*** FLOP *** [Qc Kc 6d]
Hero: checks
Villain: bets 100
Hero: raises 200 to 300 and is all-in
Villain: calls 200
Hero: shows [7c Ac] (Ace high)
Villain: shows [Ks Jh] (a pair of Kings)
*** TURN *** [Qc Kc 6d] [3h]
*** RIVER *** [Qc Kc 6d 3h] [Js]
*** SHOWDOWN ***
Villain collected 620 from pot
*** SUMMARY ***
Total pot 620 | Rake 0
Board [Qc Kc 6d 3h Js]
Seat 1: Hero (small blind) showed [7c Ac] and lost with Ace high
Seat 2: Villain (big blind) showed [Ks Jh] and won (620) with two pair, Kings and Jacks`;

    const result = computeHandAllInEv(
      '7c Ac',
      'Qc Kc 6d 3h Js',
      lostRaw,
      'Hero',
      false,
      true,
      20,
      620,
      true
    );
    expect(result.eligible).toBe(true);
    expect(result.ev_bb).not.toBeNull();
    // Hero has ace high, villain has two pair. Board is complete, equity = 0.
    // ev = 0 * pot_bb - investment_bb = -investment_bb (negative)
    expect(result.ev_bb!).toBeLessThan(0);
  });

  it('returns ineligible when hero is not all-in', () => {
    const raw = `Poker Hand #TEST: Tournament #1, $55 Hold'em No Limit - 2026/07/11 14:46:45
Table '1' 8-max Seat #8 is the button
Seat 1: Hero (1000 in chips)
Seat 2: Villain (1000 in chips)
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Hero: raises 20 to 60
Villain: folds
*** SUMMARY ***
Total pot 40 | Rake 0`;
    const result = computeHandAllInEv('Ah Kh', 'Qd 8s 2h 4c 7d', raw, 'Hero', false, false, 20, 40, true);
    expect(result.eligible).toBe(false);
    expect(result.ev_bb).toBeNull();
  });

  it('returns ineligible when showdown is false', () => {
    const raw = `Poker Hand #TEST: Tournament #1, $55 Hold'em No Limit - 2026/07/11 14:46:45
Table '1' 8-max Seat #8 is the button
Seat 1: Hero (1000 in chips)
Seat 2: Villain (1000 in chips)
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Hero: raises 20 to 60 and is all-in
Villain: folds
*** SUMMARY ***
Total pot 40 | Rake 0`;
    const result = computeHandAllInEv('Ah Kh', 'Qd 8s 2h 4c 7d', raw, 'Hero', true, false, 20, 40, false);
    expect(result.eligible).toBe(false);
    expect(result.ev_bb).toBeNull();
  });

  it('returns ineligible when board is null', () => {
    const raw = `Poker Hand #TEST: Tournament #1, $55 Hold'em No Limit - 2026/07/11 14:46:45
Table '1' 8-max Seat #8 is the button
Seat 1: Hero (1000 in chips)
Seat 2: Villain (1000 in chips)
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Hero: raises 20 to 60 and is all-in
Villain: calls 40
Hero: shows [Ah Kh]
Villain: shows [Ks Qc]
*** SUMMARY ***
Total pot 120 | Rake 0`;
    const result = computeHandAllInEv('Ah Kh', null, raw, 'Hero', true, false, 20, 120, true);
    expect(result.eligible).toBe(false);
    expect(result.ev_bb).toBeNull();
  });

  it('returns ineligible when no opponent cards are shown', () => {
    const noOppRaw = `Poker Hand #TEST002: Tournament #456, $55 Hold'em No Limit - 2026/07/11 14:46:45
Table '1' 8-max Seat #8 is the button
Seat 1: Hero (1000 in chips)
Seat 2: Villain (1000 in chips)
Hero: posts small blind 10
Villain: posts big blind 20
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Hero: raises 20 to 60 and is all-in
Villain: folds
*** SUMMARY ***
Total pot 40 | Rake 0
Seat 1: Hero (small blind) won 40
Seat 2: Villain (big blind) folded before Flop`;

    const result = computeHandAllInEv('Ah Kh', 'Qd 8s 2h 4c 7d', noOppRaw, 'Hero', true, false, 20, 40, true);
    expect(result.eligible).toBe(false);
    expect(result.ev_bb).toBeNull();
  });
});
