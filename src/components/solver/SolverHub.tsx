import { useMemo, useState } from 'react';
import { Loader2, AlertCircle, Lock, RefreshCw, Settings, ChevronDown, Library } from 'lucide-react';
import { useSolver } from '@/hooks/useSolver';
import { SolverResults } from './SolverResults';
import { SolverLibrary } from './SolverLibrary';
import { SolverAdmin } from './SolverAdmin';
import { RangeSourcePage } from './RangeSourcePage';
import { MOCK_RECENT_JOBS } from '@/lib/solver/mockJobs';
import type { SpotVaultAccount } from '@/types';
import type { SolveStatus } from '@/hooks/useSolver';
import {
  STACK_PRESETS,
  ACCURACY_OPTIONS,
  SEAT_COUNTS,
  DEFAULT_TABLE_CONFIG,
  type SolverFormat,
  type SolverTableConfig,
  type SolverPosition,
  type RangeData,
  type SolverStreetAction,
} from '@/lib/solver/types';
import { calculatePot, positionsForTable } from '@/lib/solver/potCalculator';
import { BoardSelector } from './BoardSelector';
import { deriveRangesFromActions } from '@/lib/solver/nodeStrategy';
import { HAND_CELLS } from '@/lib/solver/types';

interface SolverHubProps {
  account: SpotVaultAccount;
  isSuperUser: boolean;
}

const SEG_BTN = 'rounded-[6px] border px-2.5 py-1.5 text-[10px] font-semibold transition-all whitespace-nowrap';
const SEG_ON = 'border-[#d4a52c]/40 bg-[#d4a52c]/10 text-[#f5e6b0]';
const SEG_OFF = 'border-white/10 bg-white/[0.02] text-white/45 hover:text-white/75 hover:border-white/20';
const INPUT = 'w-full rounded-[5px] border border-white/10 bg-[#0a0c0e] px-2 py-1.5 text-[11px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none';
const LABEL = 'text-[9px] font-mono tracking-[0.18em] text-white/40 uppercase mb-1.5 block';

export function SolverHub({ account, isSuperUser }: SolverHubProps) {
  const { state, actions } = useSolver(account.id);
  const [menuOpen, setMenuOpen] = useState(false);

  const displayJobs = useMemo(() => {
    if (state.jobs.length === 0) return MOCK_RECENT_JOBS;
    return [...state.jobs, ...MOCK_RECENT_JOBS];
  }, [state.jobs]);

  const isLocked = state.solveStatus === 'not-solved' || state.solveStatus === 'solving' || state.solveStatus === 'stale' || state.solveStatus === 'error';

  // Content-responsive shell sizing
  const isCompact = state.view === 'range-source';

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto overflow-x-hidden md:overflow-hidden">
      {/* Compact secondary nav */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-1">
        <div className="flex items-center gap-2">
          {state.rangeSource && (
            <span className={`rounded-[3px] border px-1.5 py-0.5 text-[8px] font-mono tracking-widest uppercase ${state.rangeSource === 'library' ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#d4a52c]/80' : 'border-white/15 bg-white/[0.03] text-white/40'}`}>
              {state.rangeSource === 'library' ? 'SPOTVAULT LIBRARY' : 'CUSTOM'}
            </span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1 rounded-[5px] border border-white/10 px-2 py-1 text-[9px] font-semibold text-white/50 hover:text-white/80"
          >
            <Settings className="h-3 w-3" />
            Menu
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-white/[0.08] bg-[#0a0c0e] py-1.5 shadow-xl">
                <MenuItem label="New Solve" onClick={() => { actions.handleNewSolve(); setMenuOpen(false); }} />
                <MenuItem label="Range Source" onClick={() => { actions.goToRangeSource(); setMenuOpen(false); }} />
                <MenuItem label="Library" onClick={() => { actions.goToLibrary(); setMenuOpen(false); }} />
                <MenuItem label="Recent Solves" onClick={() => { actions.goToDashboard(); setMenuOpen(false); }} />
                {isSuperUser && <MenuItem label="Admin" onClick={() => { actions.goToAdmin(); setMenuOpen(false); }} />}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content-responsive shell — shrinks for compact screens, fills for workspace */}
      <div
        className={`flex w-full justify-center transition-all duration-300 ease-out ${isCompact ? 'flex-1 items-center' : 'flex-1 min-h-0 items-stretch'} px-2 py-1.5 md:px-3 md:py-2`}
      >
        <div
          className={`flex min-h-0 flex-col overflow-y-auto overflow-x-hidden md:overflow-hidden rounded-lg border border-white/[0.08] p-2 md:p-3 transition-all duration-300 ease-out ${isCompact ? 'w-auto max-w-[640px]' : 'w-full flex-1'}`}
          style={{
            background: 'rgba(8,9,10,0.66)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px -12px rgba(0,0,0,0.6)',
          }}
        >
          {state.view === 'range-source' && (
            <RangeSourcePage
              onUseLibrary={(cfg) => {
                actions.updateConfig({
                  format: cfg.format,
                  table_config: cfg.tableConfig,
                  effective_stack_bb: cfg.stackBB,
                  hero_position: cfg.heroPosition,
                  villain_position: cfg.villainPosition,
                  action_history: cfg.actionHistory,
                  hero_range: cfg.heroRange,
                  villain_range: cfg.villainRange,
                });
                actions.setRangeSource('library', cfg.label);
                actions.goToDashboard();
              }}
              onUseCustom={(cfg) => {
                actions.updateConfig({
                  format: cfg.format,
                  table_config: cfg.tableConfig,
                  effective_stack_bb: cfg.stackBB,
                  hero_position: cfg.heroPosition,
                  villain_position: cfg.villainPosition,
                  hero_range: cfg.heroRange,
                  villain_range: cfg.villainRange,
                });
                actions.setRangeSource('custom', cfg.label);
                actions.goToDashboard();
              }}
            />
          )}

          {(state.view === 'new-solve' || state.view === 'processing' || state.view === 'results') && (
            <SolverWorkspace
              state={state}
              actions={actions}
              isLocked={isLocked}
            />
          )}

          {state.view === 'library' && (
            <SolverLibrary entries={state.libraryEntries} />
          )}

          {state.view === 'admin' && (
            <SolverAdmin jobs={displayJobs} onLoadJobs={actions.loadAdminJobs} />
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-[10px] font-medium text-white/60 hover:bg-white/[0.05] hover:text-white/90"
    >
      {label}
    </button>
  );
}

function DataSourceBadge({ status }: { status: SolveStatus }) {
  const config = {
    'not-solved': { label: 'NOT SOLVED', cls: 'border-white/15 bg-white/[0.03] text-white/40' },
    'solving': { label: 'DEEPSOLVER — SOLVING', cls: 'border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]/80' },
    'solved': { label: 'DEEPSOLVER', cls: 'border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]/80' },
    'stale': { label: 'STALE — RE-SOLVE', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300/70' },
    'error': { label: 'SOLVE FAILED', cls: 'border-red-500/30 bg-red-500/10 text-red-300/70' },
  }[status];

  return (
    <span className={`rounded-[3px] border px-1.5 py-0.5 text-[8px] font-mono tracking-widest uppercase ${config.cls}`}>
      {config.label}
    </span>
  );
}

function SolverWorkspace({
  state,
  actions,
  isLocked,
}: {
  state: ReturnType<typeof useSolver>['state'];
  actions: ReturnType<typeof useSolver>['actions'];
  isLocked: boolean;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [solveType, setSolveType] = useState<'chipev' | 'icm'>('chipev');
  const config = state.config;
  const tableConfig = config.table_config ?? DEFAULT_TABLE_CONFIG;

  const potCalc = useMemo(
    () => calculatePot(config.effective_stack_bb, tableConfig, config.action_history, config.board),
    [config.effective_stack_bb, tableConfig, config.action_history, config.board],
  );

  const activePositions = useMemo(
    () => positionsForTable(tableConfig.seat_count),
    [tableConfig.seat_count],
  );

  const handleSolveDecision = () => {
    const patch: Partial<typeof config> = { pot_size_bb: potCalc.pot_bb };
    // Only auto-derive ranges from action history when the user has NOT provided custom or library ranges.
    // Custom and library ranges are authoritative — never overwrite them with derived ranges.
    if (state.rangeSource == null) {
      const derived = deriveRangesFromActions(config.action_history, tableConfig);
      if (derived) {
        patch.hero_position = derived.hero_position;
        patch.villain_position = derived.villain_position;
        patch.hero_range = derived.hero_range;
        patch.villain_range = derived.villain_range;
      }
    }
    actions.updateConfig(patch);
    actions.submitSolve();
  };

  const handleSolveTypeChange = (type: 'chipev' | 'icm') => {
    setSolveType(type);
    if (type === 'chipev') {
      actions.setFormat('cash');
    } else {
      actions.setFormat('tournament');
    }
  };

  const updateTableConfig = (patch: Partial<SolverTableConfig>) => {
    actions.setTableConfig({ ...tableConfig, ...patch });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto overflow-x-hidden md:overflow-hidden">
      {/* ============ CONFIGURE PANEL — compact toolbar ============ */}
      <div className="shrink-0 border-b border-white/[0.06] px-3 py-1.5">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          {/* Game */}
          <div>
            <span className={LABEL}>Game</span>
            <div className="flex gap-1">
              {(['tournament', 'cash'] as SolverFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => actions.setFormat(fmt)}
                  className={`${SEG_BTN} ${config.format === fmt ? SEG_ON : SEG_OFF}`}
                >
                  {fmt === 'tournament' ? 'MTT' : 'Cash'}
                </button>
              ))}
            </div>
          </div>

          {/* Solve Type */}
          <div>
            <span className={LABEL}>Solve</span>
            <div className="flex gap-1">
              <button onClick={() => handleSolveTypeChange('chipev')} className={`${SEG_BTN} ${solveType === 'chipev' ? SEG_ON : SEG_OFF}`}>
                ChipEV
              </button>
              <button onClick={() => handleSolveTypeChange('icm')} className={`${SEG_BTN} ${solveType === 'icm' ? SEG_ON : SEG_OFF}`}>
                ICM
              </button>
            </div>
          </div>

          {/* Players */}
          <div>
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

          {/* Stack */}
          <div>
            <span className={LABEL}>Stack</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={config.effective_stack_bb}
                onChange={(e) => actions.setStack(parseFloat(e.target.value) || 0)}
                className={INPUT}
                style={{ width: '55px' }}
              />
              <span className="text-[9px] text-white/30">BB</span>
              <div className="flex flex-wrap gap-0.5">
                {STACK_PRESETS.slice(0, 5).map((bb) => (
                  <button
                    key={bb}
                    onClick={() => actions.setStack(bb)}
                    className="rounded-[3px] border border-white/10 bg-white/[0.02] px-1 py-0.5 text-[8px] font-medium text-white/45 hover:border-[#d4a52c]/30 hover:text-[#f5e6b0]"
                  >
                    {bb}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ante */}
          <div>
            <span className={LABEL}>Ante</span>
            <div className="flex gap-1">
              <button onClick={() => updateTableConfig({ ante_type: 'none' })} className={`${SEG_BTN} ${tableConfig.ante_type === 'none' ? SEG_ON : SEG_OFF}`}>
                None
              </button>
              <button onClick={() => updateTableConfig({ ante_type: 'bb_ante' })} className={`${SEG_BTN} ${tableConfig.ante_type === 'bb_ante' ? SEG_ON : SEG_OFF}`}>
                BB
              </button>
              <button onClick={() => updateTableConfig({ ante_type: 'per_player' })} className={`${SEG_BTN} ${tableConfig.ante_type === 'per_player' ? SEG_ON : SEG_OFF}`}>
                Per
              </button>
            </div>
            {tableConfig.ante_type !== 'none' && (
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  value={tableConfig.ante_bb}
                  onChange={(e) => updateTableConfig({ ante_bb: parseFloat(e.target.value) || 0 })}
                  className={INPUT}
                  style={{ width: '50px' }}
                />
                <span className="text-[8px] text-white/30">BB</span>
              </div>
            )}
          </div>

          {/* Board */}
          <div>
            <span className={LABEL}>Board <span className="text-white/20 normal-case tracking-normal">(flop required)</span></span>
            <BoardSelector
              board={config.board}
              onChange={actions.setBoard}
              maxSlots={5}
            />
          </div>

          {/* Advanced toggle */}
          <div>
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center gap-1 text-[9px] font-mono tracking-widest text-white/35 uppercase hover:text-white/60"
              style={{ marginBottom: '2px' }}
            >
              <Settings className="h-3 w-3" />
              Advanced
              <ChevronDown className={`h-2.5 w-2.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* SOLVE BUTTON */}
          <div className="ml-auto flex flex-col items-end gap-1">
            {config.board.length < 3 && (
              <span className="text-[9px] text-amber-400/70">Select a flop above to solve</span>
            )}
            <SolveButton
              status={state.solveStatus}
              error={state.error}
              boardReady={config.board.length >= 3}
              onSolve={handleSolveDecision}
              onRetry={handleSolveDecision}
            />
          </div>
        </div>

        {/* Advanced row */}
        {advancedOpen && (
          <div className="mt-2.5 flex flex-wrap items-end gap-x-4 gap-y-2 border-t border-white/[0.04] pt-2.5">
            <div>
              <span className={LABEL}>Accuracy</span>
              <div className="flex gap-1">
                {ACCURACY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => actions.setAccuracy(opt.value)}
                    className={`${SEG_BTN} ${config.accuracy === opt.value ? SEG_ON : SEG_OFF}`}
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
                style={{ width: '55px' }}
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
                style={{ width: '55px' }}
              />
            </div>
            <div>
              <span className={LABEL}>Max Raises</span>
              <input
                type="number"
                value={config.tree_settings.max_raises}
                onChange={(e) => actions.setTreeSettings({ ...config.tree_settings, max_raises: parseInt(e.target.value) || 3 })}
                className={INPUT}
                style={{ width: '55px' }}
              />
            </div>
          </div>
        )}

        {/* Error display */}
        {state.error && state.solveStatus === 'error' && (
          <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span className="text-[11px] text-red-300">{state.error}</span>
          </div>
        )}
      </div>

      {/* ============ SOLVER WORKSPACE ============ */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {state.solveStatus === 'solved' && state.currentJob && state.currentResult && state.currentNode ? (
          <SolverResults
            job={state.currentJob}
            result={state.currentResult}
            config={state.config}
            currentNode={state.currentNode}
            nodePath={state.nodePath}
            selectedHand={state.selectedHand}
            onSelectHand={actions.selectHand}
            onNavigateChild={actions.navigateToChild}
            onNavigateBreadcrumb={actions.navigateToBreadcrumb}
            onToggleFavorite={actions.toggleJobFavorite}
            onSaveToVault={actions.handleSaveToVault}
            onAddNotes={actions.handleAddNotes}
            onNewSolve={actions.handleNewSolve}
          />
        ) : (
          <LockedWorkspace
            status={state.solveStatus}
            config={config}
            tableConfig={tableConfig}
            activePositions={activePositions}
            actionHistory={config.action_history}
            onSetActionHistory={actions.setActionHistory}
            isLocked={isLocked}
          />
        )}

        {/* Smoked glass overlay when locked — workspace visible underneath */}
        {isLocked && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center"
            style={{
              background: 'rgba(5,6,8,0.55)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
            }}
          >
            <LockedMessage status={state.solveStatus} stage={state.processingStage} />
          </div>
        )}
      </div>
    </div>
  );
}

function SolveButton({
  status,
  error,
  boardReady,
  onSolve,
  onRetry,
}: {
  status: SolveStatus;
  error: string | null;
  boardReady: boolean;
  onSolve: () => void;
  onRetry: () => void;
}) {
  if (status === 'solving') {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#2563eb] px-5 py-2.5 text-[12px] font-bold text-white opacity-80"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        SOLVING...
      </button>
    );
  }

  if (status === 'error') {
    return (
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-[12px] font-bold text-red-300 transition-all hover:bg-red-500/20"
      >
        <RefreshCw className="h-4 w-4" />
        RETRY SOLVE
      </button>
    );
  }

  if (status === 'stale') {
    return (
      <button
        onClick={onSolve}
        className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-2.5 text-[12px] font-bold text-amber-300 transition-all hover:bg-amber-500/20"
      >
        <RefreshCw className="h-4 w-4" />
        RE-SOLVE
      </button>
    );
  }

  if (!boardReady) {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-lg border border-white/10 px-5 py-2.5 text-[12px] font-bold text-white/25 cursor-not-allowed"
      >
        <Lock className="h-4 w-4" />
        SOLVE THIS DECISION
      </button>
    );
  }

  return (
    <button
      onClick={onSolve}
      className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#d4a52c] to-[#c0911e] px-5 py-2.5 text-[12px] font-bold text-[#0a0c0e] transition-all hover:from-[#f5e6b0] hover:to-[#d4a52c]"
    >
      <Lock className="h-4 w-4" />
      SOLVE THIS DECISION
    </button>
  );
}

function LockedMessage({ status, stage }: { status: SolveStatus; stage: string }) {
  if (status === 'solving') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#3b82f6]" />
        <div>
          <p className="text-[16px] font-bold text-white/80">SOLVING WITH DEEPSOLVER</p>
          <p className="mt-1 text-[11px] text-white/40">{stage || 'Computing your strategy...'}</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <div>
          <p className="text-[16px] font-bold text-red-300">DEEPSOLVER SOLVE FAILED</p>
          <p className="mt-1 text-[11px] text-white/40">Check the error above and retry.</p>
        </div>
      </div>
    );
  }

  if (status === 'stale') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <RefreshCw className="h-12 w-12 text-amber-400" />
        <div>
          <p className="text-[16px] font-bold text-amber-300">SETTINGS CHANGED</p>
          <p className="mt-1 text-[11px] text-white/40">Run a new solve to update the strategy.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Lock className="h-12 w-12 text-white/25" />
      <div>
        <p className="text-[16px] font-bold text-white/50">CONFIGURE YOUR SPOT</p>
        <p className="mt-1 text-[11px] text-white/30">Set the game parameters above, then run the solve to unlock the strategy.</p>
      </div>
    </div>
  );
}

function LockedWorkspace({
  status: _status,
  config: _config,
  tableConfig,
  activePositions,
  actionHistory: _actionHistory,
  onSetActionHistory: _onSetActionHistory,
  isLocked,
}: {
  status: SolveStatus;
  config: ReturnType<typeof useSolver>['state']['config'];
  tableConfig: SolverTableConfig;
  activePositions: SolverPosition[];
  actionHistory: ReturnType<typeof useSolver>['state']['action_history'];
  onSetActionHistory: (actions: ReturnType<typeof useSolver>['state']['action_history']) => void;
  isLocked: boolean;
}) {

  return (
    <div className={`flex h-full w-full flex-col ${isLocked ? 'pointer-events-none' : ''}`}>
      {/* Position strip placeholder (visual only) */}
      <div className="shrink-0 border-b border-white/[0.04]">
        <div
          className="grid border-x border-white/[0.04]"
          style={{ gridTemplateColumns: `repeat(${activePositions.length}, 1fr)` }}
        >
          {activePositions.map((pos) => (
            <div
              key={pos}
              className="min-w-0 border-r border-white/[0.04] px-1.5 py-1 last:border-r-0"
              style={{ borderTop: '2px solid transparent' }}
            >
              <div className="flex items-center justify-between gap-0.5 pb-0.5">
                <span className="truncate text-[10px] font-bold text-white/35">{pos}</span>
                <span className="shrink-0 text-[8px] font-mono text-white/25">—BB</span>
              </div>
              <div className="space-y-0.5">
                {['Fold', 'Limp', 'Raise', 'All-in'].map((label) => (
                  <div
                    key={label}
                    className="w-full rounded-[3px] border border-transparent px-1.5 py-0.5 text-left"
                  >
                    <span className="text-[9px] font-bold tracking-wide text-white/25">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty matrix grid placeholder */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        <div
          className="grid w-full gap-[1px]"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            gridTemplateColumns: 'repeat(13, 1fr)',
            gridTemplateRows: 'repeat(13, 1fr)',
            aspectRatio: '1 / 1',
          }}
        >
          {Array.from({ length: 169 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-center rounded-[2px] border border-white/[0.06]"
              style={{ background: 'rgba(255,255,255,0.025)' }}
            >
              <span className="text-[7px] font-bold text-white/20">{HAND_CELLS[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
