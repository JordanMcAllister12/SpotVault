import type { ParsedHand } from '../../../lib/handParser';
import type { NormalizedHand } from '../types/NormalizedHand';

/**
 * Adapter: ParsedHand (SpotVault handParser output) → NormalizedHand.
 * The replayer only consumes the normalized shape, so it has no direct
 * dependency on the parser or any database layer.
 */
export function parsedHandToNormalized(hand: ParsedHand): NormalizedHand {
  return {
    handId: hand.handId ?? '',
    site: hand.site,
    gameType: hand.gameType,
    stakes: hand.stakes,
    date: hand.date,
    tableName: hand.tableName,
    buttonSeat: hand.buttonSeat,
    heroName: hand.heroName,
    players: hand.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      stack: p.stack,
      position: p.position,
      isHero: p.isHero,
      holeCards: p.holeCards,
    })),
    actions: hand.actions.map((a) => ({
      index: a.index,
      street: a.street,
      player: a.player,
      type: a.type,
      amount: a.amount,
    })),
    board: {
      flop: hand.board.flop,
      turn: hand.board.turn,
      river: hand.board.river,
    },
    pot: hand.pot,
    rake: hand.rake,
    winners: hand.winners.map((w) => ({
      player: w.player,
      amount: w.amount,
    })),
    rawText: hand.rawText,
    title: hand.title,
  };
}

/**
 * Adapter: NormalizedHand → ParsedHand (for compatibility with PokerTable).
 * Used internally by the HHReplayer wrapper to feed PokerTable, which
 * still expects the legacy ParsedHand shape.
 */
export function normalizedToParsedHand(hand: NormalizedHand): ParsedHand {
  return {
    site: hand.site,
    handId: hand.handId,
    gameType: hand.gameType,
    stakes: hand.stakes,
    date: hand.date,
    tableName: hand.tableName,
    buttonSeat: hand.buttonSeat,
    players: hand.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      stack: p.stack,
      position: p.position,
      isHero: p.isHero,
      holeCards: p.holeCards,
    })),
    heroName: hand.heroName,
    board: {
      flop: hand.board.flop,
      turn: hand.board.turn,
      river: hand.board.river,
    },
    actions: hand.actions.map((a) => ({
      index: a.index,
      street: a.street,
      player: a.player,
      type: a.type,
      amount: a.amount,
    })),
    pot: hand.pot,
    rake: hand.rake,
    winners: hand.winners.map((w) => ({
      player: w.player,
      amount: w.amount,
    })),
    rawText: hand.rawText,
    parseErrors: [],
    title: hand.title,
  } as ParsedHand;
}
