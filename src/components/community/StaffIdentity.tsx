import { ShieldCheck, Crown, Scale, GraduationCap } from 'lucide-react';
import type { SpotVaultAccount } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const MODERATOR_BLUE = '#5b8def';
const SK_GREEN = '#22c55e';
const SK_GREEN_SOFT = '#bbf7d0';

export function isStaff(account: SpotVaultAccount | null | undefined): boolean {
  return !!account && (account.role === 'superuser' || account.role === 'staff' || account.role === 'developer_admin');
}

export function isModerator(account: SpotVaultAccount | null | undefined): boolean {
  return !!account && account.role === 'moderator';
}

interface FounderBadgeProps {
  title?: string;
  size?: 'xs' | 'sm' | 'md';
}

export function FounderBadge({ title = 'FOUNDER / CEO', size = 'sm' }: FounderBadgeProps) {
  const fontSize = size === 'xs' ? 7 : size === 'sm' ? 8 : 10;
  const padding = size === 'xs' ? '1px 5px' : size === 'sm' ? '2px 6px' : '3px 8px';
  const iconSize = size === 'xs' ? 9 : size === 'sm' ? 11 : 13;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
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
      {title}
    </span>
  );
}

const FOUNDER_TITLE_PATTERNS = ['founder', 'ceo', 'co-founder', 'chief'];

export function isFounderTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return FOUNDER_TITLE_PATTERNS.some((p) => lower.includes(p));
}

interface StaffBadgeProps {
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
}

export function StaffBadge({ size = 'sm', showIcon = true }: StaffBadgeProps) {
  const fontSize = size === 'xs' ? 7 : size === 'sm' ? 8 : 10;
  const padding = size === 'xs' ? '1px 5px' : size === 'sm' ? '2px 6px' : '3px 8px';
  const iconSize = size === 'xs' ? 9 : size === 'sm' ? 11 : 13;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
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
      {showIcon && <ShieldCheck size={iconSize} strokeWidth={2} style={{ color: GOLD }} />}
      STAFF
    </span>
  );
}

interface ModeratorBadgeProps {
  size?: 'xs' | 'sm' | 'md';
}

export function ModeratorBadge({ size = 'sm' }: ModeratorBadgeProps) {
  const fontSize = size === 'xs' ? 7 : size === 'sm' ? 8 : 10;
  const padding = size === 'xs' ? '1px 5px' : size === 'sm' ? '2px 6px' : '3px 8px';
  const iconSize = size === 'xs' ? 9 : size === 'sm' ? 11 : 13;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize,
        fontWeight: 800,
        letterSpacing: '0.08em',
        color: '#c5d8f7',
        padding,
        borderRadius: 4,
        background: 'rgba(91,141,239,0.12)',
        border: '1px solid rgba(91,141,239,0.35)',
        whiteSpace: 'nowrap',
      }}
    >
      <Scale size={iconSize} strokeWidth={2} style={{ color: MODERATOR_BLUE }} />
      MODERATOR
    </span>
  );
}

interface SKPlayerDevBadgeProps {
  size?: 'xs' | 'sm' | 'md';
  title?: string;
}

export function SKPlayerDevBadge({
  size = 'sm',
  title = 'SK PLAYER DEV',
}: SKPlayerDevBadgeProps) {
  const fontSize = size === 'xs' ? 7 : size === 'sm' ? 8 : 10;
  const padding = size === 'xs' ? '1px 5px' : size === 'sm' ? '2px 6px' : '3px 8px';
  const iconSize = size === 'xs' ? 9 : size === 'sm' ? 11 : 13;

  return (
    <span
      title="StakeKings Player Development Academy"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize,
        fontWeight: 800,
        letterSpacing: '0.08em',
        color: SK_GREEN_SOFT,
        padding,
        borderRadius: 4,
        background: 'rgba(34,197,94,0.12)',
        border: '1px solid rgba(34,197,94,0.35)',
        whiteSpace: 'nowrap',
      }}
    >
      <GraduationCap size={iconSize} strokeWidth={2} style={{ color: SK_GREEN }} />
      {title}
    </span>
  );
}
