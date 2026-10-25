interface ChipCountEntry {
  count: number;
  updatedAt: string;
}

const getKey = (userId: string) => `chip-counts-${userId}`;

export function getChipCounts(userId: string): Record<string, ChipCountEntry> {
  try {
    const val = localStorage.getItem(getKey(userId));
    return val ? JSON.parse(val) as Record<string, ChipCountEntry> : {};
  } catch {
    return {};
  }
}

export function getChipCount(userId: string, tournamentId: string): ChipCountEntry | null {
  const counts = getChipCounts(userId);
  return counts[tournamentId] ?? null;
}

export function setChipCount(userId: string, tournamentId: string, count: number): void {
  const counts = getChipCounts(userId);
  counts[tournamentId] = { count, updatedAt: new Date().toISOString() };
  localStorage.setItem(getKey(userId), JSON.stringify(counts));
}

export function chipCountTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
