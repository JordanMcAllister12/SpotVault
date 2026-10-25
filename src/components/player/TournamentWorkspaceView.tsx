import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trophy, Search, ChevronLeft, ChevronRight, Bookmark, BookmarkCheck,
  Flag, FlagOff, Plus, FileText, ArrowLeft, Play, Package, List,
  Coins, TrendingUp, TrendingDown, X, Check, ArrowUp, ArrowDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDemo } from '@/useDemo';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import type { NormalizedHand } from '@/features/hh-replayer/types';
import {
  fetchUserTournaments, fetchTournamentHands, fetchHandCount,
  type TournamentSummary, type TournamentHand,
} from '@/lib/tournamentStore';
import {
  fetchSavedHandIds, saveHand, unsaveHand,
} from '@/lib/handBookmarkStore';
import {
  fetchCanonicalHandNote, saveCanonicalNote, toggleCanonicalFlag,
  fetchAllCanonicalNotes, fetchFlaggedCanonicalNotes,
  type CanonicalHandNote,
} from '@/lib/canonicalHandNotes';
import { createHandPack, type HandPackEntry } from '@/lib/handPackStore';
import type { HandShareRef } from '@/lib/handShareStore';

const GOLD = 'var(--portal-accent, #d4a52c)';
const BORDER = 'rgba(var(--portal-accent-rgb, 212,165,44), 0.12)';
const DARK_PANEL = 'rgba(6, 8, 10, 0.55)';

type WorkspaceView = 'overview' | 'tournament' | 'saved' | 'create-pack';

export function TournamentWorkspaceView() {
  const { state } = useDemo();
  const account = state.currentAccount;
  const userId = account?.id;

  const [view, setView] = useState<WorkspaceView>('overview');
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [totalHands, setTotalHands] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [flaggedNotes, setFlaggedNotes] = useState<CanonicalHandNote[]>([]);

  // Tournament review state
  const [activeTournament, setActiveTournament] = useState<TournamentSummary | null>(null);
  const [tournamentHands, setTournamentHands] = useState<TournamentHand[]>([]);
  const [selectedHandIndex, setSelectedHandIndex] = useState(0);
  const [loadingHands, setLoadingHands] = useState(false);
  const [currentNormalized, setCurrentNormalized] = useState<NormalizedHand | null>(null);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [handNote, setHandNote] = useState<CanonicalHandNote | null>(null);
  const [isFlagged, setIsFlagged] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  // Create pack state
  const [packTitle, setPackTitle] = useState('');
  const [packDescription, setPackDescription] = useState('');
  const [packEntries, setPackEntries] = useState<Array<{
    hand_id: string;
    hand_user_id: string;
    creator_note: string;
    hero_cards: string | null;
    board: string | null;
    blinds: string | null;
    net_result: number | null;
    pot_amount: number | null;
    position: string | null;
    played_at: string | null;
    tournament_id: string | null;
  }>>([]);
  const [creatingPack, setCreatingPack] = useState(false);
  const [packCreated, setPackCreated] = useState(false);

  // Load tournaments and saved hands
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      setLoadingTournaments(true);
      const [tourns, count, ids, flagged] = await Promise.all([
        fetchUserTournaments(userId),
        fetchHandCount(userId),
        fetchSavedHandIds(userId),
        fetchFlaggedCanonicalNotes(userId),
      ]);
      setTournaments(tourns);
      setTotalHands(count);
      setSavedIds(ids);
      setFlaggedNotes(flagged);
      setLoadingTournaments(false);
    })();
  }, [userId]);

  // Open a tournament
  const openTournament = useCallback(async (t: TournamentSummary) => {
    if (!userId) return;
    setActiveTournament(t);
    setView('tournament');
    setLoadingHands(true);
    setSelectedHandIndex(0);
    const hands = await fetchTournamentHands(userId, t.tournament_id);
    setTournamentHands(hands);
    setLoadingHands(false);
  }, [userId]);

  // Load replay + note for selected hand
  useEffect(() => {
    if (view !== 'tournament' || !activeTournament || !userId || tournamentHands.length === 0) return;
    const hand = tournamentHands[selectedHandIndex];
    if (!hand) return;

    void (async () => {
      setLoadingReplay(true);
      setCurrentNormalized(null);

      // Fetch full hand record for replay
      const { data, error } = await supabase
        .from('poker_hand_records')
        .select('*, raw_hand_text')
        .eq('user_id', userId)
        .eq('hand_id', hand.hand_id)
        .maybeSingle();

      if (!error && data) {
        try {
          const normalized = phase2HandToNormalized(data as unknown as Phase2HandRecord);
          if (normalized.actions?.length > 0) {
            setCurrentNormalized(normalized);
          }
        } catch { /* parse error */ }
      }
      setLoadingReplay(false);

      // Load note + flag state
      const note = await fetchCanonicalHandNote(userId, hand.hand_id, userId);
      setHandNote(note);
      setNoteText(note?.note_text ?? '');
      setIsFlagged(note?.is_flagged ?? false);
    })();
  }, [view, activeTournament, userId, tournamentHands, selectedHandIndex]);

  // Debounced note save
  useEffect(() => {
    if (view !== 'tournament' || !userId || !activeTournament || tournamentHands.length === 0) return;
    if (noteText === (handNote?.note_text ?? '')) return;
    const timer = setTimeout(() => {
      if (!userId) return;
      setNoteSaving(true);
      void saveCanonicalNote(userId, tournamentHands[selectedHandIndex]?.hand_id ?? '', userId, noteText).then(() => {
        setNoteSaving(false);
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [noteText, view, userId, activeTournament, tournamentHands, selectedHandIndex, handNote]);

  // Toggle flag
  const handleToggleFlag = useCallback(async () => {
    if (!userId || !activeTournament || tournamentHands.length === 0) return;
    const hand = tournamentHands[selectedHandIndex];
    if (!hand) return;
    const newFlagged = !isFlagged;
    setIsFlagged(newFlagged);
    await toggleCanonicalFlag(userId, hand.hand_id, userId, newFlagged);
    // Refresh flagged list
    const flagged = await fetchFlaggedCanonicalNotes(userId);
    setFlaggedNotes(flagged);
  }, [userId, activeTournament, tournamentHands, selectedHandIndex, isFlagged]);

  // Toggle save (shared with HH Replayer)
  const handleToggleSave = useCallback(async () => {
    if (!userId || !activeTournament || tournamentHands.length === 0) return;
    const hand = tournamentHands[selectedHandIndex];
    if (!hand) return;
    if (savedIds.has(hand.hand_id)) {
      await unsaveHand(userId, hand.hand_id, userId);
      setSavedIds(prev => { const n = new Set(prev); n.delete(hand.hand_id); return n; });
    } else {
      await saveHand(userId, hand.hand_id, userId);
      setSavedIds(prev => new Set(prev).add(hand.hand_id));
    }
  }, [userId, activeTournament, tournamentHands, selectedHandIndex, savedIds]);

  // Add hand to pack entries
  const handleAddToPack = useCallback(() => {
    if (!activeTournament || tournamentHands.length === 0) return;
    const hand = tournamentHands[selectedHandIndex];
    if (!hand) return;
    if (packEntries.some(e => e.hand_id === hand.hand_id)) return;
    setPackEntries(prev => [...prev, {
      hand_id: hand.hand_id,
      hand_user_id: userId ?? '',
      creator_note: noteText,
      hero_cards: hand.hero_cards,
      board: hand.board,
      blinds: hand.blinds,
      net_result: hand.net_result,
      pot_amount: hand.pot_amount,
      position: hand.position,
      played_at: hand.played_at,
      tournament_id: hand.tournament_id,
    }]);
  }, [activeTournament, tournamentHands, selectedHandIndex, noteText, userId, packEntries]);

  // Create hand pack
  const handleCreatePack = useCallback(async () => {
    if (!userId || !account || !packTitle.trim() || packEntries.length === 0) return;
    setCreatingPack(true);
    const spotId = await createHandPack(
      userId,
      account.name,
      packTitle.trim(),
      packDescription.trim(),
      packEntries,
    );
    setCreatingPack(false);
    if (spotId) {
      setPackCreated(true);
      setTimeout(() => {
        setPackCreated(false);
        setPackTitle('');
        setPackDescription('');
        setPackEntries([]);
        setView('overview');
      }, 2000);
    }
  }, [userId, account, packTitle, packDescription, packEntries]);

  // Filtered hands for tournament review
  const filteredHands = useMemo(() => {
    if (!searchQuery.trim() && !showFlaggedOnly) return tournamentHands;
    const flaggedIds = new Set(flaggedNotes.map(n => n.hand_id));
    return tournamentHands.filter(h => {
      if (showFlaggedOnly && !flaggedIds.has(h.hand_id)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!h.hand_id.toLowerCase().includes(q) &&
            !(h.tournament_id ?? '').toLowerCase().includes(q) &&
            !(h.hero_cards ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tournamentHands, searchQuery, showFlaggedOnly, flaggedNotes]);

  // ── OVERVIEW VIEW ──────────────────────────────────────────────
  if (view === 'overview') {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pt-2 sm:px-6 sm:pt-3">
        <div className="mb-3 rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(212,165,44,0.15)', background: DARK_PANEL }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))', border: '1px solid rgba(192,145,30,0.15)' }}>
              <Trophy className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Tournament Workspace</h2>
              <span className="text-[10px] text-white/40">{totalHands.toLocaleString()} canonical hands · {tournaments.length} tournaments · {flaggedNotes.length} flagged · {savedIds.size} saved</span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setView('saved')}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-all"
            style={{ borderColor: 'rgba(192,145,30,0.2)', background: 'rgba(192,145,30,0.08)', color: GOLD }}
          >
            <Bookmark className="h-3 w-3" /> Saved ({savedIds.size})
          </button>
          <button
            onClick={() => setView('create-pack')}
            disabled={flaggedNotes.length === 0}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-all disabled:opacity-30"
            style={{ borderColor: 'rgba(192,145,30,0.2)', background: 'rgba(192,145,30,0.08)', color: GOLD }}
          >
            <Package className="h-3 w-3" /> Create Hand Pack ({packEntries.length})
          </button>
        </div>

        {/* Tournament list */}
        {loadingTournaments ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Trophy className="mb-3 h-10 w-10 text-white/15" strokeWidth={1.5} />
            <p className="text-sm text-white/50">No tournaments found.</p>
            <p className="mt-1 text-[11px] text-white/30">Import hands through Analytics to see tournaments here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tournaments.map(t => (
              <button
                key={t.tournament_id}
                onClick={() => openTournament(t)}
                className="rounded-xl border p-3 text-left transition-all hover:border-[#c0911e]/25 hover:scale-[1.01]"
                style={{ background: 'rgba(6, 8, 10, 0.55)', borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.15)' }}
              >
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-white">{t.site ?? 'Unknown'} #{t.tournament_id.slice(-6)}</p>
                    <p className="text-[9px] text-white/30">{t.hand_count} hands · {t.blinds ?? '—'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="text-[11px] font-bold font-mono" style={{ color: (t.net_result_sum ?? 0) > 0 ? '#4ade80' : '#f87171' }}>
                      {(t.net_result_sum ?? 0) > 0 ? '+' : ''}{(t.net_result_sum ?? 0).toFixed(1)}
                    </span>
                    {t.last_played && <span className="text-[8px] text-white/25">{new Date(t.last_played).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── SAVED VIEW ──────────────────────────────────────────────────
  if (view === 'saved') {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pt-2 sm:px-6 sm:pt-3">
        <button onClick={() => setView('overview')} className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/70">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
        </button>
        <div className="mb-3 rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(212,165,44,0.15)', background: DARK_PANEL }}>
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4" style={{ color: GOLD }} />
            <h2 className="text-sm font-bold text-white">Saved / Flagged Hands</h2>
            <span className="text-[10px] text-white/40">{savedIds.size} saved · {flaggedNotes.length} flagged</span>
          </div>
        </div>
        {flaggedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Flag className="mb-3 h-10 w-10 text-white/15" strokeWidth={1.5} />
            <p className="text-sm text-white/50">No flagged hands yet.</p>
            <p className="mt-1 text-[11px] text-white/30">Flag hands while reviewing a tournament to build a shortlist.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {flaggedNotes.map(n => (
              <div key={n.id} className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: BORDER, background: 'rgba(14,12,10,0.9)' }}>
                <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} fill={GOLD} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-mono text-white/70">{n.hand_id}</p>
                  {n.note_text && <p className="truncate text-[10px] text-white/40">{n.note_text}</p>}
                </div>
                <button
                  onClick={() => {
                    if (!userId) return;
                    void toggleCanonicalFlag(userId, n.hand_id, n.hand_user_id, false).then(() => {
                      setFlaggedNotes(prev => prev.filter(f => f.id !== n.id));
                    });
                  }}
                  className="text-[9px] text-white/30 hover:text-red-400/60"
                >
                  <FlagOff className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── CREATE PACK VIEW ────────────────────────────────────────────
  if (view === 'create-pack') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-2 sm:px-6 sm:pt-3">
        <button onClick={() => setView('overview')} className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/70">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
        </button>
        <div className="mb-3 rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(212,165,44,0.15)', background: DARK_PANEL }}>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" style={{ color: GOLD }} />
            <h2 className="text-sm font-bold text-white">Create Hand Pack</h2>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Title</label>
            <input
              value={packTitle}
              onChange={e => setPackTitle(e.target.value)}
              placeholder="e.g. Sunday Main — Deep Run Review"
              className="w-full rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-[12px] text-white/80 outline-none focus:border-[#c0911e]/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Description</label>
            <textarea
              value={packDescription}
              onChange={e => setPackDescription(e.target.value)}
              placeholder="Brief description of this hand pack..."
              rows={2}
              className="w-full resize-none rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-[12px] text-white/80 outline-none focus:border-[#c0911e]/30"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Selected Hands ({packEntries.length})</span>
            </div>
            {packEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 py-8 text-center">
                <Package className="mb-2 h-8 w-8 text-white/15" />
                <p className="text-[11px] text-white/40">Add hands to your pack by clicking "Add to Pack" while reviewing a tournament.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {packEntries.map((e, i) => (
                  <div key={e.hand_id} className="flex items-center gap-2 rounded-lg border p-2" style={{ borderColor: BORDER, background: 'rgba(14,12,10,0.9)' }}>
                    <span className="text-[10px] font-mono text-white/30">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-mono text-white/60">{e.hand_id}</p>
                      {e.hero_cards && <p className="text-[9px] text-white/30">Hero: {e.hero_cards}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPackEntries(prev => {
                          const next = [...prev];
                          if (i > 0) { [next[i-1], next[i]] = [next[i], next[i-1]]; }
                          return next;
                        })}
                        disabled={i === 0}
                        className="text-white/20 hover:text-white/50 disabled:opacity-20"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setPackEntries(prev => {
                          const next = [...prev];
                          if (i < next.length - 1) { [next[i+1], next[i]] = [next[i], next[i+1]]; }
                          return next;
                        })}
                        disabled={i === packEntries.length - 1}
                        className="text-white/20 hover:text-white/50 disabled:opacity-20"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setPackEntries(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-white/20 hover:text-red-400/60"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {packCreated && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-400">
              <Check className="inline h-3 w-3 mr-1" /> Hand Pack created! Find it in My Spots → CREATED.
            </div>
          )}

          <button
            onClick={handleCreatePack}
            disabled={!packTitle.trim() || packEntries.length === 0 || creatingPack}
            className="w-full rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/15 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#f5e6b0] transition-all hover:bg-[#c0911e]/25 disabled:opacity-30"
          >
            {creatingPack ? 'Creating...' : `Create Hand Pack (${packEntries.length} hands)`}
          </button>
        </div>
      </div>
    );
  }

  // ── TOURNAMENT REVIEW VIEW ──────────────────────────────────────
  if (view === 'tournament' && activeTournament) {
    const currentHand = tournamentHands[selectedHandIndex];
    const isSaved = currentHand ? savedIds.has(currentHand.hand_id) : false;

    return (
      <div className="mx-auto max-w-7xl px-1 pt-1 pb-2 sm:px-5 sm:pt-2 sm:pb-3">
        {/* Tournament header */}
        <div className="mb-2 flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: DARK_PANEL, border: `1px solid ${BORDER}` }}>
          <button onClick={() => setView('overview')} className="text-white/40 hover:text-white/70">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Trophy className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-white">{activeTournament.site ?? 'Tournament'} #{activeTournament.tournament_id.slice(-6)}</h2>
            <span className="text-[9px] text-white/30">{tournamentHands.length} hands · {activeTournament.blinds ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFlaggedOnly(f => !f)}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-semibold uppercase transition-all ${showFlaggedOnly ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#d4a52c]' : 'border-white/10 text-white/40'}`}
            >
              <Flag className="h-3 w-3" /> Flagged
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_280px] lg:gap-3">
          {/* Replayer + controls */}
          <div className="flex flex-col gap-2">
            {/* Nav bar */}
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: DARK_PANEL }}>
              <button onClick={() => setSelectedHandIndex(i => Math.max(0, i - 1))} disabled={selectedHandIndex <= 0} className="text-white/40 disabled:opacity-20">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-[11px] font-medium text-white/60">
                Hand {selectedHandIndex + 1} of {tournamentHands.length}
              </span>
              <button onClick={() => setSelectedHandIndex(i => Math.min(tournamentHands.length - 1, i + 1))} disabled={selectedHandIndex >= tournamentHands.length - 1} className="text-white/40 disabled:opacity-20">
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="ml-auto max-w-[100px] truncate text-[9px] font-mono text-white/30">{currentHand?.hand_id}</span>
            </div>

            {/* Replayer */}
            <div className="rounded-xl border p-2 sm:p-3" style={{ borderColor: 'rgba(192,145,30,0.12)', background: 'rgba(5,4,3,0.92)' }}>
              {loadingReplay ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
                  <span className="mt-2 text-[11px] text-white/40">Loading hand...</span>
                </div>
              ) : currentNormalized ? (
                <HHReplayer hand={currentNormalized} variant="embedded" visualSize="main" />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Play className="mb-2 h-8 w-8 text-white/15" strokeWidth={1.5} />
                  <p className="text-[12px] text-white/40">Unable to replay this hand.</p>
                </div>
              )}
            </div>

            {/* Flag + Save + Add to Pack */}
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: DARK_PANEL }}>
              <button
                onClick={handleToggleFlag}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold uppercase transition-all"
                style={{
                  borderColor: isFlagged ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.08)',
                  background: isFlagged ? 'rgba(201,162,39,0.12)' : 'transparent',
                  color: isFlagged ? GOLD : '#8a93a2',
                }}
              >
                {isFlagged ? <Flag className="h-3 w-3" fill={GOLD} /> : <Flag className="h-3 w-3" />}
                {isFlagged ? 'Flagged' : 'Flag'}
              </button>
              <button
                onClick={handleToggleSave}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold uppercase transition-all"
                style={{
                  borderColor: isSaved ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.08)',
                  background: isSaved ? 'rgba(201,162,39,0.12)' : 'transparent',
                  color: isSaved ? GOLD : '#8a93a2',
                }}
              >
                {isSaved ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                {isSaved ? 'Saved' : 'Save'}
              </button>
              <button
                onClick={handleAddToPack}
                disabled={packEntries.some(e => e.hand_id === currentHand?.hand_id)}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold uppercase transition-all disabled:opacity-30"
                style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#8a93a2' }}
              >
                <Plus className="h-3 w-3" />
                {packEntries.some(e => e.hand_id === currentHand?.hand_id) ? 'In Pack' : 'Add to Pack'}
              </button>
              {packEntries.length > 0 && (
                <button
                  onClick={() => setView('create-pack')}
                  className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold text-[#d4a52c] hover:underline"
                >
                  <Package className="h-3 w-3" /> Pack ({packEntries.length})
                </button>
              )}
            </div>

            {/* Note */}
            <div className="rounded-lg border p-3" style={{ borderColor: BORDER, background: DARK_PANEL }}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Creator Note</span>
                {noteSaving && <span className="text-[9px] text-white/20">saving...</span>}
              </div>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add a note for this hand..."
                rows={2}
                className="w-full resize-none rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-1.5 text-[11px] text-white/70 outline-none focus:border-[#c0911e]/30"
              />
            </div>
          </div>

          {/* Hand list */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: DARK_PANEL }}>
              <Search size={12} className="text-white/40" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent text-[11px] text-white/70 outline-none placeholder:text-white/20"
              />
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto rounded-lg border p-2" style={{ borderColor: BORDER, background: DARK_PANEL, maxHeight: '60vh' }}>
              {loadingHands ? (
                <div className="py-4 text-center text-[11px] text-white/40">Loading...</div>
              ) : filteredHands.length === 0 ? (
                <div className="py-8 text-center text-[11px] text-white/40">No hands found</div>
              ) : (
                filteredHands.map((h, idx) => {
                  const realIndex = tournamentHands.indexOf(h);
                  const isSelected = realIndex === selectedHandIndex;
                  const hIsSaved = savedIds.has(h.hand_id);
                  const hIsFlagged = flaggedNotes.some(n => n.hand_id === h.hand_id);
                  return (
                    <button
                      key={h.hand_id}
                      onClick={() => setSelectedHandIndex(realIndex)}
                      className="rounded-lg border px-3 py-2 text-left transition-all hover:scale-[1.01]"
                      style={{
                        background: isSelected ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.025)',
                        border: `1px solid ${isSelected ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            {hIsFlagged && <Flag size={8} fill={GOLD} style={{ color: GOLD }} className="shrink-0" />}
                            {hIsSaved && <Bookmark size={8} fill={GOLD} style={{ color: GOLD }} className="shrink-0" />}
                            <span className="truncate text-[9px] font-mono text-white/50">{h.hand_id}</span>
                          </div>
                          {h.hero_cards && <span className="text-[9px] text-white/30">{h.hero_cards}</span>}
                        </div>
                        <span className="shrink-0 text-[11px] font-bold font-mono" style={{ color: (h.net_result ?? 0) > 0 ? '#4ade80' : (h.net_result ?? 0) < 0 ? '#f87171' : '#6b7280' }}>
                          {h.net_result != null ? (h.net_result > 0 ? '+' : '') + Number(h.net_result).toFixed(1) : '—'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
