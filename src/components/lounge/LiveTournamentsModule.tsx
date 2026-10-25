import { Radio, Users, Clock, TrendingUp } from 'lucide-react';
import type { TournamentEvent, CashGameSession } from '@/lib/loungeFramework';

interface Props {
  liveTournaments: TournamentEvent[];
  cashGames: CashGameSession[];
  onTournamentClick?: (t: TournamentEvent) => void;
  region?: string;
}

export function LiveTournamentsModule({ liveTournaments, cashGames, onTournamentClick, region }: Props) {
  const liveCount = liveTournaments.length + cashGames.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5 border-b border-white/[0.04]">
        <Radio className="h-3.5 w-3.5 text-red-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
          {region ? `Live in ${region}` : 'Live Now'}
        </span>
        {liveCount > 0 && (
          <span className="ml-auto rounded-full bg-red-400/15 px-2 py-0.5 text-[9px] font-bold text-red-300">
            {liveCount} live
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {liveCount === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-6 text-center">
            <Clock className="mb-2 h-6 w-6 text-white/15" />
            <p className="text-[11px] text-white/30">Nothing live right now</p>
            <p className="mt-0.5 text-[10px] text-white/20">Check back when games start</p>
          </div>
        ) : (
          <>
            {/* Live tournaments */}
            {liveTournaments.map((t) => (
              <LiveTournamentCard key={t.id} tournament={t} onClick={() => onTournamentClick?.(t)} />
            ))}

            {/* Cash games */}
            {cashGames.map((g) => (
              <CashGameCard key={g.id} game={g} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function LiveTournamentCard({ tournament: t, onClick }: { tournament: TournamentEvent; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full overflow-hidden rounded-xl border border-red-400/15 bg-red-400/[0.03] p-3 text-left transition-all hover:border-red-400/30 hover:bg-red-400/[0.06]"
    >
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-red-300">Live</span>
        <span className="ml-auto text-[9px] font-mono text-white/30">{t.live?.lastUpdated}</span>
      </div>
      <div className="mt-1.5 text-[12px] font-bold text-white/90">{t.name}</div>
      <div className="text-[10px] text-white/40">{t.venue}</div>

      {t.live && (
        <>
          <div className="mt-2 flex items-center gap-3 text-[10px]">
            <span className="text-white/50">Level <span className="font-semibold text-white/80">{t.live.level}</span></span>
            <span className="text-white/50">Blinds <span className="font-semibold text-white/80">{t.live.smallBlind}/{t.live.bigBlind}</span></span>
            {t.live.ante > 0 && <span className="text-white/50">Ante <span className="font-semibold text-white/80">{t.live.ante}</span></span>}
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-white/50">
              <Users className="h-2.5 w-2.5" />
              <span className="font-semibold text-white/80">{t.live.remaining}</span>/{t.live.entries}
            </span>
            <span className="flex items-center gap-1 text-white/50">
              <TrendingUp className="h-2.5 w-2.5" />
              Avg <span className="font-semibold text-white/80">{t.live.avgStack.toLocaleString()}</span>
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[10px]">
            <span className="text-white/50">Late reg: <span className="font-semibold text-amber-400/80">{t.live.lateRegRemaining}</span></span>
            <span className="text-white/50">Break: <span className="font-semibold text-white/80">{t.live.nextBreakIn}</span></span>
          </div>
        </>
      )}
    </button>
  );
}

function CashGameCard({ game: g }: { game: CashGameSession }) {
  return (
    <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.03] p-3">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-300">Cash</span>
        <span className="ml-auto text-[9px] font-mono text-white/30">{g.lastUpdated}</span>
      </div>
      <div className="mt-1.5 text-[12px] font-bold text-white/90">{g.game}</div>
      <div className="text-[10px] text-white/40">{g.venue}</div>
      <div className="mt-1.5 flex items-center gap-3 text-[10px]">
        <span className="text-white/50"><span className="font-semibold text-white/80">{g.tables}</span> tables</span>
        <span className="text-white/50"><span className="font-semibold text-white/80">{g.players}</span> players</span>
        {g.waiting > 0 && <span className="text-amber-400/70"><span className="font-semibold">{g.waiting}</span> waiting</span>}
      </div>
    </div>
  );
}
