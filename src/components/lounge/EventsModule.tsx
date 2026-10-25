import { useState } from 'react';
import { ChevronLeft, ChevronRight, Star, Calendar } from 'lucide-react';
import {
  calculateBestPlayerValue,
  getBestValueExplanation,
  type TournamentEvent,
} from '@/lib/loungeFramework';

interface Props {
  tournaments: TournamentEvent[];
  title?: string;
  onTournamentClick?: (t: TournamentEvent) => void;
}

export function EventsModule({ tournaments, title = 'Events', onTournamentClick }: Props) {
  const [index, setIndex] = useState(0);
  const [showExplain, setShowExplain] = useState(false);
  const bestValue = calculateBestPlayerValue(tournaments);

  if (tournaments.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-2 px-3 py-2.5 border-b border-white/[0.04]">
          <Calendar className="h-3.5 w-3.5 text-[#d4a52c]/60" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{title}</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-center">
          <p className="text-[11px] text-white/25">No events scheduled</p>
        </div>
      </div>
    );
  }

  const current = tournaments[index];

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5 border-b border-white/[0.04]">
        <Calendar className="h-3.5 w-3.5 text-[#d4a52c]/60" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{title}</span>
        <span className="ml-auto text-[9px] font-mono text-white/30">{index + 1} / {tournaments.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="relative">
          {/* Best value badge */}
          {bestValue && bestValue.id === current.id && (
            <div className="mb-2">
              <button
                onClick={() => setShowExplain(!showExplain)}
                className="flex items-center gap-1.5 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#d4a52c]"
              >
                <Star className="h-3 w-3 fill-[#d4a52c]" /> Best Player Value
              </button>
              {showExplain && (
                <p className="mt-1.5 rounded-md border border-[#c0911e]/15 bg-[#c0911e]/5 p-2 text-[10px] leading-relaxed text-white/60">
                  {getBestValueExplanation(current)}
                </p>
              )}
            </div>
          )}

          {/* Event card */}
          <button
            onClick={() => onTournamentClick?.(current)}
            className="w-full overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-all hover:border-[#c0911e]/20 hover:bg-white/[0.04]"
          >
            <div className="text-[12px] font-bold text-white/90">{current.name}</div>
            <div className="mt-0.5 text-[10px] text-white/40">{current.venue}</div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <div className="text-white/50">Start: <span className="font-semibold text-white/80">{current.startTime}</span></div>
              <div className="text-white/50">Buy-in: <span className="font-semibold text-white/80">${current.buyIn}</span></div>
              <div className="text-white/50">Stack: <span className="font-semibold text-white/80">{current.startingStack.toLocaleString()}</span></div>
              <div className="text-white/50">Levels: <span className="font-semibold text-white/80">{current.blindLevelMinutes}m</span></div>
              <div className="text-white/50">Late reg: <span className="font-semibold text-white/80">{current.lateRegistration}</span></div>
              {current.guarantee && (
                <div className="text-white/50">GTD: <span className="font-semibold text-[#d4a52c]">${current.guarantee.toLocaleString()}</span></div>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              {current.reEntry && (
                <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-400/70">Re-entry</span>
              )}
              {current.rebuy && (
                <span className="rounded bg-blue-400/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-blue-400/70">Rebuy</span>
              )}
              {current.addOn && (
                <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-400/70">Add-on</span>
              )}
            </div>
          </button>

          {/* Navigation */}
          {tournaments.length > 1 && (
            <div className="mt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => setIndex((i) => (i - 1 + tournaments.length) % tournaments.length)}
                className="rounded-md border border-white/10 p-1 text-white/40 transition-colors hover:text-white/80"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="flex gap-1">
                {tournaments.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? 'w-4 bg-[#d4a52c]' : 'w-1.5 bg-white/20'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => setIndex((i) => (i + 1) % tournaments.length)}
                className="rounded-md border border-white/10 p-1 text-white/40 transition-colors hover:text-white/80"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
