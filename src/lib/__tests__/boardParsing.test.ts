import { describe, it, expect } from 'vitest';
import { parseHandBlock } from '@/lib/pokerAnalytics';

describe('Board parsing — turn and river card extraction', () => {
  it('correctly parses GGPoker two-bracket turn/river format', () => {
    const raw = `Poker Hand #TEST001: Tournament #123, $55 Hold'em No Limit - 2026/07/11 14:46:45
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

    const parsed = parseHandBlock(raw, 'GGPoker', 'mtt');
    expect(parsed).not.toBeNull();
    expect(parsed!.board).toBe('Qc Kc 6d 3h Js');
  });

  it('correctly parses PokerStars single-bracket turn/river format', () => {
    const raw = `PokerStars Hand #TEST002: Tournament #456, $55+$5 USD Hold'em No Limit - 2026/07/11 14:46:45 ET
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
*** TURN *** [Qc Kc 6d 3h]
*** RIVER *** [Qc Kc 6d 3h Js]
*** SHOWDOWN ***
Villain collected 620 from pot
*** SUMMARY ***
Total pot 620 | Rake 0
Board [Qc Kc 6d 3h Js]
Seat 1: Hero (small blind) showed [7c Ac] and lost with Ace high
Seat 2: Villain (big blind) showed [Ks Jh] and won (620) with two pair, Kings and Jacks`;

    const parsed = parseHandBlock(raw, 'PokerStars', 'mtt');
    expect(parsed).not.toBeNull();
    expect(parsed!.board).toBe('Qc Kc 6d 3h Js');
  });

  it('correctly parses WPN/ACR format', () => {
    const raw = `Game Hand #TEST003 Tournament #789 $55 Buy-In Hold'em No Limit - 2026/07/11 14:46:45
Table '1' 8-max Seat #8 is the button
Seat 1: Hero (1000.00)
Seat 2: Villain (1000.00)
Hero posts small blind 10.00
Villain posts big blind 20.00
*** HOLE CARDS ***
Dealt to Hero [7c Ac]
Villain raises 20.00 to 60.00
Hero calls 40.00
*** FLOP *** [Qc Kc 6d]
Hero checks
Villain bets 100.00
Hero raises 200.00 to 300.00 and is all-in
Villain calls 200.00
Hero shows [7c Ac]
Villain shows [Ks Jh]
*** TURN *** [Qc Kc 6d][3h]
*** RIVER *** [Qc Kc 6d 3h][Js]
*** SHOW DOWN ***
Villain collected 620.00
*** SUMMARY ***
Total pot 620.00
Board [Qc Kc 6d 3h Js]
Seat 1: Hero showed [7c Ac] and lost
Seat 2: Villain showed [Ks Jh] and won (620.00)`;

    const parsed = parseHandBlock(raw, 'WPN', 'mtt');
    expect(parsed).not.toBeNull();
    expect(parsed!.board).toBe('Qc Kc 6d 3h Js');
  });

  it('correctly parses flop-only board (no turn/river)', () => {
    const raw = `Poker Hand #TEST004: Tournament #999, $55 Hold'em No Limit - 2026/07/11 14:46:45
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
Hero: bets 100 and is all-in
Villain: folds
Uncalled bet (100) returned to Hero
Hero collected 120 from pot
*** SUMMARY ***
Total pot 120 | Rake 0
Board [Qc Kc 6d]
Seat 1: Hero (small blind) bet (100) and won 120
Seat 2: Villain (big blind) folded on the Flop`;

    const parsed = parseHandBlock(raw, 'GGPoker', 'mtt');
    expect(parsed).not.toBeNull();
    expect(parsed!.board).toBe('Qc Kc 6d');
  });
});
