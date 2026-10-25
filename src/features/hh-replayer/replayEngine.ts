import type { NormalizedHand, Street, ActionType, RevealMode } from './types';

// ── Replay Event Types ──

export type ReplayEventType =
  | 'hand_start'
  | 'post_blinds'
  | 'action'
  | 'collect_chips'
  | 'deal_flop'
  | 'deal_turn'
  | 'deal_river'
  | 'showdown_reveal'
  | 'uncalled_return'
  | 'pot_award'
  | 'hand_complete';

export type EventCategory = 'setup' | 'playback';

export interface ReplayEvent {
  index: number;
  type: ReplayEventType;
  category: EventCategory;
  street: Street;
  player?: string;
  actionType?: ActionType;
  amount?: number;
  cards?: string[];
  label: string;
}

// ── Replay State ──

export interface PlayerState {
  name: string;
  seat: number;
  isHero: boolean;
  position?: string;
  startingStack: number;
  currentStack: number;
  committedThisStreet: number;
  committedTotal: number;
  folded: boolean;
  allIn: boolean;
  holeCards?: string[];
  cardsRevealed: boolean;
  mucked: boolean;
  showdownCards?: string[];
  isWinner: boolean;
  winAmount: number;
}

export interface ReplayState {
  street: Street;
  board: string[];
  streetsDealt: number;
  pot: number;
  centralPot: number;
  currentStreetBets: Record<string, number>;
  players: PlayerState[];
  currentEvent: ReplayEvent | null;
  isShowdown: boolean;
  isComplete: boolean;
  allInReveal: boolean;
  winners: { player: string; amount: number }[];
  setupComplete: boolean;
}

// ── Build the replay event timeline ──
//
// Timeline structure:
//   0. hand_start (setup — always applied, shows initial table with blinds/antes already posted)
//   1. post_blinds (setup — label only, no visual change; blinds/antes already applied in hand_start)
//   2. first voluntary action (click 1)
//   3. second voluntary action (click 2)
//   ...
//   N. collect_chips (end of street)
//   N+1. deal_flop/turn/river
//   N+2. first action on new street
//   ...
//
// One click = exactly one playback event.

export function buildReplayEvents(hand: NormalizedHand): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  let idx = 0;

  // Event 0: hand_start — shows table with all players, stacks, hole cards, positions
  events.push({ index: idx++, type: 'hand_start', category: 'setup', street: 'preflop', label: 'Hand started' });

  const actions = hand.actions;
  const streetsSeen = new Set<Street>();
  let currentStreet: Street = 'preflop';
  let streetHadChips = false;

  // Separate blind posts from voluntary actions
  const blindPosts: typeof actions = [];
  const voluntaryActions: typeof actions = [];
  for (const a of actions) {
    if (['post_sb', 'post_bb', 'post_ante'].includes(a.type)) {
      blindPosts.push(a);
    } else {
      voluntaryActions.push(a);
    }
  }

  // Event 1: post_blinds — single playback event for ALL blind/ante posts
  if (blindPosts.length > 0) {
    const totalAnte = blindPosts
      .filter(bp => bp.type === 'post_ante')
      .reduce((sum, bp) => sum + (bp.amount ?? 0), 0);
    const sbAmount = blindPosts.find(bp => bp.type === 'post_sb')?.amount ?? 0;
    const bbAmount = blindPosts.find(bp => bp.type === 'post_bb')?.amount ?? 0;

    const parts: string[] = [];
    if (totalAnte > 0) parts.push(`Antes ${totalAnte.toLocaleString()}`);
    if (sbAmount > 0) parts.push(`SB ${sbAmount.toLocaleString()}`);
    if (bbAmount > 0) parts.push(`BB ${bbAmount.toLocaleString()}`);
    const label = parts.length > 0 ? parts.join(' · ') : 'Blinds posted';

    events.push({
      index: idx++,
      type: 'post_blinds',
      category: 'setup',
      street: 'preflop',
      label,
    });
    streetHadChips = true; // blinds commit chips to street
  }

  const insertCollectChips = (fromStreet: Street) => {
    if (!streetHadChips) return;
    events.push({ index: idx++, type: 'collect_chips', category: 'playback', street: fromStreet, label: 'Chips collected to pot' });
    streetHadChips = false;
  };

  const insertDeal = (street: Street) => {
    if (street === 'flop' && !streetsSeen.has('flop')) {
      streetsSeen.add('flop');
      insertCollectChips(currentStreet);
      const cards = hand.board.flop;
      events.push({ index: idx++, type: 'deal_flop', category: 'playback', street: 'flop', cards, label: `*** FLOP *** ${cards.length > 0 ? `[${cards.join(' ')}]` : ''}` });
    } else if (street === 'turn' && !streetsSeen.has('turn')) {
      if (!streetsSeen.has('flop')) insertDeal('flop');
      streetsSeen.add('turn');
      insertCollectChips(currentStreet);
      const turnCard = hand.board.turn;
      events.push({ index: idx++, type: 'deal_turn', category: 'playback', street: 'turn', cards: turnCard ? [turnCard] : [], label: `*** TURN *** ${turnCard ? `[${turnCard}]` : '[unknown]'}` });
    } else if (street === 'river' && !streetsSeen.has('river')) {
      if (!streetsSeen.has('flop')) insertDeal('flop');
      if (!streetsSeen.has('turn')) insertDeal('turn');
      streetsSeen.add('river');
      insertCollectChips(currentStreet);
      const riverCard = hand.board.river;
      events.push({ index: idx++, type: 'deal_river', category: 'playback', street: 'river', cards: riverCard ? [riverCard] : [], label: `*** RIVER *** ${riverCard ? `[${riverCard}]` : '[unknown]'}` });
    }
  };

  // Process voluntary actions in exact chronological order
  for (const a of voluntaryActions) {
    if (a.street !== currentStreet && a.street !== 'showdown') {
      insertDeal(a.street);
      currentStreet = a.street;
    }

    const isShowAction = a.type === 'show';
    const isMuckAction = a.type === 'muck';
    const isCollectOrWin = ['collect', 'win'].includes(a.type);
    const isUncalledReturn = a.type === 'uncalled_return';

    const label = makeActionLabel(a);

    if (isUncalledReturn) {
      events.push({ index: idx++, type: 'uncalled_return', category: 'playback', street: a.street, player: a.player, actionType: a.type, amount: a.amount, label });
    } else if (isShowAction) {
      const player = hand.players.find(p => p.name === a.player);
      const cards = player?.showdownCards ?? [];
      events.push({ index: idx++, type: 'showdown_reveal', category: 'playback', street: a.street, player: a.player, actionType: a.type, cards, label: cards.length > 0 ? `${shortName(a.player)} shows [${cards.join(' ')}]` : `${shortName(a.player)} shows` });
    } else if (isMuckAction) {
      const player = hand.players.find(p => p.name === a.player);
      const cards = player?.showdownCards ?? [];
      events.push({ index: idx++, type: 'showdown_reveal', category: 'playback', street: a.street, player: a.player, actionType: 'muck', cards, label: cards.length > 0 ? `${shortName(a.player)} mucks [${cards.join(' ')}]` : `${shortName(a.player)} mucks` });
    } else if (isCollectOrWin) {
      events.push({ index: idx++, type: 'pot_award', category: 'playback', street: a.street, player: a.player, actionType: a.type, amount: a.amount, label });
    } else {
      if (['call', 'bet', 'raise', 'allin'].includes(a.type)) streetHadChips = true;
      events.push({ index: idx++, type: 'action', category: 'playback', street: a.street, player: a.player, actionType: a.type, amount: a.amount, label });
    }
  }

  // Handle any remaining board cards
  if (hand.board.flop.length > 0 && !streetsSeen.has('flop')) insertDeal('flop');
  if (hand.board.turn && !streetsSeen.has('turn')) insertDeal('turn');
  if (hand.board.river && !streetsSeen.has('river')) insertDeal('river');

  // Ensure any remaining street bets are collected before showdown reveals
  if (streetHadChips) {
    events.push({ index: idx++, type: 'collect_chips', category: 'playback', street: currentStreet, label: 'Chips collected to pot' });
    streetHadChips = false;
  }

  // Insert showdown reveals for players with showdownCards that don't already have show/muck events
  // Respect per-player revealMode: do_not_reveal players get no reveal event
  const playersWithShowdown = hand.players.filter(p => p.showdownCards && p.showdownCards.length >= 2 && p.revealMode !== 'do_not_reveal');
  const existingRevealPlayers = new Set(events.filter(e => e.type === 'showdown_reveal').map(e => e.player));
  for (const p of playersWithShowdown) {
    if (!existingRevealPlayers.has(p.name)) {
      const action = p.showdownAction ?? 'show';
      const cards = p.showdownCards!;
      events.push({
        index: idx++, type: 'showdown_reveal', category: 'playback', street: 'showdown',
        player: p.name, actionType: action, cards,
        label: action === 'muck' ? `${shortName(p.name)} mucks [${cards.join(' ')}]` : `${shortName(p.name)} shows [${cards.join(' ')}]`,
      });
    }
  }

  const hasPotAward = events.some(e => e.type === 'pot_award');
  if (!hasPotAward && hand.winners.length > 0) {
    for (const w of hand.winners) {
      events.push({ index: idx++, type: 'pot_award', category: 'playback', street: 'showdown', player: w.player, amount: w.amount, label: `${shortName(w.player)} wins ${w.amount.toLocaleString()}` });
    }
  }

  events.push({ index: idx++, type: 'hand_complete', category: 'playback', street: 'showdown', label: 'Hand complete' });

  return events;
}

// ── Get the index of the first playback event (after setup) ──

export function getFirstPlaybackIndex(events: ReplayEvent[]): number {
  for (const e of events) {
    if (e.category === 'playback') return e.index;
  }
  return -1;
}

// ── Get all setup events (for display in action log) ──

export function getSetupEvents(events: ReplayEvent[]): ReplayEvent[] {
  return events.filter(e => e.category === 'setup' && e.type !== 'hand_start');
}

// ── Get playback events only (for step navigation) ──

export function getPlaybackEvents(events: ReplayEvent[]): ReplayEvent[] {
  return events.filter(e => e.category === 'playback');
}

function makeActionLabel(a: { type: ActionType; amount?: number; player: string; street: string }): string {
  const name = shortName(a.player);
  const amt = a.amount != null ? a.amount.toLocaleString() : '';
  switch (a.type) {
    case 'fold': return `${name} folds`;
    case 'check': return `${name} checks`;
    case 'call': return `${name} calls ${amt}`;
    case 'bet': return `${name} bets ${amt}`;
    case 'raise': return `${name} raises to ${amt}`;
    case 'allin': return `${name} is all-in for ${amt}`;
    case 'post_sb': return `${name} posts small blind ${amt}`;
    case 'post_bb': return `${name} posts big blind ${amt}`;
    case 'post_ante': return `${name} posts ante ${amt}`;
    case 'show': return `${name} shows`;
    case 'muck': return `${name} mucks`;
    case 'collect': case 'win': return `${name} wins ${amt}`;
    case 'uncalled_return': return `Uncalled bet (${amt}) returned to ${name}`;
    default: return `${name} ${a.type}`;
  }
}

function shortName(name: string): string {
  if (/^[a-f0-9]{6,}$/i.test(name)) return name.slice(0, 6);
  return name;
}

// ── Compute replay state from events[0..upToIndex] ──
//
// CRITICAL: The hand_start setup event is always applied and posts blinds/antes.
// ALL playback events (actions, deals, etc.) are applied
// ONLY if their index <= upToIndex. This ensures:
//   - On load (upToIndex = -1): table shows players, stacks, cards, blinds/antes already posted
//   - Click 1: first voluntary action appears
//   - Click 2+: subsequent actions appear one at a time
//   - No future events affect current visual state

export function computeReplayState(hand: NormalizedHand, events: ReplayEvent[], upToIndex: number): ReplayState {
  // Initialize all players in their starting state — no folds, no blinds, full stacks
  const players: PlayerState[] = hand.players.map(p => ({
    name: p.name, seat: p.seat, isHero: p.isHero, position: p.position,
    startingStack: p.stack, currentStack: p.stack,
    committedThisStreet: 0, committedTotal: 0,
    folded: false, allIn: false,
    holeCards: p.holeCards, cardsRevealed: false,
    mucked: false, showdownCards: p.showdownCards,
    isWinner: false, winAmount: 0,
  }));

  // Per-player reveal mode from the normalized hand
  const revealModes: Record<string, RevealMode> = {};
  for (const p of hand.players) {
    if (p.revealMode) revealModes[p.name] = p.revealMode;
  }

  // For show_from_start: reveal known hole cards immediately
  for (const p of players) {
    const mode = revealModes[p.name];
    if (mode === 'show_from_start' && p.holeCards && p.holeCards.length >= 2) {
      p.cardsRevealed = true;
    }
  }

  let board: string[] = [];
  let streetsDealt = 0;
  let centralPot = 0;
  let currentStreet: Street = 'preflop';
  let isShowdown = false;
  let isComplete = false;
  let allInReveal = false;
  const winners: { player: string; amount: number }[] = [];

  const streetCommitted: Record<string, number> = {};
  const streetBets: Record<string, number> = {};
  let highestBetThisStreet = 0;

  // Store blind posts from the normalized hand actions for the post_blinds event
  const blindPosts = hand.actions.filter(a => ['post_sb', 'post_bb', 'post_ante'].includes(a.type));

  const sumStreetBets = () => Object.values(streetBets).reduce((a, b) => a + b, 0);
  const totalPot = () => centralPot + sumStreetBets();

  const mergeStreetBets = () => {
    centralPot += sumStreetBets();
    for (const k of Object.keys(streetBets)) streetBets[k] = 0;
  };

  const makeCtx = (): ApplyContext => ({
    getPot: () => totalPot(),
    setPot: () => {},
    getCentralPot: () => centralPot,
    setCentralPot: (v: number) => { centralPot = v; },
    getStreetBets: () => streetBets,
    addStreetBet: (name: string, amt: number) => { streetBets[name] = (streetBets[name] ?? 0) + amt; },
    subStreetBet: (name: string, amt: number) => {
      const cur = streetBets[name] ?? 0;
      if (amt <= cur) { streetBets[name] = cur - amt; }
      else { streetBets[name] = 0; centralPot -= (amt - cur); centralPot = Math.max(0, centralPot); }
    },
    mergeStreetBets,
    getHighestBet: () => highestBetThisStreet,
    setHighestBet: (v: number) => { highestBetThisStreet = v; },
    getBoard: () => board,
    setBoard: (v: string[]) => { board = v; },
    getStreetsDealt: () => streetsDealt,
    setStreetsDealt: (v: number) => { streetsDealt = v; },
    getCurrentStreet: () => currentStreet,
    setCurrentStreet: (v: Street) => { currentStreet = v; },
    setIsShowdown: (v: boolean) => { isShowdown = v; },
    setIsComplete: (v: boolean) => { isComplete = v; },
    setAllInReveal: (v: boolean) => { allInReveal = v; },
    addWinner: (w: { player: string; amount: number }) => { winners.push(w); },
    resetStreet: () => resetStreet(players, streetCommitted),
    checkAllInReveal: () => checkAllInReveal(players),
  });

  // Phase 1: Apply ONLY the hand_start setup event (shows initial table state)
  for (const e of events) {
    if (e.type !== 'hand_start') continue;
    applyEvent(e, players, streetCommitted, makeCtx(), blindPosts, revealModes);
  }

  // Phase 2: Apply playback events up to and including upToIndex
  for (const e of events) {
    if (e.category !== 'playback') continue;
    if (e.index > upToIndex) break;
    applyEvent(e, players, streetCommitted, makeCtx(), blindPosts, revealModes);
  }

  if (allInReveal) {
    for (const p of players) {
      if (!p.folded && p.allIn && p.holeCards && p.holeCards.length >= 2) {
        p.cardsRevealed = true;
      }
    }
  }

  const currentEvent = upToIndex >= 0 && upToIndex < events.length ? events[upToIndex] : null;
  const displayEvent = currentEvent && currentEvent.category === 'playback' ? currentEvent : null;

  return {
    street: currentStreet, board, streetsDealt,
    pot: totalPot(), centralPot, currentStreetBets: { ...streetBets }, players,
    currentEvent: displayEvent, isShowdown, isComplete, allInReveal, winners,
    setupComplete: true,
  };
}

interface ApplyContext {
  getPot: () => number;
  setPot: (v: number) => void;
  getCentralPot: () => number;
  setCentralPot: (v: number) => void;
  getStreetBets: () => Record<string, number>;
  addStreetBet: (name: string, amt: number) => void;
  subStreetBet: (name: string, amt: number) => void;
  mergeStreetBets: () => void;
  getHighestBet: () => number;
  setHighestBet: (v: number) => void;
  getBoard: () => string[];
  setBoard: (v: string[]) => void;
  getStreetsDealt: () => number;
  setStreetsDealt: (v: number) => void;
  getCurrentStreet: () => Street;
  setCurrentStreet: (v: Street) => void;
  setIsShowdown: (v: boolean) => void;
  setIsComplete: (v: boolean) => void;
  setAllInReveal: (v: boolean) => void;
  addWinner: (w: { player: string; amount: number }) => void;
  resetStreet: () => void;
  checkAllInReveal: () => boolean;
}

function applyEvent(
  e: ReplayEvent,
  players: PlayerState[],
  streetCommitted: Record<string, number>,
  ctx: ApplyContext,
  blindPosts: { type: ActionType; player: string; amount?: number }[],
  revealModes: Record<string, RevealMode> = {},
) {
  switch (e.type) {
    case 'hand_start': {
      // At the initial hand state, antes are collected into the central pot
      // and SB/BB are posted as live street bets in front of their players.
      // This ensures the table shows blinds/antes immediately on load,
      // before any voluntary action.
      for (const bp of blindPosts) {
        const player = players.find(p => p.name === bp.player);
        if (!player || bp.amount == null) continue;
        if (player.startingStack > 0) {
          player.currentStack = Math.max(0, player.currentStack - bp.amount);
        }
        player.committedTotal += bp.amount;
        if (bp.type === 'post_ante') {
          // Antes go directly to the central pot — no per-player chip pile
          ctx.setCentralPot(ctx.getCentralPot() + bp.amount);
        } else {
          // SB/BB are live street bets shown in front of the player
          player.committedThisStreet += bp.amount;
          streetCommitted[player.name] = (streetCommitted[player.name] ?? 0) + bp.amount;
          ctx.addStreetBet(player.name, bp.amount);
          if (bp.amount > ctx.getHighestBet()) ctx.setHighestBet(bp.amount);
        }
      }
      break;
    }

    case 'post_blinds': {
      // All blind/ante posts are already applied during hand_start.
      // This playback event is a no-op — it exists only for the action log.
      break;
    }

    case 'action': {
      const player = players.find(p => p.name === e.player);
      if (!player || player.folded) break;
      const amt = e.amount ?? 0;
      switch (e.actionType) {
        case 'fold': player.folded = true; break;
        case 'check': break;
        case 'call': {
          const owed = Math.max(0, ctx.getHighestBet() - (streetCommitted[player.name] ?? 0));
          const actualAmt = player.startingStack > 0 ? Math.min(owed, player.currentStack) : owed;
          player.currentStack = Math.max(0, player.currentStack - actualAmt);
          player.committedThisStreet += actualAmt;
          player.committedTotal += actualAmt;
          streetCommitted[player.name] = (streetCommitted[player.name] ?? 0) + actualAmt;
          ctx.addStreetBet(player.name, actualAmt);
          if (player.startingStack > 0 && player.currentStack === 0) player.allIn = true;
          break;
        }
        case 'bet': {
          const actualAmt = player.startingStack > 0 ? Math.min(amt, player.currentStack) : amt;
          player.currentStack = Math.max(0, player.currentStack - actualAmt);
          player.committedThisStreet += actualAmt;
          player.committedTotal += actualAmt;
          streetCommitted[player.name] = (streetCommitted[player.name] ?? 0) + actualAmt;
          ctx.addStreetBet(player.name, actualAmt);
          ctx.setHighestBet(amt);
          if (player.startingStack > 0 && player.currentStack === 0) player.allIn = true;
          break;
        }
        case 'raise': {
          const raiseTo = amt;
          const incremental = Math.max(0, raiseTo - (streetCommitted[player.name] ?? 0));
          const actualAmt = player.startingStack > 0 ? Math.min(incremental, player.currentStack) : incremental;
          player.currentStack = Math.max(0, player.currentStack - actualAmt);
          player.committedThisStreet += actualAmt;
          player.committedTotal += actualAmt;
          streetCommitted[player.name] = (streetCommitted[player.name] ?? 0) + actualAmt;
          ctx.addStreetBet(player.name, actualAmt);
          ctx.setHighestBet(raiseTo);
          if (player.startingStack > 0 && player.currentStack === 0) player.allIn = true;
          break;
        }
        case 'allin': {
          const actualAmt = player.startingStack > 0 ? Math.min(amt, player.currentStack) : amt;
          player.currentStack = Math.max(0, player.currentStack - actualAmt);
          player.committedThisStreet += actualAmt;
          player.committedTotal += actualAmt;
          streetCommitted[player.name] = (streetCommitted[player.name] ?? 0) + actualAmt;
          ctx.addStreetBet(player.name, actualAmt);
          if (amt > ctx.getHighestBet()) ctx.setHighestBet(amt);
          player.allIn = true;
          break;
        }
      }
      ctx.setAllInReveal(ctx.checkAllInReveal());
      break;
    }

    case 'collect_chips': {
      ctx.mergeStreetBets();
      ctx.resetStreet();
      ctx.setHighestBet(0);
      break;
    }

    case 'deal_flop': {
      ctx.mergeStreetBets();
      ctx.resetStreet();
      ctx.setHighestBet(0);
      ctx.setCurrentStreet('flop');
      ctx.setBoard(e.cards ?? []);
      ctx.setStreetsDealt(1);
      break;
    }

    case 'deal_turn': {
      ctx.mergeStreetBets();
      ctx.resetStreet();
      ctx.setHighestBet(0);
      ctx.setCurrentStreet('turn');
      if (e.cards && e.cards.length > 0) {
        ctx.setBoard([...ctx.getBoard(), ...e.cards]);
      }
      ctx.setStreetsDealt(2);
      break;
    }

    case 'deal_river': {
      ctx.mergeStreetBets();
      ctx.resetStreet();
      ctx.setHighestBet(0);
      ctx.setCurrentStreet('river');
      if (e.cards && e.cards.length > 0) {
        ctx.setBoard([...ctx.getBoard(), ...e.cards]);
      }
      ctx.setStreetsDealt(3);
      break;
    }

    case 'showdown_reveal': {
      ctx.setIsShowdown(true);
      const player = players.find(p => p.name === e.player);
      if (player) {
        const mode = revealModes[player.name];
        // do_not_reveal: never reveal, skip entirely
        if (mode === 'do_not_reveal') break;
        if (e.actionType === 'muck') {
          player.mucked = true;
          if (e.cards && e.cards.length >= 2) {
            player.showdownCards = e.cards;
          }
        } else {
          if (e.cards && e.cards.length >= 2) {
            player.showdownCards = e.cards;
            player.holeCards = e.cards;
          }
          player.cardsRevealed = true;
        }
      }
      break;
    }

    case 'uncalled_return': {
      const player = players.find(p => p.name === e.player);
      if (player && e.amount != null) {
        player.currentStack += e.amount;
        ctx.subStreetBet(player.name, e.amount);
      }
      break;
    }

    case 'pot_award': {
      ctx.mergeStreetBets();
      ctx.resetStreet();
      ctx.setHighestBet(0);
      const player = players.find(p => p.name === e.player);
      if (player && e.amount != null) {
        player.currentStack += e.amount;
        player.isWinner = true;
        player.winAmount = e.amount;
        ctx.setCentralPot(Math.max(0, ctx.getCentralPot() - e.amount));
        ctx.addWinner({ player: player.name, amount: e.amount });
      }
      break;
    }

    case 'hand_complete': {
      ctx.setIsComplete(true);
      break;
    }
  }
}

function resetStreet(players: PlayerState[], streetCommitted: Record<string, number>) {
  for (const p of players) p.committedThisStreet = 0;
  for (const name of Object.keys(streetCommitted)) streetCommitted[name] = 0;
}

function checkAllInReveal(players: PlayerState[]): boolean {
  const remaining = players.filter(p => !p.folded);
  if (remaining.length < 2) return false;
  return remaining.every(p => p.allIn);
}
