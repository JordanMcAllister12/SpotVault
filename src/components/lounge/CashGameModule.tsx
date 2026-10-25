import { useState } from 'react';
import { Radio, Users, Clock, MapPin, Calendar } from 'lucide-react';
import type { CashGameSession } from '@/lib/loungeFramework';

interface Props {
  cashGames: CashGameSession[];
  region?: string;
  emptyHint?: string;
}

export function CashGameModule({ cashGames, region, emptyHint }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const tabs = cashGames.slice(0, 8);
  const active = tabs[activeIdx];

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.04] px-3 py-2.5">
        <Radio className="h-3.5 w-3.5 text-emerald-400/60" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Cash Games</span>
        {region && (
          <span className="ml-auto flex items-center gap-1 text-[9px] text-white/30">
            <MapPin className="h-2.5 w-2.5" /> {region}
          </span>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto px-2 py-1.5 border-b border-white/[0.03] scrollbar-thin">
          {tabs.map((g, i) => (
            <button
              key={g.id}
              onClick={() => setActiveIdx(i)}
              className={`whitespace-nowrap rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all ${
                i === activeIdx
                  ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'
                  : 'text-white/40 hover:text-white/70 border border-transparent'
              }`}
            >
              {g.game.length > 12 ? g.game.slice(0, 12) + '…' : g.game}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Radio className="mb-2 h-6 w-6 text-white/10" />
            <p className="text-[11px] font-medium text-white/30">
              {emptyHint ?? 'Select a poker destination to view cash games'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.02] p-3">
            <div className="flex items-center gap-1.5">
              {active.status === 'STARTING' ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-amber-300">Starting Soon</span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-300">Live</span>
                </>
              )}
              <span className="ml-auto text-[9px] font-mono text-white/30">{active.lastUpdated}</span>
            </div>
            <div className="mt-1.5 text-[12px] font-bold text-white/90">{active.game}</div>
            <div className="text-[10px] text-white/40">{active.venue}</div>

            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-white/50">
                  <span className="font-semibold text-white/80">{active.tables}</span> tables
                </span>
                <span className="flex items-center gap-1 text-white/50">
                  <Users className="h-2.5 w-2.5" />
                  <span className="font-semibold text-white/80">{active.players}</span> players
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-white/50">
                  Open seats: <span className="font-semibold text-emerald-300">{active.openSeats ?? 0}</span>
                </span>
                {active.waiting > 0 && (
                  <span className="flex items-center gap-1 text-amber-400/70">
                    <Clock className="h-2.5 w-2.5" />
                    <span className="font-semibold">{active.waiting}</span> on waitlist
                  </span>
                )}
              </div>
              {active.status === 'STARTING' && active.startsAt && (
                <div className="flex items-center gap-1 text-[10px] text-amber-400/80">
                  <Calendar className="h-2.5 w-2.5" />
                  <span>Expected start: <span className="font-semibold">{active.startsAt}</span></span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
