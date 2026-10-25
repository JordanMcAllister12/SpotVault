import { useState, useMemo } from 'react';
import { Crown, TrendingUp, ChevronRight, X, Star, SlidersHorizontal, ExternalLink } from 'lucide-react';
import {
  STAKEKINGS_ACTION_LISTINGS,
  STAKEKINGS_SORT_OPTIONS,
  type StakeKingsActionListing,
  type StakeKingsSortId,
} from '@/data/stakekingsAction';
import {
  GOLD, GOLD_SOFT, SK_GREEN,
  CARD_BORDER, CARD_BG, CARD_SHADOW,
  STORE_MAX_WIDTH, STORE_PADDING,
} from '@/components/store/storeTokens';


const GOLD_BRIGHT = GOLD_SOFT;

interface Props {
  onViewPlayer?: (peopleProfileId: string) => void;
}

export function StakeKingsActionMarketplace({ onViewPlayer }: Props) {
  const [selectedListing, setSelectedListing] = useState<StakeKingsActionListing | null>(null);
  const [sortBy, setSortBy] = useState<StakeKingsSortId>('featured');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [filterBuyIn, setFilterBuyIn] = useState<string>('all');
  const [filterMarkup, setFilterMarkup] = useState<string>('all');

  const events = useMemo(() => {
    const set = new Set(STAKEKINGS_ACTION_LISTINGS.map((l) => l.event));
    return ['all', ...Array.from(set)];
  }, []);

  const sorted = useMemo(() => {
    let list = [...STAKEKINGS_ACTION_LISTINGS];

    if (filterEvent !== 'all') list = list.filter((l) => l.event === filterEvent);
    if (filterBuyIn !== 'all') {
      const [min, max] = filterBuyIn.split('-').map(Number);
      list = list.filter((l) => l.buyInValue >= min && (isNaN(max) || l.buyInValue <= max));
    }
    if (filterMarkup !== 'all') {
      const [min, max] = filterMarkup.split('-').map(Number);
      list = list.filter((l) => l.markup >= min && (isNaN(max) || l.markup <= max));
    }

    switch (sortBy) {
      case 'featured':
        list.sort((a, b) => {
          const rank = (s: string) => (s === 'featured' ? 0 : s === 'selling_fast' ? 1 : 2);
          return rank(a.status) - rank(b.status);
        });
        break;
      case 'selling_fast':
        list.sort((a, b) => a.percentRemaining - b.percentRemaining);
        break;
      case 'lowest_markup':
        list.sort((a, b) => a.markup - b.markup);
        break;
      case 'highest_buyin':
        list.sort((a, b) => b.buyInValue - a.buyInValue);
        break;
      case 'newest':
        list.sort((a, b) => b.id.localeCompare(a.id));
        break;
    }
    return list;
  }, [sortBy, filterEvent, filterBuyIn, filterMarkup]);

  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = (filterEvent !== 'all' ? 1 : 0) + (filterBuyIn !== 'all' ? 1 : 0) + (filterMarkup !== 'all' ? 1 : 0) + (sortBy !== 'featured' ? 1 : 0);

  return (
    <div className={`mx-auto ${STORE_MAX_WIDTH} ${STORE_PADDING}`}>
      {/* Compact filter toggle */}
      <div className="mb-3">
        <button
          onClick={() => setShowFilters((s) => !s)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${showFilters || activeFilterCount > 0 ? 'border-[#c0911e]/50 bg-[#1a1408] text-[#f5e6b0]' : 'border-[#1a1f25] bg-[#0d1115] text-white/50 hover:border-[#2a323a] hover:text-white/70'}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-[#c0911e]/30 px-1.5 text-[9px] font-bold text-[#f5e6b0]">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* Expandable filter panel */}
      {showFilters && (
        <div className="mb-4 rounded-xl border border-[#1a1f25] bg-[#0d1115] p-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Filters</span>
            <button onClick={() => setShowFilters(false)} className="text-white/30 hover:text-white/60">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterDropdown label="Event" value={filterEvent} onChange={setFilterEvent} options={events.map((e) => ({ id: e, label: e === 'all' ? 'All Events' : e }))} />
            <FilterDropdown label="Buy-In" value={filterBuyIn} onChange={setFilterBuyIn} options={[
              { id: 'all', label: 'All' },
              { id: '0-10000', label: '< $10K' },
              { id: '10000-15000', label: '$10K–$15K' },
              { id: '15000-999999', label: '$15K+' },
            ]} />
            <FilterDropdown label="Markup" value={filterMarkup} onChange={setFilterMarkup} options={[
              { id: 'all', label: 'All' },
              { id: '1-1.1', label: '≤ 1.10' },
              { id: '1.1-1.15', label: '1.10–1.15' },
              { id: '1.15-2', label: '1.15+' },
            ]} />
            <FilterDropdown label="Sort" value={sortBy} onChange={(v) => setSortBy(v as StakeKingsSortId)} options={STAKEKINGS_SORT_OPTIONS.map((s) => ({ id: s.id, label: s.label }))} />
          </div>
        </div>
      )}

      {/* Listings grid — 4 cols on very wide desktop, 3 on standard, 2 on tablet, 1 on mobile */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((listing) => (
          <ActionCard key={listing.id} listing={listing} onView={() => setSelectedListing(listing)} onViewPlayer={() => onViewPlayer?.(listing.peopleProfileId ?? '')} />
        ))}
      </div>

      {/* Detail modal */}
      {selectedListing && (
        <ActionDetailModal listing={selectedListing} onClose={() => setSelectedListing(null)} onViewPlayer={() => onViewPlayer?.(selectedListing.peopleProfileId ?? '')} />
      )}
    </div>
  );
}

function FilterDropdown({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg border border-[#232a32] bg-[#161b21] py-1.5 pl-3 pr-7 text-[10px] font-semibold tracking-widest text-white/60 uppercase outline-none transition-colors hover:border-[#38424e] focus:border-[#c0911e]/30"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-[#0a0b0e] text-white">
            {label}: {o.label}
          </option>
        ))}
      </select>
      <ChevronRight className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 rotate-90 text-white/40" strokeWidth={1.5} />
    </div>
  );
}

function ActionCard({ listing, onView, onViewPlayer }: { listing: StakeKingsActionListing; onView: () => void; onViewPlayer: () => void }) {
  const percentSold = listing.percentOffered - listing.percentRemaining;
  const purchaseUrl = getVerifiedPurchaseUrl(listing.verifiedPurchaseUrl);
  const soldRatio = (percentSold / listing.percentOffered) * 100;

  return (
    <div className="group flex flex-col rounded-xl border p-3 transition-all hover:border-[#c0911e]/30" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
      {/* Badges row */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[7px] font-bold tracking-widest uppercase" style={{ borderColor: SK_GREEN + '40', background: SK_GREEN + '12', color: SK_GREEN }}>
            <Crown className="h-2 w-2" strokeWidth={1.5} /> SK
          </span>
          {listing.status === 'featured' && (
            <span className="inline-flex items-center gap-0.5 rounded border border-[#c091e]/30 bg-[#c091e]/10 px-1 py-0.5 text-[7px] font-bold tracking-widest text-[#d4a52c] uppercase">
              <Star className="h-2 w-2" strokeWidth={1.5} /> Featured
            </span>
          )}
          {listing.status === 'selling_fast' && (
            <span className="inline-flex items-center gap-0.5 rounded border border-orange-500/30 bg-orange-500/10 px-1 py-0.5 text-[7px] font-bold tracking-widest text-orange-400 uppercase">
              <TrendingUp className="h-2 w-2" strokeWidth={1.5} /> Fast
            </span>
          )}
        </div>
        <span className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-[6px] font-bold tracking-widest text-white/40 uppercase">
          Demo
        </span>
      </div>

      {/* Event */}
      <div className="text-[8px] font-mono tracking-widest text-white/45 uppercase">{listing.event}</div>

      {/* Player name + avatar */}
      <div className="mt-1 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#c091e]/10 text-[10px] font-bold text-[#d4a52c]/70">
          {listing.avatarInitials}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[12px] font-semibold text-white/90">{listing.playerName}</h3>
          <p className="truncate text-[9px] text-white/45">{listing.playerDescriptor}</p>
        </div>
      </div>

      {/* Action remaining */}
      <div className="mt-2 rounded-md border border-[#1a1f25] bg-black/30 px-2.5 py-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] font-bold" style={{ color: listing.percentRemaining <= 5 ? '#f87171' : GOLD_BRIGHT }}>
            {listing.percentRemaining}% REMAINING
          </span>
          <span className="text-[8px] text-white/40">of {listing.percentOffered}%</span>
        </div>
        {/* Progress bar */}
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#1a1f25]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${soldRatio}%`,
              background: soldRatio > 70 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : `linear-gradient(90deg, ${GOLD}, ${GOLD_BRIGHT})`,
            }}
          />
        </div>
        <div className="mt-0.5 flex justify-between text-[7px] text-white/35">
          <span>{percentSold}% sold</span>
          <span>{listing.percentRemaining}% left</span>
        </div>
      </div>

      {/* Markup + Buy-in */}
      <div className="mt-2 flex items-center justify-between text-[9px]">
        <div>
          <span className="text-white/40">MU</span>
          <span className="ml-1 font-bold text-white/80">{listing.markup.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-white/40">Buy-in</span>
          <span className="ml-1 font-bold text-white/80">{listing.buyIn}</span>
        </div>
      </div>

      {/* Quick purchase percentages */}
      <div className="mt-2 grid grid-cols-3 gap-1">
        {listing.quickPercents.map((qp) => (
          <div key={qp.pct} className="rounded-md border border-[#232a32] bg-[#161b21] px-1 py-1 text-center">
            <div className="text-[8px] font-bold text-white/70">{qp.pct}%</div>
            <div className="text-[8px] text-white/45">{qp.price}</div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="mt-2.5 flex gap-1.5 border-t border-[#1a1f25] pt-2.5">
        <button
          onClick={onView}
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[#232a32] bg-[#161b21] px-2 py-1.5 text-[8px] font-semibold tracking-widest text-white/60 uppercase transition hover:border-[#38424e] hover:text-white/80"
        >
          View Details
        </button>
        {purchaseUrl ? (
          <a
            href={purchaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-2 py-1.5 text-[8px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition hover:from-[#c0911e]/25 hover:to-[#835e17]/25"
          >
            Buy Action <ExternalLink className="h-2.5 w-2.5" strokeWidth={1.5} />
          </a>
        ) : (
          <button disabled className="flex flex-1 items-center justify-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[8px] font-semibold tracking-widest text-white/30 uppercase">
            Purchase Link Pending
          </button>
        )}
      </div>
    </div>
  );
}

function ActionDetailModal({ listing, onClose, onViewPlayer }: { listing: StakeKingsActionListing; onClose: () => void; onViewPlayer: () => void }) {
  const [selectedPct, setSelectedPct] = useState(listing.quickPercents[0]?.pct ?? 1);
  const verifiedUrl = getVerifiedPurchaseUrl(listing.verifiedPurchaseUrl);

  const percentSold = listing.percentOffered - listing.percentRemaining;
  const soldRatio = (percentSold / listing.percentOffered) * 100;
  const sym = listing.buyInCurrency === 'EUR' ? '€' : '$';
  const estimatedCost = (listing.buyInValue * listing.markup * selectedPct) / 100;
  const costStr = `${sym}${estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const availablePercents = [1, 2.5, 5, 10].filter((p) => p <= listing.percentRemaining);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border border-[#c0911e]/20 bg-[rgba(12,10,8,0.98)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute right-3 top-3 z-10 text-white/40 transition-colors hover:text-white/70">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <div className="p-6">
            {/* Badges */}
            <div className="mb-3 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase" style={{ borderColor: SK_GREEN + '40', background: SK_GREEN + '12', color: SK_GREEN }}>
                <Crown className="h-2.5 w-2.5" strokeWidth={1.5} /> StakeKings
              </span>
              {listing.status === 'featured' && (
                <span className="inline-flex items-center gap-0.5 rounded border border-[#c091e]/30 bg-[#c091e]/10 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-[#d4a52c] uppercase">
                  <Star className="h-2.5 w-2.5" strokeWidth={1.5} /> Featured
                </span>
              )}
              {listing.status === 'selling_fast' && (
                <span className="inline-flex items-center gap-0.5 rounded border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-orange-400 uppercase">
                  <TrendingUp className="h-2.5 w-2.5" strokeWidth={1.5} /> Selling Fast
                </span>
              )}
              <span className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-white/40 uppercase">
                Demo Listing
              </span>
            </div>

            {/* Player */}
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#c091e]/10 text-lg font-bold text-[#d4a52c]/70">
                {listing.avatarInitials}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{listing.playerName}</h3>
                <p className="text-[11px] text-white/50">{listing.playerDescriptor}</p>
              </div>
            </div>

            {/* Event info */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <InfoBox label="Event" value={listing.event} />
              <InfoBox label="Buy-in" value={listing.buyIn} />
              <InfoBox label="Demo Markup" value={listing.markup.toFixed(2)} />
              <InfoBox label="Originally Offered" value={`${listing.percentOffered}%`} />
            </div>

            {/* Sold / remaining */}
            <div className="mt-4 rounded-xl border border-[#1a1f25] bg-black/30 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold" style={{ color: listing.percentRemaining <= 5 ? '#f87171' : GOLD_BRIGHT }}>
                  {listing.percentRemaining}% REMAINING
                </span>
                <span className="text-[10px] text-white/40">of {listing.percentOffered}% originally offered</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#1a1f25]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${soldRatio}%`,
                    background: soldRatio > 70 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : `linear-gradient(90deg, ${GOLD}, ${GOLD_BRIGHT})`,
                  }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[9px] text-white/40">
                <span>{percentSold}% sold</span>
                <span>{listing.percentRemaining}% remaining</span>
              </div>
            </div>

            {/* Percentage selector */}
            <div className="mt-4">
              <div className="mb-2 text-[10px] font-mono tracking-widest text-white/45 uppercase">Select Action Percentage</div>
              <div className="flex flex-wrap gap-1.5">
                {availablePercents.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setSelectedPct(pct)}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-all ${
                      selectedPct === pct
                        ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
                        : 'border-[#232a32] bg-[#161b21] text-white/60 hover:border-[#38424e] hover:text-white/80'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="mt-2.5 flex items-center justify-between rounded-lg border border-[#1a1f25] bg-[#161b21] px-3 py-2">
                <span className="text-[10px] text-white/50">Estimated Cost</span>
                <span className="text-sm font-bold" style={{ color: GOLD_BRIGHT }}>{costStr}</span>
              </div>
            </div>

            {/* Disclaimer */}
            <p className="mt-3 text-[9px] leading-relaxed text-white/35">
              Action offered through StakeKings. DEMO LISTING — terms shown for prototype purposes only.
            </p>

            {/* CTAs */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={onViewPlayer}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2.5 text-[10px] font-semibold tracking-widest text-white/60 uppercase transition hover:border-[#38424e] hover:text-white/80"
              >
                View Player Profile
              </button>
              {verifiedUrl ? (
                <a
                  href={verifiedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-gradient-to-r from-[#c0911e]/25 to-[#c0911e]/15 px-3 py-2.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:from-[#c0911e]/35 hover:to-[#c0911e]/25"
                >
                  <ExternalLink className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} /> Buy Action
                </a>
              ) : (
                <button
                  disabled
                  className="flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[10px] font-bold tracking-widest text-white/30 uppercase"
                >
                  Purchase Link Pending
                </button>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}

function getVerifiedPurchaseUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'stakekings.com' || url.hostname.endsWith('.stakekings.com')) ? url.toString() : null;
  } catch {
    return null;
  }
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1a1f25] bg-[#161b21] px-3 py-2">
      <div className="text-[8px] font-mono tracking-widest text-white/35 uppercase">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-white/80">{value}</div>
    </div>
  );
}
