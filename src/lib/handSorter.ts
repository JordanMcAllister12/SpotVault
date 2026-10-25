import { parseHandBlock, parseBigBlind, computeNetChipsFromActions, type ParsedHand, type ActionEntry, type AnalyticsMode } from './pokerAnalytics';
import { analyzePreflopState } from './preflopStateMachine';
import { computeAdvancedStatsForHand, createEmptyAdvancedStats, type AdvancedStats } from './advancedStats';

export type PrimaryFilter =
  | 'vpip' | 'pfr' | '3bet' | 'faced_3bet' | '4bet'
  | 'limp' | 'blind_defense'
  | 'cbet' | 'faced_cbet' | 'check_raise'
  | 'turn_barrel' | 'faced_turn_barrel'
  | 'river_barrel' | 'faced_river_barrel'
  | 'triple_barrel' | 'all_in';

export type PositionFilter = 'all' | 'UTG' | 'UTG+1' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
export type StackFilter = 'all' | '<10' | '10-20' | '20-30' | '30-50' | '50-100' | '100+';
export type ResultFilter = 'all' | 'won' | 'lost';

export interface HandSorterFilters {
  primary: PrimaryFilter | null;
  position: PositionFilter;
  stack: StackFilter;
  tournament: string | 'all';
  result: ResultFilter;
}

export interface SortedHand {
  handId: string;
  tournamentId: string | null;
  position: string | null;
  heroCards: string | null;
  board: string | null;
  netResultBB: number | null;
  stackBB: number | null;
  playedAt: string | null;
  label: string;
  rawHandText: string | null;
}

export interface HandClassification {
  vpip: boolean;
  pfr: boolean;
  threeBet: boolean;
  faced3bet: boolean;
  faced3betResponse: 'fold' | 'call' | '4bet' | null;
  fourBet: boolean;
  limp: boolean;
  blindDefense: boolean;
  blindDefenseResponse: 'fold' | 'call' | 'raise' | null;
  cbet: boolean;
  facedCbet: boolean;
  facedCbetResponse: 'fold' | 'call' | 'raise' | null;
  checkRaise: boolean;
  checkRaiseStreet: 'flop' | 'turn' | 'river' | null;
  turnBarrel: boolean;
  facedTurnBarrel: boolean;
  facedTurnBarrelResponse: 'fold' | 'call' | 'raise' | null;
  riverBarrel: boolean;
  facedRiverBarrel: boolean;
  facedRiverBarrelResponse: 'fold' | 'call' | 'raise' | null;
  tripleBarrel: boolean;
  allIn: boolean;
  allInType: 'hero_allin' | 'hero_called_allin' | 'hero_faced_allin' | null;
}

const FILTER_LABELS: Record<PrimaryFilter, string> = {
  vpip: 'VPIP',
  pfr: 'PFR',
  '3bet': '3-Bet',
  faced_3bet: 'Faced 3-Bet',
  '4bet': '4-Bet',
  limp: 'Limp',
  blind_defense: 'Blind Defense',
  cbet: 'C-Bet',
  faced_cbet: 'Faced C-Bet',
  check_raise: 'Check-Raise',
  turn_barrel: 'Turn Barrel',
  faced_turn_barrel: 'Faced Turn Barrel',
  river_barrel: 'River Barrel',
  faced_river_barrel: 'Faced River Barrel',
  triple_barrel: 'Triple Barrel',
  all_in: 'All-In',
};

export function getFilterLabel(f: PrimaryFilter): string {
  return FILTER_LABELS[f];
}

export const ALL_PRIMARY_FILTERS: PrimaryFilter[] = [
  'vpip', 'pfr', '3bet', 'faced_3bet', '4bet', 'limp', 'blind_defense',
  'cbet', 'faced_cbet', 'check_raise',
  'turn_barrel', 'faced_turn_barrel',
  'river_barrel', 'faced_river_barrel',
  'triple_barrel', 'all_in',
];

export const FILTER_GROUPS: { label: string; filters: PrimaryFilter[] }[] = [
  { label: 'Preflop', filters: ['vpip', 'pfr', '3bet', 'faced_3bet', '4bet', 'limp', 'blind_defense'] },
  { label: 'Flop', filters: ['cbet', 'faced_cbet', 'check_raise'] },
  { label: 'Turn', filters: ['turn_barrel', 'faced_turn_barrel'] },
  { label: 'River', filters: ['river_barrel', 'faced_river_barrel'] },
  { label: 'Multi-Street', filters: ['triple_barrel', 'all_in'] },
];

function getActionsByStreet(actions: ActionEntry[], street: string): ActionEntry[] {
  return actions.filter((a) => a.street === street);
}

function isHeroAction(a: ActionEntry, heroName: string | null): boolean {
  return heroName !== null && a.player === heroName;
}

function isBetOrRaise(action: string): boolean {
  return action === 'bet' || action === 'raise' || action === 'all-in';
}

function isVoluntary(action: string): boolean {
  return action === 'call' || action === 'bet' || action === 'raise' || action === 'all-in';
}

function isRaiseAction(action: string): boolean {
  return action === 'raise' || action === 'all-in';
}

function findLastRaiser(actions: ActionEntry[], street: string): string | null {
  const streetActions = getActionsByStreet(actions, street);
  for (let i = streetActions.length - 1; i >= 0; i--) {
    if (isRaiseAction(streetActions[i].action)) return streetActions[i].player;
  }
  return null;
}

function heroFacedBetAndResponded(
  actions: ActionEntry[],
  street: string,
  heroName: string,
): { faced: boolean; response: 'fold' | 'call' | 'raise' | null } {
  const streetActions = getActionsByStreet(actions, street);
  let heroChecked = false;
  let someoneBetAfterHeroCheck = false;
  let bettor: string | null = null;

  for (const a of streetActions) {
    if (isHeroAction(a, heroName)) {
      if (a.action === 'check') {
        heroChecked = true;
      } else if (a.action === 'fold' && heroChecked && someoneBetAfterHeroCheck) {
        return { faced: true, response: 'fold' };
      } else if (a.action === 'call' && heroChecked && someoneBetAfterHeroCheck) {
        return { faced: true, response: 'call' };
      } else if (isRaiseAction(a.action) && heroChecked && someoneBetAfterHeroCheck) {
        return { faced: true, response: 'raise' };
      }
    } else {
      if (isBetOrRaise(a.action) && heroChecked) {
        someoneBetAfterHeroCheck = true;
        bettor = a.player;
      }
    }
  }
  void bettor;
  return { faced: false, response: null };
}

export function classifyHand(parsed: ParsedHand): HandClassification {
  const actions = parsed.actions;
  const heroName = parsed.heroName;
  const preflopActions = getActionsByStreet(actions, 'preflop');
  const flopActions = getActionsByStreet(actions, 'flop');
  const turnActions = getActionsByStreet(actions, 'turn');
  const riverActions = getActionsByStreet(actions, 'river');

  const cls: HandClassification = {
    vpip: false, pfr: false, threeBet: false,
    faced3bet: false, faced3betResponse: null,
    fourBet: false, limp: false,
    blindDefense: false, blindDefenseResponse: null,
    cbet: false, facedCbet: false, facedCbetResponse: null,
    checkRaise: false, checkRaiseStreet: null,
    turnBarrel: false, facedTurnBarrel: false, facedTurnBarrelResponse: null,
    riverBarrel: false, facedRiverBarrel: false, facedRiverBarrelResponse: null,
    tripleBarrel: false,
    allIn: false, allInType: null,
  };

  if (!heroName) return cls;

  // Preflop via state machine
  const pfState = analyzePreflopState(preflopActions, heroName);
  cls.vpip = pfState.vpip;
  cls.pfr = pfState.pfr;
  cls.threeBet = pfState.threeBet;

  // Faced 3-bet: hero raised, then faced a 3-bet (raiseLevel went to 2 after hero's raise)
  if (pfState.heroRaised && pfState.raiseLevel >= 2) {
    cls.faced3bet = true;
    // Find hero's response after facing the 3-bet
    let heroRaisedAlready = false;
    let facedThreeBet = false;
    for (const a of preflopActions) {
      if (isHeroAction(a, heroName)) {
        if (isRaiseAction(a.action)) {
          if (facedThreeBet) {
            cls.faced3betResponse = '4bet';
            cls.fourBet = true;
            break;
          }
          heroRaisedAlready = true;
        } else if (a.action === 'fold' && facedThreeBet) {
          cls.faced3betResponse = 'fold';
          break;
        } else if (a.action === 'call' && facedThreeBet) {
          cls.faced3betResponse = 'call';
          break;
        }
      } else {
        if (isRaiseAction(a.action) && heroRaisedAlready) {
          facedThreeBet = true;
        }
      }
    }
  }

  // 4-bet: hero made a 4-bet (raiseLevel >= 3 and hero is the raiser at level 3+)
  if (pfState.raiseLevel >= 3) {
    let raiseCount = 0;
    for (const a of preflopActions) {
      if (isRaiseAction(a.action)) raiseCount++;
      if (isHeroAction(a, heroName) && isRaiseAction(a.action) && raiseCount >= 3) {
        cls.fourBet = true;
        break;
      }
    }
  }

  // Limp: hero voluntarily called preflop without raising, in an unraised pot
  if (!pfState.pfr && pfState.vpip) {
    const hasRaise = preflopActions.some((a) => isRaiseAction(a.action) && !isHeroAction(a, heroName));
    if (!hasRaise) {
      // Check if hero limped (called the BB) rather than just calling a raise
      const heroCalls = preflopActions.filter((a) => isHeroAction(a, heroName) && a.action === 'call');
      if (heroCalls.length > 0) {
        cls.limp = true;
      }
    }
  }

  // Blind defense: hero in SB or BB, faced a preflop raise
  if ((parsed.position === 'SB' || parsed.position === 'BB') && pfState.raiseLevel >= 1) {
    // Check if someone other than hero raised
    const nonHeroRaiser = preflopActions.some((a) => isRaiseAction(a.action) && !isHeroAction(a, heroName));
    if (nonHeroRaiser) {
      cls.blindDefense = true;
      // Find hero's response to the raise
      let raiseSeen = false;
      for (const a of preflopActions) {
        if (!isHeroAction(a, heroName) && isRaiseAction(a.action)) {
          raiseSeen = true;
        } else if (isHeroAction(a, heroName) && raiseSeen) {
          if (a.action === 'fold') { cls.blindDefenseResponse = 'fold'; break; }
          if (a.action === 'call') { cls.blindDefenseResponse = 'call'; break; }
          if (isRaiseAction(a.action)) { cls.blindDefenseResponse = 'raise'; break; }
        }
      }
    }
  }

  // C-Bet: hero was preflop aggressor (last preflop raiser) and bet on flop
  const preflopRaiser = findLastRaiser(actions, 'preflop');
  if (preflopRaiser === heroName && parsed.sawFlop) {
    const heroFlopBet = flopActions.some((a) => isHeroAction(a, heroName) && (a.action === 'bet' || a.action === 'raise' || (a.action === 'all-in' && a.amount !== null && a.amount > 0)));
    if (heroFlopBet) cls.cbet = true;
  }

  // Faced C-Bet: opponent was preflop aggressor and bet flop, hero responded
  if (preflopRaiser && preflopRaiser !== heroName && parsed.sawFlop) {
    const oppFlopBet = flopActions.some((a) => a.player === preflopRaiser && isBetOrRaise(a.action));
    if (oppFlopBet) {
      cls.facedCbet = true;
      // Find hero's response
      let oppBetSeen = false;
      for (const a of flopActions) {
        if (a.player === preflopRaiser && isBetOrRaise(a.action)) {
          oppBetSeen = true;
        } else if (isHeroAction(a, heroName) && oppBetSeen) {
          if (a.action === 'fold') { cls.facedCbetResponse = 'fold'; break; }
          if (a.action === 'call') { cls.facedCbetResponse = 'call'; break; }
          if (isRaiseAction(a.action)) { cls.facedCbetResponse = 'raise'; break; }
        }
      }
    }
  }

  // Check-Raise: hero checked, faced a bet, and raised
  for (const street of ['flop', 'turn', 'river'] as const) {
    const streetActions = getActionsByStreet(actions, street);
    const result = heroFacedBetAndResponded(streetActions, street, heroName);
    if (result.faced && result.response === 'raise') {
      cls.checkRaise = true;
      cls.checkRaiseStreet = street;
      break;
    }
  }

  // Turn Barrel: hero c-bet flop and bet turn
  if (cls.cbet && parsed.sawTurn) {
    const heroTurnBet = turnActions.some((a) => isHeroAction(a, heroName) && isBetOrRaise(a.action));
    if (heroTurnBet) cls.turnBarrel = true;
  }

  // Faced Turn Barrel: opponent barreled turn, hero responded
  if (cls.facedCbet && parsed.sawTurn) {
    const oppTurnBet = turnActions.some((a) => a.player === preflopRaiser && isBetOrRaise(a.action));
    if (oppTurnBet) {
      cls.facedTurnBarrel = true;
      let oppBetSeen = false;
      for (const a of turnActions) {
        if (a.player === preflopRaiser && isBetOrRaise(a.action)) {
          oppBetSeen = true;
        } else if (isHeroAction(a, heroName) && oppBetSeen) {
          if (a.action === 'fold') { cls.facedTurnBarrelResponse = 'fold'; break; }
          if (a.action === 'call') { cls.facedTurnBarrelResponse = 'call'; break; }
          if (isRaiseAction(a.action)) { cls.facedTurnBarrelResponse = 'raise'; break; }
        }
      }
    }
  }

  // River Barrel: hero barrelled turn and bet river
  if (cls.turnBarrel && parsed.sawRiver) {
    const heroRiverBet = riverActions.some((a) => isHeroAction(a, heroName) && isBetOrRaise(a.action));
    if (heroRiverBet) cls.riverBarrel = true;
  }

  // Faced River Barrel: opponent barreled river, hero responded
  if (cls.facedTurnBarrel && parsed.sawRiver) {
    const oppRiverBet = riverActions.some((a) => a.player === preflopRaiser && isBetOrRaise(a.action));
    if (oppRiverBet) {
      cls.facedRiverBarrel = true;
      let oppBetSeen = false;
      for (const a of riverActions) {
        if (a.player === preflopRaiser && isBetOrRaise(a.action)) {
          oppBetSeen = true;
        } else if (isHeroAction(a, heroName) && oppBetSeen) {
          if (a.action === 'fold') { cls.facedRiverBarrelResponse = 'fold'; break; }
          if (a.action === 'call') { cls.facedRiverBarrelResponse = 'call'; break; }
          if (isRaiseAction(a.action)) { cls.facedRiverBarrelResponse = 'raise'; break; }
        }
      }
    }
  }

  // Triple Barrel: hero bet flop + turn + river as the aggressor
  if (cls.cbet && cls.turnBarrel && cls.riverBarrel) {
    cls.tripleBarrel = true;
  }

  // All-In: hero moved all-in, called an all-in, or faced an all-in decision
  for (const a of actions) {
    if (a.action === 'all-in') {
      cls.allIn = true;
      if (isHeroAction(a, heroName)) {
        cls.allInType = 'hero_allin';
      } else {
        // Check if hero had a decision after this all-in
        const idx = actions.indexOf(a);
        const heroAfter = actions.slice(idx + 1).some((ha) => isHeroAction(ha, heroName) && (ha.action === 'fold' || ha.action === 'call' || isRaiseAction(ha.action)));
        if (heroAfter && cls.allInType !== 'hero_allin') {
          // Check if hero called the all-in
          const heroCall = actions.slice(idx + 1).some((ha) => isHeroAction(ha, heroName) && ha.action === 'call');
          cls.allInType = heroCall ? 'hero_called_allin' : 'hero_faced_allin';
        }
      }
    }
  }

  return cls;
}

export interface HandRecord {
  hand_id: string;
  tournament_id: string | null;
  position: string | null;
  hero_name: string | null;
  hero_cards: string | null;
  board: string | null;
  net_result: number | null;
  stack_size: number | null;
  blinds: string | null;
  played_at: string | null;
  raw_hand_text: string | null;
  site: string | null;
  game_mode: string | null;
}

export interface ClassifiedHand extends HandRecord {
  classification: HandClassification;
  parsed: ParsedHand | null;
  stackBB: number | null;
}

export function classifyHandRecord(record: HandRecord): ClassifiedHand {
  const rawText = record.raw_hand_text;
  let parsed: ParsedHand | null = null;

  if (rawText) {
    parsed = parseHandBlock(rawText, record.site || 'unknown', (record.game_mode as AnalyticsMode) || 'mtt');
  }

  const classification = parsed ? classifyHand(parsed) : {
    vpip: false, pfr: false, threeBet: false,
    faced3bet: false, faced3betResponse: null,
    fourBet: false, limp: false,
    blindDefense: false, blindDefenseResponse: null,
    cbet: false, facedCbet: false, facedCbetResponse: null,
    checkRaise: false, checkRaiseStreet: null,
    turnBarrel: false, facedTurnBarrel: false, facedTurnBarrelResponse: null,
    riverBarrel: false, facedRiverBarrel: false, facedRiverBarrelResponse: null,
    tripleBarrel: false,
    allIn: false, allInType: null,
  };

  // Compute stack in BB
  const bigBlind = parseBigBlind(record.blinds);
  const stackBB = (record.stack_size !== null && bigBlind && bigBlind > 0)
    ? Math.round((record.stack_size / bigBlind) * 10) / 10
    : null;

  return {
    ...record,
    classification,
    parsed,
    stackBB,
  };
}

export function matchesPrimaryFilter(cls: HandClassification, filter: PrimaryFilter): boolean {
  switch (filter) {
    case 'vpip': return cls.vpip;
    case 'pfr': return cls.pfr;
    case '3bet': return cls.threeBet;
    case 'faced_3bet': return cls.faced3bet;
    case '4bet': return cls.fourBet;
    case 'limp': return cls.limp;
    case 'blind_defense': return cls.blindDefense;
    case 'cbet': return cls.cbet;
    case 'faced_cbet': return cls.facedCbet;
    case 'check_raise': return cls.checkRaise;
    case 'turn_barrel': return cls.turnBarrel;
    case 'faced_turn_barrel': return cls.facedTurnBarrel;
    case 'river_barrel': return cls.riverBarrel;
    case 'faced_river_barrel': return cls.facedRiverBarrel;
    case 'triple_barrel': return cls.tripleBarrel;
    case 'all_in': return cls.allIn;
    default: return false;
  }
}

export function matchesPositionFilter(position: string | null, filter: PositionFilter): boolean {
  if (filter === 'all') return true;
  if (!position) return false;
  return position === filter;
}

export function matchesStackFilter(stackBB: number | null, filter: StackFilter): boolean {
  if (filter === 'all') return true;
  if (stackBB === null) return false;
  switch (filter) {
    case '<10': return stackBB < 10;
    case '10-20': return stackBB >= 10 && stackBB < 20;
    case '20-30': return stackBB >= 20 && stackBB < 30;
    case '30-50': return stackBB >= 30 && stackBB < 50;
    case '50-100': return stackBB >= 50 && stackBB < 100;
    case '100+': return stackBB >= 100;
    default: return true;
  }
}

export function matchesResultFilter(netResult: number | null, filter: ResultFilter): boolean {
  if (filter === 'all') return true;
  if (netResult === null) return false;
  if (filter === 'won') return netResult > 0;
  if (filter === 'lost') return netResult < 0;
  return true;
}

export function applyFilters(
  hands: ClassifiedHand[],
  filters: HandSorterFilters,
): ClassifiedHand[] {
  return hands.filter((h) => {
    if (filters.primary && !matchesPrimaryFilter(h.classification, filters.primary)) return false;
    if (!matchesPositionFilter(h.position, filters.position)) return false;
    if (!matchesStackFilter(h.stackBB, filters.stack)) return false;
    if (filters.tournament !== 'all' && h.tournament_id !== filters.tournament) return false;
    if (!matchesResultFilter(h.net_result, filters.result)) return false;
    return true;
  });
}

export function getFilterCounts(hands: ClassifiedHand[]): Record<PrimaryFilter, number> {
  const counts = {} as Record<PrimaryFilter, number>;
  for (const f of ALL_PRIMARY_FILTERS) {
    counts[f] = 0;
  }
  for (const h of hands) {
    for (const f of ALL_PRIMARY_FILTERS) {
      if (matchesPrimaryFilter(h.classification, f)) {
        counts[f]++;
      }
    }
  }
  return counts;
}

export function getTournamentList(hands: ClassifiedHand[]): { id: string; label: string; count: number }[] {
  const map = new Map<string, { id: string; label: string; count: number }>();
  for (const h of hands) {
    if (!h.tournament_id) continue;
    const existing = map.get(h.tournament_id);
    if (existing) {
      existing.count++;
    } else {
      map.set(h.tournament_id, { id: h.tournament_id, label: h.tournament_id, count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function getResponseLabel(cls: HandClassification, filter: PrimaryFilter): string | null {
  switch (filter) {
    case 'faced_3bet': return cls.faced3betResponse;
    case 'blind_defense': return cls.blindDefenseResponse;
    case 'faced_cbet': return cls.facedCbetResponse;
    case 'faced_turn_barrel': return cls.facedTurnBarrelResponse;
    case 'faced_river_barrel': return cls.facedRiverBarrelResponse;
    case 'all_in': return cls.allInType === 'hero_allin' ? 'All-In' : cls.allInType === 'hero_called_allin' ? 'Called All-In' : cls.allInType === 'hero_faced_allin' ? 'Faced All-In' : null;
    case 'check_raise': return cls.checkRaiseStreet ? `CR (${cls.checkRaiseStreet})` : null;
    default: return null;
  }
}

export function formatHeroCards(cards: string | null): string {
  if (!cards) return '';
  return cards;
}

export function formatBoard(board: string | null): string {
  if (!board) return '';
  const parts = board.trim().split(/\s+/);
  if (parts.length <= 3) return board;
  return `${parts.slice(0, 3).join(' ')} | ${parts.slice(3).join(' ')}`;
}

export function formatResultBB(result: number | null | undefined): string {
  if (result == null || isNaN(result)) return '—';
  const sign = result > 0 ? '+' : '';
  return `${sign}${result.toFixed(1)} BB`;
}

export function resultColor(result: number | null): string {
  if (result === null) return '#6b7280';
  return result > 0 ? '#4ade80' : result < 0 ? '#f87171' : '#9ca3af';
}

export { computeNetChipsFromActions, computeAdvancedStatsForHand, createEmptyAdvancedStats, type AdvancedStats };
