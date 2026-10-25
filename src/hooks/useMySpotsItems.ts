import { usePersistentState } from '@/hooks/usePersistentState';

export type MySpotsItemType = 'HH Bundle' | 'Tournament HHs' | 'Course' | 'Video' | 'Spot' | 'Coaching' | 'Analysis' | 'Digital Product';

export interface MySpotsWidgetItem {
  id: string;
  title: string;
  creator: string;
  type: MySpotsItemType;
  acquiredAt: number;
  thumbnail?: string;
}

const STORAGE_KEY = 'player-my-spots-items-v2';

const SEED_ITEMS: MySpotsWidgetItem[] = [];

export function useMySpotsWidgetItems() {
  return usePersistentState<MySpotsWidgetItem[]>(STORAGE_KEY, SEED_ITEMS);
}

export function formatAcquiredLabel(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 2) return 'Yesterday';
  if (days < 7) return `${Math.round(days)}d ago`;
  return `${Math.round(days / 7)}w ago`;
}
