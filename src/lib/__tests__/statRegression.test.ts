import { describe, it, expect } from 'vitest';
import {
  computeAdvancedStatsForHand,
  createEmptyAdvancedStats,
  statPct,
} from '../advancedStats';
import { analyzePreflopState } from '../preflopStateMachine';
import type { ActionEntry } from '../pokerAnalytics';

const HERO = 'Hero';
const VILLAIN = 'Villain';

function act(
  street: ActionEntry['street'],
  player: string,
  action: string,
  amount: number | null = null,
): ActionEntry {
  return { street, player, action, amount };
}

function runHand(
  actions: ActionEntry[],
  position: string | null = 'BTN',
  sawFlop = true,
  sawTurn = false,
  sawRiver = false,
) {
  const stats = createEmptyAdvancedStats();
  computeAdvancedStatsForHand(stats, actions, HERO, position, sawFlop, sawTurn, sawRiver);
  return stats;
}

describe('Stat Regression Suite', () => {
  // ============================================================
  // PREFLOP STATS
  // ============================================================

  describe('VPIP / PFR / 3-Bet (preflopStateMachine)', () => {
    it('open-raise from BTN: VPIP + PFR, no 3-bet opp', () => {
      const actions = [
        act('preflop', 'UTG', 'fold'),
        act('preflop', HERO, 'raise', 3),
        act('preflop', 'BB', 'fold'),
      ];
      const pf = analyzePreflopState(actions, HERO);
      expect(pf.vpip).toBe(true);
      expect(pf.pfr).toBe(true);
      expect(pf.threeBetOpportunity).toBe(false);
      expect(pf.threeBet).toBe(false);
    });

    it('BB walk: no VPIP, no PFR', () => {
      const actions = [
        act('preflop', 'UTG', 'fold'),
        act('preflop', 'BTN', 'fold'),
        act('preflop', 'SB', 'fold'),
      ];
      const pf = analyzePreflopState(actions, HERO);
      expect(pf.vpip).toBe(false);
      expect(pf.pfr).toBe(false);
    });

    it('hero 3-bets after facing open: 3-bet opp + action', () => {
      const actions = [
        act('preflop', 'UTG', 'raise', 3),
        act('preflop', HERO, 'raise', 9),
      ];
      const pf = analyzePreflopState(actions, HERO);
      expect(pf.threeBetOpportunity).toBe(true);
      expect(pf.threeBet).toBe(true);
    });

    it('hero folds to 3-bet: fold-to-3bet counted', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', VILLAIN, 'raise', 9),
        act('preflop', HERO, 'fold'),
      ];
      const stats = runHand(actions, 'BTN', false);
      expect(stats.foldTo3betOppCount).toBe(1);
      expect(stats.foldTo3betCount).toBe(1);
    });

    it('hero calls 3-bet: fold-to-3bet opp but no fold', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', VILLAIN, 'raise', 9),
        act('preflop', HERO, 'call', 6),
      ];
      const stats = runHand(actions, 'BTN', false);
      expect(stats.foldTo3betOppCount).toBe(1);
      expect(stats.foldTo3betCount).toBe(0);
    });
  });

  describe('Steal', () => {
    it('BTN open with all folds: single steal count', () => {
      const actions = [
        act('preflop', 'UTG', 'fold'),
        act('preflop', 'HJ', 'fold'),
        act('preflop', 'CO', 'fold'),
        act('preflop', HERO, 'raise', 2.5),
        act('preflop', 'SB', 'fold'),
        act('preflop', 'BB', 'fold'),
      ];
      const stats = runHand(actions, 'BTN', false);
      expect(stats.stealOppCount).toBe(1);
      expect(stats.stealCount).toBe(1);
    });

    it('BTN open with a limper before: NOT a steal', () => {
      const actions = [
        act('preflop', 'UTG', 'call', 1),
        act('preflop', HERO, 'raise', 4),
      ];
      const stats = runHand(actions, 'BTN', false);
      expect(stats.stealOppCount).toBe(0);
      expect(stats.stealCount).toBe(0);
    });

    it('CO open with all folds: steal counted', () => {
      const actions = [
        act('preflop', 'UTG', 'fold'),
        act('preflop', 'HJ', 'fold'),
        act('preflop', HERO, 'raise', 3),
      ];
      const stats = runHand(actions, 'CO', false);
      expect(stats.stealOppCount).toBe(1);
      expect(stats.stealCount).toBe(1);
    });
  });

  describe('Squeeze', () => {
    it('hero squeezes: opp + action counted, not always 100%', () => {
      const actions = [
        act('preflop', 'UTG', 'raise', 3),
        act('preflop', 'MP', 'call', 3),
        act('preflop', HERO, 'raise', 12),
      ];
      const stats = runHand(actions, 'BTN', false);
      expect(stats.squeezeOppCount).toBe(1);
      expect(stats.squeezeCount).toBe(1);
    });

    it('hero folds to open+call: squeeze opp but no action', () => {
      const actions = [
        act('preflop', 'UTG', 'raise', 3),
        act('preflop', 'MP', 'call', 3),
        act('preflop', HERO, 'fold'),
      ];
      const stats = runHand(actions, 'BTN', false);
      expect(stats.squeezeOppCount).toBe(1);
      expect(stats.squeezeCount).toBe(0);
    });
  });

  describe('4-Bet', () => {
    it('hero 3-bets, faces 4-bet, 5-bets: 4-bet opp + action', () => {
      const actions = [
        act('preflop', 'UTG', 'raise', 3),
        act('preflop', HERO, 'raise', 9),
        act('preflop', 'UTG', 'raise', 27),
        act('preflop', HERO, 'raise', 81),
      ];
      const stats = runHand(actions, 'BTN', false);
      expect(stats.fourBetOppCount).toBe(1);
      expect(stats.fourBetCount).toBe(1);
    });

    it('hero 3-bets, faces 4-bet, folds: 4-bet opp but no action', () => {
      const actions = [
        act('preflop', 'UTG', 'raise', 3),
        act('preflop', HERO, 'raise', 9),
        act('preflop', 'UTG', 'raise', 27),
        act('preflop', HERO, 'fold'),
      ];
      const stats = runHand(actions, 'BTN', false);
      expect(stats.fourBetOppCount).toBe(1);
      expect(stats.fourBetCount).toBe(0);
    });
  });

  describe('Limp', () => {
    it('hero limps: limp opp + action', () => {
      const actions = [
        act('preflop', 'UTG', 'fold'),
        act('preflop', HERO, 'call', 1),
      ];
      const stats = runHand(actions, 'BTN', false);
      expect(stats.limpOppCount).toBe(1);
      expect(stats.limpCount).toBe(1);
    });

    it('hero folds preflop with no raise: limp opp but no action', () => {
      const actions = [
        act('preflop', 'UTG', 'fold'),
        act('preflop', HERO, 'fold'),
      ];
      const stats = runHand(actions, 'BTN', false);
      expect(stats.limpOppCount).toBe(1);
      expect(stats.limpCount).toBe(0);
    });
  });

  // ============================================================
  // FLOP RESPONSE STATS (triple-count fix validation)
  // ============================================================

  describe('Fold/Call/Raise vs Flop C-Bet', () => {
    it('hero folds to c-bet: single opp count', () => {
      const actions = [
        act('preflop', VILLAIN, 'raise', 3),
        act('preflop', HERO, 'call', 2),
        act('preflop', 'BB', 'fold'),
        act('flop', VILLAIN, 'bet', 4),
        act('flop', HERO, 'fold'),
      ];
      const stats = runHand(actions, 'BTN', true, false, false);
      expect(stats.foldToFlopCbetOppCount).toBe(1);
      expect(stats.foldToFlopCbetCount).toBe(1);
      expect(statPct(stats.foldToFlopCbetCount, stats.foldToFlopCbetOppCount)).toBe(100);
    });

    it('hero calls c-bet: call counted with shared denominator', () => {
      const actions = [
        act('preflop', VILLAIN, 'raise', 3),
        act('preflop', HERO, 'call', 2),
        act('preflop', 'BB', 'fold'),
        act('flop', VILLAIN, 'bet', 4),
        act('flop', HERO, 'call', 4),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.callFlopCbetOppCount).toBe(1);
      expect(stats.callFlopCbetCount).toBe(1);
      expect(statPct(stats.callFlopCbetCount, stats.callFlopCbetOppCount)).toBe(100);
    });

    it('hero raises c-bet: raise counted with shared denominator', () => {
      const actions = [
        act('preflop', VILLAIN, 'raise', 3),
        act('preflop', HERO, 'call', 2),
        act('preflop', 'BB', 'fold'),
        act('flop', VILLAIN, 'bet', 4),
        act('flop', HERO, 'raise', 12),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.raiseFlopCbetOppCount).toBe(1);
      expect(stats.raiseFlopCbetCount).toBe(1);
      expect(statPct(stats.raiseFlopCbetCount, stats.raiseFlopCbetOppCount)).toBe(100);
    });
  });

  describe('Fold/Call/Raise vs Flop Donk', () => {
    it('opponent folds to hero donk: single opp count', () => {
      const actions = [
        act('preflop', VILLAIN, 'raise', 3),
        act('preflop', HERO, 'call', 2),
        act('flop', HERO, 'bet', 4),
        act('flop', VILLAIN, 'fold'),
      ];
      const stats = runHand(actions, 'BTN', true, false, false);
      expect(stats.foldToFlopDonkOppCount).toBe(1);
      expect(stats.foldToFlopDonkCount).toBe(1);
      expect(statPct(stats.foldToFlopDonkCount, stats.foldToFlopDonkOppCount)).toBe(100);
    });

    it('opponent calls hero donk: call with shared denominator', () => {
      const actions = [
        act('preflop', VILLAIN, 'raise', 3),
        act('preflop', HERO, 'call', 2),
        act('flop', HERO, 'bet', 4),
        act('flop', VILLAIN, 'call', 4),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.callFlopDonkOppCount).toBe(1);
      expect(stats.callFlopDonkCount).toBe(1);
      expect(statPct(stats.callFlopDonkCount, stats.callFlopDonkOppCount)).toBe(100);
    });
  });

  // ============================================================
  // TURN RESPONSE STATS
  // ============================================================

  describe('Fold/Call/Raise vs Turn Barrel', () => {
    it('hero folds to turn barrel: single opp count', () => {
      const actions = [
        act('preflop', VILLAIN, 'raise', 3),
        act('preflop', HERO, 'call', 2),
        act('flop', VILLAIN, 'bet', 4),
        act('flop', HERO, 'call', 4),
        act('turn', VILLAIN, 'bet', 8),
        act('turn', HERO, 'fold'),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.foldToTurnBarrelOppCount).toBe(1);
      expect(stats.foldToTurnBarrelCount).toBe(1);
      expect(statPct(stats.foldToTurnBarrelCount, stats.foldToTurnBarrelOppCount)).toBe(100);
    });

    it('hero calls turn barrel: call with shared denominator', () => {
      const actions = [
        act('preflop', VILLAIN, 'raise', 3),
        act('preflop', HERO, 'call', 2),
        act('flop', VILLAIN, 'bet', 4),
        act('flop', HERO, 'call', 4),
        act('turn', VILLAIN, 'bet', 8),
        act('turn', HERO, 'call', 8),
      ];
      const stats = runHand(actions, 'BTN', true, true, true);
      expect(stats.callTurnBarrelOppCount).toBe(1);
      expect(stats.callTurnBarrelCount).toBe(1);
      expect(statPct(stats.callTurnBarrelCount, stats.callTurnBarrelOppCount)).toBe(100);
    });
  });

  // ============================================================
  // RIVER RESPONSE STATS
  // ============================================================

  describe('Fold/Call/Raise vs River Barrel', () => {
    it('hero folds to river barrel: single opp count', () => {
      const actions = [
        act('preflop', VILLAIN, 'raise', 3),
        act('preflop', HERO, 'call', 2),
        act('flop', VILLAIN, 'bet', 4),
        act('flop', HERO, 'call', 4),
        act('turn', VILLAIN, 'bet', 8),
        act('turn', HERO, 'call', 8),
        act('river', VILLAIN, 'bet', 16),
        act('river', HERO, 'fold'),
      ];
      const stats = runHand(actions, 'BTN', true, true, true);
      expect(stats.foldToRiverBarrelOppCount).toBe(1);
      expect(stats.foldToRiverBarrelCount).toBe(1);
      expect(statPct(stats.foldToRiverBarrelCount, stats.foldToRiverBarrelOppCount)).toBe(100);
    });
  });

  // ============================================================
  // POSTFLOP CORE STATS
  // ============================================================

  describe('Flop C-Bet', () => {
    it('hero is aggressor and bets flop: c-bet counted', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', 'BB', 'call', 2),
        act('flop', 'BB', 'check'),
        act('flop', HERO, 'bet', 4),
        act('flop', 'BB', 'fold'),
      ];
      const stats = runHand(actions, 'BTN', true, false, false);
      expect(stats.flopCbetSuccessOppCount).toBe(1);
      expect(stats.flopCbetSuccessCount).toBe(1);
    });

    it('opponent donk-bets before hero: no c-bet success counted', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', 'BB', 'call', 2),
        act('flop', 'BB', 'bet', 4),
        act('flop', HERO, 'fold'),
      ];
      const stats = runHand(actions, 'BTN', true, false, false);
      expect(stats.flopCbetSuccessOppCount).toBe(0);
    });
  });

  describe('Flop Check-Raise', () => {
    it('hero checks, opp bets, hero raises: check-raise counted', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', 'BB', 'call', 2),
        act('flop', HERO, 'check'),
        act('flop', 'BB', 'bet', 4),
        act('flop', HERO, 'raise', 12),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.flopCheckRaiseOppCount).toBe(1);
      expect(stats.flopCheckRaiseCount).toBe(1);
    });
  });

  describe('Delayed C-Bet', () => {
    it('hero checks flop, bets turn: delayed c-bet', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', 'BB', 'call', 2),
        act('flop', HERO, 'check'),
        act('flop', 'BB', 'check'),
        act('turn', HERO, 'bet', 4),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.delayedCbetOppCount).toBe(1);
      expect(stats.delayedCbetCount).toBe(1);
    });
  });

  describe('Turn Probe', () => {
    it('aggressor checked flop, hero bets turn: probe counted', () => {
      const actions = [
        act('preflop', VILLAIN, 'raise', 3),
        act('preflop', HERO, 'call', 2),
        act('flop', VILLAIN, 'check'),
        act('flop', HERO, 'check'),
        act('turn', HERO, 'bet', 4),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.turnProbeOppCount).toBe(1);
      expect(stats.turnProbeCount).toBe(1);
    });

    it('aggressor checked flop, hero checks turn: probe opp but no action', () => {
      const actions = [
        act('preflop', VILLAIN, 'raise', 3),
        act('preflop', HERO, 'call', 2),
        act('flop', VILLAIN, 'check'),
        act('flop', HERO, 'check'),
        act('turn', HERO, 'check'),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.turnProbeOppCount).toBe(1);
      expect(stats.turnProbeCount).toBe(0);
    });
  });

  describe('Aggression Frequency', () => {
    it('flop: hero bets and calls — aggression = 1/2 (50%)', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', 'BB', 'call', 2),
        act('flop', HERO, 'bet', 4),
        act('flop', 'BB', 'raise', 12),
        act('flop', HERO, 'call', 8),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.flopAggressionCount).toBe(1);
      expect(stats.flopAggressionDenom).toBe(2);
      expect(statPct(stats.flopAggressionCount, stats.flopAggressionDenom)).toBe(50);
    });

    it('flop: hero checks only — no aggression denominator (checks excluded)', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', 'BB', 'call', 2),
        act('flop', HERO, 'check'),
        act('flop', 'BB', 'check'),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.flopAggressionDenom).toBe(0);
      expect(statPct(stats.flopAggressionCount, stats.flopAggressionDenom)).toBe(null);
    });
  });

  describe('Turn Bet When Checked To', () => {
    it('action checks to hero, hero bets: opp + action counted', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', 'BB', 'call', 2),
        act('flop', 'BB', 'check'),
        act('flop', HERO, 'check'),
        act('turn', 'BB', 'check'),
        act('turn', HERO, 'bet', 4),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.turnBetWhenCheckedToOppCount).toBe(1);
      expect(stats.turnBetWhenCheckedToCount).toBe(1);
    });

    it('action checks to hero, hero checks: opp but no action', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', 'BB', 'call', 2),
        act('flop', 'BB', 'check'),
        act('flop', HERO, 'check'),
        act('turn', 'BB', 'check'),
        act('turn', HERO, 'check'),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.turnBetWhenCheckedToOppCount).toBe(1);
      expect(stats.turnBetWhenCheckedToCount).toBe(0);
    });
  });

  describe('Delayed C-Bet verification', () => {
    it('flop checked through, hero bets turn: delayed c-bet', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', 'BB', 'call', 2),
        act('flop', HERO, 'check'),
        act('flop', 'BB', 'check'),
        act('turn', HERO, 'bet', 4),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.delayedCbetOppCount).toBe(1);
      expect(stats.delayedCbetCount).toBe(1);
    });

    it('opponent bets flop, hero checks: NOT a delayed c-bet opportunity', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', 'BB', 'call', 2),
        act('flop', HERO, 'check'),
        act('flop', 'BB', 'bet', 4),
        act('flop', HERO, 'fold'),
      ];
      const stats = runHand(actions, 'BTN', true, false, false);
      expect(stats.delayedCbetOppCount).toBe(0);
    });
  });

  // ============================================================
  // EDGE CASES
  // ============================================================

  describe('Edge Cases', () => {
    it('all-in preflop: VPIP + PFR', () => {
      const actions = [
        act('preflop', HERO, 'all-in', 100),
      ];
      const pf = analyzePreflopState(actions, HERO);
      expect(pf.vpip).toBe(true);
      expect(pf.pfr).toBe(true);
    });

    it('multiway c-bet: one calls one folds = NOT success', () => {
      const actions = [
        act('preflop', HERO, 'raise', 3),
        act('preflop', 'P1', 'call', 2),
        act('preflop', 'P2', 'call', 2),
        act('flop', 'P1', 'check'),
        act('flop', 'P2', 'check'),
        act('flop', HERO, 'bet', 6),
        act('flop', 'P1', 'fold'),
        act('flop', 'P2', 'call', 6),
      ];
      const stats = runHand(actions, 'BTN', true, true, false);
      expect(stats.flopCbetSuccessOppCount).toBe(1);
      expect(stats.flopCbetSuccessCount).toBe(0);
    });

    it('N/A guard: zero flop aggression opportunities returns null', () => {
      const stats = runHand([], 'BTN', false, false, false);
      expect(statPct(stats.flopAggressionCount, stats.flopAggressionDenom)).toBe(null);
    });
  });
});
