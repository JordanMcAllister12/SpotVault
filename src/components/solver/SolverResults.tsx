import { useState, useMemo } from 'react';
import { ChevronRight, Star, Save, FileText, Plus, StickyNote, Lock } from 'lucide-react';
import { StrategyMatrix } from './StrategyMatrix';
import { SaveToVaultModal } from './SaveToVaultModal';
import { solverNodeToNodeStrategy } from '@/lib/solver/nodeStrategy';
import type { SolverNode, SolverResult, SolverConfig, SolverJob } from '@/lib/solver/types';
import { boardLabel, SUIT_SYMBOLS, SUIT_COLORS, type SolverBoardCard } from '@/lib/solver/types';

interface SolverResultsProps {
  job: SolverJob;
  result: SolverResult;
  config: SolverConfig;
  currentNode: SolverNode;
  nodePath: SolverNode[];
  selectedHand: string | null;
  onSelectHand: (hand: string | null) => void;
  onNavigateChild: (node: SolverNode) => void;
  onNavigateBreadcrumb: (index: number) => void;
  onToggleFavorite: (jobId: string, currentFav: boolean) => void;
  onSaveToVault: (title: string, notes: string, tags: string[], category: string) => void;
  onAddNotes: (notes: string) => void;
  onNewSolve: () => void;
  onBack?: () => void;
}

export function SolverResults(props: SolverResultsProps) {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState('');
  const node = props.currentNode;
  const isMock = props.result.is_mock;

  const nodeStrategy = useMemo(
    () => solverNodeToNodeStrategy(node, isMock),
    [node, isMock],
  );

  // Selected hand detail
  const handDetail = props.selectedHand ? node.strategy_by_hand.find((h) => h.hand === props.selectedHand) : null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => props.onToggleFavorite(props.job.id, props.job.is_favorite)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-all ${
              props.job.is_favorite
                ? 'border-[#d4a52c]/40 bg-[#d4a52c]/10 text-[#f5e6b0]'
                : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            <Star className="h-3.5 w-3.5" /> {props.job.is_favorite ? 'Favorited' : 'Favorite'}
          </button>
          <button
            onClick={() => setSaveModalOpen(true)}
            className="flex items-center gap-1 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2.5 py-1.5 text-[10px] font-semibold text-[#f5e6b0] transition-all hover:bg-[#d4a52c]/15"
          >
            <Save className="h-3.5 w-3.5" /> Save Spot
          </button>
          <button
            onClick={() => setNotesOpen(!notesOpen)}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/50 transition-all hover:text-white/80"
          >
            <StickyNote className="h-3.5 w-3.5" /> Notes
          </button>
          <button
            onClick={props.onNewSolve}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/50 transition-all hover:text-white/80"
          >
            <Plus className="h-3.5 w-3.5" /> New Solve
          </button>
        </div>
      </div>

      {/* Mock warning */}
      {isMock && (
        <div className="mx-3 mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-[10px] text-amber-300/70">
          Demo Mode — These frequencies are mock data for interface development, not real solver output.
        </div>
      )}

      {/* Notes editor */}
      {notesOpen && (
        <div className="mx-3 mt-2 rounded-lg border border-white/[0.08] bg-black/30 p-3">
          <div className="mb-1.5 text-[9px] font-mono tracking-widest text-white/30 uppercase">Spot Notes</div>
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            rows={3}
            placeholder="Add your notes about this spot..."
            className="w-full rounded-lg border border-white/10 bg-[#050608] px-3 py-2 text-[12px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setNotesOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/50 hover:text-white/80">
              Close
            </button>
            <button
              onClick={() => { props.onAddNotes(notesText); setNotesOpen(false); }}
              className="rounded-lg bg-gradient-to-r from-[#d4a52c] to-[#c0911e] px-4 py-1.5 text-[11px] font-bold text-[#0a0c0e] hover:from-[#f5e6b0] hover:to-[#d4a52c]"
            >
              Save Notes
            </button>
          </div>
        </div>
      )}

      {/* Spot header */}
      <div className="mx-3 mt-2 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-2.5 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-white/30 uppercase">Positions</span>
            <span className="text-[12px] font-bold text-white">{props.config.hero_position} vs {props.config.villain_position}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-white/30 uppercase">Stack</span>
            <span className="text-[12px] font-bold text-white">{props.config.effective_stack_bb} BB</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-white/30 uppercase">Pot</span>
            <span className="text-[12px] font-bold text-white">{node.pot_bb} BB</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-white/30 uppercase">Board</span>
            <BoardCards board={node.board} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-white/30 uppercase">To Act</span>
            <span className="text-[12px] font-bold text-[#d4a52c]">{node.player_to_act}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-white/30 uppercase">Source</span>
            <span
              className={`rounded-[3px] border px-1.5 py-0.5 text-[8px] font-mono tracking-widest uppercase ${
                isMock
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300/70'
                  : 'border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]/80'
              }`}
            >
              {isMock ? 'Mock Data' : 'DeepSolver'}
            </span>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="mx-3 mt-2 flex flex-wrap items-center gap-1">
        {props.nodePath.map((n, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-white/20" />}
            <button
              onClick={() => props.onNavigateBreadcrumb(i)}
              className={`rounded px-2 py-1 text-[10px] font-medium transition-all ${
                i === props.nodePath.length - 1
                  ? 'bg-[#d4a52c]/15 text-[#f5e6b0]'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {i === 0 ? 'Root' : n.action_to_here[n.action_to_here.length - 1]?.action ?? `Node ${i}`}
            </button>
          </div>
        ))}
      </div>

      {/* Main content: grid + detail panel */}
      <div className="flex min-h-0 flex-1 gap-3 px-3 py-2">
        {/* Strategy grid */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Aggregate strategy bars */}
          <div className="mb-2 space-y-1.5">
            {node.aggregate_strategy.map((a, i) => {
              const colors: Record<string, string> = {
                fold: '#00aaff', call: '#00ff7f', raise: '#ff0033', 'all-in': '#cc1144',
                check: '#7a8499', bet: '#e8a838',
              };
              const color = colors[a.action] ?? '#888';
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-24 text-[10px] font-medium text-white/60">{a.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full transition-all" style={{ width: `${a.frequency * 100}%`, background: color }} />
                  </div>
                  <span className="w-10 text-right text-[10px] font-mono text-white/50">{(a.frequency * 100).toFixed(0)}%</span>
                </div>
              );
            })}
          </div>

          {/* Neon range grid */}
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div style={{ width: '100%', maxWidth: '100%', maxHeight: '100%' }}>
              <StrategyMatrix
                strategy={nodeStrategy}
                onCellClick={props.onSelectHand}
                selectedHand={props.selectedHand}
              />
            </div>
          </div>
        </div>

        {/* Hand detail panel */}
        <div className="hidden w-[220px] shrink-0 flex-col overflow-y-auto md:flex">
          <div className="sticky top-0 rounded-xl border border-white/[0.06] bg-black/30 p-4 backdrop-blur-md">
            <h3 className="mb-3 text-[11px] font-mono tracking-[0.2em] text-[#c0911e]/70 uppercase">Hand Detail</h3>
            {!handDetail ? (
              <div className="py-8 text-center">
                <p className="text-[11px] text-white/30">Select a hand from the grid to see action frequencies, EV, and equity.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-lg font-bold text-white">{handDetail.hand}</div>

                {/* Action frequencies */}
                <div>
                  <div className="mb-1 text-[9px] font-mono tracking-widest text-white/30 uppercase">Action Frequencies</div>
                  {handDetail.frequencies.map((f, i) => {
                    const colors: Record<string, string> = {
                      fold: '#00aaff', call: '#00ff7f', raise: '#ff0033', 'all-in': '#cc1144',
                      check: '#7a8499', bet: '#e8a838',
                    };
                    const color = colors[f.action] ?? '#888';
                    return (
                      <div key={i} className="mb-1 flex items-center gap-2">
                        <span className="w-20 text-[10px] text-white/60">{f.label}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full" style={{ width: `${f.frequency * 100}%`, background: color }} />
                        </div>
                        <span className="w-10 text-right text-[10px] font-mono text-white/50">{(f.frequency * 100).toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* EV by action */}
                <div>
                  <div className="mb-1 text-[9px] font-mono tracking-widest text-white/30 uppercase">EV by Action</div>
                  {handDetail.ev_by_action.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between py-0.5">
                      <span className="text-[10px] text-white/60 capitalize">{ev.action}</span>
                      <span className="text-[10px] font-mono text-white/50">{ev.ev === null ? '—' : `${ev.ev.toFixed(2)} BB`}</span>
                    </div>
                  ))}
                </div>

                {/* Equity */}
                <div>
                  <div className="mb-1 text-[9px] font-mono tracking-widest text-white/30 uppercase">Equity</div>
                  {handDetail.equity === null ? (
                    <span className="text-[10px] font-mono text-white/30">—</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-[#00ff7f]" style={{ width: `${handDetail.equity * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-white/50">{(handDetail.equity * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Future hooks — disabled */}
          <div className="mt-2 space-y-1.5">
            <DisabledAction icon={FileText} label="Create Quiz" />
            <DisabledAction icon={ChevronRight} label="Compare to My Hand" />
            <DisabledAction icon={ChevronRight} label="Open in HH Replayer" />
          </div>
        </div>
      </div>

      {/* Node navigation */}
      {node.children.length > 0 && (
        <div className="mx-3 mb-2 rounded-xl border border-white/[0.06] bg-black/30 p-3 backdrop-blur-md">
          <h3 className="mb-2 text-[11px] font-mono tracking-[0.2em] text-[#c0911e]/70 uppercase">Navigate Deeper</h3>
          <div className="flex flex-wrap gap-2">
            {node.children.map((child, i) => {
              const action = child.action_to_here[child.action_to_here.length - 1];
              return (
                <button
                  key={i}
                  onClick={() => props.onNavigateChild(child)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/20 bg-[#d4a52c]/5 px-3 py-1.5 text-[11px] font-semibold text-[#f5e6b0] transition-all hover:border-[#d4a52c]/40 hover:bg-[#d4a52c]/10"
                >
                  {action?.action === 'bet' || action?.action === 'raise'
                    ? `${action.action === 'bet' ? 'Bet' : 'Raise'} ${action.amount_pot_pct ? `${action.amount_pot_pct}%` : action.amount_bb ? `${action.amount_bb}BB` : ''}`
                    : action?.action ?? 'Node'}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Save modal */}
      {saveModalOpen && (
        <SaveToVaultModal
          config={props.config}
          onClose={() => setSaveModalOpen(false)}
          onSave={props.onSaveToVault}
        />
      )}
    </div>
  );
}

function DisabledAction({ icon: Icon, label }: { icon: typeof FileText; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-1.5 opacity-40">
      <Icon className="h-3.5 w-3.5 text-white/30" />
      <span className="text-[10px] font-medium text-white/40">{label}</span>
      <Lock className="ml-auto h-3 w-3 text-white/20" />
    </div>
  );
}

function BoardCards({ board }: { board: SolverBoardCard[] }) {
  if (board.length === 0) return <span className="text-[12px] text-white/30">—</span>;
  return (
    <div className="flex gap-1">
      {board.map((card, i) => (
        <span
          key={i}
          className="flex h-7 w-6 items-center justify-center rounded border border-white/10 bg-[#1a1a1a] text-[11px] font-bold"
          style={{ color: SUIT_COLORS[card.suit] }}
        >
          {card.rank}{SUIT_SYMBOLS[card.suit]}
        </span>
      ))}
    </div>
  );
}
