import type { NormalizedWinner, Street } from '@/features/hh-replayer/types';
import { parseCard, evaluate7 } from './handEvaluator';
import {
  type BuilderAction, type BuilderActionType, type BuilderState, type PlayerState, type BuilderPlayer,
  type TableSetup, type HandSource,
  positionsForTable, firstToActPreflop, firstToActPostflop, nextActor,
  generateActionId, playerNameForPosition,
} from './builderTypes';

export function createInitialState(setup: TableSetup): BuilderState {
  const positions = positionsForTable(setup.seatCount);
  const configuredPlayers: BuilderPlayer[] = setup.players.length > 0
    ? setup.players
    : positions.map((position, seat) => ({
        seat: seat + 1,
        name: playerNameForPosition(position, setup.heroPosition),
        position,
        stack: null,
        isHero: position === setup.heroPosition,
        holeCards: null,
      }));
  const players: PlayerState[] = configuredPlayers.map((configured, i) => {
    const stack = configured.stackChips ?? (configured.stack === null ? 0 : setup.stackMode === 'bb' ? configured.stack * setup.bigBlind : configured.stack);
    return {
      name: configured.name || `Player ${i + 1}`,
      seat: configured.seat || i + 1,
      position: configured.position,
      isHero: configured.isHero,
      startingStack: stack,
      currentStack: stack,
      committedThisStreet: 0,
      committedTotal: 0,
      folded: false,
      allIn: false,
      holeCards: null,
      hasActedThisStreet: false,
    };
  });

  // Post blinds
  const sbPlayer = players.find(p => p.position === 'SB');
  const bbPlayer = players.find(p => p.position === 'BB');

  if (sbPlayer) {
    const sbAmount = Math.min(setup.smallBlind, sbPlayer.currentStack);
    sbPlayer.currentStack -= sbAmount;
    sbPlayer.committedThisStreet = sbAmount;
    sbPlayer.committedTotal = sbAmount;
    if (sbPlayer.currentStack === 0) sbPlayer.allIn = true;
  }
  if (bbPlayer) {
    const bbAmount = Math.min(setup.bigBlind, bbPlayer.currentStack);
    bbPlayer.currentStack -= bbAmount;
    bbPlayer.committedThisStreet = bbAmount;
    bbPlayer.committedTotal = bbAmount;
    if (bbPlayer.currentStack === 0) bbPlayer.allIn = true;
  }

  // Post antes
  if (setup.anteType === 'per_player' && setup.ante > 0) {
    for (const p of players) {
      const anteAmount = Math.min(setup.ante, p.currentStack);
      p.currentStack -= anteAmount;
      p.committedTotal += anteAmount;
      if (p.currentStack === 0) p.allIn = true;
    }
  } else if (setup.anteType === 'bb_ante' && setup.ante > 0 && bbPlayer) {
    const anteAmount = Math.min(setup.ante, bbPlayer.currentStack);
    bbPlayer.currentStack -= anteAmount;
    bbPlayer.committedTotal += anteAmount;
    if (bbPlayer.currentStack === 0) bbPlayer.allIn = true;
  }

  const centralPot = computeCentralPot(players);
  const currentStreetBet = Math.max(
    sbPlayer?.committedThisStreet ?? 0,
    bbPlayer?.committedThisStreet ?? 0,
  );

  for (const position of setup.autoFoldPositions ?? []) {
    const player = players.find(p => p.position === position && !p.isHero);
    if (player) player.folded = true;
  }

  const activePlayers = players.filter(p => !p.folded);
  const firstActor = firstToActPreflop(activePlayers.map(p => p.position));
  const actor = activePlayers.find(p => p.position === firstActor) ?? activePlayers[0];

  const state: BuilderState = {
    setup,
    players,
    actions: [],
    board: { flop: [], turn: null, river: null },
    street: 'preflop',
    pot: 0,
    centralPot,
    currentStreetBet,
    lastAggressor: null,
    currentActor: actor?.name ?? null,
    legalActions: [],
    amountToCall: 0,
    minRaise: setup.bigBlind,
    isComplete: activePlayers.length <= 1,
    winners: [],
  };

  recomputeLegalActions(state);
  return state;
}

function computeCentralPot(players: PlayerState[]): number {
  // Antes go to central pot; blinds are street bets (in front of players)
  // For simplicity in the builder, we track all committed as street bets
  // and merge to central pot on street changes
  return 0;
}

function getActivePlayers(state: BuilderState): PlayerState[] {
  return state.players.filter(p => !p.folded);
}

function getPlayersWhoCanAct(state: BuilderState): PlayerState[] {
  return state.players.filter(p => !p.folded && !p.allIn);
}

export function recomputeLegalActions(state: BuilderState): void {
  if (!state.currentActor || state.isComplete) {
    state.legalActions = [];
    state.amountToCall = 0;
    state.minRaise = state.setup.bigBlind;
    return;
  }

  const player = state.players.find(p => p.name === state.currentActor);
  if (!player) {
    state.legalActions = [];
    return;
  }

  const streetBet = state.currentStreetBet;
  const playerCommitted = player.committedThisStreet;
  const amountToCall = Math.max(0, streetBet - playerCommitted);
  state.amountToCall = amountToCall;

  // Update minRaise from the current aggressor BEFORE checking playerCanRaise
  if (amountToCall > 0 && state.lastAggressor) {
    const aggressor = state.players.find(p => p.name === state.lastAggressor);
    if (aggressor) {
      const raiseSize = streetBet - aggressor.committedThisStreet;
      state.minRaise = Math.max(state.setup.bigBlind, raiseSize);
    }
  } else if (amountToCall === 0) {
    state.minRaise = state.setup.bigBlind;
  }

  // If only one non-folded player remains (others folded or all-in), hand may be over
  const canAct = getPlayersWhoCanAct(state);

  if (amountToCall === 0) {
    // No bet to call — can check or bet
    state.legalActions = ['check'];
    if (player.currentStack > 0 && canAct.length > 1) {
      state.legalActions.push('bet');
    }
    if (player.currentStack > 0) {
      state.legalActions.push('allin');
    }
  } else {
    // Facing a bet — can fold, call, raise, or jam
    state.legalActions = ['fold', 'call'];

    // Can raise only if player has more chips than needed to call the min raise
    const minRaiseTotal = streetBet + state.minRaise;
    const playerTotalAvailable = player.currentStack + playerCommitted;
    const playerCanRaise = playerTotalAvailable > minRaiseTotal;
    if (playerCanRaise) {
      state.legalActions.push('raise');
    }

    // All-in is always an option if player has chips
    if (player.currentStack > 0) {
      state.legalActions.push('allin');
    }
  }
}

export function applyAction(
  state: BuilderState,
  type: BuilderActionType,
  amount?: number,
): BuilderState {
  if (!state.currentActor || state.isComplete) return state;

  const player = state.players.find(p => p.name === state.currentActor);
  if (!player) return state;

  if (!state.legalActions.includes(type)) return state;

  const action: BuilderAction = {
    actionId: generateActionId(),
    street: state.street,
    player: player.name,
    position: player.position,
    type,
    isAllIn: false,
  };

  const newState = cloneState(state);
  const p = newState.players.find(pl => pl.name === player.name)!;

  switch (type) {
    case 'fold': {
      p.folded = true;
      p.hasActedThisStreet = true;
      break;
    }
    case 'check': {
      p.hasActedThisStreet = true;
      break;
    }
    case 'call': {
      const callAmount = Math.min(newState.amountToCall, p.currentStack);
      p.currentStack -= callAmount;
      p.committedThisStreet += callAmount;
      p.committedTotal += callAmount;
      p.hasActedThisStreet = true;
      if (p.currentStack === 0) {
        p.allIn = true;
        action.isAllIn = true;
        action.type = 'allin';
      }
      break;
    }
    case 'bet': {
      const betAmount = Math.min(amount ?? 0, p.currentStack);
      p.currentStack -= betAmount;
      p.committedThisStreet = betAmount;
      p.committedTotal += betAmount;
      newState.currentStreetBet = betAmount;
      newState.lastAggressor = p.name;
      newState.minRaise = Math.max(newState.setup.bigBlind, betAmount);
      // A bet reopens action: clear hasActedThisStreet for everyone else
      for (const pl of newState.players) {
        if (pl.name !== p.name && !pl.folded && !pl.allIn) pl.hasActedThisStreet = false;
      }
      p.hasActedThisStreet = true;
      if (p.currentStack === 0) {
        p.allIn = true;
        action.isAllIn = true;
        action.type = 'allin';
      } else {
        action.amount = betAmount;
      }
      break;
    }
    case 'raise': {
      // amount = total committed to this street (raise TO amount)
      const raiseTotal = Math.min(amount ?? 0, p.currentStack + p.committedThisStreet);
      const additional = raiseTotal - p.committedThisStreet;
      p.currentStack -= additional;
      p.committedThisStreet = raiseTotal;
      p.committedTotal += additional;
      newState.currentStreetBet = raiseTotal;
      newState.lastAggressor = p.name;
      const raiseDelta = raiseTotal - state.currentStreetBet;
      newState.minRaise = Math.max(newState.minRaise, raiseDelta > 0 ? raiseDelta : newState.setup.bigBlind);
      // A raise reopens action: clear hasActedThisStreet for everyone else
      for (const pl of newState.players) {
        if (pl.name !== p.name && !pl.folded && !pl.allIn) pl.hasActedThisStreet = false;
      }
      p.hasActedThisStreet = true;
      if (p.currentStack === 0) {
        p.allIn = true;
        action.isAllIn = true;
        action.type = 'allin';
      }
      action.amount = raiseTotal;
      break;
    }
    case 'allin': {
      const allInTotal = p.committedThisStreet + p.currentStack;
      const additional = p.currentStack;
      p.currentStack = 0;
      p.committedThisStreet = allInTotal;
      p.committedTotal += additional;
      p.allIn = true;
      p.hasActedThisStreet = true;
      action.isAllIn = true;
      action.type = 'allin';
      action.amount = allInTotal;

      if (allInTotal > newState.currentStreetBet) {
        newState.currentStreetBet = allInTotal;
        newState.lastAggressor = p.name;
        // An all-in raise reopens action for players who can still act
        for (const pl of newState.players) {
          if (pl.name !== p.name && !pl.folded && !pl.allIn) pl.hasActedThisStreet = false;
        }
      }
      break;
    }
  }

  newState.actions = [...newState.actions, action];

  // Check if hand is over (only one non-folded player)
  const remaining = newState.players.filter(pl => !pl.folded);
  if (remaining.length <= 1) {
    newState.isComplete = true;
    newState.currentActor = null;
    newState.legalActions = [];
    if (remaining.length === 1) {
      newState.winners = [{ player: remaining[0].name, amount: computeTotalPot(newState) }];
    }
    return newState;
  }

  // Determine if betting round is complete
  const canAct = getPlayersWhoCanAct(newState);
  const roundComplete = isBettingRoundComplete(newState, p);

  if (roundComplete) {
    advanceStreet(newState);
  } else {
    advanceActor(newState, p);
  }

  recomputeLegalActions(newState);
  return newState;
}

function isBettingRoundComplete(state: BuilderState, lastActor: PlayerState): boolean {
  const canAct = getPlayersWhoCanAct(state);

  // If only 0 or 1 players can act, and all-in situation, round is complete
  if (canAct.length <= 1) {
    // If one player can still act and they haven't matched the bet, they need to act
    if (canAct.length === 1) {
      const remaining = canAct[0];
      if (remaining.committedThisStreet < state.currentStreetBet && !remaining.allIn) {
        return false;
      }
    }
    return true;
  }

  // A betting round is complete when:
  // 1. All players who can act have acted this street (hasActedThisStreet)
  // 2. All players who can act have matched the current street bet
  const allActed = canAct.every(p => p.hasActedThisStreet);
  if (!allActed) return false;

  const allMatched = canAct.every(p =>
    p.committedThisStreet >= state.currentStreetBet || p.allIn
  );
  if (!allMatched) return false;

  return true;
}

function advanceActor(state: BuilderState, lastActor: PlayerState): void {
  const canAct = getPlayersWhoCanAct(state);
  if (canAct.length === 0) {
    state.currentActor = null;
    return;
  }
  const activePositions = canAct.map(p => p.position);
  state.currentActor = nextActor(lastActor.position, activePositions);

  // Map position back to player name
  const next = state.players.find(p => p.position === state.currentActor);
  state.currentActor = next?.name ?? null;
}

function determineShowdownWinners(state: BuilderState): NormalizedWinner[] {
  const nonFolded = state.players.filter(p => !p.folded);
  const totalPot = computeTotalPot(state);
  if (nonFolded.length === 0) return [];
  if (nonFolded.length === 1) return [{ player: nonFolded[0].name, amount: totalPot }];

  const boardCards: string[] = [
    ...state.board.flop,
    ...(state.board.turn ? [state.board.turn] : []),
    ...(state.board.river ? [state.board.river] : []),
  ];

  const playersWithCards = nonFolded.filter(p => p.holeCards && p.holeCards.length === 2);
  const playersWithoutCards = nonFolded.filter(p => !p.holeCards || p.holeCards.length < 2);

  if (playersWithCards.length === 0) {
    const share = Math.round((totalPot / nonFolded.length) * 100) / 100;
    return nonFolded.map(p => ({ player: p.name, amount: share }));
  }

  const evaluated = playersWithCards.map(p => {
    const cards = [...p.holeCards!, ...boardCards].map(parseCard).filter(c => c !== null);
    return { player: p.name, score: evaluate7(cards) };
  });

  const bestScore = Math.max(...evaluated.map(e => e.score));
  const winners = evaluated.filter(e => e.score === bestScore);

  if (playersWithoutCards.length > 0) {
    const unknownShare = Math.round((totalPot / nonFolded.length) * 100) / 100;
    return [...winners.map(w => ({ player: w.player, amount: unknownShare })), ...playersWithoutCards.map(p => ({ player: p.name, amount: unknownShare }))];
  }

  const winShare = Math.round((totalPot / winners.length) * 100) / 100;
  return winners.map(w => ({ player: w.player, amount: winShare }));
}

function advanceStreet(state: BuilderState): void {
  // Merge street bets into central pot
  for (const p of state.players) {
    state.centralPot += p.committedThisStreet;
    p.committedThisStreet = 0;
    p.hasActedThisStreet = false;
  }
  state.currentStreetBet = 0;
  state.lastAggressor = null;
  state.minRaise = state.setup.bigBlind;

  // Check if all remaining players are all-in
  const remaining = state.players.filter(p => !p.folded);
  const canAct = getPlayersWhoCanAct(state);

  if (canAct.length <= 1 && remaining.length >= 2) {
    // All-in scenario — no more betting decisions, hand runs out.
    // Advance to showdown and determine winners immediately.
    state.street = 'showdown';
    state.isComplete = true;
    state.currentActor = null;
    state.legalActions = [];
    state.winners = determineShowdownWinners(state);
    return;
  }

  // Advance street
  if (state.street === 'preflop') {
    state.street = 'flop';
  } else if (state.street === 'flop') {
    state.street = 'turn';
  } else if (state.street === 'turn') {
    state.street = 'river';
  } else if (state.street === 'river') {
    state.street = 'showdown';
    state.isComplete = true;
    state.currentActor = null;
    state.legalActions = [];
    state.winners = determineShowdownWinners(state);
    return;
  }

  // Set first to act postflop
  const activePositions = canAct.map(p => p.position);
  const firstPos = firstToActPostflop(activePositions);
  const first = state.players.find(p => p.position === firstPos);
  state.currentActor = first?.name ?? null;
}

export function setBoard(state: BuilderState, street: Street, cards: string[]): BuilderState {
  const newState = cloneState(state);
  if (street === 'flop') {
    newState.board.flop = cards.slice(0, 3);
  } else if (street === 'turn') {
    newState.board.turn = cards[0] ?? null;
  } else if (street === 'river') {
    newState.board.river = cards[0] ?? null;
  }
  return newState;
}

export function setHeroCards(state: BuilderState, cards: string[]): BuilderState {
  const newState = cloneState(state);
  const hero = newState.players.find(p => p.isHero);
  if (hero) {
    hero.holeCards = cards.length > 0 ? cards : null;
  }
  return newState;
}

export function setVillainCards(state: BuilderState, playerName: string, cards: string[]): BuilderState {
  const newState = cloneState(state);
  const player = newState.players.find(p => p.name === playerName);
  if (player) {
    player.holeCards = cards.length > 0 ? cards : null;
  }
  return newState;
}

export function undoLastAction(state: BuilderState): BuilderState {
  if (state.actions.length === 0) return state;
  // Rebuild from scratch by replaying all actions except the last
  const setup = state.setup;
  const heroCards = state.players.find(p => p.isHero)?.holeCards ?? null;
  const villainCardsMap = new Map<string, string[] | null>();
  for (const p of state.players) {
    if (!p.isHero && p.holeCards) villainCardsMap.set(p.name, p.holeCards);
  }
  const board = { ...state.board };

  let newState = createInitialState(setup);
  if (heroCards) newState = setHeroCards(newState, heroCards);
  for (const [name, cards] of villainCardsMap) {
    if (cards) newState = setVillainCards(newState, name, cards);
  }

  const actionsToReplay = state.actions.slice(0, -1);
  for (const a of actionsToReplay) {
    newState = applyAction(newState, a.type, a.amount);
  }

  // Restore board
  newState.board = board;

  return newState;
}

export function computeTotalPot(state: BuilderState): number {
  const streetBets = state.players.reduce((sum, p) => sum + p.committedThisStreet, 0);
  return Math.round((state.centralPot + streetBets) * 100) / 100;
}

function cloneState(state: BuilderState): BuilderState {
  return {
    ...state,
    setup: { ...state.setup },
    players: state.players.map(p => ({ ...p })),
    actions: [...state.actions],
    board: { ...state.board },
    winners: [...state.winners],
  };
}

export function isStreetComplete(state: BuilderState): boolean {
  if (state.isComplete) return true;
  const canAct = getPlayersWhoCanAct(state);
  if (canAct.length === 0) return true;
  return isBettingRoundComplete(state, state.players.find(p => p.name === state.currentActor)!);
}

export function needsBoardSelection(state: BuilderState): boolean {
  if (state.isComplete) return false;
  if (state.street === 'flop' && state.board.flop.length === 0) return true;
  if (state.street === 'turn' && state.board.turn === null) return true;
  if (state.street === 'river' && state.board.river === null) return true;
  return false;
}
