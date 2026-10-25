import { useState, useEffect } from 'react';
import { Tag, Zap, Clock, ChevronRight, Sparkles } from 'lucide-react';
import {
  fetchFloorOffers,
  OFFER_TYPE_LABELS,
  type FloorOffer,
  type OfferType,
} from '@/data/floorOffers';
import type { PlayerNetworkFloor } from '@/data/playerNetworkFloors';

interface Props {
  floor: PlayerNetworkFloor;
}

// ===== FLOOR OFFERS RAIL =====
// Compact side rail showing floor-specific offers and advertising.
// Styling escalates with floor level — Motel is casual neon, Penthouse
// is minimal ultra-luxury. Sponsored content is always clearly labeled.

export function FloorOffersRail({ floor }: Props) {
  const [offers, setOffers] = useState<FloorOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFloorOffers(floor.id).then((data) => {
      if (!cancelled) {
        setOffers(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [floor.id]);

  const style = getFloorStyle(floor.aesthetic);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-4 py-3"
        style={{ borderColor: style.borderColor }}
      >
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: floor.accentColor }} />
          <span
            className="text-[10px] font-mono tracking-[0.2em] uppercase"
            style={{ color: style.headerColor }}
          >
            Offers / For You
          </span>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase"
          style={{
            background: style.badgeBg,
            color: style.badgeColor,
          }}
        >
          {offers.length} Live
        </span>
      </div>

      {/* Offers list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: floor.accentColor }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                floor={floor}
                style={style}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== OFFER CARD =====

function OfferCard({
  offer,
  floor,
  style,
}: {
  offer: FloorOffer;
  floor: PlayerNetworkFloor;
  style: FloorStyle;
}) {
  const isCoaching = offer.offer_type === 'COACHING';
  const isSponsored = offer.is_sponsored;

  return (
    <div
      className="group relative overflow-hidden rounded-lg border transition-all duration-200 hover:border-[var(--hover-border)]"
      style={{
        borderColor: style.cardBorder,
        background: style.cardBg,
      }}
    >
      {/* Sponsored badge */}
      {isSponsored && offer.sponsor_label && (
        <div
          className="absolute right-0 top-0 px-1.5 py-0.5 text-[7px] font-bold tracking-widest uppercase"
          style={{
            background: style.sponsorBg,
            color: style.sponsorColor,
          }}
        >
          {offer.sponsor_label}
        </div>
      )}

      <div className="p-3">
        {/* Offer type label */}
        <div className="mb-1.5 flex items-center gap-1.5">
          <span
            className="text-[8px] font-mono tracking-widest uppercase"
            style={{ color: style.typeColor }}
          >
            {OFFER_TYPE_LABELS[offer.offer_type as OfferType]}
          </span>
          {isCoaching && offer.provider_floor && (
            <span
              className="text-[8px] font-mono tracking-widest uppercase"
              style={{ color: floor.accentColor + '80' }}
            >
              · Floor {String(offer.provider_floor).padStart(2, '0')}
            </span>
          )}
        </div>

        {/* Headline */}
        <h4
          className="text-xs font-bold leading-snug"
          style={{ color: style.headlineColor }}
        >
          {offer.headline}
        </h4>

        {/* Description */}
        {offer.description && (
          <p className="mt-1 text-[10px] leading-relaxed" style={{ color: style.descColor }}>
            {offer.description}
          </p>
        )}

        {/* Provider */}
        <div className="mt-2 flex items-center gap-1.5">
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-semibold"
            style={{
              background: style.avatarBg,
              color: style.avatarColor,
            }}
          >
            {offer.provider_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-medium" style={{ color: style.providerColor }}>
              {offer.provider_name}
            </span>
            {offer.provider_handle && (
              <span className="text-[8px]" style={{ color: style.handleColor }}>
                {offer.provider_handle}
              </span>
            )}
          </div>
        </div>

        {/* Price + CTA */}
        <div className="mt-2.5 flex items-center justify-between border-t pt-2" style={{ borderColor: style.dividerColor }}>
          <div className="flex items-center gap-2">
            {offer.credits_price !== null && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" strokeWidth={1.5} style={{ color: floor.accentColor }} />
                <span className="text-xs font-bold" style={{ color: floor.accentColor }}>
                  {offer.credits_price}
                </span>
              </div>
            )}
            {offer.duration_minutes !== null && (
              <div className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" strokeWidth={1.5} style={{ color: style.metaColor }} />
                <span className="text-[9px]" style={{ color: style.metaColor }}>
                  {offer.duration_minutes}m
                </span>
              </div>
            )}
          </div>
          <button
            className="flex items-center gap-0.5 rounded-md px-2 py-1 text-[9px] font-bold tracking-widest uppercase transition-all group-hover:gap-1"
            style={{
              background: style.ctaBg,
              color: style.ctaColor,
            }}
          >
            {offer.cta_label ?? 'View'}
            <ChevronRight className="h-2.5 w-2.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== FLOOR-SPECIFIC STYLING =====
// UI sophistication escalates with floor level.

interface FloorStyle {
  headerColor: string;
  borderColor: string;
  badgeBg: string;
  badgeColor: string;
  cardBorder: string;
  cardBg: string;
  hoverBorder: string;
  typeColor: string;
  headlineColor: string;
  descColor: string;
  providerColor: string;
  handleColor: string;
  avatarBg: string;
  avatarColor: string;
  dividerColor: string;
  metaColor: string;
  ctaBg: string;
  ctaColor: string;
  sponsorBg: string;
  sponsorColor: string;
}

function getFloorStyle(aesthetic: PlayerNetworkFloor['aesthetic']): FloorStyle {
  switch (aesthetic) {
    case 'motel':
      return {
        headerColor: 'rgba(255,255,255,0.45)',
        borderColor: 'rgba(232,160,64,0.08)',
        badgeBg: 'rgba(232,160,64,0.15)',
        badgeColor: '#e8a040',
        cardBorder: 'rgba(255,255,255,0.06)',
        cardBg: 'rgba(20,14,8,0.5)',
        hoverBorder: 'rgba(232,160,64,0.25)',
        typeColor: 'rgba(232,160,64,0.7)',
        headlineColor: 'rgba(255,255,255,0.9)',
        descColor: 'rgba(255,255,255,0.45)',
        providerColor: 'rgba(255,255,255,0.65)',
        handleColor: 'rgba(255,255,255,0.25)',
        avatarBg: 'rgba(232,160,64,0.15)',
        avatarColor: '#e8a040',
        dividerColor: 'rgba(255,255,255,0.04)',
        metaColor: 'rgba(255,255,255,0.35)',
        ctaBg: 'rgba(232,160,64,0.1)',
        ctaColor: '#e8a040',
        sponsorBg: 'rgba(255,100,100,0.15)',
        sponsorColor: 'rgba(255,150,150,0.8)',
      };

    case 'poker-room':
      return {
        headerColor: 'rgba(255,255,255,0.5)',
        borderColor: 'rgba(212,165,44,0.1)',
        badgeBg: 'rgba(212,165,44,0.15)',
        badgeColor: '#d4a52c',
        cardBorder: 'rgba(212,165,44,0.08)',
        cardBg: 'rgba(15,12,6,0.55)',
        hoverBorder: 'rgba(212,165,44,0.3)',
        typeColor: 'rgba(212,165,44,0.75)',
        headlineColor: 'rgba(255,255,255,0.92)',
        descColor: 'rgba(255,255,255,0.5)',
        providerColor: 'rgba(255,255,255,0.7)',
        handleColor: 'rgba(255,255,255,0.3)',
        avatarBg: 'rgba(212,165,44,0.15)',
        avatarColor: '#d4a52c',
        dividerColor: 'rgba(212,165,44,0.06)',
        metaColor: 'rgba(255,255,255,0.4)',
        ctaBg: 'rgba(212,165,44,0.12)',
        ctaColor: '#d4a52c',
        sponsorBg: 'rgba(212,165,44,0.15)',
        sponsorColor: 'rgba(212,165,44,0.85)',
      };

    case 'resort':
      return {
        headerColor: 'rgba(255,255,255,0.55)',
        borderColor: 'rgba(201,164,76,0.12)',
        badgeBg: 'rgba(201,164,76,0.15)',
        badgeColor: '#c9a44c',
        cardBorder: 'rgba(201,164,76,0.1)',
        cardBg: 'rgba(18,14,8,0.6)',
        hoverBorder: 'rgba(201,164,76,0.35)',
        typeColor: 'rgba(201,164,76,0.8)',
        headlineColor: 'rgba(255,255,255,0.95)',
        descColor: 'rgba(255,255,255,0.55)',
        providerColor: 'rgba(255,255,255,0.75)',
        handleColor: 'rgba(255,255,255,0.35)',
        avatarBg: 'rgba(201,164,76,0.15)',
        avatarColor: '#c9a44c',
        dividerColor: 'rgba(201,164,76,0.08)',
        metaColor: 'rgba(255,255,255,0.45)',
        ctaBg: 'rgba(201,164,76,0.15)',
        ctaColor: '#c9a44c',
        sponsorBg: 'rgba(201,164,76,0.15)',
        sponsorColor: 'rgba(201,164,76,0.9)',
      };

    case 'high-roller':
      return {
        headerColor: 'rgba(212,165,44,0.7)',
        borderColor: 'rgba(212,165,44,0.15)',
        badgeBg: 'rgba(212,165,44,0.12)',
        badgeColor: '#d4a52c',
        cardBorder: 'rgba(212,165,44,0.12)',
        cardBg: 'rgba(10,8,4,0.7)',
        hoverBorder: 'rgba(212,165,44,0.4)',
        typeColor: 'rgba(212,165,44,0.85)',
        headlineColor: 'rgba(255,235,180,0.98)',
        descColor: 'rgba(255,255,255,0.6)',
        providerColor: 'rgba(255,235,180,0.8)',
        handleColor: 'rgba(212,165,44,0.4)',
        avatarBg: 'rgba(212,165,44,0.2)',
        avatarColor: '#f5e6b0',
        dividerColor: 'rgba(212,165,44,0.1)',
        metaColor: 'rgba(212,165,44,0.5)',
        ctaBg: 'rgba(212,165,44,0.18)',
        ctaColor: '#f5e6b0',
        sponsorBg: 'rgba(212,165,44,0.2)',
        sponsorColor: '#f5e6b0',
      };

    case 'penthouse':
      return {
        headerColor: 'rgba(240,208,112,0.8)',
        borderColor: 'rgba(240,208,112,0.12)',
        badgeBg: 'rgba(240,208,112,0.1)',
        badgeColor: '#f0d070',
        cardBorder: 'rgba(240,208,112,0.1)',
        cardBg: 'rgba(8,6,3,0.8)',
        hoverBorder: 'rgba(240,208,112,0.3)',
        typeColor: 'rgba(240,208,112,0.6)',
        headlineColor: 'rgba(255,240,200,0.98)',
        descColor: 'rgba(255,240,200,0.5)',
        providerColor: 'rgba(255,240,200,0.85)',
        handleColor: 'rgba(240,208,112,0.35)',
        avatarBg: 'rgba(240,208,112,0.12)',
        avatarColor: '#f0d070',
        dividerColor: 'rgba(240,208,112,0.06)',
        metaColor: 'rgba(240,208,112,0.4)',
        ctaBg: 'rgba(240,208,112,0.1)',
        ctaColor: '#f0d070',
        sponsorBg: 'rgba(240,208,112,0.15)',
        sponsorColor: '#f0d070',
      };

    default:
      return getFloorStyle('motel');
  }
}
