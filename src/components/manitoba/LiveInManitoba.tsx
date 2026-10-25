import { useState } from 'react';
import { Radio, Users, Clock, TrendingUp, Layers, Calendar, ChevronRight } from 'lucide-react';
import type { ManitobaTournament, ManitobaCashGame } from '@/data/manitobaDemoData';
import { LIVE_TOURNAMENTS, LIVE_CASH_GAMES } from '@/data/manitobaDemoData';
import { TournamentDetailModal } from '@/components/manitoba/TournamentDetailModal';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const LIVE_RED = '#ef4444';
const BORDER = 'rgba(212,165,44,0.18)';

interface Props {
  onTournamentClick?: (t: ManitobaTournament) => void;
}

export function LiveInManitoba({ onTournamentClick }: Props) {
  const [selectedTournament, setSelectedTournament] = useState<ManitobaTournament | null>(null);

  const liveTournaments = LIVE_TOURNAMENTS.filter((t) => t.live);
  const cashGames = LIVE_CASH_GAMES;
  const hasLiveTournaments = liveTournaments.length > 0;
  const hasCashGames = cashGames.length > 0;

  // Scenario D: No live games → show upcoming
  if (!hasLiveTournaments && !hasCashGames) {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
        <UpcomingInManitoba onTournamentClick={onTournamentClick ?? setSelectedTournament} />
        {selectedTournament && (
          <TournamentDetailModal tournament={selectedTournament} onClose={() => setSelectedTournament(null)} />
        )}
      </div>
    );
  }

  // Determine layout split
  const showCompactTournaments = hasLiveTournaments && hasCashGames && liveTournaments.length >= 2;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex h-2.5 w-2.5 items-center justify-center">
          <span className="absolute h-2.5 w-2.5 animate-ping rounded-full" style={{ background: LIVE_RED, opacity: 0.4 }} />
          <span className="h-2 w-2 rounded-full" style={{ background: LIVE_RED }} />
        </span>
        <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: GOLD_SOFT }}>Live in Manitoba</h2>
      </div>

      {/* Tournaments */}
      {hasLiveTournaments && (
        <div className={showCompactTournaments ? 'grid grid-cols-1 gap-2' : 'flex flex-col gap-3'}>
          {liveTournaments.map((t) => (
            <LiveTournamentCard
              key={t.id}
              tournament={t}
              compact={showCompactTournaments}
              onClick={() => (onTournamentClick ? onTournamentClick(t) : setSelectedTournament(t))}
            />
          ))}
        </div>
      )}

      {/* Cash Games */}
      {hasCashGames && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 pt-1">
            <Radio className="h-3.5 w-3.5" style={{ color: LIVE_RED }} strokeWidth={1.5} />
            <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: GOLD_SOFT }}>Live Cash Games</h3>
          </div>
          {cashGames.map((cg) => (
            <CashGameCard key={cg.id} game={cg} />
          ))}
        </div>
      )}

      {selectedTournament && (
        <TournamentDetailModal tournament={selectedTournament} onClose={() => setSelectedTournament(null)} />
      )}
    </div>
  );
}

function LiveTournamentCard({ tournament: t, compact, onClick }: { tournament: ManitobaTournament; compact: boolean; onClick: () => void }) {
  const live = t.live!;
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border p-3 text-left transition-all hover:scale-[1.01]"
      style={{
        borderColor: compact ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.25)',
        background: 'rgba(8,7,6,0.72)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="flex h-2 w-2 items-center justify-center">
            <span className="absolute h-2 w-2 animate-ping rounded-full" style={{ background: LIVE_RED, opacity: 0.4 }} />
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIVE_RED }} />
          </span>
          <span className="text-[9px] font-bold tracking-widest" style={{ color: LIVE_RED }}>LIVE</span>
          <span className="text-[9px] font-medium text-white/40">· {t.operator}</span>
        </div>
        <span className="text-[8px] text-white/30">{live.lastUpdated}</span>
      </div>

      <h3 className="mb-0.5 text-[12px] font-bold text-white">{t.name}</h3>
      <p className="mb-2 text-[10px] text-white/40">{t.venue}</p>

      <div className="mb-2 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Layers className="h-3 w-3 text-white/30" strokeWidth={1.5} />
          <span className="text-[10px] font-semibold text-white/70">Level {live.level}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold" style={{ color: GOLD_SOFT }}>{live.smallBlind} / {live.bigBlind}</span>
          <span className="text-[9px] text-white/30">Ante {live.ante}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <StatRow icon={Users} label="Entries" value={live.entries} />
        <StatRow icon={TrendingUp} label="Remaining" value={live.remaining} />
        <StatRow icon={Layers} label="Avg Stack" value={live.avgStack.toLocaleString()} />
        {live.reentries > 0 && <StatRow icon={Clock} label="Re-entries" value={live.reentries} />}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-white/30" strokeWidth={1.5} />
          <span className="text-[9px] text-white/50">Late Reg: <span className="font-semibold" style={{ color: live.lateRegRemaining === 'Closed' ? '#ef4444' : GOLD_SOFT }}>{live.lateRegRemaining}</span></span>
        </div>
        <span className="text-[9px] text-white/40">Next break: {live.nextBreakIn}</span>
      </div>

      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
        <ChevronRight className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
      </div>
    </button>
  );
}

function CashGameCard({ game }: { game: ManitobaCashGame }) {
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(8,7,6,0.62)' }}>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="flex h-1.5 w-1.5 items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIVE_RED }} />
          </span>
          <span className="text-[11px] font-bold" style={{ color: GOLD_SOFT }}>{game.game}</span>
        </div>
        <span className="text-[8px] text-white/30">{game.lastUpdated}</span>
      </div>
      <p className="mb-1.5 text-[9px] text-white/40">{game.venue}</p>
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-white/60"><span className="font-semibold text-white/80">{game.tables}</span> Tables</span>
        <span className="text-white/60"><span className="font-semibold text-white/80">{game.players}</span> Players</span>
        {game.waitlist > 0 && <span style={{ color: GOLD }}>{game.waitlist} Waiting</span>}
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1">
      <Icon className="h-2.5 w-2.5 text-white/25" strokeWidth={1.5} />
      <span className="text-[9px] text-white/40">{label}:</span>
      <span className="text-[10px] font-semibold text-white/75">{value}</span>
    </div>
  );
}

function UpcomingInManitoba({ onTournamentClick }: { onTournamentClick: (t: ManitobaTournament) => void }) {
  const upcoming: ManitobaTournament[] = [
    { id: 'upc-1', venue: 'McPhillips Street Station', operator: 'Trip Aces', name: 'Sunday $100', startTime: '14:00', buyIn: 100, prizePoolContribution: 90, fee: 10, feePercent: 10, startingStack: 15000, blindLevelMinutes: 20, lateRegistration: 'Until Level 4', reEntry: true, reEntryLimit: 1, rebuy: false, addOn: false, guarantee: null },
    { id: 'upc-2', venue: 'Club Regent Casino', operator: 'Manitoba Poker League', name: 'Monday $80', startTime: '19:00', buyIn: 80, prizePoolContribution: 72, fee: 8, feePercent: 10, startingStack: 12000, blindLevelMinutes: 20, lateRegistration: 'Until Level 3', reEntry: false, reEntryLimit: null, rebuy: false, addOn: false, guarantee: null },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
        <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: GOLD_SOFT }}>Upcoming in Manitoba</h2>
      </div>
      {upcoming.map((t) => (
        <button key={t.id} onClick={() => onTournamentClick(t)} className="rounded-lg border p-3 text-left transition-all hover:scale-[1.01]" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.62)' }}>
          <h3 className="text-[11px] font-bold text-white">{t.name}</h3>
          <p className="text-[9px] text-white/40">{t.venue} · {t.startTime}</p>
          <p className="mt-1 text-[10px]" style={{ color: GOLD_SOFT }}>${t.buyIn} · {t.startingStack.toLocaleString()} stack</p>
        </button>
      ))}
    </div>
  );
}
