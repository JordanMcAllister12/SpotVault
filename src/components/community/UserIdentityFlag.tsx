import { BadgeCheck } from 'lucide-react';
import { resolveDemoProfile } from '@/data/demoCommunityProfiles';

const GOLD = '#d4a52c';

export interface UserIdentityFlagProps {
  userId: string;
  /** Fallback display name if no demo profile exists */
  fallbackName?: string;
  /** Fallback role if no demo profile exists */
  fallbackRole?: string;
  size?: 'sm' | 'md';
}

/**
 * Inline identity flag — shows a small role badge beside a user's name.
 * Visible BEFORE hover/tap. Subtle and compact.
 */
export function UserIdentityFlag({ userId, fallbackName, fallbackRole, size = 'sm' }: UserIdentityFlagProps) {
  const profile = resolveDemoProfile(userId);
  const role = profile?.role ?? fallbackRole;
  if (!role) return null;

  const fontSize = size === 'sm' ? 7 : 8;
  const padding = size === 'sm' ? '1px 5px' : '2px 6px';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
      <span style={{
        display: 'inline-block',
        fontSize,
        fontWeight: 800,
        letterSpacing: '0.08em',
        color: GOLD,
        padding,
        borderRadius: 3,
        background: 'rgba(212,165,44,0.1)',
        border: '1px solid rgba(212,165,44,0.2)',
        whiteSpace: 'nowrap',
      }}>
        {role}
      </span>
      {profile?.isSpotVaultMember && (
        <span title="SpotVault Member" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <BadgeCheck size={size === 'sm' ? 11 : 13} style={{ color: GOLD }} strokeWidth={2.5} />
        </span>
      )}
    </span>
  );
}
