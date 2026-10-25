import { useEffect } from 'react';
import {
  X, BadgeCheck, MessageSquare, UserPlus, CalendarCheck,
  Trophy, Star, Zap, ChevronRight, type LucideIcon,
} from 'lucide-react';
import type { DemoProfile } from '@/data/mobileDemoData';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

interface Props {
  profile: DemoProfile;
  onClose: () => void;
}

export function ProfileBottomSheet({ profile, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const initials = profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <div
        className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: 'fade-in 200ms ease-out forwards' }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[301] max-h-[85vh] overflow-y-auto rounded-t-2xl border-t"
        style={{
          borderColor: BORDER,
          background: 'rgba(12,10,8,0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 -8px 40px -8px rgba(0,0,0,0.8)',
          animation: 'sheet-slide-up 300ms cubic-bezier(0.22,1,0.36,1) forwards',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition-colors hover:text-white/80"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="px-5 pb-4 pt-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold text-white"
              style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.08)' }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-lg font-bold text-white">{profile.name}</h2>
                {profile.verified && (
                  <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: GOLD }} strokeWidth={2} />
                )}
              </div>
              <p className="text-[11px] font-mono tracking-wide" style={{ color: 'rgba(212,165,44,0.6)' }}>
                {profile.handle}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className="rounded-md px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase"
                  style={{ background: 'rgba(212,165,44,0.12)', color: GOLD_SOFT, border: `1px solid ${BORDER}` }}
                >
                  SpotVault Level {profile.spotvaultLevel}
                </span>
                {profile.featured && (
                  <span className="flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase text-amber-400">
                    <Star className="h-2.5 w-2.5" strokeWidth={2} /> Featured
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Roles */}
        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {profile.roles.map((role) => (
              <span
                key={role}
                className="rounded-md border px-2 py-1 text-[9px] font-semibold tracking-wide"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)' }}
              >
                {role}
              </span>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div className="px-5 pb-3">
          <p className="text-[12px] leading-relaxed text-white/60">{profile.bio}</p>
        </div>

        {/* Badges */}
        {profile.badges.length > 0 && (
          <div className="px-5 pb-3">
            <p className="mb-1.5 text-[9px] font-mono tracking-[0.2em] uppercase text-white/25">Badges</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.badges.map((badge) => (
                <span
                  key={badge}
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-medium"
                  style={{ borderColor: 'rgba(212,165,44,0.15)', background: 'rgba(212,165,44,0.06)', color: GOLD_SOFT }}
                >
                  <BadgeCheck className="h-2.5 w-2.5" style={{ color: GOLD }} strokeWidth={2} />
                  {badge}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Accomplishments */}
        {profile.accomplishments.length > 0 && (
          <div className="px-5 pb-3">
            <p className="mb-1.5 text-[9px] font-mono tracking-[0.2em] uppercase text-white/25">Accomplishments</p>
            <div className="space-y-1.5">
              {profile.accomplishments.map((acc) => (
                <div key={acc} className="flex items-center gap-2">
                  <Trophy className="h-3 w-3 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
                  <span className="text-[11px] text-white/60">{acc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Major Score */}
        {profile.majorScore && (
          <div className="px-5 pb-3">
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(212,165,44,0.15)', background: 'rgba(212,165,44,0.06)' }}>
              <Zap className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
              <div>
                <p className="text-[8px] font-mono tracking-widest uppercase text-white/30">Major Score</p>
                <p className="text-[13px] font-bold" style={{ color: GOLD_SOFT }}>{profile.majorScore}</p>
              </div>
            </div>
          </div>
        )}

        {/* Affiliations */}
        {profile.affiliations.length > 0 && (
          <div className="px-5 pb-3">
            <p className="mb-1.5 text-[9px] font-mono tracking-[0.2em] uppercase text-white/25">Affiliations</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.affiliations.map((aff) => (
                <span key={aff} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[9px] font-medium text-white/50">
                  {aff}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {profile.recentActivity && (
          <div className="px-5 pb-3">
            <p className="mb-1.5 text-[9px] font-mono tracking-[0.2em] uppercase text-white/25">Recent Activity</p>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[11px] text-white/50">{profile.recentActivity}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="sticky bottom-0 mt-2 border-t border-white/[0.06] bg-[rgba(12,10,8,0.95)] px-5 py-3" style={{ backdropFilter: 'blur(16px)' }}>
          <div className="flex gap-2">
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-[11px] font-bold tracking-wide transition-all active:scale-95"
              style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
            >
              <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} /> View Profile
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2.5 text-[11px] font-bold tracking-wide text-white/70 transition-all active:scale-95 hover:bg-white/[0.06]"
            >
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} /> Message
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2.5 text-[11px] font-bold tracking-wide text-white/70 transition-all active:scale-95 hover:bg-white/[0.06]"
            >
              <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} /> Follow
            </button>
          </div>
          {profile.hasOffers && (
            <button
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2.5 text-[11px] font-bold tracking-wide transition-all active:scale-95"
              style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}
            >
              <CalendarCheck className="h-3.5 w-3.5" strokeWidth={1.5} /> Book / View Offers
              <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
