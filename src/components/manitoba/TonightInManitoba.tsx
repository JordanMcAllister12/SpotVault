import { useState } from 'react';
import { Star, ChevronLeft, ChevronRight, Clock, DollarSign, Trophy, Info } from 'lucide-react';
import type { ManitobaTournament } from '@/data/manitobaDemoData';
import { TONIGHT_TOURNAMENTS, calculateBestPlayerValue, getBestValueExplanation } from '@/data/manitobaDemoData';
import { TournamentDetailModal } from '@/components/manitoba/TournamentDetailModal';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

interface Props {
  onTournamentClick?: (t: ManitobaTournament) => void;
}

export function TonightInManitoba({ onTournamentClick }: Props) {
  const [index, setIndex] = useState(0);
  const [selectedTournament, setSelectedTournament] = useState<ManitobaTournament | null>(null);
  const [showBestValueInfo, setShowBestValueInfo] = useState(false);

  const tournaments = TONIGHT_TOURNAMENTS;
  const bestValue = calculateBestPlayerValue(tournaments);
  const current = tournaments[index];

  const handleCardClick = (t: ManitobaTournament) => {
    if (onTournamentClick) onTournamentClick(t);
    else setSelectedTournament(t);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-3 pt-2 pb-1.5">
        <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: GOLD_SOFT }}>Tonight in Manitoba</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIndex((i) => (i - 1 + tournaments.length) % tournaments.length)}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] text-white/40 transition hover:text-white/70"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <span className="text-[9px] text-white/30">{index + 1} / {tournaments.length}</span>
          <button
            onClick={() => setIndex((i) => (i + 1) % tournaments.length)}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] text-white/40 transition hover:text-white/70"
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Card */}
      <div className="min-h-0 flex-1 px-2.5 pb-2.5">
        <TournamentCard
          tournament={current}
          isBestValue={bestValue?.id === current.id}
          onClick={() => handleCardClick(current)}
          showBestValueInfo={showBestValueInfo && bestValue?.id === current.id}
          onToggleBestValueInfo={() => setShowBestValueInfo(!showBestValueInfo)}
        />
      </div>

      {/* Dots */}
      <div className="flex shrink-0 items-center justify-center gap-1.5 pb-2">
        {tournaments.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === index ? '20px' : '6px',
              background: i === index ? GOLD : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>

      {selectedTournament && (
        <TournamentDetailModal tournament={selectedTournament} onClose={() => setSelectedTournament(null)} />
      )}
    </div>
  );
}

function TournamentCard({ tournament: t, isBestValue, onClick, showBestValueInfo, onToggleBestValueInfo }: {
  tournament: ManitobaTournament;
  isBestValue: boolean;
  onClick: () => void;
  showBestValueInfo: boolean;
  onToggleBestValueInfo: () => void;
}) {
  return (
    <div
      className="relative h-full overflow-hidden rounded-xl border p-3 transition-all"
      style={{
        borderColor: isBestValue ? 'rgba(212,165,44,0.45)' : BORDER,
        background: 'rgba(8,7,6,0.62)',
        boxShadow: isBestValue ? '0 0 16px rgba(212,165,44,0.12)' : 'none',
      }}
    >
      {/* Best Player Value badge */}
      {isBestValue && (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <span
            className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest"
            style={{ borderColor: 'rgba(212,165,44,0.4)', background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
          >
            <Star className="h-2.5 w-2.5" style={{ color: GOLD }} strokeWidth={1.5} fill={GOLD} />
            BEST PLAYER VALUE
          </span>
        </div>
      )}

      <button onClick={onClick} className="block w-full text-left">
        <h4 className="pr-20 text-[12px] font-bold text-white">{t.name}</h4>
        <p className="mt-0.5 text-[10px] text-white/40">{t.venue}</p>
        <p className="text-[9px] text-white/30">{t.operator}</p>

        <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
          <InfoRow icon={Clock} label="Start" value={t.startTime} />
          <InfoRow icon={DollarSign} label="Buy-in" value={`$${t.buyIn}`} />
          <InfoRow icon={Trophy} label="Stack" value={t.startingStack.toLocaleString()} />
          <InfoRow icon={Clock} label="Levels" value={`${t.blindLevelMinutes}m`} />
        </div>

        <div className="mt-2 flex items-center gap-2 text-[9px]">
          <span className="text-white/40">Late reg: <span style={{ color: GOLD_SOFT }}>{t.lateRegistration}</span></span>
          {t.reEntry && <span className="text-white/40">Re-entry{t.reEntryLimit ? ` ${t.reEntryLimit}x` : ''}</span>}
          {t.guarantee && <span style={{ color: GOLD_SOFT }}>${t.guarantee.toLocaleString()} GTD</span>}
        </div>
      </button>

      {/* Best value explanation */}
      {isBestValue && (
        <div className="mt-2 border-t border-[#d4a52c]/15 pt-2">
          <button
            onClick={onToggleBestValueInfo}
            className="flex items-center gap-1 text-[9px] font-medium"
            style={{ color: GOLD }}
          >
            <Info className="h-3 w-3" strokeWidth={1.5} /> Why is this highlighted?
          </button>
          {showBestValueInfo && (
            <p className="mt-1.5 rounded-lg border border-[#d4a52c]/15 bg-[#d4a52c]/5 p-2.5 text-[9px] leading-relaxed text-white/60">
              {getBestValueExplanation(t)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 shrink-0 text-white/25" strokeWidth={1.5} />
      <span className="text-[9px] text-white/40">{label}:</span>
      <span className="text-[10px] font-semibold text-white/75">{value}</span>
    </div>
  );
}
