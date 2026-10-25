import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserNameInfo {
  display_name: string;
  username: string;
}

export function useUserNames(userIds: string[]): Record<string, UserNameInfo> {
  const [names, setNames] = useState<Record<string, UserNameInfo>>({});

  useEffect(() => {
    if (userIds.length === 0) return;
    let cancelled = false;

    (async () => {
      const uniqueIds = [...new Set(userIds.filter(Boolean))];
      if (uniqueIds.length === 0) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, username')
        .in('user_id', uniqueIds);

      if (cancelled || error) return;

      const map: Record<string, UserNameInfo> = {};
      for (const row of data ?? []) {
        map[row.user_id] = {
          display_name: row.display_name ?? row.username ?? 'Unknown',
          username: row.username ?? 'unknown',
        };
      }
      if (!cancelled) setNames(map);
    })();

    return () => { cancelled = true; };
  }, [userIds.join(',')]);

  return names;
}
