import { useEffect, useState } from 'react';
import { fetchStaffMetadata, getCachedStaffMetadata, subscribeStaffMetadata, type StaffMetadata } from '@/lib/staffMetadataStore';

export function useStaffBadge(userId: string | null | undefined): StaffMetadata | null {
  const [meta, setMeta] = useState<StaffMetadata | null>(() =>
    userId ? getCachedStaffMetadata(userId) ?? null : null,
  );

  useEffect(() => {
    if (!userId) {
      setMeta(null);
      return;
    }
    const cached = getCachedStaffMetadata(userId);
    if (cached !== undefined) {
      setMeta(cached);
    }
    fetchStaffMetadata(userId).then(setMeta);
    const unsub = subscribeStaffMetadata(() => {
      setMeta(getCachedStaffMetadata(userId) ?? null);
    });
    return unsub;
  }, [userId]);

  return meta;
}
