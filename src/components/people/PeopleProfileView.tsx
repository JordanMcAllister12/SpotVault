import { useState } from 'react';
import {
  BadgeCheck,
  MapPin,
  Users,
  Zap,
  Calendar,
  Twitter,
  Youtube,
  Instagram,
  Twitch,
  Globe,
  ArrowLeft,
  Package,
  FileText,
  MessageSquare,
  BookOpen,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  POKER_RESUMES,
  type PeopleProfile,
} from '@/data/peopleDirectory';
import { FEATURE_FLAGS } from '@/lib/entitlements';
import { PokerResumeView } from '@/components/people/PokerResumeView';
import { MembershipBadge } from '@/components/community/MembershipBadge';

const GOLD = '#d4a52c';
const GOLD_BRIGHT = '#f5e6b0';

const SOLID_BG = 'rgba(10,12,14,0.95)';
const SOLID_PANEL = 'rgba(13,15,18,0.92)';
const SOLID_HEADER = 'rgba(8,10,12,0.96)';

interface Props {
  profile: PeopleProfile;
  onBack: () => void;
}

type ProfileTab = 'about' | 'resume' | 'content' | 'services' | 'courses' | 'posts';

export function PeopleProfileView({ profile, onBack }: Props) {
  const [tab, setTab] = useState<ProfileTab>('about');

  const tabs: { id: ProfileTab; label: string; show: boolean }[] = [
    { id: 'about', label: 'About', show: true },
    { id: 'resume', label: 'Résumé', show: !!POKER_RESUMES[profile.id] },
    { id: 'content', label: 'Content', show: true },
    { id: 'services', label: 'Services', show: FEATURE_FLAGS.coachBookingsEnabled && profile.showServices && profile.acceptBookings },
    { id: 'courses', label: 'Courses / Products', show: profile.showCourses && (profile.courses?.length ?? 0) > 0 },
    { id: 'posts', label: 'Posts', show: (profile.posts?.length ?? 0) > 0 },
  ];

  const visibleTabs = tabs.filter((t) => t.show);

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-[11px] font-medium text-white/40 transition-colors hover:text-white/70"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to People
      </button>

      {/* Profile header — solid opaque container */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          background: SOLID_HEADER,
          border: '1px solid rgba(212,165,44,0.15)',
          boxShadow: '0 12px 40px -16px rgba(0,0,0,0.9)',
        }}
      >
        {/* Banner */}
        <div
          className="h-24 w-full"
          style={{
            background: `linear-gradient(135deg, rgba(192,145,30,0.18), rgba(13,15,18,0.6))`,
            borderBottom: '1px solid rgba(192,145,30,0.12)',
          }}
        />

        {/* Header content */}
        <div className="px-5 pb-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              {/* Avatar */}
              <div className="-mt-12 h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-[#0d0f12] bg-[#c091e]/10">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl font-bold text-[#d4a52c]/60">
                    {profile.displayName.charAt(0)}
                  </div>
                )}
              </div>

              {/* Name + badge + role */}
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-white sm:text-xl">{profile.displayName}</h1>
                  {profile.verified && <BadgeCheck className="h-5 w-5 text-[#d4a52c]" />}
                  {profile.badgeInfo && (
                    <MembershipBadge info={profile.badgeInfo} size="sm" />
                  )}
                </div>
                <p className="mt-1 text-[11px] font-medium text-[#d4a52c]/60">{CATEGORY_LABELS[profile.role]}</p>
                <p className="mt-0.5 text-[11px] text-white/40">{profile.tagline}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {profile.allowFollows && (
                <button className="flex items-center gap-1.5 rounded-lg border border-[#c091e]/25 bg-[#c091e]/10 px-3 py-2 text-[10px] font-bold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c091e]/20">
                  <Users className="h-3.5 w-3.5" /> Follow
                </button>
              )}
              {profile.acceptPaidMessages && (
                <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-bold tracking-wide text-white/60 uppercase transition hover:bg-white/5 hover:text-white/80">
                  <Zap className="h-3.5 w-3.5" style={{ color: GOLD }} /> Paid Message {profile.paidMessagePrice}c
                </button>
              )}
              {profile.acceptBookings && FEATURE_FLAGS.coachBookingsEnabled && (
                <button className="flex items-center gap-1.5 rounded-lg border border-[#c091e]/25 bg-[#c091e]/10 px-3 py-2 text-[10px] font-bold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c091e]/20">
                  <Calendar className="h-3.5 w-3.5" /> Book
                </button>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-white/35">
            {profile.allowFollows && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                {profile.followerCount.toLocaleString()} followers
              </span>
            )}
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
                {profile.location}
              </span>
            )}
            {profile.specialties.length > 0 && (
              <div className="flex items-center gap-1.5">
                {profile.specialties.map((s) => (
                  <span key={s} className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[9px] font-medium text-white/40">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Social links */}
          {profile.showSocialLinks && <SocialLinksRow social={profile.social} />}
        </div>
      </div>

      {/* Tabs — solid background */}
      <div
        className="mt-4 flex gap-1 overflow-x-auto rounded-xl px-2"
        style={{
          background: SOLID_PANEL,
          border: '1px solid rgba(212,165,44,0.08)',
          borderBottom: '1px solid rgba(212,165,44,0.06)',
        }}
      >
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-[11px] font-semibold tracking-wide transition-colors ${
              tab === t.id
                ? 'border-[#d4a52c] text-[#f5e6b0]'
                : 'border-transparent text-white/35 hover:text-white/55'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-5">
        {tab === 'about' && <AboutTab profile={profile} />}
        {tab === 'resume' && POKER_RESUMES[profile.id] && (
          <PokerResumeView resume={POKER_RESUMES[profile.id]} displayName={profile.displayName} />
        )}
        {tab === 'content' && <ContentTab />}
        {tab === 'services' && <ServicesTab profile={profile} />}
        {tab === 'courses' && <CoursesTab profile={profile} />}
        {tab === 'posts' && <PostsTab profile={profile} />}
      </div>
    </div>
  );
}

function SocialLinksRow({ social }: { social: PeopleProfile['social'] }) {
  const links = [
    { url: social.twitter, Icon: Twitter, label: 'Twitter' },
    { url: social.youtube, Icon: Youtube, label: 'YouTube' },
    { url: social.instagram, Icon: Instagram, label: 'Instagram' },
    { url: social.twitch, Icon: Twitch, label: 'Twitch' },
    { url: social.website, Icon: Globe, label: 'Website' },
  ].filter((l) => l.url);

  if (links.length === 0) return null;

  return (
    <div className="mt-3 flex items-center gap-3">
      {links.map(({ url, Icon, label }) => (
        <a
          key={label}
          href={url?.startsWith('http') ? url : `https://${url}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-white/30 transition-colors hover:border-[#c091e]/20 hover:text-white/60"
          title={label}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        </a>
      ))}
    </div>
  );
}

function AboutTab({ profile }: { profile: PeopleProfile }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: SOLID_PANEL, border: '1px solid rgba(212,165,44,0.08)' }}
    >
      <h3 className="mb-3 text-[11px] font-bold tracking-widest text-white/40 uppercase">Bio</h3>
      <p className="text-sm leading-relaxed text-white/60">{profile.bio}</p>

      {profile.specialties.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-[11px] font-bold tracking-widest text-white/40 uppercase">Specialties</h3>
          <div className="flex flex-wrap gap-2">
            {profile.specialties.map((s) => (
              <span key={s} className="rounded-md border border-[#c091e]/15 bg-[#c091e]/5 px-2.5 py-1 text-[10px] font-medium text-[#d4a52c]/70">
                {s}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ContentTab() {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: SOLID_PANEL, border: '1px solid rgba(212,165,44,0.08)' }}
    >
      <div className="flex items-center gap-2 text-white/30">
        <FileText className="h-5 w-5" strokeWidth={1.5} />
        <p className="text-sm text-white/40">No public content yet.</p>
      </div>
    </div>
  );
}

function ServicesTab({ profile }: { profile: PeopleProfile }) {
  if (!profile.bookingServices?.length) {
    return (
      <div className="rounded-xl p-5" style={{ background: SOLID_PANEL, border: '1px solid rgba(212,165,44,0.08)' }}>
        <p className="text-sm text-white/40">No services available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {profile.bookingServices.map((svc) => (
        <div key={svc.name} className="rounded-xl p-4" style={{ background: SOLID_PANEL, border: '1px solid rgba(212,165,44,0.08)' }}>
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold text-white/85">{svc.name}</h4>
              <p className="mt-1 text-[11px] text-white/40">{svc.description}</p>
              <p className="mt-2 text-[10px] text-white/30">{svc.duration} min session</p>
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-[#d4a52c]">{svc.price}</div>
              <div className="text-[9px] text-white/30">credits</div>
            </div>
          </div>
          <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#c091e]/25 bg-[#c091e]/10 py-2 text-[10px] font-bold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c091e]/20">
            <Calendar className="h-3.5 w-3.5" /> Book Session
          </button>
        </div>
      ))}
    </div>
  );
}

function CoursesTab({ profile }: { profile: PeopleProfile }) {
  if (!profile.courses?.length) {
    return (
      <div className="rounded-xl p-5" style={{ background: SOLID_PANEL, border: '1px solid rgba(212,165,44,0.08)' }}>
        <p className="text-sm text-white/40">No courses or products available.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {profile.courses.map((course) => (
        <div key={course.title} className="rounded-xl p-4" style={{ background: SOLID_PANEL, border: '1px solid rgba(212,165,44,0.08)' }}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#c091e]/15 bg-[#c091e]/8">
              <Package className="h-5 w-5 text-[#d4a52c]/60" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-semibold text-white/85">{course.title}</h4>
              <p className="mt-0.5 text-[10px] text-white/30">{course.enrolled} enrolled</p>
              <p className="mt-1 text-sm font-bold text-[#d4a52c]">{course.price} credits</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PostsTab({ profile }: { profile: PeopleProfile }) {
  if (!profile.posts?.length) {
    return (
      <div className="rounded-xl p-5" style={{ background: SOLID_PANEL, border: '1px solid rgba(212,165,44,0.08)' }}>
        <p className="text-sm text-white/40">No posts yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {profile.posts.map((post) => (
        <div key={post.title} className="flex items-center gap-3 rounded-xl p-4" style={{ background: SOLID_PANEL, border: '1px solid rgba(212,165,44,0.08)' }}>
          <BookOpen className="h-4 w-4 shrink-0 text-white/25" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-medium text-white/70">{post.title}</h4>
            <p className="text-[10px] text-white/25">{post.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
