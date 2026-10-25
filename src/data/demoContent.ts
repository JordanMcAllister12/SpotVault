import type { NormalizedHand } from '@/features/hh-replayer/types';

// ── Shared Tournament Demo Hand ──
// 6-max NLHE tournament: 500/1,000 blinds, 1,000 BB ante.
// Hero (BTN) holds A♠Q♠, BB holds K♥Q♥. Hero wins with nut flush at showdown.
// Used as the default demo in both the standalone HH Replayer and the Workspace.
// Demo data is excluded from all analytics / SVI / BB-100 / EV calculations.

export const DEMO_TOURNAMENT_HAND: NormalizedHand = {
  handId: 'demo-tournament-flush-001',
  site: 'PokerStars',
  gameType: "Hold'em",
  stakes: '500/1,000',
  date: '2025-07-20 19:45:00',
  tableName: 'SpotVault Demo Tournament',
  buttonSeat: 4,
  heroName: 'Hero',
  blindLevel: '500/1,000 + 1,000 BB ante',
  players: [
    { seat: 1, name: 'UTG', stack: 38000, position: 'UTG', isHero: false },
    { seat: 2, name: 'MP', stack: 52000, position: 'MP', isHero: false },
    { seat: 3, name: 'CO', stack: 24500, position: 'CO', isHero: false },
    { seat: 4, name: 'Hero', stack: 41000, position: 'BTN', isHero: true, holeCards: ['As', 'Qs'] },
    { seat: 5, name: 'SB', stack: 18000, position: 'SB', isHero: false },
    { seat: 6, name: 'BB', stack: 33000, position: 'BB', isHero: false, holeCards: ['Kh', 'Qh'], revealMode: 'reveal_at_showdown' },
  ],
  actions: [
    // ── Blinds + BB ante ──
    { index: 0, street: 'preflop', player: 'BB', type: 'post_ante', amount: 1000 },
    { index: 1, street: 'preflop', player: 'SB', type: 'post_sb', amount: 500 },
    { index: 2, street: 'preflop', player: 'BB', type: 'post_bb', amount: 1000 },

    // ── Preflop ──
    { index: 3, street: 'preflop', player: 'UTG', type: 'fold' },
    { index: 4, street: 'preflop', player: 'MP', type: 'fold' },
    { index: 5, street: 'preflop', player: 'CO', type: 'fold' },
    { index: 6, street: 'preflop', player: 'Hero', type: 'raise', amount: 2500 },
    { index: 7, street: 'preflop', player: 'SB', type: 'fold' },
    { index: 8, street: 'preflop', player: 'BB', type: 'call', amount: 1500 },

    // ── Flop: K♠ Q♠ 4♠ ──
    { index: 9, street: 'flop', player: 'BB', type: 'check' },
    { index: 10, street: 'flop', player: 'Hero', type: 'bet', amount: 2200 },
    { index: 11, street: 'flop', player: 'BB', type: 'call', amount: 2200 },

    // ── Turn: 9♠ ──
    { index: 12, street: 'turn', player: 'BB', type: 'check' },
    { index: 13, street: 'turn', player: 'Hero', type: 'bet', amount: 5200 },
    { index: 14, street: 'turn', player: 'BB', type: 'call', amount: 5200 },

    // ── River: 2♣ ──
    { index: 15, street: 'river', player: 'BB', type: 'check' },
    { index: 16, street: 'river', player: 'Hero', type: 'bet', amount: 12500 },
    { index: 17, street: 'river', player: 'BB', type: 'call', amount: 12500 },

    // ── Showdown ──
    { index: 18, street: 'showdown', player: 'BB', type: 'show' },
    { index: 19, street: 'showdown', player: 'Hero', type: 'show' },
  ],
  board: { flop: ['Ks', 'Qs', '4s'], turn: '9s', river: '2c' },
  pot: 41800,
  rake: 0,
  winners: [{ player: 'Hero', amount: 41800 }],
  rawText: '',
  title: 'Demo — A♠Q♠ Nut Flush vs Top Pair',
  heroNetResult: 20900,
};

// ── Demo HH Replayer Hands ──

export const DEMO_REPLAYER_HANDS: NormalizedHand[] = [DEMO_TOURNAMENT_HAND];

// ── Demo Hand Validation ──

function validateDemoHand(hand: NormalizedHand): string[] {
  const errors: string[] = [];
  const usedCards = new Set<string>();
  const allCards = [
    ...hand.players.flatMap(p => p.holeCards ?? []),
    ...hand.board.flop,
    ...(hand.board.turn ? [hand.board.turn] : []),
    ...(hand.board.river ? [hand.board.river] : []),
    ...hand.players.flatMap(p => p.showdownCards ?? []),
  ];
  for (const c of allCards) {
    if (usedCards.has(c)) errors.push(`Duplicate card: ${c} in hand ${hand.handId}`);
    usedCards.add(c);
  }
  for (const p of hand.players) {
    if (p.stack < 0) errors.push(`Negative starting stack: ${p.name} in ${hand.handId}`);
  }
  // Check no player goes negative from explicit-amount actions
  const stacks: Record<string, number> = {};
  for (const p of hand.players) stacks[p.name] = p.stack;
  for (const a of hand.actions) {
    if (['post_sb', 'post_bb', 'post_ante', 'bet', 'allin'].includes(a.type) && a.amount) {
      stacks[a.player] -= a.amount;
      if (stacks[a.player] < -0.01) errors.push(`Negative stack after ${a.type}: ${a.player} = ${stacks[a.player]} in ${hand.handId}`);
    }
    if (a.type === 'raise' && a.amount) {
      const alreadyIn = hand.actions.filter(b => b.player === a.player && b.street === a.street && b.index < a.index && ['post_sb','post_bb','post_ante','bet','call','raise','allin'].includes(b.type))
        .reduce((sum, b) => sum + (b.amount ?? 0), 0);
      const inc = Math.max(0, a.amount - alreadyIn);
      stacks[a.player] -= inc;
      if (stacks[a.player] < -0.01) errors.push(`Negative stack after raise: ${a.player} = ${stacks[a.player]} in ${hand.handId}`);
    }
  }
  return errors;
}

export function validateAllDemoHands(): string[] {
  return DEMO_REPLAYER_HANDS.flatMap(validateDemoHand);
}

export const DEMO_REPLAYER_HAND_LIST = DEMO_REPLAYER_HANDS.map((h, i) => ({
  hand_id: h.handId,
  played_at: h.date,
  blinds: h.stakes,
  position: h.players.find(p => p.isHero)?.position ?? null,
  net_result: h.winners.find(w => w.player === h.heroName)?.amount ?? 0,
  showdown: h.actions.some(a => a.type === 'show'),
  tournament_id: h.tableName,
  title: h.title,
  sortIndex: i,
}));
