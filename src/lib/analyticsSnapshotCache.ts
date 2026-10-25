import type { AnalyticsSnapshot, AnalyticsMode } from './pokerAnalytics';

interface CacheEntry {
  snapshot: AnalyticsSnapshot | null;
  fetchedAt: number;
}

const FRESH_MS = 60_000;

const cache = new Map<string, CacheEntry>();
const subscribers = new Map<string, Set<() => void>>();

function key(userId: string, mode: AnalyticsMode): string {
  return `${userId}:${mode}`;
}

export function getCachedSnapshot(userId: string, mode: AnalyticsMode): AnalyticsSnapshot | null | undefined {
  const entry = cache.get(key(userId, mode));
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > FRESH_MS) return undefined;
  return entry.snapshot;
}

export function setCachedSnapshot(userId: string, mode: AnalyticsMode, snapshot: AnalyticsSnapshot | null): void {
  cache.set(key(userId, mode), { snapshot, fetchedAt: Date.now() });
  notifySubscribers(userId, mode);
}

export function invalidateCachedSnapshot(userId: string, mode?: AnalyticsMode): void {
  if (mode) {
    cache.delete(key(userId, mode));
    notifySubscribers(userId, mode);
  } else {
    for (const k of cache.keys()) {
      if (k.startsWith(`${userId}:`)) {
        cache.delete(k);
        notifySubscribers(userId, k.split(':')[1] as AnalyticsMode);
      }
    }
  }
}

export function subscribeSnapshotCache(userId: string, mode: AnalyticsMode, cb: () => void): () => void {
  const k = key(userId, mode);
  let set = subscribers.get(k);
  if (!set) { set = new Set(); subscribers.set(k, set); }
  set.add(cb);
  return () => { set!.delete(cb); };
}

function notifySubscribers(userId: string, mode: AnalyticsMode): void {
  const set = subscribers.get(key(userId, mode));
  if (set) set.forEach(cb => cb());
}
