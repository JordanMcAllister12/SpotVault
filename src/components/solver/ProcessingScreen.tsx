import { Loader2, ArrowLeft } from 'lucide-react';
import type { SolverConfig } from '@/lib/solver/types';
import { boardLabel } from '@/lib/solver/types';

interface ProcessingScreenProps {
  config: SolverConfig;
  stage: string;
  onBack: () => void;
}

export function ProcessingScreen({ config, stage, onBack }: ProcessingScreenProps) {
  const stages = ['Preparing tree', 'Submitting solve', 'Solving', 'Processing strategy', 'Complete'];
  const currentIdx = stages.indexOf(stage);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-12">
      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute left-4 top-4 flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold text-white/50 transition-all hover:text-white/80"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </button>

      {/* Animated icon */}
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-[#d4a52c]/20 bg-[#d4a52c]/5">
        <Loader2 className="h-10 w-10 animate-spin text-[#d4a52c]" />
      </div>

      <h2 className="mb-2 text-xl font-bold text-white">Solving your spot</h2>
      <p className="mb-8 text-[12px] text-white/40">This may take a moment. You can leave this page — the solve will appear in Recent Solves when complete.</p>

      {/* Spot summary */}
      <div className="mb-8 grid w-full max-w-md grid-cols-2 gap-2">
        <SummaryItem label="Positions" value={`${config.hero_position} vs ${config.villain_position}`} />
        <SummaryItem label="Stack" value={`${config.effective_stack_bb} BB`} />
        <SummaryItem label="Pot" value={`${config.pot_size_bb} BB`} />
        <SummaryItem label="Board" value={config.board.length > 0 ? boardLabel(config.board) : '—'} />
      </div>

      {/* Stage progress */}
      <div className="w-full max-w-md space-y-2">
        {stages.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                i < currentIdx
                  ? 'bg-[#d4a52c] text-[#0a0c0e]'
                  : i === currentIdx
                  ? 'border-2 border-[#d4a52c] bg-[#d4a52c]/10'
                  : 'border border-white/10 bg-white/[0.02]'
              }`}
            >
              {i < currentIdx ? '✓' : i + 1}
            </div>
            <span
              className={`text-[11px] font-medium ${
                i <= currentIdx ? 'text-white/70' : 'text-white/25'
              }`}
            >
              {s}
            </span>
            {i === currentIdx && (
              <div className="flex-1">
                <div className="h-px w-full overflow-hidden bg-white/5">
                  <div className="h-px w-1/3 animate-pulse bg-[#d4a52c]" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
      <div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">{label}</div>
      <div className="mt-0.5 text-[11px] font-semibold text-white/70">{value}</div>
    </div>
  );
}
