import { useState, useEffect, useCallback } from 'react';
import { fetchUnreadCounts } from '@/lib/dmStore';

/**
 * Polls the database for total unread DM count.
 * Used by workspace dock badges and mobile portal headers.
 */
export function useUnreadDMCount(currentUserId: string, pollMs = 15000): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!currentUserId) { setCount(0); return; }
    const counts = await fetchUnreadCounts(currentUserId);
    setCount(Object.values(counts).reduce((sum, c) => sum + c, 0));
  }, [currentUserId]);

  useEffect(() => {
    refresh();
    if (!currentUserId || pollMs <= 0) return;
    const timer = setInterval(refresh, pollMs);
    return () => clearInterval(timer);
  }, [refresh, currentUserId, pollMs]);

  return count;
}
