import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Globe,
  Package, Zap,
  Check, Loader2, Search,
  Bookmark, BookOpen, User, X, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { fetchPublishedSpots, type ContentSpot } from '@/lib/contentLab';
import { fetchPublishedProducts, type JukeboxProduct } from '@/lib/jukeboxStore';
import { useDemoUserState, spendCredits } from '@/lib/demoUserStore';
import {
  GOLD,
  STORE_MAX_WIDTH, STORE_PADDING,
  FilterTabBar,
} from '@/components/store/storeTokens';
import { PageHeader } from '@/components/shared/PageHeader';
import { PokerSiteLogo } from '@/components/shared/PokerSiteLogo';
import { getContentDepthStyle, normalizeContentDepth, getComprehensionStyle, normalizeComprehension, getStakesStyle, normalizeStakes } from '@/lib/difficultyColors';
import { ReadingTimeBadge, ComprehensionTag, StakesTag } from '@/components/shared/DifficultyTag';
import { POKER_SITE_LABELS } from '@/lib/contentLab';
import {
  fetchSavedSpotIds, saveSpot, unsaveSpot, checkSpotSaved,
  type SavedSpot, isSaveExpired,
} from '@/lib/savedSpotsStore';
import { SaveSpotModal } from '@/components/shared/SaveSpotModal';
import { SpotViewer } from '@/components/player/SpotViewer';
import { MultiSpotViewer } from '@/components/player/MultiSpotViewer';
import { fetchProfilesByDisplayNames, fetchPublicProfiles, type PublicProfileEntry } from '@/lib/profileStore';
import { useDemo } from '@/useDemo';

const FILTER_TABS = ['All', 'Free', 'Paid'];

interface SpotLibraryItem {
  id: string;
  source: 'content_spot' | 'jukebox_product';
  title: string;
  creator: string;
  description: string;
  format: string;
  isFree: boolean;
  price: number;
  tags: string[];
  thumbnailColor: string;
  thumbnailIcon: string;
  rating: number;
  views: number;
  spotId: string | null;
  pokerSite: string | null;
  difficulty: string | null;
  comprehensionDifficulty: string | null;
  tournamentStakes: string | null;
  rawTags: Record<string, unknown> | null;
  spotType: string | null;
  coverUrl: string | null;
}

function CarouselCard({
  item, purchased, savedIds, savedDetails, onOpen, onGet, onSave, onRemoveSave,
}: {
  item: SpotLibraryItem;
  purchased: Set<string>;
  savedIds: Set<string>;
  savedDetails: Record<string, SavedSpot>;
  onOpen: (item: SpotLibraryItem) => void;
  onGet: (item: SpotLibraryItem) => void;
  onSave: (item: SpotLibraryItem) => void;
  onRemoveSave: (spotId: string) => void;
}) {
  const isOwned = purchased.has(item.id);
  const isSpot = item.source === 'content_spot';
  const isMsa = isSpot && item.spotType === 'multi_spot_analysis';
  const isOpenable = isSpot;
  const spotId = item.spotId;
  const isSaved = spotId ? savedIds.has(spotId) : false;
  const savedDetail = spotId ? savedDetails[spotId] : undefined;
  const savedExpired = savedDetail ? isSaveExpired(savedDetail) : false;
  const showSaved = isSaved && !savedExpired;
  const diffLevel = isSpot ? normalizeContentDepth(item.difficulty, item.rawTags?.difficulty as string | undefined) : null;
  const difficultyStyle = diffLevel ? getContentDepthStyle(diffLevel) : null;
  const compLevel = isSpot ? normalizeComprehension(item.comprehensionDifficulty) : null;
  const stakesLevel = isSpot ? normalizeStakes(item.tournamentStakes) : null;
  const stakesStyle = stakesLevel ? getStakesStyle(stakesLevel) : null;
  const HIDDEN_TAG_VALUES = ['mtt', 'chipev', 'icm', 'pko', 'middle', 'early', 'bubble', 'final table', 'heads up'];
  const visibleTags = item.tags
    .filter((tag) => tag.toLowerCase() !== diffLevel)
    .filter((tag) => !HIDDEN_TAG_VALUES.includes(tag.toLowerCase()))
    .slice(0, 3);

  return (
    <article
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:border-[#c091e]/30"
      onClick={() => isSpot && onOpen(item)}
      style={{
        borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.15)',
        background: 'rgba(6, 8, 10, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        boxShadow: '0 4px 20px -8px rgba(0,0,0,0.6)',
      }}
    >
      <div className="flex items-start gap-3 px-5 pt-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#d4a52c]/35 bg-[#c091e]/10 shadow-inner">
          {isMsa ? <BookOpen className="h-5 w-5" style={{ color: item.thumbnailColor }} /> : isSpot ? <PokerSiteLogo site={item.pokerSite} size={30} /> : <Package className="h-5 w-5" style={{ color: item.thumbnailColor }} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d4a52c]">{isSpot ? 'Spot' : item.format}</span>
          </div>
          <h3 className="mt-1 line-clamp-2 text-[18px] font-bold leading-snug text-white transition-colors group-hover:text-[#f5e6b0]">{item.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] text-white/55">by {item.creator}</span>
            {isSpot && !isMsa && item.pokerSite && item.pokerSite !== 'other' && (
              <span className="inline-flex shrink-0 rounded border border-[rgba(212,165,44,0.15)] bg-[#c091e]/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/65">{POKER_SITE_LABELS[item.pokerSite] ?? item.pokerSite}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-4 pt-3">
        {item.description && <p className="line-clamp-3 text-[14px] leading-relaxed text-white/55">{item.description}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {difficultyStyle && (
            <span className="rounded border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ background: difficultyStyle.bg, color: difficultyStyle.text, borderColor: difficultyStyle.border }}>{difficultyStyle.label}</span>
          )}
          {compLevel && <ComprehensionTag level={compLevel} size="small" />}
          {stakesStyle && <StakesTag level={stakesLevel!} size="small" />}
          {isSpot && <ReadingTimeBadge spot={{ subtitle: item.description }} size="small" />}
          {visibleTags.map((tag) => <span key={tag} className="rounded border border-[rgba(212,165,44,0.15)] bg-[#c091e]/8 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/65">{tag}</span>)}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-[rgba(212,165,44,0.10)] pt-3.5">
          <div className="flex items-center gap-1.5">
            {showSaved && <span className="text-[10px] font-bold uppercase text-sky-300">Saved</span>}
            {item.isFree
              ? <span className="rounded border border-emerald-400/40 bg-[#0d2b24] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-300">Free</span>
              : <span className="flex items-center gap-0.5 rounded border border-[#d4a52c]/45 bg-[#2a2110] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#f5e6b0]"><Zap className="h-2.5 w-2.5" style={{ color: GOLD }} />{item.price}</span>}
          </div>
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {isOpenable && item.isFree ? (
              <>
                <button onClick={() => onOpen(item)} className="rounded-lg border border-[#d4a52c]/60 bg-gradient-to-b from-[#d4a52c]/30 to-[#835e17]/30 px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.12em] text-[#fff4c7] transition hover:from-[#d4a52c]/45 hover:to-[#835e17]/45">Open</button>
                {showSaved
                  ? <button onClick={() => spotId && onRemoveSave(spotId)} className="flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-sky-300 transition hover:bg-sky-400/20"><Check className="h-3 w-3" /> Saved</button>
                  : <button onClick={() => onSave(item)} className="flex items-center gap-1.5 rounded-lg border border-[rgba(212,165,44,0.15)] bg-[#c091e]/8 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white/65 transition hover:border-[#c091e]/30 hover:text-white"><Bookmark className="h-3 w-3" /> Save</button>}
              </>
            ) : isOwned ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5 text-[11px] font-black uppercase text-emerald-300"><Check className="h-3 w-3" /> Owned</span>
            ) : (
              <>
                <button onClick={() => onGet(item)} className="rounded-lg border border-[#d4a52c]/60 bg-gradient-to-b from-[#d4a52c]/30 to-[#835e17]/30 px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.12em] text-[#fff4c7] transition hover:from-[#d4a52c]/45 hover:to-[#835e17]/45">{item.isFree ? 'Get' : `${item.price}cr`}</button>
                {spotId && (showSaved
                  ? <button onClick={() => spotId && onRemoveSave(spotId)} className="flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-sky-300 transition hover:bg-sky-400/20"><Check className="h-3 w-3" /> Saved</button>
                  : <button onClick={() => onSave(item)} className="flex items-center gap-1.5 rounded-lg border border-[rgba(212,165,44,0.15)] bg-[#c091e]/8 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white/65 transition hover:border-[#c091e]/30 hover:text-white"><Bookmark className="h-3 w-3" /> Save</button>)}
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function PublicLibraryView({ portalSlug }: { portalSlug?: string | null }) {
  const [tab, setTab] = useState('All');
  const [items, setItems] = useState<SpotLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedDetails, setSavedDetails] = useState<Record<string, SavedSpot>>({});
  const [saveModalItem, setSaveModalItem] = useState<SpotLibraryItem | null>(null);
  const [openSpotId, setOpenSpotId] = useState<string | null>(null);
  const [openSpotType, setOpenSpotType] = useState<string | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [creatorSearch, setCreatorSearch] = useState('');
  const [creatorDropdownOpen, setCreatorDropdownOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [creatorProfiles, setCreatorProfiles] = useState<Map<string, PublicProfileEntry>>(new Map());
  const [bioExpanded, setBioExpanded] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const demoUser = useDemoUserState();
  const demo = useDemo();
  const userId = demo.state.currentAccount?.id;

  const loadSaved = useCallback(async () => {
    if (!userId) return;
    const ids = await fetchSavedSpotIds(userId);
    setSavedIds(ids);
  }, [userId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [spots, products] = await Promise.all([
        fetchPublishedSpots(portalSlug),
        fetchPublishedProducts({}),
      ]);

      const spotItems: SpotLibraryItem[] = (spots as ContentSpot[]).map((s) => ({
        id: `content_spot-${s.id}`,
        source: 'content_spot' as const,
        title: s.title || 'Untitled',
        creator: s.creator_name || 'Unknown',
        description: s.subtitle || s.introduction || '',
        format: s.spot_type === 'multi_spot_analysis' ? 'Multi-Spot Analysis' : 'Spot',
        isFree: !s.is_monetized || s.price_credits === 0,
        price: s.price_credits,
        tags: Object.values(s.tags).filter((v): v is string => typeof v === 'string' && v.length > 0),
        thumbnailColor: '#d4a52c',
        thumbnailIcon: s.spot_type === 'multi_spot_analysis' ? 'BookOpen' : 'Target',
        rating: 0,
        views: 0,
        spotId: s.id,
        pokerSite: s.poker_site ?? null,
        difficulty: s.difficulty ?? null,
        comprehensionDifficulty: s.comprehension_difficulty ?? null,
        tournamentStakes: s.tournament_stakes ?? null,
        rawTags: s.tags as Record<string, unknown> | null,
        spotType: s.spot_type ?? null,
        coverUrl: s.cover_image_url ?? s.image_urls?.[0] ?? null,
      }));

      const productItems: SpotLibraryItem[] = (products as JukeboxProduct[]).map((p) => ({
        id: `jukebox_product-${p.id}`,
        source: 'jukebox_product' as const,
        title: p.title,
        creator: p.creator_name,
        description: p.description,
        format: 'Multi-Spot Analysis',
        isFree: p.price === 0,
        price: p.price,
        tags: [p.game_type, p.product_type].filter(Boolean),
        thumbnailColor: p.thumbnail_color || '#d4a52c',
        thumbnailIcon: p.product_type === 'full_tournament' ? 'Trophy' : 'Package',
        rating: Number(p.rating) || 0,
        views: p.purchase_count || 0,
        spotId: null,
        pokerSite: null,
        difficulty: null,
        comprehensionDifficulty: null,
        tournamentStakes: null,
        rawTags: null,
        spotType: null,
        coverUrl: null,
      }));

      const all = [...productItems, ...spotItems];
      setItems(all);

      const uniqueNames = Array.from(new Set(all.map((i) => i.creator || 'Unknown')));
      const [namedProfiles, discoverableProfiles] = await Promise.all([
        fetchProfilesByDisplayNames(uniqueNames),
        fetchPublicProfiles(100),
      ]);
      const profiles = new Map(namedProfiles);
      for (const profile of discoverableProfiles) profiles.set(profile.display_name, profile);
      setCreatorProfiles(profiles);
    } catch (err) {
      console.error('SpotLibrary load error:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [portalSlug]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadSaved(); }, [loadSaved]);

  const creators = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const name = item.creator || 'Unknown';
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const filteredCreators = useMemo(() => {
    if (!creatorSearch.trim()) return creators;
    const q = creatorSearch.toLowerCase();
    return creators.filter(([name]) => name.toLowerCase().includes(q));
  }, [creators, creatorSearch]);

  // Reset carousel when creator changes
  useEffect(() => { setCarouselIndex(0); setBioExpanded(false); }, [selectedCreator]);

  // Creator's filtered items for carousel
  const creatorItems = useMemo(() => {
    if (!selectedCreator) return [];
    let result = items.filter((i) => (i.creator || 'Unknown') === selectedCreator);
    if (tab === 'Free') result = result.filter((i) => i.isFree);
    else if (tab === 'Paid') result = result.filter((i) => !i.isFree);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q));
    }
    return result;
  }, [items, selectedCreator, tab, search]);

  const filtered = useMemo(() => {
    let result = items;
    if (tab === 'Free') result = result.filter((i) => i.isFree);
    else if (tab === 'Paid') result = result.filter((i) => !i.isFree);
    if (selectedCreator) result = result.filter((i) => (i.creator || 'Unknown') === selectedCreator);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q) || i.creator.toLowerCase().includes(q));
    }
    return result;
  }, [items, tab, search, selectedCreator]);

  const selectedCreatorProfile = selectedCreator ? creatorProfiles.get(selectedCreator) : null;

  const creatorSuggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return Array.from(creatorProfiles.values())
      .filter((profile) => profile.display_name.toLowerCase().includes(query) || profile.username?.toLowerCase().includes(query))
      .filter((profile, index, profiles) => profiles.findIndex((candidate) => candidate.user_id === profile.user_id) === index)
      .slice(0, 6);
  }, [creatorProfiles, search]);

  const selectCreator = (name: string) => {
    setSelectedCreator(name);
    setSearchFocused(false);
  };

  const handleGet = (item: SpotLibraryItem) => {
    if (purchased.has(item.id)) return;
    if (item.isFree) {
      setPurchased((prev) => new Set(prev).add(item.id));
      setMsg(`Added "${item.title}" to My Spots (free)!`);
      setTimeout(() => setMsg(null), 3000);
    } else if (spendCredits(item.price)) {
      setPurchased((prev) => new Set(prev).add(item.id));
      setMsg(`Purchased "${item.title}" for ${item.price} credits!`);
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg('Insufficient credits.');
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const handleOpen = (item: SpotLibraryItem) => {
    if (item.source === 'content_spot' && item.spotId) {
      setOpenSpotId(item.spotId);
      setOpenSpotType(item.spotType);
    }
  };

  const handleSave = async (item: SpotLibraryItem) => {
    if (!userId || !item.spotId) return;
    const existing = await checkSpotSaved(userId, item.spotId);
    if (existing) {
      setSaveModalItem(item);
    } else {
      setSaveModalItem(item);
    }
  };

  const handleSaveComplete = async (spotId: string) => {
    if (!userId) return;
    await loadSaved();
    const detail = await checkSpotSaved(userId, spotId);
    if (detail) {
      setSavedDetails((prev) => ({ ...prev, [spotId]: detail }));
    }
  };

  const handleRemoveSave = async (spotId: string) => {
    if (!userId) return;
    const ok = await unsaveSpot(userId, spotId);
    if (ok) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(spotId);
        return next;
      });
      setSavedDetails((prev) => {
        const next = { ...prev };
        delete next[spotId];
        return next;
      });
    }
  };

  // OPEN spot viewer mode
  if (openSpotId) {
    if (openSpotType === 'multi_spot_analysis') {
      return (
        <MultiSpotViewer
          spotId={openSpotId}
          onBack={() => { setOpenSpotId(null); setOpenSpotType(null); }}
        />
      );
    }
    return (
      <SpotViewer
        spotId={openSpotId}
        onBack={() => { setOpenSpotId(null); setOpenSpotType(null); }}
      />
    );
  }

  return (
    <div className={`mx-auto ${STORE_MAX_WIDTH} ${STORE_PADDING}`}>
      <PageHeader icon={Globe} title="Spot Library" />

      {/* Unified toolbar: search + filter tabs + creator filter in one row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" strokeWidth={1.5} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && creatorSuggestions[0]) {
                e.preventDefault();
                selectCreator(creatorSuggestions[0].display_name);
              }
              if (e.key === 'Escape') setSearchFocused(false);
            }}
            placeholder="Search spots, creators, packs..."
            className="w-full rounded-lg border border-[#232a32] bg-[#161b21] py-2 pl-9 pr-3 text-[11px] text-white/80 placeholder-white/25 outline-none transition-colors focus:border-[#c0911e]/30"
          />
          {searchFocused && search.trim() && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
              {creatorSuggestions.length > 0 ? creatorSuggestions.map((profile) => (
                <button
                  key={profile.user_id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectCreator(profile.display_name)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/5"
                >
                  {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d4a52c]/15 text-[10px] font-bold text-[#d4a52c]">{profile.display_name.charAt(0).toUpperCase()}</span>}
                  <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-white/80">{profile.display_name}</span>{profile.username && <span className="block truncate text-[9px] text-white/35">@{profile.username}</span>}</span>
                  {profile.is_verified && <span className="text-[8px] font-bold uppercase tracking-wider text-[#d4a52c]">Creator</span>}
                </button>
              )) : <p className="px-3 py-2 text-[10px] text-white/35">No creators found</p>}
            </div>
          )}
        </div>

        {/* Filter tabs inline — solid opaque backgrounds */}
        <div className="flex items-center gap-1">
          {FILTER_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg border px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider transition ${tab === t ? 'border-[#c0911e]/60 bg-[#1a1510] text-[#f5e6b0]' : 'border-[#2a2520] bg-[#110f0b] text-white/60 hover:text-white/80 hover:border-[#3a3530]'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Creator filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setCreatorDropdownOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition ${selectedCreator ? 'border-[#d4a52c]/50 bg-[#1a1510] text-[#f5e6b0] shadow-[0_0_10px_-2px_rgba(212,165,44,0.3)]' : 'border-[#2a2520] bg-[#110f0b] text-white/60 hover:text-white/80 hover:border-[#3a3530]'}`}
          >
            <User className="h-3.5 w-3.5" />
            {selectedCreator ? (
              <span className="max-w-[100px] truncate">{selectedCreator}</span>
            ) : (
              'Creator'
            )}
            {selectedCreator && (
              <span
                onClick={(e) => { e.stopPropagation(); setSelectedCreator(null); }}
                className="rounded p-0.5 hover:bg-white/10"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            {!selectedCreator && <ChevronDown className="h-3 w-3" />}
          </button>
          {creatorDropdownOpen && (
            <>
              <div className="fixed inset-0 z-[100]" onClick={() => { setCreatorDropdownOpen(false); setCreatorSearch(''); }} />
              <div className="absolute left-0 z-[101] mt-1 max-h-64 w-56 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
                <div className="sticky top-0 border-b border-white/[0.06] bg-[#0d0f12] p-2">
                  <input
                    type="text"
                    value={creatorSearch}
                    onChange={(e) => setCreatorSearch(e.target.value)}
                    placeholder="Search creators..."
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
                    autoFocus
                  />
                </div>
                {filteredCreators.length === 0 ? (
                  <p className="px-3 py-3 text-center text-[10px] text-white/30">No creators found</p>
                ) : (
                  filteredCreators.map(([name, count]) => (
                    <button
                      key={name}
                      onClick={() => { setSelectedCreator(name); setCreatorDropdownOpen(false); setCreatorSearch(''); }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-[10px] transition hover:bg-white/5 ${selectedCreator === name ? 'text-[#f5e6b0]' : 'text-white/60'}`}
                    >
                      <span className="truncate">{name}</span>
                      <span className="ml-2 shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[8px] text-white/35">{count}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {msg && (
        <div className="mb-3 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/10 px-3 py-2 text-[11px] font-medium text-[#d4a52c]">
          {msg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
        </div>
      ) : selectedCreator && creatorItems.length > 0 ? (
        /* ── Creator Split Layout: profile card + carousel ── */
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
          {/* LEFT: Creator profile card */}
          <div className="shrink-0 lg:w-72">
            <div
              className="relative overflow-hidden rounded-2xl border p-5"
              style={{ borderColor: 'rgba(212,165,44,0.18)', background: 'rgba(8,7,6,0.9)', boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)' }}
            >
              {/* Avatar with real profile picture or initials fallback */}
              <div className="flex flex-col items-center text-center">
                <div
                  className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2"
                  style={{ borderColor: 'rgba(212,165,44,0.35)', background: 'linear-gradient(135deg, rgba(212,165,44,0.15), rgba(12,10,8,0.8))' }}
                >
                  {selectedCreatorProfile?.avatar_url ? (
                    <img
                      src={selectedCreatorProfile.avatar_url}
                      alt={selectedCreator}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-black text-[#d4a52c]">
                      {selectedCreator.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-[15px] font-bold text-white">{selectedCreator}</h3>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="rounded border border-[#d4a52c]/25 bg-[#d4a52c]/8 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#d4a52c]">
                    Creator
                  </span>
                  <span className="text-[10px] text-white/40">{creatorItems.length} {creatorItems.length === 1 ? 'Spot' : 'Spots'}</span>
                </div>
              </div>

              {/* Biography */}
              {selectedCreatorProfile?.bio && (
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <p
                    className={`text-[11px] leading-relaxed text-white/55 ${bioExpanded ? '' : 'line-clamp-3'}`}
                  >
                    {selectedCreatorProfile.bio}
                  </p>
                  {selectedCreatorProfile.bio.length > 180 && (
                    <button
                      onClick={() => setBioExpanded((v) => !v)}
                      className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#d4a52c] transition hover:text-[#f5e6b0]"
                    >
                      {bioExpanded ? 'Show Less' : 'Read More'}
                    </button>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-4">
                <button
                  onClick={() => setSelectedCreator(null)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/60 transition hover:text-white hover:border-white/20"
                >
                  <X className="h-3 w-3" /> Clear Filter
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Carousel — one card at a time with prominent nav buttons */}
          <div className="min-w-0 flex-1">
            <div className="relative">
              <div className="mb-3 text-center text-[10px] font-bold uppercase tracking-wider text-[#d4a52c]">
                {creatorItems.length === 0 ? 'No content' : `Spot ${carouselIndex + 1} of ${creatorItems.length}`}
              </div>

              {/* Single carousel card */}
              {creatorItems[carouselIndex] && (
                <>
                  <CarouselCard
                    item={creatorItems[carouselIndex]}
                    purchased={purchased}
                    savedIds={savedIds}
                    savedDetails={savedDetails}
                    onOpen={handleOpen}
                    onGet={handleGet}
                    onSave={handleSave}
                    onRemoveSave={handleRemoveSave}
                  />
                  <div className="mt-3 flex justify-center">
                    <div className="flex items-center gap-3 rounded-full border border-[#c0911e]/40 bg-[#110f0b] px-4 py-2 shadow-lg">
                      <button
                        onClick={() => setCarouselIndex((i) => (i - 1 + creatorItems.length) % creatorItems.length)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d4a52c]/50 bg-[#1a1510] text-[#f5e6b0] transition-all hover:border-[#d4a52c] hover:bg-[#2a2110]"
                        aria-label="Previous spot"
                      >
                        <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                      <span className="text-[10px] font-mono font-bold tracking-wider text-[#f5e6b0]">‹ Spot {carouselIndex + 1} of {creatorItems.length} ›</span>
                      <button
                        onClick={() => setCarouselIndex((i) => (i + 1) % creatorItems.length)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d4a52c]/50 bg-[#1a1510] text-[#f5e6b0] transition-all hover:border-[#d4a52c] hover:bg-[#2a2110]"
                        aria-label="Next spot"
                      >
                        <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Globe className="mb-3 h-10 w-10 text-white/20" strokeWidth={1.5} />
          <p className="text-[12px] text-white/40">No content found</p>
          <p className="mt-1 text-[10px] text-white/25">Published content from creators will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const isOwned = purchased.has(item.id);
            const isSpot = item.source === 'content_spot';
            const isMsa = isSpot && item.spotType === 'multi_spot_analysis';
            const isOpenable = isSpot;
            const spotId = item.spotId;
            const isSaved = spotId ? savedIds.has(spotId) : false;
            const savedDetail = spotId ? savedDetails[spotId] : undefined;
            const savedExpired = savedDetail ? isSaveExpired(savedDetail) : false;
            const showSaved = isSaved && !savedExpired;
            const diffLevel = isSpot ? normalizeContentDepth(item.difficulty, item.rawTags?.difficulty as string | undefined) : null;
            const difficultyStyle = diffLevel ? getContentDepthStyle(diffLevel) : null;
            const compLevel = isSpot ? normalizeComprehension(item.comprehensionDifficulty) : null;
            const stakesLevel = isSpot ? normalizeStakes(item.tournamentStakes) : null;
            const stakesStyle = stakesLevel ? getStakesStyle(stakesLevel) : null;
            const HIDDEN_TAG_VALUES = ['mtt', 'chipev', 'icm', 'pko', 'middle', 'early', 'bubble', 'final table', 'heads up'];
            const visibleTags = item.tags
              .filter((tag) => tag.toLowerCase() !== diffLevel)
              .filter((tag) => !HIDDEN_TAG_VALUES.includes(tag.toLowerCase()))
              .slice(0, 2);

            return (
              <article
                key={item.id}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c091e]/30"
                onClick={() => isSpot && handleOpen(item)}
                style={{
                  borderColor: 'rgba(212,165,44,0.12)',
                  background: 'rgba(6, 8, 10, 0.55)',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                  boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)',
                }}
              >
                <div className="flex items-start gap-3 px-4 pt-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#d4a52c]/35 bg-[#c091e]/10 shadow-inner">
                    {isMsa ? <BookOpen className="h-[18px] w-[18px]" style={{ color: item.thumbnailColor }} /> : isSpot ? <PokerSiteLogo site={item.pokerSite} size={26} /> : <Package className="h-[18px] w-[18px]" style={{ color: item.thumbnailColor }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d4a52c]">{isSpot ? 'Spot' : item.format}</span>
                    </div>
                    <h3 className="mt-1 line-clamp-2 text-[15px] font-bold leading-snug text-white transition-colors group-hover:text-[#f5e6b0]">{item.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedCreator(item.creator || 'Unknown'); }}
                        className="truncate text-[12px] text-white/60 transition hover:text-[#d4a52c]"
                      >
                        by {item.creator}
                      </button>
                      {isSpot && !isMsa && item.pokerSite && item.pokerSite !== 'other' && (
                        <span className="inline-flex shrink-0 rounded border border-[rgba(212,165,44,0.15)] bg-[#c091e]/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/65">{POKER_SITE_LABELS[item.pokerSite] ?? item.pokerSite}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col px-4 pb-3.5 pt-3">
                  {item.description && <p className="line-clamp-2 text-[13px] leading-snug text-white/55">{item.description}</p>}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {difficultyStyle && (
                      <span
                        className="rounded border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide"
                        style={{ background: difficultyStyle.bg, color: difficultyStyle.text, borderColor: difficultyStyle.border }}
                      >
                        {difficultyStyle.label}
                      </span>
                    )}
                    {compLevel && <ComprehensionTag level={compLevel} size="small" />}
                    {stakesStyle && <StakesTag level={stakesLevel!} size="small" />}
                    {isSpot && <ReadingTimeBadge spot={{ subtitle: item.description }} size="small" />}
                    {visibleTags.map((tag) => <span key={tag} className="rounded border border-[rgba(212,165,44,0.15)] bg-[#c091e]/8 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/65">{tag}</span>)}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-[rgba(212,165,44,0.10)] pt-3">
                    <div className="flex items-center gap-1.5">
                      {showSaved && <span className="text-[10px] font-bold uppercase text-sky-300">Saved</span>}
                      {item.isFree
                        ? <span className="rounded border border-emerald-400/40 bg-[#0d2b24] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-300">Free</span>
                        : <span className="flex items-center gap-0.5 rounded border border-[#d4a52c]/45 bg-[#2a2110] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#f5e6b0]"><Zap className="h-2.5 w-2.5" style={{ color: GOLD }} />{item.price}</span>}
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {isOpenable && item.isFree ? (
                        <>
                          <button onClick={() => handleOpen(item)} className="rounded-lg border border-[#d4a52c]/60 bg-gradient-to-b from-[#d4a52c]/30 to-[#835e17]/30 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#fff4c7] transition hover:from-[#d4a52c]/45 hover:to-[#835e17]/45">Open</button>
                          {showSaved
                            ? <button onClick={() => spotId && handleRemoveSave(spotId)} className="flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-sky-300 transition hover:bg-sky-400/20"><Check className="h-3 w-3" /> Saved</button>
                            : <button onClick={() => handleSave(item)} className="flex items-center gap-1.5 rounded-lg border border-[rgba(212,165,44,0.15)] bg-[#c091e]/8 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white/65 transition hover:border-[#c091e]/30 hover:text-white"><Bookmark className="h-3 w-3" /> Save</button>}
                        </>
                      ) : isOwned ? (
                        <span className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[11px] font-black uppercase text-emerald-300"><Check className="h-3 w-3" /> Owned</span>
                      ) : (
                        <>
                          <button onClick={() => handleGet(item)} className="rounded-lg border border-[#d4a52c]/60 bg-gradient-to-b from-[#d4a52c]/30 to-[#835e17]/30 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#fff4c7] transition hover:from-[#d4a52c]/45 hover:to-[#835e17]/45">{item.isFree ? 'Get' : `${item.price}cr`}</button>
                          {spotId && (showSaved
                            ? <button onClick={() => spotId && handleRemoveSave(spotId)} className="flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-sky-300 transition hover:bg-sky-400/20"><Check className="h-3 w-3" /> Saved</button>
                            : <button onClick={() => handleSave(item)} className="flex items-center gap-1.5 rounded-lg border border-[rgba(212,165,44,0.15)] bg-[#c091e]/8 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white/65 transition hover:border-[#c091e]/30 hover:text-white"><Bookmark className="h-3 w-3" /> Save</button>)}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-mono text-white/30">
        <Zap className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
        Balance: <span className="font-bold" style={{ color: GOLD }}>{demoUser.credits.toLocaleString()}</span> credits
      </div>

      {/* Save Spot Modal */}
      {saveModalItem && saveModalItem.spotId && (
        <SaveSpotModal
          userId={userId!}
          spotId={saveModalItem.spotId}
          spotTitle={saveModalItem.title}
          isAlreadySaved={savedIds.has(saveModalItem.spotId)}
          currentDuration={savedDetails[saveModalItem.spotId]?.expires_at === null ? 'forever' : '30days'}
          onSaved={() => { void handleSaveComplete(saveModalItem.spotId!); }}
          onClose={() => setSaveModalItem(null)}
        />
      )}
    </div>
  );
}
