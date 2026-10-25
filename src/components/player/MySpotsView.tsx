import { useState, useEffect } from 'react';
import { Layers, Lock, FlaskConical, Share2, Bookmark, Trash2, Clock, Loader2, Book, Plus, Trophy, Search, SlidersHorizontal, ChevronDown, Check } from 'lucide-react';
import { MySpotsContentView } from '@/components/player/MySpotsContentView';
import { MyLibraryView } from '@/components/player/MyLibraryView';
import { SpotViewer } from '@/components/player/SpotViewer';
import type { MySpotsItem } from '@/lib/mySpotsStore';
import type { ContentSpot } from '@/lib/contentLab';
import { MySpotsContentViewer } from '@/components/player/MySpotsContentViewer';
import { openSpotPlayer } from '@/components/player/SpotMediaPlayer';
import { loadEntitlementItems, loadSharedItems } from '@/lib/mySpotsStore';
import { fetchMySpots, fetchSpotById } from '@/lib/contentLab';
import {
  fetchSavedSpots, unsaveSpot, isSaveExpired, formatSavedExpiry,
  type SavedSpot,
} from '@/lib/savedSpotsStore';
import { useDemo } from '@/useDemo';
import { GOLD, BORDER_GOLD, BG_CARD } from '@/components/ui/industry';
import { PokerSiteLogo } from '@/components/shared/PokerSiteLogo';
import { DifficultyTag, ReadingTimeBadge, ComprehensionTag, StakesTag } from '@/components/shared/DifficultyTag';
import { getContentDepthStyle, normalizeContentDepth, normalizeComprehension, normalizeStakes } from '@/lib/difficultyColors';

type TabId = 'all' | 'purchased' | 'created' | 'shared' | 'saved' | 'published' | 'drafts';
type SortId = 'newest' | 'oldest' | 'az' | 'za' | 'updated';
type FilterId = 'all' | 'text' | 'video' | 'hand_pack' | 'multi_spot' | 'published' | 'draft';

const ALL_TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'purchased', label: 'Purchased' },
  { id: 'created', label: 'Created' },
  { id: 'shared', label: 'Shared' },
  { id: 'saved', label: 'Saved' },
  { id: 'published', label: 'Published' },
  { id: 'drafts', label: 'Drafts' },
];

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'text', label: 'Text Spots' },
  { id: 'video', label: 'Video Spots' },
  { id: 'hand_pack', label: 'HH / Bundles' },
  { id: 'multi_spot', label: 'Multi-Spots' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
];

const SORTS: { id: SortId; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'az', label: 'Alphabetical A-Z' },
  { id: 'za', label: 'Alphabetical Z-A' },
  { id: 'updated', label: 'Recently Updated' },
];

interface Props {
  userId?: string;
  onOpenHHJukebox?: () => void;
  onEditSpot?: (spot: ContentSpot) => void;
  onEditSpotId?: (spotId: string) => void;
  onOpenTournamentWorkspace?: () => void;
  onOpenBatch?: (reviewSetId: string) => void;
  portalSlug?: string | null;
}

interface SavedSpotEntry {
  saved: SavedSpot;
  spot: ContentSpot | null;
}

export function MySpotsView({ userId, onOpenHHJukebox, onEditSpot, onEditSpotId, onOpenTournamentWorkspace, onOpenBatch, portalSlug }: Props) {
  const [tab, setTab] = useState<TabId>('all');
  const [spotsViewItem, setSpotsViewItem] = useState<MySpotsItem | null>(null);
  const [purchasedCount, setPurchasedCount] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const [sharedCount, setSharedCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [publishedCount, setPublishedCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [savedEntries, setSavedEntries] = useState<SavedSpotEntry[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [openSavedSpotId, setOpenSavedSpotId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortId>('newest');
  const [filter, setFilter] = useState<FilterId>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const { state } = useDemo();
  const account = state.currentAccount;

  const handleTabChange = (next: TabId) => {
    setSpotsViewItem(null);
    setOpenSavedSpotId(null);
    setTab(next);
  };

  const loadSaved = async (uid: string) => {
    setSavedLoading(true);
    try {
      const saved = await fetchSavedSpots(uid);
      const active = saved.filter((s) => !isSaveExpired(s));
      setSavedCount(active.length);
      const entries = await Promise.all(
        active.map(async (sv) => {
          const spot = await fetchSpotById(sv.spot_id);
          return { saved: sv, spot } as SavedSpotEntry;
        })
      );
      setSavedEntries(entries);
    } catch {
      setSavedEntries([]);
      setSavedCount(0);
    } finally {
      setSavedLoading(false);
    }
  };

  useEffect(() => {
    const uid = userId ?? account?.id;
    if (!uid) return;
    void (async () => {
      const [purchases, shared] = await Promise.all([
        loadEntitlementItems(uid),
        loadSharedItems(),
      ]);
      setPurchasedCount(purchases.length);
      setSharedCount(shared.length);
      void loadSaved(uid);
    })();
  }, [userId, account?.id]);

  useEffect(() => {
    const aid = userId ?? account?.id;
    if (!aid) return;
    void (async () => {
      const spots = await fetchMySpots(aid);
      setCreatedCount(spots.length);
      setPublishedCount(spots.filter((s) => s.status === 'published').length);
      setDraftCount(spots.filter((s) => s.status === 'draft' || s.status === 'submitted').length);
    })();
  }, [userId, account?.id]);

  const handleRemoveSaved = async (spotId: string) => {
    const uid = userId ?? account?.id;
    if (!uid) return;
    const ok = await unsaveSpot(uid, spotId);
    if (ok) {
      setSavedEntries((prev) => prev.filter((e) => e.saved.spot_id !== spotId));
      setSavedCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleOpenSaved = (spotId: string) => {
    setOpenSavedSpotId(spotId);
  };

  const totalCount = purchasedCount + createdCount + sharedCount;

  const isLibraryTab = tab === 'created' || tab === 'published' || tab === 'drafts' || tab === 'all';

  // SAVED tab: spot viewer for a saved spot
  if (tab === 'saved' && openSavedSpotId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-5 sm:py-5">
        <button
          onClick={() => setOpenSavedSpotId(null)}
          className="mb-3 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold text-white/60 transition hover:bg-white/5 hover:text-white/80"
          style={{ borderColor: BORDER_GOLD, background: BG_CARD }}
        >
          ← Saved Spots
        </button>
        <SpotViewer spotId={openSavedSpotId} onBack={() => setOpenSavedSpotId(null)} onEditSpotId={onEditSpotId} />
      </div>
    );
  }

  const libraryTab = tab === 'published' ? 'published' : tab === 'drafts' ? 'drafts' : 'all';

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pt-1.5 sm:px-6 sm:pt-3">
      {/* Unified floating filter container — 3 rows */}
      <div className="mb-2 rounded-xl backdrop-blur-md sm:mb-3" style={{ border: '1px solid rgba(190, 145, 65, 0.22)', background: 'rgba(15, 12, 10, 0.70)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)' }}>
        {/* Row 1: My Spots | count | Create | Tournaments */}
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8" style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))', border: '1px solid rgba(192,145,30,0.15)' }}>
            <Book className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={1.5} style={{ color: GOLD }} />
          </div>
          <span className="text-[12px] font-bold tracking-tight text-white sm:text-[13px]">My Spots</span>
          <span className="rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/8 px-1.5 py-0.5 text-[8px] font-mono tracking-wider text-[#d4a52c]/80 uppercase sm:px-2 sm:py-1 sm:text-[9px]">
            {totalCount} Spots
          </span>
          <button
            onClick={() => { setTab('created'); }}
            className="ml-auto flex items-center gap-1 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/15 px-2 py-1 text-[9px] font-bold tracking-wider uppercase text-[#f5e6b0] transition-all hover:bg-[#c0911e]/25 sm:px-3 sm:py-1.5 sm:text-[10px]"
          >
            <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline">Create</span>
          </button>
          {onOpenTournamentWorkspace && (
            <button
              onClick={onOpenTournamentWorkspace}
              className="flex items-center gap-1 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/8 px-2 py-1 text-[9px] font-bold tracking-wider uppercase text-[#d4a52c] transition-all hover:bg-[#c0911e]/15 sm:px-3 sm:py-1.5 sm:text-[10px]"
            >
              <Trophy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Tournaments</span>
            </button>
          )}
        </div>

        {/* Row 2: All | Purchased | Created | Shared | Saved | Published | Drafts */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar border-t border-white/[0.04] px-3 py-1.5 sm:px-4">
          {ALL_TABS.map((t) => {
            const count = t.id === 'all' ? totalCount
              : t.id === 'purchased' ? purchasedCount
              : t.id === 'created' ? createdCount
              : t.id === 'shared' ? sharedCount
              : t.id === 'saved' ? savedCount
              : t.id === 'published' ? publishedCount
              : draftCount;
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[8px] font-semibold tracking-widest uppercase transition-all sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[9px] ${
                  tab === t.id
                    ? 'border-[#c0911e]/50 bg-[#1a1408] text-[#f5e6b0] shadow-[0_0_12px_-4px_rgba(212,165,44,0.3)]'
                    : 'border-[#1a1f25] bg-[#0d1115] text-white/50 hover:border-[#c0911e]/20 hover:text-white/70'
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1 text-[7px] sm:px-1.5 sm:text-[8px] ${tab === t.id ? 'bg-[#c0911e]/20 text-[#f5e6b0]' : 'bg-white/5 text-white/40'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Search | Select All | All Types | Newest */}
        <div className="flex items-center gap-1.5 border-t border-white/[0.04] px-3 py-2 sm:gap-2 sm:px-4">
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30 sm:left-3 sm:h-3.5 sm:w-3.5" strokeWidth={1.5} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-white/[0.06] bg-black/30 py-1.5 pl-8 pr-2 text-[10px] text-white/80 placeholder-white/25 outline-none transition-colors focus:border-[#c0911e]/30 sm:py-2 sm:pl-9 sm:pr-3 sm:text-[11px]"
            />
          </div>

          {/* Filter dropdown — only for library tabs */}
          {isLibraryTab && (
            <div className="relative shrink-0">
              <button
                onClick={() => { setFilterMenuOpen(!filterMenuOpen); setSortMenuOpen(false); }}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[9px] font-semibold tracking-wide uppercase transition-all sm:gap-1.5 sm:px-3 sm:py-2 sm:text-[10px] ${
                  filter !== 'all'
                    ? 'border-[#c0911e]/30 bg-[#c0911e]/10 text-[#f5e6b0]'
                    : 'border-white/[0.06] bg-black/20 text-white/50 hover:text-white/70'
                }`}
              >
                <SlidersHorizontal className="h-3 w-3" strokeWidth={1.5} />
                <span className="hidden sm:inline">{FILTERS.find((f) => f.id === filter)?.label ?? 'All Types'}</span>
                <span className="sm:hidden">Type</span>
                <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
              </button>
              {filterMenuOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-[#292C2E] bg-[#0a0c0e] py-1 shadow-2xl">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setFilter(f.id); setFilterMenuOpen(false); }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-medium transition-colors hover:bg-[#151719] ${
                        filter === f.id ? 'text-[#d4a52c]' : 'text-white/60'
                      }`}
                    >
                      {f.label}
                      {filter === f.id && <Check className="h-3 w-3" strokeWidth={2} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setSortMenuOpen(!sortMenuOpen); setFilterMenuOpen(false); }}
              className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5 text-[9px] font-semibold tracking-wide uppercase text-white/50 transition-all hover:text-white/70 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-[10px]"
            >
              <span className="hidden sm:inline">{SORTS.find((s) => s.id === sort)?.label ?? 'Newest'}</span>
              <span className="sm:hidden">Sort</span>
              <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
            </button>
            {sortMenuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-[#292C2E] bg-[#0a0c0e] py-1 shadow-2xl">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSort(s.id); setSortMenuOpen(false); }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-medium transition-colors hover:bg-[#151719] ${
                      sort === s.id ? 'text-[#d4a52c]' : 'text-white/60'
                    }`}
                  >
                    {s.label}
                    {sort === s.id && <Check className="h-3 w-3" strokeWidth={2} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {tab === 'all' && (
        <>
          {!spotsViewItem && (
            <>
              {(purchasedCount + sharedCount) > 0 && (
                <MySpotsContentView
                  userId={userId}
                  sourceFilter="all"
                  onOpenHHJukebox={onOpenHHJukebox}
                  onPlayMedia={(item) => {
                    openSpotPlayer({
                      id: item.id,
                      title: item.title,
                      creator: item.creator,
                      videoUrl: item.videoUrl ?? '',
                      contentType: 'media',
                      posterUrl: item.thumbnail ?? undefined,
                      youtubeVideoId: item.youtubeVideoId,
                    });
                  }}
                  onOpenItem={(item) => setSpotsViewItem(item)}
                />
              )}
              <div className="mt-1">
                <MyLibraryView
                  onEditSpot={onEditSpot}
                  userId={userId}
                  onOpenTournamentWorkspace={onOpenTournamentWorkspace}
                  onOpenBatch={onOpenBatch}
                  portalSlug={portalSlug}
                  hideHeaderAndTabs
                  hideChrome
                  controlledTab="all"
                  controlledSearch={search}
                  controlledSort={sort}
                  controlledFilter={filter}
                />
              </div>
            </>
          )}
          {spotsViewItem && (
            <MySpotsContentViewer
              item={spotsViewItem}
              onBack={() => setSpotsViewItem(null)}
              onEditSpotId={onEditSpotId}
            />
          )}
        </>
      )}

      {tab === 'purchased' && !spotsViewItem && (
        <MySpotsContentView
          userId={userId}
          sourceFilter="purchased"
          onOpenHHJukebox={onOpenHHJukebox}
          onPlayMedia={(item) => {
            openSpotPlayer({
              id: item.id,
              title: item.title,
              creator: item.creator,
              videoUrl: item.videoUrl ?? '',
              contentType: 'media',
              posterUrl: item.thumbnail ?? undefined,
              youtubeVideoId: item.youtubeVideoId,
            });
          }}
          onOpenItem={(item) => setSpotsViewItem(item)}
        />
      )}
      {tab === 'purchased' && spotsViewItem && (
        <MySpotsContentViewer
          item={spotsViewItem}
          onBack={() => setSpotsViewItem(null)}
          onEditSpotId={onEditSpotId}
        />
      )}
      {tab === 'shared' && !spotsViewItem && (
        <MySpotsContentView
          userId={userId}
          sourceFilter="shared"
          onOpenHHJukebox={onOpenHHJukebox}
          onPlayMedia={(item) => {
            openSpotPlayer({
              id: item.id,
              title: item.title,
              creator: item.creator,
              videoUrl: item.videoUrl ?? '',
              contentType: 'media',
              posterUrl: item.thumbnail ?? undefined,
              youtubeVideoId: item.youtubeVideoId,
            });
          }}
          onOpenItem={(item) => setSpotsViewItem(item)}
        />
      )}
      {tab === 'shared' && spotsViewItem && (
        <MySpotsContentViewer
          item={spotsViewItem}
          onBack={() => setSpotsViewItem(null)}
          onEditSpotId={onEditSpotId}
        />
      )}
      {(tab === 'created' || tab === 'published' || tab === 'drafts') && (
        <MyLibraryView
          onEditSpot={onEditSpot}
          userId={userId}
          onOpenTournamentWorkspace={onOpenTournamentWorkspace}
          onOpenBatch={onOpenBatch}
          portalSlug={portalSlug}
          hideHeaderAndTabs
          hideChrome
          controlledTab={libraryTab as 'all' | 'published' | 'drafts'}
          controlledSearch={search}
          controlledSort={sort}
          controlledFilter={filter}
        />
      )}

      {/* SAVED tab */}
      {tab === 'saved' && (
        <div className="mt-3">
          {savedLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
            </div>
          ) : savedEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center sm:py-20">
              <Bookmark className="mb-2 h-8 w-8 text-white/20 sm:mb-3 sm:h-10 sm:w-10" strokeWidth={1.5} />
              <p className="text-[12px] text-white/40">No saved spots yet</p>
              <p className="mt-1 text-[10px] text-white/25">Save free spots from the Spot Library to find them here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {savedEntries.map(({ saved, spot }) => {
                if (!spot) {
                  return (
                    <div key={saved.spot_id} className="rounded-xl border p-3" style={{ borderColor: BORDER_GOLD, background: BG_CARD }}>
                      <p className="text-[11px] text-white/40">Spot no longer available</p>
                      <button
                        onClick={() => handleRemoveSaved(saved.spot_id)}
                        className="mt-2 flex items-center gap-1 text-[9px] text-red-400/60 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  );
                }
                const diffLevel = normalizeContentDepth(spot.difficulty, (spot.tags as Record<string, unknown> | null)?.difficulty as string | undefined);
                const difficultyStyle = diffLevel ? getContentDepthStyle(diffLevel) : null;
                const compLevel = normalizeComprehension(spot.comprehension_difficulty);
                const stakesLevel = normalizeStakes(spot.tournament_stakes);
                return (
                  <div key={saved.spot_id} className="rounded-xl border p-3 transition-shadow" style={{ borderColor: difficultyStyle?.border ?? BORDER_GOLD, background: BG_CARD, boxShadow: difficultyStyle?.glow }}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#c0911e]/10" style={{ border: '1px solid rgba(192,145,30,0.2)' }}>
                        <PokerSiteLogo site={spot.poker_site} size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-bold text-white">{spot.title}</h3>
                        <span className="truncate text-[10px] text-white/40">by {spot.creator_name ?? 'Unknown'}</span>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {diffLevel && <DifficultyTag level={diffLevel} size="small" />}
                          {compLevel && <ComprehensionTag level={compLevel} size="small" />}
                          {stakesLevel && <StakesTag level={stakesLevel} size="small" />}
                          <ReadingTimeBadge spot={spot} size="small" />
                        </div>
                      </div>
                    </div>
                    {spot.subtitle && (
                      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-white/35">{spot.subtitle}</p>
                    )}
                    <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
                      <span className="flex items-center gap-1 text-[9px] text-sky-400/60">
                        <Clock className="h-3 w-3" /> {formatSavedExpiry(saved)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenSaved(saved.spot_id)}
                          className="flex items-center gap-1.5 rounded-md border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-3 py-1.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/25 hover:to-[#835e17]/25"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleRemoveSaved(saved.spot_id)}
                          className="flex items-center justify-center rounded-md border border-white/10 p-1.5 text-white/40 transition hover:border-red-500/30 hover:text-red-400"
                          title="Remove from saved"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
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
