// Hand history parser – v1
// Supports: PokerStars, GGPoker, ACR/WPN, with generic fallback

export type PokerSite = 'pokerstars' | 'ggpoker' | 'acr' | 'unknown';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type ActionType =
  | 'post_sb' | 'post_bb' | 'post_ante'
  | 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'
  | 'collect' | 'show' | 'muck' | 'win' | 'uncalled_return';

// How confidently the starting stack was determined
export type StackConfidence =
  | 'exact'               // parsed directly from seat line in hand history
  | 'inferred_allin'      // player went all-in; stack = total committed
  | 'inferred_actions'    // no allin; stack = lower-bound from action totals
  | 'inferred_result'     // inferred from ending stack and net result
  | 'needs_review';       // could not reconstruct — manual correction required

export interface HandAction {
  player: string;
  type: ActionType;
  amount?: number;
  street: Street;
  index: number; // global sequential index
}

export interface HandPlayer {
  name: string;
  seat: number;
  stack: number;
  stackConfidence?: StackConfidence;
  position?: string;
  holeCards?: [string, string];
  isHero: boolean;
}

export interface ParsedHand {
  site: PokerSite;
  handId: string;
  gameType: string;
  stakes: string;
  date: string;
  tableName: string;
  buttonSeat: number;
  players: HandPlayer[];
  heroName: string;
  board: {
    flop: string[];
    turn: string | null;
    river: string | null;
  };
  actions: HandAction[];
  pot: number;
  rake: number;
  winners: { player: string; amount: number }[];
  rawText: string;
  parseErrors: string[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeCard(c: string): string {
  return c.replace(/10/g, 'T').trim();
}

function parseCards(raw: string): string[] {
  const matches = raw.match(/[2-9TJQKA][shdcSHDC]/g) || [];
  return matches.map(normalizeCard);
}

function parseAmount(raw: string): number {
  const m = raw.match(/[\d,]+\.?\d*/);
  if (!m) return 0;
  return parseFloat(m[0].replace(/,/g, ''));
}

// Try multiple seat formats; returns [seatNum, name, stack] or null
function parseSeatLine(line: string): [number, string, number] | null {
  // "Seat 1: Name (1500 in chips)"  — PS/GG tournament
  let m = line.match(/^Seat (\d+):\s+(.+?)\s+\(([0-9,.]+) in chips/);
  if (m) return [parseInt(m[1]), m[2].trim(), parseAmount(m[3])];
  // "Seat 1: Name ($1500 in chips)"  — PS cash game with $ prefix
  m = line.match(/^Seat (\d+):\s+(.+?)\s+\(\$([0-9,.]+) in chips/);
  if (m) return [parseInt(m[1]), m[2].trim(), parseAmount(m[3])];
  // "Seat 1: Name ($1500.00)"  — GGPoker cash / ACR
  m = line.match(/^Seat (\d+):\s+(.+?)\s+\(\$([0-9,.]+)\)/);
  if (m) return [parseInt(m[1]), m[2].trim(), parseAmount(m[3])];
  // "Seat 1: Name (1500)"  — generic
  m = line.match(/^Seat (\d+):\s+(.+?)\s+\(([0-9,.]+)\)$/);
  if (m) return [parseInt(m[1]), m[2].trim(), parseAmount(m[3])];
  // "Seat 1: Name - 1500 chips"
  m = line.match(/^Seat (\d+):\s+(.+?)\s+-\s+([0-9,.]+)\s+chips/i);
  if (m) return [parseInt(m[1]), m[2].trim(), parseAmount(m[3])];
  return null;
}

// Position labels indexed from BTN (offset 0) walking clockwise.
// Each array is sized exactly to the player count so CO is always the last
// entry (immediately counter-clockwise of BTN / the last seat before BTN).
const POS_BY_COUNT: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
};

function assignPositions(players: HandPlayer[], buttonSeat: number): void {
  if (players.length === 0) return;
  const n = players.length;
  const posArr = POS_BY_COUNT[n] ?? Array.from({ length: n }, (_, i) => i === 0 ? 'BTN' : `P${i}`);

  // Seat numbers increase clockwise at PokerStars/GGPoker/ACR tables.
  // Sort ascending → clockwise order. Walk from BTN's index outward.
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const btnIdx = sorted.findIndex(p => p.seat === buttonSeat);

  // If buttonSeat doesn't match any player (rare: button on dead/empty seat),
  // find the closest occupied seat clockwise of buttonSeat.
  let base = btnIdx;
  if (base < 0) {
    // Pick the player with the largest seat number <= buttonSeat, or wrap to last
    const before = sorted.filter(p => p.seat <= buttonSeat);
    base = before.length > 0
      ? sorted.indexOf(before[before.length - 1])
      : sorted.length - 1;
  }

  sorted.forEach((p, i) => {
    const offset = (i - base + n) % n;
    p.position = posArr[offset] ?? `S${p.seat}`;
  });
}

// ─── PokerStars parser ───────────────────────────────────────────────────────

function parsePokerStars(text: string): ParsedHand | null {
  if (!/PokerStars Hand #/i.test(text)) return null;

  const hand: ParsedHand = {
    site: 'pokerstars',
    handId: '', gameType: '', stakes: '', date: '', tableName: '',
    buttonSeat: 0, players: [], heroName: 'Hero',
    board: { flop: [], turn: null, river: null },
    actions: [], pot: 0, rake: 0, winners: [],
    rawText: text, parseErrors: [],
  };

  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  let currentStreet: Street = 'preflop';
  let actionIndex = 0;
  let inSummary = false;

  for (const line of lines) {
    // Stop adding players once we reach the summary section
    if (/^\*\*\* SUMMARY \*\*\*/.test(line)) { inSummary = true; continue; }

    // Hand ID + stakes
    const headerMatch = line.match(/PokerStars Hand #(\d+).+?(Hold'em|Omaha).+?\((.+?)\).+?(\d{4}\/\d{2}\/\d{2})/i);
    if (headerMatch) {
      hand.handId = headerMatch[1];
      hand.gameType = headerMatch[2];
      hand.stakes = headerMatch[3];
      hand.date = headerMatch[4];
      continue;
    }

    // Table
    const tableMatch = line.match(/Table '(.+?)'.+?Seat #(\d+)/i);
    if (tableMatch) {
      hand.tableName = tableMatch[1];
      hand.buttonSeat = parseInt(tableMatch[2]);
      continue;
    }

    // Seat listing — only before summary
    if (!inSummary) {
      const parsedSeat = parseSeatLine(line);
      if (parsedSeat) {
        const [seatNum, name, stack] = parsedSeat;
        // Deduplicate: skip if a player with this seat already exists
        if (!hand.players.some(p => p.seat === seatNum)) {
          hand.players.push({ seat: seatNum, name, stack, isHero: false });
        }
        continue;
      }
    }

    // Street markers
    if (/^\*\*\* HOLE CARDS \*\*\*/.test(line)) { currentStreet = 'preflop'; continue; }

    // Hero hole cards — "Dealt to heroName [Ah Kd]"
    const holeMatch = line.match(/^Dealt to (.+?) \[(.+?)\]/);
    if (holeMatch) {
      const heroName = holeMatch[1].trim();
      hand.heroName = heroName;
      const cards = parseCards(holeMatch[2]);
      const p = hand.players.find(x => x.name === heroName);
      console.log('[Parser] Dealt to:', heroName, '| cards raw:', holeMatch[2], '| parsed:', cards, '| player found:', !!p);
      if (p) { p.isHero = true; if (cards.length >= 2) p.holeCards = [cards[0], cards[1]]; }
      continue;
    }

    if (/^\*\*\* FLOP \*\*\*/.test(line)) {
      currentStreet = 'flop';
      hand.board.flop = parseCards(line);
      continue;
    }
    if (/^\*\*\* TURN \*\*\*/.test(line)) {
      currentStreet = 'turn';
      const cards = parseCards(line);
      hand.board.turn = cards[cards.length - 1] ?? null;
      continue;
    }
    if (/^\*\*\* RIVER \*\*\*/.test(line)) {
      currentStreet = 'river';
      const cards = parseCards(line);
      hand.board.river = cards[cards.length - 1] ?? null;
      continue;
    }
    if (/^\*\*\* SHOW DOWN \*\*\*/.test(line)) { currentStreet = 'showdown'; continue; }

    // Parse pot + rake even inside the SUMMARY section (PokerStars puts
    // "Total pot X | Rake Y" in the summary, so we must not skip it).
    const potMatchPS = line.match(/Total pot ([0-9,.]+).+?Rake ([0-9,.]+)/);
    if (potMatchPS) { hand.pot = parseAmount(potMatchPS[1]); hand.rake = parseAmount(potMatchPS[2]); continue; }

    // Skip action parsing once in summary
    if (inSummary) continue;

    // Showdown revealed cards
    const showMatch = line.match(/^(.+?): shows \[(.+?)\]/);
    if (showMatch) {
      const p = hand.players.find(x => x.name === showMatch[1].trim());
      const cards = parseCards(showMatch[2]);
      if (p && cards.length >= 2) p.holeCards = [cards[0], cards[1]];
      hand.actions.push({ player: showMatch[1].trim(), type: 'show', street: currentStreet, index: actionIndex++ });
      continue;
    }

    // Antes / blinds
    const anteMatch = line.match(/^(.+?): posts the ante ([0-9,.]+)/);
    if (anteMatch) {
      hand.actions.push({ player: anteMatch[1].trim(), type: 'post_ante', amount: parseAmount(anteMatch[2]), street: 'preflop', index: actionIndex++ });
      continue;
    }
    const sbMatch = line.match(/^(.+?): posts small blind ([0-9,.]+)/);
    if (sbMatch) {
      hand.actions.push({ player: sbMatch[1].trim(), type: 'post_sb', amount: parseAmount(sbMatch[2]), street: 'preflop', index: actionIndex++ });
      continue;
    }
    const bbMatch = line.match(/^(.+?): posts big blind ([0-9,.]+)/);
    if (bbMatch) {
      hand.actions.push({ player: bbMatch[1].trim(), type: 'post_bb', amount: parseAmount(bbMatch[2]), street: 'preflop', index: actionIndex++ });
      continue;
    }

    // Actions
    const foldMatch = line.match(/^(.+?): folds/);
    if (foldMatch) { hand.actions.push({ player: foldMatch[1].trim(), type: 'fold', street: currentStreet, index: actionIndex++ }); continue; }
    const checkMatch = line.match(/^(.+?): checks/);
    if (checkMatch) { hand.actions.push({ player: checkMatch[1].trim(), type: 'check', street: currentStreet, index: actionIndex++ }); continue; }
    const callMatch = line.match(/^(.+?): calls ([0-9,.]+)/);
    if (callMatch) { hand.actions.push({ player: callMatch[1].trim(), type: 'call', amount: parseAmount(callMatch[2]), street: currentStreet, index: actionIndex++ }); continue; }
    const betMatch = line.match(/^(.+?): bets ([0-9,.]+)/);
    if (betMatch) { hand.actions.push({ player: betMatch[1].trim(), type: 'bet', amount: parseAmount(betMatch[2]), street: currentStreet, index: actionIndex++ }); continue; }
    // All-in raise (synthesised from GG scan: "raises X to Y and is all-in")
    const allinRaiseMatch = line.match(/^(.+?): raises ([0-9,.]+) to ([0-9,.]+) and is all-in/);
    if (allinRaiseMatch) { hand.actions.push({ player: allinRaiseMatch[1].trim(), type: 'allin', amount: parseAmount(allinRaiseMatch[3]), street: currentStreet, index: actionIndex++ }); continue; }
    // All-in call (e.g. "calls X and is all-in")
    const allinCallMatch = line.match(/^(.+?): calls ([0-9,.]+) and is all-in/);
    if (allinCallMatch) { hand.actions.push({ player: allinCallMatch[1].trim(), type: 'allin', amount: parseAmount(allinCallMatch[2]), street: currentStreet, index: actionIndex++ }); continue; }
    const raiseMatch = line.match(/^(.+?): raises ([0-9,.]+) to ([0-9,.]+)/);
    if (raiseMatch) { hand.actions.push({ player: raiseMatch[1].trim(), type: 'raise', amount: parseAmount(raiseMatch[3]), street: currentStreet, index: actionIndex++ }); continue; }

    // Uncalled bet returned — reduces hero's committed amount on that street
    const uncalledMatch = line.match(/Uncalled bet \(([0-9,.]+)\) returned to (.+)/);
    if (uncalledMatch) { hand.actions.push({ player: uncalledMatch[2].trim(), type: 'uncalled_return', amount: parseAmount(uncalledMatch[1]), street: currentStreet, index: actionIndex++ }); continue; }

    // Pot
    const potMatch = line.match(/Total pot ([0-9,.]+).+?Rake ([0-9,.]+)/);
    if (potMatch) { hand.pot = parseAmount(potMatch[1]); hand.rake = parseAmount(potMatch[2]); continue; }

    // Winners
    const collectMatch = line.match(/^(.+?) collected ([0-9,.]+) from/);
    if (collectMatch) {
      hand.winners.push({ player: collectMatch[1].trim(), amount: parseAmount(collectMatch[2]) });
      hand.actions.push({ player: collectMatch[1].trim(), type: 'collect', amount: parseAmount(collectMatch[2]), street: 'showdown', index: actionIndex++ });
      continue;
    }
  }

  // Assign positions
  assignPositions(hand.players, hand.buttonSeat);

  return hand;
}

// ─── GGPoker parser ──────────────────────────────────────────────────────────

function parseGGPoker(text: string): ParsedHand | null {
  if (!/Poker Hand #[A-Z]/i.test(text) && !/GGPoker|GG Poker/i.test(text)) return null;

  const hand: ParsedHand = {
    site: 'ggpoker',
    handId: '', gameType: '', stakes: '', date: '', tableName: '',
    buttonSeat: 0, players: [], heroName: 'Hero',
    board: { flop: [], turn: null, river: null },
    actions: [], pot: 0, rake: 0, winners: [],
    rawText: text, parseErrors: [],
  };

  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  let currentStreet: Street = 'preflop';
  let actionIndex = 0;
  let inSummary = false;

  for (const line of lines) {
    if (/^\*\*\* SUMMARY \*\*\*/.test(line) || /^\[SUMMARY\]/i.test(line)) { inSummary = true; continue; }

    const headerMatch = line.match(/Poker Hand #(\S+)/i);
    if (headerMatch) {
      hand.handId = headerMatch[1];
      const gt = line.match(/(Hold'em|Omaha)/i);
      if (gt) hand.gameType = gt[1];
      // GGPoker tournament header puts blinds in "Level14(750/1,500(200))" and
      // the date at the end: "... - 2026/06/02 11:06:54". Extract all from this
      // one line instead of skipping it.
      const levelMatch = line.match(/Level\s*\d+\s*\(?\s*(\d[\d,.]*)\s*\/\s*(\d[\d,.]*)/i);
      if (levelMatch) {
        hand.stakes = levelMatch[1].replace(/,/g, '') + '/' + levelMatch[2].replace(/,/g, '');
      } else {
        // Cash header: "... $1/$2 ..." or "10/20"
        const cashStakes = line.match(/\$?([\d.]+)\/\$?([\d.]+)/);
        if (cashStakes) hand.stakes = cashStakes[1] + '/' + cashStakes[2];
      }
      const dateMatch = line.match(/(\d{4}[/-]\d{2}[/-]\d{2})\s+(\d{2}:\d{2}:\d{2})/);
      if (dateMatch) {
        hand.date = dateMatch[1].replace(/\//g, '-') + ' ' + dateMatch[2];
      } else {
        const dateOnly = line.match(/(\d{4}[/-]\d{2}[/-]\d{2})/);
        if (dateOnly) hand.date = dateOnly[1].replace(/\//g, '-');
      }
      continue;
    }

    // Fallback date extraction for non-header lines
    const dateMatch = line.match(/(\d{4}[/-]\d{2}[/-]\d{2})\s+(\d{2}:\d{2}:\d{2})/);
    if (dateMatch && !hand.date) {
      hand.date = dateMatch[1].replace(/\//g, '-') + ' ' + dateMatch[2];
      continue;
    }
    const dateOnlyMatch = line.match(/(\d{4}[/-]\d{2}[/-]\d{2})/);
    if (dateOnlyMatch && !hand.date && !line.includes('Level')) {
      hand.date = dateOnlyMatch[1].replace(/\//g, '-');
      continue;
    }

    // Blinds from a standalone level line (rare): "Level1(500/1,000)"
    const levelMatch = line.match(/Level\s*\d+\s*\(?\s*(\d[\d,.]*)\s*\/\s*(\d[\d,.]*)/i);
    if (levelMatch && !hand.stakes) {
      hand.stakes = levelMatch[1].replace(/,/g, '') + '/' + levelMatch[2].replace(/,/g, '');
      continue;
    }

    const tableMatch = line.match(/Table '?(.+?)'?\s+\d+-max/i);
    if (tableMatch) {
      hand.tableName = tableMatch[1];
      // GGPoker puts the button on the same line: "Table '293' 8-max Seat #1 is the button"
      const btnOnTable = line.match(/Seat\s*#?(\d+)\s+is\s+the\s+button/i);
      if (btnOnTable) hand.buttonSeat = parseInt(btnOnTable[1]);
      continue;
    }

    // Seat — only before summary
    if (!inSummary) {
      const parsedSeat = parseSeatLine(line);
      if (parsedSeat) {
        const [seatNum, name, stack] = parsedSeat;
        if (!hand.players.some(p => p.seat === seatNum)) {
          hand.players.push({ seat: seatNum, name, stack, isHero: false });
        }
        continue;
      }
    }

    // Button — "Seat #4 is the button" OR "#button is seat 4"
    const btnMatch = line.match(/[Ss]eat\s*#?(\d+)\s+is\s+the\s+button/i) ?? line.match(/#button\s+is\s+seat\s+(\d+)/i);
    if (btnMatch) { hand.buttonSeat = parseInt(btnMatch[1]); continue; }

    // Hero cards
    const holeMatch = line.match(/^Dealt to (.+?) \[(.+?)\]/);
    if (holeMatch) {
      const heroName = holeMatch[1].trim();
      hand.heroName = heroName;
      const cards = parseCards(holeMatch[2]);
      const p = hand.players.find(x => x.name === heroName);
      if (p) { p.isHero = true; if (cards.length >= 2) p.holeCards = [cards[0], cards[1]]; }
      continue;
    }

    if (/^\*\*\* HOLE CARDS \*\*\*/.test(line) || /pre-flop/i.test(line)) { currentStreet = 'preflop'; continue; }
    if (/^\*\*\* FLOP \*\*\*/.test(line) || /\[FLOP\]/i.test(line)) {
      currentStreet = 'flop'; hand.board.flop = parseCards(line); continue;
    }
    if (/^\*\*\* TURN \*\*\*/.test(line) || /\[TURN\]/i.test(line)) {
      currentStreet = 'turn'; const c = parseCards(line); hand.board.turn = c[c.length - 1] ?? null; continue;
    }
    if (/^\*\*\* RIVER \*\*\*/.test(line) || /\[RIVER\]/i.test(line)) {
      currentStreet = 'river'; const c = parseCards(line); hand.board.river = c[c.length - 1] ?? null; continue;
    }
    if (/SHOW DOWN/i.test(line)) { currentStreet = 'showdown'; continue; }

    // Parse pot + rake even inside the SUMMARY section (GG puts "Total pot X | Rake Y"
    // in the summary, so we must not skip it).
    const potMatchGG = line.match(/Total pot ([0-9,.]+).+?Rake ([0-9,.]+)/);
    if (potMatchGG) { hand.pot = parseAmount(potMatchGG[1]); hand.rake = parseAmount(potMatchGG[2]); continue; }
    // GG summary also has a Board line; parse it for completeness.
    const summaryBoardMatch = line.match(/^Board \[([^\]]+)\]/);
    if (summaryBoardMatch) {
      const cards = parseCards(summaryBoardMatch[1]);
      if (cards.length >= 3) { hand.board.flop = cards.slice(0, 3); if (cards[3]) hand.board.turn = cards[3]; if (cards[4]) hand.board.river = cards[4]; }
      continue;
    }

    if (inSummary) continue;

    const showMatch = line.match(/^(.+?): shows \[(.+?)\]/);
    if (showMatch) {
      const p = hand.players.find(x => x.name === showMatch[1].trim());
      const cards = parseCards(showMatch[2]);
      if (p && cards.length >= 2) p.holeCards = [cards[0], cards[1]];
      hand.actions.push({ player: showMatch[1].trim(), type: 'show', street: currentStreet, index: actionIndex++ });
      continue;
    }

    const sbMatch = line.match(/^(.+?): posts small blind ([0-9,.]+)/i);
    if (sbMatch) { hand.actions.push({ player: sbMatch[1].trim(), type: 'post_sb', amount: parseAmount(sbMatch[2]), street: 'preflop', index: actionIndex++ }); continue; }
    const bbMatch = line.match(/^(.+?): posts big blind ([0-9,.]+)/i);
    if (bbMatch) { hand.actions.push({ player: bbMatch[1].trim(), type: 'post_bb', amount: parseAmount(bbMatch[2]), street: 'preflop', index: actionIndex++ }); continue; }
    const anteMatchGG = line.match(/^(.+?): posts (?:the )?ante ([0-9,.]+)/i);
    if (anteMatchGG) { hand.actions.push({ player: anteMatchGG[1].trim(), type: 'post_ante', amount: parseAmount(anteMatchGG[2]), street: 'preflop', index: actionIndex++ }); continue; }
    const foldMatch = line.match(/^(.+?): folds/i);
    if (foldMatch) { hand.actions.push({ player: foldMatch[1].trim(), type: 'fold', street: currentStreet, index: actionIndex++ }); continue; }
    const checkMatch = line.match(/^(.+?): checks/i);
    if (checkMatch) { hand.actions.push({ player: checkMatch[1].trim(), type: 'check', street: currentStreet, index: actionIndex++ }); continue; }
    const callMatch = line.match(/^(.+?): calls ([0-9,.]+)/i);
    if (callMatch) { hand.actions.push({ player: callMatch[1].trim(), type: 'call', amount: parseAmount(callMatch[2]), street: currentStreet, index: actionIndex++ }); continue; }
    const betMatch = line.match(/^(.+?): bets ([0-9,.]+)/i);
    if (betMatch) { hand.actions.push({ player: betMatch[1].trim(), type: 'bet', amount: parseAmount(betMatch[2]), street: currentStreet, index: actionIndex++ }); continue; }
    const allinRaiseMatch2 = line.match(/^(.+?): raises ([0-9,.]+) to ([0-9,.]+) and is all-in/i);
    if (allinRaiseMatch2) { hand.actions.push({ player: allinRaiseMatch2[1].trim(), type: 'allin', amount: parseAmount(allinRaiseMatch2[3]), street: currentStreet, index: actionIndex++ }); continue; }
    const allinCallMatch2 = line.match(/^(.+?): calls ([0-9,.]+) and is all-in/i);
    if (allinCallMatch2) { hand.actions.push({ player: allinCallMatch2[1].trim(), type: 'allin', amount: parseAmount(allinCallMatch2[2]), street: currentStreet, index: actionIndex++ }); continue; }
    const raiseMatch = line.match(/^(.+?): raises ([0-9,.]+) to ([0-9,.]+)/i);
    if (raiseMatch) { hand.actions.push({ player: raiseMatch[1].trim(), type: 'raise', amount: parseAmount(raiseMatch[3]), street: currentStreet, index: actionIndex++ }); continue; }

    // Uncalled bet returned — reduces hero's committed amount on that street
    const uncalledMatchGG = line.match(/Uncalled bet \(([0-9,.]+)\) returned to (.+)/);
    if (uncalledMatchGG) { hand.actions.push({ player: uncalledMatchGG[2].trim(), type: 'uncalled_return', amount: parseAmount(uncalledMatchGG[1]), street: currentStreet, index: actionIndex++ }); continue; }

    const collectMatch = line.match(/^(.+?) collected ([0-9,.]+)/i);
    if (collectMatch && !line.includes('from side')) {
      hand.winners.push({ player: collectMatch[1].trim(), amount: parseAmount(collectMatch[2]) });
      hand.actions.push({ player: collectMatch[1].trim(), type: 'collect', amount: parseAmount(collectMatch[2]), street: 'showdown', index: actionIndex++ });
      continue;
    }
  }

  assignPositions(hand.players, hand.buttonSeat);

  return hand;
}

// ─── ACR / WPN parser ────────────────────────────────────────────────────────

function parseACR(text: string): ParsedHand | null {
  // Detect ACR/WPN formats: "Game Hand #", "americascardroom", "acr", "winning poker", "BetOnline"
  if (!/americascardroom|acr|winning poker|betonline|game hand #/i.test(text)) return null;

  const hand: ParsedHand = {
    site: 'acr',
    handId: '', gameType: '', stakes: '', date: '', tableName: '',
    buttonSeat: 0, players: [], heroName: 'Hero',
    board: { flop: [], turn: null, river: null },
    actions: [], pot: 0, rake: 0, winners: [],
    rawText: text, parseErrors: [],
  };

  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  let currentStreet: Street = 'preflop';
  let actionIndex = 0;
  let inSummary = false;

  for (const line of lines) {
    if (/^\*\*\* SUMMARY \*\*\*/.test(line) || /^SUMMARY$/i.test(line)) { inSummary = true; continue; }

    // ACR header: "Game Hand #12345678  Tournament #1234  Hold'em No Limit  ($10/$20)"
    const headerMatch = line.match(/Game Hand #(\S+).*?(Hold'em|Omaha|Holdem)/i);
    if (headerMatch) {
      hand.handId = headerMatch[1];
      hand.gameType = headerMatch[2];
      const stakesM = line.match(/\(\$?([\d.]+)\/\$?([\d.]+)\)/);
      if (stakesM) hand.stakes = stakesM[1] + '/' + stakesM[2];
      const dateM = line.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
      if (dateM) hand.date = dateM[1];
      continue;
    }

    // Table line: "Table: Tournament #12345 Table 1"
    const tableMatch = line.match(/^Table:?\s+(.+?)(\s+\d+-max)?$/i);
    if (tableMatch) { hand.tableName = tableMatch[1].trim(); continue; }

    // Button: "Dealer: Seat 5"
    const btnMatch = line.match(/^(?:Dealer|Button):\s*Seat\s*(\d+)/i);
    if (btnMatch) { hand.buttonSeat = parseInt(btnMatch[1]); continue; }

    // Seat listing — only before summary
    if (!inSummary) {
      const parsedSeat = parseSeatLine(line);
      if (parsedSeat) {
        const [seatNum, name, stack] = parsedSeat;
        if (!hand.players.some(p => p.seat === seatNum)) {
          hand.players.push({ seat: seatNum, name, stack, isHero: false });
        }
        continue;
      }
    }

    // Hero hole cards: "Dealt to PlayerName [Ah Kd]"
    const holeMatch = line.match(/^Dealt to (.+?) \[(.+?)\]/);
    if (holeMatch) {
      const heroName = holeMatch[1].trim();
      hand.heroName = heroName;
      const cards = parseCards(holeMatch[2]);
      const p = hand.players.find(x => x.name === heroName);
      if (p) { p.isHero = true; if (cards.length >= 2) p.holeCards = [cards[0], cards[1]]; }
      continue;
    }

    // Street markers
    if (/^\*{3}\s*HOLE CARDS\s*\*{3}/.test(line) || /pre-flop/i.test(line)) { currentStreet = 'preflop'; continue; }
    if (/^\*{3}\s*FLOP\s*\*{3}/.test(line) || /^\[FLOP\]/i.test(line)) {
      currentStreet = 'flop'; hand.board.flop = parseCards(line); continue;
    }
    if (/^\*{3}\s*TURN\s*\*{3}/.test(line) || /^\[TURN\]/i.test(line)) {
      currentStreet = 'turn'; const c = parseCards(line); hand.board.turn = c[c.length - 1] ?? null; continue;
    }
    if (/^\*{3}\s*RIVER\s*\*{3}/.test(line) || /^\[RIVER\]/i.test(line)) {
      currentStreet = 'river'; const c = parseCards(line); hand.board.river = c[c.length - 1] ?? null; continue;
    }
    if (/SHOW DOWN/i.test(line)) { currentStreet = 'showdown'; continue; }

    // Parse pot even inside the SUMMARY section (ACR puts "Total pot X" in
    // the summary, so we must not skip it).
    const potMatchACR = line.match(/Total pot ([0-9,.]+)/i);
    if (potMatchACR) { hand.pot = parseAmount(potMatchACR[1]); continue; }

    if (inSummary) continue;

    // Showdown
    const showMatch = line.match(/^(.+?): shows \[(.+?)\]/);
    if (showMatch) {
      const p = hand.players.find(x => x.name === showMatch[1].trim());
      const cards = parseCards(showMatch[2]);
      if (p && cards.length >= 2) p.holeCards = [cards[0], cards[1]];
      hand.actions.push({ player: showMatch[1].trim(), type: 'show', street: currentStreet, index: actionIndex++ });
      continue;
    }

    // Antes / blinds
    const anteMatch = line.match(/^(.+?): posts (?:the )?ante ([0-9,.]+)/i);
    if (anteMatch) { hand.actions.push({ player: anteMatch[1].trim(), type: 'post_ante', amount: parseAmount(anteMatch[2]), street: 'preflop', index: actionIndex++ }); continue; }
    const sbMatch = line.match(/^(.+?): posts small blind ([0-9,.]+)/i);
    if (sbMatch) { hand.actions.push({ player: sbMatch[1].trim(), type: 'post_sb', amount: parseAmount(sbMatch[2]), street: 'preflop', index: actionIndex++ }); continue; }
    const bbMatch = line.match(/^(.+?): posts big blind ([0-9,.]+)/i);
    if (bbMatch) { hand.actions.push({ player: bbMatch[1].trim(), type: 'post_bb', amount: parseAmount(bbMatch[2]), street: 'preflop', index: actionIndex++ }); continue; }

    // Actions
    const foldMatch = line.match(/^(.+?): folds/i);
    if (foldMatch) { hand.actions.push({ player: foldMatch[1].trim(), type: 'fold', street: currentStreet, index: actionIndex++ }); continue; }
    const checkMatch = line.match(/^(.+?): checks/i);
    if (checkMatch) { hand.actions.push({ player: checkMatch[1].trim(), type: 'check', street: currentStreet, index: actionIndex++ }); continue; }
    const callMatch = line.match(/^(.+?): calls ([0-9,.]+)/i);
    if (callMatch) { hand.actions.push({ player: callMatch[1].trim(), type: 'call', amount: parseAmount(callMatch[2]), street: currentStreet, index: actionIndex++ }); continue; }
    const betMatch = line.match(/^(.+?): bets ([0-9,.]+)/i);
    if (betMatch) { hand.actions.push({ player: betMatch[1].trim(), type: 'bet', amount: parseAmount(betMatch[2]), street: currentStreet, index: actionIndex++ }); continue; }
    const raiseMatch = line.match(/^(.+?): raises ([0-9,.]+) to ([0-9,.]+)/i);
    if (raiseMatch) { hand.actions.push({ player: raiseMatch[1].trim(), type: 'raise', amount: parseAmount(raiseMatch[3]), street: currentStreet, index: actionIndex++ }); continue; }
    const allinMatch = line.match(/^(.+?): (?:is )?all[\s-]?in(?: for)? ([0-9,.]+)?/i);
    if (allinMatch && allinMatch[1].trim() !== hand.heroName.slice(0, 2)) {
      hand.actions.push({ player: allinMatch[1].trim(), type: 'allin', amount: allinMatch[2] ? parseAmount(allinMatch[2]) : undefined, street: currentStreet, index: actionIndex++ }); continue;
    }

    // Pot
    const potMatch = line.match(/Total pot ([0-9,.]+)/i);
    if (potMatch) { hand.pot = parseAmount(potMatch[1]); continue; }

    // Winners
    const collectMatch = line.match(/^(.+?) wins \$?([\d,]+\.?\d*)/i);
    if (collectMatch) {
      hand.winners.push({ player: collectMatch[1].trim(), amount: parseAmount(collectMatch[2]) });
      hand.actions.push({ player: collectMatch[1].trim(), type: 'collect', amount: parseAmount(collectMatch[2]), street: 'showdown', index: actionIndex++ });
      continue;
    }
    const collectMatch2 = line.match(/^(.+?) collected ([0-9,.]+) from/i);
    if (collectMatch2) {
      hand.winners.push({ player: collectMatch2[1].trim(), amount: parseAmount(collectMatch2[2]) });
      hand.actions.push({ player: collectMatch2[1].trim(), type: 'collect', amount: parseAmount(collectMatch2[2]), street: 'showdown', index: actionIndex++ });
      continue;
    }
  }

  assignPositions(hand.players, hand.buttonSeat);

  return hand;
}

// ─── Generic fallback ────────────────────────────────────────────────────────

function parseGeneric(text: string): ParsedHand {
  const hand: ParsedHand = {
    site: 'unknown',
    handId: Date.now().toString(),
    gameType: 'Hold\'em', stakes: '?', date: new Date().toISOString().slice(0, 10),
    tableName: 'Unknown Table', buttonSeat: 1,
    players: [], heroName: 'Hero',
    board: { flop: [], turn: null, river: null },
    actions: [], pot: 0, rake: 0, winners: [],
    rawText: text,
    parseErrors: ['Could not fully parse this hand format. Raw text saved.'],
  };

  // Best-effort: find board cards
  const boardMatch = text.match(/\[([2-9TJQKA][shdcSHDC][\s,]+[2-9TJQKA][shdcSHDC][\s,]+[2-9TJQKA][shdcSHDC][^\]]*)\]/);
  if (boardMatch) {
    const cards = parseCards(boardMatch[1]);
    hand.board.flop = cards.slice(0, 3);
    if (cards[3]) hand.board.turn = cards[3];
    if (cards[4]) hand.board.river = cards[4];
  }

  return hand;
}

// ─── Public API ──────────────────────────────────────────────────────────────

// After parsing, infer missing starting stacks from action data.
// Players whose seat-line stack was present stay 'exact'.
// Players with stack === 0 get reconstructed from:
//   1. all-in action total (most reliable)
//   2. sum of action commitments (lower bound when no allin)
// Adds console debug output as required.
function reconstructStacks(hand: ParsedHand): void {
  const allStreets: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const lastIdx = hand.actions.length > 0
    ? hand.actions[hand.actions.length - 1].index
    : 0;

  for (const player of hand.players) {
    const totalCommitted = allStreets.reduce(
      (sum, street) => sum + computePlayerStreetBet(player.name, hand.actions, lastIdx, street),
      0
    );
    const totalWon = hand.winners
      .filter(w => w.player === player.name)
      .reduce((sum, w) => sum + w.amount, 0);
    const hasAllin = hand.actions.some(
      a => a.player === player.name && a.type === 'allin'
    );

    const originalStack = player.stack;

    if (player.stack > 0) {
      player.stackConfidence = 'exact';
      // Sanity check: starting stack must cover what was committed
      if (totalCommitted > 0 && player.stack < totalCommitted) {
        hand.parseErrors.push(
          `Stack estimate needs review — OCR result and action total do not match. ` +
          `${player.name}: listed stack ${player.stack.toLocaleString()} < total committed ${totalCommitted.toLocaleString()}.`
        );
        player.stackConfidence = 'needs_review';
      }
    } else {
      // stack === 0: reconstruct from action data
      if (hasAllin && totalCommitted > 0) {
        // Player went all-in → their stack ≤ totalCommitted; totalCommitted is the exact starting stack
        player.stack = totalCommitted;
        player.stackConfidence = 'inferred_allin';
      } else if (totalCommitted > 0) {
        // No allin — committed amount is a lower bound; use it as best estimate
        player.stack = totalCommitted;
        player.stackConfidence = 'inferred_actions';
      } else {
        // No useful signal — leave at 0, flag for manual review
        player.stackConfidence = 'needs_review';
      }
    }

    const netResult    = totalWon - totalCommitted;
    const endingStack  = player.stack + netResult;

    console.log(`[StackRecon] ${player.name}`, {
      endingStack:             endingStack > 0 ? endingStack : 'n/a',
      netResult:               (netResult >= 0 ? '+' : '') + netResult.toLocaleString(),
      amountCommitted:         totalCommitted,
      calculatedStartingStack: player.stack,
      confidenceSource:        player.stackConfidence,
    });

    if (originalStack === 0 && player.stack > 0) {
      console.warn(
        `[StackRecon] ${player.name} stack reconstructed: 0 → ${player.stack.toLocaleString()} (${player.stackConfidence})`
      );
    }
  }
}

// ─── Multi-hand splitting ────────────────────────────────────────────────────

const HAND_HEADER_RE = [
  /^PokerStars Hand #/i,
  /^Poker Hand #[A-Z0-9]/i,   // GGPoker
  /^Hand #\d+/i,
  /^Game Hand #\d+/i,          // ACR/WPN
  /^Game #\d+/i,
  /^Winamax Poker.*Hand #/i,
  /^Full Tilt Poker.*Hand #/i,
  /^ACR.*Hand #/i,
  /^BetOnline.*Hand #/i,
];

export function splitHandHistories(raw: string): string[] {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '');
  const lines = text.split('\n');
  const starts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (HAND_HEADER_RE.some(re => re.test(l))) {
      starts.push(i);
    }
  }

  if (starts.length === 0) return [text.trim()].filter(Boolean);
  if (starts.length === 1) return [text.trim()].filter(Boolean);

  const chunks: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const chunk = lines.slice(starts[i], starts[i + 1]).join('\n').trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

// ─── Multi-hand parsing with error handling and logging ──────────────────────

export interface MultiHandParseResult {
  hands: ParsedHand[];
  total: number;
  imported: number;
  skipped: number;
  skippedReasons: string[];
}

export function parseMultipleHands(
  raw: string,
  heroNameOverride?: string
): MultiHandParseResult {
  const chunks = splitHandHistories(raw);
  const hands: ParsedHand[] = [];
  const skippedReasons: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < chunks.length; i++) {
    try {
      const parsed = parseHandHistory(chunks[i], heroNameOverride);
      if (parsed.players.length > 0) {
        hands.push(parsed);
        imported++;
      } else {
        skipped++;
        const reason = `Hand ${i + 1}: no players detected (possibly malformed or unsupported format)`;
        skippedReasons.push(reason);
        console.warn(`[MultiHandParser] Skipped hand ${i + 1}: no players detected`);
      }
    } catch (err: any) {
      skipped++;
      const reason = `Hand ${i + 1}: ${err?.message ?? 'parse error'}`;
      skippedReasons.push(reason);
      console.warn(`[MultiHandParser] Skipped hand ${i + 1}:`, err?.message ?? 'parse error');
    }
  }

  console.group('HH IMPORT SUMMARY');
  console.log(`Total hands detected: ${chunks.length}`);
  console.log(`Hands successfully imported: ${imported}`);
  console.log(`Hands skipped: ${skipped}`);
  if (skippedReasons.length > 0) {
    console.log('Skipped reasons:');
    skippedReasons.forEach(r => console.log(`  - ${r}`));
  }
  console.groupEnd();

  return { hands, total: chunks.length, imported, skipped, skippedReasons };
}

export function parseHandHistory(text: string, heroNameOverride?: string): ParsedHand {
  const trimmed = text.trim();
  const hand = (
    parsePokerStars(trimmed) ??
    parseGGPoker(trimmed) ??
    parseACR(trimmed) ??
    parseGeneric(trimmed)
  );

  // If a hero name override is provided and no hero was found via "Dealt to", apply it
  if (heroNameOverride && !hand.players.some(p => p.isHero)) {
    const override = heroNameOverride.trim().toLowerCase();
    const match = hand.players.find(p => p.name.toLowerCase() === override);
    if (match) {
      match.isHero = true;
      hand.heroName = match.name;
    }
  }

  // ── Blind inference: if positions are assigned but no post_sb/post_bb actions
  // were parsed, synthesize them from stakes + position data so chips always show.
  inferMissingBlinds(hand);

  reconstructStacks(hand);

  // Debug: log parsed hand summary
  const forcedActions = hand.actions.filter(a => ['post_ante','post_sb','post_bb'].includes(a.type));
  const preflopActions = hand.actions.filter(a => a.street === 'preflop' && !['post_ante','post_sb','post_bb'].includes(a.type));
  console.log(`[HandParser] ${hand.site} | ${hand.players.length}-max | stakes: ${hand.stakes}`);
  console.log('[HandParser] players:', hand.players.map(p => `${p.name}(seat${p.seat},${p.position ?? '?'},stack:${p.stack})`).join(', '));
  console.log('[HandParser] blindPostActions:', forcedActions);
  console.log('[HandParser] preflopActions:', preflopActions.slice(0, 6));
  const pot = forcedActions.reduce((s, a) => s + (a.amount ?? 0), 0);
  console.log(`[HandParser] pot after blinds: ${pot}`);

  return hand;
}

// Synthesize missing post_sb / post_bb actions when the parser found player
// positions but no blind-post lines (e.g. stripped hand history, unsupported format).
function inferMissingBlinds(hand: ParsedHand): void {
  const hasSB = hand.actions.some(a => a.type === 'post_sb');
  const hasBB = hand.actions.some(a => a.type === 'post_bb');
  if (hasSB && hasBB) return; // already parsed

  // Parse bb amount from stakes string: "300/600" → sb=300, bb=600
  const m = hand.stakes?.match(/^([\d.,]+)\/([\d.,]+)/);
  if (!m) return; // can't infer amounts without stakes
  const sbAmt = parseAmount(m[1]);
  const bbAmt = parseAmount(m[2]);
  if (sbAmt <= 0 || bbAmt <= 0) return;

  const sbPlayer = hand.players.find(p => p.position === 'SB');
  const bbPlayer = hand.players.find(p => p.position === 'BB');

  // Find the minimum existing action index to insert blind posts before it
  const minIdx = hand.actions.length > 0
    ? Math.min(...hand.actions.map(a => a.index))
    : 0;

  // Shift all existing actions forward to make room for inferred blinds
  const insertCount = (!hasSB ? 1 : 0) + (!hasBB ? 1 : 0);
  for (const a of hand.actions) {
    a.index += insertCount;
  }

  let insertAt = 0;
  if (!hasSB && sbPlayer) {
    hand.actions.unshift({ player: sbPlayer.name, type: 'post_sb', amount: sbAmt, street: 'preflop', index: insertAt++ });
    console.log(`[HandParser] inferred post_sb: ${sbPlayer.name} ${sbAmt}`);
  } else {
    insertAt++;
  }
  if (!hasBB && bbPlayer) {
    hand.actions.splice(insertAt, 0, { player: bbPlayer.name, type: 'post_bb', amount: bbAmt, street: 'preflop', index: insertAt });
    console.log(`[HandParser] inferred post_bb: ${bbPlayer.name} ${bbAmt}`);
  }
}

export function getStreetActions(actions: HandAction[], street: Street): HandAction[] {
  return actions.filter(a => a.street === street);
}

const BET_TYPES = ['post_sb', 'post_bb', 'post_ante', 'call', 'bet', 'raise', 'allin'] as const;

// Amount a player has committed on a given street up to upToIndex.
// raise/allin amounts in PS/GG/ACR format are the TOTAL committed to that street.
// call/bet/post_sb/post_bb/post_ante amounts are INCREMENTAL (additional chips).
export function computePlayerStreetBet(
  playerName: string,
  actions: HandAction[],
  upToIndex: number,
  street: Street
): number {
  let bet = 0;
  for (const a of actions) {
    if (a.index > upToIndex) break;
    if (a.player !== playerName || a.street !== street) continue;
    if (!a.amount || !BET_TYPES.includes(a.type as typeof BET_TYPES[number])) continue;
    if (a.type === 'raise' || a.type === 'allin') {
      // raise "to X" and allin amounts are the total committed this street
      bet = a.amount;
    } else {
      // post_sb, post_bb, post_ante, bet, call: incremental chips added
      bet += a.amount;
    }
  }
  return bet;
}

export function computePotAtAction(actions: HandAction[], upToIndex: number): number {
  const streets: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const players = [...new Set(
    actions.filter(a => a.index <= upToIndex).map(a => a.player)
  )];
  let pot = 0;
  for (const playerName of players) {
    for (const street of streets) {
      pot += computePlayerStreetBet(playerName, actions, upToIndex, street);
    }
  }
  return pot;
}

// Pot already collected from all streets BEFORE currentStreet.
// Uses full action list (all prior-street actions are already committed by the time
// we're on currentStreet).
export function computeCollectedPot(actions: HandAction[], currentStreet: Street): number {
  const order: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const curIdx = order.indexOf(currentStreet);
  if (curIdx <= 0) return 0;
  const prevStreets = order.slice(0, curIdx) as Street[];
  const players = [...new Set(
    actions.filter(a => prevStreets.includes(a.street)).map(a => a.player)
  )];
  let pot = 0;
  for (const playerName of players) {
    for (const street of prevStreets) {
      pot += computePlayerStreetBet(playerName, actions, Number.MAX_SAFE_INTEGER, street);
    }
  }
  return pot;
}

export function computeStackAtAction(
  player: HandPlayer,
  actions: HandAction[],
  upToIndex: number
): number {
  const streets: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  let totalSpent = 0;
  for (const street of streets) {
    totalSpent += computePlayerStreetBet(player.name, actions, upToIndex, street);
  }
  return Math.max(0, player.stack - totalSpent);
}

export const HAND_TAGS = [
  'Hand History', 'Preflop', 'Flop', 'Turn', 'River',
  'ICM', 'ChipEV', 'PKO', 'Exploit', 'Population',
  'Bluff', 'Value', 'Hero Call', 'Big Pot', 'Final Table', 'Deep Run',
];
