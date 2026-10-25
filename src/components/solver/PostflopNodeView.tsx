import { useMemo, useState, useEffect } from 'react';
import { Check, Plus } from 'lucide-react';
import { StrategyMatrix } from './StrategyMatrix';
import { generateNodeStrategyAsync, type NodeAction } from '@/lib/solver/nodeStrategy';
import { nextActor, firstToActPostflop } from '@/lib/solver/potCalculator';
import type {
  SolverStreetAction,
  SolverPosition,
  SolverBoardCard,
  SolverTableConfig,
  SolverFormat,
} from '@/lib/solver/types';

interface PostflopNodeViewProps {
  street: 'flop' | 'turn' | 'river';
  tableConfig: SolverTableConfig;
  effectiveStackBB: number;
  potBB: number;
  board: SolverBoardCard[];
  actions: SolverStreetAction[];
  onAddAction: (action: SolverStreetAction) => void;
  onSolveDecision: () => void;
  onContinue: () => void;
  canContinue: boolean;
  selectedHand?: string | null;
  onSelectHand?: (hand: string | null) => void;
  format?: SolverFormat;
  solveType?: 'chipev' | 'icm';
}

const MOCK_ACTIONS: { action: string; label: string }[] = [
  { action: 'fold', label: 'Fold' },
  { action: 'check', label: 'Check' },
  { action: 'call', label: 'Call' },
  { action: 'bet', label: 'Bet' },
  { action: 'raise', label: 'Raise' },
  { action: 'all-in', label: 'All-in' },
];

export function PostflopNodeView({
  street,
  tableConfig,
  effectiveStackBB,
  potBB,
  board,
  actions,
  onAddAction,
  onSolveDecision,
  onContinue,
  canContinue,
  selectedHand,
  onSelectHand,
  format = 'tournament',
  solveType = 'chipev',
}: PostflopNodeViewProps) {
  const allPositions = useMemo(
    () => {
      const all = tableConfig.seat_count === 2 ? (['SB', 'BB'] as SolverPosition[]) : (['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as SolverPosition[]);
      return all.slice(0, tableConfig.seat_count);
    },
    [tableConfig.seat_count],
  );

  const streetActions = actions.filter((a) => a.street === street);
  const [selectedPosition, setSelectedPosition] = useState<SolverPosition | null>(null);

  const currentActor = useMemo(() => {
    const folded = new Set<SolverPosition>();
    const allIn = new Set<SolverPosition>();
    for (const a of actions) {
      if (a.action === 'fold') folded.add(a.position);
      if (a.action === 'all-in') allIn.add(a.position);
    }
    const remaining = allPositions.filter((p) => !folded.has(p) && !allIn.has(p));
    if (remaining.length <= 1) return remaining[0] ?? null;
    if (streetActions.length === 0) return firstToActPostflop(remaining);
    const lastActor = streetActions[streetActions.length - 1].position;
    return nextActor(lastActor, remaining);
  }, [streetActions, allPositions, actions]);

  const activePosition = selectedPosition ?? currentActor;

  const [nodeStrategy, setNodeStrategy] = useState<Awaited<ReturnType<typeof generateNodeStrategyAsync>>>(null);

  useEffect(() => {
    if (!activePosition) { setNodeStrategy(null); return; }
    let cancelled = false;
    generateNodeStrategyAsync(
      activePosition, street, streetActions, board, tableConfig, effectiveStackBB, potBB, format, solveType,
    ).then(result => { if (!cancelled) setNodeStrategy(result); })
     .catch(() => { if (!cancelled) setNodeStrategy(null); });
    return () => { cancelled = true; };
  }, [activePosition, street, streetActions, board, tableConfig, effectiveStackBB, potBB, format, solveType]);

  const handleSelectAction = (act: NodeAction) => {
    if (!currentActor) return;
    const entry: SolverStreetAction = {
      street,
      position: currentActor,
      action: act.action,
    };
    if (act.amount_bb !== undefined) entry.amount_bb = act.amount_bb;
    if (act.amount_pot_pct !== undefined) entry.amount_pot_pct = act.amount_pot_pct;
    onAddAction(entry);
    setSelectedPosition(null);
  };

  const handleMockAction = (actionType: string) => {
    if (!currentActor) return;
    const entry: SolverStreetAction = {
      street,
      position: currentActor,
      action: actionType as SolverStreetAction['action'],
    };
    onAddAction(entry);
    setSelectedPosition(null);
  };

  const canSolve = streetActions.length > 0 && currentActor !== null;
  const streetLabel = street.charAt(0).toUpperCase() + street.slice(1);
  const isMock = nodeStrategy?.is_mock ?? true;

  const displayActions = useMemo(() => {
    if (!nodeStrategy) return [];
    if (isMock) {
      const seen = new Set<string>();
      const simplified: typeof nodeStrategy.available_actions = [];
      for (const act of nodeStrategy.available_actions) {
        const key = act.action;
        if (!seen.has(key)) {
          seen.add(key);
          simplified.push(act);
        }
      }
      return simplified;
    }
    return nodeStrategy.available_actions;
  }, [nodeStrategy, isMock]);

  if (!currentActor) {
    return (
      <div className="space-y-3">
        <p className="py-8 text-center text-[12px] text-white/30">
          {streetLabel} action complete.
          {canContinue ? ' Continue to the next street or solve the current decision.' : ' Solve the current decision.'}
        </p>
        {(canSolve || (canContinue && !currentActor)) && (
          <div className="flex items-center gap-2">
            {canSolve && (
              <button onClick={onSolveDecision} className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#d4a52c] to-[#c0911e] px-4 py-2 text-[12px] font-bold text-[#0a0c0e] transition-all hover:from-[#f5e6b0] hover:to-[#d4a52c]">
                <Check className="h-3.5 w-3.5" /> Solve This Decision
              </button>
            )}
            {canContinue && (
              <button onClick={onContinue} className="flex items-center gap-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-2 text-[11px] font-semibold text-[#f5e6b0] transition-all hover:bg-[#c0911e]/15">
                <Plus className="h-3.5 w-3.5" /> Continue to {street === 'flop' ? 'Turn' : 'River'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // nodeStrategy may be null — we keep the full layout and show no-data inside the grid only

  return (
    <div className="flex h-full w-full flex-col">
      {/* ============ POSITION HISTORY ROW — compact ============ */}
      <div className="solver-pos-strip shrink-0 border-b border-white/[0.06]">
        <div
          className="grid border border-white/[0.08] bg-black/30"
          style={{ gridTemplateColumns: `repeat(${allPositions.length}, 1fr)` }}
        >
          {allPositions.map((pos) => {
            const hasFolded = actions.some((a) => a.position === pos && a.action === 'fold');
            const posActions = streetActions.filter((a) => a.position === pos);
            const isActive = pos === activePosition;
            const actionSummary = hasFolded
              ? 'Fold'
              : posActions.length > 0
              ? posActions.map((a) => formatShort(a)).join(', ')
              : isActive
              ? 'To act'
              : '';

            return (
              <button
                key={pos}
                onClick={() => !hasFolded && setSelectedPosition(pos)}
                disabled={hasFolded}
                className={`min-w-0 border-r border-white/[0.07] px-1.5 py-1 last:border-r-0 transition-all ${
                  isActive
                    ? 'bg-[#d4a52c]/10'
                    : hasFolded
                    ? 'opacity-25 cursor-not-allowed'
                    : 'hover:bg-white/[0.04] cursor-pointer'
                }`}
                style={{ borderTop: isActive ? '2px solid #d4a52c' : '2px solid transparent' }}
              >
                <div className={`truncate text-[10px] font-bold ${
                  isActive ? 'text-[#f5e6b0]' : hasFolded ? 'text-white/20' : 'text-white/50'
                }`}>
                  {pos}
                </div>
                {actionSummary && (
                  <div className={`truncate text-[8px] font-mono ${
                    isActive ? 'text-[#d4a52c]/70' : hasFolded ? 'text-white/15' : 'text-[#c0911e]/60'
                  }`}>
                    {actionSummary}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============ HORIZONTAL ACTION STRIP ============ */}
      <div className="solver-action-strip shrink-0 border-b border-white/[0.06] px-2 py-1.5 md:px-3 md:py-2">
        <div className="flex items-stretch gap-2">
          <div className="flex w-[9%] shrink-0 items-center justify-center rounded-[5px] border border-[#d4a52c]/30 bg-[#d4a52c]/8">
            <span className="text-[11px] font-bold tracking-wide text-[#f5e6b0]">{activePosition}</span>
          </div>
          {nodeStrategy && !nodeStrategy.is_mock ? (
            displayActions.map((act, i) => (
              <button
                key={i}
                onClick={() => handleSelectAction(act)}
                className="flex flex-1 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[5px] border px-2 py-2 transition-all hover:scale-[1.02]"
                style={{
                  borderColor: `${act.color}40`,
                  backgroundColor: '#1a1d22',
                }}
              >
                <span className="text-[11px] font-bold tracking-wide" style={{ color: act.color }}>{act.label}</span>
              </button>
            ))
          ) : nodeStrategy && nodeStrategy.is_mock ? (
            <>
              {MOCK_ACTIONS.map((act) => {
                const isPrimary = act.action === 'fold' || act.action === 'check' || act.action === 'call' || act.action === 'bet';
                const widthClass = isPrimary ? 'w-[18%]' : act.action === 'raise' ? 'w-[27%]' : 'w-[26%]';
                return (
                  <button
                    key={act.action}
                    onClick={() => handleMockAction(act.action)}
                    className={`${widthClass} flex shrink-0 items-center justify-center rounded-[5px] border border-white/[0.1] bg-[#1a1d22] px-2 py-2 transition-all hover:border-[#d4a52c]/50 hover:bg-[#24282e]`}
                  >
                    <span className="text-[11px] font-bold tracking-wide text-white/90">{act.label}</span>
                  </button>
                );
              })}
              <span className="ml-auto self-center border border-[#c0911e]/20 bg-[#c0911e]/5 px-1.5 py-0.5 text-[7px] tracking-widest text-[#c0911e]/50 uppercase">
                Mock
              </span>
            </>
          ) : (
            // No strategy data — show disabled action buttons
            MOCK_ACTIONS.map((act) => (
              <div
                key={act.action}
                className="flex flex-1 shrink-0 items-center justify-center rounded-[5px] border border-white/[0.04] bg-[#1a1d22] px-2 py-2 opacity-30"
              >
                <span className="text-[11px] font-bold tracking-wide text-white/40">{act.label}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ============ CENTER: RANGE MATRIX ============ */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-1.5 md:p-2">
        <div style={{ width: '100%', maxWidth: '100%', maxHeight: '100%' }} className="relative">
          <StrategyMatrix
            strategy={nodeStrategy}
            onCellClick={onSelectHand}
            selectedHand={selectedHand}
            noDataMessage={nodeStrategy === null ? `No reference strategy loaded for this node` : undefined}
          />
          {nodeStrategy === null && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
              <p className="text-[13px] font-semibold text-white/40">Strategy data not loaded for this node</p>
              <p className="text-[10px] text-white/25">{activePosition} — {streetLabel} — {effectiveStackBB}bb</p>
              <p className="mt-1 text-[9px] text-white/20">Import reference data or solve with DeepSolver to populate this node.</p>
            </div>
          )}
        </div>
      </div>

      {/* Solve / Continue — bottom */}
      {(canSolve || (canContinue && !currentActor)) && (
        <div className="solver-solve-bar flex shrink-0 items-center gap-2 px-2 py-0.5">
          {canSolve && (
            <button onClick={onSolveDecision} className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#d4a52c] to-[#c0911e] px-4 py-1.5 text-[11px] font-bold text-[#0a0c0e] transition-all hover:from-[#f5e6b0] hover:to-[#d4a52c]">
              <Check className="h-3.5 w-3.5" /> Solve
            </button>
          )}
          {canContinue && (
            <button onClick={onContinue} className="flex items-center gap-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-1.5 text-[10px] font-semibold text-[#f5e6b0] transition-all hover:bg-[#c0911e]/15">
              <Plus className="h-3.5 w-3.5" /> {street === 'flop' ? 'Turn' : 'River'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatShort(action: SolverStreetAction): string {
  switch (action.action) {
    case 'fold': return 'F';
    case 'check': return 'X';
    case 'call': return 'Call';
    case 'bet': return `B${action.amount_bb ?? action.amount_pot_pct + '%'}`;
    case 'raise': return `R${action.amount_bb ?? ''}`;
    case 'all-in': return 'AI';
    default: return action.action;
  }
}
