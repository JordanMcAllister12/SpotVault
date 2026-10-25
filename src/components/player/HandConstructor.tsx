import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Check, Undo2, RotateCcw, UserRound, Star, X,
} from 'lucide-react';
import {
  type BuilderState, type TableSetup, type BuilderActionType,
  positionsForTable, CARD_RANKS, CARD_SUITS, SUIT_SYMBOLS, SUIT_COLORS,
  cardLabel, cardColor, generateHandId,
} from '@/lib/poker/builderTypes';
import {
  createInitialState, applyAction, setBoard, setHeroCards, setVillainCards, undoLastAction,
  computeTotalPot, needsBoardSelection,
} from '@/lib/poker/builderEngine';
import { builderStateToNormalizedHand } from '@/lib/poker/builderConvert';
import type { Street } from '@/features/hh-replayer/types';
import type { NormalizedHand } from '@/features/hh-replayer/types';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

type CardTarget =
  | { type: 'hole'; playerKey: string; maxCards: 2 }
  | { type: 'board'; street: Street; maxCards: number }
  | null;

interface Props {
  onSave: (hand: NormalizedHand) => void;
  onCancel: () => void;
}

export function HandConstructor({ onSave }: Props) {
  const [setup, setSetup] = useState<TableSetup | null>(null);
  const [state, setState] = useState<BuilderState | null>(null);
  const [heroCards, setHeroCards] = useState<string[]>([]);
  const [villainCards, setVillainCards] = useState<Record<string, string[]>>({});
  const [boardDraft, setBoardDraft] = useState<string[]>([]);
  const [cardTarget, setCardTarget] = useState<CardTarget>(null);
  const [sizingInput, setSizingInput] = useState('');
  const [sizingMode, setSizingMode] = useState<'bb' | 'chips' | 'pot'>('bb');
  const [decisionPointId, setDecisionPointId] = useState<string | null>(null);
  const [cardsSkipped, setCardsSkipped] = useState(false);
  const [villainPhase, setVillainPhase] = useState<'prompt' | 'enter' | 'skip' | null>(null);

  const heroReady = heroCards.length === 2 || cardsSkipped;

  const allUsedCards = useMemo(() => {
    const used = new Set<string>();
    heroCards.forEach(c => used.add(c));
    Object.values(villainCards).forEach(cards => cards.forEach(c => used.add(c)));
    if (state) {
      state.board.flop.forEach(c => used.add(c));
      if (state.board.turn) used.add(state.board.turn);
      if (state.board.river) used.add(state.board.river);
    }
    boardDraft.forEach(c => used.add(c));
    return used;
  }, [heroCards, villainCards, state, boardDraft]);

  const handleSetupCommit = useCallback((nextSetup: TableSetup) => {
    setSetup(nextSetup);
    const initial = createInitialState(nextSetup);
    if (heroCards.length === 2) {
      setState(setHeroCards(initial, heroCards));
    } else {
      setState(initial);
    }
    setBoardDraft([]);
    setSizingInput('');
    setDecisionPointId(null);
    if (heroCards.length < 2 && !cardsSkipped) {
      setCardTarget({ type: 'hole', playerKey: '__hero', maxCards: 2 });
    }
  }, [heroCards, cardsSkipped]);

  const handleCardSelect = useCallback((card: string) => {
    if (!cardTarget) return;
    if (cardTarget.type === 'hole') {
      const key = cardTarget.playerKey;
      if (key === '__hero') {
        setHeroCards(prev => {
          if (prev.includes(card)) return prev.filter(c => c !== card);
          if (prev.length >= 2) return prev;
          return [...prev, card];
        });
      } else {
        setVillainCards(prev => {
          const current = prev[key] ?? [];
          if (current.includes(card)) return { ...prev, [key]: current.filter(c => c !== card) };
          if (current.length >= 2) return prev;
          return { ...prev, [key]: [...current, card] };
        });
      }
    } else if (cardTarget.type === 'board') {
      const max = cardTarget.maxCards;
      setBoardDraft(prev => {
        if (prev.includes(card)) return prev.filter(c => c !== card);
        if (prev.length >= max) return prev;
        return [...prev, card];
      });
    }
  }, [cardTarget]);

  const handleConfirmCards = useCallback(() => {
    if (!cardTarget) return;
    if (cardTarget.type === 'hole') {
      const key = cardTarget.playerKey;
      if (key === '__hero') {
        if (heroCards.length === 2 && state) {
          setState(setHeroCards(state, heroCards));
          setVillainPhase('prompt');
        } else if (state && setup) {
          setState(setHeroCards(createInitialState(setup), heroCards));
        }
      } else {
        const villainKey = key;
        const vCards = villainCards[villainKey] ?? [];
        if (vCards.length === 2 && state) {
          setState(setVillainCards(state, villainKey, vCards));
          setVillainPhase('skip');
        }
      }
    } else if (cardTarget.type === 'board' && state) {
      const street = cardTarget.street;
      if (boardDraft.length === cardTarget.maxCards) {
        setState(setBoard(state, street, boardDraft));
      }
    }
    setCardTarget(null);
  }, [cardTarget, heroCards, state, setup, boardDraft, villainCards]);

  const handleClearCards = useCallback((target: CardTarget) => {
    if (!target) return;
    if (target.type === 'hole') {
      if (target.playerKey === '__hero') {
        setHeroCards([]);
        setCardsSkipped(false);
        if (setup) setState(createInitialState(setup));
        setVillainPhase(null);
        setCardTarget({ type: 'hole', playerKey: '__hero', maxCards: 2 });
      } else {
        setVillainCards(prev => { const n = { ...prev }; delete n[target.playerKey]; return n; });
        if (state) setState(setVillainCards(state, target.playerKey, []));
      }
    } else if (target.type === 'board') {
      setBoardDraft([]);
    }
  }, [setup]);

  const handleAction = useCallback((type: BuilderActionType, amount?: number) => {
    if (!state) return;
    const newState = applyAction(state, type, amount);
    setState(newState);
    setSizingInput('');
    if (needsBoardSelection(newState)) {
      setBoardDraft([]);
      const street = newState.street;
      const maxCards = street === 'flop' ? 3 : 1;
      setCardTarget({ type: 'board', street, maxCards });
    }
  }, [state]);

  const handleJumpToPosition = useCallback((position: string) => {
    if (!state) return;
    const player = state.players.find(p => p.position === position && !p.folded && !p.allIn);
    if (!player) return;

    let newState = state;
    const postflopOrder = ['SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN'];
    const currentIdx = postflopOrder.indexOf(state.currentActor ?? '');
    const targetIdx = postflopOrder.indexOf(position);
    if (currentIdx < 0 || targetIdx < 0) return;

    for (let offset = 1; offset <= postflopOrder.length; offset++) {
      const candidateIdx = (currentIdx + offset) % postflopOrder.length;
      if (candidateIdx === targetIdx) break;
      const candidatePos = postflopOrder[candidateIdx];
      const candidatePlayer = newState.players.find(p => p.position === candidatePos && !p.folded && !p.allIn);
      if (candidatePlayer && candidatePlayer.name !== state.currentActor) {
        if (newState.legalActions.includes('fold')) {
          newState = applyAction(newState, 'fold');
        }
      }
    }
    setState(newState);
  }, [state]);

  const handleUndo = useCallback(() => {
    if (!state) return;
    setState(undoLastAction(state));
  }, [state]);

  const handleReset = useCallback(() => {
    if (!setup) return;
    const initial = createInitialState(setup);
    if (heroCards.length === 2) setState(setHeroCards(initial, heroCards));
    else setState(initial);
    setCardsSkipped(false);
    setBoardDraft([]);
    setSizingInput('');
    setDecisionPointId(null);
    setCardTarget({ type: 'hole', playerKey: '__hero', maxCards: 2 });
    setVillainPhase(null);
  }, [setup, heroCards]);

  const handleSave = useCallback(() => {
    if (!state) return;
    const handId = generateHandId();
    onSave(builderStateToNormalizedHand(state, handId));
  }, [state, onSave]);

  const potInBB = state ? computeTotalPot(state) / state.setup.bigBlind : 0;
  const potType = state ? derivePotType(state) : null;

  const paletteSelected = cardTarget
    ? cardTarget.type === 'hole'
      ? cardTarget.playerKey === '__hero' ? heroCards : (villainCards[cardTarget.playerKey] ?? [])
      : boardDraft
    : [];

  const setupValid = !!state;

  return (
    <div className="flex w-full flex-col gap-2 p-2">
      {/* ── TWO-COLUMN LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3">
        {/* LEFT COLUMN: Setup + Card entry status + Action tree */}
        <div className="flex flex-col gap-2 min-w-0">
          {/* Setup */}
          <SetupForm initialSetup={setup} onCommit={handleSetupCommit} />

          {/* Card entry status (appears when setup is valid) */}
          {state && !state.isComplete && (
            <CardEntryStatus
              state={state}
              heroCards={heroCards}
              villainCards={villainCards}
              cardsSkipped={cardsSkipped}
              cardTarget={cardTarget}
              villainPhase={villainPhase}
              onSelectTarget={(t) => setCardTarget(t)}
              onClearTarget={handleClearCards}
              onSkip={() => { setCardsSkipped(true); setCardTarget(null); setVillainPhase(null); }}
              onVillainEnter={() => {
                const firstVillain = state.players.find(p => !p.isHero);
                if (firstVillain) {
                  setVillainPhase('enter');
                  setCardTarget({ type: 'hole', playerKey: firstVillain.name, maxCards: 2 });
                }
              }}
              onVillainSkip={() => { setVillainPhase('skip'); setCardTarget(null); }}
            />
          )}

          {/* Action tree appears after hero cards ready */}
          {state && heroReady && (
            <ActionTree
              state={state}
              sizingInput={sizingInput}
              sizingMode={sizingMode}
              onSizingInputChange={setSizingInput}
              onSizingModeChange={setSizingMode}
              onAction={handleAction}
              onJumpToPosition={handleJumpToPosition}
              onUndo={handleUndo}
              onReset={handleReset}
              onSave={handleSave}
              decisionPointId={decisionPointId}
              onSetDecisionPoint={setDecisionPointId}
            />
          )}
        </div>

        {/* RIGHT COLUMN: Persistent card palette + Live hand summary */}
        <div className="flex flex-col gap-2 min-w-0">
          {/* Card palette — ALWAYS visible */}
          {cardTarget && setupValid ? (
            <CardPalette
              target={cardTarget}
              selectedCards={paletteSelected}
              usedCards={allUsedCards}
              onSelect={handleCardSelect}
              onConfirm={handleConfirmCards}
              onClose={() => setCardTarget(null)}
              canConfirm={paletteSelected.length === cardTarget.maxCards}
            />
          ) : (
            <DimmedCardPalette setupValid={setupValid} />
          )}

          {/* Live hand summary (compact, sticky) */}
          {state && (
            <LiveHandSummary
              state={state}
              heroCards={heroCards}
              villainCards={villainCards}
              potInBB={potInBB}
              potType={potType}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section label ──

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold tracking-widest text-white/50 uppercase border-b pb-1" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>{children}</div>;
}

// ── Compact Setup Form ──

function SetupForm({ initialSetup, onCommit }: { initialSetup: TableSetup | null; onCommit: (setup: TableSetup) => void }) {
  const [seatCount, setSeatCount] = useState(initialSetup?.seatCount ?? 2);
  const [smallBlind, setSmallBlind] = useState<number | null>(initialSetup?.smallBlind ?? 0.5);
  const [bigBlind, setBigBlind] = useState<number | null>(initialSetup?.bigBlind ?? 1);
  const [ante, setAnte] = useState<number | null>(initialSetup?.ante ?? 0.1);
  const [anteType, setAnteType] = useState<'none' | 'bb_ante' | 'per_player'>(initialSetup?.anteType ?? 'per_player');
  const [gameFormat, setGameFormat] = useState<'cash' | 'tournament'>(initialSetup?.gameFormat ?? 'tournament');
  const [stackMode, setStackMode] = useState<'bb' | 'chips'>(initialSetup?.stackMode ?? 'bb');
  const [players, setPlayers] = useState(() => initialSetup?.players ?? [
    { seat: 1, name: 'Hero', position: 'SB', stack: null as number | null, stackChips: null as number | null, isSystemGenerated: true, isHero: true, holeCards: null },
    { seat: 2, name: 'Opp 1', position: 'BB', stack: null as number | null, stackChips: null as number | null, isSystemGenerated: true, isHero: false, holeCards: null },
  ]);
  const lastCommittedKey = useRef<string>('');

  const positions = useMemo(() => positionsForTable(seatCount), [seatCount]);
  const usedPositions = useMemo(() => new Set(players.map((p) => p.position)), [players]);
  const defaultName = (index: number) => index === 0 ? 'Hero' : `Opp ${index}`;

  const handleFormatChange = (format: 'cash' | 'tournament') => {
    setGameFormat(format);
    if (format === 'tournament') {
      if (stackMode === 'bb') { setSmallBlind(0.5); setBigBlind(1); setAnte(0.1); setAnteType('per_player'); }
      else { setSmallBlind(null); setBigBlind(null); setAnte(null); setAnteType('per_player'); }
    } else {
      if (stackMode === 'bb') { setSmallBlind(0.5); setBigBlind(1); }
      setAnte(0); setAnteType('none');
    }
  };

  const handleBigBlindChange = (value: number | null) => {
    setBigBlind(value);
    const bb = value ?? 0;
    setPlayers((current) => current.map((p) => p.stackChips == null || bb <= 0 ? p : { ...p, stack: stackMode === 'bb' ? p.stackChips! / bb : p.stack }));
  };

  const toggleStackMode = (mode: 'bb' | 'chips') => {
    setStackMode(mode);
    if (mode === 'bb') { setSmallBlind(0.5); setBigBlind(1); setAnte(gameFormat === 'tournament' ? 0.1 : 0); }
    else { setSmallBlind(null); setBigBlind(null); setAnte(null); }
    const bb = bigBlind ?? 0;
    setPlayers((current) => current.map((p) => ({ ...p, stack: p.stackChips == null ? p.stack : mode === 'bb' ? p.stackChips / bb : p.stackChips })));
  };

  const updatePlayer = (seat: number, changes: Partial<(typeof players)[number]>) => {
    setPlayers((current) => current.map((p) => p.seat === seat ? { ...p, ...changes } : p));
  };

  const resizeTable = (nextCount: number) => {
    if (nextCount < seatCount && players.slice(nextCount).some((p) => p.stack !== null || !p.isSystemGenerated || p.isHero)) {
      if (!window.confirm(`Change to ${nextCount === 2 ? 'HU' : `${nextCount}-max`}? Removes ${seatCount - nextCount} players.`)) return;
    }
    const nextPositions = positionsForTable(nextCount);
    setSeatCount(nextCount);
    setPlayers((current) => nextPositions.map((position, index) => {
      const existing = current[index];
      return existing ? { ...existing, seat: index + 1, position } : { seat: index + 1, name: defaultName(index), position, stack: null, stackChips: null, isSystemGenerated: true, isHero: index === 0, holeCards: null };
    }));
  };

  const setupValid = useMemo(() => {
    if (players.length !== seatCount) return false;
    if (players.filter((p) => p.isHero).length !== 1) return false;
    if (new Set(players.map((p) => p.position)).size !== players.length) return false;
    if (players.some((p) => p.stackChips == null || !Number.isFinite(p.stackChips) || p.stackChips <= 0)) return false;
    const sb = smallBlind ?? 0, bb = bigBlind ?? 0, anteVal = ante ?? 0;
    if (!Number.isFinite(sb) || sb < 0 || !Number.isFinite(bb) || bb <= 0 || !Number.isFinite(anteVal) || anteVal < 0) return false;
    return true;
  }, [players, seatCount, smallBlind, bigBlind, ante]);

  useEffect(() => {
    if (!setupValid) return;
    const hero = players.find((p) => p.isHero) ?? players[0];
    const nextSetup: TableSetup = {
      seatCount, heroPosition: hero?.position ?? positions[0],
      smallBlind: smallBlind ?? 0, bigBlind: bigBlind ?? 0, ante: ante ?? 0,
      anteType, gameFormat, blindLevel: '', source: 'manual', stackMode, players,
    };
    const key = JSON.stringify(nextSetup);
    if (key === lastCommittedKey.current) return;
    lastCommittedKey.current = key;
    onCommit(nextSetup);
  }, [setupValid, players, seatCount, smallBlind, bigBlind, ante, anteType, gameFormat, stackMode, positions, onCommit]);

  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>Table Setup</SectionLabel>

      {/* Row 1: Format + Table size + Unit */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase text-white/35">Format</span>
          <div className="flex gap-0.5">
            {(['cash', 'tournament'] as const).map(f => (
              <button key={f} onClick={() => handleFormatChange(f)} className={`rounded border px-2 py-1 text-[12px] font-bold uppercase transition ${gameFormat === f ? 'border-[#d4a52c]/40 bg-[#c0911e]/15 text-[#f5e6b0]' : 'border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/5'}`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase text-white/35">Table</span>
          <div className="flex flex-wrap gap-0.5">
            {[2, 3, 4, 5, 6, 7, 8, 9].map(s => (
              <button key={s} onClick={() => resizeTable(s)} className={`rounded border px-1.5 py-1 text-[12px] font-bold transition ${seatCount === s ? 'border-[#d4a52c]/40 bg-[#c0911e]/15 text-[#f5e6b0]' : 'border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/5'}`}>{s === 2 ? 'HU' : s}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase text-white/35">Unit</span>
          <div className="flex gap-0.5">{(['chips', 'bb'] as const).map(m => <button key={m} onClick={() => toggleStackMode(m)} className={`rounded border px-2 py-1 text-[12px] font-bold uppercase transition ${stackMode === m ? 'border-[#d4a52c]/40 bg-[#c0911e]/15 text-[#f5e6b0]' : 'border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/5'}`}>{m === 'bb' ? 'BB' : 'Chips'}</button>)}</div>
        </div>
      </div>

      {/* Row 2: Blinds/Ante — compact */}
      <div className="flex flex-wrap items-center gap-2">
        <CompactField label="SB" value={smallBlind} onChange={setSmallBlind} step={stackMode === 'bb' ? 0.5 : 1} placeholder="0.5" width={60} />
        <CompactField label="BB" value={bigBlind} onChange={handleBigBlindChange} step={1} placeholder="1" width={60} />
        <CompactField label="Ante" value={ante} onChange={setAnte} step={0.1} placeholder="0.1" width={60} />
        <div className="flex flex-col">
          <span className="mb-0.5 text-[9px] font-bold uppercase text-white/35">Ante Type</span>
          <select value={anteType} onChange={(e) => setAnteType(e.target.value as typeof anteType)} className="rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[12px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none" style={{ width: 100 }}>
            <option value="none">None</option>
            <option value="bb_ante">BB Ante</option>
            <option value="per_player">Per Player</option>
          </select>
        </div>
      </div>

      {/* Row 3: Players — compact */}
      <div className="flex flex-col gap-1">
        {players.map((player) => (
          <div key={player.seat} className="flex items-center gap-1.5 rounded border border-white/[0.06] bg-black/20 px-1.5 py-1">
            <div className="relative" style={{ width: 110 }}>
              <input value={player.name} onChange={(e) => updatePlayer(player.seat, { name: e.target.value, isSystemGenerated: false })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 pr-5 text-[12px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none" aria-label="Player name" />
              <button onClick={() => updatePlayer(player.seat, { name: defaultName(player.seat - 1), isSystemGenerated: true })} title="Reset name" className="absolute right-0.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/25 hover:bg-white/10 hover:text-[#f5e6b0]">
                <UserRound className="h-3 w-3" />
              </button>
            </div>
            <input type="number" value={player.stack ?? ''} placeholder={stackMode === 'bb' ? 'BB' : 'Chips'} onChange={(e) => {
              const value = e.target.value === '' ? null : Number(e.target.value);
              updatePlayer(player.seat, { stack: value, stackChips: value === null ? null : stackMode === 'bb' ? value * (bigBlind ?? 0) : value });
            }} className="rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[12px] text-white/80 placeholder:text-white/25 focus:border-[#d4a52c]/40 focus:outline-none" style={{ width: 70 }} aria-label="Player stack" />
            <select value={player.position} onChange={(e) => updatePlayer(player.seat, { position: e.target.value })} className="rounded border border-white/10 bg-black/40 px-1 py-1 text-[12px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none" style={{ width: 70 }} aria-label="Player position">
              {positions.map((pos) => <option key={pos} value={pos} disabled={usedPositions.has(pos) && pos !== player.position}>{pos}</option>)}
            </select>
            <button onClick={() => setPlayers((current) => current.map((entry) => {
              if (entry.seat === player.seat) return { ...entry, isHero: true, name: entry.isSystemGenerated ? 'Hero' : entry.name };
              return { ...entry, isHero: false, name: entry.isSystemGenerated && entry.isHero ? `Opp ${entry.seat - 1}` : entry.name };
            }))} className={`rounded border px-1.5 py-1 text-[11px] font-bold uppercase transition ${player.isHero ? 'border-[#4ade80]/50 bg-[#4ade80]/10 text-[#4ade80]' : 'border-white/10 text-white/30 hover:text-white/60'}`} style={{ width: 45 }}>Hero</button>
          </div>
        ))}
      </div>

      {setupValid && (
        <div className="flex items-center gap-1 text-[11px] text-[#4ade80]">
          <Check className="h-3 w-3" /> Setup live — enter hole cards
        </div>
      )}
    </div>
  );
}

// ── Card Entry Status (left side, shows current card entry step + villain prompt) ──

function CardEntryStatus({
  state, heroCards, villainCards, cardsSkipped, cardTarget, villainPhase,
  onSelectTarget, onClearTarget, onSkip, onVillainEnter, onVillainSkip,
}: {
  state: BuilderState;
  heroCards: string[];
  villainCards: Record<string, string[]>;
  cardsSkipped: boolean;
  cardTarget: CardTarget;
  villainPhase: 'prompt' | 'enter' | 'skip' | null;
  onSelectTarget: (t: CardTarget) => void;
  onClearTarget: (t: CardTarget) => void;
  onSkip: () => void;
  onVillainEnter: () => void;
  onVillainSkip: () => void;
}) {
  const heroPlayer = state.players.find(p => p.isHero);
  const villains = state.players.filter(p => !p.isHero);
  const flopActive = needsBoardSelection(state) && state.street === 'flop';
  const turnActive = needsBoardSelection(state) && state.street === 'turn';
  const riverActive = needsBoardSelection(state) && state.street === 'river';

  const headerText = cardTarget
    ? cardTarget.type === 'hole'
      ? cardTarget.playerKey === '__hero'
        ? `SELECT HERO CARDS — ${heroCards.length}/2`
        : `SELECT ${cardTarget.playerKey.toUpperCase()} CARDS — ${(villainCards[cardTarget.playerKey] ?? []).length}/2`
      : `SELECT ${cardTarget.street.toUpperCase()} — ${boardCountForStreet(state, cardTarget.street)}/${cardTarget.maxCards}`
    : 'Cards';

  return (
    <div className="flex flex-col gap-1">
      <SectionLabel>{cardTarget ? headerText : 'Cards'}</SectionLabel>

      {/* Hole cards + board in compact pills */}
      <div className="flex flex-wrap gap-1.5">
        <CardPill
          label={heroPlayer?.position ?? 'Hero'}
          isHero
          cards={heroCards}
          active={cardTarget?.type === 'hole' && cardTarget?.playerKey === '__hero'}
          onClick={() => onSelectTarget({ type: 'hole', playerKey: '__hero', maxCards: 2 })}
          onClear={() => onClearTarget({ type: 'hole', playerKey: '__hero', maxCards: 2 })}
        />
        {villains.map(v => {
          const vCards = villainCards[v.name] ?? [];
          const isUnknown = villainPhase === 'skip' && vCards.length === 0;
          return (
            <CardPill
              key={v.name}
              label={v.position}
              cards={vCards}
              unknown={isUnknown}
              active={cardTarget?.type === 'hole' && cardTarget?.playerKey === v.name}
              onClick={() => onSelectTarget({ type: 'hole', playerKey: v.name, maxCards: 2 })}
              onClear={() => onClearTarget({ type: 'hole', playerKey: v.name, maxCards: 2 })}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <CardPill
          label="Flop"
          cards={state.board.flop}
          active={cardTarget?.type === 'board' && cardTarget?.street === 'flop'}
          canSelect={flopActive}
          onClick={() => onSelectTarget({ type: 'board', street: 'flop', maxCards: 3 })}
          onClear={() => onClearTarget({ type: 'board', street: 'flop', maxCards: 3 })}
        />
        <CardPill
          label="Turn"
          cards={state.board.turn ? [state.board.turn] : []}
          active={cardTarget?.type === 'board' && cardTarget?.street === 'turn'}
          canSelect={turnActive}
          onClick={() => onSelectTarget({ type: 'board', street: 'turn', maxCards: 1 })}
          onClear={() => onClearTarget({ type: 'board', street: 'turn', maxCards: 1 })}
        />
        <CardPill
          label="River"
          cards={state.board.river ? [state.board.river] : []}
          active={cardTarget?.type === 'board' && cardTarget?.street === 'river'}
          canSelect={riverActive}
          onClick={() => onSelectTarget({ type: 'board', street: 'river', maxCards: 1 })}
          onClear={() => onClearTarget({ type: 'board', street: 'river', maxCards: 1 })}
        />
      </div>

      {/* Skip cards (before hero cards entered) */}
      {heroCards.length < 2 && !cardsSkipped && !cardTarget && (
        <button onClick={onSkip} className="self-start rounded border border-white/10 px-2 py-1 text-[11px] font-bold uppercase text-white/40 hover:bg-white/5 transition">
          Skip Cards
        </button>
      )}

      {/* Villain card prompt (after hero cards confirmed) */}
      {villainPhase === 'prompt' && heroCards.length === 2 && (
        <div className="flex items-center gap-2 rounded border border-[#d4a52c]/20 bg-[#c0911e]/5 px-2 py-1.5">
          <span className="text-[12px] font-bold text-white/60">Villain Cards:</span>
          <button onClick={onVillainEnter} className="rounded border border-[#d4a52c]/30 bg-[#c0911e]/10 px-2.5 py-1 text-[11px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/20 transition">Enter Cards</button>
          <button onClick={onVillainSkip} className="rounded border border-white/10 px-2.5 py-1 text-[11px] font-bold uppercase text-white/40 hover:bg-white/5 transition">Unknown / Skip</button>
        </div>
      )}
    </div>
  );
}

function boardCountForStreet(st: BuilderState, street: Street): number {
  if (street === 'flop') return st.board.flop.length;
  if (street === 'turn') return st.board.turn ? 1 : 0;
  if (street === 'river') return st.board.river ? 1 : 0;
  return 0;
}

function CardPill({ label, isHero, cards, unknown, active, canSelect, onClick, onClear }: { label: string; isHero?: boolean; cards: string[]; unknown?: boolean; active: boolean; canSelect?: boolean; onClick: () => void; onClear: () => void }) {
  const hasCards = cards.length > 0;
  const showButton = canSelect || !hasCards || active || unknown;
  return (
    <div className={`flex items-center gap-1.5 rounded border px-1.5 py-1 transition ${active ? 'border-[#d4a52c]/50 bg-[#c0911e]/8' : hasCards ? 'border-white/[0.08] bg-black/20' : 'border-white/[0.06] bg-black/10'}`}>
      <span className={`text-[11px] font-bold ${isHero ? 'text-[#4ade80]' : 'text-white/50'}`}>{label}</span>
      <div className="flex gap-0.5">
        {hasCards ? cards.map(c => <span key={c} className="text-[14px] font-bold" style={{ color: cardColor(c) }}>{cardLabel(c)}</span>)
          : unknown ? <span className="text-[12px] font-bold text-white/30">XX</span>
          : <span className="text-[12px] text-white/20">--</span>}
      </div>
      {showButton && (
        <button onClick={onClick} className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase transition ${active ? 'border-[#d4a52c]/40 bg-[#c0911e]/15 text-[#f5e6b0]' : 'border-[#d4a52c]/20 bg-[#c0911e]/8 text-[#d4a52c] hover:bg-[#c0911e]/15'}`}>
          {hasCards ? 'Edit' : unknown ? 'Reveal' : 'Enter'}
        </button>
      )}
      {hasCards && !active && (
        <button onClick={onClear} className="text-[10px] font-bold uppercase text-white/30 hover:text-white/60">Clear</button>
      )}
    </div>
  );
}

// ── Persistent Card Palette (active state) ──

function CardPalette({ target, selectedCards, usedCards, onSelect, onConfirm, onClose, canConfirm }: {
  target: NonNullable<CardTarget>;
  selectedCards: string[];
  usedCards: Set<string>;
  onSelect: (c: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  canConfirm: boolean;
}) {
  const title = target.type === 'hole'
    ? target.playerKey === '__hero' ? 'Hero Cards' : `${target.playerKey} Cards`
    : target.street;

  return (
    <div className="rounded-lg border p-2 sticky top-2" style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(8,10,12,0.65)' }}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] font-bold text-[#f5e6b0]">{title} <span className="text-white/40">{selectedCards.length}/{target.maxCards}</span></span>
        <button onClick={onClose} className="rounded p-0.5 text-white/30 hover:bg-white/10 hover:text-white/60"><X className="h-3.5 w-3.5" /></button>
      </div>
      {selectedCards.length > 0 && (
        <div className="mb-1.5 flex items-center gap-1">
          {selectedCards.map(c => <span key={c} className="text-[16px] font-bold" style={{ color: cardColor(c) }}>{cardLabel(c)}</span>)}
        </div>
      )}
      <div className="space-y-0.5">
        {CARD_SUITS.map(suit => (
          <div key={suit} className="flex items-center gap-1">
            <div className="flex h-7 w-5 shrink-0 items-center justify-center">
              <span className="text-[14px] font-bold" style={{ color: SUIT_COLORS[suit] }}>{SUIT_SYMBOLS[suit]}</span>
            </div>
            <div className="flex flex-wrap gap-0.5">
              {CARD_RANKS.map(rank => {
                const card = `${rank}${suit}`;
                const isSelected = selectedCards.includes(card);
                const isUsed = usedCards.has(card) && !isSelected;
                return (
                  <button key={card} onClick={() => onSelect(card)} disabled={isUsed}
                    className={`flex h-7 w-7 items-center justify-center rounded border text-[12px] font-bold transition ${
                      isSelected ? 'border-[#d4a52c]/60 bg-[#c0911e]/20 text-[#f5e6b0]'
                        : isUsed ? 'border-white/5 bg-white/[0.01] text-white/15 cursor-not-allowed'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:border-[#d4a52c]/30'
                    }`}
                    style={!isSelected && !isUsed ? { color: SUIT_COLORS[suit] } : undefined}>
                    {rank}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button onClick={onConfirm} disabled={!canConfirm} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-[#d4a52c]/40 bg-[#c0911e]/15 px-3 py-1.5 text-[12px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/25 transition disabled:opacity-30">
        <Check className="h-3.5 w-3.5" /> Confirm
      </button>
    </div>
  );
}

// ── Dimmed Card Palette (before setup is valid) ──

function DimmedCardPalette({ setupValid }: { setupValid: boolean }) {
  return (
    <div className="rounded-lg border p-2 opacity-30 pointer-events-none" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(8,10,12,0.4)' }}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] font-bold text-white/40">Card Selector</span>
      </div>
      <div className="mb-2 text-center text-[12px] text-white/30 py-4">
        {setupValid ? 'Select a card target on the left' : 'Finish setup to begin'}
      </div>
      <div className="space-y-0.5">
        {CARD_SUITS.map(suit => (
          <div key={suit} className="flex items-center gap-1">
            <div className="flex h-7 w-5 shrink-0 items-center justify-center">
              <span className="text-[14px] font-bold" style={{ color: SUIT_COLORS[suit] }}>{SUIT_SYMBOLS[suit]}</span>
            </div>
            <div className="flex flex-wrap gap-0.5">
              {CARD_RANKS.map(rank => (
                <div key={`${rank}${suit}`} className="flex h-7 w-7 items-center justify-center rounded border border-white/5 bg-white/[0.01] text-[12px] font-bold text-white/20">
                  {rank}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Action Tree (with position jump) ──

function ActionTree({
  state, sizingInput, sizingMode, onSizingInputChange, onSizingModeChange, onAction, onJumpToPosition, onUndo, onReset, onSave,
  decisionPointId, onSetDecisionPoint,
}: {
  state: BuilderState;
  sizingInput: string;
  sizingMode: 'bb' | 'chips' | 'pot';
  onSizingInputChange: (v: string) => void;
  onSizingModeChange: (m: 'bb' | 'chips' | 'pot') => void;
  onAction: (type: BuilderActionType, amount?: number) => void;
  onJumpToPosition: (position: string) => void;
  onUndo: () => void;
  onReset: () => void;
  onSave: () => void;
  decisionPointId: string | null;
  onSetDecisionPoint: (id: string) => void;
}) {
  const streets: Street[] = ['preflop', 'flop', 'turn', 'river'];
  const bbValue = state.setup.bigBlind;
  const player = state.players.find(p => p.name === state.currentActor);

  const needsSizing = state.legalActions.includes('bet') || state.legalActions.includes('raise');
  const potValue = computeTotalPot(state);
  const getSizingAmount = (): number => {
    const raw = parseFloat(sizingInput);
    if (isNaN(raw)) return 0;
    if (sizingMode === 'bb') return raw * bbValue;
    if (sizingMode === 'pot') return potValue * (raw / 100);
    return raw;
  };
  const sizingAmount = getSizingAmount();
  const callAmount = state.amountToCall;
  const raiseTotal = player ? player.committedThisStreet + sizingAmount : 0;
  const raiseMin = state.currentStreetBet + state.minRaise;

  const jumpablePositions = state.players.filter(p => !p.folded && !p.allIn && p.name !== state.currentActor);

  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>Action</SectionLabel>

      {/* Completed actions history */}
      <div className="rounded-lg border p-2" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.4)' }}>
        {state.actions.length === 0 && <div className="text-[12px] text-white/25">Blinds posted. First action below.</div>}
        {streets.map(street => {
          const actions = state.actions.filter(a => a.street === street);
          if (actions.length === 0) return null;
          const boardCards: string[] = street === 'flop' ? state.board.flop : street === 'turn' ? [state.board.turn ?? ''].filter(Boolean) : street === 'river' ? [state.board.river ?? ''].filter(Boolean) : [];
          return (
            <div key={street} className="mb-1.5 last:mb-0">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="text-[12px] font-bold uppercase text-white/45">{street}</span>
                {boardCards.length > 0 && <span className="text-[14px] font-bold">{boardCards.map(c => <span key={c} className="mr-0.5" style={{ color: cardColor(c) }}>{cardLabel(c)}</span>)}</span>}
              </div>
              {actions.map(a => {
                const p = state.players.find(pl => pl.name === a.player);
                const isHero = p?.isHero ?? false;
                const isDecision = decisionPointId === a.actionId;
                const amt = a.amount ?? 0;
                const amtStr = amt % 1 === 0 ? amt.toString() : amt.toFixed(1);
                return (
                  <div key={a.actionId} className={`group flex items-center gap-2 py-0.5 text-[13px] ${isDecision ? 'rounded border border-[#d4a52c]/30 bg-[#d4a52c]/5 px-1.5' : ''}`}>
                    <span className={`w-9 shrink-0 text-[12px] font-bold ${isHero ? 'text-[#4ade80]' : 'text-white/50'}`}>{a.position}</span>
                    <span className="text-white/65 flex-1">
                      {a.type === 'fold' ? 'folds' : a.type === 'check' ? 'checks' : a.type === 'call' ? `calls ${amtStr}` : a.type === 'bet' ? `bets ${amtStr}` : a.type === 'raise' ? `raises to ${amtStr}` : a.type === 'allin' ? `all-in ${amtStr}` : a.type}
                    </span>
                    {isDecision && <Star className="h-3 w-3 shrink-0" style={{ color: GOLD }} fill={GOLD} />}
                    {!isDecision && <button onClick={() => onSetDecisionPoint(a.actionId)} className="shrink-0 opacity-0 transition group-hover:opacity-100 hover:text-[#d4a52c]" title="Mark decision point"><Star className="h-3 w-3 text-white/20" /></button>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Current decision */}
      {!state.isComplete && !needsBoardSelection(state) && player && (
        <div className="rounded-lg border p-2" style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(8,10,12,0.6)' }}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded border border-[#d4a52c]/30 bg-[#c0911e]/10 px-2 py-1 text-[13px] font-bold text-[#f5e6b0]">{player.position}</span>
            {player.isHero && <span className="text-[13px] font-bold text-[#4ade80]">HERO</span>}
            <span className="text-[12px] text-white/50 ml-auto">{(player.currentStack / bbValue).toFixed(1)} BB</span>
          </div>

          {/* Position jump — skip to a later position, auto-folding in between */}
          {jumpablePositions.length > 0 && (
            <div className="mb-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold uppercase text-white/30">Jump to:</span>
              {jumpablePositions.map(p => (
                <button key={p.name} onClick={() => onJumpToPosition(p.position)} className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] font-bold text-white/50 hover:bg-white/5 hover:text-white/70 transition">
                  {p.position}{p.isHero ? ' ★' : ''}
                </button>
              ))}
            </div>
          )}

          {needsSizing && (
            <div className="mb-2">
              <div className="mb-1 flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {(['bb', 'chips', 'pot'] as const).map(m => (
                    <button key={m} onClick={() => onSizingModeChange(m)} className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase transition ${sizingMode === m ? 'bg-[#c0911e]/20 text-[#f5e6b0]' : 'bg-white/5 text-white/40 hover:text-white/60'}`}>{m === 'pot' ? '%pot' : m}</button>
                  ))}
                </div>
                <input type="number" value={sizingInput} onChange={(e) => onSizingInputChange(e.target.value)} placeholder={sizingMode === 'bb' ? '2.2' : sizingMode === 'pot' ? '66' : 'chips'} className="w-24 rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[13px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none" />
                {sizingAmount > 0 && <span className="text-[11px] text-white/40">= <span className="font-mono text-[#f5e6b0] font-bold">{(sizingAmount / bbValue).toFixed(1)} BB</span></span>}
              </div>
              <div className="flex flex-wrap gap-0.5">
                {sizingMode === 'bb' && [2, 2.2, 2.5, 3, 4, 5].map(s => <button key={s} onClick={() => onSizingInputChange(String(s))} className="rounded border border-white/10 px-2 py-0.5 text-[11px] font-bold text-white/50 hover:bg-white/5">{s}bb</button>)}
                {sizingMode === 'pot' && [25, 33, 50, 66, 75, 100, 125].map(s => <button key={s} onClick={() => onSizingInputChange(String(s))} className="rounded border border-white/10 px-2 py-0.5 text-[11px] font-bold text-white/50 hover:bg-white/5">{s}%</button>)}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-1.5">
            {state.legalActions.map(type => {
              const style = ACTION_BTN_STYLES[type];
              let label = ACTION_LABELS[type];
              let handler = () => onAction(type);
              let disabled = false;
              if (type === 'bet') { label = `Bet${sizingAmount > 0 ? ' ' + (sizingAmount / bbValue).toFixed(1) + 'BB' : ''}`; handler = () => onAction(type, sizingAmount); disabled = sizingAmount <= 0; }
              else if (type === 'raise') { label = `Raise${raiseTotal > 0 ? ' ' + (raiseTotal / bbValue).toFixed(1) + 'BB' : ''}`; handler = () => onAction(type, raiseTotal); disabled = raiseTotal < raiseMin; }
              else if (type === 'call') { label = `Call${callAmount > 0 ? ' ' + (callAmount / bbValue).toFixed(1) + 'BB' : ''}`; }
              else if (type === 'allin') { label = `All-In ${(player.currentStack / bbValue).toFixed(1)}BB`; }
              return <button key={type} onClick={handler} disabled={disabled} className={`rounded-lg border px-3 py-1.5 text-[13px] font-bold uppercase transition disabled:opacity-30 ${style}`}>{label}</button>;
            })}
          </div>
          {state.legalActions.includes('raise') && <div className="mt-1 text-[11px] text-white/30">Min raise to: <span className="font-mono">{(raiseMin / bbValue).toFixed(1)} BB</span></div>}
        </div>
      )}

      {/* Board selection prompt */}
      {needsBoardSelection(state) && !state.isComplete && (
        <div className="rounded-lg border p-2 text-[13px] text-white/50" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.4)' }}>
          Select {state.street} cards using the palette on the right.
        </div>
      )}

      {/* Street complete indicator */}
      {state.isComplete && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-lg border border-[#d4a52c]/30 bg-[#c0911e]/10 p-2">
            <Check className="h-4 w-4 text-[#d4a52c]" />
            <div>
              <div className="text-[13px] font-bold text-[#f5e6b0]">Hand Complete</div>
              <div className="text-[12px] text-white/50">{state.winners.length > 0 ? state.winners.map(w => `${w.player} wins ${(w.amount / bbValue).toFixed(1)} BB`).join(' · ') : 'Hand ended'}</div>
            </div>
          </div>
          {decisionPointId && <div className="flex items-center gap-2 rounded border border-[#d4a52c]/20 bg-[#d4a52c]/5 p-1.5"><Star className="h-3 w-3" style={{ color: GOLD }} /><span className="text-[12px] text-white/60">Decision point marked</span></div>}
          <div className="flex items-center gap-1.5">
            <button onClick={onUndo} className="flex items-center gap-1 rounded border border-white/10 px-2.5 py-1.5 text-[12px] font-bold uppercase text-white/50 hover:bg-white/5 transition"><Undo2 className="h-3.5 w-3.5" /> Undo</button>
            <button onClick={onReset} className="flex items-center gap-1 rounded border border-white/10 px-2.5 py-1.5 text-[12px] font-bold uppercase text-white/40 hover:text-white/60 transition"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
            <button onClick={onSave} className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2 text-[13px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/30 transition"><Check className="h-3.5 w-3.5" /> Generate Hand</button>
          </div>
        </div>
      )}

      {/* Undo for in-progress */}
      {!state.isComplete && state.actions.length > 0 && (
        <button onClick={onUndo} className="self-start flex items-center gap-1 rounded border border-white/10 px-2.5 py-1 text-[11px] font-bold uppercase text-white/40 hover:bg-white/5 transition"><Undo2 className="h-3 w-3" /> Undo Last</button>
      )}
    </div>
  );
}

// ── Compact Live Hand Summary ──

function LiveHandSummary({ state, heroCards, villainCards, potInBB, potType }: { state: BuilderState; heroCards: string[]; villainCards: Record<string, string[]>; potInBB: number; potType: string | null }) {
  const bbValue = state.setup.bigBlind;
  const heroPlayer = state.players.find(p => p.isHero);
  const villains = state.players.filter(p => !p.isHero);

  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>Live Hand</SectionLabel>

      {/* Players + cards compact */}
      <div className="rounded-lg border p-2 flex flex-col gap-1" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.4)' }}>
        {heroPlayer && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#4ade80]">{heroPlayer.position} <span className="text-white/30 text-[10px]">Hero</span></span>
            <div className="flex items-center gap-0.5">
              {heroCards.length === 2 ? heroCards.map(c => <span key={c} className="text-[14px] font-bold" style={{ color: cardColor(c) }}>{cardLabel(c)}</span>) : <span className="text-[12px] text-white/25">??</span>}
            </div>
          </div>
        )}
        {villains.map(v => {
          const cards = villainCards[v.name] ?? [];
          return (
            <div key={v.name} className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-white/60">{v.position}</span>
              <div className="flex items-center gap-0.5">
                {cards.length === 2 ? cards.map(c => <span key={c} className="text-[14px] font-bold" style={{ color: cardColor(c) }}>{cardLabel(c)}</span>) : <span className="text-[12px] text-white/25">??</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Board compact */}
      <div className="rounded-lg border p-2" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.4)' }}>
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-0.5">Board</div>
        <div className="flex items-center gap-1">
          {state.board.flop.length === 3 ? state.board.flop.map(c => <span key={c} className="text-[14px] font-bold" style={{ color: cardColor(c) }}>{cardLabel(c)}</span>) : <><span className="text-[12px] text-white/15">?</span><span className="text-[12px] text-white/15">?</span><span className="text-[12px] text-white/15">?</span></>}
          {state.board.turn ? <span className="text-[14px] font-bold ml-0.5" style={{ color: cardColor(state.board.turn) }}>{cardLabel(state.board.turn)}</span> : <span className="text-[12px] text-white/15 ml-0.5">?</span>}
          {state.board.river ? <span className="text-[14px] font-bold ml-0.5" style={{ color: cardColor(state.board.river) }}>{cardLabel(state.board.river)}</span> : <span className="text-[12px] text-white/15 ml-0.5">?</span>}
        </div>
      </div>

      {/* Pot + stacks compact */}
      <div className="rounded-lg border p-2" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.4)' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">Pot</span>
          <span className="font-mono font-bold text-[#f5e6b0] text-[14px]">{potInBB.toFixed(1)} BB</span>
        </div>
        {potType && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">Type</span>
            <span className="text-[12px] font-bold text-[#d4a52c]">{potType}</span>
          </div>
        )}
        <div className="border-t pt-1" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {state.players.map(p => (
            <div key={p.name} className="flex items-center justify-between py-0.5">
              <span className={`text-[11px] ${p.isHero ? 'text-[#4ade80] font-bold' : 'text-white/60'}`}>{p.position}{p.isHero && ' ★'}</span>
              <span className="font-mono text-[11px] text-white/70">{(p.currentStack / bbValue).toFixed(1)} BB</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function derivePotType(state: BuilderState): string | null {
  const preflopActions = state.actions.filter(a => a.street === 'preflop');
  if (preflopActions.length === 0) return null;
  const raises = preflopActions.filter(a => a.type === 'raise' || a.type === 'bet').length;
  if (raises === 0) return 'Limped Pot';
  if (raises === 1) return 'SRP';
  if (raises === 2) return '3-Bet Pot';
  return '4-Bet+ Pot';
}

const ACTION_BTN_STYLES: Record<BuilderActionType, string> = {
  fold: 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20',
  check: 'border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20',
  call: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
  bet: 'border-[#d4a52c]/40 bg-[#c0911e]/15 text-[#f5e6b0] hover:bg-[#c0911e]/25',
  raise: 'border-orange-500/40 bg-orange-500/15 text-orange-400 hover:bg-orange-500/25',
  allin: 'border-red-600/50 bg-red-600/20 text-red-300 hover:bg-red-600/30',
};

const ACTION_LABELS: Record<BuilderActionType, string> = {
  fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise', allin: 'All-In',
};

// ── UI helpers ──

function CompactField({ label, value, onChange, step, placeholder, width }: { label: string; value: number | null; onChange: (v: number | null) => void; step: number; placeholder?: string; width?: number }) {
  return (
    <div className="flex flex-col">
      <span className="mb-0.5 text-[9px] font-bold uppercase text-white/35">{label}</span>
      <input type="number" value={value ?? ''} step={step} placeholder={placeholder} onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value) || 0)} className="rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[12px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none" style={{ width: width ?? 80 }} />
    </div>
  );
}
