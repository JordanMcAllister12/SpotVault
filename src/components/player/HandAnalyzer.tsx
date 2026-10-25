import { useState, useCallback, useEffect } from 'react';
import {
  Play, Search, ChevronLeft, ChevronRight, X,
  Loader2, Plus, CheckSquare, Square, MoreVertical, FileText, Flag,
  Bookmark, Copy, ExternalLink, Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PremiumCardFace } from '@/features/hh-replayer/PremiumCardFace';
import { fetchBatches, addSingleHandToBatch, createBatch, type HandBatch } from '@/lib/batchStore';
import { fetchAllCanonicalNotes, saveCanonicalNote, toggleCanonicalFlag, type CanonicalHandNote } from '@/lib/canonicalHandNotes';
import { fetchSavedHandIds, saveHand, unsaveHand } from '@/lib/handBookmarkStore';
import { sendHandToWorkspace } from '@/lib/workspaceHandQueueStore';
import {
  type SortMode, type HandFilters, DEFAULT_FILTERS,
  GOLD, GOLD_SOFT, BORDER, DARK_PANEL,
  UnifiedFilterBar, applyFilterToQuery,
} from '@/components/player/UnifiedFilters';

const PAGE_SIZE = 20;

function parseHeroCards(cards: string | null): string[] {
  if (!cards) return [];
  const SUIT_MAP: Record<string, string> = {
    's': 's', '\u2660': 's',
    'h': 'h', '\u2665': 'h',
    'd': 'd', '\u2666': 'd',
    'c': 'c', '\u2663': 'c',
  };
  const matches = cards.match(/[2-9TJQKA][shdc\u2660\u2665\u2666\u2663]/gi);
  if (!matches) return [];
  return matches.slice(0, 2).map(m => {
    const rank = m.slice(0, -1).toUpperCase();
    const suitChar = m.slice(-1).toLowerCase();
    const suit = SUIT_MAP[suitChar] ?? suitChar;
    return `${rank}${suit}`;
  });
}

function parseBigBlind(blinds: string | null): number | null {
  if (!blinds) return null;
  const parts = blinds.split('/');
  if (parts.length < 2) return null;
  const bb = Number(parts[1].replace(/,/g, ''));
  return Number.isFinite(bb) && bb > 0 ? bb : null;
}

function potInBB(potAmount: number | null, blinds: string | null): string {
  if (potAmount == null || !Number.isFinite(Number(potAmount))) return '\u2014';
  const bb = parseBigBlind(blinds);
  if (bb === null) return '\u2014';
  return `${(Number(potAmount) / bb).toFixed(1)}bb`;
}

function safeNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface HandListItem {
  id: string;
  hand_id: string | null;
  played_at: string | null;
  blinds: string | null;
  position: string | null;
  net_result: number | null;
  bb_won: number | null;
  pot_amount: number | null;
  stack_size: number | null;
  effective_stack_bb: number | null;
  hero_cards: string | null;
  tournament_id: string | null;
  game_mode: string | null;
  showdown: boolean | null;
  pot_type: string | null;
  street_reached: string | null;
}

interface HandAnalyzerProps {
  userId?: string;
  mode?: 'cash' | 'mtt';
  externalFilters?: Record<string, unknown> | null;
  onFiltersConsumed?: () => void;
  onPlayHand?: (handId: string) => void;
}

export function HandAnalyzer({ userId, mode = 'mtt', externalFilters, onFiltersConsumed, onPlayHand }: HandAnalyzerProps) {
  const [filters, setFilters] = useState<HandFilters>({ ...DEFAULT_FILTERS, gameMode: mode });
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [handList, setHandList] = useState<HandListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedHandIds, setSelectedHandIds] = useState<Set<string>>(new Set());
  const [batchDropdownOpen, setBatchDropdownOpen] = useState(false);
  const [allBatches, setAllBatches] = useState<HandBatch[]>([]);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [batchPickerId, setBatchPickerId] = useState<string | null>(null);
  const [canonicalNotes, setCanonicalNotes] = useState<Record<string, CanonicalHandNote>>({});
  const [noteDraft, setNoteDraft] = useState('');
  const [notesForHand, setNotesForHand] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [savedHandIds, setSavedHandIds] = useState<Set<string>>(new Set());
  const [workspaceToast, setWorkspaceToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const [batches, notes, saved] = await Promise.all([
        fetchBatches(data.user.id),
        fetchAllCanonicalNotes(data.user.id),
        fetchSavedHandIds(data.user.id),
      ]);
      setAllBatches(batches);
      setCanonicalNotes(Object.fromEntries(notes.map(note => [note.hand_id, note])));
      setSavedHandIds(saved);
    })();
  }, []);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, gameMode: mode }));
  }, [mode]);

  useEffect(() => {
    if (!externalFilters) return;
    const newFilters: Partial<HandFilters> = {};
    if (externalFilters.position) newFilters.position = externalFilters.position as string;
    if (externalFilters.startingHand) newFilters.startingHandClass = externalFilters.startingHand as string;
    if (externalFilters.boardClass) newFilters.boardClass = externalFilters.boardClass as string;
    if (externalFilters.potType) newFilters.potType = externalFilters.potType as string;
    if (externalFilters.sawFlop) newFilters.sawFlop = true;
    if (externalFilters.sawRiver) newFilters.sawRiver = true;
    if (externalFilters.wentToShowdown) newFilters.wentToShowdown = true;
    setFilters((prev) => ({ ...prev, ...newFilters }));
    onFiltersConsumed?.();
  }, [externalFilters, onFiltersConsumed]);

  const fetchHands = useCallback(async (signal?: AbortSignal) => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    const selectCols = 'id, hand_id, played_at, blinds, position, net_result, bb_won, pot_amount, stack_size, effective_stack_bb, hero_cards, tournament_id, game_mode, showdown, pot_type, street_reached';

    try {
      const countQuery = applyFilterToQuery(
        supabase.from('poker_hand_records').select('*', { count: 'exact', head: true }).eq('user_id', userId).filter('hand_hash', 'not.like', '%-unknown-%').filter('hand_hash', 'not.like', 'summary-%'),
        filters,
      );

      let dataQuery = applyFilterToQuery(
        supabase.from('poker_hand_records').select(selectCols).eq('user_id', userId).filter('hand_hash', 'not.like', '%-unknown-%').filter('hand_hash', 'not.like', 'summary-%'),
        filters,
      );

      switch (sortMode) {
        case 'recent': dataQuery = dataQuery.order('played_at', { ascending: false }); break;
        case 'oldest': dataQuery = dataQuery.order('played_at', { ascending: true }); break;
        case 'biggest_pot': dataQuery = dataQuery.order('pot_amount', { ascending: false }).not('pot_amount', 'is', null); break;
        case 'biggest_win': dataQuery = dataQuery.order('net_result', { ascending: false }).not('net_result', 'is', null); break;
        case 'biggest_loss': dataQuery = dataQuery.order('net_result', { ascending: true }).not('net_result', 'is', null); break;
        case 'biggest_stack': dataQuery = dataQuery.order('stack_size', { ascending: false }).not('stack_size', 'is', null); break;
      }

      dataQuery = dataQuery.range(offset, offset + PAGE_SIZE - 1);

      const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);
      if (signal?.aborted) return;

      if (countResult.error) throw new Error(countResult.error.message);
      setTotalCount(countResult.count ?? 0);

      if (dataResult.error) throw new Error(dataResult.error.message);
      setHandList((dataResult.data ?? []) as HandListItem[]);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load hands');
      setHandList([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [userId, filters, sortMode, offset]);

  useEffect(() => {
    const controller = new AbortController();
    fetchHands(controller.signal);
    return () => controller.abort();
  }, [fetchHands]);

  useEffect(() => { setOffset(0); }, [filters, sortMode]);

  const playHand = useCallback(async (handId: string) => {
    if (!userId || !handId) return;
    onPlayHand?.(handId);
  }, [userId, onPlayHand]);

  const openNotesFor = useCallback((handId: string) => {
    setNotesForHand(handId);
    setNoteDraft(canonicalNotes[handId]?.note_text ?? '');
  }, [canonicalNotes]);

  const closeNotes = useCallback(() => {
    setNotesForHand(null);
    setNoteDraft('');
  }, []);

  const saveNote = useCallback(async () => {
    if (!userId || !notesForHand) return;
    setNoteSaving(true);
    const ok = await saveCanonicalNote(userId, notesForHand, userId, noteDraft.trim());
    if (ok) {
      setCanonicalNotes(prev => ({
        ...prev,
        [notesForHand]: {
          ...(prev[notesForHand] ?? { id: '', user_id: userId, hand_id: notesForHand, hand_user_id: userId, is_flagged: false, created_at: new Date().toISOString() }),
          note_text: noteDraft.trim(),
          updated_at: new Date().toISOString(),
        },
      }));
    }
    setNoteSaving(false);
    closeNotes();
  }, [userId, notesForHand, noteDraft, closeNotes]);

  const toggleFlag = useCallback(async (handId: string) => {
    if (!userId) return;
    const next = !canonicalNotes[handId]?.is_flagged;
    if (await toggleCanonicalFlag(userId, handId, userId, next)) {
      setCanonicalNotes(prev => ({
        ...prev,
        [handId]: {
          ...(prev[handId] ?? { id: '', user_id: userId, hand_id: handId, hand_user_id: userId, note_text: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
          is_flagged: next,
          updated_at: new Date().toISOString(),
        },
      }));
    }
  }, [userId, canonicalNotes]);

  const toggleSaved = useCallback(async (handId: string) => {
    if (!userId) return;
    const isSaved = savedHandIds.has(handId);
    const ok = isSaved ? await unsaveHand(userId, handId, userId) : await saveHand(userId, handId, userId);
    if (ok) setSavedHandIds(prev => { const next = new Set(prev); if (isSaved) next.delete(handId); else next.add(handId); return next; });
  }, [userId, savedHandIds]);

  const addHandToBatch = useCallback(async (hand: HandListItem, batchId: string) => {
    const result = await addSingleHandToBatch(batchId, { hand_id: hand.hand_id ?? hand.id, hand_fingerprint: hand.hand_id ?? hand.id, position: hand.position, hero_cards: hand.hero_cards, net_result: hand.net_result, blinds: hand.blinds, pot_amount: hand.pot_amount, tournament_id: hand.tournament_id, played_at: hand.played_at, game_mode: hand.game_mode, showdown: hand.showdown ?? false });
    setBulkToast(result.ok ? 'Hand added to study batch' : result.error === 'duplicate' ? 'Hand is already in this batch' : 'Could not add hand to batch');
    setTimeout(() => setBulkToast(null), 3000);
    setBatchPickerId(null);
    setActionMenuId(null);
  }, []);

  const createBatchWithHand = useCallback(async (hand: HandListItem) => {
    if (!userId) return;
    const batch = await createBatch(userId, `Study Batch — ${hand.hand_id ?? 'Hand'}`);
    if (batch) await addHandToBatch(hand, batch.id);
  }, [userId, addHandToBatch]);

  const formatDate = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const resultColor = (r: number | null) => {
    if (r == null || !Number.isFinite(Number(r))) return '#6b7280';
    return Number(r) > 0 ? '#4ade80' : Number(r) < 0 ? '#f87171' : '#9ca3af';
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-2 sm:space-y-3">
      <UnifiedFilterBar
        filters={filters}
        setFilters={setFilters}
        sortMode={sortMode}
        setSortMode={setSortMode}
        totalCount={totalCount}
        loading={loading}
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
      />

      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3">
          <p className="text-[11px] text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
      ) : handList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="mb-2 h-8 w-8" style={{ color: 'rgba(255,255,255,0.2)' }} strokeWidth={1.5} />
          <p className="text-[12px] text-white/40">No hands match your filters</p>
        </div>
      ) : (
        <>
          {selectedHandIds.size > 0 && (
            <div className="sticky top-0 z-10 flex items-center gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(192,145,30,0.08)' }}>
              <span className="text-[10px] font-bold text-[#f5e6b0]">{selectedHandIds.size} selected</span>
              <button onClick={() => setSelectedHandIds(new Set())} className="text-[9px] text-white/40 hover:text-white/60">Clear</button>
              <div className="relative ml-auto">
                <button onClick={() => setBatchDropdownOpen(v => !v)} className="flex items-center gap-1.5 rounded-md border border-[#d4a52c]/40 bg-[#c0911e]/15 px-3 py-1.5 text-[10px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/25">
                  <Plus className="h-3 w-3" /> Add {selectedHandIds.size} to Batch
                </button>
                {batchDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-[200]" onClick={() => setBatchDropdownOpen(false)} />
                    <div className="absolute right-0 top-full z-[201] mt-1 w-56 rounded-lg border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
                      <div className="max-h-48 overflow-y-auto p-1.5">
                        {allBatches.map((b) => (
                          <button key={b.id} onClick={async () => {
                            let added = 0, dups = 0;
                            for (const hid of selectedHandIds) {
                              const hand = handList.find(h => h.id === hid);
                              if (!hand) continue;
                              const r = await addSingleHandToBatch(b.id, { hand_id: hand.hand_id ?? hid, hand_fingerprint: hand.hand_id ?? hid, position: hand.position, hero_cards: hand.hero_cards, net_result: hand.net_result, site: null, game_mode: hand.game_mode });
                              if (r.ok) added++; else if (r.error === 'duplicate') dups++;
                            }
                            setBatchDropdownOpen(false);
                            setBulkToast(`${added} added to ${b.title}${dups > 0 ? ` (${dups} duplicates)` : ''}`);
                            setTimeout(() => setBulkToast(null), 3000);
                            setSelectedHandIds(new Set());
                          }} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[10px] text-white/70 hover:bg-white/5">
                            <span className="truncate">{b.title}</span><span className="text-white/30">{b.hand_count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {bulkToast && <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-[10px] text-emerald-300">{bulkToast}</div>}
          {workspaceToast && <div className="rounded-lg border border-[#d4a52c]/20 bg-[#d4a52c]/5 px-3 py-2 text-[10px] text-[#f5e6b0]">{workspaceToast}</div>}
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: DARK_PANEL }}>
            <div className="border-b border-white/[0.06] px-3 py-2 text-[9px] font-bold tracking-[0.18em] text-white/35 uppercase">Hand history review</div>
            <div className="divide-y divide-white/[0.05]">
              {handList.map((h) => (
                <div key={h.id}>
                  <div onClick={() => h.hand_id && playHand(h.hand_id)} className="group flex min-h-[58px] cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-white/[0.045] sm:gap-3">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedHandIds(prev => { const next = new Set(prev); if (next.has(h.id)) next.delete(h.id); else next.add(h.id); return next; }); }} className="shrink-0" title="Select hand">
                      {selectedHandIds.has(h.id) ? <CheckSquare className="h-4 w-4" style={{ color: GOLD }} /> : <Square className="h-4 w-4 text-white/20 hover:text-white/40" />}
                    </button>
                    <div className="flex w-[100px] shrink-0 items-center gap-1.5">
                      {parseHeroCards(h.hero_cards).map((card) => <PremiumCardFace key={card} card={card} width={44} height={62} cornerScale={1.4} />)}
                      {parseHeroCards(h.hero_cards).length === 0 && <span className="text-[9px] text-white/25">Cards —</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                        <span className="font-bold text-white">{h.position ?? '—'}</span>
                        {h.game_mode === 'mtt' && <span className="text-[8px] font-bold uppercase" style={{ color: GOLD_SOFT }}>MTT</span>}
                        <span className="text-white/45">{(() => { const v = safeNum(h.effective_stack_bb); return v !== null ? `${v.toFixed(1)}bb eff` : '— eff'; })()}</span>
                        {h.blinds && <span className="text-white/35">{h.blinds}</span>}
                        <span className="capitalize text-white/35">{h.street_reached ?? '—'}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-[9px] text-white/30"><span>{formatDate(h.played_at)}</span><span>Pot {potInBB(h.pot_amount, h.blinds)}</span>{h.pot_type && <span>{h.pot_type === '4bet_plus' ? '4-bet+' : h.pot_type}</span>}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <div className="text-right"><div className="text-[12px] font-bold font-mono" style={{ color: resultColor(safeNum(h.bb_won) ?? safeNum(h.net_result)) }}>{(() => { const bb = safeNum(h.bb_won); if (bb !== null) return `${bb > 0 ? '+' : ''}${bb.toFixed(2)} BB`; const nr = safeNum(h.net_result); return nr !== null ? `${nr > 0 ? '+' : ''}${nr.toLocaleString()}` : '—'; })()}</div><div className="text-[8px] text-white/25">{h.hand_id ? h.hand_id.slice(-8) : '—'}</div></div>
                      {h.hand_id && canonicalNotes[h.hand_id]?.note_text && <button onClick={(event) => { event.stopPropagation(); openNotesFor(h.hand_id!); }} title="Open hand note" className="text-[#d4a52c]"><FileText size={13} /></button>}
                      {h.hand_id && canonicalNotes[h.hand_id]?.is_flagged && <button onClick={(event) => { event.stopPropagation(); void toggleFlag(h.hand_id!); }} title="Flagged for review" className="text-red-300"><Flag size={13} fill="currentColor" /></button>}
                      <button onClick={(event) => { event.stopPropagation(); h.hand_id && playHand(h.hand_id); }} aria-label={`Replay hand ${h.hand_id ?? ''}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors hover:bg-[#d4a52c]/15" style={{ borderColor: 'rgba(212,165,44,0.45)', color: GOLD_SOFT }}>
                        <Play size={12} fill="currentColor" strokeWidth={1.5} />
                      </button>
                      <div className="relative" onClick={event => event.stopPropagation()}>
                        <button onClick={() => setActionMenuId(actionMenuId === h.id ? null : h.id)} aria-label="Hand actions" className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/45 transition hover:border-[#d4a52c]/40 hover:text-[#f5e6b0]"><MoreVertical size={14} /></button>
                        {actionMenuId === h.id && <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-[#d4a52c]/20 bg-[#0d0f12] p-1 shadow-2xl">
                          <button onClick={() => void toggleSaved(h.hand_id ?? h.id)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] text-white/70 hover:bg-white/5"><Bookmark size={12} /> {savedHandIds.has(h.hand_id ?? h.id) ? 'Remove from Favorites' : 'Add to Favorites'}</button>
                          <button onClick={() => { setBatchPickerId(batchPickerId === h.id ? null : h.id); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] text-white/70 hover:bg-white/5"><Plus size={12} /> Add to Study Batch</button>
                          {batchPickerId === h.id && <div className="mx-1 mb-1 max-h-32 overflow-y-auto rounded border border-white/10 p-1">{allBatches.map(batch => <button key={batch.id} onClick={() => void addHandToBatch(h, batch.id)} className="block w-full truncate rounded px-2 py-1.5 text-left text-[9px] text-white/60 hover:bg-white/5">{batch.title}</button>)}<button onClick={() => void createBatchWithHand(h)} className="block w-full rounded px-2 py-1.5 text-left text-[9px] font-bold text-[#d4a52c] hover:bg-white/5">New Study Batch</button></div>}
                          <button onClick={() => { setActionMenuId(null); openNotesFor(h.hand_id ?? h.id); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] text-white/70 hover:bg-white/5"><FileText size={12} /> {canonicalNotes[h.hand_id ?? h.id]?.note_text ? 'Edit Note' : 'Add Note'}</button>
                          <button onClick={() => void toggleFlag(h.hand_id ?? h.id)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] text-white/70 hover:bg-white/5"><Flag size={12} /> {canonicalNotes[h.hand_id ?? h.id]?.is_flagged ? 'Remove Flag' : 'Flag for Review'}</button>
                          <button onClick={() => { navigator.clipboard.writeText(h.hand_id ?? h.id); setActionMenuId(null); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] text-white/70 hover:bg-white/5"><Copy size={12} /> Copy Hand ID</button>
                          <button onClick={() => { setActionMenuId(null); h.hand_id && playHand(h.hand_id); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] text-white/70 hover:bg-white/5"><ExternalLink size={12} /> Open in Workspace</button>
                          <button onClick={async () => { setActionMenuId(null); if (!h.hand_id) return; const result = await sendHandToWorkspace(h.hand_id); setWorkspaceToast(result.duplicate ? 'Hand is already in Workspace queue' : result.ok ? 'Hand sent to Workspace' : 'Could not send hand to Workspace'); setTimeout(() => setWorkspaceToast(null), 3000); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] text-white/70 hover:bg-white/5"><Send size={12} /> Send to Workspace</button>
                        </div>}
                      </div>
                    </div>
                  </div>


                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="flex items-center gap-1 text-[10px] font-medium text-white/40 transition-colors hover:text-white/60 disabled:opacity-30"
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <span className="text-[10px] text-white/30">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={currentPage >= totalPages}
                className="flex items-center gap-1 text-[10px] font-medium text-white/40 transition-colors hover:text-white/60 disabled:opacity-30"
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          )}
        </>
      )}
      {notesForHand && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={closeNotes}>
          <div className="w-full max-w-lg rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#d4a52c]" />
                <h2 className="text-sm font-semibold text-white">Hand Notes</h2>
                <span className="font-mono text-[10px] text-white/30">{notesForHand}</span>
              </div>
              <button onClick={closeNotes} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Write your analysis here..."
                maxLength={4000}
                className="min-h-32 w-full resize-y rounded-lg border border-white/10 bg-black/40 p-3 text-[12px] leading-relaxed text-white/80 placeholder:text-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-white/25">{noteDraft.length}/4000</span>
                <div className="flex gap-2">
                  <button onClick={closeNotes} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
                  <button onClick={() => void saveNote()} disabled={noteSaving} className="rounded-lg border border-[#d4a52c]/35 bg-[#c0911e]/15 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/25 disabled:opacity-50">{noteSaving ? 'Saving...' : 'Save Note'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
