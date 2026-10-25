import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserTitleInfo {
  title: string | null;
  is_verified: boolean;
}

export function useUserTitles(userIds: string[]): Record<string, UserTitleInfo> {
  const [titles, setTitles] = useState<Record<string, UserTitleInfo>>({});

  useEffect(() => {
    if (userIds.length === 0) return;
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, title, is_verified')
        .in('user_id', uniqueIds);

      if (cancelled || error) return;

      const map: Record<string, UserTitleInfo> = {};
      for (const row of data ?? []) {
        map[row.user_id] = {
          title: row.title ?? null,
          is_verified: Boolean(row.is_verified),
        };
      }
      if (!cancelled) setTitles(map);
    })();

    return () => { cancelled = true; };
  }, [userIds.join(',')]);

  return titles;
}

const titleCache = new Map<string, UserTitleInfo | null>();

export async function fetchUserTitle(userId: string): Promise<UserTitleInfo | null> {
  if (titleCache.has(userId)) return titleCache.get(userId) ?? null;
  const { data } = await supabase
    .from('user_profiles')
    .select('title, is_verified')
    .eq('user_id', userId)
    .maybeSingle();
  const info: UserTitleInfo | null = data
    ? { title: data.title ?? null, is_verified: Boolean(data.is_verified) }
    : null;
  titleCache.set(userId, info);
  return info;
}
