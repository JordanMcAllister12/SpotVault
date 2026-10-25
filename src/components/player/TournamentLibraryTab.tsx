import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, ChevronLeft, ChevronRight, Zap, X, ChevronDown,
  MoreVertical, Eye, FolderPlus, Loader2, Trophy, Calendar, Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchUserTournaments, type TournamentSummary } from '@/lib/tournamentStore';
import { createBatch, addSingleHandToBatch, fetchBatches, type HandBatch } from '@/lib/batchStore';
import type { AnalyticsSnapshot } from '@/lib/pokerAnalytics';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';
const DARK_PANEL = 'rgba(8,7,6,0.88)';

interface TournamentLibItem extends TournamentSummary {
  buyIn?: number | null;
  entries?: number;
  entryDates?: string[];
  site: string | null;
}

interface HandRow {
  id: string;
  hand_id: string | null;
  played_at: string | null;
  blinds: string | null;
  position: string | null;
  net_result: number | null;
  bb_won: number | null;
  pot_amount: number | null;
  hero_cards: string | null;
  raw_hand_text?: string | null;
  hero_name?: string | null;
  showdown: boolean | null;
  starting_hand_class: string | null;
}

interface TournamentLibraryTabProps {
  userId?: string;
  mode?: 'cash' | 'mtt';
  isDemo?: boolean;
  onJumpToAnalyzer?: (filters: Record<string, unknown>) => void;
  snapshot?: AnalyticsSnapshot | null;
  trends?: Record<string, { delta: number; label: string }>;
}

type PeriodKey = 'all' | 'today' | 'yesterday' | 'last7' | 'last30' | string;

const PER_PAGE = 15;

export function TournamentLibraryTab({ userId, mode = 'mtt', isDemo, snapshot }: TournamentLibraryTabProps) {
  const [tournaments, setTournaments] = useState<TournamentLibItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [periodKey, setPeriodKey] = useState<PeriodKey>('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<TournamentLibItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{ tournamentId: string; x: number; y: number } | null>(null);
  const [autoBatchOpen, setAutoBatchOpen] = useState<TournamentLibItem | null>(null);
  const [autoBatchAnchor, setAutoBatchAnchor] = useState<HTMLElement | null>(null);
  const [allBatches, setAllBatches] = useState<HandBatch[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setAllBatches(await fetchBatches(data.user.id));
    })();
  }, []);

  const tournamentCacheRef = useRef<{ userId: string; data: TournamentLibItem[] } | null>(null);

  const loadTournaments = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    if (tournamentCacheRef.current && tournamentCacheRef.current.userId === userId) {
      setTournaments(tournamentCacheRef.current.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tourns = await fetchUserTournaments(userId);
      if (tourns.length === 0) {
        const empty: TournamentLibItem[] = [];
        tournamentCacheRef.current = { userId, data: empty };
        setTournaments(empty);
        return;
      }

      const tournIds = tourns.map(t => t.tournament_id);
      const { data: enrichData, error: enrichErr } = await supabase
        .rpc('get_tournament_enrichment', { p_user_id: userId, p_tournament_ids: tournIds });
      if (enrichErr) { console.error('get_tournament_enrichment error:', enrichErr.message); }
      const enrichMap = new Map<string, { buyIn: number | null; entryDates: string[] }>();
      for (const row of (enrichData ?? []) as Array<{ tournament_id: string; buy_in: number | null; entry_dates: string[] }>) {
        enrichMap.set(row.tournament_id, {
          buyIn: row.buy_in ?? null,
          entryDates: Array.isArray(row.entry_dates) ? row.entry_dates : [],
        });
      }

      const enriched: TournamentLibItem[] = tourns.map(t => {
        const entry = enrichMap.get(t.tournament_id);
        return {
          ...t,
          buyIn: entry?.buyIn ?? null,
          entries: entry?.entryDates.length ?? 0,
          entryDates: entry?.entryDates ?? [],
          site: t.site,
        };
      });
      tournamentCacheRef.current = { userId, data: enriched };
      setTournaments(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadTournaments(); }, [loadTournaments]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [dropdownOpen]);

  // Build list of active dates with summaries for the dropdown
  const activeDateOptions = useMemo(() => {
    const dateMap = new Map<string, { tournaments: number; hands: number; entries: number }>();
    for (const t of tournaments) {
      if (!t.first_played) continue;
      const dateStr = t.first_played.slice(0, 10);
      const existing = dateMap.get(dateStr) ?? { tournaments: 0, hands: 0, entries: 0 };
      existing.tournaments += 1;
      existing.hands += t.hand_count;
      existing.entries += t.entries ?? 1;
      dateMap.set(dateStr, existing);
    }
    return Array.from(dateMap.entries())
      .map(([date, info]) => ({ date, ...info }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [tournaments]);

  // Filter tournaments by selected period
  const periodFiltered = useMemo(() => {
    if (periodKey === 'all') return tournaments;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (periodKey === 'today') {
      return tournaments.filter(t => {
        if (!t.first_played) return false;
        const d = new Date(t.first_played);
        return d >= todayStart && d <= todayEnd;
      });
    }
    if (periodKey === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const yStart = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      const yEnd = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      return tournaments.filter(t => {
        if (!t.first_played) return false;
        const d = new Date(t.first_played);
        return d >= yStart && d <= yEnd;
      });
    }
    if (periodKey === 'last7') {
      const s = new Date(now); s.setDate(s.getDate() - 6);
      return tournaments.filter(t => {
        if (!t.first_played) return false;
        const d = new Date(t.first_played);
        return d >= new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0) && d <= todayEnd;
      });
    }
    if (periodKey === 'last30') {
      const s = new Date(now); s.setDate(s.getDate() - 29);
      return tournaments.filter(t => {
        if (!t.first_played) return false;
        const d = new Date(t.first_played);
        return d >= new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0) && d <= todayEnd;
      });
    }
    // Individual date
    return tournaments.filter(t => t.first_played?.slice(0, 10) === periodKey);
  }, [tournaments, periodKey]);

  // Compute the 8 primary statistics from the filtered tournament list
  const stats = useMemo(() => {
    const list = periodFiltered;
    const tournCount = list.length;
    const hands = list.reduce((s, t) => s + t.hand_count, 0);
    const entryDatesForPeriod = (t: TournamentLibItem): string[] => {
      if (periodKey === 'all' || !t.entryDates) return t.entryDates ?? [];
      const now = new Date();
      const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const today = startOfDay(now);
      const entryMatches = (playedAt: string) => {
        const date = new Date(playedAt);
        const day = startOfDay(date);
        if (periodKey === 'today') return day === today;
        if (periodKey === 'yesterday') return day === today - 86400000;
        if (periodKey === 'last7') return day >= today - 6 * 86400000 && day <= today;
        if (periodKey === 'last30') return day >= today - 29 * 86400000 && day <= today;
        return playedAt.slice(0, 10) === periodKey;
      };
      return t.entryDates.filter(entryMatches);
    };
    const entries = list.reduce((s, t) => s + (periodKey === 'all' ? (t.entries ?? 0) : entryDatesForPeriod(t).length), 0);
    const reEntries = list.reduce((s, t) => s + Math.max(0, (periodKey === 'all' ? (t.entries ?? 0) : entryDatesForPeriod(t).length) - 1), 0);
    const buyIns = list.map(t => t.buyIn).filter((v): v is number => v != null);
    const avgBuyIn = buyIns.length > 0 ? buyIns.reduce((a, b) => a + b, 0) / buyIns.length : null;
    const netResult = list.reduce((s, t) => s + (t.net_result_sum ?? 0), 0);

    // BB/100 and BB Won — from snapshot summary for all-time, or approximate from live data for filtered
    const s = snapshot?.summary;
    const t = snapshot?.tournament_analysis;
    let bb100: number | null = null;
    let bbWon: number | null = null;

    if (periodKey === 'all' && s) {
      bb100 = s.bb100 ?? null;
      bbWon = s.bbWon ?? null;
    } else {
      // For filtered periods, compute from live tournament net_result_sum as BB approximation
      // We don't have per-hand bb_won in the tournament summary, so use net_result_sum as BB
      bbWon = netResult;
      bb100 = hands > 0 ? (netResult / hands) * 100 : null;
    }

    return { tournCount, hands, entries, reEntries, avgBuyIn, netResult, bb100, bbWon };
  }, [periodFiltered, periodKey, snapshot]);

  const filtered = useMemo(() => {
    let list = periodFiltered;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.tournament_id.toLowerCase().includes(q) ||
        (t.site ?? '').toLowerCase().includes(q) ||
        (t.first_played ?? '').includes(q)
      );
    }
    return list;
  }, [periodFiltered, search]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageItems = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const formatResult = (v: number | null) => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString()}`;
  const resultColor = (v: number | null) => v == null ? '#6b7280' : v > 0 ? '#4ade80' : v < 0 ? '#f87171' : '#9ca3af';

  if (mode !== 'mtt') {
    return <div className="rounded-lg border p-6 text-center" style={{ borderColor: BORDER, background: DARK_PANEL }}><p className="text-[12px] text-white/40">Tournament library is only available for MTT mode.</p></div>;
  }

  if (selectedTournament) {
    return (
      <TournamentDetail
        tournament={selectedTournament}
        userId={userId}
        onBack={() => setSelectedTournament(null)}
        onAutoBatch={(anchor) => { setAutoBatchOpen(selectedTournament); setAutoBatchAnchor(anchor); }}
      />
    );
  }

  const autoBatchPopover = autoBatchOpen ? createPortal(
    <AutoBatchModal
      tournament={autoBatchOpen}
      userId={userId}
      allBatches={allBatches}
      anchor={autoBatchAnchor}
      onClose={() => { setAutoBatchOpen(null); setAutoBatchAnchor(null); }}
    />,
    document.body,
  ) : null;

  const periodLabel = (() => {
    if (periodKey === 'all') return 'All Time';
    if (periodKey === 'today') return 'Today';
    if (periodKey === 'yesterday') return 'Yesterday';
    if (periodKey === 'last7') return 'Last 7 Days';
    if (periodKey === 'last30') return 'Last 30 Days';
    const d = new Date(periodKey + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  })();

  const fmtNum = (v: number | null, d = 2) => v != null && Number.isFinite(v) ? v.toFixed(d) : 'N/A';

  return (
    <div className="space-y-3">
      {/* Playing Period Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(v => !v)}
          className="flex w-full items-center justify-between rounded-lg border px-4 py-2.5 transition-colors hover:bg-white/[0.02]"
          style={{ borderColor: BORDER, background: DARK_PANEL }}
        >
          <span className="flex items-center gap-2">
            <Calendar size={14} style={{ color: GOLD }} />
            <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Playing Period:</span>
            <span className="text-[12px] font-bold" style={{ color: GOLD_SOFT }}>{periodLabel}</span>
          </span>
          <ChevronDown size={14} className="text-white/40 transition-transform" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
        </button>
        {dropdownOpen && (
          <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border shadow-2xl" style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(5,4,3,0.98)' }}>
            <PeriodOption label="All Time" subtext={`${tournaments.length} tournaments · ${tournaments.reduce((s, t) => s + t.hand_count, 0).toLocaleString()} hands`} selected={periodKey === 'all'} onClick={() => { setPeriodKey('all'); setDropdownOpen(false); setPage(0); }} />
            <PeriodOption label="Today" subtext={tournaments.filter(t => t.first_played?.slice(0,10) === new Date().toISOString().slice(0,10)).length + ' tournaments'} selected={periodKey === 'today'} onClick={() => { setPeriodKey('today'); setDropdownOpen(false); setPage(0); }} />
            <PeriodOption label="Yesterday" selected={periodKey === 'yesterday'} onClick={() => { setPeriodKey('yesterday'); setDropdownOpen(false); setPage(0); }} />
            <PeriodOption label="Last 7 Days" selected={periodKey === 'last7'} onClick={() => { setPeriodKey('last7'); setDropdownOpen(false); setPage(0); }} />
            <PeriodOption label="Last 30 Days" selected={periodKey === 'last30'} onClick={() => { setPeriodKey('last30'); setDropdownOpen(false); setPage(0); }} />
            {activeDateOptions.length > 0 && (
              <>
                <div className="border-t border-white/[0.06] px-3 py-1.5 text-[8px] font-bold tracking-widest text-white/30 uppercase">Individual Dates</div>
                {activeDateOptions.map(d => {
                  const dateObj = new Date(d.date + 'T00:00:00');
                  const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <PeriodOption
                      key={d.date}
                      label={label}
                      subtext={`${d.hands.toLocaleString()} hands · ${d.tournaments} tournaments · ${d.entries} entries`}
                      selected={periodKey === d.date}
                      onClick={() => { setPeriodKey(d.date); setDropdownOpen(false); setPage(0); }}
                    />
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Primary Statistics — 8 cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Tournaments" value={stats.tournCount.toLocaleString()} />
        <StatCard label="Total Entries" value={stats.entries.toLocaleString()} />
        <StatCard label="Hands Played" value={stats.hands.toLocaleString()} />
        <StatCard label="BB/100" value={fmtNum(stats.bb100)} color={stats.bb100 != null ? (stats.bb100 > 0 ? '#4ade80' : stats.bb100 < 0 ? '#f87171' : '#9ca3af') : '#6b7280'} />
        <StatCard label="BB Won" value={fmtNum(stats.bbWon, 1)} color={stats.bbWon != null ? (stats.bbWon > 0 ? '#4ade80' : stats.bbWon < 0 ? '#f87171' : '#9ca3af') : '#6b7280'} />
        <StatCard label="Re-Entries" value={stats.reEntries.toLocaleString()} />
        <StatCard label="Avg Buy-In" value={stats.avgBuyIn != null ? `$${stats.avgBuyIn.toFixed(0)}` : 'N/A'} />
        <StatCard label="Net Result" value={formatResult(stats.netResult)} color={resultColor(stats.netResult)} />
      </div>

      {periodKey !== 'all' && stats.bb100 == null && stats.hands > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-[9px] leading-relaxed text-amber-300/70">
            BB/100 and BB Won for filtered periods are approximated from tournament net results. For full verified metrics, use All Time.
          </p>
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <Search size={14} className="text-white/40" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search tournaments..."
          className="flex-1 bg-transparent text-[11px] text-white/70 outline-none placeholder:text-white/25"
        />
        {search && <button onClick={() => setSearch('')} className="text-white/30 hover:text-white/50"><X size={12} /></button>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} /></div>
      ) : error ? (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3"><p className="text-[11px] text-red-300">{error}</p></div>
      ) : pageItems.length === 0 ? (
        <div className="py-12 text-center"><p className="text-[12px] text-white/40">No tournaments found for this period.</p></div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: DARK_PANEL }}>
            <div className="hidden border-b border-white/[0.06] px-4 py-2.5 sm:flex" style={{ background: 'rgba(212,165,44,0.04)' }}>
              <span className="w-24 text-[9px] font-bold tracking-widest text-white/40 uppercase">Date</span>
              <span className="flex-1 text-[9px] font-bold tracking-widest text-white/40 uppercase">Tournament</span>
              <span className="w-16 text-[9px] font-bold tracking-widest text-white/40 uppercase">Site</span>
              <span className="w-20 text-right text-[9px] font-bold tracking-widest text-white/40 uppercase">Buy-in</span>
              <span className="w-16 text-right text-[9px] font-bold tracking-widest text-white/40 uppercase">Hands</span>
              <span className="w-16 text-right text-[9px] font-bold tracking-widest text-white/40 uppercase">Entries</span>
              <span className="w-24 text-right text-[9px] font-bold tracking-widest text-white/40 uppercase">Net Result</span>
              <span className="w-20 text-center text-[9px] font-bold tracking-widest text-white/40 uppercase">Actions</span>
            </div>

            {pageItems.map((t, i) => (
              <div
                key={t.tournament_id}
                data-tournament-id={t.tournament_id}
                onClick={() => setSelectedTournament(t)}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setContextMenu({ tournamentId: t.tournament_id, x: rect.left - 176, y: rect.top }); }}
                className="group cursor-pointer border-b border-white/[0.03] transition-colors last:border-b-0 hover:bg-white/[0.03]"
                style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.012)' : 'transparent' }}
              >
                {/* Desktop row — hidden on mobile */}
                <div className="hidden flex-wrap items-center px-4 py-2.5 sm:flex">
                  <span className="w-24 text-[10px] text-white/50">{formatDate(t.first_played)}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">{t.site ?? 'Unknown'} #{t.tournament_id.slice(-6)}</span>
                  <span className="w-16 text-[10px] text-white/50">{t.site ?? '—'}</span>
                  <span className="w-20 text-right text-[10px] text-white/50">{t.buyIn != null ? `${t.buyIn}` : '—'}</span>
                  <span className="w-16 text-right text-[10px] font-mono text-white/50">{t.hand_count}</span>
                  <span className="w-16 text-right text-[10px] font-mono text-white/50">{t.entries ?? 1}</span>
                  <span className="w-24 text-right text-[11px] font-mono font-semibold" style={{ color: resultColor(t.net_result_sum ?? null) }}>{formatResult(t.net_result_sum ?? null)}</span>
                  <div className="flex w-20 items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { const row = (e.currentTarget as HTMLElement).closest('[data-tournament-id]') as HTMLElement; setAutoBatchOpen(t); setAutoBatchAnchor(row); }} title="Auto Batch" className="flex h-7 w-7 items-center justify-center rounded-md border transition-colors hover:bg-[#d4a52c]/15" style={{ borderColor: 'rgba(212,165,44,0.3)', color: GOLD_SOFT }}>
                      <Zap size={11} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setContextMenu({ tournamentId: t.tournament_id, x: rect.left - 176, y: rect.top });
                      }}
                      title="More"
                      className="flex h-7 w-7 items-center justify-center rounded-md border transition-colors hover:bg-white/5"
                      style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                    >
                      <MoreVertical size={11} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                {/* Mobile card — visible only on small screens */}
                <div className="flex flex-col gap-2 px-3 py-3 sm:hidden">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-bold text-white">{t.site ?? 'Unknown'} #{t.tournament_id.slice(-6)}</div>
                      <div className="mt-0.5 text-[10px] text-white/40">{formatDate(t.first_played)}</div>
                    </div>
                    <span className="shrink-0 text-[13px] font-mono font-bold" style={{ color: resultColor(t.net_result_sum ?? null) }}>
                      {formatResult(t.net_result_sum ?? null)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/50">
                    <span><span className="text-white/30">Site:</span> {t.site ?? '—'}</span>
                    <span><span className="text-white/30">Buy-in:</span> {t.buyIn != null ? `${t.buyIn}` : '—'}</span>
                    <span><span className="text-white/30">Hands:</span> <span className="font-mono">{t.hand_count}</span></span>
                    <span><span className="text-white/30">Entries:</span> <span className="font-mono">{t.entries ?? 1}</span></span>
                  </div>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { const row = (e.currentTarget as HTMLElement).closest('[data-tournament-id]') as HTMLElement; setAutoBatchOpen(t); setAutoBatchAnchor(row); }} title="Auto Batch" className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md border text-[10px] font-medium transition-colors hover:bg-[#d4a52c]/15" style={{ borderColor: 'rgba(212,165,44,0.3)', color: GOLD_SOFT }}>
                      <Zap size={11} strokeWidth={1.5} /> Batch
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setContextMenu({ tournamentId: t.tournament_id, x: rect.left - 176, y: rect.top });
                      }}
                      title="More"
                      className="flex h-7 w-9 items-center justify-center rounded-md border transition-colors hover:bg-white/5"
                      style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                    >
                      <MoreVertical size={11} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="flex items-center gap-1 text-[10px] font-medium text-white/40 disabled:opacity-30 hover:text-white/60">
                <ChevronLeft size={12} /> Prev
              </button>
              <span className="text-[10px] text-white/30">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="flex items-center gap-1 text-[10px] font-medium text-white/40 disabled:opacity-30 hover:text-white/60">
                Next <ChevronRight size={12} />
              </button>
            </div>
          )}
        </>
      )}

      {autoBatchPopover}

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-[300] w-44 rounded-lg border border-[#d4a52c]/20 bg-[#11100E] p-1 shadow-2xl"
            style={{
              left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 184)),
              top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 130)),
            }}
          >
            {(() => {
              const t = tournaments.find(tt => tt.tournament_id === contextMenu.tournamentId);
              if (!t) return null;
              return (
                <>
                  <button onClick={() => { setSelectedTournament(t); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[10px] text-white/70 hover:bg-[#d4a52c]/12">
                    <Eye size={11} strokeWidth={1.5} /> View Details
                  </button>
                  <button onClick={() => { setAutoBatchOpen(t); setAutoBatchAnchor(document.querySelector(`[data-tournament-id="${t.tournament_id}"]`) as HTMLElement); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[10px] text-white/70 hover:bg-[#d4a52c]/12">
                    <Zap size={11} strokeWidth={1.5} /> Auto Batch
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}

// ── Period Option ──
function PeriodOption({ label, subtext, selected, onClick }: { label: string; subtext?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
      style={{ background: selected ? 'rgba(212,165,44,0.08)' : 'transparent' }}
    >
      <span className="flex flex-col">
        <span className={`text-[11px] font-bold ${selected ? '' : 'text-white/70'}`} style={{ color: selected ? GOLD_SOFT : undefined }}>{label}</span>
        {subtext && <span className="text-[9px] text-white/35">{subtext}</span>}
      </span>
      {selected && <Check size={12} style={{ color: GOLD }} />}
    </button>
  );
}

// ── Stat Card ──
function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: DARK_PANEL }}>
      <div className="text-[8px] font-semibold tracking-widest text-white/40 uppercase">{label}</div>
      <div className="mt-0.5 text-[14px] font-bold" style={{ color: color ?? '#ffffff' }}>{value}</div>
    </div>
  );
}

// ── Tournament Detail View ──
function TournamentDetail({ tournament, userId, onBack, onAutoBatch }: {
  tournament: TournamentLibItem;
  userId?: string;
  onBack: () => void;
  onAutoBatch: (anchor: HTMLElement) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <button onClick={onBack} className="flex items-center gap-1 text-[11px] font-medium text-white/60 hover:text-white">
          <ChevronLeft size={14} /> Back to Library
        </button>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <h3 className="text-[14px] font-bold text-white">{tournament.site ?? 'Unknown'} #{tournament.tournament_id.slice(-6)}</h3>
        <p className="mt-1 text-[10px] text-white/40">{tournament.first_played ? new Date(tournament.first_played).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Date unavailable'}</p>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          <StatCard label="Hands" value={tournament.hand_count.toLocaleString()} />
          <StatCard label="Entries" value={(tournament.entries ?? 1).toLocaleString()} />
          <StatCard label="Buy-in" value={tournament.buyIn != null ? `$${tournament.buyIn}` : '—'} />
          <StatCard label="Net Result" value={tournament.net_result_sum != null ? `${tournament.net_result_sum > 0 ? '+' : ''}${tournament.net_result_sum.toLocaleString()}` : '—'} color={tournament.net_result_sum != null ? (tournament.net_result_sum > 0 ? '#4ade80' : tournament.net_result_sum < 0 ? '#f87171' : '#9ca3af') : '#6b7280'} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={(event) => onAutoBatch(event.currentTarget)} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-[#d4a52c]/15" style={{ borderColor: 'rgba(212,165,44,0.3)', color: GOLD_SOFT }}>
            <Zap size={11} strokeWidth={1.5} /> Auto Batch
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Auto Batch Modal ──
function AutoBatchModal({ tournament, userId, allBatches, anchor, onClose }: {
  tournament: TournamentLibItem;
  userId?: string;
  allBatches: HandBatch[];
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  const [popoverPosition, setPopoverPosition] = useState({ left: 16, top: 16 });
  const [bbThreshold, setBbThreshold] = useState<number>(3);
  const [customThreshold, setCustomThreshold] = useState<string>('');
  const [includePreflopFolds, setIncludePreflopFolds] = useState(false);
  const [foldStrength, setFoldStrength] = useState<number>(10);
  const [previewHands, setPreviewHands] = useState<HandRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchName, setBatchName] = useState(`${tournament.site ?? 'Tournament'} — ${bbThreshold}BB+ Study Batch`);
  const [created, setCreated] = useState(false);
  const [destination, setDestination] = useState<'my-spots' | 'workspace' | 'stay'>('stay');

  const effectiveThreshold = customThreshold ? Number(customThreshold) : bbThreshold;

  useEffect(() => {
    const updatePosition = () => {
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 32);
      const height = 430;
      const left = Math.max(16, Math.min(rect.left - width - 12, window.innerWidth - width - 16));
      const top = rect.bottom + height <= window.innerHeight - 16
        ? rect.bottom + 8
        : Math.max(16, rect.top - height - 8);
      setPopoverPosition({ left, top });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, onClose]);

  useEffect(() => {
    setBatchName(`${tournament.site ?? 'Tournament'} — ${effectiveThreshold}BB+ Study Batch`);
  }, [effectiveThreshold, tournament.site]);

  const runPreview = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const PAGE_SIZE = 1000;
      let offset = 0;
      const allHands: HandRow[] = [];
      while (true) {
        const { data } = await supabase
          .from('poker_hand_records')
          .select('id, hand_id, played_at, blinds, position, net_result, bb_won, pot_amount, hero_cards, raw_hand_text, hero_name, showdown, starting_hand_class')
          .eq('user_id', userId)
          .eq('tournament_id', tournament.tournament_id)
          .order('played_at', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (!data || data.length === 0) break;
        allHands.push(...(data as HandRow[]));
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      const bbMatches = allHands.filter(h => {
        const bb = safeNum(h.bb_won) ?? safeNum(h.net_result);
        return bb !== null && Math.abs(bb) >= effectiveThreshold;
      });
      setPreviewHands(bbMatches);
    } catch { setPreviewHands([]); }
    finally { setLoading(false); }
  }, [userId, tournament.tournament_id, effectiveThreshold]);

  useEffect(() => { runPreview(); }, [runPreview]);

  const handleCreateBatch = async () => {
    if (!userId || previewHands.length === 0) return;
    const batchData = await createBatch(userId, batchName);
    if (!batchData) return;
    for (const h of previewHands) {
      await addSingleHandToBatch(batchData.id, {
        hand_id: h.hand_id ?? h.id,
        hand_fingerprint: h.hand_id ?? h.id,
        position: h.position,
        hero_cards: h.hero_cards,
        net_result: h.net_result,
        site: tournament.site,
        game_mode: 'mtt',
      });
    }
    setCreated(true);
    if (destination === 'my-spots') {
      onClose();
    }
  };

  void allBatches;
  void includePreflopFolds;
  void foldStrength;

  return (
    <div
      className="fixed z-[200] w-[min(380px,calc(100vw-32px))] rounded-xl border p-4 shadow-2xl"
      style={{ left: popoverPosition.left, top: popoverPosition.top, borderColor: 'rgba(192,145,30,0.3)', background: 'rgba(5,4,3,0.98)' }}
      role="dialog"
      aria-label="Auto Batch configuration"
    >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={16} style={{ color: GOLD }} />
            <h3 className="text-[14px] font-bold text-white">Auto Batch</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X size={16} /></button>
        </div>

        <p className="mb-3 text-[11px] text-white/50">{tournament.site ?? 'Unknown'} #{tournament.tournament_id.slice(-6)} — {tournament.hand_count} hands</p>

        <div className="mb-4">
          <label className="mb-1.5 block text-[10px] font-bold tracking-wider text-white/50 uppercase">BB Threshold (absolute net result)</label>
          <div className="flex flex-wrap gap-1.5">
            {[3, 5, 10, 20].map(t => (
              <button key={t} onClick={() => { setBbThreshold(t); setCustomThreshold(''); }}
                className="rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition-all"
                style={{
                  borderColor: !customThreshold && bbThreshold === t ? GOLD : 'rgba(212,165,44,0.2)',
                  background: !customThreshold && bbThreshold === t ? 'rgba(212,165,44,0.15)' : 'rgba(8,7,6,0.85)',
                  color: !customThreshold && bbThreshold === t ? GOLD_SOFT : 'rgba(220,220,220,0.7)',
                }}>
                {t} BB+
              </button>
            ))}
            <input
              type="number"
              value={customThreshold}
              onChange={(e) => setCustomThreshold(e.target.value)}
              placeholder="Custom"
              className="w-20 rounded-md border border-white/[0.08] bg-black/40 px-2 py-1.5 text-[10px] text-white/70 outline-none"
            />
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} /></div>
          ) : (
            <div className="space-y-1 text-[10px] text-white/60">
              <div className="flex justify-between"><span>Original hands:</span><span className="font-mono text-white/70">{tournament.hand_count}</span></div>
              <div className="flex justify-between"><span>BB threshold matches ({effectiveThreshold} BB+):</span><span className="font-mono text-white/70">{previewHands.length}</span></div>
              <div className="flex justify-between"><span>Final study batch:</span><span className="font-mono font-bold" style={{ color: GOLD_SOFT }}>{previewHands.length} hands</span></div>
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-[10px] font-bold tracking-wider text-white/50 uppercase">Batch Name</label>
          <input value={batchName} onChange={e => setBatchName(e.target.value)} className="w-full rounded-md border border-white/[0.08] bg-black/40 px-3 py-2 text-[11px] text-white/70 outline-none" />
        </div>

        <div className="mb-3 space-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
          <label className="block text-[9px] font-bold tracking-wider text-white/45 uppercase">After creating batch</label>
          {([
            ['my-spots', 'Create & View in My Spots'],
            ['stay', 'Create & Stay on Page'],
          ] as const).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-[10px] text-white/60">
              <input type="radio" name="batch-destination" checked={destination === value} onChange={() => setDestination(value)} />
              {label}
            </label>
          ))}
        </div>

        <button onClick={() => void handleCreateBatch()} disabled={previewHands.length === 0 || loading} className="flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-[#d4a52c]/15 disabled:opacity-30" style={{ borderColor: 'rgba(212,165,44,0.3)', color: GOLD_SOFT }}>
          <FolderPlus size={12} strokeWidth={1.5} /> {loading ? 'Preparing…' : 'Create Batch'}
        </button>
        {created && <p className="mt-2 text-center text-[10px] text-emerald-400">Batch created successfully!</p>}
    </div>
  );
}

function safeNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
