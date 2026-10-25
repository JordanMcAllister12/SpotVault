import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { SKPlayerDevBadge } from '@/components/community/StaffIdentity';

interface SKPlayerDevBadgeForUserProps {
  userId: string;
  size?: 'xs' | 'sm' | 'md';
}

const cache = new Map<string, boolean>();
const listeners = new Map<string, Set<() => void>>();

function subscribe(userId: string, listener: () => void) {
  if (!listeners.has(userId)) listeners.set(userId, new Set());
  listeners.get(userId)!.add(listener);
  return () => { listeners.get(userId)?.delete(listener); };
}

function notify(userId: string) {
  listeners.get(userId)?.forEach((l) => l());
}

async function fetchSKAttribution(userId: string): Promise<boolean> {
  if (cache.has(userId)) return cache.get(userId)!;

  const { data, error } = await supabase.rpc('sv_get_user_group_attribution');
  if (error || !data || !Array.isArray(data)) {
    cache.set(userId, false);
    notify(userId);
    return false;
  }

  const isSK = data.some(
    (row: { group_code: string; status: string }) =>
      row.group_code === 'SK' && row.status === 'active',
  );
  cache.set(userId, isSK);
  notify(userId);
  return isSK;
}

export function SKPlayerDevBadgeForUser({ userId, size = 'xs' }: SKPlayerDevBadgeForUserProps) {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribe(userId, () => forceRender((n) => n + 1));
    void fetchSKAttribution(userId);
    return unsubscribe;
  }, [userId]);

  const isSK = cache.get(userId);
  if (!isSK) return null;

  return <SKPlayerDevBadge size={size} />;
}

export function clearSKBadgeCache(userId?: string) {
  if (userId) {
    cache.delete(userId);
  } else {
    cache.clear();
  }
}
