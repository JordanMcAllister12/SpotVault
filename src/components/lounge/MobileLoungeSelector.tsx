import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Radio, X, Trophy, Users, Clock } from 'lucide-react';
import { fetchLoungeConfig } from '@/lib/loungeStore';
import { SPOTVAULT_DEFAULT_LOUNGE, type LoungeConfig, type TournamentEvent, type CashGameSession } from '@/lib/loungeFramework';
import { LiveTournamentsModule } from '@/components/lounge/LiveTournamentsModule';
import { TournamentDetailModal } from '@/components/lounge/TournamentDetailModal';
import type { SpotVaultAccount } from '@/types';

export interface LoungeOption {
  slug: string;
  name: string;
  configOverride?: Partial<LoungeConfig>;
  data?: {
    liveTournaments?: TournamentEvent[];
    cashGames?: CashGameSession[];
    upcomingEvents?: TournamentEvent[];
  };
}

interface Props {
  account: SpotVaultAccount | null;
  selectedSlug: string;
  onSelect: (slug: string) => void;
  options: LoungeOption[];
}

export function MobileLoungeSelector({ account, selectedSlug, onSelect, options }: Props) {
  const [config, setConfig] = useState<LoungeConfig | null>(null);
  const [showLoungeList, setShowLoungeList] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<TournamentEvent | null>(null);

  const selectedOption = options.find((o) => o.slug === selectedSlug) ?? options[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let cfg = await fetchLoungeConfig(selectedSlug);
      if (!cfg) {
        cfg = {
          ...SPOTVAULT_DEFAULT_LOUNGE,
          slug: selectedSlug,
          name: selectedOption?.name ?? selectedSlug,
          ...selectedOption?.configOverride,
        };
      }
      if (!cancelled) setConfig(cfg);
    })();
    return () => { cancelled = true; };
  }, [selectedSlug, selectedOption]);

  const liveTournaments = selectedOption?.data?.liveTournaments ?? [];
  const cashGames = selectedOption?.data?.cashGames ?? [];
  const liveCount = liveTournaments.length + cashGames.length;

  const hasLiveModule = config?.modules?.some((m) => m.type === 'liveTournaments' || m.type === 'cashGames') ?? false;

  return (
    <>
      {/* Lounge selector + Live button — compact, ~33% width */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setShowLoungeList((s) => !s)}
          className="flex min-w-0 w-[33%] items-center justify-between rounded-lg border border-[#1a1f25] bg-[#0d1115] px-2.5 py-1.5 text-[11px] font-semibold text-white/80 transition-colors hover:border-[#2a323a]"
        >
          <span className="truncate">{selectedOption?.name ?? 'Social Feed'}</span>
          <ChevronDown className={`h-3 w-3 shrink-0 text-white/40 transition-transform ${showLoungeList ? 'rotate-180' : ''}`} />
        </button>
        {hasLiveModule && (
          <button
            onClick={() => setShowLive(true)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${liveCount > 0 ? 'border-red-400/40 bg-red-400/10 text-red-300' : 'border-[#1a1f25] bg-[#0d1115] text-white/50'}`}
          >
            <Radio className={`h-3 w-3 ${liveCount > 0 ? 'animate-pulse' : ''}`} />
            {liveCount > 0 ? `LIVE · ${liveCount}` : 'LIVE'}
          </button>
        )}
      </div>

      {/* Lounge dropdown */}
      {showLoungeList && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowLoungeList(false)}>
          <div className="absolute left-2 right-2 top-14 rounded-xl border border-[#1a1f25] bg-[#0d1115] p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Select Lounge</span>
              <button onClick={() => setShowLoungeList(false)} className="text-white/30 hover:text-white/60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {options.map((opt) => (
                <button
                  key={opt.slug}
                  onClick={() => { onSelect(opt.slug); setShowLoungeList(false); }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[12px] font-medium transition-all ${opt.slug === selectedSlug ? 'border border-[#c0911e]/50 bg-[#1a1408] text-[#f5e6b0]' : 'border border-transparent text-white/60 hover:bg-white/5 hover:text-white/90'}`}
                >
                  {opt.name}
                  {opt.slug === selectedSlug && <span className="text-[10px] text-[#d4a52c]">Selected</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live info drawer */}
      {showLive && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setShowLive(false)}>
          <div className="absolute bottom-0 left-0 right-0 max-h-[75%] overflow-y-auto rounded-t-2xl border-t border-[#1a1f25] bg-[#0a0c0e] p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-red-400" />
                <span className="text-sm font-bold text-white">{selectedOption?.name}</span>
                <span className="text-[10px] text-white/40">— Live Now</span>
              </div>
              <button onClick={() => setShowLive(false)} className="text-white/40 hover:text-white/70">
                <X className="h-5 w-5" />
              </button>
            </div>

            {liveCount === 0 ? (
              <div className="py-8 text-center">
                <Clock className="mx-auto mb-2 h-6 w-6 text-white/15" />
                <p className="text-[12px] text-white/30">No live information available right now.</p>
                {selectedOption?.data?.upcomingEvents?.length ? (
                  <div className="mt-4 text-left">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Trophy className="h-3 w-3 text-[#d4a52c]/60" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Upcoming</span>
                    </div>
                    {selectedOption.data.upcomingEvents.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTournament(t)}
                        className="mb-1.5 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-left transition-colors hover:border-[#c0911e]/20"
                      >
                        <div className="text-[12px] font-semibold text-white/80">{t.name}</div>
                        <div className="text-[10px] text-white/40">{t.venue} · {t.startTime}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <LiveTournamentsModule
                liveTournaments={liveTournaments}
                cashGames={cashGames}
                onTournamentClick={setSelectedTournament}
                region={config?.eventSettings?.region}
              />
            )}
          </div>
        </div>
      )}

      {/* Tournament detail modal */}
      {selectedTournament && (
        <TournamentDetailModal
          tournament={selectedTournament}
          onClose={() => setSelectedTournament(null)}
        />
      )}
    </>
  );
}
