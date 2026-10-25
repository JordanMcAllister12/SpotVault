import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, MapPin, Loader2, MessageSquare, ExternalLink, ChevronLeft,
  Check, X, Users, BriefcaseBusiness, Mic2, Camera, Building2, GraduationCap,
} from 'lucide-react';
import {
  searchRolodex,
  getRolodexListing,
  type RolodexResult,
  type RolodexDetail,
  PORTAL_TYPE_LABELS,
  type PortalType,
} from '@/lib/professionalListingStore';
import { GOLD, CARD_BORDER, CARD_BG, CARD_SHADOW } from '@/components/store/storeTokens';
import { PortalWorkspaceShell } from '@/components/shared/PortalWorkspaceShell';

const FILTER_TABS: { id: PortalType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'creator-portal', label: 'Creators' },
  { id: 'coach-portal', label: 'Coaches' },
  { id: 'business-portal', label: 'Businesses' },
  { id: 'stable-portal', label: 'Stables' },
  { id: 'media-portal', label: 'Media' },
];

const ROLE_ICONS: Record<PortalType, typeof Camera> = {
  'creator-portal': Camera,
  'coach-portal': GraduationCap,
  'business-portal': Building2,
  'stable-portal': Users,
  'media-portal': Mic2,
};

interface Props {
  viewerRole?: string;
  onContact?: (userId: string, displayName: string) => void;
}

export function IndustryRolodex({ viewerRole, onContact }: Props) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<PortalType | 'all'>('all');
  const [results, setResults] = useState<RolodexResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RolodexDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await searchRolodex({
        search: search.trim(),
        portalType: activeFilter,
        viewerRole,
      });
      setResults(data);
    } catch (err) {
      console.error('Rolodex search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [search, activeFilter, viewerRole]);

  useEffect(() => {
    const timer = setTimeout(() => { void doSearch(); }, 250);
    return () => clearTimeout(timer);
  }, [doSearch]);

  const openProfile = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await getRolodexListing(id, viewerRole);
      setDetail(d);
    } catch (err) {
      console.error('Failed to load listing:', err);
    } finally {
      setDetailLoading(false);
    }
  }, [viewerRole]);

  const closeProfile = () => {
    setSelectedId(null);
    setDetail(null);
  };

  if (selectedId) {
    return (
      <PortalWorkspaceShell maxWidth="max-w-2xl">
        <ProfileView
          detail={detail}
          loading={detailLoading}
          onBack={closeProfile}
          onContact={onContact}
        />
      </PortalWorkspaceShell>
    );
  }

  return (
    <PortalWorkspaceShell>
    <div className="mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BriefcaseBusiness className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.5} />
          <h1 className="text-lg font-bold text-white">Industry Rolodex</h1>
        </div>
        <p className="text-[12px] text-white/40">
          Discover and connect with poker industry professionals — creators, coaches, businesses, stables, and media.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" strokeWidth={1.5} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people, companies, services..."
          className="w-full rounded-xl border border-[#232a32] bg-[#0a0c0e] py-3 pl-10 pr-4 text-[13px] text-white/80 placeholder-white/25 outline-none transition-colors focus:border-[#c0911e]/40"
        />
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all ${
              activeFilter === tab.id
                ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#d4a52c]'
                : 'border-[#232a32] bg-[#161b21] text-white/50 hover:border-[#38424e] hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-10 w-10 text-white/15" strokeWidth={1.5} />
          <p className="mt-3 text-[13px] text-white/35">
            {search.trim() ? 'No professionals match your search.' : 'No professionals are currently listed in the Rolodex.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r) => (
            <RolodexCard key={r.id} result={r} onView={() => openProfile(r.id)} />
          ))}
        </div>
      )}
    </div>
    </PortalWorkspaceShell>
  );
}

function RolodexCard({ result, onView }: { result: RolodexResult; onView: () => void }) {
  const RoleIcon = ROLE_ICONS[result.portal_type] ?? Camera;
  const roleLabel = PORTAL_TYPE_LABELS[result.portal_type] ?? result.portal_type;
  const rateText = result.pricing?.hourlyRate || result.pricing?.packagePricing || (result.pricing?.contactForPricing ? 'Contact for pricing' : '');
  const isAvailable = result.availability?.isAvailable !== false;

  return (
    <div
      className="group flex flex-col rounded-xl border p-4 transition-all hover:border-[#38424e]"
      style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {result.profile_image_url ? (
          <img src={result.profile_image_url} alt={result.display_name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#232a32] bg-[#161b21]">
            <RoleIcon className="h-5 w-5 text-white/30" strokeWidth={1.5} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13px] font-bold text-white">{result.display_name}</h3>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono tracking-widest uppercase" style={{ color: GOLD, opacity: 0.7 }}>{roleLabel}</span>
            {isAvailable && (
              <span className="flex items-center gap-0.5 text-[9px] text-emerald-400/70">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" /> Available
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {result.short_bio && (
        <p className="mt-2.5 line-clamp-2 text-[11px] leading-relaxed text-white/50">{result.short_bio}</p>
      )}

      {/* Specialties */}
      {result.specialties.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {result.specialties.slice(0, 3).map((s) => (
            <span key={s} className="rounded border border-[#232a32] bg-[#161b21] px-1.5 py-0.5 text-[9px] text-white/50">{s}</span>
          ))}
          {result.specialties.length > 3 && (
            <span className="text-[9px] text-white/30">+{result.specialties.length - 3}</span>
          )}
        </div>
      )}

      {/* Available for */}
      {result.available_for.length > 0 && (
        <div className="mt-2">
          <span className="text-[8px] font-mono tracking-wider text-white/30 uppercase">Available for: </span>
          <span className="text-[10px] text-white/45">{result.available_for.slice(0, 4).join(' • ')}</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3">
        <div className="flex items-center gap-2">
          {result.location && (
            <span className="flex items-center gap-1 text-[9px] text-white/35">
              <MapPin className="h-3 w-3" strokeWidth={1.5} /> {result.location}
            </span>
          )}
          {rateText && (
            <span className="text-[9px] font-medium" style={{ color: GOLD, opacity: 0.8 }}>{rateText}</span>
          )}
        </div>
        <button
          onClick={onView}
          className="rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase text-[#d4a52c] transition-all hover:bg-[#c0911e]/20"
        >
          View Profile
        </button>
      </div>
    </div>
  );
}

function ProfileView({
  detail,
  loading,
  onBack,
  onContact,
}: {
  detail: RolodexDetail | null;
  loading: boolean;
  onBack: () => void;
  onContact?: (userId: string, displayName: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto px-4 py-10 text-center">
        <p className="text-[13px] text-white/40">This profile is no longer available.</p>
        <button onClick={onBack} className="mt-4 rounded-lg border border-[#232a32] px-4 py-2 text-[11px] text-white/60 hover:text-white">Back to Rolodex</button>
      </div>
    );
  }

  const RoleIcon = ROLE_ICONS[detail.portal_type] ?? Camera;
  const roleLabel = PORTAL_TYPE_LABELS[detail.portal_type] ?? detail.portal_type;
  const rateText = detail.pricing?.hourlyRate || detail.pricing?.packagePricing || (detail.pricing?.contactForPricing ? 'Contact for pricing' : '');

  return (
    <div className="mx-auto px-4 py-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-2 text-[11px] text-white/50 transition-colors hover:text-white/80"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} /> Back to Rolodex
      </button>

      {/* Profile card */}
      <div className="rounded-xl border p-6" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
        {/* Header */}
        <div className="flex items-start gap-4">
          {detail.profile_image_url ? (
            <img src={detail.profile_image_url} alt={detail.display_name} className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#232a32] bg-[#161b21]">
              <RoleIcon className="h-7 w-7 text-white/30" strokeWidth={1.5} />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{detail.display_name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: GOLD, opacity: 0.8 }}>{roleLabel}</span>
              {detail.professional_title && (
                <span className="text-[12px] text-white/50">{detail.professional_title}</span>
              )}
            </div>
            {detail.location && (
              <span className="mt-1 flex items-center gap-1 text-[11px] text-white/40">
                <MapPin className="h-3 w-3" strokeWidth={1.5} /> {detail.location}
                {detail.is_remote && <span className="text-white/30"> • Available remotely</span>}
              </span>
            )}
          </div>
        </div>

        {/* Bio */}
        {detail.short_bio && (
          <p className="mt-4 text-[13px] leading-relaxed text-white/60">{detail.short_bio}</p>
        )}
        {detail.long_description && (
          <p className="mt-2 text-[12px] leading-relaxed text-white/45">{detail.long_description}</p>
        )}

        {/* Specialties */}
        {detail.specialties.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-[10px] font-bold tracking-widest text-white/40 uppercase">Specialties</h3>
            <div className="flex flex-wrap gap-1.5">
              {detail.specialties.map((s) => (
                <span key={s} className="rounded-md border border-[#c0911e]/20 bg-[#c0911e]/8 px-2 py-1 text-[10px] font-medium text-[#d4a52c]">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Available for */}
        {detail.available_for.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-[10px] font-bold tracking-widest text-white/40 uppercase">Available For</h3>
            <div className="flex flex-wrap gap-1.5">
              {detail.available_for.map((a) => (
                <span key={a} className="rounded-md border border-[#232a32] bg-[#161b21] px-2 py-1 text-[10px] text-white/55">{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Services */}
        {detail.services.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-[10px] font-bold tracking-widest text-white/40 uppercase">Services</h3>
            <div className="space-y-2">
              {detail.services.map((svc, i) => (
                <div key={i} className="rounded-lg border border-[#1a1f25] bg-[#0e0c0a] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-white/70">{svc.name}</span>
                    {svc.price && (
                      <span className="text-[11px] font-semibold" style={{ color: GOLD }}>
                        {svc.price}{svc.priceUnit ? ` ${svc.priceUnit}` : ''}
                      </span>
                    )}
                  </div>
                  {svc.description && (
                    <p className="mt-1 text-[11px] text-white/40">{svc.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pricing */}
        {rateText && (
          <div className="mt-4 rounded-lg border border-[#1a1f25] bg-[#0e0c0a] px-4 py-3">
            <span className="text-[10px] font-mono tracking-widest text-white/30 uppercase">Rate: </span>
            <span className="text-[12px] font-semibold" style={{ color: GOLD }}>{rateText}</span>
          </div>
        )}

        {/* Availability */}
        <div className="mt-4 flex items-center gap-2">
          {detail.availability?.isAvailable !== false ? (
            <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[10px] font-medium text-emerald-300">
              <Check className="h-3.5 w-3.5" /> Available
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-[10px] font-medium text-red-300">
              <X className="h-3.5 w-3.5" /> Not currently available
            </span>
          )}
          {detail.availability?.acceptsOnline && (
            <span className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] text-white/50">Online</span>
          )}
          {detail.availability?.acceptsInPerson && (
            <span className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] text-white/50">In-person</span>
          )}
        </div>

        {/* Links */}
        {detail.links.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {detail.links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] text-white/60 transition-colors hover:border-[#38424e] hover:text-white/80"
              >
                <ExternalLink className="h-3 w-3" strokeWidth={1.5} /> {link.label}
              </a>
            ))}
          </div>
        )}

        {/* Contact */}
        <div className="mt-5 flex gap-2 border-t border-white/[0.06] pt-4">
          {detail.allow_spotvault_messages && onContact && (
            <button
              onClick={() => onContact(detail.user_id, detail.display_name)}
              className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-5 py-2.5 text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/25 hover:to-[#835e17]/25"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Contact
            </button>
          )}
          {detail.contact_cta_url && (
            <a
              href={detail.contact_cta_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-5 py-2.5 text-[11px] font-bold tracking-widest text-white/60 uppercase transition-all hover:border-[#38424e] hover:text-white/80"
            >
              {detail.contact_cta_label || 'Contact'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
