// ─── Replayer invariants: development-only sanity checks ────────────────────
// These run only in dev mode and never alter rendering. They log warnings for
// invalid replayer state so geometry/label bugs are caught during development
// rather than in production.

import type { ParsedHand } from '../handParser';

export interface SeatGeometryEntry {
  seatIndex: number;
  top: string;
  left: string;
  ux: number;
  uy: number;
}

interface InvariantContext {
  hand: ParsedHand;
  seatEntries: { player: ParsedHand['players'][number]; seatIndex: number; pos: SeatGeometryEntry }[];
  ringRX: number;
  ringRY: number;
  handId: string;
}

function warn(handId: string, seatIndex: number | string, msg: string) {
  console.warn(`[Replayer Invariant] hand=${handId} seat=${seatIndex}: ${msg}`);
}

function parsePct(s: string): number {
  return parseFloat(s);
}

export function checkReplayerInvariants(ctx: InvariantContext): void {
  if (!import.meta.env.DEV) return;

  const { hand, seatEntries, handId } = ctx;
  const players = hand.players;

  // 1. Duplicate seat index
  const seatIdxSeen = new Set<number>();
  for (const e of seatEntries) {
    if (seatIdxSeen.has(e.seatIndex)) {
      warn(handId, e.seatIndex, 'duplicate seat index');
    }
    seatIdxSeen.add(e.seatIndex);
  }

  // 2. Duplicate poker position
  const posSeen = new Set<string>();
  for (const p of players) {
    if (!p.position) continue;
    if (posSeen.has(p.position)) {
      warn(handId, p.seat, `duplicate position ${p.position}`);
    }
    posSeen.add(p.position);
  }

  // 3. More than one BTN
  const btns = players.filter(p => p.position === 'BTN');
  if (btns.length > 1) {
    warn(handId, '-', `more than one BTN (${btns.length})`);
  }

  // 4. Missing BTN when players exist
  if (players.length > 1 && btns.length === 0 && hand.actions.length > 0) {
    warn(handId, '-', 'no BTN assigned but players exist');
  }

  // 5. SB or BB missing when expected (preflop actions exist)
  const hasPreflop = hand.actions.some(a => a.street === 'preflop');
  if (hasPreflop && players.length >= 3) {
    if (!players.some(p => p.position === 'SB')) warn(handId, '-', 'SB missing when preflop actions exist');
    if (!players.some(p => p.position === 'BB')) warn(handId, '-', 'BB missing when preflop actions exist');
  }

  // 6. Hero mapped to multiple seats
  const heroes = players.filter(p => p.isHero);
  if (heroes.length > 1) {
    warn(handId, '-', `hero mapped to ${heroes.length} seats`);
  }

  // 7. Occupied seat without a position (when actions exist)
  for (const p of players) {
    if (p.name && !p.position && hand.actions.length > 0 && !p.isHero) {
      // Hero might not have a position in some parsers — only warn for non-hero
      warn(handId, p.seat, `occupied seat without position (name=${p.name})`);
    }
  }

  // 8. NaN / undefined coordinates
  for (const e of seatEntries) {
    const top = parsePct(e.pos.top);
    const left = parsePct(e.pos.left);
    if (!Number.isFinite(top)) warn(handId, e.seatIndex, `top is not finite: ${e.pos.top}`);
    if (!Number.isFinite(left)) warn(handId, e.seatIndex, `left is not finite: ${e.pos.left}`);
    if (!Number.isFinite(e.pos.ux)) warn(handId, e.seatIndex, `ux is not finite`);
    if (!Number.isFinite(e.pos.uy)) warn(handId, e.seatIndex, `uy is not finite`);
  }

  // 9. Seat coordinates outside valid table range [0, 100]
  for (const e of seatEntries) {
    const top = parsePct(e.pos.top);
    const left = parsePct(e.pos.left);
    if (top < 0 || top > 100) warn(handId, e.seatIndex, `top out of range: ${top}`);
    if (left < 0 || left > 100) warn(handId, e.seatIndex, `left out of range: ${left}`);
  }

  // 10. Dealer button assigned to invalid seat
  if (hand.buttonSeat > 0) {
    const validSeat = players.some(p => p.seat === hand.buttonSeat);
    if (!validSeat) warn(handId, '-', `dealer button on invalid seat ${hand.buttonSeat}`);
  }
}
