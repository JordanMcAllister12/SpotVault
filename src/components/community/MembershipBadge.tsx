import { Crown, ShieldCheck, Scale, Briefcase, Handshake } from 'lucide-react';
import type { MembershipTier } from '@/lib/entitlements';
import { resolveTier } from '@/lib/entitlements';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const SK_GREEN = '#22c55e';
const SK_GREEN_SOFT = '#bbf7d0';

export type BadgeAffiliation = 'spotvault' | 'stakekings';

export interface BadgeAccountInfo {
  role?: string;
  membership_tier?: string;
  title?: string | null;
  partnerAffiliation?: string | null;
}

export type BadgeVariant = 'founder' | 'executive' | 'partner' | 'staff' | 'moderator' | 'membership' | 'player';

export interface MembershipBadgeResult {
  label: string;
  affiliation: BadgeAffiliation;
  variant: BadgeVariant;
  tier: MembershipTier;
}

const FOUNDER_PATTERNS = ['founder', 'ceo', 'co-founder', 'chief'];
const COO_PATTERNS = ['coo', 'chief operating', 'chief operating officer'];
const PARTNER_PATTERNS = ['partner', 'prospective partner'];

function isPartnerTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return PARTNER_PATTERNS.some((p) => lower.includes(p));
}

function isFounderTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  // 'chief operating officer' is COO, not founder — exclude it here.
  if (COO_PATTERNS.some((p) => lower.includes(p))) return false;
  return FOUNDER_PATTERNS.some((p) => lower.includes(p));
}

function isCooTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return COO_PATTERNS.some((p) => lower.includes(p));
}

function isStaffRole(role: string | null | undefined): boolean {
  return role === 'superuser' || role === 'staff' || role === 'developer_admin' || role === 'universal_access';
}

function isModeratorRole(role: string | null | undefined): boolean {
  return role === 'moderator';
}

function isStakeKingsAffiliated(partnerAffiliation: string | null | undefined): boolean {
  if (!partnerAffiliation) return false;
  const lower = partnerAffiliation.toLowerCase();
  return lower.includes('stakekings') || lower.includes('sk') || lower.includes('player_dev');
}

const TIER_LABELS: Record<MembershipTier, string> = {
  free: 'PLAYER',
  core: 'CORE',
  pro: 'PRO',
  elite: 'ELITE',
};

export function resolveBadge(info: BadgeAccountInfo): MembershipBadgeResult {
  const tier = resolveTier({ role: info.role, membership_tier: info.membership_tier });

  if (isFounderTitle(info.title)) {
    return { label: 'FOUNDER / CEO', affiliation: 'spotvault', variant: 'founder', tier };
  }

  if (isCooTitle(info.title)) {
    return { label: 'COO / COACH', affiliation: 'spotvault', variant: 'executive', tier };
  }

  if (isPartnerTitle(info.title)) {
    return { label: 'PARTNER', affiliation: 'spotvault', variant: 'partner', tier };
  }

  if (isModeratorRole(info.role)) {
    return { label: 'STAFF / MODERATOR', affiliation: 'spotvault', variant: 'moderator', tier };
  }

  if (isStaffRole(info.role)) {
    return { label: 'STAFF', affiliation: 'spotvault', variant: 'staff', tier };
  }

  if (tier !== 'free') {
    const affiliation: BadgeAffiliation = isStakeKingsAffiliated(info.partnerAffiliation) ? 'stakekings' : 'spotvault';
    return { label: TIER_LABELS[tier], affiliation, variant: 'membership', tier };
  }

  return { label: 'PLAYER', affiliation: 'spotvault', variant: 'player', tier: 'free' };
}

interface MembershipBadgeProps {
  info: BadgeAccountInfo;
  size?: 'xs' | 'sm' | 'md';
}

export function MembershipBadge({ info, size = 'sm' }: MembershipBadgeProps) {
  const result = resolveBadge(info);
  const fontSize = size === 'xs' ? 7 : size === 'sm' ? 8 : 10;
  const padding = size === 'xs' ? '1px 5px' : size === 'sm' ? '2px 6px' : '3px 8px';
  const iconSize = size === 'xs' ? 9 : size === 'sm' ? 11 : 13;
  const gap = 3;

  if (result.variant === 'founder') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap,
          fontSize,
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: '#1a1200',
          padding,
          borderRadius: 4,
          background: GOLD,
          border: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <Crown size={iconSize} strokeWidth={2} style={{ color: '#1a1200' }} />
        {result.label}
      </span>
    );
  }

  if (result.variant === 'executive') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap,
          fontSize,
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: '#1a1200',
          padding,
          borderRadius: 4,
          background: GOLD,
          border: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <Briefcase size={iconSize} strokeWidth={2} style={{ color: '#1a1200' }} />
        {result.label}
      </span>
    );
  }

  if (result.variant === 'partner') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap,
          fontSize,
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: '#1a1200',
          padding,
          borderRadius: 4,
          background: GOLD,
          border: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <Handshake size={iconSize} strokeWidth={2} style={{ color: '#1a1200' }} />
        {result.label}
      </span>
    );
  }

  if (result.variant === 'staff') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap,
          fontSize,
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: GOLD_SOFT,
          padding,
          borderRadius: 4,
          background: 'rgba(212,165,44,0.12)',
          border: '1px solid rgba(212,165,44,0.35)',
          whiteSpace: 'nowrap',
        }}
      >
        <ShieldCheck size={iconSize} strokeWidth={2} style={{ color: GOLD }} />
        {result.label}
      </span>
    );
  }

  if (result.variant === 'moderator') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap,
          fontSize,
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: GOLD_SOFT,
          padding,
          borderRadius: 4,
          background: 'rgba(212,165,44,0.12)',
          border: '1px solid rgba(212,165,44,0.35)',
          whiteSpace: 'nowrap',
        }}
      >
        <Scale size={iconSize} strokeWidth={2} style={{ color: GOLD }} />
        {result.label}
      </span>
    );
  }

  const isGreen = result.affiliation === 'stakekings';
  const color = isGreen ? SK_GREEN : GOLD;
  const softColor = isGreen ? SK_GREEN_SOFT : GOLD_SOFT;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        fontSize,
        fontWeight: 800,
        letterSpacing: '0.08em',
        color: softColor,
        padding,
        borderRadius: 4,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        whiteSpace: 'nowrap',
      }}
    >
      {result.label}
    </span>
  );
}

export function MembershipBadgeForUser({
  userId,
  accountInfo,
  size = 'sm',
}: {
  userId: string;
  accountInfo?: BadgeAccountInfo;
  size?: 'xs' | 'sm' | 'md';
}) {
  return <MembershipBadge info={accountInfo ?? {}} size={size} />;
}
