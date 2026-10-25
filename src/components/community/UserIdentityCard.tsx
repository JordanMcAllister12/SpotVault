import { useRef, useEffect, useMemo } from 'react';
import { BadgeCheck, Trophy, Zap, Target, MapPin, Calendar, X, ExternalLink, MessageCircle, CalendarCheck } from 'lucide-react';
import type { DemoCommunityProfile } from '@/data/demoCommunityProfiles';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

export interface UserIdentityCardProps {
  profile: DemoCommunityProfile;
  onClose: () => void;
  onViewProfile?: (userId: string) => void;
  onMessage?: (userId: string) => void;
  onBook?: (userId: string) => void;
  anchorRect?: DOMRect | null;
}

export function UserIdentityCard({ profile, onClose, onViewProfile, onMessage, onBook, anchorRect }: UserIdentityCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Position the card relative to anchor
  const style: React.CSSProperties = useMemo(() => {
    if (!anchorRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    const cardW = 320;
    const cardH = 420;
    const gap = 8;
    let left = anchorRect.left;
    let top = anchorRect.bottom + gap;
    if (left + cardW > window.innerWidth - 16) left = window.innerWidth - cardW - 16;
    if (left < 16) left = 16;
    if (top + cardH > window.innerHeight - 16) top = anchorRect.top - cardH - gap;
    return { top, left, transform: 'none' };
  }, [anchorRect]);

  // Close on outside click (desktop)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const roleLabel = profile.roleSecondary
    ? `${profile.role} / ${profile.roleSecondary}`
    : profile.role;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.3)' }}
        className="md:hidden"
      />
      <div
        ref={cardRef}
        style={{
          position: 'fixed', zIndex: 9999, width: 320,
          ...style,
        }}
        className="rounded-2xl border border-[#d4a52c]/30 bg-gradient-to-b from-[#0c0a08] to-[#060504] shadow-2xl"
      >
        {/* Header gradient */}
        <div style={{
          height: 52,
          borderRadius: '16px 16px 0 0',
          background: 'linear-gradient(135deg, rgba(212,165,44,0.12), rgba(212,165,44,0.03))',
          borderBottom: '1px solid rgba(212,165,44,0.15)',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white/80"
          >
            <X size={14} />
          </button>
        </div>

        {/* Avatar + Name */}
        <div style={{ padding: '0 16px 12px', marginTop: -26 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(212,165,44,0.25), rgba(212,165,44,0.08))',
            border: '2px solid rgba(212,165,44,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: GOLD_SOFT,
          }}>
            {profile.displayName.charAt(0).toUpperCase()}
          </div>

          {/* Name + checkmark */}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#e8e0d0' }}>{profile.displayName}</span>
            {profile.isSpotVaultMember && (
              <span title="SpotVault Member" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                <BadgeCheck size={15} style={{ color: GOLD }} strokeWidth={2.5} />
              </span>
            )}
          </div>

          {/* Role flag */}
          <div style={{ marginTop: 4 }}>
            <span style={{
              display: 'inline-block',
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: GOLD,
              padding: '2px 7px',
              borderRadius: 4,
              background: 'rgba(212,165,44,0.12)',
              border: '1px solid rgba(212,165,44,0.25)',
              whiteSpace: 'nowrap',
            }}>
              {roleLabel}
            </span>
          </div>

          {/* Headline */}
          <p style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: '#9ca3af' }}>
            {profile.headline}
          </p>
        </div>

        {/* Featured Result */}
        <div style={{ padding: '0 16px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(212,165,44,0.06)',
            border: '1px solid rgba(212,165,44,0.12)',
          }}>
            <Trophy size={13} style={{ color: GOLD, flexShrink: 0, marginTop: 1 }} strokeWidth={1.5} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#6b7280', textTransform: 'uppercase' }}>
                {profile.featuredResultLabel}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e8e0d0' }}>
                  {profile.featuredResultValue}
                </span>
                {profile.featuredResultIsDemo && (
                  <span style={{
                    fontSize: 7, fontWeight: 800, letterSpacing: '0.1em',
                    color: '#6b7280', padding: '1px 4px', borderRadius: 3,
                    background: 'rgba(107,114,128,0.15)', border: '1px solid rgba(107,114,128,0.2)',
                  }}>
                    DEMO
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SpotVault Level */}
        <div style={{ padding: '0 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={13} style={{ color: GOLD, flexShrink: 0 }} strokeWidth={1.5} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#6b7280', textTransform: 'uppercase' }}>
              SpotVault
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: GOLD_SOFT, marginLeft: 'auto' }}>
              LVL {profile.spotVaultLevel}
            </span>
          </div>
        </div>

        {/* Specialty */}
        <div style={{ padding: '0 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={13} style={{ color: '#9ca3af', flexShrink: 0 }} strokeWidth={1.5} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#6b7280', textTransform: 'uppercase' }}>
              Specialty
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', marginLeft: 'auto', textAlign: 'right' }}>
              {profile.specialty}
            </span>
          </div>
        </div>

        {/* Optional: Location + Member Since */}
        {(profile.location || profile.memberSince) && (
          <div style={{ padding: '0 16px 8px', display: 'flex', gap: 12 }}>
            {profile.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={10} style={{ color: '#4b5563' }} strokeWidth={1.5} />
                <span style={{ fontSize: 9, color: '#6b7280' }}>{profile.location}</span>
              </div>
            )}
            {profile.memberSince && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={10} style={{ color: '#4b5563' }} strokeWidth={1.5} />
                <span style={{ fontSize: 9, color: '#6b7280' }}>Since {profile.memberSince}</span>
              </div>
            )}
          </div>
        )}

        {/* Online status */}
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: profile.onlineStatus === 'online' ? '#34d399' : '#475569',
                boxShadow: profile.onlineStatus === 'online' ? '0 0 6px rgba(52,211,153,0.5)' : 'none',
              }}
            />
            <span style={{ fontSize: 9, color: profile.onlineStatus === 'online' ? '#34d399' : '#6b7280' }}>
              {profile.onlineStatus === 'online' ? 'Online' : 'Offline'}
            </span>
            <span style={{ fontSize: 8, color: '#4b5563', marginLeft: 'auto' }}>
              Member Reputation: Preview
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
          {onViewProfile && (
            <button
              onClick={() => { onViewProfile(profile.userId); onClose(); }}
              className="flex-1 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#d4a52c] transition-all hover:bg-[#d4a52c]/20"
            >
              View Profile
            </button>
          )}
          {onMessage && (
            <button
              onClick={() => { onMessage(profile.userId); onClose(); }}
              className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/60 transition-all hover:bg-white/10"
              title="Message"
            >
              <MessageCircle size={13} />
            </button>
          )}
          {profile.bookingEnabled && onBook && (
            <button
              onClick={() => { onBook(profile.userId); onClose(); }}
              className="flex items-center justify-center rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#d4a52c] transition-all hover:bg-[#d4a52c]/20"
              title="Book"
            >
              <CalendarCheck size={13} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
