import { useState, useEffect, useCallback } from 'react';
import { Search, MoreHorizontal, RotateCw, Trophy, Radio, MessageSquare, Users, Clock, MapPin, DollarSign, Calendar, X } from 'lucide-react';
import { SocialFeedModule } from '@/components/lounge/SocialFeedModule';
import { fetchLoungeTournaments, fetchLoungeCashGames, type LoungeTournament, type LoungeCashGame } from '@/lib/loungeFeedStore';
import { formatTimeAgo } from '@/lib/loungeFramework';
import { DEMO_TOURNAMENTS, DEMO_CASH_GAMES } from '@/data/demoTournaments';
import { getChipCount, setChipCount, chipCountTimeAgo } from '@/lib/chipCountStore';
import type { SpotVaultAccount } from '@/types';
import type { LoungeOption } from '@/components/lounge/MobileLoungeSelector';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

type LoungeFace = 'community' | 'tournaments' | 'cash';
const FACES: { id: LoungeFace; label: string; icon: typeof MessageSquare }[] = [
  { id: 'community', label: 'Community', icon: MessageSquare },
  { id: 'tournaments', label: 'Tournaments', icon: Trophy },
  { id: 'cash', label: 'Cash', icon: Radio },
];

type TourFilter = 'all' | 'live' | 'late-reg' | 'upcoming' | 'finished';
const TOUR_FILTERS: { id: TourFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'late-reg', label: 'Late Reg' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'finished', label: 'Completed' },
];

interface Props {
  account: SpotVaultAccount | null;
  loungeOptions: LoungeOption[];
  selectedSlug: string;
  onSelectLounge: (slug: string) => void;
}

export function MobileLoungeHub({ account, loungeOptions, selectedSlug, onSelectLounge }: Props) {
  const [face, setFace] = useState<LoungeFace>('community');
  const [rotating, setRotating] = useState(false);
  const [rotateDir, setRotateDir] = useState<'cw' | 'ccw'>('cw');
  const [tournaments, setTournaments] = useState<LoungeTournament[]>([]);
  const [cashGames, setCashGames] = useState<LoungeCashGame[]>([]);
  const [loadingPoker, setLoadingPoker] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tourFilter, setTourFilter] = useState<TourFilter>('all');
  const [menuOpen, setMenuOpen] = useState(false);

  const selectedOption = loungeOptions.find((o) => o.slug === selectedSlug) ?? loungeOptions[0];

  const rotateFace = useCallback((dir: 'cw' | 'ccw' = 'cw') => {
    setRotateDir(dir);
    setRotating(true);
    setFace((prev) => {
      const idx = FACES.findIndex((f) => f.id === prev);
      if (dir === 'cw') return FACES[(idx + 1) % FACES.length].id;
      return FACES[(idx - 1 + FACES.length) % FACES.length].id;
    });
    setTimeout(() => setRotating(false), 400);
  }, []);

  const selectFace = useCallback((f: LoungeFace) => {
    if (f === face) return;
    const curIdx = FACES.findIndex((x) => x.id === face);
    const newIdx = FACES.findIndex((x) => x.id === f);
    setRotateDir(newIdx > curIdx ? 'cw' : 'ccw');
    setRotating(true);
    setFace(f);
    setTimeout(() => setRotating(false), 400);
  }, [face]);

  useEffect(() => {
    if (face === 'tournaments') {
      setLoadingPoker(true);
      fetchLoungeTournaments(selectedSlug).then((data) => {
        setTournaments(data.length > 0 ? data : DEMO_TOURNAMENTS);
        setLoadingPoker(false);
      });
    } else if (face === 'cash') {
      setLoadingPoker(true);
      fetchLoungeCashGames(selectedSlug).then((data) => {
        setCashGames(data.length > 0 ? data : DEMO_CASH_GAMES);
        setLoadingPoker(false);
      });
    }
  }, [face, selectedSlug]);

  return (
    <div className="flex h-full flex-col">
      {/* Compact lounge header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2" style={{ background: 'rgba(8,7,6,0.85)', backdropFilter: 'blur(12px)' }}>
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:text-white/80"
        >
          <Search className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10 text-[10px] font-bold" style={{ color: GOLD }}>
            {selectedOption?.name?.charAt(0) ?? 'L'}
          </div>
          <span className="truncate text-[13px] font-bold text-white">{selectedOption?.name ?? 'Lounge'}</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:text-white/80"
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[90] bg-black/40" onClick={() => setMenuOpen(false)} />
              <div className="fixed right-3 top-14 z-[95] w-40 rounded-lg border border-white/10 bg-[#0d1115] p-1 shadow-2xl">
                <button onClick={() => { selectFace('community'); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] text-white/70 hover:bg-white/5">
                  <MessageSquare className="h-3 w-3" /> Community
                </button>
                <button onClick={() => { selectFace('tournaments'); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] text-white/70 hover:bg-white/5">
                  <Trophy className="h-3 w-3" /> Tournaments
                </button>
                <button onClick={() => { selectFace('cash'); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] text-white/70 hover:bg-white/5">
                  <Radio className="h-3 w-3" /> Cash Games
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lounge selector dropdown */}
      {searchOpen && (
        <div className="shrink-0 border-b border-white/[0.06] px-3 py-2" style={{ background: 'rgba(12,10,8,0.95)' }}>
          <div className="flex flex-wrap gap-1.5">
            {loungeOptions.map((opt) => (
              <button
                key={opt.slug}
                onClick={() => { onSelectLounge(opt.slug); setSearchOpen(false); }}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all ${
                  opt.slug === selectedSlug
                    ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#d4a52c]'
                    : 'border-white/10 bg-white/5 text-white/50 hover:text-white/80'
                }`}
              >
                {opt.name}
              </button>
            ))}
          </div>
          {face === 'tournaments' && (
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by room, location, buy-in..."
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/80 placeholder:text-white/30 focus:border-[#c0911e]/30 focus:outline-none"
            />
          )}
        </div>
      )}

      {/* Face selector + rotate control */}
      <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] px-3 py-1.5" style={{ background: 'rgba(10,9,8,0.9)' }}>
        <div className="flex flex-1 items-center gap-1">
          {FACES.map((f) => {
            const active = face === f.id;
            return (
              <button
                key={f.id}
                onClick={() => selectFace(f.id)}
                className="relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all"
                style={{
                  background: active ? 'rgba(192,145,30,0.12)' : 'transparent',
                  border: active ? '1px solid rgba(192,145,30,0.3)' : '1px solid transparent',
                }}
              >
                <f.icon className="h-3.5 w-3.5" strokeWidth={active ? 2 : 1.5} style={{ color: active ? GOLD : 'rgba(255,255,255,0.4)' }} />
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: active ? GOLD_SOFT : 'rgba(255,255,255,0.4)' }}
                >
                  {f.label}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => rotateFace('cw')}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/8 text-[#d4a52c] transition-all active:scale-90"
          title="Rotate to next surface"
        >
          <RotateCw className={`h-4 w-4 ${rotating ? 'animate-spin' : ''}`} strokeWidth={1.5} style={{ animationDuration: '0.4s' }} />
        </button>
      </div>

      {/* Face content with rotation transition */}
      <div
        className="min-h-0 flex-1 overflow-hidden"
        style={{
          transition: 'transform 0.4s ease, opacity 0.4s ease',
          transform: rotating
            ? rotateDir === 'cw'
              ? 'perspective(800px) rotateY(15deg) scale(0.96)'
              : 'perspective(800px) rotateY(-15deg) scale(0.96)'
            : 'perspective(800px) rotateY(0deg) scale(1)',
          opacity: rotating ? 0.4 : 1,
        }}
      >
        {face === 'community' && (
          <SocialFeedModule
            loungeSlug={selectedSlug}
            account={account}
            placeholder={selectedSlug === 'spotvault' ? "What's happening in poker?" : `What's happening in ${selectedOption?.name ?? 'this lounge'}?`}
          />
        )}
        {face === 'tournaments' && (
          <TournamentFace
            tournaments={tournaments}
            loading={loadingPoker}
            loungeSlug={selectedSlug}
            searchQuery={searchQuery}
            tourFilter={tourFilter}
            setTourFilter={setTourFilter}
            account={account}
          />
        )}
        {face === 'cash' && (
          <CashGameFace
            cashGames={cashGames}
            loading={loadingPoker}
            loungeSlug={selectedSlug}
          />
        )}
      </div>
    </div>
  );
}

function TournamentFace({ tournaments, loading, loungeSlug, searchQuery, tourFilter, setTourFilter, account }: {
  tournaments: LoungeTournament[];
  loading: boolean;
  loungeSlug: string;
  searchQuery: string;
  tourFilter: TourFilter;
  setTourFilter: (f: TourFilter) => void;
  account: SpotVaultAccount | null;
}) {
  const filtered = (() => {
    let result = tournaments;
    if (tourFilter !== 'all') {
      result = result.filter(t => t.status === tourFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.tournament_name?.toLowerCase().includes(q) ||
        t.poker_room?.toLowerCase().includes(q) ||
        t.location?.toLowerCase().includes(q) ||
        t.game_type?.toLowerCase().includes(q)
      );
    }
    return result;
  })();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Trophy className="h-6 w-6 animate-pulse text-[#d4a52c]/40" />
          <p className="text-[11px] text-white/30">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filter row */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.04] px-2 py-1" style={{ scrollbarWidth: 'none' }}>
        {TOUR_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setTourFilter(f.id)}
            className="shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase transition-colors whitespace-nowrap"
            style={tourFilter === f.id
              ? { background: 'rgba(212,165,44,0.12)', color: GOLD_SOFT }
              : { color: 'rgba(255,255,255,0.3)' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <Trophy className="mb-2 h-8 w-8 text-white/10" />
          <p className="text-[12px] font-medium text-white/40">No tournaments found</p>
          <p className="mt-1 text-[10px] text-white/25">Try a different filter or check back later.</p>
        </div>
      ) : (
        <div className="h-full overflow-y-auto">
          <div className="space-y-2 p-2">
            {filtered.map((t) => (
              <CompactTournamentCard key={t.id} t={t} account={account} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompactTournamentCard({ t, account }: { t: LoungeTournament; account: SpotVaultAccount | null }) {
  const isLive = t.status === 'live';
  const isLateReg = t.status === 'late-reg';
  const isFinished = t.status === 'finished';
  const isUpcoming = t.status === 'upcoming';

  const statusColor = isLive ? 'text-red-300' : isLateReg ? 'text-amber-300' : isFinished ? 'text-white/30' : 'text-[#d4a52c]/70';
  const statusBg = isLive ? 'rgba(239,68,68,0.06)' : isLateReg ? 'rgba(251,191,36,0.06)' : isFinished ? 'rgba(255,255,255,0.02)' : 'rgba(212,165,44,0.04)';
  const borderColor = isLive ? 'rgba(239,68,68,0.2)' : isLateReg ? 'rgba(251,191,36,0.15)' : isFinished ? 'rgba(255,255,255,0.06)' : 'rgba(212,165,44,0.12)';
  const statusLabel = isLive ? 'RUNNING' : isLateReg ? 'LATE REG' : isFinished ? 'COMPLETED' : 'UPCOMING';

  const [chipInput, setChipInput] = useState('');
  const [savedChips, setSavedChips] = useState<{ count: number; updatedAt: string } | null>(null);
  const [showChipInput, setShowChipInput] = useState(false);

  useEffect(() => {
    if (account) setSavedChips(getChipCount(account.id, t.id));
  }, [account, t.id]);

  const updateChips = () => {
    if (!account || !chipInput.trim()) return;
    const count = parseInt(chipInput.replace(/,/g, '')) || 0;
    setChipCount(account.id, t.id, count);
    setSavedChips({ count, updatedAt: new Date().toISOString() });
    setChipInput('');
    setShowChipInput(false);
  };

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor, background: '#0d1115' }}>
      <div className="flex items-center gap-1.5 px-2.5 py-1" style={{ background: statusBg }}>
        {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
        {isLateReg && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />}
        <span className={`text-[8px] font-bold uppercase tracking-widest ${statusColor}`}>{statusLabel}</span>
        <span className="ml-auto text-[8px] font-mono text-white/25">{formatTimeAgo(t.last_updated)}</span>
      </div>

      <div className="px-2.5 py-2">
        {t.tournament_name && <div className="text-[12px] font-bold text-white/90">{t.tournament_name}</div>}
        {t.poker_room && (
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/50">
            <MapPin className="h-2.5 w-2.5" /> {t.poker_room}{t.location ? `, ${t.location}` : ''}
          </div>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
          {t.buy_in != null && <span className="flex items-center gap-0.5 text-white/50"><DollarSign className="h-2.5 w-2.5" /> <span className="text-white/80">${t.buy_in}</span></span>}
          {t.entrants != null && t.entrants > 0 && <span className="flex items-center gap-0.5 text-white/50"><Users className="h-2.5 w-2.5" /> <span className="text-white/80">{t.entrants}</span></span>}
          {t.start_time && <span className="flex items-center gap-0.5 text-white/50"><Clock className="h-2.5 w-2.5" /> <span className="text-white/80">{t.start_time}</span></span>}
          {t.guarantee != null && <span className="text-white/50">GTD: <span className="font-semibold text-[#d4a52c]">${t.guarantee.toLocaleString()}</span></span>}
        </div>

        {(isLive || isLateReg) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-white/[0.04] pt-1.5 text-[10px]">
            {t.current_level && <span className="text-white/50">Level: <span className="font-semibold text-white/80">{t.current_level}</span></span>}
            {t.players_remaining != null && t.players_remaining > 0 && <span className="text-white/50">Remaining: <span className="text-white/80">{t.players_remaining}</span></span>}
            {t.prize_pool != null && <span className="text-white/50">Prize Pool: <span className="font-bold text-[#d4a52c]">${t.prize_pool.toLocaleString()}</span></span>}
            {t.registration_status && <span className="text-amber-400/70">{t.registration_status}</span>}
          </div>
        )}

        {/* Chip count feature */}
        {account && (isLive || isLateReg) && (
          <div className="mt-1.5 border-t border-white/[0.04] pt-1.5">
            {savedChips && !showChipInput && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">My Chips: <span className="font-bold text-[#d4a52c]">{savedChips.count.toLocaleString()}</span></span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-white/25">Updated {chipCountTimeAgo(savedChips.updatedAt)}</span>
                  <button onClick={() => setShowChipInput(true)} className="text-[9px] font-semibold text-[#d4a52c]/70 hover:text-[#d4a52c]">Update</button>
                </div>
              </div>
            )}
            {showChipInput && (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={chipInput}
                  onChange={(e) => setChipInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') updateChips(); }}
                  placeholder="Chip count"
                  className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 placeholder:text-white/30 focus:border-[#c0911e]/30 focus:outline-none"
                />
                <button onClick={updateChips} className="rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-2 py-1 text-[9px] font-semibold text-[#f5e6b0] active:scale-95">Update</button>
                <button onClick={() => setShowChipInput(false)} className="text-white/30 hover:text-white/60"><X className="h-3 w-3" /></button>
              </div>
            )}
            {!savedChips && !showChipInput && (
              <button onClick={() => setShowChipInput(true)} className="text-[9px] font-semibold text-[#d4a52c]/70 hover:text-[#d4a52c]">+ Add My Chip Count</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CashGameFace({ cashGames, loading, loungeSlug }: { cashGames: LoungeCashGame[]; loading: boolean; loungeSlug: string }) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Radio className="h-6 w-6 animate-pulse text-emerald-400/40" />
          <p className="text-[11px] text-white/30">Loading cash games...</p>
        </div>
      </div>
    );
  }

  if (cashGames.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <Radio className="mb-2 h-8 w-8 text-white/10" />
        <p className="text-[12px] font-medium text-white/40">No cash games posted yet</p>
        <p className="mt-1 text-[10px] text-white/25">Lounge admins can add live cash-game info for {loungeSlug.replace(/-/g, ' ')}.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-2 p-2">
        {cashGames.map((g) => {
          const isStarting = g.status === 'starting';
          const isRunning = g.status === 'running' || !g.status;
          return (
            <div
              key={g.id}
              className="overflow-hidden rounded-lg border bg-[#0d1115]/95"
              style={{ borderColor: isStarting ? 'rgba(251,191,36,0.15)' : 'rgba(52,211,153,0.12)' }}
            >
              <div className="flex items-center gap-1.5 px-2.5 py-1" style={{ background: isStarting ? 'rgba(251,191,36,0.04)' : 'rgba(52,211,153,0.03)' }}>
                {isStarting ? (
                  <><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /><span className="text-[8px] font-bold uppercase tracking-widest text-amber-300">Starting Soon</span></>
                ) : (
                  <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /><span className="text-[8px] font-bold uppercase tracking-widest text-emerald-300">Live</span></>
                )}
                <span className="ml-auto text-[8px] font-mono text-white/25">{formatTimeAgo(g.last_updated)}</span>
              </div>

              <div className="px-2.5 py-2">
                {g.game && <div className="text-[12px] font-bold text-white/90">{g.game}</div>}
                {g.stakes && <div className="text-[10px] text-[#d4a52c]">{g.stakes}</div>}
                {g.poker_room && <div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/50"><MapPin className="h-2.5 w-2.5" /> {g.poker_room}{g.location ? `, ${g.location}` : ''}</div>}

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
                  {g.tables_running != null && <span className="text-white/50"><span className="font-semibold text-white/80">{g.tables_running}</span> tables</span>}
                  {g.players != null && <span className="flex items-center gap-0.5 text-white/50"><Users className="h-2.5 w-2.5" /> <span className="font-semibold text-white/80">{g.players}</span></span>}
                  {g.open_seats != null && g.open_seats > 0 && <span className="text-emerald-300 font-semibold">{g.open_seats} open</span>}
                  {g.waitlist != null && g.waitlist > 0 && <span className="flex items-center gap-0.5 text-amber-400/70"><Clock className="h-2.5 w-2.5" /> Wait: <span className="font-semibold">{g.waitlist}</span></span>}
                  {isStarting && g.starts_at && <span className="flex items-center gap-0.5 text-amber-400/80"><Calendar className="h-2.5 w-2.5" /> {g.starts_at}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
