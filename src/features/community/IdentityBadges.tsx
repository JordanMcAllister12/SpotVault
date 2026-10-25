import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { BadgeCheck, Trophy, DollarSign, BarChart3, TrendingUp, Medal, Wallet, UserCog, GraduationCap, Building2, Star, ExternalLink, MessageCircle, X, UserPlus, Check } from 'lucide-react';
import type { AccomplishmentWithEvidence } from './types';
import { CATEGORY_ICONS, REVIEW_STATUS_LABELS } from './types';
import { getHoverCardData, getTopAccomplishments, type HoverCardData } from './communityData';
import type { SpotVaultAccount } from '@/types';
import { isFounderTitle, isModerator, ModeratorBadge } from '@/components/community/StaffIdentity';
import { MembershipBadge, type BadgeAccountInfo } from '@/components/community/MembershipBadge';
import { SKPlayerDevBadgeForUser } from '@/components/community/SKPlayerDevBadgeForUser';
import { ConfigurableStaffBadge } from '@/components/community/ConfigurableStaffBadge';
import { SviTitleBadge } from '@/components/community/SviTitleBadge';
import { followUser, unfollowUser } from '@/lib/followEngine';
import { supabase } from '@/lib/supabase';

export const ROLE_COLORS: Record<string, string> = {
  PLAYER: '#d4a52c', PRO: '#d4a52c', COACH: '#d4a52c', MEDIA: '#d4a52c',
  CREATOR: '#d4a52c', BUSINESS: '#d4a52c', INVESTOR: '#d4a52c',
};

export const ROLE_LABELS: Record<string, string> = {
  PLAYER: 'PLAYER', PRO: 'PRO', COACH: 'COACH', MEDIA: 'MEDIA',
  CREATOR: 'CREATOR', BUSINESS: 'BUSINESS', INVESTOR: 'INVESTOR',
};

export function getRoleFromPortal(portal: string): string {
  const map: Record<string, string> = {
    PLAYER: 'PLAYER', PRO: 'PRO', COACH: 'COACH', MEDIA: 'MEDIA',
    CREATOR: 'CREATOR', BUSINESS: 'BUSINESS', INVESTOR: 'INVESTOR',
    STABLE: 'BUSINESS', JOBS: 'BUSINESS', PARTNERSHIPS: 'BUSINESS',
    MARKETPLACE: 'PLAYER', EXPO: 'BUSINESS', TOURNAMENTS: 'PLAYER',
  };
  return map[portal] ?? 'PLAYER';
}

// ── Member Checkmark ──

export function MemberCheckmark({ size = 14, isMember }: { size?: number; isMember: boolean }) {
  if (!isMember) return null;
  return (
    <span
      title="SpotVault Community Member"
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
    >
      <BadgeCheck size={size} style={{ color: '#d4a52c' }} strokeWidth={2.5} />
    </span>
  );
}

// ── Role Badge ──

export function RoleBadge({ role, size = 'sm' }: { role: string; size?: 'sm' | 'md' }) {
  const color = ROLE_COLORS[role] ?? '#d4a52c';
  const label = ROLE_LABELS[role] ?? role;
  const fontSize = size === 'sm' ? 8 : 10;
  const padding = size === 'sm' ? '2px 6px' : '3px 8px';
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize,
        fontWeight: 800,
        letterSpacing: '0.08em',
        color,
        padding,
        borderRadius: 4,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ── Verified Accomplishment Badge ──

export function VerifiedBadge({ size = 12 }: { size?: number }) {
  return (
    <span
      title="Verified by SpotVault staff"
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
    >
      <BadgeCheck size={size} style={{ color: '#22c55e' }} strokeWidth={2.5} />
    </span>
  );
}

// ── Category Icon ──

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Trophy, Medal, DollarSign, Wallet, BarChart3, TrendingUp, UserCog, GraduationCap, Building2, Star,
};

export function CategoryIcon({ category, size = 14, color = '#d4a52c' }: { category: string; size?: number; color?: string }) {
  const iconName = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] ?? 'Star';
  const Icon = ICON_MAP[iconName] ?? Star;
  return <Icon size={size} style={{ color, flexShrink: 0 }} />;
}

// ── Accomplishment Row (compact, for hover card) ──

export function CompactAccomplishment({ acc }: { acc: AccomplishmentWithEvidence }) {
  const isVerified = acc.review_status === 'verified';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <CategoryIcon category={acc.category} size={13} color={isVerified ? '#d4a52c' : '#6b7280'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: isVerified ? '#e8e0d0' : '#9ca3af',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {acc.title}
          </span>
          {isVerified && <VerifiedBadge size={11} />}
        </div>
        {acc.finish && (
          <span style={{ fontSize: 10, color: '#6b7280' }}>{acc.finish}</span>
        )}
      </div>
    </div>
  );
}

// ── Hover Profile Card ──

export interface HoverProfileCardProps {
  userId: string;
  account: SpotVaultAccount | null;
  onClose: () => void;
  onViewProfile?: (userId: string) => void;
  onMessage?: (userId: string) => void;
  anchorRect?: DOMRect | null;
}

export function HoverProfileCard({ userId, account, onClose, onViewProfile, onMessage, anchorRect }: HoverProfileCardProps) {
  const [data, setData] = useState<HoverCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getHoverCardData(userId).then(d => {
      if (!cancelled) { setData(d); setLoading(false); }
    });
    supabase.rpc('sv_get_hover_profile', { p_user_id: userId }).then(({ data: hp }) => {
      if (!cancelled && hp) {
        const row = Array.isArray(hp) ? hp[0] : hp;
        setIsFollowing(Boolean(row?.is_followed));
        setFollowerCount(Number(row?.follower_count) || 0);
      }
    });
    return () => { cancelled = true; };
  }, [userId]);

  const handleFollow = async () => {
    setFollowLoading(true);
    const prev = isFollowing;
    setIsFollowing(!prev);
    setFollowerCount(c => prev ? c - 1 : c + 1);
    try {
      if (prev) {
        await unfollowUser(userId);
      } else {
        await followUser(userId);
      }
    } catch {
      setIsFollowing(prev);
      setFollowerCount(c => prev ? c + 1 : c - 1);
    }
    setFollowLoading(false);
  };

  // Position the card relative to anchor, clamped to viewport
  const style: React.CSSProperties = useMemo(() => {
    if (!anchorRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    const cardW = Math.min(340, window.innerWidth - 32);
    const cardH = Math.min(400, window.innerHeight - 32);
    const gap = 8;
    let left = anchorRect.left;
    let top = anchorRect.bottom + gap;
    if (left + cardW > window.innerWidth - 16) left = window.innerWidth - cardW - 16;
    if (left < 16) left = 16;
    if (top + cardH > window.innerHeight - 16) top = anchorRect.top - cardH - gap;
    if (top < 16) top = 16;
    return { top, left, transform: 'none', maxHeight: cardH };
  }, [anchorRect]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const role = account ? getRoleFromPortal(account.homePortal) : 'PLAYER';
  const displayName = data?.profile?.display_name ?? account?.name ?? 'Unknown';
  const isMember = data?.entitlement?.is_paid_member ?? false;
  const topAccs = data ? getTopAccomplishments(data.accomplishments, data.featured, 4) : [];
  const badgeInfoForHover: BadgeAccountInfo = {
    role: account?.role,
    title: data?.profile?.title ?? null,
    partnerAffiliation: account?.partnerAffiliation ?? null,
  };

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
          position: 'fixed', zIndex: 9999, width: 340,
          overflowY: 'auto',
          ...style,
        }}
        className="rounded-2xl border border-[#d4a52c]/30 bg-gradient-to-b from-[#0c0a08] to-[#060504] shadow-2xl"
      >
        {/* Header gradient */}
        <div style={{
          height: 56,
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
        <div style={{ padding: '0 16px 12px', marginTop: -28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: `linear-gradient(135deg, ${ROLE_COLORS[role]}40, ${ROLE_COLORS[role]}15)`,
            border: `2px solid ${ROLE_COLORS[role]}60`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: ROLE_COLORS[role],
          }}>
            {displayName.charAt(0).toUpperCase()}
          </div>

          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: (account?.role === 'superuser' || account?.role === 'staff' || account?.role === 'universal_access' || isFounderTitle(data?.profile?.title)) ? '#d4a52c' : '#e8e0d0' }}>{displayName}</span>
            <MemberCheckmark size={15} isMember={isMember} />
          </div>

          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <MembershipBadge info={badgeInfoForHover} size="sm" />
            {isModerator(account) && <ModeratorBadge size="sm" />}
            <ConfigurableStaffBadge userId={userId} size="sm" />
            <SviTitleBadge userId={userId} size="sm" />
            <SKPlayerDevBadgeForUser userId={userId} size="sm" />
          </div>

          {data?.profile?.bio && (
            <p style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: '#9ca3af', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {data.profile.bio}
            </p>
          )}

          {data?.profile?.title && (
            <div style={{ marginTop: 4, fontSize: 10, fontWeight: 600, color: '#d4a52c' }}>
              {data.profile.title}
            </div>
          )}

          {data?.profile?.location && (
            <div style={{ marginTop: 6, fontSize: 10, color: '#6b7280' }}>
              {data.profile.location}
            </div>
          )}

          {followerCount > 0 && (
            <div style={{ marginTop: 6, fontSize: 10, color: '#6b7280' }}>
              {followerCount} Follower{followerCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Accomplishments */}
        <div style={{ padding: '0 16px 12px' }}>
          {loading ? (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <div style={{ width: 20, height: 20, margin: '0 auto', borderRadius: '50%', border: '2px solid rgba(212,165,44,0.2)', borderTopColor: '#d4a52c', animation: 'spin 0.6s linear infinite' }} />
            </div>
          ) : topAccs.length > 0 ? (
            <>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' }}>
                Accomplishments
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topAccs.map(acc => (
                  <CompactAccomplishment key={acc.id} acc={acc} />
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 10, color: '#4b5563', textAlign: 'center', padding: '8px 0' }}>
              No verified accomplishments yet
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
          {onViewProfile && (
            <button
              onClick={() => { onViewProfile(userId); onClose(); }}
              className="flex-1 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#d4a52c] transition-all hover:bg-[#d4a52c]/20"
            >
              View Profile
            </button>
          )}
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 ${
              isFollowing
                ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-300 hover:bg-emerald-300/15'
                : 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#d4a52c] hover:bg-[#d4a52c]/20'
            }`}
          >
            {isFollowing ? <Check size={13} /> : <UserPlus size={13} />}
            {isFollowing ? 'Following' : 'Follow'}
          </button>
          {onMessage && (
            <button
              onClick={() => { onMessage(userId); onClose(); }}
              className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/60 transition-all hover:bg-white/10"
            >
              <MessageCircle size={13} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Hook: useHoverCard ──

export function useHoverCard() {
  const [hoverUserId, setHoverUserId] = useState<string | null>(null);
  const [hoverAccount, setHoverAccount] = useState<SpotVaultAccount | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const openCard = useCallback((userId: string, account: SpotVaultAccount | null, rect: DOMRect | null) => {
    setHoverUserId(userId);
    setHoverAccount(account);
    setAnchorRect(rect);
  }, []);

  const closeCard = useCallback(() => {
    setHoverUserId(null);
    setHoverAccount(null);
    setAnchorRect(null);
  }, []);

  return { hoverUserId, hoverAccount, anchorRect, openCard, closeCard };
}
