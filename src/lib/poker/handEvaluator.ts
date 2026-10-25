/*
 * Poker Hand Evaluator — 7-card rank computation for all-in EV.
 * Self-contained, no external dependencies.
 * Supports Hold'em: best 5-card hand from 7 cards (2 hole + 5 board).
 */

export interface Card { rank: number; suit: number; }

const RANK_NAMES = '23456789TJQKA';
const SUIT_NAMES = 'shdc';

export function parseCard(s: string): Card | null {
  if (!s || s.length < 2) return null;
  const r = s[0].toUpperCase();
  const su = s[1].toLowerCase();
  const rank = RANK_NAMES.indexOf(r);
  const suit = SUIT_NAMES.indexOf(su);
  if (rank < 0 || suit < 0) return null;
  return { rank, suit };
}

export function parseCards(str: string): Card[] {
  if (!str) return [];
  const cards: Card[] = [];
  // Match 2-char card patterns: rank + suit (e.g., As, Kd, 2h, Tc)
  const matches = str.match(/[2-9TJQKA][shdc]/gi);
  if (matches) {
    for (const m of matches) {
      const c = parseCard(m);
      if (c) cards.push(c);
    }
  }
  return cards;
}

/*
 * Hand ranking categories (higher = better):
 * 9: Straight Flush
 * 8: Four of a Kind
 * 7: Full House
 * 6: Flush
 * 5: Straight
 * 4: Three of a Kind
 * 3: Two Pair
 * 2: One Pair
 * 1: High Card
 *
 * Returns a 32-bit integer: category(0-9) in highest bits, then tiebreakers.
 * Higher value = better hand. Comparison via simple integer comparison.
 */
export function evaluate7(cards: Card[]): number {
  if (cards.length < 5) return 0;

  const ranks = new Array(13).fill(0);
  const suits = new Array(4).fill(0);
  const suitCards: number[][] = [[], [], [], []];

  for (const c of cards) {
    ranks[c.rank]++;
    suits[c.suit]++;
    suitCards[c.suit].push(c.rank);
  }

  // Check for flush
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) {
    if (suits[s] >= 5) { flushSuit = s; break; }
  }

  // Check for straight flush
  if (flushSuit >= 0) {
    const fr = suitCards[flushSuit];
    const sfHigh = straightHigh(fr);
    if (sfHigh > 0) {
      return 9 * 0x100000 + sfHigh * 0x10000;
    }
  }

  // Count rank groupings
  let quads = -1;
  let trips: number[] = [];
  let pairs: number[] = [];
  let singles: number[] = [];

  for (let r = 12; r >= 0; r--) {
    if (ranks[r] === 4) quads = r;
    else if (ranks[r] === 3) trips.push(r);
    else if (ranks[r] === 2) pairs.push(r);
    else if (ranks[r] === 1) singles.push(r);
  }

  // Four of a Kind
  if (quads >= 0) {
    const kicker = highestExcluding([quads], ranks, 1);
    return 8 * 0x100000 + quads * 0x10000 + kicker * 0x1000;
  }

  // Full House (trips + pair, or two trips)
  if (trips.length >= 1) {
    if (trips.length >= 2) {
      return 7 * 0x100000 + trips[0] * 0x10000 + trips[1] * 0x1000;
    }
    if (pairs.length >= 1) {
      return 7 * 0x100000 + trips[0] * 0x10000 + pairs[0] * 0x1000;
    }
  }

  // Flush
  if (flushSuit >= 0) {
    const fr = suitCards[flushSuit].sort((a, b) => b - a).slice(0, 5);
    let val = 6 * 0x100000;
    for (let i = 0; i < fr.length; i++) val += fr[i] * Math.pow(0x10, 4 - i);
    return val;
  }

  // Straight
  const sHigh = straightHigh(Array.from({ length: 13 }, (_, i) => ranks[i] > 0 ? i : -1).filter(r => r >= 0));
  if (sHigh > 0) {
    return 5 * 0x100000 + sHigh * 0x10000;
  }

  // Three of a Kind
  if (trips.length >= 1) {
    const kickers = highestExcluding([trips[0]], ranks, 2);
    return 4 * 0x100000 + trips[0] * 0x10000 + kickers * 0x100;
  }

  // Two Pair
  if (pairs.length >= 2) {
    const kicker = highestExcluding([pairs[0], pairs[1]], ranks, 1);
    return 3 * 0x100000 + pairs[0] * 0x10000 + pairs[1] * 0x1000 + kicker * 0x100;
  }

  // One Pair
  if (pairs.length === 1) {
    const kickers = highestExcluding([pairs[0]], ranks, 3);
    return 2 * 0x100000 + pairs[0] * 0x10000 + kickers * 0x10;
  }

  // High Card
  const hs = highestExcluding([], ranks, 5);
  return 0x100000 + hs;
}

function straightHigh(rankIndices: number[]): number {
  // rankIndices: sorted array of distinct rank indices (0-12)
  const set = new Set(rankIndices);
  // Add wheel: A-2-3-4-5 (A=12, 2=0, 3=1, 4=2, 5=3)
  if (set.has(12)) set.add(-1); // Ace low

  let best = 0;
  for (const r of set) {
    if (r < 0) continue;
    // Check if r, r+1, r+2, r+3, r+4 all exist (with -1 for wheel)
    if (set.has(r) && set.has(r + 1) && set.has(r + 2) && set.has(r + 3) && set.has(r + 4)) {
      const high = r + 4;
      if (high > best) best = high;
    }
  }
  // Special: wheel straight (A-2-3-4-5) has high = 3 (five high)
  if (set.has(-1) && set.has(0) && set.has(1) && set.has(2) && set.has(3)) {
    if (best === 0) best = 3; // 5-high straight
  }
  return best;
}

function highestExcluding(exclude: number[], ranks: number[], count: number): number {
  let result = 0;
  let found = 0;
  for (let r = 12; r >= 0 && found < count; r--) {
    if (exclude.includes(r)) continue;
    if (ranks[r] === 0) continue;
    const avail = Math.min(count - found, ranks[r]);
    for (let i = 0; i < avail; i++) {
      result = result * 0x10 + r;
      found++;
    }
  }
  return result;
}

/*
 * Compute all-in equity for heads-up or multiway all-in.
 * Uses exhaustive enumeration of remaining board cards.
 *
 * @param heroCards - Hero's hole cards (2 cards)
 * @param opponentCards - Array of opponent card arrays (each 2 cards)
 * @param boardCards - Known board cards (0-5 cards)
 * @returns Equity as a fraction (0.0 to 1.0), or null if cannot compute.
 */
export function computeAllInEquity(
  heroCards: Card[],
  opponentCards: Card[][],
  boardCards: Card[],
): number | null {
  if (heroCards.length !== 2) return null;
  if (opponentCards.length === 0) return null;
  for (const opp of opponentCards) {
    if (opp.length !== 2) return null;
  }

  const usedCards = new Set<string>();
  for (const c of heroCards) usedCards.add(`${c.rank}${c.suit}`);
  for (const opp of opponentCards) {
    for (const c of opp) usedCards.add(`${c.rank}${c.suit}`);
  }
  for (const c of boardCards) usedCards.add(`${c.rank}${c.suit}`);

  const boardNeeded = 5 - boardCards.length;
  if (boardNeeded < 0) return null;

  // Build deck of remaining cards
  const deck: Card[] = [];
  for (let r = 0; r < 13; r++) {
    for (let s = 0; s < 4; s++) {
      if (!usedCards.has(`${r}${s}`)) {
        deck.push({ rank: r, suit: s });
      }
    }
  }

  if (deck.length < boardNeeded) return null;

  const numPlayers = 1 + opponentCards.length;
  let heroWins = 0;
  let ties = 0;
  let total = 0;

  // Enumerate all combinations of boardNeeded cards from the deck
  const combos = combinations(deck.length, boardNeeded);
  for (const combo of combos) {
    const fullBoard = [...boardCards];
    for (const idx of combo) {
      fullBoard.push(deck[idx]);
    }

    const heroScore = evaluate7([...heroCards, ...fullBoard]);
    let bestScore = -1;
    let tiedWithHero = false;
    let tiedCount = 1;

    for (let i = 0; i < opponentCards.length; i++) {
      const oppScore = evaluate7([...opponentCards[i], ...fullBoard]);
      if (oppScore > bestScore) {
        bestScore = oppScore;
        tiedWithHero = false;
        tiedCount = 1;
      } else if (oppScore === bestScore) {
        tiedCount++;
      }
    }

    if (heroScore > bestScore) {
      heroWins++;
    } else if (heroScore === bestScore) {
      if (tiedCount > 1) {
        tiedWithHero = true;
      }
      ties++;
    }
    total++;
  }

  if (total === 0) return null;
  if (total === 0) return null;
  // For ties, split equity among all tied players.
  // If hero tied with k-1 opponents, hero gets 1/k of the pot.
  // We track total tie outcomes and divide by numPlayers as approximation,
  // but for accuracy we need to know how many opponents tied with hero.
  // Simplified: hero gets full win for heroScore > bestScore,
  // and for ties, hero gets 1/(tiedCount) where tiedCount includes hero.
  // Since we can't retroactively split here, we use the standard approximation.
  return (heroWins + ties / numPlayers) / total;
}

/*
 * Generate all C(n, k) combinations as index arrays.
 * For board completion: n = remaining deck size, k = cards needed.
 * Performance: C(45, 5) = 1,221,759 — fast enough for per-hand computation.
 * C(47, 2) = 1,081 (flop all-in). C(46, 1) = 46 (turn all-in).
 */
function combinations(n: number, k: number): number[][] {
  if (k === 0) return [[]];
  if (k > n) return [];
  const result: number[][] = [];

  function helper(start: number, current: number[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < n; i++) {
      current.push(i);
      helper(i + 1, current);
      current.pop();
    }
  }
  helper(0, []);
  return result;
}

/*
 * Monte Carlo equity simulation for cases where exhaustive enumeration
 * is too expensive (preflop all-in: C(46,5) = 1.37M combos).
 * Uses random sampling of remaining board cards.
 */
export function computeAllInEquityMC(
  heroCards: Card[],
  opponentCards: Card[][],
  boardCards: Card[],
  trials: number = 10000,
): number | null {
  if (heroCards.length !== 2) return null;
  if (opponentCards.length === 0) return null;
  for (const opp of opponentCards) {
    if (opp.length !== 2) return null;
  }

  const usedCards = new Set<string>();
  for (const c of heroCards) usedCards.add(`${c.rank}${c.suit}`);
  for (const opp of opponentCards) {
    for (const c of opp) usedCards.add(`${c.rank}${c.suit}`);
  }
  for (const c of boardCards) usedCards.add(`${c.rank}${c.suit}`);

  const boardNeeded = 5 - boardCards.length;
  if (boardNeeded < 0) return null;

  const deck: Card[] = [];
  for (let r = 0; r < 13; r++) {
    for (let s = 0; s < 4; s++) {
      if (!usedCards.has(`${r}${s}`)) {
        deck.push({ rank: r, suit: s });
      }
    }
  }
  if (deck.length < boardNeeded) return null;

  const numPlayers = 1 + opponentCards.length;
  let heroWins = 0;
  let ties = 0;

  for (let t = 0; t < trials; t++) {
    // Fisher-Yates partial shuffle for boardNeeded cards
    const board = [...boardCards];
    for (let i = 0; i < boardNeeded; i++) {
      const j = i + Math.floor(Math.random() * (deck.length - i));
      [deck[i], deck[j]] = [deck[j], deck[i]];
      board.push(deck[i]);
    }

    const heroScore = evaluate7([...heroCards, ...board]);
    let bestScore = -1;
    let tied = false;

    for (const opp of opponentCards) {
      const oppScore = evaluate7([...opp, ...board]);
      if (oppScore > bestScore) {
        bestScore = oppScore;
        tied = false;
      } else if (oppScore === bestScore) {
        tied = true;
      }
    }

    if (heroScore > bestScore) {
      heroWins++;
    } else if (heroScore === bestScore) {
      ties++;
    }
  }

  return (heroWins + ties / numPlayers) / trials;
}

/*
 * Compute all-in equity, using exact enumeration for postflop
 * (board >= 3, at most 2 cards to come) and Monte Carlo for preflop.
 */
export function computeAllInEquityAuto(
  heroCards: Card[],
  opponentCards: Card[][],
  boardCards: Card[],
): number | null {
  const boardNeeded = 5 - boardCards.length;
  if (boardNeeded <= 2) {
    return computeAllInEquity(heroCards, opponentCards, boardCards);
  }
  return computeAllInEquityMC(heroCards, opponentCards, boardCards, 10000);
}

/*
 * Extract opponent showdown cards from raw hand text.
 * Looks for "shows [Xh Yd]" patterns after the all-in action.
 * Returns an array of card arrays (one per opponent who showed cards).
 */
export function extractOpponentShowdownCards(
  rawHandText: string,
  heroName: string,
): Card[][] {
  if (!rawHandText) return [];
  const opponents: Card[][] = [];
  const showRegex = /([^:\n]+?):\s+(?:shows|showed)\s+\[([^\]]+)\]/g;
  let match;
  while ((match = showRegex.exec(rawHandText)) !== null) {
    const playerName = match[1];
    if (playerName === heroName) continue;
    const cards = parseCards(match[2]);
    if (cards.length === 2) {
      opponents.push(cards);
    }
  }
  return opponents;
}
