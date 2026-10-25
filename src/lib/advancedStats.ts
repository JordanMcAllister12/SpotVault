import type { ActionEntry } from './pokerAnalytics';

export interface AdvancedStats {
  // Preflop
  foldTo3betCount: number;
  foldTo3betOppCount: number;
  fourBetCount: number;
  fourBetOppCount: number;
  foldTo4betCount: number;
  foldTo4betOppCount: number;
  squeezeCount: number;
  squeezeOppCount: number;
  limpCount: number;
  limpOppCount: number;
  limpFoldCount: number;
  limpFoldOppCount: number;
  stealCount: number;
  stealOppCount: number;
  foldToStealCount: number;
  foldToStealOppCount: number;
  // Flop
  foldToFlopCbetCount: number;
  foldToFlopCbetOppCount: number;
  callFlopCbetCount: number;
  callFlopCbetOppCount: number;
  raiseFlopCbetCount: number;
  raiseFlopCbetOppCount: number;
  flopCbetSuccessCount: number;
  flopCbetSuccessOppCount: number;
  flopCheckRaiseCount: number;
  flopCheckRaiseOppCount: number;
  betWhenCheckedToCount: number;
  betWhenCheckedToOppCount: number;
  flopAggressionCount: number;   // bets + raises on flop
  flopAggressionDenom: number;   // bets + raises + calls + folds on flop (checks excluded)
  flopDonkBetCount: number;
  flopDonkBetOppCount: number;
  flopDonkSuccessCount: number;
  flopDonkSuccessOppCount: number;
  foldToFlopDonkCount: number;
  foldToFlopDonkOppCount: number;
  callFlopDonkCount: number;
  callFlopDonkOppCount: number;
  raiseFlopDonkCount: number;
  raiseFlopDonkOppCount: number;
  // Turn
  turnDonkBetCount: number;
  turnDonkBetOppCount: number;
  turnDonkSuccessCount: number;
  turnDonkSuccessOppCount: number;
  foldToTurnDonkCount: number;
  foldToTurnDonkOppCount: number;
  callTurnDonkCount: number;
  callTurnDonkOppCount: number;
  raiseTurnDonkCount: number;
  raiseTurnDonkOppCount: number;
  foldToTurnBarrelCount: number;
  foldToTurnBarrelOppCount: number;
  callTurnBarrelCount: number;
  callTurnBarrelOppCount: number;
  raiseTurnBarrelCount: number;
  raiseTurnBarrelOppCount: number;
  turnBarrelSuccessCount: number;
  turnBarrelSuccessOppCount: number;
  delayedCbetCount: number;
  delayedCbetOppCount: number;
  turnCheckRaiseCount: number;
  turnCheckRaiseOppCount: number;
  turnAggressionCount: number;   // bets + raises on turn
  turnAggressionDenom: number;   // bets + raises + calls + folds on turn (checks excluded)
  turnProbeCount: number;
  turnProbeOppCount: number;
  turnBetWhenCheckedToCount: number;
  turnBetWhenCheckedToOppCount: number;
  doubleBarrelOppCount: number;
  // River
  foldToRiverBarrelCount: number;
  foldToRiverBarrelOppCount: number;
  callRiverBarrelCount: number;
  callRiverBarrelOppCount: number;
  raiseRiverBarrelCount: number;
  raiseRiverBarrelOppCount: number;
  riverBetCount: number;
  riverBetOppCount: number;
  riverCheckRaiseCount: number;
  riverCheckRaiseOppCount: number;
  riverAggressionCount: number;  // bets + raises on river
  riverAggressionDenom: number;  // bets + raises + calls + folds on river (checks excluded)
  riverBetSuccessCount: number;
  riverBetSuccessOppCount: number;
  riverBetWhenCheckedToCount: number;
  riverBetWhenCheckedToOppCount: number;
  riverDonkBetCount: number;
  riverDonkBetOppCount: number;
  riverDonkSuccessCount: number;
  riverDonkSuccessOppCount: number;
  foldToRiverDonkCount: number;
  foldToRiverDonkOppCount: number;
  callRiverDonkCount: number;
  callRiverDonkOppCount: number;
  raiseRiverDonkCount: number;
  raiseRiverDonkOppCount: number;
}

export function createEmptyAdvancedStats(): AdvancedStats {
  return {
    foldTo3betCount: 0, foldTo3betOppCount: 0,
    fourBetCount: 0, fourBetOppCount: 0,
    foldTo4betCount: 0, foldTo4betOppCount: 0,
    squeezeCount: 0, squeezeOppCount: 0,
    limpCount: 0, limpOppCount: 0,
    limpFoldCount: 0, limpFoldOppCount: 0,
    stealCount: 0, stealOppCount: 0,
    foldToStealCount: 0, foldToStealOppCount: 0,
    foldToFlopCbetCount: 0, foldToFlopCbetOppCount: 0,
    callFlopCbetCount: 0, callFlopCbetOppCount: 0,
    raiseFlopCbetCount: 0, raiseFlopCbetOppCount: 0,
    flopCbetSuccessCount: 0, flopCbetSuccessOppCount: 0,
    flopCheckRaiseCount: 0, flopCheckRaiseOppCount: 0,
    betWhenCheckedToCount: 0, betWhenCheckedToOppCount: 0,
    flopAggressionCount: 0, flopAggressionDenom: 0,
    flopDonkBetCount: 0, flopDonkBetOppCount: 0,
    flopDonkSuccessCount: 0, flopDonkSuccessOppCount: 0,
    foldToFlopDonkCount: 0, foldToFlopDonkOppCount: 0,
    callFlopDonkCount: 0, callFlopDonkOppCount: 0,
    raiseFlopDonkCount: 0, raiseFlopDonkOppCount: 0,
    turnDonkBetCount: 0, turnDonkBetOppCount: 0,
    turnDonkSuccessCount: 0, turnDonkSuccessOppCount: 0,
    foldToTurnDonkCount: 0, foldToTurnDonkOppCount: 0,
    callTurnDonkCount: 0, callTurnDonkOppCount: 0,
    raiseTurnDonkCount: 0, raiseTurnDonkOppCount: 0,
    foldToTurnBarrelCount: 0, foldToTurnBarrelOppCount: 0,
    callTurnBarrelCount: 0, callTurnBarrelOppCount: 0,
    raiseTurnBarrelCount: 0, raiseTurnBarrelOppCount: 0,
    turnBarrelSuccessCount: 0, turnBarrelSuccessOppCount: 0,
    delayedCbetCount: 0, delayedCbetOppCount: 0,
    turnCheckRaiseCount: 0, turnCheckRaiseOppCount: 0,
    turnAggressionCount: 0, turnAggressionDenom: 0,
    turnProbeCount: 0, turnProbeOppCount: 0,
    turnBetWhenCheckedToCount: 0, turnBetWhenCheckedToOppCount: 0,
    doubleBarrelOppCount: 0,
    foldToRiverBarrelCount: 0, foldToRiverBarrelOppCount: 0,
    callRiverBarrelCount: 0, callRiverBarrelOppCount: 0,
    raiseRiverBarrelCount: 0, raiseRiverBarrelOppCount: 0,
    riverBetCount: 0, riverBetOppCount: 0,
    riverCheckRaiseCount: 0, riverCheckRaiseOppCount: 0,
    riverAggressionCount: 0, riverAggressionDenom: 0,
    riverBetSuccessCount: 0, riverBetSuccessOppCount: 0,
    riverBetWhenCheckedToCount: 0, riverBetWhenCheckedToOppCount: 0,
    riverDonkBetCount: 0, riverDonkBetOppCount: 0,
    riverDonkSuccessCount: 0, riverDonkSuccessOppCount: 0,
    foldToRiverDonkCount: 0, foldToRiverDonkOppCount: 0,
    callRiverDonkCount: 0, callRiverDonkOppCount: 0,
    raiseRiverDonkCount: 0, raiseRiverDonkOppCount: 0,
  };
}

const RAISE_ACTIONS = new Set(['raise', 'all-in']);
const BET_ACTIONS = new Set(['bet', 'raise', 'all-in']);

function isRaiseAction(a: ActionEntry): boolean {
  return RAISE_ACTIONS.has(a.action);
}

/**
 * Compute all advanced preflop and postflop stats for a single hand.
 * Mutates the stats object by incrementing counters.
 *
 * Opportunity-based denominators: each stat's denominator counts only
 * situations where the player had a legal, relevant decision point.
 * Show N/A (null) via statPct when denominator is zero.
 */
export function computeAdvancedStatsForHand(
  stats: AdvancedStats,
  actions: ActionEntry[],
  heroName: string,
  position: string | null,
  sawFlop: boolean,
  sawTurn: boolean,
  sawRiver: boolean,
): void {
  const pfActions = actions.filter(a => a.street === 'preflop');
  const heroPf = pfActions.filter(a => a.player === heroName);

  // ============================================================
  // PREFLOP
  // ============================================================

  let raiseLevel = 0;
  let firstRaiser: string | null = null;
  let heroOpened = false;
  let hero3bet = false;
  let callersAfterOpener: string[] = [];
  let heroLimped = false;
  let heroLimpedAndFacingRaise = false;
  let stealAttempted = false;
  let heroOpenedAndFacing3bet = false;
  let hero3betAndFacing4bet = false;
  // Track whether hero has had any voluntary action yet (to properly gate limp opp)
  let heroFirstVoluntaryActionSeen = false;

  for (const a of pfActions) {
    if (a.action === 'post' || a.action === 'post_ante') continue;
    const isHero = a.player === heroName;
    const isRaiser = isRaiseAction(a);

    // Track callers after the opening raise (needed for squeeze detection)
    if (raiseLevel === 1 && a.action === 'call' && a.player !== firstRaiser) {
      callersAfterOpener.push(a.player);
    }

    // Steal opportunity: hero is in CO/BTN/SB with an unopened pot and all others folded before
    // Count the opportunity when hero's first voluntary action occurs (raise = steal, fold = declined)
    if (raiseLevel === 0 && isHero && position && ['CO', 'BTN', 'SB'].includes(position) &&
        a.action !== 'post' && a.action !== 'post_ante' && !heroFirstVoluntaryActionSeen) {
      let allFoldedBefore = true;
      for (const pa of pfActions) {
        if (pa.action === 'post' || pa.action === 'post_ante') continue;
        if (pa.player === heroName) break;
        if (pa.action !== 'fold') { allFoldedBefore = false; break; }
      }
      if (allFoldedBefore) {
        stats.stealOppCount++;
        if (isRaiser) {
          stealAttempted = true;
          stats.stealCount++;
        }
      }
    }

    // Squeeze opportunity: hero faces an open-raise with at least one cold caller
    // Must be checked BEFORE raiseLevel update (so raiseLevel is still 1)
    // Hero must not be the opener, and must have a legal raising option
    if (raiseLevel === 1 && callersAfterOpener.length > 0 && !heroOpened && isHero) {
      stats.squeezeOppCount++;
      if (isRaiser) stats.squeezeCount++;
    }

    // Update raise level tracking
    if (raiseLevel === 0) {
      if (isRaiser) {
        raiseLevel = 1;
        firstRaiser = a.player;
        if (isHero) heroOpened = true;
      }
    } else if (raiseLevel === 1) {
      if (isRaiser) {
        raiseLevel = 2;
        if (heroOpened && !isHero) heroOpenedAndFacing3bet = true;
        if (isHero) hero3bet = true;
      }
    } else if (raiseLevel === 2) {
      if (isRaiser) {
        raiseLevel = 3;
        if (hero3bet && !isHero) hero3betAndFacing4bet = true;
        // 4-bet opportunity: hero 3-bet and now faces a 4-bet
        // Counted only once, when we detect hero is facing the 4-bet
      } else if (raiseLevel === 3) {
        // already handled below
      }
    } else if (raiseLevel >= 3) {
      if (isRaiser) raiseLevel++;
    }

    // Limp: first voluntary action in an unopened pot (raiseLevel === 0)
    // A call = limp; a raise = declined limp (open-raise); a fold by non-blind = declined limp
    if (!heroFirstVoluntaryActionSeen && isHero && raiseLevel === 0 && a.action !== 'post' && a.action !== 'post_ante') {
      heroFirstVoluntaryActionSeen = true;
      if (a.action === 'call') {
        heroLimped = true;
        stats.limpOppCount++;
        stats.limpCount++;
      } else if (isRaiser) {
        // Open-raise from unopened pot — this is a declined limp opportunity
        stats.limpOppCount++;
      } else if (a.action === 'fold' && position && !['SB', 'BB'].includes(position)) {
        stats.limpOppCount++;
      }
    }

    if (heroLimped && raiseLevel === 1 && isRaiser && !isHero) {
      heroLimpedAndFacingRaise = true;
    }
    if (heroLimpedAndFacingRaise && isHero) {
      stats.limpFoldOppCount++;
      if (a.action === 'fold') stats.limpFoldCount++;
      heroLimpedAndFacingRaise = false;
    }

    if (heroOpenedAndFacing3bet && isHero) {
      stats.foldTo3betOppCount++;
      if (a.action === 'fold') stats.foldTo3betCount++;
      heroOpenedAndFacing3bet = false;
    }

    // 4-bet and fold-to-4-bet: hero 3-bet, now someone 4-bet, hero faces it
    if (hero3betAndFacing4bet && isHero) {
      stats.fourBetOppCount++;
      if (isRaiser) stats.fourBetCount++;
      stats.foldTo4betOppCount++;
      if (a.action === 'fold') stats.foldTo4betCount++;
      hero3betAndFacing4bet = false;
    }
  }

  // Fold to steal: hero is in SB or BB, there was a first-in raise with all others folding
  {
    let allFoldedBeforeRaise = true;
    let stealRaiseFound = false;
    for (const a of pfActions) {
      if (a.action === 'post' || a.action === 'post_ante') continue;
      if (a.action === 'fold') continue;
      if (isRaiseAction(a)) { stealRaiseFound = true; break; }
      if (a.action === 'call') { allFoldedBeforeRaise = false; break; }
    }
    if (position && ['SB', 'BB'].includes(position) && stealRaiseFound && allFoldedBeforeRaise && !stealAttempted) {
      const heroFolded = heroPf.some(a => a.action === 'fold');
      stats.foldToStealOppCount++;
      if (heroFolded) stats.foldToStealCount++;
    }
  }

  // ============================================================
  // POSTFLOP STATS
  // ============================================================
  if (!sawFlop) return;

  const flopActions = actions.filter(a => a.street === 'flop');
  const heroFlopActions = flopActions.filter(a => a.player === heroName);

  const pfRaises = pfActions.filter(a => isRaiseAction(a));
  const preflopAggressor = pfRaises.length > 0 ? pfRaises[pfRaises.length - 1].player : null;
  const heroIsAggressor = preflopAggressor === heroName;

  // Detect donk: did any non-PFA player bet before PFA acted on flop?
  const donkOccurredFlop = ((): boolean => {
    if (!preflopAggressor) return false;
    for (const a of flopActions) {
      if (a.player === preflopAggressor) return false; // PFA acted first — no donk
      if (a.player !== preflopAggressor && BET_ACTIONS.has(a.action)) return true;
    }
    return false;
  })();

  // --- Flop C-Bet success tracking (hero is PFA, no donk before hero) ---
  if (heroIsAggressor && !donkOccurredFlop) {
    const heroFlopBets = heroFlopActions.filter(a => BET_ACTIONS.has(a.action));
    if (heroFlopBets.length > 0) {
      const oppActions = flopActions.filter(a => a.player !== heroName);
      const oppCalledFlop = oppActions.some(a => a.action === 'call');
      const oppRaisedFlop = oppActions.some(a => ['raise', 'all-in'].includes(a.action));
      const oppFoldedFlop = oppActions.some(a => a.action === 'fold');
      stats.flopCbetSuccessOppCount++;
      // C-bet success: immediate pot win — ALL remaining opponents must fold
      if (oppFoldedFlop && !oppCalledFlop && !oppRaisedFlop) {
        stats.flopCbetSuccessCount++;
      }
    }
  }

  // --- Fold/Call/Raise vs Flop C-Bet ---
  // Hero is not PFA, PFA exists, PFA bets before hero acts (not a donk scenario for hero)
  if (!heroIsAggressor && preflopAggressor) {
    let oppBetFlop = false;
    let heroResponded = false;
    for (const a of flopActions) {
      if (a.player === preflopAggressor && BET_ACTIONS.has(a.action)) {
        oppBetFlop = true;
      }
      if (oppBetFlop && a.player === heroName && !heroResponded) {
        heroResponded = true;
        // All three responses share the same opportunity
        stats.foldToFlopCbetOppCount++;
        stats.callFlopCbetOppCount++;
        stats.raiseFlopCbetOppCount++;
        if (a.action === 'fold') stats.foldToFlopCbetCount++;
        else if (a.action === 'call') stats.callFlopCbetCount++;
        else if (['raise', 'all-in'].includes(a.action)) stats.raiseFlopCbetCount++;
      }
    }
  }

  // --- Flop Check-Raise ---
  {
    let heroCheckedFlop = false;
    let oppBetAfterHeroCheck = false;
    for (const a of flopActions) {
      if (a.player === heroName && a.action === 'check') heroCheckedFlop = true;
      if (heroCheckedFlop && a.player !== heroName && BET_ACTIONS.has(a.action)) oppBetAfterHeroCheck = true;
      if (oppBetAfterHeroCheck && a.player === heroName) {
        stats.flopCheckRaiseOppCount++;
        if (isRaiseAction(a)) stats.flopCheckRaiseCount++;
        break;
      }
    }
  }

  // --- Flop Bet When Checked To: all prior flop actions were checks, hero bets ---
  // Opportunity: hero acts on the flop and all prior actions were checks (or hero acts first after checks)
  {
    let allCheckedBeforeHeroFlop = true;
    for (const a of flopActions) {
      if (a.player === heroName) {
        if (allCheckedBeforeHeroFlop) {
          stats.betWhenCheckedToOppCount++;
          if (BET_ACTIONS.has(a.action)) stats.betWhenCheckedToCount++;
        }
        break;
      }
      if (a.action !== 'check' && a.action !== 'post' && a.action !== 'post_ante') {
        allCheckedBeforeHeroFlop = false;
        break;
      }
    }
  }

  // --- Flop Donk Bet: hero is NOT PFA, bets before PFA acts on flop ---
  if (!heroIsAggressor && preflopAggressor) {
    stats.flopDonkBetOppCount++;
    let heroDonked = false;
    for (const a of flopActions) {
      if (a.player === preflopAggressor) break;
      if (a.player === heroName && BET_ACTIONS.has(a.action)) { heroDonked = true; break; }
      if (a.player === heroName && a.action === 'check') break;
    }
    if (heroDonked) {
      stats.flopDonkBetCount++;

      // Donk success: all opponents immediately fold
      const oppActions = flopActions.filter(a => a.player !== heroName);
      const oppFolded = oppActions.some(a => a.action === 'fold');
      const oppCalled = oppActions.some(a => a.action === 'call');
      const oppRaised = oppActions.some(a => ['raise', 'all-in'].includes(a.action));
      stats.flopDonkSuccessOppCount++;
      if (oppFolded && !oppCalled && !oppRaised) {
        stats.flopDonkSuccessCount++;
      }

      // Opponent response to hero's donk
      const heroFirstBetIdx = flopActions.findIndex(a => a.player === heroName && BET_ACTIONS.has(a.action));
      if (heroFirstBetIdx >= 0) {
        const oppResponse = flopActions.slice(heroFirstBetIdx + 1).find(a =>
          a.player !== heroName && ['fold', 'call', 'raise', 'all-in'].includes(a.action)
        );
        if (oppResponse) {
          stats.foldToFlopDonkOppCount++;
          stats.callFlopDonkOppCount++;
          stats.raiseFlopDonkOppCount++;
          if (oppResponse.action === 'fold') stats.foldToFlopDonkCount++;
          else if (oppResponse.action === 'call') stats.callFlopDonkCount++;
          else if (['raise', 'all-in'].includes(oppResponse.action)) stats.raiseFlopDonkCount++;
        }
      }
    }
  }

  // --- Flop Aggression Frequency ---
  // Correct formula: (bets + raises) / (bets + raises + calls + folds); checks excluded
  {
    let flopBetsRaises = 0;
    let flopCallsFolds = 0;
    for (const a of heroFlopActions) {
      if (BET_ACTIONS.has(a.action)) flopBetsRaises++;
      else if (a.action === 'call' || a.action === 'fold') flopCallsFolds++;
      // checks are excluded
    }
    const flopAggDenom = flopBetsRaises + flopCallsFolds;
    if (flopAggDenom > 0) {
      stats.flopAggressionCount += flopBetsRaises;
      stats.flopAggressionDenom += flopAggDenom;
    }
  }

  // ============================================================
  // TURN STATS
  // ============================================================
  if (!sawTurn) return;

  const turnActions = actions.filter(a => a.street === 'turn');
  const heroTurnActions = turnActions.filter(a => a.player === heroName);

  // Did the flop check through? (all players checked — no bets on flop at all)
  const flopCheckedThrough = flopActions.length > 0 && !flopActions.some(a => BET_ACTIONS.has(a.action));

  // --- Turn Barrel (hero c-bet flop, now bets turn) ---
  if (heroIsAggressor && !donkOccurredFlop) {
    const heroFlopBets = heroFlopActions.filter(a => BET_ACTIONS.has(a.action));
    if (heroFlopBets.length > 0) {
      const heroTurnBets = heroTurnActions.filter(a => BET_ACTIONS.has(a.action));
      if (heroTurnBets.length > 0) {
        const oppActionsTurn = turnActions.filter(a => a.player !== heroName);
        const oppFoldedTurn = oppActionsTurn.some(a => a.action === 'fold');
        const oppCalledTurn = oppActionsTurn.some(a => a.action === 'call');
        const oppRaisedTurn = oppActionsTurn.some(a => ['raise', 'all-in'].includes(a.action));
        stats.turnBarrelSuccessOppCount++;
        if (oppFoldedTurn && !oppCalledTurn && !oppRaisedTurn) {
          stats.turnBarrelSuccessCount++;
        }
      }
    }
  }

  // --- Fold/Call/Raise vs Turn Barrel ---
  if (!heroIsAggressor && preflopAggressor) {
    const oppBetFlop = flopActions.some(a => a.player === preflopAggressor && BET_ACTIONS.has(a.action));
    if (oppBetFlop) {
      let oppBetTurn = false;
      let heroResponded = false;
      for (const a of turnActions) {
        if (a.player === preflopAggressor && BET_ACTIONS.has(a.action)) oppBetTurn = true;
        if (oppBetTurn && a.player === heroName && !heroResponded) {
          heroResponded = true;
          stats.foldToTurnBarrelOppCount++;
          stats.callTurnBarrelOppCount++;
          stats.raiseTurnBarrelOppCount++;
          if (a.action === 'fold') stats.foldToTurnBarrelCount++;
          else if (a.action === 'call') stats.callTurnBarrelCount++;
          else if (['raise', 'all-in'].includes(a.action)) stats.raiseTurnBarrelCount++;
        }
      }
    }
  }

  // --- Delayed C-Bet: hero is PFA, flop checked through entirely, hero bets turn ---
  // "Turn bets by PFA after flop checks through" — requires ALL players to have checked flop
  if (heroIsAggressor && flopCheckedThrough) {
    stats.delayedCbetOppCount++;
    if (heroTurnActions.some(a => BET_ACTIONS.has(a.action))) {
      stats.delayedCbetCount++;
    }
  }

  // --- Turn Check-Raise ---
  {
    let heroCheckedTurn = false;
    let oppBetAfterHeroCheck = false;
    for (const a of turnActions) {
      if (a.player === heroName && a.action === 'check') heroCheckedTurn = true;
      if (heroCheckedTurn && a.player !== heroName && BET_ACTIONS.has(a.action)) oppBetAfterHeroCheck = true;
      if (oppBetAfterHeroCheck && a.player === heroName) {
        stats.turnCheckRaiseOppCount++;
        if (isRaiseAction(a)) stats.turnCheckRaiseCount++;
        break;
      }
    }
  }

  // --- Turn Probe: OOP non-PFA bets turn after IN-POSITION PFA checked back flop ---
  // Definition: OOP player (non-PFA) leads turn after PFA (in position) checked flop
  // Opportunity: hero is not PFA, PFA checked back the flop (did not bet), hero sees turn
  if (!heroIsAggressor && preflopAggressor) {
    const aggressorBetFlop = flopActions.some(a => a.player === preflopAggressor && BET_ACTIONS.has(a.action));
    if (!aggressorBetFlop) {
      // PFA checked flop — this is a probe opportunity for out-of-position hero
      stats.turnProbeOppCount++;
      // Probe = hero bets turn BEFORE PFA acts (hero is OOP, acts first)
      let heroBetBeforePFA = false;
      for (const a of turnActions) {
        if (a.player === preflopAggressor) break;
        if (a.player === heroName && BET_ACTIONS.has(a.action)) { heroBetBeforePFA = true; break; }
        if (a.player === heroName && a.action === 'check') break;
      }
      if (heroBetBeforePFA) stats.turnProbeCount++;
    }
  }

  // --- Turn Donk Bet: hero is NOT PFA, aggressor bet flop, hero called flop, hero bets turn before PFA ---
  if (!heroIsAggressor && preflopAggressor) {
    const aggressorBetFlop = flopActions.some(a => a.player === preflopAggressor && BET_ACTIONS.has(a.action));
    if (aggressorBetFlop) {
      const heroCalledFlop = heroFlopActions.some(a => a.action === 'call');
      if (heroCalledFlop) {
        stats.turnDonkBetOppCount++;
        let heroDonkedTurn = false;
        for (const a of turnActions) {
          if (a.player === preflopAggressor) break;
          if (a.player === heroName && BET_ACTIONS.has(a.action)) { heroDonkedTurn = true; break; }
          if (a.player === heroName && a.action === 'check') break;
        }
        if (heroDonkedTurn) {
          stats.turnDonkBetCount++;

          const oppActionsTurn = turnActions.filter(a => a.player !== heroName);
          const oppFoldedTurn = oppActionsTurn.some(a => a.action === 'fold');
          const oppCalledTurn = oppActionsTurn.some(a => a.action === 'call');
          const oppRaisedTurn = oppActionsTurn.some(a => ['raise', 'all-in'].includes(a.action));
          stats.turnDonkSuccessOppCount++;
          if (oppFoldedTurn && !oppCalledTurn && !oppRaisedTurn) {
            stats.turnDonkSuccessCount++;
          }

          const heroFirstBetTurnIdx = turnActions.findIndex(a => a.player === heroName && BET_ACTIONS.has(a.action));
          if (heroFirstBetTurnIdx >= 0) {
            const oppResponse = turnActions.slice(heroFirstBetTurnIdx + 1).find(a =>
              a.player !== heroName && ['fold', 'call', 'raise', 'all-in'].includes(a.action)
            );
            if (oppResponse) {
              stats.foldToTurnDonkOppCount++;
              stats.callTurnDonkOppCount++;
              stats.raiseTurnDonkOppCount++;
              if (oppResponse.action === 'fold') stats.foldToTurnDonkCount++;
              else if (oppResponse.action === 'call') stats.callTurnDonkCount++;
              else if (['raise', 'all-in'].includes(oppResponse.action)) stats.raiseTurnDonkCount++;
            }
          }
        }
      }
    }
  }

  // --- Turn Bet When Checked To: all prior turn actions were checks, hero bets ---
  // Must have at least one check before hero (hero is not first to act)
  {
    let allCheckedBeforeHero = true;
    let anyPriorAction = false;
    for (const a of turnActions) {
      if (a.player === heroName) {
        if (allCheckedBeforeHero && anyPriorAction) {
          stats.turnBetWhenCheckedToOppCount++;
          if (BET_ACTIONS.has(a.action)) stats.turnBetWhenCheckedToCount++;
        }
        break;
      }
      if (a.action === 'post' || a.action === 'post_ante') continue;
      anyPriorAction = true;
      if (a.action !== 'check') {
        allCheckedBeforeHero = false;
        break;
      }
    }
  }

  // --- Double Barrel Opportunity: hero c-bet flop, reached turn ---
  if (heroIsAggressor && !donkOccurredFlop) {
    const heroFlopBets = heroFlopActions.filter(a => BET_ACTIONS.has(a.action));
    if (heroFlopBets.length > 0) {
      stats.doubleBarrelOppCount++;
    }
  }

  // --- Turn Aggression Frequency ---
  // Correct: (bets + raises) / (bets + raises + calls + folds); checks excluded
  {
    let turnBetsRaises = 0;
    let turnCallsFolds = 0;
    for (const a of heroTurnActions) {
      if (BET_ACTIONS.has(a.action)) turnBetsRaises++;
      else if (a.action === 'call' || a.action === 'fold') turnCallsFolds++;
    }
    const turnAggDenom = turnBetsRaises + turnCallsFolds;
    if (turnAggDenom > 0) {
      stats.turnAggressionCount += turnBetsRaises;
      stats.turnAggressionDenom += turnAggDenom;
    }
  }

  // ============================================================
  // RIVER STATS
  // ============================================================
  if (!sawRiver) return;

  const riverActions = actions.filter(a => a.street === 'river');
  const heroRiverActions = riverActions.filter(a => a.player === heroName);

  // --- River Barrel (hero barrelled flop+turn, bets river) ---
  if (heroIsAggressor && !donkOccurredFlop) {
    const heroFlopBets = heroFlopActions.filter(a => BET_ACTIONS.has(a.action));
    const heroTurnBets = heroTurnActions.filter(a => BET_ACTIONS.has(a.action));
    if (heroFlopBets.length > 0 && heroTurnBets.length > 0) {
      const heroRiverBets = heroRiverActions.filter(a => BET_ACTIONS.has(a.action));
      if (heroRiverBets.length > 0) {
        const oppActionsRiver = riverActions.filter(a => a.player !== heroName);
        const oppFoldedRiver = oppActionsRiver.some(a => a.action === 'fold');
        const oppCalledRiver = oppActionsRiver.some(a => a.action === 'call');
        const oppRaisedRiver = oppActionsRiver.some(a => ['raise', 'all-in'].includes(a.action));
        stats.riverBetSuccessOppCount++;
        if (oppFoldedRiver && !oppCalledRiver && !oppRaisedRiver) {
          stats.riverBetSuccessCount++;
        }
      }
    }
  }

  // --- River Bet Frequency: hero bets on river / eligible river opportunities ---
  // Opportunity: hero had a first action on the river that was not forced
  {
    const firstHeroRiverAction = heroRiverActions.find(a =>
      a.action !== 'post' && a.action !== 'post_ante' && a.action !== 'collect' && a.action !== 'uncalled'
    );
    if (firstHeroRiverAction) {
      stats.riverBetOppCount++;
      if (BET_ACTIONS.has(firstHeroRiverAction.action)) stats.riverBetCount++;
    }
  }

  // --- Fold/Call/Raise vs River Barrel ---
  if (!heroIsAggressor && preflopAggressor) {
    const oppBetFlop = flopActions.some(a => a.player === preflopAggressor && BET_ACTIONS.has(a.action));
    const oppBetTurn = turnActions.some(a => a.player === preflopAggressor && BET_ACTIONS.has(a.action));
    if (oppBetFlop && oppBetTurn) {
      let oppBetRiver = false;
      let heroResponded = false;
      for (const a of riverActions) {
        if (a.player === preflopAggressor && BET_ACTIONS.has(a.action)) oppBetRiver = true;
        if (oppBetRiver && a.player === heroName && !heroResponded) {
          heroResponded = true;
          stats.foldToRiverBarrelOppCount++;
          stats.callRiverBarrelOppCount++;
          stats.raiseRiverBarrelOppCount++;
          if (a.action === 'fold') stats.foldToRiverBarrelCount++;
          else if (a.action === 'call') stats.callRiverBarrelCount++;
          else if (['raise', 'all-in'].includes(a.action)) stats.raiseRiverBarrelCount++;
        }
      }
    }
  }

  // --- River Check-Raise ---
  {
    let heroCheckedRiver = false;
    let oppBetAfterHeroCheck = false;
    for (const a of riverActions) {
      if (a.player === heroName && a.action === 'check') heroCheckedRiver = true;
      if (heroCheckedRiver && a.player !== heroName && BET_ACTIONS.has(a.action)) oppBetAfterHeroCheck = true;
      if (oppBetAfterHeroCheck && a.player === heroName) {
        stats.riverCheckRaiseOppCount++;
        if (isRaiseAction(a)) stats.riverCheckRaiseCount++;
        break;
      }
    }
  }

  // --- River Bet When Checked To: all prior river actions were checks, hero bets ---
  // Must have at least one check before hero (hero is not first to act)
  {
    let allCheckedBeforeHero = true;
    let anyPriorAction = false;
    for (const a of riverActions) {
      if (a.player === heroName) {
        if (allCheckedBeforeHero && anyPriorAction) {
          stats.riverBetWhenCheckedToOppCount++;
          if (BET_ACTIONS.has(a.action)) stats.riverBetWhenCheckedToCount++;
        }
        break;
      }
      if (a.action === 'post' || a.action === 'post_ante') continue;
      anyPriorAction = true;
      if (a.action !== 'check') {
        allCheckedBeforeHero = false;
        break;
      }
    }
  }

  // --- River Donk Bet: hero not PFA, aggressor barrelled flop+turn, hero called both, hero bets river first ---
  if (!heroIsAggressor && preflopAggressor) {
    const aggressorBetFlop = flopActions.some(a => a.player === preflopAggressor && BET_ACTIONS.has(a.action));
    const aggressorBetTurn = turnActions.some(a => a.player === preflopAggressor && BET_ACTIONS.has(a.action));
    if (aggressorBetFlop && aggressorBetTurn) {
      const heroCalledTurn = heroTurnActions.some(a => a.action === 'call');
      if (heroCalledTurn) {
        stats.riverDonkBetOppCount++;
        let heroDonkedRiver = false;
        for (const a of riverActions) {
          if (a.player === preflopAggressor) break;
          if (a.player === heroName && BET_ACTIONS.has(a.action)) { heroDonkedRiver = true; break; }
          if (a.player === heroName && a.action === 'check') break;
        }
        if (heroDonkedRiver) {
          stats.riverDonkBetCount++;

          const oppActionsRiver = riverActions.filter(a => a.player !== heroName);
          const oppFoldedRiver = oppActionsRiver.some(a => a.action === 'fold');
          const oppCalledRiver = oppActionsRiver.some(a => a.action === 'call');
          const oppRaisedRiver = oppActionsRiver.some(a => ['raise', 'all-in'].includes(a.action));
          stats.riverDonkSuccessOppCount++;
          if (oppFoldedRiver && !oppCalledRiver && !oppRaisedRiver) {
            stats.riverDonkSuccessCount++;
          }

          const heroFirstBetRiverIdx = riverActions.findIndex(a => a.player === heroName && BET_ACTIONS.has(a.action));
          if (heroFirstBetRiverIdx >= 0) {
            const oppResponse = riverActions.slice(heroFirstBetRiverIdx + 1).find(a =>
              a.player !== heroName && ['fold', 'call', 'raise', 'all-in'].includes(a.action)
            );
            if (oppResponse) {
              stats.foldToRiverDonkOppCount++;
              stats.callRiverDonkOppCount++;
              stats.raiseRiverDonkOppCount++;
              if (oppResponse.action === 'fold') stats.foldToRiverDonkCount++;
              else if (oppResponse.action === 'call') stats.callRiverDonkCount++;
              else if (['raise', 'all-in'].includes(oppResponse.action)) stats.raiseRiverDonkCount++;
            }
          }
        }
      }
    }
  }

  // --- River Aggression Frequency ---
  // Correct: (bets + raises) / (bets + raises + calls + folds); checks excluded
  {
    let riverBetsRaises = 0;
    let riverCallsFolds = 0;
    for (const a of heroRiverActions) {
      if (BET_ACTIONS.has(a.action)) riverBetsRaises++;
      else if (a.action === 'call' || a.action === 'fold') riverCallsFolds++;
    }
    const riverAggDenom = riverBetsRaises + riverCallsFolds;
    if (riverAggDenom > 0) {
      stats.riverAggressionCount += riverBetsRaises;
      stats.riverAggressionDenom += riverAggDenom;
    }
  }
}

/**
 * Compute percentage from numerator/denominator.
 * Returns null (display as N/A) when there are zero eligible opportunities —
 * never converts absence of observations into 0%.
 */
export function statPct(num: number, denom: number): number | null {
  if (denom === 0) return null;
  return Math.round((num / denom) * 1000) / 10;
}
