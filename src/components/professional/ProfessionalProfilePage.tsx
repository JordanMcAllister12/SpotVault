import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MapPin, Globe, Clock, Check, ExternalLink, Star, Loader2 } from 'lucide-react';
import {
  fetchPublicListing,
  trackAnalyticsEvent,
  PORTAL_TYPE_LABELS,
  type ProfessionalListing,
  type PortalType,
} from '@/lib/professionalListingStore';
import { GOLD, CARD_BORDER, CARD_BG, CARD_SHADOW, HEADER_ICON_STYLE } from '@/components/store/storeTokens';

interface Props {
  listingId: string;
  onBack: () => void;
}

export function ProfessionalProfilePage({ listingId, onBack }: Props) {
  const [listing, setListing] = useState<ProfessionalListing | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPublicListing(listingId);
      setListing(data);
      if (data) {
        void trackAnalyticsEvent(listingId, 'profile_view');
      }
    } catch (err) {
      console.error('Error loading listing:', err);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="py-20 text-center">
        <p className="text-[12px] text-white/40">Professional listing not found.</p>
        <button onClick={onBack} className="mt-3 text-[11px] text-[#d4a52c] hover:underline">Back to directory</button>
      </div>
    );
  }

  const portalLabel = PORTAL_TYPE_LABELS[listing.portal_type as PortalType] ?? 'Professional';

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-[11px] font-medium text-white/40 transition-colors hover:text-[#d4a52c]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Directory
      </button>

      {/* Header card */}
      <div className="rounded-xl border p-5" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#c0911e]/20 bg-[#c0911e]/10">
            {listing.profile_image_url ? (
              <img src={listing.profile_image_url} alt={listing.display_name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-[#d4a52c]/70">
                {listing.display_name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded border border-[#c0911e]/30 bg-[#c0911e]/10 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-[#d4a52c] uppercase">
                {portalLabel}
              </span>
              {listing.is_visible && (
                <span className="flex items-center gap-0.5 text-[9px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Available
                </span>
              )}
            </div>
            <h1 className="mt-1 text-lg font-bold text-white">{listing.display_name}</h1>
            <p className="text-[12px] text-white/50">{listing.professional_title}</p>
            <p className="mt-1 text-[11px] text-white/40">{listing.short_bio}</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-white/45">
          {listing.location && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {listing.location}</span>
          )}
          {listing.is_remote && (
            <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> Remote / Online</span>
          )}
          {listing.availability?.isAvailable && (
            <span className="flex items-center gap-1 text-emerald-400"><Clock className="h-3 w-3" /> Accepting new clients</span>
          )}
        </div>

        {/* CTA */}
        {listing.contact_cta_url && (
          <div className="mt-4">
            <a
              href={listing.contact_cta_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void trackAnalyticsEvent(listing.id, 'cta_click')}
              className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-4 py-2.5 text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/25 hover:to-[#835e17]/25"
            >
              <ExternalLink className="h-3.5 w-3.5" /> {listing.contact_cta_label || 'Contact'}
            </a>
          </div>
        )}
      </div>

      {/* Long description */}
      {listing.long_description && (
        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/50">About</h2>
          <p className="text-[12px] leading-relaxed text-white/65">{listing.long_description}</p>
        </div>
      )}

      {/* Specialties */}
      {listing.specialties.length > 0 && (
        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/50">Specialties</h2>
          <div className="flex flex-wrap gap-1.5">
            {listing.specialties.map((s) => (
              <span key={s} className="rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-2 py-1 text-[10px] font-medium text-[#d4a52c]">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Services */}
      {listing.services.length > 0 && (
        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/50">Services</h2>
          <div className="space-y-2">
            {listing.services.map((svc, i) => (
              <div key={i} className="flex items-start justify-between rounded-lg border border-[#1a1f25] bg-[#0e0c0a] p-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[12px] font-bold text-white">{svc.name}</h3>
                  {svc.description && <p className="mt-0.5 text-[10px] text-white/45">{svc.description}</p>}
                </div>
                {svc.price && (
                  <div className="ml-3 shrink-0 text-right">
                    <span className="text-[12px] font-bold" style={{ color: GOLD }}>{svc.price}</span>
                    {svc.priceUnit && <span className="ml-0.5 text-[9px] text-white/40">{svc.priceUnit}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing */}
      {(listing.pricing?.hourlyRate || listing.pricing?.packagePricing || listing.pricing?.contactForPricing) && (
        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/50">Pricing</h2>
          <div className="space-y-1.5">
            {listing.pricing.hourlyRate && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/50">Rate</span>
                <span className="font-bold text-white/80">{listing.pricing.hourlyRate}</span>
              </div>
            )}
            {listing.pricing.packagePricing && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/50">Package</span>
                <span className="font-bold text-white/80">{listing.pricing.packagePricing}</span>
              </div>
            )}
            {listing.pricing.contactForPricing && (
              <p className="text-[10px] text-[#d4a52c]">Contact for custom pricing</p>
            )}
          </div>
        </div>
      )}

      {/* Links */}
      {listing.links.length > 0 && (
        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/50">Links</h2>
          <div className="flex flex-wrap gap-2">
            {listing.links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-medium text-white/60 hover:border-[#38424e] hover:text-white/80"
              >
                <ExternalLink className="h-3 w-3" /> {link.label || link.url}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
