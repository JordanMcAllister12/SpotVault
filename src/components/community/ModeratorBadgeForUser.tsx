import { useState, useEffect } from 'react';
import { ModeratorBadge } from '@/components/community/StaffIdentity';
import { supabase } from '@/lib/supabase';

interface ModeratorBadgeForUserProps {
  userId: string;
  size?: 'xs' | 'sm' | 'md';
}

const cache = new Map<string, boolean>();
const listeners = new Map<string, Set<() => void>>();

function subscribe(userId: string, cb: () => void) {
  if (!listeners.has(userId)) listeners.set(userId, new Set());
  listeners.get(userId)!.add(cb);
  return () => { listeners.get(userId)?.delete(cb); };
}

async function ensureLoaded(userId: string) {
  if (cache.has(userId)) return;
  const { data } = await supabase
    .from('sv_roles')
    .select('role, status')
    .eq('user_id', userId)
    .eq('role', 'moderator')
    .maybeSingle();
  const isMod = !!data && data.status === 'active';
  cache.set(userId, isMod);
  listeners.get(userId)?.forEach((cb) => cb());
}

export function ModeratorBadgeForUser({ userId, size = 'xs' }: ModeratorBadgeForUserProps) {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const unsub = subscribe(userId, () => forceRender((n) => n + 1));
    ensureLoaded(userId);
    return unsub;
  }, [userId]);

  const isMod = cache.get(userId);
  if (!isMod) return null;

  return <ModeratorBadge size={size} />;
}
