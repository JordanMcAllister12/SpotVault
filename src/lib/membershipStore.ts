import { supabase } from '@/lib/supabase';
import { resolveTier, type MembershipTier } from '@/lib/entitlements';

export interface CachedMembership {
  tier: MembershipTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'none';
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  monthlyPriceCents: number | null;
  resolvedAt: number;
}

interface CacheEntry {
  data: CachedMembership;
  promise: Promise<CachedMembership> | null;
}

const cache = new Map<string, CacheEntry>();
const subscribers = new Map<string, Set<() => void>>();

const FRESH_MS = 30_000;

function isFresh(entry: CacheEntry | undefined): boolean {
  return !!entry && Date.now() - entry.data.resolvedAt < FRESH_MS;
}

function notify(userId: string) {
  subscribers.get(userId)?.forEach((cb) => cb());
}

function subscribe(userId: string, cb: () => void): () => void {
  let set = subscribers.get(userId);
  if (!set) {
    set = new Set();
    subscribers.set(userId, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) subscribers.delete(userId);
  };
}

function setCacheData(userId: string, data: CachedMembership) {
  cache.set(userId, { data, promise: null });
  notify(userId);
}

async function fetchMembership(userId: string, fallbackAccount?: { role?: string; membership_tier?: string } | null): Promise<CachedMembership> {
  const rpcPromise = supabase.rpc('sv_resolve_effective_membership', { p_user_id: userId });
  const rowPromise = supabase
    .from('user_memberships')
    .select('tier_id, status, stripe_subscription_id, current_period_end')
    .eq('user_id', userId)
    .order('current_period_end', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const [{ data: rpcData, error: rpcError }, { data: membershipRow }] = await Promise.all([rpcPromise, rowPromise]);

  let effectiveTier: MembershipTier;
  if (rpcError || !rpcData) {
    effectiveTier = resolveTier(fallbackAccount);
  } else {
    const resolved = String(rpcData).toLowerCase();
    const validTiers: MembershipTier[] = ['free', 'core', 'pro', 'elite'];
    effectiveTier = validTiers.includes(resolved as MembershipTier) ? (resolved as MembershipTier) : resolveTier(fallbackAccount);
  }

  let monthlyPriceCents: number | null = null;
  if (effectiveTier !== 'free') {
    const { data: tierRow } = await supabase
      .from('membership_tiers')
      .select('monthly_price_cents')
      .eq('id', effectiveTier)
      .maybeSingle();
    monthlyPriceCents = tierRow?.monthly_price_cents ?? null;
  }

  return {
    tier: effectiveTier,
    status: (membershipRow?.status as CachedMembership['status']) ?? 'none',
    stripeSubscriptionId: membershipRow?.stripe_subscription_id ?? null,
    currentPeriodEnd: membershipRow?.current_period_end ?? null,
    monthlyPriceCents,
    resolvedAt: Date.now(),
  };
}

export function getCachedMembership(userId: string): CachedMembership | null {
  const entry = cache.get(userId);
  return entry?.data ?? null;
}

export function invalidateMembership(userId: string) {
  cache.delete(userId);
  notify(userId);
}

export function clearAllMembershipCache() {
  const userIds = [...cache.keys()];
  cache.clear();
  userIds.forEach((uid) => notify(uid));
}

export function refreshMembership(userId: string, fallbackAccount?: { role?: string; membership_tier?: string } | null): Promise<CachedMembership> {
  const existing = cache.get(userId);
  if (existing?.promise) return existing.promise;

  const promise = fetchMembership(userId, fallbackAccount)
    .then((data) => {
      setCacheData(userId, data);
      return data;
    })
    .catch((err) => {
      cache.set(userId, { data: existing?.data ?? fallbackCache(userId, fallbackAccount), promise: null });
      notify(userId);
      throw err;
    });

  if (existing) {
    existing.promise = promise;
  } else {
    cache.set(userId, { data: fallbackCache(userId, fallbackAccount), promise });
  }
  notify(userId);
  return promise;
}

function fallbackCache(userId: string, fallbackAccount?: { role?: string; membership_tier?: string } | null): CachedMembership {
  return {
    tier: resolveTier(fallbackAccount),
    status: 'none',
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    monthlyPriceCents: null,
    resolvedAt: 0,
  };
}

export function ensureMembershipLoaded(userId: string, fallbackAccount?: { role?: string; membership_tier?: string } | null): Promise<CachedMembership> {
  const entry = cache.get(userId);
  if (entry && isFresh(entry) && !entry.promise) {
    return Promise.resolve(entry.data);
  }
  return refreshMembership(userId, fallbackAccount);
}

export function subscribeMembership(userId: string, cb: () => void): () => void {
  return subscribe(userId, cb);
}

export function isMembershipFresh(userId: string): boolean {
  return isFresh(cache.get(userId));
}
