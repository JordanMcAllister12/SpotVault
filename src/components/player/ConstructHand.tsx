import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  X, Plus, Check, Spade, Heart, Diamond, Club, Copy, Play, Loader2,
  Trash2, Eye, EyeOff, ChevronRight, Undo2, Redo2,
} from 'lucide-react';
import {
  positionsForTable, CARD_RANKS, CARD_SUITS,
  SUIT_COLORS, SUIT_SYMBOLS,
  cardLabel, generateHandId,
} from '@/lib/poker/builderTypes';
import { builderStateToNormalizedHand } from '@/lib/poker/builderConvert';
import {
  createInitialState, applyAction, setBoard as setEngineBoard,
  setHeroCards as setEngineHeroCards, setVillainCards as setEngineVillainCards,
  undoLastAction as engineUndoLastAction,
} from '@/lib/poker/builderEngine';
import type { TableSetup, BuilderActionType, BuilderBoard, BuilderState } from '@/lib/poker/builderTypes';
import type { Street, NormalizedHand } from '@/features/hh-replayer/types';
import { saveManualHand, manualHandUrl } from '@/lib/manualHandStore';

const GOLD = '#d4a52c';
const GOLD_DIM = 'rgba(212,165,44,0.35)';
const BORDER = 'rgba(212,165,44,0.18)';
const CARD_BG = 'rgba(13,15,18,0.92)';
const SECTION_BG = 'rgba(8,10,12,0.75)';

function generateDefaultTitle(hand: NormalizedHand): string {
  const hero = hand.players.find(p => p.isHero);
  const heroCards = hero?.holeCards?.join('') ?? '';
  const heroPos = hero?.position ?? '';
  const villain = hand.players.find(p => !p.isHero);
  const villainPos = villain?.position ?? '';
  const parts: string[] = [];
  if (heroCards) parts.push(heroCards);
  if (heroPos && villainPos) parts.push(`${heroPos} vs ${villainPos}`);
  if (parts.length === 0) return 'Constructed Hand';
  return `${parts.join(' — ')} — Built Hand`;
}

const SUIT_ICONS: Record<string, typeof Spade> = {
  s: Spade, h: Heart, d: Diamond, c: Club,
};

const SUIT_IS_RED: Record<string, boolean> = { s: false, h: true, d: true, c: false };

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9];

type CardPickerTarget = 'hero' | 'flop' | 'turn' | 'river' | `villain:${string}` | null;

interface VillainConfig {
  id: string;
  position: string;
  stack: number;
  stackMode: 'bb' | 'chips';
  cardsKnown: boolean;
  cards: string[];
  revealMode: 'show_from_start' | 'reveal_at_showdown' | 'do_not_reveal';
}

let villainCounter = 0;
function newVillainId() { return `v_${++villainCounter}`; }

interface Props {
  onSave?: (hand: NormalizedHand) => void;
  onCancel: () => void;
  onWatch?: (hand: NormalizedHand) => void;
}

interface SavedHandInfo {
  handId: string;
  url: string;
}

function normalizeCardArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((c): c is string => typeof c === 'string');
  return [];
}

// ── Component ──

export function ConstructHand({ onSave, onCancel, onWatch }: Props) {
  const [tableSize, setTableSize] = useState(8);
  const [constructionMode, setConstructionMode] = useState<'simplified' | 'full'>('simplified');
  const [heroPosition, setHeroPosition] = useState('HJ');
  const [heroCards, setHeroCards] = useState<string[]>([]);
  const [heroStack, setHeroStack] = useState(100);
  const [stackMode, setStackMode] = useState<'bb' | 'chips'>('bb');
  const [smallBlind, setSmallBlind] = useState<number | null>(null);
  const [bigBlind, setBigBlind] = useState<number | null>(null);
  const [ante, setAnte] = useState<number | null>(null);
  const [anteType, setAnteType] = useState<'per_player' | 'bb_ante'>('per_player');
  const [villains, setVillains] = useState<VillainConfig[]>([]);
  const [cardPicker, setCardPicker] = useState<{ target: CardPickerTarget; max: number } | null>(null);
  const [handNumber] = useState(() => Math.floor(Math.random() * 9000) + 1000);
  const [saving, setSaving] = useState(false);
  const [savedInfo, setSavedInfo] = useState<SavedHandInfo | null>(null);
  const [savedHand, setSavedHand] = useState<NormalizedHand | null>(null);
  const [handTitle, setHandTitle] = useState('');
  const [copiedField, setCopiedField] = useState<'id' | 'link' | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Builder engine state
  const [builderState, setBuilderState] = useState<BuilderState | null>(null);
  const [preflopStarted, setPreflopStarted] = useState(false);
  const [sawFlop, setSawFlop] = useState<boolean | null>(null);
  const [flopCards, setFlopCards] = useState<string[]>([]);
  const [turnCard, setTurnCard] = useState<string | null>(null);
  const [riverCard, setRiverCard] = useState<string | null>(null);

  // Pending action state
  const [pendingAction, setPendingAction] = useState<BuilderActionType | null>(null);
  const [pendingSize, setPendingSize] = useState<number | null>(null);
  const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(null);
  const [editingAmount, setEditingAmount] = useState<number | null>(null);

  type ConstructorSnapshot = {
    builderState: BuilderState | null;
    preflopStarted: boolean;
    sawFlop: boolean | null;
    flopCards: string[];
    turnCard: string | null;
    riverCard: string | null;
  };
  const pastSnapshotsRef = useRef<ConstructorSnapshot[]>([]);
  const futureSnapshotsRef = useRef<ConstructorSnapshot[]>([]);
  const [, setHistoryVersion] = useState(0);

  const getSnapshot = useCallback((): ConstructorSnapshot => ({
    builderState,
    preflopStarted,
    sawFlop,
    flopCards: [...flopCards],
    turnCard,
    riverCard,
  }), [builderState, preflopStarted, sawFlop, flopCards, turnCard, riverCard]);

  const recordSnapshot = useCallback(() => {
    pastSnapshotsRef.current = [...pastSnapshotsRef.current, getSnapshot()];
    futureSnapshotsRef.current = [];
    setHistoryVersion(version => version + 1);
  }, [getSnapshot]);

  const restoreSnapshot = useCallback((snapshot: ConstructorSnapshot) => {
    setBuilderState(snapshot.builderState);
    setPreflopStarted(snapshot.preflopStarted);
    setSawFlop(snapshot.sawFlop);
    setFlopCards(snapshot.flopCards);
    setTurnCard(snapshot.turnCard);
    setRiverCard(snapshot.riverCard);
    setPendingAction(null);
    setPendingSize(null);
  }, []);

  const handleRedo = useCallback(() => {
    const snapshot = futureSnapshotsRef.current.pop();
    if (!snapshot) return;
    pastSnapshotsRef.current = [...pastSnapshotsRef.current, getSnapshot()];
    restoreSnapshot(snapshot);
    setHistoryVersion(version => version + 1);
  }, [getSnapshot, restoreSnapshot]);

  // Scroll container ref
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeSectionRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const availablePositions = useMemo(() => positionsForTable(tableSize), [tableSize]);

  const usedPositions = useMemo(() => {
    const used = new Set<string>([heroPosition]);
    villains.forEach(v => used.add(v.position));
    return used;
  }, [heroPosition, villains]);

  const remainingVillainPositions = useMemo(() =>
    availablePositions.filter(p => !usedPositions.has(p)),
  [availablePositions, usedPositions]);

  const allUsedCards = useMemo(() => {
    const used = new Set<string>();
    normalizeCardArray(heroCards).forEach(c => used.add(c));
    normalizeCardArray(flopCards).forEach(c => used.add(c));
    if (turnCard) used.add(turnCard);
    if (riverCard) used.add(riverCard);
    villains.forEach(v => normalizeCardArray(v.cards).forEach(c => used.add(c)));
    return used;
  }, [heroCards, flopCards, turnCard, riverCard, villains]);

  const stackUnit = stackMode === 'bb' ? 'BB' : '';

  const heroCardLabel = useMemo(() => {
    const cards = normalizeCardArray(heroCards);
    if (cards.length === 0) return '—';
    return cards.map(cardLabel).join(' ');
  }, [heroCards]);

  // ── Check if user has entered meaningful work ──
  const hasUnsavedWork = useMemo(() => {
    return normalizeCardArray(heroCards).length > 0 ||
      villains.some(v => v.cardsKnown && normalizeCardArray(v.cards).length > 0) ||
      builderState !== null ||
      normalizeCardArray(flopCards).length > 0 ||
      turnCard !== null ||
      riverCard !== null;
  }, [heroCards, villains, builderState, flopCards, turnCard, riverCard]);

  // ── Auto-scroll to active section on progress changes ──
  // Fires only when builder state changes (new action, street transition, card pick),
  // never on manual scroll — so user scrolling to review earlier actions is never fought.
  useEffect(() => {
    if (!activeSectionRef.current || !scrollRef.current) return;
    const container = scrollRef.current;
    const el = activeSectionRef.current;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elOffset = elRect.top - containerRect.top + container.scrollTop;
    // Position active section at ~35% from top — keeps context above, room for controls below
    const targetTop = elOffset - Math.round(container.clientHeight * 0.35);
    isAutoScrollingRef.current = true;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
    autoScrollTimeoutRef.current = setTimeout(() => { isAutoScrollingRef.current = false; }, 700);
    return () => { if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current); };
  }, [builderState, pendingAction, cardPicker, flopCards, turnCard, riverCard, sawFlop, preflopStarted]);

  // ── Initialize builder state ──
  const initBuilder = useCallback(() => {
    const sb = smallBlind ?? 0.5;
    const bb = bigBlind ?? 1;
    const anteVal = ante ?? 0;

    const setup: TableSetup = {
      seatCount: tableSize,
      smallBlind: sb,
      bigBlind: bb,
      ante: anteVal,
      anteType: anteVal > 0 ? anteType : 'none',
      gameFormat: 'cash',
      blindLevel: '',
      heroPosition,
      source: 'scenario',
      stackMode,
      players: (constructionMode === 'full'
        ? availablePositions
        : Array.from(new Set([
            heroPosition,
            ...villains.map(v => v.position),
            'SB',
            'BB',
          ])).filter(pos => availablePositions.includes(pos))
      ).map((pos, i) => {
        const villain = villains.find(v => v.position === pos);
        return {
          seat: availablePositions.indexOf(pos) + 1 || i + 1,
          name: pos === heroPosition ? 'Hero' : villain ? `Opponent ${i}` : pos,
          position: pos,
          stack: pos === heroPosition ? heroStack : villain?.stack ?? heroStack,
          stackChips: pos === heroPosition
            ? (stackMode === 'bb' ? heroStack * bb : heroStack)
            : villain
              ? (villain.stackMode === 'bb' ? villain.stack * bb : villain.stack)
              : (stackMode === 'bb' ? heroStack * bb : heroStack),
          isHero: pos === heroPosition,
          holeCards: pos === heroPosition && normalizeCardArray(heroCards).length === 2 ? normalizeCardArray(heroCards) : null,
        };
      }),
      constructionMode,
      autoFoldPositions: constructionMode === 'simplified'
        ? ['SB', 'BB'].filter(pos => pos !== heroPosition && !villains.some(v => v.position === pos))
        : [],
    };

    let state = createInitialState(setup);
    const normHero = normalizeCardArray(heroCards);
    if (normHero.length === 2) {
      state = setEngineHeroCards(state, normHero);
    }
    for (const v of villains) {
      const vCards = normalizeCardArray(v.cards);
      if (v.cardsKnown && vCards.length === 2) {
        const playerName = setup.players.find(p => p.position === v.position)?.name;
        if (playerName) state = setEngineVillainCards(state, playerName, vCards);
      }
    }
    setBuilderState(state);
    setPreflopStarted(true);
  }, [tableSize, smallBlind, bigBlind, ante, anteType, heroPosition, availablePositions, villains, heroCards, heroStack, stackMode, constructionMode]);

  // ── Action handling ──
  const handleActionClick = (action: BuilderActionType) => {
    if (!builderState) return;
    const needsSize = action === 'bet' || action === 'raise';
    if (needsSize) {
      setPendingAction(action);
      const bb = builderState.setup.bigBlind;
      const chipsDefault = action === 'bet' ? Math.max(bb * 3, 3) : (builderState.currentStreetBet + bb * 3);
      const displayDefault = stackMode === 'bb' ? Math.round((chipsDefault / bb) * 10) / 10 : Math.round(chipsDefault);
      setPendingSize(displayDefault);
    } else {
      // Direct action (fold, check, call, allin)
      confirmAction(action, undefined);
    }
  };

  const confirmAction = (action: BuilderActionType, size?: number) => {
    if (!builderState) return;
    recordSnapshot();
    const bb = builderState.setup.bigBlind;
    const amount = size !== undefined ? (stackMode === 'bb' ? size * bb : size) : undefined;
    const newState = applyAction(builderState, action, amount);
    setBuilderState(newState);
    setPendingAction(null);
    setPendingSize(null);
  };

  const cancelPendingAction = () => {
    setPendingAction(null);
    setPendingSize(null);
  };

  // ── Undo last action (Back button) ──
  const handleUndo = useCallback(() => {
    const snapshot = pastSnapshotsRef.current.pop();
    if (!snapshot) return;
    futureSnapshotsRef.current = [...futureSnapshotsRef.current, getSnapshot()];
    restoreSnapshot(snapshot);
    setHistoryVersion(version => version + 1);
  }, [getSnapshot, restoreSnapshot]);

  // ── Undo to a specific action index (for editing previous rows) ──
  const undoToAction = useCallback((actionIndex: number) => {
    if (!builderState) return;
    let state = builderState;
    while (state.actions.length > actionIndex) {
      state = engineUndoLastAction(state);
    }
    setBuilderState(state);
    setPendingAction(null);
    setPendingSize(null);
    setSelectedActionIndex(null);
    setEditingAmount(null);
  }, [builderState]);

  const removeFromAction = useCallback((actionIndex: number) => {
    recordSnapshot();
    undoToAction(actionIndex);
  }, [recordSnapshot, undoToAction]);

  const updateActionAmount = useCallback((actionIndex: number) => {
    if (!builderState || editingAmount === null) return;
    const action = builderState.actions[actionIndex];
    if (!action || (action.type !== 'bet' && action.type !== 'raise')) return;
    recordSnapshot();
    let state = builderState;
    while (state.actions.length > actionIndex) {
      state = engineUndoLastAction(state);
    }
    const edited = applyAction(state, action.type, editingAmount);
    setBuilderState(edited);
    setSelectedActionIndex(null);
    setEditingAmount(null);
    setPendingAction(null);
    setPendingSize(null);
  }, [builderState, editingAmount, recordSnapshot]);

  // ── Toggle stack display mode mid-hand (converts pending size too) ──
  const handleStackModeToggle = (mode: 'bb' | 'chips') => {
    if (mode === stackMode) return;
    const bb = builderState?.setup.bigBlind ?? 1;
    if (pendingSize !== null) {
      setPendingSize(mode === 'bb' ? Math.round((pendingSize / bb) * 10) / 10 : Math.round(pendingSize * bb));
    }
    setStackMode(mode);
  };

  // ── Format an amount in the current display unit ──
  const formatAmount = (chips: number) => {
    if (stackMode === 'bb') {
      const bb = builderState?.setup.bigBlind ?? 1;
      return `${Math.round((chips / bb) * 100) / 100} BB`;
    }
    return chips.toLocaleString();
  };

  // ── Count raises on current street for 3-bet / 4-bet / 5-bet labels ──
  const streetRaiseCount = useMemo(() => {
    if (!builderState) return 0;
    let count = 0;
    for (const a of builderState.actions) {
      if (a.street !== builderState.street) continue;
      if (a.type === 'bet' || a.type === 'raise') count++;
    }
    return count;
  }, [builderState]);

  // ── Board card handling ──
  const handleSawFlop = (didSee: boolean) => {
    recordSnapshot();
    setSawFlop(didSee);
    if (didSee && !builderState) {
      initBuilder();
    }
    if (didSee) {
      // Open card picker immediately
      setTimeout(() => setCardPicker({ target: 'flop', max: 3 }), 50);
    }
  };

  const handleCardPickerConfirm = () => {
    if (!cardPicker) return;
    const target = cardPicker.target;

    if (target === 'flop' && flopCards.length === 3) {
      if (builderState) {
        recordSnapshot();
        setBuilderState(setEngineBoard(builderState, 'flop', normalizeCardArray(flopCards)));
      }
      setCardPicker(null);
    } else if (target === 'turn' && turnCard) {
      if (builderState) {
        recordSnapshot();
        setBuilderState(setEngineBoard(builderState, 'turn', [turnCard]));
      }
      setCardPicker(null);
    } else if (target === 'river' && riverCard) {
      if (builderState) {
        recordSnapshot();
        setBuilderState(setEngineBoard(builderState, 'river', [riverCard]));
      }
      setCardPicker(null);
    } else if (target === 'hero' && heroCards.length === 2) {
      setCardPicker(null);
    } else if (target && target.startsWith('villain:') && cardPicker) {
      setCardPicker(null);
    }
  };

  const handleCardSelect = (card: string) => {
    if (!cardPicker) return;
    const target = cardPicker.target;

    if (target === 'hero') {
      setHeroCards(prev => {
        if (prev.includes(card)) return prev.filter(c => c !== card);
        if (prev.length >= 2) return prev;
        return [...prev, card];
      });
    } else if (target === 'flop') {
      setFlopCards(prev => {
        if (prev.includes(card)) return prev.filter(c => c !== card);
        if (prev.length >= 3) return prev;
        return [...prev, card];
      });
    } else if (target === 'turn') {
      setTurnCard(prev => prev === card ? null : card);
    } else if (target === 'river') {
      setRiverCard(prev => prev === card ? null : card);
    } else if (target && target.startsWith('villain:')) {
      const vid = target.split(':')[1];
      setVillains(prev => prev.map(v => {
        if (v.id !== vid) return v;
        if (v.cards.includes(card)) return { ...v, cards: v.cards.filter(c => c !== card) };
        if (v.cards.length >= 2) return v;
        return { ...v, cards: [...v.cards, card] };
      }));
    }
  };

  const getPickerSelectedCards = (): string[] => {
    if (!cardPicker) return [];
    const t = cardPicker.target;
    if (t === 'hero') return normalizeCardArray(heroCards);
    if (t === 'flop') return normalizeCardArray(flopCards);
    if (t === 'turn') return turnCard ? [turnCard] : [];
    if (t === 'river') return riverCard ? [riverCard] : [];
    if (t && t.startsWith('villain:')) {
      const vid = t.split(':')[1];
      return normalizeCardArray(villains.find(v => v.id === vid)?.cards);
    }
    return [];
  };

  const getPickerUsedCards = (): Set<string> => {
    if (!cardPicker) return new Set();
    const t = cardPicker.target;
    const used = new Set(allUsedCards);
    // Remove currently-selected cards for this target from the "used" set
    // so they show as selected (toggleable) rather than disabled
    const selected = getPickerSelectedCards();
    selected.forEach(c => used.delete(c));
    return used;
  };

  // ── Villain management ──
  const addVillain = (position: string) => {
    setVillains(prev => [...prev, {
      id: newVillainId(), position, stack: heroStack, stackMode,
      cardsKnown: false, cards: [], revealMode: 'reveal_at_showdown',
    }]);
  };

  const removeVillain = (id: string) => {
    setVillains(prev => prev.filter(v => v.id !== id));
  };

  const setVillainPosition = (id: string, position: string) => {
    setVillains(prev => prev.map(v => v.id === id ? { ...v, position } : v));
  };

  const setVillainStack = (id: string, stack: number) => {
    setVillains(prev => prev.map(v => v.id === id ? { ...v, stack } : v));
  };

  const setVillainStackMode = (id: string, mode: 'bb' | 'chips') => {
    setVillains(prev => prev.map(v => {
      if (v.id !== id) return v;
      if (mode === v.stackMode) return v;
      const bb = bigBlind ?? 1;
      const newStack = mode === 'chips'
        ? Math.round(v.stack * bb)
        : Math.round((v.stack / bb) * 100) / 100;
      return { ...v, stackMode: mode, stack: newStack };
    }));
  };

  const setVillainCardsKnown = (id: string, known: boolean) => {
    setVillains(prev => prev.map(v => v.id === id ? { ...v, cardsKnown: known, cards: known ? v.cards : [] } : v));
  };

  const setVillainRevealMode = (id: string, mode: VillainConfig['revealMode']) => {
    setVillains(prev => prev.map(v => v.id === id ? { ...v, revealMode: mode } : v));
  };

  // ── Determine if preflop betting is complete ──
  const preflopComplete = builderState !== null && (builderState.street !== 'preflop' || builderState.isComplete);

  // ── Determine current action context ──
  const currentActorPlayer = builderState?.players.find(p => p.name === builderState.currentActor);
  const currentActorLabel = currentActorPlayer
    ? currentActorPlayer.isHero ? 'HERO' : currentActorPlayer.position
    : null;
  const currentStreetLabel = builderState
    ? builderState.street === 'preflop' ? 'PREFLOP'
    : builderState.street === 'flop' ? 'FLOP'
    : builderState.street === 'turn' ? 'TURN'
    : builderState.street === 'river' ? 'RIVER'
    : 'SHOWDOWN'
    : null;

  // ── Build normalized hand ──
  const buildNormalizedHand = useCallback((): NormalizedHand => {
    if (!builderState) {
      // Build a minimal state even if no actions were taken
      initBuilder();
    }
    const state = builderState ?? createInitialState({
      seatCount: tableSize,
      smallBlind: smallBlind ?? 0.5,
      bigBlind: bigBlind ?? 1,
      ante: ante ?? 0,
      anteType: (ante ?? 0) > 0 ? anteType : 'none',
      gameFormat: 'cash',
      blindLevel: '',
      heroPosition,
      source: 'scenario',
      stackMode,
      players: availablePositions.map((pos, i) => ({
        seat: i + 1,
        name: pos === heroPosition ? 'Hero' : `Opponent ${i}`,
        position: pos,
        stack: pos === heroPosition ? heroStack : villains.find(v => v.position === pos)?.stack ?? heroStack,
        stackChips: pos === heroPosition
          ? (stackMode === 'bb' ? heroStack * (bigBlind ?? 1) : heroStack)
          : (() => {
            const v = villains.find(v => v.position === pos);
            if (v) return v.stackMode === 'bb' ? v.stack * (bigBlind ?? 1) : v.stack;
            return stackMode === 'bb' ? heroStack * (bigBlind ?? 1) : heroStack;
          })(),
        isHero: pos === heroPosition,
        holeCards: pos === heroPosition && normalizeCardArray(heroCards).length === 2 ? normalizeCardArray(heroCards) : null,
      })),
    });

    let finalState = state;
    const normHero = normalizeCardArray(heroCards);
    if (normHero.length === 2) finalState = setEngineHeroCards(finalState, normHero);
    for (const v of villains) {
      const vCards = normalizeCardArray(v.cards);
      if (v.cardsKnown && vCards.length === 2) {
        const playerName = finalState.players.find(p => p.position === v.position)?.name;
        if (playerName) finalState = setEngineVillainCards(finalState, playerName, vCards);
      }
    }

    const handId = generateHandId();
    const normalized = builderStateToNormalizedHand(finalState, handId);

    // Encode per-villain reveal mode and showdownCards into the normalized hand
    for (const v of villains) {
      const playerName = finalState.players.find(p => p.position === v.position)?.name;
      if (!playerName) continue;
      const np = normalized.players.find(p => p.name === playerName);
      if (!np) continue;
      np.revealMode = v.revealMode;
      if (v.cardsKnown && v.cards.length === 2) {
        const normalizedCards = normalizeCardArray(v.cards);
        if (normalizedCards.length === 2) {
          np.showdownCards = normalizedCards;
          if (v.revealMode !== 'do_not_reveal') {
            np.holeCards = normalizedCards;
          }
        }
      }
    }

    return normalized;
  }, [builderState, tableSize, smallBlind, bigBlind, ante, anteType, heroPosition, availablePositions, villains, heroCards, heroStack, stackMode, initBuilder]);

  const handleSave = useCallback(async (watchAfter: boolean) => {
    const hand = buildNormalizedHand();
    const title = handTitle.trim() || generateDefaultTitle(hand);
    hand.title = title;
    setSaving(true);
    const record = await saveManualHand(hand);
    setSaving(false);

    if (record) {
      const url = manualHandUrl(hand.handId);
      setSavedInfo({ handId: hand.handId, url });
      setSavedHand(hand);
    }

    onSave?.(hand);
    if (watchAfter && onWatch) {
      onWatch(hand);
    }
  }, [buildNormalizedHand, onSave, onWatch, handTitle]);

  const handleDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
    onCancel();
  }, [onCancel]);

  const handleCancelClick = useCallback(() => {
    if (hasUnsavedWork) {
      setShowDiscardConfirm(true);
    } else {
      onCancel();
    }
  }, [hasUnsavedWork, onCancel]);

  const handleCopy = (text: string, field: 'id' | 'link') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  // ── Check if can save ──
  const canSave = builderState !== null && (builderState.isComplete || (preflopComplete && sawFlop === false));

  // ── Determine what section to show ──
  const showFlopDecision = preflopComplete && sawFlop === null && !builderState?.isComplete;
  const showActiveAction = builderState !== null && !builderState.isComplete && !cardPicker && (
    builderState.street === 'preflop' ||
    (builderState.street === 'flop' && sawFlop === true && flopCards.length === 3) ||
    (builderState.street === 'turn' && turnCard !== null) ||
    (builderState.street === 'river' && riverCard !== null)
  );
  const showActiveStreetDivider = builderState !== null && (
    (builderState.actions.length > 0 ? builderState.actions[builderState.actions.length - 1].street : 'preflop') !== builderState.street
  );
  const activeRaiseLabel = builderState
    ? (builderState.street === 'preflop' && streetRaiseCount === 0
      ? 'OPEN'
      : builderState.street !== 'preflop' && streetRaiseCount === 0
      ? 'BET'
      : streetRaiseCount === 1 ? 'RAISE'
      : streetRaiseCount === 2 ? '3-BET'
      : streetRaiseCount === 3 ? '4-BET'
      : streetRaiseCount === 4 ? '5-BET'
      : 'RAISE')
    : 'RAISE';
  const activeLabels: Record<BuilderActionType, string> = {
    fold: 'FOLD', check: 'CHECK', call: 'CALL', bet: 'BET', raise: activeRaiseLabel, allin: 'JAM',
  };

  // When a street transitions and needs a board card, auto-open picker
  useEffect(() => {
    if (!builderState || builderState.isComplete || cardPicker) return;
    if (builderState.street === 'flop' && flopCards.length < 3 && sawFlop === true) {
      setCardPicker({ target: 'flop', max: 3 });
    } else if (builderState.street === 'turn' && !turnCard) {
      setCardPicker({ target: 'turn', max: 1 });
    } else if (builderState.street === 'river' && !riverCard) {
      setCardPicker({ target: 'river', max: 1 });
    }
  }, [builderState?.street, flopCards.length, turnCard, riverCard, sawFlop, cardPicker, builderState]);

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="flex w-full max-w-[1100px] max-h-[94vh] flex-col overflow-hidden rounded-2xl border" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.98)' }}>
        {/* ── HEADER ── */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ background: 'rgba(8,10,12,0.98)', borderColor: BORDER }}>
          <button onClick={handleCancelClick} className="flex items-center gap-1 text-[12px] font-semibold text-white/50 hover:text-white/80">
            <X className="h-4 w-4" /> Cancel
          </button>
          <div className="text-center">
            <div className="text-[13px] font-bold text-white">Construct a Hand</div>
            <div className="text-[10px] text-white/40">#{handNumber} · {heroPosition} · {heroCardLabel}</div>
          </div>
          <div className="w-16" />
        </div>

        {savedInfo ? (
          <SavedConfirmation
            info={savedInfo}
            copiedField={copiedField}
            onCopy={handleCopy}
            onWatch={() => { if (savedHand && onWatch) { setSavedInfo(null); onWatch(savedHand); } }}
            onNew={() => { setSavedInfo(null); setSavedHand(null); resetAll(); }}
            onClose={onCancel}
          />
        ) : (
        <>
        <div ref={scrollRef} className="build-hand-scrollbar relative flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:p-5">

          {/* ── PLAYER COUNT ── */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Players</div>
              <div className="flex items-center gap-1 rounded-lg border border-white/10 p-0.5">
                <button
                  onClick={() => !builderState && setConstructionMode('simplified')}
                  disabled={builderState !== null}
                  className="rounded-md px-2 py-1 text-[8px] font-bold uppercase tracking-wider transition disabled:opacity-30"
                  style={{ background: constructionMode === 'simplified' ? 'rgba(201,162,39,0.18)' : 'transparent', color: constructionMode === 'simplified' ? '#f5e6b0' : 'rgba(255,255,255,0.4)' }}
                >
                  Simplified
                </button>
                <button
                  onClick={() => !builderState && setConstructionMode('full')}
                  disabled={builderState !== null}
                  className="rounded-md px-2 py-1 text-[8px] font-bold uppercase tracking-wider transition disabled:opacity-30"
                  style={{ background: constructionMode === 'full' ? 'rgba(201,162,39,0.18)' : 'transparent', color: constructionMode === 'full' ? '#f5e6b0' : 'rgba(255,255,255,0.4)' }}
                >
                  Full Table
                </button>
              </div>
            </div>
            <div className="mb-2 text-[9px] text-white/30">
              {constructionMode === 'simplified' ? 'Only Hero, configured Villains, and blinds participate.' : 'All seats remain available for recorded actions.'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TABLE_SIZES.map(n => (
                <button
                  key={n}
                  onClick={() => {
                    if (builderState) return;
                    const positions = positionsForTable(n);
                    setTableSize(n);
                    setHeroPosition(positions.includes(heroPosition) ? heroPosition : positions[Math.floor(positions.length / 2)]);
                    setVillains([]);
                  }}
                  disabled={builderState !== null}
                  className="rounded-lg px-3 py-2 text-[11px] font-bold transition disabled:opacity-30"
                  style={{
                    background: tableSize === n ? 'rgba(201,162,39,0.18)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${tableSize === n ? GOLD_DIM : 'rgba(255,255,255,0.08)'}`,
                    color: tableSize === n ? '#f5e6b0' : 'rgba(255,255,255,0.55)',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* ── BLINDS / ANTE ── */}
          <div className="rounded-xl border p-3 sm:p-4" style={{ borderColor: 'rgba(255,255,255,0.08)', background: SECTION_BG }}>
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-white/50">Blinds / Ante</div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/40">Small Blind</label>
                <input type="number" placeholder="—" value={smallBlind ?? ''} disabled={builderState !== null}
                  onChange={e => setSmallBlind(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-20 rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-[12px] font-semibold text-white/80 outline-none focus:border-[#d4a52c]/40 disabled:opacity-40" />
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/40">Big Blind</label>
                <input type="number" placeholder="—" value={bigBlind ?? ''} disabled={builderState !== null}
                  onChange={e => setBigBlind(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-20 rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-[12px] font-semibold text-white/80 outline-none focus:border-[#d4a52c]/40 disabled:opacity-40" />
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/40">Ante</label>
                <input type="number" placeholder="—" value={ante ?? ''} disabled={builderState !== null}
                  onChange={e => setAnte(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-20 rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-[12px] font-semibold text-white/80 outline-none focus:border-[#d4a52c]/40 disabled:opacity-40" />
              </div>
              <div className="flex gap-1">
                <button onClick={() => setAnteType('per_player')} disabled={builderState !== null}
                  className="rounded-lg px-2.5 py-2 text-[9px] font-bold uppercase transition disabled:opacity-30"
                  style={{ background: anteType === 'per_player' ? 'rgba(201,162,39,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${anteType === 'per_player' ? GOLD_DIM : 'rgba(255,255,255,0.08)'}`, color: anteType === 'per_player' ? '#f5e6b0' : 'rgba(255,255,255,0.45)' }}>
                  Per Player
                </button>
                <button onClick={() => setAnteType('bb_ante')} disabled={builderState !== null}
                  className="rounded-lg px-2.5 py-2 text-[9px] font-bold uppercase transition disabled:opacity-30"
                  style={{ background: anteType === 'bb_ante' ? 'rgba(201,162,39,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${anteType === 'bb_ante' ? GOLD_DIM : 'rgba(255,255,255,0.08)'}`, color: anteType === 'bb_ante' ? '#f5e6b0' : 'rgba(255,255,255,0.45)' }}>
                  BB Ante
                </button>
              </div>
            </div>
          </div>

          {/* ── HERO SETUP ── */}
          <div className="rounded-xl border p-3 sm:p-4" style={{ borderColor: BORDER, background: CARD_BG }}>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: GOLD }}>HERO</span>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {availablePositions.map(pos => (
                <button key={pos} disabled={builderState !== null}
                  onClick={() => { setHeroPosition(pos); setVillains(prev => prev.filter(v => v.position !== pos)); }}
                  className="rounded-lg px-2.5 py-2 text-[10px] font-bold transition disabled:opacity-30"
                  style={{ background: pos === heroPosition ? 'rgba(201,162,39,0.18)' : 'rgba(255,255,255,0.03)', border: `1px solid ${pos === heroPosition ? GOLD_DIM : 'rgba(255,255,255,0.08)'}`, color: pos === heroPosition ? '#f5e6b0' : 'rgba(255,255,255,0.55)' }}>
                  {pos}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1">
                <span className="text-[9px] font-bold uppercase text-white/40">Stack</span>
                <input type="number" value={heroStack} disabled={builderState !== null}
                  onChange={e => setHeroStack(Number(e.target.value))}
                  className="w-16 bg-transparent text-[12px] font-semibold text-white/80 outline-none disabled:opacity-40" />
                <div className="flex gap-0.5">
                  <button onClick={() => setStackMode('bb')} disabled={builderState !== null}
                    className={`rounded px-1.5 py-0.5 text-[8px] font-bold transition disabled:opacity-30 ${stackMode === 'bb' ? 'bg-[#c0911e]/20 text-[#f5e6b0]' : 'text-white/40'}`}>BB</button>
                  <button onClick={() => setStackMode('chips')} disabled={builderState !== null}
                    className={`rounded px-1.5 py-0.5 text-[8px] font-bold transition disabled:opacity-30 ${stackMode === 'chips' ? 'bg-[#c0911e]/20 text-[#f5e6b0]' : 'text-white/40'}`}>CHIPS</button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Cards</span>
              {heroCards.length === 0 ? (
                <button onClick={() => setCardPicker({ target: 'hero', max: 2 })}
                  className="rounded-lg border border-dashed border-white/15 px-4 py-2 text-[11px] font-semibold text-white/35 hover:text-white/55">
                  Tap to select
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {heroCards.map(c => <BigCardTile key={c} card={c} />)}
                  <button onClick={() => setCardPicker({ target: 'hero', max: 2 })}
                    className="flex items-center rounded-lg border border-white/10 px-2 py-1 text-[9px] font-bold uppercase text-white/40 hover:text-white/70">
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── VILLAIN SETUP ── */}
          {villains.map((v, idx) => {
            const villainAvailable = availablePositions.filter(p => p !== heroPosition && (p === v.position || !villains.some(other => other.id !== v.id && other.position === p)));
            return (
              <div key={v.id} className="rounded-xl border p-3 sm:p-4" style={{ borderColor: 'rgba(255,255,255,0.08)', background: SECTION_BG }}>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">VILLAIN {idx + 1}</span>
                  <button onClick={() => removeVillain(v.id)} disabled={builderState !== null}
                    className="ml-auto text-white/30 hover:text-white/70 disabled:opacity-30">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  {villainAvailable.map(pos => (
                    <button key={pos} disabled={builderState !== null}
                      onClick={() => setVillainPosition(v.id, pos)}
                      className="rounded-lg px-2.5 py-2 text-[10px] font-bold transition disabled:opacity-30"
                      style={{ background: pos === v.position ? 'rgba(201,162,39,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${pos === v.position ? GOLD_DIM : 'rgba(255,255,255,0.08)'}`, color: pos === v.position ? '#f5e6b0' : 'rgba(255,255,255,0.55)' }}>
                      {pos}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1">
                    <span className="text-[9px] font-bold uppercase text-white/40">Stack</span>
                    <input type="number" value={v.stack} disabled={builderState !== null}
                      onChange={e => setVillainStack(v.id, Number(e.target.value))}
                      className="w-16 bg-transparent text-[12px] font-semibold text-white/80 outline-none disabled:opacity-40" />
                    <div className="flex gap-0.5">
                      <button onClick={() => setVillainStackMode(v.id, 'bb')} disabled={builderState !== null}
                        className={`rounded px-1.5 py-0.5 text-[8px] font-bold transition disabled:opacity-30 ${v.stackMode === 'bb' ? 'bg-[#c0911e]/20 text-[#f5e6b0]' : 'text-white/40'}`}>BB</button>
                      <button onClick={() => setVillainStackMode(v.id, 'chips')} disabled={builderState !== null}
                        className={`rounded px-1.5 py-0.5 text-[8px] font-bold transition disabled:opacity-30 ${v.stackMode === 'chips' ? 'bg-[#c0911e]/20 text-[#f5e6b0]' : 'text-white/40'}`}>CHIPS</button>
                    </div>
                  </div>
                </div>
                {/* Villain cards known/unknown */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase text-white/40">Cards:</span>
                  <button disabled={builderState !== null}
                    onClick={() => setVillainCardsKnown(v.id, false)}
                    className="rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase transition disabled:opacity-30"
                    style={{ background: !v.cardsKnown ? 'rgba(201,162,39,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${!v.cardsKnown ? GOLD_DIM : 'rgba(255,255,255,0.08)'}`, color: !v.cardsKnown ? '#f5e6b0' : 'rgba(255,255,255,0.45)' }}>
                    Unknown
                  </button>
                  <button disabled={builderState !== null}
                    onClick={() => { setVillainCardsKnown(v.id, true); setCardPicker({ target: `villain:${v.id}`, max: 2 }); }}
                    className="rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase transition disabled:opacity-30"
                    style={{ background: v.cardsKnown ? 'rgba(201,162,39,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${v.cardsKnown ? GOLD_DIM : 'rgba(255,255,255,0.08)'}`, color: v.cardsKnown ? '#f5e6b0' : 'rgba(255,255,255,0.45)' }}>
                    Known
                  </button>
                  {v.cardsKnown && v.cards.length === 2 && (
                    <div className="flex items-center gap-1.5">
                      {v.cards.map(c => <BigCardTile key={c} card={c} small />)}
                      <button disabled={builderState !== null}
                        onClick={() => setCardPicker({ target: `villain:${v.id}`, max: 2 })}
                        className="rounded border border-white/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white/40 hover:text-white/70 disabled:opacity-30">
                        Edit
                      </button>
                    </div>
                  )}
                </div>
                {/* Reveal mode selector */}
                {v.cardsKnown && v.cards.length === 2 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase text-white/40">Reveal:</span>
                    {([
                      { key: 'show_from_start' as const, label: 'From Start', icon: Eye },
                      { key: 'reveal_at_showdown' as const, label: 'At Showdown', icon: EyeOff },
                      { key: 'do_not_reveal' as const, label: 'Never', icon: EyeOff },
                    ]).map(opt => (
                      <button key={opt.key} disabled={builderState !== null}
                        onClick={() => setVillainRevealMode(v.id, opt.key)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[8px] font-bold uppercase transition disabled:opacity-30"
                        style={{ background: v.revealMode === opt.key ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.02)', border: `1px solid ${v.revealMode === opt.key ? GOLD_DIM : 'rgba(255,255,255,0.06)'}`, color: v.revealMode === opt.key ? '#f5e6b0' : 'rgba(255,255,255,0.4)' }}>
                        <opt.icon className="h-2.5 w-2.5" /> {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {remainingVillainPositions.length > 0 && villains.length < tableSize - 1 && !builderState && (
            <button
              onClick={() => { const nextPos = remainingVillainPositions[0]; if (nextPos) addVillain(nextPos); }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed py-3 text-[11px] font-bold uppercase tracking-wider text-white/40 transition hover:text-white/70"
              style={{ borderColor: 'rgba(255,255,255,0.12)' }}
            >
              <Plus className="h-4 w-4" /> Add Villain
            </button>
          )}

          {/* Spacer so last timeline row can scroll above the fixed footer */}
          {builderState && <div className="h-4 shrink-0" aria-hidden="true" />}

          {/* ── PROCEED TO ACTION ── */}
          {!preflopStarted && (
            <button
              onClick={initBuilder}
              className="flex items-center gap-1.5 self-start rounded-lg px-3 py-2 text-[11px] font-semibold text-white/50 transition hover:text-white/80"
              style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
            >
              Proceed to Action <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}

          {/* ── TIMELINE ── */}
          {builderState && (
            <div className="space-y-1">
              {/* Blinds */}
              <TimelineRow label={`SB posts ${formatAmount(builderState.setup.smallBlind)}`} />
              <TimelineRow label={`BB posts ${formatAmount(builderState.setup.bigBlind)}`} />
              {builderState.setup.ante > 0 && (
                <TimelineRow label={`Ante ${formatAmount(builderState.setup.ante)}${builderState.setup.anteType === 'bb_ante' ? ' (BB ante)' : ''}`} />
              )}

              {/* Completed actions with street transitions */}
              {builderState.actions.map((a, i) => {
                const prevStreet = i > 0 ? builderState.actions[i - 1].street : 'preflop';
                const showStreetDivider = a.street !== prevStreet;
                const player = builderState.players.find(p => p.name === a.player);
                const name = player?.isHero ? 'Hero' : (player?.position ?? a.player);
                const actionLabelMap: Record<string, string> = {
                  fold: 'folds', check: 'checks', call: 'calls', bet: 'bets',
                  raise: 'raises to', allin: 'jams',
                };
                const actionLabel = actionLabelMap[a.type] ?? a.type;
                const amountStr = a.amount !== undefined && a.amount !== null ? ` ${formatAmount(a.amount)}` : '';
                return (
                  <div key={a.actionId}>
                    {showStreetDivider && <StreetDivider street={a.street} board={builderState.board} />}
                    <TimelineRow
                      label={`${name} ${actionLabel}${amountStr}`}
                      onClick={() => {
                        setSelectedActionIndex(selectedActionIndex === i ? null : i);
                        setEditingAmount(a.amount ?? null);
                      }}
                      active={selectedActionIndex === i}
                    />
                    {selectedActionIndex === i && (
                      <div className="ml-6 flex flex-wrap items-center gap-1.5 pb-1.5">
                        {(a.type === 'bet' || a.type === 'raise') && (
                          <>
                            <input
                              type="number"
                              value={editingAmount ?? ''}
                              onChange={e => setEditingAmount(e.target.value === '' ? null : Number(e.target.value))}
                              className="w-20 rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white/80 outline-none focus:border-[#d4a52c]/40"
                            />
                            <button
                              onClick={() => updateActionAmount(i)}
                              disabled={editingAmount === null}
                              className="rounded border border-[#d4a52c]/30 px-2 py-1 text-[9px] font-bold uppercase text-[#f5e6b0] disabled:opacity-30"
                            >
                              Edit Amount
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => removeFromAction(i)}
                          className="rounded border border-white/10 px-2 py-1 text-[9px] font-bold uppercase text-white/50 hover:text-white/80"
                        >
                          Remove From Here
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Saw-flop decision */}
              {showFlopDecision && (
                <div ref={activeSectionRef} className="space-y-1">
                  <StreetDivider street="flop" board={builderState.board} />
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleSawFlop(true)}
                      className="rounded-lg px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide transition"
                      style={{ background: 'rgba(201,162,39,0.15)', border: `1px solid ${GOLD_DIM}`, color: '#f5e6b0' }}>
                      Saw Flop
                    </button>
                    <button onClick={() => setSawFlop(false)}
                      className="rounded-lg px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white/55 transition hover:text-white/75"
                      style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                      Didn't See
                    </button>
                  </div>
                </div>
              )}

              {/* Current active action */}
              {showActiveAction && builderState && !builderState.isComplete && (
                <div ref={activeSectionRef} className="space-y-1">
                  {showActiveStreetDivider && <StreetDivider street={builderState.street} board={builderState.board} />}
                  <div className="rounded-xl border p-3 sm:p-4" style={{ borderColor: BORDER, background: CARD_BG }}>
                    <div className="mb-2.5 flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                        {currentStreetLabel} — {currentActorLabel} ACTION
                      </span>
                      {builderState.amountToCall > 0 && (
                        <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                          To call: {stackMode === 'bb' ? Math.round((builderState.amountToCall / builderState.setup.bigBlind) * 100) / 100 : builderState.amountToCall}{stackUnit}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {builderState.legalActions.map(action => (
                        <button key={action}
                          onClick={() => handleActionClick(action)}
                          className="min-w-[56px] rounded-lg px-3.5 py-2.5 text-[11px] font-bold uppercase transition"
                          style={{
                            background: pendingAction === action ? 'rgba(201,162,39,0.2)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${pendingAction === action ? GOLD : 'rgba(255,255,255,0.08)'}`,
                            color: pendingAction === action ? '#f5e6b0' : 'rgba(255,255,255,0.6)',
                          }}
                        >
                          {activeLabels[action]}
                          {action === 'allin' && <span className="ml-1 text-[9px] text-[#f5e6b0]/70">ALL-IN</span>}
                        </button>
                      ))}
                    </div>
                    {pendingAction && (pendingAction === 'bet' || pendingAction === 'raise') && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-white/50">{pendingAction === 'bet' ? 'BET' : 'RAISE TO'}</span>
                        <input type="number" autoFocus
                          value={pendingSize ?? ''}
                          onChange={e => setPendingSize(e.target.value === '' ? null : Number(e.target.value))}
                          onKeyDown={e => { if (e.key === 'Enter' && pendingSize !== null) confirmAction(pendingAction, pendingSize); }}
                          className="w-20 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] font-semibold text-white/80 outline-none focus:border-[#d4a52c]/40"
                        />
                        <div className="flex gap-0.5 rounded border border-white/10">
                          <button onClick={() => handleStackModeToggle('bb')}
                            className={`rounded px-1.5 py-1 text-[8px] font-bold transition ${stackMode === 'bb' ? 'bg-[#c0911e]/20 text-[#f5e6b0]' : 'text-white/40'}`}>BB</button>
                          <button onClick={() => handleStackModeToggle('chips')}
                            className={`rounded px-1.5 py-1 text-[8px] font-bold transition ${stackMode === 'chips' ? 'bg-[#c0911e]/20 text-[#f5e6b0]' : 'text-white/40'}`}>CHIPS</button>
                        </div>
                        <button onClick={() => pendingSize !== null && confirmAction(pendingAction, pendingSize)}
                          disabled={pendingSize === null}
                          className="rounded-lg px-4 py-1.5 text-[10px] font-bold uppercase transition disabled:opacity-30"
                          style={{ background: 'rgba(201,162,39,0.18)', border: `1px solid ${GOLD}`, color: '#f5e6b0' }}
                        >
                          Confirm Action
                        </button>
                        <button onClick={cancelPendingAction}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase text-white/40 hover:text-white/70">
                          Cancel
                        </button>
                      </div>
                    )}
                    {pendingAction === null && builderState.legalActions.some(a => a === 'fold' || a === 'check' || a === 'call' || a === 'allin') && (
                      <div className="mt-1.5 text-[9px] text-white/30">
                        Click an action to confirm it instantly.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hand complete — completion actions */}
              {builderState.isComplete && (
                <div ref={activeSectionRef} className="space-y-3">
                  <div className="rounded-xl border p-4 text-center" style={{ borderColor: GOLD_DIM, background: 'rgba(201,162,39,0.08)' }}>
                    <Check className="mx-auto h-6 w-6" style={{ color: GOLD }} />
                    <div className="mt-1.5 text-[13px] font-bold text-white">Hand Complete</div>
                    {builderState.winners.length > 0 && (
                      <div className="mt-1 text-[11px] text-white/50">
                        Winner: {builderState.winners.map(w => {
                          const p = builderState.players.find(pl => pl.name === w.player);
                          return p?.isHero ? 'Hero' : p?.position ?? w.player;
                        }).join(', ')}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/40">Hand Title (optional)</label>
                    <input
                      value={handTitle}
                      onChange={(e) => setHandTitle(e.target.value)}
                      placeholder={generateDefaultTitle(buildNormalizedHand())}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/80 outline-none focus:border-[#d4a52c]/40 placeholder:text-white/20"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleSave(true)}
                      disabled={saving || !onWatch}
                      className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-[13px] font-bold uppercase tracking-wider transition disabled:opacity-40"
                      style={{ background: 'rgba(201,162,39,0.25)', border: `1.5px solid ${GOLD}`, color: '#f5e6b0' }}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex items-center gap-2"><Play className="h-4 w-4" /> Save &amp; Replay</span>}
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(false)}
                        disabled={saving}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-[12px] font-bold uppercase tracking-wider transition disabled:opacity-40"
                        style={{ background: 'rgba(201,162,39,0.12)', border: `1px solid ${GOLD_DIM}`, color: '#f5e6b0' }}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Hand'}
                      </button>
                      <button
                        onClick={() => setShowDiscardConfirm(true)}
                        disabled={saving}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-[12px] font-bold uppercase tracking-wider transition hover:bg-red-400/10 disabled:opacity-40"
                        style={{ border: '1px solid rgba(220,60,60,0.25)', background: 'rgba(220,60,60,0.06)', color: 'rgba(255,120,120,0.8)' }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Discard
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── PERSISTENT FOOTER (navigation controls) ── */}
        {builderState !== null && !builderState.isComplete && (
          <div className="flex shrink-0 flex-col gap-2 border-t bg-[rgba(8,10,12,0.98)] px-4 py-3 sm:flex-row sm:px-5" style={{ borderColor: BORDER }}>
            <button
              onClick={handleUndo}
              disabled={pastSnapshotsRef.current.length === 0}
              className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-[12px] font-bold uppercase tracking-wider text-white/55 transition hover:text-white/85 disabled:opacity-30 sm:flex-1"
              style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
            >
              <Undo2 className="h-3.5 w-3.5" /> Undo Last Action
            </button>
            <button
              onClick={handleRedo}
              disabled={futureSnapshotsRef.current.length === 0}
              className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-[12px] font-bold uppercase tracking-wider text-white/55 transition hover:text-white/85 disabled:opacity-30 sm:flex-1"
              style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
            >
              <Redo2 className="h-3.5 w-3.5" /> Redo
            </button>
            <button
              onClick={() => setShowDiscardConfirm(true)}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-[12px] font-bold uppercase tracking-wider transition hover:bg-red-400/10 sm:flex-1"
              style={{ border: '1px solid rgba(220,60,60,0.25)', background: 'rgba(220,60,60,0.06)', color: 'rgba(255,120,120,0.8)' }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Discard
            </button>
          </div>
        )}
        </>
        )}

        {/* ── DISCARD CONFIRMATION ── */}
        {showDiscardConfirm && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setShowDiscardConfirm(false)}>
            <div className="w-full max-w-sm rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="mb-2 text-center text-[14px] font-bold text-white">Discard this hand?</div>
              <div className="mb-4 text-center text-[11px] text-white/45">Your unsaved changes will be lost.</div>
              <div className="flex gap-2">
                <button onClick={() => setShowDiscardConfirm(false)}
                  className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/55 hover:text-white/80">
                  Cancel
                </button>
                <button onClick={handleDiscard}
                  className="flex-1 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-red-300 hover:bg-red-400/20">
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CARD PICKER OVERLAY ── */}
        {cardPicker && (
          <CardPicker
            target={cardPicker.target}
            selectedCards={getPickerSelectedCards()}
            usedCards={getPickerUsedCards()}
            max={cardPicker.max}
            onSelect={handleCardSelect}
            onConfirm={handleCardPickerConfirm}
            onClose={() => setCardPicker(null)}
          />
        )}
      </div>
    </div>
  );

  function resetAll() {
    pastSnapshotsRef.current = [];
    futureSnapshotsRef.current = [];
    setHistoryVersion(version => version + 1);
    setHeroCards([]);
    setVillains([]);
    setBuilderState(null);
    setPreflopStarted(false);
    setSawFlop(null);
    setFlopCards([]);
    setTurnCard(null);
    setRiverCard(null);
    setPendingAction(null);
    setPendingSize(null);
  }
}

// ── Big Card Tile (prominent display) ──

function BigCardTile({ card, small, onClick }: { card: string; small?: boolean; onClick?: () => void }) {
  const isRed = SUIT_IS_RED[card[1]] ?? false;
  const SuitIcon = SUIT_ICONS[card[1]] ?? Spade;
  const w = small ? 40 : 52;
  const h = small ? 56 : 72;
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center rounded-lg border transition hover:brightness-110"
      style={{
        width: w, height: h, borderColor: GOLD_DIM,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
      }}
    >
      <span className="text-[20px] font-bold leading-none" style={{ color: isRed ? '#e04545' : '#e8edf2' }}>{card[0]}</span>
      <SuitIcon className="mt-0.5" style={{ width: small ? 14 : 18, height: small ? 14 : 18, color: isRed ? '#e04545' : '#e8edf2' }} />
    </button>
  );
}

// ── Card Picker (horizontal suit-row layout) ──

function CardPicker({ target, selectedCards, usedCards, max, onSelect, onConfirm, onClose }: {
  target: CardPickerTarget;
  selectedCards: string[];
  usedCards: Set<string>;
  max: number;
  onSelect: (card: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const targetLabel = target === 'hero' ? 'Hero Cards'
    : target === 'flop' ? 'Flop'
    : target === 'turn' ? 'Turn'
    : target === 'river' ? 'River'
    : target && target.startsWith('villain:') ? 'Villain Cards'
    : 'Cards';
  const isComplete = selectedCards.length === max;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[12px] font-bold text-white/80">
            {targetLabel} — pick {max} {max === 1 ? 'card' : 'cards'}
          </span>
          <button onClick={onClose} className="text-white/40 hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Selected card slots */}
        <div className="mb-3 flex items-center justify-center gap-3">
          {Array.from({ length: max }).map((_, i) => {
            const card = selectedCards[i];
            if (card) {
              return <BigCardTile key={i} card={card} onClick={() => onSelect(card)} />;
            }
            return (
              <div key={i} className="flex flex-col items-center justify-center rounded-lg border border-dashed"
                style={{ width: 52, height: 72, borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-[20px] font-bold text-white/15">?</span>
              </div>
            );
          })}
        </div>
        <div className="mb-3 text-center text-[10px] font-bold uppercase tracking-wider text-white/40">
          {selectedCards.length} / {max} selected
        </div>

        {/* Suit rows */}
        <div className="space-y-1.5">
          {CARD_SUITS.map(suit => {
            const SuitIcon = SUIT_ICONS[suit];
            const isRed = SUIT_IS_RED[suit];
            const suitColor = isRed ? '#e04545' : '#cbd5e1';
            return (
              <div key={suit} className="flex items-center gap-2">
                {/* Suit icon */}
                <div className="flex w-7 shrink-0 items-center justify-center">
                  <SuitIcon className="h-5 w-5" style={{ color: suitColor }} />
                </div>
                {/* Rank buttons */}
                <div className="flex flex-1 gap-1">
                  {CARD_RANKS.map(rank => {
                    const card = `${rank}${suit}`;
                    const isUsed = usedCards.has(card) && !selectedCards.includes(card);
                    const isSelected = selectedCards.includes(card);
                    return (
                      <button key={card}
                        onClick={() => !isUsed && onSelect(card)}
                        disabled={isUsed}
                        className="flex h-9 flex-1 items-center justify-center rounded-md border transition"
                        style={{
                          background: isSelected ? 'rgba(201,162,39,0.25)' : isUsed ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isSelected ? GOLD : isUsed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)'}`,
                          color: isUsed ? 'rgba(255,255,255,0.08)' : suitColor,
                          cursor: isUsed ? 'default' : 'pointer',
                          opacity: isUsed ? 0.25 : 1,
                        }}
                      >
                        <span className="text-[12px] font-bold">{rank}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {selectedCards.map(c => <BigCardTile key={c} card={c} small />)}
          </div>
          <button
            onClick={onConfirm}
            disabled={!isComplete}
            className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/15 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] transition disabled:opacity-30"
          >
            <Check className="h-3.5 w-3.5" /> {isComplete ? 'Confirm' : `Select ${max} cards`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Timeline Row (compact action line) ──

function TimelineRow({ label, onClick, active }: { label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] leading-tight transition ${onClick ? 'hover:bg-white/5' : 'cursor-default'}`}
      style={{
        background: active ? 'rgba(201,162,39,0.10)' : 'transparent',
        border: active ? `1px solid ${GOLD_DIM}` : '1px solid transparent',
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: active ? GOLD : 'rgba(255,255,255,0.25)' }}
      />
      <span className={active ? 'text-white/90' : 'text-white/55'}>{label}</span>
    </button>
  );
}

// ── Street Divider (street label + board cards) ──

function StreetDivider({ street, board }: { street: Street; board: BuilderBoard }) {
  const label = street === 'preflop' ? 'PREFLOP' : street === 'flop' ? 'FLOP' : street === 'turn' ? 'TURN' : street === 'river' ? 'RIVER' : 'SHOWDOWN';
  const cards: string[] = street === 'flop'
    ? board.flop
    : street === 'turn'
    ? [...board.flop, ...(board.turn ? [board.turn] : [])]
    : street === 'river'
    ? [...board.flop, ...(board.turn ? [board.turn] : []), ...(board.river ? [board.river] : [])]
    : [];
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="h-px w-4" style={{ background: BORDER }} />
      <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: GOLD }}>{label}</span>
      {cards.length > 0 && (
        <div className="flex items-center gap-1">
          {cards.map((c, i) => <MiniCard key={i} card={c} />)}
        </div>
      )}
      <div className="h-px flex-1" style={{ background: BORDER }} />
    </div>
  );
}

// ── Mini Card (tiny board card for street dividers) ──

function MiniCard({ card }: { card: string }) {
  const isRed = SUIT_IS_RED[card[1]] ?? false;
  const SuitIcon = SUIT_ICONS[card[1]] ?? Spade;
  return (
    <div
      className="flex items-center justify-center rounded border"
      style={{ width: 22, height: 30, borderColor: GOLD_DIM, background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))' }}
    >
      <span className="text-[11px] font-bold leading-none" style={{ color: isRed ? '#e04545' : '#e8edf2' }}>{card[0]}</span>
      <SuitIcon className="ml-0.5" style={{ width: 8, height: 8, color: isRed ? '#e04545' : '#e8edf2' }} />
    </div>
  );
}

// ── Saved Confirmation Panel ──

function SavedConfirmation({ info, copiedField, onCopy, onWatch, onNew, onClose }: {
  info: SavedHandInfo;
  copiedField: 'id' | 'link' | null;
  onCopy: (text: string, field: 'id' | 'link') => void;
  onWatch: () => void;
  onNew: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border" style={{ borderColor: GOLD_DIM, background: 'rgba(201,162,39,0.12)' }}>
        <Check className="h-7 w-7" style={{ color: GOLD }} />
      </div>
      <div className="text-center">
        <div className="text-[14px] font-bold text-white">Hand Saved</div>
        <div className="mt-1 text-[11px] text-white/40">Your constructed hand is permanently stored.</div>
      </div>
      <div className="w-full max-w-sm rounded-xl border p-4" style={{ borderColor: BORDER, background: CARD_BG }}>
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/40">Hand ID</div>
        <div className="flex items-center justify-between gap-2">
          <code className="text-[13px] font-bold text-[#f5e6b0]">{info.handId}</code>
          <button onClick={() => onCopy(info.handId, 'id')}
            className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[9px] font-bold uppercase text-white/50 hover:text-white/80">
            {copiedField === 'id' ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            {copiedField === 'id' ? 'Copied' : 'Copy ID'}
          </button>
        </div>
        <div className="mt-3 mb-1 text-[9px] font-bold uppercase tracking-wider text-white/40">Shareable Link</div>
        <div className="flex items-center justify-between gap-2">
          <code className="truncate text-[11px] text-white/60">{info.url}</code>
          <button onClick={() => onCopy(info.url, 'link')}
            className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[9px] font-bold uppercase text-white/50 hover:text-white/80">
            {copiedField === 'link' ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            {copiedField === 'link' ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onWatch}
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition"
          style={{ borderColor: GOLD, background: 'rgba(201,162,39,0.2)', color: '#f5e6b0' }}>
          <Play className="h-3.5 w-3.5" /> Watch in Replayer
        </button>
        <button onClick={onNew}
          className="rounded-lg border border-white/10 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/55 hover:text-white/80">
          New Hand
        </button>
        <button onClick={onClose}
          className="rounded-lg border border-white/10 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/55 hover:text-white/80">
          Done
        </button>
      </div>
    </div>
  );
}
