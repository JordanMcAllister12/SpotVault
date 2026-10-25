import { useState, useMemo } from 'react';
import {
  Search, Star, ShieldCheck, Zap, ChevronRight, SlidersHorizontal,
  Trophy, ArrowLeft,
} from 'lucide-react';
import {
  TALENT_PROFILES, CATEGORY_LABELS, type TalentProfile, type TalentCategory,
} from '@/data/talent';

interface Props {
  onSelectTalent: (talent: TalentProfile) => void;
  onBack: () => void;
}

const CATEGORIES: (TalentCategory | 'ALL')[] = [
  'ALL', 'POKER_PRO', 'COACH', 'CREATOR', 'MEDIA', 'COMMENTATOR', 'INDUSTRY_EXPERT',
];

const PRICE_FILTERS = [
  { label: 'Any Price', value: 0 },
  { label: 'Under 200', value: 200 },
  { label: 'Under 500', value: 500 },
  { label: 'Under 1000', value: 1000 },
];

export function BookAPro({ onSelectTalent, onBack }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<TalentCategory | 'ALL'>('ALL');
  const [priceFilter, setPriceFilter] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return TALENT_PROFILES.filter((t) => {
      if (category !== 'ALL' && t.category !== category) return false;
      if (priceFilter > 0 && t.fromPriceCredits > priceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.name.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.specialties.some((s) => s.toLowerCase().includes(q));
      }
      return true;
    });
  }, [search, category, priceFilter]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#1a1f25] bg-[#0a0c0e]/60 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back
          </button>
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Book a Pro</h1>
              <p className="text-[10px] font-mono tracking-[0.2em] text-[#d4a52c]/70 uppercase">Premium Access Marketplace</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all ${
            showFilters ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#d4a52c]' : 'border-[#232a32] bg-[#161b21] text-[#aab6c2] hover:border-[#38424e]'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
        </button>
      </header>

      {/* Search bar */}
      <div className="shrink-0 border-b border-[#1a1f25] px-6 py-3">
        <div className="relative mx-auto max-w-2xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5f6e7c]" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players, coaches, creators..."
            className="w-full rounded-lg border border-[#232a32] bg-[#11151a] py-2.5 pl-11 pr-4 text-sm text-white placeholder-[#475565] focus:border-[#c0911e]/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="shrink-0 border-b border-[#1a1f25] bg-[#0a0c0e]/40 px-6 py-3">
          <div className="mx-auto max-w-4xl space-y-3">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${
                    category === cat
                      ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#d4a52c]'
                      : 'border-[#232a32] bg-[#161b21] text-[#aab6c2] hover:border-[#38424e]'
                  }`}
                >
                  {cat === 'ALL' ? 'All' : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase self-center">Price:</span>
              {PRICE_FILTERS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriceFilter(p.value)}
                  className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${
                    priceFilter === p.value
                      ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#d4a52c]'
                      : 'border-[#232a32] bg-[#161b21] text-[#aab6c2] hover:border-[#38424e]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 text-xs text-[#5f6e7c]">{filtered.length} talent {filtered.length === 1 ? 'profile' : 'profiles'} available</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((talent) => (
              <TalentCard key={talent.id} talent={talent} onSelect={() => onSelectTalent(talent)} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="h-12 w-12 text-[#2a323b]" strokeWidth={1} />
              <p className="mt-3 text-sm text-[#5f6e7c]">No talent found matching your filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TalentCard({ talent, onSelect }: { talent: TalentProfile; onSelect: () => void }) {
  return (
    <div className="metal-panel group flex flex-col rounded-xl p-5 transition-all hover:border-[#c0911e]/30">
      {/* Top: photo + verified */}
      <div className="flex items-start gap-3">
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-lg font-bold text-[#d4a52c]">
            {talent.photoInitials}
          </div>
          {talent.verified && (
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#0a0c0e] bg-[#0a0c0e]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={2} />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-white">{talent.name}</h3>
          </div>
          <p className="text-xs text-[#5f6e7c]">{CATEGORY_LABELS[talent.category]} · {talent.title.split(' / ')[0]}</p>
        </div>
      </div>

      {/* Specialties */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {talent.specialties.slice(0, 3).map((s) => (
          <span key={s} className="rounded border border-[#232a32] bg-[#11151a] px-2 py-0.5 text-[9px] font-mono tracking-wide text-[#aab6c2]">{s}</span>
        ))}
      </div>

      {/* Rating + price */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map((i) => (
              <Star key={i} className={`h-3 w-3 ${i <= Math.round(talent.rating) ? 'text-[#d4a52c]' : 'text-[#2a323b]'}`} fill="currentColor" />
            ))}
          </div>
          <span className="text-[10px] text-[#5f6e7c]">{talent.rating} ({talent.reviewCount})</span>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">From</div>
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-[#d4a52c]" />
            <span className="text-sm font-bold text-[#d4a52c]">{talent.fromPriceCredits}</span>
          </div>
        </div>
      </div>

      {/* Button */}
      <button
        onClick={onSelect}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] py-2.5 text-[10px] font-semibold tracking-widest text-[#aab6c2] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
      >
        View Profile <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
      </button>
    </div>
  );
}
