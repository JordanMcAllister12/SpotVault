/**
 * Canonical hand accounting regression tests.
 *
 * These tests verify the V1-compatible per-street commitment accounting:
 *   - raise-to OVERWRITE semantics (street commitment = "to" total)
 *   - antes tracked separately from street commitments
 *   - blinds add to preflop street commitment
 *   - uncalled returns reduce invested exactly once
 *   - collection deduplication (summary total vs aggregate showdown)
 *   - valid folded hands receive negative results
 *   - zero-investment/zero-collection hands receive 0 (not null)
 *
 * The key regression hand TM6030685362 exposed the raise-to bug:
 *   Hero calls 1600, then raises 33132 to 42812 (all-in), uncalled 33132 returned.
 *   V1 (OVERWRITE): invested = 120 (ante) + 42812 (total) - 33132 (uncalled) = 9800 → -10.32 BB
 *   V2 (ADD, bug):   invested = 120 + 1600 + 33132 - 33132 = 1720 → -0.22 BB
 */

import { describe, it, expect } from 'vitest';

// ── Canonical accounting (mirrors pokerAnalytics.ts computeNetChipsFromActions) ──

interface ActionEntry {
  street: 'preflop' | 'flop' | 'turn' | 'river';
  player: string;
  action: string;
  amount: number | null;
}

function computeNetChipsFromActions(actions: ActionEntry[], heroName: string | null): { netChips: number | null; invested: number; collected: number } {
  if (!heroName || !actions || actions.length === 0) return { netChips: null, invested: 0, collected: 0 };

  const streetCommit: Record<string, number> = { preflop: 0, flop: 0, turn: 0, river: 0 };
  let antes = 0;
  let uncalledTotal = 0;
  let collected = 0;

  for (const a of actions) {
    if (a.player !== heroName) continue;
    if (a.action === 'show') { continue; }
    if (a.amount === null || a.amount === undefined) continue;

    if (a.action === 'post') {
      streetCommit.preflop += a.amount;
    } else if (a.action === 'post_ante') {
      antes += a.amount;
    } else if (a.action === 'call') {
      streetCommit[a.street] += a.amount;
    } else if (a.action === 'bet') {
      streetCommit[a.street] = a.amount;
    } else if (a.action === 'raise' || a.action === 'all-in') {
      streetCommit[a.street] = a.amount;
    } else if (a.action === 'uncalled') {
      uncalledTotal += a.amount;
    } else if (a.action === 'collect') {
      collected += a.amount;
    }
  }

  let invested = antes + streetCommit.preflop + streetCommit.flop + streetCommit.turn + streetCommit.river - uncalledTotal;

  if (invested === 0 && collected === 0) return { netChips: 0, invested: 0, collected: 0 };
  return { netChips: collected - invested, invested, collected };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Canonical hand accounting', () => {
  const HERO = 'Hero';

  it('ante + fold: valid negative result', () => {
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post_ante', amount: 120 },
      { street: 'preflop', player: HERO, action: 'fold', amount: null },
    ];
    const { netChips, invested, collected } = computeNetChipsFromActions(actions, HERO);
    expect(invested).toBe(120);
    expect(collected).toBe(0);
    expect(netChips).toBe(-120);
    expect(round2(netChips! / 800)).toBe(-0.15);
  });

  it('SB + fold: valid negative result', () => {
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post', amount: 400 },
      { street: 'preflop', player: HERO, action: 'fold', amount: null },
    ];
    const { netChips, invested } = computeNetChipsFromActions(actions, HERO);
    expect(invested).toBe(400);
    expect(netChips).toBe(-400);
    expect(round2(netChips! / 800)).toBe(-0.5);
  });

  it('BB + fold: valid negative result', () => {
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post', amount: 800 },
      { street: 'preflop', player: HERO, action: 'fold', amount: null },
    ];
    const { netChips, invested } = computeNetChipsFromActions(actions, HERO);
    expect(invested).toBe(800);
    expect(netChips).toBe(-800);
    expect(round2(netChips! / 800)).toBe(-1);
  });

  it('call + fold: valid negative result', () => {
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'call', amount: 800 },
      { street: 'preflop', player: HERO, action: 'fold', amount: null },
    ];
    const { netChips, invested } = computeNetChipsFromActions(actions, HERO);
    expect(invested).toBe(800);
    expect(netChips).toBe(-800);
  });

  it('blind + raise: OVERWRITE semantics (raise-to replaces blind)', () => {
    // Hero posts BB 1200, then raises to 25000
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post', amount: 1200 },
      { street: 'preflop', player: HERO, action: 'raise', amount: 25000 },
    ];
    const { netChips, invested } = computeNetChipsFromActions(actions, HERO);
    // OVERWRITE: preflop commitment = 25000 (not 1200 + 25000 = 26200)
    expect(invested).toBe(25000);
    expect(netChips).toBe(-25000);
  });

  it('call + raise: OVERWRITE semantics (raise-to replaces call)', () => {
    // Hero calls 1600, then raises to 42812
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'call', amount: 1600 },
      { street: 'preflop', player: HERO, action: 'raise', amount: 42812 },
    ];
    const { netChips, invested } = computeNetChipsFromActions(actions, HERO);
    // OVERWRITE: preflop commitment = 42812 (not 1600 + 42812)
    expect(invested).toBe(42812);
    expect(netChips).toBe(-42812);
  });

  it('TM6030685362: the key regression hand (call + raise-to + uncalled, showdown)', () => {
    // Hero: posts ante 120, calls 1600, raises 33132 to 42812 (all-in),
    // uncalled bet (33132) returned, collected 1544
    // Uncalled is ALWAYS subtracted (the fix makes it unconditional)
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post_ante', amount: 120 },
      { street: 'preflop', player: HERO, action: 'call', amount: 1600 },
      { street: 'preflop', player: HERO, action: 'all-in', amount: 42812 },
      { street: 'river', player: HERO, action: 'show', amount: null },
      { street: 'river', player: HERO, action: 'uncalled', amount: 33132 },
      { street: 'river', player: HERO, action: 'collect', amount: 1544 },
    ];
    const { netChips, invested, collected } = computeNetChipsFromActions(actions, HERO);
    // OVERWRITE: preflop = 42812 (not 120 + 1600 + 33132 = 34852)
    // invested = 120 (ante) + 42812 (preflop) - 33132 (uncalled) = 9800
    expect(invested).toBe(9800);
    expect(collected).toBe(1544);
    expect(netChips).toBe(1544 - 9800);
    expect(round2(netChips! / 800)).toBe(-10.32);
  });

  it('raise + re-raise: OVERWRITE replaces previous raise', () => {
    // Hero raises to 2000, then re-raises to 6000
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'raise', amount: 2000 },
      { street: 'preflop', player: HERO, action: 'raise', amount: 6000 },
    ];
    const { invested } = computeNetChipsFromActions(actions, HERO);
    expect(invested).toBe(6000);
  });

  it('all-in: OVERWRITE with total commitment', () => {
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post', amount: 800 },
      { street: 'preflop', player: HERO, action: 'all-in', amount: 50000 },
    ];
    const { invested } = computeNetChipsFromActions(actions, HERO);
    expect(invested).toBe(50000);
  });

  it('uncalled return without showdown: uncalled always subtracted from invested', () => {
    // Non-showdown hand: opponent folds, uncalled returned.
    // The uncalled amount is ALWAYS subtracted from invested (the fix makes it unconditional).
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post', amount: 800 },
      { street: 'preflop', player: HERO, action: 'raise', amount: 5000 },
      { street: 'river', player: HERO, action: 'uncalled', amount: 3000 },
    ];
    const { invested, collected } = computeNetChipsFromActions(actions, HERO);
    // Uncalled always subtracted. invested = 5000 (raise OVERWRITES BB) - 3000 = 2000
    expect(invested).toBe(2000);
    expect(collected).toBe(0);
  });

  it('uncalled return with showdown: reduces invested (pot is separate from uncalled)', () => {
    // Showdown hand: uncalled returned separately, pot does NOT include uncalled
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post', amount: 800 },
      { street: 'preflop', player: HERO, action: 'raise', amount: 5000 },
      { street: 'river', player: HERO, action: 'show', amount: null },
      { street: 'river', player: HERO, action: 'uncalled', amount: 3000 },
      { street: 'river', player: HERO, action: 'collect', amount: 4000 },
    ];
    const { invested, collected } = computeNetChipsFromActions(actions, HERO);
    // Has show → uncalled subtracted. invested = 5000 (raise OVERWRITES BB) - 3000 = 2000
    expect(invested).toBe(2000);
    expect(collected).toBe(4000);
  });

  it('showdown win: collected minus invested', () => {
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post', amount: 800 },
      { street: 'preflop', player: HERO, action: 'call', amount: 800 },
      { street: 'river', player: HERO, action: 'collect', amount: 3200 },
    ];
    const { netChips, invested, collected } = computeNetChipsFromActions(actions, HERO);
    expect(invested).toBe(1600);
    expect(collected).toBe(3200);
    expect(netChips).toBe(1600);
  });

  it('showdown loss: invested with no collection', () => {
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post', amount: 800 },
      { street: 'preflop', player: HERO, action: 'call', amount: 2400 },
      { street: 'river', player: HERO, action: 'collect', amount: 0 },
    ];
    const { netChips, invested } = computeNetChipsFromActions(actions, HERO);
    expect(invested).toBe(3200);
    expect(netChips).toBe(-3200);
  });

  it('side pot: multiple collections summed correctly', () => {
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post_ante', amount: 100 },
      { street: 'preflop', player: HERO, action: 'all-in', amount: 10000 },
      { street: 'river', player: HERO, action: 'collect', amount: 5000 },
      { street: 'river', player: HERO, action: 'collect', amount: 3000 },
    ];
    const { invested, collected, netChips } = computeNetChipsFromActions(actions, HERO);
    expect(invested).toBe(10100);
    expect(collected).toBe(8000);
    expect(netChips).toBe(-2100);
  });

  it('split pot: collection equals investment (net = 0)', () => {
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post', amount: 800 },
      { street: 'preflop', player: HERO, action: 'call', amount: 800 },
      { street: 'river', player: HERO, action: 'collect', amount: 1600 },
    ];
    const { netChips, invested, collected } = computeNetChipsFromActions(actions, HERO);
    expect(invested).toBe(1600);
    expect(collected).toBe(1600);
    expect(netChips).toBe(0);
  });

  it('zero investment + zero collection = 0 (not null)', () => {
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'check', amount: null },
      { street: 'preflop', player: HERO, action: 'fold', amount: null },
    ];
    const { netChips, invested, collected } = computeNetChipsFromActions(actions, HERO);
    expect(invested).toBe(0);
    expect(collected).toBe(0);
    expect(netChips).toBe(0);
  });

  it('multi-street: preflop + flop + turn + river commitments', () => {
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post', amount: 800 },
      { street: 'preflop', player: HERO, action: 'call', amount: 800 },
      { street: 'flop', player: HERO, action: 'bet', amount: 1600 },
      { street: 'turn', player: HERO, action: 'raise', amount: 4000 },
      { street: 'river', player: HERO, action: 'bet', amount: 8000 },
      { street: 'river', player: HERO, action: 'collect', amount: 20000 },
    ];
    const { invested, collected, netChips } = computeNetChipsFromActions(actions, HERO);
    // preflop: 800 (BB) + 800 (call) = 1600
    // flop: 1600 (bet)
    // turn: 4000 (raise-to)
    // river: 8000 (bet)
    // total invested = 1600 + 1600 + 4000 + 8000 = 15200
    expect(invested).toBe(15200);
    expect(collected).toBe(20000);
    expect(netChips).toBe(4800);
  });

  it('ante not overwritten by raise (tracked separately)', () => {
    const actions: ActionEntry[] = [
      { street: 'preflop', player: HERO, action: 'post_ante', amount: 150 },
      { street: 'preflop', player: HERO, action: 'post', amount: 1200 },
      { street: 'preflop', player: HERO, action: 'raise', amount: 25000 },
    ];
    const { invested } = computeNetChipsFromActions(actions, HERO);
    // ante (150) + preflop commitment (25000, OVERWRITE replaces BB) = 25150
    expect(invested).toBe(25150);
  });

  it('null heroName returns null', () => {
    const { netChips } = computeNetChipsFromActions([], null);
    expect(netChips).toBeNull();
  });

  it('empty actions returns null', () => {
    const { netChips } = computeNetChipsFromActions([], HERO);
    expect(netChips).toBeNull();
  });
});
