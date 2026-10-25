import { useState, useEffect } from 'react';
import { FounderBadge, isFounderTitle } from '@/components/community/StaffIdentity';
import { fetchUserTitle } from '@/hooks/useUserTitles';

interface FounderBadgeForUserProps {
  userId: string;
  size?: 'xs' | 'sm' | 'md';
}

const titleCache = new Map<string, boolean>();
const listeners = new Map<string, Set<() => void>>();

function subscribe(userId: string, cb: () => void) {
  if (!listeners.has(userId)) listeners.set(userId, new Set());
  listeners.get(userId)!.add(cb);
  return () => { listeners.get(userId)?.delete(cb); };
}

async function ensureTitleLoaded(userId: string) {
  if (titleCache.has(userId)) return;
  const info = await fetchUserTitle(userId);
  const isFounder = isFounderTitle(info?.title);
  titleCache.set(userId, isFounder);
  listeners.get(userId)?.forEach((cb) => cb());
}

export function useIsFounder(userId: string): boolean {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const unsub = subscribe(userId, () => forceRender((n) => n + 1));
    ensureTitleLoaded(userId);
    return unsub;
  }, [userId]);
  return titleCache.get(userId) ?? false;
}

export function FounderBadgeForUser({ userId, size = 'xs' }: FounderBadgeForUserProps) {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const unsub = subscribe(userId, () => forceRender((n) => n + 1));
    ensureTitleLoaded(userId);
    return unsub;
  }, [userId]);

  const isFounder = titleCache.get(userId);
  if (!isFounder) return null;

  return <FounderBadge size={size} />;
}
