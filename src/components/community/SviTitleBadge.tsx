import { useStaffBadge } from '@/hooks/useStaffBadge';
import { fetchSviUserRank, sviRank, sviDivision, type SviUserRank } from '@/lib/sviStore';
import { RankInsignia, rankKeyToLabel, rankKeyToColor, divisionLabel, divisionColor } from '@/components/player/SviRankBadge';
import { useEffect, useState } from 'react';

interface Props {
  userId: string | null | undefined;
  size?: 'xs' | 'sm' | 'md';
}

const rankCache = new Map<string, SviUserRank | null>();

export function SviTitleBadge({ userId, size = 'xs' }: Props) {
  const meta = useStaffBadge(userId);
  const [rankData, setRankData] = useState<SviUserRank | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (rankCache.has(userId)) {
      setRankData(rankCache.get(userId) ?? null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const rank = await fetchSviUserRank(userId);
      if (cancelled) return;
      rankCache.set(userId, rank);
      setRankData(rank);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (!userId || !rankData) return null;

  const prefs = meta?.svi_badge_prefs;
  if (!prefs || prefs.selectedDisplay === 'player') return null;

  const rank = sviRank(rankData.division_rank, rankData.total_in_division);
  const div = sviDivision(rankData.svi_score);
  const rankColor = rankKeyToColor(rank.key);
  const divCol = div ? divisionColor(rankData.division) : '#9ca3af';
  const fontSize = size === 'xs' ? 7 : size === 'sm' ? 8 : 10;
  const padding = size === 'xs' ? '1px 5px' : size === 'sm' ? '2px 6px' : '3px 8px';
  const iconSize = size === 'xs' ? 10 : size === 'sm' ? 12 : 14;

  if (prefs.selectedDisplay === 'rank') {
    return (
      <span className="shrink-0 inline-flex items-center gap-1" style={{ fontSize, fontWeight: 800, letterSpacing: '0.08em', color: rankColor, whiteSpace: 'nowrap' }}>
        <RankInsignia rankKey={rank.key} size={iconSize} color={rankColor} />
        {rankKeyToLabel(rank.key)}
      </span>
    );
  }

  if (prefs.selectedDisplay === 'title') {
    return (
      <span className="shrink-0 inline-flex items-center rounded border" style={{ fontSize, fontWeight: 800, letterSpacing: '0.08em', color: divCol, padding, borderRadius: 4, background: `${divCol}12`, borderColor: `${divCol}44`, whiteSpace: 'nowrap' }}>
        {divisionLabel(rankData.division)}
      </span>
    );
  }

  // badge display
  const bg = prefs.badgeBg ?? '#1a1208';
  const textColor = prefs.badgeText ?? '#f5e6b0';
  return (
    <span className="shrink-0 inline-flex items-center gap-1 rounded border" style={{ fontSize, fontWeight: 800, letterSpacing: '0.08em', color: textColor, padding, borderRadius: 4, background: bg, borderColor: `${rankColor}44`, whiteSpace: 'nowrap' }}>
      <RankInsignia rankKey={rank.key} size={iconSize} color={rankColor} />
      {rankKeyToLabel(rank.key)}
    </span>
  );
}
