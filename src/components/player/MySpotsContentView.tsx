import { useState, useMemo, useCallback } from 'react';
import { Lock, BookOpen, Film, Target, Package, ChevronRight, Share2, SlidersHorizontal } from 'lucide-react';
import { useMySpotsItems, type MySpotsItem, type MySpotsCategory, type MySpotsContentType, categoryOf } from '@/lib/mySpotsStore';
import { openSpotPlayer } from '@/components/player/SpotMediaPlayer';
import { PokerSiteLogo } from '@/components/shared/PokerSiteLogo';
import {
  SearchInput,
  GOLD,
} from '@/components/ui/industry';

const PRIMARY_CATEGORIES: { id: MySpotsCategory; label: string; icon: typeof Film }[] = [
  { id: 'all', label: 'All', icon: Package },
  { id: 'spots', label: 'Spots', icon: Target },
  { id: 'hh-jukebox', label: 'Multi-Spots', icon: BookOpen },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'media', label: 'Videos', icon: Film },
  { id: 'bundles', label: 'Bundles', icon: Package },
];

const ALL_CATEGORY_TABS = PRIMARY_CATEGORIES;

const SORT_OPTIONS = [
  { id: 'recent', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'az', label: 'A–Z' },
] as const;

type SortId = (typeof SORT_OPTIONS)[number]['id'];

interface Props {
  userId?: string;
  sourceFilter?: 'purchased' | 'shared' | 'all';
  onOpenSpot?: (spotId: string) => void;
  onOpenHHJukebox?: (productId: string) => void;
  onOpenCourse?: (courseId: string) => void;
  onOpenBundle?: (bundleId: string) => void;
  onPlayMedia?: (item: MySpotsItem) => void;
  onOpenItem?: (item: MySpotsItem) => void;
}

export function MySpotsContentView({ userId, sourceFilter = 'purchased', onOpenSpot, onOpenHHJukebox, onOpenCourse, onOpenBundle, onPlayMedia, onOpenItem }: Props) {
  const { items, loading, error } = useMySpotsItems(userId);
  const [activeCategory, setActiveCategory] = useState<MySpotsCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortId>('recent');

  const sourceFiltered = useMemo(() => {
    if (sourceFilter === 'all') {
      return items;
    }
    if (sourceFilter === 'shared') {
      return items.filter((item) => item.source === 'syncshare');
    }
    return items.filter((item) => item.source !== 'syncshare');
  }, [items, sourceFilter]);

  const filtered = useMemo(() => {
    let result = sourceFiltered;
    if (activeCategory !== 'all') {
      result = result.filter((item) => categoryOf(item) === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.creator.toLowerCase().includes(q)
      );
    }
    const sorted = [...result];
    if (sortBy === 'recent') {
      sorted.sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
    } else if (sortBy === 'oldest') {
      sorted.sort((a, b) => new Date(a.grantedAt).getTime() - new Date(b.grantedAt).getTime());
    } else if (sortBy === 'az') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    return sorted;
  }, [sourceFiltered, activeCategory, searchQuery, sortBy]);

  const handleOpen = useCallback((item: MySpotsItem) => {
    if (item.contentType === 'media') {
      if (onPlayMedia) {
        onPlayMedia(item);
      } else {
        openSpotPlayer({
          id: item.id,
          title: item.title,
          creator: item.creator,
          videoUrl: item.videoUrl ?? '',
          contentType: 'media',
          posterUrl: item.thumbnail ?? undefined,
          youtubeVideoId: item.youtubeVideoId,
        });
      }
      return;
    }
    if (onOpenItem) {
      onOpenItem(item);
      return;
    }
    if (item.contentType === 'hh-jukebox' && onOpenHHJukebox) {
      onOpenHHJukebox(item.productId ?? item.contentId);
    } else if (item.contentType === 'spot' && onOpenSpot) {
      onOpenSpot(item.spotId ?? item.contentId);
    } else if (item.contentType === 'course' && onOpenCourse) {
      onOpenCourse(item.contentId);
    } else if (item.contentType === 'bundle' && onOpenBundle) {
      onOpenBundle(item.contentId);
    }
  }, [onPlayMedia, onOpenHHJukebox, onOpenSpot, onOpenCourse, onOpenBundle, onOpenItem]);

  const [showSort, setShowSort] = useState(false);
  const activeFilterCount = (sortBy !== 'recent' ? 1 : 0) + (activeCategory !== 'all' ? 1 : 0);

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Search + Sort button */}
      <div className="mb-1.5 flex items-center gap-2 sm:mb-2">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search My Spots..."
          className="min-w-0 flex-1"
        />
        <div className="relative shrink-0">
          <button
            onClick={() => setShowSort((s) => !s)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all sm:px-3 ${
              showSort || sortBy !== 'recent'
                ? 'border-[#c0911e]/50 bg-[#1a1408] text-[#f5e6b0]'
                : 'border-[#1a1f25] bg-[#0d1115] text-white/50 hover:text-white/70'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Sort</span>
          </button>
          {showSort && (
            <div className="absolute right-0 top-full z-20 mt-1 rounded-lg border border-[#1a1f25] bg-[#0d1115] p-1.5 shadow-xl">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { setSortBy(opt.id); setShowSort(false); }}
                  className={`block w-full rounded px-3 py-1.5 text-left text-[10px] font-semibold tracking-widest uppercase transition-all ${
                    sortBy === opt.id
                      ? 'bg-[#1a1408] text-[#f5e6b0]'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/70'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compact horizontal category chips — single row, scrollable on mobile */}
      <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto pb-0.5 sm:mb-3" style={{ WebkitOverflowScrolling: 'touch' }}>
        {ALL_CATEGORY_TABS.map((cat) => {
          const Icon = cat.icon;
          const active = activeCategory === cat.id;
          const count = cat.id === 'all' ? sourceFiltered.length : sourceFiltered.filter((i) => categoryOf(i) === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${
                active
                  ? 'border-[#c0911e]/50 bg-[#1a1408] text-[#f5e6b0] shadow-[0_0_12px_-4px_rgba(212,165,44,0.3)]'
                  : 'border-[#1a1f25] bg-[#0d1115] text-white/50 hover:border-[#c0911e]/20 hover:text-white/70'
              }`}
            >
              <Icon className="h-3 w-3" strokeWidth={1.5} />
              {cat.label}
              {count > 0 && <span className="text-[8px] opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Content shell */}
      <div
        className="min-h-0 rounded-2xl border p-2.5 sm:p-5 sm:min-h-[420px] lg:min-h-[520px]"
        style={{
          background: 'rgba(8,7,6,0.82)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          borderColor: 'rgba(212,165,44,0.12)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px -16px rgba(0,0,0,0.5)',
        }}
      >
        {loading ? (
          <div className="flex h-full min-h-0 items-center justify-center py-8 sm:min-h-[380px] lg:min-h-[480px]">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
          </div>
        ) : error ? (
          <div className="flex h-full min-h-0 flex-col items-center justify-center py-8 text-center sm:min-h-[380px] lg:min-h-[480px]">
            <p className="text-sm text-white/50">Something went wrong loading My Spots.</p>
            <p className="mt-1 text-[11px] text-white/30">Please try again later.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full min-h-0 items-center justify-center py-8 sm:min-h-[380px] lg:min-h-[480px]">
            <EmptyMySpots sourceFilter={sourceFilter} />
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((item) => (
              <MySpotsRow key={item.id} item={item} onOpen={() => handleOpen(item)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MySpotsRow({ item, onOpen }: { item: MySpotsItem; onOpen: () => void }) {
  const typeLabel = getTypeLabel(item.contentType);
  const TypeIcon = getTypeIconComponent(item.contentType);
  const actionLabel = getActionLabel(item);
  const sourceLabel = getSourceLabel(item);

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2 transition-all hover:border-[#c0911e]/25 hover:bg-black/35 sm:gap-3 sm:px-3 sm:py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#c0911e]/20 bg-[#c0911e]/[0.08]">
        {item.thumbnail ? <img src={item.thumbnail} alt="" className="h-full w-full rounded-md object-cover" /> : <TypeIcon className="h-4 w-4" strokeWidth={1.5} />}
      </div>
      {(item.contentType === 'spot' || item.contentType === 'msa') && item.pokerSite && (
        <PokerSiteLogo site={item.pokerSite} size={20} />
      )}
      <div className="hidden w-28 shrink-0 flex-col gap-0.5 sm:flex">
        <span className="text-[8px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>{typeLabel}</span>
        <span className="text-[8px] text-white/25">{sourceLabel}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-white/90 sm:text-[12px]">{item.title}</p>
        <p className="mt-0.5 truncate text-[9px] text-white/35">by {item.creator}</p>
        {item.progress && item.progress.percent > 0 && <p className="mt-0.5 text-[8px] text-[#d4a52c]/65">{item.progress.currentLabel}</p>}
      </div>
      <span className="hidden shrink-0 items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-1 text-[7px] font-bold tracking-widest text-emerald-400/80 uppercase md:flex">
        <Lock className="h-2.5 w-2.5" strokeWidth={1.5} /> Available
      </span>
      <button onClick={onOpen} className="flex shrink-0 items-center gap-1 rounded-md border border-[#c0911e]/35 bg-[#c0911e]/10 px-2.5 py-1.5 text-[9px] font-bold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20 sm:px-3">
        {actionLabel}
        <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
      </button>
    </div>
  );
}

function EmptyMySpots({ sourceFilter }: { sourceFilter?: 'purchased' | 'shared' | 'all' }) {
  if (sourceFilter === 'shared') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
          <Share2 className="h-7 w-7 text-white/20" strokeWidth={1.5} />
        </div>
        <p className="mt-3 text-sm font-medium text-white/40">Nothing shared with you yet</p>
        <p className="mt-1 max-w-sm text-[11px] text-white/25">
          When other users share their content with you through SyncShare, it will appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
        <Lock className="h-7 w-7 text-white/20" strokeWidth={1.5} />
      </div>
      <p className="mt-3 text-sm font-medium text-white/40">Nothing in My Spots yet</p>
      <p className="mt-1 max-w-sm text-[11px] text-white/25">
        Content you purchase or receive as a gift will appear here.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase">Browse:</span>
        <a href="#" className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20">
          <Target className="h-3 w-3" /> Spots
        </a>
        <a href="#" className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20">
          <BookOpen className="h-3 w-3" /> Multi-Spots
        </a>
        <a href="#" className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20">
          <BookOpen className="h-3 w-3" /> Courses
        </a>
      </div>
    </div>
  );
}

function getTypeIconComponent(type: MySpotsContentType): typeof Film {
  const icons: Record<MySpotsContentType, typeof Film> = {
    'spot': Target,
    'hh-jukebox': BookOpen,
    'msa': BookOpen,
    'course': BookOpen,
    'media': Film,
    'bundle': Package,
  };
  return icons[type] ?? Package;
}

function getTypeLabel(type: MySpotsContentType): string {
  const labels: Record<MySpotsContentType, string> = {
    'spot': 'TEXT SPOT',
    'hh-jukebox': 'MULTI-SPOT ANALYSIS',
    'msa': 'MULTI-SPOT',
    'course': 'COURSE',
    'media': 'VIDEO SPOT',
    'bundle': 'BUNDLE',
  };
  return labels[type] ?? 'ITEM';
}

function getActionLabel(item: MySpotsItem): string {
  if (item.contentType === 'media') return 'Play';
  if (item.contentType === 'hh-jukebox') return 'Play';
  if (item.contentType === 'msa') return 'Start';
  if (item.contentType === 'course') {
    if (item.progress && item.progress.percent > 0 && item.progress.percent < 100) return 'Continue';
    return 'Start';
  }
  return 'Open';
}

function getSourceLabel(item: MySpotsItem): string {
  const labels: Record<string, string> = {
    'free_claim': 'Free claim',
    'gift': 'Gifted',
    'creator_grant': 'Creator grant',
    'coach_grant': 'Coach grant',
    'promotion': 'Promotional',
    'subscription': 'Subscription',
    'syncshare': 'SyncShared',
    'purchase': 'Purchased',
  };
  return labels[item.source] ?? item.source;
}
