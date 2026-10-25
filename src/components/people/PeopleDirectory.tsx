import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  BadgeCheck,
  MapPin,
  Users,
  Calendar,
  Zap,
  Twitter,
  Youtube,
  Instagram,
  Twitch,
  Globe,
  Clock,
  Compass,
  Crown,
  BriefcaseBusiness,
  PenTool,
  FlaskConical,
  Loader2,
} from 'lucide-react';
import {
  CATEGORY_FILTERS,
  CATEGORY_LABELS,
  type PeopleProfile,
  type PeopleCategory,
} from '@/data/peopleDirectory';
import type { SpotVaultAccount } from '@/types';
import { fetchPublicProfiles, type PublicProfileEntry } from '@/lib/profileStore';
import { fetchPublishedCoaches, type CoachListing } from '@/lib/jobsData';
import { CoachBookingRequestModal } from '@/components/coach/CoachBookingRequestModal';
import {
  ContentCard,
  CardActionButton,
  Tag,
  GOLD,
} from '@/components/ui/industry';

const GOLD_SOFT = '#f5e6b0';
import {
  fetchPublicListings,
  trackAnalyticsEvent,
  PORTAL_TYPE_LABELS,
  PORTAL_TYPE_PLURAL,
  type ProfessionalListing,
  type PortalType,
} from '@/lib/professionalListingStore';
import { ProfessionalProfilePage } from '@/components/professional/ProfessionalProfilePage';
import { CoachProfileView } from '@/components/coach/CoachProfileView';
import { PeopleProfileView } from '@/components/people/PeopleProfileView';
import { ArrowUpRight } from 'lucide-react';
import { FEATURE_FLAGS } from '@/lib/entitlements';
import { POKER_RESUMES, FEATURED_PEOPLE } from '@/data/peopleDirectory';
import { MembershipBadge } from '@/components/community/MembershipBadge';
import { StakeKingsActionMarketplace } from '@/components/stakekings/StakeKingsActionMarketplace';

interface Props {
  onOpenProfile?: (profile: PeopleProfile) => void;
  account?: SpotVaultAccount | null;
  onBuyAction?: (peopleProfileId: string) => void;
}

const SECONDARY_NAV = [
  { id: 'featured', label: 'Featured' },
  { id: 'coach-portal', label: 'Coaches' },
  { id: 'creator-portal', label: 'Creators' },
  { id: 'business-portal', label: 'Businesses' },
] as const;

const PRIMARY_NAV = [
  { id: 'people', label: 'People' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'stakekings', label: 'StakeKings Action' },
] as const;

type PrimaryTab = typeof PRIMARY_NAV[number]['id'];

export function PeopleDirectory({ onOpenProfile, account, onBuyAction }: Props) {
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('people');
  const [activeFilter, setActiveFilter] = useState<string>('featured');
  const [searchQuery, setSearchQuery] = useState('');
  const [profListings, setProfListings] = useState<ProfessionalListing[]>([]);
  const [profLoading, setProfLoading] = useState(true);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [bookingCoach, setBookingCoach] = useState<PeopleProfile | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedPeopleProfile, setSelectedPeopleProfile] = useState<PeopleProfile | null>(null);

  useEffect(() => {
    void (async () => {
      setProfLoading(true);
      try {
        const listings = await fetchPublicListings({});
        setProfListings(listings);
      } catch {
        setProfListings([]);
      } finally {
        setProfLoading(false);
      }
    })();
  }, []);

  const filteredProfListings = useMemo(() => {
    let list = profListings;
    if (activeFilter !== 'featured' && activeFilter !== 'all-prof' && activeFilter !== 'all') {
      if (['creator-portal','coach-portal','business-portal'].includes(activeFilter)) {
        list = list.filter((l) => l.portal_type === activeFilter);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.display_name.toLowerCase().includes(q) ||
          l.professional_title.toLowerCase().includes(q) ||
          l.short_bio.toLowerCase().includes(q) ||
          l.specialties.some((s) => s.toLowerCase().includes(q))
      );
    }
    return list;
  }, [profListings, activeFilter, searchQuery]);

  const [people, setPeople] = useState<PeopleProfile[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setPeopleLoading(true);
      try {
        const [profiles, coaches] = await Promise.all([
          fetchPublicProfiles(100),
          fetchPublishedCoaches(),
        ]);
        const coachIds = new Set(coaches.map((c) => c.account_id));
        const mapped: PeopleProfile[] = profiles.map((p: PublicProfileEntry) => {
          const isCoach = coachIds.has(p.user_id);
          const coachData = coaches.find((c) => c.account_id === p.user_id);
          const categories: PeopleCategory[] = [(p.primary_role as PeopleCategory) || 'poker_pro'];
          if (isCoach && !categories.includes('coach')) categories.push('coach');
          return {
            id: p.user_id,
            displayName: p.display_name || p.username || 'SpotVault Member',
            avatarUrl: p.avatar_url || undefined,
            verified: p.is_verified ?? false,
            role: isCoach ? 'coach' : ((p.primary_role as PeopleCategory) || 'poker_pro'),
            categories,
            tagline: coachData?.bio ?? p.poker_role ?? '',
            bio: coachData?.bio ?? p.bio ?? '',
            specialties: (coachData?.specialties ?? []).map((s) => s as never),
            social: {},
            followerCount: 0,
            location: p.location || undefined,
            acceptPaidMessages: false,
            acceptBookings: coachData?.available_for_coaching ?? false,
            showInDirectory: true,
            showSocialLinks: false,
            allowFollows: true,
            showCourses: false,
            showServices: isCoach,
            showReviews: isCoach,
            coachRatingAverage: coachData ? Number(coachData.coach_rating_average) : undefined,
            coachRatingCount: coachData?.coach_rating_count ?? undefined,
            badgeInfo: p.title ? { role: p.primary_role ?? undefined, title: p.title } : undefined,
          };
        });
        setPeople(mapped);
      } catch {
        setPeople([]);
      } finally {
        setPeopleLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = people.filter((p) => p.showInDirectory);

    if (activeFilter !== 'featured') {
      list = list.filter((p) => (p.categories ?? []).includes(activeFilter as PeopleCategory));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) =>
        (p.displayName ?? '').toLowerCase().includes(q) ||
        (p.tagline ?? '').toLowerCase().includes(q) ||
        (p.bio ?? '').toLowerCase().includes(q) ||
        (p.specialties ?? []).some((s) => (s ?? '').toLowerCase().includes(q)) ||
        (CATEGORY_LABELS[p.role] ?? '').toLowerCase().includes(q)
      );
    }

    const seen = new Set<string>();
    return list.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [people, activeFilter, searchQuery]);

  const combinedPeople = useMemo(() => {
    const demoFiltered = FEATURED_PEOPLE.filter((p) => {
      if (activeFilter === 'featured') return true;
      return (p.categories ?? []).some((c) => {
        if (activeFilter === 'coach-portal') return c === 'coach';
        if (activeFilter === 'creator-portal') return c === 'creator';
        if (activeFilter === 'business-portal') return c === 'business';
        return false;
      });
    });
    const realFiltered = filtered.filter((p) => {
      if (activeFilter === 'featured') return true;
      return (p.categories ?? []).some((c) => {
        if (activeFilter === 'coach-portal') return c === 'coach';
        if (activeFilter === 'creator-portal') return c === 'creator';
        if (activeFilter === 'business-portal') return c === 'business';
        return false;
      });
    });
    const seen = new Set<string>();
    const result: PeopleProfile[] = [];
    for (const p of [...demoFiltered, ...realFiltered]) {
      const key = p.displayName.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    }
    return result;
  }, [filtered, activeFilter]);

  const filteredListings = useMemo(() => {
    let list = profListings;
    if (activeFilter !== 'featured') {
      if (['creator-portal', 'coach-portal', 'business-portal'].includes(activeFilter)) {
        list = list.filter((l) => l.portal_type === activeFilter);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.display_name.toLowerCase().includes(q) ||
          l.professional_title.toLowerCase().includes(q) ||
          l.short_bio.toLowerCase().includes(q) ||
          l.specialties.some((s) => s.toLowerCase().includes(q))
      );
    }
    return list;
  }, [profListings, activeFilter, searchQuery]);

  if (selectedListingId) {
    return (
      <ProfessionalProfilePage listingId={selectedListingId} onBack={() => setSelectedListingId(null)} />
    );
  }

  if (selectedCoachId) {
    return (
      <CoachProfileView coachAccountId={selectedCoachId} onBack={() => setSelectedCoachId(null)} />
    );
  }

  if (selectedPeopleProfile) {
    return (
      <PeopleProfileView profile={selectedPeopleProfile} onBack={() => setSelectedPeopleProfile(null)} />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pt-2 sm:px-5 sm:pt-4 pb-8">
      <div className="mb-4 rounded-2xl border border-[#d4a52c]/15 bg-[linear-gradient(135deg,rgba(22,17,12,0.78),rgba(8,10,12,0.82))] p-2.5 shadow-2xl backdrop-blur-xl sm:p-3">
        {/* Row 1: Title + Primary Navigation grouped together */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2.5 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d4a52c]/20 bg-[#c0911e]/10">
              <Compass className="h-4 w-4" style={{ color: GOLD }} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Discover</h1>
          </div>
          <div className="ml-1 h-6 w-px bg-white/[0.08]" />
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {PRIMARY_NAV.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPrimaryTab(tab.id)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all ${primaryTab === tab.id ? 'border-[#d4a52c]/45 bg-white/[0.07] text-[#f5e6b0]' : 'border-white/[0.08] text-white/50 hover:border-white/15 hover:bg-white/[0.04] hover:text-white/75'}`}
              >
                {tab.id === 'stakekings' ? (
                  <span className="flex items-center gap-2">
                    <img src="/assets/stakekings-action-btn.webp" alt="StakeKings Action" className="h-5 w-auto max-w-[118px] object-contain" />
                  </span>
                ) : tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Contextual secondary filters + search */}
        {primaryTab === 'people' && (
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2">
            <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {SECONDARY_NAV.map((cat) => (
                <button key={cat.id} onClick={() => setActiveFilter(cat.id)} className={`shrink-0 rounded-lg border px-2.5 py-1 text-[9px] font-semibold tracking-widest uppercase transition-all ${activeFilter === cat.id ? 'border-[#d4a52c]/40 bg-[#c0911e]/15 text-[#f5e6b0]' : 'border-white/[0.08] text-white/50 hover:bg-white/5'}`}>
                  {cat.label}
                </button>
              ))}
            </div>
            <label className="ml-auto hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 sm:flex">
              <Search className="h-3.5 w-3.5 text-white/35" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search people..." className="w-40 bg-transparent text-[11px] text-white outline-none placeholder:text-white/25" />
            </label>
          </div>
        )}
      </div>

      {primaryTab === 'people' ? (
        <>
          {/* People cards grid */}
          {peopleLoading && profLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-[#d4a52c]/60" />
            </div>
          ) : combinedPeople.length === 0 && filteredListings.length === 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-black/50 px-6 py-12 text-center text-[12px] text-white/40">
              No profiles found in this category yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {combinedPeople.map((profile) => (
                <PeopleCard
                  key={profile.id}
                  profile={profile}
                  onOpenProfile={() => setSelectedPeopleProfile(profile)}
                  onBookCoach={account ? (p) => setBookingCoach(p) : undefined}
                  onBuyAction={onBuyAction}
                />
              ))}
              {filteredListings.map((listing) => (
                <ProfessionalCard
                  key={listing.id}
                  listing={listing}
                  onClick={() => setSelectedListingId(listing.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : primaryTab === 'bookings' ? (
        /* Bookings tab — page shell */
        <div className="rounded-xl px-6 py-8 sm:px-8 sm:py-10" style={{ background: 'rgba(8,7,6,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', border: '1px solid rgba(212,165,44,0.10)', boxShadow: '0 2px 12px -4px rgba(0,0,0,0.4)' }}>
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.15), rgba(192,145,30,0.04))', border: '1px solid rgba(192,145,30,0.20)' }}>
              <Calendar className="h-8 w-8" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <h2 className="mt-5 text-xl font-bold tracking-tight text-white sm:text-2xl">Bookings</h2>
            <p className="mt-3 max-w-md mx-auto text-[13px] leading-relaxed text-white/55 sm:text-[14px]">
              Browse and book coaching sessions, consultations, and tailored reviews with top poker professionals. The booking marketplace is being prepared for launch.
            </p>
            <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10 px-4 py-2 text-[10px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>
                <Zap className="h-3 w-3" strokeWidth={1.5} /> Coming Soon
              </span>
              <span className="text-[11px] text-white/35">Coaching · Consultations · Reviews</span>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: FlaskConical, label: 'Coaching Sessions', desc: '1-on-1 strategy and hand review' },
                { icon: Zap, label: 'Quick Consults', desc: 'Focused topic-specific sessions' },
                { icon: BriefcaseBusiness, label: 'Professional Services', desc: 'Staking, sponsorship, and business' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left">
                  <Icon className="h-4 w-4" style={{ color: GOLD + '80' }} strokeWidth={1.5} />
                  <p className="mt-2 text-[12px] font-semibold text-white/80">{label}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/40">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <StakeKingsActionMarketplace />
      )}

      {bookingCoach && account && (
        <CoachBookingRequestModal
          coach={bookingCoach}
          account={account}
          onClose={() => setBookingCoach(null)}
        />
      )}
    </div>
  );
}

function PeopleCard({ profile, onBuyAction, onBookCoach, onOpenCoach, onOpenProfile }: { profile: PeopleProfile; onBuyAction?: (peopleProfileId: string) => void; onBookCoach?: (profile: PeopleProfile) => void; onOpenCoach?: () => void; onOpenProfile?: () => void }) {
  return (
    <ContentCard>
      {/* Top: avatar + name + role */}
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-[#c091e]/10">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-base font-bold text-[#d4a52c]/60">
              {profile.displayName.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-white/90">{profile.displayName}</h3>
            {profile.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#d4a52c]" />}
            {profile.badgeInfo && (
              <MembershipBadge info={profile.badgeInfo} size="xs" />
            )}
          </div>
          <p className="mt-0.5 truncate text-[10px] font-medium text-[#d4a52c]/60">{CATEGORY_LABELS[profile.role]}</p>
        </div>
      </div>

      {/* Tagline */}
      <p className="mt-2.5 line-clamp-2 text-[11px] leading-relaxed text-white/60">{profile.tagline}</p>

      {/* Specialties */}
      {(profile.specialties ?? []).length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {(profile.specialties ?? []).slice(0, 4).map((s) => (
            <Tag key={s}>{s}</Tag>
          ))}
        </div>
      )}

      {/* Meta row */}
      <div className="mt-3 flex items-center gap-3 text-[9px] text-white/45">
        {profile.allowFollows && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" strokeWidth={1.5} />
            {(profile.followerCount ?? 0).toLocaleString()}
          </span>
        )}
        {profile.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" strokeWidth={1.5} />
            {profile.location}
          </span>
        )}
      </div>

      {/* Social icons */}
      {profile.showSocialLinks && <SocialIcons social={profile.social} />}

      {/* StakeKings Action badge */}
      {profile.stakekingsActionId && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase" style={{ borderColor: '#1a8f4a40', background: '#1a8f4a12', color: '#4ade80' }}>
            <Crown className="h-2.5 w-2.5" strokeWidth={1.5} /> Action Available · StakeKings
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
        {onOpenProfile && (
          <CardActionButton variant="primary" icon={ArrowUpRight} label="View Profile" onClick={onOpenProfile} />
        )}
        {onOpenCoach && (
          <CardActionButton variant="primary" icon={ArrowUpRight} label="Open" onClick={onOpenCoach} />
        )}
        {profile.allowFollows && (
          <CardActionButton variant="primary" label="Follow" />
        )}
        {profile.acceptPaidMessages && (
          <CardActionButton icon={Zap} label={`${profile.paidMessagePrice}c`} />
        )}
        {profile.acceptBookings && onBookCoach && FEATURE_FLAGS.coachBookingsEnabled && (
          <CardActionButton variant="primary" icon={Calendar} label="Book Session" onClick={() => onBookCoach(profile)} />
        )}
        {profile.acceptBookings && !onBookCoach && FEATURE_FLAGS.coachBookingsEnabled && (
          <span className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[9px] font-semibold tracking-wide uppercase text-white/30">
            <Calendar className="h-3 w-3" strokeWidth={1.5} /> Book Session
          </span>
        )}
        {profile.stakekingsActionId && onBuyAction && (
          <CardActionButton
            onClick={() => onBuyAction(profile.id)}
            variant="success"
            icon={Crown}
            label="Buy Action"
          />
        )}
      </div>
    </ContentCard>
  );
}

const PORTAL_ICONS: Record<string, typeof PenTool> = {
  'creator-portal': PenTool,
  'coach-portal': FlaskConical,
  'business-portal': BriefcaseBusiness,
};

function ProfessionalCard({ listing, onClick }: { listing: ProfessionalListing; onClick: () => void }) {
  const Icon = PORTAL_ICONS[listing.portal_type] ?? BriefcaseBusiness;
  const portalLabel = PORTAL_TYPE_LABELS[listing.portal_type as PortalType] ?? 'Professional';

  return (
    <ContentCard>
      <button onClick={onClick} className="w-full text-left">
        {/* Top: avatar + name + type badge */}
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#c0911e]/20 bg-[#c0911e]/10">
            {listing.profile_image_url ? (
              <img src={listing.profile_image_url} alt={listing.display_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-base font-bold text-[#d4a52c]/60">
                {listing.display_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5 rounded border border-[#c0911e]/30 bg-[#c0911e]/10 px-1 py-0 text-[7px] font-bold tracking-widest text-[#d4a52c] uppercase">
                <Icon className="h-2 w-2" /> {portalLabel}
              </span>
              {listing.is_visible && listing.availability?.isAvailable && (
                <span className="flex items-center gap-0.5 text-[9px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Available
                </span>
              )}
            </div>
            <h3 className="mt-0.5 truncate text-sm font-semibold text-white/90">{listing.display_name}</h3>
            <p className="mt-0.5 truncate text-[10px] font-medium text-[#d4a52c]/60">{listing.professional_title}</p>
          </div>
        </div>

        {/* Bio */}
        <p className="mt-2.5 line-clamp-2 text-[11px] leading-relaxed text-white/60">{listing.short_bio}</p>

        {/* Specialties */}
        {listing.specialties.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {listing.specialties.slice(0, 4).map((s) => (
              <Tag key={s}>{s}</Tag>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="mt-3 flex items-center gap-3 text-[9px] text-white/45">
          {listing.location && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {listing.location}</span>
          )}
          {listing.is_remote && (
            <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> Remote</span>
          )}
        </div>
      </button>

      {/* CTA */}
      <div className="mt-3 flex gap-1.5 border-t border-white/[0.06] pt-3">
        <button
          onClick={onClick}
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-3 py-1.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/25 hover:to-[#835e17]/25"
        >
          View Profile
        </button>
        {listing.contact_cta_url && (
          <a
            href={listing.contact_cta_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.stopPropagation(); void trackAnalyticsEvent(listing.id, 'cta_click'); }}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/60 uppercase transition hover:border-[#38424e] hover:text-white/80"
          >
            {listing.contact_cta_label || 'Contact'}
          </a>
        )}
      </div>
    </ContentCard>
  );
}

function SocialIcons({ social }: { social: PeopleProfile['social'] }) {
  const links = [
    { url: social.twitter, Icon: Twitter, label: 'Twitter' },
    { url: social.youtube, Icon: Youtube, label: 'YouTube' },
    { url: social.instagram, Icon: Instagram, label: 'Instagram' },
    { url: social.twitch, Icon: Twitch, label: 'Twitch' },
    { url: social.website, Icon: Globe, label: 'Website' },
  ].filter((l) => l.url);

  if (links.length === 0) return null;

  return (
    <div className="mt-2.5 flex items-center gap-2">
      {links.map(({ url, Icon, label }) => (
        <a
          key={label}
          href={`https://${url?.startsWith('http') ? '' : ''}${url}`}
          target="_blank"
          rel="noreferrer"
          className="text-white/40 transition-colors hover:text-white/50"
          title={label}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        </a>
      ))}
    </div>
  );
}
