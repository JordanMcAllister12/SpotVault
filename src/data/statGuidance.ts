export interface StatGuidance {
  definition: string;
  referenceRanges?: {
    label: string;
    range: string;
    context?: 'cash' | 'mtt' | 'all';
  }[];
  contextNotes?: string;
}

export const STAT_GUIDANCE: Record<string, StatGuidance> = {
  vpip: {
    definition: 'Voluntarily Put In Pot — percentage of hands where you voluntarily call or raise preflop (big blind checks do not count).',
    referenceRanges: [
      { label: 'Full Ring Cash', range: '20-28%', context: 'cash' },
      { label: '6-Max Cash', range: '24-32%', context: 'cash' },
      { label: 'MTT', range: '18-28%', context: 'mtt' },
    ],
    contextNotes: 'Higher VPIP implies a wider range. Very high values (>40%) may indicate looseness; very low (<15%) may indicate tightness.',
  },
  pfr: {
    definition: 'Preflop Raise — percentage of hands where you raise preflop (limp-raises count; BB raises after limpers do not).',
    referenceRanges: [
      { label: 'Full Ring Cash', range: '16-22%', context: 'cash' },
      { label: '6-Max Cash', range: '22-28%', context: 'cash' },
      { label: 'MTT', range: '15-25%', context: 'mtt' },
    ],
    contextNotes: 'PFR should typically be within ~4-6 percentage points of VPIP. A wide gap suggests excessive limping or calling.',
  },
  threeBet: {
    definition: 'Percentage of times you 3-bet when facing a preflop raise. Numerator: hands where you re-raise. Denominator: hands where you faced a raise (excluding BB special cases).',
    referenceRanges: [
      { label: 'Full Ring', range: '6-10%', context: 'all' },
      { label: '6-Max', range: '9-13%', context: 'all' },
    ],
    contextNotes: 'Position and stack depth strongly influence optimal 3-bet frequency. Blinds 3-bet less in position;BTN 3-bets more.',
  },
  foldTo3bet: {
    definition: 'Percentage of times you fold after opening and facing a 3-bet.',
    referenceRanges: [
      { label: 'General', range: '50-60%', context: 'all' },
    ],
    contextNotes: 'Folding too much (>65%) makes you exploitable to 3-bet bluffs. Folding too little (<45%) may indicate calling too wide OOP.',
  },
  fourBet: {
    definition: 'Percentage of times you 4-bet when facing a 3-bet after you opened.',
    referenceRanges: [
      { label: 'General', range: '10-15%', context: 'all' },
    ],
    contextNotes: 'Includes both value 4-bets and bluffs. At low sample sizes this stat is highly volatile.',
  },
  foldTo4bet: {
    definition: 'Percentage of times you fold your 3-bet when facing a 4-bet.',
    referenceRanges: [
      { label: 'General', range: '40-55%', context: 'all' },
    ],
  },
  squeeze: {
    definition: 'Percentage of times you squeeze (3-bet) when there is a raise and at least one caller before you.',
    referenceRanges: [
      { label: 'General', range: '5-12%', context: 'all' },
    ],
    contextNotes: 'Squeezing is highly situational. Higher frequencies are viable with tight callers and deep stacks.',
  },
  steal: {
    definition: 'Percentage of times you raise from CO, BTN, or SB when all players before you folded.',
    referenceRanges: [
      { label: 'CO', range: '25-30%', context: 'all' },
      { label: 'BTN', range: '35-45%', context: 'all' },
      { label: 'SB', range: '35-45%', context: 'all' },
    ],
    contextNotes: 'Steal frequency should increase as position improves. SB steals carry more risk with a player still to act.',
  },
  foldToSteal: {
    definition: 'Percentage of times you fold from the blinds when facing a steal attempt.',
    referenceRanges: [
      { label: 'BB vs BTN', range: '55-65%', context: 'all' },
      { label: 'SB vs BTN', range: '75-85%', context: 'all' },
    ],
    contextNotes: 'Folding too much lets stealers profit automatically. Defending too wide from the blinds is a common leak.',
  },
  cbetFlop: {
    definition: 'Percentage of times you bet the flop after raising preflop (c-bet). Excludes flops where an opponent donk-bets before you act.',
    referenceRanges: [
      { label: 'SRP', range: '55-70%', context: 'all' },
      { label: '3-Bet Pot', range: '65-85%', context: 'all' },
    ],
    contextNotes: 'C-bet frequency depends on board texture, pot type, and opponent tendencies. Dry boards favor higher frequencies.',
  },
  barrelTurn: {
    definition: 'Percentage of times you bet the turn after betting the flop (continuation barrel). Numerator: turn bets after flop c-bet. Denominator: hands where you c-bet flop and saw the turn.',
    referenceRanges: [
      { label: 'SRP', range: '45-60%', context: 'all' },
      { label: '3-Bet Pot', range: '60-80%', context: 'all' },
    ],
    contextNotes: 'Double-barreling should consider board texture changes, draws, and opponent fold-to-flop-cbet frequency.',
  },
  barrelRiver: {
    definition: 'Percentage of times you bet the river after betting the flop and turn (triple barrel).',
    referenceRanges: [
      { label: 'General', range: '35-55%', context: 'all' },
    ],
    contextNotes: 'Triple-barrel bluffs are high-variance. Value-heavy river barrels are more sustainable in most pools.',
  },
  wtsd: {
    definition: 'Went To Showdown — percentage of hands where you saw the flop and reached showdown.',
    referenceRanges: [
      { label: 'Cash', range: '25-32%', context: 'cash' },
      { label: 'MTT', range: '20-30%', context: 'mtt' },
    ],
    contextNotes: 'High WTSD (>35%) may indicate calling too much. Low WTSD (<22%) may indicate over-folding.',
  },
  wsd: {
    definition: 'Won at Showdown — percentage of showdowns you win.',
    referenceRanges: [
      { label: 'General', range: '50-55%', context: 'all' },
    ],
    contextNotes: 'Winning >55% at showdown typically means you reach showdown with strong hands. Below 50% suggests calling too wide.',
  },
  wwsf: {
    definition: 'Won When Saw Flop — percentage of hands where you saw the flop and won the pot (by showdown or fold).',
    referenceRanges: [
      { label: 'General', range: '45-52%', context: 'all' },
    ],
    contextNotes: 'WWSF integrates postflop aggression and fold equity. Low WWSF may indicate passive postflop play.',
  },
  flopCbetSuccess: {
    definition: 'Percentage of flop c-bets where all opponents folded by the turn.',
    referenceRanges: [
      { label: 'SRP', range: '40-55%', context: 'all' },
      { label: '3-Bet Pot', range: '50-70%', context: 'all' },
    ],
  },
  foldToFlopCbet: {
    definition: 'Percentage of times you fold facing a flop c-bet (you were not the preflop aggressor).',
    referenceRanges: [
      { label: 'General', range: '40-55%', context: 'all' },
    ],
    contextNotes: 'Folding too much to c-bets makes you exploitable. Folding too little without strong ranges risks chip spew.',
  },
  checkRaiseFlop: {
    definition: 'Percentage of times you check-raise the flop after checking and facing a bet.',
    referenceRanges: [
      { label: 'General', range: '8-15%', context: 'all' },
    ],
    contextNotes: 'Check-raise frequency should mix value and bluffs based on board texture and opponent c-bet frequency.',
  },
  flopDonkBet: {
    definition: 'Percentage of times you bet into the preflop aggressor on the flop before they act. You must not be the aggressor yourself.',
    referenceRanges: [
      { label: 'General', range: '5-12%', context: 'all' },
    ],
    contextNotes: 'Donk betting is uncommon in theory but can exploit aggressive c-bettors on dynamic boards. Opportunity is counted whenever you are not the preflop aggressor and see a flop.',
  },
  flopDonkSuccess: {
    definition: 'Percentage of your flop donk bets where all opponents folded by the turn.',
    referenceRanges: [
      { label: 'General', range: '40-55%', context: 'all' },
    ],
    contextNotes: 'Measures fold equity of your donk bets. Low success rates may indicate donking into too-callable ranges.',
  },
  foldToFlopDonk: {
    definition: 'Percentage of times you fold when facing a flop donk bet (opponent bets into you before you act as the preflop aggressor).',
    referenceRanges: [
      { label: 'General', range: '35-50%', context: 'all' },
    ],
    contextNotes: 'Folding too much invites donk-bet exploitation. Defending with strong ranges is important.',
  },
  callFlopDonk: {
    definition: 'Percentage of times you call when facing a flop donk bet.',
    referenceRanges: [
      { label: 'General', range: '35-50%', context: 'all' },
    ],
  },
  raiseFlopDonk: {
    definition: 'Percentage of times you raise when facing a flop donk bet.',
    referenceRanges: [
      { label: 'General', range: '8-15%', context: 'all' },
    ],
    contextNotes: 'Raising donk bets should mix value and bluffs based on board texture.',
  },
  turnDonkBet: {
    definition: 'Percentage of times you bet the turn before the preflop aggressor acts, after calling their flop bet. You must not be the aggressor.',
    referenceRanges: [
      { label: 'General', range: '3-8%', context: 'all' },
    ],
    contextNotes: 'Turn donks are rarer than flop donks and typically indicate a strong hand or a draw that wants to build the pot out of position.',
  },
  turnDonkSuccess: {
    definition: 'Percentage of your turn donk bets where all opponents folded by the river.',
    referenceRanges: [
      { label: 'General', range: '35-50%', context: 'all' },
    ],
  },
  foldToTurnDonk: {
    definition: 'Percentage of times you fold when facing a turn donk bet (opponent bets into you on the turn before you act as the aggressor).',
    referenceRanges: [
      { label: 'General', range: '40-55%', context: 'all' },
    ],
  },
  callTurnDonk: {
    definition: 'Percentage of times you call when facing a turn donk bet.',
    referenceRanges: [
      { label: 'General', range: '30-45%', context: 'all' },
    ],
  },
  raiseTurnDonk: {
    definition: 'Percentage of times you raise when facing a turn donk bet.',
    referenceRanges: [
      { label: 'General', range: '6-12%', context: 'all' },
    ],
  },
  riverDonkBet: {
    definition: 'Percentage of times you bet the river before the preflop aggressor acts, after calling their flop and turn bets. You must not be the aggressor.',
    referenceRanges: [
      { label: 'General', range: '2-6%', context: 'all' },
    ],
    contextNotes: 'River donks are the rarest form and usually represent polarized value or a bluff on a scary river card.',
  },
  riverDonkSuccess: {
    definition: 'Percentage of your river donk bets where all opponents folded.',
    referenceRanges: [
      { label: 'General', range: '30-45%', context: 'all' },
    ],
  },
  foldToRiverDonk: {
    definition: 'Percentage of times you fold when facing a river donk bet.',
    referenceRanges: [
      { label: 'General', range: '35-50%', context: 'all' },
    ],
  },
  callRiverDonk: {
    definition: 'Percentage of times you call when facing a river donk bet.',
    referenceRanges: [
      { label: 'General', range: '30-45%', context: 'all' },
    ],
  },
  raiseRiverDonk: {
    definition: 'Percentage of times you raise when facing a river donk bet.',
    referenceRanges: [
      { label: 'General', range: '5-10%', context: 'all' },
    ],
  },
  flopAggression: {
    definition: 'Percentage of flops you saw where you bet or raised at least once.',
    referenceRanges: [
      { label: 'General', range: '50-65%', context: 'all' },
    ],
  },
  turnAggression: {
    definition: 'Percentage of turns you saw where you bet or raised at least once.',
    referenceRanges: [
      { label: 'General', range: '40-55%', context: 'all' },
    ],
  },
  riverAggression: {
    definition: 'Percentage of rivers you saw where you bet or raised at least once.',
    referenceRanges: [
      { label: 'General', range: '35-50%', context: 'all' },
    ],
  },
  turnProbe: {
    definition: 'Percentage of times you bet the turn when the preflop aggressor checked the flop. Measures initiative-based aggression when the aggressor shows weakness.',
    referenceRanges: [
      { label: 'General', range: '20-35%', context: 'all' },
    ],
    contextNotes: 'This is conceptually similar to a turn donk bet — the non-aggressor bets when the aggressor declined to c-bet.',
  },
  turnCheckRaise: {
    definition: 'Percentage of times you check-raise the turn after checking and facing a bet.',
    referenceRanges: [
      { label: 'General', range: '6-12%', context: 'all' },
    ],
  },
  riverCheckRaise: {
    definition: 'Percentage of times you check-raise the river after checking and facing a bet.',
    referenceRanges: [
      { label: 'General', range: '5-10%', context: 'all' },
    ],
  },
  foldToTurnBarrel: {
    definition: 'Percentage of times you fold facing a turn barrel (opponent bet flop and turn).',
    referenceRanges: [
      { label: 'General', range: '45-55%', context: 'all' },
    ],
    contextNotes: 'Folding too much to double barrels invites exploitation. Consider board texture and opponent barrel frequency.',
  },
  foldToRiverBarrel: {
    definition: 'Percentage of times you fold facing a river barrel (opponent bet flop, turn, and river).',
    referenceRanges: [
      { label: 'General', range: '40-50%', context: 'all' },
    ],
  },
  delayedCbet: {
    definition: 'Percentage of times the preflop aggressor checks the flop and bets the turn.',
    referenceRanges: [
      { label: 'General', range: '25-40%', context: 'all' },
    ],
  },
  riverBet: {
    definition: 'Percentage of rivers you saw where you bet (as the aggressor who barrelled previous streets).',
    referenceRanges: [
      { label: 'General', range: '35-55%', context: 'all' },
    ],
  },
  bb100: {
    definition: 'Big blinds won per 100 hands. The primary win-rate metric for cash games.',
    referenceRanges: [
      { label: 'Recreational', range: '-5 to +5 BB/100', context: 'cash' },
      { label: 'Solid Reg', range: '+2 to +8 BB/100', context: 'cash' },
      { label: 'Elite', range: '+8+ BB/100', context: 'cash' },
    ],
    contextNotes: 'Requires 10,000+ hands for a reliable estimate. High variance at small samples.',
  },
  abi: {
    definition: 'Average Buy-In — the mean entry cost across all tournaments played.',
  },
  evbb100: {
    definition: 'All-in adjusted BB/100 — variance-adjusted win rate. Replaces actual showdown outcomes with equity-corrected expected value for all-in hands, removing luck from the win-rate signal.',
    referenceRanges: [
      { label: 'Recreational', range: '-5 to +5 BB/100', context: 'cash' },
      { label: 'Solid Reg', range: '+2 to +8 BB/100', context: 'cash' },
      { label: 'Elite', range: '+8+ BB/100', context: 'cash' },
    ],
    contextNotes: 'Only counts hands with known all-in equity (hero cards known, opponent cards shown, board complete). Shows N/A when no qualifying all-in hands exist. Requires 1,000+ all-in hands for a stable estimate. Should not be confused with observed BB/100.',
  },
};
