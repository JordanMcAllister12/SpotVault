import type { NormalizedHand, NormalizedPlayer, NormalizedAction, NormalizedBoard, NormalizedWinner, Street, ActionType } from './types';

export interface Phase2HandRecord {
  hand_id: string;
  site: string | null;
  game_mode: string | null;
  tournament_id: string | null;
  played_at: string | null;
  blinds: string | null;
  position: string | null;
  hero_name: string | null;
  hero_cards: string | null;
  board: string | null;
  action_sequence: Array<{ action: string; amount: number | null; player: string; street: string }> | null;
  pot_amount: number | string | null;
  net_result: number | string | null;
  showdown: boolean | null;
  raw_hand_text?: string | null;
}

function mapActionType(raw: string): ActionType {
  const lower = raw.toLowerCase().replace(/[-_\s]/g, '');
  if (lower === 'fold') return 'fold';
  if (lower === 'check') return 'check';
  if (lower === 'call') return 'call';
  if (lower === 'bet') return 'bet';
  if (lower === 'raise') return 'raise';
  if (lower === 'allin' || lower === 'all-in') return 'allin';
  if (lower === 'postsb' || lower === 'sb') return 'post_sb';
  if (lower === 'postbb' || lower === 'bb') return 'post_bb';
  if (lower === 'postante' || lower === 'ante') return 'post_ante';
  if (lower === 'post') return 'post_sb'; // "post" in DB is SB or BB — resolved in adapter
  if (lower === 'uncalled') return 'uncalled_return';
  if (lower === 'collect') return 'collect';
  if (lower === 'show') return 'show';
  if (lower === 'muck') return 'muck';
  if (lower === 'win') return 'win';
  return 'check';
}

function mapStreet(raw: string): Street {
  const lower = raw.toLowerCase();
  if (lower === 'preflop' || lower === 'pre-flop' || lower === 'pre') return 'preflop';
  if (lower === 'flop') return 'flop';
  if (lower === 'turn') return 'turn';
  if (lower === 'river') return 'river';
  if (lower === 'showdown') return 'showdown';
  return 'preflop';
}

// ── Raw hand text parsing ──

const CARD_RE = /[2-9TJQKA][hdcs]/g;

function parseStartingStacks(rawText: string): Map<string, number> {
  const stacks = new Map<string, number>();
  const seatRe = /Seat\s+\d+:\s+(.+?)\s+\(([\d,]+)\s+in\s+chips\)/g;
  let m: RegExpExecArray | null;
  while ((m = seatRe.exec(rawText)) !== null) {
    const name = m[1].trim();
    const stack = parseInt(m[2].replace(/,/g, ''), 10);
    if (name && !isNaN(stack)) stacks.set(name, stack);
  }
  return stacks;
}

function parseSeatAssignmentsFromRaw(rawText: string): Map<string, number> {
  const seatMap = new Map<string, number>();
  const seatRe = /Seat\s+(\d+):\s+(.+?)\s+\(([\d,]+)\s+in\s+chips\)/g;
  let m: RegExpExecArray | null;
  while ((m = seatRe.exec(rawText)) !== null) {
    const seatNum = parseInt(m[1], 10);
    const name = m[2].trim();
    if (name && !isNaN(seatNum)) seatMap.set(name, seatNum);
  }
  return seatMap;
}

function parseBoardFromRaw(rawText: string): NormalizedBoard {
  const board: NormalizedBoard = { flop: [], turn: null, river: null };

  // *** FLOP *** [5c Qh 2d]
  const flopMatch = rawText.match(/\*\*\*\s+FLOP\s+\*\*\*\s+\[([^\]]+)\]/);
  if (flopMatch) {
    const cards = flopMatch[1].trim().match(CARD_RE);
    if (cards) board.flop = cards;
  }

  // *** TURN *** [5c Qh 2d] [7c]
  const turnMatch = rawText.match(/\*\*\*\s+TURN\s+\*\*\*\s+\[([^\]]+)\]\s*\[([^\]]+)\]/);
  if (turnMatch) {
    const turnCards = turnMatch[2].trim().match(CARD_RE);
    if (turnCards && turnCards.length > 0) board.turn = turnCards[0];
  }

  // *** RIVER *** [5c Qh 2d 7c] [Qs]
  const riverMatch = rawText.match(/\*\*\*\s+RIVER\s+\*\*\*\s+\[([^\]]+)\]\s*\[([^\]]+)\]/);
  if (riverMatch) {
    const riverCards = riverMatch[2].trim().match(CARD_RE);
    if (riverCards && riverCards.length > 0) board.river = riverCards[0];
  }

  return board;
}

function parseHeroCardsFromRaw(rawText: string, heroName: string): string[] | undefined {
  const re = new RegExp(`Dealt to ${escapeRegex(heroName)} \\[([^\\]]+)\\]`);
  const m = rawText.match(re);
  if (m) {
    const cards = m[1].trim().match(CARD_RE);
    if (cards && cards.length >= 2) return cards;
  }
  return undefined;
}

function parseButtonSeatFromRaw(rawText: string, players: NormalizedPlayer[]): number {
  const m = rawText.match(/Seat\s+#(\d+)\s+is\s+the\s+button/);
  if (m) {
    const seatNum = parseInt(m[1], 10);
    const player = players.find(p => p.seat === seatNum);
    if (player) return seatNum;
  }
  return 0;
}

/**
 * Derive all poker positions from the button seat and clockwise seat order.
 * Players are sorted by seat number, then starting from the button+1 (SB),
 * positions are assigned clockwise: SB, BB, UTG, UTG+1, ..., CO, BTN.
 */
function derivePositions(players: NormalizedPlayer[], buttonSeat: number): void {
  // Sort players by seat number to get clockwise physical order
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const n = sorted.length;
  if (n < 2) return;

  // Find the button player's index in the sorted array
  const btnIdx = sorted.findIndex(p => p.seat === buttonSeat);
  if (btnIdx < 0) return;

  // Build clockwise order starting from the player after the button (SB position)
  // Index 0 = SB, 1 = BB, 2 = UTG (first to act preflop), ..., n-1 = BTN
  const clockwise: NormalizedPlayer[] = [];
  for (let i = 1; i <= n; i++) {
    clockwise.push(sorted[(btnIdx + i) % n]);
  }

  // Position labels for n players (clockwise from SB)
  // 2 players: SB=BTN, BB  (heads-up: dealer is SB)
  // 3 players: SB, BB, BTN
  // 4 players: SB, BB, UTG, BTN
  // 5 players: SB, BB, UTG, CO, BTN
  // 6 players: SB, BB, UTG, HJ, CO, BTN
  // 7 players: SB, BB, UTG, UTG+1, HJ, CO, BTN
  // 8 players: SB, BB, UTG, UTG+1, LJ, HJ, CO, BTN
  const POS_LABELS: Record<number, string[]> = {
    2: ['SB', 'BB'],
    3: ['SB', 'BB', 'BTN'],
    4: ['SB', 'BB', 'UTG', 'BTN'],
    5: ['SB', 'BB', 'UTG', 'CO', 'BTN'],
    6: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
    7: ['SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO', 'BTN'],
    8: ['SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN'],
    9: ['SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'BTN'], // 9-max fallback
  };

  const labels = POS_LABELS[n] ?? POS_LABELS[8];
  for (let i = 0; i < clockwise.length && i < labels.length; i++) {
    const player = clockwise[i];
    // Don't override BTN/SB/BB already parsed from summary — but do fill in missing ones
    if (!player.position || player.position === '') {
      player.position = labels[i];
    }
  }

  // Heads-up: button is also SB
  if (n === 2) {
    const btn = sorted[btnIdx];
    if (btn) btn.position = 'BTN';
  }
}

function parsePositionsFromRaw(rawText: string, players: NormalizedPlayer[]): void {
  const summaryRe = /Seat\s+\d+:\s+(\S+)\s+\((button|small blind|big blind)\)/g;
  let m: RegExpExecArray | null;
  while ((m = summaryRe.exec(rawText)) !== null) {
    const name = m[1].trim();
    const role = m[2].trim().toLowerCase();
    const player = players.find(p => p.name === name);
    if (player) {
      if (role === 'button') player.position = 'BTN';
      else if (role === 'small blind') player.position = player.position || 'SB';
      else if (role === 'big blind') player.position = player.position || 'BB';
    }
  }
}

function parseBlindPostsFromRaw(rawText: string): { player: string; type: ActionType; amount: number }[] {
  const posts: { player: string; type: ActionType; amount: number }[] = [];
  const re = /^(.+?):\s+posts (?:the )?(ante|small blind|big blind|sb|bb)\s+([\d,]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawText)) !== null) {
    const player = m[1].trim();
    const role = m[2].trim().toLowerCase();
    const amount = parseInt(m[3].replace(/,/g, ''), 10);
    if (!isNaN(amount) && player) {
      let actionType: ActionType;
      if (role === 'ante') actionType = 'post_ante';
      else if (role === 'small blind' || role === 'sb') actionType = 'post_sb';
      else if (role === 'big blind' || role === 'bb') actionType = 'post_bb';
      else continue;
      posts.push({ player, type: actionType, amount });
    }
  }
  return posts;
}

function parseUncalledReturns(rawText: string): { player: string; amount: number }[] {
  const returns: { player: string; amount: number }[] = [];
  const re = /Uncalled bet\s+\(([\d,]+)\)\s+returned to\s+(.+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawText)) !== null) {
    const amount = parseInt(m[1].replace(/,/g, ''), 10);
    const player = m[2].trim();
    if (!isNaN(amount) && player) returns.push({ player, amount });
  }
  return returns;
}

function parseCollectedFromRaw(rawText: string): { player: string; amount: number }[] {
  const collections: { player: string; amount: number }[] = [];
  const re = /(.+?)\s+collected\s+([\d,]+)\s+from\s+pot/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawText)) !== null) {
    const player = m[1].trim();
    const amount = parseInt(m[2].replace(/,/g, ''), 10);
    if (!isNaN(amount) && player) collections.push({ player, amount });
  }
  return collections;
}

function parseShowdownCardsFromRaw(rawText: string): { player: string; cards: string[]; action: 'show' | 'muck' }[] {
  const results: { player: string; cards: string[]; action: 'show' | 'muck' }[] = [];
  // Match "Player: shows [As Kd]" or "Player: showed [As Kd]"
  const showRe = /^(.+?):\s+(?:shows|showed)\s+\[([^\]]+)\]/gm;
  let m: RegExpExecArray | null;
  while ((m = showRe.exec(rawText)) !== null) {
    const player = m[1].trim();
    const cards = m[2].trim().match(CARD_RE);
    if (player && cards && cards.length >= 2) results.push({ player, cards, action: 'show' });
  }
  // Match "Player: mucks [As Kd]" or "Player: mucks" (cards optional)
  const muckRe = /^(.+?):\s+mucks(?:\s+\[([^\]]+)\])?/gm;
  while ((m = muckRe.exec(rawText)) !== null) {
    const player = m[1].trim();
    const cardStr = m[2];
    const cards = cardStr ? cardStr.trim().match(CARD_RE) : null;
    if (player) results.push({ player, cards: cards ?? [], action: 'muck' });
  }
  return results;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


// ── Parse player actions from raw hand text ──
// Matches lines like: "PlayerName: folds", "PlayerName: calls 200", "PlayerName: bets 500", "PlayerName: raises 200 to 500"

function parseActionsFromRaw(rawText: string): { player: string; street: Street; type: ActionType; amount: number | null }[] {
  const actions: { player: string; street: Street; type: ActionType; amount: number | null }[] = [];
  let currentStreet: Street = 'preflop';

  const lines = rawText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Street markers
    if (/\*\*\*\s+FLOP\s+\*\*\*/.test(trimmed)) { currentStreet = 'flop'; continue; }
    if (/\*\*\*\s+TURN\s+\*\*\*/.test(trimmed)) { currentStreet = 'turn'; continue; }
    if (/\*\*\*\s+RIVER\s+\*\*\*/.test(trimmed)) { currentStreet = 'river'; continue; }
    if (/\*\*\*\s+SHOW\s+DOWN\s+\*\*\*/.test(trimmed) || /\*\*\*\s+SHOWDOWN\s+\*\*\*/.test(trimmed)) { currentStreet = 'showdown'; continue; }

    // Skip non-action lines
    if (!trimmed || trimmed.startsWith('***') || trimmed.startsWith('Seat') || trimmed.startsWith('Table') ||
        trimmed.startsWith('Game') || trimmed.startsWith('PokerStars') || trimmed.startsWith('Hand') ||
        trimmed.startsWith('Tournament') || trimmed.startsWith('Level') || trimmed.includes('is the button') ||
        trimmed.includes('in chips)') || trimmed.includes('posts')) continue;

    // Player actions: "PlayerName: folds", "PlayerName: calls 200", "PlayerName: bets 500",
    // "PlayerName: raises 200 to 500", "PlayerName: calls 200 and is all-in", etc.
    const actionMatch = trimmed.match(/^(.+?):\s+(folds|checks|calls|bets|raises|is all-in|has timed out|is sitting out|stands pat)(.*)$/i);
    if (actionMatch) {
      const player = actionMatch[1].trim();
      const verb = actionMatch[2].toLowerCase().trim();
      const rest = (actionMatch[3] ?? '').toLowerCase().trim();

      // Detect "and is all-in" suffix to mark the action as allin while preserving the amount
      const isAllIn = /and\s+is\s+all[- ]?in/.test(trimmed.toLowerCase());

      let type: ActionType;
      let amount: number | null = null;

      if (verb === 'folds') { type = 'fold'; }
      else if (verb === 'checks') { type = 'check'; }
      else if (verb === 'calls') { type = isAllIn ? 'allin' : 'call'; const nums = rest.match(/[\d,]+/g); if (nums && nums.length >= 1) amount = parseInt(nums[0].replace(/,/g, ''), 10) || null; }
      else if (verb === 'bets') { type = isAllIn ? 'allin' : 'bet'; const nums = rest.match(/[\d,]+/g); if (nums && nums.length >= 1) amount = parseInt(nums[0].replace(/,/g, ''), 10) || null; }
      else if (verb === 'raises') { type = isAllIn ? 'allin' : 'raise'; const nums = rest.match(/[\d,]+/g); if (nums && nums.length >= 2) amount = parseInt(nums[1].replace(/,/g, ''), 10) || null; else if (nums && nums.length >= 1) amount = parseInt(nums[0].replace(/,/g, ''), 10) || null; }
      else if (verb === 'is all-in') { type = 'allin'; }
      else continue;

      if (player && !player.startsWith('Dealt to')) {
        actions.push({ player, street: currentStreet, type, amount });
      }
    }
  }

  return actions;
}

// ── Board parsing from DB column (fallback) ──

function parseBoardFromColumn(boardStr: string | null): NormalizedBoard {
  if (!boardStr) return { flop: [], turn: null, river: null };
  const cards = boardStr.trim().split(/\s+/).filter(Boolean);
  if (cards.length <= 3) {
    return { flop: cards.slice(0, 3), turn: null, river: null };
  }
  if (cards.length === 4) {
    return { flop: cards.slice(0, 3), turn: cards[3] ?? null, river: null };
  }
  // 5+ cards: flop (0-2), turn (3), river (4); ignore any extras
  return { flop: cards.slice(0, 3), turn: cards[3] ?? null, river: cards[4] ?? null };
}

function parseHeroCards(cardsStr: string | null): string[] | undefined {
  if (!cardsStr) return undefined;
  const cards = cardsStr.trim().split(/\s+/).filter(Boolean);
  return cards.length >= 2 ? cards : undefined;
}

function inferWinners(hand: Phase2HandRecord, playerNames: string[]): NormalizedWinner[] {
  const netResult = hand.net_result != null ? Number(hand.net_result) : null;
  const heroName = hand.hero_name ?? 'Hero';
  if (netResult !== null && netResult > 0) {
    return [{ player: heroName, amount: netResult }];
  }
  // Hero lost or broke even — still need a winner so the replay shows a pot award.
  // Infer the pot amount and attribute it to the first non-hero player.
  const potAmount = hand.pot_amount != null ? Number(hand.pot_amount) : null;
  if (potAmount !== null && potAmount > 0) {
    const opponent = playerNames.find(n => n !== heroName);
    if (opponent) return [{ player: opponent, amount: potAmount }];
  }
  return [];
}

export function parseRawHandText(rawText: string): NormalizedHand {
  const handIdMatch = rawText.match(/(?:Poker\s+)?Hand #([A-Za-z0-9]+):/);
  const handId = handIdMatch ? handIdMatch[1] : `raw-${Date.now()}`;
  const siteMatch = rawText.match(/^(PokerStars|GGPoker|888poker|Winamax\.fr|PartyPoker)/im);
  const site = siteMatch ? siteMatch[1] : 'unknown';
  const isTournament = /Tournament #?/i.test(rawText);
  const blindsMatch = rawText.match(/\(([\d,]+)\/([\d,]+)\)/);
  const blinds = blindsMatch ? `${blindsMatch[1]}/${blindsMatch[2]}` : '';
  const dateMatch = rawText.match(/\[(\d{4}\/\d{2}\/\d{2}[\s\d:]+)\]/);
  const date = dateMatch ? dateMatch[1].trim() : '';
  const tournIdMatch = rawText.match(/Tournament #?(\d+)/i);
  const tableName = tournIdMatch ? tournIdMatch[1] : '';

  const seatMap = parseSeatAssignmentsFromRaw(rawText);
  const stackMap = parseStartingStacks(rawText);
  const playerNames = [...seatMap.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);

  let heroName = 'Hero';
  const dealtMatch = rawText.match(/Dealt to (.+?) \[/);
  if (dealtMatch) heroName = dealtMatch[1].trim();
  if (!playerNames.includes(heroName) && playerNames.length > 0) {
    // hero is among seats
  }

  const players: NormalizedPlayer[] = (playerNames.length > 0 ? playerNames : [heroName]).map((name, i) => ({
    seat: seatMap.get(name) ?? (i + 1),
    name,
    stack: stackMap.get(name) ?? 0,
    isHero: name === heroName,
  }));

  const hero = players.find(p => p.isHero);
  if (hero) {
    const heroCards = parseHeroCardsFromRaw(rawText, heroName);
    if (heroCards) hero.holeCards = heroCards;
  }

  parsePositionsFromRaw(rawText, players);
  let buttonSeat = parseButtonSeatFromRaw(rawText, players);
  if (buttonSeat > 0 && players.length >= 2) derivePositions(players, buttonSeat);

  if (rawText) {
    const showdownData = parseShowdownCardsFromRaw(rawText);
    for (const sd of showdownData) {
      const player = players.find(p => p.name === sd.player);
      if (player) {
        player.showdownCards = sd.cards.length >= 2 ? sd.cards : undefined;
        player.showdownAction = sd.action;
      }
    }
  }

  const blindPosts = parseBlindPostsFromRaw(rawText);
  const rawActions = parseActionsFromRaw(rawText);

  const normalizedActions: NormalizedAction[] = [];
  for (const bp of blindPosts) {
    normalizedActions.push({
      index: normalizedActions.length,
      street: 'preflop',
      player: bp.player,
      type: bp.type,
      amount: bp.amount,
    });
  }
  for (const a of rawActions) {
    normalizedActions.push({
      index: normalizedActions.length,
      street: a.street,
      player: a.player,
      type: a.type,
      amount: a.amount ?? undefined,
    });
  }

  const board = parseBoardFromRaw(rawText);
  const collections = parseCollectedFromRaw(rawText);
  const returns = parseUncalledReturns(rawText);
  for (const r of returns) {
    normalizedActions.push({
      index: normalizedActions.length,
      street: 'showdown',
      player: r.player,
      type: 'uncalled_return',
      amount: r.amount,
    });
  }

  let pot = 0;
  const potMatch = rawText.match(/Total pot ([\d,]+)/);
  if (potMatch) pot = parseInt(potMatch[1].replace(/,/g, ''), 10);
  else if (collections.length > 0) pot = collections.reduce((sum, c) => sum + c.amount, 0);

  const winners = collections.length > 0
    ? collections.map(c => ({ player: c.player, amount: c.amount }))
    : [];

  return {
    handId,
    site,
    gameType: isTournament ? "Hold'em Tournament" : "Hold'em",
    stakes: blinds,
    date,
    tableName,
    buttonSeat,
    heroName,
    players,
    actions: normalizedActions,
    board,
    pot,
    rake: 0,
    winners,
    rawText,
    title: handId,
    heroNetResult: computeHeroNetResult(winners, heroName),
  };
}

export function phase2HandToNormalized(hand: Phase2HandRecord): NormalizedHand {
  const heroName = hand.hero_name ?? 'Hero';
  const actions = hand.action_sequence ?? [];
  const rawText = hand.raw_hand_text ?? '';

  // Parse real seat assignments from raw text (Seat N: playername (stack in chips))
  const rawSeatMap = rawText ? parseSeatAssignmentsFromRaw(rawText) : new Map<string, number>();
  const rawStacks = rawText ? parseStartingStacks(rawText) : new Map<string, number>();

  // Build player list: prefer raw text seat order, fall back to action_sequence order
  let playerNames: string[];
  if (rawSeatMap.size > 0) {
    // Use real seat numbers from raw text, sorted by seat number
    playerNames = [...rawSeatMap.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
  } else {
    // Fall back to action_sequence first-appearance order
    const playerSet = new Set<string>();
    for (const a of actions) playerSet.add(a.player);
    playerNames = [...playerSet];
  }

  // Ensure hero is in the player list
  if (!playerNames.includes(heroName)) playerNames.unshift(heroName);

  // Assign seats using real seat numbers from raw text, or sequential fallback
  const players: NormalizedPlayer[] = playerNames.map((name) => ({
    seat: rawSeatMap.get(name) ?? (playerNames.indexOf(name) + 1),
    name,
    stack: rawStacks.get(name) ?? 0,
    position: name === heroName ? (hand.position ?? undefined) : undefined,
    isHero: name === heroName,
    holeCards: name === heroName ? parseHeroCards(hand.hero_cards) : undefined,
  }));

  // Parse positions from raw text summary
  if (rawText) {
    parsePositionsFromRaw(rawText, players);
    // Override hero position from DB if available
    if (hand.position) {
      const hero = players.find(p => p.isHero);
      if (hero) hero.position = hand.position;
    }
  }

  // Parse button seat
  let buttonSeat = 0;
  if (rawText) {
    buttonSeat = parseButtonSeatFromRaw(rawText, players);
  }
  if (buttonSeat === 0 && hand.position?.toUpperCase() === 'BTN') {
    buttonSeat = players.find(p => p.isHero)?.seat ?? 0;
  }

  // Derive all positions from button seat + clockwise seat order
  if (buttonSeat > 0 && players.length >= 2) {
    derivePositions(players, buttonSeat);
  }

  // Parse hero cards from raw text if DB column is missing
  if (rawText) {
    const hero = players.find(p => p.isHero);
    if (hero && (!hero.holeCards || hero.holeCards.length < 2)) {
      const rawCards = parseHeroCardsFromRaw(rawText, heroName);
      if (rawCards) hero.holeCards = rawCards;
    }
  }

  // Parse showdown cards from raw text and attach to players
  if (rawText) {
    const showdownData = parseShowdownCardsFromRaw(rawText);
    for (const sd of showdownData) {
      const player = players.find(p => p.name === sd.player);
      if (player) {
        player.showdownCards = sd.cards.length >= 2 ? sd.cards : undefined;
        player.showdownAction = sd.action;
      }
    }
  }

  // Parse blind/ante posts from raw text and prepend to actions
  const blindPosts = rawText ? parseBlindPostsFromRaw(rawText) : [];

  // Check if the action_sequence already includes blind posts (including generic "post")
  const hasBlindPostsInSeq = actions.some(a => {
    const lower = a.action.toLowerCase().replace(/[-_\s]/g, '');
    return ['postsb', 'sb', 'postbb', 'bb', 'postante', 'ante', 'post'].includes(lower);
  });

  // Build a map of player -> blind type from raw text for resolving generic "post" actions
  const rawBlindMap = new Map<string, ActionType>();
  if (rawText) {
    const rawPosts = parseBlindPostsFromRaw(rawText);
    for (const bp of rawPosts) {
      rawBlindMap.set(bp.player, bp.type);
    }
  }

  const normalizedActions: NormalizedAction[] = [];

  // Prepend blind/ante posts if not already in action_sequence
  if (blindPosts.length > 0 && !hasBlindPostsInSeq) {
    for (const bp of blindPosts) {
      normalizedActions.push({
        index: normalizedActions.length,
        street: 'preflop',
        player: bp.player,
        type: bp.type,
        amount: bp.amount,
      });
    }
  }

  // Map DB actions with sequential indices.
  // If action_sequence is empty, fall back to parsing actions from raw hand text.
  const dbActions = actions.length > 0 ? actions : (rawText ? parseActionsFromRaw(rawText).map(a => ({
    action: a.type === 'fold' ? 'fold' : a.type === 'check' ? 'check' : a.type === 'call' ? 'call' :
    a.type === 'bet' ? 'bet' : a.type === 'raise' ? 'raise' : a.type === 'allin' ? 'allin' : 'check',
    amount: a.amount,
    player: a.player,
    street: a.street,
  })) : []);

  for (const a of dbActions) {
    let actionType = mapActionType(a.action);
    // Resolve generic "post" to SB or BB using raw text
    if (a.action.toLowerCase() === 'post' && rawBlindMap.has(a.player)) {
      actionType = rawBlindMap.get(a.player)!;
    }
    normalizedActions.push({
      index: normalizedActions.length,
      street: mapStreet(a.street),
      player: a.player,
      type: actionType,
      amount: a.amount != null ? Number(a.amount) : undefined,
    });
  }

  // Add uncalled return events from raw text only if not already in action_sequence
  const hasUncalledInSeq = actions.some(a => a.action.toLowerCase().replace(/[-_\s]/g, '') === 'uncalled');
  if (rawText && !hasUncalledInSeq) {
    const returns = parseUncalledReturns(rawText);
    for (const r of returns) {
      normalizedActions.push({
        index: normalizedActions.length,
        street: 'showdown',
        player: r.player,
        type: 'uncalled_return',
        amount: r.amount,
      });
    }
  }

  // Parse board: prefer raw text, fall back to DB column
  let board: NormalizedBoard;
  if (rawText) {
    board = parseBoardFromRaw(rawText);
    // If raw text didn't yield flop cards, fall back to DB column
    if (board.flop.length === 0 && hand.board) {
      board = parseBoardFromColumn(hand.board);
    }
  } else {
    board = parseBoardFromColumn(hand.board);
  }

  const pot = hand.pot_amount != null ? Number(hand.pot_amount) : 0;

  // Parse winners from raw text "collected from pot" lines, fall back to net_result
  // Only use raw text collections if not already in action_sequence
  const hasCollectInSeq = actions.some(a => a.action.toLowerCase() === 'collect' || a.action.toLowerCase() === 'win');
  let winners: NormalizedWinner[];
  if (rawText && !hasCollectInSeq) {
    const collections = parseCollectedFromRaw(rawText);
    if (collections.length > 0) {
      winners = collections.map(c => ({ player: c.player, amount: c.amount }));
    } else {
      winners = inferWinners(hand, playerNames);
    }
  } else {
    winners = inferWinners(hand, playerNames);
  }

  return {
    handId: hand.hand_id ?? '',
    site: hand.site ?? 'unknown',
    gameType: hand.game_mode === 'mtt' ? "Hold'em Tournament" : "Hold'em",
    stakes: hand.blinds ?? '',
    date: hand.played_at ?? '',
    tableName: hand.tournament_id ?? '',
    buttonSeat,
    heroName,
    players,
    actions: normalizedActions,
    board,
    pot,
    rake: 0,
    winners,
    rawText,
    title: hand.hand_id ?? '',
    heroNetResult: hand.net_result != null ? Number(hand.net_result) : computeHeroNetResult(winners, heroName),
  };
}

function computeHeroNetResult(winners: NormalizedWinner[], heroName: string): number | null {
  const heroWin = winners.find(w => w.player === heroName);
  if (heroWin) return heroWin.amount;
  const opponentTotal = winners
    .filter(w => w.player !== heroName)
    .reduce((sum, w) => sum + w.amount, 0);
  return opponentTotal > 0 ? -opponentTotal : null;
}
