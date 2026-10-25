import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Layers, ChevronRight, X, Loader2, Filter, Play, RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  classifyHandRecord, applyFilters, getFilterCounts, getTournamentList,
  getFilterLabel, getResponseLabel, formatHeroCards, formatBoard, formatResultBB, resultColor,
  ALL_PRIMARY_FILTERS, FILTER_GROUPS,
  type HandRecord, type ClassifiedHand, type HandSorterFilters,
  type PrimaryFilter, type PositionFilter, type StackFilter, type ResultFilter,
} from '@/lib/handSorter';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import type { NormalizedHand } from '@/features/hh-replayer/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const PANEL_BG = 'rgba(8, 10, 12, 0.92)';
const PANEL_BORDER = 'rgba(212, 165, 44, 0.12)';

const POSITIONS: PositionFilter[] = ['all', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const STACKS: { value: StackFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '<10', label: '<10 BB' },
  { value: '10-20', label: '10-20 BB' },
  { value: '20-30', label: '20-30 BB' },
  { value: '30-50', label: '30-50 BB' },
  { value: '50-100', label: '50-100 BB' },
  { value: '100+', label: '100+ BB' },
];
const RESULTS: { value: ResultFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

interface Props {
  userId: string;
  mode?: 'student' | 'coach';
  title?: string;
}

export function HandSorter({ userId, mode = 'student', title }: Props) {
  const [hands, setHands] = useState<ClassifiedHand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HandSorterFilters>({
    primary: null,
    position: 'all',
    stack: 'all',
    tournament: 'all',
    result: 'all',
  });
  const [reviewingHandId, setReviewingHandId] = useState<string | null>(null);
  const [reviewHand, setReviewHand] = useState<NormalizedHand | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // Fetch and classify all hands
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const allRecords: HandRecord[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error: fetchError } = await supabase
            .from('poker_hand_records')
            .select('hand_id,tournament_id,position,hero_name,hero_cards,board,net_result,stack_size,blinds,played_at,raw_hand_text,site,game_mode')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (fetchError) throw new Error(fetchError.message);
          if (!data || data.length === 0) { hasMore = false; break; }
          allRecords.push(...(data as unknown as HandRecord[]));
          if (data.length < pageSize) hasMore = false;
          page++;
        }

        if (cancelled) return;
        const classified = allRecords.map(classifyHandRecord);
        setHands(classified);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load hands');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const filterCounts = useMemo(() => getFilterCounts(hands), [hands]);
  const tournaments = useMemo(() => getTournamentList(hands), [hands]);

  const filteredHands = useMemo(() => {
    return applyFilters(hands, filters);
  }, [hands, filters]);

  const handleSelectPrimary = useCallback((f: PrimaryFilter) => {
    setFilters((prev) => ({ ...prev, primary: prev.primary === f ? null : f }));
  }, []);

  const handleReview = useCallback(async (handId: string) => {
    scrollPositionRef.current = scrollRef.current?.scrollTop ?? 0;
    setReviewingHandId(handId);
    setReviewLoading(true);
    setReviewHand(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('poker_hand_records')
        .select('*, raw_hand_text')
        .eq('user_id', userId)
        .eq('hand_id', handId)
        .maybeSingle();

      if (fetchError) throw new Error(fetchError.message);
      if (!data) throw new Error('Hand not found');

      const normalized = phase2HandToNormalized(data as unknown as Phase2HandRecord);
      if (!normalized.actions || normalized.actions.length === 0) {
        throw new Error('Unable to replay — action data incomplete');
      }
      setReviewHand(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load hand for replay');
    } finally {
      setReviewLoading(false);
    }
  }, [userId]);

  const handleCloseReview = useCallback(() => {
    setReviewingHandId(null);
    setReviewHand(null);
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollPositionRef.current;
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
          <span className="text-[12px] text-white/40">Loading hands...</span>
        </div>
      </div>
    );
  }

  if (error && hands.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-[13px] font-semibold text-white/60">Unable to load hands</p>
          <p className="mt-1 text-[11px] text-white/35">{error}</p>
        </div>
      </div>
    );
  }

  if (hands.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <Layers className="mx-auto mb-3 h-10 w-10 text-white/15" strokeWidth={1} />
          <p className="text-[13px] font-semibold text-white/60">No hands available</p>
          <p className="mt-1 text-[11px] text-white/35">
            {mode === 'coach'
              ? 'This student has not uploaded any hand histories yet.'
              : 'Upload hand histories in Analytics to start sorting and reviewing by decision type.'}
          </p>
        </div>
      </div>
    );
  }

  // Replayer overlay
  if (reviewingHandId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col p-3 md:p-6">
        <div className="mb-3 flex items-center gap-3">
          <button
            onClick={handleCloseReview}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/60 transition-all hover:border-white/20 hover:text-white"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to Sorter
          </button>
          <span className="text-[10px] font-mono tracking-wider text-white/40">
            {filters.primary ? getFilterLabel(filters.primary) : 'All Hands'} · {filteredHands.findIndex(h => h.hand_id === reviewingHandId) + 1} of {filteredHands.length}
          </span>
          <div className="ml-auto flex gap-1.5">
            <button
              onClick={() => {
                const idx = filteredHands.findIndex(h => h.hand_id === reviewingHandId);
                if (idx > 0) handleReview(filteredHands[idx - 1].hand_id);
              }}
              disabled={filteredHands.findIndex(h => h.hand_id === reviewingHandId) <= 0}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/50 transition-all hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => {
                const idx = filteredHands.findIndex(h => h.hand_id === reviewingHandId);
                if (idx >= 0 && idx < filteredHands.length - 1) handleReview(filteredHands[idx + 1].hand_id);
              }}
              disabled={filteredHands.findIndex(h => h.hand_id === reviewingHandId) >= filteredHands.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/50 transition-all hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border p-3 md:p-6" style={{ borderColor: PANEL_BORDER, background: 'rgba(8,10,12,0.95)' }}>
          {reviewLoading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
              <span className="mt-3 text-[12px] text-white/40">Loading hand...</span>
            </div>
          ) : reviewHand ? (
            <div className="overflow-x-hidden">
              <HHReplayer hand={reviewHand} variant="full" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-[12px] text-white/50">Failed to load hand for replay.</p>
              <button onClick={handleCloseReview} className="mt-3 text-[11px] font-semibold text-[#d4a52c] hover:underline">Back to Sorter</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-3 md:p-6">
      <div className="flex h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-xl border shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] md:h-[88vh] lg:h-[80vh]" style={{ borderColor: PANEL_BORDER, background: PANEL_BG, backdropFilter: 'blur(16px)' }}>
        {/* Header */}
        <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(212,165,44,0.1)', border: '1px solid rgba(212,165,44,0.15)' }}>
              <Layers className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-white">{title || 'Hand Sorter'}</h2>
              <span className="text-[9px] font-mono tracking-[0.15em] uppercase" style={{ color: 'rgba(212,165,44,0.6)' }}>
                {hands.length} hands loaded · {filteredHands.length} matching
              </span>
            </div>
            {(filters.primary || filters.position !== 'all' || filters.stack !== 'all' || filters.tournament !== 'all' || filters.result !== 'all') && (
              <button
                onClick={() => setFilters({ primary: null, position: 'all', stack: 'all', tournament: 'all', result: 'all' })}
                className="ml-auto flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-white/50 transition-all hover:text-white"
              >
                <RotateCcw className="h-3 w-3" strokeWidth={1.5} /> Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Primary filter chips */}
        <div className="shrink-0 space-y-2.5 border-b border-white/[0.06] px-4 py-3">
          {FILTER_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-1.5 text-[8px] font-mono tracking-[0.2em] text-white/30 uppercase">{group.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {group.filters.map((f) => {
                  const active = filters.primary === f;
                  const count = filterCounts[f];
                  return (
                    <button
                      key={f}
                      onClick={() => handleSelectPrimary(f)}
                      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold tracking-wide transition-all"
                      style={{
                        borderColor: active ? 'rgba(212,165,44,0.5)' : 'rgba(255,255,255,0.08)',
                        background: active ? 'rgba(212,165,44,0.15)' : 'rgba(255,255,255,0.025)',
                        color: active ? GOLD_SOFT : 'rgba(255,255,255,0.55)',
                      }}
                    >
                      {getFilterLabel(f)}
                      <span className="text-[9px] font-mono" style={{ color: active ? 'rgba(245,230,176,0.7)' : 'rgba(255,255,255,0.25)' }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Secondary filters */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <div className="flex items-center gap-1 text-[9px] font-mono tracking-widest text-white/30 uppercase">
            <Filter className="h-3 w-3" strokeWidth={1.5} />
          </div>
          {/* Position */}
          <select
            value={filters.position}
            onChange={(e) => setFilters((p) => ({ ...p, position: e.target.value as PositionFilter }))}
            className="rounded-md border border-white/10 bg-[#0a0c0e] px-2 py-1 text-[10px] font-medium text-white/60 outline-none focus:border-[#c0911e]/40"
          >
            {POSITIONS.map((p) => <option key={p} value={p}>{p === 'all' ? 'All Positions' : p}</option>)}
          </select>
          {/* Stack */}
          <select
            value={filters.stack}
            onChange={(e) => setFilters((p) => ({ ...p, stack: e.target.value as StackFilter }))}
            className="rounded-md border border-white/10 bg-[#0a0c0e] px-2 py-1 text-[10px] font-medium text-white/60 outline-none focus:border-[#c0911e]/40"
          >
            {STACKS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {/* Tournament */}
          {tournaments.length > 0 && (
            <select
              value={filters.tournament}
              onChange={(e) => setFilters((p) => ({ ...p, tournament: e.target.value }))}
              className="max-w-[180px] truncate rounded-md border border-white/10 bg-[#0a0c0e] px-2 py-1 text-[10px] font-medium text-white/60 outline-none focus:border-[#c0911e]/40"
            >
              <option value="all">All Tournaments</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.label} ({t.count})</option>
              ))}
            </select>
          )}
          {/* Result */}
          <select
            value={filters.result}
            onChange={(e) => setFilters((p) => ({ ...p, result: e.target.value as ResultFilter }))}
            className="rounded-md border border-white/10 bg-[#0a0c0e] px-2 py-1 text-[10px] font-medium text-white/60 outline-none focus:border-[#c0911e]/40"
          >
            {RESULTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {/* Results list */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3" style={{ scrollbarWidth: 'thin' }}>
          {filteredHands.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-[13px] font-semibold text-white/50">No hands match these filters</p>
              <p className="text-[11px] text-white/30">Try a different filter combination.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredHands.map((h, i) => (
                <HandResultCard key={h.hand_id} hand={h} index={i} onReview={handleReview} primaryFilter={filters.primary} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HandResultCard({ hand, index, onReview, primaryFilter }: { hand: ClassifiedHand; index: number; onReview: (handId: string) => void; primaryFilter: PrimaryFilter | null }) {
  const responseLabel = primaryFilter ? getResponseLabel(hand.classification, primaryFilter) : null;

  return (
    <div className="group rounded-lg border px-3 py-2.5 transition-all hover:scale-[1.01]" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* Top line: hand number + position + stack */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-mono font-bold text-white/70">#{index + 1}</span>
            {hand.position && (
              <span className="rounded border border-[#c0911e]/20 bg-[#c0911e]/8 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#d4a52c]">
                {hand.position}
              </span>
            )}
            {hand.stackBB !== null && (
              <span className="text-[10px] text-white/40">{hand.stackBB} BB</span>
            )}
            {responseLabel && (
              <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-white/50">
                {responseLabel}
              </span>
            )}
            {hand.tournament_id && (
              <span className="truncate text-[9px] font-mono text-white/25">{hand.tournament_id}</span>
            )}
          </div>

          {/* Cards + board */}
          <div className="mt-1.5 flex items-center gap-3">
            {hand.hero_cards && (
              <span className="text-[13px] font-bold tracking-wide text-white/85" style={{ fontFamily: 'monospace' }}>
                {formatHeroCards(hand.hero_cards)}
              </span>
            )}
            {hand.board && (
              <span className="text-[11px] text-white/45" style={{ fontFamily: 'monospace' }}>
                {formatBoard(hand.board)}
              </span>
            )}
          </div>
        </div>

        {/* Result + review button */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-[13px] font-bold font-mono" style={{ color: resultColor(hand.net_result) }}>
            {formatResultBB(hand.net_result)}
          </span>
          <button
            onClick={() => onReview(hand.hand_id)}
            className="flex items-center gap-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-2.5 py-1 text-[9px] font-bold tracking-widest text-[#d4a52c] uppercase transition-all hover:bg-[#c0911e]/20"
          >
            <Play className="h-2.5 w-2.5" strokeWidth={2} /> Review
          </button>
        </div>
      </div>
    </div>
  );
}
