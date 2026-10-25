import { SUIT_SYMBOLS, SUIT_COLORS, type SolverBoardCard, type SolverTableConfig, type SolverStreetAction } from '@/lib/solver/types';
import type { PotCalcResult } from '@/lib/solver/potCalculator';
import { streetLabel } from '@/lib/solver/potCalculator';

interface HandSummaryProps {
  tableConfig: SolverTableConfig;
  effectiveStackBB: number;
  board: SolverBoardCard[];
  actions: SolverStreetAction[];
  potCalc: PotCalcResult;
}

export function HandSummary({ tableConfig, effectiveStackBB, board, actions, potCalc }: HandSummaryProps) {
  const playerToAct = potCalc.player_to_act;
  const participants = potCalc.participants;

  return (
    <div className="rounded-lg border border-[#c0911e]/15 bg-black/40 px-3 py-2.5 backdrop-blur-sm">
      {/* Top row: table config + pot + stacks */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase">
            {tableConfig.seat_count}-handed
          </span>
          <span className="text-white/15">·</span>
          <span className="text-[10px] font-mono text-white/40">{effectiveStackBB}BB eff</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Pot</span>
          <span className="text-[12px] font-bold text-[#d4a52c]">{potCalc.pot_bb.toFixed(1)}BB</span>
        </div>

        {participants.length >= 2 && (
          <div className="flex items-center gap-2 text-[9px] font-mono">
            {participants.slice(0, 2).map((pos, i) => (
              <span key={pos}>
                {i === 1 && <span className="text-white/15 mr-1">vs</span>}
                <span className="text-white/40">{pos}</span>
                <span className="text-white/70 ml-0.5">{(potCalc.remaining_stacks[pos] ?? effectiveStackBB).toFixed(1)}BB</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Board */}
      {board.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Board</span>
          <div className="flex gap-1">
            {board.map((card, i) => (
              <span key={i} className="text-[11px] font-bold" style={{ color: SUIT_COLORS[card.suit] }}>
                {card.rank}{SUIT_SYMBOLS[card.suit]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action breadcrumb */}
      {actions.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">History</span>
          <div className="flex flex-wrap items-center gap-0.5">
            {actions.map((a, i) => (
              <span key={i} className="text-[9px] font-mono">
                {i > 0 && <span className="text-white/15 mx-0.5">→</span>}
                <span className={a.action === 'fold' ? 'text-white/25' : 'text-[#c0911e]/70'}>
                  {a.position}
                  {a.action === 'fold' ? 'F' : a.action === 'check' ? 'X' : a.action === 'call' ? 'Call' : a.action === 'bet' ? `B${a.amount_bb ?? a.amount_pot_pct + '%'}` : a.action === 'raise' ? `R${a.amount_bb ?? ''}` : 'AI'}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current node */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Node</span>
        <span className="text-[10px] font-semibold text-white/60">
          {streetLabel(potCalc.street)}
          {playerToAct && (
            <>
              <span className="text-white/30"> — </span>
              <span className="text-[#d4a52c]">{playerToAct} to act</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
