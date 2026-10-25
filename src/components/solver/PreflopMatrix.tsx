import { useMemo, useState, useEffect } from 'react';
import { Check, Plus } from 'lucide-react';
import { StrategyMatrix } from './StrategyMatrix';
import { generateNodeStrategyAsync, type NodeAction } from '@/lib/solver/nodeStrategy';
import { positionsForTable, firstToActPreflop, nextActor } from '@/lib/solver/potCalculator';
import { POSITIONS, type SolverFormat } from '@/lib/solver/types';
import type {
  SolverStreetAction,
  SolverPosition,
  SolverTableConfig,
} from '@/lib/solver/types';

interface PreflopMatrixProps {
  tableConfig: SolverTableConfig;
  effectiveStackBB: number;
  potBB: number;
  actions: SolverStreetAction[];
  onAddAction: (action: SolverStreetAction) => void;
  onSetActions: (actions: SolverStreetAction[]) => void;
  onSolveDecision: () => void;
  onContinue: () => void;
  selectedHand?: string | null;
  onSelectHand?: (hand: string | null) => void;
  format?: SolverFormat;
  solveType?: 'chipev' | 'icm';
}

type PanelState = 'active' | 'completed' | 'preview' | 'future';

export function PreflopMatrix({
  tableConfig,
  effectiveStackBB,
  potBB,
  actions,
  onSetActions,
  onSolveDecision,
  onContinue,
  selectedHand,
  onSelectHand,
  format = 'tournament',
  solveType = 'chipev',
}: PreflopMatrixProps) {
  const allPositions = positionsForTable(tableConfig.seat_count);
  const committedActions = useMemo(
    () => actions.filter((a) => a.street === 'preflop'),
    [actions],
  );

  const [previewFolds, setPreviewFolds] = useState<SolverPosition[]>([]);

  const effectiveActions = useMemo(() => {
    const folds: SolverStreetAction[] = previewFolds.map((pos) => ({
      street: 'preflop' as const,
      position: pos,
      action: 'fold' as const,
    }));
    return [...committedActions, ...folds];
  }, [committedActions, previewFolds]);

  const currentActor = useMemo(() => {
    const folded = new Set<SolverPosition>();
    const allIn = new Set<SolverPosition>();
    for (const a of effectiveActions) {
      if (a.action === 'fold') folded.add(a.position);
      if (a.action === 'all-in') allIn.add(a.position);
    }
    const remaining = allPositions.filter((p) => !folded.has(p) && !allIn.has(p));
    if (remaining.length <= 1) return remaining[0] ?? null;
    if (effectiveActions.length === 0) return firstToActPreflop(tableConfig.seat_count);
    const lastActor = effectiveActions[effectiveActions.length - 1].position;
    return nextActor(lastActor, remaining);
  }, [effectiveActions, allPositions, tableConfig.seat_count]);

  const [nodeStrategy, setNodeStrategy] = useState<ReturnType<typeof generateNodeStrategyAsync> extends Promise<infer T> ? T : never>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);

  useEffect(() => {
    if (!currentActor) { setNodeStrategy(null); return; }
    setStrategyLoading(true);
    generateNodeStrategyAsync(
      currentActor,
      'preflop',
      effectiveActions,
      [],
      tableConfig,
      effectiveStackBB,
      potBB,
      format,
      solveType,
    ).then(result => {
      setNodeStrategy(result);
      setStrategyLoading(false);
    }).catch(() => {
      setNodeStrategy(null);
      setStrategyLoading(false);
    });
  }, [currentActor, effectiveActions, tableConfig, effectiveStackBB, potBB, format, solveType]);

  const handlePositionClick = (targetPos: SolverPosition) => {
    if (!currentActor || targetPos === currentActor) return;

    const hasCommittedAction = committedActions.some((a) => a.position === targetPos);
    if (hasCommittedAction) return;

    const previewIdx = previewFolds.indexOf(targetPos);
    if (previewIdx >= 0) {
      setPreviewFolds(previewFolds.slice(0, previewIdx));
      return;
    }

    const currentIdx = POSITIONS.indexOf(currentActor);
    const targetIdx = POSITIONS.indexOf(targetPos);
    if (targetIdx <= currentIdx) return;

    const folded = new Set<SolverPosition>();
    const allIn = new Set<SolverPosition>();
    for (const a of committedActions) {
      if (a.action === 'fold') folded.add(a.position);
      if (a.action === 'all-in') allIn.add(a.position);
    }

    const toFold: SolverPosition[] = [];
    for (const pos of POSITIONS.slice(currentIdx, targetIdx)) {
      if (folded.has(pos) || allIn.has(pos)) continue;
      toFold.push(pos);
    }

    setPreviewFolds(toFold);
  };

  const handleSelectAction = (act: NodeAction) => {
    if (!currentActor) return;

    const foldEntries: SolverStreetAction[] = previewFolds.map((pos) => ({
      street: 'preflop' as const,
      position: pos,
      action: 'fold' as const,
    }));

    const newAction: SolverStreetAction = {
      street: 'preflop',
      position: currentActor,
      action: act.action,
    };
    if (act.action === 'all-in') {
      newAction.amount_bb = computeStack(currentActor, effectiveStackBB, tableConfig);
    } else if (act.amount_bb !== undefined) {
      newAction.amount_bb = act.amount_bb;
    }
    if (act.amount_pot_pct !== undefined) newAction.amount_pot_pct = act.amount_pot_pct;

    onSetActions([...committedActions, ...foldEntries, newAction]);
    setPreviewFolds([]);
  };

  const canSolve = effectiveActions.length > 0 && currentActor !== null;
  const canContinue = committedActions.length > 0 && currentActor === null;

  const getPanelState = (pos: SolverPosition): PanelState => {
    if (committedActions.some((a) => a.position === pos)) return 'completed';
    if (previewFolds.includes(pos)) return 'preview';
    if (pos === currentActor) return 'active';
    return 'future';
  };

  const getCommittedAction = (pos: SolverPosition): SolverStreetAction | undefined => {
    return committedActions.find((a) => a.position === pos);
  };

  if (!currentActor) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-[13px] text-white/30">
          Preflop action complete. Continue to flop or solve the current decision.
        </p>
        {(canSolve || canContinue) && (
          <div className="flex items-center gap-2">
            {canSolve && (
              <button onClick={onSolveDecision} className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#d4a52c] to-[#c0911e] px-4 py-2 text-[12px] font-bold text-[#0a0c0e] transition-all hover:from-[#f5e6b0] hover:to-[#d4a52c]">
                <Check className="h-3.5 w-3.5" /> Solve This Decision
              </button>
            )}
            {canContinue && (
              <button onClick={onContinue} className="flex items-center gap-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-2 text-[11px] font-semibold text-[#f5e6b0] transition-all hover:bg-[#c0911e]/15">
                <Plus className="h-3.5 w-3.5" /> Continue to Flop
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Build the no-data message for the grid overlay
  const scenarioLabel = effectiveActions.length === 0
    ? 'Unopened'
    : effectiveActions.some(a => a.action === 'raise' || a.action === 'bet')
    ? 'Facing Raise'
    : 'Unopened';
  const anteLabel = tableConfig.ante_type === 'none' ? 'No Ante' : `${tableConfig.ante_type === 'bb_ante' ? 'BB Ante' : 'Per-Player'} ${tableConfig.ante_bb}bb`;
  const noDataMessage = nodeStrategy === null
    ? `Strategy data not loaded for this node`
    : undefined;
  const noDataSub = nodeStrategy === null
    ? `${currentActor} — ${scenarioLabel} — ${effectiveStackBB}bb — ${tableConfig.seat_count}-Max — ChipEV`
    : undefined;
  const noDataConfig = nodeStrategy === null
    ? `${format === 'tournament' ? 'MTT' : 'Cash'} · ${anteLabel} · ${solveType.toUpperCase()}`
    : undefined;

  return (
    <div className="flex h-full w-full flex-col">
      {/* ============ UNIFIED POSITION/ACTION STRIP ============ */}
      <div className="solver-pos-strip shrink-0 border-b border-white/[0.06]">
        <div
          className="grid border-x border-white/[0.08] bg-black/30"
          style={{ gridTemplateColumns: `repeat(${allPositions.length}, 1fr)` }}
        >
          {allPositions.map((pos) => {
            const state = getPanelState(pos);
            const stack = computeStack(pos, effectiveStackBB, tableConfig);
            const committed = getCommittedAction(pos);
            const isActive = state === 'active';
            const isClickable = state === 'future' || state === 'preview';

            return (
              <div
                key={pos}
                onClick={isClickable ? () => handlePositionClick(pos) : undefined}
                className={`solver-pos-cell min-w-0 border-r border-white/[0.07] px-1.5 py-1 last:border-r-0 transition-colors ${
                  isActive ? 'bg-[#d4a52c]/8' : ''
                } ${isClickable ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
                style={{ borderTop: isActive ? '2px solid #d4a52c' : '2px solid transparent' }}
              >
                {/* Header: position + stack */}
                <div className="flex items-center justify-between gap-0.5 pb-0.5">
                  <span className={`truncate text-[10px] font-bold ${
                    isActive ? 'text-[#f5e6b0]'
                    : state === 'completed' ? 'text-white/40'
                    : state === 'preview' ? 'text-white/50'
                    : 'text-white/55'
                  }`}>{pos}</span>
                  <span className={`shrink-0 text-[8px] font-mono ${
                    isActive ? 'text-[#d4a52c]/80' : 'text-white/30'
                  }`}>{stack.toFixed(0)}BB</span>
                </div>

                {/* Action rows */}
                <div className="solver-action-rows space-y-0.5">
                  {ACTION_ROWS.map((row) => {
                    const committedThisRow = committed ? actionMatchesRow(committed.action, row.key) : false;
                    const activeAction = isActive && nodeStrategy ? findActionForRow(nodeStrategy.available_actions, row.key) : undefined;
                    const amount = activeAction
                      ? formatAmount(activeAction, stack)
                      : (committedThisRow && committed?.amount_bb ? `${committed.amount_bb.toFixed(1)} BB` : null);
                    const showAmount = amount !== null && (isActive || committedThisRow);

                    return (
                      <button
                        key={row.key}
                        type="button"
                        disabled={!isActive || !activeAction}
                        onClick={isActive && activeAction ? (e) => { e.stopPropagation(); handleSelectAction(activeAction); } : undefined}
                        className={`solver-action-btn w-full rounded-[3px] border px-1.5 py-0.5 text-left transition-all ${
                          committedThisRow
                            ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]'
                            : isActive && activeAction
                            ? 'border-white/[0.08] bg-[#1a1d22] text-white/70 hover:border-[#d4a52c]/40 hover:bg-[#24282e]'
                            : 'border-transparent text-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-bold tracking-wide">{row.label}</span>
                          {showAmount && (
                            <span className="text-[8px] font-mono text-[#d4a52c]/70">{amount}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============ CENTER: RANGE MATRIX ============ */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-1.5 md:p-2">
        <div style={{ width: '100%', maxWidth: '100%', maxHeight: '100%' }} className="relative">
          <StrategyMatrix
            strategy={nodeStrategy}
            onCellClick={onSelectHand}
            selectedHand={selectedHand}
            noDataMessage={noDataMessage}
          />
          {noDataMessage && noDataSub && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
              <p className="text-[13px] font-semibold text-white/40">{noDataMessage}</p>
              <p className="text-[10px] text-white/25">{noDataSub}</p>
              {noDataConfig && <p className="text-[9px] text-white/20">{noDataConfig}</p>}
              <p className="mt-1 text-[9px] text-white/20">Import reference data or solve with DeepSolver to populate this node.</p>
            </div>
          )}
        </div>
      </div>

      {/* Solve / Continue — bottom */}
      {(canSolve || canContinue) && (
        <div className="solver-solve-bar flex shrink-0 items-center gap-2 px-2 py-0.5">
          {canSolve && (
            <button onClick={onSolveDecision} className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#d4a52c] to-[#c0911e] px-4 py-1.5 text-[11px] font-bold text-[#0a0c0e] transition-all hover:from-[#f5e6b0] hover:to-[#d4a52c]">
              <Check className="h-3.5 w-3.5" /> Solve
            </button>
          )}
          {canContinue && (
            <button onClick={onContinue} className="flex items-center gap-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-1.5 text-[10px] font-semibold text-[#f5e6b0] transition-all hover:bg-[#c0911e]/15">
              <Plus className="h-3.5 w-3.5" /> Flop
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function computeStack(pos: SolverPosition, effectiveStackBB: number, tableConfig: SolverTableConfig): number {
  if (pos === 'SB') return Math.max(0, effectiveStackBB - tableConfig.sb_bb);
  if (pos === 'BB') {
    let deduction = tableConfig.bb_bb;
    if (tableConfig.ante_type === 'bb_ante') deduction += tableConfig.ante_bb;
    return Math.max(0, effectiveStackBB - deduction);
  }
  if (tableConfig.ante_type === 'per_player') {
    return Math.max(0, effectiveStackBB - tableConfig.ante_bb);
  }
  return effectiveStackBB;
}

const ACTION_ROWS = [
  { key: 'fold', label: 'FOLD' },
  { key: 'call', label: 'CALL' },
  { key: 'raise', label: 'RAISE' },
  { key: 'all-in', label: 'ALL-IN' },
] as const;

function findActionForRow(actions: NodeAction[], rowKey: string): NodeAction | undefined {
  switch (rowKey) {
    case 'fold': return actions.find((a) => a.action === 'fold' || a.action === 'check');
    case 'call': return actions.find((a) => a.action === 'call' || a.action === 'bet');
    case 'raise': return actions.find((a) => a.action === 'raise');
    case 'all-in': return actions.find((a) => a.action === 'all-in');
    default: return undefined;
  }
}

function actionMatchesRow(action: string, rowKey: string): boolean {
  if (rowKey === 'fold') return action === 'fold' || action === 'check';
  if (rowKey === 'call') return action === 'call' || action === 'bet';
  if (rowKey === 'raise') return action === 'raise';
  if (rowKey === 'all-in') return action === 'all-in';
  return false;
}

function formatAmount(act: NodeAction, stack: number): string | null {
  if (act.action === 'all-in') return `${stack.toFixed(1)} BB`;
  if (act.amount_bb !== undefined) return `${act.amount_bb.toFixed(1)} BB`;
  if (act.amount_pot_pct !== undefined) return `${act.amount_pot_pct}%`;
  return null;
}
