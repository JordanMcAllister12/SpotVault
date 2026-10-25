import { useSyncExternalStore, useCallback, useRef } from 'react';
import {
  getCachedMembership,
  ensureMembershipLoaded,
  subscribeMembership,
  invalidateMembership,
  refreshMembership,
  isMembershipFresh,
  type CachedMembership,
} from '@/lib/membershipStore';
import { resolveTier, type MembershipTier } from '@/lib/entitlements';
import type { SpotVaultAccount } from '@/types';

export type MembershipPhase = 'unknown' | 'loading' | 'resolved' | 'error';

export interface MembershipStatus {
  tier: MembershipTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'none';
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  monthlyPriceCents: number | null;
  priceLabel: string | null;
  loading: boolean;
  phase: MembershipPhase;
  error: string | null;
  refetch: () => void;
}

function getServerSnapshot(): CachedMembership | null {
  return null;
}

export function useMembershipStatus(account: SpotVaultAccount | null | undefined): MembershipStatus {
  const userId = account?.id ?? '';
  const accountRef = useRef(account);
  accountRef.current = account;

  const cached = useSyncExternalStore(
    (cb) => (userId ? subscribeMembership(userId, cb) : () => {}),
    () => (userId ? getCachedMembership(userId) : null),
    getServerSnapshot,
  );

  const initRef = useRef(false);
  const initUserId = useRef('');

  if (userId !== initUserId.current) {
    initRef.current = false;
    initUserId.current = userId;
  }

  const phase: MembershipPhase = !userId
    ? 'resolved'
    : cached && cached.resolvedAt > 0
      ? 'resolved'
      : cached?.promise ? 'loading' : 'unknown';

  const loading = phase === 'loading' || phase === 'unknown';

  const ensureStarted = useRef(false);
  if (userId && !ensureStarted.current && !isMembershipFresh(userId) && !getCachedMembership(userId)?.resolvedAt) {
    ensureStarted.current = true;
    void ensureMembershipLoaded(userId, accountRef.current).catch(() => {
      ensureStarted.current = false;
    });
  }
  if (!userId) ensureStarted.current = false;

  const refetch = useCallback(() => {
    if (!userId) return;
    invalidateMembership(userId);
    void refreshMembership(userId, accountRef.current).catch(() => {});
  }, [userId]);

  const tier = cached?.tier ?? resolveTier(account);
  const monthlyPriceCents = cached?.monthlyPriceCents ?? null;

  const priceLabel = monthlyPriceCents !== null
    ? monthlyPriceCents === 0 ? '$0' : `$${(monthlyPriceCents / 100).toFixed(2)}/mo`
    : null;

  return {
    tier,
    status: cached?.status ?? 'none',
    stripeSubscriptionId: cached?.stripeSubscriptionId ?? null,
    currentPeriodEnd: cached?.currentPeriodEnd ?? null,
    monthlyPriceCents,
    priceLabel,
    loading,
    phase,
    error: null,
    refetch,
  };
}
