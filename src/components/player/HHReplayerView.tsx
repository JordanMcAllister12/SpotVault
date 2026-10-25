import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, ChevronLeft, ChevronRight, ChevronDown, FileText, AlertCircle, Bookmark, Share2, Copy, Check, Coins, MoreVertical, Package, X, Flag, Trophy, List, Wrench, Archive, StickyNote, UploadCloud } from 'lucide-react';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import { buildReplayEvents, getSetupEvents, getPlaybackEvents } from '@/features/hh-replayer/replayEngine';
import type { NormalizedHand } from '@/features/hh-replayer/types';
import type { ReplayEvent } from '@/features/hh-replayer/replayEngine';
import { supabase } from '@/lib/supabase';
import { DEMO_REPLAYER_HANDS, DEMO_REPLAYER_HAND_LIST } from '@/data/demoContent';
import { fetchSavedHandIds, saveHand, unsaveHand } from '@/lib/handBookmarkStore';
import { fetchAllCanonicalNotes, saveCanonicalNote, toggleCanonicalFlag, type CanonicalHandNote } from '@/lib/canonicalHandNotes';
import { fetchBatches, addSingleHandToBatch, createBatch, addHandsToBatch, parseRawText, type HandBatch } from '@/lib/batchStore';
import { fetchHandShareRef, type HandShareRef } from '@/lib/handShareStore';
import { saveTournament } from '@/lib/savedTournamentStore';
import { listManualHands, findManualHand, type ManualHandRecord } from '@/lib/manualHandStore';
import { ShareHandModal } from '@/components/player/ShareHandModal';
import { SavedTournamentsPanel } from '@/components/player/SavedTournamentsPanel';
import { useDemo } from '@/useDemo';
import {
  type SortMode, type HandFilters, type PrimaryTab, type StorageSection,
  DEFAULT_FILTERS,
  UnifiedFilterBar, HandLibrarySourceDropdown, applyFilterToQuery,
} from '@/components/player/UnifiedFilters';

const GOLD = '#d4a52c';
const BORDER = 'rgba(255,255,255,0.08)';
const DARK_PANEL = 'rgba(8,7,6,0.88)';
const DARKER_PANEL = 'rgba(5,4,3,0.92)';

interface HandListItem {
  hand_id: string;
  played_at: string;
  blinds: string | null;
  position: string | null;
  net_result: number | null;
  pot_amount: number | null;
  showdown: boolean | null;
  tournament_id: string | null;
  hero_cards: string | null;
  title?: string;
  sortIndex?: number;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'initializing';

export function HHReplayerView({ userId, onOpenInWorkspace, initialBatchId, onBatchConsumed, initialHandId, onHandConsumed }: {
  userId?: string;
  onOpenInWorkspace?: (handId: string) => void;
  initialBatchId?: string | null;
  onBatchConsumed?: () => void;
  initialHandId?: string | null;
  onHandConsumed?: () => void;
}) {
  const { state } = useDemo();
  const account = state.currentAccount;
  const [handList, setHandList] = useState<HandListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);
  const [currentHand, setCurrentHand] = useState<NormalizedHand | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('initializing');
  const [listFetched, setListFetched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [filters, setFilters] = useState<HandFilters>({ ...DEFAULT_FILTERS });
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('current');
  const [storageSection, setStorageSection] = useState<StorageSection>('tournament_hh');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showRawInfo, setShowRawInfo] = useState(false);
  const [actionLogOpen, setActionLogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [listOffset, setListOffset] = useState(0);
  const [autoSelected, setAutoSelected] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'handlist' | 'tools' | 'storage'>('handlist');
  const [toolsSubTab, setToolsSubTab] = useState<'actions' | 'notes' | 'batch'>('notes');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaveState, setNoteSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [noteDirty, setNoteDirty] = useState(false);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importToast, setImportToast] = useState<string | null>(null);
  const [allBatches, setAllBatches] = useState<HandBatch[]>([]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [savedHandIds, setSavedHandIds] = useState<Set<string>>(new Set());
  const [canonicalNotes, setCanonicalNotes] = useState<Record<string, CanonicalHandNote>>({});
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareHandRef, setShareHandRef] = useState<HandShareRef | null>(null);
  const [copied, setCopied] = useState(false);
  const [rowMenuHandId, setRowMenuHandId] = useState<string | null>(null);
  const [tournamentMode, setTournamentMode] = useState<{ hands: NormalizedHand[]; name: string } | null>(null);
  const [tournamentHandIndex, setTournamentHandIndex] = useState(0);
  const [batches, setBatches] = useState<HandBatch[]>([]);
  const [batchModalHandId, setBatchModalHandId] = useState<string | null>(null);
  const [batchModalHandItem, setBatchModalHandItem] = useState<HandListItem | NormalizedHand | null>(null);
  const [batchAdding, setBatchAdding] = useState(false);
  const [batchToast, setBatchToast] = useState<string | null>(null);
  const [tournamentRowMenuIdx, setTournamentRowMenuIdx] = useState<number | null>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [tournamentMenuAnchor, setTournamentMenuAnchor] = useState<HTMLElement | null>(null);
  const [builtHands, setBuiltHands] = useState<ManualHandRecord[]>([]);
  const [builtHandsLoading, setBuiltHandsLoading] = useState(false);
  const [hhTitle, setHhTitle] = useState('');
  const [savingTournament, setSavingTournament] = useState(false);
  const PAGE_SIZE = 50;
  const fetchedIdRef = useRef<string | null>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveUserId = userId ?? account?.id;

  // Load saved hand IDs
  useEffect(() => {
    if (!effectiveUserId) return;
    void (async () => {
      const ids = await fetchSavedHandIds(effectiveUserId);
      setSavedHandIds(ids);
    })();
  }, [effectiveUserId]);

  // Cross-view favorites refresh: when another view (Workspace) saves/unsaves a hand,
  // re-fetch this view's saved set so the heart/bookmark state stays in sync.
  useEffect(() => {
    function onSavedHandChange(e: Event) {
      const detail = (e as CustomEvent).detail as { userId: string; handId: string; saved: boolean };
      if (!effectiveUserId || detail.userId !== effectiveUserId) return;
      setSavedHandIds((prev) => {
        const next = new Set(prev);
        if (detail.saved) next.add(detail.handId);
        else next.delete(detail.handId);
        return next;
      });
    }
    window.addEventListener('spotvault:saved-hand-changed', onSavedHandChange);
    return () => window.removeEventListener('spotvault:saved-hand-changed', onSavedHandChange);
  }, [effectiveUserId]);

  useEffect(() => {
    if (!effectiveUserId) return;
    void fetchAllCanonicalNotes(effectiveUserId).then((notes) => {
      setCanonicalNotes(Object.fromEntries(notes.map((note) => [note.hand_id, note])));
    });
  }, [effectiveUserId]);

  const fetchHandList = useCallback(async () => {
    if (!effectiveUserId) {
      setListFetched(true);
      setIsDemoMode(true);
      setHandList(DEMO_REPLAYER_HAND_LIST);
      return;
    }

    // Storage modes don't use the main hand list query
    if (primaryTab === 'storage' && (storageSection === 'tournament_hh' || storageSection === 'study_batches' || storageSection === 'built_hands')) {
      setListFetched(true);
      setHandList([]);
      setIsDemoMode(false);
      return;
    }

    // Favorites: fetch saved hands
    if (primaryTab === 'storage' && storageSection === 'favorites') {
      setLoadingList(true);
      const { data: savedRows, error: savedErr } = await supabase
        .from('sv_saved_hands')
        .select('hand_id, hand_user_id, saved_at')
        .eq('user_id', effectiveUserId)
        .order('saved_at', { ascending: false });

      setLoadingList(false);
      if (savedErr) { console.error('fetchSavedHands error:', savedErr.message); setListFetched(true); return; }
      if (!savedRows || savedRows.length === 0) {
        setHandList([]);
        setIsDemoMode(false);
        setListFetched(true);
        return;
      }

      const handIds = savedRows.map(r => (r as { hand_id: string }).hand_id);
      const selfHandIds = handIds.filter((_, i) => (savedRows[i] as { hand_user_id: string }).hand_user_id === effectiveUserId);

      let records: HandListItem[] = [];
      if (selfHandIds.length > 0) {
        const { data: handData, error: handErr } = await supabase
          .from('poker_hand_records')
          .select('hand_id, played_at, blinds, position, net_result, pot_amount, showdown, tournament_id, hero_cards')
          .eq('user_id', effectiveUserId)
          .in('hand_id', selfHandIds);
        if (handErr) { console.error('fetchSavedHandRecords error:', handErr.message); }
        if (handData) records = handData as HandListItem[];
      }

      records = applySort(records, sortMode);
      setHandList(records);
      setIsDemoMode(false);
      setListFetched(true);
      return;
    }

    // Current Load: server-side filtering via applyFilterToQuery
    setLoadingList(true);
    let query = supabase
      .from('poker_hand_records')
      .select('hand_id, played_at, blinds, position, net_result, pot_amount, showdown, tournament_id, hero_cards')
      .eq('user_id', effectiveUserId)
      .filter('hand_hash', 'not.like', '%-unknown-%')
      .filter('hand_hash', 'not.like', 'summary-%');

    query = applyFilterToQuery(query, filters);

    switch (sortMode) {
      case 'recent': query = query.order('played_at', { ascending: false }); break;
      case 'oldest': query = query.order('played_at', { ascending: true }); break;
      case 'biggest_pot': query = query.order('pot_amount', { ascending: false, nullsFirst: false }); break;
      case 'biggest_win': query = query.order('net_result', { ascending: false, nullsFirst: false }); break;
      case 'biggest_loss': query = query.order('net_result', { ascending: true, nullsFirst: false }); break;
      case 'biggest_stack': query = query.order('stack_size', { ascending: false, nullsFirst: false }); break;
    }

    query = query.range(listOffset, listOffset + PAGE_SIZE - 1);
    const { data, error } = await query;
    setLoadingList(false);
    if (error) { console.error('fetchHandList error:', error); setListFetched(true); return; }
    const list = (data ?? []) as HandListItem[];
    if (list.length === 0 && listOffset === 0) {
      setIsDemoMode(true);
      setHandList(DEMO_REPLAYER_HAND_LIST);
    } else {
      setHandList(list);
      setIsDemoMode(false);
    }
    setListFetched(true);
  }, [effectiveUserId, primaryTab, storageSection, filters, sortMode, listOffset]);

  useEffect(() => { fetchHandList(); }, [fetchHandList]);

  // Load built (manual) hands when the built_hands storage section is active
  useEffect(() => {
    if (primaryTab !== 'storage' || storageSection !== 'built_hands') return;
    let cancelled = false;
    setBuiltHandsLoading(true);
    void (async () => {
      const records = await listManualHands();
      if (!cancelled) {
        setBuiltHands(records);
        setBuiltHandsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [primaryTab, storageSection]);

  // Transition from initializing to idle only when the hand list has been
  // fetched AND auto-select has had its chance. Without the autoSelected guard,
  // there is a render where listFetched is true but selectedHandId is still null
  // — the EmptyState play-button screen flashes between the loading spinner and
  // the populated table.
  useEffect(() => {
    if (loadState === 'initializing' && listFetched && !selectedHandId) {
      if (handList.length > 0 && !autoSelected) return;
      setLoadState('idle');
    }
  }, [loadState, listFetched, selectedHandId, handList.length, autoSelected]);

  // Reset auto-select and pagination when filters/sort/tab/userId change.
  // Including effectiveUserId ensures that when the session restores after
  // mount (userId goes from undefined → real ID), the component re-initializes
  // instead of staying stuck on demo hands.
  useEffect(() => {
    setAutoSelected(false);
    setSelectedHandId(null);
    setListOffset(0);
    setListFetched(false);
    setLoadState('initializing');
    fetchedIdRef.current = null;
  }, [filters, sortMode, primaryTab, storageSection, effectiveUserId]);

  useEffect(() => {
    if (!autoSelected && handList.length > 0 && !selectedHandId) {
      setAutoSelected(true);
      setSelectedHandId(handList[0].hand_id);
    }
  }, [autoSelected, handList, selectedHandId]);

  useEffect(() => {
    setPrimaryTab(rightPanelTab === 'storage' ? 'storage' : 'current');
  }, [rightPanelTab]);

  useEffect(() => {
    if (!effectiveUserId) return;
    void fetchBatches(effectiveUserId).then(setAllBatches).catch(() => setAllBatches([]));
  }, [effectiveUserId]);

  useEffect(() => {
    const noteText = selectedHandId ? (canonicalNotes[selectedHandId]?.note_text ?? '') : '';
    setNoteDraft(noteText);
    setNoteDirty(false);
  }, [selectedHandId, canonicalNotes]);

  // Handle initialHandId from navigation (e.g. "Play in Workspace" from other views)
  useEffect(() => {
    if (!initialHandId) return;
    setSelectedHandId(initialHandId);
    onHandConsumed?.();
  }, [initialHandId, onHandConsumed]);

  // Handle initialBatchId — switch to storage tab with study_batches
  useEffect(() => {
    if (!initialBatchId) return;
    setRightPanelTab('storage');
    setStorageSection('study_batches');
    onBatchConsumed?.();
  }, [initialBatchId, onBatchConsumed]);

  const fetchHand = useCallback(async (handId: string) => {
    if (fetchedIdRef.current === handId) return;
    fetchedIdRef.current = handId;

    // Check demo hands first
    const demoHand = DEMO_REPLAYER_HANDS.find(h => h.handId === handId);
    if (demoHand) {
      setCurrentHand(demoHand);
      setLoadState('ready');
      return;
    }

    if (!effectiveUserId) { setLoadState('error'); setErrorMsg('No user ID available.'); return; }

    setLoadState('loading');
    setErrorMsg(null);

    const { data, error } = await supabase
      .from('poker_hand_records')
      .select('*, raw_hand_text')
      .eq('user_id', effectiveUserId)
      .eq('hand_id', handId)
      .maybeSingle();

    if (error) {
      console.error('fetchHand error:', error);
      setLoadState('error');
      setErrorMsg(`Database error: ${error.message}`);
      return;
    }

    if (!data) {
      // Try manual/built hands as fallback
      const manual = await findManualHand(handId);
      if (manual) {
        const nh = manual.normalized_hand;
        if (!nh.actions || nh.actions.length === 0) {
          setLoadState('error');
          setErrorMsg('Unable to replay this hand because action data is incomplete.');
          return;
        }
        setCurrentHand(nh);
        setLoadState('ready');
        return;
      }
      setLoadState('error');
      setErrorMsg('Hand not found in database.');
      return;
    }

    try {
      const normalized = phase2HandToNormalized(data as unknown as Phase2HandRecord);
      if (!normalized.actions || normalized.actions.length === 0) {
        setLoadState('error');
        setErrorMsg('Unable to replay this hand because action data is incomplete.');
        return;
      }
      setCurrentHand(normalized);
      setLoadState('ready');
    } catch (err) {
      console.error('Adapter error:', err);
      setLoadState('error');
      setErrorMsg(`Failed to parse hand: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [effectiveUserId]);

  // Tournament mode: load hand directly from tournament hands array
  useEffect(() => {
    if (tournamentMode && tournamentMode.hands.length > 0) {
      const hand = tournamentMode.hands[tournamentHandIndex];
      if (hand) {
        fetchedIdRef.current = hand.handId;
        setCurrentHand(hand);
        setLoadState('ready');
        return;
      }
    }
    if (selectedHandId) fetchHand(selectedHandId);
  }, [selectedHandId, fetchHand, tournamentMode, tournamentHandIndex]);

  // Loading failsafe
  useEffect(() => {
    if (loadState !== 'loading') {
      if (loadingTimerRef.current) { clearTimeout(loadingTimerRef.current); loadingTimerRef.current = null; }
      return;
    }
    loadingTimerRef.current = setTimeout(() => {
      setLoadState('error');
      setErrorMsg('Hand loading timed out. Please try again or select a different hand.');
    }, 5000);
    return () => { if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current); };
  }, [loadState]);

  const currentIndex = useMemo(() => {
    if (tournamentMode) return tournamentHandIndex;
    return handList.findIndex(h => h.hand_id === selectedHandId);
  }, [handList, selectedHandId, tournamentMode, tournamentHandIndex]);

  const goToHand = useCallback((direction: 'prev' | 'next') => {
    if (tournamentMode) {
      const newIdx = direction === 'prev' ? tournamentHandIndex - 1 : tournamentHandIndex + 1;
      if (newIdx >= 0 && newIdx < tournamentMode.hands.length) {
        setTournamentHandIndex(newIdx);
      }
      return;
    }
    if (currentIndex < 0) return;
    const newIdx = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIdx >= 0 && newIdx < handList.length) {
      setSelectedHandId(handList[newIdx].hand_id);
    }
  }, [currentIndex, handList, tournamentMode, tournamentHandIndex]);

  const filteredList = handList;

  const updateHandNote = useCallback(async (handId: string, noteText: string) => {
    if (!effectiveUserId) return;
    const ok = await saveCanonicalNote(effectiveUserId, handId, effectiveUserId, noteText);
    if (!ok) return;
    setCanonicalNotes((current) => ({
      ...current,
      [handId]: {
        ...(current[handId] ?? { id: '', created_at: new Date().toISOString() }),
        user_id: effectiveUserId,
        hand_id: handId,
        hand_user_id: effectiveUserId,
        note_text: noteText,
        is_flagged: current[handId]?.is_flagged ?? false,
        updated_at: new Date().toISOString(),
      },
    }));
  }, [effectiveUserId]);

  const toggleHandFlag = useCallback(async (handId: string) => {
    if (!effectiveUserId) return;
    const nextFlag = !canonicalNotes[handId]?.is_flagged;
    const ok = await toggleCanonicalFlag(effectiveUserId, handId, effectiveUserId, nextFlag);
    if (!ok) return;
    setCanonicalNotes((current) => ({
      ...current,
      [handId]: {
        ...(current[handId] ?? { id: '', created_at: new Date().toISOString(), note_text: '' }),
        user_id: effectiveUserId,
        hand_id: handId,
        hand_user_id: effectiveUserId,
        is_flagged: nextFlag,
        updated_at: new Date().toISOString(),
      },
    }));
  }, [canonicalNotes, effectiveUserId]);

  const handleImportFiles = useCallback(async (files: FileList) => {
    if (!effectiveUserId) { setImportToast('Sign in to import hands.'); setTimeout(() => setImportToast(null), 3000); return; }
    setImporting(true);
    try {
      const textParts: string[] = [];
      for (const file of Array.from(files)) {
        const text = await file.text();
        textParts.push(text);
      }
      const rawText = textParts.join('\n\n');
      const { rows, errors, duplicates } = parseRawText(rawText);
      if (rows.length === 0) { setImportToast('No hands found in file.'); setTimeout(() => setImportToast(null), 3000); setImporting(false); return; }
      const batch = await createBatch(effectiveUserId, `Imported ${new Date().toLocaleDateString()}`, 'file_upload', null, 'personal');
      if (!batch) { setImportToast('Failed to create batch.'); setTimeout(() => setImportToast(null), 3000); setImporting(false); return; }
      const result = await addHandsToBatch(batch.id, rows.filter(r => r.parsed_ok), 0);
      setImportToast(`Imported ${result.added} hands${duplicates > 0 ? `, ${duplicates} duplicates skipped` : ''}${errors > 0 ? `, ${errors} parse errors` : ''}`);
      setTimeout(() => setImportToast(null), 4000);
      void fetchBatches(effectiveUserId).then(setAllBatches).catch(() => setAllBatches([]));
    } catch {
      setImportToast('Import failed.'); setTimeout(() => setImportToast(null), 3000);
    }
    setImporting(false);
  }, [effectiveUserId]);

  const editHandNote = useCallback((handId: string) => {
    const existing = canonicalNotes[handId]?.note_text ?? '';
    const next = window.prompt('Hand note', existing);
    if (next !== null) void updateHandNote(handId, next.trim());
  }, [canonicalNotes, updateHandNote]);

  const onNoteChange = useCallback((text: string) => {
    setNoteDraft(text);
    setNoteDirty(true);
    setNoteSaveState('idle');
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(() => {
      if (!selectedHandId || !effectiveUserId) return;
      setNoteSaveState('saving');
      void updateHandNote(selectedHandId, text.trim()).then(() => {
        setNoteSaveState('saved');
        setNoteDirty(false);
        setTimeout(() => setNoteSaveState('idle'), 1500);
      });
    }, 1200);
  }, [selectedHandId, effectiveUserId, updateHandNote]);

  // Save/unsave handlers
  const isSaved = selectedHandId ? savedHandIds.has(selectedHandId) : false;

  const handleToggleSave = useCallback(async () => {
    if (!selectedHandId || !effectiveUserId) return;
    if (isSaved) {
      const ok = await unsaveHand(effectiveUserId, selectedHandId, effectiveUserId);
      if (ok) setSavedHandIds(prev => { const n = new Set(prev); n.delete(selectedHandId); return n; });
    } else {
      const ok = await saveHand(effectiveUserId, selectedHandId, effectiveUserId);
      if (ok) setSavedHandIds(prev => new Set(prev).add(selectedHandId));
    }
  }, [selectedHandId, effectiveUserId, isSaved]);

  // Share handler
  const handleShare = useCallback(async () => {
    if (!selectedHandId || !effectiveUserId) return;
    const ref = await fetchHandShareRef(selectedHandId, effectiveUserId);
    if (ref) {
      setShareHandRef(ref);
      setShareModalOpen(true);
    }
  }, [selectedHandId, effectiveUserId]);

  // Copy HH handler
  const handleCopyHH = useCallback(() => {
    if (!currentHand) return;
    const lines: string[] = [];
    lines.push(`Hand #${currentHand.handId}`);
    lines.push(`Site: ${currentHand.site}`);
    lines.push(`Game: ${currentHand.gameType}  Stakes: ${currentHand.stakes}`);
    lines.push(`Date: ${currentHand.date}`);
    if (currentHand.tableName) lines.push(`Table: ${currentHand.tableName}`);
    const hero = currentHand.players.find(p => p.isHero);
    if (hero) {
      lines.push(`Hero: ${hero.name} (${hero.position ?? '—'})${hero.holeCards ? ` [${hero.holeCards.join(' ')}]` : ''}`);
    }
    if (currentHand.board.flop.length > 0) {
      const boardStr = [
        ...currentHand.board.flop,
        currentHand.board.turn ?? '',
        currentHand.board.river ?? '',
      ].filter(Boolean).join(' ');
      lines.push(`Board: ${boardStr}`);
    }
    lines.push(`Pot: ${currentHand.pot.toLocaleString()}`);
    if (currentHand.winners.length > 0) {
      lines.push(`Winner(s): ${currentHand.winners.map(w => `${w.player} +${w.amount.toLocaleString()}`).join(', ')}`);
    }
    lines.push('');
    lines.push('Actions:');
    const events = buildReplayEvents(currentHand);
    const playback = getPlaybackEvents(events);
    for (const e of playback) {
      lines.push(`  [${e.street}] ${e.label}`);
    }
    lines.push('');
    lines.push('--- Raw ---');
    if (currentHand.rawText) {
      lines.push(currentHand.rawText);
    }

    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [currentHand]);

  // Update HH title when hand/tournament changes
  useEffect(() => {
    if (tournamentMode) setHhTitle(tournamentMode.name);
    else if (selectedHandId) setHhTitle(`Hand #${selectedHandId}`);
    else setHhTitle('');
  }, [selectedHandId, tournamentMode]);

  const handleSaveToTournaments = useCallback(async () => {
    if (!effectiveUserId || !currentHand) return;
    setSavingTournament(true);
    try {
      const handIds = tournamentMode
        ? tournamentMode.hands.map(h => h.handId)
        : handList.map(h => h.hand_id);
      if (handIds.length === 0) { setSavingTournament(false); return; }
      const { data } = await supabase
        .from('poker_hand_records')
        .select('raw_hand_text')
        .eq('user_id', effectiveUserId)
        .in('hand_id', handIds.slice(0, 200));
      const rawText = (data ?? [])
        .map((r) => (r as { raw_hand_text: string | null }).raw_hand_text)
        .filter(Boolean)
        .join('\n\n');
      if (!rawText) { setSavingTournament(false); return; }
      const result = await saveTournament(
        effectiveUserId,
        rawText,
        null,
        hhTitle.trim() || null,
      );
      if (result) {
        setBatchToast(`Saved "${hhTitle || result.name}" to Tournaments`);
      } else {
        setBatchToast('Failed to save tournament');
      }
      setTimeout(() => setBatchToast(null), 3000);
    } catch {
      setBatchToast('Failed to save tournament');
      setTimeout(() => setBatchToast(null), 3000);
    }
    setSavingTournament(false);
  }, [effectiveUserId, currentHand, tournamentMode, handList, hhTitle]);

  const formatDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatResult = (r: number | null) => {
    if (r === null) return '\u2014';
    const v = Number(r);
    const sign = v > 0 ? '+' : '';
    return `${sign}${v.toLocaleString()}`;
  };

  const formatResultBB = (r: number | null): string | null => {
    if (r === null) return null;
    const v = Number(r);
    if (isNaN(v)) return null;
    const sign = v > 0 ? '+' : '';
    return `${sign}${v.toFixed(1)} BB`;
  };

  const formatHeroCardsShort = (cards: string | null): string => {
    if (!cards) return '';
    const parts = cards.replace(/[[\]]/g, '').split(/\s+/).filter(Boolean);
    if (parts.length < 2) return '';
    const toShort = (c: string) => {
      const rank = c.slice(0, -1);
      const suit = c.slice(-1);
      const suitMap: Record<string, string> = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
      return `${rank}${suitMap[suit] ?? suit}`;
    };
    return parts.slice(0, 2).map(toShort).join(' ');
  };

  const resultColor = (r: number | null) => {
    if (r === null) return '#6b7280';
    return Number(r) > 0 ? '#4ade80' : Number(r) < 0 ? '#f87171' : '#9ca3af';
  };

  const formatPot = (p: number | null) => {
    if (p === null) return null;
    return Number(p).toLocaleString();
  };

  // Parse big blind from blinds string like "300/600" or "125,000/250,000"
  const parseBigBlind = (blinds: string | null): number | null => {
    if (!blinds) return null;
    const parts = blinds.split('/');
    if (parts.length < 2) return null;
    const bb = parseFloat(parts[1].replace(/,/g, ''));
    return isNaN(bb) || bb <= 0 ? null : bb;
  };

  const formatPotBB = (pot: number | null, blinds: string | null): string | null => {
    if (pot === null) return null;
    const bb = parseBigBlind(blinds);
    if (!bb) return null;
    const bbValue = Number(pot) / bb;
    return `${bbValue.toFixed(1)} BB`;
  };



  return (
    <div className="relative mx-auto max-w-7xl px-1 pt-1 pb-2 sm:px-5 sm:pt-2 sm:pb-3"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) void handleImportFiles(e.dataTransfer.files); }}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-[#d4a52c]/60 bg-[#d4a52c]/5">
          <div className="flex flex-col items-center gap-2">
            <UploadCloud size={32} style={{ color: GOLD }} />
            <p className="text-sm font-bold uppercase tracking-widest text-[#f5e6b0]">Drop Hand History to Import</p>
            {importing && <p className="text-[10px] text-white/50">Importing...</p>}
          </div>
        </div>
      )}
      {/* Unified header: title + hand nav + HH identifier */}
      <div className="hh-replayer-intro mb-2 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 backdrop-blur-md sm:mb-2.5 sm:px-4 sm:py-3"
        style={{ background: 'rgba(10,12,14,0.72)', border: '1px solid rgba(192,145,30,0.18)' }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9" style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))', border: '1px solid rgba(192,145,30,0.15)' }}>
          <Play className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.5} style={{ color: GOLD }} />
        </div>
        <div className="hidden sm:block">
          <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">HH Replayer</h2>
          <span className="text-[9px] font-mono tracking-[0.2em] uppercase sm:text-[10px]" style={{ color: 'rgba(192,145,30,0.6)' }}>Replay, review and study your hands</span>
        </div>
        {/* Hand navigation */}
        <div className="flex items-center gap-1.5 sm:ml-3">
          <button
            onClick={() => goToHand('prev')}
            disabled={currentIndex <= 0}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-all disabled:opacity-30 hover:bg-white/5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#9ca3af' }}
            title="Previous hand">
            <ChevronLeft size={14} />
          </button>
          <span className="text-[11px] font-medium text-white/60">
            {(tournamentMode || selectedHandId) ? `${currentIndex + 1}/${tournamentMode ? tournamentMode.hands.length : handList.length}` : '—'}
          </span>
          <button
            onClick={() => goToHand('next')}
            disabled={currentIndex < 0 || currentIndex >= handList.length - 1}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-all disabled:opacity-30 hover:bg-white/5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#9ca3af' }}
            title="Next hand">
            <ChevronRight size={14} />
          </button>
        </div>
        {/* Right side: action buttons + HH identifier + demo badge */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => {
              const demo = DEMO_REPLAYER_HANDS[0];
              if (demo) {
                fetchedIdRef.current = demo.handId;
                setCurrentHand(demo);
                setSelectedHandId(demo.handId);
                setIsDemoMode(true);
                setTournamentMode(null);
                setLoadState('ready');
                setAutoSelected(true);
              }
            }}
            title="Load Demo Hand"
            className="flex h-7 items-center gap-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-2 text-[9px] font-bold uppercase tracking-wider text-[#f5e6b0] transition-all hover:scale-[1.05] hover:bg-[#c0911e]/20">
            <Play size={11} /> Demo
          </button>
          {currentHand && loadState === 'ready' && !isDemoMode && !tournamentMode && (
            <>
              <button
                onClick={handleToggleSave}
                title="Save"
                className="flex h-7 w-7 items-center justify-center rounded-md transition-all hover:scale-[1.05]"
                style={{
                  border: `1px solid ${isSaved ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  background: isSaved ? 'rgba(201,162,39,0.12)' : 'transparent',
                  color: isSaved ? '#d4a52c' : '#8a93a2',
                }}>
                {isSaved ? <Bookmark size={13} fill="#d4a52c" /> : <Bookmark size={13} />}
              </button>
              <button
                onClick={handleShare}
                title="Share Hand"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/8 bg-transparent text-[#8a93a2] transition-all hover:scale-[1.05]"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <Share2 size={13} />
              </button>
              <button
                onClick={handleCopyHH}
                title="Copy HH"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/8 bg-transparent text-[#8a93a2] transition-all hover:scale-[1.05]"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                {copied ? <Check size={13} style={{ color: '#4ade80' }} /> : <Copy size={13} />}
              </button>
            </>
          )}
          {tournamentMode ? (
            <span className="flex items-center gap-1.5">
              <span className="max-w-[120px] truncate text-[10px] font-bold text-[#d4a52c] sm:max-w-none" title={tournamentMode.name}>
                {tournamentMode.name}
              </span>
              <button
                onClick={() => { setTournamentMode(null); setTournamentHandIndex(0); }}
                className="flex h-5 w-5 items-center justify-center rounded transition-all hover:bg-white/5"
                title="Exit tournament"
                style={{ color: '#6b7280' }}>×</button>
            </span>
          ) : selectedHandId && (
            <span className="max-w-[120px] truncate text-[10px] font-mono text-white/40 sm:max-w-none" title={selectedHandId}>
              #{selectedHandId}
            </span>
          )}
          {isDemoMode && (
            <span className="rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10 px-2 py-0.5 text-[8px] font-bold tracking-widest text-[#d4a52c] uppercase sm:text-[9px]">
              Demo
            </span>
          )}
        </div>
      </div>

      {/* Mobile layout: stacked; Desktop: two-column */}
      <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-[1fr_320px] lg:gap-3">
        {/* Main area: Replayer */}
        <div className="flex flex-col gap-1.5">

          {/* Dark Replayer panel */}
          <div className="overflow-visible rounded-xl border p-1 sm:p-3 lg:p-4 min-h-[420px] lg:min-h-[580px]" style={{ borderColor: 'rgba(192,145,30,0.12)', background: DARKER_PANEL, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 12px 40px -16px rgba(0,0,0,0.7)' }}>
            {/* Editable HH title + Save to Tournaments */}
            {currentHand && loadState === 'ready' && (
              <div className="mb-1 flex items-center gap-2 border-b border-white/5 px-1 py-1.5 sm:mb-2">
                <input
                  value={hhTitle}
                  onChange={(e) => setHhTitle(e.target.value)}
                  placeholder="Hand History Title"
                  className="min-w-0 flex-1 bg-transparent text-[11px] font-medium text-white/70 outline-none placeholder:text-white/25 sm:text-[12px]"
                />
                <button
                  onClick={handleSaveToTournaments}
                  disabled={savingTournament}
                  className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-40"
                  style={{ borderColor: 'rgba(192,145,30,0.3)', color: '#d4a52c', background: 'rgba(192,145,30,0.08)' }}>
                  <Trophy size={11} />
                  <span className="hidden sm:inline">{savingTournament ? 'Saving...' : 'Save HH to Tournaments'}</span>
                  <span className="sm:hidden">{savingTournament ? '...' : 'Save'}</span>
                </button>
              </div>
            )}
            {loadState === 'initializing' ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 lg:min-h-[500px]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
                <span className="text-[12px] text-white/40">Loading...</span>
              </div>
            ) : loadState === 'loading' && !currentHand ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 lg:min-h-[500px]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
                <span className="text-[12px] text-white/40">Loading hand...</span>
              </div>
            ) : loadState === 'error' ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center lg:min-h-[500px]">
                <AlertCircle className="mb-3 h-10 w-10" style={{ color: '#f59e0b' }} strokeWidth={1.5} />
                <h3 className="mb-1 text-base font-bold text-white">Unable to replay hand</h3>
                <p className="mb-1 text-[11px] font-mono text-white/40">Hand ID: {selectedHandId ?? 'unknown'}</p>
                <p className="mb-4 max-w-sm text-[12px] leading-relaxed text-white/50">{errorMsg ?? 'Unknown error'}</p>
                <button
                  onClick={() => { if (selectedHandId) { fetchedIdRef.current = null; fetchHand(selectedHandId); } }}
                  className="rounded-lg border px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all hover:scale-105"
                  style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
                  Try Again
                </button>
              </div>
            ) : currentHand && (loadState === 'ready' || loadState === 'loading') ? (
              <div className="overflow-visible replayer-fade-in">
                <HHReplayer hand={currentHand} variant="embedded" visualSize="main" standaloneLayout fitToContainer onActionChange={setCurrentStep} />
              </div>
            ) : (
              <EmptyState onSelectHand={(id) => setSelectedHandId(id)} handList={filteredList} />
            )}
          </div>

          {/* Action log + details — desktop only on mobile, hidden to reduce vertical chrome */}
          {currentHand && loadState === 'ready' && (
            <>
              <div className="hidden rounded-lg border lg:block" style={{ borderColor: BORDER, background: DARK_PANEL }}>
                <button
                  onClick={() => setActionLogOpen(o => !o)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white/40 transition-colors hover:text-white/60">
                  <span>Action Log</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${actionLogOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                </button>
                {actionLogOpen && (
                  <div className="px-3 pb-3">
                    <ActionLog hand={currentHand} currentStep={currentStep} />
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowRawInfo(s => !s)}
                className="hidden items-center gap-2 text-[11px] font-medium text-white/40 transition-colors hover:text-white/60 lg:flex">
                <FileText size={12} /> {showRawInfo ? 'Hide' : 'Show'} hand details
              </button>
              {showRawInfo && (
                <div className="hidden rounded-lg border p-3 lg:block" style={{ borderColor: BORDER, background: DARK_PANEL }}>
                  <HandDetails hand={currentHand} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Right panel: Hand selector — collapsible on mobile, always expanded on desktop */}
        <div className="flex flex-col gap-1.5 lg:gap-2">
          <div className="rounded-xl border p-2 backdrop-blur-md" style={{ borderColor: 'rgba(212,165,44,0.18)', background: 'rgba(10,12,14,0.55)' }}>
            {/* Three-tab selector */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setRightPanelTab('handlist')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition ${rightPanelTab === 'handlist' ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/60'}`}>
                <List size={11} /> Hand List
              </button>
              <button
                onClick={() => setRightPanelTab('tools')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition ${rightPanelTab === 'tools' ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/60'}`}>
                <Wrench size={11} /> Tools
              </button>
              <button
                onClick={() => setRightPanelTab('storage')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition ${rightPanelTab === 'storage' ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/60'}`}>
                <Archive size={11} /> Storage
              </button>
            </div>
            {/* Contextual sub-header per tab */}
            {rightPanelTab === 'handlist' && (
              <div className="mt-1.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="shrink-0 text-[9px] text-white/35">{loadingList ? '...' : `${filteredList.length} hands`}</span>
                </div>
                <UnifiedFilterBar filters={filters} setFilters={setFilters} sortMode={sortMode} setSortMode={setSortMode} totalCount={filteredList.length} loading={loadingList} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
              </div>
            )}
            {rightPanelTab === 'storage' && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <HandLibrarySourceDropdown
                  value={storageSection}
                  onChange={(next) => { setStorageSection(next); }}
                />
                <span className="shrink-0 text-[9px] text-white/35">{loadingList ? '...' : `${filteredList.length}h`}</span>
              </div>
            )}
          </div>

          {/* Right panel content — tools tab vs hand list/storage */}
          {rightPanelTab === 'tools' ? (
            <div className="flex flex-col gap-2">
              {/* Tools sub-tabs */}
              <div className="flex items-center gap-0.5 rounded-lg border p-1" style={{ borderColor: BORDER, background: DARK_PANEL }}>
                <button onClick={() => setToolsSubTab('notes')} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition ${toolsSubTab === 'notes' ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/60'}`}>
                  <StickyNote size={11} /> Notes
                </button>
                <button onClick={() => setToolsSubTab('actions')} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition ${toolsSubTab === 'actions' ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/60'}`}>
                  <Wrench size={11} /> Actions
                </button>
                <button onClick={() => setToolsSubTab('batch')} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition ${toolsSubTab === 'batch' ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/60'}`}>
                  <Package size={11} /> Batch
                </button>
              </div>

              {/* Notes sub-tab */}
              {toolsSubTab === 'notes' && (
                <div className="rounded-lg border p-3" style={{ borderColor: BORDER, background: DARK_PANEL }}>
                  {selectedHandId && currentHand ? (
                    <>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Hand Notes</span>
                        <button
                          onClick={() => void toggleHandFlag(selectedHandId)}
                          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[8px] font-bold uppercase tracking-wider transition"
                          style={{
                            borderColor: canonicalNotes[selectedHandId]?.is_flagged ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)',
                            color: canonicalNotes[selectedHandId]?.is_flagged ? '#fca5a5' : '#8a93a2',
                            background: canonicalNotes[selectedHandId]?.is_flagged ? 'rgba(239,68,68,0.08)' : 'transparent',
                          }}>
                          <Flag size={11} /> {canonicalNotes[selectedHandId]?.is_flagged ? 'Unflag' : 'Flag'}
                        </button>
                      </div>
                      <textarea
                        value={noteDraft}
                        onChange={(e) => onNoteChange(e.target.value)}
                        placeholder="Notes for this hand..."
                        className="h-40 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-2.5 text-[10px] leading-relaxed text-white/80 placeholder-white/20 focus:border-[#d4a52c]/40 focus:outline-none"
                      />
                      <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: BORDER }}>
                        {noteDirty ? (
                          <span className="text-[8px] font-semibold text-amber-300/70">Unsaved changes</span>
                        ) : noteSaveState === 'saved' ? (
                          <span className="flex items-center gap-1 text-[8px] font-semibold text-emerald-400/80"><Check size={10} /> Saved</span>
                        ) : noteSaveState === 'saving' ? (
                          <span className="text-[8px] text-white/30">Saving...</span>
                        ) : (
                          <span className="text-[8px] text-white/20">Auto-saved</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="py-6 text-center text-[11px] text-white/40">Select a hand to add notes.</p>
                  )}
                </div>
              )}

              {/* Actions sub-tab */}
              {toolsSubTab === 'actions' && (
                <div className="flex flex-col gap-1.5 rounded-lg border p-3" style={{ borderColor: BORDER, background: DARK_PANEL }}>
                  <button
                    onClick={handleToggleSave}
                    disabled={!currentHand || isDemoMode || !!tournamentMode}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[10px] font-medium text-white/70 transition hover:bg-white/5 disabled:opacity-30"
                    style={{ borderColor: isSaved ? 'rgba(201,162,39,0.3)' : 'rgba(255,255,255,0.08)', background: isSaved ? 'rgba(201,162,39,0.08)' : 'transparent' }}>
                    <Bookmark size={13} style={{ color: isSaved ? '#d4a52c' : '#8a93a2' }} fill={isSaved ? '#d4a52c' : 'none'} />
                    {isSaved ? 'Unsave Hand' : 'Save Hand'}
                  </button>
                  <button onClick={handleShare} disabled={!currentHand || isDemoMode} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[10px] font-medium text-white/70 transition hover:bg-white/5 disabled:opacity-30" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <Share2 size={13} style={{ color: '#8a93a2' }} /> Share Hand
                  </button>
                  <button onClick={handleCopyHH} disabled={!currentHand} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[10px] font-medium text-white/70 transition hover:bg-white/5 disabled:opacity-30" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    {copied ? <Check size={13} style={{ color: '#4ade80' }} /> : <Copy size={13} style={{ color: '#8a93a2' }} />}
                    {copied ? 'Copied!' : 'Copy Hand History'}
                  </button>
                  <button
                    onClick={() => { if (selectedHandId) void toggleHandFlag(selectedHandId); }}
                    disabled={!currentHand}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[10px] font-medium text-white/70 transition hover:bg-white/5 disabled:opacity-30"
                    style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <Flag size={13} style={{ color: selectedHandId && canonicalNotes[selectedHandId]?.is_flagged ? '#fca5a5' : '#8a93a2' }} />
                    {selectedHandId && canonicalNotes[selectedHandId]?.is_flagged ? 'Remove Flag' : 'Flag for Review'}
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedHandId || !effectiveUserId) return;
                      setBatchModalHandId(selectedHandId);
                      setBatchModalHandItem(currentHand);
                      fetchBatches(effectiveUserId).then(setBatches).catch(() => setBatches([]));
                    }}
                    disabled={!currentHand}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[10px] font-medium text-white/70 transition hover:bg-white/5 disabled:opacity-30"
                    style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <Package size={13} style={{ color: '#8a93a2' }} /> Add to Study Batch
                  </button>
                  <button onClick={handleSaveToTournaments} disabled={!currentHand || savingTournament} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[10px] font-medium text-white/70 transition hover:bg-white/5 disabled:opacity-30" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <Trophy size={13} style={{ color: '#8a93a2' }} />
                    {savingTournament ? 'Saving...' : 'Save to Tournaments'}
                  </button>
                </div>
              )}

              {/* Batch sub-tab */}
              {toolsSubTab === 'batch' && (
                <div className="rounded-lg border p-3" style={{ borderColor: BORDER, background: DARK_PANEL }}>
                  <p className="py-6 text-center text-[11px] text-white/40">Batch management coming soon. Use Actions to add hands to a batch.</p>
                </div>
              )}
            </div>
          ) : primaryTab === 'storage' && storageSection === 'tournament_hh' && !tournamentMode ? (
            <SavedTournamentsPanel
              userId={effectiveUserId ?? ''}
              onOpenTournament={(hands, name) => {
                const sorted = [...hands].sort((a, b) => {
                  const da = new Date(a.date).getTime() || 0;
                  const db = new Date(b.date).getTime() || 0;
                  if (da !== db) return da - db;
                  return a.handId.localeCompare(b.handId);
                });
                setTournamentMode({ hands: sorted, name });
                setTournamentHandIndex(0);
                fetchedIdRef.current = sorted[0]?.handId ?? null;
                setCurrentHand(sorted[0] ?? null);
                setLoadState(sorted[0] ? 'ready' : 'idle');
              }}
            />
          ) : primaryTab === 'storage' && storageSection === 'study_batches' ? (
            <div className="flex flex-col gap-1.5 rounded-lg border p-2" style={{ borderColor: BORDER, background: DARK_PANEL, maxHeight: '56vh' }}>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 px-3 py-3 text-[10px] font-medium text-white/40 transition hover:border-[#d4a52c]/40 hover:text-white/60">
                <UploadCloud size={14} /> Import Hand History (.txt)
                <input type="file" accept=".txt,.text" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) void handleImportFiles(e.target.files); e.target.value = ''; }} />
              </label>
              {allBatches.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-white/40">No study batches yet. Import a hand history or drag a file in to create one.</p>
              ) : (
                <div className="flex flex-col gap-1 overflow-y-auto">
                  {allBatches.map((b) => (
                    <div key={b.id} className="group relative rounded-lg border px-2.5 py-2 transition-all hover:scale-[1.02]" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <button onClick={() => onOpenInWorkspace?.(b.id)} className="w-full text-left">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-[11px] font-bold text-white/80">{b.title}</span>
                            <span className="text-[9px] text-white/35">{b.hand_count ?? 0} hands</span>
                          </div>
                          <Package size={14} className="shrink-0 text-white/25" />
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : primaryTab === 'storage' && storageSection === 'built_hands' ? (
            <div className="flex flex-col gap-1 overflow-y-auto rounded-lg border p-1.5 lg:gap-1.5 lg:p-2" style={{ borderColor: BORDER, background: DARK_PANEL, maxHeight: '56vh' }}>
              {builtHandsLoading && <div className="py-3 text-center text-[11px] text-white/40">Loading built hands...</div>}
              {!builtHandsLoading && builtHands.length === 0 && (
                <div className="py-8 text-center text-[11px] text-white/40">
                  No built hands yet. Use the Hand Builder to create one.
                </div>
              )}
              {builtHands.map((r) => {
                const nh = r.normalized_hand;
                const isSel = selectedHandId === r.hand_id;
                const hero = nh.players.find(p => p.isHero);
                const heroCardsShort = hero?.holeCards && hero.holeCards.length >= 2
                  ? hero.holeCards.slice(0, 2).map(c => { const rn = c.slice(0,-1); const s = c.slice(-1); const m: Record<string,string> = {s:'\u2660',h:'\u2665',d:'\u2666',c:'\u2663'}; return rn + (m[s]??s); }).join(' ')
                  : '';
                const heroPos = hero?.position ?? '';
                const bbResult = formatResultBBFromHand(nh);
                const stakes = nh.stakes || '';
                const bIsSaved = savedHandIds.has(r.hand_id);
                return (
                  <div
                    key={r.id}
                    className="group relative rounded-lg border px-2.5 py-2 text-left transition-all hover:scale-[1.02] lg:px-3 lg:py-2.5"
                    style={{
                      background: isSel ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.025)',
                      border: `1px solid ${isSel ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      boxShadow: isSel ? '0 0 12px rgba(201,162,39,0.15)' : 'none',
                    }}>
                    <button
                      onClick={() => {
                        fetchedIdRef.current = r.hand_id;
                        setCurrentHand(nh);
                        setSelectedHandId(r.hand_id);
                        setLoadState('ready');
                      }}
                      className="w-full text-left">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            {bIsSaved && <Bookmark size={9} fill="#d4a52c" style={{ color: '#d4a52c' }} className="shrink-0" />}
                            {heroCardsShort && <span className="text-[11px] font-bold text-white/80">{heroCardsShort}</span>}
                            {heroPos && <span className="text-[9px] font-semibold uppercase" style={{ color: '#8a93a2' }}>{heroPos}</span>}
                            {canonicalNotes[r.hand_id]?.note_text && <FileText size={10} className="text-[#d4a52c]" title="Has note" />}
                            {canonicalNotes[r.hand_id]?.is_flagged && <Flag size={10} className="text-red-300" fill="currentColor" title="Flagged for review" />}
                          </div>
                          <span className="truncate text-[9px] font-mono text-white/40">{r.hand_id}</span>
                          {nh.title && <span className="truncate text-[9px] text-white/30">{nh.title}</span>}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          {bbResult ? (
                            <span className="text-[12px] font-bold font-mono" style={{ color: resultColorFromHand(nh) }}>{bbResult}</span>
                          ) : (
                            <span className="text-[12px] font-bold font-mono" style={{ color: '#6b7280' }}>{"\u2014"}</span>
                          )}
                          <span className="text-[8px] text-white/25">{formatDate(r.created_at)}</span>
                        </div>
                      </div>
                      {stakes && (
                        <div className="mt-1 flex items-center gap-2 text-[8px] text-white/25">
                          <span>{stakes}</span>
                        </div>
                      )}
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!effectiveUserId) return;
                        if (bIsSaved) {
                          await unsaveHand(effectiveUserId, r.hand_id, effectiveUserId);
                          setSavedHandIds(prev => { const n = new Set(prev); n.delete(r.hand_id); return n; });
                        } else {
                          await saveHand(effectiveUserId, r.hand_id, effectiveUserId);
                          setSavedHandIds(prev => new Set(prev).add(r.hand_id));
                        }
                      }}
                      className="absolute right-1 bottom-1 flex h-6 w-6 items-center justify-center rounded transition hover:bg-white/10"
                      title={bIsSaved ? 'Unsave hand' : 'Save hand'}>
                      <Bookmark size={13} fill={bIsSaved ? '#d4a52c' : 'none'} style={{ color: bIsSaved ? '#d4a52c' : 'rgba(255,255,255,0.25)' }} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (rowMenuHandId === r.hand_id) {
                          setRowMenuHandId(null);
                          setRowMenuAnchor(null);
                        } else {
                          setRowMenuHandId(r.hand_id);
                          setRowMenuAnchor(e.currentTarget);
                        }
                      }}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-white/20 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white/60"
                      title="More options">
                      <MoreVertical size={11} />
                    </button>
                    {rowMenuHandId === r.hand_id && rowMenuAnchor && createPortal(
                      <HandActionMenuPortal
                        anchor={rowMenuAnchor}
                        onClose={() => { setRowMenuHandId(null); setRowMenuAnchor(null); }}
                        actions={[
                          { icon: <Copy size={11} />, label: 'Copy Hand ID', onClick: () => {
                            void navigator.clipboard?.writeText(r.hand_id);
                            setRowMenuHandId(null); setRowMenuAnchor(null);
                          }},
                          { icon: <FileText size={11} />, label: 'Add Note / Edit Note', onClick: () => { editHandNote(r.hand_id); setRowMenuHandId(null); setRowMenuAnchor(null); } },
                          { icon: <Flag size={11} />, label: canonicalNotes[r.hand_id]?.is_flagged ? 'Remove Flag' : 'Flag for Review', onClick: () => { void toggleHandFlag(r.hand_id); setRowMenuHandId(null); setRowMenuAnchor(null); } },
                          { icon: <Package size={11} />, label: 'Add to Study Batch', onClick: () => {
                            if (!effectiveUserId) { setRowMenuHandId(null); setRowMenuAnchor(null); return; }
                            setBatchModalHandId(r.hand_id);
                            setBatchModalHandItem(r);
                            fetchBatches(effectiveUserId).then(setBatches).catch(() => setBatches([]));
                            setRowMenuHandId(null); setRowMenuAnchor(null);
                          }},
                        ]}
                      />,
                      document.body
                    )}
                  </div>
                );
              })}
            </div>
          ) : tournamentMode ? (
            <div className="flex flex-col gap-1 overflow-y-auto rounded-lg border p-1.5 lg:gap-1.5 lg:p-2" style={{ borderColor: BORDER, background: DARK_PANEL, maxHeight: '56vh' }}>
              {tournamentMode.hands.map((h, i) => {
                const isSelected = i === tournamentHandIndex;
                const tIsSaved = savedHandIds.has(h.handId);
                const hero = h.players.find(p => p.isHero);
                const heroCardsShort = hero?.holeCards && hero.holeCards.length >= 2
                  ? hero.holeCards.slice(0, 2).map(c => { const r = c.slice(0,-1); const s = c.slice(-1); const m: Record<string,string> = {s:'\u2660',h:'\u2665',d:'\u2666',c:'\u2663'}; return r + (m[s]??s); }).join(' ')
                  : '';
                const heroPos = hero?.position ?? '';
                const bbResult = formatResultBBFromHand(h);
                const stakes = h.stakes || '';
                const potVal = h.pot > 0 ? h.pot.toLocaleString() : null;
                const hasShowdown = h.players.some(p => p.showdownCards && p.showdownCards.length >= 2);
                return (
                  <div
                    key={h.handId}
                    className="group relative rounded-lg border px-2.5 py-2 text-left transition-all hover:scale-[1.02] lg:px-3 lg:py-2.5"
                    style={{
                      background: isSelected ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.025)',
                      border: `1px solid ${isSelected ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      boxShadow: isSelected ? '0 0 12px rgba(201,162,39,0.15)' : 'none',
                    }}>
                    <button
                      onClick={() => setTournamentHandIndex(i)}
                      className="w-full text-left">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            {tIsSaved && <Bookmark size={9} fill="#d4a52c" style={{ color: '#d4a52c' }} className="shrink-0" />}
                            {heroCardsShort && <span className="text-[11px] font-bold text-white/80">{heroCardsShort}</span>}
                            {heroPos && <span className="text-[9px] font-semibold uppercase" style={{ color: '#8a93a2' }}>{heroPos}</span>}
                            {canonicalNotes[h.handId]?.note_text && <FileText size={10} className="text-[#d4a52c]" title="Has note" />}
                            {canonicalNotes[h.handId]?.is_flagged && <Flag size={10} className="text-red-300" fill="currentColor" title="Flagged for review" />}
                          </div>
                          <span className="truncate text-[9px] font-mono text-white/40">{h.handId}</span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          {bbResult ? (
                            <span className="text-[12px] font-bold font-mono" style={{ color: resultColorFromHand(h) }}>{bbResult}</span>
                          ) : (
                            <span className="text-[12px] font-bold font-mono" style={{ color: '#6b7280' }}>{"\u2014"}</span>
                          )}
                          <span className="text-[8px] text-white/25">{formatDate(h.date)}</span>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[8px] text-white/25">
                        {stakes && <span>{stakes}</span>}
                        {potVal && (
                          <span className="flex items-center gap-0.5">
                            <Coins size={8} /> {potVal}
                          </span>
                        )}
                        {hasShowdown && <span className="text-blue-400/40">Showdown</span>}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (tournamentRowMenuIdx === i) {
                          setTournamentRowMenuIdx(null);
                          setTournamentMenuAnchor(null);
                        } else {
                          setTournamentRowMenuIdx(i);
                          setTournamentMenuAnchor(e.currentTarget);
                        }
                      }}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-white/20 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white/60"
                      title="More options">
                      <MoreVertical size={11} />
                    </button>
                    {tournamentRowMenuIdx === i && tournamentMenuAnchor && createPortal(
                      <HandActionMenuPortal
                        anchor={tournamentMenuAnchor}
                        onClose={() => { setTournamentRowMenuIdx(null); setTournamentMenuAnchor(null); }}
                        actions={[
                          { icon: <Bookmark size={11} />, label: tIsSaved ? 'Unsave' : 'Save Hand', onClick: async () => {
                            if (!effectiveUserId) return;
                            if (tIsSaved) {
                              await unsaveHand(effectiveUserId, h.handId, effectiveUserId);
                              setSavedHandIds(prev => { const n = new Set(prev); n.delete(h.handId); return n; });
                            } else {
                              await saveHand(effectiveUserId, h.handId, effectiveUserId);
                              setSavedHandIds(prev => new Set(prev).add(h.handId));
                            }
                            setTournamentRowMenuIdx(null); setTournamentMenuAnchor(null);
                          }},
                          { icon: <FileText size={11} />, label: 'Add Note / Edit Note', onClick: () => { editHandNote(h.handId); setTournamentRowMenuIdx(null); setTournamentMenuAnchor(null); } },
                          { icon: <Flag size={11} />, label: canonicalNotes[h.handId]?.is_flagged ? 'Remove Flag' : 'Flag for Review', onClick: () => { void toggleHandFlag(h.handId); setTournamentRowMenuIdx(null); setTournamentMenuAnchor(null); } },
                          { icon: <Package size={11} />, label: 'Add to Study Batch', onClick: () => {
                            if (!effectiveUserId) { setTournamentRowMenuIdx(null); setTournamentMenuAnchor(null); return; }
                            setBatchModalHandId(h.handId);
                            setBatchModalHandItem(h);
                            fetchBatches(effectiveUserId).then(setBatches).catch(() => setBatches([]));
                            setTournamentRowMenuIdx(null); setTournamentMenuAnchor(null);
                          }},
                        ]}
                      />,
                      document.body
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
          <div className="flex flex-col gap-1 overflow-y-auto rounded-lg border p-1.5 lg:gap-1.5 lg:p-2" style={{ borderColor: BORDER, background: DARK_PANEL, maxHeight: '56vh' }}>
            {loadingList && <div className="py-3 text-center text-[11px] text-white/40">Loading...</div>}
            {!loadingList && filteredList.length === 0 && (
              <div className="py-6 text-center text-[11px] text-white/40 lg:py-8">
                {primaryTab === 'storage' && storageSection === 'favorites' ? 'No saved hands yet. Bookmark a hand to see it here.' : 'No hands found'}
              </div>
            )}
            {filteredList.map(h => {
              const isSelected = selectedHandId === h.hand_id;
              const hIsSaved = savedHandIds.has(h.hand_id);
              const heroCardsShort = formatHeroCardsShort(h.hero_cards);
              const bbResult = formatResultBB(h.net_result);
              return (
                <div
                  key={h.hand_id}
                  className="group relative rounded-lg border px-2.5 py-2 text-left transition-all hover:scale-[1.02] lg:px-3 lg:py-2.5"
                  style={{
                    background: isSelected ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${isSelected ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: isSelected ? '0 0 12px rgba(201,162,39,0.15)' : 'none',
                  }}>
                  <button
                    onClick={() => setSelectedHandId(h.hand_id)}
                    className="w-full text-left">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          {heroCardsShort && <span className="text-[11px] font-bold text-white/80">{heroCardsShort}</span>}
                          {h.position && <span className="text-[9px] font-semibold uppercase" style={{ color: '#8a93a2' }}>{h.position}</span>}
                          {canonicalNotes[h.hand_id]?.note_text && <FileText size={10} className="text-[#d4a52c]" title="Has note" />}
                          {canonicalNotes[h.hand_id]?.is_flagged && <Flag size={10} className="text-red-300" fill="currentColor" title="Flagged for review" />}
                        </div>
                        <span className="truncate text-[9px] font-mono text-white/40">{h.hand_id}</span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        {bbResult ? (
                          <span className="text-[12px] font-bold font-mono" style={{ color: resultColor(h.net_result) }}>{bbResult}</span>
                        ) : (
                          <span className="text-[12px] font-bold font-mono" style={{ color: resultColor(h.net_result) }}>{formatResult(h.net_result)}</span>
                        )}
                        <span className="text-[8px] text-white/25">{formatDate(h.played_at)}</span>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[8px] text-white/25">
                      {h.blinds && <span>{h.blinds}</span>}
                      {formatPot(h.pot_amount) && (
                        <span className="flex items-center gap-0.5">
                          <Coins size={8} /> {formatPot(h.pot_amount)}
                        </span>
                      )}
                      {h.showdown && <span className="text-blue-400/40">Showdown</span>}
                    </div>
                  </button>
                  {/* Bookmark toggle — always visible */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!effectiveUserId) return;
                      if (hIsSaved) {
                        await unsaveHand(effectiveUserId, h.hand_id, effectiveUserId);
                        setSavedHandIds(prev => { const n = new Set(prev); n.delete(h.hand_id); return n; });
                      } else {
                        await saveHand(effectiveUserId, h.hand_id, effectiveUserId);
                        setSavedHandIds(prev => new Set(prev).add(h.hand_id));
                      }
                    }}
                    className="absolute right-1 bottom-1 flex h-6 w-6 items-center justify-center rounded transition hover:bg-white/10"
                    title={hIsSaved ? 'Unsave hand' : 'Save hand'}>
                    <Bookmark size={13} fill={hIsSaved ? '#d4a52c' : 'none'} style={{ color: hIsSaved ? '#d4a52c' : 'rgba(255,255,255,0.25)' }} />
                  </button>
                  {/* Hover/tap ••• menu */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (rowMenuHandId === h.hand_id) {
                        setRowMenuHandId(null);
                        setRowMenuAnchor(null);
                      } else {
                        setRowMenuHandId(h.hand_id);
                        setRowMenuAnchor(e.currentTarget);
                      }
                    }}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-white/20 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white/60"
                    title="More options">
                    <MoreVertical size={11} />
                  </button>
                  {rowMenuHandId === h.hand_id && rowMenuAnchor && createPortal(
                    <HandActionMenuPortal
                      anchor={rowMenuAnchor}
                      onClose={() => { setRowMenuHandId(null); setRowMenuAnchor(null); }}
                      actions={[
                        { icon: <Bookmark size={11} />, label: hIsSaved ? 'Unsave' : 'Save Hand', onClick: async () => {
                          if (!effectiveUserId) return;
                          if (hIsSaved) {
                            await unsaveHand(effectiveUserId, h.hand_id, effectiveUserId);
                            setSavedHandIds(prev => { const n = new Set(prev); n.delete(h.hand_id); return n; });
                          } else {
                            await saveHand(effectiveUserId, h.hand_id, effectiveUserId);
                            setSavedHandIds(prev => new Set(prev).add(h.hand_id));
                          }
                          setRowMenuHandId(null); setRowMenuAnchor(null);
                        }},
                        { icon: <Copy size={11} />, label: 'Copy HH', onClick: () => {
                          if (!currentHand || currentHand.handId !== h.hand_id) { setSelectedHandId(h.hand_id); }
                          setTimeout(() => handleCopyHH(), 100);
                          setRowMenuHandId(null); setRowMenuAnchor(null);
                        }},
                        { icon: <FileText size={11} />, label: 'Add Note / Edit Note', onClick: () => { editHandNote(h.hand_id); setRowMenuHandId(null); setRowMenuAnchor(null); } },
                        { icon: <Flag size={11} />, label: canonicalNotes[h.hand_id]?.is_flagged ? 'Remove Flag' : 'Flag for Review', onClick: () => { void toggleHandFlag(h.hand_id); setRowMenuHandId(null); setRowMenuAnchor(null); } },
                        { icon: <Package size={11} />, label: 'Add to Study Batch', onClick: () => {
                          if (!effectiveUserId) { setRowMenuHandId(null); setRowMenuAnchor(null); return; }
                          setBatchModalHandId(h.hand_id);
                          setBatchModalHandItem(h);
                          fetchBatches(effectiveUserId).then(setBatches).catch(() => setBatches([]));
                          setRowMenuHandId(null); setRowMenuAnchor(null);
                        }},
                      ]}
                    />,
                    document.body
                  )}
                </div>
              );
            })}
          </div>
          )}

          {/* Pagination */}
          {rightPanelTab !== 'tools' && !isDemoMode && !(primaryTab === 'storage' && (storageSection === 'favorites' || storageSection === 'tournament_hh' || storageSection === 'study_batches' || storageSection === 'built_hands')) && !tournamentMode && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setListOffset(o => Math.max(0, o - PAGE_SIZE))}
                disabled={listOffset === 0}
                className="text-[10px] font-medium text-white/40 transition-colors hover:text-white/60 disabled:opacity-30">
                {"\u2190 Newer"}
              </button>
              <span className="text-[10px] text-white/30">{listOffset + 1}{"\u2013"}{listOffset + filteredList.length}</span>
              <button
                onClick={() => setListOffset(o => o + PAGE_SIZE)}
                disabled={filteredList.length < PAGE_SIZE}
                className="text-[10px] font-medium text-white/40 transition-colors hover:text-white/60 disabled:opacity-30">
                Older {"\u2192"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add to Batch Modal */}
      {batchModalHandId && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4" onClick={() => { setBatchModalHandId(null); setBatchModalHandItem(null); }}>
          <div className="w-full max-w-sm rounded-xl border p-4" style={{ borderColor: 'rgba(212,165,44,0.2)', background: '#0d0f12' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Package size={16} style={{ color: GOLD }} /> Add to Batch
              </h3>
              <button onClick={() => { setBatchModalHandId(null); setBatchModalHandItem(null); }} className="text-white/30 hover:text-white/60">
                <X size={16} />
              </button>
            </div>
            <p className="mb-3 truncate text-[10px] font-mono text-white/40">Hand: {batchModalHandId}</p>
            {batches.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-white/40">No batches yet. Create a batch in the Workspace first.</p>
            ) : (
              <div className="flex flex-col gap-1.5" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                {batches.map((b) => (
                  <button
                    key={b.id}
                    disabled={batchAdding}
                    onClick={async () => {
                      if (!batchModalHandId) return;
                      setBatchAdding(true);
                      const handObj = batchModalHandItem as Record<string, unknown>;
                      const isNormalized = !('hand_id' in handObj) && 'handId' in handObj;
                      const handForRpc = isNormalized
                        ? {
                            hand_id: (handObj as { handId: string }).handId,
                            position: (handObj as { position?: string | null }).position ?? null,
                            hero_cards: (handObj as { heroCards?: string | null }).heroCards ?? null,
                            net_result: (handObj as { netResult?: number | null }).netResult ?? null,
                            blinds: (handObj as { blinds?: string | null }).blinds ?? null,
                            pot_amount: (handObj as { potAmount?: number | null }).potAmount ?? null,
                            tournament_id: (handObj as { tournamentId?: string | null }).tournamentId ?? null,
                            played_at: (handObj as { date?: string }).date ?? null,
                            showdown: (handObj as { showdown?: boolean }).showdown ?? false,
                          }
                        : {
                            hand_id: (handObj as { hand_id: string }).hand_id,
                            position: (handObj as { position?: string | null }).position ?? null,
                            hero_cards: (handObj as { hero_cards?: string | null }).hero_cards ?? null,
                            net_result: (handObj as { net_result?: number | null }).net_result ?? null,
                            blinds: (handObj as { blinds?: string | null }).blinds ?? null,
                            pot_amount: (handObj as { pot_amount?: number | null }).pot_amount ?? null,
                            tournament_id: (handObj as { tournament_id?: string | null }).tournament_id ?? null,
                            played_at: (handObj as { played_at?: string }).played_at ?? null,
                            showdown: (handObj as { showdown?: boolean }).showdown ?? false,
                          };
                      const result = await addSingleHandToBatch(b.id, handForRpc);
                      setBatchAdding(false);
                      if (result.ok) {
                        setBatchToast(`Added to "${b.title}"`);
                      } else {
                        setBatchToast(result.error ?? 'Failed to add hand');
                      }
                      setBatchModalHandId(null);
                      setBatchModalHandItem(null);
                      setTimeout(() => setBatchToast(null), 3000);
                    }}
                    className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all hover:scale-[1.02] disabled:opacity-40"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)' }}>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium text-white/80">{b.title}</span>
                      <span className="text-[9px] text-white/30">{b.hand_count ?? 0} hands</span>
                    </div>
                    <Package size={14} className="shrink-0 text-white/30" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Batch toast */}
      {batchToast && (
        <div className="fixed bottom-4 left-1/2 z-[310] -translate-x-1/2 rounded-lg border px-4 py-2 text-[11px] font-medium text-white shadow-2xl" style={{ borderColor: 'rgba(212,165,44,0.3)', background: '#0d0f12' }}>
          {batchToast}
        </div>
      )}

      {/* Import toast */}
      {importToast && (
        <div className="fixed bottom-12 left-1/2 z-[310] -translate-x-1/2 rounded-lg border px-4 py-2 text-[11px] font-medium text-white shadow-2xl" style={{ borderColor: 'rgba(212,165,44,0.3)', background: '#0d0f12' }}>
          {importToast}
        </div>
      )}

      {/* Share Hand Modal */}
      <ShareHandModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        handRef={shareHandRef}
        authorId={account?.id ?? effectiveUserId ?? ''}
        authorName={account?.name ?? 'Player'}
        authorRole={account?.role ?? 'member'}
      />
    </div>
  );
}

function formatResultBBFromHand(h: NormalizedHand): string | null {
  const hero = h.players.find(p => p.isHero);
  if (!hero) return null;
  const netResult = h.heroNetResult != null
    ? h.heroNetResult
    : (h.winners.find(w => w.player === hero.name)?.amount ?? 0);
  const bb = parseBigBlind(h.stakes);
  if (!bb || bb <= 0) {
    if (netResult === 0) return null;
    const sign = netResult > 0 ? '+' : '';
    return `${sign}${netResult.toLocaleString()}`;
  }
  const bbValue = netResult / bb;
  const sign = bbValue > 0 ? '+' : '';
  return `${sign}${bbValue.toFixed(1)} BB`;
}

function resultColorFromHand(h: NormalizedHand): string {
  const hero = h.players.find(p => p.isHero);
  if (!hero) return '#6b7280';
  const netResult = h.heroNetResult != null
    ? h.heroNetResult
    : (h.winners.find(w => w.player === hero.name)?.amount ?? 0);
  return netResult > 0 ? '#4ade80' : netResult < 0 ? '#f87171' : '#9ca3af';
}

function parseBigBlind(blinds: string): number | null {
  if (!blinds) return null;
  const parts = blinds.split('/');
  if (parts.length < 2) return null;
  const bb = parseFloat(parts[1].replace(/,/g, ''));
  return isNaN(bb) || bb <= 0 ? null : bb;
}

interface HandActionMenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function HandActionMenuPortal({ anchor, onClose, actions }: { anchor: HTMLElement; onClose: () => void; actions: HandActionMenuItem[] }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const MENU_WIDTH = 168;
  const MENU_MARGIN = 4;

  useEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const menuHeight = actions.length * 36 + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < menuHeight + MENU_MARGIN && spaceAbove > spaceBelow;
    const top = openUpward
      ? Math.max(MENU_MARGIN, rect.top - menuHeight - MENU_MARGIN)
      : rect.bottom + MENU_MARGIN;
    let left = rect.right - MENU_WIDTH;
    if (left < MENU_MARGIN) left = MENU_MARGIN;
    if (left + MENU_WIDTH > window.innerWidth - MENU_MARGIN) {
      left = window.innerWidth - MENU_WIDTH - MENU_MARGIN;
    }
    setPos({ top, left });
  }, [anchor, actions.length]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [anchor, onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[200]" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div
        ref={menuRef}
        className="fixed z-[201] w-40 rounded-lg border bg-[#0d0f12] py-1 shadow-2xl"
        style={{ borderColor: 'rgba(212,165,44,0.2)', top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => { a.onClick(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-medium text-white/70 hover:bg-white/5 hover:text-[#f5e6b0]">
            {a.icon} {a.label}
          </button>
        ))}
      </div>
    </>
  );
}

function applySort(list: HandListItem[], sort: SortMode): HandListItem[] {
  const sorted = [...list];
  if (sort === 'oldest') sorted.sort((a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime());
  else if (sort === 'biggest_pot') sorted.sort((a, b) => (Number(b.pot_amount) || 0) - (Number(a.pot_amount) || 0));
  else if (sort === 'biggest_win') sorted.sort((a, b) => (Number(b.net_result) || 0) - (Number(a.net_result) || 0));
  else if (sort === 'biggest_loss') sorted.sort((a, b) => (Number(a.net_result) || 0) - (Number(b.net_result) || 0));
  else sorted.sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
  return sorted;
}

function EmptyState({ onSelectHand, handList }: { onSelectHand: (id: string) => void; handList: HandListItem[] }) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center py-16 text-center lg:min-h-[680px]">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.08), rgba(192,145,30,0.02))', border: '1px solid rgba(192,145,30,0.12)' }}>
        <Play className="h-7 w-7" strokeWidth={1.5} style={{ color: 'rgba(192,145,30,0.5)' }} />
      </div>
      <h3 className="mb-1 text-base font-bold text-white">HH Replayer</h3>
      <p className="mb-6 max-w-xs text-[12px] leading-relaxed text-white/40">
        Replay any hand from your SpotVault database. Select a hand to begin.
      </p>
      {handList.length > 0 && (
        <div className="w-full max-w-sm">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Recent Hands</p>
          <div className="flex flex-col gap-1.5">
            {handList.slice(0, 5).map(h => (
              <button
                key={h.hand_id}
                onClick={() => onSelectHand(h.hand_id)}
                className="rounded-lg border px-3 py-2 text-left transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-white/70">{h.hand_id}</span>
                  <span className="text-[11px] font-bold font-mono" style={{ color: h.net_result != null && Number(h.net_result) > 0 ? '#4ade80' : h.net_result != null && Number(h.net_result) < 0 ? '#f87171' : '#6b7280' }}>
                    {h.net_result != null ? (Number(h.net_result) > 0 ? '+' : '') + Number(h.net_result).toLocaleString() : '\u2014'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionLog({ hand, currentStep }: { hand: NormalizedHand; currentStep: number }) {
  const allEvents = useMemo(() => buildReplayEvents(hand), [hand]);
  const setupEvents = useMemo(() => getSetupEvents(allEvents), [allEvents]);
  const playbackEvents = useMemo(() => getPlaybackEvents(allEvents), [allEvents]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentStep < 0 || !logRef.current) return;
    const container = logRef.current;
    const el = container.querySelector(`[data-event-idx="${currentStep}"]`) as HTMLElement | null;
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elTop = elRect.top - containerRect.top;
    const elBottom = elRect.bottom - containerRect.top;
    const containerHeight = container.clientHeight;
    let targetScroll = container.scrollTop;
    if (elTop < 0) {
      targetScroll = container.scrollTop + elTop - 4;
    } else if (elBottom > containerHeight) {
      targetScroll = container.scrollTop + (elBottom - containerHeight) + 4;
    }
    if (targetScroll !== container.scrollTop) {
      container.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }, [currentStep]);

  const eventColor = (e: ReplayEvent) => {
    if (e.type === 'deal_flop' || e.type === 'deal_turn' || e.type === 'deal_river') return '#34d399';
    if (e.type === 'showdown_reveal') return '#60a5fa';
    if (e.type === 'pot_award') return '#c9a227';
    if (e.type === 'hand_complete') return '#6b7280';
    if (e.type === 'hand_start') return '#6b7280';
    if (e.type === 'blind_post') return '#555568';
    if (e.actionType === 'fold') return '#f87171';
    if (e.actionType === 'raise' || e.actionType === 'bet') return '#fb923c';
    if (e.actionType === 'call') return '#34d399';
    if (e.actionType === 'allin') return '#fca5a5';
    return '#9ca3af';
  };

  const streetLabel = (e: ReplayEvent) => {
    if (e.type === 'deal_flop') return 'FLOP';
    if (e.type === 'deal_turn') return 'TURN';
    if (e.type === 'deal_river') return 'RIVER';
    if (e.type === 'showdown_reveal') return 'SHOW';
    if (e.type === 'pot_award') return 'WIN';
    if (e.type === 'hand_start') return 'START';
    if (e.type === 'hand_complete') return 'END';
    if (e.type === 'blind_post') return 'POST';
    return e.street;
  };

  return (
    <div>
      <div ref={logRef} className="flex flex-col gap-0.5" style={{ maxHeight: '240px', overflowY: 'auto' }}>
        {/* Setup events (antes/blinds) — shown as pre-history, always dimmed */}
        {setupEvents.map(e => (
          <div
            key={`setup-${e.index}`}
            data-event-idx={e.index}
            className="flex items-center gap-2 rounded px-2 py-1 text-[11px]"
            style={{ opacity: 0.4, borderLeft: '2px solid rgba(100,100,120,0.2)' }}>
            <span className="w-20 font-mono uppercase text-white/30 shrink-0">{streetLabel(e)}</span>
            <span className="font-medium" style={{ color: eventColor(e) }}>{e.label}</span>
          </div>
        ))}

        {/* Playback events — user navigates these */}
        {playbackEvents.map(e => {
          const isActive = e.index === currentStep;
          const isPast = e.index < currentStep;
          return (
            <div
              key={`play-${e.index}`}
              data-event-idx={e.index}
              className="flex items-center gap-2 rounded px-2 py-1 text-[11px] transition-all"
              style={{
                background: isActive ? 'rgba(201,162,39,0.12)' : 'transparent',
                borderLeft: isActive ? '2px solid #d4a52c' : '2px solid transparent',
                opacity: isPast ? 0.5 : 1,
              }}>
              <span className="w-20 font-mono uppercase text-white/30 shrink-0">{streetLabel(e)}</span>
              <span className="font-medium" style={{ color: eventColor(e) }}>{e.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HandDetails({ hand }: { hand: NormalizedHand }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
        <Detail label="Hand ID" value={hand.handId} />
        <Detail label="Site" value={hand.site} />
        <Detail label="Game" value={hand.gameType} />
        <Detail label="Stakes" value={hand.stakes} />
        <Detail label="Date" value={hand.date} />
        <Detail label="Tournament" value={hand.tableName} />
        <Detail label="Hero" value={hand.heroName} />
        <Detail label="Position" value={hand.players.find(p => p.isHero)?.position ?? '\u2014'} />
        <Detail label="Button" value={hand.buttonSeat > 0 ? `Seat ${hand.buttonSeat}` : '\u2014'} />
        <Detail label="Pot" value={hand.pot.toLocaleString()} />
        <Detail label="Players" value={String(hand.players.length)} />
        <Detail label="Actions" value={String(hand.actions.length)} />
      </div>
      {hand.winners.length > 0 && (
        <div className="mt-2 text-[11px]">
          <span className="font-semibold text-white/40">Winners: </span>
          {hand.winners.map(w => `${w.player === hand.heroName ? 'Hero' : w.player.slice(0, 8)} (+${w.amount.toLocaleString()})`).join(', ')}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-white/30">{label}</span>
      <span className="font-mono text-white/60">{value || '\u2014'}</span>
    </div>
  );
}
