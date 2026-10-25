import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, X, Users, Monitor, GraduationCap,
  Mail, Lock, LogIn, BadgeCheck, MapPin, Trophy, Award, TrendingUp,
  ShieldCheck, Loader2, ChevronDown, ChevronUp, User,
} from 'lucide-react';
import { GOLD_BRIGHT } from '@/components/ui/industry';
import {
  getFollowerCount, canMessageUser, isFollowing,
  followUser, unfollowUser,
} from '@/lib/followEngine';
import { dispatchMessageUser } from '@/lib/profileEvents';
import { supabase } from '@/lib/supabase';

const BORDER_GOLD_BRIGHT = 'rgba(224, 180, 65, 0.48)';
const SK_GREEN = '#22c55e';
const TRANSITION_MS = 280;

const SLIDE_IMAGES = [
  { src: '/assets/about-page/image copy 2.webp', alt: 'SpotVault — Turn Hands Into Real Progress', label: 'Why SpotVault' },
  { src: '/assets/about-page/image copy 3.webp', alt: 'SpotVault — Study Smarter. Play Better.', label: 'The Learning Method' },
  { src: '/assets/about-page/image copy 6.webp', alt: 'SpotVault — Review. Annotate. Share. — HH Replayer and HH Workspace', label: 'Review. Annotate. Share.' },
  { src: '/assets/about-page/image copy 4.webp', alt: 'SpotVault — Targeted Study. Bigger Results. — Spots, Multi-Spots Analysis and My Spots', label: 'Targeted Study. Bigger Results.' },
  { src: '/assets/about-page/image copy 5.webp', alt: 'SpotVault — Build, Save & Share: Turn hands into something useful', label: 'Build, Save & Share' },
  { src: '/assets/about-page/image copy 7.webp', alt: 'SpotVault — Poker Was Never Meant to Be Studied Alone — Lounges and Community', label: 'Community' },
];

const TOTAL_PAGES = SLIDE_IMAGES.length;

interface Accolade {
  icon: typeof Trophy;
  label: string;
  value: string;
  detail: string;
}

interface TeamMember {
  id: string;
  userId: string;
  name: string;
  role: string;
  tagline: string;
  bio: string;
  avatarUrl: string | null;
  location: string;
  accolades: Accolade[];
  verified: boolean;
  accountLinked?: boolean;
}

const JORDAN: TeamMember = {
  id: 'jordan-mcallister',
  userId: '17ca0743-ccdb-4d43-ab24-f84aa2821170',
  name: 'Jordan McAllister',
  role: 'Founder & CEO',
  tagline: 'SpotVault — Poker Technology & Community Platform',
  bio: 'Founder and CEO of SpotVault. Building the connected poker study and community platform that unifies players, coaches, stables and businesses. Jordan envisioned a single platform where the fragmented world of poker study — solvers, hand histories, coaching, community — comes together under one roof. A competitive MTT player with nearly a decade of product and technology leadership, Jordan leads SpotVault\u2019s product vision, platform architecture, and community strategy from Winnipeg.',
  avatarUrl: '/assets/profiles/image copy 4.webp',
  location: 'Winnipeg, Manitoba, Canada',
  verified: true,
  accolades: [
    { icon: TrendingUp, label: 'SharkScope Ability', value: '99', detail: 'Top 1,000 of approximately 30 million tracked accounts • Top 0.0033% | ~99.9967th percentile' },
    { icon: Trophy, label: 'GGPoker Super Passes', value: '7', detail: 'Seven $30,000 Super Pass packages earned in 2025 • Total package value: $210,000' },
    { icon: Award, label: 'Six-Figure Scores', value: '3', detail: '2025 — three separate 6-figure cashes' },
    { icon: BadgeCheck, label: 'Manitoba Poker Open', value: 'Champion', detail: '2026 — Manitoba Poker Open title' },
  ],
};

const BRYAN: TeamMember = {
  id: 'bryan-paris',
  userId: 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba',
  name: 'Bryan Paris',
  role: 'Poker Professional / Featured Coach',
  tagline: 'MTT / Tournament Poker — $500+ Buy-ins',
  bio: 'Tournament poker professional and coach specializing in MTT strategy and high-stakes play. COO at SpotVault. Bryan brings elite tournament expertise to the platform, helping players navigate the complexities of ICM, final table dynamics, and high-stakes decision-making. With nearly two decades as a professional player and millions in tracked cashes, Bryan leads SpotVault\u2019s coaching curriculum, tournament content, and competitive player development programs.',
  avatarUrl: '/assets/profiles/ceopic.jpg',
  location: 'Toronto, Canada',
  verified: false,
  accolades: [
    { icon: Award, label: 'Career Tracked Cashes', value: '$10M+', detail: 'Total verified lifetime tournament cashes' },
    { icon: Trophy, label: 'WPT bestbet', value: '3rd Place', detail: 'September 2026 — WPT bestbet final table' },
    { icon: BadgeCheck, label: 'Pro Consistency', value: '~20 Years', detail: 'Sustained professional poker career' },
  ],
};

interface StaffEntry {
  id: string;
  userId: string;
  name: string;
  role: string;
  avatarUrl: string;
  bio: string;
  accountLinked?: boolean;
}

// Future coach categories — hidden until populated, positions preserved in hierarchy
const SPOTVAULT_COACHES: StaffEntry[] = [];

// NOTE: The former SpotVault Support Staff section has been removed per the Team page
// restructure. Staff accounts, roles, and permissions are unchanged. The hierarchy is
// now: SpotVault Management & Coaches → SpotVault Coaches (future, hidden when empty).
// StakeKings sections are preserved below when populated.

type TeamSlide =
  | { type: 'featured'; member: TeamMember; category: string }
  | { type: 'staff'; list: StaffEntry[]; heading: string; category: string; accent: 'gold' | 'green' };

// Hierarchy: SpotVault Mgmt & Coaches → SpotVault Coaches (future, hidden until populated)
// Empty future categories are hidden but their positions are preserved.
const TEAM_SLIDES: TeamSlide[] = [
  { type: 'featured', member: JORDAN, category: 'SpotVault Management & Coaches' },
  { type: 'featured', member: BRYAN, category: 'SpotVault Management & Coaches' },
  ...(SPOTVAULT_COACHES.length > 0 ? [{ type: 'staff' as const, list: SPOTVAULT_COACHES, heading: 'SPOTVAULT COACHES', category: 'SpotVault Coaches', accent: 'gold' as const }] : []),
];

const TEAM_SLIDE_COUNT = TEAM_SLIDES.length;

type AboutTab = 'tour' | 'coaches';

interface Props {
  variant?: 'overlay' | 'embedded';
  onClose?: () => void;
  onEnterApp?: () => void;
}

export function AboutViewer({ variant = 'embedded', onClose, onEnterApp }: Props) {
  const [tab, setTab] = useState<AboutTab>('tour');
  const [page, setPage] = useState(0);
  const [teamIndex, setTeamIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [contactState, setContactState] = useState<Record<string, 'idle' | 'checking' | 'allowed' | 'membership' | 'login'>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
  const [photoModalSrc, setPhotoModalSrc] = useState<string | null>(null);
  const [photoModalName, setPhotoModalName] = useState<string>('');
  const [expandedBios, setExpandedBios] = useState<Record<string, boolean>>({});
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  const goNext = useCallback(() => {
    setPage((p) => {
      setIsAnimating(true);
      return (p + 1) % TOTAL_PAGES;
    });
  }, []);

  const goPrev = useCallback(() => {
    setPage((p) => {
      setIsAnimating(true);
      return (p - 1 + TOTAL_PAGES) % TOTAL_PAGES;
    });
  }, []);

  const goTo = useCallback((target: number) => {
    setPage((p) => {
      if (target === p) return p;
      setIsAnimating(true);
      return target;
    });
  }, []);

  const teamNext = useCallback(() => {
    setTeamIndex((i) => (i + 1) % TEAM_SLIDE_COUNT);
    setIsAnimating(true);
  }, []);

  const teamPrev = useCallback(() => {
    setTeamIndex((i) => (i - 1 + TEAM_SLIDE_COUNT) % TEAM_SLIDE_COUNT);
    setIsAnimating(true);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape' && onClose) { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, teamNext, teamPrev, tab, onClose]);

  useEffect(() => {
    if (!isAnimating) return;
    const t = setTimeout(() => setIsAnimating(false), TRANSITION_MS + 20);
    return () => clearTimeout(t);
  }, [isAnimating]);

  // Fetch real follower counts, follow status, and avatar URLs for all members
  useEffect(() => {
    let active = true;
    (async () => {
      const allMembers = [JORDAN, BRYAN, ...SPOTVAULT_COACHES].filter((m) => m.userId);
      const counts: Record<string, number> = {};
      const followedMap: Record<string, boolean> = {};
      const avatarMap: Record<string, string | null> = {};
      await Promise.all(
        allMembers.map(async (m) => {
          counts[m.id] = await getFollowerCount(m.userId);
          if (currentUserId) {
            followedMap[m.id] = await isFollowing(m.userId);
          }
        }),
      );
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, avatar_url')
        .in('user_id', allMembers.map((m) => m.userId));
      if (profiles) {
        for (const p of profiles) {
          avatarMap[p.user_id] = p.avatar_url ?? null;
        }
      }
      if (active) {
        setFollowerCounts(counts);
        setFollowed(followedMap);
        setAvatarUrls(avatarMap);
      }
    })();
    return () => { active = false; };
  }, [currentUserId]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (active && user) setCurrentUserId(user.id);
    })();
    return () => { active = false; };
  }, []);

  const handleFollow = useCallback(async (memberId: string, userId: string) => {
    if (!currentUserId || followLoading[memberId]) return;
    if (currentUserId === userId) return; // Prevent self-follow
    setFollowLoading((prev) => ({ ...prev, [memberId]: true }));
    const isCurrentlyFollowing = followed[memberId] ?? false;
    if (isCurrentlyFollowing) {
      const ok = await unfollowUser(userId);
      if (ok) {
        setFollowed((f) => ({ ...f, [memberId]: false }));
        setFollowerCounts((c) => ({ ...c, [memberId]: Math.max(0, (c[memberId] ?? 0) - 1) }));
      }
    } else {
      const result = await followUser(userId);
      if (result) {
        setFollowed((f) => ({ ...f, [memberId]: true }));
        setFollowerCounts((c) => ({ ...c, [memberId]: (c[memberId] ?? 0) + 1 }));
      }
    }
    setFollowLoading((prev) => ({ ...prev, [memberId]: false }));
  }, [currentUserId, followLoading, followed]);

  const handleContact = useCallback(async (memberId: string, userId: string, memberName: string) => {
    if (!currentUserId) {
      setContactState((prev) => ({ ...prev, [memberId]: 'login' }));
      return;
    }
    if (currentUserId === userId) return; // Prevent self-messaging
    setContactState((prev) => ({ ...prev, [memberId]: 'checking' }));
    const canMessage = await canMessageUser(userId);
    if (canMessage) {
      setContactState((prev) => ({ ...prev, [memberId]: 'allowed' }));
      dispatchMessageUser(userId);
    } else {
      setContactState((prev) => ({ ...prev, [memberId]: 'membership' }));
    }
  }, [currentUserId]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0) { goNext(); }
      else { goPrev(); }
    }
    touchStartX.current = null;
  };

  const isOverlay = variant === 'overlay';

  // Current slide from the hierarchy
  const currentSlide = TEAM_SLIDES[teamIndex] ?? TEAM_SLIDES[0];
  const featuredMember = currentSlide.type === 'featured' ? currentSlide.member : null;
  const memberAvatar = featuredMember ? (featuredMember.avatarUrl ?? avatarUrls[featuredMember.userId] ?? null) : null;
  const followerCount = featuredMember ? (followerCounts[featuredMember.id] ?? null) : null;
  const isFollowed = featuredMember ? (followed[featuredMember.id] ?? false) : false;
  const memberFollowLoading = featuredMember ? (followLoading[featuredMember.id] ?? false) : false;
  const memberContactState = featuredMember ? (contactState[featuredMember.id] ?? 'idle') : 'idle';
  const isSelfFeatured = featuredMember ? (currentUserId === featuredMember.userId) : false;

  return (
    <div
      className={isOverlay ? 'fixed inset-0 z-[70] flex flex-col' : 'flex h-[100dvh] w-full flex-col md:h-full'}
      style={isOverlay ? { background: '#000000' } : undefined}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 md:hidden"
        style={{
          backgroundImage: 'url("/player-portal-high-roller-lounge.webp")',
          backgroundSize: 'cover',
          backgroundPosition: 'center 25%',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 md:hidden"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.3), rgba(0,0,0,0.7))' }}
      />

      {isOverlay && (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 52% 34% at 50% 18%, rgba(212,165,44,0.035), transparent 72%), radial-gradient(ellipse 70% 42% at 50% 88%, rgba(212,165,44,0.018), transparent 74%)',
            }}
          />
          <div className="relative z-10 flex shrink-0 items-center justify-center px-4 py-2.5 sm:py-3.5">
            <div className="relative h-[48px] w-[min(200px,58vw)] overflow-hidden sm:h-[64px] sm:w-[260px]">
              <img
                src="/assets/about-page/image copy 3.webp"
                alt="SpotVault"
                className="absolute left-0 top-1/2 block w-full max-w-none -translate-y-1/2"
              />
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-white/[0.1] bg-black/70 text-white/50 transition-colors hover:border-amber-200/40 hover:bg-amber-200/[0.06] hover:text-white/90 sm:right-6"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </>
      )}

      {/* Embedded mobile header — back button + safe-area padding */}
      {!isOverlay && onClose && (
        <div
          className="relative z-10 flex shrink-0 items-center px-3 md:hidden"
          style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(env(safe-area-inset-top) + 44px)' }}
        >
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/70 text-white/70 transition-colors active:bg-white/10"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD_BRIGHT }} />
          </button>
          <span className="ml-2 text-sm font-bold tracking-wide text-white">About SpotVault</span>
        </div>
      )}

      {/* Tab switcher — Tour (active) + Coaches (disabled, Coming Soon) */}
      <div className="relative z-10 flex shrink-0 items-center justify-center gap-2 px-4 py-2 md:py-2">
        <button
          onClick={() => setTab('tour')}
          className="flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all"
          style={{
            borderColor: tab === 'tour' ? BORDER_GOLD_BRIGHT : 'rgba(212,165,44,0.25)',
            background: '#000000',
            color: tab === 'tour' ? GOLD_BRIGHT : 'rgba(255,255,255,0.5)',
            boxShadow: tab === 'tour' ? '0 0 12px rgba(212,165,44,0.25)' : 'none',
          }}
        >
          <Monitor className="h-3 w-3" strokeWidth={2} />
          Tour
        </button>
        <button
          disabled
          className="flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all"
          style={{
            borderColor: 'rgba(212,165,44,0.12)',
            background: 'rgba(0,0,0,0.6)',
            color: 'rgba(255,255,255,0.28)',
            cursor: 'not-allowed',
          }}
          aria-disabled="true"
        >
          <GraduationCap className="h-3 w-3" strokeWidth={2} />
          Coaches
          <span className="ml-1 rounded px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest" style={{ background: 'rgba(212,165,44,0.08)', color: 'rgba(212,165,44,0.35)' }}>Soon</span>
        </button>
      </div>

      {/* Content stage — carousel + navigation in one content-sized wrapper */}
      <div
        className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-2 sm:px-4"
        style={{ minHeight: 0 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={page}
          className="flex w-full max-w-4xl flex-col py-2"
          style={{ animation: `${isAnimating ? 'fadeIn' : 'none'} ${TRANSITION_MS}ms ease-out` }}
        >
          {/* Slide category label */}
          <div className="mb-2 flex items-center justify-center gap-1.5">
            <div className="h-px w-8" style={{ background: 'rgba(212,165,44,0.3)' }} />
            <span
              className="text-[9px] font-mono tracking-[0.25em] uppercase"
              style={{ color: 'rgba(212,165,44,0.55)' }}
            >
              {SLIDE_IMAGES[page].label}
            </span>
            <div className="h-px w-8" style={{ background: 'rgba(212,165,44,0.3)' }} />
          </div>

          {/* Premium shell */}
          <div
            className="overflow-hidden rounded-2xl border"
            style={{
              borderColor: 'rgba(212,165,44,0.15)',
              background: 'linear-gradient(135deg, rgba(8,7,6,0.95) 0%, rgba(12,10,8,0.98) 100%)',
              boxShadow: '0 24px 60px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {/* Image frame — 3:2 aspect ratio on desktop, adapts on mobile */}
            <div className="relative w-full" style={{ aspectRatio: '3 / 2' }}>
              <img
                src={SLIDE_IMAGES[page].src}
                alt={SLIDE_IMAGES[page].alt}
                className="absolute inset-0 h-full w-full object-contain p-3 sm:p-4"
                draggable={false}
              />
            </div>
          </div>
        </div>

        {/* Navigation — directly below cards, consistent spacing across all screen sizes */}
        <div className="flex w-full max-w-4xl items-center justify-center gap-4 px-4 pt-3 pb-4 sm:gap-6 sm:pt-4 sm:pb-5">
          <button
            onClick={goPrev}
            className="flex h-10 w-10 items-center justify-center rounded-full border transition-all disabled:cursor-not-allowed disabled:opacity-20"
            style={{
              borderColor: BORDER_GOLD_BRIGHT,
              background: 'rgba(212,165,44,0.075)',
            }}
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD_BRIGHT }} />
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_PAGES }, (_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="transition-all"
                aria-label={`Go to page ${i + 1}`}
              >
                <div
                  className="rounded-full transition-all"
                  style={{
                    width: i === page ? 20 : 6,
                    height: 6,
                    background: i === page ? GOLD_BRIGHT : 'rgba(255,255,255,0.16)',
                    opacity: i === page ? 1 : 0.5,
                  }}
                />
              </button>
            ))}
          </div>

          <div className="relative hidden sm:block">
            <span className="text-[10px] font-mono tabular-nums text-white/35">
              {`${page + 1} / ${TOTAL_PAGES}`}
            </span>
          </div>

          <button
            onClick={goNext}
            className="flex h-10 w-10 items-center justify-center rounded-full border transition-all"
            style={{
              borderColor: BORDER_GOLD_BRIGHT,
              background: 'rgba(212,165,44,0.075)',
            }}
            aria-label="Next page"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD_BRIGHT }} />
          </button>
        </div>
      </div>

      {/* Photo expand modal */}
      {photoModalSrc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => { setPhotoModalSrc(null); setPhotoModalName(''); }}
        >
          <div
            className="relative max-h-[85vh] max-w-[90vw] overflow-hidden rounded-2xl border-2"
            style={{ borderColor: 'rgba(212,165,44,0.5)', boxShadow: '0 0 40px rgba(212,165,44,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setPhotoModalSrc(null); setPhotoModalName(''); }}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white/70 transition-colors hover:border-amber-200/40 hover:text-white"
              aria-label="Close photo"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <img src={photoModalSrc} alt={photoModalName} className="max-h-[85vh] max-w-[90vw] object-contain" loading="lazy" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
              <p className="text-sm font-bold text-white">{photoModalName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Staff directory card — one large card containing all staff members as rows
function StaffDirectoryCard({
  staffList, heading, accent, avatarUrls, followed, followLoading, followerCounts,
  contactState, currentUserId, onFollow, onContact, onPhotoClick, expandedBios, onToggleBio,
}: {
  staffList: StaffEntry[];
  heading: string;
  accent: 'gold' | 'green';
  avatarUrls: Record<string, string | null>;
  followed: Record<string, boolean>;
  followLoading: Record<string, boolean>;
  followerCounts: Record<string, number>;
  contactState: Record<string, 'idle' | 'checking' | 'allowed' | 'membership' | 'login'>;
  currentUserId: string | null;
  onFollow: (memberId: string, userId: string) => void;
  onContact: (memberId: string, userId: string, memberName: string) => void;
  onPhotoClick: (src: string, name: string) => void;
  expandedBios: Record<string, boolean>;
  onToggleBio: (id: string) => void;
}) {
  const accentColor = accent === 'green' ? SK_GREEN : GOLD_BRIGHT;
  const accentBorder = accent === 'green' ? 'rgba(34,197,94,0.18)' : 'rgba(212,165,44,0.15)';
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border"
      style={{
        borderColor: 'rgba(212,165,44,0.15)',
        background: 'linear-gradient(135deg, rgba(8,7,6,0.95) 0%, rgba(12,10,8,0.98) 100%)',
        boxShadow: '0 24px 60px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)',
        paddingBottom: '120px',
      }}
    >
      {/* Heading */}
      <div className="flex items-center gap-2 border-b p-5 sm:p-6" style={{ borderColor: accentBorder }}>
        <ShieldCheck className="h-5 w-5" strokeWidth={1.5} style={{ color: accentColor }} />
        <h2 className="text-lg font-bold tracking-tight text-white sm:text-2xl">{heading}</h2>
      </div>

      {/* Staff rows */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4" style={{ maxHeight: '60vh' }}>
        {staffList.map((staff, idx) => {
          const avatar = staff.avatarUrl || avatarUrls[staff.userId] || null;
          const isFollowed = followed[staff.id] ?? false;
          const isLoading = followLoading[staff.id] ?? false;
          const memberContactState = contactState[staff.id] ?? 'idle';
          const count = followerCounts[staff.id] ?? null;
          const isSelfStaff = currentUserId === staff.userId;

          return (
            <div key={staff.id}>
              {idx > 0 && (
                <div className="my-3" style={{ height: 1, background: 'rgba(212,165,44,0.12)' }} />
              )}
              <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center sm:gap-3 sm:p-3">
                {/* Avatar — clickable to expand */}
                <div className="relative shrink-0">
                  <div
                    className="absolute -inset-1.5 rounded-full opacity-25 blur-xl"
                    style={{ background: 'radial-gradient(circle, rgba(212,165,44,0.3), transparent 70%)' }}
                  />
                  <button
                    onClick={() => avatar && onPhotoClick(avatar, staff.name)}
                    className="relative h-12 w-12 overflow-hidden rounded-full border-2 transition-transform hover:scale-110 sm:h-14 sm:w-14"
                    style={{ borderColor: BORDER_GOLD_BRIGHT, boxShadow: '0 0 15px rgba(212,165,44,0.12)' }}
                    aria-label={`View ${staff.name} photo`}
                  >
                    {avatar ? (
                      <img src={avatar} alt={staff.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-black/50">
                        <Users className="h-6 w-6 text-white/20" strokeWidth={1} />
                      </div>
                    )}
                  </button>
                </div>

                {/* Name + role + buttons row */}
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold tracking-tight text-white sm:text-base">{staff.name}</h3>
                    <p className="mt-0.5 text-[10px] font-mono tracking-[0.15em] uppercase" style={{ color: accentColor }}>
                      {staff.role}
                    </p>
                    {staff.accountLinked === false ? (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>Profile pending</span>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-1">
                        <Users className="h-2.5 w-2.5" strokeWidth={1.5} style={{ color: accentColor }} />
                        <span className="text-[10px] font-bold text-white/60">
                          {count === null ? '…' : count.toLocaleString()}
                        </span>
                        <span className="text-[8px] text-white/30 uppercase tracking-wide">Followers</span>
                      </div>
                    )}
                  </div>

                  {/* Follow + Contact + Profile buttons — wrap on mobile */}
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
                  {!isSelfStaff && (
                  <button
                    onClick={() => onFollow(staff.id, staff.userId)}
                    disabled={isLoading || !currentUserId || staff.accountLinked === false}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-[#d4a52c]/35 bg-[#050608] px-3 py-1.5 text-[9px] font-semibold tracking-widest text-white uppercase transition-all hover:border-[#d4a52c]/70 hover:bg-[#d4a52c]/10 hover:text-[#f5e6b0] disabled:opacity-40"
                    style={{ boxShadow: isFollowed ? 'inset 0 0 0 1px rgba(212,165,44,0.25)' : undefined }}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                    ) : (
                      <Users className="h-3 w-3" strokeWidth={1.5} />
                    )}
                    {isFollowed ? 'Following' : 'Follow'}
                  </button>
                  )}
                  {!isSelfStaff && (
                  <button
                    onClick={() => onContact(staff.id, staff.userId, staff.name)}
                    disabled={memberContactState === 'checking' || staff.accountLinked === false}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-[#d4a52c]/35 bg-[#050608] px-3 py-1.5 text-[9px] font-semibold tracking-widest text-white uppercase transition-all hover:border-[#d4a52c]/70 hover:bg-[#d4a52c]/10 hover:text-[#f5e6b0] disabled:opacity-50"
                  >
                    {memberContactState === 'checking' ? (
                      <span className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/60" />
                    ) : (
                      <Mail className="h-3 w-3" strokeWidth={1.5} />
                    )}
                    Contact
                  </button>
                  )}
                  <button
                    onClick={() => onToggleBio(staff.id)}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-[#d4a52c]/35 bg-[#050608] px-3 py-1.5 text-[9px] font-semibold tracking-widest text-white uppercase transition-all hover:border-[#d4a52c]/70 hover:bg-[#d4a52c]/10 hover:text-[#f5e6b0]"
                  >
                    <User className="h-3 w-3" strokeWidth={1.5} />
                    Profile
                    {expandedBios[staff.id] ? (
                      <ChevronUp className="h-2.5 w-2.5" strokeWidth={1.5} />
                    ) : (
                      <ChevronDown className="h-2.5 w-2.5" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
                </div>
              </div>

              {/* Contact state messages */}
              {memberContactState === 'allowed' && !isSelfStaff && (
                <p className="px-3 pb-1 text-[9px] text-emerald-300/70 sm:px-4">
                  Opening message composer for {staff.name.split(' ')[0]}…
                </p>
              )}
              {memberContactState === 'membership' && !isSelfStaff && (
                <div className="mx-3 mb-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 sm:mx-4">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-amber-300/80" strokeWidth={1.5} />
                    <span className="text-[9px] font-semibold text-amber-300/90 uppercase tracking-wide">Membership Required</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/45">
                    Upgrade to a paid membership to message {staff.name.split(' ')[0]}.
                  </p>
                </div>
              )}
              {memberContactState === 'login' && !isSelfStaff && (
                <div className="mx-3 mb-2 rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 sm:mx-4">
                  <div className="flex items-center gap-1.5">
                    <LogIn className="h-3 w-3 text-sky-300/80" strokeWidth={1.5} />
                    <span className="text-[9px] font-semibold text-sky-300/90 uppercase tracking-wide">Sign In Required</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/45">
                    Log in to your SpotVault account to contact staff members.
                  </p>
                </div>
              )}

              {/* Expandable bio panel */}
              {expandedBios[staff.id] && (
                <div className="mx-3 mb-2 rounded-lg border px-3 py-3 sm:mx-4" style={{ borderColor: 'rgba(212,165,44,0.15)', background: 'rgba(12,10,8,0.6)' }}>
                  <p className="text-[9px] font-mono tracking-[0.2em] text-white/30 uppercase">About</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">{staff.bio}</p>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty space for future staff expansion */}
        <div className="min-h-[40px]" />

        {!currentUserId && (
          <p className="mt-3 text-center text-[9px] text-white/25">Sign in to follow or contact staff members.</p>
        )}
      </div>
    </div>
  );
}
