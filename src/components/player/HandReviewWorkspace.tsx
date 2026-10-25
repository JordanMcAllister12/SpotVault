import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Star, Send, AlertCircle, Layers, Check,
  StickyNote, MessageSquare, X,
  AudioLines, PanelLeft,
  MoreVertical, Copy, Link, Trash2, Edit2, Play, Plus, BookOpen, MapPin,
  Bookmark, CheckSquare, Square, ArrowUp, ArrowDown, Package,
  Sparkles, Save, Layers3, Pencil, Trophy,
  Mic, Video, Film, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  classifyHandRecord, applyFilters,
  formatHeroCards, formatResultBB, formatBoard, resultColor,
  type HandSorterFilters, type HandRecord, type ClassifiedHand,
} from '@/lib/handSorter';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import { ConstructHand } from '@/components/player/ConstructHand';
import { usePresentationRecorder } from '@/hooks/usePresentationRecorder';
import type { NormalizedHand, NormalizedAction } from '@/features/hh-replayer/types';
import { computeNetChipsFromActions, type ActionEntry } from '@/lib/pokerAnalytics';
import { listManualHands, deleteManualHand, renameManualHand, manualHandUrl, type ManualHandRecord } from '@/lib/manualHandStore';
import { getMyRelationships, type Relationship } from '@/lib/authEngine';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DEMO_REVIEW_HANDS, DEMO_REVIEW_SET } from '@/data/demoReviewHands';
import { canPublishJukebox, publishProduct, type ProductType } from '@/lib/jukeboxStore';
import type { TournamentBatch } from '@/lib/tournamentStore';
import {
  fetchMySpots, createNewSpot, saveDraft, updateExistingSpot,
  type ContentSpot,
} from '@/lib/contentLab';
import {
  fetchMyMultiSpotAnalyses, createMultiSpotAnalysis, setMsaEntries, fetchMsaEntries,
  type MsaEntryInput,
} from '@/lib/msaStore';
import {
  fetchSavedHandIds, saveHand, unsaveHand,
} from '@/lib/handBookmarkStore';
import {
  fetchBatchHands, renameBatch, updateBatchDescription,
  removeHandFromBatch, toggleMarkForCoach,
  fetchBatchInbox, markBatchEventRead,
  getSubmissionDetails, returnFeedback, sendFollowUp,
  loadAllHandNotes, saveStudentNote, saveCoachNote,
  fetchWorkingBatch, fetchWorkingBatchHands, createWorkingBatch,
  addHandToWorkingBatch, removeWorkingBatchHand, reorderWorkingBatchHands,
  addHandsToBatch,
  deleteWorkingBatch, saveWorkingBatchAsMultiSpot,
  createBatch, addSingleHandToBatch,
  type HandBatch, type BatchEvent,
  type SubmissionDetails, type HandNoteEntry,
  type WorkingBatchHand,
} from '@/lib/batchStore';
import {
  enrichHand, isInterestingHand,
} from '@/lib/handFilters';
import {
  type SortMode as UnifiedSortMode, type HandFilters as UnifiedHandFilters, type PrimaryTab, type StorageSection,
  DEFAULT_FILTERS as UNIFIED_DEFAULT_FILTERS, DARK_PANEL as UF_DARK_PANEL, BORDER as UF_BORDER,
  UnifiedFilterBar, StorageSearchBar, PrimaryNav,
  matchesUnifiedFilters, sortHandsByMode, hasActiveUnifiedFilters,
} from '@/components/player/UnifiedFilters';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';
const SECTION_BG = 'rgba(8,10,12,0.82)';
const RAIL_W = 280;  // px — expanded hand rail
const RAIL_W_COLLAPSED = 32; // px

const AVAILABLE_TAGS = [
  'QUESTION', 'PREFLOP', 'FLOP', 'TURN', 'RIVER', 'ICM', 'BET SIZE', 'BLUFF', 'VALUE', 'RANGE', 'REVIEW WITH COACH',
] as const;
type HandTag = typeof AVAILABLE_TAGS[number];

interface ReviewHand extends HandRecord {
  id: string;
  review_set_id: string;
  marked_for_coach: boolean;
  parsed_ok: boolean;
  parse_error: string | null;
  sort_order: number;
  hand_title: string | null;
  source?: 'constructed' | 'imported' | 'demo';
  normalizedHand?: NormalizedHand;
  hand_seq_index?: number | null;
}

const DEFAULT_FILTERS: HandSorterFilters = {
  primary: null,
  position: 'all',
  stack: 'all',
  tournament: 'all',
  result: 'all',
};

export interface HandReviewWorkspaceProps {
  coachId?: string;
  coachName?: string;
  onMessageCoach?: () => void;
  onHandCountChange?: (count: number) => void;
  currentBatch: HandBatch | null;
  batches: HandBatch[];
  onSelectBatch: (batch: HandBatch) => void;
  onBatchRenamed?: () => void;
  onReloadBatches?: () => void;
  onSaveLastViewedHand?: (handId: string | null, index: number | null) => void;
  constructSignal?: number;
  presentationMode?: boolean;
  onTogglePresentationMode?: () => void;
  initialHandId?: string | null;
  onHandConsumed?: () => void;
}

// Net result for constructed hands: hero winnings minus hero total contribution,
// using the canonical action-based accounting.
function computeConstructedNetResult(nh: NormalizedHand): number {
  const actions: ActionEntry[] = nh.actions.map((a: NormalizedAction) => ({
    street: a.street === 'showdown' ? 'river' : a.street,
    player: a.player,
    action: a.type === 'win' ? 'collect' : a.type === 'uncalled_return' ? 'uncalled' : a.type,
    amount: a.amount ?? null,
  }));
  const { netChips } = computeNetChipsFromActions(actions, nh.heroName);
  if (netChips !== null) return netChips;
  // Fallback: winners-based calculation
  const heroWinner = nh.winners.find((w) => w.player === nh.heroName);
  const heroWon = heroWinner ? heroWinner.amount : 0;
  const totalPot = nh.winners.reduce((s, w) => s + w.amount, 0);
  if (heroWinner) return heroWon - (totalPot - heroWon);
  return -totalPot;
}

// ────────────────────────────────────────────────────────────────────────────
// COMPACT HAND RAIL
// ────────────────────────────────────────────────────────────────────────────
type HandMenuAction = 'replay' | 'copyId' | 'copyLink' | 'save' | 'unsave' | 'addToBatch' | 'addToSpot' | 'addToMsa' | 'rename' | 'delete';

type RailMenuAction = { label: string; icon: ReactNode; onClick: () => void; danger?: boolean };

function HandRailActionMenu({ anchor, onClose, actions }: { anchor: HTMLElement; onClose: () => void; actions: RailMenuAction[] }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const MENU_WIDTH = 176;
  const MENU_MARGIN = 4;

  useEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const menuHeight = actions.length * 32 + 8;
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
        className="fixed z-[201] w-44 max-h-[70vh] overflow-y-auto rounded-lg border border-[#d4a52c]/25 bg-[#0d0f12] py-1 shadow-2xl"
        style={{ top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => a.onClick()}
            className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-medium transition hover:bg-white/5 ${a.danger ? 'text-red-300/80 hover:text-red-300' : 'text-white/70 hover:text-white'}`}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
    </>
  );
}

function HandRail({
  hands, classified, filteredHands,
  selectedHandIndex, onSelectHand,
  collapsed, onToggleCollapsed,
  onHandAction,
  savedHandIds,
  onBatchComplete,
  workingBatchHands, workingBatchCount,
  onSelectBatchHand, selectedBatchHandId,
  onReorderBatch, onRemoveFromBatch, onCreateBatch,
  onSaveBatch, onCompleteBatch,
  currentUserId,
  batches,
  onSelectBatch,
  onReloadBatches,
}: {
  hands: ReviewHand[];
  classified: ClassifiedHand[];
  filteredHands: ClassifiedHand[];
  selectedHandIndex: number;
  onSelectHand: (idx: number) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHandAction: (action: HandMenuAction, hand: ReviewHand) => void;
  savedHandIds: Set<string>;
  onBatchComplete: (selectedHands: ReviewHand[]) => Promise<void>;
  workingBatchHands: WorkingBatchHand[];
  workingBatchCount: number;
  onSelectBatchHand: (hand: WorkingBatchHand) => void;
  selectedBatchHandId: string | null;
  onReorderBatch: (orderedIds: string[]) => void;
  onRemoveFromBatch: (handRowId: string) => void;
  onCreateBatch: () => void;
  onSaveBatch: () => void;
  onCompleteBatch: () => void;
  currentUserId: string | null;
  batches: HandBatch[];
  onSelectBatch: (b: HandBatch) => void;
  onReloadBatches?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('current');
  const [storageSection, setStorageSection] = useState<StorageSection>('tournament_hh');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [storageMenuId, setStorageMenuId] = useState<string | null>(null);
  const [storageMenuAnchor, setStorageMenuAnchor] = useState<HTMLElement | null>(null);
  const [storageDeleteTarget, setStorageDeleteTarget] = useState<{ id: string; title: string; type: 'tournament' | 'batch' } | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Tournament sub-list: when in saved_tournaments mode, show tournament list first.
  // When a tournament is selected, we switch to showing its hands via current mode.
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  // Batch sub-list: when in saved_batches mode, show batch list first.
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Derive tournaments from batches (is_tournament flag)
  const tournaments = useMemo(() => batches.filter((b): b is TournamentBatch => (b as TournamentBatch).is_tournament === true), [batches]);

  // Batch selection state (existing saved-hand batch workflow)
  type BatchStep = 'none' | 'select' | 'order';
  const [batchStep, setBatchStep] = useState<BatchStep>('none');
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [batchOrder, setBatchOrder] = useState<string[]>([]);

  // ── Unified filters & sorting ──
  const [unifiedFilters, setUnifiedFilters] = useState<UnifiedHandFilters>({ ...UNIFIED_DEFAULT_FILTERS });
  const [sortMode, setSortMode] = useState<UnifiedSortMode>('recent');
  const [interestingActive, setInterestingActive] = useState(false);
  const [interestingThreshold, setInterestingThreshold] = useState(3);

  // ── Review pack selection (checkboxes) ──
  const [packSelectMode, setPackSelectMode] = useState(false);
  const [packSelected, setPackSelected] = useState<Set<string>>(new Set());
  const [packAction, setPackAction] = useState<'idle' | 'adding' | 'creating'>('idle');
  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [newPackName, setNewPackName] = useState('');
  const [packToast, setPackToast] = useState<string | null>(null);

  const constructedCount = useMemo(() => hands.filter((h) => h.source === 'constructed').length, [hands]);
  const tournamentCount = useMemo(() => hands.filter((h) => h.source !== 'constructed' && h.source !== 'demo').length, [hands]);
  const savedHands = useMemo(() => hands.filter((h) => savedHandIds.has(h.hand_id ?? h.id)), [hands, savedHandIds]);
  const savedCount = savedHands.length;

  // Enrich hands with filter-relevant classification data
  const enrichedMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof enrichHand>>();
    for (const h of hands) {
      const cls = classified.find((c) => (c as unknown as { handId?: string }).handId === h.hand_id);
      map.set(h.id, enrichHand(h, cls));
    }
    return map;
  }, [hands, classified]);

  const displayed = useMemo(() => {
    let result = filteredHands;
    // Primary tab + storage section filter
    const isBuiltMode = primaryTab === 'storage' && storageSection === 'built_hands';
    const isFavoritesMode = primaryTab === 'storage' && storageSection === 'favorites';
    const isBatchesMode = primaryTab === 'storage' && storageSection === 'study_batches';
    const isTournamentMode = primaryTab === 'storage' && storageSection === 'tournament_hh';

    if (isBuiltMode) {
      const ids = new Set(hands.filter((h) => h.source === 'constructed').map((h) => h.id));
      result = result.filter((h) => ids.has((h as unknown as ReviewHand).id));
    } else if (isFavoritesMode) {
      const savedIds = new Set(savedHands.map((h) => h.id));
      result = result.filter((h) => savedIds.has((h as unknown as ReviewHand).id));
    } else if (!isBatchesMode && !isTournamentMode) {
      // Current Load: exclude constructed hands
      const constructedIds = new Set(hands.filter((h) => h.source === 'constructed').map((h) => h.id));
      result = result.filter((h) => !constructedIds.has((h as unknown as ReviewHand).id));
    }
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((h) =>
        (h.hand_id ?? '').toLowerCase().includes(q) ||
        (h.position ?? '').toLowerCase().includes(q) ||
        (h.hero_cards ?? '').toLowerCase().includes(q)
      );
    }
    // Unified filters (Current Load only)
    if (primaryTab === 'current' && hasActiveUnifiedFilters(unifiedFilters)) {
      result = result.filter((h) => {
        const rh = (h as unknown as ReviewHand);
        const enriched = enrichedMap.get(rh.id);
        if (!enriched) return false;
        return matchesUnifiedFilters(enriched, unifiedFilters);
      });
    }
    // Interesting filter
    if (interestingActive) {
      result = result.filter((h) => {
        const rh = (h as unknown as ReviewHand);
        const enriched = enrichedMap.get(rh.id);
        if (!enriched) return false;
        return isInterestingHand(enriched, interestingThreshold);
      });
    }
    // Sort
    const asReviewHands = result.map((h) => {
      const rh = hands.find((hr) => hr.id === (h as unknown as ReviewHand).id);
      return rh ?? (h as unknown as ReviewHand);
    });
    const sorted = sortHandsByMode(asReviewHands, sortMode);
    // Map back to ClassifiedHand[]
    const sortedClassified = sorted.map((rh) => filteredHands.find((fc) => (fc as unknown as ReviewHand).id === rh.id)).filter(Boolean) as ClassifiedHand[];
    return sortedClassified;
  }, [filteredHands, primaryTab, storageSection, search, hands, unifiedFilters, sortMode, interestingActive, interestingThreshold, enrichedMap]);

  // Count of interesting hands in current mode (before sort)
  const interestingCount = useMemo(() => {
    let base = filteredHands;
    const isBuiltMode = primaryTab === 'storage' && storageSection === 'built_hands';
    const isFavoritesMode = primaryTab === 'storage' && storageSection === 'favorites';
    if (isBuiltMode) {
      const ids = new Set(hands.filter((h) => h.source === 'constructed').map((h) => h.id));
      base = base.filter((h) => ids.has((h as unknown as ReviewHand).id));
    } else if (isFavoritesMode) {
      const savedIds = new Set(savedHands.map((h) => h.id));
      base = base.filter((h) => savedIds.has((h as unknown as ReviewHand).id));
    } else {
      const constructedIds = new Set(hands.filter((h) => h.source === 'constructed').map((h) => h.id));
      base = base.filter((h) => !constructedIds.has((h as unknown as ReviewHand).id));
    }
    return base.filter((h) => {
      const rh = (h as unknown as ReviewHand);
      const enriched = enrichedMap.get(rh.id);
      if (!enriched) return false;
      return isInterestingHand(enriched, interestingThreshold);
    }).length;
  }, [filteredHands, primaryTab, storageSection, hands, enrichedMap, interestingThreshold]);

  // ── Review pack handlers ──
  const handlePackToggle = useCallback((rowId: string) => {
    setPackSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const handlePackSelectAll = useCallback(() => {
    setPackSelected(new Set(displayed.map((h) => (h as unknown as ReviewHand).id)));
  }, [displayed]);

  const handlePackDeselectAll = useCallback(() => {
    setPackSelected(new Set());
  }, []);

  const handleAddToExistingBatch = useCallback(async (batchId: string) => {
    setPackAction('adding');
    const selectedHands = hands.filter((h) => packSelected.has(h.id));
    let added = 0;
    for (const h of selectedHands) {
      const res = await addSingleHandToBatch(batchId, {
        hand_id: h.hand_id ?? h.id,
        raw_hand_text: h.raw_hand_text ?? '',
        position: h.position,
        hero_cards: h.hero_cards,
        board: h.board,
        net_result: h.net_result,
        stack_size: h.stack_size,
        blinds: h.blinds,
        pot_amount: h.pot_amount,
        site: h.site,
        game_mode: h.game_mode,
        tournament_id: h.tournament_id,
        played_at: h.played_at,
        saw_flop: h.saw_flop,
        saw_turn: h.saw_turn,
        saw_river: h.saw_river,
        showdown: h.showdown,
        hero_name: h.hero_name,
      });
      if (res.ok) added++;
    }
    setPackAction('idle');
    setShowBatchPicker(false);
    setPackToast(`Added ${added} hand${added !== 1 ? 's' : ''} to batch`);
    setPackSelected(new Set());
    setPackSelectMode(false);
    if (onReloadBatches) onReloadBatches();
    setTimeout(() => setPackToast(null), 3000);
  }, [hands, packSelected, onReloadBatches]);

  const handleCreateNewPack = useCallback(async () => {
    if (!currentUserId || packSelected.size === 0) return;
    setPackAction('creating');
    const title = newPackName.trim() || `Review Pack (${packSelected.size} hands)`;
    const batch = await createBatch(currentUserId, title, 'custom', null, 'personal');
    if (!batch) {
      setPackAction('idle');
      setPackToast('Failed to create pack');
      setTimeout(() => setPackToast(null), 3000);
      return;
    }
    const selectedHands = hands.filter((h) => packSelected.has(h.id));
    let added = 0;
    for (const h of selectedHands) {
      const res = await addSingleHandToBatch(batch.id, {
        hand_id: h.hand_id ?? h.id,
        raw_hand_text: h.raw_hand_text ?? '',
        position: h.position,
        hero_cards: h.hero_cards,
        board: h.board,
        net_result: h.net_result,
        stack_size: h.stack_size,
        blinds: h.blinds,
        pot_amount: h.pot_amount,
        site: h.site,
        game_mode: h.game_mode,
        tournament_id: h.tournament_id,
        played_at: h.played_at,
        saw_flop: h.saw_flop,
        saw_turn: h.saw_turn,
        saw_river: h.saw_river,
        showdown: h.showdown,
        hero_name: h.hero_name,
      });
      if (res.ok) added++;
    }
    setPackAction('idle');
    setNewPackName('');
    setPackToast(`Created "${title}" with ${added} hand${added !== 1 ? 's' : ''}`);
    setPackSelected(new Set());
    setPackSelectMode(false);
    if (onReloadBatches) onReloadBatches();
    setTimeout(() => setPackToast(null), 3000);
  }, [currentUserId, packSelected, hands, newPackName, onReloadBatches]);



  if (collapsed) {
    return (
      <div
        className="flex shrink-0 cursor-pointer flex-col items-center rounded-xl border py-3 transition-all"
        style={{ width: RAIL_W_COLLAPSED, borderColor: BORDER, background: SECTION_BG }}
        onClick={onToggleCollapsed}
        title="Expand hand list"
      >
        <PanelLeft className="h-4 w-4 text-white/40" />
        <div className="mt-2 text-[8px] font-bold tracking-widest text-white/25 [writing-mode:vertical-rl] rotate-180 uppercase">
          {classified.length} Hands
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 flex-col overflow-hidden rounded-xl border transition-all"
      style={{ width: RAIL_W, borderColor: BORDER, background: SECTION_BG }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-2 py-1.5" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-1.5">
          <Layers className="h-3 w-3" style={{ color: GOLD }} />
          <span className="text-[9px] font-bold tracking-widest text-white/50 uppercase">Hands</span>
          <span className="text-[8px] text-white/25">{classified.length}</span>
        </div>
        <button onClick={onToggleCollapsed} className="text-white/30 hover:text-white/60 transition" title="Collapse">
          <PanelLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Primary navigation: Current Load | Storage */}
      <div className="shrink-0 border-b px-1 py-1" style={{ borderColor: BORDER }}>
        <PrimaryNav
          activeTab={primaryTab}
          onTabChange={(t) => { setPrimaryTab(t); setSelectedTournamentId(null); setSelectedBatchId(null); }}
          storageSection={storageSection}
          onStorageSectionChange={(s) => { setStorageSection(s); setSelectedTournamentId(null); setSelectedBatchId(null); }}
        />
      </div>

      {/* Unified filter bar for Current Load; Storage search bar for Storage */}
      {batchStep === 'none' && primaryTab === 'current' && (
        <div className="shrink-0 px-1 pt-1.5 pb-1" style={{ borderColor: BORDER }}>
          <UnifiedFilterBar
            filters={unifiedFilters}
            setFilters={setUnifiedFilters}
            sortMode={sortMode}
            setSortMode={setSortMode}
            totalCount={displayed.length}
            loading={false}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
          {/* Interesting toggle — preserved from old design */}
          <div className="mt-1 flex items-center gap-1 px-0.5">
            <button
              onClick={() => setInterestingActive((v) => !v)}
              className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[7px] font-bold uppercase transition ${
                interestingActive ? 'bg-[#d4a52c] text-[#1a1200]' : 'text-white/30 hover:text-white/50'
              }`}
              title="Hands worth reviewing: >3BB win/loss, all-in, or 3-bet pot"
            >
              <Sparkles className="h-2.5 w-2.5" /> {interestingActive ? 'On' : 'Off'}
              {interestingActive && <span className="text-[6px]">({interestingCount})</span>}
            </button>
          </div>
        </div>
      )}
      {batchStep === 'none' && primaryTab === 'storage' && (
        <div className="shrink-0 px-1 pt-1.5 pb-1" style={{ borderColor: BORDER }}>
          <StorageSearchBar
            search={search}
            onSearchChange={setSearch}
            sortMode={sortMode}
            setSortMode={setSortMode}
            totalCount={displayed.length}
            loading={false}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
        </div>
      )}

      {/* Tournament list sub-view — show saved tournaments first, then hands on selection */}
      {primaryTab === 'storage' && storageSection === 'tournament_hh' && !selectedTournamentId && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1" style={{ scrollbarWidth: 'thin' }}>
          {tournaments.length === 0 ? (
            <div className="px-2 py-4 text-center text-[9px] text-white/25">No saved tournaments yet</div>
          ) : (
            <div className="space-y-0.5 px-1">
              {tournaments.map((t) => (
                <div key={t.id} className="group relative flex w-full items-center gap-1.5 rounded-md border border-white/[0.04] bg-white/[0.015] px-1.5 py-1.5 text-left transition hover:bg-white/5">
                  <Trophy className="h-3 w-3 shrink-0 text-[#d4a52c]/70" />
                  <button
                    onClick={() => { setSelectedTournamentId(t.id); onSelectBatch(t as HandBatch); }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[9px] font-bold text-white/70">{t.title}</div>
                    <div className="text-[7px] text-white/30">{t.hand_count} hands</div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (storageMenuId === t.id) { setStorageMenuId(null); setStorageMenuAnchor(null); }
                      else { setStorageMenuId(t.id); setStorageMenuAnchor(e.currentTarget); }
                    }}
                    className="shrink-0 rounded p-0.5 text-white/30 opacity-0 transition group-hover:opacity-100 hover:text-white/60"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </button>
                  {storageMenuId === t.id && storageMenuAnchor && createPortal(
                    <HandRailActionMenu
                      anchor={storageMenuAnchor}
                      onClose={() => { setStorageMenuId(null); setStorageMenuAnchor(null); }}
                      actions={[
                        { label: 'Open', icon: <Layers className="h-3 w-3" />, onClick: () => { setStorageMenuId(null); setStorageMenuAnchor(null); setSelectedTournamentId(t.id); onSelectBatch(t as HandBatch); } },
                        { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, danger: true, onClick: () => { setStorageMenuId(null); setStorageMenuAnchor(null); setStorageDeleteTarget({ id: t.id, title: t.title, type: 'tournament' }); } },
                      ]}
                    />,
                    document.body
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Batch list sub-view — show saved batches + working batch, then hands on selection */}
      {primaryTab === 'storage' && storageSection === 'study_batches' && !selectedBatchId && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1" style={{ scrollbarWidth: 'thin' }}>
          {(() => {
            const savedBatches = batches.filter((b) => !(b as TournamentBatch).is_tournament);
            if (savedBatches.length === 0 && workingBatchCount === 0) {
              return <div className="px-2 py-4 text-center text-[9px] text-white/25">No batches yet</div>;
            }
            return (
              <div className="space-y-0.5 px-1">
                {workingBatchCount > 0 && (
                  <div className="group relative flex w-full items-center gap-1.5 rounded-md border border-white/[0.04] bg-white/[0.015] px-1.5 py-1.5 text-left transition hover:bg-white/5">
                    <Package className="h-3 w-3 shrink-0 text-[#d4a52c]/70" />
                    <button
                      onClick={() => { setActiveMode('batches'); setSelectedBatchId('__working__'); onSelectBatch({ id: '__working__', title: 'Working Batch', hand_count: workingBatchCount } as HandBatch); }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-[9px] font-bold text-white/70">Working Batch</div>
                      <div className="text-[7px] text-white/30">{workingBatchCount} hands</div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (storageMenuId === '__working__') { setStorageMenuId(null); setStorageMenuAnchor(null); }
                        else { setStorageMenuId('__working__'); setStorageMenuAnchor(e.currentTarget); }
                      }}
                      className="shrink-0 rounded p-0.5 text-white/30 opacity-0 transition group-hover:opacity-100 hover:text-white/60"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </button>
                    {storageMenuId === '__working__' && storageMenuAnchor && createPortal(
                      <HandRailActionMenu
                        anchor={storageMenuAnchor}
                        onClose={() => { setStorageMenuId(null); setStorageMenuAnchor(null); }}
                        actions={[
                          { label: 'Open', icon: <Layers className="h-3 w-3" />, onClick: () => { setStorageMenuId(null); setStorageMenuAnchor(null); setActiveMode('batches'); setSelectedBatchId('__working__'); onSelectBatch({ id: '__working__', title: 'Working Batch', hand_count: workingBatchCount } as HandBatch); } },
                          { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, danger: true, onClick: () => { setStorageMenuId(null); setStorageMenuAnchor(null); setStorageDeleteTarget({ id: '__working__', title: 'Working Batch', type: 'batch' }); } },
                        ]}
                      />,
                      document.body
                    )}
                  </div>
                )}
                {savedBatches.map((b) => (
                <div key={b.id} className="group relative flex w-full items-center gap-1.5 rounded-md border border-white/[0.04] bg-white/[0.015] px-1.5 py-1.5 text-left transition hover:bg-white/5">
                  <Package className="h-3 w-3 shrink-0 text-[#d4a52c]/70" />
                  <button
                    onClick={() => { setSelectedBatchId(b.id); onSelectBatch(b); }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[9px] font-bold text-white/70">{b.title}</div>
                    <div className="text-[7px] text-white/30">{b.hand_count} hands</div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (storageMenuId === b.id) { setStorageMenuId(null); setStorageMenuAnchor(null); }
                      else { setStorageMenuId(b.id); setStorageMenuAnchor(e.currentTarget); }
                    }}
                    className="shrink-0 rounded p-0.5 text-white/30 opacity-0 transition group-hover:opacity-100 hover:text-white/60"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </button>
                  {storageMenuId === b.id && storageMenuAnchor && createPortal(
                    <HandRailActionMenu
                      anchor={storageMenuAnchor}
                      onClose={() => { setStorageMenuId(null); setStorageMenuAnchor(null); }}
                      actions={[
                        { label: 'Open', icon: <Layers className="h-3 w-3" />, onClick: () => { setStorageMenuId(null); setStorageMenuAnchor(null); setSelectedBatchId(b.id); onSelectBatch(b); } },
                        { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, danger: true, onClick: () => { setStorageMenuId(null); setStorageMenuAnchor(null); setStorageDeleteTarget({ id: b.id, title: b.title, type: 'batch' }); } },
                      ]}
                    />,
                    document.body
                  )}
                </div>
              ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Review pack select button for favorites */}
      {primaryTab === 'storage' && storageSection === 'favorites' && savedCount > 0 && batchStep === 'none' && (
        <div className="flex shrink-0 items-center gap-1 border-b px-1.5 py-1" style={{ borderColor: BORDER }}>
          <button
            onClick={() => { setPackSelectMode((v) => !v); if (packSelectMode) setPackSelected(new Set()); }}
            className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[7px] font-bold uppercase transition ${
              packSelectMode ? 'bg-[#c0911e]/20 text-[#f5e6b0]' : 'text-white/35 hover:text-white/55'
            }`}
          >
            <CheckSquare className="h-2.5 w-2.5" /> Select
          </button>
        </div>
      )}

      {/* ── Review pack selection bar ── */}
      {packSelectMode && (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b px-1.5 py-1" style={{ borderColor: BORDER }}>
          <span className="text-[8px] font-bold uppercase text-[#f5e6b0]">{packSelected.size} selected</span>
          <button onClick={handlePackSelectAll} className="rounded px-1 py-0.5 text-[7px] font-bold uppercase text-white/40 hover:text-white/70">All</button>
          <button onClick={handlePackDeselectAll} className="rounded px-1 py-0.5 text-[7px] font-bold uppercase text-white/40 hover:text-white/70">None</button>
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setShowBatchPicker(true)}
              disabled={packSelected.size === 0}
              className="rounded border border-[#d4a52c]/40 bg-[#c0911e]/15 px-1.5 py-0.5 text-[7px] font-bold uppercase text-[#f5e6b0] disabled:opacity-30"
            >
              Add to Pack
            </button>
            <button
              onClick={handleCreateNewPack}
              disabled={packSelected.size === 0 || packAction !== 'idle'}
              className="rounded border border-[#d4a52c]/40 bg-[#c0911e]/15 px-1.5 py-0.5 text-[7px] font-bold uppercase text-[#f5e6b0] disabled:opacity-30"
            >
              {packAction === 'creating' ? 'Creating…' : 'New Pack'}
            </button>
          </div>
        </div>
      )}

      {/* Storage delete confirmation */}
      {storageDeleteTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-red-300/20 bg-[#0d0f12] p-5 shadow-2xl text-center">
            <Trash2 className="mx-auto h-7 w-7 text-red-300/70" />
            <p className="mt-3 text-sm font-semibold text-white">
              Delete {storageDeleteTarget.type === 'tournament' ? 'entire tournament' : 'study batch'}?
            </p>
            <p className="mt-1 text-[10px] text-white/40">
              {storageDeleteTarget.type === 'tournament'
                ? `"${storageDeleteTarget.title}" and all its hands will be removed from your library. Original tournament hands remain in your analytics unless separately deleted.`
                : `"${storageDeleteTarget.title}" will be removed from your library. Original tournament hands are not affected.`
              }
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button onClick={() => setStorageDeleteTarget(null)} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
              <button
                onClick={async () => {
                  if (storageDeleteTarget.type === 'batch') {
                    if (storageDeleteTarget.id === '__working__') {
                      if (currentUserId) await deleteWorkingBatch(currentUserId);
                    } else {
                      const { supabase } = await import('@/lib/supabase');
                      await supabase.from('sv_hand_batches').delete().eq('id', storageDeleteTarget.id);
                    }
                    setStorageDeleteTarget(null);
                    if (onReloadBatches) onReloadBatches();
                  } else {
                    const { supabase } = await import('@/lib/supabase');
                    await supabase.from('sv_saved_tournaments').delete().eq('id', storageDeleteTarget.id);
                    setStorageDeleteTarget(null);
                    if (onReloadBatches) onReloadBatches();
                  }
                }}
                className="rounded-lg border border-red-400/50 bg-red-400/15 px-4 py-2 text-[10px] font-bold uppercase text-red-300 hover:bg-red-400/25"
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pack toast ── */}
      {packToast && (
        <div className="shrink-0 border-b px-2 py-1 text-[8px] font-medium text-[#4ade80]" style={{ borderColor: BORDER }}>
          {packToast}
        </div>
      )}

      {/* ── Batch picker modal for "Add to Pack" ── */}
      {showBatchPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowBatchPicker(false)}>
          <div className="max-h-[60vh] w-72 overflow-y-auto rounded-lg border border-[#d4a52c]/30 bg-[#0d0f12] p-3" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-[10px] font-bold uppercase text-[#f5e6b0]">Add to existing pack</p>
            {batches.length === 0 ? (
              <p className="text-[9px] text-white/30">No existing packs. Create a new one instead.</p>
            ) : (
              <div className="space-y-1">
                {batches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => void handleAddToExistingBatch(b.id)}
                    disabled={packAction !== 'idle'}
                    className="flex w-full items-center justify-between rounded border border-white/10 bg-white/[0.02] px-2 py-1.5 text-left transition hover:bg-white/5 disabled:opacity-30"
                  >
                    <span className="truncate text-[10px] font-medium text-white/70">{b.title}</span>
                    <span className="text-[8px] text-white/30">{b.hand_count}h</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowBatchPicker(false)} className="mt-2 w-full rounded border border-white/10 py-1 text-[8px] font-bold uppercase text-white/40 hover:text-white/70">Cancel</button>
          </div>
        </div>
      )}

      {/* Batch selection controls */}
      {batchStep === 'select' && (
        <div className="flex shrink-0 items-center gap-1 border-b px-1.5 py-1" style={{ borderColor: BORDER }}>
          <span className="text-[8px] font-bold uppercase text-[#f5e6b0]">{batchSelected.size} selected</span>
          <button onClick={() => setBatchStep('none')} className="ml-auto rounded px-1.5 py-0.5 text-[7px] font-bold uppercase text-white/40 hover:text-white/70">Cancel</button>
          <button
            onClick={() => {
              const ordered = savedHands.filter((h) => batchSelected.has(h.id)).map((h) => h.id);
              setBatchOrder(ordered);
              setBatchStep('order');
            }}
            disabled={batchSelected.size < 1}
            className="rounded border border-[#d4a52c]/40 bg-[#c0911e]/15 px-1.5 py-0.5 text-[7px] font-bold uppercase text-[#f5e6b0] disabled:opacity-30"
          >
            Continue
          </button>
        </div>
      )}

      {/* Batch order controls */}
      {batchStep === 'order' && (
        <div className="flex shrink-0 items-center gap-1 border-b px-1.5 py-1" style={{ borderColor: BORDER }}>
          <span className="text-[8px] font-bold uppercase text-[#f5e6b0]">Order</span>
          <button onClick={() => setBatchStep('select')} className="ml-auto rounded px-1.5 py-0.5 text-[7px] font-bold uppercase text-white/40 hover:text-white/70">Back</button>
          <button
            onClick={async () => {
              const orderedHands = batchOrder
                .map((id) => hands.find((h) => h.id === id))
                .filter((h): h is ReviewHand => !!h);
              await onBatchComplete(orderedHands);
              setBatchStep('none');
              setBatchSelected(new Set());
              setBatchOrder([]);
            }}
            disabled={batchOrder.length < 1}
            className="rounded border border-[#d4a52c]/40 bg-[#c0911e]/15 px-1.5 py-0.5 text-[7px] font-bold uppercase text-[#f5e6b0] disabled:opacity-30"
          >
            Complete
          </button>
        </div>
      )}

      {/* ── Working batch hands (when __working__ selected in study_batches mode) ── */}
      {primaryTab === 'storage' && storageSection === 'study_batches' && selectedBatchId === '__working__' && (
        <>
          {workingBatchHands.length === 0 ? (
            <div className="px-2 py-4 text-center text-[9px] text-white/25">
              No hands in batch yet.<br />Use the ⋯ menu on any hand to add it.
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1" style={{ scrollbarWidth: 'thin' }}>
              <div className="space-y-0.5 px-1">
                {workingBatchHands.map((bh, idx) => {
                  const isSelected = bh.id === selectedBatchHandId;
                  return (
                    <div key={bh.id} className="group relative flex items-center gap-1 rounded-md border px-1.5 py-1.5 transition-all"
                      style={{
                        background: isSelected ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.015)',
                        borderColor: isSelected ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.04)',
                      }}>
                      <span className="font-mono text-[8px] font-bold text-[#d4a52c]">{idx + 1}.</span>
                      <button
                        onClick={() => onSelectBatchHand(bh)}
                        className="flex min-w-0 flex-1 flex-col text-left"
                      >
                        <div className="flex items-center gap-1">
                          {bh.position && (
                            <span className="rounded border border-[#c0911e]/20 px-0.5 text-[7px] font-bold text-[#d4a52c]">{bh.position}</span>
                          )}
                          {bh.has_note && <StickyNote className="h-2.5 w-2.5 text-[#d4a52c]" />}
                          <span className="ml-auto font-mono text-[9px] font-bold" style={{ color: resultColor(bh.net_result ?? null) }}>
                            {formatResultBB(bh.net_result)}
                          </span>
                        </div>
                        {bh.hero_cards && (
                          <div className="mt-0.5 truncate font-mono text-[9px] font-bold text-white/70">{formatHeroCards(bh.hero_cards)}</div>
                        )}
                      </button>
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          onClick={() => {
                            const ids = workingBatchHands.map((h) => h.id);
                            if (idx > 0) {
                              [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                              onReorderBatch(ids);
                            }
                          }}
                          disabled={idx === 0}
                          className="rounded p-0.5 text-white/40 hover:text-white/80 disabled:opacity-20"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => {
                            const ids = workingBatchHands.map((h) => h.id);
                            if (idx < ids.length - 1) {
                              [ids[idx + 1], ids[idx]] = [ids[idx], ids[idx + 1]];
                              onReorderBatch(ids);
                            }
                          }}
                          disabled={idx === workingBatchHands.length - 1}
                          className="rounded p-0.5 text-white/40 hover:text-white/80 disabled:opacity-20"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => onRemoveFromBatch(bh.id)}
                          className="rounded p-0.5 text-red-300/50 hover:text-red-300"
                          title="Remove from batch"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* SAVE BATCH + COMPLETE BATCH buttons */}
          <div className="shrink-0 space-y-1 border-t px-1.5 py-1.5" style={{ borderColor: BORDER }}>
            <button
              onClick={onSaveBatch}
              disabled={workingBatchCount === 0}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-white/15 bg-white/5 py-1.5 text-[9px] font-bold uppercase text-white/60 transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Save className="h-3 w-3" /> Save Batch
            </button>
            <button
              onClick={onCompleteBatch}
              disabled={workingBatchCount === 0}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-[#d4a52c]/50 bg-[#c0911e]/20 py-1.5 text-[9px] font-bold uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/30 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Check className="h-3 w-3" /> Complete Batch
            </button>
          </div>
        </>
      )}

      {/* Hand rows — internal scroll (non-batch modes) */}
      {!(primaryTab === 'storage' && storageSection === 'study_batches' && selectedBatchId) && !(primaryTab === 'storage' && storageSection === 'tournament_hh' && !selectedTournamentId) && !((primaryTab === 'storage' && storageSection === 'study_batches') && !selectedBatchId) && (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1" style={{ scrollbarWidth: 'thin' }}>
        {displayed.length === 0 ? (
          <div className="px-2 py-4 text-center text-[9px] text-white/25">No hands</div>
        ) : (
          <div className="space-y-0.5 px-1">
            {displayed.map((h) => {
              const fullRow = hands.find((hr) => hr.id === (h as unknown as ReviewHand).id);
              const isMarked = fullRow?.marked_for_coach;
              const isSaved = fullRow ? savedHandIds.has(fullRow.hand_id ?? fullRow.id) : false;
              const originalIdx = filteredHands.indexOf(h);
              const isSelected = originalIdx === selectedHandIndex;
              const netResult = h.net_result;
              const rowId = (h as unknown as ReviewHand).id;
              const isConstructed = fullRow?.source === 'constructed';

              // Batch select mode
              const isBatchSelected = batchSelected.has(rowId);

              // Batch order mode — render ordered list with up/down controls
              if (batchStep === 'order') {
                const orderIdx = batchOrder.indexOf(rowId);
                if (orderIdx < 0) return null;
                return (
                  <div key={rowId} className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-1.5">
                    <span className="font-mono text-[8px] font-bold text-[#d4a52c]">{orderIdx + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[9px] font-bold text-white/70">{formatHeroCards(h.hero_cards)}</div>
                      {h.position && <span className="text-[7px] text-white/30">{h.position}</span>}
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        onClick={() => {
                          if (orderIdx > 0) {
                            const next = [...batchOrder];
                            [next[orderIdx - 1], next[orderIdx]] = [next[orderIdx], next[orderIdx - 1]];
                            setBatchOrder(next);
                          }
                        }}
                        disabled={orderIdx === 0}
                        className="rounded p-0.5 text-white/40 hover:text-white/80 disabled:opacity-20"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (orderIdx < batchOrder.length - 1) {
                            const next = [...batchOrder];
                            [next[orderIdx + 1], next[orderIdx]] = [next[orderIdx], next[orderIdx + 1]];
                            setBatchOrder(next);
                          }
                        }}
                        disabled={orderIdx === batchOrder.length - 1}
                        className="rounded p-0.5 text-white/40 hover:text-white/80 disabled:opacity-20"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              }

              const isInWorkingBatch = workingBatchHands.some((wbh) => wbh.hand_id === fullRow?.hand_id);
              return (
                <div key={rowId} className="group flex items-stretch gap-1">
                  <button
                    onClick={() => {
                      if (packSelectMode) {
                        handlePackToggle(rowId);
                      } else if (batchStep === 'select') {
                        setBatchSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(rowId)) next.delete(rowId);
                          else next.add(rowId);
                          return next;
                        });
                      } else {
                        onSelectHand(originalIdx);
                      }
                    }}
                    className="flex min-w-0 flex-1 flex-col rounded-md border px-1.5 py-1.5 text-left transition-all"
                    style={{
                      background: (packSelectMode && packSelected.has(rowId)) ? 'rgba(201,162,39,0.15)' : batchStep === 'select' && isBatchSelected ? 'rgba(201,162,39,0.15)' : isSelected ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.015)',
                      borderColor: (packSelectMode && packSelected.has(rowId)) ? 'rgba(201,162,39,0.5)' : batchStep === 'select' && isBatchSelected ? 'rgba(201,162,39,0.5)' : isSelected ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-1">
                        {packSelectMode && (
                          packSelected.has(rowId)
                            ? <CheckSquare className="h-3 w-3 shrink-0 text-[#d4a52c]" />
                            : <Square className="h-3 w-3 shrink-0 text-white/30" />
                        )}
                        {batchStep === 'select' && !packSelectMode && (
                          isBatchSelected
                            ? <CheckSquare className="h-3 w-3 shrink-0 text-[#d4a52c]" />
                            : <Square className="h-3 w-3 shrink-0 text-white/30" />
                        )}
                        <span className="font-mono text-[8px] font-bold text-white/45">#{originalIdx + 1}</span>
                        {h.position && (
                          <span className="rounded border border-[#c0911e]/20 px-0.5 text-[7px] font-bold text-[#d4a52c]">
                            {h.position}
                          </span>
                        )}
                        {isConstructed && (
                          <span className="rounded border border-blue-400/30 px-0.5 text-[7px] font-bold text-blue-300/80">C</span>
                        )}
                        {fullRow?.source === 'demo' && (
                          <span className="rounded border border-[#d4a52c]/50 bg-[#c0911e]/20 px-0.5 text-[7px] font-bold text-[#f5e6b0]">DEMO</span>
                        )}
                        {isSaved && <Bookmark className="h-2.5 w-2.5 fill-[#d4a52c] text-[#d4a52c]" />}
                        {isMarked && <Star className="h-2 w-2 fill-[#d4a52c] text-[#d4a52c]" />}
                      </div>
                      <span className="font-mono text-[9px] font-bold" style={{ color: resultColor(netResult ?? null) }}>
                        {formatResultBB(netResult)}
                      </span>
                    </div>
                    {h.hero_cards && (
                      <div className="mt-0.5 truncate font-mono text-[9px] font-bold text-white/70">
                        {formatHeroCards(h.hero_cards)}
                      </div>
                    )}
                    {h.board && (
                      <div className="truncate font-mono text-[8px] text-white/30">
                        {formatBoard(h.board)}
                      </div>
                    )}
                  </button>
                  {fullRow && batchStep === 'none' && !packSelectMode && (
                    <div className="relative flex shrink-0 items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (menuOpenId === rowId) {
                            setMenuOpenId(null);
                            setMenuAnchor(null);
                          } else {
                            setMenuAnchor(e.currentTarget as HTMLElement);
                            setMenuOpenId(rowId);
                          }
                        }}
                        className="flex items-center justify-center rounded-md border transition-all"
                        style={{
                          width: isMobile ? 40 : 28,
                          height: isMobile ? 40 : 28,
                          background: isSelected ? 'rgba(192,145,30,0.18)' : 'rgba(20,20,20,0.9)',
                          borderColor: isSelected ? 'rgba(192,145,30,0.5)' : 'rgba(192,145,30,0.22)',
                        }}
                        title="Actions"
                      >
                        <MoreVertical
                          className={isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'}
                          style={{ color: isSelected ? '#f5e6b0' : '#d4a52c' }}
                        />
                      </button>
                      {menuOpenId === rowId && menuAnchor && createPortal(
                        <HandRailActionMenu
                          anchor={menuAnchor}
                          onClose={() => { setMenuOpenId(null); setMenuAnchor(null); }}
                          actions={[
                            { action: 'replay' as const, label: 'View / Replay', icon: Play },
                            ...(isSaved
                              ? [{ action: 'unsave' as const, label: 'Unsave Hand', icon: Bookmark }]
                              : [{ action: 'save' as const, label: 'Save Hand', icon: Bookmark }]),
                            { action: 'addToBatch' as const, label: isInWorkingBatch ? 'Remove from Batch' : 'Add to Batch', icon: isInWorkingBatch ? X : Package },
                            { action: 'copyId' as const, label: 'Copy Hand ID', icon: Copy },
                            { action: 'copyLink' as const, label: 'Copy Replay Link', icon: Link },
                            { action: 'addToSpot' as const, label: 'Add to Spot', icon: MapPin },
                            { action: 'addToMsa' as const, label: 'Add to Multi-Spot', icon: BookOpen },
                            ...(isConstructed ? [
                              { action: 'rename' as const, label: 'Edit Hand', icon: Edit2 },
                              { action: 'delete' as const, label: 'Delete Hand', icon: Trash2 },
                            ] : []),
                          ].map(({ action, label, icon: Icon }) => ({
                            label,
                            icon: <Icon className="h-3 w-3 shrink-0" />,
                            onClick: () => { setMenuOpenId(null); setMenuAnchor(null); onHandAction(action, fullRow); },
                            danger: action === 'delete',
                          }))}
                        />,
                        document.body
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN WORKSPACE
// ────────────────────────────────────────────────────────────────────────────
export function HandReviewWorkspace({
  coachId, coachName, onMessageCoach: _onMessageCoach, onHandCountChange,
  currentBatch, batches, onSelectBatch, onBatchRenamed, onReloadBatches, onSaveLastViewedHand,
  constructSignal,
  presentationMode: externalPresentationMode,
  onTogglePresentationMode,
  initialHandId,
  onHandConsumed,
}: HandReviewWorkspaceProps) {
  const [hands, setHands] = useState<ReviewHand[]>([]);
  const [classified, setClassified] = useState<ClassifiedHand[]>([]);
  const [filters] = useState<HandSorterFilters>(DEFAULT_FILTERS);
  const [selectedHandIndex, setSelectedHandIndex] = useState(-1);
  const [replayerHand, setReplayerHand] = useState<NormalizedHand | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaveState, setNoteSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [noteDirty, setNoteDirty] = useState(false);
  const [handTags, setHandTags] = useState<Record<string, string[]>>({});
  const [batchNote, setBatchNote] = useState('');
  const [batchNoteSaveState, setBatchNoteSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [editingBatchName, setEditingBatchName] = useState(false);
  const [batchNameDraft, setBatchNameDraft] = useState('');
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<{ coachName: string; handCount: number } | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showJukeboxModal, setShowJukeboxModal] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [jukeboxTitle, setJukeboxTitle] = useState('');
  const [jukeboxDesc, setJukeboxDesc] = useState('');
  const [jukeboxPrice, setJukeboxPrice] = useState(0);
  const [jukeboxType, setJukeboxType] = useState<ProductType>('hand_pack');
  const [jukeboxSubmitting, setJukeboxSubmitting] = useState(false);
  const [jukeboxSuccess, setJukeboxSuccess] = useState(false);
  const [jukeboxError, setJukeboxError] = useState<string | null>(null);
  // Default collapsed — keeps primary replayer view compact
  const [notesOpen, setNotesOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeRelationships, setActiveRelationships] = useState<Relationship[]>([]);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [showBatchDropdown, setShowBatchDropdown] = useState(false);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const [inboxItems, setInboxItems] = useState<BatchEvent[]>([]);
  const [handImages, setHandImages] = useState<Record<string, { id: string; image_url: string; caption: string }[]>>({});
  const [imageUploading, setImageUploading] = useState(false);
  const [allHandNotes, setAllHandNotes] = useState<HandNoteEntry[]>([]);
  const [coachNoteDraft, setCoachNoteDraft] = useState('');
  const [activeSubmission, setActiveSubmission] = useState<SubmissionDetails | null>(null);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [returnMessage, setReturnMessage] = useState('');
  const [returning, setReturning] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState('');
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCoachView, setIsCoachView] = useState(false);
  const [internalPresentationMode, setInternalPresentationMode] = useState(false);
  const [presentationSavePrompt, setPresentationSavePrompt] = useState(false);
  const presentationMode = externalPresentationMode ?? internalPresentationMode;
  const [mobileActionOpen, setMobileActionOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showConstructHand, setShowConstructHand] = useState(false);
  const [constructedHands, setConstructedHands] = useState<ManualHandRecord[]>([]);
  const [actionMenuTarget, setActionMenuTarget] = useState<ReviewHand | null>(null);
  const [showAddToSpotModal, setShowAddToSpotModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [spotDrafts, setSpotDrafts] = useState<ContentSpot[]>([]);
  const [spotLoading, setSpotLoading] = useState(false);
  const [showAddToMsaModal, setShowAddToMsaModal] = useState(false);
  const [msaDrafts, setMsaDrafts] = useState<ContentSpot[]>([]);
  const [savedHandIds, setSavedHandIds] = useState<Set<string>>(new Set());
  const [batchCompleting, setBatchCompleting] = useState(false);
  // ── Working batch state (HH Batch Workflow) ──
  const [workingBatch, setWorkingBatch] = useState<HandBatch | null>(null);
  const [workingBatchHands, setWorkingBatchHands] = useState<WorkingBatchHand[]>([]);
  const [selectedBatchHandId, setSelectedBatchHandId] = useState<string | null>(null);
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchNoteMode, setBatchNoteMode] = useState<'hand' | 'batch'>('hand');
  const [showCompleteBatchModal, setShowCompleteBatchModal] = useState(false);
  const [batchCompletingFlag, setBatchCompletingFlag] = useState(false);
  const workingBatchRef = useRef<HandBatch | null>(null);
  const batchHandsLoadedRef = useRef(false);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentHandIdRef = useRef<string | null>(null);
  const prevConstructSignalRef = useRef<number>(constructSignal ?? 0);
  const explicitHandKeyRef = useRef<string | null>(null);
  const constructedHandsLoadedRef = useRef(false);
  const prevBatchIdRef = useRef<string | null>(null);
  const constructedHandsRef = useRef<ManualHandRecord[]>([]);
  const loadHandsReqRef = useRef(0);
  const [constructedHandsVersion, setConstructedHandsVersion] = useState(0);

  useEffect(() => {
    if ((constructSignal ?? 0) > prevConstructSignalRef.current) {
      setShowConstructHand(true);
    }
    prevConstructSignalRef.current = constructSignal ?? 0;
  }, [constructSignal]);

  const loadConstructedHands = useCallback(async () => {
    const records = await listManualHands();
    constructedHandsRef.current = records;
    setConstructedHands(records);
    constructedHandsLoadedRef.current = true;
    setConstructedHandsVersion((v) => v + 1);
  }, []);

  useEffect(() => { void loadConstructedHands(); }, [loadConstructedHands]);

  // Reset selection when the batch changes so new uploads start at Hand #1.
  // This distinguishes a NEW batch (reset) from RETURNING to an existing one
  // (loadHands will restore by last_viewed_hand_id).
  useEffect(() => {
    const newId = currentBatch?.id ?? DEMO_REVIEW_SET.id;
    if (prevBatchIdRef.current !== null && prevBatchIdRef.current !== newId) {
      setSelectedHandIndex(-1);
      setReplayerHand(null);
    }
    prevBatchIdRef.current = newId;
  }, [currentBatch?.id]);

  useEffect(() => {
    (async () => {
      const rels = await getMyRelationships('coach_student');
      const active = rels.filter((r) => r.status === 'active');
      setActiveRelationships(active);
      if (active.length > 0 && !selectedRelationshipId) setSelectedRelationshipId(active[0].id);
      const events = await fetchBatchInbox();
      setInboxUnread(events.length);
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        setCurrentUserId(userData.user.id);
        const saved = await fetchSavedHandIds(userData.user.id);
        setSavedHandIds(saved);
        // Load working batch
        const wb = await fetchWorkingBatch(userData.user.id);
        setWorkingBatch(wb);
        workingBatchRef.current = wb;
        if (wb) {
          const wbHands = await fetchWorkingBatchHands(wb.id);
          setWorkingBatchHands(wbHands);
        }
      }
    })();
  }, []);

  // Cross-view favorites refresh: when HH Replayer saves/unsaves a hand,
  // update this view's saved set so the heart/bookmark state stays in sync.
  useEffect(() => {
    function onSavedHandChange(e: Event) {
      const detail = (e as CustomEvent).detail as { userId: string; handId: string; saved: boolean };
      if (!currentUserId || detail.userId !== currentUserId) return;
      setSavedHandIds((prev) => {
        const next = new Set(prev);
        if (detail.saved) next.add(detail.handId);
        else next.delete(detail.handId);
        return next;
      });
    }
    window.addEventListener('spotvault:saved-hand-changed', onSavedHandChange);
    return () => window.removeEventListener('spotvault:saved-hand-changed', onSavedHandChange);
  }, [currentUserId]);

  const reloadWorkingBatch = useCallback(async () => {
    if (!currentUserId) return;
    const wb = await fetchWorkingBatch(currentUserId);
    setWorkingBatch(wb);
    workingBatchRef.current = wb;
    if (wb) {
      const wbHands = await fetchWorkingBatchHands(wb.id);
      setWorkingBatchHands(wbHands);
    } else {
      setWorkingBatchHands([]);
    }
    // Don't clear selectedBatchHandId on reload — preserves selection during add/remove
  }, [currentUserId]);

  const loadHands = useCallback(async () => {
    const batch = currentBatch ?? DEMO_REVIEW_SET;
    const reqId = ++loadHandsReqRef.current;
    let batchHands: ReviewHand[];
    if (batch.id === DEMO_REVIEW_SET.id) {
      batchHands = DEMO_REVIEW_HANDS as unknown as ReviewHand[];
    } else {
      batchHands = (await fetchBatchHands(batch.id)) as unknown as ReviewHand[];
    }
    if (reqId !== loadHandsReqRef.current) return;

    const constructedReviewHands: ReviewHand[] = constructedHandsRef.current.map((r) => {
      const nh = r.normalized_hand;
      const hero = nh.players.find((p) => p.isHero);
      const heroCards = hero?.holeCards?.join(' ') ?? null;
      const boardParts: string[] = [...nh.board.flop];
      if (nh.board.turn) boardParts.push(nh.board.turn);
      if (nh.board.river) boardParts.push(nh.board.river);
      const boardStr = boardParts.length > 0 ? boardParts.join(' ') : null;
      const netResult = computeConstructedNetResult(nh);
      return {
        id: `constructed-${r.id}`,
        hand_id: r.hand_id,
        tournament_id: null,
        position: hero?.position ?? null,
        hero_name: nh.heroName,
        hero_cards: heroCards,
        board: boardStr,
        net_result: netResult,
        stack_size: hero?.stack ?? null,
        blinds: nh.stakes || null,
        played_at: r.created_at,
        raw_hand_text: null,
        site: nh.site,
        game_mode: nh.gameType,
        review_set_id: 'constructed',
        marked_for_coach: false,
        parsed_ok: true,
        parse_error: null,
        sort_order: 0,
        hand_title: nh.title ?? 'Constructed Hand',
        source: 'constructed',
        normalizedHand: nh,
      };
    });

    const allHands = [...batchHands, ...constructedReviewHands];
    setHands(allHands);
    const cl = allHands.map((h) => classifyHandRecord(h));
    setClassified(cl);

    // Track tournament-only count separately so constructed hands don't inflate it
    const tournamentCount = batchHands.length;

    // If an explicit hand was set (e.g. via Construct Save & Replay),
    // find and select its index instead of auto-selecting.
    if (explicitHandKeyRef.current) {
      const key = explicitHandKeyRef.current;
      const matchRecord = constructedHandsRef.current.find((r) => r.hand_id === key);
      if (matchRecord) {
        const constructedId = `constructed-${matchRecord.id}`;
        const explicitIdx = cl.findIndex((h) => (h as unknown as ReviewHand).id === constructedId);
        if (explicitIdx >= 0) {
          setSelectedHandIndex(explicitIdx);
          explicitHandKeyRef.current = null;
          return;
        }
      }
    }

    // Only auto-select when no hand has been selected yet.
    // Wait for constructed hands to load before auto-selecting, so the
    // hand list is complete and the restored index matches the final list.
    if (cl.length > 0 && selectedHandIndex < 0 && constructedHandsLoadedRef.current) {
      if (batch.id === DEMO_REVIEW_SET.id) {
        setSelectedHandIndex(0);
      } else {
        // Try restoring by hand ID first (more reliable than index,
        // especially when constructed hands are appended to the list).
        const savedHandId = (batch as { last_viewed_hand_id?: string | null }).last_viewed_hand_id;
        const savedIndex = (batch as { last_viewed_index?: number | null }).last_viewed_index;
        let restore = 0;
        if (savedHandId) {
          const idIdx = cl.findIndex((h) => (h as unknown as ReviewHand).id === savedHandId);
          if (idIdx >= 0) restore = idIdx;
        }
        if (restore === 0 && savedIndex != null && savedIndex >= 0 && savedIndex < cl.length) {
          restore = savedIndex;
        }
        setSelectedHandIndex(restore);
      }
    }
  }, [currentBatch, constructedHandsVersion]);

  useEffect(() => { void loadHands(); }, [loadHands]);

  useEffect(() => {
    if (!initialHandId || hands.length === 0) return;
    const idx = hands.findIndex((h) => h.hand_id === initialHandId || h.id === initialHandId);
    if (idx >= 0) {
      setSelectedHandIndex(idx);
      onHandConsumed?.();
    }
  }, [initialHandId, hands, onHandConsumed]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? 'demo-user';
      setCanPublish(await canPublishJukebox(userId));
    })();
  }, []);

  const filteredHands = useMemo(() => applyFilters(classified, filters), [classified, filters]);
  const markedCount = useMemo(() => hands.filter((h) => h.marked_for_coach).length, [hands]);

  useEffect(() => {
    if (!onSaveLastViewedHand) return;
    if (selectedHandIndex < 0 || selectedHandIndex >= filteredHands.length) {
      onSaveLastViewedHand(null, null); return;
    }
    const hand = filteredHands[selectedHandIndex];
    const fullRow = hands.find((h) => h.id === (hand as unknown as ReviewHand).id);
    onSaveLastViewedHand(fullRow?.id ?? null, selectedHandIndex);
  }, [selectedHandIndex, filteredHands, hands, onSaveLastViewedHand]);

  useEffect(() => {
    if (!currentBatch) { setBatchNote(''); return; }
    setBatchNote(currentBatch.description ?? '');
  }, [currentBatch]);

  useEffect(() => {
    if (currentBatch) setJukeboxTitle(currentBatch.title);
  }, [currentBatch]);

  const tournamentHandCount = useMemo(() => hands.filter((h) => h.source !== 'constructed' && h.source !== 'demo').length, [hands]);
  useEffect(() => { if (onHandCountChange) onHandCountChange(tournamentHandCount); }, [tournamentHandCount, onHandCountChange]);

  useEffect(() => { setInternalPresentationMode(false); }, [selectedHandIndex, currentBatch?.id]);

  const recorder = usePresentationRecorder(currentHandIdRef.current, currentUserId);

  const togglePresentationMode = useCallback(() => {
    const setMode = onTogglePresentationMode
      ? () => onTogglePresentationMode()
      : () => setInternalPresentationMode((prev) => !prev);
    if (presentationMode && (recorder.recorderState === 'recording' || recorder.recorderState === 'paused')) {
      recorder.stopRecording();
      setPresentationSavePrompt(true);
    }
    setMode();
  }, [recorder, presentationMode, onTogglePresentationMode]);

  // Load hand into replayer when selection changes
  useEffect(() => {
    if (selectedHandIndex < 0 || selectedHandIndex >= filteredHands.length) {
      setReplayerHand(null); return;
    }
    const hand = filteredHands[selectedHandIndex];
    const fullRow = hands.find((h) => h.id === (hand as unknown as ReviewHand).id);
    if (!fullRow) return;
    currentHandIdRef.current = fullRow.id;

    if (fullRow.normalizedHand) {
      setReplayerHand(fullRow.normalizedHand);
      void loadNote(fullRow.id);
      void loadTags(fullRow.id);
      void loadImages(fullRow.id);
      return;
    }
    const demoHand = DEMO_REVIEW_HANDS.find((d) => d.id === fullRow.id);
    if (demoHand) {
      setReplayerHand(demoHand.normalized);
    } else {
      const rec: Phase2HandRecord = {
        hand_id: fullRow.hand_id ?? 'unknown',
        site: fullRow.site, game_mode: fullRow.game_mode,
        hero_name: fullRow.hero_name, hero_cards: fullRow.hero_cards,
        position: fullRow.position, board: fullRow.board,
        raw_hand_text: fullRow.raw_hand_text, net_result: fullRow.net_result,
        stack_size: fullRow.stack_size, blinds: fullRow.blinds,
        pot_amount: fullRow.pot_amount, tournament_id: fullRow.tournament_id,
        played_at: fullRow.played_at, showdown: fullRow.showdown,
        saw_flop: fullRow.saw_flop, saw_turn: fullRow.saw_turn, saw_river: fullRow.saw_river,
        action_sequence: [],
      };
      const normalized = phase2HandToNormalized(rec);
      if (normalized.actions.length === 0 && !fullRow.raw_hand_text) {
        console.error('[HandReviewWorkspace] Hand has no actions and no raw text:', fullRow.hand_id);
        setReplayerHand(null);
      } else {
        setReplayerHand(normalized);
      }
    }
    void loadNote(fullRow.id);
    void loadTags(fullRow.id);
    void loadImages(fullRow.id);
  }, [selectedHandIndex, filteredHands, hands]);

  const loadNote = async (reviewHandId: string) => {
    const notes = await loadAllHandNotes(reviewHandId);
    setAllHandNotes(notes);
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const myNotes = notes.filter(n => n.author_id === userData.user!.id && n.note_type === 'student');
      setNoteDraft(myNotes[myNotes.length - 1]?.content ?? '');
      setNoteDirty(false);
      const coachNotes = notes.filter(n => n.author_id === userData.user!.id && n.note_type === 'coach');
      setCoachNoteDraft(coachNotes[coachNotes.length - 1]?.content ?? '');
    }
  };

  const loadTags = async (reviewHandId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase.from('sv_hand_note_tags').select('tag')
      .eq('review_hand_id', reviewHandId).eq('author_id', userData.user.id);
    setHandTags((prev) => ({ ...prev, [reviewHandId]: ((data ?? []) as { tag: string }[]).map((r) => r.tag) }));
  };

  const loadImages = async (reviewHandId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase.from('sv_review_hand_images').select('id, image_url, caption')
      .eq('review_hand_id', reviewHandId).eq('user_id', userData.user.id)
      .order('sort_order', { ascending: true });
    setHandImages((prev) => ({ ...prev, [reviewHandId]: ((data ?? []) as { id: string; image_url: string; caption: string }[]) }));
  };

  const handleImageUpload = async (file: File) => {
    const handId = currentHandIdRef.current;
    if (!handId) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setImageUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${userData.user.id}/${handId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('user-uploads').upload(path, file);
    if (error) { setImageUploading(false); return; }
    const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(path);
    const { data: existing } = await supabase.from('sv_review_hand_images').select('id')
      .eq('review_hand_id', handId).eq('user_id', userData.user.id);
    await supabase.from('sv_review_hand_images').insert({
      review_hand_id: handId, user_id: userData.user.id,
      image_url: urlData.publicUrl, sort_order: (existing ?? []).length,
    });
    await loadImages(handId);
    setImageUploading(false);
  };

  const handleDeleteImage = async (imageId: string) => {
    const handId = currentHandIdRef.current;
    if (!handId) return;
    await supabase.from('sv_review_hand_images').delete().eq('id', imageId);
    await loadImages(handId);
  };

  const saveNote = useCallback(async (reviewHandId: string, content: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setNoteSaveState('saving');
    const result = await saveStudentNote(reviewHandId, userData.user.id, content, activeSubmission?.exchange_count ?? 0);
    if (!result.ok) return;
    setNoteSaveState('saved');
    setNoteDirty(false);
    setTimeout(() => setNoteSaveState('idle'), 1500);
  }, [activeSubmission?.exchange_count]);

  const onNoteChange = (content: string) => {
    setNoteDraft(content);
    setNoteDirty(true);
    const handId = currentHandIdRef.current;
    if (!handId) return;
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(() => void saveNote(handId, content), 600);
  };

  const handleSaveNotesClick = () => {
    const handId = currentHandIdRef.current;
    if (!handId) return;
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    void saveNote(handId, noteDraft);
  };

  useEffect(() => {
    return () => {
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
      const handId = currentHandIdRef.current;
      if (handId && noteDraft) void saveNote(handId, noteDraft);
    };
  }, [selectedHandIndex]);

  const saveBatchNote = useCallback(async (batchId: string, content: string) => {
    setBatchNoteSaveState('saving');
    await updateBatchDescription(batchId, content || null);
    setBatchNoteSaveState('saved');
    setTimeout(() => setBatchNoteSaveState('idle'), 1500);
  }, []);

  const onBatchNoteChange = (content: string) => {
    setBatchNote(content);
    // Save batch notes to the working batch if one exists, otherwise the current imported batch
    const targetBatch = workingBatchRef.current ?? currentBatch;
    if (!targetBatch) return;
    if (batchNoteTimerRef.current) clearTimeout(batchNoteTimerRef.current);
    batchNoteTimerRef.current = setTimeout(() => void saveBatchNote(targetBatch.id, content), 600);
  };

  const toggleTag = async (tag: HandTag) => {
    const handId = currentHandIdRef.current;
    if (!handId) return;
    const current = handTags[handId] ?? [];
    const has = current.includes(tag);
    const isDemo = handId.startsWith('demo-review-');
    if (has) {
      setHandTags((prev) => ({ ...prev, [handId]: current.filter((t) => t !== tag) }));
      if (!isDemo) {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        await supabase.from('sv_hand_note_tags').delete()
          .eq('review_hand_id', handId).eq('author_id', userData.user.id).eq('tag', tag);
      }
    } else {
      setHandTags((prev) => ({ ...prev, [handId]: [...current, tag] }));
      if (!isDemo) {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        await supabase.from('sv_hand_note_tags').insert({ review_hand_id: handId, author_id: userData.user.id, tag });
      }
    }
  };

  const handleToggleMarkForCoach = async (reviewHandId: string) => {
    const hand = hands.find((h) => h.id === reviewHandId);
    if (!hand) return;
    const newVal = !hand.marked_for_coach;
    setHands((prev) => prev.map((h) => h.id === reviewHandId ? { ...h, marked_for_coach: newVal } : h));
    if (!reviewHandId.startsWith('demo-review-')) await toggleMarkForCoach(reviewHandId, newVal);
  };

  const flashToast = (msg: string) => { setActionToast(msg); setTimeout(() => setActionToast(null), 2500); };
  const effectiveBatch = currentBatch ?? DEMO_REVIEW_SET;

  const handleRenameBatch = async () => {
    if (!currentBatch) return;
    const name = batchNameDraft.trim();
    if (!name) return;
    const ok = await renameBatch(currentBatch.id, name);
    if (ok) {
      setEditingBatchName(false);
      if (onBatchRenamed) onBatchRenamed();
      flashToast('Workspace renamed');
    }
  };

  const saveWorkspaceAs = useCallback(async () => {
    if (!currentUserId || hands.length === 0) return;
    const title = batchNameDraft.trim() || `${effectiveBatch.title} Copy`;
    const copy = await createBatch(currentUserId, title, 'mixed', null, 'hh_bundle');
    if (!copy) { flashToast('Could not create a saved copy'); return; }
    const rows = hands.filter((h) => h.source !== 'constructed' && h.source !== 'demo').map((h, index) => ({
      hand_id: h.hand_id ?? h.id,
      raw_hand_text: h.raw_hand_text ?? '',
      position: h.position,
      hero_cards: h.hero_cards,
      board: h.board,
      net_result: h.net_result,
      stack_size: h.stack_size,
      blinds: h.blinds,
      pot_amount: h.pot_amount,
      site: h.site ?? 'unknown',
      game_mode: h.game_mode ?? 'cash',
      tournament_id: h.tournament_id,
      played_at: h.played_at,
      saw_flop: h.saw_flop ?? false,
      saw_turn: h.saw_turn ?? false,
      saw_river: h.saw_river ?? false,
      showdown: h.showdown ?? false,
      hero_name: h.hero_name,
      parsed_ok: h.parsed_ok,
      parse_error: h.parse_error,
      hand_fingerprint: h.hand_id ?? h.id,
    }));
    const result = await addHandsToBatch(copy.id, rows, 0);
    if (result.added > 0) {
      if (onReloadBatches) onReloadBatches();
      flashToast(`Saved a new copy with ${result.added} hands`);
    } else {
      flashToast('Saved copy created without parsed hands');
    }
  }, [currentUserId, hands, batchNameDraft, effectiveBatch.title, onReloadBatches]);

  const saveWorkspace = useCallback(async () => {
    if (!currentBatch) return;
    const { error } = await supabase.from('sv_review_sets').update({ updated_at: new Date().toISOString() }).eq('id', currentBatch.id);
    flashToast(error ? 'Could not save workspace' : 'Workspace saved');
  }, [currentBatch]);

  const navigateHand = (dir: 'prev' | 'next') => {
    if (dir === 'prev' && selectedHandIndex > 0) setSelectedHandIndex(selectedHandIndex - 1);
    else if (dir === 'next' && selectedHandIndex < filteredHands.length - 1) setSelectedHandIndex(selectedHandIndex + 1);
  };

  const currentHand = selectedHandIndex >= 0 && selectedHandIndex < filteredHands.length
    ? hands.find((h) => h.id === (filteredHands[selectedHandIndex] as unknown as ReviewHand).id)
    : null;
  const currentTags = currentHand ? (handTags[currentHand.id] ?? []) : [];
  const hasActiveCoach = activeRelationships.length > 0;
  const selectedRel = activeRelationships.find((r) => r.id === selectedRelationshipId);
  const selectedCoachId = selectedRel
    ? (selectedRel.user_a === coachId ? selectedRel.user_b : selectedRel.user_a)
    : coachId;

  const handleHandAction = useCallback((action: HandMenuAction, hand: ReviewHand) => {
    if (action === 'replay') {
      const idx = filteredHands.findIndex((h) => (h as unknown as ReviewHand).id === hand.id);
      if (idx >= 0) setSelectedHandIndex(idx);
      if (hand.normalizedHand) setReplayerHand(hand.normalizedHand);
      flashToast('Loaded hand in replayer');
    } else if (action === 'copyId') {
      void navigator.clipboard.writeText(hand.hand_id ?? hand.id);
      flashToast('Hand ID copied');
    } else if (action === 'copyLink') {
      const url = manualHandUrl(hand.hand_id ?? hand.id);
      void navigator.clipboard.writeText(url);
      flashToast('Replay link copied');
    } else if (action === 'save') {
      if (!currentUserId) { flashToast('Sign in to save hands'); return; }
      void (async () => {
        const ok = await saveHand(currentUserId, hand.hand_id ?? hand.id, currentUserId);
        if (ok) {
          setSavedHandIds((prev) => new Set(prev).add(hand.hand_id ?? hand.id));
          flashToast('Hand saved');
        }
      })();
    } else if (action === 'unsave') {
      if (!currentUserId) return;
      void (async () => {
        const ok = await unsaveHand(currentUserId, hand.hand_id ?? hand.id, currentUserId);
        if (ok) {
          setSavedHandIds((prev) => {
            const next = new Set(prev);
            next.delete(hand.hand_id ?? hand.id);
            return next;
          });
          flashToast('Hand unsaved');
        }
      })();
    } else if (action === 'addToSpot') {
      setActionMenuTarget(hand);
      setShowAddToSpotModal(true);
      void (async () => {
        setSpotLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) { setSpotLoading(false); return; }
        const spots = await fetchMySpots(userData.user.id);
        setSpotDrafts(spots.filter((s) => s.status === 'draft'));
        setSpotLoading(false);
      })();
    } else if (action === 'addToBatch') {
      if (!currentUserId) { flashToast('Sign in to use batches'); return; }
      const existingBatchHand = workingBatchHands.find((wbh) => wbh.hand_id === hand.hand_id);
      if (existingBatchHand) {
        void (async () => {
          const ok = await removeWorkingBatchHand(existingBatchHand.id);
          if (ok) {
            await reloadWorkingBatch();
            flashToast('Removed from batch');
          } else {
            flashToast('Failed to remove from batch');
          }
        })();
        return;
      }
      void (async () => {
        // Use ref to avoid race condition with stale workingBatch state
        let wb = workingBatchRef.current;
        if (!wb) {
          wb = await createWorkingBatch(currentUserId);
          if (!wb) { flashToast('Could not create batch'); return; }
          workingBatchRef.current = wb;
          setWorkingBatch(wb);
        }
        const result = await addHandToWorkingBatch(wb.id, {
          hand_id: hand.hand_id ?? hand.id,
          raw_hand_text: hand.raw_hand_text ?? undefined,
          position: hand.position ?? null,
          hero_cards: hand.hero_cards ?? null,
          board: hand.board ?? null,
          net_result: hand.net_result ?? null,
          stack_size: hand.stack_size ?? null,
          blinds: hand.blinds ?? null,
          pot_amount: hand.pot_amount ?? null,
          site: hand.site ?? null,
          game_mode: hand.game_mode ?? null,
          tournament_id: hand.tournament_id ?? null,
          played_at: hand.played_at ?? null,
          saw_flop: hand.saw_flop ?? false,
          saw_turn: hand.saw_turn ?? false,
          saw_river: hand.saw_river ?? false,
          showdown: hand.showdown ?? false,
          hero_name: hand.hero_name ?? null,
          hand_fingerprint: hand.hand_id ?? hand.id,
        });
        if (result.ok) {
          flashToast('Added to batch');
          await reloadWorkingBatch();
        } else {
          flashToast(result.error ?? 'Failed to add to batch');
        }
      })();
    } else if (action === 'addToMsa') {
      setActionMenuTarget(hand);
      setShowAddToMsaModal(true);
      void (async () => {
        setSpotLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) { setSpotLoading(false); return; }
        const msas = await fetchMyMultiSpotAnalyses(userData.user.id);
        setMsaDrafts(msas.filter((s) => s.status === 'draft'));
        setSpotLoading(false);
      })();
    } else if (action === 'rename') {
      setActionMenuTarget(hand);
      setRenameDraft(hand.hand_title ?? '');
      setShowRenameModal(true);
    } else if (action === 'delete') {
      setActionMenuTarget(hand);
      setShowDeleteConfirm(true);
    }
  }, [filteredHands, workingBatchHands, currentUserId, reloadWorkingBatch]);

  const addHandToSpot = useCallback(async (spot: ContentSpot) => {
    if (!actionMenuTarget) return;
    const handId = actionMenuTarget.hand_id ?? actionMenuTarget.id;
    const blocks = spot.content_blocks ?? [];
    const newBlock = { id: `block-${Date.now()}`, type: 'hand_replay' as const, hand_id: handId };
    const updated = [...blocks, newBlock];
    const result = await updateExistingSpot({ ...spot, content_blocks: updated });
    if (result) {
      flashToast(`Added to "${spot.title || 'Untitled Spot'}"`);
    } else {
      flashToast('Failed to add to spot');
    }
    setShowAddToSpotModal(false);
    setActionMenuTarget(null);
  }, [actionMenuTarget]);

  const addHandToNewSpot = useCallback(async () => {
    if (!actionMenuTarget) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setSpotLoading(true);
    const newSpot = await createNewSpot(userData.user.id, userData.user.email ?? 'User');
    if (newSpot) {
      const handId = actionMenuTarget.hand_id ?? actionMenuTarget.id;
      const newBlock = { id: `block-${Date.now()}`, type: 'hand_replay' as const, hand_id: handId };
      const result = await updateExistingSpot({ ...newSpot, content_blocks: [newBlock] });
      if (result) flashToast('Created new spot with hand replay');
    } else {
      flashToast('Failed to create spot');
    }
    setSpotLoading(false);
    setShowAddToSpotModal(false);
    setActionMenuTarget(null);
  }, [actionMenuTarget]);

  const addHandToMsa = useCallback(async (spot: ContentSpot) => {
    if (!actionMenuTarget) return;
    const handId = actionMenuTarget.hand_id ?? actionMenuTarget.id;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? '';
    const existing = await fetchMsaEntries(spot.id);
    const newEntry: MsaEntryInput = {
      hand_id: handId,
      hand_user_id: userId,
      hero_cards: actionMenuTarget.hero_cards ?? null,
      board: actionMenuTarget.board ?? null,
      blinds: actionMenuTarget.blinds ?? null,
      net_result: actionMenuTarget.net_result ?? null,
      pot_amount: null,
      position: actionMenuTarget.position ?? null,
      played_at: actionMenuTarget.played_at ?? null,
      tournament_id: actionMenuTarget.tournament_id ?? null,
    };
    const allEntries = [...existing.map(e => ({
      hand_id: e.hand_id, hand_user_id: e.hand_user_id,
      hand_title: e.hand_title, creator_analysis: e.creator_analysis,
      key_takeaway: e.key_takeaway, evidence_url: e.evidence_url,
      evidence_caption: e.evidence_caption, hero_cards: e.hero_cards,
      board: e.board, blinds: e.blinds, net_result: e.net_result,
      pot_amount: e.pot_amount, position: e.position, played_at: e.played_at,
      tournament_id: e.tournament_id,
    })), newEntry];
    const ok = await setMsaEntries(spot.id, allEntries);
    if (ok) {
      flashToast(`Added to "${spot.title || 'Untitled MSA'}"`);
    } else {
      flashToast('Failed to add to MSA');
    }
    setShowAddToMsaModal(false);
    setActionMenuTarget(null);
  }, [actionMenuTarget]);

  const addHandToNewMsa = useCallback(async () => {
    if (!actionMenuTarget) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setSpotLoading(true);
    const spotId = await createMultiSpotAnalysis(
      userData.user.id,
      userData.user.email ?? 'User',
      'New Multi-Spot Analysis',
      '',
    );
    if (spotId) {
      const handId = actionMenuTarget.hand_id ?? actionMenuTarget.id;
      const entry: MsaEntryInput = {
        hand_id: handId,
        hand_user_id: userData.user.id,
        hero_cards: actionMenuTarget.hero_cards ?? null,
        board: actionMenuTarget.board ?? null,
        blinds: actionMenuTarget.blinds ?? null,
        net_result: actionMenuTarget.net_result ?? null,
        position: actionMenuTarget.position ?? null,
        played_at: actionMenuTarget.played_at ?? null,
        tournament_id: actionMenuTarget.tournament_id ?? null,
      };
      await setMsaEntries(spotId, [entry]);
      flashToast('Created new Multi-Spot Analysis');
    } else {
      flashToast('Failed to create MSA');
    }
    setSpotLoading(false);
    setShowAddToMsaModal(false);
    setActionMenuTarget(null);
  }, [actionMenuTarget]);

  const confirmRename = useCallback(async () => {
    if (!actionMenuTarget) return;
    const recordId = actionMenuTarget.id.replace('constructed-', '');
    const title = renameDraft.trim();
    if (!title) return;
    await renameManualHand(recordId, title);
    void loadConstructedHands();
    setShowRenameModal(false);
    setActionMenuTarget(null);
    flashToast('Hand renamed');
  }, [actionMenuTarget, renameDraft, loadConstructedHands]);

  const confirmDelete = useCallback(async () => {
    if (!actionMenuTarget) return;
    const recordId = actionMenuTarget.id.replace('constructed-', '');
    await deleteManualHand(recordId);
    // Remove from saved bookmarks if present
    const handId = actionMenuTarget.hand_id ?? actionMenuTarget.id;
    setSavedHandIds((prev) => {
      const next = new Set(prev);
      next.delete(handId);
      return next;
    });
    // Clear selection if the deleted hand was selected
    const deleteIdx = filteredHands.findIndex((h) => (h as unknown as ReviewHand).id === actionMenuTarget.id);
    if (deleteIdx === selectedHandIndex) {
      setSelectedHandIndex(-1);
      setReplayerHand(null);
    }
    void loadConstructedHands();
    setShowDeleteConfirm(false);
    setActionMenuTarget(null);
    flashToast('Hand deleted');
  }, [actionMenuTarget, loadConstructedHands, filteredHands, selectedHandIndex]);

  const handleBatchComplete = useCallback(async (selectedHands: ReviewHand[]) => {
    if (!currentUserId || selectedHands.length === 0) return;
    setBatchCompleting(true);
    const { data: userData } = await supabase.auth.getUser();
    const userName = userData.user?.email ?? 'User';
    const spotId = await createMultiSpotAnalysis(
      currentUserId,
      userName,
      `Multi-Spot (${selectedHands.length} hands)`,
      '',
    );
    if (spotId) {
      const entries: MsaEntryInput[] = selectedHands.map((h) => ({
        hand_id: h.hand_id ?? h.id,
        hand_user_id: currentUserId,
        hero_cards: h.hero_cards ?? null,
        board: h.board ?? null,
        blinds: h.blinds ?? null,
        net_result: h.net_result ?? null,
        position: h.position ?? null,
        played_at: h.played_at ?? null,
        tournament_id: h.tournament_id ?? null,
      }));
      await setMsaEntries(spotId, entries);
      flashToast(`Multi-Spot created with ${selectedHands.length} hands`);
    } else {
      flashToast('Failed to create Multi-Spot');
    }
    setBatchCompleting(false);
  }, [currentUserId]);

  // ── Working batch handlers ──
  const handleSelectBatchHand = useCallback(async (bh: WorkingBatchHand) => {
    setSelectedBatchHandId(bh.id);
    currentHandIdRef.current = bh.id;
    // Load the hand into the replayer
    if (bh.raw_hand_text) {
      const rec: Phase2HandRecord = {
        hand_id: bh.hand_id ?? 'unknown',
        site: bh.site, game_mode: bh.game_mode,
        hero_name: bh.hero_name, hero_cards: bh.hero_cards,
        position: bh.position, board: bh.board,
        raw_hand_text: bh.raw_hand_text, net_result: bh.net_result,
        stack_size: bh.stack_size, blinds: bh.blinds,
        pot_amount: bh.pot_amount, tournament_id: bh.tournament_id,
        played_at: bh.played_at, showdown: bh.showdown,
        saw_flop: bh.saw_flop, saw_turn: bh.saw_turn, saw_river: bh.saw_river,
        action_sequence: [],
      };
      setReplayerHand(phase2HandToNormalized(rec));
    }
    // Load notes for this batch hand
    void loadNote(bh.id);
  }, []);

  const handleReorderBatch = useCallback(async (orderedIds: string[]) => {
    if (!workingBatch) return;
    // Optimistically update local state
    setWorkingBatchHands((prev) => {
      const map = new Map(prev.map((h) => [h.id, h]));
      return orderedIds.map((id) => map.get(id)!).filter(Boolean);
    });
    await reorderWorkingBatchHands(workingBatch.id, orderedIds);
  }, [workingBatch]);

  const handleRemoveFromBatch = useCallback(async (handRowId: string) => {
    const ok = await removeWorkingBatchHand(handRowId);
    if (ok) {
      if (selectedBatchHandId === handRowId) {
        setSelectedBatchHandId(null);
        setReplayerHand(null);
      }
      await reloadWorkingBatch();
      flashToast('Removed from batch');
    }
  }, [selectedBatchHandId, reloadWorkingBatch]);

  const handleCreateBatch = useCallback(() => {
    if (workingBatchHands.length === 0) return;
    setShowCreateBatchModal(true);
  }, [workingBatchHands.length]);

  const handleSaveBatch = useCallback(async () => {
    if (!currentUserId || !workingBatchRef.current || workingBatchHands.length === 0) return;
    setBatchSaving(true);
    const wb = workingBatchRef.current;
    // Save: update title + description on the working batch row, keep it as working
    if (wb.title === 'Untitled Batch') {
      await renameBatch(wb.id, `Batch (${workingBatchHands.length} hands)`);
    }
    // Batch notes are already auto-saved via onBatchNoteChange
    await supabase.from('sv_review_sets').update({ updated_at: new Date().toISOString() }).eq('id', wb.id);
    setBatchSaving(false);
    flashToast('Batch saved');
  }, [currentUserId, workingBatchHands.length, flashToast]);

  const handleCompleteBatch = useCallback(() => {
    if (workingBatchHands.length === 0) return;
    setShowCompleteBatchModal(true);
  }, [workingBatchHands.length]);

  const confirmCompleteBatch = useCallback(async (title: string) => {
    if (!currentUserId || !workingBatchRef.current) return;
    setBatchCompletingFlag(true);
    const { data: userData } = await supabase.auth.getUser();
    const userName = userData.user?.email ?? 'User';
    const wb = workingBatchRef.current;
    // Update title before saving
    if (title.trim()) {
      await renameBatch(wb.id, title.trim());
    }
    const result = await saveWorkingBatchAsMultiSpot({
      userId: currentUserId,
      userName,
      batchId: wb.id,
      title: title.trim() || wb.title || 'Untitled Batch',
    });
    setBatchCompletingFlag(false);
    if (result.ok) {
      flashToast('Batch completed — saved to My Spots');
      setShowCompleteBatchModal(false);
      setWorkingBatch(null);
      workingBatchRef.current = null;
      setWorkingBatchHands([]);
      setSelectedBatchHandId(null);
      if (onReloadBatches) onReloadBatches();
    } else {
      flashToast(result.error ?? 'Failed to complete batch');
    }
  }, [currentUserId, onReloadBatches, flashToast]);

  const confirmCreateBatch = useCallback(async () => {
    if (!currentUserId || !workingBatchRef.current) return;
    setBatchSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userName = userData.user?.email ?? 'User';
    const wb = workingBatchRef.current;
    const result = await saveWorkingBatchAsMultiSpot({
      userId: currentUserId,
      userName,
      batchId: wb.id,
      title: wb.title || 'Untitled Batch',
    });
    setBatchSaving(false);
    if (result.ok) {
      flashToast('Batch saved to My Spots');
      setShowCreateBatchModal(false);
      // Clear working batch state
      setWorkingBatch(null);
      workingBatchRef.current = null;
      setWorkingBatchHands([]);
      setSelectedBatchHandId(null);
      if (onReloadBatches) onReloadBatches();
    } else {
      flashToast(result.error ?? 'Failed to save batch');
    }
  }, [currentUserId, onReloadBatches, flashToast]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-full min-h-0 flex-col gap-1.5"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-[#d4a52c]/60 bg-[#d4a52c]/5">
          <p className="text-sm font-bold uppercase tracking-widest text-[#f5e6b0]">Drop Hand History to Import</p>
        </div>
      )}

      {/* ── NOTES COLUMN (left) | REPLAYER (center) | HAND RAIL (right) ── */}
      <div className="flex min-h-0 flex-1 gap-1.5">

        {/* ══ LEFT: Notes column — single editor with HAND | BATCH toggle ══ */}
        {!isMobile && (
          <div className="flex w-[18%] min-w-[160px] max-w-[220px] shrink-0 flex-col gap-1.5">

            <div className="flex min-h-0 flex-1 flex-col rounded-xl border" style={{ borderColor: BORDER, background: SECTION_BG, backdropFilter: 'blur(8px)' }}>
              {/* Mode toggle: HAND | BATCH */}
              <div className="flex shrink-0 items-center gap-0.5 border-b px-2 py-1.5" style={{ borderColor: BORDER }}>
                <button
                  onClick={() => { setBatchNoteMode('hand'); setNotesOpen(true); setBatchOpen(false); }}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition ${batchNoteMode === 'hand' ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/60'}`}
                >
                  <StickyNote className="h-3 w-3" /> Hand
                </button>
                <button
                  onClick={() => { setBatchNoteMode('batch'); setBatchOpen(true); setNotesOpen(false); }}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition ${batchNoteMode === 'batch' ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/60'}`}
                >
                  <MessageSquare className="h-3 w-3" /> Batch
                </button>
                {(batchNoteMode === 'hand' ? noteSaveState : batchNoteSaveState) !== 'idle' && (
                  <span className="ml-auto text-[7px] text-white/25">{(batchNoteMode === 'hand' ? noteSaveState : batchNoteSaveState) === 'saving' ? 'Saving…' : 'Saved'}</span>
                )}
              </div>

              {/* HAND notes editor */}
              {batchNoteMode === 'hand' && (
                <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2.5">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => onNoteChange(e.target.value)}
                    placeholder="Notes for this hand…"
                    className="min-h-0 flex-1 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-2.5 text-[10px] leading-relaxed text-white/80 placeholder-white/20 focus:border-[#d4a52c]/40 focus:outline-none"
                  />
                  <div className="mt-2 flex shrink-0 items-center justify-between border-t pt-2" style={{ borderColor: BORDER }}>
                    {noteDirty ? (
                      <span className="text-[7px] font-semibold text-amber-300/70">Unsaved changes</span>
                    ) : noteSaveState === 'saved' ? (
                      <span className="flex items-center gap-1 text-[7px] font-semibold text-emerald-400/80"><Check className="h-2.5 w-2.5" /> Saved</span>
                    ) : (
                      <span className="text-[7px] text-white/20">Auto-saved</span>
                    )}
                    <button
                      onClick={handleSaveNotesClick}
                      disabled={!noteDirty || noteSaveState === 'saving'}
                      className="hdr-gold-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      {noteSaveState === 'saving' ? <span className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/60" /> : <Save className="hdr-gold-icon h-3 w-3 shrink-0" strokeWidth={1.5} />}
                      Save Notes
                    </button>
                  </div>
                </div>
              )}

              {/* BATCH notes editor + submit actions */}
              {batchNoteMode === 'batch' && (
                <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2.5">
                  <textarea
                    value={batchNote}
                    onChange={(e) => onBatchNoteChange(e.target.value)}
                    placeholder="Session notes, context, focus areas…"
                    className="min-h-0 flex-1 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-2.5 text-[10px] leading-relaxed text-white/80 placeholder-white/20 focus:border-[#d4a52c]/40 focus:outline-none"
                  />
                  <div className="mt-2 flex shrink-0 items-center justify-end gap-1.5 border-t pt-2" style={{ borderColor: BORDER }}>
                    <button
                      onClick={() => setShowSubmitModal(true)}
                      disabled={!hasActiveCoach}
                      className="flex items-center gap-1 rounded-md border border-[#d4a52c]/40 bg-[#c0911e]/15 px-2.5 py-1.5 text-[9px] font-bold uppercase text-[#f5e6b0] transition disabled:cursor-not-allowed disabled:opacity-30 hover:bg-[#c0911e]/25"
                    >
                      <Send className="h-3 w-3" /> Send to Coach
                    </button>
                    {canPublish && currentBatch && (
                      <button
                        onClick={() => setShowJukeboxModal(true)}
                        className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[9px] font-bold uppercase text-white/55 transition hover:bg-white/10"
                      >
                        <AudioLines className="h-3 w-3" /> Publish
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ CENTER: Replayer column ═══════════════════════════════════ */}
        <div className={`relative flex min-h-0 min-w-0 flex-1 flex-col gap-1 ${isMobile ? 'overflow-y-auto' : ''}`}>

          {/* Primary hand-history control bar */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 sm:px-4" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.72)', backdropFilter: 'blur(8px)' }}>
            <div className="min-w-0 flex-1">
              {editingBatchName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={batchNameDraft}
                    onChange={(e) => setBatchNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleRenameBatch(); if (e.key === 'Escape') setEditingBatchName(false); }}
                    autoFocus
                    className="min-w-0 flex-1 rounded-md border border-[#d4a52c]/40 bg-black/40 px-2 py-1 text-[11px] font-semibold text-white outline-none"
                  />
                  <button onClick={() => void handleRenameBatch()} className="rounded-md border border-[#d4a52c]/40 bg-[#c0911e]/15 p-1 text-[#f5e6b0]" aria-label="Save name"><Check className="h-3 w-3" /></button>
                  <button onClick={() => setEditingBatchName(false)} className="rounded-md border border-white/10 p-1 text-white/40" aria-label="Cancel rename"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <button
                  onClick={() => { setBatchNameDraft(effectiveBatch.title); setEditingBatchName(true); }}
                  className="group flex max-w-full items-center gap-1.5 text-left"
                  title="Rename workspace"
                >
                  <span className="truncate text-[12px] font-bold text-white sm:text-sm">{effectiveBatch.title}</span>
                  <Pencil className="h-3 w-3 shrink-0 text-white/30 transition group-hover:text-[#d4a52c]" />
                </button>
              )}
              <p className="mt-0.5 text-[8px] tracking-wide text-white/30 uppercase">Hand history workspace</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="relative">
                <button onClick={() => setSaveMenuOpen((v) => !v)} className="hdr-glass-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest">
                  <Save className="hdr-glass-icon h-3 w-3 shrink-0" strokeWidth={1.5} /> Save <ChevronDown className="hdr-glass-icon h-2.5 w-2.5" />
                </button>
                {saveMenuOpen && (
                  <div className="absolute right-0 top-full z-[220] mt-1 w-36 rounded-lg border border-[#d4a52c]/25 bg-[#0d0f12] p-1 shadow-2xl">
                    <button onClick={() => { setSaveMenuOpen(false); void saveWorkspace(); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[9px] font-bold uppercase text-white/70 hover:bg-white/5 hover:text-white"><Save className="h-3 w-3" /> Save</button>
                    <button onClick={() => { setSaveMenuOpen(false); setBatchNameDraft(`${effectiveBatch.title} Copy`); setEditingBatchName(true); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[9px] font-bold uppercase text-white/70 hover:bg-white/5 hover:text-white"><Layers3 className="h-3 w-3" /> Save As</button>
                  </div>
                )}
              </div>
              <span className="hidden text-[9px] font-semibold text-white/45 sm:inline">Hand {replayerHand ? selectedHandIndex + 1 : 0} of {filteredHands.length}</span>
              <button onClick={() => navigateHand('prev')} disabled={selectedHandIndex <= 0} className="rounded border border-white/10 p-1.5 text-white/50 transition disabled:opacity-25 hover:bg-white/5" aria-label="Previous hand"><ChevronLeft className="h-3.5 w-3.5" /></button>
              <button onClick={() => navigateHand('next')} disabled={selectedHandIndex >= filteredHands.length - 1} className="rounded border border-white/10 p-1.5 text-white/50 transition disabled:opacity-25 hover:bg-white/5" aria-label="Next hand"><ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>

          {/* Replayer body — presentation controls integrated into playback bar */}
          <div className={`min-h-0 overflow-hidden ${isMobile ? 'shrink-0 max-h-[45vh]' : 'flex-1'}`}>
            <HHReplayer
              hand={replayerHand ?? undefined}
              variant="embedded"
              visualSize="main"
              fitToContainer={true}
              cardScale={0.8}
              leftControls={
                <PresentationInlineControls
                  mode={recorder.mode}
                  recorderState={recorder.recorderState}
                  elapsed={recorder.elapsed}
                  active={presentationMode}
                  hasUnsavedRecording={recorder.hasUnsavedRecording}
                  onSelectMode={recorder.setMode}
                  onRecord={() => void recorder.startRecording()}
                  onPause={recorder.pauseRecording}
                  onResume={recorder.resumeRecording}
                  onStop={recorder.stopRecording}
                  onDiscard={recorder.discardRecording}
                  onSave={() => { recorder.setShowSaveDialog(true); }}
                />
              }
              rightControls={
                <PresentationRightControls
                  mode={recorder.mode}
                  elapsed={recorder.elapsed}
                  active={presentationMode}
                  onAddSyncMarker={recorder.addSyncMarker}
                  syncMode={recorder.mode === 'sync'}
                />
              }
            />
          </div>

          {/* Hidden video element for video recording preview */}
          <video ref={recorder.videoRef} className="hidden" muted playsInline />

          {/* Save dialog for presentation recordings */}
          {recorder.showSaveDialog && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#f5e6b0]">Save Recording</span>
                  <button onClick={() => recorder.setShowSaveDialog(false)} className="text-white/40 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="p-4 space-y-3">
                  {recorder.error && <p className="text-[10px] text-red-300/80">{recorder.error}</p>}
                  <input
                    value={recorder.saveTitle}
                    onChange={(e) => recorder.setSaveTitle(e.target.value)}
                    placeholder="Recording title…"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => recorder.setShowSaveDialog(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
                    <button
                      onClick={() => void recorder.saveRecording()}
                      disabled={!recorder.saveTitle.trim() || recorder.saving}
                      className="rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/20 px-3 py-1.5 text-[10px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/30"
                    >
                      {recorder.saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Unsaved recording warning when turning off presentation mode */}
          {presentationSavePrompt && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
                <div className="p-4 space-y-3 text-center">
                  <p className="text-[11px] text-white/80">You have an unsaved recording. Save it before leaving?</p>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => { recorder.discardRecording(); setPresentationSavePrompt(false); }}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase text-white/50 hover:text-white/70"
                    >Discard</button>
                    <button
                      onClick={() => { recorder.setShowSaveDialog(true); setPresentationSavePrompt(false); }}
                      className="rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/20 px-3 py-1.5 text-[10px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/30"
                    >Save</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mobile compact hand navigation: prev/next + drawer */}
          {isMobile && filteredHands.length > 0 && (
            <MobileHandNav
              filteredHands={filteredHands}
              hands={hands}
              classified={classified}
              selectedHandIndex={selectedHandIndex}
              savedHandIds={savedHandIds}
              onSelectHand={(idx) => setSelectedHandIndex(idx)}
              onPrev={() => navigateHand('prev')}
              onNext={() => navigateHand('next')}
              onHandAction={handleHandAction}
              workingBatchHands={workingBatchHands}
              currentUserId={currentUserId}
              batches={batches}
              onReloadBatches={onReloadBatches}
            />
          )}

          {/* Mobile: unified notes with HAND | BATCH toggle */}
          {isMobile && (
            <div className="shrink-0 rounded-xl border" style={{ borderColor: BORDER, background: SECTION_BG, backdropFilter: 'blur(8px)' }}>
              {/* Mode toggle */}
              <div className="flex items-center gap-0.5 border-b px-2 py-1.5" style={{ borderColor: BORDER }}>
                <button
                  onClick={() => { setBatchNoteMode('hand'); setNotesOpen(true); setBatchOpen(false); }}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition ${batchNoteMode === 'hand' ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/60'}`}
                >
                  <StickyNote className="h-3 w-3" /> Hand
                </button>
                <button
                  onClick={() => { setBatchNoteMode('batch'); setBatchOpen(true); setNotesOpen(false); }}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition ${batchNoteMode === 'batch' ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/60'}`}
                >
                  <MessageSquare className="h-3 w-3" /> Batch
                </button>
                {(batchNoteMode === 'hand' ? noteSaveState : batchNoteSaveState) !== 'idle' && (
                  <span className="ml-auto text-[7px] text-white/25">{(batchNoteMode === 'hand' ? noteSaveState : batchNoteSaveState) === 'saving' ? 'Saving…' : 'Saved'}</span>
                )}
              </div>

              {batchNoteMode === 'hand' ? (
                <div className="px-3 pb-3 pt-2.5">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => onNoteChange(e.target.value)}
                    placeholder="Notes for this hand…"
                    className="h-32 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-2.5 text-[10px] leading-relaxed text-white/80 placeholder-white/20 focus:border-[#d4a52c]/40 focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: BORDER }}>
                    {noteDirty ? (
                      <span className="text-[7px] font-semibold text-amber-300/70">Unsaved changes</span>
                    ) : noteSaveState === 'saved' ? (
                      <span className="flex items-center gap-1 text-[7px] font-semibold text-emerald-400/80"><Check className="h-2.5 w-2.5" /> Saved</span>
                    ) : (
                      <span className="text-[7px] text-white/20">Auto-saved</span>
                    )}
                    <button
                      onClick={handleSaveNotesClick}
                      disabled={!noteDirty || noteSaveState === 'saving'}
                      className="hdr-gold-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      {noteSaveState === 'saving' ? <span className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/60" /> : <Save className="hdr-gold-icon h-3 w-3 shrink-0" strokeWidth={1.5} />}
                      Save Notes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-3 pb-3 pt-2.5">
                  <textarea
                    value={batchNote}
                    onChange={(e) => onBatchNoteChange(e.target.value)}
                    placeholder="Session notes, context, focus areas…"
                    className="h-32 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-2.5 text-[10px] leading-relaxed text-white/80 placeholder-white/20 focus:border-[#d4a52c]/40 focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-end gap-1.5 border-t pt-2" style={{ borderColor: BORDER }}>
                    <button
                      onClick={() => setShowSubmitModal(true)}
                      disabled={!hasActiveCoach}
                      className="flex items-center gap-1 rounded-md border border-[#d4a52c]/40 bg-[#c0911e]/15 px-2.5 py-1.5 text-[9px] font-bold uppercase text-[#f5e6b0] transition disabled:cursor-not-allowed disabled:opacity-30 hover:bg-[#c0911e]/25"
                    >
                      <Send className="h-3 w-3" /> Send to Coach
                    </button>
                    {canPublish && currentBatch && (
                      <button
                        onClick={() => setShowJukeboxModal(true)}
                        className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[9px] font-bold uppercase text-white/55 transition hover:bg-white/10"
                      >
                        <AudioLines className="h-3 w-3" /> Publish
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>{/* end replayer column */}

        {/* ══ RIGHT: Compact hand rail ══════════════════════════════════ */}
        {!isMobile && (
          <HandRail
            hands={hands}
            classified={classified}
            filteredHands={filteredHands}
            selectedHandIndex={selectedHandIndex}
            onSelectHand={(idx) => setSelectedHandIndex(idx)}
            collapsed={railCollapsed}
            onToggleCollapsed={() => setRailCollapsed((v) => !v)}
            onHandAction={handleHandAction}
            savedHandIds={savedHandIds}
            onBatchComplete={handleBatchComplete}
            workingBatchHands={workingBatchHands}
            workingBatchCount={workingBatchHands.length}
            onSelectBatchHand={handleSelectBatchHand}
            selectedBatchHandId={selectedBatchHandId}
            onReorderBatch={handleReorderBatch}
            onRemoveFromBatch={handleRemoveFromBatch}
            onCreateBatch={handleCreateBatch}
            onSaveBatch={handleSaveBatch}
            onCompleteBatch={handleCompleteBatch}
            currentUserId={currentUserId}
            batches={batches}
            onSelectBatch={onSelectBatch}
            onReloadBatches={onReloadBatches}
          />
        )}
      </div>{/* end 3-column layout */}

      {/* ══════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════ */}

      {/* Inbox */}
      {showInbox && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-white">Batch Inbox</h2>
              <button onClick={() => setShowInbox(false)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-4 space-y-2">
              {inboxItems.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-white/40">No messages</p>
              ) : inboxItems.map((item) => (
                <div key={item.id} className={`rounded-lg border p-3 ${item.is_read ? 'border-white/5 bg-white/[0.02]' : 'border-[#d4a52c]/20 bg-[#c0911e]/5'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold text-white/80">{item.event_type?.replace(/_/g, ' ')}</p>
                      {item.payload && typeof item.payload === 'object' && 'message' in item.payload && (
                        <p className="mt-0.5 text-[10px] text-white/50">{String((item.payload as Record<string, unknown>).message)}</p>
                      )}
                    </div>
                    {!item.is_read && (
                      <button
                        onClick={async () => { await markBatchEventRead(item.id); setInboxItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_read: true } : i)); setInboxUnread((n) => Math.max(0, n - 1)); }}
                        className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[8px] font-bold uppercase text-white/40 hover:text-white/60"
                      >Mark read</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Share to community */}
      {showShareModal && currentHand && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-white">Share to Community</h2>
              <button onClick={() => { setShowShareModal(false); setShareSuccess(false); }} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              {shareSuccess ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Check className="h-6 w-6 text-[#d4a52c]" />
                  <p className="text-sm font-semibold text-white">Shared!</p>
                  <button onClick={() => { setShowShareModal(false); setShareSuccess(false); setShareCaption(''); }} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Done</button>
                </div>
              ) : (
                <>
                  <textarea
                    value={shareCaption}
                    onChange={(e) => setShareCaption(e.target.value)}
                    placeholder="Caption or question for the community…"
                    className="h-20 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowShareModal(false)} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
                    <button
                      onClick={async () => {
                        setShareSubmitting(true);
                        const { error } = await supabase.from('community_posts').insert({
                          body: shareCaption.trim() || 'Shared a hand.',
                          attachment_type: 'hand', attachment_url: currentHand.id,
                          attachment_label: `Hand #${currentHand.hand_id?.slice(-4) ?? '?'}`,
                        });
                        setShareSubmitting(false);
                        if (!error) setShareSuccess(true);
                      }}
                      disabled={shareSubmitting}
                      className="rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/30"
                    >{shareSubmitting ? 'Sharing…' : 'Share'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Jukebox publish */}
      {showJukeboxModal && currentBatch && canPublish && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-white">Publish Batch</h2>
              <button onClick={() => { setShowJukeboxModal(false); setJukeboxSuccess(false); setJukeboxError(null); }} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              {jukeboxSuccess ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Check className="h-6 w-6 text-[#d4a52c]" />
                  <p className="text-sm font-semibold text-white">Published!</p>
                  <button onClick={() => { setShowJukeboxModal(false); setJukeboxSuccess(false); }} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Done</button>
                </div>
              ) : (
                <>
                  {jukeboxError && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/5 p-3 text-[11px] text-red-300">
                      <AlertCircle className="h-4 w-4 shrink-0" /> {jukeboxError}
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-white/45">Title</label>
                    <input value={jukeboxTitle} onChange={(e) => setJukeboxTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-white/45">Description</label>
                    <textarea value={jukeboxDesc} onChange={(e) => setJukeboxDesc(e.target.value)}
                      className="mt-1 h-16 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-semibold uppercase text-white/45">Type</label>
                      <select value={jukeboxType} onChange={(e) => setJukeboxType(e.target.value as ProductType)}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-[#15181c] px-3 py-2 text-[11px] text-white/80 focus:outline-none">
                        <option value="hand_pack">Hand Pack</option>
                        <option value="full_tournament">Full Tournament</option>
                      </select>
                    </div>
                    <div className="w-28">
                      <label className="text-[10px] font-semibold uppercase text-white/45">Price (credits)</label>
                      <input type="number" value={jukeboxPrice} onChange={(e) => setJukeboxPrice(Number(e.target.value))} min={0}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/80 focus:outline-none" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowJukeboxModal(false)} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
                    <button
                      onClick={async () => {
                        setJukeboxSubmitting(true); setJukeboxError(null);
                        const { data: userData } = await supabase.auth.getUser();
                        const userId = userData.user?.id ?? 'demo-user';
                        const productId = await publishProduct({
                          creator_id: userId, creator_name: 'SpotVault Creator',
                          title: jukeboxTitle.trim() || currentBatch.title,
                          description: jukeboxDesc.trim(), product_type: jukeboxType,
                          game_type: hands[0]?.game_mode ?? 'MTT', buy_in: hands[0]?.blinds ?? '',
                          theme: 'MTT', price: jukeboxPrice, thumbnail_color: '#d4a52c',
                          selected_hands: hands.filter((h) => h.source !== 'constructed' && h.source !== 'demo').map((h) => h.id), analysis_map: {},
                        });
                        setJukeboxSubmitting(false);
                        if (productId) setJukeboxSuccess(true);
                        else setJukeboxError('Publishing failed.');
                      }}
                      disabled={jukeboxSubmitting || hands.length === 0}
                      className="rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/30"
                    >{jukeboxSubmitting ? 'Publishing…' : `Publish ${hands.filter((h) => h.source !== 'constructed' && h.source !== 'demo').length} Hands`}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submit to coach */}
      {showSubmitModal && (
        <SubmitModal
          coachName={coachName ?? 'Coach'}
          markedCount={markedCount}
          filteredCount={filteredHands.length}
          totalCount={classified.length}
          batchName={effectiveBatch.title}
          hasActiveCoach={hasActiveCoach}
          activeRelationships={activeRelationships}
          selectedRelationshipId={selectedRelationshipId}
          onSelectRelationship={setSelectedRelationshipId}
          submitMessage={submitMessage}
          setSubmitMessage={setSubmitMessage}
          submitting={submitting}
          onClose={() => setShowSubmitModal(false)}
          onSubmit={async (type) => {
            if (!hasActiveCoach || !selectedCoachId) return;
            setSubmitting(true);
            let handIds: string[] = [];
            let title = '';

            if (type === 'marked_hands') {
              const marked = hands.filter((h) => h.marked_for_coach);
              handIds = marked.map((h) => h.id); title = `${marked.length} marked hands`;
            } else if (type === 'filtered_hands') {
              handIds = filteredHands.map((h) => (h as unknown as ReviewHand).id); title = `${filteredHands.length} filtered hands`;
            } else if (type === 'full_batch') {
              handIds = hands.filter((h) => h.source !== 'constructed').map((h) => h.id); title = currentBatch?.title ?? `${hands.filter((h) => h.source !== 'constructed').length} hands`;
            } else if (type === 'general_notes_only') {
              title = 'General notes';
            }

            if (handIds.length > 10) { setSubmitting(false); alert('Max 10 hands per submission.'); return; }

            const { data: subData, error: subError } = await supabase.rpc('sv_create_submission', {
              p_coach_id: selectedCoachId, p_title: title,
              p_student_note: submitMessage.trim() || null, p_priority: 'normal',
              p_relationship_id: selectedRelationshipId,
            });
            if (subError || !subData) { setSubmitting(false); return; }
            const submissionId = subData as string;
            for (const id of handIds) {
              await supabase.rpc('sv_add_submission_item', { p_submission_id: submissionId, p_resource_type: 'hand', p_resource_id: id, p_note: null });
            }
            if (currentBatch) {
              await supabase.rpc('sv_create_batch_event', {
                p_batch_id: currentBatch.id, p_event_type: 'coach_batch_submitted',
                p_recipient_id: selectedCoachId,
                p_payload: { submission_id: submissionId, title, hand_count: handIds.length },
              });
            }
            setSubmitting(false);
            setShowSubmitModal(false);
            setSubmitMessage('');
            setSubmitSuccess({ coachName: coachName ?? 'Coach', handCount: handIds.length });
            setTimeout(() => setSubmitSuccess(null), 5000);
          }}
        />
      )}

      {/* Submit success */}
      {submitSuccess && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] p-6 shadow-2xl text-center">
            <Check className="mx-auto h-8 w-8 text-[#d4a52c]" />
            <p className="mt-2 text-sm font-semibold text-white">Sent to {submitSuccess.coachName}</p>
            <p className="text-[10px] text-white/40">{submitSuccess.handCount} hand{submitSuccess.handCount !== 1 ? 's' : ''}</p>
            <button onClick={() => setSubmitSuccess(null)} className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Close</button>
          </div>
        </div>
      )}

      {/* Return for revision */}
      {showReturnConfirm && activeSubmission && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] p-5 shadow-2xl">
            <h2 className="mb-3 text-sm font-semibold text-white">Return for Revision</h2>
            <textarea value={returnMessage} onChange={(e) => setReturnMessage(e.target.value)}
              className="h-20 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowReturnConfirm(false)} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
              <button onClick={async () => { setReturning(true); await returnFeedback(activeSubmission.id, returnMessage.trim()); setReturning(false); setShowReturnConfirm(false); setReturnMessage(''); }} disabled={returning}
                className="rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/30"
              >{returning ? 'Sending…' : 'Return'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up */}
      {showFollowUpModal && activeSubmission && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] p-5 shadow-2xl">
            <h2 className="mb-3 text-sm font-semibold text-white">Send Follow-Up</h2>
            <textarea value={followUpMessage} onChange={(e) => setFollowUpMessage(e.target.value)}
              className="h-20 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowFollowUpModal(false)} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
              <button onClick={async () => { setSendingFollowUp(true); await sendFollowUp(activeSubmission.id, followUpMessage.trim()); setSendingFollowUp(false); setShowFollowUpModal(false); setFollowUpMessage(''); }} disabled={sendingFollowUp}
                className="rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/30"
              >{sendingFollowUp ? 'Sending…' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Construct a Hand */}
      {showConstructHand && (
        <ConstructHand
          onSave={(hand) => {
            setReplayerHand(hand);
            explicitHandKeyRef.current = hand.handId;
            void loadConstructedHands();
          }}
          onWatch={(hand) => {
            setShowConstructHand(false);
            setReplayerHand(hand);
            explicitHandKeyRef.current = hand.handId;
            void loadConstructedHands();
          }}
          onCancel={() => setShowConstructHand(false)}
        />
      )}

      {/* Create Batch modal */}
      {showCreateBatchModal && workingBatch && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-white">Create Batch</h2>
              <button onClick={() => setShowCreateBatchModal(false)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="text-[10px] font-semibold uppercase text-white/45">Title</label>
                <input
                  value={workingBatch.title || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setWorkingBatch((prev) => prev ? { ...prev, title: v } : prev);
                  }}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
                  placeholder="Untitled Batch"
                />
              </div>
              <p className="text-[10px] text-white/40">
                {workingBatchHands.length} hands will be saved as a MULTI-SPOT draft in My Spots.
                You can edit the title and cover image later.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreateBatchModal(false)} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
                <button
                  onClick={() => void confirmCreateBatch()}
                  disabled={batchSaving}
                  className="rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/30"
                >
                  {batchSaving ? 'Saving…' : 'Save to My Spots'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Batch modal */}
      {showCompleteBatchModal && workingBatchRef.current && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-white">Complete Batch</h2>
              <button onClick={() => setShowCompleteBatchModal(false)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="text-[10px] font-semibold uppercase text-white/45">Package Title</label>
                <input
                  value={workingBatchRef.current.title || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setWorkingBatch((prev) => prev ? { ...prev, title: v } : prev);
                    if (workingBatchRef.current) workingBatchRef.current = { ...workingBatchRef.current, title: v };
                  }}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
                  placeholder="Multi-Spot Analysis Title"
                />
              </div>
              <p className="text-[10px] text-white/40">
                {workingBatchHands.length} hands will be finalized as a Multi-Spot Analysis package in My Spots.
                The package will be saved as a draft — you can publish or price it later.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCompleteBatchModal(false)} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
                <button
                  onClick={() => void confirmCompleteBatch(workingBatchRef.current?.title ?? '')}
                  disabled={batchCompletingFlag}
                  className="rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/30"
                >
                  {batchCompletingFlag ? 'Completing…' : 'Complete & Save to My Spots'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action toast */}
      {actionToast && (
        <div className="fixed bottom-6 left-1/2 z-[400] -translate-x-1/2 rounded-lg border border-[#d4a52c]/40 bg-[#0d0f12] px-4 py-2.5 text-[11px] font-semibold text-[#f5e6b0] shadow-2xl">
          {batchCompleting ? 'Creating Multi-Spot…' : actionToast}
        </div>
      )}

      {/* Add to Spot modal */}
      {showAddToSpotModal && actionMenuTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-white">Add to Spot</h2>
              <button onClick={() => { setShowAddToSpotModal(false); setActionMenuTarget(null); }} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-4 space-y-2">
              <p className="text-[10px] text-white/40">Embed this hand as a replay block in an existing draft spot, or create a new one.</p>
              {spotLoading ? (
                <p className="py-4 text-center text-[11px] text-white/40">Loading…</p>
              ) : spotDrafts.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-white/40">No draft spots found.</p>
              ) : spotDrafts.map((spot) => (
                <button
                  key={spot.id}
                  onClick={() => void addHandToSpot(spot)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-[#d4a52c]/30 hover:bg-[#c0911e]/5"
                >
                  <span className="text-[11px] font-medium text-white/80">{spot.title || 'Untitled Spot'}</span>
                  <Plus className="h-3.5 w-3.5 text-white/30" />
                </button>
              ))}
            </div>
            <div className="border-t border-white/[0.08] p-4">
              <button
                onClick={() => void addHandToNewSpot()}
                disabled={spotLoading}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2.5 text-[10px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/30"
              >
                <Plus className="h-3.5 w-3.5" /> Create New Spot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Multi-Spot Analysis modal */}
      {showAddToMsaModal && actionMenuTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-white">Add to Multi-Spot Analysis</h2>
              <button onClick={() => { setShowAddToMsaModal(false); setActionMenuTarget(null); }} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-4 space-y-2">
              <p className="text-[10px] text-white/40">Add this hand to an existing draft Multi-Spot Analysis, or create a new one.</p>
              {spotLoading ? (
                <p className="py-4 text-center text-[11px] text-white/40">Loading…</p>
              ) : msaDrafts.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-white/40">No draft Multi-Spot Analyses found.</p>
              ) : msaDrafts.map((msa) => (
                <button
                  key={msa.id}
                  onClick={() => void addHandToMsa(msa)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-[#d4a52c]/30 hover:bg-[#c0911e]/5"
                >
                  <span className="text-[11px] font-medium text-white/80">{msa.title || 'Untitled MSA'}</span>
                  <BookOpen className="h-3.5 w-3.5 text-white/30" />
                </button>
              ))}
            </div>
            <div className="border-t border-white/[0.08] p-4">
              <button
                onClick={() => void addHandToNewMsa()}
                disabled={spotLoading}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2.5 text-[10px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/30"
              >
                <BookOpen className="h-3.5 w-3.5" /> Create New Multi-Spot Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {showRenameModal && actionMenuTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-white">Rename Hand</h2>
              <button onClick={() => { setShowRenameModal(false); setActionMenuTarget(null); }} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <input
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowRenameModal(false); setActionMenuTarget(null); }} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
                <button
                  onClick={() => void confirmRename()}
                  disabled={!renameDraft.trim()}
                  className="rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/30"
                >Rename</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && actionMenuTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-red-300/20 bg-[#0d0f12] p-5 shadow-2xl text-center">
            <Trash2 className="mx-auto h-8 w-8 text-red-300/70" />
            <p className="mt-3 text-sm font-semibold text-white">Delete constructed hand?</p>
            <p className="mt-1 text-[10px] text-white/40">This will permanently remove this constructed hand.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button onClick={() => { setShowDeleteConfirm(false); setActionMenuTarget(null); }} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
              <button
                onClick={() => void confirmDelete()}
                className="rounded-lg border border-red-400/50 bg-red-400/15 px-4 py-2 text-[10px] font-bold uppercase text-red-300 hover:bg-red-400/25"
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// MOBILE HAND NAVIGATION — compact prev/next + drawer
// ────────────────────────────────────────────────────────────────────────────
function MobileHandNav({
  filteredHands, hands, classified, selectedHandIndex, savedHandIds, onSelectHand, onPrev, onNext,
  onHandAction, workingBatchHands, currentUserId, batches, onReloadBatches,
}: {
  filteredHands: ClassifiedHand[];
  hands: ReviewHand[];
  classified: ClassifiedHand[];
  selectedHandIndex: number;
  savedHandIds: Set<string>;
  onSelectHand: (idx: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onHandAction: (action: HandMenuAction, hand: ReviewHand) => void;
  workingBatchHands: WorkingBatchHand[];
  currentUserId: string | null;
  batches: HandBatch[];
  onReloadBatches?: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // ── Unified filters & sorting ──
  const [unifiedFilters, setUnifiedFilters] = useState<UnifiedHandFilters>({ ...UNIFIED_DEFAULT_FILTERS });
  const [sortMode, setSortMode] = useState<UnifiedSortMode>('recent');
  const [interestingActive, setInterestingActive] = useState(false);
  const [interestingThreshold, setInterestingThreshold] = useState(3);

  // ── Review pack selection ──
  const [packSelectMode, setPackSelectMode] = useState(false);
  const [packSelected, setPackSelected] = useState<Set<string>>(new Set());
  const [packAction, setPackAction] = useState<'idle' | 'adding' | 'creating'>('idle');
  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [packToast, setPackToast] = useState<string | null>(null);

  const enrichedMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof enrichHand>>();
    for (const h of hands) {
      const cls = classified.find((c) => (c as unknown as { handId?: string }).handId === h.hand_id);
      map.set(h.id, enrichHand(h, cls));
    }
    return map;
  }, [hands, classified]);

  const displayed = useMemo(() => {
    let result = filteredHands;
    if (hasActiveUnifiedFilters(unifiedFilters)) {
      result = result.filter((h) => {
        const rh = (h as unknown as ReviewHand);
        const enriched = enrichedMap.get(rh.id);
        if (!enriched) return false;
        return matchesUnifiedFilters(enriched, unifiedFilters);
      });
    }
    if (interestingActive) {
      result = result.filter((h) => {
        const rh = (h as unknown as ReviewHand);
        const enriched = enrichedMap.get(rh.id);
        if (!enriched) return false;
        return isInterestingHand(enriched, interestingThreshold);
      });
    }
    const asReviewHands = result.map((h) => {
      const rh = hands.find((hr) => hr.id === (h as unknown as ReviewHand).id);
      return rh ?? (h as unknown as ReviewHand);
    });
    const sorted = sortHandsByMode(asReviewHands, sortMode);
    const sortedClassified = sorted.map((rh) => filteredHands.find((fc) => (fc as unknown as ReviewHand).id === rh.id)).filter(Boolean) as ClassifiedHand[];
    return sortedClassified;
  }, [filteredHands, hands, unifiedFilters, sortMode, interestingActive, interestingThreshold, enrichedMap]);

  const interestingCount = useMemo(() => {
    return filteredHands.filter((h) => {
      const rh = (h as unknown as ReviewHand);
      const enriched = enrichedMap.get(rh.id);
      if (!enriched) return false;
      return isInterestingHand(enriched, interestingThreshold);
    }).length;
  }, [filteredHands, enrichedMap, interestingThreshold]);

  const handlePackToggle = useCallback((rowId: string) => {
    setPackSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const handlePackSelectAll = useCallback(() => {
    setPackSelected(new Set(displayed.map((h) => (h as unknown as ReviewHand).id)));
  }, [displayed]);

  const handlePackDeselectAll = useCallback(() => {
    setPackSelected(new Set());
  }, []);

  const handleAddToExistingBatch = useCallback(async (batchId: string) => {
    setPackAction('adding');
    const selectedHands = hands.filter((h) => packSelected.has(h.id));
    let added = 0;
    for (const h of selectedHands) {
      const res = await addSingleHandToBatch(batchId, {
        hand_id: h.hand_id ?? h.id,
        raw_hand_text: h.raw_hand_text ?? '',
        position: h.position,
        hero_cards: h.hero_cards,
        board: h.board,
        net_result: h.net_result,
        stack_size: h.stack_size,
        blinds: h.blinds,
        pot_amount: h.pot_amount,
        site: h.site,
        game_mode: h.game_mode,
        tournament_id: h.tournament_id,
        played_at: h.played_at,
        saw_flop: h.saw_flop,
        saw_turn: h.saw_turn,
        saw_river: h.saw_river,
        showdown: h.showdown,
        hero_name: h.hero_name,
      });
      if (res.ok) added++;
    }
    setPackAction('idle');
    setShowBatchPicker(false);
    setPackToast(`Added ${added} hand${added !== 1 ? 's' : ''} to batch`);
    setPackSelected(new Set());
    setPackSelectMode(false);
    if (onReloadBatches) onReloadBatches();
    setTimeout(() => setPackToast(null), 3000);
  }, [hands, packSelected, onReloadBatches]);

  const handleCreateNewPack = useCallback(async () => {
    if (!currentUserId || packSelected.size === 0) return;
    setPackAction('creating');
    const title = `Review Pack (${packSelected.size} hands)`;
    const batch = await createBatch(currentUserId, title, 'custom', null, 'personal');
    if (!batch) {
      setPackAction('idle');
      setPackToast('Failed to create pack');
      setTimeout(() => setPackToast(null), 3000);
      return;
    }
    const selectedHands = hands.filter((h) => packSelected.has(h.id));
    let added = 0;
    for (const h of selectedHands) {
      const res = await addSingleHandToBatch(batch.id, {
        hand_id: h.hand_id ?? h.id,
        raw_hand_text: h.raw_hand_text ?? '',
        position: h.position,
        hero_cards: h.hero_cards,
        board: h.board,
        net_result: h.net_result,
        stack_size: h.stack_size,
        blinds: h.blinds,
        pot_amount: h.pot_amount,
        site: h.site,
        game_mode: h.game_mode,
        tournament_id: h.tournament_id,
        played_at: h.played_at,
        saw_flop: h.saw_flop,
        saw_turn: h.saw_turn,
        saw_river: h.saw_river,
        showdown: h.showdown,
        hero_name: h.hero_name,
      });
      if (res.ok) added++;
    }
    setPackAction('idle');
    setPackToast(`Created "${title}" with ${added} hand${added !== 1 ? 's' : ''}`);
    setPackSelected(new Set());
    setPackSelectMode(false);
    if (onReloadBatches) onReloadBatches();
    setTimeout(() => setPackToast(null), 3000);
  }, [currentUserId, packSelected, hands, onReloadBatches]);

  const total = filteredHands.length;
  const canPrev = selectedHandIndex > 0;
  const canNext = selectedHandIndex < total - 1;

  return (
    <>
      {/* Compact nav bar with prev/next + filter toggle */}
      <div className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5" style={{ borderColor: BORDER, background: SECTION_BG }}>
        <button
          onClick={onPrev}
          disabled={!canPrev}
          className="rounded border border-white/10 p-1 text-white/50 transition disabled:opacity-25 hover:bg-white/5"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="flex-1 text-center text-[10px] font-bold text-white/60">
          HAND {selectedHandIndex + 1} / {total}
        </span>
        <button
          onClick={onNext}
          disabled={!canNext}
          className="rounded border border-white/10 p-1 text-white/50 transition disabled:opacity-25 hover:bg-white/5"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[8px] font-bold uppercase text-white/50 transition hover:bg-white/5"
        >
          HANDS <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* Unified filter bar */}
      <UnifiedFilterBar
        filters={unifiedFilters}
        setFilters={setUnifiedFilters}
        sortMode={sortMode}
        setSortMode={setSortMode}
        totalCount={displayed.length}
        loading={false}
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
      />

      {/* Interesting toggle */}
      <div className="flex items-center gap-1 px-1">
        <button
          onClick={() => setInterestingActive((v) => !v)}
          className={`flex items-center gap-0.5 rounded px-2 py-1 text-[8px] font-bold uppercase transition ${
            interestingActive ? 'bg-[#d4a52c] text-[#1a1200]' : 'border border-white/10 text-white/50 hover:bg-white/5'
          }`}
        >
          <Sparkles className="h-2.5 w-2.5" /> Interesting
          {interestingActive && <span className="text-[6px]">({interestingCount})</span>}
        </button>
        <button
          onClick={() => {
            setPackSelectMode((v) => !v);
            if (packSelectMode) setPackSelected(new Set());
          }}
          className={`flex items-center gap-0.5 rounded px-2 py-1 text-[8px] font-bold uppercase transition ${
            packSelectMode ? 'bg-[#c0911e]/20 text-[#f5e6b0] border border-[#d4a52c]/40' : 'border border-white/10 text-white/50 hover:bg-white/5'
          }`}
        >
          <CheckSquare className="h-2.5 w-2.5" /> Select
        </button>
      </div>

      {/* Pack toast */}
      {packToast && (
        <div className="shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-medium text-[#4ade80]" style={{ borderColor: BORDER, background: SECTION_BG }}>
          {packToast}
        </div>
      )}

      {/* Pack selection bar */}
      {packSelectMode && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-1.5" style={{ borderColor: BORDER, background: SECTION_BG }}>
          <span className="text-[9px] font-bold uppercase text-[#f5e6b0]">{packSelected.size} selected</span>
          <button onClick={handlePackSelectAll} className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase text-white/40 hover:text-white/70">All</button>
          <button onClick={handlePackDeselectAll} className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase text-white/40 hover:text-white/70">None</button>
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setShowBatchPicker(true)}
              disabled={packSelected.size === 0}
              className="rounded border border-[#d4a52c]/40 bg-[#c0911e]/15 px-2 py-0.5 text-[8px] font-bold uppercase text-[#f5e6b0] disabled:opacity-30"
            >
              Add to Pack
            </button>
            <button
              onClick={handleCreateNewPack}
              disabled={packSelected.size === 0 || packAction !== 'idle'}
              className="rounded border border-[#d4a52c]/40 bg-[#c0911e]/15 px-2 py-0.5 text-[8px] font-bold uppercase text-[#f5e6b0] disabled:opacity-30"
            >
              {packAction === 'creating' ? 'Creating…' : 'New Pack'}
            </button>
          </div>
        </div>
      )}

      {/* Batch picker modal */}
      {showBatchPicker && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowBatchPicker(false)}>
          <div className="max-h-[60vh] w-full max-w-xs overflow-y-auto rounded-lg border border-[#d4a52c]/30 bg-[#0d0f12] p-3" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-[10px] font-bold uppercase text-[#f5e6b0]">Add to existing pack</p>
            {batches.length === 0 ? (
              <p className="text-[9px] text-white/30">No existing packs. Create a new one instead.</p>
            ) : (
              <div className="space-y-1">
                {batches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => void handleAddToExistingBatch(b.id)}
                    disabled={packAction !== 'idle'}
                    className="flex w-full items-center justify-between rounded border border-white/10 bg-white/[0.02] px-2 py-1.5 text-left transition hover:bg-white/5 disabled:opacity-30"
                  >
                    <span className="truncate text-[10px] font-medium text-white/70">{b.title}</span>
                    <span className="text-[8px] text-white/30">{b.hand_count}h</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowBatchPicker(false)} className="mt-2 w-full rounded border border-white/10 py-1 text-[8px] font-bold uppercase text-white/40 hover:text-white/70">Cancel</button>
          </div>
        </div>
      )}

      {/* Hand drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setDrawerOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-xl border-t border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl" style={{ maxHeight: '60vh' }}>
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <span className="text-[11px] font-bold uppercase text-white/60">{displayed.length} Hands{displayed.length !== total && ` (of ${total})`}</span>
              <button onClick={() => setDrawerOpen(false)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            {/* Pack selection bar inside drawer */}
            {packSelectMode && (
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-1.5">
                <span className="text-[9px] font-bold uppercase text-[#f5e6b0]">{packSelected.size}</span>
                <button onClick={handlePackSelectAll} className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase text-white/40 hover:text-white/70">All</button>
                <button onClick={handlePackDeselectAll} className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase text-white/40 hover:text-white/70">None</button>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => setShowBatchPicker(true)} disabled={packSelected.size === 0}
                    className="rounded border border-[#d4a52c]/40 bg-[#c0911e]/15 px-2 py-0.5 text-[8px] font-bold uppercase text-[#f5e6b0] disabled:opacity-30">Add</button>
                  <button onClick={handleCreateNewPack} disabled={packSelected.size === 0 || packAction !== 'idle'}
                    className="rounded border border-[#d4a52c]/40 bg-[#c0911e]/15 px-2 py-0.5 text-[8px] font-bold uppercase text-[#f5e6b0] disabled:opacity-30">
                    {packAction === 'creating' ? '…' : 'New'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 overflow-y-auto p-3" style={{ maxHeight: '50vh' }}>
              {displayed.map((h) => {
                const fullRow = hands.find((hr) => hr.id === (h as unknown as ReviewHand).id);
                const isSaved = fullRow ? savedHandIds.has(fullRow.hand_id ?? fullRow.id) : false;
                const isConstructed = fullRow?.source === 'constructed';
                const originalIdx = filteredHands.indexOf(h);
                const isSelected = originalIdx === selectedHandIndex;
                const nr = h.net_result;
                const rowId = (h as unknown as ReviewHand).id;
                const isInWorkingBatch = workingBatchHands.some((wbh) => wbh.hand_id === fullRow?.hand_id);
                const isPackSelected = packSelected.has(rowId);
                return (
                  <div key={rowId} className="relative rounded-lg border px-2 py-1.5 transition"
                    style={{
                      borderColor: (packSelectMode && isPackSelected) ? 'rgba(201,162,39,0.5)' : isSelected ? 'rgba(201,162,39,0.5)' : 'rgba(255,255,255,0.06)',
                      background: (packSelectMode && isPackSelected) ? 'rgba(201,162,39,0.15)' : isSelected ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <button
                      onClick={() => {
                        if (packSelectMode) { handlePackToggle(rowId); return; }
                        onSelectHand(originalIdx); setDrawerOpen(false);
                      }}
                      className="flex w-full flex-col gap-0.5 text-left"
                    >
                      <div className="flex items-center gap-1">
                        {packSelectMode && (
                          isPackSelected
                            ? <CheckSquare className="h-3 w-3 shrink-0 text-[#d4a52c]" />
                            : <Square className="h-3 w-3 shrink-0 text-white/30" />
                        )}
                        <span className="font-mono text-[10px] font-bold" style={{ color: resultColor(nr ?? null) }}>#{originalIdx + 1}</span>
                        {h.position && (
                          <span className="rounded border border-[#c0911e]/20 px-0.5 text-[8px] font-bold text-[#d4a52c]">{h.position}</span>
                        )}
                        {isConstructed && <span className="text-[7px] font-bold text-blue-300/60">C</span>}
                        {isSaved && <Bookmark className="h-2.5 w-2.5 shrink-0 fill-[#d4a52c] text-[#d4a52c]" />}
                        {isInWorkingBatch && <Package className="h-2.5 w-2.5 shrink-0 text-[#d4a52c]/60" />}
                        <span className="ml-auto font-mono text-[10px] font-bold" style={{ color: resultColor(nr ?? null) }}>
                          {formatResultBB(nr)}
                        </span>
                      </div>
                      {h.hero_cards && (
                        <span className="truncate font-mono text-[9px] font-bold text-white/60">{formatHeroCards(h.hero_cards)}</span>
                      )}
                      {h.board && (
                        <span className="truncate font-mono text-[8px] text-white/30">{formatBoard(h.board)}</span>
                      )}
                    </button>
                    {fullRow && !packSelectMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (menuOpenId === rowId) { setMenuOpenId(null); setMenuAnchor(null); return; }
                          setMenuAnchor(e.currentTarget as HTMLElement);
                          setMenuOpenId(rowId);
                        }}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded border"
                        style={{
                          background: 'rgba(20,20,20,0.95)',
                          borderColor: 'rgba(192,145,30,0.22)',
                        }}
                        title="Actions"
                      >
                        <MoreVertical className="h-2.5 w-2.5" style={{ color: '#d4a52c' }} />
                      </button>
                    )}
                    {menuOpenId === rowId && fullRow && menuAnchor && createPortal(
                      <HandRailActionMenu
                        anchor={menuAnchor}
                        onClose={() => { setMenuOpenId(null); setMenuAnchor(null); }}
                        actions={[
                          { action: 'replay' as const, label: 'View / Replay', icon: Play },
                          { action: isSaved ? 'unsave' as const : 'save' as const, label: isSaved ? 'Unsave Hand' : 'Save Hand', icon: isSaved ? Bookmark : Bookmark },
                          { action: 'addToBatch' as const, label: isInWorkingBatch ? 'Remove from Batch' : 'Add to Batch', icon: isInWorkingBatch ? X : Package },
                          { action: 'copyId' as const, label: 'Copy Hand ID', icon: Copy },
                          { action: 'copyLink' as const, label: 'Copy Replay Link', icon: Link },
                          { action: 'addToSpot' as const, label: 'Add to Spot', icon: MapPin },
                          { action: 'addToMsa' as const, label: 'Add to Multi-Spot', icon: BookOpen },
                          ...(isConstructed ? [
                            { action: 'rename' as const, label: 'Edit Hand', icon: Edit2 },
                            { action: 'delete' as const, label: 'Delete Hand', icon: Trash2 },
                          ] : []),
                        ].map(({ action, label, icon: Icon }) => ({
                          label,
                          icon: <Icon className="h-3.5 w-3.5 shrink-0" />,
                          onClick: () => { setMenuOpenId(null); setMenuAnchor(null); onHandAction(action, fullRow); setDrawerOpen(false); },
                          danger: action === 'delete',
                        }))}
                      />,
                      document.body
                    )}
                  </div>
                );
              })}
              {displayed.length === 0 && (
                <div className="col-span-full py-6 text-center text-[10px] text-white/30">No hands match these filters</div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
type SubmissionType = 'marked_hands' | 'filtered_hands' | 'full_batch' | 'general_notes_only';

function SubmitModal({
  coachName, markedCount, filteredCount, totalCount, batchName,
  hasActiveCoach, activeRelationships, selectedRelationshipId, onSelectRelationship,
  submitMessage, setSubmitMessage, submitting, onClose, onSubmit,
}: {
  coachName: string;
  markedCount: number;
  filteredCount: number;
  totalCount: number;
  batchName: string;
  hasActiveCoach: boolean;
  activeRelationships: Relationship[];
  selectedRelationshipId: string | null;
  onSelectRelationship: (id: string) => void;
  submitMessage: string;
  setSubmitMessage: (v: string) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (type: SubmissionType) => Promise<void>;
}) {
  const [type, setType] = useState<SubmissionType>('full_batch');

  if (!hasActiveCoach) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">No Active Coach</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3 rounded-lg border border-amber-300/20 bg-amber-300/5 p-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-300" />
              <p className="text-[11px] text-amber-200">Connect with a coach before submitting review material.</p>
            </div>
            <button onClick={onClose} className="mt-4 w-full rounded-lg border border-white/10 py-2.5 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-white">Send to {coachName}</h2>
            <p className="mt-0.5 text-[10px] text-white/40">{batchName}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          {activeRelationships.length > 1 && (
            <div>
              <label className="text-[10px] font-semibold uppercase text-white/45">Working with</label>
              <select value={selectedRelationshipId ?? ''} onChange={(e) => onSelectRelationship(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#15181c] px-3 py-2 text-xs text-white outline-none focus:border-[#d4a52c]/50">
                {activeRelationships.map((r) => (
                  <option key={r.id} value={r.id}>{r.metadata?.coach_name ?? 'Coach'}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <div className="text-[9px] font-bold tracking-widest text-white/35 uppercase">Send</div>
            {([
              ['marked_hands', `Marked Hands (${markedCount})`],
              ['filtered_hands', `Filtered Hands (${filteredCount})`],
              ['full_batch', `Entire Batch (${totalCount})`],
              ['general_notes_only', 'General Notes Only'],
            ] as [SubmissionType, string][]).map(([value, label]) => (
              <label key={value}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition ${type === value ? 'border-[#d4a52c]/30 bg-[#c0911e]/10' : 'border-white/[0.06] hover:bg-white/[0.03]'}`}
              >
                <input type="radio" name="submissionType" checked={type === value} onChange={() => setType(value)} className="accent-[#d4a52c]" />
                <span className="text-[11px] font-medium text-white/80">{label}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-white/45">Message</label>
            <textarea value={submitMessage} onChange={(e) => setSubmitMessage(e.target.value)}
              placeholder="Context for your coach…" maxLength={2000}
              className="mt-1.5 h-20 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
            <button onClick={() => void onSubmit(type)} disabled={submitting}
              className="rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/30"
            >{submitting ? 'Sending…' : 'Send'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// PRESENTATION INLINE CONTROLS (integrated into replay control bar)
// ────────────────────────────────────────────────────────────────────────────

function formatRecTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function PresentationInlineControls({
  mode, recorderState, elapsed, active, hasUnsavedRecording,
  onSelectMode, onRecord, onPause, onResume, onStop, onDiscard, onSave,
}: {
  mode: 'voice' | 'video' | 'sync';
  recorderState: 'idle' | 'recording' | 'paused' | 'stopped';
  elapsed: number;
  active: boolean;
  hasUnsavedRecording: boolean;
  onSelectMode: (m: 'voice' | 'video' | 'sync') => void;
  onRecord: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const dimClass = active ? 'opacity-100' : 'opacity-35 pointer-events-none';

  return (
    <div className={`flex items-center gap-1 ${dimClass} transition-opacity duration-200`}>
      {/* Mode selectors */}
      <button
        onClick={() => onSelectMode('voice')}
        disabled={!active}
        className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-[8px] font-bold uppercase transition ${
          mode === 'voice' && active
            ? 'border-[#d4a52c]/60 bg-[#c0911e]/20 text-[#f5e6b0]'
            : 'border-white/10 text-white/45 hover:text-white/70'
        }`}
        title="Voice recording mode"
      >
        <Mic className="h-3 w-3" /> Voice
      </button>
      <button
        onClick={() => onSelectMode('video')}
        disabled={!active}
        className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-[8px] font-bold uppercase transition ${
          mode === 'video' && active
            ? 'border-[#d4a52c]/60 bg-[#c0911e]/20 text-[#f5e6b0]'
            : 'border-white/10 text-white/45 hover:text-white/70'
        }`}
        title="Video + Audio recording mode"
      >
        <Video className="h-3 w-3" /> Video
      </button>

      {/* Record / Pause / Resume / Stop */}
      {recorderState === 'idle' && (
        <button
          onClick={onRecord}
          disabled={!active}
          className="flex items-center gap-1 rounded-md border border-red-400/40 bg-red-500/15 px-2 py-1 text-[8px] font-bold uppercase text-red-300 transition hover:bg-red-500/25 disabled:opacity-30"
          title="Start recording"
        >
          <span className="h-2 w-2 rounded-full bg-red-400" /> Rec
        </button>
      )}
      {recorderState === 'recording' && (
        <>
          <span className="flex items-center gap-1 text-[8px] font-bold text-red-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" /> {formatRecTime(elapsed)}
          </span>
          <button onClick={onPause} className="rounded-md border border-white/15 bg-white/5 px-1.5 py-1 text-[8px] font-bold uppercase text-white/70 hover:bg-white/10" title="Pause">
            Pause
          </button>
          <button onClick={onStop} className="rounded-md border border-red-400/40 bg-red-500/15 px-1.5 py-1 text-[8px] font-bold uppercase text-red-300 hover:bg-red-500/25" title="Stop">
            <Square className="h-3 w-3" />
          </button>
        </>
      )}
      {recorderState === 'paused' && (
        <>
          <span className="text-[8px] font-bold text-white/50">{formatRecTime(elapsed)}</span>
          <button onClick={onResume} className="rounded-md border border-white/15 bg-white/5 px-1.5 py-1 text-[8px] font-bold uppercase text-white/70 hover:bg-white/10" title="Resume">
            Resume
          </button>
          <button onClick={onStop} className="rounded-md border border-red-400/40 bg-red-500/15 px-1.5 py-1 text-[8px] font-bold uppercase text-red-300 hover:bg-red-500/25" title="Stop">
            <Square className="h-3 w-3" />
          </button>
        </>
      )}
      {recorderState === 'stopped' && hasUnsavedRecording && (
        <>
          <span className="text-[8px] font-bold text-[#f5e6b0]">{formatRecTime(elapsed)}</span>
          <button onClick={onSave} className="rounded-md border border-[#d4a52c]/40 bg-[#c0911e]/20 px-1.5 py-1 text-[8px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/30" title="Save recording">
            Save
          </button>
          <button onClick={onDiscard} className="rounded-md border border-white/10 px-1.5 py-1 text-[8px] font-bold uppercase text-white/40 hover:text-white/60" title="Discard">
            Discard
          </button>
        </>
      )}
    </div>
  );
}

function PresentationRightControls({
  mode, elapsed, active, onAddSyncMarker, syncMode,
}: {
  mode: 'voice' | 'video' | 'sync';
  elapsed: number;
  active: boolean;
  onAddSyncMarker: (label: string) => void;
  syncMode: boolean;
}) {
  const dimClass = active ? 'opacity-100' : 'opacity-35 pointer-events-none';

  return (
    <div className={`flex items-center gap-1 ${dimClass} transition-opacity duration-200`}>
      {/* Replay Sync mode toggle + marker */}
      <button
        onClick={() => onAddSyncMarker(`Marker ${elapsed}s`)}
        disabled={!active || !syncMode}
        className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-[8px] font-bold uppercase transition ${
          syncMode && active
            ? 'border-[#d4a52c]/50 bg-[#c0911e]/15 text-[#f5e6b0] hover:bg-[#c0911e]/25'
            : 'border-white/10 text-white/40'
        }`}
        title={syncMode ? 'Add sync marker at current time' : 'Select Replay Sync mode to add markers'}
      >
        <Film className="h-3 w-3" /> Sync
      </button>
      {/* Timer display */}
      <span className={`flex items-center gap-1 text-[8px] font-bold tabular-nums ${active ? 'text-[#f5e6b0]' : 'text-white/30'}`}>
        <Clock className="h-3 w-3" /> {formatRecTime(elapsed)}
      </span>
    </div>
  );
}
