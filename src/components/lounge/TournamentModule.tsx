import { useState } from 'react';
import { Trophy, Users, TrendingUp, Clock, MapPin, DollarSign } from 'lucide-react';
import type { TournamentEvent } from '@/lib/loungeFramework';

interface Props {
  tournaments: TournamentEvent[];
  onTournamentClick?: (t: TournamentEvent) => void;
  region?: string;
  emptyHint?: string;
}

export function TournamentModule({ tournaments, onTournamentClick, region, emptyHint }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [view, setView] = useState<'overview' | 'chips'>('overview');
  const tabs = tournaments.slice(0, 8);
  const active = tabs[activeIdx];

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.04] px-3 py-2.5">
        <Trophy className="h-3.5 w-3.5 text-[#d4a52c]/60" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Tournaments</span>
        {region && (
          <span className="ml-auto flex items-center gap-1 text-[9px] text-white/30">
            <MapPin className="h-2.5 w-2.5" /> {region}
          </span>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto px-2 py-1.5 border-b border-white/[0.03] scrollbar-thin">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setActiveIdx(i)}
              className={`whitespace-nowrap rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all ${
                i === activeIdx
                  ? 'bg-[#c0911e]/15 text-[#d4a52c] border border-[#c0911e]/30'
                  : 'text-white/40 hover:text-white/70 border border-transparent'
              }`}
            >
              {t.name.length > 14 ? t.name.slice(0, 14) + '…' : t.name}
            </button>
          ))}
        </div>
      )}

      {active?.live && (
        <div className="flex shrink-0 gap-1 border-b border-white/[0.03] px-2 py-1.5">
          <button
            onClick={() => setView('overview')}
            className={`rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all ${
              view === 'overview' ? 'bg-white/10 text-white/80' : 'text-white/40 hover:text-white/70'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setView('chips')}
            className={`rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all ${
              view === 'chips' ? 'bg-white/10 text-white/80' : 'text-white/40 hover:text-white/70'
            }`}
          >
            Chip Counts
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Trophy className="mb-2 h-6 w-6 text-white/10" />
            <p className="text-[11px] font-medium text-white/30">
              {emptyHint ?? 'Select a poker destination to view tournaments'}
            </p>
          </div>
        ) : view === 'chips' && active.live ? (
          <div className="space-y-1.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Player-Reported</span>
              <span className="text-[8px] text-white/25">DEMO</span>
            </div>
            {active.live?.chipCounts?.length ? active.live.chipCounts.map((c) => (
              <div key={c.rank} className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#c0911e]/15 text-[9px] font-bold text-[#d4a52c]">
                  {c.rank}
                </span>
                <span className="flex-1 text-[11px] font-medium text-white/80">{c.playerName}</span>
                <span className="text-[11px] font-mono font-semibold text-white/90">{c.stack >= 1000 ? `${(c.stack / 1000).toFixed(0)}K` : c.stack}</span>
                <span className={`text-[8px] ${c.reportedAgo === 'NOW' ? 'font-bold text-emerald-400' : 'text-white/30'}`}>
                  {c.reportedAgo}
                </span>
              </div>
            )) : (
              <p className="py-4 text-center text-[10px] text-white/25">No chip counts reported yet</p>
            )}
            <button className="mt-2 w-full rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/5 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#d4a52c] transition-colors hover:bg-[#c0911e]/10">
              Update My Stack
            </button>
          </div>
        ) : (
          <button
            onClick={() => onTournamentClick?.(active)}
            className="w-full overflow-hidden rounded-xl border border-[#c0911e]/15 bg-[#c0911e]/[0.02] p-3 text-left transition-all hover:border-[#c0911e]/30 hover:bg-[#c0911e]/[0.05]"
          >
            {active.live && (
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-red-300">Live</span>
                <span className="ml-auto text-[9px] font-mono text-white/30">{active.live.lastUpdated}</span>
              </div>
            )}
            <div className="text-[12px] font-bold text-white/90">{active.name}</div>
            <div className="text-[10px] text-white/40">{active.venue}</div>

            {active.live ? (
              <div className="mt-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-white/50">Level <span className="font-semibold text-white/80">{active.live.level}</span></span>
                  <span className="flex items-center gap-1 text-amber-400/80">
                    <Clock className="h-2.5 w-2.5" />
                    <span className="font-mono font-semibold">{active.live.nextBreakIn}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-white/50">Blinds <span className="font-semibold text-white/80">{active.live.smallBlind}/{active.live.bigBlind}</span></span>
                  {active.live.ante > 0 && <span className="text-white/50">Ante <span className="font-semibold text-white/80">{active.live.ante}</span></span>}
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1 text-white/50">
                    <Users className="h-2.5 w-2.5" />
                    <span className="font-semibold text-white/80">{active.live.remaining}</span>/{active.live.entries}
                  </span>
                  <span className="flex items-center gap-1 text-white/50">
                    <TrendingUp className="h-2.5 w-2.5" />
                    Avg <span className="font-semibold text-white/80">{active.live.avgStack.toLocaleString()}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-white/50">Late reg: <span className="font-semibold text-amber-400/80">{active.live.lateRegRemaining}</span></span>
                </div>
                <div className="mt-1.5 flex items-center justify-between border-t border-white/[0.06] pt-1.5">
                  <span className="flex items-center gap-1 text-[10px] text-white/50">
                    <DollarSign className="h-2.5 w-2.5" />
                    Prize Pool
                  </span>
                  <span className="text-[12px] font-bold text-[#d4a52c]">
                    ${active.live.prizePool?.toLocaleString() ?? (active.live.entries * active.buyIn).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                <div className="text-white/50">Start: <span className="font-semibold text-white/80">{active.startTime}</span></div>
                <div className="text-white/50">Buy-in: <span className="font-semibold text-white/80">${active.buyIn}</span></div>
                <div className="text-white/50">Stack: <span className="font-semibold text-white/80">{active.startingStack.toLocaleString()}</span></div>
                <div className="text-white/50">Levels: <span className="font-semibold text-white/80">{active.blindLevelMinutes}m</span></div>
                {active.guarantee && (
                  <div className="text-white/50">GTD: <span className="font-semibold text-[#d4a52c]">${active.guarantee.toLocaleString()}</span></div>
                )}
              </div>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
