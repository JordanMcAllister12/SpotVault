import { useState, useMemo, useCallback, useEffect } from 'react';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { PreflopMatrix } from './PreflopMatrix';
import { PostflopNodeView } from './PostflopNodeView';
import { BoardSelector, BoardDisplay, type PickerTarget } from './BoardSelector';
import { calculatePot, positionsForTable, potBeforeAction } from '@/lib/solver/potCalculator';
import { deriveRangesFromActions, generateNodeStrategyAsync } from '@/lib/solver/nodeStrategy';
import {
  STACK_PRESETS,
  ACCURACY_OPTIONS,
  SEAT_COUNTS,
  DEFAULT_TABLE_CONFIG,
  POSITIONS,
  type SolverFormat,
  type SolverAccuracy,
  type SolverTreeSettings,
  type SolverTableConfig,
  type SolverPosition,
  type SolverConfig,
} from '@/lib/solver/types';

type Step = 'preflop' | 'flop' | 'turn' | 'river';
const STEP_ORDER: Step[] = ['preflop', 'flop', 'turn', 'river'];

type SolveType = 'chipev' | 'icm';
type TournamentType = 'classic' | 'pko';

interface ICMConfig {
  startingField: number;
  playersRemaining: number;
  tournamentType: TournamentType;
  payouts: { position: number; amount: number }[];
}

interface NewSolveFlowProps {
  config: SolverConfig;
  onUpdate: (patch: Partial<SolverConfig>) => void;
  onSetFormat: (fmt: SolverFormat) => void;
  onSetStack: (bb: number) => void;
  onSetBoard: (board: SolverConfig['board']) => void;
  onSetActionHistory: (actions: SolverConfig['action_history']) => void;
  onSetTableConfig: (config: SolverTableConfig) => void;
  onSetAccuracy: (acc: SolverAccuracy) => void;
  onSetTreeSettings: (settings: SolverTreeSettings) => void;
  onSubmit: () => void;
  onCancel: () => void;
  error: string | null;
}

const SEG_BTN = 'rounded-[6px] border px-2.5 py-1.5 text-[10px] font-semibold transition-all whitespace-nowrap';
const SEG_ON = 'border-[#d4a52c]/40 bg-[#d4a52c]/10 text-[#f5e6b0]';
const SEG_OFF = 'border-white/10 bg-white/[0.02] text-white/45 hover:text-white/75 hover:border-white/20';
const INPUT = 'w-full rounded-[5px] border border-white/10 bg-[#0a0c0e] px-2 py-1.5 text-[11px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none';
const LABEL = 'text-[9px] font-mono tracking-[0.18em] text-white/40 uppercase mb-1.5 block';
const SIDEBAR_SECTION = 'solver-sidebar-section border-b border-white/[0.05] px-3 py-2.5';

const PHASE_PRESETS = [
  { label: '75%', pct: 0.75 },
  { label: '50%', pct: 0.50 },
  { label: '25%', pct: 0.25 },
  { label: '18%', pct: 0.18 },
  { label: 'Bubble', pct: 0.15 },
  { label: '10%', pct: 0.10 },
  { label: '5%', pct: 0.05 },
  { label: 'FT', pct: 0.009 },
];

export function NewSolveFlow(props: NewSolveFlowProps) {
  const [step, setStep] = useState<Step>('preflop');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [solveType, setSolveType] = useState<SolveType>('chipev');
  const [payoutsOpen, setPayoutsOpen] = useState(false);
  const [betSizeMode, setBetSizeMode] = useState<'single' | 'multi'>('single');
  const [stacksOpen, setStacksOpen] = useState(false);
  const [icmOpen, setIcmOpen] = useState(false);
  const [selectedHand, setSelectedHand] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState<PickerTarget | null>(null);
  const [autoAdvance, setAutoAdvance] = useState(false);

  const [playerStacks, setPlayerStacks] = useState<Record<SolverPosition, number>>(() => {
    const stacks = {} as Record<SolverPosition, number>;
    for (const pos of POSITIONS) stacks[pos] = 40;
    return stacks;
  });

  const [applyAllStacks, setApplyAllStacks] = useState(40);

  const [icmConfig, setICMConfig] = useState<ICMConfig>({
    startingField: 1000,
    playersRemaining: 500,
    tournamentType: 'classic',
    payouts: [],
  });

  const { config } = props;
  const tableConfig = config.table_config ?? DEFAULT_TABLE_CONFIG;

  const potCalc = useMemo(
    () => calculatePot(config.effective_stack_bb, tableConfig, config.action_history, config.board),
    [config.effective_stack_bb, tableConfig, config.action_history, config.board],
  );

  const startingPot = useMemo(() => potBeforeAction(tableConfig), [tableConfig]);

  const activePositions = useMemo(
    () => positionsForTable(tableConfig.seat_count),
    [tableConfig.seat_count],
  );

  const reachableSteps = useMemo(() => {
    const steps: Step[] = ['preflop'];
    if (config.board.length >= 3) steps.push('flop');
    if (config.board.length >= 4) steps.push('turn');
    if (config.board.length >= 5) steps.push('river');
    return steps;
  }, [config.board.length]);

  const stepIndex = STEP_ORDER.indexOf(step);

  // Derive current actor for the right panel
  const currentActorForStrategy = useMemo((): SolverPosition | null => {
    const streetActions = config.action_history.filter((a) => {
      if (step === 'preflop') return a.street === 'preflop';
      if (step === 'flop') return a.street === 'flop';
      if (step === 'turn') return a.street === 'turn';
      return a.street === 'river';
    });

    if (step === 'preflop') {
      const folded = new Set<SolverPosition>();
      const allIn = new Set<SolverPosition>();
      for (const a of config.action_history) {
        if (a.action === 'fold') folded.add(a.position);
        if (a.action === 'all-in') allIn.add(a.position);
      }
      const remaining = activePositions.filter((p) => !folded.has(p) && !allIn.has(p));
      if (remaining.length <= 1) return remaining[0] ?? null;
      if (streetActions.length === 0) return activePositions[0] ?? 'UTG';
      const lastActor = streetActions[streetActions.length - 1].position;
      const lastIdx = activePositions.indexOf(lastActor);
      for (let i = 1; i <= activePositions.length; i++) {
        const next = activePositions[(lastIdx + i) % activePositions.length];
        if (!folded.has(next) && !allIn.has(next)) return next;
      }
      return null;
    }

    if (streetActions.length === 0) return null;
    const folded = new Set<SolverPosition>();
    const allIn = new Set<SolverPosition>();
    for (const a of config.action_history) {
      if (a.action === 'fold') folded.add(a.position);
      if (a.action === 'all-in') allIn.add(a.position);
    }
    const remaining = activePositions.filter((p) => !folded.has(p) && !allIn.has(p));
    if (remaining.length <= 1) return remaining[0] ?? null;
    const lastActor = streetActions[streetActions.length - 1].position;
    const lastIdx = activePositions.indexOf(lastActor);
    for (let i = 1; i <= activePositions.length; i++) {
      const next = activePositions[(lastIdx + i) % activePositions.length];
      if (!folded.has(next) && !allIn.has(next)) return next;
    }
    return null;
  }, [config.action_history, step, activePositions]);

  // Async strategy fetch
  const [nodeStrategy, setNodeStrategy] = useState<Awaited<ReturnType<typeof generateNodeStrategyAsync>>>(null);
  useEffect(() => {
    if (!currentActorForStrategy) { setNodeStrategy(null); return; }
    let cancelled = false;
    generateNodeStrategyAsync(
      currentActorForStrategy, step, config.action_history, config.board, tableConfig,
      config.effective_stack_bb, step === 'preflop' ? startingPot : potCalc.pot_bb, config.format, solveType,
    ).then(result => { if (!cancelled) setNodeStrategy(result); })
     .catch(() => { if (!cancelled) setNodeStrategy(null); });
    return () => { cancelled = true; };
  }, [currentActorForStrategy, step, config.action_history, config.board, tableConfig, config.effective_stack_bb, startingPot, potCalc.pot_bb, config.format, solveType]);

  // Clear selected hand when strategy changes (node change)
  useEffect(() => {
    setSelectedHand(null);
  }, [nodeStrategy]);

  const handleAddAction = (action: SolverConfig['action_history'][number]) => {
    props.onSetActionHistory([...config.action_history, action]);
  };

  const handleSolveDecision = () => {
    const derived = deriveRangesFromActions(config.action_history, tableConfig);
    const patch: Partial<SolverConfig> = { pot_size_bb: potCalc.pot_bb };
    if (derived) {
      patch.hero_position = derived.hero_position;
      patch.villain_position = derived.villain_position;
      patch.hero_range = derived.hero_range;
      patch.villain_range = derived.villain_range;
    }
    props.onUpdate(patch);
    props.onSubmit();
  };

  const handleContinue = () => {
    if (step === 'preflop') setStep('flop');
    else if (step === 'flop') setStep('turn');
    else if (step === 'turn') setStep('river');
  };

  // Clear downstream board cards + actions when an earlier street's cards change
  const handleBoardChange = useCallback((newBoard: SolverConfig['board']) => {
    const prevLen = config.board.length;
    const newLen = newBoard.length;
    // If the board got shorter or changed an earlier street, clear downstream actions
    if (newLen < prevLen) {
      const clearedActions = config.action_history.filter((a) => {
        if (newLen < 3 && a.street !== 'preflop') return false;
        if (newLen === 3 && (a.street === 'turn' || a.street === 'river')) return false;
        if (newLen === 4 && a.street === 'river') return false;
        return true;
      });
      props.onSetActionHistory(clearedActions);
    }
    props.onSetBoard(newBoard);
  }, [config.board, config.action_history, props]);

  // Open the picker for a target street
  const openPicker = useCallback((target: PickerTarget) => {
    setPickerOpen(target);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(null);
  }, []);

  // When a street's card selection completes, advance to that street
  const handlePickerComplete = useCallback(() => {
    if (pickerOpen === 'flop') {
      setStep('flop');
    } else if (pickerOpen === 'turn') {
      setStep('turn');
    } else if (pickerOpen === 'river') {
      setStep('river');
    }
  }, [pickerOpen]);

  // Auto-open flop picker when entering flop step with no flop cards
  useEffect(() => {
    if (step === 'flop' && config.board.length < 3 && !pickerOpen) {
      setPickerOpen('flop');
    }
  }, [step, config.board.length, pickerOpen]);

  // Auto-open turn picker when entering turn step with no turn card
  useEffect(() => {
    if (step === 'turn' && config.board.length < 4 && !pickerOpen) {
      setPickerOpen('turn');
    }
  }, [step, config.board.length, pickerOpen]);

  // Auto-open river picker when entering river step with no river card
  useEffect(() => {
    if (step === 'river' && config.board.length < 5 && !pickerOpen) {
      setPickerOpen('river');
    }
  }, [step, config.board.length, pickerOpen]);

  // Auto-advance: when the current street's action round is complete (no more actors),
  // automatically advance to the next street and open its card picker
  useEffect(() => {
    if (!autoAdvance) return;
    if (currentActorForStrategy !== null) return;
    if (step === 'flop' && config.board.length >= 3 && config.board.length < 4) {
      setStep('turn');
      setAutoAdvance(false);
    } else if (step === 'turn' && config.board.length >= 4 && config.board.length < 5) {
      setStep('river');
      setAutoAdvance(false);
    }
  }, [autoAdvance, currentActorForStrategy, step, config.board.length]);

  // Enable auto-advance whenever an action is added on a postflop street
  useEffect(() => {
    if (step !== 'preflop' && config.action_history.length > 0) {
      const lastAction = config.action_history[config.action_history.length - 1];
      if (lastAction.street === step) {
        setAutoAdvance(true);
      }
    }
  }, [config.action_history, step]);

  const updateTableConfig = (patch: Partial<SolverTableConfig>) => {
    props.onSetTableConfig({ ...tableConfig, ...patch });
  };

  const handleApplyAllStacks = useCallback(() => {
    const updated = {} as Record<SolverPosition, number>;
    for (const pos of POSITIONS) updated[pos] = applyAllStacks;
    setPlayerStacks(updated);
    props.onSetStack(applyAllStacks);
  }, [applyAllStacks, props]);

  const handleStackPreset = useCallback((bb: number) => {
    const updated = {} as Record<SolverPosition, number>;
    for (const pos of POSITIONS) updated[pos] = bb;
    setPlayerStacks(updated);
    setApplyAllStacks(bb);
    props.onSetStack(bb);
  }, [props]);

  const handleIndividualStack = useCallback((pos: SolverPosition, value: number) => {
    setPlayerStacks((prev) => {
      const updated = { ...prev, [pos]: value };
      const eff = Math.min(...activePositions.map((p) => updated[p]));
      props.onSetStack(eff);
      return updated;
    });
  }, [activePositions, props]);

  const handleSolveTypeChange = (type: SolveType) => {
    setSolveType(type);
    if (type === 'chipev') {
      props.onSetFormat('cash');
    } else {
      props.onSetFormat('tournament');
    }
  };

  const showICM = solveType === 'icm';
  const avgStack = useMemo(() => {
    const vals = activePositions.map((p) => playerStacks[p] ?? 40);
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }, [activePositions, playerStacks]);

  const nextStepLabel = (() => {
    if (step === 'preflop') return 'Next: Flop';
    if (step === 'flop') return 'Next: Turn';
    if (step === 'turn') return 'Next: River';
    return null;
  })();

  const canGoNext = step !== 'river' && reachableSteps.includes(STEP_ORDER[stepIndex + 1]);

  const spr = potCalc.pot_bb > 0 ? (config.effective_stack_bb / potCalc.pot_bb).toFixed(1) : '—';

  const selectedHandStrategy = useMemo(() => {
    if (!selectedHand || !nodeStrategy) return null;
    return nodeStrategy.strategy_by_hand[selectedHand] ?? null;
  }, [selectedHand, nodeStrategy]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ============ LEFT SIDEBAR — INPUTS ============ */}
      <div className="solver-left-panel hidden w-[17%] shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] md:flex">
        {/* GAME */}
        <div className={SIDEBAR_SECTION}>
          <span className={LABEL}>Game</span>
          <div className="flex gap-1">
            {(['tournament', 'cash'] as SolverFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => props.onSetFormat(fmt)}
                className={`${SEG_BTN} flex-1 ${config.format === fmt ? SEG_ON : SEG_OFF}`}
              >
                {fmt === 'tournament' ? 'Tournament' : 'Cash'}
              </button>
            ))}
          </div>
        </div>

        {/* SOLVE TYPE */}
        <div className={SIDEBAR_SECTION}>
          <span className={LABEL}>Solve</span>
          <div className="flex gap-1">
            <button onClick={() => handleSolveTypeChange('chipev')} className={`${SEG_BTN} flex-1 ${solveType === 'chipev' ? SEG_ON : SEG_OFF}`}>
              ChipEV
            </button>
            <button onClick={() => handleSolveTypeChange('icm')} className={`${SEG_BTN} flex-1 ${solveType === 'icm' ? SEG_ON : SEG_OFF}`}>
              ICM
            </button>
          </div>
        </div>

        {/* PLAYERS */}
        <div className={SIDEBAR_SECTION}>
          <span className={LABEL}>Players</span>
          <div className="flex flex-wrap gap-1">
            {SEAT_COUNTS.map((seats) => (
              <button
                key={seats}
                onClick={() => updateTableConfig({ seat_count: seats })}
                className={`${SEG_BTN} ${tableConfig.seat_count === seats ? SEG_ON : SEG_OFF}`}
                style={{ minWidth: '28px', textAlign: 'center' }}
              >
                {seats}
              </button>
            ))}
          </div>
        </div>

        {/* ANTE */}
        <div className={SIDEBAR_SECTION}>
          <span className={LABEL}>Ante</span>
          <div className="flex gap-1">
            <button onClick={() => updateTableConfig({ ante_type: 'none' })} className={`${SEG_BTN} flex-1 ${tableConfig.ante_type === 'none' ? SEG_ON : SEG_OFF}`}>
              None
            </button>
            <button onClick={() => updateTableConfig({ ante_type: 'bb_ante' })} className={`${SEG_BTN} flex-1 ${tableConfig.ante_type === 'bb_ante' ? SEG_ON : SEG_OFF}`}>
              BB
            </button>
            <button onClick={() => updateTableConfig({ ante_type: 'per_player' })} className={`${SEG_BTN} flex-1 ${tableConfig.ante_type === 'per_player' ? SEG_ON : SEG_OFF}`}>
              Per
            </button>
          </div>
          {tableConfig.ante_type === 'bb_ante' && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                value={tableConfig.ante_bb}
                onChange={(e) => updateTableConfig({ ante_bb: parseFloat(e.target.value) || 0 })}
                className={INPUT}
                style={{ width: '60px' }}
              />
              <span className="text-[9px] text-white/30">BB ante</span>
            </div>
          )}
          {tableConfig.ante_type === 'per_player' && (
            <div className="mt-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  value={tableConfig.ante_bb}
                  onChange={(e) => updateTableConfig({ ante_bb: parseFloat(e.target.value) || 0 })}
                  className={INPUT}
                  style={{ width: '60px' }}
                />
                <span className="text-[9px] text-white/30">BB/player</span>
              </div>
              <div className="mt-0.5 text-[8px] text-white/25">
                {tableConfig.seat_count} × {tableConfig.ante_bb} = {(tableConfig.seat_count * tableConfig.ante_bb).toFixed(2)} BB total
              </div>
            </div>
          )}
        </div>

        {/* STACKS — collapsible */}
        <div className={SIDEBAR_SECTION}>
          <button
            onClick={() => setStacksOpen(!stacksOpen)}
            className="flex w-full items-center justify-between"
          >
            <span className={LABEL} style={{ marginBottom: 0 }}>Stacks</span>
            <span className="flex items-center gap-1 text-[9px] text-white/40">
              {avgStack.toFixed(0)} BB
              {stacksOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </span>
          </button>
          {stacksOpen && (
            <div className="mt-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={applyAllStacks}
                  onChange={(e) => setApplyAllStacks(parseFloat(e.target.value) || 0)}
                  className={INPUT}
                  style={{ width: '55px' }}
                />
                <button
                  onClick={handleApplyAllStacks}
                  className="rounded-[5px] border border-[#d4a52c]/25 bg-[#d4a52c]/8 px-2 py-1 text-[9px] font-semibold text-[#f5e6b0] hover:bg-[#d4a52c]/15"
                >
                  Apply
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-0.5">
                {STACK_PRESETS.map((bb) => (
                  <button
                    key={bb}
                    onClick={() => handleStackPreset(bb)}
                    className="rounded-[3px] border border-white/10 bg-white/[0.02] px-1 py-0.5 text-[8px] font-medium text-white/45 hover:border-[#d4a52c]/30 hover:text-[#f5e6b0]"
                  >
                    {bb}
                  </button>
                ))}
              </div>
              <div className="mt-2 space-y-1">
                {activePositions.map((pos) => (
                  <div key={pos} className="flex items-center gap-1">
                    <span className="w-10 text-[9px] font-semibold text-white/55">{pos}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={playerStacks[pos]}
                      onChange={(e) => handleIndividualStack(pos, parseFloat(e.target.value) || 0)}
                      className={INPUT}
                      style={{ width: '50px' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ICM — collapsible, only if ICM selected */}
        {showICM && (
          <div className={SIDEBAR_SECTION}>
            <button
              onClick={() => setIcmOpen(!icmOpen)}
              className="flex w-full items-center justify-between"
            >
              <span className={LABEL} style={{ marginBottom: 0 }}>ICM</span>
              {icmOpen ? <ChevronUp className="h-3 w-3 text-white/30" /> : <ChevronDown className="h-3 w-3 text-white/30" />}
            </button>
            {icmOpen && (
              <div className="mt-2 space-y-2">
                <div>
                  <span className={LABEL}>Tourney Type</span>
                  <div className="flex gap-1">
                    {(['classic', 'pko'] as TournamentType[]).map((tt) => (
                      <button
                        key={tt}
                        onClick={() => setICMConfig((c) => ({ ...c, tournamentType: tt }))}
                        className={`${SEG_BTN} flex-1 ${icmConfig.tournamentType === tt ? SEG_ON : SEG_OFF}`}
                      >
                        {tt === 'classic' ? 'Classic' : 'PKO'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className={LABEL}>Starting Field</span>
                  <input
                    type="number"
                    value={icmConfig.startingField}
                    onChange={(e) => setICMConfig((c) => ({ ...c, startingField: parseInt(e.target.value) || 0 }))}
                    className={INPUT}
                  />
                </div>
                <div>
                  <span className={LABEL}>Players Remaining</span>
                  <input
                    type="number"
                    value={icmConfig.playersRemaining}
                    onChange={(e) => setICMConfig((c) => ({ ...c, playersRemaining: parseInt(e.target.value) || 0 }))}
                    className={INPUT}
                  />
                </div>
                <div>
                  <span className={LABEL}>Phase Presets</span>
                  <div className="flex flex-wrap gap-0.5">
                    {PHASE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          const remaining = Math.max(1, Math.round(icmConfig.startingField * preset.pct));
                          setICMConfig((c) => ({ ...c, playersRemaining: remaining }));
                        }}
                        className="rounded-[3px] border border-white/10 bg-white/[0.02] px-1 py-0.5 text-[8px] font-medium text-white/45 hover:border-[#d4a52c]/30 hover:text-[#f5e6b0]"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <button
                    onClick={() => setPayoutsOpen(true)}
                    className="flex items-center gap-1 rounded-[5px] border border-white/10 bg-white/[0.02] px-2 py-1 text-[9px] font-semibold text-white/50 hover:border-[#d4a52c]/30 hover:text-[#f5e6b0]"
                  >
                    Payouts
                    {icmConfig.payouts.length > 0 && (
                      <span className="rounded-full bg-[#d4a52c]/15 px-1 py-0.5 text-[7px] text-[#d4a52c]">
                        {icmConfig.payouts.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BOARD — always visible postflop, click any slot to open picker */}
        {step !== 'preflop' && (
          <div className={SIDEBAR_SECTION}>
            <span className={LABEL}>Board</span>
            <div className="relative">
              <BoardDisplay board={config.board} onSlotClick={openPicker} />
              {pickerOpen && (
                <BoardSelector
                  board={config.board}
                  onChange={handleBoardChange}
                  target={pickerOpen}
                  open={true}
                  onClose={closePicker}
                  onComplete={handlePickerComplete}
                />
              )}
            </div>
            {config.board.length === 0 && (
              <p className="mt-1.5 text-[9px] text-white/25">Click a flop slot to select cards</p>
            )}
          </div>
        )}

        {/* ADVANCED SETTINGS — collapsible */}
        <div className={SIDEBAR_SECTION}>
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex w-full items-center gap-1.5"
          >
            <Settings className="h-3 w-3 text-white/30" />
            <span className="text-[9px] font-mono tracking-[0.18em] text-white/35 uppercase">Advanced</span>
            {advancedOpen ? <ChevronUp className="h-3 w-3 text-white/30 ml-auto" /> : <ChevronDown className="h-3 w-3 text-white/30 ml-auto" />}
          </button>
          {advancedOpen && (
            <div className="mt-2 space-y-2">
              <div>
                <span className={LABEL}>Accuracy</span>
                <div className="flex gap-1">
                  {ACCURACY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => props.onSetAccuracy(opt.value)}
                      title={opt.description}
                      className={`${SEG_BTN} flex-1 ${config.accuracy === opt.value ? SEG_ON : SEG_OFF}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className={LABEL}>SB (BB)</span>
                <input
                  type="number"
                  step="0.1"
                  value={tableConfig.sb_bb}
                  onChange={(e) => updateTableConfig({ sb_bb: parseFloat(e.target.value) || 0 })}
                  className={INPUT}
                  style={{ width: '60px' }}
                />
              </div>
              <div>
                <span className={LABEL}>BB (BB)</span>
                <input
                  type="number"
                  step="0.1"
                  value={tableConfig.bb_bb}
                  onChange={(e) => updateTableConfig({ bb_bb: parseFloat(e.target.value) || 0 })}
                  className={INPUT}
                  style={{ width: '60px' }}
                />
              </div>
              <div>
                <span className={LABEL}>Max Raises</span>
                <input
                  type="number"
                  value={config.tree_settings.max_raises}
                  onChange={(e) => props.onSetTreeSettings({ ...config.tree_settings, max_raises: parseInt(e.target.value) || 3 })}
                  className={INPUT}
                  style={{ width: '60px' }}
                />
              </div>
              <div>
                <span className={LABEL}>Donk Bets</span>
                <button
                  onClick={() => props.onSetTreeSettings({ ...config.tree_settings, donk_bet_allowed: !config.tree_settings.donk_bet_allowed })}
                  className={`${SEG_BTN} ${config.tree_settings.donk_bet_allowed ? SEG_ON : SEG_OFF}`}
                >
                  {config.tree_settings.donk_bet_allowed ? 'Allowed' : 'Not Allowed'}
                </button>
              </div>
              <div>
                <span className={LABEL}>Bet Sizes</span>
                <div className="flex gap-1">
                  <button onClick={() => setBetSizeMode('single')} className={`${SEG_BTN} flex-1 ${betSizeMode === 'single' ? SEG_ON : SEG_OFF}`}>Single</button>
                  <button onClick={() => setBetSizeMode('multi')} className={`${SEG_BTN} flex-1 ${betSizeMode === 'multi' ? SEG_ON : SEG_OFF}`}>Multi</button>
                </div>
              </div>
              {betSizeMode === 'multi' && (
                <div>
                  <span className={LABEL}>Size List</span>
                  <input
                    type="text"
                    value={config.tree_settings.bet_sizes.join(', ')}
                    onChange={(e) => props.onSetTreeSettings({ ...config.tree_settings, bet_sizes: e.target.value.split(',').map((s) => s.trim()) })}
                    className={INPUT}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {props.error && (
          <div className="mx-2 my-1.5 rounded-[5px] border border-red-500/30 bg-red-500/10 px-2 py-1 text-[9px] text-red-300">
            {props.error}
          </div>
        )}
      </div>

      {/* ============ CENTER + RIGHT ============ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* CENTER — solver workspace */}
        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* PREFLOP */}
            {step === 'preflop' && (
              <PreflopMatrix
                tableConfig={tableConfig}
                effectiveStackBB={config.effective_stack_bb}
                potBB={potCalc.pot_bb}
                actions={config.action_history}
                onAddAction={handleAddAction}
                onSetActions={props.onSetActionHistory}
                onSolveDecision={handleSolveDecision}
                onContinue={handleContinue}
                selectedHand={selectedHand}
                onSelectHand={setSelectedHand}
                format={config.format}
                solveType={solveType}
              />
            )}

            {/* FLOP — waiting for board cards */}
            {step === 'flop' && config.board.length < 3 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                <div className="text-[14px] font-bold tracking-widest text-[#f5e6b0] uppercase">Select Flop Cards</div>
                <div className="relative">
                  <BoardDisplay board={config.board} onSlotClick={openPicker} />
                  {pickerOpen === 'flop' && (
                    <BoardSelector
                      board={config.board}
                      onChange={handleBoardChange}
                      target="flop"
                      open={true}
                      onClose={closePicker}
                      onComplete={handlePickerComplete}
                    />
                  )}
                </div>
                <p className="text-[10px] text-white/30">Click a flop slot above to open the card picker</p>
              </div>
            )}

            {/* FLOP — with board */}
            {step === 'flop' && config.board.length >= 3 && (
              <>
                <div className="flex items-center justify-center gap-2 border-b border-white/[0.04] py-2">
                  <span className="text-[9px] font-mono tracking-[0.2em] text-white/30 uppercase">Board</span>
                  <div className="relative">
                    <BoardDisplay board={config.board} onSlotClick={openPicker} />
                    {pickerOpen && (
                      <BoardSelector
                        board={config.board}
                        onChange={handleBoardChange}
                        target={pickerOpen}
                        open={true}
                        onClose={closePicker}
                        onComplete={handlePickerComplete}
                      />
                    )}
                  </div>
                </div>
                <PostflopNodeView
                  street="flop"
                  tableConfig={tableConfig}
                  effectiveStackBB={config.effective_stack_bb}
                  potBB={potCalc.pot_bb}
                  board={config.board}
                  actions={config.action_history}
                  onAddAction={handleAddAction}
                  onSolveDecision={handleSolveDecision}
                  onContinue={handleContinue}
                  canContinue={true}
                  selectedHand={selectedHand}
                  onSelectHand={setSelectedHand}
                  format={config.format}
                  solveType={solveType}
                />
              </>
            )}

            {/* TURN — waiting for turn card */}
            {step === 'turn' && config.board.length < 4 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                <div className="text-[14px] font-bold tracking-widest text-[#f5e6b0] uppercase">Select Turn Card</div>
                <div className="relative">
                  <BoardDisplay board={config.board} onSlotClick={openPicker} />
                  {pickerOpen === 'turn' && (
                    <BoardSelector
                      board={config.board}
                      onChange={handleBoardChange}
                      target="turn"
                      open={true}
                      onClose={closePicker}
                      onComplete={handlePickerComplete}
                    />
                  )}
                </div>
                <p className="text-[10px] text-white/30">Click the turn slot to open the card picker</p>
              </div>
            )}

            {/* TURN — with board */}
            {step === 'turn' && config.board.length >= 4 && (
              <>
                <div className="flex items-center justify-center gap-2 border-b border-white/[0.04] py-2">
                  <span className="text-[9px] font-mono tracking-[0.2em] text-white/30 uppercase">Board</span>
                  <div className="relative">
                    <BoardDisplay board={config.board} onSlotClick={openPicker} />
                    {pickerOpen && (
                      <BoardSelector
                        board={config.board}
                        onChange={handleBoardChange}
                        target={pickerOpen}
                        open={true}
                        onClose={closePicker}
                        onComplete={handlePickerComplete}
                      />
                    )}
                  </div>
                </div>
                <PostflopNodeView
                  street="turn"
                  tableConfig={tableConfig}
                  effectiveStackBB={config.effective_stack_bb}
                  potBB={potCalc.pot_bb}
                  board={config.board}
                  actions={config.action_history}
                  onAddAction={handleAddAction}
                  onSolveDecision={handleSolveDecision}
                  onContinue={handleContinue}
                  canContinue={true}
                  selectedHand={selectedHand}
                  onSelectHand={setSelectedHand}
                  format={config.format}
                  solveType={solveType}
                />
              </>
            )}

            {/* RIVER — waiting for river card */}
            {step === 'river' && config.board.length < 5 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                <div className="text-[14px] font-bold tracking-widest text-[#f5e6b0] uppercase">Select River Card</div>
                <div className="relative">
                  <BoardDisplay board={config.board} onSlotClick={openPicker} />
                  {pickerOpen === 'river' && (
                    <BoardSelector
                      board={config.board}
                      onChange={handleBoardChange}
                      target="river"
                      open={true}
                      onClose={closePicker}
                      onComplete={handlePickerComplete}
                    />
                  )}
                </div>
                <p className="text-[10px] text-white/30">Click the river slot to open the card picker</p>
              </div>
            )}

            {/* RIVER — with board */}
            {step === 'river' && config.board.length >= 5 && (
              <>
                <div className="flex items-center justify-center gap-2 border-b border-white/[0.04] py-2">
                  <span className="text-[9px] font-mono tracking-[0.2em] text-white/30 uppercase">Board</span>
                  <div className="relative">
                    <BoardDisplay board={config.board} onSlotClick={openPicker} />
                    {pickerOpen && (
                      <BoardSelector
                        board={config.board}
                        onChange={handleBoardChange}
                        target={pickerOpen}
                        open={true}
                        onClose={closePicker}
                        onComplete={handlePickerComplete}
                      />
                    )}
                  </div>
                </div>
                <PostflopNodeView
                  street="river"
                  tableConfig={tableConfig}
                  effectiveStackBB={config.effective_stack_bb}
                  potBB={potCalc.pot_bb}
                  board={config.board}
                  actions={config.action_history}
                  onAddAction={handleAddAction}
                  onSolveDecision={handleSolveDecision}
                  onContinue={() => {}}
                  canContinue={false}
                  selectedHand={selectedHand}
                  onSelectHand={setSelectedHand}
                  format={config.format}
                  solveType={solveType}
                />
              </>
            )}
          </div>

          {/* RIGHT SIDEBAR — STATS / OUTPUT */}
          <div className="solver-right-panel hidden w-[20%] shrink-0 flex-col overflow-y-auto border-l border-white/[0.06] md:flex">
            {/* SPOT */}
            <div className={SIDEBAR_SECTION}>
              <span className={LABEL}>Spot</span>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/50">Pot</span>
                  <span className="text-[12px] font-mono font-semibold text-[#d4a52c]">{potCalc.pot_bb.toFixed(1)} BB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/50">Eff. Stack</span>
                  <span className="text-[12px] font-mono font-semibold text-white/70">{config.effective_stack_bb} BB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/50">SPR</span>
                  <span className="text-[12px] font-mono font-semibold text-white/70">{spr}</span>
                </div>
              </div>
            </div>

            {/* STATE */}
            <div className={SIDEBAR_SECTION}>
              <span className={LABEL}>State</span>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/50">Players</span>
                  <span className="text-[12px] font-mono font-semibold text-white/70">{tableConfig.seat_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/50">Street</span>
                  <span className="text-[12px] font-mono font-semibold text-white/70">{step.charAt(0).toUpperCase() + step.slice(1)}</span>
                </div>
              </div>
            </div>

            {/* DATA SOURCE INDICATOR */}
            <div className={SIDEBAR_SECTION}>
              <span className={LABEL}>Data Source</span>
              <div className="flex items-center gap-1.5">
                {nodeStrategy ? (
                  <span
                    className={`rounded-[3px] border px-1.5 py-0.5 text-[8px] font-mono tracking-widest uppercase ${
                      nodeStrategy.source === 'reference'
                        ? 'border-[#4ade80]/30 bg-[#4ade80]/8 text-[#4ade80]/70'
                        : nodeStrategy.source === 'deepsolver'
                        ? 'border-[#3b82f6]/30 bg-[#3b82f6]/8 text-[#3b82f6]/70'
                        : 'border-[#c0911e]/30 bg-[#c0911e]/8 text-[#c0911e]/70'
                    }`}
                  >
                    {nodeStrategy.source === 'reference' ? 'Reference Data' : nodeStrategy.source === 'deepsolver' ? 'DeepSolver' : 'Mock Data'}
                  </span>
                ) : (
                  <span className="rounded-[3px] border border-white/10 bg-white/[0.02] px-1.5 py-0.5 text-[8px] font-mono tracking-widest uppercase text-white/30">
                    No Data Loaded
                  </span>
                )}
              </div>
            </div>

            {/* STRATEGY */}
            <div className={SIDEBAR_SECTION}>
              <span className={LABEL}>Strategy</span>
              {nodeStrategy && nodeStrategy.aggregate_strategy.length > 0 ? (
                <div className="space-y-2.5">
                  {nodeStrategy.aggregate_strategy.map((a, i) => {
                    const colors = ['#d4a52c', '#3b82f6', '#4ade80', '#e04545', '#a855f7'];
                    return (
                      <div key={i}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10px] text-white/55">{a.label}</span>
                          <span className="text-[11px] font-mono font-semibold text-white/75">{(a.frequency * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full" style={{ width: `${a.frequency * 100}%`, background: colors[i % colors.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {['Fold', 'Limp', 'Raise', 'All-in'].map((label) => (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[10px] text-white/30">{label}</span>
                        <span className="text-[11px] font-mono font-semibold text-white/25">—</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SELECTED HAND */}
            <div className={SIDEBAR_SECTION}>
              <span className={LABEL}>Selected Hand</span>
              {selectedHand && selectedHandStrategy ? (
                <div className="space-y-2">
                  <div className="text-[14px] font-bold text-[#f5e6b0]">{selectedHand}</div>
                  {selectedHandStrategy.map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px] text-white/55">{s.action}</span>
                      <span className="text-[11px] font-mono font-semibold text-white/70">{(s.frequency * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-white/30">Click a hand in the matrix</p>
              )}
            </div>

            {/* ACTION HISTORY */}
            <div className={SIDEBAR_SECTION}>
              <span className={LABEL}>Action History</span>
              {config.action_history.length > 0 ? (
                <div className="space-y-1.5">
                  {config.action_history.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <span className="w-12 font-semibold text-white/55">{a.position}</span>
                      <span className="text-white/45">{a.action}{a.amount_bb ? ` ${a.amount_bb}BB` : ''}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-white/30">No actions yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom navigation */}
        <div className="solver-bottom-nav flex shrink-0 items-center justify-between border-t border-white/[0.06] px-2 py-0.5">
          <button
            onClick={props.onCancel}
            className="rounded-[5px] border border-white/10 px-2.5 py-1 text-[9px] font-semibold text-white/50 transition-all hover:text-white/80"
          >
            Reset
          </button>
          <div className="flex items-center gap-2">
            {step !== 'preflop' && (
              <button
                onClick={() => setStep(STEP_ORDER[stepIndex - 1])}
                className="rounded-[5px] border border-white/10 px-2.5 py-1 text-[9px] font-semibold text-white/50 hover:text-white/80"
              >
                Back
              </button>
            )}
            {nextStepLabel && (
              <button
                onClick={() => {
                  const nextStep = STEP_ORDER[stepIndex + 1];
                  if (nextStep && reachableSteps.includes(nextStep)) setStep(nextStep);
                }}
                disabled={!canGoNext}
                className="rounded-[5px] border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2.5 py-1 text-[9px] font-semibold text-[#f5e6b0] transition-all hover:bg-[#d4a52c]/15 disabled:opacity-30"
              >
                {nextStepLabel}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payouts Modal */}
      {payoutsOpen && (
        <PayoutsModal
          payouts={icmConfig.payouts}
          onSave={(payouts) => {
            setICMConfig((c) => ({ ...c, payouts }));
            setPayoutsOpen(false);
          }}
          onClose={() => setPayoutsOpen(false)}
        />
      )}
    </div>
  );
}

// ============ Payouts Modal ============
function PayoutsModal({
  payouts,
  onSave,
  onClose,
}: {
  payouts: { position: number; amount: number }[];
  onSave: (payouts: { position: number; amount: number }[]) => void;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState(
    payouts.length > 0 ? payouts : [
      { position: 1, amount: 50 },
      { position: 2, amount: 30 },
      { position: 3, amount: 20 },
    ],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-white/[0.08] p-5"
        style={{ background: 'rgba(10,11,12,0.95)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-[14px] font-bold text-white">Configure Payouts</h3>
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 text-[10px] text-white/40">#{entry.position}</span>
              <input
                type="number"
                value={entry.amount}
                onChange={(e) => setEntries((prev) => prev.map((p, idx) => idx === i ? { ...p, amount: parseFloat(e.target.value) || 0 } : p))}
                className={INPUT}
                style={{ height: '32px' }}
              />
              <span className="text-[10px] text-white/30">%</span>
              <button
                onClick={() => setEntries((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-[10px] text-red-400/50 hover:text-red-400"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() => setEntries((prev) => [...prev, { position: entries.length + 1, amount: 0 }])}
            className="text-[10px] font-semibold text-[#d4a52c]/70 hover:text-[#d4a52c]"
          >
            + Add Position
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[6px] border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/50 hover:text-white/80" style={{ height: '32px' }}>
            Cancel
          </button>
          <button
            onClick={() => onSave(entries.map((e, i) => ({ position: i + 1, amount: e.amount })))}
            className="rounded-[6px] bg-gradient-to-r from-[#d4a52c] to-[#c0911e] px-4 py-1.5 text-[11px] font-bold text-[#0a0c0e] hover:from-[#f5e6b0] hover:to-[#d4a52c]"
            style={{ height: '32px' }}
          >
            Save Payouts
          </button>
        </div>
      </div>
    </div>
  );
}
