import { Plus } from 'lucide-react';

interface SolverDashboardProps {
  onNewSolve: () => void;
}

export function SolverDashboard({ onNewSolve }: SolverDashboardProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <h1 className="text-2xl font-bold text-white">Solver</h1>
      <p className="mt-1 text-[12px] text-white/35">Build. Solve. Understand.</p>
      <button
        onClick={onNewSolve}
        className="mt-6 flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#d4a52c] to-[#c0911e] px-6 py-2.5 text-[13px] font-bold text-[#0a0c0e] transition-all hover:from-[#f5e6b0] hover:to-[#d4a52c]"
      >
        <Plus className="h-4 w-4" /> New Solve
      </button>
    </div>
  );
}
