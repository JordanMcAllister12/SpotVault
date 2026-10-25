import type {
  NormalizedHand, NormalizedPlayer, NormalizedAction, NormalizedBoard,
  NormalizedWinner, ActionType, Street,
} from '@/features/hh-replayer/types';
import type { BuilderState, BuilderAction, TableSetup } from './builderTypes';
import { generateHandId } from './builderTypes';

export function builderStateToNormalizedHand(
  state: BuilderState,
  handId?: string,
): NormalizedHand {
  const setup = state.setup;

  const players: NormalizedPlayer[] = state.players.map(p => ({
    seat: p.seat,
    name: p.name,
    stack: p.startingStack,
    position: p.position,
    isHero: p.isHero,
    holeCards: p.holeCards ?? undefined,
    showdownCards: !p.isHero && p.holeCards ? p.holeCards : undefined,
    revealMode: !p.isHero && p.holeCards ? 'reveal_at_showdown' : undefined,
    showdownAction: !p.isHero && p.holeCards ? 'show' : undefined,
  }));

  const heroPlayer = state.players.find(p => p.isHero);

  // Build NormalizedActions: include blind posts first, then all builder actions
  const actions: NormalizedAction[] = [];

  // Preflop blind posts
  if (setup.anteType === 'per_player' && setup.ante > 0) {
    for (const p of state.players) {
      actions.push({
        index: actions.length,
        street: 'preflop' as Street,
        player: p.name,
        type: 'post_ante' as ActionType,
        amount: setup.ante,
      });
    }
  } else if (setup.anteType === 'bb_ante' && setup.ante > 0) {
    const bb = state.players.find(p => p.position === 'BB');
    if (bb) {
      actions.push({
        index: actions.length,
        street: 'preflop' as Street,
        player: bb.name,
        type: 'post_ante' as ActionType,
        amount: setup.ante,
      });
    }
  }

  const sbPlayer = state.players.find(p => p.position === 'SB');
  const bbPlayer = state.players.find(p => p.position === 'BB');

  if (sbPlayer && setup.smallBlind > 0) {
    actions.push({
      index: actions.length,
      street: 'preflop' as Street,
      player: sbPlayer.name,
      type: 'post_sb' as ActionType,
      amount: setup.smallBlind,
    });
  }
  if (bbPlayer && setup.bigBlind > 0) {
    actions.push({
      index: actions.length,
      street: 'preflop' as Street,
      player: bbPlayer.name,
      type: 'post_bb' as ActionType,
      amount: setup.bigBlind,
    });
  }

  // Map builder actions to normalized actions
  for (const ba of state.actions) {
    const normType = mapActionType(ba.type);
    actions.push({
      index: actions.length,
      street: ba.street,
      player: ba.player,
      type: normType,
      amount: ba.amount,
    });
  }

  // If hand ended without showdown, add a collect/win action for the last remaining player
  if (state.isComplete && state.winners.length > 0 && state.street !== 'showdown') {
    for (const w of state.winners) {
      actions.push({
        index: actions.length,
        street: state.street,
        player: w.player,
        type: 'collect' as ActionType,
        amount: w.amount,
      });
    }
  } else if (state.isComplete && state.winners.length > 0 && state.street === 'showdown') {
    for (const w of state.winners) {
      actions.push({
        index: actions.length,
        street: 'showdown' as Street,
        player: w.player,
        type: 'win' as ActionType,
        amount: w.amount,
      });
    }
  }

  const board: NormalizedBoard = {
    flop: state.board.flop,
    turn: state.board.turn,
    river: state.board.river,
  };

  const stakes = formatStakes(setup);

  return {
    handId: handId ?? generateHandId(),
    site: 'manual',
    gameType: "Hold'em",
    stakes,
    date: new Date().toISOString(),
    tableName: 'Constructed Hand',
    buttonSeat: 0,
    heroName: heroPlayer?.name ?? 'Hero',
    players,
    actions,
    board,
    pot: state.winners.reduce((sum, w) => sum + w.amount, 0) || 0,
    rake: 0,
    winners: state.winners,
    rawText: '',
    title: setup.source === 'scenario' ? 'Constructed Scenario' : 'Constructed Hand',
    blindLevel: setup.blindLevel || undefined,
  };
}

function mapActionType(type: BuilderAction['type']): ActionType {
  switch (type) {
    case 'fold': return 'fold';
    case 'check': return 'check';
    case 'call': return 'call';
    case 'bet': return 'bet';
    case 'raise': return 'raise';
    case 'allin': return 'allin';
    default: return 'fold';
  }
}

function formatStakes(setup: TableSetup): string {
  if (setup.gameFormat === 'tournament') {
    const level = setup.blindLevel ? `Level ${setup.blindLevel} — ` : '';
    return `${level}${setup.smallBlind}/${setup.bigBlind} + ${setup.ante} ante`;
  }
  return `${setup.smallBlind}/${setup.bigBlind}`;
}

export function builderStateToJson(state: BuilderState): string {
  return JSON.stringify({
    setup: state.setup,
    players: state.players.map(p => ({
      seat: p.seat,
      name: p.name,
      position: p.position,
      stack: p.startingStack,
      isHero: p.isHero,
      holeCards: p.holeCards,
    })),
    actions: state.actions,
    board: state.board,
    winners: state.winners,
  });
}
